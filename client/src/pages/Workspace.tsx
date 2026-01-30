import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TextInputForm } from "@/components/TextInputForm";
import { LensesPanel } from "@/components/LensesPanel";
import { ProvocationsDisplay } from "@/components/ProvocationsDisplay";
import { OutlineBuilder } from "@/components/OutlineBuilder";
import { ReadingPane } from "@/components/ReadingPane";
import { DimensionsToolbar } from "@/components/DimensionsToolbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { 
  Sparkles, 
  RotateCcw, 
  MessageSquareWarning,
  ListTree,
  Settings2
} from "lucide-react";
import type { 
  Document, 
  Lens, 
  Provocation, 
  OutlineItem, 
  LensType, 
  ToneOption 
} from "@shared/schema";

export default function Workspace() {
  const { toast } = useToast();
  
  const [isInputPhase, setIsInputPhase] = useState(true);
  const [document, setDocument] = useState<Document | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeLens, setActiveLens] = useState<LensType | null>(null);
  const [provocations, setProvocations] = useState<Provocation[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [selectedTone, setSelectedTone] = useState<ToneOption>("practical");
  const [targetLength, setTargetLength] = useState<"shorter" | "same" | "longer">("same");
  const [activeTab, setActiveTab] = useState("provocations");
  const [refinedPreview, setRefinedPreview] = useState<string | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/analyze", { text });
      return await response.json() as { document: Document; lenses: Lens[]; provocations: Provocation[] };
    },
    onSuccess: (data) => {
      const lensesData = data.lenses ?? [];
      const provocationsData = data.provocations ?? [];
      setDocument(data.document);
      setLenses(lensesData);
      setProvocations(provocationsData);
      setIsInputPhase(false);
      toast({
        title: "Analysis Complete",
        description: `Generated ${lensesData.length} lenses and ${provocationsData.length} provocations.`,
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

  const expandMutation = useMutation({
    mutationFn: async ({ heading, context }: { heading: string; context?: string }) => {
      const response = await apiRequest("POST", "/api/expand", { 
        heading, 
        context: context || document?.rawText,
        tone: selectedTone 
      });
      return await response.json() as { content: string };
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
      const response = await apiRequest("POST", "/api/refine", { text, tone, targetLength: length });
      return await response.json() as { refined: string };
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

  const handleAnalyze = useCallback((text: string) => {
    analyzeMutation.mutate(text);
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

  const handleReset = useCallback(() => {
    setIsInputPhase(true);
    setDocument(null);
    setLenses([]);
    setActiveLens(null);
    setProvocations([]);
    setOutline([]);
    setRefinedPreview(null);
  }, []);

  const handleDocumentTextChange = useCallback((newText: string) => {
    if (document) {
      setDocument({ ...document, rawText: newText });
    }
  }, [document]);

  const activeLensSummary = lenses?.find((l) => l.type === activeLens)?.summary;
  const hasOutlineContent = outline?.some((item) => item.content) ?? false;

  if (isInputPhase) {
    return (
      <div className="min-h-screen">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <TextInputForm 
          onSubmit={handleAnalyze} 
          isLoading={analyzeMutation.isPending} 
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-card flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg">Provocations</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            data-testid="button-reset"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            New Analysis
          </Button>
          <ThemeToggle />
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <LensesPanel
              lenses={lenses}
              activeLens={activeLens}
              onSelectLens={setActiveLens}
              isLoading={analyzeMutation.isPending}
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={45} minSize={30}>
            <ReadingPane
              text={document?.rawText || ""}
              activeLens={activeLens}
              lensSummary={activeLensSummary}
              onTextChange={handleDocumentTextChange}
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={35} minSize={25}>
            <div className="h-full flex flex-col">
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
                    isLoading={analyzeMutation.isPending}
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
    </div>
  );
}
