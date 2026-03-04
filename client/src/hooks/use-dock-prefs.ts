import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface DockPrefs {
  dockMode: "compact" | "carousel" | "hidden";
  dockPosition: "top" | "bottom" | "left" | "right";
  dockCarouselWidth: number;
  topBarPosition: "top" | "bottom" | "left" | "right";
}

export const DEFAULT_DOCK_PREFS: DockPrefs = {
  dockMode: "compact",
  dockPosition: "bottom",
  dockCarouselWidth: 6,
  topBarPosition: "top",
};

interface Preferences {
  autoDictate: boolean;
  verboseMode: boolean;
  panelLayout: string | null;
  ftuxShellConfig: string | null;
  dockPrefs: string | null;
}

function parseDockPrefs(raw: string | null): DockPrefs {
  if (!raw) return DEFAULT_DOCK_PREFS;
  try {
    const parsed = JSON.parse(raw);
    return {
      dockMode: ["compact", "carousel", "hidden"].includes(parsed.dockMode) ? parsed.dockMode : DEFAULT_DOCK_PREFS.dockMode,
      dockPosition: ["top", "bottom", "left", "right"].includes(parsed.dockPosition) ? parsed.dockPosition : DEFAULT_DOCK_PREFS.dockPosition,
      dockCarouselWidth: typeof parsed.dockCarouselWidth === "number" ? parsed.dockCarouselWidth : DEFAULT_DOCK_PREFS.dockCarouselWidth,
      topBarPosition: ["top", "bottom", "left", "right"].includes(parsed.topBarPosition) ? parsed.topBarPosition : DEFAULT_DOCK_PREFS.topBarPosition,
    };
  } catch {
    return DEFAULT_DOCK_PREFS;
  }
}

export function useDockPrefs() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ["/api/preferences"],
    staleTime: Infinity,
  });

  const dockPrefs = parseDockPrefs(data?.dockPrefs ?? null);

  const mutation = useMutation({
    mutationFn: async (prefs: DockPrefs) => {
      const dockPrefs = JSON.stringify(prefs);
      const res = await apiRequest("PUT", "/api/preferences", { dockPrefs });
      return (await res.json()) as Preferences;
    },
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: ["/api/preferences"] });
      const previous = queryClient.getQueryData<Preferences>(["/api/preferences"]);
      queryClient.setQueryData<Preferences>(["/api/preferences"], (old) => ({
        autoDictate: old?.autoDictate ?? false,
        verboseMode: old?.verboseMode ?? false,
        panelLayout: old?.panelLayout ?? null,
        ftuxShellConfig: old?.ftuxShellConfig ?? null,
        dockPrefs: JSON.stringify(prefs),
      }));
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Preferences>(["/api/preferences"], data);
    },
    onError: (_err, _prefs, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/preferences"], context.previous);
      }
    },
  });

  return {
    dockPrefs,
    isLoading,
    setDockPrefs: (prefs: DockPrefs) => mutation.mutate(prefs),
    updateDockPrefs: (partial: Partial<DockPrefs>) => mutation.mutate({ ...dockPrefs, ...partial }),
    isPending: mutation.isPending,
  };
}
