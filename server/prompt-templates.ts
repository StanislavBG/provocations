/**
 * Prompt Template System (G3)
 *
 * Provides versioned, parameterized prompt templates for all main LLM task types.
 * Templates use {{variable}} placeholders that are rendered at call time.
 *
 * Benefits:
 *   - Single source of truth for prompt structure
 *   - Version tracking for A/B testing and rollback
 *   - Consistent variable substitution across all endpoints
 *   - Explicit maxOutputTokens and temperature per template
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptTemplate {
  id: string;
  version: number;
  template: string;
  variables: string[];
  maxOutputTokens: number;
  temperature: number;
}

// ---------------------------------------------------------------------------
// Template renderer
// ---------------------------------------------------------------------------

/**
 * Render a prompt template by replacing {{variable}} placeholders with values.
 * Missing variables are replaced with empty string.
 */
export function renderTemplate(
  template: PromptTemplate,
  vars: Record<string, string>,
): string {
  let result = template.template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  // Remove any unreplaced placeholders
  result = result.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
  return result;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  challenge: {
    id: "challenge",
    version: 2,
    template: `{{systemRole}}

AVAILABLE PERSONAS:
{{personaDescriptions}}
{{guidanceSection}}{{referenceSection}}

{{challengeInstructions}}`,
    variables: [
      "systemRole",
      "personaDescriptions",
      "guidanceSection",
      "referenceSection",
      "challengeInstructions",
    ],
    maxOutputTokens: 4096,
    temperature: 1.0,
  },

  advice: {
    id: "advice",
    version: 2,
    template: `{{personaPrompt}}

You are the {{personaLabel}}.

THE PROVOCATION:
Title: {{challengeTitle}}
Detail: {{challengeContent}}

{{objective}}
{{discussionHistory}}{{toneGuidance}}

RULES:
1. Start from the provocation — don't repeat it
2. Reference the current {{documentType}}
3. Serve the objective
4. Build on discussion history if present
5. Be concrete with actionable steps{{extraAdviceRule}}
6. Speak from your persona expertise`,
    variables: [
      "personaPrompt",
      "personaLabel",
      "challengeTitle",
      "challengeContent",
      "objective",
      "discussionHistory",
      "toneGuidance",
      "documentType",
      "extraAdviceRule",
    ],
    maxOutputTokens: 2048,
    temperature: 1.0,
  },

  write: {
    id: "write",
    version: 2,
    template: `You are an expert document editor helping a user iteratively shape their document. The document format is MARKDOWN.

{{objective}}

INSTRUCTION TYPE: {{instructionType}}
STRATEGY: {{strategy}}
{{assembled}}{{provocationSection}}{{toneSection}}{{lengthSection}}

Guidelines:
1. {{focusInstruction}}
2. Preserve document voice and structure unless asked to change
3. Make targeted improvements, not wholesale rewrites
4. Output the complete evolved document
5. ALL output must be valid markdown
6. Preserve embedded images exactly

PRESERVATION RULES:
{{preservationRules}}

Output only the evolved markdown document. No explanations.`,
    variables: [
      "objective",
      "instructionType",
      "strategy",
      "assembled",
      "provocationSection",
      "toneSection",
      "lengthSection",
      "focusInstruction",
      "preservationRules",
    ],
    maxOutputTokens: 8192,
    temperature: 1.0,
  },

  chat: {
    id: "chat",
    version: 2,
    template: `{{appContext}}

{{systemGuidance}}

{{objective}}
{{notesSection}}
{{conversationHistory}}

Stay focused on the topic and objective. Provide substantive, well-structured responses.`,
    variables: [
      "appContext",
      "systemGuidance",
      "objective",
      "notesSection",
      "conversationHistory",
    ],
    maxOutputTokens: 4096,
    temperature: 0.8,
  },

  interview: {
    id: "interview",
    version: 2,
    template: `{{interviewerRole}}

{{objective}}
{{templateSection}}
{{directionSection}}
{{guidanceSection}}

BEHAVIOR:
- ONLY respond to what the user says
- {{behaviorRules}}
- Keep responses concise

{{previousQA}}
{{currentDocument}}

Output JSON: {"question": "...", "topic": "...", "suggestedRequirement": "..."(optional)}`,
    variables: [
      "interviewerRole",
      "objective",
      "templateSection",
      "directionSection",
      "guidanceSection",
      "behaviorRules",
      "previousQA",
      "currentDocument",
    ],
    maxOutputTokens: 1024,
    temperature: 0.9,
  },
};

/**
 * Get a prompt template by ID, or undefined if not found.
 */
export function getPromptTemplate(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[id];
}
