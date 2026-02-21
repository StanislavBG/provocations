import type { ComponentType } from "react";
import {
  PencilLine,
  ClipboardList,
  Rocket,
  Radio,
  GraduationCap,
  UserRoundCog,
  DatabaseZap,
  BookOpenCheck,
  Mic,
  Youtube,
  FileAudio,
} from "lucide-react";

export interface TemplateStep {
  id: string;
  label: string;
}

export type TemplateCategory = "build" | "write" | "analyze" | "capture";

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
}

export const prebuiltTemplates: PrebuiltTemplate[] = [
  {
    id: "write-a-prompt",
    category: "write",
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
    id: "query-editor",
    category: "analyze",
    title: "Query Editor",
    shortLabel: "Query Analyzer",
    subtitle: "SQL analysis, schema-aware optimization",
    description:
      "For analyzing and optimizing complex SQL queries. Paste a query (and optionally your database schema) and the system breaks it into components — SELECT clauses, JOINs, subqueries — with explanations, optimization suggestions, and schema-aware insights. Provocations challenge your query's readability, performance, and correctness.",
    howTo: "Paste your SQL query into the text area. Optionally add your database schema (CREATE TABLE statements) as context. The system breaks your query into pieces — SELECT, JOINs, WHERE — explains each one, and suggests improvements for speed and readability.",
    useCases: [
      "Optimizing a slow database query before it goes to production",
      "Understanding a complex query someone else wrote",
      "Checking if your query has bugs or missing indexes",
    ],
    icon: DatabaseZap,
    objective:
      "Help the analyst groom their SQL query for performance, readability, and improved visibility. Provide constructive, non-judgmental feedback — frame suggestions as improvements, not criticisms. The document IS the SQL query itself.",
    starterText: "",
    draftQuestions: [
      "What database engine is this query for? (PostgreSQL, MySQL, SQL Server, Oracle, SQLite) — syntax and optimization advice depend on the dialect.",
      "Can you share the database schema? Paste a CREATE TABLE statement, a list of tables and columns, or describe the key tables and their relationships. Schema context makes analysis dramatically better.",
      "What does this query power? (a dashboard, a report, an API endpoint, a migration) — knowing the use case helps prioritize readability vs. raw performance.",
      "Are there known performance issues? Slow execution, timeouts, or lock contention? If so, which part of the query do you suspect?",
    ],
    templateContent: `# Query Analysis

## Original Query
Paste the full SQL query here.

\`\`\`sql
-- Your query goes here
\`\`\`

## Database Schema (Optional)
Provide the relevant schema — CREATE TABLE statements, a list of tables/columns, or a description of the data model.

\`\`\`sql
-- CREATE TABLE statements, column lists, or schema description
\`\`\`

## Query Context
### Purpose
What does this query do? What feature or report does it power?

### Database Engine
Which database? (PostgreSQL, MySQL, SQL Server, Oracle, SQLite)

### Known Issues
Any performance problems, incorrect results, or maintainability concerns?

## Component Breakdown
### Main SELECT
What columns are being selected and why?

### FROM / JOINs
What tables are involved? Are the join types (INNER, LEFT, etc.) correct?

### WHERE / Filtering
What conditions filter the results? Are they using indexes effectively?

### Subqueries
Are there nested queries? Can they be simplified or converted to JOINs/CTEs?

### GROUP BY / Aggregations
What is being aggregated? Are the grouping columns correct?

### ORDER BY / LIMIT
How are results sorted and paginated?

## Schema Validation
### Table & Column References
Do all referenced tables and columns exist in the schema?

### Type Mismatches
Are there implicit type conversions that could cause issues?

### Missing Indexes
Based on the schema, which columns used in WHERE/JOIN should be indexed?

## Optimization Suggestions
### Readability
- Formatting, aliasing, CTE extraction

### Performance
- Index usage, join order, subquery elimination

### Correctness
- Edge cases, NULL handling, off-by-one in pagination

## Rewritten Query
The improved version with explanations of what changed and why.

\`\`\`sql
-- Optimized query here
\`\`\`

## Version History
Track each modification with a brief description of what changed.`,
    provocationSources: [
      "DBA",
      "Query Planner",
      "Schema Guardian",
      "Code Reviewer",
      "Production Oncall",
    ],
    provocationExamples: [
      "This query scans the entire orders table. There's no index on the WHERE clause column — this will time out at scale. — DBA",
      "You're using a correlated subquery that executes once per row. Have you considered a CTE or a window function? — Query Planner",
      "The query references a column 'user_status' but your schema shows it's called 'status'. This will fail at runtime. — Schema Guardian",
      "There are 7 joins and no aliases. Nobody can review this. Break it into CTEs with meaningful names. — Code Reviewer",
      "This query runs every 30 seconds on a dashboard. At 200ms per execution, it's consuming 15% of your read replica. Is the result cacheable? — Production Oncall",
    ],
    steps: [{ id: "context", label: "Paste your query" }],
  },
  {
    id: "product-requirement",
    category: "build",
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
    id: "research-paper",
    category: "write",
    title: "Research Paper",
    shortLabel: "Research Paper",
    subtitle: "Structured academic or exploratory writing",
    description:
      "For writing a research paper or structured analysis. Guides you through defining a thesis, reviewing existing work, presenting methodology and findings, and drawing conclusions. Provocations come from reviewers and peers who will challenge your rigor, originality, and clarity.",
    howTo: "Start with your research question or thesis. Answer questions about existing literature, your methodology, and your findings. The system builds a structured paper with Abstract, Introduction, Literature Review, Methodology, Findings, Discussion, and Conclusion — then peer reviewers challenge your rigor.",
    useCases: [
      "Writing an academic paper with proper structure",
      "Organizing research findings into a coherent argument",
      "Preparing a structured analysis or white paper for work",
    ],
    icon: GraduationCap,
    objective:
      "Write a well-structured research paper with a clear thesis, supporting evidence, methodology, findings, and conclusions",
    starterText: "",
    draftQuestions: [
      "What is your research question or thesis?",
      "What existing work or literature is this building on?",
      "What methodology or approach are you using?",
      "What are your key findings or arguments?",
    ],
    templateContent: `# Research Paper

## Abstract
A concise summary (150–300 words) of the research question, methodology, key findings, and conclusions.

## Introduction
### Background
What is the broader context? Why does this topic matter?

### Problem Statement
What specific gap, question, or problem does this paper address?

### Thesis / Research Question
State your central argument or the question you are investigating.

### Scope
What is covered in this paper and what is explicitly excluded?

## Literature Review
### Existing Work
Summarize relevant prior research, theories, or frameworks.

### Gaps in Current Knowledge
What has not been adequately addressed by existing work?

### How This Paper Contributes
How does your work advance the field or fill the identified gaps?

## Methodology
### Approach
Describe the research method (qualitative, quantitative, mixed, theoretical, experimental, etc.).

### Data Sources
Where does the data or evidence come from?

### Limitations of the Method
What are the known constraints of your chosen approach?

## Findings / Results
### Key Findings
Present the main results, organized logically.

### Supporting Evidence
Data, examples, or analysis that back up each finding.

## Discussion
### Interpretation
What do the findings mean in the context of the research question?

### Implications
What are the practical or theoretical consequences?

### Limitations
What should the reader keep in mind when interpreting results?

## Conclusion
### Summary
Restate the key contributions in 2–3 sentences.

### Future Work
What questions remain open? What should be explored next?

## References
- List of cited works`,
    provocationSources: [
      "Peer Reviewer",
      "Subject Matter Expert",
      "Methodology Critic",
      "Devil's Advocate",
      "Curious Student",
    ],
    provocationExamples: [
      "Your thesis is broad. Can you narrow it to something testable or falsifiable? — Peer Reviewer",
      "You cite three sources but the field has dozens of competing frameworks. What are you leaving out? — Subject Matter Expert",
      "How would someone reproduce your methodology? There's not enough detail here. — Methodology Critic",
      "What if the opposite of your thesis is true? What evidence would you expect to see? — Devil's Advocate",
      "I don't understand why this matters. Can you explain the real-world impact in plain language? — Curious Student",
    ],
    steps: [{ id: "context", label: "Share your context" }],
  },
  {
    id: "persona-definition",
    category: "write",
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
    id: "research-context",
    category: "capture",
    title: "Research / Context",
    shortLabel: "Research",
    subtitle: "Capture, organize, and build context",
    description:
      "For building a rich context library around a topic. Capture links, excerpts, notes, and references — then let the AI help you organize, cross-reference, and identify gaps. The output is a structured research brief you can feed into any other app or project. Perfect for pre-work before writing a PRD, paper, or strategy doc.",
    howTo: "Add links, paste text excerpts, or upload files as context items. Describe what you're researching and what gaps you're trying to fill. The system organizes your sources, cross-references them, identifies contradictions and gaps, and produces a structured research brief.",
    useCases: [
      "Gathering background material before writing a PRD or proposal",
      "Organizing notes from multiple sources into one place",
      "Building a knowledge base for a project or decision",
    ],
    icon: BookOpenCheck,
    objective:
      "Build a structured research context by capturing, organizing, and cross-referencing sources, notes, and references into a coherent knowledge base",
    starterText: "",
    draftQuestions: [
      "What topic or question are you researching?",
      "What do you already know — paste existing notes, links, or excerpts?",
      "What are the key gaps in your understanding right now?",
      "How will this research be used? (feeding a PRD, writing a paper, informing a decision)",
    ],
    templateContent: `# Research Context

## Research Objective
What question are you trying to answer or what topic are you building context on?

## Key Questions
What specific questions need answers?
1.
2.
3.

## Sources & References
### Primary Sources
| Source | Type | Key Insight | Link |
|--------|------|-------------|------|
| name | article/paper/doc/interview | what it tells us | URL |

### Secondary Sources
Supporting materials, background reading, related work.

## Captured Notes
### From Reading
Key excerpts, highlights, and observations from sources.

### From Conversations
Notes from interviews, meetings, or discussions.

### From Observation
Screenshots, recordings, or first-hand observations.

## Themes & Patterns
What recurring themes, agreements, or contradictions emerge across sources?

## Knowledge Gaps
What's still unknown? What needs further research?

## Synthesis
### Key Findings
The most important things learned so far, organized by theme.

### Implications
What do the findings suggest for the next step?

### Recommendations
Based on the research, what should be done?

## Context Library
Organized collection of reusable context items that can be shared with other projects.`,
    provocationSources: [
      "Research Librarian",
      "Skeptical Reviewer",
      "Domain Expert",
      "Synthesis Coach",
      "Gap Finder",
    ],
    provocationExamples: [
      "You have 6 sources but they all say the same thing. Where's the opposing view? — Skeptical Reviewer",
      "Three of your sources are from 2019. Has anything changed since then? — Research Librarian",
      "You've captured a lot of facts but haven't synthesized them into insights. What does it all mean? — Synthesis Coach",
      "Your research objective is broad. Can you narrow it to something actionable? — Domain Expert",
      "You haven't addressed [specific subtopic]. That's a critical gap for your stated objective. — Gap Finder",
    ],
    steps: [{ id: "context", label: "Capture your sources" }],
  },
  {
    id: "voice-capture",
    category: "capture",
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
    id: "youtube-to-infographic",
    category: "capture",
    title: "YouTube to Infographic",
    shortLabel: "YouTube",
    subtitle: "Channel videos to visual summaries",
    description:
      "Input a YouTube channel URL and the system fetches the latest videos, extracts transcripts automatically, summarizes key points, tips, and advice, then generates a detailed infographic specification — all without manual intervention. Perfect for turning video knowledge into structured, shareable visual content.",
    howTo: "Paste a YouTube channel URL and describe what insights you're looking for. The system fetches the latest videos, extracts transcripts automatically, summarizes key points and tips, then generates a detailed infographic specification with sections, colors, and icons.",
    useCases: [
      "Turning a tutorial series into a shareable visual summary",
      "Extracting key tips from a thought leader's channel",
      "Creating infographic content from video research",
    ],
    icon: Youtube,
    objective:
      "Transform YouTube video content into structured infographic specifications by extracting transcripts, summarizing key insights, and generating visual layouts",
    starterText: "",
    draftQuestions: [
      "What YouTube channel do you want to extract insights from?",
      "Are you looking for tips, tutorials, or thought-leadership content?",
      "Who is the audience for the infographic — colleagues, social media, personal reference?",
      "Should the infographic focus on a single video or synthesize insights across multiple videos?",
    ],
    templateContent: `# Infographic Brief

## Source
### Channel
Channel name and URL

### Video(s)
| Video | Duration | Key Topic |
|-------|----------|-----------|
| title | length | main subject |

## Transcript Summary
### Key Points
The most important ideas from the video content, ranked by impact.

### Tips & Advice
Actionable takeaways the audience can apply immediately.

### Statistics & Data Points
Numbers, percentages, and data mentioned in the content.

## Infographic Layout
### Title & Subtitle
The headline and supporting tagline for the infographic.

### Sections
Each visual block in the infographic with heading, content, and suggested icon.

### Color Palette
Suggested colors that match the content tone and channel branding.

### Visual Hierarchy
How sections are ordered — most impactful insight first, supporting details below.

## Artifacts
- Transcript (auto-generated)
- Summary (auto-generated)
- Infographic Spec (auto-generated)`,
    provocationSources: [
      "Content Strategist",
      "UX Designer",
      "Data Journalist",
      "Visual Designer",
      "Accessibility Expert",
    ],
    provocationExamples: [
      "You extracted 12 key points but an infographic should focus on 3-5. Which ones actually matter? — Content Strategist",
      "The color palette doesn't account for colorblind users. Have you tested contrast ratios? — Accessibility Expert",
      "These are facts, not insights. What's the 'so what' — why should someone care about this data point? — Data Journalist",
      "The visual hierarchy is flat — every section looks equally important. What's the hero insight? — Visual Designer",
      "You summarized the video but lost the speaker's unique perspective. What made this content worth watching? — Content Strategist",
    ],
    steps: [
      { id: "channel", label: "Enter channel URL" },
      { id: "transcript-summary", label: "Transcript & summary" },
      { id: "infographic", label: "Generate infographic" },
    ],
  },
  {
    id: "text-to-infographic",
    category: "capture",
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
