#!/usr/bin/env bun

// Simple validation script for test case 2
import { Activity } from "./repos/metabob-opencode/packages/opencode/src/session/activity"

async function validateCase2() {
  const activityId = "act_mmlph9ig_38038a63a4c5760c"
  
  console.log("Running Non-Trailblazing Session Tracking Validation")
  console.log("Test Case 2: Broken Activity (Before Fix)")
  console.log(`Activity ID: ${activityId}\n`)
  
  try {
    // Load activity from storage
    const activity = await Activity.load(activityId)
    
    // Extract data
    const sessionsSpawned = activity.executionEvidence?.sessionsSpawned || []
    const sessionsSpawnedCount = sessionsSpawned.length
    const correctnessVerdict = activity.correctnessVerdict || { verdict: 'unknown', confidence: 0 }
    
    console.log("=== ACTUAL RESULTS ===")
    console.log(`Status: ${activity.status}`)
    console.log(`Sessions Tracked: ${sessionsSpawnedCount}`)
    console.log(`Correctness Verdict: ${correctnessVerdict.verdict} (${correctnessVerdict.confidence})`)
    
    console.log("\n=== EXPECTED RESULTS ===")
    console.log(`Sessions Tracked: 0 (broken state before fix)`)
    console.log(`Correctness Verdict: incorrect`)
    
    console.log("\n=== VALIDATION ===")
    const pass = sessionsSpawnedCount === 0 && correctnessVerdict.verdict === 'incorrect'
    console.log(`Result: ${pass ? '✅ PASS' : '❌ FAIL'}`)
    
    if (pass) {
      console.log("\nThis confirms the broken state before the fix was applied.")
      console.log("Expected behavior: 0 sessions tracked (deterministic path missing tracking code)")
    }
    
    return {
      pass,
      actual: {
        sessionsSpawnedCount,
        correctnessVerdict: correctnessVerdict.verdict
      },
      expected: {
        sessionsSpawnedCount: 0,
        correctnessVerdict: 'incorrect'
      }
    }
  } catch (error) {
    console.error(`Error: ${error}`)
    return {
      pass: false,
      error: String(error)
    }
  }
}

validateCase2().then(result => {
  process.exit(result.pass ? 0 : 1)
})
