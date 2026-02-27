import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorLogStore } from "@/lib/errorLog";
import { generateId } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Image as ImageIcon,
  Loader2,
  FileText,
  ArrowRightToLine,
  Trash2,
  Eye,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single application card in the Generate studio */
interface GenerateAppCard {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  available: boolean;
}

/** A generated document in session context */
export interface GeneratedDocument {
  id: string;
  appId: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt: Date;
}

interface GeneratePanelProps {
  /** Current document text to use as generation input */
  documentText: string;
  /** Objective text for the current session */
  objective: string;
  /** Generated documents held in session context */
  generatedDocs: GeneratedDocument[];
  /** Callback when a new document is generated */
  onDocGenerated: (doc: GeneratedDocument) => void;
  /** Callback to remove a generated doc from session */
  onDocRemove: (id: string) => void;
  /** Callback to move a generated doc to the main context store */
  onDocPromote: (doc: GeneratedDocument) => void;
  /** Callback to preview a generated doc */
  onDocPreview?: (doc: GeneratedDocument) => void;
}

// ---------------------------------------------------------------------------
// Application cards definition
// ---------------------------------------------------------------------------

const GENERATE_APPS: GenerateAppCard[] = [
  {
    id: "infographic",
    label: "Infographic",
    description: "Generate visual infographics from your document content",
    icon: ImageIcon,
    color: "text-purple-500",
    available: true,
  },
  // Future cards will be added here:
  // { id: "slide-deck", label: "Slide Deck", ... },
  // { id: "mind-map", label: "Mind Map", ... },
  // { id: "summary", label: "Summary Report", ... },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratePanel({
  documentText,
  objective,
  generatedDocs,
  onDocGenerated,
  onDocRemove,
  onDocPromote,
  onDocPreview,
}: GeneratePanelProps) {
  const { toast } = useToast();
  const [activeApp, setActiveApp] = useState<string | null>(null);

  // ── Infographic generation ──

  const infographicMutation = useMutation({
    mutationFn: async (text: string) => {
      // Step 1: Generate a clean summary for the infographic
      const summaryRes = await apiRequest("POST", "/api/summarize-intent", {
        transcript: text,
        context: "infographic-clean-summary",
        systemOverride: `You are a precise editorial summarizer preparing content for an infographic. Extract the key insights, data points, and narrative structure. Output a well-structured summary with clear sections, bullet points, and highlights that would work well in a visual format.

OBJECTIVE: ${objective || "Summarize the key points"}

Rules:
- Extract 3-7 key insights or data points
- Structure with clear headings
- Keep each point concise (1-2 sentences)
- Highlight numbers, percentages, and comparisons
- End with a takeaway or call-to-action`,
      });
      const summaryData = await summaryRes.json();
      const cleanSummary = summaryData.summary;

      // Step 2: Create an artistic specification
      const artisticRes = await apiRequest("POST", "/api/summarize-intent", {
        transcript: cleanSummary,
        context: "infographic-artistic-summary",
        systemOverride: `You are an information composer creating a visual specification for an infographic. Transform the structured summary into a vivid, visually-oriented description that an image generation model can use to create an infographic.

Include:
- Visual hierarchy and layout suggestions
- Color palette recommendations
- Icon/illustration suggestions for each section
- Typography mood (modern, classic, bold)
- Overall visual style (minimalist, data-rich, editorial)

Make it visually compelling and information-dense.`,
      });
      const artisticData = await artisticRes.json();
      const artisticSummary = artisticData.summary;

      // Step 3: Generate the infographic image
      const imageRes = await apiRequest("POST", "/api/generate-image", {
        description: `${artisticSummary}\n\nStyle: vibrant colors, moderate complexity, 9:16 portrait aspect ratio.`,
        temperature: 0.8,
      });
      const imageData = await imageRes.json();

      return {
        cleanSummary,
        artisticSummary,
        imageUrl: imageData.imageUrl as string,
      };
    },
    onSuccess: (data) => {
      const doc: GeneratedDocument = {
        id: generateId(),
        appId: "infographic",
        title: `Infographic — ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        content: data.cleanSummary,
        imageUrl: data.imageUrl,
        createdAt: new Date(),
      };
      onDocGenerated(doc);
      setActiveApp(null);
      toast({ title: "Infographic Generated", description: "Your infographic has been added to session context." });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Generation failed";
      errorLogStore.push({ step: "Generate Infographic", endpoint: "/api/generate-image", message: msg });
      toast({ title: "Generation Failed", description: msg, variant: "destructive" });
    },
  });

  const handleGenerate = useCallback(
    (appId: string) => {
      if (!documentText.trim()) {
        toast({
          title: "No content",
          description: "Write some document content first, then generate.",
          variant: "destructive",
        });
        return;
      }
      setActiveApp(appId);
      if (appId === "infographic") {
        infographicMutation.mutate(documentText);
      }
    },
    [documentText, infographicMutation, toast],
  );

  const isGenerating = infographicMutation.isPending;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generate
          </span>
          {generatedDocs.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
              {generatedDocs.length}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* ═══ APPLICATION CARDS ═══ */}
        <div className="p-3">
          <p className="text-[10px] text-muted-foreground/60 mb-2">
            Generate artifacts from your document. Results are added as session context.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {GENERATE_APPS.map((app) => {
              const Icon = app.icon;
              const isActive = activeApp === app.id && isGenerating;
              return (
                <button
                  key={app.id}
                  disabled={!app.available || isGenerating}
                  onClick={() => handleGenerate(app.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                    app.available
                      ? "hover:bg-muted/60 hover:border-primary/30 cursor-pointer border-border"
                      : "opacity-40 cursor-not-allowed border-transparent"
                  } ${isActive ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" : ""}`}
                >
                  {isActive ? (
                    <Loader2 className={`w-6 h-6 animate-spin ${app.color}`} />
                  ) : (
                    <Icon className={`w-6 h-6 ${app.color}`} />
                  )}
                  <span className="text-xs font-medium">{app.label}</span>
                  {!app.available && (
                    <Badge
                      variant="outline"
                      className="absolute top-1 right-1 text-[8px] px-1 h-3.5"
                    >
                      Soon
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ GENERATED DOCUMENTS (Session Context) ═══ */}
        <div className="border-t">
          <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Generated — Session Context
            </span>
          </div>

          {generatedDocs.length === 0 ? (
            <div className="px-3 pb-4 pt-1">
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                Generated artifacts will appear here as session context. You can
                preview them or promote to your permanent Context Store.
              </p>
            </div>
          ) : (
            <div className="px-3 pb-3 space-y-1.5">
              {generatedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex items-start gap-2 p-2 rounded-md border border-amber-500/20 bg-amber-500/5 transition-colors hover:bg-amber-500/10"
                >
                  {/* Thumbnail or icon */}
                  {doc.imageUrl ? (
                    <img
                      src={doc.imageUrl}
                      alt={doc.title}
                      className="w-10 h-10 rounded object-cover shrink-0 border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {doc.content.slice(0, 80)}...
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onDocPreview && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => onDocPreview(doc)}
                          >
                            <Eye className="w-2.5 h-2.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Preview</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground/50 hover:text-green-600"
                          onClick={() => onDocPromote(doc)}
                        >
                          <ArrowRightToLine className="w-2.5 h-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Move to Context Store
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground/50 hover:text-destructive"
                          onClick={() => onDocRemove(doc.id)}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Remove</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
