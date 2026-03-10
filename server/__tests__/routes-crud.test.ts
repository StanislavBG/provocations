/**
 * Integration tests: document and folder CRUD with mocked auth.
 *
 * These tests verify that document and folder endpoints work correctly
 * when the user is authenticated. Auth is mocked so getAuth() returns
 * a test userId, and storage methods are stubbed to avoid needing a
 * real database.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import request from 'supertest';

const TEST_USER_ID = 'user_test_123';

// ---------------------------------------------------------------------------
// Mock @clerk/express — authenticated user
// ---------------------------------------------------------------------------
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: () => (req: any, _res: any, next: any) => {
    // Inject auth for all requests (simulates authenticated user)
    (req as any).__test_auth = { userId: TEST_USER_ID };
    next();
  },
  getAuth: (req: any) => (req as any).__test_auth || { userId: TEST_USER_ID },
  clerkClient: {
    users: {
      getUser: vi.fn().mockResolvedValue({ emailAddresses: [] }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock storage — in-memory stubs for document and folder operations
// ---------------------------------------------------------------------------
const mockStorage = {
  saveDocument: vi.fn(),
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocumentForUser: vi.fn(),
  createFolder: vi.fn(),
  listFolders: vi.fn(),
  renameDocumentForUser: vi.fn(),
  moveDocumentForUser: vi.fn(),
  renameFolderForUser: vi.fn(),
  moveFolderForUser: vi.fn(),
  deleteFolderForUser: vi.fn(),
  // Stubs for other storage methods that routes.ts may reference at import time
  getVerboseMode: vi.fn().mockResolvedValue(false),
  getUserPreferences: vi.fn().mockResolvedValue(null),
  setUserPreferences: vi.fn(),
  listConnections: vi.fn().mockResolvedValue([]),
  getActiveSubscription: vi.fn().mockResolvedValue(null),
  getUsageForPeriod: vi.fn().mockResolvedValue([]),
};

vi.mock('../storage', () => ({
  storage: mockStorage,
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
// Build the Express app
// ---------------------------------------------------------------------------
let app: express.Express;
let httpServer: Server;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  process.env.ENCRYPTION_SECRET = 'test-secret-key-for-integration-tests';
  process.env.CLERK_SECRET_KEY = 'sk_test_fake';

  app = express();
  app.use(express.json());

  const { clerkMiddleware, requireAuth } = await import('@clerk/express');
  app.use(clerkMiddleware());

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

  const { registerRoutes } = await import('../routes');
  await registerRoutes(httpServer, app);
});

afterAll(() => {
  httpServer?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Document CRUD tests
// ---------------------------------------------------------------------------
describe('Document CRUD — authenticated', () => {
  it('POST /api/documents creates a document and returns id', async () => {
    mockStorage.saveDocument.mockResolvedValue({
      id: 42,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/documents')
      .send({ title: 'Test Doc', content: '<p>Hello world</p>' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 42);
    expect(res.body).toHaveProperty('createdAt');
    expect(mockStorage.saveDocument).toHaveBeenCalledOnce();

    // Verify the storage call received encrypted data (not plaintext)
    const callArgs = mockStorage.saveDocument.mock.calls[0][0];
    expect(callArgs.userId).toBe(TEST_USER_ID);
    expect(callArgs.title).toBe('[encrypted]');
    expect(callArgs.ciphertext).toBeTruthy();
    expect(callArgs.salt).toBeTruthy();
    expect(callArgs.iv).toBeTruthy();
  });

  it('GET /api/documents lists documents for the authenticated user', async () => {
    mockStorage.listDocuments.mockResolvedValue([
      {
        id: 1,
        title: 'Plaintext Fallback Title',
        titleCiphertext: null,
        titleSalt: null,
        titleIv: null,
        folderId: null,
        docType: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);

    const res = await request(app).get('/api/documents');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('documents');
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].id).toBe(1);
    // Legacy plaintext fallback: title should come back as-is
    expect(res.body.documents[0].title).toBe('Plaintext Fallback Title');
    expect(mockStorage.listDocuments).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('GET /api/documents/:id loads a specific document', async () => {
    // We need to provide encrypted content that can actually be decrypted
    const { encrypt } = await import('../crypto');
    const key = process.env.ENCRYPTION_SECRET!;
    const encContent = encrypt('<p>Secret content</p>', key);
    const encTitle = encrypt('My Secret Doc', key);

    mockStorage.getDocument.mockResolvedValue({
      id: 10,
      userId: TEST_USER_ID,
      title: '[encrypted]',
      titleCiphertext: encTitle.ciphertext,
      titleSalt: encTitle.salt,
      titleIv: encTitle.iv,
      ciphertext: encContent.ciphertext,
      salt: encContent.salt,
      iv: encContent.iv,
      folderId: null,
      locked: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });

    const res = await request(app).get('/api/documents/10');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 10);
    expect(res.body).toHaveProperty('title', 'My Secret Doc');
    expect(res.body).toHaveProperty('content', '<p>Secret content</p>');
    expect(mockStorage.getDocument).toHaveBeenCalledWith(10);
  });

  it('DELETE /api/documents/:id deletes a document', async () => {
    mockStorage.deleteDocumentForUser.mockResolvedValue(true);

    const res = await request(app).delete('/api/documents/10');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockStorage.deleteDocumentForUser).toHaveBeenCalledWith(10, TEST_USER_ID);
  });

  it('DELETE /api/documents/:id returns 404 when not found', async () => {
    mockStorage.deleteDocumentForUser.mockResolvedValue(false);

    const res = await request(app).delete('/api/documents/999');

    expect(res.status).toBe(404);
  });

  it('POST /api/documents returns 400 with invalid body', async () => {
    // Missing required "content" field
    const res = await request(app)
      .post('/api/documents')
      .send({ title: 'No Content' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Folder CRUD tests
// ---------------------------------------------------------------------------
describe('Folder CRUD — authenticated', () => {
  it('POST /api/folders creates a folder and returns it', async () => {
    mockStorage.createFolder.mockResolvedValue({
      id: 5,
      name: '[encrypted]',
      parentFolderId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/folders')
      .send({ name: 'My Folder' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 5);
    // The response should return the decrypted name (not [encrypted])
    expect(res.body).toHaveProperty('name', 'My Folder');
    expect(mockStorage.createFolder).toHaveBeenCalledOnce();

    // Verify encryption was applied
    const callArgs = mockStorage.createFolder.mock.calls[0];
    expect(callArgs[0]).toBe(TEST_USER_ID);         // userId
    expect(callArgs[1]).toBe('[encrypted]');          // encrypted name placeholder
    expect(callArgs[2]).toBeNull();                   // parentFolderId
    expect(callArgs[3]).toHaveProperty('nameCiphertext');
    expect(callArgs[3]).toHaveProperty('nameSalt');
    expect(callArgs[3]).toHaveProperty('nameIv');
  });

  it('GET /api/folders lists folders for the authenticated user', async () => {
    mockStorage.listFolders.mockResolvedValue([
      {
        id: 1,
        name: 'Plaintext Folder',
        nameCiphertext: null,
        nameSalt: null,
        nameIv: null,
        parentFolderId: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);

    const res = await request(app).get('/api/folders');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('folders');
    expect(res.body.folders).toHaveLength(1);
    expect(res.body.folders[0].id).toBe(1);
    // Legacy plaintext fallback
    expect(res.body.folders[0].name).toBe('Plaintext Folder');
  });

  it('POST /api/folders returns 400 with missing name', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({});

    expect(res.status).toBe(400);
  });
});
