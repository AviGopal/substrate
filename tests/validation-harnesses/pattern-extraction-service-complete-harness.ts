/**
 * Validation Harness for Pattern Extraction Service
 * 
 * Tests the pattern extraction service in metabob-rpc-api to ensure:
 * - File paths are correctly extracted from messages
 * - Components (functions, classes) are identified
 * - Common patterns (errors, refactoring) are detected
 * - Complexity indicators are calculated accurately
 * 
 * This is a PURE VALIDATION HARNESS - no LLM calls, just input/output verification.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Test Case Definitions
// ============================================================================

interface PatternData {
  file_paths: string[];
  components_modified: string[];
  common_patterns: string[];
  complexity_indicators: {
    files_touched_count: number;
    estimated_lines_changed: number;
    refactoring_depth: "simple" | "moderate" | "complex";
    task_type: string;
    components_modified_count: number;
  };
}

interface TestCase {
  id: string;
  description: string;
  input: {
    messages: string[];
  };
  expected: PatternData;
}

const TEST_CASES: TestCase[] = [
  // Test Case 1: Basic file path extraction
  {
    id: "validation-pattern-extraction-service-complete-case-1",
    description: "Extract file paths from simple messages",
    input: {
      messages: [
        "Fixed bug in src/auth.py",
        "Updated config.json and settings.yaml",
        "Modified ./utils/helper.ts",
      ],
    },
    expected: {
      file_paths: ["config.json", "settings.yaml", "src/auth.py", "utils/helper.ts"],
      components_modified: [],
      common_patterns: ["fix_bug"],
      complexity_indicators: {
        files_touched_count: 4,
        estimated_lines_changed: 15, // 1 fixed (3) + 2 updated (10) + 1 modified (5)
        refactoring_depth: "simple",
        task_type: "fix",
        components_modified_count: 0,
      },
    },
  },

  // Test Case 2: Component extraction (functions and classes)
  {
    id: "validation-pattern-extraction-service-complete-case-2",
    description: "Extract component names from code references",
    input: {
      messages: [
        "Implemented the authenticate function in auth.py",
        "Updated User class with new validation",
        "Refactored normalize_pattern method",
        "Added export function validateInput",
      ],
    },
    expected: {
      file_paths: ["auth.py"],
      components_modified: ["User", "authenticate", "normalize_pattern", "validateInput"],
      common_patterns: ["add_feature", "refactor"],
      complexity_indicators: {
        files_touched_count: 1,
        estimated_lines_changed: 45, // implemented (10) + updated (5) + refactored (20) + added (10)
        refactoring_depth: "moderate",
        task_type: "feature",
        components_modified_count: 4,
      },
    },
  },

  // Test Case 3: Error pattern detection
  {
    id: "validation-pattern-extraction-service-complete-case-3",
    description: "Identify error patterns and types",
    input: {
      messages: [
        "Fixed TypeError in user validation",
        "Resolved ImportError when loading config",
        "Fixed syntax error in parser.py",
        "Handled null reference in getData method",
      ],
    },
    expected: {
      file_paths: ["parser.py"],
      components_modified: ["getData"],
      common_patterns: [
        "fix_bug",
        "import_error",
        "null_error",
        "syntax_error",
        "type_error",
      ],
      complexity_indicators: {
        files_touched_count: 1,
        estimated_lines_changed: 12, // 4 fixed (4*3)
        refactoring_depth: "simple",
        task_type: "fix",
        components_modified_count: 1,
      },
    },
  },

  // Test Case 4: Refactoring patterns
  {
    id: "validation-pattern-extraction-service-complete-case-4",
    description: "Detect refactoring patterns and complexity",
    input: {
      messages: [
        "Extract method from long processData function",
        "Renamed confusing variable names",
        "Moved authentication logic to separate module auth/handler.py",
        "Refactored duplicate code in utils.py and helpers.py",
      ],
    },
    expected: {
      file_paths: ["auth/handler.py", "helpers.py", "utils.py"],
      components_modified: ["processData"],
      common_patterns: [
        "duplicate_code",
        "extract_method",
        "move",
        "refactor",
        "rename",
      ],
      complexity_indicators: {
        files_touched_count: 3,
        estimated_lines_changed: 70, // extract (10) + renamed (5) + moved (10) + refactored (20) + long method bonus
        refactoring_depth: "complex",
        task_type: "refactor",
        components_modified_count: 1,
      },
    },
  },

  // Test Case 5: Complex scenario with mixed patterns
  {
    id: "validation-pattern-extraction-service-complete-case-5",
    description: "Handle complex messages with multiple patterns",
    input: {
      messages: [
        "Implemented new feature in src/api/endpoints.py",
        "Added unit tests for UserService.validate() method",
        "Fixed security vulnerability in auth sanitization",
        "Updated documentation in README.md",
        "Optimized database query performance in models/user.py",
      ],
    },
    expected: {
      file_paths: ["README.md", "models/user.py", "src/api/endpoints.py"],
      components_modified: ["UserService.validate"],
      common_patterns: [
        "add_feature",
        "add_test",
        "fix_bug",
        "performance",
        "security",
        "update_docs",
      ],
      complexity_indicators: {
        files_touched_count: 3,
        estimated_lines_changed: 75, // implemented (10) + added (20) + fixed (3) + updated (10) + optimized (32)
        refactoring_depth: "moderate",
        task_type: "feature",
        components_modified_count: 1,
      },
    },
  },

  // Test Case 6: Edge case - empty messages
  {
    id: "validation-pattern-extraction-service-complete-case-6",
    description: "Handle empty input gracefully",
    input: {
      messages: [],
    },
    expected: {
      file_paths: [],
      components_modified: [],
      common_patterns: [],
      complexity_indicators: {
        files_touched_count: 0,
        estimated_lines_changed: 0,
        refactoring_depth: "simple",
        task_type: "unknown",
        components_modified_count: 0,
      },
    },
  },

  // Test Case 7: Quoted and markdown file paths
  {
    id: "validation-pattern-extraction-service-complete-case-7",
    description: "Extract file paths from quotes and markdown",
    input: {
      messages: [
        'Updated "src/config/settings.json" with new values',
        "Modified `api/routes.ts` endpoint handler",
        "Changed file path './data/cache.db' location",
      ],
    },
    expected: {
      file_paths: [
        "api/routes.ts",
        "data/cache.db",
        "src/config/settings.json",
      ],
      components_modified: [],
      common_patterns: [],
      complexity_indicators: {
        files_touched_count: 3,
        estimated_lines_changed: 15, // updated (5) + modified (5) + changed (5)
        refactoring_depth: "simple",
        task_type: "unknown",
        components_modified_count: 0,
      },
    },
  },

  // Test Case 8: Method calls and class references
  {
    id: "validation-pattern-extraction-service-complete-case-8",
    description: "Extract method calls and class.method patterns",
    input: {
      messages: [
        "Called User.save() to persist changes",
        "Invoked auth.login() for authentication",
        "Updated Database.connect method implementation",
        "Fixed SessionManager.cleanup() memory leak",
      ],
    },
    expected: {
      file_paths: [],
      components_modified: [
        "Database.connect",
        "SessionManager.cleanup",
        "User.save",
        "auth.login",
      ],
      common_patterns: ["fix_bug"],
      complexity_indicators: {
        files_touched_count: 0,
        estimated_lines_changed: 18, // called (5) + invoked (5) + updated (5) + fixed (3)
        refactoring_depth: "simple",
        task_type: "fix",
        components_modified_count: 4,
      },
    },
  },
];

// ============================================================================
// Validation Logic
// ============================================================================

interface ValidationResult {
  pass: boolean;
  testCase: string;
  description: string;
  actual: PatternData | null;
  expected: PatternData;
  errors: string[];
}

/**
 * Call Python pattern extraction service via subprocess
 */
async function callPatternExtractionService(
  messages: string[]
): Promise<PatternData> {
  const pythonScript = `
import sys
import json

# Add rpc-api to path
sys.path.insert(0, 'repos/metabob-rpc-api')

from server.services.pattern_extraction_service import extract_patterns

# Read messages from stdin
messages = json.loads(sys.argv[1])

# Extract patterns
result = extract_patterns(messages)

# Output as JSON
print(json.dumps(result.model_dump()))
`;

  const messagesJson = JSON.stringify(messages).replace(/"/g, '\\"');

  try {
    const { stdout, stderr } = await execAsync(
      `python3 -c "${pythonScript}" "${messagesJson}"`,
      {
        cwd: "/home/avi/documents/work/exp-repo/metabob-devbob",
        maxBuffer: 1024 * 1024 * 10, // 10MB
      }
    );

    if (stderr && stderr.trim().length > 0) {
      console.error("Python stderr:", stderr);
    }

    const result = JSON.parse(stdout);
    return result as PatternData;
  } catch (error: any) {
    console.error("Failed to call pattern extraction service:", error.message);
    if (error.stdout) console.error("stdout:", error.stdout);
    if (error.stderr) console.error("stderr:", error.stderr);
    throw error;
  }
}

/**
 * Compare two arrays (order-independent)
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Validate a single test case
 */
async function validateTestCase(testCase: TestCase): Promise<ValidationResult> {
  const errors: string[] = [];

  try {
    // Call the pattern extraction service
    const actual = await callPatternExtractionService(testCase.input.messages);

    // Compare file_paths
    if (!arraysEqual(actual.file_paths, testCase.expected.file_paths)) {
      errors.push(
        `file_paths mismatch: expected ${JSON.stringify(testCase.expected.file_paths)}, got ${JSON.stringify(actual.file_paths)}`
      );
    }

    // Compare components_modified
    if (
      !arraysEqual(
        actual.components_modified,
        testCase.expected.components_modified
      )
    ) {
      errors.push(
        `components_modified mismatch: expected ${JSON.stringify(testCase.expected.components_modified)}, got ${JSON.stringify(actual.components_modified)}`
      );
    }

    // Compare common_patterns
    if (!arraysEqual(actual.common_patterns, testCase.expected.common_patterns)) {
      errors.push(
        `common_patterns mismatch: expected ${JSON.stringify(testCase.expected.common_patterns)}, got ${JSON.stringify(actual.common_patterns)}`
      );
    }

    // Compare complexity indicators (with tolerance for estimated values)
    const complexityErrors = validateComplexity(
      actual.complexity_indicators,
      testCase.expected.complexity_indicators
    );
    errors.push(...complexityErrors);

    return {
      pass: errors.length === 0,
      testCase: testCase.id,
      description: testCase.description,
      actual,
      expected: testCase.expected,
      errors,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: testCase.id,
      description: testCase.description,
      actual: null,
      expected: testCase.expected,
      errors: [`Exception during validation: ${error.message}`],
    };
  }
}

/**
 * Validate complexity indicators (with tolerance)
 */
function validateComplexity(
  actual: PatternData["complexity_indicators"],
  expected: PatternData["complexity_indicators"]
): string[] {
  const errors: string[] = [];

  // files_touched_count (exact match)
  if (actual.files_touched_count !== expected.files_touched_count) {
    errors.push(
      `files_touched_count mismatch: expected ${expected.files_touched_count}, got ${actual.files_touched_count}`
    );
  }

  // estimated_lines_changed (allow 20% tolerance)
  const linesTolerance = Math.max(5, Math.floor(expected.estimated_lines_changed * 0.2));
  const linesDiff = Math.abs(
    actual.estimated_lines_changed - expected.estimated_lines_changed
  );
  if (linesDiff > linesTolerance) {
    errors.push(
      `estimated_lines_changed outside tolerance: expected ${expected.estimated_lines_changed} ±${linesTolerance}, got ${actual.estimated_lines_changed}`
    );
  }

  // refactoring_depth (exact match)
  if (actual.refactoring_depth !== expected.refactoring_depth) {
    errors.push(
      `refactoring_depth mismatch: expected ${expected.refactoring_depth}, got ${actual.refactoring_depth}`
    );
  }

  // task_type (exact match)
  if (actual.task_type !== expected.task_type) {
    errors.push(
      `task_type mismatch: expected ${expected.task_type}, got ${actual.task_type}`
    );
  }

  // components_modified_count (exact match)
  if (actual.components_modified_count !== expected.components_modified_count) {
    errors.push(
      `components_modified_count mismatch: expected ${expected.components_modified_count}, got ${actual.components_modified_count}`
    );
  }

  return errors;
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<{
  passed: number;
  failed: number;
  total: number;
  results: ValidationResult[];
}> {
  console.log("========================================");
  console.log("Pattern Extraction Service Validation");
  console.log("========================================\n");

  const results: ValidationResult[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`Running: ${testCase.description}...`);
    const result = await validateTestCase(testCase);
    results.push(result);

    if (result.pass) {
      console.log(`✓ PASS: ${testCase.id}\n`);
    } else {
      console.log(`✗ FAIL: ${testCase.id}`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
      console.log();
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log("========================================");
  console.log("Summary");
  console.log("========================================");
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  return {
    passed,
    failed,
    total: results.length,
    results,
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (import.meta.main) {
  runValidation()
    .then((summary) => {
      if (summary.failed > 0) {
        Deno.exit(1);
      }
    })
    .catch((error) => {
      console.error("Validation harness failed:", error);
      Deno.exit(1);
    });
}
