/**
 * Integration tests: protected endpoints return 401 without authentication.
 *
 * The Clerk requireAuth() middleware (applied in server/index.ts) rejects
 * unauthenticated requests to /api/* routes before they reach route handlers.
 * These tests verify that behaviour by standing up a minimal Express app with
 * the same middleware chain and hitting key endpoints without auth headers.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock @clerk/express — the real middleware talks to Clerk's API.
// We replace it with a lightweight version:
//   - clerkMiddleware(): no-op (attaches nothing)
//   - requireAuth(): returns 401 when getAuth yields no userId
//   - getAuth(): returns { userId: null } (unauthenticated)
// ---------------------------------------------------------------------------
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: () => (req: any, res: any, next: any) => {
    // Simulate Clerk's requireAuth — reject if no userId
    const auth = (req as any).__test_auth || { userId: null };
    if (!auth.userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    next();
  },
  getAuth: (req: any) => (req as any).__test_auth || { userId: null },
  clerkClient: {},
}));

// Mock heavy dependencies that routes.ts imports so the module loads quickly
// and without requiring real database / LLM connections.
vi.mock('../storage', () => ({
  storage: {},
}));

vi.mock('../db', () => ({
  db: {},
  ensureTables: vi.fn(),
}));

vi.mock('../llm', () => ({
  llm: { generate: vi.fn(), stream: vi.fn() },
  discoverModels: vi.fn(),
}));

vi.mock('../llm-gateway', () => ({
  runWithGateway: vi.fn((_ctx: any, fn: () => Promise<void>) => fn()),
  isVerboseEnabled: vi.fn().mockResolvedValue(false),
  getActiveScope: vi.fn(),
}));

vi.mock('../blueprints', () => ({
  BLUEPRINTS: [],
  getBlueprint: vi.fn(),
}));

vi.mock('../canvas-collab', () => ({
  broadcastToCanvasRoom: vi.fn(),
  setupCanvasWebSocket: vi.fn(),
  setSaveCanvasCallback: vi.fn(),
}));

vi.mock('../usage', () => ({
  getUsageSummary: vi.fn(),
  getUserPlan: vi.fn(),
  PLAN_LIMITS: {},
  requireUsage: () => (_req: any, _res: any, next: any) => next(),
  recordUsage: vi.fn(),
}));

vi.mock('../invoke', () => ({
  invoke: vi.fn(),
  TASK_TYPES: {},
  BASE_PROMPTS: {},
}));

vi.mock('../context-builder', () => ({
  getAppTypeConfig: vi.fn(),
  formatAppTypeContext: vi.fn(),
}));

vi.mock('../agent-executor', () => ({
  executeAgent: vi.fn(),
}));

vi.mock('../oauth-config', () => ({
  SUPPORTED_PLATFORMS: [],
  PLATFORM_CONFIG: {},
  getRedirectUri: vi.fn(),
  isPlatformConfigured: vi.fn(),
  getClientCredentials: vi.fn(),
}));

vi.mock('../platform-auth', () => ({
  getValidToken: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock('../social-poster', () => ({
  postToPlatform: vi.fn(),
}));

vi.mock('../replit_integrations/audio/client', () => ({
  textToSpeech: vi.fn(),
}));

vi.mock('../event-bus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
}));

vi.mock('../env', () => ({
  validateEnv: vi.fn(),
}));

vi.mock('../../services/context-store', () => ({
  createContextStoreRouter: vi.fn(() => express.Router()),
  ContextStoreStorage: vi.fn(),
}));

vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: { fetchTranscript: vi.fn() },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({})),
}));

vi.mock('../logger', () => ({
  requestLogger: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../client/src/lib/version', () => ({
  APP_VERSION: '0.0.0-test',
}));

vi.mock('express-rate-limit', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('@shared/personas', () => ({
  builtInPersonas: [],
  getPersonaById: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Build the Express app with the same middleware chain as server/index.ts
// ---------------------------------------------------------------------------
let app: express.Express;
let httpServer: Server;

beforeAll(async () => {
  // Set env vars that validateEnv / getEncryptionKey check
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  process.env.ENCRYPTION_SECRET = 'test-secret-key-for-integration-tests';
  process.env.CLERK_SECRET_KEY = 'sk_test_fake';

  app = express();
  app.use(express.json());

  // Reproduce the middleware chain from server/index.ts
  const { clerkMiddleware, requireAuth } = await import('@clerk/express');
  app.use(clerkMiddleware());

  // requireAuth on all /api except health, clerk-config, webhook
  app.use('/api', (req, _res, next) => {
    if (
      req.path === '/clerk-config' ||
      req.path === '/stripe/webhook' ||
      req.path === '/health' ||
      req.path.startsWith('/webhook/')
    ) {
      return next();
    }
    return requireAuth()(req, _res, next);
  });

  httpServer = createServer(app);

  // Register routes (the real route definitions)
  const { registerRoutes } = await import('../routes');
  await registerRoutes(httpServer, app);
});

afterAll(() => {
  httpServer?.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Auth guard — endpoints return 401 without authentication', () => {
  // Core document endpoints
  it('GET /api/documents returns 401', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('POST /api/documents returns 401', async () => {
    const res = await request(app).post('/api/documents').send({
      title: 'Test',
      content: 'Test content',
    });
    expect(res.status).toBe(401);
  });

  // Core folder endpoints
  it('GET /api/folders returns 401', async () => {
    const res = await request(app).get('/api/folders');
    expect(res.status).toBe(401);
  });

  // LLM-powered endpoints
  it('POST /api/write returns 401', async () => {
    const res = await request(app).post('/api/write').send({
      content: 'test',
      instructions: 'expand',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/generate-challenges returns 401', async () => {
    const res = await request(app).post('/api/generate-challenges').send({
      content: 'test',
    });
    expect(res.status).toBe(401);
  });

  // Newly-protected endpoints
  it('POST /api/text-to-visual returns 401', async () => {
    const res = await request(app).post('/api/text-to-visual').send({
      text: 'test',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/discussion/ask returns 401', async () => {
    const res = await request(app).post('/api/discussion/ask').send({
      question: 'test',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/transcribe returns 401', async () => {
    const res = await request(app).post('/api/transcribe').send({
      text: 'test',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/generate-sample-objective returns 401', async () => {
    const res = await request(app).post('/api/generate-sample-objective').send({});
    expect(res.status).toBe(401);
  });

  // Public endpoints should still be accessible
  it('GET /api/health is NOT blocked (public)', async () => {
    // Health endpoint is excluded from requireAuth
    const res = await request(app).get('/api/health');
    // It may return 503 (no real DB), but not 401
    expect(res.status).not.toBe(401);
  });
});
