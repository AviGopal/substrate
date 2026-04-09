// WebSocket message handler for react-renderer vessel

import type { ServerWebSocket } from 'bun'
import { nanoid } from 'nanoid'
import type { ClientMessage, QueryMessage, ActionMessage, ViewportMessage } from '../types'
import { impulseStore } from '../state/impulse-store'
import { broadcaster } from './broadcaster'
import {
  parseClientMessage,
  createConnectedMessage,
  createThinkingMessage,
  createActivityCompleteMessage,
  createErrorMessage,
  serializeMessage
} from './protocol'

interface ClientInfo {
  sessionId: string
  connectedAt: number
  lastActivity: number
  viewport?: { width: number; height: number }
}

type WebSocketClient = ServerWebSocket<ClientInfo>

// Query handler type - to be set by the integration layer
type QueryHandler = (query: QueryMessage, sessionId: string) => Promise<void>
type ActionHandler = (action: ActionMessage, sessionId: string) => Promise<void>

let queryHandler: QueryHandler | null = null
let actionHandler: ActionHandler | null = null

/**
 * Set the query handler (called by integration layer)
 */
export function setQueryHandler(handler: QueryHandler): void {
  queryHandler = handler
}

/**
 * Set the action handler (called by integration layer)
 */
export function setActionHandler(handler: ActionHandler): void {
  actionHandler = handler
}

/**
 * Handle new WebSocket connection
 */
export function handleOpen(ws: WebSocketClient): void {
  const sessionId = ws.data.sessionId

  // Add to broadcaster
  broadcaster.addClient(ws)

  // Send connected message
  ws.send(serializeMessage(createConnectedMessage(sessionId, [
    'query',
    'action',
    'viewport',
    'impulse_create',
    'impulse_update',
    'impulse_delete',
    'state_sync'
  ])))

  // Send current state
  const impulses = impulseStore.snapshot()
  if (impulses.length > 0) {
    broadcaster.sendStateSync(sessionId, impulses)
  }

  console.log(`[Handler] Client connected: ${sessionId}`)
}

/**
 * Handle WebSocket message
 */
export async function handleMessage(
  ws: WebSocketClient,
  data: string | Buffer
): Promise<void> {
  const sessionId = ws.data.sessionId
  ws.data.lastActivity = Date.now()

  // Parse message
  const messageStr = typeof data === 'string' ? data : data.toString()
  const message = parseClientMessage(messageStr)

  if (!message) {
    ws.send(serializeMessage(createErrorMessage('Invalid message format')))
    return
  }

  try {
    switch (message.type) {
      case 'query':
        await handleQuery(ws, message)
        break

      case 'action':
        await handleAction(ws, message)
        break

      case 'viewport':
        handleViewport(ws, message)
        break

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
        break

      default:
        ws.send(serializeMessage(createErrorMessage(`Unknown message type: ${(message as any).type}`)))
    }
  } catch (error) {
    console.error(`[Handler] Error processing message from ${sessionId}:`, error)
    ws.send(serializeMessage(createErrorMessage(
      error instanceof Error ? error.message : 'Internal error'
    )))
  }
}

/**
 * Handle query message
 */
async function handleQuery(ws: WebSocketClient, query: QueryMessage): Promise<void> {
  const sessionId = ws.data.sessionId
  const queryId = query.id || nanoid()

  console.log(`[Handler] Query from ${sessionId}: ${query.text.substring(0, 50)}...`)

  // Send thinking indicator
  ws.send(serializeMessage(createThinkingMessage(queryId, 'Processing query...')))

  if (!queryHandler) {
    // No handler registered - create a placeholder response
    console.warn('[Handler] No query handler registered, creating placeholder')

    // Create a placeholder UI component
    impulseStore.create(
      {
        type: 'container',
        layout: 'vertical',
        gap: 16,
        children: [
          {
            type: 'badge',
            text: 'No Handler',
            variant: 'warning'
          },
          {
            type: 'text',
            content: `Query received: "${query.text}"`,
            variant: 'body'
          },
          {
            type: 'text',
            content: 'No query handler is registered. Connect MiniBob to process queries.',
            variant: 'caption'
          }
        ]
      },
      {
        position: { type: 'below-input' },
        animation: 'slide',
        metadata: { queryId, componentType: 'placeholder' }
      }
    )

    ws.send(serializeMessage(createActivityCompleteMessage(queryId, true)))
    return
  }

  try {
    await queryHandler(query, sessionId)
    ws.send(serializeMessage(createActivityCompleteMessage(queryId, true)))
  } catch (error) {
    console.error(`[Handler] Query handler error:`, error)
    ws.send(serializeMessage(createActivityCompleteMessage(
      queryId,
      false,
      error instanceof Error ? error.message : 'Query processing failed'
    )))
  }
}

/**
 * Handle action message
 */
async function handleAction(ws: WebSocketClient, action: ActionMessage): Promise<void> {
  const sessionId = ws.data.sessionId

  console.log(`[Handler] Action from ${sessionId}: ${action.action} on ${action.componentId}`)

  if (!actionHandler) {
    console.warn('[Handler] No action handler registered')
    ws.send(serializeMessage(createErrorMessage('No action handler registered')))
    return
  }

  try {
    await actionHandler(action, sessionId)
  } catch (error) {
    console.error(`[Handler] Action handler error:`, error)
    ws.send(serializeMessage(createErrorMessage(
      error instanceof Error ? error.message : 'Action processing failed'
    )))
  }
}

/**
 * Handle viewport message
 */
function handleViewport(ws: WebSocketClient, viewport: ViewportMessage): void {
  broadcaster.updateViewport(ws.data.sessionId, viewport.width, viewport.height)
  console.log(`[Handler] Viewport updated for ${ws.data.sessionId}: ${viewport.width}x${viewport.height}`)
}

/**
 * Handle WebSocket close
 */
export function handleClose(ws: WebSocketClient): void {
  broadcaster.removeClient(ws)
  console.log(`[Handler] Client disconnected: ${ws.data.sessionId}`)
}

/**
 * Handle WebSocket drain (backpressure cleared)
 */
export function handleDrain(ws: WebSocketClient): void {
  const drained = broadcaster.drainQueue(ws)
  if (drained > 0) {
    console.log(`[Handler] Drained ${drained} messages for ${ws.data.sessionId}`)
  }
}

// Wire impulse store events to broadcaster
impulseStore.subscribe((event) => {
  switch (event.type) {
    case 'created':
      broadcaster.broadcastImpulseCreated(event.impulse)
      break
    case 'updated':
      broadcaster.broadcastImpulseUpdated(event.id, event.patch)
      break
    case 'deleted':
      broadcaster.broadcastImpulseDeleted(event.id)
      break
  }
})
