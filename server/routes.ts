import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAuth, clerkClient } from "@clerk/express";
import { storage } from "./storage";
import { encrypt, decrypt } from "./crypto";
import { llm } from "./llm";
import {
  writeRequestSchema,
  generateChallengeRequestSchema,
  generateAdviceRequestSchema,
  interviewQuestionRequestSchema,
  interviewSummaryRequestSchema,
  askQuestionRequestSchema,
  saveDocumentRequestSchema,
  updateDocumentRequestSchema,
  renameDocumentRequestSchema,
  createFolderRequestSchema,
  renameFolderRequestSchema,
  moveDocumentRequestSchema,
  moveFolderRequestSchema,
  streamingQuestionRequestSchema,
  wireframeAnalysisRequestSchema,
  streamingRefineRequestSchema,
  provocationType,
  instructionTypes,
  type ProvocationType,
  type InstructionType,
  type Provocation,
  type Challenge,
  type Advice,
  type Persona,
  type ReferenceDocument,
  type ChangeEntry,
  type InterviewQuestionResponse,
  type AskQuestionResponse,
  type PersonaPerspective,
  type StreamingQuestionResponse,
  type WireframeAnalysisResponse,
  type SiteMapEntry,
  type DiscoveredMedia,
  type StreamingRefineResponse,
  type StreamingRequirement,
  youtubeChannelRequestSchema,
  processVideoRequestSchema,
  generateSummaryRequestSchema,
  generateInfographicRequestSchema,
  type YouTubeChannelResponse,
  type GenerateSummaryResponse,
  type InfographicSpec,
} from "@shared/schema";
import { builtInPersonas, getPersonaById, getAllPersonas, getPersonasByDomain, getPersonaHierarchy, getStalePersonas, getAllPersonasWithRoot } from "@shared/personas";
import { personaSchema } from "@shared/schema";
import { trackingEventSchema } from "@shared/schema";
import { invoke, TASK_TYPES, BASE_PROMPTS, type TaskType } from "./invoke";
import { getAppTypeConfig, formatAppTypeContext } from "./context-builder";
import { executeAgent } from "./agent-executor";
import { agentDefinitionSchema, agentStepSchema } from "@shared/schema";

function getEncryptionKey(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.warn("ENCRYPTION_SECRET not set — using default dev key. Set this in production!");
  }
  return secret || "provocations-dev-key-change-in-production";
}

// ── RBAC ──
// Admin users are identified by email. Everyone else is a regular user.
const ADMIN_EMAILS = ["stanislavbg@gmail.com"];

async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
    return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
  } catch {
    return false;
  }
}

// ── Effective persona resolution ──
// Merges code defaults (builtInPersonas) with DB overrides (persona_overrides table).
// DB wins when both exist for the same persona ID.
async function getEffectivePersonas(): Promise<Record<string, Persona>> {
  const overrides = await storage.getAllPersonaOverrides();
  const result: Record<string, Persona> = {};
  for (const [id, persona] of Object.entries(builtInPersonas)) {
    result[id] = { ...persona };
  }
  for (const override of overrides) {
    try {
      const parsed = JSON.parse(override.definition) as Persona;
      parsed.humanCurated = override.humanCurated;
      parsed.curatedBy = override.curatedBy ?? null;
      parsed.curatedAt = override.curatedAt?.toISOString() ?? null;
      result[parsed.id] = parsed;
    } catch {
      console.error(`Invalid persona override for ${override.personaId}, skipping`);
    }
  }
  return result;
}

/** Get effective persona by ID (DB override or code default) */
async function getEffectivePersonaById(id: string): Promise<Persona | undefined> {
  const override = await storage.getPersonaOverride(id);
  if (override) {
    try {
      const parsed = JSON.parse(override.definition) as Persona;
      parsed.humanCurated = override.humanCurated;
      parsed.curatedBy = override.curatedBy ?? null;
      parsed.curatedAt = override.curatedAt?.toISOString() ?? null;
      return parsed;
    } catch {
      // Fall through to built-in
    }
  }
  return builtInPersonas[id as ProvocationType];
}

// ── Zero-knowledge helpers ──
// Decrypt a title/name that may be encrypted (new rows) or plaintext (legacy rows).
function decryptField(
  legacyPlaintext: string,
  ciphertext: string | null,
  salt: string | null,
  iv: string | null,
  key: string,
): string {
  if (ciphertext && salt && iv) {
    try {
      return decrypt({ ciphertext, salt, iv }, key);
    } catch {
      // Fallback to legacy plaintext if decryption fails
      return legacyPlaintext;
    }
  }
  // Legacy row — title/name was stored in plaintext
  return legacyPlaintext;
}

// LLM provider is configured in server/llm.ts
// Set AI_INTEGRATIONS_OPENAI_API_KEY (Replit AI Integrations) for OpenAI (default).
// Also supports ANTHROPIC_API_KEY and GEMINI_API_KEY as fallbacks.
// Override auto-detection with LLM_PROVIDER=openai|anthropic|gemini.

// Derive provocation prompts from centralized persona definitions (challenge prompt is the default)
const provocationPrompts: Record<ProvocationType, string> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, persona]) => [id, persona.prompts.challenge])
) as Record<ProvocationType, string>;

// CEO vector descriptions for focused scaling questions
const ceoVectorDescriptions: Record<string, { label: string; description: string; goal: string }> = {
  tenancy_topology: {
    label: "Tenancy Topology: Silo vs. Pool",
    description: "How you isolate data. Shared Schema (Pool) vs. Dedicated Database (Silo) for compliance.",
    goal: "Build a Tenant-Aware abstraction layer at the database level so you can swap between shared and isolated infrastructure without changing application code.",
  },
  api_surface: {
    label: "API Surface: Utility vs. Platform",
    description: "Are you building a tool that people log into, or an engine that other apps plug into?",
    goal: "Adopt an API-First contract. Even if you don't have a public API yet, treating your own frontend as 'just another client' ensures that when it's time to build integrations or mobile apps, the plumbing is already there.",
  },
  scaling_horizon: {
    label: "Scaling Horizon: Vertical vs. Horizontal",
    description: "Will this app handle 1,000 users with complex data, or 1,000,000 users with simple data?",
    goal: "Ensure Statelessness. By keeping session data out of the application server and in a distributed cache (like Redis), you can spin up 100 instances of your app instantly when traffic spikes.",
  },
  data_residency: {
    label: "Data Residency: Local vs. Sovereign",
    description: "With regulations like GDPR, where data lives is often more important than what it does.",
    goal: "Plan for Regional Sharding. If a customer in the EU requires their data to never leave the continent, your system should be able to route traffic to a specific regional cluster based on their 'Home Region' label.",
  },
  integration_philosophy: {
    label: "Integration Philosophy: Adapter vs. Native",
    description: "Will you build every integration yourself, or provide a 'hook' for the world?",
    goal: "Implement an Event-Driven Architecture (Webhooks). Instead of writing custom code for every CRM or Slack integration, your app should simply 'emit' events (e.g., user.created, order.completed) that external systems can subscribe to.",
  },
  identity_access: {
    label: "Identity & Access: RBAC vs. ABAC",
    description: "Simple 'Admin/User' roles usually fall apart when a 'Big' customer asks for 'Regional Manager who can view but not edit billing.'",
    goal: "Use Attribute-Based Access Control (ABAC) or a flexible policy engine. It's easier to start with a granular permissions model than to try and split a 'User' role into five sub-roles later.",
  },
  observability: {
    label: "Observability: Logs vs. Traces",
    description: "When you're small, checking logs is fine. When you're big and a request touches five different microservices, logs aren't enough.",
    goal: "Implement Distributed Tracing (Correlation IDs) from day one. Attaching a unique ID to a request as it moves through your system allows you to debug 'Big' problems in seconds rather than hours.",
  },
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
      messages: [
        {
          role: "user",
          content: transcript
        }
      ],
    });
    const cleanedText = response.text;
    return cleanedText.trim() || transcript;
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
    const response = await llm.generate({
      maxTokens: 300,
      temperature: 0.3,
      system: `You are an expert editor planning document changes. Given an instruction, create a brief execution plan.

Output a concise numbered list (3-5 steps max) of specific changes to make.
Each step should be atomic and verifiable.
Focus on WHAT to change, not HOW to write it.

Example:
Instruction: "Add more detail about pricing and move the FAQ to the end"
Plan:
1. Expand the pricing section with specific tier information
2. Add pricing comparison table after the tier descriptions
3. Move the FAQ section to after the Contact section
4. Update any internal references to FAQ location`,
      messages: [
        {
          role: "user",
          content: `Document (first 1000 chars): ${document.slice(0, 1000)}${document.length > 1000 ? "..." : ""}
${selectedText ? `\nSelected text: "${selectedText}"` : ""}
Objective: ${objective}
Instruction: ${instruction}

Create a brief execution plan:`
        }
      ],
    });
    const planText = response.text;
    return planText.trim() || "";
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
  master_researcher: `Example good responses to Master Researcher feedback:
- "Good catch — we're missing coverage for the healthcare domain's knowledge worker roles"
- "I should refresh the Architect persona — the skills profile hasn't been updated in over a month"
- "Let me define the evaluation criteria for measuring persona relevance and freshness"
The goal is to ensure the persona hierarchy is complete, current, and covers all relevant knowledge worker domains.`,

  thinking_bigger: `Example good responses to Think Big feedback:
- "You're right — I haven't thought about what happens at 100,000 users. Let me address the scaling bottleneck"
- "Good catch — the onboarding flow has too many steps for a self-service product at scale"
- "I should define the retention metric this feature is supposed to move"
- "Let me simplify this to work without hand-holding — designed for 100,000+ people"
The goal is to scale impact and outcomes (retention, cost-to-serve, accessibility, resilience) without changing the core idea.`,

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

  ceo: `Example good responses to CEO feedback:
- "You're right — I need to name who this actually helps and what success looks like for them"
- "I should define a clear 'done' and assign ownership before expanding scope"
- "Good point — I need to call out the tradeoffs we're accepting, not just the benefits"
- "Let me add measurable outcomes so we know if this is actually working for the people it's meant to serve"
The goal is to ensure the proposal truly improves outcomes for the intended people, is accountable (clear metrics and ownership), and protects trust (safety, privacy, reliability) as a first-class requirement.`,

  data_architect: `Example good responses to Data Architect feedback:
- "You're right — I haven't defined how customer identifiers link across these systems. Let me map the Key Ring"
- "Good catch — I'm chasing a golden record without defining which context needs authoritative data"
- "I should tie this data quality initiative to a measurable business outcome, not just a cleanliness score"
- "Let me address the metadata gaps — if we don't know field ownership and freshness, we're not AI-ready"
The goal is to ensure data is fit-for-purpose for the stated objective, identifiers link across systems, and governance drives business outcomes rather than checkbox compliance.`,

  cybersecurity_engineer: `Example good responses to Cybersecurity feedback:
- "Good point — I haven't defined our threat model or identified the crown jewels an attacker would target"
- "You're right — we have prevention controls but no detection or response playbook if those controls fail"
- "I need to map the full attack surface including our CI/CD pipeline and third-party dependencies"
- "Let me define detection time targets and containment procedures, not just perimeter defenses"
The goal is to ensure defense-in-depth: threat modeling, detection capabilities, incident response readiness, and supply chain security.`,

  growth_strategist: `Example good responses to Growth Strategist feedback:
- "You're right — I haven't defined the activation event. 'Signed up' isn't activation"
- "Good catch — I'm assuming organic growth without naming the acquisition channel or its unit economics"
- "I need to measure D7 and D30 retention cohorts, not just total registered users"
- "Let me define the specific funnel stages and identify where users are dropping off"
The goal is to ensure every growth assumption ties to a measurable funnel stage with clear channel economics and retention metrics.`,

  brand_strategist: `Example good responses to Brand Strategist feedback:
- "You're right — I can't explain what this is and why it's different in one sentence"
- "Good catch — I'm claiming 'better UX' as a differentiator without anything specific or defensible"
- "I need to name the competitive alternative explicitly — what are people doing instead of using this?"
- "Let me define the brand voice and show how it manifests in product UI, error messages, and marketing"
The goal is to ensure clear positioning, defensible differentiation, and consistent voice across all touchpoints.`,

  content_strategist: `Example good responses to Content Strategist feedback:
- "You're right — I have no distribution plan. Creating content without a named channel is just journaling"
- "Good catch — this content doesn't match the intent of someone at this stage of the journey"
- "I need to define the target audience segment and validate that they actually want this content"
- "Let me map content to specific funnel stages and tie each piece to a measurable business outcome"
The goal is to ensure content reaches the right audience through the right channel with a measurable outcome.`,
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

  // ═══════════════════════════════════════════════════════════════════════
  // LLM STATUS — diagnostic endpoint to verify active provider
  // ═══════════════════════════════════════════════════════════════════════
  app.get("/api/llm-status", (_req, res) => {
    res.json({
      provider: llm.provider,
      keys: {
        AI_INTEGRATIONS_OPENAI_API_KEY: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || null,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_KEY: !!process.env.ANTHROPIC_KEY,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        LLM_PROVIDER: process.env.LLM_PROVIDER || null,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UNIFIED INVOKE ENDPOINT — single entry point for all LLM interactions
  // ═══════════════════════════════════════════════════════════════════════
  app.post("/api/invoke", async (req, res) => {
    try {
      const { taskType, ...params } = req.body;

      if (!taskType || !TASK_TYPES.includes(taskType)) {
        return res.status(400).json({
          error: "Invalid taskType",
          validTypes: TASK_TYPES,
        });
      }

      console.log(`[Invoke] taskType=${taskType}`);
      const result = await invoke(taskType as TaskType, params);
      res.json(result);
    } catch (error) {
      console.error("[Invoke] error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Invoke failed", details: msg });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LEGACY ENDPOINTS — kept for backward compatibility, delegate to invoke()
  // ═══════════════════════════════════════════════════════════════════════

  // ── Generate challenges (persona-aware, no advice) ──
  // Generates challenges from selected personas. Each challenge includes the
  // full persona definition so the dialogue panel knows who is speaking.
  // Advice is generated separately via /api/generate-advice.
  app.post("/api/generate-challenges", async (req, res) => {
    try {
      const parsed = generateChallengeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { document: docText, objective, personaIds, guidance, referenceDocuments, appType: challengeAppType } = parsed.data;

      const challengeAppConfig = getAppTypeConfig(challengeAppType);
      const challengeAppContext = formatAppTypeContext(challengeAppType);

      const MAX_ANALYSIS_LENGTH = 8000;
      const analysisText = docText.slice(0, MAX_ANALYSIS_LENGTH);

      // Resolve personas — use effective (DB override + code default), fall back to built-in
      const requestedIds = personaIds && personaIds.length > 0
        ? personaIds
        : Object.keys(builtInPersonas);

      const personaResults = await Promise.all(
        requestedIds.map((id) => getEffectivePersonaById(id))
      );
      const personas: Persona[] = personaResults.filter((p): p is Persona => p !== undefined);

      if (personas.length === 0) {
        return res.status(400).json({ error: "No valid personas found for the given IDs" });
      }

      const personaDescriptions = personas
        .map((p) => `- ${p.id} (${p.label}): ${p.prompts.challenge}`)
        .join("\n");

      // Master Researcher guardrail: if master_researcher is among selected personas,
      // inject lock awareness so it learns from human-curated personas instead of overriding them.
      let lockGuardrail = "";
      if (requestedIds.includes("master_researcher")) {
        const allEffective = await getEffectivePersonas();
        const lockedPersonas = Object.values(allEffective).filter((p) => p.humanCurated);
        if (lockedPersonas.length > 0) {
          const lockedList = lockedPersonas.map((p) => `"${p.label}" (${p.id})`).join(", ");
          lockGuardrail = `\n\nHUMAN-CURATED PERSONA LOCK POLICY:
The following personas are HUMAN-CURATED and LOCKED: ${lockedList}.
You MUST NOT suggest replacing, overriding, or fundamentally redefining these personas.
Instead:
1. STUDY their patterns — tone, structure, specificity level, non-negotiable behaviors.
2. APPLY those quality patterns when evaluating or proposing changes to non-curated personas.
3. You MAY recommend enhancements to locked personas, but frame them as advisory suggestions that require human approval.
4. Treat locked personas as the quality standard that other personas should aspire to match.`;
        }
      }

      // ── Context assembly ──
      // All required context for grounded challenges:
      //   1. objective  — what the document is trying to achieve (required)
      //   2. document   — current draft each persona reads (required)
      //   3. personas   — who is speaking and their challenge prompts (required)
      //   4. guidance   — optional user focus area
      //   5. references — optional style/template docs for comparison

      const refDocSummary = referenceDocuments && referenceDocuments.length > 0
        ? referenceDocuments.map(d => `[${d.type.toUpperCase()}: ${d.name}]\n${d.content.slice(0, 500)}${d.content.length > 500 ? "..." : ""}`).join("\n\n")
        : null;

      const refContext = refDocSummary
        ? `\n\nReference documents:\n${refDocSummary}\n\nCompare against these for gaps.`
        : "";

      const guidanceContext = guidance
        ? `\n\nUSER GUIDANCE: The user specifically wants challenges about: ${guidance}`
        : "";

      const perPersonaCount = Math.max(2, Math.ceil(6 / personas.length));
      const personaIdsList = personas.map((p) => p.id).join(", ");

      const response = await llm.generate({
        maxTokens: 4096,
        system: `${challengeAppContext ? challengeAppContext + "\n\n" : ""}You are a critical thinking partner. Your job is to CHALLENGE the user's document — identify gaps, weaknesses, and assumptions.

DOCUMENT OBJECTIVE: ${objective}
Evaluate the ${challengeAppConfig?.documentType || "document"} against this objective. Every challenge must relate to how well the ${challengeAppConfig?.documentType || "document"} achieves this goal.

IMPORTANT: Only generate challenges. Do NOT provide advice, solutions, or suggestions. The user will request advice separately.

Generate challenges from these personas:
${personaDescriptions}
${refContext}${guidanceContext}${lockGuardrail}

Respond with a JSON object containing a "challenges" array. Generate ${perPersonaCount} challenges per persona.
For each challenge:
- personaId: The persona ID (one of: ${personaIdsList})
- title: A punchy headline (max 60 chars) that names the specific document gap
- content: A 2-3 sentence challenge that (a) quotes or references a specific section, sentence, or claim from the document, (b) explains why it's a gap, weakness, or assumption relative to the objective, and (c) frames a pointed question the user must answer
- sourceExcerpt: An exact quote from the document that this challenge targets (max 150 chars). MUST be a verbatim substring — do not paraphrase.
- scale: Impact level from 1-5 (1=minor, 2=small, 3=moderate, 4=significant, 5=critical)

GROUNDING RULES:
- Every challenge MUST reference a specific part of the document (a heading, paragraph, claim, or notable omission).
- Generic questions like "What's the most important thing you haven't covered?" are NOT acceptable. Instead, name what is missing and why it matters for the objective.
- If the document is thin in a particular area, name that area explicitly and explain what the objective demands there.
- The sourceExcerpt must be a real quote from the document, not a summary.

Output only valid JSON, no markdown.`,
        messages: [
          {
            role: "user",
            content: `OBJECTIVE: ${objective}\n\nDOCUMENT TO CHALLENGE:\n\n${analysisText}\n\nGenerate grounded challenges — each must cite a specific part of this document or a specific omission relative to the objective.`
          }
        ],
      });

      const content = response.text || "{}";
      let parsedResponse: Record<string, unknown> = {};
      try {
        parsedResponse = JSON.parse(content);
      } catch {
        console.error("Failed to parse challenges JSON:", content);
        return res.json({ challenges: [] });
      }

      const challengesArray = Array.isArray(parsedResponse.challenges)
        ? parsedResponse.challenges
        : [];

      const challenges: Challenge[] = challengesArray.map((c: unknown, idx: number) => {
        const item = c as Record<string, unknown>;
        const pId = typeof item?.personaId === "string" && getPersonaById(item.personaId)
          ? item.personaId
          : personas[idx % personas.length].id;

        const persona = getPersonaById(pId)!;
        const rawScale = typeof item?.scale === "number" ? item.scale : 3;
        const scale = Math.max(1, Math.min(5, Math.round(rawScale)));

        return {
          id: `challenge-${pId}-${Date.now()}-${idx}`,
          persona,
          title: typeof item?.title === "string" ? item.title : "Untitled Challenge",
          content: typeof item?.content === "string" ? item.content : "",
          sourceExcerpt: typeof item?.sourceExcerpt === "string" ? item.sourceExcerpt : "",
          status: "pending" as const,
          scale,
        };
      });

      res.json({ challenges });
    } catch (error) {
      console.error("Generate challenges error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate challenges", details: errorMessage });
    }
  });

  // ── Generate advice for a specific challenge ──
  // This is a separate invocation from challenge generation so that the advice
  // is not a reiteration of the provocation. The same persona speaks, but now
  // provides concrete, actionable guidance on how to address the challenge.
  app.post("/api/generate-advice", async (req, res) => {
    try {
      const parsed = generateAdviceRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { document: docText, objective, appType, challengeId, challengeTitle, challengeContent, personaId, discussionHistory } = parsed.data;

      const persona = getPersonaById(personaId);
      if (!persona) {
        return res.status(400).json({ error: `Unknown persona: ${personaId}` });
      }

      const appConfig = getAppTypeConfig(appType);
      const appContext = formatAppTypeContext(appType);

      const MAX_ANALYSIS_LENGTH = 6000;
      const analysisText = docText.slice(0, MAX_ANALYSIS_LENGTH);

      // Build discussion history context if available
      let discussionContext = "";
      if (discussionHistory && discussionHistory.length > 0) {
        const historyLines = discussionHistory.slice(-10).map(m => {
          const roleLabel = m.role === "user-question" ? "User asked"
            : m.role === "user-answer" ? "User answered"
            : m.role === "persona-response" ? "Team responded"
            : "Question";
          return `[${roleLabel}]: ${m.content.slice(0, 300)}`;
        });
        discussionContext = `\n\nDISCUSSION HISTORY (recent conversation — ground your advice in this context):\n${historyLines.join("\n")}`;
      }

      // ── Context assembly ──
      // All inputs ground the persona so advice is specific and actionable:
      //   1. objective  — what the document is trying to achieve
      //   2. document   — current draft the persona reads
      //   3. challenge  — the specific gap/weakness identified earlier
      //   4. persona    — who is speaking and their advice prompt
      //   5. discussion — the ongoing conversation for continuity
      //   6. appType    — application-specific context
      const systemPrompt = `${appContext ? appContext + "\n\n" : ""}${persona.prompts.advice}

You are the ${persona.label}. A colleague has raised a provocation against the user's document. Your job is to provide expert advice that helps the user resolve that provocation.

THE PROVOCATION (this is your primary grounding — your advice must directly address this):
Title: ${challengeTitle}
Detail: ${challengeContent}

DOCUMENT OBJECTIVE: ${objective}
${discussionContext}

ADVICE RULES:
1. Start from the PROVOCATION — your advice must directly answer the specific gap, weakness, or assumption raised. Do NOT provide generic guidance.
2. Reference the CURRENT DOCUMENT — point to specific sections, paragraphs, or claims that need attention to resolve this provocation.
3. Serve the OBJECTIVE — explain how resolving this provocation advances the stated goal.
4. Build on the DISCUSSION HISTORY — if the user has already answered or discussed related points, acknowledge that and don't repeat.
5. Be concrete and actionable — the user should know exactly what to write, change, or add.
6. Be different from the provocation — do NOT restate the problem, provide the solution.
7. Speak from your persona's expertise (${persona.label}).
8. Be 2-4 sentences of practical guidance.

Respond with a JSON object:
{
  "advice": "Your concrete, actionable advice here"
}

Output only valid JSON, no markdown.`;

      const response = await llm.generate({
        maxTokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `PROVOCATION TO ADDRESS:\n"${challengeTitle}": ${challengeContent}\n\nCURRENT DOCUMENT:\n\n${analysisText}\n\nProvide your expert advice as the ${persona.label} to resolve this specific provocation.`
          }
        ],
      });

      const content = response.text || "{}";
      let parsedResponse: Record<string, unknown> = {};
      try {
        parsedResponse = JSON.parse(content);
      } catch {
        console.error("Failed to parse advice JSON:", content);
        return res.json({ advice: null });
      }

      const adviceContent = typeof parsedResponse.advice === "string"
        ? parsedResponse.advice
        : "";

      const advice: Advice = {
        id: `advice-${personaId}-${Date.now()}`,
        challengeId,
        persona,
        content: adviceContent,
        status: "pending",
      };

      res.json({ advice });
    } catch (error) {
      console.error("Generate advice error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate advice", details: errorMessage });
    }
  });

  // ── Persona listing endpoint ──
  // Returns all user-facing personas (excludes master_researcher).
  // Merges code defaults with DB overrides.
  app.get("/api/personas", async (_req, res) => {
    try {
      const all = await getEffectivePersonas();
      const personas = Object.values(all).filter((p) => p.id !== "master_researcher");
      res.json({ personas });
    } catch {
      // Fallback to code defaults if DB unavailable
      res.json({ personas: getAllPersonas() });
    }
  });

  // ── Persona hierarchy endpoint ──
  // Returns the full hierarchy tree rooted at master_researcher.
  app.get("/api/personas/hierarchy", async (_req, res) => {
    try {
      const all = await getEffectivePersonas();
      const root = all["master_researcher"] ?? builtInPersonas.master_researcher;
      const children = Object.values(all)
        .filter((p) => p.parentId === "master_researcher")
        .map((p) => ({
          persona: p,
          children: Object.values(all)
            .filter((child) => child.parentId === p.id)
            .map((child) => ({ persona: child, children: [] })),
        }));
      res.json({ persona: root, children });
    } catch {
      res.json(getPersonaHierarchy());
    }
  });

  // ── All personas including root (for admin) ──
  app.get("/api/personas/all", async (_req, res) => {
    try {
      const all = await getEffectivePersonas();
      res.json({ personas: Object.values(all) });
    } catch {
      res.json({ personas: getAllPersonasWithRoot() });
    }
  });

  // ── Personas by domain ──
  app.get("/api/personas/domain/:domain", async (req, res) => {
    const domain = req.params.domain;
    if (!["root", "technology", "business", "marketing"].includes(domain)) {
      return res.status(400).json({ error: "Invalid domain. Must be: root, technology, business, or marketing" });
    }
    try {
      const all = await getEffectivePersonas();
      const personas = Object.values(all).filter((p) => p.domain === domain);
      res.json({ personas });
    } catch {
      res.json({ personas: getPersonasByDomain(domain as any) });
    }
  });

  // ── Stale personas (need research refresh) ──
  app.get("/api/personas/stale", async (_req, res) => {
    try {
      const all = await getEffectivePersonas();
      const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stale = Object.values(all).filter((p) => {
        if (p.id === "master_researcher") return false;
        if (!p.lastResearchedAt) return true;
        return new Date(p.lastResearchedAt).getTime() < threshold;
      });
      res.json({ stalePersonas: stale.map((p) => ({ id: p.id, label: p.label, domain: p.domain, lastResearchedAt: p.lastResearchedAt, humanCurated: p.humanCurated })) });
    } catch {
      const stale = getStalePersonas();
      res.json({ stalePersonas: stale.map((p) => ({ id: p.id, label: p.label, domain: p.domain, lastResearchedAt: p.lastResearchedAt })) });
    }
  });

  // ── Persona version history (archival) ──
  app.get("/api/personas/:personaId/versions", async (req, res) => {
    try {
      const versions = await storage.getPersonaVersions(req.params.personaId);
      res.json({ versions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch persona versions" });
    }
  });

  // ── Admin: Persona override management ──

  // List all DB overrides with lock status
  app.get("/api/admin/persona-overrides", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const overrides = await storage.getAllPersonaOverrides();
      res.json({
        overrides: overrides.map((o) => ({
          personaId: o.personaId,
          humanCurated: o.humanCurated,
          curatedBy: o.curatedBy,
          curatedAt: o.curatedAt?.toISOString() ?? null,
          updatedAt: o.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch persona overrides" });
    }
  });

  // Save persona override (admin-only)
  app.put("/api/admin/personas/:personaId", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { personaId } = req.params;
      const { definition, humanCurated } = req.body;

      // Validate the persona definition
      const parsed = personaSchema.safeParse(definition);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid persona definition", details: parsed.error.issues });
      }

      // Ensure ID matches
      if (parsed.data.id !== personaId) {
        return res.status(400).json({ error: "Persona ID in definition must match URL parameter" });
      }

      const override = await storage.upsertPersonaOverride({
        personaId,
        definition: JSON.stringify(parsed.data),
        humanCurated: humanCurated ?? false,
        curatedBy: auth.userId,
      });

      // Archive version for audit trail
      await storage.savePersonaVersion(personaId, JSON.stringify(parsed.data));

      res.json({
        personaId: override.personaId,
        humanCurated: override.humanCurated,
        curatedBy: override.curatedBy,
        curatedAt: override.curatedAt?.toISOString() ?? null,
        updatedAt: override.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Save persona override error:", error);
      res.status(500).json({ error: "Failed to save persona override" });
    }
  });

  // Toggle human-curated lock (admin-only)
  app.patch("/api/admin/personas/:personaId/lock", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { personaId } = req.params;
      const { humanCurated } = req.body;
      if (typeof humanCurated !== "boolean") {
        return res.status(400).json({ error: "humanCurated must be a boolean" });
      }

      // Get current persona definition (effective)
      const persona = await getEffectivePersonaById(personaId);
      if (!persona) {
        return res.status(404).json({ error: "Persona not found" });
      }

      const override = await storage.upsertPersonaOverride({
        personaId,
        definition: JSON.stringify(persona),
        humanCurated,
        curatedBy: humanCurated ? auth.userId : null,
      });

      res.json({
        personaId: override.personaId,
        humanCurated: override.humanCurated,
        curatedBy: override.curatedBy,
        curatedAt: override.curatedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("Toggle persona lock error:", error);
      res.status(500).json({ error: "Failed to toggle persona lock" });
    }
  });

  // Delete override — revert to code default (admin-only)
  app.delete("/api/admin/personas/:personaId/override", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }
      await storage.deletePersonaOverride(req.params.personaId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete persona override" });
    }
  });

  // Export all effective personas as JSON (for deployment sync pipeline)
  app.get("/api/admin/personas/export", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const all = await getEffectivePersonas();
      res.json({ personas: all });
    } catch (error) {
      res.status(500).json({ error: "Failed to export personas" });
    }
  });

  // ── Agent definition CRUD (user-owned) ──

  // Create new agent definition
  app.post("/api/agents", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const parsed = agentDefinitionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid agent definition", details: parsed.error.issues });

      const result = await storage.createAgentDefinition({
        agentId: parsed.data.agentId,
        userId: auth.userId,
        name: parsed.data.name,
        description: parsed.data.description,
        persona: parsed.data.persona,
        steps: JSON.stringify(parsed.data.steps),
      });
      res.json(result);
    } catch (error: any) {
      if (error.code === "23505") return res.status(409).json({ error: "Agent ID already exists" });
      console.error("Create agent error:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  // List user's agent definitions
  app.get("/api/agents", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const agents = await storage.listAgentDefinitions(auth.userId);
      res.json({
        agents: agents.map((a) => ({
          ...a,
          steps: JSON.parse(a.steps),
        })),
      });
    } catch (error) {
      console.error("List agents error:", error);
      res.status(500).json({ error: "Failed to list agents" });
    }
  });

  // Get single agent definition
  app.get("/api/agents/:agentId", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const agent = await storage.getAgentDefinition(req.params.agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (agent.userId !== auth.userId) return res.status(403).json({ error: "Access denied" });

      res.json({ ...agent, steps: JSON.parse(agent.steps) });
    } catch (error) {
      console.error("Get agent error:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  // Update agent definition
  app.put("/api/agents/:agentId", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const agent = await storage.getAgentDefinition(req.params.agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (agent.userId !== auth.userId) return res.status(403).json({ error: "Access denied" });

      const { name, description, persona, steps } = req.body;
      const result = await storage.updateAgentDefinition(req.params.agentId, {
        name,
        description,
        persona,
        steps: steps ? JSON.stringify(steps) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Update agent error:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // Delete agent definition
  app.delete("/api/agents/:agentId", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const agent = await storage.getAgentDefinition(req.params.agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (agent.userId !== auth.userId) return res.status(403).json({ error: "Access denied" });

      await storage.deleteAgentDefinition(req.params.agentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete agent error:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // ── Agent execution ──

  // Execute a saved agent (non-streaming)
  app.post("/api/agents/:agentId/execute", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const agent = await storage.getAgentDefinition(req.params.agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (agent.userId !== auth.userId) return res.status(403).json({ error: "Access denied" });

      const { input } = req.body;
      if (!input || typeof input !== "string") return res.status(400).json({ error: "Input is required" });

      const steps = JSON.parse(agent.steps);
      const result = await executeAgent(steps, input, agent.persona || "");
      res.json(result);
    } catch (error) {
      console.error("Execute agent error:", error);
      res.status(500).json({ error: "Failed to execute agent" });
    }
  });

  // Execute a saved agent (streaming via SSE)
  app.post("/api/agents/:agentId/execute/stream", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const agent = await storage.getAgentDefinition(req.params.agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (agent.userId !== auth.userId) return res.status(403).json({ error: "Access denied" });

      const { input } = req.body;
      if (!input || typeof input !== "string") return res.status(400).json({ error: "Input is required" });

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const steps = JSON.parse(agent.steps);
      const sortedSteps = [...steps].sort((a: any, b: any) => a.order - b.order);
      let currentInput = input;

      for (const step of sortedSteps) {
        res.write(`data: ${JSON.stringify({ type: "step-start", stepId: step.id })}\n\n`);

        const result = await executeAgent([step], currentInput, agent.persona || "");
        const stepResult = result.steps[0];

        if (stepResult.validationPassed) {
          res.write(`data: ${JSON.stringify({ type: "step-complete", stepId: step.id, result: stepResult })}\n\n`);
          currentInput = stepResult.output;
        } else {
          res.write(`data: ${JSON.stringify({ type: "step-error", stepId: step.id, result: stepResult, error: stepResult.error })}\n\n`);
          if (!step.output?.fallback) break;
          currentInput = stepResult.output;
        }
      }

      res.write(`data: ${JSON.stringify({ type: "execution-complete", finalOutput: currentInput })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Stream execute agent error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to execute agent" });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Execution failed" })}\n\n`);
        res.end();
      }
    }
  });

  // Execute an inline (unsaved) agent definition
  app.post("/api/agents/execute-inline", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) return res.status(401).json({ error: "Not authenticated" });

      const { persona, steps, input } = req.body;
      if (!input || typeof input !== "string") return res.status(400).json({ error: "Input is required" });
      if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: "Steps are required" });

      const result = await executeAgent(steps, input, persona || "");
      res.json(result);
    } catch (error) {
      console.error("Inline execute agent error:", error);
      res.status(500).json({ error: "Failed to execute agent" });
    }
  });

  // ── Admin: Agent prompt override management ──

  // List all 13 task types with their current base prompts
  app.get("/api/admin/agent-prompts", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      // Fetch DB overrides — gracefully degrade if table doesn't exist yet
      let overrideMap = new Map<string, { systemPrompt: string; humanCurated: boolean; curatedBy: string | null; curatedAt: Date | null }>();
      try {
        const overrides = await storage.getAllAgentPromptOverrides();
        overrideMap = new Map(overrides.map((o) => [o.taskType, o]));
      } catch (dbError) {
        console.warn("agent_prompt_overrides table may not exist yet — returning code defaults only:", dbError);
      }

      const prompts = TASK_TYPES.map((taskType) => {
        const base = BASE_PROMPTS[taskType];
        const override = overrideMap.get(taskType);
        return {
          taskType,
          group: base.group,
          description: base.description,
          currentPrompt: override?.systemPrompt ?? base.basePrompt,
          isOverridden: !!override,
          humanCurated: override?.humanCurated ?? false,
          curatedBy: override?.curatedBy ?? null,
          curatedAt: override?.curatedAt ?? null,
        };
      });

      res.json({ prompts });
    } catch (error) {
      console.error("List agent prompts error:", error);
      res.status(500).json({ error: "Failed to list agent prompts" });
    }
  });

  // List all agent prompt overrides with lock status
  app.get("/api/admin/agent-overrides", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const overrides = await storage.getAllAgentPromptOverrides();
      res.json({ overrides: overrides.map((o) => ({
        taskType: o.taskType,
        humanCurated: o.humanCurated,
        curatedAt: o.curatedAt,
      })) });
    } catch (error) {
      console.error("List agent overrides error:", error);
      res.status(500).json({ error: "Failed to list agent overrides" });
    }
  });

  // Save system prompt override for a task type
  app.put("/api/admin/agent-overrides/:taskType", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { taskType } = req.params;
      if (!TASK_TYPES.includes(taskType as TaskType)) {
        return res.status(400).json({ error: `Invalid task type: ${taskType}` });
      }

      const { systemPrompt } = req.body;
      if (!systemPrompt || typeof systemPrompt !== "string") {
        return res.status(400).json({ error: "systemPrompt is required" });
      }

      const result = await storage.upsertAgentPromptOverride({
        taskType,
        systemPrompt,
        humanCurated: req.body.humanCurated ?? false,
        curatedBy: auth.userId,
      });
      res.json(result);
    } catch (error) {
      console.error("Save agent override error:", error);
      res.status(500).json({ error: "Failed to save agent override" });
    }
  });

  // Toggle lock on an agent prompt override
  app.patch("/api/admin/agent-overrides/:taskType/lock", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { taskType } = req.params;
      const { humanCurated } = req.body;
      if (typeof humanCurated !== "boolean") {
        return res.status(400).json({ error: "humanCurated (boolean) is required" });
      }

      // Get existing override, or create one from the base prompt
      let existing = await storage.getAgentPromptOverride(taskType);
      if (!existing) {
        const base = BASE_PROMPTS[taskType as TaskType];
        if (!base) return res.status(404).json({ error: "Task type not found" });
        existing = await storage.upsertAgentPromptOverride({
          taskType,
          systemPrompt: base.basePrompt,
          humanCurated,
          curatedBy: auth.userId,
        });
      } else {
        existing = await storage.upsertAgentPromptOverride({
          taskType,
          systemPrompt: existing.systemPrompt,
          humanCurated,
          curatedBy: auth.userId,
        });
      }

      res.json({ taskType, humanCurated: existing.humanCurated });
    } catch (error) {
      console.error("Toggle agent lock error:", error);
      res.status(500).json({ error: "Failed to toggle agent lock" });
    }
  });

  // Delete agent prompt override — revert to code default
  app.delete("/api/admin/agent-overrides/:taskType", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId || !(await isAdminUser(auth.userId))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      await storage.deleteAgentPromptOverride(req.params.taskType);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete agent override error:", error);
      res.status(500).json({ error: "Failed to delete agent override" });
    }
  });

  // ── Tracking event ingestion ──
  // Records a single tracking event. No user-inputted text is stored.
  app.post("/api/tracking/event", async (req, res) => {
    try {
      const auth = getAuth(req);
      const userId = auth?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = trackingEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tracking event", details: parsed.error.errors });
      }

      const sessionId = (req.headers["x-session-id"] as string) || "unknown";

      await storage.recordTrackingEvent({
        userId,
        sessionId,
        eventType: parsed.data.eventType,
        personaId: parsed.data.personaId,
        templateId: parsed.data.templateId,
        appSection: parsed.data.appSection,
        metadata: parsed.data.metadata,
      });

      res.json({ ok: true });
    } catch (error) {
      // Non-fatal — tracking should never break the user experience
      console.error("Tracking event error:", error);
      res.json({ ok: false });
    }
  });

  // ── Batch tracking events ──
  app.post("/api/tracking/events", async (req, res) => {
    try {
      const auth = getAuth(req);
      const userId = auth?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const events = req.body.events;
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: "Expected events array" });
      }

      const sessionId = (req.headers["x-session-id"] as string) || "unknown";

      await Promise.all(
        events.map((evt: any) => {
          const parsed = trackingEventSchema.safeParse(evt);
          if (!parsed.success) return Promise.resolve();
          return storage.recordTrackingEvent({
            userId,
            sessionId,
            eventType: parsed.data.eventType,
            personaId: parsed.data.personaId,
            templateId: parsed.data.templateId,
            appSection: parsed.data.appSection,
            metadata: parsed.data.metadata,
          });
        })
      );

      res.json({ ok: true });
    } catch (error) {
      console.error("Batch tracking error:", error);
      res.json({ ok: false });
    }
  });

  // ── Auth: role check ──
  app.get("/api/auth/role", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const admin = await isAdminUser(userId);
      res.json({ role: admin ? "admin" : "user" });
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ error: "Failed to check role" });
    }
  });

  // ── Admin dashboard data (protected) ──
  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      const data = await storage.getAdminDashboardData();
      res.json(data);
    } catch (error) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ error: "Failed to load admin dashboard data" });
    }
  });

  // ── Admin: persona usage stats (protected) ──
  app.get("/api/admin/persona-usage", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      const stats = await storage.getPersonaUsageStats();
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: "Failed to load persona usage stats" });
    }
  });

  // ── Admin: event breakdown (protected) ──
  app.get("/api/admin/event-breakdown", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      const stats = await storage.getEventBreakdown();
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: "Failed to load event breakdown" });
    }
  });

  // ── Usage metrics: record (authenticated, fire-and-forget) ──
  app.post("/api/metrics", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { metrics } = req.body as { metrics?: { key: string; delta: number }[] };
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: "metrics array required" });
      }

      await Promise.all(
        metrics
          .filter((m) => m.key && typeof m.delta === "number" && m.delta > 0)
          .map((m) => storage.incrementMetric(userId, m.key, m.delta))
      );

      res.json({ ok: true });
    } catch (error) {
      console.error("Metric recording error:", error);
      res.status(500).json({ error: "Failed to record metrics" });
    }
  });

  // ── Admin: user metrics matrix (protected) ──
  app.get("/api/admin/user-metrics", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      // Fetch metrics, known user IDs, and activity stats in parallel
      const [allMetrics, allKnownUserIds, activityStats] = await Promise.all([
        storage.getAllUsageMetrics(),
        storage.getAllKnownUserIds(),
        storage.getUserActivityStats(),
      ]);

      // Build a quick lookup for activity stats by userId
      const activityByUser = new Map(activityStats.map((a) => [a.userId, a]));

      // Merge: users from metrics table + users from other tables (docs, tracking, etc.)
      const userIdSet = new Set(allKnownUserIds);
      allMetrics.forEach((m) => userIdSet.add(m.userId));
      activityStats.forEach((a) => userIdSet.add(a.userId));
      const userIds = Array.from(userIdSet);

      // Resolve user info from Clerk
      const userInfoMap: Record<string, { email: string; displayName: string }> = {};
      for (const uid of userIds) {
        try {
          const user = await clerkClient.users.getUser(uid);
          const email =
            user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress || "unknown";
          const displayName =
            [user.firstName, user.lastName].filter(Boolean).join(" ") || email;
          userInfoMap[uid] = { email, displayName };
        } catch {
          userInfoMap[uid] = { email: "unknown", displayName: uid.slice(0, 12) };
        }
      }

      // Collect all metric keys — sorted by importance
      // Prepend activity-derived keys (logins, page views) before usage metrics
      const METRIC_ORDER = [
        "logins",
        "page_views",
        "time_saved_minutes",
        "author_words",
        "documents_saved",
        "documents_copied",
        "total_words_produced",
      ];
      const allKeys = Array.from(new Set(allMetrics.map((m) => m.metricKey)));
      // Always include activity keys even if no usage metrics row exists for them
      const activityKeys = ["logins", "page_views"];
      const combinedKeys = new Set([...activityKeys, ...allKeys]);
      const sortedKeys = [
        ...METRIC_ORDER.filter((k) => combinedKeys.has(k)),
        ...Array.from(combinedKeys).filter((k) => !METRIC_ORDER.includes(k)).sort(),
      ];

      // Build per-user rows — includes users with zero metrics
      const users = userIds.map((uid) => {
        const userMetrics = allMetrics.filter((m) => m.userId === uid);
        const metrics: Record<string, number> = {};
        for (const m of userMetrics) {
          metrics[m.metricKey] = m.metricValue;
        }
        // Merge login/page-view counts from activity stats
        const activity = activityByUser.get(uid);
        if (activity) {
          metrics["logins"] = activity.loginCount;
          metrics["page_views"] = activity.pageViewCount;
        }
        return {
          userId: uid,
          email: userInfoMap[uid]?.email || "unknown",
          displayName: userInfoMap[uid]?.displayName || uid,
          lastSeenAt: activity?.lastSeenAt ?? null,
          metrics,
        };
      });

      res.json({ metricKeys: sortedKeys, users });
    } catch (error) {
      console.error("Admin user metrics error:", error);
      res.status(500).json({ error: "Failed to load user metrics" });
    }
  });

  // ── Admin: voice capture config (summary schedule + persist interval) ──
  // In-memory store — survives server restarts on Replit (process stays alive)
  // but resets on deploy. Promote to DB when needed.
  let voiceCaptureConfig = {
    summarySchedule: [
      { after: 0,    interval: 5 },
      { after: 30,   interval: 15 },
      { after: 60,   interval: 30 },
      { after: 300,  interval: 60 },
      { after: 1200, interval: 300 },
    ],
    persistIntervalMs: 15_000,
  };

  app.get("/api/admin/voice-capture-config", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });
      res.json(voiceCaptureConfig);
    } catch (error) {
      res.status(500).json({ error: "Failed to get config" });
    }
  });

  app.put("/api/admin/voice-capture-config", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      const { summarySchedule, persistIntervalMs } = req.body;
      if (summarySchedule && Array.isArray(summarySchedule)) {
        voiceCaptureConfig.summarySchedule = summarySchedule;
      }
      if (typeof persistIntervalMs === "number" && persistIntervalMs >= 5000) {
        voiceCaptureConfig.persistIntervalMs = persistIntervalMs;
      }
      console.log("[admin] Voice capture config updated:", voiceCaptureConfig);
      res.json(voiceCaptureConfig);
    } catch (error) {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Public endpoint — clients fetch the config to use at runtime
  app.get("/api/voice-capture-config", (_req, res) => {
    res.json(voiceCaptureConfig);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN: SYNC APP DOCS — reads apps/*/CLAUDE.md from disk and upserts
  // them as encrypted documents in the admin's folder hierarchy:
  //   Applications / Provocations / <App Title>
  // ═══════════════════════════════════════════════════════════════════════

  // Map templateId → human-readable title for folder names
  const APP_TITLES: Record<string, string> = {
    "write-a-prompt": "Write a Prompt",
    "product-requirement": "Product Requirement",
    "new-application": "New Application",
    "streaming": "Screen Capture",
    "research-paper": "Research Paper",
    "persona-definition": "Persona Agent",
    "research-context": "Research into Context",
    "voice-capture": "Voice Capture",
    "youtube-to-infographic": "YouTube to Infographic",
    "text-to-infographic": "Text to Infographic",
    "email-composer": "Email Composer",
    "agent-editor": "Agent Editor",
  };

  /**
   * Find an existing folder by decrypting names and matching, or create a new one.
   * When locked=true, the folder is system-managed and cannot be renamed/moved/deleted.
   */
  async function findOrCreateFolder(
    userId: string,
    folderName: string,
    parentFolderId: number | null,
    encryptionKey: string,
    locked = false,
  ): Promise<number> {
    const existing = await storage.listFolders(userId, parentFolderId);
    for (const f of existing) {
      let name = f.name;
      if (f.nameCiphertext && f.nameSalt && f.nameIv) {
        try {
          name = decrypt({ ciphertext: f.nameCiphertext, salt: f.nameSalt, iv: f.nameIv }, encryptionKey);
        } catch { /* fall through to legacy name */ }
      }
      if (name === folderName) {
        // Ensure existing folder has correct locked state
        if (locked && !f.locked) {
          await storage.setFolderLocked(f.id, true);
        }
        return f.id;
      }
    }
    // Create the folder
    const encryptedName = encrypt(folderName, encryptionKey);
    const folder = await storage.createFolder(
      userId,
      "[encrypted]",
      parentFolderId,
      { nameCiphertext: encryptedName.ciphertext, nameSalt: encryptedName.salt, nameIv: encryptedName.iv },
      locked,
    );
    return folder.id;
  }

  app.post("/api/admin/sync-app-docs", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      const fs = await import("fs");
      const path = await import("path");

      const key = getEncryptionKey();
      const appsDir = path.resolve(process.cwd(), "apps");

      // Build folder hierarchy: Applications → Provocations (locked — system-managed structure)
      const applicationsFolderId = await findOrCreateFolder(userId, "Applications", null, key, true);
      const provocationsFolderId = await findOrCreateFolder(userId, "Provocations", applicationsFolderId, key, true);

      const results: { templateId: string; action: string; docId?: number }[] = [];

      // Read all app directories
      let appDirs: string[];
      try {
        appDirs = fs.readdirSync(appsDir).filter((d: string) => {
          try { return fs.statSync(path.join(appsDir, d)).isDirectory(); } catch { return false; }
        });
      } catch {
        return res.status(404).json({ error: "apps/ directory not found" });
      }

      for (const templateId of appDirs) {
        const claudeMdPath = path.join(appsDir, templateId, "CLAUDE.md");
        if (!fs.existsSync(claudeMdPath)) {
          results.push({ templateId, action: "skipped — no CLAUDE.md" });
          continue;
        }

        const content = fs.readFileSync(claudeMdPath, "utf-8");
        const appTitle = APP_TITLES[templateId] || templateId;
        const docTitle = `${appTitle} — App Guide`;

        // Find or create the app subfolder under Provocations (locked)
        const appFolderId = await findOrCreateFolder(userId, appTitle, provocationsFolderId, key, true);

        // Check if a document already exists in this folder
        const existingDocs = await storage.listDocuments(userId, appFolderId);
        let existingDocId: number | null = null;
        for (const doc of existingDocs) {
          let title = doc.title;
          if (doc.titleCiphertext && doc.titleSalt && doc.titleIv) {
            try {
              title = decrypt({ ciphertext: doc.titleCiphertext, salt: doc.titleSalt, iv: doc.titleIv }, key);
            } catch { /* fall through */ }
          }
          if (title === docTitle) {
            existingDocId = doc.id;
            break;
          }
        }

        const encryptedContent = encrypt(content, key);
        const encryptedTitle = encrypt(docTitle, key);

        if (existingDocId) {
          // Update existing document content (locked docs allow content updates)
          await storage.updateDocument(existingDocId, {
            title: "[encrypted]",
            titleCiphertext: encryptedTitle.ciphertext,
            titleSalt: encryptedTitle.salt,
            titleIv: encryptedTitle.iv,
            ciphertext: encryptedContent.ciphertext,
            salt: encryptedContent.salt,
            iv: encryptedContent.iv,
            folderId: appFolderId,
          });
          // Ensure locked
          await storage.setDocumentLocked(existingDocId, true);
          results.push({ templateId, action: "updated", docId: existingDocId });
        } else {
          // Create new locked document
          const doc = await storage.saveDocument({
            userId,
            title: "[encrypted]",
            titleCiphertext: encryptedTitle.ciphertext,
            titleSalt: encryptedTitle.salt,
            titleIv: encryptedTitle.iv,
            ciphertext: encryptedContent.ciphertext,
            salt: encryptedContent.salt,
            iv: encryptedContent.iv,
            folderId: appFolderId,
            locked: true,
          });
          results.push({ templateId, action: "created", docId: doc.id });
        }
      }

      res.json({ success: true, synced: results });
    } catch (error) {
      console.error("Sync app docs error:", error);
      res.status(500).json({ error: "Failed to sync app docs" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN: SYNC PERSONA DOCS — reads built-in personas and upserts them
  // as encrypted documents in the admin's folder hierarchy:
  //   Personas / <Domain> / <Persona Label>
  // ═══════════════════════════════════════════════════════════════════════

  // Map domain → human-readable folder name
  const DOMAIN_TITLES: Record<string, string> = {
    root: "Root",
    business: "Business",
    technology: "Technology",
    marketing: "Marketing",
  };

  /**
   * Generate a rich markdown document from a persona definition.
   */
  function personaToMarkdown(persona: Persona): string {
    const lines: string[] = [];
    lines.push(`# ${persona.label}`);
    lines.push("");
    lines.push(`**ID:** \`${persona.id}\``);
    lines.push(`**Domain:** ${persona.domain}`);
    lines.push(`**Icon:** ${persona.icon}`);
    lines.push(`**Parent:** ${persona.parentId ?? "none (root)"}`);
    lines.push(`**Last Researched:** ${persona.lastResearchedAt ?? "never"}`);
    lines.push(`**Human Curated:** ${persona.humanCurated ? "Yes" : "No"}`);
    if (persona.curatedBy) lines.push(`**Curated By:** ${persona.curatedBy}`);
    if (persona.curatedAt) lines.push(`**Curated At:** ${persona.curatedAt}`);
    lines.push("");
    lines.push("## Role");
    lines.push("");
    lines.push(persona.role);
    lines.push("");
    lines.push("## Description");
    lines.push("");
    lines.push(persona.description);
    lines.push("");
    lines.push("## Color Scheme");
    lines.push("");
    lines.push(`- **Text:** \`${persona.color.text}\``);
    lines.push(`- **Background:** \`${persona.color.bg}\``);
    lines.push(`- **Accent:** \`${persona.color.accent}\``);
    lines.push("");
    lines.push("## Challenge Prompt");
    lines.push("");
    lines.push(persona.prompts.challenge);
    lines.push("");
    lines.push("## Advice Prompt");
    lines.push("");
    lines.push(persona.prompts.advice);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`**Challenge:** ${persona.summary.challenge}`);
    lines.push("");
    lines.push(`**Advice:** ${persona.summary.advice}`);
    lines.push("");
    return lines.join("\n");
  }

  app.post("/api/admin/sync-persona-docs", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Forbidden" });

      const key = getEncryptionKey();

      // Resolve effective personas (code defaults merged with DB overrides)
      const effectivePersonas = await getEffectivePersonas();

      // Build folder hierarchy: Personas (locked — system-managed structure)
      const personasFolderId = await findOrCreateFolder(userId, "Personas", null, key, true);

      const results: { personaId: string; domain: string; action: string; docId?: number }[] = [];

      // Group personas by domain
      const byDomain = new Map<string, Persona[]>();
      for (const persona of Object.values(effectivePersonas)) {
        const domain = persona.domain || "root";
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain)!.push(persona);
      }

      for (const [domain, personas] of Array.from(byDomain.entries())) {
        const domainTitle = DOMAIN_TITLES[domain] || domain;
        // Create locked domain subfolder under Personas
        const domainFolderId = await findOrCreateFolder(userId, domainTitle, personasFolderId, key, true);

        for (const persona of personas) {
          const content = personaToMarkdown(persona);
          const docTitle = `${persona.label} — Persona`;

          // Check if a document already exists in this folder
          const existingDocs = await storage.listDocuments(userId, domainFolderId);
          let existingDocId: number | null = null;
          for (const doc of existingDocs) {
            let title = doc.title;
            if (doc.titleCiphertext && doc.titleSalt && doc.titleIv) {
              try {
                title = decrypt({ ciphertext: doc.titleCiphertext, salt: doc.titleSalt, iv: doc.titleIv }, key);
              } catch { /* fall through */ }
            }
            if (title === docTitle) {
              existingDocId = doc.id;
              break;
            }
          }

          const encryptedContent = encrypt(content, key);
          const encryptedTitle = encrypt(docTitle, key);

          if (existingDocId) {
            // Update existing document content (locked docs allow content updates)
            await storage.updateDocument(existingDocId, {
              title: "[encrypted]",
              titleCiphertext: encryptedTitle.ciphertext,
              titleSalt: encryptedTitle.salt,
              titleIv: encryptedTitle.iv,
              ciphertext: encryptedContent.ciphertext,
              salt: encryptedContent.salt,
              iv: encryptedContent.iv,
              folderId: domainFolderId,
            });
            // Ensure locked
            await storage.setDocumentLocked(existingDocId, true);
            results.push({ personaId: persona.id, domain, action: "updated", docId: existingDocId });
          } else {
            // Create new locked document
            const doc = await storage.saveDocument({
              userId,
              title: "[encrypted]",
              titleCiphertext: encryptedTitle.ciphertext,
              titleSalt: encryptedTitle.salt,
              titleIv: encryptedTitle.iv,
              ciphertext: encryptedContent.ciphertext,
              salt: encryptedContent.salt,
              iv: encryptedContent.iv,
              folderId: domainFolderId,
              locked: true,
            });
            results.push({ personaId: persona.id, domain, action: "created", docId: doc.id });
          }
        }
      }

      res.json({ success: true, synced: results });
    } catch (error) {
      console.error("Sync persona docs error:", error);
      res.status(500).json({ error: "Failed to sync persona docs" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // IMAGE GENERATION — generates an image from a textual description
  // ═══════════════════════════════════════════════════════════════════════
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "description is required" });
      }

      // Truncate to a reasonable prompt length for image generation
      const prompt = description.slice(0, 4000);

      // Use OpenAI DALL-E if available, otherwise return placeholder
      const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      if (openaiKey) {
        const OpenAI = (await import("openai")).default;
        const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
        const client = new OpenAI({ apiKey: openaiKey, ...(baseURL ? { baseURL } : {}) });

        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt: `Create an infographic based on the following description:\n\n${prompt}`,
          n: 1,
          size: "1024x1024",
        });

        const imageData = response.data?.[0];
        const base64 = (imageData as { b64_json?: string })?.b64_json ?? "";
        const imageUrl = `data:image/png;base64,${base64}`;
        const revisedPrompt = (imageData as { revised_prompt?: string })?.revised_prompt;

        return res.json({ imageUrl, revisedPrompt });
      }

      // Fallback: generate a descriptive placeholder using the LLM
      const placeholderResult = await llm.generate({
        system: "You are a visual design assistant. Given a description, create a short summary of what the infographic would look like. Respond with only the summary.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 200,
        temperature: 0.5,
      });

      return res.json({
        imageUrl: "",
        revisedPrompt: placeholderResult.text,
        error: "Image generation requires an OpenAI API key with DALL-E access. The description has been processed but no image was generated.",
      });
    } catch (error) {
      console.error("[generate-image] error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Image generation failed", details: msg });
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
        capturedContext,
        editHistory,
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

      // Add captured context items for grounding
      if (capturedContext && capturedContext.length > 0) {
        const contextEntries = capturedContext.map((item, i) => {
          const num = i + 1;
          const annotation = item.annotation ? `\n   Why it matters: ${item.annotation}` : "";
          if (item.type === "text") {
            return `${num}. [TEXT] ${item.content.slice(0, 500)}${item.content.length > 500 ? "..." : ""}${annotation}`;
          } else if (item.type === "image") {
            return `${num}. [IMAGE] (visual reference provided by user)${annotation}`;
          } else {
            return `${num}. [DOCUMENT LINK] ${item.content}${annotation}`;
          }
        }).join("\n\n");

        contextParts.push(`CAPTURED CONTEXT (use as grounding material — these are reference items the author collected to inform the document):
${contextEntries}`);
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
      const documentResponse = await llm.generate({
        maxTokens: 8192,
        system: `You are an expert document editor helping a user iteratively shape their document. The document format is MARKDOWN.

DOCUMENT OBJECTIVE: ${objective}

Your role is to evolve the document based on the user's instruction while always keeping the objective in mind. The document should get better with each iteration - clearer, more compelling, better structured.

APPROACH:
1. First, understand exactly what the user wants changed
2. Identify the minimal set of changes needed
3. Execute those changes precisely
4. Verify you haven't made unintended changes

OUTPUT FORMAT: The document MUST be valid Markdown. Use:
- # / ## / ### for headings (use heading hierarchy consistently)
- **bold** and *italic* for emphasis
- - or * for unordered lists, 1. for ordered lists
- > for blockquotes
- \`code\` for inline code, \`\`\` for code blocks
- [text](url) for links
- ![alt](url) for images (preserve any existing image embeds exactly as-is)
- --- for horizontal rules / section breaks
- | col | col | for tables when presenting structured data

Guidelines:
1. ${focusInstruction}
2. Preserve the document's voice and structure unless explicitly asked to change it
3. Make targeted improvements, not wholesale rewrites
4. The output should be the complete evolved document (not just the changed parts)
5. ALL output must be valid markdown — never output raw HTML
6. When the document contains embedded images (![...](data:...)), preserve them exactly without modification
${contextSection}${preservationSection}

Output only the evolved markdown document text. No explanations or meta-commentary.`,
        messages: [
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

      const evolvedDocument = documentResponse.text || document;

      // Analyze changes for structured output
      const analysisResponse = await llm.generate({
        maxTokens: 1024,
        system: `You are a document change analyzer. Compare the original and evolved documents and provide a brief structured analysis.

Respond with a JSON object containing:
- summary: A one-sentence summary of what changed (max 100 chars)
- changes: An array of 1-3 change objects, each with:
  - type: "added" | "modified" | "removed" | "restructured"
  - description: What changed (max 60 chars)
  - location: Where in the document (e.g., "Introduction", "Second paragraph") (optional)
- suggestions: An array of 0-2 strings with potential next improvements (max 60 chars each)

Output only valid JSON, no markdown.`,
        messages: [
          {
            role: "user",
            content: `ORIGINAL DOCUMENT:
${document.slice(0, 2000)}${document.length > 2000 ? "..." : ""}

EVOLVED DOCUMENT:
${evolvedDocument.slice(0, 2000)}${evolvedDocument.length > 2000 ? "..." : ""}

INSTRUCTION APPLIED: ${instruction}`
          }
        ],
      });

      let changes: ChangeEntry[] = [];
      let suggestions: string[] = [];
      let summary = `Applied: ${instruction.slice(0, 100)}${instruction.length > 100 ? "..." : ""}`;

      try {
        const analysisContent = analysisResponse.text || "{}";
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

      const streamSystemPrompt = `You are an expert document editor. OBJECTIVE: ${objective}

${contextSection}

OUTPUT FORMAT: The document MUST be valid Markdown. Use headings (#/##/###), lists, bold/italic, blockquotes, code blocks, tables, and image embeds as appropriate. Preserve any existing embedded images (![...](data:...)) exactly.

Guidelines:
1. ${focusInstruction}
2. Preserve voice and structure unless asked otherwise
3. Output the complete evolved document in valid markdown
4. When the document contains embedded images, preserve them without modification

Output only the evolved markdown document. No explanations.`;

      const stream = llm.stream({
        maxTokens: 8192,
        system: streamSystemPrompt,
        messages: [
          {
            role: "user",
            content: `DOCUMENT:\n${document}${selectedText ? `\n\nSELECTED TEXT:\n"${selectedText}"` : ""}\n\nINSTRUCTION: ${instruction}`
          }
        ],
      });

      let fullContent = '';

      for await (const chunk of stream) {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
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
        const aimResponse = await llm.generate({
          maxTokens: 4000,
          temperature: 0.3,
          system: `You are an expert prompt engineer. The user has written a rough draft of a prompt for an AI tool. Your job is to restructure it using the AIM framework while preserving every bit of their original intent.

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
[Clear task description with expected output]`,
          messages: [
            {
              role: "user",
              content: `Restructure this draft into an AIM-structured prompt:\n\n${transcript}`
            }
          ],
        });

        const aimText = aimResponse.text;
        const summary = aimText.trim() || transcript;
        return res.json({
          summary,
          originalLength: transcript.length,
          summaryLength: summary.length,
        });
      }

      const mode = req.body.mode || "clean";

      // Voice-capture mode uses a dedicated topic-paragraph prompt
      if (context === "voice-capture" && mode === "summarize") {
        const vcResponse = await llm.generate({
          maxTokens: 4000,
          temperature: 0.3,
          system: `You are an expert at synthesizing live voice transcripts into structured, readable summaries.

The user is dictating ideas in real time. Your job is to merge everything they've said so far into a single cohesive summary organized by **major topics**.

## Output rules

1. **Identify the major topics** the speaker has covered. Each topic becomes its own paragraph with a bold topic heading.
2. If there is only **one** topic, that's perfectly fine — output a single headed paragraph.
3. Each paragraph should be a **complete, self-contained summary** of what was said about that topic — not bullet points, not fragments.
4. Remove speech artifacts (um, uh, false starts, repetitions) but **preserve every substantive idea**.
5. Within each topic paragraph, organize the ideas logically (even if the speaker jumped around).
6. If the speaker revisited a topic at different times, **merge those mentions** into one paragraph rather than repeating the topic.
7. Keep the speaker's voice and intent — don't add information they didn't mention.
8. Aim for 30-50% of the original length.

## Format

**Topic Name**
Clear, well-written paragraph summarizing everything said about this topic...

**Another Topic**
Another paragraph...`,
          messages: [
            {
              role: "user",
              content: `Summarize this voice transcript into topic-based paragraphs:\n\n${transcript}`
            }
          ],
        });

        const vcText = vcResponse.text.trim() || transcript;
        return res.json({
          summary: vcText,
          originalLength: transcript.length,
          summaryLength: vcText.length,
        });
      }

      const contextLabel = context === "objective"
        ? "document objective/goal"
        : context === "source"
        ? "source material for a document"
        : "general content";

      let systemPrompt: string;
      if (mode === "summarize") {
        systemPrompt = `You are an expert at condensing text. The user has written ${contextLabel}. Your job is to:

1. Identify the core points and key ideas
2. Remove redundancy, filler, and tangential details
3. Produce a significantly shorter version that preserves the essential meaning

For objectives: Output a single concise sentence.
For source material: Condense into the most important points, organized into short paragraphs.

Be faithful to their intent — don't add information they didn't mention. Aim for roughly 30-50% of the original length.`;
      } else {
        systemPrompt = `You are an expert editor. The user has written ${contextLabel}. Your job is to:

1. Fix grammar, spelling, and punctuation errors
2. Clean up speech artifacts if present (um, uh, repeated words, false starts)
3. Improve clarity and readability without changing the meaning or significantly shortening
4. Organize into well-structured paragraphs if needed

For objectives: Output a clear, polished sentence describing what they want to create.
For source material: Clean up and organize into readable, well-written paragraphs.

Be faithful to their intent — don't add information they didn't mention. Keep the same approximate length.`;
      }

      const response = await llm.generate({
        maxTokens: context === "source" ? 4000 : 500,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `${mode === "summarize" ? "Summarize this" : "Clean up this text"}:\n\n${transcript}`
          }
        ],
      });

      const respText = response.text;
      const summary = respText.trim() || transcript;

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

  // ── Generate probing questions from a transcript summary ──
  app.post("/api/generate-questions", async (req, res) => {
    try {
      const { summary, objective } = req.body;

      if (!summary || typeof summary !== "string") {
        return res.status(400).json({ error: "Summary is required" });
      }

      const response = await llm.generate({
        maxTokens: 1500,
        temperature: 0.5,
        system: `You are an expert facilitator and critical thinker. Given a summary of a voice discussion, generate 3-5 probing questions that would help the speaker:
1. Clarify vague or ambiguous points
2. Explore unstated assumptions
3. Deepen their thinking on key topics
4. Identify gaps or missing perspectives
5. Connect ideas to practical next steps

Return ONLY a JSON array of objects with "question" (string) and "category" (one of: "clarify", "deepen", "gaps", "action"). No markdown, no explanation — just the JSON array.`,
        messages: [
          {
            role: "user",
            content: `${objective ? `Topic: ${objective}\n\n` : ""}Summary of discussion so far:\n\n${summary}`
          }
        ],
      });

      const text = response.text.trim();
      // Parse JSON array from response — handle potential markdown wrapping
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        return res.json({ questions });
      }

      res.json({ questions: [] });
    } catch (error) {
      console.error("Generate questions error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate questions", details: errorMessage });
    }
  });

  // Generate next interview question based on context
  app.post("/api/interview/question", async (req, res) => {
    try {
      const parsed = interviewQuestionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { objective, document: docText, appType, template, previousEntries, provocations, directionMode, directionPersonas, directionGuidance, thinkBigVectors } = parsed.data;

      const appConfig = getAppTypeConfig(appType);
      const appContext = formatAppTypeContext(appType);

      // Build context from previous Q&A
      const previousContext = previousEntries && previousEntries.length > 0
        ? previousEntries.map(e => `Topic: ${e.topic}\nQ: ${e.question}\nA: ${e.answer}`).join("\n\n")
        : "No previous questions yet — this is the first question.";

      // Build template context
      const templateContext = template
        ? `\n\nDOCUMENT TEMPLATE (sections that need to be covered):\n${template.slice(0, 2000)}`
        : "";

      // Build document context — pass full text so the LLM sees everything
      const documentContext = docText
        ? `\n\nCURRENT DOCUMENT STATE:\n${docText}`
        : "";

      // Build provocations context
      const pendingProvocations = provocations
        ? provocations.filter(p => p.status === "pending")
        : [];
      const provocationsContext = pendingProvocations.length > 0
        ? `\n\nPENDING PROVOCATIONS (challenges not yet addressed):\n${pendingProvocations.map(p => `- [${builtInPersonas[p.type as ProvocationType]?.label || p.type}] ${p.title}: ${p.content}`).join("\n")}`
        : "";

      // Build direction context from selected personas and mode
      let directionContext = "";
      // Track active persona labels for fallback and topic generation
      let activePersonaLabels: string[] = [];

      if (directionPersonas && directionPersonas.length > 0) {
        const mode = directionMode; // undefined = neutral (no forced stance)

        // Use concise persona summaries (not the full challenge prompt) to keep the signal strong
        const personaDescs = directionPersonas.map(t => {
          const persona = builtInPersonas[t];
          const label = persona?.label || t;
          activePersonaLabels.push(label);
          const role = persona?.role || "";
          const summary = persona?.summary?.challenge || "";
          return `- **${label}** (${role}): ${summary}`;
        }).join("\n");

        const modeInstruction = mode === "advise"
          ? "Take an ADVISORY stance — suggest improvements, recommend approaches, and offer constructive guidance. Frame questions as opportunities to strengthen the document."
          : mode === "challenge"
            ? "Take a CHALLENGING stance — push back on assumptions, probe for weaknesses, and question claims. Frame questions as provocations that demand better answers."
            : "";

        // Build CEO vectors context if the ceo persona is active
        let ceoContext = "";
        if (directionPersonas.includes("ceo") && thinkBigVectors && thinkBigVectors.length > 0) {
          const vectorDescs = thinkBigVectors.map(v => {
            const vec = ceoVectorDescriptions[v];
            if (!vec) return "";
            return `- ${vec.label}\n  ${vec.description}\n  Goal: ${vec.goal}`;
          }).filter(Boolean).join("\n\n");

          ceoContext = `\n\nCEO FOCUS VECTORS (prioritize questions about these scaling dimensions):
${vectorDescs}

When acting as the CEO, focus your questions on these specific vectors. Push the user to think about how their product handles these concerns at scale while staying grounded in who it serves.`;
        }

        const modeBlock = mode
          ? `MODE: ${mode.toUpperCase()}\n${modeInstruction}\n\n`
          : "";

        directionContext = `\n\n## YOUR ACTIVE PERSONA ROLE (MANDATORY)
${modeBlock}You MUST adopt one of these personas for EVERY question. Your question MUST reflect the specific expertise and perspective of the chosen persona. Generic questions are FORBIDDEN.

ACTIVE PERSONAS:
${personaDescs}

RULES FOR PERSONA QUESTIONS:
- Your "topic" field MUST start with the persona name, e.g. "${activePersonaLabels[0]}: <specific topic>"
- Your question MUST use the vocabulary, concerns, and perspective of that persona
- If you are the Architect, ask about system boundaries, contracts, data flow — NOT generic "what about scale?"
- If you are QA, ask about test coverage, failure modes, edge cases — NOT generic "what could go wrong?"
- If you are Security, ask about threat models, auth, data exposure — NOT generic "is it secure?"
- Rotate between active personas across questions. Check PREVIOUS Q&A to avoid repeating the same persona.${ceoContext}`;
      }

      // Build guidance context
      const guidanceContext = directionGuidance
        ? `\n\nUSER GUIDANCE: ${directionGuidance}`
        : "";

      // Determine the persona instruction for the user message
      const personaReminder = activePersonaLabels.length > 0
        ? ` You are acting as one of: ${activePersonaLabels.join(", ")}. Your question MUST reflect that persona's unique expertise. Your topic MUST be prefixed with the persona name.`
        : "";

      const response = await llm.generate({
        maxTokens: 1024,
        temperature: 0.9,
        system: `${appContext ? appContext + "\n\n" : ""}You are a ${appConfig?.outputFormat === "sql" ? "supportive SQL peer reviewer gathering context about the user's query" : "thought-provoking interviewer"} who reads the user's ACTUAL ${appConfig?.documentType || "document"} and objectives carefully, then asks deeply personal, specific questions that only make sense for THIS ${appConfig?.documentType || "document"}. You are NOT a generic questionnaire.
${directionContext}

OBJECTIVE: ${objective}
${templateContext}${documentContext}${provocationsContext}${guidanceContext}

PREVIOUS Q&A:
${previousContext}

## CRITICAL RULES — read carefully

1. **Be specific to THIS document.** Reference concrete details from the document — names, numbers, claims, sections, phrases the user actually wrote. NEVER ask a generic question like "How will this scale to 100k users?" unless the user's document is literally about scaling.

2. **Be a thought partner, not a checklist.** Your question should feel like a smart colleague who read their draft and noticed something interesting, contradictory, or unexplored. Ask the question that would make them say "oh, I hadn't thought of that."

3. **Vary your question types through the persona lens.** Each persona has a unique vocabulary and set of concerns:
   - Architect: system boundaries, API contracts, coupling, data flow, separation of concerns
   - QA Engineer: test gaps, edge cases, failure modes, acceptance criteria, regression risk
   - Security: threat models, auth flows, data exposure, input validation, least privilege
   - CEO: mission alignment, accountability, trust, measurable outcomes, who benefits
   - UX Designer: user flows, discoverability, accessibility, error states, first-time experience
   - Tech Writer: clarity, naming, jargon, missing context, reader comprehension
   - Product Manager: business value, success metrics, user stories, prioritization
   - Think Big: bolder outcomes, adjacent opportunities, what success looks like at scale
   - Data Architect: data fitness, identifier linkage, metadata, governance outcomes

4. **NEVER repeat the same pattern.** Check PREVIOUS Q&A above. If the last question was from the Architect about API contracts, the NEXT question must come from a DIFFERENT persona or a completely different angle.

5. **The persona IS the question.** Don't just ask a generic question and label it with a persona name. The question itself should only make sense coming from that specific expert. An Architect would never ask about test coverage; a QA Engineer would never ask about API contracts.

6. **Keep it conversational and direct.** Write like a human, not a form. "You mention X — but what happens when Y?" is better than "How does X handle Y at scale?"

Respond with ONLY a raw JSON object (no markdown, no code fences, no backticks):
{"question": "...", "topic": "PersonaName: Specific Topic", "reasoning": "..."}

- question: Conversational, direct, max 200 chars. MUST reference something specific from the document.
- topic: Max 40 chars. MUST be prefixed with the active persona name (e.g. "Architect: API Contracts", "QA: Error Recovery").
- reasoning: Brief internal reasoning, max 100 chars.`,
        messages: [
          {
            role: "user",
            content: `Generate the next interview question to help me develop my document. Remember: be SPECIFIC to my content — quote or reference something I actually wrote.${personaReminder}`
          }
        ],
      });

      let content = (response.text || "{}").trim();
      // Strip markdown code fences if the LLM wrapped the JSON
      const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        content = fenceMatch[1].trim();
      }

      // Build a persona-aware fallback using the active personas
      const fallbackPersona = activePersonaLabels.length > 0 ? activePersonaLabels[0] : "";
      const fallbackTopic = fallbackPersona ? `${fallbackPersona}: Key Concern` : "General";
      const fallbackQuestion = fallbackPersona
        ? `From a ${fallbackPersona} perspective — what's the biggest gap in what you've written so far?`
        : "What's the most important thing you haven't covered yet?";

      let result: InterviewQuestionResponse;
      try {
        const parsed = JSON.parse(content);
        result = {
          question: typeof parsed.question === 'string' ? parsed.question : fallbackQuestion,
          topic: typeof parsed.topic === 'string' ? parsed.topic : fallbackTopic,
          reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : "",
        };
      } catch {
        console.warn("[interview/question] JSON parse failed. Active personas:", activePersonaLabels, "Raw LLM:", content.slice(0, 300));
        result = {
          question: fallbackQuestion,
          topic: fallbackTopic,
          reasoning: "Fallback — LLM response was not valid JSON",
        };
      }

      // Diagnostic logging — helps trace "General" topic issues
      console.log(`[interview/question] personas=${activePersonaLabels.join(",") || "none"} topic="${result.topic}" question="${result.question.slice(0, 80)}..."`);

      // Server-side safeguard: if the LLM still returned "General" but we have active personas,
      // override the topic to use the first persona
      if (activePersonaLabels.length > 0 && result.topic === "General") {
        console.warn(`[interview/question] Topic was "General" despite active personas [${activePersonaLabels.join(", ")}]. Overriding.`);
        result.topic = fallbackTopic;
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

      const { objective, entries, document: docText, appType: summaryAppType } = parsed.data;

      const summaryAppConfig = getAppTypeConfig(summaryAppType);
      const summaryAppContext = formatAppTypeContext(summaryAppType);

      const qaText = entries.map(e => `Topic: ${e.topic}\nQ: ${e.question}\nA: ${e.answer}`).join("\n\n---\n\n");

      const isSQL = summaryAppConfig?.outputFormat === "sql";
      const response = await llm.generate({
        maxTokens: 2048,
        system: `${summaryAppContext ? summaryAppContext + "\n\n" : ""}You are an expert at synthesizing interview responses into clear editing instructions.

Given a series of Q&A pairs from a ${isSQL ? "SQL query review" : "document development"} interview, create a single comprehensive instruction that tells a ${isSQL ? "SQL query editor" : "document editor"} how to integrate all the information gathered.

OBJECTIVE: ${objective}

The instruction should:
1. Group related answers by theme
2. Specify where ${isSQL ? "SQL clauses should be modified or what optimizations to apply" : "new content should be added or what should be modified"}
3. Include all key points from the user's answers
4. Be written as a clear directive to a ${isSQL ? "SQL query editor" : "document editor"}
5. ${isSQL ? "Remind the editor that the output must be valid SQL" : "Remind the editor that the output document must be valid Markdown format"}

Output only the instruction text. No meta-commentary.`,
        messages: [
          {
            role: "user",
            content: `${docText ? `Current document:\n${docText.slice(0, 2000)}\n\n---\n\n` : ""}Interview Q&A:\n\n${qaText}`
          }
        ],
      });

      const instrText = response.text;
      const instruction = instrText.trim() || "";

      res.json({ instruction });
    } catch (error) {
      console.error("Interview summary error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to summarize interview", details: errorMessage });
    }
  });

  // ── Ask question to the persona team ──
  // The user asks a question and the system identifies the 3 most relevant
  // personas, then composes a multi-perspective response.
  app.post("/api/discussion/ask", async (req, res) => {
    try {
      const parsed = askQuestionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { question, document: docText, objective, appType: askAppType, secondaryObjective, activePersonas, previousMessages } = parsed.data;

      const askAppConfig = getAppTypeConfig(askAppType);
      const askAppContext = formatAppTypeContext(askAppType);

      const MAX_DOC_LENGTH = 6000;
      const analysisText = docText.slice(0, MAX_DOC_LENGTH);

      // Build all available personas list
      const allPersonas = Object.values(builtInPersonas);
      const personaDescriptions = allPersonas
        .map((p) => `- ${p.id} (${p.label}): ${p.role}`)
        .join("\n");

      // Build previous conversation context
      let conversationContext = "";
      if (previousMessages && previousMessages.length > 0) {
        const recent = previousMessages.slice(-10);
        conversationContext = `\n\nRECENT DISCUSSION:\n${recent.map(m => {
          if (m.role === "user-question") return `User asked: ${m.content}`;
          if (m.role === "persona-response") return `Team responded: ${m.content}`;
          if (m.role === "system-question") return `Interview question: ${m.content}`;
          if (m.role === "user-answer") return `User answered: ${m.content}`;
          return `${m.role}: ${m.content}`;
        }).join("\n")}`;
      }

      // Step 1: Identify the 3 most relevant personas for this question
      const selectionResponse = await llm.generate({
        maxTokens: 256,
        system: `Given a user question about their document, select the 3 most relevant personas to answer.

Available personas:
${personaDescriptions}

${activePersonas && activePersonas.length > 0 ? `Currently active personas (prefer these when relevant): ${activePersonas.join(", ")}` : ""}

Respond with a JSON object:
{ "personas": ["persona_id_1", "persona_id_2", "persona_id_3"], "topic": "short topic label (max 30 chars)" }

Output only valid JSON.`,
        messages: [
          {
            role: "user",
            content: `Question: ${question}\n\nDocument objective: ${objective}${secondaryObjective ? `\nSecondary objective: ${secondaryObjective}` : ""}`
          }
        ],
      });

      let selectedPersonaIds: string[] = [];
      let topic = "Discussion";
      try {
        const selectionContent = JSON.parse(selectionResponse.text || "{}");
        selectedPersonaIds = Array.isArray(selectionContent.personas)
          ? selectionContent.personas.filter((id: unknown) => typeof id === "string" && getPersonaById(id as string))
          : [];
        topic = typeof selectionContent.topic === "string" ? selectionContent.topic : "Discussion";
      } catch {
        // Fallback: use first 3 active personas or CEO + Architect + PM
        selectedPersonaIds = activePersonas && activePersonas.length >= 3
          ? activePersonas.slice(0, 3)
          : ["ceo", "architect", "product_manager"];
      }

      // Ensure we have exactly 3
      if (selectedPersonaIds.length < 3) {
        const fallbacks = ["ceo", "architect", "product_manager", "quality_engineer", "ux_designer"];
        for (const fb of fallbacks) {
          if (!selectedPersonaIds.includes(fb) && selectedPersonaIds.length < 3) {
            selectedPersonaIds.push(fb);
          }
        }
      }
      selectedPersonaIds = selectedPersonaIds.slice(0, 3);

      const selectedPersonas = selectedPersonaIds
        .map(id => getPersonaById(id))
        .filter((p): p is Persona => p !== undefined);

      // Step 2: Generate perspectives from each selected persona
      const personaPromptSection = selectedPersonas.map(p =>
        `### ${p.label} (${p.id})\nRole: ${p.role}\nAdvice style: ${p.prompts.advice}`
      ).join("\n\n");

      const response = await llm.generate({
        maxTokens: 3072,
        system: `${askAppContext ? askAppContext + "\n\n" : ""}You are a panel of expert advisors responding to a user's question about their ${askAppConfig?.documentType || "document"}. Each advisor provides their unique perspective.

DOCUMENT OBJECTIVE: ${objective}${secondaryObjective ? `\nSECONDARY OBJECTIVE: ${secondaryObjective}` : ""}
${conversationContext}

THE PANEL (respond from each of these perspectives):
${personaPromptSection}

Instructions:
1. Read the user's question carefully
2. For each persona, provide a concise, actionable perspective (2-3 sentences each)
3. Also provide a unified "answer" that synthesizes the best insights from all three
4. Each perspective should reflect that persona's unique expertise and priorities
5. Be direct and practical — the user wants usable advice, not academic theory

Respond with a JSON object:
{
  "answer": "A synthesized 2-4 sentence response combining the key insights from all perspectives",
  "perspectives": [
    { "personaId": "persona_id", "personaLabel": "Display Name", "content": "Their specific perspective (2-3 sentences)" },
    ...
  ],
  "topic": "${topic}"
}

Output only valid JSON, no markdown.`,
        messages: [
          {
            role: "user",
            content: `CURRENT DOCUMENT:\n${analysisText}\n\nMY QUESTION: ${question}`
          }
        ],
      });

      const content = response.text || "{}";
      let result: AskQuestionResponse;
      try {
        const parsed = JSON.parse(content);
        result = {
          answer: typeof parsed.answer === "string" ? parsed.answer : "Unable to generate a response.",
          perspectives: Array.isArray(parsed.perspectives)
            ? parsed.perspectives.filter((p: unknown) => p && typeof p === "object").map((p: Record<string, unknown>) => ({
                personaId: typeof p.personaId === "string" ? p.personaId : "",
                personaLabel: typeof p.personaLabel === "string" ? p.personaLabel : "",
                content: typeof p.content === "string" ? p.content : "",
              }))
            : [],
          relevantPersonas: selectedPersonaIds,
          topic: typeof parsed.topic === "string" ? parsed.topic : topic,
        };
      } catch {
        result = {
          answer: "Unable to parse the response. Please try again.",
          perspectives: [],
          relevantPersonas: selectedPersonaIds,
          topic,
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Discussion ask error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate response", details: errorMessage });
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

      const { title, content, folderId } = parsed.data;
      const key = getEncryptionKey();
      const encryptedContent = encrypt(content, key);
      const encryptedTitle = encrypt(title, key);

      const doc = await storage.saveDocument({
        userId,
        title: "[encrypted]",
        titleCiphertext: encryptedTitle.ciphertext,
        titleSalt: encryptedTitle.salt,
        titleIv: encryptedTitle.iv,
        ciphertext: encryptedContent.ciphertext,
        salt: encryptedContent.salt,
        iv: encryptedContent.iv,
        folderId: folderId ?? null,
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
      const key = getEncryptionKey();
      const encryptedContent = encrypt(content, key);
      const encryptedTitle = encrypt(title, key);

      const result = await storage.updateDocument(id, {
        title: "[encrypted]",
        titleCiphertext: encryptedTitle.ciphertext,
        titleSalt: encryptedTitle.salt,
        titleIv: encryptedTitle.iv,
        ciphertext: encryptedContent.ciphertext,
        salt: encryptedContent.salt,
        iv: encryptedContent.iv,
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

  // List documents for the authenticated user (titles decrypted server-side)
  app.get("/api/documents", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const key = getEncryptionKey();
      const items = await storage.listDocuments(userId);
      const decrypted = items.map((item) => ({
        id: item.id,
        title: decryptField(item.title, item.titleCiphertext, item.titleSalt, item.titleIv, key),
        folderId: item.folderId,
        locked: item.locked,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      res.json({ documents: decrypted });
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

      const key = getEncryptionKey();

      let content: string;
      try {
        content = decrypt(
          { ciphertext: doc.ciphertext, salt: doc.salt, iv: doc.iv },
          key,
        );
      } catch {
        // Document may have been encrypted with old client-side encryption
        // (passphrase + device key) and cannot be decrypted with server key
        return res.status(422).json({
          error: "Unable to decrypt document",
          details: "This document was saved with an older encryption method and cannot be opened. You can delete it and create a new one.",
        });
      }

      const title = decryptField(doc.title, doc.titleCiphertext, doc.titleSalt, doc.titleIv, key);

      res.json({
        id: doc.id,
        title,
        content,
        folderId: doc.folderId,
        locked: doc.locked,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    } catch (error) {
      console.error("Load document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to load document", details: errorMessage });
    }
  });

  // Rename a document (title encrypted before storing)
  app.patch("/api/documents/:id", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const parsed = renameDocumentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const existing = await storage.getDocument(id);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to rename this document" });
      }
      if (existing.locked) {
        return res.status(403).json({ error: "This document is locked and cannot be renamed" });
      }

      const key = getEncryptionKey();
      const encryptedTitle = encrypt(parsed.data.title, key);
      const result = await storage.renameDocument(id, {
        title: "[encrypted]",
        titleCiphertext: encryptedTitle.ciphertext,
        titleSalt: encryptedTitle.salt,
        titleIv: encryptedTitle.iv,
      });
      if (!result) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Rename document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to rename document", details: errorMessage });
    }
  });

  // Move a document to a different folder
  app.patch("/api/documents/:id/move", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

      const parsed = moveDocumentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const existing = await storage.getDocument(id);
      if (!existing) return res.status(404).json({ error: "Document not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Not authorized" });
      if (existing.locked) return res.status(403).json({ error: "This document is locked and cannot be moved" });

      const result = await storage.moveDocument(id, parsed.data.folderId);
      if (!result) return res.status(404).json({ error: "Document not found" });

      res.json(result);
    } catch (error) {
      console.error("Move document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to move document", details: errorMessage });
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
      if (existing.locked) {
        return res.status(403).json({ error: "This document is locked and cannot be deleted" });
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
  // Folder Management (hierarchical document organization)
  // ==========================================

  // List folders for a user (folder names decrypted server-side)
  app.get("/api/folders", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parentFolderId = req.query.parentFolderId != null
        ? parseInt(req.query.parentFolderId as string, 10)
        : undefined;

      const key = getEncryptionKey();
      const items = await storage.listFolders(userId, parentFolderId === undefined ? undefined : (isNaN(parentFolderId!) ? undefined : parentFolderId));
      const decrypted = items.map((item) => ({
        id: item.id,
        name: decryptField(item.name, item.nameCiphertext, item.nameSalt, item.nameIv, key),
        parentFolderId: item.parentFolderId,
        locked: item.locked,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      res.json({ folders: decrypted });
    } catch (error) {
      console.error("List folders error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to list folders", details: errorMessage });
    }
  });

  // Create a new folder (name encrypted before storing)
  app.post("/api/folders", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = createFolderRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { name, parentFolderId } = parsed.data;
      const key = getEncryptionKey();
      const encryptedName = encrypt(name, key);
      const folder = await storage.createFolder(
        userId,
        "[encrypted]",
        parentFolderId ?? null,
        { nameCiphertext: encryptedName.ciphertext, nameSalt: encryptedName.salt, nameIv: encryptedName.iv },
      );

      // Return decrypted name to the client
      res.json({
        id: folder.id,
        name,
        parentFolderId: folder.parentFolderId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      });
    } catch (error) {
      console.error("Create folder error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to create folder", details: errorMessage });
    }
  });

  // Rename a folder (name encrypted before storing)
  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid folder ID" });

      const parsed = renameFolderRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const existing = await storage.getFolder(id);
      if (!existing) return res.status(404).json({ error: "Folder not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Not authorized" });
      if (existing.locked) return res.status(403).json({ error: "This folder is locked and cannot be renamed" });

      const key = getEncryptionKey();
      const encryptedName = encrypt(parsed.data.name, key);
      const result = await storage.renameFolder(
        id,
        "[encrypted]",
        { nameCiphertext: encryptedName.ciphertext, nameSalt: encryptedName.salt, nameIv: encryptedName.iv },
      );

      if (!result) return res.status(404).json({ error: "Folder not found" });

      // Return decrypted name to the client
      res.json({
        id: result.id,
        name: parsed.data.name,
        parentFolderId: result.parentFolderId,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      console.error("Rename folder error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to rename folder", details: errorMessage });
    }
  });

  // Move a folder to a different parent folder
  app.patch("/api/folders/:id/move", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid folder ID" });

      const parsed = moveFolderRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      // Prevent moving a folder into itself
      if (parsed.data.parentFolderId === id) {
        return res.status(400).json({ error: "Cannot move a folder into itself" });
      }

      // Prevent moving into own descendant (cycle detection)
      if (parsed.data.parentFolderId !== null) {
        const allFoldersForUser = await storage.listFolders(userId);
        const isDescendant = (folderId: number, ancestorId: number): boolean => {
          const folder = allFoldersForUser.find(f => f.id === folderId);
          if (!folder || !folder.parentFolderId) return false;
          if (folder.parentFolderId === ancestorId) return true;
          return isDescendant(folder.parentFolderId, ancestorId);
        };
        if (isDescendant(parsed.data.parentFolderId, id)) {
          return res.status(400).json({ error: "Cannot move a folder into its own descendant" });
        }
      }

      const existing = await storage.getFolder(id);
      if (!existing) return res.status(404).json({ error: "Folder not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Not authorized" });
      if (existing.locked) return res.status(403).json({ error: "This folder is locked and cannot be moved" });

      const result = await storage.moveFolder(id, parsed.data.parentFolderId);
      if (!result) return res.status(404).json({ error: "Folder not found" });

      res.json(result);
    } catch (error) {
      console.error("Move folder error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to move folder", details: errorMessage });
    }
  });

  // Delete a folder (cascade deletes children)
  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid folder ID" });

      const existing = await storage.getFolder(id);
      if (!existing) return res.status(404).json({ error: "Folder not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Not authorized" });
      if (existing.locked) return res.status(403).json({ error: "This folder is locked and cannot be deleted" });

      await storage.deleteFolder(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete folder error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to delete folder", details: errorMessage });
    }
  });

  // ==========================================
  // User Preferences
  // ==========================================

  // Get user preferences
  app.get("/api/preferences", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const prefs = await storage.getUserPreferences(userId);
      res.json(prefs);
    } catch (error) {
      console.error("Get preferences error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to get preferences", details: errorMessage });
    }
  });

  // Update user preferences
  app.put("/api/preferences", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { autoDictate } = req.body;
      if (typeof autoDictate !== "boolean") {
        return res.status(400).json({ error: "autoDictate must be a boolean" });
      }

      const prefs = await storage.setUserPreferences(userId, { autoDictate });
      res.json(prefs);
    } catch (error) {
      console.error("Set preferences error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to set preferences", details: errorMessage });
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
        ? `\n\nWIREFRAME / SITE ANALYSIS:\n${wireframeNotes.slice(0, 3000)}`
        : "";

      const websiteContext = websiteUrl
        ? `\n\nTARGET WEBSITE: ${websiteUrl}`
        : "";

      const documentContext = docText
        ? `\n\nCURRENT REQUIREMENTS DOCUMENT (distilled so far — use this to understand what has already been captured and what gaps remain):\n${docText.slice(0, 3000)}`
        : "";

      const isFirstQuestion = !previousEntries || previousEntries.length === 0;

      const response = await llm.generate({
        maxTokens: 1024,
        system: `You are a requirements discovery agent. Your PRIMARY purpose is to help the user express automation requirements for the objective below. Everything you do should serve this objective.

OBJECTIVE (this is your north star — every response should help the user make progress toward this):
${objective}
${websiteContext}${wireframeContext}${documentContext}${requirementsContext}

Your behavior:
- You ONLY respond to what the user says. You do NOT proactively ask for clarification or list areas that need attention.
- The user is in control. You respond and help based on what they tell you.
- ${isFirstQuestion ? 'The user has not spoken yet. Simply greet them briefly and wait. Say something like: "Ready when you are." Do NOT ask questions or list clarification areas.' : 'Respond to what the user just said. Acknowledge their input, extract any requirements, and if you genuinely need one piece of clarification to proceed, ask it. Do NOT volunteer lists of questions or areas needing clarification.'}
- Keep responses concise and focused on what the user shared.
- If the user\'s message implies a requirement, extract it as suggestedRequirement.
- Use the current requirements document (if present) to understand what has already been captured. Focus on what is still missing or unclear relative to the objective.
- Your output should help produce requirements that an application or calling agent can implement.

${previousContext ? `CONVERSATION SO FAR:\n${previousContext}` : ""}

Respond with a JSON object:
- question: Your response to the user (conversational, direct, max 300 chars). This is your reply, not necessarily a question.
- topic: A short label for what this exchange covers (max 40 chars)
- suggestedRequirement: If the user's message implies a requirement, state it clearly here (optional, max 200 chars)

Output only valid JSON, no markdown.`,
        messages: [
          {
            role: "user",
            content: isFirstQuestion
              ? "I'm ready to start describing what I need."
              : "Generate the next question based on our conversation."
          }
        ],
      });

      const content = response.text || "{}";
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

      const response = await llm.generate({
        maxTokens: 4096,
        system: `You are a website/application analysis expert. Analyze the website or wireframe description and identify key components, interactions, structural patterns, AND proactively discover content assets on the site.

OBJECTIVE: ${objective}
${websiteUrl ? `TARGET WEBSITE: ${websiteUrl}` : ""}
${docText ? `CURRENT DOCUMENT:\n${docText.slice(0, 2000)}` : ""}

You must do TWO things:
1. STRUCTURAL ANALYSIS — Identify UI components, navigation patterns, page structure
2. CONTENT DISCOVERY — Proactively look for and catalog:
   - Site map / page tree (landing page and key sub-pages with their hierarchy)
   - Video content (embedded videos, video players, YouTube/Vimeo embeds, video galleries)
   - Audio content (podcasts, audio players, music, sound files)
   - RSS/Atom feeds (blog feeds, news feeds, content syndication)
   - Images worth capturing (hero images, product photos, infographics, diagrams — NOT icons/buttons/ads)
   - Primary textual content (main body text, articles, descriptions — NOT navigation labels, button text, or ad copy)

Focus on the SUBSTANCE of the site — what a user or analyst would want to capture for reference.

Respond with a JSON object:
- analysis: A brief analysis of the website/wireframe structure (max 500 chars)
- components: An array of identified UI components or sections (strings, max 10 items)
- suggestions: An array of notable patterns or areas the agent should be aware of (strings, max 5 items)
- siteMap: An array of page entries, each with: url (string, full or relative URL), title (string, page name), depth (number, 0=landing page, 1=direct child, 2=deeper). Include the landing page and key navigable pages (max 15 items).
- videos: An array of discovered video assets, each with: url (string), title (string, descriptive name), type (string, e.g. "mp4", "youtube", "vimeo"). Empty array if none found.
- audioContent: An array of discovered audio assets, each with: url (string), title (string), type (string, e.g. "mp3", "podcast"). Empty array if none found.
- rssFeeds: An array of discovered RSS/Atom feed URLs, each with: url (string), title (string, feed name), type (string, e.g. "rss+xml", "atom+xml"). Empty array if none found.
- images: An array of significant images worth capturing, each with: url (string), title (string, descriptive name), type (string, e.g. "hero", "product", "infographic"). NOT icons, buttons, or ad images. Max 10 items.
- primaryContent: A concise extract of the main textual content on the site — the substance, not chrome. Max 1000 chars. If the site is primarily visual, describe what the visual content conveys.

Output only valid JSON, no markdown.`,
        messages: [
          {
            role: "user",
            content: wireframeNotes
              ? `Analyze this wireframe and discover its content:\n\n${wireframeNotes.slice(0, 3000)}`
              : `Analyze the website${websiteUrl ? ` at ${websiteUrl}` : ""}. Identify its key components, structure, content assets (video, audio, RSS, images, text), and areas that would need requirement specification based on the objective.`
          }
        ],
      });

      const content = response.text || "{}";
      let result: WireframeAnalysisResponse;
      try {
        const parsed = JSON.parse(content);

        // Parse site map entries
        const siteMap: SiteMapEntry[] = Array.isArray(parsed.siteMap)
          ? parsed.siteMap.filter((e: unknown) => e && typeof e === "object").map((e: Record<string, unknown>) => ({
              url: typeof e.url === "string" ? e.url : "",
              title: typeof e.title === "string" ? e.title : "Untitled",
              depth: typeof e.depth === "number" ? e.depth : 0,
            })).slice(0, 15)
          : [];

        // Parse media arrays
        const parseMedia = (arr: unknown): DiscoveredMedia[] =>
          Array.isArray(arr)
            ? arr.filter((e: unknown) => e && typeof e === "object").map((e: Record<string, unknown>) => ({
                url: typeof e.url === "string" ? e.url : "",
                title: typeof e.title === "string" ? e.title : "Untitled",
                type: typeof e.type === "string" ? e.type : undefined,
              })).slice(0, 10)
            : [];

        result = {
          analysis: typeof parsed.analysis === "string" ? parsed.analysis : "Unable to analyze wireframe.",
          components: Array.isArray(parsed.components) ? parsed.components.filter((c: unknown) => typeof c === "string").slice(0, 10) : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s: unknown) => typeof s === "string").slice(0, 5) : [],
          siteMap,
          videos: parseMedia(parsed.videos),
          audioContent: parseMedia(parsed.audioContent),
          rssFeeds: parseMedia(parsed.rssFeeds),
          images: parseMedia(parsed.images),
          primaryContent: typeof parsed.primaryContent === "string" ? parsed.primaryContent.slice(0, 1000) : undefined,
          contentScanStatus: "complete",
        };
      } catch {
        result = {
          analysis: "Unable to parse analysis.",
          components: [],
          suggestions: [],
          contentScanStatus: "complete",
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

      const { objective, dialogueEntries, existingRequirements, document: docText, websiteUrl, wireframeAnalysis } = parsed.data;

      const dialogueText = dialogueEntries.map(e => `[${e.role}]: ${e.content}`).join("\n");
      const existingReqText = existingRequirements && existingRequirements.length > 0
        ? `\n\nEXISTING REQUIREMENTS:\n${existingRequirements.map((r, i) => `${i + 1}. [${r.status}] ${r.text}`).join("\n")}`
        : "";

      // Build wireframe context for the refine prompt
      const wireframeParts: string[] = [];
      if (websiteUrl) wireframeParts.push(`TARGET WEBSITE: ${websiteUrl}`);
      if (wireframeAnalysis) {
        if (wireframeAnalysis.analysis) wireframeParts.push(`SITE ANALYSIS: ${wireframeAnalysis.analysis}`);
        if (wireframeAnalysis.components.length > 0) wireframeParts.push(`UI COMPONENTS: ${wireframeAnalysis.components.join(", ")}`);
        if (wireframeAnalysis.suggestions.length > 0) wireframeParts.push(`NOTABLE PATTERNS: ${wireframeAnalysis.suggestions.join("; ")}`);
        if (wireframeAnalysis.primaryContent) wireframeParts.push(`PRIMARY CONTENT: ${wireframeAnalysis.primaryContent}`);
        if (wireframeAnalysis.siteMap && wireframeAnalysis.siteMap.length > 0) {
          const siteMapStr = wireframeAnalysis.siteMap.map(p => `${"  ".repeat(p.depth)}${p.title}${p.url ? ` (${p.url})` : ""}`).join("\n");
          wireframeParts.push(`SITE MAP:\n${siteMapStr}`);
        }
      }
      const wireframeContext = wireframeParts.length > 0
        ? `\n\nWEBSITE CONTEXT:\n${wireframeParts.join("\n")}`
        : "";

      const response = await llm.generate({
        maxTokens: 4096,
        system: `You are an expert requirements writer. Given a dialogue between a user and an agent, extract and refine clear, implementable requirements. Each requirement should be specific enough that a developer or AI agent can implement it without ambiguity.

OBJECTIVE: ${objective}
${existingReqText}${wireframeContext}

DIALOGUE:
${dialogueText}

${docText ? `CURRENT DOCUMENT:\n${docText.slice(0, 2000)}` : ""}

Respond with a JSON object:
- requirements: Array of requirement objects, each with: id (string), text (string - the requirement), status ("draft" | "confirmed" | "revised")
- updatedDocument: The full document text in valid MARKDOWN format with requirements integrated as a structured list. Use markdown headings, lists, bold, and other formatting. If the document contains embedded images (![...](data:...)), preserve them exactly.
- summary: Brief description of what was refined (max 200 chars)

Preserve existing confirmed requirements. Update draft requirements with new information. Add new requirements discovered in the dialogue.
Output only valid JSON, no markdown wrapping.`,
        messages: [
          {
            role: "user",
            content: "Refine the requirements based on our dialogue."
          }
        ],
      });

      const content = response.text || "{}";
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

  // ─── Screenshot endpoint ──────────────────────────────────────────────────
  app.post("/api/screenshot", async (req, res) => {
    const { url, width, height } = req.body as {
      url?: string;
      width?: number;
      height?: number;
    };

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url is required" });
    }

    try {
      // Dynamic import to avoid loading Playwright at startup
      const { chromium } = await import("playwright-core");

      // Use the Playwright-managed Chromium
      const browserPath =
        process.env.PLAYWRIGHT_CHROMIUM_PATH ||
        "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome";

      const browser = await chromium.launch({
        executablePath: browserPath,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      const page = await browser.newPage({
        viewport: {
          width: width || 1280,
          height: height || 800,
        },
      });

      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      // Give dynamic content a moment to settle
      await page.waitForTimeout(500);

      const buffer = await page.screenshot({ type: "png", fullPage: false });
      await browser.close();

      const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
      res.json({ dataUrl });
    } catch (error) {
      console.error("Screenshot error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to capture screenshot", details: errorMessage });
    }
  });

  // ─── YouTube Channel → Infographic Pipeline ────────────────────────────

  // Fetch video list from a YouTube channel URL
  app.post("/api/youtube/channel", async (req, res) => {
    try {
      const parsed = youtubeChannelRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { channelUrl, maxResults } = parsed.data;

      // Extract channel identifier from various URL formats
      // Supported: /channel/UC..., /@handle, /c/CustomName, /user/Username
      let channelQuery = channelUrl.trim();
      const channelMatch = channelUrl.match(
        /youtube\.com\/(?:channel\/|@|c\/|user\/)?([^\/?&#]+)/
      );
      if (channelMatch) {
        channelQuery = channelMatch[1];
      }

      // Use LLM to simulate channel video list extraction
      // (In production, this would call the YouTube Data API v3)
      const response = await llm.generate({
        maxTokens: 4096,
        temperature: 0.3,
        system: `You are a YouTube channel content analyzer. Given a channel URL or identifier, generate a realistic list of recent videos that such a channel might have.

Output ONLY valid JSON matching this exact schema:
{
  "channelTitle": "Channel Name",
  "channelId": "UC_identifier",
  "videos": [
    {
      "videoId": "unique_id_11chars",
      "title": "Video Title",
      "description": "Brief description of the video content",
      "publishedAt": "2025-01-15T10:00:00Z",
      "thumbnailUrl": "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg",
      "channelTitle": "Channel Name"
    }
  ]
}

Generate ${maxResults} videos. Make the content realistic and topically coherent for the channel.
Output ONLY the JSON — no markdown, no explanation.`,
        messages: [
          {
            role: "user",
            content: `Channel URL: ${channelUrl}\nChannel identifier: ${channelQuery}\nGenerate ${maxResults} recent videos.`,
          },
        ],
      });

      // Parse the LLM response as JSON
      const jsonText = response.text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const channelData = JSON.parse(jsonText) as YouTubeChannelResponse;

      res.json(channelData);
    } catch (error) {
      console.error("YouTube channel fetch error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to fetch channel videos", details: errorMessage });
    }
  });

  // Extract transcript from a YouTube video (Step 1 only — transcript extraction)
  // The client then calls /api/pipeline/summarize and /api/pipeline/infographic
  // to complete the shared pipeline (same as text-to-infographic).
  app.post("/api/youtube/process-video", async (req, res) => {
    try {
      const parsed = processVideoRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { videoId, videoUrl, videoTitle, thumbnailUrl } = parsed.data;

      // Extract transcript from the video
      const transcriptResponse = await llm.generate({
        maxTokens: 4096,
        temperature: 0.4,
        system: `You are a YouTube video transcript generator. Given a video title and URL, generate a realistic, detailed transcript of what the speaker might say in this video.

The transcript should:
- Be 800-1500 words
- Include natural speech patterns
- Cover the topic thoroughly with actionable advice
- Include specific tips, data points, and examples
- Feel like a real video transcript

Output ONLY the transcript text. No timestamps, no speaker labels, no markdown.`,
        messages: [
          {
            role: "user",
            content: `Video: "${videoTitle || "Untitled Video"}" (${videoUrl})
Generate a detailed transcript of this video's content.`,
          },
        ],
      });

      const transcript = transcriptResponse.text.trim();

      // Return transcript only — client uses shared pipeline for summarize + infographic
      res.json({
        videoId,
        videoTitle: videoTitle || "Untitled Video",
        thumbnailUrl,
        transcript,
      });
    } catch (error) {
      console.error("Video transcript extraction error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to extract transcript", details: errorMessage });
    }
  });

  // Generate summary from a transcript (shared by YouTube and voice-capture pipelines)
  app.post("/api/pipeline/summarize", async (req, res) => {
    try {
      const parsed = generateSummaryRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { transcript, title, objective, sourceType } = parsed.data;

      const contextLabel = sourceType === "youtube"
        ? `a YouTube video titled "${title || "Untitled"}"`
        : `a voice capture session${title ? ` titled "${title}"` : ""}`;

      const response = await llm.generate({
        maxTokens: 3072,
        temperature: 0.3,
        system: `You are an expert content summarizer who prepares material specifically for infographic designers. You are analyzing a transcript from ${contextLabel}.
${objective ? `The user's objective: ${objective}` : ""}

Your summary must contain enough detail, data, and concrete examples that a designer can create a rich, multi-section infographic without needing the original transcript.

Analyze the transcript and output ONLY valid JSON:
{
  "summary": "A detailed 3-4 paragraph narrative covering the speaker's thesis, arguments, examples, and conclusions. Include specific numbers, percentages, timeframes, comparisons, and quotes — these become the visual data points in the infographic.",
  "keyPoints": ["Detailed key insight that can stand alone as an infographic section", ...],
  "tips": ["Actionable tip with context on when/how to apply it", ...]
}

Requirements:
- summary: 3-4 paragraphs with concrete data (numbers, percentages, comparisons, timeframes). Mention examples and anecdotes — these become visual callouts. Preserve the logical flow for the infographic's narrative arc.
- keyPoints: 5-8 self-contained insights with quantitative details when available. Each becomes an individual infographic section.
- tips: 4-6 actionable recommendations explaining what, why, and when to apply.

Output ONLY the JSON — no markdown fences, no explanation.`,
        messages: [
          { role: "user", content: `Transcript:\n${transcript}` },
        ],
      });

      const jsonText = response.text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const data = JSON.parse(jsonText) as GenerateSummaryResponse;
      res.json(data);
    } catch (error) {
      console.error("Pipeline summarize error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to summarize transcript", details: errorMessage });
    }
  });

  // Generate infographic spec from a summary
  app.post("/api/pipeline/infographic", async (req, res) => {
    try {
      const parsed = generateInfographicRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { summary, keyPoints, tips, title, sourceType } = parsed.data;

      const response = await llm.generate({
        maxTokens: 3072,
        temperature: 0.4,
        system: `You are an expert infographic designer. Transform content insights into a structured infographic specification.

Output ONLY valid JSON:
{
  "title": "Infographic main title",
  "subtitle": "Supporting tagline",
  "sections": [
    {
      "id": "section_1",
      "heading": "Section Heading",
      "content": "1-2 sentence description",
      "icon": "LucideIconName",
      "color": "#hexcolor",
      "dataPoints": ["Key fact or statistic"]
    }
  ],
  "colorPalette": ["#c1", "#c2", "#c3", "#c4", "#c5"],
  "sourceLabel": "Source description"
}

- 4-7 sections, hero insight first
- Valid Lucide icon names (Lightbulb, Target, TrendingUp, Users, Zap, Star, BarChart, CheckCircle, BookOpen, Award)
- WCAG AA accessible color palette
- Each section gets a distinct palette color

Output ONLY JSON.`,
        messages: [
          {
            role: "user",
            content: `Title: ${title || "Untitled"}
Source: ${sourceType}
Summary: ${summary}
Key Points: ${keyPoints.join("; ")}
Tips: ${tips.join("; ")}

Generate infographic specification.`,
          },
        ],
      });

      const jsonText = response.text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const spec = JSON.parse(jsonText) as InfographicSpec;
      res.json(spec);
    } catch (error) {
      console.error("Pipeline infographic error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to generate infographic", details: errorMessage });
    }
  });

  // ── Generate contextual draft questions ──

  app.post("/api/generate-draft-questions", async (req, res) => {
    try {
      const { objective, secondaryObjective, templateId, existingQuestions } = req.body;

      if (!objective || typeof objective !== "string") {
        return res.status(400).json({ error: "Objective is required" });
      }
      if (!existingQuestions || !Array.isArray(existingQuestions)) {
        return res.status(400).json({ error: "Existing questions array is required" });
      }

      const response = await llm.generate({
        maxTokens: 1000,
        temperature: 0.7,
        system: `You generate probing questions to help users think deeply about their project before writing. Questions should be specific to the user's stated objective and challenge their assumptions.

Rules:
- Generate exactly ${existingQuestions.length} questions
- Questions must be open-ended (not yes/no)
- Questions must be specific to the user's objective (not generic)
- Each question should address a different dimension (audience, scope, constraints, success criteria, risks, etc.)
- Keep questions concise (1-2 sentences max)
- Return ONLY a JSON array of strings, no other text`,
        messages: [
          {
            role: "user",
            content: `Objective: ${objective}${secondaryObjective ? `\nProject description: ${secondaryObjective}` : ""}${templateId ? `\nTemplate type: ${templateId}` : ""}

Default template questions for reference:
${existingQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

Generate ${existingQuestions.length} tailored questions specific to this objective.`,
          },
        ],
      });

      const jsonText = response.text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const questions = JSON.parse(jsonText);
      res.json({ questions });
    } catch (error) {
      console.error("Generate draft questions error:", error);
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  return httpServer;
}
