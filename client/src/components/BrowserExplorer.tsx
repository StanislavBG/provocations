import { useState, useCallback, useRef, useEffect } from "react";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BrowserExplorerProps {
  websiteUrl: string;
  onUrlChange?: (url: string) => void;
  showLogPanel?: boolean;
  onToggleLogPanel?: () => void;
  isAnalyzing?: boolean;
  discoveredCount?: number;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function BrowserExplorer({
  websiteUrl,
  onUrlChange,
  showLogPanel,
  onToggleLogPanel,
  isAnalyzing,
  discoveredCount = 0,
}: BrowserExplorerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [addressBar, setAddressBar] = useState(websiteUrl);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Suppress cross-origin errors from iframe scripts (TCF consent, ad frameworks, etc.)
  useEffect(() => {
    const suppressCrossOriginErrors = (event: ErrorEvent) => {
      if (
        event.message?.includes("SecurityError") ||
        event.message?.includes("Blocked a frame") ||
        event.message?.includes("cross-origin") ||
        event.message?.includes("TCF") ||
        event.message?.includes("Permissions policy")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    };

    const suppressUnhandledRejections = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason);
      if (
        reason.includes("SecurityError") ||
        reason.includes("cross-origin") ||
        reason.includes("Blocked a frame")
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", suppressCrossOriginErrors, true);
    window.addEventListener("unhandledrejection", suppressUnhandledRejections);
    return () => {
      window.removeEventListener("error", suppressCrossOriginErrors, true);
      window.removeEventListener("unhandledrejection", suppressUnhandledRejections);
    };
  }, []);

  // Sync address bar when parent URL changes
  useEffect(() => {
    if (websiteUrl !== addressBar) {
      setAddressBar(websiteUrl);
    }
    // Only react to websiteUrl changes from parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl]);

  // Auto-navigate when a valid URL comes from parent
  useEffect(() => {
    const normalized = normalizeUrl(websiteUrl);
    if (normalized && normalized !== loadedUrl) {
      navigateToUrl(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl]);

  const navigateToUrl = useCallback((url: string) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    setLoadedUrl(normalized);
    setIsLoading(true);
    setHasError(false);
  }, []);

  const handleAddressBarSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(addressBar);
    if (normalized) {
      navigateToUrl(normalized);
      onUrlChange?.(addressBar);
    }
  }, [addressBar, navigateToUrl, onUrlChange]);

  const handleRefresh = useCallback(() => {
    if (loadedUrl && iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      // Force reload by briefly clearing src
      const current = loadedUrl;
      iframeRef.current.src = "";
      requestAnimationFrame(() => {
        if (iframeRef.current) {
          iframeRef.current.src = current;
        }
      });
    }
  }, [loadedUrl]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (loadedUrl) {
      window.open(loadedUrl, "_blank", "noopener,noreferrer");
    }
  }, [loadedUrl]);

  return (
    <div className={`h-full flex flex-col bg-background ${isExpanded ? "fixed inset-0 z-50" : ""}`}>
      {/* Browser Chrome */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 shrink-0">
        {/* Navigation buttons */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={!loadedUrl}
            title="Refresh"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Address bar */}
        <form onSubmit={handleAddressBarSubmit} className="flex-1 flex items-center">
          <div className="flex-1 flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 text-sm">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <input
              type="text"
              value={addressBar}
              onChange={(e) => setAddressBar(e.target.value)}
              placeholder="Enter URL to explore..."
              className="flex-1 bg-transparent outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddressBarSubmit(e);
                }
              }}
            />
          </div>
        </form>

        {/* Toolbar actions */}
        <div className="flex items-center gap-0.5">
          {onToggleLogPanel && (
            <Button
              variant={showLogPanel ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1 text-xs px-2"
              onClick={onToggleLogPanel}
              title="Toggle site analysis log"
            >
              <ScrollText className="w-3.5 h-3.5" />
              Log
              {(isAnalyzing || discoveredCount > 0) && (
                <Badge
                  variant={showLogPanel ? "secondary" : "outline"}
                  className="text-[9px] h-4 ml-0.5"
                >
                  {isAnalyzing ? "..." : discoveredCount}
                </Badge>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleOpenExternal}
            disabled={!loadedUrl}
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Browser viewport */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {loadedUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={loadedUrl}
              title="Browser Explorer"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
              allow="payment; encrypted-media; autoplay; fullscreen"
              referrerPolicy="no-referrer"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              </div>
            )}
            {/* Error state */}
            {hasError && (
              <div className="absolute inset-0 bg-background flex items-center justify-center">
                <div className="text-center space-y-3 max-w-sm px-4">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-sm font-medium">Unable to load this website</p>
                  <p className="text-xs text-muted-foreground">
                    This site may block embedding. Try opening it in a new tab instead.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleOpenExternal} className="gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3 max-w-sm px-4">
              <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Enter a URL above or in the Website Context panel to start exploring
              </p>
              <Badge variant="outline" className="text-xs">
                Browse side-by-side while building requirements
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
