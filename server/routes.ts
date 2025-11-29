import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import Stripe from "stripe";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import { insertWhatsappDeviceSchema, insertConversationSchema, insertMessageSchema, insertLogicConfigSchema, insertWebAssistantSchema } from "@shared/schema";
import { executeLogic, type LogicJson } from "./logicExecutor";
import { z } from "zod";
import * as whatsappManager from "./whatsappManager";
import { processBroadcast } from "./broadcastProcessor";
import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
import { LOGIC_TEMPLATES } from "./templates";

// Initialize Stripe (only if key is provided)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-11-17.clover" })
  : null;

// Initialize Gemini AI (aceita GEMINI_API_KEY ou GOOGLE_API_KEY)
// Initialize Gemini AI lazily
let aiInstance: GoogleGenAI | null = null;
const userAiInstances = new Map<string, GoogleGenAI>();

function getAI(userApiKey?: string | null) {
  // If user provided their own key, use it
  if (userApiKey) {
    // Check if we already have an instance for this key
    if (userAiInstances.has(userApiKey)) {
      return userAiInstances.get(userApiKey)!;
    }

    // Create new instance for this user's key
    const userAi = new GoogleGenAI({ apiKey: userApiKey });
    userAiInstances.set(userApiKey, userAi);
    return userAi;
  }

  // Otherwise, use system key
  if (aiInstance) return aiInstance;

  // Try getting key from process.env
  let geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // Fallback: Try reading .env file directly if key is missing
  if (!geminiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match && match[1]) {
          geminiKey = match[1].trim();
          // Also set it in process.env for future use
          process.env.GEMINI_API_KEY = geminiKey;
          console.log('[Gemini] Loaded API Key from .env file fallback');
        }
      }
    } catch (err) {
      console.error('[Gemini] Failed to read .env file fallback:', err);
    }
  }

  if (geminiKey) {
    aiInstance = new GoogleGenAI({ apiKey: geminiKey });
  } else {
    console.error('[Gemini] API Key not found in environment or .env file');
  }

  return aiInstance;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // ============ ADMIN ROUTES ============
  app.post('/api/admin/promote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // ============ AUTH ROUTES ============
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // ============ STATS ROUTES ============
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const devices = await storage.getDevices(userId);

      // Attach live status and QR code from whatsappManager
      const devicesWithStatus = devices.map(device => {
        const status = whatsappManager.getWhatsAppSessionStatus(device.id);
        const qrCode = whatsappManager.getWhatsAppQRCode(device.id);
        return {
          ...device,
          connectionStatus: status === 'OFFLINE' ? device.connectionStatus : status,
          qrCode: qrCode || device.qrCode
        };
      });

      res.json(devicesWithStatus);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.post('/api/devices', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      // Check plan limits
      const existingDevices = await storage.getDevices(userId);
      const maxDevices = user?.isAdmin ? 999 : (user?.currentPlan === 'free' ? 1 : user?.currentPlan === 'basic' ? 2 : 999);

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
      const userId = req.user.claims.sub;
      const device = await storage.getDevice(req.params.id);

      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      // Security: Verify ownership
      if (device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this device" });
      }

      // Destroy existing session and create new one (runs async, QR will be updated via events)
      await whatsappManager.destroyWhatsAppSession(device.id);
      whatsappManager.createWhatsAppSession(device.id).catch(error => {
        console.error("Error reconnecting WhatsApp session:", error);
      });

      res.json(device);
    } catch (error) {
      console.error("Error reconnecting device:", error);
      res.status(500).json({ message: "Failed to reconnect device" });
    }
  });

  app.get('/api/devices/:id/qrcode', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const device = await storage.getDevice(req.params.id);

      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this device" });
      }

      const qrCode = whatsappManager.getWhatsAppQRCode(req.params.id);
      const status = whatsappManager.getWhatsAppSessionStatus(req.params.id);

      res.json({ qrCode, status });
    } catch (error) {
      console.error("Error getting QR code:", error);
      res.status(500).json({ message: "Failed to get QR code" });
    }
  });

  app.delete('/api/devices/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // ============ CONVERSATIONS ROUTES ============
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const data = insertMessageSchema.parse({
        ...req.body,
        conversationId: req.params.conversationId,
      });

      const message = await storage.createMessage(data);

      // TODO: Send via WhatsApp API
      // TODO: Trigger bot response if configured

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
      const userId = req.user.claims.sub;
      const logics = await storage.getLogics(userId);
      res.json(logics);
    } catch (error) {
      console.error("Error fetching logics:", error);
      res.status(500).json({ message: "Failed to fetch logics" });
    }
  });

  app.get('/api/logics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Free users can only create 1 logic
      if (user.currentPlan === 'free') {
        const existingLogics = await storage.getLogics(userId);
        if (existingLogics.length >= 1) {
          return res.status(403).json({
            message: "Plano Free permite apenas 1 lógica. Faça upgrade para criar mais."
          });
        }
      }

      // Parse and validate data with schema
      const data = insertLogicConfigSchema.parse({
        ...req.body,
        userId,
        // Ensure logicType defaults to 'json' if not provided
        logicType: req.body.logicType || 'json',
      });

      // Enforce plan-based feature flags: Only Full plan can use AI behaviors
      // This check happens AFTER parsing to ensure logicType is always set
      if (data.logicType === 'ai' && user.currentPlan !== 'full') {
        return res.status(403).json({
          message: "Lógicas com IA Gemini disponíveis apenas no plano Full. Faça upgrade para acessar este recurso."
        });
      }

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
      const userId = req.user.claims.sub;
      const logic = await storage.getLogic(req.params.id);

      if (!logic) {
        return res.status(404).json({ message: "Logic not found" });
      }

      if (logic.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this logic" });
      }

      // Determine the final logicType (use new value if provided, otherwise keep existing)
      const finalLogicType = req.body.logicType !== undefined ? req.body.logicType : logic.logicType;

      // Enforce plan-based feature flags: Only Full plan can use AI behaviors
      if (finalLogicType === 'ai') {
        const user = await storage.getUser(userId);
        if (!user || user.currentPlan !== 'full') {
          return res.status(403).json({
            message: "Lógicas com IA Gemini disponíveis apenas no plano Full. Faça upgrade para acessar este recurso."
          });
        }
      }

      const updated = await storage.updateLogic(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating logic:", error);
      res.status(500).json({ message: "Failed to update logic" });
    }
  });

  app.delete('/api/logics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
        model: "gemini-2.0-flash-exp",
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
      const userId = req.user.claims.sub;
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
        model: "gemini-2.0-flash-exp",
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

  // Edit existing logic with AI
  app.post('/api/ai/edit-logic', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      const { currentJson, prompt } = req.body;

      if (!currentJson || !prompt) {
        return res.status(400).json({ message: "Current JSON and prompt are required" });
      }

      const systemPrompt = `Você é um assistente especialista em editar lógicas JSON para chatbots WhatsApp.
Você receberá um JSON existente e uma instrução de alteração.
Sua tarefa é modificar o JSON para atender à instrução, mantendo a estrutura válida.

Estrutura esperada do JSON:
- "rules": array de regras com "keywords" (array de strings) e "reply" (string)
- "default_reply": mensagem padrão opcional
- "pause_bot_after_reply": booleano opcional

JSON Atual:
${JSON.stringify(currentJson, null, 2)}

Instrução de alteração:
${prompt}

Responda APENAS com o JSON modificado válido, sem explicações adicionais.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
        contents: "Modifique o JSON conforme solicitado.",
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const modifiedJson = JSON.parse(cleanText || "{}");

      res.json({ logicJson: modifiedJson });
    } catch (error) {
      console.error("Error editing logic with AI:", error);
      res.status(500).json({ message: "Failed to edit logic" });
    }
  });

  // ============ STRIPE ROUTES ============
  // NOTE: For production, set STRIPE_PRICE_BASIC and STRIPE_PRICE_FULL environment variables
  // These should be the Price IDs from your Stripe Dashboard (e.g., price_1234567890)
  // The system will fall back to inline price creation if not set, but webhooks require real Price IDs
  if (stripe) {
    app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const { name, deviceId, message, contacts, mediaUrl, mediaType } = req.body;

      if (!name || !deviceId || !message || !contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify device ownership
      const device = await storage.getDevice(deviceId);
      if (!device || device.userId !== userId) {
        return res.status(403).json({ message: "Device not found or unauthorized" });
      }

      // Create broadcast
      const broadcast = await storage.createBroadcast({
        userId,
        deviceId,
        name,
        message,
        status: 'pending',
        totalContacts: contacts.length,
        sentCount: 0,
        failedCount: 0,
      });

      // Create broadcast contacts
      for (const phone of contacts) {
        await storage.createBroadcastContact({
          broadcastId: broadcast.id,
          contactName: phone,
          contactPhone: phone,
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const device = await storage.getDevice(req.params.deviceId);

      if (!device || device.userId !== userId) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (device.connectionStatus !== 'connected') {
        return res.status(400).json({ message: "Device not connected" });
      }

      // Get contacts from WhatsApp
      const contacts = await whatsappManager.getWhatsAppContacts(req.params.deviceId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Generate message with AI
  app.post('/api/ai/generate-message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        model: "gemini-2.0-flash-exp",
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
      const userId = req.user.claims.sub;
      const assistants = await storage.getWebAssistants(userId);
      res.json(assistants);
    } catch (error) {
      console.error("Error fetching web assistants:", error);
      res.status(500).json({ message: "Failed to fetch web assistants" });
    }
  });

  app.post('/api/web-assistants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
              const ai = getAI(user.geminiApiKey);
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
                    model: "gemini-2.0-flash-exp",
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
      const userId = req.user.claims.sub;
      const { firstName, lastName } = req.body;
      const updated = await storage.updateUser(userId, { firstName, lastName });
      res.json(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Save user's Gemini API key
  app.post('/api/user/gemini-key', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { geminiApiKey } = req.body;

      // Validate the key by testing it
      if (geminiApiKey) {
        try {
          const testAi = new GoogleGenAI({ apiKey: geminiApiKey });
          await testAi.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: "Test",
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

  // ============ LOGIC TEMPLATES ROUTES ============
  app.get('/api/logics/templates', isAuthenticated, (req, res) => {
    res.json(LOGIC_TEMPLATES);
  });

  // ============ AI LOGIC GENERATION ============
  app.post('/api/ai/generate-logic', isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, sourceType, sourceContent } = req.body;

      const ai = getAI();
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
      const { currentJson, prompt, sourceType, sourceContent } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      // Use user's API key if available, otherwise fall back to system key
      const ai = getAI(user?.geminiApiKey);
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
        You are an expert chatbot logic editor.
        
        CONTEXT FROM WEBSITE:
        ${context ? context.slice(0, 10000) : "No website context provided."}
        
        EXISTING CHATBOT LOGIC:
        ${JSON.stringify(currentJson, null, 2)}

        USER'S MODIFICATION REQUEST: ${prompt}
        
        TASK: Update the JSON chatbot configuration based on the request and context.
        
        CRITICAL RULES:
        1. If website context is provided, you MUST use it to enrich the responses.
           - Update contact info with real data
           - Update product lists with real items
           - Add specific links found in the context
        
        2. Keep existing rules if they are good, but IMPROVE their content with real data.
        
        3. If the user asks to "create a bot for [URL]", treat it as a full rebuild using the website data.
        
        4. Structure the response as valid JSON matching this interface:
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
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const logicJson = JSON.parse(jsonStr);

      res.json(logicJson);
    } catch (error) {
      console.error("AI Logic Edit error:", error);
      res.status(500).json({ message: "Failed to edit logic" });
    }
  });

  app.post('/api/ai/generate-and-save-logic', isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, logicName, sourceType, sourceContent } = req.body;
      const userId = req.user.claims.sub;

      const user = await storage.getUser(userId);

      // Use user's API key if available, otherwise fall back to system key
      const ai = getAI(user?.geminiApiKey);
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

  return httpServer;
}
