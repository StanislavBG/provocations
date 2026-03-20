/**
 * Context builder tests for server/context-builder.ts
 *
 * Tests the context assembly pipeline:
 * - formatDocument truncation
 * - formatObjective construction
 * - buildContext with various input combinations
 * - Character limit enforcement
 * - App-type config lookup
 */

import { describe, it, expect } from "vitest";
import {
  formatDocument,
  formatObjective,
  formatEditHistory,
  formatInterviewEntries,
  formatDiscussionHistory,
  formatDialogueEntries,
  formatReferenceDocuments,
  formatCapturedContext,
  formatRequirements,
  formatWireframeContext,
  formatPersonaContext,
  formatAppTypeContext,
  getAppTypeConfig,
  buildContext,
  LIMITS,
  type ContextInput,
} from "../../../server/context-builder";

// ---------------------------------------------------------------------------
// formatDocument
// ---------------------------------------------------------------------------
describe("formatDocument", () => {
  it("returns empty string for undefined", () => {
    expect(formatDocument(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatDocument("")).toBe("");
  });

  it("returns empty string for whitespace-only", () => {
    expect(formatDocument("   \n\t  ")).toBe("");
  });

  it("returns document unchanged when under limit", () => {
    const doc = "Short document";
    expect(formatDocument(doc)).toBe(doc);
  });

  it("truncates document at LIMITS.document by default", () => {
    const doc = "A".repeat(LIMITS.document + 100);
    const result = formatDocument(doc);
    expect(result.length).toBeLessThan(doc.length);
    expect(result).toContain(`truncated at ${LIMITS.document} chars`);
  });

  it("respects custom maxLen", () => {
    const doc = "A".repeat(200);
    const result = formatDocument(doc, 100);
    expect(result).toContain("truncated at 100 chars");
  });

  it("does not truncate at exact limit", () => {
    const doc = "A".repeat(LIMITS.document);
    expect(formatDocument(doc)).toBe(doc);
  });
});

// ---------------------------------------------------------------------------
// formatObjective
// ---------------------------------------------------------------------------
describe("formatObjective", () => {
  it("returns empty string for undefined objective", () => {
    expect(formatObjective(undefined)).toBe("");
  });

  it("formats single objective", () => {
    const result = formatObjective("Build a great product");
    expect(result).toBe("DOCUMENT OBJECTIVE: Build a great product");
  });

  it("includes secondary objective when provided", () => {
    const result = formatObjective("Primary goal", "Secondary goal");
    expect(result).toContain("DOCUMENT OBJECTIVE: Primary goal");
    expect(result).toContain("SECONDARY OBJECTIVE: Secondary goal");
  });

  it("ignores empty secondary objective", () => {
    const result = formatObjective("Primary", "  ");
    expect(result).not.toContain("SECONDARY");
  });
});

// ---------------------------------------------------------------------------
// formatEditHistory
// ---------------------------------------------------------------------------
describe("formatEditHistory", () => {
  it("returns empty string for undefined", () => {
    expect(formatEditHistory(undefined)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(formatEditHistory([])).toBe("");
  });

  it("formats entries with instruction type", () => {
    const entries = [
      { instruction: "Make it more concise", instructionType: "condense" as const, summary: "Condensed", timestamp: 1000 },
    ];
    const result = formatEditHistory(entries);
    expect(result).toContain("RECENT EDIT HISTORY");
    expect(result).toContain("[condense]");
  });

  it("limits to maxEntries", () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      instruction: `Edit ${i}`,
      instructionType: "general" as const,
      summary: `Summary ${i}`,
      timestamp: i,
    }));
    const result = formatEditHistory(entries, 3);
    // Should only include last 3
    expect(result).toContain("Edit 7");
    expect(result).toContain("Edit 8");
    expect(result).toContain("Edit 9");
    expect(result).not.toContain("Edit 0");
  });

  it("truncates long instructions at 80 chars", () => {
    const entries = [{
      instruction: "A".repeat(100),
      instructionType: "expand" as const,
      summary: "Summary",
      timestamp: 1000,
    }];
    const result = formatEditHistory(entries);
    expect(result).toContain("...");
  });
});

// ---------------------------------------------------------------------------
// formatInterviewEntries
// ---------------------------------------------------------------------------
describe("formatInterviewEntries", () => {
  it("returns empty string for undefined", () => {
    expect(formatInterviewEntries(undefined)).toBe("");
  });

  it("formats Q&A entries", () => {
    const entries = [
      { id: "1", question: "What is the goal?", answer: "Build a product", topic: "Vision", timestamp: 1 },
    ];
    const result = formatInterviewEntries(entries);
    expect(result).toContain("Topic: Vision");
    expect(result).toContain("Q: What is the goal?");
    expect(result).toContain("A: Build a product");
  });
});

// ---------------------------------------------------------------------------
// formatCapturedContext
// ---------------------------------------------------------------------------
describe("formatCapturedContext", () => {
  it("returns empty string for undefined", () => {
    expect(formatCapturedContext(undefined)).toBe("");
  });

  it("formats text items", () => {
    const items = [
      { id: "1", type: "text" as const, content: "A note", createdAt: 1 },
    ];
    const result = formatCapturedContext(items);
    expect(result).toContain("CAPTURED CONTEXT");
    expect(result).toContain("[TEXT]");
    expect(result).toContain("A note");
  });

  it("formats image items", () => {
    const items = [
      { id: "2", type: "image" as const, content: "data:image/png;base64,...", createdAt: 1 },
    ];
    const result = formatCapturedContext(items);
    expect(result).toContain("[IMAGE]");
  });

  it("includes annotations", () => {
    const items = [
      { id: "3", type: "text" as const, content: "Note", annotation: "Important because X", createdAt: 1 },
    ];
    const result = formatCapturedContext(items);
    expect(result).toContain("Why it matters: Important because X");
  });

  it("truncates long text items at 500 chars", () => {
    const items = [
      { id: "4", type: "text" as const, content: "B".repeat(600), createdAt: 1 },
    ];
    const result = formatCapturedContext(items);
    expect(result).toContain("...");
  });
});

// ---------------------------------------------------------------------------
// formatRequirements
// ---------------------------------------------------------------------------
describe("formatRequirements", () => {
  it("returns empty string for undefined", () => {
    expect(formatRequirements(undefined)).toBe("");
  });

  it("formats requirements with status", () => {
    const reqs = [
      { id: "r1", text: "Must support mobile", status: "confirmed" as const, timestamp: 1 },
    ];
    const result = formatRequirements(reqs);
    expect(result).toContain("[confirmed] Must support mobile");
  });
});

// ---------------------------------------------------------------------------
// getAppTypeConfig / formatAppTypeContext
// ---------------------------------------------------------------------------
describe("getAppTypeConfig", () => {
  it("returns undefined for undefined appType", () => {
    expect(getAppTypeConfig(undefined)).toBeUndefined();
  });

  it("returns undefined for unknown appType", () => {
    expect(getAppTypeConfig("nonexistent")).toBeUndefined();
  });

  it("returns config for product-requirement", () => {
    const config = getAppTypeConfig("product-requirement");
    expect(config).toBeDefined();
    expect(config!.documentType).toBe("product requirement document");
  });

  it("returns config for email-composer", () => {
    const config = getAppTypeConfig("email-composer");
    expect(config).toBeDefined();
    expect(config!.outputFormat).toBe("email");
  });

  it("returns config for write-a-prompt", () => {
    const config = getAppTypeConfig("write-a-prompt");
    expect(config).toBeDefined();
    expect(config!.documentType).toBe("AI prompt");
  });
});

describe("formatAppTypeContext", () => {
  it("returns empty string for undefined", () => {
    expect(formatAppTypeContext(undefined)).toBe("");
  });

  it("returns system guidance for valid appType", () => {
    const result = formatAppTypeContext("product-requirement");
    expect(result).toContain("APPLICATION CONTEXT");
  });
});

// ---------------------------------------------------------------------------
// buildContext — full assembly
// ---------------------------------------------------------------------------
describe("buildContext", () => {
  it("returns empty assembled for empty input", () => {
    const result = buildContext({});
    expect(result.assembled).toBe("");
    expect(result.document).toBe("");
    expect(result.objective).toBe("");
  });

  it("includes document in result", () => {
    const result = buildContext({ document: "Hello world" });
    expect(result.document).toBe("Hello world");
  });

  it("truncates document using default limit", () => {
    const longDoc = "X".repeat(LIMITS.document + 500);
    const result = buildContext({ document: longDoc });
    expect(result.document.length).toBeLessThan(longDoc.length);
  });

  it("respects maxDocLength override", () => {
    const doc = "A".repeat(200);
    const result = buildContext({ document: doc, maxDocLength: 50 });
    expect(result.document).toContain("truncated at 50 chars");
  });

  it("assembles multiple sections into CONTEXT block", () => {
    const result = buildContext({
      objective: "Build a product",
      appType: "product-requirement",
    });
    expect(result.assembled).toContain("CONTEXT:");
    expect(result.assembled).toContain("DOCUMENT OBJECTIVE: Build a product");
    expect(result.assembled).toContain("APPLICATION CONTEXT");
  });

  it("includes app config in result", () => {
    const result = buildContext({ appType: "email-composer" });
    expect(result.appConfig).toBeDefined();
    expect(result.appConfig!.outputFormat).toBe("email");
  });

  it("appConfig is undefined for unknown appType", () => {
    const result = buildContext({ appType: "nonexistent" });
    expect(result.appConfig).toBeUndefined();
  });

  it("includes all non-empty sections in assembled output", () => {
    const input: ContextInput = {
      objective: "The goal",
      editHistory: [
        { instruction: "Fix typo", instructionType: "correct", summary: "Fixed", timestamp: 1 },
      ],
      interviewEntries: [
        { id: "1", question: "Q?", answer: "A", topic: "T", timestamp: 1 },
      ],
    };
    const result = buildContext(input);
    expect(result.assembled).toContain("DOCUMENT OBJECTIVE:");
    expect(result.assembled).toContain("RECENT EDIT HISTORY");
    expect(result.assembled).toContain("Topic: T");
  });

  it("omits empty sections from assembled output", () => {
    const result = buildContext({ objective: "Goal only" });
    expect(result.assembled).toContain("DOCUMENT OBJECTIVE:");
    // Should NOT contain section headers for empty sections
    expect(result.assembled).not.toContain("RECENT EDIT HISTORY");
    expect(result.assembled).not.toContain("CAPTURED CONTEXT");
    expect(result.assembled).not.toContain("ACTIVE PERSONAS");
  });
});

// ---------------------------------------------------------------------------
// LIMITS constant
// ---------------------------------------------------------------------------
describe("LIMITS", () => {
  it("has expected defaults", () => {
    expect(LIMITS.document).toBe(250_000);
    expect(LIMITS.documentShort).toBe(100_000);
    expect(LIMITS.documentBrief).toBe(20_000);
    expect(LIMITS.documentFull).toBe(250_000);
    expect(LIMITS.reference).toBe(500);
    expect(LIMITS.wireframe).toBe(3000);
    expect(LIMITS.historyEntries).toBe(5);
    expect(LIMITS.discussionEntries).toBe(10);
  });
});
