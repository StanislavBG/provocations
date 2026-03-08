# Voice Capture — App Guide

> **Template ID**: `voice-capture` | **Category**: `capture` | **Layout**: `voice-capture` (unique)

## Purpose

Speak your ideas, structure them later. Users start by talking — the AI captures, cleans, and structures spoken thoughts into organized documents. Uses a completely different workspace layout (single-page recording interface) and aggregate writer mode. Ideal for brainstorming, meeting notes, and stream-of-consciousness ideation.

## Unique Behaviors

- **Unique workspace layout**: Only app that uses `voice-capture` layout — completely replaces standard 3-panel workspace
- **AGGREGATE writer mode**: Document only grows — each recording session appends, never overwrites
- **No auto-interview**: Users go straight to recording
- **Speaker voice preservation**: System guidance explicitly preserves the speaker's natural phrasing and tone
- **Action item extraction**: Automatically identifies and flags action items from spoken content
- **Configurable via admin**: Summary schedule and persist interval are admin-configurable

## Key Files

| Component | Path | Purpose |
|-----------|------|---------|
| `VoiceCaptureWorkspace` | `VoiceCaptureWorkspace.tsx` | Single-page voice recording workspace with Web Speech API |

## App-Specific Endpoints

- `GET /api/voice-capture-config` — Fetch voice capture config
- `GET /api/admin/voice-capture-config` — Admin config read
- `PUT /api/admin/voice-capture-config` — Admin config update

See `docs/architecture.md` for the three-layer application pattern.
