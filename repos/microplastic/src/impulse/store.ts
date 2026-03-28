/**
 * ImpulseStore - Shared Impulse State Space
 *
 * Central store for impulses shared across all vessels.
 * Vessels read/write impulses here; resolver routing happens at the registry level.
 *
 * Key features:
 * - Subscription predicates: Filter events by type, shape, priority, or custom logic
 * - Query method: Find impulses matching a predicate
 * - Shape field: Semantic categorization independent of pointer type
 */

import type { Impulse, ImpulsePointer } from "./types.ts";
import {
  type ExtendedImpulse,
  type SubscriptionPredicate,
  type ImpulseShape,
  matchesPredicate,
} from "./types.ts";
import type { ImpulseStore as IImpulseStore, ImpulseStoreEvent, VesselProvider } from "../vessel/types.ts";
import { NoResolverError } from "../vessel/errors.ts";

/**
 * Subscription entry with optional predicate filter
 */
interface SubscriptionEntry {
  listener: (event: ImpulseStoreEvent) => void;
  predicate?: SubscriptionPredicate;
}

/**
 * ImpulseStore implementation - Shared Impulse State Space
 *
 * Manages impulses and routes resolution requests to the appropriate vessel.
 * Supports filtered subscriptions via predicates.
 */
export class ImpulseStore implements IImpulseStore {
  private impulses = new Map<string, ExtendedImpulse>();
  private subscriptions = new Map<symbol, SubscriptionEntry>();
  private idCounter = 0;

  // Resolver registry - set by VesselRegistry
  private resolvers: VesselProvider[] = [];

  /**
   * Set the resolver chain (called by VesselRegistry)
   */
  setResolvers(resolvers: VesselProvider[]): void {
    this.resolvers = resolvers;
  }

  /**
   * Generate a unique impulse ID
   */
  private generateId(): string {
    return `impulse-${Date.now()}-${++this.idCounter}`;
  }

  /**
   * Notify subscribers of an event, filtering by predicate
   */
  private notify(event: ImpulseStoreEvent): void {
    for (const [, entry] of this.subscriptions) {
      try {
        // If no predicate, always notify
        if (!entry.predicate) {
          entry.listener(event);
          continue;
        }

        // Check if impulse matches the subscription predicate
        const impulse = event.impulse as ExtendedImpulse;
        if (matchesPredicate(impulse, entry.predicate)) {
          entry.listener(event);
        }
      } catch (error) {
        console.error("[ImpulseStore] Listener error:", error);
      }
    }
  }

  /**
   * Create a new impulse
   *
   * @param impulse - Impulse data (can include optional shape field)
   * @returns The created impulse with id and timestamps
   */
  create(impulse: Omit<ExtendedImpulse, "loaded" | "createdAt"> & { shape?: ImpulseShape }): ExtendedImpulse {
    const id = impulse.id || this.generateId();
    const fullImpulse: ExtendedImpulse = {
      ...impulse,
      id,
      loaded: false,
      createdAt: Date.now(),
    };

    this.impulses.set(id, fullImpulse);
    this.notify({ type: "create", impulse: fullImpulse });

    return fullImpulse;
  }

  /**
   * Get an impulse by ID
   */
  get(id: string): Impulse | undefined {
    return this.impulses.get(id);
  }

  /**
   * Load an impulse - resolve its pointer and populate content
   */
  async load(id: string): Promise<Impulse> {
    const impulse = this.impulses.get(id);
    if (!impulse) {
      throw new Error(`Impulse not found: ${id}`);
    }

    // Already loaded
    if (impulse.loaded && impulse.content !== undefined) {
      return impulse;
    }

    // Find resolver for this pointer type
    const resolver = this.findResolver(impulse.pointer);
    if (!resolver) {
      throw new NoResolverError(impulse.pointer.type);
    }

    // Resolve content
    const result = await resolver.resolve(impulse);

    // Update impulse with resolved content
    const loadedImpulse: Impulse = {
      ...impulse,
      loaded: true,
      content: result.content,
      tokenCount: this.estimateTokens(result.content),
      metadata: {
        ...impulse.metadata,
        ...result.metadata,
      },
    };

    // Apply budget truncation if needed
    if (loadedImpulse.tokenCount && loadedImpulse.tokenCount > impulse.budget) {
      const ratio = impulse.budget / loadedImpulse.tokenCount;
      const targetChars = Math.floor(result.content.length * ratio * 0.9);
      loadedImpulse.content = result.content.substring(0, targetChars) + "\n... (truncated to fit budget)";
      loadedImpulse.tokenCount = impulse.budget;
      if (loadedImpulse.metadata) {
        loadedImpulse.metadata.truncated = true;
      }
    }

    this.impulses.set(id, loadedImpulse);
    this.notify({ type: "load", impulse: loadedImpulse });

    return loadedImpulse;
  }

  /**
   * Update an impulse
   */
  update(id: string, updates: Partial<Impulse>): Impulse | undefined {
    const impulse = this.impulses.get(id);
    if (!impulse) {
      return undefined;
    }

    const updated = { ...impulse, ...updates, id }; // Preserve id
    this.impulses.set(id, updated);
    this.notify({ type: "update", impulse: updated });

    return updated;
  }

  /**
   * Delete an impulse
   */
  delete(id: string): boolean {
    const impulse = this.impulses.get(id);
    if (!impulse) {
      return false;
    }

    this.impulses.delete(id);
    this.notify({ type: "delete", impulse });

    return true;
  }

  /**
   * List all impulses
   */
  list(): Impulse[] {
    return Array.from(this.impulses.values());
  }

  /**
   * Subscribe to store events with optional predicate filtering.
   *
   * @param listener - Callback for matching events
   * @param predicate - Optional filter (type, shape, priority, custom)
   * @returns Unsubscribe function
   *
   * @example
   * // Subscribe to all events
   * store.subscribe((event) => console.log(event))
   *
   * @example
   * // Subscribe only to file impulses
   * store.subscribe(
   *   (event) => console.log("File:", event.impulse.id),
   *   { type: "file" }
   * )
   *
   * @example
   * // Subscribe to high-priority source code
   * store.subscribe(
   *   (event) => handleCode(event.impulse),
   *   { type: "file", shape: "source_code", minPriority: 750 }
   * )
   */
  subscribe(
    listener: (event: ImpulseStoreEvent) => void,
    predicate?: SubscriptionPredicate
  ): () => void {
    const key = Symbol("subscription");
    this.subscriptions.set(key, { listener, predicate });
    return () => {
      this.subscriptions.delete(key);
    };
  }

  /**
   * Query impulses matching a predicate.
   *
   * @param predicate - Filter criteria
   * @returns Array of matching impulses
   *
   * @example
   * // Find all error impulses
   * const errors = store.query({ shape: "error" })
   *
   * @example
   * // Find high-priority file impulses
   * const important = store.query({ type: "file", minPriority: 750 })
   */
  query(predicate: SubscriptionPredicate): ExtendedImpulse[] {
    const results: ExtendedImpulse[] = [];
    for (const impulse of this.impulses.values()) {
      if (matchesPredicate(impulse, predicate)) {
        results.push(impulse);
      }
    }
    return results;
  }

  /**
   * Find a resolver that can handle a pointer type
   */
  private findResolver(pointer: ImpulsePointer): VesselProvider | undefined {
    for (const resolver of this.resolvers) {
      if (resolver.canResolve(pointer)) {
        return resolver;
      }
    }
    return undefined;
  }

  /**
   * Estimate token count for content
   * Simple heuristic: ~4 characters per token
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Clear all impulses (for testing)
   */
  clear(): void {
    this.impulses.clear();
  }

  /**
   * Get store statistics
   */
  stats(): { total: number; loaded: number; totalTokens: number } {
    let loaded = 0;
    let totalTokens = 0;

    for (const impulse of this.impulses.values()) {
      if (impulse.loaded) {
        loaded++;
        totalTokens += impulse.tokenCount ?? 0;
      }
    }

    return {
      total: this.impulses.size,
      loaded,
      totalTokens,
    };
  }
}
