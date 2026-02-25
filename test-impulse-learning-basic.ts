#!/usr/bin/env bun

/**
 * Basic test for impulse learning data capture
 * Verifies that the core module loads and functions work
 */

import { ImpulseLearning } from "./repos/metabob-opencode/packages/opencode/src/session/impulse-learning"

console.log("Testing impulse learning module...")

// Test 1: Initialize turn buffer
console.log("\n1. Testing initializeTurnBuffer()")
try {
  ImpulseLearning.initializeTurnBuffer({
    sessionID: "test_session_123",
    turnNumber: 1,
    userMessage: "Fix the bug in src/auth.ts",
  })
  console.log("✓ initializeTurnBuffer() works")
} catch (error) {
  console.error("✗ initializeTurnBuffer() failed:", error)
  process.exit(1)
}

// Test 2: Capture intent
console.log("\n2. Testing captureIntent()")
try {
  ImpulseLearning.captureIntent({
    sessionID: "test_session_123",
    intent: {
      type: "code_fix",
      confidence: 0.92,
      reasoning: "User reports bug in specific file",
      suggestedImpulses: [
        {
          id: "errorFile",
          type: "file",
          description: "File with bug",
          priority: "high",
          budget: 2000,
          pointer: {
            type: "file",
            path: "src/auth.ts",
          },
        },
      ],
    },
  })
  console.log("✓ captureIntent() works")
} catch (error) {
  console.error("✗ captureIntent() failed:", error)
  process.exit(1)
}

// Test 3: Capture impulses created
console.log("\n3. Testing captureImpulsesCreated()")
try {
  ImpulseLearning.captureImpulsesCreated({
    sessionID: "test_session_123",
    impulses: [
      {
        id: "errorFile",
        type: "file",
        pointer: { type: "file", path: "src/auth.ts" },
        priority: "high",
        budget: 2000,
      },
    ],
  })
  console.log("✓ captureImpulsesCreated() works")
} catch (error) {
  console.error("✗ captureImpulsesCreated() failed:", error)
  process.exit(1)
}

// Test 4: Capture response
console.log("\n4. Testing captureResponse()")
try {
  ImpulseLearning.captureResponse({
    sessionID: "test_session_123",
    responseText: "I've fixed the bug in src/auth.ts by adding null check.",
    impulses: {
      errorFile: {
        id: "errorFile",
        type: "file",
        pointer: { type: "file", path: "src/auth.ts" },
        priority: "high",
        budget: 2000,
        loaded: true,
        content: "function authenticate(user) {\n  if (!user) return null;\n  return user.id;\n}",
      },
    },
  })
  console.log("✓ captureResponse() works")
} catch (error) {
  console.error("✗ captureResponse() failed:", error)
  process.exit(1)
}

// Test 5: Capture outcome
console.log("\n5. Testing captureOutcome()")
try {
  ImpulseLearning.captureOutcome({
    sessionID: "test_session_123",
    succeeded: true,
    duration: 4567,
  })
  console.log("✓ captureOutcome() works")
} catch (error) {
  console.error("✗ captureOutcome() failed:", error)
  process.exit(1)
}

// Test 6: Flush to database (this will write to storage)
console.log("\n6. Testing flushToDatabase()")
try {
  await ImpulseLearning.flushToDatabase("test_session_123")
  console.log("✓ flushToDatabase() works")
} catch (error) {
  console.error("✗ flushToDatabase() failed:", error)
  process.exit(1)
}

console.log("\n✅ All tests passed!")
console.log("\nCheck storage:")
console.log("  ls -la ~/.local/share/opencode/storage/learning/impulse-mappings/")
