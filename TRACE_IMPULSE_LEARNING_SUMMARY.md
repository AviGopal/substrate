# Trace: Impulse Learning in RPC API Only

## Executive Summary

**Specification:** `impulse-learning-in-rpc-api-only`

**Architectural Principle:** Learning algorithms belong in rpc-api, metabob-opencode must only collect raw data and send to RPC API.

**Current Violation:** 590-line `impulse-learning.ts` implements full learning pipeline (pattern extraction, quality scoring, usage tracking) locally in opencode.

**Required Change:** Reduce to ~50 lines of data collection, move all learning algorithms to rpc-api.

---

## Current State Analysis

### Primary Component: `impulse-learning.ts` (590 lines)

**Location:** `repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts`

**Current Responsibilities:**
1. Data capture (turn buffer management)
2. **Pattern extraction** - `normalizePattern()` - Replace file paths with {file0}, numbers with {num0}
3. **Quality calculation** - `calculateResponseQuality()` - 0.6 base + 0.4 impulse utilization
4. **Usage tracking** - `trackImpulseUsage()` - Regex-based content snippet matching
5. Local persistence - `persistMappingRecord()` - Write to local Storage

**Functions in Scope:**
- ✅ Keep: `initializeTurnBuffer()`, `captureIntent()`, `captureImpulsesCreated()`, `captureResponse()`, `captureOutcome()`
- ❌ DELETE: `normalizePattern()` (lines 392-419)
- ❌ DELETE: `calculateResponseQuality()` (lines 425-443)
- ❌ DELETE: `trackImpulseUsage()` (lines 328-358)
- ❌ DELETE: `persistMappingRecord()` (lines 449-467)

### Integration Points

**Turn Lifecycle Hooks:**
- `impulse-learning-init` (priority: 1) - Lines 862-930 in `turn-lifecycle-hooks.ts`
- `impulse-learning-flush` (priority: 120) - Lines 940-998 in `turn-lifecycle-hooks.ts`
  - Currently calls `flushToDatabase()` → must replace with HTTP POST

**Memory Agent:**
- Lines ~250-260 in `memory-agent.ts`
- Currently calls `ImpulseLearning.captureIntent()` with analyzed intent
- Should continue to collect data, but no processing

---

## Desired State

### Opencode: Data Collection Only (<50 lines)

**New Responsibilities:**
1. Initialize empty buffer per turn
2. Accumulate raw data: intent, impulses, response, outcome
3. POST raw data to RPC API endpoint

**New API:**
```typescript
export const ImpulseLearning = {
  initializeTurnBuffer(sessionID, turnNumber, userMessage): void
  addRawData(sessionID, data): void
  sendToRpcApi(sessionID): Promise<void>  // POST to /v1/learning/record-turn
}
```

### RPC API: Learning Pipeline

**New Endpoint:** `POST /api/v1/learning-loop/record-turn`

**Request Schema:**
```json
{
  "session_id": "string",
  "turn_number": "int",
  "user_message": "string",
  "intent": {
    "type": "code_fix | feature_request | ...",
    "confidence": 0.95,
    "suggestedImpulses": [...]
  },
  "impulses_created": [
    { "id": "...", "type": "file", "pointer": {...}, "priority": "high", "budget": 2000 }
  ],
  "response_text": "string (optional)",
  "task_succeeded": "boolean (optional)",
  "duration_ms": "int (optional)"
}
```

**Server-Side Processing Pipeline:**
1. `normalizePattern(user_message, intent)` → Extract pattern with placeholders
2. `calculateQuality(succeeded, impulses)` → Compute quality score 0-1
3. `trackUsage(response_text, impulses)` → Map impulse IDs to usage counts
4. `buildImpulseMappingRecord(...)` → Construct full learning record
5. `insertIntoSurrealDB(record)` → Persist to `impulse_mapping_record` table

**New File:** `repos/metabob-rpc-api/server/db/operations/impulse_learning.py`
- `insert_mapping_record(record)` - SurrealDB insert
- `get_mapping_records(session_id)` - Query by session
- `query_patterns(normalized_pattern)` - Pattern-based search

---

## Data Flow Comparison

### Current (VIOLATES SPEC)
```
Turn Start 
  → initBuffer 
  → captureIntent 
  → captureImpulses 
  → captureResponse 
  → captureOutcome 
  → flushToDatabase 
    → normalizePattern() [LOCAL]
    → calculateResponseQuality() [LOCAL]
    → trackImpulseUsage() [LOCAL]
    → persistMappingRecord() [LOCAL STORAGE]
```

### Desired (COMPLIANT)
```
Turn Start 
  → initBuffer 
  → addRawData (intent)
  → addRawData (impulses)
  → addRawData (response)
  → addRawData (outcome)
  → sendToRpcApi()
    → POST /v1/learning/record-turn [RPC API]
      → normalizePattern() [SERVER]
      → calculateQuality() [SERVER]
      → trackUsage() [SERVER]
      → buildRecord() [SERVER]
      → insertIntoSurrealDB() [SERVER]
```

---

## Key Changes Required

### 1. Remove Pattern Extraction from Opencode
- **Files:** `impulse-learning.ts:392-419`
- **Reason:** Learning algorithms belong in rpc-api
- **Impact:** Reduces opencode complexity, centralizes pattern logic

### 2. Remove Quality Calculation from Opencode
- **Files:** `impulse-learning.ts:425-443`
- **Reason:** Quality metrics are learning concerns
- **Impact:** Opencode doesn't make quality judgments

### 3. Remove Usage Tracking from Opencode
- **Files:** `impulse-learning.ts:328-358`
- **Reason:** Content analysis is a learning algorithm
- **Impact:** Opencode doesn't analyze response text

### 4. Replace Local Persistence with HTTP POST
- **Files:** `impulse-learning.ts:449-467`, `turn-lifecycle-hooks.ts:968`
- **Reason:** Data flows to centralized learning system
- **Impact:** No local learning storage, all data in SurrealDB

### 5. Add RPC API Endpoint
- **Files:** `repos/metabob-rpc-api/server/routes/learning_loop.py`
- **Reason:** Receive raw turn data from opencode instances
- **Impact:** Central learning endpoint for multi-instance environments

### 6. Implement Server-Side Pipeline
- **Files:** `repos/metabob-rpc-api/server/db/operations/impulse_learning.py` (NEW)
- **Reason:** Execute learning algorithms in rpc-api
- **Impact:** Reusable, consistent learning across all instances

---

## Compliance Checks

| Rule | Violation | Fix |
|------|-----------|-----|
| Learning algorithms ONLY in rpc-api | `normalizePattern`, `calculateResponseQuality`, `trackImpulseUsage` in opencode | Move to rpc-api, call via `/v1/learning/record-turn` |
| Opencode collects raw data only | `impulse-learning.ts` processes and transforms data | Send raw buffer via HTTP POST, no transformation |
| No local learning storage | `persistMappingRecord()` writes to local Storage | Delete local persistence, use SurrealDB via rpc-api |

---

## Migration Steps

1. Create `POST /v1/learning/record-turn` endpoint in rpc-api
2. Implement server-side pattern extraction (`normalizePattern`)
3. Implement server-side quality calculation (`calculateResponseQuality`)
4. Implement server-side usage tracking (`trackImpulseUsage`)
5. Create `impulse_learning.py` operations file
6. Update `impulse-learning.ts` to collect raw data only (<50 lines)
7. Replace `flushToDatabase()` with HTTP POST to rpc-api
8. **Test:** Verify data flows to SurrealDB correctly
9. Remove deleted functions from `impulse-learning.ts`
10. Update tests to mock HTTP calls instead of Storage writes

---

## Dependencies

### Opencode Changes
- `session/impulse-learning.ts` (590 → ~50 lines)
- `session/turn-lifecycle-hooks.ts` (impulse-learning-flush hook)
- `util/http-client.ts` (for POST requests)

### RPC API Changes
- `routes/learning_loop.py` (new endpoint)
- `db/operations/impulse_learning.py` (NEW FILE)
- `db/schema/impulse_mapping_record` (SurrealDB table)

---

## Success Criteria

- ✅ `impulse-learning.ts` reduced to <50 lines
- ✅ No pattern extraction in opencode
- ✅ No quality calculation in opencode
- ✅ No local Storage writes for learning data
- ✅ All learning data in SurrealDB via rpc-api
- ✅ `POST /v1/learning/record-turn` receives turn data
- ✅ Server-side learning pipeline functional

---

## Impulse Created

**ID:** `trace-impulse-learning-in-rpc-api-only`

**Type:** `templateDefinition`

**Budget:** 5000 tokens

**Location:** `impulses/trace-impulse-learning-in-rpc-api-only.json`

**Content:** Full trace analysis with current state, desired state, data flows, compliance checks, and migration steps.

**Usage:** Downstream validation and enforcement tasks can load this impulse to understand the specification and verify compliance.

---

**Generated:** 2026-02-28

**Specification:** impulse-learning-in-rpc-api-only
