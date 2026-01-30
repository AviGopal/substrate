# Context Requirements as Hints - Proper Fix

**Date**: January 30, 2026  
**Issue**: Activities with `contextRequirements` fail because the system treats them as hard requirements instead of hints for the memory agent.

---

## The Problem

Currently, `SessionMemoryAgent.gatherContext()` is called to **create fresh context from scratch** for each activity execution. This approach:

1. ❌ **Ignores existing session impulses** - Context that's already loaded is not reused
2. ❌ **Doesn't leverage Metabob** - Available code intelligence is not consulted
3. ❌ **Fails silently** - LLM call hangs/times out without proper error handling
4. ❌ **Treats hints as requirements** - Optional context suggestions treated as mandatory
5. ❌ **Creates duplicate impulses** - Same files loaded multiple times across session

## The Correct Architecture

Per the **Annotation Learning System** architecture (see ANNOTATION_LEARNING_SYSTEM_SUMMARY.md), context requirements should be **hints** that guide the memory agent to:

### 1. Check Existing Session Context
```typescript
// FIRST: Look at what's already loaded in the session
const existingImpulses = await SessionMemory.list(sessionID)
const relevantImpulses = filterRelevantImpulses(existingImpulses, contextRequirements)
```

### 2. Query Metabob for Recommendations
```typescript
// SECOND: Ask Metabob what's relevant
const metabobContext = await metabob_annotate_component(file, component, "CONTEXT_HINT", reason)
const metabobSuggestions = extractSuggestedFiles(metabobContext)
```

### 3. Create New Impulses Only if Needed
```typescript
// THIRD: Create impulses for missing context
const missingContext = contextRequirements.filter(req => 
  !existingImpulses.some(imp => matchesRequirement(imp, req))
)

if (missingContext.length > 0) {
  const newImpulses = await createImpulsesForRequirements(missingContext)
}
```

### 4. Return Union of All Sources
```typescript
return {
  ...existingImpulses,      // Already in session
  ...metabobImpulses,        // From Metabob recommendations  
  ...createdImpulses,        // Newly created from hints
}
```

---

## Proposed Implementation

### Fix 1: Update gatherContext() to Use Hints Pattern

**Location**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**New signature**:
```typescript
export async function gatherContext(input: {
  sessionID: string  // ← ADD: Need session to check existing impulses
  requirements: ActivityTemplate.ContextRequirement[]
  reason: string
  recentMessages: MessageV2.WithParts[]
}): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  const l = log.clone()
  const start = Date.now()

  try {
    l.info("gatherContext() starting (hints-based approach)", {
      sessionID: input.sessionID,
      requirementCount: input.requirements.length,
      recentMessageCount: input.recentMessages.length,
    })

    // STEP 1: Check existing session impulses
    const existingImpulses = await checkExistingSessionImpulses(input.sessionID, input.requirements)
    
    l.info("found existing session impulses", {
      count: Object.keys(existingImpulses).length,
      ids: Object.keys(existingImpulses),
    })

    // STEP 2: Query Metabob for suggestions (if enabled)
    const metabobImpulses = await queryMetabobForContext(input.reason, input.requirements)
    
    l.info("received Metabob suggestions", {
      count: Object.keys(metabobImpulses).length,
      ids: Object.keys(metabobImpulses),
    })

    // STEP 3: Analyze remaining gaps using LLM (with timeout!)
    const missingRequirements = findMissingRequirements(
      input.requirements,
      existingImpulses,
      metabobImpulses
    )

    let llmImpulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
    
    if (missingRequirements.length > 0) {
      l.info("analyzing missing context with LLM", {
        missingCount: missingRequirements.length,
        timeout: 30000,
      })

      // ADD TIMEOUT HERE
      const analysis = await Promise.race([
        analyzeContextNeeds({
          requirements: missingRequirements,
          reason: input.reason,
          recentMessages: input.recentMessages,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("LLM context analysis timed out")), 30000)
        )
      ]) as Awaited<ReturnType<typeof analyzeContextNeeds>>

      llmImpulses = convertAnalysisToImpulses(analysis, missingRequirements)
      
      l.info("LLM analysis complete", {
        impulseCount: Object.keys(llmImpulses).length,
        elapsed: Date.now() - start,
      })
    } else {
      l.info("all requirements satisfied by existing/metabob context, skipping LLM")
    }

    // STEP 4: Merge all sources (existing takes precedence)
    const allImpulses = {
      ...llmImpulses,         // Lowest priority: LLM suggestions
      ...metabobImpulses,     // Medium priority: Metabob recommendations
      ...existingImpulses,    // Highest priority: Already loaded context
    }

    l.info("context gathering complete", {
      totalImpulses: Object.keys(allImpulses).length,
      fromExisting: Object.keys(existingImpulses).length,
      fromMetabob: Object.keys(metabobImpulses).length,
      fromLLM: Object.keys(llmImpulses).length,
      elapsed: Date.now() - start,
    })

    return allImpulses

  } catch (error) {
    l.error("context gathering failed", {
      error: error instanceof Error ? error.message : String(error),
      elapsed: Date.now() - start,
    })
    
    // DON'T THROW - return empty impulses and let activity continue
    l.warn("returning empty impulses, activity will continue without context")
    return {}
  }
}
```

### Fix 2: Implement Helper Functions

**Add to memory-agent.ts**:

```typescript
/**
 * Check if session already has impulses matching requirements
 */
async function checkExistingSessionImpulses(
  sessionID: string,
  requirements: ActivityTemplate.ContextRequirement[]
): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  const l = log.clone()
  
  try {
    // Get all impulses from session
    const session = await Session.get(sessionID)
    if (!session?.impulses) {
      return {}
    }

    const matchingImpulses: Record<string, ActivityTemplate.Impulse.Schema> = {}

    // For each requirement, check if we have matching impulses
    for (const req of requirements) {
      for (const [id, impulse] of Object.entries(session.impulses)) {
        // Check if impulse type matches requirement
        if (req.impulseTypes.includes(impulse.type)) {
          // Check if impulse is relevant to requirement hint
          if (isImpulseRelevant(impulse, req)) {
            matchingImpulses[id] = impulse
            l.debug("found matching impulse in session", {
              requirementKey: req.key,
              impulseId: id,
              impulseType: impulse.type,
            })
          }
        }
      }
    }

    return matchingImpulses
  } catch (error) {
    l.warn("failed to check existing impulses", { error })
    return {}
  }
}

/**
 * Check if impulse is relevant to requirement based on hint
 */
function isImpulseRelevant(
  impulse: ActivityTemplate.Impulse.Schema,
  requirement: ActivityTemplate.ContextRequirement
): boolean {
  // Simple heuristic: check if requirement hint keywords appear in impulse
  const hintKeywords = requirement.hint.toLowerCase().split(/\s+/)
  
  // Check pointer content for relevance
  if (impulse.type === "file" && impulse.pointer.type === "file") {
    const filePath = impulse.pointer.path.toLowerCase()
    return hintKeywords.some(keyword => filePath.includes(keyword))
  }
  
  if (impulse.type === "component" && impulse.pointer.type === "component") {
    const componentName = impulse.pointer.name.toLowerCase()
    const file = impulse.pointer.file.toLowerCase()
    return hintKeywords.some(keyword => 
      componentName.includes(keyword) || file.includes(keyword)
    )
  }
  
  // For other types, be permissive (include it)
  return true
}

/**
 * Query Metabob for context suggestions
 */
async function queryMetabobForContext(
  reason: string,
  requirements: ActivityTemplate.ContextRequirement[]
): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  const l = log.clone()
  
  // TODO: Integrate with Metabob MCP tools
  // For now, return empty (graceful degradation)
  
  try {
    // Example integration (if Metabob tools available):
    // const issues = await metabob_get_priority_issues({ maxIssues: 5 })
    // const relatedFiles = extractFilesFromIssues(issues)
    // return convertFilesToImpulses(relatedFiles, requirements)
    
    l.debug("Metabob integration not yet implemented, skipping")
    return {}
  } catch (error) {
    l.warn("failed to query Metabob", { error })
    return {}
  }
}

/**
 * Find requirements not yet satisfied by existing/metabob impulses
 */
function findMissingRequirements(
  requirements: ActivityTemplate.ContextRequirement[],
  existingImpulses: Record<string, ActivityTemplate.Impulse.Schema>,
  metabobImpulses: Record<string, ActivityTemplate.Impulse.Schema>
): ActivityTemplate.ContextRequirement[] {
  const allImpulses = { ...existingImpulses, ...metabobImpulses }
  
  return requirements.filter(req => {
    // Check if any impulse satisfies this requirement
    const satisfied = Object.values(allImpulses).some(impulse =>
      req.impulseTypes.includes(impulse.type) && isImpulseRelevant(impulse, req)
    )
    
    // Include if not satisfied OR if required
    return !satisfied || req.required
  })
}

/**
 * Convert analysis results to impulse schemas
 */
function convertAnalysisToImpulses(
  analysis: Record<string, { files?: string[], components?: Array<{file: string, name: string}>, ... }>,
  requirements: ActivityTemplate.ContextRequirement[]
): Record<string, ActivityTemplate.Impulse.Schema> {
  const impulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  
  for (const req of requirements) {
    const contextData = analysis[req.key]
    if (!contextData) continue
    
    let impulseCount = 0
    
    // File impulses
    if (contextData.files) {
      for (const filePath of contextData.files) {
        const impulseId = `${req.key}-file-${impulseCount++}`
        impulses[impulseId] = {
          id: impulseId,
          type: "file",
          pointer: { type: "file", path: filePath },
          budget: req.budgetRange[0],
          priority: req.required ? "high" : "medium",
          metadata: { requirement: req.key, source: "llm-analysis" },
        }
      }
    }
    
    // Component impulses
    if (contextData.components) {
      for (const component of contextData.components) {
        const impulseId = `${req.key}-component-${impulseCount++}`
        impulses[impulseId] = {
          id: impulseId,
          type: "component",
          pointer: { type: "component", file: component.file, name: component.name },
          budget: req.budgetRange[0],
          priority: req.required ? "high" : "medium",
          metadata: { requirement: req.key, source: "llm-analysis" },
        }
      }
    }
    
    // Bash commands
    if (contextData.bashCommands) {
      for (const command of contextData.bashCommands) {
        const impulseId = `${req.key}-bash-${impulseCount++}`
        impulses[impulseId] = {
          id: impulseId,
          type: "bashOutput",
          pointer: { type: "bashOutput", command },
          budget: req.budgetRange[0],
          priority: req.required ? "high" : "medium",
          metadata: { requirement: req.key, source: "llm-analysis" },
        }
      }
    }
  }
  
  return impulses
}
```

### Fix 3: Update activity.ts to Pass sessionID

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` line 473

**Before**:
```typescript
const impulses = await SessionMemoryAgent.gatherContext({
  requirements: template.contextRequirements,
  reason: params.reason,
  recentMessages: recentWithParts,
})
```

**After**:
```typescript
const impulses = await SessionMemoryAgent.gatherContext({
  sessionID,  // ← ADD: Pass session ID for existing impulses check
  requirements: template.contextRequirements,
  reason: params.reason,
  recentMessages: recentWithParts,
})
```

### Fix 4: Make Context Gathering Gracefully Degrade

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` line 473

**Wrap in try-catch with non-fatal handling**:

```typescript
// Context gathering (non-fatal if fails)
if (template.contextRequirements && template.contextRequirements.length > 0) {
  log.info("gathering context from hints", {
    activityId: activity.id,
    requirementCount: template.contextRequirements.length,
  })

  try {
    const impulses = await SessionMemoryAgent.gatherContext({
      sessionID,
      requirements: template.contextRequirements,
      reason: params.reason,
      recentMessages: recentWithParts,
    })

    activity.impulses = impulses
    await Activity.save(activity)

    log.info("context gathered successfully", {
      activityId: activity.id,
      impulseCount: Object.keys(impulses).length,
      sources: {
        existing: Object.values(impulses).filter(i => !i.metadata?.source).length,
        metabob: Object.values(impulses).filter(i => i.metadata?.source === "metabob").length,
        llm: Object.values(impulses).filter(i => i.metadata?.source === "llm-analysis").length,
      }
    })
  } catch (error) {
    // NON-FATAL: Log warning and continue with empty impulses
    log.warn("context gathering failed, continuing without context hints", {
      activityId: activity.id,
      error: error instanceof Error ? error.message : String(error),
    })
    
    activity.impulses = {}
    await Activity.save(activity)
  }
}
```

---

## Benefits of This Approach

### 1. Reuses Existing Context ✅
- Session impulses already loaded are reused
- No duplicate file reads
- Faster execution (skip LLM if context exists)

### 2. Leverages Metabob Intelligence ✅
- Code intelligence from CPG analysis
- Component annotations with learning
- Priority issues and impact analysis

### 3. Treats Requirements as Hints ✅
- Optional suggestions, not hard requirements
- Graceful degradation if context unavailable
- Activity continues even without perfect context

### 4. Proper Error Handling ✅
- Timeout on LLM calls (30s max)
- Non-fatal failures (log and continue)
- Detailed logging for debugging

### 5. Multi-Source Context ✅
- Existing impulses (highest priority)
- Metabob recommendations (medium priority)
- LLM analysis (lowest priority)

---

## Migration Path

### Phase 1: Add Helpers (Safe)
1. Add new helper functions to `memory-agent.ts`
2. No breaking changes yet
3. Test in isolation

### Phase 2: Update Signature (Breaking)
1. Add `sessionID` parameter to `gatherContext()`
2. Update caller in `activity.ts`
3. Deploy together

### Phase 3: Enable Metabob Integration
1. Implement `queryMetabobForContext()`
2. Connect to Metabob MCP tools
3. Test with real activities

### Phase 4: Optimize
1. Add caching for LLM analysis results
2. Improve relevance heuristics
3. Add metrics for context source effectiveness

---

## Testing Plan

### Test 1: With Existing Session Impulses
```typescript
// Setup: Load file into session
await SessionMemory.create(sessionID, {
  id: "test-file",
  type: "file",
  pointer: { type: "file", path: "src/test.ts" },
  budget: 2000,
  priority: "high",
})

// Execute: Activity with contextRequirements matching file
await activity({
  templateId: "test-template",
  variables: {},
  reason: "Test reusing existing impulses"
})

// Verify: gatherContext() reused existing impulse
// Expected: No LLM call, 0 cost, fast execution
```

### Test 2: With Metabob Recommendations
```typescript
// Setup: Metabob MCP has annotations for component
// (via previous metabob_annotate_component calls)

// Execute: Activity with contextRequirements for that component
await activity({
  templateId: "test-template",
  variables: {},
  reason: "Test Metabob context integration"
})

// Verify: gatherContext() used Metabob suggestions
// Expected: Metabob-sourced impulses, reduced LLM calls
```

### Test 3: With Missing Context (LLM Fallback)
```typescript
// Setup: No existing impulses, Metabob unavailable

// Execute: Activity with new contextRequirements
await activity({
  templateId: "test-template",
  variables: {},
  reason: "Test LLM fallback for missing context"
})

// Verify: gatherContext() called LLM with timeout
// Expected: LLM-sourced impulses, completed within 30s
```

### Test 4: With LLM Timeout (Graceful Degradation)
```typescript
// Setup: Mock LLM to hang forever

// Execute: Activity with contextRequirements
await activity({
  templateId: "test-template",
  variables: {},
  reason: "Test timeout and graceful degradation"
})

// Verify: Activity continued after timeout
// Expected: Empty impulses, activity still executes tasks
```

---

## Rollback Plan

If issues arise:

1. **Immediate**: Revert `activity.ts` caller change (don't pass sessionID)
2. **Quick**: Add feature flag `USE_HINTS_CONTEXT = false` to disable
3. **Safe**: Old `gatherContext()` behavior can coexist with new one

```typescript
// Feature flag approach
if (USE_HINTS_CONTEXT) {
  impulses = await SessionMemoryAgent.gatherContextWithHints(...)
} else {
  impulses = await SessionMemoryAgent.gatherContext(...)  // old implementation
}
```

---

## Success Metrics

After deployment:

- ✅ **Activities with contextRequirements succeed** (0% → 100% success rate)
- ✅ **Context reuse rate** (% of impulses from existing session)
- ✅ **LLM call reduction** (skip LLM when context exists)
- ✅ **Faster execution** (no LLM analysis when context available)
- ✅ **Metabob integration** (% of impulses from Metabob)
- ✅ **Zero silent failures** (all errors logged and handled)

---

## Related Work

- **Annotation Learning System** (ANNOTATION_LEARNING_SYSTEM_SUMMARY.md)
  - Context selection from Metabob CPG
  - Component annotations with scores
  - Double-blind learning architecture

- **SessionMemory namespace** (`session/session-memory.ts`)
  - Impulse CRUD operations
  - Lazy loading and budget management
  - Metrics and footprint tracking

- **Activity execution** (`tool/activity.ts`)
  - Template loading and validation
  - Task execution with impulse resolution
  - Distributed context for ACP delegation

---

**Next Step**: Implement Phase 1 (add helpers), test in isolation, then roll out Phase 2-4.
