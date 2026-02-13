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
  WriteResponse,
} from "@shared/schema";

interface WireframeDialogueEntry {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

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

  // Wireframe panel state
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [wireframeNotes, setWireframeNotes] = useState("");
  const [wireframeAnalysis, setWireframeAnalysis] = useState<WireframeAnalysisResponse | null>(null);
  const [wireframeDialogue, setWireframeDialogue] = useState<WireframeDialogueEntry[]>([]);

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

  // Wireframe analysis mutation
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
      toast({
        title: "Wireframe Analyzed",
        description: `Found ${data.components.length} components and ${data.suggestions.length} areas for clarification.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze wireframe",
        variant: "destructive",
      });
    },
  });

  // Wireframe dialogue mutation (reuses wireframe analysis endpoint with dialogue context)
  const wireframeDialogueMutation = useMutation({
    mutationFn: async (message: string) => {
      const fullNotes = wireframeNotes + "\n\nUser question: " + message;
      const response = await apiRequest("POST", "/api/streaming/wireframe-analysis", {
        objective,
        websiteUrl: websiteUrl || undefined,
        wireframeNotes: fullNotes,
        document: document.rawText || undefined,
      });
      return await response.json() as WireframeAnalysisResponse;
    },
    onSuccess: (data, message) => {
      // Add user message
      const userEntry: WireframeDialogueEntry = {
        id: generateId("wd"),
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      // Add agent response
      const agentEntry: WireframeDialogueEntry = {
        id: generateId("wd"),
        role: "agent",
        content: data.analysis,
        timestamp: Date.now(),
      };
      setWireframeDialogue(prev => [...prev, userEntry, agentEntry]);

      // Update analysis if components or suggestions changed
      if (data.components.length > 0 || data.suggestions.length > 0) {
        setWireframeAnalysis(data);
      }
    },
    onError: (error) => {
      toast({
        title: "Dialogue Error",
        description: error instanceof Error ? error.message : "Failed to process",
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

  // Start the streaming dialogue
  const handleStartDialogue = useCallback(() => {
    setIsDialogueActive(true);
    questionMutation.mutate(undefined);
  }, [questionMutation]);

  // Handle user answer
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

  // Handle wireframe dialogue submit
  const handleWireframeDialogueSubmit = useCallback((message: string) => {
    wireframeDialogueMutation.mutate(message);
  }, [wireframeDialogueMutation]);

  return (
    <ResizablePanelGroup direction="horizontal">
      {/* Panel A: Requirement Draft (document) */}
      <ResizablePanel defaultSize={30} minSize={20}>
        <ReadingPane
          text={document.rawText}
          onTextChange={handleDocumentTextChange}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Panel B: Provocation Dialogue (agent Q&A) */}
      <ResizablePanel defaultSize={35} minSize={20}>
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
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Panel C: Website Wireframe Panel */}
      <ResizablePanel defaultSize={35} minSize={20}>
        <StreamingWireframePanel
          websiteUrl={websiteUrl}
          onWebsiteUrlChange={setWebsiteUrl}
          wireframeNotes={wireframeNotes}
          onWireframeNotesChange={setWireframeNotes}
          analysis={wireframeAnalysis}
          isAnalyzing={analysisMutation.isPending}
          onAnalyze={() => analysisMutation.mutate()}
          wireframeDialogue={wireframeDialogue}
          onWireframeDialogueSubmit={handleWireframeDialogueSubmit}
          isWireframeDialogueLoading={wireframeDialogueMutation.isPending}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
