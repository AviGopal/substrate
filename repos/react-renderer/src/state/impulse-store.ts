// Impulse state management for react-renderer vessel

import { nanoid } from 'nanoid'
import type { UIComponentImpulse, UIComponentPointer, Primitive } from '../types'

type Listener = (event: ImpulseStoreEvent) => void

export type ImpulseStoreEvent =
  | { type: 'created'; impulse: UIComponentImpulse }
  | { type: 'updated'; id: string; patch: Partial<UIComponentImpulse> }
  | { type: 'deleted'; id: string }
  | { type: 'cleared' }

/**
 * ImpulseStore - manages UI component impulses
 *
 * Implements the stigmergy pattern: vessels modify shared state,
 * coordination emerges from state changes.
 */
class ImpulseStore {
  private impulses = new Map<string, UIComponentImpulse>()
  private listeners = new Set<Listener>()

  /**
   * Create a new UI component impulse
   */
  create(
    primitive: Primitive,
    options: {
      id?: string
      position?: UIComponentPointer['position']
      size?: UIComponentPointer['size']
      layer?: number
      animation?: UIComponentPointer['animation']
      priority?: UIComponentImpulse['priority']
      metadata?: UIComponentImpulse['metadata']
      dataRef?: string
      deletable?: boolean
    } = {}
  ): UIComponentImpulse {
    const id = options.id ?? nanoid()
    const now = Date.now()

    const impulse: UIComponentImpulse = {
      id,
      pointer: {
        type: 'ui_component',
        primitive,
        position: options.position ?? { type: 'flow' },
        size: options.size ?? 'auto',
        layer: options.layer ?? 0,
        animation: options.animation ?? 'fade'
      },
      budget: 0, // UI components don't consume token budget
      priority: options.priority ?? 'medium',
      loaded: true, // UI components are always "loaded"
      content: primitive,
      metadata: options.metadata,
      dataRef: options.dataRef,
      deletable: options.deletable ?? true,
      createdAt: now,
      updatedAt: now
    }

    this.impulses.set(id, impulse)
    this.emit({ type: 'created', impulse })

    return impulse
  }

  /**
   * Get an impulse by ID
   */
  get(id: string): UIComponentImpulse | undefined {
    return this.impulses.get(id)
  }

  /**
   * Get all impulses
   */
  getAll(): UIComponentImpulse[] {
    return Array.from(this.impulses.values())
  }

  /**
   * Get impulses by priority
   */
  getByPriority(priority: UIComponentImpulse['priority']): UIComponentImpulse[] {
    return this.getAll().filter((imp) => imp.priority === priority)
  }

  /**
   * Get impulses sorted by layer and creation time
   */
  getSorted(): UIComponentImpulse[] {
    return this.getAll().sort((a, b) => {
      // Sort by layer (higher layers on top)
      const layerDiff = (b.pointer.layer ?? 0) - (a.pointer.layer ?? 0)
      if (layerDiff !== 0) return layerDiff
      // Then by creation time (newer on top)
      return b.createdAt - a.createdAt
    })
  }

  /**
   * Update an impulse
   */
  update(id: string, patch: Partial<UIComponentImpulse>): boolean {
    const existing = this.impulses.get(id)
    if (!existing) return false

    const updated: UIComponentImpulse = {
      ...existing,
      ...patch,
      updatedAt: Date.now()
    }

    this.impulses.set(id, updated)
    this.emit({ type: 'updated', id, patch })

    return true
  }

  /**
   * Delete an impulse
   */
  delete(id: string): boolean {
    const existing = this.impulses.get(id)
    if (!existing) return false

    // Check if deletable
    if (existing.deletable === false) {
      console.warn(`[ImpulseStore] Cannot delete protected impulse: ${id}`)
      return false
    }

    this.impulses.delete(id)
    this.emit({ type: 'deleted', id })

    return true
  }

  /**
   * Clear all impulses (except protected ones)
   */
  clear(exceptIds: string[] = []): void {
    const toDelete: string[] = []

    for (const [id, impulse] of this.impulses) {
      if (exceptIds.includes(id)) continue
      if (impulse.deletable === false) continue
      toDelete.push(id)
    }

    for (const id of toDelete) {
      this.impulses.delete(id)
    }

    this.emit({ type: 'cleared' })
  }

  /**
   * Subscribe to impulse changes
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: ImpulseStoreEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[ImpulseStore] Listener error:', error)
      }
    }
  }

  /**
   * Get snapshot for state sync
   */
  snapshot(): UIComponentImpulse[] {
    return this.getAll()
  }

  /**
   * Restore from snapshot
   */
  restore(impulses: UIComponentImpulse[]): void {
    this.impulses.clear()
    for (const impulse of impulses) {
      this.impulses.set(impulse.id, impulse)
    }
  }
}

// Export singleton instance
export const impulseStore = new ImpulseStore()

// ============================================================================
// Render error log (in-memory, max 100 entries)
// ============================================================================

const renderErrors: Array<{
  impulseId: string
  primitiveType: string
  error: string
  stack?: string
  timestamp: number
}> = []

export function recordRenderError(entry: typeof renderErrors[number]): void {
  renderErrors.unshift(entry)
  if (renderErrors.length > 100) renderErrors.pop()
}

export function getRenderErrors(): typeof renderErrors {
  return renderErrors
}
