export interface PrebuiltTemplate {
  id: string;
  title: string;
  shortLabel: string; // compact label for quick-select buttons
  subtitle: string;
  description: string;
  icon: string; // lucide icon name key
  objective: string;
  starterText: string;
  templateContent: string; // added as a reference document (empty = freeform)
  provocationSources: string[]; // who/what generates the provocations
  provocationExamples: string[]; // example provocations for the card preview
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
    templateContent: "", // No template — freeform is the point
    provocationSources: ["Clarity Coach", "Intent Detector"],
    provocationExamples: [
      "Is it clear enough for an AI to act on without asking follow-up questions?",
      "Who is the Actor here? You haven't defined what role the AI should take.",
      "What's the Mission? I see context but no clear task or expected output.",
    ],
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
  },
  {
    id: "streaming",
    title: "Streaming",
    shortLabel: "Streaming",
    subtitle: "Requirements via dynamic web exploration",
    description:
      "Discover requirements while referencing a live website or wireframe. An agent asks sequential questions — exploring pages, flows, and interactions — until your spec is crystal clear. The output is a markdown requirements document.",
    icon: "radio",
    objective:
      "Discover and refine requirements for a website through dynamic exploration and iterative questioning",
    starterText: "",
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
  },
  {
    id: "slide-video-script",
    title: "Slide Video Script",
    shortLabel: "Video Script",
    subtitle: "News or text into a cohesive video",
    description:
      "For turning a news article, blog post, or any text into a slide-based video script. Defines the narrative arc, slide-by-slide breakdown with visuals and voiceover, and pacing. The result is a production-ready script a video editor or AI tool can execute.",
    icon: "clapperboard",
    objective:
      "Write a cohesive slide-by-slide video script that transforms source text into an engaging visual narrative with voiceover, visuals, and pacing",
    starterText: "",
    templateContent: `# Slide Video Script

## Overview
### Source Material
What text, article, or content is this video based on?

### Video Purpose
What should the viewer understand, feel, or do after watching?

### Target Audience
Who is watching? What's their attention span and context?

### Tone & Style
Informational, dramatic, conversational, urgent, inspirational?

### Duration
Target length (e.g., 60s for social, 3–5 min for YouTube).

## Narrative Arc
### Hook (first 5 seconds)
What grabs attention immediately?

### Setup
Introduce the topic — what's the context or problem?

### Core Content
The main points, evidence, or story beats.

### Climax / Key Insight
The most important moment or revelation.

### Closing / Call to Action
What does the viewer do next?

## Slide-by-Slide Breakdown

### Slide 1 — Hook
- **On Screen**: Text, image, or animation description
- **Voiceover**: "Exact script for narration"
- **Duration**: X seconds
- **Transition**: Cut / fade / slide

### Slide 2 — Context
- **On Screen**: Visual description
- **Voiceover**: "Narration script"
- **Duration**: X seconds
- **Transition**: Type

### Slide 3 — Key Point
- **On Screen**: Visual description
- **Voiceover**: "Narration script"
- **Duration**: X seconds
- **Transition**: Type

### Slide N — Closing
- **On Screen**: Visual description
- **Voiceover**: "Narration script"
- **Duration**: X seconds
- **Transition**: Type

## Production Notes
### Music / Sound
Background music style, sound effects, or silence cues.

### Branding
Logo placement, brand colors, watermarks.

### Format
Aspect ratio (16:9, 9:16, 1:1), resolution, export format.`,
    provocationSources: [
      "Video Editor",
      "Audience Member",
      "Storytelling Coach",
      "Platform Strategist",
      "Fact Checker",
    ],
    provocationExamples: [
      "Slide 3 has 40 words of on-screen text. That's a paragraph, not a slide. What do you cut? — Video Editor",
      "I'm 10 seconds in and I still don't know what this video is about. Where's the hook? — Audience Member",
      "Your slides present facts in order, but there's no narrative tension. Why should I keep watching? — Storytelling Coach",
      "This is a 4-minute video for TikTok. Your audience will scroll away in 3 seconds. Rethink the format. — Platform Strategist",
      "The source article says 'reportedly' and 'according to sources.' Your script states it as fact. — Fact Checker",
    ],
  },
];
