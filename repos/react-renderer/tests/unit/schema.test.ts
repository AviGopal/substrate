// Unit tests for structural/type-level validation based on src/types.ts

// Side-effect import: registers the ui_component resolver
import '../../src/resolvers/ui-component'

import { describe, expect, test } from 'bun:test'
import { resolve } from '../../src/resolvers/index'
import type {
  DataTablePrimitive,
  ContainerPrimitive,
  UIComponentPointer
} from '../../src/types'

describe('schema validation', () => {
  // (a) valid data-table primitive spec with columns + data arrays is accepted
  test('accepts a valid data-table primitive with columns and data arrays', async () => {
    const primitive: DataTablePrimitive = {
      type: 'data-table',
      columns: [
        { key: 'id', header: 'ID', sortable: true },
        { key: 'name', header: 'Name' },
        { key: 'score', header: 'Score', sortable: true }
      ],
      data: [
        { id: 1, name: 'Alpha', score: 95 },
        { id: 2, name: 'Beta', score: 88 },
        { id: 3, name: 'Gamma', score: 72 }
      ]
    }

    const pointer: UIComponentPointer = { type: 'ui_component', primitive }

    const result = await resolve<{ primitive: DataTablePrimitive }>(pointer)

    expect(result.primitive.type).toBe('data-table')
    expect((result.primitive as DataTablePrimitive).columns).toHaveLength(3)
    expect((result.primitive as DataTablePrimitive).data).toHaveLength(3)
  })

  // (b) container with a malformed child (missing type field) throws a meaningful error
  test('rejects a container with a child that has no type field', async () => {
    const badChild = { text: 'orphan with no type' } // missing required `type`

    const pointer = {
      type: 'ui_component',
      primitive: {
        type: 'container',
        layout: 'vertical',
        children: [badChild]
      } as unknown as ContainerPrimitive
    } as UIComponentPointer

    await expect(resolve(pointer)).rejects.toThrow('Invalid child primitive: missing type')
  })

  // (c) deeply nested container (3 levels) with valid children resolves without error
  test('resolves a 3-level nested container with valid children at all levels', async () => {
    const deepContainer: ContainerPrimitive = {
      type: 'container',
      layout: 'vertical',
      children: [
        {
          type: 'container',
          layout: 'horizontal',
          children: [
            {
              type: 'container',
              layout: 'grid',
              children: [
                { type: 'text', content: 'deep text' },
                { type: 'badge', text: 'deep badge', variant: 'info' }
              ]
            }
          ]
        }
      ]
    }

    const pointer: UIComponentPointer = {
      type: 'ui_component',
      primitive: deepContainer
    }

    const result = await resolve<{ primitive: ContainerPrimitive }>(pointer)

    expect(result).toBeTruthy()
    expect(result.primitive.type).toBe('container')
    // Verify the full nesting came through intact
    const level1 = result.primitive as ContainerPrimitive
    expect(level1.children).toHaveLength(1)
    const level2 = level1.children[0] as ContainerPrimitive
    expect(level2.type).toBe('container')
    const level3 = level2.children[0] as ContainerPrimitive
    expect(level3.type).toBe('container')
    expect(level3.children).toHaveLength(2)
  })
})
