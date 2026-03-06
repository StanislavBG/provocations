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

export const APP_VERSION = "0.14.4";

export interface ReleaseNote {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.14.4",
    date: "2026-03-06",
    changes: [
      "Fix brainstorm stance not starting without objective — schema now allows empty objective, client provides sensible default",
      "Fix brainstorm conversation dying after first AI response — state machine now cycles even without TTS audio",
      "Fix trigger nodes unable to auto-fire audio capture — triggers now set autoStartRecording flag on downstream audio nodes",
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
