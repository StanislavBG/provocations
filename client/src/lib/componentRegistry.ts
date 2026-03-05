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

export interface ComponentEntry {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Display name */
  name: string;
  /** File path relative to client/src/ */
  filePath: string;
  /** Category for grouping */
  category: "notebook" | "flow" | "bschart" | "shared" | "ftux" | "timeline";
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
      "System buttons: Workspace Tools (AleComponentGateway), Blueprints (save/load), Settings (FtuxSettingsDialog)",
      "Blueprint save/load via custom events (flow:save-blueprint, flow:load-blueprint)",
      "Keyboard shortcut indicators (1-9) on slots",
      "Active tool indicator dot",
    ],
    dependencies: ["FtuxSettingsDialog", "AleComponentGateway"],
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
