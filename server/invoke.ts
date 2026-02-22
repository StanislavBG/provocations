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

export const BASE_PROMPTS: Record<TaskType, { description: string; basePrompt: string }> = {
  write: {
    description: "Iteratively evolve a markdown document through user instructions",
    basePrompt: "You are an expert document editor helping a user iteratively shape their document. The document format is MARKDOWN.",
  },
  "query-write": {
    description: "Edit and format SQL queries with precise transformations",
    basePrompt: "You are an expert SQL query writer, formatter, and editor.\n\nABSOLUTE RULES:\n1. Output MUST be valid SQL only\n2. NO code fences, markdown, text, or explanations\n3. Proper indentation and consistent SQL keyword casing\n4. Each major clause on its own line\n5. Preserve comments\n6. Apply changes precisely\n7. Maintain semantic equivalence unless logic change requested",
  },
  challenge: {
    description: "Generate thought-provoking challenges from expert personas",
    basePrompt: "You are a critical thinking partner. Your job is to generate thought-provoking challenges from multiple expert perspectives.",
  },
  advice: {
    description: "Provide concrete, actionable expert advice for a specific challenge",
    basePrompt: "ADVICE RULES:\n1. Start from the provocation — don't repeat it\n2. Reference the current document\n3. Serve the objective\n4. Build on discussion history if present\n5. Be concrete with actionable steps\n6. Speak from your persona expertise",
  },
  "interview-question": {
    description: "Generate thought-provoking interview questions for requirement gathering",
    basePrompt: "You are a thought-provoking interviewer helping develop a document.",
  },
  "interview-summary": {
    description: "Synthesize interview Q&A into structured editing instructions",
    basePrompt: "You are an expert at synthesizing interview responses into clear editing instructions.\n\nGroup related answers by theme. Specify where to add/modify content. Include all key points.\nBe a directive to an editor. Output is valid Markdown.\nOutput only the instruction text, no meta-commentary.",
  },
  "discussion-ask": {
    description: "Multi-perspective expert responses to user questions",
    basePrompt: "You are a panel of expert advisors responding to the user's question.",
  },
  "summarize-intent": {
    description: "Clean voice transcripts and summarize text content",
    basePrompt: "You are an expert editor. Fix grammar/spelling, clean speech artifacts, improve clarity, organize into paragraphs. Keep same approximate length.",
  },
  "extract-metrics": {
    description: "Extract metrics, KPIs, and aggregations from SQL or prose",
    basePrompt: "You are a senior data analyst. Extract metrics and KPIs from SQL or prose.\nLook for: Aggregations, calculated fields, ratios, window functions, CASE expressions, column aliases.",
  },
  "analyze-query": {
    description: "Comprehensive SQL query analysis across multiple dimensions",
    basePrompt: "You are a Senior SQL Architect and QA SQL Engineer.\n\nAnalyze the SQL query across these dimensions:\n1. Correctness & Logic\n2. Performance & Efficiency\n3. Readability & Maintainability\n4. Best Practices & Standards\n5. Security & Safety\n6. Portability & Compatibility",
  },
  "streaming-question": {
    description: "Iteratively discover requirements through guided dialogue",
    basePrompt: "You are a requirements discovery agent.",
  },
  "wireframe-analysis": {
    description: "Analyze website structure, components, and content from wireframes",
    basePrompt: "You are a website/application analysis expert.\n\nPerform:\n1. STRUCTURAL ANALYSIS: UI components, navigation, page structure\n2. CONTENT DISCOVERY: Site map, video, audio, RSS, images, primary content",
  },
  "streaming-refine": {
    description: "Extract clear, implementable requirements from dialogue",
    basePrompt: "You are an expert requirements writer.\n\nGiven dialogue, extract clear, implementable requirements.\nEach requirement specific enough to implement without ambiguity.",
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

async function cleanVoiceTranscript(transcript: string): Promise<string> {
  try {
    const response = await llm.generate({
      maxTokens: 500,
      temperature: 0.2,
      system: `You are an expert at extracting clear editing instructions from spoken transcripts.

Your job is to:
1. Remove speech artifacts (um, uh, like, you know, basically, so, repeated words)
2. Extract the core instruction/intent
3. Make it a clear, actionable editing directive

Keep the user's intent intact. Don't add information they didn't mention.
Output ONLY the cleaned instruction, nothing else.`,
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

  // Single LLM call — document evolution
  const response = await llm.generate({
    maxTokens: 8192,
    system: `You are an expert document editor helping a user iteratively shape their document. The document format is MARKDOWN.

${ctx.objective}

INSTRUCTION TYPE: ${instructionType}
STRATEGY: ${strategy}
${ctx.assembled}${provocationSection}${toneSection}${lengthSection}

Guidelines:
1. ${focusInstruction}
2. Preserve the document's voice and structure unless explicitly asked to change it
3. Make targeted improvements, not wholesale rewrites
4. Output the complete evolved document
5. ALL output must be valid markdown
6. Preserve embedded images exactly

PRESERVATION RULES:
${preservationRules.join("\n")}

Output only the evolved markdown document text. No explanations.`,
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
    const analysis = await llm.generate({
      maxTokens: 1024,
      system: `You are a document change analyzer. Compare documents and provide JSON:
- summary: One sentence (max 100 chars)
- changes: 1-3 objects {type: "added"|"modified"|"removed"|"restructured", description, location?}
- suggestions: 0-2 next improvements
Output only valid JSON.`,
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
  } catch { /* use defaults */ }

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

  // App-specific system prompt
  const systemRole = isQueryEditor
    ? `You are a supportive SQL peer reviewer. Your job is to provide constructive, non-judgmental feedback on SQL queries from multiple expert perspectives.
Frame all feedback as opportunities for improvement, not criticisms. The analyst is grooming their query — help them make it better.

${ctx.appContext}
${ctx.objective}`
    : `You are a critical thinking partner. Your job is to generate thought-provoking challenges from multiple expert perspectives.

${ctx.objective}`;

  const challengeInstructions = isQueryEditor
    ? `For each persona, generate ONE suggestion that:
1. References a specific part of the SQL query (a clause, join, subquery, or pattern)
2. Identifies an opportunity for improvement (performance, readability, correctness, or best practices)
3. Has a clear title (max 60 chars) and constructive explanation (2-3 sentences)
4. Includes an impact scale (1-5, where 5 is highest impact improvement)
5. Frames feedback positively ("Consider..." / "This could benefit from..." / "A CTE here would...")

Output valid JSON array:
[{"personaId": "...", "title": "...", "content": "...", "sourceExcerpt": "...", "scale": N}]`
    : `For each persona, generate ONE challenge that:
1. Cites a specific section of the document
2. Identifies a gap, assumption, or weakness
3. Has a clear title (max 60 chars) and explanation (2-3 sentences)
4. Includes a relevance scale (1-5, where 5 is most critical)

Output valid JSON array of challenges:
[{"personaId": "...", "title": "...", "content": "...", "sourceExcerpt": "...", "scale": N}]`;

  const userLabel = isQueryEditor ? "SQL QUERY TO REVIEW" : "DOCUMENT TO CHALLENGE";
  const userInstruction = isQueryEditor
    ? "Provide constructive suggestions — each must reference a specific part of the query."
    : "Generate grounded challenges — each must cite a specific part.";

  const response = await llm.generate({
    maxTokens: 4096,
    system: `${systemRole}

AVAILABLE PERSONAS:
${personaDescriptions}
${guidanceSection}${referenceSection}

${challengeInstructions}`,
    messages: [
      {
        role: "user",
        content: `${userLabel}:\n${ctx.document}\n\n${userInstruction}`,
      },
    ],
  });

  // Parse challenges from response
  try {
    const text = response.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const rawChallenges = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return { challenges: rawChallenges };
  } catch {
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

  const toneGuidance = isQueryEditor
    ? `\nTONE: Be constructive and non-judgmental. Frame advice as "Consider..." or "You could improve this by..." — not "This is wrong" or "You should have...".
The document is a SQL query, not prose. Provide SQL-specific advice (query patterns, indexing, CTEs, formatting).`
    : "";

  const response = await llm.generate({
    maxTokens: 2048,
    system: `${personaPrompt}

You are the ${personaLabel}.

THE PROVOCATION:
Title: ${params.challengeTitle}
Detail: ${params.challengeContent}

${ctx.objective}
${historySection}${toneGuidance}

ADVICE RULES:
1. Start from the provocation — don't repeat it
2. Reference the current ${isQueryEditor ? "SQL query" : "document"}
3. Serve the objective
4. Build on discussion history if present
5. Be concrete with actionable steps${isQueryEditor ? " — include SQL code examples where helpful" : ""}
6. Speak from your persona expertise`,
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

  // App-specific interviewer role
  const interviewerRole = isQueryEditor
    ? `You are a supportive SQL peer reviewer gathering context about the analyst's query.
Ask about: database engine, schema context, what the query powers, known performance issues, team conventions.
Be conversational and non-judgmental. You're helping them provide context so you can give better feedback.`
    : "You are a thought-provoking interviewer helping develop a document.";

  const response = await llm.generate({
    maxTokens: 1024,
    temperature: 0.9,
    system: `${interviewerRole}

${ctx.objective}
${templateSection}
${directionSection}
${guidanceSection}

BEHAVIOR:
- ONLY respond to what the user says
- ${behaviorRules}
- Keep responses concise

${ctx.interviewEntries ? `PREVIOUS Q&A:\n${ctx.interviewEntries}` : ""}
${ctx.document ? `CURRENT ${isQueryEditor ? "SQL QUERY" : "DOCUMENT"}:\n${ctx.document}` : ""}

Output JSON: {"question": "...", "topic": "...", "suggestedRequirement": "..."(optional)}`,
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

  const response = await llm.generate({
    maxTokens: 2048,
    system: `You are an expert at synthesizing interview responses into clear editing instructions.

${ctx.objective}

Group related answers by theme. Specify where to add/modify content. Include all key points.
Be a directive to an editor. Output is valid Markdown.
Output only the instruction text, no meta-commentary.`,
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

  try {
    const selectionResponse = await llm.generate({
      maxTokens: 256,
      system: `Select the 3 most relevant personas for this question.
Available:\n${personaList}
${params.activePersonas?.length ? `Currently active: ${params.activePersonas.join(", ")} — prefer these.` : ""}
Output JSON: {"personas": ["id1","id2","id3"], "topic": "short topic"}`,
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

  const response = await llm.generate({
    maxTokens: 3072,
    system: `You are a panel of expert advisors responding to the user's question.

${ctx.objective}
${historySection}

THE PANEL:
${panelDesc}

Instructions:
1. Read the question carefully
2. For each persona, provide a 2-3 sentence perspective
3. Provide a unified synthesized answer (2-4 sentences)
4. Be direct and practical

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

  if (mode === "aim") {
    system = `You are an expert prompt engineer. Restructure the draft using the AIM framework:
- **Actor**: Who the AI should be
- **Input**: What context/data is provided
- **Mission**: What exactly to produce

Rules: Be faithful, add placeholders for missing parts, output as a single instruction.`;
    maxTokens = 4000;
    userMsg = `Restructure this into an AIM-structured prompt:\n\n${transcript}`;
  } else if (mode === "summarize") {
    const contextLabel = context === "objective" ? "document objective/goal" : context === "source" ? "source material" : "general content";
    system = `You are an expert at condensing text. This is ${contextLabel}.
Identify core points, remove redundancy. Produce 30-50% of original length.
${context === "objective" ? "Output a single concise sentence." : "Output short organized paragraphs."}`;
    maxTokens = context === "objective" ? 500 : 4000;
    userMsg = `Summarize this:\n\n${transcript}`;
  } else {
    system = `You are an expert editor. Fix grammar/spelling, clean speech artifacts, improve clarity, organize into paragraphs. Keep same approximate length.`;
    maxTokens = context === "objective" ? 500 : 4000;
    userMsg = `Clean up this text:\n\n${transcript}`;
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

async function handleExtractMetrics(params: ExtractMetricsParams): Promise<InvokeResult> {
  const response = await llm.generate({
    maxTokens: 4000,
    temperature: 0.2,
    system: `You are a senior data analyst. Extract metrics and KPIs from SQL or prose.
Look for: Aggregations, calculated fields, ratios, window functions, CASE expressions, column aliases.
Output JSON: {"metrics": [{"name":"...", "definition":"...", "formula":"..."}]}`,
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

async function handleAnalyzeQuery(params: AnalyzeQueryParams): Promise<InvokeResult> {
  const response = await llm.generate({
    maxTokens: 16000,
    temperature: 0.15,
    system: `You are a Senior SQL Architect and QA SQL Engineer.

Analyze the SQL query across these dimensions:
1. Correctness & Logic
2. Performance & Efficiency
3. Readability & Maintainability
4. Best Practices & Standards
5. Security & Safety
6. Portability & Compatibility

QA VALIDATION: Before recommending any change, verify:
- Logical equivalence
- Join semantics preserved
- NULL handling correct
- Aggregation integrity
- Data type safety
If ANY check fails, DO NOT include the change.

Output JSON with: subqueries (array with id, name, sqlSnippet, startOffset, endOffset, summary, evaluation, severity, recommendations, changeRecommendations), metrics, overallEvaluation, optimizationOpportunities.`,
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

  const behavior = hasEntries
    ? "Acknowledge input, extract requirements, ask one clarification if genuinely needed."
    : "Greet briefly. Don't ask questions. Say 'Ready when you are.'";

  const response = await llm.generate({
    maxTokens: 1024,
    system: `You are a requirements discovery agent.

${ctx.objective}
${ctx.wireframe}
${ctx.requirements ? `EXISTING REQUIREMENTS:\n${ctx.requirements}` : ""}
${ctx.document ? `CURRENT DOCUMENT:\n${ctx.document}` : ""}

BEHAVIOR:
- ONLY respond to what user says
- ${behavior}
- Keep concise

${ctx.dialogueEntries ? `CONVERSATION:\n${ctx.dialogueEntries}` : ""}

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

  const response = await llm.generate({
    maxTokens: 4096,
    system: `You are a website/application analysis expert.

Perform:
1. STRUCTURAL ANALYSIS: UI components, navigation, page structure
2. CONTENT DISCOVERY: Site map, video, audio, RSS, images, primary content

${ctx.objective}
${ctx.document ? `CURRENT DOCUMENT:\n${ctx.document}` : ""}

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

  const response = await llm.generate({
    maxTokens: 4096,
    system: `You are an expert requirements writer.

Given dialogue, extract clear, implementable requirements.
Each requirement specific enough to implement without ambiguity.

${ctx.objective}
${ctx.requirements ? `EXISTING REQUIREMENTS:\n${ctx.requirements}` : ""}
${ctx.wireframe}
${ctx.dialogueEntries ? `DIALOGUE:\n${ctx.dialogueEntries}` : ""}
${ctx.document ? `CURRENT DOCUMENT:\n${ctx.document}` : ""}

Preserve confirmed requirements. Update drafts with new info. Add new discoveries.
Preserve embedded images in the document.

Output JSON: {"requirements":[{id,text,status}], "updatedDocument":"full markdown", "summary":"brief"}`,
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
