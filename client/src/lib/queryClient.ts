import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Verbose mode: global event bus for LLM call metadata
// ---------------------------------------------------------------------------

type VerboseListener = (data: unknown) => void;
const verboseListeners = new Set<VerboseListener>();

/** Subscribe to verbose metadata events from API responses */
export function onVerboseData(listener: VerboseListener): () => void {
  verboseListeners.add(listener);
  return () => verboseListeners.delete(listener);
}

/** Emit verbose data to all listeners */
export function emitVerboseData(data: unknown) {
  for (const listener of Array.from(verboseListeners)) {
    try { listener(data); } catch { /* ignore listener errors */ }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  // For JSON responses from POST requests, intercept to capture verbose data.
  // Clone the response so the caller can still read it.
  const contentType = res.headers.get("content-type") || "";
  if (method === "POST" && contentType.includes("application/json")) {
    const cloned = res.clone();
    cloned.json().then((json) => {
      if (json && typeof json === "object" && "_verbose" in json) {
        emitVerboseData(json);
      }
    }).catch(() => { /* ignore parse errors */ });
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Unified LLM invoke helper — single function for all LLM interactions.
 * Replaces direct calls to individual API endpoints.
 *
 * Usage:
 *   const result = await invokeApi("write", { document, objective, instruction });
 */
export async function invokeApi<T = Record<string, unknown>>(
  taskType: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await apiRequest("POST", "/api/invoke", { taskType, ...params });
  return res.json() as Promise<T>;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
