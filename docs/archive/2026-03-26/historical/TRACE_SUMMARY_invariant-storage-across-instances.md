# Trace Summary: invariant-storage-across-instances

## Executive Summary

**Status:** ❌ **NOT IMPLEMENTED**

The current impulse and activity storage implementation **violates** the instance-agnostic requirement. All storage operations write to the local filesystem at `~/.local/share/opencode/storage/`, which varies by user, machine, and container. No backend integration exists, making it impossible for multiple instances to share data.

## Root Cause Analysis

### Primary Root Cause
**`Storage.write()` is hardcoded to local filesystem** (repos/metabob-opencode/packages/opencode/src/storage/storage.ts:189)
- No backend storage client integration
- No hybrid storage pattern
- Direct Bun.write() to local path

### Secondary Root Causes
1. **`Global.Path.data` resolves to instance-local path** (repos/metabob-opencode/packages/opencode/src/global/index.ts:8)
   - Uses XDG_DATA_HOME or homedir()
   - Path varies: `/home/avi/`, `/root/`, `/Users/avi/`, etc.

2. **No optimistic locking** (repos/metabob-opencode/packages/opencode/src/session/activity.ts:1205)
   - Read-modify-write race condition
   - Lost update problem in concurrent writes
   - No version field or conflict detection

3. **Process-local locking** (repos/metabob-opencode/packages/opencode/src/util/lock.ts:193)
   - Lock.write("storage") is process-local
   - Doesn't coordinate across instances
   - Different instances can write simultaneously

4. **Standalone session impulses not persisted** (repos/metabob-opencode/packages/opencode/src/session/impulse-sync.ts:32)
   - Only activity-associated sessions persist impulses
   - Standalone session impulses lost on process exit

## Critical Security & Data Integrity Risks

### HIGH Severity
1. **Path Traversal Vulnerability** (storage/storage.ts:191)
   - No validation of key segments
   - Exploit: `Storage.write(["activity", "../../../etc/passwd"], data)`
   - Impact: Arbitrary file write (system compromise)

2. **Lost Update Problem** (session/activity.ts:1205)
   - Race condition in multi-instance writes
   - Scenario: Instance A adds impulse C, Instance B adds impulse D → C is lost
   - Impact: Silent data loss

3. **No Backend Authentication** (api/activity-client.ts:106)
   - Backend API calls have no Authorization header
   - Impact: No access control (anyone can read/write activities)

### MEDIUM Severity
4. **Activity ID Collision** (storage/storage.ts:191)
   - No project_id in storage key
   - Different projects may overwrite each other

5. **Standalone Session Impulse Loss** (session/impulse-sync.ts:32)
   - Process crash → impulses lost
   - Cannot recover standalone session data

## Data Flow Analysis

### Current Flow (Instance-Local)
```
LLM tool call 
→ ImpulseCreateTool.execute 
→ SessionMemory.addImpulse 
→ Storage.write(session-memory) 
→ local filesystem (~/.local/share/opencode/storage/)
|
syncImpulseToActivity 
→ Activity.addImpulses 
→ Storage.write(activity) 
→ local filesystem
```

### Required Flow (Instance-Agnostic)
```
LLM tool call 
→ ImpulseCreateTool.execute 
→ SessionMemory.addImpulse 
→ HybridStorage.write 
  → (1) try backend API 
  → (2) always local backup
|
syncImpulseToActivity 
→ Activity.addImpulses with optimistic lock 
→ HybridStorage.write with version check 
  → backend PATCH with CRDT merge 
  → local backup
```

## Key Components Requiring Changes

| Component | File | Line | Gap |
|-----------|------|------|-----|
| Storage.write | repos/metabob-opencode/packages/opencode/src/storage/storage.ts | 189 | No backend integration, hardcoded to local filesystem |
| Global.Path.data | repos/metabob-opencode/packages/opencode/src/global/index.ts | 8 | Path varies by environment (root cause) |
| Activity.addImpulses | repos/metabob-opencode/packages/opencode/src/session/activity.ts | 1205 | No version field, no conflict detection, no retry logic |
| syncImpulseToActivity | repos/metabob-opencode/packages/opencode/src/session/impulse-sync.ts | 27 | No persistence for standalone sessions |
| Lock.write | repos/metabob-opencode/packages/opencode/src/util/lock.ts | 193 | Process-local, no distributed locking |

## Implementation Roadmap

### Phase 1: Security Fixes (1-2 days) [CRITICAL]
- Add key segment validation in Storage.write() (path traversal fix)
- Add Authorization header to backend API calls
- Add project_id to storage keys (prevent collision)

### Phase 2: Data Integrity (3-4 days) [HIGH]
- Add optimistic locking to Activity.addImpulses()
- Add conflict resolution strategy
- Add distributed locking (Redis/Database)
- Persist standalone session impulses

### Phase 3: Backend Storage Integration (4-5 days) [HIGH]
- Create ActivityStorageClient (backend API client)
- Create ActivityRepository abstraction
- Create StorageBackend abstraction (local | remote | hybrid)
- Add backend endpoints (Python, POST/GET/PATCH/DELETE)
- Modify Storage.read/write to use hybrid backend

### Phase 4: Reliability & Observability (2-3 days) [MEDIUM]
- Add circuit breaker for backend calls
- Add retry queue for failed writes
- Add metrics and monitoring (latency, errors, throughput)
- Add health checks for backend

**Total Effort:** 10-14 days

## Reusable Patterns Identified

1. **Hybrid Storage (Backend + Local Fallback)**
   - Working Example: TemplateServiceClient
   - Applicability: Multi-instance systems requiring shared state

2. **Optimistic Locking with Retry**
   - Purpose: Prevent lost updates in concurrent writes
   - Template Needed: optimistic-locking-update

3. **Dual Storage (Cache + Persistence)**
   - Purpose: Fast reads + reliable persistence
   - Template Needed: dual-storage-pattern

4. **Circuit Breaker**
   - Purpose: Fail fast when backend unavailable
   - Template Needed: circuit-breaker-wrapper

5. **Retry with Exponential Backoff**
   - Working Example: api/activity-client.ts:61-84
   - Applicability: Network operations, backend API calls

## Success Criteria

1. ✅ Instance A (user=avi, machine=laptop, project_id=proj_123) creates impulse 'trace-x'
2. ✅ Instance B (user=root, machine=docker, project_id=proj_123) can load impulse 'trace-x'
3. ✅ Backend unavailable → Instances fall back to local storage (graceful degradation)
4. ✅ Tests pass: Multi-instance, fallback, concurrency
5. ✅ No silent data loss in concurrent writes
6. ✅ No path traversal vulnerability
7. ✅ Backend API requires authentication

## Artifacts Generated

1. **Full Trace Document:** `docs/data-flows/invariant-storage-across-instances-flow.md`
   - Comprehensive 1108-line analysis
   - Mermaid diagrams (current vs desired flow)
   - Detailed component analysis
   - Risk assessment
   - Pattern catalog

2. **Structured Specification:** `SPEC_TRACE_invariant-storage-across-instances.json`
   - Machine-readable format
   - Component gaps
   - Implementation roadmap
   - Success criteria

3. **Trace Impulse:** `trace-invariant-storage-across-instances`
   - ID: trace-invariant-storage-across-instances
   - Budget: 5000 tokens
   - Type: specification-trace
   - Priority: high
   - Status: Available for downstream tasks

## Recommendations for Downstream Tasks

### Validation Task
- Use impulse `trace-invariant-storage-across-instances` for context
- Validate that each component gap is accurately identified
- Check security risks are properly documented
- Verify implementation roadmap is feasible

### Enforcement Task
- Prioritize Phase 1 (Security Fixes) - CRITICAL
- Address HIGH severity risks before deployment
- Follow TemplateServiceClient pattern for hybrid storage
- Implement optimistic locking to prevent data loss

### Activity Evolution
- Consider creating templates for identified patterns:
  - `optimistic-locking-update`
  - `dual-storage-pattern`
  - `circuit-breaker-wrapper`
- Use trace document as reference for similar multi-instance storage features

## Next Steps

1. **Immediate:** Review security vulnerabilities (path traversal, no auth, no project_id)
2. **Before Multi-Instance Deployment:** Implement Phases 1-3 (security + data integrity + backend storage)
3. **Long-term:** Add observability and monitoring (Phase 4)

---

**Document Generated:** 2026-02-27  
**Trace Activity Status:** ✅ Complete  
**Impulse Created:** ✅ trace-invariant-storage-across-instances  
**Total Analysis Tokens:** 670,607 input, 4,997 output  
**Total Cost:** $2.41
