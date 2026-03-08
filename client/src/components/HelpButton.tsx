import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { HELP_PAGES } from "@/lib/helpContent";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpButtonProps {
  /** The help page slug to display (key from HELP_PAGES). */
  topic: string;
  /** Optional className for the button. */
  className?: string;
  /** Button size variant. Default "icon". */
  size?: "icon" | "sm";
}

/**
 * Small contextual help button — renders a ? icon that opens a dialog
 * with the corresponding help page content.
 */
export function HelpButton({ topic, className, size = "icon" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const page = HELP_PAGES[topic];

  if (!page) return null;

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        className={cn(
          "text-muted-foreground/50 hover:text-muted-foreground transition-colors",
          size === "icon" && "w-6 h-6",
          className,
        )}
        onClick={() => setOpen(true)}
        title={`Help: ${page.title}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              {page.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <MarkdownRenderer content={page.content} />
          </div>
          <div className="flex justify-end pt-2 border-t border-border/50">
            <a
              href={`/help/${topic}`}
              className="text-[11px] text-primary hover:underline"
            >
              Open full help page
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
