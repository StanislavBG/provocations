# Plan: Cross-App API Pattern + DB-Backed Persona Overrides + Lock Mechanism

## Problem

1. **No cross-app navigation** — Admin can display personas but can't hand off to the Persona Definition workspace for editing
2. **Personas are static code** — defined in `shared/personas.ts`, can't be edited at runtime
3. **"Edit the git repo" is not viable** — production can't modify source files; need DB-backed overrides
4. **Master Researcher has no guardrails** — can't distinguish human-curated from auto-generated
5. **No scalable pattern** — as we grow to 100s of apps, no standard for app-to-app invocation

---

## Architecture Overview

### Three-Layer Persona Resolution

```
┌──────────────────────────────────────────────────────┐
│  Layer 1: CODE DEFAULTS (shared/personas.ts)         │
│  ─ Ships with the repo, bootstrap for fresh installs │
│  ─ 14 built-in personas, always present              │
│  ─ Updated via export pipeline (see below)           │
└──────────────────┬───────────────────────────────────┘
                   │ overridden by
┌──────────────────▼───────────────────────────────────┐
│  Layer 2: DB OVERRIDES (persona_overrides table)     │
│  ─ Admin-curated definitions stored in PostgreSQL    │
│  ─ Each row = one persona's full JSON definition     │
│  ─ DB wins over code when both exist for same ID     │
│  ─ Supports humanCurated lock flag                   │
└──────────────────┬───────────────────────────────────┘
                   │ merged at runtime
┌──────────────────▼───────────────────────────────────┐
│  Layer 3: EFFECTIVE PERSONAS (runtime)               │
│  ─ getEffectivePersonas() merges code + DB           │
│  ─ All API endpoints use this, never raw builtIns    │
│  ─ Cached in memory, invalidated on DB write         │
└──────────────────────────────────────────────────────┘
```

### Deployment Sync Pipeline

Admin curates personas in DB → on next deploy cycle, export to code:

```
npm run personas:export
  → Reads all persona_overrides from DB
  → Merges with current code defaults
  → Writes updated shared/personas.ts
  → Developer reviews diff, commits, deploys
```

This means:
- **Runtime** always reads DB overrides (immediate effect in current environment)
- **Next production build** picks up the exported code (persists across deploys)
- **Code review** ensures no bad definitions ship

### URL-Based App Launch Protocol

Any app invokes another via URL query parameters:

```
/?app={templateId}&intent={action}&entityType={type}&entityId={id}&step={stepId}&source={callerApp}
```

**Example: Admin → Edit Persona**
```
/?app=persona-definition&intent=edit&entityType=persona&entityId=architect&step=draft&source=admin
```

**Why URL params** (not a shared state bus):
- **Stateless** — no coupling between apps
- **Bookmarkable** — users can save deep links
- **Externally invocable** — future external apps use the same protocol
- **Debuggable** — URL tells you exactly what's happening

---

## Implementation Steps

### Step 1: DB Table — `persona_overrides`

**File: `shared/models/chat.ts`**

New table alongside existing `personaVersions`:

```typescript
export const personaOverrides = pgTable("persona_overrides", {
  id: serial("id").primaryKey(),
  personaId: varchar("persona_id", { length: 64 }).notNull().unique(),
  definition: text("definition").notNull(),       // full JSON Persona object
  humanCurated: boolean("human_curated").default(false).notNull(),
  curatedBy: varchar("curated_by", { length: 128 }),  // Clerk userId
  curatedAt: timestamp("curated_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
```

Then run `npm run db:push` to sync schema.

### Step 2: Schema — Add `humanCurated` fields to Persona type

**File: `shared/schema.ts`**

Add to `personaSchema`:
```typescript
humanCurated: z.boolean().default(false),
curatedBy: z.string().nullable().default(null),
curatedAt: z.string().nullable().default(null),
```

**File: `shared/personas.ts`**

Add `humanCurated: false, curatedBy: null, curatedAt: null` to all 14 built-in persona objects.

Add `AppLaunchParams` Zod schema to `shared/schema.ts`:
```typescript
export const appLaunchParamsSchema = z.object({
  app: z.string(),
  intent: z.enum(["create", "edit", "view"]).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  step: z.string().optional(),
  source: z.string().optional(),
});
export type AppLaunchParams = z.infer<typeof appLaunchParamsSchema>;
```

### Step 3: Storage — Persona override CRUD

**File: `server/storage.ts`**

Add to `IStorage` interface and `DatabaseStorage` class:

```typescript
// Persona overrides
getPersonaOverride(personaId: string): Promise<StoredPersonaOverride | null>
getAllPersonaOverrides(): Promise<StoredPersonaOverride[]>
upsertPersonaOverride(data: {
  personaId: string;
  definition: string;
  humanCurated: boolean;
  curatedBy?: string;
}): Promise<StoredPersonaOverride>
deletePersonaOverride(personaId: string): Promise<void>
```

### Step 4: Server — Effective persona resolution + new endpoints

**File: `server/routes.ts`**

New persona resolution function used by ALL persona-reading endpoints:
```typescript
async function getEffectivePersonas(): Promise<Record<string, Persona>> {
  const overrides = await storage.getAllPersonaOverrides();
  const result = { ...builtInPersonas };  // start with code defaults
  for (const override of overrides) {
    result[override.personaId] = JSON.parse(override.definition);
  }
  return result;
}
```

Update existing endpoints to use `getEffectivePersonas()` instead of direct `builtInPersonas` imports:
- `GET /api/personas`
- `GET /api/personas/all`
- `GET /api/personas/hierarchy`
- `GET /api/personas/domain/:domain`
- `GET /api/personas/stale`

New admin endpoints:
- `GET /api/admin/persona-overrides` — list all DB overrides with lock status
- `PUT /api/admin/personas/:personaId` — save persona override (admin-only)
  - Accepts `{ definition: Persona, humanCurated: boolean }`
  - Upserts to `persona_overrides` table
  - Creates version in `persona_versions` for audit trail
- `PATCH /api/admin/personas/:personaId/lock` — toggle humanCurated flag
  - Accepts `{ humanCurated: boolean }`
  - Admin-only
- `DELETE /api/admin/personas/:personaId/override` — remove override, revert to code default
- `GET /api/admin/personas/export` — returns merged persona definitions as JSON (for the export pipeline)

### Step 5: URL Launch Params — parsing + building

**File: `client/src/lib/appLaunchParams.ts`** (new)

```typescript
export function parseAppLaunchParams(search: string): AppLaunchParams | null
export function buildAppLaunchUrl(params: AppLaunchParams): string
```

Pure functions, no side effects. Used by both Admin (to build URLs) and Workspace (to consume them).

### Step 6: Workspace — consume launch params on mount

**File: `client/src/pages/Workspace.tsx`**

On mount:
1. Call `parseAppLaunchParams(window.location.search)`
2. If params exist with `intent=edit` and `entityType=persona`:
   - Fetch persona definition from `/api/personas/all` (which now includes DB overrides)
   - Set template to `persona-definition`
   - Serialize persona into editable markdown document
   - Set phase to "workspace", active step to `params.step` (default "draft")
   - Clear URL params via `history.replaceState` so refresh doesn't replay
3. Generic handling: for any `app` param, set the template and skip the input phase

### Step 7: Persona serialization

**File: `client/src/lib/personaSerializer.ts`** (new)

```typescript
export function serializePersonaToMarkdown(persona: Persona): string
```

Converts a persona object into a structured markdown document the workspace can edit:

```markdown
# Architect

**Role:** System design advisor...
**Domain:** technology
**Parent:** master_researcher

## Challenge Prompt
As the Architect: Evaluate system boundaries...

## Advice Prompt
As the Architect: Provide concrete recommendations...

## Summary
- **Challenge:** Evaluates system design...
- **Advice:** Recommends architecture...

## Visual
- **Icon:** Blocks
- **Colors:** text-cyan-600, bg-cyan-50, accent #0891b2
```

### Step 8: Admin UI — Edit + Lock buttons

**File: `client/src/pages/Admin.tsx`**

In the expanded persona detail card (line ~476-500), add:

1. **"Edit in Workspace" button** — builds URL via `buildAppLaunchUrl()`, navigates with `window.location.href`
2. **"Lock" toggle** — calls `PATCH /api/admin/personas/:id/lock`
   - Shows lock icon when `humanCurated: true`
   - Shows "Curated by [name] on [date]" badge
3. **"Override active" indicator** — shows when DB override exists (differs from code default)
4. **"Revert to default" button** — calls `DELETE /api/admin/personas/:id/override`

In `PersonaDefinitionList`, show:
- Lock icon next to human-curated personas
- "DB Override" vs "Code Default" badge per persona

### Step 9: Master Researcher guardrail

**File: `server/routes.ts`**

In `/api/generate-challenges` when `master_researcher` is selected:
- Load effective personas (including lock status)
- For each persona with `humanCurated: true`:
  - Append to the system prompt: "Persona '{label}' is HUMAN-CURATED and LOCKED. You MUST NOT suggest replacing or overriding its definition. Instead: (1) Study its patterns — tone, structure, specificity level. (2) Apply those quality patterns to non-curated personas. (3) You may recommend enhancements, but they are advisory only."
- This makes the Master Researcher learn FROM the curated personas rather than trying to replace them.

### Step 10: Export CLI script

**File: `scripts/export-personas.ts`** (new)

```bash
npx tsx scripts/export-personas.ts
```

- Connects to DB via `DATABASE_URL`
- Reads all `persona_overrides`
- Merges with current `builtInPersonas`
- Writes updated `shared/personas.ts` with the merged definitions
- Outputs diff summary to stdout
- Developer reviews, commits, and deploys

---

## File Impact Summary

| File | Change |
|------|--------|
| `shared/models/chat.ts` | New `persona_overrides` table |
| `shared/schema.ts` | Add `humanCurated/curatedBy/curatedAt` to persona; add `AppLaunchParams` |
| `shared/personas.ts` | Add new fields to all 14 built-in personas |
| `server/storage.ts` | Persona override CRUD methods |
| `server/routes.ts` | `getEffectivePersonas()` resolver; new admin endpoints; Master Researcher guardrail |
| `client/src/lib/appLaunchParams.ts` | **New** — URL parsing + building |
| `client/src/lib/personaSerializer.ts` | **New** — Persona → Markdown conversion |
| `client/src/pages/Workspace.tsx` | Read launch params on mount, hydrate state |
| `client/src/pages/Admin.tsx` | Edit + Lock + Revert buttons; override indicators |
| `scripts/export-personas.ts` | **New** — DB → code export pipeline |

---

## What This Does NOT Do (Future)

- **Custom (non-built-in) personas** — this plan only handles overriding existing built-in personas. Creating brand-new personas from scratch is a separate feature.
- **Auto-apply Master Researcher suggestions** — the lock is advisory. Auto-refresh pipeline that actually writes to DB is separate.
- **External API auth** — the URL protocol works internally. External API keys/OAuth is future.
- **Multi-tenant persona isolation** — currently all overrides are global (admin-level). Per-user persona customization is future.
