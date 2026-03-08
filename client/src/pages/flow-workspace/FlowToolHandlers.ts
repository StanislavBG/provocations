/**
 * FlowToolHandlers — Document tools and text splitting utilities (E7 extraction).
 *
 * Extracted from FlowWorkspace.tsx to reduce monolith size.
 */

import {
  Expand, Shrink, AlignJustify, Lightbulb, Paintbrush2, PenLine, Crosshair,
} from "lucide-react";

// ── Document editor tools ──

export const DOC_TOOLS = [
  { id: "expand", label: "Expand", icon: Expand, instruction: "Expand this text with more depth, examples, and supporting details" },
  { id: "condense", label: "Condense", icon: Shrink, instruction: "Remove redundancy, tighten prose, make concise" },
  { id: "restructure", label: "Restructure", icon: AlignJustify, instruction: "Reorganize content, improve headings and section order" },
  { id: "clarify", label: "Clarify", icon: Lightbulb, instruction: "Simplify language, improve accessibility and clarity" },
  { id: "style", label: "Style", icon: Paintbrush2, instruction: "Adjust voice and tone for better reading experience" },
  { id: "correct", label: "Correct", icon: PenLine, instruction: "Fix grammar, spelling, logic errors, and inconsistencies" },
  { id: "aim", label: "AIM", icon: Crosshair, instruction: "Restructure into Actor (who performs), Input (what they receive), Mission (desired outcome) framework" },
] as const;

// ── Text splitting utilities ──

/**
 * Split output by natural --- delimiters (as instructed to the LLM).
 * Falls back to heading-based splitting. Cap at maxSections.
 */
export function splitOutputByDelimiters(text: string, maxSections: number): string[] {
  // Primary: split by horizontal rule delimiters (--- on its own line)
  const hrParts = text.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
  if (hrParts.length > 1) {
    return hrParts.slice(0, maxSections);
  }

  // Fallback: split by top-level markdown headings (## )
  const headingSections: string[] = [];
  const headingRegex = /^#{1,2}\s+.+$/gm;
  let match: RegExpExecArray | null;
  const indices: number[] = [];
  while ((match = headingRegex.exec(text)) !== null) {
    indices.push(match.index);
  }
  if (indices.length > 1) {
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : text.length;
      const section = text.slice(start, end).trim();
      if (section) headingSections.push(section);
    }
    return headingSections.slice(0, maxSections);
  }

  // Last resort: return as single section
  return [text.trim()];
}

/** Split output text into N sections by markdown headings, falling back to equal chunks */
export function splitOutputIntoSections(text: string, count: number): string[] {
  // Try splitting by markdown headings (## or #)
  const headingRegex = /^#{1,3}\s+/m;
  const parts = text.split(headingRegex).filter((s) => s.trim());

  if (parts.length >= count) {
    // Re-attach heading markers and distribute
    const sections: string[] = [];
    const step = Math.ceil(parts.length / count);
    for (let i = 0; i < count; i++) {
      sections.push(parts.slice(i * step, (i + 1) * step).join("\n\n## ").trim());
    }
    return sections;
  }

  // Try splitting by horizontal rules (---)
  const hrParts = text.split(/\n---+\n/).filter((s) => s.trim());
  if (hrParts.length >= count) {
    const sections: string[] = [];
    const step = Math.ceil(hrParts.length / count);
    for (let i = 0; i < count; i++) {
      sections.push(hrParts.slice(i * step, (i + 1) * step).join("\n\n---\n\n").trim());
    }
    return sections;
  }

  // Fallback: split by paragraphs (double newlines), distribute evenly
  const paragraphs = text.split(/\n\n+/).filter((s) => s.trim());
  if (paragraphs.length >= count) {
    const sections: string[] = [];
    const step = Math.ceil(paragraphs.length / count);
    for (let i = 0; i < count; i++) {
      sections.push(paragraphs.slice(i * step, (i + 1) * step).join("\n\n").trim());
    }
    return sections;
  }

  // Last resort: equal character chunks
  const chunkSize = Math.ceil(text.length / count);
  const sections: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = text.slice(i * chunkSize, (i + 1) * chunkSize).trim();
    if (chunk) sections.push(chunk);
  }
  return sections;
}

// ── Quick hash for diff-based auto-save (E6 optimization) ──
// Simple FNV-1a 32-bit hash — fast, non-cryptographic, just for comparison.
export function quickHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
