import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { getQueryFn, clearCsrfToken, BASE_URL } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error, isFetching, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (reduced from 10)
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Debug function to check auth status
  const debugAuth = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/debug`, {
        credentials: 'include',
      });
      const debugData = await response.json();
      console.log('🔍 Auth Debug:', debugData);
      return debugData;
    } catch (error) {
      console.error('❌ Debug failed:', error);
      return null;
    }
  }, []);

  // Handle OAuth redirect parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const logoutStatus = urlParams.get('logout');
    
    if (loginStatus === 'success') {
      console.log('🔐 OAuth success detected, refetching user data...');
      
      // Clear any cached CSRF tokens since we have a new session
      clearCsrfToken();
      
      // Multiple attempts to ensure session is recognized
      const attemptRefetch = async (attempt = 1, maxAttempts = 8) => {
        console.log(`🔐 Refetch attempt ${attempt}/${maxAttempts}`);
        
        try {
          // Debug auth status first
          await debugAuth();
          
          // Force invalidate and refetch
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
          
          // Check if we now have user data
          const currentData = queryClient.getQueryData(["/api/auth/user"]);
          
          if (currentData) {
            console.log('✅ User data fetched successfully:', currentData);
            return;
          }
          
          // If no data and we have attempts left, try again with exponential backoff
          if (attempt < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000); // Max 5 second delay
            console.log(`⏳ Retrying in ${delay}ms...`);
            setTimeout(() => attemptRefetch(attempt + 1, maxAttempts), delay);
          } else {
            console.log('❌ Failed to fetch user data after', maxAttempts, 'attempts');
            // Try one more manual refetch
            refetch();
          }
        } catch (error) {
          console.error(`❌ Refetch attempt ${attempt} failed:`, error);
          if (attempt < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000);
            setTimeout(() => attemptRefetch(attempt + 1, maxAttempts), delay);
          }
        }
      };
      
      // Start with a small delay to ensure redirect is complete
      setTimeout(() => attemptRefetch(), 800);
      
      // Clean up URL params
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    if (loginStatus === 'failed' || loginStatus === 'error') {
      console.log('❌ OAuth failed or error occurred');
      // Clear any cached data
      queryClient.setQueryData(["/api/auth/user"], null);
      clearCsrfToken();
      
      // Clean up URL params
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }

    if (logoutStatus === 'success') {
      console.log('✅ Logout successful');
      // Clear all cached data
      queryClient.clear();
      clearCsrfToken();
      
      // Clean up URL params
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [queryClient, refetch, debugAuth]);

  // Handle page visibility changes (when user returns from OAuth popup/redirect)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !data && !isLoading) {
        console.log('🔐 Page became visible and no user data, checking auth status...');
        
        // Small delay to ensure any ongoing requests complete
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          refetch();
        }, 300);
      }
    };
    
    const handleFocus = () => {
      if (!data && !isLoading) {
        console.log('🔐 Window focused and no user data, checking auth status...');
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          refetch();
        }, 300);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [data, isLoading, queryClient, refetch]);

  const login = useCallback(() => {
    // Redirect to Google OAuth
    window.location.href = `${BASE_URL}/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('🔐 Initiating logout...');
      
      // Call logout endpoint
      const response = await fetch(`${BASE_URL}/auth/logout`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });

      // Clear all cached data immediately
      queryClient.clear();
      clearCsrfToken();
      
      // Set user data to null
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // If logout endpoint doesn't redirect, redirect manually
      if (response.redirected) {
        window.location.href = response.url;
      } else {
        // Fallback redirect
        window.location.href = '/?logout=success';
      }
    } catch (error) {
      console.error('❌ Logout failed:', error);
      
      // Even if logout fails, clear local state
      queryClient.clear();
      clearCsrfToken();
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Force redirect to home
      window.location.href = '/';
    }
  }, [queryClient]);

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing auth state...');
    clearCsrfToken();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    return refetch();
  }, [queryClient, refetch]);

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: !!data,
    error,
    refetch,
    login,
    logout,
    forceRefresh,
    debugAuth, // Useful for debugging
  };
}
