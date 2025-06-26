import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useAuth() {
  const {
    data: user,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["authUser"], // ✅ use a consistent static key
    queryFn: getQueryFn({ url: `${BACKEND_URL}/api/auth/user`, on401: "returnNull" }),
    refetchOnWindowFocus: true, // ✅ refetch if user switches back
    refetchOnMount: true,       // ✅ refetch on every page load
    retry: false,
  });

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    isFetching,
    error,
  };
}
