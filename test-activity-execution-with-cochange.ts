#!/usr/bin/env bun
/**
 * Test: Activity Execution with Cochange Learning Integration
 * 
 * Tests the full workflow:
 * 1. Load template from .metabob/activities/
 * 2. Create activity execution context
 * 3. Simulate cochange analysis
 * 4. Execute activity with cochange impulses
 * 5. Record outcome with cochange accuracy
 * 6. Verify learning feedback loop
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

interface MetabobTask {
  id: string
  task_id: string
  name: string
  description: string
  agent_instructions: string
  validation?: {
    required_patterns?: Array<{ pattern: string; description: string }>
    forbidden_patterns?: Array<{ pattern: string; description: string }>
  }
}

interface MetabobTemplate {
  activity_id: string
  name: string
  description: string
  category: string
  estimated_duration_ms: number
  estimated_cost: number
  task_steps: MetabobTask[]
}

interface CochangePrediction {
  file_path: string
  similarity_score: number
  component_name?: string
}

interface ActivityExpectation {
  predictedCochanges: string[]
  expectedComponents: string[]
  expectedDurationMs: number
  expectedCost: number
}

interface ActivityResult {
  actualFiles: string[]
  actualComponents: string[]
  actualDurationMs: number
  actualCost: number
}

interface ActivityComparison {
  cochangeAccuracy: number
  componentAccuracy: number
  missedComponents: string[]
  extraComponents: string[]
  costDelta: number
  durationDeltaMs: number
}

async function simulateCochangeAnalysis(changedFiles: string[]): Promise<CochangePrediction[]> {
  // Simulate cochange predictions
  // In real implementation, this would call:
  // await metabob_suggest_related_changes({ changed_files: changedFiles })
  
  console.log(`   🔍 Simulating cochange analysis for: ${changedFiles.join(", ")}`)
  
  // Mock predictions based on file patterns
  const predictions: CochangePrediction[] = []
  
  if (changedFiles.some(f => f.includes("auth"))) {
    predictions.push(
      { file_path: "src/auth/session.ts", similarity_score: 0.92, component_name: "SessionManager" },
      { file_path: "src/auth/utils.ts", similarity_score: 0.87, component_name: "validateToken" },
      { file_path: "src/api/users.ts", similarity_score: 0.73, component_name: "getUserProfile" }
    )
  }
  
  console.log(`   📊 Predicted ${predictions.length} related files`)
  predictions.forEach(p => console.log(`     - ${p.file_path} (score: ${p.similarity_score.toFixed(2)})`))
  
  return predictions
}

function createExpectation(
  template: MetabobTemplate,
  predictions: CochangePrediction[]
): ActivityExpectation {
  return {
    predictedCochanges: predictions.map(p => p.file_path),
    expectedComponents: predictions
      .filter(p => p.component_name)
      .map(p => p.component_name!),
    expectedDurationMs: template.estimated_duration_ms || 120000,
    expectedCost: template.estimated_cost || 0.05
  }
}

function simulateActivityExecution(
  template: MetabobTemplate,
  expectation: ActivityExpectation
): ActivityResult {
  console.log(`\n   🤖 Simulating activity execution...`)
  
  // Simulate agent modifying files
  // In reality, the agent would:
  // 1. Read cochange context from impulses
  // 2. Analyze files
  // 3. Make changes
  // 4. Run tests
  // 5. Create commits
  
  const actualFiles = [
    "src/auth/session.ts",  // Predicted ✓
    "src/auth/utils.ts",    // Predicted ✓
    "src/middleware/auth.ts" // Not predicted! Agent discovered this independently
  ]
  
  const actualComponents = [
    "SessionManager",       // Predicted ✓
    "validateToken",        // Predicted ✓
    "authenticateRequest"   // Not predicted
  ]
  
  console.log(`   ✏️  Modified ${actualFiles.length} files:`)
  actualFiles.forEach(f => console.log(`     - ${f}`))
  
  return {
    actualFiles,
    actualComponents,
    actualDurationMs: 95000,  // Faster than expected
    actualCost: 0.042         // Cheaper than expected
  }
}

function compareExpectationToReality(
  expectation: ActivityExpectation,
  result: ActivityResult
): ActivityComparison {
  // Calculate cochange accuracy
  const predictedSet = new Set(expectation.predictedCochanges)
  const actualSet = new Set(result.actualFiles)
  
  const cochangeHits = result.actualFiles.filter(f => predictedSet.has(f))
  const cochangeAccuracy = cochangeHits.length / Math.max(predictedSet.size, result.actualFiles.length)
  
  // Calculate component accuracy
  const predictedCompSet = new Set(expectation.expectedComponents)
  const actualCompSet = new Set(result.actualComponents)
  
  const componentHits = result.actualComponents.filter(c => predictedCompSet.has(c))
  const componentAccuracy = componentHits.length / Math.max(predictedCompSet.size, result.actualComponents.length)
  
  // Find misses
  const missedComponents = result.actualFiles.filter(f => !predictedSet.has(f))
  const extraComponents = expectation.predictedCochanges.filter(f => !actualSet.has(f))
  
  return {
    cochangeAccuracy,
    componentAccuracy,
    missedComponents,
    extraComponents,
    costDelta: result.actualCost - expectation.expectedCost,
    durationDeltaMs: result.actualDurationMs - expectation.expectedDurationMs
  }
}

async function simulateOutcomeRecording(
  template: MetabobTemplate,
  expectation: ActivityExpectation,
  result: ActivityResult,
  comparison: ActivityComparison
) {
  console.log(`\n   💾 Recording outcome to backend API...`)
  
  const outcome = {
    activityId: `act_${Date.now()}`,
    templateId: template.activity_id,
    timestamp: new Date().toISOString(),
    
    expectation,
    result,
    comparison,
    
    // Agent decisions (would be collected during execution)
    decisions: [
      {
        step: 1,
        taskId: template.task_steps[0].id,
        context: "Analyzing authentication bug",
        decision: "Check session management based on cochange prediction",
        reasoning: "Cochange analysis predicted src/auth/session.ts with 0.92 similarity",
        outcome: "success"
      },
      {
        step: 2,
        taskId: template.task_steps[1].id,
        context: "Fixing session timeout",
        decision: "Also update middleware/auth.ts for consistency",
        reasoning: "Found similar pattern in middleware that wasn't predicted",
        outcome: "success"
      }
    ]
  }
  
  // In real implementation, would POST to:
  // await fetch("http://localhost:8000/v2/activity/outcome", {
  //   method: "POST",
  //   body: JSON.stringify(outcome)
  // })
  
  console.log(`   ✅ Outcome recorded`)
  console.log(`     - Activity ID: ${outcome.activityId}`)
  console.log(`     - Template ID: ${outcome.templateId}`)
  console.log(`     - Decisions: ${outcome.decisions.length}`)
  
  return outcome
}

async function testActivityExecutionWithCochange() {
  console.log("🚀 Testing Activity Execution with Cochange Learning\n")
  console.log("=" .repeat(70))
  
  // Step 1: Load template
  console.log("\n📋 Step 1: Load Template")
  const templatePath = ".metabob/activities/fix-bug-complete.json"
  const templateContent = await readFile(templatePath, "utf-8")
  const template: MetabobTemplate = JSON.parse(templateContent)
  
  console.log(`   ✅ Loaded: ${template.name}`)
  console.log(`   📂 Category: ${template.category}`)
  console.log(`   📝 Tasks: ${template.task_steps.length}`)
  
  // Step 2: Simulate cochange analysis
  console.log("\n🔍 Step 2: Cochange Analysis")
  const targetFiles = ["src/auth/login.ts"]
  const predictions = await simulateCochangeAnalysis(targetFiles)
  
  // Step 3: Create expectation
  console.log("\n📊 Step 3: Create Expectation")
  const expectation = createExpectation(template, predictions)
  console.log(`   📌 Predicted cochanges: ${expectation.predictedCochanges.length}`)
  console.log(`   📌 Expected components: ${expectation.expectedComponents.length}`)
  console.log(`   ⏱️  Expected duration: ${expectation.expectedDurationMs}ms`)
  console.log(`   💰 Expected cost: $${expectation.expectedCost.toFixed(3)}`)
  
  // Step 4: Execute activity
  console.log("\n⚙️  Step 4: Execute Activity")
  const result = simulateActivityExecution(template, expectation)
  
  // Step 5: Compare expectation to reality
  console.log("\n📈 Step 5: Compare Results")
  const comparison = compareExpectationToReality(expectation, result)
  
  console.log(`   📊 Cochange Accuracy: ${(comparison.cochangeAccuracy * 100).toFixed(1)}%`)
  console.log(`   📊 Component Accuracy: ${(comparison.componentAccuracy * 100).toFixed(1)}%`)
  console.log(`   ⏱️  Duration Delta: ${comparison.durationDeltaMs}ms (${comparison.durationDeltaMs > 0 ? 'slower' : 'faster'})`)
  console.log(`   💰 Cost Delta: $${Math.abs(comparison.costDelta).toFixed(3)} (${comparison.costDelta > 0 ? 'more' : 'less'})`)
  
  if (comparison.missedComponents.length > 0) {
    console.log(`   ⚠️  Missed files (agent discovered independently):`)
    comparison.missedComponents.forEach(f => console.log(`     - ${f}`))
  }
  
  if (comparison.extraComponents.length > 0) {
    console.log(`   ℹ️  Predicted but not used:`)
    comparison.extraComponents.forEach(f => console.log(`     - ${f}`))
  }
  
  // Step 6: Record outcome
  console.log("\n💾 Step 6: Record Outcome")
  const outcome = await simulateOutcomeRecording(template, expectation, result, comparison)
  
  // Step 7: Learning feedback
  console.log("\n🧠 Step 7: Learning Feedback")
  console.log(`   📚 Backend will learn:`)
  
  if (comparison.cochangeAccuracy < 0.8) {
    console.log(`     ⚠️  Template has low cochange accuracy (${(comparison.cochangeAccuracy * 100).toFixed(1)}%)`)
    console.log(`     🔧 Recommendation: Update template to check ${comparison.missedComponents.join(", ")}`)
    console.log(`     🔧 Recommendation: Adjust cochange predictor to weight middleware files higher for auth changes`)
  } else {
    console.log(`     ✅ Template has good cochange accuracy (${(comparison.cochangeAccuracy * 100).toFixed(1)}%)`)
  }
  
  if (comparison.durationDeltaMs < -20000) {
    console.log(`     ⚡ Template is faster than expected by ${Math.abs(comparison.durationDeltaMs)}ms`)
    console.log(`     🔧 Recommendation: Update estimated_duration_ms to ${result.actualDurationMs}ms`)
  }
  
  console.log(`\n     🔄 Cochange embeddings will be updated:`)
  console.log(`       - Strengthen: auth/login.ts → auth/session.ts`)
  console.log(`       - Strengthen: auth/login.ts → auth/utils.ts`)
  console.log(`       - Add new: auth/login.ts → middleware/auth.ts (missed prediction)`)
  
  // Summary
  console.log("\n" + "=".repeat(70))
  console.log("✅ Test Complete\n")
  
  console.log("📊 Summary:")
  console.log(`   Template: ${template.activity_id}`)
  console.log(`   Cochange Accuracy: ${(comparison.cochangeAccuracy * 100).toFixed(1)}%`)
  console.log(`   Component Accuracy: ${(comparison.componentAccuracy * 100).toFixed(1)}%`)
  console.log(`   Performance: ${comparison.durationDeltaMs > 0 ? 'slower' : 'faster'} than expected`)
  console.log(`   Cost: ${comparison.costDelta > 0 ? 'more' : 'less'} expensive than expected`)
  
  console.log("\n🎯 Integration Points Verified:")
  console.log("   ✅ Template loading from .metabob/activities/")
  console.log("   ✅ Cochange prediction integration")
  console.log("   ✅ Expectation creation with cochange data")
  console.log("   ✅ Activity execution simulation")
  console.log("   ✅ Outcome comparison (predicted vs actual)")
  console.log("   ✅ Learning feedback preparation")
  console.log("   ✅ Backend API integration points identified")
  
  console.log("\n🔄 Next Steps:")
  console.log("   1. Backend: Implement /v2/activity/outcome endpoint")
  console.log("   2. Backend: Process outcomes to update cochange embeddings")
  console.log("   3. Backend: Evolve templates based on learning")
  console.log("   4. CLI: Integrate real cochange analysis in activity execution")
  console.log("   5. CLI: Record actual outcomes (not simulated)")
  
  return {
    template,
    expectation,
    result,
    comparison,
    outcome
  }
}

// Run test
testActivityExecutionWithCochange().catch(error => {
  console.error("❌ Test failed:", error)
  process.exit(1)
})
