# Phase 3 Validation Test

## Test Scenario
Create a simple test to verify that requiredToolCalls validation works correctly.

## Manual Test Steps

### 1. Create Test Template
Create a template with requiredToolCalls validation:

```json
{
  "name": "Test Required Tool Calls",
  "description": "Test template for Phase 3 validation",
  "category": "testing",
  "tasks": [
    {
      "id": "test-task",
      "subagent": "general",
      "description": "Test task requiring annotation",
      "dependencies": [],
      "prompt": {
        "template": "Make a simple change to a file and annotate it.",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": ["TODO"],
        "requiredToolCalls": ["metabob_annotate_component"],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    }
  ]
}
```

### 2. Test Cases

#### Case A: Agent Calls Required Tool (PASS)
- Agent reads a file
- Agent edits the file
- Agent calls metabob_annotate_component
- **Expected**: Validation passes ✅

#### Case B: Agent Skips Required Tool (FAIL)
- Agent reads a file
- Agent edits the file
- Agent does NOT call metabob_annotate_component
- **Expected**: Validation fails with error ❌
- **Error Message**: "Required tool 'metabob_annotate_component' was not called..."

#### Case C: Forbidden Pattern Found (FAIL)
- Agent edits file and adds "TODO" comment
- Agent calls metabob_annotate_component
- **Expected**: Validation fails due to forbidden pattern ❌
- **Error Message**: "Forbidden pattern found: TODO..."

### 3. Verification Commands

```bash
# Run the test template
cd repos/metabob-opencode/packages/opencode
bun run cli activity execute --template test-required-tool-calls

# Check validation in activity log
bun run cli activity inspect <activity-id>

# Look for validation evidence
grep "required_tool_call" ~/.local/share/opencode/storage/activity/<activity-id>.json
```

## Expected Behavior

### When Validation Passes:
```json
{
  "validation": {
    "passed": true,
    "checks": [
      {
        "type": "required_tool_call",
        "tool": "metabob_annotate_component",
        "passed": true,
        "note": "Tool was called during execution"
      }
    ]
  }
}
```

### When Validation Fails:
```json
{
  "validation": {
    "passed": false,
    "checks": [
      {
        "type": "required_tool_call",
        "tool": "metabob_annotate_component",
        "passed": false,
        "required": true,
        "suggestion": "Required tool 'metabob_annotate_component' was not called during task execution. Ensure the agent invokes this tool as part of the workflow. Available tools called: read, edit, bash"
      }
    ]
  }
}
```

## Integration Test
The fix-bug-with-impulses template now enforces annotation capture:
```bash
# This template will fail validation if agent doesn't call metabob_annotate_component
bun run cli activity execute --template fix-bug-with-impulses \
  --variables '{"bugReport": "Test bug", "errorContext": "Test context"}'
```

## Automated Test (Future)
```typescript
describe("Phase 3: Required Tool Call Validation", () => {
  it("should pass when required tool is called", async () => {
    // Execute task that calls metabob_annotate_component
    const result = await executeTask(taskWithRequiredTools)
    expect(result.validation.passed).toBe(true)
  })

  it("should fail when required tool is not called", async () => {
    // Execute task that doesn't call required tool
    const result = await executeTask(taskWithRequiredTools)
    expect(result.validation.passed).toBe(false)
    expect(result.validation.checks[0].suggestion).toContain("Required tool")
  })

  it("should list tools that were actually called", async () => {
    // Execute task with some tools but not required one
    const result = await executeTask(taskWithRequiredTools)
    expect(result.validation.checks[0].suggestion).toContain("Available tools called")
  })
})
```
