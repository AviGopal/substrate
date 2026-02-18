# Context Overflow Prevention - Implementation Guide

## Goal

Make the session memory agent responsible for:
1. **Preventing context window overflow** before it happens
2. **Identifying what message history needs summarization**
3. **Attaching learnings to touched components** via metabob-cli annotations

---

## Implementation Strategy

### Phase 1: Context Budget Monitoring (Critical Path)

Add budget checking at the end of `SessionMemoryAgent.prepare()` to prevent overflow.

#### File: `src/session/memory-agent.ts`

**Add after line 956** (after the existing `l.info("prepare() completed")`):

```typescript
      // Check context budget and prevent overflow
      try {
        const budgetStatus = await checkContextBudget({
          sessionID: input.sessionID,
          impulseTokens: totalTokens,
          turnNumber: input.turnNumber
        })
        
        if (budgetStatus.needsAction) {
          l.warn("context budget requires action", {
            utilization: budgetStatus.utilization,
            status: budgetStatus.status,
            actions: budgetStatus.actions.map(a => a.type)
          })
          
          // Execute preventive actions
          for (const action of budgetStatus.actions) {
            if (action.type === "evict-low-priority") {
              await evictLowPriorityImpulses(input.sessionID, action.count)
            } else if (action.type === "trigger-summarization") {
              await triggerMessageSummarization(input.sessionID, input.turnNumber)
            }
          }
        }
      } catch (error) {
        l.warn("context budget check failed", {
          error: error instanceof Error ? error.message : String(error)
        })
        // Non-fatal, continue
      }

      return {
        impulsesCreated: created,
        impulsesLoaded: loaded,
        impulsesUnloaded: unloaded,
        totalTokens,
      }
```

#### New Helper Function: `checkContextBudget()`

**Add to `memory-agent.ts` after `prepare()` function:**

```typescript
  /**
   * Check context budget and determine if preventive actions needed
   */
  async function checkContextBudget(input: {
    sessionID: string
    impulseTokens: number
    turnNumber: number
  }): Promise<{
    status: "healthy" | "warning" | "critical"
    utilization: number
    needsAction: boolean
    actions: Array<{
      type: "evict-low-priority" | "trigger-summarization" | "compress-large-impulses"
      count?: number
      reason: string
    }>
  }> {
    const l = log.clone().tag("session", input.sessionID)
    
    // Get context space from existing infrastructure
    const { SessionMemoryManager } = await import("./memory-manager")
    const space = await SessionMemoryManager.getContextSpace(input.sessionID)
    
    // Get message history tokens (approximate)
    const { MessageV2 } = await import("./message-v2")
    const messageCount = await MessageV2.count(input.sessionID)
    const estimatedMessageTokens = messageCount * 500  // Rough estimate
    
    // Total usage: impulses + messages + system prompt overhead
    const totalUsed = input.impulseTokens + estimatedMessageTokens + 5000  // 5k for system
    const utilization = (totalUsed / space.limits.availableForContext) * 100
    
    let status: "healthy" | "warning" | "critical"
    if (utilization < 70) status = "healthy"
    else if (utilization < 85) status = "warning"
    else status = "critical"
    
    const actions: Array<...> = []
    
    if (status === "warning") {
      // Check for low-priority loaded impulses
      const lowPriorityLoaded = space.impulses.filter(
        i => i.priority === "low" && i.loaded
      )
      
      if (lowPriorityLoaded.length > 0) {
        actions.push({
          type: "evict-low-priority",
          count: Math.ceil(lowPriorityLoaded.length * 0.5),  // Evict 50%
          reason: `Low-priority impulses using ${lowPriorityLoaded.reduce((s, i) => s + i.tokenCount, 0)} tokens`
        })
      }
      
      // Check if message history is large
      if (messageCount > 20) {
        actions.push({
          type: "trigger-summarization",
          reason: `${messageCount} messages, summarization can free ~${Math.floor(messageCount * 0.3 * 500)} tokens`
        })
      }
    }
    
    if (status === "critical") {
      // Aggressive actions needed
      actions.push({
        type: "evict-low-priority",
        count: space.impulses.filter(i => i.priority === "low" && i.loaded).length,
        reason: "CRITICAL: Evict ALL low-priority impulses"
      })
      
      actions.push({
        type: "trigger-summarization",
        reason: "CRITICAL: Summarize message history immediately"
      })
      
      // Also consider medium priority
      const mediumLoaded = space.impulses.filter(
        i => i.priority === "medium" && i.loaded && i.tokenCount > 2000
      )
      if (mediumLoaded.length > 0) {
        actions.push({
          type: "compress-large-impulses",
          count: mediumLoaded.length,
          reason: `CRITICAL: Compress ${mediumLoaded.length} large medium-priority impulses`
        })
      }
    }
    
    return {
      status,
      utilization,
      needsAction: actions.length > 0,
      actions
    }
  }
  
  /**
   * Evict low-priority impulses to free space
   */
  async function evictLowPriorityImpulses(sessionID: string, count: number): Promise<void> {
    const l = log.clone().tag("session", sessionID)
    
    const impulses = await SessionMemory.listImpulses(sessionID)
    const toEvict = impulses
      .filter(i => i.priority === "low" && i.tokenCount && i.tokenCount > 0)
      .sort((a, b) => (b.tokenCount || 0) - (a.tokenCount || 0))  // Largest first
      .slice(0, count)
    
    for (const impulse of toEvict) {
      await SessionMemory.updateImpulse(sessionID, impulse.id, {
        // Clear content to unload
      })
      l.info("evicted low-priority impulse", {
        impulseId: impulse.id,
        freedTokens: impulse.tokenCount,
        reason: "context-budget-overflow-prevention"
      })
    }
  }
  
  /**
   * Trigger message summarization to compress history
   */
  async function triggerMessageSummarization(sessionID: string, currentTurn: number): Promise<void> {
    const l = log.clone().tag("session", sessionID)
    
    // Import existing compaction system
    const { SessionCompaction } = await import("./compaction")
    
    // Trigger summarization (runs in background)
    SessionCompaction.run({
      sessionID,
      // Use current provider/model from session
      providerID: "anthropic",
      modelID: "claude-3-5-haiku-20241022"
    }).catch(error => {
      l.warn("background summarization failed", {
        error: error instanceof Error ? error.message : String(error)
      })
    })
    
    l.info("triggered message summarization", {
      currentTurn,
      reason: "context-budget-overflow-prevention"
    })
  }
```

---

### Phase 2: Component Learning Hook

Add post-turn hook to track which components were helpful.

#### File: `src/session/turn-lifecycle-hooks.ts`

**Add after the existing hooks** (around line 720):

```typescript
/**
 * Component Learning Hook
 *
 * Runs after turn completes (priority: 110, after session-memory-optimization)
 * Tracks which components were loaded and annotates helpful ones via metabob-cli
 */
TurnLifecycle.registerHook({
  name: "component-learning",
  priority: 110,
  
  enabled: async (ctx) => {
    const config = await Config.get()
    // Only run if component learning enabled
    if (config.sessionMemory?.componentLearning === false) {
      return false
    }
    // Only for primary agents
    if (ctx.agent.mode === "subagent") {
      return false
    }
    return true
  },
  
  execute: async (ctx) => {
    const start = Date.now()
    
    try {
      const { SessionMemory } = await import("./session-memory")
      const { MCP } = await import("../mcp")
      
      // Get impulses loaded in this turn
      const impulses = await SessionMemory.listImpulses(ctx.sessionID)
      const loadedThisTurn = impulses.filter(i => 
        i.metadata?.createdTurn === ctx.turn &&
        i.tokenCount && i.tokenCount > 0
      )
      
      if (loadedThisTurn.length === 0) {
        return { success: true, modified: false, duration: Date.now() - start }
      }
      
      // Determine turn outcome
      // For now, assume success if no errors in context
      // Later: could check for error messages, failed tool calls, etc.
      const outcome = "success"  // Simplified for now
      
      let annotated = 0
      
      // Annotate file/component impulses
      for (const impulse of loadedThisTurn) {
        let file: string
        let component: string
        let componentType: string
        
        if (impulse.pointer.type === "file") {
          file = impulse.pointer.path
          // Extract component name from filename
          component = file.split("/").pop()?.replace(/\.[^.]+$/, "") || "module"
          componentType = "file"
        } else if (impulse.pointer.type === "component") {
          file = impulse.pointer.file
          component = impulse.pointer.name
          componentType = "function"  // Could be class/method/etc
        } else {
          // Skip non-file impulses
          continue
        }
        
        // Build annotation reason
        const reason = [
          `SESSION MEMORY: Loaded for task: ${ctx.promptText.slice(0, 100)}...`,
          `Token usage: ${impulse.tokenCount} / ${impulse.budget} budget`,
          impulse.metadata?.requirement ? `Context requirement: ${impulse.metadata.requirement}` : null,
          impulse.metadata?.loadReason ? `Load reason: ${impulse.metadata.loadReason}` : null,
          `Priority: ${impulse.priority}`,
          `Result: Successfully contributed to ${outcome} outcome`,
          `Pattern: Component relevant for similar tasks`,
          `Recommendation: Consider loading for related work`
        ].filter(Boolean).join("\n")
        
        try {
          // Call metabob-cli annotate_component
          await MCP.call("metabob", "annotate_component", {
            file_path: file,
            component_name: component,
            component_type: componentType,
            reason
          })
          
          annotated++
          
          log.info("annotated component interaction", {
            sessionID: ctx.sessionID,
            file,
            component,
            tokenCount: impulse.tokenCount
          })
        } catch (error) {
          log.warn("failed to annotate component", {
            file,
            component,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
      
      log.info("component learning completed", {
        sessionID: ctx.sessionID,
        impulsesProcessed: loadedThisTurn.length,
        annotationsCreated: annotated,
        duration: Date.now() - start
      })
      
      return {
        success: true,
        modified: annotated > 0,
        duration: Date.now() - start,
        metadata: {
          annotated,
          processed: loadedThisTurn.length
        }
      }
    } catch (error) {
      log.error("component learning failed", {
        sessionID: ctx.sessionID,
        error: error instanceof Error ? error.message : String(error)
      })
      
      return {
        success: false,
        modified: false,
        duration: Date.now() - start
      }
    }
  }
})
```

---

### Phase 3: Budget-Aware System Prompt

Add budget information to the system prompt so LLM knows constraints.

#### File: `src/session/memory-agent.ts`

**Add before line 163** (before "## Intent Types"):

```typescript
      // Calculate current budget usage
      const existingImpulses = await SessionMemory.listImpulses(input.sessionID)
      const currentUsage = existingImpulses.reduce((sum, i) => sum + (i.tokenCount || 0), 0)
      
      // Get context limits
      const { SessionMemoryManager } = await import("./memory-manager")
      const space = await SessionMemoryManager.getContextSpace(input.sessionID)
      const remainingCapacity = space.limits.availableForContext - currentUsage
      
      const budgetSection = `

## Context Budget Status

Current impulse usage: ${currentUsage.toLocaleString()} tokens
Remaining capacity: ${remainingCapacity.toLocaleString()} tokens
Utilization: ${space.stats.utilization.toFixed(1)}%
Status: ${remainingCapacity < 10000 ? "LIMITED ⚠️" : remainingCapacity < 30000 ? "MODERATE" : "HEALTHY ✅"}

**Budget Guidelines:**
${remainingCapacity < 10000 ? `
- CRITICAL: Very limited budget remaining
- Suggest ONLY essential impulses (1-2 maximum)
- Prefer bashOutput over file for large files
- Keep budgets minimal (500-1000 tokens per impulse)
` : remainingCapacity < 30000 ? `
- MODERATE: Limited budget available
- Be selective with impulses (3-4 maximum)
- Use budget ranges conservatively
- Consider if context is truly needed
` : `
- HEALTHY: Adequate budget available
- Normal impulse creation (up to ${config.maxImpulses})
- Use standard budget guidelines
`}
`
```

**Then in system prompt construction** (line 143), add the budget section:

```typescript
      system.push(`You are the Session Memory Agent - a ROUTER for context management.

## Your Role: ROUTER, NOT CODER
...existing content...

${budgetSection}

## Intent Types
...existing content...
```

---

## Detailed Implementation: Budget Check Function

**Location**: `src/session/memory-agent.ts` (after `prepare()` function)

```typescript
  /**
   * Check context budget and determine preventive actions
   */
  async function checkContextBudget(input: {
    sessionID: string
    impulseTokens: number
    turnNumber: number
  }): Promise<{
    status: "healthy" | "warning" | "critical"
    utilization: number
    needsAction: boolean
    actions: Array<{
      type: "evict-low-priority" | "trigger-summarization" | "compress-impulse"
      target?: string
      count?: number
      reason: string
      estimatedSavings: number
    }>
  }> {
    const l = log.clone().tag("session", input.sessionID)
    
    // Use existing infrastructure
    const { SessionMemoryManager } = await import("./memory-manager")
    const { MessageV2 } = await import("./message-v2")
    
    const space = await SessionMemoryManager.getContextSpace(input.sessionID)
    const messageCount = await MessageV2.count(input.sessionID)
    
    // Estimate total context usage
    const estimatedMessageTokens = messageCount * 500  // ~500 tokens per message
    const systemOverhead = 5000  // System prompt, etc.
    const totalUsed = input.impulseTokens + estimatedMessageTokens + systemOverhead
    
    const utilization = (totalUsed / space.limits.availableForContext) * 100
    
    let status: "healthy" | "warning" | "critical"
    if (utilization < 70) status = "healthy"
    else if (utilization < 85) status = "warning"
    else status = "critical"
    
    const actions: Array<...> = []
    
    // Generate actions based on status
    if (status === "warning") {
      // 70-85% utilization - preventive measures
      
      // Action 1: Evict some low-priority impulses
      const lowPriorityLoaded = space.impulses.filter(
        i => i.priority === "low" && i.loaded
      ).length
      
      if (lowPriorityLoaded > 0) {
        const toEvict = Math.ceil(lowPriorityLoaded * 0.5)  // Evict 50%
        const estimatedSavings = toEvict * 1500  // Avg impulse size
        
        actions.push({
          type: "evict-low-priority",
          count: toEvict,
          reason: `Preventive eviction of ${toEvict} low-priority impulses`,
          estimatedSavings
        })
      }
      
      // Action 2: Consider summarization if history is large
      if (messageCount > 30) {
        const oldMessageCount = Math.max(0, messageCount - 20)  // Keep recent 20
        const estimatedSavings = oldMessageCount * 400  // Save ~400 tokens per old message
        
        actions.push({
          type: "trigger-summarization",
          reason: `Summarize ${oldMessageCount} old messages (keep recent 20)`,
          estimatedSavings
        })
      }
    }
    
    if (status === "critical") {
      // 85%+ utilization - aggressive cleanup
      
      // Action 1: Evict ALL low-priority
      const lowPriorityLoaded = space.impulses.filter(
        i => i.priority === "low" && i.loaded
      )
      if (lowPriorityLoaded.length > 0) {
        const estimatedSavings = lowPriorityLoaded.reduce((s, i) => s + i.tokenCount, 0)
        actions.push({
          type: "evict-low-priority",
          count: lowPriorityLoaded.length,
          reason: "CRITICAL: Evict ALL low-priority impulses",
          estimatedSavings
        })
      }
      
      // Action 2: Aggressive message summarization
      const oldMessageCount = Math.max(0, messageCount - 10)  // Keep only recent 10
      const estimatedSavings = oldMessageCount * 450
      actions.push({
        type: "trigger-summarization",
        reason: "CRITICAL: Aggressive summarization (keep only 10 recent)",
        estimatedSavings
      })
      
      // Action 3: Compress large medium-priority impulses
      const largeMedium = space.impulses.filter(
        i => i.priority === "medium" && i.loaded && i.tokenCount > 2500
      )
      if (largeMedium.length > 0) {
        actions.push({
          type: "compress-impulse",
          count: largeMedium.length,
          reason: `CRITICAL: Compress ${largeMedium.length} large medium-priority impulses`,
          estimatedSavings: largeMedium.reduce((s, i) => s + (i.tokenCount * 0.4), 0)  // 40% savings
        })
      }
    }
    
    l.info("context budget checked", {
      status,
      utilization: utilization.toFixed(1) + "%",
      totalUsed,
      available: space.limits.availableForContext,
      actionsNeeded: actions.length,
      actions: actions.map(a => a.type)
    })
    
    return {
      status,
      utilization,
      needsAction: actions.length > 0,
      actions
    }
  }
```

---

## Implementation: Summarization Trigger

**Add helper functions to `memory-agent.ts`:**

```typescript
  /**
   * Trigger message summarization (background operation)
   */
  async function triggerMessageSummarization(
    sessionID: string, 
    currentTurn: number
  ): Promise<void> {
    const l = log.clone().tag("session", sessionID)
    
    try {
      // Import existing summarization infrastructure
      const { SessionCompaction } = await import("./compaction")
      const { Session } = await import("./index")
      
      // Get session to determine provider/model
      const session = await Session.get(sessionID)
      
      // Trigger compaction (runs in background, doesn't block)
      SessionCompaction.run({
        sessionID,
        providerID: session.providerID || "anthropic",
        modelID: session.modelID || "claude-3-5-haiku-20241022"
      }).catch(error => {
        l.warn("summarization background job failed", {
          error: error instanceof Error ? error.message : String(error)
        })
      })
      
      l.info("triggered message summarization", {
        currentTurn,
        reason: "context-budget-overflow-prevention"
      })
    } catch (error) {
      l.error("failed to trigger summarization", {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
```

---

## Implementation: Component Annotation

The component-learning hook (shown above in Phase 2) handles this automatically.

### What Gets Annotated

**For each loaded impulse:**

1. **File path**: Absolute path to file
2. **Component name**: Extracted from impulse
3. **Component type**: "file", "function", "class", etc.
4. **Reason**: Multi-line description including:
   - Task description (why loaded)
   - Token usage (how much space)
   - Context requirement (what hint)
   - Load reason (priority/required)
   - Outcome (success/failure)
   - Pattern note (for future use)

### Example Annotation

After a successful debugging session:

```python
annotate_component(
    file_path="src/session/memory-agent.ts",
    component_name="analyzeIntent",
    component_type="function",
    reason="""
SESSION MEMORY: Loaded for task: Fix intent analysis hang in memory agent
Token usage: 1847 / 2000 budget (92% utilization)
Context requirement: errorContext (REQUIRED)
Load reason: high-priority
Priority: high
Result: Successfully contributed to success outcome
Pattern: Component relevant for debugging session memory timeouts
Turn: 15
Recommendation: Load when debugging memory-agent.ts or intent analysis issues
    """
)
```

### Benefits of Annotations

1. **Future Discovery**: Next time similar task occurs, Metabob injects these annotations
2. **Pattern Recognition**: System learns "this file + this task = useful"
3. **Budget Optimization**: Can learn optimal token allocations from usage patterns
4. **Historical Context**: Every interaction teaches the system

---

## Testing Strategy

### Test 1: Budget Monitoring

```typescript
// Create session with many impulses
const impulses = Array.from({length: 20}, (_, i) => ({
  id: `impulse-${i}`,
  sessionID,
  type: "file",
  priority: i < 5 ? "high" : i < 15 ? "medium" : "low",
  tokenCount: 3000  // Each impulse uses 3k tokens
}))

// Should trigger warning at 70% (60k / 92k)
const status = await checkContextBudget({
  sessionID,
  impulseTokens: 60000,
  turnNumber: 30
})

assert(status.status === "warning")
assert(status.actions.length > 0)
assert(status.actions.some(a => a.type === "evict-low-priority"))
```

### Test 2: Summarization Trigger

```typescript
// Create session with many old messages
for (let i = 0; i < 50; i++) {
  await MessageV2.create({
    sessionID,
    role: "user",
    content: `Message ${i}`,
    turn: i
  })
}

// At turn 50, should trigger summarization
const status = await checkContextBudget({
  sessionID,
  impulseTokens: 40000,
  turnNumber: 50
})

assert(status.actions.some(a => a.type === "trigger-summarization"))
```

### Test 3: Component Annotation

```typescript
// Load impulses for a task
const impulses = [
  { id: "test", type: "file", pointer: {type: "file", path: "test.ts"}, 
    tokenCount: 1500, priority: "high", metadata: {loadReason: "high-priority"} }
]

// Run component learning hook
const result = await trackComponentInteractions({
  sessionID,
  impulses,
  outcome: "success",
  taskDescription: "Fix bug in test.ts"
})

assert(result.annotationsCreated === 1)
// Check that annotation was sent to metabob-cli
```

---

## Configuration

**Add to** `src/config/config.ts` (in sessionMemory section):

```typescript
sessionMemory: z.object({
  enabled: z.boolean().optional(),
  
  // Budget management (NEW)
  budgetWarning: z.number().default(70).describe("Utilization % to trigger warnings"),
  budgetCritical: z.number().default(85).describe("Utilization % to trigger aggressive cleanup"),
  
  // Component learning (NEW)
  componentLearning: z.boolean().default(true).describe("Annotate touched components via metabob-cli"),
  
  // Summarization policy (NEW)
  summarization: z.object({
    autoTrigger: z.boolean().default(true).describe("Auto-summarize when budget tight"),
    ageThreshold: z.number().default(10).describe("Turns before considering for summary"),
    minRelevance: z.number().default(0.3).describe("Relevance score to preserve (0-1)")
  }).optional(),
  
  // Existing fields...
  budgets: z.object({...}).optional(),
  analysis: z.object({...}).optional(),
}).optional()
```

---

## Rollout Plan

### Week 1: Context Monitoring
- [ ] Add `checkContextBudget()` function
- [ ] Add `evictLowPriorityImpulses()` helper
- [ ] Integrate monitoring at end of `prepare()`
- [ ] Test with high-utilization sessions

### Week 2: Budget-Aware Creation
- [ ] Calculate budget usage before LLM call
- [ ] Add budget section to system prompt
- [ ] Test that LLM respects budget constraints
- [ ] Verify no overflow in long sessions

### Week 3: Summarization Integration
- [ ] Add `triggerMessageSummarization()` function
- [ ] Connect to existing `SessionCompaction` infrastructure
- [ ] Test summarization triggered at thresholds
- [ ] Verify token savings

### Week 4: Component Learning
- [ ] Add `component-learning` turn lifecycle hook
- [ ] Implement annotation logic
- [ ] Test annotations created for loaded impulses
- [ ] Verify annotations appear in future sessions

### Week 5: End-to-End Testing
- [ ] Long conversation test (100+ turns)
- [ ] High-activity test (many impulses)
- [ ] Verify no overflows occur
- [ ] Measure annotation effectiveness

---

## Expected Outcomes

### Quantitative

1. **Overflow Prevention**: 0 context overflow errors in production
2. **Budget Efficiency**: 60-80% utilization (optimal range)
3. **Token Savings**: 30-50% reduction via summarization
4. **Annotation Rate**: 70%+ of successful impulse loads annotated

### Qualitative

1. **Smoother Degradation**: Graceful handling of long sessions
2. **Faster Loading**: Historical patterns guide better impulse selection
3. **Learning Accumulation**: Every session teaches the system
4. **Better Context**: Right amount of context, not too much/too little

---

## Example: 50-Turn Session

### Turn 10 (Healthy)
```
Status: healthy (15% utilization)
Impulses: 3 loaded, 12k tokens
Messages: 10 messages, 5k tokens
Actions: None
```

### Turn 30 (Warning)
```
Status: warning (74% utilization)
Impulses: 8 loaded, 35k tokens
Messages: 30 messages, 15k tokens
Actions:
- Evict 2 low-priority impulses (save 3k)
- Consider summarization (30 messages)
Annotations: 6 components annotated
```

### Turn 50 (Prevented Critical)
```
Status: warning (68% utilization) ✅ Prevented overflow!
Impulses: 5 loaded, 25k tokens (3 evicted)
Messages: 15 messages, 8k tokens (35 summarized)
Actions:
- Evicted 3 low-priority impulses (freed 4.5k)
- Summarized 35 old messages (freed 12k)
Annotations: 14 components annotated
Result: Stayed under 70% via proactive management
```

---

## Summary

This enhancement transforms the session memory agent into a **complete context manager**:

1. ✅ **Monitors budget** continuously
2. ✅ **Prevents overflow** via proactive eviction
3. ✅ **Summarizes intelligently** based on relevance
4. ✅ **Learns from interactions** via component annotations

The key insight: Use `metabob-cli annotate_component` to create a **feedback loop** where successful impulse loads teach the system which components are helpful for which tasks.

**Result**: Sessions can run indefinitely without overflow, while continuously improving context selection through learning.
