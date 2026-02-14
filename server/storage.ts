import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { documents, userPreferences } from "../shared/models/chat";
import type { UserPreferences } from "../shared/models/chat";
import type {
  Document,
  DocumentListItem,
  DocumentPayload,
} from "@shared/schema";

interface StoredDocument {
  id: number;
  userId: string;
  title: string;
  ciphertext: string;
  salt: string;
  iv: string;
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
  }): Promise<{ id: number; createdAt: string }>;
  listDocuments(userId: string): Promise<DocumentListItem[]>;
  getDocument(id: number): Promise<StoredDocument | null>;
  updateDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string }
  ): Promise<{ id: number; updatedAt: string } | null>;
  renameDocument(id: number, title: string): Promise<{ id: number; title: string; updatedAt: string } | null>;
  deleteDocument(id: number): Promise<void>;
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
  }): Promise<{ id: number; createdAt: string }> {
    const [row] = await db
      .insert(documents)
      .values({
        userId: data.userId,
        title: data.title,
        ciphertext: data.ciphertext,
        salt: data.salt,
        iv: data.iv,
      })
      .returning({ id: documents.id, createdAt: documents.createdAt });

    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  async listDocuments(userId: string): Promise<DocumentListItem[]> {
    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.updatedAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string }
  ): Promise<{ id: number; updatedAt: string } | null> {
    const now = new Date();
    const rows = await db
      .update(documents)
      .set({
        title: data.title,
        ciphertext: data.ciphertext,
        salt: data.salt,
        iv: data.iv,
        updatedAt: now,
      })
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

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
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
