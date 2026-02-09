import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Encrypted documents - server stores only encrypted blobs
export const encryptedDocuments = pgTable("encrypted_documents", {
  id: serial("id").primaryKey(),
  // SHA-256 hash of the passphrase - used to group docs by "user"
  ownerHash: varchar("owner_hash", { length: 64 }).notNull(),
  // User-provided title (plaintext, non-sensitive metadata)
  title: text("title").notNull(),
  // AES-GCM encrypted document content (base64)
  ciphertext: text("ciphertext").notNull(),
  // Random salt used for PBKDF2 key derivation (base64)
  salt: varchar("salt", { length: 64 }).notNull(),
  // Random IV used for AES-GCM encryption (base64)
  iv: varchar("iv", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertEncryptedDocumentSchema = createInsertSchema(encryptedDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EncryptedDocument = typeof encryptedDocuments.$inferSelect;
export type InsertEncryptedDocument = z.infer<typeof insertEncryptedDocumentSchema>;

