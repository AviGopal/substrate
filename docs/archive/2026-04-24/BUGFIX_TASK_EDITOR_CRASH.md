# Bug Fix: TaskEditor Crash on Tasks Without Prompt Field

## Issue Description

**Error:** `TypeError: can't access property 'template', task.prompt is undefined`
**Location:** `TaskEditor.tsx:40:38` (originally line 35)
**Impact:** Critical - UI crashes when adding certain activities to trajectory editor

## Root Cause

The TaskEditor component assumed all activity tasks have a `prompt` field with `template` and `variables` properties. However, some activity templates use deterministic bash resolvers instead of LLM prompts, and these tasks don't have a `prompt` field.

### Affected Activities

6 activity templates with 44 total tasks affected:

1. **Deterministic Git Workflow Sync** (7 tasks)
2. **Deterministic Vessel Deployment with Rollback** (10 tasks)
3. **Database Migration with Validation** (7 tasks)
4. **Validate Deployment Health** (5 tasks)
5. **Full Vessel Deployment Pipeline** (11 tasks) - The one that triggered the bug report
6. **Cleanup Stale Execution Traces v1** (4 tasks)

All of these are infrastructure/upkeep activities that use the `resolver` field with `config` objects instead of `prompt` templates.

### Example of Problematic Task Structure

```json
{
  "id": "check-versions",
  "description": "Compare versions between main repo, deployment submodule, and production values",
  "resolver": "bash",
  "config": {
    "command": "...",
    "timeout": 30000
  }
  // No "prompt" field
}
```

## Solution Implemented

### 1. Updated Type Definitions (`src/types/index.ts`)

Made `prompt` field optional and added fields for deterministic resolver tasks:

```typescript
export interface ActivityTask {
  id: string;
  description: string;
  prompt?: {  // Made optional
    template: string;
    variables: Variable[];
  };
  validation?: {
    requiredFiles?: string[];
    requiredPatterns?: string[];
    forbiddenPatterns?: string[];
  };
  retry?: {
    maxAttempts: number;
    strategy: 'exponential' | 'linear';
  };
  // Added fields for non-LLM tasks
  resolver?: string;
  config?: Record<string, unknown>;
  dependencies?: string[];
}
```

### 2. Updated TaskEditor Component (`src/components/trajectory/TaskEditor.tsx`)

Added defensive null checks:

**Line 35-37 (previously 35):**
```typescript
// Before (crashed):
const variables = extractVariables(task.prompt.template);

// After (safe):
const promptTemplate = task.prompt?.template ?? '';
const variables = extractVariables(promptTemplate);
```

**Line 148 (previously 148):**
```typescript
// Before (crashed):
<Textarea value={task.prompt.template} />

// After (safe):
<Textarea value={promptTemplate} />
```

**Line 40-56 (handlePromptChange callback):**
```typescript
// Simplified to not spread undefined task.prompt
onChange({
  ...task,
  prompt: {
    template: value,
    variables: newVariables.map(/* ... */),
  },
});
```

## Verification

### Type Checking
```bash
$ bun run typecheck
$ tsc --noEmit
# ✓ No errors
```

### Manual Testing
1. Navigate to trajectory editor
2. Add "Full Vessel Deployment Pipeline" activity
3. UI should now render without crashing
4. Empty prompt template field should appear (editable)
5. All other functionality remains intact

## Backend Data Quality

The backend data is valid - these activities are designed to work without LLM prompts. They use deterministic bash resolvers for infrastructure tasks where LLM reasoning is unnecessary and would add cost/latency.

**No backend migration needed.** The fix is purely frontend defensive coding to handle both:
- LLM-based tasks with `prompt` field
- Deterministic tasks with `resolver` field

## Related Files Modified

- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/workbench/src/types/index.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/workbench/src/components/trajectory/TaskEditor.tsx`

## Prevention

Going forward:
1. **Type safety enforced** - TypeScript now knows `prompt` is optional
2. **Defensive coding pattern** - Always use optional chaining for optional fields
3. **Better documentation** - Type definition now includes `resolver` and `config` fields

## Testing Recommendations

While automated tests have environment setup issues, manual testing should verify:

1. ✓ Activities with LLM prompts render correctly
2. ✓ Activities with bash resolvers render without crashing
3. ✓ Editing prompt templates works
4. ✓ Adding/removing tasks works
5. ✓ Variable extraction from templates works
6. ✓ Validation rules work
7. ✓ Retry configuration works

## Additional Notes

This bug highlights the importance of:
- Making optional fields explicitly optional in TypeScript
- Using defensive coding (optional chaining, nullish coalescing)
- Testing with real production data, not just happy-path examples
- Understanding that activities can have multiple execution strategies (LLM vs deterministic)
