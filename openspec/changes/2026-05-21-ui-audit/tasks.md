# Tasks

## 1. Dependency + script wiring
- [ ] 1.1 Add `@axe-core/playwright` to `devDependencies` in `repos/metabob-cloud-dashboard/package.json`.
- [ ] 1.2 Add `"ui-audit": "bun run scripts/ui-audit.ts"` to `package.json` scripts.
- [ ] 1.3 Add `e2e/results/ui-audit/` and `e2e/results/ui-audit.json` to `.gitignore`.

## 2. Audit script
- [ ] 2.1 Create `scripts/ui-audit.ts` with the route table, viewport set, and detection heuristics from design.md.
- [ ] 2.2 Implement the `Violation` type and JSON emitter; surface heuristic thresholds (`TAP_TARGET_MIN_PX = 24`, `TRUNCATION_RATIO = 1.3`, `OVERFLOW_MIN_TEXT_LEN = 4`) as named constants.
- [ ] 2.3 Implement axe-core integration via `@axe-core/playwright`.
- [ ] 2.4 Implement screenshot capture; create `e2e/results/ui-audit/` lazily.
- [ ] 2.5 Implement route-parallel (4-way) / viewport-sequential execution with a 60s timeout per route+viewport.
- [ ] 2.6 Implement auth-state loading from `playwright/.auth/rubric.json` with a clear error+exit-2 when missing.
- [ ] 2.7 Implement one-retry tolerance on heuristic detections (run twice per route+viewport, emit a violation only if both runs agree).
- [ ] 2.8 Emit `e2e/results/ui-audit.json` with the shape from design.md.
- [ ] 2.9 Exit 0 on success regardless of violations; the gate is in the rubric spec, not the script.

## 3. dev-loop integration
- [ ] 3.1 Extend `scripts/dev-loop.ts` to invoke `bun run ui-audit` after the rubric run.
- [ ] 3.2 Merge the audit summary into the printed line (`UI audit: axe=... | overflow=... | ...`).
- [ ] 3.3 Compute exit code as `max(rubric_exit, audit_run_exit, rubric_spec_07_exit)`.

## 4. Rubric gate spec
- [ ] 4.1 Create `e2e/rubric/07-ui-quality.spec.ts`.
- [ ] 4.2 Read `e2e/results/ui-audit.json`; if missing, `test.skip` with a clear message.
- [ ] 4.3 Assert: 0 axe violations of severity `critical` or `serious`.
- [ ] 4.4 Log (not assert) overflow / truncation / tap-target counts.

## 5. Verification
- [ ] 5.1 Run `bun run ui-audit` against the seeded canary state; confirm `ui-audit.json` is emitted with realistic counts.
- [ ] 5.2 Confirm wall-clock < 60s on a developer laptop for the current route set.
- [ ] 5.3 Confirm `bun run dev-loop` returns the merged summary line.
- [ ] 5.4 Smoke-test the rubric gate: inject a deliberate axe critical violation (e.g., a button with no accessible name) in a throwaway local commit and confirm `bun run dev-loop` exit code becomes non-zero. Revert.
