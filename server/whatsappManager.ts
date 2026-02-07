import { storage } from "./storage";
import { executeLogic, type LogicJson } from "./logicExecutor";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";
import { logSystemEvent } from "./logManager";
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
export { MessageMedia };

// Evolution API Configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8084";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

// Legacy Sessions Storage
const sessions = new Map<string, {
  client: any;
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'READY';
  qr?: string;
}>();

// Initialize Gemini AI lazily
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (aiInstance) return aiInstance;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    aiInstance = new GoogleGenAI({ apiKey: geminiKey });
  }
  return aiInstance;
}

// Helpers for Evolution API
async function evolutionRequest(endpoint: string, method: string = 'GET', body: any = null) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY
  };

  const options: any = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Evolution API error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[Evolution API] Request failed (${endpoint}):`, error);
    throw error;
  }
}

// Unified Create Session
export async function createWhatsAppSession(deviceId: string): Promise<void> {
  const device = await storage.getDevice(deviceId);
  if (!device) throw new Error("Device not found");

  const integrationType = device.integrationType || 'whatsapp-web-js';

  if (integrationType === 'evolution') {
    return createEvolutionSession(deviceId);
  } else {
    return createLegacySession(deviceId);
  }
}

// Evolution Session Logic
async function createEvolutionSession(deviceId: string): Promise<void> {
  console.log(`[Evolution] 🚀 Creating instance for device: ${deviceId}`);
  await logSystemEvent('whatsapp', 'info', `Iniciando instância Evolution...`, null, undefined, deviceId);

  try {
    const device = await storage.getDevice(deviceId);
    if (!device) throw new Error("Device not found");

    await evolutionRequest('/instance/create', 'POST', {
      instanceName: deviceId,
      token: deviceId,
      number: device.phoneNumber || "",
      qrcode: true
    });

    await storage.updateDevice(deviceId, {
      connectionStatus: 'connecting',
      instanceName: deviceId,
      integrationType: 'evolution'
    });
  } catch (error) {
    console.error(`[Evolution] Error creating session:`, error);
    await logSystemEvent('whatsapp', 'error', `Erro ao criar instância: ${(error as Error).message}`, null, undefined, deviceId);
  }
}

// Legacy Session Logic (whatsapp-web.js)
async function createLegacySession(deviceId: string): Promise<void> {
  if (sessions.has(deviceId)) {
    console.log(`[Legacy] Session already exists for device: ${deviceId}`);
    return;
  }

  console.log(`[Legacy] 🚀 Creating session for device: ${deviceId}`);
  await logSystemEvent('whatsapp', 'info', `Iniciando conexão legacy (Puppeteer)...`, null, undefined, deviceId);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: deviceId,
      dataPath: path.join(process.cwd(), ".wwebjs_auth")
    }),
    puppeteer: {
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
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
  });

  sessions.set(deviceId, { client, status: 'CONNECTING' });

  client.on('qr', async (qr) => {
    console.log(`[Legacy] QR Code received for device: ${deviceId}`);
    sessions.get(deviceId)!.status = 'QR_READY';
    sessions.get(deviceId)!.qr = qr;
    await storage.updateDevice(deviceId, { qrCode: qr, connectionStatus: 'qr_ready' });
  });

  client.on('ready', async () => {
    console.log(`[Legacy] Client is ready for device: ${deviceId}`);
    sessions.get(deviceId)!.status = 'READY';
    sessions.get(deviceId)!.qr = undefined;
    const info = client.info;
    await storage.updateDevice(deviceId, {
      connectionStatus: 'connected',
      phoneNumber: info.wid.user,
      qrCode: null
    });
    await logSystemEvent('whatsapp', 'info', 'Conexão legacy estabelecida com sucesso.', null, undefined, deviceId);
  });

  client.on('authenticated', () => {
    console.log(`[Legacy] Authenticated for device: ${deviceId}`);
  });

  client.on('auth_failure', async (msg) => {
    console.error(`[Legacy] Auth failure for device: ${deviceId}:`, msg);
    sessions.get(deviceId)!.status = 'DISCONNECTED';
    await storage.updateDevice(deviceId, { connectionStatus: 'disconnected' });
    await logSystemEvent('whatsapp', 'error', `Falha na autenticação legacy: ${msg}`, null, undefined, deviceId);
  });

  client.on('disconnected', async (reason) => {
    console.log(`[Legacy] Client was logged out for device: ${deviceId}:`, reason);
    sessions.get(deviceId)!.status = 'DISCONNECTED';
    await storage.updateDevice(deviceId, { connectionStatus: 'disconnected' });
    await logSystemEvent('whatsapp', 'warning', `Conexão legacy encerrada: ${reason}`, null, undefined, deviceId);
  });

  client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us')) return;

    const contactNumber = msg.from.split('@')[0];
    const messageBody = msg.body;

    let mediaUrl, mediaType;
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          mediaType = media.mimetype;
          // In legacy we don't have a public URL easily, 
          // but we could save to uploads. For now we just mark it.
        }
      } catch (e) { }
    }

    await saveMessageToDb(deviceId, contactNumber, messageBody, 'incoming', false, mediaUrl, mediaType);
    await processIncomingMessage(deviceId, contactNumber, messageBody);
  });

  try {
    await client.initialize();
  } catch (error) {
    console.error(`[Legacy] Error initializing client:`, error);
    sessions.delete(deviceId);
    await storage.updateDevice(deviceId, { connectionStatus: 'disconnected' });
  }
}

// Unified QR Code retrieval
export async function getWhatsAppQRCode(deviceId: string): Promise<string | null> {
  const device = await storage.getDevice(deviceId);
  if (!device) return null;

  if (device.integrationType === 'evolution') {
    try {
      const data = await evolutionRequest(`/instance/connect/${deviceId}`);
      if (data.base64) {
        await storage.updateDevice(deviceId, { qrCode: data.base64, connectionStatus: 'qr_ready' });
        return data.base64;
      }
      return null;
    } catch (error) {
      return null;
    }
  } else {
    const session = sessions.get(deviceId);
    return session?.qr || null;
  }
}

// Unified Session Destruction
export async function destroyWhatsAppSession(deviceId: string): Promise<boolean> {
  const device = await storage.getDevice(deviceId);
  if (!device) return false;

  if (device.integrationType === 'evolution') {
    try {
      await evolutionRequest(`/instance/delete/${deviceId}`, 'DELETE');
      await storage.updateDevice(deviceId, { connectionStatus: 'disconnected', qrCode: null });
      return true;
    } catch (error) {
      console.error(`[Evolution] Error deleting instance:`, error);
      return false;
    }
  } else {
    const session = sessions.get(deviceId);
    if (session) {
      try {
        await session.client.logout();
        await session.client.destroy();
      } catch (e) { }
      sessions.delete(deviceId);
    }
    await storage.updateDevice(deviceId, { connectionStatus: 'disconnected', qrCode: null });
    return true;
  }
}

// Unified Send Message
export async function sendWhatsAppMessage(
  deviceId: string,
  number: string,
  text: string,
  mediaUrl?: string,
  mediaType?: string,
  mediaUrls?: string[],
  mediaTypes?: string[]
): Promise<boolean> {
  const device = await storage.getDevice(deviceId);
  if (!device) return false;

  const formattedNumber = number.includes('@') ? number : `${number.replace(/\D/g, '')}@c.us`;

  if (device.integrationType === 'evolution') {
    return sendEvolutionMessage(deviceId, formattedNumber, text, mediaUrl, mediaType, mediaUrls, mediaTypes);
  } else {
    return sendLegacyMessage(deviceId, formattedNumber, text, mediaUrl, mediaType, mediaUrls, mediaTypes);
  }
}

// Evolution Send Message implementation
async function sendEvolutionMessage(deviceId: string, number: string, text: string, mediaUrl?: string, mediaType?: string, mediaUrls?: string[], mediaTypes?: string[]): Promise<boolean> {
  try {
    const cleanNumber = number.split('@')[0];
    if (text && !mediaUrl && (!mediaUrls || mediaUrls.length === 0)) {
      await evolutionRequest(`/message/sendText/${deviceId}`, 'POST', {
        number: cleanNumber,
        text: text
      });
    }

    const allUrls = mediaUrl ? [mediaUrl, ...(mediaUrls || [])] : (mediaUrls || []);
    const allTypes = mediaType ? [mediaType, ...(mediaTypes || [])] : (mediaTypes || []);

    for (let i = 0; i < allUrls.length; i++) {
      const url = allUrls[i];
      const type = allTypes[i] || 'image';
      await evolutionRequest(`/message/sendMedia/${deviceId}`, 'POST', {
        number: cleanNumber,
        media: url,
        mediatype: type.includes('video') ? 'video' : type.includes('audio') ? 'audio' : type.includes('document') ? 'document' : 'image',
        caption: i === 0 ? text : ""
      });
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Legacy Send Message implementation
async function sendLegacyMessage(deviceId: string, number: string, text: string, mediaUrl?: string, mediaType?: string, mediaUrls?: string[], mediaTypes?: string[]): Promise<boolean> {
  const session = sessions.get(deviceId);
  if (!session || session.status !== 'READY') return false;

  try {
    if (text && !mediaUrl && (!mediaUrls || mediaUrls.length === 0)) {
      await session.client.sendMessage(number, text);
    }

    const allUrls = mediaUrl ? [mediaUrl, ...(mediaUrls || [])] : (mediaUrls || []);
    for (const url of allUrls) {
      if (url.startsWith('http')) {
        const media = await MessageMedia.fromUrl(url);
        await session.client.sendMessage(number, media, { caption: text });
      }
    }
    return true;
  } catch (error) {
    console.error(`[Legacy] Error sending message:`, error);
    return false;
  }
}


export async function processIncomingMessage(deviceId: string, contactNumber: string, messageBody: string) {
  const device = await storage.getDevice(deviceId);
  if (!device || !device.activeLogicId || device.isPaused) return;

  const logic = await storage.getLogic(device.activeLogicId);
  if (!logic?.isActive || !logic.logicJson) return;

  const result = executeLogic(messageBody, logic.logicJson as LogicJson);

  if (result.reply === "Desculpe, não entendi sua mensagem." && (logic.logicJson as LogicJson).fallback_to_ai) {
    const ai = getAI();
    if (ai) {
      const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
      const aiResult = await model.generateContent(messageBody);
      const aiReply = aiResult.response.text();
      await sendWhatsAppMessage(deviceId, contactNumber, aiReply);
      await saveMessageToDb(deviceId, contactNumber, `[IA] ${aiReply}`, 'outgoing', true);
      return;
    }
  }

  await sendWhatsAppMessage(deviceId, contactNumber, result.reply, result.mediaUrl);
  await saveMessageToDb(deviceId, contactNumber, result.reply, 'outgoing', true);
}

async function saveMessageToDb(deviceId: string, contactNumber: string, content: string, direction: 'incoming' | 'outgoing', isFromBot: boolean = false, mediaUrl?: string, mediaType?: string) {
  try {
    const conversations = await storage.getConversations(deviceId);
    let conversation = conversations.find(c => c.contactPhone === contactNumber);

    if (!conversation) {
      conversation = await storage.createConversation({
        deviceId,
        contactName: contactNumber,
        contactPhone: contactNumber,
        isActive: true,
        unreadCount: 0,
      });
    }

    await storage.createMessage({
      conversationId: conversation.id,
      direction,
      content,
      isFromBot,
      mediaUrl,
      mediaType
    });
  } catch (error) {
    console.error(`[WhatsApp] Error saving message to DB:`, error);
  }
}

// Compatibility exports
export async function startDeviceSession(deviceId: string, userId: string) {
  await createWhatsAppSession(deviceId);
  return { success: true };
}

export async function stopDeviceSession(deviceId: string, userId: string) {
  return { success: await destroyWhatsAppSession(deviceId) };
}

export async function restoreWhatsAppSessions(): Promise<void> {
  const devices = await storage.getAllDevices();
  for (const device of devices) {
    if (device.connectionStatus === 'connected' || device.connectionStatus === 'connecting') {
      if (device.integrationType === 'whatsapp-web-js') {
        await createLegacySession(device.id);
      }
    }
  }
}

// Function to process incoming messages from Webhook
export async function handleEvolutionWebhook(data: any) {
  const event = data.event;
  const instance = data.instance;

  if (event === 'MESSAGES_UPSERT') {
    const message = data.data;
    const deviceId = instance;
    const fromMe = message.key.fromMe;
    const remoteJid = message.key.remoteJid;

    if (fromMe || (remoteJid && remoteJid.includes('@g.us'))) return;

    const contactNumber = remoteJid ? remoteJid.split('@')[0] : "";
    if (!contactNumber) return;

    let messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    // Handle Media/Transcription (Placeholder for future improved media support)
    let mediaUrl, mediaType;
    if (message.message?.imageMessage || message.message?.audioMessage || message.message?.videoMessage) {
      mediaType = message.message?.imageMessage ? 'image/jpeg' : message.message?.audioMessage ? 'audio/mpeg' : 'video/mp4';
    }

    await saveMessageToDb(deviceId, contactNumber, messageBody, 'incoming', false, mediaUrl, mediaType);
    await processIncomingMessage(deviceId, contactNumber, messageBody);

  } else if (event === 'CONNECTION_UPDATE') {
    const status = data.data.status;
    if (status === 'open') {
      await storage.updateDevice(instance, { connectionStatus: 'connected', qrCode: null });
    } else if (status === 'close' || status === 'refused') {
      await storage.updateDevice(instance, { connectionStatus: 'disconnected' });
    }
  } else if (event === 'QRCODE_UPDATED') {
    const qr = data.data.qrcode?.base64;
    if (qr) {
      await storage.updateDevice(instance, { qrCode: qr, connectionStatus: 'qr_ready' });
    }
  }
}

export async function setEvolutionWebhook(deviceId: string, webhookUrl: string) {
  return await evolutionRequest(`/webhook/set/${deviceId}`, 'POST', {
    url: webhookUrl,
    enabled: true,
    webhook_by_events: false,
    events: [
      "MESSAGES_UPSERT",
      "CONNECTION_UPDATE",
      "QRCODE_UPDATED"
    ]
  });
}

export function getWhatsAppSessionStatus(deviceId: string) {
  const device = sessions.get(deviceId); // Check legacy Map first
  if (device) return device.status;
  return "CONNECTED"; // Fallback for Evolution
}

export async function syncContacts(deviceId: string) { return true; }
export async function getWhatsAppContacts(deviceId: string) { return []; }
export async function forceCleanupSession(deviceId: string) { return await destroyWhatsAppSession(deviceId); }
export const sendMessage = sendWhatsAppMessage;
export const saveMessageToDbExport = saveMessageToDb;

export function getClient(deviceId: string) {
  const session = sessions.get(deviceId);
  return session?.client || null;
}

export async function getContactProfilePic(deviceId: string, contactId: string) {
  const device = await storage.getDevice(deviceId);
  if (!device) return null;

  if (device.integrationType === 'evolution') {
    // Evolution API doesn't easily provide profile pics via simple REST call 
    // without more complex setup, stubbing for now to avoid crashes.
    return null;
  }

  const client = getClient(deviceId);
  if (!client) return null;

  try {
    const targetId = contactId.includes('@') ? contactId : `${contactId}@c.us`;
    return await client.getProfilePicUrl(targetId);
  } catch (e) {
    return null;
  }
}

export async function getContactProfilePicUrl(deviceId: string, contactId: string) {
  return getContactProfilePic(deviceId, contactId);
}
