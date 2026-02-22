/**
 * Per-app workspace configuration — the single source of truth for
 * how each application type behaves across the workspace.
 *
 * Maps the template selection (e.g. "write-a-prompt", "query-editor")
 * to workspace-level behaviors: flow steps, available panel tabs,
 * writer behavior, default toolbox, and interview auto-start.
 *
 * Add new entries here when a template needs distinct workspace behavior.
 */

import type { ProvocationType, TemplateId } from "@shared/schema";

// ---------------------------------------------------------------------------
// Panel tab types
// ---------------------------------------------------------------------------

/** Identifiers for left-panel (toolbox) tabs */
export type LeftPanelTabId = "provoke" | "website" | "context" | "analyzer" | "model-config";

/** Configuration for a single left-panel tab */
export interface LeftPanelTabConfig {
  id: LeftPanelTabId;
  label: string;
  description: string;
}

/** Identifiers for right-panel tabs */
export type RightPanelTabId = "discussion" | "metrics" | "discoveries" | "image-preview";

/** Configuration for a single right-panel tab */
export interface RightPanelTabConfig {
  id: RightPanelTabId;
  label: string;
}

// ---------------------------------------------------------------------------
// Flow step types
// ---------------------------------------------------------------------------

/** A single step in the application-specific workflow */
export interface FlowStepConfig {
  id: string;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Writer behavior types
// ---------------------------------------------------------------------------

/**
 * Writer mode — controls what the write action fundamentally does.
 *
 * "edit"      — Default. Rewrites/evolves the document based on instructions.
 * "analyze"   — Document stays immutable. Writer performs deep evaluation and
 *               surfaces structured feedback in the right panel (Discoveries).
 *               Reuses /api/analyze-query for SQL.
 * "aggregate" — Document grows additively. Writer appends new material and
 *               reorganizes under themes. Used for context-farming workflows.
 */
export type WriterMode = "edit" | "analyze" | "aggregate";

/** Per-application writer configuration */
export interface WriterBehaviorConfig {
  /** How the writer fundamentally behaves — edit, analyze, or aggregate */
  mode: WriterMode;
  /** Output format — "sql" routes to /api/query-write, "markdown"/"email" to /api/write */
  outputFormat: "markdown" | "sql" | "email";
  /** Document type label used in prompts (e.g. "SQL query", "product requirement") */
  documentType: string;
  /** Feedback tone override for challenges and advice */
  feedbackTone?: string;
}

// ---------------------------------------------------------------------------
// Objective configuration
// ---------------------------------------------------------------------------

/** Per-application objective label and behavior overrides */
export interface ObjectiveConfig {
  primaryLabel: string;
  primaryPlaceholder: string;
  primaryDescription?: string;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  secondaryDescription?: string;
  /** Show "Load from Context Store" button on the primary objective */
  showLoadFromStore?: boolean;
}

const DEFAULT_OBJECTIVE_CONFIG: ObjectiveConfig = {
  primaryLabel: "Objective",
  primaryPlaceholder: "What are you creating? Describe your objective...",
  secondaryLabel: "Secondary objective",
  secondaryPlaceholder: "Optional: a secondary goal, constraint, or perspective to keep in mind...",
  showLoadFromStore: false,
};

// ---------------------------------------------------------------------------
// Full application flow config
// ---------------------------------------------------------------------------

/**
 * Workspace layout — controls the top-level UI structure.
 *
 * "standard"      — Default 3-panel layout (toolbox | document | discussion).
 * "voice-capture" — Single-page voice recording workspace with auto-save.
 */
export type WorkspaceLayout = "standard" | "voice-capture";

export interface AppFlowConfig {
  /** Top-level workspace layout. Defaults to "standard" (3-panel). */
  workspaceLayout: WorkspaceLayout;
  /** Which toolbox tab to activate when entering the workspace */
  defaultToolboxTab: LeftPanelTabId;
  /** Whether to auto-start the interview (Provoke) on workspace entry */
  autoStartInterview: boolean;
  /** Personas to auto-start with when autoStartInterview is true */
  autoStartPersonas?: ProvocationType[];

  /** Application-specific workflow steps for the progress tracker */
  flowSteps: FlowStepConfig[];

  /** Available tabs in the left panel (toolbox). Order determines display order. */
  leftPanelTabs: LeftPanelTabConfig[];

  /** Available tabs in the right panel. Order determines display order. */
  rightPanelTabs: RightPanelTabConfig[];

  /** Writer behavior — output format, document type, tone */
  writer: WriterBehaviorConfig;

  /** App-specific objective labels and behavior. Falls back to DEFAULT_OBJECTIVE_CONFIG. */
  objectiveConfig?: ObjectiveConfig;
}

// ---------------------------------------------------------------------------
// Reusable tab definitions
// ---------------------------------------------------------------------------

const TAB_PROVOKE: LeftPanelTabConfig = {
  id: "provoke",
  label: "Provoke",
  description: "AI-driven interview with expert personas that challenge your thinking",
};

const TAB_WEBSITE: LeftPanelTabConfig = {
  id: "website",
  label: "Capture",
  description: "Browse websites, take screenshots, and annotate for requirements",
};

const TAB_CONTEXT: LeftPanelTabConfig = {
  id: "context",
  label: "Context",
  description: "View collected reference materials, templates, and supporting context",
};

const TAB_ANALYZER: LeftPanelTabConfig = {
  id: "analyzer",
  label: "Analyzer",
  description: "SQL query decomposition, optimization, and metrics extraction",
};

const RIGHT_DISCUSSION: RightPanelTabConfig = {
  id: "discussion",
  label: "Discussion",
};

const RIGHT_METRICS: RightPanelTabConfig = {
  id: "metrics",
  label: "Metrics",
};

const RIGHT_DISCOVERIES: RightPanelTabConfig = {
  id: "discoveries",
  label: "Discoveries",
};

const TAB_MODEL_CONFIG: LeftPanelTabConfig = {
  id: "model-config",
  label: "Model Config",
  description: "Configure LLM parameters: temperature, max tokens, and more",
};

const RIGHT_IMAGE_PREVIEW: RightPanelTabConfig = {
  id: "image-preview",
  label: "Image Preview",
};

// ---------------------------------------------------------------------------
// Default config — used by most prose-based templates
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AppFlowConfig = {
  workspaceLayout: "standard",
  defaultToolboxTab: "provoke",
  autoStartInterview: true,
  autoStartPersonas: ["thinking_bigger" as ProvocationType],

  flowSteps: [
    { id: "select", label: "Select Application", description: "Choose your document type" },
    { id: "draft", label: "Build Draft", description: "Provide context and generate your first draft" },
    { id: "edit", label: "Edit & Refine", description: "Use canvas tools to evolve your document" },
  ],

  leftPanelTabs: [TAB_PROVOKE, TAB_CONTEXT],

  rightPanelTabs: [RIGHT_DISCUSSION],

  writer: {
    mode: "edit",
    outputFormat: "markdown",
    documentType: "document",
  },
};

// ---------------------------------------------------------------------------
// Per-template overrides — only templates that differ from the default
// ---------------------------------------------------------------------------

const APP_CONFIGS: Record<TemplateId, AppFlowConfig> = {
  "write-a-prompt": {
    ...DEFAULT_CONFIG,
    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "draft", label: "Write Prompt", description: "Draft your prompt using the AIM framework" },
      { id: "edit", label: "Refine", description: "Sharpen clarity, structure, and specificity" },
    ],
    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "AI prompt",
      feedbackTone: "direct and clarity-focused",
    },
  },

  "query-editor": {
    workspaceLayout: "standard",
    defaultToolboxTab: "analyzer",
    autoStartInterview: true,
    autoStartPersonas: ["thinking_bigger" as ProvocationType],

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "paste", label: "Paste Query", description: "Paste your SQL and provide schema context" },
      { id: "analyze", label: "Analyze", description: "Decompose and understand query structure" },
      { id: "optimize", label: "Optimize", description: "Improve performance, readability, and correctness" },
    ],

    leftPanelTabs: [TAB_ANALYZER, TAB_PROVOKE, TAB_CONTEXT],

    rightPanelTabs: [RIGHT_DISCOVERIES, RIGHT_DISCUSSION, RIGHT_METRICS],

    writer: {
      mode: "analyze",
      outputFormat: "sql",
      documentType: "SQL query",
      feedbackTone: "constructive and non-judgmental",
    },
  },

  "product-requirement": {
    ...DEFAULT_CONFIG,
    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "context", label: "Share Context", description: "Describe the user, workflow, and problem" },
      { id: "draft", label: "Build PRD", description: "Generate your product requirement document" },
      { id: "challenge", label: "Challenge & Refine", description: "Let expert personas stress-test your spec" },
    ],
    objectiveConfig: {
      primaryLabel: "Overall Application Description",
      primaryPlaceholder: "Describe the application this feature belongs to — its purpose, users, and domain...",
      primaryDescription: "Stable context about your application. Load from Context Store if you've saved it before.",
      secondaryLabel: "Describe the Next Project",
      secondaryPlaceholder: "What specific feature, change, or project are you writing requirements for?",
      secondaryDescription: "The specific feature or change you're building requirements for right now.",
      showLoadFromStore: true,
    },
    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "product requirement document",
      feedbackTone: "rigorous but constructive",
    },
  },

  "new-application": {
    ...DEFAULT_CONFIG,
    leftPanelTabs: [TAB_PROVOKE, TAB_WEBSITE, TAB_CONTEXT],
    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "vision", label: "Define Vision", description: "Describe your app, users, and core value" },
      { id: "spec", label: "Build Spec", description: "Generate the full application specification" },
      { id: "challenge", label: "Challenge & Refine", description: "Stress-test architecture, UX, and business model" },
    ],
    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "application specification",
      feedbackTone: "thorough and questioning",
    },
  },

  streaming: {
    workspaceLayout: "standard",
    defaultToolboxTab: "website",
    autoStartInterview: false,
    autoStartPersonas: undefined,

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "capture", label: "Capture & Annotate", description: "Browse, screenshot, and annotate the target" },
      { id: "requirements", label: "Extract Requirements", description: "Transform observations into structured requirements" },
      { id: "refine", label: "Refine", description: "Iterate until the spec is crystal clear" },
    ],

    leftPanelTabs: [TAB_WEBSITE, TAB_PROVOKE, TAB_CONTEXT],

    rightPanelTabs: [RIGHT_DISCUSSION],

    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "requirements document",
      feedbackTone: "precise and detail-oriented",
    },
  },

  "research-paper": {
    ...DEFAULT_CONFIG,
    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "thesis", label: "Define Thesis", description: "State your research question and scope" },
      { id: "draft", label: "Research & Write", description: "Build the paper with evidence and methodology" },
      { id: "review", label: "Peer Review", description: "Expert personas challenge rigor and originality" },
    ],
    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "research paper",
      feedbackTone: "academic and rigorous",
    },
  },

  "persona-definition": {
    ...DEFAULT_CONFIG,
    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "identity", label: "Define Identity", description: "Establish the persona's role and archetype" },
      { id: "draft", label: "Build Profile", description: "Flesh out traits, motivations, and constraints" },
      { id: "test", label: "Consistency Test", description: "Challenge coherence and edge-case behavior" },
    ],
    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "persona definition",
      feedbackTone: "character-focused and consistency-driven",
    },
  },

  "research-context": {
    workspaceLayout: "standard",
    defaultToolboxTab: "context",
    autoStartInterview: true,
    autoStartPersonas: ["thinking_bigger" as ProvocationType],

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "capture", label: "Capture Sources", description: "Collect links, excerpts, and notes" },
      { id: "organize", label: "Organize & Synthesize", description: "Cross-reference and identify patterns" },
      { id: "gaps", label: "Find Gaps", description: "Identify what's missing and plan next steps" },
    ],

    leftPanelTabs: [TAB_CONTEXT, TAB_PROVOKE, TAB_WEBSITE],

    rightPanelTabs: [RIGHT_DISCUSSION],

    writer: {
      mode: "aggregate",
      outputFormat: "markdown",
      documentType: "research context library",
      feedbackTone: "analytical and gap-finding",
    },
  },

  "voice-capture": {
    workspaceLayout: "voice-capture",
    defaultToolboxTab: "provoke",
    autoStartInterview: false,
    autoStartPersonas: undefined,

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "record", label: "Recording", description: "Speak freely — transcript auto-saves every 30 seconds" },
    ],

    leftPanelTabs: [TAB_PROVOKE, TAB_CONTEXT],

    rightPanelTabs: [RIGHT_DISCUSSION],

    writer: {
      mode: "aggregate",
      outputFormat: "markdown",
      documentType: "voice capture transcript",
      feedbackTone: "clarifying and structure-focused",
    },
  },


  "youtube-to-infographic": {
    workspaceLayout: "standard",
    defaultToolboxTab: "context",
    autoStartInterview: false,
    autoStartPersonas: undefined,

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "channel", label: "Enter Channel", description: "Paste a YouTube channel URL to fetch videos" },
      { id: "transcript-summary", label: "Transcript & Summary", description: "Extract video transcripts and produce a rich, infographic-ready summary with key points, data, and actionable tips" },
      { id: "infographic", label: "Generate Infographic", description: "Transform the detailed summary into a structured visual specification" },
      { id: "refine", label: "Refine", description: "Challenge and polish the infographic specification" },
    ],

    leftPanelTabs: [TAB_PROVOKE, TAB_CONTEXT],

    rightPanelTabs: [RIGHT_DISCUSSION],

    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "infographic brief from YouTube content",
      feedbackTone: "visual-design-focused and data-driven",
    },
  },

  "email-composer": {
    ...DEFAULT_CONFIG,
    autoStartInterview: false,
    autoStartPersonas: undefined,

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "compose", label: "Compose Email", description: "Describe purpose and audience, then generate" },
    ],

    leftPanelTabs: [TAB_PROVOKE, TAB_CONTEXT],

    rightPanelTabs: [RIGHT_DISCUSSION],

    writer: {
      mode: "edit",
      outputFormat: "email",
      documentType: "business email",
      feedbackTone: "direct and professional — focus on clarity, tone, and actionability",
    },
  },

  "text-to-infographic": {
    workspaceLayout: "standard",
    defaultToolboxTab: "provoke",
    autoStartInterview: false,
    autoStartPersonas: undefined,

    flowSteps: [
      { id: "select", label: "Select Application", description: "Choose your document type" },
      { id: "describe", label: "Write Description", description: "Write the textual description of your infographic" },
      { id: "refine", label: "Persona Suggestions", description: "Expert personas suggest improvements to your description" },
      { id: "generate", label: "Generate Image", description: "Generate a visual from your finalized description" },
    ],

    leftPanelTabs: [TAB_PROVOKE, TAB_MODEL_CONFIG, TAB_CONTEXT],

    rightPanelTabs: [RIGHT_IMAGE_PREVIEW, RIGHT_DISCUSSION],

    writer: {
      mode: "edit",
      outputFormat: "markdown",
      documentType: "infographic brief from voice transcript",
      feedbackTone: "clarity-focused and visually structured",
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up the full flow config for a given template.
 * Falls back to DEFAULT_CONFIG for unknown or null IDs.
 */
export function getAppFlowConfig(
  templateId: string | null | undefined,
): AppFlowConfig {
  if (!templateId) return DEFAULT_CONFIG;
  return APP_CONFIGS[templateId as TemplateId] ?? DEFAULT_CONFIG;
}

/**
 * Look up the objective config for a given template.
 * Falls back to DEFAULT_OBJECTIVE_CONFIG for unknown or null IDs.
 */
export function getObjectiveConfig(
  templateId: string | null | undefined,
): ObjectiveConfig {
  const config = getAppFlowConfig(templateId);
  return config.objectiveConfig ?? DEFAULT_OBJECTIVE_CONFIG;
}

/**
 * @deprecated Use getAppFlowConfig instead. Kept for backward compatibility
 * during migration.
 */
export type AppWorkspaceConfig = Pick<
  AppFlowConfig,
  "defaultToolboxTab" | "autoStartInterview" | "autoStartPersonas"
>;

/**
 * @deprecated Use getAppFlowConfig instead.
 */
export function getAppWorkspaceConfig(
  templateId: string | null | undefined,
): AppWorkspaceConfig {
  const config = getAppFlowConfig(templateId);
  return {
    defaultToolboxTab: config.defaultToolboxTab,
    autoStartInterview: config.autoStartInterview,
    autoStartPersonas: config.autoStartPersonas,
  };
}
