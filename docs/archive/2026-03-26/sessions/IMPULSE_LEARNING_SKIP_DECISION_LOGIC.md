# Impulse Learning System: Skip Decision Logic

**Date**: 2026-02-25  
**Purpose**: Complete specification for memory agent LLM skip decision logic with integration points, fallback strategies, and tracking

---

## Executive Summary

This document specifies the complete skip decision logic that determines when to bypass memory agent LLM calls and use alternative strategies (pattern replay, template requirements, continuation). The goal is to skip 60-80% of LLM calls while maintaining quality.

**Skip Decision Rules**:
1. **Trivial Messages**: Simple acknowledgments, greetings, confirmations (→ skip, do nothing)
2. **Continuations**: "continue", "keep going" (→ skip, keep existing impulses)
3. **Pattern Match**: High-confidence pattern match (>85%) (→ skip, replay impulses)
4. **Activity Context**: Activity with contextRequirements (→ skip, use template requirements)

**Integration**: Pre-turn hook (priority 5) before memory-management hook (priority 10)

**Success Metric**: Skip rate 60-80% with quality maintained (task success rate unchanged)

---

## Part 1: Skip Decision Function

### 1.1 Core Decision Function

```typescript
/**
 * Decide if memory agent LLM call should be skipped
 * Returns skip decision with reason and fallback strategy
 */
export async function shouldSkipMemoryAgentLLM(input: {
  sessionID: string
  promptText: string
  turnNumber: number
  agent: Agent.Info
}): Promise<SkipDecision> {
  
  const start = Date.now()
  
  // Rule 1: Trivial messages (check first, cheapest)
  const trivialMatch = detectTrivialMessage(input.promptText)
  if (trivialMatch) {
    return {
      shouldSkip: true,
      reason: 'trivial_message',
      confidence: trivialMatch.confidence,
      fallbackStrategy: 'do_nothing',
      metadata: {
        pattern: trivialMatch.pattern,
        duration: Date.now() - start,
      }
    }
  }
  
  // Rule 2: Continuations (check second, also cheap)
  const continuationMatch = detectContinuation(input.promptText)
  if (continuationMatch) {
    return {
      shouldSkip: true,
      reason: 'continuation',
      confidence: continuationMatch.confidence,
      fallbackStrategy: 'keep_existing',
      metadata: {
        pattern: continuationMatch.pattern,
        duration: Date.now() - start,
      }
    }
  }
  
  // Rule 3: Pattern match (moderate cost - requires pattern lookup)
  const patternMatch = await matchAgainstLearnedPatterns(input)
  if (patternMatch && patternMatch.confidence >= 0.85) {
    return {
      shouldSkip: true,
      reason: 'pattern_match',
      confidence: patternMatch.confidence,
      fallbackStrategy: 'pattern_replay',
      metadata: {
        patternId: patternMatch.pattern.patternId,
        template: patternMatch.pattern.template,
        variableBindings: patternMatch.variableBindings,
        duration: Date.now() - start,
      }
    }
  }
  
  // Rule 4: Activity with context requirements (most expensive - activity lookup)
  const activityContext = await checkActivityContextRequirements(input.sessionID)
  if (activityContext && activityContext.hasRequirements) {
    return {
      shouldSkip: true,
      reason: 'activity_context',
      confidence: 0.95, // High confidence - template explicitly defines requirements
      fallbackStrategy: 'template_requirements',
      metadata: {
        activityId: activityContext.activityId,
        templateId: activityContext.templateId,
        requirementCount: activityContext.requirements.length,
        duration: Date.now() - start,
      }
    }
  }
  
  // No skip - run memory agent LLM
  return {
    shouldSkip: false,
    reason: 'no_match',
    confidence: 0,
    fallbackStrategy: null,
    metadata: {
      duration: Date.now() - start,
    }
  }
}

/**
 * Skip decision result
 */
interface SkipDecision {
  shouldSkip: boolean
  reason: SkipReason
  confidence: number                 // 0-1 (how confident we are in this decision)
  fallbackStrategy: FallbackStrategy | null
  metadata: Record<string, any>
}

type SkipReason = 
  | 'trivial_message'                // Simple acknowledgment, greeting
  | 'continuation'                   // "continue", "keep going"
  | 'pattern_match'                  // Matched learned pattern with high confidence
  | 'activity_context'               // Activity has contextRequirements
  | 'no_match'                       // No skip rule matched

type FallbackStrategy = 
  | 'do_nothing'                     // Trivial - don't create impulses
  | 'keep_existing'                  // Continuation - keep existing impulses
  | 'pattern_replay'                 // Pattern match - replay impulses from pattern
  | 'template_requirements'          // Activity - use template contextRequirements
```

### 1.2 Skip Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│                   shouldSkipMemoryAgentLLM()                │
│                                                             │
│  Input: sessionID, promptText, turnNumber, agent            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ Rule 1: Trivial?    │ (Cheap: regex patterns)
        └─────────┬───────────┘
                  │
          ┌───────┴───────┐
          │ Yes           │ No
          ▼               ▼
    ┌─────────────┐  ┌─────────────────────┐
    │ SKIP        │  │ Rule 2: Continuation?│ (Cheap: keyword match)
    │ Reason:     │  └──────────┬──────────┘
    │  trivial    │             │
    │ Fallback:   │       ┌─────┴─────┐
    │  do_nothing │       │ Yes       │ No
    └─────────────┘       ▼           ▼
                    ┌──────────┐  ┌────────────────────┐
                    │ SKIP     │  │ Rule 3: Pattern?   │ (Moderate: DB lookup)
                    │ Reason:  │  └─────────┬──────────┘
                    │  continue│            │
                    │ Fallback:│      ┌─────┴──────┐
                    │  keep    │      │ Yes (>85%) │ No
                    └──────────┘      ▼            ▼
                              ┌─────────────┐  ┌──────────────────┐
                              │ SKIP        │  │ Rule 4: Activity?│ (Expensive: activity lookup)
                              │ Reason:     │  └────────┬─────────┘
                              │  pattern    │           │
                              │ Fallback:   │     ┌─────┴─────┐
                              │  replay     │     │ Yes       │ No
                              └─────────────┘     ▼           ▼
                                          ┌────────────┐  ┌──────────┐
                                          │ SKIP       │  │ NO SKIP  │
                                          │ Reason:    │  │ Run LLM  │
                                          │  activity  │  └──────────┘
                                          │ Fallback:  │
                                          │  template  │
                                          └────────────┘
```

---

## Part 2: Skip Rule Implementations

### 2.1 Rule 1: Trivial Messages

**Goal**: Detect simple messages that don't need impulse preparation

**Examples**:
- "ok"
- "thanks"
- "got it"
- "yes"
- "no"
- "👍"

```typescript
/**
 * Detect trivial messages
 */
function detectTrivialMessage(promptText: string): TrivialMatch | null {
  const cleaned = promptText.toLowerCase().trim()
  
  // Pattern 1: Very short messages (< 5 characters)
  if (cleaned.length < 5) {
    // Check if it's a known trivial pattern
    const trivialPatterns = [
      'ok', 'yes', 'no', 'yep', 'nope', 'sure', 'fine', 'k'
    ]
    
    if (trivialPatterns.includes(cleaned)) {
      return {
        pattern: cleaned,
        confidence: 1.0
      }
    }
  }
  
  // Pattern 2: Common acknowledgments
  const acknowledgmentRegex = /^(thank you|thanks|got it|understood|sounds good|perfect|great)$/i
  if (acknowledgmentRegex.test(cleaned)) {
    return {
      pattern: 'acknowledgment',
      confidence: 0.95
    }
  }
  
  // Pattern 3: Emojis only
  const emojiOnlyRegex = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u
  if (emojiOnlyRegex.test(promptText)) {
    return {
      pattern: 'emoji',
      confidence: 0.9
    }
  }
  
  return null
}

interface TrivialMatch {
  pattern: string
  confidence: number
}
```

**Fallback Strategy**: `do_nothing`
- Don't create any impulses
- Don't call memory agent LLM
- Existing impulses remain untouched
- Agent responds with minimal context

### 2.2 Rule 2: Continuations

**Goal**: Detect continuation messages that mean "keep going with what you were doing"

**Examples**:
- "continue"
- "keep going"
- "go on"
- "next"
- "proceed"

```typescript
/**
 * Detect continuation messages
 */
function detectContinuation(promptText: string): ContinuationMatch | null {
  const cleaned = promptText.toLowerCase().trim()
  
  // Pattern 1: Explicit continuation keywords
  const continuationKeywords = [
    'continue',
    'keep going',
    'go on',
    'go ahead',
    'proceed',
    'next',
    'more',
    'keep it up',
    'carry on'
  ]
  
  for (const keyword of continuationKeywords) {
    if (cleaned === keyword || cleaned.startsWith(keyword + ' ')) {
      return {
        pattern: keyword,
        confidence: 0.95
      }
    }
  }
  
  // Pattern 2: Continuation with minimal context ("continue with auth")
  const continuationWithContextRegex = /^(continue|keep going|proceed|go on)\s+(with|on|to)\s+.{1,30}$/i
  if (continuationWithContextRegex.test(cleaned)) {
    return {
      pattern: 'continuation_with_context',
      confidence: 0.9
    }
  }
  
  return null
}

interface ContinuationMatch {
  pattern: string
  confidence: number
}
```

**Fallback Strategy**: `keep_existing`
- Don't create new impulses
- Don't call memory agent LLM
- Keep all existing impulses loaded
- Agent continues with same context

### 2.3 Rule 3: Pattern Match

**Goal**: Match message against learned patterns with high confidence

**Confidence Threshold**: 0.85 (85%)

```typescript
/**
 * Match message against learned patterns
 */
async function matchAgainstLearnedPatterns(input: {
  sessionID: string
  promptText: string
  turnNumber: number
}): Promise<PatternMatch | null> {
  
  // Import pattern matching from learning engine
  const { PatternLibrary } = await import('./learning/pattern-library')
  
  // Load learned patterns from database
  const learnedPatterns = await PatternLibrary.getActivePatterns({
    minSuccessRate: 0.75,     // Only use reliable patterns
    minObservations: 3,       // Must have been seen at least 3 times
  })
  
  // Match against learned patterns
  const match = await matchPattern(input.promptText, learnedPatterns, {
    minConfidence: 0.85,      // High threshold for skipping
  })
  
  return match
}
```

**Fallback Strategy**: `pattern_replay`
- Replay impulses from matched pattern
- Use variable bindings to construct impulse pointers
- Apply path transformations
- Mark impulses with `source: 'pattern-replay'`
- Track pattern usage for learning

**Implementation**: See Part 3.3 for full pattern replay logic

### 2.4 Rule 4: Activity Context Requirements

**Goal**: Use activity template contextRequirements instead of memory agent

**When**: Activity is running AND template defines contextRequirements

```typescript
/**
 * Check if current activity has context requirements
 */
async function checkActivityContextRequirements(
  sessionID: string
): Promise<ActivityContextInfo | null> {
  
  // Get current activity for session
  const { Activity } = await import('./session/activity')
  const currentActivity = Activity.getActivityForSession(sessionID)
  
  if (!currentActivity) {
    return null // No activity running
  }
  
  // Load activity template
  const { ActivityTemplate } = await import('./session/activity-template')
  const template = await ActivityTemplate.load(currentActivity.templateId)
  
  if (!template) {
    return null // Activity has no template (manual activity)
  }
  
  // Check if template defines context requirements
  if (!template.contextRequirements || template.contextRequirements.length === 0) {
    return null // Template doesn't specify requirements
  }
  
  return {
    activityId: currentActivity.id,
    templateId: template.id,
    hasRequirements: true,
    requirements: template.contextRequirements,
  }
}

interface ActivityContextInfo {
  activityId: string
  templateId: string
  hasRequirements: boolean
  requirements: ActivityTemplate.ContextRequirement[]
}
```

**Fallback Strategy**: `template_requirements`
- Create impulses from template contextRequirements
- Skip memory agent LLM call
- Impulses are already well-defined in template
- Mark impulses with `source: 'template-requirements'`

**Implementation**: See Part 3.4 for full template requirements logic

---

## Part 3: Fallback Strategy Implementations

### 3.1 Fallback: Do Nothing (Trivial Messages)

**Strategy**: Don't create impulses, let agent respond with minimal context

```typescript
/**
 * Fallback for trivial messages
 * No impulses needed - agent responds naturally
 */
async function fallback_doNothing(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  
  const start = Date.now()
  
  // Log skip decision
  log.info('memory agent skip: trivial message', {
    sessionID: input.sessionID,
    reason: input.decision.reason,
    confidence: input.decision.confidence,
    pattern: input.decision.metadata.pattern,
  })
  
  // Do nothing - no impulses created
  // Existing impulses remain untouched
  
  return {
    impulsesCreated: 0,
    impulsesLoaded: 0,
    totalTokens: 0,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'trivial_message',
    duration: Date.now() - start,
  }
}

interface FallbackResult {
  impulsesCreated: number
  impulsesLoaded: number
  totalTokens: number
  impulsesUnloaded: number
  skipped: boolean
  skipReason: string
  duration: number
}
```

### 3.2 Fallback: Keep Existing (Continuations)

**Strategy**: Keep all existing impulses, don't create new ones

```typescript
/**
 * Fallback for continuations
 * Keep existing impulses - agent continues with same context
 */
async function fallback_keepExisting(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  
  const start = Date.now()
  
  const { SessionMemory } = await import('./session/session-memory')
  
  // Count existing loaded impulses
  const impulses = await SessionMemory.listImpulses(input.sessionID)
  const loadedImpulses = impulses.filter(imp => imp.loaded)
  
  log.info('memory agent skip: continuation', {
    sessionID: input.sessionID,
    reason: input.decision.reason,
    confidence: input.decision.confidence,
    pattern: input.decision.metadata.pattern,
    existingImpulsesKept: loadedImpulses.length,
  })
  
  // Calculate total tokens from existing impulses
  const totalTokens = loadedImpulses.reduce((sum, imp) => {
    return sum + (imp.tokenCount || 0)
  }, 0)
  
  // No new impulses created - keep existing
  
  return {
    impulsesCreated: 0,
    impulsesLoaded: loadedImpulses.length, // Existing impulses
    totalTokens,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'continuation',
    duration: Date.now() - start,
  }
}
```

### 3.3 Fallback: Pattern Replay

**Strategy**: Replay impulses from matched pattern using variable bindings

```typescript
/**
 * Fallback for pattern matches
 * Replay impulses from learned pattern
 */
async function fallback_patternReplay(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  
  const start = Date.now()
  
  const { SessionMemory } = await import('./session/session-memory')
  const { replayImpulsesFromPattern } = await import('./learning/pattern-replay')
  
  // Extract pattern match from metadata
  const patternMatch = {
    pattern: input.decision.metadata.pattern,
    confidence: input.decision.confidence,
    variableBindings: input.decision.metadata.variableBindings,
  }
  
  // Get session context (recent files, working directory)
  const context = await getSessionContext(input.sessionID)
  
  // Replay impulses from pattern
  const replayedImpulses = await replayImpulsesFromPattern(
    patternMatch,
    input.sessionID,
    context
  )
  
  log.info('memory agent skip: pattern replay', {
    sessionID: input.sessionID,
    patternId: input.decision.metadata.patternId,
    template: input.decision.metadata.template,
    confidence: input.decision.confidence,
    impulsesReplayed: Object.keys(replayedImpulses).length,
  })
  
  // Add replayed impulses to session memory
  let impulsesCreated = 0
  let totalTokens = 0
  
  for (const [id, impulse] of Object.entries(replayedImpulses)) {
    await SessionMemory.addImpulse(input.sessionID, impulse)
    impulsesCreated++
    
    // Load impulse content immediately (budget permitting)
    if (impulse.priority === 'high' || impulse.priority === 'medium') {
      await SessionMemory.loadImpulse(input.sessionID, impulse.id)
      totalTokens += impulse.tokenCount || 0
    }
  }
  
  // Track pattern usage for learning
  await trackPatternUsage({
    patternId: input.decision.metadata.patternId,
    sessionID: input.sessionID,
    userMessage: context.promptText,
    confidence: input.decision.confidence,
    variableBindings: input.decision.metadata.variableBindings,
    skippedLLM: true,
  })
  
  return {
    impulsesCreated,
    impulsesLoaded: impulsesCreated, // All replayed impulses are loaded
    totalTokens,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'pattern_match',
    duration: Date.now() - start,
  }
}

async function getSessionContext(sessionID: string): Promise<{
  recentFiles: string[]
  workingDirectory: string
  promptText: string
}> {
  const { SessionMemory } = await import('./session/session-memory')
  const { MessageV2 } = await import('./session/message-v2')
  
  // Get recent files from session memory
  const recentFiles = await SessionMemory.getRecentFiles(sessionID, 5)
  
  // Get working directory
  const workingDirectory = process.cwd()
  
  // Get last user message
  let promptText = ''
  for await (const msg of MessageV2.stream(sessionID)) {
    if (msg.role === 'user') {
      promptText = msg.text
      break
    }
  }
  
  return { recentFiles, workingDirectory, promptText }
}

async function trackPatternUsage(input: {
  patternId: string
  sessionID: string
  userMessage: string
  confidence: number
  variableBindings: Record<string, string>
  skippedLLM: boolean
}): Promise<void> {
  const { PatternLibrary } = await import('./learning/pattern-library')
  
  // Record pattern match for learning
  await PatternLibrary.recordMatch({
    patternId: input.patternId,
    sessionID: input.sessionID,
    userMessage: input.userMessage,
    confidence: input.confidence,
    variableBindings: input.variableBindings,
    skippedLLM: input.skippedLLM,
    matchedAt: Date.now(),
  })
}
```

### 3.4 Fallback: Template Requirements

**Strategy**: Create impulses from activity template contextRequirements

```typescript
/**
 * Fallback for activities with context requirements
 * Use template-defined requirements instead of LLM
 */
async function fallback_templateRequirements(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  
  const start = Date.now()
  
  const { SessionMemory } = await import('./session/session-memory')
  const { createImpulsesFromRequirements } = await import('./session/activity-template')
  
  // Extract activity context from metadata
  const activityId = input.decision.metadata.activityId
  const templateId = input.decision.metadata.templateId
  const requirements = input.decision.metadata.requirements
  
  log.info('memory agent skip: template requirements', {
    sessionID: input.sessionID,
    activityId,
    templateId,
    requirementCount: requirements.length,
  })
  
  // Create impulses from template requirements
  const impulses = await createImpulsesFromRequirements(
    requirements,
    input.sessionID
  )
  
  // Add impulses to session memory
  let impulsesCreated = 0
  let totalTokens = 0
  
  for (const [id, impulse] of Object.entries(impulses)) {
    await SessionMemory.addImpulse(input.sessionID, impulse)
    impulsesCreated++
    
    // Load impulse content (all template requirements are important)
    await SessionMemory.loadImpulse(input.sessionID, impulse.id)
    totalTokens += impulse.tokenCount || 0
  }
  
  return {
    impulsesCreated,
    impulsesLoaded: impulsesCreated,
    totalTokens,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'activity_context',
    duration: Date.now() - start,
  }
}

/**
 * Create impulses from activity template contextRequirements
 */
async function createImpulsesFromRequirements(
  requirements: ActivityTemplate.ContextRequirement[],
  sessionID: string
): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  
  const impulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  let impulseCount = 0
  
  for (const req of requirements) {
    const impulseId = `template-req-${impulseCount++}`
    
    let pointer: ImpulsePointer
    
    // Construct pointer based on requirement type
    switch (req.type) {
      case 'file':
        pointer = {
          type: 'file',
          path: req.path,
        }
        break
      
      case 'recentFiles':
        // Create impulse that resolves to recent files
        pointer = {
          type: 'custom',
          resolver: 'recent-files',
          data: { sessionID, count: req.count || 5 },
        }
        break
      
      case 'metabobIssues':
        pointer = {
          type: 'metabobIssue',
          filePath: req.filePath,
          severity: req.severity || 'HIGH',
        }
        break
      
      case 'bashOutput':
        pointer = {
          type: 'bashOutput',
          command: req.command,
          executed: false,
        }
        break
      
      default:
        throw new Error(`Unknown requirement type: ${req.type}`)
    }
    
    impulses[impulseId] = {
      id: impulseId,
      type: req.type,
      pointer,
      priority: req.priority || 'medium',
      budget: req.budget || 2000,
      loaded: false,
      metadata: {
        source: 'template-requirements',
        requirement: req.description,
      },
    }
  }
  
  return impulses
}
```

---

## Part 4: Integration Points

### 4.1 Integration Hook Registration

**Location**: `turn-lifecycle-hooks.ts`

**Priority**: 5 (before memory-management hook at priority 10)

```typescript
/**
 * Memory Agent Skip Decision Hook
 *
 * Runs before memory-management hook (priority: 5 vs 10)
 * Decides if memory agent LLM call should be skipped
 * Executes fallback strategy if skip decision is made
 *
 * Design Decision: Pre-turn hook with priority 5
 * Why:
 *   - Runs BEFORE memory-management (priority 10) - intercepts LLM call
 *   - Fast decision (<50ms) - pattern lookup and rule checks
 *   - Non-blocking - uses fallback strategies
 *   - Tracks metrics - skip rate, success rate, time savings
 *
 * Skip Strategies:
 *   1. Trivial messages (do nothing)
 *   2. Continuations (keep existing impulses)
 *   3. Pattern match >85% confidence (replay impulses)
 *   4. Activity with contextRequirements (use template)
 *
 * Metrics Tracked:
 *   - Skip rate (target: 60-80%)
 *   - Success rate (must match baseline)
 *   - Time savings (memory agent overhead avoided)
 *   - Pattern effectiveness (replay success rate)
 */
TurnLifecycle.registerHook({
  name: "memory-agent-skip-decision",
  priority: 5, // Before memory-management (10)

  enabled: async (ctx) => {
    const config = await Config.get()

    // Only if impulse learning system is enabled
    if (!config.impulseLearning?.enabled) {
      return false
    }

    // Only for primary agents (not subagents)
    if (ctx.agent.mode !== "primary") {
      return false
    }

    // Need meaningful prompt to analyze
    if (ctx.promptText.length < 1) {
      return false
    }

    return true
  },

  execute: async (ctx) => {
    const start = Date.now()

    try {
      const { shouldSkipMemoryAgentLLM } = await import('./learning/skip-decision')
      const { SessionMemory } = await import('./session-memory')

      log.info("evaluating memory agent skip decision", {
        sessionID: ctx.sessionID,
        promptLength: ctx.promptText.length,
        turnNumber: ctx.metadata?.turnNumber || 0,
      })

      // Decide if we should skip
      const decision = await shouldSkipMemoryAgentLLM({
        sessionID: ctx.sessionID,
        promptText: ctx.promptText,
        turnNumber: ctx.metadata?.turnNumber || 0,
        agent: ctx.agent,
      })

      if (!decision.shouldSkip) {
        // No skip - let memory-management hook run normally
        log.debug("memory agent skip: no match, running LLM", {
          sessionID: ctx.sessionID,
          duration: decision.metadata.duration,
        })

        // Track decision (for metrics)
        await trackSkipDecision(ctx.sessionID, decision, null)

        return {
          success: true,
          modified: false,
          duration: Date.now() - start,
          metadata: {
            skipped: false,
            reason: decision.reason,
          },
        }
      }

      // Execute fallback strategy
      log.info("memory agent skip: executing fallback", {
        sessionID: ctx.sessionID,
        reason: decision.reason,
        confidence: decision.confidence,
        fallbackStrategy: decision.fallbackStrategy,
      })

      let fallbackResult: FallbackResult

      switch (decision.fallbackStrategy) {
        case 'do_nothing':
          fallbackResult = await fallback_doNothing({ sessionID: ctx.sessionID, decision })
          break

        case 'keep_existing':
          fallbackResult = await fallback_keepExisting({ sessionID: ctx.sessionID, decision })
          break

        case 'pattern_replay':
          fallbackResult = await fallback_patternReplay({ sessionID: ctx.sessionID, decision })
          break

        case 'template_requirements':
          fallbackResult = await fallback_templateRequirements({ sessionID: ctx.sessionID, decision })
          break

        default:
          throw new Error(`Unknown fallback strategy: ${decision.fallbackStrategy}`)
      }

      // Track decision and outcome
      await trackSkipDecision(ctx.sessionID, decision, fallbackResult)

      // Disable memory-management hook for this turn (skip already executed)
      // This prevents the LLM call from happening
      ctx.metadata = ctx.metadata || {}
      ctx.metadata.memoryAgentSkipped = true
      ctx.metadata.skipReason = decision.reason
      ctx.metadata.fallbackResult = fallbackResult

      const duration = Date.now() - start

      log.info("memory agent skip completed", {
        sessionID: ctx.sessionID,
        skipped: true,
        reason: decision.reason,
        confidence: decision.confidence,
        fallbackStrategy: decision.fallbackStrategy,
        impulsesCreated: fallbackResult.impulsesCreated,
        totalDuration: duration,
      })

      return {
        success: true,
        modified: fallbackResult.impulsesCreated > 0,
        duration,
        metadata: {
          skipped: true,
          reason: decision.reason,
          confidence: decision.confidence,
          fallbackStrategy: decision.fallbackStrategy,
          impulsesCreated: fallbackResult.impulsesCreated,
          impulsesLoaded: fallbackResult.impulsesLoaded,
          totalTokens: fallbackResult.totalTokens,
        },
      }
    } catch (error) {
      const duration = Date.now() - start

      log.error("memory agent skip decision failed", {
        sessionID: ctx.sessionID,
        error: error instanceof Error ? error.message : String(error),
        duration,
      })

      // Non-fatal: log and let memory-management hook run normally
      return {
        success: false,
        modified: false,
        duration,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  },
})
```

### 4.2 Memory Management Hook Update

**Location**: `turn-lifecycle-hooks.ts` (existing hook at priority 10)

**Update**: Check for skip flag before executing

```typescript
/**
 * Memory Management Hook (UPDATED)
 *
 * Runs before every turn (priority: 10)
 * Executes the manage-session-memory activity to prepare context
 *
 * UPDATE: Check if memory-agent-skip-decision hook already handled this turn
 */
TurnLifecycle.registerHook({
  name: "memory-management",
  priority: 10,

  enabled: async (ctx) => {
    const config = await Config.get()

    // Disabled in config?
    if (config.sessionMemory?.enabled === false) {
      return false
    }

    // Check if skip-decision hook already handled this turn
    if (ctx.metadata?.memoryAgentSkipped === true) {
      log.info("memory-management: skipped via skip-decision hook", {
        sessionID: ctx.sessionID,
        skipReason: ctx.metadata.skipReason,
      })
      return false // Skip this hook execution
    }

    // Only for primary agents (not subagents)
    if (ctx.agent.mode !== "primary") {
      return false
    }

    // Skip for very short messages (likely acknowledgments)
    if (ctx.promptText.length < 10) {
      return false
    }

    return true
  },

  execute: async (ctx) => {
    // ... existing implementation ...
    // (No changes to execute logic - only enabled() check updated)
  },
})
```

---

## Part 5: Tracking Schema

### 5.1 Memory Agent Performance Table

**Table**: `memory_agent_performance`

```sql
CREATE TABLE memory_agent_performance (
  -- Primary key
  id TEXT PRIMARY KEY,                    -- Unique record ID
  
  -- Session context
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  
  -- Skip decision
  skipped BOOLEAN NOT NULL,               -- Was memory agent skipped?
  skip_reason TEXT,                       -- trivial, continuation, pattern, activity, null
  skip_confidence REAL,                   -- 0-1
  fallback_strategy TEXT,                 -- do_nothing, keep_existing, pattern_replay, template_requirements
  
  -- Pattern info (if skip_reason = pattern)
  pattern_id TEXT,
  pattern_template TEXT,
  pattern_confidence REAL,
  variable_bindings TEXT,                 -- JSON object
  
  -- Activity info (if skip_reason = activity)
  activity_id TEXT,
  template_id TEXT,
  requirement_count INTEGER,
  
  -- Outcome
  impulses_created INTEGER NOT NULL,
  impulses_loaded INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  task_succeeded BOOLEAN,                 -- Did task succeed? (NULL = unknown/in-progress)
  response_quality REAL,                  -- 0-1 (NULL = no feedback yet)
  
  -- Performance metrics
  decision_duration_ms REAL NOT NULL,     -- Time to make skip decision
  fallback_duration_ms REAL,              -- Time to execute fallback
  total_duration_ms REAL NOT NULL,        -- Total time (decision + fallback)
  llm_time_saved_ms REAL,                 -- Estimated LLM time saved (if skipped)
  
  -- Timestamps
  captured_at INTEGER NOT NULL,           -- Unix timestamp (ms)
  
  -- Indexes for analytics
  INDEX idx_session_turn (session_id, turn_number),
  INDEX idx_skipped (skipped),
  INDEX idx_skip_reason (skip_reason),
  INDEX idx_pattern_id (pattern_id),
  INDEX idx_captured_at (captured_at DESC)
);
```

### 5.2 Tracking Function

```typescript
/**
 * Track skip decision for learning and metrics
 */
async function trackSkipDecision(
  sessionID: string,
  decision: SkipDecision,
  fallbackResult: FallbackResult | null
): Promise<void> {
  
  const { LearningDatabase } = await import('./learning/learning-database')
  
  // Calculate LLM time saved (if skipped)
  const llmTimeSaved = decision.shouldSkip 
    ? estimateLLMTimeSaved(decision.reason)
    : 0
  
  // Build tracking record
  const record = {
    id: generateRecordId(),
    session_id: sessionID,
    turn_number: await getCurrentTurnNumber(sessionID),
    user_message: await getLastUserMessage(sessionID),
    agent_name: 'general', // TODO: Get from context
    
    // Skip decision
    skipped: decision.shouldSkip,
    skip_reason: decision.reason,
    skip_confidence: decision.confidence,
    fallback_strategy: decision.fallbackStrategy,
    
    // Pattern info
    pattern_id: decision.metadata.patternId || null,
    pattern_template: decision.metadata.template || null,
    pattern_confidence: decision.metadata.patternId ? decision.confidence : null,
    variable_bindings: decision.metadata.variableBindings 
      ? JSON.stringify(decision.metadata.variableBindings) 
      : null,
    
    // Activity info
    activity_id: decision.metadata.activityId || null,
    template_id: decision.metadata.templateId || null,
    requirement_count: decision.metadata.requirementCount || null,
    
    // Outcome
    impulses_created: fallbackResult?.impulsesCreated || 0,
    impulses_loaded: fallbackResult?.impulsesLoaded || 0,
    total_tokens: fallbackResult?.totalTokens || 0,
    task_succeeded: null, // Will be updated after task completes
    response_quality: null, // Will be updated after user feedback
    
    // Performance
    decision_duration_ms: decision.metadata.duration,
    fallback_duration_ms: fallbackResult?.duration || null,
    total_duration_ms: decision.metadata.duration + (fallbackResult?.duration || 0),
    llm_time_saved_ms: llmTimeSaved,
    
    // Timestamp
    captured_at: Date.now(),
  }
  
  // Insert into database
  await LearningDatabase.insertPerformanceRecord(record)
  
  log.debug('skip decision tracked', {
    sessionID,
    recordId: record.id,
    skipped: record.skipped,
    skipReason: record.skip_reason,
  })
}

/**
 * Estimate LLM time saved based on skip reason
 */
function estimateLLMTimeSaved(skipReason: SkipReason): number {
  // Estimates based on average memory agent LLM call times
  switch (skipReason) {
    case 'trivial_message':
      return 1500 // 1.5 seconds
    case 'continuation':
      return 1500 // 1.5 seconds
    case 'pattern_match':
      return 2000 // 2 seconds
    case 'activity_context':
      return 1800 // 1.8 seconds
    default:
      return 0
  }
}
```

### 5.3 Analytics Queries

**Query 1: Skip Rate Over Time**
```sql
-- Skip rate per day (last 30 days)
SELECT 
  DATE(captured_at / 1000, 'unixepoch') as date,
  COUNT(*) as total_turns,
  SUM(CASE WHEN skipped THEN 1 ELSE 0 END) as skipped_turns,
  ROUND(100.0 * SUM(CASE WHEN skipped THEN 1 ELSE 0 END) / COUNT(*), 2) as skip_rate,
  ROUND(AVG(llm_time_saved_ms), 0) as avg_time_saved_ms
FROM memory_agent_performance
WHERE captured_at > (strftime('%s', 'now') - 30 * 86400) * 1000
GROUP BY date
ORDER BY date DESC;
```

**Query 2: Skip Reason Breakdown**
```sql
-- Skip reason distribution and effectiveness
SELECT 
  skip_reason,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  ROUND(AVG(skip_confidence), 3) as avg_confidence,
  ROUND(AVG(total_duration_ms), 0) as avg_duration_ms,
  SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) as successes,
  COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) / 
    NULLIF(COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END), 0), 2) as success_rate
FROM memory_agent_performance
WHERE skipped = 1
GROUP BY skip_reason
ORDER BY count DESC;
```

**Query 3: Time Savings**
```sql
-- Total time saved by skipping
SELECT 
  COUNT(*) as total_skips,
  ROUND(SUM(llm_time_saved_ms) / 1000, 2) as total_seconds_saved,
  ROUND(SUM(llm_time_saved_ms) / 1000 / 60, 2) as total_minutes_saved,
  ROUND(AVG(llm_time_saved_ms), 0) as avg_ms_saved_per_skip
FROM memory_agent_performance
WHERE skipped = 1;
```

**Query 4: Pattern Effectiveness**
```sql
-- Pattern replay success rate
SELECT 
  pattern_id,
  pattern_template,
  COUNT(*) as times_used,
  ROUND(AVG(pattern_confidence), 3) as avg_confidence,
  SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) as successes,
  COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) / 
    NULLIF(COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END), 0), 2) as success_rate
FROM memory_agent_performance
WHERE skip_reason = 'pattern_match'
  AND pattern_id IS NOT NULL
GROUP BY pattern_id
ORDER BY times_used DESC, success_rate DESC
LIMIT 20;
```

---

## Part 6: Success Metrics

### 6.1 Target Metrics

**Primary Goal**: Skip 60-80% of memory agent LLM calls while maintaining quality

**Metrics to Track**:

1. **Skip Rate**:
   - Target: 60-80%
   - Formula: `(skipped_turns / total_turns) * 100`
   - Track daily, weekly, monthly

2. **Success Rate** (quality maintained):
   - Target: >= baseline (memory agent with LLM)
   - Formula: `(successful_tasks / completed_tasks) * 100`
   - Track per skip reason

3. **Time Savings**:
   - Target: 85-90% reduction in memory agent overhead
   - Formula: `SUM(llm_time_saved_ms) / total_turns`
   - Track cumulative savings

4. **Pattern Effectiveness**:
   - Target: >80% success rate for pattern replays
   - Formula: `(pattern_replay_successes / pattern_replay_uses) * 100`
   - Track per pattern

### 6.2 Monitoring Dashboard Query

```sql
-- Complete skip decision dashboard
WITH skip_stats AS (
  SELECT 
    COUNT(*) as total_turns,
    SUM(CASE WHEN skipped THEN 1 ELSE 0 END) as skipped_turns,
    SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) as successful_tasks,
    COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END) as completed_tasks,
    SUM(llm_time_saved_ms) as total_time_saved_ms
  FROM memory_agent_performance
  WHERE captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000 -- Last 7 days
)
SELECT 
  total_turns,
  skipped_turns,
  ROUND(100.0 * skipped_turns / total_turns, 2) as skip_rate,
  completed_tasks,
  successful_tasks,
  ROUND(100.0 * successful_tasks / completed_tasks, 2) as success_rate,
  ROUND(total_time_saved_ms / 1000 / 60, 2) as minutes_saved,
  ROUND(total_time_saved_ms / total_turns, 0) as avg_ms_saved_per_turn
FROM skip_stats;
```

---

## Summary

This document provides complete skip decision logic with:

1. ✅ **4 Skip Rules**: Trivial, continuation, pattern match, activity context
2. ✅ **4 Fallback Strategies**: Do nothing, keep existing, pattern replay, template requirements
3. ✅ **Integration Points**: Pre-turn hook at priority 5, memory-management hook update
4. ✅ **Tracking Schema**: `memory_agent_performance` table with 20+ fields
5. ✅ **Analytics Queries**: Skip rate, effectiveness, time savings, pattern success
6. ✅ **Decision Tree**: Visual diagram showing all skip paths

**Implementation Order**:
1. Implement skip decision function (shouldSkipMemoryAgentLLM)
2. Implement fallback strategies
3. Register skip-decision hook at priority 5
4. Update memory-management hook to check skip flag
5. Create tracking database table
6. Implement tracking function
7. Test on sample sessions
8. Monitor skip rate and success rate
9. Tune confidence thresholds if needed

**Expected Outcome**: 60-80% skip rate with quality maintained, saving 85-90% of memory agent overhead time.
