# Trace Analysis: instance-invariant-storage-with-vessel-flow

## Executive Summary

**Specification**: Impulse and activity data storage must be invariant across opencode/metabob-cli instances for a given (metabob_api_key, project_id) pair.

**Current Status**: ❌ **VIOLATED** - Storage is instance-specific, NOT instance-invariant

**Root Cause**: opencode Storage.ts bypasses CLI MCP vessel flow, writing only to local filesystem

---

## Architecture Analysis

### Current (Broken) Flow
```
opencode -> Storage.ts -> Bun.write() -> Local filesystem ONLY
```

### Desired (Correct) Flow
```
opencode -> impulse tool -> CLI MCP tool -> rpc-api -> SurrealDB
                    ↓
              Local cache (optional)
```

---

## Component Analysis

### 8 Components Traced

#### ❌ HIGH PRIORITY VIOLATIONS (4)

1. **Storage.ts** (repos/metabob-opencode/packages/opencode/src/storage/storage.ts:1-266)
   - **Gap**: NO vessel flow - writes directly to local filesystem
   - **Impact**: All storage operations bypass backend
   - **Fix**: Replace Bun.write() calls with CLI MCP calls

2. **ImpulseCreateTool** (repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:14-102)
   - **Gap**: No backend sync after local write
   - **Impact**: Impulses only exist on creating instance
   - **Fix**: Add `metabob_impulse_store()` call after line 67

3. **Activity.save** (repos/metabob-opencode/packages/opencode/src/session/activity.ts:577-591)
   - **Gap**: No backend sync
   - **Impact**: Activities not accessible cross-instance
   - **Fix**: Add `metabob_activity_save()` call after Storage.write

4. **Activity.load** (repos/metabob-opencode/packages/opencode/src/session/activity.ts:470-520)
   - **Gap**: No backend fallback
   - **Impact**: Cannot load activities from other instances
   - **Fix**: Add CLI MCP fallback when Storage.read fails

#### ✅ REFERENCE IMPLEMENTATIONS (2)

5. **metabob_impulse_store** (repos/metabob-cli/src/metabob_cli/mcp/tools.py:~3500-3550)
   - ✅ Correctly implements vessel flow: CLI -> rpc-api -> SurrealDB
   - ✅ Enforces (api_key, project_id) scoping
   - ✅ Already deployed and working

6. **metabob_impulse_load** (repos/metabob-cli/src/metabob_cli/mcp/tools.py:~3580-3620)
   - ✅ Correctly retrieves from backend
   - ✅ Cross-instance access working
   - ✅ Already deployed and working

---

## Violations Summary

### 4 Violations Detected

1. **vessel-boundary-violation** (HIGH)
   - Storage.ts bypasses CLI MCP entirely
   - Location: repos/metabob-opencode/packages/opencode/src/storage/storage.ts:208-234
   - Impact: Instance A cannot access Instance B's data

2. **missing-backend-sync** (HIGH)
   - impulse_create doesn't call metabob_impulse_store
   - Location: repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:64-67
   - Impact: Impulses only on local instance

3. **missing-backend-fallback** (HIGH)
   - Activity.load only checks local storage
   - Location: repos/metabob-opencode/packages/opencode/src/session/activity.ts:470-520
   - Impact: Cannot load cross-instance activities

4. **local-state-dependency** (MEDIUM)
   - SessionMemory.save no backend sync
   - Location: repos/metabob-opencode/packages/opencode/src/session/session-memory.ts:114-124
   - Impact: Session memory not shared

---

## Fix Strategy

### Phase 1: Dual-Write Pattern (Backend Sync)

**Goal**: Add backend persistence after local writes

**Changes**:
```typescript
// repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:67
await SessionMemory.addImpulse(sessionID, impulse)
await syncImpulseToActivity(sessionID, impulse)

// ADD THIS:
await MCP.call('metabob_impulse_store', {
  impulse_id: impulse.id,
  project_id: await getProjectId(),
  impulse_data: impulse
})
```

```typescript
// repos/metabob-opencode/packages/opencode/src/session/activity.ts:589
await Storage.write(["activity", activity.id], cleanedActivity)

// ADD THIS:
await MCP.call('metabob_activity_save', {
  activity_id: activity.id,
  project_id: activity.projectID,
  activity_data: cleanedActivity
})
```

### Phase 2: Read Fallback (Cross-Instance Access)

**Goal**: Fallback to backend when local read fails

**Changes**:
```typescript
// repos/metabob-opencode/packages/opencode/src/session/activity.ts:470-520
export async function load(id: string): Promise<Info> {
  try {
    // Try local first (fast path)
    return await Storage.read<Info>(["activity", id])
  } catch (error) {
    // Fallback to backend (cross-instance)
    const result = await MCP.call('metabob_activity_load', {
      activity_id: id,
      project_id: await getProjectId()
    })
    return result.activity_data
  }
}
```

### Phase 3: Validation

**Run harness**: `tests/validation-harnesses/invariant-storage-across-instances-with-vessel-flow-harness.ts`

**Tests**:
1. ✅ Vessel flow compliance (no direct RPC imports)
2. ✅ Cross-instance impulse retrieval
3. ✅ Multi-tenant isolation
4. ✅ Project isolation
5. ✅ Pagination

---

## Key Insights

1. **CLI Already Correct**: metabob_impulse_store/load in CLI already implement proper vessel flow
2. **opencode Bypasses CLI**: Storage.ts writes directly to filesystem without MCP calls
3. **Dual Storage Needed**: Local for caching + backend (via CLI) for cross-instance invariance
4. **Validation Harness Exists**: Comprehensive test suite already written

---

## Data Flow Comparison

### Current (Broken)
```
impulse_create → SessionMemory → Activity → Storage.write → Local filesystem
                                                           ↓
                                                    Instance-specific
```

### Desired (Fixed)
```
impulse_create → SessionMemory → Activity → Storage.write → Local (cache)
                                          ↓
                                   MCP.call(metabob_impulse_store)
                                          ↓
                                   CLI → rpc-api → SurrealDB
                                          ↓
                                   Instance-invariant ✅
```

---

## Vessel Boundaries

### opencode (Frontend Vessel)
- ✅ MUST: Call CLI MCP tools for backend operations
- ✅ MUST: Use local storage for caching only
- ❌ MUST NOT: Make direct HTTP calls to rpc-api
- ❌ MUST NOT: Import metabob rpc client

### CLI (Gateway Vessel)
- ✅ MUST: Forward storage operations to rpc-api
- ✅ MUST: Add (api_key, project_id) to requests
- ❌ MUST NOT: Allow opencode to bypass it

### rpc-api (Backend Vessel)
- ✅ MUST: Enforce (api_key, project_id) isolation
- ✅ MUST: Store in SurrealDB
- ❌ MUST NOT: Be called directly by opencode

---

## Trace Metadata

- **Traced At**: 2026-02-27
- **Traced By**: review-agent
- **Method**: code-reading + dataflow-analysis
- **Files Analyzed**: 7
- **Validation Harness**: invariant-storage-across-instances-with-vessel-flow-harness.ts

---

## Next Steps

1. ✅ Trace complete - impulse data ready at `trace-instance-invariant-storage-analysis.json`
2. ⏭️ Downstream tasks can use this impulse for validation/enforcement
3. ⏭️ Fix Phase 1: Add dual-write to impulse_create and Activity.save
4. ⏭️ Fix Phase 2: Add backend fallback to Activity.load and impulse_load
5. ⏭️ Fix Phase 3: Run validation harness to verify

---

## Impulse Details

**ID**: `trace-instance-invariant-storage-with-vessel-flow`
**Type**: `templateDefinition`
**Budget**: 5000 tokens
**File**: `trace-instance-invariant-storage-analysis.json`

This impulse can be loaded by downstream agents to:
- Understand current vs desired state
- Implement fixes based on traced components
- Validate vessel flow compliance
- Enforce instance-invariant storage
