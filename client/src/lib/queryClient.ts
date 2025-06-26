import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Read backend base URL from Vite environment variables with fallback
const BASE_URL = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://myshop-qp1o.onrender.com").replace(/\/$/, "");

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// General API request function with method, path, and data
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  // Handle both full URLs and path-only URLs
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // required for session cookies
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Enhanced React Query fetcher with flexible URL handling
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const urlOrPath = queryKey[0] as string;
    
    // Handle both full URLs and API paths
    const fullUrl = urlOrPath.startsWith('http') ? urlOrPath : `${BASE_URL}${urlOrPath}`;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });
    
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    
    await throwIfResNotOk(res);
    return await res.json();
  };

// Alternative query function for custom fetch logic (like in Product component)
export const customQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const urlOrPath = queryKey[0] as string;
  
  // Handle both full URLs and API paths
  const fullUrl = urlOrPath.startsWith('http') ? urlOrPath : `${BASE_URL}${urlOrPath}`;
  
  const response = await fetch(fullUrl, {
    credentials: "include",
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Resource not found");
    }
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

// Query client config with flexible options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity for better data freshness
      retry: (failureCount, error) => {
        // Don't retry 404s or other client errors
        if (error?.message?.includes('404') || error?.message?.includes('4')) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Helper function to build API URLs consistently
export function buildApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// Helper function for query keys that ensures consistency
export function createQueryKey(path: string, params?: Record<string, any>): string[] {
  const basePath = path.startsWith('/api/') ? path : `/api/${path.replace(/^\//, '')}`;
  
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

// Export BASE_URL for components that need direct access
export { BASE_URL };
