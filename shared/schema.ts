import { z } from "zod";

// Provocation types
export const provocationType = [
  "opportunity",
  "fallacy",
  "alternative",
  "challenge",
  "thinking_bigger",
  "performance",
  "ux",
  "architecture",
] as const;

export type ProvocationType = typeof provocationType[number];

export const provocationSchema = z.object({
  id: z.string(),
  type: z.enum(provocationType),
  title: z.string(),
  content: z.string(),
  sourceExcerpt: z.string(),
  status: z.enum(["pending", "addressed", "rejected", "highlighted"]),
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
export const analyzeTextRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  referenceDocuments: z.array(referenceDocumentSchema).optional(),
});

export type AnalyzeTextRequest = z.infer<typeof analyzeTextRequestSchema>;

// Generate provocations request (for regeneration with optional guidance)
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

// Workspace state for context provider
// Generate template request - creates a document template from an objective
export const generateTemplateRequestSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
});

export type GenerateTemplateRequest = z.infer<typeof generateTemplateRequestSchema>;

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

// Encrypted document save/load schemas
export const saveEncryptedDocumentRequestSchema = z.object({
  ownerHash: z.string().min(1, "Owner hash is required"),
  title: z.string().min(1, "Title is required").max(200),
  ciphertext: z.string().min(1, "Ciphertext is required"),
  salt: z.string().min(1, "Salt is required"),
  iv: z.string().min(1, "IV is required"),
});

export type SaveEncryptedDocumentRequest = z.infer<typeof saveEncryptedDocumentRequestSchema>;

export const listEncryptedDocumentsRequestSchema = z.object({
  ownerHash: z.string().min(1, "Owner hash is required"),
});

export type ListEncryptedDocumentsRequest = z.infer<typeof listEncryptedDocumentsRequestSchema>;

export interface EncryptedDocumentListItem {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedDocumentFull {
  id: number;
  title: string;
  ciphertext: string;
  salt: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}
