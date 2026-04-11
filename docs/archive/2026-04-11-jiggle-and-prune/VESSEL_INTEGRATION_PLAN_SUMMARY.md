# Vessel Integration Plan Summary

## Date: 2026-04-10

## Executive Summary

Four parallel planning agents analyzed integration requirements for completing the learning loop across all vessels. The findings reveal:

✅ **Architecture is Sound**: 8.5/10 idiom conformance, strong foundational patterns
❌ **Critical Data Flow Issue**: Traces not reaching backend due to missing PERMISSIONS
✅ **Most Components Ready**: 80% of required code already implemented
🎯 **Clear Path Forward**: Well-defined tasks for each vessel

---

## Critical Fixes and Implementation Approach

### Overview of Issues

Our analysis identified **3 critical issues** blocking the learning loop:

1. **Missing PERMISSIONS** (Backend) - Data stored but invisible
2. **Missing Recording Calls** (MiniBob) - Some learning signals not captured
3. **Insufficient Error Visibility** (Both) - Hard to diagnose failures

These are **configuration and implementation gaps**, not architectural flaws. The design is sound.

---

### Critical Fix #1: Add PERMISSIONS to Learning Tables

**Problem**: Learning tables have `org_id` field but no PERMISSIONS clauses, breaking multi-tenant data visibility.

**Impact**:
- Traces stored with `org_id='metabob'` but queries filter by `org_id=$auth.org_id`
- If auth org_id doesn't match, data appears as "0 executions"
- Backend shows empty results despite successful data storage

**Root Cause Location**:
- Migration 032 created tables with `org_id` field
- PERMISSIONS clauses were never added
- Backend assumes PERMISSIONS enforce filtering (they don't exist yet)

**Solution: Migration 055**

**File**: `repos/metabob-activity-api/sql/migrations/055-add-learning-table-permissions.surql`

**Implementation**:
```sql
-- Add PERMISSIONS to activity_composition_graph
DEFINE TABLE activity_composition_graph SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND $auth.role = 'admin';

-- Add PERMISSIONS to impulse_relevance_metrics
DEFINE TABLE impulse_relevance_metrics SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

-- Add PERMISSIONS to tool_usage_patterns
DEFINE TABLE tool_usage_patterns SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

-- Add PERMISSIONS to execution_sequences
DEFINE TABLE execution_sequences SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';
```

**Testing Strategy**:
```bash
# 1. Create migration file
cd repos/metabob-activity-api
cat > sql/migrations/055-add-learning-table-permissions.surql <<'EOF'
[migration SQL from above]
EOF

# 2. Apply to local development
bun run migrate

# 3. Verify PERMISSIONS exist
curl -X POST http://localhost:8000/sql \
  -u 'root:password' \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d 'INFO FOR TABLE activity_composition_graph'

# Should show PERMISSIONS clause in output

# 4. Test multi-tenant isolation
# Create test data for org A and org B
# Authenticate as org A, verify only org A data visible
# Authenticate as org B, verify only org B data visible

# 5. Apply to canary deployment
# Deploy to activity.metabob.com
# Run teaching loop workflow
# Verify traces now visible in backend queries
```

**Rollback Plan**:
```sql
-- If migration causes issues, revert to tables without PERMISSIONS
-- (Data access goes back to being unrestricted)
DEFINE TABLE activity_composition_graph SCHEMAFULL;
DEFINE TABLE impulse_relevance_metrics SCHEMAFULL;
DEFINE TABLE tool_usage_patterns SCHEMAFULL;
DEFINE TABLE execution_sequences SCHEMAFULL;
```

**Success Criteria**:
- [ ] Migration applies without errors
- [ ] INFO FOR TABLE shows PERMISSIONS clauses
- [ ] Test data isolated by org_id
- [ ] Teaching loop shows executions > 0
- [ ] Backend queries return org-scoped data

**Estimated Effort**: 4 hours
- 1 hour: Write migration
- 1 hour: Test locally
- 1 hour: Apply to canary
- 1 hour: Verify with teaching loop

---

### Critical Fix #2: Add Verbose Logging to Trace Storage

**Problem**: Trace storage failures are silent - no visibility into what's failing.

**Impact**:
- MiniBob reports "trace stored" but backend shows 0 executions
- No error messages to diagnose the issue
- Can't tell if problem is org_id, auth, network, or backend

**Root Cause Location**:
- `repos/minibob/src/activity.ts` line 1171: Error caught but minimal logging
- `repos/minibob/src/mcp.ts` line 1405: Debug-level logging, not visible in CI/CD

**Solution: Enhanced Error Logging**

**File**: `repos/minibob/src/activity.ts` (lines 1168-1183)

**Implementation**:
```typescript
// BEFORE (current code):
const traceStored = await mcp.storeExecutionTrace(execution).catch(async (error) => {
  log.debug(` Backend unavailable, caching trace offline: ${error instanceof Error ? error.message : String(error)}`)
  const { cacheExecutionTrace } = await import("./offline-cache")
  await cacheExecutionTrace(execution)
  return false
})

// AFTER (enhanced logging):
const traceStored = await (async () => {
  try {
    // Log trace payload details
    const orgId = mcp.getOrgId()
    const projectId = mcp.getProjectId()
    log.info(`[Trace] Storing execution ${execution.id}`)
    log.info(`[Trace] Org: ${orgId || 'NONE'}, Project: ${projectId || 'NONE'}`)
    log.debug(`[Trace] Template: ${execution.templateId}, Status: ${execution.status}`)

    // Attempt trace storage
    const stored = await mcp.storeExecutionTrace(execution)

    if (stored) {
      log.info(`[Trace] ✓ Successfully stored to backend`)
      return true
    } else {
      log.warn(`[Trace] ✗ Backend returned false (rejected trace)`)
      throw new Error('Backend rejected trace')
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log.error(`[Trace] ✗ Storage failed: ${errorMsg}`)

    // Get detailed error from MCP client
    const lastError = mcp.getLastError()
    if (lastError) {
      log.error(`[Trace] Backend error: ${lastError}`)
    }

    // Cache for offline sync
    log.warn(`[Trace] Caching offline for later sync`)
    const { cacheExecutionTrace } = await import("./offline-cache")
    await cacheExecutionTrace(execution)
    return false
  }
})()

if (!traceStored) {
  log.warn(`[Trace] Activity completed but trace not stored (cached offline)`)
}
```

**File**: `repos/minibob/src/mcp.ts` (lines 1394-1428)

**Implementation**:
```typescript
// Add to storeExecutionTrace method
async storeExecutionTrace(execution: ActivityExecution): Promise<boolean> {
  try {
    const orgId = this.getOrgId()
    const projectId = this.getProjectId()

    // ENHANCED LOGGING
    log.info(`[MCP] Storing trace: ${execution.id}`)
    log.info(`[MCP] Endpoint: ${this.endpoint}/v2/activities/execution-traces`)
    log.info(`[MCP] Org ID: ${orgId || 'MISSING'}, Project ID: ${projectId || 'NONE'}`)
    log.debug(`[MCP] Input impulses: ${execution.impulses?.length || 0}`)
    log.debug(`[MCP] Output impulses: ${execution.metadata?.producedImpulses?.length || 0}`)

    const response = await this.request("POST", "/v2/activities/execution-traces", traceData)

    if (!response.ok) {
      const errorText = await response.text()
      let parsedError
      try {
        parsedError = JSON.parse(errorText)
      } catch {
        parsedError = { message: errorText }
      }

      log.error(`[MCP] Trace storage failed (${response.status}):`, parsedError)
      this.lastError = JSON.stringify(parsedError, null, 2)
      return false
    }

    log.info(`[MCP] ✓ Trace stored successfully`)
    return true
  } catch (error) {
    log.error(`[MCP] Exception during trace storage:`, error)
    this.lastError = error instanceof Error ? error.message : String(error)
    return false
  }
}

// Add lastError tracking
private lastError: string | null = null

public getLastError(): string | null {
  return this.lastError
}
```

**Testing Strategy**:
```bash
# 1. Build with enhanced logging
cd repos/minibob
bun run build

# 2. Test locally with verbose logging
export METABOB_API_KEY="your-key"
export METABOB_ORG_ID="metabob"
minibob -vvv --single "create test file"

# Expected output:
# [Trace] Storing execution exec_...
# [Trace] Org: metabob, Project: NONE
# [MCP] Storing trace: exec_...
# [MCP] Endpoint: https://activity.metabob.com/v2/activities/execution-traces
# [MCP] Org ID: metabob, Project ID: NONE
# [MCP] ✓ Trace stored successfully
# [Trace] ✓ Successfully stored to backend

# 3. Test with missing org_id
unset METABOB_ORG_ID
minibob -vvv --single "test"

# Expected output:
# [Trace] Org: NONE, Project: NONE
# [MCP] Org ID: MISSING, Project ID: NONE
# [MCP] Trace storage failed (401): {"error": "Organization ID required"}
# [Trace] ✗ Storage failed: Backend rejected trace
# [Trace] Caching offline for later sync

# 4. Run in CI/CD workflow
# Check workflow logs for detailed trace output
```

**Success Criteria**:
- [ ] Logs show org_id value (not MISSING)
- [ ] Logs show backend endpoint being called
- [ ] Logs show success or specific error message
- [ ] Errors include backend response details
- [ ] Offline caching confirmed when backend unavailable

**Estimated Effort**: 2 hours
- 1 hour: Implement logging changes
- 30 min: Test locally
- 30 min: Test in CI/CD

---

### Critical Fix #3: Implement Missing Recording Calls

**Problem**: Two learning endpoints ready but MiniBob never calls them.

**Impact**:
- Impulse relevance not tracked → No smart impulse filtering
- Execution sequences not stored → No session-level learning

**Root Cause Location**:
- `repos/minibob/src/activity.ts`: impulse relevance partially implemented
- `repos/minibob/src/session.ts`: sequence recording code exists but not invoked

**Solution A: Complete Impulse Relevance Recording**

**File**: `repos/minibob/src/activity.ts`

**Implementation**:
```typescript
// After task execution completes (around line 2500)
private async recordImpulseRelevance(
  templateId: string | undefined,
  availableImpulseIds: string[],
  loadedImpulseIds: string[],
  executionSucceeded: boolean
): Promise<void> {
  if (!isMCPEnabled() || !templateId || availableImpulseIds.length === 0) {
    return
  }

  const mcp = getMCPClient()
  if (!mcp) return

  try {
    // Record relevance for each impulse
    for (const impulseId of availableImpulseIds) {
      const wasLoaded = loadedImpulseIds.includes(impulseId)

      // Get impulse details for token tracking
      const impulse = getImpulse(impulseId)
      const contentSizeTokens = impulse?.loaded
        ? estimateTokens(impulse.content)
        : undefined

      await mcp.recordImpulseRelevance({
        impulseId,
        activityId: templateId,
        wasLoaded,
        executionSucceeded,
        contentSizeTokens,
        pointerType: impulse?.pointer?.type,
      })
    }

    log.info(`[Impulse] ✓ Recorded relevance for ${availableImpulseIds.length} impulses`)
  } catch (error) {
    // Non-blocking: log error but don't fail activity
    log.warn(`[Impulse] Failed to record relevance:`, error instanceof Error ? error.message : String(error))
  }
}

// Helper function
function estimateTokens(content: unknown): number {
  if (!content) return 0
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return Math.ceil(text.length / 4) // ~4 chars per token
}
```

**Invocation Point**:
```typescript
// In activity executor, after all tasks complete
const availableImpulseIds = template.impulses?.map(i => i.id) || []
const loadedImpulseIds = this.loadedImpulses.map(i => i.id)
const executionSucceeded = execution.status === 'completed'

await this.recordImpulseRelevance(
  execution.templateId,
  availableImpulseIds,
  loadedImpulseIds,
  executionSucceeded
)
```

**Solution B: Complete Execution Sequence Recording**

**File**: `repos/minibob/src/session.ts` (lines 92-131)

**Implementation**:
```typescript
export async function completeSession(
  sessionId: string,
  outcome: 'success' | 'partial' | 'failure' = 'success'
): Promise<boolean> {
  const session = activeSessions.get(sessionId)
  if (!session) {
    log.warn(`[Session] Not found: ${sessionId}`)
    return false
  }

  // Report to MCP backend if enabled
  if (isMCPEnabled() && session.executions.length > 0) {
    const mcp = getMCPClient()
    if (mcp) {
      log.info(`[Session] Reporting sequence: ${session.executions.length} executions`)
      log.info(`[Session] Goal: ${session.goalContext || 'none'}`)
      log.debug(`[Session] Activities: ${session.executions.map(e => e.activityId).join(' → ')}`)

      try {
        const reported = await mcp.recordExecutionSequence({
          sessionId: session.sessionId,
          goalContext: session.goalContext,
          sequence: session.executions,
          outcome,
        })

        if (reported) {
          log.info(`[Session] ✓ Sequence reported to backend`)
        } else {
          log.warn(`[Session] Backend rejected sequence`)
        }
      } catch (error) {
        log.warn(`[Session] Failed to report:`, error instanceof Error ? error.message : String(error))
      }
    }
  } else {
    log.debug(`[Session] Skipping report: MCP=${isMCPEnabled()}, executions=${session.executions.length}`)
  }

  // Clean up
  activeSessions.delete(sessionId)
  log.info(`[Session] Completed: ${sessionId} (${outcome})`)

  return true
}
```

**Invocation Verification**:
```typescript
// In goal-processor.ts, ensure completeSession is called:

// After goal completion (success)
await completeSession(sessionId, 'success')

// After goal failure (max attempts)
await completeSession(sessionId, 'failure')

// After partial completion
await completeSession(sessionId, 'partial')
```

**Testing Strategy**:
```bash
# Test impulse relevance
cd repos/minibob
bun test test/impulse-relevance.test.ts

# Test execution sequence
minibob -vvv --single "create file and run tests"
# Should see in logs:
# [Impulse] ✓ Recorded relevance for N impulses
# [Session] Reporting sequence: 2 executions
# [Session] Activities: create-file → run-tests
# [Session] ✓ Sequence reported to backend

# Verify backend received data
curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/impulse-relevance?activity_id=create-file"

curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-sequences?limit=5"
```

**Success Criteria**:
- [ ] Impulse relevance recorded for every activity execution
- [ ] Execution sequences stored for multi-activity sessions
- [ ] Backend endpoints return populated data
- [ ] Logs confirm successful recording

**Estimated Effort**: 4 hours
- 2 hours: Implement impulse relevance
- 1 hour: Verify sequence recording invocation
- 1 hour: Test both features

---

### Implementation Timeline

**Phase 1: Critical Fixes (Day 1-2)**
```
Hour 1-4:   Migration 055 (PERMISSIONS)
Hour 5-6:   Enhanced logging
Hour 7-8:   Test migration locally
Hour 9-12:  Deploy to canary
Hour 13-14: Verify teaching loop works
Hour 15-16: Implement impulse relevance
```

**Phase 2: Verification (Day 3)**
```
Hour 1-2:   Verify sequence recording
Hour 3-4:   Run comprehensive tests
Hour 5-6:   Monitor canary backend
Hour 7-8:   Document findings
```

**Phase 3: Production (Day 4)**
```
Hour 1-2:   Final canary verification
Hour 3-4:   Promote to production
Hour 5-6:   Monitor production metrics
Hour 7-8:   Create post-mortem report
```

---

### Monitoring and Verification

**Metrics to Track**:
1. **Backend Execution Count**: Should go from 0 to > 0
2. **Composition Graph Edges**: Should appear after nested executions
3. **Impulse Relevance Records**: Should accumulate over time
4. **Execution Sequences**: Should store session data
5. **Thompson Sampling α/β**: Should update after executions

**Dashboard Queries**:
```bash
# Check execution count
curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/templates" | \
  jq '.templates[] | {id, executions, success_rate}'

# Check composition graph
curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/composition/graph?limit=20" | \
  jq '.compositions | length'

# Check impulse relevance
curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/impulse-relevance?limit=10" | \
  jq '.metrics | length'

# Check execution sequences
curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-sequences?limit=10" | \
  jq '.sequences | length'
```

**Success Indicators**:
- All queries return data (not empty arrays)
- Execution counts match MiniBob activity runs
- Composition edges form between related activities
- Impulse relevance scores update with new data
- Sequences show multi-step workflows

---

### Rollback Strategy

**If Migration 055 Fails**:
1. Revert migration: Remove PERMISSIONS clauses
2. Add manual org_id filtering in application code (temporary)
3. Investigate PERMISSIONS syntax error
4. Re-apply corrected migration

**If Logging Causes Performance Issues**:
1. Reduce log level to WARN for production
2. Keep INFO level for canary deployment
3. Add log sampling (1 in 10 traces logged)

**If Recording Calls Fail**:
1. Wrap all recording calls in try-catch (non-blocking)
2. Add feature flag to disable recording
3. Fall back to offline cache only
4. Investigate backend endpoint issues

---

## Agent Findings Summary

### 1. MiniBob Integration (Agent a209d70)

**Status**: Execution works, data recording incomplete

**Critical Tasks**:
1. **Fix Trace Storage** (CRITICAL)
   - Add verbose logging to diagnose backend communication
   - Implement retry logic for failed storage
   - Verify org_id propagation from environment

2. **Implement Impulse Relevance Recording**
   - Call `mcp.recordImpulseRelevance()` during task execution
   - Track which impulses loaded, execution success, token counts
   - Enable smart impulse filtering based on learned relevance

3. **Implement Execution Sequence Recording**
   - Call `mcp.recordExecutionSequence()` at session completion
   - Track ordered activity lists, goals, outcomes
   - Enable session-level pattern learning

4. **Enhance Composition Recording**
   - Verify parent/child relationship tracking
   - Add shape flow recording (input/output shapes)
   - Record composition weights

5. **Improve Tool Usage Recording**
   - Add task ID tracking to tool calls
   - Record parameter complexity
   - Track success correlation per tool

**Files Modified**: 5 core files
- `repos/minibob/src/activity.ts` (trace storage, impulse relevance)
- `repos/minibob/src/mcp.ts` (backend communication)
- `repos/minibob/src/session.ts` (execution sequence)
- `repos/minibob/src/config.ts` (org_id configuration)
- `repos/minibob/src/goal-processor.ts` (session completion)

**Estimated Effort**: 5 days
- Day 1: Trace storage fixes (unblocks everything)
- Day 2: Impulse relevance recording
- Day 3: Execution sequence recording
- Day 4-5: Composition & tool usage enhancements

---

### 2. Activity API Integration (Agent a22f4fb)

**Status**: Endpoints implemented, missing PERMISSIONS

**ROOT CAUSE IDENTIFIED**:
```sql
-- Learning tables have org_id field but NO PERMISSIONS
-- This breaks multi-tenant isolation and makes data invisible

CRITICAL FIX NEEDED:
Migration 055: Add PERMISSIONS to all learning tables
```

**Critical Tasks**:
1. **Schema Migration 055** (BLOCKS ALL LEARNING)
   - Add PERMISSIONS to `activity_composition_graph`
   - Add PERMISSIONS to `impulse_relevance_metrics`
   - Add PERMISSIONS to `tool_usage_patterns`
   - Add PERMISSIONS to `execution_sequences`
   - Enforce `WHERE org_id = $auth.org_id` automatically

2. **Shape-Conditioned Thompson Sampling**
   - Create `v_activity_shape_score` view
   - Filter recommendations by input shapes
   - Enable composition-aware scoring

3. **Composition Pattern Mining**
   - Detect common activity sequences
   - Learn which compositions succeed
   - Recommend based on shape compatibility

4. **Enhanced Impulse Relevance API**
   - Classify impulses: critical/helpful/optional/skip
   - Recommend which impulses to load
   - Enable memory optimization

5. **Tool Requirement Detection API**
   - Identify required vs optional tools
   - Match vessel capabilities
   - Prevent activity assignment to incapable vessels

**Files Modified**: 3 core files + 1 new migration
- `sql/migrations/055-add-learning-table-permissions.surql` (NEW - CRITICAL)
- `sql/migrations/056-shape-conditioned-thompson-sampling.surql` (NEW)
- `src/routes/activities.ts` (enhancements)
- `src/services/composition-patterns.ts` (NEW)

**Estimated Effort**: 4 days
- Day 1: Migration 055 (CRITICAL - unblock learning)
- Day 2: Shape-conditioned Thompson Sampling
- Day 3: Composition pattern mining
- Day 4: API enhancements (impulse relevance, tool requirements)

---

### 3. Activity Dashboard Integration (Agent a33b745)

**Status**: 80% complete, missing execution sequence visualization

**Critical Tasks**:
1. **Add Execution Sequence Types**
   - Add `ExecutionSequence` interface to types.ts
   - Add `ExecutionSequenceResponse` interface

2. **Add API Client Method**
   - Implement `listExecutionSequences()` in api-client.ts
   - Add convenience export

3. **Create useExecutionSequences Hook**
   - Follow existing hook pattern
   - Handle loading/error states
   - Auto-refresh support

4. **Create ExecutionSequenceBrowser Component**
   - Timeline visualization of activity sequences
   - Filtering by goal, outcome, length
   - Pattern recognition and grouping

5. **Enhanced Empty States**
   - Onboarding messages for new users
   - Progress indicators (5 → 20 → 50 → 100 executions)
   - Clear call-to-action for each dashboard

6. **Real-time Updates**
   - WebSocket integration for live data
   - Live indicators showing data freshness

**Files Modified**: 6 files (3 new, 3 updates)
- `src/lib/types.ts` (UPDATE - add types)
- `src/lib/api-client.ts` (UPDATE - add method)
- `src/hooks/useExecutionSequences.ts` (NEW)
- `src/components/ExecutionSequenceBrowser.tsx` (NEW)
- `src/components/EmptyStates.tsx` (NEW)
- `src/App.tsx` (UPDATE - add tab)

**Estimated Effort**: 4 days
- Day 1: Types + API integration
- Day 2: Hook + component structure
- Day 3: Visualization + empty states
- Day 4: Real-time updates + polish

---

### 4. Cross-Vessel Patterns Analysis (Agent ad43c34)

**Status**: 8.5/10 idiom conformance, some standardization needed

**Findings**:

**Excellent Patterns (Keep)**:
- ✅ Impulse metadata-first design
- ✅ Multi-tenant SurrealDB PERMISSIONS
- ✅ API key HMAC validation
- ✅ Trace recording with offline fallback
- ✅ Thompson Sampling computed from traces

**Patterns Needing Standardization**:
- ⚠️ Error response formats (3 different patterns)
- ⚠️ Logger usage (console vs structured logger)
- ⚠️ Retry logic (some vessels have it, others don't)
- ⚠️ Configuration validation (inconsistent)
- ⚠️ Pagination (some endpoints have it, others don't)
- ⚠️ Environment variable naming (mixed patterns)

**Anti-Patterns Identified**:
1. **Backend Proxying Analysis API** (already marked DEPRECATED ✓)
2. **Mixed Console/Logger Usage** (identity-vessel)
3. **Missing Retry on Critical Operations**
4. **No Health Check Dependencies**
5. **Varied Error Response Formats**

**Recommendations**:
1. Create `@metabob/vessel-core` package with shared utilities
2. Standardize error response format across all vessels
3. Use structured logger everywhere (replace console.log/error)
4. Add retry logic to all inter-vessel communication
5. Document standard patterns in integration guides

**Estimated Effort**: Ongoing (2-3 weeks)
- Week 1: Create shared package, document patterns
- Week 2: Audit and refactor existing vessels
- Week 3: Integration tests, validation

---

## Common Patterns Preserved

### 1. Shape-Based Communication ✅

All vessels follow the metadata-first impulse pattern:

```typescript
interface Impulse {
  id: string
  pointer: ImpulsePointer  // WHERE the data is
  metadata: ImpulseMetadata  // WHAT it looks like
  loaded: boolean
  content?: unknown  // Loaded on demand
  budget?: number  // Token budget
}
```

**Conformance**: EXCELLENT
- Resolvers live where data lives
- LLMs reason about metadata, load content only when needed
- No universal resolver anti-pattern

### 2. Multi-Tenant Isolation ✅

All learning tables use SurrealDB PERMISSIONS:

```sql
PERMISSIONS FOR select WHERE org_id = $auth.org_id
```

**Conformance**: EXCELLENT (after migration 055)
- Database enforces isolation automatically
- No application-level filtering needed
- Audit trails include org_id

### 3. Authentication Flow ✅

Consistent pattern across vessels:

```
API Key → identity-vessel validation → JWT generation → org_id propagation
```

**Conformance**: EXCELLENT
- Identity-vessel is authoritative source
- Fallback to SurrealDB when identity-vessel unavailable
- org_id flows through all operations

### 4. Trace Recording ✅

Non-blocking pattern with offline fallback:

```typescript
// Fire-and-forget (don't block execution)
void mcp.storeExecutionTrace(trace).catch(err => {
  logger.warn('Trace storage failed')
  void cacheExecutionTrace(trace)  // Offline fallback
})
```

**Conformance**: EXCELLENT
- Execution doesn't block on trace failures
- Offline cache syncs when backend available
- Learning continues even when backend down

### 5. Thompson Sampling ✅

Computed from traces (not stored directly):

```sql
-- Views aggregate execution data
SELECT
  activity_id,
  (math::sum(success) + 1) as thompson_alpha,
  (count() - math::sum(success) + 1) as thompson_beta
FROM execution
GROUP BY activity_id
```

**Conformance**: EXCELLENT
- Prevents race conditions (no direct alpha/beta updates)
- Enables rich conditioning (per-shape, per-vessel)
- Scales without schema changes

---

## Idiomatic Alignment Assessment

### Alignment with IMPULSE_ACTIVITY_FOUNDATION.md

| Principle | Conformance | Notes |
|-----------|-------------|-------|
| **Impulses are Universal Data** | ✅ Excellent | Metadata-first, shape-based, resolvers distributed |
| **Activities Constrain Search** | ✅ Excellent | Thompson Sampling, shape filtering, variant selection |
| **Resolvers Live Where Data Lives** | ✅ Excellent | MiniBob=local, Backend=traces, no universal resolver |
| **Metadata First, Content Later** | ✅ Excellent | Impulse pointers, lazy loading, budget tracking |
| **Record Everything** | ✅ Excellent | Comprehensive trace capture, state transitions |
| **Learn From Traces** | ✅ Excellent | Thompson Sampling, composition, impulse relevance |
| **Reserve Improvisation** | ✅ Excellent | Ribosome pattern, variant creation |
| **Backend Limited to Learning** | ✅ Excellent | Trace storage + pattern learning only |

**Overall**: 8.5/10 (very strong alignment)

### Minor Drifts Identified

1. **Goal Enrichment** (Minor)
   - Currently: Eager git context loading
   - Should be: Lazy impulse loading
   - Impact: Low (doesn't violate core principles)

2. **Failure Penalty Tracking** (Minor)
   - Currently: Local heuristic decay
   - Should be: Backend-learned patterns
   - Impact: Low (temporary tracking, not persistent)

3. **Analysis API Proxy** (Known, being fixed)
   - Currently: Backend proxies Analysis API
   - Should be: Analysis API provides own impulse resolution
   - Status: Marked DEPRECATED ✓

---

## Critical Path to Completion

### Phase 1: Unblock Learning (Week 1)

**CRITICAL**: These block all learning functionality

1. **Migration 055** (Activity API)
   - Add PERMISSIONS to learning tables
   - Enables multi-tenant data visibility
   - Estimated: 4 hours

2. **Trace Storage Logging** (MiniBob)
   - Add verbose logging to diagnose issues
   - Verify org_id propagation
   - Estimated: 4 hours

3. **Verify Data Flow** (Testing)
   - Run teaching loop with verbose logging
   - Confirm traces appear in backend
   - Estimated: 2 hours

**Success Criteria**:
- Backend shows executions > 0
- Traces visible when querying by org_id
- Composition graph has edges

### Phase 2: Complete Recording (Week 2)

**HIGH PRIORITY**: Core learning signals

1. **Impulse Relevance Recording** (MiniBob)
   - Call mcp.recordImpulseRelevance() during execution
   - Track loaded vs available impulses
   - Estimated: 8 hours

2. **Execution Sequence Recording** (MiniBob)
   - Call mcp.recordExecutionSequence() at session end
   - Track ordered activity lists
   - Estimated: 4 hours

3. **Shape-Conditioned Thompson Sampling** (Activity API)
   - Create v_activity_shape_score view
   - Update recommendation endpoint
   - Estimated: 8 hours

**Success Criteria**:
- Impulse relevance scores update
- Execution sequences stored
- Activity recommendations use shapes

### Phase 3: Visualization (Week 3)

**MEDIUM PRIORITY**: User-facing dashboards

1. **Execution Sequence Browser** (Dashboard)
   - Create component with timeline visualization
   - Add filtering and pattern recognition
   - Estimated: 12 hours

2. **Enhanced Empty States** (Dashboard)
   - Add onboarding messages
   - Progress indicators
   - Estimated: 4 hours

3. **Real-time Updates** (Dashboard)
   - WebSocket integration
   - Live data indicators
   - Estimated: 4 hours

**Success Criteria**:
- All 5 learning shapes visualized
- Empty states guide new users
- Real-time updates work

### Phase 4: Standardization (Ongoing)

**LOW PRIORITY**: Code quality improvements

1. **Shared Vessel Core Package**
   - Extract common types and utilities
   - Estimated: 8 hours

2. **Error Handling Standardization**
   - Adopt standard error format
   - Estimated: 12 hours

3. **Integration Tests**
   - Cross-vessel communication tests
   - Multi-tenant isolation verification
   - Estimated: 16 hours

**Success Criteria**:
- Common patterns documented
- Integration tests passing
- No anti-patterns in new code

---

## Delivery Timeline

```
Week 1 (CRITICAL PATH):
├─ Day 1: Migration 055 + Trace logging
├─ Day 2: Verify data flow
├─ Day 3: Impulse relevance recording
├─ Day 4: Execution sequence recording
└─ Day 5: Testing and validation

Week 2 (CORE FEATURES):
├─ Day 1-2: Shape-conditioned Thompson Sampling
├─ Day 3-4: Composition pattern mining
└─ Day 5: API enhancements

Week 3 (VISUALIZATION):
├─ Day 1-2: Execution sequence browser
├─ Day 3: Enhanced empty states
├─ Day 4: Real-time updates
└─ Day 5: Testing and polish

Ongoing (QUALITY):
├─ Create shared vessel-core package
├─ Standardize error handling
└─ Write integration tests
```

---

## Risk Assessment

### High Risk (Must Address)

1. **Migration 055 Failure**
   - Risk: PERMISSIONS migration fails in production
   - Mitigation: Test thoroughly in canary first
   - Rollback: Revert migration, use manual org_id filtering

2. **Trace Storage Latency**
   - Risk: Backend storage becomes bottleneck
   - Mitigation: Async recording, offline cache
   - Rollback: Disable trace recording temporarily

### Medium Risk (Monitor)

1. **Dashboard Performance**
   - Risk: Large datasets cause slow rendering
   - Mitigation: Pagination, virtual scrolling
   - Rollback: Reduce default page sizes

2. **WebSocket Scalability**
   - Risk: Many concurrent users overwhelm WebSocket
   - Mitigation: Rate limiting, batching
   - Rollback: Fall back to polling

### Low Risk (Accept)

1. **Empty State Adoption**
   - Risk: Users ignore onboarding messages
   - Mitigation: Make messages concise, actionable
   - Accept: Not critical for functionality

2. **Standardization Timeline**
   - Risk: Takes longer than planned
   - Mitigation: Prioritize high-impact items
   - Accept: Can complete over time

---

## Success Metrics

### Immediate (Week 1)

- [ ] Backend shows executions > 0 for all org_ids
- [ ] Composition graph has edges
- [ ] Thompson Sampling α/β parameters update
- [ ] Traces visible in dashboard

### Short-Term (Week 2-3)

- [ ] Impulse relevance scores computed
- [ ] Execution sequences stored
- [ ] Shape-based recommendations working
- [ ] All 5 learning shapes visualized

### Long-Term (Month 1-2)

- [ ] Activity success rates improve over time
- [ ] Composition patterns identified automatically
- [ ] Impulse filtering reduces token usage
- [ ] Tool requirement detection prevents failures

---

## Next Steps

1. **Review this summary** with stakeholders
2. **Approve migration 055** for production deployment
3. **Assign tasks** to implementation teams
4. **Set up monitoring** for learning loop metrics
5. **Create tracking board** for integration work

---

## Agent References

- **MiniBob Plan**: Agent a209d70
- **Activity API Plan**: Agent a22f4fb
- **Dashboard Plan**: Agent a33b745
- **Cross-Vessel Patterns**: Agent ad43c34

All agents can be resumed if additional planning detail needed.

---

**Document Status**: Complete
**Next Action**: Stakeholder review and approval
**Priority**: Critical (unblocks autonomous learning)
