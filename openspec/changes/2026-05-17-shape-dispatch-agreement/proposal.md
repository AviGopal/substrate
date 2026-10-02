## Why

Invariant 2 of the vessel template (`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md:51-57`) requires that `config.discovery.shapes` and the `switch(pointer.type)` in `src/routes/impulses.ts` agree. Today this is enforced by a code comment ("Entries must match case statements in src/routes/impulses.ts. Do not advertise shapes that return 410 Gone or have no case." — `repos/metabob-activity-api/src/config.ts:216-217`) and reviewer attention. Nothing checks it structurally.

Audit of the two reference vessels shows the invariant is already broken in deployed code:

- **activity-api**: `src/routes/impulses.ts` contains five cases — `analysisResult` (line 1415), `cochangeSuggestions` (1416), `impactAnalysis` (1417), `codebaseSearch` (1418), `problemCluster` (1433) — with no entry in `config.discovery.shapes`. These are orphan handlers: reachable only by callers who already know the shape exists out-of-band.
- **concept-db**: `config.ts:205` advertises `conceptUpkeepAuditLog`, but `src/routes/impulses.ts` has no `case 'conceptUpkeepAuditLog'`. The vessel advertises a shape it cannot resolve.

The cost of silent divergence is invisible. A caller that resolves an advertised-but-unhandled shape receives the dispatcher's default (commonly 400 or undefined behaviour). The vessel records a failed `task.completed`, Thompson posteriors for the calling activity accumulate β on what looks like an activity-side failure, and the root cause — a missing case — stays buried in code that compiles and passes tests.

## What Changes

- A **shape-dispatch agreement check** that runs per-vessel at build time (and again at startup as a defensive probe). For each vessel implementing the discovery contract, it verifies:
  1. Every entry in `config.discovery.shapes` has a matching `case '<shape>':` in `src/routes/impulses.ts` (no advertised-but-unhandled).
  2. Every `case '<literal>':` in `src/routes/impulses.ts` whose value matches the shape-name convention has a matching entry in `config.discovery.shapes` (no orphan handlers).
- Applied to: `metabob-activity-api`, `concept-db`, `discovery-vessel`, `identity-vessel`, and the forge-template path under `repos/ias-executor-ts`.
- A **runtime self-test** invoked from each vessel's `startup()`. On divergence, log a `failure_mode.type = "verifier_negative"` self-trace to activity-api with `validator_id = "shape-dispatch-agreement"` and refuse to call `discoveryClient.register()` for any shape that has no case. The vessel still boots; it just stops lying to the registry.
- A **CI gate** wired into each vessel's existing `bun run lint` (or `bun run typecheck` where the check is type-level). Failing the gate fails the build.
- A short addition to `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` §"Invariant 2" pointing at the implemented check so new vessels inherit it without having to rediscover the rule.

## Success criteria

1. The five orphan cases in activity-api and the one orphan shape in concept-db are surfaced by the check on first run, with file:line locations.
2. CI rejects a PR that advertises a shape with no dispatch case, and rejects a PR that adds a dispatch case without a corresponding shape entry (or marks it as intentionally private with an explicit annotation).
3. A vessel that ships with a divergence deregisters the broken shapes at startup and emits a `verifier_negative` self-trace, so operators see the failure on the canary dashboard rather than as silent activity-side β accumulation.
4. The check runs in <500 ms per vessel and adds no runtime dependency beyond what is already in the toolchain (TypeScript compiler + a small static-parse step).

## Capabilities

### New Capabilities

- `shape-dispatch-agreement-check` — a per-vessel static check (build-time) and runtime probe (startup) that enforces Invariant 2 from the vessel template. Surfaces orphan handlers and unhandled advertised shapes with file:line diagnostics.

## Impact

- Build pipelines for the five named vessels gain one step. Existing divergences become visible (see findings in `design.md`); they are recorded, not fixed in this change.
- No schema changes, no migrations, no protocol changes. Pure tooling + a startup probe.
- The runtime probe writes one `verifier_negative` trace per divergence per vessel-start, capped by a simple debounce so a misconfigured vessel does not flood activity-api.

## Dependencies

- None. The check is a pure derivative of files already in each vessel repo.
- Reads from the existing `failure_mode` taxonomy (`openspec/changes/2026-04-26-validators-and-failure-modes/`) for the runtime self-trace; that taxonomy is already deployed.
