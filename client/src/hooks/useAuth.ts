import { useQuery } from "@tanstack/react-query";
import { getQueryFn, buildApiUrl } from "@/lib/queryClient";

export function useAuth() {
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: !!data,
    error,
  };
}
