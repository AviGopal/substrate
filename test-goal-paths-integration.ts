#!/usr/bin/env bun
/**
 * Goal Execution Paths Integration Tests (Phase 1.7)
 * 
 * Tests:
 * 1. Record first path execution
 * 2. Record multiple executions of same path
 * 3. Record different paths for same goal
 * 4. Get path recommendation (exploit mode)
 * 5. Get path recommendation (explore mode)
 */

const API_URL = process.env.API_URL || "http://api.minibob.local";

console.log("================================================================================");
console.log("GOAL EXECUTION PATHS INTEGRATION TEST (Phase 1.7)");
console.log("================================================================================");
console.log("API URL:", API_URL);
console.log();

// Test utilities
async function waitForAPI(maxRetries = 10): Promise<boolean> {
  console.log("Waiting for API to be ready...");
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        console.log("✅ API is ready");
        return true;
      }
    } catch (error) {
      console.log(`  Retry ${i}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  console.error("❌ API not available");
  return false;
}

/**
 * Test 1: Record first path execution
 */
async function test1_RecordFirstPath(): Promise<boolean> {
  console.log("--------------------------------------------------------------------------------");
  console.log("Test 1: Record first path execution");
  console.log("--------------------------------------------------------------------------------");
  
  const pathRecord = {
    goal_text: "Add REST endpoint for user management",
    goal_category: "feature",
    path_activities: ["scaffold-endpoint", "add-validation", "add-tests", "commit-changes"],
    success: true,
    duration_ms: 45000,
    cost_usd: 0.12,
    token_usage: 8000,
    files_modified: ["src/api/users.ts", "tests/api/users.test.ts"],
    tools_used: ["write", "bash", "read"],
  };
  
  try {
    const response = await fetch(`${API_URL}/v2/activities/goal-paths`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pathRecord),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error("POST failed:", response.status, text);
      return false;
    }
    
    const data = await response.json();
    console.log("✅ Path recorded:", {
      goal_hash: data.path.goal_hash,
      total_executions: data.path.total_executions,
      success_rate: data.path.success_rate,
      thompson_alpha: data.path.thompson_alpha,
      thompson_beta: data.path.thompson_beta,
    });
    
    // Verify Thompson parameters for first success
    if (data.path.total_executions !== 1) {
      console.error("❌ Expected total_executions=1, got", data.path.total_executions);
      return false;
    }
    
    if (data.path.thompson_alpha !== 2.0) {
      console.error("❌ Expected thompson_alpha=2.0 (1 success + prior), got", data.path.thompson_alpha);
      return false;
    }
    
    if (data.path.thompson_beta !== 1.0) {
      console.error("❌ Expected thompson_beta=1.0 (0 failures + prior), got", data.path.thompson_beta);
      return false;
    }
    
    console.log("✅ Thompson parameters correct (α=2, β=1)");
    console.log("✅ Test 1 PASSED");
    return true;
    
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Test 2: Record multiple executions of same path
 */
async function test2_RecordMultipleExecutions(): Promise<boolean> {
  console.log("--------------------------------------------------------------------------------");
  console.log("Test 2: Record multiple executions of same path");
  console.log("--------------------------------------------------------------------------------");
  
  const baseRecord = {
    goal_text: "Fix authentication bug",
    goal_category: "bugfix",
    path_activities: ["analyze-issue", "fix-code", "add-regression-test", "commit"],
    duration_ms: 30000,
    cost_usd: 0.08,
  };
  
  try {
    // Execute 5 times: 3 success, 2 fail
    const executions = [
      { ...baseRecord, success: true },
      { ...baseRecord, success: true },
      { ...baseRecord, success: false },
      { ...baseRecord, success: true },
      { ...baseRecord, success: false },
    ];
    
    let lastResponse: any;
    for (let i = 0; i < executions.length; i++) {
      const response = await fetch(`${API_URL}/v2/activities/goal-paths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(executions[i]),
      });
      
      if (!response.ok) {
        console.error(`Execution ${i+1} failed:`, response.status);
        return false;
      }
      
      lastResponse = await response.json();
    }
    
    console.log("✅ Recorded 5 executions (3 success, 2 fail)");
    console.log("  Final state:", {
      total: lastResponse.path.total_executions,
      successful: lastResponse.path.successful_executions,
      failed: lastResponse.path.failed_executions,
      success_rate: lastResponse.path.success_rate,
      thompson_alpha: lastResponse.path.thompson_alpha,
      thompson_beta: lastResponse.path.thompson_beta,
    });
    
    // Verify aggregation
    if (lastResponse.path.total_executions !== 5) {
      console.error("❌ Expected total=5, got", lastResponse.path.total_executions);
      return false;
    }
    
    if (lastResponse.path.successful_executions !== 3) {
      console.error("❌ Expected successful=3, got", lastResponse.path.successful_executions);
      return false;
    }
    
    if (lastResponse.path.failed_executions !== 2) {
      console.error("❌ Expected failed=2, got", lastResponse.path.failed_executions);
      return false;
    }
    
    // Thompson parameters: α = successes + 1 = 4, β = failures + 1 = 3
    if (lastResponse.path.thompson_alpha !== 4.0) {
      console.error("❌ Expected thompson_alpha=4.0, got", lastResponse.path.thompson_alpha);
      return false;
    }
    
    if (lastResponse.path.thompson_beta !== 3.0) {
      console.error("❌ Expected thompson_beta=3.0, got", lastResponse.path.thompson_beta);
      return false;
    }
    
    // Success rate: 3/5 = 0.6
    if (Math.abs(lastResponse.path.success_rate - 0.6) > 0.01) {
      console.error("❌ Expected success_rate=0.6, got", lastResponse.path.success_rate);
      return false;
    }
    
    console.log("✅ Aggregation correct (α=4, β=3, success_rate=0.6)");
    console.log("✅ Test 2 PASSED");
    return true;
    
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Test 3: Record different paths for same goal
 */
async function test3_DifferentPathsSameGoal(): Promise<boolean> {
  console.log("--------------------------------------------------------------------------------");
  console.log("Test 3: Record different paths for same goal");
  console.log("--------------------------------------------------------------------------------");
  
  const goalText = "Refactor authentication module";
  
  const paths = [
    {
      goal_text: goalText,
      goal_category: "refactor",
      path_activities: ["analyze-dependencies", "refactor-code", "run-tests", "commit"],
      success: true,
      duration_ms: 60000,
      cost_usd: 0.15,
    },
    {
      goal_text: goalText,
      goal_category: "refactor",
      path_activities: ["create-tests-first", "refactor-incrementally", "commit-frequently"],
      success: true,
      duration_ms: 55000,
      cost_usd: 0.14,
    },
    {
      goal_text: goalText,
      goal_category: "refactor",
      path_activities: ["big-bang-rewrite", "fix-broken-tests"],
      success: false,
      duration_ms: 90000,
      cost_usd: 0.25,
    },
  ];
  
  try {
    for (let i = 0; i < paths.length; i++) {
      const response = await fetch(`${API_URL}/v2/activities/goal-paths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paths[i]),
      });
      
      if (!response.ok) {
        console.error(`Path ${i+1} failed:`, response.status);
        return false;
      }
    }
    
    console.log("✅ Recorded 3 different paths for same goal");
    
    // Query paths for this goal
    const queryResponse = await fetch(
      `${API_URL}/v2/activities/goal-paths?goal_text=${encodeURIComponent(goalText)}`
    );
    
    if (!queryResponse.ok) {
      console.error("Query failed:", queryResponse.status);
      return false;
    }
    
    const queryData = await queryResponse.json();
    console.log(`✅ Retrieved ${queryData.paths.length} paths for goal`);
    
    if (queryData.paths.length !== 3) {
      console.error("❌ Expected 3 paths, got", queryData.paths.length);
      return false;
    }
    
    // Verify paths are sorted by success_rate
    const successRates = queryData.paths.map((p: any) => p.success_rate);
    const isSorted = successRates.every((rate: number, i: number) => 
      i === 0 || rate <= successRates[i-1]
    );
    
    if (!isSorted) {
      console.error("❌ Paths not sorted by success_rate");
      return false;
    }
    
    console.log("✅ Paths correctly sorted by success_rate");
    console.log("✅ Test 3 PASSED");
    return true;
    
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Test 4: Get path recommendation (exploit mode)
 */
async function test4_RecommendExploit(): Promise<boolean> {
  console.log("--------------------------------------------------------------------------------");
  console.log("Test 4: Get path recommendation (exploit mode)");
  console.log("--------------------------------------------------------------------------------");
  
  try {
    const recommendRequest = {
      goal_text: "Fix authentication bug",
      exploration_rate: 0.0, // Force exploitation
      top_k: 3,
    };
    
    const response = await fetch(`${API_URL}/v2/activities/goal-paths/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recommendRequest),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error("Recommendation failed:", response.status, text);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Received ${data.recommended_paths.length} path recommendations`);
    
    if (data.recommended_paths.length === 0) {
      console.error("❌ No paths recommended");
      return false;
    }
    
    // In exploit mode, confidence should be based on Thompson sampling
    const firstPath = data.recommended_paths[0];
    console.log("  Top recommendation:", {
      path: firstPath.path_activities,
      confidence: firstPath.confidence,
      success_rate: firstPath.success_rate,
      executions: firstPath.total_executions,
    });
    
    if (firstPath.exploration_bonus !== undefined) {
      console.error("❌ Exploit mode should not have exploration_bonus");
      return false;
    }
    
    console.log("✅ Exploitation mode working correctly");
    console.log("✅ Test 4 PASSED");
    return true;
    
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Test 5: Get path recommendation (explore mode)
 */
async function test5_RecommendExplore(): Promise<boolean> {
  console.log("--------------------------------------------------------------------------------");
  console.log("Test 5: Get path recommendation (explore mode)");
  console.log("--------------------------------------------------------------------------------");
  
  try {
    const recommendRequest = {
      goal_text: "Refactor authentication module",
      exploration_rate: 1.0, // Force exploration
      top_k: 3,
    };
    
    const response = await fetch(`${API_URL}/v2/activities/goal-paths/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recommendRequest),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error("Recommendation failed:", response.status, text);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Received ${data.recommended_paths.length} path recommendations`);
    
    if (data.recommended_paths.length === 0) {
      console.error("❌ No paths recommended");
      return false;
    }
    
    // In explore mode, should recommend least-executed paths
    const firstPath = data.recommended_paths[0];
    console.log("  Top recommendation (explore):", {
      path: firstPath.path_activities,
      confidence: firstPath.confidence,
      success_rate: firstPath.success_rate,
      executions: firstPath.total_executions,
      exploration_bonus: firstPath.exploration_bonus,
    });
    
    if (firstPath.exploration_bonus === undefined) {
      console.error("❌ Explore mode should have exploration_bonus");
      return false;
    }
    
    if (firstPath.confidence !== 0.5) {
      console.error("❌ Explore mode should have neutral confidence=0.5, got", firstPath.confidence);
      return false;
    }
    
    // Verify paths sorted by executions (ascending)
    const executions = data.recommended_paths.map((p: any) => p.total_executions);
    const isSorted = executions.every((exec: number, i: number) => 
      i === 0 || exec >= executions[i-1]
    );
    
    if (!isSorted) {
      console.error("❌ Explore mode should recommend least-executed paths first");
      return false;
    }
    
    console.log("✅ Exploration mode working correctly");
    console.log("✅ Test 5 PASSED");
    return true;
    
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("Starting integration tests...");
  console.log();
  
  // Wait for API
  const apiReady = await waitForAPI();
  if (!apiReady) {
    console.error("Cannot proceed without API");
    process.exit(1);
  }
  
  console.log();
  
  // Run tests
  const results = {
    "Test 1: Record first path": await test1_RecordFirstPath(),
    "Test 2: Multiple executions": await test2_RecordMultipleExecutions(),
    "Test 3: Different paths, same goal": await test3_DifferentPathsSameGoal(),
    "Test 4: Recommend (exploit)": await test4_RecommendExploit(),
    "Test 5: Recommend (explore)": await test5_RecommendExplore(),
  };
  
  // Summary
  console.log();
  console.log("================================================================================");
  console.log("TEST SUMMARY");
  console.log("================================================================================");
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, result] of Object.entries(results)) {
    const status = result ? "✅ PASS" : "❌ FAIL";
    console.log(`${name}: ${status}`);
    if (result) passed++;
    else failed++;
  }
  
  console.log();
  console.log(`Total: ${passed}/${passed + failed} tests passed`);
  
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED!");
    process.exit(0);
  } else {
    console.log("⚠️  SOME TESTS FAILED");
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
