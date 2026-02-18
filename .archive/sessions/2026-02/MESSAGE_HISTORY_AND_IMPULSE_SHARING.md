# Message History Management & Impulse Sharing Architecture

## Two Key Questions

1. **How can session memory agent manage message history?**
2. **How does data sharing between independent activity subagents work via impulses?**

---

## Part 1: Message History Management

### Current System

**File**: `session/compaction.ts`

**Functions**:
- `SessionCompaction.prune()` - Removes old tool outputs
- `SessionCompaction.run()` - Generates summaries via LLM
- `SessionCompaction.isOverflow()` - Detects context overflow

**How it works now**:
```typescript
// Reactive - triggered AFTER overflow
if (SessionCompaction.isOverflow({tokens, model})) {
  await SessionCompaction.run({sessionID, providerID, modelID})
  // Generates summary of old messages
  // Marks them as compacted
}
```

### How Session Memory Agent Could Manage It

**Instead of reactive compaction**, memory agent could **proactively** create impulses for message history:

```typescript
// Memory agent tool calls:

1. memory_budget() 
   → {used: 45000, available: 55000, messageHistory: 30000}

2. [Decides message history is large]

3. impulse_create({
     id: "message-history-summary",
     type: "memo",
     pointer: {
       type: "memo",
       content: await summarizeMessages(sessionID, turns: 1-20)
     },
     budget: 2000,  // Compressed from 30000
     priority: "medium"
   })

4. [Marks original messages as "summarized in impulse"]

5. memory_budget()
   → {used: 17000, available: 83000}  // Freed 28k tokens!
```

**Benefits**:
- Proactive (before overflow)
- Managed via impulse system
- Visible to agent (can reference summary)
- Reusable across activities

### Implementation

**Add impulse pointer type**: `messageHistorySummary`

```typescript
// In activity-template.ts
export type Pointer = 
  | ...existing types...
  | { 
      type: "messageHistorySummary", 
      sessionID: string, 
      turnRange: [number, number],  // e.g. [1, 20]
      summaryStrategy: "dense" | "brief"
    }
```

**Resolver** (in impulse-resolver.ts):
```typescript
case "messageHistorySummary":
  const messages = await getMessagesInRange(
    pointer.sessionID, 
    pointer.turnRange
  )
  const summary = await SessionCompaction.summarizeRange(
    messages,
    pointer.summaryStrategy
  )
  return summary  // Compressed message history
```

**Memory agent can now**:
```
1. Detect large message history
2. Create summary impulse
3. Reference summary (not full history)
4. Free tokens for new context
```

---

## Part 2: Impulse Sharing Between Activities

### Current Architecture

**Two Scopes**:

1. **Session-scoped impulses** (`scope: "session"`)
   - Persist across conversation
   - Shared between all activities in session
   - Stored in `SessionMemory`
   - Example: User preferences, project context

2. **Activity-scoped impulses** (`scope: "activity"`)
   - Tied to activity lifecycle
   - Cleaned up when activity completes
   - Stored in `Activity.impulses`
   - Example: Task-specific context, intermediate results

### How Sharing Works Now

**Via ACP Delegate** (acp-delegate.ts):

```typescript
await acp_delegate({
  target: "docker://backend-agent",
  taskDescription: "Implement auth API",
  prompt: "Create login endpoint",
  shareImpulses: ["apiSpec", "userSchema"],  // Explicit sharing
  syncSessionState: true  // Share conversation history too
})
```

**Process**:
1. Parent activity has impulses: `apiSpec`, `userSchema`
2. `shareImpulses` param lists which to share
3. Impulses serialized and sent to remote agent
4. Remote agent receives as context

**Memory agent involvement**:
```typescript
// If shareImpulses not provided, memory agent selects:
if (!params.shareImpulses) {
  const intent = await SessionMemoryAgent.analyzeIntent({
    promptText: params.prompt,
    // Analyzes what context is needed
  })
  
  impulseIdsToShare = intent.suggestedImpulses
    .filter(s => existingImpulseIds.has(s.id))
    .map(s => s.id)
}
```

**Memory agent acts as context selector!**

### How It Should Work

**Scenario**: Multi-activity workflow

```typescript
// Activity 1: API Design
activity({
  activityId: "design-api",
  variables: {feature: "authentication"}
})

// Creates impulses:
// - "api-spec" (design document)
// - "data-model" (schema)
// - "security-requirements" (constraints)

// Activity 2: Backend Implementation  
activity({
  activityId: "implement-backend",
  variables: {feature: "authentication"},
  // How to share context from Activity 1?
})
```

**Current approach**: Manual sharing via ACP delegate

**Better approach**: Memory agent manages sharing

```typescript
// Before Activity 2 starts, memory agent:
1. memory_outline()
   → Sees impulses from Activity 1

2. [Analyzes Activity 2 requirements]

3. impulse_create({
     id: "shared-from-activity-1",
     type: "activityOutput",
     pointer: {
       type: "activityOutput",
       activityId: "act_xxx",  // Activity 1 ID
       impulseIds: ["api-spec", "data-model"]
     },
     budget: 5000,
     priority: "high"
   })

4. impulse_load({id: "shared-from-activity-1"})
   → Loads Activity 1's context

// Activity 2 now has Activity 1's context!
```

---

## Current Impulse Sharing Mechanisms

### 1. Session Scope (Already Works)

**Impulses in session scope** are automatically shared:

```typescript
// Activity 1
SessionMemory.addImpulse(sessionID, {
  id: "user-requirements",
  scope: "session",  // ← Persists
  ...
})

// Activity 2 (in same session)
const impulses = await SessionMemory.listImpulses(sessionID)
// Sees "user-requirements" from Activity 1!
```

**This already enables sharing** - just use session scope!

### 2. Explicit Sharing (ACP Delegate)

**For remote/distributed activities**:

```typescript
acp_delegate({
  target: "docker://frontend-agent",
  shareImpulses: ["api-spec"],  // Explicit
  // Sends impulse to remote agent
})
```

### 3. Activity Output Impulse (Could Add)

**Capture activity results as impulse**:

```typescript
// After Activity 1 completes
impulse_create({
  id: "activity-1-output",
  type: "activityOutput",
  pointer: {
    type: "activityOutput",
    activityId: "act_123",
    summary: activity.summary,
    keyOutputs: activity.completedTasks.map(t => t.output)
  },
  scope: "session",  // ← Available to future activities
  budget: 3000
})
```

---

## Message History as Impulse

### The Concept

**Instead of loading full message history**, create impulse:

```typescript
impulse_create({
  id: "recent-conversation",
  type: "conversationHistory",
  pointer: {
    type: "conversationHistory",
    sessionID: sessionID,
    turnRange: [current - 20, current],  // Last 20 turns
    compressionStrategy: "dense"  // or "brief" or "full"
  },
  budget: 3000,  // Compressed from ~10k
  priority: "medium"
})
```

**When loaded**:
- Impulse resolver calls SessionCompaction
- Generates compressed summary
- Returns 3k tokens instead of 10k
- Agent gets essence, not verbatim history

**Benefits**:
- Message history managed like any context
- Budget-aware (can compress more if needed)
- Lazy loading (only load if referenced)
- Reusable (other activities can load same summary)

---

## Data Sharing Between Independent Activities

### Scenario: Backend + Frontend Activities

**Goal**: Backend activity creates API, frontend activity consumes it

**Via Session-Scoped Impulses**:

```typescript
// Backend Activity
activity({activityId: "backend-api"})
  → Creates impulses:
     - "api-schema" (scope: session)
     - "endpoint-list" (scope: session)
     - "auth-flow" (scope: session)

// Frontend Activity (same session)
activity({activityId: "frontend-ui"})
  → Memory agent prepares context:
     1. memory_outline()
        → Sees "api-schema", "endpoint-list" from backend
     2. impulse_load({id: "api-schema"})
        → Loads backend's API design
     3. impulse_load({id: "auth-flow"})
        → Loads auth implementation details

// Frontend now has backend's context!
```

**No explicit coordination needed** - session scope automatically shares!

### Via Activity Output Impulse

**More structured**:

```typescript
// After backend activity completes
post-activity hook:
  impulse_create({
    id: "backend-api-output",
    type: "activityOutput",
    pointer: {
      type: "activityOutput",
      activityId: "act_backend_123",
      outputs: {
        "api-schema": loadedImpulseContent["api-schema"],
        "endpoint-implementations": completedTasks.map(t => t.output)
      }
    },
    scope: "session",
    budget: 5000
  })

// Frontend activity
memory agent:
  1. Sees "backend-api-output" impulse
  2. Recognizes it's from related activity
  3. impulse_load({id: "backend-api-output"})
  4. Frontend gets structured backend outputs
```

---

## Memory Agent as Coordinator

### The Memory Agent's Role

**Current**: Prepares context for single agent

**Extended**: Coordinates context across activities

```
Activity 1 starts
  ↓
Memory agent:
  - Check session impulses
  - Load relevant history
  - Create activity-specific impulses
  ↓
Activity 1 executes
  ↓
Activity 1 completes
  ↓
Memory agent:
  - Capture Activity 1 outputs as impulse
  - Mark as session-scoped
  - Add metadata: {sourceActivity: "act_123"}
  ↓
Activity 2 starts
  ↓
Memory agent:
  - Sees Activity 1 outputs
  - Loads if relevant
  - Activity 2 has Activity 1's context
```

**Memory agent becomes the knowledge broker!**

---

## Implementation

### Add Message History Impulse Type

**File**: `activity-template.ts`

```typescript
export type Pointer = 
  | ...existing...
  | {
      type: "messageHistorySummary",
      sessionID: string,
      turnRange: [number, number],
      strategy: "dense" | "brief" | "full"
    }
  | {
      type: "activityOutputSummary",
      activityId: string,
      includeImpulses: boolean,
      includeTaskOutputs: boolean
    }
```

### Memory Agent Can Create These

**In memory agent prompt**:

```
If message history is large (>10k tokens), create summary impulse:
- Check SessionState for message count
- If > 30 messages: Create messageHistorySummary impulse
- Use "dense" strategy for compression

If previous activities exist, create output impulse:
- Check for completed activities in session
- Create activityOutputSummary impulse
- Include key outputs and decisions
```

### Activity Completion Hook

**New hook**: Create output impulse after activity

```typescript
TurnLifecycle.registerActivityHook({
  name: "activity-output-capture",
  timing: "post-activity",
  
  execute: async (activity) => {
    // Capture activity outputs as impulse
    await SessionMemory.addImpulse(activity.sessionID, {
      id: `activity-output-${activity.id}`,
      type: "activityOutput",
      pointer: {
        type: "activityOutput",
        activityId: activity.id,
        summary: activity.summary,
        completedTasks: activity.completedTasks.length,
        keyImpulses: Object.keys(activity.impulses)
      },
      scope: "session",  // ← Available to future activities
      budget: 3000,
      priority: "medium",
      metadata: {
        activityTemplate: activity.templateId,
        completedAt: Date.now()
      }
    })
  }
})
```

---

## How Sharing Functions Now

### Session Scope Sharing (Auto)

```
Activity A creates:
  SessionMemory.addImpulse(sessionID, {
    id: "design-doc",
    scope: "session"  // ← Key
  })

Activity B (same session):
  memory_outline() → Sees "design-doc"
  impulse_load({id: "design-doc"}) → Gets Activity A's data
```

**Already works!** Just use session scope.

### Activity Scope (Isolated)

```
Activity A creates:
  activity.impulses["temp-data"] = {
    id: "temp-data",
    scope: "activity"  // ← Isolated
  }

Activity B:
  memory_outline() → Does NOT see "temp-data"
  // Activity-scoped impulses are private
```

**Use for**: Temporary context that shouldn't leak

### Cross-Session Sharing (ACP)

```
Session A, Activity 1:
  Creates impulses

acp_delegate({
  target: "docker://other-agent",
  shareImpulses: ["design-doc"],  // ← Explicit sharing
  // Serializes and sends to remote
})

Session B, Activity 2 (in container):
  Receives "design-doc" impulse
  Can use it
```

**For distributed workflows**

---

## How Memory Agent Enables This

### Memory Agent as Context Broker

**Current role**: Create impulses for single turn

**Extended role**: Manage context flow across activities

```
Turn 1 (Activity A starts):
  Memory agent:
    - Loads relevant history
    - Creates activity-specific impulses
    
Activity A executes:
  - Creates own impulses (scope: session or activity)
  - Completes with outputs
  
Turn N (Activity A completes):
  Memory agent:
    - Captures Activity A outputs as impulse
    - Marks as session-scoped
    
Turn N+1 (Activity B starts):
  Memory agent:
    - Sees Activity A output impulse
    - Loads if relevant to Activity B
    - Activity B has Activity A's context
```

**Memory agent orchestrates knowledge flow!**

---

## Proposed Enhancements

### Enhancement 1: Message History Impulses

**Memory agent creates history impulses**:

```typescript
// In prepareSessionMemory()
const messageCount = await MessageV2.count(sessionID)

if (messageCount > 30) {
  // Spawn memory agent with task:
  `Check if message history needs summarization.
  If > 30 messages, create messageHistorySummary impulse for turns 1-20.
  Keep recent 10 turns uncompressed.`
  
  // Memory agent:
  // 1. memory_budget() - Check space
  // 2. impulse_create({type: "messageHistorySummary"})
  // 3. Marks old messages as "in impulse"
}
```

### Enhancement 2: Activity Output Capture

**Post-activity hook**:

```typescript
TurnLifecycle.registerActivityHook({
  name: "capture-activity-outputs",
  timing: "post-activity",
  
  execute: async (activity) => {
    // Spawn memory agent to capture outputs
    const memoryPrompt = `Capture outputs from completed activity ${activity.id}
    
    Activity: ${activity.templateId}
    Completed tasks: ${activity.completedTasks.length}
    Created impulses: ${Object.keys(activity.impulses).length}
    
    Create summary impulse:
    1. impulse_create({
         id: "activity-${activity.id}-output",
         type: "activityOutput",
         scope: "session",
         // Include key outputs and decisions
       })
    `
    
    // Memory agent captures and makes available to future activities
  }
})
```

### Enhancement 3: Smart Context Selection

**Memory agent selects what to share**:

```typescript
// Activity B starting, Activity A just completed

memory agent:
  1. memory_outline()
     → Sees Activity A impulses
     → Sees Activity A output impulse
  
  2. [Analyzes Activity B requirements]
     → "Needs API design from Activity A"
  
  3. impulse_load({id: "api-design"})
     → Loads relevant impulse from Activity A
  
  4. [Skips irrelevant Activity A impulses]
     → Only loads what Activity B needs
```

**Intelligent sharing, not blind copying!**

---

## How It Functions Now (Empirical)

### From Logs (20:23:59 - 20:24:01)

**We saw**:
```
Memory agent creates impulses:
- "current-proto-schema" (scope: session)
- "action-plan" (scope: session)
- "bootstrap-template-example" (scope: session)

All created in parent session.
```

**This means**:
- ✅ Session-scoped impulses work
- ✅ Cross-session creation works (memory agent → parent)
- ✅ Impulses persist in session
- ✅ Available to all activities in that session

**If Activity A and Activity B run in same session**:
- Activity A creates "api-spec" impulse
- Activity B's memory agent sees it via memory_outline()
- Activity B can load it via impulse_load()

**Already functional!**

---

## What's Missing

### 1. Message History Impulses

**Current**: Messages stay in full form, compacted reactively

**Better**: Memory agent creates summary impulses proactively

**Need**:
- `messageHistorySummary` pointer type
- Resolver implementation
- Memory agent instruction to create these

### 2. Activity Output Capture

**Current**: Activity outputs not captured as reusable impulses

**Better**: Post-activity hook creates output impulse

**Need**:
- Post-activity lifecycle hook
- Activity output serialization
- Session-scoped storage

### 3. Cross-Activity Memory Agent

**Current**: Memory agent prepares for single turn/activity

**Better**: Memory agent sees all session context, selects relevant for each activity

**Need**:
- Memory agent awareness of previous activities
- Smart selection of relevant impulses
- Filtering of irrelevant context

---

## Summary

### How It Works Now

**Session-scoped impulses**: ✅ Already enable sharing between activities

**Process**:
1. Activity A creates impulse (scope: "session")
2. Impulse persists in SessionMemory
3. Activity B's memory agent runs
4. Sees Activity A's impulses via memory_outline()
5. Loads relevant ones via impulse_load()

**This is functional!**

### What We Could Add

1. **Message history impulses** - Compress history into impulses
2. **Activity output capture** - Structured activity → activity sharing
3. **Smart context selection** - Memory agent picks relevant cross-activity context

### The Key Insight

**Session-scoped impulses already enable activity-to-activity data sharing!**

Memory agent just needs to:
- Create impulses with scope: "session" (not "activity")
- Later activities see them automatically
- Load what's relevant

**It's working, we just need to use it more intentionally.**
