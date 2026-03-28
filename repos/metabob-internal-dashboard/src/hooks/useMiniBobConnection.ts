/**
 * React Hook for MiniBob WebSocket Connection
 *
 * Manages WebSocket connection state, reconnection logic, and message handling.
 * Implements exponential backoff with max retry limit.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

// UUID generator with fallback for browsers without crypto.randomUUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback using crypto.getRandomValues
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 3)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
import type {
  ClientMessage,
  ServerMessage,
  UIComponentImpulse,
  QueryMessage,
  ActionMessage
} from '../lib/websocket-handler'

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed'

export interface ConnectionState {
  status: ConnectionStatus
  sessionId: string | null
  capabilities: string[]
  reconnectAttempt: number
  lastError: string | null
}

export interface MiniBobConnectionOptions {
  /** WebSocket URL (defaults to ws://localhost:3001/ws) */
  url?: string
  /** Maximum reconnection attempts before giving up */
  maxRetries?: number
  /** Initial reconnection delay in ms */
  initialDelay?: number
  /** Maximum reconnection delay in ms */
  maxDelay?: number
  /** Enable automatic reconnection */
  autoReconnect?: boolean
}

export interface MiniBobConnection {
  /** Current connection state */
  state: ConnectionState
  /** All current UI component impulses */
  impulses: Map<string, UIComponentImpulse>
  /** Send a query to MiniBob */
  sendQuery: (text: string, context?: QueryMessage['context']) => void
  /** Send an action (button click, row select, etc.) */
  sendAction: (action: string, componentId: string, payload?: unknown) => void
  /** Manually reconnect */
  reconnect: () => void
  /** Manually disconnect */
  disconnect: () => void
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<MiniBobConnectionOptions> = {
  url: typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:3001/ws',
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  autoReconnect: true
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMiniBobConnection(
  options: MiniBobConnectionOptions = {},
  onMessage?: (message: ServerMessage) => void
): MiniBobConnection {
  const config = { ...DEFAULT_OPTIONS, ...options }

  // Connection state
  const [state, setState] = useState<ConnectionState>({
    status: 'disconnected',
    sessionId: null,
    capabilities: [],
    reconnectAttempt: 0,
    lastError: null
  })

  // Impulse state
  const [impulses, setImpulses] = useState<Map<string, UIComponentImpulse>>(new Map())

  // Refs for WebSocket and timers
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const messageQueueRef = useRef<ClientMessage[]>([])

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt: number): number => {
    const delay = config.initialDelay * Math.pow(2, attempt)
    return Math.min(delay, config.maxDelay)
  }, [config.initialDelay, config.maxDelay])

  // Clear reconnection timer
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  // Send message to server
  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(message)
    }
  }, [])

  // Flush message queue
  const flushMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift()
      if (message) {
        send(message)
      }
    }
  }, [send])

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return
    }

    setState(s => ({
      ...s,
      status: s.reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
      lastError: null
    }))

    try {
      const ws = new WebSocket(config.url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useMiniBobConnection] Connected')
        clearReconnectTimer()

        // Send viewport info
        send({
          type: 'viewport',
          width: window.innerWidth,
          height: window.innerHeight
        })

        // Flush any queued messages
        flushMessageQueue()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage
          handleMessage(message)
          onMessage?.(message)
        } catch (error) {
          console.error('[useMiniBobConnection] Error parsing message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[useMiniBobConnection] WebSocket error:', error)
        setState(s => ({
          ...s,
          lastError: 'Connection error'
        }))
      }

      ws.onclose = (event) => {
        console.log('[useMiniBobConnection] Disconnected:', event.code, event.reason)

        setState(s => ({
          ...s,
          status: 'disconnected',
          sessionId: null
        }))

        // Attempt reconnection if enabled
        if (config.autoReconnect && state.reconnectAttempt < config.maxRetries) {
          const delay = getReconnectDelay(state.reconnectAttempt)
          console.log(`[useMiniBobConnection] Reconnecting in ${delay}ms (attempt ${state.reconnectAttempt + 1}/${config.maxRetries})`)

          setState(s => ({
            ...s,
            reconnectAttempt: s.reconnectAttempt + 1
          }))

          reconnectTimerRef.current = setTimeout(connect, delay)
        } else if (state.reconnectAttempt >= config.maxRetries) {
          setState(s => ({
            ...s,
            status: 'failed',
            lastError: 'Maximum reconnection attempts reached'
          }))
        }
      }
    } catch (error) {
      console.error('[useMiniBobConnection] Error creating WebSocket:', error)
      setState(s => ({
        ...s,
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Failed to connect'
      }))
    }
  }, [config.url, config.autoReconnect, config.maxRetries, state.reconnectAttempt,
      clearReconnectTimer, getReconnectDelay, send, flushMessageQueue, onMessage])

  // Handle incoming messages
  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'connected':
        setState(s => ({
          ...s,
          status: 'connected',
          sessionId: message.sessionId,
          capabilities: message.capabilities,
          reconnectAttempt: 0,
          lastError: null
        }))
        break

      case 'pong':
        // Connection is alive, nothing to do
        break

      case 'state_sync':
        // Replace all impulse state
        const newImpulses = new Map<string, UIComponentImpulse>()
        for (const impulse of message.impulses) {
          newImpulses.set(impulse.id, impulse)
        }
        setImpulses(newImpulses)
        break

      case 'impulse_create':
        setImpulses(current => {
          const updated = new Map(current)
          updated.set(message.impulse.id, message.impulse)
          return updated
        })
        break

      case 'impulse_update':
        setImpulses(current => {
          const existing = current.get(message.impulseId)
          if (!existing) return current

          const updated = new Map(current)
          updated.set(message.impulseId, { ...existing, ...message.patch })
          return updated
        })
        break

      case 'impulse_delete':
        setImpulses(current => {
          const updated = new Map(current)
          updated.delete(message.impulseId)
          return updated
        })
        break

      case 'error':
        console.error('[useMiniBobConnection] Server error:', message.error)
        setState(s => ({
          ...s,
          lastError: message.error
        }))
        break

      // These message types are handled by the onMessage callback
      case 'thinking':
      case 'tool_call':
      case 'activity_complete':
        break
    }
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    clearReconnectTimer()
    if (wsRef.current) {
      wsRef.current.close(1000, 'User requested disconnect')
      wsRef.current = null
    }
    setState(s => ({
      ...s,
      status: 'disconnected',
      sessionId: null,
      reconnectAttempt: 0
    }))
  }, [clearReconnectTimer])

  // Reconnect
  const reconnect = useCallback(() => {
    disconnect()
    setState(s => ({ ...s, reconnectAttempt: 0 }))
    // Small delay to ensure clean disconnect
    setTimeout(connect, 100)
  }, [disconnect, connect])

  // Send query
  const sendQuery = useCallback((text: string, context?: QueryMessage['context']) => {
    send({
      type: 'query',
      id: generateUUID(),
      text,
      context,
      timestamp: Date.now()
    })
  }, [send])

  // Send action
  const sendAction = useCallback((action: string, componentId: string, payload?: unknown) => {
    send({
      type: 'action',
      id: generateUUID(),
      action,
      componentId,
      payload,
      timestamp: Date.now()
    })
  }, [send])

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect()

    // Handle viewport resize
    const handleResize = () => {
      send({
        type: 'viewport_resize',
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', handleResize)

    // Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      send({ type: 'ping' })
    }, 30000)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(pingInterval)
      clearReconnectTimer()
      disconnect()
    }
  }, []) // Only run on mount/unmount

  return {
    state,
    impulses,
    sendQuery,
    sendAction,
    reconnect,
    disconnect
  }
}

export default useMiniBobConnection
