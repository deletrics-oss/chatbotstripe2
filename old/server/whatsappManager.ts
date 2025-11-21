import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode";
import { storage } from "./storage";

interface WhatsAppSession {
  client: Client;
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
    console.log(`[WhatsApp] QR Code generated for device: ${deviceId}`);
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

      // Store the message
      await storage.createMessage({
        conversationId,
        content: message.body,
        direction: 'incoming',
        messageType: 'text',
        status: 'delivered',
        timestamp: new Date()
      });

      // TODO: Process message with bot logic and respond if needed
      
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
      connectionStatus: 'error',
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
  message: string
): Promise<boolean> {
  const session = sessions.get(deviceId);
  
  if (!session || session.status !== 'READY') {
    return false;
  }

  try {
    const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
    await session.client.sendMessage(chatId, message);
    return true;
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
