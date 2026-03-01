import { pgTable, serial, integer, text, timestamp, varchar, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Folders — hierarchical organization for documents, owned by Clerk userId
// Zero-knowledge: folder names are encrypted at rest.
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  // Legacy plaintext name — kept for backward compatibility with pre-encryption rows.
  // New folders store "[encrypted]" here; real name is in nameCiphertext.
  name: varchar("name", { length: 200 }).notNull(),
  // AES-GCM encrypted folder name (base64). Null for legacy rows.
  nameCiphertext: text("name_ciphertext"),
  nameSalt: varchar("name_salt", { length: 64 }),
  nameIv: varchar("name_iv", { length: 32 }),
  parentFolderId: integer("parent_folder_id"),
  // When true, folder cannot be renamed, moved, or deleted (system-managed structure)
  locked: boolean("locked").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_folders_user_id").on(table.userId),
  index("idx_folders_user_parent").on(table.userId, table.parentFolderId),
]);

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoredFolder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

// Key versions — tracks encryption keys per user for rotation support
export const keyVersions = pgTable("key_versions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  keyEncryptionData: text("key_encryption_data").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type StoredKeyVersion = typeof keyVersions.$inferSelect;

// Documents - server-side encrypted at rest, owned by Clerk userId
// Zero-knowledge: ALL user-provided text (title + content) is encrypted.
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  // Clerk user ID - identifies the document owner
  userId: varchar("user_id", { length: 128 }).notNull(),
  // Legacy plaintext title — kept for backward compatibility with pre-encryption rows.
  // New documents store "[encrypted]" here; real title is in titleCiphertext.
  title: text("title").notNull(),
  // AES-GCM encrypted title (base64). Null for legacy rows.
  titleCiphertext: text("title_ciphertext"),
  titleSalt: varchar("title_salt", { length: 64 }),
  titleIv: varchar("title_iv", { length: 32 }),
  // AES-GCM encrypted document content (base64)
  ciphertext: text("ciphertext").notNull(),
  // Random salt used for PBKDF2 key derivation (base64)
  salt: varchar("salt", { length: 64 }).notNull(),
  // Random IV used for AES-GCM encryption (base64)
  iv: varchar("iv", { length: 32 }).notNull(),
  // Optional folder for hierarchical organization
  folderId: integer("folder_id"),
  // Optional key version for encryption key rotation
  keyVersionId: integer("key_version_id"),
  // When true, document cannot be renamed, moved, or deleted (system-managed structure).
  // Content updates are still allowed so admins can edit details.
  locked: boolean("locked").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_documents_user_id").on(table.userId),
  index("idx_documents_user_folder").on(table.userId, table.folderId),
  index("idx_documents_user_updated").on(table.userId, table.updatedAt),
]);

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoredDocument = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Active Context — persists which documents a user has pinned (hot → cold store reflection)
export const activeContext = pgTable("active_context", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  documentId: integer("document_id").notNull(),
  pinnedAt: timestamp("pinned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_active_context_user").on(table.userId),
]);

export type StoredActiveContext = typeof activeContext.$inferSelect;

// User preferences - persisted settings per Clerk userId
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().unique(),
  autoDictate: boolean("auto_dictate").default(false).notNull(),
  verboseMode: boolean("verbose_mode").default(false).notNull(),
  autoSaveSession: boolean("auto_save_session").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;

// Persona versions — archival system for tracking every version of persona definitions
export const personaVersions = pgTable("persona_versions", {
  id: serial("id").primaryKey(),
  personaId: varchar("persona_id", { length: 64 }).notNull(),
  version: integer("version").notNull(),
  definition: text("definition").notNull(), // JSON-serialized Persona object
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_persona_versions_persona").on(table.personaId),
]);

export type StoredPersonaVersion = typeof personaVersions.$inferSelect;

// Tracking events — captures user interactions without storing user-inputted text
export const trackingEvents = pgTable("tracking_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  personaId: varchar("persona_id", { length: 64 }),
  templateId: varchar("template_id", { length: 64 }),
  appSection: varchar("app_section", { length: 64 }),
  durationMs: integer("duration_ms"),          // for timed events (e.g. document generation)
  metadata: text("metadata"),                   // JSON string of additional non-PII data
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_tracking_events_user").on(table.userId),
  index("idx_tracking_events_type").on(table.eventType),
  index("idx_tracking_events_session").on(table.sessionId),
  index("idx_tracking_events_created").on(table.createdAt),
]);

export type StoredTrackingEvent = typeof trackingEvents.$inferSelect;

// Usage metrics — cumulative per-user productivity metrics (non-PII, numeric only)
// Each row is a single metric for a single user, upserted (incremented) on each event.
export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  metricKey: varchar("metric_key", { length: 64 }).notNull(),
  metricValue: integer("metric_value").default(0).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("idx_usage_metrics_user_key").on(table.userId, table.metricKey),
]);

export type StoredUsageMetric = typeof usageMetrics.$inferSelect;

// Pipeline artifacts — stores transcripts, summaries, and infographics for
// YouTube/voice capture → infographic pipelines. Encrypted at rest.
// Relationships use a Key Ring approach: artifacts link to a parent document
// via documentId, and sibling artifacts reference each other via parentArtifactId.
export const pipelineArtifacts = pgTable("pipeline_artifacts", {
  id: serial("id").primaryKey(),
  uuid: varchar("uuid", { length: 36 }).notNull().unique(), // immutable external identifier
  userId: varchar("user_id", { length: 128 }).notNull(),
  documentId: integer("document_id"), // owning document (nullable for standalone)
  parentArtifactId: integer("parent_artifact_id"), // Key Ring: transcript → summary → infographic
  artifactType: varchar("artifact_type", { length: 32 }).notNull(), // "transcript" | "summary" | "infographic"
  sourceType: varchar("source_type", { length: 32 }).notNull(), // "youtube" | "voice-capture"
  // Source metadata (not user text — no encryption needed)
  sourceUrl: text("source_url"), // YouTube video URL (nullable for voice)
  sourceTitle: varchar("source_title", { length: 500 }), // video/session title from API
  thumbnailUrl: text("thumbnail_url"), // YouTube thumbnail
  // AES-GCM encrypted content
  ciphertext: text("ciphertext").notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  // Processing status
  status: varchar("status", { length: 16 }).default("pending").notNull(), // "pending" | "processing" | "complete" | "error"
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPipelineArtifactSchema = createInsertSchema(pipelineArtifacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoredPipelineArtifact = typeof pipelineArtifacts.$inferSelect;
export type InsertPipelineArtifact = z.infer<typeof insertPipelineArtifactSchema>;

// Persona overrides — DB-backed layer that overrides code defaults from shared/personas.ts.
// At runtime: code defaults + DB overrides = effective personas (DB wins).
// Export pipeline syncs DB → code for next production deploy.
export const personaOverrides = pgTable("persona_overrides", {
  id: serial("id").primaryKey(),
  personaId: varchar("persona_id", { length: 64 }).notNull().unique(),
  definition: text("definition").notNull(), // full JSON-serialized Persona object
  humanCurated: boolean("human_curated").default(false).notNull(),
  curatedBy: varchar("curated_by", { length: 128 }), // Clerk userId who curated
  curatedAt: timestamp("curated_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("idx_persona_overrides_persona_id").on(table.personaId),
]);

export type StoredPersonaOverride = typeof personaOverrides.$inferSelect;

// Agent definitions — user-created multi-step agent workflows.
// Each agent defines a persona and a chain of Input → Actor → Output steps.
export const agentDefinitions = pgTable("agent_definitions", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id", { length: 128 }).notNull().unique(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  persona: text("persona"),
  steps: text("steps").notNull(), // JSON array of AgentStep
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_agent_definitions_user_id").on(table.userId),
  uniqueIndex("idx_agent_definitions_agent_id").on(table.agentId),
]);

export type StoredAgentDefinition = typeof agentDefinitions.$inferSelect;

// Agent prompt overrides — admin edits to existing LLM task type system prompts.
// Mirrors the persona_overrides pattern: DB wins over code default.
export const agentPromptOverrides = pgTable("agent_prompt_overrides", {
  id: serial("id").primaryKey(),
  taskType: varchar("task_type", { length: 64 }).notNull().unique(),
  systemPrompt: text("system_prompt").notNull(),
  humanCurated: boolean("human_curated").default(false).notNull(),
  curatedBy: varchar("curated_by", { length: 128 }),
  curatedAt: timestamp("curated_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("idx_agent_prompt_overrides_task_type").on(table.taskType),
]);

export type StoredAgentPromptOverride = typeof agentPromptOverrides.$inferSelect;

// Error logs — global error tracking visible to admins and the originating user.
// Normal users see only their own errors; admins see all errors.
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }),
  tag: varchar("tag", { length: 64 }).notNull(),       // e.g. "api", "client", "voice", "llm"
  message: text("message").notNull(),
  stack: text("stack"),                                  // error stack trace
  url: text("url"),                                      // page URL or API endpoint
  metadata: text("metadata"),                            // JSON string of extra context
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_error_logs_user").on(table.userId),
  index("idx_error_logs_created").on(table.createdAt),
  index("idx_error_logs_tag").on(table.tag),
]);

export type StoredErrorLog = typeof errorLogs.$inferSelect;

// Payments — tracks Stripe payment records per user.
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  stripeSessionId: varchar("stripe_session_id", { length: 256 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 256 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 256 }),
  productId: varchar("product_id", { length: 256 }),
  priceId: varchar("price_id", { length: 256 }),
  amount: integer("amount"),              // in cents
  currency: varchar("currency", { length: 8 }),
  status: varchar("status", { length: 32 }).notNull(), // "pending" | "completed" | "failed"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_payments_user").on(table.userId),
  index("idx_payments_session").on(table.stripeSessionId),
]);

export type StoredPayment = typeof payments.$inferSelect;

// LLM call logs — gateway-level logging for every LLM invocation.
// Captures metadata only (no user text). Used by verbose mode and admin analytics.
export const llmCallLogs = pgTable("llm_call_logs", {
  id: serial("id").primaryKey(),
  callId: varchar("call_id", { length: 36 }).notNull().unique(), // UUID per call
  userId: varchar("user_id", { length: 128 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }),
  // What triggered this call
  appType: varchar("app_type", { length: 64 }),        // templateId (e.g. "product-requirement")
  taskType: varchar("task_type", { length: 64 }).notNull(), // e.g. "challenge", "write", "advice"
  endpoint: varchar("endpoint", { length: 128 }).notNull(), // API route path
  // Model info
  provider: varchar("provider", { length: 32 }).notNull(),  // "openai" | "anthropic" | "gemini"
  model: varchar("model", { length: 128 }).notNull(),       // e.g. "gpt-4o", "claude-sonnet-4-5-20250929"
  // Token / size metrics
  contextTokensEstimate: integer("context_tokens_estimate"), // estimated input tokens
  contextCharacters: integer("context_characters"),          // exact input character count
  responseCharacters: integer("response_characters"),        // exact output character count
  responseTokensEstimate: integer("response_tokens_estimate"), // estimated output tokens
  maxTokens: integer("max_tokens"),                          // maxTokens parameter sent
  temperature: integer("temperature_x100"),                  // temperature * 100 (integer storage)
  // Cost estimate (in microdollars — $1 = 1,000,000)
  estimatedCostMicrodollars: integer("estimated_cost_microdollars"),
  // Timing
  durationMs: integer("duration_ms"),
  // Status
  status: varchar("status", { length: 16 }).default("success").notNull(), // "success" | "error" | "streaming"
  errorMessage: text("error_message"),
  // Whether this was a streaming call
  streaming: boolean("streaming").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_llm_call_logs_user").on(table.userId),
  index("idx_llm_call_logs_created").on(table.createdAt),
  index("idx_llm_call_logs_task").on(table.taskType),
  index("idx_llm_call_logs_app").on(table.appType),
]);

export type StoredLlmCallLog = typeof llmCallLogs.$inferSelect;
export type InsertLlmCallLog = typeof llmCallLogs.$inferInsert;

// Workspace sessions — saves full workspace state for resume functionality.
// Encrypted at rest (like documents). Each user can have multiple saved sessions.
export const workspaceSessions = pgTable("workspace_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  templateId: varchar("template_id", { length: 64 }).notNull(),
  // Encrypted title (same pattern as documents)
  title: text("title").notNull(), // "[encrypted]" for new rows
  titleCiphertext: text("title_ciphertext"),
  titleSalt: varchar("title_salt", { length: 64 }),
  titleIv: varchar("title_iv", { length: 32 }),
  // AES-GCM encrypted JSON blob of workspace state
  ciphertext: text("ciphertext").notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_workspace_sessions_user").on(table.userId),
  index("idx_workspace_sessions_template").on(table.userId, table.templateId),
]);

export type StoredWorkspaceSession = typeof workspaceSessions.$inferSelect;

// ══════════════════════════════════════════════════════════════════
// Messaging — Connections, Conversations & Encrypted Messages
// ══════════════════════════════════════════════════════════════════

// Connections — tracks relationships between users.
// Both users must accept before they can message each other.
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id", { length: 128 }).notNull(),     // Clerk userId who sent the invite
  responderId: varchar("responder_id", { length: 128 }).notNull(),     // Clerk userId who received it
  status: varchar("status", { length: 16 }).default("pending").notNull(), // "pending" | "accepted" | "blocked"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_connections_requester").on(table.requesterId),
  index("idx_connections_responder").on(table.responderId),
  uniqueIndex("idx_connections_pair").on(table.requesterId, table.responderId),
]);

export type StoredConnection = typeof connections.$inferSelect;

// Conversations — a chat thread between exactly two connected users.
// One conversation per connection. Title is encrypted.
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),                    // FK to connections.id
  // Participants stored explicitly for fast lookups
  participantA: varchar("participant_a", { length: 128 }).notNull(),   // Clerk userId
  participantB: varchar("participant_b", { length: 128 }).notNull(),   // Clerk userId
  // Last activity timestamp for sorting conversation list
  lastActivityAt: timestamp("last_activity_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_conversations_participant_a").on(table.participantA),
  index("idx_conversations_participant_b").on(table.participantB),
  uniqueIndex("idx_conversations_connection").on(table.connectionId),
]);

export type StoredConversation = typeof conversations.$inferSelect;

// Messages — individual messages within a conversation. Fully encrypted at rest.
// Auto-purged after 7 days via scheduled cleanup.
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),                // FK to conversations.id
  senderId: varchar("sender_id", { length: 128 }).notNull(),          // Clerk userId
  // AES-256-GCM encrypted message body
  ciphertext: text("ciphertext").notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  // Message metadata
  messageType: varchar("message_type", { length: 16 }).default("text").notNull(), // "text" | "context-share"
  // For context-share: encrypted reference to shared document/context
  refCiphertext: text("ref_ciphertext"),
  refSalt: varchar("ref_salt", { length: 64 }),
  refIv: varchar("ref_iv", { length: 32 }),
  // Read receipt
  readAt: timestamp("read_at"),
  // Expiry — messages older than this are purged
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_sender").on(table.senderId),
  index("idx_messages_expires").on(table.expiresAt),
  index("idx_messages_created").on(table.conversationId, table.createdAt),
]);

export type StoredMessage = typeof messages.$inferSelect;

// Chat preferences — per-user messaging settings (separate from app preferences)
export const chatPreferences = pgTable("chat_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().unique(),
  // Presence / status
  presenceStatus: varchar("presence_status", { length: 16 }).default("available").notNull(), // "available" | "busy" | "away" | "invisible"
  customStatusText: varchar("custom_status_text", { length: 100 }),
  // Notification settings
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  notifyOnMentionOnly: boolean("notify_on_mention_only").default(false).notNull(),
  mutedConversations: text("muted_conversations"),  // JSON array of conversation IDs
  // Privacy
  readReceiptsEnabled: boolean("read_receipts_enabled").default(true).notNull(),
  typingIndicatorsEnabled: boolean("typing_indicators_enabled").default(true).notNull(),
  // Message retention (days) — 7 default, user can lower
  messageRetentionDays: integer("message_retention_days").default(7).notNull(),
  // Display
  chatSoundEnabled: boolean("chat_sound_enabled").default(true).notNull(),
  compactMode: boolean("compact_mode").default(false).notNull(),
  // Timestamps
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("idx_chat_preferences_user").on(table.userId),
]);

export type StoredChatPreferences = typeof chatPreferences.$inferSelect;

