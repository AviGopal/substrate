/**
 * Region Components
 *
 * Render functions for different region shapes.
 * Each component renders a Region to terminal output lines.
 */

import type { Region, RegionShape, RegionState } from "./regions.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Render context for components
 */
export interface RenderContext {
  /** Terminal width */
  width: number;
  /** Current tick count for animation */
  tickCount: number;
  /** Whether in color mode */
  useColor: boolean;
}

/**
 * Rendered output from a component
 */
export interface RenderedRegion {
  /** Lines of output */
  lines: string[];
  /** Actual height in lines */
  height: number;
}

// =============================================================================
// ANSI HELPERS
// =============================================================================

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  inverse: "\x1b[7m",
  // Colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  // Background
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

function color(text: string, ...codes: string[]): string {
  return codes.join("") + text + ANSI.reset;
}

// Spinner frames
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// State icons
const STATE_ICONS: Record<RegionState, string> = {
  loading: "⏳",
  streaming: "▶",
  complete: "✓",
  collapsed: "▼",
};

// Status icons
const STATUS_ICONS = {
  running: "▶",
  completed: "✓",
  failed: "✗",
  pending: "○",
  skipped: "·",
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

// =============================================================================
// LAYOUT HELPERS
// =============================================================================

/**
 * Create a bordered box
 */
function createBox(
  lines: string[],
  width: number,
  options: { title?: string; borderColor?: string; useColor: boolean }
): string[] {
  const { title, borderColor = ANSI.gray, useColor } = options;
  const innerWidth = width - 4; // Account for "│ " and " │"
  const c = useColor ? borderColor : "";
  const r = useColor ? ANSI.reset : "";

  // Top border
  const topLeft = title ? `${c}┌─ ${r}${title}${c} ` : `${c}┌`;
  const topRight = `${c}┐${r}`;
  const dashCount = Math.max(0, width - stripAnsi(topLeft).length - 1);
  const top = topLeft + "─".repeat(dashCount) + topRight;

  // Content lines
  const contentLines = lines.map((line) => {
    const stripped = stripAnsi(line);
    const padding = Math.max(0, innerWidth - stripped.length);
    return `${c}│${r} ${line}${" ".repeat(padding)} ${c}│${r}`;
  });

  // Bottom border
  const bottom = `${c}└${"─".repeat(width - 2)}┘${r}`;

  return [top, ...contentLines, bottom];
}

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  const stripped = stripAnsi(str);
  if (stripped.length <= maxLen) return str;
  // Simple truncation (doesn't preserve ANSI codes perfectly)
  return stripped.slice(0, maxLen - 1) + "…";
}

/**
 * Create a progress bar
 */
function progressBar(current: number, total: number, width: number, useColor: boolean): string {
  const percent = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.min(Math.round(percent * width), width);
  const empty = Math.max(0, width - filled);

  if (useColor) {
    return `${ANSI.cyan}${"█".repeat(filled)}${ANSI.dim}${"░".repeat(empty)}${ANSI.reset}`;
  }
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

/**
 * Get spinner frame for current tick
 */
function getSpinner(tickCount: number): string {
  return SPINNER[tickCount % SPINNER.length]!;
}

// =============================================================================
// COMPONENT RENDERERS
// =============================================================================

/**
 * Render an input region
 */
function renderInput(region: Region, ctx: RenderContext): RenderedRegion {
  const { value = "", cursorPosition = 0, placeholder = "Enter a goal..." } = region.content;
  const { width, useColor } = ctx;

  const lines: string[] = [];

  // Prompt line with cursor
  const prompt = useColor ? `${ANSI.cyan}❯${ANSI.reset} ` : "> ";
  if (value) {
    const before = value.slice(0, cursorPosition);
    const cursor = value[cursorPosition] ?? " ";
    const after = value.slice(cursorPosition + 1);
    const cursorChar = useColor ? `${ANSI.inverse}${cursor}${ANSI.reset}` : `[${cursor}]`;
    lines.push(prompt + before + cursorChar + after);
  } else {
    lines.push(prompt + (useColor ? color(placeholder, ANSI.dim) : placeholder));
  }

  // Hint line
  const hint = "Enter: submit | Esc: cancel";
  lines.push(useColor ? color(hint, ANSI.dim) : hint);

  return {
    lines: createBox(lines, Math.min(width, 60), {
      title: "Goal",
      borderColor: ANSI.cyan,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render an activity region
 */
function renderActivity(region: Region, ctx: RenderContext): RenderedRegion {
  const {
    name = "Activity",
    status = "running",
    currentTask,
    lastCompletedTask,
    totalTasks = 0,
    completedTasks = 0,
  } = region.content;
  const { width, tickCount, useColor } = ctx;

  const lines: string[] = [];

  // Status line with spinner/icon
  const icon =
    status === "running"
      ? useColor
        ? color(getSpinner(tickCount), ANSI.cyan)
        : getSpinner(tickCount)
      : status === "completed"
        ? useColor
          ? color(STATUS_ICONS.completed, ANSI.green)
          : STATUS_ICONS.completed
        : useColor
          ? color(STATUS_ICONS.failed, ANSI.red)
          : STATUS_ICONS.failed;

  const statusText =
    status === "running" ? "Running" : status === "completed" ? "Complete" : "Failed";
  const statusColored = useColor
    ? color(statusText, status === "completed" ? ANSI.green : status === "failed" ? ANSI.red : ANSI.yellow)
    : statusText;

  lines.push(`${icon} ${name} — ${statusColored}`);

  // Progress bar (if we have task count)
  if (totalTasks > 0) {
    const bar = progressBar(completedTasks, totalTasks, 20, useColor);
    const count = `${completedTasks}/${totalTasks}`;
    lines.push(`  [${bar}] ${count}`);
  }

  // Current task
  if (currentTask && status === "running") {
    const taskText = truncate(currentTask, width - 10);
    lines.push(useColor ? `  ${color(taskText, ANSI.dim)}` : `  ${taskText}`);
  }

  // Last completed task
  if (lastCompletedTask && status === "running") {
    const taskText = truncate(`Last: ${lastCompletedTask}`, width - 10);
    lines.push(useColor ? `  ${color(taskText, ANSI.dim)}` : `  ${taskText}`);
  }

  return {
    lines: createBox(lines, Math.min(width, 70), {
      title: "Activity",
      borderColor: status === "completed" ? ANSI.green : status === "failed" ? ANSI.red : ANSI.yellow,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render a log stream region
 */
function renderLogStream(region: Region, ctx: RenderContext): RenderedRegion {
  const { lines: logLines = [], maxLines = 10 } = region.content;
  const { width, tickCount, useColor } = ctx;

  const displayLines = logLines.slice(-maxLines);
  const truncatedCount = logLines.length - displayLines.length;

  const lines: string[] = [];

  // Truncation indicator
  if (truncatedCount > 0) {
    const indicator = `... ${truncatedCount} lines above ...`;
    lines.push(useColor ? color(indicator, ANSI.dim) : indicator);
  }

  // Log lines
  for (const line of displayLines) {
    lines.push(truncate(line, width - 6));
  }

  // State indicator
  const stateIcon =
    region.state === "streaming"
      ? useColor
        ? color(getSpinner(tickCount), ANSI.cyan)
        : getSpinner(tickCount)
      : STATE_ICONS[region.state];

  return {
    lines: createBox(lines.length > 0 ? lines : ["(no output)"], Math.min(width, 80), {
      title: `${stateIcon} Output`,
      borderColor: ANSI.gray,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render a code region
 */
function renderCode(region: Region, ctx: RenderContext): RenderedRegion {
  const { code = "", language, filePath } = region.content;
  const { width, useColor } = ctx;

  const codeLines = code.split("\n").slice(0, 15); // Max 15 lines
  const truncated = code.split("\n").length > 15;

  const lines: string[] = [];

  // File path
  if (filePath) {
    lines.push(useColor ? color(filePath, ANSI.cyan) : filePath);
  }

  // Code lines with line numbers
  codeLines.forEach((line, i) => {
    const lineNum = String(i + 1).padStart(3, " ");
    const lineNumFormatted = useColor ? color(lineNum, ANSI.dim) : lineNum;
    lines.push(`${lineNumFormatted} ${truncate(line, width - 10)}`);
  });

  if (truncated) {
    lines.push(useColor ? color("... (truncated)", ANSI.dim) : "... (truncated)");
  }

  const langLabel = language ? language.toUpperCase() : "CODE";

  return {
    lines: createBox(lines, Math.min(width, 80), {
      title: langLabel,
      borderColor: ANSI.blue,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render a tool call region
 */
function renderToolCall(region: Region, ctx: RenderContext): RenderedRegion {
  const { tool = "unknown", duration, success } = region.content;
  const { tickCount, useColor } = ctx;

  const icon = TOOL_ICONS[tool] ?? TOOL_ICONS.default;

  let statusPart: string;
  if (region.state === "complete") {
    const successIcon = success ? STATUS_ICONS.completed : STATUS_ICONS.failed;
    const successColored = useColor
      ? color(successIcon, success ? ANSI.green : ANSI.red)
      : successIcon;
    const durationText = duration ? ` (${duration}ms)` : "";
    statusPart = `${successColored}${useColor ? color(durationText, ANSI.dim) : durationText}`;
  } else {
    statusPart = useColor ? color(getSpinner(tickCount), ANSI.cyan) : getSpinner(tickCount);
  }

  const line = `  ${statusPart} ${icon} ${tool}`;

  return {
    lines: [line],
    height: 1,
  };
}

/**
 * Render a summary region
 */
function renderSummary(region: Region, ctx: RenderContext): RenderedRegion {
  const {
    text = "Complete",
    detail,
    durationMs,
    cost,
    filesModified = [],
    filesCreated = [],
    tokensUsed,
  } = region.content;
  const { width, useColor } = ctx;

  const lines: string[] = [];

  // Main text
  const mainText = useColor ? color(text, ANSI.green, ANSI.bold) : text;
  lines.push(`${STATUS_ICONS.completed} ${mainText}`);

  // Detail
  if (detail) {
    lines.push(useColor ? color(detail, ANSI.dim) : detail);
  }

  // Stats line
  const stats: string[] = [];
  if (durationMs !== undefined) {
    stats.push(`${(durationMs / 1000).toFixed(1)}s`);
  }
  if (cost !== undefined) {
    stats.push(`$${cost.toFixed(4)}`);
  }
  if (tokensUsed) {
    stats.push(`${tokensUsed.input + tokensUsed.output} tokens`);
  }
  if (stats.length > 0) {
    const statsText = stats.join(" | ");
    lines.push(useColor ? color(statsText, ANSI.dim) : statsText);
  }

  // Files modified
  if (filesModified.length > 0) {
    lines.push("");
    lines.push(useColor ? color("Files modified:", ANSI.dim) : "Files modified:");
    for (const file of filesModified.slice(0, 5)) {
      lines.push(`  ${useColor ? color("~", ANSI.yellow) : "~"} ${truncate(file, width - 10)}`);
    }
    if (filesModified.length > 5) {
      lines.push(useColor ? color(`  ... and ${filesModified.length - 5} more`, ANSI.dim) : `  ... and ${filesModified.length - 5} more`);
    }
  }

  // Files created
  if (filesCreated.length > 0) {
    lines.push("");
    lines.push(useColor ? color("Files created:", ANSI.dim) : "Files created:");
    for (const file of filesCreated.slice(0, 5)) {
      lines.push(`  ${useColor ? color("+", ANSI.green) : "+"} ${truncate(file, width - 10)}`);
    }
    if (filesCreated.length > 5) {
      lines.push(useColor ? color(`  ... and ${filesCreated.length - 5} more`, ANSI.dim) : `  ... and ${filesCreated.length - 5} more`);
    }
  }

  return {
    lines: createBox(lines, Math.min(width, 70), {
      title: "Summary",
      borderColor: ANSI.green,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render an error region
 */
function renderError(region: Region, ctx: RenderContext): RenderedRegion {
  const { message = "Unknown error", errorType, stack } = region.content;
  const { width, useColor } = ctx;

  const lines: string[] = [];

  // Error type
  if (errorType) {
    lines.push(useColor ? color(`[${errorType}]`, ANSI.red, ANSI.bold) : `[${errorType}]`);
  }

  // Message
  lines.push(useColor ? color(message, ANSI.red) : message);

  // Stack (first 3 lines)
  if (stack) {
    const stackLines = stack.split("\n").slice(0, 3);
    lines.push("");
    for (const line of stackLines) {
      lines.push(useColor ? color(truncate(line, width - 8), ANSI.dim) : truncate(line, width - 8));
    }
  }

  return {
    lines: createBox(lines, Math.min(width, 70), {
      title: `${STATUS_ICONS.failed} Error`,
      borderColor: ANSI.red,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render an impulse output region
 */
function renderImpulse(region: Region, ctx: RenderContext): RenderedRegion {
  const {
    impulseId,
    impulseType = "unknown",
    tokens,
    priority,
    contentPreview,
    path,
  } = region.content;
  const { width, useColor } = ctx;

  const lines: string[] = [];

  // Type icons
  const typeIcons: Record<string, string> = {
    file: "📄",
    memo: "📝",
    trace: "📊",
    cpg: "🔗",
    embedding: "🧮",
    impact: "💥",
    error: "⚠️",
    default: "📤",
  };

  const icon = typeIcons[impulseType] ?? typeIcons.default;
  const priorityLabel = priority ? ` [${priority}]` : "";
  const tokenText = tokens ? ` (${tokens} tokens)` : "";

  // Main line with type and id
  const mainLine = `${icon} ${impulseType}${priorityLabel}${useColor ? color(tokenText, ANSI.dim) : tokenText}`;
  lines.push(mainLine);

  // Path if available
  if (path) {
    const pathText = truncate(path, width - 8);
    lines.push(`   ${useColor ? color(pathText, ANSI.cyan) : pathText}`);
  }

  // Content preview if available
  if (contentPreview) {
    const previewText = truncate(contentPreview, width - 8);
    lines.push(`   ${useColor ? color(previewText, ANSI.dim) : previewText}`);
  }

  // Impulse ID (dim)
  if (impulseId) {
    const idText = truncate(`id: ${impulseId}`, width - 8);
    lines.push(`   ${useColor ? color(idText, ANSI.dim) : idText}`);
  }

  return {
    lines,
    height: lines.length,
  };
}

/**
 * Render an execution trace region
 */
function renderTrace(region: Region, ctx: RenderContext): RenderedRegion {
  const {
    traceId,
    templateName,
    taskCount = 0,
    completedCount = 0,
    toolCalls = [],
    durationMs,
    cost,
    filesModified = [],
    filesCreated = [],
  } = region.content;
  const { width, tickCount, useColor } = ctx;

  const lines: string[] = [];

  // Header with template name
  const statusIcon = completedCount === taskCount && taskCount > 0
    ? (useColor ? color(STATUS_ICONS.completed, ANSI.green) : STATUS_ICONS.completed)
    : (useColor ? color(getSpinner(tickCount), ANSI.cyan) : getSpinner(tickCount));

  const header = `${statusIcon} ${templateName || "Execution Trace"}`;
  lines.push(useColor ? color(header, ANSI.bold) : header);

  // Progress
  if (taskCount > 0) {
    const bar = progressBar(completedCount, taskCount, 15, useColor);
    lines.push(`  Tasks: [${bar}] ${completedCount}/${taskCount}`);
  }

  // Tool calls summary
  if (toolCalls.length > 0) {
    const toolSummary = toolCalls.slice(0, 5).map((t: string) => TOOL_ICONS[t] ?? "🔧").join(" ");
    const moreTools = toolCalls.length > 5 ? ` +${toolCalls.length - 5}` : "";
    lines.push(`  Tools: ${toolSummary}${useColor ? color(moreTools, ANSI.dim) : moreTools}`);
  }

  // Stats
  const stats: string[] = [];
  if (durationMs !== undefined) {
    stats.push(`${(durationMs / 1000).toFixed(1)}s`);
  }
  if (cost !== undefined) {
    stats.push(`$${cost.toFixed(4)}`);
  }
  if (stats.length > 0) {
    lines.push(`  ${useColor ? color(stats.join(" | "), ANSI.dim) : stats.join(" | ")}`);
  }

  // Files summary
  const fileCount = filesModified.length + filesCreated.length;
  if (fileCount > 0) {
    const modCount = filesModified.length;
    const createCount = filesCreated.length;
    const fileParts: string[] = [];
    if (modCount > 0) fileParts.push(`${useColor ? color("~", ANSI.yellow) : "~"}${modCount} modified`);
    if (createCount > 0) fileParts.push(`${useColor ? color("+", ANSI.green) : "+"}${createCount} created`);
    lines.push(`  Files: ${fileParts.join(", ")}`);
  }

  // Trace ID (dim)
  if (traceId) {
    const idText = truncate(`trace: ${traceId}`, width - 8);
    lines.push(useColor ? color(`  ${idText}`, ANSI.dim) : `  ${idText}`);
  }

  return {
    lines: createBox(lines, Math.min(width, 70), {
      title: "Trace",
      borderColor: ANSI.magenta,
      useColor,
    }),
    height: lines.length + 2,
  };
}

/**
 * Render a generic block region
 */
function renderBlock(region: Region, ctx: RenderContext): RenderedRegion {
  const { text = "" } = region.content;
  const { width, useColor } = ctx;

  const lines = text.split("\n").map((line) => truncate(line, width - 6));

  return {
    lines: createBox(lines.length > 0 ? lines : ["(empty)"], Math.min(width, 70), {
      title: region.summary,
      borderColor: ANSI.gray,
      useColor,
    }),
    height: lines.length + 2,
  };
}

// =============================================================================
// COMPONENT DISPATCH
// =============================================================================

/**
 * Get the render function for a region shape
 */
const RENDERERS: Record<RegionShape, (region: Region, ctx: RenderContext) => RenderedRegion> = {
  input: renderInput,
  activity: renderActivity,
  log_stream: renderLogStream,
  code: renderCode,
  tool_call: renderToolCall,
  summary: renderSummary,
  error: renderError,
  impulse: renderImpulse,
  trace: renderTrace,
  block: renderBlock,
};

/**
 * Render a region using the appropriate component
 */
export function renderRegion(region: Region, ctx: RenderContext): RenderedRegion {
  const renderer = RENDERERS[region.shape] ?? renderBlock;
  return renderer(region, ctx);
}

/**
 * Render all regions in layout order
 */
export function renderLayout(regions: Region[], ctx: RenderContext): string[] {
  const allLines: string[] = [];

  for (const region of regions) {
    const rendered = renderRegion(region, ctx);
    allLines.push(...rendered.lines);
    allLines.push(""); // Spacing between regions
  }

  return allLines;
}
