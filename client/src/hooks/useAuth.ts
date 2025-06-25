import { useQuery } from "@tanstack/react-query"; // ✅ Required!
import { getQueryFn } from "@/lib/queryClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useAuth() {
  const { data: user, isLoading, isFetching, error } = useQuery({
    queryKey: [`${BACKEND_URL}/api/auth/user`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    initialData: null,
    staleTime: 0,
  });

  return {
    user,
    isLoading: isLoading || isFetching,
    isAuthenticated: !!user,
    error,
  };
}
