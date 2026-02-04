import { randomUUID } from "crypto";
import type { Document } from "@shared/schema";

export interface IStorage {
  createDocument(rawText: string): Promise<Document>;
}

export class MemStorage implements IStorage {
  private documents: Map<string, Document>;

  constructor() {
    this.documents = new Map();
  }

  async createDocument(rawText: string): Promise<Document> {
    const id = randomUUID();
    const document: Document = { id, rawText };
    this.documents.set(id, document);
    return document;
  }
}

export const storage = new MemStorage();
