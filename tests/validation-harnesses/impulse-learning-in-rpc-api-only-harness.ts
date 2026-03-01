#!/usr/bin/env ts-node
/**
 * Validation Harness: impulse-learning-in-rpc-api-only
 * 
 * Validates that learning algorithms have been moved from opencode to rpc-api.
 * 
 * Compliance Checks:
 * 1. impulse-learning.ts is <50 lines OR deleted
 * 2. No learning algorithms in opencode (normalizePattern, calculateQuality, trackUsage)
 * 3. RPC API has /v1/learning/record-turn endpoint
 * 4. RPC API has pattern extraction logic (normalize_pattern function)
 * 5. RPC API has quality calculation logic (calculate_quality function)
 * 6. RPC API has usage tracking logic (track_usage function)
 * 
 * Usage:
 *   npx ts-node impulse-learning-in-rpc-api-only-harness.ts
 *   
 * Returns:
 *   Exit code 0 if all checks pass
 *   Exit code 1 if any check fails
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  pass: boolean;
  checkName: string;
  actual: any;
  expected: any;
  message: string;
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

/**
 * Count lines in a file (non-blank, non-comment)
 */
function countLines(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return -1; // File deleted
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    // Skip blank lines and comment-only lines
    return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
  });
  
  return lines.length;
}

/**
 * Check if file contains specific function/pattern
 */
function fileContains(filePath: string, pattern: string | RegExp): boolean {
  if (!fs.existsSync(filePath)) {
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
 * Check 1: impulse-learning.ts line count
 */
function checkImpulseLearningLineCount(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts'
  );
  
  const lineCount = countLines(filePath);
  const pass = lineCount === -1 || lineCount < 50;
  
  return {
    pass,
    checkName: 'impulse-learning.ts line count',
    actual: lineCount === -1 ? 'DELETED' : `${lineCount} lines`,
    expected: '<50 lines OR DELETED',
    message: pass
      ? `✅ impulse-learning.ts ${lineCount === -1 ? 'deleted' : `has ${lineCount} lines (<50)`}`
      : `❌ impulse-learning.ts has ${lineCount} lines (expected <50)`,
  };
}

/**
 * Check 2: No normalizePattern in opencode
 */
function checkNoNormalizePatternInOpencode(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: true,
      checkName: 'No normalizePattern in opencode',
      actual: 'FILE DELETED',
      expected: 'No normalizePattern function',
      message: '✅ impulse-learning.ts deleted (no normalizePattern)',
    };
  }
  
  const hasNormalizePattern = fileContains(filePath, /function\s+normalizePattern|const\s+normalizePattern\s*=/);
  const pass = !hasNormalizePattern;
  
  return {
    pass,
    checkName: 'No normalizePattern in opencode',
    actual: hasNormalizePattern ? 'normalizePattern FOUND' : 'normalizePattern NOT FOUND',
    expected: 'No normalizePattern function',
    message: pass
      ? '✅ No normalizePattern in opencode'
      : '❌ normalizePattern still exists in opencode (should be in rpc-api only)',
  };
}

/**
 * Check 3: No calculateResponseQuality in opencode
 */
function checkNoCalculateQualityInOpencode(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: true,
      checkName: 'No calculateResponseQuality in opencode',
      actual: 'FILE DELETED',
      expected: 'No calculateResponseQuality function',
      message: '✅ impulse-learning.ts deleted (no calculateResponseQuality)',
    };
  }
  
  const hasCalculateQuality = fileContains(filePath, /function\s+calculateResponseQuality|const\s+calculateResponseQuality\s*=/);
  const pass = !hasCalculateQuality;
  
  return {
    pass,
    checkName: 'No calculateResponseQuality in opencode',
    actual: hasCalculateQuality ? 'calculateResponseQuality FOUND' : 'calculateResponseQuality NOT FOUND',
    expected: 'No calculateResponseQuality function',
    message: pass
      ? '✅ No calculateResponseQuality in opencode'
      : '❌ calculateResponseQuality still exists in opencode (should be in rpc-api only)',
  };
}

/**
 * Check 4: No trackImpulseUsage in opencode
 */
function checkNoTrackUsageInOpencode(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: true,
      checkName: 'No trackImpulseUsage in opencode',
      actual: 'FILE DELETED',
      expected: 'No trackImpulseUsage function',
      message: '✅ impulse-learning.ts deleted (no trackImpulseUsage)',
    };
  }
  
  const hasTrackUsage = fileContains(filePath, /function\s+trackImpulseUsage|const\s+trackImpulseUsage\s*=/);
  const pass = !hasTrackUsage;
  
  return {
    pass,
    checkName: 'No trackImpulseUsage in opencode',
    actual: hasTrackUsage ? 'trackImpulseUsage FOUND' : 'trackImpulseUsage NOT FOUND',
    expected: 'No trackImpulseUsage function',
    message: pass
      ? '✅ No trackImpulseUsage in opencode'
      : '❌ trackImpulseUsage still exists in opencode (should be in rpc-api only)',
  };
}

/**
 * Check 5: RPC API has /record-turn endpoint
 */
function checkRpcApiHasRecordTurnEndpoint(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-rpc-api/server/routes/learning_loop.py'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: false,
      checkName: 'RPC API has /record-turn endpoint',
      actual: 'learning_loop.py NOT FOUND',
      expected: 'POST /record-turn endpoint exists',
      message: '❌ learning_loop.py not found',
    };
  }
  
  const hasEndpoint = fileContains(filePath, /[@]router\.post\(["']\/record-turn["']/);
  const pass = hasEndpoint;
  
  return {
    pass,
    checkName: 'RPC API has /record-turn endpoint',
    actual: hasEndpoint ? 'POST /record-turn FOUND' : 'POST /record-turn NOT FOUND',
    expected: 'POST /record-turn endpoint exists',
    message: pass
      ? '✅ RPC API has POST /record-turn endpoint'
      : '❌ RPC API missing POST /record-turn endpoint',
  };
}

/**
 * Check 6: RPC API has normalize_pattern function
 */
function checkRpcApiHasNormalizePattern(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: false,
      checkName: 'RPC API has normalize_pattern',
      actual: 'impulse_learning.py NOT FOUND',
      expected: 'normalize_pattern function exists',
      message: '❌ impulse_learning.py not found',
    };
  }
  
  const hasNormalizePattern = fileContains(filePath, /def\s+normalize_pattern\(/);
  const pass = hasNormalizePattern;
  
  return {
    pass,
    checkName: 'RPC API has normalize_pattern',
    actual: hasNormalizePattern ? 'normalize_pattern FOUND' : 'normalize_pattern NOT FOUND',
    expected: 'normalize_pattern function exists',
    message: pass
      ? '✅ RPC API has normalize_pattern function'
      : '❌ RPC API missing normalize_pattern function',
  };
}

/**
 * Check 7: RPC API has calculate_quality function
 */
function checkRpcApiHasCalculateQuality(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: false,
      checkName: 'RPC API has calculate_quality',
      actual: 'impulse_learning.py NOT FOUND',
      expected: 'calculate_quality function exists',
      message: '❌ impulse_learning.py not found',
    };
  }
  
  const hasCalculateQuality = fileContains(filePath, /def\s+calculate_quality\(/);
  const pass = hasCalculateQuality;
  
  return {
    pass,
    checkName: 'RPC API has calculate_quality',
    actual: hasCalculateQuality ? 'calculate_quality FOUND' : 'calculate_quality NOT FOUND',
    expected: 'calculate_quality function exists',
    message: pass
      ? '✅ RPC API has calculate_quality function'
      : '❌ RPC API missing calculate_quality function',
  };
}

/**
 * Check 8: RPC API has track_usage function
 */
function checkRpcApiHasTrackUsage(): ValidationResult {
  const filePath = path.join(
    __dirname,
    '../../repos/metabob-rpc-api/server/db/operations/impulse_learning.py'
  );
  
  if (!fs.existsSync(filePath)) {
    return {
      pass: false,
      checkName: 'RPC API has track_usage',
      actual: 'impulse_learning.py NOT FOUND',
      expected: 'track_usage function exists',
      message: '❌ impulse_learning.py not found',
    };
  }
  
  const hasTrackUsage = fileContains(filePath, /def\s+track_usage\(/);
  const pass = hasTrackUsage;
  
  return {
    pass,
    checkName: 'RPC API has track_usage',
    actual: hasTrackUsage ? 'track_usage FOUND' : 'track_usage NOT FOUND',
    expected: 'track_usage function exists',
    message: pass
      ? '✅ RPC API has track_usage function'
      : '❌ RPC API missing track_usage function',
  };
}

/**
 * Run all validation checks
 */
export function runValidation(): HarnessResult {
  const checks: ValidationResult[] = [
    checkImpulseLearningLineCount(),
    checkNoNormalizePatternInOpencode(),
    checkNoCalculateQualityInOpencode(),
    checkNoTrackUsageInOpencode(),
    checkRpcApiHasRecordTurnEndpoint(),
    checkRpcApiHasNormalizePattern(),
    checkRpcApiHasCalculateQuality(),
    checkRpcApiHasTrackUsage(),
  ];
  
  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  const total = checks.length;
  const overallPass = failed === 0;
  
  return {
    specificationName: 'impulse-learning-in-rpc-api-only',
    overallPass,
    checks,
    summary: {
      passed,
      failed,
      total,
    },
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Validation Harness: impulse-learning-in-rpc-api-only\n');
  console.log('Specification: Learning algorithms belong in rpc-api, opencode only collects raw data\n');
  
  const result = runValidation();
  
  console.log('Checks:\n');
  result.checks.forEach(check => {
    console.log(check.message);
    console.log(`   Actual: ${check.actual}`);
    console.log(`   Expected: ${check.expected}`);
    console.log('');
  });
  
  console.log('─'.repeat(80));
  console.log(`\nSummary: ${result.summary.passed}/${result.summary.total} checks passed\n`);
  
  if (result.overallPass) {
    console.log('✅ VALIDATION PASSED - Specification fully enforced\n');
    process.exit(0);
  } else {
    console.log('❌ VALIDATION FAILED - Specification not fully enforced\n');
    console.log('Failed checks:');
    result.checks.filter(c => !c.pass).forEach(check => {
      console.log(`  - ${check.checkName}: ${check.message}`);
    });
    console.log('');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
