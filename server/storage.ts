import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
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

const DATA_DIR = path.join(process.cwd(), "data");
const DOCS_FILE = path.join(DATA_DIR, "documents.json");

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
  deleteDocument(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  // Transient workspace documents (in-memory only)
  private documents: Map<string, Document>;
  // Persistent encrypted documents (file-backed)
  private storedDocuments: Map<number, StoredDocument>;
  private nextDocId: number;

  constructor() {
    this.documents = new Map();
    this.storedDocuments = new Map();
    this.nextDocId = 1;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DOCS_FILE)) {
        const raw = fs.readFileSync(DOCS_FILE, "utf8");
        const data = JSON.parse(raw) as {
          nextId: number;
          documents: StoredDocument[];
        };
        this.nextDocId = data.nextId;
        for (const doc of data.documents) {
          this.storedDocuments.set(doc.id, doc);
        }
      }
    } catch (err) {
      console.error("Failed to load documents from disk:", err);
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        nextId: this.nextDocId,
        documents: Array.from(this.storedDocuments.values()),
      };
      fs.writeFileSync(DOCS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save documents to disk:", err);
    }
  }

  async createDocument(rawText: string): Promise<Document> {
    const id = randomUUID();
    const document: Document = { id, rawText };
    this.documents.set(id, document);
    return document;
  }

  async saveDocument(data: {
    userId: string;
    title: string;
    ciphertext: string;
    salt: string;
    iv: string;
  }): Promise<{ id: number; createdAt: string }> {
    const id = this.nextDocId++;
    const now = new Date().toISOString();
    const doc: StoredDocument = {
      id,
      userId: data.userId,
      title: data.title,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      createdAt: now,
      updatedAt: now,
    };
    this.storedDocuments.set(id, doc);
    this.saveToDisk();
    return { id, createdAt: now };
  }

  async listDocuments(userId: string): Promise<DocumentListItem[]> {
    return Array.from(this.storedDocuments.values())
      .filter((d) => d.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
  }

  async getDocument(id: number): Promise<StoredDocument | null> {
    return this.storedDocuments.get(id) ?? null;
  }

  async updateDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string }
  ): Promise<{ id: number; updatedAt: string } | null> {
    const existing = this.storedDocuments.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: StoredDocument = {
      ...existing,
      title: data.title,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      updatedAt: now,
    };
    this.storedDocuments.set(id, updated);
    this.saveToDisk();
    return { id, updatedAt: now };
  }

  async deleteDocument(id: number): Promise<void> {
    this.storedDocuments.delete(id);
    this.saveToDisk();
  }
}

export const storage = new MemStorage();
