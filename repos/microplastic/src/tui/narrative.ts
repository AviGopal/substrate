/**
 * Narrative Generator
 *
 * Generates contextual narrative text from execution events.
 * Can improvise narratives when no pattern matches, and patterns
 * can be extracted and improved over time (like ribosome for templates).
 */

import type { ToolCall } from "../internal-types.ts";

// =============================================================================
// NARRATIVE TYPES
// =============================================================================

/**
 * Narrative event types that can be narrated
 */
export type NarrativeEventType =
  | "goal_received"
  | "understanding"
  | "template_selected"
  | "improvising"
  | "task_starting"
  | "task_progress"
  | "tool_call"
  | "thinking"
  | "verification"
  | "success"
  | "failure"
  | "recovery_offered"
  | "learning";

/**
 * Narrative event - something that can be turned into narrative
 */
export interface NarrativeEvent {
  type: NarrativeEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Generated narrative content
 */
export interface GeneratedNarrative {
  /** Primary text to display */
  primary: string;
  /** Secondary/detail text */
  secondary?: string;
  /** Confidence indicator (if applicable) */
  confidence?: "high" | "medium" | "low";
  /** Whether this was improvised (no pattern matched) */
  improvised: boolean;
  /** Pattern ID that matched (if any) */
  patternId?: string;
}

/**
 * Narrative pattern - reusable template for generating narrative
 */
export interface NarrativePattern {
  id: string;
  eventType: NarrativeEventType;
  /** Conditions that must be true for this pattern to match */
  conditions?: {
    /** Data keys that must exist */
    hasKeys?: string[];
    /** Data values that must match */
    matches?: Record<string, unknown>;
  };
  /** Template strings with {variable} substitution */
  templates: {
    primary: string;
    secondary?: string;
  };
  /** Usage tracking */
  usageCount: number;
  successRate: number;
}

// =============================================================================
// DEFAULT PATTERNS
// =============================================================================

const DEFAULT_PATTERNS: NarrativePattern[] = [
  // Goal received
  {
    id: "goal_received_standard",
    eventType: "goal_received",
    templates: {
      primary: "Understanding your request...",
      secondary: '"{goal}"',
    },
    usageCount: 0,
    successRate: 1,
  },

  // Template selected - high confidence
  {
    id: "template_selected_high",
    eventType: "template_selected",
    conditions: { hasKeys: ["templateName", "successRate"] },
    templates: {
      primary: "I've done this before",
      secondary: "Using {templateName} ({successRate}% success rate)",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Template selected - low confidence
  {
    id: "template_selected_low",
    eventType: "template_selected",
    conditions: { hasKeys: ["templateName"], matches: { isNew: true } },
    templates: {
      primary: "Trying a new approach",
      secondary: "{templateName} - first time using this",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Improvising
  {
    id: "improvising_standard",
    eventType: "improvising",
    templates: {
      primary: "Figuring this out...",
      secondary: "No matching template found. I'll record what works.",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Task starting
  {
    id: "task_starting_standard",
    eventType: "task_starting",
    conditions: { hasKeys: ["taskIndex", "totalTasks", "taskName"] },
    templates: {
      primary: "Step {taskIndex} of {totalTasks}",
      secondary: "{taskName}",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Tool call - read file
  {
    id: "tool_read_file",
    eventType: "tool_call",
    conditions: { matches: { tool: "read" } },
    templates: {
      primary: "Reading {filePath}...",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Tool call - write/edit file
  {
    id: "tool_edit_file",
    eventType: "tool_call",
    conditions: { matches: { tool: "edit" } },
    templates: {
      primary: "Editing {filePath}...",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Tool call - bash
  {
    id: "tool_bash",
    eventType: "tool_call",
    conditions: { matches: { tool: "bash" } },
    templates: {
      primary: "Running command...",
      secondary: "{command}",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Thinking
  {
    id: "thinking_standard",
    eventType: "thinking",
    conditions: { hasKeys: ["thought"] },
    templates: {
      primary: "{thought}",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Success
  {
    id: "success_standard",
    eventType: "success",
    conditions: { hasKeys: ["summary"] },
    templates: {
      primary: "Done!",
      secondary: "{summary}",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Success with files
  {
    id: "success_with_files",
    eventType: "success",
    conditions: { hasKeys: ["filesModified"] },
    templates: {
      primary: "Complete",
      secondary: "{filesModified} files modified",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Failure
  {
    id: "failure_standard",
    eventType: "failure",
    conditions: { hasKeys: ["error"] },
    templates: {
      primary: "Something went wrong",
      secondary: "{error}",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Recovery
  {
    id: "recovery_offered",
    eventType: "recovery_offered",
    templates: {
      primary: "What would you like to do?",
      secondary: "I can retry, try a different approach, or investigate more",
    },
    usageCount: 0,
    successRate: 1,
  },

  // Learning
  {
    id: "learning_new_template",
    eventType: "learning",
    conditions: { hasKeys: ["templateName"] },
    templates: {
      primary: "Learned something new!",
      secondary: "Created template: {templateName}",
    },
    usageCount: 0,
    successRate: 1,
  },
];

// =============================================================================
// NARRATIVE GENERATOR
// =============================================================================

/**
 * NarrativeGenerator - generates contextual narrative from events
 */
export class NarrativeGenerator {
  private patterns: NarrativePattern[];
  private improvisedCount = 0;
  private patternMatchCount = 0;

  constructor(customPatterns?: NarrativePattern[]) {
    this.patterns = customPatterns ?? [...DEFAULT_PATTERNS];
  }

  // ===========================================================================
  // GENERATION
  // ===========================================================================

  /**
   * Generate narrative for an event
   */
  generate(event: NarrativeEvent): GeneratedNarrative {
    // Find matching pattern
    const pattern = this.findPattern(event);

    if (pattern) {
      return this.generateFromPattern(pattern, event);
    }

    // No pattern matched - improvise
    return this.improvise(event);
  }

  /**
   * Generate narrative from event data directly (convenience method)
   */
  narrate(
    type: NarrativeEventType,
    data: Record<string, unknown> = {}
  ): GeneratedNarrative {
    return this.generate({
      type,
      timestamp: Date.now(),
      data,
    });
  }

  // ===========================================================================
  // PATTERN MATCHING
  // ===========================================================================

  /**
   * Find a pattern that matches the event
   */
  private findPattern(event: NarrativeEvent): NarrativePattern | null {
    const candidates = this.patterns.filter((p) => p.eventType === event.type);

    for (const pattern of candidates) {
      if (this.matchesConditions(pattern, event)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Check if event matches pattern conditions
   */
  private matchesConditions(
    pattern: NarrativePattern,
    event: NarrativeEvent
  ): boolean {
    const { conditions } = pattern;
    if (!conditions) return true;

    // Check required keys
    if (conditions.hasKeys) {
      for (const key of conditions.hasKeys) {
        if (!(key in event.data)) return false;
      }
    }

    // Check value matches
    if (conditions.matches) {
      for (const [key, value] of Object.entries(conditions.matches)) {
        if (event.data[key] !== value) return false;
      }
    }

    return true;
  }

  // ===========================================================================
  // GENERATION
  // ===========================================================================

  /**
   * Generate narrative from a matched pattern
   */
  private generateFromPattern(
    pattern: NarrativePattern,
    event: NarrativeEvent
  ): GeneratedNarrative {
    this.patternMatchCount++;
    pattern.usageCount++;

    const primary = this.interpolate(pattern.templates.primary, event.data);
    const secondary = pattern.templates.secondary
      ? this.interpolate(pattern.templates.secondary, event.data)
      : undefined;

    // Infer confidence from event data or pattern
    let confidence: GeneratedNarrative["confidence"];
    if ("confidence" in event.data) {
      confidence = event.data.confidence as GeneratedNarrative["confidence"];
    } else if ("successRate" in event.data) {
      const rate = event.data.successRate as number;
      // Handle both percentage (0-100) and decimal (0-1) formats
      const normalizedRate = rate > 1 ? rate / 100 : rate;
      confidence = normalizedRate > 0.8 ? "high" : normalizedRate > 0.5 ? "medium" : "low";
    }

    return {
      primary,
      secondary,
      confidence,
      improvised: false,
      patternId: pattern.id,
    };
  }

  /**
   * Improvise a narrative when no pattern matches
   */
  private improvise(event: NarrativeEvent): GeneratedNarrative {
    this.improvisedCount++;

    // Generate a generic narrative based on event type
    const typeNarratives: Record<NarrativeEventType, string> = {
      goal_received: "Processing...",
      understanding: "Analyzing...",
      template_selected: "Selected approach",
      improvising: "Trying something new",
      task_starting: "Starting task",
      task_progress: "Working...",
      tool_call: "Executing...",
      thinking: "Thinking...",
      verification: "Checking results",
      success: "Complete",
      failure: "Something went wrong",
      recovery_offered: "Options available",
      learning: "Learning from this",
    };

    const primary = typeNarratives[event.type] ?? "Processing...";

    // Try to extract something useful from the data
    let secondary: string | undefined;
    if ("message" in event.data && typeof event.data.message === "string") {
      secondary = event.data.message;
    } else if ("error" in event.data && typeof event.data.error === "string") {
      secondary = event.data.error;
    } else if ("summary" in event.data && typeof event.data.summary === "string") {
      secondary = event.data.summary;
    }

    return {
      primary,
      secondary,
      improvised: true,
    };
  }

  /**
   * Interpolate template string with data values
   */
  private interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      const value = data[key];
      if (value === undefined) return `{${key}}`;
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    });
  }

  // ===========================================================================
  // PATTERN MANAGEMENT
  // ===========================================================================

  /**
   * Add a custom pattern
   */
  addPattern(pattern: NarrativePattern): void {
    // Insert at beginning so custom patterns take precedence
    this.patterns.unshift(pattern);
  }

  /**
   * Extract pattern from successful narrative
   * (Like ribosome for templates, but for narratives)
   */
  extractPattern(
    event: NarrativeEvent,
    narrative: GeneratedNarrative
  ): NarrativePattern | null {
    // Only extract from improvised narratives that worked
    if (!narrative.improvised) return null;

    // Build pattern from the event and generated narrative
    const pattern: NarrativePattern = {
      id: `extracted_${event.type}_${Date.now()}`,
      eventType: event.type,
      conditions: {
        hasKeys: Object.keys(event.data).filter((k) =>
          narrative.primary.includes(String(event.data[k])) ||
          (narrative.secondary?.includes(String(event.data[k])) ?? false)
        ),
      },
      templates: {
        primary: this.createTemplate(narrative.primary, event.data),
        secondary: narrative.secondary
          ? this.createTemplate(narrative.secondary, event.data)
          : undefined,
      },
      usageCount: 1,
      successRate: 1,
    };

    return pattern;
  }

  /**
   * Create template string from content and data
   */
  private createTemplate(
    content: string,
    data: Record<string, unknown>
  ): string {
    let template = content;

    // Replace data values with placeholders
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && template.includes(value)) {
        template = template.replace(value, `{${key}}`);
      }
    }

    return template;
  }

  /**
   * Record success/failure of a narrative (for learning)
   */
  recordOutcome(patternId: string, success: boolean): void {
    const pattern = this.patterns.find((p) => p.id === patternId);
    if (!pattern) return;

    // Update success rate with exponential moving average
    const alpha = 0.2;
    pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate;
  }

  /**
   * Get patterns sorted by usage
   */
  getPatterns(): NarrativePattern[] {
    return [...this.patterns].sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get statistics
   */
  getStats(): { patternMatches: number; improvisations: number; ratio: number } {
    const total = this.patternMatchCount + this.improvisedCount;
    return {
      patternMatches: this.patternMatchCount,
      improvisations: this.improvisedCount,
      ratio: total > 0 ? this.patternMatchCount / total : 1,
    };
  }
}

// =============================================================================
// NARRATIVE STREAM (for observing execution)
// =============================================================================

/**
 * NarrativeStream - observes execution and generates narrative events
 */
export class NarrativeStream {
  private generator: NarrativeGenerator;
  private listeners: Array<(narrative: GeneratedNarrative, event: NarrativeEvent) => void> = [];

  constructor(generator?: NarrativeGenerator) {
    this.generator = generator ?? new NarrativeGenerator();
  }

  /**
   * Subscribe to narrative updates
   */
  subscribe(
    listener: (narrative: GeneratedNarrative, event: NarrativeEvent) => void
  ): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  /**
   * Emit a narrative event
   */
  emit(type: NarrativeEventType, data: Record<string, unknown> = {}): GeneratedNarrative {
    const event: NarrativeEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    const narrative = this.generator.generate(event);

    for (const listener of this.listeners) {
      listener(narrative, event);
    }

    return narrative;
  }

  /**
   * Emit from a tool call
   */
  emitToolCall(call: ToolCall): GeneratedNarrative {
    const data: Record<string, unknown> = {
      tool: call.name,
      ...call.arguments,
    };

    // Extract useful fields for narrative
    if (call.arguments.file_path) {
      data.filePath = call.arguments.file_path;
    }
    if (call.arguments.command) {
      data.command = String(call.arguments.command).slice(0, 50);
    }

    return this.emit("tool_call", data);
  }

  /**
   * Get the underlying generator
   */
  getGenerator(): NarrativeGenerator {
    return this.generator;
  }
}
