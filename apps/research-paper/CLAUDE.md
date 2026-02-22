# Research Paper — App Guide

> **Template ID**: `research-paper` | **Category**: `write` | **Layout**: `standard`

## Purpose

Guides users through writing **structured academic or exploratory research papers**. Follows the standard academic structure (Abstract through References) and uses personas that challenge thesis clarity, methodology rigor, evidence quality, and logical coherence. The AI acts as a rigorous peer reviewer, not a co-author.

## User Workflow

1. **Select** the Research Paper template from the landing page
2. **Define thesis** — What's the research question? Existing work? Methodology? Key findings?
3. **Auto-interview starts** with `thinking_bigger` persona
4. **Provoke tab** generates academic-style challenges (methodology gaps, weak evidence, logical fallacies)
5. **Iterate** — respond to challenges, paper evolves section by section
6. **Output** — A structured research paper: Abstract, Introduction, Literature Review, Methodology, Findings, Discussion, Conclusion, References

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Research Paper
- **Short Label**: Research Paper
- **Subtitle**: Structured academic or exploratory writing
- **Objective**: "Write a well-structured research paper with a clear thesis, supporting evidence, methodology, findings, and conclusions"
- **Draft Questions**:
  1. What is your research question or thesis?
  2. What existing work have you reviewed?
  3. What methodology are you using?
  4. What are your key findings so far?
- **Steps**: `[{ id: "context", label: "Share your context" }]`
- **Provocation Sources**: Peer Reviewer, Subject Matter Expert, Methodology Critic, Devil's Advocate, Curious Student
- **Template Content**: Full academic paper template:
  - Abstract
  - Introduction
  - Literature Review
  - Methodology
  - Findings
  - Discussion
  - Conclusion
  - References

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: `["thinking_bigger"]`
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "research paper"
  - Feedback Tone: "academic and rigorous"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "research paper"
- **Feedback Tone**: "academic and rigorous"
- **Output Format**: `markdown`
- **System Guidance**: Challenges thesis clarity, methodology rigor, evidence quality, and logical coherence. Pushes for literature review completeness, statistical validity, and clear contribution to the field.

## Components Used

All shared/standard components — no app-specific components.

## API Endpoints Used

All shared endpoints only.

## Key Behaviors

- **Academic tone**: Feedback and challenges use formal academic language
- **Template pre-populated**: Document starts with the full academic paper structure
- **Methodology focus**: Strong emphasis on challenging the "how" of the research, not just the "what"
- **Peer review simulation**: Provocation sources mimic an academic peer review panel
- **Evidence quality pressure**: Challenges specifically probe for weak citations, cherry-picked data, and unsupported claims
