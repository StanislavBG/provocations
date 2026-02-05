import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import {
  analyzeTextRequestSchema,
  writeRequestSchema,
  lensTypes,
  provocationType,
  instructionTypes,
  type LensType,
  type ProvocationType,
  type InstructionType,
  type Lens,
  type Provocation,
  type ReferenceDocument,
  type ChangeEntry
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const lensPrompts: Record<LensType, string> = {
  consumer: "Analyze from a consumer/end-user perspective. What matters to customers? What pain points or delights exist?",
  executive: "Analyze from a leadership/executive perspective. What are the strategic implications, risks, and opportunities?",
  technical: "Analyze from a technical implementation perspective. What's feasible, what are the constraints, what technical debt exists?",
  financial: "Analyze from a financial perspective. What are the costs, revenues, ROI implications, and budget considerations?",
  strategic: "Analyze from a long-term strategic perspective. How does this affect competitive positioning and market presence?",
  skeptic: "Analyze with healthy skepticism. What assumptions are being made? What could go wrong? What's being overlooked?",
};

const provocationPrompts: Record<ProvocationType, string> = {
  opportunity: "Identify potential opportunities for growth, innovation, or improvement that might be missed.",
  fallacy: "Identify logical fallacies, weak arguments, unsupported claims, or gaps in reasoning.",
  alternative: "Suggest alternative approaches, different perspectives, or lateral thinking opportunities.",
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

      const { text, selectedLenses, referenceDocuments } = parsed.data;

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

      // Use selected lenses or default to all
      const lensesToGenerate = selectedLenses && selectedLenses.length > 0
        ? selectedLenses
        : lensTypes;

      // BATCHED CALL 1: Generate all lenses in a single API call
      const lensesPromise = (async (): Promise<Lens[]> => {
        try {
          const lensDescriptions = lensesToGenerate.map(t => `- ${t}: ${lensPrompts[t]}`).join("\n");

          const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            max_completion_tokens: 4096,
            messages: [
              {
                role: "system",
                content: `You are an analytical assistant helping users understand text through multiple perspectives.

Analyze the given text through each of these lenses:
${lensDescriptions}

Respond with a JSON object containing a "lenses" array. For each lens, provide:
- type: The lens type (${lensesToGenerate.join(", ")})
- title: A brief title for this lens analysis (max 50 chars)
- summary: A 2-3 sentence summary from this perspective
- keyPoints: An array of 3-5 key observations (each max 30 chars)

Output only valid JSON, no markdown.`
              },
              {
                role: "user",
                content: `Analyze this text through the following lenses (${lensesToGenerate.join(", ")}):\n\n${analysisText}`
              }
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content || "{}";
          let parsedResponse: Record<string, unknown> = {};
          try {
            parsedResponse = JSON.parse(content);
          } catch {
            console.error("Failed to parse lenses JSON:", content);
          }

          const lensesArray = Array.isArray(parsedResponse.lenses) ? parsedResponse.lenses : [];

          return lensesToGenerate.map((lensType, idx): Lens => {
            const lensData = lensesArray.find((l: unknown) =>
              (l as Record<string, unknown>)?.type === lensType
            ) || lensesArray[idx] || {};
            const item = lensData as Record<string, unknown>;

            return {
              id: `${lensType}-${Date.now()}-${idx}`,
              type: lensType,
              title: typeof item?.title === 'string' ? item.title : `${lensType} Analysis`,
              summary: typeof item?.summary === 'string' ? item.summary : "Analysis not available",
              keyPoints: Array.isArray(item?.keyPoints) ? item.keyPoints : [],
              isActive: false,
            };
          });
        } catch (error) {
          console.error("Error generating lenses:", error);
          return lensesToGenerate.map((lensType, idx): Lens => ({
            id: `${lensType}-${Date.now()}-${idx}`,
            type: lensType,
            title: `${lensType} Analysis`,
            summary: "Analysis could not be generated",
            keyPoints: [],
            isActive: false,
          }));
        }
      })();

      // BATCHED CALL 2: Generate all provocations in a single API call
      const provocationsPromise = (async (): Promise<Provocation[]> => {
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

Respond with a JSON object containing a "provocations" array. Generate 2-3 provocations per category (6-9 total).
For each provocation:
- type: The category (opportunity, fallacy, or alternative)
- title: A punchy headline (max 60 chars)
- content: A 2-3 sentence explanation
- sourceExcerpt: A relevant quote from the source text (max 150 chars)

Output only valid JSON, no markdown.`
              },
              {
                role: "user",
                content: `Generate provocations (opportunities, fallacies, and alternatives) for this text:\n\n${analysisText}`
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
              : provocationType[idx % 3];

            return {
              id: `${provType}-${Date.now()}-${idx}`,
              type: provType,
              title: typeof item?.title === 'string' ? item.title : "Untitled Provocation",
              content: typeof item?.content === 'string' ? item.content : "",
              sourceExcerpt: typeof item?.sourceExcerpt === 'string' ? item.sourceExcerpt : "",
              status: "pending",
            };
          });
        } catch (error) {
          console.error("Error generating provocations:", error);
          return [];
        }
      })();

      // Execute both batched calls in parallel
      const [lenses, provocations] = await Promise.all([lensesPromise, provocationsPromise]);

      res.json({
        document,
        lenses,
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
        instruction,
        provocation,
        activeLens,
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

      // Add instruction strategy
      contextParts.push(`INSTRUCTION TYPE: ${instructionType}
STRATEGY: ${strategy}`);

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
        const refSummaries = referenceDocuments.map(d => {
          const typeLabel = d.type === "style" ? "STYLE GUIDE"
            : d.type === "template" ? "TEMPLATE"
            : "EXAMPLE";
          return `[${typeLabel}: ${d.name}]\n${d.content.slice(0, 1000)}${d.content.length > 1000 ? "..." : ""}`;
        }).join("\n\n---\n\n");

        contextParts.push(`REFERENCE DOCUMENTS (use these to guide tone, style, and structure):
${refSummaries}

Analyze the style, structure, and voice of these references. Match the target document's quality, formatting patterns, and professional standards where appropriate.`);
      }

      if (activeLens) {
        const lensDescriptions: Record<LensType, string> = {
          consumer: "end-user/customer perspective - focusing on user needs and experience",
          executive: "strategic leadership perspective - focusing on business impact",
          technical: "technical implementation perspective - focusing on feasibility",
          financial: "financial perspective - focusing on costs and ROI",
          strategic: "competitive positioning perspective - focusing on market advantage",
          skeptic: "critical perspective - questioning assumptions and risks",
        };
        contextParts.push(`PERSPECTIVE: Apply the ${activeLens} lens (${lensDescriptions[activeLens]})`);
      }

      if (provocation) {
        contextParts.push(`PROVOCATION BEING ADDRESSED:
Type: ${provocation.type}
Challenge: ${provocation.title}
Details: ${provocation.content}
Relevant excerpt: "${provocation.sourceExcerpt}"`);
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

Guidelines:
1. ${focusInstruction}
2. Preserve the document's voice and structure unless explicitly asked to change it
3. Make targeted improvements, not wholesale rewrites
4. The output should be the complete evolved document (not just the changed parts)
5. Use markdown formatting for structure (headers, lists, emphasis) where appropriate
${contextSection}

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
        activeLens,
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

      if (activeLens) {
        const lensDescriptions: Record<LensType, string> = {
          consumer: "end-user/customer perspective",
          executive: "strategic leadership perspective",
          technical: "technical implementation perspective",
          financial: "financial perspective",
          strategic: "competitive positioning perspective",
          skeptic: "critical perspective",
        };
        contextParts.push(`PERSPECTIVE: ${activeLens} lens (${lensDescriptions[activeLens]})`);
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

  return httpServer;
}
