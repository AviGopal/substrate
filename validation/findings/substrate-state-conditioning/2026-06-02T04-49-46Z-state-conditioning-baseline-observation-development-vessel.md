# State-conditioning baseline — observable yet unselected

**Date:** 2026-06-02T04:42Z
**Substrate-Authored-By:** substrate-live + operator (probe driver)
**Companion to:** observe-orthogonal-patterns (`a3737e37`), enact-orthogonal-decisions (`19bacfca`), compute_state_signature (`feb4c232`)

The operator's question for this iteration: *"How do we learn how the environment affects our decisions and how we observe and act?"* — paired with the request to "ensure we are properly conditioning the behavior with the state space signature."

This finding captures the baseline: state IS now observable on every dispatch (the resolver works, the tag propagates, traces are queryable by signature), but the substrate's SELECTION logic does NOT yet consume the signature. Selection currently varies across states only as an INCIDENTAL side effect of the LLM reuse check's input shifting with the catalogue's recent content.

## Two-state experiment

### STATE_A baseline

```json
{
  "signature_hash": "d1ca9157",
  "load":            { "load_avg_1m": 7.5, "mem_used_pct": 15 },
  "recent_traces":   { "total": 7, "success_rate": 0.71, "phantom_count": 5,
                       "precondition_count": 2, "avg_duration_ms": 7704 },
  "catalogue":       { "total_templates": 100, "proposed_count": 49,
                       "substrate_authored_count": 44 }
}
```

**Dispatch** ("audit dispatches under typical conditions and report success rate") selected:
`activity:⟨gap-closing:auto-1780365866964-h23xju-1780365875208⟩` (freshly authored under STATE_A; trace tag `state_signature:087a019f`)

### Induce state change (6 parallel rapid dispatches)

### STATE_B post-induction

```json
{
  "signature_hash": "159ff684",
  "load":            { "load_avg_1m": 7.1, "mem_used_pct": 16 },
  "recent_traces":   { "total": 17, "success_rate": 0.82, "phantom_count": 14,
                       "precondition_count": 3, "avg_duration_ms": 8115 },
  "catalogue":       { "total_templates": 100, "proposed_count": 38,
                       "substrate_authored_count": 30 }
}
```

**Dispatch** (SAME goal text as STATE_A) selected:
`activity:⟨gap-closing:auto-1780375267673-w53b2o-1780375274402⟩` (different template, also freshly authored; trace tag `state_signature:52134690`)

## Observations

1. **State IS observable**. The signature resolver returns a deterministic compact fingerprint (`signature_hash`, plus structured `load` + `recent_traces` + `catalogue` fields) in sub-second wall time. Every dispatch now carries the signature as a trace tag.

2. **The signature DRIFTS naturally**. STATE_A → STATE_B happened over ~3 minutes of parallel induction. The recent_traces.total went from 7 → 17, phantom_count from 5 → 14, success_rate from 0.71 → 0.82. The catalogue's proposed_count actually decreased (49 → 38) because earlier auto-drafted templates aged out of the trace window used to score them.

3. **Selection differs across states — but for the WRONG reason**. The same goal text produced two different freshly-authored templates in two states. The LLM reuse check returned NONE for both dispatches, even though by Phase 2 the STATE_A-authored template existed in the catalogue with a goal-aligned name. The selection diverged because:
   - At Phase 2 the candidate list was ordered differently (by created_at).
   - The LLM saw a different top-5 candidate set.
   - The LLM's NONE/PICK decision is not deterministic and not conditioned on STATE_B's signature.
4. **The substrate is NOT YET reading the signature as input to selection**. `computeStateSignature()` runs at dispatch time but the value goes only into trace tags + the authoring-decision impulse's classification_metadata. There is no selection-step that branches on the signature.

## What this tells the operator about next code

The pattern the substrate needs is a **contextual-bandit selection step**: when goal-host has multiple candidate templates from recommend OR reuse, the choice between them should be conditioned on `signature_hash` (or its structured fields). Concretely:

1. **Bin signatures** into a small number of buckets (e.g., k-modes or a simple decision-tree mapping `load_avg_1m` + `recent_traces.success_rate` to a few states).
2. **Maintain Thompson α/β PER (template_id, signature_bucket) pair** — not just per template.
3. **At dispatch time**, compute the current signature_bucket, sample β for each candidate conditioned on that bucket.

The data infrastructure for this already exists: every trace carries a `state_signature:<hash>` tag; activity-api can aggregate α/β by signature bin. The missing code is:

- A new resolver `signature_thompson_recommend` (or extension of activity_recommend) that joins on signature_bucket
- A boredom-cadence learning job that re-bins as more traces accumulate
- A trace-side write that updates the (template, bucket) pair's posterior

## Where this sits in the orthogonal-learning pattern

This is a CREATE_CONSUMER finding: the state_signature shape exists with no downstream consumer in the selection path. observe-orthogonal-patterns should detect this on its next dispatch — `stateSpaceSignature` is produced (by computeStateSignature, in trace tags + impulses) but no template's inputShapes contains it. The operator's question is exactly that orthogonal-decision: *create a consumer that closes the state → selection loop*.

## Commits this iteration

- `feb4c232` — compute_state_signature resolver + goal-host wiring + 4 tests
- `19bacfca` — enact-orthogonal-decisions activity (closes observe → decide → act loop)
- `16c75f42` — autoDraft decisions as substrateGap impulses (observable surface)
- `36f0fc2c` — LLM reuse rubric calibration

The substrate now: observes (orthogonal-patterns), decides (CREATE/MODIFY), acts (enact-decisions dispatches drafter), and conditions its observation on state (compute_state_signature). The remaining loop closure is: act on state — and that is now an explicit, evidenced ask.

Substrate-Authored-By: substrate-live + operator
