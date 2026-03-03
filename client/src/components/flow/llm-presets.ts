// ── LLM Node Preset Definitions ──

export interface LlmPreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  defaultObjective: string;
  endpoint: "/api/summarize-intent" | "/api/write";
  buildRequest: (inputs: string, objective: string) => Record<string, unknown>;
  extractOutput: (response: Record<string, unknown>) => string;
  color: string;
}

export const LLM_PRESETS: LlmPreset[] = [
  {
    id: "summarize",
    label: "Summarize",
    icon: "ListCollapse",
    description: "Distill inputs into a concise summary",
    defaultObjective: "Create a clear, structured summary of the key points from all inputs",
    endpoint: "/api/summarize-intent",
    buildRequest: (inputs) => ({ transcript: inputs, mode: "summarize" }),
    extractOutput: (res) => (res as { summary: string }).summary,
    color: "purple",
  },
  {
    id: "clean",
    label: "Clean Up",
    icon: "Eraser",
    description: "Fix grammar, remove filler, sharpen language",
    defaultObjective: "Clean up the text: remove filler words, fix grammar, improve clarity",
    endpoint: "/api/summarize-intent",
    buildRequest: (inputs) => ({ transcript: inputs, mode: "clean" }),
    extractOutput: (res) => (res as { summary: string }).summary,
    color: "cyan",
  },
  {
    id: "expand",
    label: "Expand",
    icon: "Maximize2",
    description: "Add depth, examples, and supporting detail",
    defaultObjective: "Expand this content with more depth, examples, and supporting details",
    endpoint: "/api/write",
    buildRequest: (inputs, objective) => ({
      document: inputs,
      instruction: objective || "Expand with more depth, examples, and supporting details",
    }),
    extractOutput: (res) => (res as { document: string }).document,
    color: "emerald",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "Pencil",
    description: "Write your own objective",
    defaultObjective: "",
    endpoint: "/api/write",
    buildRequest: (inputs, objective) => ({
      document: inputs,
      instruction: objective,
    }),
    extractOutput: (res) => (res as { document: string }).document,
    color: "rose",
  },
];

export function getPreset(id: string | undefined | null): LlmPreset {
  return LLM_PRESETS.find((p) => p.id === id) ?? LLM_PRESETS[0];
}
