# Phase 8 Blocker Investigation Report

**Date:** 2026-04-28  
**Investigation Scope:** 5 blockers identified during Iteration 1 execution  
**Investigator:** Claude Code (haiku-4-5)

---

## Executive Summary

Five blocking issues prevent Phase 8 end-to-end validation from completing. All 5 are **P0 severity** and must be resolved before Phase 5 cutover can proceed.

| # | Root Cause | Severity | Phase 8 | Phase 5 | Fix Effort | Priority |
|---|---|---|---|---|---|---|
| **1** | Missing null-guard on `imp.pointer` | BLOCKER | ✅ | ✅ | 15m | **P0** |
| **2** | Schema enum gap (system/security) | DEGRADATION | ❌ | ✅ | 15m | **P1** |
| **3** | HTTP 500 length limit (backend) | BLOCKER | ✅ | ✅ | 1-2h | **P0** |
| **4** | Conditional syntax error | BLOCKER | ✅ | ✅ | 30m | **P0** |
| **5** | Missing "lifecycle" impulse type | BLOCKER | ✅ | ✅ | 1h | **P0** |

**Total Fix Effort:** 3-4 hours (sequential)

---

## Blocker 1: Bootstrap Impulse Structure — TypeError on `imp.pointer.type`

**Severity:** BLOCKER → Phase 8 validation, Phase 5 cutover  
**Fix Effort:** 15 minutes

### Symptom
`TypeError: Cannot read property 'type' of undefined` when accessing `imp.pointer.type`

### Root Cause
Goal-impulse initialization creates impulses with missing `pointer` field. Line 2509 iterates over impulses and accesses `.pointer.type` without null/undefined guards.

**Code Location:**
```typescript
// repos/minibob/src/activity.ts:2507-2514
const impulseInfo = impulses.map((imp) => ({
  id: imp.id,
  type: imp.pointer.type,  // ← CRASH if imp.pointer is undefined
  loaded: imp.loaded,
  tokens: imp.tokenCount,
  budget: imp.budget,
}));
```

### Investigation Path
1. Check `goal-processing-activity-driven.json` goal-impulse seeding logic
2. Verify impulse structure in `context-memory-agent.ts` or `impulse.ts` creation
3. Determine which goal-processor path creates malformed impulses

### Impact
- Blocks execution when impulses are loaded with goals
- Prevents slot-binding meta-activity from loading impulse context
- Fails in parent executions that produce goal impulses

### Recommended Fix
```typescript
const impulseInfo = impulses.map((imp) => ({
  id: imp.id,
  type: imp.pointer?.type ?? 'unknown',  // Defensive null-check
  loaded: imp.loaded,
  tokens: imp.tokenCount,
  budget: imp.budget,
}));
```

---

## Blocker 2: Template Category Enum Gap

**Severity:** DEGRADATION → Phase 5 cutover only (NOT Phase 8)  
**Fix Effort:** 15 minutes

### Symptom
Schema validation error: "category" value not in valid enum (feature|bugfix|refactor|tool|infrastructure|meta)

### Root Cause
The ActivityTemplate interface in `types.ts` defines category as a finite enum, but 4 embedded templates use invalid values:
- `analyze-success-patterns.json`: `"category": "system"`
- `analyze-failure-patterns.json`: `"category": "system"`
- `compare-template-variants.json`: `"category": "system"`
- `scan-for-secrets.json`: `"category": "security"`

**Code Locations:**
- Schema: `repos/minibob/src/types.ts` (ActivityTemplate interface)
- Templates: 4 files in `repos/minibob/src/embedded-templates/`

### Impact
- Phase 5 template loading validation will reject invalid categories
- Prevents template registration in activity-api
- Does NOT affect Phase 8 (only blocks template load at executor startup)

### Recommended Fix
Expand enum in `types.ts`:
```typescript
category?: 
  | "feature" 
  | "bugfix" 
  | "refactor" 
  | "tool" 
  | "infrastructure" 
  | "meta"
  | "system"     // ← Add
  | "security";  // ← Add
```

### Design Question
Should these be separate enum values or expressed via tags instead?
- Recommendation: Add both (for backward compatibility) AND clarify intent via tags

---

## Blocker 3: Backend HTTP 500 "Length Limit Exceeded"

**Severity:** BLOCKER → Phase 8 validation, Phase 5 cutover  
**Fix Effort:** 1-2 hours investigation + variable fix time

### Symptom
HTTP 500 "length limit exceeded" when storing execution traces from Phase 6/7 nested activities

### Root Cause (Unknown)
Possible causes identified:
1. **Hono body size limit** — Default max payload (typically 100KB for JSON)
2. **SurrealDB row size limit** — Nested traces with full composition_chain exceed limits
3. **Redis cache limit** — Traces cached before DB write
4. **Trace payload explosion** — Nested executions include full lifecycle event payloads

**Canary Status:**
```
Health: healthy (v1.13.6, 2026-04-28 14:33:28 UTC)
Checks: redis (1ms), surrealdb (4ms), discovery (ok)
```

### Investigation Steps
1. Check `/repos/metabob-activity-api/src/index.ts` for Hono middleware config
2. Check SurrealDB deployment config for row size limits
3. Audit recent changes to `execution-traces.ts`
4. Verify nested executions don't include full parent traces
5. Add request/response logging to capture actual error

### Impact
- Prevents trace storage when nested executions complete
- Blocks validator-dispatch and slot-binding nested executions from persisting traces
- Phase 7 nested execution compositions fail on first trace storage

### Recommended Fix (Likely)
If Hono limit:
```typescript
app.use(Hono.json({ limit: "50mb" }));
```

If SurrealDB: Verify composition_chain is denormalized, not fully serialized

### Testing
Test nested execution trace storage in isolation on canary before full validation

---

## Blocker 4: Validator-Dispatch Conditional Syntax Error

**Severity:** BLOCKER → Phase 8 validation, Phase 5 cutover  
**Fix Effort:** 30 minutes

### Symptom
JSON parsing error or conditional evaluation failure in validator-dispatch task 1

### Root Cause
Invalid conditional expression syntax. Template interpolation returns strings, but comparison uses boolean literal:

```json
"conditional": {
  "expression": "{{lifecycle.skip_validation}} !== true",
  "skipIfFalse": true
}
```

After interpolation becomes:
```
"false" !== true   // String vs boolean → always true!
OR
undefined !== true // Undefined !== true → always true!
```

**Code Location:**
`repos/minibob/src/embedded-templates/validator-dispatch.json` line 37-40

### Impact
- validator-dispatch meta-activity crashes on task 1 (discover_validators)
- Conditional always evaluates incorrectly (intended skip logic never fires)
- Phase 8 validation loop fails at first meta-activity invocation

### Recommended Fix
```json
"conditional": {
  "expression": "{{lifecycle.skip_validation}} !== 'true'",  // Compare to string
  "skipIfFalse": true
}
```

### Audit Required
Check for similar conditional syntax issues in:
- `slot-binding.json` (line 162 mentioned in spec)
- `create-shape-provider-goal.json` (if exists)
- Any other embedded templates with conditionals

### Additional Work
Add schema validation step to catch malformed conditionals at template load time

---

## Blocker 5: MemoryAgent Impulse Type Schema Missing "lifecycle"

**Severity:** BLOCKER → Phase 8 validation, Phase 5 cutover  
**Fix Effort:** 1 hour

### Symptom
Schema validation error: impulse type "lifecycle" not in union (expects file|memo|bashOutput|etc)

### Root Cause
The `ImpulsePointer` type union in `types.ts` (line ~213) does NOT include "lifecycle" variant:

```typescript
type ImpulsePointer =
  | { type: "memo"; content: string }
  | { type: "file"; path: string; offset?: number; limit?: number }
  | { type: "directoryTree"; path: string }
  | { type: "gitDiff"; ... }
  // Missing: | { type: "lifecycle"; payload: unknown }
```

When slot-binding or validator-dispatch emit `lifecycle:task:preBinding` impulses, downstream LLM tasks try to load them. ContextMemoryAgent receives impulses with `pointer.type = "lifecycle"` which schema rejects.

**Code Location:**
`repos/minibob/src/types.ts` around line 250-260 (ImpulsePointer union)

### Investigation
Verify if F-42 (Lifecycle type is local for impulse resolution, 2026-04-27) was properly implemented

### Impact
- Meta-activities cannot emit or load lifecycle impulses
- LLM tasks cannot reference lifecycle impulses from impulse pool
- Learning_signal_writer resolver fails when receiving lifecycle impulses
- Phase 7 nested execution impulse chains break

### Recommended Fix

**Step 1:** Add type to union in `types.ts`
```typescript
type ImpulsePointer =
  | { type: "memo"; content: string }
  | { type: "file"; path: string; offset?: number; limit?: number }
  | { type: "directoryTree"; path: string }
  | { type: "gitDiff"; ... }
  | { type: "lifecycle"; payload: unknown };  // ← Add this
```

**Step 2:** Update `resolvePointer` in `impulse.ts`
```typescript
if (pointer.type === 'lifecycle') {
  return JSON.stringify(pointer.payload);  // F-42 behavior: local resolution
}
```

**Step 3:** Verify ContextMemoryAgent tolerates lifecycle impulses
- May need budget estimation for JSON-stringified payloads
- Check if lifecycle impulses should be marked as non-evictable

---

## Summary Table

| Blocker | Root Cause | Code Location | Fix Effort | Blocks Phase 8 | Blocks Phase 5 | Severity | Action |
|---------|-----------|---|-----------|---|---|---|---|
| **1** | Missing null-guard on `imp.pointer` | activity.ts:2509 | 15m | ✅ | ✅ | **BLOCKER** | Add `?.` operator |
| **2** | Enum gap (system/security) | types.ts, 4 templates | 15m | ❌ | ✅ | **DEGRADATION** | Expand enum |
| **3** | HTTP 500 length limit | activity-api canary | 1-2h | ✅ | ✅ | **BLOCKER** | Investigate Hono/SurrealDB limits |
| **4** | Invalid conditional syntax | validator-dispatch.json:38 | 30m | ✅ | ✅ | **BLOCKER** | Fix string comparison |
| **5** | Missing "lifecycle" type | types.ts:~250 | 1h | ✅ | ✅ | **BLOCKER** | Add type + update resolver |

---

## Recommended Fix Order

1. **Blocker 1 (P0, 15m):** Fix null-guard → unblocks Blocker 3 investigation
2. **Blocker 4 (P0, 30m):** Fix conditional syntax → unblocks validator-dispatch testing
3. **Blocker 5 (P0, 1h):** Add "lifecycle" type → unblocks meta-activity impulse chain
4. **Blocker 3 (P0, 1-2h):** Investigate/fix backend limits → unblocks nested execution traces
5. **Blocker 2 (P1, 15m):** Expand enum → polish before Phase 5 cutover

**Sequential ordering ensures each fix can unblock investigation of the next.**

---

## Phase Blocking Impact

### Phase 8 Validation (End-to-End Canary Loop)
**Blocked by:** All 5 blockers (cannot complete full validation cycle)
- Blocker 1: Crashes when loading goal impulses
- Blocker 3: Prevents nested trace storage
- Blocker 4: validator-dispatch fails on conditional evaluation
- Blocker 5: Lifecycle impulses not recognized

**Not blocked by:** (none)

### Phase 5 Cutover (Decommission Inline Executor)
**Blocked by:** All 5 blockers
- Blocker 1: Fails in nested meta-activity executions
- Blocker 2: Schema validation during template load at startup
- Blocker 3: Cannot persist nested validator-dispatch traces
- Blocker 4: validator-dispatch meta-activity cannot execute
- Blocker 5: learning_signal_writer cannot load lifecycle impulses

---

## Action Items

### Phase 8 Iteration 2 Tasks (Updated in tasks.md)

- **I2.1** Fix Blocker 1: Add null-guard to impulse context summary
  - File: `repos/minibob/src/activity.ts` line 2509
  - Change: `imp.pointer.type` → `imp.pointer?.type ?? 'unknown'`

- **I2.2** Fix Blocker 4: Correct conditional syntax in validator-dispatch.json
  - File: `repos/minibob/src/embedded-templates/validator-dispatch.json` line 38
  - Change: `{{lifecycle.skip_validation}} !== true` → `{{lifecycle.skip_validation}} !== 'true'`
  - Audit: slot-binding.json line 162 and other embedded templates

- **I2.3** Fix Blocker 5: Add "lifecycle" to ImpulsePointer union
  - Files: `repos/minibob/src/types.ts` (~250) and `repos/minibob/src/impulse.ts`
  - Add type variant and resolution handler

- **I2.4** Fix Blocker 3: Backend length limit investigation and fix
  - File: `repos/metabob-activity-api/src/index.ts` (Hono config)
  - Investigate: SurrealDB limits, trace payload expansion, composition_chain denormalization

- **I2.5** Fix Blocker 2: Expand ActivityTemplate category enum
  - File: `repos/minibob/src/types.ts`
  - Add "system" and "security" to enum
  - Run template load test

### Success Criteria for Phase 8 Iteration 2

- [ ] All 5 blockers resolved
- [ ] Full validation loop completes: goal → activity → validator-dispatch → trace storage
- [ ] Nested execution traces store successfully on canary
- [ ] At least 2 complete validation cycles show consistent behavior
- [ ] `bun run typecheck` in repos/minibob passes
- [ ] All embedded templates load without schema validation errors

---

## Appendix: Investigated Files

### Analyzed Code Locations
1. `/repos/minibob/src/activity.ts:2507-2514` — impulse context display (Blocker 1)
2. `/repos/minibob/src/types.ts:~900` — ActivityTemplate schema (Blocker 2)
3. `/repos/minibob/src/embedded-templates/validator-dispatch.json:37-40` — conditional syntax (Blocker 4)
4. `/repos/minibob/src/types.ts:~250` — ImpulsePointer union (Blocker 5)
5. `/repos/minibob/src/context-memory-agent.ts:1-150` — MemoryAgent impulse loading (Blocker 5)

### Verified Canary Status
- Health: healthy (v1.13.6, 2026-04-28 14:33:28 UTC)
- Redis: 1ms latency
- SurrealDB: 4ms latency
- Discovery: registered and healthy

### Identified Templates with Blockers
- 4 templates with invalid categories (Blocker 2)
- 1 template with conditional syntax error (Blocker 4)
- validator-dispatch and slot-binding with lifecycle impulse references (Blocker 5)

---

**Investigation completed:** 2026-04-28 07:45 UTC  
**Report generated by:** Claude Code (Haiku 4.5)
