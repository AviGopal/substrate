// Unit tests for the resolver registry and ui_component resolver

// Side-effect import: registers the ui_component resolver into the registry
import '../../src/resolvers/ui-component'

import { describe, expect, test } from 'bun:test'
import { resolve, hasResolver } from '../../src/resolvers/index'
import type { UIComponentPointer } from '../../src/types'

describe('resolver registry', () => {
  // (e) hasResolver capability checks
  test('hasResolver returns true for ui_component and false for nonexistent', () => {
    expect(hasResolver('ui_component')).toBe(true)
    expect(hasResolver('nonexistent')).toBe(false)
    expect(hasResolver('sparkline-v2')).toBe(false)
  })
})

describe('ui_component resolver', () => {
  // (a) valid data-table pointer resolves and returns primitive intact
  test('resolves a valid data-table pointer and returns the primitive data intact', async () => {
    const pointer: UIComponentPointer = {
      type: 'ui_component',
      primitive: {
        type: 'data-table',
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'status', header: 'Status' }
        ],
        data: [
          { name: 'Alice', status: 'active' },
          { name: 'Bob', status: 'inactive' }
        ]
      }
    }

    const result = await resolve<{ primitive: typeof pointer['primitive'] }>(pointer)

    expect(result).toBeTruthy()
    expect(result.primitive).toEqual(pointer.primitive)
    expect(result.primitive.type).toBe('data-table')
  })

  // (b) valid container pointer with 2 children resolves correctly
  test('resolves a container pointer with 2 children correctly', async () => {
    const pointer: UIComponentPointer = {
      type: 'ui_component',
      primitive: {
        type: 'container',
        layout: 'vertical',
        children: [
          { type: 'text', content: 'Hello' },
          { type: 'badge', text: 'Active', variant: 'success' }
        ]
      }
    }

    const result = await resolve<{
      primitive: typeof pointer['primitive']
      position: unknown
      size: unknown
      layer: number
      animation: string
    }>(pointer)

    expect(result).toBeTruthy()
    expect(result.primitive.type).toBe('container')
    // Children are returned intact
    expect((result.primitive as typeof pointer['primitive']).children).toHaveLength(2)
    // Defaults applied
    expect(result.position).toEqual({ type: 'flow' })
    expect(result.size).toBe('auto')
    expect(result.layer).toBe(0)
    expect(result.animation).toBe('fade')
  })

  // (c) pointer missing the primitive field throws with a meaningful message
  test('throws a meaningful error when the primitive field is missing', async () => {
    const badPointer = {
      type: 'ui_component'
      // primitive field intentionally omitted
    } as UIComponentPointer

    await expect(resolve(badPointer)).rejects.toThrow('Invalid ui_component pointer: missing primitive')
  })

  // (d) unknown primitive type returns a graceful fallback (container wrapping a badge + code)
  test('returns a debug-container fallback for an unknown primitive type without throwing', async () => {
    const pointer = {
      type: 'ui_component',
      primitive: {
        type: 'sparkline-v2',
        data: [1, 2, 3]
      }
    } as unknown as UIComponentPointer

    // Must NOT throw
    const result = await resolve<{
      primitive: { type: string; layout: string; children: Array<{ type: string; variant?: string }> }
    }>(pointer)

    expect(result).toBeTruthy()
    // Graceful fallback: the returned primitive is a container
    expect(result.primitive.type).toBe('container')
    expect(result.primitive.layout).toBe('vertical')
    // First child is a warning badge, second is a code block
    expect(result.primitive.children).toHaveLength(2)
    expect(result.primitive.children[0].type).toBe('badge')
    expect(result.primitive.children[0].variant).toBe('warning')
    expect(result.primitive.children[1].type).toBe('code')
  })
})
