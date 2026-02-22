# New Application — App Guide

> **Template ID**: `new-application` | **Category**: `build` | **Layout**: `standard`

## Purpose

Walks users through building a **complete specification for a new SaaS application** from scratch — from vision down to API endpoints, data model, and deployment strategy. Unlike `product-requirement` (incremental features), this is for greenfield apps. Includes website browsing/capture for competitive analysis.

## User Workflow

1. **Select** the New Application template from the landing page
2. **Define vision** — What does this app do? Who is it for? Core user actions? Business model?
3. **Auto-interview starts** with `thinking_bigger` persona
4. **Browse competitors** — Website/Capture tab allows inline browsing and screenshot annotation
5. **Provoke tab** generates challenges against scope, technical choices, user needs
6. **Iterate** — respond to challenges, spec evolves into a comprehensive document
7. **Output** — Full app specification covering Vision, Users, Flows, Features, Data Model, Tech Stack, APIs, UI/UX, Auth, Deployment

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: New Application
- **Short Label**: App from Scratch
- **Subtitle**: Full SaaS spec from scratch
- **Objective**: "Write a comprehensive application specification for a new SaaS product that covers users, features, technical architecture, and deployment"
- **Draft Questions**:
  1. What does this app do in one sentence?
  2. Who is the primary user?
  3. What are the core things a user can do?
  4. What's the business model?
- **Steps**: `[{ id: "context", label: "Share your context" }]`
- **Provocation Sources**: First-Time User, Investor, Technical Co-founder, Growth Marketer, Security Auditor
- **Template Content**: Full app specification template with sections:
  - Vision & Problem Statement
  - Target User Personas
  - Core User Flows
  - Feature Requirements (MVP vs Future)
  - Data Model & Schema
  - Tech Stack Decisions
  - API Design
  - UI/UX Wireframes
  - Authentication & Authorization
  - Deployment & Infrastructure

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: `["thinking_bigger"]`
- **Left Panel Tabs**: `[provoke, website, context]` — includes Website/Capture tab
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "application specification"
  - Feedback Tone: "thorough and questioning"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "application specification"
- **Feedback Tone**: "thorough and questioning"
- **Output Format**: `markdown`
- **System Guidance**: Comprehensive spec from scratch. Challenges assumptions about scope creep, technical choices (why this stack?), user needs (who exactly?), data model completeness, API surface area, and deployment strategy. Pushes for specificity in every section.

## Components Used

Shared components plus:
- `BrowserExplorer.tsx` — Embedded iframe for competitive website browsing (shared with `streaming`)
- `ScreenCaptureButton.tsx` — Screenshot + annotation workflow (via Website tab)

## API Endpoints Used

Shared endpoints plus:
- `POST /api/screenshot` — Server-side Playwright screenshot (for website capture)

## Key Behaviors

- **Greenfield focus**: System guidance assumes building from zero — no existing codebase or users
- **Website/Capture tab available**: Users can browse competitor sites inline and capture screenshots as context
- **Template pre-populated**: Document starts with the full specification structure
- **Broad persona coverage**: Provocation sources span user, investor, technical, marketing, and security perspectives
- **Scope pressure**: Challenges specifically push back on "MVP bloat" — features that aren't truly minimal
