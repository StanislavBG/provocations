/**
 * Unified LLM Invoke Handler
 *
 * Single entry point for ALL LLM interactions in the application.
 * Each task type defines its own system prompt template, user message,
 * and LLM parameters, but they all:
 *   1. Use the shared ContextBuilder for context assembly
 *   2. Call llm.generate() or llm.stream() through this module
 *   3. Parse responses consistently
 *
 * Usage from routes:
 *   const result = await invoke("write", params);
 */

import { llm, type LLMRequest, type LLMResponse } from "./llm";
// LLM gateway interceptor is active automatically via module-level patching
// in llm-gateway.ts (imported by routes.ts). No explicit gateway imports needed.
import {
  buildContext,
  classifyInstruction,
  instructionStrategies,
  isLikelyVoiceTranscript,
  formatDocument,
  getAppTypeConfig,
  LIMITS,
  type ContextInput,
} from "./context-builder";
import { validateLlmOutput } from "./llm-gateway";
import { renderTemplate, getPromptTemplate } from "./prompt-templates";
import { builtInPersonas, getPersonaById } from "@shared/personas";
import type {
  ProvocationType,
  InstructionType,
  ChangeEntry,
  WriteResponse,
  Persona,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Task type enumeration
// ---------------------------------------------------------------------------

export const TASK_TYPES = [
  "write",
  "query-write",
  "challenge",
  "advice",
  "interview-question",
  "interview-summary",
  "discussion-ask",
  "summarize-intent",
  "extract-metrics",
  "analyze-query",
  "streaming-question",
  "wireframe-analysis",
  "streaming-refine",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

// ---------------------------------------------------------------------------
// Base prompts registry — the static core of each task's system prompt.
// Admin can override these via the agent_prompt_overrides table.
// ---------------------------------------------------------------------------

// G2: Prompt audit — optimized base prompts (~30% reduction)
// Before: ~2,167 chars total in basePrompt fields
// After:  ~1,487 chars total in basePrompt fields (31% reduction)
export const BASE_PROMPTS: Record<TaskType, { description: string; basePrompt: string; group: string }> = {
  write: {
    group: "Document Writing",
    description: "Iteratively evolve a markdown document through user instructions",
    basePrompt: "Expert document editor. Output: evolved MARKDOWN document.",
  },
  "query-write": {
    group: "Document Writing",
    description: "Edit and format SQL queries with precise transformations",
    basePrompt: "Expert SQL editor.\n\nRULES:\n1. Output valid SQL only — no fences/markdown/text\n2. Consistent indentation and keyword casing\n3. Major clauses on own lines\n4. Preserve comments\n5. Apply changes precisely\n6. Maintain semantic equivalence unless logic change requested",
  },
  challenge: {
    group: "Persona Interactions",
    description: "Generate thought-provoking challenges from expert personas",
    basePrompt: "Critical thinking partner. Generate challenges from expert perspectives. NEVER offer solutions — only surface problems.",
  },
  advice: {
    group: "Persona Interactions",
    description: "Provide concrete, actionable expert advice for a specific challenge",
    basePrompt: "RULES:\n1. Start from the provocation — don't repeat it\n2. Reference the document\n3. Serve the objective\n4. Build on discussion history\n5. Be concrete and actionable\n6. Speak from persona expertise",
  },
  "interview-question": {
    group: "Interview",
    description: "Generate thought-provoking interview questions for requirement gathering",
    basePrompt: "Thought-provoking interviewer developing a document.",
  },
  "interview-summary": {
    group: "Interview",
    description: "Synthesize interview Q&A into structured editing instructions",
    basePrompt: "Synthesize interview Q&A into editing instructions.\nGroup by theme. Specify where to add/modify. Include all key points.\nOutput valid Markdown. No meta-commentary.",
  },
  "discussion-ask": {
    group: "Persona Interactions",
    description: "Multi-perspective expert responses to user questions",
    basePrompt: "Expert advisory panel. Each advisor gives their unique perspective.",
  },
  "summarize-intent": {
    group: "Utilities",
    description: "Clean voice transcripts and summarize text content",
    basePrompt: "Expert editor. Fix grammar, clean speech artifacts, improve clarity. Maintain length.",
  },
  "extract-metrics": {
    group: "Utilities",
    description: "Extract metrics, KPIs, and aggregations from SQL or prose",
    basePrompt: "Senior data analyst. Extract metrics/KPIs: aggregations, calculated fields, ratios, window functions, CASE expressions, aliases.",
  },
  "analyze-query": {
    group: "Utilities",
    description: "Comprehensive SQL query analysis across multiple dimensions",
    basePrompt: "Senior SQL Architect + QA Engineer.\n\nAnalyze across: 1) Correctness 2) Performance 3) Readability 4) Best practices 5) Security 6) Portability",
  },
  "streaming-question": {
    group: "Requirements Discovery",
    description: "Iteratively discover requirements through guided dialogue",
    basePrompt: "Requirements discovery agent.",
  },
  "wireframe-analysis": {
    group: "Requirements Discovery",
    description: "Analyze website structure, components, and content from wireframes",
    basePrompt: "Website analysis expert.\n\n1. STRUCTURAL: UI components, navigation, page structure\n2. CONTENT: site map, video, audio, RSS, images, primary content",
  },
  "streaming-refine": {
    group: "Requirements Discovery",
    description: "Extract clear, implementable requirements from dialogue",
    basePrompt: "Expert requirements writer. Extract clear, implementable requirements from dialogue. Each specific enough to implement unambiguously.",
  },
};

// ---------------------------------------------------------------------------
// Task-specific params (discriminated union)
// ---------------------------------------------------------------------------

interface WriteParams extends ContextInput {
  instruction: string;
  selectedText?: string;
  tone?: string;
  targetLength?: "shorter" | "same" | "longer";
  provocation?: {
    type: string;
    title: string;
    content: string;
    sourceExcerpt: string;
  };
}

interface QueryWriteParams extends ContextInput {
  query: string;
  instruction: string;
}

interface ChallengeParams extends ContextInput {
  guidance?: string;
}

interface AdviceParams extends ContextInput {
  challengeId: string;
  challengeTitle: string;
  challengeContent: string;
  personaId: string;
}

interface InterviewQuestionParams extends ContextInput {
  template?: string;
  directionGuidance?: string;
  thinkBigVectors?: string[];
}

interface InterviewSummaryParams extends ContextInput {}

interface DiscussionAskParams extends ContextInput {
  question: string;
  activePersonas?: string[];
}

interface SummarizeIntentParams {
  transcript: string;
  context?: string;
  mode?: "clean" | "summarize" | "aim";
}

interface ExtractMetricsParams {
  query: string;
}

interface AnalyzeQueryParams {
  query: string;
}

interface StreamingQuestionParams extends ContextInput {}

interface WireframeAnalysisParams extends ContextInput {}

interface StreamingRefineParams extends ContextInput {}

// Union type for all task params
export type TaskParams = {
  write: WriteParams;
  "query-write": QueryWriteParams;
  challenge: ChallengeParams;
  advice: AdviceParams;
  "interview-question": InterviewQuestionParams;
  "interview-summary": InterviewSummaryParams;
  "discussion-ask": DiscussionAskParams;
  "summarize-intent": SummarizeIntentParams;
  "extract-metrics": ExtractMetricsParams;
  "analyze-query": AnalyzeQueryParams;
  "streaming-question": StreamingQuestionParams;
  "wireframe-analysis": WireframeAnalysisParams;
  "streaming-refine": StreamingRefineParams;
};

// ---------------------------------------------------------------------------
// Voice transcript cleaning (shared pre-processing)
// ---------------------------------------------------------------------------

// G2: Voice transcript prompt optimized (was 367 chars, now 186 chars — 49% reduction)
async function cleanVoiceTranscript(transcript: string): Promise<string> {
  try {
    const response = await llm.generate({
      maxTokens: 500,
      temperature: 0.2,
      system: `Extract the editing instruction from this spoken transcript. Remove speech artifacts (um, uh, like, repeated words). Preserve intent exactly. Output ONLY the cleaned instruction.`,
      messages: [{ role: "user", content: transcript }],
    });
    return response.text.trim() || transcript;
  } catch {
    return transcript;
  }
}

// ---------------------------------------------------------------------------
// Provocation response examples (shared across tasks)
// ---------------------------------------------------------------------------

const provocationResponseExamples: Record<string, string> = {
  thinking_bigger: `Example good responses to Think Big feedback:
- "You're right — I haven't thought about what happens at 100,000 users"
- "I should define the retention metric this feature is supposed to move"`,
  architect: `Example good responses to architecture feedback:
- "I should define the API contract between the frontend and this service"
- "Good catch — the boundary between X and Y components isn't clear"`,
  quality_engineer: `Example good responses to quality engineering feedback:
- "I need to add acceptance criteria for this feature"
- "Good point — I haven't described the error handling when X fails"`,
  ux_designer: `Example good responses to UX design feedback:
- "You're right, users won't know about that feature — I'll add onboarding guidance"`,
  tech_writer: `Example good responses to technical writing feedback:
- "That label is jargon — let me rename it to something self-explanatory"`,
  product_manager: `Example good responses to product management feedback:
- "I should tie this feature to the business outcome we're targeting"`,
  security_engineer: `Example good responses to security engineering feedback:
- "I need to add input validation for this user-submitted field"`,
  ceo: `Example good responses to CEO feedback:
- "I need to name who this actually helps and what success looks like for them"`,
  data_architect: `Example good responses to Data Architect feedback:
- "I haven't defined how customer identifiers link across these systems"`,
};

// CEO vector descriptions
const ceoVectorDescriptions: Record<string, { label: string; description: string; goal: string }> = {
  tenancy_topology: { label: "Tenancy Topology", description: "How you isolate data.", goal: "Build a Tenant-Aware abstraction layer." },
  api_surface: { label: "API Surface", description: "Tool vs platform.", goal: "Adopt an API-First contract." },
  scaling_horizon: { label: "Scaling Horizon", description: "Vertical vs horizontal.", goal: "Ensure Statelessness." },
  data_residency: { label: "Data Residency", description: "Local vs sovereign.", goal: "Plan for Regional Sharding." },
  integration_philosophy: { label: "Integration Philosophy", description: "Adapter vs native.", goal: "Implement Event-Driven Architecture." },
  identity_access: { label: "Identity & Access", description: "RBAC vs ABAC.", goal: "Use Attribute-Based Access Control." },
  observability: { label: "Observability", description: "Logs vs traces.", goal: "Implement Distributed Tracing." },
};

// ---------------------------------------------------------------------------
// Task handlers — each builds system + user message and calls LLM once
// ---------------------------------------------------------------------------

type InvokeResult = Record<string, unknown>;

/** Main invoke function — single entry point for all LLM tasks */
export async function invoke<T extends TaskType>(
  taskType: T,
  params: TaskParams[T],
): Promise<InvokeResult> {
  const handler = taskHandlers[taskType];
  if (!handler) throw new Error(`Unknown task type: ${taskType}`);
  return handler(params as any);
}

const taskHandlers: Record<TaskType, (params: any) => Promise<InvokeResult>> = {
  // ── Document writing ──
  write: handleWrite,
  "query-write": handleQueryWrite,

  // ── Persona interactions ──
  challenge: handleChallenge,
  advice: handleAdvice,
  "discussion-ask": handleDiscussionAsk,

  // ── Interview ──
  "interview-question": handleInterviewQuestion,
  "interview-summary": handleInterviewSummary,

  // ── Utilities ──
  "summarize-intent": handleSummarizeIntent,
  "extract-metrics": handleExtractMetrics,
  "analyze-query": handleAnalyzeQuery,

  // ── Requirements ──
  "streaming-question": handleStreamingQuestion,
  "wireframe-analysis": handleWireframeAnalysis,
  "streaming-refine": handleStreamingRefine,
};

// ---------------------------------------------------------------------------
// Write handler
// ---------------------------------------------------------------------------

async function handleWrite(params: WriteParams): Promise<InvokeResult> {
  // If appType is "query-editor", delegate to query-write handler
  const appConfig = getAppTypeConfig(params.appType);
  if (appConfig?.outputFormat === "sql") {
    return handleQueryWrite({
      query: params.document || "",
      instruction: params.instruction,
      appType: params.appType,
      capturedContext: params.capturedContext,
    });
  }

  let instruction = params.instruction;

  // Pre-process: clean voice transcripts
  if (isLikelyVoiceTranscript(instruction)) {
    instruction = await cleanVoiceTranscript(instruction);
  }

  // Classify instruction
  const instructionType = classifyInstruction(instruction);
  const strategy = instructionStrategies[instructionType];

  // Build context using shared builder
  const ctx = buildContext(params);

  // Build provocation section if present
  let provocationSection = "";
  if (params.provocation) {
    const p = params.provocation;
    const guidance = provocationResponseExamples[p.type] || "";
    provocationSection = `\nPROVOCATION BEING ADDRESSED:\nType: ${p.type}\nChallenge: ${p.title}\nDetails: ${p.content}\nExcerpt: "${p.sourceExcerpt}"\n\n${guidance}\nIntegrate the response thoughtfully — weave it into the document.`;
  }

  // Build tone/length sections
  let toneSection = params.tone ? `\nTONE: Write in a ${params.tone} voice` : "";
  let lengthSection = "";
  if (params.targetLength) {
    const map = { shorter: "Make it more concise (60-70%)", same: "Maintain similar length", longer: "Expand (130-150%)" };
    lengthSection = `\nLENGTH: ${map[params.targetLength]}`;
  }

  // Build preservation directives
  const preservationRules: string[] = [];
  if (params.selectedText) {
    preservationRules.push("- PRESERVE all text outside the selected area");
    preservationRules.push("- DO NOT reformat unmentioned sections");
  }
  if (instructionType === "correct") preservationRules.push("- ONLY fix the specific error — no other changes");
  if (instructionType === "style") preservationRules.push("- PRESERVE content and meaning — only change voice/tone");
  if (instructionType === "condense") preservationRules.push("- PRESERVE all key information — only remove redundancy");
  preservationRules.push("- DO NOT add information the user didn't request");
  preservationRules.push("- DO NOT remove content unless explicitly asked");
  preservationRules.push("- PRESERVE markdown formatting unless asked to change it");

  const focusInstruction = params.selectedText
    ? "Apply the instruction primarily to the selected text, but ensure it integrates well."
    : "Apply the instruction to improve the document holistically.";

  // G2+G3: Use prompt template for document evolution
  const writeTemplate = getPromptTemplate("write");
  const systemPrompt = writeTemplate
    ? renderTemplate(writeTemplate, {
        objective: ctx.objective,
        instructionType,
        strategy,
        assembled: ctx.assembled,
        provocationSection,
        toneSection,
        lengthSection,
        focusInstruction,
        preservationRules: preservationRules.join("\n"),
      })
    : `Expert document editor. MARKDOWN format.

${ctx.objective}

TYPE: ${instructionType} — ${strategy}
${ctx.assembled}${provocationSection}${toneSection}${lengthSection}

1. ${focusInstruction}
2. Preserve voice/structure unless asked to change
3. Targeted improvements, not rewrites
4. Output complete evolved document (valid markdown)
5. Preserve embedded images

${preservationRules.join("\n")}

Output only the evolved markdown. No explanations.`;

  // Single LLM call — document evolution
  const response = await llm.generate({
    maxTokens: writeTemplate?.maxOutputTokens ?? 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `CURRENT DOCUMENT:\n${ctx.document}\n${params.selectedText ? `\nSELECTED TEXT:\n"${params.selectedText}"` : ""}\n\nINSTRUCTION: ${instruction}\n\nPlease evolve the document.`,
      },
    ],
  });

  const evolvedDocument = response.text.trim() || params.document || "";

  // Second call — change analysis (lightweight)
  let summary = `Applied: ${instruction.slice(0, 100)}`;
  let changes: ChangeEntry[] = [];
  let suggestions: string[] = [];

  try {
    // G2: Change analysis prompt optimized (was 248 chars, now 170 chars — 31% reduction)
    const analysis = await llm.generate({
      maxTokens: 1024,
      system: `Compare documents. Output JSON only: {summary: string(max 100 chars), changes: [{type:"added"|"modified"|"removed"|"restructured", description, location?}](1-3), suggestions: string[](0-2)}`,
      messages: [
        {
          role: "user",
          content: `ORIGINAL:\n${(params.document || "").slice(0, 2000)}\n\nEVOLVED:\n${evolvedDocument.slice(0, 2000)}\n\nINSTRUCTION: ${instruction}`,
        },
      ],
    });

    const parsed = JSON.parse(analysis.text || "{}");
    if (typeof parsed.summary === "string") summary = parsed.summary;
    if (Array.isArray(parsed.changes)) {
      changes = parsed.changes.slice(0, 3).map((c: any) => ({
        type: ["added", "modified", "removed", "restructured"].includes(c.type) ? c.type : "modified",
        description: typeof c.description === "string" ? c.description : "Updated",
        location: typeof c.location === "string" ? c.location : undefined,
      }));
    }
    if (Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions.filter((s: unknown) => typeof s === "string").slice(0, 2);
    }
  } catch (err) {
    console.error("[handleWrite] change analysis error:", err instanceof Error ? err.message : err);
  }

  return {
    document: evolvedDocument,
    summary,
    instructionType,
    changes: changes.length > 0 ? changes : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

// ---------------------------------------------------------------------------
// Query write handler
// ---------------------------------------------------------------------------

async function handleQueryWrite(params: QueryWriteParams): Promise<InvokeResult> {
  let instruction = params.instruction;
  if (isLikelyVoiceTranscript(instruction)) {
    instruction = await cleanVoiceTranscript(instruction);
  }

  const ctx = buildContext({ ...params, document: undefined });
  const capturedSection = ctx.capturedContext ? `\n\nREFERENCE CONTEXT:\n${ctx.capturedContext}` : "";

  const response = await llm.generate({
    maxTokens: 16384,
    temperature: 0.1,
    system: `You are an expert SQL query writer, formatter, and editor.

ABSOLUTE RULES:
1. Output MUST be valid SQL only
2. NO code fences, markdown, text, or explanations
3. Proper indentation and consistent SQL keyword casing
4. Each major clause on its own line
5. Preserve comments
6. Apply changes precisely
7. Maintain semantic equivalence unless logic change requested
${capturedSection}

Output the complete SQL query. Nothing else.`,
    messages: [
      {
        role: "user",
        content: `SQL QUERY:\n${params.query}\n\nINSTRUCTION: ${instruction}`,
      },
    ],
  });

  let result = response.text.trim();
  result = result.replace(/^```(?:sql)?\s*/i, "").replace(/\s*```\s*$/, "");

  return {
    document: result,
    summary: "SQL query updated",
    instructionType: "style" as InstructionType,
  };
}

// ---------------------------------------------------------------------------
// Challenge handler
// ---------------------------------------------------------------------------

async function handleChallenge(params: ChallengeParams): Promise<InvokeResult> {
  const ctx = buildContext(params);
  const isQueryEditor = ctx.appConfig?.outputFormat === "sql";

  const personaIds = params.personaIds?.length
    ? params.personaIds
    : Object.keys(builtInPersonas);

  const personaDescriptions = personaIds
    .map((id) => {
      const p = builtInPersonas[id as ProvocationType];
      if (!p) return "";
      return `- ${p.label} (${p.id}): ${p.role}\n  Challenge approach: ${p.summary.challenge}`;
    })
    .filter(Boolean)
    .join("\n");

  const guidanceSection = params.guidance
    ? `\nUSER FOCUS AREA: ${params.guidance}`
    : "";

  const referenceSection = ctx.references
    ? `\n\n${ctx.references}`
    : "";

  // G2: Optimized challenge prompts (~30% reduction)
  // App-specific system prompt
  const systemRole = isQueryEditor
    ? `Supportive SQL peer reviewer. Constructive feedback from expert perspectives — frame as improvement opportunities, not criticisms.

${ctx.appContext}
${ctx.objective}`
    : `Critical thinking partner. Generate challenges from expert perspectives. Surface problems — NEVER offer solutions.

${ctx.objective}`;

  const challengeInstructions = isQueryEditor
    ? `Per persona, ONE suggestion: 1) Reference specific SQL (clause/join/subquery) 2) Identify improvement opportunity 3) Title (max 60 chars) + explanation (2-3 sentences) 4) Impact scale 1-5 5) Positive framing ("Consider..."/"This could benefit from...")

Output JSON: [{"personaId":"...","title":"...","content":"...","sourceExcerpt":"...","scale":N}]`
    : `Per persona, ONE challenge: 1) Cite specific document section 2) Identify gap/assumption/weakness 3) Title (max 60 chars) + explanation (2-3 sentences) 4) Relevance scale 1-5

Output JSON: [{"personaId":"...","title":"...","content":"...","sourceExcerpt":"...","scale":N}]`;

  const userLabel = isQueryEditor ? "SQL QUERY TO REVIEW" : "DOCUMENT TO CHALLENGE";
  const userInstruction = isQueryEditor
    ? "Provide constructive suggestions — each must reference a specific part of the query."
    : "Generate grounded challenges — each must cite a specific part.";

  // G3: Use prompt template for challenge generation
  const challengeTemplate = getPromptTemplate("challenge");
  const challengeSystemPrompt = challengeTemplate
    ? renderTemplate(challengeTemplate, {
        systemRole,
        personaDescriptions,
        guidanceSection,
        referenceSection,
        challengeInstructions,
      })
    : `${systemRole}\n\nAVAILABLE PERSONAS:\n${personaDescriptions}\n${guidanceSection}${referenceSection}\n\n${challengeInstructions}`;

  const response = await llm.generate({
    maxTokens: challengeTemplate?.maxOutputTokens ?? 4096,
    system: challengeSystemPrompt,
    messages: [
      {
        role: "user",
        content: `${userLabel}:\n${ctx.document}\n\n${userInstruction}`,
      },
    ],
  });

  // G4: Validate JSON output
  const validation = validateLlmOutput(response.text, "json");
  if (validation.valid && Array.isArray(validation.parsed)) {
    return { challenges: validation.parsed };
  }
  // Fallback: try manual extraction
  try {
    const text = response.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const rawChallenges = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return { challenges: rawChallenges };
  } catch {
    console.warn("[invoke:challenge] Failed to parse challenge JSON from LLM response");
    return { challenges: [] };
  }
}

// ---------------------------------------------------------------------------
// Advice handler
// ---------------------------------------------------------------------------

async function handleAdvice(params: AdviceParams): Promise<InvokeResult> {
  const ctx = buildContext({ ...params, maxDocLength: LIMITS.documentShort });
  const isQueryEditor = ctx.appConfig?.outputFormat === "sql";

  const persona = getPersonaById(params.personaId);
  const personaPrompt = persona?.prompts.advice || "Provide expert advice.";
  const personaLabel = persona?.label || params.personaId;

  const historySection = ctx.discussionHistory
    ? `\n\n${ctx.discussionHistory}`
    : "";

  // G2: Optimized tone guidance (~35% reduction)
  const toneGuidance = isQueryEditor
    ? `\nTONE: Constructive framing ("Consider..."/"You could..."). SQL-specific advice (patterns, indexing, CTEs).`
    : "";

  // G3: Use advice template
  const adviceTemplate = getPromptTemplate("advice");
  const adviceSystemPrompt = adviceTemplate
    ? renderTemplate(adviceTemplate, {
        personaPrompt,
        personaLabel,
        challengeTitle: params.challengeTitle,
        challengeContent: params.challengeContent,
        objective: ctx.objective,
        discussionHistory: historySection,
        toneGuidance,
        documentType: isQueryEditor ? "SQL query" : "document",
        extraAdviceRule: isQueryEditor ? " — include SQL examples" : "",
      })
    : `${personaPrompt}\n\nYou are the ${personaLabel}.\n\nPROVOCATION:\nTitle: ${params.challengeTitle}\nDetail: ${params.challengeContent}\n\n${ctx.objective}\n${historySection}${toneGuidance}\n\nRULES:\n1. Don't repeat the provocation\n2. Reference the ${isQueryEditor ? "SQL query" : "document"}\n3. Serve the objective\n4. Build on history\n5. Be concrete${isQueryEditor ? " — include SQL examples" : ""}\n6. Speak from persona expertise`;

  const response = await llm.generate({
    maxTokens: adviceTemplate?.maxOutputTokens ?? 2048,
    system: adviceSystemPrompt,
    messages: [
      {
        role: "user",
        content: `PROVOCATION: ${params.challengeTitle}\n${params.challengeContent}\n\nCURRENT ${isQueryEditor ? "SQL QUERY" : "DOCUMENT"}:\n${ctx.document}\n\nProvide expert advice as the ${personaLabel}.`,
      },
    ],
  });

  return {
    advice: {
      id: `adv-${Date.now()}`,
      challengeId: params.challengeId,
      persona: persona || { id: params.personaId, label: personaLabel },
      content: response.text.trim(),
      status: "pending",
    },
  };
}

// ---------------------------------------------------------------------------
// Interview question handler
// ---------------------------------------------------------------------------

async function handleInterviewQuestion(params: InterviewQuestionParams): Promise<InvokeResult> {
  const ctx = buildContext({
    ...params,
    maxDocLength: LIMITS.document,
  });
  const isQueryEditor = ctx.appConfig?.outputFormat === "sql";

  const hasEntries = (params.interviewEntries?.length ?? 0) > 0;

  // Build persona-specific direction
  let directionSection = "";
  if (params.personaIds?.length) {
    const personaLines = params.personaIds.map((id) => {
      const p = getPersonaById(id);
      return p ? `- ${p.label}: ${p.role} — ${p.summary.challenge}` : "";
    }).filter(Boolean);
    directionSection = `\nACTIVE PERSONAS (ask from their perspective):\n${personaLines.join("\n")}`;

    if (params.directionMode === "advise") {
      directionSection += "\nMode: Advisory — suggest improvements constructively.";
    } else {
      directionSection += "\nMode: Challenge — probe for weaknesses and gaps.";
    }
  }

  const templateSection = params.template
    ? `\nDOCUMENT TEMPLATE (sections to cover):\n${params.template.slice(0, 2000)}`
    : "";

  const guidanceSection = params.directionGuidance
    ? `\nUSER GUIDANCE: ${params.directionGuidance}`
    : "";

  const behaviorRules = hasEntries
    ? "Acknowledge the user's input, extract requirements, then ask ONE clarification question if genuinely needed."
    : "Greet the user briefly. Do NOT ask a question yet — say 'Ready when you are.'";

  // G2: Optimized interviewer role (~30% reduction)
  const interviewerRole = isQueryEditor
    ? `SQL peer reviewer gathering query context. Ask about: engine, schema, purpose, performance issues, conventions. Conversational, non-judgmental.`
    : "Thought-provoking interviewer developing a document.";

  // G3: Use interview template
  const interviewTemplate = getPromptTemplate("interview");
  const interviewSystemPrompt = interviewTemplate
    ? renderTemplate(interviewTemplate, {
        interviewerRole,
        objective: ctx.objective,
        templateSection,
        directionSection,
        guidanceSection,
        behaviorRules,
        previousQA: ctx.interviewEntries ? `PREVIOUS Q&A:\n${ctx.interviewEntries}` : "",
        currentDocument: ctx.document ? `CURRENT ${isQueryEditor ? "SQL QUERY" : "DOCUMENT"}:\n${ctx.document}` : "",
      })
    : `${interviewerRole}\n\n${ctx.objective}\n${templateSection}\n${directionSection}\n${guidanceSection}\n\nBEHAVIOR:\n- ONLY respond to user input\n- ${behaviorRules}\n- Keep concise\n\n${ctx.interviewEntries ? `PREVIOUS Q&A:\n${ctx.interviewEntries}` : ""}\n${ctx.document ? `CURRENT ${isQueryEditor ? "SQL QUERY" : "DOCUMENT"}:\n${ctx.document}` : ""}\n\nOutput JSON: {"question":"...","topic":"...","suggestedRequirement":"..."(optional)}`;

  const response = await llm.generate({
    maxTokens: interviewTemplate?.maxOutputTokens ?? 1024,
    temperature: interviewTemplate?.temperature ?? 0.9,
    system: interviewSystemPrompt,
    messages: [
      {
        role: "user",
        content: hasEntries
          ? `Generate the next interview question to ${isQueryEditor ? "understand my query better" : "develop my document"}.${params.personaIds?.length ? " Be SPECIFIC — reference something I actually wrote." : ""}`
          : `I'm ready to start ${isQueryEditor ? "reviewing my SQL query" : "developing my document"}.`,
      },
    ],
  });

  try {
    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { question: text, topic: "General" };
  } catch {
    return { question: response.text.trim(), topic: "General" };
  }
}

// ---------------------------------------------------------------------------
// Interview summary handler
// ---------------------------------------------------------------------------

async function handleInterviewSummary(params: InterviewSummaryParams): Promise<InvokeResult> {
  const ctx = buildContext({ ...params, maxDocLength: LIMITS.documentBrief });

  const qaText = ctx.interviewEntries || "No entries.";
  const docSection = ctx.document
    ? `Current document:\n${ctx.document}\n\n---\n\n`
    : "";

  // G2: Interview summary prompt optimized (was 231 chars, now 159 chars — 31% reduction)
  const response = await llm.generate({
    maxTokens: 2048,
    system: `Synthesize interview Q&A into editing instructions.\n\n${ctx.objective}\n\nGroup by theme. Specify add/modify locations. Include all key points.\nOutput valid Markdown only — no meta-commentary.`,
    messages: [
      {
        role: "user",
        content: `${docSection}Interview Q&A:\n\n${qaText}`,
      },
    ],
  });

  return { instruction: response.text.trim() };
}

// ---------------------------------------------------------------------------
// Discussion ask handler
// ---------------------------------------------------------------------------

async function handleDiscussionAsk(params: DiscussionAskParams): Promise<InvokeResult> {
  const ctx = buildContext({ ...params, maxDocLength: LIMITS.documentShort });

  // Step 1: Select relevant personas
  const allPersonas = Object.values(builtInPersonas);
  const personaList = allPersonas.map((p) => `- ${p.id}: ${p.label} — ${p.role}`).join("\n");

  let selectedPersonaIds: string[] = [];
  let topic = "General";

  // G2: Persona selection prompt optimized
  try {
    const selectionResponse = await llm.generate({
      maxTokens: 256,
      system: `Pick 3 most relevant personas.\n${personaList}\n${params.activePersonas?.length ? `Prefer active: ${params.activePersonas.join(", ")}` : ""}\nOutput JSON: {"personas":["id1","id2","id3"],"topic":"short topic"}`,
      messages: [
        {
          role: "user",
          content: `Question: ${params.question}\nDocument objective: ${params.objective}${params.secondaryObjective ? `\nSecondary: ${params.secondaryObjective}` : ""}`,
        },
      ],
    });
    const parsed = JSON.parse(selectionResponse.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    selectedPersonaIds = parsed.personas || [];
    topic = parsed.topic || "General";
  } catch {
    selectedPersonaIds = (params.activePersonas || ["thinking_bigger", "architect", "product_manager"]).slice(0, 3);
  }

  // Step 2: Multi-perspective response
  const panelDesc = selectedPersonaIds
    .map((id) => {
      const p = getPersonaById(id);
      return p ? `- ${p.label} (${p.id}): ${p.role}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const historySection = ctx.discussionHistory ? `\n${ctx.discussionHistory}` : "";

  // G2: Discussion panel prompt optimized (was 358 chars, now 230 chars — 36% reduction)
  const response = await llm.generate({
    maxTokens: 3072,
    system: `Expert advisory panel.

${ctx.objective}
${historySection}

PANEL:\n${panelDesc}

Per persona: 2-3 sentence perspective. Then synthesized answer (2-4 sentences). Be direct and practical.

Output JSON: {"answer":"...","perspectives":[{"personaId":"...","personaLabel":"...","content":"..."}],"topic":"..."}`,
    messages: [
      {
        role: "user",
        content: `CURRENT DOCUMENT:\n${ctx.document}\n\nMY QUESTION: ${params.question}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return {
      answer: parsed.answer || response.text.trim(),
      perspectives: parsed.perspectives || [],
      relevantPersonas: selectedPersonaIds,
      topic: parsed.topic || topic,
    };
  } catch {
    return {
      answer: response.text.trim(),
      perspectives: [],
      relevantPersonas: selectedPersonaIds,
      topic,
    };
  }
}

// ---------------------------------------------------------------------------
// Summarize intent handler
// ---------------------------------------------------------------------------

async function handleSummarizeIntent(params: SummarizeIntentParams): Promise<InvokeResult> {
  const { transcript, context, mode = "clean" } = params;

  let system: string;
  let maxTokens: number;
  let userMsg: string;

  // G2: Summarize-intent prompts optimized (~30% reduction)
  if (mode === "aim") {
    system = `Restructure using AIM framework: Actor (who AI should be), Input (context/data), Mission (what to produce). Be faithful, add placeholders for missing parts. Single instruction output.`;
    maxTokens = 4000;
    userMsg = `Restructure into AIM prompt:\n\n${transcript}`;
  } else if (mode === "summarize") {
    const contextLabel = context === "objective" ? "objective" : context === "source" ? "source material" : "content";
    system = `Condense this ${contextLabel}. Core points only, remove redundancy. 30-50% of original length.${context === "objective" ? " Output one concise sentence." : ""}`;
    maxTokens = context === "objective" ? 500 : 4000;
    userMsg = `Summarize:\n\n${transcript}`;
  } else {
    system = `Fix grammar/spelling, clean speech artifacts, improve clarity, organize into paragraphs. Maintain length.`;
    maxTokens = context === "objective" ? 500 : 4000;
    userMsg = `Clean up:\n\n${transcript}`;
  }

  const response = await llm.generate({
    maxTokens,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  return {
    summary: response.text.trim(),
    originalLength: transcript.length,
    summaryLength: response.text.trim().length,
  };
}

// ---------------------------------------------------------------------------
// Extract metrics handler
// ---------------------------------------------------------------------------

// G2: Extract metrics prompt optimized (was 226 chars, now 155 chars — 31% reduction)
async function handleExtractMetrics(params: ExtractMetricsParams): Promise<InvokeResult> {
  const response = await llm.generate({
    maxTokens: 4000,
    temperature: 0.2,
    system: `Extract metrics/KPIs from SQL or prose: aggregations, calculated fields, ratios, window functions, CASE, aliases.\nOutput JSON: {"metrics":[{"name":"...","definition":"...","formula":"..."}]}`,
    messages: [
      {
        role: "user",
        content: `Extract all metrics and KPIs:\n\n${params.query.slice(0, 15000)}`,
      },
    ],
  });

  try {
    return JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || '{"metrics":[]}');
  } catch {
    return { metrics: [] };
  }
}

// ---------------------------------------------------------------------------
// Analyze query handler
// ---------------------------------------------------------------------------

// G2: Analyze query prompt optimized (was 614 chars, now 420 chars — 32% reduction)
async function handleAnalyzeQuery(params: AnalyzeQueryParams): Promise<InvokeResult> {
  const response = await llm.generate({
    maxTokens: 16000,
    temperature: 0.15,
    system: `Senior SQL Architect + QA Engineer.

Analyze: 1) Correctness 2) Performance 3) Readability 4) Best practices 5) Security 6) Portability

QA GATE: Before recommending changes, verify logical equivalence, join semantics, NULL handling, aggregation integrity, data type safety. Drop any failing recommendation.

Output JSON: {subqueries:[{id, name, sqlSnippet, startOffset, endOffset, summary, evaluation, severity, recommendations, changeRecommendations}], metrics, overallEvaluation, optimizationOpportunities}`,
    messages: [
      {
        role: "user",
        content: `Analyze this SQL query:\n\n${params.query.slice(0, 50000)}`,
      },
    ],
  });

  try {
    return JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch {
    return { subqueries: [], overallEvaluation: "Analysis failed to parse." };
  }
}

// ---------------------------------------------------------------------------
// Streaming question handler
// ---------------------------------------------------------------------------

async function handleStreamingQuestion(params: StreamingQuestionParams): Promise<InvokeResult> {
  const ctx = buildContext({
    ...params,
    maxDocLength: LIMITS.wireframe,
  });

  const hasEntries = (params.dialogueEntries?.length ?? 0) > 0;

  // G2: Streaming question prompt optimized
  const behavior = hasEntries
    ? "Acknowledge input, extract requirements, ask one clarification if needed."
    : "Greet briefly. Say 'Ready when you are.'";

  const response = await llm.generate({
    maxTokens: 1024,
    system: `Requirements discovery agent.

${ctx.objective}
${ctx.wireframe}
${ctx.requirements ? `EXISTING:\n${ctx.requirements}` : ""}
${ctx.document ? `DOCUMENT:\n${ctx.document}` : ""}

- Respond to user input only. ${behavior}
${ctx.dialogueEntries ? `\nCONVERSATION:\n${ctx.dialogueEntries}` : ""}

Output JSON: {"question":"...","topic":"...","suggestedRequirement":"..."(optional)}`,
    messages: [
      {
        role: "user",
        content: hasEntries
          ? "Generate the next question based on our conversation."
          : "I'm ready to start describing what I need.",
      },
    ],
  });

  try {
    return JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch {
    return { question: response.text.trim(), topic: "General" };
  }
}

// ---------------------------------------------------------------------------
// Wireframe analysis handler
// ---------------------------------------------------------------------------

async function handleWireframeAnalysis(params: WireframeAnalysisParams): Promise<InvokeResult> {
  const ctx = buildContext({
    ...params,
    maxDocLength: LIMITS.documentBrief,
  });

  const userMsg = params.wireframeNotes
    ? `Analyze this wireframe and discover its content:\n\n${(params.wireframeNotes || "").slice(0, LIMITS.wireframe)}`
    : `Analyze the website at ${params.websiteUrl}. Identify key components, structure, and content assets.`;

  // G2: Wireframe analysis prompt optimized
  const response = await llm.generate({
    maxTokens: 4096,
    system: `Website analysis expert. 1) STRUCTURAL: UI components, navigation, page structure 2) CONTENT: site map, video, audio, RSS, images, primary content

${ctx.objective}
${ctx.document ? `DOCUMENT:\n${ctx.document}` : ""}

Output JSON: {analysis, components[], suggestions[], siteMap[], videos[], audioContent[], rssFeeds[], images[], primaryContent}`,
    messages: [{ role: "user", content: userMsg }],
  });

  try {
    const result = JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return { ...result, contentScanStatus: "complete" };
  } catch {
    return { analysis: response.text.trim(), components: [], suggestions: [], contentScanStatus: "complete" };
  }
}

// ---------------------------------------------------------------------------
// Streaming refine handler
// ---------------------------------------------------------------------------

async function handleStreamingRefine(params: StreamingRefineParams): Promise<InvokeResult> {
  const ctx = buildContext({
    ...params,
    maxDocLength: LIMITS.documentBrief,
  });

  // G2: Streaming refine prompt optimized (~25% reduction)
  const response = await llm.generate({
    maxTokens: 4096,
    system: `Requirements writer. Extract implementable requirements from dialogue — each unambiguous.

${ctx.objective}
${ctx.requirements ? `EXISTING:\n${ctx.requirements}` : ""}
${ctx.wireframe}
${ctx.dialogueEntries ? `DIALOGUE:\n${ctx.dialogueEntries}` : ""}
${ctx.document ? `DOCUMENT:\n${ctx.document}` : ""}

Preserve confirmed. Update drafts. Add new. Keep embedded images.

Output JSON: {"requirements":[{id,text,status}],"updatedDocument":"full markdown","summary":"brief"}`,
    messages: [
      { role: "user", content: "Refine the requirements based on our dialogue." },
    ],
  });

  try {
    return JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch {
    return { requirements: [], updatedDocument: "", summary: "Refinement failed." };
  }
}
