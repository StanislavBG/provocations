import { ProvokeText } from "./ProvokeText";
import {
  Globe,
  Layout,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StreamingWireframePanelProps {
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  wireframeNotes: string;
  onWireframeNotesChange: (notes: string) => void;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
}

export function StreamingWireframePanel({
  websiteUrl,
  onWebsiteUrlChange,
  wireframeNotes,
  onWireframeNotesChange,
  isAnalyzing,
  hasAnalysis,
}: StreamingWireframePanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-sm">Website Context</h3>
        {isAnalyzing && (
          <Badge variant="outline" className="ml-auto text-[10px] gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing...
          </Badge>
        )}
        {!isAnalyzing && hasAnalysis && (
          <Badge variant="outline" className="ml-auto text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
            <Check className="w-3 h-3" />
            Analyzed
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-3 space-y-3">
          {/* Website URL input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">Target Website URL</label>
            </div>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => onWebsiteUrlChange(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 text-sm px-3 py-1.5 border rounded-md bg-background"
              />
              {websiteUrl && (
                <a
                  href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border bg-background hover:bg-muted transition-colors shrink-0"
                  title="Open website in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
            {isAnalyzing && (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Auto-analyzing site...
              </p>
            )}
          </div>

          {/* Wireframe description input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Layout className="w-3 h-3 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">
                Wireframe / Site Description
              </label>
            </div>
            <ProvokeText
              chrome="inline"
              placeholder="Describe the website layout, pages, navigation, components... Paste wireframe notes or describe what you see on the site."
              value={wireframeNotes}
              onChange={onWireframeNotesChange}
              className="text-sm"
              minRows={4}
              maxRows={12}
              voice={{ mode: "append" }}
              onVoiceTranscript={(t) => onWireframeNotesChange(wireframeNotes + " " + t)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
