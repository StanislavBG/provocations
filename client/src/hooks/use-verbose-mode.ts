import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Preferences {
  autoDictate: boolean;
  verboseMode: boolean;
}

export function useVerboseMode() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ["/api/preferences"],
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: async (verboseMode: boolean) => {
      const res = await apiRequest("PUT", "/api/preferences", { verboseMode });
      return (await res.json()) as Preferences;
    },
    onMutate: async (verboseMode) => {
      await queryClient.cancelQueries({ queryKey: ["/api/preferences"] });
      const previous = queryClient.getQueryData<Preferences>(["/api/preferences"]);
      queryClient.setQueryData<Preferences>(["/api/preferences"], (old) => ({
        autoDictate: old?.autoDictate ?? false,
        verboseMode,
      }));
      return { previous };
    },
    onSuccess: (data) => {
      // Replace the optimistic data with the server's authoritative response.
      // No invalidation needed — the PUT response IS the fresh data.
      queryClient.setQueryData<Preferences>(["/api/preferences"], data);
    },
    onError: (_err, _verboseMode, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/preferences"], context.previous);
      }
    },
  });

  return {
    verboseMode: data?.verboseMode ?? false,
    isLoading,
    setVerboseMode: (value: boolean) => mutation.mutate(value),
    toggleVerboseMode: () => mutation.mutate(!(data?.verboseMode ?? false)),
  };
}
