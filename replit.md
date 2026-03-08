# Provocations — Replit Deployment Guide

AI-augmented document workspace. See `CLAUDE.md` and `docs/` for full documentation.

## Build & Run

```bash
npm install      # Install dependencies
npm run dev      # Development server (Express + Vite HMR on port 5000)
npm run build    # Production build (outputs to dist/)
npm run start    # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Push Drizzle schema to database
```

## Deployment

**Target**: Autoscale. Build: `npm run build`. Deploy: `node ./dist/index.cjs`. Port 5000 internal → 80 external.

**Deploy flow:**
1. `npm run build`
2. Replit auto-runs `drizzle-kit push` (migration dialog shows here)
3. App starts → `ensureTables()` runs as safety net

**If migration items appear**: Run `npm run dev` briefly before deploying to trigger `ensureTables()`, then Deploy.

## Environment Variables

`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LLM_PROVIDER`, `DATABASE_URL`, `ENCRYPTION_SECRET`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `YOUTUBE_API_KEY`, `PLAYWRIGHT_CHROMIUM_PATH`, `STRIPE_SECRET_KEY_PROD`, `STRIPE_PUBLISHABLE_KEY_PROD`, `STRIPE_BUY_COFFEE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `AGENCY_API_KEY`, `AGENCY_USER_ID`

## Recent Changes

- March 8, 2026: v0.20.7 — AIQA widget fix, Store redesign, YouTube multi-video, custom tool groups
- March 8, 2026: v0.18.0 — Local Marketing Agency infrastructure (agency_events, agency_campaigns, MCP server, /api/agency/*, agency/ directory)
- March 1, 2026: Fixed recurring Drizzle migration items — aligned ensureTables() with Drizzle schema
- February 24, 2026: GPT-to-Context always uses Gemini 2.5 Flash independent of global LLM_PROVIDER
- February 24, 2026: Stripe payment integration (webhook, checkout, pricing page, payments table)
- February 22, 2026: Per-app CLAUDE.md documentation graph with admin sync endpoint
- February 21, 2026: Email Composer app, persistent app sidebar
- February 16, 2026: Switched LLM to Google Gemini with configurable provider abstraction
- February 1, 2026: Text-based editing via pencil icon
- January 29, 2026: Initial MVP
