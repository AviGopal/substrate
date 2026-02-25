# Impulse Learning System: 4-Week Implementation Plan

**Date**: 2026-02-25  
**Purpose**: Detailed implementation roadmap for impulse learning system deployment

---

## Executive Summary

This document provides a complete 4-week implementation plan for the impulse learning system. The plan is structured in 4 phases, each building on the previous phase, with clear success criteria, testing procedures, and risk mitigation strategies.

**Goal**: Deploy impulse learning system that skips 60-80% of memory agent LLM calls while maintaining quality

**Timeline**: 4 weeks (20 working days)

**Phases**:
1. **Week 1**: Data Capture Infrastructure
2. **Week 2**: Pattern Learning Engine
3. **Week 3**: Skip Decision Integration
4. **Week 4**: Activity Template Learning & Validation

**Risk Mitigation**: Conservative thresholds, gradual rollout, comprehensive monitoring, quick rollback capability

---

## 4-Week Gantt Chart

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  IMPULSE LEARNING SYSTEM - 4-WEEK IMPLEMENTATION PLAN                         │
└────────────────────────────────────────────────────────────────────────────────┘

Week 1: DATA CAPTURE INFRASTRUCTURE
─────────────────────────────────────────────────────────────────────────────────
Day 1-2   │████████ Database Schema & Tables
Day 2-3   │    ████████ Capture Point 1: Intent Analysis
Day 3-4   │        ████████ Capture Point 2: Impulse Creation
Day 4-5   │            ████████ Capture Point 3: Response Usage
Day 5     │                ████ Testing & Validation
          └─────────────────────────────────────────────────────────────────────
           Mon    Tue    Wed    Thu    Fri

Week 2: PATTERN LEARNING ENGINE
─────────────────────────────────────────────────────────────────────────────────
Day 6-7   │████████ Pattern Extraction Algorithm
Day 7-8   │    ████████ Pattern Matching Algorithm
Day 8-9   │        ████████ Impulse Replay Logic
Day 9-10  │            ████████ Pattern Storage & Retrieval
Day 10    │                ████ Testing & Validation
          └─────────────────────────────────────────────────────────────────────
           Mon    Tue    Wed    Thu    Fri

Week 3: SKIP DECISION INTEGRATION
─────────────────────────────────────────────────────────────────────────────────
Day 11-12 │████████ Skip Decision Function
Day 12-13 │    ████████ Fallback Strategies
Day 13-14 │        ████████ Turn Lifecycle Hook
Day 14-15 │            ████████ Tracking & Monitoring
Day 15    │                ████ Testing & Validation
          └─────────────────────────────────────────────────────────────────────
           Mon    Tue    Wed    Thu    Fri

Week 4: ACTIVITY LEARNING & VALIDATION
─────────────────────────────────────────────────────────────────────────────────
Day 16-17 │████████ Activity Learning Capture
Day 17-18 │    ████████ Activity Context Skip Logic
Day 18-19 │        ████████ Dashboard & Monitoring
Day 19-20 │            ████████ End-to-End Testing
Day 20    │                ████ Production Deployment
          └─────────────────────────────────────────────────────────────────────
           Mon    Tue    Wed    Thu    Fri

Legend: ████ = Active Work Period
```

---

## Phase 1: Data Capture Infrastructure (Week 1)

### Overview

Implement all data capture points and storage infrastructure to begin collecting learning data.

**Goal**: Capture 100% of turns for learning without affecting system performance

**Key Deliverables**:
- Database tables created and indexed
- 5 capture points instrumented
- In-memory learning buffer implemented
- Data flowing to database

### Task Breakdown

#### Task 1.1: Create Database Schema (Days 1-2, 16 hours)

**What to Implement**:
- Create 3 learning database tables
- Create all indexes
- Implement database migration script
- Test schema with sample data

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/database-schema.sql
- repos/metabob-opencode/packages/opencode/src/learning/learning-database.ts
- repos/metabob-opencode/packages/opencode/src/learning/migrations/001-initial-schema.ts
```

**Implementation Steps**:

1. **Create database-schema.sql** (4 hours):
```sql
-- impulse_mapping_records table
CREATE TABLE impulse_mapping_records (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  normalized_pattern TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  intent_confidence REAL NOT NULL,
  recent_files TEXT NOT NULL,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  impulses TEXT NOT NULL,
  task_succeeded BOOLEAN NOT NULL,
  response_quality REAL NOT NULL,
  impulses_used_count INTEGER NOT NULL,
  time_to_success INTEGER NOT NULL,
  record_id TEXT NOT NULL,
  
  INDEX idx_normalized_pattern (normalized_pattern),
  INDEX idx_intent_type (intent_type),
  INDEX idx_session_id (session_id),
  INDEX idx_captured_at (captured_at DESC)
);

-- pattern_library table
CREATE TABLE pattern_library (
  id TEXT PRIMARY KEY,
  template TEXT NOT NULL,
  normalized TEXT NOT NULL,
  variables TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  impulse_mapping TEXT NOT NULL,
  observation_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  avg_response_time_ms REAL DEFAULT 0.0,
  is_reliable BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  first_observed INTEGER NOT NULL,
  last_used INTEGER NOT NULL,
  last_updated INTEGER NOT NULL,
  metadata TEXT,
  
  INDEX idx_normalized (normalized),
  INDEX idx_intent_type (intent_type),
  INDEX idx_success_rate (success_rate DESC),
  INDEX idx_is_reliable (is_reliable),
  INDEX idx_is_active (is_active),
  INDEX idx_last_used (last_used DESC),
  INDEX idx_observation_count (observation_count DESC)
);

-- memory_agent_performance table
CREATE TABLE memory_agent_performance (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  skipped BOOLEAN NOT NULL,
  skip_reason TEXT,
  skip_confidence REAL,
  fallback_strategy TEXT,
  pattern_id TEXT,
  pattern_template TEXT,
  pattern_confidence REAL,
  variable_bindings TEXT,
  activity_id TEXT,
  template_id TEXT,
  requirement_count INTEGER,
  impulses_created INTEGER NOT NULL,
  impulses_loaded INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  task_succeeded BOOLEAN,
  response_quality REAL,
  decision_duration_ms REAL NOT NULL,
  fallback_duration_ms REAL,
  total_duration_ms REAL NOT NULL,
  llm_time_saved_ms REAL,
  captured_at INTEGER NOT NULL,
  
  INDEX idx_session_turn (session_id, turn_number),
  INDEX idx_skipped (skipped),
  INDEX idx_skip_reason (skip_reason),
  INDEX idx_pattern_id (pattern_id),
  INDEX idx_captured_at (captured_at DESC)
);
```

2. **Create learning-database.ts wrapper** (6 hours):
```typescript
/**
 * Learning database wrapper
 * Provides typed interface to learning tables
 */
import Database from 'better-sqlite3'
import * as path from 'path'

export class LearningDatabase {
  private static db: Database.Database | null = null
  
  static async initialize(): Promise<void> {
    const dbPath = path.join(process.cwd(), '.opencode', 'learning.db')
    this.db = new Database(dbPath)
    
    // Run schema migration
    await this.runMigrations()
  }
  
  static async runMigrations(): Promise<void> {
    const schema = readFileSync('./database-schema.sql', 'utf-8')
    this.db!.exec(schema)
  }
  
  static async insert(table: string, data: Record<string, any>): Promise<void> {
    // Implementation
  }
  
  static async update(table: string, id: string, data: Record<string, any>): Promise<void> {
    // Implementation
  }
  
  static async get(table: string, id: string): Promise<any> {
    // Implementation
  }
  
  static async query(sql: string, params: any[] = []): Promise<any[]> {
    // Implementation
  }
  
  // Specialized methods
  static async insertMappingRecord(record: ImpulseMappingRecord): Promise<void> {
    // Implementation
  }
  
  static async insertPatternRecord(pattern: UserPattern): Promise<void> {
    // Implementation
  }
  
  static async insertPerformanceRecord(record: any): Promise<void> {
    // Implementation
  }
}
```

3. **Test database operations** (6 hours):
```typescript
// Test insert, update, query operations
// Test index performance
// Test concurrent access
// Verify schema constraints
```

**Dependencies**: None (first task)

**Testing Strategy**:
- Unit tests for database operations
- Load test with 10,000 records
- Query performance test (< 5ms for indexed queries)
- Concurrent write test

**Success Criteria**:
- ✅ All 3 tables created
- ✅ All indexes created
- ✅ Insert operations work
- ✅ Query operations < 5ms
- ✅ Database file created at `.opencode/learning.db`

---

#### Task 1.2: Implement Learning Buffer (Days 2-3, 8 hours)

**What to Implement**:
- In-memory buffer for session-level captures
- Flush logic when turn completes
- Buffer management (limits, cleanup)

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/learning-buffer.ts
```

**Implementation**:

```typescript
/**
 * In-memory learning buffer
 * Collects data during session, flushes to database at end
 */
export class LearningBuffer {
  // Session-level buffers
  private static sessionBuffers = new Map<string, SessionLearningRecord>()
  
  // Activity-level buffers
  private static activityBuffers = new Map<string, ActivityLearningRecord>()
  
  static storeIntentCapture(sessionID: string, capture: UserIntentCapture): void {
    let record = this.sessionBuffers.get(sessionID)
    if (!record) {
      record = { sessionID, captures: [] }
      this.sessionBuffers.set(sessionID, record)
    }
    record.intentCapture = capture
  }
  
  static appendImpulseCapture(sessionID: string, capture: ImpulseCreationCapture): void {
    const record = this.sessionBuffers.get(sessionID)
    if (!record) throw new Error(`No learning record for session ${sessionID}`)
    record.impulseCapture = capture
  }
  
  static appendResponseCapture(sessionID: string, capture: ResponseCapture): void {
    const record = this.sessionBuffers.get(sessionID)
    if (!record) throw new Error(`No learning record for session ${sessionID}`)
    record.responseCapture = capture
    
    // Turn complete - flush to database
    if (record.intentCapture && record.impulseCapture && record.responseCapture) {
      this.flushSessionRecord(sessionID, record)
    }
  }
  
  private static async flushSessionRecord(
    sessionID: string,
    record: SessionLearningRecord
  ): Promise<void> {
    // Build ImpulseMappingRecord
    const mappingRecord: ImpulseMappingRecord = {
      // ... build from captures
    }
    
    // Persist to database
    await LearningDatabase.insertMappingRecord(mappingRecord)
    
    // Clear buffer
    this.sessionBuffers.delete(sessionID)
    
    log.info('flushed session learning record', {
      sessionID,
      recordId: mappingRecord.metadata.recordId,
    })
  }
}
```

**Dependencies**: Task 1.1 (database)

**Testing Strategy**:
- Unit tests for buffer operations
- Test flush triggers
- Test buffer cleanup
- Test concurrent sessions

**Success Criteria**:
- ✅ Buffer stores captures correctly
- ✅ Flush triggers automatically
- ✅ Data persists to database
- ✅ No memory leaks

---

#### Task 1.3: Capture Point 1 - Intent Analysis (Days 2-3, 8 hours)

**What to Implement**:
- Capture intent analysis results after analyzeIntent()
- Store in learning buffer

**File Locations**:
```
MODIFY:
- repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts (line 431)
```

**Implementation**:

```typescript
// In analyzeIntent() function, after line 379 (generateObject call)
export async function analyzeIntent(input: {
  sessionID: string
  promptText: string
  recentMessages?: MessageV2.WithParts[]
}): Promise<Intent> {
  
  const start = Date.now()
  
  // ... existing code ...
  
  const result = await generateObject({ /* ... */ })
  
  // ✅ CAPTURE POINT 1: After intent analysis completes
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
  
  await LearningBuffer.storeIntentCapture(input.sessionID, userIntentCapture)
  
  // ... continue with existing code ...
}
```

**Dependencies**: Task 1.2 (learning buffer)

**Testing Strategy**:
- Test with sample prompts
- Verify data captured correctly
- Test with edge cases (empty prompt, very long prompt)

**Success Criteria**:
- ✅ Intent captured after every analyzeIntent() call
- ✅ Data includes all required fields
- ✅ No performance degradation

---

#### Task 1.4: Capture Point 2 - Impulse Creation (Days 3-4, 8 hours)

**What to Implement**:
- Capture impulses after prepare()
- Include context (recent files)

**File Locations**:
```
MODIFY:
- repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts (line 1058)
```

**Implementation**:

```typescript
// In prepare() function, after line 1027 (after impulse loop)
export async function prepare(input: { 
  sessionID: string
  intent: Intent
  turnNumber: number 
}): Promise<PrepareResult> {
  
  // ... existing impulse creation code ...
  
  // ✅ CAPTURE POINT 2: After impulse creation completes
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
  
  // Populate impulses array
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
  
  await LearningBuffer.appendImpulseCapture(input.sessionID, impulseCapture)
  
  // ... continue with existing code ...
}
```

**Dependencies**: Task 1.3 (capture point 1)

**Testing Strategy**:
- Test with various intent types
- Verify impulse metadata captured
- Test with 0 impulses, 1 impulse, many impulses

**Success Criteria**:
- ✅ Impulses captured after every prepare() call
- ✅ Context (recent files) included
- ✅ All impulse metadata captured

---

#### Task 1.5: Capture Point 3 - Response Usage (Days 4-5, 8 hours)

**What to Implement**:
- Capture response after agent generates
- Detect impulse usage with snippet matching
- Trigger flush to database

**File Locations**:
```
MODIFY:
- repos/metabob-opencode/packages/opencode/src/session/index.ts (Session.prompt or Session.turn)

NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/impulse-usage-tracker.ts
```

**Implementation**:

```typescript
// In Session.prompt or Session.turn, after agent response
async function captureResponseUsage(
  sessionID: string,
  turnNumber: number,
  response: string,
  responseTime: number
): Promise<void> {
  
  const { trackImpulseUsage } = await import('./learning/impulse-usage-tracker')
  
  // Get impulses from session memory
  const impulses = await SessionMemory.listImpulses(sessionID)
  
  // Track which impulses were used
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
  
  // ✅ CAPTURE POINT 3: Response captured, triggers flush
  await LearningBuffer.appendResponseCapture(sessionID, responseCapture)
}
```

**Impulse Usage Tracker**:

```typescript
/**
 * Track which impulses were used in response
 */
export async function trackImpulseUsage(
  response: string,
  impulses: ActivityTemplate.Impulse.Schema[]
): Promise<Record<string, boolean>> {
  
  const usageMap: Record<string, boolean> = {}
  
  for (const impulse of impulses) {
    if (!impulse.loaded || !impulse.content) {
      usageMap[impulse.id] = false
      continue
    }
    
    // Extract unique snippets
    const snippets = extractUniqueSnippets(impulse.content, {
      snippetCount: 3,
      minLength: 20,
      maxLength: 50,
    })
    
    // Check if response contains any snippet
    const isUsed = snippets.some(snippet => {
      const normalizedSnippet = snippet.replace(/\s+/g, ' ').trim()
      const normalizedResponse = response.replace(/\s+/g, ' ').trim()
      return normalizedResponse.includes(normalizedSnippet)
    })
    
    usageMap[impulse.id] = isUsed
  }
  
  return usageMap
}
```

**Dependencies**: Task 1.4 (capture point 2)

**Testing Strategy**:
- Test snippet matching accuracy
- Test with various response types
- Measure false positive/negative rates

**Success Criteria**:
- ✅ Response captured after every turn
- ✅ Impulse usage detected (>80% accuracy)
- ✅ Data flushed to database automatically

---

#### Task 1.6: Testing & Validation (Day 5, 8 hours)

**What to Test**:
- End-to-end capture flow
- Database performance
- Buffer management
- Data quality

**Testing Procedures**:

1. **Functional Testing** (3 hours):
```typescript
// Test complete capture flow
describe('Data Capture Flow', () => {
  it('should capture complete turn data', async () => {
    // 1. Trigger analyzeIntent
    // 2. Trigger prepare
    // 3. Generate response
    // 4. Verify data in database
    
    const records = await LearningDatabase.query(`
      SELECT * FROM impulse_mapping_records 
      WHERE session_id = ?
    `, [sessionID])
    
    expect(records.length).toBe(1)
    expect(records[0].intent_type).toBeDefined()
    expect(JSON.parse(records[0].impulses).length).toBeGreaterThan(0)
  })
})
```

2. **Performance Testing** (3 hours):
```typescript
// Test capture overhead
describe('Performance Impact', () => {
  it('should add < 10ms overhead per turn', async () => {
    const start = Date.now()
    
    // Run 100 turns with capture
    for (let i = 0; i < 100; i++) {
      await executeTurnWithCapture()
    }
    
    const avgOverhead = (Date.now() - start) / 100
    expect(avgOverhead).toBeLessThan(10)
  })
})
```

3. **Data Quality Testing** (2 hours):
```typescript
// Verify captured data quality
describe('Data Quality', () => {
  it('should have complete records', async () => {
    const records = await LearningDatabase.query(`
      SELECT * FROM impulse_mapping_records
      WHERE task_succeeded IS NULL
    `)
    
    expect(records.length).toBe(0) // No incomplete records
  })
})
```

**Success Criteria**:
- ✅ All 5 capture points working
- ✅ Data flowing to database
- ✅ < 10ms overhead per turn
- ✅ 100% capture rate (no missed turns)
- ✅ Data quality validated

---

### Phase 1 Summary

**Deliverables**:
- ✅ 3 database tables with indexes
- ✅ In-memory learning buffer
- ✅ 5 capture points instrumented
- ✅ Impulse usage tracking algorithm
- ✅ Complete test coverage

**Files Modified**: 2  
**Files Created**: 4  
**Lines of Code**: ~1,500

**Validation**:
- Run system for 48 hours
- Verify continuous data capture
- No performance degradation
- Database growing appropriately

---

## Phase 2: Pattern Learning Engine (Week 2)

### Overview

Implement pattern extraction, matching, and impulse replay algorithms.

**Goal**: Build pattern library from captured data, enable pattern-based impulse replay

**Key Deliverables**:
- Pattern extraction working
- Pattern matching with confidence scoring
- Impulse replay from patterns
- Pattern storage and retrieval

### Task Breakdown

#### Task 2.1: Pattern Extraction Algorithm (Days 6-7, 16 hours)

**What to Implement**:
- Pattern extraction from user messages
- Variable detection (files, identifiers, commands, values)
- Template creation with placeholders
- Normalized pattern generation

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/pattern-extraction.ts
```

**Implementation** (see IMPULSE_LEARNING_PATTERN_ALGORITHMS.md Part 1.3):

```typescript
export function extractPattern(
  userMessage: string,
  intentType?: string
): UserPattern {
  // Clean message
  const cleaned = cleanMessage(userMessage)
  
  // Detect variables
  const variables: PatternVariable[] = []
  let template = cleaned
  
  // Detect files
  const fileMatches = detectFiles(template)
  for (const match of fileMatches) {
    const varName = `file${variables.length}`
    variables.push({
      name: varName,
      type: 'file',
      position: match.position,
      originalValue: match.value,
    })
    template = template.replace(match.value, `{${varName}}`)
  }
  
  // Detect identifiers
  const identifierMatches = detectIdentifiers(template)
  // ... (similar pattern)
  
  // Create normalized pattern
  const normalized = createNormalizedPattern(template)
  
  // Infer intent type
  const inferredIntent = intentType || inferIntentType(template, variables)
  
  return {
    template,
    variables,
    normalized,
    intentType: inferredIntent,
    impulseMapping: [],
    metrics: { /* ... */ },
    patternId: generatePatternId(normalized, inferredIntent),
    firstObserved: Date.now(),
    lastUpdated: Date.now(),
  }
}
```

**Dependencies**: Phase 1 complete (database and capture)

**Testing Strategy**:
- Test with 50+ sample messages
- Verify variable detection accuracy
- Test edge cases (no variables, many variables)
- Benchmark performance (<10ms per message)

**Success Criteria**:
- ✅ Extracts patterns from messages
- ✅ Detects 4 variable types (file, identifier, command, value)
- ✅ Generates stable pattern IDs
- ✅ < 10ms processing time

---

#### Task 2.2: Pattern Matching Algorithm (Days 7-8, 16 hours)

**What to Implement**:
- Levenshtein distance calculation
- Multi-factor confidence scoring
- Variable compatibility checking
- Pattern match ranking

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/pattern-matching.ts
```

**Implementation** (see IMPULSE_LEARNING_PATTERN_ALGORITHMS.md Part 2.3):

```typescript
export function matchPattern(
  userMessage: string,
  learnedPatterns: UserPattern[],
  options: {
    minConfidence?: number
    intentType?: string
  } = {}
): PatternMatch | null {
  
  const minConfidence = options.minConfidence || 0.75
  
  // Extract pattern from new message
  const newPattern = extractPattern(userMessage, options.intentType)
  
  // Filter candidates
  let candidates = learnedPatterns
  if (options.intentType) {
    candidates = candidates.filter(p => p.intentType === options.intentType)
  }
  
  // Compute match scores
  const matches: PatternMatch[] = []
  for (const candidate of candidates) {
    const matchDetails = computeMatchScore(newPattern, candidate)
    
    // Weighted confidence
    const confidence = (
      matchDetails.normalizedSimilarity * 0.4 +
      matchDetails.variableCompatibility * 0.3 +
      matchDetails.intentAgreement * 0.2 +
      matchDetails.structuralSimilarity * 0.1
    )
    
    if (confidence >= minConfidence) {
      const bindings = extractVariableBindings(newPattern, candidate)
      matches.push({ pattern: candidate, confidence, variableBindings: bindings, matchDetails })
    }
  }
  
  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence)
  
  return matches.length > 0 ? matches[0] : null
}
```

**Dependencies**: Task 2.1 (pattern extraction)

**Testing Strategy**:
- Test with known pattern pairs
- Measure accuracy (precision/recall)
- Benchmark performance (<50ms for 1000 patterns)
- Test edge cases (exact match, no match)

**Success Criteria**:
- ✅ Matches patterns with confidence scores
- ✅ Levenshtein distance working correctly
- ✅ Variable compatibility checking works
- ✅ < 50ms for 1000 patterns

---

#### Task 2.3: Impulse Replay Logic (Days 8-9, 16 hours)

**What to Implement**:
- Impulse reconstruction from patterns
- Variable binding and path transformation
- Support for 5 impulse types

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/impulse-replay.ts
```

**Implementation** (see IMPULSE_LEARNING_PATTERN_ALGORITHMS.md Part 3.2):

```typescript
export async function replayImpulsesFromPattern(
  match: PatternMatch,
  sessionID: string,
  context: { recentFiles: string[]; workingDirectory: string }
): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  
  const impulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  
  for (let i = 0; i < match.pattern.impulseMapping.length; i++) {
    const mapping = match.pattern.impulseMapping[i]
    const impulseId = `replay_${i}`
    
    let pointer: ImpulsePointer
    
    switch (mapping.type) {
      case 'file':
        pointer = await constructFilePointer(mapping, match.variableBindings, context)
        break
      case 'bashOutput':
        pointer = await constructBashPointer(mapping, match.variableBindings)
        break
      // ... other types
    }
    
    impulses[impulseId] = {
      id: impulseId,
      type: mapping.type,
      pointer,
      priority: mapping.priority,
      budget: mapping.budget,
      loaded: false,
      metadata: {
        source: 'pattern-replay',
        patternId: match.pattern.patternId,
        confidence: match.confidence,
      }
    }
  }
  
  return impulses
}
```

**Dependencies**: Task 2.2 (pattern matching)

**Testing Strategy**:
- Test impulse reconstruction
- Test path transformations
- Test variable substitution
- Verify impulse validity

**Success Criteria**:
- ✅ Reconstructs impulses from patterns
- ✅ Variable binding works correctly
- ✅ Path transformations work
- ✅ < 20ms per impulse

---

#### Task 2.4: Pattern Storage & Retrieval (Days 9-10, 16 hours)

**What to Implement**:
- Pattern library CRUD operations
- Pattern metrics updates
- Pattern querying and filtering
- Pruning logic

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/pattern-library.ts
```

**Implementation**:

```typescript
export class PatternLibrary {
  /**
   * Create pattern from mapping record
   */
  static async createPattern(
    mappingRecord: ImpulseMappingRecord
  ): Promise<string> {
    const pattern = extractPattern(
      mappingRecord.userIntent.rawText,
      mappingRecord.userIntent.intentType
    )
    
    // Check if exists
    const existing = await this.findPattern(pattern.normalized, pattern.intentType)
    if (existing) return existing.id
    
    // Build impulse mapping
    const impulseMapping = this.buildImpulseMapping(mappingRecord, pattern)
    
    // Insert into database
    await LearningDatabase.insertPatternRecord({
      ...pattern,
      impulseMapping,
      observation_count: 1,
      success_count: mappingRecord.outcome.taskSucceeded ? 1 : 0,
      failure_count: mappingRecord.outcome.taskSucceeded ? 0 : 1,
    })
    
    return pattern.patternId
  }
  
  /**
   * Update pattern metrics on success
   */
  static async updateOnSuccess(
    patternId: string,
    responseTime: number
  ): Promise<void> {
    const pattern = await LearningDatabase.get('pattern_library', patternId)
    
    const newSuccessCount = pattern.success_count + 1
    const newObservationCount = pattern.observation_count + 1
    const newSuccessRate = newSuccessCount / newObservationCount
    
    // Exponential moving average for response time
    const alpha = 0.2
    const newAvgTime = alpha * responseTime + (1 - alpha) * pattern.avg_response_time_ms
    
    await LearningDatabase.update('pattern_library', patternId, {
      success_count: newSuccessCount,
      observation_count: newObservationCount,
      success_rate: newSuccessRate,
      avg_response_time_ms: newAvgTime,
      is_reliable: newSuccessRate >= 0.75 && newObservationCount >= 3 ? 1 : 0,
      last_used: Date.now(),
    })
  }
  
  /**
   * Get active patterns for matching
   */
  static async getActivePatterns(options: {
    minSuccessRate?: number
    minObservations?: number
  } = {}): Promise<UserPattern[]> {
    const minSuccessRate = options.minSuccessRate || 0.75
    const minObservations = options.minObservations || 3
    
    const records = await LearningDatabase.query(`
      SELECT *
      FROM pattern_library
      WHERE 
        is_active = 1
        AND success_rate >= ?
        AND observation_count >= ?
      ORDER BY last_used DESC
    `, [minSuccessRate, minObservations])
    
    return records.map(r => this.recordToPattern(r))
  }
}
```

**Dependencies**: Task 2.3 (impulse replay)

**Testing Strategy**:
- Test CRUD operations
- Test metrics updates
- Test querying and filtering
- Test pruning logic

**Success Criteria**:
- ✅ Pattern CRUD operations work
- ✅ Metrics updates correctly
- ✅ Queries return filtered results
- ✅ < 5ms for pattern retrieval

---

#### Task 2.5: Testing & Validation (Day 10, 8 hours)

**What to Test**:
- End-to-end pattern learning flow
- Pattern matching accuracy
- Impulse replay correctness

**Testing Procedures**:

1. **Pattern Learning Test** (3 hours):
```typescript
describe('Pattern Learning', () => {
  it('should learn pattern from captured data', async () => {
    // 1. Capture turn with "Fix bug in auth.ts"
    // 2. Verify pattern created in database
    // 3. Check pattern metrics
    
    const patterns = await PatternLibrary.getActivePatterns()
    const authPattern = patterns.find(p => p.template.includes('fix bug'))
    
    expect(authPattern).toBeDefined()
    expect(authPattern.variables.length).toBe(1)
    expect(authPattern.variables[0].type).toBe('file')
  })
})
```

2. **Pattern Matching Test** (3 hours):
```typescript
describe('Pattern Matching', () => {
  it('should match similar messages', async () => {
    // Learn pattern from "Fix bug in auth.ts"
    // Try matching "Fix bug in user.py"
    
    const match = matchPattern('Fix bug in user.py', learnedPatterns)
    
    expect(match).toBeDefined()
    expect(match.confidence).toBeGreaterThan(0.85)
    expect(match.variableBindings.file0).toBe('user.py')
  })
})
```

3. **Impulse Replay Test** (2 hours):
```typescript
describe('Impulse Replay', () => {
  it('should reconstruct impulses from pattern', async () => {
    const impulses = await replayImpulsesFromPattern(match, sessionID, context)
    
    expect(Object.keys(impulses).length).toBeGreaterThan(0)
    expect(impulses.replay_0.type).toBe('file')
    expect(impulses.replay_0.pointer.path).toContain('user.py')
  })
})
```

**Success Criteria**:
- ✅ Pattern learning end-to-end works
- ✅ Pattern matching accuracy >80%
- ✅ Impulse replay produces valid impulses
- ✅ Pattern library grows appropriately

---

### Phase 2 Summary

**Deliverables**:
- ✅ Pattern extraction algorithm
- ✅ Pattern matching with confidence scoring
- ✅ Impulse replay logic
- ✅ Pattern library with CRUD operations
- ✅ Complete test coverage

**Files Modified**: 0  
**Files Created**: 4  
**Lines of Code**: ~2,000

**Validation**:
- Run system for 72 hours
- Verify patterns being learned
- Check pattern library growth (target: 20-50 patterns)
- Validate pattern matching accuracy

---

## Phase 3: Skip Decision Integration (Week 3)

### Overview

Integrate skip decision logic into turn lifecycle, implement fallback strategies, enable learning-based skipping.

**Goal**: Start skipping memory agent LLM calls with conservative thresholds

**Key Deliverables**:
- Skip decision function working
- 4 fallback strategies implemented
- Turn lifecycle hook registered
- Tracking and monitoring operational

### Task Breakdown

#### Task 3.1: Skip Decision Function (Days 11-12, 16 hours)

**What to Implement**:
- Core shouldSkipMemoryAgentLLM() function
- 4 skip rules (trivial, continuation, pattern, activity)
- Confidence scoring

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/skip-decision.ts
```

**Implementation** (see IMPULSE_LEARNING_SKIP_DECISION_LOGIC.md Part 1.1):

```typescript
export async function shouldSkipMemoryAgentLLM(input: {
  sessionID: string
  promptText: string
  turnNumber: number
  agent: Agent.Info
}): Promise<SkipDecision> {
  
  const start = Date.now()
  
  // Rule 1: Trivial messages
  const trivialMatch = detectTrivialMessage(input.promptText)
  if (trivialMatch) {
    return {
      shouldSkip: true,
      reason: 'trivial_message',
      confidence: trivialMatch.confidence,
      fallbackStrategy: 'do_nothing',
      metadata: { pattern: trivialMatch.pattern, duration: Date.now() - start }
    }
  }
  
  // Rule 2: Continuations
  const continuationMatch = detectContinuation(input.promptText)
  if (continuationMatch) {
    return {
      shouldSkip: true,
      reason: 'continuation',
      confidence: continuationMatch.confidence,
      fallbackStrategy: 'keep_existing',
      metadata: { pattern: continuationMatch.pattern, duration: Date.now() - start }
    }
  }
  
  // Rule 3: Pattern match (CONSERVATIVE: 0.90 initially, lower to 0.85 after validation)
  const patternMatch = await matchAgainstLearnedPatterns(input)
  if (patternMatch && patternMatch.confidence >= 0.90) {
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
  
  // Rule 4: Activity context
  const activityContext = await checkActivityContextRequirements(input.sessionID)
  if (activityContext && activityContext.hasRequirements) {
    return {
      shouldSkip: true,
      reason: 'activity_context',
      confidence: 0.95,
      fallbackStrategy: 'template_requirements',
      metadata: {
        activityId: activityContext.activityId,
        templateId: activityContext.templateId,
        requirementCount: activityContext.requirements.length,
        duration: Date.now() - start,
      }
    }
  }
  
  // No skip
  return {
    shouldSkip: false,
    reason: 'no_match',
    confidence: 0,
    fallbackStrategy: null,
    metadata: { duration: Date.now() - start }
  }
}
```

**Dependencies**: Phase 2 complete (pattern library)

**Testing Strategy**:
- Test each skip rule independently
- Test rule priority (trivial > continuation > pattern > activity)
- Benchmark decision time (<50ms)
- Test false positive/negative rates

**Success Criteria**:
- ✅ All 4 skip rules working
- ✅ Decision time < 50ms
- ✅ Confidence scores accurate
- ✅ Rule priority correct

---

#### Task 3.2: Fallback Strategies (Days 12-13, 16 hours)

**What to Implement**:
- 4 fallback strategy implementations
- Impulse creation logic for each strategy

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/fallback-strategies.ts
```

**Implementation** (see IMPULSE_LEARNING_SKIP_DECISION_LOGIC.md Part 3):

```typescript
/**
 * Fallback: Do Nothing (trivial messages)
 */
export async function fallback_doNothing(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  // No impulses created
  return {
    impulsesCreated: 0,
    impulsesLoaded: 0,
    totalTokens: 0,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'trivial_message',
    duration: 0,
  }
}

/**
 * Fallback: Keep Existing (continuations)
 */
export async function fallback_keepExisting(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  const impulses = await SessionMemory.listImpulses(input.sessionID)
  const loadedImpulses = impulses.filter(imp => imp.loaded)
  const totalTokens = loadedImpulses.reduce((sum, imp) => sum + (imp.tokenCount || 0), 0)
  
  return {
    impulsesCreated: 0,
    impulsesLoaded: loadedImpulses.length,
    totalTokens,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'continuation',
    duration: 0,
  }
}

/**
 * Fallback: Pattern Replay
 */
export async function fallback_patternReplay(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  const start = Date.now()
  
  // Extract pattern match
  const patternMatch = {
    pattern: input.decision.metadata.pattern,
    confidence: input.decision.confidence,
    variableBindings: input.decision.metadata.variableBindings,
  }
  
  // Get context
  const context = await getSessionContext(input.sessionID)
  
  // Replay impulses
  const replayedImpulses = await replayImpulsesFromPattern(patternMatch, input.sessionID, context)
  
  // Add to session memory
  let impulsesCreated = 0
  let totalTokens = 0
  
  for (const [id, impulse] of Object.entries(replayedImpulses)) {
    await SessionMemory.addImpulse(input.sessionID, impulse)
    impulsesCreated++
    
    if (impulse.priority === 'high' || impulse.priority === 'medium') {
      await SessionMemory.loadImpulse(input.sessionID, impulse.id)
      totalTokens += impulse.tokenCount || 0
    }
  }
  
  return {
    impulsesCreated,
    impulsesLoaded: impulsesCreated,
    totalTokens,
    impulsesUnloaded: 0,
    skipped: true,
    skipReason: 'pattern_match',
    duration: Date.now() - start,
  }
}

/**
 * Fallback: Template Requirements
 */
export async function fallback_templateRequirements(input: {
  sessionID: string
  decision: SkipDecision
}): Promise<FallbackResult> {
  // Similar to pattern replay, but using template requirements
  // ... implementation ...
}
```

**Dependencies**: Task 3.1 (skip decision)

**Testing Strategy**:
- Test each fallback independently
- Verify impulse creation correctness
- Test performance (<100ms per fallback)
- Test edge cases (no impulses, many impulses)

**Success Criteria**:
- ✅ All 4 fallbacks working
- ✅ Impulses created correctly
- ✅ < 100ms execution time
- ✅ No errors in edge cases

---

#### Task 3.3: Turn Lifecycle Hook (Days 13-14, 16 hours)

**What to Implement**:
- Register skip-decision hook at priority 5
- Update memory-management hook to check skip flag
- Hook enable/disable logic

**File Locations**:
```
MODIFY:
- repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts
```

**Implementation** (see IMPULSE_LEARNING_SKIP_DECISION_LOGIC.md Part 4.1):

```typescript
/**
 * Memory Agent Skip Decision Hook
 * Priority: 5 (before memory-management at 10)
 */
TurnLifecycle.registerHook({
  name: "memory-agent-skip-decision",
  priority: 5,

  enabled: async (ctx) => {
    const config = await Config.get()
    
    // Only if impulse learning enabled
    if (!config.impulseLearning?.enabled) return false
    
    // Only for primary agents
    if (ctx.agent.mode !== "primary") return false
    
    // Need prompt to analyze
    if (ctx.promptText.length < 1) return false
    
    return true
  },

  execute: async (ctx) => {
    const start = Date.now()
    
    try {
      const { shouldSkipMemoryAgentLLM } = await import('./learning/skip-decision')
      
      // Decide if we should skip
      const decision = await shouldSkipMemoryAgentLLM({
        sessionID: ctx.sessionID,
        promptText: ctx.promptText,
        turnNumber: ctx.metadata?.turnNumber || 0,
        agent: ctx.agent,
      })
      
      if (!decision.shouldSkip) {
        // No skip - track and continue
        await trackSkipDecision(ctx.sessionID, decision, null)
        return {
          success: true,
          modified: false,
          duration: Date.now() - start,
          metadata: { skipped: false, reason: decision.reason },
        }
      }
      
      // Execute fallback strategy
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
          throw new Error(`Unknown fallback: ${decision.fallbackStrategy}`)
      }
      
      // Track decision
      await trackSkipDecision(ctx.sessionID, decision, fallbackResult)
      
      // Disable memory-management hook for this turn
      ctx.metadata = ctx.metadata || {}
      ctx.metadata.memoryAgentSkipped = true
      ctx.metadata.skipReason = decision.reason
      
      return {
        success: true,
        modified: fallbackResult.impulsesCreated > 0,
        duration: Date.now() - start,
        metadata: {
          skipped: true,
          reason: decision.reason,
          confidence: decision.confidence,
          impulsesCreated: fallbackResult.impulsesCreated,
        },
      }
    } catch (error) {
      // Non-fatal: log and let memory-management run
      log.error('skip decision failed', { error })
      return { success: false, modified: false, duration: Date.now() - start }
    }
  },
})

/**
 * Update memory-management hook to check skip flag
 */
TurnLifecycle.registerHook({
  name: "memory-management",
  priority: 10,

  enabled: async (ctx) => {
    const config = await Config.get()
    if (config.sessionMemory?.enabled === false) return false
    
    // ✅ Check if skip-decision already handled this turn
    if (ctx.metadata?.memoryAgentSkipped === true) {
      log.info("memory-management: skipped via skip-decision hook", {
        sessionID: ctx.sessionID,
        skipReason: ctx.metadata.skipReason,
      })
      return false
    }
    
    if (ctx.agent.mode !== "primary") return false
    if (ctx.promptText.length < 10) return false
    
    return true
  },

  execute: async (ctx) => {
    // ... existing implementation unchanged ...
  },
})
```

**Dependencies**: Task 3.2 (fallback strategies)

**Testing Strategy**:
- Test hook registration
- Test hook priority (5 before 10)
- Test memory-management skip logic
- Test enable/disable conditions

**Success Criteria**:
- ✅ Hook registered at priority 5
- ✅ Hook runs before memory-management
- ✅ Skip flag prevents LLM call
- ✅ Enable/disable logic works

---

#### Task 3.4: Tracking & Monitoring (Days 14-15, 16 hours)

**What to Implement**:
- Skip decision tracking function
- Performance tracking queries
- Basic monitoring dashboard

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/tracking.ts
- repos/metabob-opencode/packages/opencode/src/learning/monitoring.ts
```

**Implementation**:

```typescript
/**
 * Track skip decision for metrics
 */
export async function trackSkipDecision(
  sessionID: string,
  decision: SkipDecision,
  fallbackResult: FallbackResult | null
): Promise<void> {
  
  const llmTimeSaved = decision.shouldSkip 
    ? estimateLLMTimeSaved(decision.reason)
    : 0
  
  const record = {
    id: generateRecordId(),
    session_id: sessionID,
    turn_number: await getCurrentTurnNumber(sessionID),
    user_message: await getLastUserMessage(sessionID),
    agent_name: 'general',
    
    skipped: decision.shouldSkip,
    skip_reason: decision.reason,
    skip_confidence: decision.confidence,
    fallback_strategy: decision.fallbackStrategy,
    
    pattern_id: decision.metadata.patternId || null,
    pattern_template: decision.metadata.template || null,
    pattern_confidence: decision.metadata.patternId ? decision.confidence : null,
    variable_bindings: decision.metadata.variableBindings 
      ? JSON.stringify(decision.metadata.variableBindings)
      : null,
    
    activity_id: decision.metadata.activityId || null,
    template_id: decision.metadata.templateId || null,
    requirement_count: decision.metadata.requirementCount || null,
    
    impulses_created: fallbackResult?.impulsesCreated || 0,
    impulses_loaded: fallbackResult?.impulsesLoaded || 0,
    total_tokens: fallbackResult?.totalTokens || 0,
    task_succeeded: null, // Updated later
    response_quality: null,
    
    decision_duration_ms: decision.metadata.duration,
    fallback_duration_ms: fallbackResult?.duration || null,
    total_duration_ms: decision.metadata.duration + (fallbackResult?.duration || 0),
    llm_time_saved_ms: llmTimeSaved,
    
    captured_at: Date.now(),
  }
  
  await LearningDatabase.insertPerformanceRecord(record)
}

/**
 * Get monitoring metrics
 */
export async function getMonitoringMetrics(
  startTime: number,
  endTime: number
): Promise<LearningMetrics> {
  
  const performanceRecords = await LearningDatabase.query(`
    SELECT * FROM memory_agent_performance
    WHERE captured_at >= ? AND captured_at <= ?
  `, [startTime, endTime])
  
  // Calculate metrics
  const totalTurns = performanceRecords.length
  const skippedTurns = performanceRecords.filter(r => r.skipped).length
  const skipRate = totalTurns > 0 ? skippedTurns / totalTurns : 0
  
  // ... calculate other metrics ...
  
  return {
    startTime,
    endTime,
    skip: { totalTurns, skippedTurns, skipRate, /* ... */ },
    quality: { /* ... */ },
    performance: { /* ... */ },
    patterns: { /* ... */ },
    generatedAt: Date.now(),
    version: '1.0',
  }
}
```

**Dependencies**: Task 3.3 (turn lifecycle hook)

**Testing Strategy**:
- Test tracking data persistence
- Test monitoring queries
- Verify metrics calculations
- Test dashboard rendering

**Success Criteria**:
- ✅ Tracking records all skip decisions
- ✅ Monitoring queries work
- ✅ Metrics calculated correctly
- ✅ Dashboard displays data

---

#### Task 3.5: Testing & Validation (Day 15, 8 hours)

**What to Test**:
- End-to-end skip flow
- Fallback strategy correctness
- Tracking accuracy
- Performance impact

**Testing Procedures**:

1. **Skip Decision Test** (3 hours):
```typescript
describe('Skip Decision Flow', () => {
  it('should skip trivial messages', async () => {
    const result = await executeTurn({
      sessionID: 'test',
      prompt: 'ok',
    })
    
    expect(result.memoryAgentSkipped).toBe(true)
    expect(result.skipReason).toBe('trivial_message')
  })
  
  it('should skip on pattern match', async () => {
    // Learn pattern
    await learnPattern('Fix bug in auth.ts')
    
    // Try matching message
    const result = await executeTurn({
      sessionID: 'test',
      prompt: 'Fix bug in user.py',
    })
    
    expect(result.memoryAgentSkipped).toBe(true)
    expect(result.skipReason).toBe('pattern_match')
    expect(result.impulses.length).toBeGreaterThan(0)
  })
})
```

2. **Quality Test** (3 hours):
```typescript
describe('Skip Quality', () => {
  it('should maintain quality on skipped turns', async () => {
    // Run 100 turns with skip enabled
    const results = await runManyTurns(100)
    
    const skippedResults = results.filter(r => r.skipped)
    const llmResults = results.filter(r => !r.skipped)
    
    const skipSuccessRate = skippedResults.filter(r => r.succeeded).length / skippedResults.length
    const llmSuccessRate = llmResults.filter(r => r.succeeded).length / llmResults.length
    
    // Quality delta should be >= -5% (allow small degradation initially)
    expect(skipSuccessRate - llmSuccessRate).toBeGreaterThan(-0.05)
  })
})
```

3. **Performance Test** (2 hours):
```typescript
describe('Skip Performance', () => {
  it('should be faster than LLM call', async () => {
    const skipTime = await measureSkipDecisionTime()
    const llmTime = await measureLLMCallTime()
    
    // Skip should be 90%+ faster
    expect(skipTime).toBeLessThan(llmTime * 0.1)
  })
})
```

**Success Criteria**:
- ✅ Skip decision working end-to-end
- ✅ All fallback strategies working
- ✅ Tracking capturing all decisions
- ✅ Quality maintained (delta >= -5%)
- ✅ Performance improved (90%+ faster)

---

### Phase 3 Summary

**Deliverables**:
- ✅ Skip decision function
- ✅ 4 fallback strategies
- ✅ Turn lifecycle hook integration
- ✅ Tracking and monitoring
- ✅ Complete test coverage

**Files Modified**: 1  
**Files Created**: 4  
**Lines of Code**: ~2,500

**Validation**:
- Enable skip decision in staging
- Run for 1 week with conservative thresholds (0.90 confidence)
- Monitor skip rate (target: 20-40% initially)
- Monitor quality delta (target: >= -5%)
- Adjust thresholds based on data

**Conservative Rollout**:
- Week 1: 0.90 confidence threshold (low skip rate, high quality)
- Week 2: 0.88 confidence threshold (increase skip rate)
- Week 3: 0.85 confidence threshold (target skip rate)
- Week 4: Monitor and stabilize

---

## Phase 4: Activity Template Learning & Validation (Week 4)

### Overview

Implement activity-specific learning, comprehensive validation, production deployment.

**Goal**: Deploy to production with full monitoring and validation framework

**Key Deliverables**:
- Activity learning working
- Comprehensive monitoring dashboard
- Pre/post deployment validation
- Production deployment

### Task Breakdown

#### Task 4.1: Activity Learning Capture (Days 16-17, 16 hours)

**What to Implement**:
- Capture activity contextRequirements usage
- Track impulse utilization per activity
- Store activity learning records

**File Locations**:
```
MODIFY:
- repos/metabob-opencode/packages/opencode/src/session/activity.ts (lines 884, 1113)

NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/activity-learning.ts
```

**Implementation**:

```typescript
// In activity.ts, after activity completes (line 884)
export async function complete(id: string): Promise<Info> {
  const activity = await load(id)
  
  // ... existing completion logic ...
  
  // ✅ CAPTURE: Activity learning
  if (activity.templateId) {
    const learningRecord = await buildActivityLearningRecord(activity, true)
    await LearningDatabase.insertActivityRecord(learningRecord)
  }
  
  // ... rest of code ...
}

async function buildActivityLearningRecord(
  activity: Activity.Info,
  succeeded: boolean
): Promise<ActivityLearningRecord> {
  
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

**Dependencies**: Phase 3 complete

**Testing Strategy**:
- Test activity learning capture
- Verify impulse utilization calculation
- Test with various templates

**Success Criteria**:
- ✅ Activity learning captured
- ✅ Impulse utilization tracked
- ✅ Data persisted to database

---

#### Task 4.2: Activity Context Skip Logic (Days 17-18, 16 hours)

**What to Implement**:
- Check learned activity mappings
- Skip gatherContext when confident
- Consistency scoring

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/activity-context-skip.ts
```

**Implementation**:

```typescript
/**
 * Check if activity has learned context mapping
 */
export async function getLearnedActivityContext(input: {
  templateId: string
  variables: Record<string, any>
}): Promise<LearnedContext | null> {
  
  const records = await LearningDatabase.query(`
    SELECT * FROM activity_learning_records
    WHERE 
      template_id = ?
      AND succeeded = 1
      AND impulse_utilization > 0.6
    ORDER BY timestamp DESC
    LIMIT 5
  `, [input.templateId])
  
  if (records.length < 5) {
    // Not enough observations
    return null
  }
  
  // Check consistency
  const consistencyScore = calculateMappingConsistency(records)
  if (consistencyScore < 0.8) {
    // Mappings not consistent
    return null
  }
  
  // Use most recent mapping
  const latestRecord = records[0]
  const impulsesMapped = JSON.parse(latestRecord.impulses_mapped)
  
  // Reconstruct impulses
  const impulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  for (const [id, mapping] of Object.entries(impulsesMapped)) {
    const impulse = await reconstructImpulseFromMapping(mapping as any, input.variables)
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
```

**Dependencies**: Task 4.1 (activity learning)

**Testing Strategy**:
- Test learned mapping retrieval
- Test consistency scoring
- Test impulse reconstruction

**Success Criteria**:
- ✅ Learned mappings retrieved
- ✅ Consistency calculated correctly
- ✅ Impulses reconstructed accurately

---

#### Task 4.3: Dashboard & Monitoring (Days 18-19, 16 hours)

**What to Implement**:
- Real-time monitoring dashboard
- 6 monitoring queries
- Alerting for anomalies

**File Locations**:
```
NEW FILES:
- repos/metabob-opencode/packages/opencode/src/learning/dashboard.ts
- repos/metabob-opencode/packages/opencode/src/learning/alerts.ts
```

**Implementation**:

```typescript
/**
 * Generate dashboard display
 */
export async function generateDashboard(): Promise<string> {
  
  const endTime = Date.now()
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000
  
  const metrics = await calculateLearningMetrics({ startTime, endTime })
  
  // Build dashboard sections
  const header = DASHBOARD_HEADER
  const skipRateChart = generateSkipRateChart(metrics)
  const qualityMetrics = generateQualityMetrics(metrics)
  const performanceMetrics = generatePerformanceMetrics(metrics)
  const skipReasonBreakdown = generateSkipReasonBreakdown(metrics)
  const patternHealth = generatePatternHealth(metrics)
  const topPatterns = await generateTopPatterns()
  const alerts = generateAlerts(metrics)
  
  return `
${header}
${skipRateChart}
${qualityMetrics}
${performanceMetrics}
${skipReasonBreakdown}
${patternHealth}
${topPatterns}
${alerts}
  `.trim()
}

/**
 * Check for alerts
 */
export function generateAlerts(metrics: LearningMetrics): string[] {
  const alerts: string[] = []
  
  // Alert: Skip rate outside target
  if (metrics.skip.skipRate < 0.6 || metrics.skip.skipRate > 0.8) {
    alerts.push(`⚠ Skip rate ${(metrics.skip.skipRate * 100).toFixed(1)}% outside target (60-80%)`)
  }
  
  // Alert: Quality degraded
  if (metrics.quality.qualityDelta < -0.05) {
    alerts.push(`⚠ Quality degraded: ${(metrics.quality.qualityDelta * 100).toFixed(1)}% below LLM baseline`)
  }
  
  // Alert: Pattern utilization low
  if (metrics.patterns.utilizationRate < 0.5) {
    alerts.push(`⚠ Pattern utilization low: ${(metrics.patterns.utilizationRate * 100).toFixed(1)}%`)
  }
  
  return alerts
}
```

**Dependencies**: Task 4.2 (activity skip logic)

**Testing Strategy**:
- Test dashboard generation
- Test alert logic
- Verify metric calculations

**Success Criteria**:
- ✅ Dashboard generates correctly
- ✅ Alerts trigger appropriately
- ✅ Metrics accurate

---

#### Task 4.4: End-to-End Testing (Days 19-20, 16 hours)

**What to Test**:
- Complete system integration
- Multi-day validation
- Performance benchmarks
- Quality validation

**Testing Procedures**:

1. **Integration Test** (6 hours):
```typescript
describe('End-to-End Integration', () => {
  it('should work end-to-end', async () => {
    // 1. Capture data
    // 2. Learn patterns
    // 3. Skip decisions
    // 4. Activity learning
    // 5. Monitoring
    
    // Verify complete flow works
    expect(await getMetrics()).toMatchSnapshot()
  })
})
```

2. **Load Test** (4 hours):
```typescript
describe('Load Testing', () => {
  it('should handle 1000 turns', async () => {
    // Run 1000 turns with learning enabled
    const results = await runManyTurns(1000)
    
    // Verify performance
    expect(avgTurnTime(results)).toBeLessThan(2000)
    
    // Verify skip rate
    const skipRate = results.filter(r => r.skipped).length / results.length
    expect(skipRate).toBeGreaterThan(0.6)
    expect(skipRate).toBeLessThan(0.8)
  })
})
```

3. **Quality Validation** (6 hours):
```typescript
describe('Quality Validation', () => {
  it('should maintain quality over time', async () => {
    // Run for 7 days (simulated)
    const results = await runSimulation(7 * 24 * 60) // 7 days worth of turns
    
    // Calculate quality delta over time
    const dailyMetrics = groupByDay(results)
    
    for (const day of dailyMetrics) {
      expect(day.qualityDelta).toBeGreaterThan(-0.05)
    }
  })
})
```

**Success Criteria**:
- ✅ All integration tests pass
- ✅ Load tests pass (1000+ turns)
- ✅ Quality maintained over time
- ✅ Performance targets met

---

#### Task 4.5: Production Deployment (Day 20, 8 hours)

**What to Deploy**:
- Enable impulse learning in production
- Deploy monitoring dashboard
- Set up alerting
- Document rollback procedure

**Deployment Steps**:

1. **Pre-Deployment Checklist** (2 hours):
   - ✅ All 9 pre-deployment items validated
   - ✅ Database tables created
   - ✅ All capture points working
   - ✅ Pattern library operational
   - ✅ Skip decision hook registered
   - ✅ Baseline metrics captured
   - ✅ Monitoring queries working
   - ✅ Dashboard operational

2. **Gradual Rollout** (4 hours):
   ```
   Hour 1: Enable for 10% of sessions
   Hour 2: Monitor metrics, increase to 25%
   Hour 3: Monitor metrics, increase to 50%
   Hour 4: Monitor metrics, increase to 100%
   ```

3. **Post-Deployment Monitoring** (2 hours):
   - Monitor skip rate
   - Monitor quality delta
   - Check for errors
   - Verify dashboard updates

**Rollback Procedure**:

```typescript
// If quality degrades or errors occur
async function rollback() {
  // 1. Disable impulse learning
  await Config.set('impulseLearning.enabled', false)
  
  // 2. Verify memory-management hook resumes
  log.info('impulse learning disabled, using memory agent LLM')
  
  // 3. Monitor recovery
  // Expect skip rate to drop to 0%
  // Expect quality to return to baseline
}
```

**Success Criteria**:
- ✅ Deployed to production
- ✅ Skip rate 60-80%
- ✅ Quality maintained
- ✅ No errors
- ✅ Dashboard operational

---

### Phase 4 Summary

**Deliverables**:
- ✅ Activity learning system
- ✅ Activity context skip logic
- ✅ Monitoring dashboard
- ✅ End-to-end validation
- ✅ Production deployment

**Files Modified**: 1  
**Files Created**: 4  
**Lines of Code**: ~1,500

**Final Validation**:
- Run in production for 2 weeks
- Monitor all metrics continuously
- Adjust thresholds as needed
- Collect user feedback

---

## Risk Mitigation

### Conservative Thresholds

**Initial Thresholds** (Week 3):
- Pattern match confidence: **0.90** (conservative)
- Activity learning observations: **5** (conservative)
- Activity consistency: **0.80** (conservative)

**Target Thresholds** (Week 4+):
- Pattern match confidence: **0.85** (standard)
- Activity learning observations: **5** (maintain)
- Activity consistency: **0.80** (maintain)

**Rationale**: Start conservative, increase skip rate gradually as confidence builds

### Gradual Rollout Plan

**Week 3: Staging Environment**
- Enable skip decision in staging
- Conservative thresholds (0.90 confidence)
- Monitor for 1 week
- Target: 20-40% skip rate

**Week 4: Production Rollout**
- Day 1: 10% of sessions
- Day 2: 25% of sessions
- Day 3: 50% of sessions
- Day 4: 100% of sessions

**Rollback Triggers**:
- Quality delta < -10%
- Error rate > 5%
- Skip rate > 90%
- System performance degraded

### Rollback Procedures

**Immediate Rollback** (< 5 minutes):
```bash
# Disable impulse learning via config
opencode config set impulseLearning.enabled false

# Verify memory agent LLM resumes
opencode logs --follow | grep "memory-management"

# Monitor recovery
opencode metrics --watch
```

**Partial Rollback** (reduce skip rate):
```bash
# Increase confidence threshold
opencode config set impulseLearning.patternMatchThreshold 0.95

# Disable specific skip rules
opencode config set impulseLearning.skipRules.continuation false

# Monitor skip rate decrease
opencode metrics --watch
```

**Data Rollback** (restore database):
```bash
# Backup current database
cp .opencode/learning.db .opencode/learning.db.backup

# Restore from backup (if needed)
cp .opencode/learning.db.pre-deploy .opencode/learning.db

# Verify restoration
sqlite3 .opencode/learning.db "SELECT COUNT(*) FROM pattern_library"
```

### Quality Monitoring

**Real-Time Monitoring**:
- Dashboard updates every 5 minutes
- Alerts for anomalies (Slack/email)
- Automatic threshold adjustments

**Daily Reviews**:
- Check skip rate trend
- Review quality delta
- Analyze failure patterns
- Update confidence thresholds

**Weekly Analysis**:
- Pattern library health
- Pattern utilization rates
- Activity learning progress
- Long-term trends

**Monthly Audits**:
- Pattern pruning review
- Database optimization
- Performance benchmarking
- User feedback integration

---

## File Modification Checklist

### Files to Modify

1. **memory-agent.ts** (`repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`)
   - Line 431: Add intent capture
   - Line 1058: Add impulse capture
   - Status: [ ]

2. **session/index.ts** (`repos/metabob-opencode/packages/opencode/src/session/index.ts`)
   - Add response capture after agent response
   - Status: [ ]

3. **activity.ts** (`repos/metabob-opencode/packages/opencode/src/session/activity.ts`)
   - Line 884: Add activity learning capture (complete)
   - Line 1113: Add activity learning capture (fail)
   - Status: [ ]

4. **turn-lifecycle-hooks.ts** (`repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`)
   - Add skip-decision hook (priority 5)
   - Update memory-management hook (check skip flag)
   - Status: [ ]

### Files to Create

#### Phase 1 (Week 1)
- [ ] `src/learning/database-schema.sql` - Database schema
- [ ] `src/learning/learning-database.ts` - Database wrapper
- [ ] `src/learning/learning-buffer.ts` - In-memory buffer
- [ ] `src/learning/impulse-usage-tracker.ts` - Usage detection

#### Phase 2 (Week 2)
- [ ] `src/learning/pattern-extraction.ts` - Pattern extraction
- [ ] `src/learning/pattern-matching.ts` - Pattern matching
- [ ] `src/learning/impulse-replay.ts` - Impulse replay
- [ ] `src/learning/pattern-library.ts` - Pattern storage

#### Phase 3 (Week 3)
- [ ] `src/learning/skip-decision.ts` - Skip decision logic
- [ ] `src/learning/fallback-strategies.ts` - Fallback implementations
- [ ] `src/learning/tracking.ts` - Decision tracking
- [ ] `src/learning/monitoring.ts` - Metrics calculation

#### Phase 4 (Week 4)
- [ ] `src/learning/activity-learning.ts` - Activity capture
- [ ] `src/learning/activity-context-skip.ts` - Activity skip logic
- [ ] `src/learning/dashboard.ts` - Monitoring dashboard
- [ ] `src/learning/alerts.ts` - Alert generation

**Total Files**: 4 modified, 16 created

---

## Testing Procedures

### Unit Tests

**Coverage Target**: 80%

**Test Files**:
```
tests/learning/
  - pattern-extraction.test.ts
  - pattern-matching.test.ts
  - impulse-replay.test.ts
  - skip-decision.test.ts
  - fallback-strategies.test.ts
  - activity-learning.test.ts
```

**Run Tests**:
```bash
npm test -- --testPathPattern=learning
```

### Integration Tests

**Test Scenarios**:
1. Complete capture flow (intent → impulse → response)
2. Pattern learning and matching
3. Skip decision end-to-end
4. Activity learning capture

**Run Integration Tests**:
```bash
npm run test:integration
```

### Performance Tests

**Benchmarks**:
- Database queries: < 5ms
- Pattern extraction: < 10ms
- Pattern matching: < 50ms (1000 patterns)
- Skip decision: < 50ms
- Impulse replay: < 20ms per impulse

**Run Performance Tests**:
```bash
npm run test:performance
```

### Load Tests

**Scenarios**:
- 1000 turns with capture
- 10,000 pattern matches
- 1000 skip decisions
- Database with 100,000 records

**Run Load Tests**:
```bash
npm run test:load
```

---

## Success Criteria Per Phase

### Phase 1: Data Capture
- ✅ Database tables created
- ✅ 5 capture points working
- ✅ Data flowing to database
- ✅ < 10ms overhead per turn
- ✅ 100% capture rate

### Phase 2: Pattern Learning
- ✅ Patterns extracted from messages
- ✅ Pattern matching working (>80% accuracy)
- ✅ Impulse replay produces valid impulses
- ✅ Pattern library growing (20-50 patterns after 1 week)

### Phase 3: Skip Integration
- ✅ Skip decision working end-to-end
- ✅ All 4 fallback strategies functional
- ✅ Turn lifecycle hook integrated
- ✅ Tracking capturing all decisions
- ✅ Skip rate 20-40% (conservative phase)
- ✅ Quality delta >= -5%

### Phase 4: Production Deployment
- ✅ Activity learning working
- ✅ Dashboard operational
- ✅ Deployed to production
- ✅ Skip rate 60-80%
- ✅ Quality delta >= 0
- ✅ No critical errors

---

## Summary

This 4-week implementation plan provides:

1. ✅ **Detailed Task Breakdown**: 20 tasks across 4 phases
2. ✅ **File Modification Checklist**: 4 files to modify, 16 to create
3. ✅ **Testing Procedures**: Unit, integration, performance, load tests
4. ✅ **Success Criteria**: Clear goals for each phase
5. ✅ **Risk Mitigation**: Conservative rollout, rollback procedures
6. ✅ **Gantt Chart**: Visual timeline of all tasks
7. ✅ **Dependencies**: Clear task ordering

**Total Effort**: 4 weeks, 160 hours

**Team Size**: 1-2 engineers

**Risk Level**: Low (conservative rollout, comprehensive testing)

**Expected Outcome**: Production-ready impulse learning system achieving 60-80% skip rate while maintaining quality

**Next Steps**: Begin Phase 1, Task 1.1 (Database Schema)
