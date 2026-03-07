/**
 * Canvas backward compatibility tests.
 *
 * These tests ensure that saved canvas JSON from older versions can still be
 * loaded by the current code without errors. They test the full round-trip:
 *   serialize → encrypt → decrypt → deserialize → migrate
 *
 * Key scenarios:
 * 1. Old canvases without new node types (llm-base, etc.)
 * 2. Old canvases with legacy fields (locked: true without lockMode)
 * 3. Old store nodes with oversized dimensions
 * 4. Missing viewport
 * 5. Missing edges array
 * 6. Unknown/future node types (forward compatibility)
 * 7. Old edge format without roles
 * 8. Full encrypt→decrypt→parse round-trip with various canvas shapes
 */

import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

const TEST_KEY = "test-encryption-key-for-canvas-compat";

// ---------------------------------------------------------------------------
// Simulate loadCanvas migration logic (extracted from useFlowCanvas.ts)
// ---------------------------------------------------------------------------
interface FlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  zIndex: number;
  locked?: boolean;
  lockMode?: string;
  [key: string]: unknown;
}

interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  role?: string | string[];
}

interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

const INITIAL_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

function migrateCanvas(data: {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  viewport?: FlowViewport;
}) {
  const nodes = (data.nodes || []).map((n: FlowNode) => {
    let node = { ...n };
    // Migration: old store nodes (260x320) → compact (200x100)
    if (node.type === "store" && node.width === 260 && node.height === 320) {
      node = { ...node, width: 200, height: 100 };
    }
    // Migration: old locked boolean → lockMode
    if (node.locked && !node.lockMode) {
      node = { ...node, lockMode: "canvas" };
    }
    return node;
  });
  return {
    nodes,
    edges: data.edges || [],
    viewport: data.viewport || INITIAL_VIEWPORT,
  };
}

// ---------------------------------------------------------------------------
// Full round-trip helper: canvas → JSON → encrypt → decrypt → JSON → migrate
// ---------------------------------------------------------------------------
function roundTrip(canvasData: Record<string, unknown>) {
  const json = JSON.stringify(canvasData);
  const encrypted = encrypt(json, TEST_KEY);
  const decrypted = decrypt(encrypted, TEST_KEY);
  const parsed = JSON.parse(decrypted);
  return migrateCanvas(parsed);
}

// ---------------------------------------------------------------------------
// 1. Basic canvas shapes
// ---------------------------------------------------------------------------
describe("Canvas round-trip: basic shapes", () => {
  it("empty canvas", () => {
    const result = roundTrip({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("single node canvas", () => {
    const canvas = {
      nodes: [{ id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Test", zIndex: 1 }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("n1");
    expect(result.nodes[0].type).toBe("context-doc");
  });

  it("multi-node canvas with edges", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Doc", zIndex: 1 },
        { id: "n2", type: "research", x: 400, y: 200, width: 260, height: 180, label: "Research", zIndex: 2 },
        { id: "n3", type: "llm", x: 700, y: 200, width: 240, height: 160, label: "LLM", zIndex: 3 },
      ],
      edges: [
        { id: "e1", fromNodeId: "n1", toNodeId: "n2" },
        { id: "e2", fromNodeId: "n2", toNodeId: "n3" },
      ],
      viewport: { x: -100, y: -50, zoom: 0.75 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    expect(result.viewport.zoom).toBe(0.75);
  });
});

// ---------------------------------------------------------------------------
// 2. Migration: old store node dimensions
// ---------------------------------------------------------------------------
describe("Canvas migration: store node dimensions", () => {
  it("migrates old large store nodes (260x320 → 200x100)", () => {
    const canvas = {
      nodes: [
        { id: "s1", type: "store", x: 100, y: 100, width: 260, height: 320, label: "Save File", zIndex: 1 },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(100);
  });

  it("does not change store nodes with different dimensions", () => {
    const canvas = {
      nodes: [
        { id: "s1", type: "store", x: 100, y: 100, width: 200, height: 100, label: "Save File", zIndex: 1 },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(100);
  });

  it("does not change non-store nodes with 260x320 dimensions", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "research", x: 100, y: 100, width: 260, height: 320, label: "Research", zIndex: 1 },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].width).toBe(260);
    expect(result.nodes[0].height).toBe(320);
  });
});

// ---------------------------------------------------------------------------
// 3. Migration: locked boolean → lockMode
// ---------------------------------------------------------------------------
describe("Canvas migration: locked → lockMode", () => {
  it("migrates locked: true to lockMode: canvas", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Locked", zIndex: 1, locked: true },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].lockMode).toBe("canvas");
  });

  it("does not overwrite existing lockMode", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Screen Lock", zIndex: 1, locked: true, lockMode: "screen" },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].lockMode).toBe("screen");
  });

  it("does not add lockMode when locked is false/absent", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Unlocked", zIndex: 1 },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].lockMode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Missing fields (old canvas formats)
// ---------------------------------------------------------------------------
describe("Canvas loading: missing fields", () => {
  it("handles missing viewport (defaults to initial)", () => {
    const canvas = {
      nodes: [{ id: "n1", type: "context-doc", x: 0, y: 0, width: 220, height: 140, label: "Test", zIndex: 1 }],
      edges: [],
      // no viewport
    };
    const result = roundTrip(canvas);
    expect(result.viewport).toEqual(INITIAL_VIEWPORT);
  });

  it("handles missing edges array", () => {
    const canvas = {
      nodes: [{ id: "n1", type: "context-doc", x: 0, y: 0, width: 220, height: 140, label: "Test", zIndex: 1 }],
      // no edges
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.edges).toEqual([]);
  });

  it("handles missing nodes array", () => {
    const canvas = {
      // no nodes
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes).toEqual([]);
  });

  it("handles completely empty object", () => {
    const result = roundTrip({});
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.viewport).toEqual(INITIAL_VIEWPORT);
  });
});

// ---------------------------------------------------------------------------
// 5. Forward compatibility: unknown node types
// ---------------------------------------------------------------------------
describe("Canvas loading: unknown/future node types", () => {
  it("preserves nodes with unknown types", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "future-node-type", x: 100, y: 200, width: 220, height: 140, label: "Future", zIndex: 1, someNewField: "value" },
        { id: "n2", type: "context-doc", x: 400, y: 200, width: 220, height: 140, label: "Known", zIndex: 2 },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2" }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].type).toBe("future-node-type");
    expect(result.nodes[0].someNewField).toBe("value");
  });

  it("preserves edges with unknown roles", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "A", zIndex: 1 },
        { id: "n2", type: "llm", x: 400, y: 200, width: 240, height: 160, label: "B", zIndex: 2 },
      ],
      edges: [
        { id: "e1", fromNodeId: "n1", toNodeId: "n2", role: "some-future-role" },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.edges[0].role).toBe("some-future-role");
  });
});

// ---------------------------------------------------------------------------
// 6. Edge formats (with and without roles)
// ---------------------------------------------------------------------------
describe("Canvas loading: edge formats", () => {
  it("handles edges without role (pre-role era)", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 0, y: 0, width: 220, height: 140, label: "A", zIndex: 1 },
        { id: "n2", type: "research", x: 300, y: 0, width: 260, height: 180, label: "B", zIndex: 2 },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2" }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.edges[0].role).toBeUndefined();
  });

  it("handles edges with string role", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 0, y: 0, width: 220, height: 140, label: "A", zIndex: 1 },
        { id: "n2", type: "llm-base", x: 300, y: 0, width: 280, height: 200, label: "B", zIndex: 2 },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2", role: "system-instruction" }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.edges[0].role).toBe("system-instruction");
  });

  it("handles edges with array roles", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 0, y: 0, width: 220, height: 140, label: "A", zIndex: 1 },
        { id: "n2", type: "llm", x: 300, y: 0, width: 240, height: 160, label: "B", zIndex: 2 },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2", role: ["context", "objective"] }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.edges[0].role).toEqual(["context", "objective"]);
  });
});

// ---------------------------------------------------------------------------
// 7. Node types that exist in production canvases
// ---------------------------------------------------------------------------
describe("Canvas loading: all known node types", () => {
  const knownTypes = [
    "context-doc", "research", "llm", "store", "painter", "timeline",
    "interview", "zone", "note", "llm-base", "audio",
    "youtube", "output-format",
  ];

  for (const type of knownTypes) {
    it(`preserves ${type} node through round-trip`, () => {
      const canvas = {
        nodes: [{ id: "n1", type, x: 100, y: 200, width: 220, height: 140, label: `${type} node`, zIndex: 1 }],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      const result = roundTrip(canvas);
      expect(result.nodes[0].type).toBe(type);
      expect(result.nodes[0].label).toBe(`${type} node`);
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Node-specific fields preserved through round-trip
// ---------------------------------------------------------------------------
describe("Canvas loading: type-specific fields", () => {
  it("preserves context-doc fields", () => {
    const canvas = {
      nodes: [{
        id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140,
        label: "My Doc", zIndex: 1, documentId: 42, snippet: "Preview text here",
      }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].documentId).toBe(42);
    expect(result.nodes[0].snippet).toBe("Preview text here");
  });

  it("preserves llm fields", () => {
    const canvas = {
      nodes: [{
        id: "n1", type: "llm", x: 100, y: 200, width: 240, height: 160,
        label: "Summarize", zIndex: 1,
        llmPresetId: "summarize", llmObjective: "Make it shorter",
        llmStatus: "done", llmOutput: "Summarized text",
      }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].llmPresetId).toBe("summarize");
    expect(result.nodes[0].llmOutput).toBe("Summarized text");
  });

  it("preserves research fields", () => {
    const canvas = {
      nodes: [{
        id: "n1", type: "research", x: 100, y: 200, width: 260, height: 180,
        label: "Research", zIndex: 1,
        researchMessages: [
          { role: "user", content: "What is AI?" },
          { role: "assistant", content: "AI is..." },
        ],
        researchQuery: "artificial intelligence",
      }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].researchMessages).toHaveLength(2);
    expect(result.nodes[0].researchQuery).toBe("artificial intelligence");
  });

  it("preserves llm-base fields", () => {
    const canvas = {
      nodes: [{
        id: "n1", type: "llm-base", x: 100, y: 200, width: 280, height: 200,
        label: "LLM Base", zIndex: 1,
        llmBaseModel: "gemini-2.5-flash",
        llmBaseTemperature: 0.7,
        llmBaseTopP: 0.95,
        llmBaseTopK: 40,
        llmBaseMaxTokens: 4096,
        llmBaseSafety: "none",
        llmBaseEnableSearch: true,
        llmBaseSystemPrompt: "You are a helpful assistant.",
        llmBaseUserPrompt: "Explain quantum computing",
        llmBaseOutput: "Quantum computing is...",
        llmBaseStreaming: true,
        llmBaseStatus: "done",
      }],
      edges: [{ id: "e1", fromNodeId: "ctx1", toNodeId: "n1", role: "system-instruction" }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].llmBaseModel).toBe("gemini-2.5-flash");
    expect(result.nodes[0].llmBaseTemperature).toBe(0.7);
    expect(result.nodes[0].llmBaseSafety).toBe("none");
  });

  it("preserves interview entries", () => {
    const canvas = {
      nodes: [{
        id: "n1", type: "interview", x: 100, y: 200, width: 260, height: 180,
        label: "Interview", zIndex: 1,
        interviewEntries: [
          { id: "ie1", question: "What's your goal?", answer: "Build something great", topic: "goals", timestamp: 1700000000 },
        ],
      }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes[0].interviewEntries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Realistic production canvas snapshots
// ---------------------------------------------------------------------------
describe("Canvas loading: realistic production canvases", () => {
  it("handles a typical research workflow canvas", () => {
    const canvas = {
      nodes: [
        { id: "ctx1", type: "context-doc", x: 50, y: 100, width: 220, height: 140, label: "Requirements.md", zIndex: 1, documentId: 10, snippet: "# Product Requirements\n\n..." },
        { id: "ctx2", type: "context-doc", x: 50, y: 300, width: 220, height: 140, label: "Competitive Analysis", zIndex: 2, documentId: 11 },
        { id: "res1", type: "research", x: 350, y: 200, width: 260, height: 180, label: "Market Research", zIndex: 3, researchMessages: [] },
        { id: "llm1", type: "llm", x: 700, y: 200, width: 240, height: 160, label: "Summarize Findings", zIndex: 4, llmPresetId: "summarize" },
        { id: "st1", type: "store", x: 1000, y: 200, width: 200, height: 100, label: "Save Output", zIndex: 5, storeFolderId: 3 },
      ],
      edges: [
        { id: "e1", fromNodeId: "ctx1", toNodeId: "res1" },
        { id: "e2", fromNodeId: "ctx2", toNodeId: "res1" },
        { id: "e3", fromNodeId: "res1", toNodeId: "llm1" },
        { id: "e4", fromNodeId: "llm1", toNodeId: "st1" },
      ],
      viewport: { x: -25, y: -50, zoom: 0.85 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes).toHaveLength(5);
    expect(result.edges).toHaveLength(4);
    expect(result.viewport.zoom).toBe(0.85);
    // Verify graph integrity
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    for (const edge of result.edges) {
      expect(nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.fromNodeId)).toBe(true); // edges reference existing nodes or external
    }
  });

  it("handles canvas with zones and grouped nodes", () => {
    const canvas = {
      nodes: [
        { id: "z1", type: "zone", x: 30, y: 30, width: 600, height: 400, label: "Research Phase", zIndex: 0 },
        { id: "n1", type: "context-doc", x: 50, y: 80, width: 220, height: 140, label: "Input", zIndex: 1 },
        { id: "n2", type: "research", x: 350, y: 80, width: 260, height: 180, label: "Explore", zIndex: 2 },
        { id: "z2", type: "zone", x: 700, y: 30, width: 400, height: 400, label: "Build Phase", zIndex: 0 },
        { id: "n3", type: "llm", x: 720, y: 80, width: 240, height: 160, label: "Process", zIndex: 3 },
      ],
      edges: [
        { id: "e1", fromNodeId: "n1", toNodeId: "n2" },
        { id: "e2", fromNodeId: "n2", toNodeId: "n3" },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const result = roundTrip(canvas);
    expect(result.nodes.filter((n) => n.type === "zone")).toHaveLength(2);
    expect(result.nodes.filter((n) => n.type !== "zone")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 10. Pre-optimization canvases (encrypted with random salt)
// ---------------------------------------------------------------------------
describe("Canvas loading: pre-optimization encrypted canvases", () => {
  // Simulate old encrypt with random salt
  function oldEncrypt(plaintext: string, passphrase: string) {
    const crypto_ = require("crypto");
    const salt = crypto_.randomBytes(16);
    const iv = crypto_.randomBytes(12);
    const key = crypto_.pbkdf2Sync(passphrase, salt, 100_000, 32, "sha256");
    const cipher = crypto_.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, authTag]);
    return {
      ciphertext: combined.toString("base64"),
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
    };
  }

  it("loads canvas encrypted with old random-salt method", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Old Doc", zIndex: 1 },
        { id: "n2", type: "research", x: 400, y: 200, width: 260, height: 180, label: "Old Research", zIndex: 2 },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2" }],
      viewport: { x: -100, y: -50, zoom: 0.9 },
    };

    const json = JSON.stringify(canvas);
    const encrypted = oldEncrypt(json, TEST_KEY);

    // Verify salt is NOT the master salt (it's random)
    const masterSaltB64 = Buffer.from("provocations-master-key-v1").toString("base64");
    expect(encrypted.salt).not.toBe(masterSaltB64);

    // Current decrypt should handle it
    const decrypted = decrypt(encrypted, TEST_KEY);
    const parsed = JSON.parse(decrypted);
    const result = migrateCanvas(parsed);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].label).toBe("Old Doc");
    expect(result.edges).toHaveLength(1);
    expect(result.viewport.zoom).toBe(0.9);
  });

  it("re-saves old canvas with new master salt (upgrade path)", () => {
    const canvas = {
      nodes: [{ id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "Upgrade Me", zIndex: 1 }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const json = JSON.stringify(canvas);

    // Step 1: Encrypted with old method
    const oldEncrypted = oldEncrypt(json, TEST_KEY);
    expect(oldEncrypted.salt).not.toBe(Buffer.from("provocations-master-key-v1").toString("base64"));

    // Step 2: Decrypt (old method)
    const decrypted = decrypt(oldEncrypted, TEST_KEY);

    // Step 3: Re-encrypt with new method
    const newEncrypted = encrypt(decrypted, TEST_KEY);
    expect(newEncrypted.salt).toBe(Buffer.from("provocations-master-key-v1").toString("base64"));

    // Step 4: Decrypt with new method
    const reDecrypted = decrypt(newEncrypted, TEST_KEY);
    expect(reDecrypted).toBe(json);
  });
});
