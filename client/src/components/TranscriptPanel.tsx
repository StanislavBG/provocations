import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "@/components/ProvokeText";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import { PenLine, Loader2, StickyNote, ImageIcon, Paintbrush, Save, Trash2, Check, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";
import { generateId } from "@/lib/utils";

export interface NoteEntry {
  id: string;
  text: string;
  createdAt: number;
  savedToContext?: boolean;
}

interface TranscriptPanelProps {
  /** Individual note entries */
  notes: NoteEntry[];
  /** Update the notes array */
  onNotesChange: (notes: NoteEntry[]) => void;
  /** Called when user clicks Writer — merges notes into main document */
  onWriteToDocument: (text: string) => void;
  /** Whether the Writer call is in progress */
  isWriting?: boolean;
  /** The selected text context from the document (for targeted writes) */
  selectedText?: string;
  /** Called when user clicks Artify — opens the Artify panel with note text */
  onArtify?: () => void;
}

export function TranscriptPanel({
  notes,
  onNotesChange,
  onWriteToDocument,
  isWriting,
  selectedText,
  onArtify,
}: TranscriptPanelProps) {
  const { toast } = useToast();
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  // Text to Visual state
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);

  const allText = notes.map((n) => n.text).join("\n\n");
  const wordCount = allText.trim() ? allText.trim().split(/\s+/).length : 0;

  const handleSaveNote = useCallback(async (note: NoteEntry) => {
    if (!note.text.trim()) return;
    setSavingNoteId(note.id);
    try {
      const title = `Note: ${note.text.trim().slice(0, 80).replace(/\n/g, " ")}`;
      await apiRequest("POST", "/api/documents", {
        title,
        content: note.text.trim(),
      });
      onNotesChange(notes.map((n) => n.id === note.id ? { ...n, savedToContext: true } : n));
      trackEvent("note_saved_to_context");
      toast({ title: "Saved to Context", description: title });
    } catch {
      toast({ title: "Save failed", description: "Could not save note to context.", variant: "destructive" });
    } finally {
      setSavingNoteId(null);
    }
  }, [notes, onNotesChange, toast]);

  const handleDeleteNote = useCallback((noteId: string) => {
    onNotesChange(notes.filter((n) => n.id !== noteId));
  }, [notes, onNotesChange]);

  const handleUpdateNote = useCallback((noteId: string, text: string) => {
    onNotesChange(notes.map((n) => n.id === noteId ? { ...n, text, savedToContext: false } : n));
  }, [notes, onNotesChange]);

  const handleAddNote = useCallback(() => {
    const newNote: NoteEntry = {
      id: generateId("note"),
      text: "",
      createdAt: Date.now(),
    };
    onNotesChange([...notes, newNote]);
  }, [notes, onNotesChange]);

  const handleWriteAll = useCallback(() => {
    if (!allText.trim()) return;
    onWriteToDocument(allText);
  }, [allText, onWriteToDocument]);

  const handleWriteNote = useCallback((noteText: string) => {
    if (!noteText.trim()) return;
    onWriteToDocument(noteText);
  }, [onWriteToDocument]);

  const handleTextToVisual = useCallback(async () => {
    if (!allText.trim()) return;
    setIsGeneratingVisual(true);
    try {
      const response = await apiRequest("POST", "/api/text-to-visual", { text: allText });
      const data = (await response.json()) as { images?: string[]; imagePrompt?: string; error?: string };
      if (data.images && data.images.length > 0) {
        setPreviewImageUrl(data.images[0]);
        setPreviewPrompt(data.imagePrompt || "");
        setShowImagePreview(true);
        trackEvent("note_text_to_visual");
      } else {
        toast({
          title: "No image generated",
          description: data.error || "The image could not be generated.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Generation failed", description: "Could not generate visual.", variant: "destructive" });
    } finally {
      setIsGeneratingVisual(false);
    }
  }, [allText, toast]);

  const isProcessing = isWriting || isGeneratingVisual;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <StickyNote className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Notes</span>
        {wordCount > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </Badge>
        )}
        {selectedText && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400">
            Selection target
          </Badge>
        )}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleAddNote}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add a new note</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleTextToVisual}
              disabled={!allText.trim() || isProcessing}
            >
              {isGeneratingVisual ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate a visual from notes</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400"
              onClick={onArtify}
              disabled={!allText.trim()}
            >
              <Paintbrush className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Artify — customize image generation style</TooltipContent>
        </Tooltip>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <StickyNote className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground/60">No notes yet</p>
            <p className="text-xs text-muted-foreground/40 mt-1">
              Voice transcripts appear as notes here. You can also add notes manually.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5 text-xs"
              onClick={handleAddNote}
            >
              <Plus className="w-3 h-3" />
              Add Note
            </Button>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="group rounded-lg border bg-card/50 hover:bg-card transition-colors"
            >
              {/* Note text area */}
              <div className="px-3 pt-2 pb-1">
                <ProvokeText
                  variant="textarea"
                  chrome="bare"
                  value={note.text}
                  onChange={(text) => handleUpdateNote(note.id, text)}
                  placeholder="Type your note..."
                  showCopy={true}
                  showClear={false}
                  readOnly={false}
                  className="text-sm min-h-[40px]"
                  minRows={1}
                  maxRows={8}
                />
              </div>

              {/* Note actions */}
              <div className="flex items-center gap-1 px-2 pb-1.5">
                <span className="text-[10px] text-muted-foreground/50">
                  {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete note</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleWriteNote(note.text)}
                      disabled={!note.text.trim() || isProcessing}
                    >
                      <PenLine className="w-2.5 h-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Merge this note into document</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={note.savedToContext ? "ghost" : "ghost"}
                      size="icon"
                      className={`h-5 w-5 transition-opacity ${
                        note.savedToContext
                          ? "text-green-600 dark:text-green-400 opacity-100"
                          : "text-muted-foreground/50 hover:text-green-600 dark:hover:text-green-400 opacity-0 group-hover:opacity-100"
                      }`}
                      onClick={() => handleSaveNote(note)}
                      disabled={!note.text.trim() || savingNoteId === note.id}
                    >
                      {savingNoteId === note.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : note.savedToContext ? (
                        <Check className="w-2.5 h-2.5" />
                      ) : (
                        <Save className="w-2.5 h-2.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {note.savedToContext ? "Saved to context" : "Save to context"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t bg-muted/20 shrink-0">
        <span className="text-[10px] text-muted-foreground">
          {wordCount > 0 ? `${wordCount} words` : ""}
        </span>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={handleWriteAll}
              disabled={!allText.trim() || isProcessing}
            >
              {isWriting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <PenLine className="w-3 h-3" />
              )}
              Evolve Document
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectedText
              ? "Evolve selected portion with all notes"
              : "Evolve the document with all notes"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Image preview dialog for Text to Visual */}
      <ImagePreviewDialog
        open={showImagePreview}
        onOpenChange={setShowImagePreview}
        imageUrl={previewImageUrl}
        prompt={previewPrompt}
        title="Text to Visual"
      />
    </div>
  );
}
