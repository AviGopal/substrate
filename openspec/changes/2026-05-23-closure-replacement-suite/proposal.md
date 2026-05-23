# Proposal: Closure Replacement Suite

## Why

`2026-05-23-substrate-closure-properties` enumerates seven closure gaps
between IAL §27.1/§27.2 properties and external stateful resolvers
(operator memory, slash skills, subagents, GitHub Actions CI, operator
shell, operator spec-authoring), and names a substrate-resident
replacement for each. Those replacements are named-only: their shape
schemas, activity contracts, validator predicates, and audit algorithm
have not been specified. §27.3.j.7 of the lift checklist binds on
"closure-audit reports green for three consecutive nightly runs", but
the audit cannot honestly run today: it would either rubber-stamp green
on a substrate that has names without implementations, or fail
uniformly on every property and produce no diagnostic signal.

This change operationalises the named replacements. It specifies, at
contract fidelity, the new shapes, activity contracts (input/output
shape contracts + one-sentence task summary), validator names, and the
closure-audit script's algorithm. It defers detailed task-graph
implementations (the JSON prompt templates, resolver chains, and
validation rules that go into `repos/development-vessel/src/seed/`) to
incremental follow-up work, on the same scope pattern as
`2026-05-23-topology-discovery-loop`.

The audit script is the load-bearing artefact: with replacements
specified to contract fidelity, the audit can attempt each
`(property, external_tool)` pair against substrate-only resolvers and
return an honest verdict rather than a vacuous one.

## Scope

Eight subsections, mirroring the seven closure gaps plus the audit
that verifies them.

### A. Memory closure

- New shape `memoryNote` (body schema per design §A).
- New activity contract `extract-memory-note` (lifecycle observer on
  `lifecycle:execution:succeeded`, owned by development-vessel).
- New write shape `memoryNote_write` (admin-gated).

### B. Skill mirror activity contracts

- Eight activity contracts: `propose-spec`, `apply-spec`,
  `archive-spec`, `cleanup-docs`, `review-pr`, `audit-security`,
  `deploy-substrate`, `cron-dispatch`. Input/output shape contracts and
  one-sentence task summaries; JSON task graphs deferred to per-activity
  seed-template implementation.

### C. Subagent equivalent activity contracts

- Three activity contracts: `subagent-plan`, `subagent-explore`,
  `subagent-general`. Each is a *composition* over existing vessels
  (llm-resolver-vessel + concept-db + activity-api / local-tools-vessel
  / goal-host-vessel) — not a new resolver type.

### D. CI closure activity contract

- One activity contract `verify-merge-candidate` consuming
  `mergeCandidate` and emitting `mergeVerdict`. Composes
  failure-mode-harness, Phase 19 reuse-validation harness, and (when
  shipped) lift-criterion-hardening anchors. This is the contract that
  `2026-05-23-substrate-self-deployment` consumes as its merge gate.

### E. Self-healing activity contracts

- Five activity contracts, all new in this spec because
  `2026-05-23-substrate-explicit-vessels` references but does not
  define them: `restart-vessel`, `restore-from-backup`,
  `rerun-migration`, `inspect-vessel-logs`, `dispatch-debug-probe`.
  Each emits a `recoveryReport` impulse. Two are referenced by
  substrate-self-deployment (`restart-vessel`) and substrate-forge-vessel
  (`restart-vessel` + `restore-from-backup`) as if extant; this spec is
  where they actually come into being.

### F. Spec-authoring closure

- The `propose-spec` activity is the same activity contract defined in
  §B (mirroring `/openspec-propose`). This section documents the
  *spec-authoring closure* role: paired with the new
  `foundation-compliance` validator (named here; check list deferred to
  follow-up), `propose-spec` outputs the `proposedSpec` impulse that
  flows into substrate-self-deployment's git-authorship resolvers.

### G. Closure-audit

- New script `validation/scripts/closure-audit.ts` implementing the
  parametric `(property, external_tool)` algorithm in design §G.
- New activity contract `closure-audit-tick` (substrate cron, dispatched
  by boredom-vessel timer) that runs the script and emits
  `closureStatusReport`.
- New shape `closureStatusReport`.

### H. Recursive closure (audit-of-audit)

- The closure-audit script is itself substrate-resident. To prevent the
  substrate from rubber-stamping closure by tampering with its own
  audit, `closure-audit-tick` supports a synthetic
  `--without=closure-audit-itself` mode. In that mode the audit
  evaluates closure via *alternative signals* — chain-stall reports
  (topology-discovery-loop), lift-criterion-hardening anchors,
  adversarial probe results (when shipped). If alternative signals
  would also report green, the substrate is closed *even without the
  audit*. The audit is reinforcing, not load-bearing alone.

## Self-application

These activities are themselves substrate-resident. They MUST follow
closure: none may depend on operator infrastructure to function.

- `extract-memory-note` runs as a lifecycle observer inside the
  substrate; the resolved `memoryNote` set survives wiping the operator
  memory directory (substrate-closure-properties success criterion 4).
- Skill mirror activities run via standard activity dispatch; removing
  slash-command skills does not change the substrate's ability to
  perform the workflows.
- Subagent equivalents compose existing vessels; removing operator-side
  subagent dispatch does not change substrate research/planning
  capacity.
- `verify-merge-candidate` runs against a substrate-forge-vessel clone;
  removing GitHub Actions does not block the merge authority.
- Self-healing activities run via `development-vessel`'s resolver
  surface; removing operator shell access does not block recovery from
  foreseeable failure modes.
- `propose-spec` + `foundation-compliance` validator allow the
  substrate to author its own specs.
- `closure-audit-tick` is itself a substrate cron; operator may invoke
  manually for debugging, but the nightly run is autonomous.

The audit testing closure must itself pass closure: §H's recursive
mode ensures the substrate cannot satisfy `all_green: true` solely by
modifying its own auditor.

## What this spec does NOT do

- **JSON task graphs.** Each activity contract specifies inputs,
  outputs, and a one-sentence task summary. The concrete task array
  (prompt templates, resolver dispatch, validation rules, retry
  policies) is implementation that lives in
  `repos/development-vessel/src/seed/` and is delivered incrementally
  per activity as it matures.
- **Foundation-compliance check list.** This spec names the validator
  and gives 3-5 indicative checks. The full enumeration of foundation
  invariants the validator must enforce is deferred to a follow-up
  spec; pinning it now would freeze a list that should evolve with the
  foundation doc.
- **Retry / budget / timeout policies.** Operator-tunable; documented
  per-activity at a coarse level but not pinned in the spec.
- **closure-audit.ts TypeScript implementation.** The algorithm is
  specified in pseudocode (design §G). Implementation is a tasks.md
  item, not a spec requirement.
- **Operator-pinned config closure** (see substrate-closure-properties
  §Out of scope — deferred for the multi-substrate routing reason).

## Phase 27 lift integration

This change adds no new IAL clauses. §27.3.j.7 already binds on
closure-audit producing green for three consecutive nightly runs;
that clause is owned by `2026-05-23-substrate-closure-properties`.
This change makes the binding *achievable* by defining the audit and
its inputs.

## Capabilities

### New Capabilities

- `closure-replacement-suite` (this change) — defines memory closure
  shape + extraction activity, eight skill mirror activity contracts,
  three subagent equivalent activity contracts, verify-merge-candidate
  contract, five self-healing activity contracts, propose-spec
  spec-authoring role + foundation-compliance validator, closure-audit
  algorithm + closure-audit-tick activity + closureStatusReport shape,
  recursive audit-of-audit mode. Spec:
  `specs/closure-replacement-suite/spec.md`.

### Modified capabilities (by reference only — no spec edits here)

- `development-vessel` capability set is the home for memory closure,
  skill mirrors, subagent equivalents, self-healing, spec-authoring,
  and the closure-audit cron. Implementation will land in
  `repos/development-vessel/src/seed/`.
- `bootstrap-seeder.service` (from substrate-explicit-vessels) seeds
  the new activity contracts at substrate boot.
- `substrate-closure-properties` §27.3.j.7 acceptance becomes
  evaluable; this spec does not modify its tasks.md.
- `substrate-self-deployment` consumes `verify-merge-candidate` (its
  merge gate) and `propose-spec` (its proposal source); this spec does
  not modify self-deployment's tasks.md.
- `substrate-forge-vessel` consumes `restart-vessel` and
  `restore-from-backup`; this spec does not modify forge-vessel's
  tasks.md.

## Dependencies

- `2026-05-23-substrate-closure-properties` — names the seven gaps and
  the replacement set. This change defines the contracts.
- `2026-05-23-substrate-explicit-vessels` — provides the
  vessel-daemon toolkit and `bootstrap-seeder.service` that hosts the
  new activity contracts; provides `development-vessel` as the owning
  vessel.
- `2026-05-23-substrate-self-deployment` — consumes
  `verify-merge-candidate` and `propose-spec`. Ordering: this spec
  must land before substrate-self-deployment can enter implementation.
- `2026-05-23-substrate-forge-vessel` — consumes `restart-vessel`
  and `restore-from-backup` for fork promotion / rollback.
- `2026-05-23-topology-discovery-loop` — supplies chain-stall
  reports used by §H alternative-signals mode.
- `2026-05-23-lift-criterion-hardening` — supplies the anchor checks
  used by `verify-merge-candidate` and §H alternative-signals mode.
- `2026-05-23-signal-confidence-weighting` — `memoryNote` and
  `closureStatusReport` carry confidence weights per that field's
  schema.

## Out of scope

- Detailed JSON task graphs for any of the named activities.
- `foundation-compliance` validator's full check list.
- closure-audit.ts TypeScript implementation (algorithm only).
- Operator-pinned config closure (deferred upstream).
- GitHub Actions deletion (the property is *substrate could gate
  without it*, not removal).
- H6 / federation closure.
- Per-activity retry/budget/timeout policies.

## Spec-network notes

- **Self-healing overlap with substrate-explicit-vessels**:
  `restart-vessel` and `restore-from-backup` are referenced in
  substrate-explicit-vessels' tasks and in substrate-forge-vessel's
  promotion/rollback machinery as if extant. They are *not* defined
  there. This spec is where they come into being; the referencing
  specs consume them.
- **`propose-spec` unification**: appears as §B (skill mirror for
  `/openspec-propose`) and §F (spec-authoring closure). Single
  activity contract; §F documents its role in the spec-authoring
  loop; §B is the contract source-of-truth.
- **`verify-merge-candidate` unification**: substrate-self-deployment
  consumes it as the merge gate; this spec defines it.
