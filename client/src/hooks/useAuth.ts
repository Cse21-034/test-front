import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: !!data,
    error,
  };
}
