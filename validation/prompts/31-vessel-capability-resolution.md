# Prompt 31: vesselCapability short-circuit verification (F-V35 fix)

This prompt verifies the F-V35 fix: the `vesselCapability` pointer type now resolves via a
direct `VesselDiscoveryClient.discoverVesselsForShape` call (STEP 2.5) instead of routing
through the generic discovery path that caused a circular self-query failure.

**What to verify:**
- `load_impulse` with `{"type":"vesselCapability","shape":"activityExecutionTrace"}` resolves WITHOUT the "offline mode" error
- The log line shows STEP 2.5 short-circuit: `[Impulse] Resolved via vessel discovery: vesselCapability`
- The result contains a `vessels` array with at least one entry
- Multiple distinct shapes resolved via vessel discovery in a single run

---

You are verifying that the vessel discovery system resolves capability queries correctly.
Run all steps in order and write your findings to `/workspace/capability-resolution-report.md`.

## Step 1 — Resolve vesselCapability for activityExecutionTrace

Use `load_impulse` with pointer:
```json
{"type": "vesselCapability", "shape": "activityExecutionTrace"}
```

This MUST succeed. Record:
- Whether it succeeded or failed (if it fails with "offline mode" the test fails)
- The `vessels` array content — how many vessels, their IDs and `resolve_endpoint` fields
- Whether the log says `Resolved via vessel discovery: vesselCapability` or something else

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Resolve vesselCapability for concept

Use `load_impulse` with pointer:
```json
{"type": "vesselCapability", "shape": "concept"}
```

Record the same fields. If concept-db is not registered, record that — it's acceptable.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 3 — Resolve vesselCapability for file

Use `load_impulse` with pointer:
```json
{"type": "vesselCapability", "shape": "file"}
```

This should resolve to minibob itself (or report no external vessels for local shapes). Record the result.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 4 — Fetch a real trace to confirm activity-api routing still works

Use `load_impulse` with pointer `{"type": "executionTraceList", "limit": 3}`. Record the first `execution_id` and `activity_id` from the list.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 5 — Write capability-resolution-report.md

Write `/workspace/capability-resolution-report.md` with:

### vesselCapability Results
| shape | vessels_found | resolve_endpoint | result |
|-------|--------------|-----------------|--------|
| activityExecutionTrace | N | endpoint | SUCCESS/FAIL |
| concept | N | endpoint | SUCCESS/FAIL |
| file | N | endpoint | SUCCESS/FAIL |

### activityExecutionTrace Resolution
List the execution_id and activity_id from Step 4.

### F-V35 Verdict
State: `FIXED` if Step 1 succeeded without "offline mode" error, `STILL BROKEN` if it failed.

## Acceptance criteria

1. `/workspace/capability-resolution-report.md` exists with real data
2. Step 1 (`vesselCapability` for `activityExecutionTrace`) SUCCEEDS — no "offline mode" error
3. Stderr contains `[Impulse] Resolved via vessel discovery: vesselCapability` (not an error line)
4. Stderr contains `[Impulse] Resolved via vessel discovery` for at least one activity-api shape (executionTraceList)
5. F-V35 Verdict in the report is `FIXED`
