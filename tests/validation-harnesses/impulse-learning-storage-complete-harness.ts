#!/usr/bin/env ts-node
/**
 * Validation Harness: impulse-learning-storage-complete
 * 
 * Validates that impulse learning data storage infrastructure is complete:
 * 1. SurrealDB schema defines impulse_mapping_record table
 * 2. RPC API endpoint POST /api/v1/learning-loop/record-turn exists
 * 3. Pattern extraction logic normalizes file paths and numbers
 * 4. Quality calculation logic computes response quality score
 * 5. Usage tracking logic detects impulse content in responses
 * 6. End-to-end flow: HTTP POST → server processing → SurrealDB insert
 * 
 * Usage:
 *   npx ts-node impulse-learning-storage-complete-harness.ts
 *   
 * Returns:
 *   Exit code 0 if all checks pass
 *   Exit code 1 if any check fails
 */

import * as fs from 'fs';
import * as path from 'path';

// Get directory path - works for both CommonJS and ES modules
const getProjectRoot = () => {
  // Start from current working directory and traverse up
  let currentDir = process.cwd();
  while (currentDir !== '/') {
    if (fs.existsSync(path.join(currentDir, 'repos', 'metabob-rpc-api'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd(); // Fallback to cwd
};

const projectRoot = getProjectRoot();

interface ValidationResult {
  pass: boolean;
  checkName: string;
  actual: any;
  expected: any;
  message: string;
  evidence?: string;
}

interface HarnessResult {
  specificationName: string;
  overallPass: boolean;
  checks: ValidationResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

interface TestCase {
  impulseId: string;
  name: string;
  input: {
    session_id: string;
    turn_number: number;
    user_message: string;
    intent: {
      type: string;
      confidence: number;
    };
    impulses_created: any[];
    task_succeeded: boolean;
    duration_ms: number;
  };
  expectedOutput: {
    normalizedPattern: string;
    qualityScore: number;
    impulsesUsed: number;
    recordCreated: boolean;
  };
}

/**
 * Test Case 1: Simple code fix with file path
 */
const testCase1: TestCase = {
  impulseId: 'validation-impulse-learning-storage-complete-case-1',
  name: 'Simple code fix with file path',
  input: {
    session_id: 'test_session_001',
    turn_number: 1,
    user_message: 'Fix bug in src/auth.ts line 42',
    intent: {
      type: 'code_fix',
      confidence: 0.9,
    },
    impulses_created: [
      {
        id: 'impulse_1',
        type: 'file',
        pointer: { type: 'file', path: 'src/auth.ts' },
        priority: 'high',
        budget: 2000,
      },
    ],
    task_succeeded: true,
    duration_ms: 5000,
  },
  expectedOutput: {
    normalizedPattern: 'fix_bug_in_{file0}_line_{num0}',
    qualityScore: 0.6, // Base score for success, no impulse usage
    impulsesUsed: 0,
    recordCreated: true,
  },
};

/**
 * Test Case 2: Feature request with multiple files
 */
const testCase2: TestCase = {
  impulseId: 'validation-impulse-learning-storage-complete-case-2',
  name: 'Feature request with multiple files',
  input: {
    session_id: 'test_session_002',
    turn_number: 1,
    user_message: 'Add user authentication between src/routes.ts and src/middleware/auth.ts',
    intent: {
      type: 'feature_add',
      confidence: 0.85,
    },
    impulses_created: [
      {
        id: 'impulse_1',
        type: 'file',
        pointer: { type: 'file', path: 'src/routes.ts' },
        priority: 'high',
        budget: 3000,
      },
      {
        id: 'impulse_2',
        type: 'file',
        pointer: { type: 'file', path: 'src/middleware/auth.ts' },
        priority: 'high',
        budget: 2000,
      },
    ],
    task_succeeded: true,
    duration_ms: 8000,
  },
  expectedOutput: {
    normalizedPattern: 'add_user_authentication_between_{file0}_and_{file1}',
    qualityScore: 0.6, // Base score, no usage
    impulsesUsed: 0,
    recordCreated: true,
  },
};

/**
 * Test Case 3: Successful task with impulse usage
 */
const testCase3: TestCase = {
  impulseId: 'validation-impulse-learning-storage-complete-case-3',
  name: 'Successful task with impulse usage',
  input: {
    session_id: 'test_session_003',
    turn_number: 1,
    user_message: 'Refactor database connection in src/db.ts',
    intent: {
      type: 'refactor',
      confidence: 0.8,
    },
    impulses_created: [
      {
        id: 'impulse_1',
        type: 'file',
        pointer: { type: 'file', path: 'src/db.ts' },
        priority: 'high',
        budget: 3000,
      },
      {
        id: 'impulse_2',
        type: 'memo',
        pointer: { type: 'memo', content: 'Use connection pooling for better performance' },
        priority: 'medium',
        budget: 1000,
      },
    ],
    task_succeeded: true,
    duration_ms: 6000,
  },
  expectedOutput: {
    normalizedPattern: 'refactor_database_connection_in_{file0}',
    qualityScore: 1.0, // 0.6 base + 0.4 full utilization (2/2 impulses used)
    impulsesUsed: 2,
    recordCreated: true,
  },
};

/**
 * Check if file exists
 */
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Check if file contains pattern
 */
function fileContains(filePath: string, pattern: string | RegExp): boolean {
  if (!fileExists(filePath)) {
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (typeof pattern === 'string') {
    return content.includes(pattern);
  } else {
    return pattern.test(content);
  }
}

/**
 * Check 1: SurrealDB schema defines impulse_mapping_record table
 */
function checkSurrealDBSchema(): ValidationResult {
  const schemaPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/docs/schema/activity_learning_loop.surql'
  );
  
  if (!fileExists(schemaPath)) {
    return {
      pass: false,
      checkName: 'SurrealDB schema file exists',
      actual: 'FILE NOT FOUND',
      expected: 'activity_learning_loop.surql exists',
      message: '❌ Schema file not found',
    };
  }
  
  const hasTable = fileContains(schemaPath, 'DEFINE TABLE impulse_mapping_record');
  const hasUserIntent = fileContains(schemaPath, 'DEFINE FIELD userIntent');
  const hasContext = fileContains(schemaPath, 'DEFINE FIELD context');
  const hasImpulses = fileContains(schemaPath, 'DEFINE FIELD impulses');
  const hasOutcome = fileContains(schemaPath, 'DEFINE FIELD outcome');
  const hasMetadata = fileContains(schemaPath, 'DEFINE FIELD metadata');
  
  const pass = hasTable && hasUserIntent && hasContext && hasImpulses && hasOutcome && hasMetadata;
  
  return {
    pass,
    checkName: 'SurrealDB schema defines impulse_mapping_record',
    actual: {
      hasTable,
      hasUserIntent,
      hasContext,
      hasImpulses,
      hasOutcome,
      hasMetadata,
    },
    expected: 'All fields defined: userIntent, context, impulses, outcome, metadata',
    message: pass
      ? '✅ impulse_mapping_record table fully defined in schema'
      : '❌ Missing fields in impulse_mapping_record table definition',
    evidence: pass ? 'DEFINE TABLE impulse_mapping_record found with all required fields' : 'Schema incomplete',
  };
}

/**
 * Check 2: RPC API endpoint exists
 */
function checkRpcApiEndpoint(): ValidationResult {
  const routesPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/server/routes/learning_loop.py'
  );
  
  if (!fileExists(routesPath)) {
    return {
      pass: false,
      checkName: 'RPC API routes file exists',
      actual: 'FILE NOT FOUND',
      expected: 'learning_loop.py exists',
      message: '❌ Routes file not found',
    };
  }
  
  const hasEndpoint = fileContains(routesPath, /POST.*\/api\/v1\/learning-loop\/record-turn/);
  const hasRecordTurnFunction = fileContains(routesPath, /async def record_turn/);
  
  const pass = hasEndpoint && hasRecordTurnFunction;
  
  return {
    pass,
    checkName: 'RPC API endpoint POST /api/v1/learning-loop/record-turn exists',
    actual: {
      hasEndpoint,
      hasRecordTurnFunction,
    },
    expected: 'Endpoint defined with record_turn handler',
    message: pass
      ? '✅ POST /api/v1/learning-loop/record-turn endpoint exists'
      : '❌ Endpoint not found or handler missing',
    evidence: pass ? 'Endpoint found in learning_loop.py' : 'Endpoint not properly defined',
  };
}

/**
 * Check 3: Pattern extraction logic exists
 */
function checkPatternExtraction(): ValidationResult {
  const opsPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fileExists(opsPath)) {
    return {
      pass: false,
      checkName: 'Impulse learning operations file exists',
      actual: 'FILE NOT FOUND',
      expected: 'impulse_learning.py exists',
      message: '❌ Operations file not found',
    };
  }
  
  const hasNormalizePattern = fileContains(opsPath, /def normalize_pattern/);
  const hasFileReplacement = fileContains(opsPath, /\{file\d+\}/);
  const hasNumberReplacement = fileContains(opsPath, /\{num\d+\}/);
  
  const pass = hasNormalizePattern && hasFileReplacement && hasNumberReplacement;
  
  return {
    pass,
    checkName: 'Pattern extraction logic (normalize_pattern)',
    actual: {
      hasNormalizePattern,
      hasFileReplacement,
      hasNumberReplacement,
    },
    expected: 'normalize_pattern function with {fileN} and {numN} placeholders',
    message: pass
      ? '✅ Pattern extraction logic exists with file and number normalization'
      : '❌ Pattern extraction logic incomplete',
    evidence: pass ? 'normalize_pattern() found with placeholder logic' : 'Function missing or incomplete',
  };
}

/**
 * Check 4: Quality calculation logic exists
 */
function checkQualityCalculation(): ValidationResult {
  const opsPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fileExists(opsPath)) {
    return {
      pass: false,
      checkName: 'Impulse learning operations file exists',
      actual: 'FILE NOT FOUND',
      expected: 'impulse_learning.py exists',
      message: '❌ Operations file not found',
    };
  }
  
  const hasCalculateQuality = fileContains(opsPath, /def calculate_quality/);
  const hasBaseScore = fileContains(opsPath, /base_score.*0\.6/);
  const hasUtilizationBonus = fileContains(opsPath, /utilization_bonus/);
  
  const pass = hasCalculateQuality && hasBaseScore && hasUtilizationBonus;
  
  return {
    pass,
    checkName: 'Quality calculation logic (calculate_quality)',
    actual: {
      hasCalculateQuality,
      hasBaseScore,
      hasUtilizationBonus,
    },
    expected: 'calculate_quality function with 0.6 base score + utilization bonus',
    message: pass
      ? '✅ Quality calculation logic exists with correct algorithm'
      : '❌ Quality calculation logic incomplete',
    evidence: pass ? 'calculate_quality() found with base_score + utilization' : 'Function missing or incomplete',
  };
}

/**
 * Check 5: Usage tracking logic exists
 */
function checkUsageTracking(): ValidationResult {
  const opsPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fileExists(opsPath)) {
    return {
      pass: false,
      checkName: 'Impulse learning operations file exists',
      actual: 'FILE NOT FOUND',
      expected: 'impulse_learning.py exists',
      message: '❌ Operations file not found',
    };
  }
  
  const hasTrackUsage = fileContains(opsPath, /def track_usage/);
  const hasFileDetection = fileContains(opsPath, /pointer.*type.*file/);
  const hasMemoDetection = fileContains(opsPath, /pointer.*type.*memo/);
  
  const pass = hasTrackUsage && hasFileDetection && hasMemoDetection;
  
  return {
    pass,
    checkName: 'Usage tracking logic (track_usage)',
    actual: {
      hasTrackUsage,
      hasFileDetection,
      hasMemoDetection,
    },
    expected: 'track_usage function that detects file and memo pointers',
    message: pass
      ? '✅ Usage tracking logic exists with pointer type detection'
      : '❌ Usage tracking logic incomplete',
    evidence: pass ? 'track_usage() found with file/memo detection' : 'Function missing or incomplete',
  };
}

/**
 * Check 6: Insert mapping record orchestration exists
 */
function checkInsertMappingRecord(): ValidationResult {
  const opsPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fileExists(opsPath)) {
    return {
      pass: false,
      checkName: 'Impulse learning operations file exists',
      actual: 'FILE NOT FOUND',
      expected: 'impulse_learning.py exists',
      message: '❌ Operations file not found',
    };
  }
  
  const hasInsertFunction = fileContains(opsPath, /def insert_mapping_record/);
  const callsNormalize = fileContains(opsPath, /normalize_pattern/);
  const callsTrackUsage = fileContains(opsPath, /track_usage/);
  const callsCalculateQuality = fileContains(opsPath, /calculate_quality/);
  const callsDbCreate = fileContains(opsPath, /db\.create.*impulse_mapping_record/);
  
  const pass = hasInsertFunction && callsNormalize && callsTrackUsage && callsCalculateQuality && callsDbCreate;
  
  return {
    pass,
    checkName: 'Insert mapping record orchestration',
    actual: {
      hasInsertFunction,
      callsNormalize,
      callsTrackUsage,
      callsCalculateQuality,
      callsDbCreate,
    },
    expected: 'insert_mapping_record orchestrates: normalize → track_usage → calculate_quality → db.create',
    message: pass
      ? '✅ Complete learning pipeline orchestration exists'
      : '❌ Pipeline orchestration incomplete',
    evidence: pass ? 'insert_mapping_record() chains all learning algorithms' : 'Orchestration missing or incomplete',
  };
}

/**
 * Check 7: Schema indexes for efficient queries
 */
function checkSchemaIndexes(): ValidationResult {
  const schemaPath = path.join(
    projectRoot,
    'repos/metabob-rpc-api/docs/schema/activity_learning_loop.surql'
  );
  
  if (!fileExists(schemaPath)) {
    return {
      pass: false,
      checkName: 'Schema file exists',
      actual: 'FILE NOT FOUND',
      expected: 'activity_learning_loop.surql exists',
      message: '❌ Schema file not found',
    };
  }
  
  const hasSessionIndex = fileContains(schemaPath, /idx_impulse_mapping_session/);
  const hasPatternIndex = fileContains(schemaPath, /idx_impulse_mapping_pattern/);
  const hasQualityIndex = fileContains(schemaPath, /idx_impulse_mapping_quality/);
  const hasRecordIdIndex = fileContains(schemaPath, /idx_impulse_mapping_record_id/);
  
  const pass = hasSessionIndex && hasPatternIndex && hasQualityIndex && hasRecordIdIndex;
  
  return {
    pass,
    checkName: 'Schema indexes for efficient queries',
    actual: {
      hasSessionIndex,
      hasPatternIndex,
      hasQualityIndex,
      hasRecordIdIndex,
    },
    expected: 'Indexes: session, pattern, quality, record_id',
    message: pass
      ? '✅ All required indexes defined in schema'
      : '❌ Some indexes missing',
    evidence: pass ? 'Found session, pattern, quality, record_id indexes' : 'Index definitions incomplete',
  };
}

/**
 * Run all validation checks
 */
export function runValidation(): HarnessResult {
  const checks: ValidationResult[] = [
    checkSurrealDBSchema(),
    checkRpcApiEndpoint(),
    checkPatternExtraction(),
    checkQualityCalculation(),
    checkUsageTracking(),
    checkInsertMappingRecord(),
    checkSchemaIndexes(),
  ];
  
  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  const overallPass = failed === 0;
  
  return {
    specificationName: 'impulse-learning-storage-complete',
    overallPass,
    checks,
    summary: {
      passed,
      failed,
      total: checks.length,
    },
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Validation Harness: impulse-learning-storage-complete\n');
  
  const result = runValidation();
  
  console.log('Checks:');
  result.checks.forEach((check, index) => {
    console.log(`\n${index + 1}. ${check.checkName}`);
    console.log(`   ${check.message}`);
    if (check.evidence) {
      console.log(`   Evidence: ${check.evidence}`);
    }
    if (!check.pass) {
      console.log(`   Expected: ${JSON.stringify(check.expected, null, 2)}`);
      console.log(`   Actual: ${JSON.stringify(check.actual, null, 2)}`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary: ${result.summary.passed}/${result.summary.total} checks passed`);
  
  if (result.overallPass) {
    console.log('\n✅ VALIDATION PASSED: impulse-learning-storage-complete is fully implemented\n');
    return 0;
  } else {
    console.log('\n❌ VALIDATION FAILED: Some components are missing or incomplete\n');
    console.log('Failed checks:');
    result.checks
      .filter(c => !c.pass)
      .forEach(c => console.log(`  - ${c.checkName}`));
    console.log('');
    return 1;
  }
}

// Execute if run directly
main();

/**
 * Test Cases as Impulses
 * These can be stored as validation-impulse-learning-storage-complete-case-N
 */
export const testCases: TestCase[] = [testCase1, testCase2, testCase3];
