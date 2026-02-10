import { randomUUID } from "crypto";
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
  createdAt: Date;
  updatedAt: Date;
}

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
  private documents: Map<string, Document>;
  private encryptedDocuments: Map<number, StoredEncryptedDocument>;
  private nextEncryptedId: number;

  constructor() {
    this.documents = new Map();
    this.encryptedDocuments = new Map();
    this.nextEncryptedId = 1;
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
    const now = new Date();
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
    return { id, createdAt: now.toISOString() };
  }

  async listEncryptedDocuments(ownerHash: string): Promise<EncryptedDocumentListItem[]> {
    const docs = Array.from(this.encryptedDocuments.values())
      .filter((d) => d.ownerHash === ownerHash)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }));
    return docs;
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
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async updateEncryptedDocument(
    id: number,
    data: { title: string; ciphertext: string; salt: string; iv: string }
  ): Promise<{ id: number; updatedAt: string } | null> {
    const existing = this.encryptedDocuments.get(id);
    if (!existing) return null;
    const now = new Date();
    const updated: StoredEncryptedDocument = {
      ...existing,
      title: data.title,
      ciphertext: data.ciphertext,
      salt: data.salt,
      iv: data.iv,
      updatedAt: now,
    };
    this.encryptedDocuments.set(id, updated);
    return { id, updatedAt: now.toISOString() };
  }

  async deleteEncryptedDocument(id: number): Promise<void> {
    this.encryptedDocuments.delete(id);
  }
}

export const storage = new MemStorage();
