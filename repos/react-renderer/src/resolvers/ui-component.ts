// UI Component resolver - resolves ui_component pointers to primitives

import { registerResolver } from './index'
import type { UIComponentPointer, Primitive } from '../types'

/**
 * UI Component resolver
 *
 * For ui_component pointers, the primitive is already embedded in the pointer.
 * This resolver validates and returns the primitive composition.
 */
registerResolver<UIComponentPointer>('ui_component', async (pointer) => {
  const { primitive, position, size, layer, animation } = pointer

  // Validate primitive structure
  if (!primitive || !primitive.type) {
    throw new Error('Invalid ui_component pointer: missing primitive')
  }

  // Validate primitive type is known
  const validTypes = [
    'container', 'text', 'data-table', 'chart', 'graph',
    'input', 'button', 'badge', 'progress', 'code', 'image', 'custom'
  ]

  if (!validTypes.includes(primitive.type)) {
    console.warn(`[Resolver] Unknown primitive type: ${primitive.type}, rendering as debug`)
    return {
      primitive: {
        type: 'container',
        layout: 'vertical',
        children: [
          {
            type: 'badge',
            text: `Unknown: ${primitive.type}`,
            variant: 'warning'
          },
          {
            type: 'code',
            code: JSON.stringify(primitive, null, 2),
            language: 'json'
          }
        ]
      },
      position: position ?? { type: 'flow' },
      size: size ?? 'auto',
      layer: layer ?? 0,
      animation: animation ?? 'fade'
    }
  }

  // Recursively validate container children
  if (primitive.type === 'container' && primitive.children) {
    validateChildren(primitive.children)
  }

  return {
    primitive,
    position: position ?? { type: 'flow' },
    size: size ?? 'auto',
    layer: layer ?? 0,
    animation: animation ?? 'fade'
  }
})

/**
 * Validate container children recursively
 */
function validateChildren(children: Primitive[]): void {
  for (const child of children) {
    if (!child || !child.type) {
      throw new Error('Invalid child primitive: missing type')
    }
    if (child.type === 'container' && child.children) {
      validateChildren(child.children)
    }
  }
}
