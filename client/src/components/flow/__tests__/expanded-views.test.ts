/**
 * Tests for expanded view data logic.
 *
 * These validate the pure functions and data contracts that power
 * Document and LLM Base expanded views. They guard against crashes
 * like "g?.find is not a function" by verifying that:
 * - Edge role helpers handle all input shapes
 * - Context gathering from edges works with missing/empty nodes
 * - Model list defensive handling works with non-array data
 * - Node property defaults are correct
 */

import { describe, it, expect } from "vitest";
import { edgeHasRole, edgeRoles } from "../useFlowCanvas";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";

// ── Edge role helpers ──

describe("edgeHasRole", () => {
  const edge = (role?: string | string[]): FlowEdge => ({
    id: "e1",
    fromNodeId: "a",
    toNodeId: "b",
    role: role as any,
  });

  it("returns false when role is undefined", () => {
    expect(edgeHasRole(edge(), "user-prompt")).toBe(false);
  });

  it("matches a single string role", () => {
    expect(edgeHasRole(edge("user-prompt"), "user-prompt")).toBe(true);
    expect(edgeHasRole(edge("user-prompt"), "context")).toBe(false);
  });

  it("matches within an array of roles", () => {
    expect(edgeHasRole(edge(["user-prompt", "context"]), "user-prompt")).toBe(true);
    expect(edgeHasRole(edge(["context"]), "user-prompt")).toBe(false);
  });

  it("handles empty array", () => {
    expect(edgeHasRole(edge([]), "user-prompt")).toBe(false);
  });
});

describe("edgeRoles", () => {
  const edge = (role?: string | string[]): FlowEdge => ({
    id: "e1",
    fromNodeId: "a",
    toNodeId: "b",
    role: role as any,
  });

  it("returns empty array when role is undefined", () => {
    expect(edgeRoles(edge())).toEqual([]);
  });

  it("wraps single string in array", () => {
    expect(edgeRoles(edge("user-prompt"))).toEqual(["user-prompt"]);
  });

  it("passes through array", () => {
    expect(edgeRoles(edge(["user-prompt", "context"]))).toEqual(["user-prompt", "context"]);
  });
});

// ── Context gathering logic (mirrors LlmBaseExpandedView useMemo) ──

function gatherContextInputs(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): { label: string; content: string }[] {
  const parts: { label: string; content: string }[] = [];
  for (const edge of edges) {
    if (edge.toNodeId !== nodeId) continue;
    if (edgeHasRole(edge, "user-prompt")) continue;
    const src = nodes.find((n) => n.id === edge.fromNodeId);
    if (!src) continue;
    const text = src.documentContent || src.content || src.snippet || "";
    if (text.trim()) {
      parts.push({ label: src.label || "Input", content: text.trim() });
    }
  }
  return parts;
}

function gatherUserPromptInputs(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): { label: string; content: string }[] {
  const parts: { label: string; content: string }[] = [];
  for (const edge of edges) {
    if (edge.toNodeId !== nodeId) continue;
    if (!edgeHasRole(edge, "user-prompt")) continue;
    const src = nodes.find((n) => n.id === edge.fromNodeId);
    if (!src) continue;
    const text = src.documentContent || src.content || src.snippet || "";
    if (text.trim()) {
      parts.push({ label: src.label || "Prompt", content: text.trim() });
    }
  }
  return parts;
}

function makeNode(overrides: Partial<FlowNode> & { id: string }): FlowNode {
  return {
    type: "document",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    label: "",
    zIndex: 0,
    ...overrides,
  };
}

describe("gatherContextInputs", () => {
  it("returns empty for no edges", () => {
    const node = makeNode({ id: "target" });
    expect(gatherContextInputs("target", [node], [])).toEqual([]);
  });

  it("gathers content from connected context nodes", () => {
    const source = makeNode({ id: "src", label: "My Doc", content: "hello world" });
    const target = makeNode({ id: "target" });
    const edge: FlowEdge = { id: "e1", fromNodeId: "src", toNodeId: "target" };

    const result = gatherContextInputs("target", [source, target], [edge]);
    expect(result).toEqual([{ label: "My Doc", content: "hello world" }]);
  });

  it("skips edges with user-prompt role", () => {
    const source = makeNode({ id: "src", content: "prompt text" });
    const target = makeNode({ id: "target" });
    const edge: FlowEdge = { id: "e1", fromNodeId: "src", toNodeId: "target", role: "user-prompt" };

    expect(gatherContextInputs("target", [source, target], [edge])).toEqual([]);
  });

  it("skips nodes with empty content", () => {
    const source = makeNode({ id: "src", label: "Empty", content: "   " });
    const target = makeNode({ id: "target" });
    const edge: FlowEdge = { id: "e1", fromNodeId: "src", toNodeId: "target" };

    expect(gatherContextInputs("target", [source, target], [edge])).toEqual([]);
  });

  it("skips edges pointing to other nodes", () => {
    const source = makeNode({ id: "src", content: "data" });
    const target = makeNode({ id: "target" });
    const other = makeNode({ id: "other" });
    const edge: FlowEdge = { id: "e1", fromNodeId: "src", toNodeId: "other" };

    expect(gatherContextInputs("target", [source, target, other], [edge])).toEqual([]);
  });

  it("handles missing source node gracefully", () => {
    const target = makeNode({ id: "target" });
    const edge: FlowEdge = { id: "e1", fromNodeId: "nonexistent", toNodeId: "target" };

    expect(gatherContextInputs("target", [target], [edge])).toEqual([]);
  });

  it("prefers documentContent over content over snippet", () => {
    const src1 = makeNode({ id: "s1", documentContent: "doc", content: "cont", snippet: "snip" });
    const src2 = makeNode({ id: "s2", content: "cont", snippet: "snip" });
    const src3 = makeNode({ id: "s3", snippet: "snip" });
    const target = makeNode({ id: "t" });
    const edges: FlowEdge[] = [
      { id: "e1", fromNodeId: "s1", toNodeId: "t" },
      { id: "e2", fromNodeId: "s2", toNodeId: "t" },
      { id: "e3", fromNodeId: "s3", toNodeId: "t" },
    ];

    const result = gatherContextInputs("t", [src1, src2, src3, target], edges);
    expect(result.map((r) => r.content)).toEqual(["doc", "cont", "snip"]);
  });
});

describe("gatherUserPromptInputs", () => {
  it("only collects edges with user-prompt role", () => {
    const src1 = makeNode({ id: "s1", content: "context" });
    const src2 = makeNode({ id: "s2", label: "Prompt", content: "user question" });
    const target = makeNode({ id: "t" });
    const edges: FlowEdge[] = [
      { id: "e1", fromNodeId: "s1", toNodeId: "t" },
      { id: "e2", fromNodeId: "s2", toNodeId: "t", role: "user-prompt" },
    ];

    const result = gatherUserPromptInputs("t", [src1, src2, target], edges);
    expect(result).toEqual([{ label: "Prompt", content: "user question" }]);
  });
});

// ── Model list defensive handling ──

describe("models defensive handling", () => {
  it("Array.isArray handles undefined", () => {
    const raw: any = undefined;
    const models = Array.isArray(raw) ? raw : [];
    expect(models).toEqual([]);
    expect(models.find((m: any) => m.id === "x")).toBeUndefined();
  });

  it("Array.isArray handles null", () => {
    const raw: any = null;
    const models = Array.isArray(raw) ? raw : [];
    expect(models).toEqual([]);
  });

  it("Array.isArray handles object (the crash case)", () => {
    const raw: any = { models: [{ id: "a", label: "A" }], defaultModel: "a" };
    const models = Array.isArray(raw) ? raw : [];
    expect(models).toEqual([]);
    // This would have crashed before: raw?.find is not a function
    expect(() => models.find((m: any) => m.id === "a")).not.toThrow();
  });

  it("Array.isArray handles a proper array", () => {
    const raw: any = [{ id: "a", label: "Model A" }];
    const models = Array.isArray(raw) ? raw : [];
    expect(models.find((m: any) => m.id === "a")?.label).toBe("Model A");
  });

  it("Array.isArray handles string", () => {
    const raw: any = "not an array";
    const models = Array.isArray(raw) ? raw : [];
    expect(models).toEqual([]);
  });
});

// ── Node property defaults (LLM Base) ──

describe("LLM Base node defaults", () => {
  it("has correct defaults for all config properties", () => {
    const node = makeNode({ id: "llm1", type: "llm-base" });

    // These mirror the defaults in LlmBaseExpandedView
    const model = node.llmBaseModel || "gemini-2.5-flash";
    const temperature = node.llmBaseTemperature ?? 1.0;
    const topP = node.llmBaseTopP ?? 1.0;
    const topK = node.llmBaseTopK ?? 0;
    const maxTokens = node.llmBaseMaxTokens ?? 8192;
    const safety = node.llmBaseSafety ?? "none";
    const enableSearch = node.llmBaseEnableSearch ?? false;
    const streaming = node.llmBaseStreaming ?? true;
    const systemPrompt = node.llmBaseSystemPrompt ?? "";
    const userPrompt = node.llmBaseUserPrompt ?? "";

    expect(model).toBe("gemini-2.5-flash");
    expect(temperature).toBe(1.0);
    expect(topP).toBe(1.0);
    expect(topK).toBe(0);
    expect(maxTokens).toBe(8192);
    expect(safety).toBe("none");
    expect(enableSearch).toBe(false);
    expect(streaming).toBe(true);
    expect(systemPrompt).toBe("");
    expect(userPrompt).toBe("");
  });

  it("respects explicit values", () => {
    const node = makeNode({
      id: "llm1",
      type: "llm-base",
      llmBaseModel: "claude-3.5-sonnet",
      llmBaseTemperature: 0.5,
      llmBaseMaxTokens: 4096,
      llmBaseSafety: "high",
      llmBaseEnableSearch: true,
      llmBaseStreaming: false,
    });

    expect(node.llmBaseModel || "gemini-2.5-flash").toBe("claude-3.5-sonnet");
    expect(node.llmBaseTemperature ?? 1.0).toBe(0.5);
    expect(node.llmBaseMaxTokens ?? 8192).toBe(4096);
    expect(node.llmBaseSafety ?? "none").toBe("high");
    expect(node.llmBaseEnableSearch ?? false).toBe(true);
    expect(node.llmBaseStreaming ?? true).toBe(false);
  });
});

// ── System prompt + user prompt assembly (mirrors handleRun logic) ──

describe("LLM Base prompt assembly", () => {
  it("builds system prompt from context + manual input", () => {
    const contextInputs = [
      { label: "Doc A", content: "Context A" },
      { label: "Doc B", content: "Context B" },
    ];
    const systemPrompt = "Be helpful.";

    const systemParts = [
      ...contextInputs.map((c) => c.content),
      ...(systemPrompt.trim() ? [systemPrompt.trim()] : []),
    ];
    const system = systemParts.join("\n\n---\n\n") || "You are a helpful assistant.";

    expect(system).toBe("Context A\n\n---\n\nContext B\n\n---\n\nBe helpful.");
  });

  it("falls back to default when no context and no system prompt", () => {
    const systemParts = [
      ...([].map((c: any) => c.content)),
      ...("".trim() ? [""] : []),
    ];
    const system = systemParts.join("\n\n---\n\n") || "You are a helpful assistant.";

    expect(system).toBe("You are a helpful assistant.");
  });

  it("builds user message from user-prompt edges + manual input", () => {
    const userPromptInputs = [{ label: "Q", content: "What is X?" }];
    const userPrompt = "Also explain Y.";

    const userParts = [
      ...userPromptInputs.map((u) => u.content),
      ...(userPrompt.trim() ? [userPrompt.trim()] : []),
    ];
    const userMessage = userParts.join("\n\n") || "Hello";

    expect(userMessage).toBe("What is X?\n\nAlso explain Y.");
  });

  it("falls back to Hello when no user prompt", () => {
    const userParts: string[] = [];
    const userMessage = userParts.join("\n\n") || "Hello";
    expect(userMessage).toBe("Hello");
  });
});
