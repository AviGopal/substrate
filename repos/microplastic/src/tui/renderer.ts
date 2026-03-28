/**
 * Narrative Renderer
 *
 * Renders TUI state to terminal or plain text.
 * Subscribes to state changes and updates the display.
 * Features animated spinner and dynamic tool/impulse display.
 */

import type { TUIState, TUISnapshot, NarrativePhase, ProgressState, ToolCallDisplay, ImpulseDisplay } from "./state.ts";

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

// Spinner frames for animation
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const PHASE_STYLES: Record<NarrativePhase, { color: string; symbol: string }> = {
  idle: { color: "gray", symbol: "○" },
  thinking: { color: "cyan", symbol: "◐" }, // Will be animated
  executing: { color: "cyan", symbol: "●" }, // Will be animated
  verifying: { color: "yellow", symbol: "◑" }, // Will be animated
  complete: { color: "green", symbol: "✓" },
  failed: { color: "red", symbol: "✗" },
  recovering: { color: "yellow", symbol: "⟳" },
};

// Tool icons
const TOOL_ICONS: Record<string, string> = {
  read: "📖",
  write: "✏️",
  edit: "📝",
  bash: "💻",
  glob: "🔍",
  grep: "🔎",
  git: "📦",
  default: "🔧",
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
  static renderColored(snapshot: TUISnapshot, tickCount = 0): string {
    const lines: string[] = [];
    const style = PHASE_STYLES[snapshot.phase];
    const c = ANSI_COLORS;

    // Get animated symbol for active phases
    const symbol = TextRenderer.getAnimatedSymbol(snapshot.phase, tickCount);
    const headerColor = c[style.color] ?? c.reset;

    // Header
    lines.push(
      `${headerColor}${symbol}${c.reset} ` +
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

    // Progress bar
    if (snapshot.progress) {
      lines.push(TextRenderer.renderProgressBar(snapshot.progress));
    }

    // Narrative text
    lines.push("");
    lines.push(`${headerColor}${snapshot.narrative.text}${c.reset}`);
    if (snapshot.narrative.detail) {
      lines.push(`${c.gray}${snapshot.narrative.detail}${c.reset}`);
    }

    // Tool calls (show recent activity)
    if (snapshot.narrative.toolCalls && snapshot.narrative.toolCalls.length > 0) {
      lines.push("");
      lines.push(`${c.dim}─── Activity ───${c.reset}`);
      const recentTools = snapshot.narrative.toolCalls.slice(-5); // Show last 5
      for (const tool of recentTools) {
        lines.push(TextRenderer.renderToolCall(tool, tickCount));
      }
    }

    // Impulses
    if (snapshot.narrative.impulses && snapshot.narrative.impulses.length > 0) {
      const loading = snapshot.narrative.impulses.filter((i) => i.status === "loading");
      if (loading.length > 0) {
        lines.push("");
        lines.push(`${c.dim}─── Impulses ───${c.reset}`);
        for (const impulse of loading) {
          lines.push(TextRenderer.renderImpulse(impulse, tickCount));
        }
      }
    }

    // Error
    if (snapshot.narrative.error) {
      lines.push("");
      lines.push(`${c.red}✗ Error: ${snapshot.narrative.error}${c.reset}`);
    }

    // Recovery options
    if (snapshot.narrative.recoveryOptions && snapshot.narrative.recoveryOptions.length > 0) {
      lines.push("");
      lines.push(`${c.yellow}Recovery options:${c.reset}`);
      snapshot.narrative.recoveryOptions.forEach((opt, i) => {
        lines.push(`  ${c.gray}${i + 1}.${c.reset} ${opt}`);
      });
    }

    // Status footer
    lines.push("");
    const statusLine = TextRenderer.renderStatusLine(snapshot, tickCount);
    lines.push(statusLine);

    return lines.join("\n");
  }

  /**
   * Get animated symbol based on phase and tick
   */
  private static getAnimatedSymbol(phase: NarrativePhase, tickCount: number): string {
    if (phase === "thinking" || phase === "executing" || phase === "verifying") {
      return SPINNER_FRAMES[tickCount % SPINNER_FRAMES.length]!;
    }
    return PHASE_STYLES[phase].symbol;
  }

  /**
   * Render a tool call line
   */
  private static renderToolCall(tool: ToolCallDisplay, tickCount: number): string {
    const c = ANSI_COLORS;
    const icon = TOOL_ICONS[tool.tool] ?? TOOL_ICONS.default;

    if (tool.status === "running") {
      const spinner = SPINNER_FRAMES[tickCount % SPINNER_FRAMES.length];
      return `  ${c.cyan}${spinner}${c.reset} ${icon} ${tool.tool}`;
    } else if (tool.status === "complete") {
      const duration = tool.duration ? ` ${c.dim}(${tool.duration}ms)${c.reset}` : "";
      return `  ${c.green}✓${c.reset} ${icon} ${tool.tool}${duration}`;
    } else {
      return `  ${c.red}✗${c.reset} ${icon} ${tool.tool}`;
    }
  }

  /**
   * Render an impulse line
   */
  private static renderImpulse(impulse: ImpulseDisplay, tickCount: number): string {
    const c = ANSI_COLORS;

    if (impulse.status === "loading") {
      const spinner = SPINNER_FRAMES[tickCount % SPINNER_FRAMES.length];
      return `  ${c.cyan}${spinner}${c.reset} 📥 ${impulse.type}:${impulse.id}`;
    } else if (impulse.status === "loaded") {
      const tokens = impulse.tokens ? ` ${c.dim}(${impulse.tokens} tokens)${c.reset}` : "";
      return `  ${c.green}✓${c.reset} 📥 ${impulse.type}:${impulse.id}${tokens}`;
    } else {
      return `  ${c.red}✗${c.reset} 📥 ${impulse.type}:${impulse.id}`;
    }
  }

  /**
   * Render status line with elapsed time
   */
  private static renderStatusLine(snapshot: TUISnapshot, _tickCount: number): string {
    const c = ANSI_COLORS;
    const style = PHASE_STYLES[snapshot.phase];
    const headerColor = c[style.color] ?? c.reset;

    let elapsed = "";
    if (snapshot.progress?.startedAt) {
      const ms = Date.now() - snapshot.progress.startedAt;
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        elapsed = ` ${c.dim}${minutes}m ${seconds % 60}s${c.reset}`;
      } else {
        elapsed = ` ${c.dim}${seconds}s${c.reset}`;
      }
    }

    return `${headerColor}[${snapshot.phase.toUpperCase()}]${c.reset}${elapsed}`;
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
 * Features:
 * - Animated spinner during active phases
 * - Tool call and impulse display
 * - Elapsed time tracking
 * - Future: integrate with @opentui/core for full TUI capabilities.
 */
export class NarrativeRenderer {
  private state: TUIState;
  private lastSnapshot: TUISnapshot | null = null;
  private mode: RenderMode;
  private stdout: NodeJS.WriteStream;
  private lineCount = 0;
  private tickCount = 0;
  private running = false;

  constructor(state: TUIState, options: { mode?: RenderMode; stdout?: NodeJS.WriteStream } = {}) {
    this.state = state;
    this.mode = options.mode ?? (process.stdout.isTTY ? "ansi" : "text");
    this.stdout = options.stdout ?? process.stdout;
  }

  /**
   * Start rendering with animation loop
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Initial render
    this.render();

    // Subscribe to state changes (update snapshot)
    this.state.on("snapshot", (snapshot) => {
      this.lastSnapshot = snapshot;
      // Don't render here - tick will handle it for smooth animation
      // But render immediately for non-TTY
      if (this.mode !== "ansi") {
        this.render();
      }
    });

    // Subscribe to ticks for animation
    this.state.on("tick", (tick) => {
      this.tickCount = tick;
      if (this.mode === "ansi" && this.running) {
        this.render();
      }
    });

    // Start the animation loop
    this.state.startTicking(100); // 10 FPS for smooth spinners
  }

  /**
   * Stop rendering
   */
  stop(): void {
    this.running = false;
    this.state.stopTicking();

    // Final render to show completed state
    if (this.mode === "ansi") {
      this.render();
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

    // Render new content with current tick for animation
    const output = TextRenderer.renderColored(snapshot, this.tickCount);
    const lines = output.split("\n");
    this.lineCount = lines.length;

    this.stdout.write(output + "\n");
  }

  /**
   * Render as plain text (append only, no animation)
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

  /**
   * Check if renderer is currently running
   */
  isRunning(): boolean {
    return this.running;
  }
}

// =============================================================================
// REGION RENDERER (for region-based display)
// =============================================================================

import { RegionManager } from "./regions.ts";
import { renderLayout, type RenderContext } from "./components.ts";

/**
 * RegionRenderer - renders regions to terminal
 *
 * Uses RegionManager for impulse-based display with priority layout.
 * Shows input at top, active regions, then completed regions.
 */
export class RegionRenderer {
  private regionManager: RegionManager;
  private mode: RenderMode;
  private stdout: NodeJS.WriteStream;
  private tickCount = 0;
  private running = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // Terminal dimensions
  private termWidth: number;
  private termHeight: number;

  // Viewport scrolling
  private scrollOffset = 0;

  // Event handler reference for cleanup
  private renderHandler = () => this.scheduleRender();

  constructor(
    regionManager: RegionManager,
    options: { mode?: RenderMode; stdout?: NodeJS.WriteStream } = {}
  ) {
    this.regionManager = regionManager;
    this.mode = options.mode ?? (process.stdout.isTTY ? "ansi" : "text");
    this.stdout = options.stdout ?? process.stdout;

    // Initialize terminal dimensions
    this.termWidth = this.stdout.columns || 80;
    this.termHeight = this.stdout.rows || 24;

    // Listen for terminal resize events
    if (this.stdout.isTTY) {
      this.stdout.on("resize", () => {
        this.termWidth = this.stdout.columns || 80;
        this.termHeight = this.stdout.rows || 24;
        if (this.running) {
          this.render();
        }
      });
    }
  }

  /**
   * Start the render loop
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Initial render
    this.render();

    // Subscribe to region changes
    this.regionManager.on("region:added", this.renderHandler);
    this.regionManager.on("region:updated", this.renderHandler);
    this.regionManager.on("region:removed", this.renderHandler);
    this.regionManager.on("layout:changed", this.renderHandler);

    // Start tick interval for animation
    if (this.mode === "ansi") {
      this.tickInterval = setInterval(() => {
        this.tickCount++;
        this.render();
      }, 100);
    }
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Remove event listeners
    this.regionManager.off("region:added", this.renderHandler);
    this.regionManager.off("region:updated", this.renderHandler);
    this.regionManager.off("region:removed", this.renderHandler);
    this.regionManager.off("layout:changed", this.renderHandler);

    // Final render
    this.render();
  }

  private renderScheduled = false;

  /**
   * Schedule a render (debounced)
   */
  private scheduleRender(): void {
    if (this.renderScheduled || !this.running) return;
    this.renderScheduled = true;
    queueMicrotask(() => {
      this.renderScheduled = false;
      if (this.running) this.render();
    });
  }

  /**
   * Force a render
   */
  render(): void {
    if (this.mode === "ansi") {
      this.renderAnsi();
    } else {
      this.renderText();
    }
  }

  /**
   * Render with ANSI codes (clears and redraws)
   *
   * Uses full terminal height with viewport scrolling.
   */
  private renderAnsi(): void {
    // Clear screen and move to top
    this.stdout.write("\x1b[2J"); // Clear entire screen
    this.stdout.write("\x1b[H");  // Move cursor to home

    // Get layout and render
    const layout = this.regionManager.getLayout();
    const ctx: RenderContext = {
      width: this.termWidth,
      tickCount: this.tickCount,
      useColor: true,
    };

    // Render header (2 lines: header + blank line)
    const headerLines = this.renderHeader();

    // Render regions
    const regionLines = renderLayout(layout, ctx);

    // Combine all content
    const allLines = [...headerLines, "", ...regionLines];

    // Calculate available height (reserve 1 line for potential status bar)
    const availableHeight = this.termHeight - 1;

    // Apply viewport scrolling if content exceeds screen height
    let visibleLines: string[];
    if (allLines.length > availableHeight) {
      // Auto-scroll to bottom to show latest content
      const startLine = Math.max(0, allLines.length - availableHeight);
      visibleLines = allLines.slice(startLine, startLine + availableHeight);
      this.scrollOffset = startLine;
    } else {
      visibleLines = allLines;
      this.scrollOffset = 0;
    }

    // Pad with empty lines to fill terminal height (prevents flicker)
    while (visibleLines.length < availableHeight) {
      visibleLines.push("");
    }

    // Write all lines at once
    this.stdout.write(visibleLines.join("\n"));

    // Add scroll indicator if needed
    if (this.scrollOffset > 0) {
      const c = ANSI_COLORS;
      const scrollInfo = ` ${c.dim}↑ ${this.scrollOffset} lines above${c.reset}`;
      this.stdout.write(`\n${scrollInfo}`);
    }
  }

  /**
   * Render as plain text (append only)
   */
  private renderText(): void {
    const layout = this.regionManager.getLayout();
    const ctx: RenderContext = {
      width: this.termWidth,
      tickCount: this.tickCount,
      useColor: false,
    };

    const headerLines = this.renderHeaderPlain();
    const regionLines = renderLayout(layout, ctx);
    const allLines = [...headerLines, "", ...regionLines];
    this.stdout.write(allLines.join("\n") + "\n\n");
  }

  /**
   * Render header for plain text mode
   */
  private renderHeaderPlain(): string[] {
    const hasActive = this.regionManager.hasActiveRegions();
    const spinner = hasActive ? "●" : "○";
    return [`${spinner} microplastic`];
  }

  /**
   * Render the header line
   */
  private renderHeader(): string[] {
    const c = ANSI_COLORS;
    const hasActive = this.regionManager.hasActiveRegions();
    const spinner = hasActive ? SPINNER_FRAMES[this.tickCount % SPINNER_FRAMES.length] : "○";
    const spinnerColored = hasActive ? `${c.cyan}${spinner}${c.reset}` : `${c.gray}${spinner}${c.reset}`;

    return [`${spinnerColored} ${c.cyan}${c.bold}microplastic${c.reset}`];
  }


  /**
   * Get the region manager
   */
  getRegionManager(): RegionManager {
    return this.regionManager;
  }

  /**
   * Get current render mode
   */
  getMode(): RenderMode {
    return this.mode;
  }

  /**
   * Check if renderer is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { PHASE_STYLES };
