import { describe, test, expect, beforeEach } from 'bun:test'
import { ImpulseQueryBridge } from '../impulse-query-bridge'
import type { ImpulseStoreEvent, ImpulseStoreShim } from '../impulse-query-bridge'
import type { UIComponentImpulse } from '../../../types'

// ============================================================================
// Minimal QueryClient mock
// ============================================================================

class MockQueryClient {
  private cache = new Map<string, unknown>()

  private key(queryKey: unknown[]): string {
    return JSON.stringify(queryKey)
  }

  setQueryData(queryKey: unknown[], updater: unknown) {
    const k = this.key(queryKey)
    if (typeof updater === 'function') {
      const prev = this.cache.get(k)
      this.cache.set(k, (updater as (prev: unknown) => unknown)(prev))
    } else {
      this.cache.set(k, updater)
    }
  }

  getQueryData(queryKey: unknown[]): unknown {
    return this.cache.get(this.key(queryKey))
  }

  removeQueries({ queryKey }: { queryKey: unknown[] }) {
    const prefix = JSON.stringify(queryKey).slice(0, -1) // strip trailing ]
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k)
      }
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function makeImpulse(id: string, layer = 0): UIComponentImpulse {
  return {
    id,
    pointer: {
      type: 'ui_component',
      primitive: { type: 'text', content: id },
      layer,
    },
    budget: 0,
    priority: 'medium',
    loaded: true,
    content: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function makeShim(initial: UIComponentImpulse[] = []): {
  shim: ImpulseStoreShim
  emit: (e: ImpulseStoreEvent) => void
} {
  const listeners = new Set<(e: ImpulseStoreEvent) => void>()
  const shim: ImpulseStoreShim = {
    getAll: () => initial,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  return {
    shim,
    emit: (e) => listeners.forEach((fn) => fn(e)),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ImpulseQueryBridge', () => {
  let qc: MockQueryClient
  let bridge: ImpulseQueryBridge

  beforeEach(() => {
    qc = new MockQueryClient()
    bridge = new ImpulseQueryBridge(qc as unknown as import('@tanstack/react-query').QueryClient)
  })

  test('seeds list and individual caches on start', () => {
    const a = makeImpulse('a')
    const b = makeImpulse('b')
    const { shim } = makeShim([a, b])

    bridge.start(shim)

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    expect(list).toHaveLength(2)
    expect(list.map((i) => i.id)).toContain('a')
    expect(list.map((i) => i.id)).toContain('b')
    expect((qc.getQueryData(['impulse', 'a']) as UIComponentImpulse).id).toBe('a')
    expect((qc.getQueryData(['impulse', 'b']) as UIComponentImpulse).id).toBe('b')
  })

  test('created event adds to list and individual cache', () => {
    const { shim, emit } = makeShim()
    bridge.start(shim)

    const imp = makeImpulse('x')
    emit({ type: 'created', impulse: imp })

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('x')
    expect((qc.getQueryData(['impulse', 'x']) as UIComponentImpulse).id).toBe('x')
  })

  test('updated event merges patch into individual and list caches', () => {
    const imp = makeImpulse('y')
    const { shim, emit } = makeShim([imp])
    bridge.start(shim)

    emit({ type: 'updated', id: 'y', patch: { priority: 'high' } })

    const individual = qc.getQueryData(['impulse', 'y']) as UIComponentImpulse
    expect(individual.priority).toBe('high')

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    const inList = list.find((i) => i.id === 'y')
    expect(inList?.priority).toBe('high')
  })

  test('updated event preserves existing fields not in patch', () => {
    const imp = makeImpulse('z')
    const { shim, emit } = makeShim([imp])
    bridge.start(shim)

    emit({ type: 'updated', id: 'z', patch: { priority: 'critical' } })

    const individual = qc.getQueryData(['impulse', 'z']) as UIComponentImpulse
    expect(individual.id).toBe('z')
    expect(individual.loaded).toBe(true)
  })

  test('deleted event removes from list and individual cache', () => {
    const a = makeImpulse('a')
    const b = makeImpulse('b')
    const { shim, emit } = makeShim([a, b])
    bridge.start(shim)

    emit({ type: 'deleted', id: 'a' })

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('b')
    // Individual cache removed
    expect(qc.getQueryData(['impulse', 'a'])).toBeUndefined()
  })

  test('cleared event empties the list', () => {
    const { shim, emit } = makeShim([makeImpulse('a'), makeImpulse('b')])
    bridge.start(shim)

    emit({ type: 'cleared' })

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    expect(list).toHaveLength(0)
  })

  test('sync() replaces full cache with incoming impulses', () => {
    const { shim } = makeShim([makeImpulse('old')])
    bridge.start(shim)

    const fresh = [makeImpulse('new1'), makeImpulse('new2')]
    bridge.sync(fresh)

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    expect(list).toHaveLength(2)
    expect(list.map((i) => i.id)).toContain('new1')
    expect(list.map((i) => i.id)).toContain('new2')
    expect((qc.getQueryData(['impulse', 'new1']) as UIComponentImpulse).id).toBe('new1')
    // Old individual cache gone
    expect(qc.getQueryData(['impulse', 'old'])).toBeUndefined()
  })

  test('sync() with empty array empties the list', () => {
    const { shim } = makeShim([makeImpulse('a')])
    bridge.start(shim)

    bridge.sync([])

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    expect(list).toHaveLength(0)
  })

  test('stop() unsubscribes and ignores further events', () => {
    const { shim, emit } = makeShim()
    bridge.start(shim)
    bridge.stop()

    emit({ type: 'created', impulse: makeImpulse('after-stop') })

    const list = qc.getQueryData(['impulses']) as UIComponentImpulse[]
    // List was seeded as [] and stop should have unsubscribed before 'created' arrived
    expect(list).toHaveLength(0)
  })
})
