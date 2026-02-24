import { StickyNote } from "lucide-react";
import { ProvokeText } from "@/components/ProvokeText";

interface ResearchNotesPanelProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function ResearchNotesPanel({
  notes,
  onNotesChange,
}: ResearchNotesPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Notes</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Build your research notes here. Capture findings from the chat or type your own.
        </p>
      </div>

      {/* Notes editor */}
      <div className="flex-1 min-h-0 p-3">
        <ProvokeText
          chrome="bare"
          variant="editor"
          placeholder="Your research notes will appear here. Capture insights from the chat by clicking the bookmark icon on any response, or type your own notes..."
          className="text-sm leading-relaxed font-serif h-full"
          containerClassName="h-full"
          value={notes}
          onChange={onNotesChange}
          showCopy
          showClear
          voice={{ mode: "append" }}
          onVoiceTranscript={(transcript) =>
            onNotesChange(notes ? notes + "\n\n" + transcript : transcript)
          }
        />
      </div>
    </div>
  );
}
