/**
 * Region Manager
 *
 * Manages impulses as displayable regions with priority-based layout.
 * Each region represents an impulse that can be rendered to the terminal.
 *
 * Adapted from minibob-tui patterns.
 */

import { TypedEventEmitter } from "../vessel/events.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Region state - lifecycle of a displayed impulse
 */
export type RegionState = "loading" | "streaming" | "complete" | "collapsed";

/**
 * Display shape - determines which component renders the region
 */
export type RegionShape =
  | "input"           // User goal input (priority 1000)
  | "activity"        // Activity execution progress (priority 700)
  | "log_stream"      // Streaming output (priority 700)
  | "code"            // Generated code (priority 700)
  | "tool_call"       // Tool execution (priority 600)
  | "summary"         // Completion summary (priority 500)
  | "error"           // Error display (priority 750)
  | "impulse"         // Output impulse (priority 500)
  | "trace"           // Execution trace (priority 600)
  | "block";          // Generic block (priority 500)

/**
 * Display preferences for a region
 */
export interface RegionDisplay {
  /** Preferred display type */
  preferred: "block" | "stream" | "inline";
  /** Priority - higher = rendered higher on screen */
  priority: number;
  /** Whether region disappears after complete */
  ephemeral?: boolean;
  /** Whether region can grow to fill space */
  growable?: boolean;
}

/**
 * Region content - shape-specific data
 */
export interface RegionContent {
  // Input shape
  value?: string;
  cursorPosition?: number;
  placeholder?: string;

  // Activity shape
  name?: string;
  status?: "running" | "completed" | "failed";
  currentTask?: string;
  lastCompletedTask?: string;
  totalTasks?: number;
  completedTasks?: number;

  // Log/stream shape
  lines?: string[];
  maxLines?: number;

  // Code shape
  code?: string;
  language?: string;
  filePath?: string;

  // Tool call shape
  tool?: string;
  args?: Record<string, unknown>;
  duration?: number;
  success?: boolean;

  // Summary shape
  text?: string;
  detail?: string;
  durationMs?: number;
  cost?: number;
  filesModified?: string[];
  filesCreated?: string[];
  tokensUsed?: { input: number; output: number };

  // Error shape
  message?: string;
  errorType?: string;
  stack?: string;

  // Impulse shape
  impulseId?: string;
  impulseType?: string;
  tokens?: number;
  priority?: string;
  contentPreview?: string;
  path?: string;

  // Trace shape
  traceId?: string;
  templateName?: string;
  taskCount?: number;
  completedCount?: number;
  toolCalls?: string[];

  // Generic
  [key: string]: unknown;
}

/**
 * A displayable region
 */
export interface Region {
  /** Unique identifier */
  id: string;
  /** Display shape */
  shape: RegionShape;
  /** Current state */
  state: RegionState;
  /** Display preferences */
  display: RegionDisplay;
  /** Shape-specific content */
  content: RegionContent;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Optional header/summary text */
  summary?: string;
}

/**
 * Events emitted by RegionManager
 */
export interface RegionManagerEvents {
  "region:added": Region;
  "region:updated": Region;
  "region:stateChanged": { region: Region; from: RegionState; to: RegionState };
  "region:removed": string;
  "layout:changed": Region[];
}

// =============================================================================
// PRIORITY CONSTANTS
// =============================================================================

export const REGION_PRIORITY = {
  USER_INPUT: 1000,
  SYSTEM_REQUEST: 900,
  ERROR: 750,
  ACTIVE_OUTPUT: 700,
  TOOL_CALL: 600,
  COMPLETED_OUTPUT: 500,
  COLLAPSED: 100,
  BACKGROUND: 0,
} as const;

// =============================================================================
// REGION MANAGER
// =============================================================================

/**
 * RegionManager - manages impulses as displayable regions
 */
export class RegionManager {
  private regions = new Map<string, Region>();
  private events = new TypedEventEmitter<RegionManagerEvents>();

  // ===========================================================================
  // REGION LIFECYCLE
  // ===========================================================================

  /**
   * Add a new region
   */
  add(options: {
    id: string;
    shape: RegionShape;
    display?: Partial<RegionDisplay>;
    content?: RegionContent;
    summary?: string;
  }): Region {
    const now = Date.now();

    // Determine default priority based on shape
    const defaultPriority = this.getDefaultPriority(options.shape);

    const region: Region = {
      id: options.id,
      shape: options.shape,
      state: "loading",
      display: {
        preferred: options.display?.preferred ?? "block",
        priority: options.display?.priority ?? defaultPriority,
        ephemeral: options.display?.ephemeral,
        growable: options.display?.growable,
      },
      content: options.content ?? {},
      createdAt: now,
      updatedAt: now,
      summary: options.summary,
    };

    this.regions.set(region.id, region);
    this.events.emit("region:added", region);
    this.events.emit("layout:changed", this.getLayout());

    return region;
  }

  /**
   * Update a region's content
   */
  update(id: string, content: Partial<RegionContent>, summary?: string): Region | undefined {
    const region = this.regions.get(id);
    if (!region) return undefined;

    const oldState = region.state;
    region.content = { ...region.content, ...content };
    region.updatedAt = Date.now();
    if (summary !== undefined) {
      region.summary = summary;
    }

    // Move to streaming state if still loading
    if (region.state === "loading") {
      region.state = "streaming";
      this.events.emit("region:stateChanged", { region, from: oldState, to: "streaming" });
    }

    this.events.emit("region:updated", region);
    return region;
  }

  /**
   * Mark a region as complete
   */
  complete(id: string): Region | undefined {
    const region = this.regions.get(id);
    if (!region) return undefined;

    const oldState = region.state;
    if (oldState === "complete") return region;

    region.state = "complete";
    region.updatedAt = Date.now();

    this.events.emit("region:stateChanged", { region, from: oldState, to: "complete" });
    this.events.emit("region:updated", region);

    // Remove ephemeral regions after completion
    if (region.display.ephemeral) {
      setTimeout(() => this.remove(id), 100);
    }

    return region;
  }

  /**
   * Collapse a region (minimize)
   */
  collapse(id: string): Region | undefined {
    const region = this.regions.get(id);
    if (!region) return undefined;

    const oldState = region.state;
    region.state = "collapsed";
    region.display.priority = REGION_PRIORITY.COLLAPSED;
    region.updatedAt = Date.now();

    this.events.emit("region:stateChanged", { region, from: oldState, to: "collapsed" });
    this.events.emit("layout:changed", this.getLayout());

    return region;
  }

  /**
   * Remove a region entirely
   */
  remove(id: string): boolean {
    const existed = this.regions.delete(id);
    if (existed) {
      this.events.emit("region:removed", id);
      this.events.emit("layout:changed", this.getLayout());
    }
    return existed;
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Get a region by ID
   */
  get(id: string): Region | undefined {
    return this.regions.get(id);
  }

  /**
   * Get all regions
   */
  getAll(): Region[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get layout - regions sorted by priority (higher = top)
   */
  getLayout(): Region[] {
    return Array.from(this.regions.values())
      .filter((r) => r.state !== "collapsed")
      .sort((a, b) => {
        // Higher priority first
        if (b.display.priority !== a.display.priority) {
          return b.display.priority - a.display.priority;
        }
        // Earlier creation first (for same priority)
        return a.createdAt - b.createdAt;
      });
  }

  /**
   * Get regions by shape
   */
  getByShape(shape: RegionShape): Region[] {
    return Array.from(this.regions.values()).filter((r) => r.shape === shape);
  }

  /**
   * Get regions by state
   */
  getByState(state: RegionState): Region[] {
    return Array.from(this.regions.values()).filter((r) => r.state === state);
  }

  /**
   * Check if any regions are active (loading or streaming)
   */
  hasActiveRegions(): boolean {
    return Array.from(this.regions.values()).some(
      (r) => r.state === "loading" || r.state === "streaming"
    );
  }

  // ===========================================================================
  // BULK OPERATIONS
  // ===========================================================================

  /**
   * Clear all regions
   */
  clear(): void {
    const ids = Array.from(this.regions.keys());
    this.regions.clear();
    for (const id of ids) {
      this.events.emit("region:removed", id);
    }
    this.events.emit("layout:changed", []);
  }

  /**
   * Collapse all completed regions
   */
  collapseCompleted(): void {
    for (const region of this.regions.values()) {
      if (region.state === "complete") {
        this.collapse(region.id);
      }
    }
  }

  /**
   * Remove all completed regions
   */
  removeCompleted(): void {
    const toRemove: string[] = [];
    for (const region of this.regions.values()) {
      if (region.state === "complete") {
        toRemove.push(region.id);
      }
    }
    for (const id of toRemove) {
      this.remove(id);
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Get default priority for a shape
   */
  private getDefaultPriority(shape: RegionShape): number {
    switch (shape) {
      case "input":
        return REGION_PRIORITY.USER_INPUT;
      case "error":
        return REGION_PRIORITY.ERROR;
      case "activity":
      case "log_stream":
      case "code":
        return REGION_PRIORITY.ACTIVE_OUTPUT;
      case "tool_call":
      case "trace":
        return REGION_PRIORITY.TOOL_CALL;
      case "summary":
      case "impulse":
      case "block":
      default:
        return REGION_PRIORITY.COMPLETED_OUTPUT;
    }
  }

  // ===========================================================================
  // EVENT SUBSCRIPTION
  // ===========================================================================

  /**
   * Subscribe to region events
   */
  on<K extends keyof RegionManagerEvents>(
    event: K,
    handler: (data: RegionManagerEvents[K]) => void
  ): void {
    this.events.on(event, handler);
  }

  /**
   * Unsubscribe from region events
   */
  off<K extends keyof RegionManagerEvents>(
    event: K,
    handler: (data: RegionManagerEvents[K]) => void
  ): void {
    this.events.off(event, handler);
  }
}

// =============================================================================
// FACTORY HELPERS
// =============================================================================

/**
 * Create an input region
 */
export function createInputRegion(id = "input"): Partial<Parameters<RegionManager["add"]>[0]> {
  return {
    id,
    shape: "input",
    display: {
      preferred: "block",
      priority: REGION_PRIORITY.USER_INPUT,
      ephemeral: true,
    },
    content: {
      value: "",
      cursorPosition: 0,
      placeholder: "Enter a goal...",
    },
  };
}

/**
 * Create an activity region
 */
export function createActivityRegion(
  id: string,
  name: string,
  totalTasks?: number
): Partial<Parameters<RegionManager["add"]>[0]> {
  return {
    id,
    shape: "activity",
    display: {
      preferred: "block",
      priority: REGION_PRIORITY.ACTIVE_OUTPUT,
    },
    content: {
      name,
      status: "running",
      totalTasks,
      completedTasks: 0,
    },
    summary: name,
  };
}

/**
 * Create an error region
 */
export function createErrorRegion(
  id: string,
  message: string,
  errorType?: string
): Partial<Parameters<RegionManager["add"]>[0]> {
  return {
    id,
    shape: "error",
    display: {
      preferred: "block",
      priority: REGION_PRIORITY.ERROR,
    },
    content: {
      message,
      errorType,
    },
    summary: errorType ?? "Error",
  };
}

/**
 * Create a summary region
 */
export function createSummaryRegion(
  id: string,
  text: string,
  options?: {
    detail?: string;
    durationMs?: number;
    cost?: number;
    filesModified?: string[];
    filesCreated?: string[];
  }
): Partial<Parameters<RegionManager["add"]>[0]> {
  return {
    id,
    shape: "summary",
    display: {
      preferred: "block",
      priority: REGION_PRIORITY.COMPLETED_OUTPUT,
    },
    content: {
      text,
      ...options,
    },
    summary: "Summary",
  };
}

/**
 * Create an impulse output region
 */
export function createImpulseRegion(
  id: string,
  impulseType: string,
  options?: {
    tokens?: number;
    priority?: string;
    contentPreview?: string;
    path?: string;
  }
): Partial<Parameters<RegionManager["add"]>[0]> {
  return {
    id,
    shape: "impulse",
    display: {
      preferred: "inline",
      priority: REGION_PRIORITY.COMPLETED_OUTPUT,
    },
    content: {
      impulseId: id,
      impulseType,
      ...options,
    },
    summary: `Impulse: ${impulseType}`,
  };
}

/**
 * Create an execution trace region
 */
export function createTraceRegion(
  id: string,
  options: {
    traceId?: string;
    templateName?: string;
    taskCount?: number;
    completedCount?: number;
    toolCalls?: string[];
    durationMs?: number;
    cost?: number;
    filesModified?: string[];
    filesCreated?: string[];
  }
): Partial<Parameters<RegionManager["add"]>[0]> {
  return {
    id,
    shape: "trace",
    display: {
      preferred: "block",
      priority: REGION_PRIORITY.TOOL_CALL,
    },
    content: {
      ...options,
    },
    summary: options.templateName ?? "Execution Trace",
  };
}
