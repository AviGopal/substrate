// WebSocket broadcaster for impulse updates
// Implements the stigmergy pattern: broadcast changes, clients react independently

import type { ServerWebSocket } from 'bun'
import type { ServerMessage, UIComponentImpulse } from '../types'
import {
  serializeMessage,
  createImpulseCreateMessage,
  createImpulseUpdateMessage,
  createImpulseDeleteMessage,
  createStateSyncMessage
} from './protocol'

interface ClientInfo {
  sessionId: string
  connectedAt: number
  lastActivity: number
  viewport?: { width: number; height: number }
}

type WebSocketClient = ServerWebSocket<ClientInfo>

/**
 * WebSocket Broadcaster
 *
 * Manages connected clients and broadcasts impulse updates to all of them.
 * Implements the stigmergy pattern: vessels modify shared state (impulses),
 * clients observe changes and react independently.
 */
class Broadcaster {
  private clients = new Set<WebSocketClient>()
  private messageQueue = new Map<WebSocketClient, ServerMessage[]>()

  /**
   * Add a new client connection
   */
  addClient(ws: WebSocketClient): void {
    this.clients.add(ws)
    this.messageQueue.set(ws, [])
    console.log(`[Broadcaster] Client connected: ${ws.data.sessionId} (total: ${this.clients.size})`)
  }

  /**
   * Remove a client connection
   */
  removeClient(ws: WebSocketClient): void {
    this.clients.delete(ws)
    this.messageQueue.delete(ws)
    console.log(`[Broadcaster] Client disconnected: ${ws.data.sessionId} (total: ${this.clients.size})`)
  }

  /**
   * Get number of connected clients
   */
  get clientCount(): number {
    return this.clients.size
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: ServerMessage): void {
    const serialized = serializeMessage(message)

    for (const client of this.clients) {
      try {
        const sent = client.send(serialized)
        if (sent === 0) {
          // Message queued due to backpressure
          const queue = this.messageQueue.get(client)
          if (queue) {
            queue.push(message)
          }
        }
      } catch (error) {
        console.error(`[Broadcaster] Failed to send to ${client.data.sessionId}:`, error)
      }
    }
  }

  /**
   * Send a message to a specific client
   */
  sendTo(sessionId: string, message: ServerMessage): boolean {
    for (const client of this.clients) {
      if (client.data.sessionId === sessionId) {
        try {
          client.send(serializeMessage(message))
          return true
        } catch (error) {
          console.error(`[Broadcaster] Failed to send to ${sessionId}:`, error)
          return false
        }
      }
    }
    return false
  }

  /**
   * Broadcast impulse creation
   */
  broadcastImpulseCreated(impulse: UIComponentImpulse): void {
    this.broadcast(createImpulseCreateMessage(impulse))
  }

  /**
   * Broadcast impulse update
   */
  broadcastImpulseUpdated(id: string, patch: Partial<UIComponentImpulse>): void {
    this.broadcast(createImpulseUpdateMessage(id, patch))
  }

  /**
   * Broadcast impulse deletion
   */
  broadcastImpulseDeleted(id: string): void {
    this.broadcast(createImpulseDeleteMessage(id))
  }

  /**
   * Send full state sync to a specific client
   */
  sendStateSync(sessionId: string, impulses: UIComponentImpulse[]): boolean {
    return this.sendTo(sessionId, createStateSyncMessage(impulses))
  }

  /**
   * Drain queued messages for a client (call when backpressure clears)
   */
  drainQueue(ws: WebSocketClient): number {
    const queue = this.messageQueue.get(ws)
    if (!queue || queue.length === 0) return 0

    let sent = 0
    while (queue.length > 0) {
      const message = queue[0]
      try {
        const result = ws.send(serializeMessage(message))
        if (result === 0) {
          // Still backpressured, stop draining
          break
        }
        queue.shift()
        sent++
      } catch (error) {
        console.error(`[Broadcaster] Failed to drain queue for ${ws.data.sessionId}:`, error)
        break
      }
    }

    return sent
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.clients).map((c) => c.data.sessionId)
  }

  /**
   * Update client viewport
   */
  updateViewport(sessionId: string, width: number, height: number): void {
    for (const client of this.clients) {
      if (client.data.sessionId === sessionId) {
        client.data.viewport = { width, height }
        client.data.lastActivity = Date.now()
        break
      }
    }
  }
}

// Export singleton instance
export const broadcaster = new Broadcaster()
