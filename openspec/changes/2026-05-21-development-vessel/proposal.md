# Proposal — development-vessel

## Summary

Ship a `development-vessel` — the meta-vessel that creates, develops,
debugs, and registers other vessels — built on `@avigopal/ias-executor-ts`
as a library dependency. The vessel runs activities (fetched from
activity-api) through its own resolvers to perform development
operations: edit code, manage activity templates, commit, register
new vessels with discovery-vessel, and judge its own work and the
work of other vessels through a unified judgment pipeline.

## Motivation

The four operational capabilities the user named on 2026-05-21 as key to
system operation:

1. **Self-develop / debug via activities** — the loop we use to evolve
   the system should itself be a vessel-orchestrated activity loop.
2. **Vessels register side effects and add independent checks** — the
   lifecycle-subscriber pattern is wired, but no canonical "watcher"
   exemplar exists.
3. **Create vessels** — currently every new vessel is a bespoke,
   conventionally-committed package. Doesn't compound.
4. **Cross-vessel activities** — composition meta-activities are
   possible but new ones are authored as JSON literals in source, not
   in activity-api.

The bottleneck across all four is the absence of a vessel whose job is
to manage vessels. Today shipping a change goes through a hand-built
`ship-change-vessel.ts` example under `repos/ias-executor-ts/src/examples/`
— which violates the documented topology where ias-executor-ts is a
library, not a runtime, and vessels are HTTP services registered with
discovery, not source files in the executor's example folder.

## Goals

1. A vessel package at `repos/development-vessel/` consuming
   `@avigopal/ias-executor-ts` as a library dep (file: protocol now;
   published artifact later). Follows `TYPESCRIPT_VESSEL_TEMPLATE.md`.
2. The vessel implements `POST /v2/impulses/resolve` exposing a small
   set of resolvers for git, fs, activity-api CRUD (variant-scoped),
   discovery passthrough, and code introspection.
3. Activities the vessel runs are **fetched from activity-api by id**.
   Only one bootstrap template lives in vessel code: enough to fetch
   the next one. Every other template lives in the database as a
   variant under the caller's auth scope.
4. The judgment idiom is unified: every oracle layer (validator,
   witness, audit, human, runtime-watcher) emits a
   `validation_result`-shape impulse. One `propagate_judgment` activity
   consumes any judgment and updates the appropriate Thompson posterior.
5. The vessel can be used to develop itself. Concrete demonstration:
   the vessel adds a new resolver to itself by running an activity that
   composes `fs_read` + `code_edit` + `ship-change`.

## Non-goals

- Replacing `minibob` or the existing in-cluster upkeep pod (Phase 4b
  per `2026-05-19-ias-executor-as-canonical-host/tasks.md §7.2`).
- Solving the admin-auth blocker for legacy bootstrap activities. We
  work **only** within read+write scope; admin remains operator-blocked.
- Hot-loading resolver code mid-execution. The vessel ships with its
  resolver set; new resolvers require a new vessel build (still managed
  *via* an activity, but the deploy boundary is unchanged).

## Success criteria

The four pivot criteria from `feedback_autonomous_loop_alternates_dev_verify.md`
applied to the development-vessel itself:

1. **CREATE**: `runDevelopmentVessel(goal)` orchestrates the goal through
   activities fetched from activity-api; returns a typed report.
2. **DETECT-WORKS**: the report's `ok=true` only when every judgment
   layer that fired (validator, audit, etc.) returned `passed=true`.
3. **DETECT-BROKEN**: per-task failure surfaces in the report's `notes`
   with a structured `audit_subtype` matching the documented enum.
4. **DIAGNOSE-WHY**: each failure note carries either the resolver's
   stderr/exception OR the validator's `failed_evidence` block. No
   silent failures.

Demonstrable lift: a single failing trace produces posterior pressure
through **multiple independent judgment layers** without any per-layer
wiring beyond resolver registration. Adding a sixth oracle = one new
resolver + one variant of `propagate_judgment` that knows the new
source-tier weight.

## Out-of-scope (named for future work)

- Browser-side dev-vessel surface (workbench panels using the browser
  bundle of ias-executor-ts can come later; the vessel's HTTP + CLI
  surfaces are sufficient for the autonomous-loop use case).
- Repair via LLM-assisted code rewriting at scale (Case 2a in
  `repos/development-vessel/docs/CASES_AND_FLOWS.md`). The skeleton
  ships the resolver surface; the repair *activity templates* land
  in a follow-up cycle.
- Cross-org activity-template sharing. Variants are scoped to caller
  org/account per current RBAC.
