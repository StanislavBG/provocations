import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { ReadingPane } from "./ReadingPane";
import { StreamingDialogue } from "./StreamingDialogue";
import { StreamingWireframePanel } from "./StreamingWireframePanel";
import type { CaptureRegion } from "./ScreenCaptureButton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type {
  Document,
  DocumentVersion,
  EditHistoryEntry,
  StreamingDialogueEntry,
  StreamingRequirement,
  StreamingQuestionResponse,
  WireframeAnalysisResponse,
  StreamingRefineResponse,
} from "@shared/schema";

interface StreamingWorkspaceProps {
  document: Document;
  objective: string;
  versions: DocumentVersion[];
  editHistory: EditHistoryEntry[];
  onDocumentChange: (doc: Document) => void;
  onVersionAdd: (version: DocumentVersion) => void;
  onEditHistoryAdd: (entry: EditHistoryEntry) => void;
}

export function StreamingWorkspace({
  document,
  objective,
  versions,
  editHistory,
  onDocumentChange,
  onVersionAdd,
  onEditHistoryAdd,
}: StreamingWorkspaceProps) {
  const { toast } = useToast();

  // Streaming dialogue state
  const [dialogueEntries, setDialogueEntries] = useState<StreamingDialogueEntry[]>([]);
  const [requirements, setRequirements] = useState<StreamingRequirement[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [isDialogueActive, setIsDialogueActive] = useState(false);

  // Website context panel state
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [wireframeNotes, setWireframeNotes] = useState("");
  const [wireframeAnalysis, setWireframeAnalysis] = useState<WireframeAnalysisResponse | null>(null);

  // Track last analyzed URL to avoid duplicate triggers
  const lastAnalyzedUrl = useRef<string>("");

  // Generate streaming question mutation
  const questionMutation = useMutation({
    mutationFn: async (overrideEntries?: StreamingDialogueEntry[]) => {
      const entries = overrideEntries ?? dialogueEntries;
      // Enrich wireframe notes with analysis context so the agent has background knowledge
      const enrichedNotes = [
        wireframeNotes || "",
        wireframeAnalysis ? `\n[SITE ANALYSIS]: ${wireframeAnalysis.analysis}\nComponents: ${wireframeAnalysis.components.join(", ")}` : "",
      ].filter(Boolean).join("\n") || undefined;

      const response = await apiRequest("POST", "/api/streaming/question", {
        objective,
        document: document.rawText || undefined,
        websiteUrl: websiteUrl || undefined,
        wireframeNotes: enrichedNotes,
        previousEntries: entries.length > 0 ? entries : undefined,
        requirements: requirements.length > 0 ? requirements : undefined,
      });
      return await response.json() as StreamingQuestionResponse;
    },
    onSuccess: (data) => {
      // Add agent question to dialogue
      const agentEntry: StreamingDialogueEntry = {
        id: generateId("se"),
        role: "agent",
        content: data.question,
        timestamp: Date.now(),
      };
      setDialogueEntries(prev => [...prev, agentEntry]);
      setCurrentQuestion(data.question);
      setCurrentTopic(data.topic);

      // If the agent suggested a requirement, add it
      if (data.suggestedRequirement) {
        const newReq: StreamingRequirement = {
          id: generateId("req"),
          text: data.suggestedRequirement,
          status: "draft",
          timestamp: Date.now(),
        };
        setRequirements(prev => [...prev, newReq]);
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

  // Wireframe analysis mutation — feeds results into the dialogue
  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streaming/wireframe-analysis", {
        objective,
        websiteUrl: websiteUrl || undefined,
        wireframeNotes,
        document: document.rawText || undefined,
      });
      return await response.json() as WireframeAnalysisResponse;
    },
    onSuccess: (data) => {
      setWireframeAnalysis(data);
      // Activate dialogue so user can start typing — analysis stays in the log panel
      setIsDialogueActive(true);
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze website",
        variant: "destructive",
      });
    },
  });

  // Refine requirements mutation
  const refineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streaming/refine", {
        objective,
        dialogueEntries,
        existingRequirements: requirements.length > 0 ? requirements : undefined,
        document: document.rawText || undefined,
      });
      return await response.json() as StreamingRefineResponse;
    },
    onSuccess: (data) => {
      if (data.requirements.length > 0) {
        setRequirements(data.requirements);
      }

      // Update document with refined requirements
      if (data.updatedDocument) {
        const newVersion: DocumentVersion = {
          id: generateId("v"),
          text: data.updatedDocument,
          timestamp: Date.now(),
          description: `Requirements refined: ${data.summary}`,
        };
        onVersionAdd(newVersion);
        onDocumentChange({ ...document, rawText: data.updatedDocument });

        const historyEntry: EditHistoryEntry = {
          instruction: "Refine requirements from streaming dialogue",
          instructionType: "restructure",
          summary: data.summary,
          timestamp: Date.now(),
        };
        onEditHistoryAdd(historyEntry);
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

    // Basic URL validation
    const urlPattern = /^https?:\/\/\S+\.\S+/;
    if (!urlPattern.test(trimmedUrl)) return;

    // Don't re-analyze the same URL
    if (trimmedUrl === lastAnalyzedUrl.current) return;

    const timer = setTimeout(() => {
      lastAnalyzedUrl.current = trimmedUrl;
      analysisMutation.mutate();
    }, 800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl]);

  // Start the streaming dialogue (manual start without analysis)
  const handleStartDialogue = useCallback(() => {
    setIsDialogueActive(true);
    // Don't auto-generate a question — user drives the conversation
  }, []);

  // Handle user answer — add to dialogue and fetch next question
  const handleAnswer = useCallback((answer: string) => {
    // Add user answer to dialogue
    const userEntry: StreamingDialogueEntry = {
      id: generateId("se"),
      role: "user",
      content: answer,
      timestamp: Date.now(),
    };
    const updatedEntries = [...dialogueEntries, userEntry];
    setDialogueEntries(updatedEntries);
    setCurrentQuestion(null);
    setCurrentTopic(null);

    // Fetch next question with updated entries
    questionMutation.mutate(updatedEntries);
  }, [dialogueEntries, questionMutation]);

  // Handle document text change
  const handleDocumentTextChange = useCallback((newText: string) => {
    onDocumentChange({ ...document, rawText: newText });
  }, [document, onDocumentChange]);

  // Handle requirement update
  const handleUpdateRequirement = useCallback((id: string, text: string) => {
    setRequirements(prev =>
      prev.map(r => r.id === id ? { ...r, text, status: "revised" as const } : r)
    );
  }, []);

  // Handle requirement confirm
  const handleConfirmRequirement = useCallback((id: string) => {
    setRequirements(prev =>
      prev.map(r => r.id === id ? { ...r, status: "confirmed" as const } : r)
    );
  }, []);

  // Handle screen capture: embed annotated image + per-region narration into the requirement markdown doc
  const handleScreenCapture = useCallback((imageDataUrl: string, regions: CaptureRegion[]) => {
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

    // Append directly to the document for the streaming workspace
    const updatedText = document.rawText.trim() + "\n" + markdownSnippet;
    const newVersion: DocumentVersion = {
      id: generateId("v"),
      text: updatedText,
      timestamp: Date.now(),
      description: `Annotated capture (${regions.length} regions)`,
    };
    onVersionAdd(newVersion);
    onDocumentChange({ ...document, rawText: updatedText });

    const historyEntry: EditHistoryEntry = {
      instruction: `Added annotated screen capture with ${regions.length} regions`,
      instructionType: "expand",
      summary: `Annotated screenshot added with ${regions.length} region${regions.length !== 1 ? "s" : ""}`,
      timestamp: Date.now(),
    };
    onEditHistoryAdd(historyEntry);

    toast({
      title: "Screenshot Added",
      description: `Annotated capture with ${regions.length} region${regions.length !== 1 ? "s" : ""} appended to the document.`,
    });
  }, [document, onDocumentChange, onVersionAdd, onEditHistoryAdd, toast]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Panel A: Website Wireframe (left) — URL, wireframe, capture, analysis log */}
      <ResizablePanel
        defaultSize={30}
        minSize={10}
        collapsible
        collapsedSize={0}
      >
        <div className="h-full overflow-auto">
          <StreamingWireframePanel
            websiteUrl={websiteUrl}
            onWebsiteUrlChange={setWebsiteUrl}
            wireframeNotes={wireframeNotes}
            onWireframeNotesChange={setWireframeNotes}
            isAnalyzing={analysisMutation.isPending}
            hasAnalysis={wireframeAnalysis !== null}
            wireframeAnalysis={wireframeAnalysis}
            onCapture={handleScreenCapture}
            captureDisabled={refineMutation.isPending}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Panel B: Requirement Dialogue (center) — agent Q&A populated from analysis */}
      <ResizablePanel
        defaultSize={35}
        minSize={10}
        collapsible
        collapsedSize={0}
      >
        <div className="h-full overflow-hidden">
          <StreamingDialogue
            entries={dialogueEntries}
            requirements={requirements}
            currentQuestion={currentQuestion}
            currentTopic={currentTopic}
            isLoadingQuestion={questionMutation.isPending}
            isRefining={refineMutation.isPending}
            onAnswer={handleAnswer}
            onStart={handleStartDialogue}
            onRefineRequirements={() => refineMutation.mutate()}
            onUpdateRequirement={handleUpdateRequirement}
            onConfirmRequirement={handleConfirmRequirement}
            isActive={isDialogueActive}
            hasAnalysis={wireframeAnalysis !== null}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Panel C: Requirement Draft / Document (right) */}
      <ResizablePanel
        defaultSize={35}
        minSize={10}
        collapsible
        collapsedSize={0}
      >
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <ReadingPane
              text={document.rawText}
              onTextChange={handleDocumentTextChange}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
