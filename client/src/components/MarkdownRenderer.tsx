import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Max characters per chunk for very long docs. Default 50000 */
  chunkSize?: number;
  onSelectText?: (selectedText: string, position: { x: number; y: number }) => void;
}

/**
 * Renders markdown content with support for very long documents.
 * Uses chunked rendering with intersection-observer-based lazy loading
 * to avoid rendering 100k+ character docs in a single pass.
 */
export function MarkdownRenderer({
  content,
  className = "",
  chunkSize = 50000,
  onSelectText,
}: MarkdownRendererProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleChunks, setVisibleChunks] = useState<Set<number>>(new Set([0, 1]));

  // Split long content into chunks at paragraph boundaries
  const chunks = useMemo(() => {
    if (content.length <= chunkSize) {
      return [content];
    }

    const result: string[] = [];
    let remaining = content;

    while (remaining.length > 0) {
      if (remaining.length <= chunkSize) {
        result.push(remaining);
        break;
      }

      // Find a paragraph break near the chunk boundary
      let splitIdx = remaining.lastIndexOf("\n\n", chunkSize);
      if (splitIdx < chunkSize * 0.5) {
        // No good paragraph break found, try single newline
        splitIdx = remaining.lastIndexOf("\n", chunkSize);
      }
      if (splitIdx < chunkSize * 0.5) {
        // No newline found before chunkSize — this means we're inside a
        // very long line (e.g. a base64 data-URL image).  Instead of
        // hard-cutting mid-line (which would break markdown image syntax),
        // find the next newline *after* chunkSize to keep the line intact.
        splitIdx = remaining.indexOf("\n", chunkSize);
        if (splitIdx === -1) {
          // No newline at all in the remainder — take everything
          result.push(remaining);
          break;
        }
      }

      result.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx);
    }

    return result;
  }, [content, chunkSize]);

  // Intersection observer for lazy chunk loading
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const chunkIdx = parseInt(entry.target.getAttribute("data-chunk-idx") || "0", 10);
        setVisibleChunks(prev => {
          const next = new Set(prev);
          // Load this chunk and the next two
          next.add(chunkIdx);
          next.add(chunkIdx + 1);
          next.add(chunkIdx + 2);
          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(sentinelCallback, {
      rootMargin: "200px",
      threshold: 0,
    });
    return () => observerRef.current?.disconnect();
  }, [sentinelCallback]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  // Handle text selection for toolbar actions
  const handleMouseUp = useCallback(() => {
    if (!onSelectText) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 5) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    onSelectText(text, { x: rect.left + rect.width / 2, y: rect.top });
  }, [onSelectText]);

  const isLongDoc = chunks.length > 1;

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div
        className={`prose prose-stone dark:prose-invert max-w-none px-8 py-6 ${className}`}
        onMouseUp={handleMouseUp}
      >
        {chunks.map((chunk, idx) => {
          const shouldRender = !isLongDoc || visibleChunks.has(idx);
          return (
            <div key={idx}>
              {shouldRender ? (
                <ReactMarkdown
                  urlTransform={(url) => {
                    // Allow data:image/ URLs for embedded screenshots
                    if (url.startsWith("data:image/")) return url;
                    return defaultUrlTransform(url);
                  }}
                  components={{
                    img: ({ src, alt, ...props }) => (
                      <img
                        src={src}
                        alt={alt || ""}
                        className="max-w-full h-auto rounded-lg border my-4"
                        loading="lazy"
                        {...props}
                      />
                    ),
                    // Ensure tables render nicely
                    table: ({ children, ...props }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full" {...props}>{children}</table>
                      </div>
                    ),
                  }}
                >
                  {chunk}
                </ReactMarkdown>
              ) : (
                <div
                  ref={sentinelRef}
                  data-chunk-idx={idx}
                  className="h-[200px] flex items-center justify-center text-muted-foreground text-sm"
                >
                  Loading section {idx + 1}...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
