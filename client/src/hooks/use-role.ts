import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useRole() {
  const { data, isLoading } = useQuery<{ role: "admin" | "user" }>({
    queryKey: ["/api/auth/role"],
    queryFn: () => apiRequest("GET", "/api/auth/role").then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  return {
    role: data?.role ?? "user",
    isAdmin: data?.role === "admin",
    isLoading,
  };
}
