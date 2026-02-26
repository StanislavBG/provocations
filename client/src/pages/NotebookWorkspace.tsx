import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { useSessionAutosave } from "@/hooks/use-session-autosave";

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
import { SessionStorePanel } from "@/components/SessionStorePanel";

import { NotebookTopBar } from "@/components/notebook/NotebookTopBar";
import { ContextSidebar } from "@/components/notebook/ContextSidebar";
import { NotebookCenterPanel } from "@/components/notebook/NotebookCenterPanel";
import { NotebookRightPanel } from "@/components/notebook/NotebookRightPanel";
import { OnboardingSplash } from "@/components/notebook/OnboardingSplash";
import { ChatDrawer, type ChatSessionContext } from "@/components/ChatDrawer";

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
  WorkspaceSessionState,
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
  const [showOnboarding, setShowOnboarding] = useState(!routeMatch);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [showSessionStore, setShowSessionStore] = useState(false);

  // ── User-to-user chat state ──
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [activeChatConversationId, setActiveChatConversationId] = useState<number | null>(null);

  // ── Persona state ──
  const [activePersonas, setActivePersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["architect", "product_manager", "ux_designer", "quality_engineer"]),
  );

  // ── Context pinning ──
  const [pinnedDocIds, setPinnedDocIds] = useState<Set<number>>(new Set());

  // ── Document versioning ──
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  // ── Discussion / chat state ──
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);

  // ── Session ──
  const [sessionName, setSessionName] = useState("Untitled Session");

  // ── Computed values ──
  const appFlowConfig: AppFlowConfig = getAppFlowConfig(selectedTemplateId);
  const validAppType =
    selectedTemplateId && (templateIds as readonly string[]).includes(selectedTemplateId)
      ? selectedTemplateId
      : undefined;
  const selectedTemplateName = selectedTemplateId
    ? prebuiltTemplates.find((t) => t.id === selectedTemplateId)?.title
    : undefined;

  // ── Session autosave ──
  const getSessionState = useCallback((): WorkspaceSessionState | null => {
    if (!document.rawText && !objective) return null;
    return {
      document,
      objective,
      secondaryObjective: "",
      interviewEntries: [],
      interviewDirection: {
        mode: "challenge",
        selectedPersonaIds: Array.from(activePersonas),
        guidance: "",
      },
      versions,
      editHistory,
      savedDocId: null,
      savedDocTitle: sessionName,
      sessionNotes,
      capturedContext,
    };
  }, [document, objective, activePersonas, versions, editHistory, sessionName, sessionNotes, capturedContext]);

  const getSessionTitle = useCallback(() => {
    return sessionName || objective?.slice(0, 50) || selectedTemplateName || "Untitled";
  }, [sessionName, objective, selectedTemplateName]);

  const sessionAutosave = useSessionAutosave({
    templateId: selectedTemplateId,
    isActive: !!document.rawText || !!objective,
    getState: getSessionState,
    getTitle: getSessionTitle,
  });

  // ── Write mutation (merges content into document) ──
  const writeMutation = useMutation({
    mutationFn: async (request: { instruction: string; description?: string }) => {
      if (!document) throw new Error("No document to write to");

      const isAggregate = appFlowConfig.writer.mode === "aggregate";

      const payload = {
        document: document.rawText,
        objective,
        appType: validAppType,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
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

  // ── Create draft mutation (fires on "Start Working") ──
  const createDraftMutation = useMutation({
    mutationFn: async ({ obj, tplId }: { obj: string; tplId: string }) => {
      const template = prebuiltTemplates.find((t) => t.id === tplId);
      const appType = (templateIds as readonly string[]).includes(tplId) ? tplId : undefined;
      const config = getAppFlowConfig(tplId);

      const payload = {
        document: template?.templateContent || "(empty — create from scratch)",
        objective: obj,
        appType,
        instruction: `Create a comprehensive first draft based on the objective. ${
          template?.templateContent
            ? "Use the template structure as a starting framework."
            : `This is a ${config.writer.documentType || "document"}.`
        } Fill in all sections with substantive, well-structured content that directly addresses the objective. Write in markdown format.`,
      };

      const response = await apiRequest("POST", "/api/write", payload);
      return (await response.json()) as WriteResponse;
    },
    onSuccess: (data) => {
      const newVersion: DocumentVersion = {
        id: generateId("v"),
        text: data.document,
        timestamp: Date.now(),
        description: "Initial draft created",
      };
      setVersions([newVersion]);
      setDocument((prev) => ({ ...prev, rawText: data.document }));

      toast({
        title: "Draft created",
        description: "Your initial document has been generated. Review and refine it.",
      });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Draft creation failed";
      errorLogStore.push({ step: "Create Draft", endpoint: "/api/write", message: msg });
      toast({ title: "Draft creation failed", description: msg, variant: "destructive" });
    },
  });

  // ── Ask question mutation (chat with persona team) ──
  const askQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/discussion/ask", {
        question,
        document: document.rawText,
        objective,
        appType: validAppType,
        activePersonas: Array.from(activePersonas),
        previousMessages: discussionMessages.length > 0 ? discussionMessages.slice(-10) : undefined,
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

  // ── Context pinning ──
  const handlePinDoc = useCallback((id: number) => {
    setPinnedDocIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleUnpinDoc = useCallback((id: number) => {
    setPinnedDocIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Onboarding / new session ──
  const handleOnboardingStart = useCallback(
    (templateId: string, obj: string) => {
      setSelectedTemplateId(templateId);
      setObjective(obj);
      setShowOnboarding(false);
      setSessionName(obj.slice(0, 50) || "Untitled Session");

      // Initialize document with template content if available
      const template = prebuiltTemplates.find((t) => t.id === templateId);
      if (template?.templateContent) {
        setDocument({ id: generateId("doc"), rawText: template.templateContent });
      }

      trackEvent("template_selected", { metadata: { templateId } });

      // Auto-generate initial draft so the user doesn't start with an empty document
      createDraftMutation.mutate({ obj, tplId: templateId });
    },
    [createDraftMutation],
  );

  const handleNewSession = useCallback(() => {
    if (document.rawText || objective) {
      setShowNewConfirm(true);
    } else {
      setShowOnboarding(true);
    }
  }, [document.rawText, objective]);

  const confirmNewSession = useCallback(() => {
    setDocument({ id: generateId("doc"), rawText: "" });
    setObjective("");
    setSelectedTemplateId(null);
    setVersions([]);
    setEditHistory([]);
    setDiscussionMessages([]);
    setSessionName("Untitled Session");
    sessionAutosave.setCurrentSessionId(null);
    setShowNewConfirm(false);
    setShowOnboarding(true);
  }, [sessionAutosave]);

  // ── Session management ──
  const handleSave = useCallback(async () => {
    await sessionAutosave.saveNow();
    toast({ title: "Saved", description: "Session saved successfully" });
  }, [sessionAutosave, toast]);

  const handleSessionStoreLoad = useCallback(
    (sessionId: number, state: WorkspaceSessionState, templateId: string) => {
      setDocument(state.document);
      setObjective(state.objective);
      setSelectedTemplateId(templateId);
      setVersions(state.versions);
      setEditHistory(state.editHistory);
      setCapturedContext(state.capturedContext);
      setSessionNotes(state.sessionNotes ?? "");
      sessionAutosave.setCurrentSessionId(sessionId);
      setShowSessionStore(false);
      setShowOnboarding(false);
      setSessionName(state.objective?.slice(0, 50) || "Loaded Session");
    },
    [sessionAutosave],
  );

  // ── Mobile tab state ──
  type MobileTab = "context" | "document" | "chat";
  const [mobileTab, setMobileTab] = useState<MobileTab>("document");

  // ── Render ──
  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <NotebookTopBar
        sessionName={sessionName}
        onSessionNameChange={setSessionName}
        onSave={handleSave}
        onLoad={() => setShowSessionStore(true)}
        onNew={handleNewSession}
        isSaving={sessionAutosave.isSaving}
        isAdmin={isAdmin}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        objective={objective}
        onOpenChat={() => setChatDrawerOpen(true)}
        versionCount={versions.length}
      />

      {/* Main layout */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          /* Mobile: tabbed single-panel view */
          <>
            <div className="flex-1 h-[calc(100%-48px)] overflow-hidden">
              {mobileTab === "context" && (
                <ContextSidebar
                  pinnedDocIds={pinnedDocIds}
                  onPinDoc={handlePinDoc}
                  onUnpinDoc={handleUnpinDoc}
                  isCollapsed={false}
                  onToggleCollapse={() => setMobileTab("document")}
                />
              )}
              {mobileTab === "document" && (
                <NotebookCenterPanel
                  documentText={document.rawText}
                  onDocumentTextChange={(text) => setDocument({ ...document, rawText: text })}
                  isMerging={writeMutation.isPending}
                  isGeneratingDraft={createDraftMutation.isPending}
                  objective={objective}
                  templateName={selectedTemplateName}
                />
              )}
              {mobileTab === "chat" && (
                <NotebookRightPanel
                  activePersonas={activePersonas}
                  onTogglePersona={handleTogglePersona}
                  discussionMessages={discussionMessages}
                  onSendMessage={handleSendMessage}
                  onAcceptResponse={handleAcceptResponse}
                  onDismissResponse={handleDismissResponse}
                  onRespondToMessage={handleRespondToMessage}
                  isChatLoading={askQuestionMutation.isPending}
                />
              )}
            </div>

            {/* Mobile bottom tab bar */}
            <div className="h-12 shrink-0 border-t bg-card flex">
              {([
                { id: "context" as MobileTab, label: "Sources" },
                { id: "document" as MobileTab, label: "Document" },
                { id: "chat" as MobileTab, label: "Chat" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMobileTab(tab.id)}
                  className={`flex-1 flex items-center justify-center text-xs transition-colors ${
                    mobileTab === tab.id
                      ? "text-primary font-semibold border-t-2 border-primary -mt-px"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Desktop: 3-column resizable layout */
          <ResizablePanelGroup direction="horizontal">
            {/* Left: Context Sidebar */}
            <ResizablePanel
              defaultSize={20}
              minSize={4}
              collapsible
              collapsedSize={4}
              onCollapse={() => setSidebarCollapsed(true)}
              onExpand={() => setSidebarCollapsed(false)}
            >
              <ContextSidebar
                pinnedDocIds={pinnedDocIds}
                onPinDoc={handlePinDoc}
                onUnpinDoc={handleUnpinDoc}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center: Document */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <NotebookCenterPanel
                documentText={document.rawText}
                onDocumentTextChange={(text) => setDocument({ ...document, rawText: text })}
                isMerging={writeMutation.isPending}
                isGeneratingDraft={createDraftMutation.isPending}
                objective={objective}
                templateName={selectedTemplateName}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: Personas + Chat */}
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
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingSplash
          onStart={handleOnboardingStart}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* New session confirmation */}
      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current document and chat history. Make sure
              to save first if you want to keep your work.
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

      {/* User-to-user chat drawer */}
      <ChatDrawer
        open={chatDrawerOpen}
        onOpenChange={setChatDrawerOpen}
        sessionContext={{
          objective,
          templateName: selectedTemplateName ?? null,
          documentExcerpt: document.rawText.slice(0, 200),
        } satisfies ChatSessionContext}
        activeConversationId={activeChatConversationId}
        onActiveConversationChange={setActiveChatConversationId}
      />

      {/* Session Store panel */}
      <SessionStorePanel
        isOpen={showSessionStore}
        onClose={() => setShowSessionStore(false)}
        onLoadSession={handleSessionStoreLoad}
        currentSessionId={sessionAutosave.currentSessionId}
        autoSaveEnabled={sessionAutosave.autoSaveEnabled}
        onToggleAutoSave={(enabled) => {
          apiRequest("PUT", "/api/preferences", { autoSaveSession: enabled });
        }}
      />
    </div>
  );
}
