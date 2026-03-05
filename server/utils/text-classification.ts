/**
 * Shared text classification utilities.
 *
 * These functions are used by both the route handlers and the context builder.
 * Centralizing them here eliminates the duplication that previously existed
 * between server/routes.ts and server/context-builder.ts.
 */

import type { InstructionType } from "@shared/schema";

// ---------------------------------------------------------------------------
// Speech artifact detection
// ---------------------------------------------------------------------------

const speechArtifacts = [
  /\b(um|uh|er|ah|like|you know|basically|so basically|I mean|kind of|sort of)\b/gi,
  /\b(gonna|wanna|gotta|kinda|sorta)\b/gi,
  /(\w+)\s+\1\b/gi,
  /^(so|and|but|okay|alright|well)\s/i,
];

export function isLikelyVoiceTranscript(text: string): boolean {
  let artifactCount = 0;
  for (const pattern of speechArtifacts) {
    const matches = text.match(pattern);
    if (matches) artifactCount += matches.length;
  }
  const wordCount = text.split(/\s+/).length;
  return artifactCount > 0 && artifactCount / wordCount > 0.02;
}

// ---------------------------------------------------------------------------
// Instruction classification
// ---------------------------------------------------------------------------

const instructionPatterns: Record<InstructionType, RegExp[]> = {
  expand: [/expand/i, /elaborate/i, /add.*detail/i, /develop/i, /flesh out/i, /more about/i, /tell me more/i, /explain.*further/i],
  condense: [/condense/i, /shorten/i, /shorter/i, /summarize/i, /brief/i, /concise/i, /cut/i, /reduce/i, /tighten/i, /trim/i],
  restructure: [/restructure/i, /reorganize/i, /reorder/i, /move/i, /rearrange/i, /add.*section/i, /add.*heading/i, /split/i, /merge.*section/i],
  clarify: [/clarify/i, /simplify/i, /clearer/i, /easier.*understand/i, /plain/i, /straightforward/i, /confus/i],
  style: [/tone/i, /voice/i, /formal/i, /informal/i, /professional/i, /casual/i, /friendly/i, /academic/i, /style/i],
  correct: [/fix/i, /correct/i, /error/i, /mistake/i, /typo/i, /grammar/i, /spelling/i, /wrong/i, /inaccurate/i],
  general: [],
};

export function classifyInstruction(instruction: string): InstructionType {
  const lower = instruction.toLowerCase();
  for (const [type, patterns] of Object.entries(instructionPatterns)) {
    if (type === "general") continue;
    for (const pattern of patterns) {
      if (pattern.test(lower)) return type as InstructionType;
    }
  }
  return "general";
}

export const instructionStrategies: Record<InstructionType, string> = {
  expand: "Add depth, examples, supporting details, and elaboration. Develop ideas more fully while maintaining coherence.",
  condense: "Remove redundancy, tighten prose, eliminate filler words. Preserve core meaning while reducing length.",
  restructure: "Reorganize content for better flow. Add or modify headings, reorder sections, improve logical progression.",
  clarify: "Simplify language, add transitions, break down complex ideas. Make the text more accessible without losing meaning.",
  style: "Adjust the voice and tone. Maintain the content while shifting the register, formality, or emotional quality.",
  correct: "Fix errors in grammar, spelling, facts, or logic. Make precise corrections without unnecessary changes.",
  general: "Make targeted improvements based on the specific instruction. Balance multiple considerations appropriately.",
};
