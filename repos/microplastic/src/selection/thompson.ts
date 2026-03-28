/**
 * Thompson Sampling Implementation
 *
 * Local Thompson Sampling state for template selection.
 * Uses Beta distribution for exploration/exploitation tradeoff.
 */

import type { BetaParams, TemplateStats, ExecutionOutcome } from "./types.ts";

// =============================================================================
// BETA DISTRIBUTION
// =============================================================================

/**
 * Sample from Beta distribution using inverse transform
 *
 * Uses the Jöhnk algorithm for sampling.
 */
export function sampleBeta(alpha: number, beta: number): number {
  // Handle edge cases
  if (alpha <= 0 || beta <= 0) {
    throw new Error(`Invalid Beta parameters: alpha=${alpha}, beta=${beta}`);
  }

  // For very small alpha/beta, use approximation
  if (alpha < 1 && beta < 1) {
    return joehnkSample(alpha, beta);
  }

  // Use Gamma ratio for general case
  const gammaA = sampleGamma(alpha);
  const gammaB = sampleGamma(beta);
  return gammaA / (gammaA + gammaB);
}

/**
 * Jöhnk's algorithm for Beta sampling when both params < 1
 */
function joehnkSample(alpha: number, beta: number): number {
  while (true) {
    const u = Math.random();
    const v = Math.random();
    const x = Math.pow(u, 1 / alpha);
    const y = Math.pow(v, 1 / beta);
    const sum = x + y;

    if (sum <= 1) {
      if (sum > 0) {
        return x / sum;
      }
      // If sum is 0, retry
    }
  }
}

/**
 * Sample from Gamma distribution using Marsaglia and Tsang's method
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    // For shape < 1, use transformation
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;

    do {
      x = gaussianRandom();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Standard normal random using Box-Muller transform
 */
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// =============================================================================
// THOMPSON STATE
// =============================================================================

/**
 * Default prior parameters (weak prior toward 50% success)
 */
const DEFAULT_PRIOR: BetaParams = { alpha: 1, beta: 1 };

/**
 * ThompsonState - manages local Thompson Sampling state
 */
export class ThompsonState {
  private stats = new Map<string, TemplateStats>();
  private prior: BetaParams;

  constructor(prior: BetaParams = DEFAULT_PRIOR) {
    this.prior = prior;
  }

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Get stats for a template
   */
  getStats(templateId: string): TemplateStats | undefined {
    return this.stats.get(templateId);
  }

  /**
   * Get or create stats for a template
   */
  getOrCreateStats(templateId: string): TemplateStats {
    let stats = this.stats.get(templateId);
    if (!stats) {
      stats = {
        templateId,
        params: { ...this.prior },
        executionCount: 0,
        lastExecutedAt: null,
        avgDurationMs: null,
        avgCost: null,
      };
      this.stats.set(templateId, stats);
    }
    return stats;
  }

  /**
   * Get all template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.stats.keys());
  }

  /**
   * Clear all stats
   */
  clear(): void {
    this.stats.clear();
  }

  // ===========================================================================
  // SAMPLING
  // ===========================================================================

  /**
   * Sample a score for a template using Thompson Sampling
   */
  sample(templateId: string): number {
    const stats = this.getOrCreateStats(templateId);
    return sampleBeta(stats.params.alpha, stats.params.beta);
  }

  /**
   * Sample all templates and return ranked list
   */
  sampleAll(templateIds: string[]): Array<{ templateId: string; score: number }> {
    const samples = templateIds.map((templateId) => ({
      templateId,
      score: this.sample(templateId),
    }));

    // Sort by score descending
    samples.sort((a, b) => b.score - a.score);

    return samples;
  }

  /**
   * Get expected success rate for a template
   */
  getExpectedRate(templateId: string): number {
    const stats = this.getOrCreateStats(templateId);
    return stats.params.alpha / (stats.params.alpha + stats.params.beta);
  }

  // ===========================================================================
  // UPDATES
  // ===========================================================================

  /**
   * Update stats based on execution outcome
   */
  update(outcome: ExecutionOutcome): void {
    const stats = this.getOrCreateStats(outcome.templateId);

    // Update Beta parameters
    if (outcome.success) {
      stats.params.alpha += 1;
    } else {
      stats.params.beta += 1;
    }

    // Update execution count
    stats.executionCount += 1;
    stats.lastExecutedAt = Date.now();

    // Update running averages
    if (stats.avgDurationMs === null) {
      stats.avgDurationMs = outcome.durationMs;
    } else {
      // Exponential moving average
      stats.avgDurationMs = 0.9 * stats.avgDurationMs + 0.1 * outcome.durationMs;
    }

    if (stats.avgCost === null) {
      stats.avgCost = outcome.cost;
    } else {
      stats.avgCost = 0.9 * stats.avgCost + 0.1 * outcome.cost;
    }
  }

  /**
   * Bulk update from backend stats
   */
  updateFromBackend(backendStats: TemplateStats[]): void {
    for (const stat of backendStats) {
      // Merge with local stats if they exist
      const local = this.stats.get(stat.templateId);
      if (local) {
        // Take max of alpha/beta (optimistic merge)
        local.params.alpha = Math.max(local.params.alpha, stat.params.alpha);
        local.params.beta = Math.max(local.params.beta, stat.params.beta);
        local.executionCount = Math.max(local.executionCount, stat.executionCount);
      } else {
        this.stats.set(stat.templateId, { ...stat });
      }
    }
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export state for persistence
   */
  export(): TemplateStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Import state from persistence
   */
  import(data: TemplateStats[]): void {
    this.stats.clear();
    for (const stat of data) {
      this.stats.set(stat.templateId, stat);
    }
  }

  /**
   * Get stats summary
   */
  getSummary(): {
    totalTemplates: number;
    totalExecutions: number;
    avgSuccessRate: number;
  } {
    let totalExecutions = 0;
    let totalAlpha = 0;
    let totalBeta = 0;

    for (const stats of this.stats.values()) {
      totalExecutions += stats.executionCount;
      totalAlpha += stats.params.alpha;
      totalBeta += stats.params.beta;
    }

    return {
      totalTemplates: this.stats.size,
      totalExecutions,
      avgSuccessRate: totalAlpha / (totalAlpha + totalBeta) || 0.5,
    };
  }
}
