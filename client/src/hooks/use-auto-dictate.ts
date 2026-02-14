import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Preferences {
  autoDictate: boolean;
}

export function useAutoDictate() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ["/api/preferences"],
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: async (autoDictate: boolean) => {
      const res = await apiRequest("PUT", "/api/preferences", { autoDictate });
      return (await res.json()) as Preferences;
    },
    onMutate: async (autoDictate) => {
      await queryClient.cancelQueries({ queryKey: ["/api/preferences"] });
      const previous = queryClient.getQueryData<Preferences>(["/api/preferences"]);
      queryClient.setQueryData<Preferences>(["/api/preferences"], { autoDictate });
      return { previous };
    },
    onError: (_err, _autoDictate, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/preferences"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
    },
  });

  return {
    autoDictate: data?.autoDictate ?? false,
    isLoading,
    setAutoDictate: (value: boolean) => mutation.mutate(value),
    toggleAutoDictate: () => mutation.mutate(!(data?.autoDictate ?? false)),
  };
}
