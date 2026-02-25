/**
 * Unified Context Builder — standardizes how all LLM invocations
 * construct their prompt context.
 *
 * Every task type uses this builder to assemble context sections
 * in a consistent format. This replaces the per-endpoint ad-hoc
 * context construction scattered across routes.ts.
 */

import type {
  ReferenceDocument,
  ContextItem,
  EditHistoryEntry,
  InterviewEntry,
  DiscussionMessage,
  StreamingDialogueEntry,
  StreamingRequirement,
  InstructionType,
  WireframeAnalysisResponse,
  TemplateId,
} from "@shared/schema";
import { builtInPersonas, getPersonaById } from "@shared/personas";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Default truncation limits — one place to change them */
export const LIMITS = {
  document: 8000,
  documentShort: 6000,
  documentBrief: 2000,
  documentFull: 50000,
  reference: 500,
  wireframe: 3000,
  historyEntries: 5,
  discussionEntries: 10,
} as const;

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

// ---------------------------------------------------------------------------
// Section builders — each returns a formatted string or empty
// ---------------------------------------------------------------------------

/** Format a document for inclusion in context, with consistent truncation */
export function formatDocument(
  doc: string | undefined,
  maxLen: number = LIMITS.document,
): string {
  if (!doc || !doc.trim()) return "";
  if (doc.length <= maxLen) return doc;
  return doc.slice(0, maxLen) + `\n...(truncated at ${maxLen} chars)`;
}

/** Format the objective section */
export function formatObjective(
  objective: string | undefined,
  secondaryObjective?: string,
): string {
  if (!objective) return "";
  let out = `DOCUMENT OBJECTIVE: ${objective}`;
  if (secondaryObjective?.trim()) {
    out += `\nSECONDARY OBJECTIVE: ${secondaryObjective}`;
  }
  return out;
}

/** Format edit history consistently */
export function formatEditHistory(
  history: EditHistoryEntry[] | undefined,
  maxEntries = LIMITS.historyEntries,
): string {
  if (!history || history.length === 0) return "";
  const items = history
    .slice(-maxEntries)
    .map(
      (e) =>
        `- [${e.instructionType}] ${e.instruction.slice(0, 80)}${e.instruction.length > 80 ? "..." : ""}`,
    )
    .join("\n");
  return `RECENT EDIT HISTORY (maintain consistency with previous changes):\n${items}`;
}

/** Format interview entries consistently */
export function formatInterviewEntries(
  entries: InterviewEntry[] | undefined,
): string {
  if (!entries || entries.length === 0) return "";
  return entries
    .map((e) => `Topic: ${e.topic}\nQ: ${e.question}\nA: ${e.answer}`)
    .join("\n\n");
}

/** Format discussion messages consistently */
export function formatDiscussionHistory(
  messages: DiscussionMessage[] | undefined,
  maxEntries = LIMITS.discussionEntries,
): string {
  if (!messages || messages.length === 0) return "";
  const items = messages
    .slice(-maxEntries)
    .map((m) => {
      const label =
        m.role === "user-question"
          ? "User asks"
          : m.role === "user-answer"
            ? "User answers"
            : m.role === "persona-response"
              ? "Persona team"
              : "System";
      return `[${label}]: ${m.content}`;
    })
    .join("\n\n");
  return `RECENT DISCUSSION:\n${items}`;
}

/** Format streaming dialogue entries consistently */
export function formatDialogueEntries(
  entries: StreamingDialogueEntry[] | undefined,
): string {
  if (!entries || entries.length === 0) return "";
  return entries.map((e) => `[${e.role}]: ${e.content}`).join("\n\n");
}

/** Format reference documents with style metrics */
export function formatReferenceDocuments(
  docs: ReferenceDocument[] | undefined,
): string {
  if (!docs || docs.length === 0) return "";

  const sections: string[] = ["STYLE GUIDANCE (extracted from reference documents):"];

  for (const doc of docs) {
    const metrics = extractStyleMetrics(doc.content);
    const typeLabel =
      doc.type === "style" ? "STYLE GUIDE" : doc.type === "template" ? "TEMPLATE" : "EXAMPLE";

    sections.push(`\n[${typeLabel}: ${doc.name}]`);
    sections.push(`- Average sentence length: ${metrics.avgSentenceLength} words`);
    sections.push(`- Average paragraph length: ${metrics.avgParagraphLength} sentences`);
    if (metrics.formalityIndicators.length > 0) {
      sections.push(`- Formality: ${metrics.formalityIndicators.join(", ")}`);
    }
    if (metrics.structurePatterns.length > 0) {
      sections.push(`- Structure: ${metrics.structurePatterns.join(", ")}`);
    }
  }

  sections.push("\nMatch these style characteristics in your edits.");

  // Also include brief excerpts
  const excerpts = docs
    .map((d) => {
      const label =
        d.type === "style" ? "STYLE GUIDE" : d.type === "template" ? "TEMPLATE" : "EXAMPLE";
      return `[${label}: ${d.name}]\n${d.content.slice(0, LIMITS.reference)}${d.content.length > LIMITS.reference ? "..." : ""}`;
    })
    .join("\n\n---\n\n");

  return `${sections.join("\n")}\n\nREFERENCE EXCERPTS:\n${excerpts}`;
}

/** Format captured context items consistently */
export function formatCapturedContext(items: ContextItem[] | undefined): string {
  if (!items || items.length === 0) return "";

  const entries = items
    .map((item, i) => {
      const num = i + 1;
      const annotation = item.annotation ? `\n   Why it matters: ${item.annotation}` : "";
      if (item.type === "text") {
        return `${num}. [TEXT] ${item.content.slice(0, 500)}${item.content.length > 500 ? "..." : ""}${annotation}`;
      } else if (item.type === "image") {
        return `${num}. [IMAGE] (visual reference provided by user)${annotation}`;
      }
      return `${num}. [DOCUMENT LINK] ${item.content}${annotation}`;
    })
    .join("\n\n");

  return `CAPTURED CONTEXT (reference items the author collected):\n${entries}`;
}

/** Format requirements consistently */
export function formatRequirements(
  reqs: StreamingRequirement[] | undefined,
): string {
  if (!reqs || reqs.length === 0) return "";
  return reqs.map((r) => `- [${r.status}] ${r.text}`).join("\n");
}

/** Format wireframe analysis for context */
export function formatWireframeContext(
  url?: string,
  analysis?: WireframeAnalysisResponse | null,
  notes?: string,
): string {
  const parts: string[] = [];
  if (url) parts.push(`TARGET WEBSITE: ${url}`);
  if (analysis) {
    if (analysis.analysis) parts.push(`Site analysis: ${analysis.analysis}`);
    if (analysis.components?.length) parts.push(`UI components: ${analysis.components.join(", ")}`);
    if (analysis.suggestions?.length) parts.push(`Patterns: ${analysis.suggestions.join(", ")}`);
    if (analysis.primaryContent) parts.push(`Content: ${analysis.primaryContent.slice(0, 500)}`);
    if (analysis.siteMap?.length) {
      parts.push(`Site map: ${analysis.siteMap.map((p) => `${p.title} (${p.url})`).join(", ")}`);
    }
  }
  if (notes) parts.push(`Wireframe notes: ${notes.slice(0, LIMITS.wireframe)}`);
  return parts.length > 0 ? `WEBSITE CONTEXT:\n${parts.join("\n")}` : "";
}

/** Format persona context for prompts */
export function formatPersonaContext(
  personaIds?: string[],
  mode?: string,
): string {
  if (!personaIds || personaIds.length === 0) return "";

  const personas = personaIds
    .map((id) => getPersonaById(id))
    .filter(Boolean);

  if (personas.length === 0) return "";

  const lines = personas.map((p) => {
    if (!p) return "";
    const modeHint = mode === "advise" ? p.summary.advice : p.summary.challenge;
    return `- ${p.label} (${p.role}): ${modeHint}`;
  });

  return `ACTIVE PERSONAS:\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// App-type context — injects application-aware guidance into every prompt
// ---------------------------------------------------------------------------

/** App-specific configurations that shape LLM behavior */
export interface AppTypeConfig {
  /** What the document IS (used in system prompts) */
  documentType: string;
  /** How the LLM should treat the document */
  systemGuidance: string;
  /** Tone for feedback/challenges */
  feedbackTone: string;
  /** Whether output should be code (SQL), prose (markdown), or email */
  outputFormat: "sql" | "markdown" | "email";
}

const APP_TYPE_CONFIGS: Record<TemplateId, AppTypeConfig> = {
  "write-a-prompt": {
    documentType: "AI prompt",
    systemGuidance: `APPLICATION CONTEXT: Prompt Writer
The document is an AI prompt being crafted using the AIM framework (Actor, Input, Mission).

YOUR ROLE: Help the user write a clear, precise prompt that an AI can execute without ambiguity.
Be direct and clarity-focused — push for specificity in the Actor, Input, and Mission.

RULES:
- Focus on: clarity (can an AI act on this without follow-up?), completeness (Actor, Input, Mission all defined), specificity (concrete output format, length, style constraints)
- Challenge vague instructions — "write something good" should become "write a 500-word blog post in conversational tone"
- Preserve the user's intent while sharpening precision`,
    feedbackTone: "direct and clarity-focused",
    outputFormat: "markdown",
  },

  "gpt-to-context": {
    documentType: "research summary",
    systemGuidance: `APPLICATION CONTEXT: GPT to Context — Research Workspace

The user is conducting iterative research through a chat-based interface. They have:
- A research topic (what they want to explore)
- An objective (what the research feeds into)
- Notes they are building as they discover useful information
- A conversation history with you

YOUR ROLE: You are a focused research assistant. Help the user explore their topic deeply and thoroughly.
Be knowledgeable, concise, and probing — surface insights, challenge assumptions, and suggest angles the user hasn't considered.

RULES:
- Stay focused on the stated research topic and objective
- Provide substantive, well-structured responses with concrete details
- When the user asks a question, answer it thoroughly but also suggest follow-up angles
- Reference the user's notes and prior conversation to avoid repeating ground already covered
- Identify gaps in the research — what hasn't been explored yet?
- Keep responses focused and scannable (use bullet points, headers when helpful)
- Do NOT write summaries unprompted — the user controls when to generate a summary`,
    feedbackTone: "analytical and synthesis-focused",
    outputFormat: "markdown",
  },

  "product-requirement": {
    documentType: "product requirement document",
    systemGuidance: `APPLICATION CONTEXT: Product Requirement — Secretary Mode
The document is a PRD for an incremental software feature. The PM owns this document.

YOUR ROLE: You are the PM's secretary. Your job is to listen intently to instructions and organize the PM's thoughts into the document faithfully. You do NOT have creative license — you execute precisely what the PM asks.

CORE PRINCIPLES:
- The PM is the expert. When they state something must be a certain way, you follow it without pushback.
- Make ONLY the changes the PM explicitly requests. Do not reorganize, rephrase, or "improve" parts they didn't mention.
- If the PM says "add a bullet point", add exactly one bullet point — do not merge, remove, or reorder existing bullets.
- If the PM defines an outline, that outline is sacred. Do not restructure sections unless explicitly told to.
- Keep changes targeted and minimal. A small instruction means a small change, not a document-wide rewrite.
- When the PM dictates clean intent, transcribe it faithfully into the appropriate section of the document.

RULES:
- NEVER rewrite sections the PM didn't reference in their instruction
- NEVER merge, consolidate, or remove bullet points unless explicitly asked
- NEVER change headings, section order, or document structure unless explicitly asked
- NEVER add creative flourishes, examples, or elaborations the PM didn't request
- NEVER summarize or condense content unless the PM says "condense" or "shorten"
- Preserve the PM's exact wording when they dictate specific text
- If session notes contain rules or constraints, follow them absolutely
- When the instruction is ambiguous about scope, default to the narrowest interpretation`,
    feedbackTone: "precise and faithful",
    outputFormat: "markdown",
  },

  "new-application": {
    documentType: "application specification",
    systemGuidance: `APPLICATION CONTEXT: New Application Spec
The document is a comprehensive specification for a new SaaS application being built from scratch.

YOUR ROLE: Help the user create a complete, buildable application spec covering users, features, architecture, and deployment.
Be thorough and questioning — challenge assumptions about scope, technical choices, and user needs.

RULES:
- Focus on: vision clarity (one-sentence pitch), user definition (who, pain point, current workflow), feature scoping (MVP vs V2), technical architecture (data model, auth, API design)
- Push for specificity in data models and API endpoints
- Challenge the business model and user acquisition strategy`,
    feedbackTone: "thorough and questioning",
    outputFormat: "markdown",
  },

  streaming: {
    documentType: "requirements document",
    systemGuidance: `APPLICATION CONTEXT: Screen Capture & Requirements
The document is a requirements specification being built from screenshots, annotations, and iterative questioning.

YOUR ROLE: Help the user extract precise requirements from visual observations and annotations.
Be precise and detail-oriented — push for clarity on user flows, edge cases, and acceptance criteria.

RULES:
- Focus on: translating visual observations into structured requirements, identifying gaps between what's shown and what's specified
- Push for user flow completeness — what happens on click, on error, on edge case
- Challenge requirements that are ambiguous or untestable`,
    feedbackTone: "precise and detail-oriented",
    outputFormat: "markdown",
  },


  "persona-definition": {
    documentType: "persona definition",
    systemGuidance: `APPLICATION CONTEXT: Persona / Agent Definition
The document is a structured profile for a persona, character, or AI agent.

YOUR ROLE: Help the user create a coherent, consistent persona with clear identity, motivations, and behavioral constraints.
Be character-focused and consistency-driven — challenge internal contradictions and missing edge cases.

RULES:
- Focus on: trait coherence (do the traits work together?), behavioral specificity (how does the persona handle conflict, uncertainty, boundaries?), distinctiveness (what makes this persona different from a generic chatbot?)
- Push for concrete example exchanges that demonstrate the persona under pressure
- Challenge missing failure modes and boundary conditions`,
    feedbackTone: "character-focused and consistency-driven",
    outputFormat: "markdown",
  },

  "research-context": {
    documentType: "research context library",
    systemGuidance: `APPLICATION CONTEXT: Research Context Library (AGGREGATE MODE)
The document is a dynamic context farm — a growing, structured collection of sources, notes, and synthesized findings.

YOUR ROLE: You are a note-taker and context aggregator. Your primary job is to GROW this document by incorporating new material, NOT to rewrite what already exists.

CRITICAL AGGREGATE RULES:
1. NEVER delete or substantially rewrite existing content — only improve organization
2. APPEND new information under the most relevant existing section, or create a new section
3. After appending, REORGANIZE: group related items, improve section headings, merge true duplicates (but keep distinct viewpoints separate)
4. Add source attribution where possible (URL, author, date)
5. Maintain these standard sections:
   - **Sources**: All referenced materials with URLs and brief descriptions
   - **Key Findings**: Organized by theme, with source citations
   - **Patterns & Connections**: Cross-references between findings
   - **Gaps & Questions**: What's still unknown or needs further research
6. When material contradicts existing content, note the contradiction — don't silently resolve it
7. Each entry should be traceable back to its source

ADDITIONAL FOCUS:
- Source diversity (multiple perspectives represented)
- Recency (flag if sources are dated)
- Gap identification (what's still unknown?)
- Push for cross-referencing between sources`,
    feedbackTone: "analytical and gap-finding",
    outputFormat: "markdown",
  },

  "voice-capture": {
    documentType: "voice capture document",
    systemGuidance: `APPLICATION CONTEXT: Voice Capture
The document was created from spoken ideas — the user talked through their thoughts and the AI structured them.

YOUR ROLE: Help the user refine and organize their spoken ideas into clear, well-structured content.
Be clarifying and structure-focused — help resolve contradictions, identify action items, and impose logical order.

RULES:
- Focus on: intent clarity (what did the speaker actually mean?), structure (logical grouping of related ideas), action items (concrete next steps with owners), contradiction resolution (speaker may have changed their mind mid-capture)
- Preserve the speaker's voice and intent while adding structure
- Challenge unclear commitments and unresolved questions`,
    feedbackTone: "clarifying and structure-focused",
    outputFormat: "markdown",
  },


  "youtube-to-infographic": {
    documentType: "infographic spec from YouTube content",
    systemGuidance: `APPLICATION CONTEXT: YouTube → Infographic Pipeline
The document is generated from YouTube video content — a transcript is processed into a structured summary and then into an infographic specification.

YOUR ROLE: Help the user extract the most impactful visual narrative from video content.
Be visual-design-aware and information-hierarchy-focused — challenge whether the infographic tells a clear story that stands alone without the video.

RULES:
- Focus on: information density (is this too much for one visual?), narrative arc (does the infographic have a clear beginning, middle, and end?), visual hierarchy (what's the most important takeaway and does the layout emphasize it?), source fidelity (does the infographic accurately represent the video's claims?), audience fit (who will see this and what do they need to take away?)
- Challenge any section that summarizes without adding visual value
- Push for concrete data points, quotes, and statistics over vague summaries
- Ensure the infographic stands alone — a viewer who never watches the video should understand the key message`,
    feedbackTone: "visual-design-focused and narrative-driven",
    outputFormat: "markdown",
  },

  "email-composer": {
    documentType: "business email",
    systemGuidance: `APPLICATION CONTEXT: Email Composer
The document is a BUSINESS EMAIL, not a prose document or article. The user is composing a professional email to send.

YOUR ROLE: Help the user compose a clear, professional business email that achieves its communication goal.
Be direct and professional — focus on clarity, appropriate tone for the audience, and a clear call to action.

OUTPUT FORMAT:
- The output MUST be formatted as an email with Subject line, greeting, body, and sign-off
- Use this structure:
  **Subject:** [concise, specific subject line]

  [Greeting],

  [Body paragraphs — concise, professional, purposeful]

  [Call to action or next steps]

  [Professional sign-off],
  [Sender name placeholder]

RULES:
- Business professional tone by default — adjust formality based on audience context provided
- Front-load the purpose: the recipient should know why they're reading within the first two sentences
- Every email MUST have a clear call to action or next step
- Keep it concise — respect the recipient's time. Aim for the minimum words needed to achieve the goal
- When the user provides context about recipients (role, relationship, communication preferences), adapt tone accordingly:
  * C-suite/executives: extremely concise, lead with impact, no fluff
  * Peers/colleagues: warm but efficient, collaborative language
  * Clients/external: polished, relationship-aware, clear deliverables
  * Direct reports: clear expectations, supportive tone
- Use CAPTURED CONTEXT about people/recipients to shape tone, framing, and relationship dynamics
- Never use generic filler ("I hope this email finds you well") unless culturally appropriate for the specific recipient
- If the purpose is unclear, ask via provocations rather than guessing`,
    feedbackTone: "direct and professional — focus on clarity, tone, and actionability",
    outputFormat: "email",
  },

  "text-to-infographic": {
    documentType: "infographic specification from text description",
    systemGuidance: `APPLICATION CONTEXT: Text → Infographic Pipeline (3-stage LLM pipeline)
The user provides unstructured input (conversations, meetings, notes, talks) that flows through three LLM stages:
1. CLEAN SUMMARY: Extract discussion topics as clean bullet points (strip small talk, filler, greetings)
2. ARTISTIC COMPOSITION: A composer/mixer ties the points into a visual narrative storyline for an infographic
3. IMAGE GENERATION: DALL-E renders the artistic specification into a visual infographic

YOUR ROLE: Help the user prepare raw text that will flow well through this pipeline. The raw input is typically unstructured — spoken ideas, meeting notes, conversation transcripts. Challenge whether the input contains enough substance, clear data points, and distinct topics to produce a compelling infographic.

RULES:
- Focus on: substance density (is there enough real content vs filler?), distinct topics (are there clear discussion points to extract?), data quality (specific numbers, facts, quotes that will stand out visually), narrative potential (can these points be tied into a storyline?), audience clarity (who will learn from this infographic?)
- Challenge vague or abstract content — infographics need concrete, specific information
- Push for the "so what?" — each point should have a reason to exist on the infographic
- Remember: the end goal is a visual learning experience people can understand, remember, and share`,
    feedbackTone: "clarity-focused — push for substance, specificity, and visual potential",
    outputFormat: "markdown",
  },

  "agent-editor": {
    documentType: "agent workflow definition",
    systemGuidance: `APPLICATION CONTEXT: Agent Editor
The document defines a multi-step AI agent workflow using the Input → Actor → Output framework.

YOUR ROLE: Help the user design clear, well-structured agent steps. Each step must have:
1. A clear input source (user-provided, previous step output, or global context)
2. A focused system prompt (the actor) that stays within token limits
3. An explicit output definition with type and validation rules

RULES:
- Challenge vague system prompts — push for specificity and measurable output criteria
- Flag token budget issues — system prompts over 2000 tokens should be questioned
- Ensure step-to-step compatibility — output types must match next step's expected input
- Validate the chain end-to-end — first step must accept user input, last step must produce the declared final output
- Challenge missing fallback/error handling for steps that could fail`,
    feedbackTone: "precise and architecture-focused",
    outputFormat: "markdown",
  },
};

/** Get app-specific config, or undefined for default behavior */
export function getAppTypeConfig(appType?: string): AppTypeConfig | undefined {
  if (!appType) return undefined;
  return APP_TYPE_CONFIGS[appType as TemplateId];
}

/** Format app-type context for inclusion in prompts */
export function formatAppTypeContext(appType?: string): string {
  const config = getAppTypeConfig(appType);
  if (!config) return "";
  return config.systemGuidance;
}

// ---------------------------------------------------------------------------
// Style metrics extraction (shared utility)
// ---------------------------------------------------------------------------

function extractStyleMetrics(content: string) {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const words = content.split(/\s+/).length;

  const avgSentenceLength = sentences.length > 0 ? Math.round(words / sentences.length) : 0;
  const avgParagraphLength =
    paragraphs.length > 0 ? Math.round(sentences.length / paragraphs.length) : 0;

  const formalityIndicators: string[] = [];
  if (/\b(therefore|however|moreover|furthermore|consequently)\b/i.test(content)) {
    formalityIndicators.push("uses formal transitions");
  }
  if (/\b(I|we|you)\b/i.test(content)) {
    formalityIndicators.push("uses personal pronouns");
  } else {
    formalityIndicators.push("avoids personal pronouns");
  }
  if (/\b(don't|won't|can't|isn't|aren't)\b/.test(content)) {
    formalityIndicators.push("uses contractions (informal)");
  } else {
    formalityIndicators.push("avoids contractions (formal)");
  }

  const structurePatterns: string[] = [];
  if (/^#+\s/m.test(content)) structurePatterns.push("uses markdown headers");
  if (/^[-*]\s/m.test(content)) structurePatterns.push("uses bullet lists");
  if (/^\d+\.\s/m.test(content)) structurePatterns.push("uses numbered lists");
  if (/\*\*[^*]+\*\*/.test(content)) structurePatterns.push("uses bold for emphasis");

  return { avgSentenceLength, avgParagraphLength, formalityIndicators, structurePatterns };
}

// ---------------------------------------------------------------------------
// Full context assembler — produces the CONTEXT section for any prompt
// ---------------------------------------------------------------------------

export interface ContextInput {
  document?: string;
  objective?: string;
  secondaryObjective?: string;
  instruction?: string;
  selectedText?: string;

  /**
   * Application type — tells every LLM call what kind of document we're working with.
   * When set, overrides default behavior for prompt construction, output format, and tone.
   * Examples: "query-editor", "write-a-prompt", "product-requirement", etc.
   */
  appType?: string;

  // History/conversation
  editHistory?: EditHistoryEntry[];
  interviewEntries?: InterviewEntry[];
  discussionMessages?: DiscussionMessage[];
  dialogueEntries?: StreamingDialogueEntry[];

  // References and grounding
  referenceDocuments?: ReferenceDocument[];
  capturedContext?: ContextItem[];
  requirements?: StreamingRequirement[];

  // Persona
  personaIds?: string[];
  directionMode?: string;

  // Website/wireframe
  websiteUrl?: string;
  wireframeNotes?: string;
  wireframeAnalysis?: WireframeAnalysisResponse | null;

  // Limits override
  maxDocLength?: number;
}

export interface BuiltContext {
  /** Truncated document text */
  document: string;
  /** "DOCUMENT OBJECTIVE: ..." section */
  objective: string;
  /** Formatted edit history */
  editHistory: string;
  /** Formatted interview Q&A */
  interviewEntries: string;
  /** Formatted discussion */
  discussionHistory: string;
  /** Formatted dialogue */
  dialogueEntries: string;
  /** Reference documents with style metrics */
  references: string;
  /** Captured context items */
  capturedContext: string;
  /** Requirements list */
  requirements: string;
  /** Website/wireframe context */
  wireframe: string;
  /** Persona context */
  personas: string;
  /** App-type context (e.g. "query-editor" guidance) */
  appContext: string;
  /** App-type config for conditional logic in handlers */
  appConfig: AppTypeConfig | undefined;

  /**
   * All non-empty sections joined as a single CONTEXT block,
   * ready to embed in a system prompt.
   */
  assembled: string;
}

/**
 * Build context from input — the single entry point for all task types.
 * Returns individual sections plus the full assembled block.
 */
export function buildContext(input: ContextInput): BuiltContext {
  const doc = formatDocument(input.document, input.maxDocLength ?? LIMITS.document);
  const obj = formatObjective(input.objective, input.secondaryObjective);
  const hist = formatEditHistory(input.editHistory);
  const interview = formatInterviewEntries(input.interviewEntries);
  const discussion = formatDiscussionHistory(input.discussionMessages);
  const dialogue = formatDialogueEntries(input.dialogueEntries);
  const refs = formatReferenceDocuments(input.referenceDocuments);
  const captured = formatCapturedContext(input.capturedContext);
  const reqs = formatRequirements(input.requirements);
  const wire = formatWireframeContext(
    input.websiteUrl,
    input.wireframeAnalysis,
    input.wireframeNotes,
  );
  const personas = formatPersonaContext(input.personaIds, input.directionMode);
  const appCtx = formatAppTypeContext(input.appType);
  const appConfig = getAppTypeConfig(input.appType);

  // Assemble non-empty sections — app context goes first so it frames everything
  const sections = [appCtx, obj, hist, interview, discussion, dialogue, refs, captured, reqs, wire, personas].filter(
    (s) => s.length > 0,
  );

  const assembled =
    sections.length > 0 ? `\nCONTEXT:\n${sections.join("\n\n")}` : "";

  return {
    document: doc,
    objective: obj,
    editHistory: hist,
    interviewEntries: interview,
    discussionHistory: discussion,
    dialogueEntries: dialogue,
    references: refs,
    capturedContext: captured,
    requirements: reqs,
    wireframe: wire,
    personas: personas,
    appContext: appCtx,
    appConfig: appConfig,
    assembled,
  };
}
