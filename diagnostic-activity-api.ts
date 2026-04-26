#!/usr/bin/env bun

/**
 * Activity API Diagnostic Tool
 *
 * Standalone script for interacting with activity.metabob.com:
 * - Get Thompson Sampling recommendations for a goal
 * - Update weights via feedback API
 * - Query and adjust composition graph
 * - Step through activity execution graph without executing
 *
 * Reads credentials from ~/.metabob/config.json
 *
 * Usage:
 *   bun diagnostic-activity-api.ts recommend "fix the bug in auth"
 *   bun diagnostic-activity-api.ts feedback <activity_id> positive 2
 *   bun diagnostic-activity-api.ts composition <activity_id>
 *   bun diagnostic-activity-api.ts graph <activity_id>
 */

import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ============================================================================
// Configuration & Types
// ============================================================================

interface Config {
  metabob?: {
    apiKey?: string;
    endpoint?: string;
  };
}

interface ThompsonScore {
  template_id: string;
  template_name: string;
  category: string;
  tags: string[];
  tag_prefixes: string[];
  input_shapes: string[];
  output_shapes: string[];
  selection_metadata: {
    method: string;
    score_source: string;
    alpha: number;
    beta: number;
    original_beta: number;
    sample: number;
    score: number;
    tag_match_quality: number;
    heuristic_boost: number;
    boost_breakdown: {
      tag_match: number;
      shape_compatible: number;
      recency: number;
      execution_history: number;
      scope_preference: number;
      impulse_relevancy: number;
      category_match: number;
      output_shape_coverage: number;
    };
  };
  correlation_id: string;
}

interface CompositionEdge {
  parent_activity_id: string;
  child_activity_id: string;
  execution_count: number;
  success_count: number;
  weight: number;
  avg_duration_ms?: number;
  avg_cost_usd?: number;
  input_impulse_shapes?: string[];
  output_impulse_shapes?: string[];
  created_at: string;
  updated_at: string;
}

interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  execution_type: string;
  input_shapes?: string[];
  output_shapes?: string[];
  tasks?: any[];
}

// ============================================================================
// Config Loading
// ============================================================================

function loadConfig(): { apiKey: string; endpoint: string } {
  const configPath = join(homedir(), ".metabob", "config.json");

  try {
    const configContent = readFileSync(configPath, "utf-8");
    const config: Config = JSON.parse(configContent);

    const apiKey = config.metabob?.apiKey || process.env.METABOB_API_KEY;
    const endpoint = config.metabob?.endpoint || process.env.METABOB_ENDPOINT || "https://activity.metabob.com";

    if (!apiKey) {
      console.error("❌ No API key found in ~/.metabob/config.json or METABOB_API_KEY environment variable");
      process.exit(1);
    }

    return { apiKey, endpoint };
  } catch (err) {
    console.error(`❌ Failed to load config from ${configPath}:`, err);
    process.exit(1);
  }
}

// ============================================================================
// API Client
// ============================================================================

class ActivityAPIClient {
  constructor(
    private endpoint: string,
    private apiKey: string
  ) {}

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.endpoint}${path}`;
    const headers: Record<string, string> = {
      "Authorization": `ApiKey ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`❌ Request failed: ${method} ${url}`, err);
      throw err;
    }
  }

  // Get Thompson Sampling recommendations
  async getRecommendations(
    taskDescription: string,
    options: {
      category?: string;
      impulseShapes?: string[];
      expectedOutputShapes?: string[];
      limit?: number;
      excludeActivities?: string[];
    } = {}
  ): Promise<ThompsonScore[]> {
    const response = await this.request<{ recommendations: ThompsonScore[] }>(
      "POST",
      "/v2/activities/recommend",
      {
        task_description: taskDescription,
        category: options.category,
        impulse_shapes: options.impulseShapes,
        expected_output_shapes: options.expectedOutputShapes,
        limit: options.limit || 5,
        exclude_activities: options.excludeActivities || [],
      }
    );

    return response.recommendations;
  }

  // Submit feedback to adjust Thompson Sampling weights
  async submitFeedback(
    activityId: string,
    direction: "positive" | "negative",
    intensity: 0 | 1 | 2 | 3,
    options: {
      includeAdjacent?: boolean;
      reason?: string;
    } = {}
  ): Promise<any> {
    // Normalize activity ID - extract just the ID part without table prefix
    // Handles formats like:
    //   - "activity:⟨Name⟩" -> "⟨Name⟩"
    //   - "activity:simple-id" -> "simple-id"
    //   - "simple-id" -> "simple-id"
    let normalizedId = activityId;
    if (activityId.includes(':')) {
      const parts = activityId.split(':');
      normalizedId = parts.slice(1).join(':'); // Take everything after first colon
    }

    return await this.request("POST", "/v2/activities/feedback", {
      activity_id: normalizedId,
      direction,
      intensity,
      include_adjacent: options.includeAdjacent ?? false,
      reason: options.reason,
    });
  }

  // Query composition graph
  async getCompositionGraph(options: {
    activityId?: string;
    minWeight?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ edges: CompositionEdge[]; total: number }> {
    const params = new URLSearchParams();
    if (options.activityId) params.set("activity_id", options.activityId);
    if (options.minWeight !== undefined) params.set("min_weight", options.minWeight.toString());
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.offset) params.set("offset", options.offset.toString());

    return await this.request("GET", `/v2/activities/composition/graph?${params}`);
  }

  // Get successor activities (post-execution recommendations)
  async getSuccessors(activityId: string, limit: number = 5): Promise<any> {
    const params = new URLSearchParams({
      activity_id: activityId,
      limit: limit.toString(),
    });

    return await this.request("GET", `/v2/activities/composition/successors?${params}`);
  }

  // Get activity template details
  async getTemplate(activityId: string): Promise<ActivityTemplate> {
    return await this.request("GET", `/v2/activities/templates/${activityId}`);
  }

  // List all templates
  async listTemplates(options: {
    category?: string;
    executionType?: string;
    limit?: number;
  } = {}): Promise<{ templates: ActivityTemplate[] }> {
    const params = new URLSearchParams();
    if (options.category) params.set("category", options.category);
    if (options.executionType) params.set("execution_type", options.executionType);
    if (options.limit) params.set("limit", options.limit.toString());

    return await this.request("GET", `/v2/activities/templates?${params}`);
  }

  // Get activity metrics
  async getMetrics(activityId: string): Promise<any> {
    const params = new URLSearchParams({ activity_id: activityId });
    return await this.request("GET", `/v2/activities/metrics?${params}`);
  }
}

// ============================================================================
// Display Utilities
// ============================================================================

function displayRecommendations(recommendations: ThompsonScore[]) {
  console.log("\n📊 Thompson Sampling Recommendations:\n");
  console.log("═".repeat(100));

  recommendations.forEach((rec, idx) => {
    const meta = rec.selection_metadata;
    console.log(`\n${idx + 1}. ${rec.template_name} (${rec.template_id})`);
    console.log(`   Category: ${rec.category}`);
    console.log(`   Thompson Score: ${meta.score.toFixed(4)} (sample: ${meta.sample.toFixed(4)})`);
    console.log(`   Beta Parameters: α=${meta.alpha.toFixed(2)}, β=${meta.beta.toFixed(2)} (original β=${meta.original_beta.toFixed(2)})`);
    console.log(`   Score Source: ${meta.score_source}`);
    console.log(`   Heuristic Boost: +${meta.heuristic_boost}`);
    console.log(`   Tag Match Quality: ${(meta.tag_match_quality * 100).toFixed(1)}%`);

    if (rec.tags.length > 0) {
      console.log(`   Tags: ${rec.tags.join(", ")}`);
    }

    if (rec.input_shapes.length > 0) {
      console.log(`   Input Shapes: ${rec.input_shapes.join(", ")}`);
    }

    if (rec.output_shapes.length > 0) {
      console.log(`   Output Shapes: ${rec.output_shapes.join(", ")}`);
    }

    console.log(`\n   Boost Breakdown:`);
    const breakdown = meta.boost_breakdown;
    console.log(`     • Tag Match: +${breakdown.tag_match}`);
    console.log(`     • Shape Compatible: +${breakdown.shape_compatible}`);
    console.log(`     • Recency: +${breakdown.recency}`);
    console.log(`     • Execution History: +${breakdown.execution_history}`);
    console.log(`     • Scope Preference: +${breakdown.scope_preference}`);
    console.log(`     • Impulse Relevancy: +${breakdown.impulse_relevancy}`);
    console.log(`     • Category Match: +${breakdown.category_match}`);
    console.log(`     • Output Shape Coverage: +${breakdown.output_shape_coverage}`);

    console.log(`\n   Correlation ID: ${rec.correlation_id}`);
  });

  console.log("\n" + "═".repeat(100) + "\n");
}

function displayCompositionGraph(edges: CompositionEdge[], activityId?: string) {
  console.log("\n🔗 Activity Composition Graph:\n");
  console.log("═".repeat(100));

  if (edges.length === 0) {
    console.log("\n  No composition edges found.\n");
    return;
  }

  edges.forEach((edge, idx) => {
    const direction = activityId
      ? (edge.parent_activity_id === activityId ? "→" : "←")
      : "→";

    console.log(`\n${idx + 1}. ${edge.parent_activity_id} ${direction} ${edge.child_activity_id}`);
    console.log(`   Weight: ${edge.weight.toFixed(4)} (${edge.success_count}/${edge.execution_count} successful)`);
    if (edge.avg_duration_ms) console.log(`   Avg Duration: ${edge.avg_duration_ms.toFixed(0)}ms`);
    if (edge.avg_cost_usd) console.log(`   Avg Cost: $${edge.avg_cost_usd.toFixed(4)}`);
    if (edge.input_impulse_shapes?.length) {
      console.log(`   Input Shapes: ${edge.input_impulse_shapes.join(", ")}`);
    }
    if (edge.output_impulse_shapes?.length) {
      console.log(`   Output Shapes: ${edge.output_impulse_shapes.join(", ")}`);
    }
    console.log(`   Updated: ${new Date(edge.updated_at).toLocaleString()}`);
  });

  console.log("\n" + "═".repeat(100) + "\n");
}

function displayTemplate(template: ActivityTemplate) {
  console.log("\n📋 Activity Template Details:\n");
  console.log("═".repeat(100));
  console.log(`\nID: ${template.id}`);
  console.log(`Name: ${template.name}`);
  console.log(`Description: ${template.description}`);
  console.log(`Category: ${template.category}`);
  console.log(`Execution Type: ${template.execution_type}`);

  if (template.input_shapes?.length) {
    console.log(`\nInput Shapes:`);
    template.input_shapes.forEach(shape => console.log(`  - ${shape}`));
  }

  if (template.output_shapes?.length) {
    console.log(`\nOutput Shapes:`);
    template.output_shapes.forEach(shape => console.log(`  - ${shape}`));
  }

  if (template.tasks?.length) {
    console.log(`\nTasks (${template.tasks.length} total):`);
    template.tasks.forEach((task, idx) => {
      console.log(`\n  ${idx + 1}. ${task.id || `task-${idx}`}`);
      console.log(`     Description: ${task.description || "N/A"}`);
      if (task.validation) {
        console.log(`     Validation: ${JSON.stringify(task.validation, null, 2).replace(/\n/g, "\n     ")}`);
      }
    });
  }

  console.log("\n" + "═".repeat(100) + "\n");
}

function displayExecutionPath(
  activityId: string,
  predecessors: CompositionEdge[],
  successors: CompositionEdge[]
) {
  console.log("\n🔄 Activity Execution Path:\n");
  console.log("═".repeat(100));

  // Show predecessors (what leads to this activity)
  if (predecessors.length > 0) {
    console.log("\n⬆️  PREDECESSORS (activities that call this one):\n");
    predecessors
      .sort((a, b) => b.weight - a.weight)
      .forEach((edge, idx) => {
        console.log(`${idx + 1}. ${edge.parent_activity_id}`);
        console.log(`   → ${activityId} [weight: ${edge.weight.toFixed(4)}]`);
      });
  }

  // Show the current activity
  console.log(`\n🎯 CURRENT: ${activityId}`);

  // Show successors (what this activity calls)
  if (successors.length > 0) {
    console.log("\n⬇️  SUCCESSORS (activities called by this one):\n");
    successors
      .sort((a, b) => b.weight - a.weight)
      .forEach((edge, idx) => {
        console.log(`${idx + 1}. ${activityId}`);
        console.log(`   → ${edge.child_activity_id} [weight: ${edge.weight.toFixed(4)}]`);
      });
  }

  console.log("\n" + "═".repeat(100) + "\n");
}

// ============================================================================
// Commands
// ============================================================================

async function commandRecommend(client: ActivityAPIClient, args: string[]) {
  if (args.length === 0) {
    console.error("❌ Usage: recommend <task_description> [--category <cat>] [--shapes <shape1,shape2>] [--limit <n>]");
    process.exit(1);
  }

  const taskDescription = args[0];
  const options: any = {};

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (flag === "--category") options.category = value;
    else if (flag === "--shapes") options.impulseShapes = value.split(",");
    else if (flag === "--output-shapes") options.expectedOutputShapes = value.split(",");
    else if (flag === "--limit") options.limit = parseInt(value);
  }

  console.log(`\n🔍 Getting recommendations for: "${taskDescription}"\n`);
  const recommendations = await client.getRecommendations(taskDescription, options);
  displayRecommendations(recommendations);
}

async function commandFeedback(client: ActivityAPIClient, args: string[]) {
  if (args.length < 3) {
    console.error("❌ Usage: feedback <activity_id> <positive|negative> <intensity:0-3> [--adjacent] [--reason <text>]");
    console.error("\nIntensity levels:");
    console.error("  0 = 1.5x multiplier (mild)");
    console.error("  1 = 2.0x multiplier (moderate)");
    console.error("  2 = 2.5x multiplier (strong)");
    console.error("  3 = 3.0x multiplier (very strong)");
    console.error("\n⚠️  NOTE: Use the activity ID from 'recommend' command, not 'list' command");
    console.error("   The feedback endpoint requires the exact template_id format from recommendations.");
    process.exit(1);
  }

  const activityId = args[0];
  const direction = args[1] as "positive" | "negative";
  const intensity = parseInt(args[2]) as 0 | 1 | 2 | 3;

  if (!["positive", "negative"].includes(direction)) {
    console.error("❌ Direction must be 'positive' or 'negative'");
    process.exit(1);
  }

  if (![0, 1, 2, 3].includes(intensity)) {
    console.error("❌ Intensity must be 0, 1, 2, or 3");
    process.exit(1);
  }

  const options: any = {};
  for (let i = 3; i < args.length; i++) {
    if (args[i] === "--adjacent") options.includeAdjacent = true;
    else if (args[i] === "--reason" && i + 1 < args.length) {
      options.reason = args[i + 1];
      i++;
    }
  }

  console.log(`\n📝 Submitting ${direction} feedback for ${activityId} (intensity: ${intensity})...\n`);
  const result = await client.submitFeedback(activityId, direction, intensity, options);

  console.log("✅ Feedback submitted successfully!");
  console.log(`   Affected activities: ${result.affected_activities?.length || 0}`);
  console.log(`   Multiplier applied: ${result.multiplier}x`);
  console.log(`   Direction: ${result.direction}`);

  if (result.affected_activities?.length) {
    console.log(`\n   Activities updated:`);
    result.affected_activities.forEach((id: string) => console.log(`     - ${id}`));
  }

  console.log();
}

async function commandComposition(client: ActivityAPIClient, args: string[]) {
  if (args.length === 0) {
    console.error("❌ Usage: composition <activity_id> [--min-weight <0-1>] [--limit <n>]");
    process.exit(1);
  }

  const activityId = args[0];
  const options: any = { activityId };

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (flag === "--min-weight") options.minWeight = parseFloat(value);
    else if (flag === "--limit") options.limit = parseInt(value);
  }

  console.log(`\n🔍 Querying composition graph for: ${activityId}\n`);
  const result = await client.getCompositionGraph(options);
  displayCompositionGraph(result.edges, activityId);
  console.log(`Total edges found: ${result.total}\n`);
}

async function commandGraph(client: ActivityAPIClient, args: string[]) {
  if (args.length === 0) {
    console.error("❌ Usage: graph <activity_id>");
    process.exit(1);
  }

  const activityId = args[0];

  console.log(`\n🔍 Building execution graph for: ${activityId}\n`);

  // Get edges where this activity is a parent (successors)
  const successorsResult = await client.getCompositionGraph({ activityId });
  const successors = successorsResult.edges.filter(e => e.parent_activity_id === activityId);

  // Get edges where this activity is a child (predecessors)
  const predecessors = successorsResult.edges.filter(e => e.child_activity_id === activityId);

  displayExecutionPath(activityId, predecessors, successors);
}

async function commandTemplate(client: ActivityAPIClient, args: string[]) {
  if (args.length === 0) {
    console.error("❌ Usage: template <activity_id>");
    process.exit(1);
  }

  const activityId = args[0];

  console.log(`\n🔍 Fetching template: ${activityId}\n`);
  const template = await client.getTemplate(activityId);
  displayTemplate(template);
}

async function commandList(client: ActivityAPIClient, args: string[]) {
  const options: any = {};

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (flag === "--category") options.category = value;
    else if (flag === "--type") options.executionType = value;
    else if (flag === "--limit") options.limit = parseInt(value);
  }

  console.log(`\n🔍 Listing activity templates...\n`);
  const result = await client.listTemplates(options);

  console.log("═".repeat(100));
  result.templates.forEach((template, idx) => {
    console.log(`\n${idx + 1}. ${template.name} (${template.id})`);
    console.log(`   Category: ${template.category} | Type: ${template.execution_type}`);
    console.log(`   Description: ${template.description}`);
    if (template.input_shapes?.length) {
      console.log(`   Input Shapes: ${template.input_shapes.join(", ")}`);
    }
  });
  console.log("\n" + "═".repeat(100));
  console.log(`\nTotal templates: ${result.templates.length}\n`);
}

async function commandMetrics(client: ActivityAPIClient, args: string[]) {
  if (args.length === 0) {
    console.error("❌ Usage: metrics <activity_id>");
    process.exit(1);
  }

  const activityId = args[0];

  console.log(`\n🔍 Fetching metrics for: ${activityId}\n`);
  const metrics = await client.getMetrics(activityId);

  console.log("═".repeat(100));
  console.log(JSON.stringify(metrics, null, 2));
  console.log("═".repeat(100) + "\n");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Activity API Diagnostic Tool
═══════════════════════════════════════════════════════════════════════════

Commands:
  recommend <task>          Get Thompson Sampling recommendations
                            Options: --category, --shapes, --output-shapes, --limit

  feedback <id> <pos|neg> <0-3>  Submit feedback to adjust weights
                            Options: --adjacent, --reason

  composition <id>          Query composition graph for an activity
                            Options: --min-weight, --limit

  graph <id>                Show execution path (predecessors + successors)

  template <id>             Show activity template details

  list                      List all activity templates
                            Options: --category, --type, --limit

  metrics <id>              Show activity metrics

Examples:
  bun diagnostic-activity-api.ts recommend "fix the auth bug"
  bun diagnostic-activity-api.ts recommend "parse API response" --shapes activityExecutionTrace
  bun diagnostic-activity-api.ts feedback my-activity-123 positive 2
  bun diagnostic-activity-api.ts feedback my-activity-123 negative 1 --adjacent --reason "too slow"
  bun diagnostic-activity-api.ts composition my-activity-123 --min-weight 0.5
  bun diagnostic-activity-api.ts graph my-activity-123
  bun diagnostic-activity-api.ts template my-activity-123
  bun diagnostic-activity-api.ts list --category bugfix --limit 10
  bun diagnostic-activity-api.ts metrics my-activity-123

Configuration:
  Reads from ~/.metabob/config.json or environment variables:
    - METABOB_API_KEY
    - METABOB_ENDPOINT (default: https://activity.metabob.com)
`);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  const { apiKey, endpoint } = loadConfig();
  const client = new ActivityAPIClient(endpoint, apiKey);

  console.log(`\n🔗 Connected to: ${endpoint}\n`);

  try {
    switch (command) {
      case "recommend":
        await commandRecommend(client, commandArgs);
        break;
      case "feedback":
        await commandFeedback(client, commandArgs);
        break;
      case "composition":
        await commandComposition(client, commandArgs);
        break;
      case "graph":
        await commandGraph(client, commandArgs);
        break;
      case "template":
        await commandTemplate(client, commandArgs);
        break;
      case "list":
        await commandList(client, commandArgs);
        break;
      case "metrics":
        await commandMetrics(client, commandArgs);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error("Run without arguments to see usage.");
        process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ Command failed:", err);
    process.exit(1);
  }
}

main();
