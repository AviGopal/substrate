# Bug Analysis: Context Requirements → Template Variables Mapping Missing

## Status
**IDENTIFIED** - Root cause found, fix needed

## Summary
Activity execution fails at task 1 with "no agent sessions spawned" (0.0s duration) because impulses created from context requirements are never loaded or mapped to template variables that tasks expect.

## Affected Activity
- **Activity ID**: `act_mlu7mnhl_ad1a2dd44851b782`
- **Template**: `debug-failing-feature`
- **Failure Point**: Before task 1 execution begins
- **Duration**: 20.3s (fails during setup, never reaches task execution)

## Root Cause

### The Architecture Gap

1. **Context Requirements** create impulses:
   ```json
   {
     "key": "bugDescription",
     "impulseTypes": ["memo", "file"],
     ...
   }
   ```
   
   This creates impulses with IDs like:
   - `bugDescription-memo-1`
   - `bugDescription-file-0`
   - `relevantFiles-file-0`
   - etc.

2. **Template tasks** expect variables:
   ```handlebars
   {{bugDescription}}
   {{relevantFiles}}
   {{recentChanges}}
   ```

3. **BUT there's no mapping** from impulse IDs to template variables!
   - Impulses are created but never loaded (`loaded: false`)
   - Impulses have no content (`content: ""` or missing)
   - Template variables like `{{bugDescription}}` don't exist
   - Prompt interpolation fails or gets empty values

### Evidence

**Activity state** (`act_mlu7mnhl_ad1a2dd44851b782.json`):
```json
{
  "impulses": {
    "bugDescription-file-0": { "loaded": false, "content": null },
    "bugDescription-memo-1": { "loaded": false, "content": "" },
    "relevantFiles-file-0": { "loaded": false, "content": null },
    ...
  },
  "executionEvidence": {
    "sessionsSpawned": [],  // ← No sessions ever spawned!
    "toolCalls": []
  },
  "status": "failed"
}
```

**Code flow**:
1. `activity.ts:577-612` - Context gathering creates impulses ✅
2. `activity.ts:745` - Execute template called ✅
3. `activity.ts:1564-1628` - Task execution begins, tries to load impulses
4. **Line 1573**: `if (task.impulseReferences && task.impulseReferences.length > 0)`
   - `task.impulseReferences` is **undefined** (template doesn't define it)
   - Impulses never loaded
5. **Line 1619**: `ActivityTemplate.interpolatePrompt(task.prompt.template, enrichedVariables)`
   - Variables object **doesn't contain** `bugDescription`, `relevantFiles`, etc.
   - Interpolation likely fails with "Missing variables" error OR uses empty string
6. Task execution never reaches `TaskTool` → No session spawned

## Why This Wasn't Caught Earlier

1. **Previous fixes** focused on context gathering (Session Memory Agent)
   - ✅ Fixed 7 bugs in memory agent
   - ✅ Context gathering now works
   - ✅ Impulses are created
   - But nobody checked if they're actually **used**

2. **No validation** that impulses map to template variables
   - Template validator doesn't check this
   - No runtime check before task execution

3. **Missing integration test** for full context flow:
   - Context requirements → Impulses → Variables → Prompt

## The Fix

### Option 1: Automatic Mapping (RECOMMENDED)

After context gathering, automatically map impulses to variables by context requirement key:

```typescript
// In activity.ts, after context gathering (line ~612)
const contextVariables: Record<string, unknown> = {}

for (const requirement of template.contextRequirements) {
  // Find all impulses for this requirement
  const requirementImpulses = Object.values(activity.impulses)
    .filter(imp => imp.metadata?.requirement === requirement.key)
  
  if (requirementImpulses.length > 0) {
    // Load impulses
    for (const impulse of requirementImpulses) {
      if (!impulse.loaded) {
        const loaded = await ImpulseResolver.load(impulse)
        activity.impulses[impulse.id] = loaded
      }
    }
    
    // Aggregate content
    const contents = requirementImpulses
      .filter(imp => imp.content)
      .map(imp => imp.content)
      .join("\n\n")
    
    // Map to variable
    contextVariables[requirement.key] = contents || ""
  } else {
    // Requirement not fulfilled
    if (requirement.required) {
      throw new ActivityContextError(`Required context "${requirement.key}" not provided`)
    }
    contextVariables[requirement.key] = ""
  }
}

// Merge with user variables
const allVariables = { ...params.variables, ...contextVariables }

// Pass allVariables to executeTemplate
```

**Benefits**:
- ✅ Automatic: works for all templates with contextRequirements
- ✅ Intuitive: `key: "bugDescription"` → `{{bugDescription}}`  
- ✅ Backward compatible: templates without contextRequirements unaffected

### Option 2: Explicit impulseReferences (Current Design)

Require templates to explicitly list `impulseReferences` in each task:

```json
{
  "tasks": [{
    "id": "reproduce",
    "impulseReferences": ["bugDescription-memo-1", "bugDescription-file-0"],
    "prompt": {
      "template": "...",
      "variables": []
    }
  }]
}
```

**Problems**:
- ❌ Verbose: must list every impulse ID
- ❌ Fragile: IDs are auto-generated, hard to predict
- ❌ Defeats purpose of contextRequirements abstraction

### Option 3: Hybrid Approach

1. Auto-map context requirements to variables (Option 1)
2. Allow tasks to override with explicit `impulseReferences` if needed
3. Best of both worlds

## Impact

**Without fix**:
- ❌ All templates with `contextRequirements` are broken
- ❌ `debug-failing-feature` template unusable
- ❌ Learning mechanism blocked (no impulse usage data)

**With fix**:
- ✅ Context requirements work end-to-end
- ✅ Template variables populated automatically
- ✅ 5-task debugging workflow can execute
- ✅ Functional state transitions measurable

## Next Steps

1. **Implement Option 1** (automatic mapping) in `activity.ts`
2. **Add validation** that all template variables have values before interpolation
3. **Test with `debug-failing-feature`** template
4. **Measure functional state transitions** (original goal)
5. **Document pattern** for future templates

## Testing Plan

```typescript
// Test case: Context requirement maps to variable
const activity = await executeActivity({
  templateId: "debug-failing-feature",
  variables: { debugId: "test-123" },
  reason: "Test context mapping"
})

// Verify:
// 1. Impulses created: ✓
// 2. Impulses loaded: ✓ (NEW)
// 3. Variables populated: ✓ (NEW)
// 4. Task 1 executes: ✓ (NEW)
// 5. Session spawned: ✓ (NEW)
```

## Timeline

- **Discovery**: Session 2026-02-19 (6-7 hours debugging)
- **Context gathering fixed**: 7 bugs, impulses now created
- **This issue found**: Impulses created but not used
- **Estimated fix time**: 1-2 hours (Option 1 implementation)
- **Estimated test time**: 30 minutes

## Files to Modify

1. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - Lines 612-650: Add automatic mapping after context gathering
   - Import `ImpulseResolver`

2. `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
   - Optional: Add validation for variable coverage

## Related Issues

- **SESSION_SUMMARY_CONTEXT_GATHERING_SUCCESS.md** - Previous fix (context gathering)
- **Activity correctness validation** - Expects sessionsSpawned > 0
- **Impulse system V2** - This completes the integration

---

**Status**: Ready for implementation
**Priority**: HIGH (blocks learning mechanism validation)
**Complexity**: MEDIUM (clear fix, needs testing)
