# Session Save/Resume Feature — Implementation Plan

## Summary
Add a "Session Store" that auto-saves workspace state (document, objective, interview entries, selected personas, versions) to an encrypted DB table. Users see a "Resume" prompt when returning to a template with a saved session. Auto-save can be toggled off. Session Store UI follows Context Store visual language.

## What Gets Saved (Content + Interview scope)
- `document` (rawText)
- `objective` + `secondaryObjective`
- `interviewEntries` (Q&A pairs)
- `interviewDirection` (selected personas, mode, guidance)
- `versions` array (full version history)
- `editHistory` (last 10 edits)
- `selectedTemplateId`
- `savedDocId` + `savedDocTitle` (to reconnect with saved document)
- `sessionNotes`
- `capturedContext`

## Step 1: Database Schema — `workspace_sessions` table

**File: `shared/models/chat.ts`**
Add new table:
```
workspace_sessions:
  id (serial PK)
  userId (text, NOT NULL) — Clerk user ID
  templateId (text, NOT NULL) — which app this session belongs to
  title (text) — auto-generated or user-set session name
  titleCiphertext, titleSalt, titleIv — encrypted title (like documents)
  ciphertext (text, NOT NULL) — encrypted JSON blob of session state
  salt, iv (text, NOT NULL) — AES-256-GCM params
  createdAt (timestamp)
  updatedAt (timestamp)
```

**File: `shared/schema.ts`**
Add Zod schemas:
- `insertWorkspaceSessionSchema` — for creating/updating sessions
- `WorkspaceSession` type

## Step 2: Storage Layer — CRUD operations

**File: `server/storage.ts`**
Add methods:
- `createWorkspaceSession(userId, data)` → insert new session
- `updateWorkspaceSession(id, userId, data)` → update existing
- `getWorkspaceSession(id, userId)` → fetch single session (decrypt)
- `listWorkspaceSessions(userId)` → list all sessions for user
- `deleteWorkspaceSession(id, userId)` → delete session
- `getLatestSessionForTemplate(userId, templateId)` → for auto-resume prompt

All content encrypted/decrypted at route boundary (same pattern as documents).

## Step 3: API Endpoints

**File: `server/routes.ts`**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sessions` | POST | Create new session |
| `/api/sessions` | GET | List user's sessions |
| `/api/sessions/:id` | GET | Load specific session |
| `/api/sessions/:id` | PUT | Update session state |
| `/api/sessions/:id` | DELETE | Delete session |
| `/api/sessions/latest/:templateId` | GET | Get latest session for a template (for resume prompt) |

## Step 4: Session Serializer Hook

**File: `client/src/hooks/use-session-autosave.ts`**
New hook `useSessionAutosave`:
- Takes all workspace state as input
- Debounces changes (5s idle)
- Serializes state to JSON
- POSTs/PUTs to `/api/sessions`
- Tracks `currentSessionId` in state
- Respects auto-save preference (from `/api/preferences`)
- Returns: `{ currentSessionId, saveNow(), isSaving }`

## Step 5: Resume Prompt Component

**File: `client/src/components/SessionResumePrompt.tsx`**
On workspace mount (when entering workspace phase):
- Fetch `GET /api/sessions/latest/:templateId`
- If session exists, show a toast/banner: "Resume your last session?" with Resume / Start Fresh buttons
- Resume → deserialize state, populate all workspace useState hooks
- Start Fresh → dismiss, optionally delete old session

## Step 6: Session Store Panel

**File: `client/src/components/SessionStorePanel.tsx`**
Follows Context Store visual language:
- List of saved sessions, grouped by template/app
- Each card shows: template icon, title, last updated, preview of objective
- Actions: Load, Rename, Delete
- Load → navigates to workspace with that template + deserializes state
- Visual style matches StoragePanel/ContextStore (same card components, fonts, amber theme)

## Step 7: User Preference — Auto-save Toggle

**File: existing `GET/PUT /api/preferences`**
Add `autoSaveSession: boolean` (default: true) to preferences schema.

**File: `client/src/components/SessionStorePanel.tsx` or Settings area**
Toggle switch: "Auto-save sessions" — persisted via preferences API.

## Step 8: Workspace Integration

**File: `client/src/pages/Workspace.tsx`**
- Import and use `useSessionAutosave` hook
- Pass all saveable state to the hook
- On resume: receive deserialized state, call all relevant setState functions
- Add "Session Store" as a new left-panel tab option (or integrate into existing toolbox)

## Step 9: Session State Type Definition

**File: `shared/schema.ts`**
```typescript
export interface WorkspaceSessionState {
  document: { rawText: string };
  objective: string;
  secondaryObjective: string;
  interviewEntries: Array<{ question: string; topic: string; answer: string }>;
  interviewDirection: { mode: string; selectedPersonaIds: string[]; guidance: string };
  versions: Array<{ id: string; text: string; timestamp: number; description: string }>;
  editHistory: Array<{ instruction: string; type: string; summary: string; timestamp: number }>;
  savedDocId: number | null;
  savedDocTitle: string;
  sessionNotes: string;
  capturedContext: Array<{ type: string; content: string; annotation?: string }>;
}
```

## Implementation Order
1. Schema + DB table (Step 1)
2. Storage CRUD (Step 2)
3. API endpoints (Step 3)
4. Session state type (Step 9)
5. Auto-save hook (Step 4)
6. Resume prompt (Step 5)
7. Session Store panel (Step 6)
8. Workspace integration (Step 8)
9. Preference toggle (Step 7)

## Files Modified
- `shared/models/chat.ts` — new table
- `shared/schema.ts` — new types + Zod schemas
- `server/storage.ts` — CRUD operations
- `server/routes.ts` — API endpoints
- `client/src/hooks/use-session-autosave.ts` — NEW
- `client/src/components/SessionResumePrompt.tsx` — NEW
- `client/src/components/SessionStorePanel.tsx` — NEW
- `client/src/pages/Workspace.tsx` — integration
- `client/src/lib/appWorkspaceConfig.ts` — add session tab to left panel
