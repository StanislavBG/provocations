import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type ToolId } from "@/lib/ftux-shell-context";
import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { FtuxDocumentWrapper, FtuxContextWrapper, FtuxFullWidthWrapper } from "./FtuxToolWrappers";
import {
  Sparkles,
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  type LucideIcon,
} from "lucide-react";

interface FtuxContentAreaProps {
  workspace: WorkspaceState;
}

const TOOL_META: Record<ToolId, { icon: LucideIcon; label: string; description: string }> = {
  research: { icon: Sparkles, label: "Research", description: "Ask questions, explore topics, and gather insights with AI-powered research chat." },
  document: { icon: FileText, label: "Document Editor", description: "Write and edit your document with multi-tab support and smart formatting." },
  provo: { icon: Users, label: "Provocations", description: "Challenge your thinking with expert personas who stress-test your ideas." },
  notes: { icon: ClipboardList, label: "Notes", description: "Capture notes via text or voice, then evolve them into your document." },
  writer: { icon: Wand2, label: "Writer", description: "Evolve your document with AI-powered writing configurations." },
  painter: { icon: Paintbrush, label: "Painter", description: "Generate images and infographics from text descriptions." },
  context: { icon: BookOpen, label: "Context Store", description: "Browse, pin, and manage your document library." },
  interview: { icon: MessageCircleQuestion, label: "Interview", description: "Guided interview questions to discover requirements and context." },
  chart: { icon: BarChart3, label: "Chart", description: "Design diagrams and flowcharts on an infinite canvas." },
  timeline: { icon: Clock, label: "Timeline", description: "Visualize events and milestones on an interactive timeline." },
};

/**
 * Renders the active tool full-width in the content area.
 * Placeholder cards are shown until real tool components are wired in.
 */
export function FtuxContentArea({ workspace }: FtuxContentAreaProps) {
  const { activeTool } = useFtuxShell();

  const content = useMemo(() => {
    if (!activeTool) return <EmptyState />;
    return <ToolPlaceholder toolId={activeTool} />;
  }, [activeTool]);

  return (
    <div className="h-full w-full overflow-hidden animate-in fade-in duration-200">
      {content}
    </div>
  );
}

function ToolPlaceholder({ toolId }: { toolId: ToolId }) {
  const meta = TOOL_META[toolId];
  const Icon = meta.icon;

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-md px-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-serif font-bold">{meta.label}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
        <p className="text-xs text-muted-foreground/60 italic mt-2">
          Tool rendering will be connected to workspace state.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm px-8">
        <Sparkles className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Select a tool from the dock to get started.</p>
      </div>
    </div>
  );
}
