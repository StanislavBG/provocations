import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAuth } from "@clerk/express";
import { storage } from "./storage";
import { encrypt, decrypt } from "./crypto";
import OpenAI from "openai";
import {
  writeRequestSchema,
  generateProvocationsRequestSchema,
  interviewQuestionRequestSchema,
  interviewSummaryRequestSchema,
  saveDocumentRequestSchema,
  updateDocumentRequestSchema,
  streamingQuestionRequestSchema,
  wireframeAnalysisRequestSchema,
  streamingRefineRequestSchema,
  provocationType,
  instructionTypes,
  type ProvocationType,
  type InstructionType,
  type Provocation,
  type ReferenceDocument,
  type ChangeEntry,
  type InterviewQuestionResponse,
  type StreamingQuestionResponse,
  type WireframeAnalysisResponse,
  type StreamingRefineResponse,
  type StreamingRequirement,
} from "@shared/schema";

function getEncryptionKey(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.warn("ENCRYPTION_SECRET not set — using default dev key. Set this in production!");
  }
  return secret || "provocations-dev-key-change-in-production";
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const provocationPrompts: Record<ProvocationType, string> = {
  architect: "As the System Architect: Question the clarity of system abstractions — frontend components, backend services, system-to-system communication. Push for well-defined boundaries, API contracts, data flow, and separation of concerns. Challenge technical debt and coupling.",
  quality_engineer: "As the Quality Engineer: Question testing gaps, edge cases, error handling, and reliability. Ask about regression risks, acceptance criteria, and what happens when things fail. Push for observable, measurable quality and clear exit criteria.",
  ux_designer: "As the UX Designer: Question how users will discover, understand, and complete tasks. Ask 'how would a user know to do this?' and 'what happens if they get confused here?' Push for clarity on layout, flows, error states, accessibility, and ease of use.",
  tech_writer: "As the Technical Writer: Question whether documentation, naming, and UI copy are clear enough for someone with no prior context. Flag jargon, missing explanations, unclear labels, and areas where the reader would get lost. Push for self-explanatory interfaces and complete documentation.",
  product_manager: "As the Product Manager: Question business value, user stories, and prioritization. Ask 'what problem does this solve?' and 'how will we measure success?' Push for clear acceptance criteria, user outcomes, and alignment with strategic goals.",
  security_engineer: "As the Security Engineer: Question data privacy, authentication, authorization, and compliance. Ask about threat models, input validation, and what happens if an attacker targets this. Push for secure defaults, least-privilege access, and audit trails.",
  thinking_bigger: "As the Think Big Advisor: Push the user to scale impact and outcomes — retention, cost-to-serve, accessibility, resilience — without changing the core idea. Propose bolder bets that respect constraints (time, budget, technical limitations, compliance, operational realities). Raise scale concerns early: what breaks, what becomes harder, and what must be simplified when designing for 100,000+ people. Suggest new workflows that better serve the user outcome, potential adjacent product lines as optional/iterative bets, and 'designed-for-100,000+' simplifications that reduce friction (fewer steps, clearer defaults, safer paths). Make the product easier at scale for both users and the team operating it.",
};

// Instruction classification patterns
const instructionPatterns: Record<InstructionType, RegExp[]> = {
  expand: [/expand/i, /elaborate/i, /add.*detail/i, /develop/i, /flesh out/i, /more about/i, /tell me more/i, /explain.*further/i],
  condense: [/condense/i, /shorten/i, /shorter/i, /summarize/i, /brief/i, /concise/i, /cut/i, /reduce/i, /tighten/i, /trim/i],
  restructure: [/restructure/i, /reorganize/i, /reorder/i, /move/i, /rearrange/i, /add.*section/i, /add.*heading/i, /split/i, /merge.*section/i],
  clarify: [/clarify/i, /simplify/i, /clearer/i, /easier.*understand/i, /plain/i, /straightforward/i, /confus/i],
  style: [/tone/i, /voice/i, /formal/i, /informal/i, /professional/i, /casual/i, /friendly/i, /academic/i, /style/i],
  correct: [/fix/i, /correct/i, /error/i, /mistake/i, /typo/i, /grammar/i, /spelling/i, /wrong/i, /inaccurate/i],
  general: [], // fallback
};

// Speech artifact patterns to detect voice transcripts
const speechArtifacts = [
  /\b(um|uh|er|ah|like|you know|basically|so basically|I mean|kind of|sort of)\b/gi,
  /\b(gonna|wanna|gotta|kinda|sorta)\b/gi,
  /(\w+)\s+\1\b/gi, // repeated words
  /^(so|and|but|okay|alright|well)\s/i, // filler starts
];

// Detect if instruction looks like a voice transcript
function isLikelyVoiceTranscript(text: string): boolean {
  let artifactCount = 0;
  for (const pattern of speechArtifacts) {
    const matches = text.match(pattern);
    if (matches) artifactCount += matches.length;
  }
  // If more than 2 artifacts per 100 words, likely voice
  const wordCount = text.split(/\s+/).length;
  return artifactCount > 0 && (artifactCount / wordCount) > 0.02;
}

// Clean voice transcript to extract clear intent
async function cleanVoiceTranscript(transcript: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting clear editing instructions from spoken transcripts.

Your job is to:
1. Remove speech artifacts (um, uh, like, you know, basically, so, repeated words)
2. Extract the core instruction/intent
3. Make it a clear, actionable editing directive

Keep the user's intent intact. Don't add information they didn't mention.
Output ONLY the cleaned instruction, nothing else.`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      max_tokens: 500,
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content?.trim() || transcript;
  } catch {
    return transcript; // Fall back to original if cleaning fails
  }
}

// Determine if instruction is complex enough to need planning
function isComplexInstruction(instruction: string, instructionType: InstructionType): boolean {
  // Complex if: restructure type, multiple actions, or long instruction
  if (instructionType === "restructure") return true;
  if (instruction.length > 200) return true;

  // Check for multiple action words
  const actionWords = instruction.match(/\b(add|remove|change|move|update|fix|expand|condense|rewrite|split|merge|create|delete)\b/gi);
  if (actionWords && actionWords.length >= 2) return true;

  // Check for list-like instructions (numbered or bulleted)
  if (/\d\.\s|[-•]\s/.test(instruction)) return true;

  return false;
}

// Generate a plan for complex instructions
async function generateEditPlan(
  document: string,
  instruction: string,
  selectedText: string | undefined,
  objective: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert editor planning document changes. Given an instruction, create a brief execution plan.

Output a concise numbered list (3-5 steps max) of specific changes to make.
Each step should be atomic and verifiable.
Focus on WHAT to change, not HOW to write it.

Example:
Instruction: "Add more detail about pricing and move the FAQ to the end"
Plan:
1. Expand the pricing section with specific tier information
2. Add pricing comparison table after the tier descriptions
3. Move the FAQ section to after the Contact section
4. Update any internal references to FAQ location`
        },
        {
          role: "user",
          content: `Document (first 1000 chars): ${document.slice(0, 1000)}${document.length > 1000 ? "..." : ""}
${selectedText ? `\nSelected text: "${selectedText}"` : ""}
Objective: ${objective}
Instruction: ${instruction}

Create a brief execution plan:`
        }
      ],
      max_tokens: 300,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  } catch {
    return ""; // Skip planning if it fails
  }
}

// Extract style metrics from reference documents
function extractStyleMetrics(content: string): {
  avgSentenceLength: number;
  avgParagraphLength: number;
  formalityIndicators: string[];
  structurePatterns: string[];
} {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const words = content.split(/\s+/).length;

  const avgSentenceLength = sentences.length > 0 ? Math.round(words / sentences.length) : 0;
  const avgParagraphLength = paragraphs.length > 0 ? Math.round(sentences.length / paragraphs.length) : 0;

  // Detect formality indicators
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

  // Detect structure patterns
  const structurePatterns: string[] = [];
  if (/^#+\s/m.test(content)) {
    structurePatterns.push("uses markdown headers");
  }
  if (/^[-*]\s/m.test(content)) {
    structurePatterns.push("uses bullet lists");
  }
  if (/^\d+\.\s/m.test(content)) {
    structurePatterns.push("uses numbered lists");
  }
  if (/\*\*[^*]+\*\*/.test(content)) {
    structurePatterns.push("uses bold for emphasis");
  }

  return { avgSentenceLength, avgParagraphLength, formalityIndicators, structurePatterns };
}

// Format style metrics for prompt inclusion
function formatStyleGuidance(docs: ReferenceDocument[]): string {
  const metrics = docs.map(doc => ({
    name: doc.name,
    type: doc.type,
    ...extractStyleMetrics(doc.content)
  }));

  const lines: string[] = ["STYLE GUIDANCE (extracted from reference documents):"];

  for (const m of metrics) {
    lines.push(`\n[${m.type.toUpperCase()}: ${m.name}]`);
    lines.push(`- Average sentence length: ${m.avgSentenceLength} words`);
    lines.push(`- Average paragraph length: ${m.avgParagraphLength} sentences`);
    if (m.formalityIndicators.length > 0) {
      lines.push(`- Formality: ${m.formalityIndicators.join(", ")}`);
    }
    if (m.structurePatterns.length > 0) {
      lines.push(`- Structure: ${m.structurePatterns.join(", ")}`);
    }
  }

  lines.push("\nMatch these style characteristics in your edits.");
  return lines.join("\n");
}

// Persona response examples for better guidance
const provocationResponseExamples: Record<ProvocationType, string> = {
  architect: `Example good responses to architecture feedback:
- "I should define the API contract between the frontend and this service"
- "Good catch — the boundary between X and Y components isn't clear"
- "Let me add a section on how data flows from the client through to storage"
The goal is to ensure system abstractions are well-defined and communication patterns are explicit.`,

  quality_engineer: `Example good responses to quality engineering feedback:
- "I need to add acceptance criteria for this feature"
- "Good point — I haven't described the error handling when X fails"
- "Let me clarify the testing strategy and edge cases"
The goal is to make quality expectations explicit, measurable, and testable.`,

  ux_designer: `Example good responses to UX design feedback:
- "You're right, users won't know about that feature — I'll add onboarding guidance"
- "I need to describe the error state when X fails"
- "Let me clarify the navigation flow from A to B"
The goal is to ensure every user-facing interaction is thought through.`,

  tech_writer: `Example good responses to technical writing feedback:
- "That label is jargon — let me rename it to something self-explanatory"
- "I should add a getting-started section for new users"
- "Good catch — the error message doesn't tell the user what to do next"
The goal is to ensure the product and documentation are clear to someone with no prior context.`,

  product_manager: `Example good responses to product management feedback:
- "I should tie this feature to the business outcome we're targeting"
- "Let me add success metrics so we know if this is working"
- "Good point — the user story is missing the 'so that' clause"
The goal is to ensure every feature has clear purpose, measurement, and user value.`,

  security_engineer: `Example good responses to security engineering feedback:
- "I need to add input validation for this user-submitted field"
- "Good catch — I should describe the authorization model here"
- "Let me add a threat model section for this integration"
The goal is to ensure the system is secure by default and resilient to abuse.`,

  thinking_bigger: `Example good responses to Think Big feedback:
- "You're right — instead of just improving the UI, let me target a retention outcome"
- "I should consider what breaks at 100k users and simplify the critical path"
- "Let me frame this as a platform bet with an adjacent product extension"
- "Good point — I should design for operational clarity, not just user delight"
The goal is to scale impact and outcomes (retention, cost-to-serve, accessibility, resilience) while respecting constraints, and design for 100,000+ people.`,
};

// Strategy prompts for each instruction type
const instructionStrategies: Record<InstructionType, string> = {
  expand: "Add depth, examples, supporting details, and elaboration. Develop ideas more fully while maintaining coherence.",
  condense: "Remove redundancy, tighten prose, eliminate filler words. Preserve core meaning while reducing length.",
  restructure: "Reorganize content for better flow. Add or modify headings, reorder sections, improve logical progression.",
  clarify: "Simplify language, add transitions, break down complex ideas. Make the text more accessible without losing meaning.",
  style: "Adjust the voice and tone. Maintain the content while shifting the register, formality, or emotional quality.",
  correct: "Fix errors in grammar, spelling, facts, or logic. Make precise corrections without unnecessary changes.",
  general: "Make targeted improvements based on the specific instruction. Balance multiple considerations appropriately.",
};

function classifyInstruction(instruction: string): InstructionType {
  const lowerInstruction = instruction.toLowerCase();

  for (const [type, patterns] of Object.entries(instructionPatterns)) {
    if (type === 'general') continue;
    for (const pattern of patterns) {
      if (pattern.test(lowerInstruction)) {
        return type as InstructionType;
      }
    }
  }

  return 'general';
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Generate provocations for a document (on-demand)
  app.post("/api/generate-provocations", async (req, res) => {
    try {
      const parsed = generateProvocationsRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { text, guidance, objective, types, referenceDocuments } = parsed.data;

      const MAX_ANALYSIS_LENGTH = 8000;
      const analysisText = text.slice(0, MAX_ANALYSIS_LENGTH);

      const refDocSummary = referenceDocuments && referenceDocuments.length > 0
        ? referenceDocuments.map(d => `[${d.type.toUpperCase()}: ${d.name}]\n${d.content.slice(0, 500)}${d.content.length > 500 ? "..." : ""}`).join("\n\n")
        : null;

      const refContext = refDocSummary
        ? `\n\nReference documents:\n${refDocSummary}\n\nCompare against these for gaps.`
        : "";

      const guidanceContext = guidance
        ? `\n\nUSER GUIDANCE: The user specifically wants provocations about: ${guidance}`
        : "";

      const objectiveContext = objective
        ? `\n\nDOCUMENT OBJECTIVE: ${objective}\nEvaluate the document against this objective. Identify what's missing, underdeveloped, or could be stronger to fulfill this goal.`
        : "";

      // Filter to requested types or use all
      const requestedTypes = types && types.length > 0 ? types : [...provocationType];
      const provDescriptions = requestedTypes.map(t => `- ${t}: ${provocationPrompts[t]}`).join("\n");
      const typesList = requestedTypes.join(", ");
      const perTypeCount = Math.max(2, Math.ceil(6 / requestedTypes.length));

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a critical thinking partner. Challenge assumptions and push thinking deeper. Gently push the user toward a more complete, well-rounded document.

Generate provocations in these categories:
${provDescriptions}
${refContext}${guidanceContext}${objectiveContext}

Respond with a JSON object containing a "provocations" array. Generate ${perTypeCount} provocations per category.
For each provocation:
- type: The category (one of: ${typesList})
- title: A punchy headline (max 60 chars)
- content: A 2-3 sentence explanation that gently nudges the user to improve their document
- sourceExcerpt: A relevant quote from the source text (max 150 chars)
- scale: Impact level from 1-5 (1=minor tweak, 2=small improvement, 3=moderate gap, 4=significant issue, 5=critical flaw)

Focus on completeness: what's missing, what's thin, what could be stronger. Be constructive, not just critical.

Output only valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Generate provocations for this text:\n\n${analysisText}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsedResponse: Record<string, unknown> = {};
      try {
        parsedResponse = JSON.parse(content);
      } catch {
        console.error("Failed to parse provocations JSON:", content);
        return res.json({ provocations: [] });
      }

      const provocationsArray = Array.isArray(parsedResponse.provocations)
        ? parsedResponse.provocations
        : [];

      const provocations = provocationsArray.map((p: unknown, idx: number): Provocation => {
        const item = p as Record<string, unknown>;
        const provType = provocationType.includes(item?.type as ProvocationType)
          ? item.type as ProvocationType
          : requestedTypes[idx % requestedTypes.length];

        const rawScale = typeof item?.scale === 'number' ? item.scale : 3;
        const scale = Math.max(1, Math.min(5, Math.round(rawScale)));

        return {
          id: `${provType}-${Date.now()}-${idx}`,
          type: provType,
          title: typeof item?.title === 'string' ? item.title : "Untitled Provocation",
          content: typeof item?.content === 'string' ? item.content : "",
          sourceExcerpt: typeof item?.sourceExcerpt === 'string' ? item.sourceExcerpt : "",
          status: "pending",
          scale,
        };
      });

      res.json({ provocations });
    } catch (error) {
      console.error("Generate provocations error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate provocations", details: errorMessage });
    }
  });

  // Unified write endpoint - single interface to the AI writer
  app.post("/api/write", async (req, res) => {
    try {
      const parsed = writeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const {
        document,
        objective,
        selectedText,
        instruction: rawInstruction,
        provocation,
        tone,
        targetLength,
        referenceDocuments,
        editHistory
      } = parsed.data;

      // Step 1: Clean voice transcripts before processing
      let instruction = rawInstruction;
      let wasVoiceTranscript = false;
      if (isLikelyVoiceTranscript(rawInstruction)) {
        wasVoiceTranscript = true;
        instruction = await cleanVoiceTranscript(rawInstruction);
        console.log(`[Write API] Cleaned voice transcript: "${rawInstruction.slice(0, 50)}..." → "${instruction.slice(0, 50)}..."`);
      }

      // Classify the instruction type
      const instructionType = classifyInstruction(instruction);
      const strategy = instructionStrategies[instructionType];

      // Step 2: Generate plan for complex instructions
      let editPlan = "";
      if (isComplexInstruction(instruction, instructionType)) {
        editPlan = await generateEditPlan(document, instruction, selectedText, objective);
        if (editPlan) {
          console.log(`[Write API] Generated plan for complex instruction`);
        }
      }

      // Build context sections
      const contextParts: string[] = [];

      // Add instruction strategy
      contextParts.push(`INSTRUCTION TYPE: ${instructionType}
STRATEGY: ${strategy}`);

      // Add edit plan if generated
      if (editPlan) {
        contextParts.push(`EXECUTION PLAN (follow this step by step):
${editPlan}`);
      }

      // Add edit history for coherent iteration
      if (editHistory && editHistory.length > 0) {
        const historyStr = editHistory
          .slice(-5) // Last 5 edits
          .map(e => `- [${e.instructionType}] ${e.instruction.slice(0, 80)}${e.instruction.length > 80 ? "..." : ""}`)
          .join("\n");
        contextParts.push(`RECENT EDIT HISTORY (maintain consistency with previous changes):
${historyStr}`);
      }

      // Add reference document context for style inference
      if (referenceDocuments && referenceDocuments.length > 0) {
        // Extract and format style metrics from references
        const styleGuidance = formatStyleGuidance(referenceDocuments);

        // Also include a brief excerpt for context
        const refExcerpts = referenceDocuments.map(d => {
          const typeLabel = d.type === "style" ? "STYLE GUIDE"
            : d.type === "template" ? "TEMPLATE"
            : "EXAMPLE";
          return `[${typeLabel}: ${d.name}]\n${d.content.slice(0, 500)}${d.content.length > 500 ? "..." : ""}`;
        }).join("\n\n---\n\n");

        contextParts.push(`${styleGuidance}

REFERENCE EXCERPTS (for additional context):
${refExcerpts}`);
      }

      if (provocation) {
        const responseGuidance = provocationResponseExamples[provocation.type];
        contextParts.push(`PROVOCATION BEING ADDRESSED:
Type: ${provocation.type}
Challenge: ${provocation.title}
Details: ${provocation.content}
Relevant excerpt: "${provocation.sourceExcerpt}"

${responseGuidance}

The user's response should be integrated thoughtfully - don't just append it, weave it into the document naturally.`);
      }

      if (tone) {
        contextParts.push(`TONE: Write in a ${tone} voice`);
      }

      if (targetLength) {
        const lengthInstructions = {
          shorter: "Make it more concise (60-70% of current length)",
          same: "Maintain similar length",
          longer: "Expand with more detail (130-150% of current length)",
        };
        contextParts.push(`LENGTH: ${lengthInstructions[targetLength]}`);
      }

      const contextSection = contextParts.length > 0
        ? `\n\nCONTEXT:\n${contextParts.join("\n\n")}`
        : "";

      const focusInstruction = selectedText
        ? `The user has selected specific text to focus on. Apply the instruction primarily to this selection, but ensure it integrates well with the rest of the document.`
        : `Apply the instruction to improve the document holistically.`;

      // Build preservation directives based on context
      const preservationDirectives: string[] = [];
      if (selectedText) {
        preservationDirectives.push("- PRESERVE all text outside the selected area unless the instruction explicitly affects it");
        preservationDirectives.push("- DO NOT reformat or restructure sections that weren't mentioned");
      }
      if (instructionType === "correct") {
        preservationDirectives.push("- ONLY fix the specific error mentioned - no other changes");
      }
      if (instructionType === "style") {
        preservationDirectives.push("- PRESERVE the content and meaning - only change the voice/tone");
      }
      if (instructionType === "condense") {
        preservationDirectives.push("- PRESERVE all key information - only remove redundancy and filler");
      }
      // Always include these
      preservationDirectives.push("- DO NOT add information the user didn't mention or request");
      preservationDirectives.push("- DO NOT remove content unless explicitly asked to");
      preservationDirectives.push("- PRESERVE markdown formatting and structure unless asked to change it");

      const preservationSection = preservationDirectives.length > 0
        ? `\n\nPRESERVATION RULES (follow strictly):\n${preservationDirectives.join("\n")}`
        : "";

      // Two-step process: 1) Generate evolved document, 2) Analyze changes
      const documentResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          {
            role: "system",
            content: `You are an expert document editor helping a user iteratively shape their document.

DOCUMENT OBJECTIVE: ${objective}

Your role is to evolve the document based on the user's instruction while always keeping the objective in mind. The document should get better with each iteration - clearer, more compelling, better structured.

APPROACH:
1. First, understand exactly what the user wants changed
2. Identify the minimal set of changes needed
3. Execute those changes precisely
4. Verify you haven't made unintended changes

Guidelines:
1. ${focusInstruction}
2. Preserve the document's voice and structure unless explicitly asked to change it
3. Make targeted improvements, not wholesale rewrites
4. The output should be the complete evolved document (not just the changed parts)
5. Use markdown formatting for structure (headers, lists, emphasis) where appropriate
${contextSection}${preservationSection}

Output only the evolved document text. No explanations or meta-commentary.`
          },
          {
            role: "user",
            content: `CURRENT DOCUMENT:
${document}
${selectedText ? `\nSELECTED TEXT (focus area):\n"${selectedText}"` : ""}

INSTRUCTION: ${instruction}

Please evolve the document according to this instruction.`
          }
        ],
      });

      const evolvedDocument = documentResponse.choices[0]?.message?.content || document;

      // Analyze changes for structured output
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are a document change analyzer. Compare the original and evolved documents and provide a brief structured analysis.

Respond with a JSON object containing:
- summary: A one-sentence summary of what changed (max 100 chars)
- changes: An array of 1-3 change objects, each with:
  - type: "added" | "modified" | "removed" | "restructured"
  - description: What changed (max 60 chars)
  - location: Where in the document (e.g., "Introduction", "Second paragraph") (optional)
- suggestions: An array of 0-2 strings with potential next improvements (max 60 chars each)

Output only valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `ORIGINAL DOCUMENT:
${document.slice(0, 2000)}${document.length > 2000 ? "..." : ""}

EVOLVED DOCUMENT:
${evolvedDocument.slice(0, 2000)}${evolvedDocument.length > 2000 ? "..." : ""}

INSTRUCTION APPLIED: ${instruction}`
          }
        ],
        response_format: { type: "json_object" },
      });

      let changes: ChangeEntry[] = [];
      let suggestions: string[] = [];
      let summary = `Applied: ${instruction.slice(0, 100)}${instruction.length > 100 ? "..." : ""}`;

      try {
        const analysisContent = analysisResponse.choices[0]?.message?.content || "{}";
        const analysis = JSON.parse(analysisContent);
        if (typeof analysis.summary === 'string') {
          summary = analysis.summary;
        }
        if (Array.isArray(analysis.changes)) {
          changes = analysis.changes.slice(0, 3).map((c: unknown) => {
            const change = c as Record<string, unknown>;
            return {
              type: ['added', 'modified', 'removed', 'restructured'].includes(change.type as string)
                ? change.type as ChangeEntry['type']
                : 'modified',
              description: typeof change.description === 'string' ? change.description : 'Document updated',
              location: typeof change.location === 'string' ? change.location : undefined,
            };
          });
        }
        if (Array.isArray(analysis.suggestions)) {
          suggestions = analysis.suggestions
            .filter((s: unknown) => typeof s === 'string')
            .slice(0, 2);
        }
      } catch {
        // Use defaults if analysis fails
      }

      res.json({
        document: evolvedDocument.trim(),
        summary,
        instructionType,
        changes: changes.length > 0 ? changes : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      });
    } catch (error) {
      console.error("Write error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to evolve document", details: errorMessage });
    }
  });

  // Streaming write endpoint for long documents
  app.post("/api/write/stream", async (req, res) => {
    try {
      const parsed = writeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const {
        document,
        objective,
        selectedText,
        instruction,
        provocation,
        tone,
        targetLength,
        referenceDocuments,
        editHistory
      } = parsed.data;

      // Classify the instruction type
      const instructionType = classifyInstruction(instruction);
      const strategy = instructionStrategies[instructionType];

      // Build context sections
      const contextParts: string[] = [];

      contextParts.push(`INSTRUCTION TYPE: ${instructionType}
STRATEGY: ${strategy}`);

      if (editHistory && editHistory.length > 0) {
        const historyStr = editHistory
          .slice(-5)
          .map(e => `- [${e.instructionType}] ${e.instruction.slice(0, 80)}${e.instruction.length > 80 ? "..." : ""}`)
          .join("\n");
        contextParts.push(`RECENT EDIT HISTORY:\n${historyStr}`);
      }

      if (referenceDocuments && referenceDocuments.length > 0) {
        const refSummaries = referenceDocuments.map(d => {
          const typeLabel = d.type === "style" ? "STYLE GUIDE" : d.type === "template" ? "TEMPLATE" : "EXAMPLE";
          return `[${typeLabel}: ${d.name}]\n${d.content.slice(0, 500)}...`;
        }).join("\n\n---\n\n");
        contextParts.push(`REFERENCE DOCUMENTS:\n${refSummaries}`);
      }

      if (provocation) {
        contextParts.push(`PROVOCATION: ${provocation.title}\n${provocation.content}`);
      }

      if (tone) {
        contextParts.push(`TONE: ${tone}`);
      }

      if (targetLength) {
        contextParts.push(`LENGTH: ${targetLength}`);
      }

      const contextSection = contextParts.join("\n\n");

      const focusInstruction = selectedText
        ? `Focus on the selected text but ensure integration.`
        : `Apply holistically.`;

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Send instruction type first
      res.write(`data: ${JSON.stringify({ type: 'meta', instructionType })}\n\n`);

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are an expert document editor. OBJECTIVE: ${objective}

${contextSection}

Guidelines:
1. ${focusInstruction}
2. Preserve voice and structure unless asked otherwise
3. Output the complete evolved document
4. Use markdown formatting where appropriate

Output only the evolved document. No explanations.`
          },
          {
            role: "user",
            content: `DOCUMENT:\n${document}${selectedText ? `\n\nSELECTED TEXT:\n"${selectedText}"` : ""}\n\nINSTRUCTION: ${instruction}`
          }
        ],
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
        }
      }

      // Send completion with summary
      res.write(`data: ${JSON.stringify({
        type: 'done',
        summary: `Applied: ${instruction.slice(0, 100)}${instruction.length > 100 ? "..." : ""}`,
        instructionType
      })}\n\n`);

      res.end();
    } catch (error) {
      console.error("Stream write error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    }
  });

  // Summarize voice transcript into clear intent
  app.post("/api/summarize-intent", async (req, res) => {
    try {
      const { transcript, context } = req.body;

      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "Transcript is required" });
      }

      // AIM mode uses a dedicated prompt and higher-capability model
      if (context === "aim") {
        const aimResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert prompt engineer. The user has written a rough draft of a prompt for an AI tool. Your job is to restructure it using the AIM framework while preserving every bit of their original intent.

The AIM framework:
- **Actor**: Who should the AI be? Define the role, expertise, and persona.
- **Input**: What context, data, constraints, or background is the AI given?
- **Mission**: What exactly should the AI do? The task, output format, and success criteria.

## Rules
1. Be faithful to the user's intent — do NOT add information, requirements, or constraints they didn't mention.
2. If a part of the AIM framework is clearly missing from their draft, add a brief placeholder like "[Define the actor — what role should the AI take?]" so the user knows what to fill in.
3. Restructure and sharpen the language for clarity, but don't change the meaning.
4. Output the restructured prompt as a single cohesive instruction the user can copy-paste into an AI tool. Use the AIM sections as organizing headers.

## Output format
**Actor**
[Role description extracted/inferred from the draft]

**Input**
[Context, constraints, and data extracted from the draft]

**Mission**
[Clear task description with expected output]`
            },
            {
              role: "user",
              content: `Restructure this draft into an AIM-structured prompt:\n\n${transcript}`
            }
          ],
          max_tokens: 4000,
          temperature: 0.3,
        });

        const summary = aimResponse.choices[0]?.message?.content?.trim() || transcript;
        return res.json({
          summary,
          originalLength: transcript.length,
          summaryLength: summary.length,
        });
      }

      const contextLabel = context === "objective"
        ? "document objective/goal"
        : context === "source"
        ? "source material for a document"
        : "general content";

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting clear intent from spoken transcripts. The user has spoken a ${contextLabel}. Your job is to:

1. Clean up speech artifacts (um, uh, repeated words, false starts)
2. Extract the core intent/meaning
3. Present it as a clear, concise statement

For objectives: Output a single clear sentence describing what they want to create.
For source material: Clean up and organize the spoken content into readable paragraphs.

Be faithful to their intent - don't add information they didn't mention.`
          },
          {
            role: "user",
            content: `Raw transcript:\n\n${transcript}`
          }
        ],
        max_tokens: context === "source" ? 4000 : 500,
        temperature: 0.3,
      });

      const summary = response.choices[0]?.message?.content?.trim() || transcript;

      res.json({
        summary,
        originalLength: transcript.length,
        summaryLength: summary.length,
      });
    } catch (error) {
      console.error("Summarize intent error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to summarize", details: errorMessage });
    }
  });

  // Generate next interview question based on context
  app.post("/api/interview/question", async (req, res) => {
    try {
      const parsed = interviewQuestionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective, document: docText, template, previousEntries, provocations } = parsed.data;

      // Build context from previous Q&A
      const previousContext = previousEntries && previousEntries.length > 0
        ? previousEntries.map(e => `Topic: ${e.topic}\nQ: ${e.question}\nA: ${e.answer}`).join("\n\n")
        : "No previous questions yet — this is the first question.";

      // Build template context
      const templateContext = template
        ? `\n\nDOCUMENT TEMPLATE (sections that need to be covered):\n${template.slice(0, 2000)}`
        : "";

      // Build document context
      const documentContext = docText
        ? `\n\nCURRENT DOCUMENT STATE:\n${docText.slice(0, 2000)}`
        : "";

      // Build provocations context
      const pendingProvocations = provocations
        ? provocations.filter(p => p.status === "pending")
        : [];
      const provocationsContext = pendingProvocations.length > 0
        ? `\n\nPENDING PROVOCATIONS (challenges not yet addressed):\n${pendingProvocations.map(p => `- [${p.type}] ${p.title}: ${p.content}`).join("\n")}`
        : "";

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are a skilled interviewer helping a user develop their document by asking probing questions. Your goal is to extract the information, perspectives, and insights the user needs to include in their document.

OBJECTIVE: ${objective}
${templateContext}${documentContext}${provocationsContext}

PREVIOUS Q&A:
${previousContext}

Your job:
1. Identify what's MISSING — gaps in content, unexplored angles, unaddressed template sections
2. Ask ONE focused, provocative question that will elicit useful content for the document
3. Make the question specific and actionable — the user should be able to answer it directly
4. Don't repeat topics already covered in previous Q&A
5. Prioritize questions that address pending provocations or uncovered template sections
6. If the template is mostly covered and provocations addressed, ask about nuance, examples, or edge cases

Respond with a JSON object:
- question: The question to ask (conversational, direct, max 200 chars)
- topic: A short label for what this question covers (max 40 chars)
- reasoning: Brief internal reasoning for why this question matters (max 100 chars)

Output only valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Generate the next interview question to help me develop my document.`
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result: InterviewQuestionResponse;
      try {
        const parsed = JSON.parse(content);
        result = {
          question: typeof parsed.question === 'string' ? parsed.question : "What's the most important thing you haven't covered yet?",
          topic: typeof parsed.topic === 'string' ? parsed.topic : "General",
          reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : "",
        };
      } catch {
        result = {
          question: "What's the most important thing you haven't covered yet?",
          topic: "General",
          reasoning: "Fallback question",
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Interview question error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate interview question", details: errorMessage });
    }
  });

  // Summarize interview entries into a coherent instruction for the writer
  app.post("/api/interview/summary", async (req, res) => {
    try {
      const parsed = interviewSummaryRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective, entries, document: docText } = parsed.data;

      const qaText = entries.map(e => `Topic: ${e.topic}\nQ: ${e.question}\nA: ${e.answer}`).join("\n\n---\n\n");

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `You are an expert at synthesizing interview responses into clear editing instructions.

Given a series of Q&A pairs from a document development interview, create a single comprehensive instruction that tells a document editor how to integrate all the information gathered.

OBJECTIVE: ${objective}

The instruction should:
1. Group related answers by theme
2. Specify where new content should be added or what should be modified
3. Include all key points from the user's answers
4. Be written as a clear directive to a document editor

Output only the instruction text. No meta-commentary.`
          },
          {
            role: "user",
            content: `${docText ? `Current document:\n${docText.slice(0, 2000)}\n\n---\n\n` : ""}Interview Q&A:\n\n${qaText}`
          }
        ],
      });

      const instruction = response.choices[0]?.message?.content?.trim() || "";

      res.json({ instruction });
    } catch (error) {
      console.error("Interview summary error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to summarize interview", details: errorMessage });
    }
  });

  // ==========================================
  // Document Storage (server-side encryption)
  // Documents are encrypted at rest on the server.
  // Ownership is determined by Clerk userId.
  // ==========================================

  // Save a new document (server encrypts before storing)
  app.post("/api/documents", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = saveDocumentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { title, content } = parsed.data;
      const encrypted = encrypt(content, getEncryptionKey());

      const doc = await storage.saveDocument({
        userId,
        title,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
      });

      res.json({ id: doc.id, createdAt: doc.createdAt });
    } catch (error) {
      console.error("Save document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to save document", details: errorMessage });
    }
  });

  // Update an existing document (server re-encrypts)
  app.put("/api/documents/:id", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const parsed = updateDocumentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      // Verify ownership
      const existing = await storage.getDocument(id);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this document" });
      }

      const { title, content } = parsed.data;
      const encrypted = encrypt(content, getEncryptionKey());

      const result = await storage.updateDocument(id, {
        title,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
      });

      if (!result) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Update document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to update document", details: errorMessage });
    }
  });

  // List documents for the authenticated user
  app.get("/api/documents", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const items = await storage.listDocuments(userId);
      res.json({ documents: items });
    } catch (error) {
      console.error("List documents error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to list documents", details: errorMessage });
    }
  });

  // Load a document (server decrypts and returns plaintext)
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (doc.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to access this document" });
      }

      let content: string;
      try {
        content = decrypt(
          { ciphertext: doc.ciphertext, salt: doc.salt, iv: doc.iv },
          getEncryptionKey(),
        );
      } catch {
        // Document may have been encrypted with old client-side encryption
        // (passphrase + device key) and cannot be decrypted with server key
        return res.status(422).json({
          error: "Unable to decrypt document",
          details: "This document was saved with an older encryption method and cannot be opened. You can delete it and create a new one.",
        });
      }

      res.json({
        id: doc.id,
        title: doc.title,
        content,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    } catch (error) {
      console.error("Load document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to load document", details: errorMessage });
    }
  });

  // Delete a document (ownership verified via Clerk userId)
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const existing = await storage.getDocument(id);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this document" });
      }

      await storage.deleteDocument(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to delete document", details: errorMessage });
    }
  });

  // ==========================================
  // Streaming Provocation Type Endpoints
  // Agent-guided sequential question dialogue for requirement discovery
  // ==========================================

  // Generate next streaming question (agent asks sequential clarifying questions)
  app.post("/api/streaming/question", async (req, res) => {
    try {
      const parsed = streamingQuestionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective, document: docText, websiteUrl, wireframeNotes, previousEntries, requirements } = parsed.data;

      const previousContext = previousEntries && previousEntries.length > 0
        ? previousEntries.map(e => `[${e.role}]: ${e.content}`).join("\n")
        : "";

      const requirementsContext = requirements && requirements.length > 0
        ? `\n\nEXISTING REQUIREMENTS:\n${requirements.map((r, i) => `${i + 1}. [${r.status}] ${r.text}`).join("\n")}`
        : "";

      const wireframeContext = wireframeNotes
        ? `\n\nWIREFRAME NOTES:\n${wireframeNotes.slice(0, 2000)}`
        : "";

      const websiteContext = websiteUrl
        ? `\n\nTARGET WEBSITE: ${websiteUrl}`
        : "";

      const isFirstQuestion = !previousEntries || previousEntries.length === 0;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are a requirements discovery agent helping a user write crystal-clear requirements for a website or application. The user knows WHAT they want but not HOW to express it as implementable requirements.

Your behavior:
- You are NOT proactive. The user drives the session.
- You ask ONE sequential clarifying question at a time.
- ${isFirstQuestion ? 'This is the FIRST interaction. Ask: "What do you want me to do here?"' : 'Continue with follow-up questions like "What is next?" or ask about specifics based on the conversation so far.'}
- Build a sequence of requirements until each requirement is crystal clear.
- Your output should help produce requirements that an application or calling agent can implement.

OBJECTIVE: ${objective}
${websiteContext}${wireframeContext}${requirementsContext}

${previousContext ? `CONVERSATION SO FAR:\n${previousContext}` : ""}

Respond with a JSON object:
- question: Your next question to the user (conversational, direct, max 300 chars)
- topic: A short label for what this question covers (max 40 chars)
- suggestedRequirement: If the user's last answer implies a requirement, state it clearly here (optional, max 200 chars)

Output only valid JSON, no markdown.`
          },
          {
            role: "user",
            content: isFirstQuestion
              ? "I'm ready to start describing what I need."
              : "Generate the next question based on our conversation."
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result: StreamingQuestionResponse;
      try {
        const parsed = JSON.parse(content);
        result = {
          question: typeof parsed.question === "string" ? parsed.question : "What do you want me to do here?",
          topic: typeof parsed.topic === "string" ? parsed.topic : "Getting Started",
          suggestedRequirement: typeof parsed.suggestedRequirement === "string" ? parsed.suggestedRequirement : undefined,
        };
      } catch {
        result = {
          question: "What do you want me to do here?",
          topic: "Getting Started",
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Streaming question error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate streaming question", details: errorMessage });
    }
  });

  // Analyze wireframe components for requirement discovery
  app.post("/api/streaming/wireframe-analysis", async (req, res) => {
    try {
      const parsed = wireframeAnalysisRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective, websiteUrl, wireframeNotes, document: docText } = parsed.data;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `You are a website/application analysis expert. Analyze the wireframe description and identify key components, interactions, and areas that need requirement specifications.

OBJECTIVE: ${objective}
${websiteUrl ? `TARGET WEBSITE: ${websiteUrl}` : ""}
${docText ? `CURRENT DOCUMENT:\n${docText.slice(0, 2000)}` : ""}

Respond with a JSON object:
- analysis: A brief analysis of the wireframe/website structure (max 500 chars)
- components: An array of identified UI components or sections (strings, max 10 items)
- suggestions: An array of areas that need requirement clarification (strings, max 5 items)

Output only valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Analyze this wireframe:\n\n${wireframeNotes.slice(0, 3000)}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result: WireframeAnalysisResponse;
      try {
        const parsed = JSON.parse(content);
        result = {
          analysis: typeof parsed.analysis === "string" ? parsed.analysis : "Unable to analyze wireframe.",
          components: Array.isArray(parsed.components) ? parsed.components.filter((c: unknown) => typeof c === "string").slice(0, 10) : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s: unknown) => typeof s === "string").slice(0, 5) : [],
        };
      } catch {
        result = {
          analysis: "Unable to parse analysis.",
          components: [],
          suggestions: [],
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Wireframe analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to analyze wireframe", details: errorMessage });
    }
  });

  // Refine requirements from streaming dialogue entries
  app.post("/api/streaming/refine", async (req, res) => {
    try {
      const parsed = streamingRefineRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective, dialogueEntries, existingRequirements, document: docText } = parsed.data;

      const dialogueText = dialogueEntries.map(e => `[${e.role}]: ${e.content}`).join("\n");
      const existingReqText = existingRequirements && existingRequirements.length > 0
        ? `\n\nEXISTING REQUIREMENTS:\n${existingRequirements.map((r, i) => `${i + 1}. [${r.status}] ${r.text}`).join("\n")}`
        : "";

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are an expert requirements writer. Given a dialogue between a user and an agent, extract and refine clear, implementable requirements. Each requirement should be specific enough that a developer or AI agent can implement it without ambiguity.

OBJECTIVE: ${objective}
${existingReqText}

DIALOGUE:
${dialogueText}

${docText ? `CURRENT DOCUMENT:\n${docText.slice(0, 2000)}` : ""}

Respond with a JSON object:
- requirements: Array of requirement objects, each with: id (string), text (string - the requirement), status ("draft" | "confirmed" | "revised")
- updatedDocument: The full document text with requirements integrated as a structured list
- summary: Brief description of what was refined (max 200 chars)

Preserve existing confirmed requirements. Update draft requirements with new information. Add new requirements discovered in the dialogue.
Output only valid JSON, no markdown.`
          },
          {
            role: "user",
            content: "Refine the requirements based on our dialogue."
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result: StreamingRefineResponse;
      try {
        const parsed = JSON.parse(content);
        result = {
          requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
          updatedDocument: typeof parsed.updatedDocument === "string" ? parsed.updatedDocument : docText || "",
          summary: typeof parsed.summary === "string" ? parsed.summary : "Requirements refined.",
        };
      } catch {
        result = {
          requirements: [],
          updatedDocument: docText || "",
          summary: "Failed to parse refinement results.",
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Streaming refine error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to refine requirements", details: errorMessage });
    }
  });

  return httpServer;
}
