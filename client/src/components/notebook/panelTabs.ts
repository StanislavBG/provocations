/**
 * Shared tab definitions for left and right panels.
 * Both panels import from here so any tab can be rendered in either panel.
 */
import {
  BookOpen,
  Sparkles,
  MessageCircleQuestion,
  ClipboardList,
  Users,
  Wand2,
  Paintbrush,
  type LucideIcon,
} from "lucide-react";

export interface PanelTabDef {
  id: string;
  icon: LucideIcon;
  label: string;
}

/** Panel-assignable tabs (chat & video are now in the global header) */
export const ALL_TAB_DEFS: PanelTabDef[] = [
  { id: "context", icon: BookOpen, label: "Context" },
  { id: "research", icon: Sparkles, label: "Research" },
  { id: "interview", icon: MessageCircleQuestion, label: "Interview" },
  { id: "transcript", icon: ClipboardList, label: "Notes" },
  { id: "provo", icon: Users, label: "Provo" },
  { id: "writer", icon: Wand2, label: "Writer" },
  { id: "painter", icon: Paintbrush, label: "Painter" },
];

const TAB_MAP = new Map(ALL_TAB_DEFS.map((t) => [t.id, t]));

/** Resolve an ordered list of tab IDs into tab definitions, filtering unknowns */
export function resolveVisibleTabs(
  visibleTabs: string[] | undefined,
  fallbackIds: string[],
): PanelTabDef[] {
  if (!visibleTabs) {
    return fallbackIds.map((id) => TAB_MAP.get(id)!).filter(Boolean);
  }
  const resolved = visibleTabs
    .map((id) => TAB_MAP.get(id))
    .filter((t): t is PanelTabDef => !!t);
  if (resolved.length === 0) {
    return fallbackIds.map((id) => TAB_MAP.get(id)!).filter(Boolean);
  }
  return resolved;
}
