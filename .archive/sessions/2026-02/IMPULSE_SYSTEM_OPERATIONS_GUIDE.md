# Impulse System: Operations & Learning Architecture

**Comprehensive guide to impulse lifecycle, resolution, preloading, learning, and optimization**

---

## Table of Contents

1. [Backend Interaction with Impulses](#1-backend-interaction-with-impulses)
2. [Activity Template Integration](#2-activity-template-integration)
3. [Preloading with Hooks](#3-preloading-with-hooks)
4. [Experimentation & Learning](#4-experimentation--learning)
5. [Merge, Prune, Split Operations](#5-merge-prune-split-operations)
6. [Impulse Resolution Architecture](#6-impulse-resolution-architecture)
7. [Advanced Patterns](#7-advanced-patterns)

---

## 1. Backend Interaction with Impulses

### How Backend Reads Impulse Values

**Data Flow:**
```
Storage → SessionMemory.load() → Impulse Records → ImpulseResolver.resolve() → Content
```

**Step-by-step:**

1. **Retrieve impulse metadata** from storage:
   ```typescript
   const store = await SessionMemory.load(sessionID)
   // Returns: { sessionID, impulses: Record<id, ImpulseSchema>, totalBudget, usedTokens }
   ```

2. **Filter loaded impulses**:
   ```typescript
   const loadedImpulses = Object.values(store.impulses)
     .filter(imp => imp.tokenCount !== undefined && imp.tokenCount > 0)
   ```

3. **Resolve content via pointers**:
   ```typescript
   for (const impulse of loadedImpulses) {
     const content = await ImpulseResolver.resolve(impulse.pointer, sessionID)
     // content is ephemeral - used for prompt building, then discarded
   }
   ```

### Storage Design: Pointers vs. Content

**Key Principle:** Impulses store **pointers**, not content (except memos)

```typescript
// STORED (persistent):
{
  id: "session-state-impl",
  type: "file",
  pointer: {
    type: "file",
    path: "/repos/.../session-state.ts",
    offset: 0,
    limit: 150
  },
  budget: 4000,
  tokenCount: 1731,  // Cached after resolution
  // content field is REMOVED after prompt building (memory leak prevention)
}

// EPHEMERAL (during prompt building):
{
  ...above,
  content: "... actual TypeScript code ..."
}
```

**Why this matters:**
- **Storage efficiency**: 5KB per session vs. 750KB if content persisted
- **Consistency**: Content always fresh from source
- **Deduplication**: Multiple impulses can point to same file at different offsets

### Impulse Resolution Flow

```
prompt.ts:578
  ↓
ImpulseFormatter.formatImpulseContext(sessionID, maxTokens)
  ↓
SessionMemory.listImpulses(sessionID) → Filter loaded impulses
  ↓
For each impulse:
  ImpulseResolver.resolve(pointer, sessionID)
    ↓
    Switch on pointer.type:
      - file → ReadTool.execute(path, offset, limit)
      - bashOutput → BashTool.execute(command)
      - memo → return pointer.content
      - custom → resolveCustomPointer(resolver, data)
        ↓
        Custom resolvers:
          - metabob-priorities → MetabobCLI.getPriorityIssues()
          - metabob-annotations → MetabobCLI.getAnnotations()
          - activity-recommendation → MetabobCLI.searchActivities()
          - cochange-prediction → MetabobCLI.predictCoChanges()
  ↓
Format as agent context:
  <session_memory>
    <impulse id="...">
      <description>...</description>
      <content>...</content>
    </impulse>
  </session_memory>
  ↓
Inject into ModelMessage as system message (prompt.ts:258)
  ↓
Send to LLM
  ↓
Clear content from impulses (cleanImpulsesForStorage)
  ↓
Save to storage WITHOUT content (prevents memory leak)
```

---

## 2. Activity Template Integration

### How Impulses Flow into Activities

**Three integration points:**

#### A. Pre-Activity Hooks (Template-Defined)

```yaml
# activity-template.yaml
hooks:
  preActivity:
    loadImpulses:
      - "session-state-api"        # Preload specific impulses
      - "metabob-priorities-*"     # Glob pattern for all metabob impulses
      - "activity-*"               # All activity-related context
```

**Execution:** `activity-hooks.ts:116`
```typescript
if (hooks.loadImpulses && hooks.loadImpulses.length > 0) {
  execContext.impulses = hooks.loadImpulses
  log.info("loaded impulses", { impulses: hooks.loadImpulses })
  // TODO: Integrate with ImpulseResolver.load() when memory agent is ready
}
```

**Current Status:** Placeholder (line 119 comment shows integration point)

**Future Implementation:**
```typescript
// Load impulses BEFORE activity agent spawns
for (const impulsePattern of hooks.loadImpulses) {
  const matchingImpulses = await SessionMemory.findImpulses(sessionID, impulsePattern)
  for (const impulse of matchingImpulses) {
    await SessionMemory.loadImpulse(sessionID, impulse.id)
  }
}
// Now impulses are loaded and will be injected into activity agent context
```

#### B. Context Requirements (Template-Guided Discovery)

```yaml
# activity-template.yaml
context_requirements:
  - key: "target_files"
    hint: "Source files to be modified"
    required: true
    impulseTypes: ["file", "bashOutput"]
    budgetRange: [2000, 5000]
```

**Flow:**
1. **Memory agent receives context hints** (`memory-agent.ts:101`):
   ```typescript
   analyzeIntent({
     sessionID,
     promptText,
     activityContextHints: template.context_requirements  // ← Passed here
   })
   ```

2. **Memory agent uses hints to create impulses** (`memory-agent.ts:197-211`):
   ```typescript
   // System prompt includes:
   ${input.activityContextHints.map(req => `
   ### ${req.key} (${req.required ? 'REQUIRED' : 'optional'})
   - **Hint**: ${req.hint}
   - **Types**: ${req.impulseTypes.join(', ')}
   - **Budget**: ${req.budgetRange[0]}-${req.budgetRange[1]} tokens
   `).join('\n')}
   ```

3. **Memory agent returns intent with suggested impulses**:
   ```typescript
   return {
     type: "feature_request",
     confidence: 0.9,
     suggestedImpulses: [
       {
         id: "target-file-auth",
         type: "file",
         pointer: { type: "file", path: "src/auth.ts" },
         priority: "high",
         budget: 3000
       }
     ]
   }
   ```

4. **Impulses created and loaded** (`prompt.ts:2560-2590`):
   ```typescript
   for (const imp of intent.suggestedImpulses) {
     await SessionMemory.addImpulse(sessionID, {
       id: imp.id,
       pointer: imp.pointer,
       budget: imp.budget,
       priority: imp.priority,
       scope: "session"
     })
     await SessionMemory.loadImpulse(sessionID, imp.id)
   }
   ```

#### C. Dynamic Impulse Creation (Agent-Driven)

**Not yet implemented**, but design:

```typescript
// Activity agent calls impulse tool DURING execution:
activity_tool.impulse_create({
  id: "bug-context",
  type: "bashOutput",
  pointer: { type: "bashOutput", command: "git log --oneline -20" },
  budget: 1000,
  priority: "high"
})

// System immediately resolves and injects into next turn context
```

### Current Implementation Status

| Integration Point | Status | Location |
|-------------------|--------|----------|
| Pre-Activity Hooks | ⏳ Placeholder | `activity-hooks.ts:116` |
| Context Requirements | ✅ Working | `memory-agent.ts:197-211` |
| Dynamic Creation | ❌ Not implemented | Future work |

---

## 3. Preloading with Hooks

### Turn Lifecycle Hooks Architecture

**File:** `turn-lifecycle.ts`

```typescript
export interface Hook {
  name: string
  priority: number  // Lower runs first (10, 20, 30...)
  enabled: (ctx: TurnContext) => Promise<boolean>
  execute: (ctx: TurnContext) => Promise<HookResult>
}
```

### Pre-Turn Hook for Memory Agent

**File:** `turn-lifecycle-hooks.ts` (imported by `prompt.ts:62`)

```typescript
TurnLifecycle.registerHook({
  name: "session-memory-preparation",
  priority: 10,  // Run FIRST, before all other hooks
  
  enabled: async (ctx) => {
    // Only run for non-activity agents
    return ctx.agent.name !== "activity" && ctx.agent.name !== "memory"
  },
  
  execute: async (ctx) => {
    const start = Date.now()
    
    // 1. Check if memory agent should run
    const shouldRun = await SessionMemoryAgent.shouldRun({
      sessionID: ctx.sessionID,
      promptText: ctx.promptText,
      agent: ctx.agent
    })
    
    if (!shouldRun) {
      return { success: true, modified: false, duration: Date.now() - start }
    }
    
    // 2. Analyze intent (uses Claude Haiku, ~2s)
    const intent = await SessionMemoryAgent.analyzeIntent({
      sessionID: ctx.sessionID,
      promptText: ctx.promptText,
      recentMessages: await Session.getRecentMessages(ctx.sessionID, 5)
    })
    
    // 3. Create recommended impulses
    for (const imp of intent.suggestedImpulses) {
      await SessionMemory.addImpulse(ctx.sessionID, {
        id: imp.id,
        pointer: imp.pointer,
        budget: imp.budget,
        priority: imp.priority,
        scope: "session",
        sessionID: ctx.sessionID
      })
    }
    
    // 4. Load high-priority impulses
    const highPriority = intent.suggestedImpulses.filter(imp => imp.priority === "high")
    for (const imp of highPriority) {
      await SessionMemory.loadImpulse(ctx.sessionID, imp.id)
    }
    
    return {
      success: true,
      modified: true,  // Context was modified
      duration: Date.now() - start
    }
  }
})
```

### Custom Hook for Preloading Specific Impulses

**Example: Preload git context for every turn**

```typescript
// In turn-lifecycle-hooks.ts

TurnLifecycle.registerHook({
  name: "git-context-preload",
  priority: 15,  // After memory agent, before main agent
  
  enabled: async (ctx) => {
    // Only for sessions in git repositories
    const isGitRepo = await $`git rev-parse --git-dir`.nothrow()
    return isGitRepo.exitCode === 0
  },
  
  execute: async (ctx) => {
    const start = Date.now()
    
    // Create git context impulses if not exist
    const impulses = [
      {
        id: "recent-commits",
        pointer: {
          type: "bashOutput",
          command: "git log --oneline -30"
        },
        budget: 2000,
        priority: "medium"
      },
      {
        id: "git-status",
        pointer: {
          type: "bashOutput",
          command: "git status --short"
        },
        budget: 500,
        priority: "high"
      }
    ]
    
    for (const imp of impulses) {
      // Check if impulse already exists
      const existing = await SessionMemory.getImpulse(ctx.sessionID, imp.id)
      if (!existing) {
        await SessionMemory.addImpulse(ctx.sessionID, {
          ...imp,
          scope: "session",
          sessionID: ctx.sessionID
        })
      }
      
      // Always reload to get fresh data
      await SessionMemory.loadImpulse(ctx.sessionID, imp.id)
    }
    
    return {
      success: true,
      modified: true,
      duration: Date.now() - start
    }
  }
})
```

### Hook Execution Order

```
User submits prompt
  ↓
TurnLifecycle.executePreTurnHooks(context)
  ↓
  Hook Priority 10: session-memory-preparation
    → Memory agent analyzes intent
    → Creates & loads impulses
  ↓
  Hook Priority 15: git-context-preload
    → Ensures git context is fresh
  ↓
  Hook Priority 20: metabob-annotation-loader (example)
    → Loads component annotations
  ↓
  ... more hooks ...
  ↓
Main agent executes (prompt.ts:500)
  ↓
ImpulseFormatter.formatImpulseContext(sessionID)
  → All preloaded impulses are injected
  ↓
LLM receives full context
```

### Bypassing Memory Agent (Manual Preload)

```typescript
// For performance-critical paths, skip memory agent and load directly:

TurnLifecycle.registerHook({
  name: "fast-preload-for-fix-bug-activity",
  priority: 5,  // BEFORE memory agent
  
  enabled: async (ctx) => {
    // Only for "fix bug" prompts
    return ctx.promptText.toLowerCase().includes("fix") ||
           ctx.promptText.toLowerCase().includes("bug")
  },
  
  execute: async (ctx) => {
    // Direct preload, skip analysis
    const impulses = [
      {
        id: "metabob-priorities",
        pointer: {
          type: "custom",
          resolver: "metabob-priorities",
          data: {
            sessionID: ctx.sessionID,
            maxIssues: 10,
            minSeverity: "HIGH"
          }
        },
        budget: 5000,
        priority: "high"
      }
    ]
    
    for (const imp of impulses) {
      await SessionMemory.addImpulse(ctx.sessionID, { ...imp, scope: "session", sessionID: ctx.sessionID })
      await SessionMemory.loadImpulse(ctx.sessionID, imp.id)
    }
    
    // Disable memory agent for this turn (already loaded context)
    ctx.metadata = { skipMemoryAgent: true }
    
    return { success: true, modified: true, duration: 100 }
  }
})
```

---

## 4. Experimentation & Learning

### Thompson Sampling for Impulse Ranking

**Current Implementation:** Activity template search uses Thompson Sampling (`impulse-resolver.ts:150`)

```typescript
// MetabobCLI.searchActivities uses Thompson Sampling internally
const activities = await MetabobCLI.searchActivities(context, { limit })
```

**Design for Impulse Learning:**

```typescript
// impulse-learning-engine.ts (future)

export namespace ImpulseLearning {
  /**
   * Track impulse usage and outcomes
   */
  interface ImpulseOutcome {
    impulseId: string
    sessionID: string
    wasUsed: boolean  // Did agent reference it?
    wasUseful: boolean  // Did it help accomplish task?
    feedbackScore: number  // 0-1, from user or success signals
    taskType: string  // "code_fix", "feature_request", etc.
    contextSimilarity: number  // Cosine similarity to prompt
    timestamp: number
  }

  /**
   * Thompson Sampling state per impulse type
   */
  interface ThompsonState {
    impulsePattern: string  // e.g., "file:src/auth.ts", "bashOutput:git-log"
    alpha: number  // Success count (starts at 1)
    beta: number   // Failure count (starts at 1)
    totalTrials: number
    lastUpdated: number
  }

  /**
   * Recommend impulses based on learned patterns
   */
  export async function recommendImpulses(input: {
    sessionID: string
    intentType: string
    promptText: string
    limit: number
  }): Promise<ActivityTemplate.Impulse.Schema[]> {
    // 1. Get Thompson states for this intent type
    const states = await getThompsonStates(input.intentType)
    
    // 2. Sample from Beta distribution for each impulse pattern
    const samples = states.map(state => ({
      pattern: state.impulsePattern,
      score: sampleBeta(state.alpha, state.beta),
      state
    }))
    
    // 3. Sort by sample (exploration-exploitation balance)
    samples.sort((a, b) => b.score - a.score)
    
    // 4. Take top N, convert patterns to concrete impulses
    const recommended = samples.slice(0, input.limit)
    
    return recommended.map(sample => 
      patternToImpulse(sample.pattern, input.promptText, input.sessionID)
    )
  }

  /**
   * Record outcome after task completion
   */
  export async function recordOutcome(outcome: ImpulseOutcome): Promise<void> {
    const pattern = await impulseToPattern(outcome.impulseId, outcome.sessionID)
    const state = await getThompsonState(outcome.taskType, pattern)
    
    if (outcome.wasUseful) {
      state.alpha += 1  // Success: increase alpha
    } else {
      state.beta += 1   // Failure: increase beta
    }
    
    state.totalTrials += 1
    state.lastUpdated = Date.now()
    
    await saveThompsonState(outcome.taskType, pattern, state)
    
    log.info("impulse outcome recorded", {
      pattern,
      taskType: outcome.taskType,
      useful: outcome.wasUseful,
      newAlpha: state.alpha,
      newBeta: state.beta,
      successRate: (state.alpha / (state.alpha + state.beta)).toFixed(2)
    })
  }
}
```

### Usage Tracking & Feedback Loop

**Automatic Tracking (No User Intervention):**

```typescript
// After LLM response, analyze which impulses were referenced

export async function trackImpulseUsage(input: {
  sessionID: string
  assistantMessageID: string
  loadedImpulses: string[]
}): Promise<void> {
  const message = await Session.getMessage(input.assistantMessageID)
  
  // Extract text content from response
  const responseText = message.parts
    .filter(p => p.type === "text")
    .map(p => p.text)
    .join("\n")
  
  // For each loaded impulse, check if it was referenced
  for (const impulseId of input.loadedImpulses) {
    const impulse = await SessionMemory.getImpulse(input.sessionID, impulseId)
    
    // Heuristic: Did agent mention file/content from impulse?
    const wasUsed = checkIfReferenced(impulse, responseText)
    
    // Update usage metadata
    await SessionMemory.updateImpulse(input.sessionID, impulseId, {
      metadata: {
        ...impulse.metadata,
        lastUsedTurn: message.info.turn,
        usageCount: (impulse.metadata?.usageCount || 0) + (wasUsed ? 1 : 0),
        loadCount: (impulse.metadata?.loadCount || 0) + 1
      }
    })
  }
}

function checkIfReferenced(impulse: ActivityTemplate.Impulse.Schema, responseText: string): boolean {
  if (impulse.pointer.type === "file") {
    // Check if filename or path mentioned
    const filename = path.basename(impulse.pointer.path)
    return responseText.includes(filename) || responseText.includes(impulse.pointer.path)
  }
  
  if (impulse.pointer.type === "memo") {
    // Check if key concepts from memo are mentioned
    const keywords = extractKeywords(impulse.pointer.content)
    return keywords.some(kw => responseText.toLowerCase().includes(kw.toLowerCase()))
  }
  
  // For bashOutput, check if command output content is referenced
  // (Requires storing command output hash for comparison)
  return false
}
```

**Success Signal Detection:**

```typescript
// Infer success from task completion signals

export async function detectSuccessSignals(input: {
  sessionID: string
  messageID: string
}): Promise<number> {
  const message = await Session.getMessage(input.messageID)
  
  let score = 0.5  // Neutral baseline
  
  // Signal 1: User confirmed success ("thanks", "works", "perfect")
  const positiveKeywords = ["thanks", "great", "perfect", "works", "fixed"]
  const responseText = message.parts.map(p => p.text).join(" ").toLowerCase()
  if (positiveKeywords.some(kw => responseText.includes(kw))) {
    score += 0.3
  }
  
  // Signal 2: Tests passed (check for test tool calls)
  const testParts = message.parts.filter(p => 
    p.type === "tool" && p.tool.name === "bash" && p.tool.args.command.includes("test")
  )
  if (testParts.some(p => p.state.status === "completed" && !p.state.error)) {
    score += 0.2
  }
  
  // Signal 3: No follow-up error messages in next 2 turns
  const followUps = await Session.getMessagesAfter(input.sessionID, input.messageID, 2)
  const hasErrorFollowup = followUps.some(msg => 
    msg.info.role === "user" && (
      msg.parts.some(p => p.text?.toLowerCase().includes("error")) ||
      msg.parts.some(p => p.text?.toLowerCase().includes("doesn't work"))
    )
  )
  if (!hasErrorFollowup) {
    score += 0.1
  }
  
  return Math.min(score, 1.0)
}
```

### Experimentation: A/B Testing Impulse Strategies

```typescript
// Randomly choose between strategies to gather comparison data

export async function experimentalImpulseStrategy(input: {
  sessionID: string
  intentType: string
  promptText: string
}): Promise<ActivityTemplate.Impulse.Schema[]> {
  const experiment = Math.random()
  
  if (experiment < 0.33) {
    // Strategy A: Conservative (fewer, high-confidence impulses)
    log.info("using conservative impulse strategy", { sessionID: input.sessionID })
    return await conservativeStrategy(input)
    
  } else if (experiment < 0.67) {
    // Strategy B: Aggressive (more impulses, exploratory)
    log.info("using aggressive impulse strategy", { sessionID: input.sessionID })
    return await aggressiveStrategy(input)
    
  } else {
    // Strategy C: Thompson Sampling (learned preferences)
    log.info("using thompson sampling strategy", { sessionID: input.sessionID })
    return await ImpulseLearning.recommendImpulses(input)
  }
}

// Record which strategy was used for outcome analysis
await SessionMemory.updateImpulse(sessionID, impulseId, {
  metadata: {
    ...impulse.metadata,
    strategy: "conservative" | "aggressive" | "thompson",
    experimentTimestamp: Date.now()
  }
})
```

---

## 5. Merge, Prune, Split Operations

> **⚠️  IMPORTANT CLARIFICATION (2026-02-14):**  
> **Split operations only apply to file-based impulses with text content.**  
> Most impulse types (bashOutput, activity, acp, tool, custom) represent **atomic operations** that cannot be meaningfully split.  
> See [IMPULSE_SPLIT_DECISION.md](./IMPULSE_SPLIT_DECISION.md) for architectural analysis.  
> **Current Status:** Split operations are **deferred to Phase 4** - not yet implemented.  
> The existing **priority-based selection** already handles budget management correctly.

### Merge: Combining Redundant Impulses

**Use Case:** Multiple impulses point to overlapping content

```typescript
// impulse-optimizer.ts

export async function mergeRedundantImpulses(
  sessionID: string,
  impulseIds: string[]
): Promise<string> {
  const impulses = await Promise.all(
    impulseIds.map(id => SessionMemory.getImpulse(sessionID, id))
  )
  
  // Detect overlapping file impulses
  const fileImpulses = impulses.filter(imp => imp.pointer.type === "file")
  const byPath = groupBy(fileImpulses, imp => imp.pointer.path)
  
  const mergedId = ulid()
  const mergedImpulses: ActivityTemplate.Impulse.Schema[] = []
  
  for (const [path, group] of Object.entries(byPath)) {
    if (group.length === 1) {
      mergedImpulses.push(group[0])
      continue
    }
    
    // Merge overlapping ranges
    const ranges = group.map(imp => ({
      offset: imp.pointer.offset || 0,
      limit: imp.pointer.limit || Infinity
    }))
    
    const mergedRange = {
      offset: Math.min(...ranges.map(r => r.offset)),
      limit: Math.max(...ranges.map(r => r.limit))
    }
    
    // Create merged impulse
    const merged: ActivityTemplate.Impulse.Schema = {
      id: `${mergedId}-${path.replace(/[^a-z0-9]/gi, '-')}`,
      sessionID,
      scope: "session",
      type: "file",
      pointer: {
        type: "file",
        path,
        offset: mergedRange.offset,
        limit: mergedRange.limit
      },
      budget: Math.max(...group.map(g => g.budget)),
      priority: group.some(g => g.priority === "high") ? "high" : "medium",
      description: `Merged: ${group.map(g => g.description).join(", ")}`,
      metadata: {
        mergedFrom: group.map(g => g.id),
        mergedAt: Date.now()
      }
    }
    
    mergedImpulses.push(merged)
    
    // Remove old impulses
    for (const old of group) {
      await SessionMemory.removeImpulse(sessionID, old.id)
    }
  }
  
  // Add merged impulses
  for (const merged of mergedImpulses) {
    await SessionMemory.addImpulse(sessionID, merged)
  }
  
  log.info("merged redundant impulses", {
    sessionID,
    originalCount: impulses.length,
    mergedCount: mergedImpulses.length,
    savedBudget: impulses.reduce((sum, i) => sum + i.budget, 0) - 
                 mergedImpulses.reduce((sum, i) => sum + i.budget, 0)
  })
  
  return mergedId
}
```

### Prune: Removing Unused Impulses

**Automatic Pruning via Lifecycle Hook:**

```typescript
// memory-lifecycle.ts:60-84

// Unload stale impulses (not used in N turns)
for (const impulse of impulses) {
  if (!impulse.tokenCount !== undefined) continue
  
  const lastUsedTurn = (impulse.metadata?.lastUsedTurn as number) ?? 0
  const turnsSinceUse = input.currentTurn - lastUsedTurn
  
  // High-priority: 2x threshold, but still expires
  const threshold = impulse.priority === "high" 
    ? config.staleThreshold * 2  // 10 turns
    : config.staleThreshold        // 5 turns
  
  if (turnsSinceUse >= threshold) {
    await SessionMemory.updateImpulse(input.sessionID, impulse.id, {
      // Unload (clears content, keeps metadata)
    })
    unloaded.push(impulse.id)
  }
}

// Delete very old low-priority impulses
const deleteThreshold = config.staleThreshold * 2  // 10 turns
for (const impulse of impulses) {
  if (impulse.priority === "high") continue
  
  const age = input.currentTurn - (impulse.metadata?.createdTurn || 0)
  if (age >= deleteThreshold) {
    await SessionMemory.removeImpulse(input.sessionID, impulse.id)
    deleted.push(impulse.id)
  }
}
```

**Manual Pruning via User Command:**

```typescript
// CLI command: opencode session prune <sessionID>

export async function pruneUnusedImpulses(sessionID: string): Promise<{
  pruned: string[]
  kept: string[]
}> {
  const impulses = await SessionMemory.listImpulses(sessionID)
  const pruned: string[] = []
  const kept: string[] = []
  
  for (const impulse of impulses) {
    const usageCount = impulse.metadata?.usageCount || 0
    const loadCount = impulse.metadata?.loadCount || 0
    
    // Calculate usage ratio
    const usageRatio = loadCount > 0 ? usageCount / loadCount : 0
    
    // Prune if loaded multiple times but never used
    if (loadCount >= 3 && usageRatio < 0.1) {
      await SessionMemory.removeImpulse(sessionID, impulse.id)
      pruned.push(impulse.id)
      
      log.info("pruned unused impulse", {
        impulseId: impulse.id,
        loadCount,
        usageCount,
        usageRatio: usageRatio.toFixed(2)
      })
    } else {
      kept.push(impulse.id)
    }
  }
  
  return { pruned, kept }
}
```

### Split: Breaking Large Impulses

**Use Case:** File impulse covers too much, split into focused chunks

```typescript
export async function splitLargeImpulse(
  sessionID: string,
  impulseId: string,
  chunkSize: number = 100  // lines per chunk
): Promise<string[]> {
  const impulse = await SessionMemory.getImpulse(sessionID, impulseId)
  
  if (impulse.pointer.type !== "file") {
    throw new Error("Only file impulses can be split")
  }
  
  const { path, offset = 0, limit = Infinity } = impulse.pointer
  
  // Read file to determine total lines
  const fileContent = await fs.readFile(path, "utf-8")
  const totalLines = fileContent.split("\n").length
  const actualLimit = Math.min(limit, totalLines - offset)
  
  // Calculate chunks
  const numChunks = Math.ceil(actualLimit / chunkSize)
  const newImpulseIds: string[] = []
  
  for (let i = 0; i < numChunks; i++) {
    const chunkOffset = offset + (i * chunkSize)
    const chunkLimit = Math.min(chunkSize, actualLimit - (i * chunkSize))
    
    const chunkId = `${impulseId}-chunk-${i}`
    
    await SessionMemory.addImpulse(sessionID, {
      id: chunkId,
      sessionID,
      scope: "session",
      type: "file",
      pointer: {
        type: "file",
        path,
        offset: chunkOffset,
        limit: chunkLimit
      },
      budget: Math.ceil(impulse.budget / numChunks),
      priority: impulse.priority,
      description: `${impulse.description} (chunk ${i + 1}/${numChunks})`,
      metadata: {
        splitFrom: impulseId,
        chunkIndex: i,
        totalChunks: numChunks
      }
    })
    
    newImpulseIds.push(chunkId)
  }
  
  // Remove original impulse
  await SessionMemory.removeImpulse(sessionID, impulseId)
  
  log.info("split large impulse", {
    sessionID,
    originalId: impulseId,
    chunks: numChunks,
    newIds: newImpulseIds
  })
  
  return newImpulseIds
}
```

---

## 6. Impulse Resolution Architecture

### Resolution Requires Running Code

**Design Principle:** Impulses are lazy - resolution deferred until needed

#### File Pointer Resolution

```typescript
// impulse-resolver.ts (simplified)

case "file": {
  const { path, offset = 0, limit } = pointer
  
  // 1. Find file (case-insensitive matching)
  const actualPath = findFileIgnoreCase(path)
  if (!actualPath) {
    return `// File not found: ${path}`
  }
  
  // 2. Use ReadTool (same as agent's read tool)
  const result = await ReadTool.execute({
    filePath: actualPath,
    offset,
    limit
  })
  
  // 3. Return formatted content
  return result.content
}
```

#### BashOutput Pointer Resolution

```typescript
case "bashOutput": {
  const { command } = pointer
  
  // 1. Execute command in shell
  const result = await BashTool.execute({
    command,
    description: `Resolving impulse: ${command}`,
    timeout: 5000  // 5s timeout for impulse resolution
  })
  
  // 2. Return stdout
  return result.stdout || result.stderr
}
```

#### Custom Resolver (Metabob Integration)

```typescript
case "custom": {
  const { resolver, data } = pointer
  
  switch (resolver) {
    case "metabob-priorities":
      // 1. Call Metabob MCP tool
      const issues = await MetabobCLI.getPriorityIssues({
        sessionID: data.sessionID,
        maxIssues: data.maxIssues || 5,
        minSeverity: data.minSeverity || "MEDIUM"
      })
      
      // 2. Format as markdown
      return formatIssuesAsMarkdown(issues)
      
    case "cochange-prediction":
      // 1. Call cochange analysis
      const predictions = await MetabobCLI.predictCoChanges({
        changedFiles: data.changedFiles,
        topK: data.topK || 5
      })
      
      // 2. Format as markdown
      return formatCoChangePredictions(predictions)
      
    default:
      throw new Error(`Unknown custom resolver: ${resolver}`)
  }
}
```

### Resolution Might Require Subagent

**Future Design:** Complex impulses need agent execution

```typescript
// Example: "Summarize recent changes to auth system"

case "custom": {
  if (resolver === "agent-summarize") {
    // 1. Spawn subagent with specific task
    const summarySession = await Session.create({
      agent: "general",  // Or specialized summary agent
      parent: sessionID
    })
    
    // 2. Run agent with focused prompt
    const result = await SessionPrompt.prompt({
      sessionID: summarySession,
      prompt: data.summaryPrompt,
      model: { providerID: "anthropic", modelID: "claude-haiku" }
    })
    
    // 3. Extract summary from response
    const summary = extractSummary(result)
    
    // 4. Cleanup subagent session
    await Session.remove(summarySession)
    
    return summary
  }
}
```

### Resolution Might Require Activity

**Example:** "Run tests and provide results as impulse"

```typescript
case "custom": {
  if (resolver === "activity-execute") {
    // 1. Prepare activity context
    const activityId = data.activityId
    const variables = data.variables
    
    // 2. Execute activity
    const { ActivityExecutor } = await import("./activity-executor")
    const outcome = await ActivityExecutor.execute({
      templateId: activityId,
      variables,
      sessionID,
      reason: `Resolving impulse: ${impulseId}`
    })
    
    // 3. Extract relevant output
    return outcome.summary || outcome.output
  }
}
```

---

## 7. Advanced Patterns

### Pattern 1: Cascading Impulses

**Impulses that trigger creation of other impulses**

```typescript
// memory-agent creates high-level impulse
await SessionMemory.addImpulse(sessionID, {
  id: "auth-system-overview",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "cascade",
    data: {
      // This impulse, when resolved, creates 3 more impulses
      cascade: [
        {
          id: "auth-implementation",
          type: "file",
          pointer: { type: "file", path: "src/auth.ts" }
        },
        {
          id: "auth-tests",
          type: "file",
          pointer: { type: "file", path: "tests/auth.test.ts" }
        },
        {
          id: "auth-config",
          type: "file",
          pointer: { type: "file", path: "config/auth.yaml" }
        }
      ]
    }
  },
  budget: 10000,
  priority: "high"
})

// When resolved:
case "cascade": {
  for (const cascadeImpulse of data.cascade) {
    await SessionMemory.addImpulse(sessionID, cascadeImpulse)
    await SessionMemory.loadImpulse(sessionID, cascadeImpulse.id)
  }
  
  // Return summary of cascaded impulses
  return `Loaded ${data.cascade.length} cascaded impulses:\n` +
         data.cascade.map(i => `- ${i.id}`).join("\n")
}
```

### Pattern 2: Conditional Impulses

**Impulses that load only if condition met**

```typescript
await SessionMemory.addImpulse(sessionID, {
  id: "test-failures-if-needed",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "conditional",
    data: {
      condition: {
        type: "bashOutput",
        command: "npm test --silent",
        expectExitCode: [1, 2]  // Non-zero = tests failed
      },
      ifTrue: {
        type: "bashOutput",
        command: "npm test -- --verbose"  // Get detailed failures
      },
      ifFalse: {
        type: "memo",
        content: "All tests passing ✅"
      }
    }
  },
  budget: 3000,
  priority: "medium"
})
```

### Pattern 3: Impulse Pipelines

**Chain multiple resolutions**

```typescript
await SessionMemory.addImpulse(sessionID, {
  id: "recent-errors-analyzed",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "pipeline",
    data: {
      steps: [
        {
          // Step 1: Get error logs
          type: "bashOutput",
          command: "tail -100 /var/log/app.log | grep ERROR"
        },
        {
          // Step 2: Extract unique error types
          type: "bashOutput",
          command: "awk '{print $4}' | sort | uniq -c"
        },
        {
          // Step 3: Summarize with agent
          type: "custom",
          resolver: "agent-summarize",
          data: {
            summaryPrompt: "Summarize these error types and suggest fixes"
          }
        }
      ]
    }
  },
  budget: 5000,
  priority: "high"
})
```

### Pattern 4: Semantic Impulse Search

**Find impulses by meaning, not just ID**

```typescript
// Use embeddings to find relevant impulses

export async function semanticImpulseSearch(input: {
  sessionID: string
  query: string
  limit: number
}): Promise<ActivityTemplate.Impulse.Schema[]> {
  // 1. Get query embedding
  const queryEmbedding = await getEmbedding(input.query)
  
  // 2. Get all impulses with cached embeddings
  const impulses = await SessionMemory.listImpulses(input.sessionID)
  
  // 3. Calculate cosine similarity
  const scored = impulses.map(impulse => ({
    impulse,
    score: cosineSimilarity(
      queryEmbedding,
      impulse.metadata?.embedding || []
    )
  }))
  
  // 4. Sort by similarity and return top N
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, input.limit).map(s => s.impulse)
}

// Usage in memory agent:
const relevantImpulses = await semanticImpulseSearch({
  sessionID,
  query: intent.reasoning,  // Use intent reasoning as query
  limit: 5
})

// Promote existing relevant impulses instead of creating duplicates
for (const impulse of relevantImpulses) {
  await SessionMemory.loadImpulse(sessionID, impulse.id)
}
```

---

## Implementation Roadmap

### Phase 1: Core Operations (Current)
- ✅ Impulse storage (pointers, not content)
- ✅ Basic resolution (file, bashOutput, memo)
- ✅ Turn lifecycle hooks
- ✅ Memory agent (intent analysis)
- ✅ Automatic pruning

### Phase 2: Activity Integration (In Progress)
- ⏳ Pre-activity hook impulse loading
- ⏳ Context requirements → impulse suggestions
- ❌ Dynamic impulse creation during activities

### Phase 3: Learning & Optimization
- ❌ Usage tracking (automatic)
- ❌ Thompson Sampling for impulse ranking
- ❌ Success signal detection
- ❌ A/B testing framework

### Phase 4: Advanced Patterns
- ❌ Merge, prune, split operations (manual)
- ❌ Cascading impulses
- ❌ Conditional impulses
- ❌ Impulse pipelines
- ❌ Semantic search

### Phase 5: Complex Resolution
- ❌ Subagent-based resolution
- ❌ Activity-based resolution
- ❌ Multi-step pipelines

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `session-memory.ts` | Impulse CRUD operations |
| `impulse-resolver.ts` | Content resolution logic |
| `memory-agent.ts` | Intent analysis & impulse suggestions |
| `memory-lifecycle.ts` | Automatic pruning/optimization |
| `turn-lifecycle.ts` | Hook registration framework |
| `turn-lifecycle-hooks.ts` | Pre-turn memory preparation |
| `activity-hooks.ts` | Activity-level impulse integration |
| `prompt.ts:578` | Impulse context injection point |

### Key Concepts

1. **Pointers > Content**: Store pointers, resolve on-demand
2. **Lazy Resolution**: Content loaded only when needed for prompt
3. **Ephemeral Injection**: Content added to prompt, not to message history
4. **Lifecycle Management**: Automatic pruning of stale/unused impulses
5. **Hook-Based Preloading**: Pre-turn hooks prepare context before main agent
6. **Learning Loop**: Track usage → adjust recommendations → improve relevance

### Performance Targets

- **Memory agent analysis**: < 2s (Claude Haiku)
- **Impulse resolution**: < 500ms per impulse
- **Turn overhead**: < 3s total for memory preparation
- **Storage efficiency**: 5KB per session (without content bloat)
- **Cache hit rate**: > 80% for recently used impulses

---

**End of Guide**

For questions or clarifications, refer to:
- `ACTIVITY_DATA_CUSTODY_CHAIN.md` - Data flow details
- `DATA_FLOW_VALIDATION_RESULTS.md` - Validation coverage
- `IMPULSE_RECOMMENDATION_VERIFICATION.md` - Live system verification
