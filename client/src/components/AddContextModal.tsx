import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ContextCapturePanel } from "./ContextCapturePanel";
import { ContextStatusPanel } from "./ContextStatusPanel";
import { Layers } from "lucide-react";
import type { ContextItem } from "@shared/schema";

interface AddContextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ContextItem[];
  onItemsChange: (items: ContextItem[]) => void;
}

/**
 * Global "Add Context" modal — wraps ContextCapturePanel in a dialog so it
 * can be invoked from any surface (landing page, workspace left panel, etc.).
 *
 * Usage:
 *   <AddContextModal
 *     open={showAddContext}
 *     onOpenChange={setShowAddContext}
 *     items={capturedContext}
 *     onItemsChange={setCapturedContext}
 *   />
 */
export function AddContextModal({ open, onOpenChange, items, onItemsChange }: AddContextModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <DialogTitle className="text-sm font-semibold">Add Context</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Attach text, images, document links, or load from the Context Store to ground your session.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <ContextCapturePanel items={items} onItemsChange={onItemsChange} />
          <ContextStatusPanel items={items} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
