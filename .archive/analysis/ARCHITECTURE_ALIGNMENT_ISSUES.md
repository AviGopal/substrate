# Architecture Alignment Issues

**Date**: February 12, 2026  
**Status**: Execution works, but not aligned with architectural goals

---

## Summary

Activity execution is functional but has 4 critical architectural issues that prevent it from working as designed:

1. ❌ **Template lacks schema** - Reads files instead of using impulses
2. ❌ **Missing parent context** - Doesn't receive calling agent's instructions
3. ❌ **New session per step** - No continuity, context lost between steps
4. ❌ **No TUI visibility** - Silent execution, no progress feedback

---

## Issue 1: Activity Template Lacks Self-Contained Schema

**Current Behavior**:
- `activity-create` reads schema from filesystem (`/server/proto/activity.proto`)
- Works only in dev environments where source files exist
- Breaks in production/containers

**Expected Behavior**:
- Template includes schema as impulse reference
- Schema embedded or fetched from backend
- No filesystem dependencies

**Solution**:
```json
{
  "variant_id": "INFRASTRUCTURE-0013e379",
  "impulse_refs": [
    {"id": "activity-schema", "type": "memo", "content": "...proto schema..."},
    {"id": "example-template", "type": "memo", "content": "...example JSON..."}
  ]
}
```

**Impact**: High - Breaks outside dev environments

---

## Issue 2: No Parent Context in Execution Environment

**Current Behavior**:
- Activity executes with only `variables` provided
- No access to calling agent's context
- Guesses intent from filesystem inspection

**Expected Behavior**:
- Parent agent's conversation context passed as impulses
- User intent, files, conversation history available
- Activity knows WHY it's being executed

**Example**:
```javascript
// Parent agent calls
activity({
  activityId: "activity-create",
  variables: {template_name: "hello-world"},
  reason: "User wants greeting automation",
  
  // Should pass parent context
  parentContext: {
    conversationHistory: [...],
    currentFiles: [...],
    userIntent: "..."
  }
})
```

**Solution**:
- Activity tool passes parent session context as impulses
- First step receives enriched context
- Subsequent steps build on previous outputs

**Impact**: Critical - Activities work by luck, not design

---

## Issue 3: New Subagent Session Per Step

**Current Behavior**:
```
Step 1 → Spawn new agent → Execute → Discard session
Step 2 → Spawn new agent → Execute → Discard session
Step 3 → Spawn new agent → Execute → Discard session
```

**Problems**:
- No continuity between steps
- Step N doesn't see output from Step N-1
- Expensive (multiple agent initializations)
- Context resets each step

**Expected Behavior**:
```
Activity start → Create ONE agent session
  ↓
Step 1 → Enrich with impulses → Execute → Output saved
  ↓
Step 2 → Add Step 1 output as impulse → Execute → Output saved
  ↓
Step 3 → Add Step 2 output as impulse → Execute → Output saved
  ↓
Activity end → Close session
```

**Current Code Issue**:
`packages/opencode/src/tool/activity.ts` - `executeStepWithTracking()`:
- Calls task tools which spawn new sessions
- Should maintain single session
- Should use impulse system for context passing

**Solution Architecture**:
1. Create session at activity start
2. Load impulses from template
3. Each step adds impulses dynamically
4. Maintain conversation history
5. Pass outputs as impulses to next step

**Impact**: Critical - Context loss and inefficiency

---

## Issue 4: No TUI Visibility

**Current Behavior**:
- Activity executes silently
- User sees nothing for minutes/hours
- No progress indicators
- No streaming output
- Only final result appears

**User Experience**:
```
User: "Create hello world template"
[14 minutes of silence]
Result: "✅ Created template"
```

**Expected Behavior**:

**Message List**:
```
User: Create hello world template