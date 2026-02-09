# Session Memory Agent - Exact Symbol Transition Map

## Purpose
This document provides line-by-line symbol transitions for debugging and verification.

---

## Complete Call Chain with Line Numbers

### 1️⃣ User Message Arrives

**Entry**: `SessionPrompt.prompt(input: PromptInput)`  
**File**: `src/session/prompt.ts`  
**Line**: 371

---

### 2️⃣ Execute Pre-Turn Hooks

**Call**: `await TurnLifecycle.executePreTurnHooks(hookContext)`  
**File**: `src/session/prompt.ts`  
**Line**: 408

**Context Passed**:
```typescript
{
  sessionID: string
  userMessageID: string
  promptText: string      // ← Key: will be passed to memory agent
  agent: Agent.Info
  timestamp: number
}
```

---

### 3️⃣ Hook Invocation: session-memory-preparation

**Registration**: `TurnLifecycle.registerHook({...})`  
**File**: `src/session/turn-lifecycle-hooks.ts`  
**Line**: 22-88

**Key Symbols**:
- `name`: "session-memory-preparation"
- `priority`: 10
- `enabled`: Function returning boolean
- `execute`: Function calling prepareSessionMemory()

**Hook Execution** (line 48):
```typescript
const Prompt = await import("./prompt")
await Prompt.SessionPrompt.prepareSessionMemory({
  sessionID: ctx.sessionID,
  promptText: ctx.promptText,    // ← Passed through
  agent: ctx.agent.name,
})
```

**Transition**: Module `"./prompt"` → Namespace `SessionPrompt` → Function `prepareSessionMemory`

---

### 4️⃣ Prepare Session Memory

**Call**: `SessionPrompt.prepareSessionMemory(input)`  
**File**: `src/session/prompt.ts`  
**Line**: 2423 (exported)

**Parameters**:
```typescript
{
  sessionID: string
  promptText: string
  agent: string
}
```

---

### 5️⃣ Gate Check: Should Run?

**Call**: `await SessionMemoryAgent.shouldRun({...})`  
**File**: `src/session/prompt.ts`  
**Line**: 2433

**Symbol**: → `SessionMemoryAgent.shouldRun`  
**Location**: `src/session/memory-agent.ts:971`

**Returns**: `boolean`

---

### 6️⃣ Extract Activity Context Hints

**Start**: Line 2457 in `src/session/prompt.ts`

#### Step 6a: Initialize

```typescript
// Line 2457
let activityContextHints: ActivityTemplate.ContextRequirement[] = []
```

**Symbol Created**: `activityContextHints`  
**Type**: `ActivityTemplate.ContextRequirement[]`  
**Initial Value**: `[]` (empty array)

---

#### Step 6b: Import Modules

```typescript
// Line 2459
const { Activity } = await import("./activity")

// Line 2460
const { TemplateProvider } = await import("./template-provider")
```

**Symbols Imported**:
- `Activity` - Namespace for activity management
- `TemplateProvider` - Namespace for template metadata

---

#### Step 6c: Get Activity for Session

```typescript
// Line 2461
const activityId = Activity.getActivityForSession(input.sessionID)
```

**Symbol**: `activityId`  
**Type**: `string | undefined`  
**Function**: `Activity.getActivityForSession(sessionId: string)`  
**Location**: `src/session/activity.ts:34`

**Logic**:
```typescript
export function getActivityForSession(sessionId: string): string | undefined {
  return sessionActivityMap.get(sessionId)
}
```

**Returns**: Activity ID if session has active activity, undefined otherwise

---

#### Step 6d: Load Activity (if exists)

```typescript
// Line 2463-2476
if (activityId) {
  try {
    const activity = await Activity.load(activityId)  // Line 2465
    if (activity.templateId) {                        // Line 2466
      const template = await TemplateProvider.getMetadata(activity.templateId)  // Line 2467
      if (template?.contextRequirements) {            // Line 2468
        activityContextHints = template.contextRequirements  // Line 2469
```

**Symbol Flow**:
- `activity` ← `Activity.load(activityId)`
- `activity.templateId` ← Property access
- `template` ← `TemplateProvider.getMetadata(templateId)`
- `template.contextRequirements` ← Property access
- `activityContextHints` ← **Assignment (the key moment!)**

**Log Statement** (line 2470):
```typescript
l.info("extracted activity context hints", {
  sessionID: input.sessionID,
  templateId: activity.templateId,
  requirementCount: activityContextHints.length,
})
```

**State Change**: `activityContextHints` now contains requirements or remains `[]`

---

### 7️⃣ Analyze Intent with Hints

**Call**: `await SessionMemoryAgent.analyzeIntent({...})`  
**File**: `src/session/prompt.ts`  
**Line**: 2487-2492

```typescript
const intent = await SessionMemoryAgent.analyzeIntent({
  sessionID: input.sessionID,
  promptText: input.promptText,
  recentMessages,
  activityContextHints,  // ← Line 2491: HINTS PASSED
})
```

**Symbol**: `intent`  
**Type**: `Intent`  
**Transition**: → `SessionMemoryAgent.analyzeIntent()`

---

### 8️⃣ SessionMemoryAgent.analyzeIntent()

**Function**: `export async function analyzeIntent(input: {...})`  
**File**: `src/session/memory-agent.ts`  
**Line**: 97

**Parameter**: `input.activityContextHints?: ActivityTemplate.ContextRequirement[]`  
**Line**: 101

---

#### Step 8a: Build System Prompt

**Action**: Construct prompt with hints section  
**Line**: 142-205

**Key Transition** (line 185-200):
```typescript
${input.activityContextHints && input.activityContextHints.length > 0 ? `

## Activity Context Hints

The current activity has specific context requirements. Use these to guide impulse creation:

${input.activityContextHints.map(req => `
### ${req.key} (${req.required ? 'REQUIRED' : 'optional'})
- **Hint**: ${req.hint}
- **Types**: ${req.impulseTypes.join(', ')}
- **Budget**: ${req.budgetRange[0]}-${req.budgetRange[1]} tokens
- **Priority**: ${req.required ? 'high' : 'medium'}
`).join('\n')}

**IMPORTANT**: Create impulses that satisfy these requirements.` : ""}
```

**Symbol**: `system` (array of strings)  
**Contains**: Base prompt + hints section (if hints present)

---

#### Step 8b: LLM Call

**Call**: `await generateObject({...})`  
**Line**: 345

**Input**: System prompt with hints + user message  
**Output**: Structured Intent object

---

#### Step 8c: Return Intent

**Symbol**: `intent`  
**Type**: `Intent`  
**Line**: 408 (returned)

**Log Statement** (line 398):
```typescript
l.info("analyzeIntent() completed", {
  sessionID: input.sessionID,
  type: intent.type,
  confidence: intent.confidence,
  reasoning: intent.reasoning,
  suggestedImpulsesCount: intent.suggestedImpulses.length,
  impulseIds: intent.suggestedImpulses.map((i) => i.id),
  elapsed: duration,
})
```

**Back to prepareSessionMemory** with `intent`

---

### 9️⃣ Prepare Session Memory

**Call**: `await SessionMemoryAgent.prepare({...})`  
**File**: `src/session/prompt.ts`  
**Line**: 2501-2506

```typescript
const result = await SessionMemoryAgent.prepare({
  sessionID: input.sessionID,
  intent,
  turnNumber,
  activityContextHints,  // ← Line 2505: HINTS PASSED AGAIN
})
```

**Symbol**: `result`  
**Transition**: → `SessionMemoryAgent.prepare()`

---

### 🔟 SessionMemoryAgent.prepare()

**Function**: `export async function prepare(input: {...})`  
**File**: `src/session/memory-agent.ts`  
**Line**: 792

**Parameter**: `input.activityContextHints?: ActivityTemplate.ContextRequirement[]`  
**Line**: 795

**Loop Start** (line 832):
```typescript
for (const suggestion of input.intent.suggestedImpulses) {
```

**Symbol**: `suggestion` (each suggested impulse from LLM)

---

#### Step 10a: Create Impulse Schema

**Line**: 874-892

```typescript
const impulse: ActivityTemplate.Impulse.Schema = {
  id: suggestion.id,
  sessionID: input.sessionID,
  scope: "session",
  pointer: suggestion.pointer as ActivityTemplate.Impulse.Pointer,
  budget: suggestion.budget,
  priority: suggestion.priority,
  type: suggestion.type,
  description: suggestion.description,  // ← Fixed: Added
  metadata: {
    createdTurn: input.turnNumber,
    createdBy: "session-memory-agent",
  },
}
```

**Symbol**: `impulse` (unloaded schema)

---

#### Step 10b: Store Impulse

**Call**: `await SessionMemory.addImpulse(input.sessionID, impulse)`  
**Line**: 894

**Symbol**: → `SessionMemory.addImpulse`  
**Location**: `src/session/session-memory.ts:162`

**Storage Key**: `["session-memory", sessionID]`

**Counter**: `created++`

---

#### Step 10c: Determine Loading Strategy

**Line**: 897-910

```typescript
// Line 897
let shouldLoad = suggestion.priority === "high"
let loadReason = "high-priority"

// Line 902-909: Check against hints
if (!shouldLoad && input.activityContextHints) {
  const matchesRequirement = input.activityContextHints.some(req => 
    req.required && impulse.metadata?.requirement === req.key
  )
  if (matchesRequirement) {
    shouldLoad = true
    loadReason = "required-context"
  }
}
```

**Symbols**:
- `shouldLoad`: boolean (whether to load now)
- `loadReason`: string ("high-priority" | "required-context" | "not-loading")

**Key Logic**: Uses `activityContextHints` to prioritize required context

**Log Statement** (line 912):
```typescript
l.info("impulse created", {
  sessionID: input.sessionID,
  impulseId: impulse.id,
  priority: impulse.priority,
  budget: impulse.budget,
  willLoadNow: shouldLoad,
  loadReason: shouldLoad ? loadReason : "not-loading",
})
```

---

#### Step 10d: Load Impulse Content

**Condition**: `if (shouldLoad)` (line 922)

**Call**: `await ImpulseResolver.load(impulse)`  
**Line**: 925

**Symbol**: → `ImpulseResolver.load`  
**Location**: `src/session/impulse-resolver.ts:619`

**Input**: Unloaded impulse (no content, no tokenCount)  
**Output**: Loaded impulse

```typescript
{
  ...impulse,
  content: string,      // ← Resolved from pointer
  tokenCount: number,   // ← Counted
  loadedAt: number      // ← Timestamped
}
```

---

#### Step 10e: Update Storage with Loaded Content

**Call**: `await SessionMemory.updateImpulse(input.sessionID, suggestion.id, loadedImpulse)`  
**Line**: 926

**Symbol**: → `SessionMemory.updateImpulse`  
**Location**: `src/session/session-memory.ts:252`

**Action**: Update impulse in storage with content and tokenCount

**State Transition**:
- Before: `{...impulse, tokenCount: undefined}`
- After: `{...impulse, content: "...", tokenCount: 1847}`

**Counter**: `loaded++` (line 927)  
**Accumulator**: `totalTokens += loadedImpulse.tokenCount || 0` (line 928)

**Log Statement** (line 930):
```typescript
l.info("impulse loaded", {
  sessionID: input.sessionID,
  impulseId: loadedImpulse.id,
  loadReason,
  tokenCount: loadedImpulse.tokenCount,
  budget: loadedImpulse.budget,
  withinBudget: (loadedImpulse.tokenCount || 0) <= loadedImpulse.budget,
})
```

---

### 1️⃣1️⃣ Return Preparation Results

**Line**: 947-962 in `src/session/memory-agent.ts`

```typescript
l.info("prepare() completed", {
  sessionID: input.sessionID,
  created,
  loaded,
  unloaded,
  totalTokens,
  skipped: input.intent.suggestedImpulses.length - created,
  hintsProvided: input.activityContextHints?.length ?? 0,  // ← NEW
  hintsAddressed: created > 0 ? "yes" : "no",              // ← NEW
  elapsed: Date.now() - start,
})

return {
  impulsesCreated: created,
  impulsesLoaded: loaded,
  impulsesUnloaded: unloaded,
  totalTokens,
}
```

**Symbol**: Return object with statistics  
**Back to**: `prepareSessionMemory()` in prompt.ts

---

### 1️⃣2️⃣ Log Results

**File**: `src/session/prompt.ts`  
**Line**: 2508-2514

```typescript
l.info("session memory prepared", {
  created: result.impulsesCreated,
  loaded: result.impulsesLoaded,
  unloaded: result.impulsesUnloaded,
  tokens: result.totalTokens,
  elapsed: Date.now() - start,
})
```

---

### 1️⃣3️⃣ Optimize for Turn

**Call**: `await SessionMemoryLifecycle.optimizeForTurn({...})`  
**File**: `src/session/prompt.ts`  
**Line**: 2517

**Action**: Cleanup stale impulses

---

### 1️⃣4️⃣ Return to Hook

**File**: `src/session/turn-lifecycle-hooks.ts`  
**Line**: 57-64

```typescript
return {
  success: true,
  modified: true,
  duration: Date.now() - start,
}
```

**Back to**: `executePreTurnHooks()` in TurnLifecycle

---

### 1️⃣5️⃣ Continue Main Prompt Flow

**File**: `src/session/prompt.ts`  
**Line**: 430+

- Other hooks execute
- Build final prompt
- Load impulse content via `ImpulseFormatter`
- Inject into prompt as `<session_memory>` tags
- Execute main agent

---

## Symbol Lifecycle: activityContextHints

### Creation
```typescript
// File: src/session/prompt.ts
// Line: 2457
let activityContextHints: ActivityTemplate.ContextRequirement[] = []
```

### Population
```typescript
// File: src/session/prompt.ts  
// Line: 2469
activityContextHints = template.contextRequirements
```

### Pass 1: To analyzeIntent
```typescript
// File: src/session/prompt.ts
// Line: 2491
activityContextHints,  // Passed as parameter
```

### Receive 1: In analyzeIntent
```typescript
// File: src/session/memory-agent.ts
// Line: 101
activityContextHints?: ActivityTemplate.ContextRequirement[]  // Parameter
```

### Use 1: System Prompt Enhancement
```typescript
// File: src/session/memory-agent.ts
// Line: 185-200
${input.activityContextHints && input.activityContextHints.length > 0 ? `...` : ""}
```

### Pass 2: To prepare
```typescript
// File: src/session/prompt.ts
// Line: 2505
activityContextHints,  // Passed as parameter
```

### Receive 2: In prepare
```typescript
// File: src/session/memory-agent.ts
// Line: 795
activityContextHints?: ActivityTemplate.ContextRequirement[]  // Parameter
```

### Use 2: Loading Prioritization
```typescript
// File: src/session/memory-agent.ts
// Line: 902-909
if (!shouldLoad && input.activityContextHints) {
  const matchesRequirement = input.activityContextHints.some(req => 
    req.required && impulse.metadata?.requirement === req.key
  )
  if (matchesRequirement) {
    shouldLoad = true
    loadReason = "required-context"
  }
}
```

### Use 3: Final Logging
```typescript
// File: src/session/memory-agent.ts
// Line: 949-950
hintsProvided: input.activityContextHints?.length ?? 0,
hintsAddressed: created > 0 ? "yes" : "no",
```

---

## Symbol Lifecycle: impulse

### Stage 1: LLM Suggestion
```typescript
// Created by LLM in analyzeIntent()
// Type: Part of Intent.suggestedImpulses[]
{
  id: "errorFile",
  type: "file",
  description: "File containing the error",
  priority: "high",
  budget: 2000,
  pointer: {type: "file", path: "src/tool/bash.ts", offset: 30, limit: 30}
}
```

### Stage 2: Schema Creation
```typescript
// File: src/session/memory-agent.ts
// Line: 874-892
const impulse: ActivityTemplate.Impulse.Schema = {
  id: suggestion.id,                    // "errorFile"
  sessionID: input.sessionID,           // "01HXV..."
  scope: "session",                     // Scope type
  pointer: suggestion.pointer,          // Full pointer object
  budget: suggestion.budget,            // 2000
  priority: suggestion.priority,        // "high"
  type: suggestion.type,                // "file"
  description: suggestion.description,  // "File containing..."
  metadata: {
    createdTurn: input.turnNumber,     // 5
    createdBy: "session-memory-agent", // Creator
  },
  // Not yet: content, tokenCount, loadedAt
}
```

### Stage 3: Storage (Unloaded)
```typescript
// File: src/session/memory-agent.ts
// Line: 894
await SessionMemory.addImpulse(input.sessionID, impulse)

// Stored at: ["session-memory", sessionID]
// State: Unloaded (no content, tokenCount = undefined)
```

### Stage 4: Loading Decision
```typescript
// File: src/session/memory-agent.ts
// Line: 897-910
shouldLoad = true  // Because priority === "high"
loadReason = "high-priority"
```

### Stage 5: Content Resolution
```typescript
// File: src/session/memory-agent.ts
// Line: 925
const loadedImpulse = await ImpulseResolver.load(impulse)

// loadedImpulse now has:
{
  ...impulse,
  content: "export async function execute(...\n  const result = await...",
  tokenCount: 1847,
  loadedAt: 1738886400000
}
```

### Stage 6: Storage Update (Loaded)
```typescript
// File: src/session/memory-agent.ts
// Line: 926
await SessionMemory.updateImpulse(input.sessionID, suggestion.id, loadedImpulse)

// Stored at: ["session-memory", sessionID]
// State: Loaded (content present, tokenCount = 1847)
```

### Stage 7: Statistics
```typescript
// File: src/session/memory-agent.ts
// Line: 927-928
loaded++              // Increment loaded counter
totalTokens += 1847   // Accumulate token count
```

---

## Critical Checks at Each Stage

### Check 1: Hook Registration
```bash
grep "name: \"session-memory-preparation\"" src/session/turn-lifecycle-hooks.ts
# Should find: Line 23
```

### Check 2: Function Export
```bash
grep "export async function prepareSessionMemory" src/session/prompt.ts
# Should find: Line 2423
```

### Check 3: Hint Extraction
```bash
grep "activityContextHints = template.contextRequirements" src/session/prompt.ts
# Should find: Line 2469
```

### Check 4: Hint Parameter (analyzeIntent)
```bash
grep "activityContextHints?: ActivityTemplate.ContextRequirement" src/session/memory-agent.ts
# Should find: Line 101
```

### Check 5: Hint Usage in Prompt
```bash
grep "Activity Context Hints" src/session/memory-agent.ts
# Should find: Lines 193 (in system prompt)
```

### Check 6: Hint Parameter (prepare)
```bash
grep "activityContextHints?: ActivityTemplate.ContextRequirement" src/session/memory-agent.ts
# Should find: Line 795 (in prepare signature)
```

### Check 7: Loading Logic
```bash
grep "loadReason = \"required-context\"" src/session/memory-agent.ts
# Should find: Line 908
```

### Check 8: Logging
```bash
grep "hintsProvided" src/session/memory-agent.ts
# Should find: Line 949
```

---

## Quick Reference: Key Line Numbers

| Symbol/Function | File | Line | Purpose |
|----------------|------|------|---------|
| `SessionPrompt.prompt()` | prompt.ts | 371 | Entry point |
| `executePreTurnHooks()` | prompt.ts | 408 | Hook invocation |
| `session-memory-preparation` hook | turn-lifecycle-hooks.ts | 22 | Hook registration |
| `SessionPrompt.prepareSessionMemory()` | prompt.ts | 2423 | Main logic |
| `Activity.getActivityForSession()` | activity.ts | 34 | Get activity ID |
| `TemplateProvider.getMetadata()` | template-provider.ts | ? | Get template |
| `activityContextHints = ...` | prompt.ts | 2469 | Extract hints |
| `SessionMemoryAgent.analyzeIntent()` | memory-agent.ts | 97 | Intent analysis |
| Hints in system prompt | memory-agent.ts | 185-200 | Prompt enhancement |
| `SessionMemoryAgent.prepare()` | memory-agent.ts | 792 | Create & load |
| `shouldLoad = ...` | memory-agent.ts | 897-910 | Loading decision |
| `ImpulseResolver.load()` | impulse-resolver.ts | 619 | Content resolution |
| `SessionMemory.updateImpulse()` | session-memory.ts | 252 | Store loaded |
| `hintsProvided` log | memory-agent.ts | 949 | Validation |

---

## State Transitions

### activityContextHints State

```
[] (empty) 
  → populated from template.contextRequirements
  → passed to analyzeIntent()
  → used in system prompt
  → passed to prepare()
  → used in loading decision
  → tracked in logs
```

### impulse State

```
undefined (doesn't exist)
  → created (unloaded: tokenCount = undefined)
  → stored (unloaded)
  → [decision: should load?]
  → loaded (tokenCount > 0, content present)
  → stored (loaded)
```

---

## Verification: The Complete Chain

To verify the entire chain works:

1. **Start**: Activity with contextRequirements
2. **Extract**: `activityContextHints` populated (log: "extracted activity context hints")
3. **Enhance**: System prompt includes hints (check via debug)
4. **Generate**: LLM creates targeted impulses (log: "intent analyzed")
5. **Create**: Impulses stored (log: "impulse created")
6. **Prioritize**: Loading decision uses hints (log: loadReason)
7. **Load**: Content resolved (log: "impulse loaded", tokenCount > 0)
8. **Track**: Final stats (log: hintsProvided, hintsAddressed)

**Expected Result**: Loaded impulses with `tokenCount > 0`, matching activity requirements.

---

## Files & Line Counts

| File | Lines Changed | Key Changes |
|------|--------------|-------------|
| turn-lifecycle-hooks.ts | -165, +74 | Removed broken hook, added working hook |
| prompt.ts | +31 | Export function, extract/pass hints |
| memory-agent.ts | +45 | Add hints params, enhance prompt, prioritize loading |

**Total**: ~250 lines changed across 3 files

**Impact**: Complete activation of dormant hint pipeline
