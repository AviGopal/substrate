# Tasks

## 1. Shared check package

- [ ] 1.1 Create `packages/shape-dispatch-check/` with zero runtime dependencies (TypeScript compiler API only).
- [ ] 1.2 Implement AST walker over `src/config.ts` extracting the string-literal array under `discovery.shapes`. Fail loudly on non-literal entries.
- [ ] 1.3 Implement AST walker over `src/routes/impulses.ts` extracting every `case '<literal>':` inside the dispatch switch. Support fall-through cases.
- [ ] 1.4 Implement Set-diff producing `{unhandled_advertised, orphan_handlers}` with file:line for each entry.
- [ ] 1.5 Support `// @shape-dispatch:private` annotation immediately above a case to exclude it from the orphan check.
- [ ] 1.6 Support optional `shape-dispatch.config.json` declaring `shape → pointer_types[]` for vessels where shape name ≠ pointer.type (identity-vessel).
- [ ] 1.7 CLI wrapper: `bun packages/shape-dispatch-check <vessel-root>` exits 1 on any unsuppressed violation; prints resolution hints per finding.

## 2. Per-vessel wiring

- [ ] 2.1 Add `scripts/check-shape-dispatch.ts` to `metabob-activity-api`; wire into `package.json` `lint` script.
- [ ] 2.2 Same for `concept-db`.
- [ ] 2.3 Same for `discovery-vessel`.
- [ ] 2.4 Same for `identity-vessel` with a `shape-dispatch.config.json` mapping `authentication → [apiKey, session, jwtToken]`.
- [ ] 2.5 Add the script to the `ias-executor-ts` forge template so generated vessels inherit it.

## 3. Runtime probe

- [ ] 3.1 Extend `services/discovery-client.ts` in each vessel to run the same diff against the live config + handler registry before calling `register()`.
- [ ] 3.2 Filter unhandled shapes out of the registration payload at runtime; log `error` with the divergence summary.
- [ ] 3.3 Emit one `failure_mode.type = "verifier_negative"` trace per startup with `validator_id = "shape-dispatch-agreement"`, debounced by `(vessel_id, shape, direction)`.
- [ ] 3.4 Smoke test: introduce a deliberate divergence in a fixture vessel; assert the trace lands in activity-api with the expected `failed_evidence`.

## 4. CI integration

- [ ] 4.1 Confirm each vessel's CI workflow runs `bun run lint`; verify the new script is reachable from CI.
- [ ] 4.2 Add a workspace-level CI job that runs the check across all five vessels in one pass for fast local feedback.
- [ ] 4.3 Phase 8 canary-validation criterion update: add "zero `validator_id = shape-dispatch-agreement` self-traces in the canary window" to the acceptance set in `2026-04-26-impulse-activity-loop/design.md`.

## 5. Documentation

- [ ] 5.1 Update `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` §"Invariant 2" to replace the "future lint" note with a pointer to `packages/shape-dispatch-check/` and the per-vessel `lint` script.
- [ ] 5.2 Add a short section to the same doc explaining `// @shape-dispatch:private` and `shape-dispatch.config.json`.
- [ ] 5.3 Cross-link from each vessel's CLAUDE.md ("Shape contract is enforced; see check").

## 6. Verification

- [ ] 6.1 First run on `metabob-activity-api` reports the five orphan handlers at `src/routes/impulses.ts:1415-1433` (per design.md findings).
- [ ] 6.2 First run on `concept-db` reports `conceptUpkeepAuditLog` advertised-unhandled at `src/config.ts:205`.
- [ ] 6.3 Audited divergences either (a) resolved in follow-up per-vessel commits or (b) explicitly annotated `// @shape-dispatch:private` with a comment justifying the intra-vessel-only reachability.
- [ ] 6.4 Confirm CI rejects a contrived PR that adds an unmatched shape or unmatched case.
