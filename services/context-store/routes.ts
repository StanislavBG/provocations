/**
 * Context Store — Express router factory.
 *
 * Creates a self-contained Express Router with all document/folder/active-context
 * endpoints. Accepts configuration (auth, encryption key) so it can be mounted
 * in any Express app without coupling to Clerk, specific DB instances, etc.
 *
 * Usage:
 *   import { createContextStoreRouter } from 'services/context-store';
 *   app.use('/api', createContextStoreRouter({ getAuth, encryptionKey, storage }));
 */

import { Router } from "express";
import type { ContextStoreConfig } from "./types";
import {
  saveDocumentRequestSchema,
  updateDocumentRequestSchema,
  renameDocumentRequestSchema,
  moveDocumentRequestSchema,
  createFolderRequestSchema,
  renameFolderRequestSchema,
  moveFolderRequestSchema,
  setActiveContextRequestSchema,
} from "./types";
import { encrypt, decrypt, encryptAsync, decryptAsync, decryptField, decryptFieldAsync } from "./crypto";
import type { ContextStoreStorage } from "./storage";

export function createContextStoreRouter(
  config: ContextStoreConfig,
  storage: ContextStoreStorage,
): Router {
  const router = Router();
  const { getAuth, encryptionKey } = config;

  function requireAuth(req: any): string {
    const { userId } = getAuth(req);
    if (!userId) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    return userId;
  }

  function wrapAsync(handler: (req: any, res: any) => Promise<void>) {
    return (req: any, res: any) => {
      handler(req, res).catch((err: any) => {
        const status = err.status || 500;
        const message = err instanceof Error ? err.message : "Unknown error";
        if (status === 401) return res.status(401).json({ error: "Unauthorized" });
        console.error(`Context Store error:`, message);
        res.status(status).json({ error: message });
      });
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // Document endpoints
  // ══════════════════════════════════════════════════════════════════

  // POST /documents — Create a new document
  router.post("/documents", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const parsed = saveDocumentRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    const { title, content, folderId } = parsed.data;
    const key = encryptionKey;
    const encryptedContent = await encryptAsync(content, key);
    const encryptedTitle = await encryptAsync(title, key);

    const result = await storage.saveDocument({
      userId,
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
      ciphertext: encryptedContent.ciphertext,
      salt: encryptedContent.salt,
      iv: encryptedContent.iv,
      folderId: folderId ?? null,
    });
    res.json(result);
  }));

  // GET /documents — List all documents for user (titles decrypted)
  router.get("/documents", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const items = await storage.listDocuments(userId);
    const decrypted = await Promise.all(
      items.map(async (item) => ({
        id: item.id,
        title: await decryptFieldAsync(item.title, item.titleCiphertext, item.titleSalt, item.titleIv, encryptionKey),
        folderId: item.folderId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    );
    res.json({ documents: decrypted });
  }));

  // GET /documents/:id — Load a single document (decrypted)
  router.get("/documents/:id", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

    const doc = await storage.getDocument(id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.userId !== userId) return res.status(403).json({ error: "Not authorized" });

    let content: string;
    try {
      content = await decryptAsync({ ciphertext: doc.ciphertext, salt: doc.salt, iv: doc.iv }, encryptionKey);
    } catch {
      return res.status(422).json({
        error: "Unable to decrypt document",
        details: "This document was saved with an older encryption method.",
      });
    }

    const title = decryptField(doc.title, doc.titleCiphertext, doc.titleSalt, doc.titleIv, encryptionKey);
    res.json({ id: doc.id, title, content, folderId: doc.folderId, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
  }));

  // PUT /documents/:id — Full update (content + title)
  router.put("/documents/:id", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

    const parsed = updateDocumentRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    // Verify ownership
    const owner = await storage.getDocumentOwner(id);
    if (!owner) return res.status(404).json({ error: "Document not found" });
    if (owner !== userId) return res.status(403).json({ error: "Not authorized" });

    const key = encryptionKey;
    const { title, content, folderId } = parsed.data;
    const encryptedContent = await encryptAsync(content, key);
    const encryptedTitle = await encryptAsync(title, key);

    const result = await storage.updateDocument(id, {
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
      ciphertext: encryptedContent.ciphertext,
      salt: encryptedContent.salt,
      iv: encryptedContent.iv,
      folderId,
    });
    if (!result) return res.status(404).json({ error: "Document not found" });
    res.json(result);
  }));

  // PATCH /documents/:id — Rename only
  router.patch("/documents/:id", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

    const parsed = renameDocumentRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    const encryptedTitle = await encryptAsync(parsed.data.title, encryptionKey);
    const result = await storage.renameDocumentForUser(id, userId, {
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
    });
    if (!result) return res.status(404).json({ error: "Document not found or not authorized" });
    res.json(result);
  }));

  // PATCH /documents/:id/move — Move to folder
  router.patch("/documents/:id/move", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

    const parsed = moveDocumentRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    const result = await storage.moveDocumentForUser(id, userId, parsed.data.folderId);
    if (!result) return res.status(404).json({ error: "Document not found or not authorized" });
    res.json(result);
  }));

  // DELETE /documents/:id
  router.delete("/documents/:id", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

    const deleted = await storage.deleteDocumentForUser(id, userId);
    if (!deleted) return res.status(404).json({ error: "Document not found or not authorized" });
    res.json({ success: true });
  }));

  // ══════════════════════════════════════════════════════════════════
  // Folder endpoints
  // ══════════════════════════════════════════════════════════════════

  // GET /folders — List folders (with optional parent filter)
  router.get("/folders", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const rawParent = req.query.parentFolderId as string | undefined;
    let parentFolderFilter: number | null | undefined;
    if (rawParent === undefined) parentFolderFilter = undefined;
    else if (rawParent === "null") parentFolderFilter = null;
    else {
      const parsed = parseInt(rawParent, 10);
      parentFolderFilter = isNaN(parsed) ? undefined : parsed;
    }

    const items = await storage.listFolders(userId, parentFolderFilter);
    const decrypted = await Promise.all(
      items.map(async (item) => ({
        id: item.id,
        name: await decryptFieldAsync(item.name, item.nameCiphertext, item.nameSalt, item.nameIv, encryptionKey),
        parentFolderId: item.parentFolderId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    );
    res.json({ folders: decrypted });
  }));

  // POST /folders — Create folder
  router.post("/folders", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const parsed = createFolderRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    const { name, parentFolderId } = parsed.data;
    const encryptedName = await encryptAsync(name, encryptionKey);
    const folder = await storage.createFolder(userId, "[encrypted]", parentFolderId ?? null, {
      nameCiphertext: encryptedName.ciphertext,
      nameSalt: encryptedName.salt,
      nameIv: encryptedName.iv,
    });
    res.json({
      id: folder.id,
      name,
      parentFolderId: folder.parentFolderId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    });
  }));

  // PATCH /folders/:id — Rename
  router.patch("/folders/:id", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid folder ID" });

    const parsed = renameFolderRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    const encryptedName = await encryptAsync(parsed.data.name, encryptionKey);
    const result = await storage.renameFolderForUser(id, userId, "[encrypted]", {
      nameCiphertext: encryptedName.ciphertext,
      nameSalt: encryptedName.salt,
      nameIv: encryptedName.iv,
    });
    if (!result) return res.status(404).json({ error: "Folder not found or not authorized" });
    res.json({
      id: result.id,
      name: parsed.data.name,
      parentFolderId: result.parentFolderId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }));

  // PATCH /folders/:id/move — Move (with cycle detection)
  router.patch("/folders/:id/move", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid folder ID" });

    const parsed = moveFolderRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    if (parsed.data.parentFolderId === id) {
      return res.status(400).json({ error: "Cannot move a folder into itself" });
    }

    // Cycle detection: walk up from target parent, verify source isn't an ancestor
    if (parsed.data.parentFolderId !== null) {
      const hierarchy = await storage.getFolderHierarchy(userId);
      let current: number | null = parsed.data.parentFolderId;
      while (current !== null) {
        if (current === id) {
          return res.status(400).json({ error: "Cannot move a folder into its own descendant" });
        }
        current = hierarchy.get(current) ?? null;
      }
    }

    const result = await storage.moveFolderForUser(id, userId, parsed.data.parentFolderId);
    if (!result) return res.status(404).json({ error: "Folder not found or not authorized" });
    res.json(result);
  }));

  // DELETE /folders/:id
  router.delete("/folders/:id", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid folder ID" });

    const deleted = await storage.deleteFolderForUser(id, userId);
    if (!deleted) return res.status(404).json({ error: "Folder not found or not authorized" });
    res.json({ success: true });
  }));

  // ══════════════════════════════════════════════════════════════════
  // Active Context (Hot Storage → Cold Store reflection)
  // ══════════════════════════════════════════════════════════════════

  // GET /active-context — Load persisted pinned document IDs
  router.get("/active-context", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const documentIds = await storage.getActiveContext(userId);
    res.json({ documentIds });
  }));

  // PUT /active-context — Save current pinned document IDs
  router.put("/active-context", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const parsed = setActiveContextRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });

    await storage.setActiveContext(userId, parsed.data.documentIds);
    res.json({ success: true });
  }));

  // POST /active-context/pin — Pin a single document
  router.post("/active-context/pin", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const { documentId } = req.body;
    if (typeof documentId !== "number") return res.status(400).json({ error: "documentId required" });

    await storage.pinDocument(userId, documentId);
    res.json({ success: true });
  }));

  // POST /active-context/unpin — Unpin a single document
  router.post("/active-context/unpin", wrapAsync(async (req, res) => {
    const userId = requireAuth(req);
    const { documentId } = req.body;
    if (typeof documentId !== "number") return res.status(400).json({ error: "documentId required" });

    await storage.unpinDocument(userId, documentId);
    res.json({ success: true });
  }));

  return router;
}
