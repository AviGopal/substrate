/**
 * Vessel Event Emitter
 *
 * Type-safe event emitter for vessel lifecycle events.
 */

import type { VesselEvents, VesselEventEmitter } from "./types.ts";

type EventHandler<T> = (data: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventMap = Record<string, any>;

/**
 * Generic typed event emitter implementation
 */
export class TypedEventEmitter<TEvents extends EventMap> {
  private handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  on<K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
    }
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventEmitter] Error in handler for ${String(event)}:`, error);
        }
      }
    }
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

/**
 * Vessel-specific event emitter (for backwards compatibility)
 */
export class VesselEventEmitterImpl extends TypedEventEmitter<VesselEvents> implements VesselEventEmitter {}
