import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Target,
  PenLine,
  PencilLine,
  Check,
  Crosshair,
  Radio,
  NotebookPen,
  Layers,
  Globe,
  Wand2,
  Mic,
  Youtube,
  FileAudio,
  Upload,
  Sparkles,
  HardDrive,
  FileText,
  Loader2,
} from "lucide-react";
import { ProvokeText, type ProvokeAction } from "@/components/ProvokeText";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DraftQuestionsPanel } from "@/components/DraftQuestionsPanel";
import { ContextCapturePanel } from "@/components/ContextCapturePanel";
import { ContextStatusPanel } from "@/components/ContextStatusPanel";
import { StepProgressBar } from "@/components/StepProgressBar";
import { prebuiltTemplates, TEMPLATE_CATEGORIES, type PrebuiltTemplate, type TemplateCategory } from "@/lib/prebuiltTemplates";
import { getObjectiveConfig } from "@/lib/appWorkspaceConfig";
import { AppTileCarousel } from "@/components/AppTileCarousel";
import { useAppFavorites } from "@/hooks/use-app-favorites";
import type { ReferenceDocument, ContextItem } from "@shared/schema";
import { generateId } from "@/lib/utils";


interface TextInputFormProps {
  onSubmit: (text: string, objective: string, referenceDocuments: ReferenceDocument[], templateId?: string, secondaryObjective?: string) => void;
  onBlankDocument?: (objective: string) => void;
  onStreamingMode?: (objective: string, websiteUrl?: string, templateId?: string) => void;
  onVoiceCaptureMode?: (objective: string, templateId?: string) => void;
  onYouTubeInfographicMode?: (objective: string, channelUrl: string, templateId: string) => void;
  onVoiceInfographicMode?: (objective: string, transcript: string, templateId: string) => void;
  isLoading?: boolean;
  /** Captured context items (managed by parent for persistence) */
  capturedContext: ContextItem[];
  onCapturedContextChange: (items: ContextItem[]) => void;
  /** Notifies parent when a template is selected (for StepTracker) */
  onTemplateSelect?: (templateId: string | null) => void;
  /** Parent-controlled template ID — when set to null the form resets to the carousel */
  selectedTemplateId?: string | null;
}

/**
 * Shared text processor that calls `/api/summarize-intent`.
 * Maps the ProvokeText `mode` to the API's `context` parameter.
 */
async function processText(
  text: string,
  mode: string,
  contextOverride?: string,
): Promise<string> {
  const context = contextOverride ?? "source";
  const response = await apiRequest("POST", "/api/summarize-intent", {
    transcript: text,
    context,
    mode,
  });
  const data = await response.json();
  return data.summary ?? text;
}

export function TextInputForm({ onSubmit, onBlankDocument, onStreamingMode, onVoiceCaptureMode, onYouTubeInfographicMode, onVoiceInfographicMode, isLoading, capturedContext, onCapturedContextChange, onTemplateSelect, selectedTemplateId }: TextInputFormProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");
  const [secondaryObjective, setSecondaryObjective] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");

  // Prebuilt template state
  const [activePrebuilt, setActivePrebuilt] = useState<PrebuiltTemplate | null>(null);
  const [isCustomObjective, setIsCustomObjective] = useState(false);

  // Reset internal form state when parent clears the template (e.g. "New" button)
  useEffect(() => {
    if (selectedTemplateId === null) {
      setActivePrebuilt(null);
      setIsCustomObjective(false);
      setText("");
      setObjective("");
      setSecondaryObjective("");
      setCaptureUrl("");
      setYoutubeChannelUrl("");
      setVoiceTranscript("");
      setActiveCategory("build");
    }
  }, [selectedTemplateId]);

  // Storage quick-load state
  const [storageOpen, setStorageOpen] = useState(false);
  const [objectiveStoreOpen, setObjectiveStoreOpen] = useState(false);
  const [transcriptStoreOpen, setTranscriptStoreOpen] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<number | null>(null);

  // Objective config for current template
  const objConfig = getObjectiveConfig(activePrebuilt?.id);

  // Category tab state for grouping templates
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("build");

  // Auto-record flag: set when user clicks mic in context area
  const [autoRecordDraft, setAutoRecordDraft] = useState(false);

  // App favorites & ratings (localStorage)
  const { favorites, ratings, toggleFavorite, setRating } = useAppFavorites();

  // Ref for scrolling back to top on selection
  const stepOneRef = useRef<HTMLDivElement>(null);

  // ── Storage quick-load: fetch saved documents list ──
  // Track which documents have been loaded from the context store
  const [loadedDocIds, setLoadedDocIds] = useState<Set<number>>(new Set());

  const { data: savedDocs, isLoading: isLoadingDocs } = useQuery<{ documents: { id: number; title: string; updatedAt: string }[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: storageOpen || objectiveStoreOpen || transcriptStoreOpen, // fetch when any popover opens
    staleTime: 30_000,
  });

  /** Load a document from Context Store into the objective field (replace) */
  const handleLoadObjectiveFromStore = useCallback(async (docId: number, docTitle: string) => {
    setLoadingDocId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      if (data.content) {
        setObjective(data.content);
        setObjectiveStoreOpen(false);
        toast({ title: "Loaded", description: `"${docTitle}" loaded into ${objConfig.primaryLabel.toLowerCase()}.` });
      }
    } catch (error) {
      console.error("Failed to load document:", error);
      toast({ title: "Load failed", description: "Could not load the document.", variant: "destructive" });
    } finally {
      setLoadingDocId(null);
    }
  }, [toast, objConfig.primaryLabel]);

  /** Load a document from Context Store into the voice transcript field (replace) */
  const handleLoadTranscriptFromStore = useCallback(async (docId: number, docTitle: string) => {
    setLoadingDocId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      if (data.content) {
        setVoiceTranscript(data.content);
        setTranscriptStoreOpen(false);
        toast({ title: "Loaded", description: `"${docTitle}" loaded into voice transcript.` });
      }
    } catch (error) {
      console.error("Failed to load document:", error);
      toast({ title: "Load failed", description: "Could not load the document.", variant: "destructive" });
    } finally {
      setLoadingDocId(null);
    }
  }, [toast]);

  const handleLoadStorageDoc = useCallback(async (docId: number, docTitle: string) => {
    setLoadingDocId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      if (data.content) {
        setText((prev) => prev ? prev + "\n\n---\n\n" + data.content : data.content);
        setLoadedDocIds((prev) => new Set(prev).add(docId));
        toast({ title: "Context loaded", description: `"${docTitle}" added as starting material.` });
      }
    } catch (error) {
      console.error("Failed to load document:", error);
      toast({ title: "Load failed", description: "Could not load the document.", variant: "destructive" });
    } finally {
      setLoadingDocId(null);
    }
  }, [toast]);

  /** Load a text file (.txt, .md, .csv, .json) from disk into the context textarea */
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string" && content.trim()) {
        setText((prev) => prev ? prev + "\n\n---\n\n" + content : content);
        toast({ title: "File loaded", description: `"${file.name}" added as starting material.` });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  const handleSubmit = () => {
    if (text.trim() || loadedDocIds.size > 0) {
      const referenceDocuments: ReferenceDocument[] = [];
      if (activePrebuilt?.templateContent) {
        referenceDocuments.push({
          id: generateId("ref"),
          name: `Template: ${activePrebuilt.title}`,
          content: activePrebuilt.templateContent,
          type: "template",
        });
      }
      const effectiveObjective = isWritePrompt
        ? "Reformat and structure this draft into a clear, effective prompt using the AIM framework (Actor, Input, Mission). Preserve the user's intent while organizing it into the three AIM sections."
        : (objective.trim() || text.trim().slice(0, 500) || "Create a compelling, well-structured document");
      onSubmit(text.trim(), effectiveObjective, referenceDocuments, activePrebuilt?.id, secondaryObjective.trim() || undefined);
    }
  };

  const handleSelectPrebuilt = (template: PrebuiltTemplate) => {
    setObjective(template.objective);
    if (!template.draftQuestions?.length) {
      setText(template.starterText);
    } else {
      setText("");
    }
    setActivePrebuilt(template);
    setIsCustomObjective(false);
    setActiveCategory(template.category);
    onTemplateSelect?.(template.id);
  };

  const handleSelectCustom = () => {
    setActivePrebuilt(null);
    setIsCustomObjective(true);
    onTemplateSelect?.("custom");
    setObjective("");
  };

  const handleDraftQuestionResponse = (question: string, response: string) => {
    const entry = `[${question}]\n${response}`;
    setText((prev) => (prev ? prev + "\n\n" + entry : entry));
  };

  // Whether step 1 is complete (user picked a type)
  const hasObjectiveType = !!(activePrebuilt || isCustomObjective);
  const isWritePrompt = activePrebuilt?.id === "write-a-prompt" && hasObjectiveType;

  // Shared context section — rendered in left column (default) or right column (write-a-prompt)
  const renderContextSection = () => (
    <>
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Supporting Context
          </span>
        </div>
        <ContextCapturePanel
          items={capturedContext}
          onItemsChange={onCapturedContextChange}
        />
      </div>
      <ContextStatusPanel items={capturedContext} />
    </>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── LANDING PAGE: horizontal layout when no template selected ── */}
      {!hasObjectiveType ? (
        <div className="w-full h-full flex flex-col md:flex-row overflow-x-auto overflow-y-hidden">
          {/* Left panel: heading + category tabs + template chips */}
          <div className="shrink-0 w-full md:w-80 lg:w-96 flex flex-col gap-3 px-4 md:px-6 py-4 md:border-r overflow-y-auto" ref={stepOneRef}>
            <h2 className="text-base font-semibold">
              What do <em>you</em> want to create?
            </h2>

            {/* Category tabs */}
            <div className="flex items-center gap-1 border-b">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeCategory === cat.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  title={cat.description}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Filtered template chips */}
            <div className="flex flex-col gap-2">
              {prebuiltTemplates
                .filter((t) => t.category === activeCategory)
                .map((template) => {
                  const Icon = template.icon;
                  const isActive = activePrebuilt?.id === template.id;
                  const isComingSoon = !!template.comingSoon;
                  const isExternal = !!template.externalUrl;

                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        if (isComingSoon) return;
                        if (isExternal) {
                          window.open(template.externalUrl, "_blank", "noopener,noreferrer");
                          return;
                        }
                        handleSelectPrebuilt(template);
                      }}
                      disabled={isComingSoon}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150 ${
                        isComingSoon
                          ? "opacity-50 cursor-default border-border"
                          : isActive && !isExternal
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium"
                            : "border-border hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive && !isExternal ? "text-primary" : "text-muted-foreground"}`} />
                      <span>{template.title}</span>
                      {isComingSoon && <span className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold ml-1">Soon</span>}
                      {isExternal && !isComingSoon && <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold ml-1">External</span>}
                      {isActive && !isComingSoon && !isExternal && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}

              {/* "Custom" chip — shown in every category */}
              <button
                onClick={handleSelectCustom}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-sm transition-all duration-150 ${
                  isCustomObjective
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <PenLine className={`w-4 h-4 shrink-0 ${isCustomObjective ? "text-primary" : "text-muted-foreground"}`} />
                <span>Custom</span>
                {isCustomObjective && <Check className="w-3 h-3 text-primary" />}
              </button>
            </div>
          </div>

          {/* Right panel: 3 rotating app panels */}
          <div className="flex-1 min-w-0 flex flex-col px-4 md:px-6 py-4">
            <AppTileCarousel
              templates={prebuiltTemplates}
              favorites={favorites}
              ratings={ratings}
              onSelect={handleSelectPrebuilt}
              onToggleFavorite={toggleFavorite}
              onRate={setRating}
            />
          </div>
        </div>
      ) : (
      <div className={`w-full mx-auto flex flex-col flex-1 min-h-0 px-3 md:px-6 py-4 gap-3 overflow-y-auto ${isWritePrompt ? "" : "max-w-6xl"}`}>

        {/* ── STEP ONE: Your objective (template already selected) ── */}
        <div className="shrink-0 space-y-2" ref={stepOneRef}>
          {/* Heading — hidden for write-a-prompt (AIM description replaces it) */}
          {!isWritePrompt && (
            <h2 className="text-base font-semibold">
              What do <em>you</em> want to create?
            </h2>
          )}

          {/* Objective input — always visible when a template or custom is selected */}
          {hasObjectiveType && (
            <div className="space-y-2">
              <ProvokeText
                chrome="container"
                label={objConfig.primaryLabel}
                labelIcon={Target}
                description={objConfig.primaryDescription ?? "Describe what you're creating — this is your intent, in your words."}
                id="objective"
                data-testid="input-objective"
                placeholder={objConfig.primaryPlaceholder}
                className="text-sm leading-relaxed font-serif"
                value={objective}
                onChange={setObjective}
                minRows={2}
                maxRows={3}
                autoFocus={isCustomObjective}
                voice={{ mode: "replace" }}
                onVoiceTranscript={setObjective}
                textProcessor={(text, mode) =>
                  processText(text, mode, mode === "clean" ? "objective" : undefined)
                }
                showCharCount
                maxCharCount={10000}
                maxAudioDuration="2min"
                headerActions={
                  <Popover open={objectiveStoreOpen} onOpenChange={setObjectiveStoreOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                        <HardDrive className="w-3.5 h-3.5" />
                        Load
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-0">
                      <div className="px-3 py-2 border-b">
                        <p className="text-sm font-medium">Load from Context Store</p>
                        <p className="text-xs text-muted-foreground">Replace {objConfig.primaryLabel.toLowerCase()} with saved content</p>
                      </div>
                      <ScrollArea className="max-h-60">
                        <div className="p-1">
                          {savedDocs?.documents?.length ? savedDocs.documents.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => handleLoadObjectiveFromStore(doc.id, doc.title)}
                              disabled={loadingDocId === doc.id}
                              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1">{doc.title}</span>
                              {loadingDocId === doc.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            </button>
                          )) : (
                            <p className="px-3 py-4 text-sm text-muted-foreground text-center">No saved documents yet</p>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                }
              />

              {/* Secondary objective — shown when the app defines a meaningful secondary label */}
              {objConfig.secondaryDescription && (
                <ProvokeText
                  chrome="container"
                  label={objConfig.secondaryLabel}
                  labelIcon={Crosshair}
                  description={objConfig.secondaryDescription}
                  id="secondary-objective"
                  data-testid="input-secondary-objective"
                  placeholder={objConfig.secondaryPlaceholder}
                  className="text-sm leading-relaxed font-serif"
                  value={secondaryObjective}
                  onChange={setSecondaryObjective}
                  minRows={2}
                  maxRows={3}
                  voice={{ mode: "replace" }}
                  onVoiceTranscript={setSecondaryObjective}
                />
              )}
            </div>
          )}
        </div>

        {/* ── STEP TWO: Your context ── */}
        {hasObjectiveType && (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {/* Step heading removed — step progress bar in footer provides the context */}

          {activePrebuilt?.id === "voice-capture" && onVoiceCaptureMode ? (
            <div className="space-y-3">
              <Button
                onClick={() => onVoiceCaptureMode(
                  objective.trim() || "Voice capture session",
                  activePrebuilt?.id,
                )}
                disabled={isLoading}
                size="lg"
                className="w-full gap-2"
              >
                <Mic className="w-4 h-4" />
                Start Voice Capture
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : activePrebuilt?.id === "youtube-to-infographic" && onYouTubeInfographicMode ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card/50 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    YouTube Channel URL
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a channel URL to fetch the latest videos. The system will extract transcripts, summarize key points, and generate infographic specs automatically.
                </p>
                <input
                  type="url"
                  value={youtubeChannelUrl}
                  onChange={(e) => setYoutubeChannelUrl(e.target.value)}
                  placeholder="https://www.youtube.com/@channel"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                />
              </div>

              <Button
                onClick={() => onYouTubeInfographicMode(
                  objective.trim() || "Transform YouTube video content into structured infographic specifications",
                  youtubeChannelUrl.trim(),
                  activePrebuilt.id,
                )}
                disabled={!youtubeChannelUrl.trim() || isLoading}
                size="lg"
                className="w-full gap-2"
              >
                <Youtube className="w-4 h-4" />
                Fetch Channel & Enter Workspace
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : activePrebuilt?.id === "text-to-infographic" && onVoiceInfographicMode ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card/50 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
                    Voice Transcript
                  </span>
                  <Popover open={transcriptStoreOpen} onOpenChange={setTranscriptStoreOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                        <HardDrive className="w-3.5 h-3.5" />
                        Load
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-0">
                      <div className="px-3 py-2 border-b">
                        <p className="text-sm font-medium">Load from Context Store</p>
                        <p className="text-xs text-muted-foreground">Replace transcript with saved content</p>
                      </div>
                      <ScrollArea className="max-h-60">
                        <div className="p-1">
                          {savedDocs?.documents?.length ? savedDocs.documents.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => handleLoadTranscriptFromStore(doc.id, doc.title)}
                              disabled={loadingDocId === doc.id}
                              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1">{doc.title}</span>
                              {loadingDocId === doc.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            </button>
                          )) : (
                            <p className="px-3 py-4 text-sm text-muted-foreground text-center">No saved documents yet</p>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste the transcript from your voice capture session, or upload a .txt file. The system will summarize key points and generate an infographic specification.
                </p>
                <textarea
                  value={voiceTranscript}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  placeholder="Paste your transcript here..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono min-h-[120px] resize-y"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Upload .txt file
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const content = ev.target?.result;
                        if (typeof content === "string") setVoiceTranscript(content);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              <Button
                onClick={() => onVoiceInfographicMode(
                  objective.trim() || "Transform voice transcript into a structured infographic specification",
                  voiceTranscript.trim(),
                  activePrebuilt.id,
                )}
                disabled={!voiceTranscript.trim() || isLoading}
                size="lg"
                className="w-full gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Summarize & Generate Infographic
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : activePrebuilt?.id === "streaming" && onStreamingMode ? (
            <div className="space-y-3">
              {/* Website URL input */}
              <div className="rounded-lg border bg-card/50 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Website URL
                  </span>
                  <span className="text-xs text-muted-foreground/60">(optional)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Drop a URL to load the site in the capture workspace for live screenshots and analysis.
                </p>
                <input
                  type="url"
                  value={captureUrl}
                  onChange={(e) => setCaptureUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                />
              </div>

              <Button
                onClick={() => onStreamingMode(
                  objective.trim() || "Discover and refine requirements through screen capture and annotations",
                  captureUrl.trim() || undefined,
                  activePrebuilt?.id,
                )}
                disabled={isLoading}
                size="lg"
                className="w-full gap-2"
              >
                <Radio className="w-4 h-4" />
                Start Capture Workspace
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
          <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-4">
            {/* Left column: draft questions (+ context for non-write-a-prompt) — hidden on mobile, shown below text area */}
            <div className="hidden md:flex w-72 shrink-0 flex-col gap-3 min-h-0 overflow-y-auto">
              {activePrebuilt?.draftQuestions && activePrebuilt.draftQuestions.length > 0 && (
                <DraftQuestionsPanel
                  questions={activePrebuilt.draftQuestions}
                  onResponse={handleDraftQuestionResponse}
                  objective={objective}
                  secondaryObjective={secondaryObjective}
                  templateId={activePrebuilt?.id}
                />
              )}

              {/* Context stays in left column for non-write-a-prompt templates */}
              {!isWritePrompt && renderContextSection()}
            </div>

            {/* Center column: main text area (hero) — visible container */}
            {isWritePrompt ? (
              <ProvokeText
                chrome="container"
                label="Your Draft"
                labelIcon={PenLine}
                description="Type or dictate your prompt. It will be reformatted into the AIM framework (Actor, Input, Mission)."
                containerClassName="flex-1 min-h-0 flex flex-col min-w-0"
                data-testid="input-source-text"
                placeholder="Describe what you need the AI to do — who it should be, what context it has, and what output you expect..."
                className="text-sm leading-relaxed font-serif"
                value={text}
                onChange={setText}
                minRows={6}
                maxRows={30}
                autoFocus
                voice={{ mode: "append" }}
                onVoiceTranscript={(transcript) =>
                  setText((prev) => (prev ? prev + " " + transcript : transcript))
                }
                onRecordingChange={(recording) => {
                  if (recording && autoRecordDraft) {
                    setAutoRecordDraft(false);
                  }
                }}
                autoRecord={autoRecordDraft}
                textProcessor={(t, mode) =>
                  processText(t, mode, mode === "clean" ? "source" : undefined)
                }
                showCharCount
                maxCharCount={500000}
                maxAudioDuration="5min"
                headerActions={
                  <div className="flex items-center gap-1">
                    <Popover open={storageOpen} onOpenChange={setStorageOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7"
                          title="Load context from saved documents"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          Load
                          {loadedDocIds.size > 0 && (
                            <span className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                              {loadedDocIds.size}
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 p-0">
                        <div className="px-3 py-2 border-b">
                          <p className="text-sm font-medium">Load from Context Store</p>
                          <p className="text-xs text-muted-foreground">Select documents or upload files</p>
                        </div>
                        <ScrollArea className="max-h-60">
                          {isLoadingDocs ? (
                            <div className="px-3 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading...
                            </div>
                          ) : !savedDocs?.documents?.length ? (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                              No saved documents yet
                            </div>
                          ) : (
                            <div className="py-1">
                              {savedDocs.documents.map((doc) => (
                                <button
                                  key={doc.id}
                                  onClick={() => handleLoadStorageDoc(doc.id, doc.title)}
                                  disabled={loadingDocId !== null || loadedDocIds.has(doc.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                                >
                                  {loadingDocId === doc.id ? (
                                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                                  ) : loadedDocIds.has(doc.id) ? (
                                    <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="truncate flex-1">{doc.title}</span>
                                  {loadedDocIds.has(doc.id) && (
                                    <span className="text-[10px] text-primary font-medium shrink-0">Loaded</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                        <div className="flex items-center justify-between px-3 py-2 border-t">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            Upload file
                            <input
                              type="file"
                              accept=".txt,.md,.text,.csv,.json,.xml,.yaml,.yml,.toml"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setStorageOpen(false)}>
                            Done
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      onClick={() => {
                        const starter = [
                          "## Actor",
                          "You are a [role — e.g. Senior Software Engineer, Professional Chef, Marketing Strategist].",
                          "",
                          "## Input",
                          "[Paste or describe the context here — the longer and more specific, the better the output.]",
                          "",
                          "## Mission",
                          "Create a [specific output — e.g. step-by-step guide, code review, meal plan] that [key quality — e.g. is beginner-friendly, follows best practices, fits a 30-minute time limit].",
                        ].join("\n");
                        setText(starter);
                      }}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Practice
                    </Button>
                  </div>
                }
              />
            ) : (
              <ProvokeText
                chrome="container"
                label="Your context"
                labelIcon={NotebookPen}
                description="Paste notes, references, or use the mic to dictate. This becomes the starting material for your document."
                containerClassName="flex-1 min-h-0 flex flex-col min-w-0"
                data-testid="input-source-text"
                placeholder="Paste your notes or click the mic to speak your ideas..."
                className="text-sm leading-relaxed font-serif"
                value={text}
                onChange={setText}
                minRows={6}
                maxRows={30}
                autoFocus
                voice={{ mode: "append" }}
                onVoiceTranscript={(transcript) =>
                  setText((prev) => (prev ? prev + " " + transcript : transcript))
                }
                onRecordingChange={(recording) => {
                  if (recording && autoRecordDraft) {
                    setAutoRecordDraft(false);
                  }
                }}
                autoRecord={autoRecordDraft}
                textProcessor={(t, mode) =>
                  processText(t, mode, mode === "clean" ? "source" : undefined)
                }
                showCharCount
                maxCharCount={500000}
                maxAudioDuration="5min"
                headerActions={
                  <Popover open={storageOpen} onOpenChange={setStorageOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        title="Load context from saved documents"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        Load
                        {loadedDocIds.size > 0 && (
                          <span className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                            {loadedDocIds.size}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-0">
                      <div className="px-3 py-2 border-b">
                        <p className="text-sm font-medium">Load from Context Store</p>
                        <p className="text-xs text-muted-foreground">Select documents or upload files</p>
                      </div>
                      <ScrollArea className="max-h-60">
                        {isLoadingDocs ? (
                          <div className="px-3 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading...
                          </div>
                        ) : !savedDocs?.documents?.length ? (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            No saved documents yet
                          </div>
                        ) : (
                          <div className="py-1">
                            {savedDocs.documents.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={() => handleLoadStorageDoc(doc.id, doc.title)}
                                disabled={loadingDocId !== null || loadedDocIds.has(doc.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                              >
                                {loadingDocId === doc.id ? (
                                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                                ) : loadedDocIds.has(doc.id) ? (
                                  <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate flex-1">{doc.title}</span>
                                {loadedDocIds.has(doc.id) && (
                                  <span className="text-[10px] text-primary font-medium shrink-0">Loaded</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      <div className="flex items-center justify-between px-3 py-2 border-t">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          Upload file
                          <input
                            type="file"
                            accept=".txt,.md,.text,.csv,.json,.xml,.yaml,.yml,.toml"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setStorageOpen(false)}>
                          Done
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                }
              />
            )}

            {/* Right column: context (only for write-a-prompt) — desktop only */}
            {isWritePrompt && (
              <div className="hidden md:flex w-72 shrink-0 flex-col gap-3 min-h-0 overflow-y-auto">
                {renderContextSection()}
              </div>
            )}

            {/* Mobile: draft questions + context below text area */}
            <div className="flex md:hidden flex-col gap-3 shrink-0">
              {activePrebuilt?.draftQuestions && activePrebuilt.draftQuestions.length > 0 && (
                <DraftQuestionsPanel
                  questions={activePrebuilt.draftQuestions}
                  onResponse={handleDraftQuestionResponse}
                  objective={objective}
                  secondaryObjective={secondaryObjective}
                  templateId={activePrebuilt?.id}
                />
              )}
              {renderContextSection()}
            </div>
          </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Fixed bottom bar: step progress + action */}
      {hasObjectiveType && activePrebuilt?.id !== "streaming" && activePrebuilt?.id !== "youtube-to-infographic" && activePrebuilt?.id !== "text-to-infographic" && (
        <div className="shrink-0 border-t bg-card">
          <div className={`w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 px-3 md:px-6 py-2 ${
            isWritePrompt ? "" : "max-w-6xl"
          }`}>
            <StepProgressBar
              steps={activePrebuilt?.steps ?? [{ id: "context", label: "Share your context" }]}
              currentStep={0}
            />
            <Button
              data-testid="button-analyze"
              onClick={handleSubmit}
              disabled={!(text.trim() || loadedDocIds.size > 0) || isLoading}
              size="lg"
              className="gap-2 shrink-0 w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isWritePrompt ? "Formatting with AIM..." : "Creating first draft..."}
                </>
              ) : (
                <>
                  {isWritePrompt ? "Format as AIM" : "Create First Draft"}
                  {isWritePrompt ? <Crosshair className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
