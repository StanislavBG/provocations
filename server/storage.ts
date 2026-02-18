import { randomUUID } from "crypto";
import { eq, desc, isNull, and } from "drizzle-orm";
import { db } from "./db";
import { documents, folders, userPreferences } from "../shared/models/chat";
import type { UserPreferences } from "../shared/models/chat";
import type {
  Document,
  DocumentListItem,
  DocumentPayload,
  FolderItem,
} from "@shared/schema";

interface StoredDocument {
  id: number;
  userId: string;
  title: string;
  ciphertext: string;
  salt: string;
  iv: string;
  folderId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IStorage {
  createDocument(rawText: string): Promise<Document>;
  saveDocument(data: {
    userId: string;
    title: string;
    ciphertext: string;
    salt: string;
    iv: string;
    folderId?: number | null;
  }): Promise<{ id: number; createdAt: string }>;
  listDocuments(userId: string, folderId?: number | null): Promise<DocumentListItem[]>;
  getDocument(id: number): Promise<StoredDocument | null>;
  updateDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string; folderId?: number | null }
  ): Promise<{ id: number; updatedAt: string } | null>;
  renameDocument(id: number, title: string): Promise<{ id: number; title: string; updatedAt: string } | null>;
  moveDocument(id: number, folderId: number | null): Promise<{ id: number; updatedAt: string } | null>;
  deleteDocument(id: number): Promise<void>;
  // Folder operations
  createFolder(userId: string, name: string, parentFolderId?: number | null): Promise<FolderItem>;
  listFolders(userId: string, parentFolderId?: number | null): Promise<FolderItem[]>;
  renameFolder(id: number, name: string): Promise<FolderItem | null>;
  deleteFolder(id: number): Promise<void>;
  getFolder(id: number): Promise<{ id: number; userId: string; name: string; parentFolderId: number | null } | null>;
  // User preferences
  getUserPreferences(userId: string): Promise<{ autoDictate: boolean }>;
  setUserPreferences(userId: string, prefs: { autoDictate: boolean }): Promise<{ autoDictate: boolean }>;
}

export class DatabaseStorage implements IStorage {
  // Transient workspace documents (in-memory only — these are ephemeral editing sessions, not saved drafts)
  private workspaceDocuments: Map<string, Document>;

  constructor() {
    this.workspaceDocuments = new Map();
  }

  async createDocument(rawText: string): Promise<Document> {
    const id = randomUUID();
    const document: Document = { id, rawText };
    this.workspaceDocuments.set(id, document);
    return document;
  }

  async saveDocument(data: {
    userId: string;
    title: string;
    ciphertext: string;
    salt: string;
    iv: string;
    folderId?: number | null;
  }): Promise<{ id: number; createdAt: string }> {
    const [row] = await db
      .insert(documents)
      .values({
        userId: data.userId,
        title: data.title,
        ciphertext: data.ciphertext,
        salt: data.salt,
        iv: data.iv,
        folderId: data.folderId ?? null,
      })
      .returning({ id: documents.id, createdAt: documents.createdAt });

    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  async listDocuments(userId: string, folderId?: number | null): Promise<DocumentListItem[]> {
    const condition = folderId != null
      ? and(eq(documents.userId, userId), eq(documents.folderId, folderId))
      : folderId === null
        ? and(eq(documents.userId, userId), isNull(documents.folderId))
        : eq(documents.userId, userId);

    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        folderId: documents.folderId,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(condition)
      .orderBy(desc(documents.updatedAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      folderId: r.folderId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getDocument(id: number): Promise<StoredDocument | null> {
    const [row] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      ciphertext: row.ciphertext,
      salt: row.salt,
      iv: row.iv,
      folderId: row.folderId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string; folderId?: number | null }
  ): Promise<{ id: number; updatedAt: string } | null> {
    const now = new Date();
    const setData: Record<string, unknown> = {
      title: data.title,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      updatedAt: now,
    };
    if (data.folderId !== undefined) {
      setData.folderId = data.folderId;
    }
    const rows = await db
      .update(documents)
      .set(setData)
      .where(eq(documents.id, id))
      .returning({ id: documents.id, updatedAt: documents.updatedAt });

    if (rows.length === 0) return null;
    return { id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async renameDocument(id: number, title: string): Promise<{ id: number; title: string; updatedAt: string } | null> {
    const now = new Date();
    const rows = await db
      .update(documents)
      .set({ title, updatedAt: now })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt });

    if (rows.length === 0) return null;
    return { id: rows[0].id, title: rows[0].title, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async moveDocument(id: number, folderId: number | null): Promise<{ id: number; updatedAt: string } | null> {
    const now = new Date();
    const rows = await db
      .update(documents)
      .set({ folderId, updatedAt: now })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, updatedAt: documents.updatedAt });

    if (rows.length === 0) return null;
    return { id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // ── Folder CRUD ──

  async createFolder(userId: string, name: string, parentFolderId?: number | null): Promise<FolderItem> {
    const [row] = await db
      .insert(folders)
      .values({ userId, name, parentFolderId: parentFolderId ?? null })
      .returning();

    return {
      id: row.id,
      name: row.name,
      parentFolderId: row.parentFolderId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listFolders(userId: string, parentFolderId?: number | null): Promise<FolderItem[]> {
    const condition = parentFolderId != null
      ? and(eq(folders.userId, userId), eq(folders.parentFolderId, parentFolderId))
      : parentFolderId === null
        ? and(eq(folders.userId, userId), isNull(folders.parentFolderId))
        : eq(folders.userId, userId);

    const rows = await db
      .select()
      .from(folders)
      .where(condition)
      .orderBy(folders.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentFolderId: r.parentFolderId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getFolder(id: number): Promise<{ id: number; userId: string; name: string; parentFolderId: number | null } | null> {
    const [row] = await db
      .select()
      .from(folders)
      .where(eq(folders.id, id))
      .limit(1);

    if (!row) return null;
    return { id: row.id, userId: row.userId, name: row.name, parentFolderId: row.parentFolderId };
  }

  async renameFolder(id: number, name: string): Promise<FolderItem | null> {
    const now = new Date();
    const rows = await db
      .update(folders)
      .set({ name, updatedAt: now })
      .where(eq(folders.id, id))
      .returning();

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      parentFolderId: r.parentFolderId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async deleteFolder(id: number): Promise<void> {
    await db.delete(folders).where(eq(folders.id, id));
  }

  async getUserPreferences(userId: string): Promise<{ autoDictate: boolean }> {
    const [row] = await db
      .select({ autoDictate: userPreferences.autoDictate })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    return { autoDictate: row?.autoDictate ?? false };
  }

  async setUserPreferences(userId: string, prefs: { autoDictate: boolean }): Promise<{ autoDictate: boolean }> {
    const now = new Date();
    const [row] = await db
      .insert(userPreferences)
      .values({
        userId,
        autoDictate: prefs.autoDictate,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          autoDictate: prefs.autoDictate,
          updatedAt: now,
        },
      })
      .returning({ autoDictate: userPreferences.autoDictate });

    return { autoDictate: row.autoDictate };
  }
}

export const storage = new DatabaseStorage();
