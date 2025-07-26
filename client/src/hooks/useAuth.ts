import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
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
  const retryAttemptRef = useRef(0);
  const maxRetryAttempts = 5;
  
  const { data, isLoading, error, isFetching, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: (failureCount, error) => {
      // Don't retry 401 errors (user not authenticated)
      if (error?.message?.includes('401')) {
        return false;
      }
      // Retry network errors
      return failureCount < 3;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes (reduced for better sync)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Debug function to check auth status
  const debugAuth = useCallback(async () => {
    try {
      console.log('🔍 Debugging auth status...');
      const response = await fetch(`${BASE_URL}/api/auth/debug`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error('❌ Debug request failed:', response.status, response.statusText);
        return null;
      }
      
      const debugData = await response.json();
      console.log('🔍 Auth Debug:', debugData);
      
      // If user exists in debug but not in our state, there's a session issue
      if (debugData.isAuthenticated && debugData.user && !data) {
        console.log('⚠️ Session mismatch detected - user authenticated on server but not in client');
      }
      
      return debugData;
    } catch (error) {
      console.error('❌ Debug failed:', error);
      return null;
    }
  }, [data]);

  // Enhanced login success handler
  const handleLoginSuccess = useCallback(async () => {
    console.log('🔐 Handling login success...');
    retryAttemptRef.current = 0;
    
    // Clear any cached CSRF tokens since we have a new session
    clearCsrfToken();
    
    // Clear all cached data to ensure fresh fetch
    queryClient.clear();
    
    const attemptRefetch = async (attempt = 1): Promise<boolean> => {
      console.log(`🔐 Login success refetch attempt ${attempt}/${maxRetryAttempts}`);
      
      try {
        // First, debug the auth status
        const debugResult = await debugAuth();
        
        if (debugResult?.isAuthenticated && debugResult?.user) {
          console.log('✅ Server confirms user is authenticated');
          // Force invalidate and refetch user data
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          await queryClient.refetchQueries({ 
            queryKey: ["/api/auth/user"],
            type: 'active'
          });
          
          // Check if we now have user data
          const currentData = queryClient.getQueryData(["/api/auth/user"]);
          
          if (currentData) {
            console.log('✅ User data successfully fetched:', currentData);
            return true;
          }
        }
        
        // If no authenticated user on server or client fetch failed
        if (attempt < maxRetryAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 4000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptRefetch(attempt + 1);
        } else {
          console.log('❌ Failed to fetch user data after', maxRetryAttempts, 'attempts');
          // Final attempt with direct refetch
          await refetch();
          return false;
        }
      } catch (error) {
        console.error(`❌ Refetch attempt ${attempt} failed:`, error);
        if (attempt < maxRetryAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 4000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptRefetch(attempt + 1);
        }
        return false;
      }
    };
    
    // Start with a small delay to ensure OAuth redirect is complete
    setTimeout(() => attemptRefetch(), 1000);
  }, [queryClient, refetch, debugAuth, maxRetryAttempts]);

  // Handle OAuth redirect parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const logoutStatus = urlParams.get('logout');
    
    if (loginStatus === 'success') {
      console.log('🔐 OAuth success detected, handling login...');
      handleLoginSuccess();
      
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
  }, [queryClient, handleLoginSuccess]);

  // Handle page visibility changes (when user returns from OAuth)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !data && !isLoading) {
        console.log('🔐 Page became visible and no user data, checking auth status...');
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          refetch();
        }, 500);
      }
    };
    
    const handleFocus = () => {
      if (!data && !isLoading) {
        console.log('🔐 Window focused and no user data, checking auth status...');
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          refetch();
        }, 500);
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
    console.log('🔐 Initiating login...');
    // Redirect to Google OAuth
    window.location.href = `${BASE_URL}/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('🔐 Initiating logout...');
      
      // Call logout endpoint
      const response = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Clear all cached data immediately
      queryClient.clear();
      clearCsrfToken();
      
      // Set user data to null
      queryClient.setQueryData(["/api/auth/user"], null);
      
      console.log('✅ Logout completed');
      
      // Optional: redirect to home page
      // window.location.href = '/?logout=success';
    } catch (error) {
      console.error('❌ Logout failed:', error);
      
      // Even if logout fails, clear local state
      queryClient.clear();
      clearCsrfToken();
      queryClient.setQueryData(["/api/auth/user"], null);
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
