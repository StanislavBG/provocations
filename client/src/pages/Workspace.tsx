import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { TextInputForm } from "@/components/TextInputForm";
import { InterviewPanel } from "@/components/InterviewPanel";
import { LogStatsPanel } from "@/components/LogStatsPanel";
import { ReadingPane } from "@/components/ReadingPane";
import { TranscriptOverlay } from "@/components/TranscriptOverlay";
import { ProvocationToolbox, type ToolboxApp } from "@/components/ProvocationToolbox";
import { WorkflowSidebar } from "@/components/WorkflowSidebar";
import { WorkflowProgressTracker } from "@/components/WorkflowProgressTracker";
import { StepDetailsPanel } from "@/components/StepDetailsPanel";
import { ProvokeText } from "@/components/ProvokeText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AutoDictateToggle } from "@/components/AutoDictateToggle";
import { UserButton, useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Lazy load heavy components
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
import { ScreenCaptureButton, type CaptureAnnotation } from "@/components/ScreenCaptureButton";
import type { Workflow } from "@/lib/workflows";
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
  PanelRight,
} from "lucide-react";
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

export default function Workspace() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useUser();

  // ── Workflow state ──
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [workflowStepIndex, setWorkflowStepIndex] = useState(0);
  const [completedWorkflowSteps, setCompletedWorkflowSteps] = useState<Set<string>>(new Set());
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);

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

  // Voice input for objective (no writer call, direct update)
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterimTranscript, setObjectiveInterimTranscript] = useState("");

  // Objective panel collapsed state (minimized by default)
  const [isObjectiveCollapsed, setIsObjectiveCollapsed] = useState(true);

  // ── Writer mutation ──

  const writeMutation = useMutation({
    mutationFn: async (request: Omit<WriteRequest, "document" | "objective" | "referenceDocuments" | "editHistory" | "capturedContext"> & { description?: string }) => {
      if (!document) throw new Error("No document to write to");
      const response = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        secondaryObjective: secondaryObjective.trim() || undefined,
        referenceDocuments: referenceDocuments.length > 0 ? referenceDocuments : undefined,
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
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

  // ── Create first draft mutation (input phase → workspace) ──

  const createDraftMutation = useMutation({
    mutationFn: async ({ context, obj, refs }: { context: string; obj: string; refs: ReferenceDocument[] }) => {
      const response = await apiRequest("POST", "/api/write", {
        document: context,
        objective: obj,
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
    mutationFn: async ({ overrideEntries, direction }: { overrideEntries?: InterviewEntry[]; direction?: { mode: DirectionMode; personas: ProvocationType[]; guidance?: string } } = {}) => {
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
        directionMode: dir?.mode,
        directionPersonas: dir?.personas && dir.personas.length > 0
          ? dir.personas : undefined,
        directionGuidance: dir?.guidance,
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
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
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
        capturedContext: capturedContext.length > 0 ? capturedContext : undefined,
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
        challengeId: `interview-${Date.now()}`,
        challengeTitle: topic,
        challengeContent: question,
        personaId,
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

  // Auto-start interview with Think Big persona when entering workspace
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!isInputPhase && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const direction = { mode: "challenge" as DirectionMode, personas: ["thinking_bigger" as ProvocationType] };
      setInterviewDirection(direction);
      setIsInterviewActive(true);
      interviewQuestionMutation.mutate({ direction });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInputPhase]);

  // ── Interview handlers ──

  const handleStartInterview = useCallback((direction: { mode: DirectionMode; personas: ProvocationType[]; guidance?: string }) => {
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
    setReferenceDocuments([]);
    setCapturedContext([]);
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
    // Reset toolbox
    setActiveToolboxApp("provoke");
    autoStartedRef.current = false;
    // Reset workflow state
    setActiveWorkflow(null);
    setWorkflowStepIndex(0);
    setCompletedWorkflowSteps(new Set());
    setShowDetailsPanel(true);
  }, []);

  // ── Workflow handlers ──

  const handleWorkflowSelect = useCallback((workflow: Workflow) => {
    setActiveWorkflow(workflow);
    setWorkflowStepIndex(0);
    setCompletedWorkflowSteps(new Set());
    setShowDetailsPanel(true);
    // Initialize a blank document for the workflow
    if (!document.rawText.trim()) {
      setDocument({ id: generateId("doc"), rawText: " " });
      setObjective(workflow.title);
    }
  }, [document.rawText]);

  const handleFreeformSubmit = useCallback((text: string) => {
    // Start with the brainstorm workflow by default when using freeform
    setDocument({ id: generateId("doc"), rawText: " " });
    setObjective(text);
    // Auto-start interview after setting objective
  }, []);

  const handleWorkflowStepClick = useCallback((index: number) => {
    setWorkflowStepIndex(index);
  }, []);

  const handleWorkflowNext = useCallback(() => {
    if (activeWorkflow && workflowStepIndex < activeWorkflow.steps.length - 1) {
      setWorkflowStepIndex(prev => prev + 1);
    }
  }, [activeWorkflow, workflowStepIndex]);

  const handleWorkflowPrevious = useCallback(() => {
    if (workflowStepIndex > 0) {
      setWorkflowStepIndex(prev => prev - 1);
    }
  }, [workflowStepIndex]);

  const handleWorkflowStepComplete = useCallback(() => {
    if (!activeWorkflow) return;
    const step = activeWorkflow.steps[workflowStepIndex];
    setCompletedWorkflowSteps(prev => new Set([...prev, step.id]));
    // Auto-advance to next step
    if (workflowStepIndex < activeWorkflow.steps.length - 1) {
      setWorkflowStepIndex(prev => prev + 1);
    }
  }, [activeWorkflow, workflowStepIndex]);

  const handleWorkflowReset = useCallback(() => {
    setActiveWorkflow(null);
    setWorkflowStepIndex(0);
    setCompletedWorkflowSteps(new Set());
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
              <UserButton data-testid="button-user-menu" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <TextInputForm
            onSubmit={(text, obj, refs) => {
              createDraftMutation.mutate({ context: text, obj, refs });
            }}
            isLoading={createDraftMutation.isPending}
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
                description: "Capture workspace initialized",
              };
              setVersions([initialVersion]);
            }}
            capturedContext={capturedContext}
            onCapturedContextChange={setCapturedContext}
          />
        </div>
      </div>
    );
  }

  // ── Panel contents for workflow steps ──

  /** Renders the appropriate component for the current workflow step */
  const renderWorkflowStepContent = () => {
    if (!activeWorkflow) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <Sparkles className="w-12 h-12 text-primary/30 mx-auto" />
            <h2 className="font-serif text-xl text-foreground">Select a workflow to begin</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Choose a workflow from the sidebar or describe what you're working on.
              Each workflow guides you through a structured process with AI-powered challenges.
            </p>
          </div>
        </div>
      );
    }

    const currentStep = activeWorkflow.steps[workflowStepIndex];
    if (!currentStep) return null;

    switch (currentStep.component) {
      case "text-input":
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="font-serif text-lg">{currentStep.title}</h2>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
                <ProvokeText
                  chrome="container"
                  variant="textarea"
                  placeholder="Start typing or use voice to capture your thoughts..."
                  value={document.rawText.trim() === "" ? "" : document.rawText}
                  onChange={(text) => setDocument({ ...document, rawText: text })}
                  className="text-sm leading-relaxed font-serif min-h-[200px]"
                  minRows={8}
                  maxRows={20}
                  voice={{ mode: "replace" }}
                  onVoiceTranscript={(text) => setDocument({ ...document, rawText: text })}
                />
              </div>
            </div>
          </div>
        );

      case "persona-select":
        return (
          <div className="h-full overflow-y-auto">
            <ProvocationToolbox
              activeApp="provoke"
              onAppChange={() => {}}
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
              capturedContext={capturedContext}
              onCapturedContextChange={setCapturedContext}
            />
          </div>
        );

      case "interview":
        return (
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

            {/* Inline merge bar */}
            {interviewEntries.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 shrink-0">
                <MessageCircleQuestion className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium flex-1">Interview</span>
                {isInterviewActive && (
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
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
                      Merging...
                    </>
                  ) : (
                    <>
                      <ArrowRightToLine className="w-3 h-3" />
                      Merge to Draft
                    </>
                  )}
                </Button>
              </div>
            )}

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
          </div>
        );

      case "document-review":
        return (
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
                onSendFeedback={handleSendDocumentFeedback}
              />
            )}
          </div>
        );

      case "capture":
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="font-serif text-lg">{currentStep.title}</h2>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[
                    { label: "Screenshot", desc: "Capture and annotate" },
                    { label: "Text Clip", desc: "Paste reference text" },
                    { label: "URL", desc: "Add a web reference" },
                    { label: "Upload", desc: "Add a file" },
                  ].map((opt) => (
                    <div key={opt.label} className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-lg text-muted-foreground">+</span>
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "export":
        return (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
              <h2 className="font-serif text-lg">Export Your Document</h2>
              <p className="text-sm text-muted-foreground">Your document is ready. Choose how to export.</p>
              <div className="flex flex-col gap-2 mt-4">
                <Button variant="outline" className="gap-2">Download as Markdown</Button>
                <Button variant="outline" className="gap-2">Copy to Clipboard</Button>
                <Button variant="outline" className="gap-2">Download as Text</Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Layout ──

  return (
    <div className="h-screen flex flex-col">
      {/* Minimal header */}
      <header className="border-b bg-card shrink-0">
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2">
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
              data-testid="button-reset"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            {!showDetailsPanel && activeWorkflow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowDetailsPanel(true)}
                  >
                    <PanelRight className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Show details panel</TooltipContent>
              </Tooltip>
            )}
            <ThemeToggle />
            <UserButton data-testid="button-user-menu-main" />
          </div>
        </div>
      </header>

      {/* Workflow progress tracker (Region 4) */}
      {activeWorkflow && (
        <WorkflowProgressTracker
          workflow={activeWorkflow}
          currentStepIndex={workflowStepIndex}
          completedSteps={completedWorkflowSteps}
          onStepClick={handleWorkflowStepClick}
          onNext={handleWorkflowNext}
          onPrevious={handleWorkflowPrevious}
          onReset={handleWorkflowReset}
          isStepProcessing={writeMutation.isPending || interviewQuestionMutation.isPending}
        />
      )}

      {/* Processing indicator */}
      {writeMutation.isPending && (
        <div className="bg-primary/10 border-b px-4 py-2 flex items-center gap-2 text-sm shrink-0">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Integrating your feedback into the document...</span>
        </div>
      )}

      {/* Suggestions bar */}
      {!writeMutation.isPending && lastSuggestions.length > 0 && (
        <div className="bg-amber-500/10 border-b px-4 py-2 flex items-center gap-3 text-sm shrink-0">
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

      {/* ── Main Layout: Sidebar | Workflow Main | Details Panel ── */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          <div className="h-full overflow-y-auto">
            {!activeWorkflow && (
              <section className="min-h-[50vh] border-b">
                <WorkflowSidebar
                  userRole={user?.publicMetadata?.role as string | undefined}
                  userName={user?.firstName || undefined}
                  onWorkflowSelect={handleWorkflowSelect}
                  onFreeformSubmit={handleFreeformSubmit}
                  activeWorkflowId={activeWorkflow?.id}
                />
              </section>
            )}
            <section className="min-h-[60vh]">
              {renderWorkflowStepContent()}
            </section>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal">
            {/* Region 1: Left Sidebar */}
            <ResizablePanel defaultSize={22} minSize={15} maxSize={30} collapsible collapsedSize={0}>
              <WorkflowSidebar
                userRole={user?.publicMetadata?.role as string | undefined}
                userName={user?.firstName || undefined}
                onWorkflowSelect={handleWorkflowSelect}
                onFreeformSubmit={handleFreeformSubmit}
                activeWorkflowId={activeWorkflow?.id}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />

            {/* Pointer 3: Main Workflow Area */}
            <ResizablePanel defaultSize={showDetailsPanel && activeWorkflow ? 53 : 78} minSize={35}>
              {renderWorkflowStepContent()}
            </ResizablePanel>

            {/* Region 5: Step Details Panel (conditionally shown) */}
            {showDetailsPanel && activeWorkflow && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
                  <StepDetailsPanel
                    step={activeWorkflow.steps[workflowStepIndex]}
                    stepIndex={workflowStepIndex}
                    totalSteps={activeWorkflow.steps.length}
                    isCompleted={completedWorkflowSteps.has(activeWorkflow.steps[workflowStepIndex]?.id)}
                    onComplete={handleWorkflowStepComplete}
                    onCollapse={() => setShowDetailsPanel(false)}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
