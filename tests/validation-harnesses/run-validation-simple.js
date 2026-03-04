#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

function runValidation() {
  console.log("=" .repeat(80));
  console.log("Validation Results: metabob-cli-mcp-impulse-learning-flow");
  console.log("=".repeat(80));
  console.log();

  const results = [];
  
  // Case 1: recordTurnLearning uses callMCPTool
  try {
    const output = execSync(
      'cd repos/metabob-opencode && rg -A 80 "export async function recordTurnLearning" packages/opencode/src/util/metabob.ts | rg -q "callMCPTool"',
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    results.push({ case: 1, name: "recordTurnLearning uses MCP", pass: true });
    console.log("✓ PASS: Case 1 - recordTurnLearning uses callMCPTool");
  } catch (e) {
    results.push({ case: 1, name: "recordTurnLearning uses MCP", pass: false });
    console.log("✗ FAIL: Case 1 - recordTurnLearning does not use callMCPTool");
  }

  // Case 2: No direct HTTP to learning endpoints
  try {
    const output = execSync(
      'cd repos/metabob-opencode && rg "fetch.*learning-loop|fetch.*record-turn" packages/opencode/src/ || true',
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    const hasMatches = output.trim().length > 0;
    results.push({ case: 2, name: "No direct HTTP", pass: !hasMatches });
    if (hasMatches) {
      console.log("✗ FAIL: Case 2 - Found direct HTTP calls");
    } else {
      console.log("✓ PASS: Case 2 - No direct HTTP to learning endpoints");
    }
  } catch (e) {
    results.push({ case: 2, name: "No direct HTTP", pass: true });
    console.log("✓ PASS: Case 2 - No direct HTTP to learning endpoints");
  }

  // Case 3: record_turn_learning MCP tool exists
  try {
    execSync(
      'cd repos/metabob-cli && rg -q "async def record_turn_learning" src/metabob_cli/mcp/tools.py',
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    results.push({ case: 3, name: "MCP tool exists", pass: true });
    console.log("✓ PASS: Case 3 - record_turn_learning MCP tool exists");
  } catch (e) {
    results.push({ case: 3, name: "MCP tool exists", pass: false });
    console.log("✗ FAIL: Case 3 - record_turn_learning MCP tool not found");
  }

  // Case 4: startActivityExecution uses MCP
  try {
    execSync(
      'cd repos/metabob-opencode && rg -A 80 "export async function startActivityExecution" packages/opencode/src/util/metabob.ts | rg -q "callMCPTool"',
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    results.push({ case: 4, name: "startActivityExecution uses MCP", pass: true });
    console.log("✓ PASS: Case 4 - startActivityExecution uses callMCPTool");
  } catch (e) {
    results.push({ case: 4, name: "startActivityExecution uses MCP", pass: false });
    console.log("✗ FAIL: Case 4 - startActivityExecution does not use callMCPTool");
  }

  // Case 5: reportExecutionStep uses MCP
  try {
    execSync(
      'cd repos/metabob-opencode && rg -A 80 "export async function reportExecutionStep" packages/opencode/src/util/metabob.ts | rg -q "callMCPTool"',
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    results.push({ case: 5, name: "reportExecutionStep uses MCP", pass: true });
    console.log("✓ PASS: Case 5 - reportExecutionStep uses callMCPTool");
  } catch (e) {
    results.push({ case: 5, name: "reportExecutionStep uses MCP", pass: false });
    console.log("✗ FAIL: Case 5 - reportExecutionStep does not use callMCPTool");
  }

  // Case 6: CLI MCP forwards to rpc-api
  try {
    execSync(
      'cd repos/metabob-cli && rg -q "/api/v1/learning-loop/record-turn" src/metabob_cli/mcp/tools.py',
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    results.push({ case: 6, name: "CLI forwards to rpc-api", pass: true });
    console.log("✓ PASS: Case 6 - CLI MCP forwards to /api/v1/learning-loop/record-turn");
  } catch (e) {
    results.push({ case: 6, name: "CLI forwards to rpc-api", pass: false });
    console.log("✗ FAIL: Case 6 - CLI MCP does not forward to rpc-api");
  }

  console.log();
  console.log("=".repeat(80));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Summary: ${passed}/${results.length} passed, ${failed}/${results.length} failed`);
  console.log("Overall: " + (failed === 0 ? "✓ PASS" : "✗ FAIL"));
  console.log("=".repeat(80));

  return { overallPass: failed === 0, results, summary: { total: results.length, passed, failed } };
}

if (require.main === module) {
  const result = runValidation();
  process.exit(result.overallPass ? 0 : 1);
}

module.exports = { runValidation };
