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

  onboardingCompleted: boolean("onboarding_completed").default(false),

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
  integrationType: varchar("integration_type").notNull().default('whatsapp-web-js'),
  instanceName: varchar("instance_name"),
  isGlobalSdr: boolean("is_global_sdr").notNull().default(false),
  isPaused: boolean("is_paused").notNull().default(false),
  shouldTranscribe: boolean("should_transcribe").notNull().default(true),
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
  contactProfilePic: text("contact_profile_pic"),
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
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  timestamp: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ============ LOGIC CONFIGS (JSON CHATBOT LOGIC) ============

export const logicTypeEnum = pgEnum('logic_type', ['json', 'ai', 'hybrid', 'sdr']);

export const logicConfigs = pgTable("logic_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar("device_id").references(() => whatsappDevices.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  logicType: logicTypeEnum("logic_type").notNull().default('json'),
  logicJson: jsonb("logic_json").notNull(),
  behaviorConfigId: varchar("behavior_config_id"), // Comportamento do bot para AI/Hybrid/SDR
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
  logicType: z.enum(['json', 'ai', 'hybrid', 'sdr']).default('json'), // Explicitly require and default to 'json'
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
  mediaUrl: text("media_url"), // Legacy single media URL
  mediaType: varchar("media_type"), // Legacy: image, video, document, audio
  mediaUrls: text("media_urls").array(), // New: Array of media URLs
  mediaTypes: text("media_types").array(), // New: Array of media types
  status: broadcastStatusEnum("status").notNull().default('pending'),
  totalContacts: integer("total_contacts").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  delay: integer("delay").default(20),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  contactName: varchar("contact_name"), // Optional in second def
  phone: varchar("phone").notNull(), // Moved from contactPhone
  status: varchar("status").notNull().default('pending'), // pending, sent, failed
  error: text("error"), // Moved from errorMessage
  sentAt: timestamp("sent_at"),
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
  mediaUrls: text("media_urls").array(), // Suporte para múltiplas mídias
  mediaTypes: text("media_types").array(), // Tipos correspondentes (image, video, etc)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBroadcastTemplateSchema = createInsertSchema(broadcastTemplates).omit({
  id: true,
  createdAt: true,
});

export type BroadcastTemplate = typeof broadcastTemplates.$inferSelect;
export type InsertBroadcastTemplate = z.infer<typeof insertBroadcastTemplateSchema>;

// ============ MESSAGE TEMPLATES ============

export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  content: text("content").notNull(),
  category: varchar("category"),
  mediaUrls: text("media_urls").array(), // Suporte para múltiplas mídias
  mediaTypes: text("media_types").array(), // Tipos correspondentes
  buttons: jsonb("buttons"),
  footerText: text("footer_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;

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

export const broadcastsRelations = relations(broadcasts, ({ one, many }) => ({
  user: one(users, {
    fields: [broadcasts.userId],
    references: [users.id],
  }),
  device: one(whatsappDevices, {
    fields: [broadcasts.deviceId],
    references: [whatsappDevices.id],
  }),
  contacts: many(broadcastContacts),
}));

export const broadcastContactsRelations = relations(broadcastContacts, ({ one }) => ({
  broadcast: one(broadcasts, {
    fields: [broadcastContacts.broadcastId],
    references: [broadcasts.id],
  }),
}));

// ============ SYSTEM LOGS ============

export const logCategoryEnum = pgEnum('log_category', ['whatsapp', 'ai', 'bot', 'system']);
export const logLevelEnum = pgEnum('log_level', ['info', 'warning', 'error']);

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  deviceId: varchar("device_id").references(() => whatsappDevices.id, { onDelete: 'set null' }),
  category: logCategoryEnum("category").notNull(),
  level: logLevelEnum("level").notNull().default('info'),
  message: text("message").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
});

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;

export type LogCategory = 'whatsapp' | 'ai' | 'bot' | 'system' | 'broadcast';
export type LogLevel = 'info' | 'warning' | 'error';

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  user: one(users, {
    fields: [systemLogs.userId],
    references: [users.id],
  }),
  device: one(whatsappDevices, {
    fields: [systemLogs.deviceId],
    references: [whatsappDevices.id],
  }),
}));

// ============ BILLING CONFIG ============

export const billingConfig = pgTable("billing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripePublicKey: text("stripe_public_key"),
  stripeSecretKey: text("stripe_secret_key"),
  pixKey: text("pix_key"),
  pixReceiverName: text("pix_receiver_name"),
  geminiApiKey: text("gemini_api_key"),

  billingMode: varchar("billing_mode").default('manual'),
  stripeEnabled: boolean("stripe_enabled").default(false),
  stripeWebhookSecret: text("stripe_webhook_secret"),
  nupayEnabled: boolean("nupay_enabled").default(false),
  nupayClientId: text("nupay_client_id"),
  nupayClientSecret: text("nupay_client_secret"),
  pixEnabled: boolean("pix_enabled").default(true),
  pixBank: text("pix_bank"),
  pixBeneficiary: text("pix_beneficiary"),

  // Trial settings
  trialDays: integer("trial_days").default(7),

  // Plan Names
  freePlanName: varchar("free_plan_name").default("Free Trial"),
  basicPlanName: varchar("basic_plan_name").default("Básico"),
  fullPlanName: varchar("full_plan_name").default("Full"),

  // Plan Prices
  basicPlanPrice: integer("basic_plan_price").default(2990), // em centavos
  fullPlanPrice: integer("full_plan_price").default(5990), // em centavos

  // Pro Plan
  proPlanName: varchar("pro_plan_name").default("Profissional"),
  proPlanPrice: integer("pro_plan_price").default(6990),
  proPriceId: varchar("pro_price_id"),
  proPlanFeatures: jsonb("pro_plan_features").default(["Agendamentos ilimitados", "WhatsApp Bot"]),

  // Enterprise Plan
  enterprisePlanName: varchar("enterprise_plan_name").default("Enterprise"),
  enterprisePlanPrice: integer("enterprise_plan_price").default(9990),
  enterprisePriceId: varchar("enterprise_price_id"),
  enterprisePlanFeatures: jsonb("enterprise_plan_features").default(["Tudo do Pro", "IA Avançada"]),

  // Stripe Price IDs (from Stripe Dashboard)
  basicPriceId: varchar("basic_price_id"), // price_xxxxx
  fullPriceId: varchar("full_price_id"), // price_xxxxx

  // Plan Features (JSONB arrays)
  freePlanFeatures: jsonb("free_plan_features").default(["1 Bot WhatsApp", "Respostas Básicas", "Suporte da Comunidade"]),
  basicPlanFeatures: jsonb("basic_plan_features").default(["Bots Ilimitados", "Integração AI Básica", "Suporte por Email"]),
  fullPlanFeatures: jsonb("full_plan_features").default(["Tudo do Básico", "AI Avançada (GPT-4)", "Suporte Prioritário", "API Acesso"]),

  updatedAt: timestamp("updated_at").defaultNow(),
});


export const insertBillingConfigSchema = createInsertSchema(billingConfig).omit({
  id: true,
  updatedAt: true
});

export type BillingConfig = typeof billingConfig.$inferSelect;
export type InsertBillingConfig = z.infer<typeof insertBillingConfigSchema>;
