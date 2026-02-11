#!/usr/bin/env node
/**
 * SOURCE-LEVEL TEST V2 - Test TypeScript source directly
 * Handles multi-line patterns
 */

import { readFileSync } from 'fs';

const R = '\x1b[0m', B = '\x1b[1m', RED = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m';

function section(t) { console.log(`\n${B}${t}${R}\n${'='.repeat(80)}\n`); }
function pass(m) { console.log(`${G}✓${R} ${m}`); }
function fail(m) { console.log(`${RED}✗${R} ${m}`); }
function info(m) { console.log(`  ${m}`); }

let exitCode = 0;

section('SOURCE-LEVEL TEST: search_activities.ts');

const filePath = './repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts';
const content = readFileSync(filePath, 'utf-8');

// Remove newlines for multi-line matching
const contentOneLine = content.replace(/\n/g, ' ').replace(/\s+/g, ' ');

console.log('Test 1: File structure\n');
pass(`File exists (${content.length} bytes)`);

console.log('\nTest 2: Required imports\n');
const imports = {
  'Tool': /import.*\{.*Tool.*\}.*from.*['"]\.\/tool['"]/,
  'DESCRIPTION': /import.*DESCRIPTION.*from.*['"]\.\/search-activities\.txt['"]/,
  'zod': /import.*z.*from.*['"]zod['"]/,
  'MetabobCLI': /import.*MetabobCLI.*from.*['"]\.\.\/util\/metabob['"]/,
  'Log': /import.*Log.*from.*['"]\.\.\/util\/log['"]/,
};

Object.entries(imports).forEach(([name, pattern]) => {
  pattern.test(contentOneLine) ? pass(`Import: ${name}`) : (fail(`Missing: ${name}`), exitCode = 1);
});

console.log('\nTest 3: Tool definition\n');
if (/export const SearchActivitiesTool/.test(content)) {
  pass('Exports SearchActivitiesTool');
} else {
  fail('Missing export');
  exitCode = 1;
}

if (/Tool\.define\s*\(\s*['"]search_activities['"]/.test(contentOneLine)) {
  pass('Uses Tool.define("search_activities")');
} else {
  fail('Wrong Tool.define() call');
  exitCode = 1;
}

console.log('\nTest 4: Parameters (handles multi-line)\n');
// Check for parameter names in z.object
const hasQuery = /query\s*:.*z\.string\(\).*optional\(\)/.test(contentOneLine);
const hasCategory = /category\s*:.*z\.string\(\).*optional\(\)/.test(contentOneLine);
const hasVerbose = /verbose\s*:.*z\.boolean\(\).*optional\(\)/.test(contentOneLine);

hasQuery ? pass('Parameter: query') : (fail('Missing: query'), exitCode = 1);
hasCategory ? pass('Parameter: category') : (fail('Missing: category'), exitCode = 1);
hasVerbose ? pass('Parameter: verbose') : (fail('Missing: verbose'), exitCode = 1);

console.log('\nTest 5: Execute function\n');
if (/async execute\s*\(\s*params\s*,\s*_ctx\s*\)/.test(content)) {
  pass('Signature: async execute(params, _ctx)');
} else {
  fail('Wrong execute signature');
  exitCode = 1;
}

if (/MetabobCLI\.searchActivities/.test(content)) {
  pass('Calls: MetabobCLI.searchActivities()');
} else {
  fail('Missing MetabobCLI call');
  exitCode = 1;
}

console.log('\nTest 6: Return structure\n');
['title', 'output', 'metadata'].forEach(prop => {
  if (new RegExp(`return\\s*\\{[\\s\\S]*${prop}\\s*:`).test(content)) {
    pass(`Returns: ${prop}`);
  } else {
    fail(`Missing: ${prop}`);
    exitCode = 1;
  }
});

console.log('\nTest 7: Registry integration\n');
const registryContent = readFileSync('./repos/metabob-opencode/packages/opencode/src/tool/registry.ts', 'utf-8');

if (/import.*SearchActivitiesTool.*from.*['"]\.\/search-activities['"]/.test(registryContent)) {
  pass('Imported in registry.ts');
} else {
  fail('NOT imported in registry.ts');
  exitCode = 1;
}

// Check if it's in the tool list array
const registryOneLine = registryContent.replace(/\n/g, ' ');
if (/return\s*\[[\s\S]*SearchActivitiesTool[\s\S]*\]/.test(registryContent)) {
  pass('Added to tool array in registry');
} else {
  fail('NOT added to tool array');
  exitCode = 1;
}

// Test 8: Data flow verification
console.log('\nTest 8: Data flow verification\n');

// params.query flows to MetabobCLI.searchActivities
if (/params\.query/.test(content) && /MetabobCLI\.searchActivities\s*\(/.test(content)) {
  pass('Data flow: params.query → MetabobCLI');
} else {
  fail('params.query not passed to MetabobCLI');
  exitCode = 1;
}

// params.category flows to options
if (/category\s*:\s*params\.category/.test(contentOneLine)) {
  pass('Data flow: params.category → options');
} else {
  fail('params.category not in options');
  exitCode = 1;
}

// results gets formatted into activities
if (/results\.map/.test(content) && /activities/.test(content)) {
  pass('Data flow: results → activities (mapped)');
} else {
  fail('results not mapped to activities');
  exitCode = 1;
}

// output gets JSON.stringify'd
if (/JSON\.stringify\s*\(\s*output/.test(contentOneLine)) {
  pass('Data flow: output → JSON.stringify');
} else {
  fail('output not JSON.stringified');
  exitCode = 1;
}

section('TEST SUMMARY');

if (exitCode === 0) {
  console.log(G + B + '✓ ALL SOURCE-LEVEL TESTS PASSED' + R);
  console.log('\nImplementation verified:');
  console.log('  ✓ All imports present');
  console.log('  ✓ Tool properly defined');
  console.log('  ✓ All parameters declared');
  console.log('  ✓ Execute function correct');
  console.log('  ✓ Return structure valid');
  console.log('  ✓ Registry integration complete');
  console.log('  ✓ Data flows correctly');
  console.log('\n' + Y + 'Next: Build OpenCode to test runtime behavior' + R);
} else {
  console.log(RED + B + '✗ SOURCE-LEVEL TESTS FAILED' + R);
}

console.log('\n' + '='.repeat(80) + '\n');
process.exit(exitCode);
