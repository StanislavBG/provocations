import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { TextInputForm } from "@/components/TextInputForm";
import { ProvocationsDisplay } from "@/components/ProvocationsDisplay";
import { InterviewPanel } from "@/components/InterviewPanel";
import { ReadingPane } from "@/components/ReadingPane";
import { TranscriptOverlay } from "@/components/TranscriptOverlay";
import { ProvokeText } from "@/components/ProvokeText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy components
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
import {
  Sparkles,
  RotateCcw,
  MessageSquareWarning,
  MessageCircleQuestion,
  GitCompare,
  Target,
  X,
  Lightbulb,
  Save,
  FileText,
  Trash2,
} from "lucide-react";
import type {
  Document,
  Provocation,
  ProvocationType,
  DocumentVersion,
  WriteRequest,
  WriteResponse,
  ReferenceDocument,
  EditHistoryEntry,
  InterviewEntry,
  InterviewQuestionResponse,
  DocumentListItem,
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

  const [document, setDocument] = useState<Document>({ id: generateId("doc"), rawText: "" });
  const [objective, setObjective] = useState<string>("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [provocations, setProvocations] = useState<Provocation[]>([]);
  const [activeTab, setActiveTab] = useState("provocations");

  // Voice and version tracking
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [showDiffView, setShowDiffView] = useState(false);
  const [hoveredProvocationId, setHoveredProvocationId] = useState<string | null>(null);

  // Transcript overlay state
  const [showTranscriptOverlay, setShowTranscriptOverlay] = useState(false);
  const [rawTranscript, setRawTranscript] = useState("");
  const [cleanedTranscript, setCleanedTranscript] = useState<string | undefined>(undefined);
  const [transcriptSummary, setTranscriptSummary] = useState("");
  const [isRecordingFromMain, setIsRecordingFromMain] = useState(false);

  // Pending voice context for deferred sending (holds selectedText until user reviews transcript)
  const [pendingVoiceContext, setPendingVoiceContext] = useState<{
    selectedText?: string;
    provocation?: {
      id: string;
      type: string;
      title: string;
      content: string;
      sourceExcerpt: string;
    };
    outlineSection?: {
      id: string;
      heading: string;
    };
    context: "selection" | "provocation" | "document";
  } | null>(null);

  // Edit history for coherent iteration
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  // Suggestions from last write response
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);

  // Interview state
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [interviewEntries, setInterviewEntries] = useState<InterviewEntry[]>([]);
  const [currentInterviewQuestion, setCurrentInterviewQuestion] = useState<string | null>(null);
  const [currentInterviewTopic, setCurrentInterviewTopic] = useState<string | null>(null);

  // Server-backed save/restore
  const [savedDocuments, setSavedDocuments] = useState<DocumentListItem[]>([]);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Voice input for objective (no writer call, direct update)
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterimTranscript, setObjectiveInterimTranscript] = useState("");

  // Get the source excerpt of the currently hovered provocation
  const hoveredProvocationContext = hoveredProvocationId
    ? provocations.find(p => p.id === hoveredProvocationId)?.sourceExcerpt
    : undefined;

  // Fetch saved documents on mount
  const fetchSavedDocuments = useCallback(async () => {
    try {
      const response = await apiRequest("GET", "/api/documents");
      const data = await response.json() as { documents: DocumentListItem[] };
      setSavedDocuments(data.documents);
    } catch {
      // Silently fail - documents list just won't show
    }
  }, []);

  useEffect(() => {
    fetchSavedDocuments();
  }, [fetchSavedDocuments]);

  const writeMutation = useMutation({
    mutationFn: async (request: Omit<WriteRequest, "document" | "objective" | "referenceDocuments" | "editHistory"> & { description?: string }) => {
      if (!document) throw new Error("No document to write to");
      const response = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
        ...request,
      });
      return await response.json() as WriteResponse;
    },
    onSuccess: (data, variables) => {
      if (document) {
        // Save current version before updating
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: variables.description || data.summary || "Document updated"
        };
        setVersions(prev => [...prev, newVersion]);
        setDocument({ ...document, rawText: data.document });

        // Track this edit in history for coherent iteration
        const historyEntry: EditHistoryEntry = {
          instruction: variables.instruction,
          instructionType: data.instructionType || "general",
          summary: data.summary || "Document updated",
          timestamp: Date.now(),
        };
        setEditHistory(prev => [...prev.slice(-9), historyEntry]); // Keep last 10

        // Store suggestions for potential display
        if (data.suggestions && data.suggestions.length > 0) {
          setLastSuggestions(data.suggestions);
        } else {
          setLastSuggestions([]);
        }

        // Build detailed transcript summary with changes
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
          title: "Document Updated",
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

  const regenerateProvocationsMutation = useMutation({
    mutationFn: async ({ guidance, types }: { guidance?: string; types?: string[] }) => {
      if (!document) throw new Error("No document");
      const response = await apiRequest("POST", "/api/generate-provocations", {
        text: document.rawText,
        guidance,
        objective: objective || undefined,
        types: types && types.length > 0 ? types : undefined,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
      });
      return await response.json() as { provocations: Provocation[] };
    },
    onSuccess: (data) => {
      const newProvocations = data.provocations ?? [];
      setProvocations(prev => [...prev, ...newProvocations]);
      toast({
        title: "New Provocations Generated",
        description: `Added ${newProvocations.length} new provocations.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const interviewQuestionMutation = useMutation({
    mutationFn: async ({ overrideEntries }: { overrideEntries?: InterviewEntry[] } = {}) => {
      if (!document) throw new Error("No document");
      const templateDoc = referenceDocuments.find(d => d.type === "template");
      const entries = overrideEntries ?? interviewEntries;
      const response = await apiRequest("POST", "/api/interview/question", {
        objective,
        document: document.rawText,
        template: templateDoc?.content,
        previousEntries: entries.length > 0 ? entries : undefined,
        provocations: provocations.length > 0 ? provocations : undefined,
      });
      return await response.json() as InterviewQuestionResponse;
    },
    onSuccess: (data) => {
      setCurrentInterviewQuestion(data.question);
      setCurrentInterviewTopic(data.topic);
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
      // Step 1: Get summarized instruction from interview entries
      const summaryResponse = await apiRequest("POST", "/api/interview/summary", {
        objective,
        entries: interviewEntries,
        document: document.rawText,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      // Step 2: Use the writer to merge into document
      const writeResponse = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        instruction,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        editHistory: editHistory.length > 0 ? editHistory : undefined,
      });
      return await writeResponse.json() as WriteResponse;
    },
    onSuccess: (data) => {
      if (document) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.document,
          timestamp: Date.now(),
          description: `Interview merge (${interviewEntries.length} answers)`,
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
          title: "Interview Merged",
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

  const handleUpdateProvocationStatus = useCallback((id: string, status: Provocation["status"]) => {
    setProvocations((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  }, []);

  const handleRegenerateProvocations = useCallback((guidance?: string, types?: string[]) => {
    regenerateProvocationsMutation.mutate({ guidance, types });
  }, [regenerateProvocationsMutation]);

  const handleStartInterview = useCallback(() => {
    setIsInterviewActive(true);
    setActiveTab("interview");
    interviewQuestionMutation.mutate({});
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

    // Fetch next question, passing updated entries directly
    interviewQuestionMutation.mutate({ overrideEntries: updatedEntries });
  }, [currentInterviewQuestion, currentInterviewTopic, interviewEntries, interviewQuestionMutation]);

  const handleEndInterview = useCallback(() => {
    interviewSummaryMutation.mutate();
  }, [interviewSummaryMutation]);

  const handleReset = useCallback(() => {
    setDocument({ id: generateId("doc"), rawText: "" });
    setObjective("");
    setReferenceDocuments([]);
    setProvocations([]);
    setVersions([]);
    setShowDiffView(false);
    setEditHistory([]);
    setLastSuggestions([]);
    setIsInterviewActive(false);
    setInterviewEntries([]);
    setCurrentInterviewQuestion(null);
    setCurrentInterviewTopic(null);
    setCurrentDocId(null);
  }, []);

  const handleDocumentTextChange = useCallback((newText: string) => {
    if (document) {
      setDocument({ ...document, rawText: newText });
    }
  }, [document]);

  // Handle text edit from pencil icon prompt
  const handleTextEdit = useCallback((newText: string) => {
    if (document) {
      // Create a new version for the edit
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

  const handleVoiceResponse = useCallback((provocationId: string, transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => {
    if (!document || !transcript.trim()) return;

    // Store the context for deferred sending - user will review and click "Send to writer"
    setPendingVoiceContext({
      provocation: {
        id: provocationId,
        type: provocationData.type,
        title: provocationData.title,
        content: provocationData.content,
        sourceExcerpt: provocationData.sourceExcerpt,
      },
      context: "provocation",
    });

    // Show the transcript overlay for review
    setRawTranscript(transcript);
    setShowTranscriptOverlay(true);
    setTranscriptSummary("");
    setCleanedTranscript(undefined);
    setIsRecordingFromMain(false);
    // Don't auto-send anymore - user will click "Send to writer" after reviewing
  }, [document]);

  // Open transcript overlay for provocation response (user will record from overlay)
  const handleStartProvocationResponse = useCallback((provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => {
    if (!document) return;

    setPendingVoiceContext({
      provocation: {
        id: provocationId,
        type: provocationData.type,
        title: provocationData.title,
        content: provocationData.content,
        sourceExcerpt: provocationData.sourceExcerpt,
      },
      context: "provocation",
    });

    // Open overlay without transcript - user will start recording from the embedded VoiceRecorder
    setRawTranscript("");
    setShowTranscriptOverlay(true);
    setTranscriptSummary("");
    setCleanedTranscript(undefined);
    setIsRecordingFromMain(false);
  }, [document]);

  // Add provocation insight directly to document (user agrees with the provocation)
  const handleAddToDocument = useCallback((provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => {
    if (!document) return;

    writeMutation.mutate({
      instruction: `The user agrees with this provocation and wants it reflected in the document. Incorporate the insight naturally:\n\nProvocation: ${provocationData.title}\nDetails: ${provocationData.content}\nRelevant excerpt: "${provocationData.sourceExcerpt}"`,
      provocation: {
        type: provocationData.type as ProvocationType,
        title: provocationData.title,
        content: provocationData.content,
        sourceExcerpt: provocationData.sourceExcerpt,
      },
      description: `Added to document: ${provocationData.title}`,
    });

    // Mark the provocation as addressed
    setProvocations((prev) =>
      prev.map((p) => (p.id === provocationId ? { ...p, status: "addressed" as const } : p))
    );
  }, [document, writeMutation]);

  // Send provocation content directly to the document as a note for the author
  const handleSendToAuthor = useCallback((provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => {
    if (!document) return;

    const typeLabel = provocationData.type.charAt(0).toUpperCase() + provocationData.type.slice(1).replace(/_/g, " ");
    const note = `\n\n---\n[${typeLabel}] ${provocationData.title}\n${provocationData.content}\n---`;
    const newText = document.rawText + note;

    const newVersion: DocumentVersion = {
      id: generateId("v"),
      text: newText,
      timestamp: Date.now(),
      description: `Sent to author: ${provocationData.title}`,
    };
    setVersions(prev => [...prev, newVersion]);
    setDocument({ ...document, rawText: newText });

    // Mark the provocation as addressed
    setProvocations((prev) =>
      prev.map((p) => (p.id === provocationId ? { ...p, status: "addressed" as const } : p))
    );

    toast({
      title: "Sent to Author",
      description: `"${provocationData.title}" has been added as a note in the document.`,
    });
  }, [document, toast]);

  const toggleDiffView = useCallback(() => {
    setShowDiffView(prev => !prev);
  }, []);

  // Handle voice merge from text selection in ReadingPane
  // Now stores context and lets user review transcript before sending
  const handleSelectionVoiceMerge = useCallback((selectedText: string, transcript: string) => {
    if (!document || !transcript.trim()) return;

    // Store the context for deferred sending - user will review and click "Send to writer"
    setPendingVoiceContext({
      selectedText,
      context: "selection",
    });
    // Transcript is already set via handleTranscriptUpdate
    // Don't auto-send anymore - user will click "Send to writer" after reviewing
  }, [document]);

  const handleTranscriptUpdate = useCallback((transcript: string, isRecording: boolean) => {
    // Only update rawTranscript if there's content or recording is starting (clear for fresh start)
    // When isRecording=false and transcript is empty, preserve the existing transcript
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

  // Handle explicit send from TranscriptOverlay
  const handleSendTranscript = useCallback((transcript: string) => {
    if (!document || !transcript.trim()) return;

    // Use the pending context if available
    const context = pendingVoiceContext;

    if (context?.provocation) {
      // Sending as provocation response
      writeMutation.mutate({
        instruction: transcript,
        provocation: {
          type: context.provocation.type as ProvocationType,
          title: context.provocation.title,
          content: context.provocation.content,
          sourceExcerpt: context.provocation.sourceExcerpt,
        },
        description: `Addressed provocation: ${context.provocation.title}`,
      });

      // Mark the provocation as addressed
      setProvocations((prev) =>
        prev.map((p) => (p.id === context.provocation!.id ? { ...p, status: "addressed" as const } : p))
      );
    } else if (context?.selectedText) {
      // Sending as selection edit
      writeMutation.mutate({
        instruction: transcript,
        selectedText: context.selectedText,
        description: "Voice edit on selection",
      });
    } else {
      // Sending as general document instruction
      writeMutation.mutate({
        instruction: transcript,
        description: "Voice instruction",
      });
    }
  }, [document, pendingVoiceContext, writeMutation]);

  // Handle cleaned transcript from TranscriptOverlay
  const handleCleanTranscript = useCallback((cleaned: string) => {
    setCleanedTranscript(cleaned);
  }, []);

  // Handle final transcript from the embedded VoiceRecorder in TranscriptOverlay
  const handleOverlayFinalTranscript = useCallback((transcript: string) => {
    if (transcript.trim()) {
      setRawTranscript(transcript);
      setIsRecordingFromMain(false);
    }
  }, []);

  // Load a saved document from the server
  const handleLoadSavedDocument = useCallback(async (docId: number) => {
    try {
      const response = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await response.json() as { id: number; title: string; content: string; createdAt: string; updatedAt: string };

      let loadedObjective = data.title;
      let loadedText = data.content;

      // Try parsing content as JSON (objective + documentText)
      try {
        const parsed = JSON.parse(data.content) as { objective?: string; documentText?: string };
        if (parsed.documentText) {
          loadedText = parsed.documentText;
          loadedObjective = parsed.objective || data.title;
        }
      } catch {
        // Content is plain text, use as-is
      }

      setObjective(loadedObjective);
      setCurrentDocId(docId);

      const tempDoc: Document = { id: `loaded-${Date.now()}`, rawText: loadedText };
      setDocument(tempDoc);

      // Clear stale state from any previous document
      setProvocations([]);
      setEditHistory([]);
      setLastSuggestions([]);
      setShowDiffView(false);

      // Create initial version
      const initialVersion: DocumentVersion = {
        id: generateId("v"),
        text: loadedText,
        timestamp: Date.now(),
        description: "Loaded document",
      };
      setVersions([initialVersion]);

      toast({
        title: "Document Loaded",
        description: `"${loadedObjective}" loaded.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const isDecryptionError = message.includes("422");
      toast({
        title: isDecryptionError ? "Cannot Open Document" : "Load Failed",
        description: isDecryptionError
          ? "This document was saved with an older encryption method and cannot be opened."
          : "Could not load document. Try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Delete a saved document
  const handleDeleteSavedDocument = useCallback(async (docId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/documents/${docId}`);
      setSavedDocuments(prev => prev.filter(d => d.id !== docId));
      if (currentDocId === docId) {
        setCurrentDocId(null);
      }
      toast({ title: "Document Deleted" });
    } catch {
      toast({
        title: "Delete Failed",
        description: "Could not delete document.",
        variant: "destructive",
      });
    }
  }, [currentDocId, toast]);

  // Save document to server (server handles encryption)
  const handleSaveClick = useCallback(async () => {
    if (!document.rawText) return;

    setIsSaving(true);
    try {
      const title = objective || "Untitled Document";
      const content = JSON.stringify({ objective, documentText: document.rawText });

      if (currentDocId) {
        // Update existing document
        await apiRequest("PUT", `/api/documents/${currentDocId}`, { title, content });
        toast({
          title: "Saved",
          description: `"${title}" updated.`,
        });
      } else {
        // Create new document
        const response = await apiRequest("POST", "/api/documents", { title, content });
        const data = await response.json() as { id: number; createdAt: string };
        setCurrentDocId(data.id);
        toast({
          title: "Saved",
          description: `"${title}" saved.`,
        });
      }
      fetchSavedDocuments();
    } catch {
      toast({
        title: "Save Failed",
        description: "Could not save. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [document, objective, currentDocId, toast, fetchSavedDocuments]);

  const canShowDiff = versions.length >= 2;
  const previousVersion = versions.length >= 2 ? versions[versions.length - 2] : null;
  const currentVersion = versions.length >= 1 ? versions[versions.length - 1] : null;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Show the input form when there's no document content and no analysis in progress
  const isInputPhase = !document.rawText;

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
              <ThemeToggle />
              <UserButton data-testid="button-user-menu" />
            </div>
          </div>
        </header>
        {savedDocuments.length > 0 && (
          <div className="border-b px-4 py-3 bg-muted/20">
            <p className="text-sm font-medium text-muted-foreground mb-2">Your Documents</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {savedDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card hover:bg-accent/50 cursor-pointer transition-colors shrink-0 group"
                  onClick={() => handleLoadSavedDocument(doc.id)}
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate max-w-[200px]">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(doc.updatedAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={(e) => handleDeleteSavedDocument(doc.id, e)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <TextInputForm
            onSubmit={(text, obj, refs) => {
              setDocument({ id: generateId("doc"), rawText: text });
              setObjective(obj);
              setReferenceDocuments(refs);
              // Create initial version — provocations are generated on-demand via the Provocations tab
              const initialVersion: DocumentVersion = {
                id: generateId("v"),
                text,
                timestamp: Date.now(),
                description: "Original document",
              };
              setVersions([initialVersion]);
            }}
            onBlankDocument={(obj) => {
              setDocument({ id: generateId("doc"), rawText: " " });
              setObjective(obj);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between gap-4 px-4 py-2 flex-wrap">
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
                Versions ({versions.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveClick}
              className="gap-1.5"
              disabled={!document.rawText || isSaving}
              title={currentDocId ? "Save changes" : "Save your document"}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              data-testid="button-reset"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              New
            </Button>
            <ThemeToggle />
            <UserButton data-testid="button-user-menu-main" />
          </div>
        </div>

        {/* Objective bar */}
        <div className="border-t px-4 py-3">
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
          />
        </div>
      </header>

      {writeMutation.isPending && (
        <div className="bg-primary/10 border-b px-4 py-2 flex items-center gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Integrating your feedback into the document...</span>
        </div>
      )}

      {/* Suggestions bar - shows after a write when AI has suggestions */}
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

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={55} minSize={35}>
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
                highlightText={hoveredProvocationContext}
                onVoiceMerge={handleSelectionVoiceMerge}
                isMerging={writeMutation.isPending}
                onTranscriptUpdate={handleTranscriptUpdate}
                onTextEdit={handleTextEdit}
              />
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={25}>
            <div className="h-full flex flex-col relative">
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
                provocationContext={pendingVoiceContext?.provocation ? {
                  type: pendingVoiceContext.provocation.type,
                  title: pendingVoiceContext.provocation.title,
                  content: pendingVoiceContext.provocation.content,
                } : undefined}
                context={pendingVoiceContext?.context || "document"}
              />
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b px-4 h-auto py-0 bg-transparent">
                  <TabsTrigger
                    value="interview"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
                    data-testid="tab-interview"
                  >
                    <MessageCircleQuestion className="w-4 h-4" />
                    Provoke
                    {isInterviewActive && (
                      <span className="ml-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="provocations"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
                    data-testid="tab-provocations"
                  >
                    <MessageSquareWarning className="w-4 h-4" />
                    Provocations
                    {(provocations ?? []).filter((p) => p.status === "pending").length > 0 && (
                      <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                        {(provocations ?? []).filter((p) => p.status === "pending").length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="interview" className="flex-1 mt-0 overflow-hidden">
                  <InterviewPanel
                    isActive={isInterviewActive}
                    entries={interviewEntries}
                    currentQuestion={currentInterviewQuestion}
                    currentTopic={currentInterviewTopic}
                    isLoadingQuestion={interviewQuestionMutation.isPending}
                    isMerging={interviewSummaryMutation.isPending}
                    onStart={handleStartInterview}
                    onAnswer={handleInterviewAnswer}
                    onEnd={handleEndInterview}
                  />
                </TabsContent>

                <TabsContent value="provocations" className="flex-1 mt-0 overflow-hidden">
                  <ProvocationsDisplay
                    provocations={provocations}
                    onUpdateStatus={handleUpdateProvocationStatus}
                    onVoiceResponse={handleVoiceResponse}
                    onStartResponse={handleStartProvocationResponse}
                    onAddToDocument={handleAddToDocument}
                    onSendToAuthor={handleSendToAuthor}
                    onTranscriptUpdate={handleTranscriptUpdate}
                    onHoverProvocation={setHoveredProvocationId}
                    onRegenerateProvocations={handleRegenerateProvocations}
                    isMerging={writeMutation.isPending}
                    isRegenerating={regenerateProvocationsMutation.isPending}
                  />
                </TabsContent>

              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
