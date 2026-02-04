import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import {
  analyzeTextRequestSchema,
  writeRequestSchema,
  lensTypes,
  provocationType,
  type LensType,
  type ProvocationType,
  type Lens,
  type Provocation
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Main analysis endpoint - generates lenses and provocations
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeTextRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { text, selectedLenses } = parsed.data;

      // Check if text will be truncated for analysis
      const MAX_ANALYSIS_LENGTH = 8000;
      const wasTextTruncated = text.length > MAX_ANALYSIS_LENGTH;
      const analysisText = text.slice(0, MAX_ANALYSIS_LENGTH);

      // Create document (stores full text)
      const document = await storage.createDocument(text);

      // Use selected lenses or default to all
      const lensesToGenerate = selectedLenses && selectedLenses.length > 0
        ? selectedLenses
        : lensTypes;

      // Generate lenses in parallel
      const lensPromises = lensesToGenerate.map(async (lensType): Promise<Lens> => {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            max_completion_tokens: 1024,
            messages: [
              {
                role: "system",
                content: `You are an analytical assistant helping users understand text through specific lenses. ${lensPrompts[lensType]}

Respond with a JSON object containing:
- title: A brief title for this lens analysis (max 50 chars)
- summary: A 2-3 sentence summary from this perspective
- keyPoints: An array of 3-5 key observations (each max 30 chars)

Output only valid JSON, no markdown.`
              },
              {
                role: "user",
                content: `Analyze this text through the ${lensType} lens:\n\n${analysisText}`
              }
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content || "{}";
          let parsedResponse: Record<string, unknown> = {};
          try {
            parsedResponse = JSON.parse(content);
          } catch {
            console.error(`Failed to parse JSON for ${lensType} lens:`, content);
          }
          
          return {
            id: `${lensType}-${Date.now()}`,
            type: lensType,
            title: typeof parsedResponse.title === 'string' ? parsedResponse.title : `${lensType} Analysis`,
            summary: typeof parsedResponse.summary === 'string' ? parsedResponse.summary : "Analysis not available",
            keyPoints: Array.isArray(parsedResponse.keyPoints) ? parsedResponse.keyPoints : [],
            isActive: false,
          };
        } catch (error) {
          console.error(`Error generating ${lensType} lens:`, error);
          return {
            id: `${lensType}-${Date.now()}`,
            type: lensType,
            title: `${lensType} Analysis`,
            summary: "Analysis could not be generated",
            keyPoints: [],
            isActive: false,
          };
        }
      });

      // Generate provocations in parallel
      const provocationPromises = provocationType.map(async (provType): Promise<Provocation[]> => {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            max_completion_tokens: 2048,
            messages: [
              {
                role: "system",
                content: `You are a critical thinking partner. Your job is to challenge the user's assumptions and push their thinking deeper. ${provocationPrompts[provType]}

Generate 2-3 provocations. For each, provide:
- title: A punchy headline for the provocation (max 60 chars)
- content: A 2-3 sentence explanation of the provocation
- sourceExcerpt: A relevant quote from the source text that this provocation relates to (max 150 chars)

Respond with a JSON object containing an array called "provocations".
Output only valid JSON, no markdown.`
              },
              {
                role: "user",
                content: `Generate ${provType} provocations for this text:\n\n${analysisText}`
              }
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content || "{}";
          let parsedResponse: Record<string, unknown> = {};
          try {
            parsedResponse = JSON.parse(content);
          } catch {
            console.error(`Failed to parse JSON for ${provType} provocations:`, content);
            return [];
          }
          
          const provocationsArray = Array.isArray(parsedResponse.provocations) 
            ? parsedResponse.provocations 
            : [];
            
          return provocationsArray.map((p: unknown, idx: number): Provocation => {
            const item = p as Record<string, unknown>;
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
          console.error(`Error generating ${provType} provocations:`, error);
          return [];
        }
      });

      const [lenses, provocationArrays] = await Promise.all([
        Promise.all(lensPromises),
        Promise.all(provocationPromises),
      ]);

      const provocations = provocationArrays.flat();

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
        targetLength
      } = parsed.data;

      // Build context sections
      const contextParts: string[] = [];

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
        ? `\n\nADDITIONAL CONTEXT:\n${contextParts.join("\n\n")}`
        : "";

      const focusInstruction = selectedText
        ? `The user has selected specific text to focus on. Apply the instruction primarily to this selection, but ensure it integrates well with the rest of the document.`
        : `Apply the instruction to improve the document holistically.`;

      const response = await openai.chat.completions.create({
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

      const evolvedDocument = response.choices[0]?.message?.content || document;
      res.json({
        document: evolvedDocument.trim(),
        summary: `Applied: ${instruction.slice(0, 100)}${instruction.length > 100 ? "..." : ""}`
      });
    } catch (error) {
      console.error("Write error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to evolve document", details: errorMessage });
    }
  });

  return httpServer;
}
