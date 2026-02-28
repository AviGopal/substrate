# Impulse Learning System: Data Capture Points Trace

**Date**: 2026-02-25  
**Purpose**: Systematic trace of all data capture points, schemas, and implementation requirements for impulse learning system

---

## Executive Summary

This document traces all data capture points needed to implement the impulse learning system that learns impulse-context mappings to skip memory agent LLM calls 60-80% of the time while maintaining quality.

**Key Components**:
1. **Data Capture Points**: Where to instrument code to capture learning data
2. **Data Schemas**: What data to capture at each point
3. **Storage Strategy**: How and when to persist captured data
4. **Impulse Usage Tracking**: How to detect if impulses were used in responses
5. **Implementation Pseudocode**: Concrete code patterns for each capture point

---

## Part 1: Memory Agent Capture Points

### Capture Point 1: After Intent Analysis

**Location**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**Line Numbers**: Lines 140-431 (analyzeIntent function)

**When**: After LLM call completes at line 363-379 (generateObject call)

**What to Capture**:
```typescript
interface UserIntentCapture {
  // Raw input
  rawText: string                    // Original user message
  sessionID: string                  // Session identifier
  turnNumber: number                 // Turn in session
  
  // Intent analysis result (from LLM)
  intentType: string                 // code_fix, feature_request, etc.
  confidence: number                 // 0-1 from intent analysis
  reasoning: string                  // Why classified this way
  
  // Timing
  analysisTime: number               // Time taken for intent analysis (ms)
  timestamp: number                  // Capture timestamp
}
```

**Implementation Pseudocode**:
```typescript
export async function analyzeIntent(input: {
  sessionID: string
  promptText: string
  recentMessages?: MessageV2.WithParts[]
}): Promise<Intent> {
  const start = Date.now()
  
  // ... existing code (lines 148-379) ...
  
  const result = await generateObject({ /* ... */ })
  
  // CAPTURE POINT 1: After intent analysis completes
  const userIntentCapture: UserIntentCapture = {
    rawText: input.promptText,
    sessionID: input.sessionID,
    turnNumber: await getCurrentTurnNumber(input.sessionID),
    intentType: result.object.type,
    confidence: result.object.confidence,
    reasoning: result.object.reasoning,
    analysisTime: Date.now() - start,
    timestamp: Date.now(),
  }
  
  // Store in in-memory buffer (not persisted yet)
  await LearningBuffer.storeIntentCapture(input.sessionID, userIntentCapture)
  
  // ... continue with existing code ...
}
```

**Storage**: In-memory buffer per session (Map<sessionID, LearningRecord>)

---

### Capture Point 2: After Impulse Creation

**Location**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**Line Numbers**: Lines 820-1058 (prepare function)

**When**: After impulse loop completes at line 1027 (after all impulses created/loaded)

**What to Capture**:
```typescript
interface ImpulseCreationCapture {
  sessionID: string
  turnNumber: number
  
  // Impulses created/loaded
  impulses: Array<{
    id: string                       // Impulse ID
    type: string                     // file, metabobIssue, bashOutput, memo
    pointer: ImpulsePointer          // Full pointer object
    priority: "high" | "medium" | "low"
    budget: number                   // Token budget
    created: boolean                 // Was it created this turn?
    loaded: boolean                  // Was it loaded?
    tokenCount?: number              // Actual tokens (if loaded)
  }>
  
  // Context at creation
  recentFiles: string[]              // Files modified in last 5 turns
  
  // Metrics
  impulsesCreated: number
  impulsesLoaded: number
  totalTokens: number
  timestamp: number
}
```

**Implementation Pseudocode**:
```typescript
export async function prepare(input: { 
  sessionID: string
  intent: Intent
  turnNumber: number 
}): Promise<{
  impulsesCreated: number
  impulsesLoaded: number
  totalTokens: number
  impulsesUnloaded: number
}> {
  // ... existing code (lines 834-1027) ...
  
  // CAPTURE POINT 2: After impulse creation completes
  const impulseCapture: ImpulseCreationCapture = {
    sessionID: input.sessionID,
    turnNumber: input.turnNumber,
    impulses: [], // Populate from created impulses
    recentFiles: await getRecentFiles(input.sessionID, 5),
    impulsesCreated: created,
    impulsesLoaded: loaded,
    totalTokens: totalTokens,
    timestamp: Date.now(),
  }
  
  // Populate impulses array from session memory
  const existingImpulses = await SessionMemory.listImpulses(input.sessionID)
  for (const impulse of existingImpulses) {
    impulseCapture.impulses.push({
      id: impulse.id,
      type: impulse.type,
      pointer: impulse.pointer,
      priority: impulse.priority,
      budget: impulse.budget,
      created: input.intent.suggestedImpulses.some(s => s.id === impulse.id),
      loaded: impulse.loaded,
      tokenCount: impulse.tokenCount,
    })
  }
  
  // Append to learning buffer
  await LearningBuffer.appendImpulseCapture(input.sessionID, impulseCapture)
  
  // ... continue with existing code ...
}
```

**Storage**: Append to in-memory buffer (same sessionID record)

---

### Capture Point 3: After Response Generation

**Location**: Not in memory-agent.ts - needs integration in main session loop

**Proposed Location**: `repos/metabob-opencode/packages/opencode/src/session/index.ts` (Session.prompt or Session.turn)

**When**: After main agent generates response, before returning to user

**What to Capture**:
```typescript
interface ResponseCapture {
  sessionID: string
  turnNumber: number
  
  // Response metadata
  responseText: string               // Agent response
  responseTokens: number             // Tokens in response
  
  // Impulse usage detection
  impulsesUsed: Record<string, boolean>  // Which impulses were referenced
  impulsesUsedCount: number          // How many used
  
  // Timing
  responseTime: number               // Time to generate response (ms)
  timestamp: number
}
```

**Implementation Pseudocode**:
```typescript
// In Session.turn or Session.prompt (after agent response)
async function captureResponseUsage(
  sessionID: string,
  turnNumber: number,
  response: string,
  responseTime: number
): Promise<void> {
  // Get impulses from session memory
  const impulses = await SessionMemory.listImpulses(sessionID)
  
  // Track which impulses were used in the response
  const impulsesUsed = await trackImpulseUsage(response, impulses)
  
  const responseCapture: ResponseCapture = {
    sessionID,
    turnNumber,
    responseText: response,
    responseTokens: estimateTokens(response),
    impulsesUsed,
    impulsesUsedCount: Object.values(impulsesUsed).filter(Boolean).length,
    responseTime,
    timestamp: Date.now(),
  }
  
  // Append to learning buffer
  await LearningBuffer.appendResponseCapture(sessionID, responseCapture)
}
```

**Storage**: Append to in-memory buffer

---

## Part 2: Activity Capture Points

### Capture Point 4: After Task Execution

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Note**: Activity execution code is not in activity.ts - need to find activity executor

**Expected Location**: Look for `executeTask()` or similar in activity execution flow

**When**: After each task completes (success or failure)

**What to Capture**:
```typescript
interface TaskOutcomeCapture {
  activityId: string
  taskId: string
  taskDescription: string
  
  // Outcome
  taskSucceeded: boolean             // Did task complete successfully?
  errorMessage?: string              // Error if failed
  
  // Impulses used by task
  impulsesReferenced: string[]       // Impulse IDs task had access to
  impulsesActuallyUsed: string[]     // Impulse IDs detected in response
  
  // Performance
  taskDuration: number               // Time to complete task (ms)
  taskCost: number                   // Cost of task execution
  timestamp: number
}
```

**Implementation Pseudocode**:
```typescript
// In activity executor (after task execution)
async function executeTask(
  activityId: string,
  task: ActivityTemplate.Task,
  sessionID: string
): Promise<TaskResult> {
  const start = Date.now()
  
  try {
    // ... execute task ...
    const result = await runTaskSession(task, sessionID)
    
    // CAPTURE POINT 4: After task succeeds
    const taskCapture: TaskOutcomeCapture = {
      activityId,
      taskId: task.id,
      taskDescription: task.description,
      taskSucceeded: true,
      impulsesReferenced: task.impulseReferences || [],
      impulsesActuallyUsed: await detectUsedImpulses(result.response, sessionID),
      taskDuration: Date.now() - start,
      taskCost: result.cost,
      timestamp: Date.now(),
    }
    
    await LearningBuffer.storeTaskOutcome(activityId, taskCapture)
    
    return result
  } catch (error) {
    // CAPTURE POINT 4b: After task fails
    const taskCapture: TaskOutcomeCapture = {
      activityId,
      taskId: task.id,
      taskDescription: task.description,
      taskSucceeded: false,
      errorMessage: error.message,
      impulsesReferenced: task.impulseReferences || [],
      impulsesActuallyUsed: [], // Assume none used if failed
      taskDuration: Date.now() - start,
      taskCost: 0,
      timestamp: Date.now(),
    }
    
    await LearningBuffer.storeTaskOutcome(activityId, taskCapture)
    throw error
  }
}
```

**Storage**: In-memory buffer per activity (Map<activityId, ActivityLearningRecord>)

---

### Capture Point 5: After Activity Completion

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Line Numbers**: Lines 803-884 (complete function) and lines 1007-1113 (fail function)

**When**: After activity completes or fails

**What to Capture**:
```typescript
interface ActivityLearningRecord {
  activityId: string
  templateId?: string
  
  // Activity outcome
  succeeded: boolean
  duration: number                   // Total activity duration (ms)
  cost: number                       // Total activity cost
  
  // Context requirements (if activity used template)
  contextRequirements?: ActivityTemplate.ContextRequirement[]
  
  // Impulses created for activity
  impulsesMapped: Record<string, {
    requirement: string              // Which requirement this fulfilled
    type: string                     // Impulse type
    pointer: ImpulsePointer
    priority: string
    budget: number
    wasUsed: boolean                 // Was it used in any task?
  }>
  
  // Task-level outcomes
  taskOutcomes: TaskOutcomeCapture[]
  
  // Aggregate metrics
  totalImpulsesCreated: number
  totalImpulsesUsed: number
  impulseUtilization: number         // impulsesUsed / impulsesCreated
  
  timestamp: number
}
```

**Implementation Pseudocode**:
```typescript
export async function complete(id: string): Promise<Info> {
  const activity = await load(id)
  
  // ... existing completion logic (lines 805-819) ...
  
  // CAPTURE POINT 5: Activity completed successfully
  if (activity.templateId) {
    const learningRecord = await buildActivityLearningRecord(activity, true)
    await LearningDatabase.persistActivityRecord(learningRecord)
  }
  
  // ... rest of existing code ...
}

export async function fail(id: string): Promise<Info> {
  const activity = await load(id)
  
  // ... existing failure logic (lines 1009-1023) ...
  
  // CAPTURE POINT 5b: Activity failed
  if (activity.templateId) {
    const learningRecord = await buildActivityLearningRecord(activity, false)
    await LearningDatabase.persistActivityRecord(learningRecord)
  }
  
  // ... rest of existing code ...
}

async function buildActivityLearningRecord(
  activity: Activity.Info,
  succeeded: boolean
): Promise<ActivityLearningRecord> {
  // Build impulse mapping from activity.impulses
  const impulsesMapped: Record<string, any> = {}
  for (const [key, impulse] of Object.entries(activity.impulses)) {
    impulsesMapped[key] = {
      requirement: impulse.metadata?.requirement || 'unknown',
      type: impulse.type,
      pointer: impulse.pointer,
      priority: impulse.priority,
      budget: impulse.budget,
      wasUsed: await checkImpulseWasUsed(activity.id, impulse.id),
    }
  }
  
  // Aggregate task outcomes
  const taskOutcomes = await LearningBuffer.getTaskOutcomes(activity.id)
  
  const totalImpulsesCreated = Object.keys(activity.impulses).length
  const totalImpulsesUsed = Object.values(impulsesMapped).filter(i => i.wasUsed).length
  
  return {
    activityId: activity.id,
    templateId: activity.templateId,
    succeeded,
    duration: activity.stats.duration,
    cost: activity.stats.cost.total,
    contextRequirements: await getTemplateRequirements(activity.templateId),
    impulsesMapped,
    taskOutcomes,
    totalImpulsesCreated,
    totalImpulsesUsed,
    impulseUtilization: totalImpulsesCreated > 0 
      ? totalImpulsesUsed / totalImpulsesCreated 
      : 0,
    timestamp: Date.now(),
  }
}
```

**Storage**: **PERSIST** to learning database (SQLite or SurrealDB)

---

## Part 3: Impulse Usage Tracking Algorithm

### Problem Statement

Need to detect if an impulse was "used" (referenced) in agent response. This is critical for:
1. Learning which impulses are actually helpful
2. Pruning unhelpful impulses from patterns
3. Measuring pattern quality (impulse utilization rate)

### Solution: Content Snippet Matching

**Algorithm**:
```typescript
/**
 * Track which impulses were used in agent response
 * Uses content snippet matching to detect references
 */
async function trackImpulseUsage(
  response: string,
  impulses: ActivityTemplate.Impulse.Schema[]
): Promise<Record<string, boolean>> {
  const usageMap: Record<string, boolean> = {}
  
  for (const impulse of impulses) {
    // Skip unloaded impulses (no content to match)
    if (!impulse.loaded || !impulse.content) {
      usageMap[impulse.id] = false
      continue
    }
    
    // Extract unique snippets from impulse content
    const snippets = extractUniqueSnippets(impulse.content, {
      snippetCount: 3,
      minLength: 20,
      maxLength: 50,
    })
    
    // Check if response contains any snippet
    const isUsed = snippets.some(snippet => {
      // Normalize whitespace for matching
      const normalizedSnippet = snippet.replace(/\s+/g, ' ').trim()
      const normalizedResponse = response.replace(/\s+/g, ' ').trim()
      return normalizedResponse.includes(normalizedSnippet)
    })
    
    usageMap[impulse.id] = isUsed
    
    // Log detection for debugging
    if (isUsed) {
      log.debug('impulse usage detected', {
        impulseId: impulse.id,
        type: impulse.type,
        snippetsMatched: snippets.filter(s => 
          response.replace(/\s+/g, ' ').includes(s.replace(/\s+/g, ' '))
        ).length,
      })
    }
  }
  
  return usageMap
}

/**
 * Extract unique snippets from content for matching
 * Selects distinctive substrings that are likely unique identifiers
 */
function extractUniqueSnippets(
  content: string,
  options: {
    snippetCount: number
    minLength: number
    maxLength: number
  }
): string[] {
  const snippets: string[] = []
  
  // Strategy 1: Extract function/class names (most distinctive)
  const codePatterns = [
    /function\s+([a-zA-Z0-9_]+)/g,      // function names
    /class\s+([a-zA-Z0-9_]+)/g,         // class names
    /const\s+([a-zA-Z0-9_]+)\s*=/g,     // const declarations
    /export\s+\w+\s+([a-zA-Z0-9_]+)/g,  // exports
  ]
  
  for (const pattern of codePatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[1].length >= options.minLength) {
        snippets.push(match[1])
        if (snippets.length >= options.snippetCount) {
          return snippets
        }
      }
    }
  }
  
  // Strategy 2: Extract sentences (for non-code content)
  const sentences = content.split(/[.!?]\s+/)
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (trimmed.length >= options.minLength && 
        trimmed.length <= options.maxLength) {
      snippets.push(trimmed)
      if (snippets.length >= options.snippetCount) {
        return snippets
      }
    }
  }
  
  // Strategy 3: Extract distinctive substrings (fallback)
  const words = content.split(/\s+/)
  for (let i = 0; i < words.length - 3; i++) {
    const snippet = words.slice(i, i + 4).join(' ')
    if (snippet.length >= options.minLength && 
        snippet.length <= options.maxLength) {
      snippets.push(snippet)
      if (snippets.length >= options.snippetCount) {
        return snippets
      }
    }
  }
  
  return snippets
}
```

**Alternative: File Path Matching** (for file-type impulses):
```typescript
function trackFileImpulseUsage(
  response: string,
  fileImpulses: ActivityTemplate.Impulse.Schema[]
): Record<string, boolean> {
  const usageMap: Record<string, boolean> = {}
  
  for (const impulse of fileImpulses) {
    if (impulse.pointer.type !== 'file') continue
    
    const filePath = impulse.pointer.path
    const fileName = filePath.split('/').pop() || ''
    
    // Check if response mentions file name or path
    const isUsed = response.includes(fileName) || response.includes(filePath)
    usageMap[impulse.id] = isUsed
  }
  
  return usageMap
}
```

---

## Part 4: Storage Strategy

### In-Memory Buffer

**Purpose**: Collect learning data during session/activity execution

**Structure**:
```typescript
class LearningBuffer {
  // Session-level captures (Map<sessionID, SessionLearningRecord>)
  private static sessionBuffers = new Map<string, SessionLearningRecord>()
  
  // Activity-level captures (Map<activityID, ActivityLearningRecord>)
  private static activityBuffers = new Map<string, ActivityLearningRecord>()
  
  /**
   * Store intent capture for session
   */
  static async storeIntentCapture(
    sessionID: string,
    capture: UserIntentCapture
  ): Promise<void> {
    let record = this.sessionBuffers.get(sessionID)
    if (!record) {
      record = { sessionID, captures: [] }
      this.sessionBuffers.set(sessionID, record)
    }
    record.intentCapture = capture
  }
  
  /**
   * Append impulse capture to session record
   */
  static async appendImpulseCapture(
    sessionID: string,
    capture: ImpulseCreationCapture
  ): Promise<void> {
    const record = this.sessionBuffers.get(sessionID)
    if (!record) {
      throw new Error(`No learning record for session ${sessionID}`)
    }
    record.impulseCapture = capture
  }
  
  /**
   * Append response capture to session record
   */
  static async appendResponseCapture(
    sessionID: string,
    capture: ResponseCapture
  ): Promise<void> {
    const record = this.sessionBuffers.get(sessionID)
    if (!record) {
      throw new Error(`No learning record for session ${sessionID}`)
    }
    record.responseCapture = capture
    
    // Session turn complete - flush to database if successful
    if (record.intentCapture && record.impulseCapture && record.responseCapture) {
      await this.flushSessionRecord(sessionID, record)
    }
  }
  
  /**
   * Flush session record to persistent storage
   */
  private static async flushSessionRecord(
    sessionID: string,
    record: SessionLearningRecord
  ): Promise<void> {
    // Build complete ImpulseMappingRecord
    const mappingRecord: ImpulseMappingRecord = {
      userIntent: {
        rawText: record.intentCapture.rawText,
        normalizedPattern: await normalizePattern(record.intentCapture.rawText),
        intentType: record.intentCapture.intentType,
        confidence: record.intentCapture.confidence,
      },
      context: {
        recentFiles: record.impulseCapture.recentFiles,
        activeSession: sessionID,
        turnNumber: record.intentCapture.turnNumber,
        timestamp: Date.now(),
      },
      impulses: record.impulseCapture.impulses.map(imp => ({
        id: imp.id,
        type: imp.type,
        pointer: imp.pointer,
        priority: imp.priority,
        budget: imp.budget,
        created: imp.created,
        loaded: imp.loaded,
        used: record.responseCapture.impulsesUsed[imp.id] || false,
      })),
      outcome: {
        taskSucceeded: true, // Session-level = successful if response generated
        responseQuality: 0.8, // Default (no user feedback yet)
        impulsesUsedCount: record.responseCapture.impulsesUsedCount,
        timeToSuccess: record.responseCapture.responseTime,
      },
      metadata: {
        capturedAt: Date.now(),
        capturedBy: 'session-memory-agent',
        recordId: generateRecordId(),
        sessionID,
      },
    }
    
    // Persist to learning database
    await LearningDatabase.insertMappingRecord(mappingRecord)
    
    // Clear buffer
    this.sessionBuffers.delete(sessionID)
    
    log.info('flushed session learning record', {
      sessionID,
      recordId: mappingRecord.metadata.recordId,
      impulseCount: mappingRecord.impulses.length,
      impulsesUsed: mappingRecord.outcome.impulsesUsedCount,
    })
  }
}
```

---

### Learning Database Schema

**Database**: SQLite (for local storage) or SurrealDB (for distributed)

**Table 1: impulse_mapping_records**
```sql
CREATE TABLE impulse_mapping_records (
  id TEXT PRIMARY KEY,
  
  -- User intent
  raw_text TEXT NOT NULL,
  normalized_pattern TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  intent_confidence REAL NOT NULL,
  
  -- Context
  recent_files TEXT NOT NULL,        -- JSON array
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  
  -- Impulses (JSON)
  impulses TEXT NOT NULL,            -- JSON array of impulse objects
  
  -- Outcome
  task_succeeded BOOLEAN NOT NULL,
  response_quality REAL NOT NULL,
  impulses_used_count INTEGER NOT NULL,
  time_to_success INTEGER NOT NULL,
  
  -- Indexes
  INDEX idx_normalized_pattern (normalized_pattern),
  INDEX idx_intent_type (intent_type),
  INDEX idx_session (session_id),
  INDEX idx_captured_at (captured_at)
)
```

**Table 2: activity_learning_records**
```sql
CREATE TABLE activity_learning_records (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  template_id TEXT,
  
  -- Outcome
  succeeded BOOLEAN NOT NULL,
  duration INTEGER NOT NULL,
  cost REAL NOT NULL,
  
  -- Context requirements (JSON)
  context_requirements TEXT,
  
  -- Impulses mapped (JSON)
  impulses_mapped TEXT NOT NULL,
  
  -- Task outcomes (JSON)
  task_outcomes TEXT NOT NULL,
  
  -- Metrics
  total_impulses_created INTEGER NOT NULL,
  total_impulses_used INTEGER NOT NULL,
  impulse_utilization REAL NOT NULL,
  
  captured_at INTEGER NOT NULL,
  
  INDEX idx_activity_id (activity_id),
  INDEX idx_template_id (template_id),
  INDEX idx_succeeded (succeeded),
  INDEX idx_captured_at (captured_at)
)
```

**Table 3: pattern_library** (learned patterns for skipping)
```sql
CREATE TABLE pattern_library (
  id TEXT PRIMARY KEY,
  
  -- Pattern
  template TEXT NOT NULL,            -- "Fix bug in {file}"
  normalized TEXT NOT NULL,          -- "fix_bug_in_X"
  variables TEXT NOT NULL,           -- JSON array ["file"]
  intent_type TEXT NOT NULL,
  
  -- Impulse mapping (JSON)
  impulse_mapping TEXT NOT NULL,     -- JSON array of mappings
  
  -- Metrics
  observation_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  avg_response_time_ms REAL DEFAULT 0.0,
  
  -- Timestamps
  first_observed INTEGER NOT NULL,
  last_used INTEGER NOT NULL,
  
  INDEX idx_normalized (normalized),
  INDEX idx_intent_type (intent_type),
  INDEX idx_success_rate (success_rate),
  INDEX idx_last_used (last_used)
)
```

---

## Part 5: Implementation Checklist

### Phase 1: Instrumentation (Week 1)

- [ ] **Capture Point 1**: Add intent capture after analyzeIntent() in memory-agent.ts:431
- [ ] **Capture Point 2**: Add impulse capture after prepare() in memory-agent.ts:1058
- [ ] **Capture Point 3**: Add response capture in session/index.ts after agent response
- [ ] **Capture Point 4**: Add task outcome capture in activity executor (find location)
- [ ] **Capture Point 5**: Add activity learning capture in activity.ts:884 and :1113
- [ ] **Impulse Usage Tracking**: Implement trackImpulseUsage() and extractUniqueSnippets()
- [ ] **Learning Buffer**: Implement LearningBuffer class with in-memory storage
- [ ] **Database Schema**: Create SQLite tables for learning data
- [ ] **Flush Logic**: Implement auto-flush when session/activity completes
- [ ] **Testing**: Verify data flows through all capture points

### Phase 2: Pattern Learning (Week 2)

- [ ] Implement pattern extraction algorithm (normalizePattern)
- [ ] Implement pattern matching engine
- [ ] Build pattern library from captured records
- [ ] Test pattern accuracy on historical data
- [ ] Implement impulse replay logic

### Phase 3: Skip Integration (Week 3)

- [ ] Add skip decision logic to session lifecycle
- [ ] Implement fallback strategies (pattern replay, template requirements)
- [ ] Track skip metrics (skip rate, success rate)
- [ ] Validate quality maintained (skip success >= LLM success)

### Phase 4: Activity Template Learning (Week 4)

- [ ] Capture activity-impulse mappings
- [ ] Skip gatherContext() when learned mapping exists
- [ ] Validate activity execution quality
- [ ] Monitor skip rate for activities

---

## Part 6: Code File Summary

### Files to Modify

1. **memory-agent.ts** (`repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`)
   - Add capture points 1 & 2
   - Lines: 431 (after analyzeIntent), 1058 (after prepare)

2. **activity.ts** (`repos/metabob-opencode/packages/opencode/src/session/activity.ts`)
   - Add capture point 5
   - Lines: 884 (complete), 1113 (fail)

3. **session/index.ts** (needs investigation)
   - Add capture point 3 (response capture)
   - After agent response generation

4. **Activity Executor** (location TBD - needs investigation)
   - Add capture point 4 (task outcome)
   - After executeTask() completes

### Files to Create

1. **learning-buffer.ts** - In-memory learning data buffer
2. **learning-database.ts** - SQLite database wrapper for persistence
3. **impulse-usage-tracker.ts** - Impulse usage detection logic
4. **pattern-extractor.ts** - Pattern extraction from user messages
5. **pattern-matcher.ts** - Pattern matching for skip decisions

---

## Part 7: Success Metrics

**Target Metrics** (after full implementation):
- Skip rate: 60-80% (memory agent LLM calls avoided)
- Quality maintained: skip success rate >= baseline success rate
- Time savings: 85-90% reduction in memory agent overhead
- Pattern coverage: >80% of common intents covered by patterns

**Tracking Queries**:
```sql
-- Skip rate over time
SELECT 
  DATE(captured_at / 1000, 'unixepoch') as date,
  COUNT(*) as total_turns,
  SUM(CASE WHEN skipped_llm = 1 THEN 1 ELSE 0 END) as skipped,
  ROUND(100.0 * SUM(CASE WHEN skipped_llm = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as skip_rate
FROM impulse_mapping_records
GROUP BY date
ORDER BY date DESC
LIMIT 30;

-- Pattern effectiveness
SELECT 
  normalized,
  observation_count,
  success_count,
  success_rate,
  avg_response_time_ms
FROM pattern_library
ORDER BY success_rate DESC, observation_count DESC
LIMIT 20;
```

---

## Appendix: Related Files

**Context Requirements**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- Defines ActivityTemplate.ContextRequirement schema
- Used in gatherContext() at memory-agent.ts:445

**Session Memory**: `repos/metabob-opencode/packages/opencode/src/session/session-memory.ts`
- Manages impulse storage per session
- Used throughout memory-agent.ts

**Impulse Resolver**: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`
- Loads impulse content from pointers
- Used at memory-agent.ts:1008

**Activity Template**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- Defines impulse schemas and context requirements
- Referenced in activity.ts:8

---

## Summary

This trace document provides:
1. ✅ **5 capture points** with exact file paths and line numbers
2. ✅ **Complete data schemas** for all captures (ImpulseMappingRecord compliance)
3. ✅ **Implementation pseudocode** for each capture point
4. ✅ **Impulse usage tracking** algorithm with snippet matching
5. ✅ **Storage strategy**: in-memory buffer + persistent database
6. ✅ **Database schema** for learning data (3 tables)
7. ✅ **Implementation checklist** with 4-week timeline

**Next Steps**:
1. Execute Activity 2: Implement capture points and data collection
2. Execute Activity 3: Validate data collection completeness
3. Build pattern learning engine (Phase 2)
4. Integrate skip logic into session lifecycle (Phase 3)

**Key Insight**: The learning system learns by **observing what works** and **replaying successful patterns**, eliminating per-turn LLM analysis while maintaining quality through continuous validation.
