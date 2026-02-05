# Provocations — Google Apps Script Edition

AI-augmented document workspace for Google Workspace. A port of the Provocations web app to run as a Google Docs/Sheets sidebar add-on.

## Setup

### 1. Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Copy each `.gs` file into the script editor (Code.gs, Config.gs, GeminiService.gs, etc.)
3. Copy each `.html` file as HTML files in the editor (Sidebar.html, SidebarCSS.html, etc.)
4. Copy `appsscript.json` into the manifest (View > Show manifest file)

### 2. Configure Authentication

**Option A: Gemini API Key (simplest)**
1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Open the add-on in a Google Doc: Provocations > Settings
3. Paste your API key and select a model

**Option B: Vertex AI (enterprise)**
1. Ensure your GCP project has Vertex AI API enabled
2. Users need the `Vertex AI User` IAM role
3. In Settings, check "Use Vertex AI" and enter your GCP Project ID
4. Auth uses the running user's Google OAuth token — no API key needed

### 3. Deploy

**For personal use:**
- Just open any Google Doc and the Provocations menu appears

**For organization-wide deployment:**
1. Go to Deploy > Test deployments for testing
2. Go to Deploy > New deployment > Add-on for production
3. Submit to Google Workspace Marketplace (internal or public)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Google Docs / Sheets                           │
│  ┌───────────────────────────────────────────┐  │
│  │  Sidebar (Sidebar.html)                   │  │
│  │  - Plain HTML/CSS/JS                      │  │
│  │  - Web Speech API for voice               │  │
│  │  - google.script.run for server calls     │  │
│  └────────────────┬──────────────────────────┘  │
│                   │                              │
│  ┌────────────────▼──────────────────────────┐  │
│  │  Server-side (*.gs files)                 │  │
│  │  - Code.gs         Entry point, menus     │  │
│  │  - GeminiService   API wrapper            │  │
│  │  - AnalysisService Lenses & provocations  │  │
│  │  - WriterService   Document evolution     │  │
│  │  - StorageService  Sheets-based storage   │  │
│  │  - DriveService    Read from user Drive   │  │
│  │  - Config.gs       Settings & constants   │  │
│  │  - Utils.gs        Helpers                │  │
│  └────────────────┬──────────────────────────┘  │
│                   │                              │
│  ┌────────────────▼──────────────────────────┐  │
│  │  External Services                        │  │
│  │  - Gemini API / Vertex AI                 │  │
│  │  - User's Google Drive                    │  │
│  │  - User's "Provocations Data" Sheet       │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `appsscript.json` | Project manifest, OAuth scopes, add-on config |
| `Code.gs` | Entry point: menus, sidebar, initialization |
| `Config.gs` | Settings, lens/provocation/instruction definitions |
| `GeminiService.gs` | Gemini API wrapper (AI Studio + Vertex AI) |
| `AnalysisService.gs` | Generate lenses and provocations |
| `WriterService.gs` | Document evolution, change analysis, voice cleanup |
| `StorageService.gs` | Per-user Google Sheets storage |
| `DriveService.gs` | Read documents from user's Drive |
| `Utils.gs` | Shared utilities, error logging |
| `Sidebar.html` | Main sidebar HTML |
| `SidebarCSS.html` | Sidebar styles |
| `SidebarJS.html` | Sidebar client-side JavaScript |
| `Settings.html` | Settings dialog |
| `DrivePicker.html` | Drive file picker dialog |

## Data Storage

All user data is stored in a Google Sheet called "Provocations Data" in the user's own Drive:

| Sheet Tab | Contents |
|-----------|----------|
| Documents | Document text, objectives, timestamps |
| Versions | Full version history with descriptions |
| Analysis | Lenses and provocations (as JSON) |
| EditHistory | Instruction history for AI coherence |

Nothing is stored centrally. Each user's data lives in their own Drive.

## Key Differences from Web App

| Web App | Apps Script Edition |
|---------|-------------------|
| React + Vite | Plain HTML/CSS/JS sidebar |
| Express API | `google.script.run` calls |
| OpenAI GPT-5.2 | Gemini (2.0 Flash / 2.5 Pro) |
| In-memory storage | Google Sheets per user |
| PostgreSQL (unused) | Not needed |
| React Query | Direct callbacks |
| SSE streaming | Synchronous (no streaming) |
| Standalone web app | Google Docs/Sheets sidebar |
| npm dependencies | Zero dependencies |
