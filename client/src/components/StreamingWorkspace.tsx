import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { ReadingPane } from "./ReadingPane";
import { StreamingDialogue } from "./StreamingDialogue";
import { StreamingWireframePanel } from "./StreamingWireframePanel";
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

  // Generate streaming question mutation
  const questionMutation = useMutation({
    mutationFn: async (overrideEntries?: StreamingDialogueEntry[]) => {
      const entries = overrideEntries ?? dialogueEntries;
      const response = await apiRequest("POST", "/api/streaming/question", {
        objective,
        document: document.rawText || undefined,
        websiteUrl: websiteUrl || undefined,
        wireframeNotes: wireframeNotes || undefined,
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

      // Build a summary message from the analysis to inject into the dialogue
      const parts: string[] = [];
      if (data.analysis) {
        parts.push(data.analysis);
      }
      if (data.components.length > 0) {
        parts.push(`\nI identified these components: ${data.components.join(", ")}.`);
      }
      if (data.suggestions.length > 0) {
        parts.push(`\nAreas that need clarification:\n${data.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
      }
      parts.push("\nWhat would you like to do here? Tell me what you need and I'll help you shape it into requirements.");

      const analysisEntry: StreamingDialogueEntry = {
        id: generateId("se"),
        role: "agent",
        content: parts.join(""),
        timestamp: Date.now(),
      };

      // Inject the analysis into the dialogue and activate it
      setDialogueEntries(prev => [...prev, analysisEntry]);
      setCurrentQuestion(parts.join(""));
      setCurrentTopic("Website Analysis");
      setIsDialogueActive(true);

      toast({
        title: "Website Analyzed",
        description: `Found ${data.components.length} components. The dialogue is ready — tell the agent what you want to do.`,
      });
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

  // Start the streaming dialogue (manual start without analysis)
  const handleStartDialogue = useCallback(() => {
    setIsDialogueActive(true);
    questionMutation.mutate(undefined);
  }, [questionMutation]);

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

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Panel A: Website Analysis (left) — URL, objective, wireframe view */}
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
            analysis={wireframeAnalysis}
            isAnalyzing={analysisMutation.isPending}
            onAnalyze={() => analysisMutation.mutate()}
            objective={objective}
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
        <div className="h-full overflow-auto">
          <ReadingPane
            text={document.rawText}
            onTextChange={handleDocumentTextChange}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
