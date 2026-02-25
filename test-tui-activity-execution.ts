#!/usr/bin/env bun
/**
 * Test TUI Activity Execution Feature
 * 
 * Tests the new % prefix syntax for directly executing activities from TUI:
 * - Activity prefix parsing
 * - Fuzzy autocomplete search
 * - Variable inference via memory agent
 * 
 * Usage: bun run test-tui-activity-execution.ts
 */

import { ActivityAutocomplete } from "./repos/metabob-opencode/packages/opencode/src/session/activity-autocomplete"
import { ActivityPrefix } from "./repos/metabob-opencode/packages/opencode/src/session/activity-prefix"

console.log("=== TUI Activity Execution Test ===\n")

// Test 1: Activity Prefix Parsing
console.log("Test 1: Activity Prefix Parsing")
console.log("--------------------------------")

const testInputs = [
  "%add-feature-complete Add user authentication",
  "%fix-bug-complete Fix the login error",
  "%refactor-with-tests Clean up database code",
  "Regular message without prefix",
  "%hello-world-minimal",
]

for (const input of testInputs) {
  const parsed = ActivityPrefix.parse(input)
  console.log(`Input: "${input}"`)
  console.log(`  Type: ${parsed.type}`)
  if (parsed.type === "activity") {
    console.log(`  Template ID: ${parsed.templateId}`)
    console.log(`  Description: ${parsed.description}`)
  }
  console.log()
}

// Test 2: Fuzzy Autocomplete Search
console.log("\nTest 2: Fuzzy Autocomplete Search")
console.log("----------------------------------")

const searchQueries = [
  "add",
  "feature",
  "fix",
  "hello",
]

for (const query of searchQueries) {
  console.log(`Query: "${query}"`)
  const results = await ActivityAutocomplete.search({ query, limit: 3 })
  if (results.length === 0) {
    console.log("  No matches found")
  } else {
    for (const result of results) {
      console.log(`  [${result.score}] ${ActivityAutocomplete.formatForDisplay(result)}`)
    }
  }
  console.log()
}

// Test 3: Activity Validation
console.log("\nTest 3: Activity Validation")
console.log("---------------------------")

const validationTests = [
  { templateId: "hello-world-minimal", description: "Test hello world" },
  { templateId: "nonexistent-activity", description: "This should fail" },
  { templateId: "add-feat", description: "Partial match test" },
]

for (const test of validationTests) {
  const parsed = ActivityPrefix.parse(`%${test.templateId} ${test.description}`)
  if (parsed.type === "activity") {
    const validation = await ActivityPrefix.validate(parsed)
    console.log(`Template: "${test.templateId}"`)
    console.log(`  Valid: ${validation.valid}`)
    if (validation.message) {
      console.log(`  Message: ${validation.message}`)
    }
    if (validation.suggestions && validation.suggestions.length > 0) {
      console.log(`  Suggestions: ${validation.suggestions.slice(0, 3).join(", ")}`)
    }
    if (validation.templateId) {
      console.log(`  Resolved to: ${validation.templateId}`)
    }
    console.log()
  }
}

// Test 4: Memory Agent Formatting
console.log("\nTest 4: Memory Agent Formatting")
console.log("--------------------------------")

const activityCommand = ActivityPrefix.parse("%add-feature-complete Add user profile endpoint")
if (activityCommand.type === "activity") {
  const formatted = ActivityPrefix.formatForMemoryAgent(activityCommand)
  console.log("Formatted for Memory Agent:")
  console.log(formatted)
}

console.log("\n=== All Tests Complete ===")
