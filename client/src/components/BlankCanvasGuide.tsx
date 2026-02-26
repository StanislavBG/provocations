/**
 * BlankCanvasGuide — contextual prompts when the workspace document is empty.
 * Helps users get started instead of staring at a blank page.
 */
import { Lightbulb, Mic, ClipboardPaste, MessageSquare, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlankCanvasGuideProps {
  templateName?: string;
  objective?: string;
  onStartDictating?: () => void;
  onFocusEditor?: () => void;
}

const QUICK_ACTIONS = [
  {
    icon: PenLine,
    label: "Start typing",
    description: "Write directly in the editor below",
    action: "focus" as const,
  },
  {
    icon: Mic,
    label: "Dictate your ideas",
    description: "Click the mic icon in the editor to speak",
    action: "dictate" as const,
  },
  {
    icon: ClipboardPaste,
    label: "Paste existing notes",
    description: "Ctrl+V your research, drafts, or outlines",
    action: "focus" as const,
  },
  {
    icon: MessageSquare,
    label: "Ask the personas",
    description: "Open the discussion panel and ask for help",
    action: "none" as const,
  },
];

export function BlankCanvasGuide({
  templateName,
  objective,
  onStartDictating,
  onFocusEditor,
}: BlankCanvasGuideProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center space-y-5 animate-in fade-in duration-300">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Lightbulb className="w-6 h-6 text-primary" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="text-base font-serif font-semibold">
          {templateName ? `Your ${templateName} workspace is ready` : "Your workspace is ready"}
        </h3>
        {objective && (
          <p className="text-sm text-muted-foreground italic">
            "{objective.length > 120 ? objective.slice(0, 120) + "..." : objective}"
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Here are a few ways to get started:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {QUICK_ACTIONS.map((qa) => {
          const Icon = qa.icon;
          return (
            <button
              key={qa.label}
              onClick={() => {
                if (qa.action === "dictate" && onStartDictating) onStartDictating();
                else if (qa.action === "focus" && onFocusEditor) onFocusEditor();
              }}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{qa.label}</p>
                <p className="text-xs text-muted-foreground">{qa.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground max-w-sm">
        The AI will challenge your thinking as you write. Each persona brings a different perspective — the more context you provide, the better the feedback.
      </p>
    </div>
  );
}
