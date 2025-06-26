import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useAuth() {
  const {
    data: user,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["authUser"],
    queryFn: getQueryFn({
      url: `${BACKEND_URL}/api/auth/user`,
      on401: "returnNull",
    }),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
