// TanStack Query bridge for impulse pointer resolution

import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Map an impulse pointer to a stable query key
export function impulseQueryKey(pointer: { type: string; id?: string; [key: string]: unknown }): unknown[] {
  return ["impulse", pointer.type, pointer.id ?? null]
}

// Resolve an impulse pointer to its content by fetching from the local HTTP API
export async function fetchImpulse(pointer: { type: string; id?: string }): Promise<unknown> {
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  const res = await fetch(`${base}/resolve/${pointer.type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pointer }),
  })
  if (!res.ok) throw new Error(`Failed to resolve impulse ${pointer.type}: ${res.status}`)
  return res.json()
}

// Hook: resolve an impulse pointer reactively with caching
export function useImpulse(pointer: { type: string; id?: string; [key: string]: unknown }) {
  return useQuery({
    queryKey: impulseQueryKey(pointer),
    queryFn: () => fetchImpulse(pointer),
    staleTime: 30_000,
    retry: 2,
  })
}

// Hook: invalidate an impulse in the cache (call after WS impulse_update event)
export function useInvalidateImpulse() {
  const client = useQueryClient()
  return (pointer: { type: string; id?: string }) => {
    client.invalidateQueries({ queryKey: impulseQueryKey(pointer) })
  }
}

export { QueryClient, QueryClientProvider }
