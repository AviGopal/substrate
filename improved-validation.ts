#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';

const baseDir = process.cwd();

// Test Case 5: Activity Agent Tool Configuration (Improved)
function test5() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
  if (!fs.existsSync(file)) {
    return { testName: "Activity Agent Tools", pass: false, actual: {fileExists: false}, expected: {hasSearchActivities: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  // Find activity agent section (starts around line 115)
  let inActivityAgent = false;
  let inTools = false;
  let toolCount = 0;
  let braceCount = 0;
  
  const tools: any = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('name: "activity"')) {
      inActivityAgent = true;
      continue;
    }
    
    if (inActivityAgent && line.includes('tools: {')) {
      inTools = true;
      braceCount = 1;
      continue;
    }
    
    if (inTools) {
      // Count braces
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      // Extract tool settings
      const toolMatch = line.match(/^\s*(\w+):\s*(true|false)/);
      if (toolMatch) {
        tools[toolMatch[1]] = toolMatch[2] === 'true';
      }
      
      // End of tools object
      if (braceCount === 0) {
        break;
      }
    }
  }
  
  const hasSearch = tools.search_activities === true;
  const hasActivity = tools.activity === true;
  const noCreate = tools.impulse_create === false;
  const noLoad = tools.impulse_load === false;
  
  return {
    testName: "Activity Agent Tool Configuration",
    pass: hasSearch && hasActivity && noCreate && noLoad,
    actual: { hasSearchActivities: hasSearch, hasActivity, noImpulseCreate: noCreate, noImpulseLoad: noLoad },
    expected: { hasSearchActivities: true, hasActivity: true, noImpulseCreate: true, noImpulseLoad: true }
  };
}

// Test Case 6: Memory Agent Tool Configuration (Improved)
function test6() {
  const file = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts');
  if (!fs.existsSync(file)) {
    return { testName: "Memory Agent Tools", pass: false, actual: {fileExists: false}, expected: {hasImpulseCreate: true} };
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  // Find memory agent section (starts around line 376)
  let inMemoryAgent = false;
  let inTools = false;
  let braceCount = 0;
  
  const tools: any = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('name: "memory"')) {
      inMemoryAgent = true;
      continue;
    }
    
    if (inMemoryAgent && line.includes('tools: {')) {
      inTools = true;
      braceCount = 1;
      continue;
    }
    
    if (inTools) {
      // Count braces
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      // Extract tool settings
      const toolMatch = line.match(/^\s*(\w+):\s*(true|false)/);
      if (toolMatch) {
        tools[toolMatch[1]] = toolMatch[2] === 'true';
      }
      
      // End of tools object (looking for "options:" after tools)
      if (line.includes('options:') || line.includes('builtIn:')) {
        break;
      }
    }
  }
  
  const hasActivity = tools.activity === true;
  const hasSearch = tools.search_activities === true;
  const hasCreate = tools.impulse_create === true;
  const hasLoad = tools.impulse_load === true;
  const hasUnload = tools.impulse_unload === true;
  
  return {
    testName: "Memory Agent Tool Configuration",
    pass: hasActivity && hasSearch && hasCreate && hasLoad && hasUnload,
    actual: { hasActivity, hasSearchActivities: hasSearch, hasImpulseCreate: hasCreate, hasImpulseLoad: hasLoad, hasImpulseUnload: hasUnload },
    expected: { hasActivity: true, hasSearchActivities: true, hasImpulseCreate: true, hasImpulseLoad: true, hasImpulseUnload: true }
  };
}

console.log('🔍 Running Improved Validation Tests\n');

const result5 = test5();
console.log(`Test 5: ${result5.testName}: ${result5.pass ? '✅ PASS' : '❌ FAIL'}`);
if (!result5.pass) {
  console.log('  Expected:', JSON.stringify(result5.expected));
  console.log('  Actual:', JSON.stringify(result5.actual));
}

const result6 = test6();
console.log(`Test 6: ${result6.testName}: ${result6.pass ? '✅ PASS' : '❌ FAIL'}`);
if (!result6.pass) {
  console.log('  Expected:', JSON.stringify(result6.expected));
  console.log('  Actual:', JSON.stringify(result6.actual));
}

console.log('\nBoth tests should now pass with improved parsing logic');
