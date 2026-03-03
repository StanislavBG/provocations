import { useState, useMemo, useCallback, useEffect } from "react";
import { useFtuxShell, type OutputType, type ToolId } from "@/lib/ftux-shell-context";
import { cn } from "@/lib/utils";
import {
  FileText,
  Image,
  ClipboardList,
  Clock,
  BookOpen,
  Presentation,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OutputCard {
  outputType: OutputType;
  title: string;
  description: string;
  icon: LucideIcon;
  buildTool: ToolId;
}

const OUTPUT_CARDS: OutputCard[] = [
  {
    outputType: "blog-post",
    title: "Blog Post",
    description: "Write a compelling blog post",
    icon: FileText,
    buildTool: "writer",
  },
  {
    outputType: "infographic",
    title: "Infographic",
    description: "Design a data-rich visual",
    icon: Image,
    buildTool: "painter",
  },
  {
    outputType: "prd",
    title: "Product Requirements",
    description: "Define a product spec",
    icon: ClipboardList,
    buildTool: "writer",
  },
  {
    outputType: "timeline",
    title: "Timeline",
    description: "Map events and milestones",
    icon: Clock,
    buildTool: "timeline",
  },
  {
    outputType: "research-paper",
    title: "Research Paper",
    description: "Synthesize research into a paper",
    icon: BookOpen,
    buildTool: "writer",
  },
  {
    outputType: "slide-deck",
    title: "Slide Deck",
    description: "Build a presentation from ideas",
    icon: Presentation,
    buildTool: "writer",
  },
];

function getVisibleCards(shuffled: OutputCard[], startIndex: number): OutputCard[] {
  const len = shuffled.length;
  return [
    shuffled[startIndex % len],
    shuffled[(startIndex + 1) % len],
    shuffled[(startIndex + 2) % len],
  ];
}

export function FtuxLandingCards() {
  const { startWorkflow } = useFtuxShell();
  const [startIndex, setStartIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const shuffled = useMemo(() => {
    const arr = [...OUTPUT_CARDS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  const len = shuffled.length;
  const visible = getVisibleCards(shuffled, startIndex);

  const goLeft = useCallback(() => {
    setDirection("left");
    setStartIndex((prev) => (prev - 1 + len) % len);
  }, [len]);

  const goRight = useCallback(() => {
    setDirection("right");
    setStartIndex((prev) => (prev + 1) % len);
  }, [len]);

  // Keyboard navigation: left/right arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goLeft();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goRight();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goLeft, goRight]);

  const animClass =
    direction === "right"
      ? "animate-in slide-in-from-right-4 fade-in duration-300"
      : direction === "left"
        ? "animate-in slide-in-from-left-4 fade-in duration-300"
        : "animate-in fade-in duration-300";

  return (
    <div className="h-full w-full flex items-center justify-center p-6 pb-24">
      <div className="max-w-3xl w-full space-y-3">
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-serif font-bold text-foreground">
            What would you like to create?
          </h1>
          <p className="text-xs text-muted-foreground">
            Choose an output type and we'll guide you through gathering, workshopping, and building.
          </p>
        </div>

        <div
          className="flex items-center justify-center gap-3"
          role="region"
          aria-label="Output type carousel"
          aria-roledescription="carousel"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous output types"
            className="shrink-0 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={goLeft}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div
            key={startIndex}
            className={cn("flex gap-4", animClass)}
            role="list"
            aria-live="polite"
          >
            {visible.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.outputType}
                  role="listitem"
                  aria-label={`Create ${card.title}: ${card.description}`}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 p-4 rounded-2xl border border-border/50",
                    "bg-card/50 backdrop-blur-sm w-[220px]",
                    "hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                    "hover:-translate-y-1 transition-all duration-200",
                    "text-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  )}
                  onClick={() => startWorkflow(card.outputType, card.buildTool)}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-serif font-semibold text-foreground">
                      {card.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Next output types"
            className="shrink-0 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={goRight}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
