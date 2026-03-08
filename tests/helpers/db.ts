/**
 * Test database helpers.
 *
 * Uses a transaction-rollback pattern for test isolation:
 * each test runs inside a transaction that is rolled back
 * after the test completes, leaving the database unchanged.
 *
 * For unit tests that don't need a real database, use the
 * mock storage helpers instead.
 */

/**
 * Mock storage object for unit tests that don't need a real DB.
 * Provides in-memory implementations of common storage methods.
 */
export function createMockStorage() {
  const documents = new Map<number, {
    id: number;
    title: string;
    content: string;
    userId: string;
    folderId: number | null;
    createdAt: Date;
    updatedAt: Date;
  }>();

  const folders = new Map<number, {
    id: number;
    name: string;
    userId: string;
    parentFolderId: number | null;
    createdAt: Date;
    updatedAt: Date;
  }>();

  let nextDocId = 1;
  let nextFolderId = 1;

  return {
    documents,
    folders,

    async getDocumentsByUserId(userId: string) {
      return Array.from(documents.values()).filter(d => d.userId === userId);
    },

    async getDocument(id: number) {
      return documents.get(id) ?? null;
    },

    async createDocument(data: { title: string; content: string; userId: string; folderId?: number | null }) {
      const doc = {
        id: nextDocId++,
        title: data.title,
        content: data.content,
        userId: data.userId,
        folderId: data.folderId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      documents.set(doc.id, doc);
      return doc;
    },

    async deleteDocument(id: number) {
      documents.delete(id);
    },

    async createFolder(data: { name: string; userId: string; parentFolderId?: number | null }) {
      const folder = {
        id: nextFolderId++,
        name: data.name,
        userId: data.userId,
        parentFolderId: data.parentFolderId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      folders.set(folder.id, folder);
      return folder;
    },

    async getUserPreferences(_userId: string) {
      return { verboseMode: false };
    },

    async insertLlmCallLog(_data: Record<string, unknown>) {
      // no-op for tests
    },

    reset() {
      documents.clear();
      folders.clear();
      nextDocId = 1;
      nextFolderId = 1;
    },
  };
}

export type MockStorage = ReturnType<typeof createMockStorage>;
