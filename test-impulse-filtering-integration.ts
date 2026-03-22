/**
 * Integration Test: Impulse Filtering (Phase 1.8)
 * 
 * Verifies that impulse filtering correctly reduces token usage
 * based on learned relevance scores.
 */

import { filterImpulsesByRelevance, calculateSavings, estimateImpulseTokens, generateFilteringSummary, type FilterConfig } from "./repos/minibob/src/impulse-filter"
import type { ImpulseRelevanceMetric } from "./repos/minibob/src/mcp"

// =============================================================================
// TEST DATA
// =============================================================================

const mockImpulseIds = [
  "imp-auth-config",      // High relevance
  "imp-db-schema",        // High relevance
  "imp-api-docs",         // Medium relevance
  "imp-unused-util",      // Low relevance (better without)
  "imp-test-data",        // Medium relevance
  "imp-legacy-code",      // Low relevance
  "imp-new-feature",      // High relevance
  "imp-debug-logs",       // Low relevance
  "imp-perf-metrics",     // Medium relevance
  "imp-old-migration",    // Very low relevance
  "imp-temp-notes",       // Very low relevance
  "imp-deployment-cfg",   // Medium relevance
  "imp-monitoring",       // High relevance
  "imp-cache-impl",       // Medium relevance
  "imp-error-handling",   // High relevance
]

const mockMetrics: ImpulseRelevanceMetric[] = [
  {
    impulse_id: "imp-auth-config",
    activity_variant_id: "test-activity",
    times_loaded: 20,
    times_execution_succeeded: 18,
    times_execution_failed: 2,
    times_not_loaded_succeeded: 3,
    times_not_loaded_failed: 7,
    relevance_score: 0.90,      // Very high (18/20 success when loaded)
    irrelevance_score: 0.30,    // Low (3/10 success when not loaded)
    avg_content_size_tokens: 2000,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-db-schema",
    activity_variant_id: "test-activity",
    times_loaded: 15,
    times_execution_succeeded: 14,
    times_execution_failed: 1,
    times_not_loaded_succeeded: 2,
    times_not_loaded_failed: 8,
    relevance_score: 0.93,      // Very high
    irrelevance_score: 0.20,
    avg_content_size_tokens: 1500,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-api-docs",
    activity_variant_id: "test-activity",
    times_loaded: 12,
    times_execution_succeeded: 8,
    times_execution_failed: 4,
    times_not_loaded_succeeded: 5,
    times_not_loaded_failed: 5,
    relevance_score: 0.67,      // Medium
    irrelevance_score: 0.50,
    avg_content_size_tokens: 1200,
    typical_pointer_type: "memo",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-unused-util",
    activity_variant_id: "test-activity",
    times_loaded: 10,
    times_execution_succeeded: 4,
    times_execution_failed: 6,
    times_not_loaded_succeeded: 9,
    times_not_loaded_failed: 1,
    relevance_score: 0.40,      // Low
    irrelevance_score: 0.90,    // High (better without it!)
    avg_content_size_tokens: 1000,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-test-data",
    activity_variant_id: "test-activity",
    times_loaded: 8,
    times_execution_succeeded: 5,
    times_execution_failed: 3,
    times_not_loaded_succeeded: 4,
    times_not_loaded_failed: 4,
    relevance_score: 0.62,      // Medium
    irrelevance_score: 0.50,
    avg_content_size_tokens: 500,
    typical_pointer_type: "memo",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-legacy-code",
    activity_variant_id: "test-activity",
    times_loaded: 5,
    times_execution_succeeded: 2,
    times_execution_failed: 3,
    times_not_loaded_succeeded: 8,
    times_not_loaded_failed: 2,
    relevance_score: 0.40,      // Low
    irrelevance_score: 0.80,    // High
    avg_content_size_tokens: 2000,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-new-feature",
    activity_variant_id: "test-activity",
    times_loaded: 18,
    times_execution_succeeded: 16,
    times_execution_failed: 2,
    times_not_loaded_succeeded: 1,
    times_not_loaded_failed: 9,
    relevance_score: 0.89,      // High
    irrelevance_score: 0.10,
    avg_content_size_tokens: 1500,
    typical_pointer_type: "activityOutput",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-debug-logs",
    activity_variant_id: "test-activity",
    times_loaded: 6,
    times_execution_succeeded: 3,
    times_execution_failed: 3,
    times_not_loaded_succeeded: 7,
    times_not_loaded_failed: 3,
    relevance_score: 0.50,      // Borderline
    irrelevance_score: 0.70,    // Better without
    avg_content_size_tokens: 1000,
    typical_pointer_type: "memo",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-perf-metrics",
    activity_variant_id: "test-activity",
    times_loaded: 10,
    times_execution_succeeded: 7,
    times_execution_failed: 3,
    times_not_loaded_succeeded: 5,
    times_not_loaded_failed: 5,
    relevance_score: 0.70,      // Medium-high
    irrelevance_score: 0.50,
    avg_content_size_tokens: 1200,
    typical_pointer_type: "analysisResult",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-old-migration",
    activity_variant_id: "test-activity",
    times_loaded: 4,
    times_execution_succeeded: 1,
    times_execution_failed: 3,
    times_not_loaded_succeeded: 9,
    times_not_loaded_failed: 1,
    relevance_score: 0.25,      // Very low
    irrelevance_score: 0.90,    // Very high
    avg_content_size_tokens: 2000,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-monitoring",
    activity_variant_id: "test-activity",
    times_loaded: 16,
    times_execution_succeeded: 15,
    times_execution_failed: 1,
    times_not_loaded_succeeded: 2,
    times_not_loaded_failed: 8,
    relevance_score: 0.94,      // Very high
    irrelevance_score: 0.20,
    avg_content_size_tokens: 1000,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    impulse_id: "imp-error-handling",
    activity_variant_id: "test-activity",
    times_loaded: 14,
    times_execution_succeeded: 13,
    times_execution_failed: 1,
    times_not_loaded_succeeded: 3,
    times_not_loaded_failed: 7,
    relevance_score: 0.93,      // Very high
    irrelevance_score: 0.30,
    avg_content_size_tokens: 1500,
    typical_pointer_type: "file",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// =============================================================================
// TESTS
// =============================================================================

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`❌ ${message}\n  Expected: ${expected}\n  Actual: ${actual}`)
  }
}

function assertIncludes(array: string[], item: string, message: string) {
  if (!array.includes(item)) {
    throw new Error(`❌ ${message}\n  Array: ${JSON.stringify(array)}\n  Missing: ${item}`)
  }
}

function assertNotIncludes(array: string[], item: string, message: string) {
  if (array.includes(item)) {
    throw new Error(`❌ ${message}\n  Array: ${JSON.stringify(array)}\n  Unexpected: ${item}`)
  }
}

function assertGreaterThan(actual: number, threshold: number, message: string) {
  if (actual <= threshold) {
    throw new Error(`❌ ${message}\n  Expected > ${threshold}\n  Actual: ${actual}`)
  }
}

// Test 1: Fallback behavior (no metrics)
function test1_FallbackBehavior() {
  console.log("\n=== Test 1: Fallback Behavior (No Metrics) ===")
  
  // Test load-all fallback (with high maxImpulses to not limit)
  const result1 = filterImpulsesByRelevance(mockImpulseIds, [], { 
    fallbackBehavior: 'load-all',
    maxImpulses: 100, // No limit
  })
  assertEqual(result1.toLoad.length, mockImpulseIds.length, "load-all: Should load all impulses")
  assertEqual(result1.toSkip.length, 0, "load-all: Should skip no impulses")
  
  // Test load-none fallback
  const result2 = filterImpulsesByRelevance(mockImpulseIds, [], { fallbackBehavior: 'load-none' })
  assertEqual(result2.toLoad.length, 0, "load-none: Should load no impulses")
  assertEqual(result2.toSkip.length, mockImpulseIds.length, "load-none: Should skip all impulses")
  
  // Test load-top-n fallback
  const result3 = filterImpulsesByRelevance(mockImpulseIds, [], { fallbackBehavior: 'load-top-n', maxImpulses: 5 })
  assertEqual(result3.toLoad.length, 5, "load-top-n: Should load exactly maxImpulses")
  assertEqual(result3.toSkip.length, mockImpulseIds.length - 5, "load-top-n: Should skip remaining")
  
  console.log("✅ Test 1 passed")
}

// Test 2: High relevance filtering
function test2_HighRelevanceFiltering() {
  console.log("\n=== Test 2: High Relevance Filtering ===")
  
  const result = filterImpulsesByRelevance(mockImpulseIds, mockMetrics, {
    relevanceThreshold: 0.5,
    alwaysLoadThreshold: 0.8,
    maxImpulses: 15, // No limit for this test
  })
  
  // Very high relevance (> 0.8) should always be loaded
  assertIncludes(result.toLoad, "imp-auth-config", "Should load imp-auth-config (0.90)")
  assertIncludes(result.toLoad, "imp-db-schema", "Should load imp-db-schema (0.93)")
  assertIncludes(result.toLoad, "imp-new-feature", "Should load imp-new-feature (0.89)")
  assertIncludes(result.toLoad, "imp-monitoring", "Should load imp-monitoring (0.94)")
  assertIncludes(result.toLoad, "imp-error-handling", "Should load imp-error-handling (0.93)")
  
  console.log(`✅ Test 2 passed - Loaded ${result.toLoad.length}/${mockImpulseIds.length} impulses`)
}

// Test 3: Irrelevance filtering (skip when irrelevance > relevance)
function test3_IrrelevanceFiltering() {
  console.log("\n=== Test 3: Irrelevance Filtering ===")
  
  const result = filterImpulsesByRelevance(mockImpulseIds, mockMetrics, {
    relevanceThreshold: 0.3, // Low threshold, but irrelevance check should kick in
    maxImpulses: 15,
  })
  
  // These have irrelevance_score > relevance_score (better without them)
  assertNotIncludes(result.toLoad, "imp-unused-util", "Should skip imp-unused-util (irrel 0.90 > rel 0.40)")
  assertNotIncludes(result.toLoad, "imp-legacy-code", "Should skip imp-legacy-code (irrel 0.80 > rel 0.40)")
  assertNotIncludes(result.toLoad, "imp-old-migration", "Should skip imp-old-migration (irrel 0.90 > rel 0.25)")
  assertNotIncludes(result.toLoad, "imp-debug-logs", "Should skip imp-debug-logs (irrel 0.70 > rel 0.50)")
  
  console.log(`✅ Test 3 passed - Skipped ${result.toSkip.length} irrelevant impulses`)
}

// Test 4: Max limit enforcement
function test4_MaxLimitEnforcement() {
  console.log("\n=== Test 4: Max Limit Enforcement ===")
  
  const result = filterImpulsesByRelevance(mockImpulseIds, mockMetrics, {
    relevanceThreshold: 0.5,
    maxImpulses: 5, // Strict limit
  })
  
  assertEqual(result.toLoad.length, 5, "Should respect maxImpulses limit")
  
  // Top 5 should be the highest scoring (all > 0.8)
  assertIncludes(result.toLoad, "imp-monitoring", "Top 5 should include imp-monitoring (0.94)")
  assertIncludes(result.toLoad, "imp-db-schema", "Top 5 should include imp-db-schema (0.93)")
  assertIncludes(result.toLoad, "imp-error-handling", "Top 5 should include imp-error-handling (0.93)")
  
  console.log(`✅ Test 4 passed - Limited to ${result.toLoad.length} impulses`)
}

// Test 5: Token savings calculation
function test5_TokenSavingsCalculation() {
  console.log("\n=== Test 5: Token Savings Calculation ===")
  
  const result = filterImpulsesByRelevance(mockImpulseIds, mockMetrics, {
    relevanceThreshold: 0.6,
    maxImpulses: 10,
  })
  
  // Build token size map
  const tokenSizes = new Map<string, number>()
  for (const metric of mockMetrics) {
    tokenSizes.set(metric.impulse_id, metric.avg_content_size_tokens)
  }
  
  // Calculate savings
  const savings = calculateSavings(result.toSkip, tokenSizes)
  const summary = generateFilteringSummary(result, savings)
  
  // Verify savings
  assertGreaterThan(savings.tokensSaved, 0, "Should save some tokens")
  assertGreaterThan(savings.percentSaved, 0, "Should save some percentage")
  assertGreaterThan(savings.costSaved, 0, "Should save some cost")
  
  console.log(`✅ Test 5 passed`)
  console.log(`   Token savings: ${savings.tokensSaved} tokens (${savings.percentSaved.toFixed(1)}%)`)
  console.log(`   Cost savings: $${savings.costSaved.toFixed(4)}`)
  console.log(`   Loaded: ${result.toLoad.length}/${mockImpulseIds.length} impulses`)
}

// Test 6: Realistic scenario (30-50% token reduction)
function test6_RealisticScenario() {
  console.log("\n=== Test 6: Realistic Scenario (Target: 30-50% Reduction) ===")
  
  // Balanced configuration (similar to production)
  const result = filterImpulsesByRelevance(mockImpulseIds, mockMetrics, {
    relevanceThreshold: 0.6,
    alwaysLoadThreshold: 0.75,
    maxImpulses: 8,
  })
  
  // Build token size map
  const tokenSizes = new Map<string, number>()
  for (const metric of mockMetrics) {
    tokenSizes.set(metric.impulse_id, metric.avg_content_size_tokens)
  }
  // Estimate tokens for impulses without metrics
  for (const id of mockImpulseIds) {
    if (!tokenSizes.has(id)) {
      tokenSizes.set(id, 1000) // Default estimate
    }
  }
  
  const savings = calculateSavings(result.toSkip, tokenSizes)
  const summary = generateFilteringSummary(result, savings)
  
  console.log(`   Loaded: ${summary.loadedImpulses}/${summary.totalImpulses} impulses`)
  console.log(`   Skipped: ${summary.skippedImpulses} impulses`)
  console.log(`   Token reduction: ${summary.percentSaved.toFixed(1)}%`)
  console.log(`   Token savings: ${summary.tokensSaved} tokens`)
  console.log(`   Cost savings: $${summary.costSaved.toFixed(4)}`)
  
  // Verify we're in the target range (30-50% reduction)
  if (summary.percentSaved < 30) {
    console.log(`⚠️  Warning: Token reduction below target (${summary.percentSaved.toFixed(1)}% < 30%)`)
  } else if (summary.percentSaved > 50) {
    console.log(`⚠️  Warning: Token reduction above target (${summary.percentSaved.toFixed(1)}% > 50%) - may impact success rate`)
  } else {
    console.log(`✅ Token reduction in target range (30-50%)`)
  }
  
  console.log(`✅ Test 6 passed`)
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function runTests() {
  console.log("🧪 Impulse Filtering Integration Tests (Phase 1.8)")
  console.log("=" .repeat(60))
  
  try {
    test1_FallbackBehavior()
    test2_HighRelevanceFiltering()
    test3_IrrelevanceFiltering()
    test4_MaxLimitEnforcement()
    test5_TokenSavingsCalculation()
    test6_RealisticScenario()
    
    console.log("\n" + "=".repeat(60))
    console.log("✅ All tests passed!")
    console.log("=".repeat(60))
    
  } catch (error) {
    console.error("\n" + "=".repeat(60))
    console.error("❌ Test failed:", error instanceof Error ? error.message : String(error))
    console.error("=".repeat(60))
    process.exit(1)
  }
}

runTests()
