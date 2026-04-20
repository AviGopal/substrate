/**
 * Alignment Delta Tests
 *
 * Tracks changes in alignment metrics over time.
 * Validates that scores change in the expected direction.
 *
 * Usage:
 *   bun run tests/alignment-delta.ts snapshot     # Capture baseline
 *   bun run tests/alignment-delta.ts compare      # Compare to baseline
 *   bun run tests/alignment-delta.ts watch        # Continuous monitoring
 *
 * Environment:
 *   SNAPSHOT_FILE - Path to snapshot file (default: /tmp/alignment-snapshot.json)
 *   ACTIVITY_API_URL - Activity API endpoint (default: https://activity.metabob.com)
 *   METABOB_API_KEY - API key for authentication
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';

// =============================================================================
// TYPES
// =============================================================================

interface MetricSnapshot {
  timestamp: string;
  metrics: {
    // Validation alignment
    traces_with_validation_results: number;
    traces_total: number;
    validation_results_ratio: number;

    // Confidence alignment
    traces_with_confidence: number;
    avg_confidence: number | null;

    // Thompson weighting alignment
    activities_with_executions: number;
    avg_alpha_per_success: number | null;  // Should decrease from ~1.0 to <1.0
    weighted_activities_count: number;      // Should increase

    // Shape match alignment
    traces_with_shape_match: number;
    avg_shape_match_score: number | null;
    shape_match_ratio: number;

    // Resolver tier tracking
    executions_with_tier: number;
    distinct_tiers: number;
    tier_distribution: Record<string, number>;

    // Selection logging
    selections_logged: number;
    selections_with_complete_data: number;

    // Org isolation (inferred from API responses)
    api_accessible: boolean;
  };
}

interface DeltaResult {
  metric: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'same' | 'unknown';
  expected: 'up' | 'down' | 'same' | 'any';
  status: 'GOOD' | 'BAD' | 'NEUTRAL' | 'NO_DATA';
  message: string;
}

// =============================================================================
// CONFIG
// =============================================================================

const config = {
  snapshotFile: process.env.SNAPSHOT_FILE || '/tmp/alignment-snapshot.json',
  activityApi: process.env.ACTIVITY_API_URL || 'https://activity.metabob.com',
  apiKey: process.env.METABOB_API_KEY || '',
};

// =============================================================================
// API HELPERS
// =============================================================================

async function apiRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${config.activityApi}${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(config.apiKey ? { 'Authorization': `ApiKey ${config.apiKey}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`API error for ${path}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// =============================================================================
// METRIC COLLECTION
// =============================================================================

async function collectMetrics(): Promise<MetricSnapshot['metrics']> {
  // Check API health first
  const health = await apiRequest('/health') as any;
  const apiAccessible = health?.status === 'ok' || health?.status === 'healthy';

  if (!apiAccessible) {
    console.log('API not accessible, returning empty metrics');
    return {
      traces_with_validation_results: 0,
      traces_total: 0,
      validation_results_ratio: 0,
      traces_with_confidence: 0,
      avg_confidence: null,
      activities_with_executions: 0,
      avg_alpha_per_success: null,
      weighted_activities_count: 0,
      traces_with_shape_match: 0,
      avg_shape_match_score: null,
      shape_match_ratio: 0,
      executions_with_tier: 0,
      distinct_tiers: 0,
      tier_distribution: {},
      selections_logged: 0,
      selections_with_complete_data: 0,
      api_accessible: false,
    };
  }

  // Get execution traces with metrics
  const tracesResponse = await apiRequest('/v2/activities/execution-traces?limit=1000') as any;
  const traces = tracesResponse?.traces || tracesResponse?.data || [];

  // Analyze traces for validation metrics
  let tracesWithValidation = 0;
  let tracesWithConfidence = 0;
  let tracesWithShapeMatch = 0;
  let confidenceSum = 0;
  let shapeMatchSum = 0;
  let confidenceCount = 0;
  let shapeMatchCount = 0;

  const tierCounts: Record<string, number> = {};

  for (const trace of traces) {
    // Check for validation results in tasks
    const tasks = trace.execution_trace?.tasks || trace.tasks || [];
    const hasValidation = tasks.some((t: any) => t.validationResults != null);
    if (hasValidation) tracesWithValidation++;

    // Check for validation confidence
    const confidence = trace.metadata?.validation_confidence;
    if (confidence != null) {
      tracesWithConfidence++;
      confidenceSum += confidence;
      confidenceCount++;
    }

    // Check for shape match
    const shapeMatch = trace.metadata?.shape_match?.shapeMatchScore;
    if (shapeMatch != null) {
      tracesWithShapeMatch++;
      shapeMatchSum += shapeMatch;
      shapeMatchCount++;
    }

    // Check resolver tier
    const tier = trace.resolver_tier || trace.metadata?.resolver_tier;
    if (tier) {
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
  }

  // Get activity templates with Thompson Sampling scores
  const templatesResponse = await apiRequest('/v2/activities/templates?limit=500') as any;
  const templates = templatesResponse?.templates || templatesResponse?.data || [];

  let activitiesWithExecutions = 0;
  let weightedActivities = 0;
  let alphaRatioSum = 0;
  let alphaRatioCount = 0;

  for (const template of templates) {
    const alpha = template.thompson_alpha || template.alpha;
    const beta = template.thompson_beta || template.beta;
    const successes = template.successful_executions || template.successes || 0;
    const total = template.total_executions || template.executions || 0;

    if (total > 0) {
      activitiesWithExecutions++;

      if (successes > 0 && alpha != null) {
        const ratio = (alpha - 1.0) / successes;
        alphaRatioSum += ratio;
        alphaRatioCount++;

        // Weighted if ratio is noticeably less than 1.0
        if (ratio < 0.99) {
          weightedActivities++;
        }
      }
    }
  }

  // Get selection log stats if available
  const selectionsResponse = await apiRequest('/v2/activities/selections?limit=1000') as any;
  const selections = selectionsResponse?.selections || selectionsResponse?.data || [];
  const completeSelections = selections.filter((s: any) =>
    s.thompson_sample != null && s.alpha != null && s.beta != null
  );

  return {
    traces_with_validation_results: tracesWithValidation,
    traces_total: traces.length,
    validation_results_ratio: traces.length > 0 ? tracesWithValidation / traces.length : 0,

    traces_with_confidence: tracesWithConfidence,
    avg_confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,

    activities_with_executions: activitiesWithExecutions,
    avg_alpha_per_success: alphaRatioCount > 0 ? alphaRatioSum / alphaRatioCount : null,
    weighted_activities_count: weightedActivities,

    traces_with_shape_match: tracesWithShapeMatch,
    avg_shape_match_score: shapeMatchCount > 0 ? shapeMatchSum / shapeMatchCount : null,
    shape_match_ratio: traces.length > 0 ? tracesWithShapeMatch / traces.length : 0,

    executions_with_tier: Object.values(tierCounts).reduce((a, b) => a + b, 0),
    distinct_tiers: Object.keys(tierCounts).length,
    tier_distribution: tierCounts,

    selections_logged: selections.length,
    selections_with_complete_data: completeSelections.length,

    api_accessible: true,
  };
}

// =============================================================================
// SNAPSHOT MANAGEMENT
// =============================================================================

function saveSnapshot(snapshot: MetricSnapshot): void {
  writeFileSync(config.snapshotFile, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved to ${config.snapshotFile}`);
}

function loadSnapshot(): MetricSnapshot | null {
  if (!existsSync(config.snapshotFile)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(config.snapshotFile, 'utf-8'));
  } catch {
    return null;
  }
}

// =============================================================================
// DELTA ANALYSIS
// =============================================================================

// Expected direction for each metric after alignment
const EXPECTED_DIRECTIONS: Record<string, 'up' | 'down' | 'same' | 'any'> = {
  // Validation alignment: should increase
  traces_with_validation_results: 'up',
  validation_results_ratio: 'up',

  // Confidence alignment: should appear and increase
  traces_with_confidence: 'up',
  avg_confidence: 'any',  // Value can vary, just needs to exist

  // Thompson weighting: avg_alpha_per_success should DECREASE from ~1.0
  avg_alpha_per_success: 'down',  // Key indicator: weighted < unweighted
  weighted_activities_count: 'up',

  // Shape match: should increase
  traces_with_shape_match: 'up',
  avg_shape_match_score: 'any',  // Value varies based on actual execution quality
  shape_match_ratio: 'up',

  // Resolver tier: should increase diversity
  executions_with_tier: 'up',
  distinct_tiers: 'up',

  // Selection logging: should increase
  selections_logged: 'up',
  selections_with_complete_data: 'up',
};

function computeDelta(
  metric: string,
  baseline: number | null,
  current: number | null
): DeltaResult {
  const expected = EXPECTED_DIRECTIONS[metric] || 'any';

  // Handle null cases
  if (baseline === null && current === null) {
    return {
      metric,
      baseline,
      current,
      delta: null,
      direction: 'unknown',
      expected,
      status: 'NO_DATA',
      message: 'No data in baseline or current',
    };
  }

  if (baseline === null) {
    return {
      metric,
      baseline,
      current,
      delta: null,
      direction: current !== null && current > 0 ? 'up' : 'same',
      expected,
      status: current !== null && current > 0 ? 'GOOD' : 'NEUTRAL',
      message: `New metric appeared: ${current}`,
    };
  }

  if (current === null) {
    return {
      metric,
      baseline,
      current,
      delta: null,
      direction: 'down',
      expected,
      status: expected === 'down' ? 'GOOD' : 'BAD',
      message: `Metric disappeared (was ${baseline})`,
    };
  }

  // Compute delta
  const delta = current - baseline;
  const direction: 'up' | 'down' | 'same' =
    Math.abs(delta) < 0.001 ? 'same' : delta > 0 ? 'up' : 'down';

  // Determine status based on expected direction
  let status: 'GOOD' | 'BAD' | 'NEUTRAL';
  if (expected === 'any') {
    status = 'NEUTRAL';
  } else if (expected === 'same') {
    status = direction === 'same' ? 'GOOD' : 'BAD';
  } else {
    status = direction === expected ? 'GOOD' : direction === 'same' ? 'NEUTRAL' : 'BAD';
  }

  // Format message
  const pct = baseline !== 0 ? ((delta / baseline) * 100).toFixed(1) : 'N/A';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';

  return {
    metric,
    baseline,
    current,
    delta,
    direction,
    expected,
    status,
    message: `${baseline} ${arrow} ${current} (${delta >= 0 ? '+' : ''}${delta.toFixed(3)}, ${pct}%)`,
  };
}

function analyzeDeltas(baseline: MetricSnapshot, current: MetricSnapshot): DeltaResult[] {
  const results: DeltaResult[] = [];

  // Compare each metric
  const metrics = [
    'traces_with_validation_results',
    'validation_results_ratio',
    'traces_with_confidence',
    'avg_confidence',
    'avg_alpha_per_success',
    'weighted_activities_count',
    'traces_with_shape_match',
    'avg_shape_match_score',
    'shape_match_ratio',
    'executions_with_tier',
    'distinct_tiers',
    'selections_logged',
    'selections_with_complete_data',
  ];

  for (const metric of metrics) {
    const baselineValue = (baseline.metrics as any)[metric] ?? null;
    const currentValue = (current.metrics as any)[metric] ?? null;
    results.push(computeDelta(metric, baselineValue, currentValue));
  }

  return results;
}

// =============================================================================
// OUTPUT FORMATTING
// =============================================================================

function formatResults(results: DeltaResult[], baseline: MetricSnapshot, current: MetricSnapshot): void {
  console.log('='.repeat(100));
  console.log('ALIGNMENT DELTA ANALYSIS');
  console.log('='.repeat(100));
  console.log(`Baseline: ${baseline.timestamp}`);
  console.log(`Current:  ${current.timestamp}`);
  console.log(`Duration: ${formatDuration(new Date(baseline.timestamp), new Date(current.timestamp))}`);
  console.log('');

  // Group by category
  const categories: Record<string, DeltaResult[]> = {
    'Validation Results': results.filter(r => r.metric.includes('validation_results')),
    'Validation Confidence': results.filter(r => r.metric.includes('confidence')),
    'Thompson Weighting': results.filter(r => r.metric.includes('alpha') || r.metric.includes('weighted')),
    'Shape Match': results.filter(r => r.metric.includes('shape_match')),
    'Resolver Tier': results.filter(r => r.metric.includes('tier')),
    'Selection Logging': results.filter(r => r.metric.includes('selection')),
  };

  for (const [category, categoryResults] of Object.entries(categories)) {
    console.log(`--- ${category} ---`);
    for (const result of categoryResults) {
      const icon = result.status === 'GOOD' ? '✅' : result.status === 'BAD' ? '❌' : result.status === 'NO_DATA' ? '⚪' : '➖';
      const expectedStr = result.expected === 'any' ? '' : ` (expect ${result.expected})`;
      console.log(`${icon} ${result.metric.padEnd(35)} ${result.message}${expectedStr}`);
    }
    console.log('');
  }

  // Summary
  const good = results.filter(r => r.status === 'GOOD').length;
  const bad = results.filter(r => r.status === 'BAD').length;
  const neutral = results.filter(r => r.status === 'NEUTRAL').length;
  const noData = results.filter(r => r.status === 'NO_DATA').length;

  console.log('-'.repeat(100));
  console.log(`SUMMARY: ${good} GOOD, ${bad} BAD, ${neutral} NEUTRAL, ${noData} NO_DATA`);

  if (bad > 0) {
    console.log('');
    console.log('⚠️  BAD deltas indicate metrics moving in unexpected direction:');
    for (const result of results.filter(r => r.status === 'BAD')) {
      console.log(`   - ${result.metric}: expected ${result.expected}, got ${result.direction}`);
    }
  }

  console.log('-'.repeat(100));
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// =============================================================================
// COMMANDS
// =============================================================================

async function commandSnapshot(): Promise<void> {
  console.log('Collecting metrics from Activity API...');
  console.log(`Endpoint: ${config.activityApi}`);
  console.log('');

  const metrics = await collectMetrics();

  const snapshot: MetricSnapshot = {
    timestamp: new Date().toISOString(),
    metrics,
  };

  saveSnapshot(snapshot);

  console.log('');
  console.log('Captured metrics:');
  console.log(JSON.stringify(metrics, null, 2));
}

async function commandCompare(): Promise<void> {
  const baseline = loadSnapshot();

  if (!baseline) {
    console.error(`No baseline snapshot found at ${config.snapshotFile}`);
    console.error('Run with "snapshot" command first to create baseline.');
    process.exit(1);
  }

  console.log('Collecting current metrics...');
  const currentMetrics = await collectMetrics();

  const current: MetricSnapshot = {
    timestamp: new Date().toISOString(),
    metrics: currentMetrics,
  };

  const deltas = analyzeDeltas(baseline, current);
  formatResults(deltas, baseline, current);

  // Exit with error if any BAD deltas
  const bad = deltas.filter(r => r.status === 'BAD').length;
  process.exit(bad > 0 ? 1 : 0);
}

async function commandWatch(): Promise<void> {
  const interval = parseInt(process.env.WATCH_INTERVAL || '30', 10) * 1000;

  console.log(`Watching for changes every ${interval / 1000}s...`);
  console.log(`Endpoint: ${config.activityApi}`);
  console.log('Press Ctrl+C to stop.');
  console.log('');

  // Take initial snapshot if none exists
  let baseline = loadSnapshot();
  if (!baseline) {
    console.log('No baseline found, creating initial snapshot...');
    const metrics = await collectMetrics();
    baseline = { timestamp: new Date().toISOString(), metrics };
    saveSnapshot(baseline);
  }

  // Watch loop
  const checkAndReport = async () => {
    const currentMetrics = await collectMetrics();
    const current: MetricSnapshot = { timestamp: new Date().toISOString(), metrics: currentMetrics };

    const deltas = analyzeDeltas(baseline!, current);

    // Only report if there are changes
    const changes = deltas.filter(d => d.direction !== 'same' && d.status !== 'NO_DATA');
    if (changes.length > 0) {
      console.log(`\n[${current.timestamp}] Changes detected:`);
      for (const change of changes) {
        const icon = change.status === 'GOOD' ? '✅' : change.status === 'BAD' ? '❌' : '➖';
        console.log(`  ${icon} ${change.metric}: ${change.message}`);
      }
    } else {
      process.stdout.write('.');
    }
  };

  // Initial check
  await checkAndReport();

  // Periodic checks
  setInterval(checkAndReport, interval);
}

async function commandShow(): Promise<void> {
  console.log('Collecting metrics from Activity API...');
  console.log(`Endpoint: ${config.activityApi}`);
  console.log(`API Key:  ${config.apiKey ? '***' + config.apiKey.slice(-4) : '(not set)'}`);
  console.log('');

  const metrics = await collectMetrics();

  console.log('Current metrics:');
  console.log(JSON.stringify(metrics, null, 2));

  // Show interpretation
  console.log('');
  console.log('--- Interpretation ---');

  if (!metrics.api_accessible) {
    console.log('⚠️  API not accessible - cannot collect metrics');
    return;
  }

  if (metrics.traces_total === 0) {
    console.log('⚪ No execution traces found');
  } else {
    console.log(`📊 Found ${metrics.traces_total} execution traces`);

    // Validation results
    if (metrics.traces_with_validation_results > 0) {
      console.log(`✅ Validation results: ${metrics.traces_with_validation_results}/${metrics.traces_total} (${(metrics.validation_results_ratio * 100).toFixed(1)}%)`);
    } else {
      console.log('⏳ Validation results: Not populated yet (pending alignment)');
    }

    // Confidence
    if (metrics.traces_with_confidence > 0) {
      console.log(`✅ Validation confidence: ${metrics.traces_with_confidence} traces, avg ${metrics.avg_confidence?.toFixed(3)}`);
    } else {
      console.log('⏳ Validation confidence: Not populated yet (pending alignment)');
    }

    // Shape match
    if (metrics.traces_with_shape_match > 0) {
      console.log(`✅ Shape match: ${metrics.traces_with_shape_match}/${metrics.traces_total} (${(metrics.shape_match_ratio * 100).toFixed(1)}%), avg score ${metrics.avg_shape_match_score?.toFixed(3)}`);
    } else {
      console.log('⏳ Shape match: Not populated yet');
    }
  }

  // Thompson weighting
  if (metrics.activities_with_executions > 0) {
    const avgRatio = metrics.avg_alpha_per_success;
    if (avgRatio !== null) {
      if (avgRatio < 0.99) {
        console.log(`✅ Thompson weighting: Active (avg α/success = ${avgRatio.toFixed(3)}, ${metrics.weighted_activities_count} weighted activities)`);
      } else {
        console.log(`⏳ Thompson weighting: Not active yet (avg α/success ≈ ${avgRatio.toFixed(3)}, expect < 1.0 after alignment)`);
      }
    }
  }

  // Resolver tiers
  if (metrics.distinct_tiers > 0) {
    console.log(`✅ Resolver tiers: ${metrics.distinct_tiers} distinct (${JSON.stringify(metrics.tier_distribution)})`);
  } else {
    console.log('⏳ Resolver tiers: Not tracked yet');
  }

  // Selection logging
  if (metrics.selections_logged > 0) {
    console.log(`✅ Selection logging: ${metrics.selections_logged} logged, ${metrics.selections_with_complete_data} complete`);
  } else {
    console.log('⏳ Selection logging: No selections recorded');
  }
}

// =============================================================================
// MAIN
// =============================================================================

const command = process.argv[2] || 'show';

switch (command) {
  case 'snapshot':
    commandSnapshot();
    break;
  case 'compare':
    commandCompare();
    break;
  case 'watch':
    commandWatch();
    break;
  case 'show':
    commandShow();
    break;
  default:
    console.log('Usage: bun run tests/alignment-delta.ts <command>');
    console.log('');
    console.log('Commands:');
    console.log('  snapshot  - Capture current metrics as baseline');
    console.log('  compare   - Compare current metrics to baseline');
    console.log('  watch     - Continuously monitor for changes');
    console.log('  show      - Show current metrics without saving');
    console.log('');
    console.log('Environment:');
    console.log('  SNAPSHOT_FILE      - Path to snapshot file (default: /tmp/alignment-snapshot.json)');
    console.log('  WATCH_INTERVAL     - Seconds between checks in watch mode (default: 30)');
    console.log('  ACTIVITY_API_URL   - Activity API endpoint (default: https://activity.metabob.com)');
    console.log('  METABOB_API_KEY    - API key for authentication');
    process.exit(1);
}
