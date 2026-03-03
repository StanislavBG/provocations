import { useCallback, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ContextSidebar } from "@/components/notebook/ContextSidebar";
import { apiRequest } from "@/lib/queryClient";
import type { ToolId } from "@/lib/ftux-shell-context";

interface FlowToolSheetProps {
  activeTool: ToolId | null;
  onClose: () => void;
  onPickDocument: (doc: { id: number; title: string; content: string }) => void;
}

export function FlowToolSheet({
  activeTool,
  onClose,
  onPickDocument,
}: FlowToolSheetProps) {
  const isOpen = activeTool === "context";
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  const handleDocClick = useCallback(
    async (id: number, title: string) => {
      if (isLoadingDoc) return;
      setIsLoadingDoc(true);
      try {
        const res = await apiRequest("GET", `/api/documents/${id}`);
        const data = (await res.json()) as { title: string; content: string };
        onPickDocument({ id, title: data.title || title, content: data.content });
      } catch {
        onPickDocument({ id, title, content: "" });
      } finally {
        setIsLoadingDoc(false);
      }
    },
    [isLoadingDoc, onPickDocument],
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-sm font-semibold">
            Context Store — Pick a document
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto">
          <ContextSidebar
            pinnedDocIds={new Set()}
            onPinDoc={() => {}}
            onUnpinDoc={() => {}}
            onPreviewDoc={handleDocClick}
            isCollapsed={false}
            onToggleCollapse={() => {}}
            embedded
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
