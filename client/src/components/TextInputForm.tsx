import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { FileText, ArrowRight, Sparkles, FlaskConical, Mic, Target, BookCopy, Plus, X, ChevronDown, Wand2, Eye, EyeOff, Loader2, Settings2, Check, PenLine } from "lucide-react";
import { generateId } from "@/lib/utils";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { apiRequest } from "@/lib/queryClient";
import { PrebuiltTemplates } from "@/components/PrebuiltTemplates";
import type { PrebuiltTemplate } from "@/lib/prebuiltTemplates";
import type { ReferenceDocument } from "@shared/schema";

const TEST_SAMPLE_TEXT = `By 2027, the labor market is expected to reach a critical "implementation plateau" where the novelty of AI shifts into deep organizational integration. Analysts from Gartner and the World Economic Forum suggest that while roughly 83 million jobs may be displaced globally, the emergence of 69 million new roles will offset much of this loss, centering the year on workforce transformation rather than total depletion. The most significant shift will be the rise of "Agentic AI," with 50% of companies expected to deploy autonomous AI agents that handle routine cognitive tasks like scheduling, basic coding, and data synthesis. This transition will likely hollow out entry-level white-collar positions—often called the "white-collar bloodbath"—forcing a massive "reskilling revolution" where 44% of core worker skills must be updated. While technical roles in AI ethics and data oversight will boom, the highest market value will ironically return to "AI-free" human skills: critical thinking, complex empathy, and high-stakes judgment in fields like healthcare and law.`;

interface TextInputFormProps {
  onSubmit: (text: string, objective: string, referenceDocuments: ReferenceDocument[]) => void;
  onBlankDocument?: () => void;
  isLoading?: boolean;
}

export function TextInputForm({ onSubmit, onBlankDocument, isLoading }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [newRefName, setNewRefName] = useState("");
  const [newRefContent, setNewRefContent] = useState("");
  const [newRefType, setNewRefType] = useState<ReferenceDocument["type"]>("example");

  // Voice input state
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterim, setObjectiveInterim] = useState("");
  const [isRecordingText, setIsRecordingText] = useState(false);
  const [textInterim, setTextInterim] = useState("");

  // Advanced options
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Template generation with approval flow
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ name: string; content: string } | null>(null);

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

  const handleAddReference = () => {
    if (newRefName.trim() && newRefContent.trim()) {
      const newDoc: ReferenceDocument = {
        id: generateId("ref"),
        name: newRefName.trim(),
        content: newRefContent.trim(),
        type: newRefType,
      };
      setReferenceDocuments((prev) => [...prev, newDoc]);
      setNewRefName("");
      setNewRefContent("");
      setNewRefType("example");
    }
  };

  const handleRemoveReference = (id: string) => {
    setReferenceDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim(), objective.trim() || "Create a compelling, well-structured document", referenceDocuments);
    }
  };

  const handleTest = () => {
    onSubmit(TEST_SAMPLE_TEXT, "Create an executive briefing on AI's impact on the labor market by 2027", []);
  };

  const handleBlankDocument = () => {
    onBlankDocument?.();
  };

  // Handle objective voice transcript
  const handleObjectiveVoiceComplete = (transcript: string) => {
    setObjective(transcript);
    setObjectiveInterim("");
    if (transcript.length > 50) {
      setObjectiveRawTranscript(transcript);
    }
  };

  // Handle source text voice transcript
  const handleTextVoiceComplete = (transcript: string) => {
    const newText = text ? text + " " + transcript : transcript;
    setText(newText);
    setTextInterim("");
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
    setText(template.starterText);
    setActivePrebuilt(template);
    setIsDraftExpanded(true);
    const templateDoc: ReferenceDocument = {
      id: generateId("ref"),
      name: `Template: ${template.title}`,
      content: template.templateContent,
      type: "template",
    };
    setReferenceDocuments((prev) => {
      const withoutOldPrebuilt = prev.filter(
        (d) => d.type !== "template" || !d.name.startsWith("Template: ")
      );
      return [...withoutOldPrebuilt, templateDoc];
    });
  };

  const handleClearPrebuilt = () => {
    setActivePrebuilt(null);
    setObjective("");
    setText("");
    setReferenceDocuments((prev) =>
      prev.filter((d) => d.type !== "template" || !d.name.startsWith("Template: "))
    );
  };

  const handleGenerateTemplate = async () => {
    if (!objective.trim()) return;
    setIsGeneratingTemplate(true);
    setPendingTemplate(null);
    try {
      const response = await apiRequest("POST", "/api/generate-template", {
        objective: objective.trim(),
      });
      const data = await response.json();
      if (data.template) {
        setPendingTemplate({
          name: data.name || `Template: ${objective.slice(0, 40)}`,
          content: data.template,
        });
      }
    } catch (error) {
      console.error("Failed to generate template:", error);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleApproveTemplate = () => {
    if (!pendingTemplate) return;
    const templateDoc: ReferenceDocument = {
      id: generateId("ref"),
      name: pendingTemplate.name,
      content: pendingTemplate.content,
      type: "template",
    };
    setReferenceDocuments((prev) => [...prev, templateDoc]);
    setPendingTemplate(null);
  };

  const handleRejectTemplate = () => {
    setPendingTemplate(null);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 gap-6">
        {/* ── OBJECTIVE ─── prominent, full-width ── */}
        <div className="space-y-2">
          <label
            htmlFor="objective"
            className="flex items-center gap-2 text-base font-medium text-muted-foreground"
          >
            <Target className="w-4 h-4 text-primary" />
            What are you creating?
          </label>
          <div className="flex gap-2">
            <AutoExpandTextarea
              id="objective"
              data-testid="input-objective"
              placeholder="A persuasive investor pitch... A technical design doc... A team announcement..."
              className={`text-base flex-1 leading-relaxed font-serif ${isRecordingObjective ? "border-primary text-primary" : ""}`}
              value={isRecordingObjective ? objectiveInterim || objective : objective}
              onChange={(e) => setObjective(e.target.value)}
              readOnly={isRecordingObjective}
              minRows={3}
              maxRows={6}
            />
            <VoiceRecorder
              onTranscript={handleObjectiveVoiceComplete}
              onInterimTranscript={setObjectiveInterim}
              onRecordingChange={setIsRecordingObjective}
              size="default"
              variant={isRecordingObjective ? "destructive" : "outline"}
            />
          </div>
          {isRecordingObjective && (
            <p className="text-xs text-primary animate-pulse">Listening... speak your objective</p>
          )}

          {/* Summarize controls for long objectives */}
          {objective.length > 50 && !isRecordingObjective && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSummarizeObjective}
                disabled={isSummarizingObjective}
                className="gap-1.5 text-xs h-7"
              >
                {isSummarizingObjective ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3 h-3" />
                    Clean up
                  </>
                )}
              </Button>
              {objectiveRawTranscript && objectiveRawTranscript !== objective && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowObjectiveRaw(!showObjectiveRaw)}
                    className="gap-1.5 text-xs h-7"
                  >
                    {showObjectiveRaw ? <><EyeOff className="w-3 h-3" /> Hide original</> : <><Eye className="w-3 h-3" /> Show original</>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRestoreObjective} className="gap-1.5 text-xs h-7">
                    Restore original
                  </Button>
                </>
              )}
            </div>
          )}
          {showObjectiveRaw && objectiveRawTranscript && (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm">
              <p className="text-xs text-muted-foreground mb-1">Original transcript:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{objectiveRawTranscript}</p>
            </div>
          )}

          {/* Active prebuilt indicator */}
          {activePrebuilt && (
            <div className="flex items-center justify-between p-2 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Template: {activePrebuilt.title}</span>
              </div>
              <button
                onClick={handleClearPrebuilt}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── DRAFT ─── large, fills remaining space ── */}
        <div className="flex flex-col flex-1 min-h-0 space-y-2">
          <label className="flex items-center gap-2 text-base font-medium text-muted-foreground">
            <PenLine className="w-4 h-4 text-primary" />
            Your draft
          </label>

          {!isDraftExpanded ? (
            /* Collapsed: two action buttons */
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
          ) : (
            /* Expanded: large text area filling available space */
            <div className="flex flex-col flex-1 min-h-0 rounded-lg border-2 bg-card">
              <div className="relative flex-1 min-h-0 p-4">
                <AutoExpandTextarea
                  data-testid="input-source-text"
                  placeholder="Paste your notes, transcript, or source material here..."
                  className={`text-base leading-relaxed font-serif pr-12 h-full min-h-[200px] ${isRecordingText ? "border-primary" : "border-none shadow-none focus-visible:ring-0"}`}
                  value={isRecordingText ? textInterim || text : text}
                  onChange={(e) => setText(e.target.value)}
                  readOnly={isRecordingText}
                  minRows={12}
                  maxRows={40}
                  autoFocus
                />
                <div className="absolute top-5 right-5">
                  <VoiceRecorder
                    onTranscript={handleTextVoiceComplete}
                    onInterimTranscript={(interim) => setTextInterim(text ? text + " " + interim : interim)}
                    onRecordingChange={setIsRecordingText}
                    size="icon"
                    variant={isRecordingText ? "destructive" : "ghost"}
                  />
                </div>
                {isRecordingText && (
                  <div className="absolute bottom-5 left-5 right-14">
                    <p className="text-xs text-primary animate-pulse bg-background/80 px-2 py-1 rounded">
                      Listening... speak your source material (up to 10 min)
                    </p>
                  </div>
                )}
              </div>

              {/* Summarize controls for long text */}
              {text.length > 200 && !isRecordingText && (
                <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSummarizeText}
                    disabled={isSummarizingText}
                    className="gap-1.5 text-xs h-7"
                  >
                    {isSummarizingText ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Cleaning up...</>
                    ) : (
                      <><Wand2 className="w-3 h-3" /> Clean up transcript</>
                    )}
                  </Button>
                  {textRawTranscript && textRawTranscript !== text && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTextRaw(!showTextRaw)}
                        className="gap-1.5 text-xs h-7"
                      >
                        {showTextRaw ? <><EyeOff className="w-3 h-3" /> Hide original</> : <><Eye className="w-3 h-3" /> Show original ({(textRawTranscript.length / 1000).toFixed(1)}k chars)</>}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleRestoreText} className="gap-1.5 text-xs h-7">
                        Restore original
                      </Button>
                    </>
                  )}
                </div>
              )}
              {showTextRaw && textRawTranscript && (
                <div className="mx-4 mb-2 p-3 rounded-lg bg-muted/50 border text-sm max-h-60 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-1">Original transcript ({textRawTranscript.length.toLocaleString()} characters):</p>
                  <p className="text-muted-foreground whitespace-pre-wrap font-serif">{textRawTranscript}</p>
                </div>
              )}

              {/* Action row */}
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
            </div>
          )}
        </div>

        {/* ── ADVANCED SETTINGS ─── hidden by default ── */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <Settings2 className="w-4 h-4" />
              <span>Advanced options</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`} />
              {referenceDocuments.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">{referenceDocuments.length} ref{referenceDocuments.length !== 1 ? "s" : ""}</Badge>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-6 pt-4 mt-2 border-t">
              {/* Pre-built templates */}
              {!activePrebuilt && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Quick-start templates
                  </h3>
                  <PrebuiltTemplates onSelect={handleSelectPrebuilt} />
                </div>
              )}

              {/* Generate template from objective */}
              {objective.trim() && !pendingTemplate && !referenceDocuments.some(d => d.type === "template") && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    AI-generated template
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Generate a structured template based on your objective.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTemplate}
                    disabled={isGeneratingTemplate}
                    className="gap-1.5 w-full"
                  >
                    {isGeneratingTemplate ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating template...</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5" /> Generate Template from Objective</>
                    )}
                  </Button>
                </div>
              )}

              {/* Pending template approval */}
              {pendingTemplate && (
                <div className="space-y-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{pendingTemplate.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">Pending Approval</Badge>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-3 rounded-md bg-background border text-sm font-serif whitespace-pre-wrap leading-relaxed">
                    {pendingTemplate.content}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleApproveTemplate} className="gap-1.5 flex-1">
                      <Check className="w-3.5 h-3.5" /> Approve & Add
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRejectTemplate} className="gap-1.5">
                      <X className="w-3.5 h-3.5" /> Discard
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleGenerateTemplate} disabled={isGeneratingTemplate} className="gap-1.5">
                      {isGeneratingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}

              {/* Style & Reference Documents */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookCopy className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Style & Reference Documents</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add templates, style guides, or prior examples to guide tone and completeness.
                </p>

                {referenceDocuments.length > 0 && (
                  <div className="space-y-2">
                    {referenceDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{doc.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{doc.type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {doc.content.slice(0, 150)}...
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveReference(doc.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 p-3 rounded-lg border border-dashed">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Reference name (e.g., 'Company Style Guide')"
                      value={newRefName}
                      onChange={(e) => setNewRefName(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={newRefType} onValueChange={(v) => setNewRefType(v as ReferenceDocument["type"])}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="style">Style</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                        <SelectItem value="example">Example</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <AutoExpandTextarea
                      placeholder="Paste the reference content here..."
                      value={newRefContent}
                      onChange={(e) => setNewRefContent(e.target.value)}
                      className="text-sm pr-10"
                      minRows={3}
                      maxRows={15}
                    />
                    <div className="absolute top-2 right-2">
                      <VoiceRecorder
                        onTranscript={(transcript) => {
                          setNewRefContent((prev) => prev ? prev + " " + transcript : transcript);
                        }}
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddReference}
                    disabled={!newRefName.trim() || !newRefContent.trim()}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Reference
                  </Button>
                </div>
              </div>

              {/* Test / Demo button */}
              <div className="pt-2 border-t">
                <Button
                  data-testid="button-test"
                  onClick={handleTest}
                  disabled={isLoading}
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                >
                  <FlaskConical className="w-4 h-4" />
                  Load demo content
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
