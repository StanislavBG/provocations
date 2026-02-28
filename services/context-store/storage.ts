/**
 * Context Store — Storage layer.
 *
 * All document/folder/active-context CRUD operations.
 * Accepts a Drizzle db instance + Drizzle table references so it's
 * decoupled from the parent application's database configuration.
 */

import { eq, desc, isNull, and } from "drizzle-orm";
import type {
  StoredDocument,
  DocumentListItem,
  FolderItem,
} from "./types";

/** Drizzle table shape for documents (matches shared/models/chat.ts) */
type DocumentsTable = any;
/** Drizzle table shape for folders */
type FoldersTable = any;
/** Drizzle table shape for active_context */
type ActiveContextTable = any;

export interface ContextStoreTables {
  documents: DocumentsTable;
  folders: FoldersTable;
  activeContext?: ActiveContextTable;
}

/**
 * Self-contained storage class for the Context Store microservice.
 * All methods accept explicit userId for ownership scoping.
 */
export class ContextStoreStorage {
  constructor(
    private db: any,
    private tables: ContextStoreTables,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  // Documents
  // ══════════════════════════════════════════════════════════════════

  async saveDocument(data: {
    userId: string;
    title: string;
    titleCiphertext: string;
    titleSalt: string;
    titleIv: string;
    ciphertext: string;
    salt: string;
    iv: string;
    folderId?: number | null;
    locked?: boolean;
  }): Promise<{ id: number; createdAt: string }> {
    const { documents } = this.tables;
    const [row] = await this.db
      .insert(documents)
      .values({
        userId: data.userId,
        title: data.title,
        titleCiphertext: data.titleCiphertext,
        titleSalt: data.titleSalt,
        titleIv: data.titleIv,
        ciphertext: data.ciphertext,
        salt: data.salt,
        iv: data.iv,
        folderId: data.folderId ?? null,
        locked: data.locked ?? false,
      })
      .returning({ id: documents.id, createdAt: documents.createdAt });
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  async listDocuments(
    userId: string,
    folderId?: number | null,
  ): Promise<(DocumentListItem & { titleCiphertext: string | null; titleSalt: string | null; titleIv: string | null })[]> {
    const { documents } = this.tables;
    const condition =
      folderId != null
        ? and(eq(documents.userId, userId), eq(documents.folderId, folderId))
        : folderId === null
          ? and(eq(documents.userId, userId), isNull(documents.folderId))
          : eq(documents.userId, userId);

    const rows = await this.db
      .select({
        id: documents.id,
        title: documents.title,
        titleCiphertext: documents.titleCiphertext,
        titleSalt: documents.titleSalt,
        titleIv: documents.titleIv,
        folderId: documents.folderId,
        locked: documents.locked,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(condition)
      .orderBy(desc(documents.updatedAt));

    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      titleCiphertext: r.titleCiphertext,
      titleSalt: r.titleSalt,
      titleIv: r.titleIv,
      folderId: r.folderId,
      locked: r.locked,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getDocument(id: number): Promise<StoredDocument | null> {
    const { documents } = this.tables;
    const [row] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      titleCiphertext: row.titleCiphertext,
      titleSalt: row.titleSalt,
      titleIv: row.titleIv,
      ciphertext: row.ciphertext,
      salt: row.salt,
      iv: row.iv,
      folderId: row.folderId,
      locked: row.locked,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateDocument(
    id: number,
    data: {
      title: string;
      titleCiphertext: string;
      titleSalt: string;
      titleIv: string;
      ciphertext: string;
      salt: string;
      iv: string;
      folderId?: number | null;
    },
  ): Promise<{ id: number; updatedAt: string } | null> {
    const { documents } = this.tables;
    const now = new Date();
    const setData: Record<string, unknown> = {
      title: data.title,
      titleCiphertext: data.titleCiphertext,
      titleSalt: data.titleSalt,
      titleIv: data.titleIv,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      updatedAt: now,
    };
    if (data.folderId !== undefined) setData.folderId = data.folderId;
    const rows = await this.db
      .update(documents)
      .set(setData)
      .where(eq(documents.id, id))
      .returning({ id: documents.id, updatedAt: documents.updatedAt });
    if (rows.length === 0) return null;
    return { id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async renameDocumentForUser(
    id: number,
    userId: string,
    data: { title: string; titleCiphertext: string; titleSalt: string; titleIv: string },
  ): Promise<{ id: number; updatedAt: string } | null> {
    const { documents } = this.tables;
    const now = new Date();
    const rows = await this.db
      .update(documents)
      .set({
        title: data.title,
        titleCiphertext: data.titleCiphertext,
        titleSalt: data.titleSalt,
        titleIv: data.titleIv,
        updatedAt: now,
      })
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning({ id: documents.id, updatedAt: documents.updatedAt });
    if (rows.length === 0) return null;
    return { id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async moveDocumentForUser(
    id: number,
    userId: string,
    folderId: number | null,
  ): Promise<{ id: number; updatedAt: string } | null> {
    const { documents } = this.tables;
    const now = new Date();
    const rows = await this.db
      .update(documents)
      .set({ folderId, updatedAt: now })
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning({ id: documents.id, updatedAt: documents.updatedAt });
    if (rows.length === 0) return null;
    return { id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async deleteDocumentForUser(id: number, userId: string): Promise<boolean> {
    const { documents } = this.tables;
    const rows = await this.db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning({ id: documents.id });
    return rows.length > 0;
  }

  async getDocumentOwner(id: number): Promise<string | null> {
    const { documents } = this.tables;
    const [row] = await this.db
      .select({ userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return row?.userId ?? null;
  }

  // ══════════════════════════════════════════════════════════════════
  // Folders
  // ══════════════════════════════════════════════════════════════════

  async createFolder(
    userId: string,
    name: string,
    parentFolderId: number | null,
    encrypted?: { nameCiphertext: string; nameSalt: string; nameIv: string },
    locked?: boolean,
  ): Promise<FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null }> {
    const { folders } = this.tables;
    const [row] = await this.db
      .insert(folders)
      .values({
        userId,
        name,
        nameCiphertext: encrypted?.nameCiphertext ?? null,
        nameSalt: encrypted?.nameSalt ?? null,
        nameIv: encrypted?.nameIv ?? null,
        parentFolderId: parentFolderId ?? null,
        locked: locked ?? false,
      })
      .returning();
    return {
      id: row.id,
      name: row.name,
      nameCiphertext: row.nameCiphertext,
      nameSalt: row.nameSalt,
      nameIv: row.nameIv,
      parentFolderId: row.parentFolderId,
      locked: row.locked,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listFolders(
    userId: string,
    parentFolderId?: number | null,
  ): Promise<(FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null })[]> {
    const { folders } = this.tables;
    const condition =
      parentFolderId != null
        ? and(eq(folders.userId, userId), eq(folders.parentFolderId, parentFolderId))
        : parentFolderId === null
          ? and(eq(folders.userId, userId), isNull(folders.parentFolderId))
          : eq(folders.userId, userId);

    const rows = await this.db.select().from(folders).where(condition).orderBy(folders.name);
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      nameCiphertext: r.nameCiphertext,
      nameSalt: r.nameSalt,
      nameIv: r.nameIv,
      parentFolderId: r.parentFolderId,
      locked: r.locked,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getFolder(id: number) {
    const { folders } = this.tables;
    const [row] = await this.db
      .select()
      .from(folders)
      .where(eq(folders.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      nameCiphertext: row.nameCiphertext,
      nameSalt: row.nameSalt,
      nameIv: row.nameIv,
      parentFolderId: row.parentFolderId,
      locked: row.locked,
    };
  }

  async renameFolderForUser(
    id: number,
    userId: string,
    name: string,
    encrypted?: { nameCiphertext: string; nameSalt: string; nameIv: string },
  ) {
    const { folders } = this.tables;
    const now = new Date();
    const rows = await this.db
      .update(folders)
      .set({
        name,
        nameCiphertext: encrypted?.nameCiphertext ?? null,
        nameSalt: encrypted?.nameSalt ?? null,
        nameIv: encrypted?.nameIv ?? null,
        updatedAt: now,
      })
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .returning();
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      nameCiphertext: r.nameCiphertext,
      nameSalt: r.nameSalt,
      nameIv: r.nameIv,
      parentFolderId: r.parentFolderId,
      locked: r.locked,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async moveFolderForUser(
    id: number,
    userId: string,
    parentFolderId: number | null,
  ): Promise<{ id: number; parentFolderId: number | null; updatedAt: string } | null> {
    const { folders } = this.tables;
    const now = new Date();
    const rows = await this.db
      .update(folders)
      .set({ parentFolderId, updatedAt: now })
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .returning({ id: folders.id, parentFolderId: folders.parentFolderId, updatedAt: folders.updatedAt });
    if (rows.length === 0) return null;
    return { id: rows[0].id, parentFolderId: rows[0].parentFolderId, updatedAt: rows[0].updatedAt.toISOString() };
  }

  async deleteFolderForUser(id: number, userId: string): Promise<boolean> {
    const { folders } = this.tables;
    const rows = await this.db
      .delete(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .returning({ id: folders.id });
    return rows.length > 0;
  }

  /** Lightweight id→parentId map for cycle detection. O(1) per lookup. */
  async getFolderHierarchy(userId: string): Promise<Map<number, number | null>> {
    const { folders } = this.tables;
    const rows = await this.db
      .select({ id: folders.id, parentFolderId: folders.parentFolderId })
      .from(folders)
      .where(eq(folders.userId, userId));
    const map = new Map<number, number | null>();
    for (const r of rows) map.set(r.id, r.parentFolderId);
    return map;
  }

  // ══════════════════════════════════════════════════════════════════
  // Active Context (Hot Storage → Cold Store reflection)
  // ══════════════════════════════════════════════════════════════════

  /** Load pinned document IDs for a user (persisted active context). */
  async getActiveContext(userId: string): Promise<number[]> {
    const { activeContext } = this.tables;
    if (!activeContext) return [];
    const rows = await this.db
      .select({ documentId: activeContext.documentId })
      .from(activeContext)
      .where(eq(activeContext.userId, userId))
      .orderBy(activeContext.pinnedAt);
    return rows.map((r: any) => r.documentId);
  }

  /** Replace the user's active context with the given document IDs. */
  async setActiveContext(userId: string, documentIds: number[]): Promise<void> {
    const { activeContext } = this.tables;
    if (!activeContext) return;
    // Delete old pins, insert new ones — simple transactional replace
    await this.db.delete(activeContext).where(eq(activeContext.userId, userId));
    if (documentIds.length > 0) {
      const now = new Date();
      await this.db.insert(activeContext).values(
        documentIds.map((documentId) => ({
          userId,
          documentId,
          pinnedAt: now,
        })),
      );
    }
  }

  /** Add a single document to active context. */
  async pinDocument(userId: string, documentId: number): Promise<void> {
    const { activeContext } = this.tables;
    if (!activeContext) return;
    // Upsert — ignore if already pinned
    try {
      await this.db.insert(activeContext).values({
        userId,
        documentId,
        pinnedAt: new Date(),
      });
    } catch {
      // Already pinned (unique constraint) — ignore
    }
  }

  /** Remove a single document from active context. */
  async unpinDocument(userId: string, documentId: number): Promise<void> {
    const { activeContext } = this.tables;
    if (!activeContext) return;
    await this.db
      .delete(activeContext)
      .where(and(eq(activeContext.userId, userId), eq(activeContext.documentId, documentId)));
  }

  // ══════════════════════════════════════════════════════════════════
  // Lock management
  // ══════════════════════════════════════════════════════════════════

  async setDocumentLocked(id: number, locked: boolean): Promise<void> {
    const { documents } = this.tables;
    await this.db.update(documents).set({ locked, updatedAt: new Date() }).where(eq(documents.id, id));
  }

  async setFolderLocked(id: number, locked: boolean): Promise<void> {
    const { folders } = this.tables;
    await this.db.update(folders).set({ locked, updatedAt: new Date() }).where(eq(folders.id, id));
  }
}
