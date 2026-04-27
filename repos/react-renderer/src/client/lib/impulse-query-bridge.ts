import { QueryClient } from '@tanstack/react-query'
import type { UIComponentImpulse } from '../../types'

export type ImpulseStoreEvent =
  | { type: 'created'; impulse: UIComponentImpulse }
  | { type: 'updated'; id: string; patch: Partial<UIComponentImpulse> }
  | { type: 'deleted'; id: string }
  | { type: 'cleared' }

export interface ImpulseStoreShim {
  getAll(): UIComponentImpulse[]
  subscribe(fn: (e: ImpulseStoreEvent) => void): () => void
}

export class ImpulseQueryBridge {
  private unsub: (() => void) | null = null

  constructor(private qc: QueryClient) {}

  start(impulseStore: ImpulseStoreShim) {
    // 1. Seed cache with current store contents
    const all = impulseStore.getAll()
    this.qc.setQueryData(['impulses'], all)
    for (const imp of all) {
      this.qc.setQueryData(['impulse', imp.id], imp)
    }
    // 2. Subscribe to future events
    this.unsub = impulseStore.subscribe((event) => {
      if (event.type === 'created') {
        this.qc.setQueryData(['impulses'], (old: UIComponentImpulse[] = []) => [...old, event.impulse])
        this.qc.setQueryData(['impulse', event.impulse.id], event.impulse)
      } else if (event.type === 'updated') {
        this.qc.setQueryData(['impulse', event.id], (old: UIComponentImpulse | undefined) =>
          old ? { ...old, ...event.patch } : undefined
        )
        this.qc.setQueryData(['impulses'], (old: UIComponentImpulse[] = []) =>
          old.map((i) => (i.id === event.id ? { ...i, ...event.patch } : i))
        )
      } else if (event.type === 'deleted') {
        this.qc.removeQueries({ queryKey: ['impulse', event.id] })
        this.qc.setQueryData(['impulses'], (old: UIComponentImpulse[] = []) =>
          old.filter((i) => i.id !== event.id)
        )
      } else if (event.type === 'cleared') {
        this.qc.setQueryData(['impulses'], [])
        this.qc.removeQueries({ queryKey: ['impulse'] })
      }
    })
  }

  /**
   * Call this when a state_sync WebSocket message arrives.
   * Replaces the full cache with the incoming snapshot.
   */
  sync(impulses: UIComponentImpulse[]) {
    this.qc.removeQueries({ queryKey: ['impulse'] })
    this.qc.setQueryData(['impulses'], impulses)
    for (const imp of impulses) {
      this.qc.setQueryData(['impulse', imp.id], imp)
    }
  }

  stop() {
    this.unsub?.()
    this.unsub = null
  }
}

export function impulseQueryKey(id: string): unknown[] {
  return ['impulse', id]
}
