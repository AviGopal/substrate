// data-source-change resolver - patches the data field on table/chart primitives

import { registerResolver } from './index'
import { impulseStore } from '../state/impulse-store'
import { broadcaster } from '../websocket/broadcaster'
import type { UIComponentImpulse } from '../types'

interface DataSourceChangePointer {
  type: 'data_source_change'
  impulseId: string
  data: unknown[]
}

const DATA_PRIMITIVE_TYPES = new Set(['data-table', 'data-table-v2', 'chart'])

registerResolver('data_source_change', async (rawPointer) => {
  const pointer = rawPointer as unknown as DataSourceChangePointer
  const { impulseId, data } = pointer

  const impulse = impulseStore.get(impulseId)
  if (!impulse) {
    return { error: 'impulse not found', impulseId }
  }

  const primitiveType = impulse.pointer.primitive?.type
  if (!primitiveType || !DATA_PRIMITIVE_TYPES.has(primitiveType)) {
    return {
      error: 'unsupported primitive type for data_source_change',
      primitiveType,
      supported: Array.from(DATA_PRIMITIVE_TYPES),
    }
  }

  // Patch ONLY the data field on the primitive
  // Cast through Record to avoid strict union-variant type conflicts
  const existingPrimitive = impulse.pointer.primitive as unknown as Record<string, unknown>
  const updatedPrimitive = {
    ...existingPrimitive,
    data,
  }

  const patch: Partial<UIComponentImpulse> = {
    pointer: {
      ...impulse.pointer,
      primitive: updatedPrimitive as UIComponentImpulse['pointer']['primitive'],
    },
    content: updatedPrimitive as UIComponentImpulse['content'],
  }

  impulseStore.update(impulseId, patch)
  broadcaster.broadcastImpulseUpdated(impulseId, patch)

  return { content: { success: true } }
})
