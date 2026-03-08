/**
 * Schema validation tests for shared/schema.ts
 *
 * Tests each Zod schema for:
 * - Valid input acceptance
 * - Invalid input rejection (wrong types, missing required fields)
 * - Boundary values (max lengths, min values)
 */

import { describe, it, expect } from "vitest";
import {
  personaColorSchema,
  personaPromptsSchema,
  personaSummarySchema,
  personaSchema,
  challengeSchema,
  adviceSchema,
  provocationRoundSchema,
  generateChallengeRequestSchema,
  generateAdviceRequestSchema,
  provocationSchema,
  outlineItemSchema,
  contextItemSchema,
  referenceDocumentSchema,
  writeRequestSchema,
  changeEntrySchema,
  writeResponseSchema,
  editHistoryEntrySchema,
  interviewEntrySchema,
  discussionMessageSchema,
  saveDocumentRequestSchema,
  updateDocumentRequestSchema,
  renameDocumentRequestSchema,
  createFolderRequestSchema,
  renameFolderRequestSchema,
  moveDocumentRequestSchema,
  moveFolderRequestSchema,
  streamingDialogueEntrySchema,
  streamingRequirementSchema,
  interviewQuestionRequestSchema,
} from "../../../shared/schema";

// ---------------------------------------------------------------------------
// personaColorSchema
// ---------------------------------------------------------------------------
describe("personaColorSchema", () => {
  it("accepts valid input", () => {
    const result = personaColorSchema.safeParse({
      text: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      accent: "#0891b2",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(personaColorSchema.safeParse({ text: "a" }).success).toBe(false);
    expect(personaColorSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(personaColorSchema.safeParse({ text: 123, bg: "b", accent: "c" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// personaPromptsSchema
// ---------------------------------------------------------------------------
describe("personaPromptsSchema", () => {
  it("accepts valid input", () => {
    const result = personaPromptsSchema.safeParse({ challenge: "Challenge prompt", advice: "Advice prompt" });
    expect(result.success).toBe(true);
  });

  it("rejects missing challenge", () => {
    expect(personaPromptsSchema.safeParse({ advice: "Advice" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// personaSchema
// ---------------------------------------------------------------------------
describe("personaSchema", () => {
  const validPersona = {
    id: "architect",
    label: "Architect",
    icon: "Blocks",
    role: "System design specialist",
    description: "Challenges system architecture decisions",
    color: { text: "text-cyan-600", bg: "bg-cyan-50", accent: "#0891b2" },
    prompts: { challenge: "Challenge prompt", advice: "Advice prompt" },
    summary: { challenge: "Challenges architecture", advice: "Advises on design" },
  };

  it("accepts valid persona with defaults", () => {
    const result = personaSchema.safeParse(validPersona);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isBuiltIn).toBe(true);
      expect(result.data.domain).toBe("technology");
      expect(result.data.parentId).toBe(null);
    }
  });

  it("accepts persona with all fields", () => {
    const full = {
      ...validPersona,
      isBuiltIn: false,
      domain: "business",
      parentId: "master_researcher",
      lastResearchedAt: "2026-01-01T00:00:00Z",
      humanCurated: true,
      curatedBy: "user_123",
      curatedAt: "2026-01-01T00:00:00Z",
    };
    expect(personaSchema.safeParse(full).success).toBe(true);
  });

  it("rejects missing id", () => {
    const { id, ...noId } = validPersona;
    expect(personaSchema.safeParse(noId).success).toBe(false);
  });

  it("rejects invalid domain", () => {
    expect(personaSchema.safeParse({ ...validPersona, domain: "invalid" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// challengeSchema
// ---------------------------------------------------------------------------
describe("challengeSchema", () => {
  const validChallenge = {
    id: "ch-1",
    persona: {
      id: "architect",
      label: "Architect",
      icon: "Blocks",
      role: "System design",
      description: "Challenges architecture",
      color: { text: "t", bg: "b", accent: "a" },
      prompts: { challenge: "c", advice: "a" },
      summary: { challenge: "c", advice: "a" },
    },
    title: "Missing error handling",
    content: "Your document lacks error handling strategy.",
    sourceExcerpt: "The API accepts all inputs",
    status: "pending" as const,
  };

  it("accepts valid challenge", () => {
    expect(challengeSchema.safeParse(validChallenge).success).toBe(true);
  });

  it("accepts challenge with optional scale", () => {
    expect(challengeSchema.safeParse({ ...validChallenge, scale: 4 }).success).toBe(true);
  });

  it("rejects scale out of range", () => {
    expect(challengeSchema.safeParse({ ...validChallenge, scale: 0 }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, scale: 6 }).success).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(challengeSchema.safeParse({ ...validChallenge, status: "invalid" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adviceSchema
// ---------------------------------------------------------------------------
describe("adviceSchema", () => {
  const validAdvice = {
    id: "adv-1",
    challengeId: "ch-1",
    persona: {
      id: "architect",
      label: "Architect",
      icon: "Blocks",
      role: "System design",
      description: "Desc",
      color: { text: "t", bg: "b", accent: "a" },
      prompts: { challenge: "c", advice: "a" },
      summary: { challenge: "c", advice: "a" },
    },
    content: "Consider implementing error boundaries.",
    status: "pending" as const,
  };

  it("accepts valid advice", () => {
    expect(adviceSchema.safeParse(validAdvice).success).toBe(true);
  });

  it("accepts advice with modifiedContent", () => {
    expect(adviceSchema.safeParse({ ...validAdvice, modifiedContent: "My edit" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(adviceSchema.safeParse({ ...validAdvice, status: "unknown" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateChallengeRequestSchema
// ---------------------------------------------------------------------------
describe("generateChallengeRequestSchema", () => {
  it("accepts minimal valid input", () => {
    expect(generateChallengeRequestSchema.safeParse({ document: "Some doc content" }).success).toBe(true);
  });

  it("rejects empty document", () => {
    expect(generateChallengeRequestSchema.safeParse({ document: "" }).success).toBe(false);
  });

  it("accepts with optional fields", () => {
    const result = generateChallengeRequestSchema.safeParse({
      document: "Content",
      objective: "Build a product",
      personaIds: ["architect", "ceo"],
      appType: "product-requirement",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid appType", () => {
    expect(
      generateChallengeRequestSchema.safeParse({ document: "x", appType: "nonexistent" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateAdviceRequestSchema
// ---------------------------------------------------------------------------
describe("generateAdviceRequestSchema", () => {
  it("accepts valid input", () => {
    const result = generateAdviceRequestSchema.safeParse({
      document: "Content",
      challengeId: "ch-1",
      challengeTitle: "Title",
      challengeContent: "Content",
      personaId: "architect",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(generateAdviceRequestSchema.safeParse({ document: "Content" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// writeRequestSchema
// ---------------------------------------------------------------------------
describe("writeRequestSchema", () => {
  it("accepts minimal valid input", () => {
    expect(
      writeRequestSchema.safeParse({ document: "Doc", instruction: "Expand this" }).success
    ).toBe(true);
  });

  it("rejects missing document", () => {
    expect(writeRequestSchema.safeParse({ instruction: "Expand" }).success).toBe(false);
  });

  it("rejects missing instruction", () => {
    expect(writeRequestSchema.safeParse({ document: "Doc" }).success).toBe(false);
  });

  it("accepts all optional fields", () => {
    const result = writeRequestSchema.safeParse({
      document: "Doc",
      instruction: "Expand this",
      objective: "Build a great product",
      appType: "product-requirement",
      selectedText: "some selection",
      tone: "analytical",
      targetLength: "longer",
      sessionNotes: "PM notes here",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid tone", () => {
    expect(
      writeRequestSchema.safeParse({ document: "D", instruction: "I", tone: "angry" }).success
    ).toBe(false);
  });

  it("rejects invalid targetLength", () => {
    expect(
      writeRequestSchema.safeParse({ document: "D", instruction: "I", targetLength: "huge" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveDocumentRequestSchema
// ---------------------------------------------------------------------------
describe("saveDocumentRequestSchema", () => {
  it("accepts valid input", () => {
    expect(saveDocumentRequestSchema.safeParse({ title: "My Doc", content: "Hello" }).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(saveDocumentRequestSchema.safeParse({ title: "", content: "Hello" }).success).toBe(false);
  });

  it("rejects title exceeding 200 chars", () => {
    expect(
      saveDocumentRequestSchema.safeParse({ title: "A".repeat(201), content: "Hello" }).success
    ).toBe(false);
  });

  it("accepts title at exactly 200 chars", () => {
    expect(
      saveDocumentRequestSchema.safeParse({ title: "A".repeat(200), content: "Hello" }).success
    ).toBe(true);
  });

  it("accepts optional folderId", () => {
    expect(
      saveDocumentRequestSchema.safeParse({ title: "T", content: "C", folderId: 5 }).success
    ).toBe(true);
  });

  it("accepts null folderId", () => {
    expect(
      saveDocumentRequestSchema.safeParse({ title: "T", content: "C", folderId: null }).success
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createFolderRequestSchema
// ---------------------------------------------------------------------------
describe("createFolderRequestSchema", () => {
  it("accepts valid input", () => {
    expect(createFolderRequestSchema.safeParse({ name: "My Folder" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createFolderRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects name exceeding 200 chars", () => {
    expect(createFolderRequestSchema.safeParse({ name: "A".repeat(201) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// moveDocumentRequestSchema / moveFolderRequestSchema
// ---------------------------------------------------------------------------
describe("moveDocumentRequestSchema", () => {
  it("accepts numeric folderId", () => {
    expect(moveDocumentRequestSchema.safeParse({ folderId: 5 }).success).toBe(true);
  });

  it("accepts null folderId (move to root)", () => {
    expect(moveDocumentRequestSchema.safeParse({ folderId: null }).success).toBe(true);
  });

  it("rejects missing folderId", () => {
    expect(moveDocumentRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("moveFolderRequestSchema", () => {
  it("accepts numeric parentFolderId", () => {
    expect(moveFolderRequestSchema.safeParse({ parentFolderId: 3 }).success).toBe(true);
  });

  it("accepts null parentFolderId", () => {
    expect(moveFolderRequestSchema.safeParse({ parentFolderId: null }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// contextItemSchema
// ---------------------------------------------------------------------------
describe("contextItemSchema", () => {
  it("accepts text type", () => {
    expect(
      contextItemSchema.safeParse({ id: "1", type: "text", content: "Note", createdAt: 123 }).success
    ).toBe(true);
  });

  it("accepts image type", () => {
    expect(
      contextItemSchema.safeParse({ id: "2", type: "image", content: "data:image/png;base64,...", createdAt: 123 }).success
    ).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(
      contextItemSchema.safeParse({ id: "3", type: "video", content: "x", createdAt: 123 }).success
    ).toBe(false);
  });

  it("accepts optional annotation", () => {
    const result = contextItemSchema.safeParse({
      id: "4", type: "text", content: "Note", annotation: "Matters because...", createdAt: 123,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// referenceDocumentSchema
// ---------------------------------------------------------------------------
describe("referenceDocumentSchema", () => {
  it("accepts style type", () => {
    expect(
      referenceDocumentSchema.safeParse({ id: "r1", name: "Guide", content: "...", type: "style" }).success
    ).toBe(true);
  });

  it("accepts template type", () => {
    expect(
      referenceDocumentSchema.safeParse({ id: "r2", name: "Template", content: "...", type: "template" }).success
    ).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(
      referenceDocumentSchema.safeParse({ id: "r3", name: "Doc", content: "...", type: "example" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// interviewEntrySchema
// ---------------------------------------------------------------------------
describe("interviewEntrySchema", () => {
  it("accepts valid entry", () => {
    expect(
      interviewEntrySchema.safeParse({
        id: "ie-1", question: "What?", answer: "This.", topic: "Design", timestamp: 1000,
      }).success
    ).toBe(true);
  });

  it("rejects missing question", () => {
    expect(
      interviewEntrySchema.safeParse({ id: "ie-1", answer: "This.", topic: "Design", timestamp: 1000 }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// streamingDialogueEntrySchema / streamingRequirementSchema
// ---------------------------------------------------------------------------
describe("streamingDialogueEntrySchema", () => {
  it("accepts agent role", () => {
    expect(
      streamingDialogueEntrySchema.safeParse({ id: "d1", role: "agent", content: "Question?", timestamp: 1 }).success
    ).toBe(true);
  });

  it("accepts user role", () => {
    expect(
      streamingDialogueEntrySchema.safeParse({ id: "d2", role: "user", content: "Answer", timestamp: 2 }).success
    ).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(
      streamingDialogueEntrySchema.safeParse({ id: "d3", role: "system", content: "x", timestamp: 3 }).success
    ).toBe(false);
  });
});

describe("streamingRequirementSchema", () => {
  it("accepts valid requirement", () => {
    expect(
      streamingRequirementSchema.safeParse({ id: "r1", text: "Must support...", status: "draft", timestamp: 1 }).success
    ).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      streamingRequirementSchema.safeParse({ id: "r1", text: "x", status: "approved", timestamp: 1 }).success
    ).toBe(false);
  });
});
