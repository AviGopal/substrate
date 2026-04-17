#!/usr/bin/env bun
/**
 * Activity System Validation Runner
 *
 * Executes validation scenarios against the live backend and verifies
 * that behavior matches the documentation in docs/architecture/sequences/
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYAML } from 'yaml';

// Configuration
const BACKEND_URL = process.env.VALIDATION_ENDPOINT || 'https://activity.metabob.com';
const API_KEY = process.env.VALIDATION_API_KEY || process.env.METABOB_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: VALIDATION_API_KEY or METABOB_API_KEY required');
  process.exit(1);
}

// Types
interface ValidationScenario {
  name: string;
  doc_reference: string;
  assertion: string;
  setup: any;
  action: any;
  expected: any;
  validation: string[];
}

interface ScenarioResult {
  scenario: string;
  passed: boolean;
  errors: string[];
  actual: any;
  expected: any;
  timestamp: string;
}

interface ValidationReport {
  sequence: string;
  total_scenarios: number;
  passed: number;
  failed: number;
  results: ScenarioResult[];
  timestamp: string;
}

// Scenario Executors
async function filterImpulses(action: any, setup: any): Promise<any> {
  // Call backend to get impulse relevance metrics
  const response = await fetch(`${BACKEND_URL}/v2/impulses/relevance`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      activity_id: setup.activity_id,
      impulse_ids: action.impulse_ids
    })
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status} ${await response.text()}`);
  }

  const metrics = await response.json();

  // Apply filtering logic (matching MiniBob's impulse-filter.ts)
  const config = action.config || {};
  const threshold = config.relevance_threshold || 0.5;
  const alwaysLoadThreshold = config.always_load_threshold || 0.8;
  const maxImpulses = config.max_impulses || 5;

  const loaded: string[] = [];
  const skipped: string[] = [];
  const skipReasons: Record<string, string> = {};

  for (const impulseId of action.impulse_ids) {
    const impulse = setup.impulses.find((i: any) => i.id === impulseId);
    const metric = metrics.find((m: any) => m.impulse_id === impulseId);

    if (!impulse) {
      skipped.push(impulseId);
      skipReasons[impulseId] = 'Impulse not found in setup';
      continue;
    }

    const relevanceScore = metric?.relevance_score ?? impulse.relevance_score ?? 0;
    const irrelevanceScore = metric?.irrelevance_score ?? impulse.irrelevance_score ?? 0;

    // Rule 1: Always load if score >= always-load threshold
    if (relevanceScore >= alwaysLoadThreshold) {
      loaded.push(impulseId);
      continue;
    }

    // Rule 2: Skip if irrelevance > relevance
    if (irrelevanceScore > relevanceScore) {
      skipped.push(impulseId);
      skipReasons[impulseId] = `irrelevance_score (${irrelevanceScore.toFixed(2)}) > relevance_score (${relevanceScore.toFixed(2)})`;
      continue;
    }

    // Rule 3: Load if score >= threshold
    if (relevanceScore >= threshold) {
      loaded.push(impulseId);
    } else {
      skipped.push(impulseId);
      skipReasons[impulseId] = `relevance_score (${relevanceScore.toFixed(2)}) < threshold (${threshold})`;
    }
  }

  // Rule 4: Enforce max impulses (keep highest scoring)
  if (loaded.length > maxImpulses) {
    const scores = loaded.map(id => {
      const impulse = setup.impulses.find((i: any) => i.id === id);
      return { id, score: impulse.relevance_score || 0 };
    });
    scores.sort((a, b) => b.score - a.score);

    const excess = loaded.slice(maxImpulses);
    loaded.splice(maxImpulses);

    excess.forEach(id => {
      skipped.push(id);
      skipReasons[id] = `Exceeded max_impulses (${maxImpulses})`;
    });
  }

  return { loaded, skipped, skip_reasons: skipReasons };
}

async function executeScenario(scenario: ValidationScenario, setup: any): Promise<ScenarioResult> {
  console.log(`  Testing: ${scenario.name}`);

  const errors: string[] = [];
  let actual: any = {};

  try {
    // Execute action based on type
    switch (scenario.action.type) {
      case 'filter_impulses':
        actual = await filterImpulses(scenario.action, setup);
        break;

      case 'resolve_impulses':
        // TODO: Implement impulse resolution testing
        errors.push('resolve_impulses not yet implemented');
        break;

      case 'load_impulse':
        // TODO: Implement budget enforcement testing
        errors.push('load_impulse not yet implemented');
        break;

      case 'format_for_context':
        // TODO: Implement formatting testing
        errors.push('format_for_context not yet implemented');
        break;

      default:
        errors.push(`Unknown action type: ${scenario.action.type}`);
    }

    // Validate results against expected
    if (scenario.expected.loaded) {
      const expectedLoaded = new Set(scenario.expected.loaded);
      const actualLoaded = new Set(actual.loaded || []);

      // Check for missing
      for (const id of expectedLoaded) {
        if (!actualLoaded.has(id)) {
          errors.push(`Expected impulse '${id}' to be loaded but it was not`);
        }
      }

      // Check for unexpected
      for (const id of actualLoaded) {
        if (!expectedLoaded.has(id)) {
          errors.push(`Impulse '${id}' was loaded but not expected`);
        }
      }
    }

    if (scenario.expected.skipped) {
      const expectedSkipped = new Set(scenario.expected.skipped);
      const actualSkipped = new Set(actual.skipped || []);

      for (const id of expectedSkipped) {
        if (!actualSkipped.has(id)) {
          errors.push(`Expected impulse '${id}' to be skipped but it was not`);
        }
      }
    }

    // Validate skip reasons
    if (scenario.expected.skip_reasons) {
      for (const [id, expectedReason] of Object.entries(scenario.expected.skip_reasons)) {
        const actualReason = actual.skip_reasons?.[id];
        if (!actualReason) {
          errors.push(`Missing skip reason for '${id}'`);
        } else if (!actualReason.includes(expectedReason as string)) {
          errors.push(`Skip reason mismatch for '${id}': expected '${expectedReason}', got '${actualReason}'`);
        }
      }
    }

  } catch (error) {
    errors.push(`Execution error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    scenario: scenario.name,
    passed: errors.length === 0,
    errors,
    actual,
    expected: scenario.expected,
    timestamp: new Date().toISOString()
  };
}

async function runValidationFile(scenarioFile: string): Promise<ValidationReport> {
  console.log(`\n📋 Running validation: ${scenarioFile}`);

  const filePath = join(__dirname, 'scenarios', scenarioFile);
  const content = readFileSync(filePath, 'utf-8');
  const data = parseYAML(content);

  const results: ScenarioResult[] = [];

  for (const scenario of data.scenarios) {
    const result = await executeScenario(scenario, scenario.setup);
    results.push(result);

    if (result.passed) {
      console.log(`    ✓ ${scenario.name}`);
    } else {
      console.log(`    ✗ ${scenario.name}`);
      result.errors.forEach(err => console.log(`      - ${err}`));
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  return {
    sequence: scenarioFile.replace('.yaml', ''),
    total_scenarios: results.length,
    passed,
    failed,
    results,
    timestamp: new Date().toISOString()
  };
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const sequenceFilter = args.find(a => a.startsWith('--sequence='))?.split('=')[1];

  console.log('🧪 Activity System Validation');
  console.log(`📡 Backend: ${BACKEND_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);

  // Get scenario files
  const scenariosDir = join(__dirname, 'scenarios');
  let scenarioFiles = readdirSync(scenariosDir)
    .filter(f => f.endsWith('.yaml'));

  if (sequenceFilter) {
    scenarioFiles = scenarioFiles.filter(f => f.includes(sequenceFilter));
  }

  if (scenarioFiles.length === 0) {
    console.error('❌ No scenario files found');
    process.exit(1);
  }

  // Run all scenarios
  const reports: ValidationReport[] = [];

  for (const file of scenarioFiles) {
    const report = await runValidationFile(file);
    reports.push(report);
  }

  // Save results
  const resultsDir = join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const resultFile = join(resultsDir, `validation-${timestamp}.json`);
  writeFileSync(resultFile, JSON.stringify(reports, null, 2));

  // Summary
  console.log('\n📊 Summary:');
  let totalPassed = 0;
  let totalFailed = 0;

  for (const report of reports) {
    totalPassed += report.passed;
    totalFailed += report.failed;

    const status = report.failed === 0 ? '✓' : '✗';
    console.log(`  ${status} ${report.sequence}: ${report.passed}/${report.total_scenarios} passed`);
  }

  console.log(`\n🎯 Overall: ${totalPassed}/${totalPassed + totalFailed} scenarios passed`);
  console.log(`📄 Results saved to: ${resultFile}`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
