import { useState, useMemo, useCallback } from "react";
import { useRoute } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  HELP_PAGES,
  getHelpCategories,
  getPagesByCategory,
  searchHelpPages,
} from "@/lib/helpContent";
import {
  Search,
  ChevronDown,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Help page — sidebar + markdown content layout.
 *
 * Routes:
 *   /help            → shows getting-started
 *   /help/:pageSlug  → shows specific page
 *
 * Mobile: sidebar collapses to a dropdown.
 */
export default function Help() {
  // Try to match /help/:pageSlug
  const [, params] = useRoute("/help/:pageSlug");
  const activeSlug = params?.pageSlug || "getting-started";

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const categories = useMemo(() => getHelpCategories(), []);

  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchHelpPages(searchQuery) : []),
    [searchQuery],
  );

  const activePage = HELP_PAGES[activeSlug];

  const navigateTo = useCallback(
    (slug: string) => {
      window.history.pushState(null, "", `/help/${slug}`);
      // Trigger wouter re-render
      window.dispatchEvent(new PopStateEvent("popstate"));
      setMobileSidebarOpen(false);
      setSearchQuery("");
    },
    [],
  );

  // ── Sidebar content (shared between desktop and mobile) ──
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Search results */}
          {searchQuery.trim() && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
              </p>
              {searchResults.map((result) => (
                <button
                  key={result.slug}
                  onClick={() => navigateTo(result.slug)}
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors",
                    result.slug === activeSlug
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {result.title}
                  <span className="block text-[10px] text-muted-foreground/60">
                    {result.category}
                  </span>
                </button>
              ))}
              {searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-2 py-2">
                  No pages match your search.
                </p>
              )}
            </div>
          )}

          {/* Category listing */}
          {!searchQuery.trim() &&
            categories.map((category) => {
              const pages = getPagesByCategory(category);
              return (
                <div key={category} className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
                    {category}
                  </p>
                  {pages.map((page) => (
                    <button
                      key={page.slug}
                      onClick={() => navigateTo(page.slug)}
                      className={cn(
                        "w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors",
                        page.slug === activeSlug
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      {page.title}
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 shrink-0">
        <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <BookOpen className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold">Help</h1>
        {activePage && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            / {activePage.title}
          </span>
        )}

        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto sm:hidden text-xs gap-1.5"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        >
          Topics
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              mobileSidebarOpen && "rotate-180",
            )}
          />
        </Button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-56 border-r border-border/50 flex-col shrink-0">
          {sidebarContent}
        </aside>

        {/* Mobile dropdown sidebar */}
        {mobileSidebarOpen && (
          <div className="absolute top-14 left-0 right-0 z-50 bg-background border-b border-border shadow-lg sm:hidden max-h-[60vh] overflow-auto">
            {sidebarContent}
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {activePage ? (
            <MarkdownRenderer content={activePage.content} className="max-w-3xl mx-auto" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Page not found.</p>
                <Button variant="outline" size="sm" onClick={() => navigateTo("getting-started")}>
                  Go to Getting Started
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
