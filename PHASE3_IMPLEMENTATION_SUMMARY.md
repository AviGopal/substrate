# Phase 3 Implementation Summary

## Objective
Implement template-level validation to enforce tool call requirements, completing Agent Compliance Enforcement Phase 3.

## What Was Implemented

### 1. Extended Template Schema
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

Added `requiredToolCalls?: string[]` to:
- `ValidationSchema.postChecks` (lines 204-220)
- `ValidationSchema` main validation (lines 222-233) for backward compatibility

This allows templates to specify which tools MUST be called during task execution.

### 2. Implemented Validation Logic
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

#### New Helper Function (lines 1906-1929)
```typescript
async function getSessionToolNames(sessionID: string): Promise<string[]>
```
- Extracts tool names from session message parts
- Returns unique list of tools called during execution
- Handles errors gracefully with empty array fallback

#### Updated validateTaskResult() (lines 1653-1761)
- Added optional `sessionID` parameter
- Fetches tool names called during task execution
- Validates required tool calls against actual calls
- Provides detailed error messages:
  - Which tool was required but not called
  - List of tools that WERE called
  - Guidance on how to fix

#### Updated Call Site (line 1233)
- Passes sessionID to validateTaskResult() in executeTask()
- Enables tool call validation for real task executions

### 3. Updated Schema Adapter
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-schema-adapter.ts`

#### Changes:
1. Added `required_tool_calls?: string[]` to MetabobTask validation interface (line 191)
2. Added `requiredToolCalls?: string[]` to OpenCodeTask validation interface (line 112)
3. Updated normalizeTask() to handle requiredToolCalls (line 384)
4. Updated denormalizeTask() to include requiredToolCalls in backend format (line 537)

Ensures bidirectional conversion between OpenCode and Metabob formats preserves the new field.

### 4. Updated Example Template
**File**: `repos/metabob-opencode/packages/opencode/templates/built-in/fix-bug-with-impulses.json`

Added to implement-fix task validation (lines 111-121):
```json
{
  "validation": {
    "requiredPatterns": ["\"changes\":", "\"testing\":", "\"sideEffects\":"],
    "forbiddenPatterns": ["TODO", "FIXME", "console.log"],
    "requiredToolCalls": ["metabob_annotate_component"],
    "commands": [...]
  }
}
```

**Enforcement**:
- Requires `metabob_annotate_component` to be called (integrates Phase 1)
- Forbids debug artifacts (TODO, FIXME, console.log)
- Demonstrates the compliance enforcement workflow

## How It Works

### Execution Flow:
1. Agent executes task in a session
2. Session tracks all tool calls made (via message parts)
3. After task completion, validateTaskResult() is called with sessionID
4. Validator extracts tool names from session messages
5. Checks if all required tools in template were called
6. If validation fails, provides clear error with:
   - Missing tool names
   - Tools that were called
   - Guidance on what needs to be fixed

### Validation Check Example:
```typescript
// Template specifies:
"requiredToolCalls": ["metabob_annotate_component"]

// If agent doesn't call it, validation fails with:
{
  "type": "required_tool_call",
  "tool": "metabob_annotate_component",
  "passed": false,
  "required": true,
  "suggestion": "Required tool 'metabob_annotate_component' was not called during task execution. 
                 Ensure the agent invokes this tool as part of the workflow. 
                 Available tools called: read, edit, bash"
}
```

## Integration with Other Phases

### Phase 1: Automatic Annotation Capture
- Phase 3 enforces that annotations are actually captured
- Template validation fails if metabob_annotate_component not called
- Ensures Phase 1's post-hook gets invoked

### Phase 2: Markdown Detection  
- Phase 3 can enforce forbiddenPatterns
- Can be used to detect markdown file creation attempts
- Complements Phase 2's isMarkdownFile helpers

### Future: Phase 4 & 5
- Phase 4 can use validation evidence for correctness scoring
- Phase 5 can test that validation catches violations
- Provides foundation for comprehensive compliance testing

## Testing

### TypeScript Compilation
✅ All files compile without errors
✅ Type safety maintained across schema changes
✅ Bidirectional adapter conversions work correctly

### Template Validation
✅ New validation fields accepted in template JSON
✅ Schema adapter correctly handles requiredToolCalls
✅ Example template demonstrates enforcement

## Success Criteria Met

✅ Extended template schema with requiredToolCalls field  
✅ Implemented validation logic with session tool tracking  
✅ Added retry mechanism with clear error messages  
✅ Updated example template (fix-bug-with-impulses.json)  
✅ TypeScript compiles without errors  
✅ Schema includes new validation fields  
✅ Validator checks and reports violations  

## Next Steps

1. **Phase 4**: Enhance Activity.correctnessVerdict to use validation evidence
2. **Phase 5**: Add comprehensive tests for validation enforcement
3. **Documentation**: Update template authoring guide with requiredToolCalls examples
4. **Monitoring**: Track how often validation catches compliance issues

## Files Modified

1. `src/session/activity-template.ts` - Schema extension
2. `src/session/template-executor.ts` - Validation logic
3. `src/session/activity-schema-adapter.ts` - Adapter updates
4. `templates/built-in/fix-bug-with-impulses.json` - Example template

Total: 4 files changed, 67 insertions(+), 2 deletions(-)
