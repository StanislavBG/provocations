import { z } from "zod";

// Persona types (each persona provides Advice and Challenge feedback)
export const provocationType = [
  "architect",
  "quality_engineer",
  "ux_designer",
  "tech_writer",
  "product_manager",
  "security_engineer",
  "thinking_bigger",
] as const;

export type ProvocationType = typeof provocationType[number];

export const provocationScale = [1, 2, 3, 4, 5] as const;
export type ProvocationScale = typeof provocationScale[number];

export const provocationSchema = z.object({
  id: z.string(),
  type: z.enum(provocationType),
  title: z.string(),
  content: z.string(),
  sourceExcerpt: z.string(),
  status: z.enum(["pending", "addressed", "rejected", "highlighted"]),
  scale: z.number().min(1).max(5).optional(),
});

export type Provocation = z.infer<typeof provocationSchema>;

// Outline item schema
export const outlineItemSchema = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string(),
  order: z.number(),
  isExpanded: z.boolean(),
});

export type OutlineItem = z.infer<typeof outlineItemSchema>;

// Tone options
export const toneOptions = [
  "inspirational",
  "practical",
  "analytical",
  "persuasive",
  "cautious",
] as const;

export type ToneOption = typeof toneOptions[number];

// Document schema (in-memory only, no persistence needed)
export const documentSchema = z.object({
  id: z.string(),
  rawText: z.string(),
});

export type Document = z.infer<typeof documentSchema>;

// Reference document types (style guides, templates)
export const referenceDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  type: z.enum(["style", "template"]),
});

export type ReferenceDocument = z.infer<typeof referenceDocumentSchema>;

// API request schemas - used by both frontend and backend

// Generate provocations request
export const generateProvocationsRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  guidance: z.string().optional(),
  objective: z.string().optional(),
  types: z.array(z.enum(provocationType)).optional(),
  referenceDocuments: z.array(referenceDocumentSchema).optional(),
});

export type GenerateProvocationsRequest = z.infer<typeof generateProvocationsRequestSchema>;

// Unified write request - single interface to the AI writer
export const provocationContextSchema = z.object({
  type: z.enum(provocationType),
  title: z.string(),
  content: z.string(),
  sourceExcerpt: z.string(),
});

// Instruction types for classification-based writing strategies
export const instructionTypes = [
  "expand",      // Add detail, examples, elaboration
  "condense",    // Remove redundancy, tighten prose
  "restructure", // Reorder sections, add headings
  "clarify",     // Simplify language, add transitions
  "style",       // Change voice, formality level
  "correct",     // Fix errors, improve accuracy
  "general",     // General improvement
] as const;

export type InstructionType = typeof instructionTypes[number];

// Edit history entry for tracking iterations
export const editHistoryEntrySchema = z.object({
  instruction: z.string(),
  instructionType: z.enum(instructionTypes),
  summary: z.string(),
  timestamp: z.number(),
});

export type EditHistoryEntry = z.infer<typeof editHistoryEntrySchema>;

export const writeRequestSchema = z.object({
  // Foundation (always required)
  document: z.string().min(1, "Document is required"),
  objective: z.string().min(1, "Objective is required"),

  // Focus (optional - what part of document)
  selectedText: z.string().optional(),

  // Intent (required - what user wants)
  instruction: z.string().min(1, "Instruction is required"),

  // Context (optional - additional grounding)
  provocation: provocationContextSchema.optional(),

  // Style (optional)
  tone: z.enum(toneOptions).optional(),
  targetLength: z.enum(["shorter", "same", "longer"]).optional(),

  // Reference documents for style inference
  referenceDocuments: z.array(referenceDocumentSchema).optional(),

  // Edit history for coherent iteration
  editHistory: z.array(editHistoryEntrySchema).optional(),
});

export type WriteRequest = z.infer<typeof writeRequestSchema>;

// Change tracking for structured output
export const changeEntrySchema = z.object({
  type: z.enum(["added", "modified", "removed", "restructured"]),
  description: z.string(),
  location: z.string().optional(),
});

export type ChangeEntry = z.infer<typeof changeEntrySchema>;

export const writeResponseSchema = z.object({
  document: z.string(),
  summary: z.string().optional(),
  instructionType: z.enum(instructionTypes).optional(),
  changes: z.array(changeEntrySchema).optional(),
  suggestions: z.array(z.string()).optional(),
});

export type WriteResponse = z.infer<typeof writeResponseSchema>;

export interface DocumentVersion {
  id: string;
  text: string;
  timestamp: number;
  description: string;
}

// Direction mode for provoke panel (challenge = push back, advise = suggest improvements)
export const directionModes = ["challenge", "advise"] as const;
export type DirectionMode = typeof directionModes[number];

// Think Big vectors — high-impact dimensions for scaling products
export const thinkBigVectors = [
  "tenancy_topology",
  "api_surface",
  "scaling_horizon",
  "data_residency",
  "integration_philosophy",
  "identity_access",
  "observability",
] as const;
export type ThinkBigVector = typeof thinkBigVectors[number];

// Interview entry - a single Q&A pair from the interview flow
export const interviewEntrySchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  topic: z.string(),
  timestamp: z.number(),
});

export type InterviewEntry = z.infer<typeof interviewEntrySchema>;

// Interview question request - generates the next provocative question
export const interviewQuestionRequestSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  document: z.string().optional(),
  template: z.string().optional(),
  previousEntries: z.array(interviewEntrySchema).optional(),
  provocations: z.array(provocationSchema).optional(),
  // Direction parameters for the provoke panel
  directionMode: z.enum(directionModes).optional(),
  directionPersonas: z.array(z.enum(provocationType)).optional(),
  directionGuidance: z.string().optional(),
  thinkBigVectors: z.array(z.enum(thinkBigVectors)).optional(),
});

export type InterviewQuestionRequest = z.infer<typeof interviewQuestionRequestSchema>;

// Interview question response
export interface InterviewQuestionResponse {
  question: string;
  topic: string;
  reasoning: string;
}

// Interview summary request - summarize all entries for merge
export const interviewSummaryRequestSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  entries: z.array(interviewEntrySchema).min(1, "At least one entry is required"),
  document: z.string().optional(),
});

export type InterviewSummaryRequest = z.infer<typeof interviewSummaryRequestSchema>;

export interface WorkspaceState {
  document: Document | null;
  objective: string;
  referenceDocuments: ReferenceDocument[];
  editHistory: EditHistoryEntry[];
  provocations: Provocation[];
  outline: OutlineItem[];
  currentPhase: "input" | "blank-document" | "workspace";
}

// Document save/load schemas (server-side encryption, Clerk auth for ownership)
export const saveDocumentRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
});

export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>;

export const updateDocumentRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
});

export const renameDocumentRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

export type RenameDocumentRequest = z.infer<typeof renameDocumentRequestSchema>;

export type UpdateDocumentRequest = z.infer<typeof updateDocumentRequestSchema>;

export interface DocumentListItem {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPayload {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ── Streaming provocation type ──
// Streaming supports requirement discovery through a side-by-side wireframe + dialogue experience.

export const workspaceMode = ["standard", "streaming"] as const;
export type WorkspaceMode = typeof workspaceMode[number];

// A single entry in the streaming dialogue (agent question + user answer)
export const streamingDialogueEntrySchema = z.object({
  id: z.string(),
  role: z.enum(["agent", "user"]),
  content: z.string(),
  timestamp: z.number(),
});

export type StreamingDialogueEntry = z.infer<typeof streamingDialogueEntrySchema>;

// A single requirement extracted from the streaming dialogue
export const streamingRequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["draft", "confirmed", "revised"]),
  timestamp: z.number(),
});

export type StreamingRequirement = z.infer<typeof streamingRequirementSchema>;

// Request to generate the next streaming question
export const streamingQuestionRequestSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  document: z.string().optional(),
  websiteUrl: z.string().optional(),
  wireframeNotes: z.string().optional(),
  previousEntries: z.array(streamingDialogueEntrySchema).optional(),
  requirements: z.array(streamingRequirementSchema).optional(),
});

export type StreamingQuestionRequest = z.infer<typeof streamingQuestionRequestSchema>;

// Response from streaming question endpoint
export interface StreamingQuestionResponse {
  question: string;
  topic: string;
  suggestedRequirement?: string;
}

// Request to analyze wireframe components
export const wireframeAnalysisRequestSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  websiteUrl: z.string().optional(),
  wireframeNotes: z.string().optional(),
  document: z.string().optional(),
});

export type WireframeAnalysisRequest = z.infer<typeof wireframeAnalysisRequestSchema>;

// Structured content discovery item
export interface SiteMapEntry {
  url: string;
  title: string;
  depth: number; // 0 = landing page, 1 = direct child, etc.
}

export interface DiscoveredMedia {
  url: string;
  title: string;
  type?: string; // e.g. "mp4", "webm", "mp3", "rss+xml"
}

// Response from wireframe analysis
export interface WireframeAnalysisResponse {
  analysis: string;
  components: string[];
  suggestions: string[];
  // Structured content discovery (populated async)
  siteMap?: SiteMapEntry[];
  videos?: DiscoveredMedia[];
  audioContent?: DiscoveredMedia[];
  rssFeeds?: DiscoveredMedia[];
  images?: DiscoveredMedia[];
  primaryContent?: string; // Main textual content extracted from the site
  contentScanStatus?: "pending" | "scanning" | "complete";
}

// Request to refine requirements from streaming dialogue
export const streamingRefineRequestSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  dialogueEntries: z.array(streamingDialogueEntrySchema).min(1, "At least one dialogue entry is required"),
  existingRequirements: z.array(streamingRequirementSchema).optional(),
  document: z.string().optional(),
});

export type StreamingRefineRequest = z.infer<typeof streamingRefineRequestSchema>;

export interface StreamingRefineResponse {
  requirements: StreamingRequirement[];
  updatedDocument: string;
  summary: string;
}
