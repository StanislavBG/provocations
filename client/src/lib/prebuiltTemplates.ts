export interface PrebuiltTemplate {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name key
  category: "engineering" | "product" | "communication";
  objective: string;
  starterText: string;
  templateContent: string; // added as a reference document
}

export const prebuiltTemplates: PrebuiltTemplate[] = [
  // === User's core use cases ===
  {
    id: "ai-prompt-engineering",
    title: "AI Prompt / System Instructions",
    description: "Craft clear, iterative prompts for Claude, GPT, or other LLMs to modify applications or perform complex tasks.",
    icon: "brain",
    category: "engineering",
    objective: "Write a precise, well-structured AI prompt with clear instructions, constraints, and examples",
    starterText: `[Describe what you want the AI to do here. Include:]

- The specific task or transformation you need
- The input the AI will receive
- The desired output format
- Any constraints or rules the AI must follow
- Edge cases to handle

Example context: "I need a prompt that takes a codebase description and generates a refactoring plan..."`,
    templateContent: `# AI Prompt Engineering Template

## Role & Identity
Define who the AI is in this context. What persona, expertise, or perspective should it adopt?

## Task Definition
State the core task clearly in 1-2 sentences. What does the AI need to accomplish?

## Input Specification
- What will the user provide?
- What format is the input in?
- What should the AI assume if information is missing?

## Output Specification
- What format should the response take?
- What sections, structure, or schema is expected?
- Length guidelines or constraints

## Rules & Constraints
- Hard rules the AI must never break
- Tone and style requirements
- What the AI should NOT do (negative constraints)

## Step-by-Step Process
1. How should the AI approach the task?
2. What should it analyze first?
3. What reasoning chain should it follow?

## Examples
Provide 1-2 input/output examples so the AI understands the expected behavior.

## Edge Cases
- What happens with ambiguous input?
- How should errors or missing data be handled?
- Fallback behaviors`,
  },
  {
    id: "product-requirements",
    title: "Product Requirements (PRD)",
    description: "Define incremental features with clear scope, user stories, and acceptance criteria.",
    icon: "clipboard-list",
    category: "product",
    objective: "Write a clear product requirements document for an incremental feature with defined scope and acceptance criteria",
    starterText: `[Describe the feature or improvement here. Include:]

- What problem does this solve?
- Who is the user?
- What does the current experience look like?
- What should change?`,
    templateContent: `# Product Requirements Document Template

## Problem Statement
What user problem or business need does this address? Include data or user feedback if available.

## Objective
One clear sentence: what does success look like when this ships?

## User Stories
- As a [user type], I want [goal] so that [benefit]
- As a [user type], I want [goal] so that [benefit]

## Scope
### In Scope
- Feature 1
- Feature 2

### Out of Scope
- What we're explicitly NOT building this iteration

## Detailed Requirements
### Functional Requirements
1. The system shall...
2. When the user...

### Non-Functional Requirements
- Performance: response time, throughput
- Security: auth, data handling
- Accessibility: WCAG compliance level

## Design & UX
- Key interaction patterns
- States: empty, loading, error, success
- Mobile considerations

## Technical Considerations
- API changes needed
- Database migrations
- Dependencies on other teams/services

## Acceptance Criteria
- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]

## Metrics & Success Criteria
- How will we measure if this worked?
- Target metrics and thresholds

## Rollout Plan
- Feature flags, % rollout, A/B test plan
- Rollback criteria`,
  },
  {
    id: "vibe-coding-spec",
    title: "Vibe Coding App Spec",
    description: "Describe a new application so an AI coding agent can build it from scratch.",
    icon: "rocket",
    category: "engineering",
    objective: "Write a comprehensive application specification that an AI coding agent can use to build the project from scratch",
    starterText: `[Describe the app you want to build. Include:]

- What is this app? (one sentence)
- Who is it for?
- What are the 3-5 core things a user can do?
- Any specific tech preferences (React, Python, etc.)?`,
    templateContent: `# Application Specification Template

## Project Overview
One paragraph: what is this app, who is it for, and why does it exist?

## Core User Flows
1. **[Flow Name]**: User does X → sees Y → achieves Z
2. **[Flow Name]**: User does X → sees Y → achieves Z
3. **[Flow Name]**: User does X → sees Y → achieves Z

## Feature Requirements
### Must Have (MVP)
- Feature with clear description
- Feature with clear description

### Nice to Have (V2)
- Feature with clear description

## Tech Stack
- **Frontend**: Framework, styling approach
- **Backend**: Language, framework, database
- **Auth**: Strategy (email/password, OAuth, etc.)
- **Deployment**: Where it runs (Vercel, Railway, etc.)

## Data Model
Describe the key entities and their relationships:
- **User**: fields, relationships
- **[Entity]**: fields, relationships

## API Design
Key endpoints or actions the backend needs to support:
- GET /api/... — description
- POST /api/... — description

## UI/UX Guidelines
- Visual style: minimal, corporate, playful, etc.
- Layout: sidebar nav, top nav, single page
- Key pages/screens and what's on each
- Responsive requirements

## Authentication & Authorization
- Who can sign up?
- What roles exist?
- What can each role access?

## External Integrations
- Third-party APIs (Stripe, SendGrid, etc.)
- OAuth providers
- Webhooks

## Deployment & Infrastructure
- Environment variables needed
- Build and run commands
- Database setup requirements`,
  },

  // === Additional pre-builts ===
  {
    id: "technical-design-doc",
    title: "Technical Design Document",
    description: "Document architecture decisions, system design, and implementation approach for engineering teams.",
    icon: "file-code",
    category: "engineering",
    objective: "Write a technical design document that explains the architecture, trade-offs, and implementation plan for an engineering initiative",
    starterText: `[Describe the technical problem or system you're designing. Include:]

- What are you building or changing?
- What's the current architecture?
- What constraints exist (scale, latency, cost)?`,
    templateContent: `# Technical Design Document Template

## Context & Motivation
What problem are we solving? Why now? Link to PRD or product context.

## Goals & Non-Goals
### Goals
- What this design achieves

### Non-Goals
- What this design explicitly does not address

## Current State
How does the system work today? Include diagrams if helpful.

## Proposed Design
### Architecture Overview
High-level description of the new design. How do components interact?

### Detailed Design
Walk through the implementation in enough detail that another engineer could build it.

### Data Model Changes
New tables, columns, indexes, migrations.

### API Changes
New or modified endpoints with request/response shapes.

## Alternatives Considered
| Approach | Pros | Cons | Why not chosen |
|----------|------|------|----------------|
| Alt 1 | | | |
| Alt 2 | | | |

## Trade-offs & Risks
- What are we trading off?
- What could go wrong?
- Mitigation strategies

## Rollout & Migration Plan
- How do we deploy this safely?
- Migration steps for existing data
- Feature flags, canary strategy

## Observability
- Key metrics to monitor
- Alerts to set up
- Logging and debugging approach

## Open Questions
- [ ] Decision needed on X
- [ ] Awaiting input from team Y`,
  },
  {
    id: "rfc-proposal",
    title: "RFC / Proposal",
    description: "Propose a change, process, or initiative and solicit structured feedback from stakeholders.",
    icon: "message-square-plus",
    category: "communication",
    objective: "Write a clear Request for Comments that proposes a change and invites structured feedback from stakeholders",
    starterText: `[Describe the change you're proposing. Include:]

- What do you want to change?
- Why is the current approach insufficient?
- Who does this affect?`,
    templateContent: `# RFC Template

## Summary
One paragraph: what is being proposed and why.

## Motivation
- What problem exists today?
- Who is affected and how?
- What evidence supports the need for change? (data, incidents, feedback)

## Proposal
Detailed description of the proposed change. Be specific enough that someone could implement or adopt this.

## Benefits
- Benefit 1 with expected impact
- Benefit 2 with expected impact

## Drawbacks & Risks
- Drawback 1 with mitigation
- Risk 1 with mitigation

## Alternatives Considered
What other approaches were evaluated? Why is this proposal better?

## Implementation Plan
- Phase 1: ...
- Phase 2: ...
- Timeline estimate

## Impact Assessment
- Teams affected
- Systems affected
- Migration or adoption effort

## Open Questions
Questions that need stakeholder input before finalizing.

## Feedback Requested By
[Date] — Please comment on [specific areas where input is needed].`,
  },
  {
    id: "user-research-synthesis",
    title: "Research Synthesis",
    description: "Turn raw user research, interviews, or survey data into structured, actionable insights.",
    icon: "search",
    category: "product",
    objective: "Synthesize raw user research into structured insights with clear themes, evidence, and actionable recommendations",
    starterText: `[Paste your raw research here: interview transcripts, survey responses, usability test notes, support tickets, etc.]

The more raw data you provide, the better the synthesis will be.`,
    templateContent: `# User Research Synthesis Template

## Research Overview
- Method: interviews / surveys / usability tests / analytics
- Participants: N users, segment description
- Date range: when the research was conducted
- Research questions: what we set out to learn

## Key Themes
### Theme 1: [Name]
- **Finding**: What did we observe?
- **Evidence**: Direct quotes, data points (at least 3 sources)
- **Severity/Frequency**: How common is this?

### Theme 2: [Name]
(same structure)

## User Segments & Patterns
- Segment A behaves differently from Segment B in [area]
- Power users vs. new users differ on [dimension]

## Surprises & Contradictions
- What was unexpected?
- Where did data contradict our assumptions?

## Recommendations
| Priority | Recommendation | Supporting Evidence | Effort |
|----------|---------------|-------------------|--------|
| P0 | | | |
| P1 | | | |
| P2 | | | |

## Raw Data Summary
- Total sessions/responses: N
- Key metrics: completion rate, satisfaction scores, etc.

## Next Steps
- What additional research is needed?
- What decisions can we make now vs. later?`,
  },
  {
    id: "api-documentation",
    title: "API Documentation",
    description: "Write clear, developer-friendly API docs with endpoints, schemas, and usage examples.",
    icon: "code",
    category: "engineering",
    objective: "Write clear, developer-friendly API documentation with endpoints, request/response schemas, authentication details, and usage examples",
    starterText: `[Describe your API here. Include:]

- What does this API do?
- What are the main resources/entities?
- Any existing endpoint definitions, OpenAPI specs, or code to reference?`,
    templateContent: `# API Documentation Template

## Overview
What this API does, who it's for, and the base URL.

## Authentication
- Auth method (API key, OAuth2, JWT)
- How to obtain credentials
- Header format: \`Authorization: Bearer <token>\`

## Common Patterns
- Pagination: how it works, parameters
- Error format: standard error response shape
- Rate limiting: limits, headers, retry guidance

## Endpoints

### [Resource Name]

#### List [Resources]
\`GET /api/v1/resources\`

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| limit | integer | No | Max results (default 20) |
| offset | integer | No | Pagination offset |

**Response:**
\`\`\`json
{
  "data": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
\`\`\`

#### Create [Resource]
\`POST /api/v1/resources\`

**Request Body:**
\`\`\`json
{
  "name": "string",
  "description": "string"
}
\`\`\`

**Response:** \`201 Created\`

## Error Codes
| Code | Meaning | Common Cause |
|------|---------|-------------|
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Too many requests |

## SDKs & Examples
Code examples in common languages showing typical usage patterns.

## Changelog
- v1.1: Added [endpoint]
- v1.0: Initial release`,
  },
  {
    id: "release-communication",
    title: "Release Notes & Changelog",
    description: "Communicate product changes clearly to users, stakeholders, or internal teams.",
    icon: "megaphone",
    category: "communication",
    objective: "Write clear release notes that communicate product changes, new features, and fixes to the appropriate audience",
    starterText: `[Describe what changed in this release. Include:]

- New features added
- Bugs fixed
- Breaking changes
- Performance improvements
- Any commit logs or PR descriptions to reference`,
    templateContent: `# Release Communication Template

## Release Title
[Product Name] v[X.Y.Z] — [One-line theme]

## Highlights
2-3 sentence summary of the most important changes for the reader.

## New Features
### [Feature Name]
Brief description of what it does and why users should care. Include screenshot or GIF if applicable.

### [Feature Name]
(same structure)

## Improvements
- Improvement with user-facing impact
- Improvement with user-facing impact

## Bug Fixes
- Fixed: [description of what was broken and how it's resolved]
- Fixed: [description]

## Breaking Changes
- **[Change]**: What changed, who is affected, migration steps

## Known Issues
- Issue description — workaround if available

## Technical Notes
For internal/engineering audience:
- Infrastructure changes
- Dependency updates
- Performance benchmarks

## Migration Guide
Step-by-step instructions for users affected by breaking changes.

## What's Next
Brief preview of upcoming work (optional, builds anticipation).`,
  },
  {
    id: "strategic-memo",
    title: "Strategic Memo",
    description: "Write executive-level memos with clear situation analysis, recommendations, and ask.",
    icon: "briefcase",
    category: "communication",
    objective: "Write a concise strategic memo with clear situation analysis, recommended actions, and a specific ask for decision-makers",
    starterText: `[Describe the situation or decision needed. Include:]

- What's the context?
- What decision needs to be made?
- What are the options?
- What do you recommend and why?`,
    templateContent: `# Strategic Memo Template

## To / From / Date
- **To**: [Decision-maker(s)]
- **From**: [Author]
- **Date**: [Date]
- **Re**: [Subject line — the decision needed]

## Executive Summary
3-5 sentences: the situation, the recommendation, and the ask. A busy executive should be able to read only this and know what you need.

## Situation
What's happening? Provide enough context for the reader to understand the landscape. Include relevant data, market dynamics, or internal factors.

## Analysis
### Option A: [Name]
- Description
- Pros
- Cons
- Estimated impact / cost

### Option B: [Name]
(same structure)

### Option C: [Name]
(same structure)

## Recommendation
Which option and why. Be direct. Connect to strategic priorities and include the reasoning chain.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| | | | |

## Resource Requirements
- Budget, headcount, timeline
- Dependencies on other teams/initiatives

## The Ask
Exactly what you need from the reader. Be specific: approval, budget, headcount, feedback by [date].

## Appendix
Supporting data, detailed analysis, or background material.`,
  },
];

export const templateCategories = [
  { id: "engineering" as const, label: "Engineering" },
  { id: "product" as const, label: "Product" },
  { id: "communication" as const, label: "Communication" },
];
