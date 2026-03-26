# Trace Summary: Instance-Invariant Storage for Impulses and Activities

**Specification**: For a given (metabob_api_key, project_id) pair, impulse and activity storage must be accessible from any instance (opencode or metabob-cli) without differences.

**Status**: ✅ TRACED - Comprehensive analysis completed

---

## Executive Summary

### Current State: ⚠️ PARTIALLY INSTANCE-INVARIANT

- **Local Storage**: Storage.ts writes to local filesystem only
- **Vessel Flow**: opencode -> Storage.ts -> Local filesystem (BYPASSES CLI MCP)
- **Impact**: Impulses/activities created in Instance A are NOT accessible from Instance B

### Desired State: ✅ FULLY INSTANCE-INVARIANT

- **Dual Storage**: Local caching + Backend persistence via CLI MCP
- **Vessel Flow**: opencode -> CLI MCP tools -> rpc-api -> SurrealDB
- **Impact**: Data accessible from any instance with matching credentials

---

## Critical Violations

### 🔴 HIGH Severity

1. **Vessel Boundary Violation**
   - Location: `repos/metabob-opencode/packages/opencode/src/storage/storage.ts:208-234`
   - Issue: Direct local filesystem writes bypass CLI MCP entirely
   - Impact: Instance-specific storage breaks cross-instance access

2. **Missing Backend Sync**
   - Location: `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:64-67`
   - Issue: impulse_create tool doesn't call metabob_impulse_store after local write
   - Impact: Impulses only exist on creating instance

3. **Missing Backend Fallback**
   - Location: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:470-520`
   - Issue: Activity.load only checks local storage
   - Impact: Cannot load activities created by other instances

### 🟡 MEDIUM Severity

4. **Local State Dependency**
   - Location: `repos/metabob-opencode/packages/opencode/src/session/session-memory.ts:114-124`
   - Issue: SessionMemory.save writes to local storage without backend sync
   - Impact: Session memory not shared across instances

---

## Data Flow Analysis

### Current Flow (BROKEN)
```
User creates impulse
  → impulse_create tool
  → SessionMemory.addImpulse
  → Activity.addImpulses
  → Activity.save
  → Storage.write(['activity', id])
  → Local filesystem ONLY ❌
```

### Desired Flow (CORRECT)
```
User creates impulse
  → impulse_create tool
  → SessionMemory.addImpulse
  → Activity.addImpulses
  → Activity.save
  → Storage.write(['activity', id]) (local cache)
  → CLI MCP metabob_impulse_store() ✅
  → rpc-api /v2/impulses ✅
  → SurrealDB (cross-instance) ✅
```

---

## Components Requiring Changes

| File | Component | Gap | Priority |
|------|-----------|-----|----------|
| storage.ts | Storage namespace | No vessel flow enforcement | HIGH |
| impulse-create.ts | ImpulseCreateTool | No backend sync | HIGH |
| activity.ts | Activity.save | No backend sync | HIGH |
| activity.ts | Activity.load | Missing backend fallback | HIGH |
| impulse-sync.ts | syncImpulseToActivity | Missing backend sync | MEDIUM |
| session-memory.ts | SessionMemory.save | No backend integration | MEDIUM |

---

## Reference Implementations (✅ CORRECT)

These CLI MCP tools already implement the correct vessel flow:

1. **metabob_impulse_store**
   - Location: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:~3500-3550`
   - Flow: CLI MCP -> rpc-api /v2/impulses -> SurrealDB
   - Status: ✅ Correctly implements cross-instance storage

2. **metabob_impulse_load**
   - Location: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:~3580-3620`
   - Flow: CLI MCP -> rpc-api /v2/impulses/{id} -> SurrealDB
   - Status: ✅ Correctly implements cross-instance retrieval

---

## Fix Strategy

### Phase 1: Dual-Write Pattern
Add backend sync AFTER local writes (maintains performance, adds persistence)

**Changes:**
1. `impulse-create.ts`: After local write, call `metabob_impulse_store()`
2. `activity.ts (Activity.save)`: After Storage.write, call `metabob_activity_save()`

### Phase 2: Read Fallback
Add backend fallback for read operations (enables cross-instance access)

**Changes:**
1. `activity.ts (Activity.load)`: Try local first, fallback to `metabob_activity_load()`
2. `impulse-load.ts`: Try SessionMemory, fallback to `metabob_impulse_load()`

### Phase 3: Validation
Validate vessel flow enforcement

**Tests:**
- Run `invariant-storage-across-instances-with-vessel-flow-harness.ts`
- Verify no direct RPC imports in opencode
- Test cross-instance impulse/activity retrieval
- Verify (api_key, project_id) isolation

---

## Vessel Boundaries

### OpenCode (Frontend Vessel)
**Role**: User interaction, tool execution, local caching

**MUST**:
- Call CLI MCP tools for backend operations
- Use local storage for caching only
- Respect (api_key, project_id) scoping

**MUST NOT**:
- Make direct HTTP calls to rpc-api
- Import metabob rpc client directly
- Use fetch() to call backend endpoints

### CLI (Gateway Vessel)
**Role**: MCP tool provider, vessel flow enforcement

**MUST**:
- Forward all storage operations to rpc-api
- Add (api_key, project_id) to all requests
- Validate inputs before forwarding

**MUST NOT**:
- Allow opencode to bypass it
- Store state locally

### RPC-API (Backend Vessel)
**Role**: Persistence, multi-tenancy, database access

**MUST**:
- Enforce (api_key, project_id) isolation
- Store in SurrealDB for cross-instance access
- Return consistent data regardless of requesting instance

**MUST NOT**:
- Be called directly by opencode

---

## Key Insights

1. **CLI Implements Correct Flow**: `metabob_impulse_store` and `metabob_impulse_load` already implement correct vessel flow
2. **OpenCode Bypasses CLI**: Storage.ts writes directly to local filesystem without calling CLI MCP tools
3. **Dual Storage Needed**: Local storage for caching + backend storage (via CLI) for cross-instance invariance
4. **Project ID Scoping**: Backend uses (api_key, project_id) for multi-tenancy - project_id is git root hash
5. **Validation Harness Exists**: `tests/validation-harnesses/invariant-storage-across-instances-with-vessel-flow-harness.ts`

---

## Validation Harness

**Location**: `tests/validation-harnesses/invariant-storage-across-instances-with-vessel-flow-harness.ts`

This comprehensive test suite validates:
- Cross-instance impulse/activity retrieval
- (api_key, project_id) isolation
- Vessel flow enforcement
- No direct RPC imports

---

## Trace Metadata

- **Traced At**: 2026-02-27T04:11:00Z
- **Traced By**: review-agent via trace-data-flow-single-feature activity
- **Method**: Automated code reading + dataflow-analysis + CPG dependency tracing
- **Activity Duration**: 925.9s
- **Activity Cost**: $2.0535

---

## Next Steps

1. ✅ **COMPLETE**: Trace current implementation
2. 🔄 **NEXT**: Enforce vessel flow (Phase 1 + Phase 2)
3. ⏳ **PENDING**: Validate with harness (Phase 3)
4. ⏳ **PENDING**: Aggregate conflicts and ripple changes

---

## Impulse Location

**ID**: `trace-Instance-Invariant Storage for Impulses and Activities`

**Files**:
- `./trace-Instance-Invariant-Storage-for-Impulses-and-Activities.json`
- `./impulses/trace-Instance-Invariant-Storage-for-Impulses-and-Activities.json`

**Budget**: 5000 tokens allocated for downstream tasks

