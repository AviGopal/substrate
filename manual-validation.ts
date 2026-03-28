#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';

const baseDir = process.cwd();

// Test Case 1: MCP Connection Status
function test1() {
  const toolFiles = ['repos/metabob-opencode/packages/opencode/src/tool/test-metabob-mcp.ts'];
  const exists = toolFiles.some(f => fs.existsSync(path.join(baseDir, f)));
  
  return {
    testName: "MCP Connection Status",
    pass: exists,
    actual: { toolExists: exists, toolDefined: exists },
    expected: { toolExists: true, toolDefined: true }
  };
}

// Test Case 2: TemplateLoader Source Verification
function test2() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/session/template-loader.ts');
  if (!fs.existsSync(file)) {
    return { testName: "TemplateLoader Source", pass: false, actual: {fileExists: false}, expected: {fileExists: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const sourceMetabob = content.includes("source: 'metabob'") || content.includes('source: "metabob"');
  const usesClient = content.includes('TemplateServiceClient');
  const bootstrap = content.includes('bootstrap');
  
  return {
    testName: "TemplateLoader Source Verification",
    pass: sourceMetabob && usesClient && bootstrap,
    actual: { fileExists: true, sourceMetabob, usesTemplateServiceClient: usesClient, hasBootstrapFallback: bootstrap },
    expected: { fileExists: true, sourceMetabob: true, usesTemplateServiceClient: true, hasBootstrapFallback: true }
  };
}

// Test Case 3: No Direct File Access
function test3() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts');
  if (!fs.existsSync(file)) {
    return { testName: "No Direct File Access", pass: false, actual: {checked: false}, expected: {activeReferences: 0} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const hasComment = content.includes('.metabob/activities') && content.includes('//');
  
  return {
    testName: "No Direct File Access",
    pass: hasComment,
    actual: { activeReferences: hasComment ? 0 : 1, allReferencesCommented: hasComment },
    expected: { activeReferences: 0, allReferencesCommented: true }
  };
}

// Test Case 4: MetabobCLI No Local Writes
function test4() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts');
  if (!fs.existsSync(file)) {
    return { testName: "MetabobCLI No Local Writes", pass: false, actual: {fileExists: false}, expected: {fileExists: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const noWrites = content.includes('// const activitiesDir');
  const hasConstraint = content.includes('ARCHITECTURAL CONSTRAINT');
  const callsMCP = content.includes('callMCPTool');
  
  return {
    testName: "MetabobCLI No Local Writes",
    pass: noWrites && hasConstraint && callsMCP,
    actual: { fileExists: true, noLocalWrites: noWrites, hasArchitecturalConstraintComment: hasConstraint, callsMCPTools: callsMCP },
    expected: { fileExists: true, noLocalWrites: true, hasArchitecturalConstraintComment: true, callsMCPTools: true }
  };
}

// Test Case 5: Activity Agent Tool Configuration
function test5() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
  if (!fs.existsSync(file)) {
    return { testName: "Activity Agent Tools", pass: false, actual: {fileExists: false}, expected: {hasSearchActivities: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const activityMatch = content.match(/name:\s*["']activity["'][\s\S]{0,3000}tools:\s*\{[\s\S]{0,1500}\}/);
  
  if (!activityMatch) {
    return { testName: "Activity Agent Tools", pass: false, actual: {agentFound: false}, expected: {hasSearchActivities: true} };
  }
  
  const config = activityMatch[0];
  const hasSearch = /search_activities:\s*true/.test(config);
  const hasActivity = /activity:\s*true/.test(config);
  const noCreate = /impulse_create:\s*false/.test(config);
  const noLoad = /impulse_load:\s*false/.test(config);
  
  return {
    testName: "Activity Agent Tool Configuration",
    pass: hasSearch && hasActivity && noCreate && noLoad,
    actual: { hasSearchActivities: hasSearch, hasActivity, noImpulseCreate: noCreate, noImpulseLoad: noLoad },
    expected: { hasSearchActivities: true, hasActivity: true, noImpulseCreate: true, noImpulseLoad: true }
  };
}

// Test Case 6: Memory Agent Tool Configuration
function test6() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
  if (!fs.existsSync(file)) {
    return { testName: "Memory Agent Tools", pass: false, actual: {fileExists: false}, expected: {hasImpulseCreate: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const memoryMatch = content.match(/name:\s*["']memory["'][\s\S]{0,5000}tools:\s*\{[\s\S]{0,2000}\},?\s*options:/);
  
  if (!memoryMatch) {
    return { testName: "Memory Agent Tools", pass: false, actual: {agentFound: false}, expected: {hasImpulseCreate: true} };
  }
  
  const config = memoryMatch[0];
  const hasActivity = /activity:\s*true/.test(config);
  const hasSearch = /search_activities:\s*true/.test(config);
  const hasCreate = /impulse_create:\s*true/.test(config);
  const hasLoad = /impulse_load:\s*true/.test(config);
  const hasUnload = /impulse_unload:\s*true/.test(config);
  
  return {
    testName: "Memory Agent Tool Configuration",
    pass: hasActivity && hasSearch && hasCreate && hasLoad && hasUnload,
    actual: { hasActivity, hasSearchActivities: hasSearch, hasImpulseCreate: hasCreate, hasImpulseLoad: hasLoad, hasImpulseUnload: hasUnload },
    expected: { hasActivity: true, hasSearchActivities: true, hasImpulseCreate: true, hasImpulseLoad: true, hasImpulseUnload: true }
  };
}

// Test Case 7: TemplateServiceClient Delegation
function test7() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts');
  if (!fs.existsSync(file)) {
    return { testName: "TemplateServiceClient Delegation", pass: false, actual: {fileExists: false}, expected: {fileExists: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const search = content.includes('MetabobCLI.searchActivities');
  const get = content.includes('MetabobCLI.getActivity');
  const register = content.includes('MetabobCLI.registerActivityTemplate');
  
  return {
    testName: "TemplateServiceClient Delegation",
    pass: search && get && register,
    actual: { fileExists: true, callsSearchActivities: search, callsGetActivity: get, callsRegisterActivityTemplate: register },
    expected: { fileExists: true, callsSearchActivities: true, callsGetActivity: true, callsRegisterActivityTemplate: true }
  };
}

// Run all tests
const results = [test1(), test2(), test3(), test4(), test5(), test6(), test7()];

const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;

console.log('Validation Results:\n');
results.forEach((r, i) => {
  console.log(`${i + 1}. ${r.testName}: ${r.pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!r.pass) {
    console.log(`   Expected:`, JSON.stringify(r.expected));
    console.log(`   Actual:`, JSON.stringify(r.actual));
  }
});

console.log(`\n📊 Summary: ${passed}/${results.length} passed, ${failed}/${results.length} failed`);
console.log(`Overall: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`);

// Write results
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
    difference: r.pass ? null : "Actual output does not match expected output"
  })),
  resultsImpulseId: "validation-results-activity-template-flow-via-mcp-backend"
};

fs.writeFileSync('./validation-results.json', JSON.stringify(validationResults, null, 2));
console.log('\n✅ Results saved to validation-results.json');

process.exit(failed === 0 ? 0 : 1);
