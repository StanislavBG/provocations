import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import {
  getAppFlowConfig,
  type AppFlowConfig,
} from "@/lib/appWorkspaceConfig";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { trackEvent } from "@/lib/tracking";
import { errorLogStore } from "@/lib/errorLog";
import { useRole } from "@/hooks/use-role";
import { useRoute } from "wouter";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
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

import { NotebookTopBar } from "@/components/notebook/NotebookTopBar";
import { NotebookLeftPanel } from "@/components/notebook/NotebookLeftPanel";
import { NotebookCenterPanel } from "@/components/notebook/NotebookCenterPanel";
import { NotebookRightPanel } from "@/components/notebook/NotebookRightPanel";
import type { PainterConfig, PainterMode } from "@/components/notebook/PainterPanel";
import type { ImageTabData, SplitDocumentEditorHandle } from "@/components/notebook/SplitDocumentEditor";
import { BSChartWorkspace } from "@/components/bschart/BSChartWorkspace";
import { MobileCapture } from "@/components/notebook/MobileCapture";
import type { ChatSessionContext } from "@/components/ChatDrawer";

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

export default function NotebookWorkspace() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isAdmin } = useRole();
  const [routeMatch, routeParams] = useRoute("/app/:templateId");

  // ── Core state ──
  const [document, setDocument] = useState<Document>({ id: generateId("doc"), rawText: "" });
  const [objective, setObjective] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    routeMatch ? routeParams?.templateId ?? null : null,
  );
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [capturedContext, setCapturedContext] = useState<ContextItem[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");

  // ── Layout state ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChartActive, setIsChartActive] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  // ── Painter state ──
  const [isPainting, setIsPainting] = useState(false);
  const [imageTabData, setImageTabData] = useState<Map<string, ImageTabData>>(new Map());
  const [activeImageTabId, setActiveImageTabId] = useState<string | null>(null);
  const centerPanelRef = useRef<SplitDocumentEditorHandle>(null);

  // ── User-to-user chat state (embedded in left panel) ──
  const [activeChatConversationId, setActiveChatConversationId] = useState<number | null>(null);

  // ── Persona state ──
  const [activePersonas, setActivePersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["architect", "product_manager", "ux_designer", "quality_engineer"]),
  );

  // ── Context pinning (persisted to active_context table) ──
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
    staleTime: Infinity, // Load once per session
  });

  // Hydrate pinned docs from persisted state (runs once when data arrives)
  useEffect(() => {
    if (!savedActiveContext?.documentIds?.length) return;
    const ids = savedActiveContext.documentIds;
    setPinnedDocIds((prev) => {
      if (prev.size > 0) return prev; // Don't overwrite user's in-session changes
      return new Set(ids);
    });
    // Fetch content for each pinned doc
    for (const id of ids) {
      apiRequest("GET", `/api/documents/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setPinnedDocContents((prev) => ({
            ...prev,
            [id]: { title: data.title, content: data.content },
          }));
        })
        .catch(() => {/* Non-fatal: doc may have been deleted */});
    }
  }, [savedActiveContext]);

  // ── Preview state for context documents ──
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string } | null>(null);

  // ── Document versioning ──
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  // ── Discussion / chat state ──
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);

  // ── Session ──
  // (session name removed — top bar now shows logo + brand)

  // ── Computed values ──
  const appFlowConfig: AppFlowConfig = getAppFlowConfig(selectedTemplateId);
  const validAppType =
    selectedTemplateId && (templateIds as readonly string[]).includes(selectedTemplateId)
      ? selectedTemplateId
      : undefined;
  const selectedTemplateName = selectedTemplateId
    ? prebuiltTemplates.find((t) => t.id === selectedTemplateId)?.title
    : undefined;

  // ── Build active context (pinned docs + captured items) ──
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

  // ── Write mutation (merges content into document) ──
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

  // ── Ask question mutation (chat with persona team) ──
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

  // ── Context pinning (fetches doc content on pin) ──
  const handlePinDoc = useCallback(
    async (id: number) => {
      setPinnedDocIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Persist pin to cold store (fire-and-forget)
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
    // Persist unpin to cold store (fire-and-forget)
    apiRequest("POST", "/api/active-context/unpin", { documentId: id }).catch(() => {});
  }, []);

  // ── Capture research response to active context ──
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

  // ── Save document to Context Store ──
  const [isSavingToContext, setIsSavingToContext] = useState(false);
  const handleSaveToContext = useCallback(async () => {
    if (!document.rawText.trim()) return;
    setIsSavingToContext(true);
    try {
      const title = objective?.trim()
        ? objective.trim().slice(0, 120)
        : `Document ${new Date().toLocaleDateString()}`;
      // Store objective as a header in the content so it travels with the document
      const content = objective?.trim()
        ? `> **Objective:** ${objective.trim()}\n\n${document.rawText}`
        : document.rawText;
      await apiRequest("POST", "/api/documents", { title, content });
      trackEvent("document_saved");
      toast({ title: "Saved to Context Store", description: title });
    } catch {
      toast({ title: "Save failed", description: "Could not save document.", variant: "destructive" });
    } finally {
      setIsSavingToContext(false);
    }
  }, [document.rawText, objective, toast]);

  // ── Evolve document via writer (multi-config) ──
  const handleEvolve = useCallback(
    (configurations: import("@/components/notebook/SplitDocumentEditor").WriterConfig[]) => {
      if (configurations.length === 0) return;

      // Single general config — simple instruction
      if (configurations.length === 1 && configurations[0].category === "general") {
        writeMutation.mutate({
          instruction: "Improve the document — refine it based on the objective.",
          description: "Evolve: general improvement",
        });
        return;
      }

      // Build a structured multi-config instruction
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

  // ── Paint image via Painter configs ──
  const handlePaintImage = useCallback(
    async (config: {
      painterConfigs: PainterConfig[];
      painterObjective: string;
      negativePrompt?: string;
      painterMode: PainterMode;
    }) => {
      const { painterConfigs, painterObjective, negativePrompt, painterMode } = config;

      // Include Active Context (pinned docs) — infographic mode sends more
      // context since Nano Banana 2 excels at data visualization from rich input
      const contextLimit = painterMode === "infographic" ? 1500 : 500;
      const contextJoinLimit = painterMode === "infographic" ? 3000 : 1000;
      const contextSnippets = Object.values(pinnedDocContents)
        .map((doc) => doc.content.slice(0, contextLimit))
        .filter(Boolean);
      const contextSuffix = contextSnippets.length > 0
        ? `. Context: ${contextSnippets.join("; ").slice(0, contextJoinLimit)}`
        : "";

      // Build prompt from configs — mode-aware
      const parts: string[] = [];
      let aspectRatio = "1:1";
      let stylePart = "";

      if (painterMode === "infographic") {
        // Infographic mode — leverage Nano Banana 2's data visualization,
        // diagram, and infographic capabilities for business-grade output.
        const configMap: Record<string, string> = {};
        for (const cfg of painterConfigs) {
          if (cfg.category === "format") {
            aspectRatio = cfg.option;
          } else {
            configMap[cfg.category] = cfg.optionLabel;
            parts.push(`${cfg.categoryLabel}: ${cfg.optionLabel}`);
          }
        }
        // Build a rich structured style directive for the image model
        const layoutHint = configMap["layout"] || "Dashboard";
        const dataHint = configMap["data-style"] || "Charts & Graphs";
        const paletteHint = configMap["palette"] || "Corporate";
        const typoHint = configMap["typography"] || "Geometric Sans";
        const densityHint = configMap["density"] || "Balanced";
        stylePart = `Professional ${layoutHint} infographic, ${paletteHint} color scheme, ${typoHint} typography, ${densityHint} density, featuring ${dataHint}`;
      } else {
        // Art mode: original behavior
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
      const style = painterMode === "infographic"
        ? stylePart
        : [stylePart, ...parts.filter((p) => p.includes("mood"))].filter(Boolean).join(", ");

      // Create or reuse the active image tab
      const tabId = activeImageTabId || generateId("img");
      if (!activeImageTabId) {
        centerPanelRef.current?.addImageTab(tabId);
      }

      // Mark as generating
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
          numberOfImages: 1,
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
    [activeImageTabId, toast, pinnedDocContents],
  );

  const handleImageActiveChange = useCallback((isActive: boolean, tabId: string | null) => {
    setActiveImageTabId(isActive ? tabId : null);
  }, []);

  // ── Open a context document for preview ──
  const handleOpenDoc = useCallback(async (id: number, title: string) => {
    // Check if already in pinned cache
    const cached = pinnedDocContents[id];
    if (cached) {
      setPreviewDoc({ title: cached.title, content: cached.content });
      return;
    }
    // Fetch from server
    try {
      const res = await apiRequest("GET", `/api/documents/${id}`);
      const data = await res.json();
      setPreviewDoc({ title: data.title || title, content: data.content || "" });
    } catch {
      toast({ title: "Failed to load document", variant: "destructive" });
    }
  }, [pinnedDocContents, toast]);

  // ── New workspace ──
  const handleNewSession = useCallback(() => {
    if (document.rawText || objective) {
      setShowNewConfirm(true);
    } else {
      // Already empty — nothing to confirm
    }
  }, [document.rawText, objective]);

  const confirmNewSession = useCallback(() => {
    setDocument({ id: generateId("doc"), rawText: "" });
    setObjective("");
    setSelectedTemplateId(null);
    setVersions([]);
    setEditHistory([]);
    setDiscussionMessages([]);
    setCapturedContext([]);
    setShowNewConfirm(false);
  }, []);

  // ── Render ──

  // Mobile: completely separate note-capture experience
  if (isMobile) {
    return <MobileCapture />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <NotebookTopBar
        onNew={handleNewSession}
        isAdmin={isAdmin}
        versionCount={versions.length}
      />

      {/* Main layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: 3-column resizable layout — side panels swap based on active tab type */}
        <ResizablePanelGroup
          key={isChartActive ? "chart-layout" : appFlowConfig.workspaceLayout === "bs-chart" ? "bs-chart-layout" : "doc-layout"}
          direction="horizontal"
        >
            {/* Left panel (hidden when chart tab is active or bs-chart app) */}
            {!isChartActive && appFlowConfig.workspaceLayout !== "bs-chart" && (
              <>
                <ResizablePanel
                  defaultSize={20}
                  minSize={4}
                  collapsible
                  collapsedSize={4}
                  onCollapse={() => setSidebarCollapsed(true)}
                  onExpand={() => setSidebarCollapsed(false)}
                >
                  <NotebookLeftPanel
                    pinnedDocIds={pinnedDocIds}
                    onPinDoc={handlePinDoc}
                    onUnpinDoc={handleUnpinDoc}
                    onOpenDoc={handleOpenDoc}
                    chatSessionContext={{
                      objective,
                      templateName: selectedTemplateName ?? null,
                      documentExcerpt: document.rawText.slice(0, 200),
                    } satisfies ChatSessionContext}
                    activeChatConversationId={activeChatConversationId}
                    onActiveChatConversationChange={setActiveChatConversationId}
                    isCollapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* Center: Document editor (with chart tabs) or BS Chart app */}
            <ResizablePanel defaultSize={isChartActive || appFlowConfig.workspaceLayout === "bs-chart" ? 100 : 55} minSize={30}>
              {appFlowConfig.workspaceLayout === "bs-chart" ? (
                <BSChartWorkspace
                  onSaveToContext={(json, label) => handleCaptureToContext(json, label)}
                />
              ) : (
                <NotebookCenterPanel
                  ref={centerPanelRef}
                  documentText={document.rawText}
                  onDocumentTextChange={(text) => setDocument({ ...document, rawText: text })}
                  isMerging={writeMutation.isPending}
                  objective={objective}
                  onObjectiveChange={setObjective}
                  templateName={selectedTemplateName}
                  previewDoc={previewDoc}
                  onClosePreview={() => setPreviewDoc(null)}
                  onOpenPreviewDoc={(content, title) => {
                    setDocument({ id: generateId("doc"), rawText: content });
                    setObjective(title);
                  }}
                  onChartActiveChange={setIsChartActive}
                  onSaveToContext={handleSaveToContext}
                  isSaving={isSavingToContext}
                  onEvolve={handleEvolve}
                  isEvolving={writeMutation.isPending}
                  imageTabData={imageTabData}
                  onImageActiveChange={handleImageActiveChange}
                  capturedContext={capturedContext}
                  pinnedDocContents={pinnedDocContents}
                  sessionNotes={sessionNotes}
                  editHistory={editHistory}
                  appType={validAppType}
                />
              )}
            </ResizablePanel>

            {/* Right panel (hidden when chart tab is active or bs-chart app) */}
            {!isChartActive && appFlowConfig.workspaceLayout !== "bs-chart" && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={15}>
                  <NotebookRightPanel
                    activePersonas={activePersonas}
                    onTogglePersona={handleTogglePersona}
                    discussionMessages={discussionMessages}
                    onSendMessage={handleSendMessage}
                    onAcceptResponse={handleAcceptResponse}
                    onDismissResponse={handleDismissResponse}
                    onRespondToMessage={handleRespondToMessage}
                    isChatLoading={askQuestionMutation.isPending}
                    hasDocument={!!document.rawText.trim() || Object.keys(pinnedDocContents).length > 0}
                    objective={objective}
                    onCaptureToContext={handleCaptureToContext}
                    capturedContext={capturedContext}
                    onRemoveCapturedItem={handleRemoveCapturedItem}
                    onEvolveDocument={(instruction, description) => writeMutation.mutate({ instruction, description })}
                    isMerging={writeMutation.isPending}
                    documentText={document.rawText}
                    onPaintImage={handlePaintImage}
                    isPainting={isPainting}
                    pinnedDocContents={pinnedDocContents}
                    appType={validAppType}
                  />
                </ResizablePanel>
              </>
            )}
        </ResizablePanelGroup>
      </div>

      {/* New workspace confirmation */}
      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current document, active context, and chat
              history. Make sure to save first if you want to keep your work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNewSession}>
              Start New
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
