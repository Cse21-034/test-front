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
      
      // Multiple attempts to ensure session is recognized
      const attemptRefetch = async (attempt = 1, maxAttempts = 5) => {
        console.log(`🔐 Refetch attempt ${attempt}/${maxAttempts}`);
        
        try {
          // Force invalidate and refetch
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          const result = await refetch();
          
          if (result.data) {
            console.log('✅ User data fetched successfully:', result.data);
            return;
          }
          
          // If no data and we have attempts left, try again
          if (attempt < maxAttempts) {
            setTimeout(() => attemptRefetch(attempt + 1, maxAttempts), 1000 * attempt);
          } else {
            console.log('❌ Failed to fetch user data after', maxAttempts, 'attempts');
          }
        } catch (error) {
          console.error(`❌ Refetch attempt ${attempt} failed:`, error);
          if (attempt < maxAttempts) {
            setTimeout(() => attemptRefetch(attempt + 1, maxAttempts), 1000 * attempt);
          }
        }
      };
      
      // Start with a small delay, then begin attempts
      setTimeout(() => attemptRefetch(), 500);
      
      // Clean up URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    if (loginStatus === 'failed') {
      console.log('❌ OAuth failed');
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
        credentials: 'include', // CRITICAL: Include credentials
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
