/**
 * Persona ↔ Markdown serialization.
 *
 * Converts a structured Persona object into an editable markdown document
 * that the Workspace can work with, and vice versa.
 */

import type { Persona } from "@shared/schema";

/**
 * Serialize a Persona object into a structured markdown document
 * for editing in the Workspace.
 */
export function serializePersonaToMarkdown(persona: Persona): string {
  const lines: string[] = [];

  lines.push(`# ${persona.label}`);
  lines.push("");
  lines.push(`**ID:** \`${persona.id}\``);
  lines.push(`**Role:** ${persona.role}`);
  lines.push(`**Domain:** ${persona.domain}`);
  lines.push(`**Parent:** ${persona.parentId ?? "none (root)"}`);
  lines.push(`**Icon:** ${persona.icon}`);
  lines.push("");

  lines.push("## Description");
  lines.push("");
  lines.push(persona.description);
  lines.push("");

  lines.push("## Challenge Prompt");
  lines.push("");
  lines.push(persona.prompts.challenge);
  lines.push("");

  lines.push("## Advice Prompt");
  lines.push("");
  lines.push(persona.prompts.advice);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Challenge:** ${persona.summary.challenge}`);
  lines.push(`- **Advice:** ${persona.summary.advice}`);
  lines.push("");

  lines.push("## Visual");
  lines.push("");
  lines.push(`- **Text color:** \`${persona.color.text}\``);
  lines.push(`- **Background:** \`${persona.color.bg}\``);
  lines.push(`- **Accent:** \`${persona.color.accent}\``);

  if (persona.humanCurated) {
    lines.push("");
    lines.push("## Curation Status");
    lines.push("");
    lines.push("**LOCKED — Human Curated**");
    if (persona.curatedAt) {
      lines.push(`- Curated at: ${persona.curatedAt}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build an objective string summarizing what the user is editing.
 * Used to pre-populate the Workspace objective field.
 */
export function buildPersonaEditObjective(persona: Persona): string {
  return `Refine the "${persona.label}" persona definition (${persona.domain} domain). ` +
    `Current role: ${persona.role}. ` +
    `Focus on improving the challenge and advice prompts for clarity, specificity, and actionability.`;
}
