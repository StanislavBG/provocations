import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Target,
  PenLine,
  PencilLine,
  Check,
  ChevronDown,
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
} from "lucide-react";
import { ProvokeText } from "@/components/ProvokeText";
import { apiRequest } from "@/lib/queryClient";
import { DraftQuestionsPanel } from "@/components/DraftQuestionsPanel";
import { ContextCapturePanel } from "@/components/ContextCapturePanel";
import { ContextStatusPanel } from "@/components/ContextStatusPanel";
import { StepProgressBar } from "@/components/StepProgressBar";
import { prebuiltTemplates, TEMPLATE_CATEGORIES, type PrebuiltTemplate, type TemplateCategory } from "@/lib/prebuiltTemplates";
import { AppTileCarousel } from "@/components/AppTileCarousel";
import { useAppFavorites } from "@/hooks/use-app-favorites";
import type { ReferenceDocument, ContextItem } from "@shared/schema";
import { generateId } from "@/lib/utils";


interface TextInputFormProps {
  onSubmit: (text: string, objective: string, referenceDocuments: ReferenceDocument[], templateId?: string) => void;
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

export function TextInputForm({ onSubmit, onBlankDocument, onStreamingMode, onVoiceCaptureMode, onYouTubeInfographicMode, onVoiceInfographicMode, isLoading, capturedContext, onCapturedContextChange, onTemplateSelect }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");

  // Prebuilt template state
  const [activePrebuilt, setActivePrebuilt] = useState<PrebuiltTemplate | null>(null);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [isCustomObjective, setIsCustomObjective] = useState(false);

  // Category tab state for grouping templates
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("build");

  // Auto-record flag: set when user clicks mic in context area
  const [autoRecordDraft, setAutoRecordDraft] = useState(false);

  // App favorites & ratings (localStorage)
  const { favorites, ratings, toggleFavorite, setRating } = useAppFavorites();

  // Ref for scrolling back to top on selection
  const stepOneRef = useRef<HTMLDivElement>(null);


  const handleSubmit = () => {
    if (text.trim()) {
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
        : (objective.trim() || "Create a compelling, well-structured document");
      onSubmit(text.trim(), effectiveObjective, referenceDocuments, activePrebuilt?.id);
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

    setCardsExpanded(false);
  };

  const handleSelectCustom = () => {
    setActivePrebuilt(null);
    setIsCustomObjective(true);
    onTemplateSelect?.("custom");

    setObjective("");
    setCardsExpanded(false);
  };

  const handleChangeType = () => {
    setCardsExpanded(true);
    requestAnimationFrame(() => {
      stepOneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
      <div className={`w-full mx-auto flex flex-col flex-1 min-h-0 px-3 md:px-6 py-4 gap-3 ${
        hasObjectiveType ? "overflow-y-auto" : "overflow-hidden"
      } ${isWritePrompt ? "" : "max-w-6xl"}`}>

        {/* ── STEP ONE: Your objective ── */}
        <div className="shrink-0 space-y-2" ref={stepOneRef}>
          {/* Hide heading when write-a-prompt is selected (AIM description replaces it below) */}
          {!(isWritePrompt && !cardsExpanded) && (
            <h2 className="text-base font-semibold">
              What do <em>you</em> want to create?
            </h2>
          )}

          {/* Category tab bar + filtered template chips */}
          {((!activePrebuilt && !isCustomObjective) || cardsExpanded) && (
            <div className="space-y-2">
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
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {prebuiltTemplates
                  .filter((t) => t.category === activeCategory)
                  .map((template) => {
                    const Icon = template.icon;
                    const isActive = activePrebuilt?.id === template.id;

                    return (
                      <button
                        key={template.id}
                        onClick={() => handleSelectPrebuilt(template)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150 ${
                          isActive
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium"
                            : "border-border hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        <span>{template.title}</span>
                        {isActive && <Check className="w-3 h-3 text-primary" />}
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
          )}

          {/* Collapsed selection indicator */}
          {hasObjectiveType && !cardsExpanded && (
            <button
              onClick={handleChangeType}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-sm hover:bg-primary/10 transition-colors"
            >
              {activePrebuilt ? (
                <>
                  {(() => { const I = activePrebuilt.icon; return <I className="w-4 h-4 text-primary" />; })()}
                  <span className="font-medium">{activePrebuilt.title}</span>
                </>
              ) : (
                <>
                  <PenLine className="w-4 h-4 text-primary" />
                  <span className="font-medium">Custom</span>
                  {objective && <span className="text-muted-foreground truncate max-w-[200px]">&mdash; {objective}</span>}
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            </button>
          )}

          {/* Custom objective input */}
          {isCustomObjective && (
            <ProvokeText
              chrome="container"
              label="Your objective"
              labelIcon={Target}
              description="Describe what you're creating — this is your intent, in your words."
              id="objective"
              data-testid="input-objective"
              placeholder="A persuasive investor pitch... A technical design doc... A team announcement..."
              className="text-sm leading-relaxed font-serif"
              value={objective}
              onChange={setObjective}
              minRows={2}
              maxRows={3}
              autoFocus
              voice={{ mode: "replace" }}
              onVoiceTranscript={setObjective}
              textProcessor={(text, mode) =>
                processText(text, mode, mode === "clean" ? "objective" : undefined)
              }
            />
          )}
        </div>

        {/* ── APP TILE CAROUSEL — fills bottom 2/3 when no template selected ── */}
        {!hasObjectiveType && (
          <div className="flex-1 min-h-0 flex flex-col justify-start pt-2">
            <AppTileCarousel
              templates={prebuiltTemplates}
              favorites={favorites}
              ratings={ratings}
              onSelect={handleSelectPrebuilt}
              onToggleFavorite={toggleFavorite}
              onRate={setRating}
            />
          </div>
        )}

        {/* ── STEP TWO: Your context ── */}
        {hasObjectiveType && (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {/* Heading — hidden for write-a-prompt (label is inside the container) */}
          {isWritePrompt ? null : (
            <h2 className="shrink-0 text-base font-semibold">
              {activePrebuilt?.id === "streaming"
                ? "Describe what you're capturing requirements for"
                : activePrebuilt?.id === "voice-capture"
                  ? "Describe what you're recording"
                  : activePrebuilt?.id === "youtube-to-infographic"
                    ? "Enter a YouTube channel to extract insights"
                    : activePrebuilt?.id === "voice-to-infographic"
                      ? "Paste or upload your voice transcript"
                      : "Provide your starting material"}
            </h2>
          )}

          {activePrebuilt?.id === "voice-capture" && onVoiceCaptureMode ? (
            <div className="space-y-3">
              <ProvokeText
                chrome="container"
                label="Session topic"
                labelIcon={Target}
                description="What is this recording session about? Meeting notes, brainstorm, interview, etc."
                id="voice-capture-objective"
                placeholder="Team standup meeting... Product brainstorm... User interview..."
                className="text-sm leading-relaxed font-serif"
                value={objective}
                onChange={setObjective}
                minRows={2}
                maxRows={4}
                autoFocus
                voice={{ mode: "replace" }}
                onVoiceTranscript={setObjective}
                textProcessor={(text, mode) =>
                  processText(text, mode, mode === "clean" ? "objective" : undefined)
                }
              />

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
              <ProvokeText
                chrome="container"
                label="What insights are you looking for?"
                labelIcon={Target}
                description="Describe the kind of content you want to extract — tips, tutorials, strategies, etc."
                id="youtube-objective"
                placeholder="Extract key productivity tips... Summarize tech tutorials... Capture marketing strategies..."
                className="text-sm leading-relaxed font-serif"
                value={objective}
                onChange={setObjective}
                minRows={2}
                maxRows={4}
                autoFocus
                voice={{ mode: "replace" }}
                onVoiceTranscript={setObjective}
                textProcessor={(text, mode) =>
                  processText(text, mode, mode === "clean" ? "objective" : undefined)
                }
              />

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
          ) : activePrebuilt?.id === "voice-to-infographic" && onVoiceInfographicMode ? (
            <div className="space-y-3">
              <ProvokeText
                chrome="container"
                label="What is this transcript about?"
                labelIcon={Target}
                description="Describe the session — meeting, lecture, interview — so the summary captures the right focus."
                id="voice-infographic-objective"
                placeholder="Team product review meeting... Guest lecture on AI... User research interview..."
                className="text-sm leading-relaxed font-serif"
                value={objective}
                onChange={setObjective}
                minRows={2}
                maxRows={4}
                autoFocus
                voice={{ mode: "replace" }}
                onVoiceTranscript={setObjective}
                textProcessor={(text, mode) =>
                  processText(text, mode, mode === "clean" ? "objective" : undefined)
                }
              />

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
              <ProvokeText
                chrome="container"
                label="Objective"
                labelIcon={Target}
                description="Describe what you're capturing — a feature, a flow, an existing screen you want to improve."
                id="streaming-objective"
                placeholder="Capture requirements for a checkout flow... Document enhancements to the dashboard..."
                className="text-sm leading-relaxed font-serif"
                value={objective}
                onChange={setObjective}
                minRows={2}
                maxRows={4}
                autoFocus
                voice={{ mode: "replace" }}
                onVoiceTranscript={setObjective}
                textProcessor={(text, mode) =>
                  processText(text, mode, mode === "clean" ? "objective" : undefined)
                }
              />

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
                />
              )}
              {renderContextSection()}
            </div>
          </div>
          )}
        </div>
        )}
      </div>

      {/* Fixed bottom bar: step progress + action */}
      {hasObjectiveType && activePrebuilt?.id !== "streaming" && activePrebuilt?.id !== "youtube-to-infographic" && activePrebuilt?.id !== "voice-to-infographic" && (
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
              disabled={!text.trim() || isLoading}
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
