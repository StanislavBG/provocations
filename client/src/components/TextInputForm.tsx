import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { FileText, ArrowRight, Sparkles, FlaskConical, Mic, Target, BookCopy, Plus, X, ChevronDown, Wand2, Eye, EyeOff, Loader2 } from "lucide-react";
import { generateId } from "@/lib/utils";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { apiRequest } from "@/lib/queryClient";
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
  const [isReferencesOpen, setIsReferencesOpen] = useState(false);
  const [newRefName, setNewRefName] = useState("");
  const [newRefContent, setNewRefContent] = useState("");
  const [newRefType, setNewRefType] = useState<ReferenceDocument["type"]>("example");

  // Voice input state
  const [isRecordingObjective, setIsRecordingObjective] = useState(false);
  const [objectiveInterim, setObjectiveInterim] = useState("");
  const [isRecordingText, setIsRecordingText] = useState(false);
  const [textInterim, setTextInterim] = useState("");

  // Raw transcript storage for "show original"
  const [objectiveRawTranscript, setObjectiveRawTranscript] = useState<string | null>(null);
  const [textRawTranscript, setTextRawTranscript] = useState<string | null>(null);
  const [showObjectiveRaw, setShowObjectiveRaw] = useState(false);
  const [showTextRaw, setShowTextRaw] = useState(false);

  // Summarization state
  const [isSummarizingObjective, setIsSummarizingObjective] = useState(false);
  const [isSummarizingText, setIsSummarizingText] = useState(false);

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
    // Store raw transcript for potential "show original"
    if (transcript.length > 50) {
      setObjectiveRawTranscript(transcript);
    }
  };

  // Handle source text voice transcript
  const handleTextVoiceComplete = (transcript: string) => {
    const newText = text ? text + " " + transcript : transcript;
    setText(newText);
    setTextInterim("");
    // Store raw transcript (append to existing if any)
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
        // Store original before replacing
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
        // Store original before replacing
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-serif font-bold tracking-tight" data-testid="text-title">
            Provocations
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A tool that makes you think, not one that thinks for you.
          </p>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              What are you creating?
            </CardTitle>
            <CardDescription className="text-base">
              Define the objective for your document. This guides all AI assistance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="objective" className="text-sm font-medium">Document Objective</Label>
              <div className="flex gap-2">
                <AutoExpandTextarea
                  id="objective"
                  data-testid="input-objective"
                  placeholder="e.g., Create a persuasive investor pitch, Write a technical design doc, Draft a team communication..."
                  className={`text-base flex-1 ${isRecordingObjective ? "border-primary text-primary" : ""}`}
                  value={isRecordingObjective ? objectiveInterim || objective : objective}
                  onChange={(e) => setObjective(e.target.value)}
                  readOnly={isRecordingObjective}
                  minRows={1}
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

              {/* Summarize and show original controls for objective */}
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
                        Clean up / Summarize
                      </>
                    )}
                  </Button>
                  {objectiveRawTranscript && objectiveRawTranscript !== objective && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowObjectiveRaw(!showObjectiveRaw)}
                      className="gap-1.5 text-xs h-7"
                    >
                      {showObjectiveRaw ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          Hide original
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          Show original
                        </>
                      )}
                    </Button>
                  )}
                  {objectiveRawTranscript && objectiveRawTranscript !== objective && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRestoreObjective}
                      className="gap-1.5 text-xs h-7"
                    >
                      Restore original
                    </Button>
                  )}
                </div>
              )}

              {/* Show original transcript */}
              {showObjectiveRaw && objectiveRawTranscript && (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Original transcript:</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{objectiveRawTranscript}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Collapsible open={isReferencesOpen} onOpenChange={setIsReferencesOpen}>
          <Card className="border-2">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookCopy className="w-5 h-5 text-primary" />
                  Style & Reference Documents
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${isReferencesOpen ? "rotate-180" : ""}`} />
                  {referenceDocuments.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{referenceDocuments.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-base text-left">
                  Add templates, style guides, or prior examples to guide tone and completeness.
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Existing references */}
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

                {/* Add new reference */}
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Card className="border-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Paste Your Source Material
            </CardTitle>
            <CardDescription className="text-base">
              Meeting transcripts, reports, notes, or any text you want to shape into your document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <AutoExpandTextarea
                data-testid="input-source-text"
                placeholder="Paste your text here, or use the microphone to speak for up to 10 minutes. The more context you provide, the more incisive the provocations will be."
                className={`text-base leading-relaxed font-serif pr-12 ${isRecordingText ? "border-primary" : ""}`}
                value={isRecordingText ? textInterim || text : text}
                onChange={(e) => setText(e.target.value)}
                readOnly={isRecordingText}
                minRows={8}
                maxRows={30}
              />
              <div className="absolute top-2 right-2">
                <VoiceRecorder
                  onTranscript={handleTextVoiceComplete}
                  onInterimTranscript={(interim) => setTextInterim(text ? text + " " + interim : interim)}
                  onRecordingChange={setIsRecordingText}
                  size="icon"
                  variant={isRecordingText ? "destructive" : "ghost"}
                />
              </div>
              {isRecordingText && (
                <div className="absolute bottom-2 left-2 right-12">
                  <p className="text-xs text-primary animate-pulse bg-background/80 px-2 py-1 rounded">
                    Listening... speak your source material (up to 10 min)
                  </p>
                </div>
              )}
            </div>

            {/* Summarize and show original controls for source text */}
            {text.length > 200 && !isRecordingText && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSummarizeText}
                  disabled={isSummarizingText}
                  className="gap-1.5 text-xs h-7"
                >
                  {isSummarizingText ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Cleaning up...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      Clean up transcript
                    </>
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
                      {showTextRaw ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          Hide original
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          Show original ({(textRawTranscript.length / 1000).toFixed(1)}k chars)
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRestoreText}
                      className="gap-1.5 text-xs h-7"
                    >
                      Restore original
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Show original transcript */}
            {showTextRaw && textRawTranscript && (
              <div className="p-3 rounded-lg bg-muted/50 border text-sm max-h-60 overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-1">Original transcript ({textRawTranscript.length.toLocaleString()} characters):</p>
                <p className="text-muted-foreground whitespace-pre-wrap font-serif">{textRawTranscript}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <div className="text-sm text-muted-foreground">
                {text.length > 0 && (
                  <span data-testid="text-char-count">{text.length.toLocaleString()} characters (~{Math.ceil(text.split(/\s+/).length / 150)} min read)</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  data-testid="button-blank-document"
                  onClick={handleBlankDocument}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  <Mic className="w-4 h-4" />
                  Blank Document
                </Button>
                <Button
                  data-testid="button-test"
                  onClick={handleTest}
                  disabled={isLoading}
                  variant="secondary"
                  size="lg"
                  className="gap-2"
                >
                  <FlaskConical className="w-4 h-4" />
                  Test
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
          </CardContent>
        </Card>

        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground italic max-w-md mx-auto">
            "Would you rather have a tool that thinks for you, or a tool that makes you think?"
          </p>
        </div>
      </div>
    </div>
  );
}
