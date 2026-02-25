import { StickyNote } from "lucide-react";
import { ProvokeText } from "@/components/ProvokeText";

interface SessionNotesPanelProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function SessionNotesPanel({
  notes,
  onNotesChange,
}: SessionNotesPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Session Notes</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Working notes for this document. Rules, constraints, and temporary context that guide the writer.
        </p>
      </div>

      <div className="flex-1 min-h-0 p-3">
        <ProvokeText
          chrome="bare"
          variant="editor"
          placeholder="Add notes, rules, or constraints for this document. For example: 'Keep the outline as-is', 'Use bullet points for acceptance criteria', 'Don't merge sections'..."
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
