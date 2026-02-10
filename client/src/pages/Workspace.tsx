import { useState, useCallback, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { encrypt } from "@/lib/crypto";
import { generateId } from "@/lib/utils";
import { TextInputForm } from "@/components/TextInputForm";
import { ProvocationsDisplay } from "@/components/ProvocationsDisplay";
import { InterviewPanel } from "@/components/InterviewPanel";
import { OutlineBuilder } from "@/components/OutlineBuilder";
import { ReadingPane } from "@/components/ReadingPane";
import { DimensionsToolbar } from "@/components/DimensionsToolbar";
import { TranscriptOverlay } from "@/components/TranscriptOverlay";
import { VoiceRecorder, LargeVoiceRecorder } from "@/components/VoiceRecorder";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy components
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
import { SaveDocumentDialog, type SaveCredentials } from "@/components/SaveDocumentDialog";
import { LoadDocumentDialog } from "@/components/LoadDocumentDialog";
import {
  Sparkles,
  RotateCcw,
  MessageSquareWarning,
  MessageCircleQuestion,
  ListTree,
  Settings2,
  GitCompare,
  Target,
  BookCopy,
  X,
  Lightbulb,
  Save,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
  Document,
  Provocation,
  ProvocationType,
  OutlineItem,
  ToneOption,
  DocumentVersion,
  WriteRequest,
  WriteResponse,
  ReferenceDocument,
  EditHistoryEntry,
  InterviewEntry,
  InterviewQuestionResponse,
} from "@shared/schema";

type AppPhase = "input" | "blank-document" | "workspace";

export default function Workspace() {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<AppPhase>("input");
  const [document, setDocument] = useState<Document | null>(null);
  const [objective, setObjective] = useState<string>("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [provocations, setProvocations] = useState<Provocation[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [selectedTone, setSelectedTone] = useState<ToneOption>("practical");
  const [targetLength, setTargetLength] = useState<"shorter" | "same" | "longer">("same");
  const [activeTab, setActiveTab] = useState("provocations");
  const [refinedPreview, setRefinedPreview] = useState<string | null>(null);
  
  // Voice and version tracking
  const [isRecordingBlank, setIsRecordingBlank] = useState(false);
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
    context: "selection" | "provocation" | "document" | "outline";
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

  // Save/Load dialogs
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState<SaveCredentials | null>(null);
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  // Voice input for objective (no writer call, direct update)
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterimTranscript, setObjectiveInterimTranscript] = useState("");
  
  // Get the source excerpt of the currently hovered provocation
  const hoveredProvocationContext = hoveredProvocationId 
    ? provocations.find(p => p.id === hoveredProvocationId)?.sourceExcerpt 
    : undefined;

  const analyzeMutation = useMutation({
    mutationFn: async ({ text, referenceDocuments }: { text: string; referenceDocuments?: ReferenceDocument[] }) => {
      const response = await apiRequest("POST", "/api/analyze", {
        text,
        referenceDocuments,
      });
      return await response.json() as {
        document: Document;
        provocations: Provocation[];
        warnings?: Array<{ type: string; message: string }>;
      };
    },
    onSuccess: (data) => {
      const provocationsData = data.provocations ?? [];
      setDocument(data.document);
      setProvocations(provocationsData);
      setPhase("workspace");

      // Create initial version
      const initialVersion: DocumentVersion = {
        id: generateId("v"),
        text: data.document.rawText,
        timestamp: Date.now(),
        description: "Original document"
      };
      setVersions([initialVersion]);

      // Show truncation warning if applicable
      if (data.warnings?.some(w => w.type === "text_truncated")) {
        const warning = data.warnings.find(w => w.type === "text_truncated");
        toast({
          title: "Text Truncated for Analysis",
          description: warning?.message || "Some text was truncated during analysis.",
          variant: "default",
        });
      }

      toast({
        title: "Analysis Complete",
        description: `Generated ${provocationsData.length} provocations.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

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

  const expandMutation = useMutation({
    mutationFn: async ({ heading }: { heading: string }) => {
      if (!document) throw new Error("No document context");
      const response = await apiRequest("POST", "/api/write", {
        document: document.rawText,
        objective,
        instruction: `Expand the section "${heading}" into well-developed paragraphs. Focus on this heading specifically.`,
        tone: selectedTone,
      });
      const result = await response.json() as WriteResponse;
      return { content: result.document };
    },
    onError: (error) => {
      toast({
        title: "Expansion Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const refineMutation = useMutation({
    mutationFn: async ({ text, tone, length }: { text: string; tone: ToneOption; length: "shorter" | "same" | "longer" }) => {
      const response = await apiRequest("POST", "/api/write", {
        document: text,
        objective,
        instruction: "Refine the document according to the specified tone and length preferences.",
        tone,
        targetLength: length,
      });
      const result = await response.json() as WriteResponse;
      return { refined: result.document };
    },
    onSuccess: (data) => {
      setRefinedPreview(data.refined);
    },
    onError: (error) => {
      toast({
        title: "Refinement Failed",
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

  const handleAnalyze = useCallback((text: string, docObjective?: string, refs?: ReferenceDocument[]) => {
    if (docObjective) {
      setObjective(docObjective);
    }
    if (refs) {
      setReferenceDocuments(refs);
    }
    analyzeMutation.mutate({ text, referenceDocuments: refs });
  }, [analyzeMutation]);

  const handleUpdateProvocationStatus = useCallback((id: string, status: Provocation["status"]) => {
    setProvocations((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  }, []);

  const handleAddOutlineItem = useCallback((item: OutlineItem) => {
    setOutline((prev) => [...prev, item]);
  }, []);

  const handleUpdateOutlineItem = useCallback((id: string, updates: Partial<OutlineItem>) => {
    setOutline((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const handleRemoveOutlineItem = useCallback((id: string) => {
    setOutline((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleReorderOutline = useCallback((items: OutlineItem[]) => {
    setOutline(items);
  }, []);

  const handleExpandHeading = useCallback(async (id: string, heading: string): Promise<string> => {
    const result = await expandMutation.mutateAsync({ heading });
    return result.content;
  }, [expandMutation]);

  const handleRefine = useCallback(async () => {
    const contentToRefine = outline
      .filter((item) => item.content)
      .map((item) => `## ${item.heading}\n\n${item.content}`)
      .join("\n\n");
    
    if (!contentToRefine) {
      toast({
        title: "No Content to Refine",
        description: "Add content to your outline sections first.",
        variant: "destructive",
      });
      return;
    }

    await refineMutation.mutateAsync({
      text: contentToRefine,
      tone: selectedTone,
      length: targetLength,
    });

    toast({
      title: "Refinement Complete",
      description: "Review the refined content and apply to your outline.",
    });
  }, [outline, selectedTone, targetLength, refineMutation, toast]);

  const handleApplyRefinement = useCallback(() => {
    if (!refinedPreview) return;
    
    // Parse refined content back into outline sections
    const sections = refinedPreview.split(/^## /m).filter(Boolean);
    
    setOutline((prev) => {
      const updated = [...prev];
      sections.forEach((section) => {
        const lines = section.split("\n");
        const heading = lines[0]?.trim();
        const content = lines.slice(1).join("\n").trim();
        
        const existingIndex = updated.findIndex(
          (item) => item.heading.toLowerCase() === heading?.toLowerCase()
        );
        
        if (existingIndex !== -1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            content,
          };
        }
      });
      return updated;
    });
    
    setRefinedPreview(null);
    setActiveTab("outline");
    
    toast({
      title: "Refinement Applied",
      description: "Your outline content has been updated with the refined text.",
    });
  }, [refinedPreview, toast]);

  const handleDiscardRefinement = useCallback(() => {
    setRefinedPreview(null);
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
    setPhase("input");
    setDocument(null);
    setObjective("");
    setReferenceDocuments([]);
    setProvocations([]);
    setOutline([]);
    setRefinedPreview(null);
    setVersions([]);
    setShowDiffView(false);
    setIsRecordingBlank(false);
    setEditHistory([]);
    setLastSuggestions([]);
    setIsInterviewActive(false);
    setInterviewEntries([]);
    setCurrentInterviewQuestion(null);
    setCurrentInterviewTopic(null);
    setSaveCredentials(null);
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

  const handleBlankDocument = useCallback(() => {
    setPhase("blank-document");
  }, []);

  const handleBlankDocumentTranscript = useCallback((transcript: string) => {
    if (transcript.trim()) {
      // Set a default objective for voice-started documents
      setObjective("Create a compelling document from spoken ideas");
      // Trigger analysis with transcribed text
      analyzeMutation.mutate({ text: transcript });
    }
  }, [analyzeMutation]);

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

  // Handle voice input from outline section
  const handleOutlineVoiceInput = useCallback((sectionId: string, heading: string, transcript: string) => {
    if (!document || !transcript.trim()) return;

    setPendingVoiceContext({
      outlineSection: { id: sectionId, heading },
      context: "outline",
    });

    setRawTranscript(transcript);
    setShowTranscriptOverlay(true);
    setTranscriptSummary("");
    setCleanedTranscript(undefined);
    setIsRecordingFromMain(false);
  }, [document]);

  // Handle text instruction for outline section (goes directly through writer)
  const handleOutlineTextInstruction = useCallback((sectionId: string, heading: string, instruction: string, currentContent: string) => {
    if (!document) return;

    const sectionDoc = currentContent || `## ${heading}\n\n(empty section)`;
    writeMutation.mutate({
      instruction: `For the section "${heading}": ${instruction}`,
      selectedText: sectionDoc,
      description: `Edit outline section: ${heading}`,
    });
  }, [document, writeMutation]);

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
    } else if (context?.outlineSection) {
      // Sending as outline section edit
      const section = outline.find(item => item.id === context.outlineSection!.id);
      const sectionContent = section?.content || `## ${context.outlineSection.heading}\n\n(empty section)`;
      writeMutation.mutate({
        instruction: `For the section "${context.outlineSection.heading}": ${transcript}`,
        selectedText: sectionContent,
        description: `Voice edit on outline: ${context.outlineSection.heading}`,
      });
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

  // Handle loading a decrypted document from the LoadDocumentDialog
  const handleLoadDocument = useCallback((text: string, title: string, docId: number, passphrase: string) => {
    setObjective(title);
    setSaveCredentials({ documentId: docId, title, passphrase });
    analyzeMutation.mutate({ text, referenceDocuments });
  }, [analyzeMutation, referenceDocuments]);

  // Quick save: re-encrypt and overwrite the existing saved document
  const handleSaveClick = useCallback(async () => {
    if (!document?.rawText) return;

    if (!saveCredentials) {
      // First save - show dialog
      setShowSaveDialog(true);
      return;
    }

    // Quick save - encrypt and PUT update
    setIsQuickSaving(true);
    try {
      const encrypted = await encrypt(document.rawText, saveCredentials.passphrase);
      await apiRequest("PUT", `/api/documents/${saveCredentials.documentId}`, {
        title: saveCredentials.title,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
      });
      toast({
        title: "Saved",
        description: `"${saveCredentials.title}" updated.`,
      });
    } catch {
      toast({
        title: "Save Failed",
        description: "Could not save. Try again or use Save As.",
        variant: "destructive",
      });
    } finally {
      setIsQuickSaving(false);
    }
  }, [document, saveCredentials, toast]);

  // Callback after first save from dialog
  const handleFirstSave = useCallback((credentials: SaveCredentials) => {
    setSaveCredentials(credentials);
  }, []);

  const hasOutlineContent = outline?.some((item) => item.content) ?? false;
  const canShowDiff = versions.length >= 2;
  const previousVersion = versions.length >= 2 ? versions[versions.length - 2] : null;
  const currentVersion = versions.length >= 1 ? versions[versions.length - 1] : null;

  if (phase === "input") {
    return (
      <div className="h-screen flex flex-col">
        {/* Top bar: branding left, actions right */}
        <header className="flex items-center justify-between px-5 py-3 border-b bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg">Provocations</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLoadDialog(true)}
              className="gap-1.5"
              title="Your documents are encrypted — only you can read them"
            >
              <FolderOpen className="w-4 h-4" />
              Load Saved
              <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">encrypted</span>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <TextInputForm
            onSubmit={handleAnalyze}
            onBlankDocument={handleBlankDocument}
            isLoading={analyzeMutation.isPending}
          />
        </div>
        <LoadDocumentDialog
          open={showLoadDialog}
          onOpenChange={setShowLoadDialog}
          onLoad={handleLoadDocument}
        />
      </div>
    );
  }

  if (phase === "blank-document") {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Back
          </Button>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-4 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-serif font-bold tracking-tight">
              Speak Your First Draft
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Click the microphone and start speaking. Your words will become the foundation for analysis.
            </p>
          </div>
          
          <LargeVoiceRecorder
            onTranscript={handleBlankDocumentTranscript}
            isRecording={isRecordingBlank}
            onToggleRecording={() => setIsRecordingBlank(!isRecordingBlank)}
          />
          
          {analyzeMutation.isPending && (
            <div className="mt-8 flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Analyzing your draft...</span>
            </div>
          )}
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
              disabled={!document?.rawText || isQuickSaving}
              title={saveCredentials
                ? `Save to "${saveCredentials.title}"`
                : "End-to-end encrypted — only you can read your saved documents"}
            >
              <Save className="w-4 h-4" />
              {isQuickSaving ? "Saving..." : "Save"}
              {!saveCredentials && (
                <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">encrypted</span>
              )}
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
          </div>
        </div>

        {/* Objective bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
          <Target className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground shrink-0">Objective:</span>
          <Input
            data-testid="input-objective-header"
            value={isRecordingObjective ? objectiveInterimTranscript || objective : objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="What are you creating?"
            className={`h-7 text-sm bg-transparent border-none shadow-none focus-visible:ring-0 px-1 flex-1 ${isRecordingObjective ? "text-primary" : ""}`}
            readOnly={isRecordingObjective}
          />
          <VoiceRecorder
            onTranscript={(text) => {
              setObjective(text);
              setObjectiveInterimTranscript("");
            }}
            onInterimTranscript={setObjectiveInterimTranscript}
            onRecordingChange={setIsRecordingObjective}
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
          />

          {/* Reference documents indicator */}
          {referenceDocuments.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 shrink-0">
                  <BookCopy className="w-4 h-4" />
                  <Badge variant="secondary" className="text-xs">{referenceDocuments.length}</Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <BookCopy className="w-4 h-4" />
                    Reference Documents
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    These guide style and inform completeness checks.
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {referenceDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-start gap-2 p-2 rounded border bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">{doc.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{doc.type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {doc.content.slice(0, 100)}...
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => setReferenceDocuments(prev => prev.filter(d => d.id !== doc.id))}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
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
                text={document?.rawText || ""}
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
                  <TabsTrigger
                    value="interview"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
                    data-testid="tab-interview"
                  >
                    <MessageCircleQuestion className="w-4 h-4" />
                    Interview
                    {isInterviewActive && (
                      <span className="ml-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="outline"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
                    data-testid="tab-outline"
                  >
                    <ListTree className="w-4 h-4" />
                    Outline
                    {(outline ?? []).length > 0 && (
                      <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5">
                        {(outline ?? []).length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="dimensions" 
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
                    data-testid="tab-dimensions"
                  >
                    <Settings2 className="w-4 h-4" />
                    Dimensions
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="provocations" className="flex-1 mt-0 overflow-hidden">
                  <ProvocationsDisplay
                    provocations={provocations}
                    onUpdateStatus={handleUpdateProvocationStatus}
                    onVoiceResponse={handleVoiceResponse}
                    onStartResponse={handleStartProvocationResponse}
                    onAddToDocument={handleAddToDocument}
                    onTranscriptUpdate={handleTranscriptUpdate}
                    onHoverProvocation={setHoveredProvocationId}
                    onRegenerateProvocations={handleRegenerateProvocations}
                    isLoading={analyzeMutation.isPending}
                    isMerging={writeMutation.isPending}
                    isRegenerating={regenerateProvocationsMutation.isPending}
                  />
                </TabsContent>
                
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

                <TabsContent value="outline" className="flex-1 mt-0 overflow-hidden">
                  <OutlineBuilder
                    outline={outline}
                    onAddItem={handleAddOutlineItem}
                    onUpdateItem={handleUpdateOutlineItem}
                    onRemoveItem={handleRemoveOutlineItem}
                    onReorder={handleReorderOutline}
                    onExpandHeading={handleExpandHeading}
                    onVoiceInput={handleOutlineVoiceInput}
                    onTranscriptUpdate={handleTranscriptUpdate}
                    onTextInstruction={handleOutlineTextInstruction}
                  />
                </TabsContent>
                
                <TabsContent value="dimensions" className="flex-1 mt-0 overflow-auto p-4">
                  <DimensionsToolbar
                    selectedTone={selectedTone}
                    onToneChange={setSelectedTone}
                    targetLength={targetLength}
                    onLengthChange={setTargetLength}
                    onRefine={handleRefine}
                    isRefining={refineMutation.isPending}
                    hasContent={hasOutlineContent}
                    refinedPreview={refinedPreview}
                    onApplyRefinement={handleApplyRefinement}
                    onDiscardRefinement={handleDiscardRefinement}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <SaveDocumentDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        documentText={document?.rawText || ""}
        onSaved={handleFirstSave}
      />
      <LoadDocumentDialog
        open={showLoadDialog}
        onOpenChange={setShowLoadDialog}
        onLoad={handleLoadDocument}
      />
    </div>
  );
}
