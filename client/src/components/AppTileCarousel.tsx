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
export function orderTemplates(
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
// Single tile card — compact horizontal variant
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
        "p-3 sm:p-4 gap-2 transition-all duration-200",
        "hover:border-primary/40 hover:shadow-md hover:bg-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "group cursor-pointer",
      )}
    >
      {/* Header row: icon + title + favorite */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">
            {template.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
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

      {/* Description */}
      <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3">
        {template.description}
      </p>

      {/* Use cases */}
      <ul className="flex flex-col gap-1 mt-auto">
        {template.useCases.slice(0, 2).map((uc, i) => (
          <li
            key={i}
            className="text-[11px] leading-snug text-muted-foreground flex items-start gap-1.5"
          >
            <span className="shrink-0 mt-[3px] w-1 h-1 rounded-full bg-primary/50" />
            <span className="line-clamp-1">{uc}</span>
          </li>
        ))}
      </ul>

      {/* Rating row */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
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
// Dot indicator
// ---------------------------------------------------------------------------

function DotIndicator({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            i === current
              ? "bg-primary scale-110"
              : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
          )}
          aria-label={`Go to panel ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal rotating carousel — shows 3 panels, rotates every 5s
// ---------------------------------------------------------------------------

const VISIBLE_COUNT = 6;
const ROTATION_INTERVAL_MS = 5000;

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ordered = useMemo(
    () => orderTemplates(templates, favorites),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates.length, favorites.size],
  );

  const totalSlides = ordered.length;

  const handleSelect = useCallback(
    (t: PrebuiltTemplate) => onSelect(t),
    [onSelect],
  );

  // Get the 3 visible templates (wrapping around)
  const visibleTemplates = useMemo(() => {
    const items: PrebuiltTemplate[] = [];
    for (let i = 0; i < VISIBLE_COUNT; i++) {
      items.push(ordered[(currentIndex + i) % totalSlides]);
    }
    return items;
  }, [ordered, currentIndex, totalSlides]);

  // Navigate
  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index % totalSlides);
  }, [totalSlides]);

  // Auto-rotation timer
  useEffect(() => {
    if (isPaused || totalSlides <= VISIBLE_COUNT) return;

    timerRef.current = setInterval(goNext, ROTATION_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, goNext, totalSlides]);

  // Pause on hover, resume on leave
  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  if (totalSlides === 0) return null;

  return (
    <div
      className="w-full flex flex-col flex-1 min-h-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header with nav buttons */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0">
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
            onClick={goPrev}
            aria-label="Previous application"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={goNext}
            aria-label="Next application"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 3×2 panel grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-2 gap-3 px-1">
        {visibleTemplates.map((template, i) => (
          <div
            key={`${currentIndex}-${i}`}
            className={cn(
              "min-h-0 flex flex-col",
              "animate-in fade-in slide-in-from-right-4 duration-300",
            )}
            style={{ animationDelay: `${i * 50}ms` }}
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

      {/* Dot indicators + progress bar */}
      <div className="flex items-center justify-center gap-3 pt-3 shrink-0">
        <DotIndicator
          total={totalSlides}
          current={currentIndex}
          onDotClick={goTo}
        />
      </div>
    </div>
  );
}
