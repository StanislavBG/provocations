import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/** All tab definitions available across both panels */
export interface PanelTabDef {
  id: string;
  label: string;
  icon: string; // Lucide icon name for serialization
}

/** Serialized panel layout persisted in user preferences */
export interface PanelLayoutConfig {
  leftTabs: string[];
  rightTabs: string[];
}

/** All possible panel tabs (chat & video are now in the global header) */
export const ALL_PANEL_TABS: PanelTabDef[] = [
  { id: "context", label: "Context", icon: "BookOpen" },
  { id: "research", label: "Research", icon: "Sparkles" },
  { id: "interview", label: "Interview", icon: "MessageCircleQuestion" },
  { id: "transcript", label: "Notes", icon: "ClipboardList" },
  { id: "provo", label: "Provo", icon: "Users" },
  { id: "writer", label: "Writer", icon: "Wand2" },
  { id: "painter", label: "Painter", icon: "Paintbrush" },
];

export const DEFAULT_PANEL_LAYOUT: PanelLayoutConfig = {
  leftTabs: ["context"],
  rightTabs: ["research", "interview", "transcript", "provo", "writer", "painter"],
};

interface Preferences {
  autoDictate: boolean;
  verboseMode: boolean;
  panelLayout: string | null;
}

function parsePanelLayout(raw: string | null): PanelLayoutConfig {
  if (!raw) return DEFAULT_PANEL_LAYOUT;
  try {
    const parsed = JSON.parse(raw) as PanelLayoutConfig;
    // Validate: ensure all known tabs are present
    const allIds = new Set(ALL_PANEL_TABS.map((t) => t.id));
    const leftValid = parsed.leftTabs?.filter((id) => allIds.has(id)) || [];
    const rightValid = parsed.rightTabs?.filter((id) => allIds.has(id)) || [];
    // Add any missing tabs to their default panel
    const assigned = new Set([...leftValid, ...rightValid]);
    for (const tab of ALL_PANEL_TABS) {
      if (!assigned.has(tab.id)) {
        const isDefaultLeft = DEFAULT_PANEL_LAYOUT.leftTabs.includes(tab.id);
        if (isDefaultLeft) leftValid.push(tab.id);
        else rightValid.push(tab.id);
      }
    }
    return { leftTabs: leftValid, rightTabs: rightValid };
  } catch {
    return DEFAULT_PANEL_LAYOUT;
  }
}

export function usePanelLayout() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ["/api/preferences"],
    staleTime: Infinity,
  });

  const panelLayout = parsePanelLayout(data?.panelLayout ?? null);

  const mutation = useMutation({
    mutationFn: async (layout: PanelLayoutConfig) => {
      const panelLayout = JSON.stringify(layout);
      const res = await apiRequest("PUT", "/api/preferences", { panelLayout });
      return (await res.json()) as Preferences;
    },
    onMutate: async (layout) => {
      await queryClient.cancelQueries({ queryKey: ["/api/preferences"] });
      const previous = queryClient.getQueryData<Preferences>(["/api/preferences"]);
      queryClient.setQueryData<Preferences>(["/api/preferences"], (old) => ({
        autoDictate: old?.autoDictate ?? false,
        verboseMode: old?.verboseMode ?? false,
        panelLayout: JSON.stringify(layout),
      }));
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Preferences>(["/api/preferences"], data);
    },
    onError: (_err, _layout, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/preferences"], context.previous);
      }
    },
  });

  return {
    panelLayout,
    isLoading,
    setPanelLayout: (layout: PanelLayoutConfig) => mutation.mutate(layout),
    isPending: mutation.isPending,
  };
}
