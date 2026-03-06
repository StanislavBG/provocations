/**
 * Component Registry — structured metadata for every major UI component
 * in the Provocations application.
 *
 * Used by the ComponentLibrary page to display an interactive catalog
 * of all reusable components, their props, hooks, capabilities,
 * dependencies, and API integrations.
 */

// ── Types ──

export interface PropEntry {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface HookEntry {
  name: string;
  source: string;
  purpose: string;
}

export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  purpose: string;
}

export type ComponentCategory =
  | "notebook"
  | "flow"
  | "bschart"
  | "shared"
  | "ftux"
  | "timeline"
  | "canvas-node"
  | "canvas-feature";

export interface PortInfo {
  side: "left" | "right" | "top" | "bottom";
  type: "input" | "output";
}

export interface NodeMeta {
  /** FlowNodeType string from useFlowCanvas */
  nodeType: string;
  /** Badge label shown on compact card */
  badge: string;
  /** Tailwind accent color name */
  accent: string;
  /** Lifecycle processing category */
  lifecyclePreset: string;
  /** Whether the node shows a Play button */
  playable: boolean;
  /** Whether chain execution can auto-trigger this node */
  supportsChainExecution: boolean;
  /** How it opens on double-click */
  expandMode: "overlay" | "dialog" | "none";
  /** Port definitions */
  ports: PortInfo[];
  /** What it accepts as input */
  inputDescription: string;
  /** What it produces as output */
  outputDescription: string;
  /** Expanded view component (if any) */
  expandedView?: string;
  /** Lifecycle handler file (if any) */
  lifecycleHandler?: string;
  /** Dock group this node belongs to */
  dockGroup?: string;
}

export interface ComponentEntry {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Display name */
  name: string;
  /** File path relative to client/src/ */
  filePath: string;
  /** Category for grouping */
  category: ComponentCategory;
  /** Short description */
  description: string;
  /** Key props */
  props: PropEntry[];
  /** Custom hooks used */
  hooks: HookEntry[];
  /** Capability bullet points */
  capabilities: string[];
  /** App component imports (not shadcn/ui primitives) */
  dependencies: string[];
  /** API endpoints called */
  apiEndpoints: ApiEndpoint[];
  /** Node-specific metadata (canvas-node category only) */
  nodeMeta?: NodeMeta;
}

// ── Registry ──

export const COMPONENT_REGISTRY: ComponentEntry[] = [
  // ════════════════════════════════════════════
  // SHARED COMPONENTS
  // ════════════════════════════════════════════

  {
    id: "provoke-text",
    name: "ProvokeText",
    filePath: "components/ProvokeText.tsx",
    category: "shared",
    description:
      "Universal text component (ADR-mandated). All text display and editing must use this. Provides copy, voice, smart processing, metrics, and consistent styling across three chrome levels.",
    props: [
      { name: "value", type: "string", required: true, description: "Current text value" },
      { name: "onChange", type: "(value: string) => void", required: true, description: "Text change callback" },
      { name: "variant", type: '"input" | "textarea" | "editor"', required: false, description: 'Text input mode (default "textarea")' },
      { name: "chrome", type: '"container" | "inline" | "bare"', required: false, description: 'UI wrapper level (default "container")' },
      { name: "label", type: "string", required: false, description: "Container header label text" },
      { name: "labelIcon", type: "ReactNode", required: false, description: "Icon shown beside the label" },
      { name: "readOnly", type: "boolean", required: false, description: "Disable editing while keeping copy functional" },
      { name: "showCopy", type: "boolean", required: false, description: "Show copy-to-clipboard button (default true)" },
      { name: "showClear", type: "boolean", required: false, description: "Show clear text button (default true)" },
      { name: "voice", type: '{ mode: "append" | "replace"; inline?: boolean }', required: false, description: "Voice input configuration" },
      { name: "textProcessor", type: "(text: string, mode: string) => Promise<string>", required: false, description: "Smart text processing function (Clean/Summarize)" },
      { name: "extraSmartModes", type: "SmartModeDef[]", required: false, description: "Additional smart processing modes beyond Clean/Summarize" },
      { name: "actions", type: "ProvokeAction[]", required: false, description: "Custom action buttons in the toolbar" },
      { name: "onSave", type: "() => void", required: false, description: "Save action callback (shows Save button)" },
      { name: "onLoad", type: "() => void", required: false, description: "Load action callback (shows Load button)" },
      { name: "headerActions", type: "ReactNode", required: false, description: "Extra buttons rendered in the container header" },
      { name: "showWordCount", type: "boolean", required: false, description: "Show word count in footer (default true for container)" },
      { name: "showReadingTime", type: "boolean", required: false, description: "Show estimated reading time (default true for container)" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Local editing, voice, smart mode states" },
      { name: "useCallback", source: "react", purpose: "Memoized handlers for copy, clear, voice, processing" },
      { name: "useRef", source: "react", purpose: "Textarea/editor DOM refs for focus management" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Feedback toasts for copy, clear, save" },
    ],
    capabilities: [
      "Three chrome levels: container (bordered card), inline (floating toolbar), bare (no chrome)",
      "Self-contained voice input that auto-enables when editable + substantial",
      "Built-in text processor for Clean and Summarize via /api/summarize-intent",
      "Copy-to-clipboard with toast notification",
      "Clear text with confirmation",
      "Word count and reading time metrics",
      "Save/Load action buttons for context persistence",
      "Custom smart modes via extraSmartModes prop",
      "forwardRef support for imperative focus control",
    ],
    dependencies: ["VoiceRecorder"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/summarize-intent", purpose: "Default text processor for Clean and Summarize smart modes" },
    ],
  },

  {
    id: "voice-recorder",
    name: "VoiceRecorder",
    filePath: "components/VoiceRecorder.tsx",
    category: "shared",
    description:
      "Voice recording button using the useWhisperRecorder hook. Also exports LargeVoiceRecorder (large circular button variant).",
    props: [
      { name: "onTranscript", type: "(text: string) => void", required: true, description: "Called with final transcript text" },
      { name: "onInterimTranscript", type: "(text: string) => void", required: false, description: "Called with interim (in-progress) transcript" },
      { name: "onRecordingChange", type: "(isRecording: boolean) => void", required: false, description: "Recording state change callback" },
      { name: "size", type: '"sm" | "default" | "lg" | "icon"', required: false, description: "Button size variant" },
      { name: "variant", type: '"default" | "ghost" | "outline" | "secondary" | "destructive"', required: false, description: "Button style variant" },
      { name: "label", type: "string", required: false, description: "Button label text" },
      { name: "autoStart", type: "boolean", required: false, description: "Start recording immediately on mount" },
      { name: "chunkIntervalMs", type: "number", required: false, description: "Interval for chunked transcription (ms)" },
    ],
    hooks: [
      { name: "useWhisperRecorder", source: "@/hooks/use-whisper", purpose: "Core recording logic with Web Speech API" },
    ],
    capabilities: [
      "Push-to-record voice input via Web Speech API",
      "Interim and final transcript callbacks",
      "Auto-start mode for immediate recording on mount",
      "Chunked transcription with configurable interval",
      "LargeVoiceRecorder variant with animated circular button",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "markdown-renderer",
    name: "MarkdownRenderer",
    filePath: "components/MarkdownRenderer.tsx",
    category: "shared",
    description:
      "Markdown rendering with chunked lazy loading for long documents. Uses IntersectionObserver for progressive rendering.",
    props: [
      { name: "content", type: "string", required: true, description: "Markdown content to render" },
      { name: "className", type: "string", required: false, description: "Additional CSS classes" },
      { name: "chunkSize", type: "number", required: false, description: "Characters per chunk for lazy loading (default 50000)" },
      { name: "onSelectText", type: "(selectedText: string, position: { x: number; y: number }) => void", required: false, description: "Text selection callback with position" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Track loaded chunk count" },
      { name: "useRef", source: "react", purpose: "IntersectionObserver sentinel ref" },
      { name: "useEffect", source: "react", purpose: "Set up IntersectionObserver for lazy chunk loading" },
    ],
    capabilities: [
      "IntersectionObserver-based lazy chunk loading for long documents",
      "Handles raw data:image/ URLs as plain <img> elements",
      "Text selection callback with screen position (for selection popovers)",
      "Exports markdownToHtml() utility function",
      "Configurable chunk size for performance tuning",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "llm-hover-button",
    name: "LlmHoverButton",
    filePath: "components/LlmHoverButton.tsx",
    category: "shared",
    description:
      "HoverCard wrapper for LLM-triggering buttons (ADR-mandated). Shows pre-call transparency with context blocks, token estimates, and cost preview.",
    props: [
      { name: "previewTitle", type: "string", required: true, description: "Title for the preview widget" },
      { name: "previewBlocks", type: "ContextBlock[]", required: true, description: "Context blocks describing LLM input chunks" },
      { name: "previewSummary", type: "SummaryItem[]", required: true, description: "Human-readable summary items" },
      { name: "children", type: "ReactElement", required: true, description: "The button element to wrap" },
      { name: "side", type: '"top" | "bottom" | "left" | "right"', required: false, description: "HoverCard placement side" },
      { name: "align", type: '"start" | "center" | "end"', required: false, description: "HoverCard alignment" },
      { name: "collisionPadding", type: "number | Partial<Record<Side, number>>", required: false, description: "Collision padding for positioning" },
    ],
    hooks: [],
    capabilities: [
      "Pre-call LLM transparency: shows what context will be sent before clicking",
      "Two-tab preview widget (Perf + Summary) via LlmCallPreview",
      "Token and cost estimation based on context block sizes",
      "Re-exports ContextBlock, SummaryItem, estimateTokens, CHARS_PER_TOKEN",
    ],
    dependencies: ["LlmCallPreview"],
    apiEndpoints: [],
  },

  {
    id: "llm-call-preview",
    name: "LlmCallPreview",
    filePath: "components/LlmCallPreview.tsx",
    category: "shared",
    description:
      "Generic pre-call LLM transparency widget with two tabs: Perf (context blocks, tokens, cost) and Summary (human-readable breakdown).",
    props: [
      { name: "title", type: "string", required: true, description: "Preview widget title" },
      { name: "blocks", type: "ContextBlock[]", required: true, description: "Context block descriptions with label, chars, color" },
      { name: "summaryItems", type: "SummaryItem[]", required: true, description: "Summary rows with icon, label, count" },
    ],
    hooks: [
      { name: "useActiveModel", source: "self (exported)", purpose: "Fetch current LLM model from /api/chat/models" },
      { name: "useActiveModelInfo", source: "self (exported)", purpose: "Get model name, provider, and cost info" },
    ],
    capabilities: [
      "Two-tab widget: Perf tab (stacked bar, token estimates, cost) and Summary tab (items list)",
      "LLM_COST_TABLE with pricing for gpt-4o, gpt-4o-mini, o4-mini, claude-sonnet-4-5, gemini models",
      "CHARS_PER_TOKEN = 4 constant for token estimation",
      "Exports estimateTokens(), estimateInputCost(), useActiveModel(), useActiveModelInfo()",
    ],
    dependencies: [],
    apiEndpoints: [
      { method: "GET", endpoint: "/api/chat/models", purpose: "Fetch active LLM model for cost estimation" },
    ],
  },

  {
    id: "llm-context-plan",
    name: "LlmContextPlan",
    filePath: "components/LlmContextPlan.tsx",
    category: "shared",
    description:
      "Post-call LLM transparency overlay. Shows model, provider, parameters, context size, response size, cost, and timing. Also exports VerboseToast.",
    props: [
      { name: "entries", type: "LlmVerboseEntry[]", required: true, description: "Array of LLM call trace entries" },
      { name: "compact", type: "boolean", required: false, description: "Use compact layout" },
      { name: "onDismiss", type: "() => void", required: false, description: "Close/dismiss callback" },
    ],
    hooks: [],
    capabilities: [
      "Collapsible post-call LLM transparency panel",
      "Shows model, provider, parameters, context/response size, cost, timing",
      "VerboseToast component for floating toast-style summary",
      "Mirrors pre-call LlmCallPreview with post-call data",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "storage-panel",
    name: "StoragePanel",
    filePath: "components/StoragePanel.tsx",
    category: "shared",
    description:
      "Context Store browser panel with full document/folder management, drag-and-drop, search, sort, and document preview.",
    props: [
      { name: "isOpen", type: "boolean", required: true, description: "Whether the panel is visible" },
      { name: "onClose", type: "() => void", required: true, description: "Close panel callback" },
      { name: "onLoadDocument", type: "(doc: { id: number; title: string; content: string }) => void", required: true, description: "Load document into editor" },
      { name: "onSave", type: "(title: string, folderId: number | null) => Promise<void>", required: true, description: "Save current document" },
      { name: "hasContent", type: "boolean", required: true, description: "Whether there is content to save" },
      { name: "currentDocId", type: "number | null", required: false, description: "Currently loaded document ID" },
      { name: "currentTitle", type: "string", required: false, description: "Currently loaded document title" },
    ],
    hooks: [
      { name: "useQuery", source: "@tanstack/react-query", purpose: "Fetch documents and folders from API" },
      { name: "useMutation", source: "@tanstack/react-query", purpose: "Create/update/delete documents and folders" },
      { name: "useQueryClient", source: "@tanstack/react-query", purpose: "Invalidate queries after mutations" },
      { name: "useRole", source: "@/hooks/use-role", purpose: "Check admin role for special capabilities" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "User feedback toasts" },
    ],
    capabilities: [
      "Full document/folder tree browser with expandable folders",
      "Drag-and-drop with custom DRAG_MIME type for reordering",
      "Search and sort (name, date, type)",
      "Document preview with markdown rendering",
      "Create, rename, delete documents and folders",
      "File upload support",
      "Resizable split panel (tree + preview)",
    ],
    dependencies: ["ProvokeText", "MarkdownRenderer"],
    apiEndpoints: [
      { method: "GET", endpoint: "/api/documents", purpose: "List user's documents" },
      { method: "POST", endpoint: "/api/documents", purpose: "Create new document" },
      { method: "GET", endpoint: "/api/documents/:id", purpose: "Load document content" },
      { method: "PUT", endpoint: "/api/documents/:id", purpose: "Update document content" },
      { method: "DELETE", endpoint: "/api/documents/:id", purpose: "Delete document" },
      { method: "GET", endpoint: "/api/folders", purpose: "List user's folders" },
      { method: "POST", endpoint: "/api/folders", purpose: "Create new folder" },
      { method: "PATCH", endpoint: "/api/folders/:id", purpose: "Rename folder" },
      { method: "DELETE", endpoint: "/api/folders/:id", purpose: "Delete folder" },
    ],
  },

  {
    id: "generate-panel",
    name: "GeneratePanel",
    filePath: "components/GeneratePanel.tsx",
    category: "shared",
    description:
      "Document generation panel supporting infographic generation. Auto-saves generated documents to Context Store.",
    props: [
      { name: "documentText", type: "string", required: true, description: "Source document text for generation" },
      { name: "objective", type: "string", required: true, description: "Current objective text" },
      { name: "generatedDocs", type: "GeneratedDocument[]", required: true, description: "Previously generated documents" },
      { name: "onDocGenerated", type: "(doc: GeneratedDocument) => void", required: true, description: "Callback when new document is generated" },
      { name: "onDocRemove", type: "(id: string) => void", required: true, description: "Remove generated document" },
      { name: "onDocPreview", type: "(doc: GeneratedDocument) => void", required: false, description: "Preview generated document" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Generation state, selected format, progress" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Success/error toasts" },
    ],
    capabilities: [
      "Infographic generation from document text",
      "Auto-save generated documents to Context Store",
      "Preview generated documents",
      "LLM hover preview for generation button (via LlmHoverButton)",
    ],
    dependencies: ["LlmHoverButton"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/summarize-intent", purpose: "Pre-process text before generation (2 calls)" },
      { method: "POST", endpoint: "/api/generate-image", purpose: "Generate infographic image" },
      { method: "POST", endpoint: "/api/documents", purpose: "Auto-save generated document to Context Store" },
    ],
  },

  {
    id: "artify-panel",
    name: "ArtifyPanel",
    filePath: "components/ArtifyPanel.tsx",
    category: "shared",
    description:
      "Image generation panel with style, aspect ratio, and mood presets. Uses Gemini Imagen for generation.",
    props: [
      { name: "sourceText", type: "string", required: true, description: "Source text to generate image from" },
      { name: "sourceLabel", type: "string", required: true, description: "Label for the source text" },
      { name: "onClose", type: "() => void", required: true, description: "Close panel callback" },
      { name: "onImageGenerated", type: "(imageUrl: string, prompt: string) => void", required: false, description: "Callback when image is generated" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Style, aspect, mood selection and generation state" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Success/error feedback" },
    ],
    capabilities: [
      "10 style presets (e.g., photorealistic, watercolor, pencil sketch)",
      "5 aspect ratio options",
      "8 mood presets (e.g., dramatic, serene, vibrant)",
      "Automatic prompt crafting from source text via /api/summarize-intent",
      "Image generation via /api/generate-imagen (Gemini Imagen)",
    ],
    dependencies: [],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/summarize-intent", purpose: "Craft image prompt from source text" },
      { method: "POST", endpoint: "/api/generate-imagen", purpose: "Generate image with Gemini Imagen" },
    ],
  },

  {
    id: "diff-view",
    name: "DiffView",
    filePath: "components/DiffView.tsx",
    category: "shared",
    description:
      "Version comparison component showing line-level diffs between two document versions with color-coded additions and deletions.",
    props: [
      { name: "previousVersion", type: "DocumentVersion", required: true, description: "The earlier version to compare" },
      { name: "currentVersion", type: "DocumentVersion", required: true, description: "The later version to compare" },
    ],
    hooks: [
      { name: "useMemo", source: "react", purpose: "Memoize diff computation" },
    ],
    capabilities: [
      "Line-level diff with color-coded additions (green) and deletions (red)",
      "Simple diff algorithm (not LCS-based, optimized for readability)",
      "Side-by-side version metadata display",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "chat-drawer",
    name: "ChatDrawer",
    filePath: "components/ChatDrawer.tsx",
    category: "shared",
    description:
      "Slide-out messaging panel for user-to-user conversations. Supports four views: conversations list, message thread, settings, and connections management.",
    props: [
      { name: "open", type: "boolean", required: true, description: "Whether the drawer is open" },
      { name: "onOpenChange", type: "(open: boolean) => void", required: true, description: "Open state change callback" },
      { name: "sessionContext", type: "ChatSessionContext", required: true, description: "Current session context (objective, template, excerpt)" },
      { name: "activeConversationId", type: "number | null", required: true, description: "Currently active conversation ID" },
      { name: "onActiveConversationChange", type: "(id: number | null) => void", required: true, description: "Conversation change callback" },
      { name: "embedded", type: "boolean", required: false, description: "Use embedded layout (no Sheet wrapper)" },
    ],
    hooks: [
      { name: "useQuery", source: "@tanstack/react-query", purpose: "Fetch conversations, connections, messages" },
      { name: "useMutation", source: "@tanstack/react-query", purpose: "Send messages, mark read" },
      { name: "useUser", source: "@clerk/clerk-react", purpose: "Current user info for message rendering" },
    ],
    capabilities: [
      "Four-view navigation: conversations list, message thread, settings, connections",
      "Real-time message sending and reading",
      "Connection management (invite, accept, reject)",
      "Embedded mode for use inside panels (no Sheet wrapper)",
    ],
    dependencies: [],
    apiEndpoints: [
      { method: "GET", endpoint: "/api/chat/conversations", purpose: "List user's conversations" },
      { method: "GET", endpoint: "/api/chat/connections", purpose: "List user's connections" },
      { method: "GET", endpoint: "/api/chat/messages/:id", purpose: "Fetch conversation messages" },
      { method: "POST", endpoint: "/api/chat/messages", purpose: "Send message in conversation" },
      { method: "POST", endpoint: "/api/chat/messages/:id/read", purpose: "Mark messages as read" },
    ],
  },

  // ════════════════════════════════════════════
  // NOTEBOOK COMPONENTS
  // ════════════════════════════════════════════

  {
    id: "notebook-top-bar",
    name: "NotebookTopBar",
    filePath: "components/notebook/NotebookTopBar.tsx",
    category: "notebook",
    description:
      "Session header bar with brand logo, version toggle, chat/video/mailbox buttons, layout config, theme toggle, and admin controls.",
    props: [
      { name: "isAdmin", type: "boolean", required: true, description: "Whether user has admin role" },
      { name: "versionCount", type: "number", required: false, description: "Number of document versions for diff toggle" },
      { name: "showVersions", type: "boolean", required: false, description: "Whether version diff view is active" },
      { name: "onToggleVersions", type: "() => void", required: false, description: "Toggle version diff view" },
      { name: "panelLayout", type: "PanelLayoutConfig", required: false, description: "Current panel layout configuration" },
      { name: "onPanelLayoutChange", type: "(layout: PanelLayoutConfig) => void", required: false, description: "Panel layout change callback" },
      { name: "chatSessionContext", type: "ChatSessionContext", required: false, description: "Chat session context for drawer" },
      { name: "activeChatConversationId", type: "number | null", required: false, description: "Active chat conversation ID" },
      { name: "onActiveChatConversationChange", type: "(id: number | null) => void", required: false, description: "Chat conversation change callback" },
      { name: "dockPrefs", type: "DockPrefs", required: false, description: "Dock preferences for absorbed dock items" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Toggle states for chat, video, mailbox, layout dialog" },
      { name: "useMemo", source: "react", purpose: "Build PeerChat URL with user info" },
      { name: "useUser", source: "@clerk/clerk-react", purpose: "User info for PeerChat display name" },
      { name: "useQuery", source: "@tanstack/react-query", purpose: "Poll unread notification count" },
    ],
    capabilities: [
      "Brand logo and navigation link to home",
      "Document version count badge with diff toggle",
      "Mailbox drawer with unread badge (polls every 15s)",
      "Chat drawer integration",
      "PeerChat video room via embedded iframe",
      "Panel layout configuration dialog",
      "Theme and palette toggle",
      "Admin link to /admin dashboard",
      "Absorbed dock items when dock is hidden",
    ],
    dependencies: [
      "ChatDrawer",
      "MailboxDrawer",
      "ThemeToggle",
      "PaletteToggle",
      "AbsorbedDockItems",
      "DebugButton",
      "LlmTraceButton",
      "MessageLogButton",
      "PanelLayoutDialog",
      "ProvoIcon",
    ],
    apiEndpoints: [
      { method: "GET", endpoint: "/api/mailbox/unread-count", purpose: "Poll unread notification count for badge" },
    ],
  },

  {
    id: "notebook-research-chat",
    name: "NotebookResearchChat",
    filePath: "components/notebook/NotebookResearchChat.tsx",
    category: "notebook",
    description:
      "Streaming research chat interface via SSE. Supports 7 focus modes (Explore, Verify, Gather, Analyze, Synthesize, Reason, Deep Research) with configurable response detail, format, audience, and tone.",
    props: [
      { name: "objective", type: "string", required: true, description: "Current research objective" },
      { name: "onCaptureToContext", type: "(text: string, label: string) => void", required: true, description: "Capture AI response as active context" },
      { name: "onMessageCountChange", type: "(count: number) => void", required: false, description: "Reports message count changes to parent" },
      { name: "initialMessages", type: "ChatMessageWithMeta[]", required: false, description: "Externally provided messages for restoring conversation" },
      { name: "onMessagesChange", type: "(messages: ChatMessageWithMeta[]) => void", required: false, description: "Called whenever messages change for parent persistence" },
      { name: "connectionContext", type: "ResearchConnectionContext | null", required: false, description: "Connection context from Flow Canvas for node-linked research" },
      { name: "onEmitOutput", type: "(data: { type: string; url: string; title?: string }) => void", required: false, description: "Emit structured output to downstream flow nodes" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Messages, focus mode, response config, streaming state" },
      { name: "useRef", source: "react", purpose: "Scroll container, abort controller, message refs" },
      { name: "useCallback", source: "react", purpose: "Message send, capture, clear handlers" },
      { name: "useMemo", source: "react", purpose: "Focus mode defaults, context block calculations" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Error and success feedback" },
    ],
    capabilities: [
      "7 research focus modes with distinct default response configurations",
      "Streaming responses via Server-Sent Events (SSE) on /api/chat/stream",
      "Citation parsing and rendering in AI responses",
      "Research plan generation and step-by-step execution",
      "Configurable response detail level, format, audience, and tone",
      "Capture AI responses as context items",
      "Voice input for research queries via VoiceRecorder",
      "LLM hover preview on send button",
      "YouTube URL detection and structured output emission",
      "Session summarization via /api/chat/summarize",
    ],
    dependencies: ["ProvokeText", "VoiceRecorder", "LlmHoverButton"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/chat/stream", purpose: "Streaming research chat via SSE" },
      { method: "POST", endpoint: "/api/chat/summarize", purpose: "Summarize a research chat session" },
      { method: "POST", endpoint: "/api/chat/save-session", purpose: "Save research chat session to context" },
    ],
  },

  {
    id: "provo-thread",
    name: "ProvoThread",
    filePath: "components/notebook/ProvoThread.tsx",
    category: "notebook",
    description:
      "Multi-persona discussion thread. Generates challenges from active personas, displays them as SmartBubble cards, and supports advice generation and response capture.",
    props: [
      { name: "documentText", type: "string", required: true, description: "Current document text for challenge generation" },
      { name: "objective", type: "string", required: true, description: "Current objective for context" },
      { name: "activePersonas", type: "Set<ProvocationType>", required: true, description: "Set of active persona IDs" },
      { name: "onTogglePersona", type: "(id: ProvocationType) => void", required: true, description: "Toggle persona active state" },
      { name: "onCaptureToContext", type: "(text: string, label: string) => void", required: true, description: "Capture text as context item" },
      { name: "hasDocument", type: "boolean", required: true, description: "Whether a document exists for challenge generation" },
      { name: "pinnedDocContents", type: "Record<number, { title: string; content: string }>", required: false, description: "Pinned document contents for enriched context" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Challenges, generation state, expanded bubbles" },
      { name: "useCallback", source: "react", purpose: "Generate, dismiss, respond handlers" },
      { name: "useMemo", source: "react", purpose: "Context blocks for LLM hover preview" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Feedback toasts" },
    ],
    capabilities: [
      "Generate challenges from multiple active personas simultaneously",
      "SmartBubble cards with expand/collapse for each challenge",
      "Advice generation for individual challenges",
      "Accept/dismiss individual provocations",
      "Respond to challenges via text (captures response as context)",
      "Persona avatar row for toggling active personas",
      "LLM hover preview on Generate Provocations button",
    ],
    dependencies: ["PersonaAvatarRow", "ProvokeText", "LlmHoverButton"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/generate-challenges", purpose: "Generate persona-specific challenges" },
      { method: "POST", endpoint: "/api/generate-advice", purpose: "Generate advice for a specific challenge" },
    ],
  },

  {
    id: "split-document-editor",
    name: "SplitDocumentEditor",
    filePath: "components/notebook/SplitDocumentEditor.tsx",
    category: "notebook",
    description:
      "Multi-tab document editor supporting document, chart, image, and timeline tabs. Uses forwardRef with imperative handle for external tab creation.",
    props: [
      { name: "text", type: "string", required: true, description: "Current document text" },
      { name: "onTextChange", type: "(text: string) => void", required: true, description: "Document text change callback" },
      { name: "isMerging", type: "boolean", required: false, description: "Whether an LLM merge is in progress" },
      { name: "objective", type: "string", required: false, description: "Current objective text" },
      { name: "onObjectiveChange", type: "(objective: string) => void", required: false, description: "Objective change callback" },
      { name: "previewDoc", type: "PreviewDoc | null", required: false, description: "Document preview overlay data" },
      { name: "onClosePreview", type: "() => void", required: false, description: "Close preview overlay" },
      { name: "onOpenPreviewDoc", type: "(content: string, title: string, docId?: number) => void", required: false, description: "Open document in preview overlay" },
      { name: "onChartActiveChange", type: "(isActive: boolean) => void", required: false, description: "Notify parent when chart tab is active" },
      { name: "onSaveToContext", type: "(tabTitle?: string) => void", required: false, description: "Save tab content to Context Store" },
      { name: "onWriterFeedback", type: "(instruction: string, selectedText?: string, description?: string) => void", required: false, description: "Writer feedback with optional text selection" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Tab management, active tab, edit state" },
      { name: "useRef", source: "react", purpose: "Editor refs, imperative handle forwarding" },
      { name: "useCallback", source: "react", purpose: "Tab CRUD, content change handlers" },
      { name: "useImperativeHandle", source: "react", purpose: "Expose addImageTab, addTimelineTabWithData to parent" },
    ],
    capabilities: [
      "Multi-tab interface with document, chart, image, and timeline tab types",
      "forwardRef with SplitDocumentEditorHandle for imperative tab creation",
      "Writer voice/text feedback with selection popover for targeted edits",
      "Tab rename, close, reorder",
      "Document preview overlay for context documents",
      "Save individual tabs to Context Store",
      "Smart buttons: Expand, Condense, Restructure, Clarify, Style, Correct",
    ],
    dependencies: ["ProvokeText", "MarkdownRenderer", "BSChartWorkspace", "TimelineWorkspace", "VoiceRecorder"],
    apiEndpoints: [],
  },

  {
    id: "context-sidebar",
    name: "ContextSidebar",
    filePath: "components/notebook/ContextSidebar.tsx",
    category: "notebook",
    description:
      "Full document/folder tree browser with pin/unpin, search, inline rename/delete, and share support. Used in the left panel of NotebookWorkspace.",
    props: [
      { name: "pinnedDocIds", type: "Set<number>", required: true, description: "Set of pinned document IDs" },
      { name: "onPinDoc", type: "(id: number) => void", required: true, description: "Pin document callback" },
      { name: "onUnpinDoc", type: "(id: number) => void", required: true, description: "Unpin document callback" },
      { name: "onPreviewDoc", type: "(id: number, title: string) => void", required: false, description: "Single-click preview callback" },
      { name: "onOpenDoc", type: "(id: number, title: string) => void", required: false, description: "Double-click open for editing callback" },
      { name: "isCollapsed", type: "boolean", required: true, description: "Whether sidebar is collapsed" },
      { name: "onToggleCollapse", type: "() => void", required: true, description: "Toggle collapse callback" },
      { name: "embedded", type: "boolean", required: false, description: "Render without own header/border (for use inside tabs)" },
    ],
    hooks: [
      { name: "useQuery", source: "@tanstack/react-query", purpose: "Fetch documents and folders" },
      { name: "useMutation", source: "@tanstack/react-query", purpose: "CRUD operations on documents and folders" },
      { name: "useQueryClient", source: "@tanstack/react-query", purpose: "Invalidate queries after mutations" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Operation feedback toasts" },
    ],
    capabilities: [
      "Expandable folder tree with depth-based indentation",
      "Pin/unpin documents for LLM context enrichment",
      "Single-click preview, double-click open for editing",
      "Inline rename and delete for documents and folders",
      "Search/filter across all documents",
      "Create new documents and folders",
      "Share dialog integration",
      "Embedded mode for use inside NotebookLeftPanel tabs",
      "Document type icons (image, timeline, chart, note, default)",
    ],
    dependencies: ["ShareDialog"],
    apiEndpoints: [
      { method: "GET", endpoint: "/api/documents", purpose: "List user's documents" },
      { method: "POST", endpoint: "/api/documents", purpose: "Create new document" },
      { method: "DELETE", endpoint: "/api/documents/:id", purpose: "Delete document" },
      { method: "PATCH", endpoint: "/api/documents/:id", purpose: "Rename document" },
      { method: "GET", endpoint: "/api/folders", purpose: "List user's folders" },
      { method: "POST", endpoint: "/api/folders", purpose: "Create new folder" },
      { method: "PATCH", endpoint: "/api/folders/:id", purpose: "Rename folder" },
      { method: "DELETE", endpoint: "/api/folders/:id", purpose: "Delete folder" },
    ],
  },

  {
    id: "persona-avatar-row",
    name: "PersonaAvatarRow",
    filePath: "components/notebook/PersonaAvatarRow.tsx",
    category: "notebook",
    description:
      "Persona selector row with avatar toggles grouped by domain (Business, Technology, Marketing). Filters out master_researcher.",
    props: [
      { name: "activePersonas", type: "Set<ProvocationType>", required: true, description: "Set of currently active persona IDs" },
      { name: "onToggle", type: "(id: ProvocationType) => void", required: true, description: "Toggle persona active state" },
      { name: "compact", type: "boolean", required: false, description: "Use compact layout" },
    ],
    hooks: [],
    capabilities: [
      "Domain grouping: Business, Technology, Marketing sections",
      "Toggle individual personas on/off via avatar clicks",
      "Compact mode for smaller displays",
      "Filters out master_researcher from display",
      "Uses builtInPersonas from @shared/personas",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "transcript-panel",
    name: "TranscriptPanel",
    filePath: "components/notebook/TranscriptPanel.tsx",
    category: "notebook",
    description:
      "Notes management panel. Captures context items via text and voice, supports summarize, import from Context Store, map to timeline, and evolve document actions.",
    props: [
      { name: "capturedContext", type: "ContextItem[]", required: true, description: "Array of captured context items" },
      { name: "onCaptureToContext", type: "(text: string, label: string) => void", required: true, description: "Add new context item" },
      { name: "onRemoveCapturedItem", type: "(itemId: string) => void", required: false, description: "Remove a captured context item" },
      { name: "onMoveToDocument", type: "(content: string) => void", required: false, description: "Move content into the document" },
      { name: "onEvolveDocument", type: "(instruction: string, description: string) => void", required: false, description: "Evolve document using captured notes" },
      { name: "onMapNotesToTimeline", type: "() => void", required: false, description: "Map notes to timeline events" },
      { name: "isMapPending", type: "boolean", required: false, description: "Whether timeline mapping is in progress" },
      { name: "hasDocument", type: "boolean", required: true, description: "Whether a document exists" },
      { name: "isMerging", type: "boolean", required: true, description: "Whether an LLM merge is in progress" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Note input, summarize state, import dialog" },
      { name: "useCallback", source: "react", purpose: "Add, remove, summarize, import handlers" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Feedback toasts" },
    ],
    capabilities: [
      "Add notes via text or voice input",
      "Remove individual captured context items",
      "Summarize all notes via /api/summarize-intent",
      "Import documents from Context Store as notes",
      "Map notes to timeline events",
      "Evolve document using captured notes as instructions",
      "LLM hover preview on Summarize, Map to Timeline, and Evolve buttons",
      "TranscriptFooter sub-component with action buttons",
    ],
    dependencies: ["MarkdownRenderer", "ProvokeText", "VoiceRecorder", "LlmHoverButton"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/summarize-intent", purpose: "Summarize captured notes" },
      { method: "POST", endpoint: "/api/documents", purpose: "Save summarized notes to Context Store" },
      { method: "GET", endpoint: "/api/documents", purpose: "List documents for import dialog" },
      { method: "GET", endpoint: "/api/documents/:id", purpose: "Load document content for import" },
    ],
  },

  // ════════════════════════════════════════════
  // FLOW CANVAS COMPONENTS
  // ════════════════════════════════════════════

  {
    id: "flow-canvas",
    name: "FlowCanvas",
    filePath: "components/flow/FlowCanvas.tsx",
    category: "flow",
    description:
      "Main flow canvas renderer. Handles viewport transform, node rendering with type-specific components, edge layer, drag-drop from dock, multi-selection, and align/distribute toolbar.",
    props: [
      { name: "state", type: "FlowCanvasState", required: true, description: "Complete flow state (nodes, edges, viewport, selection)" },
      { name: "frozen", type: "boolean", required: false, description: "Disable all interactions when overlay is open" },
      { name: "onMoveNode", type: "(nodeId: string, x: number, y: number) => void", required: true, description: "Move single node" },
      { name: "onMoveNodes", type: "(nodeIds: string[], dx: number, dy: number) => void", required: false, description: "Move multiple nodes by delta" },
      { name: "onDeleteNode", type: "(nodeId: string) => void", required: true, description: "Delete a node" },
      { name: "onSelectNode", type: "(nodeId: string | null) => void", required: true, description: "Select/deselect a node" },
      { name: "onNodeDoubleClick", type: "(nodeId: string) => void", required: true, description: "Open node full view on double-click" },
      { name: "onViewportChange", type: "(x: number, y: number, zoom: number) => void", required: true, description: "Viewport pan/zoom change" },
      { name: "onUpdateNode", type: "(nodeId: string, patch: Partial<FlowNode>) => void", required: true, description: "Patch node properties" },
      { name: "onCreateNote", type: "(content: string, label: string, sourceNodeId?: string) => void", required: true, description: "Create new note node from content" },
      { name: "onCreateEdge", type: "(fromNodeId: string, toNodeId: string) => void", required: false, description: "Create edge between nodes" },
      { name: "onDropTool", type: "(toolId: string, canvasX: number, canvasY: number) => void", required: false, description: "Handle tool drop from dock at canvas position" },
      { name: "minimapState", type: "ReturnType<typeof useMinimapState>", required: false, description: "Minimap state for rendering" },
    ],
    hooks: [
      { name: "useFlowInteraction", source: "components/flow/useFlowInteraction", purpose: "Pan, zoom, drag, selection, screenToCanvas conversion" },
      { name: "useMemo", source: "react", purpose: "Viewport virtualization, node partitioning" },
      { name: "useCallback", source: "react", purpose: "Event handlers for drag-drop, alignment" },
    ],
    capabilities: [
      "Viewport virtualization: only renders nodes within visible area + 200px buffer",
      "Partitions nodes into canvas-space and screen-space groups",
      "Type-specific rendering: FlowLlmNode, FlowStoreNode, FlowDocumentNode, FlowZoneNode, FlowResearchNode, FlowAudioNode, FlowYoutubeNode, FlowTimerEventNode",
      "Drag-and-drop from dock with dataTransfer tool ID",
      "Multi-selection with align/distribute toolbar",
      "Canvas texture background",
      "Edge layer with animated edges for running nodes",
      "Minimap integration",
      "Preview edge while drawing connections",
    ],
    dependencies: [
      "FlowNodeContainer",
      "FlowNodeRenderer",
      "FlowStoreNode",
      "FlowLlmNode",
      "FlowDocumentNode",
      "FlowZoneNode",
      "FlowLabelNode",
      "FlowResearchNode",
      "FlowAudioNode",
      "FlowYoutubeNode",
      "FlowTimerEventNode",
      "FlowEdgeLayer",
      "FlowMinimap",
    ],
    apiEndpoints: [],
  },

  {
    id: "flow-node-renderer",
    name: "FlowNodeRenderer",
    filePath: "components/flow/FlowNodeRenderer.tsx",
    category: "flow",
    description:
      "Generic compact node renderer (React.memo). Renders standard node card with header (icon, label, badge/play button), content snippet, port dots, and hover controls (lock, delete). Special transparent rendering for label-type nodes.",
    props: [
      { name: "node", type: "FlowNode", required: true, description: "Node data to render" },
      { name: "isSelected", type: "boolean", required: true, description: "Whether node is selected" },
      { name: "onMouseDown", type: "(e: React.MouseEvent, nodeId: string) => void", required: true, description: "Mouse down handler for drag" },
      { name: "onDoubleClick", type: "(e: React.MouseEvent, nodeId: string) => void", required: true, description: "Double-click handler for full view" },
      { name: "onDelete", type: "(nodeId: string) => void", required: true, description: "Delete node callback" },
      { name: "onToggleLock", type: "(nodeId: string) => void", required: false, description: "Cycle lock mode: none -> canvas -> screen -> none" },
      { name: "onPortMouseDown", type: "(e: React.MouseEvent, nodeId: string, portType: 'input' | 'output') => void", required: false, description: "Port interaction for edge creation" },
      { name: "onPlayNode", type: "(nodeId: string) => void", required: false, description: "Execute playable node" },
      { name: "onUpdateLabel", type: "(nodeId: string, label: string) => void", required: false, description: "Update label text (for label nodes)" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Inline label editing state" },
      { name: "useRef", source: "react", purpose: "ContentEditable ref for label editing" },
      { name: "useCallback", source: "react", purpose: "Label commit handler" },
      { name: "useEffect", source: "react", purpose: "Focus contentEditable when editing starts" },
    ],
    capabilities: [
      "Standard node rendering with type-specific styling from FlowNodeRegistry",
      "Label-type nodes render as transparent contentEditable text annotations",
      "Lock mode cycling: none (unlocked) -> canvas (locked to canvas) -> screen (locked to viewport)",
      "Play button for executable/playable node types (painter, youtube, etc.)",
      "Running state indicator with spinner",
      "Pause indicator badge",
      "Port dots for edge connections via FlowPortDots",
      "Hover-reveal lock and delete buttons",
    ],
    dependencies: ["FlowPortDots", "FlowNodeRegistry"],
    apiEndpoints: [],
  },

  {
    id: "flow-edge-layer",
    name: "FlowEdgeLayer",
    filePath: "components/flow/FlowEdgeLayer.tsx",
    category: "flow",
    description:
      "SVG edge rendering layer (React.memo). Draws curved arrows between nodes with smart endpoint selection, animated conveyor-belt edges for running nodes, role labels, and hover-to-delete.",
    props: [
      { name: "nodes", type: "FlowNode[]", required: true, description: "All nodes for endpoint computation" },
      { name: "edges", type: "FlowEdge[]", required: true, description: "Edge connections to render" },
      { name: "previewEdge", type: "PreviewEdge | null", required: false, description: "Edge being drawn (in-progress connection)" },
      { name: "onDeleteEdge", type: "(edgeId: string) => void", required: false, description: "Delete edge callback" },
    ],
    hooks: [
      { name: "useMemo", source: "react", purpose: "Build node map and latest-edge-from-node map" },
      { name: "useState", source: "react", purpose: "Hovered edge ID tracking" },
    ],
    capabilities: [
      "Smart endpoint selection: horizontal or vertical edge attachment based on node relative positions",
      "Research node zone targeting (objective, context, output-format zones)",
      "Animated conveyor-belt edges for painter (rose), YouTube (red), timer-event (emerald) nodes",
      "Traveling blob animations along edge paths (circle blobs for painter, rect for YouTube/timer)",
      "Glow trail effect for active edges",
      "Role labels on edges (objective, context, output-format) with color-coded badges",
      "Hover-to-delete: shows red X button at edge midpoint",
      "Wide invisible hit area (14px) for easy hover/click targeting",
      "Preview edge rendering while drawing new connections",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "flow-minimap",
    name: "FlowMinimap",
    filePath: "components/flow/FlowMinimap.tsx",
    category: "flow",
    description:
      "Factorio-inspired minimap with draggable header, resizable edges, collapsible toggle, and viewport rectangle navigation. Supports click-to-navigate and Shift+scroll zoom.",
    props: [
      { name: "nodes", type: "FlowNode[]", required: true, description: "All nodes for minimap rendering" },
      { name: "edges", type: "FlowEdge[]", required: true, description: "All edges for minimap rendering" },
      { name: "viewport", type: "FlowViewport", required: true, description: "Current viewport state" },
      { name: "selectedNodeIds", type: "Set<string>", required: true, description: "Selected node IDs for highlighting" },
      { name: "canvasWidth", type: "number", required: true, description: "Canvas container width" },
      { name: "canvasHeight", type: "number", required: true, description: "Canvas container height" },
      { name: "onViewportChange", type: "(x: number, y: number, zoom: number) => void", required: true, description: "Viewport change callback for navigation" },
      { name: "onFitToView", type: "() => void", required: false, description: "Fit all nodes in view" },
      { name: "minimapState", type: "ReturnType<typeof useMinimapState>", required: true, description: "Minimap position, size, collapsed state" },
    ],
    hooks: [
      { name: "useMemo", source: "react", purpose: "Compute bounding box, scale, node positions" },
      { name: "useCallback", source: "react", purpose: "Click-to-navigate, drag viewport rectangle" },
      { name: "useRef", source: "react", purpose: "SVG element ref for coordinate calculations" },
    ],
    capabilities: [
      "Draggable position via header grab handle",
      "Resizable via edge handles (8 directions)",
      "Collapsible toggle to minimize/expand",
      "Viewport rectangle drag for canvas panning",
      "Click-to-navigate on minimap body",
      "Shift+scroll for minimap zoom",
      "Detail levels based on minimap size (edges shown at >= 150px, labels at >= 250px)",
      "NODE_TYPE_COLORS exported for consistent color coding",
      "Fit-to-view button in header",
      "Selected node highlighting with accent ring",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "flow-llm-node",
    name: "FlowLlmNode",
    filePath: "components/flow/FlowLlmNode.tsx",
    category: "flow",
    description:
      "Specialized LLM node (React.memo) with preset system (Summarize, Clean, Expand, Custom), voice input via Web Speech API, run button, and output display with copy/save actions.",
    props: [
      { name: "node", type: "FlowNode", required: true, description: "LLM node data" },
      { name: "isSelected", type: "boolean", required: true, description: "Whether node is selected" },
      { name: "allNodes", type: "FlowNode[]", required: true, description: "All nodes for input resolution" },
      { name: "selectedNodeIds", type: "Set<string>", required: true, description: "Selected node IDs for input filtering" },
      { name: "onMouseDown", type: "(e: React.MouseEvent, nodeId: string) => void", required: true, description: "Drag handler (header only)" },
      { name: "onDelete", type: "(nodeId: string) => void", required: true, description: "Delete node callback" },
      { name: "onUpdateNode", type: "(nodeId: string, patch: Partial<FlowNode>) => void", required: true, description: "Patch node properties" },
      { name: "onToggleLock", type: "(nodeId: string) => void", required: false, description: "Cycle lock mode" },
      { name: "onCreateNote", type: "(content: string, label: string, sourceNodeId?: string) => void", required: true, description: "Create output document node" },
      { name: "onPortMouseDown", type: "(e: React.MouseEvent, nodeId: string, portType: 'input' | 'output') => void", required: false, description: "Port interaction for edge creation" },
    ],
    hooks: [
      { name: "useState", source: "react", purpose: "Copied state, recording state" },
      { name: "useRef", source: "react", purpose: "SpeechRecognition instance ref" },
      { name: "useCallback", source: "react", purpose: "Preset change, voice toggle, run, copy, save handlers" },
      { name: "useMemo", source: "react", purpose: "Resolve input nodes from selection or all documents" },
      { name: "useToast", source: "@/hooks/use-toast", purpose: "Run success/error feedback" },
    ],
    capabilities: [
      "4 LLM presets: Summarize, Clean, Expand, Custom (from llm-presets.ts)",
      "Preset chip selector with color-coded active states",
      "Custom objective editing via textarea (Custom preset only)",
      "Voice input via native Web Speech API (not VoiceRecorder component)",
      "Run button that processes selected/all input nodes through preset endpoint",
      "Output display with copy-to-clipboard and save-as-note actions",
      "Creates output document node downstream after successful run",
      "Status indicators: idle, running (spinner), done (check), error (alert)",
      "Interactive body stops canvas drag propagation",
    ],
    dependencies: ["FlowPortDots"],
    apiEndpoints: [],
  },

  {
    id: "flow-store-node",
    name: "FlowStoreNode",
    filePath: "components/flow/FlowStoreNode.tsx",
    category: "flow",
    description:
      "Context Store node for save/load operations on the flow canvas (React.memo). Shows folder path or empty state prompting double-click to pick folder.",
    props: [
      { name: "node", type: "FlowNode", required: true, description: "Store node data" },
      { name: "isSelected", type: "boolean", required: true, description: "Whether node is selected" },
      { name: "onMouseDown", type: "(e: React.MouseEvent, nodeId: string) => void", required: true, description: "Drag handler" },
      { name: "onDoubleClick", type: "(e: React.MouseEvent, nodeId: string) => void", required: true, description: "Open full view (folder picker)" },
      { name: "onDelete", type: "(nodeId: string) => void", required: true, description: "Delete node callback" },
      { name: "onToggleLock", type: "(nodeId: string) => void", required: false, description: "Cycle lock mode" },
      { name: "onPortMouseDown", type: "(e: React.MouseEvent, nodeId: string, portType: 'input' | 'output') => void", required: false, description: "Port interaction for edge creation" },
    ],
    hooks: [],
    capabilities: [
      "Displays folder path when configured or 'Double-click to pick folder' empty state",
      "Lock mode cycling with lock/unlock/monitor indicators",
      "Port dots for edge connections",
      "Hover-reveal delete button",
    ],
    dependencies: ["FlowPortDots"],
    apiEndpoints: [],
  },

  // ════════════════════════════════════════════
  // BS CHART COMPONENTS
  // ════════════════════════════════════════════

  {
    id: "bschart-workspace",
    name: "BSChartWorkspace",
    filePath: "components/bschart/BSChartWorkspace.tsx",
    category: "bschart",
    description:
      "Main chart workspace container with toolbar, canvas, and properties panels. Supports undo/redo, keyboard shortcuts, snap-to-grid, voice commands, import/export.",
    props: [
      { name: "onExportToDocument", type: "(markdown: string) => void", required: false, description: "Export chart as markdown to document editor" },
      { name: "onSaveToContext", type: "(json: string, label: string) => void", required: false, description: "Save chart JSON to Context Store" },
    ],
    hooks: [
      { name: "useChartState", source: "components/bschart/hooks/useChartState", purpose: "All chart operations: add/move/update/delete nodes and connectors" },
    ],
    capabilities: [
      "Full chart workspace with toolbar, canvas, and properties panels",
      "Keyboard shortcuts (V=select, H=pan, C=connect, R=rectangle, etc.)",
      "Undo/redo for all chart operations",
      "Zoom controls with fit-to-view",
      "Snap-to-grid with configurable grid size",
      "Voice chart commands via useVoiceChartCommands hook",
      "Import/export chart data as JSON",
      "Export as markdown for document integration",
      "Save to Context Store",
    ],
    dependencies: ["BSChartCanvas", "BSChartToolbar", "BSChartProperties"],
    apiEndpoints: [],
  },

  {
    id: "bschart-canvas",
    name: "BSChartCanvas",
    filePath: "components/bschart/BSChartCanvas.tsx",
    category: "bschart",
    description:
      "Canvas rendering layer for BS Chart. Handles viewport transform, node/connector rendering, and all canvas interactions.",
    props: [
      { name: "chart", type: "BSChart", required: true, description: "Chart data (nodes, connectors)" },
      { name: "toolMode", type: "BSToolMode", required: true, description: "Active tool mode (select, pan, connect, create)" },
      { name: "onAddNode", type: "(type: BSNodeType, x: number, y: number) => void", required: true, description: "Add new node at position" },
      { name: "onMoveNode", type: "(nodeId: string, x: number, y: number) => void", required: true, description: "Move node to position" },
      { name: "onMoveNodeEnd", type: "() => void", required: true, description: "Finish node move (for undo tracking)" },
      { name: "onUpdateNode", type: "(nodeId: string, updates: { label?: string }) => void", required: true, description: "Update node properties" },
      { name: "onSelectNodes", type: "(nodeIds: string[], additive?: boolean) => void", required: true, description: "Select nodes (with optional additive mode)" },
      { name: "onAddConnector", type: "(fromNodeId: string, fromPort: BSPortSide, toNodeId: string, toPort: BSPortSide) => void", required: true, description: "Add connector between node ports" },
      { name: "onViewportChange", type: "(x: number, y: number, zoom: number) => void", required: true, description: "Viewport transform change" },
    ],
    hooks: [
      { name: "useCanvasInteraction", source: "components/bschart/hooks/useCanvasInteraction", purpose: "Pan, zoom, drag, selection interactions" },
    ],
    capabilities: [
      "Canvas viewport transform with pan and zoom",
      "Node rendering via BSNodeRenderer (table, diamond, rect, text, badge types)",
      "Connector rendering via BSConnectorLayer",
      "Tool mode switching for different interaction behaviors",
      "Additive selection with Shift key",
      "Grid background rendering",
    ],
    dependencies: ["BSNodeRenderer", "BSConnectorLayer"],
    apiEndpoints: [],
  },

  // ════════════════════════════════════════════
  // TIMELINE COMPONENTS
  // ════════════════════════════════════════════

  {
    id: "timeline-workspace",
    name: "TimelineWorkspace",
    filePath: "components/timeline/TimelineWorkspace.tsx",
    category: "timeline",
    description:
      "Timeline creation workspace with events, tags, filtering, era discovery, and text-to-timeline transformation via LLM.",
    props: [
      { name: "onSaveToContext", type: "(json: string, label: string) => void", required: false, description: "Save timeline JSON to Context Store" },
      { name: "initialData", type: "string", required: false, description: "Initial timeline data as JSON string" },
      { name: "onTimelineSummaryChange", type: "(summary: TimelineSummary) => void", required: false, description: "Callback when timeline summary changes" },
    ],
    hooks: [
      { name: "useTimelineState", source: "components/timeline/hooks/useTimelineState", purpose: "Timeline state management (events, tags, view settings)" },
    ],
    capabilities: [
      "Timeline event creation and editing",
      "Tag system for categorizing events",
      "Filtering events by tags, date range, or search text",
      "Text-to-timeline transformation via /api/timeline/transform",
      "Era discovery via /api/timeline/discover-era",
      "Timeline canvas rendering with zoom and scroll",
      "Properties panel for editing selected events",
      "Save to Context Store as JSON",
      "LLM hover preview on transform and discover buttons",
      "TimelineSummary output with date range, places, themes, event count",
    ],
    dependencies: ["TimelineCanvas", "TimelineToolbar", "TimelineProperties", "LlmHoverButton"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/timeline/transform", purpose: "Transform text content into timeline events" },
      { method: "POST", endpoint: "/api/timeline/discover-era", purpose: "Discover historical era context for events" },
    ],
  },

  // ════════════════════════════════════════════
  // FTUX (First-Time User Experience) COMPONENTS
  // ════════════════════════════════════════════

  {
    id: "ftux-shell",
    name: "FtuxShell",
    filePath: "components/ftux/FtuxShell.tsx",
    category: "ftux",
    description:
      "Outer shell layout frame. Positions status bar, dock, and content area dynamically based on shell context preferences.",
    props: [
      { name: "children", type: "ReactNode", required: true, description: "Content to render inside the shell frame" },
    ],
    hooks: [
      { name: "useFtuxShell", source: "@/lib/ftux-shell-context", purpose: "Read statusBarPosition from shell context" },
    ],
    capabilities: [
      "Dynamic flex direction based on status bar position (top or bottom)",
      "CSS custom properties for status bar height and dock height",
      "Full screen layout frame (h-screen w-screen)",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "ftux-dock",
    name: "FtuxDock",
    filePath: "components/ftux/FtuxDock.tsx",
    category: "ftux",
    description:
      "Configurable macOS-style dock with 2-row grid of tool slots, drag-to-reorder, auto-hide, translucency, snap-to-edge, context menus (pin to status bar), and system buttons (Workspace Tools, Blueprints, Settings).",
    props: [],
    hooks: [
      { name: "useFtuxShell", source: "@/lib/ftux-shell-context", purpose: "All dock state: items, position, translucency, autoHide, color, size, snapped, activeTool, statusBarPinnedItems" },
      { name: "useState", source: "react", purpose: "Visibility, settings dialog, context menu, blueprint menu, grid slots" },
      { name: "useRef", source: "react", purpose: "Drag source slot, auto-hide timeout" },
      { name: "useCallback", source: "react", purpose: "Drag start/over/drop/end, auto-hide mouse enter/leave" },
      { name: "useMemo", source: "react", purpose: "Sync slots when dockItems change externally" },
    ],
    capabilities: [
      "2-row x 10-column grid of tool slots with drag-to-reorder",
      "3 button sizes: small, medium, large (with expanded mode when snapped)",
      "Position: top, bottom, left, right (with snapped or floating modes)",
      "Auto-hide with hover zone and 800ms timeout",
      "Configurable translucency with backdrop blur",
      "Custom dock background color",
      "Show/hide labels beneath icons",
      "Context menu: pin/unpin items to status bar",
      "Drag-and-drop to canvas (dataTransfer with flow-tool MIME type)",
      "System buttons: Workspace Tools (AleComponentGateway), Settings (FtuxSettingsDialog)",
      "Blueprints loaded via top menu bar (GET /api/blueprints)",
      "Keyboard shortcut indicators (1-9) on slots",
      "Active tool indicator dot",
    ],
    dependencies: ["FtuxSettingsDialog", "AleComponentGateway"],
    apiEndpoints: [],
  },
  // ════════════════════════════════════════════
  // CANVAS NODE TYPES
  // ════════════════════════════════════════════

  {
    id: "node-context-doc",
    name: "Context Document",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "A loaded document from the Context Store. Read-only source node that provides text content to downstream processors. Double-click opens an inline document viewer/editor.",
    props: [],
    hooks: [],
    capabilities: [
      "Loads encrypted documents from Context Store",
      "Displays document title and content snippet on compact card",
      "Double-click opens full document viewer/editor overlay",
      "Output port feeds content to downstream nodes (research, LLM, etc.)",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "GET", endpoint: "/api/documents/:id", purpose: "Load document content" },
    ],
    nodeMeta: {
      nodeType: "context-doc",
      badge: "Context",
      accent: "amber",
      lifecyclePreset: "passive",
      playable: false,
      supportsChainExecution: false,
      expandMode: "overlay",
      ports: [{ side: "right", type: "output" }],
      inputDescription: "No input — loaded from Context Store. Contains the document title, content, and metadata.",
      outputDescription: "Full document text content. Connected downstream nodes receive the document body as context.",
      dockGroup: "Context",
    },
  },

  {
    id: "node-research",
    name: "Research",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "AI research chat node with streaming SSE responses. Supports three edge roles (objective, context, output-format) for structured input. Produces consolidated or split output documents.",
    props: [],
    hooks: [],
    capabilities: [
      "Streaming research chat via /api/chat/stream (SSE)",
      "Three edge roles: objective (top zone), context (middle), output-format (bottom)",
      "Persistent conversation history across sessions",
      "Output modes: consolidated (1 doc) or split (N docs, max 5 sections)",
      "Focus modes: explore, gather, analyze, synthesize, deep-research",
      "Response config: format (prose/structured/outline/academic), detail, audience, tone",
      "Template content injection from upstream output-format edges",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/chat/stream", purpose: "Streaming research chat (SSE)" },
    ],
    nodeMeta: {
      nodeType: "research",
      badge: "Research",
      accent: "blue",
      lifecyclePreset: "stream",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Accepts three edge roles: Objective (what to research), Context (background documents), and Output Format (schema/template for structuring results).",
      outputDescription: "Produces a research document based on the objective, context, and output format. Can output 1 consolidated doc or N split docs depending on output mode.",
      expandedView: "FlowResearchNode (inline in FlowWorkspace)",
      lifecycleHandler: "lifecycles/research.ts",
      dockGroup: "Research",
    },
  },

  {
    id: "node-llm",
    name: "Text Mods (LLM)",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Text transformation node with 4 built-in presets: Summarize, Clean Up, Expand, and Custom. Each preset routes to the appropriate API endpoint. Custom mode accepts freeform instructions.",
    props: [],
    hooks: [],
    capabilities: [
      "4 built-in presets: Summarize, Clean Up, Expand, Custom",
      "Summarize and Clean route through /api/summarize-intent",
      "Expand and Custom route through /api/write",
      "Preset chips selectable on compact card",
      "Custom instruction text input in expanded view",
      "Chain execution auto-applies selected preset to upstream content",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer", "FlowLlmNode"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/summarize-intent", purpose: "Summarize and Clean presets" },
      { method: "POST", endpoint: "/api/write", purpose: "Expand and Custom presets" },
    ],
    nodeMeta: {
      nodeType: "llm",
      badge: "Text Mods",
      accent: "violet",
      lifecyclePreset: "llm",
      playable: false,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Text content from connected source nodes. Applies a selected preset transformation (Summarize, Clean, Expand, or Custom instruction).",
      outputDescription: "Transformed text after applying the selected preset. The output replaces or appends to the node's content.",
      expandedView: "expanded/LlmExpandedView.tsx",
      lifecycleHandler: "lifecycles/llm.ts",
      dockGroup: "Text Mods",
    },
  },

  {
    id: "node-store",
    name: "Store (Save File)",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Terminal node that saves upstream content to the Context Store. Double-click opens a folder picker dialog to choose the destination folder. No output port.",
    props: [],
    hooks: [],
    capabilities: [
      "Saves content to Context Store as encrypted documents",
      "Folder picker dialog on double-click",
      "Embedded ContextSidebar for folder browsing",
      "Terminal node — no downstream output",
    ],
    dependencies: ["FlowStoreNode", "ContextSidebar"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/documents", purpose: "Save new document to store" },
    ],
    nodeMeta: {
      nodeType: "store",
      badge: "Store",
      accent: "primary",
      lifecyclePreset: "passive",
      playable: false,
      supportsChainExecution: false,
      expandMode: "dialog",
      ports: [{ side: "left", type: "input" }],
      inputDescription: "Receives content from upstream nodes to be saved. The destination folder is configured on the node.",
      outputDescription: "No output — this is a terminal node. Content is persisted to the Context Store.",
      expandedView: "FlowStoreNode.tsx (folder picker dialog)",
      dockGroup: "Context",
    },
  },

  {
    id: "node-painter",
    name: "Painter (Image Generation)",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Image generation node using Gemini Imagen. Accepts text prompts or upstream context to generate images. Output includes both the generated image URL and the prompt used.",
    props: [],
    hooks: [],
    capabilities: [
      "Image generation via Gemini Imagen API",
      "Accepts text description or upstream context as prompt",
      "Displays generated image thumbnail on compact card",
      "Structured output parsing (PROMPT:... IMAGE:... format)",
      "Chain execution creates downstream image document nodes",
      "Save generated images to Context Store",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/generate-image", purpose: "Generate image from text prompt" },
    ],
    nodeMeta: {
      nodeType: "painter",
      badge: "Painter",
      accent: "rose",
      lifecyclePreset: "media",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Text description or prompt that guides the image generation. Connected documents provide subject matter context.",
      outputDescription: "Generated image (PNG). The image URL is stored on the node and can be saved to Context Store.",
      lifecycleHandler: "lifecycles/painter.ts",
      dockGroup: "Painter",
    },
  },

  {
    id: "node-interview",
    name: "Interview",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Guided interview session node. AI asks probing questions based on objective/context, user responds via voice or text. Supports streaming TTS (ElevenLabs), journalist stance config, and auto-summarization for chain output.",
    props: [],
    hooks: [],
    capabilities: [
      "AI-driven Q&A interview sessions",
      "Streaming TTS via ElevenLabs WebSocket (with REST fallback)",
      "Journalist stance: investigative, exploratory, balanced, autobiography",
      "Auto-start without objective (infers from first answer)",
      "Voice input via Web Speech API",
      "Q&A entry storage with timestamps",
      "Auto-summarization on chain execution via /api/interview/summary",
      "Voice selection UI for ElevenLabs voices",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/interview/question/stream", purpose: "Streaming interview question (SSE + TTS audio)" },
      { method: "POST", endpoint: "/api/interview/question", purpose: "REST fallback for question generation" },
      { method: "POST", endpoint: "/api/interview/summary", purpose: "Synthesize interview entries into document" },
      { method: "POST", endpoint: "/api/tts", purpose: "Text-to-speech (ElevenLabs preferred, browser fallback)" },
    ],
    nodeMeta: {
      nodeType: "interview",
      badge: "Interview",
      accent: "cyan",
      lifecyclePreset: "interview",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Objective text and context documents that define the interview topic. Supports journalist stance configuration.",
      outputDescription: "Interview transcript (Q&A entries). Can be summarized into a structured document for downstream nodes.",
      expandedView: "FlowInterviewOverlay (in FlowWorkspace)",
      lifecycleHandler: "lifecycles/interview.ts",
      dockGroup: "Interview",
    },
  },

  {
    id: "node-timeline",
    name: "Timeline",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Visual timeline creation node. Accepts text describing events and produces a structured chronological timeline document. Uses the generic LLM lifecycle for processing.",
    props: [],
    hooks: [],
    capabilities: [
      "Chronological event organization",
      "LLM-powered timeline extraction from unstructured text",
      "Timeline era discovery via /api/timeline/discover-era",
      "Timeline transformation via /api/timeline/transform",
      "Structured output with dated entries",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/write", purpose: "Process content into timeline format" },
      { method: "POST", endpoint: "/api/timeline/discover-era", purpose: "Discover timeline eras" },
      { method: "POST", endpoint: "/api/timeline/transform", purpose: "Transform timeline data" },
    ],
    nodeMeta: {
      nodeType: "timeline",
      badge: "Timeline",
      accent: "orange",
      lifecyclePreset: "llm",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Text content describing events, milestones, or items to arrange chronologically.",
      outputDescription: "Structured timeline document with dated entries. Can feed into downstream document or store nodes.",
      dockGroup: "Timeline",
    },
  },

  {
    id: "node-document",
    name: "Document",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Editable document node created as output from other nodes (research, LLM, interview). Contains markdown text that can be edited inline and fed to downstream nodes.",
    props: [],
    hooks: [],
    capabilities: [
      "Inline markdown editing on double-click",
      "Auto-created by upstream node processing (research output, interview summary)",
      "Content snippet preview on compact card",
      "Output port for downstream chain processing",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "document",
      badge: "Document",
      accent: "indigo",
      lifecyclePreset: "passive",
      playable: false,
      supportsChainExecution: false,
      expandMode: "overlay",
      ports: [{ side: "right", type: "output" }],
      inputDescription: "No automatic input — content is edited directly or created by upstream nodes (e.g., research output).",
      outputDescription: "Markdown text content. Connected downstream nodes receive the full document text.",
      dockGroup: "Context",
    },
  },

  {
    id: "node-zone",
    name: "Zone",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Visual grouping container. Zones are transparent rectangles that organize nodes spatially on the canvas. No data flow participation. Supports 7 color options and zoom-responsive LOD rendering.",
    props: [],
    hooks: [],
    capabilities: [
      "Visual-only grouping container (no data flow)",
      "7 color options: blue, green, amber, rose, violet, cyan, gray",
      "Custom label editing",
      "Zoom-responsive LOD: labels/controls fade below 0.25 zoom",
      "Dragging a zone moves all contained nodes",
      "No ports, no expand, no play button",
    ],
    dependencies: ["FlowZoneNode"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "zone",
      badge: "Zone",
      accent: "primary",
      lifecyclePreset: "passive",
      playable: false,
      supportsChainExecution: false,
      expandMode: "none",
      ports: [],
      inputDescription: "No input — zones are visual grouping containers. They don't participate in data flow.",
      outputDescription: "No output — zones organize nodes visually but don't produce data.",
    },
  },

  {
    id: "node-audio",
    name: "Audio (Voice Capture)",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Voice recording node using Web Speech API for real-time transcription. Records audio and produces text transcripts that can feed into LLM, research, or document nodes.",
    props: [],
    hooks: [],
    capabilities: [
      "Real-time voice transcription via Web Speech API",
      "Microphone recording with browser-native APIs",
      "Transcript output as text content",
      "Output port for feeding transcripts to downstream processors",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "audio",
      badge: "Audio",
      accent: "red",
      lifecyclePreset: "passive",
      playable: false,
      supportsChainExecution: false,
      expandMode: "overlay",
      ports: [{ side: "right", type: "output" }],
      inputDescription: "No input — records audio directly via microphone using Web Speech API for real-time transcription.",
      outputDescription: "Transcribed text from voice recording. Can be connected to LLM, Research, or Document nodes for processing.",
      expandedView: "expanded/AudioExpandedView.tsx",
      dockGroup: "Audio",
    },
  },

  {
    id: "node-youtube",
    name: "YouTube",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "YouTube video transcript extraction with 3 input modes: URL (direct), Search (keyword), and Playlist. Supports multi-video transcript fetching, chapter detection, embedded player, and thumbnail display on compact card.",
    props: [],
    hooks: [],
    capabilities: [
      "3 input modes: URL, Search (keyword), Playlist",
      "Multi-video transcript fetching with topN limiting",
      "Automatic chapter detection",
      "Video metadata preservation (duration, views, channel, date)",
      "Embedded YouTube player in expanded view",
      "Thumbnail display on compact card",
      "Auto-mode detection from upstream input content",
      "Chain propagation sets llmStatus=done for downstream triggers",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/youtube/transcript", purpose: "Fetch video transcript" },
      { method: "POST", endpoint: "/api/youtube/search", purpose: "Search YouTube by keyword" },
      { method: "POST", endpoint: "/api/youtube/playlist", purpose: "Fetch playlist videos" },
    ],
    nodeMeta: {
      nodeType: "youtube",
      badge: "YouTube",
      accent: "red",
      lifecyclePreset: "youtube",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "YouTube URL, search keywords, or playlist URL. Can receive keywords from upstream context nodes for automated search.",
      outputDescription: "Extracted video transcript(s) with chapters and metadata. Multi-video mode merges all transcripts.",
      expandedView: "expanded/YoutubeExpandedView.tsx",
      lifecycleHandler: "lifecycles/youtube.ts",
      dockGroup: "YouTube",
    },
  },

  {
    id: "node-timer-event",
    name: "Trigger (Timer Event)",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Chain trigger node with 3 modes: Manual (fire button), Timed (interval-based), and Automated (fires when upstream completes). Drives chain execution by sending pulse signals downstream.",
    props: [],
    hooks: [],
    capabilities: [
      "3 trigger modes: Manual, Timed, Automated",
      "Manual mode: shows 'Fire Chain' button on compact card",
      "Timed mode: configurable interval in milliseconds (default 5000ms)",
      "Automated mode: fires when upstream node completes",
      "Pulse tracking: timerPulseCount and timerLastPulse timestamp",
      "Auto-creates/appends to 'Trigger Log' document node",
      "Lifecycle engine runs triggers outside render cycle (immune to viewport culling)",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "timer-event",
      badge: "Trigger",
      accent: "emerald",
      lifecyclePreset: "timer",
      playable: false,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Trigger signal from upstream nodes or timer configuration. Can be timed (interval) or automated (on upstream completion).",
      outputDescription: "Fires a pulse signal to connected downstream nodes, triggering their execution in sequence.",
      expandedView: "expanded/TimerExpandedView.tsx",
      lifecycleHandler: "lifecycles/timer.ts",
      dockGroup: "Trigger",
    },
  },

  {
    id: "node-filter",
    name: "Filter",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Logic node that evaluates a condition rule to filter content. Only items matching the rule pass through to downstream nodes. Part of the Logic dock group with gate, router, merge, and coherence-gate.",
    props: [],
    hooks: [],
    capabilities: [
      "Line-based content filtering with string-contains matching",
      "Configurable logicRule text",
      "Passes matching content, blocks non-matching",
      "Part of Logic dock group (shared picker popup)",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "filter",
      badge: "Filter",
      accent: "emerald",
      lifecyclePreset: "logic",
      playable: false,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Content from upstream nodes. The filter evaluates a condition rule to decide what passes through.",
      outputDescription: "Filtered content — only items matching the condition rule are forwarded to downstream nodes.",
      expandedView: "expanded/LogicExpandedView.tsx",
      lifecycleHandler: "lifecycles/logic.ts",
      dockGroup: "Logic",
    },
  },

  {
    id: "node-gate",
    name: "Gate",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Logic node with a simple open/closed toggle. When open, passes all content through unchanged. When closed, blocks all downstream propagation. Part of the Logic dock group.",
    props: [],
    hooks: [],
    capabilities: [
      "Binary open/closed toggle (gateOpen boolean)",
      "Open: passes content unchanged",
      "Closed: blocks all downstream propagation",
      "Visual indicator of gate state on compact card",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "gate",
      badge: "Gate",
      accent: "amber",
      lifecyclePreset: "logic",
      playable: false,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Content from upstream nodes. The gate blocks or allows content based on its open/closed state.",
      outputDescription: "When open, passes content through unchanged. When closed, blocks all downstream propagation.",
      expandedView: "expanded/LogicExpandedView.tsx",
      lifecycleHandler: "lifecycles/logic.ts",
      dockGroup: "Logic",
    },
  },

  {
    id: "node-coherence-gate",
    name: "Coherence Gate",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "AI-powered quality gate that scores content against configurable checks (topic match, tone consistency, fact drift, style match). Passes content above threshold, blocks below. Supports retries and strictness presets.",
    props: [],
    hooks: [],
    capabilities: [
      "4 quality checks: topic match, tone consistency, fact drift, style match",
      "Configurable threshold score (0-100)",
      "3 strictness presets: Loose (50%), Medium (75%), Strict (90%)",
      "Automatic retry on failure (0-5 retries)",
      "Custom evaluation prompt for domain-specific rules",
      "Test evaluation UI in expanded view",
      "Persistent fail tracking (coherenceFailCount)",
      "Pass: forwards content with score. Fail: blocks or retries",
      "Renders as circle shape on canvas (special FlowNodeContainer handling)",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/flow/coherence-eval", purpose: "Evaluate content coherence" },
    ],
    nodeMeta: {
      nodeType: "coherence-gate",
      badge: "Coherence",
      accent: "emerald",
      lifecyclePreset: "coherence",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Content from upstream nodes to evaluate for quality. Scores against configured checks and threshold.",
      outputDescription: "Pass: content forwarded with confidence score. Fail: blocks propagation or routes to retry branch.",
      expandedView: "expanded/CoherenceGateExpandedView.tsx",
      lifecycleHandler: "lifecycles/coherence.ts",
      dockGroup: "Logic",
    },
  },

  {
    id: "node-router",
    name: "Router",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Logic node that distributes content to specific downstream nodes based on configured output labels. Routes content to matching branches for parallel processing paths.",
    props: [],
    hooks: [],
    capabilities: [
      "Configurable output branch labels (routerOutputs array)",
      "Routes content to matching downstream connections",
      "Enables parallel processing paths from single input",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "router",
      badge: "Router",
      accent: "violet",
      lifecyclePreset: "logic",
      playable: false,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Content from upstream nodes. Routes to different output branches based on configured rules or labels.",
      outputDescription: "Distributes content to specific downstream nodes based on matching output labels.",
      expandedView: "expanded/LogicExpandedView.tsx",
      lifecycleHandler: "lifecycles/logic.ts",
      dockGroup: "Logic",
    },
  },

  {
    id: "node-merge",
    name: "Merge",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Logic node that consolidates multiple input branches into a single output. Combines all incoming content for unified downstream processing.",
    props: [],
    hooks: [],
    capabilities: [
      "Accepts multiple input connections",
      "Concatenates or interleaves content from all sources",
      "Produces single unified output for downstream nodes",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "merge",
      badge: "Merge",
      accent: "blue",
      lifecyclePreset: "logic",
      playable: false,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Multiple input connections from different branches. Combines all incoming content into a single output.",
      outputDescription: "Merged content from all input sources, concatenated or interleaved based on arrival order.",
      expandedView: "expanded/LogicExpandedView.tsx",
      lifecycleHandler: "lifecycles/logic.ts",
      dockGroup: "Logic",
    },
  },

  {
    id: "node-social-post",
    name: "Social Post",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Multi-platform social media content generator. Adapts upstream text for selected platforms (X, LinkedIn, Facebook, Instagram, Reddit) with per-platform character limits, intent, tone, and optional image generation.",
    props: [],
    hooks: [],
    capabilities: [
      "Per-platform toggle and customization",
      "Intent options: marketing, blog, announcement, etc.",
      "Tone options: professional, casual, witty, etc.",
      "Automatic image generation toggle (socialGenerateImages)",
      "Upstream image passthrough (from painter nodes)",
      "Per-platform output with text, imageUrl, charCount, status",
      "Chain execution creates per-platform document nodes",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/write", purpose: "Generate platform-adapted social content" },
      { method: "POST", endpoint: "/api/generate-image", purpose: "Generate social post images" },
    ],
    nodeMeta: {
      nodeType: "social-post",
      badge: "Social",
      accent: "pink",
      lifecyclePreset: "social",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
      inputDescription: "Text content to adapt for social media. Accepts intent, tone, and platform selection to guide generation.",
      outputDescription: "Platform-specific social posts (text + optional images). Each platform gets tailored content respecting character limits.",
      expandedView: "expanded/SocialPostExpandedView.tsx",
      lifecycleHandler: "lifecycles/social-post.ts",
      dockGroup: "Social",
    },
  },

  {
    id: "node-api-connection",
    name: "API Connection",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "External API publishing node. Connects to services (X, LinkedIn, Facebook, Instagram, Reddit, webhook, custom) to publish content. Tracks auth status and logs all publish attempts.",
    props: [],
    hooks: [],
    capabilities: [
      "7 service types: X, LinkedIn, Facebook, Instagram, Reddit, webhook, custom",
      "Auth status tracking: connected, expired, pending, error, none",
      "Detailed publish logging (platform, status, message, timestamp, externalId)",
      "Custom webhook support with URL and headers (JSON)",
      "Terminal node for publishing workflows",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "api-connection",
      badge: "API",
      accent: "green",
      lifecyclePreset: "api",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }],
      inputDescription: "Content from upstream social post nodes or documents. Publishes to configured external API (X, LinkedIn, etc.).",
      outputDescription: "Post result status (success/failure, external ID). Logs all publish attempts with timestamps.",
      expandedView: "expanded/ApiConnectionExpandedView.tsx",
      lifecycleHandler: "lifecycles/api-connection.ts",
      dockGroup: "API",
    },
  },

  {
    id: "node-notification",
    name: "Notification",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Notification node that sends alerts when triggered in a chain. Summarizes upstream content and delivers notifications to assigned users. Terminal node with no downstream output.",
    props: [],
    hooks: [],
    capabilities: [
      "Sends notifications to assigned users on chain trigger",
      "Summarizes upstream content for notification body",
      "Delivery status tracking (sent/failed)",
      "Terminal node — no downstream propagation",
    ],
    dependencies: ["FlowNodeRenderer", "FlowNodeContainer"],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "notification",
      badge: "Notify",
      accent: "pink",
      lifecyclePreset: "notification",
      playable: true,
      supportsChainExecution: true,
      expandMode: "overlay",
      ports: [{ side: "left", type: "input" }],
      inputDescription: "Content from upstream nodes. When triggered, sends a notification with a summary of the input to assigned users.",
      outputDescription: "Notification delivery status (sent/failed). Terminal node — no downstream output.",
      expandedView: "expanded/NotificationExpandedView.tsx",
      lifecycleHandler: "lifecycles/notification.ts",
      dockGroup: "Notify",
    },
  },

  {
    id: "node-label",
    name: "Label",
    filePath: "components/flow/FlowNodeRegistry.ts",
    category: "canvas-node",
    description:
      "Text annotation node for canvas organization. Transparent background, no ports, no data flow. Double-click opens a formatting dialog with font size (12-48px), bold/italic, and 7 color presets.",
    props: [],
    hooks: [],
    capabilities: [
      "Text annotation with transparent background",
      "Formatting dialog: font size (12-48px presets), bold, italic",
      "7 color presets including white",
      "Inline editing on double-click",
      "No ports — purely visual annotation",
      "Renders with special transparent styling in FlowNodeContainer",
    ],
    dependencies: [],
    apiEndpoints: [],
    nodeMeta: {
      nodeType: "label",
      badge: "Label",
      accent: "stone",
      lifecyclePreset: "passive",
      playable: false,
      supportsChainExecution: false,
      expandMode: "dialog",
      ports: [],
      inputDescription: "No input — labels are text annotations placed on the canvas for organizational purposes.",
      outputDescription: "No output — labels don't participate in data flow. They are visual-only elements.",
    },
  },

  // ════════════════════════════════════════════
  // CANVAS WRAPPER FEATURES
  // ════════════════════════════════════════════

  {
    id: "feature-wasd-glide",
    name: "WASD Glide Camera",
    filePath: "components/flow/useFlowInteraction.ts",
    category: "canvas-feature",
    description:
      "Game-style smooth camera panning using W/A/S/D keys. Physics-based with acceleration (1.8 px/frame²), max speed (18 px/frame), friction (0.88), and momentum. Camera continues gliding after key release until friction stops it.",
    props: [],
    hooks: [
      { name: "useRef", source: "react", purpose: "Track velocity, active keys, and animation frame" },
      { name: "requestAnimationFrame", source: "browser", purpose: "Smooth 60fps physics loop" },
    ],
    capabilities: [
      "W/A/S/D keys for directional panning",
      "Physics-based acceleration (1.8 px/frame²)",
      "Max speed cap at 18 px/frame",
      "Friction multiplier (0.88) for smooth deceleration",
      "Stop threshold at 0.3 px/frame (snaps to zero)",
      "Momentum — camera continues moving after key release",
      "Customizable via glideKeys prop",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-marquee-selection",
    name: "Marquee Selection",
    filePath: "components/flow/useFlowInteraction.ts",
    category: "canvas-feature",
    description:
      "Shift + left-click drag on canvas background creates a selection rectangle. All nodes whose bounds overlap the marquee are selected. Minimum 5px size threshold prevents accidental selections.",
    props: [],
    hooks: [],
    capabilities: [
      "Shift + left-click drag to create selection rectangle",
      "Selects all nodes overlapping the marquee bounds",
      "5px minimum size to prevent accidental clicks",
      "Visual selection rectangle overlay",
      "Works with multi-select group drag",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-undo-redo",
    name: "Undo / Redo History",
    filePath: "components/flow/useFlowCanvas.ts",
    category: "canvas-feature",
    description:
      "100-snapshot deep undo/redo history for all canvas operations. Auto-clears redo stack on new mutations. Snapshots capture full node + edge state. Explicit snapshot push before drag operations.",
    props: [],
    hooks: [
      { name: "useRef", source: "react", purpose: "History stack and pointer tracking" },
    ],
    capabilities: [
      "100-snapshot deep history",
      "Ctrl+Z / Cmd+Z for undo",
      "Ctrl+Shift+Z / Cmd+Y for redo",
      "Auto-clears redo stack on any new mutation",
      "Explicit pushSnapshot() before drag operations",
      "Batch deletion in single undo snapshot (deleteNodesSnapshot)",
      "Full node + edge state captured per snapshot",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-copy-paste",
    name: "Copy / Paste Nodes",
    filePath: "pages/FlowWorkspace.tsx",
    category: "canvas-feature",
    description:
      "Copy selected nodes (Ctrl+C) serializes nodes and internal edges to JSON. Paste (Ctrl+V) deserializes with 50px position offset and auto-selects pasted nodes. Preserves all node fields including conversation history and settings.",
    props: [],
    hooks: [],
    capabilities: [
      "Ctrl+C / Cmd+C to copy selected nodes",
      "Ctrl+V / Cmd+V to paste with 50px offset",
      "Copies all node fields (content, settings, conversations)",
      "Preserves internal edges between copied nodes",
      "Auto-selects pasted nodes",
      "New unique IDs assigned to pasted nodes",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-canvas-freeze",
    name: "Canvas Freeze",
    filePath: "pages/FlowWorkspace.tsx",
    category: "canvas-feature",
    description:
      "Toggle in the zoom dropdown menu that disables ALL canvas interactions — wheel, mouse, drag, drop. Locks the canvas from accidental edits while preserving visual state. Useful for presentation or review mode.",
    props: [],
    hooks: [],
    capabilities: [
      "Toggle via zoom dropdown → 'Freeze Canvas'",
      "Disables: wheel zoom, mouse down/move/up, drag-over, drop",
      "Preserves visual state (nodes stay visible)",
      "Prevents accidental edits during presentation/review",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-minimap",
    name: "Minimap",
    filePath: "components/flow/FlowMinimap.tsx",
    category: "canvas-feature",
    description:
      "Persistent minimap overlay showing all nodes at a reduced scale. Toggled with 'M' key or Settings menu. Draggable, resizable, collapsible, and pinnable. State persists to localStorage across page reloads.",
    props: [],
    hooks: [
      { name: "useMinimapState", source: "components/flow/useMinimapState.ts", purpose: "Persistent minimap state (position, size, zoom, pinned, collapsed)" },
    ],
    capabilities: [
      "Toggle with 'M' key or Settings menu",
      "Draggable position on canvas overlay",
      "Resizable: 150-600px width, 100-400px height",
      "Zoom range: 0.5x - 4x",
      "Collapsible (minimize to bar)",
      "Pinnable (prevent accidental moves)",
      "State persisted to localStorage with 50ms debounce",
      "Shows all nodes as colored dots/rectangles at scale",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-edge-roles",
    name: "Edge Roles (Semantic Connections)",
    filePath: "components/flow/FlowEdgeLayer.tsx",
    category: "canvas-feature",
    description:
      "Edges can carry semantic roles: objective, context, or output-format. Research nodes accept inputs in vertical zones that assign roles automatically. Edge labels and colors reflect the role. Enables structured data routing beyond simple content flow.",
    props: [],
    hooks: [],
    capabilities: [
      "3 edge roles: objective (blue), context (amber), output-format (purple)",
      "Research node input zones: top 25% = objective, middle 50% = context, bottom 75% = output-format",
      "Role labels rendered on edge curves",
      "Color-coded edge rendering by role",
      "gatherInputContentWithRoles() separates inputs by role for processing",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-chain-execution",
    name: "Chain Execution Engine",
    filePath: "components/flow/useChainExecutor.ts",
    category: "canvas-feature",
    description:
      "Automated multi-node processing pipeline. When a node completes, downstream nodes auto-execute with 500ms delay. Supports two input modes (wait-all, fire-each), auto-trigger control per node, and reactive completion watching.",
    props: [],
    hooks: [
      { name: "useRef", source: "react", purpose: "Abort controller and running state" },
      { name: "useCallback", source: "react", purpose: "Memoized execute and abort functions" },
    ],
    capabilities: [
      "500ms delay between consecutive node executions",
      "Input modes: wait-all (default) and fire-each",
      "wait-all: downstream fires only after ALL inputs complete",
      "fire-each: downstream fires immediately on any single input",
      "autoTriggerNext per-node control (default true)",
      "Reactive watcher: detects llmStatus → 'done' transitions",
      "chainPropagatedRef prevents duplicate propagation",
      "abortChain() to cancel in-progress execution",
      "executeChain(startNodeId) for full chain from start",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-keyboard-shortcuts",
    name: "Keyboard Shortcuts",
    filePath: "lib/keybind-actions.ts",
    category: "canvas-feature",
    description:
      "Comprehensive keyboard shortcut system with user-overridable bindings. Covers canvas navigation (WASD, zoom, minimap), editing (copy, paste, undo, redo, delete), and selection (select all, deselect). Number keys 1-9 quick-place dock items.",
    props: [],
    hooks: [],
    capabilities: [
      "Canvas: W/A/S/D glide, +/- zoom, M minimap",
      "Edit: Ctrl+C copy, Ctrl+V paste, Ctrl+Z undo, Ctrl+Shift+Z redo, Delete/Backspace delete",
      "Selection: Ctrl+A select all, Escape deselect",
      "Number keys 1-9: quick-place dock items at cursor",
      "Space + click: temporary pan without clearing selection",
      "Middle mouse button: always pans",
      "Shift + click: toggle individual node selection",
      "User-overridable via keybinding settings",
      "Platform-aware: Cmd on Mac, Ctrl on Windows",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-canvas-themes",
    name: "Canvas Themes",
    filePath: "lib/canvas-styles.ts",
    category: "canvas-feature",
    description:
      "8 built-in visual themes for the canvas background: Aurora (dark, particles), Paper (light), Daylight (light), Blueprint (technical grid), Midnight (dark), Forest (dark), Void (minimal dark). Each theme defines background gradient, grid opacity/color, hero animation visibility, and color palette.",
    props: [],
    hooks: [],
    capabilities: [
      "8 themes: Aurora, Paper, Daylight, Blueprint, Midnight, Forest, Void",
      "Per-theme: background CSS, grid opacity (0-35%), grid color",
      "Hero particle animation (Aurora theme)",
      "Associated color palettes: ember, ocean, slate, dusk, forest",
      "Selectable via shell settings",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-activity-logs",
    name: "Activity Logs (Lifecycle Console)",
    filePath: "components/flow/ActivityLogsOverlay.tsx",
    category: "canvas-feature",
    description:
      "Full lifecycle audit trail for all node executions. Two view modes: flat (chronological) and grouped (by node with expand/collapse). Supports filtering by node, type, phase, status, date range, and keyword search. Click-to-navigate pans canvas to the relevant node.",
    props: [],
    hooks: [
      { name: "useLifecycleLog", source: "lib/lifecycleLog.ts", purpose: "Subscribe to lifecycle log entries" },
    ],
    capabilities: [
      "Two views: flat (chronological) and grouped (by node)",
      "6 phases: pre-process, process, post-process, activate, deactivate, tick, chain",
      "4 statuses: start, success, error, skipped",
      "Filtering: node ID, node type, phase, status, date range, keyword",
      "Click-to-navigate: pans canvas to source node",
      "Pause/resume log capture",
      "Export logs as text file",
      "Copy filtered logs to clipboard",
      "Max 500 entries (rolling buffer)",
      "Per-node statistics: error count, total/average duration",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-multi-select-drag",
    name: "Multi-Select & Group Drag",
    filePath: "components/flow/useFlowInteraction.ts",
    category: "canvas-feature",
    description:
      "Shift + click toggles individual node selection. Selected nodes move together as a group when dragged. Zone-aware: dragging a zone automatically moves all nodes contained within it.",
    props: [],
    hooks: [],
    capabilities: [
      "Shift + click: toggle node in/out of selection",
      "Group drag: all selected nodes move together",
      "Zone-aware: dragging a zone moves contained nodes",
      "Works with marquee selection for bulk operations",
      "Selected nodes highlight with visual indicator",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-workspace-tabs",
    name: "Workspace Tabs (Multi-Canvas)",
    filePath: "pages/FlowWorkspace.tsx",
    category: "canvas-feature",
    description:
      "Multiple independent canvas workspaces within a single session. Each tab maintains its own node/edge/viewport state as snapshots. Switch tabs to save current state and load another. Rename, duplicate, or close tabs.",
    props: [],
    hooks: [],
    capabilities: [
      "Multiple named canvas tabs (Canvas 1, Canvas 2, ...)",
      "Independent node/edge/viewport state per tab",
      "Auto-save on tab switch",
      "Right-click to rename tabs",
      "Close tabs (must keep at least one)",
      "Tab state stored as snapshots in memory",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-collab",
    name: "Real-Time Collaboration",
    filePath: "hooks/use-canvas-collab.ts",
    category: "canvas-feature",
    description:
      "WebSocket-based real-time canvas collaboration. Always enabled when a canvas ID exists. Syncs node add/move/delete, edge operations, and full state for late joiners. Shows presence indicator with online member count.",
    props: [],
    hooks: [
      { name: "useCanvasCollab", source: "hooks/use-canvas-collab.ts", purpose: "WebSocket connection, operation send/receive, presence tracking" },
    ],
    capabilities: [
      "WebSocket connection to /ws/canvas",
      "Operation sync: add-node, move-node, delete-node, add-edge, update-node",
      "Full state sync for late joiners",
      "Presence tracking with online member count badge",
      "Self-echo filtering (ignores own operations)",
      "Always enabled when canvas ID exists (collabEnabled = true)",
    ],
    dependencies: [],
    apiEndpoints: [],
  },

  {
    id: "feature-auto-save",
    name: "Auto-Save & Session Persistence",
    filePath: "pages/FlowWorkspace.tsx",
    category: "canvas-feature",
    description:
      "Automatic canvas saving on configurable intervals. Creates [5min] and [Hourly] auto-save documents. Last canvas ID and title persist to localStorage for cross-session resume. URL params take priority over localStorage.",
    props: [],
    hooks: [],
    capabilities: [
      "Auto-save timer runs every 30-60 seconds",
      "Creates [5min] and [Hourly] auto-save snapshots",
      "Last canvas ID saved to localStorage (flow:lastCanvasId)",
      "Last canvas title saved to localStorage (flow:lastCanvasTitle)",
      "URL param takes priority over localStorage on load",
      "Auto-save documents excluded from Open Canvas dialog",
    ],
    dependencies: [],
    apiEndpoints: [
      { method: "POST", endpoint: "/api/documents", purpose: "Save canvas state as encrypted document" },
      { method: "PUT", endpoint: "/api/documents/:id", purpose: "Update existing canvas save" },
    ],
  },

  {
    id: "feature-fit-to-screen",
    name: "Fit to Screen",
    filePath: "pages/FlowWorkspace.tsx",
    category: "canvas-feature",
    description:
      "Auto-frames all canvas nodes within the viewport. Computes bounding box of all nodes plus 40px padding and adjusts zoom + offset to fit. Available in the zoom dropdown menu.",
    props: [],
    hooks: [],
    capabilities: [
      "Computes bounding box of all nodes",
      "40px padding around the bounding box",
      "Adjusts zoom and offset to fit all nodes in viewport",
      "Available in zoom dropdown menu",
    ],
    dependencies: [],
    apiEndpoints: [],
  },
];

// ── Helper functions ──

/** Get a component entry by ID */
export function getComponent(id: string): ComponentEntry | undefined {
  return COMPONENT_REGISTRY.find((c) => c.id === id);
}

/** Get all components in a category */
export function getComponentsByCategory(category: ComponentEntry["category"]): ComponentEntry[] {
  return COMPONENT_REGISTRY.filter((c) => c.category === category);
}

/** Get all unique categories */
export function getCategories(): ComponentEntry["category"][] {
  return Array.from(new Set(COMPONENT_REGISTRY.map((c) => c.category)));
}

/** Count components per category */
export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of COMPONENT_REGISTRY) {
    counts[c.category] = (counts[c.category] || 0) + 1;
  }
  return counts;
}
