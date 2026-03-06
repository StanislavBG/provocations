/**
 * ProjectOverview — Architectural reference page for team onboarding.
 *
 * Static page summarizing project architecture, design principles, key
 * patterns, ADRs, tech stack, and critical rules. Intended as the single
 * starting point for new team members reviewing the codebase.
 */

import { useLocation } from "wouter";
import { ArrowLeft, Server, Monitor, Database, Shield, Key, Layers, Brain, Eye, Code2, FileText, Palette, Mic, Lock, AlertTriangle, BookOpen, Sparkles, MessageCircleQuestion, Paintbrush, Clock, GitBranch, Bell, Upload, Filter, Share2, Wifi, ToggleRight, ShieldCheck, Merge, Timer, Type, SquareDashedBottom, Youtube } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvoIcon } from "@/components/ProvoIcon";
import { APP_VERSION } from "@/lib/version";

// ── Section component ──

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-serif font-bold mb-4 text-foreground border-b border-border/50 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-foreground/80 mb-2 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

// ── Table of Contents ──

const TOC = [
  { id: "philosophy", label: "Philosophy" },
  { id: "tech-stack", label: "Tech Stack" },
  { id: "architecture", label: "Architecture" },
  { id: "directory", label: "Directory Map" },
  { id: "workflow", label: "Core Workflow" },
  { id: "three-layer", label: "Three-Layer Contract" },
  { id: "flow-canvas", label: "Flow Canvas" },
  { id: "node-types", label: "Node Types" },
  { id: "personas", label: "Persona Hierarchy" },
  { id: "adrs", label: "ADRs" },
  { id: "api", label: "API Surface" },
  { id: "design-system", label: "Design System" },
  { id: "encryption", label: "Zero-Knowledge Encryption" },
  { id: "env-vars", label: "Environment Variables" },
  { id: "critical-rules", label: "Critical Rules" },
];

// ── Data ──

const TECH_STACK = [
  { layer: "Frontend", items: "React 18, TypeScript 5.6, Vite 7, Tailwind CSS 3.4, shadcn/ui (47 components)", icon: Monitor },
  { layer: "Backend", items: "Express 5.0, OpenAI / Gemini / Anthropic (configurable via LLM_PROVIDER)", icon: Server },
  { layer: "Database", items: "PostgreSQL via Drizzle ORM, AES-256-GCM zero-knowledge encryption", icon: Database },
  { layer: "Auth", items: "Clerk (authentication & user ownership)", icon: Key },
  { layer: "Validation", items: "Zod schemas shared between frontend/backend", icon: Shield },
  { layer: "State", items: "React Query (TanStack), React hooks, workspace context", icon: Layers },
  { layer: "Routing", items: "Wouter (lightweight client-side router)", icon: GitBranch },
  { layer: "Voice", items: "Web Speech API + custom audio worklets (browser-first)", icon: Mic },
];

const PERSONAS = [
  { domain: "Business", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", personas: [
    { id: "thinking_bigger", label: "Think Bigger", focus: "Scale impact: retention, cost-to-serve, accessibility" },
    { id: "ceo", label: "CEO", focus: "Mission-first: clarity, accountability, trust" },
    { id: "product_manager", label: "Product Manager", focus: "Business value: user stories, success metrics" },
  ]},
  { domain: "Technology", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", personas: [
    { id: "architect", label: "Architect", focus: "System design: boundaries, APIs, data flow" },
    { id: "data_architect", label: "Data Architect", focus: "Fit-for-purpose data, Key Ring, governance" },
    { id: "quality_engineer", label: "QA Engineer", focus: "Testing: edge cases, error handling, reliability" },
    { id: "ux_designer", label: "UX Designer", focus: "User flows: discoverability, accessibility, error states" },
    { id: "tech_writer", label: "Tech Writer", focus: "Documentation: clarity, naming, missing context" },
    { id: "security_engineer", label: "Security Engineer", focus: "Auth, data privacy, compliance" },
    { id: "cybersecurity_engineer", label: "Cybersecurity", focus: "Threat modeling, attack surface, defense-in-depth" },
  ]},
  { domain: "Marketing", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", personas: [
    { id: "growth_strategist", label: "Growth Strategist", focus: "Acquisition, activation, retention, funnel economics" },
    { id: "brand_strategist", label: "Brand Strategist", focus: "Positioning, differentiation, voice consistency" },
    { id: "content_strategist", label: "Content Strategist", focus: "Audience-channel fit, distribution, measurement" },
  ]},
];

const ADRS = [
  {
    title: "Always Use ProvokeText",
    summary: "All user-facing text display/editing MUST use ProvokeText — never raw <div>, <textarea>, or <pre>. Provides unified copy, voice, smart processing, and consistent styling.",
    file: "client/src/components/ProvokeText.tsx",
  },
  {
    title: "LLM Button Transparency",
    summary: "Every LLM-triggering button MUST be wrapped with LlmHoverButton. On hover, shows context blocks, token estimates, and cost before the call is made.",
    file: "client/src/components/LlmHoverButton.tsx",
  },
  {
    title: "Dual Schema Management",
    summary: "Database schema managed by Drizzle ORM (source of truth) AND ensureTables() runtime safety net. Both MUST stay in perfect sync. Mismatches cause recurring migration items on deploy.",
    file: "shared/models/chat.ts + server/db.ts",
  },
  {
    title: "Zero-Knowledge Encryption",
    summary: "All user text encrypted at rest with AES-256-GCM. Each field gets independent salt + IV. Server has no right to read plaintext — crypto at route boundaries only.",
    file: "server/crypto.ts",
  },
  {
    title: "Three-Layer App Contract",
    summary: "Every app template requires matching entries in prebuiltTemplates (UI), appWorkspaceConfig (behavior), and context-builder (LLM). TypeScript enforces completeness at build time.",
    file: "shared/schema.ts (TemplateId)",
  },
  {
    title: "Version Bump Required",
    summary: "Every code change / git commit requires bumping APP_VERSION and adding a RELEASE_NOTES entry. Patch for fixes, minor for features.",
    file: "client/src/lib/version.ts",
  },
];

const API_CATEGORIES = [
  { category: "AI Core", endpoints: [
    { method: "POST", path: "/api/generate-challenges", purpose: "Generate persona challenges" },
    { method: "POST", path: "/api/generate-advice", purpose: "Generate advice for a challenge" },
    { method: "POST", path: "/api/write", purpose: "Unified document editor (edit, expand, refine)" },
    { method: "POST", path: "/api/write/stream", purpose: "Streaming write for large documents (SSE)" },
    { method: "POST", path: "/api/summarize-intent", purpose: "Clean voice transcripts into clear intent" },
    { method: "POST", path: "/api/invoke", purpose: "Unified LLM invoke for any task type" },
  ]},
  { category: "Research Chat", endpoints: [
    { method: "POST", path: "/api/chat/stream", purpose: "Streaming research chat (SSE)" },
    { method: "POST", path: "/api/chat/summarize", purpose: "Summarize a research session" },
    { method: "GET", path: "/api/chat/models", purpose: "List available chat models" },
  ]},
  { category: "Interview", endpoints: [
    { method: "POST", path: "/api/interview/question", purpose: "Generate next interview question" },
    { method: "POST", path: "/api/interview/summary", purpose: "Synthesize interview into instructions" },
  ]},
  { category: "Storage", endpoints: [
    { method: "POST/GET", path: "/api/documents", purpose: "Save new / list user's documents (encrypted)" },
    { method: "GET/PUT/DELETE", path: "/api/documents/:id", purpose: "Load, update, delete document" },
    { method: "POST/GET", path: "/api/folders", purpose: "Create / list user's folders" },
  ]},
  { category: "Media", endpoints: [
    { method: "POST", path: "/api/generate-image", purpose: "Generate image from text prompt" },
    { method: "POST", path: "/api/tts", purpose: "Text-to-speech generation" },
    { method: "POST", path: "/api/transcribe", purpose: "Audio transcription" },
  ]},
  { category: "Admin", endpoints: [
    { method: "GET", path: "/api/admin/dashboard", purpose: "Analytics dashboard data" },
    { method: "GET", path: "/api/admin/user-metrics", purpose: "User metrics matrix" },
    { method: "POST", path: "/api/admin/sync-app-docs", purpose: "Sync per-app CLAUDE.md to store" },
  ]},
];

const ENV_VARS = [
  { name: "GEMINI_API_KEY", description: "Google Gemini API key (primary LLM provider)" },
  { name: "ANTHROPIC_API_KEY", description: "Anthropic API key (optional)" },
  { name: "LLM_PROVIDER", description: "Force provider: openai, gemini, or anthropic (auto-detects by default)" },
  { name: "DATABASE_URL", description: "PostgreSQL connection string" },
  { name: "ENCRYPTION_SECRET", description: "AES-GCM key for document encryption" },
  { name: "CLERK_PUBLISHABLE_KEY", description: "Clerk frontend authentication" },
  { name: "CLERK_SECRET_KEY", description: "Clerk backend secret key" },
];

const NODE_TYPES = [
  { type: "context-doc", badge: "Context", icon: FileText, accent: "amber", description: "Load documents from Context Store as input for workflows" },
  { type: "research", badge: "Research", icon: Sparkles, accent: "blue", description: "AI research chat with persistent conversations and configurable focus modes" },
  { type: "llm", badge: "Text Mods", icon: Brain, accent: "violet", description: "Apply text transformations: Summarize, Clean, Expand, or Custom instruction" },
  { type: "store", badge: "Save File", icon: BookOpen, accent: "primary", description: "Save content to Context Store for persistence across sessions" },
  { type: "painter", badge: "Painter", icon: Paintbrush, accent: "rose", description: "Generate images from text prompts using Gemini Imagen" },
  { type: "interview", badge: "Interview", icon: MessageCircleQuestion, accent: "cyan", description: "Guided Q&A sessions to build structured knowledge from user answers" },
  { type: "timeline", badge: "Timeline", icon: Clock, accent: "orange", description: "Create visual timelines from chronological content" },
  { type: "document", badge: "Document", icon: FileText, accent: "indigo", description: "Output containers for text produced by upstream nodes" },
  { type: "audio", badge: "Audio", icon: Mic, accent: "red", description: "Record audio with real-time browser speech-to-text transcription" },
  { type: "youtube", badge: "YouTube", icon: Youtube, accent: "red", description: "Extract metadata, transcripts, and chapters from YouTube videos" },
  { type: "upload", badge: "Upload", icon: Upload, accent: "sky", description: "Drag-and-drop file uploads (images, PDFs, text) for processing" },
  { type: "timer-event", badge: "Trigger", icon: Timer, accent: "teal", description: "Trigger downstream chains on a timer interval or manually" },
  { type: "filter", badge: "Filter", icon: Filter, accent: "yellow", description: "Evaluate conditions to pass or block content flow" },
  { type: "gate", badge: "Gate", icon: ToggleRight, accent: "yellow", description: "Manually open/close a content gate in the workflow" },
  { type: "coherence-gate", badge: "Coherence", icon: ShieldCheck, accent: "teal", description: "AI quality checkpoint — scores content against configurable checks and threshold" },
  { type: "router", badge: "Router", icon: GitBranch, accent: "yellow", description: "Route content to different output branches based on rules or labels" },
  { type: "merge", badge: "Merge", icon: Merge, accent: "yellow", description: "Combine multiple input streams into a single output" },
  { type: "social-post", badge: "Social", icon: Share2, accent: "pink", description: "Generate platform-specific social media posts from content" },
  { type: "api-connection", badge: "API Post", icon: Wifi, accent: "green", description: "Publish content to external APIs (X, LinkedIn, etc.)" },
  { type: "notification", badge: "Notify", icon: Bell, accent: "amber", description: "Send notifications when a chain completes" },
  { type: "label", badge: "Label", icon: Type, accent: "slate", description: "Text annotation placed on canvas for organization" },
  { type: "zone", badge: "Zone", icon: SquareDashedBottom, accent: "slate", description: "Visual grouping container — does not participate in data flow" },
];

const TEMPLATES = [
  { id: "write-a-prompt", title: "Write a Prompt", category: "write", layout: "standard", writer: "edit" },
  { id: "product-requirement", title: "Product Requirement", category: "build", layout: "standard", writer: "edit" },
  { id: "new-application", title: "New Application", category: "build", layout: "standard", writer: "edit" },
  { id: "streaming", title: "Screen Capture", category: "analyze", layout: "standard", writer: "edit" },
  { id: "persona-definition", title: "Persona / Agent", category: "write", layout: "standard", writer: "edit" },
  { id: "voice-capture", title: "Voice Capture", category: "capture", layout: "voice-capture", writer: "aggregate" },
  { id: "text-to-infographic", title: "Text to Infographic", category: "capture", layout: "infographic-studio", writer: "edit" },
  { id: "email-composer", title: "Email Composer", category: "write", layout: "standard", writer: "edit" },
  { id: "agent-editor", title: "Agent Editor", category: "build", layout: "standard", writer: "edit" },
  { id: "gpt-to-context", title: "GPT to Context", category: "capture", layout: "research-chat", writer: "aggregate" },
  { id: "bs-chart", title: "BS Chart", category: "build", layout: "bs-chart", writer: "edit" },
  { id: "timeline", title: "Timeline", category: "capture", layout: "timeline", writer: "edit" },
];

// ── Main Component ──

export default function ProjectOverview() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b shrink-0 px-6 py-3 flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <ProvoIcon className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold text-lg tracking-tight">Project Overview</span>
          <Badge variant="secondary" className="font-mono text-[10px]">v{APP_VERSION}</Badge>
        </div>
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-[10px] px-2 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-12">

          {/* ── Hero ── */}
          <Section id="philosophy" title="Philosophy">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
              <p className="text-lg font-serif italic text-foreground/80 mb-2">
                "Would you rather have a tool that thinks for you, or a tool that makes you think?"
              </p>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                Provocations is an AI-augmented document workspace where users iteratively shape ideas into
                polished documents through voice, text, and thought-provoking AI interactions. The AI doesn't
                write for you — it provokes deeper thinking so <em>you</em> write better.
              </p>
            </div>
          </Section>

          {/* ── Tech Stack ── */}
          <Section id="tech-stack" title="Tech Stack">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {TECH_STACK.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.layer} className="border-border/50">
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Icon className="w-4 h-4 text-primary" />
                        {item.layer}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.items}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Section>

          {/* ── Architecture ── */}
          <Section id="architecture" title="Architecture">
            <div className="bg-card border rounded-lg p-4 font-mono text-xs leading-relaxed overflow-x-auto">
              <pre className="text-muted-foreground">{`
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React + Vite)                          │
│                                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ FlowWorkspace │  │ NotebookWS    │  │ Context Store │  │ Admin     │ │
│  │ (canvas)      │  │ (3-panel)     │  │ (documents)   │  │ (metrics) │ │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                  │                   │                │       │
│  ┌──────┴──────────────────┴───────────────────┴────────────────┘      │
│  │ React Query + apiRequest() + SSE streams                    │       │
│  └──────────────────────────┬──────────────────────────────────┘       │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │  HTTP / SSE
┌─────────────────────────────┼───────────────────────────────────────────┐
│                    SERVER (Express 5)                                    │
│                              │                                          │
│  ┌───────────┐  ┌───────────┴───────────┐  ┌──────────────────────────┐│
│  │ Clerk Auth │  │ routes.ts (100+ API)  │  │ context-builder.ts       ││
│  │ middleware │  │  ├ /api/write          │  │ (per-app LLM prompts)   ││
│  └───────────┘  │  ├ /api/chat/stream    │  └──────────────────────────┘│
│                  │  ├ /api/documents      │                              │
│                  │  ├ /api/invoke         │  ┌──────────────────────────┐│
│                  │  └ /api/admin/*        │  │ crypto.ts (AES-256-GCM) ││
│                  └───────────┬───────────┘  │ zero-knowledge encrypt   ││
│                              │               └──────────────────────────┘│
│  ┌───────────────────────────┴───────────────────────────────────────┐  │
│  │ llm.ts — configurable provider (Gemini / Anthropic / OpenAI)      │  │
│  │          auto-discovers models at startup, stream + generate API   │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                     DATABASE (PostgreSQL)                                │
│  Drizzle ORM + ensureTables() dual schema                               │
│  ┌────────────┐ ┌───────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │ documents   │ │ folders   │ │ connections  │ │ userPreferences      ││
│  │ (encrypted) │ │(encrypted)│ │ conversations│ │ trackingEvents       ││
│  └────────────┘ └───────────┘ │ messages     │ │ personaVersions      ││
│                                └──────────────┘ └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
`}</pre>
            </div>
          </Section>

          {/* ── Directory Map ── */}
          <Section id="directory" title="Directory Map">
            <div className="bg-card border rounded-lg p-4 font-mono text-[11px] leading-relaxed overflow-x-auto">
              <pre className="text-muted-foreground">{`provocations/
├── client/src/
│   ├── pages/                    # Page components (FlowWorkspace, NotebookWorkspace, Admin, etc.)
│   ├── components/
│   │   ├── ui/                   # 47 shadcn/ui primitives (Radix-based)
│   │   ├── notebook/             # Notebook layout (panels, research chat, provo thread, etc.)
│   │   ├── flow/                 # Flow canvas (nodes, edges, overlays, lifecycle handlers)
│   │   │   ├── expanded/         # Full-view overlay components for each node type
│   │   │   ├── lifecycles/       # Node execution handlers (research, llm, painter, etc.)
│   │   │   └── FlowNodeRegistry  # Single source of truth for all node definitions
│   │   ├── bschart/              # BS Chart visual diagramming tool
│   │   └── ftux/                 # First-time user experience shell
│   ├── hooks/                    # Custom React hooks (voice, role, favorites)
│   └── lib/                      # Utilities, configs, templates, feature flags
│       ├── prebuiltTemplates.ts  # Layer 1: App UI identity (title, icon, description)
│       ├── appWorkspaceConfig.ts # Layer 2: Workspace behavior (layout, panels, writer mode)
│       ├── queryClient.ts        # React Query config + API helpers
│       ├── componentRegistry.ts  # Component wiki metadata
│       └── version.ts            # APP_VERSION + RELEASE_NOTES
├── server/
│   ├── routes.ts                 # All API endpoints (100+)
│   ├── llm.ts                    # Configurable LLM provider
│   ├── context-builder.ts        # Layer 3: Per-app LLM system prompts
│   ├── crypto.ts                 # AES-256-GCM encryption/decryption
│   ├── storage.ts                # Database operations (Drizzle ORM)
│   └── db.ts                     # DB connection + ensureTables()
├── shared/
│   ├── schema.ts                 # Zod schemas, TemplateId, types (source of truth)
│   ├── personas.ts               # 14 built-in persona definitions
│   └── models/chat.ts            # Drizzle table definitions
└── apps/*/CLAUDE.md              # Per-app documentation (12 apps)`}</pre>
            </div>
          </Section>

          {/* ── Core Workflow ── */}
          <Section id="workflow" title="Core Workflow — The Iterative Loop">
            <div className="bg-card border rounded-lg p-6">
              <div className="font-mono text-xs text-center mb-4">
                <pre className="text-muted-foreground inline-block text-left">{`   START WITH IDEAS ──► AI ANALYZES ──► PROVOCATIONS
         ▲                                    │
         │                                    ▼
    DOCUMENT EVOLVES ◄── USER RESPONDS (voice/text)`}</pre>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center">
                {["Input: rough ideas, notes", "Analyze: AI generates challenges", "Respond: voice or text", "Merge: AI weaves into document", "Iterate: repeat until done"].map((step, i) => (
                  <div key={i} className="bg-muted/30 rounded-md p-2">
                    <span className="text-primary font-bold text-xs">{i + 1}.</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Three-Layer Contract ── */}
          <Section id="three-layer" title="Three-Layer App Contract">
            <p className="text-sm text-muted-foreground mb-4">
              Every application template is defined across three files that must stay in sync.
              The <code className="text-xs bg-muted/50 px-1 rounded">TemplateId</code> type enforces this at build time — missing entries cause TypeScript errors.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {[
                { layer: "Layer 1: UI Identity", file: "prebuiltTemplates.ts", fields: "title, icon, description, starter text, draft questions, category" },
                { layer: "Layer 2: Workspace Behavior", file: "appWorkspaceConfig.ts", fields: "layout, panel tabs, writer mode, auto-start interview" },
                { layer: "Layer 3: LLM Guidance", file: "context-builder.ts", fields: "system prompt, output format, feedback tone, document type" },
              ].map((l) => (
                <Card key={l.layer} className="border-border/50">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">{l.layer}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-[10px] text-muted-foreground font-mono mb-1">{l.file}</p>
                    <p className="text-[10px] text-muted-foreground">{l.fields}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <SubSection title="Application Templates">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">ID</th>
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Title</th>
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Category</th>
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Layout</th>
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Writer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEMPLATES.map((t) => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-1 px-2 font-mono text-primary">{t.id}</td>
                        <td className="py-1 px-2">{t.title}</td>
                        <td className="py-1 px-2"><Badge variant="outline" className="text-[9px] h-4">{t.category}</Badge></td>
                        <td className="py-1 px-2 font-mono text-muted-foreground">{t.layout}</td>
                        <td className="py-1 px-2 font-mono text-muted-foreground">{t.writer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SubSection>
          </Section>

          {/* ── Flow Canvas ── */}
          <Section id="flow-canvas" title="Flow Canvas Architecture">
            <p className="text-sm text-muted-foreground mb-4">
              The Flow Canvas (<code className="text-xs bg-muted/50 px-1 rounded">/</code>, <code className="text-xs bg-muted/50 px-1 rounded">/flow</code>) is the primary workspace — an infinite canvas where users build processing flows by placing and connecting nodes from the dock.
            </p>

            <SubSection title="Dual-View Pattern (Mandatory)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="border-border/50">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="flex items-center gap-2 text-xs">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                      Compact View (on canvas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 text-[11px] text-muted-foreground">
                    Small card with type badge, label, content snippet. Draggable, deletable, connectable. Adding from dock places in compact view only.
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="flex items-center gap-2 text-xs">
                      <Eye className="w-3 h-3 text-primary" />
                      Full View (double-click overlay)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 text-[11px] text-muted-foreground">
                    Full interactive experience (chat, image gen, interview). Changes persist back to the node. Closing returns to canvas.
                  </CardContent>
                </Card>
              </div>
            </SubSection>

            <SubSection title="Edge / Connection System">
              <p className="text-[11px] text-muted-foreground mb-2">
                Nodes connect via <code className="bg-muted/50 px-1 rounded">FlowEdge</code> objects. Edges can carry roles:
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">objective — what to do</Badge>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">context — background material</Badge>
                <Badge className="bg-violet-500/15 text-violet-600 border-violet-500/30 text-[10px]">output-format — template/schema</Badge>
                <Badge className="bg-muted/50 text-muted-foreground border-border/50 text-[10px]">plain (no role) — raw input</Badge>
              </div>
            </SubSection>
          </Section>

          {/* ── Node Types ── */}
          <Section id="node-types" title="Node Types (22)">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {NODE_TYPES.map((nt) => {
                const Icon = nt.icon;
                return (
                  <div key={nt.type} className="flex items-start gap-2 p-2 rounded-md border border-border/30 hover:bg-muted/20">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{nt.badge}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{nt.type}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{nt.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── Persona Hierarchy ── */}
          <Section id="personas" title="Persona Hierarchy (14 Experts)">
            <p className="text-sm text-muted-foreground mb-3">
              Orchestrated by the <strong>Master Researcher</strong> (root). Personas refresh every 7 days.
              Each has separate challenge (identify gaps) and advice (actionable recommendations) prompts.
            </p>
            <div className="space-y-4">
              {PERSONAS.map((domain) => (
                <div key={domain.domain}>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${domain.color}`}>
                    {domain.domain} Domain
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {domain.personas.map((p) => (
                      <div key={p.id} className={`${domain.bg} rounded-md p-2 border border-transparent`}>
                        <span className="text-xs font-semibold">{p.label}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{p.focus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── ADRs ── */}
          <Section id="adrs" title="Architecture Decision Records">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ADRS.map((adr) => (
                <Card key={adr.title} className="border-border/50">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-primary" />
                      {adr.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-1">{adr.summary}</p>
                    <p className="text-[9px] font-mono text-muted-foreground/60">{adr.file}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          {/* ── API Surface ── */}
          <Section id="api" title="API Surface">
            <p className="text-sm text-muted-foreground mb-3">
              All endpoints use Zod validation. Document endpoints require Clerk authentication.
              Full list in <code className="text-xs bg-muted/50 px-1 rounded">server/routes.ts</code>.
            </p>
            <div className="space-y-4">
              {API_CATEGORIES.map((cat) => (
                <div key={cat.category}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat.category}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {cat.endpoints.map((ep) => (
                          <tr key={ep.path} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="py-1 px-2 w-24">
                              <Badge variant="outline" className="text-[8px] h-4 font-mono">{ep.method}</Badge>
                            </td>
                            <td className="py-1 px-2 font-mono text-primary">{ep.path}</td>
                            <td className="py-1 px-2 text-muted-foreground">{ep.purpose}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Design System ── */}
          <Section id="design-system" title="Design System">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Colors</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-primary" />
                    <span className="text-[11px]">Primary — Warm Amber (#B35C1E)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded" style={{ background: "hsl(200, 60%, 45%)" }} />
                    <span className="text-[11px]">Accent — Thoughtful Blue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-background border" />
                    <span className="text-[11px]">Background — Aged Paper</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-card border" />
                    <span className="text-[11px]">Card — Cream</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Typography</h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-serif text-sm">Libre Baskerville — Headings</p>
                    <p className="text-[10px] text-muted-foreground">Used for section titles and emphasis</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ fontFamily: "'Source Serif 4'" }}>Source Serif 4 — Body</p>
                    <p className="text-[10px] text-muted-foreground">Primary reading font throughout the app</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm">JetBrains Mono — Code</p>
                    <p className="text-[10px] text-muted-foreground">Technical content and code blocks</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Aesthetic</h4>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>Aged paper and ink warmth</li>
                  <li>Intellectual, not flashy</li>
                  <li>Dark mode supported</li>
                  <li>47 shadcn/ui components (Radix-based)</li>
                  <li>Tailwind CSS 3.4 utility-first</li>
                  <li>Icons: Lucide React</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* ── Encryption ── */}
          <Section id="encryption" title="Zero-Knowledge Encryption">
            <div className="bg-card border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                    <Lock className="w-3 h-3 text-primary" />
                    Algorithm Stack
                  </h4>
                  <ul className="text-[11px] text-muted-foreground space-y-1">
                    <li><strong>PBKDF2</strong> (SHA-256, 100k iterations) for key derivation</li>
                    <li><strong>AES-256-GCM</strong> for authenticated encryption</li>
                    <li><strong>IV:</strong> 12 bytes (per-field, random)</li>
                    <li><strong>Salt:</strong> 16 bytes (per-field, independent)</li>
                    <li><strong>Auth tag:</strong> 128-bit (AES-GCM default)</li>
                    <li>LRU key cache (2000 entries) avoids repeated PBKDF2</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                    <Shield className="w-3 h-3 text-primary" />
                    What's Encrypted
                  </h4>
                  <ul className="text-[11px] text-muted-foreground space-y-1">
                    <li>Document content (ciphertext + salt + iv)</li>
                    <li>Document titles (titleCiphertext + titleSalt + titleIv)</li>
                    <li>Folder names (nameCiphertext + nameSalt + nameIv)</li>
                    <li>Legacy plaintext fallback for backward compatibility</li>
                    <li>Server only handles opaque ciphertext</li>
                    <li>Encryption/decryption at route boundaries only</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Environment Variables ── */}
          <Section id="env-vars" title="Environment Variables">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Variable</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ENV_VARS.map((v) => (
                    <tr key={v.name} className="border-b border-border/30">
                      <td className="py-1.5 px-2 font-mono text-primary">{v.name}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{v.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── Critical Rules ── */}
          <Section id="critical-rules" title="Critical Rules">
            <div className="space-y-3">
              {[
                { icon: AlertTriangle, color: "text-red-500", title: "No OPENAI_API_KEY", desc: "This project does NOT have and will NOT have an OPENAI_API_KEY. Use GEMINI_API_KEY. Never write code that depends on OPENAI_API_KEY being present." },
                { icon: Mic, color: "text-blue-500", title: "Browser-First for Voice / Media", desc: "Voice capture and transcription must use browser-native APIs first (Web Speech API, MediaRecorder). LLM calls only for post-processing (summarization, intent cleaning)." },
                { icon: Code2, color: "text-amber-500", title: "Version Bump Required", desc: "Every code change / git commit requires bumping APP_VERSION and adding a RELEASE_NOTES entry. Patch for fixes, minor for features." },
                { icon: Palette, color: "text-green-500", title: "Maintain Component Wiki", desc: "When creating or significantly modifying a component, update componentRegistry.ts. The in-app wiki at /components depends on it." },
                { icon: Database, color: "text-violet-500", title: "Dual Schema Sync", desc: "Every database schema change must be reflected in BOTH shared/models/chat.ts (Drizzle) AND server/db.ts (ensureTables). Match index and constraint names exactly." },
                { icon: Shield, color: "text-primary", title: "Fix Pre-existing Errors", desc: "When running npm run check or npm run build, always fix ALL TypeScript errors — including pre-existing ones. Every check run should leave the codebase in a better state." },
              ].map((rule) => {
                const Icon = rule.icon;
                return (
                  <div key={rule.title} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                    <Icon className={`w-4 h-4 ${rule.color} shrink-0 mt-0.5`} />
                    <div>
                      <h4 className="text-xs font-semibold">{rule.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{rule.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Footer */}
          <div className="text-center py-8 text-[10px] text-muted-foreground/50">
            Provocations v{APP_VERSION} — Architecture Reference
          </div>
        </div>
      </main>
    </div>
  );
}
