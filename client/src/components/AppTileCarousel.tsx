import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Star, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PrebuiltTemplate } from "@/lib/prebuiltTemplates";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle (immutable) */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Order templates so favorites fill ~50 % of early positions,
 * the rest are shuffled randomly so every app gets exposure.
 */
function orderTemplates(
  templates: PrebuiltTemplate[],
  favorites: Set<string>,
): PrebuiltTemplate[] {
  const favs = shuffle(templates.filter((t) => favorites.has(t.id)));
  const rest = shuffle(templates.filter((t) => !favorites.has(t.id)));

  if (favs.length === 0) return rest;

  // Interleave: 1 fav, 1 rest, 1 fav, 1 rest… until one pool runs out
  const ordered: PrebuiltTemplate[] = [];
  let fi = 0;
  let ri = 0;
  while (fi < favs.length || ri < rest.length) {
    if (fi < favs.length) ordered.push(favs[fi++]);
    if (ri < rest.length) ordered.push(rest[ri++]);
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// Star rating (inline, 1-5)
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(value === n ? 0 : n);
          }}
          className="p-0.5 transition-colors hover:scale-110"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 hover:text-amber-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single tile card
// ---------------------------------------------------------------------------

function AppTile({
  template,
  isFavorite,
  rating,
  onSelect,
  onToggleFavorite,
  onRate,
}: {
  template: PrebuiltTemplate;
  isFavorite: boolean;
  rating: number;
  onSelect: (t: PrebuiltTemplate) => void;
  onToggleFavorite: (id: string) => void;
  onRate: (id: string, v: number) => void;
}) {
  const Icon = template.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={cn(
        "relative flex flex-col text-left w-full h-full",
        "rounded-xl border bg-card/80 backdrop-blur-sm",
        "p-4 gap-3 transition-all duration-200",
        "hover:border-primary/40 hover:shadow-md hover:bg-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "group cursor-pointer",
      )}
    >
      {/* Header row: icon + title + favorite */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight truncate">
            {template.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(template.id);
          }}
          className="shrink-0 p-1 rounded-md transition-colors hover:bg-primary/10"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={cn(
              "w-4 h-4 transition-colors",
              isFavorite
                ? "fill-red-400 text-red-400"
                : "text-muted-foreground/40 group-hover:text-muted-foreground",
            )}
          />
        </button>
      </div>

      {/* How to use — beginner instructions */}
      <p className="text-xs leading-relaxed text-foreground/80">
        {template.howTo}
      </p>

      {/* Use cases */}
      <ul className="flex flex-col gap-1 mt-auto">
        {template.useCases.map((uc, i) => (
          <li
            key={i}
            className="text-[11px] leading-snug text-muted-foreground flex items-start gap-1.5"
          >
            <span className="shrink-0 mt-[3px] w-1 h-1 rounded-full bg-primary/50" />
            {uc}
          </li>
        ))}
      </ul>

      {/* Rating row */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <StarRating
          value={rating}
          onChange={(v) => onRate(template.id, v)}
        />
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          {template.category}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Scroll-based carousel (no external library)
// ---------------------------------------------------------------------------

interface AppTileCarouselProps {
  templates: PrebuiltTemplate[];
  favorites: Set<string>;
  ratings: Record<string, number>;
  onSelect: (template: PrebuiltTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
  onRate: (templateId: string, value: number) => void;
}

export function AppTileCarousel({
  templates,
  favorites,
  ratings,
  onSelect,
  onToggleFavorite,
  onRate,
}: AppTileCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const ordered = useMemo(
    () => orderTemplates(templates, favorites),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates.length, favorites.size],
  );

  const handleSelect = useCallback(
    (t: PrebuiltTemplate) => onSelect(t),
    [onSelect],
  );

  // Update scroll button states
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll by roughly one card width + gap
    const cardWidth = el.querySelector<HTMLElement>("[data-tile]")?.offsetWidth ?? 300;
    el.scrollBy({ left: direction === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  }, []);

  return (
    <div className="w-full space-y-3">
      {/* Header with nav buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Explore applications</h2>
          <p className="text-xs text-muted-foreground">
            Pick one to get started. Favorite the ones you use most.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!canScrollLeft}
            onClick={() => scroll("left")}
            aria-label="Previous applications"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!canScrollRight}
            onClick={() => scroll("right")}
            aria-label="Next applications"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable tile row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {ordered.map((template) => (
          <div
            key={template.id}
            data-tile
            className="snap-start shrink-0 w-[280px] sm:w-[300px] lg:w-[320px]"
          >
            <AppTile
              template={template}
              isFavorite={favorites.has(template.id)}
              rating={ratings[template.id] ?? 0}
              onSelect={handleSelect}
              onToggleFavorite={onToggleFavorite}
              onRate={onRate}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
