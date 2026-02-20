import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { getAppFlowConfig, type AppFlowConfig, type RightPanelTabId, type WorkspaceLayout } from "@/lib/appWorkspaceConfig";
import { TextInputForm } from "@/components/TextInputForm";
import { InterviewPanel } from "@/components/InterviewPanel";
import { LogStatsPanel } from "@/components/LogStatsPanel";
import { ReadingPane } from "@/components/ReadingPane";
import { QueryTabBar, type QueryTab } from "@/components/QueryTabBar";
import { MetricExtractorPanel } from "@/components/MetricExtractorPanel";
import { QueryDiscoveriesPanel, type QueryAnalysisResult } from "@/components/QueryDiscoveriesPanel";
import { TranscriptOverlay } from "@/components/TranscriptOverlay";
import { ProvocationToolbox, type ToolboxApp } from "@/components/ProvocationToolbox";
import { StepTracker, type WorkflowPhase } from "@/components/StepTracker";
import { VoiceCaptureWorkspace } from "@/components/VoiceCaptureWorkspace";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { trackEvent } from "@/lib/tracking";
import { ProvokeText } from "@/components/ProvokeText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StoragePanel } from "@/components/StoragePanel";
import { AutoDictateToggle } from "@/components/AutoDictateToggle";
import { UserButton } from "@clerk/clerk-react";
import { useRole } from "@/hooks/use-role";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Lazy load heavy components
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
import { ScreenCaptureButton, type CaptureAnnotation } from "@/components/ScreenCaptureButton";
import {
  Sparkles,
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
  BarChart3,
  MessageCircle,
  Zap,
  FileText,
  Wrench,
  Shield,
} from "lucide-react";
import { builtInPersonas } from "@shared/personas";
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

/** Detect whether text looks like a SQL query (not markdown/prose) */
function isLikelySqlQuery(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Must start with a SQL keyword and NOT look like markdown
  const sqlStart = /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXPLAIN)\b/i;
  return sqlStart.test(trimmed) && !trimmed.startsWith("#") && !trimmed.startsWith("*");
}

export default function Workspace() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isAdmin } = useRole();

  const [document, setDocument] = useState<Document>({ id: generateId("doc"), rawText: "" });
  const [objective, setObjective] = useState<string>("");
  const [secondaryObjective, setSecondaryObjectiveRaw] = useState<string>("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);

  // Captured context items (persists across phases)
  const [capturedContext, setCapturedContext] = useState<ContextItem[]>([]);

  // Guard: prevent secondary objective from duplicating the primary (REQ-002)
  const setSecondaryObjective = useCallback((value: string) => {
    if (value.trim() && value.trim().toLowerCase() === objective.trim().toLowerCase()) {
      return; // silently reject duplicates
    }
    setSecondaryObjectiveRaw(value);
  }, [objective]);

  // Which template was selected in step 1 — drives workspace behavior
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Computed flow config — the single source of truth for app-specific behavior
  const appFlowConfig: AppFlowConfig = getAppFlowConfig(selectedTemplateId);

  // Toolbox app state — controls which app is active in the left panel
  const [activeToolboxApp, setActiveToolboxApp] = useState<ToolboxApp>("provoke");

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
  const pendingAutoAnalyze = useRef(false);

  // Storage panel state
  const [showStoragePanel, setShowStoragePanel] = useState(false);
  const [savedDocId, setSavedDocId] = useState<number | null>(null);
  const [savedDocTitle, setSavedDocTitle] = useState<string>("");

  // Voice input for objective (no writer call, direct update)
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterimTranscript, setObjectiveInterimTranscript] = useState("");

  // Objective panel collapsed state (minimized by default)
  const [isObjectiveCollapsed, setIsObjectiveCollapsed] = useState(true);

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
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelTabId>("discussion");

  // ── Query Analyzer state ──
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysisResult | null>(null);
  const [selectedSubqueryId, setSelectedSubqueryId] = useState<string | null>(null);
  const [hoveredSubqueryId, setHoveredSubqueryId] = useState<string | null>(null);

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
    // Save current tab state
    setTabs(prev => prev.map(t => t.id === activeTabId ? saveCurrentTabState() : t));
    // Restore target tab
    const target = tabs.find(t => t.id === tabId);
    if (target) restoreTabState(target);
  }, [activeTabId, tabs, saveCurrentTabState, restoreTabState]);

  const handleNewTab = useCallback(() => {
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

  const analyzeQueryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/analyze-query", {
        query: document.rawText,
      });
      return await response.json() as QueryAnalysisResult;
    },
    onSuccess: (data) => {
      setQueryAnalysis(data);
      setSelectedSubqueryId(null);
      setHoveredSubqueryId(null);
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Could not analyze query",
        variant: "destructive",
      });
    },
  });

  const handleAnalyzeQuery = useCallback(() => {
    analyzeQueryMutation.mutate();
    // Auto-switch right panel to Discoveries when analyzing (if available in config)
    const hasDiscoveries = appFlowConfig.rightPanelTabs.some(t => t.id === "discoveries");
    if (hasDiscoveries) {
      setRightPanelMode("discoveries");
    }
  }, [analyzeQueryMutation, appFlowConfig.rightPanelTabs]);

  // Auto-trigger analysis after SQL document is set (deferred from createDraftMutation.onSuccess)
  useEffect(() => {
    if (pendingAutoAnalyze.current && document.rawText && isLikelySqlQuery(document.rawText)) {
      pendingAutoAnalyze.current = false;
      analyzeQueryMutation.mutate();
    }
  }, [document.rawText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Writer mutation ──

  const writeMutation = useMutation({
    mutationFn: async (request: Omit<WriteRequest, "document" | "objective" | "referenceDocuments" | "editHistory" | "capturedContext"> & { description?: string }) => {
      if (!document) throw new Error("No document to write to");

      const writerMode = appFlowConfig.writer.mode;

      // ── ANALYZE mode: document stays immutable, return analysis results ──
      if (writerMode === "analyze") {
        const response = await apiRequest("POST", "/api/analyze-query", {
          query: document.rawText,
        });
        const analysis = await response.json() as QueryAnalysisResult;
        // Store analysis in state (handled in onSuccess via a flag)
        // Return a synthetic WriteResponse so the mutation type stays consistent
        return {
          document: document.rawText, // unchanged
          summary: analysis.overallEvaluation || "Query analysis complete",
          _analysisResult: analysis,  // piggyback the analysis data
        } as WriteResponse & { _analysisResult?: QueryAnalysisResult };
      }

      // ── AGGREGATE mode: append + reorganize, don't rewrite from scratch ──
      if (writerMode === "aggregate") {
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
          appType: selectedTemplateId || undefined,
          referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
          capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
          editHistory: editHistory.length > 0 ? editHistory : undefined,
          ...request,
          instruction: aggregateInstruction,
        });
        return await response.json() as WriteResponse;
      }

      // ── EDIT mode (default): rewrite/evolve document ──
      const useSqlEndpoint = appFlowConfig.writer.outputFormat === "sql" || isLikelySqlQuery(document.rawText);
      if (useSqlEndpoint) {
        const response = await apiRequest("POST", "/api/query-write", {
          query: document.rawText,
          instruction: request.instruction,
          appType: selectedTemplateId || undefined,
          capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        });
        return await response.json() as WriteResponse;
      }

      const response = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        appType: selectedTemplateId || undefined,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
        ...request,
      });
      return await response.json() as WriteResponse;
    },
    onSuccess: (data: WriteResponse & { _analysisResult?: QueryAnalysisResult }, variables) => {
      const writerMode = appFlowConfig.writer.mode;

      // ── ANALYZE mode: populate right panel with analysis, don't update document ──
      if (writerMode === "analyze" && data._analysisResult) {
        setQueryAnalysis(data._analysisResult);
        setSelectedSubqueryId(null);
        setHoveredSubqueryId(null);
        // Switch to discoveries panel
        const hasDiscoveries = appFlowConfig.rightPanelTabs.some(t => t.id === "discoveries");
        if (hasDiscoveries) {
          setRightPanelMode("discoveries");
        }
        setTranscriptSummary(data._analysisResult.overallEvaluation || "Analysis complete.");
        trackEvent("write_executed", { metadata: { instructionType: "analyze" } });
        toast({
          title: "Query Analyzed",
          description: "Evaluation results are in the Discoveries panel.",
        });
        return;
      }

      // ── EDIT & AGGREGATE modes: update document ──
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: variables.description || data.summary || (writerMode === "aggregate" ? "Content aggregated" : "Document updated")
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
          title: writerMode === "aggregate" ? "Content Added" : "Document Updated",
          description: data.summary || "Your changes have been applied.",
        });
      }
    },
    onError: (error) => {
      setTranscriptSummary(`Update failed: ${error instanceof Error ? error.message : "Something went wrong"}. Please try again.`);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // ── Create first draft mutation (input phase → workspace) ──

  const createDraftMutation = useMutation({
    mutationFn: async ({ context, obj, refs, templateId }: { context: string; obj: string; refs: ReferenceDocument[]; templateId?: string }) => {
      // Resolve config for the template being created (may differ from current selectedTemplateId
      // because the draft mutation fires before state is fully updated)
      const draftConfig = getAppFlowConfig(templateId);
      const useSqlEndpoint = draftConfig.writer.outputFormat === "sql" || isLikelySqlQuery(context);

      if (useSqlEndpoint) {
        const response = await apiRequest("POST", "/api/query-write", {
          query: context,
          instruction: "Beautify and format this SQL query. Apply proper indentation, consistent keyword casing, readable structure, and line breaks. If the input is not SQL, extract any SQL from it and format that. Output ONLY the SQL query.",
          appType: templateId || "query-editor",
          capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
        });
        return await response.json() as WriteResponse;
      }

      const response = await apiRequest("POST", "/api/write", {
        document: context,
        objective: obj,
        appType: templateId || undefined,
        instruction: "Create a well-structured first draft from these raw notes and context. Organize the ideas into clear sections, develop the key points, and present the content as a cohesive document ready for further refinement.",
        referenceDocuments: refs.length > 0 ? refs : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
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

      // Auto-run query analysis for SQL documents — use config to determine defaults
      const draftFlowConfig = getAppFlowConfig(variables.templateId);
      if (draftFlowConfig.writer.outputFormat === "sql" || isLikelySqlQuery(data.document)) {
        setActiveToolboxApp(draftFlowConfig.defaultToolboxTab as ToolboxApp);
        // Set right panel to first configured tab
        setRightPanelMode(draftFlowConfig.rightPanelTabs[0]?.id ?? "discussion");
        pendingAutoAnalyze.current = true;
      }

      if (data.summary) {
        toast({
          title: "First Draft Created",
          description: data.summary,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Draft Creation Failed",
        description: error instanceof Error ? error.message : "Could not create the first draft. Please try again.",
        variant: "destructive",
      });
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
        appType: selectedTemplateId || undefined,
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
      toast({
        title: "Interview Error",
        description: error instanceof Error ? error.message : "Failed to generate question",
        variant: "destructive",
      });
    },
  });

  const interviewSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!document || interviewEntries.length === 0) throw new Error("No entries to merge");

      const writerMode = appFlowConfig.writer.mode;

      // ── ANALYZE mode: run analysis instead of merging ──
      if (writerMode === "analyze") {
        const response = await apiRequest("POST", "/api/analyze-query", {
          query: document.rawText,
        });
        const analysis = await response.json() as QueryAnalysisResult;
        return {
          document: document.rawText,
          summary: analysis.overallEvaluation || "Query analysis complete",
          _analysisResult: analysis,
        } as WriteResponse & { _analysisResult?: QueryAnalysisResult };
      }

      // Step 1: Get summarized instruction from interview entries
      const summaryResponse = await apiRequest("POST", "/api/interview/summary", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        entries: interviewEntries,
        document: document.rawText,
        appType: selectedTemplateId || undefined,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      // ── AGGREGATE mode: wrap instruction for append behavior ──
      const effectiveInstruction = writerMode === "aggregate"
        ? `AGGREGATE MODE — Incorporate the following interview insights into this document without rewriting existing content:\n\n${instruction}\n\nPreserve all existing entries. Append new insights. Reorganize sections if needed.`
        : instruction;

      // Step 2: Use the writer to merge into document (route via config)
      const useSqlEndpoint = appFlowConfig.writer.outputFormat === "sql" || isLikelySqlQuery(document.rawText);
      const writeResponse = useSqlEndpoint
        ? await apiRequest("POST", "/api/query-write", {
            query: document.rawText,
            instruction: effectiveInstruction,
            appType: selectedTemplateId || undefined,
            capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
          })
        : await apiRequest("POST", "/api/write", {
            document: document.rawText,
            objective,
            secondaryObjective: secondaryObjective.trim() || undefined,
            appType: selectedTemplateId || undefined,
            instruction: effectiveInstruction,
            referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
            capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
            editHistory: editHistory.length > 0 ? editHistory : undefined,
          });
      return await writeResponse.json() as WriteResponse;
    },
    onSuccess: (data: WriteResponse & { _analysisResult?: QueryAnalysisResult }) => {
      const writerMode = appFlowConfig.writer.mode;

      // ── ANALYZE mode: populate discoveries panel ──
      if (writerMode === "analyze" && data._analysisResult) {
        setQueryAnalysis(data._analysisResult);
        setSelectedSubqueryId(null);
        setHoveredSubqueryId(null);
        const hasDiscoveries = appFlowConfig.rightPanelTabs.some(t => t.id === "discoveries");
        if (hasDiscoveries) setRightPanelMode("discoveries");

        setIsInterviewActive(false);
        setCurrentInterviewQuestion(null);
        setCurrentInterviewTopic(null);

        toast({
          title: "Interview Complete — Query Analyzed",
          description: "Evaluation results are in the Discoveries panel.",
        });
        return;
      }

      // ── EDIT & AGGREGATE modes: update document ──
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: writerMode === "aggregate"
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

        toast({
          title: writerMode === "aggregate" ? "Interview Insights Added" : "Interview Merged",
          description: `${interviewEntries.length} answers integrated into your document.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Merge Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Incremental merge — push interview answers into document without ending the session
  const interviewMergeMutation = useMutation({
    mutationFn: async () => {
      if (!document || interviewEntries.length === 0) throw new Error("No entries to merge");

      const writerMode = appFlowConfig.writer.mode;

      // ── ANALYZE mode: run analysis instead of merging ──
      if (writerMode === "analyze") {
        const response = await apiRequest("POST", "/api/analyze-query", {
          query: document.rawText,
        });
        const analysis = await response.json() as QueryAnalysisResult;
        return {
          document: document.rawText,
          summary: analysis.overallEvaluation || "Query analysis complete",
          _analysisResult: analysis,
        } as WriteResponse & { _analysisResult?: QueryAnalysisResult };
      }

      const summaryResponse = await apiRequest("POST", "/api/interview/summary", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        entries: interviewEntries,
        document: document.rawText,
        appType: selectedTemplateId || undefined,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      const effectiveInstruction = writerMode === "aggregate"
        ? `AGGREGATE MODE — Incorporate the following interview insights without rewriting existing content:\n\n${instruction}\n\nPreserve all existing entries. Append new insights. Reorganize sections if needed.`
        : instruction;

      const useSqlEndpoint = appFlowConfig.writer.outputFormat === "sql" || isLikelySqlQuery(document.rawText);
      const writeResponse = useSqlEndpoint
        ? await apiRequest("POST", "/api/query-write", {
            query: document.rawText,
            instruction: effectiveInstruction,
            appType: selectedTemplateId || undefined,
            capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
          })
        : await apiRequest("POST", "/api/write", {
            document: document.rawText,
            objective,
            secondaryObjective: secondaryObjective.trim() || undefined,
            appType: selectedTemplateId || undefined,
            instruction: effectiveInstruction,
            referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
            capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
            editHistory: editHistory.length > 0 ? editHistory : undefined,
          });
      return await writeResponse.json() as WriteResponse;
    },
    onSuccess: (data: WriteResponse & { _analysisResult?: QueryAnalysisResult }) => {
      const writerMode = appFlowConfig.writer.mode;

      // ── ANALYZE mode: populate discoveries panel ──
      if (writerMode === "analyze" && data._analysisResult) {
        setQueryAnalysis(data._analysisResult);
        setSelectedSubqueryId(null);
        setHoveredSubqueryId(null);
        const hasDiscoveries = appFlowConfig.rightPanelTabs.some(t => t.id === "discoveries");
        if (hasDiscoveries) setRightPanelMode("discoveries");
        setInterviewEntries([]);
        toast({
          title: "Query Re-Analyzed",
          description: "Updated evaluation in the Discoveries panel.",
        });
        return;
      }

      // ── EDIT & AGGREGATE modes: update document ──
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: writerMode === "aggregate"
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
          title: writerMode === "aggregate" ? "Insights Added" : "Merged to Draft",
          description: `${interviewEntries.length} answers integrated. Interview continues.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Merge Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
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
        appType: selectedTemplateId || undefined,
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
      toast({
        title: "Failed to load advice",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // ── Ask question mutation (user asks the persona team) ──
  const askQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/discussion/ask", {
        question,
        document: document.rawText,
        objective,
        appType: selectedTemplateId || undefined,
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
      toast({
        title: "Failed to get response",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
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
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze website",
        variant: "destructive",
      });
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
    interviewSummaryMutation.mutate();
  }, [interviewSummaryMutation]);

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
    setRightPanelMode("discussion");
    // Reset template selection (so appFlowConfig resets to default)
    setSelectedTemplateId(null);
    // Reset analyzer state
    setQueryAnalysis(null);
    setSelectedSubqueryId(null);
    setHoveredSubqueryId(null);
  }, []);

  const handleCaptureMetrics = useCallback((items: ContextItem[]) => {
    setCapturedContext(prev => [...prev, ...items]);
  }, []);

  // ── Storage save/load handlers ──

  const handleStorageSave = useCallback(async (title: string, folderId: number | null) => {
    if (!document.rawText.trim()) return;
    if (savedDocId) {
      // Update existing document
      await apiRequest("PUT", `/api/documents/${savedDocId}`, {
        title,
        content: document.rawText,
        folderId,
      });
      setSavedDocTitle(title);
    } else {
      // Save new document
      const res = await apiRequest("POST", "/api/documents", {
        title,
        content: document.rawText,
        folderId,
      });
      const data = await res.json();
      setSavedDocId(data.id);
      setSavedDocTitle(title);
    }
  }, [document, savedDocId]);

  const handleStorageLoad = useCallback((doc: { id: number; title: string; content: string }) => {
    setDocument({ id: generateId("doc"), rawText: doc.content });
    setSavedDocId(doc.id);
    setSavedDocTitle(doc.title);
    // Set objective from title if empty
    if (!objective) {
      setObjective(doc.title);
    }
  }, [objective]);

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
    setShowDiffView(prev => !prev);
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

  // ── Computed values ──

  const canShowDiff = versions.length >= 2;
  const previousVersion = versions.length >= 2 ? versions[versions.length - 2] : null;
  const currentVersion = versions.length >= 1 ? versions[versions.length - 1] : null;

  const discoveredCount = wireframeAnalysis
    ? (wireframeAnalysis.components?.length || 0) +
      (wireframeAnalysis.siteMap?.length || 0) +
      (wireframeAnalysis.videos?.length || 0) +
      (wireframeAnalysis.audioContent?.length || 0) +
      (wireframeAnalysis.rssFeeds?.length || 0) +
      (wireframeAnalysis.images?.length || 0)
    : 0;

  if (isInputPhase) {
    return (
      <div className="h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="flex items-center justify-between gap-4 px-4 py-2">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-lg">Provocations</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                data-testid="button-storage-input"
                variant="outline"
                size="sm"
                onClick={() => setShowStoragePanel(true)}
                className="gap-1.5"
              >
                <HardDrive className="w-4 h-4" />
                <span className="hidden sm:inline">Storage</span>
              </Button>
              <Button
                data-testid="button-reset-input"
                variant="ghost"
                size="sm"
                onClick={handleReset}
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
              <UserButton data-testid="button-user-menu" />
            </div>
          </div>
        </header>
        <StoragePanel
          isOpen={showStoragePanel}
          onClose={() => setShowStoragePanel(false)}
          onLoadDocument={handleStorageLoad}
          onSave={handleStorageSave}
          hasContent={!!document.rawText.trim()}
          currentDocId={savedDocId}
          currentTitle={savedDocTitle || objective}
        />
        <div className="flex-1 overflow-y-auto">
          <TextInputForm
            onSubmit={(text, obj, refs, templateId) => {
              setSelectedTemplateId(templateId ?? null);
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
            capturedContext={capturedContext}
            onCapturedContextChange={setCapturedContext}
            onTemplateSelect={(templateId) => setSelectedTemplateId(templateId)}
          />
        </div>
        <StepTracker
          currentPhase={workflowPhase}
          selectedTemplate={selectedTemplateName}
          appFlowSteps={appFlowConfig.flowSteps}
          appLeftPanelTabs={appFlowConfig.leftPanelTabs}
        />
      </div>
    );
  }

  // ── Voice capture layout — single-page workspace variant ──

  if (appFlowConfig.workspaceLayout === "voice-capture") {
    return (
      <div className="h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="flex items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-lg">Voice Capture</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStoragePanel(true)}
                className="gap-1.5"
              >
                <HardDrive className="w-4 h-4" />
                <span className="hidden sm:inline">Storage</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
              <ThemeToggle />
              <UserButton />
            </div>
          </div>

          {/* Objective bar (collapsed) */}
          {objective && (
            <div className="border-t px-4 py-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {objective}
              </span>
            </div>
          )}
        </header>

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

        <StoragePanel
          isOpen={showStoragePanel}
          onClose={() => setShowStoragePanel(false)}
          onLoadDocument={handleStorageLoad}
          onSave={handleStorageSave}
          hasContent={!!document.rawText.trim()}
          currentDocId={savedDocId}
          currentTitle={savedDocTitle || objective}
        />
      </div>
    );
  }

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
      analyzerSqlText={document.rawText}
      analyzerSubqueries={queryAnalysis?.subqueries ?? []}
      analyzerIsAnalyzing={analyzeQueryMutation.isPending}
      analyzerSelectedSubqueryId={selectedSubqueryId}
      analyzerHoveredSubqueryId={hoveredSubqueryId}
      onAnalyzerSubqueryHover={setHoveredSubqueryId}
      onAnalyzerSubquerySelect={setSelectedSubqueryId}
      onAnalyze={handleAnalyzeQuery}
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
          const Icon = tab.id === "discussion" ? MessageCircle : tab.id === "metrics" ? BarChart3 : Zap;
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
      ) : rightPanelMode === "metrics" ? (
        <MetricExtractorPanel
          documentText={document.rawText}
          onCaptureAsContext={handleCaptureMetrics}
        />
      ) : (
        <QueryDiscoveriesPanel
          analysis={queryAnalysis}
          isAnalyzing={analyzeQueryMutation.isPending}
          selectedSubqueryId={selectedSubqueryId}
          hoveredSubqueryId={hoveredSubqueryId}
          onSubqueryHover={setHoveredSubqueryId}
          onSubquerySelect={setSelectedSubqueryId}
          onCaptureMetrics={handleCaptureMetrics}
          onAcceptChange={(beforeCode, afterCode) => {
            const currentText = document.rawText;
            const idx = currentText.indexOf(beforeCode);
            if (idx !== -1) {
              const newText = currentText.slice(0, idx) + afterCode + currentText.slice(idx + beforeCode.length);
              setDocument({ ...document, rawText: newText });
              toast({
                title: "Change Applied",
                description: "The SQL change has been applied to your query.",
              });
            } else {
              toast({
                title: "Could Not Apply",
                description: "The exact code snippet was not found in the current query. It may have already been changed.",
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  );

  // Tab bar data derived from state
  const tabBarTabs: QueryTab[] = tabs.map(t => ({ id: t.id, title: t.title }));
  const documentPanel = (
    <div className="h-full flex flex-col relative min-h-0">
      {/* Chrome-like tab bar */}
      {tabs.length > 0 && (
        <QueryTabBar
          tabs={tabBarTabs}
          activeTabId={activeTabId}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabRename={handleTabRename}
          onNewTab={handleNewTab}
        />
      )}

      {showDiffView && previousVersion && currentVersion ? (
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

  // ── Layout ──

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg">Provocations</h1>
          </div>

          <div className="flex items-center gap-2">
            {canShowDiff && (
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
            <Button
              data-testid="button-storage"
              variant="outline"
              size="sm"
              onClick={() => setShowStoragePanel(true)}
              className="gap-1.5"
            >
              <HardDrive className="w-4 h-4" />
              <span className="hidden sm:inline">Storage</span>
            </Button>
            <Button
              data-testid="button-reset"
              variant="ghost"
              size="sm"
              onClick={handleReset}
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
            <UserButton data-testid="button-user-menu-main" />
          </div>
        </div>

        {/* Objective bar (collapsible, minimized by default) */}
        {isObjectiveCollapsed ? (
          <button
            className="border-t px-4 py-2 flex items-center gap-2 w-full text-left hover:bg-muted/50 transition-colors"
            onClick={() => setIsObjectiveCollapsed(false)}
          >
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground truncate flex-1">
              {objective || "Set your objective..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ) : (
          <div className="border-t px-4 py-3 space-y-3">
            <ProvokeText
              chrome="container"
              variant="textarea"
              data-testid="input-objective-header"
              label="Objective"
              labelIcon={Target}
              value={objective}
              onChange={setObjective}
              placeholder="What are you creating? Describe your objective..."
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
              }
            />
            <ProvokeText
              chrome="container"
              variant="textarea"
              data-testid="input-secondary-objective-header"
              label="Secondary objective"
              labelIcon={Crosshair}
              value={secondaryObjective}
              onChange={setSecondaryObjective}
              placeholder="Optional: a secondary goal, constraint, or perspective to keep in mind..."
              className="text-sm leading-relaxed font-serif"
              minRows={1}
              maxRows={3}
              voice={{ mode: "replace" }}
              onVoiceTranscript={(text) => setSecondaryObjective(text)}
            />
          </div>
        )}
      </header>

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

      <StoragePanel
        isOpen={showStoragePanel}
        onClose={() => setShowStoragePanel(false)}
        onLoadDocument={handleStorageLoad}
        onSave={handleStorageSave}
        hasContent={!!document.rawText.trim()}
        currentDocId={savedDocId}
        currentTitle={savedDocTitle || objective}
      />
    </div>
  );
}
