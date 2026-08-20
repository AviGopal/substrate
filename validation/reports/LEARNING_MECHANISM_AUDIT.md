# Audit - the learning mechanism, the database, the architecture

## Verdict in one paragraph

It learns. Credit reaches the table selection reads, and I have live store evidence rather than a channel's self-report: `feature_compose` sits at α=92.87 / β=32.12 over 165 executions with **zero recorded failures** — arithmetically impossible under a binary α+=1 update, and exactly what the graded fractional update `{αΔ: y, βΔ: 1−y}` produces (`repos/activity-api/src/lib/posterior-update.ts:311-314`). What is broken is in three separable places. First, the **instruments** that report on the loop: three independent mis-attributions, each of which has already produced a published wrong conclusion, including one operator-facing surface that renders "This run taught the system nothing" on dispatches that graded (`repos/obsidian-vessel/src/views/panel-narrative.ts:628`). Second, **selection-time blindness**: an arm that succeeds mid-walk takes a full β penalty, and on one candidate route the posterior is annihilated in transit. Third, **the architecture's own stability observables are not wired to anything** — λ₁ and ρ_grow are computed into a JSONL with zero programmatic consumers, while two live governors that *call themselves* "λ₁ ≥ ρ_grow" compute two other quantities. On the master inequality: ρ_grow is **not** today's binding constraint (~4.4 mints/day against a June peak of 159/day; 2 of 47 mints since Aug 7 joined a duplicate group). The binding constraints are on λ₁ and ρ_sample — blame landing on the wrong arm, and draws spent on cold arms.

---

## Does it learn? (what is actually working)

Ten things are live, not declared. Each is verified.

1. **Graded fractional yield.** `posterior-update.ts:311-314` returns `{alphaDelta: y, betaDelta: 1−y}` where `y = floor + (1−floor)·(0.5·costScore + 0.5·productivity)`, floor 0.5 (`:251-253`). A free, zero-output trace yields exactly y=0.75. Evidence it is on in the deployment, not just in HEAD: `feature_compose` β=32.12 with 0 failures; non-integral α values (92.8696, 134662.778) that no per-execution tally produces.
2. **Decay toward the neutral prior** is real and is why β does not track lifetime failure counts: `decayedThompsonCounts` with a 3-day half-life (`posterior-update.ts:802-813`, default `:764`), applied before every delta.
3. **The graded posterior is what selection samples.** `repos/activity-api/src/db/paradigm.ts:600-641` overlays canonical α/β from `variant_performance_metrics` onto the `v_activity_score` rows. This **closes the standing memory item "the walk grades into a table nothing reads"** — it was true; it is not true of current code.
4. **Reuse-before-mint is a hard refusal, not a bias.** `repos/development-vessel/src/resolvers/activity-create-variant.ts:799-935`, default `enforce`, refuse branch returns a shaped `structuredError` with `failure_mode: reuse_existing_producer`. Verified in force: `REUSE_BEFORE_MINT` appears in no unit file and in no live process environ (`/proc/3829581/environ`).
5. **Untried arms do not draw Beta(1,1).** `repos/activity-api/src/services/discover-by-shapes.ts:40,269` substitutes `UNTRIED_PRIOR_BETA=3`; verified live — untried candidates come back `thompson_beta:3`.
6. **An empirical-badness floor exists and is the hardest sort key in all three regimes** (`activities.ts:6566-6608`): own-runs ≥20 with self-success <2% sets `sample = 0` and demotes last.
7. **Cluster pooling** gives a cold leaf a well-sampled cluster posterior instead of a uniform prior (`repos/activity-api/src/lib/cluster-posterior.ts`).
8. **The β symmetry gate is principled and firing.** `repos/goal-host-vessel/src/index.ts:9673-9683` withholds β when α would not have been reachable — "β MUST BE GATED BY THE SAME EVIDENCE STANDARD AS α, OR THE ARM CAN ONLY LOSE." The 24-of-80 abstentions observed in the dispatch store are this gate working, not a dead channel.
9. **A false reach no longer replays byte-identically** from the reached-command library: eviction appends a durable tombstone, replay applies in order (`repos/goal-host-vessel/src/reached-command-store.ts`, evict at `index.ts:3538`). **Closes another standing memory item** — for that store only (see Not measured).
10. **The three-state coverage requirement is implemented**, not merely stated: never-attempted / never-succeeded / regressed are counted separately (`repos/activity-api/src/routes/impulses.ts:5388-5469`).

---

## What is preventing growth

Ranked by effect on λ₁ ≥ ρ_grow and on R_conv ~ λ₁ · ρ_sample · κ⁻¹.

### 1. A succeeding mid-walk satisfier is graded as a failure — permanently (attacks λ₁ and κ)

Non-terminal satisfier satellites are stamped `reached:false` at construction (`index.ts:8628`) and persisted verbatim (`index.ts:10173`; sink forwards tags unchanged, `repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts:177`). `repos/activity-api/src/lib/reach-classify.ts:52-54` tests the tag branch **before** `isHollowSatellite`, so the satellite guard is unreachable; β=1 lands via the switch default at `posterior-update.ts:372-375`. The mis-grade is **permanent**: `/reach` grades only rows whose pre-verdict is `ungraded`, so the walk's later honest verdict is discarded.

Live: `satisfier:webSearchResult` α=2.12 / β=185.22 over 189 executions with **167 successes**. A live row minted today carries the signature `success:true` + `reached:false`.

*This is why it is rank 1 and not rank 1 in urgency:* the harm loop is measured-dead. `fetchSatisfierReliability` (`index.ts:5204`) reads `/variant-scores`, which returns `{"scores":[],"total":0}` for every satisfier id, so `satisfierProvenBad` never fires. This is a **landmine armed for the day that read is repaired** — `satisfier:shellResult` reliability 0.094 against a floor of 0.3 at 3,625 samples would trip instantly and suppress the walk's workhorse.

**Smallest fix:** guard the *insert* path, not the shared classifier — `reach-classify.ts`'s tag-first ordering is deliberate and pinned by `reach-classify.test.ts:58-62` because `/reach` depends on it. Either add `isHollowSatellite` at the call site (`repos/activity-api/src/routes/execution-traces.ts:2934`), or stop stamping `reached:false` on non-terminal satellites at source. The second is the prescription the codebase already wrote down: `activity-api` d95a615 built the insert-seam guard, 3e7e8e0 reverted it the same day ("the premise was wrong… stripping the tag would have destroyed the only record that a satisfier-terminal walk reached") and named the remedy as "stamping only the terminal satellite at the source in goal-host." `goal-host` eca7c8a landed that for the *terminal* trace. The non-terminal case is the residue.

### 2. The posterior is annihilated in transit on the recommend route (attacks λ₁)

`/v2/activities/recommend` emits α/β/score **only** inside `selection_metadata` (`activities.ts:6614-6704`). `goal-host-vessel` reads `selection_metadata` **nowhere** — zero grep hits across its `src` — and `readCandidateShapes` (`index.ts:5987-5993`) reads only top-level and `metrics.*`. Every recommend-sourced `WalkCandidate` therefore has `alpha`/`beta`/`sampledScore` undefined, and two gates cannot fire: the proven-bad-composite rejection (`index.ts:8788-8792`) and `scaffoldRank`'s −1 learned-pathway reuse promotion (`repos/goal-host-vessel/src/producer-pick.ts:34`). Confirmed live against the hub: recommend rows carry no top-level posterior; `discover-by-shapes` rows do.

Second instance of the same mismatch, not previously filed: `index.ts:14157` `const topScore = top?.score ?? 0` — always 0, so the `topScore >= exploreFloor` branch at `:14171` is dead and the auto-draft gate always falls through to `autoDraft`, the inverse of intent.

Scope correction: recommend is the **fallback** (`index.ts:8677`, guarded by `candidates.length === 0`), and it pre-sorts by `selection_metadata.score`, so ordering partially survives. The hard rejection and the reuse promotion do not.

**Smallest fix:** ~3 lines in `activities.ts` mirroring `discover-by-shapes.ts:288-299`, which already attaches `sampled_score` top-level with a comment naming `readCandidateShapes` as the consumer.

### 3. Pool membership is decided by exit status, not by reach (attacks λ₁)

`exploitationPool.sort` keys on `b._ucb_score − a._ucb_score` when the ψ blend is inactive (`activities.ts:6830-6838`), and `_ucb_score = ucbScore(total_executions, successes)` (`:6611-6613`, fn `:6305-6309`) reads the **v_activity_score exit-status columns**. The paradigm overlay deliberately replaces only α and β (`paradigm.ts:600-641`) — its own comment records status 92.4% green against honest reach 1.67% at n=41,600. The column the overlay exists to neutralize is the column UCB reads.

This is not confined to the default regime: `head = exploitationPool.slice(0, headSlots)` (`:6839-6841`) runs **before** the `expected_output_shapes` re-sort, so exit-status UCB gates membership of the emitted list in every regime; the graded posterior can only permute a list exit status already selected. The trace still labels the decision `method: 'thompson_sampling'`.

**Smallest fix:** overlay `successes`/`failures` in `paradigm.ts:600-641` alongside α/β, or compute the UCB mean as α/(α+β). Large blast radius — land it behind a tuning param and watch the reach rate.

### 4. Cold arms dilute the draw per shape family (attacks ρ_sample)

995 of 2,424 templates (41.0%) have no executions. The global "44% at Beta(1,1)" is a storage artifact — 912 of those rows have no metrics object at all and are drawn at Beta(1,3) — but the per-family live measurement is worse than the global number suggests: for `patch`, **26 of 28 candidates are untried and 14 draw at uniform** (median max-of-14 uniform draws ≈0.95; a learned arm essentially never wins). For `activityExecutionSummary`, 55 of 68 untried. `discover-by-shapes.ts:195,200` filters only `retired` — **`proposed=true` drafts are draw-eligible** — and the 860 epoch-suffixed re-drafts do not match `producer-pick.ts`'s `isHollowScaffold` regex, so they compete at full rank.

**Smallest fix:** exclude `proposed=true` from the draw path (one WHERE clause). The `proposed-for-exercise` backlog (199 across 18 classes) already gives proposed arms a first-run route; it does not cover the ~126 non-proposed ungraded arms.

### 5. The admission cap truncates by recency before the draw (attacks λ₁)

`discover-by-shapes` sets `ADMISSION_CAP = 200` and admits via `ORDER BY ev DESC, created_at DESC LIMIT $admission_limit` **before** the per-candidate Thompson draw; the comment states `ev` is ~flat, so this degenerates to recency truncation. `patch_proposal` has **522 producers** — the only shape over cap, at 2.6×. ~322 producers, including any learned high-posterior one that is not recent, never reach the draw. This is the real cost the "72% duplicate signatures" statistic was gesturing at, stated at the granularity that actually governs candidacy.

### 6. Duplicate stock (attacks λ₁; **not** ρ_grow)

131 groups / 1,012 rows are duplicates **by the code's own `selectDedupTarget` predicate** (identical normalized name AND identical shape signature, `activities.ts:167-180`). The mint-dedup gate is inert — entry-gated on `/-\d{10,}$/` (`:145`, gate `:794-796`), and only 5 of 2,424 rows carry such a suffix. But this is **frozen stock, not accumulation**: duplicate-group members by day are 0 from 08-07 through 08-16 and 2 on 08-17 — 2 of 47 recent mints. The gate's inertness is documented in-code at `:781-793` and was widened once and reverted for a named cost. Fix by a one-off merge, not by changing the gate.

### 7. The stability observables are unlearnable (law 1)

`scripts/substrate/spectral-gap.ts:280-300` computes `lambda1_for_inequality`, `rho_grow`, `stability_headroom`, `stability_ratio`, `inequality_holds` and persists them with `await Bun.write("/workspace/metrics/spectral-gap.jsonl", …)`. No shape exists — the live registry returns 305 shapes with no spectral/lambda/fiedler/rho/headroom entry, and direct resolves return `Unknown pointer type`. The codebase flags this itself: `scripts/substrate/autonomy-status.ts:451` — "⚠ NOT SHAPE-VISIBLE." Also, because `spectral-gap` is role `store` (`vessels.inventory.json:266,351`) and excluded from `roles.spoke`, the fail-closed gate at `generative-frontier-gap-tick.ts:165` returns `spectral_signal_unavailable` permanently on a spoke.

Adjacent, same class: `SIGNATURE_CLUSTER_N_MIN` (`activities.ts:188`) is a Thompson pooling hyperparameter frozen by `parseInt(process.env…)` at module init, in the same file where six sibling hyperparameters already route through the shaped `substrate_tuning_param` channel (`getTuningParam` at `:6078, :6087, :6167`).

---

## Unused wiring

| What | Declared where | Written by | Read by | Verdict |
|---|---|---|---|---|
| `fiedler_lambda2`, `star_ratio` | DYNAMICS §3/§4 | `spectral-gap.ts` → JSONL | `generative-frontier-gap-tick.ts:99-112`, `compose-topology-tick.ts:212`, `pick-priority-scenario.ts:180` (by absolute path) | **Live**, but file-only — no shape, does not cross a vessel or federation boundary |
| `lambda1_for_inequality`, `rho_grow`, `stability_headroom`, `stability_ratio`, `inequality_holds` | DYNAMICS §3/§4 — the master inequality | `spectral-gap.ts:280-300` | **Nothing.** Grep: only a prose mention at `compose-teacher.ts:196` | **Dead.** The one correct implementation of the inequality is orphaned |
| `impulse_shape_activity_score` | `schemas.ts:1854` | goal-host feedback ×2 (`index.ts:5128, :5318`) → `activities.ts:5494/5525` | No selection reader. Every reference is a write, UPSERT, DEFINE, test, or a SELECT nested in its own UPSERT | **Dead** — and `activities.ts:5577-5580` says so in-code |
| `relevance_score` forward arm | FOUNDATION:589-627 | relevance-sink, propagate-judgment, ribosome, concept-db | `repos/activity-api/src/utils/impulse-relevancy.ts:53-70` via `/recommend` (`activities.ts:6244`) | **Half-live.** `loaded_impulses` defaults `[]` (`:5791`) and no goal-host caller sends it, so only the penalty branch can fire from a walk |
| `times_failed` | `repos/relevance-sink-vessel/src/index.ts:20-22` | relevance sink | Nobody — the reader selects `times_loaded` / `times_execution_*` | **Dead**, write≠read key mismatch |
| Impulse-pool selection (the arm FOUNDATION actually names) | FOUNDATION:589-627 | — | `repos/ias-executor-ts/src/resolvers/impulse-pool-selection.ts:8-15` — a self-declared degraded stub returning the first shape match | **Not built** (acknowledged deferral, not silent breakage) |
| `lib/selection/choice.ts` Choice/Selector framework | itself | — | `activities.ts:6876-6880`, only when `body.selector !== 'thompson'`; no caller sends the field | **Unreachable** |
| `THOMPSON_DECAY_HALFLIFE_DAYS` tuning row | `substrate_tuning_param` | operator/substrate | Sync path only (`posterior-update.ts:917`). The live coalescing flush omits the arg (`posterior-aggregator.ts:188`) and takes the hardcoded 3 | **Authored value inert on the path that runs** |
| `proposed` quarantine flag | `activities.ts:508-513`, `schemas.ts:250-253` — both say substrate-authored writes set it | Nobody on the ribosome path (zero `proposed` hits in `impulses.ts`, `ribosome-extract.json`, or the executor/ribosome/goal-host write path) | `discover-by-shapes` filters only `retired` | **Documented-but-unset**: learned templates land directly selectable |
| Mint dedup | `activities.ts:792-800` | — | Entry-gated on `/-\d{10,}$/`; 5 of 2,424 rows match | **Inert**, documented, deliberately reverted once |
| `alphaBetaDelta` | `index.ts:5943` | Only `:9683`, `:9820` — of eight grading sites | `panel-narrative.ts:628`, `graph-backbone-sync.ts:241`, `goal-note-manager.ts:263` | **Wired but 2/8 written**; consumers assert falsehoods off it |

---

## Incorrect attribution

**1. The reported delta and the measured store movement are different tables.** `alphaBetaDelta` describes goal-host's `POST /v2/activities/feedback`, whose only posterior writes are to `impulse_shape_activity_score` (`activities.ts:5493-5535`); its `variant_performance_metrics` write was deliberately removed with the split documented in both repos ("posterior grading delegated to POST /reach (sole VPM grader)", `:5537-5605`). `thompson_posterior` reads VPM. **Neither number describes the other** — this is exactly how "learning is one-directional" got published twice. The split is designed; what is not designed is `panel-narrative.ts:628` turning an empty array into "This run taught the system nothing: no selection posterior moved."

**2. The field is wrong about its own channel.** `creditReachedTemplate` returns a hardcoded `dAlpha: res.ok ? 2 : 0` (`index.ts:5325`) while the handler adds `increment = 1 + intensity = 3` (`activities.ts:5277`). Worse, that UPDATE's WHERE clause has **no shape filter**, so it increments every shape row for the activity — a single scalar `dAlpha` is not a well-defined quantity. And `penaliseHollowTemplate` still returns `dBeta: 2` **unconditionally** at `:5196`, on the branch that just logged "beta-penalty REJECTED (404) … penalty not applied." Note: `validation/reports/POSTERIOR_DIVERGENCE.md:56` asserts this was repaired in 5be4cfa as `dBeta: _betaApplied ? 2 : 0`. **No `_betaApplied` exists anywhere in the live tree.** A validation report is claiming a fix that is not there.

**3. The posterior cannot be read by the id the dispatch record publishes.** goal-host records `selectedTemplateId` as `activity:<name>`. The write path normalizes that prefix (`posterior-update.ts:823-825`); the read path does not (`impulses.ts:1463`). Live, same key, same session:
- `activity:proposed_pattern_authored_http_llm_file_chain` → α=1, β=1, n=0
- `proposed_pattern_authored_http_llm_file_chain` → α=8.98, β=30.03, n=342

Both HTTP 200. A 342-execution arm and a never-tried arm are returned as the same object.

**4. And the miss is silent, uniquely.** For an id with no row, `thompson_posterior` synthesizes `{alpha:1, beta:1, sample_count:0, scope:"global"}` and returns 200/`loaded:true`. `scope` is **not** a discriminator — both scope branches are gated on `total_executions > 0`, so three distinct states (absent row / registered-but-never-run / real global baseline) share one label. The sibling shapes over the same table answer loudly for the same id: `activityMetrics` → 404 "Activity metrics not found", `activityTemplate` → 404. This is the shape the operator access recipes name as the canonical credit-flow read.

**5. A refusal envelope was graded as a fulfilled goal.** Dispatch `d7dba380-50f7-4861-bd86-70c835671712`: `reached=true`, reason "The output recalls details about gap_compose, fulfilling the request", over a body the walk log shows verbatim as `{"ok":false,"verdict":"REFUSED"}`. The decisive evidence is self-contradiction on identical content in one dispatch — the byte-identical 362-char body arrived first under shape `feature_compose`, was refused by the body-honesty gate ("envelope declares failure: ok: false") and graded HOLLOW; re-framed, it returned under `gap_compose`, was pooled with no gate, and graded REACHED. The honesty grader `_degenerateReason` (`index.ts:7298-7320`) is wired **only** to the `direct` route (`:7911-7927`); the route that pooled it is `vesselResolveShape` (`:8530-8577`), whose only gate is `emptyResultSetReason` and which the code's own comment measures as carrying **~63.5% of recorded pathway steps**. Credit and mint were correctly withheld — but `goalPathRecorded=true` persisted a `reached=true` row into `goal_execution_paths`, which `recommendReachingPath` (`:11254`) reads at selection time to drive reuse-before-derive.

**6. Two governors wear a name that belongs to a third quantity.** goal-host's mint governor (`index.ts:5081-5099`) calls `learning_transfer_report.genuine_edge_density.inequality_ok` "the live lambda1 >= rho_grow signal." That field is `genuine_edges/total >= uninformed/total` — same denominator, so simply `genuine_edges >= uninformed_cells` (`learning-transfer-report.ts:74,102,112`), and `:156` files it under the key `lambda1_inequality_ok`. `generative_frontier_gap_tick` documents itself as enforcing "λ₁ ≳ ρ_grow" and gates on `fiedler_lambda2 · (1 − star_ratio) >= 0.35` — a third formula that never references ρ_grow. The two definitions of "uninformed" also disagree: `total_executions = 0` vs `thompson_alpha ≤ 1.05 AND thompson_beta ≤ 1.05` (`spectral-gap.ts:83-85`).

**7. `kappa-spread` is not κ(⋆).** `repos/development-vessel/src/resolvers/learning-policy.ts:59-69` computes max−min of posterior **means** α/(α+β). DEC §4.1 defines κ(⋆) as a condition number over posterior **precisions** (α+β). A population with identical means and wildly different sample counts is well-conditioned by the proxy and ill-conditioned by the definition. It drives five live Thompson hyperparameters.

---

## Intent vs code vs practice

**Docs prescribe, code does something else.** DYNAMICS §4 says "gate drafting and vessel-spawning on spectral-gap headroom." Only `generative_frontier_gap_tick` gates, and on a formula that is not the prescribed inequality; the prescribed inequality is computed and read by nothing. R_conv ~ λ₁ · ρ_sample · κ(⋆)⁻¹: **λ₁ is file-only, ρ_sample is uncomputed (zero grep hits for any sample-rate term), κ(⋆) is proxied by a different quantity under the same name.** Reward saturation is the one stall regime in §6 with a real instrument (`learning-policy.ts:71-78`). The system can state the theory; it cannot evaluate it, so no change can be shown to have improved the rate the docs say growth work is judged on.

**Code documents an invariant it does not implement.** `activities.ts:508-513` and `schemas.ts:250-253` both state that substrate-authored writes (ribosome, make-activity) set `proposed=true` to stay out of the Thompson pool. Nothing on the ribosome path sets it. The write door itself is real and live: `case 'activityTemplate_write'` (`impulses.ts:2567-2631`) does a fence-tolerant parse and delegates to `POST /templates` with no producer probe, and `ribosome-extract.json:174` posts to it with `applyExtraction:true` forced by two callers (`index.ts:5852`, `repos/ribosome-vessel/src/index.ts:230`). *Do not "fix" this by copying the reuse probe here* — the extracted template declares its parent's output shapes, so an enforce probe would refuse nearly every extraction and disable law-4 minting. Sprawl is bounded anyway by the deterministic `learned-<parent-slug>` id and a 409 on duplicates (though the goal-host comment at `:5847` claiming the write "UPSERTs and refines" is contradicted by that 409).

**Code implements, practice does not show it firing.** Chain credit is written — TD(λ)=0.7, depth cap 4, sibling-fanout averaging, `writeAncestorDelta` at `posterior-update.ts:503-535`, reached via `execution-traces.ts:2945`. I could not observe it fire: `composition_chain` was null on the live satisfier row inspected, and composition ancestors are high-volume tick templates whose posteriors are dominated by their own direct executions. λ₁ *is* "credit propagated to ancestors"; the mechanism is written and unconfirmed.

**Where the auditors disagreed — stated, not averaged.**

- *Duplication.* The auditor reported 72% of templates sharing a shape signature and called it a growth blocker. Verification: 42% by the code's own duplicate predicate; the grouping key (input→output) is **not** the candidacy key (`discover-by-shapes.ts:196` filters on `output_shapes CONTAINSANY` only), so the largest evidence block (~477 rows producing `patch_proposal`) is the compose path's shared I/O contract holding genuinely distinct capabilities, not clones. The auditor also mis-dated its headline cluster (185 ladderwalk rows are 2026-06-24/26, not 08-17). **I side with the auditor on the stock existing and with verification on it being frozen and mis-keyed.**
- *Relevance forward arm.* The auditor concluded "no selection-time reader exists in any vessel" — after a grep that excluded `activity-api`, the one vessel containing the reader (`impulse-relevancy.ts:53-70`, called at `activities.ts:6244`, folded into the sampled Beta at `:6438-6440`). The finding survives only in narrowed form (see the table).
- *Reach rate.* An auditor read 8% reached against the ~90% execution expectation. The traffic mix is 44% one broken background delivery job plus 15 dispatches that never entered a walk. The journal's own tally over the same window is ~10%. The number is real and worth tracking; **it is not comparable to the expectation as written**, and the credit half of that finding was refuted at the store.
- *Satellite grading.* One auditor filed the tag-first insert path as a bypass of `/reach`'s satellite exclusion. It is not: d95a615 built that guard, 3e7e8e0 reverted it the same day with a live counter-example, and goal-host eca7c8a is the prescribed replacement — which stamps only the terminal trace. **That history is exactly why the non-terminal case is a live residue and not a re-litigation.**

---

## What was NOT measured

- **This box is a federated spoke and masks `activity-api`.** `curl 127.0.0.1:18080/health` → 000. Every store number above was read from the hub (`syzygy.host` / `104.236.0.175:18080`) or through discovery at `:18100`. An empty read through the masked port is indistinguishable from "nothing recorded" — confirm which copy before trusting any store claim.
- **Live tuning-param values.** `SF_BLEND`, `EMPIRICAL_BADNESS_FLOOR`, `THOMPSON_DECAY_HALFLIFE_DAYS`, `CROSS_SIG_REPUTATION_PENALTY` are asserted at their code defaults only. `src/jobs/accelerator-flag-tick.ts:50-68` monotonically flips `SF_BLEND` **on** once `successor_features` reaches 200 rows, so "off by default" is not a safe assumption about the running hub.
- **The deployed `thompson_posterior` handler's source is not in this checkout.** The live response carries `signatures_aggregated`, `signature_version` and `scope`, which appear in no file in the tree; the vendored `repos/deployment/vessels/metabob-activity-api` copy provably is not what runs. All read-path claims are HEAD-plus-type-doc, not deployed source.
- **Whether chain credit fires** (see above). Needs an instrumented dispatch with a known chain.
- **Whether `goal_execution_paths` pathway reuse evicts on `reached:false`.** The reached-command JSONL does; the pathway store is unchecked — and finding 5 above put a false-reach row into it.
- **`impulse_relevance_metrics` table population** — unreachable from here.
- **The gap `the-mint-dedup-gate-requires-a-timestamp-suffix-that-no-new-mint-carries`** could not be confirmed: a 709-gap local resolve returned zero matches, but the query may be status-filtered and the hub's dev-vessel was not queried. Absence not established.
- **Template pagination has no stable tiebreak** — two full pulls of 2,474 rows yielded 2,424 and 2,474 uniques. Group counts carry ±~2%.
- **`spectral-gap.service/.timer` are role `store` and masked here**; the producer's hub-side behaviour is unmeasured (no SSH to the hub — every fix landing in git remains unexercised in production until an operator deploys).
- **All dispatch percentages are over a sample frame, not a census.** `executionStore` is an in-process Map capped at 100 with 20-oldest eviction (`index.ts:15306`, `:15443-15446`), snapshotted every 5s; interrupted dispatches are deleted outright on requeue (`:15344`). Read every dispatch statistic as "of the 87 records the store currently holds."

---

## The smallest set of changes that would most raise the growth rate

**1. Stop grading non-terminal satellites as failures.** *(one guard + one test)* Add `isHollowSatellite` at the insert call site (`execution-traces.ts:2934`) — **not** in the shared classifier, whose tag-first ordering `/reach` depends on and a test pins — or stop stamping `reached:false` at construction (`index.ts:8628`) and stamp only the terminal trace. Unblocks: β stops being noise on the highest-traffic satisfier arms.
**This must precede #2.** Repairing the reliability read while the posteriors are poisoned would immediately suppress `satisfier:shellResult` (0.094 against a 0.3 floor at 3,625 samples).

**2. Repair the satisfier reliability read.** *(one endpoint/key alignment)* `/variant-scores` returns empty for satisfier ids, so `fetchSatisfierReliability` always returns null and `satisfierProvenBad` never fires. After #1, this converts a landmine into a working avoidance gate.

**3. Emit the posterior top-level from `/recommend`.** *(~3 lines, mirroring `discover-by-shapes.ts:288-299`)* Unblocks the proven-bad-composite rejection, the learned-pathway reuse promotion, and the dead autoDraft branch at `index.ts:14171`. This is the mechanism by which learning compounds — a pathway the learner has proven currently cannot be promoted ahead of fresh re-derivation.

**4. Make UCB read the graded posterior.** *(small diff, large blast radius)* Overlay `successes`/`failures` in `paradigm.ts:600-641`, or compute the UCB mean as α/(α+β). Land behind a tuning param and watch the reach rate. Unblocks: a 92.4%-green exit-status column stops gating admission to the emitted candidate list in every regime.

**5. Fix the three attribution instruments — before you try to verify #1–#4, because each is the instrument you would verify with.** *(trivial each)*
 (a) Push the return of `index.ts:12229/:12233` and the four compose-path penalties into `opts.learningSink`, as the walk path already does.
 (b) Normalize the `activity:` prefix on the read — in HEAD that is one `normalizeActivityId` call at `impulses.ts:1463`, **but the deployed handler is not in this checkout, so verify before assuming the one-liner lands.** Add `posterior_source: "stored" | "prior"` so a key miss is loud instead of returning a maximally-explorable fabricated prior.
 (c) Return the handler's actual increment instead of the hardcoded 2, and make `:5196`'s `dBeta` conditional on the POST outcome. While there: `POSTERIOR_DIVERGENCE.md:56` claims this is already done — correct the report or delete the claim.

**6. Exclude `proposed=true` from the draw path** (`discover-by-shapes.ts:195,200` filters only `retired`), and extend the exerciser beyond the proposed set to the ~126 non-proposed ungraded arms. *(one WHERE clause + backlog work)* Unblocks ρ_sample: stops 26-of-28 cold candidates diluting the `patch` family.

**7. Raise or re-key the admission cap for `patch_proposal`** — 522 producers against `ADMISSION_CAP=200`, truncated by recency before the draw.

**8. Only now touch minting.** ρ_grow is ~4.4/day against a June peak of 159/day, and duplicate accrual is 2 rows in 13 days. **Throttling mints before #1–#4 land throttles a system that still cannot tell a good arm from a bad one** — that is the ordering error this list exists to prevent. What *is* worth doing on the stock side is not a gate change: a one-off merge of the 131 same-name/same-signature families (1,012 rows), and setting `proposed=true` on the ribosome write path, which that path's own code already documents as its behaviour.

**9. Shape the observables (law 1).** Give λ₁, ρ_grow and headroom a shape, and then either make the two live governors read it or stop calling them "λ₁ ≥ ρ_grow." Also move `SIGNATURE_CLUSTER_N_MIN` onto `getTuningParam`, six lines from where its siblings already are. This is conformance, not throughput — do it last, but do it: it is the only way the effect of #1–#8 can ever be stated in the architecture's own terms, and until then no claim about the convergence rate is falsifiable.

**Per law 6, the detector each fix implies.** #1: an assertion that no persisted trace carries `success:true` with `reached:false`. #3 and the `times_failed` row: a producer/consumer key-parity check over emitted response keys vs consumer reads — this class has now recurred at five independent sites and no detector exists for it. #5b: a resolver contract test that every shape answering by id fails loudly on an unknown id, which two of three siblings already do.