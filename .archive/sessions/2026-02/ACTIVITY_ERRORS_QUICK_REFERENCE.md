# Activity Error Types - Quick Reference

## Import

```typescript
import {
  ActivityGitError,
  ActivityTemplateError,
  ActivityValidationError,
  ActivityContextError,
  formatActivityError,
  classifyErrorType,
} from "@/tool/activity-errors"
```

## Git Errors

### Working Tree Dirty
```typescript
throw ActivityGitError.workingTreeDirty(["file1.ts", "file2.ts"])
```
**When**: Git status shows uncommitted changes  
**User sees**: List of uncommitted files + git commands to fix

### Branch Already Exists
```typescript
throw ActivityGitError.branchExists("activity/my-branch")
```
**When**: Trying to create a branch that already exists  
**User sees**: Branch name + command to delete it

### Branch Creation Failed
```typescript
throw ActivityGitError.branchCreateFailed("my-branch", "permission denied")
```
**When**: `git checkout -b` fails  
**User sees**: Reason + permission troubleshooting

### Checkout Failed
```typescript
throw ActivityGitError.checkoutFailed("branch-name", "merge conflict")
```
**When**: Cannot switch to branch  
**User sees**: Reason + conflict resolution steps

### Git Status Failed
```typescript
throw ActivityGitError.statusFailed("not a git repository")
```
**When**: `git status` command fails  
**User sees**: Reason + git installation checks

---

## Template Errors

### Template Not Found
```typescript
throw ActivityTemplateError.notFound("missing-template-id")
```
**When**: Template doesn't exist in registry  
**User sees**: Template ID + suggestion to use search_activities

### Invalid Schema
```typescript
throw ActivityTemplateError.invalidSchema("template-id", [
  "Missing required field: tasks",
  "Invalid type for field: name"
])
```
**When**: Template JSON doesn't match schema  
**User sees**: All validation errors + schema documentation link

### Template Load Failed
```typescript
throw ActivityTemplateError.loadFailed("template-id", "file not readable")
```
**When**: Cannot read template file  
**User sees**: Reason + permission checks

### Version Mismatch
```typescript
throw ActivityTemplateError.versionMismatch("template-id", "2.0", "1.5")
```
**When**: Template version incompatible with system  
**User sees**: Both versions + upgrade instructions

---

## Validation Errors

### Missing Required Variables
```typescript
throw ActivityValidationError.missingVariables(
  "add-feature",
  [
    { name: "featureName", description: "Name of feature", type: "string" },
    { name: "priority", type: "number" }
  ],
  ["otherVar"] // variables that were provided
)
```
**When**: User didn't provide required variables  
**User sees**: List of missing variables with types/descriptions

### Unexpected Variables (Typo Detection)
```typescript
throw ActivityValidationError.unexpectedVariables(
  "add-feature",
  [
    { provided: "featureNam", suggestion: "featureName" },
    { provided: "extraVar" }
  ],
  ["featureName", "description"] // expected variables
)
```
**When**: User provided variables not in template  
**User sees**: Typos with suggestions + list of valid variables

### Invalid Variable Type
```typescript
throw ActivityValidationError.invalidVariableType(
  "priority",
  "number",
  "string",
  "high"
)
```
**When**: Variable value has wrong type  
**User sees**: Expected vs actual type + conversion hint

### Pre-check Failed
```typescript
throw ActivityValidationError.preCheckFailed(
  "TypeScript compilation",
  "tsc --noEmit",
  "error TS2345: Type mismatch at line 42",
  1 // exit code
)
```
**When**: Pre-flight validation command fails  
**User sees**: Command output + exit code + command to run manually

### Post-check Failed
```typescript
throw ActivityValidationError.postCheckFailed(
  "Unit tests",
  "npm test",
  "3 tests failed",
  1
)
```
**When**: Post-execution validation fails  
**User sees**: Validation output + debugging steps

### Forbidden Pattern Detected
```typescript
throw ActivityValidationError.forbiddenPattern("console.log", [
  { file: "src/app.ts", line: 42, content: "console.log('debug')" },
  { file: "src/util.ts", line: 15, content: "console.log('test')" }
])
```
**When**: Code contains forbidden patterns  
**User sees**: Pattern + all matches with file:line + policy explanation

---

## Context Errors

### Memory Agent Unavailable
```typescript
throw ActivityContextError.memoryAgentUnavailable([
  { hint: "code structure analysis" }
])
```
**When**: Context gathering needs memory agent but it's not configured  
**User sees**: opencode.json configuration example

### Metabob Unavailable
```typescript
throw ActivityContextError.metabobUnavailable([
  { hint: "code quality analysis" }
])
```
**When**: Template requires Metabob but it's not available  
**User sees**: Installation commands + alternative suggestions

### Context Gathering Failed
```typescript
throw ActivityContextError.gatheringFailed(
  "Memory agent timeout",
  [{ hint: "recent changes" }]
)
```
**When**: Context gathering fails for any reason  
**User sees**: Reason + debugging steps

---

## Utility Functions

### Format Error for Display
```typescript
try {
  // ... activity code
} catch (error) {
  console.error(formatActivityError(error))
}
```
**Output**:
```
❌ ActivityGitError: Cannot start activity: working tree has uncommitted changes.

Context:
  uncommittedFiles: [3 items]
  count: 3

💡 Suggested fixes:

1. Commit changes
   Command: git add . && git commit -m "Your message"
   
2. Stash changes
   Command: git stash
```

### Classify Error Type
```typescript
const errorType = classifyErrorType(error.message)
// Returns: 'git' | 'template' | 'validation' | 'context' | 'execution' | 'timeout' | 'unknown'

switch (errorType) {
  case 'git':
    // Handle git errors
    break
  case 'template':
    // Handle template errors
    break
  // ...
}
```

### Check if Error is Recoverable
```typescript
if (error instanceof ActivityError && error.recoverable) {
  // Can retry after user fixes the issue
  console.log("💡 Fix the issue and try again")
} else {
  // Non-recoverable error
  console.log("❌ Cannot retry this operation")
}
```

### Get Error Context
```typescript
if (error instanceof ActivityError) {
  console.log("Error type:", error.type)
  console.log("Error code:", error.code) // Only for specialized errors
  console.log("Context:", error.context)
  console.log("Remediation:", error.remediation)
}
```

### Serialize to JSON
```typescript
const json = error.toJSON()
// {
//   name: "ActivityGitError",
//   type: "git",
//   message: "...",
//   context: {...},
//   recoverable: true,
//   remediation: [...],
//   stack: "..."
// }

// Send to API
await fetch("/api/errors", {
  method: "POST",
  body: JSON.stringify(json)
})
```

---

## Error Properties

### All Errors Have
- `message: string` - Human-readable error message
- `type: string` - Error category: 'git' | 'template' | 'validation' | 'context' | 'execution' | 'timeout'
- `name: string` - Error class name (e.g., 'ActivityGitError')
- `stack: string` - Stack trace
- `context?: object` - Structured error context
- `recoverable: boolean` - Whether error can be fixed and retried
- `remediation?: RemediationStep[]` - Suggested fixes

### Specialized Errors Also Have
- `code: string` - Specific error code (e.g., 'WORKING_TREE_DIRTY')

### Remediation Step Structure
```typescript
{
  action: string        // What to do (e.g., "Commit changes")
  command?: string      // Command to run (e.g., "git commit")
  description?: string  // Explanation of the action
}
```

---

## Common Patterns

### Replace Generic Errors
```typescript
// ❌ Before
throw new Error("Working tree has uncommitted changes")

// ✅ After
const status = await ActivityGit.getStatus()
throw ActivityGitError.workingTreeDirty(status.uncommittedFiles)
```

### Pre-flight Validation
```typescript
// Check git status
const status = await ActivityGit.getStatus()
if (!status.clean) {
  throw ActivityGitError.workingTreeDirty(status.uncommittedFiles)
}

// Check template exists
const template = await TemplateRepository.get(templateId)
if (!template) {
  throw ActivityTemplateError.notFound(templateId)
}

// Check memory agent
const memoryAgent = await Agent.get('memory')
if (!memoryAgent) {
  throw ActivityContextError.memoryAgentUnavailable(requirements)
}
```

### Error Handler with Formatting
```typescript
try {
  await activity.execute(params)
} catch (error) {
  // Format error for user
  const formatted = formatActivityError(error)
  
  // Log structured data for debugging
  if (error instanceof ActivityError) {
    log.error('activity failed', {
      type: error.type,
      code: error.code,
      context: error.context,
      recoverable: error.recoverable,
    })
  }
  
  // Return formatted message to user
  return {
    success: false,
    error: formatted,
  }
}
```

### Error Classification for Routing
```typescript
try {
  await activity.execute()
} catch (error) {
  const type = error instanceof ActivityError 
    ? error.type 
    : classifyErrorType(error.message)
  
  switch (type) {
    case 'git':
      // Show git-specific help
      break
    case 'validation':
      // Show variable documentation
      break
    case 'template':
      // Show template search
      break
    default:
      // Generic error handler
  }
}
```

---

## Testing

### Test Error Creation
```typescript
const error = ActivityGitError.workingTreeDirty(["file.ts"])
expect(error.code).toBe("WORKING_TREE_DIRTY")
expect(error.context?.uncommittedFiles).toEqual(["file.ts"])
expect(error.recoverable).toBe(true)
expect(error.remediation?.length).toBeGreaterThan(0)
```

### Test Error Formatting
```typescript
const error = ActivityTemplateError.notFound("test-template")
const formatted = formatActivityError(error)
expect(formatted).toContain("❌ ActivityTemplateError")
expect(formatted).toContain("test-template")
expect(formatted).toContain("💡 Suggested fixes")
```

### Test Error Classification
```typescript
expect(classifyErrorType("ActivityGitError: ...")).toBe("git")
expect(classifyErrorType("Variable validation failed")).toBe("validation")
```

---

## Examples from Codebase

### Activity Git (activity-git.ts)
```typescript
// Line 36-54: Create branch with error handling
const status = await getStatus()
if (!status.clean) {
  throw ActivityGitError.workingTreeDirty(status.uncommittedFiles)
}

const exists = await branchExists(name)
if (exists) {
  throw ActivityGitError.branchExists(name)
}

try {
  await $`git checkout -b ${name}`.cwd(Instance.directory).quiet()
} catch (error) {
  throw ActivityGitError.branchCreateFailed(name, error.message)
}
```

### Activity Tool (activity.ts) - To Be Updated
```typescript
// Line 307-311: Template loading
if (!template) {
  throw ActivityTemplateError.notFound(params.templateId)
}

// Line 330: Variable validation
if (!validationResult.valid) {
  if (validationResult.missing.length > 0) {
    throw ActivityValidationError.missingVariables(
      template.id,
      validationResult.missing,
      Object.keys(params.variables)
    )
  }
  if (validationResult.unexpected.length > 0) {
    throw ActivityValidationError.unexpectedVariables(
      template.id,
      validationResult.unexpected,
      validationResult.expected
    )
  }
}
```

---

## Migration Guide

### Step 1: Find Generic Errors
```bash
grep -r "throw new Error" src/
```

### Step 2: Identify Error Type
- Git operations → `ActivityGitError`
- Template operations → `ActivityTemplateError`
- Variable/validation → `ActivityValidationError`
- Context gathering → `ActivityContextError`

### Step 3: Replace with Structured Error
Choose appropriate factory method based on scenario

### Step 4: Add Context
Include relevant data (files, variables, commands, etc.)

### Step 5: Test
Verify error message and remediation steps are helpful
