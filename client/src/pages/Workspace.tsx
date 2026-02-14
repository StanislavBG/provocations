import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { TextInputForm } from "@/components/TextInputForm";
import { InterviewPanel } from "@/components/InterviewPanel";
import { StreamingDialogue } from "@/components/StreamingDialogue";
import { LogStatsPanel } from "@/components/LogStatsPanel";
import { ReadingPane } from "@/components/ReadingPane";
import { TranscriptOverlay } from "@/components/TranscriptOverlay";
import { ProvocationToolbox, type ToolboxApp } from "@/components/ProvocationToolbox";
import { ProvokeText } from "@/components/ProvokeText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Drawler } from "@/components/Drawler";
import { UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy components
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
import { ScreenCaptureButton, type CaptureRegion } from "@/components/ScreenCaptureButton";
import {
  Sparkles,
  RotateCcw,
  MessageCircleQuestion,
  GitCompare,
  Target,
  Crosshair,
  X,
  Lightbulb,
  Save,
  ChevronDown,
  ChevronUp,
  ArrowRightToLine,
  Loader2,
  Share2,
  Copy,
} from "lucide-react";
import type {
  Document,
  ProvocationType,
  DirectionMode,
  ThinkBigVector,
  DocumentVersion,
  WriteRequest,
  WriteResponse,
  ReferenceDocument,
  EditHistoryEntry,
  InterviewEntry,
  InterviewQuestionResponse,
  DocumentListItem,
  StreamingDialogueEntry,
  StreamingRequirement,
  StreamingQuestionResponse,
  WireframeAnalysisResponse,
  StreamingRefineResponse,
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

  const [document, setDocument] = useState<Document>({ id: generateId("doc"), rawText: "" });
  const [objective, setObjective] = useState<string>("");
  const [secondaryObjective, setSecondaryObjectiveRaw] = useState<string>("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);

  // Guard: prevent secondary objective from duplicating the primary (REQ-002)
  const setSecondaryObjective = useCallback((value: string) => {
    if (value.trim() && value.trim().toLowerCase() === objective.trim().toLowerCase()) {
      return; // silently reject duplicates
    }
    setSecondaryObjectiveRaw(value);
  }, [objective]);

  // Toolbox app state — controls which app is active in the left panel
  const [activeToolboxApp, setActiveToolboxApp] = useState<ToolboxApp>("provoke");

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
    mode: DirectionMode;
    personas: ProvocationType[];
    guidance?: string;
    thinkBigVectors?: ThinkBigVector[];
  } | null>(null);

  // ── Streaming (Website) state ──
  const [streamingDialogueEntries, setStreamingDialogueEntries] = useState<StreamingDialogueEntry[]>([]);
  const [streamingRequirements, setStreamingRequirements] = useState<StreamingRequirement[]>([]);
  const [streamingCurrentQuestion, setStreamingCurrentQuestion] = useState<string | null>(null);
  const [streamingCurrentTopic, setStreamingCurrentTopic] = useState<string | null>(null);
  const [isStreamingDialogueActive, setIsStreamingDialogueActive] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [wireframeNotes, setWireframeNotes] = useState("");
  const [wireframeAnalysis, setWireframeAnalysis] = useState<WireframeAnalysisResponse | null>(null);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const lastAnalyzedUrl = useRef<string>("");

  // Server-backed save/restore
  const [savedDocuments, setSavedDocuments] = useState<DocumentListItem[]>([]);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Voice input for objective (no writer call, direct update)
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterimTranscript, setObjectiveInterimTranscript] = useState("");

  // Objective panel collapsed state (minimized by default)
  const [isObjectiveCollapsed, setIsObjectiveCollapsed] = useState(true);

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

  // ── Writer mutation ──

  const writeMutation = useMutation({
    mutationFn: async (request: Omit<WriteRequest, "document" | "objective" | "referenceDocuments" | "editHistory"> & { description?: string }) => {
      if (!document) throw new Error("No document to write to");
      const response = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
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

  // ── Interview mutations ──

  const interviewQuestionMutation = useMutation({
    mutationFn: async ({ overrideEntries, direction }: { overrideEntries?: InterviewEntry[]; direction?: { mode: DirectionMode; personas: ProvocationType[]; guidance?: string; thinkBigVectors?: ThinkBigVector[] } } = {}) => {
      if (!document) throw new Error("No document");
      const templateDoc = referenceDocuments.find(d => d.type === "template");
      const entries = overrideEntries ?? interviewEntries;
      const dir = direction ?? interviewDirection;
      const response = await apiRequest("POST", "/api/interview/question", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        document: document.rawText,
        template: templateDoc?.content,
        previousEntries: entries.length > 0 ? entries : undefined,
        // Pass direction params for persona + challenge/advise context
        directionMode: dir?.mode,
        directionPersonas: dir?.personas && dir.personas.length > 0
          ? dir.personas : undefined,
        directionGuidance: dir?.guidance,
        thinkBigVectors: dir?.thinkBigVectors && dir.thinkBigVectors.length > 0
          ? dir.thinkBigVectors : undefined,
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
        secondaryObjective: secondaryObjective.trim() || undefined,
        entries: interviewEntries,
        document: document.rawText,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      // Step 2: Use the writer to merge into document
      const writeResponse = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
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

  // Incremental merge — push interview answers into document without ending the session
  const interviewMergeMutation = useMutation({
    mutationFn: async () => {
      if (!document || interviewEntries.length === 0) throw new Error("No entries to merge");
      const summaryResponse = await apiRequest("POST", "/api/interview/summary", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        entries: interviewEntries,
        document: document.rawText,
      });
      const { instruction } = await summaryResponse.json() as { instruction: string };

      const writeResponse = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
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
          description: `Incremental merge (${interviewEntries.length} answers)`,
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
          title: "Merged to Draft",
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

  // ── Streaming mutations ──

  const streamingQuestionMutation = useMutation({
    mutationFn: async (overrideEntries?: StreamingDialogueEntry[]) => {
      const entries = overrideEntries ?? streamingDialogueEntries;
      // Enrich wireframe notes with full analysis context
      const analysisParts: string[] = [];
      if (wireframeNotes) analysisParts.push(wireframeNotes);
      if (wireframeAnalysis) {
        if (wireframeAnalysis.analysis) {
          analysisParts.push(`[SITE ANALYSIS]: ${wireframeAnalysis.analysis}`);
        }
        if (wireframeAnalysis.components.length > 0) {
          analysisParts.push(`[COMPONENTS]: ${wireframeAnalysis.components.join(", ")}`);
        }
        if (wireframeAnalysis.suggestions.length > 0) {
          analysisParts.push(`[SUGGESTIONS]: ${wireframeAnalysis.suggestions.join("; ")}`);
        }
        if (wireframeAnalysis.primaryContent) {
          analysisParts.push(`[PRIMARY CONTENT]: ${wireframeAnalysis.primaryContent}`);
        }
        if (wireframeAnalysis.siteMap && wireframeAnalysis.siteMap.length > 0) {
          const siteMapStr = wireframeAnalysis.siteMap.map(p => `${"  ".repeat(p.depth)}${p.title}${p.url ? ` (${p.url})` : ""}`).join("\n");
          analysisParts.push(`[SITE MAP]:\n${siteMapStr}`);
        }
        if (wireframeAnalysis.videos && wireframeAnalysis.videos.length > 0) {
          analysisParts.push(`[VIDEOS]: ${wireframeAnalysis.videos.map(v => v.title).join(", ")}`);
        }
        if (wireframeAnalysis.audioContent && wireframeAnalysis.audioContent.length > 0) {
          analysisParts.push(`[AUDIO]: ${wireframeAnalysis.audioContent.map(a => a.title).join(", ")}`);
        }
        if (wireframeAnalysis.rssFeeds && wireframeAnalysis.rssFeeds.length > 0) {
          analysisParts.push(`[RSS FEEDS]: ${wireframeAnalysis.rssFeeds.map(f => f.title).join(", ")}`);
        }
        if (wireframeAnalysis.images && wireframeAnalysis.images.length > 0) {
          analysisParts.push(`[IMAGES]: ${wireframeAnalysis.images.map(img => `${img.title} (${img.type || "image"})`).join(", ")}`);
        }
      }
      const enrichedNotes = analysisParts.length > 0 ? analysisParts.join("\n") : undefined;

      const response = await apiRequest("POST", "/api/streaming/question", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        document: document.rawText || undefined,
        websiteUrl: websiteUrl || undefined,
        wireframeNotes: enrichedNotes,
        previousEntries: entries.length > 0 ? entries : undefined,
        requirements: streamingRequirements.length > 0 ? streamingRequirements : undefined,
      });
      return await response.json() as StreamingQuestionResponse;
    },
    onSuccess: (data) => {
      const agentEntry: StreamingDialogueEntry = {
        id: generateId("se"),
        role: "agent",
        content: data.question,
        timestamp: Date.now(),
      };
      setStreamingDialogueEntries(prev => [...prev, agentEntry]);
      setStreamingCurrentQuestion(data.question);
      setStreamingCurrentTopic(data.topic);

      if (data.suggestedRequirement) {
        const newReq: StreamingRequirement = {
          id: generateId("req"),
          text: data.suggestedRequirement,
          status: "draft",
          timestamp: Date.now(),
        };
        setStreamingRequirements(prev => [...prev, newReq]);
      }
    },
    onError: (error) => {
      toast({
        title: "Question Error",
        description: error instanceof Error ? error.message : "Failed to generate question",
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
      setIsStreamingDialogueActive(true);
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze website",
        variant: "destructive",
      });
    },
  });

  const streamingRefineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streaming/refine", {
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        dialogueEntries: streamingDialogueEntries,
        existingRequirements: streamingRequirements.length > 0 ? streamingRequirements : undefined,
        document: document.rawText || undefined,
        websiteUrl: websiteUrl || undefined,
        wireframeAnalysis: wireframeAnalysis || undefined,
      });
      return await response.json() as StreamingRefineResponse;
    },
    onSuccess: (data) => {
      if (data.requirements.length > 0) {
        setStreamingRequirements(data.requirements);
      }

      if (data.updatedDocument) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.updatedDocument,
          timestamp: Date.now(),
          description: `Requirements refined: ${data.summary}`,
        };
        setVersions(prev => [...prev, newVersion]);
        setDocument({ ...document, rawText: data.updatedDocument });

        const historyEntry: EditHistoryEntry = {
          instruction: "Refine requirements from streaming dialogue",
          instructionType: "restructure",
          summary: data.summary,
          timestamp: Date.now(),
        };
        setEditHistory(prev => [...prev.slice(-9), historyEntry]);
      }

      toast({
        title: "Requirements Refined",
        description: data.summary,
      });
    },
    onError: (error) => {
      toast({
        title: "Refinement Failed",
        description: error instanceof Error ? error.message : "Failed to refine",
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

  // ── Interview handlers ──

  const handleStartInterview = useCallback((direction: { mode: DirectionMode; personas: ProvocationType[]; guidance?: string; thinkBigVectors?: ThinkBigVector[] }) => {
    setInterviewDirection(direction);
    setIsInterviewActive(true);
    interviewQuestionMutation.mutate({ direction });
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
    if (activeToolboxApp === "provoke") {
      if (interviewEntries.length > 0 && !interviewMergeMutation.isPending) {
        interviewMergeMutation.mutate();
      }
    } else {
      if (streamingDialogueEntries.length > 0 && !streamingRefineMutation.isPending) {
        streamingRefineMutation.mutate();
      }
    }
  }, [activeToolboxApp, interviewEntries.length, interviewMergeMutation, streamingDialogueEntries.length, streamingRefineMutation]);

  // ── Streaming handlers ──

  const handleStreamingStartDialogue = useCallback(() => {
    setIsStreamingDialogueActive(true);
  }, []);

  const handleStreamingAnswer = useCallback((answer: string) => {
    const userEntry: StreamingDialogueEntry = {
      id: generateId("se"),
      role: "user",
      content: answer,
      timestamp: Date.now(),
    };
    const updatedEntries = [...streamingDialogueEntries, userEntry];
    setStreamingDialogueEntries(updatedEntries);
    setStreamingCurrentQuestion(null);
    setStreamingCurrentTopic(null);

    streamingQuestionMutation.mutate(updatedEntries);
  }, [streamingDialogueEntries, streamingQuestionMutation]);

  const handleStreamingUpdateRequirement = useCallback((id: string, text: string) => {
    setStreamingRequirements(prev =>
      prev.map(r => r.id === id ? { ...r, text, status: "revised" as const } : r)
    );
  }, []);

  const handleStreamingConfirmRequirement = useCallback((id: string) => {
    setStreamingRequirements(prev =>
      prev.map(r => r.id === id ? { ...r, status: "confirmed" as const } : r)
    );
  }, []);

  const handleBrowserUrlChange = useCallback((url: string) => {
    setWebsiteUrl(url);
  }, []);

  // ── Common handlers ──

  const handleReset = useCallback(() => {
    setDocument({ id: generateId("doc"), rawText: "" });
    setObjective("");
    setReferenceDocuments([]);
    setVersions([]);
    setShowDiffView(false);
    setEditHistory([]);
    setLastSuggestions([]);
    // Reset interview state
    setIsInterviewActive(false);
    setInterviewEntries([]);
    setCurrentInterviewQuestion(null);
    setCurrentInterviewTopic(null);
    setInterviewDirection(null);
    // Reset streaming state
    setStreamingDialogueEntries([]);
    setStreamingRequirements([]);
    setStreamingCurrentQuestion(null);
    setStreamingCurrentTopic(null);
    setIsStreamingDialogueActive(false);
    setWebsiteUrl("");
    setWireframeNotes("");
    setWireframeAnalysis(null);
    setShowLogPanel(false);
    lastAnalyzedUrl.current = "";
    // Reset toolbox
    setActiveToolboxApp("provoke");
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

  // Handle screen capture
  const handleScreenCapture = useCallback((imageDataUrl: string, regions: CaptureRegion[]) => {
    if (!document) return;

    const timestamp = new Date().toLocaleString();

    const narrationLines = regions.map(r =>
      `**Region ${r.number}**: ${r.narration || "(no narration)"}`
    );

    const markdownSnippet = [
      "",
      `---`,
      "",
      `### Annotated Screenshot (${timestamp})`,
      "",
      `![Annotated screenshot with ${regions.length} marked region${regions.length !== 1 ? "s" : ""}](${imageDataUrl})`,
      "",
      ...narrationLines,
      "",
      `---`,
      "",
    ].join("\n");

    writeMutation.mutate({
      instruction: `Integrate the following annotated screenshot into the document. The screenshot has ${regions.length} numbered regions with narration. Place it at the most appropriate location near related content, or append as a new section.\n\nScreenshot markdown:\n${markdownSnippet}`,
      description: "Annotated screen capture merged",
    });
  }, [document, writeMutation]);

  const handleCaptureClose = useCallback((keyword: string) => {
    toast({
      title: keyword,
      description: "Capture dismissed without saving.",
    });
  }, [toast]);

  const toggleDiffView = useCallback(() => {
    setShowDiffView(prev => !prev);
  }, []);

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

  // Load a saved document from the server
  const handleLoadSavedDocument = useCallback(async (docId: number) => {
    try {
      const response = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await response.json() as { id: number; title: string; content: string; createdAt: string; updatedAt: string };

      let loadedObjective = data.title;
      let loadedText = data.content;

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

      setEditHistory([]);
      setLastSuggestions([]);
      setShowDiffView(false);

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

  // Save document to server
  const handleSaveClick = useCallback(async () => {
    if (!document.rawText) return;

    setIsSaving(true);
    try {
      const title = objective || "Untitled Document";
      const content = JSON.stringify({ objective, secondaryObjective: secondaryObjective.trim() || undefined, documentText: document.rawText });

      if (currentDocId) {
        await apiRequest("PUT", `/api/documents/${currentDocId}`, { title, content });
        toast({
          title: "Saved",
          description: `"${title}" updated.`,
        });
      } else {
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

  // Show the input form when there's no document content
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
              <Drawler
                documents={savedDocuments}
                currentDocId={currentDocId}
                onLoad={handleLoadSavedDocument}
                onDocumentsChange={setSavedDocuments}
                onCurrentDocIdChange={setCurrentDocId}
              />
              <ThemeToggle />
              <UserButton data-testid="button-user-menu" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <TextInputForm
            onSubmit={(text, obj, refs) => {
              setDocument({ id: generateId("doc"), rawText: text });
              setObjective(obj);
              setReferenceDocuments(refs);
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
            onStreamingMode={(obj) => {
              setDocument({ id: generateId("doc"), rawText: " " });
              setObjective(obj);
              setActiveToolboxApp("website");
              const initialVersion: DocumentVersion = {
                id: generateId("v"),
                text: " ",
                timestamp: Date.now(),
                description: "Streaming workspace initialized",
              };
              setVersions([initialVersion]);
            }}
          />
        </div>
      </div>
    );
  }

  // ── Panel contents (shared between mobile and desktop layouts) ──

  const toolboxPanel = (
    <ProvocationToolbox
      activeApp={activeToolboxApp}
      onAppChange={setActiveToolboxApp}
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
      browserHeaderActions={
        <ScreenCaptureButton
          onCapture={handleScreenCapture}
          onClose={handleCaptureClose}
          disabled={!document.rawText || writeMutation.isPending}
        />
      }
    />
  );

  const discussionPanel = (
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
        context={pendingVoiceContext?.context || "document"}
      />

      {/* Panel Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
        <MessageCircleQuestion className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Discussion</h3>
        {(isInterviewActive || isStreamingDialogueActive) && (
          <span className="ml-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
        <div className="flex-1" />
        {((activeToolboxApp === "provoke" && interviewEntries.length > 0) ||
          (activeToolboxApp === "website" && streamingDialogueEntries.length > 0)) && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={handleMergeToDraft}
            disabled={interviewMergeMutation.isPending || streamingRefineMutation.isPending}
          >
            {interviewMergeMutation.isPending || streamingRefineMutation.isPending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <ArrowRightToLine className="w-3 h-3" />
                Merge to Draft
              </>
            )}
          </Button>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activeToolboxApp === "provoke" ? (
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
          />
        ) : (
          <StreamingDialogue
            entries={streamingDialogueEntries}
            requirements={streamingRequirements}
            currentQuestion={streamingCurrentQuestion}
            currentTopic={streamingCurrentTopic}
            isLoadingQuestion={streamingQuestionMutation.isPending}
            isRefining={streamingRefineMutation.isPending}
            onAnswer={handleStreamingAnswer}
            onStart={handleStreamingStartDialogue}
            onRefineRequirements={() => streamingRefineMutation.mutate()}
            onUpdateRequirement={handleStreamingUpdateRequirement}
            onConfirmRequirement={handleStreamingConfirmRequirement}
            isActive={isStreamingDialogueActive}
            hasAnalysis={wireframeAnalysis !== null}
            objective={objective}
            documentText={document.rawText}
          />
        )}
      </div>
    </div>
  );

  const documentPanel = (
    <div className="h-full flex flex-col relative">
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
              variant="outline"
              size="sm"
              onClick={handleSaveClick}
              className="gap-1.5"
              disabled={!document.rawText || isSaving}
              title={currentDocId ? "Save changes" : "Save your document"}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
            </Button>
            <Drawler
              documents={savedDocuments}
              currentDocId={currentDocId}
              onLoad={handleLoadSavedDocument}
              onDocumentsChange={setSavedDocuments}
              onCurrentDocIdChange={setCurrentDocId}
            />
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
            <ThemeToggle />
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

      {/* ── Panel Layout (responsive: stacked on mobile, side-by-side on desktop) ── */}
      {isMobile ? (
        <div className="flex-1 overflow-y-auto">
          <section className="h-[60vh] min-h-[350px] border-b">
            {toolboxPanel}
          </section>
          <section className="h-[70vh] min-h-[400px] border-b">
            {discussionPanel}
          </section>
          <section className="h-[80vh] min-h-[450px]">
            {documentPanel}
          </section>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={25} minSize={15} collapsible collapsedSize={0}>
              {toolboxPanel}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              {discussionPanel}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={20}>
              {documentPanel}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}
