import { QueryClient, QueryFunction } from "@tanstack/react-query";

const BASE_URL = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const res = await fetch(fullUrl, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      "X-CSRF-Token": await getCsrfToken(), // Fetch CSRF token
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

// Fetch CSRF token
async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/csrf-token`, { credentials: "include" });
  const { csrfToken } = await res.json();
  return csrfToken;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const urlOrPath = queryKey[0] as string;
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: { "X-CSRF-Token": await getCsrfToken() },
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
  const res = await fetch(fullUrl, {
    credentials: "include",
    headers: { "X-CSRF-Token": await getCsrfToken() },
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
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error?.message?.includes("404") || error?.message?.includes("4")) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: { retry: false },
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
