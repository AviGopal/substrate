## Rationale

The 2026-05-17 audit recorded six concrete divergences between advertised shapes and dispatch cases in three vessels. Re-reading those files on 2026-05-18 — the same files the audit cites — shows that two of the six were already partially resolved in-tree by the time the design was written:

- activity-api's five "orphans" already carry `// @shape-dispatch:private` annotations directly above the case blocks (`src/routes/impulses.ts:1415` and `:1434`) and return `410 Gone` with an informative `resolver_moved` payload pointing at the Analysis API.
- concept-db's `conceptUpkeepAuditLog` was already removed from `config.discovery.shapes`; lines 203-206 carry an explanatory comment about why the shape is emitted as a side-effect impulse rather than dispatched.

What remains is small and concrete. The identity-vessel divergence is the only one that requires a code change in deployed source. The other two require a test fix (concept-db) and a verification pass (activity-api) to confirm the annotation form matches what the 2026-05-17 lint will recognise.

This document records the diagnostic for each shape, the resolution chosen, and the caller-migration outcome.

## Per-divergence resolution

### Bucket 1 — activity-api orphan handlers

**Files**: `repos/metabob-activity-api/src/routes/impulses.ts:1415-1448`, `repos/metabob-activity-api/src/config.ts:218-315`.

**Diagnostic.** The five shapes — `analysisResult`, `cochangeSuggestions`, `impactAnalysis`, `codebaseSearch`, `problemCluster` — are M3 ("Impulse Bridge") leftovers from before the "resolvers live where the data is" refactor. They were originally proxied through activity-api on behalf of the Analysis API. The proxy was removed; the cases survived as informative `410 Gone` stubs that tell a caller exactly where to go. The `TODO` comment block at lines 1409-1413 documents the intent.

Caller search across `repos/{minibob,workbench,ias-executor-ts}/src` for each shape:

| Shape | External callers |
|---|---|
| `analysisResult` | `repos/minibob/src/impulse-filter.ts:237` (filter shape allow-list, not a dispatch); `repos/minibob/src/resolvers/context-acquisition-resolver.ts:17,27,66,94` (local variable name, not a pointer type) |
| `cochangeSuggestions` | none |
| `impactAnalysis` | none |
| `codebaseSearch` | none |
| `problemCluster` | none |

No live caller dispatches an impulse with any of these as `pointer.type`. The 410-Gone stubs are unreachable from in-tree code. They remain useful as defence in depth for any operator who pokes the endpoint by hand.

**Resolution.** Keep the stubs. Verify the lint from `2026-05-17-shape-dispatch-agreement` recognises the existing annotation form (`// @shape-dispatch:private` on the line immediately above each case block). If the lint expects something different — for example `// @shape-dispatch:private analysisResult` with the shape name, or an annotation on every case label in a fall-through chain — reconcile by adjusting whichever has the shorter blast radius (typically the lint; the in-tree annotation has been there longer and is referenced in surrounding code).

### Bucket 2 — concept-db unhandled advertised shape

**Files**: `repos/concept-db/src/config.ts:185-213`, `repos/concept-db/src/routes/impulses.ts`, `repos/concept-db/tests/write-shapes.test.ts:585`.

**Diagnostic.** `conceptUpkeepAuditLog` is emitted as a side-effect impulse by every write resolver (see `src/routes/impulses.ts:72-91` for the emission helper). It is written into the local `impulse` table, not resolved through `POST /v2/impulses/resolve`. The pattern is "write resolver produces a typed audit-log impulse alongside the primary write"; nothing dispatches by shape against it.

The shape was previously listed in `config.discovery.shapes` and was removed in an earlier commit; the explanatory comment at `src/config.ts:203-206` is already in place. The remaining inconsistency is one test:

```
tests/write-shapes.test.ts:585
  expect(config.discovery.shapes).toContain('conceptUpkeepAuditLog');
```

This test would fail today against `bun test`. It survives because the test file is not in the regularly-exercised path, or the test was muted out-of-band; either way the assertion is now wrong by construction.

**Resolution.** Invert the assertion: `expect(config.discovery.shapes).not.toContain('conceptUpkeepAuditLog')`, with a comment pointing at the rationale ("emitted as side-effect impulse; not dispatchable via pointer-resolve"). No production change.

### Bucket 3 — identity-vessel naming reconciliation

**Files**: `repos/identity-vessel/src/services/config.ts:108-121`, `repos/identity-vessel/src/resolvers/auth.ts:184-220`.

**Diagnostic.** The advertised shapes are `authentication`, `apiKey`, `jwtToken`. The dispatcher reads `impulse.pointer.type` and accepts the literal values `session` and `apiKey`:

```
auth.ts:192-220
  if (pointerType === 'session')  { ... resolveJWT(token) ... }
  else if (pointerType === 'apiKey') { ... resolveAPIKey(apiKey) ... }
  else { return { authenticated: false, reason: `Unknown authentication type: ${pointerType}` } }
```

The 2026-05-17 design notes (§"Identity-vessel: shape ≠ pointer.type") correctly identify that the shape is a *category* and the pointer.type is the *credential form*. The shape `authentication` is the load-bearing one — every cross-vessel caller uses it:

| Caller | Site | Shape used |
|---|---|---|
| minibob | `src/auth-service.ts:122` | `authentication` |
| minibob | `src/identity-resolver.ts:21,34,42` | `authentication` (resolver registration) |
| concept-db | `src/middleware/jwtAuth.ts:88` | `authentication` |
| discovery-vessel | `src/middleware/auth.ts:80` | `authentication` |

No caller dispatches `{shape: "apiKey"}` or `{shape: "jwtToken"}` as a top-level impulse shape. The advertisements of `apiKey` and `jwtToken` are vestigial — they may have been intended to express "this vessel resolves API keys" and "this vessel issues JWTs" at the shape level, but the actual resolver contract resolves both inside the single `authentication` shape via the pointer-type discriminator.

`jwtToken` appears once in the codebase as a Hono context variable name (`repos/metabob-activity-api/src/routes/vessels.ts:657`) — unrelated to discovery.

**Resolution.** Two parts:

1. Trim `src/services/config.ts:116-120` to advertise only `authentication`.
2. Add `repos/identity-vessel/shape-dispatch.config.json`:
   ```json
   {
     "shape_to_pointer_types": {
       "authentication": ["apiKey", "session"]
     }
   }
   ```
   This is the per-vessel mapping format proposed in the 2026-05-17 design §"Identity-vessel: shape ≠ pointer.type". The lint reads it and treats a case-block match on `apiKey` or `session` inside the `authentication` shape's dispatcher as satisfying Invariant 2 for the `authentication` advertisement.

**Out-of-tree risk.** If any caller outside the in-tree repo dispatches `{shape: "apiKey"}` directly to identity-vessel, it would start failing the discovery lookup once these shapes are removed from the registry. The risk is low — the dispatcher path documents the impulse shape as `authentication` and the canonical examples in `docs/AUTH_JWT_CLAIMS.md` and `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` use that name — but ship the change behind one canary window of lenient-mode lint before promoting to strict, so any unknown caller surfaces as a `task.completed` resolution failure rather than a silent regression.

## Per-shape summary table

| Vessel | Shape / handler | Direction | Current in-tree state | Resolution |
|---|---|---|---|---|
| activity-api | `analysisResult` (line 1416) | orphan handler | Already annotated `// @shape-dispatch:private`; returns 410 Gone | Verify lint recognises annotation form |
| activity-api | `cochangeSuggestions` (1417) | orphan handler | Same fall-through block as above | Same |
| activity-api | `impactAnalysis` (1418) | orphan handler | Same fall-through block | Same |
| activity-api | `codebaseSearch` (1419) | orphan handler | Same fall-through block | Same |
| activity-api | `problemCluster` (1435) | orphan handler | Separate case block, also annotated and 410 Gone | Same |
| concept-db | `conceptUpkeepAuditLog` | unhandled advertised | Already removed from `config.discovery.shapes`; stale test at `tests/write-shapes.test.ts:585` | Invert the test assertion |
| identity-vessel | `apiKey` (config:118) | advertised, no caller uses it as shape | Vestigial advertisement | Remove from advertised shapes |
| identity-vessel | `jwtToken` (config:119) | advertised, no caller uses it as shape | Vestigial advertisement | Remove from advertised shapes |
| identity-vessel | `authentication` (config:117) | advertised; dispatcher reads `pointer.type ∈ {apiKey, session}` | Load-bearing shape, intentional dispatcher-vs-shape disagreement | Keep; add `shape-dispatch.config.json` mapping |

## Rollout order (coordinated with 2026-05-17-shape-dispatch-agreement)

1. 2026-05-17 ships the static parser and per-vessel config-file format. Lint runs as advisory only — warns on divergence, never fails CI.
2. This change lands the three cleanups:
   - identity-vessel: trim advertised shapes; add `shape-dispatch.config.json`.
   - concept-db: invert the stale test assertion.
   - activity-api: verify the lint accepts the existing annotation form; if not, reconcile.
3. Run the lint against all three vessels; confirm zero divergences.
4. 2026-05-17 promotes the lint to a CI gate (fails on divergence) and ships the runtime probe in **lenient mode** — logs divergence at startup but does not deregister shapes and does not emit `verifier_negative` traces. One canary window (24h minimum).
5. If the lenient canary window emits zero divergence logs across all three vessels, promote the runtime probe to **strict mode** — deregister offending shapes and emit one `verifier_negative` self-trace per divergence per startup.

This sequence ensures the runtime probe never sees a divergence on a deployed canary. Any third-party out-of-tree caller of the removed identity-vessel shapes surfaces as a normal `task.completed` failure during step 4, with enough signal for an operator to react before step 5 makes the deregistration authoritative.

## Decision: do not change activity-api handlers

A reasonable alternative for the activity-api bucket is to *delete* the five 410-Gone case blocks entirely, since no caller dispatches against them. Rejected because:

- The handlers cost ~30 lines and zero runtime overhead until invoked.
- An operator who hits the endpoint by hand (or an out-of-tree caller from a pre-refactor era) gets an informative `410 + suggested_approach` body, not a `400 unknown shape`.
- Deleting them would erase the historical signal that these shapes once existed; the `// @shape-dispatch:private` annotation is a more honest record.

The handlers are kept as defence in depth.

## Decision: keep `authentication` shape with explicit pointer-type mapping

A reasonable alternative for the identity-vessel bucket is to *rename* either the shape or the dispatcher to match: either advertise `apiKey` and `session` as separate shapes, or rename the pointer-type values to `authentication`. Rejected because:

- Renaming the shape to match pointer-types loses the category abstraction. Callers genuinely want "authenticate this credential" as a single contract; the credential-form distinction is a dispatcher detail.
- Renaming the pointer-types to `authentication` collides with itself (two `case 'authentication':` blocks doing different things) and breaks the JWT-vs-API-key dispatch.
- The `shape-dispatch.config.json` mechanism is already in the 2026-05-17 design specifically for this case. Using it here is the path the lint was designed to support.
