import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileAudio, Upload, Loader2, CheckCircle2, FileText, Sparkles } from "lucide-react";
import type { GenerateSummaryResponse, InfographicSpec } from "@shared/schema";

interface TranscriptUploadPanelProps {
  onDocumentUpdate: (markdown: string) => void;
  onProcessingComplete: (data: {
    transcript: string;
    summary: GenerateSummaryResponse;
    infographic: InfographicSpec;
  }) => void;
}

export function TranscriptUploadPanel({
  onDocumentUpdate,
  onProcessingComplete,
}: TranscriptUploadPanelProps) {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<"input" | "summarizing" | "generating" | "complete">("input");

  // Process: summarize → generate infographic
  const processMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Summarize
      setStage("summarizing");
      const summaryRes = await apiRequest("POST", "/api/pipeline/summarize", {
        transcript,
        title: title || undefined,
        sourceType: "voice-capture",
      });
      const summary = (await summaryRes.json()) as GenerateSummaryResponse;

      // Step 2: Generate infographic
      setStage("generating");
      const infographicRes = await apiRequest("POST", "/api/pipeline/infographic", {
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        tips: summary.tips,
        title: title || undefined,
        sourceType: "voice-capture",
      });
      const infographic = (await infographicRes.json()) as InfographicSpec;

      return { transcript, summary, infographic };
    },
    onSuccess: (data) => {
      setStage("complete");

      // Build document markdown
      const markdown = buildTranscriptDocument(data.transcript, data.summary, data.infographic, title);
      onDocumentUpdate(markdown);
      onProcessingComplete(data);

      toast({
        title: "Infographic Generated",
        description: `${data.infographic.sections.length} sections created from your transcript`,
      });
    },
    onError: (error) => {
      setStage("input");
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setTranscript(text);
        if (!title && file.name) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      }
    };
    reader.readAsText(file);
  };

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          Session Title (optional)
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Team standup, Product review meeting..."
          disabled={processMutation.isPending}
        />
      </div>

      {/* Transcript Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground">
            Transcript Content
          </label>
          {wordCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {wordCount} words
            </Badge>
          )}
        </div>
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste your voice capture transcript here, or upload a file below..."
          className="min-h-[200px] font-mono text-sm"
          disabled={processMutation.isPending}
        />
      </div>

      {/* File upload */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <Upload className="w-4 h-4" />
          Upload .txt file
          <input
            type="file"
            accept=".txt,.md,.text"
            className="hidden"
            onChange={handleFileUpload}
            disabled={processMutation.isPending}
          />
        </label>
        <span className="text-xs text-muted-foreground">or paste above</span>
      </div>

      {/* Processing status */}
      {processMutation.isPending && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">
              {stage === "summarizing" && "Summarizing transcript..."}
              {stage === "generating" && "Generating infographic specification..."}
            </p>
            <p className="text-xs text-muted-foreground">
              {stage === "summarizing" && "Extracting key points, tips, and insights"}
              {stage === "generating" && "Designing visual layout and sections"}
            </p>
          </div>
        </div>
      )}

      {stage === "complete" && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Infographic specification generated
            </p>
            <p className="text-xs text-muted-foreground">
              View the document in the reading pane. Use Provoke to challenge it.
            </p>
          </div>
        </div>
      )}

      {/* Process button */}
      <Button
        onClick={() => processMutation.mutate()}
        disabled={!transcript.trim() || processMutation.isPending || stage === "complete"}
        className="w-full gap-1.5"
      >
        {processMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : stage === "complete" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {stage === "complete" ? "Complete" : "Summarize & Generate Infographic"}
      </Button>

      {/* Reset for another transcript */}
      {stage === "complete" && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            setTranscript("");
            setTitle("");
            setStage("input");
          }}
        >
          Process another transcript
        </Button>
      )}
    </div>
  );
}

/** Build document markdown from transcript processing results */
function buildTranscriptDocument(
  transcript: string,
  summary: GenerateSummaryResponse,
  infographic: InfographicSpec,
  title: string,
): string {
  const lines: string[] = [];

  lines.push(`# ${infographic.title}`);
  lines.push(`*${infographic.subtitle}*`);
  lines.push("");
  lines.push(`> Source: ${infographic.sourceLabel || `Voice Capture${title ? ` — ${title}` : ""}`}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push(summary.summary);
  lines.push("");

  // Key Points
  lines.push("## Key Points");
  for (const kp of summary.keyPoints) {
    lines.push(`- ${kp}`);
  }
  lines.push("");

  // Tips
  if (summary.tips.length > 0) {
    lines.push("## Tips & Advice");
    for (const tip of summary.tips) {
      lines.push(`- ${tip}`);
    }
    lines.push("");
  }

  // Infographic Specification
  lines.push("## Infographic Specification");
  lines.push("");
  for (const section of infographic.sections) {
    lines.push(`### ${section.heading}`);
    lines.push(section.content);
    if (section.dataPoints && section.dataPoints.length > 0) {
      for (const dp of section.dataPoints) {
        lines.push(`- ${dp}`);
      }
    }
    lines.push("");
  }

  // Color Palette
  lines.push("## Color Palette");
  lines.push(infographic.colorPalette.map((c) => `\`${c}\``).join("  "));
  lines.push("");

  return lines.join("\n");
}
