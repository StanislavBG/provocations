import { pgTable, serial, integer, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Folders — hierarchical organization for documents, owned by Clerk userId
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  parentFolderId: integer("parent_folder_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

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
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  // Clerk user ID - identifies the document owner
  userId: varchar("user_id", { length: 128 }).notNull(),
  // User-provided title (plaintext metadata)
  title: text("title").notNull(),
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
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoredDocument = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// User preferences - persisted settings per Clerk userId
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().unique(),
  autoDictate: boolean("auto_dictate").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;

