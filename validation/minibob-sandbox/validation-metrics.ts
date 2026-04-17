#!/usr/bin/env bun
/**
 * Validation Metrics Tracker
 *
 * Tracks and analyzes validation metrics:
 * - Resolver coverage and success rates
 * - Composition patterns and frequencies
 * - Thompson Sampling score evolution
 * - State navigation efficiency
 *
 * Usage:
 *   bun sandbox/validation-metrics.ts --traces report.json
 *   bun sandbox/validation-metrics.ts --analyze execution-id
 */

import { getLogger } from "../src/logger";
import fs from "fs";

const log = getLogger("ValidationMetrics");

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

export interface ResolverMetrics {
  name: string;
  invocations: number;
  successes: number;
  failures: number;
  successRate: number;
  averageDuration?: number;
  totalCost?: number;
}

export interface CompositionMetrics {
  activityChain: string[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  totalCost: number;
}

export interface ThompsonSamplingMetrics {
  templateId: string;
  alpha: number;
  beta: number;
  sampledValue: number;
  successRate: number;
  totalExecutions: number;
  evolution: Array<{
    timestamp: number;
    alpha: number;
    beta: number;
    successRate: number;
  }>;
}

export interface StateNavigationMetrics {
  goalId: string;
  initialDistance: number;
  finalDistance: number;
  reductionRate: number;
  steps: number;
  efficiency: number; // reduction per step
  pathTaken: Array<{
    step: number;
    activityId: string;
    distance: number;
    shapesAdded: string[];
  }>;
}

export interface ImpulseUsageMetrics {
  impulseId: string;
  shape: string;
  loadCount: number;
  averageTokens: number;
  totalCost: number;
  successRate: number;
}

export interface ValidationMetrics {
  timestamp: string;
  resolvers: ResolverMetrics[];
  compositions: CompositionMetrics[];
  thompsonSampling: ThompsonSamplingMetrics[];
  stateNavigation: StateNavigationMetrics[];
  impulseUsage: ImpulseUsageMetrics[];
  summary: {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    totalCost: number;
    uniqueResolvers: number;
    uniqueCompositions: number;
  };
}

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

export class MetricsCollector {
  private resolverStats: Map<string, {
    invocations: number;
    successes: number;
    failures: number;
    durations: number[];
    costs: number[];
  }> = new Map();

  private compositionStats: Map<string, {
    frequency: number;
    successes: number;
    durations: number[];
    costs: number[];
  }> = new Map();

  private thompsonStats: Map<string, {
    executions: Array<{
      timestamp: number;
      success: boolean;
      alpha: number;
      beta: number;
    }>;
  }> = new Map();

  private navigationStats: Array<StateNavigationMetrics> = [];

  private impulseStats: Map<string, {
    loadCount: number;
    tokens: number[];
    costs: number[];
    successes: number;
  }> = new Map();

  /**
   * Record resolver invocation
   */
  recordResolver(
    name: string,
    success: boolean,
    duration?: number,
    cost?: number,
  ): void {
    const stats = this.resolverStats.get(name) || {
      invocations: 0,
      successes: 0,
      failures: 0,
      durations: [],
      costs: [],
    };

    stats.invocations++;
    if (success) stats.successes++;
    else stats.failures++;
    if (duration !== undefined) stats.durations.push(duration);
    if (cost !== undefined) stats.costs.push(cost);

    this.resolverStats.set(name, stats);
  }

  /**
   * Record composition pattern
   */
  recordComposition(
    activityChain: string[],
    success: boolean,
    duration: number,
    cost: number,
  ): void {
    const key = activityChain.join(" → ");
    const stats = this.compositionStats.get(key) || {
      frequency: 0,
      successes: 0,
      durations: [],
      costs: [],
    };

    stats.frequency++;
    if (success) stats.successes++;
    stats.durations.push(duration);
    stats.costs.push(cost);

    this.compositionStats.set(key, stats);
  }

  /**
   * Record Thompson Sampling execution
   */
  recordThompsonSampling(
    templateId: string,
    success: boolean,
    alpha: number,
    beta: number,
  ): void {
    const stats = this.thompsonStats.get(templateId) || { executions: [] };

    stats.executions.push({
      timestamp: Date.now(),
      success,
      alpha,
      beta,
    });

    this.thompsonStats.set(templateId, stats);
  }

  /**
   * Record state navigation
   */
  recordNavigation(metrics: StateNavigationMetrics): void {
    this.navigationStats.push(metrics);
  }

  /**
   * Record impulse usage
   */
  recordImpulse(
    impulseId: string,
    shape: string,
    tokens: number,
    cost: number,
    success: boolean,
  ): void {
    const stats = this.impulseStats.get(impulseId) || {
      loadCount: 0,
      tokens: [],
      costs: [],
      successes: 0,
    };

    stats.loadCount++;
    stats.tokens.push(tokens);
    stats.costs.push(cost);
    if (success) stats.successes++;

    this.impulseStats.set(impulseId, stats);
  }

  /**
   * Generate validation metrics report
   */
  generateReport(): ValidationMetrics {
    const resolvers: ResolverMetrics[] = [];
    for (const [name, stats] of this.resolverStats.entries()) {
      resolvers.push({
        name,
        invocations: stats.invocations,
        successes: stats.successes,
        failures: stats.failures,
        successRate: stats.successes / stats.invocations,
        averageDuration: stats.durations.length > 0
          ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
          : undefined,
        totalCost: stats.costs.length > 0
          ? stats.costs.reduce((a, b) => a + b, 0)
          : undefined,
      });
    }

    const compositions: CompositionMetrics[] = [];
    for (const [chain, stats] of this.compositionStats.entries()) {
      compositions.push({
        activityChain: chain.split(" → "),
        frequency: stats.frequency,
        successRate: stats.successes / stats.frequency,
        averageDuration: stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length,
        totalCost: stats.costs.reduce((a, b) => a + b, 0),
      });
    }

    const thompsonSampling: ThompsonSamplingMetrics[] = [];
    for (const [templateId, stats] of this.thompsonStats.entries()) {
      const successes = stats.executions.filter(e => e.success).length;
      const lastExecution = stats.executions[stats.executions.length - 1];

      thompsonSampling.push({
        templateId,
        alpha: lastExecution.alpha,
        beta: lastExecution.beta,
        sampledValue: lastExecution.alpha / (lastExecution.alpha + lastExecution.beta),
        successRate: successes / stats.executions.length,
        totalExecutions: stats.executions.length,
        evolution: stats.executions.map(e => ({
          timestamp: e.timestamp,
          alpha: e.alpha,
          beta: e.beta,
          successRate: e.alpha / (e.alpha + e.beta),
        })),
      });
    }

    const impulseUsage: ImpulseUsageMetrics[] = [];
    for (const [impulseId, stats] of this.impulseStats.entries()) {
      impulseUsage.push({
        impulseId,
        shape: impulseId.split(":")[0] || "unknown",
        loadCount: stats.loadCount,
        averageTokens: stats.tokens.reduce((a, b) => a + b, 0) / stats.tokens.length,
        totalCost: stats.costs.reduce((a, b) => a + b, 0),
        successRate: stats.successes / stats.loadCount,
      });
    }

    const totalExecutions = Array.from(this.compositionStats.values())
      .reduce((sum, s) => sum + s.frequency, 0);
    const totalSuccesses = Array.from(this.compositionStats.values())
      .reduce((sum, s) => sum + s.successes, 0);
    const totalDuration = Array.from(this.compositionStats.values())
      .reduce((sum, s) => s.durations.reduce((a, b) => a + b, 0), 0);
    const totalCost = Array.from(this.compositionStats.values())
      .reduce((sum, s) => s.costs.reduce((a, b) => a + b, 0), 0);

    return {
      timestamp: new Date().toISOString(),
      resolvers,
      compositions,
      thompsonSampling,
      stateNavigation: this.navigationStats,
      impulseUsage,
      summary: {
        totalExecutions,
        successRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
        averageDuration: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
        totalCost,
        uniqueResolvers: this.resolverStats.size,
        uniqueCompositions: this.compositionStats.size,
      },
    };
  }
}

// =============================================================================
// METRICS ANALYZER
// =============================================================================

export class MetricsAnalyzer {
  /**
   * Analyze resolver coverage
   */
  analyzeResolverCoverage(metrics: ValidationMetrics): {
    coverage: number;
    missing: string[];
    underutilized: Array<{ name: string; invocations: number }>;
  } {
    const expectedResolvers = [
      "bash",
      "file",
      "git",
      "validation",
      "llm",
      "activity",
    ];

    const invokedResolvers = new Set(metrics.resolvers.map(r => r.name));
    const missing = expectedResolvers.filter(r => !invokedResolvers.has(r));

    const underutilized = metrics.resolvers
      .filter(r => r.invocations < 3)
      .map(r => ({ name: r.name, invocations: r.invocations }));

    return {
      coverage: invokedResolvers.size / expectedResolvers.length,
      missing,
      underutilized,
    };
  }

  /**
   * Analyze composition patterns
   */
  analyzeCompositions(metrics: ValidationMetrics): {
    mostFrequent: CompositionMetrics[];
    mostSuccessful: CompositionMetrics[];
    problematic: CompositionMetrics[];
  } {
    const sorted = [...metrics.compositions].sort((a, b) => b.frequency - a.frequency);
    const bySuccess = [...metrics.compositions].sort((a, b) => b.successRate - a.successRate);
    const problematic = metrics.compositions.filter(c => c.successRate < 0.5);

    return {
      mostFrequent: sorted.slice(0, 5),
      mostSuccessful: bySuccess.slice(0, 5),
      problematic,
    };
  }

  /**
   * Analyze Thompson Sampling progress
   */
  analyzeThompsonSampling(metrics: ValidationMetrics): {
    improving: ThompsonSamplingMetrics[];
    declining: ThompsonSamplingMetrics[];
    stable: ThompsonSamplingMetrics[];
  } {
    const improving: ThompsonSamplingMetrics[] = [];
    const declining: ThompsonSamplingMetrics[] = [];
    const stable: ThompsonSamplingMetrics[] = [];

    for (const ts of metrics.thompsonSampling) {
      if (ts.evolution.length < 2) {
        stable.push(ts);
        continue;
      }

      const recent = ts.evolution.slice(-5);
      const trend = recent[recent.length - 1].successRate - recent[0].successRate;

      if (trend > 0.1) improving.push(ts);
      else if (trend < -0.1) declining.push(ts);
      else stable.push(ts);
    }

    return { improving, declining, stable };
  }

  /**
   * Analyze state navigation efficiency
   */
  analyzeStateNavigation(metrics: ValidationMetrics): {
    averageEfficiency: number;
    mostEfficient: StateNavigationMetrics[];
    leastEfficient: StateNavigationMetrics[];
  } {
    if (metrics.stateNavigation.length === 0) {
      return {
        averageEfficiency: 0,
        mostEfficient: [],
        leastEfficient: [],
      };
    }

    const averageEfficiency = metrics.stateNavigation
      .reduce((sum, n) => sum + n.efficiency, 0) / metrics.stateNavigation.length;

    const sorted = [...metrics.stateNavigation].sort((a, b) => b.efficiency - a.efficiency);

    return {
      averageEfficiency,
      mostEfficient: sorted.slice(0, 3),
      leastEfficient: sorted.slice(-3),
    };
  }
}

// =============================================================================
// REPORTING
// =============================================================================

export class MetricsReporter {
  /**
   * Generate text report
   */
  generateTextReport(metrics: ValidationMetrics, analysis: {
    coverage: ReturnType<MetricsAnalyzer["analyzeResolverCoverage"]>;
    compositions: ReturnType<MetricsAnalyzer["analyzeCompositions"]>;
    thompson: ReturnType<MetricsAnalyzer["analyzeThompsonSampling"]>;
    navigation: ReturnType<MetricsAnalyzer["analyzeStateNavigation"]>;
  }): string {
    const lines: string[] = [];

    lines.push("=".repeat(80));
    lines.push("VALIDATION METRICS REPORT");
    lines.push("=".repeat(80));
    lines.push(`Timestamp: ${metrics.timestamp}`);
    lines.push("");

    // Summary
    lines.push("SUMMARY");
    lines.push("-".repeat(80));
    lines.push(`Total Executions: ${metrics.summary.totalExecutions}`);
    lines.push(`Success Rate: ${(metrics.summary.successRate * 100).toFixed(1)}%`);
    lines.push(`Average Duration: ${metrics.summary.averageDuration.toFixed(0)}ms`);
    lines.push(`Total Cost: $${metrics.summary.totalCost.toFixed(4)}`);
    lines.push(`Unique Resolvers: ${metrics.summary.uniqueResolvers}`);
    lines.push(`Unique Compositions: ${metrics.summary.uniqueCompositions}`);
    lines.push("");

    // Resolver Coverage
    lines.push("RESOLVER COVERAGE");
    lines.push("-".repeat(80));
    lines.push(`Coverage: ${(analysis.coverage.coverage * 100).toFixed(1)}%`);
    if (analysis.coverage.missing.length > 0) {
      lines.push(`Missing: ${analysis.coverage.missing.join(", ")}`);
    }
    if (analysis.coverage.underutilized.length > 0) {
      lines.push("Underutilized:");
      for (const r of analysis.coverage.underutilized) {
        lines.push(`  - ${r.name}: ${r.invocations} invocations`);
      }
    }
    lines.push("");

    // Resolver Performance
    lines.push("RESOLVER PERFORMANCE");
    lines.push("-".repeat(80));
    for (const r of metrics.resolvers.sort((a, b) => b.invocations - a.invocations)) {
      lines.push(`${r.name}:`);
      lines.push(`  Invocations: ${r.invocations}`);
      lines.push(`  Success Rate: ${(r.successRate * 100).toFixed(1)}%`);
      if (r.averageDuration !== undefined) {
        lines.push(`  Avg Duration: ${r.averageDuration.toFixed(0)}ms`);
      }
      if (r.totalCost !== undefined) {
        lines.push(`  Total Cost: $${r.totalCost.toFixed(4)}`);
      }
    }
    lines.push("");

    // Composition Patterns
    lines.push("COMPOSITION PATTERNS");
    lines.push("-".repeat(80));
    lines.push("Most Frequent:");
    for (const c of analysis.compositions.mostFrequent.slice(0, 3)) {
      lines.push(`  ${c.activityChain.join(" → ")}`);
      lines.push(`    Frequency: ${c.frequency} | Success: ${(c.successRate * 100).toFixed(1)}%`);
    }
    lines.push("");
    lines.push("Most Successful:");
    for (const c of analysis.compositions.mostSuccessful.slice(0, 3)) {
      lines.push(`  ${c.activityChain.join(" → ")}`);
      lines.push(`    Success: ${(c.successRate * 100).toFixed(1)}% | Frequency: ${c.frequency}`);
    }
    if (analysis.compositions.problematic.length > 0) {
      lines.push("");
      lines.push("Problematic (< 50% success):");
      for (const c of analysis.compositions.problematic) {
        lines.push(`  ${c.activityChain.join(" → ")}`);
        lines.push(`    Success: ${(c.successRate * 100).toFixed(1)}%`);
      }
    }
    lines.push("");

    // Thompson Sampling
    lines.push("THOMPSON SAMPLING");
    lines.push("-".repeat(80));
    if (analysis.thompson.improving.length > 0) {
      lines.push("Improving Templates:");
      for (const ts of analysis.thompson.improving) {
        lines.push(`  ${ts.templateId}`);
        lines.push(`    α=${ts.alpha.toFixed(1)}, β=${ts.beta.toFixed(1)}, rate=${(ts.successRate * 100).toFixed(1)}%`);
      }
    }
    if (analysis.thompson.declining.length > 0) {
      lines.push("Declining Templates:");
      for (const ts of analysis.thompson.declining) {
        lines.push(`  ${ts.templateId}`);
        lines.push(`    α=${ts.alpha.toFixed(1)}, β=${ts.beta.toFixed(1)}, rate=${(ts.successRate * 100).toFixed(1)}%`);
      }
    }
    lines.push("");

    // State Navigation
    if (metrics.stateNavigation.length > 0) {
      lines.push("STATE NAVIGATION");
      lines.push("-".repeat(80));
      lines.push(`Average Efficiency: ${analysis.navigation.averageEfficiency.toFixed(2)} reduction/step`);
      lines.push("Most Efficient:");
      for (const n of analysis.navigation.mostEfficient) {
        lines.push(`  ${n.goalId}: ${n.efficiency.toFixed(2)} reduction/step (${n.steps} steps)`);
      }
      lines.push("");
    }

    lines.push("=".repeat(80));

    return lines.join("\n");
  }

  /**
   * Save metrics to file
   */
  saveMetrics(metrics: ValidationMetrics, filepath: string): void {
    fs.writeFileSync(filepath, JSON.stringify(metrics, null, 2));
    log.info(`Metrics saved to: ${filepath}`);
  }

  /**
   * Save text report to file
   */
  saveTextReport(report: string, filepath: string): void {
    fs.writeFileSync(filepath, report);
    log.info(`Report saved to: ${filepath}`);
  }
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  let tracesFile: string | undefined;
  let outputFile: string | undefined;
  let textReport: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--traces":
        tracesFile = args[++i];
        break;
      case "--output":
        outputFile = args[++i];
        break;
      case "--report":
        textReport = args[++i];
        break;
      case "--help":
        console.log(`
Validation Metrics Tracker

Usage:
  bun sandbox/validation-metrics.ts [options]

Options:
  --traces <file>         Trace collection report file (JSON)
  --output <file>         Output metrics file (JSON)
  --report <file>         Output text report file
  --help                  Show this help

Examples:
  bun sandbox/validation-metrics.ts --traces report.json
  bun sandbox/validation-metrics.ts --traces report.json --output metrics.json --report report.txt
        `);
        process.exit(0);
    }
  }

  if (!tracesFile) {
    console.error("--traces file required");
    process.exit(1);
  }

  // Load traces
  const tracesData = JSON.parse(fs.readFileSync(tracesFile, "utf-8"));

  // Collect metrics
  const collector = new MetricsCollector();

  for (const result of tracesData.results || []) {
    if (result.context?.analysis) {
      const analysis = result.context.analysis;

      // Record resolvers
      for (const resolver of analysis.resolvers || []) {
        collector.recordResolver(
          resolver.name,
          resolver.successRate > 0.5,
          resolver.averageDuration,
        );
      }

      // Record state navigation
      if (analysis.stateNavigation) {
        collector.recordNavigation({
          goalId: result.goal,
          ...analysis.stateNavigation,
          pathTaken: [],
        });
      }
    }
  }

  const metrics = collector.generateReport();

  // Analyze metrics
  const analyzer = new MetricsAnalyzer();
  const coverage = analyzer.analyzeResolverCoverage(metrics);
  const compositions = analyzer.analyzeCompositions(metrics);
  const thompson = analyzer.analyzeThompsonSampling(metrics);
  const navigation = analyzer.analyzeStateNavigation(metrics);

  // Generate reports
  const reporter = new MetricsReporter();

  if (outputFile) {
    reporter.saveMetrics(metrics, outputFile);
  }

  const textReportContent = reporter.generateTextReport(metrics, {
    coverage,
    compositions,
    thompson,
    navigation,
  });

  if (textReport) {
    reporter.saveTextReport(textReportContent, textReport);
  } else {
    console.log(textReportContent);
  }
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
