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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const debugAuth = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/debug`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: localStorage.getItem("jwtToken") ? `Bearer ${localStorage.getItem("jwtToken")}` : "",
        },
      });
      const debugData = await response.json();
      console.log("🔍 Auth Debug:", debugData);
      console.log("🔍 Browser Cookies:", document.cookie);
      return debugData;
    } catch (error) {
      console.error("❌ Debug failed:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get("login");
    const logoutStatus = urlParams.get("logout");
    const token = urlParams.get("token");

    if (loginStatus === "success") {
      console.log("🔐 OAuth success detected, refetching user data...");
      if (token) {
        localStorage.setItem("jwtToken", token);
        console.log("🔐 Stored JWT token");
      }
      clearCsrfToken();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetch();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (loginStatus === "failed" || loginStatus === "error") {
      console.log("❌ OAuth failed or error occurred");
      queryClient.setQueryData(["/api/auth/user"], null);
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (logoutStatus === "success") {
      console.log("✅ Logout successful");
      queryClient.clear();
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [queryClient, refetch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !data && !isLoading) {
        console.log("🔐 Page became visible, checking auth status...");
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          refetch();
        }, 300);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [data, isLoading, queryClient, refetch]);

  const login = useCallback(() => {
    // Check for third-party cookie support
    if (!navigator.cookieEnabled) {
      console.warn("❌ Cookies are disabled, falling back to JWT");
      window.location.href = `${BASE_URL}/auth/google`;
    } else {
      window.location.href = `${BASE_URL}/auth/google`;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log("🔐 Initiating logout...");
      await fetch(`${BASE_URL}/auth/logout`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: localStorage.getItem("jwtToken") ? `Bearer ${localStorage.getItem("jwtToken")}` : "",
        },
      });
      queryClient.clear();
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/?logout=success";
    } catch (error) {
      console.error("❌ Logout failed:", error);
      queryClient.clear();
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    }
  }, [queryClient]);

  const forceRefresh = useCallback(async () => {
    console.log("🔄 Force refreshing auth state...");
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
    debugAuth,
  };
}
