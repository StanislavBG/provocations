# New Application — App Guide

> **Template ID**: `new-application` | **Category**: `build` | **Layout**: `standard`

## Purpose

Walks users through building a complete specification for a new SaaS application from scratch — from vision down to API endpoints, data model, and deployment strategy. Unlike `product-requirement` (incremental features), this is for greenfield apps. Includes website browsing/capture for competitive analysis.

## Unique Behaviors

- **Greenfield focus**: System guidance assumes building from zero — no existing codebase or users
- **Website/Capture tab available**: Users can browse competitor sites inline and capture screenshots as context
- **Template pre-populated**: Document starts with full specification structure (Vision, Users, Flows, Features, Data Model, Tech Stack, APIs, UI/UX, Auth, Deployment)
- **Broad persona coverage**: Provocation sources span user, investor, technical, marketing, and security perspectives
- **Scope pressure**: Challenges specifically push back on "MVP bloat"
- **Auto-interview**: Starts with `thinking_bigger` persona

## Key Files

- `BrowserExplorer.tsx` — Embedded iframe for competitive website browsing (shared with `streaming`)
- `ScreenCaptureButton.tsx` — Screenshot + annotation workflow
- `POST /api/screenshot` — Server-side Playwright screenshot

See `docs/architecture.md` for the three-layer application pattern.
