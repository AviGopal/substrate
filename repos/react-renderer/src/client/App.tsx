import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { useEffect, useRef } from 'react'
import { ImpulseQueryBridge } from './lib/impulse-query-bridge'
import type { ImpulseStoreEvent } from './lib/impulse-query-bridge'
import { routeTree } from './routes'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000 } },
})

// Persist to localStorage (24h)
if (typeof window !== 'undefined') {
  const persister = createSyncStoragePersister({ storage: window.localStorage })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persistQueryClient({ queryClient: queryClient as any, persister, maxAge: 24 * 60 * 60 * 1000 })
}

const router = createRouter({ routeTree })

export function App() {
  const bridgeRef = useRef<ImpulseQueryBridge | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const bridge = new ImpulseQueryBridge(queryClient)
    bridgeRef.current = bridge

    // Connect WebSocket
    const wsUrl = `${window.location.origin.replace(/^http/, 'ws')}/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // Client-side store shim — server populates it via state_sync on connect
    const listeners = new Set<(e: ImpulseStoreEvent) => void>()
    const clientStore = {
      getAll: () => [],
      subscribe: (fn: (e: ImpulseStoreEvent) => void) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    }
    bridge.start(clientStore)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'state_sync') {
          bridge.sync(msg.impulses ?? [])
        } else if (msg.type === 'impulse_create') {
          for (const fn of listeners) fn({ type: 'created', impulse: msg.impulse })
        } else if (msg.type === 'impulse_update') {
          for (const fn of listeners) fn({ type: 'updated', id: msg.id, patch: msg.patch })
        } else if (msg.type === 'impulse_delete') {
          for (const fn of listeners) fn({ type: 'deleted', id: msg.id })
        }
      } catch (e) {
        console.warn('WS parse error', e)
      }
    }

    ws.onclose = () => {
      // Reconnect after 2s
      setTimeout(() => {
        wsRef.current = new WebSocket(wsUrl)
      }, 2000)
    }

    return () => {
      bridge.stop()
      ws.close()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
