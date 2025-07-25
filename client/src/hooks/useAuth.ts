// Updated useAuth.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Check for OAuth success and refetch user data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    
    if (loginStatus === 'success') {
      console.log('🔐 OAuth success detected, refetching user data...');
      // Force refetch user data after successful OAuth
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        refetch();
      }, 500); // Small delay to ensure session is established
      
      // Clean up URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    if (loginStatus === 'failed') {
      console.log('❌ OAuth failed');
      // Clean up URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [queryClient, refetch]);

  // Also check on focus/visibility change (when user returns from OAuth)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !data) {
        console.log('🔐 Page became visible, checking auth status...');
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [data, queryClient, refetch]);

  const logout = async () => {
    try {
      await fetch('https://myshop-test-backend.onrender.com/auth/logout', {
        credentials: 'include',
      });
      // Clear all queries and reset auth state
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: !!data,
    error,
    refetch,
    logout,
  };
}
