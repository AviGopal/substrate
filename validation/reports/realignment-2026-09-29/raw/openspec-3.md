# openspec-3 — change proposals 37..54 (2026-06-01 → 2026-06-14)

Source: `openspec/changes/` entries 37–54 of `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#')`.
All 18 are top-level (none archived, none are stray .json/.ts files). Read on 2026-09-28.

| # | Entry | Files | tasks.md done/open |
|---|---|---|---|
| 37 | 2026-06-01-concept-db-supersession-and-chunker-hygiene | proposal, tasks | 0/42 |
| 38 | 2026-06-01-concept-db-upkeep-loop | proposal, tasks, findings/2026-06-03-concept-usage-backfill-wired.md | 0/36 |
| 39 | 2026-06-01-obsidian-observe-and-experiment | proposal, tasks, specs/obsidian-observation-layer | 0/6 |
| 40 | 2026-06-01-substrate-as-git-author | proposal, tasks, spec, findings/noncanonical-paths-clarification | 0/19 |
| 41 | 2026-06-01-substrate-permissive-activity-authoring | proposal, tasks, spec | 0/5 |
| 42 | 2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop | proposal, design, tasks, findings/stage-0-and-1 | 1/48 (+2 partial) |
| 43 | 2026-06-04-drop-drafter-source-type-filter | proposal, tasks | 2/9 |
| 44 | 2026-06-04-learning-rate-1-embedding-conditioned-posterior | proposal, tasks | 7/26 (all 7 = "spec written") |
| 45 | 2026-06-04-learning-rate-3-background-trace-replay | proposal, tasks | 0/46 |
| 46 | 2026-06-04-learning-rate-4-tier-restricted-bandit | proposal, tasks, mvp.patch | 2/19 |
| 47 | 2026-06-04-learning-rate-6-td-lambda-credit | proposal, tasks, mvp.patch | 0/15 |
| 48 | 2026-06-04-learning-rate-7-successor-features | proposal, tasks | 11/26 |
| 49 | 2026-06-04-learning-rate-8-hierarchical-signature-clustering | proposal, tasks | 0/45 |
| 50 | 2026-06-14-gap-scenario-class-dedup | proposal only ("Done when" all [x]) | — |
| 51 | 2026-06-14-learning-rate-acceleration-and-detector-recursion | proposal, design, tasks, 3 specs | 3/21 (+Phase C-bis "DONE") |
| 52 | 2026-06-14-merge-gate-computes-convergent-validity | proposal only (all [x]) | — |
| 53 | 2026-06-14-non-obsidian-trace-pattern-feeder | proposal only (all [x]) | — |
| 54 | 2026-06-14-system-authored-activity-promotion-loop | proposal only | — |

**Headline for the realignment:** in this shard, `tasks.md` checkboxes are not a source of truth in either direction.
Code for LR-1/4/6/7/8, the four horizon detectors, the obsidian seeds, the detector-recursion scans and the
generalized exercise picker is live in `/workspace/git/vessels/*` while the task lists say 0 done; conversely
"Done when [x]" entries (scenario dedup) have since re-bloated. None of the 18 were archived.

Live checks run (cheap, read-only): file existence in live clones inside `substrate-live`, boredom goal wiring,
DB row counts/recency on `successor_features`, `signature_cluster_*`, `embedding_prior_weights`,
`substrate_tuning_param`, scenario-dir file counts, remote branch listing. NOT verified: per-activity trace
usage — `activity_execution_traces.created_at` is a string and the table returned nothing newer than July
for the date filters tried (recorded as a coverage gap under trace-store-db).

---

## By problem class

### operator-authorship-recursion (NEW key — nothing in the seed list fits)
Every 06-01 proposal opens with "Authorship origin: Operator-authored. This file should have been emitted by the
substrate's `draft-spec-from-gap`…". #37 §I.1–I.5 specified the fix: `draft-spec-from-gap` must emit a mandatory
"How the substrate should do this itself" section; `review-spec-substrate-coverage` activity to refuse proposals
lacking it; I.5 log `historicalSpecGap` impulses. #38 calls itself "one of the last proposals that should be authored
that way"; #40 justifies itself "by exception: the substrate's draft-spec-from-gap chain is currently non-functional".
- Outcome: **failed**. None of I.1–I.5 landed; every subsequent proposal in the shard (06-03, 06-04 ×7, 06-14 ×5) is
  again operator/agent-authored. The recurrence is exactly the user's complaint: the "last operator-authored spec" is
  declared on 06-01 and the pattern continues through 09-28 (see e.g. `value-per-cost-selection` in the git status).
- Related principle restated at 06-14 (#51): "Operator = novelty injection; substrate = instance authoring."

### docs-drift
- tasks.md vs code, inverted (see headline). #51's own 06-14 audit table says "Sample-need — TD(λ), tier-restricted
  bandit, concept prior, embedding posterior — **Implemented**" while #44/#46/#47/#49 tasks.md show 0–7 done.
- #40 finding `noncanonical-paths-clarification.md` cites commits e697d1bf, 84a04f44, 84691405 and "**Commit [fourth
  commit]**" — an unfilled placeholder presented as evidence (hollow record; LLM-drafted finding).
- #42 finding claims "detector LOGIC is correct (empirical proof point via direct invocation)" and ships the HTTP
  path that returns 0 principles — docs assert success over a known-broken live path.
- #47 proposal self-corrects the prompt it was written from: "The codebase *already implements* eligibility-trace
  decay — the prompt's claim that the current path uses unweighted γ=1 is incorrect." (Good: reality checked before
  proposing. Lesson: the research prompts that spawned the 8-mechanism series were not grounded in code.)
- #48 tasks.md is the one honest ledger: every [ ] carries a dated "(Not landed / Checked 2026-07-01: …)" note.

### write-read-mismatch
- **#42 vessel_responsibility_audit** (2026-06-03): via dev-vessel HTTP route `principles_fetched_total: 0`; direct
  in-container bun import returns 8. Filed as "probably a Bun runtime edge case … HTTP/2 connection-reuse or
  AbortSignal". Stage 3.2 remains `[ ] GAP … principles_fetched_total: 0 … Blocked by Stage 0 ingestion`. A negative
  never attributed (no positive control through the same address) — matches the later memory law "a negative is
  unattributed until a positive control shares its address". Outcome: **failed/unknown**.
- **#38 concept-usage-backfill** (dev-vessel 7ceee82, super-repo 9fcb0919, 2026-06-03): finding said substitution
  "should work" by analogy with close-health-gap; #42 Stage 3.3 then found task-0 `concept_select_for_prompt`
  returns `selected: []` and task-2 POSTs `/concepts//usage` → 404. Also: outcome hard-coded "success" (one-sided
  signal, finding admits it). Seed + boredom goal still wired (`boredom-vessel/src/index.ts:631`). Outcome:
  **failed → partial** (3.4 later PASS via light-dispatch exec_39a7c719-b5b in 702 ms, but the empty-id path is the
  default when no concept matches).
- **#54 promotion loop C**: auto-promote joins `vpm_key.replace(/_/g, ':')` — underscore-heavy ids like
  `proposed_pattern_authored_prime_context` break the join. Still present live at
  `activity-api/src/routes/activities.ts:3733`. Outcome: **dormant/unfixed** (B's trace-store fallback — `GROUP BY
  activity_id` at :3751 — landed and papers over it).
- **#44 embedding-prior** (PLAUSIBLE, not fully verified): all 5128 `embedding_prior_weights` rows carry
  `org_id: "default"`; the reader (`services/embedding-prior.ts` ~L124) filters `WHERE org_id = $org_id`, called
  from `posterior-update.ts:692/1220` with the trace's org (other LR tables use `organizations:substrate`). If so,
  the θ-prior never serves and silently falls through to the concept-db neighbor path.
- **#54 B** (06-14): deterministic activities never get a vpm posterior (UPDATE skipped for degenerate posteriors,
  `posterior-update.ts:49-53`, the LR-4 tier-bandit effect) so evidence-gated auto-promote could never graduate them —
  a consequence of LR-4 nobody predicted: skipping Thompson on deterministic cells starved the promoter that reads vpm.

### narrowing-duplicates (scenario re-bloat)
- **#50 gap→scenario class dedup** (06-14): drafter scenario dir held 7879 files over 259 classes; `classKey()` cuts
  a sanitized gap-id at its first timestamp / `exec_` marker; one-shot prune 7879→259; live bridge reported
  `created:0, skipped_class_duplicate:2673`. Claimed "no re-bloat".
- Live 2026-09-28: `/workspace/validation/failure-modes/scenarios` 4573 files (~2009 distinct prefixes),
  `vessel-scenarios` 1532; super-repo clone `…/scenarios` 3364 (~3341 distinct), `vessel-scenarios` 1509; **2275
  scenario files tracked in super-repo git**. New id formats (`route-edit-<hash>-step-N`,
  `typecheck-development-vessel-src-resolvers-vessel-mitosis-cutover-l2785-ts1005`) carry no timestamp/`exec_`
  marker, so the class key no longer collapses them. Outcome: **reverted** — same defect, different hat. Two roots
  (`/workspace` vs super-repo clone) = the same split as the "two memory stores" finding (node-locality /
  sync-deploy-drift). Runtime state tracked in git contradicts CLAUDE.md placement rules.
- Root cause (class): dedup keyed on the *surface syntax* of today's id format instead of a stable class identity
  emitted by the producer.

### hollow-landing
- **#52 merge gate**: `evaluate-pr-via-internal-idioms` hard-coded `"convergent_validity_score": 0.7` into the LLM
  prompt; `gh_pr_merge.checkEvidence` trusted it against floor 0.4 → rubber stamp. Fix: `deriveConvergentValidity(ev)`
  from `phantom_trace_delta`, `precondition_rejection_delta`, `produced_by_trace_ids` (present live, 3 refs). Honest
  scope note: "does not alter any merge decision". Outcome: **worked (integrity)** but the PR/merge path it guards is
  itself superseded by direct push-to-dev landings → effectively **dormant**. Follow-on (claim verifier for
  `verifiable_claims[]`) never tracked here.
- **#48 successor features**: migration `149-successor-features.surql` applied 2026-06-28; 291 rows (07-01) → 2681
  rows now (435 updated since 09-20). VERIFY.1 second clause fails (ψ covers ~13% of vpm cells), `variance_estimate`
  never written, update not idempotent, `successor-features-vessel` never shipped (in-process fire-and-forget
  `.catch` instead; samples during outage lost). Selector blend `SF_BLEND` is now ON via
  `substrate_tuning_param.SF_BLEND=1.0` (flag-policy tick `jobs/accelerator-flag-tick.ts`) although VERIFY.2/3
  acceptance (≥15% top-1 on reward shift; ±2% no-regression) was never run — blocked on the DEV-E harness that
  was never built. Outcome: **partial/unverified-in-production**.

### false-verification
- #50's "no re-bloat" verified only at deploy instant.
- #38 finding's "should work" by analogy (see above).
- #42 Stage 3 records honest PARTIAL/GAP verdicts — the one place verification was done at the consuming layer.
- #52 identified the class "a self-reported validity score is not evidence" inside the trust function itself.

### env-gating (law 1)
- #47 LR-6 proposed `process.env.TD_LAMBDA` (default 0.7). Later repaired: `getTuningParam('TD_LAMBDA', …)` reading
  `substrate_tuning_param` (migration 152; live row `TD_LAMBDA=0.6`) with env fallback. Outcome: **partial (law-1
  repair)** — the tuning-param table is the general seam.
- Still env-first: `successorBlendEnabled()` returns true on `process.env.SF_BLEND` before the table;
  `SF_BLEND_WEIGHT`, `EMBEDDING_PRIOR_ENABLED` (prior-seed.ts:81 reads env directly; posterior-update.ts:607 has a
  table-backed cache), `EMBEDDING_PRIOR_OBSERVER_ENABLED` (off), `M1_OBSERVER_*`, `PRIOR_SEED_K/KAPPA/TIMEOUT_MS`;
  #41 specified `COMPREHENSIBILITY_RECHECK_*` env; #42 2.A.4 "only attach instrumentation when DEBUG env is set";
  goal-host `GOAL_HOST_DISABLE_SUBSCRIBERS=1` (validator-dispatch livelock *ablated* by env, per #51).
  Outcome: **failed** on law 1 for these.

### dormant-mechanism
- **#37 concept-db supersession + chunker hygiene**: live `EdgeTypeSchema` still the 8 original values (no
  `supersedes`); no `superseded_by`, no 64 KB content cap, no `{{…}}` validator, no `include_superseded`; H.1–H.6
  detectors absent. Outcome: **never built** (still open problems: heading-slug-as-shape, template-literal leak,
  JSON-escape runaway 1+ MB payloads were the audit findings on 604 concepts, 2026-06-01).
- **#38 upkeep loop (8 properties)**: none of the 8 activities landed as specified. A *different* mechanism exists:
  in-vessel `concept-db/src/upkeep/{activities,scheduler,thompson}.ts` with ids `split-long-concept`,
  `resolve-island`, `adjust-priority-relevance`, `prune-irrelevant-neighbors`, `decay-stale-relevance`,
  `prune-per-execution-concepts` — a resolver-side scheduler, not activities (law 2), invisible to the walk.
- **#39 obsidian observation layer**: seeds `observe-obsidian-events`, `group-interaction-episodes`,
  `probe-obsidian-action-effects`, `detect-recurring-pattern` exist in dev-vessel seed dir; #53 later
  "deliberately unwired" obsidian-coupled detection from the core loop ("an external app that may be disconnected
  must not gate the self-development loop"). Outcome: **superseded / dormant**.
- **#41 permissive authoring**: `draft-activity-from-pattern` + `comprehensibility_check` exist live; #54 proves one
  authored activity (`proposed_pattern_authored_prime_context`, 4/4 success). Registration-time invariants (2.3)
  status not verified. Outcome: **partial**.
- **#45 LR-3 background trace replay**: no replay code anywhere in activity-api. Outcome: **never built**.
- **#49 LR-8 signature clustering**: live — `jobs/signature-cluster-tick.ts`, `lib/cluster-posterior.ts`
  (imported by posterior-update.ts:30, execution-traces.ts:33, activities.scoring/composition/templates-db);
  `signature_cluster_run` 4166 runs 2026-06-28 → 2026-09-28 (sample: 65 signatures → 24 clusters, 2 contaminated),
  2005 assignments. Outcome: **live-used** (tasks.md still 0/45 — docs drift).
- **#46 LR-4 tier classifier**: `services/tier-classifier.ts` live, imported by posterior-update.ts:27 and three
  activities.* route modules. Outcome: **live-used**; side-effect caused #54-B starvation.
- **#51 detector recursion**: Phase A info-yield reward live (commit 3b6219294; boredom `IDLE_REWARD=0.2`,
  `src/index.ts:2873`). Phase C-bis `selector_saturation_audit` live (dev-vessel a0f1a0a, wired in boredom
  :2896/:3234). Phase D `cyclic-flow-scan` resolver + `cyclic-flow-scan-tick` seed + `detector-yield-registry` exist
  but not in boredom rotation (live-unused unless dispatched elsewhere). Phase C seeds `detector-coverage-audit-tick`
  (resolver `detector_coverage_scan`, served by `resolvers/detector-coverage-scan.ts`) and `draft-detector-activity`
  exist; C.GATE (autonomously authored detector firing with trace evidence) never recorded; Phase B OR-edge / E
  stability-trend never built. Outcome: **partial**.
- **#42 light-dispatch-vessel**: live and systemd-active; capability routing + `dispatcher_used` in boredom.
  Outcome: **worked** (second dispatcher broke the goal-host SPOF). Stage 2.A goal-host ~2 GB/dispatch leak patch
  "not applied" at the time of Stage 3.
- **#43 drop drafter source_type filter**: live `draft-activity-from-pattern.ts` no longer carries the 4-type
  whitelist (only `source_type=resolver` for vocabulary). Outcome: **worked** (tasks.md not updated).

### spend-envelope-throughput / goal-walk-floor
- #42: goal-host per-dispatch ~2 GB VmRSS leak made every multi-task LLM chain the leak ("the fix-authoring path is
  the leak. Circular."); 3/4 boredom cycles timed out. Remedy was a second dispatcher rather than the fix.
- #51 Phase A gate blocked by infra: Docker Desktop `/workspace` bind-mount wedged with EMFILE; light-dispatch
  artifact writes + trace POSTs to `/workspace` hang (location-dependence, law 11).
- #51 Phase 0.3: "235K traces hang endpoints; keep ≤ ~5K" (trace-store-db).

### selection-learning
- #51 Phase A diagnosis: boredom selector was UCB1 already, but reward = completion → **463/540 (86%) of selections
  at mean=1.0**, ~uniform 16–17 picks each. Fix: graded information-yield (productive 1.0 / idle 0.2 / error 0).
  This `information_yield` signal is now reused by `autoCloseStaleGaps` (`information_yield==="idle"`, per memory) —
  a general seam that compounded.
- LR series premise (#44, #49): "only one concept currently has non-zero empirical success/failure signal"
  (`concept_learning_currently_cold_start_dominated`, 2026-06-01); `context_thompson_scores` ~3k rows; most cells
  never see a second sample. Eight mechanisms proposed; 1,4,6,7,8 built in some form; none has a recorded
  acceptance measurement (MRR delta, regret, variance) in these change dirs.
- #44 `embedding_prior_weights`: 5128 append-only rows of 2×384 floats (170 Jun, 2092 Jul, 472 Aug, 2394 Sep);
  reader takes only the latest → trace-store-db bloat; observer flag off, but ridge rows keep being written.

### composition-crystallization
- #53 `trace_recurring_pattern_scan` (non-obsidian feeder): groups SUCCESS traces by output-shape signature,
  FNV-1a `pattern_id`, self-reference guard; goal[45] (now `boredom-vessel/src/index.ts:707`). Honest note: in an
  infrastructure-dominated substrate it is "correct-but-quiet (`has_pattern=false`)". `/workspace/patterns` holds
  128 files. Outcome: **live-used, low yield**.
- #54 generalized exercise picker: live boredom goal[9] text "execute a proposed authored activity (gap-closing OR
  any draft-activity-from-pattern output)" — A **worked**; B trace-store evidence fallback graduated 62 stuck
  activities (06-14, first hot-deployed "uncommitted / baked-image"; now present in live activities.ts:3751);
  D input-shape exercisability not addressed.

### codebase-bloat-fossils
- `boredom-vessel/src/index.js` — 228 KB, **tracked in git**, last touched by substrate landing `84cd2f2`
  ("feat: Update boredom-vessel content", 2026-09-19); unit runs `src/index.ts` (238 KB, 09-27). Stale compiled twin;
  greps hit it as if it were a caller (script-retention hazard). Also autonomous-regression class (inert landing).
- 62 `origin/substrate-authored/*` remote branches (2026-06-01 … 2026-06-29), 0 `substrate/*` — residue of #40's
  PR-based git-author model, superseded by direct substrate commits to `dev` (user.name "Substrate Autonomous").
- #40 resolvers `substrate_commit`, `substrate_push`, `substrate_open_pr`, `concept_db_snapshot` never built;
  `publish-substrate-authored-artifact` seed exists (variable `target_path`) — the path that produced those branches.
- Mvp patches committed into change dirs (`learning-rate-4/mvp.patch` 14.5 KB, `learning-rate-6/mvp.patch` 5.5 KB)
  — superseded by live code; fossils.
- 2275 runtime scenario JSONs tracked in super-repo (see narrowing-duplicates).
- 18 change dirs never archived although several are shipped (43, 46, 47, 49, 50, 52, 53) or superseded (39, 40).

### federation-p2p
- #40 Phase 3 (quorum ratification of concepts, H2 keypair signing, pubkey registry, posterior non-sharing),
  #48 ψ federation aggregation "reward stays local" — spec only, none landed.

### human-surface-escalation
- #39 obsidian as the observation surface; later judged unfit to gate the core loop (#53).

---

## Mechanisms (general vs specific; status)

| Mechanism | Location | General? | Status / evidence |
|---|---|---|---|
| `substrate_tuning_param` table + `getTuningParam` | activity-api `lib/tuning-params.ts`, migration 152 | general (law-1 seam) | live-used: rows TD_LAMBDA 0.6, SF_BLEND 1.0, YIELD_FLOOR 0.1, PROBE_NULLNONE_FIXED 3.0 |
| TD(λ) chain credit | `lib/posterior-update.ts:120-145` | general | live-used (λ via tuning row) |
| Tier classifier (skip Thompson on deterministic) | `services/tier-classifier.ts` | general | live-used; caused vpm starvation for deterministic activities (#54-B) |
| Signature clustering + cluster posterior | `jobs/signature-cluster-tick.ts`, `lib/cluster-posterior.ts`, `routes/cluster.ts` | general | live-used; 4166 runs through 2026-09-28 |
| Successor features ψ + SF blend | `lib/successor-features.ts`, `activities.scoring.ts`, `jobs/accelerator-flag-tick.ts` | general | live-used, acceptance unverified; 2681 rows |
| Embedding-conditioned prior (ridge θ) | `services/embedding-prior*.ts`, `lib/prior-seed.ts` | general | unknown/likely broken read (org_id "default" vs trace org); 5128 append-only rows |
| Background trace replay (LR-3) | — | general | never built |
| Information-yield reward (UCB) | boredom `src/index.ts:2843-2923` | general | live-used; reused by gap auto-close |
| selector_saturation_audit | dev-vessel resolver + boredom | general detector-on-selector | live-used |
| cyclic-flow-scan | dev-vessel resolver + tick seed | general | live-unused (not in boredom rotation) |
| detector_coverage_scan + draft-detector-activity | dev-vessel | general (detector recursion) | built, C.GATE never evidenced → dormant |
| gap_to_scenario_bridge classKey dedup | dev-vessel `resolvers/gap-to-scenario-bridge.ts` | specific (id-syntax heuristic) | broken: re-bloated to 4573/3364 files across two roots |
| trace_recurring_pattern_scan | dev-vessel | general feeder | live-used, mostly `has_pattern=false` |
| draft-activity-from-pattern | dev-vessel seed | general drafter | live; one proven authored activity (06-14) |
| comprehensibility_check | dev-vessel resolver | general gate | exists; used by drafter seeds / scaffold; recheck cadence env-gated |
| gh_pr_merge deriveConvergentValidity | dev-vessel | specific gate | live code, guards a superseded PR path → dormant |
| auto-promote trace-store fallback | activity-api `activities.ts:3751` | general | live-used (62 graduated 06-14) |
| auto-promote vpm_key `_`→`:` normalize | activity-api `activities.ts:3733` | specific | broken for underscore ids, still present |
| Four horizon detectors (responsibility, arch-pattern, lifecycle, resolver-distribution) | dev-vessel resolvers + ticks, boredom :635-638 | general-ish (principle concepts as predicates) | live-wired; responsibility audit read 0 principles via HTTP (unresolved) |
| Architectural principles as concepts (`architectural_pattern_principle`) | concept-db source_type | general | built (8 concepts 06-03) |
| light-dispatch-vessel | repos/light-dispatch-vessel | general second dispatcher | live-used (systemd active) |
| concept-usage-backfill | dev-vessel seed + boredom :631 | specific | live-wired, one-sided "success" signal, empty-id 404 path |
| concept-db in-vessel upkeep scheduler | concept-db `src/upkeep/*` | duplicate of proposed upkeep activities, resolver-side | live (not traced as activities) |
| concept-db supersession edges / write validators | — | general | never built |
| Obsidian L0/L1 observation seeds | dev-vessel seeds | specific | fossil/dormant (unwired by #53) |
| substrate_commit/push/open_pr, H2 signing | — | general | never built; superseded by direct push |
| publish-substrate-authored-artifact | dev-vessel seed | specific | fossil; left 62 remote branches |
| boredom `src/index.js` | boredom-vessel | — | fossil (tracked stale compiled twin) |

## Principles stated in this shard
- "Validators must emit impulses, not just return HTTP errors" — a rejection must be observable to the authoring loop (#37).
- Soft supersession, never hard delete; "Supersession with a null target IS the deprecation primitive; a second flag invites drift" (#37).
- Canonical immunity pattern for detectors: `inputShapes: []`, single resolver, no LLM, no pool iteration (#37, #38, #42).
- "Supersession fixes; upkeep prevents recurrence" (#38).
- Verdicts/corrections are first-class impulses, not markup (#38 §8).
- Deterministic dedup key before embedding clustering; start narrow so the baseline measurement means something (#38).
- "Architecture as queryable data; detection as deterministic code over that data" (#42 design).
- One LLM-capable dispatcher is a SPOF for self-modification; two architecturally different dispatchers (#42).
- Every substrate decision state-signature-conditioned, not only goal selection (#42).
- No hard-coded category whitelists — relevance gates inclusion, not an enumerated allow-list (#43, concept_7mzv7SQN_7JB).
- "Don't invent new substrate tiers" — every LR mechanism restated under impulse/activity/signature/Thompson/scope (concept_7mzv7SQN_7JB, #44–#49, #51).
- Learning rate is sample-bound, not step-size-bound: levers = throughput, targeting, sample-need reduction (#51).
- A reward of "completed" saturates; reward must be information yield (#51 A).
- Measure cyclic flow instead of ablating livelock (#51 D).
- "Substrate authored X" counts only with trace evidence (drafter provenance + firing + emitting its class) (#51, feedback_milestone_requires_trace_inspection).
- "A self-reported validity score is not evidence"; resolvers compute, LLMs reason about metadata (#52).
- An external app that may be disconnected must not gate the self-development loop (#53).
- The author→exercise→promote loop must treat every system-authored activity identically; no prefix special cases (#54).
- Substrates share authored vocabularies, never posteriors (each develops its own selection bias) (#40).
