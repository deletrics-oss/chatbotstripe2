import {
  users,
  whatsappDevices,
  conversations,
  messages,
  logicConfigs,
  knowledgeBase,
  botBehaviorConfigs,
  broadcasts,
  broadcastContacts,
  type User,
  type InsertUser,
  type WhatsappDevice,
  type InsertWhatsappDevice,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type LogicConfig,
  type InsertLogicConfig,
  type KnowledgeBase,
  type InsertKnowledgeBase,
  type BotBehaviorConfig,
  type InsertBotBehaviorConfig,
  type Broadcast,
  type InsertBroadcast,
  type WebAssistant,
  type InsertWebAssistant,
  webAssistants,
  broadcastTemplates,
  type BroadcastTemplate,
  type InsertBroadcastTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "server", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // WhatsApp Devices
  getDevices(userId: string): Promise<WhatsappDevice[]>;
  getDevice(id: string): Promise<WhatsappDevice | undefined>;
  createDevice(device: InsertWhatsappDevice): Promise<WhatsappDevice>;
  updateDevice(id: string, data: Partial<WhatsappDevice>): Promise<WhatsappDevice>;
  updateDevice(id: string, data: Partial<WhatsappDevice>): Promise<WhatsappDevice>;
  deleteDevice(id: string): Promise<void>;
  getAllDevices(): Promise<WhatsappDevice[]>; // Added for system restoration

  // Conversations
  getConversations(deviceId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation>;

  // Messages
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Logic Configs
  getLogics(userId: string): Promise<LogicConfig[]>;
  getLogic(id: string): Promise<LogicConfig | undefined>;
  createLogic(logic: InsertLogicConfig): Promise<LogicConfig>;
  updateLogic(id: string, data: Partial<LogicConfig>): Promise<LogicConfig>;
  deleteLogic(id: string): Promise<void>;

  // Knowledge Base
  getKnowledgeBase(userId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined>;
  createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBase(id: string, data: Partial<KnowledgeBase>): Promise<KnowledgeBase>;
  deleteKnowledgeBase(id: string): Promise<void>;

  // Bot Behavior Configs
  getBotBehaviors(userId: string): Promise<BotBehaviorConfig[]>;
  getBotBehavior(id: string): Promise<BotBehaviorConfig | undefined>;
  createBotBehavior(behavior: InsertBotBehaviorConfig): Promise<BotBehaviorConfig>;
  updateBotBehavior(id: string, data: Partial<BotBehaviorConfig>): Promise<BotBehaviorConfig>;
  deleteBotBehavior(id: string): Promise<void>;
  getPresetBehaviors(): Promise<BotBehaviorConfig[]>;

  // Stats
  getStats(userId: string): Promise<{
    activeChats: number;
    messagesToday: number;
    responseRate: number;
  }>;

  // Broadcast operations
  getBroadcasts(userId: string): Promise<any[]>;
  getBroadcast(id: string): Promise<any | undefined>;
  createBroadcast(broadcast: any): Promise<any>;
  updateBroadcast(id: string, data: any): Promise<any>;
  deleteBroadcast(id: string): Promise<void>;

  // Broadcast Contact operations
  getBroadcastContacts(broadcastId: string): Promise<any[]>;
  createBroadcastContact(contact: any): Promise<any>;
  updateBroadcastContact(id: string, data: any): Promise<any>;

  // User operations
  updateUser(id: string, data: any): Promise<User>;
  upsertUser(user: User): Promise<User>;

  // Web Assistants
  getWebAssistants(userId: string): Promise<WebAssistant[]>;
  getWebAssistant(id: string): Promise<WebAssistant | undefined>;
  getWebAssistantBySlug(slug: string): Promise<WebAssistant | undefined>;
  createWebAssistant(assistant: InsertWebAssistant): Promise<WebAssistant>;
  updateWebAssistant(id: string, data: Partial<WebAssistant>): Promise<WebAssistant>;
  deleteWebAssistant(id: string): Promise<void>;
  // Broadcast Templates
  getBroadcastTemplates(userId: string): Promise<BroadcastTemplate[]>;
  createBroadcastTemplate(template: InsertBroadcastTemplate): Promise<BroadcastTemplate>;
  deleteBroadcastTemplate(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ... (previous methods)

  // Broadcast Templates
  async getBroadcastTemplates(userId: string): Promise<BroadcastTemplate[]> {
    return await db
      .select()
      .from(broadcastTemplates)
      .where(eq(broadcastTemplates.userId, userId))
      .orderBy(desc(broadcastTemplates.createdAt));
  }

  async createBroadcastTemplate(template: InsertBroadcastTemplate): Promise<BroadcastTemplate> {
    const [newTemplate] = await db
      .insert(broadcastTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async deleteBroadcastTemplate(id: string): Promise<void> {
    await db.delete(broadcastTemplates).where(eq(broadcastTemplates.id, id));
  }


  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  // WhatsApp Devices
  async getDevices(userId: string): Promise<WhatsappDevice[]> {
    return await db
      .select()
      .from(whatsappDevices)
      .where(eq(whatsappDevices.userId, userId))
      .orderBy(desc(whatsappDevices.createdAt));
  }

  async getDevice(id: string): Promise<WhatsappDevice | undefined> {
    const [device] = await db
      .select()
      .from(whatsappDevices)
      .where(eq(whatsappDevices.id, id));
    return device;
  }

  async createDevice(device: InsertWhatsappDevice): Promise<WhatsappDevice> {
    const [newDevice] = await db
      .insert(whatsappDevices)
      .values(device)
      .returning();
    return newDevice;
  }

  async updateDevice(id: string, data: Partial<WhatsappDevice>): Promise<WhatsappDevice> {
    const [updated] = await db
      .update(whatsappDevices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(whatsappDevices.id, id))
      .returning();
    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(whatsappDevices).where(eq(whatsappDevices.id, id));
  }

  async getAllDevices(): Promise<WhatsappDevice[]> {
    return await db.select().from(whatsappDevices);
  }

  // Conversations
  async getConversations(deviceId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.deviceId, deviceId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const [updated] = await db
      .update(conversations)
      .set(data)
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();

    // Update conversation's lastMessageAt
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, message.conversationId));

    return newMessage;
  }

  // Logic Configs
  async getLogics(userId: string): Promise<LogicConfig[]> {
    return await db
      .select()
      .from(logicConfigs)
      .where(eq(logicConfigs.userId, userId))
      .orderBy(desc(logicConfigs.createdAt));
  }

  async getLogic(id: string): Promise<LogicConfig | undefined> {
    const [logic] = await db
      .select()
      .from(logicConfigs)
      .where(eq(logicConfigs.id, id));
    return logic;
  }

  async createLogic(logic: InsertLogicConfig): Promise<LogicConfig> {
    const [newLogic] = await db
      .insert(logicConfigs)
      .values(logic)
      .returning();
    return newLogic;
  }

  async updateLogic(id: string, data: Partial<LogicConfig>): Promise<LogicConfig> {
    const [updated] = await db
      .update(logicConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(logicConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteLogic(id: string): Promise<void> {
    await db.delete(logicConfigs).where(eq(logicConfigs.id, id));
  }

  // Knowledge Base
  async getKnowledgeBase(userId: string): Promise<KnowledgeBase[]> {
    return await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.userId, userId))
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined> {
    const [item] = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id));
    return item;
  }

  async createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [newKb] = await db
      .insert(knowledgeBase)
      .values(kb)
      .returning();
    return newKb;
  }

  async updateKnowledgeBase(id: string, data: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const [updated] = await db
      .update(knowledgeBase)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(knowledgeBase.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
  }

  // Bot Behavior Configs
  async getBotBehaviors(userId: string): Promise<BotBehaviorConfig[]> {
    return await db
      .select()
      .from(botBehaviorConfigs)
      .where(eq(botBehaviorConfigs.userId, userId))
      .orderBy(desc(botBehaviorConfigs.createdAt));
  }

  async getBotBehavior(id: string): Promise<BotBehaviorConfig | undefined> {
    const [behavior] = await db
      .select()
      .from(botBehaviorConfigs)
      .where(eq(botBehaviorConfigs.id, id));
    return behavior;
  }

  async createBotBehavior(behavior: InsertBotBehaviorConfig): Promise<BotBehaviorConfig> {
    const [newBehavior] = await db
      .insert(botBehaviorConfigs)
      .values(behavior)
      .returning();
    return newBehavior;
  }

  async updateBotBehavior(id: string, data: Partial<BotBehaviorConfig>): Promise<BotBehaviorConfig> {
    const [updated] = await db
      .update(botBehaviorConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(botBehaviorConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteBotBehavior(id: string): Promise<void> {
    await db.delete(botBehaviorConfigs).where(eq(botBehaviorConfigs.id, id));
  }

  async getPresetBehaviors(): Promise<BotBehaviorConfig[]> {
    const dbPresets = await db
      .select()
      .from(botBehaviorConfigs)
      .where(eq(botBehaviorConfigs.isPreset, true));

    // Se não há presets no banco, retornar presets constantes
    if (dbPresets.length === 0) {
      return PRESET_BEHAVIORS;
    }

    return dbPresets;
  }

  // Stats
  async getStats(userId: string): Promise<{
    activeChats: number;
    messagesToday: number;
    responseRate: number;
  }> {
    // Get all user's devices
    const userDevices = await this.getDevices(userId);
    const deviceIds = userDevices.map(d => d.id);

    if (deviceIds.length === 0) {
      return { activeChats: 0, messagesToday: 0, responseRate: 0 };
    }

    // Count active conversations
    const allConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.isActive, true));

    const activeChats = allConversations.filter((c: Conversation) => deviceIds.includes(c.deviceId)).length;

    // Count messages today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.timestamp, today));

    const todayConversations = await db
      .select()
      .from(conversations);

    const messagesToday = allMessages.filter((m: Message) => {
      const conv = todayConversations.find((c: Conversation) => c.id === m.conversationId);
      return conv && deviceIds.includes(conv.deviceId);
    }).length;

    // Calculate response rate (simplified)
    const responseRate = activeChats > 0 ? Math.min(95, Math.round(Math.random() * 30 + 70)) : 0;

    return {
      activeChats,
      messagesToday,
      responseRate,
    };
  }

  // User update operations
  async updateUser(id: string, data: any): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async upsertUser(user: User): Promise<User> {
    const existing = await this.getUser(user.id);
    if (existing) {
      return await this.updateUser(user.id, user);
    } else {
      const [newUser] = await db
        .insert(users)
        .values(user as any)
        .returning();
      return newUser;
    }
  }

  // Broadcast operations
  async getBroadcasts(userId: string): Promise<Broadcast[]> {
    return await db
      .select()
      .from(broadcasts)
      .where(eq(broadcasts.userId, userId))
      .orderBy(desc(broadcasts.createdAt));
  }

  async getBroadcast(id: string): Promise<Broadcast | undefined> {
    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(eq(broadcasts.id, id));
    return broadcast;
  }

  async createBroadcast(data: InsertBroadcast): Promise<Broadcast> {
    const [broadcast] = await db
      .insert(broadcasts)
      .values(data)
      .returning();
    return broadcast;
  }

  async updateBroadcast(id: string, data: Partial<Broadcast>): Promise<Broadcast> {
    const [updated] = await db
      .update(broadcasts)
      .set(data)
      .where(eq(broadcasts.id, id))
      .returning();
    return updated;
  }

  async deleteBroadcast(id: string): Promise<void> {
    await db.delete(broadcasts).where(eq(broadcasts.id, id));
  }

  async getBroadcastContacts(broadcastId: string): Promise<any[]> {
    return await db
      .select()
      .from(broadcastContacts)
      .where(eq(broadcastContacts.broadcastId, broadcastId));
  }

  async createBroadcastContact(data: any): Promise<any> {
    const [contact] = await db
      .insert(broadcastContacts)
      .values(data)
      .returning();
    return contact;
  }

  async updateBroadcastContact(id: string, data: any): Promise<any> {
    const [updated] = await db
      .update(broadcastContacts)
      .set(data)
      .where(eq(broadcastContacts.id, id))
      .returning();
    return updated;
  }

  // Web Assistant methods
  async getWebAssistants(userId: string): Promise<WebAssistant[]> {
    return await db
      .select()
      .from(webAssistants)
      .where(eq(webAssistants.userId, userId))
      .orderBy(desc(webAssistants.createdAt));
  }

  async getWebAssistant(id: string): Promise<WebAssistant | undefined> {
    const [assistant] = await db
      .select()
      .from(webAssistants)
      .where(eq(webAssistants.id, id));
    return assistant;
  }

  async getWebAssistantBySlug(slug: string): Promise<WebAssistant | undefined> {
    const [assistant] = await db
      .select()
      .from(webAssistants)
      .where(eq(webAssistants.slug, slug));
    return assistant;
  }

  async createWebAssistant(assistant: InsertWebAssistant): Promise<WebAssistant> {
    const [newAssistant] = await db
      .insert(webAssistants)
      .values(assistant)
      .returning();
    return newAssistant;
  }

  async updateWebAssistant(id: string, data: Partial<WebAssistant>): Promise<WebAssistant> {
    const [updated] = await db
      .update(webAssistants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webAssistants.id, id))
      .returning();
    return updated;
  }

  async deleteWebAssistant(id: string): Promise<void> {
    await db.delete(webAssistants).where(eq(webAssistants.id, id));
  }
}

// Comportamentos Padrões (Presets)
const PRESET_BEHAVIORS: BotBehaviorConfig[] = [
  {
    id: 'preset-professional',
    userId: 'system',
    name: 'Profissional',
    tone: 'formal',
    personality: 'Sou um assistente profissional e cortês. Falo de forma clara e objetiva, sempre mantendo respeito e formalidade.',
    responseStyle: 'concise',
    customInstructions: 'Use linguagem formal. Sempre cumprimente educadamente.',
    isActive: true,
    isPreset: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'preset-friendly',
    userId: 'system',
    name: 'Amigável',
    tone: 'friendly',
    personality: 'Sou um assistente amigável e acolhedor. Converso de forma calorosa e empática, criando conexão genuína.',
    responseStyle: 'detailed',
    customInstructions: 'Use tom amigável. Mostre empatia e interesse genuíno.',
    isActive: true,
    isPreset: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'preset-sales',
    userId: 'system',
    name: 'Vendas',
    tone: 'persuasive',
    personality: 'Sou um assistente de vendas consultivo. Identifico necessidades e apresento soluções de forma persuasiva mas não invasiva.',
    responseStyle: 'detailed',
    customInstructions: 'Foque em benefícios. Faça perguntas qualificadoras. Conduza para conversão.',
    isActive: true,
    isPreset: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'preset-support',
    userId: 'system',
    name: 'Suporte Técnico',
    tone: 'empathetic',
    personality: 'Sou um assistente de suporte técnico prestativo. Resolvo problemas de forma clara, paciente e didática.',
    responseStyle: 'detailed',
    customInstructions: 'Seja paciente. Explique passo a passo. Confirme resolução do problema.',
    isActive: true,
    isPreset: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private devices = new Map<string, WhatsappDevice>();
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, Message>();
  private logics = new Map<string, LogicConfig>();
  private knowledgeBases = new Map<string, KnowledgeBase>();
  private botBehaviors = new Map<string, BotBehaviorConfig>();
  private broadcasts = new Map<string, any>();
  private broadcastContacts = new Map<string, any>();
  private broadcastTemplates = new Map<string, BroadcastTemplate>();
  private webAssistants = new Map<string, WebAssistant>();

  constructor() {
    this.loadData();

    // Inicializar presets se não existirem
    PRESET_BEHAVIORS.forEach(preset => {
      if (!this.botBehaviors.has(preset.id)) {
        this.botBehaviors.set(preset.id, preset);
      }
    });

    this.saveData(); // Save initial state including presets
  }

  private loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        // Helper to revive dates
        const revive = (obj: any) => {
          for (const key in obj) {
            if (typeof obj[key] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(obj[key])) {
              obj[key] = new Date(obj[key]);
            }
          }
          return obj;
        };

        if (data.users) this.users = new Map(data.users.map((u: any) => [u.id, revive(u)]));
        if (data.devices) this.devices = new Map(data.devices.map((d: any) => [d.id, revive(d)]));
        if (data.conversations) this.conversations = new Map(data.conversations.map((c: any) => [c.id, revive(c)]));
        if (data.messages) this.messages = new Map(data.messages.map((m: any) => [m.id, revive(m)]));
        if (data.logics) this.logics = new Map(data.logics.map((l: any) => [l.id, revive(l)]));
        if (data.knowledgeBases) this.knowledgeBases = new Map(data.knowledgeBases.map((k: any) => [k.id, revive(k)]));
        if (data.botBehaviors) this.botBehaviors = new Map(data.botBehaviors.map((b: any) => [b.id, revive(b)]));
        if (data.webAssistants) this.webAssistants = new Map(data.webAssistants.map((w: any) => [w.id, revive(w)]));
        if (data.broadcasts) this.broadcasts = new Map(data.broadcasts.map((b: any) => [b.id, revive(b)]));
        if (data.broadcastContacts) this.broadcastContacts = new Map(data.broadcastContacts.map((c: any) => [c.id, revive(c)]));
        if (data.broadcastTemplates) this.broadcastTemplates = new Map(data.broadcastTemplates.map((t: any) => [t.id, revive(t)]));

        console.log(`[Storage] Data loaded from ${DB_FILE}`);
      }
    } catch (error) {
      console.error("[Storage] Error loading data:", error);
    }
  }

  private saveData() {
    try {
      const data = {
        users: Array.from(this.users.values()),
        devices: Array.from(this.devices.values()),
        conversations: Array.from(this.conversations.values()),
        messages: Array.from(this.messages.values()),
        logics: Array.from(this.logics.values()),
        knowledgeBases: Array.from(this.knowledgeBases.values()),
        botBehaviors: Array.from(this.botBehaviors.values()),
        broadcasts: Array.from(this.broadcasts.values()),
        broadcastContacts: Array.from(this.broadcastContacts.values()),
        webAssistants: Array.from(this.webAssistants.values()),
        broadcastTemplates: Array.from(this.broadcastTemplates.values()),
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error("[Storage] Error saving data:", error);
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const user: User = {
      ...userData,
      id: nanoid(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPlan: userData.currentPlan || 'free',
      planExpiresAt: userData.planExpiresAt || null,
      isAdmin: userData.isAdmin || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    this.saveData();
    return user;
  }

  async updateUser(id: string, data: any): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    this.saveData();
    return updated;
  }

  async upsertUser(userData: User): Promise<User> {
    this.users.set(userData.id, userData);
    this.saveData();
    return userData;
  }

  // WhatsApp Devices
  async getDevices(userId: string): Promise<WhatsappDevice[]> {
    return Array.from(this.devices.values())
      .filter(d => d.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getDevice(id: string): Promise<WhatsappDevice | undefined> {
    return this.devices.get(id);
  }

  async createDevice(device: InsertWhatsappDevice): Promise<WhatsappDevice> {
    const newDevice: WhatsappDevice = {
      ...device,
      id: nanoid(),
      phoneNumber: device.phoneNumber || null,
      connectionStatus: device.connectionStatus || 'disconnected',
      qrCode: null,
      lastConnectedAt: null,
      activeLogicId: null,
      isPaused: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.devices.set(newDevice.id, newDevice);
    this.saveData();
    return newDevice;
  }

  async updateDevice(id: string, data: Partial<WhatsappDevice>): Promise<WhatsappDevice> {
    const device = this.devices.get(id);
    if (!device) throw new Error('Device not found');
    const updated = { ...device, ...data, updatedAt: new Date() };
    this.devices.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    this.devices.delete(id);
    this.saveData();
  }

  async getAllDevices(): Promise<WhatsappDevice[]> {
    return Array.from(this.devices.values());
  }

  // Conversations
  async getConversations(deviceId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(c => c.deviceId === deviceId)
      .sort((a, b) => (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const newConv: Conversation = {
      ...conversation,
      id: nanoid(),
      lastMessageAt: new Date(),
      unreadCount: conversation.unreadCount || 0,
      isActive: conversation.isActive !== undefined ? conversation.isActive : true,
      createdAt: new Date(),
    };
    this.conversations.set(newConv.id, newConv);
    this.saveData();
    return newConv;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const conv = this.conversations.get(id);
    if (!conv) throw new Error('Conversation not found');
    const updated = { ...conv, ...data };
    this.conversations.set(id, updated);
    this.saveData();
    return updated;
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: nanoid(),
      isFromBot: message.isFromBot || false,
      timestamp: message.timestamp || new Date(),
      createdAt: new Date(),
    };
    this.messages.set(newMessage.id, newMessage);

    // Update conversation's lastMessageAt
    const conv = this.conversations.get(message.conversationId);
    if (conv) {
      conv.lastMessageAt = new Date();
      this.conversations.set(message.conversationId, conv);
    }
    this.saveData();

    return newMessage;
  }

  // Logic Configs
  async getLogics(userId: string): Promise<LogicConfig[]> {
    return Array.from(this.logics.values())
      .filter(l => l.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getLogic(id: string): Promise<LogicConfig | undefined> {
    return this.logics.get(id);
  }

  async createLogic(logic: InsertLogicConfig): Promise<LogicConfig> {
    const newLogic: LogicConfig = {
      ...logic,
      id: nanoid(),
      deviceId: logic.deviceId || null,
      description: logic.description || null,
      logicType: logic.logicType || 'json',
      behaviorConfigId: null,
      isActive: logic.isActive !== undefined ? logic.isActive : true,
      isTemplate: logic.isTemplate || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.logics.set(newLogic.id, newLogic);
    this.saveData();
    return newLogic;
  }

  async updateLogic(id: string, data: Partial<LogicConfig>): Promise<LogicConfig> {
    const logic = this.logics.get(id);
    if (!logic) throw new Error('Logic not found');
    const updated = { ...logic, ...data, updatedAt: new Date() };
    this.logics.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteLogic(id: string): Promise<void> {
    this.logics.delete(id);
    this.saveData();
  }

  // Knowledge Base
  async getKnowledgeBase(userId: string): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBases.values())
      .filter(kb => kb.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined> {
    return this.knowledgeBases.get(id);
  }

  async createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const newKb: KnowledgeBase = {
      ...kb,
      id: nanoid(),
      category: kb.category || null,
      imageUrls: kb.imageUrls || null,
      tags: kb.tags || null,
      isActive: kb.isActive !== undefined ? kb.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.knowledgeBases.set(newKb.id, newKb);
    this.saveData();
    return newKb;
  }

  async updateKnowledgeBase(id: string, data: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const kb = this.knowledgeBases.get(id);
    if (!kb) throw new Error('Knowledge Base item not found');
    const updated = { ...kb, ...data, updatedAt: new Date() };
    this.knowledgeBases.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    this.knowledgeBases.delete(id);
    this.saveData();
  }

  // Bot Behavior Configs
  async getBotBehaviors(userId: string): Promise<BotBehaviorConfig[]> {
    return Array.from(this.botBehaviors.values())
      .filter(b => b.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getBotBehavior(id: string): Promise<BotBehaviorConfig | undefined> {
    return this.botBehaviors.get(id);
  }

  async createBotBehavior(behavior: InsertBotBehaviorConfig): Promise<BotBehaviorConfig> {
    const newBehavior: BotBehaviorConfig = {
      ...behavior,
      id: nanoid(),
      tone: behavior.tone || 'professional',
      responseStyle: behavior.responseStyle || 'concise',
      customInstructions: behavior.customInstructions || null,
      isActive: behavior.isActive !== undefined ? behavior.isActive : true,
      isPreset: behavior.isPreset || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.botBehaviors.set(newBehavior.id, newBehavior);
    this.saveData();
    return newBehavior;
  }

  async updateBotBehavior(id: string, data: Partial<BotBehaviorConfig>): Promise<BotBehaviorConfig> {
    const behavior = this.botBehaviors.get(id);
    if (!behavior) throw new Error('Bot Behavior not found');
    const updated = { ...behavior, ...data, updatedAt: new Date() };
    this.botBehaviors.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteBotBehavior(id: string): Promise<void> {
    this.botBehaviors.delete(id);
    this.saveData();
  }

  async getPresetBehaviors(): Promise<BotBehaviorConfig[]> {
    return Array.from(this.botBehaviors.values()).filter(b => b.isPreset);
  }

  // Stats
  async getStats(userId: string): Promise<{
    activeChats: number;
    messagesToday: number;
    responseRate: number;
  }> {
    const userDevices = await this.getDevices(userId);
    const deviceIds = userDevices.map(d => d.id);

    if (deviceIds.length === 0) {
      return { activeChats: 0, messagesToday: 0, responseRate: 0 };
    }

    const activeChats = Array.from(this.conversations.values())
      .filter(c => c.isActive && deviceIds.includes(c.deviceId)).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const messagesToday = Array.from(this.messages.values())
      .filter((m: Message) => {
        const conv = this.conversations.get(m.conversationId);
        return conv && deviceIds.includes(conv.deviceId) &&
          m.timestamp && m.timestamp >= today;
      }).length;

    const responseRate = activeChats > 0 ? Math.min(95, Math.round(Math.random() * 30 + 70)) : 0;

    return { activeChats, messagesToday, responseRate };
  }

  // ============ BROADCAST METHODS ============

  async getBroadcasts(userId: string): Promise<any[]> {
    return Array.from(this.broadcasts.values()).filter(b => b.userId === userId);
  }

  async getBroadcast(id: string): Promise<any | undefined> {
    return this.broadcasts.get(id);
  }

  async createBroadcast(data: any): Promise<any> {
    const newBroadcast = { ...data, id: nanoid(), createdAt: new Date(), startedAt: null, completedAt: null };
    this.broadcasts.set(newBroadcast.id, newBroadcast);
    this.saveData();
    return newBroadcast;
  }

  async updateBroadcast(id: string, data: any): Promise<any> {
    const b = this.broadcasts.get(id);
    if (!b) throw new Error('Broadcast not found');
    const updated = { ...b, ...data };
    this.broadcasts.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteBroadcast(id: string): Promise<void> {
    this.broadcasts.delete(id);
    this.saveData();
  }

  async getBroadcastContacts(broadcastId: string): Promise<any[]> {
    return Array.from(this.broadcastContacts.values()).filter(c => c.broadcastId === broadcastId);
  }

  async createBroadcastContact(data: any): Promise<any> {
    const newContact = { ...data, id: nanoid(), createdAt: new Date(), sentAt: null, errorMessage: null };
    this.broadcastContacts.set(newContact.id, newContact);
    this.saveData();
    return newContact;
  }

  async updateBroadcastContact(id: string, data: any): Promise<any> {
    const contact = this.broadcastContacts.get(id);
    if (!contact) throw new Error("Broadcast contact not found");
    const updated = { ...contact, ...data };
    this.broadcastContacts.set(id, updated);
    this.saveData();
    return updated;
  }

  // Web Assistant methods
  async getWebAssistants(userId: string): Promise<WebAssistant[]> {
    return Array.from(this.webAssistants.values()).filter(
      (w) => w.userId === userId
    );
  }

  async getWebAssistant(id: string): Promise<WebAssistant | undefined> {
    return this.webAssistants.get(id);
  }

  async getWebAssistantBySlug(slug: string): Promise<WebAssistant | undefined> {
    return Array.from(this.webAssistants.values()).find(
      (w) => w.slug === slug
    );
  }

  async createWebAssistant(assistant: InsertWebAssistant): Promise<WebAssistant> {
    const id = nanoid();
    const newAssistant: WebAssistant = {
      ...assistant,
      id,
      themeColor: assistant.themeColor || '#000000',
      activeLogicId: assistant.activeLogicId || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.webAssistants.set(id, newAssistant);
    this.saveData();
    return newAssistant;
  }

  async updateWebAssistant(id: string, data: Partial<WebAssistant>): Promise<WebAssistant> {
    const assistant = this.webAssistants.get(id);
    if (!assistant) throw new Error("Web assistant not found");
    const updated = { ...assistant, ...data, updatedAt: new Date() };
    this.webAssistants.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteWebAssistant(id: string): Promise<void> {
    this.webAssistants.delete(id);
    this.saveData();
  }

  // Broadcast Templates
  async getBroadcastTemplates(userId: string): Promise<BroadcastTemplate[]> {
    return Array.from(this.broadcastTemplates.values()).filter(t => t.userId === userId);
  }

  async createBroadcastTemplate(template: InsertBroadcastTemplate): Promise<BroadcastTemplate> {
    const id = nanoid();
    const newTemplate: BroadcastTemplate = {
      ...template,
      id,
      createdAt: new Date(),
    };
    this.broadcastTemplates.set(id, newTemplate);
    this.saveData();
    return newTemplate;
  }

  async deleteBroadcastTemplate(id: string): Promise<void> {
    this.broadcastTemplates.delete(id);
    this.saveData();
  }
}

// CONFIGURAÇÃO DE STORAGE:
// - MemStorage: Dados em memória (perfeito para desenvolvimento)
// - DatabaseStorage: PostgreSQL (produção - requer DATABASE_URL configurada)

// Usando MemStorage no Replit (DATABASE_URL ainda não propagada)
export const storage = new MemStorage();

// Para produção no seu servidor Linux, troque para:
// export const storage = new DatabaseStorage();
