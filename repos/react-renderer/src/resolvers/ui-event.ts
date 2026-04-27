// ui-event resolver - manages an in-process event queue for browser action messages

import { registerResolver } from './index'

// ============================================================================
// In-process event queue
// ============================================================================

export interface UiEvent {
  action: string
  payload: unknown
  componentId?: string
  timestamp: number
}

const eventQueue: UiEvent[] = []

/**
 * Enqueue a UI event from the WebSocket action handler.
 * Called by the WebSocket handler when an "action" message arrives from the browser.
 */
export function enqueueUiEvent(event: UiEvent): void {
  eventQueue.push(event)
}

// ============================================================================
// Resolver
// ============================================================================

registerResolver('ui_event', async (_rawPointer) => {
  // Dequeue ONE event (shift = FIFO)
  const event = eventQueue.shift()

  if (!event) {
    return { content: null }
  }

  return {
    content: {
      action: event.action,
      payload: event.payload,
      componentId: event.componentId,
      timestamp: event.timestamp,
    },
  }
})
