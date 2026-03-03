import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_SHELL_CONFIG, type FtuxShellConfig } from "@/lib/ftux-shell-context";

interface Preferences {
  autoDictate: boolean;
  verboseMode: boolean;
  panelLayout: string | null;
  ftuxShellConfig: string | null;
}

function parseFtuxShellConfig(raw: string | null): FtuxShellConfig {
  if (!raw) return DEFAULT_SHELL_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<FtuxShellConfig>;
    return {
      ...DEFAULT_SHELL_CONFIG,
      ...parsed,
      dockPosition: parsed.dockPosition ?? DEFAULT_SHELL_CONFIG.dockPosition,
      dockItems: Array.isArray(parsed.dockItems) ? parsed.dockItems : DEFAULT_SHELL_CONFIG.dockItems,
      dockTranslucency: typeof parsed.dockTranslucency === "number" ? parsed.dockTranslucency : DEFAULT_SHELL_CONFIG.dockTranslucency,
      dockAutoHide: typeof parsed.dockAutoHide === "boolean" ? parsed.dockAutoHide : DEFAULT_SHELL_CONFIG.dockAutoHide,
      statusBarPosition: parsed.statusBarPosition ?? DEFAULT_SHELL_CONFIG.statusBarPosition,
      statusBarPinnedItems: Array.isArray(parsed.statusBarPinnedItems) ? parsed.statusBarPinnedItems : DEFAULT_SHELL_CONFIG.statusBarPinnedItems,
      tipsEnabled: typeof parsed.tipsEnabled === "boolean" ? parsed.tipsEnabled : DEFAULT_SHELL_CONFIG.tipsEnabled,
      tipsDismissed: Array.isArray(parsed.tipsDismissed) ? parsed.tipsDismissed : DEFAULT_SHELL_CONFIG.tipsDismissed,
    };
  } catch {
    return DEFAULT_SHELL_CONFIG;
  }
}

export function useFtuxShellConfig() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ["/api/preferences"],
    staleTime: Infinity,
  });

  const shellConfig = parseFtuxShellConfig(data?.ftuxShellConfig ?? null);

  const mutation = useMutation({
    mutationFn: async (config: FtuxShellConfig) => {
      const ftuxShellConfig = JSON.stringify(config);
      const res = await apiRequest("PUT", "/api/preferences", { ftuxShellConfig });
      return (await res.json()) as Preferences;
    },
    onMutate: async (config) => {
      await queryClient.cancelQueries({ queryKey: ["/api/preferences"] });
      const previous = queryClient.getQueryData<Preferences>(["/api/preferences"]);
      queryClient.setQueryData<Preferences>(["/api/preferences"], (old) => ({
        autoDictate: old?.autoDictate ?? false,
        verboseMode: old?.verboseMode ?? false,
        panelLayout: old?.panelLayout ?? null,
        ftuxShellConfig: JSON.stringify(config),
      }));
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Preferences>(["/api/preferences"], data);
    },
    onError: (_err, _config, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/preferences"], context.previous);
      }
    },
  });

  return {
    shellConfig,
    isLoading,
    setShellConfig: (config: FtuxShellConfig) => mutation.mutate(config),
    isPending: mutation.isPending,
  };
}
