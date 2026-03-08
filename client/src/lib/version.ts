/**
 * Application version — single source of truth.
 *
 * Versioning follows semver (major.minor.patch):
 * - major: breaking changes or major architectural shifts (we're pre-1.0)
 * - minor: new features, new node types, new capabilities
 * - patch: bug fixes, UI tweaks, small improvements
 *
 * Update this file with every code change / git commit.
 */

export const APP_VERSION = "0.22.0";

export interface ReleaseNote {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.22.0",
    date: "2026-03-08",
    changes: [
      "Infrastructure: health check, structured logging, env validation, CI pipeline, pre-commit hooks",
      "Testing: 146 new tests (crypto, schema, LLM routing, context builder) with mock helpers",
      "Security: helmet CSP, rate limiting (4 tiers), input validation, upload validation",
      "Monetization: subscriptions DB, usage metering (Free/Pro/Team), Stripe webhooks, billing page",
      "Performance: CSS viewport transforms, React.memo, edge caching, route splitting, lazy views, diff-based save",
      "AI/LLM: context budgets, prompt optimization (30% reduction), prompt templates, model routing, fallback retry",
      "New app template: Product Owner Agent — 10-section PO guide framework",
      "Help system: 11 help pages at /help with sidebar, search, contextual ? buttons, What's New badge",
      "Chain reliability: execution locks, error propagation, retry button, progress bar, per-node timeouts, cancel",
      "UX polish: welcome overlay, keyboard shortcuts (?), empty states, ARIA labels, reduced motion, confirmation dialogs",
    ],
  },
  {
    version: "0.21.2",
    date: "2026-03-08",
    changes: [
      "New built-in blueprint: PRD to Reddit Post — 6-node chain that researches subreddit rules, drafts a Reddit-native post from a PRD, validates rule compliance, and outputs to a Reddit-configured social post node",
      "Fix handleLoadBlueprint to carry social-post fields (socialPlatforms, socialIntent, socialTone, socialGenerateImages) through blueprint instantiation",
    ],
  },
  {
    version: "0.21.1",
    date: "2026-03-08",
    changes: [
      "Open Canvas dialog now shows auto-save canvases ([5min]/[Hourly]) in a collapsible section so they match the Context Store",
      "Status bar dropdowns and tooltips now open upwards when the bar is positioned at the bottom",
      "Dock positioning is now aware of status bar position — offsets correctly whether the bar is at top or bottom",
      "Restore Mail system to Flow workspace status bar — bell icon with unread notification count badge",
      "Mailbox drawer accessible from status bar for connection requests, share invitations, and system events",
      "Canvas sharing persists to original owner's context store (Google Drive-style — no copy created)",
      "Write-permission collaborators can save changes directly to the shared canvas via PUT /api/shared/document/:id",
      "Shared canvas indicator badge in status bar shows permission level (edit/view)",
      "Auto-save and debounced save respect shared canvas permissions — read-only canvases are never overwritten",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-03-08",
    changes: [
      "Merge document node voice/text features, dock persistence, and Context Store/tool group improvements into main",
      "Fix dock reordering: user's custom item positions now persist across sessions",
      "Hotkeys 1-9 tied to slot positions — moving an icon to a new slot changes its hotkey",
      "Direct Voice + Direct Text on document toolbar — insert at cursor with no AI remix",
      "Selection quick actions popover — highlight text for Voice Remix, Text Remix, Voice Replace, Text Replace",
      "Writer Voice + Writer Text in document expanded view — dictate or type feedback to evolve the document",
      "Smart keys call /api/write with full context (objective, document, connected inputs)",
      "Context Store Manager: 3-column layout with full-height folder tree, file list, content preview",
      "Context Store Manager respects status bar height offset",
      "Manage Tool Groups dialog: rename/add/delete groups, drag tools between groups",
      "Dock grouped layout with visual group labels",
      "Fix AIQA widget drift via CSS containment",
      "YouTube node multi-video output, Store expanded view redesign",
    ],
  },
  {
    version: "0.20.6",
    date: "2026-03-08",
    changes: [
      "Edge input = manual input: remove redundant generic empty-content blocker in handlePlayNode",
      "The handler's onPreProcess is now the sole authority on whether a node has enough input",
      "Fix LlmExpandedView missing llmOutput in content fallback chain",
    ],
  },
  {
    version: "0.20.5",
    date: "2026-03-08",
    changes: [
      "Fix LLM node producing no output — FlowLlmNode now reads documentContent (not just content/snippet)",
      "Fix user-prompt and system-instruction edges silently dropped from combinedContent in gatherInputContentWithRoles",
      "Add 11 regression tests: gatherInputContentWithRoles role coverage, FlowLlmNode content gathering priority",
    ],
  },
  {
    version: "0.20.4",
    date: "2026-03-08",
    changes: [
      "Fix LLM Base expanded view crash — defensive Array.isArray guard on models query data",
      "Add 26 unit tests for expanded view data logic: edge roles, context gathering, model list handling, prompt assembly",
      "Update vitest config to include .test.tsx files",
    ],
  },
  {
    version: "0.20.3",
    date: "2026-03-08",
    changes: [
      "Resizable left sidebar in Document and LLM Base expanded views — drag edge to resize (220–500px)",
      "Document sidebar opens by default on the Provo tab for immediate provocation workflow",
    ],
  },
  {
    version: "0.20.2",
    date: "2026-03-08",
    changes: [
      "Remove duplicated toolbar strip from Document and LLM Base expanded views — sidebar toggle only",
      "Document objective now uses ProvokeText with smart buttons in a discoverable labeled container",
      "LLM system prompt now uses ProvokeText in a discoverable fuchsia-accented container",
      "Widen document and LLM content areas from max-w-3xl to max-w-5xl for better horizontal utilization",
    ],
  },
  {
    version: "0.20.1",
    date: "2026-03-08",
    changes: [
      "Redesign LLM Base fullscreen as premium chat experience — centered conversation surface, collapsible config sidebar",
      "System prompt as subtle italic field (like document objective), user prompt as main writing surface",
      "Config sidebar starts collapsed, model info shown in compact toolbar strip",
      "Response area with streaming indicator, no container chrome for clean reading",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-03-08",
    changes: [
      "Redesign Document fullscreen as premium notebook experience — centered page, generous margins, warm typography",
      "Sidebar starts collapsed to maximize writing space, toggle with panel icon",
      "Inline toolbar strip replaces sidebar-bound tools for quick access",
      "Objective field integrates as subtle italic prompt at top of page",
      "Document editor uses bare chrome for distraction-free writing",
    ],
  },
  {
    version: "0.19.4",
    date: "2026-03-08",
    changes: [
      "Move LLM Base Run/Stop button into overlay header bar via portal",
    ],
  },
  {
    version: "0.19.3",
    date: "2026-03-08",
    changes: [
      "Unified collapsible tabbed design for both Context and User Prompt connected inputs in LLM Base expanded view",
      "Document fullscreen connected inputs use collapsible tabbed design to save space",
    ],
  },
  {
    version: "0.19.2",
    date: "2026-03-08",
    changes: [
      "Simplify LLM Base to two connection roles: Context (background material → system prompt) and User Prompt (the task → user message)",
      "Remove system-instruction as a separate concept — context connections now serve the same purpose",
      "Expanded view shows unified Context section with connected content + editable additional context",
      "Remove system-instruction from connection dialog (no node accepts it anymore)",
    ],
  },
  {
    version: "0.19.1",
    date: "2026-03-08",
    changes: [
      "Fix LLM Base expanded view — connections now populate fields directly instead of creating duplicate sections",
      "System Prompt: connected system-instructions shown inline with color-coded border, manual text appends after",
      "User Prompt: connected user-prompts shown inline with color-coded border, manual text appends after",
      "Context: shown as read-only reference with amber accent (no duplicate)",
      "Fix Run button from expanded view to include user-prompt connections in the message",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-03-08",
    changes: [
      "Document fullscreen: Objective field — guides AI tools and provocations for better results",
      "Document fullscreen: Version history — every tool/evolve operation auto-snapshots, with one-click revert to any previous version",
      "Smart buttons (Expand, Condense, etc.) now include the objective and connected input context in API calls",
      "Provo tab uses the document objective for more targeted provocations",
      "Objective and version history persist on the node across sessions",
    ],
  },
  {
    version: "0.18.7",
    date: "2026-03-08",
    changes: [
      "Fix document node rename reverting on fullscreen close — manually renamed labels are now preserved instead of being overwritten by auto-derived labels from content",
    ],
  },
  {
    version: "0.18.6",
    date: "2026-03-08",
    changes: [
      "Document fullscreen Provo pane now operates in inline mode — advice and responses accumulate in-place instead of being sent to Notes",
      "Accept button in inline mode marks advice as accepted without leaving the fullscreen view",
      "New 'Evolve Document' button merges all accepted advice and user responses into the document via the writer API",
    ],
  },
  {
    version: "0.18.5",
    date: "2026-03-08",
    changes: [
      "Fix fullscreen overlay scrolling — content area now properly constrains height so ScrollAreas work inside expanded node views",
      "Add 'User Prompt' connection role for LLM Base node — documents can now be connected as user prompts, not just context or system instructions",
    ],
  },
  {
    version: "0.18.4",
    date: "2026-03-08",
    changes: [
      "Fix aurora/BG Labs effect visibility — body background is now fully transparent in aurora mode, preventing backdrop-filter stacking context from blocking the hero layer",
      "Simplify z-index layers: backgrounds (z-0) → canvas/nodes (z-1) → AIQA (z-999999)",
    ],
  },
  {
    version: "0.18.3",
    date: "2026-03-08",
    changes: [
      "Add lock/unlock toggle to dock — items are locked by default, preventing accidental reordering; click the lock icon to unlock and drag items to new positions",
    ],
  },
  {
    version: "0.18.2",
    date: "2026-03-08",
    changes: [
      "Fix: auto-migrate document ownership when users switch auth providers (email → Google), restoring access to canvases lost after Google Auth upgrade",
    ],
  },
  {
    version: "0.18.1",
    date: "2026-03-08",
    changes: [
      "Aurora canvas style: built-in CSS aurora animation replaces external BG-Labs dependency for reliable animated background",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-03-08",
    changes: [
      "Local Marketing Agency infrastructure: event queue system with MCP server for orchestrating local Claude Code agents",
      "New API endpoints: /api/agency/events (CRUD + poll/claim/complete/fail) and /api/agency/campaigns (CRUD)",
      "Database tables: agency_events (event queue) and agency_campaigns (campaign configuration)",
      "MCP Agency Server: bridges Provocations REST API to MCP protocol for local Claude Code consumption",
      "Social poster: added Reddit comment/reply support (commentOnReddit) and X reply support (replyToId on postToX)",
      "Agency directory with 6-agent pipeline prompts (Scout, Analyst, Copywriter, Brand Strategist, QA/Anti-Detection, Creative Director)",
      "Anti-detection writing rules and platform-specific content guidelines for human-grade social media content",
      "Multi-project support: agency/projects/ directory for per-brand configuration",
    ],
  },
  {
    version: "0.17.3",
    date: "2026-03-07",
    changes: [
      "LLM (Text Mods) node is now playable from the compact canvas card — click Play to run without opening the expanded view",
      "Dragged nodes now elevate to the top of the z-stack so they stay visible above other nodes",
      "Fixed node renaming in the expanded overlay — double-click the label, type, and it persists correctly",
      "Added /project-component-compare page with a side-by-side table comparing LLM, LLM Base, and Research nodes",
    ],
  },
  {
    version: "0.17.2",
    date: "2026-03-07",
    changes: [
      "Connection role picker now only shows roles the target node actually accepts — LLM Base shows System Instruction + Context, Research shows Objective + Context + Output Format, Interview shows Objective + Context",
      "Nodes that don't differentiate roles (Painter, Social Post, etc.) skip the role picker entirely",
    ],
  },
  {
    version: "0.17.1",
    date: "2026-03-07",
    changes: [
      "Add delete button for user-created blueprints in the My Blueprints section",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-03-07",
    changes: [
      "Resizable left panel in all expanded node views — drag the divider to see full descriptions, video titles, and controls",
      "Fix expanded view buttons unclickable (YouTube Get Transcript, etc.) — overflow-hidden on content wrapper gives ResizablePanelGroup proper height",
      "Fix AIQA overlay not visible — boost z-index to render above all app UI layers",
    ],
  },
  {
    version: "0.16.13",
    date: "2026-03-07",
    changes: [
      "Brainstorm audio latency overhaul: LLM streaming and TTS WebSocket setup now run in parallel (saves 200-500ms)",
      "ElevenLabs flushContext() called after each sentence to force immediate audio generation instead of buffering",
      "First TTS send threshold lowered to 30 chars to prime audio pipeline earlier",
      "Client audio playback switched from sequential Audio elements to Web Audio API AudioContext with gapless scheduling",
      "Each audio chunk is decoded and scheduled at the exact microsecond the previous chunk ends — zero inter-chunk gaps",
    ],
  },
  {
    version: "0.16.12",
    date: "2026-03-07",
    changes: [
      "Fix interview brainstorm feedback loop: AI audio through speakers no longer triggers self-interrupt",
      "Replace SpeechRecognition-based interrupt with echo-cancelled VAD (voice activity detection)",
      "getUserMedia with echoCancellation filters out speaker output — only real user speech triggers interrupt",
      "SpeechRecognition starts fresh after interrupt with AI audio stopped, so no transcript contamination",
    ],
  },
  {
    version: "0.16.11",
    date: "2026-03-07",
    changes: [
      "Fix multi-select group drag — clicking a node in a multi-selection now keeps the selection and drags all selected nodes together instead of panning the canvas",
    ],
  },
  {
    version: "0.16.10",
    date: "2026-03-07",
    changes: [
      "Fix edge label backgrounds — use fully opaque colors so labels don't bleed through",
      "Fix expanded overlay background — use inset-0 to cover entire viewport with solid background",
      "Disable canvas keyboard shortcuts (WASD, zoom, delete, undo/redo) when node overlay is open",
    ],
  },
  {
    version: "0.16.9",
    date: "2026-03-07",
    changes: [
      "Fix canvas rename overwrite — user-set title no longer gets replaced by auto-save debounce race condition",
      "Fix interview brainstorm audio — falls back to REST TTS when ElevenLabs is unavailable instead of silently skipping",
      "Fix ESC key in expanded overlay — pressing ESC while renaming a label or folder no longer closes the entire overlay",
    ],
  },
  {
    version: "0.16.8",
    date: "2026-03-06",
    changes: [
      "Fix LLM Base expanded view crash — /api/chat/models returns {models: [...]} not a flat array, causing .map() to fail",
    ],
  },
  {
    version: "0.16.7",
    date: "2026-03-06",
    changes: [
      "Restore Component Library button to status bar gear menu — quick access to the component wiki, props, and hooks reference",
    ],
  },
  {
    version: "0.16.6",
    date: "2026-03-06",
    changes: [
      "Unify canvas & blueprint save via shared whitelist serializer — strips transient runtime state, reduces payload size, fixes beacon save reliability",
    ],
  },
  {
    version: "0.16.5",
    date: "2026-03-06",
    changes: [
      "Add AIM (Actor, Input, Mission) tool to document node's Tools panel on the flow canvas",
      "Add error boundary around expanded overlay — render crashes show error message instead of blanking the page",
      "Improve error diagnostics for document load failures (separates DB errors from decrypt errors)",
    ],
  },
  {
    version: "0.16.4",
    date: "2026-03-06",
    changes: [
      "Fix LLM dock icon showing generic Sparkles instead of BrainCircuit — now matches its canvas icon",
      "Add descriptive tooltips to all dock items so users can see what each tool does on hover",
      "Rewrite all tool descriptions to be user-friendly and action-oriented (what you do, what happens)",
    ],
  },
  {
    version: "0.16.3",
    date: "2026-03-06",
    changes: [
      "Add crypto backward compatibility tests (19 tests): old random-salt → new master-salt decrypt, round-trips, error cases, field fallbacks",
      "Add canvas compatibility tests (40 tests): load migration, unknown node types, missing fields, edge formats, realistic production canvases, old-encrypt → new-decrypt round-trip",
      "Fix pre-existing crypto test that expected random salt (now correctly expects fixed master salt)",
    ],
  },
  {
    version: "0.16.2",
    date: "2026-03-06",
    changes: [
      "Add error log button to canvas status bar — bug icon next to Settings shows collected errors with copy-all",
      "Auto-capture API/network errors (500s, fetch failures) into the error log for easy debugging",
    ],
  },
  {
    version: "0.16.1",
    date: "2026-03-06",
    changes: [
      "Fix passive event listener violations: wheel handlers on canvas and minimap now use non-passive native listeners",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-03-06",
    changes: [
      "Add LLM Base node — raw, unrestricted LLM access with full model configuration (temperature, top-p, top-k, max tokens, safety, search grounding, streaming)",
      "LLM Base supports system-instruction edge role for document-driven system prompts",
      "LLM Base works with all providers (Gemini, OpenAI, Anthropic) via model selector",
      "Fix canvas save performance: master key caching eliminates per-encrypt PBKDF2 cost (~10ms → ~0.01ms)",
      "Fix chain nav bar: show only direct upstream/downstream chain, not entire connected component",
      "Fix researcher not picking up newly connected context mid-conversation",
    ],
  },
  {
    version: "0.15.2",
    date: "2026-03-06",
    changes: [
      "Add AIM (Actor, Input, Mission) smart button to Writer panel for framework-based document structuring",
      "Add hover tooltips with descriptions to all Writer panel category headers across all 3 view modes",
      "Default Provo personas to Think Bigger + Architect + one random (3 total) in both Notebook and Flow workspaces",
      "Add 'How it works' section to Provo empty state explaining Generate, Show Advice, and Respond LLM calls",
    ],
  },
  {
    version: "0.15.1",
    date: "2026-03-06",
    changes: [
      "Workspace Tools gateway now sources all 17 tools from DOCK_TOOL_CATALOG (single source of truth in FlowNodeRegistry)",
      "Aurora canvas style: glassmorphism UI with translucent cards, backdrop blur, and dusk palette for visual harmony with BG-Labs background",
      "Fix FtuxDock missing icons for Social Post, API Connection, Notification, Upload, and Approval nodes",
      "Derive FLOW_DOCK_ITEMS from DOCK_TOOL_CATALOG — no more duplicate tool definitions",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-03-06",
    changes: [
      "Replace fake LLM-powered YouTube search/playlist/channel with real YouTube Data API v3",
      "Video player visible by default in expanded view — no click required",
      "Playlist transcript fetch with per-video progress indicator and error handling",
      "Compact YouTube node thumbnail with onError fallback",
      "Brainstorm mode no longer requires an objective — starts open-ended and infers from conversation",
      "Brainstorm state machine cycles continuously (fixes stuck-after-one-message bug)",
      "Trigger nodes auto-fire audio capture via autoStartRecording flag",
      "Context Store Manager converted from Dialog modal to full-frame overlay with two-column layout",
      "Document preview uses ProvokeText (ADR compliance) with read-only and edit modes",
      "Painter node stores imageUrl for both overlay and chain execution paths",
      "Social post lifecycle discovers upstream images via findUpstreamImage() helper",
      "ImagePreviewDialog gets Edit Image toggle with full ImageCustomizer tools",
      "New Approval node type — pauses chain execution until user approves/rejects",
      "Upload node enhanced with folder picker in expanded view",
      "Blueprint sharing UI — share button with connection picker on user blueprints",
      "Add /project-overview page — comprehensive architectural reference for team onboarding",
      "Fix full-view overlay scrolling — canvas no longer scrolls when inside expanded node, documents can scroll past end",
      "Add left context panel to Researcher expanded view showing connected objective, context, and output format sources",
      "Fix Researcher execution when inputs arrive via edge roles (objective/context/output-format) instead of plain connections",
      "Fix output node placement — new output documents now avoid overlapping existing nodes on canvas",
      "Improve node empty states with detailed usage instructions from FlowNodeRegistry descriptions",
      "Sync dock icons with canvas node icons (audio: AudioLines → Mic)",
    ],
  },
  {
    version: "0.14.3",
    date: "2026-03-06",
    changes: [
      "Fix root cause of 'is not iterable' TypeError: StoreExpandedView queryFn normalized /api/documents to bare array, poisoning shared cache for all other components",
      "Normalize all /api/documents and /api/folders consumers to handle both wrapped and bare cache shapes",
      "Fix auto-save purge to handle wrapped API response shape",
    ],
  },
  {
    version: "0.14.2",
    date: "2026-03-06",
    changes: [
      "Fix crash: ContextStoreManager shared query key with FlowWorkspace causing 'is not iterable' TypeError on page load",
      "Add defensive guards to FtuxStatusBar pinned items iteration",
      "Reduce database connection pool size for better resource usage on Replit",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-03-06",
    changes: [
      "Upload node: new flow canvas node for drag-and-drop file uploads (images, video, PDF, text) with image customizer and Context Store save",
      "ImageCustomizer component: reusable drag-to-pan viewport, position/scale sliders, crop presets, metadata/tag editor — embeddable in Upload, Painter, Social Post",
      "Context Store Manager: full-screen overlay (Settings gear → Context Store) with folder tree, file list (list/grid view), upload, preview, rename, move, delete",
      "Backend file upload: POST /api/upload with multer multipart handling, server-side encryption, 50MB limit",
      "Extended docTypes: added video, pdf, media types for richer file classification",
      "Status bar reorganization: Canvas Style + Release Notes + Node Details consolidated into gear/View menus, grouped pinned items with category labels, Blueprints icon-only button",
      "Store node enhanced: folder CRUD and document browser in expanded view",
    ],
  },
  {
    version: "0.13.3",
    date: "2026-03-06",
    changes: [
      "Improve canvas naming — auto-saved canvases now use timestamped names instead of generic 'Flow Canvas'",
      "Show canvas ID in Open Canvas dialog for easy identification",
      "Highlight the currently active canvas in the Open Canvas list",
    ],
  },
  {
    version: "0.13.2",
    date: "2026-03-06",
    changes: [
      "Fix document scroll in expanded view — long documents now scroll properly instead of overflowing",
      "Add Provo tab to document expanded view — generate persona challenges and accept advice directly into the document",
    ],
  },
  {
    version: "0.13.1",
    date: "2026-03-06",
    changes: [
      "Delete canvas from status bar dropdown, Open Canvas dialog, and Canvas toolbar menu",
      "Confirmation dialog before deletion to prevent accidental loss",
      "Deleting the currently-open canvas resets to a blank canvas",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-03-05",
    changes: [
      "Auto-save canvas on every change — 2-second debounce saves all node/edge changes immediately so work is never lost",
      "Auto-create canvas document on first node — new canvases get a document ID automatically, enabling collab and persistence",
      "Broadcast state to collaborators in real time — 500ms debounced full-sync keeps shared canvas users in sync",
      "Flush save on tab close — sendBeacon + visibilitychange ensure the last few seconds of work are persisted",
      "New /api/documents/:id/beacon endpoint for reliable save-on-close",
    ],
  },
  {
    version: "0.12.7",
    date: "2026-03-05",
    changes: [
      "Fix cross-canvas contamination — output nodes from a running chain now stay on the correct canvas tab, even if the user switches tabs mid-execution",
      "Tab-scoped mutations: all addNode, addEdge, and updateNode calls in handlePlayNode route to the execution tab's snapshot when the user is on a different tab",
    ],
  },
  {
    version: "0.12.6",
    date: "2026-03-05",
    changes: [
      "Fix blank page when loading inactive/deleted canvas — status bar and navigation always render so users are never stuck",
      "Show error banner with 'New Canvas' and 'Open Canvas' buttons when a canvas fails to load",
      "Clear localStorage immediately on canvas load failure to prevent retry loops",
    ],
  },
  {
    version: "0.12.5",
    date: "2026-03-05",
    changes: [
      "Fix chain auto-start on canvas load — re-seed chain watcher when loading saved canvases so completed nodes don't trigger downstream execution",
      "Fix duplicate chain execution — re-entrance guard prevents the same node from running concurrently when multiple upstream nodes complete simultaneously",
      "Fix Replace mode race condition — single-execution guarantee ensures old outputs are properly replaced instead of accumulating",
    ],
  },
  {
    version: "0.12.4",
    date: "2026-03-05",
    changes: [
      "Fix /canvas/:id URL loading — always load from URL even if canvas has prior content",
      "Show error toast when canvas fails to load instead of silently redirecting",
    ],
  },
  {
    version: "0.12.3",
    date: "2026-03-05",
    changes: [
      "Double-click node label in expanded overlay to rename it inline",
    ],
  },
  {
    version: "0.12.2",
    date: "2026-03-05",
    changes: [
      "Brainstorm mode: new interview stance for fluid, interruptible voice conversations — uses ElevenLabs multi-context WebSocket for real-time TTS with interruption handling",
      "Always-listening mic: in brainstorm mode, mic stays active during AI speech — start talking to interrupt, AI stops and listens",
      "Multi-context TTS session: new `createMultiContextSession()` in elevenlabs.ts supports concurrent audio contexts with close/interrupt per context",
      "Brainstorm streaming endpoint: `/api/interview/brainstorm/stream` with shorter, more conversational LLM responses (100 words max, temp 1.0)",
      "Conversation turn hook: new `alwaysListening` and `onInterrupt` options for interrupt-aware voice dialog",
      "ElevenLabs default voice: server's ELEVENLABS_VOICE_ID now exposed via /api/tts/elevenlabs/voices and pre-selected in interview dropdowns",
      "Fix canvas save: invalidate document list cache after save/rename so canvases appear immediately in Open Canvas list",
      "Auto-save on rename: naming an unsaved canvas with content now triggers first save automatically",
    ],
  },
  {
    version: "0.12.1",
    date: "2026-03-05",
    changes: [
      "Component Wiki expanded: two new categories — Canvas Nodes (all 17 node types with specs, ports, lifecycle, chain behavior) and Canvas Features (WASD glide, marquee select, undo/redo, freeze, minimap, edge roles, chain execution, themes, collaboration, and more)",
      "Node showcase pages show full Node Specification section: type identity, behavior flags (playable, chainable, lifecycle preset), port diagram, input/output descriptions, and file references (expanded view, lifecycle handler)",
      "Canvas feature entries document hidden capabilities with hooks, key bindings, and how-to-access details",
      "Library cards show node-specific stats (ports, lifecycle, playable/chainable badges) instead of props/hooks for canvas-node entries",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-03-05",
    changes: [
      "Multi-select typed connectors: edge roles now support multiple selections (e.g., both Context + Objective). Role picker shows for all role-aware target nodes (research, interview, LLM, painter, social post, coherence gate)",
      "New Notification node: sends in-app notifications to connected users when chain completes. Configurable message templates with {output}, {label}, {time} placeholders. Recipient picker, delivery channels, canvas link inclusion",
      "Store node upgraded to full citizen: double-click opens expanded overlay with folder picker, document name configuration, and auto-save toggle (previously was a minimal dialog-only picker)",
      "User blueprints: save any canvas as a reusable blueprint. Dynamic Blueprints menu shows built-in, user-created, and shared blueprints. Blueprints stored as encrypted documents and shareable via existing connection system",
      "Edge role badges now show compact abbreviated pills (OBJ/CTX/FMT) that stack horizontally for multi-role edges",
    ],
  },
  {
    version: "0.11.3",
    date: "2026-03-05",
    changes: [
      "Multi-input mode toggle on playable nodes: 'Wait All' (default) waits for every upstream input to complete before running; 'Fire Each' runs the node independently for each input as it arrives",
      "Chain propagation now respects inputMode — 'fire-each' nodes execute immediately on any single input completion, 'wait-all' nodes gate until all upstream sources are done",
      "Structured chain context: nodes now receive `immediateContext` (direct parents with metadata) and `fullChainContext` (entire upstream DAG with depth tracking)",
      "Logic node awareness: chain context entries include verdict (pass/fail), score, and rule metadata from filter/gate/router/merge/coherence-gate nodes",
      "When a logic node is the direct parent, immediate context automatically includes depth-2 (the substantive content node before the logic node) so downstream nodes get both the decision and the data",
      "Trigger node compact view now shows Manual/Timed/Auto mode toggle (was missing Manual)",
      "InputModeToggle shared component used across all playable node types (LLM, Research, YouTube, and generic nodes)",
    ],
  },
  {
    version: "0.11.2",
    date: "2026-03-05",
    changes: [
      "Interview: streaming TTS via ElevenLabs WebSocket — audio plays as question generates instead of waiting for full response, dramatically reducing dead air",
      "Social node: images now propagate through chain execution — upstream images and generated images flow to per-platform output documents",
      "YouTube node: auto-detects input mode (URL/Search/Playlist) from upstream content when expanded; pre-populates URL or search query",
      "Edge connections: port dots enlarged to 16px with 20px hit areas, more visible at rest (scale 75%), stronger hover feedback (140% scale)",
    ],
  },
  {
    version: "0.11.1",
    date: "2026-03-05",
    changes: [
      "Social node: upstream images from painter nodes auto-attached to posts; generate images toggle now calls /api/generate-image",
      "Connection handles: port dots enlarged (14px), always partially visible, larger hit area for easier grabbing, hover scale effect",
      "YouTube node: search results now show thumbnails with click-to-preview video player on right side",
      "YouTube node: dedicated lifecycle handler — auto-detects URL vs search keywords from upstream audio/text nodes in chain execution",
      "Audio node: now sets llmStatus=done and documentContent on recording stop for proper chain propagation to downstream nodes",
      "Interview: mode selector changed to mutually exclusive 'Conversation' vs 'One at a Time' toggle (no longer two independent switches)",
      "Interview: trueInterview mode now defaults to ON and persists to node config (survives overlay close/reopen)",
      "Interview: fixed conversation continuation — re-entrant handleAnswer guard + conversation turn state machine fix (transition to PROCESSING before callback)",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-03-05",
    changes: [
      "YouTube node: 3-mode input (URL, Search, Playlist) with multi-video transcript fetching",
      "YouTube node: auto chapter detection, thumbnail preview, embedded player, search within transcript",
      "YouTube node: search by keywords with Top N / manual selection of results to process",
      "YouTube node: chain propagation fix (sets llmStatus=done so downstream nodes auto-trigger)",
      "YouTube node: playable=true, thumbnail on compact card, removed fake LLM transcript fallback",
      "YouTube API: new /api/youtube/search and /api/youtube/playlist endpoints",
      "Interview: no longer requires objective to start — opens with 'What would you like to discuss?' and infers objective from first answer",
      "Interview: ElevenLabs now preferred TTS provider (when available) with voice selection UI",
      "Interview: voice picker shows ElevenLabs voices and OpenAI voice options when TTS enabled",
      "TTS endpoint: auto-selects ElevenLabs when available, falls back to OpenAI",
      "Status bar: fixed icons for Context Library, Logic, and Research pinned items",
      "Status bar: Logic submenu no longer positions off-screen when status bar is at top",
      "Landing page: BG-labs aurora animation as background with large ProvoIcon logo",
      "Landing page: glassmorphism cards and header over animated aurora backdrop",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-03-05",
    changes: [
      "Lifecycle-driven execution: handlePlayNode now delegates to lifecycle handlers for all node types",
      "Extended NodeProcessContext with role-based inputs (objectiveText, contextText, templateContent)",
      "Added gatherInputContentWithRoles for edge-role-aware input collection",
      "Upgraded research handler with full outputConfig support (split, focus, responseConfig, templates)",
      "Upgraded LLM handler to use preset system (Summarize, Clean Up, Expand, Custom)",
      "System-level chain propagation: reactive watcher auto-propagates when any node reaches done",
      "Post-processing routed by lifecyclePreset: media→image, social→multi-doc, api→status, coherence→pass/fail, text→split/consolidated",
      "Manual mode on compact trigger node with Zap fire button",
      "Fix canvas rename persistence: use PATCH instead of PUT for title-only updates",
      "Restructure menus: File→Canvas Manager with Save, Open, Share, New Canvas",
      "Remove Share dropdown; move Connections and Platform Integrations to Settings gear",
      "Unify New Canvas and New Tab into single New Canvas action",
      "Show timestamps next to canvas names in Open Canvas dialog",
    ],
  },
  {
    version: "0.9.2",
    date: "2026-03-05",
    changes: [
      "Fix double-click expand: move handler to root div, stopPropagation on interactive body areas",
      "Matches pattern used by Research and Document nodes for reliable expand on all node types",
    ],
  },
  {
    version: "0.9.1",
    date: "2026-03-05",
    changes: [
      "Add onDoubleClick prop to Trigger, LLM, Audio, and YouTube nodes",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-05",
    changes: [
      "Add version watermark on canvas and release notes in settings",
      "Enforce versioning conventions in CLAUDE.md",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-03-04",
    changes: [
      "Canvas save/share/load fixes",
      "Blueprint rebrand (demo templates → blueprints)",
      "Auto-trigger chain execution with autoTriggerNext flag",
      "Activity log grouped-by-node view with expand/collapse",
      "Chain context enrichment (chainContext on NodeProcessContext)",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-03-01",
    changes: [
      "Coherence gate node for quality checks",
      "Node pulsing animations during chain execution",
      "Demo chain templates via /api/blueprints",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-02-28",
    changes: [
      "Export pipeline: Markdown + PDF download from document editor",
      "Version diffing for document nodes",
      "Provocation chains",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-02-26",
    changes: [
      "Activity logs overlay with node logs tab",
      "Gear dropdown menu on nodes",
      "Replace/+New output mode toggle",
      "Minimap in View menu",
      "LLM node edge-based input",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-02-24",
    changes: [
      "Multi-select group drag",
      "Social post platform filtering",
      "Consolidated canvas styling menu",
      "Vertical dock layout for left/right positions",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-22",
    changes: [
      "Unique shareable URLs per canvas (/canvas/:id)",
      "Research split mode respects LLM output structure",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-02-20",
    changes: [
      "Flow canvas workspace with dock-based node placement",
      "Node types: context-doc, research, llm, store, painter, interview, timeline, document",
      "Edge/connection system with data flow",
      "Logic nodes: filter, gate, router, merge",
      "Social post and API connection nodes",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-02-15",
    changes: [
      "Initial notebook workspace with 3-panel layout",
      "14 built-in personas with challenge/advice loop",
      "Voice capture via Web Speech API",
      "Zero-knowledge AES-256-GCM encryption",
      "Context Store with document/folder tree",
    ],
  },
];
