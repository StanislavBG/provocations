import { z } from "zod";

// Lens types
export const lensTypes = [
  "consumer",
  "executive", 
  "technical",
  "financial",
  "strategic",
  "skeptic",
] as const;

export type LensType = typeof lensTypes[number];

export const lensSchema = z.object({
  id: z.string(),
  type: z.enum(lensTypes),
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  isActive: z.boolean(),
});

export type Lens = z.infer<typeof lensSchema>;

// Provocation types
export const provocationType = [
  "opportunity",
  "fallacy", 
  "alternative",
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

// API request schemas - used by both frontend and backend
export const analyzeTextRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  selectedLenses: z.array(z.enum(lensTypes)).optional(),
});

export type AnalyzeTextRequest = z.infer<typeof analyzeTextRequestSchema>;

// Unified write request - single interface to the AI writer
export const provocationContextSchema = z.object({
  type: z.enum(provocationType),
  title: z.string(),
  content: z.string(),
  sourceExcerpt: z.string(),
});

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
  activeLens: z.enum(lensTypes).optional(),

  // Style (optional)
  tone: z.enum(toneOptions).optional(),
  targetLength: z.enum(["shorter", "same", "longer"]).optional(),
});

export type WriteRequest = z.infer<typeof writeRequestSchema>;

export const writeResponseSchema = z.object({
  document: z.string(),
  summary: z.string().optional(),
});

export type WriteResponse = z.infer<typeof writeResponseSchema>;

export interface DocumentVersion {
  id: string;
  text: string;
  timestamp: number;
  description: string;
}

// Workspace state for context provider
export interface WorkspaceState {
  document: Document | null;
  objective: string;
  lenses: Lens[];
  activeLens: LensType | null;
  provocations: Provocation[];
  outline: OutlineItem[];
  currentPhase: "input" | "blank-document" | "workspace";
}
