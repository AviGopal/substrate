// style-change resolver - patches className and/or variant on the root primitive

import { registerResolver } from './index'
import { impulseStore } from '../state/impulse-store'
import { broadcaster } from '../websocket/broadcaster'
import type { UIComponentImpulse } from '../types'

interface StyleChangePointer {
  type: 'style_change'
  impulseId: string
  className?: string
  variant?: string
}

registerResolver('style_change', async (rawPointer) => {
  const pointer = rawPointer as unknown as StyleChangePointer
  const { impulseId, className, variant } = pointer

  const impulse = impulseStore.get(impulseId)
  if (!impulse) {
    return { error: 'impulse not found', impulseId }
  }

  // Patch ONLY className and/or variant on the root primitive — do not replace structure
  // Cast through unknown to allow patching variant/className without hitting strict enum constraints
  const existingPrimitive = impulse.pointer.primitive as unknown as Record<string, unknown>
  const updatedPrimitive = {
    ...existingPrimitive,
    ...(className !== undefined ? { className } : {}),
    ...(variant !== undefined ? { variant } : {}),
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
