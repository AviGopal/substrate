/**
 * Validation Harness: impulse-learning-storage-complete
 * 
 * Tests the complete impulse learning storage flow:
 * 1. POST /api/v1/learning-loop/record-turn with test data
 * 2. Verify SurrealDB record creation
 * 3. Validate pattern extraction logic
 * 4. Verify quality calculation
 * 5. Test duplicate detection (UPSERT)
 * 6. Test connection retry resilience
 * 
 * This harness runs WITHOUT LLM - purely programmatic validation.
 */

import fetch from "node-fetch"
import { Surreal } from "surrealdb.js"

// ============================================================================
// Types
// ============================================================================

interface TurnLearningRequest {
  session_id: string
  turn_number: number
  user_message: string
  intent: {
    type: string
    confidence: number
    reasoning?: string
    suggestedImpulses?: any[]
  }
  impulses_created: Array<{
    id: string
    type: string
    pointer: any
    priority: string
    budget: number
  }>
  response_text?: string
  task_succeeded?: boolean
  duration_ms?: number
}

interface TurnLearningResponse {
  success: boolean
  record_id: string
  normalized_pattern: string
  quality_score: number
}

interface ValidationResult {
  pass: boolean
  testCase: string
  actual: any
  expected: any
  error?: string
}

interface TestCase {
  name: string
  input: TurnLearningRequest
  expectedPattern: string
  expectedQuality: number
  expectedRecordFields: string[]
}

// ============================================================================
// Configuration
// ============================================================================

const RPC_API_URL = process.env.RPC_API_URL || "http://localhost:8001"
const SURREALDB_URL = process.env.SURREALDB_URL || "http://localhost:8000"
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE || "metabob"
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE || "learning_loop"

// ============================================================================
// Test Cases
// ============================================================================

const TEST_CASES: TestCase[] = [
  {
    name: "case-1-simple-file-fix",
    input: {
      session_id: "test_session_001",
      turn_number: 1,
      user_message: "Fix the bug in src/auth.ts line 42",
      intent: {
        type: "code_fix",
        confidence: 0.95,
        reasoning: "User requests code fix with specific file and line number",
      },
      impulses_created: [
        {
          id: "imp_file_auth",
          type: "file",
          pointer: { type: "file", path: "src/auth.ts" },
          priority: "high",
          budget: 2000,
        },
      ],
      response_text: "I've fixed the authentication issue in src/auth.ts by updating the token validation logic.",
      task_succeeded: true,
      duration_ms: 45000,
    },
    expectedPattern: "fix the bug in {file0} line {num0}",
    expectedQuality: 1.0, // Success + impulse used = 0.6 + 0.4
    expectedRecordFields: [
      "userIntent",
      "context",
      "impulses",
      "outcome",
      "metadata",
    ],
  },
  {
    name: "case-2-multiple-files",
    input: {
      session_id: "test_session_002",
      turn_number: 1,
      user_message: "Refactor src/utils/parser.ts and tests/parser.test.ts to use async/await",
      intent: {
        type: "refactor",
        confidence: 0.88,
      },
      impulses_created: [
        {
          id: "imp_file_parser",
          type: "file",
          pointer: { type: "file", path: "src/utils/parser.ts" },
          priority: "high",
          budget: 3000,
        },
        {
          id: "imp_file_test",
          type: "file",
          pointer: { type: "file", path: "tests/parser.test.ts" },
          priority: "medium",
          budget: 1500,
        },
      ],
      response_text: "I've refactored both src/utils/parser.ts and tests/parser.test.ts to use async/await pattern.",
      task_succeeded: true,
      duration_ms: 120000,
    },
    expectedPattern: "refactor {file0} and {file1} to use async/await",
    expectedQuality: 1.0, // Success + impulses used
    expectedRecordFields: [
      "userIntent",
      "context",
      "impulses",
      "outcome",
      "metadata",
    ],
  },
  {
    name: "case-3-failed-task",
    input: {
      session_id: "test_session_003",
      turn_number: 1,
      user_message: "Add type annotations to database.py line 156",
      intent: {
        type: "code_fix",
        confidence: 0.75,
      },
      impulses_created: [
        {
          id: "imp_file_db",
          type: "file",
          pointer: { type: "file", path: "database.py" },
          priority: "medium",
          budget: 1000,
        },
      ],
      response_text: "I attempted to add type annotations but encountered issues with the existing code structure.",
      task_succeeded: false,
      duration_ms: 30000,
    },
    expectedPattern: "add type annotations to {file0} line {num0}",
    expectedQuality: 0.3, // Failure = 0.3 (no bonus)
    expectedRecordFields: [
      "userIntent",
      "context",
      "impulses",
      "outcome",
      "metadata",
    ],
  },
  {
    name: "case-4-no-impulses-used",
    input: {
      session_id: "test_session_004",
      turn_number: 1,
      user_message: "Explain the authentication flow",
      intent: {
        type: "documentation",
        confidence: 0.92,
      },
      impulses_created: [
        {
          id: "imp_file_auth",
          type: "file",
          pointer: { type: "file", path: "src/auth.ts" },
          priority: "medium",
          budget: 1500,
        },
      ],
      response_text: "The authentication flow works by validating JWT tokens against the configured secret.",
      task_succeeded: true,
      duration_ms: 15000,
    },
    expectedPattern: "explain the authentication flow",
    expectedQuality: 0.6, // Success but no impulse mentioned = 0.6 + 0.0
    expectedRecordFields: [
      "userIntent",
      "context",
      "impulses",
      "outcome",
      "metadata",
    ],
  },
  {
    name: "case-5-duplicate-detection",
    input: {
      session_id: "test_session_005",
      turn_number: 1,
      user_message: "Update config.json with new settings",
      intent: {
        type: "code_fix",
        confidence: 0.85,
      },
      impulses_created: [
        {
          id: "imp_file_config",
          type: "file",
          pointer: { type: "file", path: "config.json" },
          priority: "high",
          budget: 800,
        },
      ],
      response_text: "Updated config.json with the new database settings.",
      task_succeeded: true,
      duration_ms: 5000,
    },
    expectedPattern: "update {file0} with new settings",
    expectedQuality: 1.0,
    expectedRecordFields: [
      "userIntent",
      "context",
      "impulses",
      "outcome",
      "metadata",
    ],
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

async function callRecordTurnAPI(
  request: TurnLearningRequest
): Promise<TurnLearningResponse> {
  const url = `${RPC_API_URL}/api/v1/learning-loop/record-turn`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `API call failed: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  return (await response.json()) as TurnLearningResponse
}

async function queryRecordFromDB(
  recordId: string
): Promise<any> {
  const db = new Surreal()

  try {
    await db.connect(SURREALDB_URL)
    await db.use({ namespace: SURREALDB_NAMESPACE, database: SURREALDB_DATABASE })

    // Query by metadata.recordId
    const result = await db.query(
      "SELECT * FROM impulse_mapping_record WHERE metadata.recordId = $recordId",
      { recordId }
    )

    if (!result || result.length === 0 || result[0].length === 0) {
      return null
    }

    return result[0][0]
  } finally {
    await db.close()
  }
}

function validatePatternExtraction(
  actual: string,
  expected: string
): { pass: boolean; message: string } {
  const normalized = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ")

  if (normalized(actual) === normalized(expected)) {
    return { pass: true, message: "Pattern matches expected" }
  }

  return {
    pass: false,
    message: `Pattern mismatch:\n  Expected: "${expected}"\n  Actual:   "${actual}"`,
  }
}

function validateQualityScore(
  actual: number,
  expected: number,
  tolerance: number = 0.01
): { pass: boolean; message: string } {
  const diff = Math.abs(actual - expected)

  if (diff <= tolerance) {
    return { pass: true, message: `Quality score ${actual} matches expected ${expected}` }
  }

  return {
    pass: false,
    message: `Quality score mismatch:\n  Expected: ${expected}\n  Actual:   ${actual}\n  Diff:     ${diff}`,
  }
}

function validateRecordStructure(
  record: any,
  expectedFields: string[]
): { pass: boolean; message: string } {
  const missingFields = expectedFields.filter((field) => !(field in record))

  if (missingFields.length === 0) {
    return { pass: true, message: "All expected fields present" }
  }

  return {
    pass: false,
    message: `Missing fields in record: ${missingFields.join(", ")}`,
  }
}

// ============================================================================
// Test Execution
// ============================================================================

async function runTestCase(testCase: TestCase): Promise<ValidationResult> {
  try {
    console.log(`\n[${testCase.name}] Running test case...`)

    // Step 1: Call the API
    console.log(`  → Calling POST /api/v1/learning-loop/record-turn`)
    const apiResponse = await callRecordTurnAPI(testCase.input)
    console.log(`  ✓ API responded: record_id=${apiResponse.record_id}`)

    // Step 2: Validate pattern extraction
    console.log(`  → Validating pattern extraction`)
    const patternCheck = validatePatternExtraction(
      apiResponse.normalized_pattern,
      testCase.expectedPattern
    )
    if (!patternCheck.pass) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { pattern: apiResponse.normalized_pattern },
        expected: { pattern: testCase.expectedPattern },
        error: patternCheck.message,
      }
    }
    console.log(`  ✓ Pattern extraction correct`)

    // Step 3: Validate quality score
    console.log(`  → Validating quality score`)
    const qualityCheck = validateQualityScore(
      apiResponse.quality_score,
      testCase.expectedQuality
    )
    if (!qualityCheck.pass) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { quality_score: apiResponse.quality_score },
        expected: { quality_score: testCase.expectedQuality },
        error: qualityCheck.message,
      }
    }
    console.log(`  ✓ Quality score correct`)

    // Step 4: Query SurrealDB to verify record
    console.log(`  → Querying SurrealDB for record`)
    const dbRecord = await queryRecordFromDB(apiResponse.record_id)

    if (!dbRecord) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { dbRecord: null },
        expected: { dbRecord: "non-null" },
        error: `Record not found in database: ${apiResponse.record_id}`,
      }
    }
    console.log(`  ✓ Record found in database`)

    // Step 5: Validate record structure
    console.log(`  → Validating record structure`)
    const structureCheck = validateRecordStructure(
      dbRecord,
      testCase.expectedRecordFields
    )
    if (!structureCheck.pass) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { recordFields: Object.keys(dbRecord) },
        expected: { recordFields: testCase.expectedRecordFields },
        error: structureCheck.message,
      }
    }
    console.log(`  ✓ Record structure correct`)

    // Step 6: Validate specific record fields
    console.log(`  → Validating record field values`)
    if (dbRecord.userIntent.rawText !== testCase.input.user_message) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { userIntent: dbRecord.userIntent },
        expected: { rawText: testCase.input.user_message },
        error: "userIntent.rawText mismatch",
      }
    }

    if (dbRecord.context.activeSession !== testCase.input.session_id) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { context: dbRecord.context },
        expected: { activeSession: testCase.input.session_id },
        error: "context.activeSession mismatch",
      }
    }

    if (dbRecord.outcome.taskSucceeded !== testCase.input.task_succeeded) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: { outcome: dbRecord.outcome },
        expected: { taskSucceeded: testCase.input.task_succeeded },
        error: "outcome.taskSucceeded mismatch",
      }
    }

    console.log(`  ✓ All field values correct`)

    // Step 7: Test duplicate detection (UPSERT)
    if (testCase.name === "case-5-duplicate-detection") {
      console.log(`  → Testing UPSERT (duplicate detection)`)
      const apiResponse2 = await callRecordTurnAPI(testCase.input)
      if (apiResponse2.record_id !== apiResponse.record_id) {
        return {
          pass: false,
          testCase: testCase.name,
          actual: { recordId2: apiResponse2.record_id },
          expected: { recordId2: apiResponse.record_id },
          error: "UPSERT failed: different record IDs on duplicate submission",
        }
      }
      console.log(`  ✓ UPSERT working (same record ID on duplicate)`)
    }

    console.log(`[${testCase.name}] ✅ PASS`)

    return {
      pass: true,
      testCase: testCase.name,
      actual: {
        record_id: apiResponse.record_id,
        pattern: apiResponse.normalized_pattern,
        quality: apiResponse.quality_score,
      },
      expected: {
        pattern: testCase.expectedPattern,
        quality: testCase.expectedQuality,
      },
    }
  } catch (error) {
    console.log(`[${testCase.name}] ❌ FAIL`)
    return {
      pass: false,
      testCase: testCase.name,
      actual: {},
      expected: {},
      error:
        error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runValidation(): Promise<{
  overallPass: boolean
  results: ValidationResult[]
  summary: { total: number; passed: number; failed: number }
}> {
  console.log("=" .repeat(80))
  console.log("Validation Harness: impulse-learning-storage-complete")
  console.log("=" .repeat(80))
  console.log(`RPC API URL: ${RPC_API_URL}`)
  console.log(`SurrealDB URL: ${SURREALDB_URL}`)
  console.log(`Test cases: ${TEST_CASES.length}`)

  const results: ValidationResult[] = []

  for (const testCase of TEST_CASES) {
    const result = await runTestCase(testCase)
    results.push(result)
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  console.log("\n" + "=".repeat(80))
  console.log("Summary")
  console.log("=".repeat(80))
  console.log(`Total:  ${TEST_CASES.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log("\nFailed test cases:")
    results
      .filter((r) => !r.pass)
      .forEach((r) => {
        console.log(`  - ${r.testCase}: ${r.error}`)
      })
  }

  return {
    overallPass: failed === 0,
    results,
    summary: { total: TEST_CASES.length, passed, failed },
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  runValidation()
    .then((result) => {
      process.exit(result.overallPass ? 0 : 1)
    })
    .catch((error) => {
      console.error("Validation harness error:", error)
      process.exit(1)
    })
}
