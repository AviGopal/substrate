# Immediate Fix Plan - Activity System Realignment

**Date**: February 12, 2026 19:20 PST  
**Goal**: Fix architectural misalignments before building instruction generation

---

## Problem Summary

Current implementation treats activities as **scripts to execute**.  
Should treat activities as **instruction generators that learn**.

But before we can build instruction generation, we must fix 4 blocking issues:

1. ❌ Templates read filesystem (dev-only)
2. ❌ No parent context passed to execution
3. ❌ New session per step (context lost)
4. ❌ No TUI visibility

---

## Fix Order (Dependencies)

```
Fix 1: Single Session + Impulse System
  ↓ (enables)
Fix 2: Parent Context Flow
  ↓ (enables)
Fix 3: Self-Contained Templates
  ↓ (enables)
Fix 4: TUI Visibility
```

---

## Fix 1: Single Session with Impulse-Based Context Passing

### Current Behavior
```typescript
for (const step of steps) {
  // Each step spawns new agent session
  const result = await taskTool.execute(step.prompt)
  // Session discarded, no continuity
}
```

### Target Behavior
```typescript
// Create ONE session for entire activity
const session = await createActivitySession({
  parentContext: ctx.sessionID,
  impulses: template.impulse_refs  // From template
})

for (const step of steps) {
  // Add step-specific impulses
  await session.addImpulses([
    ...step.impulse_refs,
    ...priorStepOutputs  // Cumulative context
  ])
  
  // Execute within same session
  const result = await session.executeStep(step)
  
  // Save output as impulse for next step
  priorStepOutputs.push({
    type: "memo",
    content: result.output,
    metadata: {stepId: step.id}
  })
}

await session.close()
```

### Implementation Location
**File**: `packages/opencode/src/tool/activity.ts`

**Changes Needed**:
1. Create `ActivitySession` class that wraps agent session
2. Replace `executeStepWithTracking()` to use session
3. Implement impulse accumulation between steps
4. Pass outputs forward as impulses

### Code Sketch
```typescript
class ActivitySession {
  private agentSession: AgentSession
  private impulseStack: Impulse[] = []
  
  constructor(
    parentSessionId: string,
    templateImpulses: ImpulseRef[]
  ) {
    // Create child session
    this.agentSession = new AgentSession({
      parentId: parentSessionId,
      impulses: templateImpulses
    })
  }
  
  async executeStep(step: TaskStep, priorOutputs: StepOutput[]) {
    // Add prior outputs as impulses
    const outputImpulses = priorOutputs.map(o => ({
      type: "memo",
      content: o.output,
      metadata: {fromStep: o.stepId}
    }))
    
    await this.agentSession.loadImpulses([
      ...step.impulse_refs,
      ...outputImpulses
    ])
    
    // Execute step in session
    return await this.agentSession.execute(step)
  }
  
  async close() {
    await this.agentSession.close()
  }
}
```

**Status**: Not implemented (new code needed)

---

## Fix 2: Parent Context Flow via Impulses

### Current Behavior
```typescript
activity({
  activityId: "activity-create",
  variables: {template_name: "hello-world"},
  reason: "User wants greeting"
})

// Activity executes with NO parent context
// Guesses intent from filesystem
```

### Target Behavior
```typescript
// Activity tool captures parent context
const parentContext = {
  conversationHistory: ctx.messageHistory.slice(-10),
  currentFiles: ctx.workingFiles,
  userIntent: params.reason,
  codebaseState: await getCodebaseSnapshot()
}

// Convert to impulses
const contextImpulses = [
  {
    type: "memo",
    id: "parent-intent",
    content: parentContext.userIntent
  },
  {
    type: "conversation",
    id: "parent-history",
    messages: parentContext.conversationHistory
  },
  {
    type: "files",
    id: "working-files",
    files: parentContext.currentFiles
  }
]

// Pass to activity session
const session = await createActivitySession({
  parentContext: ctx.sessionID,
  impulses: [
    ...template.impulse_refs,
    ...contextImpulses  // Parent context available!
  ]
})
```

### Implementation Location
**File**: `packages/opencode/src/tool/activity.ts` - `execute()` function

**Changes Needed**:
1. Capture parent session context
2. Convert to impulse format
3. Pass to ActivitySession

**Code Sketch**:
```typescript
async execute(params, ctx) {
  const template = await TemplateRepository.get(params.activityId, ctx)
  
  // NEW: Capture parent context
  const parentContextImpulses = await this.captureParentContext(ctx, params)
  
  // NEW: Create activity session with parent context
  const session = new ActivitySession(
    ctx.sessionID,
    [...template.impulse_refs, ...parentContextImpulses]
  )
  
  // Execute steps in session
  for (const step of template.tasks) {
    const result = await session.executeStep(step, priorOutputs)
    priorOutputs.push(result)
  }
  
  await session.close()
}

private async captureParentContext(ctx, params): Promise<Impulse[]> {
  return [
    {
      type: "memo",
      id: "user-intent",
      content: params.reason
    },
    {
      type: "conversation",
      id: "parent-history",
      messages: ctx.messageHistory?.slice(-10) || []
    }
  ]
}
```

**Status**: Not implemented

---

## Fix 3: Self-Contained Templates (No Filesystem Reads)

### Current Problem
`activity-create` template has prompts like:
```
"Read /server/proto/activity.proto and extract schema"
```

This breaks in production where source files don't exist.

### Target Solution
Template includes schema as impulse reference:

```json
{
  "variant_id": "INFRASTRUCTURE-0013e379",
  "variant_name": "Activity Create",
  "impulse_refs": [
    {
      "id": "activity-schema",
      "type": "memo",
      "content": "syntax = \"proto3\";\n\nmessage ActivityTemplate {\n  ..."
    },
    {
      "id": "example-template",
      "type": "memo",
      "content": "{\"variant_id\": \"example-001\", \"tasks\": [...]}"
    }
  ],
  "task_steps": [
    {
      "id": "design-template",
      "description": "Design activity template",
      "prompt": {
        "template": "Using the activity schema provided in impulses, design a template for {{goal}}"
      },
      "impulse_refs": ["activity-schema", "example-template"]
    }
  ]
}
```

### Implementation Steps

1. **Update activity-create template in backend**:
   - Add schema as impulse_ref
   - Add example templates as impulse_refs
   - Update prompts to reference impulses instead of files

2. **Verify impulse loading works**:
   - Test that session receives impulses
   - Confirm agent can access impulse content

3. **Remove filesystem reads from prompts**:
   - No more "Read file X"
   - Instead: "Using the schema from impulses"

**Location**: Backend SQL or template registration

**Status**: Requires backend template update

---

## Fix 4: TUI Visibility

### Current Problem
Activity executes silently for 14 minutes. User sees nothing.

### Target Solution

**Message List Shows**:
```
User: Create a hello world template
Assistant (Activity Starting): 🎯 Activity: Activity Create
  Status: Analyzing conversation for template requirements...

Assistant (Step 1/5): 📝 Identifying interaction pattern
  Status: In progress...
  [2 minutes later]
  ✅ Complete - Pattern identified: greeting workflow

Assistant (Step 2/5): 🎯 Defining activity scope
  Status: In progress...
  [8 seconds later]
  ✅ Complete - Scope: simple greeting with customization

Assistant (Step 3/5): 🔨 Designing task steps
  Status: In progress...
  [3 minutes later]
  ✅ Complete - 3 steps designed

Assistant (Step 4/5): 📄 Creating activity template
  Status: Generating JSON...
  [3 minutes later]
  ✅ Complete - Template created

Assistant (Step 5/5): ✓ Validating template
  Status: Checking schema compliance...
  [2 minutes later]
  ✅ Complete - Validation passed

Assistant (Activity Complete): ✅ Activity: Activity Create
  Duration: 14m 3s
  Cost: $0.0085
  Result: Created template "hello-world-test" (3 tasks)
  Template ID: infrastructure-ea49acdc
```

**Sidebar Shows**:
```
┌─ Activity Progress ─┐
│ Activity Create      │
│ ████████░░ 80%      │
│                      │
│ Step 4/5: Creating   │
│ Time: 11m 2s         │
│ Cost: $0.0068        │
└──────────────────────┘
```

### Implementation Location
**Files**: 
- `packages/opencode/src/tool/activity.ts` - Emit progress events
- `packages/opencode/src/server/server.ts` - Stream to TUI
- TUI component - Display activity status

**Changes Needed**:
1. Activity tool emits progress events
2. Server streams events to TUI
3. TUI renders activity progress in message list
4. Sidebar shows current activity status

**Code Sketch**:
```typescript
// In activity.ts
for (const step of template.tasks) {
  // Emit progress
  ctx.emitProgress({
    type: "activity-step-start",
    activityId: template.id,
    activityName: template.name,
    stepIndex: i,
    totalSteps: template.tasks.length,
    stepDescription: step.description
  })
  
  const result = await session.executeStep(step, priorOutputs)
  
  ctx.emitProgress({
    type: "activity-step-complete",
    stepIndex: i,
    success: result.success,
    duration: result.duration,
    cost: result.cost
  })
}
```

**Status**: Not implemented

---

## Implementation Order

### Phase 1: Single Session (Highest Priority)
**Why first**: Blocks context passing and learning

**Tasks**:
1. Create `ActivitySession` class
2. Refactor `executeStepWithTracking` to use session
3. Implement impulse accumulation
4. Test with simple activity

**Time estimate**: 4-6 hours  
**Test**: Run echo-proof activity, verify session maintained

---

### Phase 2: Parent Context Flow
**Why second**: Enables activities to work correctly

**Tasks**:
1. Capture parent context in activity tool
2. Convert to impulse format
3. Pass to ActivitySession
4. Test with activity-create

**Time estimate**: 2-3 hours  
**Test**: activity-create receives parent intent, doesn't read files

---

### Phase 3: Self-Contained Templates
**Why third**: Requires template updates in backend

**Tasks**:
1. Update activity-create template with schema impulses
2. Remove filesystem reads from prompts
3. Add example templates as impulses
4. Test in container (no dev files)

**Time estimate**: 2-3 hours  
**Test**: Run in clean container, activity works

---

### Phase 4: TUI Visibility
**Why last**: Nice to have, doesn't block functionality

**Tasks**:
1. Add progress events to activity tool
2. Stream to TUI
3. Render in message list
4. Add sidebar widget

**Time estimate**: 4-6 hours  
**Test**: Watch 14-minute activity with live progress

---

## Success Criteria

After fixes:
- ✅ Activities maintain single session across steps
- ✅ Step N receives output from Step N-1 as impulse
- ✅ Parent agent context flows to activity
- ✅ No filesystem reads during execution
- ✅ Activity progress visible in TUI
- ✅ Works in production containers

---

## Then: Instruction Generation

After these fixes, we can build the learning system:

1. **InstructionGenerator** - Generate dynamic instructions from templates
2. **Outcome Analyzer** - Autopsy system (activity itself!)
3. **Template Evolution** - Learn and improve
4. **Meta-learning** - Activities analyze activities

But first: Fix the foundation.

---

## Starting Point: Phase 1 - Single Session

Let's begin with ActivitySession implementation.

**File to create**: `packages/opencode/src/session/activity-session.ts`

**File to modify**: `packages/opencode/src/tool/activity.ts`

Ready to proceed?

