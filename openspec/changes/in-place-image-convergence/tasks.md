## 0. Measurement (done)

- [x] 0.1 Lint `validation/scripts/image-convergence-surface.test.sh`: red, 31 tooling paths plus the 502-file federation tree; positive control passes (e9ce7e69).
- [x] 0.2 Gap `the-convergence-surface-is-narrower-than-the-baked-surface-so-landed-tooling-fixes-need-an-image-recreate`, armed on the lint's label.

## 1. Tier A: tooling (deployment lane + coordinator)

- [ ] 1.1 `scripts/substrate/image-files.manifest` listing every baked super-repo file (src, dst, mode); the Dockerfile COPYs from it. The manifest exists and a lint holds it equal to the COPY set; the Dockerfile does not yet COPY from it.
- [x] 1.2 Coverage map: for each manifest path, the gate fixture that exercises it, or `none` (stays baked). `scripts/substrate/gate/coverage.json`, proven by mutation: behaviour for `substrate-pull-sync` (no-self-exec) and `lib/gap-tracked-red.sh` (lib-sources), none for the other 315. Units are exempt under a named record with an owner gap and an expiry; 99 other paths converge today with no fixture (`converges-today-uncovered`). Kept consistent by `image-coverage-map.test.sh`; replayed by `image-coverage-map.check.sh`.
- [ ] 1.3 pull-sync installs manifest paths that are covered and inside `gate_paths` from the committed glue tree (coordinator).
- [ ] 1.4 Canary order enforced for Tier A: first canary, then N clean soak ticks, then the rest (coordinator; interim until the fleet channel).
- [ ] 1.5 Extend the lint: manifest == Dockerfile COPY set == pull-sync install set; uncovered paths are reported, not converged.
- [ ] 1.6 Verify by effect on a canary: a harmless change to a covered tooling path goes live with no recreate, then on the next node after the soak.

## 2. Tier B: federation runtime tree

- [ ] 2.1 Fixture script: candidate relay plus two transports on random loopback ports, concurrent ≥1 MiB reads across two circuits; a small-frame single-circuit control; time-bounded, no egress, every spawned process killed.
- [ ] 2.2 Mutation proof, side by side: FAIL on lib 542e712, PASS on 69256d9, control passes on both. Recorded as 69256d9's first measurement.
- [ ] 2.3 Add it under `fixture_paths` (ordinary under gate-policy).
- [ ] 2.4 pull-sync converges `/usr/local/share/substrate/super-repo/scripts/substrate` from `accepted/`, keeping last-good (coordinator).
- [ ] 2.5 Verify by effect: a transport change judged by the fixture goes live on a canary without a recreate; loaded-blob hash plus the large-frame check.

## 3. Tier C: base runtime upgrade activity

- [ ] 3.1 `scripts/substrate/runtime-upgrade.sh`, engine-agnostic, from `hub-upgrade-surreal.sh`, with the full evidence list in proposal.md.
- [ ] 3.2 Query-corpus parse check against the target engine, plus scan-vs-index equivalence (database fork's fixtures).
- [ ] 3.3 Binary provenance: upstream checksum or signature verified before install.
- [ ] 3.4 Rollback rehearsal on scratch: previous binary plus the tar restore boot together and pass the same checks.
- [ ] 3.5 Trigger shape: target runtime version plus evidence, through the criterion path; never a timer.
- [ ] 3.6 Activity minted through the substrate wrapping 3.1; must-fail fixture: a corpus-breaking engine is refused and the old binary kept.
- [ ] 3.7 One deploy event per node, its time recorded in WIRING, no concurrent change; smoke probes tagged and excluded.
