import { useState } from "react";
import { ProvokeText } from "./ProvokeText";
import { ScreenCaptureButton, type CaptureAnnotation } from "./ScreenCaptureButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Layout,
  Loader2,
  Check,
  Camera,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Component,
  Lightbulb,
  Map,
  Video,
  Music,
  Rss,
  Image,
  FileText,
  AlignLeft,
} from "lucide-react";
import type { WireframeAnalysisResponse } from "@shared/schema";

interface StreamingWireframePanelProps {
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  wireframeNotes: string;
  onWireframeNotesChange: (notes: string) => void;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  wireframeAnalysis: WireframeAnalysisResponse | null;
  onCapture: (imageDataUrl: string, annotations: CaptureAnnotation[]) => void;
  captureDisabled?: boolean;
}

export function StreamingWireframePanel({
  websiteUrl,
  onWebsiteUrlChange,
  wireframeNotes,
  onWireframeNotesChange,
  isAnalyzing,
  hasAnalysis,
  wireframeAnalysis,
  onCapture,
  captureDisabled,
}: StreamingWireframePanelProps) {
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Count total discovered content items
  const discoveredCount = wireframeAnalysis
    ? (wireframeAnalysis.siteMap?.length || 0) +
      (wireframeAnalysis.videos?.length || 0) +
      (wireframeAnalysis.audioContent?.length || 0) +
      (wireframeAnalysis.rssFeeds?.length || 0) +
      (wireframeAnalysis.images?.length || 0)
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-sm">Website Wireframe</h3>
        <div className="ml-auto flex items-center gap-1.5">
          {isAnalyzing && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing...
            </Badge>
          )}
          {!isAnalyzing && hasAnalysis && (
            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
              <Check className="w-3 h-3" />
              Analyzed
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-3 space-y-3">
          {/* Website URL input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">Target Website URL</label>
            </div>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => onWebsiteUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="text-sm px-3 py-1.5 border rounded-md bg-background"
            />
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

          {/* Capture button row */}
          <div className="flex items-center gap-2 pt-1">
            <ScreenCaptureButton
              onCapture={onCapture}
              disabled={captureDisabled}
            />
            <span className="text-xs text-muted-foreground">
              <Camera className="w-3 h-3 inline mr-1" />
              Capture &amp; mark wireframe
            </span>
          </div>

          {/* Analysis Log toggle — only shown when analysis exists or is loading */}
          {(wireframeAnalysis || isAnalyzing) && (
            <div className="border rounded-md overflow-hidden">
              <button
                onClick={() => setIsLogOpen(!isLogOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
              >
                <ScrollText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium text-muted-foreground flex-1">
                  Analysis Log
                </span>
                {isAnalyzing && (
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                )}
                {wireframeAnalysis && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {wireframeAnalysis.components.length} comp
                    {discoveredCount > 0 ? ` + ${discoveredCount} items` : ""}
                  </Badge>
                )}
                {isLogOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>

              {isLogOpen && (
                <ScrollArea className="max-h-[400px]">
                  {/* Loading state */}
                  {isAnalyzing && !wireframeAnalysis && (
                    <div className="px-3 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analyzing website structure and content...
                    </div>
                  )}

                  {wireframeAnalysis && (
                    <div className="px-3 py-2 space-y-3 text-xs">
                      {/* Summary */}
                      {wireframeAnalysis.analysis && (
                        <ContentDiscoverySection
                          icon={<AlignLeft className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                          title="Summary"
                        >
                          <p className="text-muted-foreground leading-relaxed">
                            {wireframeAnalysis.analysis}
                          </p>
                        </ContentDiscoverySection>
                      )}

                      {/* Site Map */}
                      {wireframeAnalysis.siteMap && wireframeAnalysis.siteMap.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Map className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                          title="Site Map"
                          count={wireframeAnalysis.siteMap.length}
                        >
                          <div className="space-y-0.5">
                            {wireframeAnalysis.siteMap.map((page, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1 text-muted-foreground"
                                style={{ paddingLeft: `${page.depth * 12}px` }}
                              >
                                <span className="text-[10px] opacity-40">
                                  {page.depth === 0 ? "/" : "|--"}
                                </span>
                                <span className="truncate flex-1">{page.title}</span>
                                {page.url && (
                                  <span className="text-[9px] text-muted-foreground/50 truncate max-w-[120px]">
                                    {page.url}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </ContentDiscoverySection>
                      )}

                      {/* Audio */}
                      {wireframeAnalysis.audioContent && wireframeAnalysis.audioContent.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Music className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                          title="Audio"
                          count={wireframeAnalysis.audioContent.length}
                        >
                          <div className="space-y-0.5">
                            {wireframeAnalysis.audioContent.map((a, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-muted-foreground">
                                <Music className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                <span className="truncate flex-1">{a.title}</span>
                                {a.type && (
                                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                    {a.type}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </ContentDiscoverySection>
                      )}

                      {/* RSS Feeds */}
                      {wireframeAnalysis.rssFeeds && wireframeAnalysis.rssFeeds.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Rss className="w-3 h-3 text-orange-600 dark:text-orange-400" />}
                          title="RSS Feeds"
                          count={wireframeAnalysis.rssFeeds.length}
                        >
                          <div className="space-y-0.5">
                            {wireframeAnalysis.rssFeeds.map((f, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-muted-foreground">
                                <Rss className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                <span className="truncate flex-1">{f.title}</span>
                                {f.type && (
                                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                    {f.type}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </ContentDiscoverySection>
                      )}

                      {/* Components */}
                      {wireframeAnalysis.components.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Component className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />}
                          title="Components"
                          count={wireframeAnalysis.components.length}
                        >
                          <div className="flex flex-wrap gap-1">
                            {wireframeAnalysis.components.map((comp, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px]">
                                {comp}
                              </Badge>
                            ))}
                          </div>
                        </ContentDiscoverySection>
                      )}

                      {/* Notes */}
                      {wireframeAnalysis.suggestions.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Lightbulb className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                          title="Notes"
                          count={wireframeAnalysis.suggestions.length}
                        >
                          <ul className="text-muted-foreground space-y-0.5 pl-1">
                            {wireframeAnalysis.suggestions.map((sug, idx) => (
                              <li key={idx} className="pl-2 border-l-2 border-amber-300 dark:border-amber-700 leading-relaxed">
                                {sug}
                              </li>
                            ))}
                          </ul>
                        </ContentDiscoverySection>
                      )}

                      {/* Videos */}
                      {wireframeAnalysis.videos && wireframeAnalysis.videos.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Video className="w-3 h-3 text-red-600 dark:text-red-400" />}
                          title="Videos"
                          count={wireframeAnalysis.videos.length}
                        >
                          <div className="space-y-0.5">
                            {wireframeAnalysis.videos.map((v, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-muted-foreground">
                                <Video className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                <span className="truncate flex-1">{v.title}</span>
                                {v.type && (
                                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                    {v.type}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </ContentDiscoverySection>
                      )}

                      {/* Images */}
                      {wireframeAnalysis.images && wireframeAnalysis.images.length > 0 && (
                        <ContentDiscoverySection
                          icon={<Image className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
                          title="Images"
                          count={wireframeAnalysis.images.length}
                        >
                          <div className="space-y-0.5">
                            {wireframeAnalysis.images.map((img, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-muted-foreground">
                                <Image className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                <span className="truncate flex-1">{img.title}</span>
                                {img.type && (
                                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                    {img.type}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </ContentDiscoverySection>
                      )}

                      {/* Primary Content */}
                      {wireframeAnalysis.primaryContent && (
                        <ContentDiscoverySection
                          icon={<FileText className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
                          title="Primary Content"
                        >
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {wireframeAnalysis.primaryContent}
                          </p>
                        </ContentDiscoverySection>
                      )}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Collapsible section used for each content discovery category */
function ContentDiscoverySection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-md overflow-hidden bg-muted/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/10 transition-colors text-left"
      >
        {icon}
        <span className="font-medium text-muted-foreground text-[11px] flex-1">{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="outline" className="text-[9px] h-4">
            {count}
          </Badge>
        )}
        {open ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 text-xs">
          {children}
        </div>
      )}
    </div>
  );
}
