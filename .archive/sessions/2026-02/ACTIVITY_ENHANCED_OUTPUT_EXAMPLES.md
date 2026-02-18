# Activity Tool Enhanced Output - Examples

## Overview

The activity tool now includes comprehensive pre-flight checks and structured error handling. This document shows example outputs for various scenarios.

---

## Success Case: Clean Execution

### Input
```typescript
activity({
  templateId: "add-feature",
  variables: {
    featureName: "User Authentication",
    description: "Add JWT-based authentication"
  },
  reason: "User requested authentication feature"
})
```

### Output
```markdown
## Activity: Add Feature ✅
**Status:** Completed
**Template:** add-feature v1

### Pre-flight Checks:
- ✅ Git Status: Clean
- ✅ Memory Agent: Available (memory)
- ✅ Template Validation: Passed

### Tasks:
- ✅ **Analyze requirements** (2.3s)
  - Cost: $0.0045
- ✅ **Implement feature** (5.7s)
  - Cost: $0.0123
- ✅ **Add tests** (3.1s)
  - Cost: $0.0089
- ✅ **Update documentation** (1.4s)
  - Cost: $0.0034

### Summary:
- Total Duration: 12.5s
- Total Cost: $0.0291
- Tokens: 4567 input, 2341 output
- Cache hits: 1234 tokens
```

---

## Error Case 1: Dirty Git Tree

### Input
```typescript
activity({
  templateId: "add-feature",
  variables: { featureName: "Payment" },
  reason: "Add payment processing"
})
```

### Output
```
❌ ActivityGitError: Cannot start activity: working tree has uncommitted changes. Commit or stash them first, then retry.

Context:
  uncommittedFiles: [3 items]
  count: 3

💡 Suggested fixes:

1. Commit changes
   Commit all uncommitted changes
   Command: git add . && git commit -m "Your commit message"

2. Stash changes
   Temporarily save changes without committing
   Command: git stash

3. Review changes
   See what files have been modified
   Command: git status
```

### Metadata
```json
{
  "activityId": "act_abc123",
  "status": "failed",
  "error": "Cannot start activity: working tree has uncommitted changes",
  "errorType": "ActivityGitError"
}
```

---

## Error Case 2: Template Not Found

### Input
```typescript
activity({
  templateId: "non-existent-template",
  variables: {},
  reason: "Test"
})
```

### Output
```
❌ ActivityTemplateError: Activity template "non-existent-template" not found. Use search_activities tool to see available templates.

Context:
  templateId: non-existent-template

💡 Suggested fixes:

1. Search for templates
   List all available activity templates
   Command: search_activities()

2. Check template ID spelling
   Verify you used the correct template ID (case-sensitive)

3. Register template
   If you have a template file, register it first
   Command: register_activity_template({ file_path: "path/to/template.json" })
```

### Metadata
```json
{
  "activityId": "act_def456",
  "status": "failed",
  "error": "Activity template \"non-existent-template\" not found",
  "errorType": "ActivityTemplateError"
}
```

---

## Error Case 3: Missing Required Variables

### Input
```typescript
activity({
  templateId: "add-feature",
  variables: {
    description: "Add search"
    // Missing required variable: featureName
  },
  reason: "Add search feature"
})
```

### Output
```
❌ ActivityValidationError: Activity variable validation failed for template "add-feature"

Missing required variables:
  - featureName (string): Name of the feature to add
  - priority (number): Priority level (1-5)

Context:
  templateId: add-feature
  missing: [2 items]
  provided: [1 items]

💡 Suggested fixes:

1. Provide missing variables
   Add the required variables to your activity call

2. Review template requirements
   Check what variables are required by this template
   Command: search_activities({ verbose: true })
```

### Metadata
```json
{
  "activityId": "act_ghi789",
  "status": "failed",
  "error": "Activity variable validation failed for template \"add-feature\"",
  "errorType": "ActivityValidationError"
}
```

---

## Error Case 4: Variable Name Typo (Fuzzy Matching)

### Input
```typescript
activity({
  templateId: "add-feature",
  variables: {
    featureNam: "Search",  // Typo: "featureNam" instead of "featureName"
    descripton: "Add search functionality"  // Typo: "descripton" instead of "description"
  },
  reason: "Add search"
})
```

### Output
```
❌ ActivityValidationError: Activity variable validation failed for template "add-feature"

Unexpected variables (not defined in template):
  - featureNam (did you mean "featureName"?)
  - descripton (did you mean "description"?)

Expected variables: featureName, description, priority

Context:
  templateId: add-feature
  unexpected: [2 items]
  expected: [3 items]

💡 Suggested fixes:

1. Fix variable names
   Correct the spelling of variable names (check suggestions)

2. Remove extra variables
   Remove variables not required by this template
```

---

## Error Case 5: Memory Agent Unavailable

### Input
```typescript
activity({
  templateId: "complex-refactor",  // Requires memory agent
  variables: { component: "auth" },
  reason: "Refactor authentication"
})
```

### Output
```
❌ ActivityContextError: Memory agent required for context gathering but not configured. Add memory agent to opencode.json agents section.

Context:
  requirements: [2 items]

💡 Suggested fixes:

1. Configure memory agent
   Add memory agent to opencode.json:
   {
     "agents": {
       "memory": {
         "model": "claude-3-5-sonnet-20241022",
         "tools": ["read", "grep", "glob"]
       }
     }
   }
```

---

## Error Case 6: Metabob Required But Unavailable

### Input
```typescript
activity({
  templateId: "code-quality-fix",  // Requires Metabob
  variables: { file: "src/app.ts" },
  reason: "Fix code quality issues"
})
```

### Output
```
❌ ActivityContextError: Template requires Metabob integration but Metabob is not available. Configure Metabob CLI or use a different template.

Context:
  requirements: [1 items]

💡 Suggested fixes:

1. Install Metabob CLI
   Install Metabob command-line tools
   Command: npm install -g @metabob/cli

2. Configure Metabob
   Authenticate with Metabob service
   Command: metabob login

3. Use different template
   Choose a template that does not require Metabob integration
```

---

## Error Case 7: Pre-check Validation Failed

### Input
```typescript
activity({
  templateId: "typescript-feature",  // Has pre-check: tsc --noEmit
  variables: { featureName: "Analytics" },
  reason: "Add analytics"
})
```

### Output
```
❌ ActivityValidationError: Pre-flight validation failed: Template pre-flight validation

Command: tsc --noEmit
Exit code: 1
Output:
src/app.ts:42:18 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.

42     const result = calculatePriority("high")
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error.

Context:
  checkDescription: Template pre-flight validation
  command: tsc --noEmit
  output: src/app.ts:42:18 - error TS2345...
  exitCode: 1

💡 Suggested fixes:

1. Fix validation error
   Run the validation command manually and fix reported issues
   Command: tsc --noEmit

2. Review output
   Check validation output above for specific errors
```

---

## Pre-flight Check Details

### What Gets Checked

1. **Git Status**
   - Working tree must be clean (no uncommitted changes)
   - Prevents activities from running with dirty state
   - Shows list of uncommitted files in error

2. **Memory Agent**
   - Checked if template has `contextRequirements`
   - Ensures agent is configured in opencode.json
   - Shows agent name if available

3. **Metabob Integration**
   - Checked if template requires Metabob (hint contains "metabob" or "code quality")
   - Verifies Metabob CLI is installed and available
   - Provides installation instructions if missing

4. **Template Pre-checks**
   - Runs commands from `template.integration.preChecks.commands`
   - Executes before activity starts
   - Shows command output if validation fails

### Pre-flight Check Metadata

All successful activities include pre-flight check results in metadata:

```json
{
  "metadata": {
    "preFlightChecks": {
      "gitStatus": {
        "clean": true
      },
      "memoryAgent": {
        "available": true,
        "agentName": "memory"
      },
      "metabob": {
        "required": false,
        "available": true
      },
      "validation": {
        "passed": true,
        "errors": []
      }
    }
  }
}
```

---

## Benefits

### Before Enhancement
```
❌ Error: Cannot create branch: working tree has uncommitted changes

User confused:
- What files are uncommitted?
- How do I fix this?
- Should I commit or stash?
```

### After Enhancement
```
❌ ActivityGitError: Cannot start activity: working tree has uncommitted changes.

Context:
  uncommittedFiles: ["src/app.ts", "src/util.ts", "test/app.test.ts"]
  count: 3

💡 Suggested fixes:
1. Commit changes
   Command: git add . && git commit -m "Your commit message"
2. Stash changes
   Command: git stash
3. Review changes
   Command: git status

User knows exactly:
✅ What went wrong (uncommitted changes)
✅ Which files are affected
✅ How to fix it (3 options with commands)
✅ Can copy-paste commands directly
```

### Key Improvements

1. **Transparency**
   - Pre-flight checks visible in output
   - User sees what validations ran
   - Clear indication of what passed/failed

2. **Actionable Errors**
   - Structured error context
   - Specific remediation steps
   - Copy-pasteable commands

3. **Fast Failure**
   - Errors detected before execution
   - No wasted tokens on doomed activities
   - Clear error messages upfront

4. **Better Debugging**
   - Error type classification
   - Structured metadata
   - Full context for analysis

---

## Implementation Summary

### Files Modified

1. **`src/tool/activity.ts`**
   - Added `runActivityPreFlightChecks()` function
   - Updated template loading to use `ActivityTemplateError`
   - Updated variable validation to use `ActivityValidationError`
   - Updated context gathering to use `ActivityContextError`
   - Enhanced error handling to return formatted errors
   - Added pre-flight results to metadata
   - Updated `formatExecutionResult()` to show pre-flight checks

### New Dependencies

- `activity-errors.ts` - Structured error types
- `activity-git.ts.getStatus()` - Git status with file list

### Backwards Compatibility

✅ All changes are backwards compatible:
- Error handling enhanced but doesn't break existing code
- Pre-flight checks add safety without changing behavior
- Metadata additions are optional (no breaking changes)

---

## Testing

### Unit Tests
- Pre-flight check function
- Error formatting
- Structured error types

### Integration Tests
- Activity with clean git → success
- Activity with dirty git → error with file list
- Activity with missing template → error with suggestions
- Activity with missing variables → error with required list
- Activity with typos → error with suggestions

### Manual Testing
Run: `bun test/activity-preflight-demo.ts`
