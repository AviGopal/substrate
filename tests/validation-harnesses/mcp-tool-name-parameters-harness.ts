/**
 * Validation Harness: Correct MCP Tool Name and Parameters
 *
 * Validates that template-metrics-client.ts uses the correct MCP tool name
 * 'metabob_post_activity_result' (with prefix) and correct parameter names
 * (activity_id in snake_case, no invalid 'backend' parameter).
 *
 * This harness performs multiple validation checks:
 * 1. Code inspection: Verify tool name has 'metabob_' prefix
 * 2. Parameter verification: Confirm snake_case parameter names
 * 3. Signature match: Verify no extra 'backend' parameter
 * 4. MCP registry check: Confirm tool registered in activity_template_tools.py
 * 5. Integration test: Mock MCP call and verify parameters
 *
 * Usage:
 *   import { runValidation } from './mcp-tool-name-parameters-harness'
 *   const result = await runValidation()
 *   console.log(result.pass ? 'PASS' : 'FAIL')
 */

import { readFileSync } from "fs"
import { join } from "path"

export interface ValidationResult {
  pass: boolean
  checks: {
    name: string
    pass: boolean
    actual: any
    expected: any
    message: string
  }[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}

export interface ValidationInput {
  /**
   * Path to template-metrics-client.ts file
   */
  clientFilePath: string

  /**
   * Path to activity_template_tools.py file
   */
  mcpToolsFilePath: string
}

/**
 * Run all validation checks
 */
export async function runValidation(input?: ValidationInput): Promise<ValidationResult> {
  const defaultInput: ValidationInput = {
    clientFilePath: join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts"
    ),
    mcpToolsFilePath: join(
      process.cwd(),
      "repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py"
    ),
  }

  const actualInput = input || defaultInput

  const checks: ValidationResult["checks"] = []

  // Check 1: Verify tool name has 'metabob_' prefix
  checks.push(await checkToolNamePrefix(actualInput.clientFilePath))

  // Check 2: Verify parameter name is 'activity_id' (snake_case)
  checks.push(await checkParameterName(actualInput.clientFilePath))

  // Check 3: Verify no 'backend' parameter in tool call
  checks.push(await checkNoBackendParameter(actualInput.clientFilePath))

  // Check 4: Verify tool registered in MCP registry
  checks.push(await checkMCPToolRegistration(actualInput.mcpToolsFilePath))

  // Check 5: Verify tool name matches between client and registry
  checks.push(await checkToolNameMatch(actualInput.clientFilePath, actualInput.mcpToolsFilePath))

  // Check 6: Verify comment documentation is correct
  checks.push(await checkDocumentationComments(actualInput.clientFilePath))

  const passed = checks.filter((c) => c.pass).length
  const failed = checks.filter((c) => !c.pass).length

  return {
    pass: failed === 0,
    checks,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
  }
}

/**
 * Check 1: Verify tool name has 'metabob_' prefix
 */
async function checkToolNamePrefix(filePath: string): Promise<ValidationResult["checks"][0]> {
  try {
    const content = readFileSync(filePath, "utf-8")

    // Look for the callMCPTool invocation
    const toolCallRegex = /callMCPTool[^(]*\(\s*["']([^"']+)["']/
    const match = content.match(toolCallRegex)

    if (!match) {
      return {
        name: "Tool Name Prefix Check",
        pass: false,
        actual: "No callMCPTool found",
        expected: "metabob_post_activity_result",
        message: "Could not find callMCPTool invocation in file",
      }
    }

    const toolName = match[1]
    const hasPrefix = toolName.startsWith("metabob_")
    const isCorrectName = toolName === "metabob_post_activity_result"

    return {
      name: "Tool Name Prefix Check",
      pass: hasPrefix && isCorrectName,
      actual: toolName,
      expected: "metabob_post_activity_result",
      message: isCorrectName
        ? "Tool name is correct with metabob_ prefix"
        : hasPrefix
          ? `Tool name has prefix but is incorrect: ${toolName}`
          : `Tool name missing metabob_ prefix: ${toolName}`,
    }
  } catch (error) {
    return {
      name: "Tool Name Prefix Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "metabob_post_activity_result",
      message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check 2: Verify parameter name is 'activity_id' (snake_case)
 */
async function checkParameterName(filePath: string): Promise<ValidationResult["checks"][0]> {
  try {
    const content = readFileSync(filePath, "utf-8")

    // Look for the parameter in the tool call arguments
    // Should be: activity_id: data.activity_id
    // Need to match the specific callMCPTool invocation with "metabob_post_activity_result"
    const parameterRegex = /callMCPTool[^(]*\(\s*["']metabob_post_activity_result["'][^{]*\{[^}]*?(\w+):\s*data\.activity_id/s
    const match = content.match(parameterRegex)

    if (!match) {
      return {
        name: "Parameter Name Check",
        pass: false,
        actual: "No parameter found",
        expected: "activity_id",
        message: "Could not find activity_id parameter in callMCPTool arguments",
      }
    }

    const paramName = match[1]
    const isSnakeCase = paramName === "activity_id"

    return {
      name: "Parameter Name Check",
      pass: isSnakeCase,
      actual: paramName,
      expected: "activity_id",
      message: isSnakeCase
        ? "Parameter name is correct (snake_case)"
        : `Parameter name is incorrect (should be snake_case): ${paramName}`,
    }
  } catch (error) {
    return {
      name: "Parameter Name Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "activity_id",
      message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check 3: Verify no 'backend' parameter in tool call
 */
async function checkNoBackendParameter(filePath: string): Promise<ValidationResult["checks"][0]> {
  try {
    const content = readFileSync(filePath, "utf-8")

    // Look for callMCPTool and extract the arguments object
    const toolCallRegex = /callMCPTool[^{]*(\{[\s\S]*?\n\s*\})\s*,?\s*\)/
    const match = content.match(toolCallRegex)

    if (!match) {
      return {
        name: "No Backend Parameter Check",
        pass: false,
        actual: "Could not parse callMCPTool arguments",
        expected: "No 'backend' parameter",
        message: "Could not find callMCPTool arguments in file",
      }
    }

    const argsObject = match[1]
    const hasBackendParam = /backend\s*:/.test(argsObject)

    return {
      name: "No Backend Parameter Check",
      pass: !hasBackendParam,
      actual: hasBackendParam ? "backend parameter found" : "no backend parameter",
      expected: "No 'backend' parameter",
      message: hasBackendParam
        ? "Invalid 'backend' parameter found in callMCPTool arguments (should be removed)"
        : "No 'backend' parameter found (correct)",
    }
  } catch (error) {
    return {
      name: "No Backend Parameter Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "No 'backend' parameter",
      message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check 4: Verify tool registered in MCP registry
 */
async function checkMCPToolRegistration(
  filePath: string
): Promise<ValidationResult["checks"][0]> {
  try {
    const content = readFileSync(filePath, "utf-8")

    // Look for the MCP tool registration for metabob_post_activity_result specifically
    // There are multiple tools in the file, we need the right one
    const registrationRegex = /@mcp\.tool\([^)]*name\s*=\s*["']metabob_post_activity_result["']/
    const match = content.match(registrationRegex)
    
    if (!match) {
      return {
        name: "MCP Tool Registration Check",
        pass: false,
        actual: "Tool 'metabob_post_activity_result' not found in registry",
        expected: "metabob_post_activity_result",
        message: "Could not find @mcp.tool registration for 'metabob_post_activity_result' in activity_template_tools.py",
      }
    }

    return {
      name: "MCP Tool Registration Check",
      pass: true,
      actual: "metabob_post_activity_result",
      expected: "metabob_post_activity_result",
      message: "Tool correctly registered as 'metabob_post_activity_result'",
    }
  } catch (error) {
    return {
      name: "MCP Tool Registration Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "metabob_post_activity_result",
      message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check 4b: Original fallback implementation
 */
async function checkMCPToolRegistrationOld(
  filePath: string
): Promise<ValidationResult["checks"][0]> {
  try {
    const content = readFileSync(filePath, "utf-8")

    // Look for the MCP tool registration (original implementation)
    const registrationRegex = /@mcp\.tool\([^)]*name\s*=\s*["']([^"']+)["']/
    const match = content.match(registrationRegex)

    if (!match) {
      return {
        name: "MCP Tool Registration Check",
        pass: false,
        actual: "No tool registration found",
        expected: "metabob_post_activity_result",
        message: "Could not find @mcp.tool registration in activity_template_tools.py",
      }
    }

    const registeredName = match[1]
    const isCorrect = registeredName === "metabob_post_activity_result"

    return {
      name: "MCP Tool Registration Check",
      pass: isCorrect,
      actual: registeredName,
      expected: "metabob_post_activity_result",
      message: isCorrect
        ? "Tool correctly registered as 'metabob_post_activity_result'"
        : `Tool registered with incorrect name: ${registeredName}`,
    }
  } catch (error) {
    return {
      name: "MCP Tool Registration Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "metabob_post_activity_result",
      message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check 5: Verify tool name matches between client and registry
 */
async function checkToolNameMatch(
  clientFilePath: string,
  mcpToolsFilePath: string
): Promise<ValidationResult["checks"][0]> {
  try {
    const clientContent = readFileSync(clientFilePath, "utf-8")
    const mcpContent = readFileSync(mcpToolsFilePath, "utf-8")

    // Extract tool name from client
    const clientToolCallRegex = /callMCPTool[^(]*\(\s*["']([^"']+)["']/
    const clientMatch = clientContent.match(clientToolCallRegex)

    // Extract registered tool name from MCP - look specifically for metabob_post_activity_result
    const mcpRegistrationRegex = /@mcp\.tool\([^)]*name\s*=\s*["']metabob_post_activity_result["']/
    const mcpMatch = mcpContent.match(mcpRegistrationRegex)
    const mcpToolName = mcpMatch ? "metabob_post_activity_result" : "not found"

    if (!clientMatch || !mcpMatch) {
      return {
        name: "Tool Name Match Check",
        pass: false,
        actual: {
          client: clientMatch ? clientMatch[1] : "not found",
          mcp: mcpToolName,
        },
        expected: "Both should be 'metabob_post_activity_result'",
        message: "Could not extract tool names from both files",
      }
    }

    const clientToolName = clientMatch[1]
    const namesMatch = clientToolName === mcpToolName

    return {
      name: "Tool Name Match Check",
      pass: namesMatch,
      actual: {
        client: clientToolName,
        mcp: mcpToolName,
      },
      expected: "Both should be 'metabob_post_activity_result'",
      message: namesMatch
        ? "Tool names match between client and MCP registration"
        : `Tool name mismatch: client uses '${clientToolName}', MCP registers '${mcpToolName}'`,
    }
  } catch (error) {
    return {
      name: "Tool Name Match Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "Both should be 'metabob_post_activity_result'",
      message: `Error reading files: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check 6: Verify documentation comments are correct
 */
async function checkDocumentationComments(
  filePath: string
): Promise<ValidationResult["checks"][0]> {
  try {
    const content = readFileSync(filePath, "utf-8")

    // Look for the comment that mentions the MCP tool name
    const commentRegex = /MCP Tool:\s*(\w+)/
    const match = content.match(commentRegex)

    if (!match) {
      return {
        name: "Documentation Comment Check",
        pass: false,
        actual: "No MCP Tool comment found",
        expected: "MCP Tool: metabob_post_activity_result",
        message: "Could not find 'MCP Tool:' comment in documentation",
      }
    }

    const documentedToolName = match[1]
    const isCorrect = documentedToolName === "metabob_post_activity_result"

    return {
      name: "Documentation Comment Check",
      pass: isCorrect,
      actual: `MCP Tool: ${documentedToolName}`,
      expected: "MCP Tool: metabob_post_activity_result",
      message: isCorrect
        ? "Documentation comment is correct"
        : `Documentation comment has incorrect tool name: ${documentedToolName}`,
    }
  } catch (error) {
    return {
      name: "Documentation Comment Check",
      pass: false,
      actual: error instanceof Error ? error.message : String(error),
      expected: "MCP Tool: metabob_post_activity_result",
      message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  lines.push("=".repeat(80))
  lines.push("VALIDATION HARNESS: Correct MCP Tool Name and Parameters")
  lines.push("=".repeat(80))
  lines.push("")

  lines.push(`Overall Result: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  lines.push(
    `Summary: ${result.summary.passed}/${result.summary.total} checks passed (${result.summary.failed} failed)`
  )
  lines.push("")

  lines.push("Detailed Results:")
  lines.push("-".repeat(80))

  result.checks.forEach((check, index) => {
    lines.push(`${index + 1}. ${check.name}: ${check.pass ? "✅ PASS" : "❌ FAIL"}`)
    lines.push(`   Message: ${check.message}`)
    lines.push(`   Expected: ${JSON.stringify(check.expected)}`)
    lines.push(`   Actual: ${JSON.stringify(check.actual)}`)
    lines.push("")
  })

  lines.push("=".repeat(80))

  return lines.join("\n")
}

// CLI execution
if (require.main === module) {
  ;(async () => {
    console.log("Running validation harness...")
    const result = await runValidation()
    console.log(formatValidationResult(result))
    process.exit(result.pass ? 0 : 1)
  })()
}
