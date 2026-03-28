# Memory Agent: Impulse Loading/Unloading Architecture

**Date**: 2026-02-24  
**Focus**: How memory agent's multiple tasks optimize impulse loading to reduce LLM calls and model complexity  
**Goal**: Learn what context is needed, eliminate unnecessary LLM invocations

---

## Executive Summary

The **Session Memory Agent** is a multi-task system designed to:

1. **Analyze user intent** (Task 1) → Determine what context is needed
2. **Create impulses** (Task 2) → Package context as impulses
3. **Load/unload dynamically** → Optimize memory per-turn and per-task
4. **Learn patterns** → Reduce or eliminate LLM calls over time

**Key Insight**: The transfer-based setup (child session isolation) is **intentional and beneficial** - it prevents memory agent's analysis from polluting the main session while allowing intelligent context preparation.

### Current Benefits of Transfer-Based Design

✅ **Isolation**: Memory agent analysis doesn't pollute main session history  
✅ **Transparency**: User never sees memory agent's LLM calls  
✅ **Composability**: Memory agent runs as pre-turn hook (automatic)  
✅ **Optimization**: Dynamic loading/unloading keeps context minimal  

### Optimization Goals

🎯 **Reduce model complexity**: Load only what's needed for this turn/task  
🎯 **Eliminate unnecessary LLM calls**: Learn patterns, skip analysis when not needed  
🎯 **Adaptive context**: Load/unload impulses based on task relevance  
🎯 **Learn from usage**: Track what impulses actually help, optimize suggestions  

---

## Architecture Overview: Multi-Task Memory Agent

### Task Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│ MEMORY AGENT (Child Session - Isolated)                        │
│                                                                 │
│ Task 1: ANALYZE INTENT                                         │
│ ├─ Input: User message, recent conversation                    │
│ ├─ LLM: Claude Haiku (fast, <2s)                               │
│ ├─ Output: Intent classification + suggested impulses          │
│ └─ Goal: Determine WHAT context is needed                      │
│                                                                 │
│ Task 2: CREATE IMPULSES                                        │
│ ├─ Input: Suggested impulses from Task 1                       │
│ ├─ Tools: impulse_create (NO LLM calls)                        │
│ ├─ Output: Impulse objects with pointers                       │
│ └─ Goal: Package context for main agent                        │
│                                                                 │
│ Task 3: LOAD HIGH-PRIORITY (Automatic)                         │
│ ├─ Input: Impulses with priority="high"                        │
│ ├─ Tools: ImpulseResolver.load() (reads files, NO LLM)         │
│ ├─ Output: Loaded content in impulse.content                   │
│ └─ Goal: Preload critical context                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [Transfer to Parent]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ MAIN SESSION (Parent)                                           │
│                                                                 │
│ ├─ Impulses now visible in SessionMemory                       │
│ ├─ Main agent can impulse_load/impulse_unload                  │
│ ├─ High-priority impulses already loaded                       │
│ └─ Medium/low priority loaded on-demand                        │
└─────────────────────────────────────────────────────────────────┘
```

### Why Child Session (Transfer-Based) Is Good

**Problem Solved**: Memory agent makes LLM calls to analyze intent. If these ran in the main session, the conversation history would be polluted with analysis that's not relevant to the user's task.

**Solution**: Memory agent runs in isolated child session:
- ✅ LLM calls for intent analysis don't appear in main session
- ✅ Tool calls for impulse creation don't clutter main history
- ✅ Transfer brings only the *results* (impulses) to parent
- ✅ Main agent sees clean context without analysis noise

**Alternative (Rejected)**: Run in main session
- ❌ Main session history includes memory agent analysis
- ❌ Main agent prompt bloated with irrelevant context
- ❌ Harder to isolate memory optimization logic
- ❌ Can't easily disable/replace memory agent

---

## Task 1: Intent Analysis (LLM-Based)

### Purpose

Determine what context the main agent needs based on user's message.

### Implementation

**File**: `src/session/memory-agent.ts` (lines 140-431)

```typescript
export async function analyzeIntent(input: {
  sessionID: string
  promptText: string
  recentMessages?: MessageV2.WithParts[]
}): Promise<Intent> {
  // Fast LLM: Claude Haiku
  const model = await Provider.getModel("anthropic", "claude-3-5-haiku-20241022")
  
  // System prompt: Intent classifier with codebase structure
  const system = `You are the Session Memory Agent - intent analyzer.
  
  ## Intent Types
  - code_fix: Bug reports, errors
  - feature_request: Add/modify functionality
  - question: Code understanding
  - refactor: Improve structure
  - exploration: Codebase investigation
  - other: Greetings, no context needed
  
  ## Codebase Structure
  ${projectTree}  // Helps suggest accurate file paths
  
  ## Impulse Types
  1. file: Specific source files (verify exists in structure)
  2. metabobIssue: Code quality issues (complementary)
  3. bashOutput: Live shell command output
  4. memo: Inline notes, constraints
  
  Return JSON with:
  - type: Intent classification
  - confidence: 0-1
  - reasoning: Why (1 sentence)
  - suggestedImpulses: 0-5 recommended impulses
  `
  
  const result = await generateObject({
    model: model.language,
    temperature: 0.2,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(3000), // Fast timeout
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Analyze: "${promptText}"` }
    ],
    schema: IntentOutputSchema
  })
  
  return result.object
}
```

### Key Features

1. **Fast Model**: Claude Haiku for <2s analysis
2. **Codebase Awareness**: Includes project tree for accurate file suggestions
3. **Conservative Suggestions**: 0-5 impulses max (quality over quantity)
4. **Fallback on Timeout**: Returns type="other" with no impulses if analysis fails

### Output Example

**Input**: "Fix the TypeError in src/tool/bash.ts line 42"

**Output**:
```json
{
  "type": "code_fix",
  "confidence": 0.95,
  "reasoning": "User reports specific error with file and line number",
  "suggestedImpulses": [
    {
      "id": "errorFile",
      "type": "file",
      "description": "File containing the error",
      "priority": "high",
      "budget": 2000,
      "pointer": { 
        "type": "file", 
        "path": "src/tool/bash.ts", 
        "offset": 30, 
        "limit": 30 
      }
    },
    {
      "id": "tests",
      "type": "file",
      "description": "Related test file",
      "priority": "medium",
      "budget": 1500,
      "pointer": { "type": "file", "path": "test/tool/bash.test.ts" }
    }
  ]
}
```

---

## Task 2: Create Impulses (No LLM)

### Purpose

Convert intent analysis suggestions into actual impulse objects stored in SessionMemory.

### Implementation

**File**: `src/session/memory-agent.ts` (lines 820-1058)

```typescript
export async function prepare(input: { 
  sessionID: string
  intent: Intent
  turnNumber: number 
}): Promise<{
  impulsesCreated: number
  impulsesLoaded: number
  impulsesUnloaded: number
  totalTokens: number
}> {
  // Get current session memory
  const store = await SessionMemory.load(input.sessionID)
  
  // Track suggested impulse IDs
  const suggestedIds = new Set(
    input.intent.suggestedImpulses.map(imp => imp.id)
  )
  
  // STEP 1: UNLOAD impulses NOT re-suggested
  // This keeps context fresh - if not suggested this turn, we don't need it
  for (const existing of existingImpulses) {
    if (existing.loaded && !suggestedIds.has(existing.id)) {
      // Special case: preserve high-priority during timeout fallback
      if (isTimeoutFallback && existing.priority === "high") {
        continue // Don't unload
      }
      
      // Unload this impulse
      await SessionMemory.updateImpulse(input.sessionID, existing.id, {
        loaded: false,
        content: undefined
      })
      unloaded++
    }
  }
  
  // STEP 2: CREATE new impulses from suggestions
  for (const suggestion of input.intent.suggestedImpulses) {
    // Skip if already exists
    const existing = await SessionMemory.getImpulse(input.sessionID, suggestion.id)
    if (existing) continue
    
    // Validate file paths exist
    if (suggestion.pointer.type === "file") {
      const fileExists = await Bun.file(fullPath).exists()
      if (!fileExists) {
        log.warn("skipping non-existent file", { path: filePath })
        continue
      }
    }
    
    // Create impulse object
    const impulse: ActivityTemplate.Impulse.Schema = {
      id: suggestion.id,
      sessionID: input.sessionID,
      scope: "session",
      pointer: suggestion.pointer,
      budget: suggestion.budget,
      priority: suggestion.priority,
      type: suggestion.type,
      loaded: false,  // Not loaded yet
      metadata: {
        description: suggestion.description,
        createdTurn: input.turnNumber,
        createdBy: "session-memory-agent"
      }
    }
    
    // Enrich with CPG impact data (if file)
    if (impulse.pointer.type === "file") {
      const impactData = await MetabobCLI.analyzeChangeImpact(
        impulse.pointer.path
      )
      impulse.metadata.cpgImpact = { /* impact metrics */ }
    }
    
    // PERSIST to SessionMemory
    await SessionMemory.addImpulse(input.sessionID, impulse)
    created++
    
    // STEP 3: LOAD high-priority immediately
    if (suggestion.priority === "high") {
      const loadedImpulse = await ImpulseResolver.load(impulse)
      await SessionMemory.updateImpulse(
        input.sessionID, 
        suggestion.id, 
        loadedImpulse
      )
      loaded++
      totalTokens += loadedImpulse.tokenCount || 0
    }
  }
  
  return { impulsesCreated, impulsesLoaded, impulsesUnloaded, totalTokens }
}
```

### Key Features

1. **Smart Unloading**: Removes impulses not re-suggested (keeps context fresh)
2. **File Validation**: Verifies file paths exist before creating impulses
3. **CPG Enrichment**: Adds impact analysis for file-based impulses
4. **Automatic Loading**: High-priority impulses loaded immediately
5. **No LLM Calls**: Pure data transformation and tool invocations

### Dynamic Loading Strategy

| Priority | When Loaded | Rationale |
|----------|-------------|-----------|
| **high** | Immediately (pre-turn) | Critical for understanding request |
| **medium** | On-demand (main agent) | Helpful but not essential |
| **low** | On-demand (main agent) | Background context |

**Benefits**:
- ✅ Critical context always available when main agent starts
- ✅ Optional context loaded only if agent requests it
- ✅ Reduces initial token load (lower latency, lower cost)

---

## Task 3 (Planned): Per-Task Recalculation

### Purpose

When activities have multiple tasks, recalculate impulse space per-task:
- Unload impulses not relevant to current task
- Load impulses referenced by current task
- Optimize memory utilization across task boundaries

### Implementation

**File**: `src/session/memory-agent.ts` (lines 1110-1225)

```typescript
export async function recalculateForTask(input: {
  sessionID: string
  taskId: string
  taskDescription: string
  impulseReferences?: string[]  // From task.impulseReferences field
}): Promise<{
  impulsesLoaded: number
  impulsesUnloaded: number
  totalTokens: number
}> {
  const existingImpulses = await SessionMemory.listImpulses(input.sessionID)
  
  // Unload impulses NOT referenced by this task
  if (input.impulseReferences) {
    const referencedIds = new Set(input.impulseReferences)
    
    for (const existing of existingImpulses) {
      if (existing.loaded && !referencedIds.has(existing.id)) {
        // Not needed for this task, unload
        await SessionMemory.updateImpulse(input.sessionID, existing.id, {
          loaded: false,
          content: undefined
        })
        unloaded++
      }
    }
    
    // Load impulses referenced by this task
    for (const refId of input.impulseReferences) {
      const impulse = await SessionMemory.getImpulse(input.sessionID, refId)
      if (impulse && !impulse.loaded) {
        const loadedImpulse = await ImpulseResolver.load(impulse)
        await SessionMemory.updateImpulse(input.sessionID, refId, {
          loaded: true,
          content: loadedImpulse.content
        })
        loaded++
        totalTokens += loadedImpulse.tokenCount || 0
      }
    }
  }
  
  return { impulsesLoaded, impulsesUnloaded, totalTokens }
}
```

### Usage in Activity Execution

**Activity Template Example**:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Analyze bug root cause",
      "impulseReferences": ["errorFile", "stackTrace"],
      "prompt": "Analyze the error..."
    },
    {
      "id": "task-2",
      "description": "Write fix",
      "impulseReferences": ["errorFile", "tests"],
      "prompt": "Write a fix..."
    }
  ]
}
```

**Execution Flow**:
```
Task 1 starts:
  recalculateForTask(taskId="task-1", impulseReferences=["errorFile", "stackTrace"])
  → Loads: errorFile, stackTrace
  → Unloads: tests (not needed yet)
  → Agent sees only errorFile + stackTrace

Task 1 completes

Task 2 starts:
  recalculateForTask(taskId="task-2", impulseReferences=["errorFile", "tests"])
  → Unloads: stackTrace (not needed anymore)
  → Loads: tests (needed now)
  → Agent sees errorFile + tests
```

**Benefits**:
- ✅ Each task sees only relevant context
- ✅ Reduces token load per task
- ✅ Lower latency (less to process)
- ✅ Lower cost (fewer tokens per call)

---

## Optimization Strategy: Reducing LLM Calls

### Current State: Always Runs LLM for Intent Analysis

**Per-Turn**:
1. User message arrives
2. Memory agent analyzes intent (LLM call)
3. Creates/loads impulses
4. Main agent executes

**Cost**: ~1-2s latency + ~$0.001 per turn

### Optimization Path: Learn When to Skip Analysis

#### Phase 1: Pattern Recognition (⚡ NEXT)

**Idea**: Skip LLM call for trivial messages

```typescript
export async function shouldAnalyzeIntent(input: {
  promptText: string
  recentMessages: MessageV2.WithParts[]
}): Promise<boolean> {
  // Pattern 1: Greetings (no context needed)
  const greetings = /^(hi|hello|hey|thanks|ok|got it)$/i
  if (greetings.test(input.promptText.trim())) {
    return false // Skip analysis, no impulses needed
  }
  
  // Pattern 2: Continuation (reuse previous context)
  // "continue", "go on", "next", etc.
  const continuations = /^(continue|go on|next|proceed|keep going)$/i
  if (continuations.test(input.promptText.trim())) {
    return false // Skip analysis, keep existing impulses loaded
  }
  
  // Pattern 3: Short acknowledgments
  if (input.promptText.length < 10) {
    return false // Likely not a task, skip analysis
  }
  
  // Otherwise, run full analysis
  return true
}
```

**Benefit**: ~20-30% of user messages skip LLM call

#### Phase 2: Intent Caching (🎯 FUTURE)

**Idea**: Cache intent analysis results for similar messages

```typescript
const intentCache = new Map<string, { intent: Intent; expiresAt: number }>()

export async function analyzeIntentCached(input: {
  promptText: string
  recentMessages: MessageV2.WithParts[]
}): Promise<Intent> {
  // Generate cache key (semantic similarity)
  const cacheKey = await generateEmbedding(input.promptText)
  
  // Check cache
  const cached = intentCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    log.info("intent cache hit", { cacheKey })
    return cached.intent
  }
  
  // Cache miss, run full analysis
  const intent = await analyzeIntent(input)
  
  // Cache for 1 hour
  intentCache.set(cacheKey, {
    intent,
    expiresAt: Date.now() + 3600000
  })
  
  return intent
}
```

**Benefit**: ~40-50% of similar requests skip LLM call

#### Phase 3: Learning from Activity Templates (🎯 FUTURE)

**Idea**: When executing activity templates, use template's context requirements instead of LLM analysis

```typescript
// Activity declares context requirements explicitly
{
  "context": {
    "requirements": [
      { "key": "bugFile", "impulseTypes": ["file"], "required": true },
      { "key": "tests", "impulseTypes": ["file"], "required": false }
    ]
  }
}

// When executing activity, SKIP memory agent LLM call
// Use template requirements directly
export async function prepareForActivity(
  activity: ActivityTemplate.Schema,
  reason: string
): Promise<Record<string, Impulse.Schema>> {
  // Use gatherContext() which uses LLM for file path resolution
  // BUT: If activity includes file paths in variables, skip LLM entirely
  
  if (activity.variables.files) {
    // Files already specified, no LLM needed
    return createImpulsesFromPaths(activity.variables.files)
  }
  
  // Otherwise, use gatherContext() (Phase 1 implementation)
  return SessionMemoryAgent.gatherContext({
    requirements: activity.context.requirements,
    reason: activity.reason,
    recentMessages: []
  })
}
```

**Benefit**: Activities run with 0 memory agent LLM calls

#### Phase 4: Reinforcement Learning (🎯 FUTURE)

**Idea**: Track which impulses actually help vs. which are ignored

```typescript
interface ImpulseUsageMetrics {
  impulseId: string
  createdTurn: number
  loadedTurn: number | null
  usedInResponse: boolean  // Did agent reference this content?
  helpfulnessScore: number // 0-1 (user feedback, task success)
}

// After each turn, update metrics
export async function recordImpulseUsage(
  sessionID: string,
  impulseId: string,
  wasUsed: boolean,
  helpfulnessScore: number
): Promise<void> {
  await Storage.update(`impulse-metrics:${impulseId}`, {
    usedInResponse: wasUsed,
    helpfulnessScore
  })
}

// Use metrics to improve future suggestions
export async function analyzeIntentWithLearning(input: {
  promptText: string
  recentMessages: MessageV2.WithParts[]
}): Promise<Intent> {
  // Run standard LLM analysis
  const intent = await analyzeIntent(input)
  
  // Filter suggestions based on historical usefulness
  intent.suggestedImpulses = intent.suggestedImpulses.filter(imp => {
    const metrics = await getImpulseMetrics(imp.id)
    return metrics.helpfulnessScore > 0.5 // Keep only helpful impulses
  })
  
  return intent
}
```

**Benefit**: Only suggest impulses that historically help

---

## Transfer Flow: Child → Parent

### Why Transfer Is Necessary

**Goal**: Bring impulses from memory agent's isolated session to main session

**Without Transfer**: Main agent can't see impulses created in child session

**With Transfer**: Impulses visible to main agent with correct scope

### Transfer Implementation

**File**: `src/session/turn-lifecycle-hooks.ts` (lines 92-118)

```typescript
TurnLifecycle.registerHook({
  name: "memory-management",
  priority: 10,
  
  execute: async (ctx) => {
    // Execute memory agent in child session
    const result = await executeActivityInline(
      "manage-session-memory",
      { userMessage: ctx.promptText },
      ctx.sessionID,  // Parent session ID
      reason,
      ctx.userMessageID
    )
    
    // TRANSFER: Move impulses from child to parent
    for (const [id, impulse] of Object.entries(result.impulses)) {
      // Convert scope: "activity" → "session"
      const sessionImpulse = {
        ...impulse,
        scope: "session" as const,
        sessionID: ctx.sessionID  // Set to parent
      }
      
      // Add to parent SessionMemory
      await SessionMemory.addImpulse(ctx.sessionID, sessionImpulse)
    }
    
    return { success: true, modified: true }
  }
})
```

### Transfer Benefits

✅ **Isolation Preserved**: Memory agent analysis stays in child session  
✅ **Results Visible**: Impulses transferred to parent  
✅ **Scope Correct**: Converted to session scope for main agent  
✅ **Clean History**: Main session history uncluttered  

---

## Impulse Loading/Unloading Strategy

### Per-Turn Optimization

**Before Turn**:
```
SessionMemory State:
  impulses: {
    "oldFile": { loaded: true, content: "...", priority: "high" },
    "oldTest": { loaded: true, content: "...", priority: "medium" }
  }
```

**Memory Agent Analyzes**: "Fix new bug in auth.ts"

**Suggestions**: 
- errorFile (priority: high, path: src/auth.ts)
- authTests (priority: medium, path: test/auth.test.ts)

**After prepare()**:
```
SessionMemory State:
  impulses: {
    "oldFile": { loaded: false, content: undefined },  // UNLOADED (not re-suggested)
    "oldTest": { loaded: false, content: undefined },  // UNLOADED (not re-suggested)
    "errorFile": { loaded: true, content: "..." },     // LOADED (new, high priority)
    "authTests": { loaded: false }                      // CREATED (medium, load on-demand)
  }
```

**Main Agent Starts**:
- Sees errorFile content immediately (high priority, pre-loaded)
- Can load authTests if needed (impulse_load tool)
- Old impulses unloaded (not relevant to new task)

### Per-Task Optimization (Planned)

**Activity with 3 Tasks**:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Analyze bug",
      "impulseReferences": ["errorFile", "stackTrace"]
    },
    {
      "id": "task-2",
      "description": "Write fix",
      "impulseReferences": ["errorFile", "tests"]
    },
    {
      "id": "task-3",
      "description": "Update docs",
      "impulseReferences": ["docs", "changelog"]
    }
  ]
}
```

**Execution**:
```
Task 1:
  recalculateForTask(impulseReferences=["errorFile", "stackTrace"])
  → Loaded: errorFile, stackTrace
  → Context size: 4500 tokens

Task 2:
  recalculateForTask(impulseReferences=["errorFile", "tests"])
  → Unloaded: stackTrace
  → Loaded: tests
  → Context size: 4000 tokens

Task 3:
  recalculateForTask(impulseReferences=["docs", "changelog"])
  → Unloaded: errorFile, tests
  → Loaded: docs, changelog
  → Context size: 3500 tokens
```

**Without Optimization**: All 5 impulses loaded throughout (12000 tokens every task)  
**With Optimization**: Only 2-3 impulses per task (3500-4500 tokens per task)  

**Savings**: ~60-70% reduction in context size per task

---

## Learning System: Toward Zero LLM Calls

### Goal

Eliminate memory agent LLM calls by learning:
1. What impulses are actually useful (track usage)
2. What patterns predict needed context (pattern recognition)
3. What activities need what context (template requirements)

### Phase 1: Usage Tracking (✅ Implemented)

**Tracking What's Loaded**:
```typescript
interface ImpulseMetadata {
  createdTurn: number
  createdBy: "session-memory-agent" | "user" | "activity"
  loadedTurn?: number
  usedInResponse?: boolean
  cpgImpact?: { /* impact metrics */ }
}
```

**Current Metrics**:
- ✅ When impulse created (createdTurn)
- ✅ Who created it (createdBy)
- ✅ Priority level
- ✅ Budget vs. actual tokens
- ⚠️  NOT YET: Was it actually used in response?
- ⚠️  NOT YET: Did it help solve the task?

### Phase 2: Effectiveness Tracking (🎯 NEXT)

**What to Track**:
```typescript
interface ImpulseEffectiveness {
  impulseId: string
  totalSuggestions: number      // How many times suggested
  totalLoads: number             // How many times loaded
  totalUsed: number              // How many times referenced in response
  avgHelpfulness: number         // 0-1 (from task success rate)
  contexts: string[]             // What user intents led to this impulse
}
```

**Feedback Loop**:
```
1. Memory agent suggests impulse → totalSuggestions++
2. Main agent loads impulse → totalLoads++
3. Main agent references impulse in response → totalUsed++
4. Task succeeds/fails → update avgHelpfulness
5. Next time similar context: prioritize high-helpfulness impulses
```

### Phase 3: Pattern-Based Suggestions (🎯 FUTURE)

**Learned Patterns**:
```json
{
  "patterns": [
    {
      "userIntentRegex": "fix.*error.*auth",
      "suggestedImpulses": [
        { "id": "authFile", "type": "file", "path": "src/auth.ts", "priority": "high" },
        { "id": "authTests", "type": "file", "path": "test/auth.test.ts", "priority": "medium" }
      ],
      "confidence": 0.92,
      "successRate": 0.89
    }
  ]
}
```

**Usage**:
```typescript
export async function suggestImpulsesFast(
  promptText: string
): Promise<Intent | null> {
  // Check learned patterns
  for (const pattern of learnedPatterns) {
    if (pattern.userIntentRegex.test(promptText)) {
      if (pattern.confidence > 0.85) {
        // High confidence, skip LLM call
        return {
          type: inferTypeFromPattern(pattern),
          confidence: pattern.confidence,
          reasoning: "Matched learned pattern",
          suggestedImpulses: pattern.suggestedImpulses
        }
      }
    }
  }
  
  // No pattern match, run LLM analysis
  return null
}
```

**Result**: 60-80% of requests skip LLM call (use learned patterns)

### Phase 4: Activity Template Integration (🎯 FUTURE)

**Template-Driven Context**:
```json
{
  "name": "fix-bug-complete",
  "context": {
    "requirements": [
      {
        "key": "bugFile",
        "impulseTypes": ["file"],
        "hint": "File where bug occurs",
        "required": true
      }
    ],
    "learned": {
      "alsoUseful": ["tests", "recentChanges"],
      "successRate": 0.94
    }
  }
}
```

**When Executing Activity**:
```typescript
// NO memory agent LLM call
// Use template requirements + learned patterns

const impulses = {
  // Required by template
  bugFile: createFileImpulse(variables.file),
  
  // Learned to be useful (94% success rate with these)
  tests: createFileImpulse(findTestFile(variables.file)),
  recentChanges: createBashImpulse(`git log -5 ${variables.file}`)
}
```

**Result**: Activities run with 0 memory agent overhead

---

## Performance Characteristics

### Current Implementation

**Per-Turn**:
- Memory agent LLM call: ~1-2s (Claude Haiku)
- Impulse creation: ~50-100ms (no LLM)
- High-priority loading: ~100-300ms (file reads, CPG enrichment)
- Total overhead: ~1.5-2.5s

**Per-Activity**:
- Context gathering LLM call: ~1-3s (if using gatherContext)
- Impulse resolution: ~100-500ms
- Total overhead: ~1-4s

### With Optimizations

**Per-Turn** (with pattern recognition):
- Pattern match: ~5-10ms (regex + cache lookup)
- Impulse creation: ~50-100ms
- High-priority loading: ~100-300ms
- Total overhead: ~150-400ms (85-90% reduction)

**Per-Activity** (with template requirements):
- Template requirements: 0ms (no LLM)
- Impulse resolution: ~100-500ms
- Total overhead: ~100-500ms (90-95% reduction)

---

## Comparison: Current vs. Planned

### Current State

| Aspect | Implementation | Overhead |
|--------|---------------|----------|
| **Per-Turn Analysis** | LLM call every turn | ~1.5-2.5s |
| **Activity Context** | LLM call for gathering | ~1-4s |
| **Impulse Loading** | High-priority pre-loaded | ~100-300ms |
| **Per-Task Optimization** | Not implemented | N/A |
| **Learning** | No pattern learning | N/A |

**Total per session (10 turns + 2 activities)**: ~25-40s overhead

### Planned State (Full Optimization)

| Aspect | Implementation | Overhead |
|--------|---------------|----------|
| **Per-Turn Analysis** | Pattern match (80% skip LLM) | ~0.15-0.4s avg |
| **Activity Context** | Template requirements | ~0.1-0.5s |
| **Impulse Loading** | High-priority pre-loaded | ~100-300ms |
| **Per-Task Optimization** | recalculateForTask | ~50-100ms |
| **Learning** | Pattern library | 0ms (offline) |

**Total per session (10 turns + 2 activities)**: ~3-8s overhead (85-90% reduction)

---

## Implementation Roadmap

### Phase 1: Pattern Recognition (⚠️ IMMEDIATE)
**Estimated**: 4-6 hours

**Tasks**:
1. Add `shouldAnalyzeIntent()` function
2. Detect greetings, continuations, short messages
3. Skip LLM call for these patterns
4. Track skip rate metrics

**Expected Impact**: 20-30% of turns skip LLM call

### Phase 2: Per-Task Recalculation (⚡ HIGH PRIORITY)
**Estimated**: 8-10 hours

**Tasks**:
1. Add `impulseReferences` field to task schema
2. Call `recalculateForTask()` before each task
3. Implement unload/load logic
4. Test with multi-task activities

**Expected Impact**: 60-70% reduction in context size per task

### Phase 3: Effectiveness Tracking (🎯 MEDIUM PRIORITY)
**Estimated**: 12-15 hours

**Tasks**:
1. Add effectiveness metrics to impulse metadata
2. Track usage in responses (parse agent output)
3. Correlate with task success/failure
4. Build feedback loop

**Expected Impact**: Data for Phase 4 learning

### Phase 4: Learned Patterns (🎯 FUTURE)
**Estimated**: 20-25 hours

**Tasks**:
1. Build pattern library from effectiveness data
2. Implement pattern matching before LLM call
3. Update patterns based on new data
4. Dashboard for pattern effectiveness

**Expected Impact**: 60-80% of turns skip LLM call

### Phase 5: Template Integration (🎯 FUTURE)
**Estimated**: 15-20 hours

**Tasks**:
1. Add learned context to activity templates
2. Use template requirements instead of gatherContext
3. Track template context effectiveness
4. Auto-update templates with learned patterns

**Expected Impact**: Activities run with 0 memory agent LLM calls

---

## Summary

### Current Architecture (Transfer-Based) Is Good

✅ **Isolation**: Memory agent analysis doesn't pollute main session  
✅ **Transparency**: User never sees memory optimization overhead  
✅ **Composability**: Works as pre-turn hook automatically  
✅ **Dynamic Loading**: High-priority pre-loaded, medium/low on-demand  

### Optimization Goals Achieved

🎯 **Reduce model complexity**: ✅ Dynamic loading/unloading keeps context minimal  
🎯 **Prepare for zero LLM calls**: ⚠️ Pattern recognition + learning (planned)  
🎯 **Per-task optimization**: ⚠️ recalculateForTask (ready to implement)  
🎯 **Learn patterns**: ⚠️ Effectiveness tracking + pattern library (future)  

### Next Steps

1. **Immediate**: Implement pattern recognition (skip LLM for greetings, continuations)
2. **High Priority**: Implement per-task recalculation (60-70% context reduction)
3. **Medium Priority**: Add effectiveness tracking (learn what helps)
4. **Future**: Build pattern library (60-80% skip LLM calls)
5. **Future**: Integrate with activity templates (0 LLM calls for activities)

---

## Related Documentation

- **Memory Agent Implementation**: `repos/metabob-opencode/packages/opencode/docs/MEMORY_AGENT_IMPLEMENTATION.md`
- **Session Memory Architecture**: `SESSION_MEMORY_LIFECYCLE_TRACING.md`
- **Turn Lifecycle Hooks**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
- **Impulse System**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
