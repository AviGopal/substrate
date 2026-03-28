/**
 * Impulse Store
 *
 * Manages UI component impulse state.
 * Provides methods for CRUD operations and state reconciliation.
 */

import type { UIComponentImpulse } from '../lib/websocket-handler'

export interface ImpulseStoreState {
  impulses: Map<string, UIComponentImpulse>
  lastSync: number
  dirty: boolean
}

export class ImpulseStore {
  private state: ImpulseStoreState
  private listeners: Set<(state: ImpulseStoreState) => void> = new Set()

  constructor() {
    this.state = {
      impulses: new Map(),
      lastSync: 0,
      dirty: false
    }
  }

  /** Subscribe to state changes */
  subscribe(listener: (state: ImpulseStoreState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Get current state */
  getState(): ImpulseStoreState {
    return this.state
  }

  /** Get all impulses */
  getImpulses(): UIComponentImpulse[] {
    return Array.from(this.state.impulses.values())
  }

  /** Get impulse by ID */
  getImpulse(id: string): UIComponentImpulse | undefined {
    return this.state.impulses.get(id)
  }

  /** Create or update an impulse */
  setImpulse(impulse: UIComponentImpulse) {
    const newImpulses = new Map(this.state.impulses)
    newImpulses.set(impulse.id, impulse)

    this.state = {
      ...this.state,
      impulses: newImpulses,
      dirty: true
    }

    this.notify()
  }

  /** Update an impulse partially */
  updateImpulse(id: string, patch: Partial<UIComponentImpulse>) {
    const existing = this.state.impulses.get(id)
    if (!existing) {
      console.warn(`[ImpulseStore] Impulse not found: ${id}`)
      return
    }

    const updated = { ...existing, ...patch }
    this.setImpulse(updated)
  }

  /** Delete an impulse */
  deleteImpulse(id: string) {
    const existing = this.state.impulses.get(id)
    if (!existing) return

    if (existing.deletable === false) {
      console.warn(`[ImpulseStore] Cannot delete protected impulse: ${id}`)
      return
    }

    const newImpulses = new Map(this.state.impulses)
    newImpulses.delete(id)

    this.state = {
      ...this.state,
      impulses: newImpulses,
      dirty: true
    }

    this.notify()
  }

  /** Clear all impulses except protected ones */
  clear(except: string[] = []) {
    const protected_ = new Set(except)
    const newImpulses = new Map<string, UIComponentImpulse>()

    for (const [id, impulse] of this.state.impulses) {
      if (protected_.has(id) || impulse.deletable === false) {
        newImpulses.set(id, impulse)
      }
    }

    this.state = {
      ...this.state,
      impulses: newImpulses,
      dirty: true
    }

    this.notify()
  }

  /** Sync state from server (replaces all) */
  syncState(impulses: UIComponentImpulse[]) {
    const newImpulses = new Map<string, UIComponentImpulse>()
    for (const impulse of impulses) {
      newImpulses.set(impulse.id, impulse)
    }

    this.state = {
      impulses: newImpulses,
      lastSync: Date.now(),
      dirty: false
    }

    this.notify()
  }

  /** Reconcile state after reconnection */
  reconcile(serverImpulses: UIComponentImpulse[]) {
    const serverIds = new Set(serverImpulses.map(i => i.id))
    const localIds = new Set(this.state.impulses.keys())

    const newImpulses = new Map<string, UIComponentImpulse>()

    // Add all server impulses (server is source of truth)
    for (const impulse of serverImpulses) {
      newImpulses.set(impulse.id, impulse)
    }

    // Keep protected local impulses that aren't on server
    for (const [id, impulse] of this.state.impulses) {
      if (!serverIds.has(id) && impulse.deletable === false) {
        newImpulses.set(id, impulse)
      }
    }

    this.state = {
      impulses: newImpulses,
      lastSync: Date.now(),
      dirty: false
    }

    this.notify()
  }

  /** Get impulses by layer (sorted) */
  getByLayer(): UIComponentImpulse[] {
    return this.getImpulses().sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
  }

  /** Get impulses by position type */
  getByPositionType(type: string): UIComponentImpulse[] {
    return this.getImpulses().filter(i => i.position?.type === type)
  }

  /** Notify listeners of state change */
  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state)
      } catch (error) {
        console.error('[ImpulseStore] Error in listener:', error)
      }
    }
  }
}

// Singleton instance
export const impulseStore = new ImpulseStore()
export default impulseStore
