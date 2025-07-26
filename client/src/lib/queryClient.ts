import { QueryClient, QueryFunction } from "@tanstack/react-query";

const BASE_URL = (
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_BASE_URL || 
  "https://myshop-test-backend.onrender.com"
).replace(/\/$/, "");

// Cache for CSRF token to avoid repeated requests
let csrfTokenCache: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Improved CSRF token fetching with caching and error handling
async function getCsrfToken(): Promise<string> {
  // Return cached token if available and still valid
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  // If there's already a request in progress, wait for it
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  // Create new request
  csrfTokenPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/csrf-token`, { 
        credentials: "include",
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to get CSRF token: ${res.status}`);
      }
      
      const data = await res.json();
      csrfTokenCache = data.csrfToken;
      
      // Clear cache after 10 minutes
      setTimeout(() => {
        csrfTokenCache = null;
      }, 10 * 60 * 1000);
      
      return csrfTokenCache;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      // For GET requests, we can still try without CSRF token
      return '';
    } finally {
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

// Clear CSRF token cache (useful for logout or auth errors)
export function clearCsrfToken() {
  csrfTokenCache = null;
  csrfTokenPromise = null;
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  // Add CSRF token for non-GET requests
  if (method !== 'GET') {
    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    } catch (error) {
      console.warn('Could not get CSRF token, proceeding without it:', error);
    }
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // CRITICAL: Always include credentials
  });

  // If we get a 403 (CSRF error), clear token cache and retry once
  if (res.status === 403 && method !== 'GET' && !headers["X-CSRF-Token"]) {
    clearCsrfToken();
    const retryToken = await getCsrfToken();
    if (retryToken) {
      headers["X-CSRF-Token"] = retryToken;
      const retryRes = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      await throwIfResNotOk(retryRes);
      return retryRes;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const urlOrPath = queryKey[0] as string;
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // For GET requests, we don't usually need CSRF tokens, but some endpoints might require them
    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    } catch (error) {
      // Ignore CSRF token errors for GET requests
      console.debug('CSRF token not available for GET request:', error);
    }

    const res = await fetch(fullUrl, {
      credentials: "include", // CRITICAL: Always include credentials
      headers,
    });

    if (on401 === "returnNull" && res.status === 401) {
      return null as any;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const customQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const urlOrPath = queryKey[0] as string;
  const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  try {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  } catch (error) {
    console.debug('CSRF token not available:', error);
  }

  const res = await fetch(fullUrl, {
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Resource not found");
    }
    throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  }

  return res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry 4xx errors
        if (error?.message?.includes("401") || error?.message?.includes("403") || error?.message?.includes("404")) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: { 
      retry: (failureCount, error) => {
        // Don't retry client errors
        if (error?.message?.includes("4")) {
          return false;
        }
        return failureCount < 2;
      }
    },
  },
});

export function buildApiUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createQueryKey(path: string, params?: Record<string, any>): string[] {
  const basePath = path.startsWith("/api/") ? path : `/api/${path.replace(/^\//, "")}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? [`${basePath}?${queryString}`] : [basePath];
  }
  return [basePath];
}

export { BASE_URL };
