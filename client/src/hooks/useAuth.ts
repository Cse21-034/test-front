import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useAuth() {
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["authUser"],
    queryFn: getQueryFn({
      url: `${BACKEND_URL}/api/auth/user`,
      on401: "returnNull",
    }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Debug logging
  console.log("[useAuth] isLoading:", isLoading);
  console.log("[useAuth] isFetching:", isFetching);
  console.log("[useAuth] data:", data);
  console.log("[useAuth] error:", error);

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: !!data,
    error,
  };
}
