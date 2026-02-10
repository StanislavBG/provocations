import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type {
  Document,
  EncryptedDocumentListItem,
  EncryptedDocumentFull,
} from "@shared/schema";

interface StoredEncryptedDocument {
  id: number;
  ownerHash: string;
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
  saveEncryptedDocument(data: {
    ownerHash: string;
    title: string;
    ciphertext: string;
    salt: string;
    iv: string;
  }): Promise<{ id: number; createdAt: string }>;
  listEncryptedDocuments(ownerHash: string): Promise<EncryptedDocumentListItem[]>;
  getEncryptedDocument(id: number): Promise<EncryptedDocumentFull | null>;
  updateEncryptedDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string }
  ): Promise<{ id: number; updatedAt: string } | null>;
  deleteEncryptedDocument(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  // Transient workspace documents (in-memory only)
  private documents: Map<string, Document>;
  // Persistent encrypted documents (file-backed)
  private encryptedDocuments: Map<number, StoredEncryptedDocument>;
  private nextEncryptedId: number;

  constructor() {
    this.documents = new Map();
    this.encryptedDocuments = new Map();
    this.nextEncryptedId = 1;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DOCS_FILE)) {
        const raw = fs.readFileSync(DOCS_FILE, "utf8");
        const data = JSON.parse(raw) as {
          nextId: number;
          documents: StoredEncryptedDocument[];
        };
        this.nextEncryptedId = data.nextId;
        for (const doc of data.documents) {
          this.encryptedDocuments.set(doc.id, doc);
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
        nextId: this.nextEncryptedId,
        documents: Array.from(this.encryptedDocuments.values()),
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

  async saveEncryptedDocument(data: {
    ownerHash: string;
    title: string;
    ciphertext: string;
    salt: string;
    iv: string;
  }): Promise<{ id: number; createdAt: string }> {
    const id = this.nextEncryptedId++;
    const now = new Date().toISOString();
    const doc: StoredEncryptedDocument = {
      id,
      ownerHash: data.ownerHash,
      title: data.title,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      createdAt: now,
      updatedAt: now,
    };
    this.encryptedDocuments.set(id, doc);
    this.saveToDisk();
    return { id, createdAt: now };
  }

  async listEncryptedDocuments(ownerHash: string): Promise<EncryptedDocumentListItem[]> {
    return Array.from(this.encryptedDocuments.values())
      .filter((d) => d.ownerHash === ownerHash)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
  }

  async getEncryptedDocument(id: number): Promise<EncryptedDocumentFull | null> {
    const doc = this.encryptedDocuments.get(id);
    if (!doc) return null;
    return {
      id: doc.id,
      title: doc.title,
      ciphertext: doc.ciphertext,
      salt: doc.salt,
      iv: doc.iv,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async updateEncryptedDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string }
  ): Promise<{ id: number; updatedAt: string } | null> {
    const existing = this.encryptedDocuments.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: StoredEncryptedDocument = {
      ...existing,
      title: data.title,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      updatedAt: now,
    };
    this.encryptedDocuments.set(id, updated);
    this.saveToDisk();
    return { id, updatedAt: now };
  }

  async deleteEncryptedDocument(id: number): Promise<void> {
    this.encryptedDocuments.delete(id);
    this.saveToDisk();
  }
}

export const storage = new MemStorage();
