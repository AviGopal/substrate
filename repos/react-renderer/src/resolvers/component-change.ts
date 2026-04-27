// component-change resolver - replaces the root primitive on a ui_component impulse

import { registerResolver } from './index'
import { impulseStore } from '../state/impulse-store'
import { broadcaster } from '../websocket/broadcaster'
import type { Primitive, UIComponentImpulse } from '../types'

interface ComponentChangePointer {
  type: 'component_change'
  impulseId: string
  primitive: Primitive
  animation?: 'none' | 'fade' | 'slide' | 'scale'
}

registerResolver('component_change', async (rawPointer) => {
  const pointer = rawPointer as unknown as ComponentChangePointer
  const { impulseId, primitive, animation } = pointer

  const impulse = impulseStore.get(impulseId)
  if (!impulse) {
    return { error: 'impulse not found', impulseId }
  }

  // Replace primitive but preserve all layout/display properties from existing
  const updatedPointer = {
    ...impulse.pointer,
    primitive,
    // Override animation only when explicitly provided
    ...(animation !== undefined ? { animation } : {}),
  }

  const patch: Partial<UIComponentImpulse> = {
    pointer: updatedPointer,
    content: primitive,
  }

  impulseStore.update(impulseId, patch)
  broadcaster.broadcastImpulseUpdated(impulseId, patch)

  return { content: { success: true } }
})
