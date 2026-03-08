# Development Guide

## Quick Commands

```bash
npm install      # Install dependencies (REQUIRED before any other command)
npm run dev      # Start development server (Express + Vite HMR on port 5000)
npm run build    # Build for production (outputs to dist/)
npm run start    # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Push Drizzle schema to database
```

> **Important:** You must run `npm install` before `npm run check` or `npm run build`. Without full dependencies installed, TypeScript will report false errors like `Cannot find type definition file for 'node'` and `Cannot find type definition file for 'vite/client'`. These are **not real code errors** — they indicate missing `node_modules`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (auto-injected by Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit proxy base URL for OpenAI requests (auto-injected) |
| `ANTHROPIC_API_KEY` | Anthropic API key (or `ANTHROPIC_KEY`) |
| `GEMINI_API_KEY` | Google Gemini API key (via OpenAI-compatible endpoint) |
| `LLM_PROVIDER` | Force provider: `openai`, `gemini`, or `anthropic` (auto-detects by default) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_SECRET` | AES-GCM key for document encryption |
| `CLERK_PUBLISHABLE_KEY` | Clerk frontend authentication |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (for search, playlist, channel endpoints) |
| `PLAYWRIGHT_CHROMIUM_PATH` | Path to Chromium for screenshots |
| `STRIPE_SECRET_KEY_PROD` | Stripe secret key for payment processing |
| `STRIPE_PUBLISHABLE_KEY_PROD` | Stripe publishable key |
| `STRIPE_BUY_COFFEE_PRICE_ID` | Stripe Price ID for the "Buy a Coffee" product |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (starts with `whsec_`) |
| `AGENCY_API_KEY` | Marketing Agency API key |
| `AGENCY_USER_ID` | Marketing Agency user ID |

### Replit AI Integrations

OpenAI credentials are managed automatically via **Tools > AI Integrations** in Replit. When you enable OpenAI in that panel, Replit injects `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` into the server process environment. The LLM adapter in `server/llm.ts` auto-detects these variables.

## AIQA — QA Bug Tracking

The AIQA QA overlay is embedded in `client/index.html`. Environment variables are in `.env` (`AIQA_URL`, `AIQA_API_KEY`, `AIQA_PROJECT_ID`). MCP integration is in `.mcp.json` (uses `aiqastudio-mcp` package).

### Fetch bugs and feature requests

```bash
curl -H "X-API-Key: aiq_425865884d0ef800ba96bab750fc43f6" \
  "https://aiqastudio.replit.app/api/bugs?project_id=eacc71c9-f5f5-4d1b-a798-3f47b99a04da"
```

Filter options: `&submission_type=bug_report`, `&submission_type=feature_request`, `&status=open`, `&urgency=high`.

### Other AIQA API endpoints

```bash
# Check test results
GET https://aiqastudio.replit.app/api/projects/eacc71c9-f5f5-4d1b-a798-3f47b99a04da/results

# List test cases
GET https://aiqastudio.replit.app/api/test-cases?project_id=eacc71c9-f5f5-4d1b-a798-3f47b99a04da

# Stats overview
GET https://aiqastudio.replit.app/api/stats/overview?project_id=eacc71c9-f5f5-4d1b-a798-3f47b99a04da
```

All endpoints require `X-API-Key: {AIQA_API_KEY}` header.

### Update bug/feature status

```bash
curl -X PATCH -H "X-API-Key: aiq_425865884d0ef800ba96bab750fc43f6" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}' \
  "https://aiqastudio.replit.app/api/bugs/{BUG_ID}"
```

Valid statuses: `open`, `in_progress`, `resolved`, `closed`.

## Code Quality

When running `npm run check` or `npm run build`, **always fix all TypeScript errors** — including pre-existing ones in files you didn't change. Do not ignore or skip errors just because they existed before your changes. If a pre-existing error would take significant effort to fix, flag it to the user.

## Versioning

The project uses **semantic versioning** (`major.minor.patch`) tracked in `client/src/lib/version.ts`.

**Rules:**
- **We are pre-1.0.** Major version stays at `0` until stable release.
- **Patch bump (0.x.Y):** Bug fixes, UI tweaks, small improvements.
- **Minor bump (0.X.0):** New features, new node types, significant UI changes.
- **Major bump (X.0.0):** Reserved for breaking changes or major architectural shifts.

**Mandatory with every code change / git commit:**
1. Bump the version in `APP_VERSION` in `client/src/lib/version.ts`
2. Add a release note entry at the top of `RELEASE_NOTES`
3. Include the version in the git commit message

## Error Handling

- Zod validation on all API inputs
- Defensive null-checks in components
- Toast notifications for user feedback

## Build & Deployment — Replit

Replit is the sole build and deployment environment. Workflow:

1. Develop locally or in Claude Code
2. Push to GitHub (`git push`)
3. On Replit: click **Git Sync** to pull latest changes
4. On Replit: click **Deploy** to ship to production

**Deployment flow on Replit:**
1. Build (`npm run build`)
2. Replit runs `drizzle-kit push` (migration dialog shows here)
3. App starts (`node ./dist/index.cjs`) → `ensureTables()` runs

Keep `replit.md` accurate so the Replit environment works immediately after Git Sync.

### What `replit.md` must reflect

| Section | What to maintain |
|---------|-----------------|
| **Build & run** | Current npm commands |
| **Environment variables** | All required env var names (never values) |
| **Database** | PostgreSQL setup, migration commands |
| **Recent changes** | Dated entries for significant changes |

**Rules for `replit.md`:**
- Update whenever you change dependencies, env vars, build commands, or schema
- Never put secrets or API key values in `replit.md`
- Keep "Recent Changes" chronological (newest first), concise
- Match `.replit` config for ports, build commands, deployment targets

## Not Yet Implemented

- Testing framework (Jest/Vitest)
- CI/CD pipeline
- Structured logging
