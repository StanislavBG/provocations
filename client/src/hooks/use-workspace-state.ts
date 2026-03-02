import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import {
  getAppFlowConfig,
  type AppFlowConfig,
} from "@/lib/appWorkspaceConfig";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { trackEvent } from "@/lib/tracking";
import { errorLogStore } from "@/lib/errorLog";
import type { PainterConfig, PainterMode, PainterSource, PaintImageRequest, PainterAdvancedParams } from "@/components/notebook/PainterPanel";
import type { WriterConfig } from "@/components/notebook/WriterPanel";
import type { ImageTabData, SplitDocumentEditorHandle } from "@/components/notebook/SplitDocumentEditor";
import type { TimelineSummary } from "@/components/timeline/TimelineWorkspace";

import { templateIds } from "@shared/schema";
import type {
  Document,
  ProvocationType,
  DocumentVersion,
  WriteResponse,
  EditHistoryEntry,
  DiscussionMessage,
  AskQuestionResponse,
  ReferenceDocument,
  ContextItem,
} from "@shared/schema";

export interface WorkspaceState {
  // Core state
  document: Document;
  setDocument: React.Dispatch<React.SetStateAction<Document>>;
  objective: string;
  setObjective: React.Dispatch<React.SetStateAction<string>>;
  activeDocumentId: number | null;
  setActiveDocumentId: React.Dispatch<React.SetStateAction<number | null>>;
  activeDocumentTitle: string | null;
  setActiveDocumentTitle: React.Dispatch<React.SetStateAction<string | null>>;
  selectedTemplateId: string | null;
  setSelectedTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
  referenceDocuments: ReferenceDocument[];
  setReferenceDocuments: React.Dispatch<React.SetStateAction<ReferenceDocument[]>>;
  capturedContext: ContextItem[];
  setCapturedContext: React.Dispatch<React.SetStateAction<ContextItem[]>>;
  sessionNotes: string;
  setSessionNotes: React.Dispatch<React.SetStateAction<string>>;

  // Painter state
  isPainting: boolean;
  imageTabData: Map<string, ImageTabData>;
  activeImageTabId: string | null;
  showPainterStudio: boolean;
  setShowPainterStudio: React.Dispatch<React.SetStateAction<boolean>>;
  centerPanelRef: React.RefObject<SplitDocumentEditorHandle>;

  // Timeline
  timelineSummary: TimelineSummary | null;
  setTimelineSummary: React.Dispatch<React.SetStateAction<TimelineSummary | null>>;

  // Chat state
  activeChatConversationId: number | null;
  setActiveChatConversationId: React.Dispatch<React.SetStateAction<number | null>>;

  // Persona state
  activePersonas: Set<ProvocationType>;
  handleTogglePersona: (id: ProvocationType) => void;

  // Context pinning
  pinnedDocIds: Set<number>;
  pinnedDocContents: Record<number, { title: string; content: string }>;
  handlePinDoc: (id: number) => Promise<void>;
  handleUnpinDoc: (id: number) => void;

  // Preview state
  previewDoc: { title: string; content: string; docId?: number } | null;
  setPreviewDoc: React.Dispatch<React.SetStateAction<{ title: string; content: string; docId?: number } | null>>;

  // Versioning
  versions: DocumentVersion[];
  editHistory: EditHistoryEntry[];

  // Discussion
  discussionMessages: DiscussionMessage[];

  // Computed
  appFlowConfig: AppFlowConfig;
  validAppType: string | undefined;
  selectedTemplateName: string | undefined;

  // Mutations
  writeMutation: ReturnType<typeof useMutation<WriteResponse, Error, { instruction: string; description?: string }>>;
  askQuestionMutation: ReturnType<typeof useMutation<AskQuestionResponse, Error, string>>;

  // Handlers
  handleSendMessage: (text: string) => void;
  handleAcceptResponse: (messageId: string) => void;
  handleDismissResponse: (messageId: string) => void;
  handleRespondToMessage: (messageId: string, response: string) => void;
  handleCaptureToContext: (text: string, label: string) => void;
  handleRemoveCapturedItem: (itemId: string) => void;
  handleMoveToDocument: (content: string) => void;
  handleSaveToContext: (tabTitle?: string) => Promise<void>;
  handleSaveImageToContext: (imageUrl: string, prompt: string) => Promise<void>;
  handleSaveTimelineToContextStore: (json: string, label: string) => Promise<void>;
  handleWriterFeedback: (instruction: string, selectedText?: string, description?: string) => void;
  handleEvolve: (configurations: WriterConfig[]) => void;
  handlePaintImage: (config: PaintImageRequest) => Promise<void>;
  handleImageActiveChange: (isActive: boolean, tabId: string | null) => void;
  handlePreviewDoc: (id: number, title: string) => Promise<void>;
  handleOpenDoc: (id: number, title: string) => Promise<void>;
  handleMapNotesToTimeline: () => void;
  isSavingToContext: boolean;
  isMapPending: boolean;

  // Layout
  isChartActive: boolean;
  setIsChartActive: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useWorkspaceState(initialTemplateId: string | null): WorkspaceState {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Core state ──
  const [document, setDocument] = useState<Document>({ id: generateId("doc"), rawText: "" });
  const [objective, setObjective] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [activeDocumentTitle, setActiveDocumentTitle] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId);
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [capturedContext, setCapturedContext] = useState<ContextItem[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");

  // ── Layout state ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChartActive, setIsChartActive] = useState(false);

  // ── Painter state ──
  const [isPainting, setIsPainting] = useState(false);
  const [imageTabData, setImageTabData] = useState<Map<string, ImageTabData>>(new Map());
  const [activeImageTabId, setActiveImageTabId] = useState<string | null>(null);
  const [showPainterStudio, setShowPainterStudio] = useState(false);
  const centerPanelRef = useRef<SplitDocumentEditorHandle>(null);

  // ── Timeline summary state ──
  const [timelineSummary, setTimelineSummary] = useState<TimelineSummary | null>(null);

  // ── User-to-user chat state ──
  const [activeChatConversationId, setActiveChatConversationId] = useState<number | null>(null);

  // ── Persona state ──
  const [activePersonas, setActivePersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["architect", "product_manager", "ux_designer", "quality_engineer"]),
  );

  // ── Context pinning ──
  const [pinnedDocIds, setPinnedDocIds] = useState<Set<number>>(new Set());
  const [pinnedDocContents, setPinnedDocContents] = useState<
    Record<number, { title: string; content: string }>
  >({});

  // Load persisted active context on mount
  const { data: savedActiveContext } = useQuery<{ documentIds: number[] }>({
    queryKey: ["/api/active-context"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/active-context");
      return res.json();
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!savedActiveContext?.documentIds?.length) return;
    const ids = savedActiveContext.documentIds;
    setPinnedDocIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(ids);
    });
    for (const id of ids) {
      apiRequest("GET", `/api/documents/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setPinnedDocContents((prev) => ({
            ...prev,
            [id]: { title: data.title, content: data.content },
          }));
        })
        .catch(() => {});
    }
  }, [savedActiveContext]);

  // ── Preview state ──
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string; docId?: number } | null>(null);

  // ── Document versioning ──
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  // ── Discussion state ──
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);

  // ── Computed values ──
  const appFlowConfig: AppFlowConfig = getAppFlowConfig(selectedTemplateId);
  const validAppType =
    selectedTemplateId && (templateIds as readonly string[]).includes(selectedTemplateId)
      ? selectedTemplateId
      : undefined;
  const selectedTemplateName = selectedTemplateId
    ? prebuiltTemplates.find((t) => t.id === selectedTemplateId)?.title
    : undefined;

  // ── Build active context ──
  const buildSessionContext = useCallback(() => {
    const pinnedItems: ContextItem[] = Object.entries(pinnedDocContents).map(
      ([id, doc]) => ({
        id: `pinned-${id}`,
        type: "text" as const,
        content: `[Document: ${doc.title}]\n${doc.content}`,
        annotation: "Pinned as active context",
        createdAt: Date.now(),
      }),
    );
    return [...capturedContext, ...pinnedItems];
  }, [capturedContext, pinnedDocContents]);

  // ── Write mutation ──
  const writeMutation = useMutation({
    mutationFn: async (request: { instruction: string; description?: string }) => {
      if (!document) throw new Error("No document to write to");

      const isAggregate = appFlowConfig.writer.mode === "aggregate";
      const allContext = buildSessionContext();

      const payload = {
        document: document.rawText,
        objective: objective.trim() || undefined,
        appType: validAppType,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: allContext.length > 0 ? allContext : undefined,
        sessionNotes: sessionNotes.trim() || undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
        ...request,
        ...(isAggregate
          ? {
              instruction: `AGGREGATE MODE — Incorporate: ${request.instruction}\n\nRULES: PRESERVE existing content. APPEND new info. REORGANIZE. Full updated document.`,
            }
          : {}),
      };

      const response = await apiRequest("POST", "/api/write", payload);
      return (await response.json()) as WriteResponse;
    },
    onSuccess: (data, variables) => {
      const newVersion: DocumentVersion = {
        id: generateId("v"),
        text: data.document,
        timestamp: Date.now(),
        description: variables.description || data.summary || "Document updated",
      };
      setVersions((prev) => [...prev, newVersion]);
      setDocument({ ...document, rawText: data.document });

      const historyEntry: EditHistoryEntry = {
        instruction: variables.instruction,
        instructionType: data.instructionType || "general",
        summary: data.summary || "Document updated",
        timestamp: Date.now(),
      };
      setEditHistory((prev) => [...prev.slice(-9), historyEntry]);
      trackEvent("write_executed", { metadata: { instructionType: data.instructionType || "general" } });

      setCapturedContext([]);

      toast({
        title: "Document updated",
        description: data.summary || "Changes integrated successfully",
      });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Write failed";
      errorLogStore.push({ step: "Write", endpoint: "/api/write", message: msg });
      toast({ title: "Write failed", description: msg, variant: "destructive" });
    },
  });

  // ── Ask question mutation ──
  const askQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const allContext = buildSessionContext();
      const response = await apiRequest("POST", "/api/discussion/ask", {
        question,
        document: document.rawText,
        objective,
        appType: validAppType,
        activePersonas: Array.from(activePersonas),
        previousMessages: discussionMessages.length > 0 ? discussionMessages.slice(-10) : undefined,
        capturedContext: allContext.length > 0 ? allContext : undefined,
      });
      return (await response.json()) as AskQuestionResponse;
    },
    onSuccess: (data, question) => {
      const userMsg: DiscussionMessage = {
        id: generateId("dm"),
        role: "user-question",
        content: question,
        topic: data.topic,
        timestamp: Date.now(),
      };
      const responseMsg: DiscussionMessage = {
        id: generateId("dm"),
        role: "persona-response",
        content: data.answer,
        topic: data.topic,
        timestamp: Date.now(),
        perspectives: data.perspectives,
        status: "pending",
      };
      setDiscussionMessages((prev) => [...prev, userMsg, responseMsg]);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to get response";
      errorLogStore.push({ step: "Discussion Ask", endpoint: "/api/discussion/ask", message: msg });
      toast({ title: "Failed to get response", description: msg, variant: "destructive" });
    },
  });

  // ── Map notes to timeline mutation ──
  const mapNotesToTimelineMutation = useMutation({
    mutationFn: async () => {
      if (capturedContext.length === 0) throw new Error("No notes to map");
      const allNotes = capturedContext
        .map((item) => {
          const label = item.annotation || "Note";
          return `## ${label}\n${item.content}`;
        })
        .join("\n\n");

      const res = await apiRequest("POST", "/api/timeline/transform", {
        notes: allNotes,
      });
      return res.json() as Promise<{
        events: Array<{
          title: string;
          description: string;
          date: string;
          endDate?: string;
          dateLabel?: string;
          dateConfidence: "exact" | "approximate" | "estimated";
          type: "milestone" | "phase" | "decision" | "delivery" | "event";
          tags: string[];
          source: "note";
        }>;
        suggestedTags: Array<{ label: string; category: "person" | "place" | "theme" }>;
      }>;
    },
    onSuccess: (data) => {
      const tags = data.suggestedTags.map((t, i) => ({
        id: `tag_${i}`,
        label: t.label,
        category: t.category,
        color: t.category === "person" ? "#ec4899" : t.category === "place" ? "#06b6d4" : "#f97316",
      }));

      const tagLabelToId: Record<string, string> = {};
      for (const tag of tags) {
        tagLabelToId[tag.label.toLowerCase()] = tag.id;
      }

      const events = data.events.map((e, i) => ({
        id: `evt_${i}`,
        ...e,
        tags: e.tags
          .map((label) => tagLabelToId[label.toLowerCase()])
          .filter(Boolean),
      }));

      const json = JSON.stringify({ events, tags });

      if (centerPanelRef.current) {
        centerPanelRef.current.addTimelineTabWithData(json);
      }

      toast({
        title: "Timeline created",
        description: `Extracted ${events.length} event${events.length !== 1 ? "s" : ""} from ${capturedContext.length} note${capturedContext.length !== 1 ? "s" : ""}.`,
      });
      trackEvent("notes_mapped_to_timeline", { metadata: { eventCount: String(events.length), noteCount: String(capturedContext.length) } });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to map notes";
      errorLogStore.push({ step: "Map Notes to Timeline", endpoint: "/api/timeline/transform", message: msg });
      toast({ title: "Timeline mapping failed", description: msg, variant: "destructive" });
    },
  });

  const handleMapNotesToTimeline = useCallback(() => {
    mapNotesToTimelineMutation.mutate();
  }, [mapNotesToTimelineMutation]);

  // ── Chat handlers ──
  const handleSendMessage = useCallback(
    (text: string) => {
      askQuestionMutation.mutate(text);
    },
    [askQuestionMutation],
  );

  const handleAcceptResponse = useCallback(
    (messageId: string) => {
      const message = discussionMessages.find((m) => m.id === messageId);
      if (!message) return;

      const perspectivesSummary =
        message.perspectives?.map((p) => `${p.personaLabel}: ${p.content}`).join("\n\n") || "";

      const instruction = `Integrate the following team advice into the document:\n\n${message.content}${
        perspectivesSummary ? `\n\nDetailed perspectives:\n${perspectivesSummary}` : ""
      }`;

      writeMutation.mutate({ instruction, description: "Team advice merged" });

      setDiscussionMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "accepted" as const } : m)),
      );
    },
    [discussionMessages, writeMutation],
  );

  const handleDismissResponse = useCallback((messageId: string) => {
    setDiscussionMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: "dismissed" as const } : m)),
    );
  }, []);

  const handleRespondToMessage = useCallback(
    (messageId: string, response: string) => {
      const originalMessage = discussionMessages.find((m) => m.id === messageId);
      const context = originalMessage
        ? `(Responding to: "${originalMessage.content.slice(0, 100)}...") `
        : "";
      askQuestionMutation.mutate(`${context}${response}`);
    },
    [discussionMessages, askQuestionMutation],
  );

  // ── Persona toggle ──
  const handleTogglePersona = useCallback((id: ProvocationType) => {
    setActivePersonas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Context pinning ──
  const handlePinDoc = useCallback(
    async (id: number) => {
      setPinnedDocIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      apiRequest("POST", "/api/active-context/pin", { documentId: id }).catch(() => {});
      try {
        const res = await apiRequest("GET", `/api/documents/${id}`);
        const data = await res.json();
        setPinnedDocContents((prev) => ({
          ...prev,
          [id]: { title: data.title, content: data.content },
        }));
      } catch {
        toast({
          title: "Context load failed",
          description: "Could not load document content",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleUnpinDoc = useCallback((id: number) => {
    setPinnedDocIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPinnedDocContents((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    apiRequest("POST", "/api/active-context/unpin", { documentId: id }).catch(() => {});
  }, []);

  // ── Capture to context ──
  const handleCaptureToContext = useCallback(
    (text: string, label: string) => {
      const item: ContextItem = {
        id: generateId("ctx"),
        type: "text",
        content: text,
        annotation: label,
        createdAt: Date.now(),
      };
      setCapturedContext((prev) => [...prev, item]);
    },
    [],
  );

  const handleRemoveCapturedItem = useCallback((itemId: string) => {
    setCapturedContext((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const handleMoveToDocument = useCallback(
    (content: string) => {
      setDocument((prev) => ({
        ...prev,
        rawText: prev.rawText
          ? `${prev.rawText}\n\n${content}`
          : content,
      }));
      toast({ title: "Moved to Document", description: "Note content appended to document." });
      trackEvent("note_moved_to_document");
    },
    [toast],
  );

  // ── Save document to Context Store ──
  const [isSavingToContext, setIsSavingToContext] = useState(false);
  const handleSaveToContext = useCallback(async (tabTitle?: string) => {
    if (!document.rawText.trim()) return;
    setIsSavingToContext(true);
    try {
      const title = tabTitle?.trim()
        ? tabTitle.trim().slice(0, 120)
        : objective?.trim()
          ? objective.trim().slice(0, 120)
          : `Document ${new Date().toLocaleDateString()}`;
      const content = document.rawText;

      if (activeDocumentId) {
        await apiRequest("PUT", `/api/documents/${activeDocumentId}`, { title, content });
        if (pinnedDocIds.has(activeDocumentId)) {
          setPinnedDocContents((prev) => ({
            ...prev,
            [activeDocumentId]: { title, content },
          }));
        }
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        trackEvent("document_saved");
        toast({ title: "Document saved", description: title });
      } else {
        const res = await apiRequest("POST", "/api/documents", { title, content });
        const data = await res.json();
        if (data.id) setActiveDocumentId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        trackEvent("document_saved");
        toast({ title: "Saved to Context Store", description: title });
      }
    } catch {
      toast({ title: "Save failed", description: "Could not save document.", variant: "destructive" });
    } finally {
      setIsSavingToContext(false);
    }
  }, [document.rawText, objective, activeDocumentId, pinnedDocIds, toast, queryClient]);

  // ── Save image to Context Store ──
  const handleSaveImageToContext = useCallback(async (imageUrl: string, prompt: string) => {
    setIsSavingToContext(true);
    try {
      const words = (prompt || "").replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
      const label = words.slice(0, 2).join(" ") || "Image";
      const title = `${label} — ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const content = imageUrl;
      await apiRequest("POST", "/api/documents", { title, content, docType: "image" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      trackEvent("document_saved");
      toast({ title: "Saved to Context Store", description: title });
    } catch {
      toast({ title: "Save failed", description: "Could not save image.", variant: "destructive" });
    } finally {
      setIsSavingToContext(false);
    }
  }, [toast, queryClient]);

  // ── Save timeline to Context Store ──
  const [timelineDocId, setTimelineDocId] = useState<number | null>(null);
  const handleSaveTimelineToContextStore = useCallback(async (json: string, label: string) => {
    setIsSavingToContext(true);
    try {
      const title = label || `Timeline ${new Date().toLocaleDateString()}`;
      if (timelineDocId) {
        await apiRequest("PUT", `/api/documents/${timelineDocId}`, { title, content: json });
        toast({ title: "Timeline saved", description: title });
      } else {
        const res = await apiRequest("POST", "/api/documents", { title, content: json });
        const data = await res.json();
        if (data.id) setTimelineDocId(data.id);
        toast({ title: "Saved to Context Store", description: title });
      }
      trackEvent("document_saved");
    } catch {
      toast({ title: "Save failed", description: "Could not save timeline.", variant: "destructive" });
    } finally {
      setIsSavingToContext(false);
    }
  }, [timelineDocId, toast]);

  // ── Writer feedback ──
  const handleWriterFeedback = useCallback(
    (instruction: string, selectedText?: string, description?: string) => {
      writeMutation.mutate({
        instruction: selectedText
          ? `WRITER FEEDBACK ON SELECTION:\nThe author has highlighted the following text and provided feedback to remix it:\n\nSELECTED TEXT: "${selectedText}"\n\nAUTHOR FEEDBACK: ${instruction}\n\nApply the author's feedback to improve the selected area while keeping the rest of the document intact.`
          : `WRITER FEEDBACK:\nThe author has provided the following feedback to be remixed into the document:\n\n${instruction}\n\nInterpret the author's intent and intelligently weave this feedback into the document. This is not a literal transcription to append — it is editorial direction from the author.`,
        description: description || "Writer feedback",
      });
    },
    [writeMutation],
  );

  // ── Evolve document ──
  const handleEvolve = useCallback(
    (configurations: WriterConfig[]) => {
      if (configurations.length === 0) return;

      if (configurations.length === 1 && configurations[0].category === "general") {
        writeMutation.mutate({
          instruction: "Improve the document — refine it based on the objective.",
          description: "Evolve: general improvement",
        });
        return;
      }

      const configLines = configurations.map(
        (c, i) => `${i + 1}. ${c.categoryLabel.toUpperCase()} — ${c.optionLabel}`,
      );
      const instruction = [
        "Apply the following document evolution configurations simultaneously:",
        ...configLines,
        "",
        "Where configurations may seem contradictory (e.g., Expand AND Condense), interpret holistically:",
        "expand the UNDERSERVED areas while condensing the REDUNDANT ones.",
        "Apply all configurations in a single coherent pass over the document.",
      ].join("\n");

      const description = configurations
        .map((c) => `${c.categoryLabel}/${c.optionLabel}`)
        .join(" + ");

      writeMutation.mutate({ instruction, description: `Evolve: ${description}` });
    },
    [writeMutation],
  );

  // ── Paint image ──
  const handlePaintImage = useCallback(
    async (config: PaintImageRequest) => {
      const { painterConfigs, painterObjective, negativePrompt, painterMode, excludedSources, advancedParams } = config;

      const skipContext = excludedSources?.has("context");
      const contextLimit = painterMode === "infographic" ? 1500 : 500;
      const contextJoinLimit = painterMode === "infographic" ? 3000 : 1000;
      const contextSnippets = skipContext ? [] : Object.values(pinnedDocContents)
        .map((doc) => doc.content.slice(0, contextLimit))
        .filter(Boolean);
      const contextSuffix = contextSnippets.length > 0
        ? `. Context: ${contextSnippets.join("; ").slice(0, contextJoinLimit)}`
        : "";

      const parts: string[] = [];
      let aspectRatio = "1:1";
      let stylePart = "";

      if (painterMode === "infographic") {
        const configMap: Record<string, string> = {};
        for (const cfg of painterConfigs) {
          if (cfg.category === "format") {
            aspectRatio = cfg.option;
          } else {
            configMap[cfg.category] = cfg.optionLabel;
            parts.push(`${cfg.categoryLabel}: ${cfg.optionLabel}`);
          }
        }
        const layoutHint = configMap["layout"] || "Dashboard";
        const dataHint = configMap["data-style"] || "Charts & Graphs";
        const paletteHint = configMap["palette"] || "Corporate";
        const typoHint = configMap["typography"] || "Geometric Sans";
        const densityHint = configMap["density"] || "Balanced";
        stylePart = `Professional ${layoutHint} infographic, ${paletteHint} color scheme, ${typoHint} typography, ${densityHint} density, featuring ${dataHint}`;
      } else {
        for (const cfg of painterConfigs) {
          if (cfg.category === "format") {
            aspectRatio = cfg.option;
          } else if (cfg.category === "style") {
            stylePart = cfg.optionLabel;
          } else if (cfg.category === "mood") {
            parts.push(`${cfg.optionLabel} mood`);
          } else if (cfg.category === "composition") {
            parts.push(`${cfg.optionLabel} composition`);
          } else if (cfg.category === "detail") {
            parts.push(`${cfg.optionLabel} detail level`);
          }
        }
      }

      const modePrefix = painterMode === "infographic"
        ? "Create a high-quality, detailed infographic. Use clear data visualizations, structured layouts, bold headings, and professional design. Include labeled sections, icons, and visual hierarchy. The infographic should look publication-ready: "
        : "";
      const prompt = modePrefix + [painterObjective, ...parts].filter(Boolean).join(", ") + contextSuffix;

      const existingData = activeImageTabId ? imageTabData.get(activeImageTabId) : undefined;
      const canReuse = activeImageTabId && existingData && !existingData.imageUrl && !existingData.isGenerating;
      const tabId = canReuse ? activeImageTabId : generateId("img");
      if (!canReuse) {
        centerPanelRef.current?.addImageTab(tabId);
      }

      setImageTabData((prev) => {
        const next = new Map(prev);
        next.set(tabId, { imageUrl: null, prompt, isGenerating: true });
        return next;
      });
      setIsPainting(true);

      try {
        const response = await apiRequest("POST", "/api/generate-imagen", {
          prompt,
          style: stylePart || undefined,
          aspectRatio,
          negativePrompt: negativePrompt || undefined,
          numberOfImages: advancedParams?.numberOfImages || 1,
          ...(advancedParams?.temperature !== undefined && { temperature: advancedParams.temperature }),
          ...(advancedParams?.topP !== undefined && { topP: advancedParams.topP }),
          ...(advancedParams?.topK !== undefined && { topK: advancedParams.topK }),
          ...(advancedParams?.seed !== undefined && { seed: advancedParams.seed }),
          ...(advancedParams?.imageSize && { imageSize: advancedParams.imageSize }),
          ...(advancedParams?.personGeneration && { personGeneration: advancedParams.personGeneration }),
          ...(advancedParams?.safetyLevel && { safetyLevel: advancedParams.safetyLevel }),
          ...(advancedParams?.systemInstruction && { systemInstruction: advancedParams.systemInstruction }),
        });

        const data = (await response.json()) as { images?: string[]; error?: string };

        if (data.error && (!data.images || data.images.length === 0)) {
          toast({ title: "Painting failed", description: data.error, variant: "destructive" });
          setImageTabData((prev) => {
            const next = new Map(prev);
            next.set(tabId, { imageUrl: null, prompt, isGenerating: false });
            return next;
          });
          return;
        }

        const imageUrl = data.images?.[0] ?? null;
        setImageTabData((prev) => {
          const next = new Map(prev);
          next.set(tabId, { imageUrl, prompt, isGenerating: false });
          return next;
        });
        trackEvent("painter_generated", { metadata: { configs: painterConfigs.length.toString(), aspectRatio, mode: painterMode } });
      } catch (error) {
        console.error("[painter] generation error:", error);
        toast({ title: "Painting failed", description: "Could not generate image.", variant: "destructive" });
        setImageTabData((prev) => {
          const next = new Map(prev);
          next.set(tabId, { imageUrl: null, prompt, isGenerating: false });
          return next;
        });
      } finally {
        setIsPainting(false);
      }
    },
    [activeImageTabId, imageTabData, toast, pinnedDocContents],
  );

  const handleImageActiveChange = useCallback((isActive: boolean, tabId: string | null) => {
    setActiveImageTabId(isActive ? tabId : null);
  }, []);

  // ── Preview doc ──
  const handlePreviewDoc = useCallback(async (id: number, title: string) => {
    const cached = pinnedDocContents[id];
    if (cached) {
      setPreviewDoc({ title: cached.title, content: cached.content, docId: id });
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/documents/${id}`);
      const data = await res.json();
      setPreviewDoc({ title: data.title || title, content: data.content || "", docId: id });
    } catch {
      toast({ title: "Failed to load document", variant: "destructive" });
    }
  }, [pinnedDocContents, toast]);

  // ── Open doc ──
  const handleOpenDoc = useCallback(async (id: number, title: string) => {
    setPreviewDoc(null);
    const cached = pinnedDocContents[id];
    if (cached) {
      setDocument({ id: generateId("doc"), rawText: cached.content });
      setObjective(cached.title);
      setActiveDocumentId(id);
      setActiveDocumentTitle(cached.title);
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/documents/${id}`);
      const data = await res.json();
      const docTitle = data.title || title;
      setDocument({ id: generateId("doc"), rawText: data.content || "" });
      setObjective(docTitle);
      setActiveDocumentId(id);
      setActiveDocumentTitle(docTitle);
    } catch {
      toast({ title: "Failed to load document", variant: "destructive" });
    }
  }, [pinnedDocContents, toast]);

  return {
    document,
    setDocument,
    objective,
    setObjective,
    activeDocumentId,
    setActiveDocumentId,
    activeDocumentTitle,
    setActiveDocumentTitle,
    selectedTemplateId,
    setSelectedTemplateId,
    referenceDocuments,
    setReferenceDocuments,
    capturedContext,
    setCapturedContext,
    sessionNotes,
    setSessionNotes,
    isPainting,
    imageTabData,
    activeImageTabId,
    showPainterStudio,
    setShowPainterStudio,
    centerPanelRef,
    timelineSummary,
    setTimelineSummary,
    activeChatConversationId,
    setActiveChatConversationId,
    activePersonas,
    handleTogglePersona,
    pinnedDocIds,
    pinnedDocContents,
    handlePinDoc,
    handleUnpinDoc,
    previewDoc,
    setPreviewDoc,
    versions,
    editHistory,
    discussionMessages,
    appFlowConfig,
    validAppType,
    selectedTemplateName,
    writeMutation,
    askQuestionMutation,
    handleSendMessage,
    handleAcceptResponse,
    handleDismissResponse,
    handleRespondToMessage,
    handleCaptureToContext,
    handleRemoveCapturedItem,
    handleMoveToDocument,
    handleSaveToContext,
    handleSaveImageToContext,
    handleSaveTimelineToContextStore,
    handleWriterFeedback,
    handleEvolve,
    handlePaintImage,
    handleImageActiveChange,
    handlePreviewDoc,
    handleOpenDoc,
    handleMapNotesToTimeline,
    isSavingToContext,
    isMapPending: mapNotesToTimelineMutation.isPending,
    isChartActive,
    setIsChartActive,
    sidebarCollapsed,
    setSidebarCollapsed,
  };
}
