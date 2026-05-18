## Phase A — Caller search and risk assessment

- [ ] A.1 Re-confirm caller search for each activity-api orphan shape across `repos/{minibob,workbench,ias-executor-ts,metabob-cloud-dashboard,concept-db,discovery-vessel}/src` — fail loud if any caller dispatches `{pointer: {type: "<shape>"}}` for `analysisResult`, `cochangeSuggestions`, `impactAnalysis`, `codebaseSearch`, `problemCluster`. (2026-05-18 audit: zero live dispatchers; only filter allow-list and local variable names.)
- [ ] A.2 Re-confirm `conceptUpkeepAuditLog` is never dispatched as a pointer type — only emitted as a side-effect impulse from concept-db write resolvers (`repos/concept-db/src/routes/impulses.ts:72-91`).
- [ ] A.3 Search every in-tree vessel for callers dispatching `{shape: "apiKey"}` or `{shape: "jwtToken"}` at the impulse-shape level (not pointer.type). (2026-05-18 audit: zero.)
- [ ] A.4 Document any out-of-tree caller risk for identity-vessel shape removal — search activity-api JWT-issuance flow (`src/routes/vessels.ts:657`) and confirm `jwtToken` context variable is unrelated to discovery.
- [ ] A.5 If any caller found in A.1, A.2, or A.3, escalate before proceeding — the divergence is load-bearing and the cleanup approach changes.

## Phase B — activity-api orphan resolution

- [ ] B.1 Open `repos/metabob-activity-api/src/routes/impulses.ts:1415` and `:1434` and confirm the `// @shape-dispatch:private` annotation form exists and matches what the lint from `2026-05-17-shape-dispatch-agreement` will recognise.
- [ ] B.2 Cross-check against `packages/shape-dispatch-check/` (the shared parser proposed in the 2026-05-17 design §"Location of the check"). If the parser expects a different annotation syntax (e.g. inline `@shape-dispatch:private <name>` per case label, or annotation on every fall-through label), reconcile by adjusting the lint to recognise the in-tree form rather than rewriting five case blocks.
- [ ] B.3 Run the static parser against `repos/metabob-activity-api`. Confirm zero orphan-handler diagnostics and zero unhandled-advertised-shape diagnostics.
- [ ] B.4 No source change required if B.1-B.3 pass. Record the verification in commit message.

## Phase C — concept-db unhandled-shape resolution

- [ ] C.1 Open `repos/concept-db/src/config.ts:185-213` and confirm `conceptUpkeepAuditLog` is absent from `shapes[]` and the explanatory comment at lines 203-206 is intact.
- [ ] C.2 Invert the stale assertion at `repos/concept-db/tests/write-shapes.test.ts:585` from `toContain('conceptUpkeepAuditLog')` to `not.toContain('conceptUpkeepAuditLog')`. Add a one-line comment pointing at the side-effect-impulse rationale.
- [ ] C.3 Run `bun test repos/concept-db/tests/write-shapes.test.ts` and confirm the inverted assertion passes.
- [ ] C.4 Run the static parser against `repos/concept-db`. Confirm zero diagnostics.

## Phase D — identity-vessel naming reconciliation

- [ ] D.1 Edit `repos/identity-vessel/src/services/config.ts:116-120` to advertise only `'authentication'`; remove `'apiKey'` and `'jwtToken'`.
- [ ] D.2 Create `repos/identity-vessel/shape-dispatch.config.json` with content:
      ```json
      { "shape_to_pointer_types": { "authentication": ["apiKey", "session"] } }
      ```
      matching the format proposed in the 2026-05-17 design §"Identity-vessel: shape ≠ pointer.type".
- [ ] D.3 Add a one-line comment in `config.ts` above the trimmed `shapes` array pointing readers at `shape-dispatch.config.json` for the pointer-type mapping.
- [ ] D.4 Update `repos/identity-vessel/CLAUDE.md` (or `README.md`) to document that the vessel advertises one shape (`authentication`) with two credential forms (`apiKey`, `session`). Note the explicit decision to keep the shape-vs-pointer-type distinction.
- [ ] D.5 Run the static parser against `repos/identity-vessel`. Confirm zero diagnostics with the new config file in place.
- [ ] D.6 Run `bun test` against identity-vessel; confirm no test asserts the presence of `apiKey` or `jwtToken` in `config.discovery.shapes`. If found, update assertion.

## Phase E — Whole-tree verification

- [ ] E.1 Run the static parser from `2026-05-17-shape-dispatch-agreement` against all three vessels (`metabob-activity-api`, `concept-db`, `identity-vessel`). Confirm zero divergences across the three.
- [ ] E.2 Run `bun run typecheck` and `bun test` against each of the three vessels; no regression.
- [ ] E.3 Cross-check `discovery-vessel`'s registry view: after redeploy, querying `GET /registry/stats` should show identity-vessel advertising exactly one shape (`authentication`).

## Phase F — Coordinated deploy

- [ ] F.1 Confirm `2026-05-17-shape-dispatch-agreement` is deployed in advisory-only mode (lint warns, never fails CI; runtime probe absent or no-op).
- [ ] F.2 Land this change's three commits in this order: (a) concept-db test inversion, (b) identity-vessel config trim + JSON, (c) activity-api lint verification (no source change unless B.2 found a mismatch).
- [ ] F.3 Deploy to canary; observe one canary window (24h) for any unexpected `task.completed` failure mentioning a removed identity-vessel shape.
- [ ] F.4 If E.1 still passes and F.3 shows zero failure surface, signal to `2026-05-17-shape-dispatch-agreement` that the lint can be promoted to a CI gate and the runtime probe can be enabled in lenient mode.
- [ ] F.5 After one more canary window of lenient-mode runtime probe with zero divergence logs, signal to `2026-05-17` that the runtime probe can be promoted to strict mode (deregister + `verifier_negative` trace on divergence).
- [ ] F.6 Promote canary to production via the standard `/deploy` flow.
