export interface TemplateStep {
  id: string;
  label: string;
}

export interface PrebuiltTemplate {
  id: string;
  title: string;
  shortLabel: string; // compact label for quick-select buttons
  subtitle: string;
  description: string;
  icon: string; // lucide icon name key
  objective: string;
  starterText: string;
  draftQuestions: string[]; // probing questions shown in a side panel (not in the draft)
  templateContent: string; // added as a reference document (empty = freeform)
  provocationSources: string[]; // who/what generates the provocations
  provocationExamples: string[]; // example provocations for the card preview
  steps: TemplateStep[]; // workflow steps shown in the bottom progress bar
}

export const prebuiltTemplates: PrebuiltTemplate[] = [
  {
    id: "write-a-prompt",
    title: "Write a Prompt",
    shortLabel: "Prompt",
    subtitle: "AIM framework, any format",
    description:
      "For when you need to write a clear, high-quality prompt for an AI tool. Uses the AIM framework (Actor, Input, Mission) to structure your thinking. Write in whatever format feels natural — the AI will push you on clarity and structure so the resulting prompt gets the best possible output.",
    icon: "pencil-line",
    objective:
      "Write a clear, structured prompt using the AIM framework (Actor, Input, Mission) that an AI can execute with precision",
    starterText: "",
    draftQuestions: [
      "Who should the AI be? Define the role, expertise, or persona — the more specific you are, the better the output. (Actor)",
      "What does the AI need to know? Paste text, data, examples, or describe the situation and constraints it should work within. (Input)",
      "What should the AI produce? Be specific about the task, the format you want, and what a great result looks like. (Mission)",
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
    id: "product-requirement",
    title: "Product Requirement",
    shortLabel: "Feature PRD",
    subtitle: "Incremental feature, enterprise-grade",
    description:
      "For shipping an incremental feature in a software product. Uses a semi-structured format: who is the user, what's their workflow, what changes, and what does done look like. Provocations come from your toughest colleagues — the people who will poke holes in your spec before engineering starts.",
    icon: "clipboard-list",
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
    title: "New Application",
    shortLabel: "App from Scratch",
    subtitle: "Full SaaS spec from scratch",
    description:
      "Starting from zero? This mode walks you through the questions needed to build a complete requirement document for a new SaaS application. It starts broad (what problem, who's the user) and progressively drills into specifics (data model, auth, deployment). By the end, you'll have a spec an AI or a team can build from.",
    icon: "rocket",
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
    title: "Screen Capture",
    shortLabel: "Capture",
    subtitle: "Screenshots & annotations to requirements",
    description:
      "Capture screenshots, annotate them, and transform your observations into structured requirements. An agent asks sequential questions — exploring what you've captured — until the spec is crystal clear. The output is a markdown requirements document.",
    icon: "radio",
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
    title: "Research Paper",
    shortLabel: "Research Paper",
    subtitle: "Structured academic or exploratory writing",
    description:
      "For writing a research paper or structured analysis. Guides you through defining a thesis, reviewing existing work, presenting methodology and findings, and drawing conclusions. Provocations come from reviewers and peers who will challenge your rigor, originality, and clarity.",
    icon: "graduation-cap",
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
    id: "infographic-description",
    title: "Infographic Description",
    shortLabel: "Infographic",
    subtitle: "Visual content brief, ready for design",
    description:
      "For creating a detailed description of an infographic — the narrative, data points, visual hierarchy, and messaging. This document becomes the brief a designer or tool uses to produce the final visual. Provocations challenge you on clarity, data integrity, and whether the story actually works at a glance.",
    icon: "bar-chart-3",
    objective:
      "Write a clear infographic description covering the narrative, key data points, visual structure, and messaging so a designer can produce it without ambiguity",
    starterText: "",
    draftQuestions: [
      "What is the main message or story this infographic tells?",
      "Who is the target audience?",
      "What are the key data points or facts to highlight?",
      "What visual style or tone are you going for?",
    ],
    templateContent: `# Infographic Description

## Purpose & Goal
What is this infographic for? What action should the viewer take after seeing it?

## Target Audience
Who will see this? What do they already know, and what do they need to learn?

## Core Narrative
### Headline
The single attention-grabbing statement or question at the top.

### Story Arc
Walk through the infographic top-to-bottom: what does the viewer see first, second, third? What's the logical flow?

### Key Takeaway
The one thing the viewer should remember.

## Data & Content
### Key Data Points
| Stat / Fact | Source | Visual Treatment |
|-------------|--------|-----------------|
| data point | where it comes from | how to show it (chart, icon, number, etc.) |

### Supporting Text
Short captions or labels that accompany each visual section.

### Call to Action
What should the viewer do next? (visit a URL, share, download, etc.)

## Visual Structure
### Layout
Describe the overall layout: single column, sections, timeline, comparison, flowchart, etc.

### Sections (top to bottom)
1. **Section Name** — What it shows, what data it uses
2. **Section Name** — What it shows, what data it uses
3. **Section Name** — What it shows, what data it uses

### Color & Style
Color palette, fonts, brand guidelines, or mood references.

## Constraints
- Dimensions (e.g., 1080x1920 for social, A4 for print)
- File format requirements
- Accessibility considerations (color contrast, alt text)`,
    provocationSources: [
      "Graphic Designer",
      "Data Analyst",
      "Marketing Lead",
      "Distracted Scroller",
      "Accessibility Reviewer",
    ],
    provocationExamples: [
      "There are 12 data points here. An infographic should highlight 3–5 max. What do you cut? — Graphic Designer",
      "Where is this data from? Two of these stats don't have sources. — Data Analyst",
      "If I see this in a social feed, what makes me stop scrolling? The headline isn't doing it. — Marketing Lead",
      "I glanced at this for two seconds. I have no idea what it's about. — Distracted Scroller",
      "Your color-coded chart relies entirely on red vs. green. How does a colorblind viewer read this? — Accessibility Reviewer",
    ],
    steps: [{ id: "context", label: "Share your context" }],
  },
  {
    id: "persona-definition",
    title: "Persona / Agent",
    shortLabel: "Persona",
    subtitle: "Character, role, or AI agent profile",
    description:
      "For defining a persona, character, or AI agent in structured detail. Captures identity, motivations, behavioral traits, communication style, expertise, constraints, and interaction patterns. The output is a complete profile — usable as a character brief, user persona, or agent system prompt.",
    icon: "user-round-cog",
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
    id: "ai-video-host",
    title: "AI Video Host",
    shortLabel: "Video Host",
    subtitle: "Slide-show video with a presenter voice",
    description:
      "For creating a slide-show video script driven by a presenter persona or key story. You define who the host is (a cynical veteran, an excited educator, a cautionary narrator) and what they should focus on — the AI shapes the narration around that voice. Works best when you set a clear persona or analogy, define the target audience, constrain what to highlight, and command the structure.",
    icon: "monitor-play",
    objective:
      "Write a presenter-driven slide-show video script with a clear host voice, targeted audience, focused content, and commanded structure",
    starterText: "",
    draftQuestions: [
      "What is the source material? (news article, blog post, report, or raw notes)",
      "What persona or analogy should the AI host use? (e.g., 'a cynical industry veteran', 'an excited teacher', 'a cautionary tale narrator')",
      "Who is the target audience? (e.g., 'non-technical stakeholders who care about ROI', 'developers new to the framework')",
      "What should the AI focus on or ignore? (e.g., 'Focus on security risks in Source 3, ignore marketing sections')",
    ],
    templateContent: `# AI Video Host Script

## Source Material
### What is this video based on?
Paste or describe the source content (news article, blog post, report, raw notes).

### Video Purpose
What should the viewer understand, feel, or do after watching?

## Host Persona
### Who is the presenter?
Define the host's character, tone, and perspective. A persona or analogy makes the narration compelling rather than robotic.

Examples:
- "A cautionary tale narrator warning about what happens when you ignore technical debt"
- "A cynical industry veteran explaining why this project will fail without proper planning"
- "An excited teacher breaking down a complex topic for beginners"

### Voice & Tone
What's the emotional register? (urgent, witty, warm, authoritative, conspiratorial)

## Audience
### Who is watching?
Define the target audience — the AI adjusts vocabulary and depth based on this.

### What do they already know?
Prior knowledge, context, and assumptions.

### What do they care about?
ROI? Technical depth? Quick wins? Risk avoidance?

## Focus & Constraints
### What should the AI focus on?
Specific sections, data points, or themes to highlight from the source material.

### What should the AI ignore?
Sections, topics, or tangents to skip entirely.

### Key sources or data
If you have multiple sources, name which ones matter and what to extract from each.

## Structure
### Opening Hook (first 5–10 seconds)
What grabs the viewer immediately? A provocative question, a shocking stat, a "what if" scenario?

### Narrative Arc
How should the video flow? Define the structure explicitly:
1. Hook — grab attention
2. Context — set the scene
3. Key takeaways (3–5 max)
4. Climax / key insight
5. Call to action / closing

### Slide Breakdown

#### Slide 1 — Hook
- **On Screen**: Text, image, or animation description
- **Host says**: "Narration in the host's voice"
- **Duration**: X seconds
- **Transition**: Cut / fade / slide

#### Slide 2 — Context
- **On Screen**: Visual description
- **Host says**: "Narration"
- **Duration**: X seconds
- **Transition**: Type

#### Slide 3 — Takeaway
- **On Screen**: Visual description
- **Host says**: "Narration"
- **Duration**: X seconds
- **Transition**: Type

#### Slide N — Closing
- **On Screen**: Visual description
- **Host says**: "Narration"
- **Duration**: X seconds
- **Transition**: Type

## Production Notes
### Duration
Target length (60s social, 3–5 min YouTube, etc.)

### Platform
Where will this be published? (YouTube, LinkedIn, internal, TikTok)

### Music & Sound
Background music style, sound effects, or silence cues.

### Branding
Logo placement, brand colors, watermarks.

### Format
Aspect ratio (16:9, 9:16, 1:1), resolution, export format.`,
    provocationSources: [
      "The Audience",
      "Storytelling Coach",
      "Persona Critic",
      "Video Editor",
      "Fact Checker",
    ],
    provocationExamples: [
      "Your host persona says 'cautionary tale' but the script sounds like a product demo. Where's the tension? — Storytelling Coach",
      "You said the audience is non-technical, but Slide 3 uses three acronyms without explaining them. — The Audience",
      "Slide 3 has 40 words of on-screen text. That's a paragraph, not a slide. What do you cut? — Video Editor",
      "The host voice disappears after Slide 2 and becomes generic narration. Keep the persona consistent. — Persona Critic",
      "The source article says 'reportedly' and 'according to sources.' Your script states it as fact. — Fact Checker",
    ],
    steps: [{ id: "context", label: "Share your context" }],
  },
];
