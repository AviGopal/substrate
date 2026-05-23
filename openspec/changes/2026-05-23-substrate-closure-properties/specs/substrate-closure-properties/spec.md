# Capability: substrate-closure-properties

## Definition

**Closure**: for every property required by IAL §27.1 and §27.2 (lift
criterion and hand-over condition), the property's truth derives from
substrate-resident vessels, activities, shapes, and traces alone.
External tools (the operator + their Claude Code session, GitHub
Actions, operator shell access, operator-authored config files) may
observe the substrate; they may NOT be required for any §27.1/§27.2
property to hold.

Closure is a structural lift gate alongside §27.3.g (explicit-vessel
coverage). The substrate cannot enter `lift_candidate` status while
any closure gap remains open. Closure is enforced by enumeration: the
closure-audit script walks each property and tests it under
`--without=<external-tool>` conditions.

## Closure properties enumerated

### P1 — Memory closure

The substrate's cross-session learned context is accessible through
substrate-resident impulses, not through the operator's filesystem
cache.

- Shape `memoryNote { id, type, title, body, provenance_trace_ids[], confidence_weight, last_validated_at }` advertised by development-vessel.
- `finding` notes (weight 0.6): derived from ribosome extraction over successful resolution traces.
- `feedback` notes (weight 0.4): operator-stated preferences, declared via one-time import.
- `reference` notes (weight 0.7): external resource pointers.
- Cache-equivalence invariant: wiping the operator memory directory and restarting Claude Code preserves substrate properties; recall is via `memoryNote` resolution.

### P2 — Skill closure

Each operator-side workflow has a substrate-resident activity template
counterpart, seeded at substrate boot via `bootstrap-seeder.service`:

`propose-spec`, `apply-spec`, `archive-spec`, `cleanup-docs`,
`review-pr`, `audit-security`, `deploy-substrate`, `cron-dispatch`.

Removing the operator slash-command does not change the substrate's
ability to perform the workflow. The slash-command (when invoked)
routes through the activity dispatch path.

### P3 — Subagent closure

Plan / Explore / general-purpose subagent invocation patterns have
substrate-resident activity-template counterparts:

`subagent-plan` → `executionPlan` shape;
`subagent-explore` → `codebaseExplorationReport` shape;
`subagent-general` → `goalCompletionReport` shape.

Each composes existing substrate vessels (goal-host, llm-resolver,
local-tools, concept-db, activity-api) without operator dispatch.
Thompson-ranking over `(template, problem-class)` posteriors selects
the right subagent template for a given problem.

### P4 — CI closure

The substrate's failure-mode-harness + Phase 19 reuse-validation
harness + canary deploy is the canonical merge authority.
`verify-merge-candidate` activity emits `mergeVerdict` impulses.
GitHub Actions runs as an observer surfacing substrate verdicts;
removing GitHub Actions does not change the substrate's ability to
gate changes.

### P5 — Self-healing closure

Foreseeable substrate failures (vessel crash, schema-migration
failure, posterior drift, log-anomaly detection) recover via
substrate-dispatched activities:

`restart-vessel`, `restore-from-backup`, `rerun-migration`,
`inspect-vessel-logs`, `dispatch-debug-probe`.

Each emits a `recoveryReport` impulse. Operator shell access remains
available for unforeseeable failures (per §27.3.c) but is not the
canonical path for foreseeable ones.

### P6 — Spec-authoring closure

The substrate has authored at least three accepted spec proposals
through `propose-spec` activity dispatches. Each proposal's
provenance is recorded in the proposal's frontmatter:
`authored_by: substrate-propose-spec`,
`extracted_from_trace_ids: [...]`. Each proposal passed both
`foundation-compliance` and `cross-spec-consistency` validators and
the Phase 4 CI-closure merge gate.

### P7 — Closure-audit

`validation/scripts/closure-audit.ts` runs nightly via the
`nightly-closure-audit` substrate cron activity. For each
`--without=<external-tool>` option (`operator-memory`,
`slash-skills`, `subagents`, `github-actions`, `operator-shell`,
`operator-spec-authoring`), the script attempts each §27.1/§27.2
property using substrate-only resolvers; failures enumerated in
`validation/state/closure-status.json`. Three consecutive nightly
runs green are required before §27.S.1 lift gate flips.

## Boundaries

Closure is distinct from autonomy (§27.3.c) and from federation
hardening (§27.3.h):

- **§27.3.c constrains autonomy**: what the substrate may NOT do
  without operator approval (admin-scope mutations, external egress,
  trace deletion).
- **§27.3.h constrains cross-trust-boundary signals**: what the
  substrate may NOT learn from without ZK attestation
  (foreign-vessel posterior updates).
- **§27.3.i (this capability) constrains dependency**: what the
  substrate may NOT *depend on* for §27.1/§27.2 properties.

A substrate may satisfy §27.3.c (no admin-scope mutations) and still
violate §27.3.i (closure) if it requires operator shell access to
recover from a vessel crash. The three sections together define the
lift surface.

## Out-of-scope closures

The closure principle does NOT extend to:

- **Operator-pinned config** (`~/.metabob/config.json`): substrate
  cannot self-authorise its own discovery endpoint without breaking
  multi-substrate trust. Closure for this property is deferred.
- **Hardware / cluster substrate**: the closure principle assumes the
  substrate's physical hosting (Kubernetes cluster, single-container
  substrate, vessel-forge clones) is provided externally. Substrate
  cannot self-provision its own host.
- **Unforeseeable failures**: catastrophic failures outside the
  failure-mode taxonomy remain operator-territory per §27.3.c.
- **First-time bootstrap**: closure applies to the running substrate,
  not to the initial bring-up. Operator authorship of bootstrap
  config, seed identity, and initial migration is permitted by design.

## Acceptance

The capability is shipped when:

1. P1–P6 each have substrate-resident replacements designed, deployed,
   and acceptance-tested per the per-property tests in tasks.md.
2. P7 (closure-audit) runs nightly, writes
   `validation/state/closure-status.json`, and reports green for
   three consecutive runs across all six `--without=*` options.
3. IAL §27.3.i is green (all seven sub-items closed).
4. IAL §27.S.1 acceptance updated to require §27.3.i; the update is
   merged.
5. CLAUDE.md "Pre-lift readiness" section documents the closure
   principle.

## Status

Pre-federation, pre-lift. Land before §27.S.1 lift gate flips.
Each phase is independently deployable and reversible (closure
mechanisms degrade gracefully — if the substrate-resident replacement
fails, the operator path remains available).
