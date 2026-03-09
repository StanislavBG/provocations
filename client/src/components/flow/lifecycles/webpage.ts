/**
 * Webpage node lifecycle handlers.
 * Takes input content from context edges, sends to LLM with instructions
 * to generate a self-contained HTML page with inline CSS.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";
import { edgeHasRole } from "../useFlowCanvas";

const STYLE_PROMPTS: Record<string, string> = {
  "modern-minimal": "Use a modern, minimal design with generous whitespace, clean sans-serif typography, and a muted color palette.",
  "corporate": "Use a professional corporate design with structured sections, a header bar, clear hierarchy, and a navy/blue color scheme.",
  "creative": "Use a bold, creative design with vibrant gradients, interesting layouts, decorative elements, and expressive typography.",
  "technical-docs": "Use a technical documentation style with a table of contents sidebar, code-friendly monospace sections, and a light neutral theme.",
};

const SYSTEM_PROMPT = `You are a web page generator. Given content, generate a complete, self-contained HTML page.

Rules:
- Output ONLY valid HTML (<!DOCTYPE html> to </html>). No markdown, no explanation.
- All CSS must be inline in a <style> tag in <head>. No external stylesheets or CDN links.
- No external scripts, fonts, or resources. Everything self-contained.
- Use modern, semantic HTML5 elements.
- Make the page responsive (use media queries for mobile).
- Include proper meta viewport tag.
- Ensure accessibility: good contrast, alt texts, heading hierarchy.
- The design should be polished and production-ready.`;

export function createWebpageHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      // Gather all input content from context and user-prompt edges
      const contentParts: string[] = [];

      for (const edge of ctx.inputEdges) {
        const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
        if (sourceNode) {
          const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
          if (text.trim()) {
            const role = edgeHasRole(edge, "user-prompt") ? "Layout instructions" : "Content";
            contentParts.push(`--- ${role}: ${sourceNode.label || "Input"} ---\n${text.trim()}`);
          }
        }
      }

      // Add any custom instructions from the node
      const styleKey = ctx.node.webpageStylePreference || "modern-minimal";
      const stylePrompt = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS["modern-minimal"];
      const customInstructions = ctx.node.webpageInstructions?.trim() || "";

      const system = [
        SYSTEM_PROMPT,
        stylePrompt,
        customInstructions ? `Additional instructions: ${customInstructions}` : "",
      ].filter(Boolean).join("\n\n");

      const userMessage = contentParts.join("\n\n") || "Generate a sample webpage.";

      const body = {
        model: "gemini-2.5-flash",
        system,
        userMessage,
        temperature: 0.7,
        topP: 0.95,
        topK: 0,
        maxTokens: 16384,
        safetyLevel: "none",
        enableSearch: false,
      };

      const res = await apiRequest("POST", "/api/llm-base/generate", body);
      const data = (await res.json()) as { output: string };
      let html = data.output || "";

      // Strip markdown code fences if the model wrapped output in ```html ... ```
      html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

      return html;
    },
  };
}
