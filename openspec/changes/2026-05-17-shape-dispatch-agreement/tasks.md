# Tasks

## 1. Shared check package

- [x] 1.1 Create `packages/shape-dispatch-check/` with zero runtime dependencies (TypeScript compiler API only). DONE 2026-05-17 (regex-based, no AST deps; simpler than planned)
- [x] 1.2 Implement AST walker over `src/config.ts` extracting the string-literal array under `discovery.shapes`. Fail loudly on non-literal entries. DONE 2026-05-17 `extractAdvertisedShapes()` via regex; handles multi-line arrays, inline comments
- [x] 1.3 Implement AST walker over `src/routes/impulses.ts` extracting every `case '<literal>':` inside the dispatch switch. Support fall-through cases. DONE 2026-05-17 `extractDispatchCases()` with fall-through propagation via backward walk
- [x] 1.4 Implement Set-diff producing `{unhandled_advertised, orphan_handlers}` with file:line for each entry. DONE 2026-05-17 `computeDiff()` in check.ts
- [x] 1.5 Support `// @shape-dispatch:private` annotation immediately above a case to exclude it from the orphan check. DONE 2026-05-17; single annotation above first fall-through case marks the whole group private
- [x] 1.6 Support optional `shape-dispatch.config.json` declaring `shape → pointer_types[]` for vessels where shape name ≠ pointer.type (identity-vessel). DONE 2026-05-17 `Config.mappings` block in check.ts
- [x] 1.7 CLI wrapper: `bun packages/shape-dispatch-check <vessel-root>` exits 1 on any unsuppressed violation; prints resolution hints per finding. DONE 2026-05-17; exits 0 on OK, 1 on violations, hints per finding

## 2. Per-vessel wiring

- [x] 2.1 Add `scripts/check-shape-dispatch.ts` to `metabob-activity-api`; wire into `package.json` `lint` script. DONE 2026-05-17; lint script: `eslint src --ext .ts && bun run scripts/check-shape-dispatch.ts`
- [x] 2.2 Same for `concept-db`. DONE 2026-05-17
- [ ] 2.3 Same for `discovery-vessel`. BLOCKED: discovery-vessel uses `src/resolvers.ts` + in-memory registry, not standard `src/config.ts` shapes array; needs vessel restructuring first.
- [ ] 2.4 Same for `identity-vessel` with a `shape-dispatch.config.json` mapping `authentication → [apiKey, session, jwtToken]`. BLOCKED: identity-vessel has `src/services/config.ts` + `src/resolvers/*.ts`, not the standard `src/routes/impulses.ts` dispatch switch.
- [x] 2.5 Add the script to the `ias-executor-ts` forge template so generated vessels inherit it. DONE 2026-05-17; `scaffold_vessel_skeleton` resolver always writes `scripts/check-shape-dispatch.ts` and the LLM prompt includes it in lint script

## 3. Runtime probe

- [x] 3.1 Extend `services/discovery-client.ts` in each vessel to run the same diff against the live config + handler registry before calling `register()`. DONE 2026-05-17; `checkShapeDispatchAgreement()` private method inlined in both `metabob-activity-api` and `concept-db` discovery-client.ts. Logic mirrors `packages/shape-dispatch-check/check.ts` (no super-repo dep needed at runtime since source files are in Docker image).
- [x] 3.2 Filter unhandled shapes out of the registration payload at runtime; log `error` with the divergence summary. DONE 2026-05-17; `register()` diffs advertised shapes, filters `unhandledAdvertised` from `config.discovery.shapes` before building the `VesselRegistration`, logs error with `validator_id: "shape-dispatch-agreement"`.
- [ ] 3.3 Emit one `failure_mode.type = "verifier_negative"` trace per startup with `validator_id = "shape-dispatch-agreement"`, debounced by `(vessel_id, shape, direction)`. TODO: deferred — emitting a trace from inside discovery-client requires calling activity-api, which for activity-api itself is a self-call; needs a dedicated startup-probe pathway (see `TODO` comment in discovery-client.ts).
- [ ] 3.4 Smoke test: introduce a deliberate divergence in a fixture vessel; assert the trace lands in activity-api with the expected `failed_evidence`.

## 4. CI integration

- [x] 4.1 Confirm each vessel's CI workflow runs `bun run lint`; verify the new script is reachable from CI. DONE 2026-05-17; `metabob-activity-api`: added `dev` branch to `ci-webhook.yml` (already has `Lint` step calling `bun run lint`); `concept-db`: created `.github/workflows/ci.yml` with `bun run lint` step. Both vessels have `scripts/check-shape-dispatch.ts` wired into `package.json lint`, so CI calls the check automatically.
- [x] 4.2 Add a workspace-level CI job that runs the check across all five vessels in one pass for fast local feedback. DONE 2026-05-17; `scripts/check-shape-dispatch-all.sh` iterates over `metabob-activity-api` and `concept-db` (skips vessels without standard layout). Exits 0 on clean, 1 on violations. Verified: both vessels exit 0 (42 + 14 shapes respectively).
- [ ] 4.3 Phase 8 canary-validation criterion update: add "zero `validator_id = shape-dispatch-agreement` self-traces in the canary window" to the acceptance set in `2026-04-26-impulse-activity-loop/design.md`. BLOCKED on task 3.3 (trace emission not yet implemented).

## 5. Documentation

- [x] 5.1 Update `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` §"Invariant 2" to replace the "future lint" note with a pointer to `packages/shape-dispatch-check/` and the per-vessel `lint` script. DONE 2026-05-17
- [x] 5.2 Add a short section to the same doc explaining `// @shape-dispatch:private` and `shape-dispatch.config.json`. DONE 2026-05-17 (included in 5.1 update)
- [x] 5.3 Cross-link from each vessel's CLAUDE.md ("Shape contract is enforced; see check"). DONE 2026-05-17; added to metabob-activity-api CLAUDE.md and concept-db CLAUDE.md; discovery-vessel + identity-vessel deferred until 2.3/2.4 are unblocked

## 6. Verification

- [x] 6.1 First run on `metabob-activity-api` reports the five orphan handlers at `src/routes/impulses.ts:1415-1433` (per design.md findings). DONE 2026-05-17; check found 5 orphan handlers + 1 unhandled advertised (`goal_verification_label`)
- [x] 6.2 First run on `concept-db` reports `conceptUpkeepAuditLog` advertised-unhandled at `src/config.ts:205`. DONE 2026-05-17; confirmed exact finding
- [x] 6.3 Audited divergences either (a) resolved in follow-up per-vessel commits or (b) explicitly annotated `// @shape-dispatch:private` with a comment justifying the intra-vessel-only reachability. DONE 2026-05-17; `conceptUpkeepAuditLog` removed from shapes; `goal_verification_label` removed from shapes; 5 deprecated analysis-api stubs annotated private in impulses.ts; both vessels now exit 0
- [ ] 6.4 Confirm CI rejects a contrived PR that adds an unmatched shape or unmatched case.
