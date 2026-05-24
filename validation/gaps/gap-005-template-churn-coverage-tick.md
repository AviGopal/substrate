---
gap_id: gap-005
category: missing_pattern
severity: substantive
observed_first: 2026-05-24T04:01:45Z
last_observed: 2026-05-24T04:06:20Z
recurring_count: 3
bridge_path: ribosome (extract pattern "failed templates may be removed"); operator clarification needed on whether this is substrate-driven or dev-driven removal
---

# Gap 005 — Template removed mid-observation; substrate cannot self-describe template-set churn

## Observation

In iteration 3 (~03:55Z), the substrate had **18 templates** registered, including `activity:⟨development-vessel:substrate-health-tick⟩`.

In iteration 4 (~04:06Z), the substrate has **17 templates**. `substrate-health-tick` is **absent** from the registry.

Between those observations:
- 2 executions of substrate-health-tick at 04:01:45Z, both with:
  - `status: failure`
  - `duration_ms: 0`
  - `failure_mode: null`
  - `metadata: null`
  
These are degenerate failures — zero duration, no metadata, no taxonomy. They look like the activity-api recorded "this didn't run" traces synthetically, not actual execution attempts that ran code.

After these failures, the template is gone from `/v2/activities/templates?limit=50`.

## Attempted description (substrate-side only)

Three possible explanations the substrate cannot distinguish from its own knowledge:
1. **Substrate auto-removed the failing template** (substrate-self-replacement-pipeline activity firing in response to repeat failures)
2. **Dev manually deprecated** via `activityTemplate_deprecate` admin call
3. **Template was never properly registered** in the first place; the 2 failures represent "template not resolvable" events that propagated to the registry as removal

Substrate has the traces and the registry snapshots, but cannot construct the causal chain "X failed → therefore X was removed" without:
- Either a `templateDeprecation` event impulse the substrate could query
- Or ribosome extracting the pattern from many template-removal observations
- Or operator-side clarification of intent

## Knowledge used

### Substrate-side:
- Template registry snapshot at iteration 3 (18 templates including substrate-health-tick)
- Template registry snapshot at iteration 4 (17 templates without)
- 2 substrate-health-tick failure traces with metadata: null
- Time window: 04:01:45Z to 04:06:20Z

### Operator-side gaps:
- **`missing_pattern` (minor)**: substrate cannot link template-set churn to causal events. There's no `templateDeprecation` or `templateRetirement` impulse class in the observation (would need to query `/v2/impulses/resolve` with a templateUpkeepAuditLog shape; my narrator doesn't poll that)
- **`missing_concept` (minor)**: substrate-self-replacement-pipeline spec defines retirement behavior but no concept extracted; substrate would need to learn "failed templates may be removed" as a pattern

## Verdict

`description_completed_within_substrate_knowledge: partial`
`gap_severity: minor`

I can SHOW the state change (template count 18→17, name absent); I cannot EXPLAIN it.

## Side observation worth recording

The 2 substrate-health-tick failures had `duration_ms: 0` and `metadata: null` — these don't look like normal failures. Normal failures (e.g., the goal_resolve failures in gap-003) have substantial duration (45s-114s) and populated metadata.

A duration-0 failure with no metadata suggests:
- The activity-api recorded a "template not found at dispatch time" event as a synthetic trace
- OR the activity dispatcher synthesized a failure trace because the template's input shapes couldn't be bound
- OR some other code path that emits failure traces without execution

The substrate has no concept layer to disambiguate these. The trace existence proves "something tried to run substrate-health-tick" but not "what happened."

## Coordination

- **dev**: Was substrate-health-tick template removed by you, by the substrate, or by failure cascade? If substrate-driven, that's the substrate-self-replacement-pipeline activating — please confirm. If dev-driven, please log the intent in a `templateDeprecation` impulse the substrate can later observe.

- **audit**: Please verify at runtime:
  1. Whether the substrate's `templateUpkeepAuditLog` (per CLAUDE.md mentions) contains an entry for substrate-health-tick removal
  2. Whether substrate-self-replacement-pipeline ran as an activity between 04:01:45Z and 04:06:00Z
  3. What the duration_ms=0 metadata=null failure traces actually represent in the activity-api dispatch path

- **my role**: continue narrating. If more templates churn, the pattern becomes more describable; substrate may eventually accumulate enough trace data for ribosome to extract "template-churn" as a pattern (once ribosome has access to substrate-self-replacement-pipeline traces).

## Update — Iteration 5 (2026-05-24T04:42Z)

Template count trajectory across snapshots:
- Iteration 3 (~03:51Z): **18** templates (incl. substrate-health-tick)
- Iteration 4 (04:06Z): **17** templates (substrate-health-tick removed)
- Iteration 4.5 (04:36:43Z): substrate-health-tick INVOKED 2× (back in registry briefly?)
- Iteration 5 snapshot (04:36:20Z): **16** templates
- Iteration 5 live (04:42Z): **18** templates (substrate-health-tick re-added)

The substrate is **thrashing** its registry — adding and removing templates between observations, not just monotonically pruning. The 5-minute snapshot interval is too coarse to capture all transitions; the substrate's template-set state is unstable on much shorter timescales.

This rules out interpretation (a) "substrate auto-removed via substrate-self-replacement-pipeline" because that would be monotonic removal. The behavior is more consistent with:
- **Re-registration loop**: development-vessel may be re-seeding templates on each restart of some sub-process
- **Variant-creation cycle**: ribosome-extract creating variants that hit unique-id conflict and get removed, then re-extracted on next cycle
- **Auth-window churn**: templates being created under one auth context and removed under another

The 2 timestamp-suffixed variants `activity:⟨variant-1779534644901⟩` and `activity:⟨variant-1779534714750⟩` confirm ribosome IS creating variants. But the named development-vessel templates (substrate-health-tick) shouldn't be churning — they're operator-authored seed templates.

**Updated severity**: minor → **substantive**. Registry instability means the substrate's self-knowledge of "what templates exist" is unreliable across short windows. This affects Thompson posterior accumulation (rows keyed on template_id that disappears and reappears).

## CORRECTION (2026-05-24T16:30Z) — auditor F-031 caught misattribution

**My iteration 4 claim was wrong on a specific detail.** I attributed the template removal to `substrate-health-tick`. The auditor's runtime check (validation/investigations/2026-05-24T04-58-14-investigation-004.md, finding F-031) confirmed:

- Template count drop (18→17) was real
- `substrate-health-tick` was still in the registry at that time
- The actually-removed template was **`coverage-tick`**

**Why this matters structurally** (auditor F-031):

The boredom timer's goal text begins `"run coverage-tick to measure topology coverage..."` Every 10 minutes the substrate is asked to invoke a template that no longer exists in its registry. The "Goal not achieved" failures (gap-003) are now structurally guaranteed at two layers:

1. **Name-binding broken** (gap-004 / F-028): goal text mentioning template name doesn't resolve to template invocation
2. **Shape-based recommendation broken**: no template produces `coverageReport` because coverage-tick is removed

**Cache bug root cause** (dev commits b129695 + 93cd621, landed 09:38Z 2026-05-24):

The "thrashing" pattern I observed across iterations 3-5 was caused by an activity-api cache bug where templates were removed from the list-response set on every execution trace storage. **It wasn't real substrate-self-management churn** — it was an observability artifact of the cache bug. With the fix deployed at 09:38Z, the registry should stabilize.

**Updated severity**: substantive → minor (was misattributed; root cause now fixed; the real structural issue is captured by gap-004 / auditor F-031 about goal-text-template binding when coverage-tick is gone)

**Lesson for validation role**: I should diff template lists between snapshots rather than asserting which template was removed from memory. The auditor's independent diff is the correct method.
