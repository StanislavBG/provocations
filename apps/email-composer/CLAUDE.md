# Email Composer — App Guide

> **Template ID**: `email-composer` | **Category**: `write` | **Layout**: `standard`

## Purpose

Compose polished business emails quickly. Tone adapts to the described recipient (C-suite, peers, clients, direct reports). Uses a unique `email` output format (not markdown) that includes Subject line, greeting, body, and sign-off.

## Unique Behaviors

- **Unique output format**: Only app that uses `email` format — output includes Subject line structure
- **Recipient-adaptive tone**: System guidance adjusts formality based on described recipient
- **Anti-filler enforcement**: Explicitly forbids generic email openers ("I hope this email finds you well")
- **No auto-interview**: Emails are short — no interview warmup needed
- **No template**: Starts blank — user composes from scratch
- **Action-focused**: Every email must have a clear ask or next step
- **Minimal provocation sources**: Only 3 (vs. 5 for most apps) — emails are focused documents

See `docs/architecture.md` for the three-layer application pattern.
