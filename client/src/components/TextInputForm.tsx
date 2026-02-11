import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ArrowRight,
  Mic,
  Target,
  Wand2,
  Eye,
  EyeOff,
  PenLine,
  PencilLine,
  ClipboardList,
  Rocket,
  Blocks,
  Check,
} from "lucide-react";
import { SmartTextPanel } from "@/components/SmartTextPanel";
import type { SmartAction } from "@/components/SmartTextPanel";
import { apiRequest } from "@/lib/queryClient";
import { DraftQuestionsPanel } from "@/components/DraftQuestionsPanel";
import { prebuiltTemplates, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";
import type { ReferenceDocument } from "@shared/schema";
import { generateId } from "@/lib/utils";


interface TextInputFormProps {
  onSubmit: (text: string, objective: string, referenceDocuments: ReferenceDocument[]) => void;
  onBlankDocument?: () => void;
  isLoading?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "pencil-line": PencilLine,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
  blocks: Blocks,
};

export function TextInputForm({ onSubmit, onBlankDocument, isLoading }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");

  // Voice input state
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [isRecordingText, setIsRecordingText] = useState(false);

  // Raw transcript storage for "show original"
  const [objectiveRawTranscript, setObjectiveRawTranscript] = useState<string | null>(null);
  const [textRawTranscript, setTextRawTranscript] = useState<string | null>(null);
  const [showObjectiveRaw, setShowObjectiveRaw] = useState(false);
  const [showTextRaw, setShowTextRaw] = useState(false);

  // Summarization state
  const [isSummarizingObjective, setIsSummarizingObjective] = useState(false);
  const [isSummarizingText, setIsSummarizingText] = useState(false);

  // Prebuilt template state
  const [activePrebuilt, setActivePrebuilt] = useState<PrebuiltTemplate | null>(null);

  // Draft section expanded state
  const [isDraftExpanded, setIsDraftExpanded] = useState(false);

  const handleSubmit = () => {
    if (text.trim()) {
      // Build reference documents from template content if applicable
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

  const handleBlankDocument = () => {
    onBlankDocument?.();
  };

  // Handle objective voice transcript
  const handleObjectiveVoiceComplete = (transcript: string) => {
    setObjective(transcript);
    if (transcript.length > 50) {
      setObjectiveRawTranscript(transcript);
    }
  };

  // Handle source text voice transcript
  const handleTextVoiceComplete = (transcript: string) => {
    const newText = text ? text + " " + transcript : transcript;
    setText(newText);
    if (transcript.length > 100) {
      setTextRawTranscript((prev) => prev ? prev + " " + transcript : transcript);
    }
  };

  // Summarize objective transcript
  const handleSummarizeObjective = async () => {
    if (!objective.trim()) return;
    setIsSummarizingObjective(true);
    try {
      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: objective,
        context: "objective",
      });
      const data = await response.json();
      if (data.summary) {
        if (!objectiveRawTranscript) {
          setObjectiveRawTranscript(objective);
        }
        setObjective(data.summary);
      }
    } catch (error) {
      console.error("Failed to summarize objective:", error);
    } finally {
      setIsSummarizingObjective(false);
    }
  };

  // Summarize source text transcript
  const handleSummarizeText = async () => {
    if (!text.trim()) return;
    setIsSummarizingText(true);
    try {
      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: text,
        context: "source",
      });
      const data = await response.json();
      if (data.summary) {
        if (!textRawTranscript) {
          setTextRawTranscript(text);
        }
        setText(data.summary);
      }
    } catch (error) {
      console.error("Failed to summarize text:", error);
    } finally {
      setIsSummarizingText(false);
    }
  };

  // Restore original transcript
  const handleRestoreObjective = () => {
    if (objectiveRawTranscript) {
      setObjective(objectiveRawTranscript);
      setShowObjectiveRaw(false);
    }
  };

  const handleRestoreText = () => {
    if (textRawTranscript) {
      setText(textRawTranscript);
      setShowTextRaw(false);
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
    setIsDraftExpanded(true);
  };

  const handleClearPrebuilt = () => {
    setActivePrebuilt(null);
    setObjective("");
    setText("");
    setIsDraftExpanded(false);
  };

  // Handle draft question response — merge the user's answer into the draft text
  const handleDraftQuestionResponse = (question: string, response: string) => {
    const entry = `[${question}]\n${response}`;
    setText((prev) => (prev ? prev + "\n\n" + entry : entry));
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 gap-8">

        {/* ── STEP ONE: What type of document are you creating? ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </div>
            <h2 className="text-xl font-semibold">
              What type of document are you creating?
            </h2>
          </div>

          {/* Mode cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {prebuiltTemplates.map((template) => {
              const Icon = iconMap[template.icon] || PencilLine;
              const isActive = activePrebuilt?.id === template.id;

              return (
                <button
                  key={template.id}
                  onClick={() => {
                    if (isActive) {
                      handleClearPrebuilt();
                    } else {
                      handleSelectPrebuilt(template);
                    }
                  }}
                  className={`group relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                    isActive
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isActive ? "bg-primary/20" : "bg-primary/10"}`}>
                          <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-primary/70"}`} />
                        </div>
                        <div>
                          <span className="font-semibold text-base block">{template.title}</span>
                          <span className="text-xs text-muted-foreground">{template.subtitle}</span>
                        </div>
                      </div>
                      {isActive && (
                        <div className="p-1 rounded-full bg-primary">
                          <Check className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {template.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── OBJECTIVE ── Smart Text Component ── */}
        <SmartTextPanel
          label="Your objective"
          labelIcon={Target}
          description={
            <>
              {activePrebuilt
                ? "Auto-populated from the template you selected above — edit it to make it your own."
                : "Describe what you're creating. This is auto-populated if you select a document type above."}
              {" "}Once set, move on to your <span className="font-medium text-foreground">Draft</span> below.
            </>
          }
          id="objective"
          data-testid="input-objective"
          placeholder="A persuasive investor pitch... A technical design doc... A team announcement..."
          className="text-base leading-relaxed font-serif"
          value={objective}
          onChange={(val) => setObjective(val)}
          minRows={3}
          maxRows={6}
          onVoiceTranscript={handleObjectiveVoiceComplete}
          onRecordingChange={setIsRecordingObjective}
          voiceMode="replace"
          actions={[
            {
              key: "clean-up-objective",
              label: "Clean up",
              loadingLabel: "Summarizing...",
              description: "Uses AI to tidy up your voice transcript — removes filler words, fixes grammar, and distills your objective into clear, concise language.",
              icon: Wand2,
              onClick: handleSummarizeObjective,
              disabled: isSummarizingObjective,
              loading: isSummarizingObjective,
              visible: objective.length > 50 && !isRecordingObjective,
            },
            {
              key: "toggle-objective-raw",
              label: showObjectiveRaw ? "Hide original" : "Show original",
              description: "Toggle between the cleaned-up version and the original voice transcript so you can compare what changed.",
              icon: showObjectiveRaw ? EyeOff : Eye,
              onClick: () => setShowObjectiveRaw(!showObjectiveRaw),
              visible: !!objectiveRawTranscript && objectiveRawTranscript !== objective && !isRecordingObjective,
            },
            {
              key: "restore-objective",
              label: "Restore original",
              description: "Discard the cleaned-up version and revert to your original voice transcript.",
              icon: Eye,
              onClick: handleRestoreObjective,
              visible: !!objectiveRawTranscript && objectiveRawTranscript !== objective && !isRecordingObjective,
            },
          ] satisfies SmartAction[]}
        >
          {isRecordingObjective && (
            <p className="text-xs text-primary animate-pulse px-4 pb-3">Listening... speak your objective</p>
          )}
          {showObjectiveRaw && objectiveRawTranscript && (
            <div className="mx-4 mb-3 p-3 rounded-lg bg-muted/50 border text-sm">
              <p className="text-xs text-muted-foreground mb-1">Original transcript:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{objectiveRawTranscript}</p>
            </div>
          )}
        </SmartTextPanel>

        {/* ── DRAFT ── large, fills remaining space ── */}
        <div className="flex flex-col flex-1 min-h-0">
          {!isDraftExpanded ? (
            /* Collapsed: two action buttons */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <PenLine className="w-5 h-5 text-primary" />
                Your draft
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setIsDraftExpanded(true)}
                  className="group p-6 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-base">Paste text</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Notes, transcripts, reports — any raw material to shape.
                  </p>
                </button>

                <button
                  onClick={handleBlankDocument}
                  disabled={isLoading}
                  className="group p-6 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10">
                      <Mic className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-base">Speak it</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Talk through your ideas and we'll capture them as a draft.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            /* Expanded: large text area filling available space, with optional questions panel on left */
            <div className="flex flex-1 min-h-0 gap-3">
              {/* Questions panel — left side */}
              {activePrebuilt?.draftQuestions && activePrebuilt.draftQuestions.length > 0 && (
                <DraftQuestionsPanel
                  questions={activePrebuilt.draftQuestions}
                  onResponse={handleDraftQuestionResponse}
                />
              )}
              <SmartTextPanel
                label="Your draft"
                labelIcon={PenLine}
                description="Paste your notes, transcripts, or source material — or use voice to speak your ideas."
                containerClassName="flex-1 min-h-0 flex flex-col"
                data-testid="input-source-text"
                placeholder="Paste your notes, transcript, or source material here..."
                className="text-base leading-relaxed font-serif min-h-[200px]"
                value={text}
                onChange={(val) => setText(val)}
                minRows={12}
                maxRows={40}
                autoFocus
                onVoiceTranscript={handleTextVoiceComplete}
                onRecordingChange={setIsRecordingText}
                actions={[
                  {
                    key: "clean-up-draft",
                    label: "Clean up transcript",
                    loadingLabel: "Cleaning up...",
                    description: "Uses AI to clean your voice transcript — removes filler words, false starts, and grammatical errors while preserving your meaning.",
                    icon: Wand2,
                    onClick: handleSummarizeText,
                    disabled: isSummarizingText,
                    loading: isSummarizingText,
                    visible: text.length > 200 && !isRecordingText,
                  },
                  {
                    key: "toggle-draft-raw",
                    label: showTextRaw ? "Hide original" : `Show original (${(textRawTranscript?.length ? (textRawTranscript.length / 1000).toFixed(1) : "0")}k chars)`,
                    description: "Toggle between the cleaned-up version and the original voice transcript so you can compare what changed.",
                    icon: showTextRaw ? EyeOff : Eye,
                    onClick: () => setShowTextRaw(!showTextRaw),
                    visible: text.length > 200 && !isRecordingText && !!textRawTranscript && textRawTranscript !== text,
                  },
                  {
                    key: "restore-draft",
                    label: "Restore original",
                    description: "Discard the cleaned-up version and revert to your original voice transcript.",
                    icon: Eye,
                    onClick: handleRestoreText,
                    visible: text.length > 200 && !isRecordingText && !!textRawTranscript && textRawTranscript !== text,
                  },
                ] satisfies SmartAction[]}
                footer={
                  <div className="flex items-center justify-between px-4 py-3 border-t flex-wrap gap-2">
                    <div className="text-sm text-muted-foreground">
                      {text.length > 0 && (
                        <span data-testid="text-char-count">{text.length.toLocaleString()} characters</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setIsDraftExpanded(false); }}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
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
                }
              >
                {isRecordingText && (
                  <p className="text-xs text-primary animate-pulse px-4 pb-2">
                    Listening... speak your source material (up to 10 min)
                  </p>
                )}
                {showTextRaw && textRawTranscript && (
                  <div className="mx-4 mb-2 p-3 rounded-lg bg-muted/50 border text-sm max-h-60 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-1">Original transcript ({textRawTranscript.length.toLocaleString()} characters):</p>
                    <p className="text-muted-foreground whitespace-pre-wrap font-serif">{textRawTranscript}</p>
                  </div>
                )}
              </SmartTextPanel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
