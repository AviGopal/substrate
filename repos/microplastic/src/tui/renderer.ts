/**
 * Narrative Renderer
 *
 * Renders TUI state to terminal or plain text.
 * Subscribes to state changes and updates the display.
 */

import type { TUIState, TUISnapshot, NarrativePhase, ProgressState } from "./state.ts";

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

const PHASE_STYLES: Record<NarrativePhase, { color: string; symbol: string }> = {
  idle: { color: "gray", symbol: "○" },
  thinking: { color: "cyan", symbol: "◐" },
  executing: { color: "cyan", symbol: "●" },
  verifying: { color: "yellow", symbol: "◑" },
  complete: { color: "green", symbol: "✓" },
  failed: { color: "red", symbol: "✗" },
  recovering: { color: "yellow", symbol: "⟳" },
};

// ANSI color codes for terminal output
const ANSI_COLORS: Record<string, string> = {
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  inverse: "\x1b[7m",
};

// =============================================================================
// TEXT RENDERER (for testing and non-TTY environments)
// =============================================================================

/**
 * TextRenderer - renders state to plain text
 */
export class TextRenderer {
  /**
   * Render a snapshot to plain text (no ANSI codes)
   */
  static render(snapshot: TUISnapshot): string {
    const lines: string[] = [];
    const style = PHASE_STYLES[snapshot.phase];

    // Header
    lines.push(`${style.symbol} microplastic${snapshot.goal ? ` — ${snapshot.goal}` : ""}`);
    lines.push("");

    // Input
    if (snapshot.input.active) {
      lines.push(`❯ ${snapshot.input.value}`);
    } else if (snapshot.phase === "idle") {
      lines.push("Type to enter a goal...");
    }

    // Progress
    if (snapshot.progress) {
      const p = snapshot.progress;
      const percent = p.totalTasks > 0 ? Math.round((p.currentTask / p.totalTasks) * 100) : 0;
      lines.push(`[${percent}%] Task ${p.currentTask + 1}/${p.totalTasks}: ${p.taskName}`);
    }

    // Narrative
    lines.push("");
    lines.push(snapshot.narrative.text);
    if (snapshot.narrative.detail) {
      lines.push(snapshot.narrative.detail);
    }
    if (snapshot.narrative.error) {
      lines.push(`Error: ${snapshot.narrative.error}`);
    }

    // Status
    lines.push("");
    lines.push(`[${snapshot.phase.toUpperCase()}]`);

    return lines.join("\n");
  }

  /**
   * Render a snapshot with ANSI color codes
   */
  static renderColored(snapshot: TUISnapshot): string {
    const lines: string[] = [];
    const style = PHASE_STYLES[snapshot.phase];
    const c = ANSI_COLORS;

    // Header
    const headerColor = c[style.color] ?? c.reset;
    lines.push(
      `${headerColor}${style.symbol}${c.reset} ` +
      `${headerColor}${c.bold}microplastic${c.reset}` +
      (snapshot.goal ? `${c.gray} — ${snapshot.goal}${c.reset}` : "")
    );
    lines.push("");

    // Input
    if (snapshot.input.active) {
      const before = snapshot.input.value.slice(0, snapshot.input.cursorPosition);
      const cursor = snapshot.input.value[snapshot.input.cursorPosition] ?? " ";
      const after = snapshot.input.value.slice(snapshot.input.cursorPosition + 1);
      lines.push(`${c.cyan}❯${c.reset} ${before}${c.inverse}${cursor}${c.reset}${after}`);
    } else if (snapshot.phase === "idle") {
      lines.push(`${c.dim}Type to enter a goal...${c.reset}`);
    }

    // Progress
    if (snapshot.progress) {
      lines.push(TextRenderer.renderProgressBar(snapshot.progress));
    }

    // Narrative
    lines.push("");
    lines.push(`${headerColor}${snapshot.narrative.text}${c.reset}`);
    if (snapshot.narrative.detail) {
      lines.push(`${c.gray}${snapshot.narrative.detail}${c.reset}`);
    }
    if (snapshot.narrative.error) {
      lines.push(`${c.red}Error: ${snapshot.narrative.error}${c.reset}`);
    }

    // Status
    lines.push("");
    lines.push(`${headerColor}[${snapshot.phase.toUpperCase()}]${c.reset}`);

    return lines.join("\n");
  }

  /**
   * Render progress bar
   */
  private static renderProgressBar(progress: ProgressState): string {
    const c = ANSI_COLORS;
    const percent = progress.totalTasks > 0
      ? Math.round((progress.currentTask / progress.totalTasks) * 100)
      : 0;

    const width = 20;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;

    const bar = `${c.gray}[${c.cyan}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.gray}]${c.reset}`;
    const task = `${c.gray}Task ${progress.currentTask + 1}/${progress.totalTasks}${c.reset}`;

    return `${bar} ${percent}% ${task}`;
  }
}

// =============================================================================
// NARRATIVE RENDERER (for interactive terminal)
// =============================================================================

/**
 * RenderMode - how to render output
 */
export type RenderMode = "text" | "ansi" | "opentui";

/**
 * NarrativeRenderer - renders TUI state to terminal
 *
 * Currently uses simple ANSI output.
 * Future: integrate with @opentui/core for full TUI capabilities.
 */
export class NarrativeRenderer {
  private state: TUIState;
  private lastSnapshot: TUISnapshot | null = null;
  private mode: RenderMode;
  private stdout: NodeJS.WriteStream;
  private lineCount = 0;

  constructor(state: TUIState, options: { mode?: RenderMode; stdout?: NodeJS.WriteStream } = {}) {
    this.state = state;
    this.mode = options.mode ?? (process.stdout.isTTY ? "ansi" : "text");
    this.stdout = options.stdout ?? process.stdout;
  }

  /**
   * Start rendering
   */
  start(): void {
    // Initial render
    this.render();

    // Subscribe to state changes
    this.state.on("snapshot", (snapshot) => {
      this.lastSnapshot = snapshot;
      this.render();
    });
  }

  /**
   * Stop rendering
   */
  stop(): void {
    // Clear the display if in ANSI mode
    if (this.mode === "ansi" && this.lineCount > 0) {
      this.clearLines(this.lineCount);
      this.lineCount = 0;
    }
  }

  /**
   * Force a render
   */
  render(): void {
    const snapshot = this.lastSnapshot ?? this.state.getSnapshot();

    if (this.mode === "ansi") {
      this.renderAnsi(snapshot);
    } else {
      this.renderText(snapshot);
    }
  }

  /**
   * Render with ANSI codes (clears and redraws)
   */
  private renderAnsi(snapshot: TUISnapshot): void {
    // Clear previous output
    if (this.lineCount > 0) {
      this.clearLines(this.lineCount);
    }

    // Render new content
    const output = TextRenderer.renderColored(snapshot);
    const lines = output.split("\n");
    this.lineCount = lines.length;

    this.stdout.write(output + "\n");
  }

  /**
   * Render as plain text (append only)
   */
  private renderText(snapshot: TUISnapshot): void {
    const output = TextRenderer.render(snapshot);
    this.stdout.write(output + "\n\n");
  }

  /**
   * Clear N lines from terminal
   */
  private clearLines(count: number): void {
    // Move cursor up and clear each line
    for (let i = 0; i < count; i++) {
      this.stdout.write("\x1b[1A"); // Move up
      this.stdout.write("\x1b[2K"); // Clear line
    }
  }

  /**
   * Get the current snapshot being rendered
   */
  getCurrentSnapshot(): TUISnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Get current render mode
   */
  getMode(): RenderMode {
    return this.mode;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { PHASE_STYLES };
