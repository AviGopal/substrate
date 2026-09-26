# Sources

This file lets you re-check every factual claim in `proposal.md` and `design.md`. Each row
gives the claim, a command that re-checks it against the running substrate or the source
tree, and the evidence section holding the full commands and output excerpts. Dated
observations belong here, not in the other artifacts. The values in the
**Observed at authoring** column are measurements, not expectations. Re-run the command
before relying on one.

Conventions:
- Run commands from the super-repo root unless they start with `docker exec`.
- The container is `substrate-live`.
- Some activity-api sources contain raw NUL bytes, so use `rg` or `grep -a`. Plain `grep`
  prints nothing on those files.
- `evidence/helpers/surql.sh` reads SurrealQL on stdin and posts it with the container's
  own credentials.
- `evidence/helpers/devvessel-resolve.sh` resolves shapes on development-vessel.
  **It has side effects on some shapes:** `systemd_unit_health_observer` re-emits gaps
  unless given `emit_gap:false`, and `substrate_health_tick` rewrites the heartbeat file.
- SurrealDB answers a query on a misspelled table with an empty successful result, not
  an error: `goal_verification_label` (singular) returns `[]` while the real table is
  `goal_verification_labels`. Before reading an empty result as a zero, run a
  `SELECT * … LIMIT 1` against the same table.

Evidence files:
- [`evidence/landing-routes.md`](evidence/landing-routes.md): every commit and push path,
  the commits that had not been traced to a route, and the incidents.
- [`evidence/credit-plumbing.md`](evidence/credit-plumbing.md): the status of the
  consequence-verdict change, `propagateCreditAlongChain`, the write shapes, the stores
  selection reads, and the `/reach` bug.
- [`evidence/readers-observers.md`](evidence/readers-observers.md): failure memory,
  ribosome, pending verification, candidate baseline checks, rhythm scheduling, gap-store
  fields.
- The docs self-management assessment that led to this change:
  `validation/reports/docs-self-management-assessment-2026-09-22/REPORT.md`.

## Landing and provenance

| Claim | Re-derive | Observed at authoring | Evidence |
|---|---|---|---|
| The cutover is the only gated route, and all `substrate-authored:` commits come from it | `rg -n -e 'git.*commit' -e 'git.*push' repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`; per repo: `git -C repos/<v> log --since=30.days --format=%s --grep='^substrate-authored:' --oneline` (count the lines) | 682 commits over 30 days | landing-routes § Route table, § Cross-check |
| Ungated routes write git: shell resolvers, goal-host's embedded `bash`, `git_commit`/`git_push`, pull-sync self-heal, CI bump | `rg -n -e 'bash -c' -e spawn repos/local-tools-vessel/src/index.ts`; `rg -n -e 'git push' -e rebase scripts/substrate/substrate-pull-sync.sh` | 7 routes plus 1 variant | landing-routes § Route table |
| No route records the authoring execution id; the cutover posts a new, unlinked landing execution | `rg -n -e 'Gap:' -e 'Proposal:' -e 'Mitosis' repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`; `git -C repos/development-vessel log -5 --format=%B --grep=substrate-authored` | commit body has gap, proposal and mitosis ids; no execution id | landing-routes § Route table (R1) |
| `FAMILY_GOALS["self-maintenance"]` makes an LLM commit and push vessel drift | `rg -n "self-maintenance" repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts` | substrate-written in `a44dc58` | landing-routes § The two UNLOCATED commits |
| Commit `4e4170a8` in the super-repo has no route in code | `git log -1 --format='%an %ad %s' 4e4170a8`; `rg -l "vessel code drift detected" repos/*/src scripts` (matches only a comment) | Substrate Autonomous; no code match | landing-routes § The two UNLOCATED commits |
| The crash-loop commit came through a shell route, not the cutover | `git -C repos/boredom-vessel log -1 --format='%an <%ae> %ad %s' 84cd2f2`; `git -C repos/boredom-vessel show --shortstat --format= 84cd2f2` | 25 files, +4855; subject not `substrate-authored:` | landing-routes § Incidents (2) |
| A cutover landing deleted the `^DEFINE FIELD` guard | `git -C repos/development-vessel show --stat 54b7762` | `vessel-mitosis-evaluate.ts`, 39 deletions | landing-routes § Incidents (1) |
| `regressed_by` has readers and no writer in source (the stored values were operator-written) | `rg -n regressed_by repos/*/src --glob '!*.test.ts'` | 2 references, both `!== undefined` reads | landing-routes § Incidents (3) |

## Post-land verification and readers

| Claim | Re-derive | Observed at authoring | Evidence |
|---|---|---|---|
| The post-land sweep checks only the gap's own predicate | `rg -n "sweepPendingLandVerifications" -A40 repos/development-vessel/src/resolvers/gap-to-feature.ts` | 12 checked, 0 closed, 8 held with no predicate | readers-observers § 3 |
| `BEHAVIORAL VERIFICATION FAILED` is written only for gaps with a `verification_spec` | `rg -n "BEHAVIORAL VERIFICATION FAILED" repos/development-vessel/src` | no live gap has one | readers-observers § 3 |
| A stored `regressed_by: null` arms the reader | the gap store: count gaps whose `classification_metadata` has the key `regressed_by` | 3 keys (`null`, two shas), all set by humans | readers-observers § 3 |
| Failure memory is keyed by goal text and has no external write path | `rg -n -e goalHashOf -e failure-memory -e priorVerdictFeedback repos/goal-host-vessel/src/index.ts` | `/workspace/.goal-host-failure-memory.jsonl`, 62 rows | readers-observers § 1 |
| The drafter reads `failure_lessons` and the file-keyed compose lessons at prompt-build | `rg -n -e priorAttemptFeedbackBlock -e failure_lessons -e compose-file-lessons repos/development-vessel/src/resolvers/feature-compose.ts` | `failure_lessons` on 526 gaps | readers-observers § 1 |
| Extraction happens immediately, with no per-execution hold | `rg -n "mintReachedTrace" repos/goal-host-vessel/src/index.ts`; `rg -n -e ribosome-extract -e extractionEligibilityPolicy repos/ribosome-vessel/src/index.ts` | no hold hook | readers-observers § 2 |
| The gap store accepts new metadata fields without a schema change; a second writer rewrites it without merging | `rg -n "saveGaps" repos/development-vessel/src/resolvers/substrate-gap.ts`; `rg -n -e GAPS_PATH -e writeFile scripts/substrate/typecheck-scenario-gen.ts` | 0 `caused_by` / `attempt_id` on 4656 gaps | readers-observers § 6 |
| Rhythms are pool impulses scored by staleness; there is no per-item due time | `rg -n -e timeShapedRhythm -e rhythmFamilyGoal repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts` | none | readers-observers § 5 |

## Baseline check candidates

| Claim | Re-derive | Observed at authoring | Evidence |
|---|---|---|---|
| `systemd_unit_health_observer` reports per-unit verdicts and can run without writing | `rg -n "emit_gap" repos/development-vessel/src/resolvers/systemd-unit-health-observer.ts` | `emit_gap !== false` defaults on | readers-observers § 4 |
| `gate_self_probe` runs a must-refuse and a must-accept artifact through each real gate | the header comment of `repos/development-vessel/src/resolvers/gate-self-probe.ts` | none | (read directly) |
| `push_health_observer` reports healthy when its log is missing; `detector_coverage_scan` turns fetch errors into a zero | the resolvers in development-vessel `src/resolvers/`; resolve each with the helper | `traces_examined:0` while activity-api returned 401 | readers-observers § 4 |

## Credit

| Claim | Re-derive | Observed at authoring | Evidence |
|---|---|---|---|
| `propagateCreditAlongChain` only adds, decays, and has no idempotency key | `rg -n -A60 "function propagateCreditAlongChain" repos/activity-api/src/lib/posterior-update.ts` | none | credit-plumbing § 2 |
| Selection reads `variant_performance_metrics` and `context_thompson_scores` | `rg -n "variant_performance_metrics" repos/activity-api/src/services/discover-by-shapes.ts`; `rg -a -n "context_thompson_scores" repos/activity-api/src/routes/activities.ts` | none | credit-plumbing § 4 |
| Labels on landings carry synthetic execution ids with no chain | `sh openspec/changes/causal-attempt-ledger/evidence/helpers/surql.sh <<< "SELECT count() FROM goal_verification_labels WHERE string::starts_with(execution_id,'feature_compose:') GROUP ALL;"` | 573 labels; 2 of 30 sampled have an `execution` row | credit-plumbing § 3 |
| `activityFeedback_write` has no execution id and moves a store no selector reads | `rg -n "impulse_shape_activity_score" repos/activity-api/src` | 13,393 rows | credit-plumbing § 3 |
| Neither the consequence-verdict reader nor its writer exists; its writer gap expired without repair | `rg -a -n "goal_verification_label" repos/activity-api/src/lib/posterior-update.ts`; `ls repos/development-vessel/src/resolvers/consequence-verdict-emit.ts` | 0 references; file absent | credit-plumbing § 1 |
| The `/reach` pre-read filters on `$activity_id` without binding it | `rg -a -n -F -A2 'WHERE activity_id = $activity_id LIMIT 1' repos/activity-api/src/routes/execution-traces.ts` (bindings: only `execution_id`) | introduced by `f65e752`, substrate-authored | credit-plumbing § Incidental finding |

## Environment facts that affected this research

| Fact | Re-derive |
|---|---|
| The API key in the host `~/.metabob/config.json` is rejected by identity | `docker exec substrate-live curl -s localhost:8100/registry/shapes -H "Authorization: ApiKey <host key>"` returns `INVALID_API_KEY` |
| development-vessel resolve takes `{"impulse":{"pointer":{…}}}`; a bare `pointer` returns 400 | see `evidence/helpers/devvessel-resolve.sh` |
