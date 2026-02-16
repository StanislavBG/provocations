import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Target,
  PenLine,
  PencilLine,
  ClipboardList,
  Rocket,
  GraduationCap,
  BarChart3,
  Clapperboard,
  Check,
  ChevronDown,
  Crosshair,
  Radio,
  NotebookPen,
  UserRoundCog,
  Layers,
  Globe,
} from "lucide-react";
import { ProvokeText } from "@/components/ProvokeText";
import type { SmartModeDef } from "@/components/ProvokeText";
import { apiRequest } from "@/lib/queryClient";
import { DraftQuestionsPanel } from "@/components/DraftQuestionsPanel";
import { ContextCapturePanel } from "@/components/ContextCapturePanel";
import { ContextStatusPanel } from "@/components/ContextStatusPanel";
import { prebuiltTemplates, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";
import type { ReferenceDocument, ContextItem } from "@shared/schema";
import { generateId } from "@/lib/utils";


interface TextInputFormProps {
  onSubmit: (text: string, objective: string, referenceDocuments: ReferenceDocument[]) => void;
  onBlankDocument?: (objective: string) => void;
  onStreamingMode?: (objective: string, websiteUrl?: string) => void;
  isLoading?: boolean;
  /** Captured context items (managed by parent for persistence) */
  capturedContext: ContextItem[];
  onCapturedContextChange: (items: ContextItem[]) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "pencil-line": PencilLine,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
  radio: Radio,
  "graduation-cap": GraduationCap,
  "bar-chart-3": BarChart3,
  clapperboard: Clapperboard,
  "user-round-cog": UserRoundCog,
};

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

export function TextInputForm({ onSubmit, onBlankDocument, onStreamingMode, isLoading, capturedContext, onCapturedContextChange }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");

  // Prebuilt template state
  const [activePrebuilt, setActivePrebuilt] = useState<PrebuiltTemplate | null>(null);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [isCustomObjective, setIsCustomObjective] = useState(false);

  // Auto-record flag: set when user clicks mic in context area
  const [autoRecordDraft, setAutoRecordDraft] = useState(false);

  // Ref for scrolling back to top on selection
  const stepOneRef = useRef<HTMLDivElement>(null);

  // AIM smart mode — shown only when "Write a Prompt" template is active
  const aimSmartModes = useMemo<SmartModeDef[]>(
    () =>
      activePrebuilt?.id === "write-a-prompt"
        ? [
            {
              mode: "aim",
              label: "Apply AIM",
              loadingLabel: "Applying AIM...",
              description:
                "Restructure your draft using the AIM framework — Actor (who the AI should be), Input (context you're providing), Mission (what it should do).",
              icon: Crosshair,
            },
          ]
        : [],
    [activePrebuilt?.id],
  );

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
      onSubmit(text.trim(), objective.trim() || "Create a compelling, well-structured document", referenceDocuments);
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

    setCardsExpanded(false);
  };

  const handleSelectCustom = () => {
    setActivePrebuilt(null);
    setIsCustomObjective(true);

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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 min-h-0 px-6 py-4 gap-3">

        {/* ── STEP ONE: Your objective ── */}
        <div className="shrink-0 space-y-2" ref={stepOneRef}>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <h2 className="text-base font-semibold">
              What do <em>you</em> want to create?
            </h2>
          </div>

          {/* Compact chip grid — always visible unless a selection collapses it */}
          {((!activePrebuilt && !isCustomObjective) || cardsExpanded) && (
            <div className="flex flex-wrap gap-2">
              {prebuiltTemplates.map((template) => {
                const Icon = iconMap[template.icon] || PencilLine;
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

              {/* "Custom" chip */}
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
          )}

          {/* Collapsed selection indicator */}
          {hasObjectiveType && !cardsExpanded && (
            <button
              onClick={handleChangeType}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-sm hover:bg-primary/10 transition-colors"
            >
              {activePrebuilt ? (
                <>
                  {(() => { const I = iconMap[activePrebuilt.icon] || PencilLine; return <I className="w-4 h-4 text-primary" />; })()}
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

        {/* ── STEP TWO: Your context ── */}
        {hasObjectiveType && (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          <div className="shrink-0 flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <h2 className="text-base font-semibold">
              {activePrebuilt?.id === "streaming"
                ? "Describe what you're capturing requirements for"
                : "Share your thinking — notes, ideas, or speak your mind"}
            </h2>
          </div>

          {activePrebuilt?.id === "streaming" && onStreamingMode ? (
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
          <div className="flex flex-1 min-h-0 gap-4">
            {/* Left column: draft questions + supporting context + context status */}
            <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0 overflow-y-auto">
              {activePrebuilt?.draftQuestions && activePrebuilt.draftQuestions.length > 0 && (
                <DraftQuestionsPanel
                  questions={activePrebuilt.draftQuestions}
                  onResponse={handleDraftQuestionResponse}
                />
              )}

              {/* Context capture area */}
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

              {/* Context status — directly under capture */}
              <ContextStatusPanel items={capturedContext} />
            </div>

            {/* Right column: main text area (hero) */}
            <ProvokeText
              chrome="container"
              label="Your context"
              labelIcon={NotebookPen}
              description="Your notes, references, or spoken thoughts — we'll shape them into a first draft."
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
              extraSmartModes={aimSmartModes}
              showCharCount
              maxCharCount={10000}
              maxAudioDuration="5min"
            />
          </div>
          )}
        </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      {hasObjectiveType && activePrebuilt?.id !== "streaming" && (
        <div className="shrink-0 border-t bg-card px-6 py-2">
          <div className="w-full max-w-6xl mx-auto flex items-center justify-end gap-3">
            <Button
              data-testid="button-analyze"
              onClick={handleSubmit}
              disabled={!text.trim() || isLoading}
              size="lg"
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating first draft...
                </>
              ) : (
                <>
                  Create First Draft
                  <PenLine className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
