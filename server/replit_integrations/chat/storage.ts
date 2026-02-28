import { db } from "../../db";
import { conversations, messages } from "@shared/models/chat";
import { eq, desc } from "drizzle-orm";

// NOTE: This Replit integration uses a simplified chat model (title, role, content)
// that predates the current encrypted messaging schema. The type assertions below
// allow this integration to compile while the main app uses the encrypted schema.

interface SimpleChatConversation {
  id: number;
  title: string;
  createdAt: Date;
}

interface SimpleChatMessage {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

export interface IChatStorage {
  getConversation(id: number): Promise<SimpleChatConversation | undefined>;
  getAllConversations(): Promise<SimpleChatConversation[]>;
  createConversation(title: string): Promise<SimpleChatConversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<SimpleChatMessage[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<SimpleChatMessage>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation as unknown as SimpleChatConversation | undefined;
  },

  async getAllConversations() {
    const rows = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
    return rows as unknown as SimpleChatConversation[];
  },

  async createConversation(title: string) {
    const [conversation] = await (db.insert(conversations) as any).values({ title }).returning();
    return conversation as SimpleChatConversation;
  },

  async deleteConversation(id: number) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    const rows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
    return rows as unknown as SimpleChatMessage[];
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await (db.insert(messages) as any).values({ conversationId, role, content }).returning();
    return message as SimpleChatMessage;
  },
};

