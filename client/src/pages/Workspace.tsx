import { useState, useCallback, useEffect, useRef, lazy, Suspense, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { getAppFlowConfig, getObjectiveConfig, type AppFlowConfig, type RightPanelTabId, type WorkspaceLayout } from "@/lib/appWorkspaceConfig";
import { TextInputForm } from "@/components/TextInputForm";
import { InterviewPanel } from "@/components/InterviewPanel";
import { LogStatsPanel } from "@/components/LogStatsPanel";
import { ReadingPane } from "@/components/ReadingPane";
import { TranscriptOverlay } from "@/components/TranscriptOverlay";
import { ProvocationToolbox, type ToolboxApp } from "@/components/ProvocationToolbox";
import { ImagePreviewPanel } from "@/components/ImagePreviewPanel";
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "@/components/ModelConfigPanel";
import { StepTracker, type WorkflowPhase } from "@/components/StepTracker";
import { VoiceCaptureWorkspace } from "@/components/VoiceCaptureWorkspace";
import { InfographicStudioWorkspace } from "@/components/InfographicStudioWorkspace";
import { ChatSessionPanel } from "@/components/ChatSessionPanel";
import { DynamicSummaryPanel } from "@/components/DynamicSummaryPanel";
import { ResearchNotesPanel } from "@/components/ResearchNotesPanel";
import { SessionNotesPanel } from "@/components/SessionNotesPanel";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { trackEvent } from "@/lib/tracking";
import { errorLogStore } from "@/lib/errorLog";
import { ProvokeText } from "@/components/ProvokeText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AutoDictateToggle } from "@/components/AutoDictateToggle";
import { DebugButton } from "@/components/DebugButton";
import { UserButton } from "@clerk/clerk-react";
import { useRole } from "@/hooks/use-role";
import { Link, useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Lazy load heavy components
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
import { ScreenCaptureButton, type CaptureAnnotation } from "@/components/ScreenCaptureButton";
import {
  RotateCcw,
  MessageCircleQuestion,
  GitCompare,
  Target,
  Crosshair,
  X,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowRightToLine,
  Loader2,
  Share2,
  Copy,
  HardDrive,
  MessageCircle,
  Zap,
  FileText,
  Wrench,
  Shield,
  ImageIcon,
  FolderOpen,
  Lock,
  CreditCard,
  StickyNote,
} from "lucide-react";
import { builtInPersonas } from "@shared/personas";
import { parseAppLaunchParams, clearLaunchParams } from "@/lib/appLaunchParams";
import { serializePersonaToMarkdown, buildPersonaEditObjective } from "@/lib/personaSerializer";
import { createAdminPromptEditorState } from "@/lib/agentSerializer";
import StepBuilder from "@/components/StepBuilder";
import StepEditor from "@/components/StepEditor";
import AgentRunner from "@/components/AgentRunner";
import { templateIds } from "@shared/schema";
import type {
  Document,
  ProvocationType,
  DirectionMode,
  DocumentVersion,
  WriteRequest,
  WriteResponse,
  ReferenceDocument,
  EditHistoryEntry,
  InterviewEntry,
  InterviewQuestionResponse,
  WireframeAnalysisResponse,
  ContextItem,
  DiscussionMessage,
  AskQuestionResponse,
  Advice,
  AgentStep,
  FolderItem,
  ChatMessage,
} from "@shared/schema";

async function processObjectiveText(text: string, mode: string): Promise<string> {
  const context = mode === "clean" ? "objective" : mode;
  const response = await apiRequest("POST", "/api/summarize-intent", {
    transcript: text,
    context,
  });
  const data = (await response.json()) as { summary?: string };
  return data.summary ?? text;
}

export default function Workspace() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isAdmin } = useRole();
  const [, navigate] = useLocation();
  const [routeMatch, routeParams] = useRoute("/app/:templateId");

  const [document, setDocument] = useState<Document>({ id: generateId("doc"), rawText: "" });
  const [objective, setObjective] = useState<string>("");
  const [secondaryObjective, setSecondaryObjectiveRaw] = useState<string>("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);

  // Captured context items (persists across phases)
  const [capturedContext, setCapturedContext] = useState<ContextItem[]>([]);

  // Session notes — temporary working notes for the current document (e.g. PM constraints/rules)
  const [sessionNotes, setSessionNotes] = useState<string>("");

  // Guard: prevent secondary objective from duplicating the primary (REQ-002)
  const setSecondaryObjective = useCallback((value: string) => {
    if (value.trim() && value.trim().toLowerCase() === objective.trim().toLowerCase()) {
      return; // silently reject duplicates
    }
    setSecondaryObjectiveRaw(value);
  }, [objective]);

  // Which template was selected in step 1 — drives workspace behavior
  const [selectedTemplateId, setSelectedTemplateIdRaw] = useState<string | null>(null);

  /** Set the selected template and sync the browser URL */
  const setSelectedTemplateId = useCallback((id: string | null) => {
    setSelectedTemplateIdRaw(id);
    if (id) {
      window.history.replaceState({}, "", `/app/${id}`);
    } else {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Layout override — set when research-chat mode is activated within a standard-layout app
  const [layoutOverride, setLayoutOverride] = useState<"research-chat" | null>(null);

  // Computed flow config — the single source of truth for app-specific behavior
  const baseAppFlowConfig: AppFlowConfig = getAppFlowConfig(selectedTemplateId);
  const appFlowConfig: AppFlowConfig = layoutOverride
    ? { ...baseAppFlowConfig, workspaceLayout: layoutOverride }
    : baseAppFlowConfig;
  const objectiveConfig = getObjectiveConfig(selectedTemplateId);

  // Valid appType for API calls — "custom" is not a real templateId, so treat it as undefined
  const validAppType = selectedTemplateId && (templateIds as readonly string[]).includes(selectedTemplateId)
    ? selectedTemplateId
    : undefined;

  // Toolbox app state — controls which app is active in the left panel
  const [activeToolboxApp, setActiveToolboxApp] = useState<ToolboxApp>("provoke");

  // Model configuration state — used by text-to-infographic
  const [modelConfig, setModelConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });

  // Agent editor state
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentPersona, setAgentPersona] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Mobile workspace tab — controls which panel is visible on mobile
  type MobileTab = "document" | "toolbox" | "discussion";
  const [mobileTab, setMobileTab] = useState<MobileTab>("document");

  // Voice and version tracking
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [showDiffView, setShowDiffView] = useState(false);

  // Transcript overlay state
  const [showTranscriptOverlay, setShowTranscriptOverlay] = useState(false);
  const [rawTranscript, setRawTranscript] = useState("");
  const [cleanedTranscript, setCleanedTranscript] = useState<string | undefined>(undefined);
  const [transcriptSummary, setTranscriptSummary] = useState("");
  const [isRecordingFromMain, setIsRecordingFromMain] = useState(false);

  // Pending voice context for deferred sending (holds selectedText until user reviews transcript)
  const [pendingVoiceContext, setPendingVoiceContext] = useState<{
    selectedText?: string;
    context: "selection" | "document";
  } | null>(null);

  // Edit history for coherent iteration
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  // Suggestions from last write response
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);

  // ── Interview (Provoke) state ──
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [interviewEntries, setInterviewEntries] = useState<InterviewEntry[]>([]);
  const [currentInterviewQuestion, setCurrentInterviewQuestion] = useState<string | null>(null);
  const [currentInterviewTopic, setCurrentInterviewTopic] = useState<string | null>(null);

  // Direction state for the provoke panel
  const [interviewDirection, setInterviewDirection] = useState<{
    mode?: DirectionMode;
    personas: ProvocationType[];
    guidance?: string;
  } | null>(null);

  // ── Discussion state (enhanced advice + ask question) ──
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);
  const [currentAdviceText, setCurrentAdviceText] = useState<string | null>(null);

  // ── Research chat state (GPT to Context research mode) ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStreamingContent, setChatStreamingContent] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [researchSummary, setResearchSummary] = useState("");
  const [chatUseGemini, setChatUseGemini] = useState(true);
  const [isSummaryUpdating, setIsSummaryUpdating] = useState(false);
  const [researchNotes, setResearchNotes] = useState("");
  const [researchTopic, setResearchTopic] = useState("");
  const summaryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoResearchRef = useRef<{ topic: string; objective: string } | null>(null);

  // Context collection data (captured from input phase for read-only toolbox tab)
  const [contextCollectionData, setContextCollectionData] = useState<{
    text: string;
    objective: string;
  } | null>(null);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [wireframeNotes, setWireframeNotes] = useState("");
  const [wireframeAnalysis, setWireframeAnalysis] = useState<WireframeAnalysisResponse | null>(null);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const lastAnalyzedUrl = useRef<string>("");

  // New button confirmation
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [savedDocId, setSavedDocId] = useState<number | null>(null);
  const [savedDocTitle, setSavedDocTitle] = useState<string>("");

  // Voice input for objective (no writer call, direct update)
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterimTranscript, setObjectiveInterimTranscript] = useState("");

  // Objective panel collapsed state (minimized by default)
  const [isObjectiveCollapsed, setIsObjectiveCollapsed] = useState(true);

  // Objective "Load from Context Store" dialog state
  const [objectiveStoreOpen, setObjectiveStoreOpen] = useState(false);
  const [objectiveStoreLoadingId, setObjectiveStoreLoadingId] = useState<number | null>(null);
  const [storeExpandedFolders, setStoreExpandedFolders] = useState<Set<number>>(new Set());
  const { data: objectiveStoreDocs } = useQuery<{ documents: { id: number; title: string; folderId?: number | null; updatedAt: string }[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: objectiveStoreOpen,
    staleTime: 30_000,
  });
  const { data: objectiveStoreFolders } = useQuery<FolderItem[]>({
    queryKey: ["/api/folders/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return (data.folders || []) as FolderItem[];
    },
    enabled: objectiveStoreOpen,
    staleTime: 30_000,
  });

  // ── Admin edit state (set when editing an agent-prompt from Admin panel) ──
  const [adminEditTaskType, setAdminEditTaskType] = useState<string | null>(null);

  // ── App Launch Params — cross-app deep linking ──
  const launchParamsConsumed = useRef(false);
  useEffect(() => {
    if (launchParamsConsumed.current) return;

    let resolvedTemplateId: string | null = null;

    // Path-based deep link: /app/:templateId
    if (routeMatch && routeParams?.templateId) {
      if ((templateIds as readonly string[]).includes(routeParams.templateId)) {
        resolvedTemplateId = routeParams.templateId;
      }
    }

    // Parse query-string for intent params (intent, entityType, entityId, etc.)
    const params = parseAppLaunchParams(window.location.search);

    // If no route match AND no query params, nothing to do
    if (!resolvedTemplateId && !params) return;

    launchParamsConsumed.current = true;

    // Set template from route path or query-string app param
    setSelectedTemplateId(resolvedTemplateId ?? params?.app ?? null);

    // Handle persona edit intent
    if (params?.intent === "edit" && params.entityType === "persona" && params.entityId) {
      const persona = builtInPersonas[params.entityId as ProvocationType];
      if (persona) {
        const markdown = serializePersonaToMarkdown(persona);
        const editObjective = buildPersonaEditObjective(persona);
        setDocument({ id: generateId("doc"), rawText: markdown });
        setObjective(editObjective);
        setIsObjectiveCollapsed(false);
        toast({
          title: `Editing: ${persona.label}`,
          description: `${persona.domain} domain persona loaded from admin`,
        });
      }
    }

    // Handle agent-prompt edit intent (admin editing LLM task type system prompts)
    if (params?.intent === "edit" && params.entityType === "agent-prompt" && params.entityId) {
      const taskType = params.entityId;
      setAdminEditTaskType(taskType);
      // Fetch the current prompt for this task type from the admin endpoint
      apiRequest("GET", "/api/admin/agent-prompts")
        .then((res) => res.json())
        .then((resp: { prompts: { taskType: string; description: string; currentPrompt: string; hasOverride: boolean }[] }) => {
          const entry = resp.prompts.find((p) => p.taskType === taskType);
          if (entry) {
            const state = createAdminPromptEditorState(taskType, entry.description, entry.currentPrompt);
            setAgentSteps(state.steps);
            setAgentName(state.name);
            setAgentDescription(state.description);
            setAgentPersona(state.persona);
            setSelectedStepId(state.steps[0]?.id ?? null);
            // Set document so workspace transitions past the input phase
            setDocument({ id: generateId("doc"), rawText: entry.currentPrompt });
            setObjective(
              `Edit the system prompt for the "${entry.description}" LLM task type. ` +
              `Changes will be saved as admin overrides.`,
            );
            setIsObjectiveCollapsed(false);
            toast({
              title: `Editing: ${entry.description}`,
              description: `System prompt loaded for "${taskType}" task type`,
            });
          }
        })
        .catch(() => {
          toast({
            title: "Failed to load prompt",
            description: `Could not fetch system prompt for task type "${taskType}"`,
            variant: "destructive",
          });
        });
    }

    clearLaunchParams();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track page view on mount ──
  useEffect(() => {
    trackEvent("page_view", { appSection: "workspace" });
  }, []);

  // ── Query tab state ──

  interface TabState {
    id: string;
    title: string;
    document: Document;
    savedDocId: number | null;
    savedDocTitle: string;
    objective: string;
    versions: DocumentVersion[];
    editHistory: EditHistoryEntry[];
  }

  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");

  // Right panel mode — defaults to first tab in config
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelTabId>(appFlowConfig.rightPanelTabs[0]?.id ?? "discussion");

  // ── Tab operations ──

  const saveCurrentTabState = useCallback((): TabState => ({
    id: activeTabId || generateId("tab"),
    title: savedDocTitle || objective || "Untitled",
    document: { ...document },
    savedDocId,
    savedDocTitle,
    objective,
    versions: [...versions],
    editHistory: [...editHistory],
  }), [activeTabId, document, savedDocId, savedDocTitle, objective, versions, editHistory]);

  const restoreTabState = useCallback((tab: TabState) => {
    setDocument(tab.document);
    setSavedDocId(tab.savedDocId);
    setSavedDocTitle(tab.savedDocTitle);
    setObjective(tab.objective);
    setVersions(tab.versions);
    setEditHistory(tab.editHistory);
    setActiveTabId(tab.id);
  }, []);

  const handleTabSelect = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    trackEvent("tab_switched");
    // Save current tab state
    setTabs(prev => prev.map(t => t.id === activeTabId ? saveCurrentTabState() : t));
    // Restore target tab
    const target = tabs.find(t => t.id === tabId);
    if (target) restoreTabState(target);
  }, [activeTabId, tabs, saveCurrentTabState, restoreTabState]);

  const handleNewTab = useCallback(() => {
    trackEvent("tab_created");
    // Save current tab before creating new
    if (activeTabId) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? saveCurrentTabState() : t));
    }
    const newTab: TabState = {
      id: generateId("tab"),
      title: `Query ${tabs.length + 1}`,
      document: { id: generateId("doc"), rawText: " " },
      savedDocId: null,
      savedDocTitle: "",
      objective: "",
      versions: [{ id: generateId("v"), text: " ", timestamp: Date.now(), description: "New tab" }],
      editHistory: [],
    };
    setTabs(prev => [...prev, newTab]);
    restoreTabState(newTab);
  }, [activeTabId, tabs.length, saveCurrentTabState, restoreTabState]);

  const handleTabClose = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    trackEvent("tab_closed");
    const idx = tabs.findIndex(t => t.id === tabId);
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (tabId === activeTabId) {
      const nextTab = remaining[Math.min(idx, remaining.length - 1)];
      restoreTabState(nextTab);
    }
  }, [tabs, activeTabId, restoreTabState]);

  const handleTabRename = useCallback((tabId: string, newTitle: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: newTitle } : t));
  }, []);

  // Initialize tabs from current document state when entering workspace
  useEffect(() => {
    if (document.rawText && tabs.length === 0) {
      const initialTab: TabState = {
        id: generateId("tab"),
        title: savedDocTitle || objective || "Query 1",
        document: { ...document },
        savedDocId,
        savedDocTitle,
        objective,
        versions: [...versions],
        editHistory: [...editHistory],
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
  }, [document.rawText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep active tab in sync with current document state
  useEffect(() => {
    if (activeTabId && tabs.length > 0) {
      setTabs(prev => prev.map(t =>
        t.id === activeTabId
          ? { ...t, title: savedDocTitle || objective || t.title, document: { ...document }, savedDocId, savedDocTitle, objective, versions, editHistory }
          : t
      ));
    }
  }, [document.rawText, savedDocTitle, objective]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Query Analyzer mutation ──

  // ── Save Prompt Override mutation (admin agent-prompt editing) ──
  const savePromptOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!adminEditTaskType) throw new Error("No task type set for saving");
      const systemPrompt = agentSteps[0]?.actor?.systemPrompt;
      if (!systemPrompt) throw new Error("No system prompt to save");
      const res = await apiRequest("PUT", `/api/admin/agent-overrides/${adminEditTaskType}`, {
        systemPrompt,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prompt override saved",
        description: `Override for "${adminEditTaskType}" saved successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save override",
        description: error.message,
        variant: "destructive",
      });
      errorLogStore.push({
        step: "Save Prompt Override",
        endpoint: `/api/admin/agent-overrides/${adminEditTaskType}`,
        message: error.message,
      });
    },
  });

  // ── Writer mutation ──

  const writeMutation = useMutation({
    mutationFn: async (request: Omit<WriteRequest, "document" | "objective" | "referenceDocuments" | "editHistory" | "capturedContext"> & { description?: string }) => {
      if (!document) throw new Error("No document to write to");



      // ── AGGREGATE mode: append + reorganize, don't rewrite from scratch ──
      if (appFlowConfig.writer.mode === "aggregate") {
        const aggregateInstruction = `AGGREGATE MODE — You are a note-taker and context organizer. Do NOT rewrite or replace existing content.

TASK: Incorporate the following new material into this document:
${request.instruction}

RULES:
1. PRESERVE all existing content — never delete or substantially rewrite what's already there
2. APPEND new information under the most relevant existing section, or create a new section if needed
3. After appending, REORGANIZE the document: group related items, improve section headings, merge duplicates
4. Add source attribution where possible
5. Maintain a "Gaps & Questions" section at the bottom for unresolved items
6. Output the full updated document`;

        const response = await apiRequest("POST", "/api/write", {
          document: document.rawText,
          objective,
          secondaryObjective: secondaryObjective.trim() || undefined,
          appType: validAppType,
          referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
          capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
          sessionNotes: sessionNotes.trim() || undefined,
          editHistory: editHistory.length > 0 ? editHistory : undefined,
          ...request,
          instruction: aggregateInstruction,
        });
        return await response.json() as WriteResponse;
      }

      // ── EDIT mode (default): rewrite/evolve document ──
      const response = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        appType: validAppType,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        sessionNotes: sessionNotes.trim() || undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
        ...request,
      });
      return await response.json() as WriteResponse;
    },
    onSuccess: (data: WriteResponse, variables) => {
      // ── EDIT & AGGREGATE modes: update document ──
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: variables.description || data.summary || (appFlowConfig.writer.mode === "aggregate" ? "Content aggregated" : "Document updated")
        };
        setVersions(prev => [...prev, newVersion]);
        setDocument({ ...document, rawText: data.document });

        const historyEntry: EditHistoryEntry = {
          instruction: variables.instruction,
          instructionType: data.instructionType || "general",
          summary: data.summary || "Document updated",
          timestamp: Date.now(),
        };
        setEditHistory(prev => [...prev.slice(-9), historyEntry]);

        trackEvent("write_executed", { metadata: { instructionType: data.instructionType || "general" } });

        if (data.suggestions && data.suggestions.length > 0) {
          setLastSuggestions(data.suggestions);
        } else {
          setLastSuggestions([]);
        }

        let summaryText = data.summary || "Document updated successfully.";
        if (data.changes && data.changes.length > 0) {
          const changesList = data.changes.map(c => {
            const loc = c.location ? ` (${c.location})` : "";
            return `• ${c.type}: ${c.description}${loc}`;
          }).join("\n");
          summaryText += `\n\nChanges:\n${changesList}`;
        }
        if (data.suggestions && data.suggestions.length > 0) {
          summaryText += `\n\nSuggestions:\n${data.suggestions.map(s => `→ ${s}`).join("\n")}`;
        }
        setTranscriptSummary(summaryText);

        toast({
          title: appFlowConfig.writer.mode === "aggregate" ? "Content Added" : "Document Updated",
          description: data.summary || "Your changes have been applied.",
        });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      setTranscriptSummary(`Update failed: ${msg}. Please try again.`);
      errorLogStore.push({ step: "Write Document", endpoint: "/api/write", message: msg });
      toast({ title: "Update Failed", description: msg, variant: "destructive" });
    },
  });

  // ── Create first draft mutation (input phase → workspace) ──

  const createDraftMutation = useMutation({
    mutationFn: async ({ context, obj, refs, templateId }: { context: string; obj: string; refs: ReferenceDocument[]; templateId?: string }) => {
      // Resolve config for the template being created (may differ from current selectedTemplateId
      // because the draft mutation fires before state is fully updated)
      const response = await apiRequest("POST", "/api/write", {
        document: context,
        objective: obj,
        appType: templateId && (templateIds as readonly string[]).includes(templateId) ? templateId : undefined,
        instruction: "Create a well-structured first draft from these raw notes and context. Organize the ideas into clear sections, develop the key points, and present the content as a cohesive document ready for further refinement.",
        referenceDocuments: refs.length > 0 ? refs : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        sessionNotes: sessionNotes.trim() || undefined,
      });
      return await response.json() as WriteResponse;
    },
    onSuccess: (data, variables) => {
      setDocument({ id: generateId("doc"), rawText: data.document });
      setObjective(variables.obj);
      setReferenceDocuments(variables.refs);
      // Capture context collection for read-only preview in toolbox
      setContextCollectionData({
        text: variables.context,
        objective: variables.obj,
      });
      const initialVersion: DocumentVersion = {
        id: generateId("v"),
        text: data.document,
        timestamp: Date.now(),
        description: "First draft",
      };
      setVersions([initialVersion]);

      // Track document creation and phase change
      trackEvent("document_created", { templateId: variables.templateId });
      trackEvent("phase_changed", { metadata: { from: "input", to: "workspace" } });

      if (data.summary) {
        toast({
          title: "First Draft Created",
          description: data.summary,
        });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Could not create the first draft. Please try again.";
      errorLogStore.push({ step: "Create Draft", endpoint: "/api/write", message: msg });
      toast({ title: "Draft Creation Failed", description: msg, variant: "destructive" });
    },
  });

  // ── Interview mutations ──

  const interviewQuestionMutation = useMutation({
    mutationFn: async ({ overrideEntries, direction }: { overrideEntries?: InterviewEntry[]; direction?: { mode?: DirectionMode; personas: ProvocationType[]; guidance?: string } } = {}) => {
      if (!document) throw new Error("No document");
      const templateDoc = referenceDocuments.find(d => d.type === "template");
      const entries = overrideEntries ?? interviewEntries;
      const dir = direction ?? interviewDirection;
      const response = await apiRequest("POST", "/api/interview/question", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        document: document.rawText,
        appType: validAppType,
        template: templateDoc?.content,
        previousEntries: entries.length > 0 ? entries : undefined,
        directionMode: dir?.mode,
        directionPersonas: dir?.personas && dir.personas.length > 0
          ? dir.personas : undefined,
        directionGuidance: dir?.guidance,
      });
      return await response.json() as InterviewQuestionResponse;
    },
    onSuccess: (data) => {
      setCurrentInterviewQuestion(data.question);

      // Client-side safeguard: if the LLM returned "General" but we have active personas,
      // prefix the topic with the first active persona so the badge is never misleading.
      let topic = data.topic;
      const dir = interviewDirection;
      if (dir?.personas && dir.personas.length > 0) {
        const personaLabels = dir.personas.map(id => {
          const p = (builtInPersonas as Record<string, { label?: string }>)[id];
          return p?.label || id;
        });
        const hasPersonaPrefix = personaLabels.some(label =>
          topic.toLowerCase().startsWith(label.toLowerCase())
        );
        if (!hasPersonaPrefix && (topic === "General" || !topic)) {
          topic = `${personaLabels[0]}: Key Concern`;
        }
      }
      setCurrentInterviewTopic(topic);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to generate question";
      errorLogStore.push({ step: "Interview Question", endpoint: "/api/interview/question", message: msg });
      toast({ title: "Interview Error", description: msg, variant: "destructive" });
    },
  });

  const interviewSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!document || interviewEntries.length === 0) throw new Error("No entries to merge");

      // Step 1: Get summarized instruction from interview entries
      const summaryResponse = await apiRequest("POST", "/api/interview/summary", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        entries: interviewEntries,
        document: document.rawText,
        appType: validAppType,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      // ── AGGREGATE mode: wrap instruction for append behavior ──
      const effectiveInstruction = appFlowConfig.writer.mode === "aggregate"
        ? `AGGREGATE MODE — Incorporate the following interview insights into this document without rewriting existing content:\n\n${instruction}\n\nPreserve all existing entries. Append new insights. Reorganize sections if needed.`
        : instruction;

      // Step 2: Use the writer to merge into document
      const writeResponse = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        appType: validAppType,
        instruction: effectiveInstruction,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        sessionNotes: sessionNotes.trim() || undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
      });
      return await writeResponse.json() as WriteResponse;
    },
    onSuccess: (data: WriteResponse) => {

      // ── EDIT & AGGREGATE modes: update document ──
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: appFlowConfig.writer.mode === "aggregate"
            ? `Interview insights added (${interviewEntries.length} answers)`
            : `Interview merge (${interviewEntries.length} answers)`,
        };
        setVersions(prev => [...prev, newVersion]);
        setDocument({ ...document, rawText: data.document });

        const historyEntry: EditHistoryEntry = {
          instruction: `Interview session with ${interviewEntries.length} Q&A pairs`,
          instructionType: data.instructionType || "general",
          summary: data.summary || "Interview responses merged",
          timestamp: Date.now(),
        };
        setEditHistory(prev => [...prev.slice(-9), historyEntry]);

        setIsInterviewActive(false);
        setCurrentInterviewQuestion(null);
        setCurrentInterviewTopic(null);

        trackEvent("interview_merged", { metadata: { entryCount: String(interviewEntries.length) } });

        toast({
          title: appFlowConfig.writer.mode === "aggregate" ? "Interview Insights Added" : "Interview Merged",
          description: `${interviewEntries.length} answers integrated into your document.`,
        });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Interview Summary Merge", endpoint: "/api/interview/summary", message: msg });
      toast({ title: "Merge Failed", description: msg, variant: "destructive" });
    },
  });

  // Incremental merge — push interview answers into document without ending the session
  const interviewMergeMutation = useMutation({
    mutationFn: async () => {
      if (!document || interviewEntries.length === 0) throw new Error("No entries to merge");



      const summaryResponse = await apiRequest("POST", "/api/interview/summary", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        entries: interviewEntries,
        document: document.rawText,
        appType: validAppType,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      const effectiveInstruction = appFlowConfig.writer.mode === "aggregate"
        ? `AGGREGATE MODE — Incorporate the following interview insights without rewriting existing content:\n\n${instruction}\n\nPreserve all existing entries. Append new insights. Reorganize sections if needed.`
        : instruction;

      const writeResponse = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        appType: validAppType,
        instruction: effectiveInstruction,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        sessionNotes: sessionNotes.trim() || undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
      });
      return await writeResponse.json() as WriteResponse;
    },
    onSuccess: (data: WriteResponse) => {
      // ── EDIT & AGGREGATE modes: update document ──
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: appFlowConfig.writer.mode === "aggregate"
            ? `Interview insights added (${interviewEntries.length} answers)`
            : `Incremental merge (${interviewEntries.length} answers)`,
        };
        setVersions(prev => [...prev, newVersion]);
        setDocument({ ...document, rawText: data.document });

        const historyEntry: EditHistoryEntry = {
          instruction: `Merged ${interviewEntries.length} interview answers into document`,
          instructionType: data.instructionType || "general",
          summary: data.summary || "Interview responses merged",
          timestamp: Date.now(),
        };
        setEditHistory(prev => [...prev.slice(-9), historyEntry]);

        // Clear entries so subsequent merge only captures new answers
        setInterviewEntries([]);

        toast({
          title: appFlowConfig.writer.mode === "aggregate" ? "Insights Added" : "Merged to Draft",
          description: `${interviewEntries.length} answers integrated. Interview continues.`,
        });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Interview Incremental Merge", endpoint: "/api/write", message: msg });
      toast({ title: "Merge Failed", description: msg, variant: "destructive" });
    },
  });

  // ── Advice mutation (view advice for current question) ──
  const adviceMutation = useMutation({
    mutationFn: async ({ question, topic }: { question: string; topic: string }) => {
      // Extract persona ID from topic (e.g., "CEO: Growth Strategy" → "ceo")
      const topicLower = topic.toLowerCase();
      let personaId = "ceo"; // default
      if (interviewDirection?.personas && interviewDirection.personas.length > 0) {
        // Try to match from topic label
        const allPersonas = interviewDirection.personas;
        for (const pId of allPersonas) {
          if (topicLower.includes(pId.replace("_", " ")) || topicLower.includes(pId)) {
            personaId = pId;
            break;
          }
        }
        // If no match found from topic, use the first active persona
        if (personaId === "ceo" && !allPersonas.includes("ceo" as ProvocationType)) {
          personaId = allPersonas[0];
        }
      }

      const response = await apiRequest("POST", "/api/generate-advice", {
        document: document.rawText,
        objective,
        appType: validAppType,
        challengeId: `interview-${Date.now()}`,
        challengeTitle: topic,
        challengeContent: question,
        personaId,
        discussionHistory: discussionMessages.length > 0
          ? discussionMessages.slice(-10).map(m => ({ role: m.role, content: m.content, topic: m.topic }))
          : undefined,
      });
      return (await response.json()) as { advice: Advice };
    },
    onSuccess: (data) => {
      setCurrentAdviceText(data.advice?.content || null);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Generate Advice", endpoint: "/api/generate-advice", message: msg });
      toast({ title: "Failed to load advice", description: msg, variant: "destructive" });
    },
  });

  // ── Ask question mutation (user asks the persona team) ──
  const askQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/discussion/ask", {
        question,
        document: document.rawText,
        objective,
        appType: validAppType,
        secondaryObjective: secondaryObjective.trim() || undefined,
        activePersonas: interviewDirection?.personas || [],
        previousMessages: discussionMessages.length > 0 ? discussionMessages.slice(-10) : undefined,
      });
      return (await response.json()) as AskQuestionResponse;
    },
    onSuccess: (data, question) => {
      // Add user question to discussion messages
      const userMsg: DiscussionMessage = {
        id: generateId("dm"),
        role: "user-question",
        content: question,
        topic: data.topic,
        timestamp: Date.now(),
      };

      // Add persona response
      const responseMsg: DiscussionMessage = {
        id: generateId("dm"),
        role: "persona-response",
        content: data.answer,
        topic: data.topic,
        timestamp: Date.now(),
        perspectives: data.perspectives,
        status: "pending",
      };

      setDiscussionMessages(prev => [...prev, userMsg, responseMsg]);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Discussion Ask", endpoint: "/api/discussion/ask", message: msg });
      toast({ title: "Failed to get response", description: msg, variant: "destructive" });
    },
  });

  const streamingAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streaming/wireframe-analysis", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        websiteUrl: websiteUrl || undefined,
        wireframeNotes,
        document: document.rawText || undefined,
      });
      return await response.json() as WireframeAnalysisResponse;
    },
    onSuccess: (data) => {
      setWireframeAnalysis(data);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to analyze website";
      errorLogStore.push({ step: "Website Analysis", endpoint: "/api/streaming/wireframe-analysis", message: msg });
      toast({ title: "Analysis Failed", description: msg, variant: "destructive" });
    },
  });

  // Auto-trigger site analysis when a valid URL is entered
  useEffect(() => {
    const trimmedUrl = websiteUrl.trim();
    if (!trimmedUrl) return;

    const urlPattern = /^https?:\/\/\S+\.\S+/;
    if (!urlPattern.test(trimmedUrl)) return;

    if (trimmedUrl === lastAnalyzedUrl.current) return;

    const timer = setTimeout(() => {
      lastAnalyzedUrl.current = trimmedUrl;
      trackEvent("website_analyzed");
      streamingAnalysisMutation.mutate();
    }, 800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl]);

  const isInputPhase = !document.rawText;

  // Compute workflow phase for StepTracker
  const workflowPhase: WorkflowPhase = isInputPhase
    ? (selectedTemplateId ? "draft" : "select")
    : "edit";
  const selectedTemplateName = selectedTemplateId
    ? prebuiltTemplates.find((t) => t.id === selectedTemplateId)?.title
    : undefined;

  // Auto-start interview when entering workspace — respects per-app config
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!isInputPhase && !autoStartedRef.current) {
      autoStartedRef.current = true;
      if (appFlowConfig.autoStartInterview) {
        const personas = appFlowConfig.autoStartPersonas ?? ["thinking_bigger" as ProvocationType];
        const direction = { personas };
        setInterviewDirection(direction);
        setIsInterviewActive(true);
        interviewQuestionMutation.mutate({ direction });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInputPhase, selectedTemplateId]);

  // ── Interview handlers ──

  const handleStartInterview = useCallback((direction: { mode?: DirectionMode; personas: ProvocationType[]; guidance?: string }) => {
    setInterviewDirection(direction);
    setIsInterviewActive(true);
    interviewQuestionMutation.mutate({ direction });
    trackEvent("interview_started", {
      metadata: { mode: direction.mode ?? "challenge", personaCount: String(direction.personas.length) },
    });
  }, [interviewQuestionMutation]);

  const handleInterviewAnswer = useCallback((answer: string) => {
    if (!currentInterviewQuestion || !currentInterviewTopic) return;

    const entry: InterviewEntry = {
      id: generateId("iq"),
      question: currentInterviewQuestion,
      answer,
      topic: currentInterviewTopic,
      timestamp: Date.now(),
    };
    const updatedEntries = [...interviewEntries, entry];
    setInterviewEntries(updatedEntries);
    setCurrentInterviewQuestion(null);
    setCurrentInterviewTopic(null);

    interviewQuestionMutation.mutate({ overrideEntries: updatedEntries });
  }, [currentInterviewQuestion, currentInterviewTopic, interviewEntries, interviewQuestionMutation]);

  const handleEndInterview = useCallback(() => {
    trackEvent("interview_ended", { metadata: { entryCount: String(interviewEntries.length) } });
    interviewSummaryMutation.mutate();
  }, [interviewSummaryMutation, interviewEntries.length]);

  // Merge discussion content to draft without ending the session
  const handleMergeToDraft = useCallback(() => {
    if (interviewEntries.length > 0 && !interviewMergeMutation.isPending) {
      interviewMergeMutation.mutate();
    }
  }, [interviewEntries.length, interviewMergeMutation]);

  const handleBrowserUrlChange = useCallback((url: string) => {
    setWebsiteUrl(url);
  }, []);

  // ── Discussion handlers (advice, dismiss, ask question) ──

  const handleViewAdvice = useCallback((question: string, topic: string) => {
    setCurrentAdviceText(null);
    adviceMutation.mutate({ question, topic });
  }, [adviceMutation]);

  const handleDismissQuestion = useCallback(() => {
    // Skip current question and request next one
    setCurrentInterviewQuestion(null);
    setCurrentInterviewTopic(null);
    setCurrentAdviceText(null);
    interviewQuestionMutation.mutate({});
  }, [interviewQuestionMutation]);

  const handleAskQuestion = useCallback((question: string) => {
    askQuestionMutation.mutate(question);
  }, [askQuestionMutation]);

  const handleAcceptResponse = useCallback((messageId: string) => {
    // Find the message and merge its content into the document
    const message = discussionMessages.find(m => m.id === messageId);
    if (!message) return;

    // Build a merge instruction from the response
    const perspectivesSummary = message.perspectives?.map(p =>
      `${p.personaLabel}: ${p.content}`
    ).join("\n\n") || "";

    const instruction = `Integrate the following team advice into the document:\n\n${message.content}${perspectivesSummary ? `\n\nDetailed perspectives:\n${perspectivesSummary}` : ""}`;

    writeMutation.mutate({
      instruction,
      description: "Team advice merged",
    });

    // Mark as accepted
    setDiscussionMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, status: "accepted" as const } : m)
    );
  }, [discussionMessages, writeMutation]);

  const handleDismissResponse = useCallback((messageId: string) => {
    setDiscussionMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, status: "dismissed" as const } : m)
    );
  }, []);

  const handleRespondToMessage = useCallback((messageId: string, response: string) => {
    // The user is responding to a persona response — treat it as a follow-up question
    const originalMessage = discussionMessages.find(m => m.id === messageId);
    const context = originalMessage ? `(Responding to: "${originalMessage.content.slice(0, 100)}...") ` : "";
    askQuestionMutation.mutate(`${context}${response}`);
  }, [discussionMessages, askQuestionMutation]);

  // ── Research chat handlers ──

  const updateResearchSummary = useCallback(async (messages: ChatMessage[]) => {
    if (messages.length === 0 && !researchNotes.trim()) return;
    setIsSummaryUpdating(true);
    try {
      const res = await apiRequest("POST", "/api/chat/summarize", {
        objective,
        researchTopic: researchTopic || undefined,
        notes: researchNotes || undefined,
        chatHistory: messages.length > 0 ? messages : [{ role: "user" as const, content: "No chat messages yet" }],
        currentSummary: researchSummary || undefined,
        useGemini: chatUseGemini,
      });
      const data = await res.json();
      if (data.summary) {
        setResearchSummary(data.summary);
        // Also update the document so it can be saved
        setDocument(prev => ({ ...prev, rawText: data.summary }));
      }
    } catch (error) {
      console.error("Failed to update research summary:", error);
    } finally {
      setIsSummaryUpdating(false);
    }
  }, [objective, researchTopic, researchNotes, researchSummary, chatUseGemini]);

  const handleChatSendMessage = useCallback(async (message: string) => {
    // Add user message to chat
    const userMsg: ChatMessage = { role: "user", content: message };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);
    setChatStreamingContent("");

    try {
      // Use streaming endpoint for real-time feedback
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          objective,
          researchTopic: researchTopic || undefined,
          notes: researchNotes || undefined,
          history: chatMessages,
          useGemini: chatUseGemini,
        }),
      });

      if (!response.ok) throw new Error("Chat stream failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content") {
              fullContent += data.content;
              setChatStreamingContent(fullContent);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Finalize the assistant message
      const assistantMsg: ChatMessage = { role: "assistant", content: fullContent };
      const finalMessages = [...updatedMessages, assistantMsg];
      setChatMessages(finalMessages);
      setChatStreamingContent("");
      setIsChatLoading(false);
    } catch (error) {
      console.error("Chat error:", error);
      setIsChatLoading(false);
      setChatStreamingContent("");
      // Add error message
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    }
  }, [chatMessages, objective, researchTopic, researchNotes, chatUseGemini]);

  const handleRefreshSummary = useCallback(() => {
    updateResearchSummary(chatMessages);
  }, [chatMessages, updateResearchSummary]);

  const handleCaptureToNotes = useCallback((text: string) => {
    setResearchNotes(prev => {
      const separator = prev.trim() ? "\n\n---\n\n" : "";
      return prev + separator + text;
    });
  }, []);

  // Auto-trigger initial research when entering research-chat mode
  // so the chat is never empty after submitting topic + objective
  useEffect(() => {
    if (!autoResearchRef.current) return;
    if (layoutOverride !== "research-chat") return;

    const pending = autoResearchRef.current;
    autoResearchRef.current = null;

    handleChatSendMessage(
      `Provide a concise initial overview of this research topic. Prioritize the most recent and authoritative information. Keep it structured and scannable.`
    );
  }, [layoutOverride, handleChatSendMessage]);

  // ── Browser expanded state (for full-screen capture flow) ──
  const [browserExpanded, setBrowserExpanded] = useState(false);

  const handlePreCapture = useCallback(async () => {
    // Expand the browser to full screen before capturing
    setBrowserExpanded(true);
    // Wait for the browser to render at full size
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
  }, []);

  const handlePostCapture = useCallback(() => {
    // Collapse the browser back to normal after capture completes
    setBrowserExpanded(false);
  }, []);

  // ── Common handlers ──

  const handleReset = useCallback(() => {
    setDocument({ id: generateId("doc"), rawText: "" });
    setObjective("");
    setSecondaryObjectiveRaw("");
    setReferenceDocuments([]);
    setCapturedContext([]);
    setVersions([]);
    setShowDiffView(false);
    setEditHistory([]);
    setLastSuggestions([]);
    // Reset transcript / voice state
    setShowTranscriptOverlay(false);
    setRawTranscript("");
    setCleanedTranscript(undefined);
    setTranscriptSummary("");
    setIsRecordingFromMain(false);
    setPendingVoiceContext(null);
    setIsRecordingObjective(false);
    setObjectiveInterimTranscript("");
    // Reset interview state
    setIsInterviewActive(false);
    setInterviewEntries([]);
    setCurrentInterviewQuestion(null);
    setCurrentInterviewTopic(null);
    setInterviewDirection(null);
    // Reset discussion state
    setDiscussionMessages([]);
    setCurrentAdviceText(null);
    setContextCollectionData(null);
    // Reset research chat state
    setChatMessages([]);
    setChatStreamingContent("");
    setIsChatLoading(false);
    setResearchSummary("");
    setResearchNotes("");
    setResearchTopic("");
    setIsSummaryUpdating(false);
    if (summaryDebounceRef.current) clearTimeout(summaryDebounceRef.current);
    // Reset website state
    setWebsiteUrl("");
    setWireframeNotes("");
    setWireframeAnalysis(null);
    setShowLogPanel(false);
    lastAnalyzedUrl.current = "";
    // Reset UI state
    setIsObjectiveCollapsed(true);
    setBrowserExpanded(false);
    // Reset toolbox
    setActiveToolboxApp("provoke");
    autoStartedRef.current = false;
    // Reset storage state
    setSavedDocId(null);
    setSavedDocTitle("");
    // Reset tab state
    setTabs([]);
    setActiveTabId("");
    setRightPanelMode(appFlowConfig.rightPanelTabs[0]?.id ?? "discussion");
    // Reset template selection (so appFlowConfig resets to default)
    setSelectedTemplateId(null);
    setLayoutOverride(null);
  }, []);

  // Show confirmation when there's work in progress, otherwise reset immediately
  const handleNewClick = useCallback(() => {
    const hasWork = document.rawText.trim().length > 0;
    if (hasWork) {
      setShowNewConfirm(true);
    } else {
      handleReset();
    }
  }, [document.rawText, handleReset]);

  // ── Defensive overlay cleanup ──
  // Close all overlays on Escape key — prevents any overlay from getting stuck
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showTranscriptOverlay) {
          setShowTranscriptOverlay(false);
          setRawTranscript("");
          setCleanedTranscript(undefined);
          setTranscriptSummary("");
          setIsRecordingFromMain(false);
          setPendingVoiceContext(null);
        }
        if (showLogPanel) setShowLogPanel(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showTranscriptOverlay, showLogPanel]);

  // Reset all overlay states when returning to input phase (defensive against stuck overlays)
  const prevInputPhase = useRef(isInputPhase);
  useEffect(() => {
    if (isInputPhase && !prevInputPhase.current) {
      // Transitioning TO input phase — ensure no overlays are stuck
      setShowTranscriptOverlay(false);
      setShowLogPanel(false);
      setRawTranscript("");
      setCleanedTranscript(undefined);
      setTranscriptSummary("");
      setIsRecordingFromMain(false);
      setPendingVoiceContext(null);
    }
    prevInputPhase.current = isInputPhase;
  }, [isInputPhase]);

  const handleCaptureMetrics = useCallback((items: ContextItem[]) => {
    setCapturedContext(prev => [...prev, ...items]);
  }, []);

  // ── Usage metrics recording (fire-and-forget) ──

  const recordUsageMetrics = useCallback((trigger: "save" | "copy") => {
    const totalWords = document.rawText.split(/\s+/).filter(Boolean).length;
    const firstDraftWords = versions.length > 0
      ? versions[0].text.split(/\s+/).filter(Boolean).length
      : 0;
    const authorWords = Math.max(0, totalWords - firstDraftWords);
    const COMPOSITION_WPM = 19;
    const readingTime = Math.ceil(totalWords / 200);
    const compositionMinutes = authorWords > 0 ? Math.round(authorWords / COMPOSITION_WPM) : 0;
    const timeSaved = compositionMinutes + readingTime;

    const metrics: { key: string; delta: number }[] = [];
    if (timeSaved > 0) metrics.push({ key: "time_saved_minutes", delta: timeSaved });
    if (authorWords > 0) metrics.push({ key: "author_words", delta: authorWords });
    if (totalWords > 0) metrics.push({ key: "total_words_produced", delta: totalWords });
    if (trigger === "save") metrics.push({ key: "documents_saved", delta: 1 });
    if (trigger === "copy") metrics.push({ key: "documents_copied", delta: 1 });

    if (metrics.length > 0) {
      apiRequest("POST", "/api/metrics", { metrics }).catch(() => {
        // fire-and-forget — don't block user flow
      });
    }
  }, [document.rawText, versions]);

  // ── Storage save/load handlers ──

  const handleStorageSave = useCallback(async (title: string, folderId: number | null) => {
    if (!document.rawText.trim()) return;
    if (savedDocId) {
      await apiRequest("PUT", `/api/documents/${savedDocId}`, {
        title,
        content: document.rawText,
        folderId,
      });
      setSavedDocTitle(title);
    } else {
      const res = await apiRequest("POST", "/api/documents", {
        title,
        content: document.rawText,
        folderId,
      });
      const data = await res.json();
      setSavedDocId(data.id);
      setSavedDocTitle(title);
    }
    recordUsageMetrics("save");
  }, [document, savedDocId, recordUsageMetrics]);

  /** Load a document from Context Store into the objective (replace) */
  const handleLoadObjectiveFromStore = useCallback(async (docId: number, docTitle: string) => {
    setObjectiveStoreLoadingId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      if (data.content) {
        setObjective(data.content);
        setObjectiveStoreOpen(false);
        toast({ title: "Loaded", description: `"${docTitle}" loaded into ${objectiveConfig.primaryLabel.toLowerCase()}.` });
      }
    } catch {
      toast({ title: "Load failed", description: "Could not load the document.", variant: "destructive" });
    } finally {
      setObjectiveStoreLoadingId(null);
    }
  }, [objectiveConfig.primaryLabel, toast]);


  const handleDocumentTextChange = useCallback((newText: string) => {
    if (document) {
      setDocument({ ...document, rawText: newText });
    }
  }, [document]);

  // Handle text edit from pencil icon prompt
  const handleTextEdit = useCallback((newText: string) => {
    if (document) {
      const newVersion: DocumentVersion = {
        id: generateId("v"),
        text: newText,
        timestamp: Date.now(),
        description: "After text edit"
      };
      setVersions(prev => [...prev, newVersion]);
      setDocument({ ...document, rawText: newText });
    }
  }, [document]);

  // Handle screen capture — append directly to avoid base64 data loss through AI
  const handleScreenCapture = useCallback((imageDataUrl: string, annotations: CaptureAnnotation[]) => {
    if (!document) return;

    const timestamp = new Date().toLocaleString();

    const annotationLines = annotations.map(a => {
      const kindLabel = a.kind === "pointer" ? "Pointer" : "Region";
      return `**${kindLabel} ${a.number}**: ${a.narration || "(no description)"}`;
    });

    const pointerCount = annotations.filter(a => a.kind === "pointer").length;
    const regionCount = annotations.filter(a => a.kind === "region").length;
    const countParts: string[] = [];
    if (pointerCount > 0) countParts.push(`${pointerCount} pointer${pointerCount !== 1 ? "s" : ""}`);
    if (regionCount > 0) countParts.push(`${regionCount} region${regionCount !== 1 ? "s" : ""}`);
    const countLabel = countParts.join(" and ");

    const markdownSnippet = [
      "",
      `---`,
      "",
      `### Annotated Screenshot (${timestamp})`,
      "",
      `![Annotated screenshot with ${countLabel}](${imageDataUrl})`,
      "",
      ...annotationLines,
      "",
      `---`,
    ].join("\n");

    // Append directly to preserve the base64 image data intact
    const newText = document.rawText + markdownSnippet;
    const newVersion: DocumentVersion = {
      id: generateId("v"),
      text: newText,
      timestamp: Date.now(),
      description: "Annotated website capture merged",
    };
    setVersions(prev => [...prev, newVersion]);
    setDocument({ ...document, rawText: newText });

    toast({
      title: "Screenshot added",
      description: `Appended annotated screenshot with ${countLabel}.`,
    });
  }, [document, toast]);

  const handleCaptureClose = useCallback((keyword: string) => {
    toast({
      title: keyword,
      description: "Capture dismissed without saving.",
    });
  }, [toast]);

  const toggleDiffView = useCallback(() => {
    setShowDiffView(prev => {
      if (!prev) trackEvent("version_diff_viewed");
      return !prev;
    });
  }, []);

  // Handle document-level voice feedback from mic button in ReadingPane
  const handleSendDocumentFeedback = useCallback((feedback: string) => {
    writeMutation.mutate({
      instruction: feedback,
      description: "Voice feedback",
    });
  }, [writeMutation]);

  // Handle voice merge from text selection in ReadingPane
  const handleSelectionVoiceMerge = useCallback((selectedText: string, transcript: string) => {
    if (!document || !transcript.trim()) return;

    setPendingVoiceContext({
      selectedText,
      context: "selection",
    });
  }, [document]);

  const handleTranscriptUpdate = useCallback((transcript: string, isRecording: boolean) => {
    if (transcript || isRecording) {
      setRawTranscript(transcript);
    }
    setIsRecordingFromMain(isRecording);
    if (isRecording && !showTranscriptOverlay) {
      setShowTranscriptOverlay(true);
      setTranscriptSummary("");
      setCleanedTranscript(undefined);
    }
  }, [showTranscriptOverlay]);

  const handleCloseTranscriptOverlay = useCallback(() => {
    setShowTranscriptOverlay(false);
    setRawTranscript("");
    setCleanedTranscript(undefined);
    setTranscriptSummary("");
    setIsRecordingFromMain(false);
    setPendingVoiceContext(null);
  }, []);

  const handleSendTranscript = useCallback((transcript: string) => {
    if (!document || !transcript.trim()) return;

    const context = pendingVoiceContext;

    if (context?.selectedText) {
      writeMutation.mutate({
        instruction: transcript,
        selectedText: context.selectedText,
        description: "Voice edit on selection",
      });
    } else {
      writeMutation.mutate({
        instruction: transcript,
        description: "Voice instruction",
      });
    }
  }, [document, pendingVoiceContext, writeMutation]);

  const handleCleanTranscript = useCallback((cleaned: string) => {
    setCleanedTranscript(cleaned);
  }, []);

  const handleOverlayFinalTranscript = useCallback((transcript: string) => {
    if (transcript.trim()) {
      setRawTranscript(transcript);
      setIsRecordingFromMain(false);
    }
  }, []);

  // Auto-dismiss the transcript overlay after the result summary is shown
  useEffect(() => {
    if (transcriptSummary && showTranscriptOverlay && !writeMutation.isPending) {
      const timer = setTimeout(() => {
        setShowTranscriptOverlay(false);
        setRawTranscript("");
        setCleanedTranscript(undefined);
        setTranscriptSummary("");
        setIsRecordingFromMain(false);
        setPendingVoiceContext(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [transcriptSummary, showTranscriptOverlay, writeMutation.isPending]);

  // Safety timeout: if the transcript overlay stays open without active recording, close it quickly
  useEffect(() => {
    if (!showTranscriptOverlay || isRecordingFromMain) return;
    const safety = setTimeout(() => {
      console.warn("[Workspace] Transcript overlay safety timeout — auto-closing");
      setShowTranscriptOverlay(false);
      setRawTranscript("");
      setCleanedTranscript(undefined);
      setTranscriptSummary("");
      setIsRecordingFromMain(false);
      setPendingVoiceContext(null);
    }, 5_000);
    return () => clearTimeout(safety);
  }, [showTranscriptOverlay, isRecordingFromMain]);

  // ── Computed values ──

  const canShowDiff = versions.length >= 2;
  const previousVersion = versions.length >= 2 ? versions[versions.length - 2] : null;
  const currentVersion = versions.length >= 1 ? versions[versions.length - 1] : null;

  // Word count of the AI-generated first draft — used by ReadingPane for "time saved" metric
  const draftWordCount = versions.length > 0
    ? versions[0].text.split(/\s+/).filter(Boolean).length
    : undefined;

  const discoveredCount = wireframeAnalysis
    ? (wireframeAnalysis.components?.length || 0) +
      (wireframeAnalysis.siteMap?.length || 0) +
      (wireframeAnalysis.videos?.length || 0) +
      (wireframeAnalysis.audioContent?.length || 0) +
      (wireframeAnalysis.rssFeeds?.length || 0) +
      (wireframeAnalysis.images?.length || 0)
    : 0;

  // Input phase content — rendered inside unified layout below
  const inputPhaseContent = isInputPhase ? (
    <>
      <div className="flex-1 overflow-y-auto">
        <TextInputForm
          onSubmit={(text, obj, refs, templateId, secObj) => {
            setSelectedTemplateId(templateId ?? null);
            if (secObj) setSecondaryObjective(secObj);
            createDraftMutation.mutate({ context: text, obj, refs, templateId: templateId ?? undefined });
          }}
          isLoading={createDraftMutation.isPending}
          onBlankDocument={(obj) => {
            setDocument({ id: generateId("doc"), rawText: " " });
            setObjective(obj);
          }}
          onStreamingMode={(obj, url, templateId) => {
            const streamConfig = getAppFlowConfig(templateId);
            setSelectedTemplateId(templateId ?? null);
            setDocument({ id: generateId("doc"), rawText: " " });
            setObjective(obj);
            if (url) setWebsiteUrl(url);
            setActiveToolboxApp(streamConfig.defaultToolboxTab as ToolboxApp);
            const initialVersion: DocumentVersion = {
              id: generateId("v"),
              text: " ",
              timestamp: Date.now(),
              description: "Capture workspace initialized",
            };
            setVersions([initialVersion]);
          }}
          onVoiceCaptureMode={(obj, templateId) => {
            setSelectedTemplateId(templateId ?? null);
            setDocument({ id: generateId("doc"), rawText: `# ${obj}\n\n*Voice capture started ${new Date().toLocaleString()}*` });
            setObjective(obj);
            const initialVersion: DocumentVersion = {
              id: generateId("v"),
              text: `# ${obj}\n\n*Voice capture started ${new Date().toLocaleString()}*`,
              timestamp: Date.now(),
              description: "Voice capture initialized",
            };
            setVersions([initialVersion]);
          }}
          onYouTubeInfographicMode={(obj, channelUrl, templateId) => {
            setSelectedTemplateId(templateId);
            setDocument({ id: generateId("doc"), rawText: `# YouTube to Infographic\n\n*Loading channel: ${channelUrl}...*` });
            setObjective(obj);
            setWebsiteUrl(channelUrl);
            const ytConfig = getAppFlowConfig(templateId);
            setActiveToolboxApp(ytConfig.defaultToolboxTab as ToolboxApp);
            const initialVersion: DocumentVersion = {
              id: generateId("v"),
              text: `# YouTube to Infographic\n\n*Loading channel...*`,
              timestamp: Date.now(),
              description: "YouTube infographic workspace initialized",
            };
            setVersions([initialVersion]);
          }}
          onVoiceInfographicMode={(obj, transcript, templateId) => {
            setSelectedTemplateId(templateId);
            setDocument({ id: generateId("doc"), rawText: transcript });
            setObjective(obj);
            const viConfig = getAppFlowConfig(templateId);
            setActiveToolboxApp(viConfig.defaultToolboxTab as ToolboxApp);
            const initialVersion: DocumentVersion = {
              id: generateId("v"),
              text: transcript,
              timestamp: Date.now(),
              description: "Raw text loaded into infographic workspace",
            };
            setVersions([initialVersion]);
            // Store transcript in context for processing
            setCapturedContext(prev => [
              ...prev,
              {
                id: generateId("ctx"),
                type: "text" as const,
                content: transcript,
                annotation: "Voice transcript for infographic processing",
                createdAt: Date.now(),
              },
            ]);
          }}
          onResearchChatMode={(obj, topic, templateId) => {
            setSelectedTemplateId(templateId);
            setLayoutOverride("research-chat");
            setDocument({ id: generateId("doc"), rawText: " " });
            setObjective(obj);
            setResearchTopic(topic);
            // Reset chat state for a fresh session
            setChatMessages([]);
            setChatStreamingContent("");
            setResearchSummary("");
            setResearchNotes("");
            const initialVersion: DocumentVersion = {
              id: generateId("v"),
              text: " ",
              timestamp: Date.now(),
              description: "Research session initialized",
            };
            setVersions([initialVersion]);
            // Trigger auto-research so the chat is not empty on start
            autoResearchRef.current = { topic, objective: obj };
          }}
          capturedContext={capturedContext}
          onCapturedContextChange={setCapturedContext}
          onTemplateSelect={(templateId) => setSelectedTemplateId(templateId)}
          selectedTemplateId={selectedTemplateId}
        />
      </div>
      <StepTracker
        currentPhase={workflowPhase}
        selectedTemplate={selectedTemplateName}
        appFlowSteps={appFlowConfig.flowSteps}
        appLeftPanelTabs={appFlowConfig.leftPanelTabs}
      />
    </>
  ) : null;

  // Voice capture content — rendered inside unified layout below
  const isVoiceCapture = !isInputPhase && appFlowConfig.workspaceLayout === "voice-capture";
  const voiceCaptureContent = isVoiceCapture ? (
    <>
      <VoiceCaptureWorkspace
        objective={objective}
        onDocumentUpdate={(text) => setDocument({ ...document, rawText: text })}
        documentText={document.rawText}
        savedDocId={savedDocId}
        onSave={handleStorageSave}
        onSavedDocIdChange={setSavedDocId}
      />

      <StepTracker
        currentPhase="edit"
        selectedTemplate={selectedTemplateName}
        appFlowSteps={appFlowConfig.flowSteps}
        appLeftPanelTabs={appFlowConfig.leftPanelTabs}
      />
    </>
  ) : null;

  // Infographic studio content — 3-panel pipeline (raw text | summary | gallery)
  const isInfographicStudio = !isInputPhase && appFlowConfig.workspaceLayout === "infographic-studio";
  const infographicStudioContent = isInfographicStudio ? (
    <>
      <InfographicStudioWorkspace
        rawText={document.rawText}
        onRawTextChange={(text) => setDocument({ ...document, rawText: text })}
        objective={objective}
      />

      <StepTracker
        currentPhase="edit"
        selectedTemplate={selectedTemplateName}
        appFlowSteps={appFlowConfig.flowSteps}
        appLeftPanelTabs={appFlowConfig.leftPanelTabs}
      />
    </>
  ) : null;

  // Research chat content — 3-panel layout (notes | chat | summary)
  const isResearchChat = !isInputPhase && appFlowConfig.workspaceLayout === "research-chat";
  const researchChatContent = isResearchChat ? (
    <>
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={25} minSize={15}>
            <ResearchNotesPanel
              notes={researchNotes}
              onNotesChange={setResearchNotes}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45} minSize={25}>
            <ChatSessionPanel
              messages={chatMessages}
              isLoading={isChatLoading}
              streamingContent={chatStreamingContent}
              onSendMessage={handleChatSendMessage}
              onCaptureToNotes={handleCaptureToNotes}
              objective={objective}
              researchTopic={researchTopic}
              useGemini={chatUseGemini}
              onToggleModel={setChatUseGemini}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={30} minSize={20}>
            <DynamicSummaryPanel
              summary={researchSummary}
              objective={objective}
              isUpdating={isSummaryUpdating}
              messageCount={chatMessages.length}
              notesLength={researchNotes.length}
              onRefresh={handleRefreshSummary}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  ) : null;

  // ── Panel contents (shared between mobile and desktop layouts) ──

  const toolboxPanel = (
    <ProvocationToolbox
      activeApp={activeToolboxApp}
      onAppChange={(app: ToolboxApp) => { setActiveToolboxApp(app); trackEvent("app_switched", { appSection: app }); }}
      availableTabs={appFlowConfig.leftPanelTabs}
      isInterviewActive={isInterviewActive}
      isMerging={interviewSummaryMutation.isPending}
      interviewEntryCount={interviewEntries.length}
      onStartInterview={handleStartInterview}
      websiteUrl={websiteUrl}
      onUrlChange={handleBrowserUrlChange}
      showLogPanel={showLogPanel}
      onToggleLogPanel={() => setShowLogPanel(!showLogPanel)}
      isAnalyzing={streamingAnalysisMutation.isPending}
      discoveredCount={discoveredCount}
      browserExpanded={browserExpanded}
      onBrowserExpandedChange={setBrowserExpanded}
      contextCollection={contextCollectionData}
      referenceDocuments={referenceDocuments}
      browserHeaderActions={
        <ScreenCaptureButton
          onCapture={handleScreenCapture}
          onClose={handleCaptureClose}
          disabled={!document.rawText || writeMutation.isPending}
          targetElementId="browser-explorer-viewport"
          websiteUrl={websiteUrl}
          onPreCapture={handlePreCapture}
          onPostCapture={handlePostCapture}
        />
      }
      capturedContext={capturedContext}
      onCapturedContextChange={setCapturedContext}
      modelConfig={modelConfig}
      onModelConfigChange={setModelConfig}
      provokeMode={selectedTemplateId === "text-to-infographic" ? "suggest" : "challenge"}
      customTabContent={selectedTemplateId === "agent-editor" ? {
        steps: (
          <div className="flex flex-col h-full">
            {adminEditTaskType && (
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground flex-1">
                  Editing: <span className="font-medium text-foreground">{adminEditTaskType}</span>
                </span>
                <Button
                  size="sm"
                  onClick={() => savePromptOverrideMutation.mutate()}
                  disabled={savePromptOverrideMutation.isPending || agentSteps.length === 0}
                >
                  {savePromptOverrideMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save Prompt Override
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <StepBuilder
                steps={agentSteps}
                onStepsChange={setAgentSteps}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
                persona={agentPersona}
                agentName={agentName}
              />
            </div>
          </div>
        ),
      } : undefined}
    />
  );

  const discussionPanel = (
    <div className="h-full flex flex-col relative overflow-hidden">
      <TranscriptOverlay
        isVisible={showTranscriptOverlay}
        isRecording={isRecordingFromMain}
        rawTranscript={rawTranscript}
        cleanedTranscript={cleanedTranscript}
        resultSummary={transcriptSummary}
        isProcessing={writeMutation.isPending}
        onClose={handleCloseTranscriptOverlay}
        onSend={handleSendTranscript}
        onCleanTranscript={handleCleanTranscript}
        onTranscriptUpdate={handleTranscriptUpdate}
        onFinalTranscript={handleOverlayFinalTranscript}
        context={pendingVoiceContext?.context || "document"}
      />

      {/* Right panel tab toggle — driven by app config */}
      <div className="flex items-center border-b bg-muted/20 shrink-0">
        {appFlowConfig.rightPanelTabs.map((tab) => {
          const Icon = tab.id === "discussion" ? MessageCircle : tab.id === "image-preview" ? ImageIcon : tab.id === "execution" ? Zap : tab.id === "notes" ? StickyNote : Zap;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                rightPanelMode === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setRightPanelMode(tab.id)}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="flex-1" />
        {/* Discussion-specific actions (only when discussion tab is active) */}
        {rightPanelMode === "discussion" && interviewEntries.length > 0 && (
          <div className="pr-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={handleMergeToDraft}
              disabled={interviewMergeMutation.isPending}
            >
              {interviewMergeMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Evolving...
                </>
              ) : (
                <>
                  <ArrowRightToLine className="w-3 h-3" />
                  Evolve Document
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Panel content — swapped based on active mode */}
      {rightPanelMode === "discussion" ? (
        <div className="flex-1 overflow-hidden">
          <InterviewPanel
            isActive={isInterviewActive}
            entries={interviewEntries}
            currentQuestion={currentInterviewQuestion}
            currentTopic={currentInterviewTopic}
            isLoadingQuestion={interviewQuestionMutation.isPending}
            isMerging={interviewSummaryMutation.isPending}
            directionMode={interviewDirection?.mode}
            onAnswer={handleInterviewAnswer}
            onEnd={handleEndInterview}
            onViewAdvice={handleViewAdvice}
            onDismissQuestion={handleDismissQuestion}
            adviceText={currentAdviceText}
            isLoadingAdvice={adviceMutation.isPending}
            onAskQuestion={handleAskQuestion}
            isLoadingAskResponse={askQuestionMutation.isPending}
            discussionMessages={discussionMessages}
            onAcceptResponse={handleAcceptResponse}
            onDismissResponse={handleDismissResponse}
            onRespondToMessage={handleRespondToMessage}
          />
        </div>
      ) : rightPanelMode === "image-preview" ? (
        <ImagePreviewPanel documentText={document.rawText} />
      ) : rightPanelMode === "execution" ? (
        <AgentRunner
          steps={agentSteps}
          persona={agentPersona}
        />
      ) : rightPanelMode === "notes" ? (
        <SessionNotesPanel
          notes={sessionNotes}
          onNotesChange={setSessionNotes}
        />
      ) : null}
    </div>
  );

  const documentPanel = (
    <div className="h-full flex flex-col relative min-h-0">

      {selectedTemplateId === "agent-editor" ? (
        <div className="h-full overflow-y-auto">
          <StepEditor
            step={agentSteps.find((s) => s.id === selectedStepId) ?? null}
            allSteps={agentSteps}
            onStepChange={(updated) => {
              setAgentSteps((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s)),
              );
            }}
            agentName={agentName}
            onAgentNameChange={setAgentName}
            agentDescription={agentDescription}
            onAgentDescriptionChange={setAgentDescription}
            persona={agentPersona}
            onPersonaChange={setAgentPersona}
          />
        </div>
      ) : showDiffView && previousVersion && currentVersion ? (
        <Suspense fallback={
          <div className="h-full flex flex-col p-4 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        }>
          <DiffView
            previousVersion={previousVersion}
            currentVersion={currentVersion}
          />
        </Suspense>
      ) : (
        <ReadingPane
          text={document.rawText}
          onTextChange={handleDocumentTextChange}
          onVoiceMerge={handleSelectionVoiceMerge}
          isMerging={writeMutation.isPending}
          onTranscriptUpdate={handleTranscriptUpdate}
          onTextEdit={handleTextEdit}
          onSendFeedback={handleSendDocumentFeedback}
          draftWordCount={draftWordCount}
          onDocumentCopy={() => recordUsageMetrics("copy")}
          objective={objective}
          templateName={selectedTemplateName}
        />
      )}

      <LogStatsPanel
        isOpen={showLogPanel}
        onClose={() => setShowLogPanel(false)}
        wireframeAnalysis={wireframeAnalysis}
        isAnalyzing={streamingAnalysisMutation.isPending}
        websiteUrl={websiteUrl}
      />

    </div>
  );

  // ── Unified Layout — persistent sidebar + global bar ──

  const isStandardWorkspace = !isInputPhase && !isVoiceCapture && !isInfographicStudio && !isResearchChat;

  return (
    <div className="h-screen flex flex-col">
      {/* ── Persistent global bar ── */}
      <header className="border-b bg-card shrink-0">
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2">
          <div className="flex items-center gap-3">
            {selectedTemplateName && (
              <Badge variant="outline" className="text-xs">
                {selectedTemplateName}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isStandardWorkspace && canShowDiff && (
              <Button
                data-testid="button-versions"
                variant={showDiffView ? "default" : "outline"}
                size="sm"
                onClick={toggleDiffView}
                className="gap-1.5"
              >
                <GitCompare className="w-4 h-4" />
                <span className="hidden sm:inline">Versions</span> ({versions.length})
              </Button>
            )}
            <Link href="/store">
              <Button
                data-testid="button-context-store"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <HardDrive className="w-4 h-4" />
                <span className="hidden sm:inline">Storage</span>
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="sm" className="gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Pricing</span>
              </Button>
            </Link>
            <Button
              data-testid="button-reset"
              variant="ghost"
              size="sm"
              onClick={handleNewClick}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <AutoDictateToggle />
            <ThemeToggle />
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            <DebugButton />
            <UserButton data-testid="button-user-menu-main" />
          </div>
        </div>

        {/* Objective bar — only in standard workspace mode */}
        {isStandardWorkspace && (isObjectiveCollapsed ? (
          <button
            className="border-t px-4 py-2 flex items-center gap-2 w-full text-left hover:bg-muted/50 transition-colors"
            onClick={() => setIsObjectiveCollapsed(false)}
          >
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground/70 shrink-0">{objectiveConfig.primaryLabel}</span>
            <span className="text-sm text-muted-foreground truncate flex-1">
              {objective || `Set your ${objectiveConfig.primaryLabel.toLowerCase()}...`}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ) : isStandardWorkspace ? (
          <div className="border-t px-4 py-3 space-y-3">
            <ProvokeText
              chrome="container"
              variant="textarea"
              data-testid="input-objective-header"
              label={objectiveConfig.primaryLabel}
              labelIcon={Target}
              value={objective}
              onChange={setObjective}
              placeholder={objectiveConfig.primaryPlaceholder}
              className="text-sm leading-relaxed font-serif"
              minRows={2}
              maxRows={4}
              voice={{ mode: "replace" }}
              onVoiceTranscript={(text) => {
                setObjective(text);
                setObjectiveInterimTranscript("");
              }}
              onVoiceInterimTranscript={setObjectiveInterimTranscript}
              onRecordingChange={setIsRecordingObjective}
              textProcessor={processObjectiveText}
              headerActions={
                <div className="flex items-center gap-1">
                  {objectiveConfig.showLoadFromStore && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setObjectiveStoreOpen(true)}>
                      <HardDrive className="w-3.5 h-3.5" />
                      Load
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsObjectiveCollapsed(true);
                    }}
                    title="Minimize objective"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
              }
            />
            <ProvokeText
              chrome="container"
              variant="textarea"
              data-testid="input-secondary-objective-header"
              label={objectiveConfig.secondaryLabel}
              labelIcon={Crosshair}
              value={secondaryObjective}
              onChange={setSecondaryObjective}
              placeholder={objectiveConfig.secondaryPlaceholder}
              className="text-sm leading-relaxed font-serif"
              minRows={1}
              maxRows={3}
              voice={{ mode: "replace" }}
              onVoiceTranscript={(text) => setSecondaryObjective(text)}
            />
          </div>
        ) : null)}

        {/* Voice capture objective bar */}
        {isVoiceCapture && objective && (
          <div className="border-t px-4 py-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {objective}
            </span>
          </div>
        )}

        {/* Research chat header bar */}
        {isResearchChat && (researchTopic || objective) && (
          <div className="border-t px-4 py-2 flex items-center gap-4">
            {researchTopic && (
              <div className="flex items-center gap-2 min-w-0">
                <Crosshair className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-muted-foreground/70 shrink-0">Topic</span>
                <span className="text-sm text-muted-foreground truncate">
                  {researchTopic}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── New button confirmation dialog ── */}
      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new document?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work in progress. Starting a new document will discard your current changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNewConfirm(false); handleReset(); }}>
              Start New
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Load from Context Store dialog ── */}
      <Dialog open={objectiveStoreOpen} onOpenChange={setObjectiveStoreOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <HardDrive className="w-4 h-4 text-primary" />
              Load from Context Store
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select a document to load into your {objectiveConfig.primaryLabel.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 max-h-[calc(70vh-80px)]">
            <div className="p-2">
              {(() => {
                const docs = objectiveStoreDocs?.documents || [];
                const folders = objectiveStoreFolders || [];
                if (!docs.length && !folders.length) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/50">
                      <FolderOpen className="w-8 h-8" />
                      <p className="text-sm">No saved documents yet</p>
                      <p className="text-xs">Save content from the workspace to see it here</p>
                    </div>
                  );
                }

                const rootFolders = folders.filter((f) => f.parentFolderId === null);
                const getChildren = (parentId: number) => folders.filter((f) => f.parentFolderId === parentId);
                const getDocsInFolder = (folderId: number | null) =>
                  docs.filter((d) => (folderId === null ? !d.folderId : d.folderId === folderId));
                const rootDocs = getDocsInFolder(null);

                const toggleStoreFolder = (id: number) => {
                  setStoreExpandedFolders((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                };

                const renderDoc = (doc: { id: number; title: string }, indent: number) => (
                  <button
                    key={`d-${doc.id}`}
                    onClick={() => handleLoadObjectiveFromStore(doc.id, doc.title)}
                    disabled={objectiveStoreLoadingId === doc.id}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
                    style={{ paddingLeft: `${12 + indent * 16}px` }}
                  >
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{doc.title}</span>
                    {objectiveStoreLoadingId === doc.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  </button>
                );

                const renderFolder = (folder: FolderItem, depth: number): ReactNode => {
                  const isExpanded = storeExpandedFolders.has(folder.id);
                  const children = getChildren(folder.id);
                  const folderDocs = getDocsInFolder(folder.id);
                  const hasContent = children.length > 0 || folderDocs.length > 0;

                  return (
                    <div key={`f-${folder.id}`}>
                      <button
                        onClick={() => hasContent && toggleStoreFolder(folder.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                          hasContent ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-default"
                        }`}
                        style={{ paddingLeft: `${12 + depth * 16}px` }}
                      >
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate flex-1 font-medium">{folder.name}</span>
                        {folder.locked && (
                          <span title="System-managed">
                            <Lock className="w-3 h-3 text-muted-foreground/40" />
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div>
                          {children.map((child) => renderFolder(child, depth + 1))}
                          {folderDocs.map((doc) => renderDoc(doc, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {rootFolders.map((folder) => renderFolder(folder, 0))}
                    {rootDocs.length > 0 && rootFolders.length > 0 && (
                      <div className="border-t my-1" />
                    )}
                    {rootDocs.map((doc) => renderDoc(doc, 0))}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Main layout: Sidebar + Content ── */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left sidebar removed — app selection lives in the input-phase tile carousel.
            Once inside a workspace the sidebar was a redundant 4th panel. */}

        {/* Main content area — renders current app experience */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* ── Phase-specific content ── */}
      {inputPhaseContent}
      {voiceCaptureContent}
      {infographicStudioContent}
      {researchChatContent}

      {/* ── Standard workspace content ── */}
      {isStandardWorkspace && (
      <>

      {/* Secondary objective panel (REQ-002, REQ-003) — prominent provocation text */}
      {secondaryObjective.trim() && (
        <div className="border-b bg-violet-50/60 dark:bg-violet-950/30 px-4 py-3">
          <div className="flex items-start gap-2">
            <Crosshair className="w-4 h-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  Secondary objective
                </span>
              </div>
              <p className="text-sm font-serif leading-relaxed text-violet-900 dark:text-violet-100">
                {secondaryObjective}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200"
                onClick={() => {
                  navigator.clipboard.writeText(secondaryObjective);
                  toast({ title: "Copied", description: "Secondary objective copied to clipboard" });
                }}
                title="Copy secondary objective"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: "Secondary Objective", text: secondaryObjective });
                  } else {
                    navigator.clipboard.writeText(secondaryObjective);
                    toast({ title: "Copied", description: "Secondary objective copied to clipboard (share not supported)" });
                  }
                }}
                title="Share secondary objective"
              >
                <Share2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSecondaryObjective("")}
                title="Clear secondary objective"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {writeMutation.isPending && (
        <div className="bg-primary/10 border-b px-4 py-2 flex items-center gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Integrating your feedback into the document...</span>
        </div>
      )}

      {/* Suggestions bar */}
      {!writeMutation.isPending && lastSuggestions.length > 0 && (
        <div className="bg-amber-500/10 border-b px-4 py-2 flex items-center gap-3 text-sm">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-muted-foreground shrink-0">Suggestions:</span>
          <div className="flex items-center gap-2 overflow-x-auto">
            {lastSuggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2 whitespace-nowrap hover:bg-amber-500/20"
                onClick={() => {
                  writeMutation.mutate({
                    instruction: suggestion,
                    description: suggestion,
                  });
                  setLastSuggestions([]);
                }}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-auto shrink-0"
            onClick={() => setLastSuggestions([])}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* ── Panel Layout (responsive: tabbed on mobile, side-by-side on desktop) ── */}
      {isMobile ? (
        <>
          {/* Mobile: single visible panel with bottom tab bar */}
          <div className="flex-1 overflow-hidden">
            {mobileTab === "document" && documentPanel}
            {mobileTab === "toolbox" && toolboxPanel}
            {mobileTab === "discussion" && discussionPanel}
          </div>

          {/* Mobile bottom tab bar */}
          <div className="shrink-0 border-t bg-card flex">
            {([
              { id: "document" as MobileTab, icon: FileText, label: "Document" },
              { id: "toolbox" as MobileTab, icon: Wrench, label: "Tools" },
              { id: "discussion" as MobileTab, icon: MessageCircle, label: "Discussion" },
            ]).map((tab) => {
              const Icon = tab.icon;
              const isActive = mobileTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMobileTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                    isActive
                      ? "text-primary font-semibold border-t-2 border-primary -mt-px"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={25} minSize={15} collapsible collapsedSize={0}>
                {toolboxPanel}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={20}>
                {documentPanel}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={20}>
                {discussionPanel}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          <StepTracker
            currentPhase="edit"
            selectedTemplate={selectedTemplateName}
            activeToolboxApp={activeToolboxApp}
            appFlowSteps={appFlowConfig.flowSteps}
            appLeftPanelTabs={appFlowConfig.leftPanelTabs}
          />
        </>
      )}

      </>
      )}

        </div>{/* end main content area */}
      </div>{/* end sidebar + content row */}

    </div>
  );
}
