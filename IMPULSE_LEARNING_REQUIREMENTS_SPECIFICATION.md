# Impulse Learning Requirements Specification

**Date**: 2026-02-25  
**Goal**: Learn impulse-context mappings to skip memory agent LLM calls  
**Target**: 60-80% reduction in memory agent overhead through pattern learning

---

## Executive Summary

This document specifies the requirements for implementing a learning system that captures successful impulse-context mappings and replays them without LLM calls. The system learns through **observation** of what works, building a pattern library that eliminates the need for per-turn intent analysis.

### Learning Philosophy: Skip by Replaying Success

```
Learning Phase:
  User message → Memory agent LLM call → Create impulses → Task succeeds
  → CAPTURE: { userPattern, impulseMapping, successMetrics }

Skip Phase:
  User message → Pattern match (no LLM) → Replay impulses → Task succeeds
  → VALIDATE: Success rate maintains above threshold
```

---

## Part 1: Data Capture Requirements

### 1.1 What to Capture Per Turn

Every time the memory agent runs successfully, capture:

```typescript
interface ImpulseMappingRecord {
  // Input pattern
  userIntent: {
    rawText: string                  // Original user message
    normalizedPattern: string        // Pattern with variables replaced
    intentType: string               // code_fix, feature_request, etc.
    confidence: number               // 0-1 from intent analysis
  }
  
  // Context at capture time
  context: {
    recentFiles: string[]            // Files modified in last 5 turns
    activeSession: string            // Session ID
    turnNumber: number               // Turn in session
    timestamp: number                // Capture time
  }
  
  // Impulses created (THE KEY DATA)
  impulses: Array<{
    id: string                       // Impulse ID
    type: string                     // file, bashOutput, memo, etc.
    pointer: ImpulsePointer          // Full pointer object
    priority: "high" | "medium" | "low"
    budget: number                   // Token budget
    created: boolean                 // Was it created?
    loaded: boolean                  // Was it loaded?
    used: boolean                    // Was it referenced in response?
  }>
  
  // Outcome metrics (for validation)
  outcome: {
    taskSucceeded: boolean           // Did the task complete successfully?
    responseQuality: number          // 0-1 (user feedback if available)
    impulsesUsedCount: number        // How many impulses were actually used
    timeToSuccess: number            // Time to task completion
  }
  
  // Learning metadata
  metadata: {
    capturedAt: number               // Timestamp
    capturedBy: "session-memory-agent"
    recordId: string                 // Unique record ID
    sessionID: string                // Parent session
  }
}
```

### 1.2 Where to Capture

**Capture Point 1: After Intent Analysis**
- Location: `memory-agent.ts` → `analyzeIntent()` → after LLM call
- Capture: `userIntent` fields
- Storage: In-memory buffer (not persisted yet)

**Capture Point 2: After Impulse Creation**
- Location: `memory-agent.ts` → `prepare()` → after impulse loop
- Capture: `impulses` array with created/loaded status
- Storage: Append to buffer

**Capture Point 3: After Task Completion**
- Location: `activity.ts` → `executeTask()` → after success/failure
- Capture: `outcome` metrics, impulse usage tracking
- Storage: **PERSIST** full record to learning database

**Capture Point 4: After Activity Execution**
- Location: `activity.ts` → `execute()` → after all tasks complete
- Capture: Activity-level context mapping
- Storage: Persist activity-impulse mapping

### 1.3 How to Track Impulse Usage

**Problem**: Need to know if an impulse was "used" (referenced in agent response)

**Solution**: Parse agent response for impulse references

```typescript
async function trackImpulseUsage(
  response: string,
  impulses: Record<string, Impulse.Schema>
): Promise<Record<string, boolean>> {
  const usageMap: Record<string, boolean> = {}
  
  for (const [id, impulse] of Object.entries(impulses)) {
    // Check if response references impulse content
    if (impulse.loaded && impulse.content) {
      // Simple heuristic: does response contain unique strings from impulse?
      const contentSnippets = extractUniqueSnippets(impulse.content, 3)
      const isUsed = contentSnippets.some(snippet => 
        response.includes(snippet)
      )
      usageMap[id] = isUsed
    } else {
      usageMap[id] = false
    }
  }
  
  return usageMap
}
```

---

## Part 2: Pattern Learning Requirements

### 2.1 Pattern Extraction

**Goal**: Convert user messages into reusable patterns

```typescript
interface UserPattern {
  // Raw pattern (with variables)
  template: string                   // "Fix bug in {file}"
  variables: string[]                // ["file"]
  
  // Normalized representation
  normalized: string                 // "fix_bug_in_X"
  intentType: string                 // "code_fix"
  
  // Learned impulse mappings
  impulseMapping: {
    templateType: string             // "file", "bashOutput", etc.
    relativeToVariable?: string      // Which variable determines the path
    pathTransform?: string           // How to transform variable to path
    priority: "high" | "medium" | "low"
    budget: number
  }[]
  
  // Pattern strength metrics
  metrics: {
    observationCount: number         // Times seen
    successRate: number              // Success rate when using this pattern
    avgResponseTime: number          // Average time to success
    lastUsed: number                 // Timestamp of last use
  }
}
```

**Pattern Extraction Algorithm**:

```typescript
function extractPattern(userMessage: string): UserPattern {
  // Step 1: Normalize (lowercase, remove punctuation)
  const normalized = userMessage.toLowerCase().replace(/[^\w\s]/g, '')
  
  // Step 2: Detect variables (file paths, names, etc.)
  const variables: string[] = []
  let template = normalized
  
  // Detect file paths
  const filePathRegex = /\b[\w\-\.\/]+\.[\w]+\b/g
  let match
  while ((match = filePathRegex.exec(normalized)) !== null) {
    const varName = `file${variables.length}`
    variables.push(varName)
    template = template.replace(match[0], `{${varName}}`)
  }
  
  // Detect identifiers (function names, class names)
  const identifierRegex = /\b[A-Z][a-zA-Z0-9_]+\b/g
  while ((match = identifierRegex.exec(normalized)) !== null) {
    const varName = `identifier${variables.length}`
    variables.push(varName)
    template = template.replace(match[0], `{${varName}}`)
  }
  
  // Step 3: Create normalized key
  const normalizedKey = template.replace(/\s+/g, '_')
  
  return { template, variables, normalized: normalizedKey }
}
```

### 2.2 Pattern Matching

**Goal**: Match new user messages against learned patterns

```typescript
interface PatternMatch {
  pattern: UserPattern
  confidence: number                 // 0-1 (how well does it match)
  variableBindings: Record<string, string>  // Variable assignments
}

function matchPattern(
  userMessage: string,
  learnedPatterns: UserPattern[]
): PatternMatch | null {
  const messagePattern = extractPattern(userMessage)
  
  // Find best matching pattern
  let bestMatch: PatternMatch | null = null
  let bestScore = 0
  
  for (const pattern of learnedPatterns) {
    // Compute similarity score
    const score = computeSimilarity(
      messagePattern.normalized,
      pattern.normalized
    )
    
    if (score > bestScore && score > 0.75) { // 75% threshold
      // Extract variable bindings
      const bindings = extractBindings(userMessage, pattern)
      
      bestMatch = {
        pattern,
        confidence: score,
        variableBindings: bindings
      }
      bestScore = score
    }
  }
  
  return bestMatch
}
```

### 2.3 Impulse Replay

**Goal**: Replay impulse creation without LLM call

```typescript
async function replayImpulsesFromPattern(
  match: PatternMatch,
  sessionID: string
): Promise<Record<string, Impulse.Schema>> {
  const impulses: Record<string, Impulse.Schema> = {}
  let impulseCount = 0
  
  // For each learned impulse mapping
  for (const mapping of match.pattern.impulseMapping) {
    const impulseId = `replay-${impulseCount++}`
    
    // Transform variable to actual path/content
    let pointer: ImpulsePointer
    
    if (mapping.templateType === 'file' && mapping.relativeToVariable) {
      // Get variable value
      const variableValue = match.variableBindings[mapping.relativeToVariable]
      
      // Apply path transform
      const filePath = applyTransform(
        variableValue,
        mapping.pathTransform || 'identity'
      )
      
      pointer = { type: 'file', path: filePath }
    } else if (mapping.templateType === 'bashOutput') {
      // Similar for bash commands
      pointer = { type: 'bashOutput', command: mapping.command }
    }
    // ... other types
    
    impulses[impulseId] = {
      id: impulseId,
      type: mapping.templateType,
      pointer,
      priority: mapping.priority,
      budget: mapping.budget,
      loaded: false,
      metadata: {
        source: 'pattern-replay',
        pattern: match.pattern.normalized,
        confidence: match.confidence
      }
    }
  }
  
  return impulses
}
```

---

## Part 3: Skip Conditions & Decision Logic

### 3.1 When to Skip Memory Agent LLM Call

**Decision tree**:

```typescript
async function shouldSkipMemoryAgentLLM(
  userMessage: string,
  sessionContext: SessionContext
): Promise<{ skip: boolean; reason: string; fallback?: string }> {
  
  // Rule 1: Trivial messages (no context needed)
  if (isTrivial(userMessage)) {
    return { skip: true, reason: 'trivial-message' }
  }
  
  // Rule 2: Continuations (reuse existing impulses)
  if (isContinuation(userMessage)) {
    return { skip: true, reason: 'continuation' }
  }
  
  // Rule 3: Pattern match with high confidence
  const match = await matchPattern(userMessage, getLearnedPatterns())
  if (match && match.confidence > 0.85) {
    // Check pattern success rate
    if (match.pattern.metrics.successRate > 0.75) {
      return { 
        skip: true, 
        reason: 'pattern-match',
        fallback: 'use-pattern-replay' 
      }
    }
  }
  
  // Rule 4: Activity with contextRequirements (use template)
  if (sessionContext.executingActivity) {
    const activity = sessionContext.executingActivity
    if (activity.template.contextRequirements?.length > 0) {
      return { 
        skip: true, 
        reason: 'activity-template',
        fallback: 'use-template-requirements' 
      }
    }
  }
  
  // Default: Run memory agent LLM
  return { skip: false, reason: 'no-pattern-match' }
}

function isTrivial(message: string): boolean {
  const trivialPatterns = [
    /^(hi|hello|hey|thanks?|ok|got it|yes|no)$/i,
    /^.{1,10}$/  // Very short messages
  ]
  return trivialPatterns.some(pattern => pattern.test(message.trim()))
}

function isContinuation(message: string): boolean {
  const continuationPatterns = [
    /^(continue|go on|next|proceed|keep going)$/i
  ]
  return continuationPatterns.some(pattern => pattern.test(message.trim()))
}
```

### 3.2 Fallback Strategies

When skipping, use these fallback strategies:

**Strategy 1: Pattern Replay**
```typescript
const impulses = await replayImpulsesFromPattern(match, sessionID)
await SessionMemory.addImpulses(sessionID, impulses)
```

**Strategy 2: Template Requirements**
```typescript
const impulses = await Activity.createImpulsesFromRequirements(
  activityID,
  template.contextRequirements
)
```

**Strategy 3: Keep Existing**
```typescript
// Do nothing - reuse impulses from previous turn
// (used for continuations)
```

---

## Part 4: Learning Loop Integration

### 4.1 Learning Loop Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TURN LIFECYCLE HOOK (Pre-Prompt)                           │
│                                                             │
│ 1. Check Skip Conditions                                   │
│    shouldSkipMemoryAgentLLM(userMessage)                   │
│                                                             │
│ 2a. IF SKIP:                                               │
│     - Use pattern replay OR template requirements          │
│     - Create impulses without LLM call                     │
│     - Track skip (increment skipCount metric)              │
│                                                             │
│ 2b. IF NO SKIP:                                            │
│     - Run memory agent LLM call (current behavior)         │
│     - Capture mapping for learning                         │
│     - Track LLM call (increment llmCallCount metric)       │
│                                                             │
│ 3. Load high-priority impulses                            │
│                                                             │
│ 4. Continue to main agent                                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Storage Schema

**Learning Database Table**: `impulse_pattern_mappings`

```sql
CREATE TABLE impulse_pattern_mappings (
  id TEXT PRIMARY KEY,
  
  -- Pattern
  pattern_template TEXT NOT NULL,
  pattern_normalized TEXT NOT NULL,
  pattern_variables TEXT NOT NULL,  -- JSON array
  intent_type TEXT NOT NULL,
  
  -- Impulse mapping (JSON)
  impulse_mapping TEXT NOT NULL,    -- JSON array of mappings
  
  -- Metrics
  observation_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  avg_response_time_ms REAL DEFAULT 0.0,
  
  -- Timestamps
  first_observed DATETIME NOT NULL,
  last_used DATETIME NOT NULL,
  
  -- Indexes
  INDEX idx_pattern_normalized (pattern_normalized),
  INDEX idx_intent_type (intent_type),
  INDEX idx_success_rate (success_rate),
  INDEX idx_last_used (last_used)
)
```

**Tracking Table**: `memory_agent_performance`

```sql
CREATE TABLE memory_agent_performance (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  
  -- Decision
  skipped_llm BOOLEAN NOT NULL,
  skip_reason TEXT,              -- "pattern-match", "trivial", etc.
  pattern_id TEXT,               -- Reference to pattern used (if skipped)
  
  -- Performance
  time_ms REAL NOT NULL,         -- Time taken (with or without LLM)
  impulse_count INTEGER NOT NULL,
  
  -- Outcome
  task_succeeded BOOLEAN,
  
  -- Timestamp
  recorded_at DATETIME NOT NULL,
  
  INDEX idx_session (session_id),
  INDEX idx_skipped (skipped_llm),
  INDEX idx_recorded (recorded_at)
)
```

### 4.3 Learning Algorithm

**Update Pattern on Success**:

```typescript
async function updatePatternOnSuccess(
  recordId: string,
  responseTime: number
): Promise<void> {
  const record = await db.get('impulse_pattern_mappings', recordId)
  
  // Update metrics
  const newSuccessCount = record.success_count + 1
  const newObservationCount = record.observation_count + 1
  const newSuccessRate = newSuccessCount / newObservationCount
  
  // Update average response time (exponential moving average)
  const alpha = 0.2  // Smoothing factor
  const newAvgTime = alpha * responseTime + (1 - alpha) * record.avg_response_time_ms
  
  await db.update('impulse_pattern_mappings', recordId, {
    success_count: newSuccessCount,
    observation_count: newObservationCount,
    success_rate: newSuccessRate,
    avg_response_time_ms: newAvgTime,
    last_used: Date.now()
  })
}
```

**Update Pattern on Failure**:

```typescript
async function updatePatternOnFailure(recordId: string): Promise<void> {
  const record = await db.get('impulse_pattern_mappings', recordId)
  
  const newFailureCount = record.failure_count + 1
  const newObservationCount = record.observation_count + 1
  const newSuccessRate = record.success_count / newObservationCount
  
  await db.update('impulse_pattern_mappings', recordId, {
    failure_count: newFailureCount,
    observation_count: newObservationCount,
    success_rate: newSuccessRate,
    last_used: Date.now()
  })
  
  // If success rate drops below threshold, mark pattern as unreliable
  if (newSuccessRate < 0.5 && newObservationCount > 5) {
    await db.update('impulse_pattern_mappings', recordId, {
      metadata: { ...record.metadata, unreliable: true }
    })
  }
}
```

---

## Part 5: Activity Template Integration

### 5.1 Learning from contextRequirements

**Goal**: When activities execute with `contextRequirements`, capture the successful impulse mappings for future skipping.

```typescript
// In activity execution
async function executeActivityWithLearning(
  template: ActivityTemplate.Schema,
  variables: Record<string, any>
): Promise<void> {
  // If template has contextRequirements
  if (template.contextRequirements && template.contextRequirements.length > 0) {
    
    // Current: Call gatherContext (uses LLM)
    const impulses = await SessionMemoryAgent.gatherContext({
      requirements: template.contextRequirements,
      reason: template.name,
      recentMessages: []
    })
    
    // NEW: Capture mapping for learning
    await captureLearningData({
      activityTemplate: template.id,
      activityName: template.name,
      activityReason: `Activity: ${template.name}`,
      contextRequirements: template.contextRequirements,
      resolvedImpulses: impulses,
      variables: variables
    })
    
    // Continue with execution...
  }
}
```

### 5.2 Skip gatherContext When Learned

```typescript
async function executeActivityOptimized(
  template: ActivityTemplate.Schema,
  variables: Record<string, any>
): Promise<void> {
  
  if (template.contextRequirements && template.contextRequirements.length > 0) {
    
    // Check if we have a learned mapping for this activity
    const learnedMapping = await getLearnedActivityMapping(
      template.id,
      variables
    )
    
    if (learnedMapping && learnedMapping.confidence > 0.85) {
      // SKIP gatherContext LLM call
      // Replay impulses from learned mapping
      const impulses = await replayActivityImpulses(
        learnedMapping,
        variables
      )
      
      log.info('skipped gatherContext (using learned mapping)', {
        activity: template.id,
        confidence: learnedMapping.confidence
      })
      
      return impulses
    } else {
      // No learned mapping, use gatherContext (LLM)
      return await SessionMemoryAgent.gatherContext({
        requirements: template.contextRequirements,
        reason: template.name,
        recentMessages: []
      })
    }
  }
}
```

---

## Part 6: Validation & Metrics

### 6.1 Success Metrics

Track these metrics to validate learning effectiveness:

```typescript
interface LearningMetrics {
  // Skip rates
  totalTurns: number
  turnsWithLLM: number
  turnsSkipped: number
  skipRate: number                   // turnsSkipped / totalTurns
  
  // Skip reasons breakdown
  skipReasons: Record<string, number>  // { "pattern-match": 120, "trivial": 45, ... }
  
  // Performance
  avgTimeWithLLM: number             // Average time when LLM called
  avgTimeSkipped: number             // Average time when skipped
  timeSavings: number                // (avgTimeWithLLM - avgTimeSkipped) * turnsSkipped
  
  // Pattern effectiveness
  patternCount: number               // Total patterns learned
  patternsUsed: number               // Patterns actually used in skips
  patternUtilization: number         // patternsUsed / patternCount
  
  // Quality
  skipSuccessRate: number            // Success rate when skipping
  llmSuccessRate: number             // Success rate when using LLM
  qualityDelta: number               // skipSuccessRate - llmSuccessRate (should be >= 0)
}
```

### 6.2 Monitoring Dashboard Queries

**Query 1: Skip Rate Over Time**
```sql
SELECT 
  DATE(recorded_at) as date,
  COUNT(*) as total_turns,
  SUM(CASE WHEN skipped_llm THEN 1 ELSE 0 END) as skipped,
  ROUND(100.0 * SUM(CASE WHEN skipped_llm THEN 1 ELSE 0 END) / COUNT(*), 2) as skip_rate
FROM memory_agent_performance
GROUP BY DATE(recorded_at)
ORDER BY date DESC
LIMIT 30
```

**Query 2: Skip Reason Breakdown**
```sql
SELECT 
  skip_reason,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  ROUND(AVG(time_ms), 2) as avg_time_ms
FROM memory_agent_performance
WHERE skipped_llm = TRUE
GROUP BY skip_reason
ORDER BY count DESC
```

**Query 3: Pattern Effectiveness**
```sql
SELECT 
  p.pattern_normalized,
  p.observation_count,
  p.success_count,
  p.success_rate,
  p.avg_response_time_ms,
  COUNT(m.id) as times_used
FROM impulse_pattern_mappings p
LEFT JOIN memory_agent_performance m ON m.pattern_id = p.id
GROUP BY p.id
ORDER BY p.success_rate DESC, p.observation_count DESC
LIMIT 20
```

---

## Part 7: Implementation Phases

### Phase 1: Data Capture (Week 1)

**Tasks**:
1. Add capture points in `memory-agent.ts`
2. Create `ImpulseMappingRecord` storage
3. Track impulse usage in responses
4. Persist records to database

**Deliverables**:
- Data flowing to learning database
- Impulse usage tracking working
- Metrics dashboard showing capture rate

### Phase 2: Pattern Learning (Week 2)

**Tasks**:
1. Implement pattern extraction algorithm
2. Build pattern matching engine
3. Create impulse replay logic
4. Test pattern accuracy

**Deliverables**:
- Pattern library growing from captures
- Pattern matching achieving >80% accuracy
- Replay logic generating correct impulses

### Phase 3: Skip Integration (Week 3)

**Tasks**:
1. Add skip decision logic to turn lifecycle
2. Implement fallback strategies
3. Track skip metrics
4. Validate quality maintained

**Deliverables**:
- Skip rate reaching 20-30% (trivial + continuations)
- Task success rate maintained at baseline
- Performance improvement measured

### Phase 4: Activity Template Learning (Week 4)

**Tasks**:
1. Capture activity-impulse mappings
2. Skip `gatherContext` when learned
3. Validate activity execution quality
4. Monitor skip rate for activities

**Deliverables**:
- Activities skip LLM calls when confident
- Skip rate reaching 60-80% overall
- 85-90% reduction in memory agent overhead

---

## Part 8: Validation Checklist

### Before Deployment

- [ ] Data capture points instrumented and tested
- [ ] Learning database schema created and indexed
- [ ] Pattern extraction produces accurate templates
- [ ] Pattern matching achieves >80% accuracy on test set
- [ ] Impulse replay generates correct impulses
- [ ] Skip decision logic covers all cases
- [ ] Fallback strategies handle edge cases
- [ ] Metrics dashboard shows real-time skip rate
- [ ] Quality validation: skip success rate >= LLM success rate
- [ ] Performance validation: time savings measured

### After Deployment (Continuous)

- [ ] Monitor skip rate weekly (target: 60-80%)
- [ ] Monitor quality delta (target: >= 0%)
- [ ] Review low-performing patterns monthly
- [ ] Prune unreliable patterns (success rate < 50%)
- [ ] Audit learning database size (prevent unbounded growth)
- [ ] Collect user feedback on response quality

---

## Part 9: Activity Templates for Tracing & Enforcement

### Activity 1: Trace Learning Requirements

**Purpose**: Systematically trace all data capture points, learning algorithms, and skip conditions

**Tasks**:
1. Trace data capture points (memory-agent.ts, activity.ts)
2. Document pattern learning algorithm requirements
3. Trace skip decision integration points
4. Validate learning database schema

### Activity 2: Enforce Learning Loop

**Purpose**: Implement and enforce the learning loop in code

**Tasks**:
1. Implement data capture hooks
2. Implement pattern learning engine
3. Implement skip decision logic
4. Wire up to turn lifecycle hooks
5. Create monitoring dashboard

### Activity 3: Validate Learning Effectiveness

**Purpose**: Validate that learning is working (skip rate, quality maintained)

**Tasks**:
1. Run test sessions with learning enabled
2. Measure skip rate over 100 turns
3. Compare success rates (skip vs LLM)
4. Analyze pattern utilization
5. Generate effectiveness report

---

## Summary

This specification defines a complete learning system for impulse-context mappings that:

1. **Captures** successful mappings through observation
2. **Learns** patterns by analyzing captured data
3. **Skips** memory agent LLM calls when confident
4. **Validates** quality is maintained through metrics
5. **Optimizes** toward 60-80% skip rate target

The system learns **by observing what works** and **replaying successful patterns**, eliminating the need for per-turn LLM analysis while maintaining response quality.

**Key Success Criteria**:
- ✅ Skip rate: 60-80%
- ✅ Quality maintained: skip success rate >= baseline
- ✅ Time savings: 85-90% reduction in memory agent overhead
- ✅ Pattern coverage: >80% of common intents covered by patterns

**Implementation Timeline**: 4 weeks (1 phase per week)

**Risk Mitigation**: Start with conservative skip thresholds (confidence > 0.85, success rate > 0.75), gradually relax as confidence grows.
