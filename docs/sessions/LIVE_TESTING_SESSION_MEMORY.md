# Live Testing: Session Memory & Impulse System

## Session Start: 2026-02-20

## Test Plan

### Phase 1: Basic Hook Execution ✅ / ❌
- [ ] 1.1: Verify hooks are registered on startup
- [ ] 1.2: Confirm memory-management hook is enabled
- [ ] 1.3: Test hook execution on user message
- [ ] 1.4: Verify activity completes successfully
- [ ] 1.5: Check impulse transfer to parent session

### Phase 2: Memory Agent Tools ✅ / ❌
- [ ] 2.1: Verify memory agent exists
- [ ] 2.2: Check tool availability (impulse_create, impulse_load, etc.)
- [ ] 2.3: Test impulse_create tool
- [ ] 2.4: Test impulse_load tool
- [ ] 2.5: Test memory_context_view tool

### Phase 3: Performance Metrics ✅ / ❌
- [ ] 3.1: Measure pre-turn hook latency
- [ ] 3.2: Measure memory activity duration
- [ ] 3.3: Count log entries per turn
- [ ] 3.4: Measure token cost
- [ ] 3.5: Verify target < 2s latency

### Phase 4: Error Handling ✅ / ❌
- [ ] 4.1: Test hook failure (non-fatal)
- [ ] 4.2: Test required context not found
- [ ] 4.3: Test impulse loading failure
- [ ] 4.4: Verify graceful degradation

---

## Test Execution Log

### Test 1.1: Verify hooks registered on startup

**Command**:
```bash
cd repos/metabob-opencode
# Check if hooks are registered
```

**Expected**: 5 hooks registered (memory-management, activity-recommendation-injection, metabob-context-preparation, post-turn-cleanup, session-memory-optimization)

**Result**:
- Status: ⏳ Pending
- Observed:
- Notes:

---

### Test 1.2: Confirm memory-management hook is enabled

**Command**:
```typescript
// Check hook configuration
// Verify sessionMemory.enabled !== false
```

**Expected**: Hook is enabled for primary agent mode

**Result**:
- Status: ⏳ Pending
- Observed:
- Notes:

---

### Test 1.3: Test hook execution on user message

**Command**:
```bash
# Start OpenCode session
# Send test message: "Fix the bug in src/tool/bash.ts"
# Watch logs for "executing memory management activity"
```

**Expected**: Hook executes before main agent turn

**Result**:
- Status: ⏳ Pending
- Observed:
- Notes:

---

## Results Summary

**Tests Passed**: 0 / 18  
**Tests Failed**: 0 / 18  
**Tests Pending**: 18 / 18

**Overall Status**: 🟡 Testing in progress

---

## Issues Found

None yet.

---

## Performance Metrics

- Pre-turn hook latency: ⏳ Not measured
- Memory activity duration: ⏳ Not measured
- Log entries per turn: ⏳ Not counted
- Token cost per turn: ⏳ Not measured

---

## Next Steps

1. Execute Phase 1 tests
2. Document findings
3. Proceed to Phase 2
