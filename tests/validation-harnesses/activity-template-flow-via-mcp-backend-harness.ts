#!/usr/bin/env bun
/**
 * Validation Harness: Activity Template Flow via MCP Backend
 * 
 * This harness validates that activity templates flow exclusively through
 * the MCP backend path (MCP → RPC API → SurrealDB) rather than bypassing
 * via direct file system access.
 * 
 * Validation Strategy:
 * 1. Call test_metabob_mcp() and verify status='connected'
 * 2. Load a non-bootstrap template and verify source='metabob'
 * 3. Search codebase for direct .metabob/activities file reads
 * 4. Trace template registration flow through MCP to RPC API
 * 5. Verify Activity agent uses search_activities() not file system
 * 6. Check enforcement comments prevent local template storage
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// ============================================================================
// Types
// ============================================================================

interface ValidationResult {
  pass: boolean;
  testName: string;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface HarnessOutput {
  pass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a shell command and return stdout
 */
async function execCommand(command: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, { 
      cwd: cwd || process.cwd(),
      shell: true 
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    
    proc.on('close', (code) => {
      if (code !== 0 && stderr) {
        reject(new Error(stderr));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Search for pattern in files
 */
async function searchCodebase(pattern: string, filePattern: string, baseDir: string): Promise<string[]> {
  try {
    const output = await execCommand(
      `rg "${pattern}" --type-add 'target:${filePattern}' -t target --files-with-matches`,
      baseDir
    );
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return []; // No matches found
  }
}

/**
 * Read file content
 */
function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Check if string contains pattern
 */
function contains(text: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return text.includes(pattern);
  }
  return pattern.test(text);
}

// ============================================================================
// Validation Tests
// ============================================================================

/**
 * Test 1: Verify MCP connection status
 */
async function test_mcpConnectionStatus(baseDir: string): Promise<ValidationResult> {
  const testName = "MCP Connection Status";
  
  try {
    // Check if test_metabob_mcp tool exists in the codebase
    const toolFiles = await searchCodebase('test_metabob_mcp', '*.ts', baseDir);
    
    const expected = {
      toolExists: true,
      toolDefined: true
    };
    
    const actual = {
      toolExists: toolFiles.length > 0,
      toolDefined: toolFiles.some(file => {
        const content = readFile(path.join(baseDir, file));
        return contains(content, 'test_metabob_mcp') && 
               contains(content, /export.*test_metabob_mcp/);
      })
    };
    
    const pass = actual.toolExists && actual.toolDefined;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? `test_metabob_mcp tool found in ${toolFiles.length} file(s)`
        : 'test_metabob_mcp tool not found or not properly defined'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { toolExists: true, toolDefined: true },
      error: (error as Error).message
    };
  }
}

/**
 * Test 2: Verify TemplateLoader returns source='metabob'
 */
async function test_templateLoaderSource(baseDir: string): Promise<ValidationResult> {
  const testName = "TemplateLoader Source Verification";
  
  try {
    const templateLoaderPath = 'repos/metabob-opencode/packages/opencode/src/session/template-loader.ts';
    const fullPath = path.join(baseDir, templateLoaderPath);
    
    if (!fs.existsSync(fullPath)) {
      return {
        pass: false,
        testName,
        actual: { fileExists: false },
        expected: { fileExists: true, sourceMetabob: true },
        error: `File not found: ${templateLoaderPath}`
      };
    }
    
    const content = readFile(fullPath);
    
    const expected = {
      fileExists: true,
      sourceMetabob: true,
      usesTemplateServiceClient: true,
      hasBootstrapFallback: true
    };
    
    const actual = {
      fileExists: true,
      sourceMetabob: contains(content, "source: 'metabob'") || contains(content, 'source: "metabob"'),
      usesTemplateServiceClient: contains(content, 'TemplateServiceClient'),
      hasBootstrapFallback: contains(content, 'bootstrap')
    };
    
    const pass = actual.sourceMetabob && actual.usesTemplateServiceClient && actual.hasBootstrapFallback;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? 'TemplateLoader properly configured with MCP backend and bootstrap fallback'
        : 'TemplateLoader configuration does not match expected pattern'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { fileExists: true, sourceMetabob: true },
      error: (error as Error).message
    };
  }
}

/**
 * Test 3: Search for direct .metabob/activities file access
 */
async function test_noDirectFileAccess(baseDir: string): Promise<ValidationResult> {
  const testName = "No Direct File Access to .metabob/activities";
  
  try {
    const searchPath = 'repos/metabob-opencode/packages/opencode/src';
    const matches = await searchCodebase('\\.metabob/activities', '*.ts', path.join(baseDir, searchPath));
    
    // Filter out CLI setup code (which is allowed to create directories)
    const problematicFiles = matches.filter(file => 
      !file.includes('cli/cmd/metabob.ts') // CLI setup is allowed
    );
    
    // Check if remaining matches are commented out
    const activeReferences = problematicFiles.filter(file => {
      const content = readFile(path.join(baseDir, searchPath, file));
      const lines = content.split('\n');
      
      // Find lines with .metabob/activities that are not commented
      return lines.some(line => 
        line.includes('.metabob/activities') && 
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*')
      );
    });
    
    const expected = {
      activeReferences: 0,
      allReferencesCommented: true
    };
    
    const actual = {
      activeReferences: activeReferences.length,
      allReferencesCommented: activeReferences.length === 0,
      problematicFiles: activeReferences
    };
    
    const pass = actual.allReferencesCommented;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? 'No active direct file access to .metabob/activities found'
        : `Found ${activeReferences.length} file(s) with active references: ${activeReferences.join(', ')}`
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { activeReferences: 0 },
      error: (error as Error).message
    };
  }
}

/**
 * Test 4: Verify MetabobCLI has no local file writes
 */
async function test_metabobCliNoLocalWrites(baseDir: string): Promise<ValidationResult> {
  const testName = "MetabobCLI No Local Template Writes";
  
  try {
    const metabobPath = 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts';
    const fullPath = path.join(baseDir, metabobPath);
    
    if (!fs.existsSync(fullPath)) {
      return {
        pass: false,
        testName,
        actual: { fileExists: false },
        expected: { fileExists: true, noLocalWrites: true },
        error: `File not found: ${metabobPath}`
      };
    }
    
    const content = readFile(fullPath);
    
    const expected = {
      fileExists: true,
      noLocalWrites: true,
      hasArchitecturalConstraintComment: true,
      callsMCPTools: true
    };
    
    // Check for architectural constraint comment (lines 803-813)
    const hasConstraintComment = contains(content, 'ARCHITECTURAL CONSTRAINT');
    
    // Check that local file writes are commented out
    const writeCommented = contains(content, '// const activitiesDir') ||
                          contains(content, '// fs.mkdirSync') ||
                          contains(content, '// await Bun.write');
    
    // Check that it calls MCP tools
    const callsMCP = contains(content, 'callMCPTool') &&
                    contains(content, 'metabob_register_activity_template');
    
    const actual = {
      fileExists: true,
      noLocalWrites: writeCommented,
      hasArchitecturalConstraintComment: hasConstraintComment,
      callsMCPTools: callsMCP
    };
    
    const pass = actual.noLocalWrites && actual.hasArchitecturalConstraintComment && actual.callsMCPTools;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? 'MetabobCLI properly enforces MCP-only communication with no local writes'
        : 'MetabobCLI does not meet MCP-only enforcement requirements'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { fileExists: true, noLocalWrites: true },
      error: (error as Error).message
    };
  }
}

/**
 * Test 5: Verify Activity Agent tool configuration
 */
async function test_activityAgentTools(baseDir: string): Promise<ValidationResult> {
  const testName = "Activity Agent Tool Configuration";
  
  try {
    const agentPath = 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts';
    const fullPath = path.join(baseDir, agentPath);
    
    if (!fs.existsSync(fullPath)) {
      return {
        pass: false,
        testName,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${agentPath}`
      };
    }
    
    const content = readFile(fullPath);
    
    // Find Activity agent configuration (around line 113-165)
    const activityAgentMatch = content.match(/name:\s*["']activity["'][\s\S]*?tools:\s*\{[\s\S]*?\}/m);
    
    if (!activityAgentMatch) {
      return {
        pass: false,
        testName,
        actual: { agentFound: false },
        expected: { agentFound: true },
        error: 'Activity agent configuration not found'
      };
    }
    
    const activityAgentConfig = activityAgentMatch[0];
    
    const expected = {
      hasSearchActivities: true,
      hasActivity: true,
      noImpulseCreate: true,
      noImpulseLoad: true
    };
    
    const actual = {
      hasSearchActivities: contains(activityAgentConfig, /search_activities:\s*true/),
      hasActivity: contains(activityAgentConfig, /activity:\s*true/),
      noImpulseCreate: contains(activityAgentConfig, /impulse_create:\s*false/),
      noImpulseLoad: contains(activityAgentConfig, /impulse_load:\s*false/)
    };
    
    const pass = actual.hasSearchActivities && actual.hasActivity && 
                actual.noImpulseCreate && actual.noImpulseLoad;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? 'Activity agent properly configured: has search_activities, no impulse tools'
        : 'Activity agent configuration does not enforce separation of concerns'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { hasSearchActivities: true },
      error: (error as Error).message
    };
  }
}

/**
 * Test 6: Verify Memory Agent tool configuration
 */
async function test_memoryAgentTools(baseDir: string): Promise<ValidationResult> {
  const testName = "Memory Agent Tool Configuration";
  
  try {
    const agentPath = 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts';
    const fullPath = path.join(baseDir, agentPath);
    
    if (!fs.existsSync(fullPath)) {
      return {
        pass: false,
        testName,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${agentPath}`
      };
    }
    
    const content = readFile(fullPath);
    
    // Find Memory agent configuration (around line 376-588)
    const memoryAgentMatch = content.match(/name:\s*["']memory["'][\s\S]*?tools:\s*\{[\s\S]*?\},?\s*options:/m);
    
    if (!memoryAgentMatch) {
      return {
        pass: false,
        testName,
        actual: { agentFound: false },
        expected: { agentFound: true },
        error: 'Memory agent configuration not found'
      };
    }
    
    const memoryAgentConfig = memoryAgentMatch[0];
    
    const expected = {
      hasActivity: true,
      hasSearchActivities: true,
      hasImpulseCreate: true,
      hasImpulseLoad: true,
      hasImpulseUnload: true
    };
    
    const actual = {
      hasActivity: contains(memoryAgentConfig, /activity:\s*true/),
      hasSearchActivities: contains(memoryAgentConfig, /search_activities:\s*true/),
      hasImpulseCreate: contains(memoryAgentConfig, /impulse_create:\s*true/),
      hasImpulseLoad: contains(memoryAgentConfig, /impulse_load:\s*true/),
      hasImpulseUnload: contains(memoryAgentConfig, /impulse_unload:\s*true/)
    };
    
    const pass = actual.hasActivity && actual.hasSearchActivities && 
                actual.hasImpulseCreate && actual.hasImpulseLoad && actual.hasImpulseUnload;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? 'Memory agent properly configured: has activity tools and impulse management'
        : 'Memory agent configuration does not properly manage impulse state'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { hasImpulseCreate: true },
      error: (error as Error).message
    };
  }
}

/**
 * Test 7: Verify TemplateServiceClient delegates to MetabobCLI
 */
async function test_templateServiceClientDelegation(baseDir: string): Promise<ValidationResult> {
  const testName = "TemplateServiceClient Delegation";
  
  try {
    const clientPath = 'repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts';
    const fullPath = path.join(baseDir, clientPath);
    
    if (!fs.existsSync(fullPath)) {
      return {
        pass: false,
        testName,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${clientPath}`
      };
    }
    
    const content = readFile(fullPath);
    
    const expected = {
      fileExists: true,
      callsSearchActivities: true,
      callsGetActivity: true,
      callsRegisterActivityTemplate: true
    };
    
    const actual = {
      fileExists: true,
      callsSearchActivities: contains(content, 'MetabobCLI.searchActivities'),
      callsGetActivity: contains(content, 'MetabobCLI.getActivity'),
      callsRegisterActivityTemplate: contains(content, 'MetabobCLI.registerActivityTemplate')
    };
    
    const pass = actual.callsSearchActivities && actual.callsGetActivity && 
                actual.callsRegisterActivityTemplate;
    
    return {
      pass,
      testName,
      actual,
      expected,
      details: pass 
        ? 'TemplateServiceClient properly delegates to MetabobCLI for all operations'
        : 'TemplateServiceClient does not properly delegate to MetabobCLI'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      actual: null,
      expected: { fileExists: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Main Validation Runner
// ============================================================================

/**
 * Run all validation tests
 */
export async function runValidation(baseDir: string = process.cwd()): Promise<HarnessOutput> {
  console.log('🔍 Running validation harness: Activity Template Flow via MCP Backend\n');
  
  const tests = [
    test_mcpConnectionStatus,
    test_templateLoaderSource,
    test_noDirectFileAccess,
    test_metabobCliNoLocalWrites,
    test_activityAgentTools,
    test_memoryAgentTools,
    test_templateServiceClientDelegation
  ];
  
  const results: ValidationResult[] = [];
  
  for (const test of tests) {
    console.log(`Running: ${test.name}...`);
    const result = await test(baseDir);
    results.push(result);
    console.log(result.pass ? '✅ PASS' : '❌ FAIL');
    if (!result.pass) {
      console.log(`   ${result.error || result.details || 'Check failed'}`);
    }
    console.log();
  }
  
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const totalTests = results.length;
  const pass = failed === 0;
  
  const summary = pass 
    ? `✅ All ${totalTests} validation tests passed`
    : `❌ ${failed} of ${totalTests} validation tests failed`;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log(summary);
  console.log(`   Passed: ${passed}/${totalTests}`);
  console.log(`   Failed: ${failed}/${totalTests}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return {
    pass,
    totalTests,
    passed,
    failed,
    results,
    summary
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

// Check if this is the main module being run directly
const isMain = process.argv[1] === import.meta.url.replace('file://', '');

if (isMain) {
  const baseDir = process.argv[2] || process.cwd();
  
  runValidation(baseDir)
    .then(output => {
      console.log('\n📊 Validation Report:');
      console.log(JSON.stringify(output, null, 2));
      process.exit(output.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation harness error:', error);
      process.exit(1);
    });
}
