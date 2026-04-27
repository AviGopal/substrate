// layout-change resolver - patches position/size/layer on a ui_component impulse

import { registerResolver } from './index'
import { impulseStore } from '../state/impulse-store'
import { broadcaster } from '../websocket/broadcaster'
import type { PositionMode, UIComponentImpulse } from '../types'

interface LayoutChangePointer {
  type: 'layout_change'
  impulseId: string
  position?: PositionMode
  size?: { width: string; height: string } | 'auto'
  layer?: number
}

registerResolver('layout_change', async (rawPointer) => {
  const pointer = rawPointer as unknown as LayoutChangePointer
  const { impulseId, position, size, layer } = pointer

  const impulse = impulseStore.get(impulseId)
  if (!impulse) {
    return { error: 'impulse not found', impulseId }
  }

  const patch: Partial<UIComponentImpulse> = {
    pointer: {
      ...impulse.pointer,
      ...(position !== undefined ? { position } : {}),
      ...(size !== undefined ? { size } : {}),
      ...(layer !== undefined ? { layer } : {}),
    },
  }

  impulseStore.update(impulseId, patch)
  broadcaster.broadcastImpulseUpdated(impulseId, patch)

  return { content: { success: true, impulseId } }
})
