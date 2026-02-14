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
} from "lucide-react";
import { ProvokeText } from "@/components/ProvokeText";
import type { SmartModeDef } from "@/components/ProvokeText";
import { apiRequest } from "@/lib/queryClient";
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
    setText(template.starterText);
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

  return (
    <div className="h-full flex flex-col">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-0 overflow-y-auto p-6 gap-8">

        {/* ── STEP ONE: What type of document are you creating? ── */}
        <div className="space-y-4" ref={stepOneRef}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </div>
            <h2 className="text-xl font-semibold">
              What type of document are you creating?
            </h2>
          </div>

          {/* Compact selected indicator — visible when a preset is chosen and grid is collapsed */}
          {activePrebuilt && !cardsExpanded && (
            <button
              onClick={handleChangeType}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-primary bg-primary/5 ring-2 ring-primary/20 text-left transition-all hover:bg-primary/10"
            >
              <div className="p-2 rounded-lg bg-primary/20">
                {(() => { const I = iconMap[activePrebuilt.icon] || PencilLine; return <I className="w-5 h-5 text-primary" />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-base">{activePrebuilt.title}</span>
                <span className="text-sm text-muted-foreground ml-2">{activePrebuilt.subtitle}</span>
              </div>
              <div className="p-1 rounded-full bg-primary mr-1">
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                Change <ChevronDown className="w-4 h-4" />
              </span>
            </button>
          )}

          {/* Compact indicator for custom objective */}
          {isCustomObjective && !activePrebuilt && !cardsExpanded && (
            <button
              onClick={handleChangeType}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-primary bg-primary/5 ring-2 ring-primary/20 text-left transition-all hover:bg-primary/10"
            >
              <div className="p-2 rounded-lg bg-primary/20">
                <PenLine className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-base">Custom Objective</span>
                {objective && (
                  <span className="text-sm text-muted-foreground ml-2 truncate">{objective.slice(0, 60)}{objective.length > 60 ? "..." : ""}</span>
                )}
              </div>
              <div className="p-1 rounded-full bg-primary mr-1">
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                Change <ChevronDown className="w-4 h-4" />
              </span>
            </button>
          )}

          {/* Full card grid */}
          {((!activePrebuilt && !isCustomObjective) || cardsExpanded) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {prebuiltTemplates.map((template) => {
                const Icon = iconMap[template.icon] || PencilLine;
                const isActive = activePrebuilt?.id === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectPrebuilt(template)}
                    className={`group relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      isActive
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isActive ? "bg-primary/20" : "bg-primary/10"}`}>
                          <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-primary/70"}`} />
                        </div>
                        <div>
                          <span className="font-semibold text-sm block">{template.title}</span>
                          <span className="text-xs text-muted-foreground">{template.subtitle}</span>
                        </div>
                        {isActive && (
                          <div className="ml-auto p-1 rounded-full bg-primary">
                            <Check className="w-3.5 h-3.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* "Type Your Own" card */}
              <button
                onClick={handleSelectCustom}
                className={`group relative text-left p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
                  isCustomObjective
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isCustomObjective ? "bg-primary/20" : "bg-primary/10"}`}>
                      <PenLine className={`w-5 h-5 ${isCustomObjective ? "text-primary" : "text-primary/70"}`} />
                    </div>
                    <div>
                      <span className="font-semibold text-sm block">Type Your Own</span>
                      <span className="text-xs text-muted-foreground">Custom objective</span>
                    </div>
                    {isCustomObjective && (
                      <div className="ml-auto p-1 rounded-full bg-primary">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    Have something specific in mind? Write your own objective and we'll provoke your thinking from there.
                  </p>
                </div>
              </button>

            </div>
          )}

          {/* Custom objective — ProvokeText with textProcessor handles everything */}
          {isCustomObjective && (
            <ProvokeText
              chrome="container"
              label="Your objective"
              labelIcon={Target}
              description="Describe what you're creating — be as specific or broad as you like."
              id="objective"
              data-testid="input-objective"
              placeholder="A persuasive investor pitch... A technical design doc... A team announcement..."
              className="text-base leading-relaxed font-serif"
              value={objective}
              onChange={setObjective}
              minRows={3}
              maxRows={6}
              autoFocus
              voice={{ mode: "replace" }}
              onVoiceTranscript={setObjective}
              textProcessor={(text, mode) =>
                processText(text, mode, mode === "clean" ? "objective" : undefined)
              }
            />
          )}

        </div>

        {/* ── STEP TWO: Draft ── */}
        <div className="flex flex-col min-h-0 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </div>
            <h2 className="text-xl font-semibold">
              {activePrebuilt?.id === "streaming"
                ? "Describe what you're exploring, then start"
                : "Add your draft, notes, or rough thoughts — we'll iterate together"}
            </h2>
          </div>
          {activePrebuilt?.id === "streaming" && onStreamingMode ? (
            <div className="space-y-4">
              <ProvokeText
                chrome="container"
                label="Objective"
                labelIcon={Target}
                description="Describe the website or feature you're writing requirements for."
                id="streaming-objective"
                placeholder="Write requirements for an e-commerce checkout flow... Redesign the user profile page..."
                className="text-base leading-relaxed font-serif"
                value={objective}
                onChange={setObjective}
                minRows={3}
                maxRows={6}
                autoFocus
                voice={{ mode: "replace" }}
                onVoiceTranscript={setObjective}
                textProcessor={(text, mode) =>
                  processText(text, mode, mode === "clean" ? "objective" : undefined)
                }
              />

              <Button
                onClick={() => onStreamingMode(objective.trim() || "Discover and refine requirements for a website")}
                disabled={isLoading}
                size="lg"
                className="w-full gap-2"
              >
                <Radio className="w-4 h-4" />
                Start Streaming Workspace
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 gap-3">
              <ProvokeText
                chrome="container"
                label="Your content"
                labelIcon={PenLine}
                containerClassName="flex-1 min-h-0 flex flex-col"
                data-testid="input-source-text"
                placeholder="Paste your notes, transcript, or source material here..."
                className="text-base leading-relaxed font-serif min-h-[200px]"
                value={text}
                onChange={setText}
                minRows={12}
                maxRows={40}
                autoFocus
                voice={{ mode: "append" }}
                onVoiceTranscript={(transcript) =>
                  setText((prev) => (prev ? prev + " " + transcript : transcript))
                }
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
      </div>

      {/* Fixed bottom action bar */}
      {activePrebuilt?.id !== "streaming" && (
        <div className="shrink-0 border-t bg-card px-6 py-3">
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
                  Analyzing...
                </>
              ) : (
                <>
                  Begin Analysis
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
