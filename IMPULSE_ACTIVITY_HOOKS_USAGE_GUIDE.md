# Impulse Activity Hooks - Usage Guide

## Overview

The impulse system is now integrated with activity lifecycle hooks, enabling seamless context flow between agent sessions and activities.

**Key Benefit**: Activities can now access session context (impulses) and contribute new context back to the session automatically.

## How It Works

### Architecture

```
Agent Session (with impulses)
    ↓
    ↓ Invoke activity with callingSessionId
    ↓
Activity Template Execution
    ↓
    ├─→ preActivity Hook
    │   └─→ loadImpulses: Load specified impulses from SessionMemory
    │
    ├─→ Task Execution (with loaded impulse context)
    │   └─→ Tasks can create new impulses
    │
    └─→ postActivity Hook
        └─→ persistImpulses: Save specified impulses back to SessionMemory
    ↓
Agent Session (impulses persisted)
```

### Data Flow

1. **Agent Session** has impulses in SessionMemory
2. **Activity invoked** with `callingSessionId` parameter
3. **preActivity hook** loads impulses from SessionMemory → Activity context
4. **Tasks execute** with impulse context available
5. **postActivity hook** persists new impulses → SessionMemory
6. **Agent Session** can now access the new impulses

## Using Impulse Hooks in Templates

### Step 1: Define Context Requirements

In your activity template, specify what context you need:

```json
{
  "id": "my-feature-activity",
  "name": "Implement Feature",
  "contextRequirements": [
    {
      "key": "design-doc",
      "hint": "Design document or requirements",
      "impulseTypes": ["file", "memo"],
      "required": true,
      "budgetRange": [2000, 5000]
    },
    {
      "key": "api-spec",
      "hint": "API specification",
      "impulseTypes": ["file", "memo"],
      "required": false,
      "budgetRange": [1000, 3000]
    }
  ]
}
```

### Step 2: Configure preActivity Hook

Tell the activity which impulses to load:

```json
{
  "hooks": {
    "preActivity": {
      "loadImpulses": ["design-doc", "api-spec"],
      "workingDirectory": {
        "type": "temporary",
        "prefix": "feature-impl-",
        "cleanup": "onSuccess"
      }
    }
  }
}
```

**What happens:**
- If activity is invoked from a session (has `callingSessionId`)
  - Loads each impulse from SessionMemory
  - Makes impulses available to tasks
  - Logs success/failure for each impulse
- If activity is invoked from CLI (no `callingSessionId`)
  - Logs that impulses should be in Activity.impulses
  - No error - graceful handling

### Step 3: Reference Impulses in Tasks

Tasks can reference the loaded impulses:

```json
{
  "tasks": [
    {
      "id": "implement-feature",
      "impulseReferences": ["design-doc", "api-spec"],
      "prompt": {
        "template": "Implement the feature described in the design doc.\n\nRefer to the API spec for interface definitions.\n\n..."
      }
    }
  ]
}
```

**Note**: The referenced impulses are loaded automatically by the framework. Your task just needs to reference them in the prompt.

### Step 4: Configure postActivity Hook

Tell the activity which impulses to persist:

```json
{
  "hooks": {
    "postActivity": {
      "persistImpulses": ["implementation-notes", "test-results"],
      "createSummary": true,
      "cleanup": true
    }
  }
}
```

**What happens:**
- If activity was invoked from a session (has `callingSessionId`)
  - Gets activity impulses from Activity.impulses
  - For each specified impulse:
    - Copies impulse to SessionMemory
    - Sets scope to "session"
    - Sets sessionID to callingSessionId
  - Logs success/failure for each impulse
- If activity was invoked from CLI (no `callingSessionId`)
  - Logs that impulses remain in Activity.impulses
  - No error - graceful handling

### Step 5: Create Impulses During Execution

Your tasks can create new impulses that will be persisted:

```json
{
  "tasks": [
    {
      "id": "document-implementation",
      "description": "Create implementation notes",
      "prompt": {
        "template": "Document the implementation.\n\nCreate an impulse named 'implementation-notes' with:\n- Design decisions made\n- Tradeoffs considered\n- Known limitations\n\nUse the appropriate tool to create the impulse."
      }
    }
  ]
}
```

**Note**: The task should create an impulse with one of the IDs specified in `persistImpulses`. The postActivity hook will persist it automatically.

## Complete Example Template

```json
{
  "id": "feature-with-context",
  "name": "Implement Feature with Context",
  "version": 1,
  "description": "Implement a feature using design context and persist implementation notes",
  "category": "feature",
  
  "contextRequirements": [
    {
      "key": "design-doc",
      "hint": "Feature design document",
      "impulseTypes": ["file", "memo"],
      "required": true,
      "budgetRange": [2000, 5000]
    }
  ],
  
  "tasks": [
    {
      "id": "implement",
      "subagent": "general",
      "description": "Implement the feature",
      "dependencies": [],
      "impulseReferences": ["design-doc"],
      "prompt": {
        "template": "Implement the feature as described in the design doc.\n\n**Requirements:**\n- Follow the design patterns specified\n- Include unit tests\n- Create comprehensive implementation notes\n\n**Create impulse:**\nCreate an impulse named 'implementation-notes' documenting:\n- Files modified\n- Key design decisions\n- Test coverage\n- Known limitations"
      }
    }
  ],
  
  "hooks": {
    "preActivity": {
      "loadImpulses": ["design-doc"],
      "workingDirectory": {
        "type": "temporary",
        "prefix": "feature-impl-",
        "cleanup": "onSuccess"
      }
    },
    "postActivity": {
      "persistImpulses": ["implementation-notes"],
      "createSummary": true,
      "cleanup": true
    }
  }
}
```

## Invocation Examples

### From Agent Session (Typical Usage)

```typescript
// Agent session has impulses loaded
const sessionID = "session-123"

// Impulse already in session memory
await SessionMemory.addImpulse(sessionID, {
  id: "design-doc",
  pointer: { type: "file", path: "docs/feature-design.md" },
  budget: 3000,
  scope: "session",
  sessionID,
  priority: "high",
})

// Execute activity with session context
const result = await TemplateExecutor.execute({
  templateId: "feature-with-context",
  variables: { featureName: "user-authentication" },
  callingSessionId: sessionID, // ← Key parameter
  reason: "Implement user authentication feature",
})

// After execution, implementation-notes impulse is in SessionMemory
const notes = await SessionMemory.getImpulse(sessionID, "implementation-notes")
console.log("Implementation notes:", notes)
```

### From CLI (Without Session)

```bash
# Activity invoked directly via CLI
opencode activity run feature-with-context \
  --variable featureName=user-authentication \
  --reason "Implement user authentication"

# No callingSessionId → impulses managed in Activity.impulses only
# No error - graceful handling
```

## Debugging

### Check Logs

The implementation includes detailed logging:

```typescript
// preActivity - loading impulses
log.info("loading impulses from session memory", {
  sessionId: execContext.callingSessionId,
  impulseIds: hooks.loadImpulses,
})

// Success
log.debug("loaded impulse from session memory", { impulseId })

// Warning - impulse not found
log.warn("impulse not found in session memory", { impulseId })

// Error - failed to load
log.error("failed to load impulse from session memory", { impulseId, error })

// postActivity - persisting impulses
log.info("persisting impulses to session memory", {
  sessionId: context.callingSessionId,
  impulseIds: hooks.persistImpulses,
})

// Success
log.info("persisted impulse to session memory", { impulseId })

// Warning - impulse not found in activity
log.warn("impulse not found in activity context", { impulseId })

// Error - failed to persist
log.error("failed to persist impulse to session memory", { impulseId, error })
```

### Common Issues

**Issue 1: Impulses not loading**
- Check: Is `callingSessionId` being passed?
- Check: Do impulses exist in SessionMemory before execution?
- Check: Are impulse IDs in `loadImpulses` correct?
- Look for: "impulse not found in session memory" warning in logs

**Issue 2: Impulses not persisting**
- Check: Did tasks create impulses with correct IDs?
- Check: Are impulse IDs in `persistImpulses` correct?
- Check: Is activity completing successfully?
- Look for: "impulse not found in activity context" warning in logs

**Issue 3: CLI mode issues**
- Expected: Logs show "activity invoked without session (CLI mode)"
- Behavior: No errors, impulses remain in Activity.impulses
- Note: This is normal and correct behavior

## Best Practices

### 1. Minimal Impulse Loading
Only load impulses you actually need:
```json
"loadImpulses": ["design-doc"]  // ✓ Only what's needed
"loadImpulses": ["design-doc", "api-spec", "requirements", "tests", "old-implementation"]  // ✗ Too many
```

### 2. Explicit Persistence
Only persist impulses you want in session:
```json
"persistImpulses": ["implementation-notes"]  // ✓ Clear intent
"persistImpulses": ["notes1", "notes2", "debug-data", "temp"]  // ✗ Too much
```

### 3. Descriptive Impulse IDs
Use clear, descriptive IDs:
```json
"loadImpulses": ["feature-design-doc", "api-specification"]  // ✓ Clear
"loadImpulses": ["doc1", "spec2"]  // ✗ Ambiguous
```

### 4. Match Context Requirements
Ensure impulse IDs match your contextRequirements:
```json
"contextRequirements": [
  { "key": "design-doc", ... }  // Key here
],
"hooks": {
  "preActivity": {
    "loadImpulses": ["design-doc"]  // Must match key
  }
}
```

### 5. Error Handling
The hooks handle errors gracefully, but you should:
- Check logs for warnings/errors
- Have fallback behavior if impulses are missing
- Document required vs optional impulses clearly

## Migration Guide

### Updating Existing Templates

If you have existing templates without impulse hooks:

1. **Identify context needs**: What information do tasks need?
2. **Add contextRequirements**: Define the impulses you need
3. **Add preActivity.loadImpulses**: List impulse IDs to load
4. **Add postActivity.persistImpulses**: List impulses to persist
5. **Update tasks**: Add `impulseReferences` to tasks that need context

### Example Migration

**Before:**
```json
{
  "id": "deploy-app",
  "tasks": [
    {
      "id": "deploy",
      "prompt": { "template": "Deploy the application..." }
    }
  ]
}
```

**After:**
```json
{
  "id": "deploy-app",
  "contextRequirements": [
    { "key": "deploy-config", "hint": "Deployment configuration", ... }
  ],
  "tasks": [
    {
      "id": "deploy",
      "impulseReferences": ["deploy-config"],
      "prompt": { "template": "Deploy the application using the deploy config..." }
    }
  ],
  "hooks": {
    "preActivity": {
      "loadImpulses": ["deploy-config"]
    },
    "postActivity": {
      "persistImpulses": ["deploy-results"]
    }
  }
}
```

## Summary

The impulse hooks provide:

✅ **Seamless context flow** - Session context automatically available to activities  
✅ **Persistence** - Activity outputs automatically saved to session  
✅ **Graceful degradation** - Works with and without session context  
✅ **Error resilience** - Try-catch on every impulse operation  
✅ **Detailed logging** - Easy debugging and monitoring  
✅ **Backward compatible** - Optional hooks, existing templates unaffected  
✅ **Minimal changes** - ~20 lines of implementation code  

**Result**: Activities are now first-class citizens in the session context flow!
