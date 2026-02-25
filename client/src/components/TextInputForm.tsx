import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { trackEvent } from "@/lib/tracking";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { StoragePanel } from "@/components/StoragePanel";
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
  FileAudio,
  Upload,
  Sparkles,
  HardDrive,
  Save,
  Search,
  BookOpenCheck,
} from "lucide-react";
import { ProvokeText, type ProvokeAction } from "@/components/ProvokeText";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DraftQuestionsPanel } from "@/components/DraftQuestionsPanel";
import { ContextCapturePanel } from "@/components/ContextCapturePanel";
import { ContextStatusPanel } from "@/components/ContextStatusPanel";
import { StepProgressBar } from "@/components/StepProgressBar";
import { prebuiltTemplates, sortTemplatesByUsage, STATUS_LABEL_CONFIG, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";
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
  onVoiceInfographicMode?: (objective: string, transcript: string, templateId: string) => void;
  onResearchChatMode?: (objective: string, researchTopic: string, templateId: string) => void;
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

export function TextInputForm({ onSubmit, onBlankDocument, onStreamingMode, onVoiceCaptureMode, onVoiceInfographicMode, onResearchChatMode, isLoading, capturedContext, onCapturedContextChange, onTemplateSelect, selectedTemplateId }: TextInputFormProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");
  const [secondaryObjective, setSecondaryObjective] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");
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
      setVoiceTranscript("");
    }
  }, [selectedTemplateId]);

  // Storage quick-load state — single load target opens the full StoragePanel
  type LoadTarget = "objective" | "secondary" | "transcript" | "researchTopic" | "storage" | null;
  const [loadTarget, setLoadTarget] = useState<LoadTarget>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  // Objective config for current template
  const objConfig = getObjectiveConfig(activePrebuilt?.id);

  // Auto-record flag: set when user clicks mic in context area
  const [autoRecordDraft, setAutoRecordDraft] = useState(false);

  // App favorites, ratings & usage (localStorage)
  const { favorites, ratings, usage, toggleFavorite, setRating, incrementUsage } = useAppFavorites();

  // Templates sorted by usage, comingSoon/external at bottom
  const sortedTemplates = useMemo(
    () => sortTemplatesByUsage(prebuiltTemplates, usage),
    [usage],
  );

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
    enabled: false, // StoragePanel fetches its own data; keep query for cache sharing
    staleTime: 30_000,
  });

  /** Unified handler for loading a document from the full StoragePanel into the active field */
  const handleStoreLoadDocument = useCallback((doc: { id: number; title: string; content: string }) => {
    switch (loadTarget) {
      case "objective":
        setObjective(doc.content);
        break;
      case "secondary":
        setSecondaryObjective(doc.content);
        break;
      case "transcript":
        setVoiceTranscript(doc.content);
        break;
      case "researchTopic":
        setResearchTopic(doc.content);
        break;
      case "storage":
        setText((prev) => prev ? prev + "\n\n---\n\n" + doc.content : doc.content);
        setLoadedDocIds((prev) => new Set(prev).add(doc.id));
        break;
    }
    setLoadTarget(null);
  }, [loadTarget]);

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


  /** Save field content to Context Store as a new document */
  const handleSaveFieldToStore = useCallback(async (content: string, fieldLabel: string) => {
    if (!content.trim()) {
      toast({ title: "Nothing to save", description: "The field is empty.", variant: "destructive" });
      return;
    }
    setSavingField(fieldLabel);
    try {
      const title = `${fieldLabel}: ${content.trim().slice(0, 80).replace(/\n/g, " ")}`;
      await apiRequest("POST", "/api/documents", { title, content: content.trim() });
      trackEvent("document_saved", { metadata: { source: "field-save" } });
      toast({ title: "Saved to Context Store", description: `"${title.slice(0, 60)}${title.length > 60 ? "..." : ""}" saved.` });
    } catch (error) {
      console.error("Failed to save to store:", error);
      toast({ title: "Save failed", description: "Could not save to Context Store.", variant: "destructive" });
    } finally {
      setSavingField(null);
    }
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
        : (objective.trim() || activePrebuilt?.objective || text.trim().slice(0, 500) || "Create a compelling, well-structured document");
      onSubmit(text.trim(), effectiveObjective, referenceDocuments, activePrebuilt?.id, secondaryObjective.trim() || undefined);
    }
  };

  const handleSelectPrebuilt = (template: PrebuiltTemplate) => {
    trackEvent("template_selected", { templateId: template.id });
    setObjective("");
    if (!template.draftQuestions?.length) {
      setText(template.starterText);
    } else {
      setText("");
    }
    setActivePrebuilt(template);
    setIsCustomObjective(false);
    incrementUsage(template.id);
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
  const isGptToContext = activePrebuilt?.id === "gpt-to-context" && hasObjectiveType;

  // Research topic state (used by gpt-to-context)
  const [researchTopic, setResearchTopic] = useState("");

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
          {/* Left panel: heading + all template chips sorted by usage */}
          <div className="shrink-0 w-full md:w-80 lg:w-96 flex flex-col gap-3 px-4 md:px-6 py-4 md:border-r overflow-y-auto" ref={stepOneRef}>
            <h2 className="text-base font-semibold">
              What do <em>you</em> want to create?
            </h2>

            {/* All templates sorted by usage, comingSoon/external at bottom */}
            <div className="flex flex-col gap-2">
              {sortedTemplates.map((template) => {
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
                    className={`flex w-full items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150 ${
                      isComingSoon
                        ? "opacity-50 cursor-default border-border"
                        : isActive && !isExternal
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium"
                          : "border-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive && !isExternal ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1 text-left">{template.title}</span>
                    {isComingSoon && <span className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold shrink-0">Soon</span>}
                    {isExternal && !isComingSoon && <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold shrink-0">External</span>}
                    {!isComingSoon && !isExternal && template.statusLabel && (
                      <span className={`text-[10px] uppercase tracking-wider font-semibold shrink-0 ${STATUS_LABEL_CONFIG[template.statusLabel].className}`}>
                        {STATUS_LABEL_CONFIG[template.statusLabel].text}
                      </span>
                    )}
                    {isActive && !isComingSoon && !isExternal && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </button>
                );
              })}

              {/* "Custom" chip — always last */}
              <button
                onClick={handleSelectCustom}
                className={`flex w-full items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-sm transition-all duration-150 ${
                  isCustomObjective
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <PenLine className={`w-4 h-4 shrink-0 ${isCustomObjective ? "text-primary" : "text-muted-foreground"}`} />
                <span className="flex-1 text-left">Custom</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold shrink-0 text-blue-600 dark:text-blue-400">Alpha</span>
                {isCustomObjective && <Check className="w-3 h-3 text-primary shrink-0" />}
              </button>
            </div>
          </div>

          {/* Right panel: 3 rotating app panels */}
          <div className="flex-1 min-w-0 flex flex-col px-4 md:px-6 py-4">
            <AppTileCarousel
              templates={prebuiltTemplates}
              favorites={favorites}
              ratings={ratings}
              usage={usage}
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
          {/* Heading — hidden for write-a-prompt and gpt-to-context */}
          {!isWritePrompt && !isGptToContext && (
            <h2 className="text-base font-semibold">
              What do <em>you</em> want to create?
            </h2>
          )}

          {/* Objective input — always visible when a template or custom is selected (hidden for gpt-to-context which has inline inputs) */}
          {hasObjectiveType && !isGptToContext && (
            <div className="space-y-2">
              <ProvokeText
                chrome="container"
                label={objConfig.primaryLabel}
                labelIcon={Target}
                description={objConfig.primaryDescription ?? "Describe what you're creating — this is your intent, in your words."}
                id="objective"
                data-testid="input-objective"
                placeholder={activePrebuilt?.objective || objConfig.primaryPlaceholder}
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
                actions={[
                  {
                    key: "save",
                    label: "Save",
                    description: "Save this content to the Context Store for reuse.",
                    icon: Save,
                    onClick: () => handleSaveFieldToStore(objective, objConfig.primaryLabel),
                    disabled: !objective.trim(),
                    loading: savingField === objConfig.primaryLabel,
                    loadingLabel: "Saving...",
                  },
                  {
                    key: "load",
                    label: "Load",
                    description: "Load content from the Context Store.",
                    icon: HardDrive,
                    onClick: () => { setLoadTarget("objective"); },
                  },
                ]}
              >
              </ProvokeText>

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
                  textProcessor={(t, mode) =>
                    processText(t, mode, mode === "clean" ? "objective" : undefined)
                  }
                  showCharCount
                  maxCharCount={10000}
                  maxAudioDuration="2min"
                  actions={[
                    {
                      key: "save",
                      label: "Save",
                      description: "Save this content to the Context Store for reuse.",
                      icon: Save,
                      onClick: () => handleSaveFieldToStore(secondaryObjective, objConfig.secondaryLabel ?? "Secondary"),
                      disabled: !secondaryObjective.trim(),
                      loading: savingField === (objConfig.secondaryLabel ?? "Secondary"),
                      loadingLabel: "Saving...",
                    },
                    {
                      key: "load",
                      label: "Load",
                      description: "Load content from the Context Store.",
                      icon: HardDrive,
                      onClick: () => { setLoadTarget("secondary"); },
                    },
                  ]}
                >
                </ProvokeText>
              )}
            </div>
          )}
        </div>

        {/* ── GPT to Context: two-field input (What to Research + What is the Objective) ── */}
        {isGptToContext && onResearchChatMode && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full py-4 flex-1">
            <ProvokeText
              chrome="container"
              label="What to Research"
              labelIcon={Search}
              description="Define the topic, domain, or question you want to explore."
              id="research-topic"
              placeholder="e.g. Best practices for building AI-powered search systems, or How do top SaaS companies handle onboarding..."
              className="text-sm leading-relaxed font-serif"
              value={researchTopic}
              onChange={setResearchTopic}
              minRows={2}
              maxRows={5}
              autoFocus
              voice={{ mode: "replace" }}
              onVoiceTranscript={setResearchTopic}
              textProcessor={(text, mode) =>
                processText(text, mode, mode === "clean" ? "objective" : undefined)
              }
              showCharCount
              maxCharCount={5000}
              maxAudioDuration="2min"
              actions={[
                {
                  key: "save",
                  label: "Save",
                  description: "Save this content to the Context Store for reuse.",
                  icon: Save,
                  onClick: () => handleSaveFieldToStore(researchTopic, "What to Research"),
                  disabled: !researchTopic.trim(),
                  loading: savingField === "What to Research",
                  loadingLabel: "Saving...",
                },
                {
                  key: "load",
                  label: "Load",
                  description: "Load content from the Context Store.",
                  icon: HardDrive,
                  onClick: () => { setLoadTarget("researchTopic"); },
                },
              ]}
            >
            </ProvokeText>

            <ProvokeText
              chrome="container"
              label="What is the Objective"
              labelIcon={Target}
              description="What will this research feed into? What outcome are you building toward?"
              id="research-objective"
              placeholder={activePrebuilt?.objective || "e.g. Write a PRD for a search feature, or Prepare a presentation on onboarding best practices..."}
              className="text-sm leading-relaxed font-serif"
              value={objective}
              onChange={setObjective}
              minRows={2}
              maxRows={5}
              voice={{ mode: "replace" }}
              onVoiceTranscript={setObjective}
              textProcessor={(text, mode) =>
                processText(text, mode, mode === "clean" ? "objective" : undefined)
              }
              showCharCount
              maxCharCount={5000}
              maxAudioDuration="2min"
              actions={[
                {
                  key: "save",
                  label: "Save",
                  description: "Save this content to the Context Store for reuse.",
                  icon: Save,
                  onClick: () => handleSaveFieldToStore(objective, "What is the Objective"),
                  disabled: !objective.trim(),
                  loading: savingField === "What is the Objective",
                  loadingLabel: "Saving...",
                },
                {
                  key: "load",
                  label: "Load",
                  description: "Load content from the Context Store.",
                  icon: HardDrive,
                  onClick: () => { setLoadTarget("objective"); },
                },
              ]}
            >
            </ProvokeText>

            <Button
              onClick={() => onResearchChatMode(
                objective.trim() || activePrebuilt?.objective || "Research and context gathering",
                researchTopic.trim() || "General research",
                activePrebuilt!.id,
              )}
              disabled={isLoading || (!researchTopic.trim() && !objective.trim())}
              size="lg"
              className="w-full gap-2"
            >
              <BookOpenCheck className="w-4 h-4" />
              Start Research
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── STEP TWO: Your context (hidden for gpt-to-context which uses inline inputs) ── */}
        {hasObjectiveType && !isGptToContext && (
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
          ) : activePrebuilt?.id === "text-to-infographic" && onVoiceInfographicMode ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card/50 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Voice Transcript
                  </span>
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
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Upload File
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
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setLoadTarget("transcript")}>
                    <HardDrive className="w-3.5 h-3.5" />
                    Load
                  </Button>
                </div>
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
                actions={[
                  {
                    key: "save",
                    label: "Save",
                    description: "Save this content to the Context Store for reuse.",
                    icon: Save,
                    onClick: () => handleSaveFieldToStore(text, "Your Draft"),
                    disabled: !text.trim(),
                    loading: savingField === "Your Draft",
                    loadingLabel: "Saving...",
                  },
                  {
                    key: "load",
                    label: "Load",
                    description: "Load content from the Context Store.",
                    icon: HardDrive,
                    onClick: () => { setLoadTarget("storage"); },
                  },
                ]}
                headerActions={
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
                }
              >
              </ProvokeText>
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
                actions={[
                  {
                    key: "save",
                    label: "Save",
                    description: "Save this content to the Context Store for reuse.",
                    icon: Save,
                    onClick: () => handleSaveFieldToStore(text, "Your context"),
                    disabled: !text.trim(),
                    loading: savingField === "Your context",
                    loadingLabel: "Saving...",
                  },
                  {
                    key: "load",
                    label: "Load",
                    description: "Load content from the Context Store.",
                    icon: HardDrive,
                    onClick: () => { setLoadTarget("storage"); },
                  },
                ]}
              >
              </ProvokeText>
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
      {hasObjectiveType && activePrebuilt?.id !== "streaming" && activePrebuilt?.id !== "text-to-infographic" && activePrebuilt?.id !== "gpt-to-context" && (
        <div className="shrink-0 border-t bg-card">
          <div className={`w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 px-3 md:px-6 py-2 ${
            isWritePrompt ? "" : "max-w-6xl"
          }`}>
            <StepProgressBar
              steps={activePrebuilt?.steps ?? [{ id: "context", label: "Share your context" }]}
              currentStep={0}
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                    {isWritePrompt ? "Convert Prompt to AIM" : "Create First Draft"}
                    {isWritePrompt ? <Crosshair className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Context Store dialog for Load actions */}
      <StoragePanel
        isOpen={!!loadTarget}
        onClose={() => setLoadTarget(null)}
        onLoadDocument={handleStoreLoadDocument}
        onSave={async () => {}}
        hasContent={false}
      />
    </div>
  );
}
