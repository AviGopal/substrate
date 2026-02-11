#!/usr/bin/env node
/**
 * SOURCE-LEVEL TEST - Test TypeScript source directly
 * Verifies the tool implementation is correct before building
 */

import { readFileSync } from 'fs';

const R = '\x1b[0m', B = '\x1b[1m', RED = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m';

function section(t) { console.log(`\n${B}${t}${R}\n${'='.repeat(80)}\n`); }
function pass(m) { console.log(`${G}✓${R} ${m}`); }
function fail(m) { console.log(`${RED}✗${R} ${m}`); }
function info(m) { console.log(`  ${m}`); }

let exitCode = 0;

section('SOURCE-LEVEL TEST: search_activities.ts');

// Test 1: File exists
console.log('Test 1: File existence\n');
const filePath = './repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts';
try {
  const content = readFileSync(filePath, 'utf-8');
  pass(`File exists (${content.length} bytes)`);
  
  // Test 2: Check imports
  console.log('\nTest 2: Required imports\n');
  const requiredImports = [
    { name: 'Tool', pattern: /import.*Tool.*from.*["']\.\/tool["']/ },
    { name: 'DESCRIPTION', pattern: /import.*DESCRIPTION.*from.*["']\.\/search-activities\.txt["']/ },
    { name: 'z (zod)', pattern: /import.*z.*from.*["']zod["']/ },
    { name: 'MetabobCLI', pattern: /import.*MetabobCLI.*from.*["']\.\.\/util\/metabob["']/ },
    { name: 'Log', pattern: /import.*Log.*from.*["']\.\.\/util\/log["']/ },
  ];
  
  requiredImports.forEach(({ name, pattern }) => {
    if (pattern.test(content)) {
      pass(`Has import: ${name}`);
    } else {
      fail(`Missing import: ${name}`);
      exitCode = 1;
    }
  });
  
  // Test 3: Tool definition
  console.log('\nTest 3: Tool definition structure\n');
  if (/export const SearchActivitiesTool/.test(content)) {
    pass('Exports SearchActivitiesTool');
  } else {
    fail('Does not export SearchActivitiesTool');
    exitCode = 1;
  }
  
  if (/Tool\.define\s*\(\s*["']search_activities["']/.test(content)) {
    pass('Uses Tool.define() with correct ID');
  } else {
    fail('Not using Tool.define() or wrong ID');
    exitCode = 1;
  }
  
  // Test 4: Parameters
  console.log('\nTest 4: Parameter definitions\n');
  const params = [
    { name: 'query', pattern: /query:\s*z\.string\(\)\.optional\(\)/ },
    { name: 'category', pattern: /category:\s*z\.string\(\)\.optional\(\)/ },
    { name: 'verbose', pattern: /verbose:\s*z\.boolean\(\)\.optional\(\)/ },
  ];
  
  params.forEach(({ name, pattern }) => {
    if (pattern.test(content)) {
      pass(`Has parameter: ${name}`);
    } else {
      fail(`Missing or incorrect parameter: ${name}`);
      exitCode = 1;
    }
  });
  
  // Test 5: Execute function
  console.log('\nTest 5: Execute function\n');
  if (/async execute\s*\(\s*params\s*,\s*_ctx\s*\)/.test(content)) {
    pass('Has async execute(params, _ctx) function');
  } else {
    fail('Missing or incorrect execute function signature');
    exitCode = 1;
  }
  
  if (/MetabobCLI\.searchActivities/.test(content)) {
    pass('Calls MetabobCLI.searchActivities()');
  } else {
    fail('Does not call MetabobCLI.searchActivities()');
    exitCode = 1;
  }
  
  // Test 6: Return structure
  console.log('\nTest 6: Return value structure\n');
  if (/return\s*\{[\s\S]*title:/.test(content)) {
    pass('Returns object with title');
  } else {
    fail('Return missing title property');
    exitCode = 1;
  }
  
  if (/return\s*\{[\s\S]*output:/.test(content)) {
    pass('Returns object with output');
  } else {
    fail('Return missing output property');
    exitCode = 1;
  }
  
  if (/return\s*\{[\s\S]*metadata:/.test(content)) {
    pass('Returns object with metadata');
  } else {
    fail('Return missing metadata property');
    exitCode = 1;
  }
  
  // Test 7: Check registry integration
  console.log('\nTest 7: Registry integration\n');
  const registryPath = './repos/metabob-opencode/packages/opencode/src/tool/registry.ts';
  const registryContent = readFileSync(registryPath, 'utf-8');
  
  if (/import.*SearchActivitiesTool.*from.*["']\.\/search-activities["']/.test(registryContent)) {
    pass('Imported in registry.ts');
  } else {
    fail('NOT imported in registry.ts');
    exitCode = 1;
  }
  
  if (/SearchActivitiesTool/.test(registryContent)) {
    pass('Added to registry tool list');
  } else {
    fail('NOT added to registry tool list');
    exitCode = 1;
  }
  
} catch (e) {
  fail(`Failed to read file: ${e.message}`);
  exitCode = 1;
}

// Summary
section('TEST SUMMARY');

if (exitCode === 0) {
  console.log(G + B + '✓ ALL SOURCE-LEVEL TESTS PASSED' + R);
  console.log('\nThe search_activities.ts file:');
  console.log('  ✓ Has all required imports');
  console.log('  ✓ Exports SearchActivitiesTool correctly');
  console.log('  ✓ Uses Tool.define() pattern');
  console.log('  ✓ Defines all required parameters');
  console.log('  ✓ Has proper execute function signature');
  console.log('  ✓ Calls MetabobCLI.searchActivities()');
  console.log('  ✓ Returns correct structure (title, output, metadata)');
  console.log('  ✓ Integrated into registry.ts');
  console.log('\n' + Y + 'Next step: Build OpenCode and run functional test' + R);
} else {
  console.log(RED + B + '✗ SOURCE-LEVEL TESTS FAILED' + R);
  console.log('\nThe implementation has issues. Review errors above.');
}

console.log('\n' + '='.repeat(80) + '\n');

process.exit(exitCode);
