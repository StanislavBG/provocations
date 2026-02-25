import type { ComponentType } from "react";
import {
  PencilLine,
  ClipboardList,
  Rocket,
  Radio,
  UserRoundCog,
  DatabaseZap,
  BookOpenCheck,
  Mic,
  FileAudio,
  Mail,
  Workflow,
} from "lucide-react";

export interface TemplateStep {
  id: string;
  label: string;
}

export type TemplateCategory = "build" | "write" | "analyze" | "capture";

/** Status label shown next to each template in the sidebar and landing page */
export type TemplateStatusLabel = "try-it" | "beta" | "broken" | "untested" | "under-construction" | "alpha" | "under-dev";

/** Display config for each status label */
export const STATUS_LABEL_CONFIG: Record<TemplateStatusLabel, { text: string; className: string }> = {
  "try-it": {
    text: "Try it",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  beta: {
    text: "Beta",
    className: "text-amber-600 dark:text-amber-400",
  },
  alpha: {
    text: "Alpha",
    className: "text-blue-600 dark:text-blue-400",
  },
  "under-dev": {
    text: "Under Dev",
    className: "text-violet-600 dark:text-violet-400",
  },
  "under-construction": {
    text: "Back Burner",
    className: "text-orange-600 dark:text-orange-400",
  },
  broken: {
    text: "Broken",
    className: "text-red-500 dark:text-red-400",
  },
  untested: {
    text: "Untested",
    className: "text-muted-foreground",
  },
};

export interface PrebuiltTemplate {
  id: string;
  title: string;
  shortLabel: string; // compact label for quick-select buttons
  subtitle: string;
  description: string;
  /** Step-by-step instructions for a first-time user */
  howTo: string;
  /** Concrete examples of when to use this application */
  useCases: string[];
  icon: ComponentType<{ className?: string }>; // lucide icon component — single source of truth
  objective: string;
  starterText: string;
  draftQuestions: string[]; // probing questions shown in a side panel (not in the draft)
  templateContent: string; // added as a reference document (empty = freeform)
  provocationSources: string[]; // who/what generates the provocations
  provocationExamples: string[]; // example provocations for the card preview
  steps: TemplateStep[]; // workflow steps shown in the bottom progress bar
  category: TemplateCategory; // groups templates into tabbed categories on the landing page
  /** When true, the tile shows a "Coming Soon" badge and cannot be selected */
  comingSoon?: boolean;
  /** When set, clicking the tile opens this URL in a new tab instead of entering the workspace */
  externalUrl?: string;
  /** Status label indicating readiness (try-it, beta, broken, untested). Omit for comingSoon/external apps. */
  statusLabel?: TemplateStatusLabel;
}

export const prebuiltTemplates: PrebuiltTemplate[] = [
  {
    id: "write-a-prompt",
    category: "write",
    statusLabel: "alpha",
    title: "Write a Prompt",
    shortLabel: "Prompt",
    subtitle: "AIM framework, any format",
    description:
      "For when you need to write a clear, high-quality prompt for an AI tool. Uses the AIM framework (Actor, Input, Mission) to structure your thinking. Write in whatever format feels natural — the AI will push you on clarity and structure so the resulting prompt gets the best possible output.",
    howTo: "Type or dictate what you need an AI to do. The system will organize your words into three sections: Actor (who the AI should be), Input (the context it needs), and Mission (what it should produce). Answer the guided questions on the left to fill in each section.",
    useCases: [
      "Writing a ChatGPT prompt that gives consistent results",
      "Creating a reusable prompt template for your team",
      "Turning a vague idea into a specific AI instruction",
    ],
    icon: PencilLine,
    objective:
      "Write a clear, structured prompt using the AIM framework (Actor, Input, Mission) that an AI can execute with precision",
    starterText: "",
    draftQuestions: [
      "Who should I pretend to be? Think about who would be best at this task. If you want a recipe, the AI should be a \"Professional Chef.\" If you want to fix a bug, it should be a \"Senior Software Engineer.\"",
      "Tell me the story. Share the details — paste in a long email you need to reply to, or describe the problem you're trying to solve. The more \"clues\" you give me, the better the result will be.",
      "What are we making? Be specific about the final product. Do you want a 5-paragraph essay, a list of 10 ideas, or a friendly text message to a friend?",
    ],
    templateContent: "", // No template — freeform is the point
    provocationSources: ["Clarity Coach", "Intent Detector"],
    provocationExamples: [
      "Is it clear enough for an AI to act on without asking follow-up questions?",
      "Who is the Actor here? You haven't defined what role the AI should take.",
      "What's the Mission? I see context but no clear task or expected output.",
    ],
    steps: [{ id: "write", label: "Write your prompt" }],
  },
  {
    id: "gpt-to-context",
    category: "capture",
    statusLabel: "under-dev",
    title: "GPT to Context",
    shortLabel: "GPT Context",
    subtitle: "Research with AI, build structured context",
    description:
      "A focused research workspace where you converse with an AI researcher to explore a topic, capture key findings into your notes, and generate a clean summary aligned with your objective. Three panels: Notes (left), Researcher Chat (middle), and Objective Summary (right).",
    howTo: "Define what you want to research and what your objective is. Chat with the AI researcher in the middle panel. As useful insights emerge, capture them into your notes on the left. When ready, generate a summary on the right that distills your notes and conversation into a clean, objective-aligned output you can copy or save.",
    useCases: [
      "Exploring a new domain and building structured context for a project",
      "Gathering and organizing research findings into a reusable summary",
      "Preparing context before starting a PRD, strategy doc, or implementation plan",
    ],
    icon: BookOpenCheck,
    objective:
      "Research a topic through iterative conversation and build a clean, structured summary aligned with your objective",
    starterText: "",
    draftQuestions: [
      "What topic or question are you researching?",
      "What is the end goal — what will this research feed into?",
    ],
    templateContent: "",
    provocationSources: ["Research Analyst", "Synthesis Coach"],
    provocationExamples: [
      "What is your research objective? Define what you want to learn or discover.",
      "You have findings but haven't synthesized them. What does it all mean?",
      "Your notes cover breadth but lack depth on [topic]. Ask the researcher to go deeper.",
    ],
    steps: [{ id: "research", label: "Research & capture" }],
  },
  {
    id: "query-editor",
    category: "analyze",
    externalUrl: "https://QueryFlow.replit.app",
    title: "Query Editor",
    shortLabel: "QueryFlow",
    subtitle: "SQL analysis & optimization — opens QueryFlow",
    description:
      "Analyze and optimize SQL queries with schema-aware insights, performance recommendations, and query decomposition. Opens in QueryFlow — a dedicated query analysis application.",
    howTo: "Click to open QueryFlow in a new tab.",
    useCases: [
      "Optimizing a slow database query before it goes to production",
      "Understanding a complex query someone else wrote",
      "Checking if your query has bugs or missing indexes",
    ],
    icon: DatabaseZap,
    objective: "",
    starterText: "",
    draftQuestions: [],
    templateContent: "",
    provocationSources: [],
    provocationExamples: [],
    steps: [],
  },
  {
    id: "product-requirement",
    category: "build",
    statusLabel: "alpha",
    title: "Product Requirement",
    shortLabel: "Feature PRD",
    subtitle: "Incremental feature, enterprise-grade",
    description:
      "For shipping an incremental feature in a software product. Uses a semi-structured format: who is the user, what's their workflow, what changes, and what does done look like. Provocations come from your toughest colleagues — the people who will poke holes in your spec before engineering starts.",
    howTo: "Answer four questions: Who is the user? What do they do today? What's broken? What should the new experience look like? The system builds a structured requirements document from your answers, then expert personas challenge your assumptions before engineering starts.",
    useCases: [
      "Writing a feature spec before handing it to developers",
      "Defining acceptance criteria for a sprint ticket",
      "Documenting a bug fix with clear scope and edge cases",
    ],
    icon: ClipboardList,
    objective:
      "Write a clear product requirements document for an incremental feature with defined user, workflow, scope, and acceptance criteria",
    starterText: "",
    draftQuestions: [
      "Who is the user?",
      "What are they trying to do today?",
      "What's broken or missing?",
      "What should the new experience look like?",
    ],
    templateContent: `# Product Requirement

## Problem
What user problem or business need does this address?

## User
Who is the primary user? What's their role, context, and skill level?

## Current Workflow
How does the user accomplish this today? What's painful?

## Proposed Change
What specifically changes for the user? Walk through the new flow step by step.

## Scope
### In Scope
- What we're building this iteration

### Out of Scope
- What we're explicitly not building yet

## Acceptance Criteria
- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]

## Edge Cases & Error States
- What happens when things go wrong?
- What are the boundary conditions?`,
    provocationSources: [
      "The Architect",
      "VP of Engineering",
      "UX Designer",
      "Support Lead",
      "Confused Customer",
    ],
    provocationExamples: [
      "How does this interact with the existing auth flow? — The Architect",
      "What's the rollback plan if this breaks in prod? — VP of Engineering",
      "I'm a new user. How would I even discover this feature? — UX Designer",
      "Our support team gets 50 tickets/week on this flow. Does this make it better or worse? — Support Lead",
      "I clicked the button and nothing happened. What am I supposed to do now? — Confused Customer",
    ],
    steps: [{ id: "context", label: "Share your context" }],
  },
  {
    id: "new-application",
    category: "build",
    statusLabel: "alpha",
    title: "New Application",
    shortLabel: "App from Scratch",
    subtitle: "Full SaaS spec from scratch",
    description:
      "Starting from zero? This mode walks you through the questions needed to build a complete requirement document for a new SaaS application. It starts broad (what problem, who's the user) and progressively drills into specifics (data model, auth, deployment). By the end, you'll have a spec an AI or a team can build from.",
    howTo: "Describe your app idea in one sentence, then answer guided questions about users, features, and technology. The system progressively builds a full specification — from vision down to API endpoints and database schema — that a developer or AI can build from directly.",
    useCases: [
      "Turning a startup idea into a buildable technical spec",
      "Scoping a side project before writing any code",
      "Creating a brief for a freelance developer or agency",
    ],
    icon: Rocket,
    objective:
      "Write a comprehensive application specification for a new SaaS product that covers users, features, technical architecture, and deployment",
    starterText: "",
    draftQuestions: [
      "What does this app do in one sentence?",
      "Who is it for?",
      "What are the 3-5 core things a user can do?",
      "What's the business model (free, paid, freemium)?",
    ],
    templateContent: `# New Application Specification

## Vision
One paragraph: what is this app, who is it for, and why does it need to exist?

## Target User
- Who are they? (role, demographics, technical skill)
- What's their current workflow without this app?
- What's the primary pain point?

## Core User Flows
1. **[Flow Name]**: User does X, sees Y, achieves Z
2. **[Flow Name]**: User does X, sees Y, achieves Z
3. **[Flow Name]**: User does X, sees Y, achieves Z

## Feature Requirements
### Must Have (MVP)
- Feature with clear description

### Nice to Have (V2)
- Feature with clear description

## Data Model
Key entities and their relationships:
- **User**: fields, relationships
- **[Entity]**: fields, relationships

## Tech Stack
- **Frontend**: Framework, styling
- **Backend**: Language, framework, database
- **Auth**: Strategy (email/password, OAuth, magic link)
- **Hosting**: Where it runs

## API Design
Key endpoints the backend needs:
- GET /api/... — description
- POST /api/... — description

## UI/UX
- Visual style and layout
- Key pages/screens
- Mobile requirements

## Authentication & Authorization
- Sign-up flow
- Roles and permissions

## Deployment & Infrastructure
- Environment variables
- Build and run commands
- Database setup`,
    provocationSources: [
      "First-Time User",
      "Investor",
      "Technical Co-founder",
      "Growth Marketer",
      "Security Auditor",
    ],
    provocationExamples: [
      "I just landed on the homepage. Why should I sign up? — First-Time User",
      "What's your unfair advantage? Why can't someone build this in a weekend? — Investor",
      "You haven't mentioned how you handle data migrations or versioning. — Technical Co-founder",
      "How do users discover this? What's the acquisition channel? — Growth Marketer",
      "Where are you storing user data? What happens if there's a breach? — Security Auditor",
    ],
    steps: [{ id: "context", label: "Share your context" }],
  },
  {
    id: "streaming",
    category: "analyze",
    statusLabel: "alpha",
    title: "Screen Capture",
    shortLabel: "Capture",
    subtitle: "Screenshots & annotations to requirements",
    description:
      "Capture screenshots, annotate them, and transform your observations into structured requirements. An agent asks sequential questions — exploring what you've captured — until the spec is crystal clear. The output is a markdown requirements document.",
    howTo: "Optionally paste a website URL to load it in the built-in browser. Take screenshots, draw annotations on them, and describe what you see. An AI agent asks follow-up questions about your captures until the requirements document is complete.",
    useCases: [
      "Documenting UI bugs with annotated screenshots",
      "Capturing requirements from an existing website you want to improve",
      "Creating a visual spec for a redesign by marking up the current design",
    ],
    icon: Radio,
    objective:
      "Discover and refine requirements through captured screenshots, annotations, and iterative questioning",
    starterText: "",
    draftQuestions: [],
    templateContent: "",
    provocationSources: [
      "UX Researcher",
      "Product Manager",
      "Developer",
      "End User",
      "Accessibility Expert",
    ],
    provocationExamples: [
      "You've described the layout but not the user flow. What happens when someone clicks 'Sign Up'? — UX Researcher",
      "Which of these requirements are MVP vs. nice-to-have? Everything can't be P0. — Product Manager",
      "The wireframe shows a search bar but the requirements don't mention search. Is it functional or decorative? — Developer",
    ],
    steps: [{ id: "capture", label: "Capture & annotate" }],
  },
  {
    id: "persona-definition",
    category: "write",
    statusLabel: "under-construction",
    title: "Persona / Agent",
    shortLabel: "Persona",
    subtitle: "Character, role, or AI agent profile",
    description:
      "For defining a persona, character, or AI agent in structured detail. Captures identity, motivations, behavioral traits, communication style, expertise, constraints, and interaction patterns. The output is a complete profile — usable as a character brief, user persona, or agent system prompt.",
    howTo: "Name your persona and describe their role. Answer questions about their personality, expertise, communication style, and boundaries. The system builds a complete profile covering identity, motivations, behavior patterns, and example interactions — ready to use as an AI system prompt or character brief.",
    useCases: [
      "Creating a custom AI assistant with a specific personality",
      "Defining a user persona for product design",
      "Building a character profile for creative writing or games",
    ],
    icon: UserRoundCog,
    objective:
      "Write a complete, structured persona definition covering identity, motivations, expertise, behavioral traits, communication style, and constraints",
    starterText: "",
    draftQuestions: [
      "Who is this persona — what's their name, role, or archetype?",
      "What is their primary goal or mission?",
      "What makes them distinct — personality traits, quirks, or style?",
      "What are their boundaries or things they would never do?",
    ],
    templateContent: `# Persona Definition

## Identity
### Name / Label
What is this persona called?

### Role / Archetype
What role do they fill? (e.g., mentor, analyst, customer, support agent)

### One-Line Summary
Describe this persona in a single sentence.

## Background & Context
### Backstory
What shaped this persona? Relevant experience, history, or origin.

### Domain Expertise
What subjects, skills, or fields do they know deeply?

### Knowledge Boundaries
What do they explicitly not know or defer to others on?

## Personality & Behavior
### Core Traits
3–5 defining personality characteristics (e.g., analytical, empathetic, blunt, curious).

### Communication Style
How do they speak or write? Formal, casual, terse, verbose, humorous, dry?

### Tone & Voice
What emotional register do they default to? (e.g., warm and encouraging, sharp and direct)

### Decision-Making Style
How do they approach choices? (e.g., data-driven, intuitive, cautious, bold)

## Motivations & Goals
### Primary Objective
What is this persona trying to achieve?

### Secondary Goals
What else matters to them?

### Values
What principles guide their behavior?

## Constraints & Boundaries
### Things They Will Never Do
Hard limits on behavior, topics, or actions.

### Ethical Guidelines
Rules or principles they follow.

### Scope of Authority
What can they decide or do on their own vs. what requires escalation?

## Interaction Patterns
### How They Greet / Open
Typical way they start a conversation or interaction.

### How They Handle Conflict
What do they do when challenged or disagreed with?

### How They Handle Uncertainty
What do they say or do when they don't know something?

### How They Close / Sign Off
Typical way they end an interaction.

## Example Exchanges
### Example 1
- **User**: [typical input]
- **Persona**: [characteristic response]

### Example 2
- **User**: [edge case or challenge]
- **Persona**: [response showing personality under pressure]`,
    provocationSources: [
      "Character Designer",
      "Psychologist",
      "End User",
      "Red Teamer",
      "Consistency Checker",
    ],
    provocationExamples: [
      "You've listed traits but they don't cohere — 'empathetic' and 'blunt' without explaining how they balance. Which wins in a conflict? — Character Designer",
      "What's the underlying motivation? You described what they do, not why. People act from needs, not bullet points. — Psychologist",
      "I just interacted with this persona and it felt generic. What makes them different from a default chatbot? — End User",
      "What happens if someone asks this persona to do something outside its boundaries? You haven't defined the failure mode. — Red Teamer",
      "The communication style says 'casual' but the example exchange is formal. Which is it? — Consistency Checker",
    ],
    steps: [{ id: "context", label: "Share your context" }],
  },
  {
    id: "voice-capture",
    category: "capture",
    statusLabel: "alpha",
    title: "Voice Capture",
    shortLabel: "Voice",
    subtitle: "Speak your ideas, structure them later",
    description:
      "For when your ideas flow better out loud than on a keyboard. Start by talking — ramble, brainstorm, think out loud — and the AI captures, cleans, and structures your spoken thoughts into organized content. No typing required to get started. Perfect for early ideation, meeting summaries, brain dumps, or when you're on the go.",
    howTo: "Describe the session topic (e.g. 'team standup' or 'product brainstorm'), then click Start. Speak naturally — ramble, pause, think out loud. The system records, transcribes, and organizes your words into key points, action items, decisions, and a structured summary.",
    useCases: [
      "Turning a meeting into organized notes with action items",
      "Brain-dumping ideas on a walk and structuring them later",
      "Recording a user interview and extracting insights",
    ],
    icon: Mic,
    objective:
      "Capture spoken ideas and transform them into a structured, well-organized document that preserves the speaker's intent and key points",
    starterText: "",
    draftQuestions: [
      "What are you going to talk about? (Just a few words to set the context — e.g., 'my startup idea', 'feedback on the design', 'meeting notes from today')",
      "Who is the audience for the final document? (yourself, your team, a client, the public)",
      "What format should the output be? (bullet points, narrative, meeting minutes, action items)",
    ],
    templateContent: `# Voice Capture

## Session Context
What is this voice session about?

## Raw Transcript
The unedited voice capture goes here. The system will clean and organize it.

## Cleaned Notes
### Key Points
The main ideas extracted from the voice capture, in order of importance.

### Action Items
- [ ] Task with owner and deadline
- [ ] Task with owner and deadline

### Decisions Made
Explicit decisions stated during the capture.

### Questions Raised
Open questions that came up and need follow-up.

## Structured Summary
A coherent narrative version of the voice capture, organized by theme.

## Follow-Up
What needs to happen next based on this capture?`,
    provocationSources: [
      "Clarity Editor",
      "Intent Detector",
      "Structure Coach",
      "Devil's Advocate",
      "Action Tracker",
    ],
    provocationExamples: [
      "You said three different things about the timeline. Which one is the real deadline? — Clarity Editor",
      "You mentioned 'we should probably' four times but never committed. What are you actually going to do? — Action Tracker",
      "The first half of your capture contradicts the second half. Did you change your mind, or are these separate topics? — Intent Detector",
      "These are good ideas but they're scattered. What's the one main thing you're trying to say? — Structure Coach",
      "You sound very confident about this approach. What's the biggest risk you're not mentioning? — Devil's Advocate",
    ],
    steps: [{ id: "capture", label: "Record your thoughts" }],
  },
  {
    id: "text-to-infographic",
    category: "capture",
    statusLabel: "alpha",
    title: "Text to Infographic",
    shortLabel: "Text → Visual",
    subtitle: "Text descriptions to visual infographics",
    description:
      "Write a textual description of the infographic you want — layout, sections, data points, color palette — and generate a visual from it. Expert personas suggest improvements to your description before you generate. No design skills needed.",
    howTo: "Write or paste a textual description of your infographic — what it should contain, how it should look, who it's for. Expert personas will suggest refinements. When you're happy with the description, click Generate Image to create the visual.",
    useCases: [
      "Creating an infographic from a written brief or outline",
      "Describing a data visualization for a report or presentation",
      "Producing shareable visual content from text descriptions",
    ],
    icon: FileAudio,
    objective:
      "Create a detailed infographic from a textual description by refining the layout, data points, and visual design with expert persona suggestions",
    starterText: "",
    draftQuestions: [
      "What is the main topic or message of your infographic?",
      "What are the 2-3 key data points or sections it should contain?",
      "Who is the target audience — your team, clients, social media followers?",
      "What visual style are you going for — corporate, playful, minimalist, data-heavy?",
    ],
    templateContent: `# Infographic Description

## Overview
### Topic
What is this infographic about?

### Audience
Who will see this and what should they take away?

## Content Sections
### Hero Insight
The single most important point — the headline of the infographic.

### Supporting Points
2-5 key facts, tips, or data points that support the hero insight.

### Call to Action
What should the viewer do after seeing this?

## Visual Design
### Title & Subtitle
The headline and supporting tagline.

### Layout
Describe the visual flow — top to bottom, left to right, circular, etc.

### Color Palette
Suggested colors that match the tone and audience.

### Icons & Graphics
Key visual elements — charts, icons, illustrations, photos.

### Visual Hierarchy
How sections are ordered — most impactful insight first, supporting details below.`,
    provocationSources: [
      "Content Strategist",
      "UX Designer",
      "Clarity Editor",
      "Visual Designer",
      "Action Tracker",
    ],
    provocationExamples: [
      "The transcript is 45 minutes of conversation but your summary has 2 bullet points. What did you miss? — Clarity Editor",
      "These action items are vague — 'follow up with team' means nothing. Who does what by when? — Action Tracker",
      "You've summarized what was said but not what was decided. Where are the actual outcomes? — Content Strategist",
      "Every section uses the same visual weight. What's the single most important takeaway? — Visual Designer",
      "The infographic assumes context the audience doesn't have. Can someone outside the meeting understand this? — UX Designer",
    ],
    steps: [
      { id: "upload", label: "Upload transcript" },
      { id: "transcript-summary", label: "Transcript & summary" },
      { id: "infographic", label: "Generate infographic" },
    ],
  },
  {
    id: "email-composer",
    category: "write",
    statusLabel: "under-construction",
    title: "Email Composer",
    shortLabel: "Email",
    subtitle: "Business professional emails, fast",
    description:
      "For composing polished business emails quickly. Describe the purpose — a follow-up, a proposal, a difficult conversation — and optionally describe the recipients so the tone and framing adapt. The output is a ready-to-send email, not a document. Single-step: paste your objective, get a professional email.",
    howTo: "Describe the purpose of your email and who it's for. Optionally add context about the recipients (role, relationship, communication style) so the email adapts its tone. The system generates a business-professional email you can copy and send.",
    useCases: [
      "Writing a follow-up email after a client meeting",
      "Composing a proposal or partnership request to a stakeholder",
      "Drafting a difficult conversation — delivering bad news, pushing back on scope, or escalating an issue",
    ],
    icon: Mail,
    objective:
      "Compose a clear, professional business email that achieves the stated communication goal with appropriate tone for the audience",
    starterText: "",
    draftQuestions: [
      "What is the purpose of this email? (follow-up, request, proposal, update, escalation, introduction, etc.)",
      "Who are you sending this to? Describe their role, your relationship, and any relevant context about how they prefer to communicate.",
      "What's the key message or ask? What should the recipient do after reading this email?",
    ],
    templateContent: "",
    provocationSources: [
      "Communications Director",
      "Executive Assistant",
      "Recipient's Perspective",
    ],
    provocationExamples: [
      "Your subject line is vague. Would you open this email if you received 200 a day? — Communications Director",
      "You buried the ask in paragraph three. Busy people read the first two sentences. Move it up. — Executive Assistant",
      "I read this twice and I still don't know what you want me to do. What's the call to action? — Recipient's Perspective",
    ],
    steps: [{ id: "compose", label: "Compose your email" }],
  },
  {
    id: "agent-editor",
    category: "build",
    statusLabel: "under-construction",
    title: "Agent Editor",
    shortLabel: "Agent",
    subtitle: "Design multi-step AI workflows",
    description:
      "Design intelligent agent workflows with structured steps. Define a persona, chain Input → Actor → Output steps, monitor token usage, and test your agent — all in one place.",
    howTo: "1. Define your agent's persona and role. 2. Add steps — each with input, system prompt, and expected output. 3. Use the token counter to stay within model limits. 4. Run your agent to test the flow.",
    useCases: [
      "Building a research pipeline that summarizes → ranks → reports",
      "Creating a content workflow that outlines → drafts → edits",
      "Designing a data analysis chain that extracts → validates → visualizes",
    ],
    icon: Workflow,
    objective:
      "Design a multi-step AI agent workflow with clear input, processing, and output for each step",
    starterText: "",
    draftQuestions: [
      "What should this agent do? Describe the end-to-end task in plain language.",
      "What does the first step need as input? Is it user-provided or from another system?",
      "What should the final output look like? Text report, JSON data, a table?",
      "How many steps do you think this needs? Walk me through the chain.",
    ],
    templateContent: "",
    provocationSources: ["Workflow Architect", "Prompt Quality Reviewer"],
    provocationExamples: [
      "Step 2 expects JSON but Step 1 outputs plain text — how will you bridge that?",
      "Your system prompt is 3000 tokens — that leaves limited room for context. Can you tighten it?",
      "What happens if Step 1 returns empty results? Does Step 2 have a fallback?",
    ],
    steps: [
      { id: "define", label: "Define Agent" },
      { id: "steps", label: "Build Steps" },
      { id: "test", label: "Test & Refine" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Template categories — ordered for the landing page tab bar
// ---------------------------------------------------------------------------

export interface TemplateCategoryMeta {
  id: TemplateCategory;
  label: string;
  description: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategoryMeta[] = [
  { id: "build", label: "Build", description: "Product specs and technical documents" },
  { id: "write", label: "Write", description: "Creative content and structured writing" },
  { id: "analyze", label: "Analyze", description: "SQL queries and screen capture analysis" },
  { id: "capture", label: "Capture", description: "Research, context collection, and voice input" },
];

/**
 * Sort templates by usage count descending.
 * Usable apps come first (sorted by usage desc, ties preserve original array order).
 * comingSoon and externalUrl apps go to the bottom.
 */
export function sortTemplatesByUsage(
  templates: PrebuiltTemplate[],
  usage: Record<string, number>,
): PrebuiltTemplate[] {
  const usable: PrebuiltTemplate[] = [];
  const backBurner: PrebuiltTemplate[] = [];
  const bottom: PrebuiltTemplate[] = [];

  for (const t of templates) {
    if (t.comingSoon || t.externalUrl) {
      bottom.push(t);
    } else if (t.statusLabel === "under-construction") {
      // "Back Burner" items go below usable apps but above comingSoon/external
      backBurner.push(t);
    } else {
      usable.push(t);
    }
  }

  // Stable sort: usage desc, original array order as tiebreaker
  usable.sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0));

  return [...usable, ...backBurner, ...bottom];
}
