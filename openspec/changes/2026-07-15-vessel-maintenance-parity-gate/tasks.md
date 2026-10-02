# Tasks — vessel-maintenance parity gate

Ordered so the load-bearing gate is proven before any generator is trusted, and the family is
*earned* on the easiest fossil before it climbs. Bootstrap steps 1–3 are a legitimate operator
act (the capability cannot be drafted into the fossil it must fix); step 4+ is substrate-driven.

## Phase 0 — settle the contract (this change)

- [x] Land this proposal/design as the settled parity contract. No code yet.
- [ ] Register the shape vocabulary: `spliceabilityGap`, `seamExtraction`, `parityVerdict`.
- [x] Confirm reuse siting: parity gate is a sibling verifier in development-vessel's
      feature_compose verify path, selected by transform type (behavior vs maintenance).

## Phase 1 — build + prove the gate (bootstrap, deterministic, no fossil edit)

- [x] Implement `verify-parity` as a small module: surface-parity, type-parity, test-parity,
      normalized-AST equivalence (ts-morph). Cheapest-first short-circuit.
- [x] Unit tests — the safety property is the deliverable:
  - [x] pure move of a top-level fn → `astEquivalent = true`, verdict PASS.
  - [x] move + body edit of a moved fn → `astEquivalent = false`, verdict FAIL.
  - [x] move + rename → FAIL. move that rebinds a free identifier → FAIL (binding check).
  - [x] export added/removed → surfaceParity FAIL. new `tsc` diagnostic → typeParity FAIL.
  - [x] edited test file → testParity FAIL.
- [x] Gate must only ever BLOCK (fail-safe): an unprovable transform leaves the tree unlanded.

## Phase 2 — deterministic loose-bag extractor (bootstrap)

- [x] Implement `apply-seam-extraction` (ts-morph move + re-export shim + import fixup).
- [x] Implement `propose-seam-extraction` **deterministic tier**: group a loose-bag file's
      top-level decls by existing route-prefix / call-cluster; emit one `seamExtraction`.
- [x] Dry-run on `activity-api/routes/activities.ts` (57 handlers): propose one handler group,
      apply, run the gate. Inspect the `parityVerdict` — do NOT land yet.

## Phase 3 — earn the family on the easiest fossil (first real landing)

- [ ] Land ONE parity-PASS seam from `activities.ts` as a traced `refactor(...) [parity-gated]`
      commit. Assert: `tsc` + full suite green, file drops by exactly the extracted line count,
      zero behavior change.
- [ ] Re-drive a small behavior edit that previously `no_op`'d against `activities.ts`; confirm
      the drafter now splices the shrunken module (fossil became self-editable). This is the
      end-to-end proof.
- [ ] Mint `detect-spliceability-gap` from the realized drafter-`no_op` signal (not a line-count
      lint); backfill `spliceabilityGap` weights for the census fossils.

## Phase 4 — hand it to the loop (substrate-driven, boredom)

- [ ] Wire the family into boredom/condition-driven selection; ordering law decompose-before-
      behavior enforced (maintenance on F precedes behavior work on F).
- [ ] Let the loop drive `activities.ts` → below the splice ceiling autonomously; watch `λ₁`
      (PASS-commits/time) via traces, not counts.
- [ ] Escalate to weak-LLM proposal tier for the two god-class fossils (goal-host `index.ts`,
      obsidian `goal-dispatch-view.ts`) — collaborator extraction, still parity-gated.

## Phase 5 — unblock the consumers (circle back)

- [ ] Once goal-host `index.ts` is spliceable: re-open the write-back walk gap
      (`walk-autobridges-obsidian-write-note-…`); the walk fix is now draftable. (Task #1.)
- [ ] Generalize the parity-gated-mechanical-transform pattern to other weak-model maintenance:
      dead-code removal, dup consolidation, dependency hygiene — each "prove behavior unchanged"
      + a mechanical edit.

## Verification gates (per the proposal)

- Unit: the safety property (Phase 1 tests) — a move-that-rewrites always FAILs.
- Live: Phase 3 end-to-end — a real fossil shrinks, behavior-neutral, and becomes drafter-spliceable.
- Dynamics: Phase 4 — `λ₁ > 0` and rising, driven by cheap generators; fossils trend down.
