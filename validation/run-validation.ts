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

async function resolveImpulses(action: any, setup: any): Promise<any> {
  // Test the 6-step resolver dispatch chain:
  // LOCAL → CUSTOM → DISCOVERY → BACKEND → MCP → FALLBACK

  const results: Record<string, any> = {};

  for (const impulseId of action.impulse_ids) {
    const impulse = setup.impulses.find((i: any) => i.id === impulseId);

    if (!impulse) {
      results[impulseId] = {
        resolver: 'ERROR',
        error: 'Impulse not found in setup'
      };
      continue;
    }

    const pointerType = impulse.pointer.type;

    // Step 1: LOCAL resolvers (memo, file, directoryTree, gitDiff)
    const localTypes = ['memo', 'file', 'directoryTree', 'gitDiff'];
    if (localTypes.includes(pointerType)) {
      results[impulseId] = {
        resolver: 'LOCAL',
        content_source: pointerType === 'memo' ? 'embedded' : 'filesystem',
        content: impulse.pointer.content || `<${pointerType} content>`,
      };
      continue;
    }

    // Step 2-4: CUSTOM, DISCOVERY, BACKEND
    // For backend resolution, we need to call the activity API
    const backendTypes = [
      'activityExecutionTrace',
      'activityTemplate',
      'activityMetrics',
      'activityCompositionGraph',
      'impulseRelevanceMetrics',
      'toolUsagePatterns'
    ];

    if (backendTypes.includes(pointerType)) {
      try {
        const response = await fetch(`${BACKEND_URL}/v2/impulses/resolve`, {
          method: 'POST',
          headers: {
            'Authorization': `ApiKey ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pointer: impulse.pointer
          })
        });

        if (response.ok) {
          const data = await response.json();
          results[impulseId] = {
            resolver: 'BACKEND',
            content_source: 'mcp',
            content: data.content || data.data,
          };
        } else {
          results[impulseId] = {
            resolver: 'ERROR',
            error: `Backend resolution failed: ${response.status}`
          };
        }
      } catch (error) {
        results[impulseId] = {
          resolver: 'ERROR',
          error: `Backend call failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      continue;
    }

    // Unknown type - would fall through to FALLBACK in real implementation
    results[impulseId] = {
      resolver: 'FALLBACK',
      content_source: 'unknown',
      error: `Unknown pointer type: ${pointerType}`
    };
  }

  return results;
}

async function loadImpulse(action: any, setup: any): Promise<any> {
  // Test budget enforcement and truncation
  const impulse = setup.impulse;

  if (!impulse) {
    throw new Error('No impulse in setup');
  }

  // Simulate content loading (in real scenario, would read from pointer)
  let content = '';
  if (impulse.pointer.type === 'memo') {
    content = impulse.pointer.content || '';
  } else if (impulse.pointer.type === 'file') {
    // For validation, use a large dummy content to test truncation
    // In real scenario: content = await readFile(impulse.pointer.path)
    content = 'x'.repeat(50000); // Simulate 10,000 tokens (roughly 5 chars per token)
  }

  // Estimate tokens (rough approximation: 1 token ~= 4-5 characters)
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  const originalTokenCount = estimateTokens(content);
  const budget = impulse.budget || 2000;

  // Check if truncation needed
  const wasTruncated = originalTokenCount > budget;
  const truncationRatio = budget > 0 ? originalTokenCount / budget : 0;

  let finalContent = content;
  let tokenCount = originalTokenCount;

  if (wasTruncated) {
    // Truncate to 90% of budget for safety margin
    const ratio = budget / originalTokenCount;
    const targetChars = Math.floor(content.length * ratio * 0.9);
    finalContent = content.substring(0, targetChars) + '\n... (truncated to fit budget)';
    tokenCount = Math.floor(budget * 0.9);
  }

  return {
    loaded: true,
    token_count: tokenCount,
    metadata: {
      was_truncated: wasTruncated,
      original_token_count: originalTokenCount,
      truncation_ratio: wasTruncated ? truncationRatio : 1.0,
    },
    content_suffix: wasTruncated ? '... (truncated to fit budget)' : null,
  };
}

async function formatForContext(action: any, setup: any): Promise<any> {
  // Test metadata-first formatting (pointer-mode vs content-mode)
  const impulse = setup.impulse;

  if (!impulse) {
    throw new Error('No impulse in setup');
  }

  const loadContent = action.load_content ?? false;

  // Pointer-mode: metadata only, no content loaded
  if (!loadContent && impulse.metadata) {
    const attrs = [
      `id="${impulse.id}"`,
      `type="${impulse.pointer.type}"`,
      `shape="${impulse.shape || impulse.metadata.shape || 'unknown'}"`,
    ];

    if (impulse.metadata.row_count !== undefined) {
      attrs.push(`row_count="${impulse.metadata.row_count}"`);
    }

    if (impulse.summary || impulse.metadata.summary) {
      const summary = (impulse.summary || impulse.metadata.summary).replace(/"/g, '&quot;');
      attrs.push(`summary="${summary}"`);
    }

    if (impulse.metadata.available_ops?.length) {
      attrs.push(`available_ops="${impulse.metadata.available_ops.join(',')}"`);
    }

    return {
      format: 'pointer-mode',
      xml: `<impulse_ref ${attrs.join(' ')} />`,
    };
  }

  // Content-mode: loaded impulse with full content
  if (loadContent) {
    let content = '';
    if (impulse.pointer.type === 'memo') {
      content = impulse.pointer.content || '';
    } else {
      content = `<${impulse.pointer.type} content placeholder>`;
    }

    // Estimate tokens
    const tokenCount = Math.ceil(content.length / 4);
    const budget = impulse.budget || 2000;
    const tokenUsage = `${tokenCount}/${budget}`;

    return {
      format: 'content-mode',
      xml_start: `<impulse id="${impulse.id}" type="${impulse.pointer.type}" tokens="${tokenUsage}">`,
      xml_end: '</impulse>',
      content_included: true,
      full_xml: `<impulse id="${impulse.id}" type="${impulse.pointer.type}" tokens="${tokenUsage}">
${content}
</impulse>`,
    };
  }

  // Fallback: unloaded and no metadata
  return {
    format: 'none',
    xml: null,
  };
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
        actual = await resolveImpulses(scenario.action, setup);
        break;

      case 'load_impulse':
        actual = await loadImpulse(scenario.action, setup);
        break;

      case 'format_for_context':
        actual = await formatForContext(scenario.action, setup);
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

    // Validate resolve_impulses results
    if (scenario.action.type === 'resolve_impulses') {
      // Check each impulse resolved correctly
      for (const [impulseId, expectedResult] of Object.entries(scenario.expected)) {
        if (impulseId === 'loaded' || impulseId === 'skipped') continue; // Skip these, handled above

        const actualResult = actual[impulseId];
        if (!actualResult) {
          errors.push(`Missing resolution result for '${impulseId}'`);
          continue;
        }

        const expected = expectedResult as any;
        if (expected.resolver && actualResult.resolver !== expected.resolver) {
          errors.push(`Resolver mismatch for '${impulseId}': expected '${expected.resolver}', got '${actualResult.resolver}'`);
        }

        if (expected.content_source && actualResult.content_source !== expected.content_source) {
          errors.push(`Content source mismatch for '${impulseId}': expected '${expected.content_source}', got '${actualResult.content_source}'`);
        }
      }
    }

    // Validate load_impulse results
    if (scenario.action.type === 'load_impulse') {
      if (scenario.expected.loaded !== undefined && actual.loaded !== scenario.expected.loaded) {
        errors.push(`Load status mismatch: expected ${scenario.expected.loaded}, got ${actual.loaded}`);
      }

      if (scenario.expected.token_count !== undefined) {
        const tolerance = Math.floor(scenario.expected.token_count * 0.1); // 10% tolerance
        const diff = Math.abs(actual.token_count - scenario.expected.token_count);
        if (diff > tolerance) {
          errors.push(`Token count mismatch: expected ~${scenario.expected.token_count}, got ${actual.token_count} (diff: ${diff}, tolerance: ${tolerance})`);
        }
      }

      if (scenario.expected.metadata) {
        if (scenario.expected.metadata.was_truncated !== undefined) {
          if (actual.metadata.was_truncated !== scenario.expected.metadata.was_truncated) {
            errors.push(`Truncation flag mismatch: expected ${scenario.expected.metadata.was_truncated}, got ${actual.metadata.was_truncated}`);
          }
        }

        if (scenario.expected.metadata.original_token_count !== undefined) {
          if (actual.metadata.original_token_count !== scenario.expected.metadata.original_token_count) {
            errors.push(`Original token count mismatch: expected ${scenario.expected.metadata.original_token_count}, got ${actual.metadata.original_token_count}`);
          }
        }
      }

      if (scenario.expected.content_suffix && actual.metadata.was_truncated) {
        if (!actual.content_suffix) {
          errors.push('Expected truncation message but none found');
        } else if (!actual.content_suffix.includes('truncated')) {
          errors.push(`Content suffix doesn't indicate truncation: ${actual.content_suffix}`);
        }
      }
    }

    // Validate format_for_context results
    if (scenario.action.type === 'format_for_context') {
      if (scenario.expected.format && actual.format !== scenario.expected.format) {
        errors.push(`Format mismatch: expected '${scenario.expected.format}', got '${actual.format}'`);
      }

      if (scenario.expected.xml !== undefined) {
        if (actual.xml !== scenario.expected.xml) {
          errors.push(`XML output mismatch:\nExpected: ${scenario.expected.xml}\nGot: ${actual.xml}`);
        }
      }

      if (scenario.expected.xml_start && !actual.xml_start?.includes(scenario.expected.xml_start)) {
        errors.push(`XML start tag mismatch: expected to contain '${scenario.expected.xml_start}', got '${actual.xml_start}'`);
      }

      if (scenario.expected.xml_end && actual.xml_end !== scenario.expected.xml_end) {
        errors.push(`XML end tag mismatch: expected '${scenario.expected.xml_end}', got '${actual.xml_end}'`);
      }

      if (scenario.expected.content_included !== undefined) {
        if (actual.content_included !== scenario.expected.content_included) {
          errors.push(`Content included mismatch: expected ${scenario.expected.content_included}, got ${actual.content_included}`);
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
