/**
 * Context Store — Type definitions and Zod validation schemas.
 *
 * Self-contained: no imports from shared/ or server/.
 * All types needed by consumers of the Context Store service are defined here.
 */

import { z } from "zod";

// ── Document schemas ──

export const saveDocumentRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  folderId: z.number().nullable().optional(),
});

export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>;

export const updateDocumentRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  folderId: z.number().nullable().optional(),
});

export type UpdateDocumentRequest = z.infer<typeof updateDocumentRequestSchema>;

export const renameDocumentRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

export type RenameDocumentRequest = z.infer<typeof renameDocumentRequestSchema>;

export const moveDocumentRequestSchema = z.object({
  folderId: z.number().nullable(),
});

export type MoveDocumentRequest = z.infer<typeof moveDocumentRequestSchema>;

// ── Folder schemas ──

export const createFolderRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  parentFolderId: z.number().nullable().optional(),
});

export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>;

export const renameFolderRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export type RenameFolderRequest = z.infer<typeof renameFolderRequestSchema>;

export const moveFolderRequestSchema = z.object({
  parentFolderId: z.number().nullable(),
});

export type MoveFolderRequest = z.infer<typeof moveFolderRequestSchema>;

// ── Active context schemas ──

export const setActiveContextRequestSchema = z.object({
  documentIds: z.array(z.number()),
});

export type SetActiveContextRequest = z.infer<typeof setActiveContextRequestSchema>;

// ── Response types ──

export interface DocumentListItem {
  id: number;
  title: string;
  folderId?: number | null;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPayload {
  id: number;
  title: string;
  content: string;
  folderId?: number | null;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  id: number;
  name: string;
  parentFolderId: number | null;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveContextItem {
  userId: string;
  documentId: number;
  pinnedAt: string;
}

// ── Internal types (used by storage layer) ──

export interface StoredDocument {
  id: number;
  userId: string;
  title: string;
  titleCiphertext: string | null;
  titleSalt: string | null;
  titleIv: string | null;
  ciphertext: string;
  salt: string;
  iv: string;
  folderId: number | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFolder {
  id: number;
  userId: string;
  name: string;
  nameCiphertext: string | null;
  nameSalt: string | null;
  nameIv: string | null;
  parentFolderId: number | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Encrypted payload from AES-256-GCM */
export interface EncryptedPayload {
  ciphertext: string; // base64
  salt: string;       // base64
  iv: string;         // base64
}

/** Configuration for creating a Context Store router */
export interface ContextStoreConfig {
  /** Extract authenticated userId from request (e.g., Clerk getAuth) */
  getAuth: (req: any) => { userId: string | null };
  /** Server-side encryption key */
  encryptionKey: string;
}
