## Why

The paired change `2026-05-17-shape-dispatch-agreement` introduces a static + runtime check for Invariant 2 of the vessel template ("every advertised shape has a dispatch case, every dispatch case is advertised or annotated"). Its design.md records six concrete divergences in deployed code. Before the lint goes live in strict mode, those divergences must be resolved — otherwise the runtime probe will deregister shapes on first deploy and emit `verifier_negative` self-traces from every affected vessel.

Re-auditing the three vessels on 2026-05-18 against the source files cited in the 2026-05-17 design shows two of the six divergences are **already partially fixed in-tree** (the audit snapshot was stale by the time the design was written), and the remaining work is smaller than the design implies. This change does the cleanup, with verification.

Per-divergence state on 2026-05-18:

- activity-api five orphan cases (`analysisResult`, `cochangeSuggestions`, `impactAnalysis`, `codebaseSearch`, `problemCluster` at `src/routes/impulses.ts:1416-1419, 1435`) — handlers return `410 Gone` with a `resolver_moved` body pointing at the Analysis API. The file already carries `// @shape-dispatch:private` annotations above both case blocks (lines 1415, 1434). These are deliberate deprecation stubs, not orphans. Cleanup: verify the lint recognises the annotation form used in-tree, and that the 410-Gone bodies still match the suppression contract.
- concept-db `conceptUpkeepAuditLog` (was advertised at `src/config.ts:205`) — already removed from `config.discovery.shapes`; lines 203-206 carry an explanatory comment. The shape is an emitted side-effect impulse (written into `concept-db`'s `impulse` table by every write resolver), never a pointer-dispatch target. Cleanup: one stale test assertion at `tests/write-shapes.test.ts:585` still expects the shape in the advertised list.
- identity-vessel advertises `authentication`, `apiKey`, `jwtToken` at `src/services/config.ts:116-120`; the dispatcher at `src/resolvers/auth.ts:192-220` reads `impulse.pointer.type ∈ {apiKey, session}`. `authentication` is the load-bearing shape used by every caller (minibob `src/auth-service.ts:122`, `src/identity-resolver.ts:21`; concept-db `src/middleware/jwtAuth.ts:88`; discovery-vessel `src/middleware/auth.ts:80`). `apiKey` and `jwtToken` as advertised shapes have **zero external callers**. Cleanup: remove `apiKey` and `jwtToken` from advertised shapes; ship the `shape-dispatch.config.json` mapping `authentication → [apiKey, session]` proposed in the 2026-05-17 design §"Identity-vessel: shape ≠ pointer.type".

## What Changes

- **activity-api**: Confirm the `// @shape-dispatch:private` annotation above lines 1415 and 1434 is the exact syntax the 2026-05-17 lint expects. If the lint expects a different form, update either the annotation or the lint. No handler changes.
- **concept-db**: Update `tests/write-shapes.test.ts:585` to assert that `conceptUpkeepAuditLog` is **not** advertised (the inverse of the current assertion), matching the current `config.ts`. No source changes — the divergence is already cleaned in `config.ts`.
- **identity-vessel**: Remove `apiKey` and `jwtToken` from `src/services/config.ts:116-120`. Add `shape-dispatch.config.json` declaring `{ "authentication": ["apiKey", "session"] }` at the vessel root. No handler changes; callers continue to dispatch impulses with `shape: "authentication"`, pointer.type `apiKey` or `session`.
- **lint coordination**: Before the 2026-05-17 runtime probe ships in strict mode, run the static parser against all three vessels and confirm zero divergences remain. Ship probe in lenient mode (log only, no deregistration) for one canary window, then promote to strict.

## Success criteria

1. `scripts/check-shape-dispatch.ts` (from 2026-05-17-shape-dispatch-agreement) exits 0 against `metabob-activity-api`, `concept-db`, and `identity-vessel`.
2. No orphan-handler diagnostic against the five `410 Gone` cases in activity-api.
3. No unhandled-advertised-shape diagnostic against `conceptUpkeepAuditLog` in concept-db.
4. No advertised-unhandled diagnostic against `apiKey` or `jwtToken` in identity-vessel; `authentication` correctly maps to pointer-types `apiKey` and `session` via the per-vessel config.
5. The deployed canary for each vessel emits zero `validator_id = shape-dispatch-agreement` self-traces in a 24-hour window after the runtime probe goes strict.

## Capabilities

None. This is cleanup of existing code; no new capability is created. The shape-dispatch-agreement capability itself is introduced by `2026-05-17-shape-dispatch-agreement/`.

## Impact

- **activity-api**: Zero risk. Handlers unchanged; only the lint contract is being verified against existing annotations. The `410 Gone` semantics for the deprecated Analysis-API stubs are preserved.
- **concept-db**: Test-only change. Production behaviour unchanged. The advertised shape list in deployed code already excludes `conceptUpkeepAuditLog`.
- **identity-vessel**: Two shapes (`apiKey`, `jwtToken`) deregistered from discovery. Caller search across `repos/{minibob,workbench,metabob-activity-api,concept-db,discovery-vessel}` finds zero external dispatches with those values as the **impulse shape** — every caller uses `shape: "authentication"` with `pointer.type` set to the credential form. Out-of-tree risk: any third-party vessel that dispatches `{shape: "apiKey"}` directly will break. Mitigation: ship the change behind the lenient-mode lint for one canary window so any unknown callers surface as `task.completed` failures before the probe goes strict.
- No schema migrations. No protocol changes. One test update (concept-db) and one config trim (identity-vessel).

## Dependencies

- **Paired with `2026-05-17-shape-dispatch-agreement`**: That change provides the static parser, the per-vessel config file format, and the runtime probe. This change cannot land in isolation; the lint needs to exist to verify completion.
- **Coordination order**:
  1. 2026-05-17 lands the lint as advisory (warn, not fail) and the per-vessel config format.
  2. This change cleans the three vessels and adds identity-vessel's per-vessel config.
  3. Re-run the lint; confirm zero divergences across all three vessels.
  4. 2026-05-17 promotes the lint to a CI gate (fail on divergence) and ships the runtime probe in strict mode (deregister + self-trace on divergence).
