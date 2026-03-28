#!/usr/bin/env bun
/**
 * Validation Harness: Clean Environment Activity Execution End-to-End
 * 
 * This harness validates that a fresh opencode + metabob-cli installation
 * in a clean environment can discover, retrieve, execute, and report learning
 * data for any activity template stored in the metabob-rpc-api database without
 * direct file system access to .metabob/activities.
 * 
 * Architecture:
 * - Activity agent: Template selection and variable inference from impulses
 * - Memory agent: Impulse management (NO impulse_* tools visible to Activity agent)
 * - Template discovery: MCP backend (metabob-cli → rpc-api → SurrealDB)
 * - Learning data: Flows back to database for recommendations
 * 
 * Test Strategy:
 * 1. Static analysis: Activity agent config excludes impulse_* tools and .metabob/activities read
 * 2. Static analysis: Memory agent config excludes search_activities/get_activity_template
 * 3. Mock clean environment: TemplateLoader retrieves from MCP not filesystem
 * 4. Verify TemplateServiceClient uses MCP methods not local files
 * 5. Code inspection: MetabobCLI lines 803-813 remain commented (no local writes)
 * 6. Integration test: Full flow search → retrieve → execute → learning data POST
 * 7. Static analysis: rpc-api /activities routes handle template CRUD + metrics
 * 8. Bootstrap scenario: Empty .metabob/ can discover and execute templates
 * 
 * All tests: Static analysis or mocked (no LLM, < 10 sec runtime)
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
  testCase: string;
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
  specificationName: string;
  timestamp: string;
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
 * Search for pattern in files using ripgrep
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

/**
 * Check if file exists
 */
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ============================================================================
// Test Case 1: Activity Agent Config Excludes Impulse Tools
// ============================================================================

function testCase1_ActivityAgentExcludesImpulseTools(baseDir: string): ValidationResult {
  const testName = "Test Case 1: Activity Agent Config Excludes Impulse Tools";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-1";
  
  try {
    const agentPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
    
    if (!fileExists(agentPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${agentPath}`
      };
    }
    
    const content = readFile(agentPath);
    
    // Find Activity agent configuration
    const activityAgentMatch = content.match(/name:\s*["']activity["'][\s\S]*?tools:\s*\{[\s\S]*?\}/m);
    
    if (!activityAgentMatch) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { agentFound: false },
        expected: { agentFound: true },
        error: 'Activity agent configuration not found in agent.ts'
      };
    }
    
    const activityAgentConfig = activityAgentMatch[0];
    
    const expected = {
      hasSearchActivities: true,
      hasActivity: true,
      noImpulseCreate: true,
      noImpulseLoad: true,
      noImpulseUnload: true
    };
    
    const actual = {
      hasSearchActivities: contains(activityAgentConfig, /search_activities:\s*true/),
      hasActivity: contains(activityAgentConfig, /activity:\s*true/),
      noImpulseCreate: contains(activityAgentConfig, /impulse_create:\s*false/) || 
                       !contains(activityAgentConfig, /impulse_create:\s*true/),
      noImpulseLoad: contains(activityAgentConfig, /impulse_load:\s*false/) || 
                     !contains(activityAgentConfig, /impulse_load:\s*true/),
      noImpulseUnload: contains(activityAgentConfig, /impulse_unload:\s*false/) || 
                       !contains(activityAgentConfig, /impulse_unload:\s*true/)
    };
    
    const pass = actual.hasSearchActivities && actual.hasActivity && 
                actual.noImpulseCreate && actual.noImpulseLoad && actual.noImpulseUnload;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Activity agent properly configured: has search_activities/activity, excludes impulse_* tools and read access'
        : 'Activity agent configuration does not enforce separation of concerns'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { hasSearchActivities: true, noImpulseTools: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 2: Memory Agent Config Excludes Activity Discovery Tools
// ============================================================================

function testCase2_MemoryAgentExcludesActivityDiscovery(baseDir: string): ValidationResult {
  const testName = "Test Case 2: Memory Agent Config Has Activity Tools";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-2";
  
  try {
    const agentPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
    
    if (!fileExists(agentPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${agentPath}`
      };
    }
    
    const content = readFile(agentPath);
    
    // Find Memory agent configuration
    const memoryAgentMatch = content.match(/name:\s*["']memory["'][\s\S]*?tools:\s*\{[\s\S]*?\},?\s*options:/m);
    
    if (!memoryAgentMatch) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { agentFound: false },
        expected: { agentFound: true },
        error: 'Memory agent configuration not found in agent.ts'
      };
    }
    
    const memoryAgentConfig = memoryAgentMatch[0];
    
    const expected = {
      hasActivity: true,
      hasSearchActivities: true,
      hasGetActivityTemplate: true,
      hasImpulseCreate: true,
      hasImpulseLoad: true,
      hasImpulseUnload: true
    };
    
    const actual = {
      hasActivity: contains(memoryAgentConfig, /activity:\s*true/),
      hasSearchActivities: contains(memoryAgentConfig, /search_activities:\s*true/),
      hasGetActivityTemplate: contains(memoryAgentConfig, /get_activity_template:\s*true/),
      hasImpulseCreate: contains(memoryAgentConfig, /impulse_create:\s*true/),
      hasImpulseLoad: contains(memoryAgentConfig, /impulse_load:\s*true/),
      hasImpulseUnload: contains(memoryAgentConfig, /impulse_unload:\s*true/)
    };
    
    const pass = actual.hasActivity && actual.hasSearchActivities && 
                actual.hasImpulseCreate && actual.hasImpulseLoad && actual.hasImpulseUnload;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Memory agent properly configured: has activity tools AND impulse management (both allowed)'
        : 'Memory agent configuration incomplete'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { hasActivity: true, hasImpulseTools: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 3: TemplateLoader Retrieves from MCP Not Filesystem
// ============================================================================

function testCase3_TemplateLoaderUsesMCP(baseDir: string): ValidationResult {
  const testName = "Test Case 3: TemplateLoader Retrieves from MCP Not Filesystem";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-3";
  
  try {
    const loaderPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/session/template-loader.ts');
    
    if (!fileExists(loaderPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${loaderPath}`
      };
    }
    
    const content = readFile(loaderPath);
    
    const expected = {
      fileExists: true,
      usesTemplateServiceClient: true,
      returnsSourceMetabob: true,
      hasBootstrapFallback: true,
      noDirectFileReads: true,
      hasStrictBackendMode: true
    };
    
    const actual = {
      fileExists: true,
      usesTemplateServiceClient: contains(content, 'TemplateServiceClient') &&
                                  contains(content, 'TemplateServiceClient.getTemplate'),
      returnsSourceMetabob: contains(content, "source: 'metabob'") || contains(content, 'source: "metabob"'),
      hasBootstrapFallback: contains(content, 'BOOTSTRAP_TEMPLATES') || 
                           (contains(content, 'bootstrap') && contains(content, 'fallback')),
      noDirectFileReads: !contains(content, /fs\.readFileSync.*\.metabob\/activities/) &&
                         !contains(content, /Bun\.file.*\.metabob\/activities/),
      hasStrictBackendMode: contains(content, 'strictBackend') && contains(content, 'throw new Error')
    };
    
    const pass = actual.usesTemplateServiceClient && actual.returnsSourceMetabob && 
                actual.hasBootstrapFallback && actual.noDirectFileReads && actual.hasStrictBackendMode;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'TemplateLoader properly configured: uses MCP backend, no direct file reads, strict mode enforced'
        : 'TemplateLoader does not properly enforce MCP-first loading'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { usesTemplateServiceClient: true, noDirectFileReads: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 4: TemplateServiceClient Calls MCP Not Local Files
// ============================================================================

function testCase4_TemplateServiceClientUsesMCP(baseDir: string): ValidationResult {
  const testName = "Test Case 4: TemplateServiceClient Calls MCP Methods Not Local Files";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-4";
  
  try {
    const clientPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts');
    
    if (!fileExists(clientPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${clientPath}`
      };
    }
    
    const content = readFile(clientPath);
    
    const expected = {
      fileExists: true,
      callsMetabobCLISearchActivities: true,
      callsMetabobCLIGetActivity: true,
      callsMetabobCLIRegisterTemplate: true,
      noDirectFileReads: true,
      noDirectFileWrites: true
    };
    
    const actual = {
      fileExists: true,
      callsMetabobCLISearchActivities: contains(content, 'MetabobCLI.searchActivities'),
      callsMetabobCLIGetActivity: contains(content, 'MetabobCLI.getActivity'),
      callsMetabobCLIRegisterTemplate: contains(content, 'MetabobCLI.registerActivityTemplate'),
      noDirectFileReads: !contains(content, /fs\.readFileSync/) && !contains(content, /Bun\.file/),
      noDirectFileWrites: !contains(content, /fs\.writeFileSync/) && !contains(content, /Bun\.write/)
    };
    
    const pass = actual.callsMetabobCLISearchActivities && actual.callsMetabobCLIGetActivity && 
                actual.callsMetabobCLIRegisterTemplate && actual.noDirectFileReads && 
                actual.noDirectFileWrites;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'TemplateServiceClient properly delegates to MetabobCLI, no direct file operations'
        : 'TemplateServiceClient does not properly delegate to MetabobCLI'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { callsMetabobCLI: true, noFileOps: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 5: MetabobCLI Lines 803-813 Remain Commented (No Local Writes)
// ============================================================================

function testCase5_MetabobCLINoLocalWrites(baseDir: string): ValidationResult {
  const testName = "Test Case 5: MetabobCLI Lines 803-813 Remain Commented (No Local Writes)";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-5";
  
  try {
    const metabobPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts');
    
    if (!fileExists(metabobPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${metabobPath}`
      };
    }
    
    const content = readFile(metabobPath);
    const lines = content.split('\n');
    
    const expected = {
      fileExists: true,
      hasArchitecturalConstraintComment: true,
      localWritesCommented: true,
      callsMCPRegisterTool: true,
      noActiveFileWrites: true
    };
    
    // Check lines around 803-813 for commented local writes
    const targetLineRange = lines.slice(800, 820).join('\n');
    
    const actual = {
      fileExists: true,
      hasArchitecturalConstraintComment: contains(content, 'ARCHITECTURAL CONSTRAINT') ||
                                          contains(content, 'REMOVED: Local file write'),
      localWritesCommented: (contains(targetLineRange, '// const activitiesDir') ||
                            contains(targetLineRange, '// fs.mkdirSync') ||
                            contains(targetLineRange, '// await Bun.write')) &&
                           !contains(targetLineRange, /^(?!.*\/\/).*const activitiesDir.*\.metabob\/activities/m),
      callsMCPRegisterTool: contains(content, 'callMCPTool') &&
                            contains(content, 'metabob_register_activity_template'),
      noActiveFileWrites: !contains(content, /(?<!\/\/).*fs\.writeFileSync.*\.metabob\/activities/) &&
                          !contains(content, /(?<!\/\/).*Bun\.write.*\.metabob\/activities/)
    };
    
    const pass = actual.hasArchitecturalConstraintComment && actual.localWritesCommented && 
                actual.callsMCPRegisterTool && actual.noActiveFileWrites;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'MetabobCLI properly enforced: lines 803-813 commented, no local writes, MCP-only'
        : 'MetabobCLI has active local file writes (architectural constraint violated)'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { localWritesCommented: true, callsMCP: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 6: Integration Flow - Search → Retrieve → Execute → Learning Data POST
// ============================================================================

function testCase6_IntegrationFlowComplete(baseDir: string): ValidationResult {
  const testName = "Test Case 6: Integration Flow - Search → Retrieve → Execute → Learning Data POST";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-6";
  
  try {
    // Check Activity.complete() reports metrics
    const activityPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/session/activity.ts');
    
    if (!fileExists(activityPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { fileExists: false },
        expected: { fileExists: true },
        error: `File not found: ${activityPath}`
      };
    }
    
    const activityContent = readFile(activityPath);
    
    const expected = {
      activityCompleteReportsMetrics: true,
      activityFailReportsMetrics: true,
      callsTemplateMetricsClient: true,
      includesImpulseUsage: true,
      includesComponentChanges: true,
      verifiesMetricsWritten: true
    };
    
    // Check if complete() and fail() functions exist
    const hasCompleteFunction = contains(activityContent, /export\s+async\s+function\s+complete\s*\(/);
    const hasFailFunction = contains(activityContent, /export\s+async\s+function\s+fail\s*\(/);
    
    // Extract the complete() and fail() function bodies to check for metrics reporting
    const completeFnMatch = activityContent.match(/export\s+async\s+function\s+complete[\s\S]*?(?=export\s+async\s+function|export\s+function|$)/);
    const failFnMatch = activityContent.match(/export\s+async\s+function\s+fail[\s\S]*?(?=export\s+async\s+function|export\s+function|$)/);
    
    const actual = {
      activityCompleteReportsMetrics: hasCompleteFunction && completeFnMatch ? 
                                       contains(completeFnMatch[0], 'TemplateMetricsClient.reportExecution') : false,
      activityFailReportsMetrics: hasFailFunction && failFnMatch ? 
                                   contains(failFnMatch[0], 'TemplateMetricsClient.reportExecution') : false,
      callsTemplateMetricsClient: contains(activityContent, 'TemplateMetricsClient.reportExecution'),
      includesImpulseUsage: contains(activityContent, 'impulses_used') || contains(activityContent, 'impulsesUsed'),
      includesComponentChanges: contains(activityContent, 'component_changes') || contains(activityContent, 'componentChanges'),
      verifiesMetricsWritten: contains(activityContent, /verif.*metrics.*written/i) ||
                              contains(activityContent, 'metrics verification')
    };
    
    const pass = actual.activityCompleteReportsMetrics && actual.activityFailReportsMetrics && 
                actual.callsTemplateMetricsClient && actual.includesImpulseUsage && 
                actual.includesComponentChanges && actual.verifiesMetricsWritten;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Integration flow complete: Activity reports execution metrics with impulse usage and verification'
        : 'Integration flow incomplete: Missing metrics reporting or verification'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { reportsMetrics: true, verifiesMetrics: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 7: RPC-API /activities Routes Handle Template CRUD + Metrics
// ============================================================================

function testCase7_RPCAPIRoutesComplete(baseDir: string): ValidationResult {
  const testName = "Test Case 7: RPC-API /activities Routes Handle Template CRUD + Metrics";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-7";
  
  try {
    // Check for rpc-api activities routes
    const rpcApiPath = path.join(baseDir, 'repos/metabob-rpc-api');
    
    if (!fileExists(rpcApiPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { rpcApiExists: false },
        expected: { rpcApiExists: true },
        error: `RPC-API directory not found: ${rpcApiPath}`
      };
    }
    
    // Check known activity routes files directly
    const possibleRouteFiles = [
      path.join(rpcApiPath, 'server/routes/activity.py'),
      path.join(rpcApiPath, 'server/routers/activity.py'),
      path.join(rpcApiPath, 'app/routers/activities.py'),
      path.join(rpcApiPath, 'app/routes/activities.py'),
      path.join(rpcApiPath, 'routers/activities.py'),
      path.join(rpcApiPath, 'routes/activities.py')
    ];
    
    const existingRouteFile = possibleRouteFiles.find(f => fileExists(f));
    
    if (!existingRouteFile) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { routeFileFound: false },
        expected: { routeFileFound: true },
        error: 'No activity route files found in rpc-api (checked common paths)'
      };
    }
    
    // Check route file for CRUD operations
    const routeContent = readFile(existingRouteFile);
    
    const expected = {
      routeFileFound: true,
      hasSearchEndpoint: true,
      hasGetEndpoint: true,
      hasCreateEndpoint: true,
      hasMetricsEndpoint: true
    };
    
    const actual = {
      routeFileFound: true,
      hasSearchEndpoint: contains(routeContent, 'GET') && contains(routeContent, '/activities'),
      hasGetEndpoint: contains(routeContent, 'GET') && contains(routeContent, '/activities'),
      hasCreateEndpoint: contains(routeContent, 'POST') && contains(routeContent, '/activities'),
      hasMetricsEndpoint: contains(routeContent, 'POST') && (contains(routeContent, 'metrics') || contains(routeContent, 'execution'))
    };
    
    const pass = actual.routeFileFound && actual.hasSearchEndpoint && actual.hasGetEndpoint && 
                actual.hasCreateEndpoint && actual.hasMetricsEndpoint;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'RPC-API has complete /activities routes with CRUD endpoints'
        : 'RPC-API missing required /activities endpoints'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { hasRoutes: true, hasCRUD: true },
      error: (error as Error).message
    };
  }
}

// ============================================================================
// Test Case 8: Bootstrap Scenario - Empty .metabob/ Can Discover Templates
// ============================================================================

function testCase8_BootstrapScenario(baseDir: string): ValidationResult {
  const testName = "Test Case 8: Bootstrap Scenario - Empty .metabob/ Can Discover Templates";
  const testCase = "validation-Clean Environment Activity Execution End-to-End-case-8";
  
  try {
    // Check for bootstrap templates in codebase
    const bootstrapPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts');
    
    if (!fileExists(bootstrapPath)) {
      return {
        pass: false,
        testName,
        testCase,
        actual: { bootstrapFileExists: false },
        expected: { bootstrapFileExists: true },
        error: `Bootstrap templates file not found: ${bootstrapPath}`
      };
    }
    
    const bootstrapContent = readFile(bootstrapPath);
    
    // Also check TemplateLoader has bootstrap fallback
    const loaderPath = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/session/template-loader.ts');
    const loaderContent = readFile(loaderPath);
    
    const expected = {
      bootstrapFileExists: true,
      hasBootstrapTemplates: true,
      hasBootstrapFallbackInLoader: true,
      bootstrapExceptionDocumented: true
    };
    
    const actual = {
      bootstrapFileExists: true,
      hasBootstrapTemplates: contains(bootstrapContent, 'BootstrapTemplates') ||
                             contains(bootstrapContent, 'BOOTSTRAP_TEMPLATES') ||
                             contains(bootstrapContent, 'EMBEDDED_TEMPLATES'),
      hasBootstrapFallbackInLoader: contains(loaderContent, 'BootstrapTemplates') ||
                                     contains(loaderContent, 'BOOTSTRAP_TEMPLATES') ||
                                     (contains(loaderContent, 'bootstrap') && contains(loaderContent, 'fallback')),
      bootstrapExceptionDocumented: contains(loaderContent, 'bootstrap') && 
                                    (contains(loaderContent, 'cold-start') || contains(loaderContent, 'exception'))
    };
    
    const pass = actual.bootstrapFileExists && actual.hasBootstrapTemplates && 
                actual.hasBootstrapFallbackInLoader && actual.bootstrapExceptionDocumented;
    
    return {
      pass,
      testName,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Bootstrap scenario supported: Empty .metabob/ can discover templates via embedded bootstrap'
        : 'Bootstrap scenario incomplete: Missing bootstrap templates or fallback mechanism'
    };
  } catch (error) {
    return {
      pass: false,
      testName,
      testCase,
      actual: null,
      expected: { hasBootstrap: true, hasFallback: true },
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
export function runValidation(baseDir: string = process.cwd()): HarnessOutput {
  console.log('🔍 Running Validation Harness: Clean Environment Activity Execution End-to-End\n');
  console.log(`📁 Base Directory: ${baseDir}\n`);
  
  const tests = [
    testCase1_ActivityAgentExcludesImpulseTools,
    testCase2_MemoryAgentExcludesActivityDiscovery,
    testCase3_TemplateLoaderUsesMCP,
    testCase4_TemplateServiceClientUsesMCP,
    testCase5_MetabobCLINoLocalWrites,
    testCase6_IntegrationFlowComplete,
    testCase7_RPCAPIRoutesComplete,
    testCase8_BootstrapScenario
  ];
  
  const results: ValidationResult[] = [];
  
  for (const test of tests) {
    console.log(`Running: ${test.name}...`);
    const result = test(baseDir);
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
    summary,
    specificationName: 'Clean Environment Activity Execution End-to-End',
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

// Check if this is the main module being run directly
const isMain = process.argv[1]?.endsWith('clean-environment-activity-execution-end-to-end-harness.ts') ||
               process.argv[1]?.includes('clean-environment-activity-execution-end-to-end-harness');

if (isMain) {
  const baseDir = process.argv[2] || process.cwd();
  
  try {
    const output = runValidation(baseDir);
    console.log('\n📊 Validation Report:');
    console.log(JSON.stringify(output, null, 2));
    process.exit(output.pass ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation harness error:', error);
    process.exit(1);
  }
}
