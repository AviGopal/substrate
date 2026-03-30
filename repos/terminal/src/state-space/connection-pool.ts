/**
 * Connection Pool
 *
 * Manages viewer connections to terminals.
 * Supports multi-viewer synchronization.
 */

import type { Connection, ConnectionEvent } from '../types';

type EventHandler<T> = (event: T) => void;

export class ConnectionPool {
  private connections = new Map<string, Connection>();  // connectionId → Connection
  private terminalViewers = new Map<string, Set<string>>();  // terminalId → Set<connectionId>
  private listeners = new Map<string, EventHandler<any>[]>();

  /**
   * Connect viewer to terminal
   */
  connect(terminalId: string, connectionId: string, viewOnly: boolean = false): void {
    const connection: Connection = {
      connectionId,
      terminalId,
      instanceId: process.env.INSTANCE_ID || 'terminal-vessel-1',
      connected: true,
      lastSync: Date.now(),
      viewOnly
    };

    this.connections.set(connectionId, connection);

    // Add to terminal viewers
    if (!this.terminalViewers.has(terminalId)) {
      this.terminalViewers.set(terminalId, new Set());
    }
    this.terminalViewers.get(terminalId)!.add(connectionId);

    // Emit event
    this.emit<ConnectionEvent>('connection', {
      terminalId,
      connectionId,
      action: 'connect',
      timestamp: Date.now()
    });
  }

  /**
   * Disconnect viewer from terminal
   */
  disconnect(terminalId: string, connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.connected = false;
      this.connections.delete(connectionId);
    }

    // Remove from terminal viewers
    const viewers = this.terminalViewers.get(terminalId);
    if (viewers) {
      viewers.delete(connectionId);
      if (viewers.size === 0) {
        this.terminalViewers.delete(terminalId);
      }
    }

    // Emit event
    this.emit<ConnectionEvent>('connection', {
      terminalId,
      connectionId,
      action: 'disconnect',
      timestamp: Date.now()
    });
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): Connection | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get all viewers for terminal
   */
  getViewers(terminalId: string): string[] {
    const viewers = this.terminalViewers.get(terminalId);
    return viewers ? Array.from(viewers) : [];
  }

  /**
   * Get viewer count for terminal
   */
  getViewerCount(terminalId: string): number {
    return this.getViewers(terminalId).length;
  }

  /**
   * Check if connection exists
   */
  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Update connection sync time
   */
  updateSync(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastSync = Date.now();
    }
  }

  /**
   * Get all connections for terminal
   */
  getConnections(terminalId: string): Connection[] {
    const viewerIds = this.getViewers(terminalId);
    return viewerIds
      .map(id => this.connections.get(id))
      .filter((conn): conn is Connection => conn !== undefined);
  }

  /**
   * Check if terminal has any viewers
   */
  hasViewers(terminalId: string): boolean {
    return this.getViewerCount(terminalId) > 0;
  }

  /**
   * Event emitter: emit event
   */
  private emit<T>(event: string, data: T): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Event emitter: register listener
   */
  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  /**
   * Event emitter: remove listener
   */
  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

// Singleton instance
export const connectionPool = new ConnectionPool();
