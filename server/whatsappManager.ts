import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
// @ts-ignore
import qrcode from "qrcode";
import { storage } from "./storage";
import { executeLogic, type LogicJson } from "./logicExecutor";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

interface WhatsAppSession {
  client: InstanceType<typeof Client>;
  status: 'INITIALIZING' | 'QR_PENDING' | 'READY' | 'DISCONNECTED' | 'DESTROYING';
  qrCode: string | null;
  deviceId: string;
}

const sessions = new Map<string, WhatsAppSession>();

export async function createWhatsAppSession(deviceId: string): Promise<void> {
  console.log(`[WhatsApp] Creating session for device: ${deviceId}`);

  if (sessions.has(deviceId)) {
    console.log(`[WhatsApp] Session already exists for device: ${deviceId}`);
    return;
  }

  // Configure puppeteer to use system Chromium on Ubuntu
  const puppeteerConfig: any = {
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
  };

  // Use system Chromium if available (Ubuntu production)
  // User must install: sudo apt install chromium-browser
  if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: deviceId }),
    puppeteer: puppeteerConfig
  });

  const session: WhatsAppSession = {
    client,
    status: 'INITIALIZING',
    qrCode: null,
    deviceId
  };

  sessions.set(deviceId, session);

  client.on('qr', async (qr) => {
    console.log(`[WhatsApp] QR Code generated for device: ${deviceId} (Length: ${qr.length})`);
    session.status = 'QR_PENDING';

    try {
      const qrDataUrl = await qrcode.toDataURL(qr);
      session.qrCode = qrDataUrl;

      // Update device with QR code
      await storage.updateDevice(deviceId, {
        qrCode: qrDataUrl,
        connectionStatus: 'qr_ready'
      });
    } catch (error) {
      console.error(`[WhatsApp] Error generating QR code:`, error);
    }
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Loading screen for device ${deviceId}: ${percent}% - ${message}`);
  });

  client.on('ready', async () => {
    console.log(`[WhatsApp] Client ready for device: ${deviceId}`);
    session.status = 'READY';
    session.qrCode = null;

    // Update device status to connected
    await storage.updateDevice(deviceId, {
      connectionStatus: 'connected',
      qrCode: null
    });
  });

  client.on('authenticated', () => {
    console.log(`[WhatsApp] Client authenticated for device: ${deviceId}`);
  });

  client.on('auth_failure', async (msg) => {
    console.error(`[WhatsApp] Auth failure for device ${deviceId}:`, msg);
    session.status = 'DISCONNECTED';
    await storage.updateDevice(deviceId, {
      connectionStatus: 'disconnected'
    });
  });

  client.on('disconnected', async (reason) => {
    console.log(`[WhatsApp] Client disconnected for device: ${deviceId}. Reason:`, reason);

    if (session.status !== 'DESTROYING') {
      session.status = 'DISCONNECTED';
      await storage.updateDevice(deviceId, {
        connectionStatus: 'disconnected'
      });
    }
  });

  client.on('message', async (message) => {
    // Handle incoming messages
    console.log(`[WhatsApp] Message received on device ${deviceId}:`, message.body);

    // Ignore group messages and status updates
    if (message.from.endsWith('@g.us') || message.isStatus) {
      return;
    }

    // Ignore own messages to prevent loops
    if (message.fromMe) {
      return;
    }

    try {
      // Verify device exists
      const device = await storage.getDevice(deviceId);
      if (!device) {
        console.error(`[WhatsApp] Device ${deviceId} not found in storage`);
        return;
      }

      // Store conversation if it doesn't exist
      const conversations = await storage.getConversations(deviceId);
      const existingConversation = conversations.find(c => c.contactPhone === message.from);

      let conversationId: string;

      if (!existingConversation) {
        const contact = await message.getContact();
        const newConversation = await storage.createConversation({
          deviceId,
          contactName: contact.name || contact.pushname || message.from,
          contactPhone: message.from,
          lastMessageAt: new Date(),
          unreadCount: 1,
          isActive: true
        });
        conversationId = newConversation.id;
      } else {
        conversationId = existingConversation.id;
      }

      // Store the incoming message
      await storage.createMessage({
        conversationId,
        content: message.body,
        direction: 'incoming',
        isFromBot: false,
        timestamp: new Date()
      });

      // Process message with bot logic and respond if needed
      if (device.activeLogicId && !device.isPaused) {
        try {
          const logic = await storage.getLogic(device.activeLogicId);

          if (logic && logic.isActive) {
            let reply = "";
            let shouldPause = false;

            // HYBRID LOGIC: Check for /ia command
            if (logic.logicType === 'hybrid' && message.body.trim().toLowerCase().startsWith('/ia')) {
              if (!ai) {
                reply = "⚠️ Erro: IA não configurada no servidor.";
              } else {
                const userPrompt = message.body.substring(3).trim(); // Remove "/ia "
                if (!userPrompt) {
                  reply = "Por favor, digite algo após o comando /ia. Ex: /ia qual o preço?";
                } else {
                  try {
                    // Load system prompt from file
                    const logicDir = path.join(process.cwd(), 'server', 'data', 'logics', logic.id);
                    let systemInstruction = "Você é um assistente útil.";

                    if (fs.existsSync(path.join(logicDir, 'ia-prompt.txt'))) {
                      systemInstruction = fs.readFileSync(path.join(logicDir, 'ia-prompt.txt'), 'utf8');
                    }

                    const aiResponse = await ai.models.generateContent({
                      model: "gemini-2.0-flash-exp",
                      config: { systemInstruction },
                      contents: userPrompt,
                    });

                    reply = aiResponse.text || "Desculpe, não consegui gerar uma resposta.";
                  } catch (aiError) {
                    console.error("Error generating AI response:", aiError);
                    reply = "Desculpe, ocorreu um erro ao processar sua solicitação com a IA.";
                  }
                }
              }
            } else {
              // STANDARD LOGIC (JSON)
              const result = executeLogic(message.body, logic.logicJson as LogicJson);
              reply = result.reply;
              shouldPause = result.shouldPause;

              // Handle media if present in logic rule
              if (result.mediaUrl) {
                try {
                  const media = await MessageMedia.fromUrl(result.mediaUrl);
                  await message.reply(media);
                } catch (mediaError) {
                  console.error("Error sending media from logic:", mediaError);
                }
              }

              // AUTO-FALLBACK TO AI (Hybrid Mode)
              // If no JSON match found AND logic is hybrid AND user has paid plan
              if (!reply && logic.logicType === 'hybrid') {
                const user = await storage.getUser(device.userId);

                // Check plan (Basic or Full)
                if (user && user.currentPlan !== 'free') {
                  if (!ai) {
                    console.warn("AI not configured for hybrid fallback");
                  } else {
                    try {
                      // Load system prompt from file
                      const logicDir = path.join(process.cwd(), 'server', 'data', 'logics', logic.id);
                      let systemInstruction = "Você é um assistente útil de atendimento via WhatsApp.";

                      if (fs.existsSync(path.join(logicDir, 'ia-prompt.txt'))) {
                        systemInstruction = fs.readFileSync(path.join(logicDir, 'ia-prompt.txt'), 'utf8');
                      }

                      // Append Behavior Personality if selected
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

                      const aiResponse = await ai.models.generateContent({
                        model: "gemini-2.0-flash-exp",
                        config: { systemInstruction },
                        contents: message.body,
                      });

                      reply = aiResponse.text || "";
                    } catch (aiError) {
                      console.error("Error generating AI fallback response:", aiError);
                    }
                  }
                }
              }

            }

            // Send auto-response if there is one (Common for both /ia and Auto-Fallback)
            if (reply) {
              await message.reply(reply);

              // Store bot response
              await storage.createMessage({
                conversationId,
                content: reply,
                direction: 'outgoing',
                isFromBot: true,
                timestamp: new Date()
              });

              // Pause bot if logic says so
              if (shouldPause) {
                await storage.updateDevice(deviceId, {
                  isPaused: true
                });
                console.log(`[WhatsApp] Bot paused for device ${deviceId} after reply`);
              }
            }
          }
        } catch (botError) {
          console.error(`[WhatsApp] Error executing bot logic for device ${deviceId}:`, botError);
        }
      }

    } catch (error) {
      console.error(`[WhatsApp] Error handling message for device ${deviceId}:`, error);
    }
  });

  try {
    await client.initialize();
    console.log(`[WhatsApp] Client initialized for device: ${deviceId}`);
  } catch (error) {
    console.error(`[WhatsApp] Error initializing client for device ${deviceId}:`, error);
    session.status = 'DISCONNECTED';

    // Clean up session and puppeteer resources
    try {
      await client.destroy();
    } catch (destroyError) {
      console.error(`[WhatsApp] Error destroying failed session:`, destroyError);
    }

    sessions.delete(deviceId);

    await storage.updateDevice(deviceId, {
      connectionStatus: 'disconnected', // Changed from 'error' to 'disconnected'
      qrCode: null
    });
  }
}

export async function destroyWhatsAppSession(deviceId: string): Promise<boolean> {
  const session = sessions.get(deviceId);

  if (!session) {
    return false;
  }

  console.log(`[WhatsApp] Destroying session for device: ${deviceId}`);
  session.status = 'DESTROYING';

  try {
    await session.client.destroy();
    sessions.delete(deviceId);

    await storage.updateDevice(deviceId, {
      connectionStatus: 'disconnected',
      qrCode: null
    });

    return true;
  } catch (error) {
    console.error(`[WhatsApp] Error destroying session:`, error);
    return false;
  }
}

export function getSessionStatus(deviceId: string): string {
  const session = sessions.get(deviceId);
  return session ? session.status : 'OFFLINE';
}

export function getSessionQRCode(deviceId: string): string | null {
  const session = sessions.get(deviceId);
  return session ? session.qrCode : null;
}

export async function sendWhatsAppMessage(
  deviceId: string,
  phoneNumber: string,
  message: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'audio' | 'document'
): Promise<boolean> {
  const session = sessions.get(deviceId);

  if (!session || session.status !== 'READY') {
    return false;
  }

  try {
    const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;

    if (mediaUrl) {
      try {
        // Create media object from URL (supports Data URIs too)
        const media = await MessageMedia.fromUrl(mediaUrl);

        // Send media with caption
        await session.client.sendMessage(chatId, media, { caption: message });
        return true;
      } catch (mediaError) {
        console.error(`[WhatsApp] Error creating/sending media:`, mediaError);
        // Fallback to text only if media fails? 
        // Better to fail so we know media didn't go through, or maybe send text with error note?
        // Let's try sending text as fallback but log the error
        console.log(`[WhatsApp] Fallback to text-only message`);
        await session.client.sendMessage(chatId, message);
        return true; // Return true as "message sent" (even if media failed)
      }
    } else {
      await session.client.sendMessage(chatId, message);
      return true;
    }
  } catch (error) {
    console.error(`[WhatsApp] Error sending message:`, error);
    return false;
  }
}

export function getAllSessions(): Array<{ deviceId: string; status: string }> {
  return Array.from(sessions.entries()).map(([deviceId, session]) => ({
    deviceId,
    status: session.status
  }));
}

export async function getWhatsAppContacts(deviceId: string): Promise<any[]> {
  const session = sessions.get(deviceId);

  if (!session || session.status !== 'READY') {
    console.error(`[WhatsApp] Cannot get contacts - session not ready for device: ${deviceId}`);
    return [];
  }

  try {
    const chats = await session.client.getChats();

    const contacts = await Promise.all(
      chats.map(async (chat: any) => {
        const contact = await chat.getContact();
        return {
          id: chat.id._serialized,
          name: contact.name || contact.pushname || chat.name || chat.id.user,
          phone: chat.id._serialized,
          isGroup: chat.isGroup,
        };
      })
    );

    console.log(`[WhatsApp] Found ${contacts.length} contacts for device ${deviceId}`);
    return contacts;
  } catch (error) {
    console.error(`[WhatsApp] Error getting contacts:`, error);
    return [];
  }
}

export async function restoreSessions(): Promise<void> {
  console.log('[WhatsApp] Restoring sessions...');
  try {
    const devices = await storage.getAllDevices();
    console.log(`[WhatsApp] Found ${devices.length} devices to restore.`);

    for (const device of devices) {
      // Only restore if it was previously connected or qr_ready (to keep it alive)
      // Or maybe just restore all to be safe? 
      // Let's restore all so users can reconnect if needed.
      console.log(`[WhatsApp] Restoring session for device: ${device.id} (${device.name})`);
      createWhatsAppSession(device.id).catch(err => {
        console.error(`[WhatsApp] Failed to restore session for device ${device.id}:`, err);
      });
    }
  } catch (error) {
    console.error('[WhatsApp] Error restoring sessions:', error);
  }
}
