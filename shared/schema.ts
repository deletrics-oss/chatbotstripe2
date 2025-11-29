import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ REPLIT AUTH TABLES (MANDATORY) ============

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table with local auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),

  // Stripe customer info
  stripeCustomerId: varchar("stripe_customer_id").unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id"),

  // Subscription plan (free, basic, full)
  currentPlan: varchar("current_plan").notNull().default('free'),
  planExpiresAt: timestamp("plan_expires_at"),
  isAdmin: boolean("is_admin").default(false),

  // User's personal Gemini API key
  geminiApiKey: text("gemini_api_key"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Login and registration schemas
export const registerUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  email: z.string().email().optional(),
});

export const loginUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// ============ WHATSAPP DEVICES ============

export const connectionStatusEnum = pgEnum('connection_status', ['disconnected', 'connecting', 'connected', 'qr_ready']);

export const whatsappDevices = pgTable("whatsapp_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  phoneNumber: varchar("phone_number"),
  connectionStatus: connectionStatusEnum("connection_status").notNull().default('disconnected'),
  qrCode: text("qr_code"),
  lastConnectedAt: timestamp("last_connected_at"),
  activeLogicId: varchar("active_logic_id"),
  isPaused: boolean("is_paused").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWhatsappDeviceSchema = createInsertSchema(whatsappDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappDevice = typeof whatsappDevices.$inferSelect;
export type InsertWhatsappDevice = z.infer<typeof insertWhatsappDeviceSchema>;

// ============ CONVERSATIONS & MESSAGES ============

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => whatsappDevices.id, { onDelete: 'cascade' }),
  contactName: varchar("contact_name").notNull(),
  contactPhone: varchar("contact_phone").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export const messageDirectionEnum = pgEnum('message_direction', ['incoming', 'outgoing']);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  direction: messageDirectionEnum("direction").notNull(),
  content: text("content").notNull(),
  isFromBot: boolean("is_from_bot").notNull().default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ============ LOGIC CONFIGS (JSON CHATBOT LOGIC) ============

export const logicTypeEnum = pgEnum('logic_type', ['json', 'ai', 'hybrid']);

export const logicConfigs = pgTable("logic_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar("device_id").references(() => whatsappDevices.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  logicType: logicTypeEnum("logic_type").notNull().default('json'),
  logicJson: jsonb("logic_json").notNull(),
  behaviorConfigId: varchar("behavior_config_id"), // Comportamento do bot para AI/Hybrid
  isActive: boolean("is_active").notNull().default(true),
  isTemplate: boolean("is_template").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLogicConfigSchema = createInsertSchema(logicConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  logicType: z.enum(['json', 'ai', 'hybrid']).default('json'), // Explicitly require and default to 'json'
  logicJson: z.record(z.any()),
});

export type LogicConfig = typeof logicConfigs.$inferSelect;
export type InsertLogicConfig = z.infer<typeof insertLogicConfigSchema>;

// ============ KNOWLEDGE BASE ============

export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category"),
  imageUrls: text("image_urls").array(), // Suporte para múltiplas imagens
  tags: text("tags").array(), // Tags para busca
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;

// ============ BOT BEHAVIOR CONFIGS ============

export const botBehaviorConfigs = pgTable("bot_behavior_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // Nome do comportamento
  tone: varchar("tone").notNull().default('professional'), // formal, friendly, casual, sales, support
  personality: text("personality").notNull(), // Descrição da personalidade
  responseStyle: varchar("response_style").notNull().default('concise'), // concise, detailed, empathetic
  customInstructions: text("custom_instructions"), // Instruções customizadas
  isActive: boolean("is_active").notNull().default(true),
  isPreset: boolean("is_preset").notNull().default(false), // Se é comportamento padrão do sistema
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBotBehaviorConfigSchema = createInsertSchema(botBehaviorConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BotBehaviorConfig = typeof botBehaviorConfigs.$inferSelect;
export type InsertBotBehaviorConfig = z.infer<typeof insertBotBehaviorConfigSchema>;

// ============ BROADCASTS (MASS MESSAGING) ============

export const broadcastStatusEnum = pgEnum('broadcast_status', ['pending', 'running', 'paused', 'completed', 'failed']);

export const broadcasts = pgTable("broadcasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar("device_id").notNull().references(() => whatsappDevices.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type"), // image, video, document, audio
  status: broadcastStatusEnum("status").notNull().default('pending'),
  totalContacts: integer("total_contacts").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  delay: integer("delay").default(20),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertBroadcastSchema = createInsertSchema(broadcasts).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export type Broadcast = typeof broadcasts.$inferSelect;
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;

export const broadcastContacts = pgTable("broadcast_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  broadcastId: varchar("broadcast_id").notNull().references(() => broadcasts.id, { onDelete: 'cascade' }),
  contactName: varchar("contact_name").notNull(),
  contactPhone: varchar("contact_phone").notNull(),
  status: varchar("status").notNull().default('pending'), // pending, sent, failed
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBroadcastContactSchema = createInsertSchema(broadcastContacts).omit({
  id: true,
  createdAt: true,
});

export type BroadcastContact = typeof broadcastContacts.$inferSelect;
export type InsertBroadcastContact = z.infer<typeof insertBroadcastContactSchema>;

// ============ WEB ASSISTANTS (NON-WHATSAPP CHAT) ============

export const webAssistants = pgTable("web_assistants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(), // Public URL identifier
  themeColor: varchar("theme_color").default('#000000'),
  activeLogicId: varchar("active_logic_id"), // Can link to a logic config
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWebAssistantSchema = createInsertSchema(webAssistants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
});

export type WebAssistant = typeof webAssistants.$inferSelect;
export type InsertWebAssistant = z.infer<typeof insertWebAssistantSchema>;

// ============ BROADCAST TEMPLATES ============

export const broadcastTemplates = pgTable("broadcast_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBroadcastTemplateSchema = createInsertSchema(broadcastTemplates).omit({
  id: true,
  createdAt: true,
});

export type BroadcastTemplate = typeof broadcastTemplates.$inferSelect;
export type InsertBroadcastTemplate = z.infer<typeof insertBroadcastTemplateSchema>;

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ many }) => ({
  whatsappDevices: many(whatsappDevices),
  logicConfigs: many(logicConfigs),
  knowledgeBase: many(knowledgeBase),
  webAssistants: many(webAssistants),
}));

export const whatsappDevicesRelations = relations(whatsappDevices, ({ one, many }) => ({
  user: one(users, {
    fields: [whatsappDevices.userId],
    references: [users.id],
  }),
  conversations: many(conversations),
  logicConfigs: many(logicConfigs),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  device: one(whatsappDevices, {
    fields: [conversations.deviceId],
    references: [whatsappDevices.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const webAssistantsRelations = relations(webAssistants, ({ one }) => ({
  user: one(users, {
    fields: [webAssistants.userId],
    references: [users.id],
  }),
  activeLogic: one(logicConfigs, {
    fields: [webAssistants.activeLogicId],
    references: [logicConfigs.id],
  }),
}));

export const logicConfigsRelations = relations(logicConfigs, ({ one }) => ({
  user: one(users, {
    fields: [logicConfigs.userId],
    references: [users.id],
  }),
  device: one(whatsappDevices, {
    fields: [logicConfigs.deviceId],
    references: [whatsappDevices.id],
  }),
}));

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  user: one(users, {
    fields: [knowledgeBase.userId],
    references: [users.id],
  }),
}));
