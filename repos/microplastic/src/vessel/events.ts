/**
 * Vessel Event Emitter
 *
 * Type-safe event emitter for vessel lifecycle events.
 */

import type { VesselEvents, VesselEventEmitter } from "./types.ts";

type EventHandler<T> = (data: T) => void;

/**
 * Simple typed event emitter implementation
 */
export class VesselEventEmitterImpl implements VesselEventEmitter {
  private handlers = new Map<keyof VesselEvents, Set<EventHandler<unknown>>>();

  on<K extends keyof VesselEvents>(event: K, handler: (data: VesselEvents[K]) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof VesselEvents>(event: K, handler: (data: VesselEvents[K]) => void): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
    }
  }

  emit<K extends keyof VesselEvents>(event: K, data: VesselEvents[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[VesselEvents] Error in handler for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners(event?: keyof VesselEvents): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: keyof VesselEvents): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
