# Substrate as Git Author — durable, portable substrate authorship via constrained git access

## Why

Substrate-authored work is currently volatile — concept-db and trace store live in container volumes that have been lost N times this session (container exited 137 from OOM multiple times today). Git must be the durable layer for anything that survives container lifetime. This proposal makes the substrate a constrained git author: H2-signed commits to scope-limited branches, gated by lint+tests+comprehensibility, surfaced as PRs the operator reviews. Without this, substrate-authored templates, findings, openspec proposals, and concept-db snapshots are lost on every restart, and "we will have to deal with many of these" is not workable. This proposal is itself operator-bootstrap justified by exception: the substrate's `draft-spec-from-gap` chain is currently non-functional (per `validation/findings/yardstick-2026-06-01-obsidian-meta-skill.md` at `08886383`). Once Phase 1 ships, future iterations of this same spec become substrate-authorable.

## What changes

### Identity, signing, scope discipline

- Each substrate has an H2-derived ed25519 keypair (`vessel_id = multihash(pubkey)`, per CLAUDE.md §Security Hardening §H2). Substrate's git author identity is `<vessel-id>@substrate.local`; the same keypair signs commits.
- The substrate's writable branches:
  - `substrate/<vessel-id>/<purpose>` — per-vessel scratch, auto-pruned after N days (default 30)
  - `substrate-authored/<date>` — substrate-batched work intended for operator review (PR base)
  - `substrate-snapshots/<date>` — concept-db exports, posterior snapshots, attribution exports
- The substrate CANNOT push to `main`, `dev`, any operator branch. CANNOT `--force` push. CANNOT bump submodule pointers in super-repo main. CANNOT self-approve PRs. Enforced at the git server (GitHub branch protection rules) AND at the resolver layer.

### What's committable and where

| Artifact | Path | Cadence |
|---|---|---|
| Substrate-authored templates | `repos/development-vessel/src/seed/proposed/<vessel-id>/<date>/<id>.ts` | Per dispatch |
| Substrate findings | `validation/findings/substrate-authored/<vessel-id>/<date>-<slug>.md` | Per substantive observation |
| Concept-db snapshots | `validation/concept-db-snapshots/<vessel-id>-<date>.json` | Boredom-tick cadence |
| Posterior snapshots | `validation/posterior-snapshots/<vessel-id>-<date>.json` | Daily |
| Spec proposals | `openspec/changes/substrate-authored-<date>-<slug>/` | Per draft-spec-from-gap success |
| Attribution exports | `validation/load-attribution/<vessel-id>-<date>.jsonl` | Continuous append, daily commit |

The substrate does NOT directly add templates to `SEED_TEMPLATES`; it writes the file under `proposed/` and PRs it. Operator decides which graduate.

### New substrate primitives (resolvers)

1. `substrate_commit` — `{ files: string[], message: string, scope: 'scratch' | 'authored' | 'snapshot', authored_by_trace_id: string }`. Stages, runs lint+tests, signs with H2 keypair, commits. Refuses outside scope. Emits `gitCommitResult`.
2. `substrate_push` — `{ branch: string }`. Pushes scope-validated branch. `--force` rejected. Emits `gitPushResult`.
3. `substrate_open_pr` — `{ source_branch, target_branch: 'dev' | 'main', title, body }`. Opens PR via `gh pr create`. Body cites trace IDs and concept IDs per the comprehensibility discipline (concept_Q3lwHwujiwkj). Emits `gitPrResult`.
4. `concept_db_snapshot` — exports current concept-db state to structured JSON with per-concept signatures.
5. `substrate_commit_gate` — sibling of `convergent_validity_check` (concept_tBShFh5dbHXy) and `comprehensibility_check` (concept_uXRPTRZPCKFS). Pre-commit verifier: lint + tests + comprehensibility check on newly-authored files. Refuses commit on any failure. Substrate cannot bypass.

### New substrate activities

1. `commit-authored-template` — composes the gate + commit + push + open_pr for newly-authored activity templates. Every `draft-activity-from-pattern` execution that produces a comprehensible template ends with a dispatch to this.
2. `publish-substrate-snapshot` — boredom-cadence activity bundling concept-db exports + posterior snapshots + attribution exports into a single commit on `substrate-snapshots/<date>`. Nightly.
3. `propose-spec-from-recurring-gap` — when substrate identifies a recurring gap class (e.g. heartbeat starvation + silent task failure pair, `concept_dD1udnb-sQnD` and `concept__8RiPOP7wP5A`), composes `draft-spec-from-gap` + `substrate_commit` + `substrate_open_pr` to produce an openspec proposal as a PR.

### Portability — three distinct problems

1. Within one substrate, across container lifetimes — boot fetches own `substrate-snapshots/` and `substrate-authored/` branches, reimports concept-db. Trace store rebuilds from scratch (Thompson posteriors restart). Concept knowledge persists.
2. Across substrates sharing authored work — substrate-A's `substrate-authored/<date>` reviewed and merged to `dev`. Substrate-B pulling from `dev` inherits A's templates as candidates with fresh posteriors. Substrates do NOT share posteriors directly (each develops its own selection bias) but DO share authored vocabularies.
3. Federation across substrates without operator intermediary — H1-H4 hardening becomes load-bearing. Substrate-A signs commits with H2 identity. Substrate-B verifies via discovery-vessel pubkey registry. H4 quorum: substrate-authored work is canonical only after ≥N substrates have ratified via signed `concept_link` operations. Until then proposal-status.

## Companion concepts

- `concept_uXRPTRZPCKFS` (comprehensibility_check_resolver_pattern) — gate dependency
- `concept_Q3lwHwujiwkj` (llm_comprehensibility_discipline_for_authored_artifacts) — PR body discipline + commit message discipline
- `concept_tBShFh5dbHXy` (convergent_validity_three_signals) — gate sibling pattern
- `concept_GQOxmoGZ94z5` (detection_primitive_self_meta_check) — substrate observing its own commit failures
- `concept__W9s8nA3YbDO` (observe_act_observe_meta_skill_loop) — the loop this durability layer makes shareable across substrates
- `concept_U1GbuEbgtcM7` (substrate_self_detection_recursive) — the recursive principle this proposal embodies at the persistence layer
- `concept_dD1udnb-sQnD` (vessel_heartbeat_starvation_uncaught) — example of substrate-authored finding that should round-trip through git
- `concept__8RiPOP7wP5A` (silent_task_failure_phantom_subclass) — same

## Related openspecs

- `2026-04-26-impulse-activity-loop` — the umbrella IAL
- `2026-04-26-security-hardening-findings` — H1-H4 prerequisites (H2 specifically)
- `2026-06-01-obsidian-observe-and-experiment`, `2026-06-01-substrate-permissive-activity-authoring`, `2026-06-01-closed-loop-learning-and-verification` — this proposal makes their outputs durable

## Out of scope

- Implementation of H2 itself (that's the security-hardening-findings spec's job; this spec depends on it)
- GitHub-server-side branch protection rule configuration (operator's git-admin job, not code; this spec lists the requirements but doesn't ship the config)
- Substrate-as-PR-reviewer (substrate cannot review its own PRs; operator-equivalent automation is future work)
- Cross-substrate posterior synchronization (Phase 3 explicitly excludes; substrates each develop own selection bias by design)

## Risk

- **H2 not yet shipped** — Phase 1 cannot ship until it does.
- **Server-side enforcement** — git server protection rules are operator-side; substrate-side enforcement alone is insufficient if an attacker rotates the substrate's keypair.
- **Branch storage cost** — a substrate that boots and immediately publishes per dispatch could produce thousands of small commits; the boredom-cadence batching in `publish-substrate-snapshot` mitigates this.
