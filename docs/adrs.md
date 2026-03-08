# Architecture Decision Records (ADRs)

## ADR 1: Dual Schema Management — ensureTables + Drizzle

### Context
The database schema is managed by two independent systems that must stay in perfect sync. Mismatches between them cause recurring migration items on every Replit deploy.

### The Two Systems

| System | File | Runs when | Purpose |
|--------|------|-----------|---------|
| `ensureTables()` | `server/db.ts` | App startup (`npm run dev` / `npm run start`) | Safety net: creates tables/columns/indexes via raw SQL so the app works even if `drizzle-kit push` was never run |
| Drizzle schema | `shared/models/chat.ts` | `npm run db:push` (and Replit auto-runs it during Deploy) | Authoritative schema: `drizzle-kit push` introspects the database and generates DDL to match this schema |

### Why This Causes Problems
On Replit, deployment runs `drizzle-kit push` BEFORE the app starts. So `ensureTables()` hasn't run yet when Drizzle checks the database. If the database is missing structures that only `ensureTables()` would create, Drizzle generates migration items.

### Mandatory Rules

1. **Always edit BOTH files.** Every schema change must be reflected in both `shared/models/chat.ts` (Drizzle) AND `server/db.ts` (`ensureTables`). Never edit one without the other.

2. **The Drizzle schema is the source of truth.** Write the Drizzle definition first, then make `ensureTables()` produce the exact same DDL. Never the reverse.

3. **Match index definitions exactly:**
   - If Drizzle says `index("idx_foo").on(table.bar)` → ensureTables must say `CREATE INDEX IF NOT EXISTS idx_foo ON tablename(bar)` with no extra modifiers (no `DESC`, no `NULLS FIRST`, etc.)
   - Drizzle's default sort is ASC. Only add `DESC` to ensureTables if the Drizzle schema explicitly uses `.desc()`

4. **Match constraint names exactly:**
   - Drizzle `.unique()` on a column generates a constraint named `{table}_{column}_unique`
   - PostgreSQL inline `UNIQUE` in CREATE TABLE generates `{table}_{column}_key` — a DIFFERENT name
   - ensureTables must explicitly create constraints with Drizzle-compatible names: `ALTER TABLE ... ADD CONSTRAINT {table}_{column}_unique UNIQUE(...)` wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

5. **No FK REFERENCES in ensureTables** unless the Drizzle schema also defines them (via `.references()`). Currently the Drizzle schema has ZERO foreign keys. Adding `REFERENCES` in ensureTables creates constraints that Drizzle doesn't expect, causing recurring DROP CONSTRAINT statements.

6. **New table checklist:**
   - Add `pgTable()` definition in `shared/models/chat.ts` with all columns, indexes, and unique constraints
   - Add `CREATE TABLE IF NOT EXISTS` in `ensureTables()` matching the Drizzle definition exactly
   - Add the table name to `tablesFilter` in `drizzle.config.ts`
   - Add any Drizzle-named unique constraints (`{table}_{column}_unique`) via `ALTER TABLE ADD CONSTRAINT`

7. **New column checklist:**
   - Add the column to the `pgTable()` definition in `shared/models/chat.ts`
   - Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in the ensureTables `DO $$ BEGIN ... END $$` block
   - If the column has `.unique()`, also add the named constraint

8. **Verify with `npm run db:push --dry-run`** — there should be ZERO pending migration items if both systems are in sync and the app has been started at least once.

---

## ADR 2: Always Use ProvokeText for Text Display

**All text panels in the application MUST use `ProvokeText`** — never raw `<div>`, `<p>`, `<textarea>`, or `<pre>` for displaying or editing user-facing text content.

### Why
ProvokeText provides a unified text experience with built-in copy, voice, smart processing, and consistent styling. Using raw elements creates inconsistency and loses capabilities.

### Rules

1. **Read-only text panels** (transcripts, summaries, previews): Use `<ProvokeText readOnly showCopy showClear={false} />` with `chrome="container"` or `chrome="bare"`.
2. **Editable text areas**: Use `<ProvokeText chrome="container" variant="textarea" />` with appropriate voice/processor props.
3. **Document editors**: Use `<ProvokeText chrome="container" variant="editor" />`.
4. **Minimum visible action**: `showCopy` must always be `true` — users must always be able to copy text. Other actions (clear, voice, smart modes) can be hidden via props.
5. **Streaming content**: Set `readOnly` and update the `value` prop as data arrives — ProvokeText handles re-rendering without interrupting the display.
6. **Configuration extension**: If ProvokeText lacks a needed capability, extend its props interface rather than bypassing it with a raw element.

### Props Quick Reference

- `chrome`: `"container"` (bordered card with header) | `"inline"` (floating toolbar) | `"bare"` (no chrome)
- `variant`: `"input"` | `"textarea"` | `"editor"`
- `showCopy` / `showClear`: Control toolbar button visibility
- `readOnly`: Disable editing while keeping copy functional
- `headerActions`: Slot for extra buttons in the container header
- `label` / `labelIcon`: Container header label

---

## ADR 3: ProvokeText Button Consistency

All ProvokeText panels must provide a **consistent set of capabilities** based on their chrome level. ProvokeText enforces sensible defaults so panels get the right buttons automatically — explicit overrides are only needed for intentional deviations.

### Automatic Defaults by Chrome Level

| Feature | Container + textarea/editor | Inline + textarea/editor | Bare / input |
|---------|----------------------------|--------------------------|--------------|
| **Top right**: Copy | yes (default) | yes (default) | yes (default) |
| **Top right**: Clear | yes (default) | yes (default) | yes (default) |
| **Top right**: Microphone | auto (self-contained voice) | auto (self-contained voice) | manual only |
| **Bottom left**: Clean / Summarize | auto (built-in textProcessor) | manual only | manual only |
| **Bottom left**: Save / Load | via `onSave` / `onLoad` props | via `onSave` / `onLoad` props | — |
| **Bottom right**: Word count | yes (default) | yes (default) | no |
| **Bottom right**: Reading time | yes (default) | no | no |

### Rules

1. Never set `showCopy={false}` on container panels — users must always be able to copy.
2. Never set `showClear={false}` on editable container panels unless there's a specific reason.
3. Container panels get self-contained voice, default textProcessor, word count, and reading time automatically — do not duplicate this logic in parents.
4. Pass `onSave` and `onLoad` props to container panels that hold user content worth persisting.
5. Small inline inputs (chat inputs, heading editors) may set `showCopy={false}` and `showClear={false}`.
6. To override any default, explicitly pass the prop.

---

## ADR 4: LLM Button Widget (Pre-Call Transparency)

**Every user-facing button that triggers an LLM API call MUST be wrapped with `LlmHoverButton`** (from `@/components/LlmHoverButton`). On hover, the button shows a two-tab `LlmCallPreview` widget.

### Why
Users need pre-call transparency — knowing what context, tokens, and cost each AI action involves before they click. This is the mirror of the post-call verbose metadata: one shows what *will* happen, the other shows what *did* happen.

### Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `LlmCallPreview` | `@/components/LlmCallPreview.tsx` | Generic two-tab widget (Perf + Summary). Renders context blocks and summary items. |
| `LlmHoverButton` | `@/components/LlmHoverButton.tsx` | HoverCard wrapper. Accepts `previewTitle`, `previewBlocks`, `previewSummary` + children (the button). |
| `EvolveContextPreview` | `@/components/notebook/EvolveContextPreview.tsx` | Adapter: builds blocks/items specific to the Evolve button's context. |

### Currently Wired To

| Component | Button | Endpoint |
|-----------|--------|----------|
| `SplitDocumentEditor` | Evolve | `/api/write` |
| `ProvoThread` | Generate Provocations | `/api/generate-challenges` |
| `TranscriptPanel` | Summarize Notes | `/api/summarize-intent` |
| `TranscriptPanel` | Evolve Document | `/api/write` |
| `NotebookResearchChat` | Send (research query) | `/api/chat/stream` |
| `GeneratePanel` | Infographic (and future cards) | `/api/summarize-intent` + `/api/generate-image` |

### Rules

1. When adding a **new LLM-triggering button**, wrap it with `LlmHoverButton`.
2. Build `ContextBlock[]` describing what context chunks will be sent. Each block needs `label`, `chars`, and `color`.
3. Build `SummaryItem[]` for human-readable rows.
4. For complex contexts, create a dedicated adapter component. For simpler buttons, build blocks/items inline with `useMemo`.
5. `LlmCallPreview` auto-fetches the active model via `/api/chat/models` and uses a client-side `LLM_COST_TABLE` for cost estimation.
6. Keep `LLM_COST_TABLE` in `LlmCallPreview.tsx` in sync with `COST_TABLE` in `server/llm-gateway.ts` when model pricing changes.
7. Token estimation uses `chars / 4` (same `CHARS_PER_TOKEN` ratio as the server).

---

## ADR 5: Adding a New Application (Three-Layer Contract)

Every application (template) in Provocations is defined across **three files** that must stay in sync. The `TemplateId` type in `shared/schema.ts` enforces this at build time.

### Mandatory Checklist

1. **Add the template ID** to the `templateIds` array in `shared/schema.ts`
2. **Add the `PrebuiltTemplate`** object in `prebuiltTemplates.ts` with:
   - `id`, `title`, `shortLabel`, `subtitle`, `description`, `howTo`
   - `icon` (lucide React component)
   - `objective`, `draftQuestions`, `templateContent`
   - `provocationSources` and `provocationExamples`
   - `steps`, `category` (`"build"` | `"write"` | `"analyze"` | `"capture"`)
3. **Add the `AppFlowConfig`** entry in `appWorkspaceConfig.ts` with:
   - `workspaceLayout`, `defaultToolboxTab`
   - `autoStartInterview` + `autoStartPersonas`
   - `leftPanelTabs` and `rightPanelTabs`
   - `writer` config: `mode`, `outputFormat`, `documentType`
4. **Add the `AppTypeConfig`** entry in `context-builder.ts` with:
   - `documentType`, `systemGuidance`, `feedbackTone`, `outputFormat`
5. **Create `apps/<templateId>/CLAUDE.md`** with app-specific documentation
6. **Run `npm run check`** — TypeScript will verify all three layers have the new ID

### Rules
- Template IDs must be lowercase kebab-case (e.g. `"my-new-app"`)
- The `writer.mode` determines how the document evolves: `"edit"` rewrites, `"analyze"` is read-only, `"aggregate"` appends
- The `systemGuidance` in the backend config is the most important field — it shapes every LLM interaction for that app
- Every app must work with the challenge/advice loop

---

## ADR 6: Flow Canvas Dual-View Pattern

Every Flow Canvas node type MUST have two views. See `docs/flow-canvas.md` for full details.

| View | Where | Purpose |
|------|-------|---------|
| **Compact** | On canvas | Small card showing type badge, label, and content snippet. Draggable, deletable, connectable. |
| **Full** | Double-click overlay | Full interactive experience. Changes persist back to the node. |

### Rules
- Adding a node from the dock places it in **compact view only** — NEVER auto-open the full view.
- Double-click on a compact node opens its full view.
- Full view state persists on the `FlowNode` object so users can return to it.
- Closing the full view returns to the canvas with the compact node updated.
