/**
 * Context Store — Isolated microservice for encrypted document/folder storage.
 *
 * Usage:
 *   import { createContextStoreRouter, ContextStoreStorage } from 'services/context-store';
 *
 *   const storage = new ContextStoreStorage(db, { documents, folders, activeContext });
 *   const router = createContextStoreRouter({ getAuth, encryptionKey }, storage);
 *   app.use('/api', router);
 *
 * The service is completely self-contained:
 * - Own types, schemas, and validation (Zod)
 * - Own encryption layer (AES-256-GCM with PBKDF2 + LRU cache)
 * - Own storage class (accepts any Drizzle db instance)
 * - Own Express router (accepts auth config)
 * - Active context persistence (hot storage → cold store reflection)
 */

// Public API
export { createContextStoreRouter } from "./routes";
export { ContextStoreStorage } from "./storage";
export type { ContextStoreTables } from "./storage";

// Types
export type {
  DocumentListItem,
  DocumentPayload,
  FolderItem,
  ActiveContextItem,
  StoredDocument,
  StoredFolder,
  EncryptedPayload,
  ContextStoreConfig,
  SaveDocumentRequest,
  UpdateDocumentRequest,
  RenameDocumentRequest,
  MoveDocumentRequest,
  CreateFolderRequest,
  RenameFolderRequest,
  MoveFolderRequest,
  SetActiveContextRequest,
} from "./types";

// Schemas (for consumers who need to validate outside the router)
export {
  saveDocumentRequestSchema,
  updateDocumentRequestSchema,
  renameDocumentRequestSchema,
  moveDocumentRequestSchema,
  createFolderRequestSchema,
  renameFolderRequestSchema,
  moveFolderRequestSchema,
  setActiveContextRequestSchema,
} from "./types";

// Crypto (for consumers who need encryption outside the router)
export {
  encrypt,
  decrypt,
  encryptAsync,
  decryptAsync,
  decryptFieldAsync,
  decryptField,
} from "./crypto";
