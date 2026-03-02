import { useState } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  FileText,
  Image,
  BarChart3,
  Clock,
  X,
} from "lucide-react";

export interface DocumentTab {
  id: string;
  label: string;
  type: "document" | "image" | "chart" | "timeline";
}

interface FtuxDocumentTabBarProps {
  tabs: DocumentTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

const TAB_ICONS = {
  document: FileText,
  image: Image,
  chart: BarChart3,
  timeline: Clock,
};

export function FtuxDocumentTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: FtuxDocumentTabBarProps) {
  const [expanded, setExpanded] = useState(false);
  const { setActiveTool } = useFtuxShell();

  if (tabs.length === 0) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    setActiveTool("document");
    if (!expanded) setExpanded(true);
  };

  return (
    <div
      className={cn(
        "absolute bottom-0 left-1/2 -translate-x-1/2 z-20 transition-transform duration-300 ease-out",
        "w-full max-w-2xl",
      )}
      style={{
        transform: expanded
          ? "translateX(-50%) translateY(0)"
          : "translateX(-50%) translateY(calc(100% - 32px))",
      }}
    >
      <div
        className="overflow-hidden"
        style={{
          background: "hsl(var(--card) / 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid hsl(var(--border) / 0.3)",
          borderRadius: "12px 12px 0 0",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* Collapsed strip */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 h-8 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">
              {tabs.length}
            </span>
            {activeTab && (
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {activeTab.label}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Expanded tab bar */}
        {expanded && (
          <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto scrollbar-thin">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.type];
              const isActive = tab.id === activeTabId;

              return (
                <div
                  key={tab.id}
                  className={cn(
                    "group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-colors shrink-0",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/50 text-muted-foreground",
                  )}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[120px]">{tab.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
