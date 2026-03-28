#!/usr/bin/env node
/**
 * Runner script for metabob-cli-mcp-impulse-learning-flow validation harness
 * 
 * This script directly executes the validation checks without TypeScript compilation issues.
 */

const fs = require('fs');
const path = require('path');

// Validation Case 1: recordTurnLearning uses MCP
async function validateRecordTurnLearningUsesMCP() {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    function: "recordTurnLearning",
    pattern: "callMCPTool",
    shouldNotHave: "fetch(url",
  };

  try {
    const filePath = expected.file;
    
    if (!fs.existsSync(filePath)) {
      return {
        pass: false,
        actual: { exists: false },
        expected,
        reason: `File not found: ${filePath}`,
        timestamp: Date.now(),
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    
    // Extract recordTurnLearning function body
    const funcRegex = /export async function recordTurnLearning\([\s\S]*?\n  \}/;
    const match = content.match(funcRegex);
    
    if (!match) {
      return {
        pass: false,
        actual: { error: "recordTurnLearning function not found" },
        expected,
        reason: "Could not find recordTurnLearning function",
        timestamp: Date.now(),
      };
    }
    
    const funcBody = match[0];
    
    // Check for callMCPTool usage
    const hasMCPCall = funcBody.includes("callMCPTool");
    const hasDirectFetch = funcBody.includes("fetch(url");
    
    const pass = hasMCPCall && !hasDirectFetch;
    
    return {
      pass,
      actual: { 
        hasMCPCall, 
        hasDirectFetch,
        file: filePath,
      },
      expected,
      reason: pass
        ? "recordTurnLearning uses callMCPTool (COMPLIANT)"
        : `recordTurnLearning: hasMCPCall=${hasMCPCall}, hasDirectFetch=${hasDirectFetch} (expected: true, false)`,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to validate recordTurnLearning MCP usage",
      timestamp: Date.now(),
    };
  }
}

// Validation Case 2: No direct HTTP in learning code
async function validateNoDirectHTTPInLearningCode() {
  const expected = {
    files: [
      "repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts",
      "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    ],
    forbiddenPatterns: [
      'fetch.*learning-loop',
      'fetch.*record-turn',
      'fetch.*api/v1/learning',
    ],
    maxMatches: 0,
  };

  try {
    let totalMatches = 0;
    const matches = [];
    
    for (const file of expected.files) {
      if (!fs.existsSync(file)) {
        continue;
      }
      
      const content = fs.readFileSync(file, "utf-8");
      
      for (const pattern of expected.forbiddenPatterns) {
        const regex = new RegExp(pattern, "gi");
        const fileMatches = content.match(regex);
        
        if (fileMatches) {
          totalMatches += fileMatches.length;
          matches.push({
            file,
            pattern,
            count: fileMatches.length,
            samples: fileMatches.slice(0, 2),
          });
        }
      }
    }
    
    const pass = totalMatches === expected.maxMatches;
    
    return {
      pass,
      actual: { totalMatches, matches },
      expected,
      reason: pass
        ? "No direct HTTP calls to rpc-api learning endpoints (COMPLIANT)"
        : `Found ${totalMatches} direct HTTP calls to rpc-api learning endpoints (expected 0)`,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check for direct HTTP calls",
      timestamp: Date.now(),
    };
  }
}

// Validation Case 3: record_turn_learning MCP tool exists
async function validateRecordTurnLearningToolExists() {
  const expected = {
    file: "repos/metabob-cli/src/metabob_cli/mcp/tools.py",
    toolName: "record_turn_learning",
    decorator: "@mcp.tool",
  };

  try {
    const filePath = expected.file;
    
    if (!fs.existsSync(filePath)) {
      return {
        pass: false,
        actual: { exists: false },
        expected,
        reason: `File not found: ${filePath}`,
        timestamp: Date.now(),
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    
    // Check for @mcp.tool decorator followed by async def record_turn_learning
    const toolPattern = /@mcp\.tool\([\s\S]*?\n\s*name="record_turn_learning"/;
    const funcPattern = /async def record_turn_learning\(/;
    
    const hasDecorator = toolPattern.test(content);
    const hasFunction = funcPattern.test(content);
    
    const pass = hasDecorator && hasFunction;
    
    return {
      pass,
      actual: { 
        hasDecorator, 
        hasFunction,
        file: filePath,
      },
      expected,
      reason: pass
        ? "record_turn_learning MCP tool exists in CLI (COMPLIANT)"
        : `record_turn_learning tool: hasDecorator=${hasDecorator}, hasFunction=${hasFunction} (expected: true, true)`,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check for record_turn_learning MCP tool",
      timestamp: Date.now(),
    };
  }
}

// Validation Case 4: startActivityExecution uses MCP
async function validateStartActivityExecutionUsesMCP() {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    function: "startActivityExecution",
    mcpTool: "activity/start",
  };

  try {
    const filePath = expected.file;
    
    if (!fs.existsSync(filePath)) {
      return {
        pass: false,
        actual: { exists: false },
        expected,
        reason: `File not found: ${filePath}`,
        timestamp: Date.now(),
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    
    // Extract startActivityExecution function
    const funcRegex = /export async function startActivityExecution\([\s\S]*?\n  \}/;
    const match = content.match(funcRegex);
    
    if (!match) {
      return {
        pass: false,
        actual: { error: "startActivityExecution function not found" },
        expected,
        reason: "Could not find startActivityExecution function",
        timestamp: Date.now(),
      };
    }
    
    const funcBody = match[0];
    
    // Check for callMCPTool('activity/start') or callMCPTool("activity/start")
    const hasMCPCall = funcBody.includes("callMCPTool") && 
                       (funcBody.includes('"activity/start"') || funcBody.includes("'activity/start'"));
    
    const pass = hasMCPCall;
    
    return {
      pass,
      actual: { 
        hasMCPCall,
        file: filePath,
      },
      expected,
      reason: pass
        ? "startActivityExecution uses callMCPTool('activity/start') (COMPLIANT)"
        : "startActivityExecution does not use callMCPTool('activity/start')",
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to validate startActivityExecution MCP usage",
      timestamp: Date.now(),
    };
  }
}

// Validation Case 5: reportExecutionStep uses MCP
async function validateReportExecutionStepUsesMCP() {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    function: "reportExecutionStep",
    mcpTool: "report_execution_step",
  };

  try {
    const filePath = expected.file;
    
    if (!fs.existsSync(filePath)) {
      return {
        pass: false,
        actual: { exists: false },
        expected,
        reason: `File not found: ${filePath}`,
        timestamp: Date.now(),
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    
    // Extract reportExecutionStep function
    const funcRegex = /export async function reportExecutionStep\([\s\S]*?\n  \}/;
    const match = content.match(funcRegex);
    
    if (!match) {
      return {
        pass: false,
        actual: { error: "reportExecutionStep function not found" },
        expected,
        reason: "Could not find reportExecutionStep function",
        timestamp: Date.now(),
      };
    }
    
    const funcBody = match[0];
    
    // Check for callMCPTool('report_execution_step')
    const hasMCPCall = funcBody.includes("callMCPTool") && 
                       (funcBody.includes('"report_execution_step"') || funcBody.includes("'report_execution_step'"));
    
    const pass = hasMCPCall;
    
    return {
      pass,
      actual: { 
        hasMCPCall,
        file: filePath,
      },
      expected,
      reason: pass
        ? "reportExecutionStep uses callMCPTool('report_execution_step') (COMPLIANT)"
        : "reportExecutionStep does not use callMCPTool('report_execution_step')",
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to validate reportExecutionStep MCP usage",
      timestamp: Date.now(),
    };
  }
}

// Validation Case 6: CLI MCP forwards to rpc-api
async function validateCLIMCPForwardsToRPCAPI() {
  const expected = {
    file: "repos/metabob-cli/src/metabob_cli/mcp/tools.py",
    toolName: "record_turn_learning",
    endpoint: "/api/v1/learning-loop/record-turn",
  };

  try {
    const filePath = expected.file;
    
    if (!fs.existsSync(filePath)) {
      return {
        pass: false,
        actual: { exists: false },
        expected,
        reason: `File not found: ${filePath}`,
        timestamp: Date.now(),
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    
    // Extract record_turn_learning function body
    const funcRegex = /async def record_turn_learning\([\s\S]*?\n\s{0,8}(?:async def|@mcp\.tool|$)/;
    const match = content.match(funcRegex);
    
    if (!match) {
      return {
        pass: false,
        actual: { error: "record_turn_learning function not found" },
        expected,
        reason: "Could not find record_turn_learning function in CLI MCP",
        timestamp: Date.now(),
      };
    }
    
    const funcBody = match[0];
    
    // Check that it forwards to the correct rpc-api endpoint
    const forwardsToEndpoint = funcBody.includes(expected.endpoint);
    
    const pass = forwardsToEndpoint;
    
    return {
      pass,
      actual: { 
        forwardsToEndpoint,
        file: filePath,
      },
      expected,
      reason: pass
        ? `CLI MCP tool forwards to ${expected.endpoint} (COMPLIANT)`
        : `CLI MCP tool does not forward to ${expected.endpoint}`,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to validate CLI MCP forwarding",
      timestamp: Date.now(),
    };
  }
}

// Main validation runner
async function runValidation() {
  console.log("=".repeat(80));
  console.log("Validation Harness: Metabob CLI MCP Impulse Learning Flow");
  console.log("=".repeat(80));
  console.log();

  const results = [];

  // Run all validation cases
  const validators = [
    { name: "Case 1: recordTurnLearning uses MCP", fn: validateRecordTurnLearningUsesMCP },
    { name: "Case 2: No direct HTTP in learning code", fn: validateNoDirectHTTPInLearningCode },
    { name: "Case 3: record_turn_learning MCP tool exists", fn: validateRecordTurnLearningToolExists },
    { name: "Case 4: startActivityExecution uses MCP", fn: validateStartActivityExecutionUsesMCP },
    { name: "Case 5: reportExecutionStep uses MCP", fn: validateReportExecutionStepUsesMCP },
    { name: "Case 6: CLI MCP forwards to rpc-api", fn: validateCLIMCPForwardsToRPCAPI },
  ];

  for (const validator of validators) {
    console.log(`Running: ${validator.name}`);
    const result = await validator.fn();
    results.push(result);
    
    const status = result.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${status}: ${result.reason}`);
    
    if (!result.pass && result.actual?.error) {
      console.log(`  Error: ${result.actual.error}`);
    }
    console.log();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const overallPass = failed === 0;

  console.log("=".repeat(80));
  console.log("Summary");
  console.log("=".repeat(80));
  console.log(`Total:  ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log();
  console.log(`Overall: ${overallPass ? "✓ PASS" : "✗ FAIL"}`);
  console.log("=".repeat(80));

  return {
    overallPass,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
    },
  };
}

// Execute if run directly
if (require.main === module) {
  runValidation()
    .then((result) => {
      process.exit(result.overallPass ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation harness failed:", error);
      process.exit(1);
    });
}

module.exports = { runValidation };
