/**
 * VesselRegistry - Vessel Lifecycle Management
 *
 * Manages vessel registration, initialization, shutdown, and resolver routing.
 */

import type {
  VesselProvider,
  VesselContext,
  VesselConfig,
  VesselHealth,
  VesselCapability,
} from "./types.ts";
import { ImpulseStore } from "../impulse/store.ts";
import { VesselEventEmitterImpl } from "./events.ts";
import { createVesselLogger } from "./logger.ts";
import {
  VesselAlreadyRegisteredError,
  VesselNotFoundError,
  VesselInitError,
} from "./errors.ts";
import type { ActivityTemplate } from "../impulse/types.ts";

/**
 * Registry configuration
 */
export interface VesselRegistryConfig {
  /** Working directory for vessels */
  workingDirectory: string;
  /** Development mode */
  developmentMode?: boolean;
  /** Environment variables to pass to vessels */
  environment?: Record<string, string>;
  /** Log level for vessel loggers */
  logLevel?: "debug" | "info" | "warn" | "error";
}

/**
 * VesselRegistry - manages vessel lifecycle and routing
 */
export class VesselRegistry {
  private vessels = new Map<string, VesselProvider>();
  private initOrder: string[] = [];
  private initialized = false;

  // Shared resources
  private readonly impulseStore: ImpulseStore;
  private readonly events: VesselEventEmitterImpl;
  private readonly config: VesselRegistryConfig;

  constructor(config: VesselRegistryConfig) {
    this.config = config;
    this.impulseStore = new ImpulseStore();
    this.events = new VesselEventEmitterImpl();
  }

  /**
   * Register a vessel
   * Vessels must be registered before initialization
   */
  register(vessel: VesselProvider): void {
    if (this.initialized) {
      throw new Error("Cannot register vessels after initialization");
    }

    if (this.vessels.has(vessel.id)) {
      throw new VesselAlreadyRegisteredError(vessel.id);
    }

    this.vessels.set(vessel.id, vessel);
    this.initOrder.push(vessel.id);
  }

  /**
   * Initialize all registered vessels in order
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Set up resolver chain before initialization
    this.impulseStore.setResolvers(Array.from(this.vessels.values()));

    // Initialize vessels in registration order
    for (const vesselId of this.initOrder) {
      const vessel = this.vessels.get(vesselId)!;
      const context = this.createContext(vessel);

      try {
        await vessel.initialize(context);
      } catch (error) {
        throw new VesselInitError(
          vesselId,
          `Failed to initialize vessel: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    this.initialized = true;
  }

  /**
   * Shutdown all vessels in reverse order
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Shutdown in reverse order
    const shutdownOrder = [...this.initOrder].reverse();

    for (const vesselId of shutdownOrder) {
      const vessel = this.vessels.get(vesselId);
      if (vessel) {
        try {
          await vessel.shutdown();
        } catch (error) {
          console.error(`[VesselRegistry] Error shutting down ${vesselId}:`, error);
        }
      }
    }

    this.initialized = false;
    this.events.removeAllListeners();
  }

  /**
   * Get a vessel by ID
   */
  get(id: string): VesselProvider | undefined {
    return this.vessels.get(id);
  }

  /**
   * Get a vessel or throw
   */
  getOrThrow(id: string): VesselProvider {
    const vessel = this.vessels.get(id);
    if (!vessel) {
      throw new VesselNotFoundError(id);
    }
    return vessel;
  }

  /**
   * List all registered vessels
   */
  list(): VesselProvider[] {
    return Array.from(this.vessels.values());
  }

  /**
   * Get all capabilities from all vessels
   */
  getCapabilities(): VesselCapability[] {
    const capabilities: VesselCapability[] = [];
    for (const vessel of this.vessels.values()) {
      capabilities.push(...vessel.getCapabilities());
    }
    return capabilities;
  }

  /**
   * Get all activity templates from all vessels
   */
  getActivityTemplates(): ActivityTemplate[] {
    const templates: ActivityTemplate[] = [];

    // First, collect bootstrap templates (immutable)
    for (const vessel of this.vessels.values()) {
      const bootstrap = vessel.getBootstrapTemplates?.() ?? [];
      templates.push(...bootstrap);
    }

    // Then, collect regular templates
    for (const vessel of this.vessels.values()) {
      templates.push(...vessel.getActivityTemplates());
    }

    return templates;
  }

  /**
   * Perform health checks on all vessels
   */
  async healthCheck(): Promise<Map<string, VesselHealth>> {
    const results = new Map<string, VesselHealth>();

    for (const vessel of this.vessels.values()) {
      try {
        const health = await vessel.healthCheck();
        results.set(vessel.id, health);
      } catch (error) {
        results.set(vessel.id, {
          status: "unhealthy",
          checks: [
            {
              name: "healthCheck",
              status: "fail",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
          timestamp: Date.now(),
        });
      }
    }

    return results;
  }

  /**
   * Get the shared impulse store
   */
  getImpulseStore(): ImpulseStore {
    return this.impulseStore;
  }

  /**
   * Get the event emitter
   */
  getEvents(): VesselEventEmitterImpl {
    return this.events;
  }

  /**
   * Check if the registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a context for a vessel
   */
  private createContext(vessel: VesselProvider): VesselContext {
    const vesselConfig: VesselConfig = {
      developmentMode: this.config.developmentMode ?? false,
      workingDirectory: this.config.workingDirectory,
      environment: this.config.environment ?? {},
      options: {},
    };

    return {
      impulseStore: this.impulseStore,
      config: vesselConfig,
      vessels: this.vessels,
      events: this.events,
      logger: createVesselLogger(vessel.id, this.config.logLevel ?? "info"),
    };
  }
}
