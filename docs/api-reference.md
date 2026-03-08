# API Reference

All endpoints use Zod validation. Document endpoints require Clerk authentication. App-specific endpoints are documented in each app's `apps/<templateId>/CLAUDE.md`.

## Shared AI Endpoints (used by all apps)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/generate-challenges` | POST | Generate challenges from selected personas |
| `/api/generate-advice` | POST | Generate advice for a specific challenge |
| `/api/write` | POST | Unified document editor (edit, expand, refine) |
| `/api/write/stream` | POST | Streaming write for large documents (SSE) |
| `/api/summarize-intent` | POST | Clean voice transcripts into clear intent |
| `/api/interview/question` | POST | Generate next interview question |
| `/api/interview/summary` | POST | Synthesize interview entries into instructions |
| `/api/discussion/ask` | POST | Multi-persona response to user questions |

## Research Chat Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/stream` | POST | Streaming research chat (SSE) |
| `/api/chat/summarize` | POST | Summarize a research chat session |
| `/api/chat/save-session` | POST | Save research chat session to context |
| `/api/chat/models` | GET | List available chat models |

## User-to-User Messaging Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/connections/invite` | POST | Send connection invitation |
| `/api/chat/connections` | GET | List user's connections |
| `/api/chat/connections/respond` | POST | Accept/reject connection |
| `/api/chat/conversations` | GET | List conversations with users |
| `/api/chat/messages` | POST | Send message in conversation |
| `/api/chat/messages/:id` | GET | Fetch conversation history |
| `/api/chat/messages/:id/read` | POST | Mark messages as read |

## Shared Data Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/personas` | GET | List all 14 built-in personas |
| `/api/documents` | POST/GET | Save new document (encrypted) / List user's documents |
| `/api/documents/:id` | GET/PUT/PATCH/DELETE | Load, update, rename, delete document |
| `/api/folders` | POST/GET | Create folder / List user's folders |
| `/api/preferences` | GET/PUT | User preferences (auto-dictate) |
| `/api/tracking/event` | POST | Record usage tracking event |
| `/api/metrics` | POST | Record productivity metrics |

## Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/role` | GET | Check if current user is admin |
| `/api/admin/dashboard` | GET | Analytics dashboard data |
| `/api/admin/user-metrics` | GET | User metrics matrix |
| `/api/admin/sync-app-docs` | POST | Sync per-app CLAUDE.md files to document store |
| `/api/admin/persona-overrides` | GET | List persona DB overrides |
| `/api/admin/agent-prompts` | GET | List LLM task prompt overrides |

## Stripe Payment Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/config` | GET | Available products and prices |
| `/api/stripe/create-checkout-session` | POST | Create Stripe Checkout Session, returns hosted payment URL |
| `/api/stripe/webhook` | POST | Stripe webhook (exempted from Clerk auth, uses raw body + signature verification) |
| `/api/stripe/payments` | GET | User's payment history |

### Stripe Integration Notes
- Redirect-based Checkout flow (server creates session, user redirected to Stripe)
- Webhook handles `checkout.session.completed` and `checkout.session.expired`
- Webhook requires raw body middleware (not JSON parsed)
- Webhook path exempted from Clerk auth middleware
- Env vars: `STRIPE_SECRET_KEY_PROD`, `STRIPE_PUBLISHABLE_KEY_PROD`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BUY_COFFEE_PRICE_ID`

## Adding API Routes

1. Define Zod schema in `shared/schema.ts`
2. Add endpoint in `server/routes.ts`
3. Use `safeParse()` for validation
4. All LLM calls go through `llm.generate()` / `llm.stream()` from `server/llm.ts`
