import {
  FileText,
  Image,
  ExternalLink,
  Layers,
  MessageSquareText,
} from "lucide-react";
import type { ContextItem, ContextItemType } from "@shared/schema";

interface ContextStatusPanelProps {
  items: ContextItem[];
}

export function ContextStatusPanel({ items }: ContextStatusPanelProps) {
  const textCount = items.filter(i => i.type === "text").length;
  const imageCount = items.filter(i => i.type === "image").length;
  const linkCount = items.filter(i => i.type === "document-link").length;
  const annotatedCount = items.filter(i => i.annotation).length;

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/20 p-4 text-center">
        <Layers className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground/60">
          No context captured yet
        </p>
        <p className="text-xs text-muted-foreground/40 mt-1">
          Add text, images, or links to ground your draft
        </p>
      </div>
    );
  }

  const allTypeStats = [
    { type: "text" as ContextItemType, count: textCount, icon: FileText, color: "text-blue-600 dark:text-blue-400", label: "Text" },
    { type: "image" as ContextItemType, count: imageCount, icon: Image, color: "text-emerald-600 dark:text-emerald-400", label: "Images" },
    { type: "document-link" as ContextItemType, count: linkCount, icon: ExternalLink, color: "text-violet-600 dark:text-violet-400", label: "Links" },
  ];
  const typeStats = allTypeStats.filter(s => s.count > 0);

  return (
    <div className="rounded-lg border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Context Status
        </h3>
        <span className="ml-auto text-xs font-medium text-primary">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {typeStats.map(({ type, count, icon: Icon, color, label }) => (
          <div key={type} className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className="text-xs text-muted-foreground flex-1">{label}</span>
            <span className="text-xs font-medium">{count}</span>
          </div>
        ))}
        {annotatedCount > 0 && (
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-muted-foreground flex-1">Annotated</span>
            <span className="text-xs font-medium">{annotatedCount}</span>
          </div>
        )}
      </div>

      {/* Preview of recent items */}
      <div className="border-t pt-2 space-y-1.5">
        {items.slice(-3).map((item) => {
          const typeIcons: Record<ContextItemType, typeof FileText> = {
            text: FileText,
            image: Image,
            "document-link": ExternalLink,
          };
          const Icon = typeIcons[item.type];
          const preview = item.type === "text"
            ? item.content.slice(0, 50) + (item.content.length > 50 ? "..." : "")
            : item.type === "document-link"
            ? item.content.replace(/^https?:\/\//, "").slice(0, 40) + "..."
            : "Image";

          return (
            <div key={item.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{preview}</span>
            </div>
          );
        })}
        {items.length > 3 && (
          <p className="text-xs text-muted-foreground/60">
            +{items.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}
