/**
 * Webhook handlers for canvas CRUD operations via HTTP API.
 *
 * Canvas state is stored as encrypted JSON in the documents table.
 * These handlers decrypt → mutate → re-encrypt → save, then broadcast
 * changes to any connected WebSocket clients.
 */

import type { Request, Response } from "express";
import { storage } from "./storage";
import { encrypt, decrypt } from "./crypto";
import { broadcastToCanvasRoom } from "./canvas-collab";
import { z } from "zod";

const ENCRYPTION_SECRET = () =>
  process.env.ENCRYPTION_SECRET || "provocations-dev-key-change-in-production";

// ── Zod schemas ──

export const webhookCreateNodeSchema = z.object({
  type: z.string(),
  label: z.string().default("New Node"),
  x: z.number().default(200),
  y: z.number().default(200),
  content: z.string().optional(),
  documentContent: z.string().optional(),
}).passthrough();

export const webhookUpdateNodeSchema = z.object({
  patch: z.record(z.unknown()),
});

export const webhookCreateEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  role: z.string().optional(),
});

// ── Canvas state helpers ──

interface CanvasState {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateEdgeId(): string {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadCanvasState(canvasId: number, requiredUserId?: string): Promise<{ state: CanvasState; doc: NonNullable<Awaited<ReturnType<typeof storage.getDocument>>> } | null> {
  const doc = await storage.getDocument(canvasId);
  if (!doc) return null;

  // Ownership check: if a userId is provided, verify the document belongs to them
  if (requiredUserId && doc.userId !== requiredUserId) return null;

  try {
    const plaintext = decrypt(
      { ciphertext: doc.ciphertext, salt: doc.salt, iv: doc.iv },
      ENCRYPTION_SECRET(),
    );
    const state = JSON.parse(plaintext) as CanvasState;
    if (!Array.isArray(state.nodes)) state.nodes = [];
    if (!Array.isArray(state.edges)) state.edges = [];
    return { state, doc };
  } catch {
    return null;
  }
}

async function saveCanvasState(canvasId: number, state: CanvasState, doc: NonNullable<Awaited<ReturnType<typeof storage.getDocument>>>) {
  const secret = ENCRYPTION_SECRET();
  const content = JSON.stringify(state);
  const encryptedContent = encrypt(content, secret);

  // Re-encrypt with existing title
  const titlePlain = doc.titleCiphertext
    ? decrypt({ ciphertext: doc.titleCiphertext, salt: doc.titleSalt!, iv: doc.titleIv! }, secret)
    : doc.title || "Canvas";
  const encryptedTitle = encrypt(titlePlain, secret);

  await storage.updateDocument(canvasId, {
    title: "[encrypted]",
    titleCiphertext: encryptedTitle.ciphertext,
    titleSalt: encryptedTitle.salt,
    titleIv: encryptedTitle.iv,
    ciphertext: encryptedContent.ciphertext,
    salt: encryptedContent.salt,
    iv: encryptedContent.iv,
  });
}

/** Exported for use by event-bus result endpoint */
export const loadCanvasStateExported = loadCanvasState;
export const saveCanvasStateExported = saveCanvasState;

/** Extract a route param as string (Express 5 params can be string | string[]) */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

// ── Canvas-level route handlers ──

/** GET /api/webhook/canvas — List canvases for the authenticated user */
export async function listCanvases(req: Request, res: Response) {
  const userId = req.apiUserId || "";
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const secret = ENCRYPTION_SECRET();
  try {
    const docs = await storage.listDocuments(userId);
    const canvases = docs
      .filter((d) => d.docType === "chart")
      .map((d) => {
        let title = d.title;
        try {
          if (d.titleCiphertext) {
            title = decrypt({ ciphertext: d.titleCiphertext, salt: d.titleSalt!, iv: d.titleIv! }, secret);
          }
        } catch { /* fallback */ }
        return { id: d.id, title, createdAt: d.createdAt, updatedAt: d.updatedAt };
      });
    res.json({ canvases });
  } catch {
    res.status(500).json({ error: "Failed to list canvases" });
  }
}

/** POST /api/webhook/canvas — Create a new canvas */
export async function createCanvas(req: Request, res: Response) {
  const userId = req.apiUserId || "";
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const { title } = req.body;
  const canvasTitle = title || "Untitled Canvas";
  const secret = ENCRYPTION_SECRET();
  const initialState: CanvasState = { nodes: [], edges: [] };
  const encryptedContent = encrypt(JSON.stringify(initialState), secret);
  const encryptedTitle = encrypt(canvasTitle, secret);

  try {
    const doc = await storage.saveDocument({
      userId,
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
      ciphertext: encryptedContent.ciphertext,
      salt: encryptedContent.salt,
      iv: encryptedContent.iv,
      folderId: null,
      docType: "chart",
    });
    res.status(201).json({ canvasId: doc.id, title: canvasTitle, createdAt: doc.createdAt });
  } catch {
    res.status(500).json({ error: "Failed to create canvas" });
  }
}

/** PATCH /api/webhook/canvas/:canvasId — Update canvas title */
export async function updateCanvas(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  const secret = ENCRYPTION_SECRET();
  const encryptedTitle = encrypt(title, secret);

  // Re-encrypt existing content (updateDocument requires all encrypted fields)
  const content = JSON.stringify(result.state);
  const encryptedContent = encrypt(content, secret);

  await storage.updateDocument(canvasId, {
    title: "[encrypted]",
    titleCiphertext: encryptedTitle.ciphertext,
    titleSalt: encryptedTitle.salt,
    titleIv: encryptedTitle.iv,
    ciphertext: encryptedContent.ciphertext,
    salt: encryptedContent.salt,
    iv: encryptedContent.iv,
  });

  res.json({ canvasId, title });
}

/** DELETE /api/webhook/canvas/:canvasId — Delete a canvas */
export async function deleteCanvas(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const userId = req.apiUserId || "";

  const deleted = await storage.deleteDocumentForUser(canvasId, userId);
  if (!deleted) return res.status(404).json({ error: "Canvas not found or access denied" });

  res.json({ deleted: true });
}

// ── Node/Edge route handlers ──

/** GET /api/webhook/canvas/:canvasId/nodes — List all nodes */
export async function listNodes(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  res.json({ nodes: result.state.nodes });
}

/** GET /api/webhook/canvas/:canvasId/nodes/:nodeId — Get single node */
export async function getNode(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const nodeId = param(req, "nodeId");
  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  const node = result.state.nodes.find((n) => n.id === nodeId);
  if (!node) return res.status(404).json({ error: "Node not found" });

  res.json({ node });
}

/** POST /api/webhook/canvas/:canvasId/nodes — Create node */
export async function createNode(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const parsed = webhookCreateNodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  const nodeId = generateId();
  // Normalize type: convert underscores to hyphens to match FlowNodeType format
  // (e.g. "event_bus" → "event-bus", "timer_event" → "timer-event")
  const normalizedType = parsed.data.type.replace(/_/g, "-");
  // Spread extra properties (e.g. eventBusMode, eventBusChannel) from passthrough schema
  const { type: _t, label: _l, x: _x, y: _y, content: _c, documentContent: _dc, ...extraProps } = parsed.data;
  const newNode: Record<string, unknown> = {
    id: nodeId,
    type: normalizedType,
    label: parsed.data.label,
    x: parsed.data.x,
    y: parsed.data.y,
    width: 260,
    height: 160,
    zIndex: result.state.nodes.length,
    content: parsed.data.content || "",
    documentContent: parsed.data.documentContent || "",
    ...extraProps,
  };

  result.state.nodes.push(newNode);
  await saveCanvasState(canvasId, result.state, result.doc);

  broadcastToCanvasRoom(canvasId, "add-node", { node: newNode });

  res.status(201).json({ node: newNode });
}

/** PATCH /api/webhook/canvas/:canvasId/nodes/:nodeId — Update node */
export async function updateNode(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const nodeId = param(req, "nodeId");
  const parsed = webhookUpdateNodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  const nodeIndex = result.state.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return res.status(404).json({ error: "Node not found" });

  // Apply patch (don't allow overwriting id)
  const { id: _ignoredId, ...safePatch } = parsed.data.patch;
  Object.assign(result.state.nodes[nodeIndex], safePatch);
  await saveCanvasState(canvasId, result.state, result.doc);

  broadcastToCanvasRoom(canvasId, "update-node", {
    nodeId,
    ...safePatch,
  });

  res.json({ node: result.state.nodes[nodeIndex] });
}

/** DELETE /api/webhook/canvas/:canvasId/nodes/:nodeId — Delete node */
export async function deleteNode(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const nodeId = param(req, "nodeId");

  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  const before = result.state.nodes.length;
  result.state.nodes = result.state.nodes.filter((n) => n.id !== nodeId);
  if (result.state.nodes.length === before) return res.status(404).json({ error: "Node not found" });

  // Cascade-delete edges
  result.state.edges = result.state.edges.filter(
    (e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId,
  );

  await saveCanvasState(canvasId, result.state, result.doc);
  broadcastToCanvasRoom(canvasId, "delete-node", { nodeId });

  res.json({ deleted: true });
}

/** GET /api/webhook/canvas/:canvasId/edges — List edges */
export async function listEdges(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  res.json({ edges: result.state.edges });
}

/** POST /api/webhook/canvas/:canvasId/edges — Create edge */
export async function createEdge(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const parsed = webhookCreateEdgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  // Verify both nodes exist
  const fromExists = result.state.nodes.some((n) => n.id === parsed.data.fromNodeId);
  const toExists = result.state.nodes.some((n) => n.id === parsed.data.toNodeId);
  if (!fromExists || !toExists) return res.status(400).json({ error: "One or both nodes not found" });

  const edgeId = generateEdgeId();
  const newEdge: Record<string, unknown> = {
    id: edgeId,
    fromNodeId: parsed.data.fromNodeId,
    toNodeId: parsed.data.toNodeId,
    role: parsed.data.role || undefined,
  };

  result.state.edges.push(newEdge);
  await saveCanvasState(canvasId, result.state, result.doc);

  broadcastToCanvasRoom(canvasId, "add-edge", { fromNodeId: newEdge.fromNodeId, toNodeId: newEdge.toNodeId, role: newEdge.role });

  res.status(201).json({ edge: newEdge });
}

/** DELETE /api/webhook/canvas/:canvasId/edges/:edgeId — Delete edge */
export async function deleteEdge(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const edgeId = param(req, "edgeId");

  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  const before = result.state.edges.length;
  result.state.edges = result.state.edges.filter((e) => e.id !== edgeId);
  if (result.state.edges.length === before) return res.status(404).json({ error: "Edge not found" });

  await saveCanvasState(canvasId, result.state, result.doc);
  broadcastToCanvasRoom(canvasId, "delete-edge", { edgeId });

  res.json({ deleted: true });
}

/** GET /api/webhook/canvas/:canvasId — Get full canvas state */
export async function getCanvas(req: Request, res: Response) {
  const canvasId = parseInt(param(req, "canvasId"), 10);
  const result = await loadCanvasState(canvasId, req.apiUserId);
  if (!result) return res.status(404).json({ error: "Canvas not found or access denied" });

  // Decrypt title for convenience
  const secret = ENCRYPTION_SECRET();
  let title = result.doc.title || "Canvas";
  try {
    if (result.doc.titleCiphertext) {
      title = decrypt(
        { ciphertext: result.doc.titleCiphertext, salt: result.doc.titleSalt!, iv: result.doc.titleIv! },
        secret,
      );
    }
  } catch { /* use fallback title */ }

  res.json({
    canvasId,
    title,
    nodes: result.state.nodes,
    edges: result.state.edges,
  });
}

// ══════════════════════════════════════════════════════════════════
// Document Store webhook handlers
// ══════════════════════════════════════════════════════════════════

/** GET /api/webhook/documents — List documents for the authenticated user */
export async function listDocuments(req: Request, res: Response) {
  const userId = req.apiUserId || "";
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const secret = ENCRYPTION_SECRET();
  const folderId = req.query.folderId ? parseInt(req.query.folderId as string, 10) : undefined;

  try {
    const docs = await storage.listDocuments(userId, folderId);
    const decrypted = docs.map((d) => {
      let title = d.title;
      try {
        if (d.titleCiphertext) {
          title = decrypt({ ciphertext: d.titleCiphertext, salt: d.titleSalt!, iv: d.titleIv! }, secret);
        }
      } catch { /* use fallback */ }
      return { id: d.id, title, folderId: d.folderId, docType: d.docType, createdAt: d.createdAt, updatedAt: d.updatedAt };
    });
    res.json({ documents: decrypted });
  } catch (err) {
    res.status(500).json({ error: "Failed to list documents" });
  }
}

/** GET /api/webhook/documents/:docId — Get document content */
export async function getDocument(req: Request, res: Response) {
  const docId = parseInt(param(req, "docId"), 10);
  const doc = await storage.getDocument(docId);
  if (!doc || (req.apiUserId && doc.userId !== req.apiUserId)) {
    return res.status(404).json({ error: "Document not found or access denied" });
  }

  const secret = ENCRYPTION_SECRET();
  let title = doc.title;
  let content = "";
  try {
    if (doc.titleCiphertext) {
      title = decrypt({ ciphertext: doc.titleCiphertext, salt: doc.titleSalt!, iv: doc.titleIv! }, secret);
    }
    content = decrypt({ ciphertext: doc.ciphertext, salt: doc.salt, iv: doc.iv }, secret);
  } catch {
    return res.status(500).json({ error: "Failed to decrypt document" });
  }

  res.json({ id: doc.id, title, content, folderId: doc.folderId, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
}

/** POST /api/webhook/documents — Create a new document */
export async function createDocument(req: Request, res: Response) {
  const userId = req.apiUserId || "";
  const { title, content, folderId, docType } = req.body;
  if (!userId || !title || !content) {
    return res.status(400).json({ error: "title and content are required" });
  }

  const secret = ENCRYPTION_SECRET();
  const encryptedContent = encrypt(content, secret);
  const encryptedTitle = encrypt(title, secret);

  try {
    const doc = await storage.saveDocument({
      userId,
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
      ciphertext: encryptedContent.ciphertext,
      salt: encryptedContent.salt,
      iv: encryptedContent.iv,
      folderId: folderId ?? null,
      docType: docType ?? null,
    });
    res.status(201).json({ id: doc.id, createdAt: doc.createdAt });
  } catch {
    res.status(500).json({ error: "Failed to create document" });
  }
}

/** PUT /api/webhook/documents/:docId — Update document content */
export async function updateDocument(req: Request, res: Response) {
  const docId = parseInt(param(req, "docId"), 10);
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content required" });

  // Ownership check
  const existing = await storage.getDocument(docId);
  if (!existing || (req.apiUserId && existing.userId !== req.apiUserId)) {
    return res.status(404).json({ error: "Document not found or access denied" });
  }

  const secret = ENCRYPTION_SECRET();
  const encryptedContent = encrypt(content, secret);
  const encryptedTitle = encrypt(title, secret);

  try {
    const result = await storage.updateDocument(docId, {
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
      ciphertext: encryptedContent.ciphertext,
      salt: encryptedContent.salt,
      iv: encryptedContent.iv,
    });
    if (!result) return res.status(404).json({ error: "Document not found" });
    res.json({ id: result.id, updatedAt: result.updatedAt });
  } catch {
    res.status(500).json({ error: "Failed to update document" });
  }
}

/** GET /api/webhook/folders — List folders for the authenticated user */
export async function listFolders(req: Request, res: Response) {
  const userId = req.apiUserId || "";
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const secret = ENCRYPTION_SECRET();
  try {
    const folderList = await storage.listFolders(userId);
    const decrypted = folderList.map((f) => {
      let name = f.name;
      try {
        if (f.nameCiphertext) {
          name = decrypt({ ciphertext: f.nameCiphertext, salt: f.nameSalt!, iv: f.nameIv! }, secret);
        }
      } catch { /* fallback */ }
      return { id: f.id, name, parentFolderId: f.parentFolderId };
    });
    res.json({ folders: decrypted });
  } catch {
    res.status(500).json({ error: "Failed to list folders" });
  }
}

/** POST /api/webhook/outbound — Server-side proxy for outgoing webhooks */
export async function outboundWebhook(req: Request, res: Response) {
  const { url, payload, headers: customHeaders } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(customHeaders || {}),
      },
      body: JSON.stringify(payload || {}),
    });

    res.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : "Outbound webhook failed",
    });
  }
}
