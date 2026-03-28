/**
 * TUI Vessel
 *
 * VesselProvider implementation for the narrative TUI.
 * Handles user interaction, display rendering, and UI-related impulse resolution.
 */

import type {
  VesselProvider,
  VesselContext,
  VesselHealth,
  VesselCapability,
  ResolverResult,
} from "../vessel/types.ts";
import type { Impulse, ImpulsePointer, ActivityTemplate } from "@metabob/minibob";
import type { ToolCall } from "../internal-types.ts";
import { TUIState, type TUIStateEvents, type NarrativePhase } from "./state.ts";
import { NarrativeRenderer, type RenderMode } from "./renderer.ts";
import { NarrativeStream, type NarrativeEventType, type GeneratedNarrative } from "./narrative.ts";

// =============================================================================
// TUI POINTER TYPES
// =============================================================================

/**
 * Pointer types that TUIVessel can resolve
 */
export const TUI_POINTER_TYPES = [
  "user_input",      // User text input
  "user_confirm",    // User confirmation (yes/no)
  "user_select",     // User selection from options
  "ui_state",        // Current UI state snapshot
  "display_message", // Message to display to user
] as const;

export type TUIPointerType = typeof TUI_POINTER_TYPES[number];

/**
 * Type guard for TUI pointer types
 */
export function isTUIPointerType(type: string): type is TUIPointerType {
  return TUI_POINTER_TYPES.includes(type as TUIPointerType);
}

// =============================================================================
// TUI VESSEL OPTIONS
// =============================================================================

export interface TUIVesselOptions {
  /** Render mode */
  renderMode?: RenderMode;
  /** Custom stdout stream */
  stdout?: NodeJS.WriteStream;
  /** Custom stdin stream */
  stdin?: NodeJS.ReadStream;
  /** Enable keyboard input handling */
  enableInput?: boolean;
}

// =============================================================================
// TUI VESSEL
// =============================================================================

/**
 * TUIVessel - provides narrative TUI capabilities
 */
export class TUIVessel implements VesselProvider {
  readonly id = "tui";
  readonly name = "Narrative TUI";
  readonly version = "0.1.0";
  readonly description = "Terminal user interface for narrative interaction";

  private state: TUIState;
  private renderer: NarrativeRenderer | null = null;
  private narrativeStream: NarrativeStream;
  private options: TUIVesselOptions;
  private inputHandler: ((key: string) => void) | null = null;

  constructor(options: TUIVesselOptions = {}) {
    this.options = options;
    this.state = new TUIState();
    this.narrativeStream = new NarrativeStream();

    // Connect narrative stream to state updates
    this.narrativeStream.subscribe((narrative, event) => {
      this.applyNarrative(narrative, event.type);
    });
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  async initialize(_context: VesselContext): Promise<void> {

    // Create renderer
    this.renderer = new NarrativeRenderer(this.state, {
      mode: this.options.renderMode,
      stdout: this.options.stdout,
    });

    // Start rendering
    this.renderer.start();

    // Setup input handling if enabled
    if (this.options.enableInput !== false && this.options.stdin) {
      this.setupInputHandling();
    }
  }

  async shutdown(): Promise<void> {
    // Stop input handling
    if (this.inputHandler && this.options.stdin) {
      this.options.stdin.removeListener("data", this.inputHandler as never);
      this.inputHandler = null;
    }

    // Stop renderer
    if (this.renderer) {
      this.renderer.stop();
      this.renderer = null;
    }
  }

  async healthCheck(): Promise<VesselHealth> {
    const checks: VesselHealth["checks"] = [];

    // Check if state is valid
    checks.push({
      name: "state",
      status: this.state ? "pass" : "fail",
      message: this.state ? "State initialized" : "State not initialized",
    });

    // Check if renderer is running
    checks.push({
      name: "renderer",
      status: this.renderer ? "pass" : "warn",
      message: this.renderer ? "Renderer active" : "Renderer not started",
    });

    const allPass = checks.every((c) => c.status === "pass");
    const anyFail = checks.some((c) => c.status === "fail");

    return {
      status: anyFail ? "unhealthy" : allPass ? "healthy" : "degraded",
      checks,
      timestamp: Date.now(),
    };
  }

  // ===========================================================================
  // CAPABILITIES
  // ===========================================================================

  getCapabilities(): VesselCapability[] {
    return [
      {
        id: "tui-user-input",
        name: "User Input",
        description: "Capture text input from user",
        category: "resolver",
        resolves: ["user_input"],
      },
      {
        id: "tui-user-confirm",
        name: "User Confirmation",
        description: "Get yes/no confirmation from user",
        category: "resolver",
        resolves: ["user_confirm"],
      },
      {
        id: "tui-user-select",
        name: "User Selection",
        description: "Present options and get user selection",
        category: "resolver",
        resolves: ["user_select"],
      },
      {
        id: "tui-state",
        name: "UI State",
        description: "Get current TUI state snapshot",
        category: "resolver",
        resolves: ["ui_state"],
      },
      {
        id: "tui-display",
        name: "Display Message",
        description: "Show message to user",
        category: "resolver",
        resolves: ["display_message"],
      },
    ];
  }

  // ===========================================================================
  // RESOLUTION
  // ===========================================================================

  canResolve(pointer: ImpulsePointer): boolean {
    return isTUIPointerType(pointer.type);
  }

  async resolve(impulse: Impulse): Promise<ResolverResult> {
    const { pointer } = impulse;

    if (!isTUIPointerType(pointer.type)) {
      return {
        content: "",
        metadata: { error: `Unknown pointer type: ${pointer.type}` },
      };
    }

    switch (pointer.type) {
      case "user_input":
        return this.resolveUserInput(impulse);

      case "user_confirm":
        return this.resolveUserConfirm(impulse);

      case "user_select":
        return this.resolveUserSelect(impulse);

      case "ui_state":
        return this.resolveUIState();

      case "display_message":
        return this.resolveDisplayMessage(impulse);

      default:
        return {
          content: "",
          metadata: { error: `Unhandled pointer type: ${pointer.type}` },
        };
    }
  }

  // ===========================================================================
  // TEMPLATES
  // ===========================================================================

  getActivityTemplates(): ActivityTemplate[] {
    // TUI vessel doesn't provide activity templates
    return [];
  }

  // ===========================================================================
  // STATE ACCESS
  // ===========================================================================

  /**
   * Get the TUI state (for external use)
   */
  getState(): TUIState {
    return this.state;
  }

  /**
   * Get current phase
   */
  getPhase(): NarrativePhase {
    return this.state.phase;
  }

  /**
   * Subscribe to state events
   */
  on<K extends keyof TUIStateEvents>(
    event: K,
    handler: (data: TUIStateEvents[K]) => void
  ): void {
    this.state.on(event, handler);
  }

  /**
   * Unsubscribe from state events
   */
  off<K extends keyof TUIStateEvents>(
    event: K,
    handler: (data: TUIStateEvents[K]) => void
  ): void {
    this.state.off(event, handler);
  }

  // ===========================================================================
  // NARRATIVE STREAM
  // ===========================================================================

  /**
   * Get the narrative stream for emitting events
   */
  getNarrativeStream(): NarrativeStream {
    return this.narrativeStream;
  }

  /**
   * Emit a narrative event
   */
  narrate(type: NarrativeEventType, data: Record<string, unknown> = {}): GeneratedNarrative {
    return this.narrativeStream.emit(type, data);
  }

  /**
   * Emit narrative for a tool call
   */
  narrateToolCall(call: ToolCall): GeneratedNarrative {
    return this.narrativeStream.emitToolCall(call);
  }

  /**
   * Apply generated narrative to state
   */
  private applyNarrative(_narrative: GeneratedNarrative, eventType: NarrativeEventType): void {
    // Map event types to state transitions
    switch (eventType) {
      case "goal_received":
      case "understanding":
        // State already handles this via startThinking
        break;

      case "task_starting":
      case "task_progress":
      case "tool_call":
      case "thinking":
        // Update narrative during execution
        if (this.state.phase === "executing") {
          // Emit narrative update event
          this.state.on("narrative:update", () => {}); // Trigger update
        }
        break;

      case "success":
        // State handles this via complete()
        break;

      case "failure":
        // State handles this via fail()
        break;

      default:
        break;
    }
  }

  // ===========================================================================
  // STATE CONTROL
  // ===========================================================================

  /**
   * Transition to thinking phase
   */
  startThinking(goal: string): void {
    this.narrativeStream.emit("goal_received", { goal });
    this.state.startThinking(goal);
  }

  /**
   * Transition to executing phase
   */
  startExecuting(templateName: string, totalTasks: number, successRate?: number): void {
    this.narrativeStream.emit("template_selected", {
      templateName,
      totalTasks,
      successRate,
      isNew: !successRate || successRate === 0,
    });
    this.state.startExecuting(templateName, totalTasks);
  }

  /**
   * Start improvisation (no template matched)
   */
  startImprovising(goal: string): void {
    this.narrativeStream.emit("improvising", { goal });
    this.state.startExecuting("improvisation", 0);
  }

  /**
   * Update progress
   */
  updateProgress(taskIndex: number, taskName: string, totalTasks?: number): void {
    this.narrativeStream.emit("task_progress", {
      taskIndex: taskIndex + 1,
      totalTasks: totalTasks ?? this.state.progress?.totalTasks ?? 1,
      taskName,
    });
    this.state.updateProgress(taskIndex, taskName);
  }

  /**
   * Emit thinking narrative
   */
  emitThinking(thought: string): void {
    this.narrativeStream.emit("thinking", { thought });
  }

  /**
   * Transition to verifying phase
   */
  startVerifying(): void {
    this.narrativeStream.emit("verification", {});
    this.state.startVerifying();
  }

  /**
   * Complete successfully
   */
  complete(summary: string, filesModified?: number): void {
    this.narrativeStream.emit("success", { summary, filesModified });
    this.state.complete(summary);
  }

  /**
   * Fail with error
   */
  fail(error: string, recoveryOptions?: string[]): void {
    this.narrativeStream.emit("failure", { error });
    this.state.fail(error, recoveryOptions);

    if (recoveryOptions && recoveryOptions.length > 0) {
      this.narrativeStream.emit("recovery_offered", { options: recoveryOptions });
    }
  }

  /**
   * Emit learning event
   */
  emitLearning(templateName: string): void {
    this.narrativeStream.emit("learning", { templateName });
  }

  /**
   * Reset to idle
   */
  reset(): void {
    this.state.reset();
  }

  // ===========================================================================
  // PRIVATE: INPUT HANDLING
  // ===========================================================================

  private setupInputHandling(): void {
    const stdin = this.options.stdin!;

    // Set raw mode for character-by-character input
    if (stdin.isTTY && stdin.setRawMode) {
      stdin.setRawMode(true);
    }

    this.inputHandler = (data: string) => {
      for (const char of data) {
        this.handleKeypress(char);
      }
    };

    stdin.on("data", this.inputHandler as never);
  }

  private handleKeypress(key: string): void {
    // Handle special keys
    const keyCode = key.charCodeAt(0);

    if (keyCode === 3) {
      // Ctrl+C - exit
      process.exit(0);
    } else if (keyCode === 27) {
      // Escape
      this.state.injectKey("Escape");
    } else if (keyCode === 13) {
      // Enter
      this.state.injectKey("Enter");
    } else if (keyCode === 127) {
      // Backspace
      this.state.injectKey("Backspace");
    } else if (key === "\x1b[A") {
      // Arrow up
      this.state.injectKey("ArrowUp");
    } else if (key === "\x1b[B") {
      // Arrow down
      this.state.injectKey("ArrowDown");
    } else if (keyCode >= 32 && keyCode < 127) {
      // Printable ASCII
      this.state.injectKey(key);
    }
  }

  // ===========================================================================
  // PRIVATE: RESOLUTION IMPLEMENTATIONS
  // ===========================================================================

  private async resolveUserInput(_impulse: Impulse): Promise<ResolverResult> {
    // For now, return the current input value
    // In a real implementation, this would wait for user input
    const input = this.state.input;

    return {
      content: input.value,
      metadata: {
        active: input.active,
        cursorPosition: input.cursorPosition,
      },
    };
  }

  private async resolveUserConfirm(_impulse: Impulse): Promise<ResolverResult> {
    // Placeholder - would show confirmation dialog
    return {
      content: "true",
      metadata: { type: "confirm" },
    };
  }

  private async resolveUserSelect(_impulse: Impulse): Promise<ResolverResult> {
    // Placeholder - would show selection dialog
    return {
      content: "",
      metadata: { type: "select", selectedIndex: -1 },
    };
  }

  private async resolveUIState(): Promise<ResolverResult> {
    const snapshot = this.state.getSnapshot();

    return {
      content: JSON.stringify(snapshot, null, 2),
      metadata: {
        phase: snapshot.phase,
        goal: snapshot.goal,
        timestamp: snapshot.timestamp,
      },
    };
  }

  private async resolveDisplayMessage(impulse: Impulse): Promise<ResolverResult> {
    const pointer = impulse.pointer as { message?: string };
    const message = pointer.message ?? "";

    // Update narrative with the message
    // This is a simple implementation - could be expanded
    if (message) {
      this.state.startThinking(message);
    }

    return {
      content: "displayed",
      metadata: { message },
    };
  }
}
