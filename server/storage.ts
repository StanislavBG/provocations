import { randomUUID } from "crypto";
import { eq, desc, isNull, and, sql, count } from "drizzle-orm";
import { db } from "./db";
import { documents, folders, userPreferences, trackingEvents, personaVersions } from "../shared/models/chat";
import type { UserPreferences } from "../shared/models/chat";
import type {
  Document,
  DocumentListItem,
  DocumentPayload,
  FolderItem,
  TrackingEvent,
  PersonaUsageStat,
  TrackingEventStat,
  AdminDashboardData,
  PersonaVersion,
} from "@shared/schema";

interface StoredDocument {
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
  createdAt: string;
  updatedAt: string;
}

export interface IStorage {
  createDocument(rawText: string): Promise<Document>;
  saveDocument(data: {
    userId: string;
    title: string;
    titleCiphertext: string;
    titleSalt: string;
    titleIv: string;
    ciphertext: string;
    salt: string;
    iv: string;
    folderId?: number | null;
  }): Promise<{ id: number; createdAt: string }>;
  listDocuments(userId: string, folderId?: number | null): Promise<DocumentListItem[]>;
  getDocument(id: number): Promise<StoredDocument | null>;
  updateDocument(
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
    }
  ): Promise<{ id: number; updatedAt: string } | null>;
  renameDocument(
    id: number,
    data: { title: string; titleCiphertext: string; titleSalt: string; titleIv: string }
  ): Promise<{ id: number; updatedAt: string } | null>;
  moveDocument(id: number, folderId: number | null): Promise<{ id: number; updatedAt: string } | null>;
  deleteDocument(id: number): Promise<void>;
  // Folder operations
  createFolder(userId: string, name: string, parentFolderId?: number | null, encrypted?: { nameCiphertext: string; nameSalt: string; nameIv: string }): Promise<FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null }>;
  listFolders(userId: string, parentFolderId?: number | null): Promise<(FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null })[]>;
  renameFolder(id: number, name: string, encrypted?: { nameCiphertext: string; nameSalt: string; nameIv: string }): Promise<(FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null }) | null>;
  deleteFolder(id: number): Promise<void>;
  getFolder(id: number): Promise<{ id: number; userId: string; name: string; nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null; parentFolderId: number | null } | null>;
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
    titleCiphertext: string;
    titleSalt: string;
    titleIv: string;
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
        titleCiphertext: data.titleCiphertext,
        titleSalt: data.titleSalt,
        titleIv: data.titleIv,
        ciphertext: data.ciphertext,
        salt: data.salt,
        iv: data.iv,
        folderId: data.folderId ?? null,
      })
      .returning({ id: documents.id, createdAt: documents.createdAt });

    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  async listDocuments(userId: string, folderId?: number | null): Promise<(DocumentListItem & { titleCiphertext: string | null; titleSalt: string | null; titleIv: string | null })[]> {
    const condition = folderId != null
      ? and(eq(documents.userId, userId), eq(documents.folderId, folderId))
      : folderId === null
        ? and(eq(documents.userId, userId), isNull(documents.folderId))
        : eq(documents.userId, userId);

    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        titleCiphertext: documents.titleCiphertext,
        titleSalt: documents.titleSalt,
        titleIv: documents.titleIv,
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
      titleCiphertext: r.titleCiphertext,
      titleSalt: r.titleSalt,
      titleIv: r.titleIv,
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
      titleCiphertext: row.titleCiphertext,
      titleSalt: row.titleSalt,
      titleIv: row.titleIv,
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
    data: {
      title: string;
      titleCiphertext: string;
      titleSalt: string;
      titleIv: string;
      ciphertext: string;
      salt: string;
      iv: string;
      folderId?: number | null;
    }
  ): Promise<{ id: number; updatedAt: string } | null> {
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

  async renameDocument(
    id: number,
    data: { title: string; titleCiphertext: string; titleSalt: string; titleIv: string }
  ): Promise<{ id: number; updatedAt: string } | null> {
    const now = new Date();
    const rows = await db
      .update(documents)
      .set({
        title: data.title,
        titleCiphertext: data.titleCiphertext,
        titleSalt: data.titleSalt,
        titleIv: data.titleIv,
        updatedAt: now,
      })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, updatedAt: documents.updatedAt });

    if (rows.length === 0) return null;
    return { id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() };
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

  async createFolder(
    userId: string,
    name: string,
    parentFolderId?: number | null,
    encrypted?: { nameCiphertext: string; nameSalt: string; nameIv: string },
  ): Promise<FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null }> {
    const [row] = await db
      .insert(folders)
      .values({
        userId,
        name,
        nameCiphertext: encrypted?.nameCiphertext ?? null,
        nameSalt: encrypted?.nameSalt ?? null,
        nameIv: encrypted?.nameIv ?? null,
        parentFolderId: parentFolderId ?? null,
      })
      .returning();

    return {
      id: row.id,
      name: row.name,
      nameCiphertext: row.nameCiphertext,
      nameSalt: row.nameSalt,
      nameIv: row.nameIv,
      parentFolderId: row.parentFolderId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listFolders(userId: string, parentFolderId?: number | null): Promise<(FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null })[]> {
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
      nameCiphertext: r.nameCiphertext,
      nameSalt: r.nameSalt,
      nameIv: r.nameIv,
      parentFolderId: r.parentFolderId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getFolder(id: number): Promise<{ id: number; userId: string; name: string; nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null; parentFolderId: number | null } | null> {
    const [row] = await db
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
    };
  }

  async renameFolder(
    id: number,
    name: string,
    encrypted?: { nameCiphertext: string; nameSalt: string; nameIv: string },
  ): Promise<(FolderItem & { nameCiphertext: string | null; nameSalt: string | null; nameIv: string | null }) | null> {
    const now = new Date();
    const rows = await db
      .update(folders)
      .set({
        name,
        nameCiphertext: encrypted?.nameCiphertext ?? null,
        nameSalt: encrypted?.nameSalt ?? null,
        nameIv: encrypted?.nameIv ?? null,
        updatedAt: now,
      })
      .where(eq(folders.id, id))
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

  // ── Tracking Events ──

  async recordTrackingEvent(data: {
    userId: string;
    sessionId: string;
    eventType: string;
    personaId?: string;
    templateId?: string;
    appSection?: string;
    durationMs?: number;
    metadata?: Record<string, string>;
  }): Promise<void> {
    try {
      await db.insert(trackingEvents).values({
        userId: data.userId,
        sessionId: data.sessionId,
        eventType: data.eventType,
        personaId: data.personaId ?? null,
        templateId: data.templateId ?? null,
        appSection: data.appSection ?? null,
        durationMs: data.durationMs ?? null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      });
    } catch (err) {
      // Non-fatal: tracking should never break the app
      console.error("Failed to record tracking event:", err instanceof Error ? err.message : err);
    }
  }

  async getPersonaUsageStats(): Promise<PersonaUsageStat[]> {
    const rows = await db
      .select({
        personaId: trackingEvents.personaId,
        usageCount: count(trackingEvents.id),
      })
      .from(trackingEvents)
      .where(
        and(
          sql`${trackingEvents.personaId} IS NOT NULL`,
          sql`${trackingEvents.eventType} IN ('persona_selected', 'challenge_generated', 'advice_requested')`
        )
      )
      .groupBy(trackingEvents.personaId)
      .orderBy(desc(count(trackingEvents.id)));

    // Enrich with persona metadata
    const { builtInPersonas } = await import("@shared/personas");
    return rows.map((r) => {
      const persona = builtInPersonas[r.personaId as keyof typeof builtInPersonas];
      return {
        personaId: r.personaId!,
        personaLabel: persona?.label ?? r.personaId!,
        domain: persona?.domain ?? "unknown",
        usageCount: Number(r.usageCount),
        lastUsedAt: null, // could be computed with a subquery if needed
      };
    });
  }

  async getEventBreakdown(): Promise<TrackingEventStat[]> {
    const rows = await db
      .select({
        eventType: trackingEvents.eventType,
        eventCount: count(trackingEvents.id),
      })
      .from(trackingEvents)
      .groupBy(trackingEvents.eventType)
      .orderBy(desc(count(trackingEvents.id)));

    return rows.map((r) => ({
      eventType: r.eventType,
      count: Number(r.eventCount),
    }));
  }

  async getAdminDashboardData(): Promise<AdminDashboardData> {
    const [personaUsage, eventBreakdown] = await Promise.all([
      this.getPersonaUsageStats(),
      this.getEventBreakdown(),
    ]);

    // Total events
    const totalEvents = eventBreakdown.reduce((sum, e) => sum + e.count, 0);

    // Distinct sessions
    const [sessionRow] = await db
      .select({ sessionCount: sql<number>`COUNT(DISTINCT ${trackingEvents.sessionId})` })
      .from(trackingEvents);
    const totalSessions = Number(sessionRow?.sessionCount ?? 0);

    // Avg document generation time
    const [avgRow] = await db
      .select({ avgMs: sql<number>`AVG(${trackingEvents.durationMs})` })
      .from(trackingEvents)
      .where(
        and(
          sql`${trackingEvents.eventType} = 'write_executed'`,
          sql`${trackingEvents.durationMs} IS NOT NULL`
        )
      );
    const avgDocumentGenerationMs = Math.round(Number(avgRow?.avgMs ?? 0));

    // Storage metadata
    const [docCountRow] = await db
      .select({ docCount: count(documents.id) })
      .from(documents);
    const [folderCountRow] = await db
      .select({ folderCount: count(folders.id) })
      .from(folders);
    // Max folder depth via recursive CTE
    let maxFolderDepth = 0;
    try {
      const result = await db.execute(sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, parent_folder_id, 1 AS depth FROM folders WHERE parent_folder_id IS NULL
          UNION ALL
          SELECT f.id, f.parent_folder_id, ft.depth + 1
          FROM folders f JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        SELECT COALESCE(MAX(depth), 0) AS max_depth FROM folder_tree
      `);
      const depthRow = (result as any).rows?.[0];
      maxFolderDepth = Number(depthRow?.max_depth ?? 0);
    } catch {
      // Non-fatal
    }

    return {
      personaUsage,
      eventBreakdown,
      totalEvents,
      totalSessions,
      avgDocumentGenerationMs,
      storageMetadata: {
        folderCount: Number(folderCountRow?.folderCount ?? 0),
        maxFolderDepth,
        documentCount: Number(docCountRow?.docCount ?? 0),
      },
    };
  }

  // ── Persona Versions (Archival) ──

  async savePersonaVersion(personaId: string, definition: string): Promise<PersonaVersion> {
    // Determine next version number
    const [latest] = await db
      .select({ version: personaVersions.version })
      .from(personaVersions)
      .where(eq(personaVersions.personaId, personaId))
      .orderBy(desc(personaVersions.version))
      .limit(1);

    const nextVersion = (latest?.version ?? 0) + 1;

    const [row] = await db
      .insert(personaVersions)
      .values({ personaId, version: nextVersion, definition })
      .returning();

    return {
      id: row.id,
      personaId: row.personaId,
      version: row.version,
      definition: row.definition,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getPersonaVersions(personaId: string): Promise<PersonaVersion[]> {
    const rows = await db
      .select()
      .from(personaVersions)
      .where(eq(personaVersions.personaId, personaId))
      .orderBy(desc(personaVersions.version));

    return rows.map((r) => ({
      id: r.id,
      personaId: r.personaId,
      version: r.version,
      definition: r.definition,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export const storage = new DatabaseStorage();
