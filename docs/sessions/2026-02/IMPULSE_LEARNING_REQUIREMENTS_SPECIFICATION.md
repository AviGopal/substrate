# Impulse Learning System: Complete Learning Loop Architecture

**Date**: 2026-02-25  
**Purpose**: Complete architecture specification for the impulse learning system's feedback loop, storage, and continuous improvement

---

## Executive Summary

This document specifies the complete learning loop architecture that enables the impulse learning system to continuously improve pattern accuracy and skip rate. The system learns from outcomes, updates pattern metrics, prunes unreliable patterns, and adapts to changing user behavior.

**Core Components**:
1. **Data Flow**: Turn lifecycle → Capture → Learning DB → Pattern Library → Skip Decision → Turn lifecycle
2. **Storage Architecture**: 3 tables with efficient indexing and pruning strategies
3. **Learning Algorithms**: Success/failure updates with exponential moving averages
4. **Activity Integration**: Learn from contextRequirements, skip gatherContext when confident

**Success Metric**: Continuous improvement toward 60-80% skip rate with quality maintained

---

## Part 1: Data Flow Architecture

### 1.1 Complete System Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMPULSE LEARNING SYSTEM                              │
│                           Complete Data Flow                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                                    USER MESSAGE
                                         │
                                         ▼
         ┌───────────────────────────────────────────────────────┐
         │  TURN LIFECYCLE START                                 │
         │  • Parse user message                                 │
         │  • Extract session context                            │
         └───────────────┬───────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────────────────────────┐
         │  SKIP DECISION (Priority Hook: 5)                     │
         │  • shouldSkipMemoryAgentLLM()                         │
         │  • Check trivial, continuation, pattern, activity     │
         │  • Confidence threshold: 0.85                         │
         └───────────────┬───────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         SKIP │                     │ NO SKIP
              ▼                     ▼
    ┌──────────────────┐   ┌────────────────────────┐
    │ FALLBACK         │   │ MEMORY AGENT LLM       │
    │ STRATEGY         │   │ (Priority Hook: 10)    │
    │                  │   │                        │
    │ • Pattern Replay │   │ • analyzeIntent()      │
    │ • Template Reqs  │   │ • prepare()            │
    │ • Keep Existing  │   │ • Create impulses      │
    │ • Do Nothing     │   │                        │
    └─────────┬────────┘   └────────┬───────────────┘
              │                     │
              │ ┌───────────────────┘
              │ │
              ▼ ▼
    ┌─────────────────────────────────────────────┐
    │ IMPULSE CREATION                            │
    │ • File impulses                             │
    │ • Bash output impulses                      │
    │ • Metabob issue impulses                    │
    │ • Memo impulses                             │
    │ • Load high-priority impulses               │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ CAPTURE POINT 1: Intent + Impulses          │
    │ • User intent (type, confidence)            │
    │ • Impulses created                          │
    │ • Session context (recent files)            │
    │ → Store in LearningBuffer (in-memory)       │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ MAIN AGENT EXECUTION                        │
    │ • Generate response                         │
    │ • Execute tools                             │
    │ • Track tool usage                          │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ CAPTURE POINT 2: Response + Usage           │
    │ • Response text                             │
    │ • Impulses used (snippet matching)          │
    │ • Response time                             │
    │ → Append to LearningBuffer                  │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ CAPTURE POINT 3: Task Outcome               │
    │ • Task succeeded/failed                     │
    │ • Error messages (if failed)                │
    │ • Total cost, tokens                        │
    │ → Flush to LEARNING DATABASE                │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ LEARNING DATABASE                           │
    │                                             │
    │ Tables:                                     │
    │ • impulse_mapping_records (raw data)        │
    │ • pattern_library (learned patterns)        │
    │ • memory_agent_performance (tracking)       │
    │                                             │
    │ Operations:                                 │
    │ • Insert mapping record                     │
    │ • Update pattern metrics                    │
    │ • Track skip decision                       │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ PATTERN LEARNING ENGINE                     │
    │                                             │
    │ • Extract pattern from user message         │
    │ • Check if pattern exists                   │
    │   - YES: Update metrics (success/failure)   │
    │   - NO: Create new pattern                  │
    │ • Update impulse mappings                   │
    │ • Calculate success rate                    │
    │ • Mark unreliable if <50% success           │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │ PATTERN LIBRARY                             │
    │ • Active patterns (success_rate >= 0.75)    │
    │ • Used by skip decision hook                │
    │ • Pruned periodically (remove old/bad)      │
    └──────────────────┬──────────────────────────┘
                       │
                       │ FEEDBACK LOOP
                       └──────────────────────────┐
                                                  │
                                                  ▼
                                    NEXT TURN (SKIP DECISION)
                                    • Query pattern library
                                    • Match with confidence
                                    • Skip if confidence > 0.85
```

### 1.2 Feedback Loop Details

**Primary Feedback Loop**:
```
Capture → Learn → Update Metrics → Skip Decision → Capture (repeat)
```

**Loop Components**:

1. **Capture Phase**: Turn-level data collection
   - Intent analysis results
   - Impulses created/loaded
   - Response generation
   - Impulse usage detection
   - Task outcome

2. **Learn Phase**: Pattern extraction and storage
   - Extract pattern from user message
   - Identify variables (files, identifiers)
   - Map impulses to pattern
   - Store in learning database

3. **Update Phase**: Metrics calculation
   - Success/failure tracking
   - Success rate calculation
   - Response time averaging
   - Pattern reliability scoring

4. **Skip Phase**: Decision making
   - Query pattern library
   - Match with confidence scoring
   - Decide to skip or not
   - Execute fallback if skipping

**Feedback Loop Frequency**:
- **Real-time**: Every turn updates metrics
- **Batch**: Pattern pruning runs daily
- **Continuous**: Learning never stops

---

## Part 2: Storage Architecture

### 2.1 Database Tables

**Table 1: impulse_mapping_records** (Raw learning data)

```sql
CREATE TABLE impulse_mapping_records (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- User intent
  raw_text TEXT NOT NULL,
  normalized_pattern TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  intent_confidence REAL NOT NULL,
  
  -- Context
  recent_files TEXT NOT NULL,             -- JSON array
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  
  -- Impulses created (JSON array)
  impulses TEXT NOT NULL,
  
  -- Outcome
  task_succeeded BOOLEAN NOT NULL,
  response_quality REAL NOT NULL,
  impulses_used_count INTEGER NOT NULL,
  time_to_success INTEGER NOT NULL,
  
  -- Metadata
  record_id TEXT NOT NULL,
  
  -- Indexes
  INDEX idx_normalized_pattern (normalized_pattern),
  INDEX idx_intent_type (intent_type),
  INDEX idx_session_id (session_id),
  INDEX idx_captured_at (captured_at DESC)
);
```

**Table 2: pattern_library** (Learned patterns)

```sql
CREATE TABLE pattern_library (
  -- Primary key
  id TEXT PRIMARY KEY,                    -- pattern_abc123
  
  -- Pattern template
  template TEXT NOT NULL,                 -- "fix bug in {file0}"
  normalized TEXT NOT NULL,               -- "fix_bug_in_X"
  variables TEXT NOT NULL,                -- JSON array of PatternVariable
  intent_type TEXT NOT NULL,              -- "code_fix", "feature_request"
  
  -- Learned impulse mappings
  impulse_mapping TEXT NOT NULL,          -- JSON array of ImpulseMapping
  
  -- Pattern metrics
  observation_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  avg_response_time_ms REAL DEFAULT 0.0,
  
  -- Reliability flags
  is_reliable BOOLEAN DEFAULT 1,          -- success_rate >= 0.75
  is_active BOOLEAN DEFAULT 1,            -- Used in skip decisions
  
  -- Timestamps
  first_observed INTEGER NOT NULL,        -- Unix timestamp (ms)
  last_used INTEGER NOT NULL,             -- Unix timestamp (ms)
  last_updated INTEGER NOT NULL,          -- Unix timestamp (ms)
  
  -- Metadata
  metadata TEXT,                          -- JSON object for additional data
  
  -- Indexes for fast lookup
  INDEX idx_normalized (normalized),
  INDEX idx_intent_type (intent_type),
  INDEX idx_success_rate (success_rate DESC),
  INDEX idx_is_reliable (is_reliable),
  INDEX idx_is_active (is_active),
  INDEX idx_last_used (last_used DESC),
  INDEX idx_observation_count (observation_count DESC)
);
```

**Table 3: memory_agent_performance** (Per-turn tracking)

```sql
CREATE TABLE memory_agent_performance (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- Session context
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  
  -- Skip decision
  skipped BOOLEAN NOT NULL,
  skip_reason TEXT,
  skip_confidence REAL,
  fallback_strategy TEXT,
  
  -- Pattern info (if skip_reason = pattern)
  pattern_id TEXT,
  pattern_template TEXT,
  pattern_confidence REAL,
  variable_bindings TEXT,
  
  -- Activity info (if skip_reason = activity)
  activity_id TEXT,
  template_id TEXT,
  requirement_count INTEGER,
  
  -- Outcome
  impulses_created INTEGER NOT NULL,
  impulses_loaded INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  task_succeeded BOOLEAN,
  response_quality REAL,
  
  -- Performance metrics
  decision_duration_ms REAL NOT NULL,
  fallback_duration_ms REAL,
  total_duration_ms REAL NOT NULL,
  llm_time_saved_ms REAL,
  
  -- Timestamps
  captured_at INTEGER NOT NULL,
  
  -- Indexes for analytics
  INDEX idx_session_turn (session_id, turn_number),
  INDEX idx_skipped (skipped),
  INDEX idx_skip_reason (skip_reason),
  INDEX idx_pattern_id (pattern_id),
  INDEX idx_captured_at (captured_at DESC)
);
```

### 2.2 Index Strategy

**Optimized for**:
1. **Pattern matching queries** (most frequent):
   - `idx_normalized` + `idx_intent_type` + `idx_is_active`
   - Composite index for common query: `(normalized, intent_type, is_reliable)`

2. **Skip decision tracking**:
   - `idx_session_turn` for session analysis
   - `idx_skipped` + `idx_skip_reason` for metrics

3. **Pattern effectiveness**:
   - `idx_success_rate` for sorting by reliability
   - `idx_observation_count` for finding frequent patterns

4. **Time-based queries**:
   - `idx_last_used` for recent patterns
   - `idx_captured_at` for chronological analysis

**Composite Indexes** (create after initial deployment):
```sql
-- For pattern matching queries
CREATE INDEX idx_pattern_lookup 
ON pattern_library(normalized, intent_type, is_reliable, is_active);

-- For pattern effectiveness queries
CREATE INDEX idx_pattern_metrics 
ON pattern_library(success_rate DESC, observation_count DESC);

-- For session tracking
CREATE INDEX idx_session_tracking 
ON memory_agent_performance(session_id, turn_number, captured_at DESC);
```

### 2.3 Pruning Strategy

**Goal**: Remove old, unreliable, or unused patterns to keep database lean

**Pruning Rules**:

1. **Unreliable Patterns** (success_rate < 0.5, observation_count >= 5):
   - Mark `is_active = 0` (exclude from skip decisions)
   - Keep data for analysis

2. **Old Unused Patterns** (last_used > 90 days ago):
   - Archive to cold storage
   - Delete from active database

3. **Low Observation Patterns** (observation_count < 3, first_observed > 30 days ago):
   - Delete (not enough data to learn)

**Pruning Implementation**:

```typescript
/**
 * Prune unreliable and old patterns
 * Run daily via cron job or background task
 */
export async function prunePatternLibrary(): Promise<PruneResult> {
  const { LearningDatabase } = await import('./learning-database')
  
  const start = Date.now()
  let unreliableCount = 0
  let oldUnusedCount = 0
  let lowObservationCount = 0
  
  // Rule 1: Mark unreliable patterns as inactive
  const unreliablePatterns = await LearningDatabase.query(`
    SELECT id, template, success_rate, observation_count
    FROM pattern_library
    WHERE 
      success_rate < 0.5
      AND observation_count >= 5
      AND is_active = 1
  `)
  
  for (const pattern of unreliablePatterns) {
    await LearningDatabase.update('pattern_library', pattern.id, {
      is_active: 0,
      is_reliable: 0,
      metadata: JSON.stringify({
        pruned_at: Date.now(),
        prune_reason: 'unreliable',
        success_rate: pattern.success_rate,
        observation_count: pattern.observation_count,
      }),
    })
    unreliableCount++
  }
  
  // Rule 2: Archive old unused patterns
  const oldUnusedPatterns = await LearningDatabase.query(`
    SELECT id, template, last_used
    FROM pattern_library
    WHERE 
      last_used < ?
      AND is_active = 1
  `, [Date.now() - 90 * 24 * 60 * 60 * 1000]) // 90 days ago
  
  for (const pattern of oldUnusedPatterns) {
    // Archive to cold storage (optional)
    await archivePattern(pattern)
    
    // Delete from active database
    await LearningDatabase.delete('pattern_library', pattern.id)
    oldUnusedCount++
  }
  
  // Rule 3: Delete low observation patterns
  const lowObservationPatterns = await LearningDatabase.query(`
    SELECT id, template, observation_count, first_observed
    FROM pattern_library
    WHERE 
      observation_count < 3
      AND first_observed < ?
  `, [Date.now() - 30 * 24 * 60 * 60 * 1000]) // 30 days ago
  
  for (const pattern of lowObservationPatterns) {
    await LearningDatabase.delete('pattern_library', pattern.id)
    lowObservationCount++
  }
  
  const duration = Date.now() - start
  
  log.info('pattern library pruned', {
    unreliableCount,
    oldUnusedCount,
    lowObservationCount,
    totalPruned: unreliableCount + oldUnusedCount + lowObservationCount,
    duration,
  })
  
  return {
    unreliableCount,
    oldUnusedCount,
    lowObservationCount,
    totalPruned: unreliableCount + oldUnusedCount + lowObservationCount,
    duration,
  }
}

interface PruneResult {
  unreliableCount: number
  oldUnusedCount: number
  lowObservationCount: number
  totalPruned: number
  duration: number
}
```

**Pruning Schedule**:
- **Daily**: Run at 3 AM (low traffic time)
- **On-demand**: Admin can trigger manually
- **Metrics**: Track pruned counts for monitoring

---

## Part 3: Learning Algorithms

### 3.1 Pattern Learning on Success

**Goal**: Update pattern metrics when task succeeds

```typescript
/**
 * Update pattern metrics after successful task
 * Increases success_count, updates success_rate, updates avg_response_time
 */
export async function updatePatternOnSuccess(input: {
  patternId: string
  responseTime: number
  tokensUsed: number
}): Promise<void> {
  
  const { LearningDatabase } = await import('./learning-database')
  
  // Load current pattern
  const pattern = await LearningDatabase.get('pattern_library', input.patternId)
  
  if (!pattern) {
    log.warn('pattern not found for success update', { patternId: input.patternId })
    return
  }
  
  // Update metrics
  const newSuccessCount = pattern.success_count + 1
  const newObservationCount = pattern.observation_count + 1
  const newSuccessRate = newSuccessCount / newObservationCount
  
  // Update average response time using exponential moving average (EMA)
  // This gives more weight to recent observations
  const alpha = 0.2  // Smoothing factor (0.2 = 20% new, 80% old)
  const newAvgTime = alpha * input.responseTime + (1 - alpha) * pattern.avg_response_time_ms
  
  // Determine reliability
  const isReliable = newSuccessRate >= 0.75 && newObservationCount >= 3
  
  // Update pattern in database
  await LearningDatabase.update('pattern_library', input.patternId, {
    success_count: newSuccessCount,
    observation_count: newObservationCount,
    success_rate: newSuccessRate,
    avg_response_time_ms: newAvgTime,
    is_reliable: isReliable ? 1 : 0,
    last_used: Date.now(),
    last_updated: Date.now(),
  })
  
  log.info('pattern metrics updated on success', {
    patternId: input.patternId,
    template: pattern.template,
    successRate: newSuccessRate.toFixed(3),
    observationCount: newObservationCount,
    isReliable,
  })
  
  // If pattern just became reliable, track milestone
  if (isReliable && !pattern.is_reliable) {
    log.info('pattern became reliable', {
      patternId: input.patternId,
      template: pattern.template,
      successRate: newSuccessRate.toFixed(3),
      observationCount: newObservationCount,
    })
  }
}
```

### 3.2 Pattern Learning on Failure

**Goal**: Update pattern metrics when task fails

```typescript
/**
 * Update pattern metrics after failed task
 * Increases failure_count, updates success_rate, marks unreliable if needed
 */
export async function updatePatternOnFailure(input: {
  patternId: string
  errorMessage: string
}): Promise<void> {
  
  const { LearningDatabase } = await import('./learning-database')
  
  // Load current pattern
  const pattern = await LearningDatabase.get('pattern_library', input.patternId)
  
  if (!pattern) {
    log.warn('pattern not found for failure update', { patternId: input.patternId })
    return
  }
  
  // Update metrics
  const newFailureCount = pattern.failure_count + 1
  const newObservationCount = pattern.observation_count + 1
  const newSuccessRate = pattern.success_count / newObservationCount
  
  // Determine reliability
  const isReliable = newSuccessRate >= 0.75 && newObservationCount >= 3
  const isUnreliable = newSuccessRate < 0.5 && newObservationCount >= 5
  
  // If pattern becomes unreliable, mark as inactive
  const isActive = isUnreliable ? 0 : pattern.is_active
  
  // Update pattern in database
  await LearningDatabase.update('pattern_library', input.patternId, {
    failure_count: newFailureCount,
    observation_count: newObservationCount,
    success_rate: newSuccessRate,
    is_reliable: isReliable ? 1 : 0,
    is_active: isActive,
    last_used: Date.now(),
    last_updated: Date.now(),
  })
  
  log.warn('pattern metrics updated on failure', {
    patternId: input.patternId,
    template: pattern.template,
    successRate: newSuccessRate.toFixed(3),
    observationCount: newObservationCount,
    isReliable,
    isUnreliable,
    errorMessage: input.errorMessage,
  })
  
  // If pattern just became unreliable, track milestone
  if (isUnreliable && pattern.is_active) {
    log.warn('pattern became unreliable - marked inactive', {
      patternId: input.patternId,
      template: pattern.template,
      successRate: newSuccessRate.toFixed(3),
      observationCount: newObservationCount,
      failureCount: newFailureCount,
    })
  }
}
```

### 3.3 Pattern Creation from Mapping Record

**Goal**: Create new pattern from captured mapping record

```typescript
/**
 * Create pattern from impulse mapping record
 * Extracts pattern, stores in pattern_library
 */
export async function createPatternFromMapping(
  mappingRecord: ImpulseMappingRecord
): Promise<string | null> {
  
  const { LearningDatabase } = await import('./learning-database')
  const { extractPattern } = await import('./pattern-extraction')
  
  // Extract pattern from user message
  const pattern = extractPattern(
    mappingRecord.userIntent.rawText,
    mappingRecord.userIntent.intentType
  )
  
  // Check if pattern already exists
  const existingPattern = await LearningDatabase.query(`
    SELECT id, observation_count
    FROM pattern_library
    WHERE normalized = ? AND intent_type = ?
    LIMIT 1
  `, [pattern.normalized, pattern.intentType])
  
  if (existingPattern.length > 0) {
    // Pattern already exists - update metrics instead
    log.debug('pattern already exists, updating metrics', {
      patternId: existingPattern[0].id,
      normalized: pattern.normalized,
    })
    
    // Update outcome will be called separately
    return existingPattern[0].id
  }
  
  // Build impulse mapping from captured impulses
  const impulseMapping: ImpulseMapping[] = []
  
  for (const impulse of mappingRecord.impulses) {
    // Only include impulses that were actually used
    if (impulse.used) {
      const mapping: ImpulseMapping = {
        type: impulse.type,
        relativeToVariable: inferVariableBinding(impulse, pattern.variables),
        pathTransform: inferPathTransform(impulse, pattern.variables),
        priority: impulse.priority,
        budget: impulse.budget,
        properties: extractImpulseProperties(impulse),
      }
      
      impulseMapping.push(mapping)
    }
  }
  
  // Create new pattern
  const patternId = pattern.patternId
  
  await LearningDatabase.insert('pattern_library', {
    id: patternId,
    template: pattern.template,
    normalized: pattern.normalized,
    variables: JSON.stringify(pattern.variables),
    intent_type: pattern.intentType,
    impulse_mapping: JSON.stringify(impulseMapping),
    observation_count: 1,
    success_count: mappingRecord.outcome.taskSucceeded ? 1 : 0,
    failure_count: mappingRecord.outcome.taskSucceeded ? 0 : 1,
    success_rate: mappingRecord.outcome.taskSucceeded ? 1.0 : 0.0,
    avg_response_time_ms: mappingRecord.outcome.timeToSuccess,
    is_reliable: 0, // Not reliable until >= 3 observations
    is_active: 1,
    first_observed: Date.now(),
    last_used: Date.now(),
    last_updated: Date.now(),
    metadata: JSON.stringify({
      created_from_record: mappingRecord.metadata.recordId,
      session_id: mappingRecord.context.activeSession,
    }),
  })
  
  log.info('new pattern created', {
    patternId,
    template: pattern.template,
    normalized: pattern.normalized,
    intentType: pattern.intentType,
    impulseCount: impulseMapping.length,
  })
  
  return patternId
}

/**
 * Infer which variable an impulse is bound to
 */
function inferVariableBinding(
  impulse: ImpulseMappingRecord['impulses'][0],
  variables: PatternVariable[]
): string | undefined {
  
  // For file impulses, find matching file variable
  if (impulse.type === 'file' && impulse.pointer.type === 'file') {
    const filePath = impulse.pointer.path
    
    for (const variable of variables) {
      if (variable.type === 'file' && filePath.includes(variable.originalValue)) {
        return variable.name
      }
    }
  }
  
  return undefined
}

/**
 * Infer path transformation from impulse
 */
function inferPathTransform(
  impulse: ImpulseMappingRecord['impulses'][0],
  variables: PatternVariable[]
): PathTransform {
  
  // Default: identity (use variable as-is)
  return 'identity'
  
  // TODO: Detect other transforms (toTestFile, toDirectory, etc.)
}

/**
 * Extract type-specific properties from impulse
 */
function extractImpulseProperties(
  impulse: ImpulseMappingRecord['impulses'][0]
): Record<string, any> {
  
  switch (impulse.type) {
    case 'bashOutput':
      return {
        command: impulse.pointer.type === 'bashOutput' ? impulse.pointer.command : ''
      }
    
    case 'memo':
      return {
        content: impulse.pointer.type === 'memo' ? impulse.pointer.content : ''
      }
    
    case 'metabobIssue':
      return {
        severity: impulse.pointer.type === 'metabobIssue' ? impulse.pointer.severity : 'HIGH'
      }
    
    default:
      return {}
  }
}
```

---

## Part 4: Activity Template Integration

### 4.1 Learning from Activity Context Requirements

**Goal**: Capture successful impulse mappings from activity contextRequirements

```typescript
/**
 * Capture learning data when activity uses contextRequirements
 * Called after gatherContext() succeeds
 */
export async function captureActivityLearning(input: {
  activityId: string
  templateId: string
  contextRequirements: ActivityTemplate.ContextRequirement[]
  resolvedImpulses: Record<string, ActivityTemplate.Impulse.Schema>
  outcome: {
    succeeded: boolean
    duration: number
    cost: number
  }
}): Promise<void> {
  
  const { LearningDatabase } = await import('./learning-database')
  
  // Build activity learning record
  const record: ActivityLearningRecord = {
    activityId: input.activityId,
    templateId: input.templateId,
    succeeded: input.outcome.succeeded,
    duration: input.outcome.duration,
    cost: input.outcome.cost,
    contextRequirements: input.contextRequirements,
    impulsesMapped: {},
    taskOutcomes: [], // Populated from task-level captures
    totalImpulsesCreated: Object.keys(input.resolvedImpulses).length,
    totalImpulsesUsed: 0, // Will be updated after tasks execute
    impulseUtilization: 0,
    timestamp: Date.now(),
  }
  
  // Map requirements to impulses
  for (const [id, impulse] of Object.entries(input.resolvedImpulses)) {
    const requirement = input.contextRequirements.find(req => 
      req.type === impulse.type
    )
    
    record.impulsesMapped[id] = {
      requirement: requirement?.description || 'unknown',
      type: impulse.type,
      pointer: impulse.pointer,
      priority: impulse.priority,
      budget: impulse.budget,
      wasUsed: false, // Will be updated after execution
    }
  }
  
  // Store in database
  await LearningDatabase.insertActivityRecord(record)
  
  log.info('activity learning captured', {
    activityId: input.activityId,
    templateId: input.templateId,
    requirementCount: input.contextRequirements.length,
    impulseCount: record.totalImpulsesCreated,
  })
}
```

### 4.2 Skip gatherContext When Learned

**Goal**: Use learned mappings instead of calling gatherContext (LLM call)

```typescript
/**
 * Check if activity has learned context mapping
 * Returns learned impulses if confident, null otherwise
 */
export async function getLearnedActivityContext(input: {
  templateId: string
  variables: Record<string, any>
}): Promise<LearnedContext | null> {
  
  const { LearningDatabase } = await import('./learning-database')
  
  // Query activity learning records for this template
  const records = await LearningDatabase.query(`
    SELECT 
      activity_id,
      context_requirements,
      impulses_mapped,
      succeeded,
      impulse_utilization,
      timestamp
    FROM activity_learning_records
    WHERE 
      template_id = ?
      AND succeeded = 1
      AND impulse_utilization > 0.6
    ORDER BY timestamp DESC
    LIMIT 5
  `, [input.templateId])
  
  if (records.length < 3) {
    // Not enough observations to be confident
    log.debug('not enough activity learning data', {
      templateId: input.templateId,
      recordCount: records.length,
    })
    return null
  }
  
  // Check if impulse mappings are consistent across observations
  const consistencyScore = calculateMappingConsistency(records)
  
  if (consistencyScore < 0.8) {
    // Mappings vary too much - not confident
    log.debug('activity mappings not consistent', {
      templateId: input.templateId,
      consistencyScore: consistencyScore.toFixed(2),
    })
    return null
  }
  
  // Use most recent successful mapping
  const latestRecord = records[0]
  const impulsesMapped = JSON.parse(latestRecord.impulses_mapped)
  
  // Reconstruct impulses with current variables
  const impulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  
  for (const [id, mapping] of Object.entries(impulsesMapped)) {
    const impulse = await reconstructImpulseFromMapping(
      mapping as any,
      input.variables
    )
    
    if (impulse) {
      impulses[id] = impulse
    }
  }
  
  log.info('using learned activity context (skip gatherContext)', {
    templateId: input.templateId,
    observationCount: records.length,
    consistencyScore: consistencyScore.toFixed(2),
    impulseCount: Object.keys(impulses).length,
  })
  
  return {
    impulses,
    confidence: consistencyScore,
    observationCount: records.length,
    source: 'learned-activity-mapping',
  }
}

interface LearnedContext {
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  confidence: number
  observationCount: number
  source: string
}

/**
 * Calculate consistency score across multiple observations
 * 1.0 = perfectly consistent, 0.0 = completely inconsistent
 */
function calculateMappingConsistency(
  records: any[]
): number {
  
  if (records.length < 2) {
    return 1.0 // Single observation is "consistent"
  }
  
  // Extract impulse types from each observation
  const typeSets = records.map(record => {
    const mapped = JSON.parse(record.impulses_mapped)
    return new Set(Object.values(mapped).map((m: any) => m.type))
  })
  
  // Calculate Jaccard similarity between sets
  let totalSimilarity = 0
  let comparisons = 0
  
  for (let i = 0; i < typeSets.length; i++) {
    for (let j = i + 1; j < typeSets.length; j++) {
      const similarity = jaccardSimilarity(typeSets[i], typeSets[j])
      totalSimilarity += similarity
      comparisons++
    }
  }
  
  return comparisons > 0 ? totalSimilarity / comparisons : 0
}

/**
 * Jaccard similarity between two sets
 */
function jaccardSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  
  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * Reconstruct impulse from learned mapping
 */
async function reconstructImpulseFromMapping(
  mapping: {
    type: string
    pointer: any
    priority: string
    budget: number
  },
  variables: Record<string, any>
): Promise<ActivityTemplate.Impulse.Schema | null> {
  
  // Reconstruct pointer with variable substitution
  let pointer = mapping.pointer
  
  // Replace variables in pointer (if any)
  const pointerStr = JSON.stringify(pointer)
  const reconstructedStr = replaceVariables(pointerStr, variables)
  pointer = JSON.parse(reconstructedStr)
  
  return {
    id: generateImpulseId(),
    type: mapping.type as any,
    pointer,
    priority: mapping.priority as any,
    budget: mapping.budget,
    loaded: false,
    metadata: {
      source: 'learned-activity-mapping',
    },
  }
}

/**
 * Replace {{variable}} placeholders in string
 */
function replaceVariables(
  template: string,
  variables: Record<string, any>
): string {
  
  let result = template
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, 'g'), String(value))
  }
  
  return result
}
```

### 4.3 Activity Learning Confidence Thresholds

**Confidence Thresholds**:

1. **Low Confidence** (<3 observations, <0.6 consistency):
   - **Action**: Run gatherContext (LLM call)
   - **Reason**: Not enough data to skip

2. **Medium Confidence** (3-5 observations, 0.6-0.8 consistency):
   - **Action**: Run gatherContext (LLM call)
   - **Reason**: Data is still stabilizing

3. **High Confidence** (>=5 observations, >0.8 consistency):
   - **Action**: Skip gatherContext, use learned mapping
   - **Reason**: Consistent pattern observed

**Threshold Configuration**:
```typescript
interface ActivityLearningConfig {
  minObservations: number          // Default: 5
  minConsistency: number           // Default: 0.8
  minUtilization: number           // Default: 0.6 (impulses actually used)
  enableSkipping: boolean          // Default: true
}
```

---

## Part 5: Component Interaction Flows

### 5.1 Session Turn Flow (with Learning)

```
┌─────────────────────────────────────────────────────────────┐
│ SESSION TURN WITH LEARNING                                  │
└─────────────────────────────────────────────────────────────┘

1. User sends message
   ↓
2. Turn lifecycle starts
   ↓
3. [HOOK: Skip Decision (priority 5)]
   • shouldSkipMemoryAgentLLM()
   • Query pattern_library
   • Match with confidence
   ↓
   ├─ SKIP (confidence > 0.85)
   │  ↓
   │  4a. Execute fallback strategy
   │      • Pattern replay
   │      • Template requirements
   │      • Keep existing
   │      • Do nothing
   │  ↓
   │  5a. Track skip decision
   │      → INSERT memory_agent_performance (skipped=true)
   │  ↓
   │  6a. Load impulses
   │
   └─ NO SKIP (confidence <= 0.85)
      ↓
      4b. [HOOK: Memory Management (priority 10)]
          • Memory agent analyzeIntent()
          • Memory agent prepare()
          • Create impulses
      ↓
      5b. Capture learning data
          → INSERT impulse_mapping_records
      ↓
      6b. Track LLM call
          → INSERT memory_agent_performance (skipped=false)
      ↓
      7b. Load impulses

   [Both paths merge here]
   ↓
7. Main agent execution
   • Generate response
   • Execute tools
   ↓
8. Capture response usage
   • Detect impulses used (snippet matching)
   • → UPDATE LearningBuffer
   ↓
9. Task completion
   ↓
10. Capture outcome
    • Task succeeded/failed
    • → FLUSH LearningBuffer to database
    ↓
11. Pattern learning
    • Extract pattern (if new)
    • Update pattern metrics (if exists)
    • → UPDATE pattern_library
    ↓
12. Return response to user

[FEEDBACK LOOP: Next turn uses updated pattern_library]
```

### 5.2 Activity Execution Flow (with Learning)

```
┌─────────────────────────────────────────────────────────────┐
│ ACTIVITY EXECUTION WITH LEARNING                            │
└─────────────────────────────────────────────────────────────┘

1. Activity starts (template-based)
   ↓
2. Check if template has contextRequirements
   ↓
   ├─ YES
   │  ↓
   │  3a. Check learned activity context
   │      • getLearnedActivityContext(templateId)
   │      • Query activity_learning_records
   │      • Calculate consistency
   │  ↓
   │  ├─ HIGH CONFIDENCE (>= 5 obs, > 0.8 consistency)
   │  │  ↓
   │  │  4a. SKIP gatherContext (LLM call)
   │  │      • Use learned impulse mapping
   │  │      • Reconstruct impulses with variables
   │  │      • → Track skip in performance table
   │  │
   │  └─ LOW CONFIDENCE (< 5 obs or <= 0.8 consistency)
   │     ↓
   │     4b. RUN gatherContext (LLM call)
   │         • Memory agent creates impulses
   │         • → Capture learning data
   │
   └─ NO
      ↓
      3b. No context requirements
          • Continue without impulses

   [Both paths merge here]
   ↓
5. Execute activity tasks
   • Each task runs in sub-session
   • Track impulse usage per task
   ↓
6. Activity completes
   ↓
7. Capture activity learning
   • → INSERT activity_learning_records
   • Include contextRequirements
   • Include resolved impulses
   • Include impulse utilization
   ↓
8. Update activity metrics
   • Calculate consistency score
   • Update learning confidence
   ↓
9. Return activity result

[FEEDBACK LOOP: Next activity execution uses learned mappings]
```

---

## Summary

This document provides complete learning loop architecture with:

1. ✅ **Data Flow Diagram**: Complete system flow with feedback loops
2. ✅ **Storage Architecture**: 3 tables with indexing and pruning strategies
3. ✅ **Learning Algorithms**: Success/failure updates with EMA
4. ✅ **Activity Integration**: Learn from contextRequirements, skip when confident
5. ✅ **Component Flows**: Session turn flow and activity execution flow
6. ✅ **Pruning Strategy**: Remove unreliable, old, and low-observation patterns
7. ✅ **Confidence Thresholds**: Activity learning thresholds (5 obs, 0.8 consistency)

**Key Metrics**:
- **Skip Rate**: 60-80% (memory agent LLM calls avoided)
- **Pattern Reliability**: >= 75% success rate for active patterns
- **Consistency**: >= 80% for activity template mappings
- **Pruning**: Daily cleanup of unreliable/old patterns

**Implementation Priority**:
1. Storage schema (3 tables)
2. Data capture points (5 locations)
3. Pattern learning algorithms (success/failure updates)
4. Skip decision integration (turn lifecycle hook)
5. Activity learning integration (gatherContext skip)
6. Pruning automation (daily cron job)

The system continuously learns, improves, and adapts to user behavior while maintaining quality!
