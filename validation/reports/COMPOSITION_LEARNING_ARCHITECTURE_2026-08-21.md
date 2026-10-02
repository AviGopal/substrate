# Composition learning — architectural decision document, 2026-08-21

Produced by a 13-agent adversarial workflow (4 independent validators, 3
architects working from different lenses, 3 adversarial critics, 1 synthesis,
2 hostile feasibility audits; 1.5M subagent tokens, 0 agent errors). It
validates and in several places **overturns**
[`COMPOSITION_LEARNING_STATE_2026-08-20.md`](COMPOSITION_LEARNING_STATE_2026-08-20.md).

Read-only on production throughout: no dispatch, no restart, no unmask, no DB
write, no root SurrealDB credentials. Nothing below has been applied.

---

## 0. Corrections to the 2026-08-20 report

| 08-20 claim | Verdict | What is actually true |
|---|---|---|
| #4: populate `ancestor_signatures` at the call site | **WRONG / superseded** | Closed by `e19997f` (08-13) via the trace-row signature fallback at `posterior-update.ts:706`, deployed and running. The 08-20 report read that fix's own explanatory comment as evidence of the defect. Call-site population would duplicate a lookup the function already performs. |
| #5: pass `walkEvidence` at `:4591` and `:12304` | **NOT IMPLEMENTABLE / partial** | `universalToolFallback` (`index.ts:4454`) takes no `opts`, so there is no `stepSink`/`learningSink` in scope — passing an empty object is inert by construction. `:12304` is fixable but only its `gapsFiled` arm can fire. |
| #5 rationale: grading distinguishes composed from one-shot | **WRONG** | `walkEvidence` drives a cap that can only *demote*. It is a hollow-walk guard, never a composed-vs-one-shot discriminator, so it cannot "protect" credit as claimed. |
| #5: the omission set | **INCOMPLETE** | The load-bearing site is `:9471`, the walk's early interim reach, which short-circuits `:9564/:9570` via `??`. The 08-20 report missed it entirely. |
| #6: "the composition graph is unread at scoring" | **FALSE** | It *is* read: `discover-by-shapes.ts:167-176` → `composition_score` → `index.ts:6027` → `blendEdgeScore` → `sampledScore`. |
| #6: flipping SF_BLEND would enable psi | **FALSE** | `successorFeaturesEnabled()` is default-on. The blocking conjunct is `completion_shapes` (`activities.ts:6841`), whose only emitter `psiInputs` returns `{}` at all nine call sites — an 8-hex sha1 tested against a 16-hex regex. |
| SF_BLEND: "a fresh-name roundtrip works" | **WRONG AS STATED** | Four fresh names failed identically when meta was absent. The 08-20 probe succeeded only because it supplied non-null `updated_by`/`evidence`. |
| "~2029 edges, 1644 sampled" | **CONFLATED** | 2029 is the true row count. 1644 is not a sample size but a hard endpoint ceiling: `ORDER BY weight DESC` over a non-unique key returns 2029 rows containing 1644 distinct ids, six runs of six. **19% of rows are permanently unreachable through that route** — a previously unreported endpoint defect. |
| "no live-execution write path at all" | **TOO STRONG** | `deriveCompositionEdgeFromParent` (`execution-traces.ts:1605`, called at `:2361`) landed 08-11, is deployed and runs. It has never written an edge because it is *structurally dead*. Say "the live path is structurally dead", not "there is none" — the fixes differ completely. |
| citing `systemd-unit-health-observer.ts:47` for the July stop | **WRONG** | Written 06-17, describing a June abort class that is now fixed and individually try/caught. |

**Findings that stand:** composition edges are a dead batch artifact with nothing
newer than 2026-07-14; the autonomy plane was masked in one hand-applied batch at
2026-08-16 21:13; the write != read class is real and systemic.

**Retracted from the workflow itself:** its open question #3 claimed the ribosome
API key had started returning 401, "a strictly larger outage". Re-probed after the
run: `activity-api` returns **200** and `identity-vessel` is active with
`NRestarts=0`. That 401 was transient — most plausibly 13 agents concurrently
hitting one endpoint — not a standing outage.

---

## 1. Root cause of the SF_BLEND silent write (new, CONFIRMED by live 2x2 probe)

`writeTuningParam` binds JavaScript `null` into fields declared `option<string>`:

- `repos/activity-api/src/lib/tuning-params.ts:138-139` — `updated_by: meta.updated_by ?? null, evidence: meta.evidence ?? null`
- `sql/migrations/152-substrate-tuning-param.surql:22-23` — both `TYPE option<string>`

**In SurrealDB 2.3.3, NULL is not NONE.** `option<T>` accepts NONE and rejects NULL. The two branches diverge catastrophically:

- **UPDATE branch** (row matches): the violation is raised loudly and the statement fails.
- **CREATE branch** (no row matches): the record is never written and **the statement returns an empty result set with no error** — the awaited promise resolves, the caller logs success, and nothing exists.

`accelerator-flag-tick.ts:43/63/113` calls `writeTuningParam(flag, next)` with **no
meta at all**, so both fields are null on every flag write. SF_BLEND has never had
a row, so its write takes the silent create branch every hour, forever — the
"monotone ratchet" re-flips every tick, which is itself proof the row never lands.

Live 2x2 probe (HTTP route only, `PROBE_`-prefixed names):

| | fresh name | existing row |
|---|---|---|
| **meta supplied** | writes, reads back | updates in place |
| **meta null** | `ok:true`, **nothing written** | HTTP 500, loud `Found NULL for field \`evidence\`` |

Blast radius, measured: 1 of 8 fleet-wide `UPSERT ... WHERE` statements binds
nulls, serving 4 call sites (3 of them 100% lossy on the create branch — SF_BLEND
losing today, the other two latently lossy the day their condition is met). A
separate **loud** variant of the same NULL-vs-NONE class is firing in production
now: `shape_definition.org_id` (`routes/shapes.ts:288`), **35 occurrences in 48h —
every public shape registration fails.**

Minimal repair: bind NONE, not NULL (omit absent keys, or `?? NONE` in SurrealQL),
**and read the row back inside `writeTuningParam`, throwing on mismatch.**

---

## 2. The diagnosis — one structural property behind all five severances

Every one of the five severances is the same structural property: **the substrate's write paths degrade to a plausible-looking zero instead of an error, and no layer counts what it consumed.** A SCHEMAFULL `CREATE` that omits an `ASSERT $value != NONE` field writes nothing and logs nothing; an `UPSERT` that binds JS `null` into `option<string>` takes a silent create branch and returns `ok:true`; an optional positional argument omitted at one of four call sites amputates a grading input with no type error; a request that omits `predecessor_activity_id` silently downgrades a per-edge query to a child-global `GROUP ALL` aggregate; a helper that withholds one field because a *sibling* field failed a regex zeroes an entire feature; and `surrealDB.query<T>()` ends in `return firstResult as T[]`, so a row interface with four wrong column names typechecks exactly as cleanly as a right one. In every case the producer is correct, the consumer is correct, and the seam between them is observed by nobody — so a fix can land, typecheck, pass its reach gate, and be inert for ten days (the 2026-08-11 derive fix) or five weeks (the composition graph) without a single signal. The architecture is therefore not "add composition learning." It is: **bind what the schema requires, name what the query needs, and make every seam emit a counter at the layer that consumes it — so the next inert fix is visible in one tick instead of one month.**

---

## 3. Target architecture, joint by joint

### 2.0 Adjudications my own verification forced (all three architects were partly wrong)

| Claim | Verdict on HEAD | Evidence |
|---|---|---|
| "The blend feeds the walk's pick score" (P1, P3) | **Half true, and the half that matters is inert** | `producer-pick.ts:34` — `sampledScore` enters the pick *only* as a binary threshold: a **target-covering hollow scaffold** with `sampledScore > 0.5` earns rank −1. Genuine producers all return rank 0 (`if (!isHollowScaffold(c.id)) return 0;`), and JS sort is stable, so among genuine producers the pick is **discover's server-side global order**. Client-side blending never reorders them. |
| "`sampledScore` is never read by the picker" (Critique 2, fatal) | **Refuted** — it is read, through `scaffoldRank`, but only on the learned-composite reuse channel | same file, `index.ts:9089/9098/8947` sort by `scaffoldRank` |
| "Add `execution_id` + `org_id` to the derive CREATE" (all three) | **Insufficient — a third field is omitted** | `sql/schemas/011-executions.surql`: `DEFINE FIELD IF NOT EXISTS success ON activity_composition_graph TYPE bool ASSERT $value != NONE` with **no VALUE clause**. `execution-traces.ts:1637-1644` binds `$success` only inside `IF($success,…)` for counters; the `success` field itself is never SET. A two-field fix re-lands a dead fix. |
| "`composition_score` is wired into the pick score" | Partly healed already | `index.ts:6019-6021` carries a fix comment: the object-vs-number read was repaired. The blend *computes*; it just doesn't *order*. |
| "Fifth severance: discover never reads `context_thompson_scores`" (P3) | **CONFIRMED, and P3's repair is keyless** | `grep context_thompson_scores repos/activity-api/src/services/discover-by-shapes.ts` → 0 hits. But `discover-by-shapes.ts` gates on `const sigUsable = … /^[0-9a-f]{16}$/.test(signature)` with **no server-side derivation fallback** (unlike `/recommend`, which derives its own). A cts read keyed on that signature would have no key. |

### 2.1 CREDIT — *do not touch the math; make the key measurable*

The report's prescription (populate `ancestor_signatures` at the `propagateCreditAlongChain` call site) is **superseded**: `e19997f` (2026-08-13) landed the trace-row fallback `sigEntry?.signature ?? meta?.signature ?? null` in `repos/activity-api/src/lib/posterior-update.ts`, and the sole caller holds bare execution ids, so call-site population means re-issuing the `v_paradigm_execution_traces` SELECT the function already performs.

The real open question is **semantic, not structural**: chain credit is written under the ancestor's *own historical* pool signature, while `/recommend` derives a signature from the *current* pool. `deriveSignatureShapes` in `execution-traces.ts` falls back at tier 3 to the **produced** pool as a proxy for the input pool, and its own comment says tier 3 exists to widen coverage "beyond the ~4% of traces that carry input_impulse_shapes" — i.e. the proxy is the majority path. A pre-execution pool and a post-execution proxy are different sets.

Target: (a) raise `chain_credit_no_sig` from `logger.debug` to a counted metric with its complement (ancestors that *did* receive a conditioned write, by `signature_version`); (b) stamp `signature_basis` at ingest; (c) **retrospectively derive the basis histogram over the existing corpus** from the stored `input_impulse_shapes` / `tasks` / `output_impulse_shapes` fields — a forward-only stamp cannot characterise the traces credit reads today (Critique 1's point, adopted). Only then decide whether a mechanism change is warranted.

### 2.2 GRADING — *one omission at one site, plus one for symmetry*

`verifyGoalReached` (`index.ts:3084`) takes `walkEvidence` as optional param 6. The cap it drives can **only demote** — so the report's "grading distinguishes composed from one-shot" rationale is wrong; say the weaker true thing.

| Call site (HEAD) | Passes walkEvidence? | Action |
|---|---|---|
| `:9564` / `:9570` (end of walk) | yes (`walkEv` built at `:9562`) | none |
| **`:9471`** — the early interim reach inside the `!_terminalsPending` block | **no** | **FIX.** `earlyReachVerdict` is set at `:9479` and `:9563` reads `let verdict = earlyReachVerdict ?? await verifyGoalReached(…, walkEv)` — the `??` short-circuits, so an early reach bypasses the *only* capped grader, on the composed path credit draws its labels from. Unmentioned in the 08-20 report. |
| `:12304` (single-template / one-shot) | no | **FIX**, honestly scoped: only the `gapsFiled` arm can fire (`step N ran … new_shapes=` lines come from the walk loop). Grading one-shots leniently while grading walks strictly is a standing anti-composition bias in every label. |
| `:4591` (floor, `universalToolFallback(goal, targetShapes)`) | no | **DO NOT TOUCH.** No `opts`, so no `stepSink`/`learningSink` in scope; passing `{gapsFiled:0, walkLog:[]}` is inert by construction, and `floorReached` already folds in `executed/executedOk/groundedOk`. |

Carry Critique 3's regression caveat: mid-walk `producedShapes.length <= 2` is common by construction, so `gapsFiled > 0 && producedShapes ≤ 2` may demote early reaches that were fine, pushing walks onward into the pool pollution the early check exists to avoid. **Ship it with an `early_reach_uncapped` / `early_reach_capped` counter and a before/after on a known-good early-reaching goal.** This is a behaviour change with an uncharacterised sign, not a pure bugfix.

### 2.3 SELECTION — *four amputations in a forced order*

1. **No edge is ever minted.** `deriveCompositionEdgeFromParent` fires detached at `execution-traces.ts:2361`, but its `CREATE activity_composition_graph SET parent_activity_id = $parent, child_activity_id = $child, execution_count = 1, …` omits **`execution_id`, `org_id` and `success`** — three `ASSERT $value != NONE` fields on a SCHEMAFULL table, on a root connection where `$auth` is empty. All 2027 enumerated edges carry `execution_id="composition-edge-reconcile"`, max `created_at` 2026-07-14. Bind all three.
2. **No predecessor is ever named.** `grep predecessor_activity_id repos/goal-host-vessel/src/index.ts` → zero hits, so `discover-by-shapes.ts` always takes the `WHERE child_activity_id = $parent.id GROUP ALL` branch — a child-global rollup that cannot distinguish A→B from C→B. Thread the last chain entry into the four discover bodies, **in the raw record-id form the discover response carries** — never through `normActivityId` (it strips `activity:⟨…⟩`, the stored form). An id-form mismatch yields `comp_row` null → `w=0` → the pure global draw, byte-identical to not shipping. Hence the `edge_lookup_zero_match` counter is part of the change, not an extra.
3. **The picker does not order by the blend.** *(new; no proposal had it, one critique asked for it.)* Insert a stable secondary sort — sort candidates by blended `sampledScore` descending *before* the existing `scaffoldRank` sort at the three sites (`index.ts:8947`, `:9089`, `:9098`). Stable sort composition keeps `scaffoldRank` primary and every existing gate (`feasibleProducer`, `isIrrelevantLearnedComposite`, `notScaffold`) untouched; it only breaks the rank-0 tie by earned evidence instead of by discovery order. **Without this, changes 1 and 2 are inert for every genuine producer.**
4. **ψ / SF_BLEND.** `psiInputs` returns `{}` whenever the signature fails `^[0-9a-f]{16}$`, and goal-host's only source is an 8-hex sha1 from another namespace — so `completion_shapes`, the blocking conjunct at `activities.ts:6841-6842`, never ships. Split the contract: always emit `completion_shapes`; apply the 16-hex refusal to `signature` alone. Preserve the invariant the module actually protects (never emit a foreign-namespace signature) — you are relaxing one field, not the contract. **SF_BLEND last**, and only by letting the hourly ratchet re-flip it: flipping it earlier changes no ranking and would be credited as a win.

The SF_BLEND write itself: `lib/tuning-params.ts` binds `updated_by: meta.updated_by ?? null, evidence: meta.evidence ?? null` into `option<string>` fields (migration 152). In SurrealDB 2.3.3 NULL ≠ NONE — the UPSERT's create branch **writes nothing and raises nothing**. Bind NONE (omit absent keys, or `?? NONE` in SurrealQL) **and read the row back inside `writeTuningParam`, throwing on mismatch.**

### 2.4 Structural defence against write ≠ read

A checker in `packages/`, derived from the deployed `DEFINE FIELD` set — the one artifact both sides must already agree with, and which SurrealDB already enforces invisibly at runtime. **Two rules, not one:**

- **Rule 1 (column parity):** parse every SQL string literal in `src/**` — SELECT projections, SET clauses, WHERE columns, CREATE CONTENT keys — and fail on any column not defined on the target table. Catches: `relevance-sink-vessel/src/index.ts` (`times_failed`, undefined on `impulse_relevance_metrics`); `activity-api/src/jobs/accelerator-flag-tick.ts` (`template_id, alpha, beta, n_observations` selected from `variant_performance_metrics`, which defines none of them — they are `context_thompson_scores`' columns, queried eleven lines earlier); `routes/activities.ts` `/composition/successors` (`total_count`, `avg_duration_ms`, `avg_cost_usd`).
- **Rule 2 (required-field binding) — new, and the one that earns its keep:** every `CREATE`/`INSERT` against a SCHEMAFULL table must bind every field carrying `ASSERT $value != NONE` and lacking a `VALUE`/`DEFAULT` clause. **This is the rule that catches tonight's derive class**, which rule 1 provably misses (every column it names is valid). Without rule 2 the checker is defensible only against defects nobody is currently bleeding from.

**The enforcement point is the load-bearing part, and it overturns the precedent's own claim.** Verified: `repos/activity-api/package.json` has **no `lint` script** (scripts are `update-failure-lessons, dev, start, build, build:tsc, check, check:types, check:format, test, test:watch, typecheck`), and the only reference to `check-shape-dispatch` outside its own tree is the usage line in `scripts/check-shape-dispatch-all.sh`. The class detector this repo already accepted **has no caller** — CLAUDE.md's own script-retention rule. So the change is: wire **both** checkers into `scripts/git-hooks/pre-commit`, and land with a deliberately-broken fixture proving the hook exits 1. A detector must be proven to *complete*, not to exist.

### Explicitly DROPPED (and why)

| Dropped | Killed by |
|---|---|
| Populating `ancestor_signatures` at the call site (the 08-20 report's #4) | Superseded by `e19997f`; would duplicate a lookup the function already performs. |
| Passing `walkEvidence` at `:4591` (the report's #5) | `universalToolFallback` takes no `opts` — inert by construction. |
| "The composition graph is unread at scoring" (the report's #6 diagnosis) | False: the graph *is* joined, scored and blended. The defect is the absent predecessor + the picker not ordering by the blend. |
| P3's cts read inside `discover-by-shapes` | **Keyless.** `sigUsable` has no server-side derivation, so the new read has no key on every production call. Replaced by measure-first instrumentation. |
| P2's validation "a pick whose sampledScore differs from the unblended draw" | `sampledScore` is written into `recordStep` telemetry regardless of influence — the assertion passes on a zero-effect change. This is the inert-fix-passes-its-test class. |
| `execution_id` as the *primary* edge witness | The derive UPDATE branch never refreshes `execution_id`, so any pair already among the 2029 batch rows stays labelled `composition-edge-reconcile` forever. Demoted to a witness for fresh pairs only; counters are primary. |
| Any claim the parity checker catches SF_BLEND | It cannot — write-visibility is invisible pre-deploy. Readback assertion only, scoped to `writeTuningParam`. |
| Restoring `composition-edge-reconcile` as the edge *producer* | Law 4: an edge should be earned by the execution that composed. Demoted to verifier/backfill, with `last_full_at` advanced *before* the write loop so one abort cannot pin it in full mode forever. |

---

## 4. Ranked, sequenced plan

**Step 0 — OPERATOR DECISION.** `goal-host-vessel`, `development-vessel` and `ribosome-vessel` are masked (single mtime 2026-08-16 21:13). That means no dispatch plane, no ribosome (law 4 has no runtime path), and `substrateGap_write` is served by the masked development-vessel — **the outage blocks filing a gap about itself.** This is CLAUDE.md's intractable-blocker carve-out. Additionally, tonight the ribosome API key that authenticated hours ago now returns `401 INVALID_API_KEY` on `127.0.0.1:8080` (keylen=160, so the value is present); identity-vessel is the single validator, so a masked/failed identity is a plausible mechanism — **UNVERIFIED**, discriminator in §5. Nothing in Lane B is validatable until the operator answers.

| # | Change (file, verbatim anchor) | Why here | Mode | Blocked on mask? |
|---|---|---|---|---|
| **A1** | `packages/schema-parity-check/check.ts` — NEW, rules 1 + 2, modelled on `packages/shape-dispatch-check/check.ts`, same suppression-marker convention | Detector before fixes, so it polices the goals that land them. A detector added afterwards cannot testify about them. | requires-operator (hand-land; `packages/` is ungated) | **No** |
| **A2** | `scripts/git-hooks/pre-commit` — invoke schema-parity **and** the orphaned `scripts/check-shape-dispatch-all.sh`; land with a broken fixture proving exit 1 | The accepted precedent has no caller. Shipping A1 without A2 creates a second uninvoked script. | requires-operator | **No** |
| **A3** | `repos/activity-api/package.json` — add a `lint` script (`check:types` + both checkers) | `repos/activity-api/CLAUDE.md` claims `bun run lint` enforces the shape contract; no such script exists (law 9). `package.json` is ungated. | requires-operator | **No** |
| **A4** | `scripts/substrate/composition-edge-reconcile.ts` — demote to verifier/backfill; advance `last_full_at` **before** the write loop | `scripts/` is ungated. One abort currently pins the job in full mode permanently. | requires-operator | **No** |
| **B1** | `repos/goal-host-vessel/src/index.ts` — pass `walkEv` at `:9471`; log `early_reach_uncapped` with `{gapsFiled, stepLines, allStepsHollow}` | **First functional change:** false `reached:true` from the early-reach short-circuit is written straight into the posteriors every later change makes readable. Credit learned over corrupted labels is worse than credit nobody reads. | dispatchable-as-goal | **Yes** |
| **B2** | same file — pass `{gapsFiled: opts.learningSink?.gapsFiled.length ?? 0, walkLog: opts.stepSink ?? []}` at `:12304` | Symmetry; otherwise the bias merely inverts. Separate goal (one concern). | dispatchable-as-goal | **Yes** |
| **B3** | `repos/activity-api/src/lib/tuning-params.ts` — omit-not-null + readback assertion | Makes every later "the flag landed" claim falsifiable. | dispatchable-as-goal | **Yes** |
| **B4** | `repos/activity-api/src/routes/tuning-params.ts` — 404 for absent row, 5xx for a read that threw (stop collapsing both into `{value:null}` HTTP 200) | Same reason: the validation protocol reads through this route. | dispatchable-as-goal | **Yes** |
| **B5** | `repos/activity-api/src/index.ts` — delete the duplicate `accelerator-flag-tick` schedule (imported and scheduled twice) | It doubles every journal line used as SF_BLEND evidence, and races the UPSERT once the write lands. Must land **with** B3, not after. | dispatchable-as-goal | **Yes** |
| **B6** | `repos/activity-api/src/lib/posterior-update.ts` — `chain_credit_no_sig` → counted metric + conditioned-write complement by `signature_version` | Instrumentation before the mechanism it measures, or the first measurement has no baseline. | dispatchable-as-goal | **Yes** |
| **B7** | `repos/activity-api/src/routes/execution-traces.ts` — bind `execution_id`, `org_id`, **`success`** on the derive CREATE; source the parent from the already-resolved `composition_chain` rather than `SELECT activity_id FROM activity_execution_traces WHERE execution_id = $pid`; fix the docstring that disclaims the table its SQL reads; emit `edge_derive_outcome{created,updated,parent_miss,assert_fail}` | Selection cannot be validated against a table with zero execution-minted rows. Chain-sourcing also fixes the documented child-before-parent race and the edge-semantics problem (§6a). | dispatchable-as-goal | **Yes** |
| **B8** | `repos/activity-api/src/routes/activities.ts` — `GROUP ALL` + `.flat()` on the graph `SELECT count() as total`; add `, id ASC` to `ORDER BY weight DESC` (both duplicated at the second site) | The instrument must be sound before it is used as evidence: six full paginations each returned 2029 rows containing only 1644 distinct ids — 19% permanently unreachable. | dispatchable-as-goal | **Yes** |
| **B9** | `repos/goal-host-vessel/src/index.ts` — thread `predecessor_activity_id` (last chain entry, **raw record-id form**) into the four discover bodies; emit `edge_lookup_zero_match` | Needs B7's rows to read. Separate goal from B10. | dispatchable-as-goal | **Yes** |
| **B10** | same file — stable secondary sort by blended `sampledScore` before each `scaffoldRank` sort (`:8947`, `:9089`, `:9098`) | **Without this, B7 and B9 are inert for every genuine producer.** Validate by unit test, not by telemetry. | dispatchable-as-goal | **Yes** |
| **B11** | `repos/goal-host-vessel/src/psi-inputs.ts` — always emit `completion_shapes`; 16-hex refusal on `signature` alone; update the docstring to state which invariant survives | Only now does R reach a store with per-edge structure. Annotation-only on the discover path (nothing reads `successor_value`) — do not claim it changes ranking. | dispatchable-as-goal | **Yes** |
| **B12** | `repos/activity-api/src/routes/activities.ts` — add `signature_version` to the `context_thompson_scores` predicate and key the map on `(template_id, signature_version)` | Partial-key read: names agree, key differs; last row wins nondeterministically. Sits on the `/recommend` path credit depends on. Rule 1 cannot catch it. | dispatchable-as-goal | **Yes** |
| **B13** | *(gated on §4 step 4 returning overlap > 0)* server-side signature derivation on the discover path, then a cts read | Deliberately deferred: measure the key overlap before building the read. | dispatchable-as-goal | **Yes** |

**Ordering paradox, stated not hidden:** B3 — the change that makes flag evidence readable — is itself under `repos/*/src`, gated by the plane that is masked. If unmasking is refused, at most **one** conscious `SUBSTRATE_ALLOW_DIRECT_EDIT=1` bypass should be spent, on B3, and recorded as an intervention. Do not spend more; hand-completing the rest steals the lesson (law 6).

---

## 5. Validation protocol — by intervention, direction not amount

Precondition: confirm the plane by `MainPID` and `NRestarts`, never `is-active` — a restart loop reports `activating`, never `failed`.

| # | Intervention | Assertion | Fails how |
|---|---|---|---|
| 1 | **Grading, negative control FIRST.** Reproduce a goal that today early-reaches (`reached:true`) while having filed a gap and produced ≤2 shapes — on the **unchanged** build first. | After B1: `reached:false`, reason `deterministic:hollow_walklog_capped`, and `early_reach_capped` fires with `gapsFiled>0`. | If the control never fires, the fix is unexercised and must not be reported as validated. A suppression is invisible without the thing it suppresses. |
| 2 | **Grading regression check.** Re-run a known-good early-reaching goal. | It still reaches. | If it now demotes, B1's cap is mis-calibrated mid-walk and must be narrowed — an expected outcome, not a surprise. |
| 3 | **Edge minting.** Re-dispatch the verified 08-13 two-hop goal (`orphaned_capability_scan → memoryNote_write`). | Primary witness: `edge_derive_outcome` logs `created` or `updated`, **never** `assert_fail`/`parent_miss`. Secondary (fresh pairs only): a graph row whose `execution_id` is *this dispatch's* id, not `composition-edge-reconcile`. Attribute by dispatch id or nonce — never by timestamp. | An existing pair takes the UPDATE branch and keeps the batch id; that is why the counter, not the id, is primary. |
| 4 | **Edge lookup.** Second dispatch over the same first activity. | `edge_lookup_zero_match == 0` **and** `composition_score.sample_count > 0` in the discover response. | A non-zero counter is an **id-form or type-comparison** bug, not evidence about composition learning — that is exactly why it exists. |
| 5 | **Pick ordering — unit first, live second.** Deterministic unit test over constructed candidates (two genuine rank-0 producers, differing `sampledScore`) asserting the pick flips. Live: assert the ordering *input* arrived (`composition_score` non-null on the picked candidate). | Unit test flips; live input present. | **Do NOT assert a live rank inversion:** `EDGE_BLEND_K = 10`, so one edge success weights ≈0.09 and a flip is not guaranteed at n=1. Asserting it would fail honestly and be misread. |
| 6 | **Credit direction.** On step 3's graded success, read the ancestor's `context_thompson_scores` row before/after. | **Alpha moves up. Direction only** — the stored update is not the reported delta, and beta has been observed rising on a success. | If `chain_credit_no_sig == total_ancestors`, credit reached only the unconditioned key: a *distinct* failure from "the blend is wrong." |
| 7 | **The key actually meets.** Read the basis histogram (forward stamp + retrospective derivation) and the conditioned-write complement. | A number, whatever it is. | **This step is allowed to fail informatively.** If the majority basis is `produced_proxy`, most conditioned credit lands on a key selection does not read, and that is the finding — do **not** widen a predicate to manufacture a hit. |
| 8 | **SF_BLEND, by ratchet only.** After B3+B5, wait three ticks. | Exactly **one** `flipped=true`, then `flipped=false` forever; `GET /v2/tuning-params/SF_BLEND` returns 1; the line is logged **once** per tick (B5's proof). Separately: write a throwaway `PROBE_` name with no meta and confirm `writeTuningParam` now **throws** instead of returning ok. | A second `flipped=true` means the write still is not landing. **Never hand-author SF_BLEND=1** — that forfeits the only evidence the fix works. |
| 9 | **Class detector convicts.** Run the fleet checker; then introduce one wrong column name and one CREATE missing a NOT-NONE field; confirm the pre-commit hook exits 1; revert. | It names the four known instances **and** the derive-class fixture. | A checker that runs clean over a codebase with four known instances has measured the checker, not the code. |

Record each verdict through `provide_feedback` so it lands in the oracle corpus, not in a report file.

---

## 6. What this does NOT fix — open questions

1. **The credit key may still not meet.** Making the conditioned posterior readable does not make the write key and the read key coincide. Measurable (step 7), not fixable by edit. This is the single thing that could render the whole plan inert, and the plan is built to *report* that outcome rather than paper over it.
2. **`child_activity_id = $parent.id` may be type-incomparable — UNVERIFIED.** `child_activity_id` is `TYPE string` and stored as `"activity:⟨…⟩"`; `$parent.id` is a record link. If SurrealDB does not equate them, `comp_row` is null on the **existing** `GROUP ALL` branch too, meaning `composition_score` has never been non-null and no caller-side threading can repair it. **Discriminator:** one read-only `POST /v2/activities/discover-by-shapes` with `include_scores:true` on shapes whose producers include a child of a known batch edge — `composition_score` null on *all* candidates confirms it. **I attempted this probe tonight and could not: the ribosome key returns 401.**
3. **The ribosome API key is now rejected on the hub — UNVERIFIED cause.** `keylen=160`, `POST 127.0.0.1:8080/v2/…` → `401 INVALID_API_KEY`, where the same key authenticated hours earlier. identity-vessel is the single validator, so a masked or failed identity unit would produce exactly this. **Discriminator:** `docker exec substrate-live systemctl status identity-vessel` + `NRestarts`, and whether `/etc/substrate/env`'s key matches the row identity holds. Until this is answered, **no live read-only verification of anything is possible**, which is a strictly larger outage than the composition problem.
4. **The reconciler's 2026-07-14 abort trigger is UNVERIFIED.** The July journal is gone (persistent journal begins 2026-08-16 13:46; the unit was masked to `/dev/null` 21:13 the same day). Mechanism (full-mode lock-in + an unindexed scan over 368,831 rows) is code-evidenced; the triggering error text is not. **One read-only SELECT over `reconcile_state:⟨composition-edge⟩` closes it** — declared, not performed.
5. **The parity checker's named residual.** It cannot catch: value-domain vocabulary mismatch (`detector-coverage-scan.ts` writes category `detector_coverage_gap`; `boredom-vessel/src/goal-generation.ts` admits only `ui_legibility` or a summary matching `/capability|repair/`); partial-key reads (B12); the `activity:` prefix value-form split; dynamically-composed SQL (`discover-by-shapes` builds its WHERE by concatenation); and write-visibility (readback only). A claim of total coverage dies on the first of these.
6. **ψ remains annotation-only on the discover path.** Nothing in goal-host reads `successor_value`. B11 makes ψ *computable*; it does not make it *consumed*. Wiring an input and turning on a behaviour are different changes and must not be credited as one.
7. **Law 1 is bent, not met.** `substrate_tuning_param` is a table, not a shaped impulse; `successorFeaturesEnabled()` is an env default; `EDGE_BLEND_K` is a compiled-in constant partially threaded through `selection-tuning.ts`. This plan repairs the seam rather than migrating it — because migrating a store whose writes are currently silently lost would destroy the evidence that the repair worked. The migration is owed.
8. **Probe litter on the hub:** `PROBE_D=5` and `PROBE_WRITE_READ_20260820=7` persist in `substrate_tuning_param` with no DELETE route.
9. **The 08-14 `COMPOSITION_WIRING_AUDIT.md` was not re-adjudicated** against tonight's findings.

---

## 7. Substantive disagreements — real choices for the operator

**(a) Edge semantics: adjacency-derive vs consumption-gated mint.** The reconciler's *genuine* edges are provenance-backed — it requires B's input shapes to intersect A's output shapes and requires `consumed_from_task_ids`. `deriveCompositionEdgeFromParent` applies **no such filter**: goal-host passes `parentExecutionId: lastExecId`, the previous walk step whether or not it was consumed. Repairing the derive path as-is therefore writes a *weaker relation* into the same table that downstream consumers (`edge_kind` classification, `composition_score`'s α/β) read as consumption evidence. **Recommendation: mint from the already-resolved `composition_chain` in the same handler and stamp a provenance field (`derived_from: 'ingest_chain'`), keeping the adjacency SELECT only as a fallback.** Cost: slightly more work in B7. Benefit: the graph keeps one meaning.

**(b) Make the picker read the blend now, or defer?** P1/P3 assumed it already did; Critique 2 said it never does. Truth (§2.0): it does, on one binary threshold, for learned composites only. Deferring means B7 and B9 land and demonstrably change nothing for genuine producers. **Recommendation: do it now (B10), validated by unit test rather than by a live rank flip.** Risk: it changes the pick among rank-0 genuine producers, which today is discovery-order — a real behaviour change with a real (small) blast radius.

**(c) cts read in discover now, or measure first?** P3 makes it the centrepiece; its critique shows it would be keyless. **Recommendation: measure first (B6 + retrospective basis histogram), and gate B13 on overlap > 0.** Building a read whose key never resolves would reproduce, exactly, the class this whole document is about.

**(d) Enforcement point for the parity checker.** P1 wires it into `feature-compose`'s verify command (the substrate's own edit gate); P3 wires it into `pre-commit`. `feature-compose` is more binding but would block autonomous landing on parser noise before the false-positive rate is known — and with the plane masked, that failure would be misattributed. **Recommendation: pre-commit + broken fixture now (A2); add the `== sql-schema ==` stanza to `feature-compose`'s verify command only after a fleet-wide run establishes the noise floor.**

**(e) Bypass budget.** Unmask (preferred — it is also step 0 of validation), or spend exactly one `SUBSTRATE_ALLOW_DIRECT_EDIT=1` on B3, or scope everything to a local `make up` stack. **Recommendation: unmask.** A local stack proves mechanism on fresh priors and says nothing about the hub's learned posteriors; reporting a local green as loop closure would repeat the false-reach-becomes-cached-recipe failure. Probe candidate ports with `ss -ltn` on **all** interfaces (Docker binds `0.0.0.0`), and avoid `PORT_OFFSET=20000` — it lands inside the ephemeral range.

**Law 6, the gap that should have generated itself:** four independent investigations found the write≠read class and none of them minted the goal "extend `packages/shape-dispatch-check` to the SQL/schema seam, and wire it to a caller." The missing generator is the deeper gap — and it cannot be filed today, because `substrateGap_write` is served by the masked development-vessel.


---

# Appendix A — Law-alignment audit (hostile review of THIS plan)

The plan above does **not** pass a law audit unamended. Treat these as
blocking amendments, not commentary.

I've read all three documents and verified the proposal's law-relevant anchors against HEAD `d63d64b6`. Findings below; every quote is from the live tree.

---

# LAW-ALIGNMENT AUDIT — "Composition Learning Decision Document"

## Verdict table

| Law | Verdict | Weight |
|---|---|---|
| 1 — everything behavioral is a shape | **VIOLATES** (3 distinct counts; 1 newly introduced, 1 relied-on-and-load-bearing, 1 admitted) | **severe** |
| 2 — behaviors are activities | **VIOLATES** (the plan's entire defensive layer is unGradeable) | moderate |
| 3 — reuse before mint | **VIOLATES** (self-contradicting: the document names the right fix and then does the other thing) | **severe** |
| 4 — earned by doing, not declared | COMPLIES (§6a and the drop-table actively strengthen it) | — |
| 5 — pace is a rhythm | NEUTRAL, one tension (A4) | minor |
| 6 — don't rob self-maintenance; failure mints structure | **VIOLATES** (partial — 4 hand-lands + a class-question answered with a git hook + the detector gap never filed) | moderate |
| 7 — gap triple | COMPLIES-with-gap | — |
| 8 — information at the right time | COMPLIES (strongest alignment in the document) | — |
| 9 — docs are expectations, timeless | COMPLIES | — |
| 10 — memory belongs to the system | COMPLIES | — |
| 11 — location independence / data locality | **VIOLATES** (minor but concrete: A1's stated source and its actual reader disagree) | minor |
| 12 — causal discipline | **VIOLATES** (partial — B7 bundles two mechanisms; step 8 has two live confounders) | moderate |
| 13 — humans are resolvers, not preprocessors | COMPLIES-with-gap (13 operator-authored anchor-precise goals) | — |

---

## LAW 1 — "Everything behavioral is a shape" — **VIOLATES**

> "Runtime behavior must be steered by shaped impulses read at use time. Env vars, config files, and in-process constants are bootstrap-only (secrets, ports, identity)… Never gate behavior behind anything the system cannot observe through a shaped impulse."

The document confesses part of this in §5.7 and says "the migration is owed." That confession does not cover all three counts, and it is doing more work than it is entitled to. Bucketed, because collapsing these is how the finding gets dismissed:

### 1a. NEWLY AMPLIFIED — B1/B2 widen the reach of a compiled-in grading threshold

`repos/goal-host-vessel/src/index.ts:3378`:

```ts
if ((walkEvidence.gapsFiled > 0 && producedShapes.length <= 2) || allStepsHollow) {
```

`gapsFiled > 0`, `<= 2`, and the `/\bstep \d+ ran /` step-line regex are in-process constants that decide **whether a goal graded reached**. That is the most behavioral quantity in the system — it is the label every posterior in the plan is subsequently trained on. Today the breach is contained to two call sites (`:9564`, `:9570`). B1 and B2 propagate it to `:9471` and `:12304`, i.e. **to the early-reach path and the one-shot path**, making an unlearnable, untraceable constant the arbiter of the entire label corpus.

The document itself concedes the threshold's sign is uncharacterised — "a behaviour change with an uncharacterised sign, not a pure bugfix" — and then proposes to widen its blast radius without making it adjustable. Its own step 2 anticipates the cap being "mis-calibrated mid-walk and must be narrowed": narrowing it requires a code edit, a redeploy, and a fresh dispatch — precisely the frozen-and-unobservable property law 1 exists to forbid.

**Minimal amendment (does not gut B1/B2):** before B1, hoist the three literals into the existing `selection-tuning.ts` resolution path as `hollowCapMinGaps` / `hollowCapMaxShapes`, with `SELECTION_TUNING_DEFAULTS` carrying today's values so the change is byte-for-byte inert until authored. That is one small addition to a module already built for exactly this, it is `repos/*/src` so it dispatches as a goal like the rest, and it converts step 2's "narrow it" from a redeploy into a policy write inside one TTL window. Cost: one extra goal ahead of B1. Refusing this means the plan's own contingency is not executable.

### 1b. RELIED ON, NOT FIXED, AND LOAD-BEARING — the SF_BLEND env check sits *above* the readable row

`repos/activity-api/src/routes/activities.scoring.ts:126-127`:

```ts
if (process.env.SF_BLEND === '1' || process.env.SF_BLEND === 'true') return true;
return (await getTuningParam('SF_BLEND', process.env.SF_BLEND, 0)) >= 1;
```

Note the tier order. `selection-tuning.ts:74-77` states the fleet's sanctioned tiering explicitly — "authored row -> env -> in-code default… Law 1 objects to a value being FROZEN AND UNOBSERVABLE, not to env existing as a fallback **beneath** a readable one." Here env is not beneath; it **short-circuits above** the row. An operator (or a leftover unit-file line) can turn composition-aware ranking on with no row, no trace, and no impulse.

This is not the proposal's defect, but the proposal **builds its headline validation on top of it**. Validation step 8 asserts:

> "`GET /v2/tuning-params/SF_BLEND` returns 1… Exactly one `flipped=true`, then `flipped=false` forever"

Neither clause establishes that blending is on or off, because `successorBlendEnabled()` can return `true` from the environment without the row ever being read, and can return `true` on a deployment where the row write is still broken. The plan's single most emphasised success criterion is falsifiable by a variable it never inspects. `SF_BLEND_WEIGHT` (`:131`) and `SF_TOPK` (`successor-features.ts:56`) are env-only with no row tier at all, so even a correct flag lands on an unobservable weight.

**Minimal amendment:** fold into B4 (already touching this route family) — demote the env short-circuit below `getTuningParam`, matching the tiering `selection-tuning.ts` documents as the fleet convention. If that is judged too large a behaviour change to bundle, then step 8 must additionally assert `SF_BLEND` is unset in the running process by `/proc/<pid>/environ` — env ground truth, not the unit file — and must read the *effective* `successorBlendEnabled()` result, not the row.

### 1c. ADMITTED, BUT THE PROPOSAL DEEPENS THE REST SIDE OF IT

§5.7 concedes `substrate_tuning_param` is "a table, not a shaped impulse" and defers migration on the grounds that "migrating a store whose writes are currently silently lost would destroy the evidence that the repair worked." That argument is sound and I accept the deferral. What I do not accept is B4's direction of travel: it hardens a bespoke REST surface (`GET /v2/tuning-params/<name>` → 404/5xx) around behavioral state, which walks *away* from the foundation's data-plane invariant —

> "Every vessel-to-vessel *data-plane* exchange is a typed impulse: the caller resolves the target by shape via discovery and POSTs the typed-pointer envelope."

— and away from the precedent the foundation records for exactly this class: "per-variant Thompson posteriors were reachable only as REST responses, and **lifting them onto `thompson_posterior` made them routable, composable, and observable** like any other impulse." The foundation is explicit that a non-shaped store is evidence, not convention: "The minimum may include primitives in informational state that lack shapes; those gaps surface as forced REST endpoints, hardcoded routing, or non-impulse state shared between subsystems. **We treat each such case as evidence about the minimum.**"

**Minimal amendment:** keep B4 exactly as scoped (the readback and the 404/5xx split are correct and needed now), but add one line to §5.7 naming the target end-state — `tuningParam` advertised as a shape on the standard resolve path, following the `thompson_posterior` precedent — and record the deferral as the owed gap rather than as an open question. This costs nothing today and prevents B4's hardening from being cited later as the settled design.

---

## LAW 2 — "Behaviors are activities" — **VIOLATES** (moderate)

> "Every taught behavior is minted as an activity — selectable by Thompson, graded by traces, composable, replaceable by a better variant. A behavior that exists only as a resolver (or only as an operator's curl habit) is invisible to the learning loop."

Two counts.

**2a. The entire defensive layer is a pre-commit hook.** A1–A3 implement class detection as a `packages/` script invoked from `scripts/git-hooks/pre-commit`. A git hook is not selectable, not graded, not composable, not replaceable-by-variant, and produces no trace. It is closer to "an operator's curl habit" than to anything the loop can see. I accept the counter-argument that law 2's letter is about *taught behaviors* and dev-time linting is arguably outside it — which is why this is moderate, not severe, and why the clean conviction is under law 6 (below).

**2b. Every counter the plan invents has no runtime reader.** `edge_derive_outcome`, `edge_lookup_zero_match`, `early_reach_capped`/`early_reach_uncapped`, `chain_credit_no_sig` + complement — these are the plan's central innovation ("make every seam emit a counter at the layer that consumes it"), and the validation protocol reads all of them by `journalctl`. That is the operator-memory-file failure mode transposed onto instrumentation: the operator role section is explicit — "Before writing any lesson, name its runtime reader; a lesson with no read-at-use-time path is an archive, not teaching — and the missing reader is itself a gap." A counter only an operator greps cannot drive the growth governor, cannot seed a goal, and goes dark the moment nobody is watching — which is precisely how composition-edge accumulation died silently on 2026-07-14 and how the reconciler's abort hid behind a health observer for weeks.

**Minimal amendment:** name the runtime reader for at least the two counters the plan calls "primary" (`edge_derive_outcome`, `edge_lookup_zero_match`). Cheapest compliant form that adds no new machinery: emit them as fields on the existing execution trace body rather than only as log lines, so `execution_trace` / `goal_reasoning` surface them and a later detector activity can aggregate them without a journal scrape. Keep the log lines — they are how you read them tonight while the plane is masked. Do not claim the seam is "observed" until the counter has a reader that is not a human.

---

## LAW 3 — "Reuse before mint" — **VIOLATES** (severe; the document convicts itself)

> "Before creating a new activity or resolver, find an existing producer of the needed output shape and compose with it. A duplicate mint is a fresh uninformed cell that splits selection traffic… **A wrong mint is negative value, not zero** — even when its dispatch goes green."

A1 mints a **new package**:

> "`packages/schema-parity-check/check.ts` — NEW, rules 1 + 2, **modelled on `packages/shape-dispatch-check/check.ts`, same suppression-marker convention**"

Its own closing paragraph states the correct action:

> "four independent investigations found the write≠read class and none of them minted the goal '**extend** `packages/shape-dispatch-check` to the SQL/schema seam, and wire it to a caller.'"

The document names *extend*, then does *mint*, and the only stated justification is that the new thing is modelled on the old thing and copies its conventions — which is the definition of the duplicate it is supposed to avoid. The predicted cost is concrete and already visible in this codebase: two checkers, two suppression-marker vocabularies that agree today, two wiring points in `pre-commit`, two things that must both be kept current — the same "two constants that drift the first time either is tuned" trap `selection-tuning.ts:36-40` documents and deliberately avoids.

Honesty note: law 3's letter governs activities and resolvers, and the foundation's "Reuse Before Mint" section scopes enforcement to the mint chokepoint (`development-vessel activity-create-variant`, `REUSE_BEFORE_MINT`) — not to TypeScript packages. So this is the *principle* applied by the proposal's own words, not the letter. I still rate it severe, because the proposal supplies the reasoning itself and then rules against it without argument.

**Minimal amendment:** ship rules 1 and 2 as a **second entry point inside `packages/shape-dispatch-check`** (e.g. `check-sql.ts` beside `check.ts`, one package, one suppression convention, one `pre-commit` invocation, one README). Everything else in A1–A3 survives unchanged, A2's wiring gets simpler, and A3's `lint` script gains one caller instead of two. This also makes the closing law-6 sentence true rather than aspirational.

---

## LAW 4 — "Activities are earned by doing, not declared" — **COMPLIES**

> "The proper origin of an activity is extraction from a reached execution (the ribosome), not an operator uploading a hand-written template."

§6a is the strongest law-alignment in the document, and it is argued rather than asserted: minting edges from the already-resolved `composition_chain` in the ingest handler, with `derived_from: 'ingest_chain'`, replaces a batch reconcile with an edge earned by the execution that composed. The drop-table's refusal to restore `composition-edge-reconcile` as the *producer* cites law 4 correctly and demotes it to verifier/backfill.

Two supporting observations that strengthen the case beyond what the document argues: the foundation states "Every successful trace confirms an edge exists," which is an execution-time property, not a reconcile-time one; and the advertised-vs-demonstrated passage — "An edge therefore carries two independent facts: whether it is advertised, and whether it has ever been *demonstrated*" — makes §6a's provenance stamp load-bearing rather than cosmetic, because the adjacency-derived relation is nearer to *advertised* and the chain-derived one is nearer to *demonstrated*. Feeding both into one α/β under one `edge_kind` would conflate exactly the two facts the foundation says must stay separable.

No violation. One reinforcement, folded into the law-12 amendment below.

---

## LAW 5 — "Pace is a rhythm, not a throttle" — **NEUTRAL**, one tension

> "Cadence lives in the pool as time-shaped rhythm impulses the selector reads, not in static intervals, timers, or concurrency clamps."

A4 keeps `composition-edge-reconcile` as a systemd `.timer`-driven job and fixes `last_full_at` ordering; B5 deletes one of two in-process `setInterval`-style schedules. Both are repairs to pre-existing static cadence, and neither adds new throttling. Demoting the reconciler to verifier/backfill *reduces* the fleet's dependence on a static timer, which points the right way.

The tension: the plan restores a masked timer-driven job to service without asking whether its cadence should be a rhythm impulse. That is out of scope for a composition-learning change and I do not recommend expanding scope. **No amendment required**; worth one sentence in §5 acknowledging the reconciler's cadence remains static so a later reader does not treat A4 as settling it.

---

## LAW 6 — "Don't rob the substrate's self-maintenance; failure mints structure" — **VIOLATES** (partial)

> "When its self-development fails, the failure is training signal: file it as a gap and let the system learn the repair. Hand-completing its work steals the lesson. Equally, failure mints structure — every observed bug class gets three questions: how do I patch this instance, **what activity would detect this class without me**, and what goal should the system have generated from this observation? If the operator authored the goal by hand, the missing generator is itself the gap."

Three counts, in descending severity.

**6a. Question 2 is answered with a git hook, and the answer is never recognised as insufficient.** The law asks what *activity* would detect the class. The plan's answer is a pre-commit script — a channel the substrate cannot select, grade, or improve, and one that only fires when a human commits. When the fleet is unmasked and `feature_compose` lands substrate-authored commits, that path is the one that most needs the check and the one a `.git/hooks` script installed per-clone least reliably covers (`scripts/git-hooks/install.sh` "only enforces once installed"). §6d already sees this and defers the `feature_compose` verify-command stanza until a noise floor exists — which I agree with — but the deferral is filed as a scheduling choice, never as the owed structural gap.

**Minimal amendment:** add one row to the drop/owed list: *owed — a detector activity that runs the parity check on a rhythm and emits its verdicts as a shaped impulse, so the class is detected without an operator and without a commit; filed once `substrateGap_write` is reachable.* This costs one sentence, keeps A1/A2 exactly as they are, and stops the git hook from being mistaken for the answer to question 2.

**6b. Four hand-landed changes, justified by the gate rather than by the law.** A1–A4 are marked "requires-operator (hand-land)" with the reason "`packages/` is ungated" / "`scripts/` is ungated." That is rules-lawyering the enforcement mechanism instead of the decision it enforces. CLAUDE.md's rationale is upstream of the hook: "Development flows **through** the substrate so every change produces a trace and feeds the learning loop." The PreToolUse hook's scope is where the fleet chose to make that *mandatory*; it is not a licence to hand-edit everywhere else. Landing four changes with no trace is four executions the ribosome cannot extract from and four data points the loop never sees — in a plan whose entire subject is a starved learning loop.

**Minimal amendment:** dispatch A1–A4 as goals like B1–B13 once step 0 resolves, and hand-land them only if step 0 is answered "stay masked." State that conditional explicitly rather than pre-classifying them as operator work. If they must be hand-landed, say in the commit body that they were, and why — the intervention record law 12 requires.

**6c. The single-bypass budget is correctly disciplined.** The "at most one `SUBSTRATE_ALLOW_DIRECT_EDIT=1`, spent on B3, recorded as an intervention" rule, and the refusal to hand-author `SF_BLEND=1` ("that forfeits the only evidence the fix works"), are both exactly right and should not be softened. Step 0's framing of the mask as the intractable-blocker carve-out is also correct — the operator role permits intervention on "broken infrastructure it cannot see," and a masked unit defeats `Restart=on-failure` and self-recovery at once, so nothing restores it without hands. **No amendment.** I note it because a hostile audit that flags only the failures misreports the document.

---

## LAW 7 — "Measure by the gap triple" — **COMPLIES-with-gap**

> "Progress is (1) gap close rate, (2) gap latency from detection to close, (3) solution durability… Activity counts, dispatch volume, and token spend are not progress."

The plan reports no vanity metrics; every validation assertion is a mechanism verdict (counter fired, direction of α, unit test flips). Step 7 is explicitly allowed to fail informatively — "do **not** widen a predicate to manufacture a hit" — which is the anti-gaming posture the law is for.

The gap: nothing in the plan produces a gap-triple entry, because `substrateGap_write` is served by the masked development-vessel. The document says so honestly. **No amendment beyond 6a's owed-gap row**, which is the same debt.

---

## LAW 8 — "Information at the right time" — **COMPLIES** (best-aligned section)

> "Confabulation and fixation are downstream of information starvation… the fix for a wrong output is rarely a bigger prompt — it is making the load-bearing fact available as an impulse at the moment of use."

B6 + the retrospective basis histogram before B13; §6c's "measure first, gate B13 on overlap > 0"; the refusal of P3's cts read on the grounds that it would be *keyless*; §5.1's admission that the credit key may still not meet and that this is measurable rather than fixable — all of this is the law applied correctly, including to the plan's own uncertainty. The insistence that the basis histogram be derived **retrospectively** over the existing corpus, because "a forward-only stamp cannot characterise the traces credit reads today," is the sharpest single move in the document.

**No amendment.**

---

## LAW 9 — "Docs are expectations; write them timelessly" — **COMPLIES**

> "A document is an expectation the system holds about itself — closure means verifying reality against it."

Three of the plan's items *close* law-9 debts rather than creating them: A3 repairs `repos/activity-api/CLAUDE.md:103` — "**Shape contract is enforced.** `bun run lint` includes `scripts/check-shape-dispatch.ts`" — which I verified is false at HEAD (`repos/activity-api/package.json:7-20` has no `lint` script). B7 fixes "the docstring that disclaims the table its SQL reads." B11 requires the psi-inputs docstring to "state which invariant survives" when the 16-hex refusal is relaxed to `signature` alone — the right instinct, since `psi-inputs.ts:72-77` currently documents the refusal as covering the whole return value.

One caveat, not a violation: the decision document itself carries dates, commit hashes, and an instance name (`syzygy.host`). That is correct placement — `validation/reports/` is where dated findings belong, and law 9 governs operator-facing reference docs. Do not "fix" it by making the report timeless.

---

## LAW 10 — "Memory belongs to the system" — **COMPLIES**

> "Recall by querying the resolver; fall back to cache files only when the substrate is down, and say so."

"Record each verdict through `provide_feedback` so it lands in the oracle corpus, not in a report file" is the law applied. The document says the substrate is down and says so explicitly. **No amendment.**

---

## LAW 11 — "Location independence with data locality" — **VIOLATES** (minor, concrete)

> "The system must run identically wherever it is deployed and must not rely on a host machine or host workspace."

§2.4 states the checker's source of truth as:

> "derived from **the deployed `DEFINE FIELD` set** — the one artifact both sides must already agree with, and which SurrealDB already enforces invisibly at runtime."

A2 then wires it into `scripts/git-hooks/pre-commit`. A pre-commit hook in a clean clone cannot reach a deployed database; it can only parse the repo's `sql/schemas/*.surql`. The stated source and the actual reader disagree, and the gap between them is unobserved: a deployment whose applied migrations lag the repo (or a hand-applied field, which this fleet has demonstrably had) passes the checker green while the runtime schema differs. That is the same shape as the class the checker exists to catch — write ≠ read, one layer up. It also silently makes the check depend on the checkout being the same tree as the deployment, which is the host-workspace dependence law 11 forbids.

**Minimal amendment:** change the *claim*, not the mechanism. State that the checker derives from the repo's `.surql` migration set, and that repo-vs-deployed schema drift is **out of scope and unobserved by it**. Then either (a) accept that residual, listing it in §5.5 beside the other named residuals, or (b) add a startup-time variant of rule 2 inside activity-api that validates against the live `INFO FOR TABLE` on boot — where the deployed schema actually is, per law 11's data-locality half. (b) is more work than tonight warrants; (a) costs one line and stops the document from over-claiming.

---

## LAW 12 — "Causal discipline" — **VIOLATES** (partial)

> "Prefer counterfactuals recorded at decision time and deliberate interventions; when you change something to see what happens, **change one thing and record that you did**."

The sequencing discipline is mostly good — B1 before credit so labels are clean, B6 before the mechanism it measures, B3+B5 landing together so the duplicate tick cannot double-count the evidence, negative control before the fix in step 1. Two counts survive that.

**12a. B7 bundles two mechanisms with different semantics into one change.** B7 is: bind three fields + **re-source the parent from `composition_chain` instead of the adjacency SELECT** + docstring + counters. §6a is explicit that these are *different relations* — the adjacency path writes "a *weaker relation* into the same table that downstream consumers read as consumption evidence." So after B7, an increase in edge population is attributable to the binding fix, to the semantic change, or to both, and the α/β accumulating on those edges mixes two populations.

**Minimal amendment (does not require splitting the goal):** §6a already proposes stamping `derived_from: 'ingest_chain'`. Make the **adjacency fallback stamp a different value** (`derived_from: 'adjacency'`), and add `derived_from` to the `edge_derive_outcome` counter's dimensions. The two mechanisms then remain distinguishable in the data and in the counter, which satisfies "record that you did" without a second dispatch. Without a distinct fallback value, the stamp is uninformative — every row says `ingest_chain` or says nothing.

**12b. Validation step 8 has two live confounders, one of which the plan itself created a fix for and one it did not.** The assertion "exactly one `flipped=true`, then `flipped=false` forever" is confounded by (i) the duplicate `accelerator-flag-tick` schedule — which B5 removes, but B5 and B3 are separate goals and the plan only says they must land "with" each other; and (ii) the env short-circuit of finding 1b, which is never mentioned. Two uncontrolled inputs on the plan's headline single-intervention test.

**Minimal amendment:** make step 8 a precondition-checked intervention — before waiting three ticks, assert (1) `grep -c accelerator-flag-tick` shows one schedule in the running build, and (2) `SF_BLEND` is absent from `/proc/<MainPID>/environ` of the live activity-api process. Both are read-only, both are one command, and without them a green step 8 is not evidence.

**12c. Accepted as compliant:** step 5's refusal to assert a live rank inversion — "`EDGE_BLEND_K = 10`, so one edge success weights ≈0.09 and a flip is not guaranteed at n=1" — is verified correct against `repos/goal-host-vessel/src/edge-blend.ts:50,67` (`samples/(samples+k)` = 1/11 ≈ 0.091), and step 6's "direction only, never amount" matches the fleet's recorded experience that the stored update is not the reported delta. Both are law-12 done properly.

---

## LAW 13 — "Humans are resolvers, not preprocessors" — **COMPLIES-with-gap**

> "The system owns decomposition, path inference, and payload synthesis. If a goal only works after an operator rewrites it with file paths and expected shapes, that rewriting is a gap in the system, not a workflow to institutionalize."

The plan is thirteen operator-authored goals, each pre-decomposed to one file, with verbatim anchors and line numbers. By law 13's letter that is the preprocessing the law names. But CLAUDE.md's own dispatch section mandates the same interface — "A goal whose lead sentence names a real `repos/<vessel>/src/…` file routes through the edit-intent path… Name the file, describe the change. One file per goal" — so the plan is complying with the documented interface, and the gap is in the interface, not in the plan. Both halves must be said or the finding is unfair.

The closing paragraph does file the meta-gap, but only for **one** goal (the checker). The other twelve are equally operator-authored and equally should have been generated from the substrate's own observations — the operator role is explicit that "an operator writing them by hand is the gap."

**Minimal amendment:** generalise the closing sentence from the checker to the set: *thirteen repair goals were authored by hand from an operator's reading of the code; the generator that should have minted them from the substrate's own trace observations does not exist, and that missing generator is the deeper gap.* One sentence, and it is the honest version of what the document already says once.

---

## Priority order for the amendments

If only three are taken:

1. **Law 3** — fold rules 1+2 into `packages/shape-dispatch-check` instead of minting a sibling package. Cheapest amendment, largest law weight, and the document already argued for it.
2. **Law 1b** — either demote the `SF_BLEND` env short-circuit below the row in B4, or make step 8 assert env ground truth from `/proc/<pid>/environ`. Without one of these the plan's headline validation cannot testify.
3. **Law 1a** — hoist the hollow-cap literals into `selection-tuning.ts` before B1. Without it, the plan's own step-2 contingency ("narrow the cap") is not executable without a redeploy.

The plan's law-4, law-8, law-9 and law-10 alignment is genuinely strong and should not be traded away to accommodate the above; none of the amendments require it.

## Files referenced (absolute)

- `/home/avi/documents/work/substrate/CLAUDE.md`
- `/home/avi/documents/work/substrate/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- `/home/avi/documents/work/substrate/docs/architecture/SUBSTRATE_AS_DYNAMICS.md`
- `/home/avi/documents/work/substrate/validation/reports/COMPOSITION_LEARNING_STATE_2026-08-20.md`
- `/home/avi/documents/work/substrate/repos/goal-host-vessel/src/index.ts` (`:3084`, `:3378`)
- `/home/avi/documents/work/substrate/repos/goal-host-vessel/src/edge-blend.ts` (`:50`, `:67`)
- `/home/avi/documents/work/substrate/repos/goal-host-vessel/src/selection-tuning.ts` (`:36-40`, `:47-51`, `:74-77`)
- `/home/avi/documents/work/substrate/repos/goal-host-vessel/src/psi-inputs.ts` (`:72-93`)
- `/home/avi/documents/work/substrate/repos/activity-api/src/routes/activities.scoring.ts` (`:126-136`)
- `/home/avi/documents/work/substrate/repos/activity-api/src/lib/successor-features.ts` (`:55-67`)
- `/home/avi/documents/work/substrate/repos/activity-api/package.json` (`:7-20`)
- `/home/avi/documents/work/substrate/repos/activity-api/CLAUDE.md` (`:100`, `:103`, `:173`)
- `/home/avi/documents/work/substrate/packages/shape-dispatch-check/`
- `/home/avi/documents/work/substrate/scripts/git-hooks/pre-commit`

**UNVERIFIED:** I did not re-verify the proposal's non-law factual anchors (line numbers at `index.ts:9471/12304/8947/9089/9098`, the SurrealQL `ASSERT $value != NONE` set, the 2029/1644 edge pagination). This is a law audit; every law finding above rests on a file:line I read at HEAD `d63d64b6`. No production reads, no dispatches, no DB access were performed.


---

# Appendix B — Code-seam feasibility audit

# CODE-SEAM FEASIBILITY AUDIT — composition-learning decision document

**Baseline audited** (read-only; no dispatch, no restart, no unmask, no DB write, no root SurrealDB creds):
super-repo `d63d64b6`; submodules as checked out — `repos/goal-host-vessel` **b5e4b56**, `repos/activity-api` **b984e34** (note `git submodule status` prefixes activity-api with `+`: the checked-out commit differs from the super-repo index, so any line number below is against *this working tree*, not `d63d64b6`'s recorded pointer).

## HEADLINE: no hallucinated seams

Every file, function, line-anchor and SQL construct the proposal names **exists**, at or within a few lines of the cited position. That includes the ones easiest to fabricate: `packages/shape-dispatch-check/check.ts`, `scripts/substrate/composition-edge-reconcile.ts`, `repos/goal-host-vessel/src/psi-inputs.ts`, `producer-pick.ts`, `edge-blend.ts`. The only citation drift is cosmetic: the `success ASSERT $value != NONE` field is at **`repos/activity-api/sql/schemas/011-executions.surql:305-307`** (as cited) *and* independently at `sql/002-learning-system-phase1.surql:36-38`.

## The question the task singled out: `ancestor_signatures`

**Per-ancestor signatures are NOT computable at the `propagateCreditAlongChain` call site.** Verified:

- Sole caller: `repos/activity-api/src/lib/posterior-update.ts:1126`. It passes `{activity_id, composition_chain, success, failure_mode, sibling_group_size}` — all from the `trace` object. `trace.composition_chain` is `string[]` of **bare execution ids** (`routes/execution-traces.ts:1872-1877`, `resolvedCompositionChain`). No signature is anywhere in the caller's hands.
- The only way to obtain them is `SELECT execution_id, variant_id, signature, signature_version FROM v_paradigm_execution_traces WHERE execution_id IN $ids` — which `propagateCreditAlongChain` **already issues itself** at `posterior-update.ts:666-671`.
- `posterior-update.ts:699-704` already consumes it: `const ancestorSig = sigEntry?.signature ?? meta?.signature ?? null;`

**Verdict: the 08-20 report's item #4 ("populate `ancestor_signatures` at the call site") is BLOCKED-as-specified / superseded.** The proposal's supersession claim is **verified**. The only honest remaining work is instrumentation (B6) plus the semantic question of whether the write key and read key coincide.

## Per-change verdicts

### Lane A — ungated, hand-landable

| # | Verdict | Evidence |
|---|---|---|
| **A1** parity checker in `packages/` | **FEASIBLE** | `packages/shape-dispatch-check/{check.ts,package.json,README.md}` exists as the model. Rule-2 target confirmed: `activity_composition_graph` has three `ASSERT $value != NONE` fields with no `VALUE`/`DEFAULT` — `parent_activity_id`, `child_activity_id`, `execution_id`, `success` (011-executions.surql:281-307); `org_id` (`:293-296`) *does* carry `VALUE $value OR <string>$auth.org_id`, so on a **root** connection (`$auth` empty) it still fails the assert. Rule-1 instances re-verified: `relevance-sink-vessel/src/index.ts:22` writes `times_failed` where the schema defines `times_execution_failed` (011-executions.surql:387); `activity-api/src/jobs/accelerator-flag-tick.ts:87` selects `template_id, alpha, beta, n_observations FROM variant_performance_metrics`, which defines **none** of them (`sql/001-init-schema.surql:141-192` — it has `variant_id, activity_id, total_executions, successful_executions, thompson_alpha, thompson_beta…`); `routes/activities.ts:8261-8263` selects `avg_duration_ms, avg_cost_usd, total_count` from `activity_composition_graph`, none defined. |
| **A2** wire both checkers into `scripts/git-hooks/pre-commit` | **FEASIBLE** — precedent claim **CONFIRMED** | `grep -rn check-shape-dispatch scripts/ .githooks/ .github/ Makefile` returns exactly one hit: `scripts/check-shape-dispatch-all.sh:6`, its own usage comment. **The accepted class detector has zero callers.** |
| **A3** add `lint` to `repos/activity-api/package.json` | **FEASIBLE** — doc-drift **CONFIRMED** | scripts are `update-failure-lessons, dev, start, build, build:tsc, check, check:types, check:format, test, test:watch, typecheck`. No `lint`. `repos/activity-api/CLAUDE.md:100` and `:103` and `:173` all assert `bun run lint` exists and enforces the shape contract (law 9 violation). ⚠ `package.json` is ungated but **`repos/activity-api/CLAUDE.md` should be corrected in the same breath** — that is a second file, so a separate goal. |
| **A4** reconciler: advance `last_full_at` before the write loop | **FEASIBLE** | `scripts/substrate/composition-edge-reconcile.ts:512-516` writes `last_full_at` after the edge-write loop (`:444-501`); mode selection reads it at `:162-170`. One abort ⇒ permanent full mode. `scripts/` is ungated. |

### Lane B — `repos/*/src/**`, gated

| # | Verdict | Evidence / caveat |
|---|---|---|
| **B1** pass `walkEv` at goal-host `index.ts:9471` | **FEASIBLE** — and this is the proposal's strongest un-reported find | `verifyGoalReached` signature at `:3084` (6th param optional). Interim call `:9470-9475` passes **five** args. `earlyReachVerdict` set `:9479`; `:9563-9564` `let verdict = earlyReachVerdict ?? await verifyGoalReached(…, walkEv)` — the `??` **does** short-circuit the only capped grader. Data in scope: same function (opts declared `:6077-6079`), `walkEv` is constructible at 9471 exactly as at `:9562`. Cap logic at `:3375-3384` only ever returns `reached:false` — proposal's "can only demote" is **correct**, and the 08-20 report's "distinguishes composed from one-shot" rationale is **wrong**. |
| **B2** pass walkEvidence at `:12304` | **FEASIBLE** | `opts.learningSink` used 7 lines later at `:12311`; `opts.stepSink` in scope via `tap` at `:10634`; opts declared `:10624-10626`. |
| **B3** `lib/tuning-params.ts` omit-not-null + readback | **FEASIBLE as an edit — CAUSAL STORY CONTESTED** | Seam real: `:134-140` binds `updated_by: meta.updated_by ?? null, evidence: meta.evidence ?? null`; migration 152 types both `option<string>`. **But the null-binding mechanism is contradicted by the 08-20 report's own control:** `accelerator-flag-tick.ts:43/63` calls `writeTuningParam(flag, next)` with **no meta** ⇒ binds `null, null` — the *identical* binding as `PROBE_WRITE_READ_20260820`, which read back `7`. Same code path, same nulls, opposite outcome. Do **not** certify "NULL into `option<string>` silently no-writes" as the SF_BLEND cause. The edit is still worth landing for the **readback assertion** (falsifiability), not for the diagnosis. Competing UNVERIFIED candidates: (a) **B5's duplicate scheduler** — two concurrent ticks both read `current=0`, both take the create branch against the `UNIQUE name` index (migration 152 last line); (b) the report's own suspect, a pre-existing non-float `SF_BLEND` row shadowing under `LIMIT 1`. |
| **B4** tuning-params route 404/5xx | **FEASIBLE** | `routes/tuning-params.ts:44-51` — the catch returns `c.json({name, value:null}, 200)`, identical to a genuine absent row at `:39-42`. |
| **B5** delete duplicate `accelerator-flag-tick` schedule | **FEASIBLE** | `src/index.ts:700-709` and `:711-720` are **verbatim-identical blocks**. ⚠ **Sequencing correction:** the proposal says B5 "must land *with* B3." That is unachievable under one-file-per-goal (two files). **Land B5 first**, then B3 — otherwise B3's readback lands into a live double-write race and its first evidence is uninterpretable. |
| **B6** `chain_credit_no_sig` → counted metric | **FEASIBLE** | `posterior-update.ts:735-743` is the `logger.debug` block; `noSigCount` and `total_ancestors` already computed. The conditioned-write complement needs `ancestorSigVersion` (`:704`) — in scope. |
| **B7** bind `execution_id` + `org_id` + `success` on the derive CREATE | **NEEDS-SPLIT** | Seam: `routes/execution-traces.ts:1605-1660`; CREATE at `:1637-1646` omits all three. Data in scope at the call site (`:2361-2367`): `trace.execution_id`, `traceOrgId` (`:1849`), `resolvedCompositionChain` (`:2349`) — but the helper's *signature* takes only 4 params, so the fields must be threaded. Docstring defect **confirmed**: `:1598-1600` claims it reads "the AUTHORITATIVE `execution` table (NOT the frozen `activity_execution_traces`)" while `:1622` reads `FROM activity_execution_traces`. ⚠ **The proposal's §6a claim is partly unfounded:** `resolvedCompositionChain` holds **execution ids**, and its last entry ≡ `body.parent_execution_id` on the server-derived path (`:1872-1877`), so "source the parent from the chain" does **not** eliminate the `activity_id` lookup and does **not** by itself fix the child-before-parent race. Say the weaker true thing: the change is the three-field bind + a provenance stamp + the `edge_derive_outcome` counter. Split: (7a) three-field bind + counter, (7b) docstring + provenance semantics. |
| **B8** `GROUP ALL` + `.flat()` on graph count; `, id ASC` tiebreak | **FEASIBLE** | `routes/activities.ts:8033` `SELECT count() as total FROM activity_composition_graph` — no `GROUP ALL`; consumed at `:8047` as `countResult[0].total` with no `.flat()` while the edges result 5 lines above *is* flattened. `ORDER BY weight DESC` at `:8031` and again at `:8266`, both without a tiebreaker. |
| **B9** thread `predecessor_activity_id` into discover bodies | **FEASIBLE-to-write, VALIDATION-BLOCKED, and the SQL itself likely needs a cast** | Confirmed: `grep predecessor_activity_id repos/goal-host-vessel/src/index.ts` → **0 hits**; the service accepts it (`discover-by-shapes.ts:58/141/169-176/199`). Raw ids available: `chain.push(pick.id)` / `chain.push(c.id)` at `index.ts:9396/8991/8710/9293` store raw discover ids; `normActivityId` (`index.ts:5915-5917`) strips `activity:` and `⟨⟩` — the proposal is right to forbid it. **⚠ NEW, load-bearing:** the outer query is `SELECT id … FROM activity` (`discover-by-shapes.ts:231-236`), so **`$parent.id` is a SurrealDB record link**, compared against `child_activity_id TYPE string` (011-executions.surql:285). SurrealDB does not coerce record = string. Code-evidenced likely, **live-UNVERIFIED** (the ribosome-key 401 blocks the discriminating probe): if true, `comp_row` has **never** matched on *either* branch, `composition_score` has **always** been null, and B9 must include an explicit normalization/cast — threading the predecessor alone would be byte-identically inert. |
| **B10** stable secondary sort by blended `sampledScore` | **FEASIBLE — but §2.0's premise needs correction** | Sites real: `index.ts:8947`, `:9089-9090`, `:9098`, all `.sort((a,b) => scaffoldRank(a,target) - scaffoldRank(b,target))`. Blend real: `readCandidateShapes` `:6019-6041` reads `x.composition_score` as an object and calls `blendEdgeScore(globalScore, edge, …, k)`; `scaffoldRank` (`producer-pick.ts:17-36`) returns `0` for every genuine producer and only reads `sampledScore` on the target-covering scaffold branch. **Correction:** the pre-pick order is **not** "discover's discovery order" — `discover-by-shapes.ts:433` sorts server-side by a per-request Thompson draw (`finalActivities.sort((a,b)=>(b.sampled_score??0)-(a.sampled_score??0))`). So B10's real delta is *adding the edge-blend component on top of an existing draw order*, a smaller and more honest claim than the document makes. B10 is still the difference between B7/B9 mattering and not. |
| **B11** `psi-inputs.ts`: always emit `completion_shapes` | **FEASIBLE, SCOPE MUST BE NARROWED — and it breaks 4 existing tests** | Guard confirmed at `routes/activities.ts:6836-6844` (needs `stateSpaceSig` **and** non-empty `completion_shapes`). **/recommend derives the signature server-side** (`activities.ts:6162-6182`, `stateSpaceSig = callerSig ?? computeStateSpaceSignature({...})`) ⇒ B11 **does** enable ψ there. **discover-by-shapes has no derivation** (`:360-374`, `sigUsable` only; `grep context_thompson_scores` → 0 hits) ⇒ B11 is **inert on the discover path** absent B13. The proposal's fifth-severance verdict and its "P3's read is keyless" kill are both **confirmed**. |
| **B12** add `signature_version` to the cts predicate | **FEASIBLE** | `routes/activities.ts:6084-6087` — `WHERE ${accountIdScopedWhere()} AND context_bucket = $bucket AND template_id IN $ids`, **no `signature_version`**, while the sibling query at `:6192-6196` has `AND signature_version = 1`. Map keyed on `row.template_id` alone (`:6097`) ⇒ last row wins. Rule 1 provably cannot catch it (every column is valid). |
| **B13** server-side derivation + cts read in discover | **CORRECTLY DEFERRED** | Gating it on B6's measurement is the right call; the derivation helper (`computeStateSpaceSignature`) is importable, so it is feasible when unblocked. |

## Multi-file / one-goal-per-file shaping

Four of the B-changes live in one file (`goal-host-vessel/src/index.ts`: B1, B2, B9, B10) and five in `activity-api` spread over five files. All are one-file-shaped **as written**, with these required splits:

- **B7 → 7a/7b** (bind+counter; docstring+provenance).
- **A3 → A3a** (`package.json`) **+ A3b** (`repos/activity-api/CLAUDE.md`) — different repos-relative files.
- **B3+B5** cannot co-land; sequence **B5 → B3**.
- Because identical goal text coalesces, each of B1/B2/B9/B10 needs a **distinct lead sentence** even though all four name the same path.

## Tests that would break / should exist

**Would break:**
- `repos/goal-host-vessel/test/psi-inputs.test.ts` — **4 tests encode the exact contract B11 relaxes**: `:29` "emits NOTHING when the signature is missing", `:71` "THE REGRESSION: an 8-hex host-load hash is refused", `:83` "refuses anything that is not exactly 16 lowercase hex", `:103` "sending NOTHING is the correct fallback, and it is what refusal produces" (with the comment *"an empty object is not a degraded request — it is the request that lets the server be correct"*). These are a **deliberate 08-17 design decision, not incidental coverage.** B11 must argue against them in the goal text, or it will read as a regression to whoever runs the suite.
- `repos/activity-api/test/posterior-update.test.ts:665` ("ancestor without `ancestor_signatures` entry → no cts write") — still passes under the `e19997f` fallback only because the mock rows carry no `signature`. It now tests the mock, not the behaviour.
- `repos/goal-host-vessel/test/producer-pick.test.ts` (6 tests) — unaffected by B10 as scoped (a secondary sort leaves `scaffoldRank` semantics intact), but it is the natural home for B10's new assertion.

**Should exist and does not:**
- **No test anywhere for `writeTuningParam`** (`ls repos/activity-api/test | grep -i tuning` → nothing). B3's readback assertion arrives with zero regression coverage.
- **No test for `discover-by-shapes`** (`grep -i discover` → nothing) — the `comp_row` id-form comparison, the `predecessor` vs `GROUP ALL` branch, and the FM-1 draw sort are all untested.
- **No test for `deriveCompositionEdgeFromParent`** despite its docstring saying "Exported for tests."
- **No test for the graph route's count/pagination** (B8).
- **B10's own validation must be the unit test** — `edge-blend.test.ts` and `selection-wiring.test.ts` exist and are the right hosts.

## Explicit UNVERIFIED (blocked probes, not empty results)

1. **`child_activity_id = $parent.id` record-vs-string comparison** — code-evidenced likely to never match; the discriminating live probe (`POST /v2/activities/discover-by-shapes` with `include_scores:true`) is blocked by the ribosome-key 401. This is the single finding that could make B7+B9+B10 collectively inert.
2. **SF_BLEND write cause** — the proposal's null-binding mechanism is contradicted by the report's own PROBE control; B5's race and the non-float-row hypothesis both survive. Refutation is itself conditional on whether the probe supplied meta strings, which I cannot verify write-blocked.
3. **Stored id form in `activity_composition_graph`** — the reconciler JSON-stringifies trace-sourced ids (`composition-edge-reconcile.ts:481`); whether that is bare or `activity:⟨…⟩` is a live-data question.
4. **Reconciler's 2026-07-14 abort trigger** — mechanism code-evidenced (`:512-516` ordering), trigger text not.
5. **`edge_kind` is defined** (migration `146-composition-edge-kind.surql:29`, plus `edge_kind_source` in 148) — so the 08-20 report's live `edge_kind` histogram was reading a real column. Not a silent-drop instance.
