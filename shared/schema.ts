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

export const expandOutlineRequestSchema = z.object({
  heading: z.string().min(1, "Heading is required"),
  context: z.string().optional(),
  tone: z.enum(toneOptions).optional().default("practical"),
});

export type ExpandOutlineRequest = z.infer<typeof expandOutlineRequestSchema>;

export const refineTextRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  tone: z.enum(toneOptions),
  targetLength: z.enum(["shorter", "same", "longer"]),
});

export type RefineTextRequest = z.infer<typeof refineTextRequestSchema>;

export const mergeTextRequestSchema = z.object({
  originalText: z.string().min(1, "Original text is required"),
  userFeedback: z.string().min(1, "User feedback is required"),
  provocationContext: z.string().optional(),
});

export type MergeTextRequest = z.infer<typeof mergeTextRequestSchema>;

export const editTextRequestSchema = z.object({
  instruction: z.string().min(1, "Instruction is required"),
  selectedText: z.string().min(1, "Selected text is required"),
  fullDocument: z.string().min(1, "Full document is required"),
});

export type EditTextRequest = z.infer<typeof editTextRequestSchema>;

export interface DocumentVersion {
  id: string;
  text: string;
  timestamp: number;
  description: string;
}

// Legacy exports for compatibility with template
export const users = {} as any;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
