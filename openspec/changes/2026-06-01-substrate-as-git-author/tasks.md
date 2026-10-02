# Tasks — Substrate as Git Author

Three phases, each with an explicit acceptance criterion gating the next.

## Phase 1 — Foundational (gated on H2 keypair generation)

Goal: substrate can commit a single authored file to its scratch branch and push, and the operator can verify the signature.

- [ ] **1.1** — Generate H2-derived ed25519 keypair for substrate identity; register pubkey with discovery-vessel (per `2026-04-26-security-hardening-findings`).
- [ ] **1.2** — Implement `substrate_commit` resolver in `repos/development-vessel/src/resolvers/substrate-commit.ts`. Three-place input (`files`, `message`, `scope`). Stages, runs `substrate_commit_gate`, signs with H2 keypair, commits. Refuses outside-scope branches.
- [ ] **1.3** — Implement `substrate_push` resolver in `repos/development-vessel/src/resolvers/substrate-push.ts`. Rejects `--force`. Refuses pushes to `main`, `dev`, or any operator branch.
- [ ] **1.4** — Implement `substrate_commit_gate` resolver in `repos/development-vessel/src/resolvers/substrate-commit-gate.ts`. Runs lint + tests + `comprehensibility_check` on newly-authored files. Refuses commit on any failure.
- [ ] **1.5** — Adopt `repos/development-vessel/src/seed/proposed/<vessel-id>/<date>/` directory convention; document in `repos/development-vessel/README.md`.
- [ ] **1.6** — Document required GitHub branch protection rules for operator git-admin (rules text only — application is operator-side, out of code scope). Rules cover: `main`/`dev` blocked for substrate identity, no `--force`, no self-approve, no submodule pointer bump in super-repo `main`.
- [ ] **1.7** — Register shapes `gitCommitResult`, `gitPushResult`, `gitPrResult` in the concept-db shape catalog.

**Acceptance for Phase 1:** substrate can commit a single authored file to `substrate/<vessel-id>/test` and push, and the operator can verify the H2 signature via `git log --show-signature`. Attempted push to `dev` or `main` is rejected by both the resolver and (if rules applied) the git server.

## Phase 2 — Productivity

Goal: a substrate-authored template moves from drafter → `proposed/` file → PR open → operator merge → `SEED_TEMPLATES` entry.

- [ ] **2.1** — Implement `substrate_open_pr` resolver in `repos/development-vessel/src/resolvers/substrate-open-pr.ts`. Uses `gh pr create`. Body must cite trace IDs and concept IDs per concept_Q3lwHwujiwkj.
- [ ] **2.2** — Implement `concept_db_snapshot` resolver in `repos/development-vessel/src/resolvers/concept-db-snapshot.ts`. Exports current concept-db state to JSON with per-concept signatures.
- [ ] **2.3** — Seed `commit-authored-template` activity in `repos/development-vessel/src/seed/commit-authored-template.ts`. Composes gate + commit + push + open_pr.
- [ ] **2.4** — Seed `publish-substrate-snapshot` activity in `repos/development-vessel/src/seed/publish-substrate-snapshot.ts`. Boredom-cadence; bundles concept-db exports + posterior snapshots + attribution exports into one commit on `substrate-snapshots/<date>`.
- [ ] **2.5** — Wire `commit-authored-template` as a terminal step on `draft-activity-from-pattern` success.
- [ ] **2.6** — One-shot migration: bulk-commit historical substrate-authored work (today's minted concepts, today's load-attribution JSONL) so git history reflects what's already been authored. Script: `scripts/substrate/migrate-historical-authored-work.ts`.
- [ ] **2.7** — Operational guarantee tests: lint-failing commits refused, scope-violating pushes refused, `--force` pushes refused, PR self-approval refused.

**Acceptance for Phase 2:** a substrate-authored template moves all the way from drafter → `proposed/` file → PR open → operator merge → `SEED_TEMPLATES` entry. The nightly snapshot publishes successfully on its first boredom-cadence run.

## Phase 3 — Cross-substrate

Goal: two substrates can share an authored template via the `dev` branch with verifiable provenance.

- [ ] **3.1** — Implement concept-db snapshot import resolver in `repos/development-vessel/src/resolvers/concept-db-snapshot-import.ts`. Reads a snapshot JSON, reconciles against current concept-db state with conflict resolution rules.
- [ ] **3.2** — Implement posterior snapshot import with fresh-prior policy: imported templates retain provenance but Thompson posteriors start fresh in the importing substrate (substrates each develop own selection bias by design).
- [ ] **3.3** — Seed `propose-spec-from-recurring-gap` activity in `repos/development-vessel/src/seed/propose-spec-from-recurring-gap.ts`. Composes `draft-spec-from-gap` + `substrate_commit` + `substrate_open_pr`.
- [ ] **3.4** — Implement quorum-ratification activity for cross-substrate concept canonicalization (H4 dependency): substrate-authored concept is canonical only after ≥N substrates have ratified via signed `concept_link` operations.
- [ ] **3.5** — Verify discovery-vessel pubkey registry can be queried by substrate-B to verify substrate-A's commit signatures.

**Acceptance for Phase 3 (the transfer test):** two substrates share an authored template via the `dev` branch. Substrate-B verifies the H2 signature on substrate-A's commits via the discovery-vessel pubkey registry. Substrate-B inherits A's template as a candidate with fresh posteriors. A concept authored by substrate-A reaches canonical status only after ≥N substrates ratify.

## Gates

| Phase | Gates on | Notes |
|---|---|---|
| 1 | `2026-04-26-security-hardening-findings` §H2 keypair generation shipped | Cannot sign commits without H2. |
| 2 | Phase 1 acceptance | Need commit/push surface before productivity activities. |
| 3 | Phase 2 acceptance + H4 quorum machinery available | Federation requires both durable authorship and quorum primitives. |

## Cross-references

- `2026-04-26-security-hardening-findings/` — H2 prerequisite (signing identity), H1 (signed cross-vessel traces), H4 (quorum ratification).
- `2026-04-26-impulse-activity-loop/` — umbrella IAL.
- `2026-06-01-obsidian-observe-and-experiment/`, `2026-06-01-substrate-permissive-activity-authoring/`, `2026-06-01-closed-loop-learning-and-verification/` — outputs this proposal makes durable.
- `2026-05-23-substrate-closure-properties/` — closure model this proposal extends into git as a persistence layer.
