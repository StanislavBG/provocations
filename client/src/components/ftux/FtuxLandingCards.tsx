import { useFtuxShell, type OutputType, type ToolId } from "@/lib/ftux-shell-context";
import { cn } from "@/lib/utils";
import {
  FileText,
  Image,
  ClipboardList,
  Clock,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

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
];

export function FtuxLandingCards() {
  const { startWorkflow } = useFtuxShell();

  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">
            What would you like to create?
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose an output type and we'll guide you through gathering, workshopping, and building.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OUTPUT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.outputType}
                className={cn(
                  "group relative flex flex-col items-center gap-4 p-6 rounded-2xl border border-border/50",
                  "bg-card/50 backdrop-blur-sm",
                  "hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                  "hover:-translate-y-1 transition-all duration-200",
                  "text-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  "min-h-[200px]",
                )}
                onClick={() => startWorkflow(card.outputType, card.buildTool)}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-serif font-semibold text-foreground">
                    {card.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
                <div className="mt-auto pt-2">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                    Gather → Workshop → Build
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
