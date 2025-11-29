import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode";
import { storage } from "./storage";
import { executeLogic, type LogicJson } from "./logicExecutor";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI lazily
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (aiInstance) return aiInstance;

  let geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!geminiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match && match[1]) {
          geminiKey = match[1].trim();
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

interface WhatsAppSession {
  client: InstanceType<typeof Client>;
  status: 'INITIALIZING' | 'QR_PENDING' | 'READY' | 'DISCONNECTED' | 'DESTROYING';
  qrCode: string | null;
  deviceId: string;
}

const sessions = new Map<string, WhatsAppSession>();
const pausedChats = new Map<string, string[]>();

async function saveMessageToDb(
  deviceId: string,
  contactNumber: string,
  content: string,
  direction: 'incoming' | 'outgoing',
  isFromBot: boolean = false
) {
  console.log(`[DB Debug] Saving message for device ${deviceId}, contact ${contactNumber}`);
  try {
    // 1. Find or create conversation
    const conversations = await storage.getConversations(deviceId);
    let conversation = conversations.find(c => c.contactPhone === contactNumber);

    if (!conversation) {
      console.log(`[DB Debug] Creating new conversation for ${contactNumber}`);
      conversation = await storage.createConversation({
        deviceId,
        contactName: contactNumber, // Default name to number initially
        contactPhone: contactNumber,
        isActive: true,
        unreadCount: 0,
      });
      console.log(`[DB Debug] Conversation created with ID: ${conversation.id}`);
    } else {
      console.log(`[DB Debug] Found existing conversation ID: ${conversation.id}`);
    }

    // 2. Create message
    await storage.createMessage({
      conversationId: conversation.id,
      direction,
      content,
      isFromBot,
      timestamp: new Date(),
    });
    console.log(`[DB Debug] Message saved successfully`);

  } catch (error) {
    console.error(`[WhatsApp] Error saving message to DB:`, error);
  }
}

export async function createWhatsAppSession(deviceId: string): Promise<void> {
  console.log(`[WhatsApp] Creating session for device: ${deviceId}`);

  // If session already exists and is not disconnected, skip
  if (sessions.has(deviceId)) {
    const existingSession = sessions.get(deviceId)!;
    if (existingSession.status !== 'DISCONNECTED' && existingSession.status !== 'DESTROYING') {
      console.log(`[WhatsApp] Session already exists for device: ${deviceId}`);
      return;
    }
    // Destroy old session before creating new one
    await destroyWhatsAppSession(deviceId);
  }

  const puppeteerConfig: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };

  // Use system Chromium if available
  if (process.env.NODE_ENV === 'production' || process.platform === 'linux') {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (fs.existsSync('/usr/bin/chromium-browser')) {
      puppeteerConfig.executablePath = '/usr/bin/chromium-browser';
    } else if (fs.existsSync('/usr/bin/chromium')) {
      puppeteerConfig.executablePath = '/usr/bin/chromium';
    }
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: deviceId }),
    puppeteer: puppeteerConfig,
    webVersionCache: {
      type: "remote",
      remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
  });

  const session: WhatsAppSession = {
    client,
    status: 'INITIALIZING',
    qrCode: null,
    deviceId
  };

  sessions.set(deviceId, session);
  pausedChats.set(deviceId, []);

  // QR Code event
  client.on('qr', (qr) => {
    console.log(`[WhatsApp] QR Code generated for device: ${deviceId} (Length: ${qr.length})`);
    session.status = 'QR_PENDING';

    qrcode.toDataURL(qr, async (err, url) => {
      if (!err && url) {
        session.qrCode = url;
        await storage.updateDevice(deviceId, { connectionStatus: 'qr_ready', qrCode: url });
      }
    });
  });

  // Ready event
  client.on('ready', async () => {
    console.log(`[WhatsApp] Client ready for device: ${deviceId}`);
    session.status = 'READY';
    session.qrCode = null;
    await storage.updateDevice(deviceId, { connectionStatus: 'connected', qrCode: null, lastConnectedAt: new Date() });
  });

  // Authenticated event
  client.on('authenticated', () => {
    console.log(`[WhatsApp] Client authenticated for device: ${deviceId}`);
  });

  // Disconnected event - IMPORTANTE para reconexão
  client.on('disconnected', async (reason) => {
    if (session.status !== 'DESTROYING') {
      console.warn(`[WhatsApp] Client disconnected for device: ${deviceId}, reason:`, reason);
      session.status = 'DISCONNECTED';
      await storage.updateDevice(deviceId, { connectionStatus: 'disconnected' });

      // Auto-reconnect after 5 seconds
      setTimeout(async () => {
        if (sessions.has(deviceId) && sessions.get(deviceId)!.status === 'DISCONNECTED') {
          console.log(`[WhatsApp] Auto-reconnecting device: ${deviceId}`);
          await destroyWhatsAppSession(deviceId);
          await createWhatsAppSession(deviceId);
        }
      }, 5000);
    }
  });

  // Loading screen event
  client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Loading screen for device ${deviceId}: ${percent}% - ${message}`);
  });

  // Message event
  client.on('message', async (message) => {
    const userNumber = message.from;

    try {
      // Ignore group messages and status
      if (userNumber.endsWith('@g.us') || message.isStatus) {
        return;
      }

      // ANTI-LOOP: Ignore messages from self
      if (message.fromMe) {
        console.log(`[WhatsApp] Ignoring own message from device: ${deviceId}`);
        return;
      }

      // ANTI-LOOP: Ignore messages from other bots
      const otherBotJids: string[] = [];
      for (const [sId, sess] of sessions.entries()) {
        if (sId !== deviceId && sess.status === 'READY' && sess.client.info) {
          otherBotJids.push(sess.client.info.wid._serialized);
        }
      }

      if (otherBotJids.includes(message.from)) {
        console.log(`[WhatsApp] [Anti-Loop] Ignoring message from bot ${message.from}`);
        return;
      }

      console.log(`[WhatsApp] Processing message from ${userNumber}: "${message.body}"`);
      await saveMessageToDb(deviceId, userNumber, message.body, 'incoming');

      // Get device configuration
      const device = await storage.getDevice(deviceId);
      if (!device) {
        console.log(`[WhatsApp] Device ${deviceId} not found in database`);
        return;
      }

      // Check if chat is paused
      const sessionPausedChats = pausedChats.get(deviceId) || [];
      const isPaused = sessionPausedChats.includes(userNumber);
      const userMessageLower = message.body.toLowerCase().trim();
      const unpauseKeywords = ["menu", "ajuda", "inicio", "início", "start", "voltar", "sair", "opcoes", "opções"];

      if (isPaused) {
        if (unpauseKeywords.includes(userMessageLower)) {
          pausedChats.set(deviceId, sessionPausedChats.filter(id => id !== userNumber));
          console.log(`[WhatsApp] Chat ${userNumber} was REACTIVATED by user on device ${deviceId}`);
        } else {
          console.log(`[WhatsApp] Chat ${userNumber} is paused on device ${deviceId}. Ignoring message.`);
          return;
        }
      }

      // Status command
      if (userMessageLower === '/status') {
        const statusMessage = `Bot Conectado!\n\n- *Dispositivo:* ${device.name}\n- *Status WhatsApp:* OK\n- *Servidor:* OK\n- *Gemini AI:* ${getAI() ? "OK" : "ERRO"}`;
        await client.sendMessage(userNumber, statusMessage);
        await saveMessageToDb(deviceId, userNumber, statusMessage, 'outgoing', true);
        console.log(`[WhatsApp] Sent status message to ${userNumber}`);
        return;
      }

      // Execute logic if configured
      if (device.activeLogicId) {
        const logic = await storage.getLogic(device.activeLogicId);

        if (logic && logic.isActive && logic.logicJson) {
          console.log(`[WhatsApp] Executing logic "${logic.name}" (${logic.id}) for device ${deviceId}`);

          const result = executeLogic(message.body, logic.logicJson as LogicJson);
          console.log(`[WhatsApp] Logic result: reply="${result.reply.substring(0, 50)}...", shouldPause=${result.shouldPause}`);

          // Send reply
          if (result.mediaUrl) {
            try {
              const media = await MessageMedia.fromUrl(result.mediaUrl);
              await client.sendMessage(userNumber, media, { caption: result.reply });
              await saveMessageToDb(deviceId, userNumber, `[Media] ${result.reply}`, 'outgoing', true);
              console.log(`[WhatsApp] Sent reply with media to ${userNumber}`);
            } catch (imgError) {
              console.error(`[WhatsApp] Failed to send media, sending text only:`, imgError);
              await client.sendMessage(message.from, result.reply);
              await saveMessageToDb(deviceId, userNumber, result.reply, 'outgoing', true);
            }
          } else {
            await client.sendMessage(message.from, result.reply);
            await saveMessageToDb(deviceId, userNumber, result.reply, 'outgoing', true);
            console.log(`[WhatsApp] Sent text reply to ${userNumber}`);
          }

          // Handle pause
          if (result.shouldPause) {
            const currentPaused = pausedChats.get(deviceId) || [];
            if (!currentPaused.includes(userNumber)) {
              currentPaused.push(userNumber);
              pausedChats.set(deviceId, currentPaused);
              console.log(`[WhatsApp] Chat ${userNumber} was PAUSED by logic on device ${deviceId}`);
            }
          }
        } else {
          console.log(`[WhatsApp] Logic not found or inactive for device ${deviceId}`);
        }
      } else {
        console.log(`[WhatsApp] No active logic configured for device ${deviceId}`);
      }
    } catch (error) {
      console.error(`[WhatsApp] Error handling message for device ${deviceId}:`, error);
    }
  });

  // Initialize client
  try {
    console.log(`[WhatsApp] Client initialized for device: ${deviceId}`);
    await client.initialize();
  } catch (err) {
    console.error(`[WhatsApp] Error initializing client for device ${deviceId}:`, err);
    session.status = 'DISCONNECTED';

    // Try to destroy failed session
    try {
      await client.destroy();
    } catch (destroyErr) {
      console.error(`[WhatsApp] Error destroying failed session:`, destroyErr);
    }
  }
}

export async function destroyWhatsAppSession(deviceId: string): Promise<boolean> {
  const session = sessions.get(deviceId);

  if (!session) {
    console.log(`[WhatsApp] No session found for device: ${deviceId}`);
    return false;
  }

  console.log(`[WhatsApp] Destroying session for device: ${deviceId}`);
  session.status = 'DESTROYING';

  try {
    await session.client.destroy();
    sessions.delete(deviceId);
    pausedChats.delete(deviceId);
    console.log(`[WhatsApp] Session destroyed for device: ${deviceId}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Error destroying session for device ${deviceId}:`, error);
    sessions.delete(deviceId);
    pausedChats.delete(deviceId);
    return false;
  }
}

export function getWhatsAppSessionStatus(deviceId: string): string {
  const session = sessions.get(deviceId);
  return session?.status || 'OFFLINE';
}

export function getWhatsAppQRCode(deviceId: string): string | null {
  const session = sessions.get(deviceId);
  return session?.qrCode || null;
}

export async function sendWhatsAppMessage(
  deviceId: string,
  number: string,
  text: string
): Promise<boolean> {
  const session = sessions.get(deviceId);

  if (!session || session.status !== 'READY') {
    console.log(`[WhatsApp] Cannot send message: device ${deviceId} is not ready`);
    return false;
  }

  try {
    const chatId = `${number.replace(/\D/g, '')}@c.us`;
    await session.client.sendMessage(chatId, text);
    console.log(`[WhatsApp] Message sent to ${chatId} from device ${deviceId}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Error sending message from device ${deviceId}:`, error);
    return false;
  }
}

export async function getWhatsAppContacts(deviceId: string): Promise<any[]> {
  const session = sessions.get(deviceId);

  if (!session || session.status !== 'READY') {
    return [];
  }

  try {
    const chats = await session.client.getChats();
    // Use chat properties directly to avoid getContact() crash
    const contacts = chats
      .filter(chat => !chat.isGroup)
      .map((chat) => {
        try {
          // chat.id._serialized is like "551199999999@c.us"
          // chat.name is the display name
          const number = chat.id.user; // "551199999999"

          return {
            id: chat.id._serialized,
            name: chat.name || number,
            number: number,
            profilePicUrl: null // Skip profile pic to be safe and fast
          };
        } catch (err) {
          return null;
        }
      })
      .filter(c => c !== null);

    return contacts;
  } catch (error) {
    console.error(`[WhatsApp] Error getting contacts:`, error);
    return [];
  }
}

export async function restoreWhatsAppSessions(): Promise<void> {
  console.log('[WhatsApp] Restoring sessions...');

  const devices = await storage.getAllDevices();

  if (devices.length === 0) {
    console.log('[WhatsApp] No devices to restore.');
    return;
  }

  console.log(`[WhatsApp] Found ${devices.length} devices to restore.`);

  for (const device of devices) {
    console.log(`[WhatsApp] Restoring session for device: ${device.id} (${device.name})`);
    await createWhatsAppSession(device.id);
  }

  console.log('[WhatsApp] Session restoration complete.');
}
