/**
 * Blueprints — Server-side seed data for prebuilt chain blueprints.
 *
 * These blueprints are served via GET /api/blueprints and can be
 * instantiated on the client canvas. Each blueprint defines nodes and edges
 * using stable placeholder IDs that get remapped to real IDs on instantiation.
 *
 * This is the single source of truth for prebuilt chain blueprints.
 * The client never defines chain structure — it only renders what the API returns.
 */

// ── Types ──

export interface BlueprintNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  snippet?: string;
  // Node-type-specific config (subset of FlowNode fields)
  [key: string]: unknown;
}

export interface BlueprintEdge {
  fromNodeId: string;
  toNodeId: string;
  role?: "context" | "objective" | "output-format";
}

export interface Blueprint {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "creative" | "business" | "research";
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}

// ── Layout helpers ──

const COL_GAP = 280;

function n(
  partial: { id: string; type: string; label: string; col: number; row?: number } & Record<string, unknown>,
): BlueprintNode {
  const { col, row = 0, ...rest } = partial;
  return {
    x: col * COL_GAP,
    y: row * 200,
    width: 200,
    height: 130,
    ...rest,
  } as BlueprintNode;
}

// ═══════════════════════════════════════════════════════════════
// Blueprint A: Meme Machine
// ═══════════════════════════════════════════════════════════════

const memeBlueprint: Blueprint = {
  id: "meme-machine",
  label: "Meme Machine",
  description: "Generate viral memes: caption writing, quality check, image creation",
  icon: "Zap",
  category: "creative",
  nodes: [
    n({
      id: "meme-trigger",
      type: "timer-event",
      label: "Trigger",
      col: 0,
      snippet: "Click to start the meme pipeline",
      triggerMode: "automated",
      timerRunning: false,
      timerPulseCount: 0,
      width: 200,
      height: 160,
    }),
    n({
      id: "meme-writer",
      type: "llm",
      label: "Caption Writer",
      col: 1,
      snippet: "Generate viral caption + meme idea",
      llmPresetId: "custom",
      llmObjective:
        "Generate a viral social media caption and meme concept. Use Gen-Z tone, trending humor, and punchy one-liners. Output format:\n\nCAPTION: [the caption]\nMEME IDEA: [visual description of the meme]",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "meme-gate",
      type: "coherence-gate",
      label: "Quality Check",
      col: 2,
      snippet: "Score the caption quality",
      coherenceThreshold: 70,
      coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: false, styleMatch: true },
      coherenceStrictness: "medium",
      coherenceRetryCount: 1,
      width: 160,
      height: 160,
    }),
    n({
      id: "meme-painter",
      type: "painter",
      label: "Meme Creator",
      col: 3,
      snippet: "Generate the meme image",
      width: 260,
      height: 200,
    }),
    n({
      id: "meme-output",
      type: "document",
      label: "Final Meme",
      col: 4,
      snippet: "Image + caption ready to share",
      documentContent: "",
      width: 200,
      height: 130,
    }),
  ],
  edges: [
    { fromNodeId: "meme-trigger", toNodeId: "meme-writer" },
    { fromNodeId: "meme-writer", toNodeId: "meme-gate" },
    { fromNodeId: "meme-gate", toNodeId: "meme-painter" },
    { fromNodeId: "meme-painter", toNodeId: "meme-output" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Blueprint B: Product PRD Generator
// ═══════════════════════════════════════════════════════════════

const prdBlueprint: Blueprint = {
  id: "prd-generator",
  label: "Product PRD Generator",
  description: "Full PRD pipeline: research, draft, quality gate, wireframes, polish",
  icon: "FileText",
  category: "business",
  nodes: [
    n({
      id: "prd-trigger",
      type: "timer-event",
      label: "Trigger",
      col: 0,
      snippet: "Click to start PRD generation",
      triggerMode: "automated",
      timerRunning: false,
      timerPulseCount: 0,
      width: 200,
      height: 160,
    }),
    n({
      id: "prd-researcher",
      type: "research",
      label: "Market Research",
      col: 1,
      snippet: "Pull market data from context",
      researchQuery: "Research market landscape, competitors, and user needs based on the provided context",
      outputConfig: {
        format: "structured",
        detail: "detailed",
        focusMode: "gather",
        audience: "technical",
        tone: "neutral",
      },
      width: 240,
      height: 300,
    }),
    n({
      id: "prd-writer",
      type: "llm",
      label: "PRD Drafter",
      col: 2,
      snippet: "Draft PRD: goals, features, metrics",
      llmPresetId: "custom",
      llmObjective:
        "Draft a Product Requirements Document with these sections:\n1. Overview & Vision\n2. Goals & Success Metrics\n3. User Stories\n4. Feature Requirements (prioritized)\n5. Technical Considerations\n6. Timeline & Milestones\n\nUse the research context provided.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "prd-gate",
      type: "coherence-gate",
      label: "Quality Gate",
      col: 3,
      snippet: "Verify PRD completeness",
      coherenceThreshold: 80,
      coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: true, styleMatch: false },
      coherenceStrictness: "strict",
      coherenceRetryCount: 1,
      width: 160,
      height: 160,
    }),
    n({
      id: "prd-painter",
      type: "painter",
      label: "UX Wireframes",
      col: 4,
      snippet: "Mockup 3-5 UX wireframes",
      width: 260,
      height: 200,
    }),
    n({
      id: "prd-final",
      type: "llm",
      label: "Polish & Export",
      col: 5,
      snippet: "Polish the PRD and export as Markdown",
      llmPresetId: "custom",
      llmObjective:
        "Polish this PRD for executive review. Ensure consistent formatting, clear language, and professional tone. Export as clean Markdown.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
  ],
  edges: [
    { fromNodeId: "prd-trigger", toNodeId: "prd-researcher" },
    { fromNodeId: "prd-researcher", toNodeId: "prd-writer" },
    { fromNodeId: "prd-writer", toNodeId: "prd-gate" },
    { fromNodeId: "prd-gate", toNodeId: "prd-painter" },
    { fromNodeId: "prd-gate", toNodeId: "prd-final" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Blueprint C: Deep Dive Research
// ═══════════════════════════════════════════════════════════════

const researchBlueprint: Blueprint = {
  id: "deep-dive-research",
  label: "Deep Dive Research",
  description: "Comprehensive research: topic analysis, gap finding, infographic, exec summary",
  icon: "Search",
  category: "research",
  nodes: [
    n({
      id: "res-trigger",
      type: "timer-event",
      label: "Trigger",
      col: 0,
      snippet: "Click to start research pipeline",
      triggerMode: "automated",
      timerRunning: false,
      timerPulseCount: 0,
      width: 200,
      height: 160,
    }),
    n({
      id: "res-researcher",
      type: "research",
      label: "Topic Research",
      col: 1,
      snippet: "Summarize topic using context files",
      researchQuery: "Provide a comprehensive summary of the topic using the provided context documents",
      outputConfig: {
        format: "structured",
        detail: "exhaustive",
        focusMode: "deep-research",
        audience: "technical",
        tone: "neutral",
      },
      width: 240,
      height: 300,
    }),
    n({
      id: "res-overview",
      type: "llm",
      label: "Full Overview",
      col: 2,
      snippet: "Write full overview + competitive landscape",
      llmPresetId: "custom",
      llmObjective:
        "Write a comprehensive overview document covering:\n1. Executive Summary\n2. Current Landscape\n3. Competitive Analysis\n4. Key Trends & Opportunities\n5. Risks & Challenges\n\nBase this on the research provided.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "res-analyzer",
      type: "llm",
      label: "Gap Analyzer",
      col: 3,
      snippet: "Break down features, gaps",
      llmPresetId: "custom",
      llmObjective:
        "Analyze the document for:\n1. Feature gaps vs competitors\n2. Unaddressed user needs\n3. Technical debt areas\n4. Strategic opportunities\n\nOutput a structured analysis with severity ratings.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "res-gate",
      type: "coherence-gate",
      label: "Research Gate",
      col: 4,
      snippet: "Verify research quality",
      coherenceThreshold: 75,
      coherenceChecks: { topicMatch: true, toneConsistency: false, factDrift: true, styleMatch: false },
      coherenceStrictness: "medium",
      coherenceRetryCount: 1,
      width: 160,
      height: 160,
    }),
    n({
      id: "res-painter",
      type: "painter",
      label: "Infographic",
      col: 5,
      row: -1,
      snippet: "Create infographic: timeline, charts, stats",
      width: 260,
      height: 200,
    }),
    n({
      id: "res-summary",
      type: "llm",
      label: "Exec Summary",
      col: 5,
      row: 1,
      snippet: "One-page executive summary",
      llmPresetId: "custom",
      llmObjective:
        "Write a one-page executive summary. Include:\n- Key findings (3-5 bullets)\n- Recommended actions\n- Timeline for next steps\n- Critical risks\n\nKeep it concise, clear, and actionable.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
  ],
  edges: [
    { fromNodeId: "res-trigger", toNodeId: "res-researcher" },
    { fromNodeId: "res-researcher", toNodeId: "res-overview" },
    { fromNodeId: "res-overview", toNodeId: "res-analyzer" },
    { fromNodeId: "res-analyzer", toNodeId: "res-gate" },
    { fromNodeId: "res-gate", toNodeId: "res-painter" },
    { fromNodeId: "res-gate", toNodeId: "res-summary" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Blueprint D: PRD to Reddit Post
// ═══════════════════════════════════════════════════════════════

const prdToRedditBlueprint: Blueprint = {
  id: "prd-to-reddit",
  label: "PRD to Reddit Post",
  description: "Transform a PRD into a subreddit-compliant Reddit post: research rules, draft, compliance check, publish",
  icon: "MessageSquare",
  category: "business",
  nodes: [
    n({
      id: "reddit-subreddit",
      type: "document",
      label: "Target Subreddit",
      col: 0,
      snippet: "Type the subreddit name (e.g. r/SaaS)",
      documentContent: "r/",
      width: 200,
      height: 130,
    }),
    n({
      id: "reddit-research",
      type: "research",
      label: "Subreddit Research",
      col: 1,
      snippet: "Research subreddit rules and culture",
      researchQuery:
        "Research the subreddit specified in the context. Find: 1) Posting rules and restrictions (self-promotion limits, required flair, formatting rules, minimum karma/age requirements). 2) Community culture and tone (what gets upvoted vs downvoted). 3) Successful post patterns and formats. 4) Common reasons posts get removed by moderators. 5) Whether the subreddit allows product/launch posts and under what conditions.",
      outputConfig: {
        format: "structured",
        detail: "detailed",
        focusMode: "gather",
        audience: "general",
        tone: "neutral",
      },
      width: 240,
      height: 300,
    }),
    n({
      id: "reddit-drafter",
      type: "llm",
      label: "Post Drafter",
      col: 2,
      snippet: "Draft Reddit post from PRD",
      llmPresetId: "custom",
      llmObjective:
        "Draft a Reddit post based on the provided PRD and subreddit research. Follow these principles:\n\n1. NEVER sound like marketing copy — Reddit users downvote anything that feels like an ad\n2. Lead with the PROBLEM you solved, not your product\n3. Be authentic and conversational — write like a community member, not a brand\n4. Share genuine insights, lessons learned, or technical details that provide value even without clicking any link\n5. Follow all subreddit-specific rules from the research (flair, formatting, length limits)\n6. Include a clear, non-clickbait title\n7. If self-promotion rules require it, add appropriate disclaimers\n8. End with a genuine question or discussion prompt to encourage engagement\n\nOutput format:\n\nTITLE: [post title]\n\nFLAIR: [suggested flair if required]\n\nBODY:\n[full post body]\n\nCOMMENT: [optional first comment with links/details, if subreddit rules require links in comments rather than post body]",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "reddit-gate",
      type: "coherence-gate",
      label: "Rule Compliance",
      col: 3,
      snippet: "Check subreddit rule compliance",
      coherenceThreshold: 75,
      coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: false, styleMatch: true },
      coherenceStrictness: "strict",
      coherenceRetryCount: 2,
      coherencePrompt:
        "Evaluate this Reddit post draft against the subreddit rules and culture from context. Check: 1) Does it follow all posting rules (flair, formatting, length)? 2) Does the tone sound like a genuine community member, NOT marketing copy? 3) Is there value for readers even without any product link? 4) Would a moderator likely remove this? 5) Does the title avoid clickbait patterns? Score below threshold if any rule violation is detected or if the post reads as promotional spam.",
      width: 160,
      height: 160,
    }),
    n({
      id: "reddit-polish",
      type: "llm",
      label: "Final Polish",
      col: 4,
      snippet: "Polish formatting for Reddit",
      llmPresetId: "custom",
      llmObjective:
        "Polish this Reddit post for final submission. Ensure:\n1. Reddit markdown formatting (bold, bullet points, headers use Reddit syntax)\n2. Appropriate paragraph breaks for readability (Reddit users skip walls of text)\n3. Title is compelling but not clickbait (under 300 chars)\n4. TL;DR section if the post exceeds ~200 words\n5. Any links use natural placement, not CTA-style\n6. Preserve the authentic, conversational tone\n\nOutput the final post exactly as it should be pasted into Reddit, with TITLE: and BODY: sections clearly separated.",
      llmStatus: "idle",
      width: 240,
      height: 160,
    }),
    n({
      id: "reddit-output",
      type: "social-post",
      label: "Reddit Post",
      col: 5,
      snippet: "Final Reddit-ready post",
      socialPlatforms: { x: false, linkedin: false, facebook: false, instagram: false, reddit: true },
      socialIntent: "thought-leadership",
      socialTone: "casual",
      socialGenerateImages: false,
      width: 240,
      height: 200,
    }),
  ],
  edges: [
    { fromNodeId: "reddit-subreddit", toNodeId: "reddit-research", role: "context" },
    { fromNodeId: "reddit-research", toNodeId: "reddit-drafter" },
    { fromNodeId: "reddit-drafter", toNodeId: "reddit-gate" },
    { fromNodeId: "reddit-gate", toNodeId: "reddit-polish" },
    { fromNodeId: "reddit-polish", toNodeId: "reddit-output" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Blueprint E: Inter-Office Communication
// ═══════════════════════════════════════════════════════════════

const interOfficeBlueprint: Blueprint = {
  id: "inter-office-comm",
  label: "Inter-Office Communication",
  description: "Pre-configured canvas for communication between two BSOffice installations with paired event buses and a bulletin board zone",
  icon: "Radio",
  category: "business",
  nodes: [
    // Zone for visual grouping
    n({
      id: "io-zone",
      type: "zone",
      label: "Inter-Office Channel",
      col: 0,
      row: 0,
      width: 900,
      height: 500,
      zoneColor: "cyan",
      zoneLabel: "Inter-Office Channel",
    }),
    // Office A publish
    n({
      id: "io-office-a-pub",
      type: "event-bus",
      label: "Office A (Publish)",
      col: 0,
      row: 0,
      snippet: "Send messages to Office B",
      eventBusMode: "publish",
      eventBusChannel: "inter-office",
      eventBusStatus: "idle",
      width: 220,
      height: 160,
    }),
    // Office A listen
    n({
      id: "io-office-a-listen",
      type: "event-bus",
      label: "Office A (Listen)",
      col: 0,
      row: 1,
      snippet: "Receive messages from Office B",
      eventBusMode: "listen",
      eventBusChannel: "inter-office-reply",
      eventBusStatus: "idle",
      width: 220,
      height: 160,
    }),
    // Office B publish
    n({
      id: "io-office-b-pub",
      type: "event-bus",
      label: "Office B (Publish)",
      col: 2,
      row: 0,
      snippet: "Send messages to Office A",
      eventBusMode: "publish",
      eventBusChannel: "inter-office-reply",
      eventBusStatus: "idle",
      width: 220,
      height: 160,
    }),
    // Office B listen
    n({
      id: "io-office-b-listen",
      type: "event-bus",
      label: "Office B (Listen)",
      col: 2,
      row: 1,
      snippet: "Receive messages from Office A",
      eventBusMode: "listen",
      eventBusChannel: "inter-office",
      eventBusStatus: "idle",
      width: 220,
      height: 160,
    }),
    // Bulletin board label
    n({
      id: "io-bulletin-label",
      type: "label",
      label: "Bulletin Board",
      col: 1,
      row: 0,
      width: 200,
      height: 40,
      labelFontSize: 18,
      labelBold: true,
    }),
    // Bulletin board document
    n({
      id: "io-bulletin-doc",
      type: "document",
      label: "Shared Bulletin",
      col: 1,
      row: 1,
      snippet: "Post announcements and shared updates here",
      documentContent: "# Inter-Office Bulletin Board\n\nPost shared announcements, updates, and notices between offices here.\n\n---\n",
      width: 200,
      height: 130,
    }),
  ],
  edges: [],
};

// ── All blueprints ──

export const BLUEPRINTS: Blueprint[] = [
  memeBlueprint,
  prdBlueprint,
  researchBlueprint,
  prdToRedditBlueprint,
  interOfficeBlueprint,
];

/**
 * Get a blueprint by ID. Returns null if not found.
 */
export function getBlueprint(id: string): Blueprint | null {
  return BLUEPRINTS.find((t) => t.id === id) ?? null;
}
