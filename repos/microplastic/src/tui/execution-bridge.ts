/**
 * Execution Bridge
 *
 * Bridges execution events to RegionManager for region-based TUI display.
 * Supports both traditional event listeners and ImpulseStateSpace subscriptions.
 * Creates and updates regions based on execution lifecycle events.
 */

import type { GoalExecutor } from "../execution/executor.ts";
import type { ExecutionResult } from "../execution/types.ts";
import type { ImpulseStore, ExtendedImpulse } from "../impulse/index.ts";
import {
  RegionManager,
  REGION_PRIORITY,
  createInputRegion,
  createActivityRegion,
  createErrorRegion,
  createSummaryRegion,
} from "./regions.ts";

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutionBridgeOptions {
  /** Show tool calls as regions */
  showToolCalls?: boolean;
  /** Show impulses as regions */
  showImpulses?: boolean;
  /** Collapse completed regions after delay (ms) */
  collapseDelay?: number;
  /**
   * Impulse store for subscription-based event handling (Phase 2).
   * If provided, bridge will subscribe to impulses instead of direct events.
   */
  impulseStore?: ImpulseStore;
}

// =============================================================================
// EXECUTION BRIDGE
// =============================================================================

/**
 * ExecutionBridge - connects executor events to region display
 *
 * Maintains 1:1 mapping between impulses and regions for stateful display.
 */
export class ExecutionBridge {
  private regionManager: RegionManager;
  private executor: GoalExecutor;
  private options: ExecutionBridgeOptions;
  private impulseStore: ImpulseStore | undefined;

  // Track current execution
  private currentActivityId: string | null = null;
  private toolCallCounter = 0;

  // Unsubscribe functions for cleanup
  private unsubscribers: Array<() => void> = [];

  // Map impulse IDs to region IDs for stateful updates
  private impulseToRegion = new Map<string, string>();

  constructor(
    regionManager: RegionManager,
    executor: GoalExecutor,
    options: ExecutionBridgeOptions = {}
  ) {
    this.regionManager = regionManager;
    this.executor = executor;
    this.impulseStore = options.impulseStore;
    this.options = {
      showToolCalls: options.showToolCalls ?? true,
      showImpulses: options.showImpulses ?? true,
      collapseDelay: options.collapseDelay ?? 5000,
      impulseStore: options.impulseStore,
    };
  }

  /**
   * Start listening to executor events or impulse store
   */
  wire(): void {
    // If impulse store is available, use subscription-based wiring (Phase 2)
    if (this.impulseStore) {
      this.wireImpulseSubscriptions();
    } else {
      // Fallback to traditional event listeners
      this.wireEventListeners();
    }
  }

  /**
   * Wire impulse subscriptions (Phase 2)
   */
  private wireImpulseSubscriptions(): void {
    if (!this.impulseStore) return;

    // Subscribe to execution events via impulses
    const unsub = this.impulseStore.subscribe(
      (event) => {
        if (event.type !== "create") return;

        const impulse = event.impulse as ExtendedImpulse;
        if (!impulse.content) return;

        try {
          const data = JSON.parse(impulse.content);
          const eventType = impulse.metadata?.executionEvent as string;

          // Route to appropriate handler based on shape (with impulse ID for region mapping)
          switch (impulse.shape) {
            case "activity":
              this.handleActivityImpulse(eventType, data, impulse.id);
              break;
            case "task":
              this.handleTaskImpulse(eventType, data);
              break;
            case "tool_call":
              this.handleToolCallImpulse(eventType, data, impulse.id);
              break;
            case "summary":
              this.handleSummaryImpulse(data, impulse.id);
              break;
            case "error":
              this.handleErrorImpulse(data, impulse.id);
              break;
          }
        } catch (error) {
          console.error("[ExecutionBridge] Error handling impulse:", error);
        }
      },
      {
        // Subscribe only to execution-related impulses
        shape: ["activity", "task", "tool_call", "summary", "error"],
      }
    );

    this.unsubscribers.push(unsub);
  }

  /**
   * Handle activity-related impulses
   */
  private handleActivityImpulse(eventType: string, data: any, impulseId: string): void {
    if (eventType === "execution:start") {
      this.toolCallCounter = 0;
    } else if (eventType === "execution:template_selected") {
      this.currentActivityId = this.getOrCreateRegionForImpulse(impulseId, () =>
        createActivityRegion(
          `activity-${impulseId}`,
          data.template.name,
          data.template.tasks.length
        )
      );
    } else if (eventType === "execution:improvising") {
      this.currentActivityId = this.getOrCreateRegionForImpulse(impulseId, () => {
        const regionOpts = createActivityRegion(
          `activity-${impulseId}`,
          "Improvisation",
          undefined
        );
        return {
          ...regionOpts,
          content: {
            ...regionOpts.content,
            currentTask: data.goal,
          },
          summary: "Improvising",
        };
      });
    }
  }

  /**
   * Handle task-related impulses
   */
  private handleTaskImpulse(eventType: string, data: any): void {
    if (eventType === "execution:task_start") {
      if (this.currentActivityId) {
        this.regionManager.update(this.currentActivityId, {
          currentTask: data.taskName,
          completedTasks: data.taskIndex,
          totalTasks: data.totalTasks,
        });
      }
    } else if (eventType === "execution:task_complete") {
      if (this.currentActivityId) {
        const region = this.regionManager.get(this.currentActivityId);
        if (region) {
          this.regionManager.update(this.currentActivityId, {
            completedTasks: data.taskIndex,
            lastCompletedTask: region.content.currentTask as string | undefined,
          });
        }
      }
    }
  }

  /**
   * Handle tool call impulses
   */
  private handleToolCallImpulse(eventType: string, data: any, impulseId: string): void {
    if (eventType === "execution:tool_call" && this.options.showToolCalls) {
      const regionId = this.getOrCreateRegionForImpulse(impulseId, () => ({
        id: `tool-${impulseId}`,
        shape: "tool_call",
        display: {
          preferred: "inline",
          priority: REGION_PRIORITY.TOOL_CALL,
        },
        content: {
          tool: data.tool,
          args: data.args,
        },
      }));

      // Auto-complete tool calls after brief delay
      setTimeout(() => {
        const toolRegion = this.regionManager.get(regionId);
        if (toolRegion && toolRegion.state !== "complete") {
          this.regionManager.update(regionId, { success: true, duration: 100 });
          this.regionManager.complete(regionId);
        }
      }, 500);
    }
  }

  /**
   * Handle summary impulses
   */
  private handleSummaryImpulse(data: any, impulseId: string): void {
    this.handleComplete(data.result, impulseId);
  }

  /**
   * Handle error impulses
   */
  private handleErrorImpulse(data: any, impulseId: string): void {
    this.handleFailed(data.error, data.result, impulseId);
  }

  /**
   * Wire traditional event listeners (fallback)
   */
  private wireEventListeners(): void {
    // Execution start - reset counters
    this.executor.on("execution:start", () => {
      this.toolCallCounter = 0;
    });

    // Template selected - create activity region
    this.executor.on("execution:template_selected", ({ template }) => {
      this.currentActivityId = `activity-${Date.now()}`;
      const regionOpts = createActivityRegion(
        this.currentActivityId,
        template.name,
        template.tasks.length
      );
      this.regionManager.add({
        id: regionOpts.id!,
        shape: regionOpts.shape!,
        display: regionOpts.display,
        content: regionOpts.content,
        summary: regionOpts.summary,
      });
    });

    // Improvising - create activity region without task count
    this.executor.on("execution:improvising", ({ goal }) => {
      this.currentActivityId = `activity-${Date.now()}`;
      const regionOpts = createActivityRegion(
        this.currentActivityId,
        "Improvisation",
        undefined
      );
      this.regionManager.add({
        id: regionOpts.id!,
        shape: regionOpts.shape!,
        display: regionOpts.display,
        content: {
          ...regionOpts.content,
          currentTask: goal,
        },
        summary: "Improvising",
      });
    });

    // Task start - update activity region
    this.executor.on("execution:task_start", ({ taskIndex, totalTasks, taskName }) => {
      if (this.currentActivityId) {
        this.regionManager.update(this.currentActivityId, {
          currentTask: taskName,
          completedTasks: taskIndex,
          totalTasks,
        });
      }
    });

    // Task complete - update activity region
    this.executor.on("execution:task_complete", ({ taskIndex }) => {
      if (this.currentActivityId) {
        const region = this.regionManager.get(this.currentActivityId);
        if (region) {
          this.regionManager.update(this.currentActivityId, {
            completedTasks: taskIndex,
            lastCompletedTask: region.content.currentTask as string | undefined,
          });
        }
      }
    });

    // Tool call - create tool call region
    this.executor.on("execution:tool_call", ({ tool, args }) => {
      if (this.options.showToolCalls) {
        const id = `tool-${Date.now()}-${this.toolCallCounter++}`;
        this.regionManager.add({
          id,
          shape: "tool_call",
          display: {
            preferred: "inline",
            priority: REGION_PRIORITY.TOOL_CALL,
          },
          content: {
            tool,
            args,
          },
        });

        // Auto-complete tool calls after brief delay (since we don't have result events)
        setTimeout(() => {
          const toolRegion = this.regionManager.get(id);
          if (toolRegion && toolRegion.state !== "complete") {
            this.regionManager.update(id, { success: true, duration: 100 });
            this.regionManager.complete(id);
          }
        }, 500);
      }
    });

    // Execution complete - create summary region
    this.executor.on("execution:complete", ({ result }) => {
      this.handleComplete(result);
    });

    // Execution failed - create error region
    this.executor.on("execution:failed", ({ error, result }) => {
      this.handleFailed(error, result);
    });
  }

  /**
   * Handle successful completion
   */
  private handleComplete(result: ExecutionResult, impulseId?: string): void {
    // Update activity region to complete
    if (this.currentActivityId) {
      this.regionManager.update(this.currentActivityId, {
        status: "completed",
      });
      this.regionManager.complete(this.currentActivityId);
    }

    // Create summary region (use impulse mapping if ID provided)
    const summaryId = impulseId
      ? this.getOrCreateRegionForImpulse(impulseId, () => {
          const trace = result.execution?.executionTrace;
          return createSummaryRegion(`summary-${impulseId}`, result.summary, {
            detail: result.improvised ? "Improvised execution" : `Template: ${result.template?.name}`,
            durationMs: result.durationMs,
            cost: result.cost,
            filesModified: trace?.filesModified ?? [],
            filesCreated: [],
          });
        })
      : (() => {
          // Fallback for non-impulse calls (event listener path)
          const id = `summary-${Date.now()}`;
          const trace = result.execution?.executionTrace;
          const regionOpts = createSummaryRegion(id, result.summary, {
            detail: result.improvised ? "Improvised execution" : `Template: ${result.template?.name}`,
            durationMs: result.durationMs,
            cost: result.cost,
            filesModified: trace?.filesModified ?? [],
            filesCreated: [],
          });
          this.regionManager.add({
            id: regionOpts.id!,
            shape: regionOpts.shape!,
            display: regionOpts.display,
            content: regionOpts.content,
            summary: regionOpts.summary,
          });
          return id;
        })();

    this.regionManager.complete(summaryId);

    // Create output impulse regions
    if (this.options.showImpulses && result.outputImpulses.length > 0) {
      for (const impulse of result.outputImpulses) {
        const impulseId = `impulse-${impulse.id}`;
        this.regionManager.add({
          id: impulseId,
          shape: "impulse",
          display: {
            preferred: "inline",
            priority: REGION_PRIORITY.COMPLETED_OUTPUT - 10,
          },
          content: {
            impulseId: impulse.id,
            impulseType: impulse.pointer?.type ?? "unknown",
          },
          summary: `Output: ${impulse.pointer?.type}`,
        });
        this.regionManager.complete(impulseId);
      }
    }

    // Collapse completed regions after delay
    if (this.options.collapseDelay) {
      setTimeout(() => {
        this.regionManager.collapseCompleted();
      }, this.options.collapseDelay);
    }

    // Reset current state
    this.currentActivityId = null;
  }

  /**
   * Handle failed execution
   */
  private handleFailed(error: string, _result: ExecutionResult, impulseId?: string): void {
    // Update activity region to failed
    if (this.currentActivityId) {
      this.regionManager.update(this.currentActivityId, {
        status: "failed",
      });
      this.regionManager.complete(this.currentActivityId);
    }

    // Create error region (use impulse mapping if ID provided)
    const errorId = impulseId
      ? this.getOrCreateRegionForImpulse(impulseId, () =>
          createErrorRegion(`error-${impulseId}`, error, "ExecutionError")
        )
      : (() => {
          // Fallback for non-impulse calls (event listener path)
          const id = `error-${Date.now()}`;
          const regionOpts = createErrorRegion(id, error, "ExecutionError");
          this.regionManager.add({
            id: regionOpts.id!,
            shape: regionOpts.shape!,
            display: regionOpts.display,
            content: regionOpts.content,
            summary: regionOpts.summary,
          });
          return id;
        })();

    this.regionManager.complete(errorId);

    // Reset current state
    this.currentActivityId = null;
  }

  /**
   * Show input region for new goal
   */
  showInput(): void {
    const existing = this.regionManager.get("input");
    if (existing) {
      this.regionManager.remove("input");
    }

    const regionOpts = createInputRegion("input");
    this.regionManager.add({
      id: regionOpts.id!,
      shape: regionOpts.shape!,
      display: regionOpts.display,
      content: regionOpts.content,
    });
  }

  /**
   * Update input region content
   */
  updateInput(value: string, cursorPosition: number): void {
    this.regionManager.update("input", { value, cursorPosition });
  }

  /**
   * Submit input and remove input region
   */
  submitInput(): void {
    this.regionManager.remove("input");
  }

  /**
   * Cancel input and remove input region
   */
  cancelInput(): void {
    this.regionManager.remove("input");
  }

  /**
   * Clear all completed regions (for fresh start)
   */
  clearCompleted(): void {
    this.regionManager.removeCompleted();
  }

  /**
   * Get the region manager
   */
  getRegionManager(): RegionManager {
    return this.regionManager;
  }

  /**
   * Cleanup - unsubscribe from all impulses
   */
  shutdown(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.impulseToRegion.clear();
  }

  /**
   * Get or create a region for an impulse (ensures 1:1 mapping)
   *
   * Uses a factory function to create region options, ensuring consistent structure
   * while maintaining 1:1 impulse-to-region mapping.
   */
  private getOrCreateRegionForImpulse(
    impulseId: string,
    factory: () => Partial<Parameters<typeof this.regionManager.add>[0]>
  ): string {
    // Check if we already have a region for this impulse
    const existingRegionId = this.impulseToRegion.get(impulseId);
    if (existingRegionId) {
      // Region exists - update it with new data
      const regionOpts = factory();
      if (regionOpts.content) {
        this.regionManager.update(existingRegionId, regionOpts.content, regionOpts.summary);
      }
      return existingRegionId;
    }

    // Create new region using factory
    const regionOpts = factory();
    const regionId = regionOpts.id ?? `region-${impulseId}`;

    this.regionManager.add({
      id: regionId,
      shape: regionOpts.shape!,
      display: regionOpts.display,
      content: regionOpts.content,
      summary: regionOpts.summary,
    });

    // Track mapping
    this.impulseToRegion.set(impulseId, regionId);

    return regionId;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create an execution bridge with default options
 */
export function createExecutionBridge(
  regionManager: RegionManager,
  executor: GoalExecutor,
  options?: ExecutionBridgeOptions
): ExecutionBridge {
  const bridge = new ExecutionBridge(regionManager, executor, options);
  bridge.wire();
  return bridge;
}
