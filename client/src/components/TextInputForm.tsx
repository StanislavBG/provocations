import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, ArrowRight, Sparkles, FlaskConical, Mic, Target, BookCopy, Plus, X, ChevronDown } from "lucide-react";
import { generateId } from "@/lib/utils";
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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="objective" className="text-sm font-medium">Document Objective</Label>
              <Input
                id="objective"
                data-testid="input-objective"
                placeholder="e.g., Create a persuasive investor pitch, Write a technical design doc, Draft a team communication..."
                className="text-base"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
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
                  <Textarea
                    placeholder="Paste the reference content here..."
                    value={newRefContent}
                    onChange={(e) => setNewRefContent(e.target.value)}
                    className="min-h-[100px] text-sm"
                  />
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
            <Textarea
              data-testid="input-source-text"
              placeholder="Paste your text here... The more context you provide, the more incisive the provocations will be."
              className="min-h-[220px] text-base resize-none leading-relaxed font-serif"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <div className="text-sm text-muted-foreground">
                {text.length > 0 && (
                  <span data-testid="text-char-count">{text.length.toLocaleString()} characters</span>
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
