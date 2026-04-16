// WebSocket message protocol for react-renderer vessel

import type {
  ClientMessage,
  ServerMessage,
  QueryMessage,
  ActionMessage,
  ViewportMessage,
  PingMessage,
  ConnectedMessage,
  ThinkingMessage,
  ImpulseCreateMessage,
  ImpulseUpdateMessage,
  ImpulseDeleteMessage,
  StateSyncMessage,
  ActivityCompleteMessage,
  ErrorMessage,
  UIComponentImpulse
} from '../types'

// Re-export types
export type {
  ClientMessage,
  ServerMessage,
  QueryMessage,
  ActionMessage,
  ViewportMessage,
  PingMessage,
  ConnectedMessage,
  ThinkingMessage,
  ImpulseCreateMessage,
  ImpulseUpdateMessage,
  ImpulseDeleteMessage,
  StateSyncMessage,
  ActivityCompleteMessage,
  ErrorMessage
}

// ============================================================================
// Type Guards
// ============================================================================

export function isQueryMessage(msg: unknown): msg is QueryMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as QueryMessage).type === 'query' &&
    typeof (msg as QueryMessage).text === 'string'
  )
}

export function isActionMessage(msg: unknown): msg is ActionMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as ActionMessage).type === 'action' &&
    typeof (msg as ActionMessage).componentId === 'string' &&
    typeof (msg as ActionMessage).action === 'string'
  )
}

export function isViewportMessage(msg: unknown): msg is ViewportMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as ViewportMessage).type === 'viewport' &&
    typeof (msg as ViewportMessage).width === 'number' &&
    typeof (msg as ViewportMessage).height === 'number'
  )
}

export function isPingMessage(msg: unknown): msg is PingMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as PingMessage).type === 'ping'
  )
}

export function isClientMessage(msg: unknown): msg is ClientMessage {
  return (
    isQueryMessage(msg) ||
    isActionMessage(msg) ||
    isViewportMessage(msg) ||
    isPingMessage(msg)
  )
}

// ============================================================================
// Message Factories
// ============================================================================

export function createConnectedMessage(
  sessionId: string,
  capabilities: string[] = ['query', 'action', 'viewport']
): ConnectedMessage {
  return {
    type: 'connected',
    sessionId,
    capabilities
  }
}

export function createThinkingMessage(
  queryId: string,
  message: string
): ThinkingMessage {
  return {
    type: 'thinking',
    queryId,
    message
  }
}

export function createImpulseCreateMessage(
  impulse: UIComponentImpulse
): ImpulseCreateMessage {
  return {
    type: 'impulse_create',
    impulse,
    timestamp: Date.now()
  }
}

export function createImpulseUpdateMessage(
  id: string,
  patch: Partial<UIComponentImpulse>
): ImpulseUpdateMessage {
  return {
    type: 'impulse_update',
    id,
    patch,
    timestamp: Date.now()
  }
}

export function createImpulseDeleteMessage(id: string): ImpulseDeleteMessage {
  return {
    type: 'impulse_delete',
    id,
    timestamp: Date.now()
  }
}

export function createStateSyncMessage(
  impulses: UIComponentImpulse[]
): StateSyncMessage {
  return {
    type: 'state_sync',
    impulses,
    timestamp: Date.now()
  }
}

export function createActivityCompleteMessage(
  queryId: string,
  success: boolean,
  error?: string
): ActivityCompleteMessage {
  return {
    type: 'activity_complete',
    queryId,
    success,
    error,
    timestamp: Date.now()
  }
}

export function createErrorMessage(
  message: string,
  code?: string
): ErrorMessage {
  return {
    type: 'error',
    message,
    code
  }
}

// ============================================================================
// Serialization
// ============================================================================

export function serializeMessage(msg: ServerMessage): string {
  return JSON.stringify(msg)
}

export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data)
    if (isClientMessage(parsed)) {
      return parsed
    }
    console.warn('[Protocol] Invalid client message:', parsed)
    return null
  } catch (error) {
    console.error('[Protocol] Failed to parse message:', error)
    return null
  }
}
