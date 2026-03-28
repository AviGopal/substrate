#!/usr/bin/env tsx
/**
 * Validation Harness: MCP Architecture Compliance
 * 
 * Ensures 100% MCP architectural compliance by detecting architectural violations:
 * - Direct HTTP calls bypassing MCP layer (fetch/axios to backend)
 * - RpcHttpClient usage (deprecated after MCP migration)
 * - Explicit MCP bypass markers in code
 * 
 * This harness should run in CI/CD to prevent regressions where code bypasses
 * the mandated MCP architecture: opencode → MCP Client → metabob-cli MCP Server → Backend API
 * 
 * Specification: MCP Architecture Compliance - Apply Ripple Changes
 * Status: Active (enforced since 2026-03-08)
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  OPENCODE_PATH: path.resolve(__dirname, '../../repos/metabob-opencode/packages/opencode/src'),
  EXCLUDE_PATTERNS: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/test/**',
    '**/tests/**',
  ],
};

// =============================================================================
// Violation Patterns
// =============================================================================

interface ViolationPattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  severity: 'ERROR' | 'WARNING';
  exemptions?: string[]; // File paths exempt from this rule
}

const VIOLATION_PATTERNS: ViolationPattern[] = [
  {
    id: 'direct-http-bypass',
    name: 'Direct HTTP to Backend',
    description: 'Direct HTTP calls to backend API bypassing MCP layer',
    pattern: /fetch\s*\(\s*['"`].*\/(v1|v2)\/activities/,
    severity: 'ERROR',
    exemptions: [
      // rpc-http-client.ts is deprecated and documented as removed
      'src/util/rpc-http-client.ts',
    ],
  },
  {
    id: 'rpc-client-usage',
    name: 'RpcHttpClient Usage',
    description: 'Usage of deprecated RpcHttpClient (replaced by MCP)',
    pattern: /RpcHttpClient\s*\.\s*selectTemplateVariant/,
    severity: 'ERROR',
    exemptions: [
      // Only comments documenting the removal are allowed
      'src/util/rpc-http-client.ts',
    ],
  },
  {
    id: 'explicit-mcp-bypass',
    name: 'Explicit MCP Bypass Marker',
    description: 'Code explicitly marked as bypassing MCP architecture',
    pattern: /\/\/\s*BYPASS\s*MCP|\/\/\s*MCP\s*BYPASS/i,
    severity: 'ERROR',
  },
  {
    id: 'axios-backend-call',
    name: 'Axios Backend Call',
    description: 'Axios calls to backend API (should use MCP)',
    pattern: /axios\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`].*\/(v1|v2)\/activities/,
    severity: 'ERROR',
  },
];

// =============================================================================
// Types
// =============================================================================

interface Violation {
  patternId: string;
  patternName: string;
  file: string;
  line: number;
  code: string;
  severity: 'ERROR' | 'WARNING';
}

interface ValidationResult {
  totalFiles: number;
  violations: Violation[];
  passed: boolean;
  summary: string;
}

// =============================================================================
// Scanner
// =============================================================================

class ComplianceScanner {
  private violations: Violation[] = [];
  private filesScanned: number = 0;

  scan(): ValidationResult {
    console.log('[Scanner] Starting MCP compliance scan...');
    console.log(`[Scanner] Scanning directory: ${CONFIG.OPENCODE_PATH}`);

    this.scanDirectory(CONFIG.OPENCODE_PATH);

    const passed = this.violations.filter(v => v.severity === 'ERROR').length === 0;
    const summary = this.generateSummary();

    return {
      totalFiles: this.filesScanned,
      violations: this.violations,
      passed,
      summary,
    };
  }

  private scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (this.isExcluded(fullPath)) {
          continue;
        }
        this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        this.scanFile(fullPath);
      }
    }
  }

  private scanFile(filePath: string): void {
    const relativePath = path.relative(path.resolve(__dirname, '../../repos/metabob-opencode'), filePath);
    
    // Skip excluded files
    if (this.isExcluded(relativePath)) {
      return;
    }

    this.filesScanned++;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of VIOLATION_PATTERNS) {
      // Check if file is exempt from this pattern
      if (pattern.exemptions?.some(exemption => relativePath.includes(exemption))) {
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern.pattern.test(line)) {
          this.violations.push({
            patternId: pattern.id,
            patternName: pattern.name,
            file: relativePath,
            line: i + 1,
            code: line.trim(),
            severity: pattern.severity,
          });
        }
      }
    }
  }

  private isExcluded(filePath: string): boolean {
    return CONFIG.EXCLUDE_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  private generateSummary(): string {
    const errors = this.violations.filter(v => v.severity === 'ERROR');
    const warnings = this.violations.filter(v => v.severity === 'WARNING');

    let summary = '\n=== MCP Architecture Compliance Report ===\n\n';
    summary += `Files Scanned: ${this.filesScanned}\n`;
    summary += `Total Violations: ${this.violations.length}\n`;
    summary += `  - Errors: ${errors.length}\n`;
    summary += `  - Warnings: ${warnings.length}\n\n`;

    if (errors.length > 0) {
      summary += '❌ ERRORS (blocking):\n';
      for (const violation of errors) {
        summary += `  ${violation.file}:${violation.line} - ${violation.patternName}\n`;
        summary += `    Code: ${violation.code}\n`;
      }
      summary += '\n';
    }

    if (warnings.length > 0) {
      summary += '⚠️  WARNINGS (non-blocking):\n';
      for (const violation of warnings) {
        summary += `  ${violation.file}:${violation.line} - ${violation.patternName}\n`;
        summary += `    Code: ${violation.code}\n`;
      }
      summary += '\n';
    }

    if (errors.length === 0) {
      summary += '✅ PASSED - 100% MCP architectural compliance\n';
      summary += '\nAll backend communication flows through MCP:\n';
      summary += '  OpenCode → MCP Client → metabob-cli MCP Server → Backend API\n';
    } else {
      summary += '❌ FAILED - Architectural violations detected\n';
      summary += '\nFix violations to maintain MCP architectural compliance.\n';
    }

    return summary;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('MCP Architecture Compliance Validator');
  console.log('=====================================\n');

  const scanner = new ComplianceScanner();
  const result = scanner.scan();

  console.log(result.summary);

  // Write results to file
  const outputPath = path.resolve(__dirname, '../../validation-results/mcp-compliance-latest.json');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nResults written to: ${outputPath}`);

  // Exit with error code if violations found
  if (!result.passed) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ComplianceScanner, VIOLATION_PATTERNS };
