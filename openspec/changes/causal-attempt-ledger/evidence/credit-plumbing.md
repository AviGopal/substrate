# Consequence verdict into credit: source research (read-only, 2026-09-22)

Scope: `openspec/changes/2026-08-26-consequence-verdict-into-credit/proposal.md` (1 file, 90 lines,
single commit `fe00585e`). No edits, no dispatches. The metabob MCP was unreachable, so everything
below comes from source plus direct DB reads.

**TRAP HIT (read first):** `repos/activity-api/src/routes/impulses.ts`, `execution-traces.ts`,
`lib/posterior-aggregator.ts`, `lib/cluster-posterior.ts` contain raw NUL bytes. Plain `grep`
treats them as binary and prints **nothing**. `git show` prints "Binary files differ" unless you pass `--text`.
My first grep found "no goal_verification_label handler in impulses.ts", which was false. Use `grep -a` / `rg`.

```
grep -rlaP '\x00' repos/activity-api/src --include=*.ts | grep -v test
# src/lib/posterior-aggregator.ts src/lib/cluster-posterior.ts src/routes/impulses.ts src/routes/execution-traces.ts
```

DB helper used (read-only):
```sh
# evidence/helpers/surql.sh : stdin = SurrealQL
docker exec -i substrate-live sh -c '. /etc/substrate/env; curl -sS -m 180 -X POST \
  -u "$SURREALDB_USERNAME:$SURREALDB_PASSWORD" -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" -H "Accept: application/json" --data-binary @- http://127.0.0.1:8000/sql'
```

---

## 1. Status of the change

### Reader: NOT implemented anywhere
```
grep -raln "goal_verification_label" repos/*/src --include=*.ts | grep -v '\.test\.'
```
Readers found. None writes a posterior:
- `activity-api/src/routes/impulses.ts:2847` `case 'goal_verification_label'` is a query surface
  (`SELECT * FROM goal_verification_labels [WHERE verdict/execution_id/goal/activity_id] ORDER BY created_at DESC LIMIT $limit`, :2876).
  It only returns rows.
- `goal-host-vessel/src/index.ts:16183` `maybeConsumeOracleLabel` fetches the newest label for
  `record.executionId` (limit 1, :16201). Only a **human** label is applied, and only to
  `record.reached` in memory (:16229-16231). It files an oracle-disagreement gap (:16239). It explicitly
  **refuses** to write a posterior (:16189-16192):
  > "reach is NEVER posterior-written — the arm already earns reach credit via v_shape_conditioned_score
  > (FROM execution.success), so re-writing a β would double-count"
- `obsidian-vessel/src/sync/improvement-sync.ts:128` is a display read.
- `repos/activity-api/src/lib/posterior-update.ts` has zero references to labels:
  `grep -ac goal_verification repos/activity-api/src/lib/posterior-update.ts` → 0.

### Writer gap: filed, then closed by EXPIRY (not repaired), now pruned from the live store
- Live store `/workspace/git/super-repo/gaps/gaps.json` (4,655 gaps, copied out with `docker cp`):
  the id `consequence-verdict-writer-missing-for-goal-verification-labels` is **absent**.
- The record survives in the super-repo `tmp_gaps.json` (committed in `e72a7fc8`, 2026-09-13):
  ```
  status: closed   source: substrate_detected   detected_at: 2026-08-26T08:52:58Z   closed_at: 2026-09-07T01:19:49Z
  summary: "[expired by gap_lifecycle_scan] No writer emits consequence verdicts ... untouched for 120h.
            NOTE: this checks GAP AGE ONLY ... this closure is not evidence of repair."
  classification_metadata: closed_reason=expired_not_redetected, closed_by=gap_lifecycle_scan,
            edit_site=repos/development-vessel/src/resolvers/consequence-verdict-emit.ts,
            failed_attempts=2, mispredicted_lands=1, falsifier=none
  ```
- The edit_site file does not exist on the host (`ls repos/development-vessel/src/resolvers | grep -i consequence` → none)
  or in the container (`/workspace/git/vessels/development-vessel/src/resolvers`). No `consequence`
  emitter exists in any repo.
- Operator memory (`reference-decomposition-echoes-its-parent-and-the-consequence-emitter-is-blocked-2026-09-05.md`)
  records 14 attempts across echo-gaps. Both blockers were in the spec itself: (1) the spec ordered
  the emitter to import the type from dev-vessel's `impulses.js`, but activity-api serves it → TS2305;
  (2) the spec said "do not wire it in" → zero callers → the semantic gate refused the change as dead code.
  Discrepancy: the memory says `operator_detected`, while the record says `source: substrate_detected`.

### Decision A vs B: none taken
No code exists for either option. The proposal has had one commit (`fe00585e`) and nothing since.

### Cited commits
| sha | repo | date | what |
|---|---|---|---|
| `ea78fd7` | goal-host-vessel | 2026-08-25 | "fix(reach): spool lost reach-verdicts durably instead of dropping them". Transport retry spool `/workspace/.reach-verdict-spool.jsonl`. "Delivery reliability only — grading semantics … untouched." Operator direct change. |
| `03e6c55` | activity-api | 2026-08-24 | "feat(learning): read decision_outcome — /decision-calibration". A read-only endpoint `GET /v2/activities/execution-traces/decision-calibration`. Kept read-only because "folding the table back into the Thompson credit path would double-count by construction." |
| `a885631` | metric-collector-vessel | 2026-08-21 | Substrate-authored `route-edit-f79ac530` cutover (the proposal's dispatch-identity example). |

---

## 2. `propagateCreditAlongChain`

- Location: `repos/activity-api/src/lib/posterior-update.ts:755`. Its only caller is `applyOutcomeToPosteriors` at
  :1344-1362, fire-and-forget, gated on `!ungraded && trace.composition_chain.length > 0`.
- Signature:
  ```ts
  export async function propagateCreditAlongChain(execution: ExecutionForChainCredit, db: DBQueryable, orgId: string): Promise<void>
  // ExecutionForChainCredit (:204): { activity_id; composition_chain: string[] (root-first, ancestor EXECUTION ids);
  //   success: boolean; failure_mode?; ancestor_signatures?; sibling_group_size? }
  ```
- Mechanics (:760-841):
  - It reverses the chain, caps depth at `CREDIT_PROPAGATION_MAX_DEPTH=4`, and uses `λ = resolveTdLambda()`
    (tuning row, default 0.7).
  - It skips `resolveCreditPropagationExclusions(db)`.
  - `siblingDivisor = max(1, sibling_group_size)`.
  - It resolves ancestor exec ids → `variant_id, signature, signature_version` via
    `SELECT … FROM v_paradigm_execution_traces WHERE execution_id IN $ids`.
  - If `success`, α += λ^d/k. If `cascading`, β goes to depth 1 only. Otherwise β += λ^d/k.
- What it writes (`writeAncestorDelta`, :633, module-private):
  1. `variant_performance_metrics.thompson_alpha/thompson_beta`, through `enqueueVariantDelta` (the coalescer,
     `posterior-aggregator.ts`). The flush (:171-199) applies **write-time decay** first:
     `decayedThompsonCounts(stored, updated_at)` + Σδ. With coalescing off, it falls back to a sync `UPDATE … (thompson_alpha ?? 1) + $alpha_delta`.
  2. When an ancestor signature exists: `context_thompson_scores.alpha/beta` keyed by
     (org_id, template_id, signature_version, context_bucket). This path does
     `n_observations = n_observations + 1` unconditionally, or CREATEs a row seeded from `seedPriorFromConcepts`.
  3. `applyClusterPosterior` (the cluster bucket `cluster:<id>` in context_thompson_scores), fire-and-forget.
- **Idempotency: none inside the function.** It keeps no record of which (execution, ancestor) pairs it has credited.
  Calling it again with the same execution double-credits. The only guard is at the call sites:
  - `/reach` (`execution-traces.ts:5238`) skips when `tags` contains `reach_graded:true`. It stamps that tag
    **before** crediting (:5258-5261). This is a check-then-act on a pre-read, so two concurrent POSTs for the
    same id can both pass.
  - The insert path (`execution-traces.ts:3509`) has no marker. It relies on classifyReach returning
    'ungraded' for untagged goal-host rows.
  - Hazard noted in comments at :5243-5253: `/reach` was widened to also grade pre-verdicts of
    'reached'/'not-reached'. A row inserted *with* a reach tag (so already graded at insert) but without
    `reach_graded:true` would be graded again. The comment claims "provably never been credited".
    I did not verify that against data.
- **Negative/correcting delta: not supported by the public API.** `success: boolean` produces only non-negative
  α or β increments (`decayFactor/siblingDivisor`). `writeAncestorDelta` would arithmetically accept a negative
  number (no clamp in the VPM path, the context_thompson_scores path, or `cluster-posterior.ts`:
  `grep -an "math::max\|< 0\|Math.max" src/lib/cluster-posterior.ts` → none). But:
  - α could fall below 1 or reach ≤0. goal-host `beta-sample.ts` `gammaSample` returns 0 for shape ≤0,
    which silently breaks draws.
  - `n_observations` would increment on a reversal.
  - **Exact reversal is impossible.** Stored counts decay toward (1,1) at write time (aggregator flush;
    context_thompson_scores UPDATE, :1238-1239) and at read time (/recommend `decayRow`). The α banked at
    reach time no longer exists as a recoverable quantity. Option A would have to re-derive the decayed
    residual `λ^d/k · 2^(-Δt/halfLife)`, which drifts because each later write re-decays the whole row.

---

## 3. `activityFeedback_write` and `goal_verification_label_write`

### activityFeedback_write
- Shape case: `impulses.ts:2661`. It delegates `pointer.feedbackData` to `POST /v2/activities/feedback`
  (`activities.ts:5324`).
- Contract: `ActivityFeedbackRequestSchema` (`models/schemas.ts:1922`) =
  `{activity_id, direction: positive|negative, intensity 0-3, include_adjacent?, session_id?, reason?}`.
  **There is no execution_id and no idempotency key.**
- Writes: **only** `impulse_shape_activity_score.alpha/beta += 1+intensity`, capped at 1e6
  (activities.ts ~5612-5645). It may also CREATE a satisfier `activity` row plus its score row.
  Negative feedback whose reason matches environmental signatures abstains (:5383).
- **It does NOT touch the posteriors that selection reads.** The "SINGLE-WRITER SEAM" comment (activities.ts:5674-5718)
  says the `applyOutcomeToPosteriors` call was removed so `/reach` is the sole VPM grader. It also says
  `impulse_shape_activity_score` has **no selector reader**, and the grep agrees: every SELECT on it is inside
  its own read-modify-write (paradigm.ts:1831-1840, activities.ts:11232) or inside /feedback itself.
- Producers: goal-host `penaliseHollowTemplate` (index.ts:5613, negative/2) and `creditReachedTemplate`
  (:5832, positive/2); workbench `useTeachingFeedback.ts:129`.
- Row count: `impulse_shape_activity_score` has 13,393 rows. The feedback events themselves are not persisted
  as rows, only as the counter increments.

### goal_verification_label_write
- Shape case: `impulses.ts:2893`. Required fields: `goal, execution_id, activity_id, verdict ∈ {achieved,
  not_achieved, partial}, confidence, labeler ∈ {human, automated, deterministic}`. Optional grounding fields:
  `asserted_at, source, probe, expected, observed, evidence`. `grounded` is derived server-side
  (source ∈ git/filesystem/process/http/journal/human, plus probe, expected and observed all non-empty).
- Storage: `CREATE goal_verification_labels CONTENT {…}` (:2997). Schema: migration 101, extended by 183
  (labeler) and 192 (grounding). **Append-only:** `PERMISSIONS … FOR update NONE, FOR delete NONE`.
  The indexes `idx_gvl_org_execution(org_id, execution_id)` and `idx_gvl_org_activity` are **not UNIQUE**, so the
  table has **no idempotency key**. Replays and retries add rows.
- Producers:
  - goal-host `recordDeterministicLabel` (index.ts:3800) is fire-and-forget and writes deterministic verdicts only
    (`if (!det) return`). Call sites: :5086, :10674, :12427-12433, :13092, :13253, :13572, :16922.
  - human-surface `proxy.ts:902`, obsidian `main.ts`/`goal-dispatch-view.ts`, workbench.
- Live corpus (`SELECT labeler, verdict, count() … GROUP BY labeler, verdict`):
  ```
  total 9118   oldest 2026-07-02   newest 2026-09-23T01:19Z   last-24h 398
  deterministic: 1118 achieved / 6439 not_achieved
  human:         457 achieved / 518 not_achieved / 107 partial
  automated:     77 achieved / 402 not_achieved
  grounded: false 7968, null 1150, true 0      source: null 9118/9118
  distinct execution_id 8896; ids with >1 label 98 (max 25 on universal-tool-fallback:8eec96f4); ids with conflicting verdicts 25
  ```
- **Key coverage (decisive for the reader design).** Label execution_id prefixes:
  exec_ 3734, walk-* 3373, universal-* 1295, **feature_compose: 573**, interrupted: 60,
  **patch_with_tools: 56**. I sample-checked (≤30 per prefix) whether an `execution` row exists
  (`SELECT count() FROM type::thing('execution', id)`):
  ```
  exec_ 28/30 | walk-satisfier- 25/30 | universal-tool-fallback- 17/30
  feature_compose: 2/30 | patch_with_tools: 0/30 | interrupted: 0/30 | universal-tool-fallback: 0/30 | other 0/27
  ```
  Substrate-authored landings, which are the proposal's target class (reverted, inert, treadmill commits), carry the
  synthetic `feature_compose:<sha>` or `patch_with_tools:<sha>` id. Those prefixes are in goal-host
  `SYNTHETIC_EXECUTION_ID_PREFIXES` (index.ts ~1060: "the walk persisted no execution row"), so no reach
  patch is attempted, and there is no `execution` row, `composition_chain`, or `v_paradigm_execution_traces`
  row to walk. **Neither option A (supersede) nor option B can reach the landing pathway through
  `propagateCreditAlongChain` for these labels.** The proposal's premise that "verdicts key on execution_id …
  attaches to the exact execution and its chain" does not hold for the commit class. It would first need the
  sha→real-execution join, for example the walk's real execution id recorded next to the synthetic one.

---

## 4. Which posterior store selection actually reads

Three stores. Two of them take deltas.
1. **`variant_performance_metrics.thompson_alpha/thompson_beta`** (5,796 rows; 687 updated in the last 24h)
   - `services/discover-by-shapes.ts:261` reads
     `SELECT … thompson_alpha, thompson_beta … FROM variant_performance_metrics WHERE activity_id IN … OR variant_id IN …`
     → `metrics` (:294-296) → `sampled_score = betaSample(α, β)` (:320-324).
   - goal-host consumes it in `readCandidateShapes` (index.ts:6812-6815: `x.alpha ?? x.thompson_alpha ?? x.metrics?.thompson_alpha`,
     `betaSample` from `beta-sample.ts`), blended with the per-edge `activity_composition_graph` evidence
     (success_count/execution_count, 12,435 rows; discover-by-shapes.ts:168-175, 329-336).
   - goal-host calls discover-by-shapes at index.ts:5532, 9678, 9734, 9864, 10068.
   - Satisfier reliability comes from the `thompson_posterior` shape over VPM (index.ts:5707-5719).
2. **`context_thompson_scores.alpha/beta`** (17,685 rows; 1,471 updated in the last 24h), keyed by
   (org, template_id, signature_version, context_bucket) plus `cluster:` buckets.
   - Read by `/recommend` (`activities.ts:6041`; the context read is at :6321, cluster at :6495-6527).
     /recommend also overlays VPM and applies read-time decay (`decayRow`, ~:6283).
   - goal-host calls /recommend at index.ts:6390, 6405, 9398, 9697, 13944, 13982, 15515.
3. **`v_shape_conditioned_score`**, a **computed view over `execution.success`**
   (`sql/schemas/023-shape-conditioned-scores.surql:19-45`; alpha = count(success)+1).
   - Read at `db/paradigm.ts:1126/1163/1893` (getShapeConditionedScores, used by /recommend ~activities.ts:6243).
   - No delta can correct it. Only a change to the `execution` row can, and it grades exit status rather than reach.

A fourth store sits beside the per-arm stores: `goal_execution_path.thompson_alpha/beta`, the pathway store
used for pathway reuse (goal-paths.ts:720-770). It is also credited at write. A pathway-level correction
would need to hit it too.

---

## 5. Is there a notion of provisional vs settled credit?

No. What exists:
- **The ea78fd7 spool is transport only.** `REACH_SPOOL_PATH` (goal-host index.ts:989). `spoolReachVerdict` (:991)
  appends a lost POST /reach body. `drainReachSpool` (:1001) re-sends it after the next successful delivery.
  The file is live right now with 3 entries, all `walk-satisfier-*`, all `reached:false`. There is no delay
  window and no revision: a verdict is delivered later, once.
- **`reach_graded:true` is the only "settled" marker.** It is a tag on `execution`, written by `/reach` before
  crediting (execution-traces.ts:5258). It means "graded once, never again", which is the opposite of revisable.
- **Honest-reach gate:** `classifyReach` → 'ungraded' ⇒ {0,0} at insert (posterior-update.ts:1003-1016).
  Credit is deferred until the reach verdict arrives, but not revisable afterwards.
- goal-host's "SUPERSEDES" (index.ts:3898-3931) belongs to the failure-memory store keyed by goal_hash
  (priorVerdictFeedback). It is not credit.
- `decision_outcome` (50,434 rows; record id = execution_id, so idempotent) is capture only. Its reader
  `/decision-calibration` is read-only by design (03e6c55).

---

## Incidental finding: the /reach late-grading pre-read has an unbound parameter

`execution-traces.ts:5172`:
```
… FROM type::thing('execution', $execution_id) WHERE activity_id = $activity_id LIMIT 1`,
{ execution_id: String(execId) },      // $activity_id is never bound
```
It was introduced by the substrate-authored `f65e752` (2026-09-11, "recommit-route-edit-cf2abdd4-semantic_reject").
Before that commit the query had no WHERE clause (`git show --text f65e752 -- src/routes/execution-traces.ts`).
The live copy has it too (`/workspace/git/vessels/activity-api` HEAD 41c9e89, grep count 1).

Positive/negative control on an existing row:
```
SELECT activity_id, tags FROM type::thing('execution',"exec_5fv6nd8w") LIMIT 1;                         -> 1 row (learned-composition-memorynote-to-memorynote-write)
SELECT activity_id FROM type::thing('execution',"exec_5fv6nd8w") WHERE activity_id = $activity_id LIMIT 1; -> []
```
So `preRow` is null for every POST /reach. That makes **late-verdict grading (the path the proposal calls
"α/β write late at POST/reach") dead since 2026-09-11**, even though goal-host logs `reach-patch ok` (143 in the
last 24h). The verdict tag is still patched. Posteriors keep moving through the other writers
(insert-path success-based grading for untagged legacy rows, `/v2/activities/:id/executions` at activities.ts:2448, and goal-paths).

The journal agrees, over the last 24h of `journalctl -u activity-api` (1,530,726 lines):
- lines containing `reach-patch`: **0**. That covers the `graded`, `skipped` and `satellite` branches;
  all three need a non-null preRow.
- `posterior variant update APPLIED`: 1,139; `SKIPPED`: 7,779.
- Meanwhile goal-host logged `reach-patch ok` **143** times.

Consequence for this proposal: the "pipes exist" premise (late delivery works) is currently false at the
activity-api end, independent of the reader.

---

## Bottom line for the A/B decision

1. **A (supersede) cannot be done exactly.** Decay removes the banked quantity, n_observations inflates, and
   there is no negative-delta or clamp discipline. It is also inapplicable to the labels that matter
   (`feature_compose:`/`patch_with_tools:` have no execution row or chain).
2. **B (distinct)** is safe but does not correct the pathway, as the proposal says.
3. **Prerequisites before either option:**
   - (a) join a landing sha to its real walk execution_id and chain;
   - (b) add a per-(label, execution) idempotency key, because the label table is append-only and has duplicates and conflicts;
   - (c) fix the unbound `$activity_id` in /reach;
   - (d) a real writer, since the writer gap expired unrepaired and the emitter file was never created.
