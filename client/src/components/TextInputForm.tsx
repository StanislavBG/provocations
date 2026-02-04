import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, ArrowRight, Sparkles, FlaskConical, Mic, Target } from "lucide-react";

const TEST_SAMPLE_TEXT = `By 2027, the labor market is expected to reach a critical "implementation plateau" where the novelty of AI shifts into deep organizational integration. Analysts from Gartner and the World Economic Forum suggest that while roughly 83 million jobs may be displaced globally, the emergence of 69 million new roles will offset much of this loss, centering the year on workforce transformation rather than total depletion. The most significant shift will be the rise of "Agentic AI," with 50% of companies expected to deploy autonomous AI agents that handle routine cognitive tasks like scheduling, basic coding, and data synthesis. This transition will likely hollow out entry-level white-collar positions—often called the "white-collar bloodbath"—forcing a massive "reskilling revolution" where 44% of core worker skills must be updated. While technical roles in AI ethics and data oversight will boom, the highest market value will ironically return to "AI-free" human skills: critical thinking, complex empathy, and high-stakes judgment in fields like healthcare and law.`;

interface TextInputFormProps {
  onSubmit: (text: string, objective: string) => void;
  onBlankDocument?: () => void;
  isLoading?: boolean;
}

export function TextInputForm({ onSubmit, onBlankDocument, isLoading }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [objective, setObjective] = useState("");

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim(), objective.trim() || "Create a compelling, well-structured document");
    }
  };

  const handleTest = () => {
    onSubmit(TEST_SAMPLE_TEXT, "Create an executive briefing on AI's impact on the labor market by 2027");
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
