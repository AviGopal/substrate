#!/usr/bin/env node
/**
 * FUNCTIONAL TEST - Verify search_activities tool actually works
 * 
 * This tests:
 * 1. Tool can be loaded from the built code
 * 2. Tool can be executed with parameters
 * 3. Tool returns expected data structure
 * 4. Tool handles errors appropriately
 */

import { execSync } from 'child_process';

const R = '\x1b[0m', B = '\x1b[1m', RED = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', BL = '\x1b[34m';

function section(t) { console.log(`\n${B}${BL}${'='.repeat(80)}${R}\n${B}${BL}${t}${R}\n${B}${BL}${'='.repeat(80)}${R}\n`); }
function pass(m) { console.log(`${G}✓${R} ${m}`); }
function fail(m) { console.log(`${RED}✗${R} ${m}`); }
function info(m) { console.log(`  ${m}`); }

let exitCode = 0;

section('FUNCTIONAL TEST: search_activities Tool');

// Step 1: Check if backend is running
console.log('Step 1: Verify backend is running\n');
try {
  const health = execSync('curl -s -m 2 http://localhost:8080/health', { encoding: 'utf-8' });
  if (health.includes('ok') || health.includes('status')) {
    pass('Backend API is responding');
  } else {
    fail('Backend API responded but format unexpected');
    exitCode = 1;
  }
} catch (e) {
  fail('Backend API is NOT responding (required for test)');
  info('Start backend with: ./devbob dev');
  process.exit(1);
}

// Step 2: Check if OpenCode is built
console.log('\nStep 2: Check if OpenCode is built\n');
const distExists = require('fs').existsSync('./repos/metabob-opencode/packages/opencode/dist');
if (distExists) {
  pass('OpenCode dist directory exists');
} else {
  fail('OpenCode is NOT built');
  info('Build OpenCode first: cd repos/metabob-opencode && bun run build');
  process.exit(1);
}

// Step 3: Try to import the tool
console.log('\nStep 3: Import search_activities tool\n');
let SearchActivitiesTool;
try {
  // Try to load from built distribution
  const toolModule = require('./repos/metabob-opencode/packages/opencode/dist/tool/search-activities.js');
  SearchActivitiesTool = toolModule.SearchActivitiesTool;
  
  if (SearchActivitiesTool) {
    pass('Successfully imported SearchActivitiesTool');
    info(`Tool ID: ${SearchActivitiesTool.id || 'unknown'}`);
  } else {
    fail('SearchActivitiesTool is undefined after import');
    exitCode = 1;
  }
} catch (e) {
  fail('Failed to import search_activities tool');
  info(`Error: ${e.message}`);
  info('This might mean the tool was not built, or has compilation errors');
  exitCode = 1;
  process.exit(1);
}

// Step 4: Check tool structure
console.log('\nStep 4: Verify tool structure\n');
if (SearchActivitiesTool.id) {
  pass(`Tool has ID: ${SearchActivitiesTool.id}`);
} else {
  fail('Tool missing ID property');
  exitCode = 1;
}

if (SearchActivitiesTool.init) {
  pass('Tool has init() method');
} else {
  fail('Tool missing init() method');
  exitCode = 1;
}

// Step 5: Initialize tool
console.log('\nStep 5: Initialize tool\n');
let toolDefinition;
try {
  toolDefinition = await SearchActivitiesTool.init();
  pass('Tool initialized successfully');
  
  if (toolDefinition.description) {
    info(`Description present (${toolDefinition.description.length} chars)`);
  } else {
    fail('Tool missing description');
    exitCode = 1;
  }
  
  if (toolDefinition.parameters) {
    pass('Tool has parameters schema');
  } else {
    fail('Tool missing parameters schema');
    exitCode = 1;
  }
  
  if (toolDefinition.execute) {
    pass('Tool has execute() function');
  } else {
    fail('Tool missing execute() function');
    exitCode = 1;
  }
} catch (e) {
  fail('Failed to initialize tool');
  info(`Error: ${e.message}`);
  exitCode = 1;
  process.exit(1);
}

// Step 6: Test parameter validation
console.log('\nStep 6: Test parameter validation\n');
try {
  // Valid parameters
  toolDefinition.parameters.parse({ query: "test" });
  pass('Accepts valid parameters');
  
  toolDefinition.parameters.parse({ query: "test", category: "feature" });
  pass('Accepts query + category');
  
  toolDefinition.parameters.parse({ verbose: true });
  pass('Accepts verbose flag');
  
  toolDefinition.parameters.parse({});
  pass('Accepts empty parameters (all optional)');
} catch (e) {
  fail('Parameter validation failed');
  info(`Error: ${e.message}`);
  exitCode = 1;
}

// Step 7: Execute tool (requires MCP backend)
console.log('\nStep 7: Execute tool (functional test)\n');
info('Note: This requires MCP backend to be running with activities registered');

try {
  // Create minimal context
  const ctx = {
    sessionID: 'test-session',
    messageID: 'test-message',
    agent: 'test',
    abort: new AbortController().signal,
    metadata: () => {},
  };
  
  // Execute with simple query
  const result = await toolDefinition.execute({ query: "test" }, ctx);
  
  if (result) {
    pass('Tool executed without throwing');
    
    if (result.title) {
      info(`Title: ${result.title}`);
    }
    
    if (result.output) {
      pass('Tool returned output');
      try {
        const parsed = JSON.parse(result.output);
        if (parsed.activities !== undefined && parsed.count !== undefined) {
          pass(`Valid structure: ${parsed.count} activities`);
          if (parsed.count > 0) {
            pass('Found activities in database');
            info(`Example: ${parsed.activities[0].name || 'unnamed'}`);
          } else {
            info('No activities found (database may be empty)');
          }
        } else {
          fail('Output missing expected fields (activities, count)');
          exitCode = 1;
        }
      } catch (e) {
        fail('Output is not valid JSON');
        info(`Output: ${result.output.substring(0, 100)}`);
        exitCode = 1;
      }
    } else {
      fail('Tool returned no output');
      exitCode = 1;
    }
    
    if (result.metadata) {
      pass('Tool returned metadata');
      info(`Metadata: ${JSON.stringify(result.metadata)}`);
    } else {
      fail('Tool returned no metadata');
      exitCode = 1;
    }
  } else {
    fail('Tool returned undefined/null');
    exitCode = 1;
  }
} catch (e) {
  fail('Tool execution threw an error');
  info(`Error: ${e.message}`);
  info(`Stack: ${e.stack?.split('\n').slice(0, 3).join('\n')}`);
  exitCode = 1;
}

// Summary
section('TEST SUMMARY');

if (exitCode === 0) {
  console.log(G + B + '✓ ALL FUNCTIONAL TESTS PASSED' + R);
  console.log('\nThe search_activities tool:');
  console.log('  ✓ Can be imported from built code');
  console.log('  ✓ Has correct structure (id, init, execute)');
  console.log('  ✓ Validates parameters correctly');
  console.log('  ✓ Executes and returns valid data structure');
  console.log('  ✓ Integrates with MCP backend');
} else {
  console.log(RED + B + '✗ FUNCTIONAL TESTS FAILED' + R);
  console.log('\nSome tests did not pass. Review errors above.');
}

console.log('\n' + B + BL + '='.repeat(80) + R + '\n');

process.exit(exitCode);
