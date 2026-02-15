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
} from "lucide-react";
import { ProvokeText } from "@/components/ProvokeText";
import type { SmartModeDef } from "@/components/ProvokeText";
import { apiRequest } from "@/lib/queryClient";
import { DraftQuestionsPanel } from "@/components/DraftQuestionsPanel";
import { prebuiltTemplates, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";
import type { ReferenceDocument } from "@shared/schema";
import { generateId } from "@/lib/utils";


interface TextInputFormProps {
  onSubmit: (text: string, objective: string, referenceDocuments: ReferenceDocument[]) => void;
  onBlankDocument?: (objective: string) => void;
  onStreamingMode?: (objective: string) => void;
  isLoading?: boolean;
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
  const context = contextOverride ?? mode;
  const response = await apiRequest("POST", "/api/summarize-intent", {
    transcript: text,
    context,
  });
  const data = await response.json();
  return data.summary ?? text;
}

export function TextInputForm({ onSubmit, onBlankDocument, onStreamingMode, isLoading }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");

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
    <div className="h-full flex flex-col">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-0 overflow-y-auto px-6 py-4 gap-5" style={{ scrollbarGutter: "stable" }}>

        {/* ── STEP ONE: Your objective ── */}
        <div className="space-y-3" ref={stepOneRef}>
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
              {prebuiltTemplates.filter((t) => t.id !== "streaming").map((template) => {
                const Icon = iconMap[template.icon] || PencilLine;
                const isActive = activePrebuilt?.id === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectPrebuilt(template)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-150 ${
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
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm transition-all duration-150 ${
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
              maxRows={4}
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
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <h2 className="text-base font-semibold">
              Share your thinking — notes, ideas, or speak your mind
            </h2>
          </div>
          <div className="flex flex-1 min-h-0 gap-3">
              {activePrebuilt?.draftQuestions && activePrebuilt.draftQuestions.length > 0 && (
                <DraftQuestionsPanel
                  questions={activePrebuilt.draftQuestions}
                  onResponse={handleDraftQuestionResponse}
                />
              )}
              <ProvokeText
                chrome="container"
                label="Your context"
                labelIcon={NotebookPen}
                description="Your notes, references, or spoken thoughts — we'll shape them into a first draft."
                containerClassName="flex-1 min-h-0 flex flex-col"
                data-testid="input-source-text"
                placeholder="Paste your notes or click the mic to speak your ideas..."
                className="text-sm leading-relaxed font-serif min-h-[140px]"
                value={text}
                onChange={setText}
                minRows={8}
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
        </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      {hasObjectiveType && (
        <div className="shrink-0 border-t bg-card px-6 py-3" style={{ scrollbarGutter: "stable" }}>
          <div className="w-full max-w-4xl mx-auto flex items-center justify-end gap-3">
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
