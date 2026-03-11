/**
 * API key authentication middleware for machine-to-machine webhook endpoints.
 *
 * Supports two modes:
 * 1. DB-backed multi-key: hashes incoming X-API-Key, looks up in api_keys table.
 *    Each key is scoped to a user, with optional scope and canvas restrictions.
 * 2. Env-var fallback: checks PROVOCATIONS_API_KEY / PROVOCATIONS_USER_ID for
 *    backward compatibility with existing agents.
 *
 * Keys are cached in-memory (60s TTL, max 200 entries) to avoid DB queries
 * on every request.
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      /** Clerk user ID bound to the API key. Set by requireApiKey middleware. */
      apiUserId?: string;
      /** Scopes granted by the API key. null = full access. */
      apiKeyScopes?: string[] | null;
      /** Canvas IDs this key can access. null = all canvases. */
      apiKeyCanvasIds?: number[] | null;
      /** DB row ID of the matched API key (for lastUsedAt updates). */
      apiKeyId?: number;
    }
  }
}

// ── In-memory cache ──

interface CachedKey {
  userId: string;
  scopes: string[] | null;
  canvasIds: number[] | null;
  dbId: number;
  cachedAt: number;
}

const CACHE_TTL = 60_000; // 60 seconds
const CACHE_MAX = 200;
const keyCache = new Map<string, CachedKey>();

function hashKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/** Remove a specific key hash from cache (called on revoke). */
export function invalidateKeyCache(keyHash: string): void {
  keyCache.delete(keyHash);
}

/** Clear entire cache (for testing). */
export function clearKeyCache(): void {
  keyCache.clear();
}

// ── Middleware ──

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string | undefined;
  if (!key) {
    return res.status(401).json({ error: "Missing X-API-Key header" });
  }

  const hash = hashKey(key);

  // Check cache first
  const cached = keyCache.get(hash);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    req.apiUserId = cached.userId;
    req.apiKeyScopes = cached.scopes;
    req.apiKeyCanvasIds = cached.canvasIds;
    req.apiKeyId = cached.dbId;
    // Fire-and-forget lastUsedAt update
    void touchLastUsed(cached.dbId);
    return next();
  }

  // Try DB lookup, then fall back to env var
  lookupKey(hash, key)
    .then((result) => {
      if (!result) {
        return res.status(401).json({ error: "Invalid or missing API key" });
      }
      req.apiUserId = result.userId;
      req.apiKeyScopes = result.scopes;
      req.apiKeyCanvasIds = result.canvasIds;
      req.apiKeyId = result.dbId;

      // Cache the result
      if (keyCache.size >= CACHE_MAX) {
        // Evict oldest entry
        const oldest = keyCache.keys().next().value;
        if (oldest) keyCache.delete(oldest);
      }
      keyCache.set(hash, { ...result, cachedAt: Date.now() });

      if (result.dbId > 0) {
        void touchLastUsed(result.dbId);
      }
      next();
    })
    .catch((err) => {
      console.error("[api-key-auth] Lookup failed:", err instanceof Error ? err.message : err);
      // On DB error, try env-var fallback
      const envResult = checkEnvFallback(key);
      if (envResult) {
        req.apiUserId = envResult.userId;
        req.apiKeyScopes = null;
        req.apiKeyCanvasIds = null;
        return next();
      }
      return res.status(503).json({ error: "Authentication service temporarily unavailable" });
    });
}

async function lookupKey(hash: string, plaintext: string): Promise<CachedKey | null> {
  // Try DB first
  try {
    const { storage } = await import("./storage");
    const row = await storage.getApiKeyByHash(hash);
    if (row) {
      return {
        userId: row.userId,
        scopes: row.scopes ? JSON.parse(row.scopes) : null,
        canvasIds: row.canvasIds ? JSON.parse(row.canvasIds) : null,
        dbId: row.id,
        cachedAt: Date.now(),
      };
    }
  } catch {
    // DB may be unavailable — fall through to env-var check
  }

  // Env-var fallback
  const envResult = checkEnvFallback(plaintext);
  if (envResult) return envResult;

  return null;
}

function checkEnvFallback(plaintext: string): CachedKey | null {
  const expected = process.env.PROVOCATIONS_API_KEY;
  const userId = process.env.PROVOCATIONS_USER_ID;
  if (expected && userId && plaintext === expected) {
    return {
      userId,
      scopes: null, // full access
      canvasIds: null,
      dbId: 0, // env-var keys have no DB row
      cachedAt: Date.now(),
    };
  }
  return null;
}

async function touchLastUsed(dbId: number): Promise<void> {
  if (dbId <= 0) return;
  try {
    const { storage } = await import("./storage");
    await storage.touchApiKeyLastUsed(dbId);
  } catch {
    // Non-fatal
  }
}

// ── Scope enforcement middleware ──

/**
 * Returns middleware that checks for a required scope.
 * If the key has null scopes (full access), the check passes.
 */
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // null scopes = full access
    if (req.apiKeyScopes === null || req.apiKeyScopes === undefined) return next();
    if (req.apiKeyScopes.includes(scope)) return next();
    return res.status(403).json({ error: `Missing required scope: ${scope}` });
  };
}

/**
 * Returns middleware that checks canvas ID access.
 * If the key has null canvasIds (all canvases), the check passes.
 * Reads canvasId from req.params.canvasId.
 */
export function requireCanvasAccess(req: Request, res: Response, next: NextFunction) {
  if (req.apiKeyCanvasIds === null || req.apiKeyCanvasIds === undefined) return next();
  const rawParam = req.params.canvasId;
  const canvasId = parseInt(Array.isArray(rawParam) ? rawParam[0] : rawParam, 10);
  if (isNaN(canvasId) || !req.apiKeyCanvasIds.includes(canvasId)) {
    return res.status(403).json({ error: "API key does not have access to this canvas" });
  }
  return next();
}
