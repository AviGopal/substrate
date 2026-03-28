#!/usr/bin/env bun

/**
 * Assessment script for activity-api goal resolution quality
 * Tests various goals and analyzes template selection behavior
 */

const ACTIVITY_API = process.env.ACTIVITY_API_ENDPOINT || "http://activity.metabob.local";
const ORG_ID = "metabob_internal";

interface RecommendationRequest {
  task_description: string;
  category?: string;
  tags?: string[];
  tag_prefix?: string;
  loaded_impulses?: string[];
  impulse_shapes?: string[];
  limit: number;  // Required, defaults to 3
}

interface RecommendationResponse {
  recommendations: Array<{
    template_id: string;
    template_name: string;
    category: string;
    tags: string[];
    input_shapes: string[];
    output_shapes: string[];
    input_schema: any;
    output_schema: any;
    selection_metadata: {
      method: string;
      score: number;
      score_source: string;
      alpha?: number;
      beta?: number;
      sample?: number;
      query_path?: string;
    };
    correlation_id: string;
  }>;
  selection_method?: string;
  metadata?: any;
}

interface TestCase {
  category: string;
  goal: string;
  expected_patterns: string[];  // Keywords we expect in selected activity_id or description
  impulse_shapes?: string[];
  loaded_impulses?: string[];
}

const TEST_CASES: TestCase[] = [
  // Test creation goals
  {
    category: "test-creation",
    goal: "Create comprehensive unit tests for src/impulse.ts focusing on the createImpulse function",
    expected_patterns: ["test", "unit", "vessel-add-tests"],
  },
  {
    category: "test-creation",
    goal: "Write tests for the activity executor to verify task execution flow",
    expected_patterns: ["test", "unit", "vessel-add-tests"],
  },

  // Bug fixing goals
  {
    category: "bugfix",
    goal: "Fix the authentication error in MiniBob where JWT tokens are not being validated correctly",
    expected_patterns: ["fix", "debug", "bugfix", "analyze-failure"],
  },
  {
    category: "bugfix",
    goal: "Debug why the activity execution is failing with 'impulse not found' error",
    expected_patterns: ["debug", "analyze-failure", "discover-missing-impulses"],
  },

  // Feature development goals
  {
    category: "feature",
    goal: "Implement a new endpoint for retrieving activity execution history with pagination",
    expected_patterns: ["feature", "implement", "create"],
  },
  {
    category: "feature",
    goal: "Add support for WebSocket notifications when activity executions complete",
    expected_patterns: ["feature", "implement", "add"],
  },

  // Refactoring goals
  {
    category: "refactor",
    goal: "Refactor the impulse resolver to use a plugin architecture instead of switch statements",
    expected_patterns: ["refactor", "improve", "optimize"],
  },

  // Meta-learning goals
  {
    category: "meta-learning",
    goal: "Analyze failed executions to discover common missing impulses",
    expected_patterns: ["discover-missing-impulses", "analyze", "meta"],
  },
  {
    category: "meta-learning",
    goal: "Extract a reusable activity template from the last successful test creation execution",
    expected_patterns: ["extract", "create-activity", "ribosome", "trace"],
  },
  {
    category: "meta-learning",
    goal: "Find patterns in which activity sequences successfully complete feature implementations",
    expected_patterns: ["discover-composition", "pattern", "composition"],
  },

  // Code exploration goals
  {
    category: "exploration",
    goal: "Explore the codebase structure to understand how activities are executed",
    expected_patterns: ["explore", "codebase"],
  },
  {
    category: "exploration",
    goal: "Analyze the dependencies between MiniBob modules",
    expected_patterns: ["explore", "analyze", "codebase"],
  },

  // Instrumentation goals
  {
    category: "instrumentation",
    goal: "Add runtime instrumentation to capture execution traces for the activity executor",
    expected_patterns: ["instrument", "trace"],
  },

  // Activity improvement goals
  {
    category: "activity-improvement",
    goal: "The vessel-add-tests activity is failing 60% of the time, debug and fix it",
    expected_patterns: ["debug-failing-activity", "analyze-failure", "improve"],
  },
  {
    category: "activity-improvement",
    goal: "Create a specialized variant of the test creation activity for React components",
    expected_patterns: ["specialize", "variant", "create-activity-variant"],
  },
];

async function getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse | null> {
  try {
    const response = await fetch(`${ACTIVITY_API}/v2/activities/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": ORG_ID,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${await response.text()}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Request failed:", error);
    return null;
  }
}

function assessMatch(
  goal: string,
  recommendations: RecommendationResponse['recommendations'],
  expectedPatterns: string[]
): {
  matched: boolean;
  matchedPatterns: string[];
  topActivity: string;
  topScore: number;
  matchQuality: number;
} {
  if (!recommendations || recommendations.length === 0) {
    return {
      matched: false,
      matchedPatterns: [],
      topActivity: "NONE",
      topScore: 0,
      matchQuality: 0,
    };
  }

  const topRec = recommendations[0];
  if (!topRec || !topRec.template_id) {
    return {
      matched: false,
      matchedPatterns: [],
      topActivity: "INVALID",
      topScore: 0,
      matchQuality: 0,
    };
  }

  const topActivity = topRec.template_id.toLowerCase();
  const topName = (topRec.template_name || "").toLowerCase();
  const topCategory = (topRec.category || "").toLowerCase();

  const matchedPatterns = expectedPatterns.filter(pattern =>
    topActivity.includes(pattern.toLowerCase()) ||
    topName.includes(pattern.toLowerCase()) ||
    topCategory.includes(pattern.toLowerCase())
  );

  return {
    matched: matchedPatterns.length > 0,
    matchedPatterns,
    topActivity: topRec.template_id,
    topScore: topRec.selection_metadata.score,
    matchQuality: 0, // Not provided in current API response
  };
}

async function runAssessment() {
  console.log("=".repeat(80));
  console.log("ACTIVITY API GOAL RESOLUTION ASSESSMENT");
  console.log("=".repeat(80));
  console.log(`API Endpoint: ${ACTIVITY_API}`);
  console.log(`Organization: ${ORG_ID}`);
  console.log(`Total Test Cases: ${TEST_CASES.length}`);
  console.log("=".repeat(80));
  console.log();

  const results = {
    total: 0,
    matched: 0,
    failed: 0,
    errors: 0,
    byCategory: new Map<string, { total: number; matched: number; failed: number }>(),
  };

  for (const testCase of TEST_CASES) {
    console.log(`\n[${ testCase.category.toUpperCase()}] ${testCase.goal}`);
    console.log("-".repeat(80));

    const request: RecommendationRequest = {
      task_description: testCase.goal,
      // Don't pass category - let semantic tag extraction handle it
      loaded_impulses: testCase.loaded_impulses,
      impulse_shapes: testCase.impulse_shapes,
      limit: 5,
    };

    const response = await getRecommendations(request);

    if (!response) {
      console.log("❌ ERROR: No response from API");
      results.errors++;
      continue;
    }

    results.total++;

    // Update category stats
    if (!results.byCategory.has(testCase.category)) {
      results.byCategory.set(testCase.category, { total: 0, matched: 0, failed: 0 });
    }
    const categoryStats = results.byCategory.get(testCase.category)!;
    categoryStats.total++;

    const assessment = assessMatch(testCase.goal, response.recommendations, testCase.expected_patterns);

    if (response.recommendations.length === 0) {
      console.log("⚠️  NO RECOMMENDATIONS RETURNED");
      results.failed++;
      categoryStats.failed++;
      continue;
    }

    console.log(`\nSelection Method: ${response.recommendations[0]?.selection_metadata?.method || "unknown"}`);
    console.log(`\nTop 3 Recommendations:`);

    for (let i = 0; i < Math.min(3, response.recommendations.length); i++) {
      const rec = response.recommendations[i];
      const prefix = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      console.log(`\n${prefix} ${rec.template_id} - ${rec.template_name}`);
      console.log(`   Category: ${rec.category}`);
      console.log(`   Tags: [${rec.tags.join(", ")}]`);
      console.log(`   Score: ${rec.selection_metadata.score.toFixed(4)}`);
      console.log(`   Method: ${rec.selection_metadata.method}`);
      console.log(`   Source: ${rec.selection_metadata.score_source}`);
      if (rec.selection_metadata.alpha !== undefined) {
        console.log(`   Thompson α/β: ${rec.selection_metadata.alpha}/${rec.selection_metadata.beta}`);
      }
      if (rec.input_shapes?.length > 0) {
        console.log(`   Input Shapes: [${rec.input_shapes.join(", ")}]`);
      }
      if (rec.output_shapes?.length > 0) {
        console.log(`   Output Shapes: [${rec.output_shapes.join(", ")}]`);
      }
    }

    console.log(`\nExpected Patterns: [${testCase.expected_patterns.join(", ")}]`);

    if (assessment.matched) {
      console.log(`✅ MATCH - Found patterns: [${assessment.matchedPatterns.join(", ")}]`);
      results.matched++;
      categoryStats.matched++;
    } else {
      console.log(`❌ NO MATCH - Selected: ${assessment.topActivity}`);
      results.failed++;
      categoryStats.failed++;
    }

    // Assess consistency by running the same goal again
    console.log(`\nConsistency Check (same goal, 2nd request):`);
    const response2 = await getRecommendations(request);
    if (response2 && response2.recommendations.length > 0) {
      const sameTop = response2.recommendations[0].template_id === assessment.topActivity;
      if (sameTop) {
        console.log(`✅ Consistent - Same top recommendation`);
      } else {
        console.log(`⚠️  Inconsistent - Different top: ${response2.recommendations[0].template_id} (was ${assessment.topActivity})`);
      }
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print summary
  console.log("\n\n");
  console.log("=".repeat(80));
  console.log("ASSESSMENT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Matched: ${results.matched} (${((results.matched / results.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
  console.log(`Errors: ${results.errors}`);

  console.log("\nBy Category:");
  console.log("-".repeat(80));
  for (const [category, stats] of results.byCategory.entries()) {
    const matchRate = stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;
    console.log(`${category.padEnd(25)} ${stats.matched}/${stats.total} (${matchRate.toFixed(1)}%)`);
  }

  console.log("\n" + "=".repeat(80));

  // Recommendations
  console.log("\nRECOMMENDATIONS:");
  console.log("-".repeat(80));

  if (results.matched / results.total < 0.5) {
    console.log("🔴 CRITICAL: Less than 50% match rate");
    console.log("   - Goal resolution is performing poorly");
    console.log("   - Template selection appears random or weakly correlated");
    console.log("   - Input matching mechanism needs improvement");
  } else if (results.matched / results.total < 0.7) {
    console.log("🟡 WARNING: Less than 70% match rate");
    console.log("   - Goal resolution needs improvement");
    console.log("   - Some categories performing better than others");
  } else {
    console.log("🟢 GOOD: Above 70% match rate");
    console.log("   - Goal resolution working reasonably well");
    console.log("   - Continue monitoring edge cases");
  }

  console.log("\nSuggested Investigations:");
  console.log("1. Check if Thompson Sampling priors are well-calibrated");
  console.log("2. Verify input_schema matching logic is working");
  console.log("3. Review semantic similarity implementation");
  console.log("4. Assess if execution history has sufficient data");
  console.log("5. Test deterministic vs semantic vs exploration strategies");
  console.log("\n" + "=".repeat(80));
}

// Run assessment
runAssessment().catch(console.error);
