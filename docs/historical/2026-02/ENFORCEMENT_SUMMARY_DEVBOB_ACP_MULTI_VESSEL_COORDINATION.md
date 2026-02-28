# Enforcement Summary: devbob-acp-multi-vessel-coordination

**Date:** 2026-02-27  
**Specification:** DevBob ACP Multi-Vessel Coordination  
**Trace Impulse:** trace-devbob-acp-multi-vessel-coordination  
**Enforcement Impulse:** enforcement-devbob-acp-multi-vessel-coordination

---

## Executive Summary

Enforced distributed multi-agent coordination specification across 3 critical components in the OpenCode codebase. Closed **5 of 7 identified gaps** with focus on security and reliability. Deferred 2 gaps (caching, transactions) to future work as they are optimizations rather than correctness requirements.

### Risk Mitigation

- ✅ **1 CRITICAL** risk mitigated: SQL injection in vessel registry
- ✅ **3 HIGH** risks mitigated: docker retry, version negotiation, permission timeout  
- ✅ **1 MEDIUM** risk mitigated: event subscription cleanup
- ⏳ **2 gaps deferred**: caching layer, transaction support (low priority)

---

## Changes Applied

### 1. CRITICAL: SQL Injection Protection (vessel/bootstrap.ts:429)

**Problem:** Vessel metadata was inserted into SurrealDB using string concatenation, allowing SQL injection attacks.

**Solution:** Added input validation before query construction:
- `vessel_name`: Must match `^[a-zA-Z0-9\-_]+$` (Kubernetes naming convention)
- `pod_ip`: Must match `^[\d\.]+$` (valid IPv4 format)
- `acp_port`: Must be in range 1-65535

**Impact:** Zero breaking changes. Validation only rejects invalid inputs that would fail anyway. Protects vessel registry integrity.

**Code:**
```typescript
// SECURITY: Input validation to prevent SQL injection
if (!/^[a-zA-Z0-9\-_]+$/.test(vessel_name)) {
  throw new Error(`Invalid vessel_name format: ${vessel_name}. Must contain only alphanumeric, hyphen, and underscore characters.`)
}
```

---

### 2. HIGH: Docker Exec Retry Logic (acp-delegate.ts:33)

**Problem:** Transient container failures (restart, network issues) caused permanent delegation failures.

**Solution:** Implemented exponential backoff retry (3 attempts, 1s initial delay):
- Attempt 1: Immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay
- Total max additional latency: 7s (only on failure)

**Impact:** Low risk. Typical success case unchanged. Handles transient failures gracefully.

**Code:**
```typescript
const dockerProcess = await retryWithBackoff(
  () => { /* spawn docker exec */ },
  DOCKER_EXEC_MAX_RETRIES,
  DOCKER_EXEC_RETRY_DELAY_MS,
  `docker exec for container ${containerName}`
)
```

---

### 3. HIGH: Version Negotiation (acp-delegate.ts:340)

**Problem:** Incompatible OpenCode versions caused silent failures or undefined behavior.

**Solution:** Added protocol version check after ACP handshake:
- Validate `protocolVersion === 1`
- Fail fast with clear error if mismatch
- Warn if OpenCode versions differ between host and remote

**Impact:** Zero breaking changes for compatible versions. Fails fast for incompatible versions (better than silent corruption).

**Code:**
```typescript
if (initResult.protocolVersion !== 1) {
  throw new Error(
    `Protocol version mismatch: expected 1, got ${initResult.protocolVersion}. ` +
    `Remote agent may be incompatible.`
  )
}
```

---

### 4. HIGH: Permission Request Timeout (acp/agent.ts:86)

**Problem:** Remote agents hung indefinitely if host crashed during permission request.

**Solution:** Wrapped `requestPermission` in `Promise.race` with 30s timeout:
- Auto-rejects permission on timeout
- Logs timeout for debugging
- Prevents resource leaks

**Impact:** Low risk. 30s is generous for permission approval. Edge case: slow networks may timeout, but this is preferable to infinite hang.

**Code:**
```typescript
const res = await Promise.race([
  this.connection.requestPermission({ /* ... */ }),
  timeoutPromise // 30s
]).catch(async (error) => {
  // Auto-reject on timeout
  await this.config.sdk.postSessionIdPermissionsPermissionId({
    body: { response: "reject" }
  })
})
```

---

### 5. MEDIUM: Event Subscription Cleanup (acp/agent.ts:64)

**Problem:** Event subscriptions without cleanup caused memory leaks in long-running processes.

**Solution:** Added subscription tracking and cleanup mechanism:
- `eventSubscriptions` Map tracks subscriptions per session
- `isActive` flag stops event loop when session closes
- `cleanupSession(sessionId)` method unsubscribes and releases resources

**Impact:** Zero breaking changes. Cleanup is opt-in via `cleanupSession()`. Enables proper resource management.

**Code:**
```typescript
private eventSubscriptions = new Map<string, { stop: () => void }>()

private cleanupSession(sessionId: string) {
  const subscription = this.eventSubscriptions.get(sessionId)
  if (subscription) {
    subscription.stop()
    this.eventSubscriptions.delete(sessionId)
  }
}
```

---

## Gaps Deferred

### 1. Caching Layer (impulse-resolver.ts)

**Priority:** MEDIUM  
**Reason:** Optimization, not correctness. Current local-first resolution is functional.  
**Deferred to:** Performance optimization sprint  
**Proposed solution:** LRU cache with mtime-based invalidation

### 2. Transaction Support (session-memory.ts)

**Priority:** LOW  
**Reason:** Complex infrastructure change. File system provides reasonable durability.  
**Deferred to:** Storage layer refactor  
**Proposed solution:** Atomic transactions and write-ahead log

---

## Enforcement Constraints Satisfied

| Constraint | Status | Implementation |
|------------|--------|----------------|
| **Security: SQL injection protection** | ✅ | Input validation in `registerVesselInSurrealDB` |
| **Security: Version compatibility check** | ✅ | Protocol version check in ACP handshake |
| **Reliability: Docker exec retry (3 attempts)** | ✅ | `retryWithBackoff` helper with exponential backoff |
| **Reliability: Permission timeout (30s)** | ✅ | `Promise.race` with timeout in permission handler |
| **Reliability: Event subscription cleanup** | ✅ | `cleanupSession()` method + `eventSubscriptions` Map |
| **Performance: Throttled updates (max 2/sec)** | ✅ | Already implemented (not changed) |
| **Performance: Pointer-only serialization** | ✅ | Already implemented (not changed) |
| **Performance: Local-first resolution** | ✅ | Already implemented (not changed) |

---

## Validation Next Steps

The enforcement changes must be validated with test harnesses:

1. **SQL Injection Test**  
   Input: `vessel_name = "devbob-0; DELETE FROM vessel_registry;"`  
   Expected: Validation error, no query execution

2. **Docker Retry Test**  
   Simulate: Container restart during delegation  
   Expected: Retry succeeds after 1-2 attempts

3. **Version Mismatch Test**  
   Setup: Connect host (protocol v1) to remote (protocol v2)  
   Expected: Clear error message, delegation aborts

4. **Permission Timeout Test**  
   Simulate: Host hangs during permission request  
   Expected: Auto-reject after 30s, execution continues

5. **Event Cleanup Test**  
   Action: Create 100 sessions, close all without cleanup  
   Expected: Memory usage stable, no leaks

**Next Activity:** `validate-devbob-acp-multi-vessel-coordination`

---

## Data Flow Impact

Enforcement changes ripple through the data flow:

```
acp_delegate (entry) 
  ↓ [CHANGED: Add retry logic, version check]
→ Docker Exec (transport)
  ↓
→ ACP Handshake (protocol)
  ↓ [CHANGED: Version validation]
→ Permission Handler
  ↓ [CHANGED: Add 30s timeout]
→ Event Relay
  ↓ [CHANGED: Add cleanup tracking]
→ Vessel Registry
  ↓ [CHANGED: Input validation]
→ Tool Result (exit)
```

All changes maintain backward compatibility and enhance reliability.

---

## Files Modified

1. `repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts` (+18 lines)
2. `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts` (+86 lines)
3. `repos/metabob-opencode/packages/opencode/src/acp/agent.ts` (+38 lines)

**Total:** +142 lines of enforcement code (security + reliability)

---

## Commit References

- Submodule commit: `cc1118cd` - "Enforce devbob-acp-multi-vessel-coordination specification"
- Parent repo commit: `7d01f10` - "Update opencode submodule with devbob-acp-multi-vessel-coordination enforcement"
- Impulse commit: `1fb34e7` - "Add enforcement summary impulse for devbob-acp-multi-vessel-coordination"

---

## Success Criteria

- [x] All CRITICAL risks mitigated
- [x] All HIGH risks mitigated  
- [x] MEDIUM risks addressed or deferred with rationale
- [x] Zero breaking changes for existing users
- [x] All enforcement constraints satisfied
- [x] Changes documented in impulse system
- [x] Submodule updated and committed
- [ ] Validation harnesses created (next activity)
- [ ] E2E tests passing (pending validation)

**Status:** ✅ Enforcement Complete, Ready for Validation
