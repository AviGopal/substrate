/**
 * TUI State Machine
 *
 * Central state management with temporal observability.
 * Every state transition is recorded with timestamps for testing and debugging.
 */

import { TypedEventEmitter } from "../vessel/events.ts";

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Narrative phases - what the UI is showing
 */
export type NarrativePhase =
  | "idle"           // Waiting for input
  | "thinking"       // Processing goal, selecting template
  | "executing"      // Running activity
  | "verifying"      // Checking results
  | "complete"       // Done successfully
  | "failed"         // Error occurred
  | "recovering";    // Offering recovery options

/**
 * Input state
 */
export interface InputState {
  active: boolean;
  value: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
}

/**
 * Progress state for current activity
 */
export interface ProgressState {
  currentTask: number;
  totalTasks: number;
  taskName: string;
  startedAt: number;
  tokens: { input: number; output: number };
  cost: number;
}

/**
 * Tool call record for display
 */
export interface ToolCallDisplay {
  tool: string;
  args?: Record<string, unknown>;
  status: "running" | "complete" | "failed";
  timestamp: number;
  duration?: number;
}

/**
 * Impulse display for loaded impulses
 */
export interface ImpulseDisplay {
  id: string;
  type: string;
  status: "loading" | "loaded" | "failed";
  tokens?: number;
  timestamp: number;
}

/**
 * Narrative content to display
 */
export interface NarrativeContent {
  /** Main narrative text */
  text: string;
  /** Secondary/detail text */
  detail?: string;
  /** Code or output being shown */
  code?: { language: string; content: string };
  /** Error message if failed */
  error?: string;
  /** Recovery options if applicable */
  recoveryOptions?: string[];
  /** Recent tool calls */
  toolCalls?: ToolCallDisplay[];
  /** Active impulses */
  impulses?: ImpulseDisplay[];
}

/**
 * Full TUI state snapshot
 */
export interface TUISnapshot {
  phase: NarrativePhase;
  input: InputState;
  progress: ProgressState | null;
  narrative: NarrativeContent;
  goal: string | null;
  timestamp: number;
}

// =============================================================================
// TRANSITIONS
// =============================================================================

/**
 * State transition record
 */
export interface StateTransition {
  from: NarrativePhase;
  to: NarrativePhase;
  trigger: string;
  timestamp: number;
  snapshot: TUISnapshot;
}

/**
 * Events emitted by TUIState
 */
export interface TUIStateEvents {
  "phase:change": { from: NarrativePhase; to: NarrativePhase; trigger: string };
  "input:change": InputState;
  "input:submit": { value: string };
  "input:cancel": void;
  "progress:update": ProgressState;
  "narrative:update": NarrativeContent;
  "tool:start": ToolCallDisplay;
  "tool:complete": ToolCallDisplay;
  "impulse:loading": ImpulseDisplay;
  "impulse:loaded": ImpulseDisplay;
  "snapshot": TUISnapshot;
  "tick": number; // For animation frame
}

// =============================================================================
// STATE MACHINE
// =============================================================================

/**
 * TUIState - manages TUI state with temporal observability
 */
export class TUIState {
  private _phase: NarrativePhase = "idle";
  private _input: InputState;
  private _progress: ProgressState | null = null;
  private _narrative: NarrativeContent;
  private _goal: string | null = null;

  // Tool and impulse tracking
  private _toolCalls: ToolCallDisplay[] = [];
  private _impulses: ImpulseDisplay[] = [];
  private _maxToolCalls = 10; // Keep last N tool calls

  // Animation
  private _tickInterval: ReturnType<typeof setInterval> | null = null;
  private _tickCount = 0;

  // Temporal tracking
  private _transitions: StateTransition[] = [];
  private _maxTransitions = 1000;

  // Event emitter
  private events = new TypedEventEmitter<TUIStateEvents>();

  constructor() {
    this._input = {
      active: false,
      value: "",
      cursorPosition: 0,
      history: [],
      historyIndex: -1,
    };

    this._narrative = {
      text: "Ready",
      toolCalls: [],
      impulses: [],
    };
  }

  // ===========================================================================
  // ANIMATION LOOP
  // ===========================================================================

  /**
   * Start the animation tick loop
   */
  startTicking(intervalMs = 100): void {
    if (this._tickInterval) return;
    this._tickInterval = setInterval(() => {
      this._tickCount++;
      this.events.emit("tick", this._tickCount);
    }, intervalMs);
  }

  /**
   * Stop the animation tick loop
   */
  stopTicking(): void {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  /**
   * Get current tick count (for spinner animation)
   */
  get tickCount(): number {
    return this._tickCount;
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  get phase(): NarrativePhase {
    return this._phase;
  }

  get input(): InputState {
    return { ...this._input, history: [...this._input.history] };
  }

  get progress(): ProgressState | null {
    return this._progress ? { ...this._progress } : null;
  }

  get narrative(): NarrativeContent {
    return { ...this._narrative };
  }

  get goal(): string | null {
    return this._goal;
  }

  // ===========================================================================
  // SNAPSHOTS
  // ===========================================================================

  /**
   * Get current state snapshot
   */
  getSnapshot(): TUISnapshot {
    return {
      phase: this._phase,
      input: this.input,
      progress: this.progress,
      narrative: this.narrative,
      goal: this._goal,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all recorded transitions (for testing)
   */
  getTransitions(): StateTransition[] {
    return [...this._transitions];
  }

  /**
   * Get transitions since a timestamp (for testing)
   */
  getTransitionsSince(timestamp: number): StateTransition[] {
    return this._transitions.filter((t) => t.timestamp >= timestamp);
  }

  /**
   * Clear transition history (for testing)
   */
  clearTransitions(): void {
    this._transitions = [];
  }

  // ===========================================================================
  // PHASE TRANSITIONS
  // ===========================================================================

  /**
   * Transition to a new phase
   */
  private transitionTo(phase: NarrativePhase, trigger: string): void {
    const from = this._phase;
    if (from === phase) return;

    this._phase = phase;

    const transition: StateTransition = {
      from,
      to: phase,
      trigger,
      timestamp: Date.now(),
      snapshot: this.getSnapshot(),
    };

    // Record transition
    this._transitions.push(transition);
    if (this._transitions.length > this._maxTransitions) {
      this._transitions.shift();
    }

    // Emit events
    this.events.emit("phase:change", { from, to: phase, trigger });
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Start thinking about a goal
   */
  startThinking(goal: string): void {
    this._goal = goal;
    this._narrative = {
      text: "Thinking...",
      detail: `Understanding: "${goal}"`,
    };
    this.transitionTo("thinking", "goal:submit");
    this.events.emit("narrative:update", this._narrative);
  }

  /**
   * Start executing an activity
   */
  startExecuting(templateName: string, totalTasks: number): void {
    this._progress = {
      currentTask: 0,
      totalTasks,
      taskName: "Initializing...",
      startedAt: Date.now(),
      tokens: { input: 0, output: 0 },
      cost: 0,
    };
    this._narrative = {
      text: `Executing: ${templateName}`,
      detail: `Task 0/${totalTasks}`,
    };
    this.transitionTo("executing", "template:selected");
    this.events.emit("progress:update", this._progress);
    this.events.emit("narrative:update", this._narrative);
  }

  /**
   * Update task progress
   */
  updateProgress(taskIndex: number, taskName: string, tokens?: { input: number; output: number }): void {
    if (!this._progress) return;

    this._progress = {
      ...this._progress,
      currentTask: taskIndex,
      taskName,
      tokens: tokens ?? this._progress.tokens,
    };
    this._narrative = {
      ...this._narrative,
      detail: `Task ${taskIndex + 1}/${this._progress.totalTasks}: ${taskName}`,
    };

    this.events.emit("progress:update", this._progress);
    this.events.emit("narrative:update", this._narrative);
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Start verification
   */
  startVerifying(): void {
    this._narrative = {
      text: "Verifying...",
      detail: "Checking results",
    };
    this.transitionTo("verifying", "execution:complete");
    this.events.emit("narrative:update", this._narrative);
  }

  /**
   * Complete successfully
   */
  complete(summary: string): void {
    this._narrative = {
      text: "Complete",
      detail: summary,
    };
    this._progress = null;
    this.transitionTo("complete", "verification:passed");
    this.events.emit("narrative:update", this._narrative);
  }

  /**
   * Fail with error
   */
  fail(error: string, recoveryOptions?: string[]): void {
    this._narrative = {
      text: "Failed",
      error,
      recoveryOptions,
    };
    this.transitionTo("failed", "error:occurred");
    this.events.emit("narrative:update", this._narrative);
  }

  /**
   * Enter recovery mode
   */
  startRecovery(options: string[]): void {
    this._narrative = {
      ...this._narrative,
      text: "Recovery Options",
      recoveryOptions: options,
    };
    this.transitionTo("recovering", "recovery:offered");
    this.events.emit("narrative:update", this._narrative);
  }

  /**
   * Return to idle
   */
  reset(): void {
    this._goal = null;
    this._progress = null;
    this._toolCalls = [];
    this._impulses = [];
    this._narrative = { text: "Ready", toolCalls: [], impulses: [] };
    this._input = {
      active: false,
      value: "",
      cursorPosition: 0,
      history: this._input.history,
      historyIndex: -1,
    };
    this.transitionTo("idle", "reset");
  }

  // ===========================================================================
  // TOOL CALL TRACKING
  // ===========================================================================

  /**
   * Record a tool call starting
   */
  startToolCall(tool: string, args?: Record<string, unknown>): string {
    const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const toolCall: ToolCallDisplay = {
      tool,
      args,
      status: "running",
      timestamp: Date.now(),
    };
    this._toolCalls.push(toolCall);

    // Keep only recent tool calls
    if (this._toolCalls.length > this._maxToolCalls) {
      this._toolCalls.shift();
    }

    this._narrative = {
      ...this._narrative,
      toolCalls: [...this._toolCalls],
    };

    this.events.emit("tool:start", toolCall);
    this.events.emit("snapshot", this.getSnapshot());
    return id;
  }

  /**
   * Mark a tool call as complete
   */
  completeToolCall(tool: string, success: boolean): void {
    const toolCall = this._toolCalls.find(
      (t) => t.tool === tool && t.status === "running"
    );
    if (toolCall) {
      toolCall.status = success ? "complete" : "failed";
      toolCall.duration = Date.now() - toolCall.timestamp;

      this._narrative = {
        ...this._narrative,
        toolCalls: [...this._toolCalls],
      };

      this.events.emit("tool:complete", toolCall);
      this.events.emit("snapshot", this.getSnapshot());
    }
  }

  /**
   * Get active tool calls
   */
  get activeToolCalls(): ToolCallDisplay[] {
    return this._toolCalls.filter((t) => t.status === "running");
  }

  /**
   * Get all recent tool calls
   */
  get toolCalls(): ToolCallDisplay[] {
    return [...this._toolCalls];
  }

  // ===========================================================================
  // IMPULSE TRACKING
  // ===========================================================================

  /**
   * Record an impulse being loaded
   */
  startImpulseLoad(id: string, type: string): void {
    const impulse: ImpulseDisplay = {
      id,
      type,
      status: "loading",
      timestamp: Date.now(),
    };
    this._impulses.push(impulse);

    this._narrative = {
      ...this._narrative,
      impulses: [...this._impulses],
    };

    this.events.emit("impulse:loading", impulse);
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Mark an impulse as loaded
   */
  completeImpulseLoad(id: string, tokens?: number): void {
    const impulse = this._impulses.find((i) => i.id === id);
    if (impulse) {
      impulse.status = "loaded";
      impulse.tokens = tokens;

      this._narrative = {
        ...this._narrative,
        impulses: [...this._impulses],
      };

      this.events.emit("impulse:loaded", impulse);
      this.events.emit("snapshot", this.getSnapshot());
    }
  }

  /**
   * Get active impulses
   */
  get impulses(): ImpulseDisplay[] {
    return [...this._impulses];
  }

  // ===========================================================================
  // INPUT HANDLING
  // ===========================================================================

  /**
   * Activate input mode
   */
  activateInput(): void {
    this._input = {
      ...this._input,
      active: true,
      historyIndex: -1,
    };
    this.events.emit("input:change", this._input);
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Update input value
   */
  setInputValue(value: string, cursorPosition?: number): void {
    this._input = {
      ...this._input,
      value,
      cursorPosition: cursorPosition ?? value.length,
    };
    this.events.emit("input:change", this._input);
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Inject a key into input
   */
  injectKey(key: string): void {
    if (!this._input.active && key.length === 1 && /[\x20-\x7E]/.test(key)) {
      this.activateInput();
    }

    if (key.length === 1 && /[\x20-\x7E]/.test(key)) {
      const before = this._input.value.slice(0, this._input.cursorPosition);
      const after = this._input.value.slice(this._input.cursorPosition);
      this.setInputValue(before + key + after, this._input.cursorPosition + 1);
    } else if (key === "Backspace" && this._input.cursorPosition > 0) {
      const before = this._input.value.slice(0, this._input.cursorPosition - 1);
      const after = this._input.value.slice(this._input.cursorPosition);
      this.setInputValue(before + after, this._input.cursorPosition - 1);
    } else if (key === "Enter") {
      this.submitInput();
    } else if (key === "Escape") {
      this.cancelInput();
    } else if (key === "ArrowUp") {
      this.historyUp();
    } else if (key === "ArrowDown") {
      this.historyDown();
    }
  }

  /**
   * Submit current input
   */
  submitInput(): void {
    if (!this._input.active || !this._input.value.trim()) return;

    const value = this._input.value.trim();

    // Add to history
    this._input.history.push(value);
    if (this._input.history.length > 100) {
      this._input.history.shift();
    }

    // Reset input
    this._input = {
      active: false,
      value: "",
      cursorPosition: 0,
      history: this._input.history,
      historyIndex: -1,
    };

    this.events.emit("input:submit", { value });
    this.events.emit("input:change", this._input);

    // Start processing
    this.startThinking(value);
  }

  /**
   * Cancel input
   */
  cancelInput(): void {
    if (!this._input.active) return;

    this._input = {
      ...this._input,
      active: false,
      value: "",
      cursorPosition: 0,
      historyIndex: -1,
    };

    this.events.emit("input:cancel", undefined);
    this.events.emit("input:change", this._input);
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Navigate history up
   */
  private historyUp(): void {
    if (this._input.history.length === 0) return;

    const newIndex =
      this._input.historyIndex < 0
        ? this._input.history.length - 1
        : Math.max(0, this._input.historyIndex - 1);

    const value = this._input.history[newIndex] ?? "";
    this._input = {
      ...this._input,
      value,
      cursorPosition: value.length,
      historyIndex: newIndex,
    };

    this.events.emit("input:change", this._input);
    this.events.emit("snapshot", this.getSnapshot());
  }

  /**
   * Navigate history down
   */
  private historyDown(): void {
    if (this._input.historyIndex < 0) return;

    const newIndex = this._input.historyIndex + 1;
    if (newIndex >= this._input.history.length) {
      // Past end of history - clear input
      this._input = {
        ...this._input,
        value: "",
        cursorPosition: 0,
        historyIndex: -1,
      };
    } else {
      const value = this._input.history[newIndex] ?? "";
      this._input = {
        ...this._input,
        value,
        cursorPosition: value.length,
        historyIndex: newIndex,
      };
    }

    this.events.emit("input:change", this._input);
    this.events.emit("snapshot", this.getSnapshot());
  }

  // ===========================================================================
  // EVENT SUBSCRIPTION
  // ===========================================================================

  /**
   * Subscribe to state events
   */
  on<K extends keyof TUIStateEvents>(
    event: K,
    handler: (data: TUIStateEvents[K]) => void
  ): void {
    this.events.on(event, handler);
  }

  /**
   * Unsubscribe from state events
   */
  off<K extends keyof TUIStateEvents>(
    event: K,
    handler: (data: TUIStateEvents[K]) => void
  ): void {
    this.events.off(event, handler);
  }
}

// =============================================================================
// TRANSITION RECORDER (for testing)
// =============================================================================

/**
 * TransitionRecorder - captures state transitions for temporal testing
 */
export class TransitionRecorder {
  private snapshots: TUISnapshot[] = [];
  private unsubscribe: (() => void) | null = null;

  /**
   * Start recording transitions from a state machine
   */
  start(state: TUIState): void {
    this.snapshots = [state.getSnapshot()];
    state.on("snapshot", (snapshot) => {
      this.snapshots.push(snapshot);
    });
  }

  /**
   * Stop recording
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Get all recorded snapshots
   */
  getSnapshots(): TUISnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get phase sequence (consecutive duplicates removed)
   */
  getPhaseSequence(): NarrativePhase[] {
    const phases: NarrativePhase[] = [];
    for (const snapshot of this.snapshots) {
      if (phases.length === 0 || phases[phases.length - 1] !== snapshot.phase) {
        phases.push(snapshot.phase);
      }
    }
    return phases;
  }

  /**
   * Assert phase sequence matches expected
   */
  assertPhaseSequence(expected: NarrativePhase[]): void {
    const actual = this.getPhaseSequence();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Phase sequence mismatch.\nExpected: ${expected.join(" → ")}\nActual: ${actual.join(" → ")}`
      );
    }
  }

  /**
   * Get duration between first and last snapshot
   */
  getDuration(): number {
    if (this.snapshots.length < 2) return 0;
    const first = this.snapshots[0]!;
    const last = this.snapshots[this.snapshots.length - 1]!;
    return last.timestamp - first.timestamp;
  }

  /**
   * Clear recorded snapshots
   */
  clear(): void {
    this.snapshots = [];
  }
}
