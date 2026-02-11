import express, { type Express } from "express";
import bcrypt from "bcryptjs";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import { eq, and, lt, desc } from "drizzle-orm";
import { db } from "./db";
import { broadcasts, insertWhatsappDeviceSchema, insertConversationSchema, insertMessageSchema, insertLogicConfigSchema, insertWebAssistantSchema, insertBroadcastTemplateSchema, insertMessageTemplateSchema } from "@shared/schema";
import { executeLogic, type LogicJson } from "./logicExecutor";
import { z } from "zod";
import * as whatsappManager from "./whatsappManager";
import { processBroadcast } from "./broadcastProcessor";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import puppeteer from "puppeteer";
import { LOGIC_TEMPLATES } from "./templates";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const upload = multer({ storage: multer.memoryStorage() });

interface AuthenticatedRequest extends express.Request {
  user?: any;
  file?: Express.Multer.File;
}

// Upload endpoint


// Initialize Stripe (only if key is provided)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-11-17.clover" })
  : null;

// Initialize Gemini AI
let aiInstance: GoogleGenAI | null = null;
const userAiInstances = new Map<string, GoogleGenAI>();

function getAI(userApiKey?: string | null): GoogleGenAI | null {
  // If user provided their own key, use it
  if (userApiKey) {
    if (userAiInstances.has(userApiKey)) {
      return userAiInstances.get(userApiKey)!;
    }
    const userAi = new GoogleGenAI({ apiKey: userApiKey });
    userAiInstances.set(userApiKey, userAi);
    return userAi;
  }

  // Otherwise, use system key
  if (aiInstance) return aiInstance;

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "" });
    return aiInstance;
  }
  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Evolution API Webhook (Public) - supports both direct and webhookByEvents format
  app.post("/api/webhooks/evolution/:eventType?", async (req, res) => {
    try {
      // When webhookByEvents is enabled, Evolution sends to /api/webhooks/evolution/messages-upsert
      // The event name from the URL path takes priority
      const eventFromPath = req.params.eventType;
      let event = req.body?.event || 'unknown';
      const instance = req.body?.instance || 'unknown';

      // Map URL event names to the internal event names used by the handler
      if (eventFromPath && event === 'unknown') {
        const eventMap: Record<string, string> = {
          'messages-upsert': 'MESSAGES_UPSERT',
          'connection-update': 'CONNECTION_UPDATE',
          'qrcode-updated': 'QRCODE_UPDATED',
          'contacts-upsert': 'CONTACTS_UPSERT',
          'contacts-update': 'CONTACTS_UPDATE',
          'chats-upsert': 'CHATS_UPSERT',
          'chats-update': 'CHATS_UPDATE',
          'presence-update': 'PRESENCE_UPDATE',
        };
        event = eventMap[eventFromPath] || eventFromPath.toUpperCase().replace(/-/g, '_');
        req.body.event = event;
      }

      console.log(`[Webhook] Received event: ${event} for instance: ${instance} (path: ${eventFromPath || 'direct'})`);
      res.status(200).send("OK"); // Always respond 200 fast
      await whatsappManager.handleEvolutionWebhook(req.body);
    } catch (error) {
      console.error("[Webhook Error]:", error);
      if (!res.headersSent) res.status(500).send("Error");
    }
  });

  // Auth middleware (Must be first)
  await setupAuth(app);
  // Auto-promote 'admin' and 'suporte@1' users to Super Admin on startup
  ['admin', 'suporte@1'].forEach(username => {
    storage.getUserByUsername(username).then(user => {
      if (user && !user.isAdmin) {
        storage.updateUser(user.id, { isAdmin: true }).then(() => {
          console.log(`[Storage] Automatically promoted '${username}' user to Super Admin`);
        });
      }
    });
  });

  // Upload endpoint
  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
      const uploadDir = path.join(process.cwd(), "uploads");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);

      // Return the public URL
      const fileUrl = `/uploads/${fileName}`;
      res.json({ url: fileUrl });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });
  // Auth middleware
  // Auth middleware (moved to top)

  // Serve uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Acesso administrativo negado" });
    }
    next();
  };

  // ============ BILLING & SUBSCRIPTION ROUTES ============

  app.get('/api/plans', async (req, res) => {
    try {
      const config = await storage.getBillingConfig();
      const plans = [
        {
          id: "free",
          name: config?.freePlanName || "Free Trial",
          price: 0,
          features: config?.freePlanFeatures || ["1 Bot WhatsApp", "Respostas Básicas", "Suporte da Comunidade"],
        },
        {
          id: "basic",
          name: config?.basicPlanName || "Básico",
          price: (config?.basicPlanPrice || 2990) / 100,
          priceId: process.env.STRIPE_PRICE_BASIC || "",
          features: config?.basicPlanFeatures || ["Bots Ilimitados", "Integração AI Básica", "Suporte por Email"],
          recommended: true
        },
        {
          id: "full",
          name: config?.fullPlanName || "Full",
          price: (config?.fullPlanPrice || 5990) / 100,
          priceId: process.env.STRIPE_PRICE_FULL || "",
          features: config?.fullPlanFeatures || ["Tudo do Básico", "AI Avançada (GPT-4)", "Suporte Prioritário", "API Acesso"],
        }
      ];

      res.json({
        plans,
        trialDays: config?.trialDays || 7,
        stripeEnabled: !!stripe && config?.stripeEnabled,
        pixEnabled: config?.pixEnabled,
        pixKey: config?.pixKey,
        pixBeneficiary: config?.pixBeneficiary,
        pixBank: config?.pixBank
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

      res.json({
        planId: user.currentPlan,
        planName: user.currentPlan === 'free' ? 'Teste Grátis' : (user.currentPlan === 'basic' ? 'Básico' : 'Full'),
        status: 'active',
        currentPeriodEnd: user.planExpiresAt,
        isTrialing: user.currentPlan === 'free'
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });



  // ============ MESSAGE TEMPLATES ROUTES ============

  // List templates
  app.get('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const templates = await storage.getTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Create template
  app.post('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = insertMessageTemplateSchema.parse({
        ...req.body,
        userId,
      });
      const template = await storage.createTemplate(data);
      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Update template
  app.put('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const template = await storage.updateTemplate(id, req.body);
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Delete template
  app.delete('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await storage.deleteTemplate(id);
      res.json({ message: "Template deleted" });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // AI Edit Template
  app.post('/api/ai/edit-template', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { content, instruction, currentJson, prompt, sourceType, sourceContent, useEmojis } = req.body;

      // Support both old format (content/instruction) and new format (currentJson/prompt)
      const textToEdit = content || (currentJson ? JSON.stringify(currentJson, null, 2) : "");
      const userPrompt = instruction || prompt || "";

      if (!textToEdit || !userPrompt) {
        return res.status(400).json({ message: "Content/currentJson and instruction/prompt are required" });
      }

      const user = await storage.getUser(userId);
      const ai = getAI(user?.geminiApiKey);

      if (!ai) {
        console.error("[AI Error] Gemini API Key is missing or invalid.");
        return res.status(500).json({ message: "AI service not configured - Check server logs for API Key issues" });
      }

      // Build context from source if provided
      let context = "";
      if (sourceType === 'url' && sourceContent) {
        let browser;
        try {
          const puppeteer = (await import('puppeteer')).default;
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          const page = await browser.newPage();
          await page.goto(sourceContent, { waitUntil: 'networkidle2', timeout: 30000 });
          context = await page.evaluate(() => document.body.innerText);
          await browser.close();
          context = context.slice(0, 10000);
        } catch (e: any) {
          console.error("[AI Edit] Scraping error:", e.message);
          if (browser) await browser.close().catch(() => { });
        }
      } else if (sourceType === 'text' && sourceContent) {
        context = sourceContent;
      }

      const systemPrompt = `You are an AI assistant that edits text based on instructions.
        
${context ? `CONTEXT FROM SOURCE:\n${context.slice(0, 5000)}\n\n` : ''}
ORIGINAL TEXT:
${textToEdit}

INSTRUCTION:
${userPrompt}

Please provide the EDITED TEXT based on the instruction.
${useEmojis ? 'You can use emojis to make it more engaging.' : 'Avoid using emojis.'}
Maintain the original format as much as possible unless asked to change it.
${currentJson ? 'If the original is JSON, return valid JSON.' : 'Return ONLY the edited text, no explanations.'}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: systemPrompt,
      });

      const editedText = response.text || "";

      // Try to parse as JSON if it was JSON input
      if (currentJson) {
        try {
          const cleanedText = editedText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsedJson = JSON.parse(cleanedText);
          return res.json({ original: currentJson, edited: editedText, logicJson: parsedJson });
        } catch (e) {
          // If parsing fails, return as text
          return res.json({ original: textToEdit, edited: editedText });
        }
      }

      res.json({ original: textToEdit, edited: editedText });
    } catch (error: any) {
      console.error("Error editing template with AI:", error);
      res.status(500).json({ message: `Failed to edit template: ${error.message}` });
    }
  });

  // AI Extract Menu from Image/URL/PDF
  app.post('/api/ai/extract-menu', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { sourceType, sourceContent, instruction } = req.body;

      if (!sourceType || !sourceContent) {
        return res.status(400).json({ message: "sourceType and sourceContent are required" });
      }

      const user = await storage.getUser(userId);
      const ai = getAI(user?.geminiApiKey);

      if (!ai) {
        console.error("[AI Error] Gemini API Key is missing or invalid.");
        return res.status(500).json({ message: "AI service not configured - Check server logs for API Key issues" });
      }

      let extractedText = "";
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

      // Process based on source type
      if (sourceType === 'image') {
        try {
          const prompt = `Extract ALL visible text from this image/document and format it as a clean, organized menu/list. ${instruction || 'Format with relevant emojis and prices as R$ XX,XX if visible.'}`;

          // Check if it's a base64 image/PDF
          if (sourceContent.startsWith('data:')) {
            const parts = sourceContent.split(',');
            if (parts.length < 2 || !parts[1]) {
              return res.status(400).json({ message: "Invalid file format - missing data" });
            }

            const base64Data = parts[1];
            if (!base64Data || base64Data.length < 100) {
              return res.status(400).json({ message: "Invalid file - data too short or empty" });
            }

            const estimatedSize = (base64Data.length * 3) / 4;
            if (estimatedSize > MAX_FILE_SIZE) {
              return res.status(413).json({ message: `File too large. Maximum: 10MB (current: ${(estimatedSize / 1024 / 1024).toFixed(1)}MB)` });
            }

            const mimeMatch = sourceContent.match(/^data:([^;]+);/);
            if (!mimeMatch) {
              return res.status(400).json({ message: "Invalid file format - cannot detect type" });
            }
            const mimeType = mimeMatch[1];

            const supportedTypes = [
              'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
              'image/bmp', 'image/heic', 'image/heif', 'image/tiff', 'image/svg+xml',
              'application/pdf'
            ];

            if (!supportedTypes.includes(mimeType)) {
              return res.status(400).json({
                message: `Unsupported format: ${mimeType}. Supported: JPG, PNG, GIF, WebP, HEIC, PDF`
              });
            }

            console.log(`[AI Extract] Processing ${mimeType}, size: ${(estimatedSize / 1024).toFixed(1)}KB`);

            const response = await ai.models.generateContent({
              model: "gemini-2.0-flash",
              contents: [{
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }]
            });

            extractedText = response.text || "";

            if (!extractedText || extractedText.trim().length < 10) {
              return res.status(400).json({ message: "No text detected in this file. Please ensure the image/PDF contains visible text." });
            }
          } else {
            // Regular image URL
            try {
              console.log(`[AI Extract] Fetching image from URL: ${sourceContent.substring(0, 100)}...`);
              const imageResponse = await fetch(sourceContent);
              if (!imageResponse.ok) {
                return res.status(400).json({ message: `Failed to fetch image: ${imageResponse.statusText}` });
              }

              const contentType = imageResponse.headers.get('content-type') || '';
              if (!contentType.startsWith('image/')) {
                return res.status(400).json({ message: `URL does not point to an image (type: ${contentType})` });
              }

              const arrayBuffer = await imageResponse.arrayBuffer();
              if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
                return res.status(413).json({
                  message: `Image too large. Maximum: 10MB (current: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`
                });
              }

              const base64Data = Buffer.from(arrayBuffer).toString('base64');
              console.log(`[AI Extract] Fetched ${contentType}, size: ${(arrayBuffer.byteLength / 1024).toFixed(1)}KB`);

              const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: contentType,
                        data: base64Data
                      }
                    }
                  ]
                }]
              });

              extractedText = response.text || "";

              if (!extractedText || extractedText.trim().length < 10) {
                return res.status(400).json({ message: "No text detected in this image." });
              }
            } catch (fetchError: any) {
              console.error("[AI Extract] Failed to fetch image from URL:", fetchError);
              return res.status(500).json({ message: `Failed to load image from URL: ${fetchError.message}` });
            }
          }
        } catch (error: any) {
          console.error("[AI Extract] Processing error:", error);
          return res.status(500).json({ message: `Failed to process file: ${error.message}` });
        }
      } else if (sourceType === 'url') {
        let browser;
        try {
          console.log(`[AI Extract] Scraping URL: ${sourceContent.substring(0, 100)}...`);
          const puppeteer = (await import('puppeteer')).default;
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          const page = await browser.newPage();
          await page.goto(sourceContent, { waitUntil: 'networkidle2', timeout: 30000 });
          const pageText = await page.evaluate(() => document.body.innerText);
          await browser.close();

          if (!pageText || pageText.trim().length < 50) {
            return res.status(400).json({ message: "Very little text found on this page. Please check the URL." });
          }

          const prompt = `Extract menu items from this text and format them nicely with emojis and prices:\n\n${pageText.slice(0, 10000)}\n\n${instruction || 'Format as a WhatsApp message with emojis.'}`;

          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
          });

          extractedText = response.text || "";
        } catch (e: any) {
          console.error("[AI Extract] Scraping error:", e.message);
          if (browser) await browser.close().catch(() => { });
          return res.status(500).json({ message: `Failed to extract from URL: ${e.message}` });
        }
      } else if (sourceType === 'text') {
        if (!sourceContent || sourceContent.trim().length < 10) {
          return res.status(400).json({ message: "Text is too short or empty" });
        }

        const prompt = `Format this menu/list nicely with emojis and proper structure:\n\n${sourceContent}\n\n${instruction || 'Format as a WhatsApp message with emojis.'}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });

        extractedText = response.text || "";
      }

      res.json({ extracted: extractedText });
    } catch (error: any) {
      console.error("Error extracting menu:", error);
      res.status(500).json({ message: `Failed to extract menu: ${error.message}` });
    }
  });

  // Logic Templates Route (Fix 404)
  app.get('/api/logics/templates', isAuthenticated, async (req: any, res) => {
    try {
      // Return predefined templates
      const templates = [
        {
          id: "template_welcome",
          name: "Saudacao Simples",
          category: "Basico",
          description: "Responde a saudacoes basicas como Oi, Ola, Bom dia.",
          logic: {
            rules: [
              {
                keywords: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hello"],
                reply: "Ola! 👋 Como posso ajudar voce hoje?"
              }
            ],
            default_reply: "Desculpe, nao entendi. Por favor, reformule sua pergunta.",
            pause_bot_after_reply: false
          },
          logicType: "json"
        },
        {
          id: "template_menu",
          name: "Menu de Opcoes",
          category: "Atendimento",
          description: "Apresenta um menu numerado para o cliente.",
          logic: {
            rules: [
              {
                keywords: ["menu", "opcoes", "ajuda", "inicio"],
                reply: "📋 *Menu Principal*\n\n1️⃣ Ver Produtos\n2️⃣ Fazer Pedido\n3️⃣ Falar com Atendente\n4️⃣ Horario de Funcionamento\n\nDigite o numero da opcao desejada."
              },
              {
                keywords: ["1", "produtos", "produto"],
                reply: "🛍️ *Nossos Produtos:*\n\n- Plano Basico: R$ 29,90/mes\n- Plano Premium: R$ 59,90/mes\n- Plano Empresarial: R$ 99,90/mes\n\nPara mais detalhes, digite 'mais info' ou 'menu'."
              },
              {
                keywords: ["2", "pedido", "comprar"],
                reply: "📦 *Fazer Pedido*\n\nPor favor, me informe:\n1. Qual produto deseja?\n2. Forma de pagamento (PIX, Cartao, Boleto)\n\nOu digite 'menu' para voltar."
              },
              {
                keywords: ["3", "atendente", "suporte", "humano"],
                reply: "👤 Um atendente ira falar com voce em instantes.\n\nAguarde um momento... ⏳",
                pause_bot: true
              },
              {
                keywords: ["4", "horario", "horarios", "funcionamento"],
                reply: "🕐 *Horario de Atendimento:*\n\nSeg-Sex: 9h as 18h\nSabado: 9h as 13h\nDomingo: Fechado\n\nDigite 'menu' para voltar."
              }
            ],
            default_reply: "Desculpe, nao entendi. Digite *menu* para ver as opcoes.",
            pause_bot_after_reply: false
          },
          logicType: "json"
        },
        {
          id: "template_faq",
          name: "FAQ Automatico",
          category: "Suporte",
          description: "Responde perguntas frequentes automaticamente.",
          logic: {
            rules: [
              {
                keywords: ["preco", "valor", "quanto custa", "custo"],
                reply: "💰 *Nossos Precos:*\n\nPlano Basico: R$ 29,90/mes\nPlano Premium: R$ 59,90/mes\nPlano Empresarial: R$ 99,90/mes\n\nTodos com 7 dias de teste gratis! 🎁"
              },
              {
                keywords: ["horario", "aberto", "fecha", "funcionamento"],
                reply: "🕐 Atendemos de Seg-Sex das 9h as 18h e Sabado das 9h as 13h."
              },
              {
                keywords: ["entrega", "prazo", "demora"],
                reply: "📦 Prazo de entrega: 3 a 5 dias uteis para todo Brasil via Correios."
              },
              {
                keywords: ["pagamento", "pagar", "formas"],
                reply: "💳 Aceitamos: PIX, Cartao de Credito, Boleto e Transferencia Bancaria."
              },
              {
                keywords: ["cancelar", "cancelamento", "devolver"],
                reply: "🔄 Voce pode cancelar a qualquer momento. Entre em contato com nosso suporte digitando 'atendente'."
              }
            ],
            default_reply: "Nao encontrei resposta para sua duvida. Digite 'atendente' para falar com nosso time.",
            pause_bot_after_reply: false
          },
          logicType: "json"
        },
        {
          id: "template_welcome_complete",
          name: "Boas-Vindas Completo",
          category: "Atendimento",
          description: "Mensagem de boas-vindas com menu integrado.",
          logic: {
            rules: [
              {
                keywords: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "inicio", "comecar"],
                reply: "Ola! 👋 Bem-vindo(a)!\n\n📋 *Como posso ajudar?*\n\n1️⃣ Ver Produtos\n2️⃣ Fazer Pedido\n3️⃣ Suporte\n4️⃣ Rastrear Pedido\n\nDigite o numero da opcao."
              }
            ],
            default_reply: "Digite 'oi' para comecar!",
            pause_bot_after_reply: false
          },
          logicType: "json"
        }
      ];
      res.json(templates);
    } catch (error) {
      console.error("Error fetching logic templates:", error);
      res.status(500).json({ message: "Failed to fetch logic templates" });
    }
  });

  // ============ ADMIN ROUTES ============

  // Super Admin: System Logs
  app.get('/api/admin/system-logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado: apenas administradores" });
      }

      const { category, level, deviceId, limit } = req.query;

      const logs = await storage.getSystemLogs({
        category: category as string,
        level: level as string,
        deviceId: deviceId as string,
        limit: limit ? parseInt(limit as string) : 100
      });

      res.json(logs);
    } catch (error) {
      console.error("Error fetching system logs:", error);
      res.status(500).json({ message: "Failed to fetch system logs" });
    }
  });

  // Admin: Check Evolution API Status
  app.get('/api/admin/evolution-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const status = await whatsappManager.checkEvolutionStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ status: 'ERROR', error: String(error) });
    }
  });

  app.post('/api/admin/promote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { secret } = req.body;

      if (secret !== "admin123") {
        return res.status(403).json({ message: "Invalid secret" });
      }

      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, { isAdmin: true });
        res.json({ message: "User promoted to admin", user: { ...user, isAdmin: true } });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error promoting user:", error);
      res.status(500).json({ message: "Failed to promote user" });
    }
  });

  // Super Admin: List all users
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado: apenas administradores" });
      }

      // Get all users and all devices in parallel (optimized)
      const [allUsers, allDevices] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllDevices()
      ]);

      // Group devices by userId for O(1) lookup
      const devicesByUser = new Map<string, typeof allDevices>();
      for (const device of allDevices) {
        if (!devicesByUser.has(device.userId)) {
          devicesByUser.set(device.userId, []);
        }
        devicesByUser.get(device.userId)!.push(device);
      }

      // Enrich users with device information (no async needed now)
      const usersWithDevices = allUsers.map((u) => {
        const devices = devicesByUser.get(u.id) || [];
        const connectedDevices = devices.filter(d =>
          whatsappManager.getWhatsAppSessionStatus(d.id) === 'READY'
        ).length;

        return {
          ...u,
          deviceCount: devices.length,
          connectedDevices,
        };
      });

      res.json(usersWithDevices);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Super Admin: Global statistics
  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado: apenas administradores" });
      }

      const allUsers = await storage.getAllUsers();
      const allDevices = await storage.getAllDevices();

      const connectedDevices = allDevices.filter(d =>
        whatsappManager.getWhatsAppSessionStatus(d.id) === 'READY'
      ).length;

      const freeUsers = allUsers.filter(u => u.currentPlan === 'free').length;
      const basicUsers = allUsers.filter(u => u.currentPlan === 'basic').length;
      const fullUsers = allUsers.filter(u => u.currentPlan === 'full').length;

      const activeSubscriptions = allUsers.filter(u =>
        u.currentPlan !== 'free' && u.stripeSubscriptionId
      ).length;

      // Calculate messages in last 24h (simplified - would need proper query)
      const messagesLast24h = 0; // TODO: implement proper message counting

      res.json({
        totalUsers: allUsers.length,
        activeSubscriptions,
        freeUsers,
        basicUsers,
        fullUsers,
        totalRevenue: 0, // TODO: calculate from Stripe
        totalDevices: allDevices.length,
        connectedDevices,
        messagesLast24h,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Super Admin: Update user plan
  app.post('/api/admin/users/:userId/update-plan', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);

      if (!admin?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado: apenas administradores" });
      }

      const { userId } = req.params;
      const { plan } = req.body;

      if (!['free', 'basic', 'full'].includes(plan)) {
        return res.status(400).json({ message: "Plano inválido" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Update plan with extended expiry
      const planExpiresAt = plan === 'free'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year for free
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for paid

      await storage.updateUser(userId, {
        currentPlan: plan,
        planExpiresAt,
      });

      res.json({ message: "Plano atualizado com sucesso" });
    } catch (error) {
      console.error("Error updating user plan:", error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  // Super Admin: Delete user
  app.delete('/api/admin/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);

      if (!admin?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado: apenas administradores" });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);

      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (targetUser.isAdmin) {
        return res.status(403).json({ message: "Não é possível deletar outro administrador" });
      }

      // Delete user's devices first
      const devices = await storage.getDevices(userId);
      for (const device of devices) {
        await whatsappManager.destroyWhatsAppSession(device.id);
        await storage.deleteDevice(device.id);
      }

      // Delete user
      await storage.deleteUser(userId);

      res.json({ message: "Usuário deletado com sucesso" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });


  // ============ AUTH ROUTES ============
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Check if free trial has expired
      if (user && !user.isAdmin && user.currentPlan === 'free' && user.planExpiresAt) {
        const now = new Date();
        if (now > new Date(user.planExpiresAt)) {
          // Trial expired - could downgrade or restrict access
          // For now, just return the user as-is
        }
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============ BILLING CONFIG ROUTES ============
  app.get('/api/billing/config', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const config = await storage.getBillingConfig();
      const safeConfig = config || {};

      // Map DB fields to Frontend fields (convert prices to float, features to string)
      const mappedConfig = {
        ...safeConfig,
        // Prices (centavos -> reais)
        basicPrice: (safeConfig.basicPlanPrice ?? 2990) / 100,
        proPrice: (safeConfig.proPlanPrice ?? 6990) / 100,
        enterprisePrice: (safeConfig.enterprisePlanPrice ?? 9990) / 100,

        // Names
        basicName: safeConfig.basicPlanName,
        proName: safeConfig.proPlanName,
        enterpriseName: safeConfig.enterprisePlanName,

        // IDs
        basicPriceId: safeConfig.basicPriceId,
        proPriceId: safeConfig.proPriceId,
        enterprisePriceId: safeConfig.enterprisePriceId,

        // Features (Array -> String with newlines)
        basicFeatures: Array.isArray(safeConfig.basicPlanFeatures) ? safeConfig.basicPlanFeatures.join('\n') : "",
        proFeatures: Array.isArray(safeConfig.proPlanFeatures) ? safeConfig.proPlanFeatures.join('\n') : "",
        enterpriseFeatures: Array.isArray(safeConfig.enterprisePlanFeatures) ? safeConfig.enterprisePlanFeatures.join('\n') : "",
      };

      res.json(mappedConfig);
    } catch (error) {
      console.error("Error fetching billing config:", error);
      res.status(500).json({ error: "Failed to fetch billing config" });
    }
  });

  app.post('/api/billing/config', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const data = req.body;

      // Map Frontend fields to DB fields
      const payload = {
        ...data,
        // Prices (reais -> centavos)
        basicPlanPrice: Math.round((data.basicPrice || 0) * 100),
        proPlanPrice: Math.round((data.proPrice || 0) * 100),
        enterprisePlanPrice: Math.round((data.enterprisePrice || 0) * 100),

        // Names
        basicPlanName: data.basicName,
        proPlanName: data.proName,
        enterprisePlanName: data.enterpriseName,

        // IDs
        basicPriceId: data.basicPriceId,
        proPriceId: data.proPriceId,
        enterprisePriceId: data.enterprisePriceId,

        // Features (String -> Array)
        basicPlanFeatures: typeof data.basicFeatures === 'string' ? data.basicFeatures.split('\n').filter((s: string) => s.trim().length > 0) : [],
        proPlanFeatures: typeof data.proFeatures === 'string' ? data.proFeatures.split('\n').filter((s: string) => s.trim().length > 0) : [],
        enterprisePlanFeatures: typeof data.enterpriseFeatures === 'string' ? data.enterpriseFeatures.split('\n').filter((s: string) => s.trim().length > 0) : [],
      };

      const config = await storage.saveBillingConfig(payload);
      res.json(config);
    } catch (error) {
      console.error("Error saving billing config:", error);
      res.status(500).json({ error: "Failed to save billing config" });
    }
  });

  app.post('/api/billing/test-stripe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { secretKey } = req.body;
      if (!secretKey) {
        return res.status(400).json({ error: "Secret key required" });
      }

      const testStripe = new Stripe(secretKey, { apiVersion: "2025-11-17.clover" });
      const account = await testStripe.accounts.retrieve();

      res.json({ success: true, account });
    } catch (error: any) {
      console.error("Stripe connection test failed:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // ============ PLANS & SUBSCRIPTION ROUTES ============
  app.get('/api/plans', async (_req, res) => {
    try {
      const config = await storage.getBillingConfig();
      const plans = [
        {
          id: 'free',
          name: config?.freePlanName || 'Free Trial',
          price: 0,
          priceId: null,
          features: config?.freePlanFeatures || ['1 Bot WhatsApp', 'Respostas Básicas', 'Suporte da Comunidade'],
          trialDays: config?.trialDays || 7
        },
        {
          id: 'basic',
          name: config?.basicPlanName || 'Básico',
          price: (config?.basicPlanPrice || 2990) / 100, // Converte centavos para reais
          priceId: config?.basicPriceId || null,
          features: config?.basicPlanFeatures || ['Bots Ilimitados', 'Integração AI Básica', 'Suporte por Email'],
          recommended: false
        },
        {
          id: 'full',
          name: config?.fullPlanName || 'Full',
          price: (config?.fullPlanPrice || 5990) / 100, // Converte centavos para reais
          priceId: config?.fullPriceId || null,
          features: config?.fullPlanFeatures || ['Tudo do Básico', 'AI Avançada (GPT-4)', 'Suporte Prioritário', 'API Acesso'],
          recommended: true
        }
      ];

      res.json({
        plans,
        trialDays: config?.trialDays || 7,
        stripeEnabled: config?.stripeEnabled || false,
        pixEnabled: config?.pixEnabled || true,
        pixKey: config?.pixKey || null,
        pixBeneficiary: config?.pixBeneficiary || null,
        pixBank: config?.pixBank || null
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.get('/api/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        plan: user.currentPlan,
        expiresAt: user.planExpiresAt,
        isTrial: user.currentPlan === 'free' && user.planExpiresAt,
        stripeCustomerId: user.stripeCustomerId
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  app.post('/api/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { planId, priceId } = req.body;
      const user = await storage.getUser(userId);
      const config = await storage.getBillingConfig();
      // Fallback to env vars if not in DB
      const stripeKey = config?.stripeSecretKey || process.env.STRIPE_SECRET_KEY;

      if (!stripeKey) {
        return res.status(400).json({ error: "Stripe não configurado. Configure as chaves do Stripe nas configurações de cobrança." });
      }

      const stripeInstance = new Stripe(stripeKey, { apiVersion: "2025-11-17.clover" });

      // Get the price ID from config or use the one passed in request
      let configPriceId = priceId;
      if (!configPriceId) {
        if (planId === 'basic') {
          configPriceId = config.basicPriceId || process.env.STRIPE_PRICE_BASIC;
        } else if (planId === 'full') {
          configPriceId = config.fullPriceId || process.env.STRIPE_PRICE_FULL;
        }
      }

      let session;

      if (configPriceId) {
        // Use the configured Stripe Price ID
        session = await stripeInstance.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{ price: configPriceId, quantity: 1 }],
          mode: 'subscription',
          customer_email: user?.email || undefined,
          success_url: `${req.headers.origin}/billing?success=true`,
          cancel_url: `${req.headers.origin}/billing?canceled=true`,
          metadata: {
            userId,
            planId
          }
        });
      } else {
        // Fallback: create price on the fly (não recomendado para produção)
        const price = planId === 'basic' ? (config.basicPlanPrice || 2990) : (config.fullPlanPrice || 5990);
        const productName = planId === 'basic' ? (config.basicPlanName || "Básico") : (config.fullPlanName || "Full");

        session = await stripeInstance.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'brl',
                product_data: {
                  name: `Plano ${productName}`,
                },
                unit_amount: price,
                recurring: {
                  interval: 'month',
                },
              },
              quantity: 1,
            },
          ],
          mode: 'subscription',
          customer_email: user?.email || undefined,
          success_url: `${req.headers.origin}/billing?success=true`,
          cancel_url: `${req.headers.origin}/billing?canceled=true`,
          metadata: {
            userId,
            planId
          }
        });
      }

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: error.message });

    }
  });

  // ============ ASSISTANT ROUTES ============
  app.post('/api/assistant/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { message, history } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ response: "Erro: API Key do Gemini não configurada no servidor." });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const systemPrompt = `
Você é o "Guru do Sistema", um assistente virtual especializado nesta plataforma SaaS de Chatbots para WhatsApp.
Seu objetivo é ajudar o usuário a configurar e usar o sistema.
Sua persona é amigável, prestativa e um pouco informal (pode usar emojis).

**Conhecimento do Sistema:**
1. **Dispositivos**: Onde se conecta o WhatsApp via QR Code.
2. **Lógicas de Fluxo**: Editor visual (nós e arestas) para criar chatbots automáticos.
3. **Disparo em Massa (Broadcast)**: Enviar mensagens para vários contatos.
4. **Assistentes Web**: Chatbots para sites (embed).
5. **Art Designer**: Criador de imagens via IA.
6. **Billing**: Planos (Básico, Pro, Enterprise) e assinaturas via Stripe/PIX.

**Banco de Dados (Resumo):**
- Tabela 'users': Contém planos, chaves de API e status.
- Tabela 'whatsapp_devices': Sessões do WhatsApp.
- Tabela 'logic_configs': Fluxos salvos.

Se o usuário perguntar "como fazer backup", diga para ir na página /backup.
Se perguntar sobre erros, peça logs ou detalhes.
Mantenha as respostas curtas e objetivas.
`;

      const chat = model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: systemPrompt }],
          },
          {
            role: "model",
            parts: [{ text: "Entendido! Serei o Guru do Sistema. Como posso ajudar? 🧞‍♂️" }],
          },
          ...(history || []).map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
          }))
        ],
      });

      const result = await chat.sendMessage(message);
      const response = result.response.text();
      res.json({ response });

    } catch (error: any) {
      console.error("Guru Error:", error);
      res.status(500).json({ response: "Tive um pequeno problema técnico. 🤕" });
    }
  });

  // ============ BACKUP ROUTES ============
  app.get('/api/backup/download', isAuthenticated, (req: any, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas admins podem fazer backup." });

    const dumpFile = path.join(process.cwd(), `backup-${Date.now()}.sql`);
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL not configured" });

    // Use pg_dump via shell
    exec(`pg_dump "${dbUrl}" > "${dumpFile}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup error: ${error.message}`, stderr);
        return res.status(500).json({ error: "Falha ao gerar backup. Verifique se pg_dump está instalado." });
      }
      res.download(dumpFile, (err) => {
        if (err) console.error("Download error:", err);
        fs.unlink(dumpFile, () => { }); // Cleanup after download
      });
    });
  });

  app.post('/api/backup/restore', isAuthenticated, upload.single('file'), (req: any, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas admins podem restaurar backup." });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL not configured" });

    const filePath = path.join(process.cwd(), `restore-${Date.now()}.sql`);
    fs.writeFileSync(filePath, req.file.buffer);

    // Use psql via shell to restore
    exec(`psql "${dbUrl}" < "${filePath}"`, (error, stdout, stderr) => {
      fs.unlink(filePath, () => { }); // Cleanup

      if (error) {
        console.error(`Restore error: ${error.message}`, stderr);
        return res.status(500).json({ error: "Falha ao restaurar backup. O arquivo pode estar corrompido ou psql não instalado." });
      }
      res.json({ message: "Backup restaurado com sucesso! O sistema foi atualizado." });
    });
  });

  // ============ AI LOGIC GENERATOR (Conversational) ============
  app.post('/api/ai/chat-logic', isAuthenticated, async (req: any, res) => {
    try {
      const { messages, currentJson } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "API Key não configurada" });

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const systemPrompt = `
Você é um Arquiteto de Chatbots Especialista.
Seu objetivo é conversar com o usuário para construir ou melhorar um arquivo JSON de lógica de chatbot.

O JSON tem esta estrutura:
{
  "rules": [
    { "keywords": ["oi", "ola"], "reply": "Olá! Bem vindo." },
    { "keywords": ["preço"], "reply": "O preço é R$ 50." }
  ],
  "fallback_to_ai": true,
  "ai_sys_prompt": "Você é um atendente virtual..."
}

Regras:
1. Analise o pedido do usuário e o JSON atual.
2. Responda COMENTANDO o que você fez ("Adicionei a regra de horários").
3. SEMPRE retorne o JSON COMPLETO e VÁLIDO no final da resposta, dentro de um bloco de código \`\`\`json ... \`\`\`.
4. Se o usuário pedir "bot híbrido" ou "inteligente", ative "fallback_to_ai": true e crie um "ai_sys_prompt" adequado.
5. Seja didático.

JSON Atual:
${JSON.stringify(currentJson || { rules: [] }, null, 2)}
`;

      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Entendido. Aguardando instruções." }] },
          ...messages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }))
        ]
      });

      const result = await chat.sendMessage("Analise e responda.");
      const responseText = result.response.text();

      // Extract JSON from response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
      let newJson = currentJson;
      let replyText = responseText;

      if (jsonMatch) {
        try {
          newJson = JSON.parse(jsonMatch[1]);
          // Remove code block from reply text to keep conversation clean
          replyText = responseText.replace(/```json[\s\S]*?```/g, "").replace(/```[\s\S]*?```/g, "").trim();
        } catch (e) {
          console.error("Failed to parse AI JSON logic", e);
        }
      }

      res.json({ reply: replyText, logicJson: newJson });

    } catch (error: any) {
      console.error("AI Logic Chat Error:", error);
      res.status(500).json({ error: "Erro na IA: " + error.message });
    }
  });
  app.post('/api/auth/complete-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.updateUser(userId, { onboardingCompleted: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // ============ STATS ROUTES ============
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ WHATSAPP DEVICES ROUTES ============
  app.get('/api/devices', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const devices = await storage.getDevices(userId);

      // Attach live status and QR code from whatsappManager (Evolution uses instance name = deviceId)
      const devicesWithStatus = await Promise.all(devices.map(async device => {
        const rawStatus = whatsappManager.getWhatsAppSessionStatus(device.id);
        const qrCode = await whatsappManager.getWhatsAppQRCode(device.id);

        return {
          ...device,
          connectionStatus: device.connectionStatus, // Status is updated via webhook in Evolution
          qrCode: qrCode || device.qrCode
        };
      }));

      res.json(devicesWithStatus);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.post('/api/devices', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Check plan limits
      const existingDevices = await storage.getDevices(userId);
      const maxDevices = user?.isAdmin ? 999 : (user?.currentPlan === 'free' ? 5 : user?.currentPlan === 'basic' ? 10 : 999);

      if (existingDevices.length >= maxDevices) {
        return res.status(403).json({
          message: `Seu plano permite apenas ${maxDevices} dispositivo(s). Faça upgrade para adicionar mais.`
        });
      }

      const data = insertWhatsappDeviceSchema.parse({
        ...req.body,
        userId,
      });

      const device = await storage.createDevice(data);

      // Create real WhatsApp session (runs async, QR will be updated via events)
      whatsappManager.createWhatsAppSession(device.id).catch(error => {
        console.error("Error creating WhatsApp session:", error);
      });

      res.json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating device:", error);
      res.status(500).json({ message: "Failed to create device" });
    }
  });

  app.post('/api/devices/:id/reconnect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.id);

      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this device" });
      }

      // Re-create session in Evolution
      await whatsappManager.destroyWhatsAppSession(device.id);
      await whatsappManager.createWhatsAppSession(device.id);

      res.json({ message: "Recriação da instância iniciada" });
    } catch (error) {
      console.error("Error reconnecting device:", error);
      res.status(500).json({ message: "Failed to reconnect device" });
    }
  });

  app.get('/api/devices/:id/qrcode', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.id);

      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this device" });
      }

      const qrCode = await whatsappManager.getWhatsAppQRCode(req.params.id);
      const status = whatsappManager.getWhatsAppSessionStatus(req.params.id);

      res.json({ qrCode, status });
    } catch (error) {
      console.error("Error getting QR code:", error);
      res.status(500).json({ message: "Failed to get QR code" });
    }
  });

  app.post('/api/devices/:id/clear-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.id);

      if (!device || device.userId !== userId) {
        return res.status(404).json({ message: "Device not found" });
      }

      // Delete instance from Evolution
      await whatsappManager.destroyWhatsAppSession(req.params.id);

      // Update device status in DB
      await storage.updateDevice(req.params.id, {
        connectionStatus: 'disconnected',
        qrCode: null,
      });

      res.json({ message: "Session cleared successfully from Evolution" });
    } catch (error) {
      console.error("Error clearing session:", error);
      res.status(500).json({ message: "Failed to clear session" });
    }
  });

  app.delete('/api/devices/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.id);

      if (!device || device.userId !== userId) {
        return res.status(404).json({ message: "Device not found" });
      }

      // Destroy WhatsApp session
      await whatsappManager.destroyWhatsAppSession(req.params.id);

      await storage.deleteDevice(req.params.id);
      res.json({ message: "Device deleted" });
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({ message: "Failed to delete device" });
    }
  });

  app.post('/api/devices/:id/set-logic', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.id);

      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this device" });
      }

      const { logicId } = req.body;

      // Verify logic ownership if logicId is provided
      if (logicId) {
        const logic = await storage.getLogic(logicId);
        if (!logic || logic.userId !== userId) {
          return res.status(403).json({ message: "Logic not found or not owned by user" });
        }
      }

      const updated = await storage.updateDevice(req.params.id, {
        activeLogicId: logicId || null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error setting logic:", error);
      res.status(500).json({ message: "Failed to set logic" });
    }
  });

  app.post('/api/devices/:id/toggle-pause', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.id);

      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this device" });
      }

      const updated = await storage.updateDevice(req.params.id, {
        isPaused: !device.isPaused,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error toggling pause:", error);
      res.status(500).json({ message: "Failed to toggle pause" });
    }
  });

  app.post('/api/devices/:id/set-webhook', isAuthenticated, async (req: any, res) => {
    try {
      const deviceId = req.params.id;
      const webhookUrl = req.body.url || `https://chatbot.deletrics.site/api/webhooks/evolution`;

      console.log(`[Route] Setting webhook for ${deviceId}: ${webhookUrl}`);
      const result = await whatsappManager.setEvolutionWebhook(deviceId, webhookUrl);
      console.log(`[Route] Webhook set result:`, JSON.stringify(result));

      res.json({ success: true, result });
    } catch (error) {
      console.error("Error setting webhook:", error);
      res.status(500).json({ message: "Failed to set webhook" });
    }
  });

  app.post('/api/devices/:id/contacts-fetch', isAuthenticated, async (req: any, res) => {
    try {
      const deviceId = req.params.id;
      console.log(`[Route] Fetching contacts for ${deviceId}...`);
      const contacts = await whatsappManager.getEvolutionContacts(deviceId);

      // Send raw contacts back for now; could store them later if needed
      res.json({ success: true, count: Array.isArray(contacts) ? contacts.length : 0, contacts });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/devices/:id/toggle-sdr', isAuthenticated, async (req: any, res) => {
    try {
      const { isGlobalSdr } = req.body;
      const updated = await storage.updateDevice(req.params.id, { isGlobalSdr });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle SDR" });
    }
  });

  // ============ CONVERSATIONS ROUTES ============
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const devices = await storage.getDevices(userId);

      // Get conversations from all user's devices
      const allConversations = await Promise.all(
        devices.map(device => storage.getConversations(device.id))
      );

      const conversations = allConversations.flat();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(data);
      res.json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // ============ MESSAGES ROUTES ============
  app.get('/api/conversations/:conversationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const messages = await storage.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/conversations/:conversationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      // 1. Get conversation to find deviceId and contactPhone
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // 2. Verify device ownership and connection
      const device = await storage.getDevice(conversation.deviceId);
      if (!device || device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized device access" });
      }

      if (device.connectionStatus !== 'connected') {
        return res.status(400).json({ message: "Device not connected to WhatsApp" });
      }

      // 3. Save message to DB first (optimistic)
      const data = insertMessageSchema.parse({
        content,
        conversationId,
        direction: 'outgoing',
        isFromBot: false,
        timestamp: new Date(),
      });

      const message = await storage.createMessage(data);

      // 4. Send via WhatsApp (Evolution API)
      try {
        await whatsappManager.sendWhatsAppMessage(
          conversation.deviceId,
          conversation.contactPhone,
          content
        );
      } catch (sendError: any) {
        console.error("Failed to send WhatsApp message via Evolution:", sendError);
        return res.status(500).json({ message: "Failed to send message to WhatsApp network", error: sendError.message });
      }

      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // ============ LOGIC CONFIGS ROUTES ============
  app.get('/api/logics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const logics = await storage.getLogics(userId);
      res.json(logics);
    } catch (error) {
      console.error("Error fetching logics:", error);
      res.status(500).json({ message: "Failed to fetch logics" });
    }
  });

  app.get('/api/logics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const logic = await storage.getLogic(req.params.id);

      if (!logic) {
        return res.status(404).json({ message: "Logic not found" });
      }

      if (logic.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this logic" });
      }

      res.json(logic);
    } catch (error) {
      console.error("Error fetching logic:", error);
      res.status(500).json({ message: "Failed to fetch logic" });
    }
  });

  app.post('/api/logics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Note: plan-based restrictions removed - all users can create AI logics

      const data = insertLogicConfigSchema.parse({
        ...req.body,
        userId,
        logicType: req.body.logicType || 'json',
      });

      const logic = await storage.createLogic(data);
      res.json(logic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating logic:", error);
      res.status(500).json({ message: "Failed to create logic" });
    }
  });

  app.patch('/api/logics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const logic = await storage.getLogic(req.params.id);

      if (!logic) {
        return res.status(404).json({ message: "Logic not found" });
      }

      if (logic.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this logic" });
      }

      // Note: plan-based restrictions removed - all users can use AI logics

      const updated = await storage.updateLogic(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating logic:", error);
      res.status(500).json({ message: "Failed to update logic" });
    }
  });

  app.delete('/api/logics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const logic = await storage.getLogic(req.params.id);

      if (!logic || logic.userId !== userId) {
        return res.status(404).json({ message: "Logic not found" });
      }

      await storage.deleteLogic(req.params.id);
      res.json({ message: "Logic deleted" });
    } catch (error) {
      console.error("Error deleting logic:", error);
      res.status(500).json({ message: "Failed to delete logic" });
    }
  });

  // ============ GEMINI AI ROUTES ============
  app.post('/api/ai/generate-logic', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Allow all authenticated users to use AI generation
      if (!user) {
        return res.status(403).json({
          message: "Usuário não autenticado"
        });
      }

      // Use user's API key if available, otherwise fall back to system key
      const ai = getAI(user.geminiApiKey);
      if (!ai) {
        return res.status(503).json({ message: "Gemini AI not configured - missing API key" });
      }

      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const systemPrompt = `Você é um especialista em criar lógicas de chatbot para WhatsApp.
Sua tarefa é criar um JSON robusto e completo baseado na solicitação do usuário.

Estrutura do JSON:
{
  "rules": [
    {
      "keywords": ["palavra1", "palavra2"],
      "reply": "Resposta do bot"
    }
  ],
  "default_reply": "Mensagem enviada se nenhuma regra for correspondida (opcional)",
  "pause_bot_after_reply": false
}

Diretrizes para uma lógica ROBUSTA:
1. Crie regras abrangentes para saudações (oi, olá, bom dia).
2. Se o usuário pedir um fluxo de vendas, inclua regras para preços, formas de pagamento e entrega.
3. Se for suporte, inclua regras para horário de atendimento e dúvidas comuns.
4. Use emojis para tornar as respostas amigáveis.
5. Sempre inclua variações de keywords (ex: "preço", "valor", "quanto custa").

Responda APENAS com o JSON válido.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
        contents: prompt,
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const generatedJson = JSON.parse(cleanText || "{}");
      res.json({ logicJson: generatedJson });
    } catch (error) {
      console.error("Error generating logic with AI:", error);
      res.status(500).json({ message: "Failed to generate logic" });
    }
  });

  // Save AI-generated logic directly
  app.post('/api/ai/generate-and-save-logic', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(403).json({
          message: "Usuário não autenticado"
        });
      }

      // Use user's API key if available, otherwise fall back to system key
      const ai = getAI(user.geminiApiKey);
      if (!ai) {
        return res.status(503).json({ message: "Gemini AI not configured - missing API key" });
      }

      const { prompt, logicName } = req.body;

      if (!prompt || !logicName) {
        return res.status(400).json({ message: "Prompt and logicName are required" });
      }

      const systemPrompt = `Você é um especialista em criar lógicas de chatbot para WhatsApp.
Sua tarefa é criar um JSON robusto e completo baseado na solicitação do usuário.

Estrutura do JSON:
{
  "rules": [
    {
      "keywords": ["palavra1", "palavra2"],
      "reply": "Resposta do bot"
    }
  ],
  "default_reply": "Mensagem enviada se nenhuma regra for correspondida (opcional)",
  "pause_bot_after_reply": false
}

Diretrizes para uma lógica ROBUSTA:
1. Crie regras abrangentes para saudações (oi, olá, bom dia).
2. Se o usuário pedir um fluxo de vendas, inclua regras para preços, formas de pagamento e entrega.
3. Se for suporte, inclua regras para horário de atendimento e dúvidas comuns.
4. Use emojis para tornar as respostas amigáveis.
5. Sempre inclua variações de keywords (ex: "preço", "valor", "quanto custa").

Responda APENAS com o JSON válido.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
        contents: prompt,
      });

      const generatedJson = JSON.parse(response.text || "{}");

      // Create and save the logic with IA type
      const newLogic = await storage.createLogic({
        userId,
        name: logicName,
        description: `Gerada por IA baseada em: ${prompt.substring(0, 100)}...`,
        logicJson: generatedJson,
        logicType: 'ai',
        isActive: false
      });

      res.json({
        message: "Lógica gerada e salva com sucesso",
        logic: newLogic
      });
    } catch (error) {
      console.error("Error generating and saving logic:", error);
      res.status(500).json({ message: "Failed to generate and save logic" });
    }
  });



  // ============ STRIPE ROUTES ============
  // NOTE: For production, set STRIPE_PRICE_BASIC and STRIPE_PRICE_FULL environment variables
  // These should be the Price IDs from your Stripe Dashboard (e.g., price_1234567890)
  // The system will fall back to inline price creation if not set, but webhooks require real Price IDs
  if (stripe) {
    app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        const { plan } = req.query;

        if (!user?.email) {
          return res.status(400).json({ message: "User email required" });
        }

        // Require Stripe Price IDs from environment variables for production
        const STRIPE_PRICE_BASIC = process.env.STRIPE_PRICE_BASIC;
        const STRIPE_PRICE_FULL = process.env.STRIPE_PRICE_FULL;

        // Warn if Price IDs are not configured (but allow fallback for development)
        if (!STRIPE_PRICE_BASIC || !STRIPE_PRICE_FULL) {
          console.warn('⚠️ WARNING: STRIPE_PRICE_BASIC and STRIPE_PRICE_FULL not configured. Using inline prices (not recommended for production).');
        }

        if (!plan || (plan !== 'basic' && plan !== 'full')) {
          return res.status(400).json({ message: "Invalid plan. Must be 'basic' or 'full'" });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              // If Stripe Price IDs are configured, use them. Otherwise create price inline.
              ...(STRIPE_PRICE_BASIC && plan === 'basic'
                ? { price: STRIPE_PRICE_BASIC, quantity: 1 }
                : STRIPE_PRICE_FULL && plan === 'full'
                  ? { price: STRIPE_PRICE_FULL, quantity: 1 }
                  : {
                    price_data: {
                      currency: 'brl',
                      product_data: {
                        name: `Plano ${plan === 'basic' ? 'Básico' : 'Full'}`,
                        description: `Assinatura mensal ChatBot Host`,
                      },
                      unit_amount: plan === 'basic' ? 2990 : 9900, // R$ 29.90 or R$ 99.00
                      recurring: {
                        interval: 'month',
                      },
                    },
                    quantity: 1,
                  }
              ),
            },
          ],
          mode: 'subscription',
          customer_email: user.email,
          success_url: `${req.protocol}://${req.get('host')}/billing?success=true`,
          cancel_url: `${req.protocol}://${req.get('host')}/billing?canceled=true`,
          metadata: {
            userId,
            plan: plan as string,
          },
        });

        res.json({ url: session.url });
      } catch (error: any) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session" });
      }
    });

    // Stripe webhook to handle successful payments
    app.post("/api/stripe/webhook", async (req: any, res) => {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;

      try {
        if (!sig || !webhookSecret) {
          console.warn("Webhook signature or secret missing");
          // Fallback for development if no secret is set (NOT RECOMMENDED FOR PRODUCTION)
          if (!webhookSecret && process.env.NODE_ENV !== 'production') {
            console.warn("⚠️ Using insecure webhook handling (Development Mode)");
            event = req.body;
          } else {
            return res.status(400).send(`Webhook Error: Missing signature or secret`);
          }
        } else {
          // Secure verification
          event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
        }
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const { userId, plan } = session.metadata || {};

          if (userId && plan) {
            // Update user plan
            const user = await storage.getUser(userId);
            if (user) {
              await storage.upsertUser({
                ...user,
                currentPlan: plan,
                planExpiresAt: null, // Subscription doesn't expire unless cancelled
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
              });
              console.log(`User ${userId} upgraded to plan ${plan}`);
            }
          }
        }

        res.json({ received: true });
      } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(400).send(`Webhook Error: ${error}`);
      }
    });
  }

  // ============ KNOWLEDGE BASE ROUTES ============

  // Get all knowledge base items for user
  app.get('/api/knowledge', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const items = await storage.getKnowledgeBase(userId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  // Get single knowledge base item
  app.get('/api/knowledge/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const item = await storage.getKnowledgeBaseItem(id);

      if (!item) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      if (item.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(item);
    } catch (error) {
      console.error("Error fetching knowledge base item:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base item" });
    }
  });

  // Create knowledge base item
  app.post('/api/knowledge', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { title, content, category, imageUrls, tags } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      const item = await storage.createKnowledgeBase({
        userId,
        title,
        content,
        category,
        imageUrls,
        tags,
        isActive: true,
      });

      res.json(item);
    } catch (error) {
      console.error("Error creating knowledge base item:", error);
      res.status(500).json({ message: "Failed to create knowledge base item" });
    }
  });

  // Scrape URL for knowledge base
  app.post('/api/knowledge/scrape', isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Configure puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();

      // Set user agent to avoid being blocked
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extract title and content
      const data = await page.evaluate(() => {
        const title = document.title;
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(s => s.remove());

        const content = document.body.innerText
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 5000); // Limit content length

        return { title, content };
      });

      await browser.close();

      res.json(data);
    } catch (error) {
      console.error("Error scraping URL:", error);
      res.status(500).json({ message: "Failed to scrape URL. Make sure it is accessible." });
    }
  });

  // Update knowledge base item
  app.patch('/api/knowledge/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const item = await storage.getKnowledgeBaseItem(id);

      if (!item) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      if (item.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateKnowledgeBase(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating knowledge base item:", error);
      res.status(500).json({ message: "Failed to update knowledge base item" });
    }
  });

  // Delete knowledge base item
  app.delete('/api/knowledge/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const item = await storage.getKnowledgeBaseItem(id);

      if (!item) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      if (item.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteKnowledgeBase(id);
      res.json({ message: "Knowledge base item deleted successfully" });
    } catch (error) {
      console.error("Error deleting knowledge base item:", error);
      res.status(500).json({ message: "Failed to delete knowledge base item" });
    }
  });

  // ============ BOT BEHAVIOR CONFIGS ROUTES ============

  // Get all bot behaviors for user
  app.get('/api/bot-behaviors', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const behaviors = await storage.getBotBehaviors(userId);
      const presets = await storage.getPresetBehaviors();
      res.json([...behaviors, ...presets]);
    } catch (error) {
      console.error("Error fetching bot behaviors:", error);
      res.status(500).json({ message: "Failed to fetch bot behaviors" });
    }
  });

  // Get single bot behavior
  app.get('/api/bot-behaviors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const behavior = await storage.getBotBehavior(id);

      if (!behavior) {
        return res.status(404).json({ message: "Bot behavior not found" });
      }

      if (!behavior.isPreset && behavior.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(behavior);
    } catch (error) {
      console.error("Error fetching bot behavior:", error);
      res.status(500).json({ message: "Failed to fetch bot behavior" });
    }
  });

  // Create new logic
  app.post('/api/logics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, description, logicJson, logicType, behaviorConfigId, aiPrompt } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const logic = await storage.createLogic({
        userId,
        name,
        description,
        logicJson: logicJson || {},
        logicType: logicType || 'json',
        behaviorConfigId,
        isActive: true,
        isTemplate: false,
      });

      // Handle Hybrid Logic AI Prompt
      if (logicType === 'hybrid' && aiPrompt) {
        const logicDir = path.join(process.cwd(), 'server', 'data', 'logics', logic.id);
        if (!fs.existsSync(logicDir)) {
          fs.mkdirSync(logicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(logicDir, 'ia-prompt.txt'), aiPrompt, 'utf8');
      }

      res.json(logic);
    } catch (error) {
      console.error("Error creating logic:", error);
      res.status(500).json({ message: "Failed to create logic" });
    }
  });

  // Update logic
  app.patch('/api/logics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { logicJson, aiPrompt } = req.body; // Extract aiPrompt
      const logic = await storage.getLogic(id);

      if (!logic) {
        return res.status(404).json({ message: "Logic not found" });
      }

      if (logic.isTemplate) {
        return res.status(403).json({ message: "Cannot edit template logics" });
      }

      if (logic.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateLogic(id, req.body);

      // Handle Hybrid Logic AI Prompt Update
      if (updated.logicType === 'hybrid' && aiPrompt !== undefined) {
        const logicDir = path.join(process.cwd(), 'server', 'data', 'logics', id);
        if (!fs.existsSync(logicDir)) {
          fs.mkdirSync(logicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(logicDir, 'ia-prompt.txt'), aiPrompt, 'utf8');
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating logic:", error);
      res.status(500).json({ message: "Failed to update logic" });
    }
  });

  // Create bot behavior
  app.post('/api/bot-behaviors', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, tone, personality, responseStyle, customInstructions } = req.body;

      if (!name || !personality) {
        return res.status(400).json({ message: "Name and personality are required" });
      }

      const behavior = await storage.createBotBehavior({
        userId,
        name,
        tone: tone || 'professional',
        personality,
        responseStyle: responseStyle || 'concise',
        customInstructions,
        isActive: true,
        isPreset: false,
      });

      res.json(behavior);
    } catch (error) {
      console.error("Error creating bot behavior:", error);
      res.status(500).json({ message: "Failed to create bot behavior" });
    }
  });

  // Update bot behavior
  app.patch('/api/bot-behaviors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const behavior = await storage.getBotBehavior(id);

      if (!behavior) {
        return res.status(404).json({ message: "Bot behavior not found" });
      }

      if (behavior.isPreset) {
        return res.status(403).json({ message: "Cannot edit preset behaviors" });
      }

      if (behavior.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateBotBehavior(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating bot behavior:", error);
      res.status(500).json({ message: "Failed to update bot behavior" });
    }
  });

  // Delete bot behavior
  app.delete('/api/bot-behaviors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const behavior = await storage.getBotBehavior(id);

      if (!behavior) {
        return res.status(404).json({ message: "Bot behavior not found" });
      }

      if (behavior.isPreset) {
        return res.status(403).json({ message: "Cannot delete preset behaviors" });
      }

      if (behavior.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteBotBehavior(id);
      res.json({ message: "Bot behavior deleted successfully" });
    } catch (error) {
      console.error("Error deleting bot behavior:", error);
      res.status(500).json({ message: "Failed to delete bot behavior" });
    }
  });

  // ============ BROADCAST (MASS MESSAGING) ROUTES ============

  // Get all broadcasts for user
  app.get('/api/broadcasts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const broadcasts = await storage.getBroadcasts(userId);
      res.json(broadcasts);
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
      res.status(500).json({ message: "Failed to fetch broadcasts" });
    }
  });

  // Create new broadcast
  app.post('/api/broadcasts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, deviceId, message, contacts, mediaUrl, mediaType, mediaUrls, mediaTypes, delay } = req.body;

      console.log(`[Broadcast] Creating broadcast. Contacts payload type: ${typeof contacts}, IsArray: ${Array.isArray(contacts)}, Length: ${contacts?.length}`);
      console.log(`[Broadcast] Media: mediaUrls=${mediaUrls?.length || 0}, mediaUrl=${mediaUrl ? 'yes' : 'no'}`);
      if (Array.isArray(contacts) && contacts.length > 0) {
        console.log(`[Broadcast] First contact sample:`, contacts[0]);
      }

      if (!name || !deviceId || !message || !contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify device ownership
      const device = await storage.getDevice(deviceId);
      if (!device || device.userId !== userId) {
        return res.status(403).json({ message: "Device not found or unauthorized" });
      }

      // Filter valid contacts
      // Relax validation slightly to accept numbers without @c.us suffix if they are numeric and long enough
      const validContacts = contacts.filter((c: any) => {
        if (!c || typeof c !== 'string') return false;
        // Clean non-numeric chars for length check
        const clean = c.replace(/\D/g, '');
        return clean.length >= 8;
      });

      console.log(`[Broadcast] Valid contacts found: ${validContacts.length}`);

      if (validContacts.length === 0) {
        return res.status(400).json({ message: "No valid contacts provided" });
      }

      // Create broadcast - support both legacy (mediaUrl) and new (mediaUrls) formats
      const broadcast = await storage.createBroadcast({
        userId,
        deviceId,
        name,
        message,
        mediaUrl: mediaUrl || (mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null),
        mediaType: mediaType || (mediaTypes && mediaTypes.length > 0 ? mediaTypes[0] : null),
        mediaUrls: mediaUrls || (mediaUrl ? [mediaUrl] : null),
        mediaTypes: mediaTypes || (mediaType ? [mediaType] : null),
        delay: delay || 20,
        status: 'pending',
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        totalContacts: validContacts.length,
        sentCount: 0,
        failedCount: 0,
      });

      // Create broadcast contacts
      for (const phone of validContacts) {
        await storage.createBroadcastContact({
          broadcastId: broadcast.id,
          contactName: phone,
          phone: phone, // In updated schema it is 'phone'
          status: 'pending',
        });
      }

      res.json(broadcast);
    } catch (error) {
      console.error("Error creating broadcast:", error);
      res.status(500).json({ message: "Failed to create broadcast" });
    }
  });

  // Start broadcast
  app.post('/api/broadcasts/:id/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const broadcast = await storage.getBroadcast(req.params.id);

      if (!broadcast || broadcast.userId !== userId) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      // Update status to running
      const updated = await storage.updateBroadcast(req.params.id, {
        status: 'running',
        startedAt: new Date(),
      });

      // Start sending messages in background
      processBroadcast(req.params.id);

      res.json(updated);
    } catch (error) {
      console.error("Error starting broadcast:", error);
      res.status(500).json({ message: "Failed to start broadcast" });
    }
  });

  // Pause broadcast
  app.post('/api/broadcasts/:id/pause', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const broadcast = await storage.getBroadcast(req.params.id);

      if (!broadcast || broadcast.userId !== userId) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      const updated = await storage.updateBroadcast(req.params.id, {
        status: 'paused',
      });

      res.json(updated);
    } catch (error) {
      console.error("Error pausing broadcast:", error);
      res.status(500).json({ message: "Failed to pause broadcast" });
    }
  });

  // Delete broadcast
  app.delete('/api/broadcasts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const broadcast = await storage.getBroadcast(req.params.id);

      if (!broadcast || broadcast.userId !== userId) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      if (broadcast.status === 'running') {
        return res.status(400).json({ message: "Cannot delete running broadcast. Pause it first." });
      }

      await storage.deleteBroadcast(req.params.id);
      res.json({ message: "Broadcast deleted" });
    } catch (error) {
      console.error("Error deleting broadcast:", error);
      res.status(500).json({ message: "Failed to delete broadcast" });
    }
  });

  // Get WhatsApp contacts from device
  app.get('/api/whatsapp/contacts/:deviceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.deviceId);

      if (!device || device.userId !== userId) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.connectionStatus !== 'connected') {
        return res.status(400).json({ message: "Device not connected" });
      }

      // Get contacts from WhatsApp
      const includeGroups = req.query.includeGroups === 'true';
      const contacts = await whatsappManager.getWhatsAppContacts(req.params.deviceId, includeGroups);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Sync contacts to conversations
  app.post('/api/whatsapp/sync-contacts/:deviceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const device = await storage.getDevice(req.params.deviceId);

      if (!device || device.userId !== userId) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.connectionStatus !== 'connected') {
        return res.status(400).json({ message: "Device not connected" });
      }

      const success = await whatsappManager.syncContacts(req.params.deviceId);

      if (success) {
        res.json({ message: "Contatos sincronizados com sucesso" });
      } else {
        res.status(500).json({ message: "Falha ao sincronizar contatos" });
      }
    } catch (error) {
      console.error("Error syncing contacts:", error);
      res.status(500).json({ message: "Failed to sync contacts" });
    }
  });

  // Get contact profile pic
  app.get('/api/whatsapp/contacts/:deviceId/:contactId/pic', isAuthenticated, async (req: any, res) => {
    try {
      const { deviceId, contactId } = req.params;
      const picUrl = await whatsappManager.getContactProfilePic(deviceId, contactId);
      res.json({ url: picUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to get profile pic" });
    }
  });

  // Generate message with AI
  app.post('/api/ai/generate-message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      // Use user's API key if available, otherwise fall back to system key
      const ai = getAI(user.geminiApiKey);
      if (!ai) {
        return res.status(503).json({ message: "Gemini AI not configured - missing API key" });
      }

      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const systemPrompt = `Você é um assistente que cria mensagens profissionais para WhatsApp.
Crie uma mensagem curta, clara e atraente baseada no prompt do usuário.
A mensagem deve ser amigável e adequada para envio em massa.
Responda APENAS com a mensagem, sem aspas ou formatação extra.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: systemPrompt,
        },
        contents: prompt,
      });

      const generatedMessage = response.text || "";
      res.json({ message: generatedMessage });
    } catch (error) {
      console.error("Error generating message with AI:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });

  // ============ WEBSOCKET FOR REAL-TIME CHAT ============
  // ============ WEB ASSISTANTS ROUTES ============

  // Management Routes
  app.get('/api/web-assistants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const assistants = await storage.getWebAssistants(userId);
      res.json(assistants);
    } catch (error) {
      console.error("Error fetching web assistants:", error);
      res.status(500).json({ message: "Failed to fetch web assistants" });
    }
  });

  app.post('/api/web-assistants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = insertWebAssistantSchema.parse({
        ...req.body,
        userId,
      });

      // Check slug uniqueness
      const existing = await storage.getWebAssistantBySlug(data.slug);
      if (existing) {
        return res.status(400).json({ message: "Este link (slug) já está em uso. Escolha outro." });
      }

      const assistant = await storage.createWebAssistant(data);
      res.json(assistant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating web assistant:", error);
      res.status(500).json({ message: "Failed to create web assistant" });
    }
  });

  app.patch('/api/web-assistants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const assistant = await storage.getWebAssistant(id);

      if (!assistant || assistant.userId !== userId) {
        return res.status(404).json({ message: "Assistente não encontrado" });
      }

      const updated = await storage.updateWebAssistant(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating web assistant:", error);
      res.status(500).json({ message: "Failed to update web assistant" });
    }
  });

  app.delete('/api/web-assistants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const assistant = await storage.getWebAssistant(id);

      if (!assistant || assistant.userId !== userId) {
        return res.status(404).json({ message: "Assistente não encontrado" });
      }

      await storage.deleteWebAssistant(id);
      res.json({ message: "Assistente removido" });
    } catch (error) {
      console.error("Error deleting web assistant:", error);
      res.status(500).json({ message: "Failed to delete web assistant" });
    }
  });

  // Public Routes
  app.get('/api/public/assistants/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const assistant = await storage.getWebAssistantBySlug(slug);

      if (!assistant || !assistant.isActive) {
        return res.status(404).json({ message: "Assistente não encontrado ou inativo" });
      }

      // Return only public info
      res.json({
        name: assistant.name,
        themeColor: assistant.themeColor,
        slug: assistant.slug
      });
    } catch (error) {
      console.error("Error fetching public assistant:", error);
      res.status(500).json({ message: "Failed to fetch assistant" });
    }
  });

  app.post('/api/public/chat/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const { message } = req.body;

      console.log(`[WebChat] Received message for slug: ${slug}, message: ${message}`);

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const assistant = await storage.getWebAssistantBySlug(slug);
      console.log(`[WebChat] Assistant found:`, assistant ? `ID: ${assistant.id}, Active: ${assistant.isActive}, LogicID: ${assistant.activeLogicId}` : 'NOT FOUND');

      if (!assistant || !assistant.isActive) {
        return res.status(404).json({ message: "Assistente não encontrado" });
      }

      let reply = "";
      let mediaUrl: string | undefined;
      let mediaType: 'image' | 'video' | 'audio' | 'document' | undefined;
      let usedAI = false;

      if (!assistant.activeLogicId) {
        // No logic configured
        console.log(`[WebChat] No logic configured for assistant ${assistant.id}`);
        reply = "Olá! Este assistente ainda não foi configurado. Por favor, configure uma lógica para começar a usar.";
      } else {
        const logic = await storage.getLogic(assistant.activeLogicId);
        console.log(`[WebChat] Logic found:`, logic ? `ID: ${logic.id}, Type: ${logic.logicType}, Active: ${logic.isActive}` : 'NOT FOUND');

        if (!logic || !logic.isActive) {
          reply = "Desculpe, a lógica deste assistente não está disponível no momento.";
        } else {
          // 1. Try JSON Logic first
          console.log(`[WebChat] Executing logic for ${slug}. Type: ${logic.logicType}`);
          const jsonResult = executeLogic(message, logic.logicJson as LogicJson);

          const defaultReply = (logic.logicJson as LogicJson).default_reply || "Desculpe, não entendi sua mensagem.";
          const isDefaultReply = jsonResult.reply === defaultReply;

          // If it's a specific match (not default), use it immediately
          if (!isDefaultReply) {
            console.log(`[WebChat] JSON Logic matched specific rule: ${jsonResult.reply.substring(0, 20)}...`);
            reply = jsonResult.reply;
            mediaUrl = jsonResult.mediaUrl;
            mediaType = jsonResult.mediaType;
          } else {
            console.log(`[WebChat] JSON Logic returned default reply. Will try AI if enabled.`);
          }

          // 2. AI Fallback or Hybrid/AI Logic
          // If no specific reply from JSON (or it's AI/Hybrid type and we got default), try Gemini
          if (!reply && (logic.logicType === 'hybrid' || logic.logicType === 'ai')) {
            const user = await storage.getUser(assistant.userId);

            // Check plan (Basic or Full) - AI requires paid plan usually, but let's be lenient for web chat if configured
            if (user) {
              const ai = await getAI(user.geminiApiKey);
              if (ai) {
                try {
                  // Load system prompt
                  const logicDir = path.join(process.cwd(), 'server', 'data', 'logics', logic.id);
                  let systemInstruction = "Você é um assistente virtual de atendimento via chat web.";

                  if (fs.existsSync(path.join(logicDir, 'ia-prompt.txt'))) {
                    systemInstruction = fs.readFileSync(path.join(logicDir, 'ia-prompt.txt'), 'utf8');
                  }

                  // Append Behavior Personality
                  if (logic.behaviorConfigId) {
                    const behavior = await storage.getBotBehavior(logic.behaviorConfigId);
                    if (behavior) {
                      systemInstruction += `\n\nDIRETRIZES DE PERSONALIDADE:\n`;
                      systemInstruction += `Nome: ${behavior.name}\n`;
                      systemInstruction += `Tom de voz: ${behavior.tone}\n`;
                      systemInstruction += `Personalidade: ${behavior.personality}\n`;
                      systemInstruction += `Instruções extras: ${behavior.customInstructions}\n`;
                    }
                  }

                  // Append JSON Logic Rules as Context (so AI knows the business rules)
                  if (logic.logicJson) {
                    const logicJson = logic.logicJson as LogicJson;
                    systemInstruction += `\n\nREGRAS DE NEGÓCIO E INFORMAÇÕES DO SITE (Use estas informações para responder):\n`;
                    logicJson.rules.forEach(rule => {
                      systemInstruction += `- Tópicos: "${rule.keywords.join(', ')}". Informação: "${rule.reply}"\n`;
                    });
                  }

                  // Append Site Context (Raw Text) if available
                  if (fs.existsSync(path.join(logicDir, 'site-context.txt'))) {
                    const siteContext = fs.readFileSync(path.join(logicDir, 'site-context.txt'), 'utf8');
                    systemInstruction += `\n\nCONTEÚDO COMPLETO DO SITE (Use para responder perguntas não cobertas pelas regras acima):\n${siteContext.slice(0, 15000)}\n`;
                  }

                  // === KNOWLEDGE BASE INTEGRATION ===
                  // Fetch active knowledge base items for this user
                  const knowledgeItems = await storage.getKnowledgeBase(assistant.userId);
                  const activeKnowledge = knowledgeItems.filter(k => k.isActive);

                  if (activeKnowledge.length > 0) {
                    systemInstruction += `\n\nOUTRAS FONTES DE CONHECIMENTO:\n`;
                    activeKnowledge.forEach(item => {
                      systemInstruction += `\n--- ${item.title} ---\n${item.content}\n`;
                    });
                  }
                  // ==================================

                  const aiResponse = await ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    config: { systemInstruction },
                    contents: message,
                  });

                  reply = aiResponse.text || "";
                  usedAI = true;
                } catch (aiError) {
                  console.error("Error generating AI response for web chat:", aiError);
                  // Don't fail completely, just return empty or fallback
                }
              }
            }
          }

          // 3. Final Fallback to JSON default if AI failed/skipped and we have no reply yet
          if (!reply) {
            reply = (logic.logicJson as LogicJson).default_reply || "Desculpe, não entendi sua mensagem.";
          }
        }
      }

      // If still no reply, use a generic fallback
      if (!reply) {
        reply = "Desculpe, não consegui processar sua mensagem no momento.";
      }

      res.json({
        reply,
        mediaUrl,
        mediaType,
        usedAI
      });

    } catch (error) {
      console.error("CRITICAL Error processing web chat message:", error);
      res.status(500).json({
        message: "Failed to process message",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-conversation", (conversationId: string) => {
      socket.join(`conversation-${conversationId}`);
    });

    socket.on("leave-conversation", (conversationId: string) => {
      socket.leave(`conversation-${conversationId}`);
    });

    socket.on("new-message", (data) => {
      // Broadcast to conversation room
      io.to(`conversation-${data.conversationId}`).emit("message-received", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // User profile update endpoint
  app.post('/api/user/update', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName } = req.body;
      const updated = await storage.updateUser(userId, { firstName, lastName });
      res.json(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Test Gemini API key (without saving)
  app.post('/api/user/test-gemini-key', isAuthenticated, async (req: any, res) => {
    try {
      const { geminiApiKey } = req.body;

      if (!geminiApiKey) {
        return res.status(400).json({ message: "Chave API é obrigatória" });
      }

      try {
        const testAi = new GoogleGenAI({ apiKey: geminiApiKey });
        const result = await testAi.models.generateContent({
          model: "gemini-2.0-flash",
          contents: "Responda apenas: OK"
        });
        const text = result.text || "";

        res.json({
          valid: true,
          message: "✓ Chave API válida e funcionando!",
          response: text.substring(0, 50)
        });
      } catch (error: any) {
        let errorMessage = "Chave API inválida";
        if (error.message?.includes('API_KEY_INVALID')) {
          errorMessage = "API Key inválida. Verifique se copiou corretamente.";
        } else if (error.message?.includes('quota')) {
          errorMessage = "API Key válida mas sem cota disponível.";
        }
        res.status(400).json({
          valid: false,
          message: errorMessage
        });
      }
    } catch (error) {
      console.error("Error testing Gemini API key:", error);
      res.status(500).json({ message: "Erro ao testar chave API" });
    }
  });

  // Save user's Gemini API key
  app.post('/api/user/gemini-key', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { geminiApiKey } = req.body;

      // Validate the key by testing it
      if (geminiApiKey) {
        try {
          const testAi = new GoogleGenAI({ apiKey: geminiApiKey });
          await testAi.models.generateContent({
            model: "gemini-2.0-flash",
            contents: "Test"
          });
        } catch (error) {
          return res.status(400).json({
            message: "Chave API inválida. Verifique se a chave está correta."
          });
        }
      }

      const updated = await storage.updateUser(userId, { geminiApiKey });
      res.json({
        message: "Chave API salva com sucesso",
        user: updated
      });
    } catch (error) {
      console.error("Error saving Gemini API key:", error);
      res.status(500).json({ message: "Failed to save API key" });
    }
  });

  async function processBroadcast(id: string) {
    try {
      const broadcast = await storage.getBroadcast(id);
      if (!broadcast || broadcast.status !== 'running') return;

      const contacts = await storage.getBroadcastContacts(id);
      const pendingContacts = contacts.filter(c => c.status === 'pending');

      for (const contact of pendingContacts) {
        // Re-verify status in case it was paused
        const current = await storage.getBroadcast(id);
        if (!current || current.status !== 'running') break;

        try {
          // If we have multiple media, use them, otherwise use legacy single media
          const mediaUrls = broadcast.mediaUrls || (broadcast.mediaUrl ? [broadcast.mediaUrl] : []);
          const mediaTypes = broadcast.mediaTypes || (broadcast.mediaType ? [broadcast.mediaType] : []);

          if (mediaUrls.length > 0) {
            for (let i = 0; i < mediaUrls.length; i++) {
              await whatsappManager.sendMessage(broadcast.deviceId, contact.phone, broadcast.message, mediaUrls[i], mediaTypes[i]);
            }
          } else {
            await whatsappManager.sendMessage(broadcast.deviceId, contact.phone, broadcast.message);
          }

          await storage.updateBroadcastContact(contact.id, { status: 'sent', sentAt: new Date() });
          await storage.updateBroadcast(id, { sentCount: (current.sentCount || 0) + 1 });
        } catch (err) {
          console.error(`Failed to send broadcast to ${contact.phone}:`, err);
          await storage.updateBroadcastContact(contact.id, { status: 'failed', error: String(err) });
          await storage.updateBroadcast(id, { failedCount: (current.failedCount || 0) + 1 });
        }

        // Delay between messages
        const delayMs = (broadcast.delay || 2) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Check if finished
      const finalContacts = await storage.getBroadcastContacts(id);
      if (finalContacts.every(c => c.status !== 'pending')) {
        await storage.updateBroadcast(id, { status: 'completed' });
      }
    } catch (error) {
      console.error("Error in processBroadcast:", error);
    }
  }

  // Basic Scheduler (Check every minute)
  setInterval(async () => {
    try {
      const dbBroadcasts = await db.select().from(broadcasts).where(
        and(
          eq(broadcasts.status, 'pending'),
          lt(broadcasts.scheduledAt, new Date())
        )
      );

      for (const b of dbBroadcasts) {
        await storage.updateBroadcast(b.id, { status: 'running' });
        processBroadcast(b.id).catch(err => console.error("Scheduled broadcast error:", err));
      }
    } catch (err) {
      // Silently fail scheduler errors
    }
  }, 60000);

  // ============ LOGIC TEMPLATES ROUTES ============
  app.get('/api/logics/templates', isAuthenticated, (req, res) => {
    res.json(LOGIC_TEMPLATES);
  });

  // ============ AI LOGIC GENERATION ============
  app.post('/api/ai/generate-logic', isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, sourceType, sourceContent } = req.body;

      const ai = await getAI();
      if (!ai) {
        return res.status(503).json({ message: "AI service not configured" });
      }

      let context = "";
      if (sourceType === 'url' && sourceContent) {
        let browser;
        try {
          console.log(`[AI] Scraping URL: ${sourceContent}`);
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          console.log(`[AI] Navigating to URL...`);
          await page.goto(sourceContent, { waitUntil: 'networkidle2', timeout: 30000 });
          console.log(`[AI] Extracting text content...`);
          context = await page.evaluate(() => document.body.innerText);
          await browser.close();
          context = context.slice(0, 10000); // Limit context size
          console.log(`[AI] Successfully scraped ${context.length} characters from URL`);
        } catch (e: any) {
          console.error("[AI] Scraping error:", e.message);
          if (browser) await browser.close().catch(() => { });
          return res.status(400).json({
            message: `Erro ao acessar o site: ${e.message}. Verifique se a URL está correta e acessível.`
          });
        }
      } else if (sourceType === 'text') {
        context = sourceContent;
      }

      const systemPrompt = `
        You are an expert chatbot logic generator.
        
        CONTEXT FROM WEBSITE:
        ${context ? context.slice(0, 10000) : "No website context provided."}
        
        USER REQUEST: ${prompt}
        
        TASK: Create a JSON chatbot configuration for this specific business.
        
        CRITICAL RULES:
        1. You MUST use the "CONTEXT FROM WEBSITE" above to extract:
           - Real company name
           - Real phone numbers and emails
           - Real product names
           - Real address
        
        2. Do NOT create generic rules. Create specific rules based on the website content.
        
        3. If the website lists products, create a rule for "produtos" listing 3-4 specific items found.
        
        4. If the website has contact info, create a rule for "contato" with the real data.
        
        5. Structure the response as valid JSON matching this interface:
        interface LogicJson {
          default_reply: string;
          pause_bot_after_reply?: boolean;
          rules: {
            keywords: string[];
            reply: string;
            pause_bot_after_reply?: boolean;
            mediaUrl?: string;
            mediaType?: 'image' | 'video' | 'audio' | 'document';
          }[];
        }

        Output ONLY valid JSON.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: systemPrompt,
      });

      const text = result.text || "";

      // Clean up markdown if present
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const logicJson = JSON.parse(jsonStr);

      res.json(logicJson);
    } catch (error) {
      console.error("AI Logic Generation error:", error);
      res.status(500).json({ message: "Failed to generate logic" });
    }
  });

  app.post('/api/ai/edit-logic', isAuthenticated, async (req: any, res) => {
    try {
      const { currentJson, prompt, sourceType, sourceContent, useEmojis } = req.body;
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Use user's API key if available, otherwise fall back to system key
      const ai = await getAI(user?.geminiApiKey);
      if (!ai) {
        return res.status(503).json({ message: "AI service not configured" });
      }

      let context = "";
      if (sourceType === 'url' && sourceContent) {
        let browser;
        try {
          console.log(`[AI Edit] Scraping URL: ${sourceContent}`);
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          await page.goto(sourceContent, { waitUntil: 'networkidle2', timeout: 30000 });
          context = await page.evaluate(() => document.body.innerText);
          await browser.close();
          context = context.slice(0, 10000);
          console.log(`[AI Edit] Successfully scraped ${context.length} characters`);
        } catch (e: any) {
          console.error("[AI Edit] Scraping error:", e.message);
          if (browser) await browser.close().catch(() => { });
          // Continue without context if scraping fails
        }
      } else if (sourceType === 'text') {
        context = sourceContent;
      }

      const systemPrompt = `
        Você é um Arquiteto Sênior de Chatbots (AI Bot Architect).
        Sua missão é garantir que a lógica do chatbot seja PERFEITA, robusta e à prova de falhas.
        
        CONTEXTO ADICIONAL (Site/Texto):
        ${context ? context.slice(0, 10000) : "Nenhum contexto externo fornecido."}
        
        LÓGICA ATUAL DO CHATBOT:
        ${JSON.stringify(currentJson, null, 2)}

        SOLICITAÇÃO DO USUÁRIO (CLIENTE FINAL): ${prompt}
        
        PREFERÊNCIA DE EMOJIS: ${useEmojis ? "Sim, use emojis para tornar as respostas amigáveis." : "Não, mantenha o tone formal sem emojis."}
        
        SUAS DIRETRIZES DE "ARQUITETO SÊNIOR":
        1. **INTERPRETAÇÃO DE INTENÇÃO:** O usuário final pode não saber termos técnicos. Se ele disser "o bot travou", verifique se falta um loop de volta ao menu. Se ele disser "não acha o produto", verifique as keywords.
        2. **CORREÇÃO PROATIVA:** Não faça apenas o que foi pedido. Se você ver um erro óbvio na lógica (ex: um menu sem opção de voltar, ou uma regra sem resposta), CORRIJA-O silenciosamente.
        3. **PRESERVAÇÃO INTELIGENTE:** Nunca apague o trabalho duro do cliente (produtos, textos longos) a menos que seja explicitamente para substituir.
        4. **ENRIQUECIMENTO DE DADOS:** Use o contexto (site) para preencher lacunas. Se o cliente pedir "adicione contato", busque o telefone real no contexto.
        
        INTERFACE OBRIGATÓRIA (JSON):
        interface LogicJson {
          default_reply: string;
          pause_bot_after_reply?: boolean;
          rules: {
            keywords: string[];
            reply: string;
            pause_bot_after_reply?: boolean;
            mediaUrl?: string; // URL da imagem/vídeo se houver
            mediaType?: 'image' | 'video' | 'audio' | 'document';
            set_conversation_state?: string; // Opcional, para fluxos complexos
          }[];
        }

        Responda APENAS com o JSON válido e formatado.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
        contents: "Gere o JSON atualizado.",
      });

      const text = result.text || "";
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const logicJson = JSON.parse(jsonStr);

      res.json({ logicJson }); // Wrap in logicJson object to match frontend expectation
    } catch (error) {
      console.error("AI Logic Edit error:", error);
      res.status(500).json({ message: "Failed to edit logic" });
    }
  });

  app.post('/api/ai/generate-and-save-logic', isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, logicName, sourceType, sourceContent, useEmojis } = req.body;
      const userId = req.user.id;

      const user = await storage.getUser(userId);

      // Use user's API key if available, otherwise fall back to system key
      const ai = await getAI(user?.geminiApiKey);
      if (!ai) return res.status(503).json({ message: "AI service not configured" });

      // 1. Collect context from URL or text
      let context = "";
      if (sourceType === 'url' && sourceContent) {
        let browser;
        try {
          console.log(`[AI Save] Scraping URL: ${sourceContent}`);
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          await page.goto(sourceContent, { waitUntil: 'networkidle2', timeout: 30000 });
          context = await page.evaluate(() => document.body.innerText);
          await browser.close();
          context = context.slice(0, 10000);
          console.log(`[AI Save] Successfully scraped ${context.length} characters`);
        } catch (e: any) {
          console.error("[AI Save] Scraping error:", e.message);
          if (browser) await browser.close().catch(() => { });
          return res.status(400).json({
            message: `Erro ao acessar o site: ${e.message}. Verifique se a URL está correta e acessível.`
          });
        }
      } else if (sourceType === 'text') {
        context = sourceContent;
      }

      // 2. Generate logic with AI
      // 2. Generate logic with AI
      const systemPrompt = `Você é um especialista em criar lógicas de chatbot em JSON para empresas brasileiras.
        
        CONTEXTO DO SITE/TEXTO:
        ${context ? context.slice(0, 10000) : "Nenhum contexto fornecido."}
        
        SOLICITAÇÃO DO USUÁRIO: ${prompt}
        
        PREFERÊNCIA DE EMOJIS: ${useEmojis ? "Sim, use emojis." : "Não, mantenha formal."}
        
        SUA TAREFA: 
        Criar uma configuração completa de chatbot em JSON para este negócio específico.
        
        REGRAS CRÍTICAS:
        1. **USE O CONTEXTO:** Extraia o nome real da empresa, telefones, endereços e listas de produtos do contexto fornecido.
        2. **SEJA ESPECÍFICO:** Não crie regras genéricas. Se o site lista "Pizza de Calabresa", crie uma regra para isso.
        3. **MENU PRINCIPAL:** Crie uma regra para "menu" ou "início" que liste as opções disponíveis de forma clara.
        4. **CONTATO:** Crie sempre uma regra para "contato" ou "falar com atendente".
        
        INTERFACE ESPERADA:
        interface LogicJson {
          default_reply: string;
          pause_bot_after_reply?: boolean;
          rules: {
            keywords: string[];
            reply: string;
            pause_bot_after_reply?: boolean;
            mediaUrl?: string;
            mediaType?: 'image' | 'video' | 'audio' | 'document';
          }[];
        }

        Responda APENAS com o JSON válido.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
        contents: "Gere o JSON completo.",
      });

      const jsonStr = (result.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
      const logicJson = JSON.parse(jsonStr);

      // 3. Save the generated logic
      const newLogic = await storage.createLogic({
        name: logicName,
        description: `Generated by AI from: ${prompt.slice(0, 50)}...`,
        logicJson,
        logicType: 'ai',
        isActive: true,
        userId,
      });

      // 4. Save site context for AI fallback
      if (context) {
        const logicDir = path.join(process.cwd(), 'server', 'data', 'logics', newLogic.id);
        if (!fs.existsSync(logicDir)) {
          fs.mkdirSync(logicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(logicDir, 'site-context.txt'), context);
      }

      res.json(newLogic);
    } catch (error) {
      console.error("Generate and Save error:", error);
      res.status(500).json({ message: "Failed to generate and save logic" });
    }
  });

  // ============ BROADCAST TEMPLATES ROUTES ============

  app.get('/api/broadcast-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const templates = await storage.getBroadcastTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching broadcast templates:", error);
      res.status(500).json({ message: "Failed to fetch broadcast templates" });
    }
  });

  app.post('/api/broadcast-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = insertBroadcastTemplateSchema.parse({
        ...req.body,
        userId,
      });

      const template = await storage.createBroadcastTemplate(data);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating broadcast template:", error);
      res.status(500).json({ message: "Failed to create broadcast template" });
    }
  });

  app.delete('/api/broadcast-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteBroadcastTemplate(req.params.id);
      res.json({ message: "Template deleted" });
    } catch (error) {
      console.error("Error deleting broadcast template:", error);
      res.status(500).json({ message: "Failed to delete broadcast template" });
    }
  });

  // AI Generation for Broadcasts
  app.post('/api/ai/generate-broadcast', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) return res.status(403).json({ message: "User not found" });

      const ai = await getAI(user.geminiApiKey);
      if (!ai) return res.status(503).json({ message: "Gemini AI not configured" });

      const { prompt, context } = req.body;

      if (!prompt) return res.status(400).json({ message: "Prompt is required" });

      const systemPrompt = `Você é um assistente de marketing especializado em criar mensagens para disparos de WhatsApp.
      Crie uma mensagem curta, direta e persuasiva baseada no pedido do usuário.
      Use emojis para tornar a mensagem amigável.
      Se o usuário fornecer um contexto (ex: lista de produtos), use-o.
      Responda APENAS com o texto da mensagem.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: systemPrompt,
        },
        contents: `Contexto: ${context || 'Nenhum'}\n\nPedido: ${prompt}`,
      });

      const text = response.text || "";
      res.json({ message: text.trim() });
    } catch (error) {
      console.error("Error generating broadcast message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });

  // Art Designer Helper API - Improve prompts for image generation
  app.post('/api/ai/art-prompt', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const ai = getAI(user?.geminiApiKey);

      if (!ai) return res.status(503).json({ message: "AI not configured" });

      const { prompt, style } = req.body;

      // Improve the prompt with Gemini
      const systemPrompt = `Você é um engenheiro de prompts para geração de imagens profissionais.
Transforme o pedido do usuário em um prompt altamente detalhado e artístico em INGLÊS.
Foque em: estilo visual, iluminação, composição, cores, qualidade fotográfica.
NÃO inclua texto na imagem a menos que explicitamente solicitado.
Responda APENAS com o prompt melhorado em inglês (max 150 palavras).`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${systemPrompt}\n\nUsuário pediu: ${prompt}${style ? ` no estilo ${style}` : ''}`
      });

      const improvedPrompt = response.text || prompt;

      res.json({
        prompt: improvedPrompt,
        imageUrl: null,
        success: true,
        message: "Prompt melhorado! Cole no DALL-E, Midjourney ou Leonardo.ai"
      });
    } catch (error) {
      console.error("Art prompt error:", error);
      res.status(500).json({ message: "Failed to improve prompt" });
    }
  });


  // Admin Reset Password
  app.post('/api/admin/users/:id/reset-password', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const adminUser = await storage.getUser(adminId);

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Senha deve ter pelo menos 6 caracteres" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updateUser(id, { passwordHash });

      res.json({ message: "Senha atualizada com sucesso" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Erro ao resetar senha" });
    }
  });

  // Admin Toggle Admin Status
  app.patch('/api/admin/users/:userId/toggle-admin', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const adminUser = await storage.getUser(adminId);

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { userId } = req.params;
      const { isAdmin } = req.body;

      await storage.updateUser(userId, { isAdmin });
      res.json({ message: "Permissões atualizadas com sucesso" });
    } catch (error) {
      console.error("Error toggling admin status:", error);
      res.status(500).json({ message: "Erro ao atualizar permissões" });
    }
  });

  /*
  // Rota temporária para promover o usuário atual a admin (DESATIVADA)
  app.post("/api/setup-admin", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // const userId = (req.user as any).id;
    // await storage.updateUser(userId, { isAdmin: true });

    // // Atualizar sessão
    // (req.user as any).isAdmin = true;

    // res.json({ message: "Usuário promovido a admin com sucesso! Recarregue a página." });
    res.status(403).json({ message: "Rota desativada por segurança." });
  });
  */


  // Rota para obter foto de perfil do WhatsApp
  app.get("/api/whatsapp/contacts/:deviceId/:contactId/pic", async (req, res) => {
    const { deviceId, contactId } = req.params;

    try {
      const client = whatsappManager.getClient(deviceId);
      if (!client) {
        return res.status(404).json({ message: "Device not connected" });
      }

      let targetId = contactId;
      if (!targetId.includes('@')) {
        targetId = `${targetId}@c.us`;
      }

      const picUrl = await client.getProfilePicUrl(targetId);

      if (picUrl) {
        res.redirect(picUrl);
      } else {
        res.status(404).send("No profile pic");
      }
    } catch (error) {
      console.error("Error fetching profile pic:", error);
      res.status(500).send("Error fetching profile pic");
    }
  });


  // Rota para envio de mídia (Áudio/Imagem)
  app.post('/api/whatsapp/send-media/:conversationId', isAuthenticated, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      const { conversationId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });

      const client = whatsappManager.getClient(conversation.deviceId);
      if (!client) return res.status(503).json({ message: "WhatsApp not connected" });

      // Create MessageMedia instance
      const media = new whatsappManager.MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);

      // Send to WhatsApp
      await client.sendMessage(conversation.contactPhone, media);

      // Save to DB
      await storage.createMessage({
        conversationId,
        direction: 'outgoing',
        content: `[Áudio Enviado]`,
        isFromBot: false
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending media:", error);
      res.status(500).json({ message: "Failed to send media" });
    }
  });

  // Update device settings
  app.patch('/api/devices/:deviceId/settings', isAuthenticated, async (req: any, res) => {
    try {
      const { deviceId } = req.params;
      const { shouldTranscribe } = req.body;

      await storage.updateDevice(deviceId, { shouldTranscribe });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating device settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // ============ SUPER ADMIN ROUTES ============

  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Calculate device counts for each user
      const usersWithStats = await Promise.all(users.map(async (u) => {
        const devices = await storage.getDevices(u.id);
        return {
          ...u,
          deviceCount: devices.length,
          connectedDevices: devices.filter(d => d.connectionStatus === 'connected').length
        };
      }));
      res.json(usersWithStats);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/admin/stats', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getGlobalStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/admin/system-logs', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const filters: any = {
        category: req.query.category as string,
        level: req.query.level as string,
        deviceId: req.query.deviceId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      };
      if (filters.category === 'all') delete filters.category;
      if (filters.level === 'all') delete filters.level;

      const logs = await storage.getSystemLogs(filters);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Global Config Routes
  app.get('/api/admin/config', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const config = await storage.getBillingConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/admin/config', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const config = await storage.saveBillingConfig(req.body);
      // Reset the global AI instance so it reloads the new key
      aiInstance = null;
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/admin/users/:id/update-plan', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { plan } = req.body;
      const user = await storage.updateUser(req.params.id, { currentPlan: plan });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.patch('/api/admin/users/:id/toggle-admin', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { isAdmin } = req.body;
      const user = await storage.updateUser(req.params.id, { isAdmin });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/admin/users/:id/reset-password', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser(req.params.id, { passwordHash: hashedPassword });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return httpServer;
}
