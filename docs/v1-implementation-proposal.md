# V1 Plan: Parallelizable Implementation Proposal

**Generated:** 2026-03-08
**Plan source:** v1-plan.zip (written 2026-03-07 at v0.16.12)
**Current version:** v0.21.2
**Execution model:** All streams in parallel, 10 independent streams

---

## Executive Summary

The v1-plan.zip contains 13 files across 10 tracks. The codebase has progressed from v0.16.12 to v0.21.2 — significant work has landed (viewport virtualization, FTUX tips, 25 node types, WebSocket canvas sync, keyboard shortcuts, LLM multi-provider routing) but critical gaps remain (no rate limiting, no security headers, no CI/CD, no billing/subscriptions, no test coverage, no health checks).

This document reorganizes the plan into **10 parallel execution streams** with clear file ownership boundaries. Each stream can be assigned to an independent agent without merge conflicts.

---

## Delta: What Changed Since v0.16.12

| Area | Plan State (v0.16.12) | Current (v0.21.2) | Status |
|------|----------------------|-------------------|--------|
| FlowWorkspace.tsx | 7,800 lines | 4,948 lines | Reduced ~37%, still monolithic |
| Node types | 17 | 25 registered | Expanded: timeline, input, output, filter, router, merge, coherence-gate, llm-base |
| Test infrastructure | Zero | 7 test files, Vitest configured | Partial — far from 60% coverage target |
| Rate limiting | None | None | **No progress** |
| Security headers | None | None | **No progress** |
| CI/CD pipeline | None | None | **No progress** |
| Stripe billing | Planned | Payment endpoints + webhook stub | Partial — no subscription/usage metering |
| Canvas collaboration | Basic broadcast | WebSocket rooms with ops + auto-save | Improved — no conflict resolution |
| Onboarding/FTUX | Underdeveloped | 20 tips, shell config, dock customization | Good progress |
| Viewport virtualization | None | Implemented (200px buffer) | **Done** |
| Keyboard shortcuts | Partial | 14 customizable actions + override system | **Done** |
| Health endpoints | None | None | **No progress** |
| Structured logging | None | Basic request logging | Minimal |
| Context management | Basic | 14 app-type configs, 11-section builder | Solid |
| Encryption | AES-256-GCM | Same + key_versions table | Maintained |
| LLM providers | Gemini only | Gemini + OpenAI + Anthropic with auto-detect | **Done** |
| Cost transparency | Planned | Per-call estimates + verbose metadata | **Done** |

---

## Stream Definitions (10 Parallel Streams)

### Stream A: Security Hardening

**Priority:** P0 | **Original tracks:** 3.1–3.6
**Goal:** Production-grade security posture before monetization goes live.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| A1 | Install `helmet`, configure CSP for Clerk/Gemini/OpenAI/Anthropic/ElevenLabs | 3.2.1 | `server/index.ts`, `package.json` |
| A2 | Add `express-rate-limit` — 4 limiters: general (500/15min), LLM (20/min), auth (50/15min), upload (50/hr) | 3.3.1–3.3.2 | `server/index.ts`, `server/routes.ts`, `package.json` |
| A3 | IDOR audit — verify every PATCH/DELETE checks document ownership via userId | 3.1.5 | `server/routes.ts` (read-only audit + fixes) |
| A4 | Add `.max()` length limits to all Zod schemas, add `.strict()` where appropriate | 3.5.1 | `shared/schema.ts` |
| A5 | Disable `x-powered-by`, ensure no source maps in production, review CORS | 3.1.6 | `server/index.ts` |
| A6 | Harden file upload validation — magic bytes, sanitize filenames, MIME whitelist | 3.5.2 | `server/routes.ts` (upload handler) |
| A7 | LLM prompt injection review — ensure system/user role separation in all calls | 3.6.1 | `server/llm.ts`, `server/context-builder.ts` |

**Coordination:** A2 (rate limiting) is a soft dependency for Stream D (monetization). A4 (schema limits) touches `shared/schema.ts` — coordinate with D1.

---

### Stream B: Infrastructure & Observability

**Priority:** P0 | **Original tracks:** 7.1–7.6
**Goal:** Health checks, structured logging, env validation, CI pipeline.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| B1 | `GET /api/health` — server/database/LLM status, version, uptime | 7.4.1 | `server/index.ts` (new endpoint) |
| B2 | Structured logging middleware — JSON in prod, pretty in dev; request correlation IDs | 7.3.1–7.3.2 | `server/logger.ts` (new), `server/index.ts` |
| B3 | Env var validation at startup — fail fast on missing required vars | 7.6.1 | `server/env.ts` (new) |
| B4 | GitHub Actions CI — lint+typecheck, test (Postgres service), build | 7.1.1 | `.github/workflows/ci.yml` (new) |
| B5 | Pre-commit hooks — husky + `npm run check` | 7.1.2 | `.husky/` (new), `package.json` |
| B6 | Database indexes — documents(user_id), folders(user_id), messages(conversation_id), llm_calls(created_at) | 2.3.1 | `server/db.ts` |

**Coordination:** B2 adds middleware to `server/index.ts` — coordinate insertion order with A1/A2.

---

### Stream C: Testing Foundation

**Priority:** P0 | **Original tracks:** 1.1
**Goal:** Reach critical-path test coverage for v1 confidence.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| C1 | Test helpers — Auth mocks (Clerk), DB setup/teardown with tx rollback, LLM response mocks | 1.1.1–1.1.2 | `tests/helpers/` (new) |
| C2 | Encryption round-trip tests (~25 tests) | 1.1.3 | `tests/unit/server/crypto.test.ts` |
| C3 | API endpoint tests — Document CRUD, canvas save/load (~80 tests) | 1.1.4–1.1.5 | `tests/integration/api/` |
| C4 | LLM routing tests — provider selection, fallback, streaming (~15 tests) | 1.1.7 | `tests/unit/server/llm.test.ts` |
| C5 | Chain execution tests — linear, branching, merge, gates, cycle detection (~40 tests) | 1.1.6 | `tests/integration/api/chain.test.ts` |
| C6 | Edge role tests — assignment, multi-role, role-aware input gathering (~20 tests) | 1.1.8 | `tests/unit/server/edge-roles.test.ts` |
| C7 | Component render tests — all 25 node types render compact+expanded without crash (~50 tests) | 1.1.9 | `tests/unit/client/components/` |

**Coordination:** Fully isolated — all new files in `tests/`.

---

### Stream D: Monetization Completion

**Priority:** P0 | **Original tracks:** 6.1–6.4
**Goal:** Subscription management, usage metering, billing UI.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| D1 | `subscriptions` + `usage_records` DB tables in schema + ensureTables | 6.2.4 | `shared/schema.ts`, `server/db.ts` |
| D2 | Usage metering system — `checkUsage()`, `requireUsage()` middleware | 6.1.2–6.1.3 | `server/usage.ts` (new) |
| D3 | Stripe webhook expansion — handle `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted` | 6.2.3 | `server/routes.ts` (billing section) |
| D4 | Billing settings page — `/settings/billing` with plan, usage dashboard, payment method, history | 6.3.2 | `client/src/pages/Billing.tsx` (new) |
| D5 | Usage limit UI — 80% warning toasts, 100% block modals, node creation limits | 6.3.3 | `client/src/components/UsageLimitUI.tsx` (new) |
| D6 | Pricing page integration — dynamic Stripe prices, annual toggle, current plan indicator | 6.3.1 | `client/src/pages/Pricing.tsx` |
| D7 | Revenue analytics admin dashboard (P2) | 6.4.1 | `client/src/pages/Admin.tsx` |

**Plan tier limits (from Track 6):**

| Feature | Free | Pro ($19/mo) | Team ($39/user/mo) |
|---------|------|-------------|-------------------|
| Canvas saves | 3 | Unlimited | Unlimited |
| Nodes per canvas | 15 | Unlimited | Unlimited |
| LLM calls/day | 25 | 200 | 500 |
| TTS | None | 50 min/mo | 200 min/mo |
| Image generation | 5/day | 50/day | 200/day |
| Context Store | 100MB | 5GB | 25GB |

**Coordination:** D1 adds to `shared/schema.ts` (coordinate with A4). D3 adds to `server/routes.ts` (coordinate with A2).

---

### Stream E: Performance & Architecture

**Priority:** P1 | **Original tracks:** 2.1–2.4, 1.2
**Goal:** Canvas rendering performance, bundle optimization, FlowWorkspace decomposition.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| E1 | CSS transform viewport — replace React state with CSS transform on container ref | 2.1.1 | `client/src/components/flow/FlowCanvas.tsx` |
| E2 | React.memo boundaries on FlowNodeRenderer with shallow comparison | 2.1.4 | `client/src/components/flow/FlowNodeRenderer.tsx` |
| E3 | Edge rendering optimization — cache paths, only recalculate connected edges | 2.1.3 | `client/src/components/flow/FlowEdgeLayer.tsx` |
| E4 | Route-level code splitting — lazy load FlowWorkspace, ContextStore, Admin, Pricing | 2.2.1 | `client/src/App.tsx` |
| E5 | Lazy-load expanded views — `React.lazy` on double-click | 2.2.2 | `client/src/components/flow/` (expanded views) |
| E6 | Diff-based auto-save — hash comparison to skip unchanged saves | 2.4.1 | `client/src/hooks/` (save hooks) |
| E7 | FlowWorkspace decomposition — extract FlowDockConfig, FlowOverlayManager, FlowToolHandlers, etc. | 1.2.1–1.2.7 | `client/src/pages/FlowWorkspace.tsx` → `flow-workspace/` |

**Note:** Viewport virtualization (2.1.2) is already implemented. Node count went from 17 to 25.

**Performance targets (from plan):**
- 50-node canvas pan: 60 fps (from ~20 fps)
- 100-node canvas pan: 30+ fps (from ~8 fps)
- Node drag latency: <16ms (from ~30ms)

**Coordination:** Fully isolated to `client/src/components/flow/` and `client/src/pages/`.

---

### Stream F: UX Polish & Onboarding

**Priority:** P1 | **Original tracks:** 4.1–4.5
**Goal:** First-run experience, accessibility, consistency pass.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| F1 | Welcome overlay — one-time modal: Start Tour / Explore / Load Blueprint | 4.1.1 | `client/src/components/WelcomeOverlay.tsx` (new) |
| F2 | Guided tour system — spotlight + tooltips for 7 key areas | 4.1.2 | `client/src/components/GuidedTour.tsx` (new) |
| F3 | Empty state improvements — canvas, research chat, document node, context sidebar | 4.1.4 | Various component files |
| F4 | Keyboard shortcut overlay — `?` or `Ctrl+/` to show modal | 8.1.2 | `client/src/components/KeyboardShortcutsOverlay.tsx` (new) |
| F5 | Standardize loading states — consistent spinner/skeleton/pulse | 4.4.1 | `client/src/components/ui/` |
| F6 | Standardize error states — reusable ErrorState component, consistent toasts | 4.4.2 | `client/src/components/ui/ErrorState.tsx` (new) |
| F7 | Destructive action confirmation audit — all delete/clear/overwrite actions | 4.4.4 | Various component files |
| F8 | ARIA labels — role, aria-label, aria-selected, tabIndex on canvas nodes, dock, overlays | 4.2.2 | Various component files |
| F9 | Color contrast audit across all 3 themes | 4.2.3 | CSS/component files |
| F10 | Reduced motion support — `prefers-reduced-motion` media query | 4.2.4 | CSS files |

**Coordination:** Mostly new files + minor additions to existing components.

---

### Stream G: AI & LLM Enhancements

**Priority:** P1 | **Original tracks:** 9.1–9.4
**Goal:** Smarter prompts, cost optimization, context window safety.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| G1 | Context budget allocation — `allocateContextBudget()` with model-aware limits | 9.3.1–9.3.2 | `server/context-builder.ts` |
| G2 | Prompt audit — review all 6 endpoints, reduce sizes by 30%+, improve instruction following | 9.1.1, 9.1.3 | `server/context-builder.ts`, LLM prompts in routes |
| G3 | Prompt template system — `PromptTemplate` type with version, variables, maxOutputTokens, temperature | 9.1.2 | `server/prompt-templates.ts` (new) |
| G4 | LLM output validation — validate JSON/markdown, extract from code blocks, retry on invalid | 9.4.1 | `server/llm-gateway.ts` |
| G5 | Model routing by complexity — simple tasks flash, complex tasks pro; classify by task+size | 9.2.1 | `server/llm.ts` |
| G6 | Retry with model fallback — if primary model fails, try next provider | 9.4.2 | `server/llm-gateway.ts` |

**Coordination:** Touches `server/llm.ts`, `server/llm-gateway.ts`, `server/context-builder.ts` — no overlap with other streams.

---

### Stream H: Documentation & Help

**Priority:** P2 | **Original tracks:** 8.1–8.4
**Goal:** User-facing help system, contextual help buttons.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| H1 | Help content — markdown pages for canvas, nodes, chains, edge roles, personas, blueprints | 8.2.1 | `client/src/lib/helpContent.ts` (new) |
| H2 | Help page routing — `/help` with sidebar navigation, markdown rendering | 8.2.2 | `client/src/pages/Help.tsx` (new) |
| H3 | Contextual help `?` buttons on major panels | 8.1.1 | `client/src/components/HelpButton.tsx` (new) |
| H4 | Enhanced tooltips — port dots, edge roles, status indicators, menu items | 8.1.3 | Various component files |
| H5 | "What's New" badge — badge on version watermark, auto-show release notes on update | 8.3.1 | `client/src/components/WhatsNew.tsx` (new) |

**Coordination:** Fully isolated — all new files.

---

### Stream I: Chain Execution Reliability (NEW — extracted from Track 5)

**Priority:** P0 | **Original tasks:** 5.2.1–5.2.3
**Goal:** Fix race conditions, add error recovery, add progress indicators.

| # | Task | From Plan | Files |
|---|------|-----------|-------|
| I1 | Execution lock per node — prevent duplicate triggers from simultaneous upstream completions | 5.2.1 | `client/src/hooks/useChainExecutor.ts` |
| I2 | Error state propagation — failed node marks all downstream as "error", shows error icon | 5.2.2 | `client/src/hooks/useChainExecutor.ts`, `FlowNodeRenderer.tsx` |
| I3 | Retry button on failed nodes — re-run just that node, resume chain on success | 5.2.2 | `client/src/components/flow/` |
| I4 | Chain progress indicator — "Processing 3/8 nodes", highlight current, estimated time | 5.2.3 | `client/src/components/flow/ChainProgressBar.tsx` (new) |
| I5 | Per-node timeout — configurable, default based on node type | 5.2.3 | `client/src/hooks/useChainExecutor.ts` |
| I6 | Chain cancel — stop processing, mark remaining as "cancelled" | 5.2.3 | `client/src/hooks/useChainExecutor.ts` |

**Coordination:** Touches `useChainExecutor.ts` and flow components — no overlap with Stream E which focuses on rendering/viewport.

---

### Stream J: Product Owner Agent Template (NEW)

**Priority:** P1 | **From:** template-product-owner-agent.md
**Goal:** Build a Provocations app template where users create Product Owner guides.

| # | Task | Description | Files |
|---|------|-------------|-------|
| J1 | Create `apps/product-owner/` directory with 3-layer definition (UI, workspace, LLM guidance) | Follow existing app template patterns | `apps/product-owner/` (new) |
| J2 | Define personas for PO agent context — Strategy, Quality, Process, Coordination, Risk | Custom persona subset | `apps/product-owner/personas.ts` |
| J3 | Define 10-section document structure as default content/template | Based on template-product-owner-agent.md | `apps/product-owner/template.ts` |
| J4 | Add LLM system guidance for PO-specific challenges — values ranking, quality gates, anti-patterns | Context builder config | `server/context-builder.ts` (add entry) |
| J5 | Register template in app map and Application Map in CLAUDE.md | Standard registration | `shared/` (template registry), `CLAUDE.md` |

**Coordination:** J4 touches `server/context-builder.ts` (single config entry) — coordinate with G1/G2.

---

## Dependency Graph

```
                    ┌──── Stream A (Security) ──────────────────────┐
                    ├──── Stream B (Infrastructure) ────────────────┤
                    ├──── Stream C (Testing) ────────────────────────┤
                    ├──── Stream D (Monetization) ──── soft dep A2 ──┤
 All Independent ───├──── Stream E (Performance) ──────────────────┤──► Merge to main
                    ├──── Stream F (UX Polish) ────────────────────┤
                    ├──── Stream G (AI/LLM) ────────────────────────┤
                    ├──── Stream H (Documentation) ─────────────────┤
                    ├──── Stream I (Chain Reliability) ──────────────┤
                    └──── Stream J (PO Agent Template) ──────────────┘
```

### Shared File Coordination Matrix

| File | Streams | Coordination |
|------|---------|-------------|
| `server/index.ts` | A, B | Middleware insertion order: B2 (logging) → A1 (helmet) → A2 (rate limit) |
| `shared/schema.ts` | A4, D1 | A4 adds `.max()` limits; D1 adds new tables. Non-overlapping. |
| `server/routes.ts` | A2, A3, D3 | A2 applies limiters; A3 audits ownership; D3 adds billing webhooks. Non-overlapping sections. |
| `server/context-builder.ts` | G1, G2, J4 | G touches allocation logic; J4 adds one config entry. Minimal overlap. |
| `server/llm-gateway.ts` | G4, G6 | Same stream, sequential. |
| `client/src/components/flow/FlowNodeRenderer.tsx` | E2, I2 | E2 adds memo; I2 adds error state rendering. Compatible. |
| `client/src/hooks/useChainExecutor.ts` | I (all) | Owned entirely by Stream I. |
| `package.json` | A, B, C | Each adds different dependencies. Merge-safe. |

---

## Recommended Execution Order

All 10 streams launch in parallel per user direction. Within each stream, tasks are sequential by their numbered order.

**Expected completion signal per stream:**

| Stream | Completion Gate |
|--------|----------------|
| A | `npm run check` passes, rate limiting active on all LLM routes |
| B | `GET /api/health` returns 200, CI pipeline runs on push |
| C | `npm run test` passes with 155+ tests, >50% critical path coverage |
| D | Full checkout → subscription → usage metering → billing page flow works |
| E | 50-node canvas pans at 60fps, FlowWorkspace.tsx < 500 lines |
| F | Welcome overlay shows on first visit, `?` shows shortcuts, ARIA audit passes |
| G | All prompts 30%+ smaller, context budget prevents overflow, output validated |
| H | `/help` route works, `?` buttons on all major panels |
| I | Chain with 10 nodes: error at node 5 → retry → resumes; progress bar visible |
| J | `product-owner` template appears in app list, creates 10-section doc structure |

---

## Items Explicitly Deferred to Post-v1

These are marked nice-to-have in the plan or depend on v1 features being live:

1. **Real-time collaboration conflict resolution** (Track 10.1.3) — WebSocket sync exists, conflict UI is v1.1
2. **Team workspaces + RBAC** (Track 10.3) — Requires subscription tiers live first
3. **Custom user personas** (Track 5.6.1) — v1.1 feature
4. **Multi-participant interviews** (Track 5.5.3) — Depends on collaboration
5. **Smart inline suggestions** (Track 9.5.1) — v1.2 feature
6. **Cross-document intelligence** (Track 9.5.3) — v1.2 feature
7. **Canvas comments & annotations** (Track 10.4) — v1.1 feature
8. **Public/embed canvas view** (Track 10.2.3) — v1.1 feature
9. **CRDT-based editing** (Track 10.1, Option B) — Future consideration
10. **OpenAPI spec** (Track 8.4) — Depends on API access tier
11. **Rich text editing toolbar** (Track 5.3.1) — Enhancement, not blocker
12. **Word/HTML export** (Track 5.3.3) — Enhancement
13. **Document tagging system** (Track 5.4.3) — Enhancement
14. **Interview templates** (Track 5.5.1) — Enhancement
15. **Mobile canvas view** (Track 4.3.1) — Enhancement
16. **Background save worker** (Track 2.4.3) — Optimization
17. **LLM response caching** (Track 9.4.3) — Optimization
18. **Version history with diff view** (Track 5.3.2) — Enhancement
19. **Persona tuning controls** (Track 5.6.2) — Depends on custom personas

---

## Product Owner Agent Template — Post-Implementation Opportunities

The `template-product-owner-agent.md` file is a **standalone methodology** for creating product-owner-brain-in-a-file documents. After Stream J implements it as an app template, additional opportunities include:

### 1. Blog Post / Thought Leadership
Publish the methodology as content marketing. The 10-section structure (Identity, Values, Quality Bar, Sprint Review, Decision Framework, Cross-Team Coordination, Anti-Patterns, Readiness Checklist, Agent Protocol, Evolution) is genuinely novel and battle-tested.

### 2. Premium Template (Team Tier)
Offer PO Agent templates as a Team tier differentiator. Teams get pre-built PO templates for common project types (SaaS, mobile app, API platform).

### 3. AI-Enhanced PO Reviews
Use the provocation system against the PO guide itself — "Your quality bar doesn't define what 'tested' means" / "Your anti-patterns section has zero items from real incidents." Recursive self-improvement of the guide.

### 4. Cross-Agent Coordination
Use the PO Agent guide as the coordination layer between parallel agent teams — every agent reads the guide before starting work, runs self-check after, reports to the guide's review protocol.

### 5. Internal Use
Keep using the Provocations-specific PO guide (00-product-owner-guide.md) for v1.1+ planning. Update anti-patterns section with anything discovered during v1 development.

---

## Verification Protocol

After each stream completes:

1. `npm run check` — zero TypeScript errors
2. `npm run test` — all tests pass (if Stream C is merged)
3. `npm run build` — production build succeeds
4. Manual smoke test:
   - Create canvas → add 3 node types → connect → run chain → save → reload → verify
   - Open Context Store → create folder → upload document → pin to canvas
   - Open a blueprint → apply → verify all nodes render
5. Version bumped in `version.ts` with release notes
6. Stream-specific completion gate (see table above)
