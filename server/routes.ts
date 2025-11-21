import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import Stripe from "stripe";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import { insertWhatsappDeviceSchema, insertConversationSchema, insertMessageSchema, insertLogicConfigSchema } from "@shared/schema";
import { z } from "zod";
import * as whatsappManager from "./whatsappManager";
import { processBroadcast } from "./broadcastProcessor";

// Initialize Stripe (only if key is provided)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

// Initialize Gemini AI (only if key is provided)
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // ============ AUTH ROUTES ============
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Check if free trial has expired
      if (user && user.currentPlan === 'free' && user.planExpiresAt) {
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
      res.json(devices);
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
      const maxDevices = user?.currentPlan === 'free' ? 1 : user?.currentPlan === 'basic' ? 2 : 999;
      
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

      const qrCode = whatsappManager.getSessionQRCode(req.params.id);
      const status = whatsappManager.getSessionStatus(req.params.id);
      
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

      if (!ai) {
        return res.status(503).json({ message: "Gemini AI not configured - missing API key" });
      }

      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }
      
      const systemPrompt = `Você é um assistente que gera lógicas JSON para chatbots WhatsApp. 
Crie uma lógica JSON estruturada com:
- "rules": array de regras com "keywords" (array de strings) e "reply" (string)
- "default_reply": mensagem padrão opcional
- "pause_bot_after_reply": booleano opcional

Responda APENAS com JSON válido, sem explicações adicionais.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
        contents: prompt,
      });

      const generatedJson = JSON.parse(response.text || "{}");
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

      if (!ai) {
        return res.status(503).json({ message: "Gemini AI not configured - missing API key" });
      }

      const { prompt, logicName } = req.body;
      
      if (!prompt || !logicName) {
        return res.status(400).json({ message: "Prompt and logicName are required" });
      }
      
      const systemPrompt = `Você é um assistente que gera lógicas JSON para chatbots WhatsApp. 
Crie uma lógica JSON estruturada com:
- "rules": array de regras com "keywords" (array de strings) e "reply" (string)
- "default_reply": mensagem padrão opcional
- "pause_bot_after_reply": booleano opcional

Responda APENAS com JSON válido, sem explicações adicionais.`;

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
          success_url: `${req.protocol}://${req.hostname}/billing?success=true`,
          cancel_url: `${req.protocol}://${req.hostname}/billing?canceled=true`,
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
    app.post("/api/stripe/webhook", async (req, res) => {
      const sig = req.headers['stripe-signature'];
      
      try {
        // TODO: Verify webhook signature
        const event = req.body;

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const { userId, plan } = session.metadata;

          // Update user plan
          const user = await storage.getUser(userId);
          if (user) {
            await storage.upsertUser({
              ...user,
              currentPlan: plan,
              planExpiresAt: null, // Subscription doesn't expire unless cancelled
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
            });
          }
        }

        res.json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error);
        res.status(400).send(`Webhook Error: ${error}`);
      }
    });
  }

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
      const { name, deviceId, message, contacts } = req.body;

      if (!name || !deviceId || !message || !contacts || contacts.length === 0) {
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

  return httpServer;
}
