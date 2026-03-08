# Unused API Endpoints

**Generated**: 2026-02-28
**Method**: Cross-referenced all route definitions in `server/routes.ts` against all API calls in `client/src/`

---

## Summary

| Category | Count |
|----------|-------|
| Persona query/management APIs with no UI | 6 |
| Persona admin APIs with no UI | 2 |
| Agent CRUD APIs with no UI | 5 |
| Non-streaming agent execute | 1 |
| Admin analytics/config with no UI | 6 |
| Misc unused | 3 |
| **Total unused from UI** | **23** |
| External-only (webhooks, health checks) | 3 |
| Dead code (replit_integrations never imported) | 11 routes across 3 files |

---

## Unused Endpoints — No Frontend Callers

### Persona Query & Management (6 endpoints)

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| GET | `/api/personas` | routes.ts:937 | Base personas list — UI imports from `shared/personas.ts` directly |
| GET | `/api/personas/hierarchy` | routes.ts:950 | Hierarchy view — no UI |
| GET | `/api/personas/all` | routes.ts:969 | All personas including DB overrides — no UI |
| GET | `/api/personas/domain/:domain` | routes.ts:979 | Filter by domain — no UI |
| GET | `/api/personas/:personaId/versions` | routes.ts:1011 | Version history — no UI |
| PUT | `/api/admin/personas/:personaId` | routes.ts:1045 | Full persona update — Admin.tsx only uses PATCH lock, not PUT |

### Persona Admin (2 endpoints)

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| DELETE | `/api/admin/personas/:personaId/override` | routes.ts:1127 | Delete persona override — no UI |
| GET | `/api/admin/personas/export` | routes.ts:1141 | Export all personas as JSON — no UI |

### Agent CRUD (5 endpoints)

The frontend only uses `POST /api/agents/:agentId/execute/stream` and `POST /api/agents/execute-inline`. All CRUD management endpoints are unused.

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| POST | `/api/agents` | routes.ts:1157 | Create agent — no UI |
| GET | `/api/agents` | routes.ts:1182 | List agents — no UI |
| GET | `/api/agents/:agentId` | routes.ts:1201 | Get single agent — no UI |
| PUT | `/api/agents/:agentId` | routes.ts:1218 | Update agent — no UI |
| DELETE | `/api/agents/:agentId` | routes.ts:1242 | Delete agent — no UI |

### Agent Execution (1 endpoint)

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| POST | `/api/agents/:agentId/execute` | routes.ts:1262 | Non-streaming execute — UI only uses `/execute/stream` |

### Admin Analytics & Config (6 endpoints)

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| GET | `/api/admin/agent-overrides` | routes.ts:1395 | List all agent overrides — UI fetches via `agent-prompts` instead, then does individual PUT/PATCH/DELETE on `:taskType` |
| GET | `/api/admin/persona-usage` | routes.ts:1674 | Persona usage stats — no UI |
| GET | `/api/admin/event-breakdown` | routes.ts:1688 | Event breakdown — no UI |
| GET | `/api/admin/llm-logs` | routes.ts:1717 | LLM call logs (admin) — no UI |
| GET | `/api/admin/voice-capture-config` | routes.ts:1886 | Admin voice config getter — no UI (user `GET /api/voice-capture-config` IS used) |
| PUT | `/api/admin/voice-capture-config` | routes.ts:1897 | Admin voice config setter — no UI |

### Misc Unused (3 endpoints)

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| GET | `/api/llm-status` | routes.ts:607 | Health/diagnostic endpoint — no frontend caller |
| GET | `/api/llm-logs` | routes.ts:1740 | Non-admin LLM logs — no UI |
| POST | `/api/tracking/events` | routes.ts:1536 | Batch event tracking — UI uses singular `POST /api/tracking/event` |

---

## External-Only Endpoints (NOT dead code)

These are called by external services or server-side processes, not the frontend:

| Method | Endpoint | Line | Called By |
|--------|----------|------|-----------|
| POST | `/api/stripe/webhook` | routes.ts:5044 | Stripe webhook callbacks |
| GET | `/api/stripe/payments` | routes.ts:5090 | Admin/external tooling (no frontend caller) |
| POST | `/api/chat` | routes.ts:3586 | Non-streaming chat — possibly for external integrations (UI uses `/api/chat/stream`) |

### Server-Side Auto-Sync (called on server startup, not from UI)

| Method | Endpoint | Line | Notes |
|--------|----------|------|-------|
| POST | `/api/admin/sync-app-docs` | routes.ts:1973 | Auto-syncs on server startup for admin user |
| POST | `/api/admin/sync-persona-docs` | routes.ts:2130 | Manual admin trigger |

---

## Dead Code: Replit Integrations (never imported)

These route-registration functions exist in `server/replit_integrations/` but are **never imported or called** from `server/index.ts` or `server/routes.ts`:

| File | Function | Routes Defined |
|------|----------|---------------|
| `server/replit_integrations/audio/routes.ts` | `registerAudioRoutes` | 5 conversation/audio endpoints |
| `server/replit_integrations/chat/routes.ts` | `registerChatRoutes` | 5 conversation/chat endpoints |
| `server/replit_integrations/image/routes.ts` | `registerImageRoutes` | 1 image generation endpoint |

These files can be safely removed.

---

## Recommendations

1. **Remove dead code**: The `server/replit_integrations/` routes are never registered — safe to delete
2. **Remove or build UI**: The 23 unused endpoints fall into two camps:
   - **Build admin panels**: Persona management, agent CRUD, analytics (llm-logs, persona-usage, event-breakdown) could power a richer admin dashboard
   - **Remove safely**: Non-streaming `POST /api/agents/:agentId/execute`, batch `POST /api/tracking/events`, `GET /api/llm-status` can likely be removed
3. **Document external endpoints**: `stripe/webhook`, `stripe/payments`, `sync-app-docs`, `sync-persona-docs`, and non-streaming `POST /api/chat` should be documented as external/server-only APIs
