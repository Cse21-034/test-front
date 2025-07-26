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
    let errorMessage = res.statusText;
    try {
      const errorData = await res.text();
      errorMessage = errorData || res.statusText;
    } catch (e) {
      // Use statusText if can't parse response
    }
    
    const error = new Error(`${res.status}: ${errorMessage}`);
    (error as any).status = res.status;
    throw error;
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
      console.log('🔑 Fetching CSRF token...');
      
      const res = await fetch(`${BASE_URL}/api/csrf-token`, { 
        method: 'GET',
        credentials: "include", // CRITICAL: Include credentials
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to get CSRF token: ${res.status}`);
      }
      
      const data = await res.json();
      csrfTokenCache = data.csrfToken;
      
      console.log('✅ CSRF token obtained');
      
      // Clear cache after 10 minutes (tokens should be refreshed periodically)
      setTimeout(() => {
        console.log('🔑 CSRF token cache expired');
        csrfTokenCache = null;
      }, 10 * 60 * 1000);
      
      return csrfTokenCache;
    } catch (error) {
      console.warn('⚠️ Failed to get CSRF token:', error);
      // For some requests, we can proceed without CSRF token
      return '';
    } finally {
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

// Clear CSRF token cache (useful for logout or auth errors)
export function clearCsrfToken() {
  console.log('🔑 Clearing CSRF token cache');
  csrfTokenCache = null;
  csrfTokenPromise = null;
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  
  console.log(`🌐 API ${method} request to:`, fullUrl);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  // Add CSRF token for non-GET requests
  if (method !== 'GET') {
    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
        console.log('🔑 Added CSRF token to request');
      }
    } catch (error) {
      console.warn('⚠️ Could not get CSRF token, proceeding without it:', error);
    }
  }

  const requestConfig: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // CRITICAL: Always include credentials for session cookies
  };

  console.log('🌐 Request config:', {
    method,
    url: fullUrl,
    hasData: !!data,
    hasCSRF: !!headers["X-CSRF-Token"],
    credentials: requestConfig.credentials
  });

  let res = await fetch(fullUrl, requestConfig);

  // If we get a 403 (CSRF error), clear token cache and retry once
  if (res.status === 403 && method !== 'GET' && !headers["X-CSRF-Token"]) {
    console.log('🔄 Retrying request with fresh CSRF token...');
    clearCsrfToken();
    
    const retryToken = await getCsrfToken();
    if (retryToken) {
      headers["X-CSRF-Token"] = retryToken;
      res = await fetch(fullUrl, {
        ...requestConfig,
        headers,
      });
    }
  }

  console.log(`📨 Response: ${res.status} ${res.statusText}`);
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const urlOrPath = queryKey[0] as string;
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;
    
    console.log('🔍 Query request to:', fullUrl);
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    };

    // For some protected GET requests, we might need CSRF tokens
    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    } catch (error) {
      // Ignore CSRF token errors for GET requests
      console.debug('⚠️ CSRF token not available for GET request:', error);
    }

    const res = await fetch(fullUrl, {
      method: 'GET',
      credentials: "include", // CRITICAL: Always include credentials
      headers,
    });

    console.log(`📨 Query response: ${res.status} ${res.statusText}`);

    if (on401 === "returnNull" && res.status === 401) {
      console.log('🚫 Unauthorized request, returning null');
      return null as any;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const customQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const urlOrPath = queryKey[0] as string;
  const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;
  
  console.log('🔍 Custom query to:', fullUrl);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  };

  try {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  } catch (error) {
    console.debug('⚠️ CSRF token not available:', error);
  }

  const res = await fetch(fullUrl, {
    method: 'GET',
    credentials: "include", // CRITICAL: Always include credentials
    headers,
  });

  console.log(`📨 Custom query response: ${res.status} ${res.statusText}`);

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
      staleTime: 2 * 60 * 1000, // 2 minutes (reduced for better auth state sync)
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: (failureCount, error) => {
        const errorMessage = error?.message || '';
        
        // Don't retry auth errors
        if (errorMessage.includes("401") || errorMessage.includes("403")) {
          console.log('🚫 Not retrying auth error:', errorMessage);
          return false;
        }
        
        // Don't retry 404s
        if (errorMessage.includes("404")) {
          return false;
        }
        
        // Retry network errors up to 3 times
        return failureCount < 3;
      },
    },
    mutations: { 
      retry: (failureCount, error) => {
        const errorMessage = error?.message || '';
        
        // Don't retry client errors (4xx)
        if (errorMessage.match(/^4\d\d:/)) {
          console.log('🚫 Not retrying client error:', errorMessage);
          return false;
        }
        
        // Retry server errors up to 2 times
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
