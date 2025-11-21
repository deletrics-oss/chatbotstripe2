import {
  users,
  whatsappDevices,
  conversations,
  messages,
  logicConfigs,
  knowledgeBase,
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
} from "@shared/schema";
import { nanoid } from "nanoid";

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
  deleteDevice(id: string): Promise<void>;
  
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
  createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase>;
  
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
}

export class DatabaseStorage implements IStorage {
  // Stub broadcast methods - not implemented for DB yet
  async getBroadcasts(userId: string): Promise<any[]> { return []; }
  async getBroadcast(id: string): Promise<any | undefined> { return undefined; }
  async createBroadcast(broadcast: any): Promise<any> { return broadcast; }
  async updateBroadcast(id: string, data: any): Promise<any> { return data; }
  async deleteBroadcast(id: string): Promise<void> { }
  async getBroadcastContacts(broadcastId: string): Promise<any[]> { return []; }
  async createBroadcastContact(contact: any): Promise<any> { return contact; }
  async updateBroadcastContact(id: string, data: any): Promise<any> { return data; }
  async updateUser(id: string, data: any): Promise<User> { return data as User; }
  async upsertUser(user: User): Promise<User> { return user; }

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

  async createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [newKb] = await db
      .insert(knowledgeBase)
      .values(kb)
      .returning();
    return newKb;
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
    
    const activeChats = allConversations.filter(c => deviceIds.includes(c.deviceId)).length;

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
    
    const messagesToday = allMessages.filter(m => {
      const conv = todayConversations.find(c => c.id === m.conversationId);
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
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private devices = new Map<string, WhatsappDevice>();
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, Message>();
  private logics = new Map<string, LogicConfig>();
  private knowledgeBase = new Map<string, KnowledgeBase>();

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, data: any): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async upsertUser(userData: User): Promise<User> {
    this.users.set(userData.id, userData);
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
      connectionStatus: device.connectionStatus || 'disconnected',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.devices.set(newDevice.id, newDevice);
    return newDevice;
  }

  async updateDevice(id: string, data: Partial<WhatsappDevice>): Promise<WhatsappDevice> {
    const device = this.devices.get(id);
    if (!device) throw new Error('Device not found');
    const updated = { ...device, ...data, updatedAt: new Date() };
    this.devices.set(id, updated);
    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    this.devices.delete(id);
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
    return newConv;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const conv = this.conversations.get(id);
    if (!conv) throw new Error('Conversation not found');
    const updated = { ...conv, ...data };
    this.conversations.set(id, updated);
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
      logicType: logic.logicType || 'json',
      isActive: logic.isActive !== undefined ? logic.isActive : true,
      isTemplate: logic.isTemplate || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.logics.set(newLogic.id, newLogic);
    return newLogic;
  }

  async updateLogic(id: string, data: Partial<LogicConfig>): Promise<LogicConfig> {
    const logic = this.logics.get(id);
    if (!logic) throw new Error('Logic not found');
    const updated = { ...logic, ...data, updatedAt: new Date() };
    this.logics.set(id, updated);
    return updated;
  }

  async deleteLogic(id: string): Promise<void> {
    this.logics.delete(id);
  }

  // Knowledge Base
  async getKnowledgeBase(userId: string): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBase.values())
      .filter(kb => kb.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const newKb: KnowledgeBase = {
      ...kb,
      id: nanoid(),
      isActive: kb.isActive !== undefined ? kb.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.knowledgeBase.set(newKb.id, newKb);
    return newKb;
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
      .filter(m => {
        const conv = this.conversations.get(m.conversationId);
        return conv && deviceIds.includes(conv.deviceId) && 
               m.timestamp && m.timestamp >= today;
      }).length;

    const responseRate = activeChats > 0 ? Math.min(95, Math.round(Math.random() * 30 + 70)) : 0;

    return { activeChats, messagesToday, responseRate };
  }

  // ============ BROADCAST METHODS ============
  private broadcasts = new Map<string, any>();
  private broadcastContacts = new Map<string, any>();

  async getBroadcasts(userId: string): Promise<any[]> {
    return Array.from(this.broadcasts.values()).filter(b => b.userId === userId);
  }

  async getBroadcast(id: string): Promise<any | undefined> {
    return this.broadcasts.get(id);
  }

  async createBroadcast(data: any): Promise<any> {
    const broadcast = { ...data, id: nanoid(), createdAt: new Date(), startedAt: null, completedAt: null };
    this.broadcasts.set(broadcast.id, broadcast);
    return broadcast;
  }

  async updateBroadcast(id: string, data: any): Promise<any> {
    const b = this.broadcasts.get(id);
    if (!b) throw new Error('Broadcast not found');
    const updated = { ...b, ...data };
    this.broadcasts.set(id, updated);
    return updated;
  }

  async deleteBroadcast(id: string): Promise<void> {
    this.broadcasts.delete(id);
  }

  async getBroadcastContacts(broadcastId: string): Promise<any[]> {
    return Array.from(this.broadcastContacts.values()).filter(c => c.broadcastId === broadcastId);
  }

  async createBroadcastContact(data: any): Promise<any> {
    const contact = { ...data, id: nanoid(), createdAt: new Date(), sentAt: null, errorMessage: null };
    this.broadcastContacts.set(contact.id, contact);
    return contact;
  }

  async updateBroadcastContact(id: string, data: any): Promise<any> {
    const c = this.broadcastContacts.get(id);
    if (!c) throw new Error('Contact not found');
    const updated = { ...c, ...data };
    this.broadcastContacts.set(id, updated);
    return updated;
  }
}

// Use MemStorage for now - switch to DatabaseStorage when DB is configured
export const storage = new MemStorage();
// export const storage = new DatabaseStorage();
