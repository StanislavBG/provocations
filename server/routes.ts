import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { 
  analyzeTextRequestSchema, 
  expandOutlineRequestSchema,
  refineTextRequestSchema,
  mergeTextRequestSchema,
  editTextRequestSchema,
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

  // Expand a heading into content - uses shared schema
  app.post("/api/expand", async (req, res) => {
    try {
      const parsed = expandOutlineRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { heading, context, tone } = parsed.data;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are a writing assistant helping users develop their arguments. Your tone should be ${tone}. 
            
Write a focused paragraph (100-200 words) that develops the given heading into substantive content. 
Use the provided context to inform your writing, but create original, well-structured prose.
Do not use bullet points or lists. Write in flowing paragraphs.
Output only the paragraph text, no headings or labels.`
          },
          {
            role: "user",
            content: `Heading: ${heading}\n\nContext from source material:\n${context?.slice(0, 4000) || "No context provided"}`
          }
        ],
      });

      const content = response.choices[0]?.message?.content || "";
      res.json({ content: content.trim() });
    } catch (error) {
      console.error("Expand error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to expand heading", details: errorMessage });
    }
  });

  // Refine text with tone and length adjustments - uses shared schema
  app.post("/api/refine", async (req, res) => {
    try {
      const parsed = refineTextRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { text, tone, targetLength } = parsed.data;

      const lengthInstruction = {
        shorter: "Condense the text to approximately 60-70% of its current length while preserving key points.",
        same: "Keep approximately the same length while refining the language.",
        longer: "Expand the text to approximately 130-150% of its current length with more detail and examples.",
      }[targetLength];

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `You are an expert editor helping refine written content. 

Apply these adjustments:
- Tone: Make the writing more ${tone}
- Length: ${lengthInstruction}

Preserve the overall structure and key arguments. Improve clarity and flow.
Output only the refined text, maintaining any section headings if present.`
          },
          {
            role: "user",
            content: text
          }
        ],
      });

      const refined = response.choices[0]?.message?.content || text;
      res.json({ refined: refined.trim() });
    } catch (error) {
      console.error("Refine error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to refine text", details: errorMessage });
    }
  });

  // Merge user feedback into document
  app.post("/api/merge", async (req, res) => {
    try {
      const parsed = mergeTextRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { originalText, userFeedback, provocationContext, selectedText, activeLens } = parsed.data;

      // Build context-aware system prompt
      let contextInfo = "";
      if (provocationContext) {
        contextInfo += `\n\nCONTEXT: The user was responding to this provocation:\n${provocationContext}`;
      }
      if (selectedText) {
        contextInfo += `\n\nFOCUS AREA: The user selected this specific text for improvement:\n"${selectedText}"`;
      }
      if (activeLens) {
        const lensDescriptions: Record<string, string> = {
          consumer: "end-user/customer perspective",
          executive: "strategic leadership perspective",
          technical: "technical implementation perspective",
          financial: "cost/ROI perspective",
          strategic: "competitive positioning perspective",
          skeptic: "critical/skeptical perspective",
        };
        contextInfo += `\n\nPERSPECTIVE: The user is viewing through the ${activeLens} lens (${lensDescriptions[activeLens]}).`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are an expert editor helping integrate user feedback into a document.

The user has been reviewing their document and responding to critical thinking provocations. They've provided verbal feedback that should be intelligently merged into their original document.

Your task:
1. Understand the user's feedback and insights
2. ${selectedText ? "Focus primarily on the selected text area, but consider if feedback applies elsewhere too" : "Identify where in the original document these insights are relevant"}
3. Intelligently integrate the feedback where appropriate
4. Maintain the document's original structure and voice
5. Don't just append - weave the new insights naturally into the existing text
6. Make targeted improvements, not wholesale rewrites
${contextInfo}

Output only the merged document text, no explanations or metadata.`
          },
          {
            role: "user",
            content: `ORIGINAL DOCUMENT:
${originalText}

USER'S FEEDBACK TO INTEGRATE:
${userFeedback}
${selectedText ? `\nTARGET SECTION (user selected this text):\n"${selectedText}"` : ""}

Please merge the feedback intelligently into the document${selectedText ? ", focusing on the selected section" : ""}.`
          }
        ],
      });

      const mergedText = response.choices[0]?.message?.content || originalText;
      res.json({ mergedText: mergedText.trim() });
    } catch (error) {
      console.error("Merge error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to merge feedback", details: errorMessage });
    }
  });

  // Edit selected text based on user instruction
  app.post("/api/edit-text", async (req, res) => {
    try {
      const parsed = editTextRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { instruction, selectedText, fullDocument } = parsed.data;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `You are an expert editor helping modify a specific portion of a document based on user instructions.

You will receive:
1. A user instruction describing how to modify the text
2. The specific text that needs to be modified (the selection)
3. The full document for context

Your task:
- Apply the user's instruction ONLY to the selected text
- Use the full document context to make informed decisions about tone, style, and content
- Return ONLY the modified version of the selected text
- Preserve the general structure unless the instruction requires changing it
- Be precise - return only what should replace the selected text, nothing more

Output only the modified text. No explanations, no markdown, no quotes around the text.`
          },
          {
            role: "user",
            content: `INSTRUCTION: ${instruction}

SELECTED TEXT TO MODIFY:
${selectedText}

FULL DOCUMENT (for context):
${fullDocument}`
          }
        ],
      });

      const modifiedText = response.choices[0]?.message?.content || selectedText;
      res.json({ modifiedText: modifiedText.trim() });
    } catch (error) {
      console.error("Edit-text error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to edit text", details: errorMessage });
    }
  });

  return httpServer;
}
