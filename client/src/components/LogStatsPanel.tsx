import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  Globe,
  Component,
  Lightbulb,
  Map,
  Video,
  Music,
  Rss,
  Image,
  FileText,
  AlignLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  ScrollText,
  ExternalLink,
} from "lucide-react";
import type { WireframeAnalysisResponse } from "@shared/schema";

interface LogStatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  wireframeAnalysis: WireframeAnalysisResponse | null;
  isAnalyzing: boolean;
  websiteUrl: string;
}

export function LogStatsPanel({
  isOpen,
  onClose,
  wireframeAnalysis,
  isAnalyzing,
  websiteUrl,
}: LogStatsPanelProps) {
  if (!isOpen) return null;

  const discoveredCount = wireframeAnalysis
    ? (wireframeAnalysis.siteMap?.length || 0) +
      (wireframeAnalysis.videos?.length || 0) +
      (wireframeAnalysis.audioContent?.length || 0) +
      (wireframeAnalysis.rssFeeds?.length || 0) +
      (wireframeAnalysis.images?.length || 0)
    : 0;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/80 border-l animate-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-card/80 shrink-0">
        <ScrollText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-sm flex-1">Site Analysis Log</h3>
        {isAnalyzing && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing...
          </Badge>
        )}
        {!isAnalyzing && wireframeAnalysis && (
          <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
            {wireframeAnalysis.components.length} components
            {discoveredCount > 0 ? ` + ${discoveredCount} items` : ""}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          title="Close log panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* URL context */}
          {websiteUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/20 text-sm">
              <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 text-muted-foreground">{websiteUrl}</span>
              <a
                href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Loading state */}
          {isAnalyzing && !wireframeAnalysis && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-sm text-muted-foreground">Crawling and analyzing website structure...</p>
            </div>
          )}

          {/* No analysis yet */}
          {!isAnalyzing && !wireframeAnalysis && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <ScrollText className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Enter a URL in the browser panel to analyze the website.
              </p>
              <p className="text-xs text-muted-foreground/60">
                The analysis will reveal metadata, sitemap, media, feeds, and more.
              </p>
            </div>
          )}

          {/* Analysis results */}
          {wireframeAnalysis && (
            <div className="space-y-3">
              {/* Summary */}
              {wireframeAnalysis.analysis && (
                <CollapsibleSection
                  icon={<AlignLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  title="Summary"
                >
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {wireframeAnalysis.analysis}
                  </p>
                </CollapsibleSection>
              )}

              {/* Site Map */}
              {wireframeAnalysis.siteMap && wireframeAnalysis.siteMap.length > 0 && (
                <CollapsibleSection
                  icon={<Map className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  title="Site Map"
                  count={wireframeAnalysis.siteMap.length}
                >
                  <div className="space-y-1">
                    {wireframeAnalysis.siteMap.map((page, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground"
                        style={{ paddingLeft: `${page.depth * 16}px` }}
                      >
                        <span className="text-xs opacity-40 shrink-0">
                          {page.depth === 0 ? "/" : "|--"}
                        </span>
                        <span className="truncate flex-1">{page.title}</span>
                        {page.url && (
                          <span className="text-[10px] text-muted-foreground/40 truncate max-w-[150px] shrink-0">
                            {page.url}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Audio Content */}
              {wireframeAnalysis.audioContent && wireframeAnalysis.audioContent.length > 0 && (
                <CollapsibleSection
                  icon={<Music className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                  title="Audio Content"
                  count={wireframeAnalysis.audioContent.length}
                >
                  <div className="space-y-1">
                    {wireframeAnalysis.audioContent.map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Music className="w-3 h-3 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{a.title}</span>
                        {a.type && (
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {a.type}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* RSS Feeds */}
              {wireframeAnalysis.rssFeeds && wireframeAnalysis.rssFeeds.length > 0 && (
                <CollapsibleSection
                  icon={<Rss className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
                  title="RSS Feeds"
                  count={wireframeAnalysis.rssFeeds.length}
                >
                  <div className="space-y-1">
                    {wireframeAnalysis.rssFeeds.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Rss className="w-3 h-3 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{f.title}</span>
                        {f.type && (
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {f.type}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Detected Components */}
              {wireframeAnalysis.components.length > 0 && (
                <CollapsibleSection
                  icon={<Component className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
                  title="Detected Components"
                  count={wireframeAnalysis.components.length}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {wireframeAnalysis.components.map((comp, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {comp}
                      </Badge>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Notes & Insights */}
              {wireframeAnalysis.suggestions.length > 0 && (
                <CollapsibleSection
                  icon={<Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                  title="Notes & Insights"
                  count={wireframeAnalysis.suggestions.length}
                >
                  <ul className="space-y-1.5">
                    {wireframeAnalysis.suggestions.map((sug, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-muted-foreground pl-3 border-l-2 border-amber-300 dark:border-amber-700 leading-relaxed"
                      >
                        {sug}
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}

              {/* Videos */}
              {wireframeAnalysis.videos && wireframeAnalysis.videos.length > 0 && (
                <CollapsibleSection
                  icon={<Video className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                  title="Videos"
                  count={wireframeAnalysis.videos.length}
                >
                  <div className="space-y-1">
                    {wireframeAnalysis.videos.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Video className="w-3 h-3 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{v.title}</span>
                        {v.type && (
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {v.type}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Images */}
              {wireframeAnalysis.images && wireframeAnalysis.images.length > 0 && (
                <CollapsibleSection
                  icon={<Image className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                  title="Images"
                  count={wireframeAnalysis.images.length}
                >
                  <div className="space-y-1">
                    {wireframeAnalysis.images.map((img, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Image className="w-3 h-3 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{img.title}</span>
                        {img.type && (
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {img.type}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Primary Content */}
              {wireframeAnalysis.primaryContent && (
                <CollapsibleSection
                  icon={<FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />}
                  title="Primary Content"
                >
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {wireframeAnalysis.primaryContent}
                  </p>
                </CollapsibleSection>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Collapsible section for grouping analysis content */
function CollapsibleSection({
  icon,
  title,
  count,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden bg-card/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
      >
        {icon}
        <span className="font-medium text-sm flex-1">{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5">
            {count}
          </Badge>
        )}
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
