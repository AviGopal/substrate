# Proposal: Substrate Closure Properties

## Why

IAL Phase 27 (lift) requires the substrate to sustain its own
topology-discovery loop without external developer input. Phases 27.1–27.3
to date have specified *what* the substrate must do autonomously
(convergence-tick emissions, non-human triggers, autonomous goal sources)
and *what it may not do* without operator approval (admin scope, trace
deletion, lift-status writes). What no existing phase specifies is the
inverse-direction property: **what the substrate may not depend on**.

The foundation doc's implicit-vessel correction
(`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` §265-276) named one
case of this gap: ActivityExecutor and Thompson Sampling were structurally
inside the substrate but invisible to the impulse system. Sibling change
`2026-05-23-substrate-explicit-vessels` closes that. The complementary
gap — services and state structurally *outside* the substrate that today
load-bear on lift properties — remains open. Examples currently
load-bearing on the IAL's success criteria:

- **Operator memory** (`~/.claude/projects/.../memory/`): 60+ findings
  recall across sessions; today this is what gives operator-Claude its
  cross-session context. Substrate has no equivalent surface.
- **Slash-command skills** (`/openspec-propose`, `/jiggle-and-prune`,
  `/review`, `/security-review`, `/deploy`, `/loop`, `/schedule`): each
  is a stateful workflow bound to the Claude Code harness. Removing the
  harness removes the workflow.
- **Subagent dispatch** (Plan, Explore, general-purpose): research,
  planning, and multi-step work today route through operator-side
  subagent invocation, not through substrate activity dispatch.
- **GitHub Actions CI**: merge gates, canary deploy triggers, lint and
  test runs all live in GitHub infrastructure. The substrate has no
  authority over the merge gate.
- **Operator shell access**: `kubectl`, `helmfile`, `docker exec`
  interventions are the recovery path for vessel crashes, schema-migration
  failures, and posterior drift.
- **Operator spec authoring**: every `openspec/changes/*` proposal,
  every CLAUDE.md edit, every foundation-doc revision is written by an
  operator. The substrate has not authored a single accepted spec
  proposal.
- **Operator-pinned config** (`~/.metabob/config.json`): endpoint, API
  keys, provider selection all live in operator filesystem. Substrate
  reads it; substrate does not author it.

If lift means "the substrate sustains its own topology-discovery loop
without external developer input", then each of these dependencies is a
gap in the lift surface. The substrate cannot be said to sustain a loop
that requires the operator to remember context, dispatch subagents,
approve PRs, run kubectl, write specs, or pin endpoints.

This change introduces the **closure principle** and the enumeration of
closure gaps that must be sealed before lift.

## The closure principle

For every property required by IAL §27.1 and §27.2, the property's truth
MUST derive from substrate-resident vessels, activities, shapes, and
traces alone. External tools may *observe* the substrate (operator
dashboards, debugging UIs, monitoring, the operator's own learning).
External tools MAY NOT be required for any property to hold.

This is stricter than §27.3.c (boundaries — what the substrate may NOT
do). §27.3.c constrains *autonomy*; closure constrains *dependency*. A
substrate that needs the operator to run `make substrate-restart-X` to
recover from a vessel crash satisfies §27.3.c (operator approval
boundary) but violates closure (operator stateful resolver).

The principle is enforced by enumeration: for each external dependency
load-bearing on a §27.1/§27.2 property, a substrate-resident replacement
is named, designed, and acceptance-tested. The closure-audit script
walks each property and asks: "what would happen to this property if
external tool X were removed?" If the answer is "the property would no
longer hold", closure for that property is open.

## What Changes

Seven closure gaps, each with a concrete substrate-resident replacement,
each gated by §27.3.i in the pre-lift checklist:

### 1. Memory closure → `memoryNote` shape

- New shape `memoryNote { id, type: "finding" | "feedback" | "reference", title, body, provenance_trace_ids[], confidence_weight, last_validated_at }`.
- Resolved by `development-vessel` (the meta-vessel for substrate self-development). Notes derive from ribosome extraction over successful resolution traces (`finding` type) and from declared operator-state-imports during transition (`feedback` and `reference` types).
- Confidence weight (per `signal_confidence_weight` field): `finding` notes weighted 0.6 (trace-projection-derived); `feedback` notes weighted 0.4 (operator-stated, possibly stale); `reference` notes weighted 0.7 (external resource pointers, deterministic).
- Operator memory directory becomes a *cache* of substrate state, populated periodically from `memoryNote` impulses. Removing the cache does not change substrate behaviour.

### 2. Skill closure → activity templates

Each slash-command skill currently provided by the Claude Code harness is mirrored as a substrate activity template seeded into activity-api via `bootstrap-seeder.service`:

| Skill | Substrate activity | Owning vessel |
|---|---|---|
| `/openspec-propose` | `propose-spec` | development-vessel |
| `/openspec-apply` | `apply-spec` | development-vessel |
| `/openspec-archive` | `archive-spec` | development-vessel |
| `/jiggle-and-prune` | `cleanup-docs` | development-vessel |
| `/review` | `review-pr` | development-vessel |
| `/security-review` | `audit-security` | development-vessel + (H6) verifier-vessel |
| `/deploy` | `deploy-substrate` | development-vessel + deploy-resolver |
| `/loop`, `/schedule` | `cron-dispatch` activity + boredom-vessel timer integration | boredom-vessel |

Each activity carries `input_shapes`, `output_shapes`, and `tasks` per the standard contract. Operator invocations remain available as a UX surface but route through the activity dispatch path. Removing the slash command does not change the substrate's ability to perform the workflow.

### 3. Subagent closure → activity templates composing existing vessels

Plan / Explore / general-purpose subagent invocation patterns become activity templates:

- `subagent-plan` → composes `llm-resolver-vessel` (for planning) + `concept-db` (for prior pattern recall) + `activity-api` (for Thompson-ranked candidate retrieval). Output shape: `executionPlan`.
- `subagent-explore` → composes `local-tools-vessel` (file/grep/find) + `concept-db` (semantic indexing) + `llm-resolver-vessel` (summarisation). Output shape: `codebaseExplorationReport`.
- `subagent-general` → composes `goal-host-vessel` with a multi-step `ExecuteOptions`. Output shape: `goalCompletionReport`.

Removing the harness-level subagent dispatch does not change the substrate's ability to perform research, planning, or multi-step work. The substrate Thompson-ranks `(activity, problem-class)` per the existing posterior machinery.

### 4. CI closure → substrate harness as merge authority

- The substrate's own `failure-mode-harness` + canary deploy + Phase 19 reuse-validation harness become the canonical merge gate. GitHub Actions continues to run but is an *observer*: its results are surfaced for operator visibility, but the merge authority is the substrate's verdict on the canary.
- A new activity `verify-merge-candidate` runs the harness suite against a PR's diff-applied substrate image. The verdict (`pass | fail`) is the gate.
- Removing GitHub Actions does not change the substrate's ability to gate changes. (GitHub Actions removal is not proposed; the property is that *substrate could gate without it*.)

### 5. Self-healing closure → recovery activities

- Substrate vessel crashes are recovered via activities dispatched by `development-vessel`, not by operator kubectl/helmfile/docker exec.
- New activities: `restart-vessel`, `restore-from-backup`, `rerun-migration`, `inspect-vessel-logs`, `dispatch-debug-probe`. Each takes a vessel identifier and a recovery-target shape; outputs a `recoveryReport` impulse.
- The existing `make substrate-restart-X` commands become thin wrappers over `restart-vessel` activity dispatches; operator-side execution remains for emergency use but is not the canonical path.
- Removing operator shell access does not change the substrate's ability to recover from foreseeable failure modes. (Unforeseeable failures remain operator-territory by design per §27.3.c.)

### 6. Spec-authoring closure → substrate-authored proposals

- At least three accepted spec proposals in `openspec/changes/` have substrate-authored provenance: the `proposal.md` was emitted by the `propose-spec` activity, validated by the `foundation-compliance` validator (a new validator-as-activity that gates against `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` invariants), and merged through the substrate's CI-closure path.
- The `propose-spec` activity composes ribosome extraction (finding a successful resolution pattern), spec-template instantiation (mapping the pattern into `proposal.md` + `tasks.md` + `spec.md` form), and foundation-compliance validation.
- Removing operator spec-authoring does not change the substrate's ability to specify new work.

### 7. Closure-audit script

- New `validation/scripts/closure-audit.ts` walks every §27.1/§27.2 lift property and for each asks: "what would happen if external tool X were removed?" The script is parametric in *which* external tool — runs are tagged `closure-audit:operator-memory`, `closure-audit:slash-skills`, `closure-audit:subagents`, `closure-audit:github-actions`, `closure-audit:operator-shell`, `closure-audit:operator-spec-authoring`.
- For each `(property, external_tool)` pair, the script attempts to perform the property using substrate-only resolvers. Failures are logged with the missing dependency.
- Output: `validation/state/closure-status.json` with per-property closure verdicts. Lift cannot enter `candidate` status while any closure gap remains open.
- The closure-audit itself is substrate-resident (lives in `validation/scripts/`) but invoked by a substrate cron activity, not operator action. Operator may invoke it manually for debugging.

## Success criteria

1. **Every external stateful resolver enumerated in this proposal has a named, designed, and acceptance-tested substrate-resident replacement.**
2. **Closure-audit script runs nightly via a substrate cron activity, writing `closure-status.json`.** All seven closure properties report green for three consecutive nightly runs.
3. **At least three substrate-authored spec proposals are merged** with `propose-spec` activity provenance, `foundation-compliance` validation, and substrate-CI-closure gate verdict.
4. **Memory directory becomes a cache, not a source.** Wiping the operator's memory directory and restarting Claude Code preserves all substrate properties; the operator regains context by re-resolving `memoryNote` impulses.
5. **Substrate vessel crash recovery test** — kill an arbitrary substrate vessel; substrate self-heals via `restart-vessel` activity within 60s. Operator shell access not consulted during the recovery.
6. **§27.3.i closure section in IAL** is green for three consecutive nightly closure-audits before §27.S.1 lift gate flips.

## Lift integration

Amends IAL `2026-04-26-impulse-activity-loop/tasks.md` Phase 27.3 with a new section **27.3.i — Closure** sitting between §27.3.h (cross-vessel trust, deferred) and §27.S (Phase 27 acceptance gates). Seven sub-items per the seven closure gaps above. §27.S.1 acceptance updated to require §27.3.i green.

## Capabilities

### New Capabilities

- `substrate-closure-properties` (this change) — establishes the closure principle, enumerates the seven closure gaps, names the substrate-resident replacements, gates lift on closure-audit green. Spec: `specs/substrate-closure-properties/spec.md`.

### Modified Capabilities

- IAL Phase 27.3 pre-lift readiness checklist gains §27.3.i.
- IAL Phase 27.S acceptance gates updated to require §27.3.i green for three consecutive nightly audits.
- `development-vessel` capability set grows to host the seven new activity families (skill-derived, recovery-flavoured, spec-authoring, closure-audit).
- `bootstrap-seeder.service` (from substrate-explicit-vessels) seeds the new activity templates at substrate boot.

## Out of scope

- **Operator-pinned config closure**. `~/.metabob/config.json` remains operator-authored for substrate addressing; closure for this property is deferred because it intersects with the multi-substrate routing problem (a substrate cannot self-authorise which other substrate to talk to without a trust root).
- **GitHub Actions deletion**. The property is that substrate can gate without GitHub Actions, not that GitHub Actions is removed.
- **All possible recovery scenarios**. §27.3.c retains operator-only authority over unforeseeable failures (e.g., physical disk loss, cluster-wide outage). Closure applies to *foreseeable* failure modes catalogued in the existing failure-mode taxonomy.
- **H6 / federation closure**. Cross-substrate trust closure is separately tracked under §27.3.h and the H6 spec.

## Dependencies

This change depends on:
- `2026-05-23-signal-confidence-weighting` — confidence weights on `memoryNote` and other substrate-resident shapes need the field landed.
- `2026-05-23-substrate-explicit-vessels` — development-vessel must be running as a substrate unit with the toolkit exports available before the activity families can be seeded.
- `2026-05-21-development-vessel` (already shipped per memory note) — the development-vessel exists and has §9+§6+§7+§10+§11+§S.5 closed; this change adds activity families to it.

Order: substrate-explicit-vessels Phase 0 (toolkit) → signal-confidence-weighting Phase 1 (schema field) → substrate-closure-properties Phase 1 (memory closure) → remaining closure phases. Phases are individually deployable.
