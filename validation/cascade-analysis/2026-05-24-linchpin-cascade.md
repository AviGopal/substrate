# Cascade Analysis: F-038 Linchpin and Downstream Dependencies

**Authored**: 2026-05-24 by auditor (cross-referenced with validator iter-11)
**Purpose**: short-circuit the "fix → retry → wait an hour → discover next downstream issue" loop by laying out what's blocking what BEFORE dev hits each layer.

This document is **read-only by design** — the audit role remains observational. What follows is the cross-reference structure of open findings and the diagnostic queries that don't require waiting for boredom-timer traces to accumulate.

## The chain so far

Dev's commits over 2026-05-24 morning addressed the substrate's preconditions one layer at a time:

1. **Cache fix** (`f277128a` 09:38Z) → F-031 / F-032 resolved (template count stable at 18)
2. **Embedding env** (`025b0a26` 09:48Z + `c72a68b2`) → F-014 resolved
3. **Boredom task format change** (claimed in coordination state) → partially applied (Redis queue updated; **systemd unit unchanged**, F-024 still open)

Each fix took dev a cycle to ship, then ~an hour to verify against new traces, then discovery of the next downstream blocker. After the third cycle, the substrate had progressed enough that named templates ARE now being invoked (validator gap-007, auditor F-038) — but goal_resolve still marks failure because the chain isn't propagated.

This document maps the remaining cascade so dev can address multiple layers in one cycle.

## The structural cascade

```
Boredom systemd POSTs {"goal":"..."}        (F-024)
    ↓ routes through goal-processing-activity-driven
    ↓ Goal text mentions template names
    
Goal text → template binding (per validator gap-004)
    ↓ named template gets invoked successfully [VERIFIED 2026-05-24T17:16:52Z]
    ↓ BUT...
    
composition_chain: [] on inner trace            (F-038)
    ↓ goal_resolve verifier can't walk back to inner success
    
goal_resolve marks status: failure              (F-028 + gap-007)
    ↓ failure_mode field is null                (F-029)
    
Thompson update path looks for "selections"     (F-037)
    ↓ Finds none (no chain to walk)
    ↓ Posteriors stay at α=β=1 prior
    ↓ success_rate reports 0
    
Substrate cannot learn from accumulating successes
```

The cascade has **at least four distinct fix points**:

1. **F-038**: composition_chain population (the linchpin)
2. **F-028 / gap-007**: goal_resolve verifier code to USE the chain (separate from F-038's population fix)
3. **F-029**: failure_mode taxonomy population on goal_resolve failures (orthogonal to F-038)
4. **F-024**: boredom systemd unit POST format

## Dependencies and what unlocks what

### F-038 → F-037 (likely automatic)

If the Thompson update path reads `composition_chain` (or `parent_execution_id` chain) to attribute outcomes to selections, then once F-038 is fixed, F-037 may resolve automatically.

**Diagnostic to verify BEFORE deploying F-038 fix:**
```bash
# Inspect a recent successful coverage-tick trace
KEY=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
curl -sf -H "Authorization: ApiKey $KEY" \
  'http://localhost:18080/v2/activities/execution-traces?limit=5' \
  | jq '.executions[] | select(.metadata.template_id == "coverage-tick")
        | {execution_id, composition_chain, parent_execution_id}'
```
- If output shows `composition_chain: []` AND `parent_execution_id: null`: F-038 is the population gap.
- If `parent_execution_id` is set but `composition_chain` is empty: the chain serializer drops the parent link.
- If both fields are populated correctly already: the gap is elsewhere (Thompson update path itself).

**Don't ship F-038 without running this first.** It tells dev whether the fix is in (a) the trace writer (populate the chain), (b) the trace serializer (serialize parentage that's already in storage), or (c) elsewhere entirely.

### F-038 → F-028 (NOT automatic)

Even after F-038 is fixed, goal_resolve's verifier needs explicit code that walks the populated chain to detect "named template X was invoked successfully somewhere in my child trace tree." If the verifier code looks at the goal_resolve trace alone, the chain being populated doesn't help.

**Diagnostic that doesn't require waiting:**
```bash
# Find the goal_resolve trace for the most recent boredom firing
docker exec substrate-live grep -A20 "verifier\|verify\|child_trace" \
  /vessels/activity-api/src/services/goal-resolve*.ts 2>/dev/null \
  || docker exec substrate-live grep -rn "verifier\|verifyGoal" /vessels/minibob/src/ 2>/dev/null | head -10
```
- Locate where goal_resolve marks success/failure.
- Check whether it inspects child traces by walking composition_chain.
- If not, F-028 needs a separate fix on top of F-038.

### F-037 (Thompson update) — read path independent of F-038

Even if composition_chain population is fixed, the Thompson updater needs to consume it. Two possible reasons F-037 persists:

1. **The Thompson updater doesn't currently read composition_chain at all** (queries variant_performance_metrics by `vessel_id` + `activity_id` only).
2. **The trace store and posterior store are in different SurrealDB tables that don't join** on the composition fields.

**Diagnostic query (no waiting):**
```bash
KEY=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
# Find any template with ANY non-trivial Thompson posterior
curl -sf -H "Authorization: ApiKey $KEY" \
  'http://localhost:18080/v2/activities/templates?limit=50' \
  | jq '.templates[] | {name, alpha: .metrics.thompson_alpha,
                        beta: .metrics.thompson_beta,
                        total: .metrics.total_executions}
        | select(.alpha != 1 or .beta != 1)'
```
- If **all** templates return α=β=1 (uniform prior): the Thompson update path is **not writing to ANY template**. This is a global failure, not template-specific.
- If some templates have non-trivial α/β: F-037 is specific to the templates the boredom loop is exercising — meaning the issue is in the boredom→template path, not the writer.

**Hypothesis to test**: if NO template has non-uniform posteriors, the Thompson writer is fundamentally broken, not just disconnected from composition_chain. F-038 fix won't help in that case.

### F-029 (failure_mode population) — orthogonal

Independent of F-038 cascade. The failure_mode field must populate on goal_resolve failures regardless of whether composition_chain is fixed.

**Diagnostic**:
```bash
docker exec substrate-live grep -rn "failure_mode" /vessels/minibob/src/goal*.ts \
  /vessels/activity-api/src/routes/activities.ts 2>/dev/null | head -10
```
- Locate where goal_resolve constructs its trace record.
- Verify whether failure_mode is set in the failure path.
- This is a focused code-level fix; doesn't require trace accumulation to verify.

### F-024 (boredom systemd unit) — independent

The systemd unit at `/etc/systemd/system/minibob-boredom.service` still POSTs `{"goal":"..."}`. Dev mentioned the templateId format change applies to a different mechanism (Redis queue), but the systemd-driven curl continues to drive the failure pattern.

**Two-option fix**:
1. Update the systemd unit to POST `{"templateId":"..."}` payloads, one per topology-discovery template.
2. Replace the systemd timer entirely with a substrate-resident boredom loop that drains the Redis templateId queue.

Either works. Option 1 is the smaller change; option 2 is the more idiom-aligned (per dev-vessel discipline of activity templates over systemd hooks).

## Sequencing recommendation

The dependencies suggest dev should batch the next round of fixes:

**Batch 1 — Investigation (no code changes)**:
- Run the three diagnostic queries above (composition_chain on a sample trace, Thompson posteriors across all templates, code location for failure_mode and goal_resolve verifier).
- Outputs determine whether F-038, F-037, F-028, F-029 are one fix or several.

**Batch 2 — The likely combined fix**:
Based on validator iter-11's hypothesis confirmation + auditor cascade prediction, the most probable set:
- Populate composition_chain / parent_execution_id on dispatched child traces (F-038)
- Update goal_resolve verifier to walk the chain (F-028)
- Update Thompson update path to attribute outcomes via the chain (F-037)
- Set failure_mode on goal_resolve failures (F-029)

These four likely share modules in `repos/metabob-activity-api/src/` and/or `repos/minibob/src/goal*` and can be addressed in one coordinated commit batch.

**Batch 3 — Boredom systemd**:
- Update `/etc/systemd/system/minibob-boredom.service` (or replace with substrate activity).
- This is independent of Batch 2 and can ship in parallel.

## Verification before retry

For each batch, dev can verify in seconds (not hours) by:

1. **Dispatching a single test goal manually** rather than waiting for the boredom timer:
```bash
KEY=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
curl -sf -X POST -H "Authorization: ApiKey $KEY" -H "Content-Type: application/json" \
  http://127.0.0.1:8200/goal \
  -d '{"goal":"run coverage-tick","singleGoal":true}'
```

2. **Querying the resulting trace immediately**:
```bash
curl -sf -H "Authorization: ApiKey $KEY" \
  'http://localhost:18080/v2/activities/execution-traces?limit=1' \
  | jq '.executions[0] | {execution_id, composition_chain, parent_execution_id,
                          status, failure_mode, metadata}'
```

3. **Checking Thompson posteriors moved**:
```bash
curl -sf -H "Authorization: ApiKey $KEY" \
  'http://localhost:18080/v2/activities/templates/activity%3A%E2%9F%A8development-vessel%3Acoverage-tick%E2%9F%A9' \
  | jq '.metrics | {total_executions, thompson_alpha, thompson_beta}'
```

If after a single manual dispatch the chain is populated, the verifier links correctly, and Thompson posteriors moved by Δα=1 or Δβ=1, the fix landed. **No need to wait an hour for boredom-driven evidence.**

## Predicted outcome sequence

Once F-038 cascade fix lands:

1. Immediate: a manually-dispatched goal produces a trace with populated composition_chain.
2. Within one boredom firing (~10 min): coverage-tick invocation under the chain, goal_resolve detects child success, marks success.
3. Within 2-3 firings: Thompson α moves from 1 → 4+; success_rate reports a real value.
4. Within an hour: variant_performance_metrics shows real signal; coverage_tick_cells starts advancing from [0,0,0,0].

If any of these don't happen as predicted, the diagnostic queries above pinpoint which sub-layer is still broken.

## What's NOT in this analysis

- **Cycle-9 lift criterion concerns** (F-001, F-005, F-012, F-026, F-035) — these are about the audit/lift surface, not the substrate's learning loop. They block believing future LIFT CANDIDATE stamps but don't block the substrate from making progress.
- **Provenance findings** (F-002, F-013) — about proposal-file JSON validity; orthogonal to the cascade.
- **Deployment findings** (F-006, F-019, F-036) — hardcoded defaults and WS auth divergence; separate work stream.
- **concept-db deployment** (F-021) — a missing-vessel concern; not a cascade blocker.

The linchpin cascade is specifically about why the substrate doesn't learn from successful executions. Other findings remain documented for separate sequencing.

## How this document gets updated

If dev runs the diagnostic queries and the outputs differ from the cascade predictions, the auditor's next investigation iteration will update this document with the actual cascade shape. The cascade-analysis dir is a living cross-reference, not a one-shot artifact.

## Authorship

This is auditor work — observational analysis with diagnostic queries. The role boundary remains: no fix application by the auditor. The diagnostic queries above are read-only and can be run safely by dev or operator.
