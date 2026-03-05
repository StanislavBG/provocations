/**
 * Flow Chain Templates — Server-side seed data for demo/quick-start chains.
 *
 * These templates are served via GET /api/flow/templates and can be
 * instantiated on the client canvas. Each template defines nodes and edges
 * using stable placeholder IDs that get remapped to real IDs on instantiation.
 *
 * This is the single source of truth for prebuilt chains.
 * The client never defines chain structure — it only renders what the API returns.
 */

// ── Types ──

export interface FlowTemplateNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  snippet?: string;
  // Node-type-specific config (subset of FlowNode fields)
  [key: string]: unknown;
}

export interface FlowTemplateEdge {
  fromNodeId: string;
  toNodeId: string;
  role?: "context" | "objective" | "output-format";
}

export interface FlowTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "creative" | "business" | "research";
  nodes: FlowTemplateNode[];
  edges: FlowTemplateEdge[];
}

// ── Layout helpers ──

const COL_GAP = 280;

function n(
  partial: { id: string; type: string; label: string; col: number; row?: number } & Record<string, unknown>,
): FlowTemplateNode {
  const { col, row = 0, ...rest } = partial;
  return {
    x: col * COL_GAP,
    y: row * 200,
    width: 200,
    height: 130,
    ...rest,
  } as FlowTemplateNode;
}

// ═══════════════════════════════════════════════════════════════
// Chain A: Meme Machine
// ═══════════════════════════════════════════════════════════════

const memeTemplate: FlowTemplate = {
  id: "meme-machine",
  label: "Meme Machine",
  description: "Generate viral memes: caption writing, quality check, image creation",
  icon: "Zap",
  category: "creative",
  nodes: [
    n({
      id: "meme-trigger",
      type: "timer-event",
      label: "Trigger",
      col: 0,
      snippet: "Click to start the meme pipeline",
      triggerMode: "automated",
      timerRunning: false,
      timerPulseCount: 0,
      width: 200,
      height: 160,
    }),
    n({
      id: "meme-writer",
      type: "llm",
      label: "Caption Writer",
      col: 1,
      snippet: "Generate viral caption + meme idea",
      llmPresetId: "custom",
      llmObjective:
        "Generate a viral social media caption and meme concept. Use Gen-Z tone, trending humor, and punchy one-liners. Output format:\n\nCAPTION: [the caption]\nMEME IDEA: [visual description of the meme]",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "meme-gate",
      type: "coherence-gate",
      label: "Quality Check",
      col: 2,
      snippet: "Score the caption quality",
      coherenceThreshold: 70,
      coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: false, styleMatch: true },
      coherenceStrictness: "medium",
      coherenceRetryCount: 1,
      width: 160,
      height: 160,
    }),
    n({
      id: "meme-painter",
      type: "painter",
      label: "Meme Creator",
      col: 3,
      snippet: "Generate the meme image",
      width: 260,
      height: 200,
    }),
    n({
      id: "meme-output",
      type: "document",
      label: "Final Meme",
      col: 4,
      snippet: "Image + caption ready to share",
      documentContent: "",
      width: 200,
      height: 130,
    }),
  ],
  edges: [
    { fromNodeId: "meme-trigger", toNodeId: "meme-writer" },
    { fromNodeId: "meme-writer", toNodeId: "meme-gate" },
    { fromNodeId: "meme-gate", toNodeId: "meme-painter" },
    { fromNodeId: "meme-painter", toNodeId: "meme-output" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Chain B: Product PRD Generator
// ═══════════════════════════════════════════════════════════════

const prdTemplate: FlowTemplate = {
  id: "prd-generator",
  label: "Product PRD Generator",
  description: "Full PRD pipeline: research, draft, quality gate, wireframes, polish",
  icon: "FileText",
  category: "business",
  nodes: [
    n({
      id: "prd-trigger",
      type: "timer-event",
      label: "Trigger",
      col: 0,
      snippet: "Click to start PRD generation",
      triggerMode: "automated",
      timerRunning: false,
      timerPulseCount: 0,
      width: 200,
      height: 160,
    }),
    n({
      id: "prd-researcher",
      type: "research",
      label: "Market Research",
      col: 1,
      snippet: "Pull market data from context",
      researchQuery: "Research market landscape, competitors, and user needs based on the provided context",
      outputConfig: {
        format: "structured",
        detail: "detailed",
        focusMode: "gather",
        audience: "technical",
        tone: "neutral",
      },
      width: 240,
      height: 300,
    }),
    n({
      id: "prd-writer",
      type: "llm",
      label: "PRD Drafter",
      col: 2,
      snippet: "Draft PRD: goals, features, metrics",
      llmPresetId: "custom",
      llmObjective:
        "Draft a Product Requirements Document with these sections:\n1. Overview & Vision\n2. Goals & Success Metrics\n3. User Stories\n4. Feature Requirements (prioritized)\n5. Technical Considerations\n6. Timeline & Milestones\n\nUse the research context provided.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "prd-gate",
      type: "coherence-gate",
      label: "Quality Gate",
      col: 3,
      snippet: "Verify PRD completeness",
      coherenceThreshold: 80,
      coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: true, styleMatch: false },
      coherenceStrictness: "strict",
      coherenceRetryCount: 1,
      width: 160,
      height: 160,
    }),
    n({
      id: "prd-painter",
      type: "painter",
      label: "UX Wireframes",
      col: 4,
      snippet: "Mockup 3-5 UX wireframes",
      width: 260,
      height: 200,
    }),
    n({
      id: "prd-final",
      type: "llm",
      label: "Polish & Export",
      col: 5,
      snippet: "Polish the PRD and export as Markdown",
      llmPresetId: "custom",
      llmObjective:
        "Polish this PRD for executive review. Ensure consistent formatting, clear language, and professional tone. Export as clean Markdown.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
  ],
  edges: [
    { fromNodeId: "prd-trigger", toNodeId: "prd-researcher" },
    { fromNodeId: "prd-researcher", toNodeId: "prd-writer" },
    { fromNodeId: "prd-writer", toNodeId: "prd-gate" },
    { fromNodeId: "prd-gate", toNodeId: "prd-painter" },
    { fromNodeId: "prd-gate", toNodeId: "prd-final" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Chain C: Deep Dive Research
// ═══════════════════════════════════════════════════════════════

const researchTemplate: FlowTemplate = {
  id: "deep-dive-research",
  label: "Deep Dive Research",
  description: "Comprehensive research: topic analysis, gap finding, infographic, exec summary",
  icon: "Search",
  category: "research",
  nodes: [
    n({
      id: "res-trigger",
      type: "timer-event",
      label: "Trigger",
      col: 0,
      snippet: "Click to start research pipeline",
      triggerMode: "automated",
      timerRunning: false,
      timerPulseCount: 0,
      width: 200,
      height: 160,
    }),
    n({
      id: "res-researcher",
      type: "research",
      label: "Topic Research",
      col: 1,
      snippet: "Summarize topic using context files",
      researchQuery: "Provide a comprehensive summary of the topic using the provided context documents",
      outputConfig: {
        format: "structured",
        detail: "exhaustive",
        focusMode: "deep-research",
        audience: "technical",
        tone: "neutral",
      },
      width: 240,
      height: 300,
    }),
    n({
      id: "res-overview",
      type: "llm",
      label: "Full Overview",
      col: 2,
      snippet: "Write full overview + competitive landscape",
      llmPresetId: "custom",
      llmObjective:
        "Write a comprehensive overview document covering:\n1. Executive Summary\n2. Current Landscape\n3. Competitive Analysis\n4. Key Trends & Opportunities\n5. Risks & Challenges\n\nBase this on the research provided.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "res-analyzer",
      type: "llm",
      label: "Gap Analyzer",
      col: 3,
      snippet: "Break down features, gaps",
      llmPresetId: "custom",
      llmObjective:
        "Analyze the document for:\n1. Feature gaps vs competitors\n2. Unaddressed user needs\n3. Technical debt areas\n4. Strategic opportunities\n\nOutput a structured analysis with severity ratings.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "res-gate",
      type: "coherence-gate",
      label: "Research Gate",
      col: 4,
      snippet: "Verify research quality",
      coherenceThreshold: 75,
      coherenceChecks: { topicMatch: true, toneConsistency: false, factDrift: true, styleMatch: false },
      coherenceStrictness: "medium",
      coherenceRetryCount: 1,
      width: 160,
      height: 160,
    }),
    n({
      id: "res-painter",
      type: "painter",
      label: "Infographic",
      col: 5,
      row: -1,
      snippet: "Create infographic: timeline, charts, stats",
      width: 260,
      height: 200,
    }),
    n({
      id: "res-summary",
      type: "llm",
      label: "Exec Summary",
      col: 5,
      row: 1,
      snippet: "One-page executive summary",
      llmPresetId: "custom",
      llmObjective:
        "Write a one-page executive summary. Include:\n- Key findings (3-5 bullets)\n- Recommended actions\n- Timeline for next steps\n- Critical risks\n\nKeep it concise, clear, and actionable.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
  ],
  edges: [
    { fromNodeId: "res-trigger", toNodeId: "res-researcher" },
    { fromNodeId: "res-researcher", toNodeId: "res-overview" },
    { fromNodeId: "res-overview", toNodeId: "res-analyzer" },
    { fromNodeId: "res-analyzer", toNodeId: "res-gate" },
    { fromNodeId: "res-gate", toNodeId: "res-painter" },
    { fromNodeId: "res-gate", toNodeId: "res-summary" },
  ],
};

// ── All templates ──

export const FLOW_TEMPLATES: FlowTemplate[] = [
  memeTemplate,
  prdTemplate,
  researchTemplate,
];

/**
 * Get a template by ID. Returns null if not found.
 */
export function getFlowTemplate(id: string): FlowTemplate | null {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? null;
}
