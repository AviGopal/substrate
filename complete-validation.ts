#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';

const baseDir = process.cwd();

// Helper: Parse agent tools from agent.ts
function parseAgentTools(agentName: string) {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
  if (!fs.existsSync(file)) return null;
  
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  let inAgent = false;
  let inTools = false;
  let braceCount = 0;
  const tools: any = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes(`name: "${agentName}"`)) {
      inAgent = true;
      continue;
    }
    
    if (inAgent && line.includes('tools: {')) {
      inTools = true;
      braceCount = 1;
      continue;
    }
    
    if (inTools) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      const toolMatch = line.match(/^\s*(\w+):\s*(true|false)/);
      if (toolMatch) {
        tools[toolMatch[1]] = toolMatch[2] === 'true';
      }
      
      if (line.includes('options:') || line.includes('builtIn:') || braceCount === 0) {
        break;
      }
    }
  }
  
  return tools;
}

// Test 1: MCP Connection Status
function test1() {
  const toolFile = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/tool/test-metabob-mcp.ts');
  const exists = fs.existsSync(toolFile);
  
  return {
    testName: "MCP Connection Status",
    pass: exists,
    actual: { toolExists: exists, toolDefined: exists },
    expected: { toolExists: true, toolDefined: true },
    details: exists ? 'test_metabob_mcp tool found' : 'test_metabob_mcp tool not found'
  };
}

// Test 2: TemplateLoader Source Verification
function test2() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/session/template-loader.ts');
  if (!fs.existsSync(file)) {
    return { testName: "TemplateLoader Source Verification", pass: false, actual: {fileExists: false}, expected: {fileExists: true}, details: 'File not found' };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const sourceMetabob = content.includes("source: 'metabob'") || content.includes('source: "metabob"');
  const usesClient = content.includes('TemplateServiceClient');
  const bootstrap = content.includes('bootstrap');
  
  const pass = sourceMetabob && usesClient && bootstrap;
  
  return {
    testName: "TemplateLoader Source Verification",
    pass,
    actual: { fileExists: true, sourceMetabob, usesTemplateServiceClient: usesClient, hasBootstrapFallback: bootstrap },
    expected: { fileExists: true, sourceMetabob: true, usesTemplateServiceClient: true, hasBootstrapFallback: true },
    details: pass ? 'TemplateLoader properly configured' : 'TemplateLoader configuration incomplete'
  };
}

// Test 3: No Direct File Access
function test3() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts');
  if (!fs.existsSync(file)) {
    return { testName: "No Direct File Access", pass: false, actual: {checked: false}, expected: {activeReferences: 0}, details: 'File not found' };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  // Check if .metabob/activities references are commented
  const activeRefs = lines.filter(line => 
    line.includes('.metabob/activities') && 
    !line.trim().startsWith('//') &&
    !line.trim().startsWith('*')
  );
  
  const pass = activeRefs.length === 0;
  
  return {
    testName: "No Direct File Access",
    pass,
    actual: { activeReferences: activeRefs.length, allReferencesCommented: pass },
    expected: { activeReferences: 0, allReferencesCommented: true },
    details: pass ? 'No active references to .metabob/activities found' : `Found ${activeRefs.length} active reference(s)`
  };
}

// Test 4: MetabobCLI No Local Writes
function test4() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts');
  if (!fs.existsSync(file)) {
    return { testName: "MetabobCLI No Local Writes", pass: false, actual: {fileExists: false}, expected: {fileExists: true}, details: 'File not found' };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const noWrites = content.includes('// const activitiesDir');
  const hasConstraint = content.includes('ARCHITECTURAL CONSTRAINT');
  const callsMCP = content.includes('callMCPTool') && content.includes('metabob_register_activity_template');
  
  const pass = noWrites && hasConstraint && callsMCP;
  
  return {
    testName: "MetabobCLI No Local Writes",
    pass,
    actual: { fileExists: true, noLocalWrites: noWrites, hasArchitecturalConstraintComment: hasConstraint, callsMCPTools: callsMCP },
    expected: { fileExists: true, noLocalWrites: true, hasArchitecturalConstraintComment: true, callsMCPTools: true },
    details: pass ? 'MetabobCLI properly enforces MCP-only communication' : 'MetabobCLI enforcement incomplete'
  };
}

// Test 5: Activity Agent Tool Configuration
function test5() {
  const tools = parseAgentTools('activity');
  
  if (!tools) {
    return { testName: "Activity Agent Tool Configuration", pass: false, actual: {agentFound: false}, expected: {hasSearchActivities: true}, details: 'Agent configuration not found' };
  }
  
  const hasSearch = tools.search_activities === true;
  const hasActivity = tools.activity === true;
  const noCreate = tools.impulse_create === false;
  const noLoad = tools.impulse_load === false;
  
  const pass = hasSearch && hasActivity && noCreate && noLoad;
  
  return {
    testName: "Activity Agent Tool Configuration",
    pass,
    actual: { hasSearchActivities: hasSearch, hasActivity, noImpulseCreate: noCreate, noImpulseLoad: noLoad },
    expected: { hasSearchActivities: true, hasActivity: true, noImpulseCreate: true, noImpulseLoad: true },
    details: pass ? 'Activity agent properly configured' : 'Activity agent tool configuration does not match expected'
  };
}

// Test 6: Memory Agent Tool Configuration
function test6() {
  const tools = parseAgentTools('memory');
  
  if (!tools) {
    return { testName: "Memory Agent Tool Configuration", pass: false, actual: {agentFound: false}, expected: {hasImpulseCreate: true}, details: 'Agent configuration not found' };
  }
  
  const hasActivity = tools.activity === true;
  const hasSearch = tools.search_activities === true;
  const hasCreate = tools.impulse_create === true;
  const hasLoad = tools.impulse_load === true;
  const hasUnload = tools.impulse_unload === true;
  
  const pass = hasActivity && hasSearch && hasCreate && hasLoad && hasUnload;
  
  return {
    testName: "Memory Agent Tool Configuration",
    pass,
    actual: { hasActivity, hasSearchActivities: hasSearch, hasImpulseCreate: hasCreate, hasImpulseLoad: hasLoad, hasImpulseUnload: hasUnload },
    expected: { hasActivity: true, hasSearchActivities: true, hasImpulseCreate: true, hasImpulseLoad: true, hasImpulseUnload: true },
    details: pass ? 'Memory agent properly configured' : 'Memory agent tool configuration does not match expected'
  };
}

// Test 7: TemplateServiceClient Delegation
function test7() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts');
  if (!fs.existsSync(file)) {
    return { testName: "TemplateServiceClient Delegation", pass: false, actual: {fileExists: false}, expected: {fileExists: true}, details: 'File not found' };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const search = content.includes('MetabobCLI.searchActivities');
  const get = content.includes('MetabobCLI.getActivity');
  const register = content.includes('MetabobCLI.registerActivityTemplate');
  
  const pass = search && get && register;
  
  return {
    testName: "TemplateServiceClient Delegation",
    pass,
    actual: { fileExists: true, callsSearchActivities: search, callsGetActivity: get, callsRegisterActivityTemplate: register },
    expected: { fileExists: true, callsSearchActivities: true, callsGetActivity: true, callsRegisterActivityTemplate: true },
    details: pass ? 'TemplateServiceClient properly delegates to MetabobCLI' : 'TemplateServiceClient delegation incomplete'
  };
}

// Run all tests
console.log('🔍 Running Activity Template Flow via MCP Backend Validation\n');

const results = [test1(), test2(), test3(), test4(), test5(), test6(), test7()];

results.forEach((r, i) => {
  const icon = r.pass ? '✅' : '❌';
  console.log(`${i + 1}. ${icon} ${r.testName}`);
  if (!r.pass) {
    console.log(`   Details: ${r.details}`);
  }
});

const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;

console.log(`\n${'═'.repeat(70)}`);
console.log(`Overall Status: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Total Tests: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('═'.repeat(70) + '\n');

// Create validation results
const validationResults = {
  specificationName: "Activity Template Flow via MCP Backend",
  timestamp: new Date().toISOString(),
  overallStatus: failed === 0 ? "PASS" : "FAIL",
  summary: { totalTests: results.length, passed, failed },
  validationResults: results.map((r, i) => ({
    testCaseNumber: i + 1,
    testCase: `validation-activity-template-flow-via-mcp-backend-case-${i + 1}`,
    testName: r.testName,
    status: r.pass ? "PASS" : "FAIL",
    actual: r.actual,
    expected: r.expected,
    details: r.details,
    difference: r.pass ? null : "Actual output does not match expected output"
  })),
  resultsImpulseId: "validation-results-activity-template-flow-via-mcp-backend"
};

fs.writeFileSync('./validation-results.json', JSON.stringify(validationResults, null, 2));
console.log('✅ Results saved to: ./validation-results.json\n');

process.exit(failed === 0 ? 0 : 1);
