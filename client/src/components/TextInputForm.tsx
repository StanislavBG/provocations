import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ArrowRight, Sparkles } from "lucide-react";

interface TextInputFormProps {
  onSubmit: (text: string) => void;
  isLoading?: boolean;
}

export function TextInputForm({ onSubmit, isLoading }: TextInputFormProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
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
              <FileText className="w-5 h-5 text-primary" />
              Paste Your Source Material
            </CardTitle>
            <CardDescription className="text-base">
              Meeting transcripts, reports, notes, or any text you want to analyze deeply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              data-testid="input-source-text"
              placeholder="Paste your text here... The more context you provide, the more incisive the provocations will be."
              className="min-h-[280px] text-base resize-none leading-relaxed font-serif"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-muted-foreground">
                {text.length > 0 && (
                  <span data-testid="text-char-count">{text.length.toLocaleString()} characters</span>
                )}
              </div>
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
