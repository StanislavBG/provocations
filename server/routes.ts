import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import {
  analyzeTextRequestSchema,
  writeRequestSchema,
  generateProvocationsRequestSchema,
  generateTemplateRequestSchema,
  interviewQuestionRequestSchema,
  interviewSummaryRequestSchema,
  saveEncryptedDocumentRequestSchema,
  updateEncryptedDocumentRequestSchema,
  listEncryptedDocumentsRequestSchema,
  provocationType,
  instructionTypes,
  type ProvocationType,
  type InstructionType,
  type Provocation,
  type ReferenceDocument,
  type ChangeEntry,
  type InterviewQuestionResponse,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const provocationPrompts: Record<ProvocationType, string> = {
  opportunity: "Identify potential opportunities for growth, innovation, or improvement that might be missed.",
  fallacy: "Identify logical fallacies, weak arguments, unsupported claims, or gaps in reasoning.",
  alternative: "Suggest alternative approaches, different perspectives, or lateral thinking opportunities.",
  challenge: "Based on the user's objective, identify what's missing, incomplete, or underdeveloped. Push the user toward a more complete, well-rounded document by highlighting gaps in coverage, depth, or clarity.",
  thinking_bigger: "Push the user to think bigger — challenge them to raise the ambition, scope, or impact of their ideas. Ask why they're settling for incremental when transformative is possible. Question small targets, safe assumptions, and limited vision.",
  performance: "As a Performance Reviewer: Question scalability, throughput, and expected load. Clarify that the business requirements are translated into concrete technical expectations. Ask about bottlenecks, response times, data volumes, and what happens at scale.",
  ux: "As a UX Reviewer: Question how users will discover, understand, and complete tasks. Ask 'how would a user know to do this?' and 'what happens if they get confused here?' Push for clarity on layout, flows, error states, and ease of use.",
  architecture: "As an Architecture Reviewer: Question the clarity of system abstractions — frontend components, backend services, system-to-system communication. Push for well-defined boundaries, API contracts, data flow, and separation of concerns.",
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

// Provocation response examples for better guidance
const provocationResponseExamples: Record<ProvocationType, string> = {
  opportunity: `Example good responses to opportunity provocations:
- "Add a section about X to address this gap"
- "Expand the benefits section to include Y"
- "Include a case study showing Z"
The goal is to enrich the document with new content that addresses the opportunity.`,

  fallacy: `Example good responses to fallacy provocations:
- "Add evidence to support the claim about X"
- "Soften the absolute language in paragraph Y"
- "Add a counterargument and address it"
The goal is to strengthen the argument with better reasoning or evidence.`,

  alternative: `Example good responses to alternative provocations:
- "Acknowledge the alternative approach and explain why we chose this one"
- "Add a comparison section weighing both options"
- "Include the alternative as an option for different use cases"
The goal is to show thoughtful consideration of alternatives.`,

  challenge: `Example good responses to challenge provocations:
- "You're right, I need to add a section covering X"
- "Let me flesh out the Y section with more specifics"
- "I should address Z to make this more complete"
The goal is to fill gaps and push the document toward completeness based on the objective.`,

  thinking_bigger: `Example good responses to thinking bigger provocations:
- "You're right, I'm aiming too low — let me reframe X as a platform opportunity"
- "Instead of targeting just Y, let me expand the vision to include Z"
- "I should articulate a bolder 10x version of this strategy"
The goal is to raise the ambition and scope of the document's ideas and proposals.`,

  performance: `Example good responses to performance provocations:
- "We expect 10k concurrent users at peak, I should specify that"
- "Good point — I'll add expected response time targets for the API"
- "Let me clarify the data volume expectations and caching strategy"
The goal is to make performance expectations explicit and technically grounded.`,

  ux: `Example good responses to UX provocations:
- "You're right, users won't know about that feature — I'll add onboarding guidance"
- "I need to describe the error state when X fails"
- "Let me clarify the navigation flow from A to B"
The goal is to ensure every user-facing interaction is thought through.`,

  architecture: `Example good responses to architecture provocations:
- "I should define the API contract between the frontend and this service"
- "Good catch — the boundary between X and Y components isn't clear"
- "Let me add a section on how data flows from the client through to storage"
The goal is to ensure system abstractions are well-defined and communication patterns are explicit.`,
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
  
  // Main analysis endpoint - generates lenses and provocations
  // Optimized: 2 batched API calls instead of 9 individual calls
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeTextRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { text, referenceDocuments } = parsed.data;

      // Check if text will be truncated for analysis
      const MAX_ANALYSIS_LENGTH = 8000;
      const wasTextTruncated = text.length > MAX_ANALYSIS_LENGTH;
      const analysisText = text.slice(0, MAX_ANALYSIS_LENGTH);

      // Prepare reference document summary for prompts
      const refDocSummary = referenceDocuments && referenceDocuments.length > 0
        ? referenceDocuments.map(d => `[${d.type.toUpperCase()}: ${d.name}]\n${d.content.slice(0, 500)}${d.content.length > 500 ? "..." : ""}`).join("\n\n")
        : null;

      // Create document (stores full text)
      const document = await storage.createDocument(text);

      // Generate all provocations in a single API call
      const provocations: Provocation[] = await (async (): Promise<Provocation[]> => {
        try {
          const refContext = refDocSummary
            ? `\n\nThe user has provided reference documents that represent their target quality:\n${refDocSummary}\n\nCompare the source text against these references to identify gaps.`
            : "";

          const provDescriptions = provocationType.map(t => `- ${t}: ${provocationPrompts[t]}`).join("\n");

          const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            max_completion_tokens: 4096,
            messages: [
              {
                role: "system",
                content: `You are a critical thinking partner. Challenge assumptions and push thinking deeper.

Generate provocations in these categories:
${provDescriptions}
${refContext}

Respond with a JSON object containing a "provocations" array. Generate 1-2 provocations per category.
For each provocation:
- type: The category (one of: ${provocationType.join(", ")})
- title: A punchy headline (max 60 chars)
- content: A 2-3 sentence explanation
- sourceExcerpt: A relevant quote from the source text (max 150 chars)
- scale: Impact level from 1-5 (1=minor tweak, 2=small improvement, 3=moderate gap, 4=significant issue, 5=critical flaw)

Output only valid JSON, no markdown.`
              },
              {
                role: "user",
                content: `Generate provocations across all categories for this text:\n\n${analysisText}`
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
            return [];
          }

          const provocationsArray = Array.isArray(parsedResponse.provocations)
            ? parsedResponse.provocations
            : [];

          return provocationsArray.map((p: unknown, idx: number): Provocation => {
            const item = p as Record<string, unknown>;
            const provType = provocationType.includes(item?.type as ProvocationType)
              ? item.type as ProvocationType
              : provocationType[idx % provocationType.length];

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
        } catch (error) {
          console.error("Error generating provocations:", error);
          return [];
        }
      })();

      res.json({
        document,
        provocations,
        warnings: wasTextTruncated ? [{
          type: "text_truncated",
          message: `Your text (${text.length.toLocaleString()} characters) was truncated to ${MAX_ANALYSIS_LENGTH.toLocaleString()} characters for analysis. The full document is preserved.`
        }] : undefined
      });
    } catch (error) {
      console.error("Analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to analyze text", details: errorMessage });
    }
  });

  // Generate new provocations for an existing document
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

  // Generate a document template from an objective
  app.post("/api/generate-template", async (req, res) => {
    try {
      const parsed = generateTemplateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective } = parsed.data;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are an expert document strategist. Given a document objective, generate a comprehensive template that serves as a blueprint for the document the user needs to create.

The template should:
1. Include all key sections/headings the document should have
2. Under each section, provide brief guidance on what content belongs there
3. Include placeholder prompts that help the user think about what to write
4. Be structured with markdown headings and bullet points
5. Cover completeness — include sections that are commonly forgotten

The template is NOT the final document. It's a guide that helps the user know what to cover and in what order.

Output only the template content in markdown format. No meta-commentary.`
          },
          {
            role: "user",
            content: `Generate a comprehensive document template for this objective:\n\n${objective}`
          }
        ],
      });

      const template = response.choices[0]?.message?.content?.trim() || "";

      res.json({
        template,
        name: `Template: ${objective.slice(0, 50)}${objective.length > 50 ? "..." : ""}`,
      });
    } catch (error) {
      console.error("Generate template error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate template", details: errorMessage });
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
  // Encrypted Document Storage (E2EE)
  // ==========================================

  // Save an encrypted document
  app.post("/api/documents/save", async (req, res) => {
    try {
      const parsed = saveEncryptedDocumentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { ownerHash, title, ciphertext, salt, iv } = parsed.data;

      const doc = await storage.saveEncryptedDocument({ ownerHash, title, ciphertext, salt, iv });

      res.json({ id: doc.id, createdAt: doc.createdAt });
    } catch (error) {
      console.error("Save encrypted document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to save document", details: errorMessage });
    }
  });

  // Update an existing encrypted document
  app.put("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const parsed = updateEncryptedDocumentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await storage.updateEncryptedDocument(id, parsed.data);

      if (!result) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Update encrypted document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to update document", details: errorMessage });
    }
  });

  // List encrypted documents for an owner
  app.post("/api/documents/list", async (req, res) => {
    try {
      const parsed = listEncryptedDocumentsRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { ownerHash } = parsed.data;

      const items = await storage.listEncryptedDocuments(ownerHash);

      res.json({ documents: items });
    } catch (error) {
      console.error("List encrypted documents error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to list documents", details: errorMessage });
    }
  });

  // Load a single encrypted document
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const doc = await storage.getEncryptedDocument(id);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(doc);
    } catch (error) {
      console.error("Load encrypted document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to load document", details: errorMessage });
    }
  });

  // Delete an encrypted document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      await storage.deleteEncryptedDocument(id);

      res.json({ success: true });
    } catch (error) {
      console.error("Delete encrypted document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to delete document", details: errorMessage });
    }
  });

  return httpServer;
}
