# WIRING — the goal → learn flow, as built vs as it should be (2026-10-03)

> **Read the "qa ruling — ADOPTED ORDER" section at the end first.** It supersedes the order and the four "should" bullets tagged (superseded).

**Method.** 7 development goals were dispatched on node 1 (L12 interventions; the held-out set was not touched):
- 4 first runs;
- 2 repeats;
- 1 changed-input variant.

The 2 failing first runs served as the unrelated controls. Three read-only investigators traced the executions through code at origin/dev and the deployed state (goal-host acf4922, activity-api 1df2eab, discovery 19e8e78, ribosome 5a374df). qa's expectations are in tmp/flow/EXPECTATIONS-qa.md. **Every posterior reading is CONTAMINATED** while gap idle-ticks-earn-alpha… is open.

Results: reached = 57de00ab, 92a530c4, 4fdbebd6, 59cb8b01, 36f596ab; not reached = 4e4dac67, b3d1dd39. Every reach came from a satisfier.

## The one-paragraph diagnosis
The flow has every organ but almost no correct joints.
- **Selection is unlogged.** The selector that goals actually use (the satisfier plane and the OR-edge bundles) does not log its decisions, and the selector that logs (/recommend) is not what goals use.
- **Six writers compute credit independently.** goal-host reports credit into a table nothing reads, while the stores that selection reads are moved by other writers that override goal-host's withhold decisions in both directions. One of those writers grades on exit status.
- **Verification evidence never reaches the corpus.** The verification corpus is structurally never grounded (the sender omits the evidence fields), and the learner reads 0 labels.
- **Extraction learns from wrong outputs, and they are reused.** Extraction fires on reaches that goal-host's own gate calls hollow, and it binds impulses across concurrent executions. That minted a wrong template, which an unrelated goal then ran.
- **Repeats re-borrow instead of learning.** They show no learning: they re-borrow a shape-signature donor, and lineage is not recorded.
- **Selection ignores belief.** Selection share is uncorrelated with belief: ρ ≈ 0 across 35,730 selections, contaminated.

## Stage by stage

### 1. Inference
- **As built:** `inferGoalTargetDecision` (gh :12976) over `fetchKnownShapes` (gh :5874). It sees BARE shape names (discovery /registry/shapes, plus peer and learned shapes), with deterministic rules plus an LLM fallback.
- **Measured:**
  - a need-phrased goal got ≥1 target: HOLDS (7/7);
  - reads descriptions: FAILS (0 readers; 72/409 shapes even have one);
  - own-substrate vocabulary: FAILS ("Summarize repos/clock-vessel" went to LLM prose because `NOT_PROSE_RE` requires a trailing slash; git_log ran outside a repo, and the web fallback then queried an unrelated external repo);
  - unserved shape → no fabricated target: holds in code (`filterShape`), untested.
- **Should:**
  - fold `/registry/shape-descriptions` into `fetchKnownShapes` (render `name: description` where present);
  - make `NOT_PROSE_RE` accept `repos/<v>` with or without the slash;
  - reuse the file-count path binder (gh ~8771) for git-shaped pointers.
- **Expect:** the clock-vessel summary infers a source-read/registry shape. **Must-fail:** a goal naming `foo_unserved_shape` → `shapes:[]` (a unit test).

### 2. Selection
- **As built:**
  - Reuse is `recommendReachingPath` (gh :6978), keyed by SHAPE SIGNATURE: every reach borrowed a donor (9d3e2add 118/118; 0441a5be 31/31). The pathway head `satisfier:X` (gh :13670) means no Thompson draw (`candidates:[]`).
  - The floor/OR-edge bundles (gh :10820–10917) take α/β from global, unscoped VPM (dbs.ts:261/294). Both branches run and the "winner" is chosen afterwards.
  - Only /recommend writes `thompson_selection_log` (act.ts:7601–7681; 687 candidates; no used_scope column; no state_signature). Partial pooling exists in code but is unmeasured live.
- **Measured:**
  - logged = used: FAILS 3 ways (satisfier steps log nothing; bundle `source:"thompson"` is mislabelled and β goes to a sibling; the recovery loop picks goal-unrelated arms);
  - retired excluded: HOLDS for retired, but 16 deprecated rows stay selectable via /recommend, and a pinned retired id surfaces as "not found" rather than "retired";
  - Spearman ≈ 0.03 (all stores and filters, ρ −0.29…0.06, contaminated);
  - `SATISFIER_PROVEN_BAD_ARMED` is an env gate (law 1): a PROVEN-BAD belief is read and then deliberately ignored.
- **Should:**
  - one decision log: every walk `recordStep` writes the same selection row (source, store, scope, α/β used, correlation_id), with `correlationTag` carried on satisfier and bundle executions;
  - bundles labelled `source:"fanout"`;
  - deprecated filtered everywhere; a pinned retired id refused explicitly;
  - the env gate moved into the shaped selection policy;
  - the pathway reuse policy gets a posterior lower bound, not absolute counts.
- **Expect:** every step execution has a selection row whose α/β equal the step's. **Must-fail:** a satisfier step with no row fails the decision-credit join (decision-credit.ts:187).

### 3. Walk
- **As built:** route-around records only at the no-pick stall (gh :11202) and floor reuse (gh :13635). Hollow terminations (feedback-retry, suppress, widen, reframe) record nothing. The floor tool counter (gh :5379) reads client-side `tool_calls`. llm-resolver returns tool calls top-level (llm.ts:812); dev-vessel's wrapper reads `content.tool_calls` and drops them (llm-completion-dispatch.ts:465–474).
- **Measured:**
  - C6: PARTIAL/FAIL (no route shape; none on 4e4dac67);
  - tools=0/0 is a mis-addressed instrument: 1,976/1,976 floor runs read 0, while 55 final texts say they used a tool. **K4 resolved: the instrument is the finding.**
  - The floor re-ran AFTER a satisfier reach (adding reached=false rows to pathway denominators).
  - One shape has two addresses (the satisfier failed where the floor's ufResolveUrl reached).
- **Should:**
  - the wrapper also reads top-level `rawBody.tool_calls` and passes the executed trace through, and the floor counts it;
  - a `kind:"hollow"` route-around at every hollow-termination site (failed producer + reason);
  - the floor is skipped once the goal has reached.
- **Expect:** a floor run whose LLM used a tool shows `tools_total ≥ 1`, and 4e4dac67's class records "git_log hollow → webSearchResult". **Must-fail:** a text-only floor answer keeps 0.

### 4. Verdict
- **As built:** `verifyGoalReached` (gh :3677). Deterministic verdicts are mirrored by `recordDeterministicLabel` (gh :4284), which returns early for LLM verdicts. `/reach` stamps `verdict_class` and has a supersede history (execution-traces.ts:5438–5476).
- **Measured:**
  - reached ≠ status: HOLDS;
  - **grounded: two different things share the name.** The walk's mint gate was true on the file-count runs. The label's `grounded` (impulses.ts:2995) requires source/probe/expected/observed, and the sender never passes them: **0 of 14,864 labels ever grounded** (positive control: the deterministic labels exist). LLM verdicts never reach the corpus.
  - Y1: `verdict_class` is stamped (62 rows); `superseded_verdicts` has NEVER been written (0).
  - Truncation abstain: 0 hits; not measurable without a positive control.
- **Should:**
  - `recordDeterministicLabel` passes the oracle's evidence (verified-file-count already holds expected/observed);
  - remove the early return so LLM verdicts are labelled as `automated` (the branch exists but is unreachable); *(superseded — see qa ruling §4)*
  - rename one of the two "grounded" fields.
- **Expect:** a verified-file-count reach writes a label with grounded=true. **Must-fail:** an LLM-judged reach stays grounded=false.

### 5. Credit
- **As built: SIX independent writers, no single reader.**

  | # | Writer | Notes |
  |---|---|---|
  | (a) | goal-host /feedback → `impulse_shape_activity_score` | NO reader; this is what goal-host reports as "learning" |
  | (b) | insert-path `applyOutcomeToPosteriors` | VPM / cluster CTS / shape counter, by tags |
  | (c) | /reach `applyOutcomeToPosteriors` | no metadata, so the idle gate is lost |
  | (d) | CTS v0 | reach-gated |
  | (e) | CTS re-derived | **on exit status** |
  | (f) | CTS v2 | |

  Also writing: ancestor credit, ψ, and a dead legacy writer.
- **Measured:**
  - goal-host WITHHELD α for system_load_report, yet writer (b) credited VPM (the tag at gh :12232).
  - goal-host WITHHELD β for 4e4dac67, yet writer (c) added β; writer (e) gave +α to a CTS bucket for a run that did NOT reach.
  - A correct reach adds β too (+0.66 α / +0.34 β).
  - "reach-patch MATCHED NO ROW" filed false `lost-reached-verdict-*` gaps while the rows were reached (K4).
  - posterior-update reads 0 labels.
  - Failure memory steers the prompt and `disableReuse` only, never producer choice, and recorded the wrong pick.
- **Should:**
  - ONE verdict→credit reader: `reachVerdictBody` (gh :1160) carries `alpha_withheld` / `beta_withheld` and /reach honours them;
  - the `reached:` tag is stamped only when goal-host's α gate passed;
  - /reach passes `information_yield` (as the insert path does at :3568);
  - writer (e) is gated on `classifyReach` like (d);
  - writer (a) is retired, or `learning` is built from the /reach response; *(superseded: retired only)*
  - posterior-update reads grounded labels once (4) lands;
  - the failure record feeds selection, not only the prompt.
- **Expect:** a β-withheld walk leaves its last pick's VPM β unchanged (**fails today**: +1 on exec_vx8l7f5j); an idle tick moves nothing at /reach. **Must-fail:** a deterministic hollow verdict still adds β.

### 6. Extraction
- **As built:**
  - The ribosome subscribes over WS, then the reach re-read (`reachVerdictFromTraceRow`), then a census `allSucceeded`, then a POST to goal-host `/run-goal` `targetTemplateId:"ribosome-extract"`. The endpoint is pinned by env (ribosome :88), not discovered.
  - The lifecycle hard-codes `qualityEligible:true`, `goalSignature:null` and `templateAuthor:""`.
  - goal-host's own `mintReachedTrace` (gh :7260) skips satisfier-only/ungrounded/trivial reaches; the two gates disagree.
  - Registration fails because the ribosome declares `shapes:[]` against discovery's non-empty rule (discovery :333): 180×400 in 3h.
- **Measured:**
  - Only reached goal executions extracted: passes BY ACCIDENT. Of 298 ALLOWED in 3h, 272 were dev-vessel ticks (their `reached` column is true; who stamps it is unknown), stopped only by the census.
  - Ungrounded and single-satisfier reaches ARE extracted.
  - Provenance is partial (two goal-hash domains: 8-hex walk vs 16-hex store).
  - **CRITICAL: cross-execution impulse binding.** 3/5 concurrent extract runs consumed another run's output (ias-executor engine.ts:355–380, first match over the shared store). That minted the wrong `learned-satisfier-system-load-report` (advertising shellResult), and **unrelated control 4e4dac67 then RAN it**; every extract still graded REACHED.
  - The replay observer matches anything (`inputShapes:[]`).
- **Should:**
  - slot resolution scoped to the execution (in progress, qa-approved);
  - the reach/extract gate checks consumed-impulse provenance;
  - ONE extraction predicate shared with goal-host (`isGroundedHonestReach` + not-satisfier-only), read from the execution row, not hard-coded;
  - the ribosome serves `extractionPolicy` / `extractionEligibilityPolicy` (which also fixes the 400);
  - tick executions explicitly excluded;
  - one goal-hash domain.
- **Expect:** every extract's consumed impulse ids ∈ that execution's own outputs. **Must-fail:** today's 3/5. Also: a single-satisfier reach yields no extract dispatch, while a grounded ≥2-step reach does.

### 7. Reuse and composition (the learning proof)
- **As built:** reuse retrieval is keyed by shape signature (passes §2.6 for retrieval). The variant rebound the first mile (same `path_signature`, new goal_hash). `pathwayReusePicks` increments only on REUSE-BEFORE-DERIVE (gh 10432/10963), so a satisfier-head reuse writes `reused_from_goal_hash:null`.
- **Measured:**
  - **Confounded:** the first runs already borrowed donors, so no "learned from run 1" signal is possible on these goals.
  - Repeats: same steps (2→2, 1→1), no learned template selected; the only gain was the reached-command cache.
  - Lineage: FAIL.
  - Must-fail: **FAILED** (the unrelated control ran the contaminated template).
  - The compose probe (separate run): D failed; A and B were unused.
- **Should:**
  - count an honoured pathway head as a reuse pick, or pass the donor as lineage;
  - unify the goal-hash domains;
  - a cold-shape discriminator goal (no donor) to show learning from the run's own outcome; *(superseded: chosen by rule)*
  - the compose probe's (a)–(e).
- **Expect:** every path row written after "pathway reuse: accepted" carries `reused_from_goal_hash` = the donor. **Must-fail:** a no-donor walk writes null. And the compose probe's acceptance.

## Cross-cutting
- **No code version per step anywhere** (`state_snapshot.git = unknown`; `vessel_version` unpopulated). As-built findings cannot name the commit that produced them. **Should:** the engine stamps vessel + sha per task.
- **Unauthenticated internal call:** goal-host `landedShaForGoal` sends no Authorization header, so 401s.
- **C21 (node 2 visibility):** not measured. The failure memory and reached-command jsonl are node-local by design; replication last pulled from the hub on 08-22.
- **K4:** the tools counter, the "MATCHED NO ROW" gaps and trace_digest's `failure_mode_type` on success rows are each instruments reporting wrong, not system facts.

## What this means for the goal
The system cannot currently learn correctly, because each joint between the organs is wrong:
- **Learning:** credit goes to unread or conflicting stores.
- **Verification:** verification never grounds.
- **Extraction:** extraction mints from cross-bound and hollow runs.
- **Reuse:** reuse borrows by generic signature without lineage.

A higher landing rate on top of this would just reinforce noise. The order that follows (§7: the slice's first break decides):
1. **Stop the active harm:** retire the contaminated template and stop cross-binding. Both are in progress.
2. **One verdict→credit reader:** withhold flags honoured, idle gate, exit-status writer gated, writer (a) retired.
3. **Evidence into labels:** grounded settable, the learner reads labels.
4. **One decision log** for the selectors goals actually use.
5. **One extraction predicate,** with provenance.
6. **Lineage on reuse;** cold-shape and compose probes as acceptance.
7. **Code version per step,** so every later finding names its commit.

Each step lands with its must-fail control, then the held-out set and the compose probe are run.

## qa ruling (2026-10-03) — ADOPTED ORDER (supersedes the order above)
1. **Stop active harm, widened:**
   - retire the contaminated template, plus the slot-scope fix (both in progress);
   - the cheap extraction part: exclude tick executions and honour goal-host's hollow / satisfier-only / ungrounded gate before an extract is dispatched;
   - the template-corpus audit (the cross-binding quarantine), extended to templates minted from satisfier-only or hollow reaches.
2. **Code version per step** (moved up from 7). It's cheap, and every later must-fail can then name the commit that changed behaviour rather than attribute by timing (K15).
3. **One verdict→credit reader.**
4. **Evidence into labels,** in §2.2 prerequisite order: grounded settable first, THEN posterior-update reads labels.
5. **NEW: re-baseline beliefs.** Fixing the writers doesn't fix the stored α/β, which were built from idle alpha, overridden withholds, exit-status CTS, β on correct reaches and cross-bound extractions.
   - Decide explicitly, as an L12 record: reset arms to priors, OR re-derive them from trace evidence through the corrected single reader.
   - This includes the idle-credit gap's reset decision.
   - Then re-measure ρ(belief, selection).
6. Then the decision log, the extraction predicate (unified, with provenance and one hash domain), and lineage plus probes.

"Should" changes:
- **§5:** the failure record feeds selection as SHARED evidence (a shaped record, replicated like verdict evidence), never from the node-local jsonl (that would be a learned-state fork, K9/C21).
- **§5 writer (a):** RETIRED (goal-host reports what the store says); not rebuilt from the /reach response.
- **§4:** LLM verdicts are labelled `automated`, stay distinguishable (labeler + grounded=false), and never count toward the deterministic-verifier requirement (K3/C2).
- **§6:** the ribosome's goal-host endpoint is resolved by discovery, not pinned by env (K8, law 1); fold this into the shapes:[] registration fix.
- **§7:** the cold-shape discriminator goal is chosen by a held-out-style RULE, not by hand.
- **Cross-cutting:** the unauthenticated landedShaForGoal call joins the credential-caller sweep from ingress step 2.

**Stated plainly:** every reach in this sample came from a satisfier, so the learned-pathway CEILING produced no reach. Together with ρ(belief, selection) ≈ 0, that is the strongest evidence the ceiling is not functioning yet.

**Prior art for step 2 (checked 10-03).** The trace store already has `vessel_version`:
- the type is at execution-traces.ts:449;
- it is persisted (paradigm.ts:369);
- it is tested (execution-traces.test.ts:364).

Its only writer is minibob's MCP. goal-host, development-vessel and ias-executor never send it. Step 2 is therefore a CALLER fix (stamp the sha on every trace write) on an existing organ, not a new field. No live row count was taken (the DB read failed on auth and was not retried).

## qa ruling on containment (10-03)
- **The retire through `activityTemplate_update` is ACCEPTED for this one case,** as an L12 intervention (evidence: upkeep-1790985199131-vghr2u).
  - CLASS GAP: `_update` bypasses `_deprecate`'s evidence gate. Fix: same evidence, or a logged operator-override field.
- **Step 1 gains: re-extraction can NEVER clear retirement.**
  - The ribosome's UPSERT merges and preserves retired/deprecated. Un-retiring happens only by an explicit operator or criterion action.
  - Do NOT version ids (a -v2 would bypass the retire).
  - No re-extraction of system_load_report until the slot fix lands.
- **Throttle: build no unread knob.** extractionPolicy resolved 0 of 1,446 times; that is the same root as the ribosome's "eligibility policy unresolved" WARN.
  - Instead, PAUSE the ribosome's extract dispatch, with a TTL, until the slot fix and the step-1 gates land. (Live action → user approval.)
- **Dispositions:**
  - retire the 2 zero-run id defects (source-code, substrategy);
  - HOLD the 4 advertised≠produced templates and the 10 suspects, pending a POSITIVE CONTROL on the audit comparison. 432 of 1,436 mismatched, which may be an instrument issue (K4);
  - the 577 provenance-unknown templates stay as they are, flagged, and count toward the blast radius.
- **Slot fix:** the scope key is (execution_id, impulse_id), because impulse ids reuse across dispatches. Falsifier: same impulse id in two executions → no cross-binding.
- **Node 2:** verify the retire by effect there too. Minor gap: a pinned retired id says "not found" instead of "retired".

## Positive control result (10-03): the audit's mismatch count was an instrument artefact
- **The instrument is sound on the control set.** The 7 seeded tick templates showed 0–2 mismatches per 600 runs, all of them failed runs. `output_impulse_shapes` is the union over the steps that produced output (trace-sink.ts:384), so a failed final step records only the intermediate shape.
- **Corrected comparison:** success=true runs only, last task's output vs advertised. 1 mismatch in 321 successful runs, which is exec_pcg54bbs itself.
- **Confirmed contamination = 1 run** (system-load-report, retired). llm-completion is suspect only. The 10 suspects must be re-checked under the corrected comparison.
- **NEW CLASS: dead mints.** execution-trace (0/296), substrategap-write (0/102) and memory-note-write (0/18) never succeed: the step-2 binding never works. They stay selectable.
- **Impulse id reuse CONFIRMED.** goal-host index.ts:7451 runs a per-walk counter (`walk-<shape>-<n>`). 289 ids are reused across 2+ dispatches; walk-shellResult-3 alone appears in 351. Every join on impulse id (slot binding, relevance, lineage) merges unrelated impulses.
- **Node 2** is PROFILE=compute with no DB of its own. It reads node 1's activity table through node 1's activity-api, so the retire is shared (shown by config, not by effect).

## qa rulings after the positive control (10-03)
- **Retire the 3 dead templates through the EVIDENCED `_deprecate` path.** If it refuses with hundreds of failures as evidence, that refusal is a finding about the deprecate gate: report it, don't route around it.
  - Live evidence for the retire sweep (§2.5 item 3): templates with 0% success and α+β ≥ 30 stayed selectable.
- **dispatch-goal: KEEP.** Infrastructure failures abstain (K14).
- **The 10 suspects:** re-check under the corrected comparison before any hold.
- **"1 confirmed" is a LOWER BOUND.** The check is shape-level and blind to same-shape, wrong-content cross-binding. The extraction PAUSE stands until the slot fix lands; a content audit needs provenance (step 1).
- **Impulse-id reuse is its own HIGH.** It corrupts relevance scoring and lineage too. Fix: execution-qualified, globally unique ids at mint. Falsifier: two dispatches never share an id, and relevance updates for one never touch the other.
- **Node 2:** if its key is rejected by node 1's activity-api, node 2's selection may be failing silently. Measure by effect.

## Node 2 and suspect re-check (10-03)
- **Node 2's template path works.** ApiKey → 200; the earlier INVALID_AUTH was the probe sending Bearer.
- **NODE 2 HAS NO CONCEPT RECALL.** goal-host pins recall to 127.0.0.1:8401/egress, and federation-transport is masked by the compute profile. Result: 1545 recall failures in about 9h.
  - The same dark 8401 is advertised as the producer of federation_verification_report on both nodes. That is why two fed-report templates are at 0% since 10-02.
- **The retire sweep sends Bearer → 401 → sweeps nothing** (a gap exists). This is why 0%-success templates stay selectable.
- **activity-api, 1711 401s in 24h:** 1188 with no header; 323 rejected keys, including an UNIDENTIFIED 8-character test-style credential. Source addresses aren't logged.
- **Node attribution is missing.** origin_* is stamped by the receiver, so node-level lineage is impossible.
- **The 10 suspects show 0 corrected mismatches.** Three are at 0% since 10-02 because of missing resolvers (shellResultProcessor; the dark 8401).
- `failure_mode.type="execution_error"` appears on every success row, so the field carries no signal.

## qa (10-03): dispositions and priorities
- **Suspects:** release 7. HOLD 3 (shellresult-to-memorynote-write; the 2 fed-report templates) with reason "producer absent: <name>", auto-released when the producer registers. They belong to REALIGNMENT §4.1, the unregistered-resolver class. llm-completion stays suspect.
- **#1 node-2 recall / dark 8401: HIGH.** COUPLED to the user's federation-containment decision: stopping transports would turn recall dark on every node that routes recall through 8401.
  - Recall must route by shape to the local concept-db FIRST (as with boredom).
- **#4 auth failures: HIGH.**
  - Step 1: log the remote address and user-agent on activity-api auth failures.
  - The 8-character key looks like test residue hitting a live endpoint.
  - The 1188 calls with no header are internal callers silently failing, so dark features. They join the credential-caller sweep.
- **#5 origin_* and the failure_mode field:** file both. failure_mode is a K4 instrument fault: stop using it in analysis.
- **§4 verdict:** reached≈0 even on successes. Must-fail control: a deterministically verified success → reached=true.

## Slot fix: qa APPROVED (10-03)
- **Commits:** ias 3f6d8c4 and gh c8bf673; 18/18 in qa's own copy.
- **Ordering:** land ias first, confirm the fan-out, AND use a namespace import with an optional call in goal-host. When the gate is missing, degrade LOUDLY (a distinct log line plus a gap).
- **The no-provenance fail-open window** needs an explicit, recorded end condition.
- **Extraction pause condition:**
  - (i) the slot fix deployed on all nodes, by effect;
  - (ii) consumedProvenance crosses the trace-sink wire, with an activity-api reader and a ribosome gate;
  - (iii) the step-1 extraction gates.
- **HIGH:** goal-host.ts:810's recommend state signature reads the whole shared store. This is the read-side twin of the binding bug.
- **Impulse-id format:** UNVERIFIED. The cockpit execution_trace doesn't render impulse ids (a cockpit gap), and a DB read needs user approval.

## Slot fix: final (10-03). qa confirmed goal-host 2ddb3f4, 13/13.
- **Push order, once the user clears it:**
  1. ias 3f6d8c4;
  2. confirm the shared-package fan-out to every consumer;
  3. goal-host c8bf673 + cc6f37b + 2ddb3f4.
- **Post-deploy check by effect:** inspect the consumedProvenance of one composite trace. buildCompositeTraceFromChain is untested because it lives in index.ts.

## Deploy times (10-03 UTC). Traces carry no code version; split measurement windows here.
| Change | Repo / sha | Live on node 1 |
|---|---|---|
| identity: failed queries log param names only | identity-vessel 7ce0af3 | 01:55:18 |
| OBO validation; idle-test guard fix; check-first scratch tests | activity-api 0e92a70 | ~02:06 (no runtime change for the tests) |
| slot binding by (execution, impulse) | ias-executor-ts 0f38dc0 | fan-out healthy 02:08:56 |
| key-logging glue, secret scan, pull-sync starvation-break + aging | super-repo 60ae05a0 | glue 02:09; gate promoting through shadow |
| deferred-cutover own-check (fail closed) | development-vessel 040d7e1 | mirrored 02:16:19 (restart deferred while in flight) |
| foreign-consumption gate (reach + strict mint) | goal-host a6e3506 | next pull-sync tick after ~02:20 (confirm) |
| unmeasurable own-check counted and demoted | development-vessel 3770906 | pending tick |
| state-signature check-first test (test only) | ias-executor-ts f155e05 | 02:28:45 (unneeded consumer fan-out) |
| pooled-query check-first test (test only) | activity-api f060319 | pending tick |

## WIRING step 3 (qa, 10-03)
Step 3 consists of:
- gap 1: one grading occasion with two-sided abstention, in activity-api;
- gap 2: the hollow withhold, consumer first, then producer;
- the single decay rule.

Step 5 (re-baseline) runs only after all three land and are verified by effect. The legacy 8-hex reader (activities ~6474) is measured before anything is folded in.

## Step 3: target design (REALIGNMENT §2.2, "The unit of evidence", amended 10-03 by user review)
Sequence: land gap 1 (one grading occasion, two-sided abstention) and gap 2 (the hollow withhold, consumer first, then producer) as already scoped. Then extend the key. The target design for the credit reader:
1. **The particle.** The execution record carries the candidate set and the selection propensity at decision time. Today only `candidates_count` is logged, and only on `/recommend`; satisfier and bundle picks log nothing (§2 above).
2. **Code version.** The record carries the arm's code version, and evidence is grouped by it. A changed arm opens a new evidence group. Time decay is for drift in the world, not for code change. One decay rule (this replaces the two-writer decay gap's "pick one" with "decay for drift only").
3. **Keying.** Credit, reuse and "reached" are keyed by (arm, target shape, goal class = parse + command + oracle class), with the verdict's instrument recorded. Never by arm or shape alone (which averages unrelated tasks sharing fileEditResult or shellResult), and never by goal_hash alone (which transfers nothing to near-misses).
4. **Fold, not step.** The update is an idempotent fold keyed by (execution, observation). Double grading becomes impossible by construction rather than by guard; a re-baseline is a re-fold; a wrong verdict is retracted by superseding it. (Gap 1's interim verdict-source tag is the measurement bridge until the fold lands.)
- **Execution-scoped selection context:** the armed ias gap recommend-state-signature-… (check-first test f155e05, confirmed red).
- **Pathway signature includes the acceptance class it passed:** extraction (§6), minting only from reached executions.
- **Acceptance (from §2.2):**
  - two identical runs, one alone and one beside unrelated concurrent executions, select from the same context;
  - same target shape with different goal classes updates different cells;
  - an arm's code change opens a new evidence group;
  - a hollow walk and an ungraded exit leave the posterior unchanged;
  - each logged decision can be reweighted from its recorded candidates and propensity.
- **Prerequisite (R2-P11):** grounded settable by a passing control comes before posterior-update reads labels (step 4).

## Armed for the lane (10-03), each confirmed red at a sha containing its test
| Gap | Repo | Test commit | Birth verdict |
|---|---|---|---|
| recommend-state-signature-… | ias-executor-ts | f155e05 | present at f155e05 |
| the-pooled-authenticated-query-path-… | activity-api | f060319 | present at f060319 |
| active-dispatches-pagination-test-file-fails-to-load-… | goal-host | 0cf7800, df1880f, 1ecacf5 | present at 1ecacf5 |

## Addendum folded (qa-CONFIRMED 10-03): capability, closure, vocabulary
Full text: WIRING-ADDENDUM.md (sections A capability construction and content threading, B closure after output, C vocabulary and intent), written by the human-surface session's three read-only investigators. The adopted order gains:
- **Step 1, stop active harm, adds:**
  - (a) the NARROW 77785f4 fix: deliverable-shapes admits a composite's terminal when every task RESOLVER is advertised. Must-fail: obsidian:write_note with no live producer stays non-aimable. Must-pass: conceptDescription with an all-live-resolver composite. It is one shared function that step 3's "claimed" predicate extends.
  - (b) an SF_BLEND latch OFF-PATH, in code. The blend stays ON until a reach-graded A/B split by author and kind.
  - (c) retire, or make honest, concept-db's hollow write advertisements (supersede, retire, delete answer 400).
  - (d) CALLER-LOSS (static, at diff time) and CONTRACT-MISMATCH (by effect, at the packages/ HTTP seam) detectors, sharing one gap output, plus a backfill since 06-01. Findings become gaps or retirement records, not restorations. K6 fixtures; af61dee and the hydrate are the positive controls.
- **Steps 2, 4 and 5:** unchanged.
- **Step 3:** after gaps 1 and 2, inside the single reader:
  - B§1 publish graded, content-bearing outputs (secret scan; PERMISSIONS on org_id);
  - B§3 offer, with composition_impulse_flow rows and a named reader;
  - B§4 offered-consumption credit (the 07-20 law) in the §2.2 fold;
  - A§4 content threading (author-producer slot-append via acc.ts:521-539; unresolved placeholders fail);
  - the C§1 claimed predicate (the 06-04 ruling enforced; coverage-tick stops rewarding novelty).
- **After step 3 plus the extraction gates (this activates minting):**
  - re-author the af61dee callers as a LANE GOAL, with the old body as reference and no revert. Must-fail: an in-run mint that does not reach is retired or held provisional.
  - the 5c974cb7 envelope fix, after resolving the VesselResolver contradiction.
- **Then step 6.**
- **Then class capability:** solicitation at the stall, credentials by locality, floor tools, vesselization. Acceptance: two held-out probes of "unserved outbound shape → compose, credential, send, read back". Stage must-fail: a send with no read-back never grades reached.
- **The standing-pool hydrate:** DELETE (born broken, no consumer; B§3 replaces it).
- **Pending the user:**
  - "one execution" restated as one dispatch that may SUSPEND on a prerequisite and RESUME, not restart;
  - two read-only DB reads: attributing the 620/24h wrong-form rejections (trace state_space_signature joined to cts_sig_lookup), and the #8 used_scope count.

## Constraint on step 5, re-baseline (measured 10-03)
The execution table caps at 150k rows. At about 13.8k executions/day that is roughly 11 days of retention. A §2.2 re-fold can only re-fold observations still retained, so evicted evidence cannot be re-derived. Step 5 therefore chooses one of:
- re-fold the retained window and reset older arms to priors, with the cut recorded;
- persist the fold's inputs (verdict observations) outside the capped table before the re-baseline.
Recorded with the admission-cap gap (selection-candidates-are-silently-truncated-by-recency-at-the-admission-cap).

## Step 1(d), amended (qa, 10-03). This supersedes the "two new detectors" wording in the addendum fold above.
- (i) **EXTEND orphaned_capability_scan; build no new detector.** Its notion of a caller becomes template invocations plus static code call sites plus git history. If a call site was removed, file a restore-or-retire gap naming the commit; if it never had a caller, keep minting as today. Must-fail: running it on af61dee^ vs af61dee flags author_composed_capability with af61dee named. (The existing scan measures "no template invokes X", so it could not see af61dee, 5c974cb7 or d737edb; its orphaned-capability-author_producer row, detected 10-01, is not detection of the af61dee loss.)
- (ii) First read the 42 REJECTED orphaned-capability gaps' rejection reasons. They measure what the mint prescription gets wrong: "detection never becomes repair".
- (iii) CONTRACT-MISMATCH: only the non-2xx-by-effect counter at the packages/ HTTP seam, and only after checking whether jointBinding, joint-liveness or self_fact_reconcile rows already cover it. The declaration-drift scan at 0 ticks is a finding to file or attach.
- (iv) The backfill is the one-time run of (i) over history since 06-01.
- **Prior audits, cited, not restated:**
  - COMPOSITION_WIRING_AUDIT and SELF_DEVELOPMENT_WIRING_AUDIT (08-13);
  - WIRING_CORRECTION_METHOD and cross-vessel-wiring-repair (08-28/29);
  - MECHANISM-AUDIT and WHY-THINGS-KEEP-BREAKING (09-28);
  - REALIGNMENT (09-29).

## The plan of record becomes executable (user observation; qa-approved 10-03)
**Why the synthesis documents go stale (user):** progress is made, then something regresses. The regression gets fixed, the goal still fails at the next broken joint, and a new synthesis is written instead of the old list being continued. No synthesis re-runs, nothing ties a change to its effect, and several joints are broken at once.

**The rule.** REALIGNMENT §2.1 (Rank 1: one standing expectation evaluator, proven able to fail, that every mechanism registers into), executed by REALIGNMENT §7 step 2, IS the executable plan of record. This adds only three things:
- every WIRING and WIRING-ADDENDUM must-fail is a registered row;
- WIRING becomes a VIEW of those rows (REALIGNMENT §8; law 9), updated by them, not rewritten by the next audit;
- each later step lands with its must-fail REGISTERED as a standing row, not only run once.

The organs that carry it already exist: self_fact_reconcile rows (selfFactSpec), the expectation and expectation-trend batteries, and rhythm scheduling. No new probe runner (09-28 ruling).

**Placement.** REALIGNMENT §7 step 2, run immediately after WIRING step 2 (code version per step), because per-commit attribution of a red row depends on it. Until step 2 lands, a red row names the deploy window and the commits deployed in it, not one commit.

**Must-fail for the mechanism:**
- sever one joint, in a fixture or sandbox node only. Its row goes red within one tick; repair turns it green within one tick; the class row stays red until all of its joints are green;
- positive control: an intact joint's row stays green over the same ticks;
- completion: each tick, rows evaluated per node = rows registered per node. A row that silently did not run never reads as a pass.

**qa's constraints:**
1. **Held-out burn.** Class-acceptance probe runs are quarantined from learning: a probe tag on their traces, excluded by credit, extraction and failure memory. Must-fail: after a probe run, no posterior or template changes. Slow cadence; fresh sealed probes rotate in on a schedule.
2. **No self-certification.** A landing cannot edit or weaken the row that judges it in the same change. Rows change only through the criterion path and are evaluated by the already-accepted evaluator. (See also the gap the-lane-can-edit-the-gates-and-tests-that-judge-its-own-landings.)
3. **Outputs.** Results go to a sandboxed row store, never to memory, conventions or traces. Red becomes work: N consecutive red ticks files or bumps exactly ONE deduplicated gap per joint, citing the row, through one gated path (no repeat of the 09-22 flood).
4. **Instance and class rows are tagged.** An instance row retires when its joint is retired or replaced by a class row.
5. **Spend.** Spend per rhythm is declared within the $5/h envelope. Row and probe dispatches are excluded from the lane's reach and close-rate denominators.
6. **Reporting.** "N/M rows green" is NOT the headline (law 7: registering easy rows games it). Progress is reported as the gap triple, with row state as evidence.

## RULING (user, 10-03): one execution. This replaces the PENDING item above.
"So long as the dispatch is 'live' and not graded it counts as one execution. It can pause while waiting for a human to provide credentials iff it is through an interface the system provides (a shape)."
1. **One execution** is one dispatch from start until its reach verdict is graded. Suspend and resume inside that window count; a new dispatch or a re-grade does not.
2. **The pause goes only through a system-provided shape**: the human as resolver via a shaped request, never an out-of-band ask, an operator edit or an env change.
3. **A credential never enters the pool, the trace or the LLM context.** The solicitation answer path (opts.variables.human_input) must not carry one. A shaped value-blind credential entry is required, writing to the secret store under the 10-02 secret_set ruling, with the walk receiving a reference by name. This is the missing shape, filed as a-human-supplied-credential-has-no-shaped-value-blind-path-so-solicitation-would-put-the-secret-into-the-run.
4. **Grading waits for a suspended dispatch.** No reach verdict is written while it is paused on a human.
   - Timeout outcome (coordinator decision): grade "not reached: prerequisite_unmet", tagged with the prerequisite class. The ARM ABSTAINS (no α, no β), because the arm did not fail.
   - The class tag feeds demand for the prerequisite (wrongness as a goal seed).
5. **Outbound-class acceptance uses this.** Within ONE execution: suspend for the credential through the shape, resume, send, read back, then grade. A send with no read-back never grades reached, and a probe whose credential arrived out of band does not count.

### One-execution ruling: qa's endorsement and additions (10-03). Resolves addendum pending item (c).
- **Durable "live".** A suspended dispatch survives a goal-host restart and pruneStore. Today the node-local dispatch file blanks provenance past 100 records and deletes them past 2000, so suspension needs durable state.
- **Attributed answers.** The answer carries the human's identity (human as resolver, law 13). The request is visible on the surface and addressed by discovery, never pinned. The surface's routes are unauthenticated today (§9.0), so a surface answer cannot carry a verified identity until route auth lands.
- **Credential constraints:**
  - a solicited credential may only SET the declared name its solicitation requested;
  - an overwrite needs compare-and-set (expect_sha);
  - fleet and identity secrets are never writable via solicitation;
  - the new value is validated (one authenticated read against the target) before it goes live, with rollback by hash;
  - the secret store version references the solicitation id.
- **The timeout outcome**, consistent with the coordinator decision above:
  - counted NOT reached in reach statistics;
  - an abstention in credit (no β; an unavailable observation is not a negative, §2.2);
  - it files or bumps the prerequisite gap;
  - the timeout length is a shaped policy value, not an env constant.
- **Must-fails:**
  - (i) a suspended dispatch that resumes because of an OUT-OF-BAND change (an env edit, a file, or a secret version not linked to its solicitation id) never grades reached. A credential set via secret_set BEFORE dispatch is legitimate setup.
  - (ii) after a credential-via-shape run, a secret scan finds 0 hits across the trace, pool, dispatch record, prompts, the surface → sidecar → secret-store hop logs, journals and replication.
  - (iii) a re-dispatch after grading is a second execution; a "resume" arriving after grading is refused, not appended.
  - (iv) durability: suspend, restart goal-host, push dispatches past the prune window, answer, and it resumes the SAME dispatch.
  - (v) a solicitation answer naming an existing fleet secret is refused.
- **Order.** The shaped secret path comes AFTER the key-rotation runbook (awaiting the user). No identity or secret state is touched until the user approves that runbook.

### Executable plan: prior art and preconditions (qa, 10-03)
**These are restatements.** The executable plan, suspend/resume with credentials, and the withdrawal of "done" are already traced by REALIGNMENT's dossiers (docs-drift, dormant-mechanism, false-verification, human-surface-escalation, credential-hygiene). The common root of the earlier attempts:
- checks never connected to gap closure (filed with falsifier none, no landing path);
- checks never shown to fail;
- "done" judged by proxies.

1. **Diagnose the flapping first.** The plan's only live home is self_fact_reconcile (15 data rows, scripts/substrate/self-facts.json). Of its 34 self-fact-divergence-* gaps, 13 are open, with reopen_count up to 28: closures flap. Before any WIRING must-fail is registered as a row, find out why. Candidates: the fencing-root class, a stale write flipping an honest false, a predicate without hysteresis. Registering more rows into a flapping evaluator multiplies noise.
2. **Row equals falsifier.** A row's red files a gap whose class-2 falsifier IS that row, so the row going green is the closure. Every row has a recorded must-fail run before it counts.
3. **Doc rows use the same closure.** 27 docs-drift-* gaps are open and none has ever closed; "WIRING as a view" must not become number 28.
4. **Solicitation durability is a known failure, not a hypothetical.** solicitHumanInput keeps pending state in process memory (default ≤120s), so must-fail (iv) of the one-execution ruling fails today.

## First lane landing of an armed check-first gap (10-03): SUPERVISED (S2)
- **ias-executor-ts ed58e66** (Substrate Autonomous, 02:58:05Z, on origin/dev) is the lane's fix for recommend-state-signature-…. It drops the store-wide `store.all()` read from GoalHost.runGoal's state signature, which is now goal plus seed impulses.
- **Verified:**
  - the cutover re-ran the gap's own class-2 check on the staged tree (`[cutover-own-check] outcome=own_check_passed`, the 040d7e1 gate);
  - f155e05's two tests pass at ed58e66 (operator and qa, independently);
  - the full ias suite shows 394 pass / 25 fail, with no new failing names.
- **qa: correct scope.** The signature is built before the execution produces anything, so goal plus seeds IS its own state; the ownership ledger isn't needed there.
- **Deployed:** the node-1 fan-out reported healthy at 03:10:17Z; the dist has no store.all() read.
- **Live callers:** goal-host host.runGoal (ribosome-extract, the recovery/target path, auto-draft). goal-host's walk uses its own recommendExcluding, which sends no impulse_shapes.
- **Still owed:** a consumer effect check, i.e. one live /recommend from a runGoal path whose signature is built only from goal plus seeds.
- **Side effect:** seed entries no longer carry task_id (the producedBy mapping is gone). If activity-api's signature derivation uses task_id, seeded and recovery cells are re-keyed and start cold. That's acceptable under the pending re-baseline; split measurement windows at 03:10:17Z.
- **Classification:** SUPERVISED (S2). The gap was operator-armed (directed:true) with an operator-written check. It is the milestone's shape, a lane-authored landing on origin/dev verified by its own check, but NOT detection-originated autonomy (REALIGNMENT §11 "operator-free" acceptance).

## Operator-caused outage window: 03:28-03:40Z, 10-03 (L12)
- **Cause:** an operator session ran an unfiltered host-wide `kill` over every process named `surreal` (meant for throwaway test instances). Rootless podman container processes share the operator's uid, so it SIGTERMed node 1's live SurrealDB, and probably the other DB-hosting containers.
- **Duration:** about 12 minutes without a database, until node 1 restarted around 03:40Z (restarts also at 03:30-03:31Z).
- **Treat it as excluded or marked in every measurement window:** selection and elimination, reach verdicts, failed traces, the lane's landings, and the ed58e66 post-landing effect window. It is not a system fault, and nothing should learn from it (failure memory, credit, extraction).
- **Correction:** an earlier DB "inactive" reading attributed to key rotation was this kill.

## Cross-version posterior write: LATENT, not a step-5 constraint (corrected 10-03)
The insert-path context_thompson_scores UPDATE (ctxSql/rdSql) omits signature_version from its filter, so a v0 write COULD increment a v1 cell with the same (org, template, bucket); a fixture showed it. **Measured on node 1 (read-only, WITH NOINDEX): ZERO v0/v1 colliding keys among 10,506 v1 keys, so 0 of 765,717 v1 observations sit in a colliding cell.** The two versions use disjoint bucket formats: v0 is 8-hex, v1 is 16-hex or cluster:…. Current v1 data is NOT contaminated, and this is not a constraint on the re-baseline. The defect is latent (it bites only if the formats ever coincide). The test pins it, so a fix cannot rely on format luck. Recorded on the-trace-ingest-request-path-scans-two-whole-tables-for-learning-writes. (An earlier version of this section, 4b2a82fa, recorded it as a step-5 constraint before measurement; superseded.)

## Step 1(d)(ii) answered (10-03): the 42 rejected orphan gaps record no reasons; the scanner is the defect
**Of 89 orphaned-capability-* gaps (42 open, 42 rejected, 5 closed), every one prescribes `mint`, and all have candidate_consumers [].**
- 35 of the rejected are the 10-01 phantom rows (node 2's stale-store closes turned into inserts, then quarantined).
- 7 are scanner auto-rejects on one missed registry sample, with no actor or time recorded. Their producers are live, mostly with code callers, or are placement-dependent: the transport's substrateBootstrap, and metabob-mcp's session-scoped shapes.
- **No restore candidates among them.** The 5 closures record no reason.

**The scanner (development-vessel src/resolvers/orphaned-capability-scan.ts @3770906):**
- "Caller" means template tasks only. A substring grep over repos/ then drops any shape with a hit, which also matches the producer's own registration, so the rewire branch (:286-292) is dead and every emitted gap says mint.
- It is blind outside repos/ (scripts/, packages/, seeds, JSON) and does not use git history.
- Reject is terminal and untyped (:366-390), and nothing closes an open gap when its shape gains a caller.
- Any closed orphan gap suppresses its shape forever (:335-357), and hyphen/underscore duplicate ids slip past.

**Requirements for 1(d)(i):**
1. A caller is an invocation OUTSIDE the producer's own vessel; registration and bare mentions are excluded.
2. Widen the roots (scripts/, packages/, plain-file vessels, seed and template JSON, non-.ts files), with a positive control proving the root is populated.
3. Use git log -S per repo to name the commit that removed the last external caller, and prescribe restore-or-retire; mint only when no caller ever existed.
4. Reject only after N misses or a positive control, recording actor, time and registry fingerprint; classify session-scoped and placement-dependent registrants as placement; make reject non-terminal.
5. Add a typed close (consumer_appeared: file:line or commit); stop treating every closed gap as bridged; normalise ids.
6. Treat the 35 phantom rows as the 10-01 incident.

The plan's must-fail (author_producer / af61dee) is in the OPEN set.

### Counting rule: phantom rows excluded (qa, 10-03)
Until the 10-01 phantom rows are retired through the gap store's own typed path (a quarantine or retire status naming gap-lifecycle-scan-on-a-non-holder-node-closes-live-gaps-from-a-stale-local-copy; never a hand edit of gaps.json), every store-derived count excludes quarantined or phantom rows and says so. A count that silently includes them reintroduces the false-baseline class.
- Correction to the orphan figures above: excluding the 35 phantom rows, the real orphaned-capability set is 54 (42 open, 7 rejected, 5 closed).
- Docs-drift, reopen and other store-derived totals in this document were counted before this rule and may include phantom rows.

## Operator load: items that are operator-only because of autonomyScope excluded_paths (count, 10-03)
Measured from the live autonomyScope pool row. The count is how load-bearing the operator still is (qa); re-count as items land or paths leave the list.

| Excluded file | Operator-only items (10-03) |
|---|---|
| development-vessel src/resolvers/vessel-mitosis-cutover.ts | 4: the fail-closed own-check (040d7e1, operator build); unmeasurable-check demotion (3770906, operator); a-node-can-land-with-landing-gate-code-older-…(cutover half); the-precutover-suite-gate-fails-open-… |
| development-vessel src/resolvers/gap-lifecycle-scan.ts | 2: orphan-scan expiry via the scan record (step 1(d) ruling 4); the-gap-demoted-for-a-broken-own-check-… re-derivation path |
| goal-host-vessel src/index.ts | 2: code-version sink wiring (the-code-version-stamp-is-never-produced-…); the hollow-withhold producer (hollow-walk-withhold-is-never-sent-…) |
| scripts/substrate (pull-sync, a gate path under P) | 4: starvation break (b3db2b91/d7528ae4, operator); stale-gate suppression and deferred restart; load-regression names; fan-out keyed on content |
| development-vessel src/resolvers/feature-compose.ts / gap-to-feature.ts | 1: 5c974cb7 envelope fix (after step 3 and the extraction gates) |

**Total: 13 operator-only items on 5 excluded areas.**

**Proposal (qa; user's decision): slice L's first concrete criterion.** A path leaves excluded_paths when its armed check-first suites cover the behaviours that regressions there have historically broken, judged by the accepted evaluator through the criterion path (Delta 3, REALIGNMENT §7 step 9). The suites armed tonight on cutover and gap files are the evidence such a widening needs.

## Lane landings tally, 10-03 (qa wording)
| Landing | Authorship | Gate | Status |
|---|---|---|---|
| ias-executor-ts ed58e66 (state signature) | lane-authored (operator-armed: SUPERVISED) | own check PASSED at cutover (node 1) | consumer effect check still owed, in a clean window after 03:40Z |
| activity-api fa73778 (pooled query) | lane-authored (operator-armed) | UNGATED: node 2 ran pre-gate code | correct by its own check (2/2) |
| libp2p-federation-transport 69256d9 (noise cipher) | lane-landed but OPERATOR-DERIVED (byte-identical to the network session's verified patch) | landed_unverified; post-land suite ran=false; the sweep is set to close it landed_verified on a literal | unmeasured AND NOT LIVE: the transport runs the image-baked copy (e1c06f60), so the fix runs nowhere until an image rebuild and recreate |

**Autonomous AND gate-verified: 1 of 3, and not yet by effect.**

New rule filed (qa): a landing with no measurement that actually ran is REFUSED (no_measurement_available), not landed.

## USER RULING (10-03): scope widening on evidence is ADOPTED (REALIGNMENT §7 step 9, slice L's first criterion)
**Criterion:** a path leaves autonomyScope excluded_paths when its armed check-first suites cover the behaviours that regressions there have historically broken, judged by the accepted evaluator through the criterion path, never by operator fiat.
- **Evidence base:** the check-first suites armed 10-03 on cutover and gap files (fail-closed own-check, unmeasurable demotion, orphan scanner and expiry, stale gate version) plus the regression inventory (51 regressions, 09-19 → 10-03).
- **Working the criterion per excluded file:**
  - list the historical regressions there;
  - map each one to an armed must-fail;
  - an uncovered regression keeps the file excluded and names the missing check.
- **Effect:** each file that leaves the list reduces the operator-only count above, the measure of operator load.

Also ruled 10-03:
- **The deployment session owns image tagging:** both the re-tag of public :dev to the accepted sha, and CI publishing only from the accepted sha (6b).
- **SurrealDB 2.3.3 → 2.3.10 is approved,** rolled out by the deployment session per node.
- **Cockpit reconnect:** deferred.

## Security rollout from the accepted image 60ae05a0 (10-03): image recreate times (UTC)
| Node | Image recreate | Loaded-blob check | Notes |
|---|---|---|---|
| node 2 (compose2-live) | 03:33:50 | all MATCH 60ae05a0 | transport masked (user's temporary mask); secret-mask canary pass |
| syzygy-local-surface | 04:47:00 | MATCH; relay at 60ae05a0 (af119736 absent) | discriminating not-owner check PASS (old image FAIL) |
| syzygy-local-inventory | 04:49:22 | MATCH | not-owner check flipped FAIL→PASS on the same container |
| pubspoke | 04:51:35 | 8/8 MATCH | secret-mask 0 VISIBLE (dbus residual cleared) |
| node 1 (substrate-live) | 04:59:39 | 9/9 MATCH; relay at 60ae05a0 (af119736 absent) | secret-mask 0 VISIBLE (dbus and surrealdb residuals gone); rotation intact (PREVIOUS empty) |

The SurrealDB 2.3.10 upgrade follows per node as a SEPARATE deploy event, after that node's image recreate, with its own time (law 12).
- 326061de's ingress half is verified by effect (the discriminating check); its egress half is verified by hash only.

**USER RULING on public :dev (told directly to the deployment session).** Install acceptance stays the authority, and CI is already gated (INSTALL_ACCEPTANCE_GATES_DEV=true). af119736 became :dev only after accept, network and upgrade passed on both engines, so public :dev is NOT rolled back.
- **The real hole:** acceptance never exercises the change it promotes. The deployment session adds a large-frame concurrent-read check to the network leg and re-judges af119736 with it.
- Local nodes stay pinned to 60ae05a0 until that check passes.
- (This corrects the coordinator's earlier claim that CI publishes :dev ungated from HEAD.)

### Scope criterion, first application: vessel-mitosis-cutover.ts STAYS excluded (advisory evidence for the evaluator, 10-03)
**Regression history:** 119 commits on the file, 15 regression classes. (R) marks a class that re-broke after a fix.
- A, stale-base overwrite (R)
- B, the lane edits its own drift gate (R)
- C, precutover baseline (R)
- D, commit-tree misfire (R)
- E, deferred typecheck-only landing
- F, self-restart, quiesce and coalescing
- G, pending lock and dirty index (R)
- H, landing trace (R)
- I, drafter-corruption and parse guards
- J, evidence deletion
- K, lease and change window
- L, mirror gated on push
- M, soft-refuse shape
- N, land credit despite failed verification
- O, stale gate on a node

**Coverage:**
- **Strict reading (armed means an evidence_resolve row): 0 of 15.** The only armed cutover test, "refuses cutover when staged_base_sha is missing", is RED and subtracted from the gate as tracked-red. It is also mis-aimed as the check of route-edit-61819178, whose edit_site is patch-with-tools.ts.
- **Loose reading (a green test of shipped code): ~4 of 15** (C, E, L, M); 3 partial (D, K, G).
- **The largest escape class, A, is UNCOVERED,** and its gap is held as falsifier=unresolvable.
- **Test-covered is not gate-covered here:** step 5d fails open and has an env kill switch, and pull-sync's post-land gate has a starvation break.
- staged-mitosis-own-check (E) has NO evidence_resolve row, so tonight's gate-fix suites are tested but not armed.

**To arm before the file can leave the list:**
1. a git-backed must-fail for A (stale base);
2. 5d failing closed, with the kill switch removed;
3. the no_measurement_available refusal;
4. a stale-gate-version must-fail for O;
5. shipped-code tests for I, J, G and H;
6. a first test, then a must-fail, for F;
7. the self-certification admission rule for B;
8. fixing or re-aiming the red staged_base_sha test, and re-pointing route-edit-61819178's check.

### Scope criterion: "covered" is defined by MUTATION (qa ruling, 10-03)
A regression class counts as covered only if negating or removing the shipped check makes an ARMED test go red. The cheap form is a mutation run on a scratch copy that comments out the guard, recorded once per class as the coverage evidence.
- "Loose" coverage (green tests of shipped code that are not armed or not mutation-proven) does NOT count toward a scope decision; it is reported only as a lead. Reason: copied-predicate tests (cutover-unparseable-guard, freshness-per-file) stay green when the shipped check is deleted.
- **Arming order for vessel-mitosis-cutover.ts, each with a mutation proof:**
  1. A, stale-base overwrite (the af61dee class; its gap's falsifier=unresolvable disposition is wrong, since a git-backed must-fail is feasible);
  2. O, stale gate version on a node;
  3. no_measurement_available;
  4. 5d fail-closed, with the kill switch removed;
  5. shipped-code tests for I, J, G and H;
  6. F;
  7. B as the self-certification admission rule.
- The staged_base_sha check is re-aimed from route-edit-61819178 to a cutover-sited gap.

**Local rollout complete at 04:59:39Z.** The secret-mask probe passes by effect on every LOCAL node, which meets the re-apply condition for the scripts/substrate autonomyScope widening locally only; the hub is unmeasured (it needs its own recreate and probe through the user). SurrealDB 2.3.10 is on hold until the database session's compat check passes (node 1's recreate interrupted its export at ~04:58; the quiet gate will now also check for running exports).

### Post-rollout liveness re-audit (10-03 ~05:05Z; blob hashes of the code each unit LOADS)
- **All 5 rollout nodes run image 6f062c16, label 60ae05a0.**
  - 326061de, 496d9896 and cecb0925 are LIVE wherever the unit runs: syzygy-local-surface, syzygy-local-inventory and pubspoke; on disk on node 1 (transport unit not running) and node 2 (transport masked).
  - af119736 and lib 69256d9 are loaded on none of them.
- **Deviation 1:** nethub-live (compose project "nethub", started 04:58:49Z from ghcr :dev at af119736) runs af119736's relay.ts, so the unmeasured relay change is LIVE there. Ownership and pinning are being asked of the deployment session.
- **Deviation 2:** pubspoke's pull-sync mirrored lib 69256d9 into /vessels at 04:59:07Z and restarted the transport, which still loads the baked copy (c90decc). Nothing new became live; it was a no-op restart.
- **Watch:** node 2's pull-sync gate shadow-evaluates af119736's relay.ts ("verdict soaking 865b4a28: shadow pass 1/3"). It may promote it through the gate path without an image change. Unverified; asked.

### Relay liveness after gate promotion (measured by deployment-redeployment)
- **Gate promotion cannot make a relay change live.** pull-sync's gate overlay copies accepted gate paths only into the staged glue and clone trees under /workspace. On every node checked (node 2 with the relay active; node 1 and pubspoke with the transport), federation-relay and federation-transport-vessel run from the image-baked copy under /usr/local/share/substrate/super-repo, and no drop-in overrides ExecStart.
- **Consequence for audits:** a node's `accepted.sha` can name a commit ahead of the code the node actually runs. Judge liveness by the loaded blob (`git hash-object` of the file the unit loads), never by `accepted.sha`. Federation changes go live only through an image rebuild and recreate (the open gap on the image-baked federation copy).
- nethub-live (compose project "nethub", ghcr :dev af119736) belongs to the network fork's large-frame acceptance fleet. It is temporary and is torn down with compose down only.

### Class A armed; the own-check fix's guard measured (2026-10-03)
- **Class A (a stale copy overwrites newer committed work at cutover) is armed.** Tests: development-vessel 0975b9e and de985d6, `test/resolvers/cutover-stale-base-over-newer-commit.test.ts`.
  - Must-fails: (1) the clean-at-HEAD exemption admits a base that is an older committed version; (2) the commit-tree check reads the clone before the cutover's own fetch and reset; (3) a file-content hash is handed to git as a revision.
  - Controls: the 08-29 uncommitted-patched-hash case proceeds; base == HEAD lands; a newer commit to an unrelated file does not block.
  - The gap's check reads present on de985d657daa. It is operator-only (the cutover is an excluded path).
  - Mutation proof on the exact fix sketch: guard off turns must-fails 1 and 2 red; restoring the content-hash reset turns must-fail 3 red.
- **Guard row for the cutover own-check fix (040d7e1/3770906): unit tests plus a tip-only gate; the range hole is open.**
  - With the weakening commit at the tip, pull-sync's newly-failing gate refuses it. Real bun: 10 attributable for always-pass and 16 for never-loaded, each matching the unit-level red set.
  - It is not durable. The gate compares the tip only against HEAD^, so one later commit in the same range makes the regression 0-attributable, and its names enter the baseline permanently (measured). Gap `pull-sync-test-gate-compares-only-the-tip-against-head-parent-…` (high).
  - The landing node never runs the gate on its own cutover commit; there the post-land suite is the only check.
  - The starvation break still deploys after 3 refusals, holding the names outstanding.
  - A suite over 240s converges ungated.
- **Rule (qa, adopted): "guarded by" needs a mutation proof through a RANGE.** The range is the weakening commit plus at least one later commit, converged through the same gate a peer node runs. A tip-only proof is exactly what fails. The rule applies retroactively: every guard row claimed before 2026-10-03 reads "tip-only, range unproven" until it is re-proven.
- **Folded into gaps:**
  - The range gap carries baseline poisoning (the baseline never absorbs a newly failing name without an open gap or a recorded acceptance), the misleading "did not reproduce" log line, and the 240s timeout counting as ran=false and refusing.
  - The no-measurement gap carries: post-land ran=false on the landing node is no measurement.
  - The post-land gap references the range gap.

### Lane landing: step 1(b), the SF_BLEND off-path (activity-api b69296f, 05:19Z, node 2)
- **The first lane landing through the fail-closed cutover own-check.** Node 2 logged `own_check_passed` on the gap's armed check. The post-land suite ran (`ran=true`).
- **Independent operator verification:** at b69296f's parent the CHECK test is red and both controls are green; at b69296f all three are green. The full activity-api suite at both commits (env -i) shows 0 new failing names; the only change is the CHECK turning green.
- **Live on node 1** (`accelerator-flag-tick.ts` blob 581617175ee6 loaded; activity-api restarted 05:35:24Z, after the file changed at 05:35:23Z). Node 2 masks activity-api by design.
- **The effect is latent.** The off path reads the `SF_BLEND_VERDICT` tuning param, and nothing writes it yet; the reach-graded A/B is its writer (the open gap sf-blend-has-no-reach-graded-a-b-…). The blend stays on until that A/B, as WIRING step 1(b) requires.
- Guard row: unit check (armed) plus a tip-only deploy gate; range unproven (the range rule).

### Measurement exclusion: node 1 selection log, 2026-10-03 05:42:30–05:44:30Z
- **Source:** the database session's post-upgrade smoke dry runs: 4 /recommend groups, 12 rows.
  - One tagged probe: `sel_1791006263630_kxkhrd_0/1/2`.
  - Three untagged groups: `sel_1791006165568_4vxfa8`, `sel_1791006166635_sju385`, `sel_1791006191530_3hex6y`.
- **Rule:** every selection or credit measurement excludes this window.
- **Why a time window:** the log has no caller or probe field to exclude these rows by identity. That is now part of the selection-log gap (the-selection-log-keeps-no-state-signature-…), which comes first in step 3's selection work.
- **b69296f is an S2 landing (qa):** lane-authored, through the fail-closed own-check, on a supervised (operator-armed) gap. It fixes the SF_BLEND latch only.
  - **Env override, latent:** scoring still lets env SF_BLEND override the tuning row (activities.scoring.ts:126). No node sets it today, so the override is latent; it is tracked in the three-latch class gap with an env-on, verdict-off falsifier.
  - **The verdict is not env-gated:** SF_BLEND_VERDICT has no env fallback.
  - **The "-narrowed" duplicate is closed** as superseded_by_landing.

### SurrealDB 2.3.3 → 2.3.10 deploy events (separate from image recreates)
- **Why upgrade:** surrealdb#6060, a composite index with an unconstrained middle column returns 0 rows. Fixed in 2.3.8+; the compat pre-check passed against a 2.3.3 control.
- **Spokes done:**
  - syzygy-local-surface: 2026-10-03T05:45:05Z.
  - syzygy-local-inventory: 2026-10-03T05:46:09Z.
  - Both report engine 2.3.10, 0 failed units, secret-mask 0 VISIBLE, and baseline counts equal. The smoke check's FAIL there is expected: spokes run no activity-api.
- **Node 1:** two stops.
  - (a) Restore proof: export, restart unchanged on 2.3.3, restore into a scratch volume and compare counts.
  - (b) Upgrade: export, recreate on 2.3.10, then the check.
  - Each stop window is a measurement exclusion; times are appended when deployment reports them.
- **Node 1, stop (a), the restore proof:** stopped 2026-10-03T05:50:09Z, started 05:53:43Z, unchanged on 2.3.3 at image 60ae05a0. This is a measurement EXCLUSION window.
  - Nothing was in flight: the last trace was persisted at 05:46:29Z, and no cutover or post-land suite was running.
  - The restore from the volume tar into a scratch volume matched all 10 baseline tables, including init_migrations 228/228, which the export path loses. So the volume tar, not the export, is the backup of record.
  - After the restart: 0 failed units, and activity-api answers 200.
- **Node 1, stop (b), the SurrealDB 2.3.10 upgrade:** stopped 2026-10-03T05:59:45Z; backup done 06:03:04Z; **deploy time 06:03:08Z** (new container). EXCLUSION window: 05:59:45Z until the first retention sweep finished at 06:04:50Z.
  - The quiet gate passed at 05:59:12Z; nothing was interrupted.
  - **Result:** engine 2.3.10. The #6060 check gives 0/60 mismatches (60/60 on 2.3.3). 0 failed units, secret-mask 0 VISIBLE, /health and /recommend 200.
  - **Exclude the probe selection rows** `sel_1791007460613_92z75p_0/1/2`.
  - **DISCONTINUITY at 06:03:44Z:** the first retention sweep after boot pruned about 61.6k execution rows by policy (150,257 → 88,805).
    - validator-dispatch stratum: 51,119 removed (cap 600);
    - slot-binding stratum: 10,077 removed;
    - the global-ceiling valve drained 269 auth_resolve_v1 rows;
    - 153 orphans were reaped.
  - **Hypothesis, unverified:** stratum cold-row selection uses the composite index #6060 broke, so on 2.3.3 those rows were invisible to retention, and 2.3.10 exposed them. The db fork is testing the cold-row query against the pre-upgrade backup on a throwaway 2.3.3. Until that's settled, every execution-count or retention-dependent series (including step 5's re-baseline) is split at 06:03:44Z and never compared across it.
- **Local SurrealDB rollout complete:** surface, inventory, node 1. Node 2 and pubspoke run no SurrealDB. The hub goes through the user.
- **Retention was inert on 2.3.3 (known cause; the consequence is being measured).**
  - The 10-01 gap `surrealdb-2-3-3-plans-execution-counts-wrong-…` had measured node 1's cold count for validator-dispatch at 0 while 23,414 rows matched. The 2.3.10 upgrade resolved that instance through the engine, not code; the self-check that gap asks for is still owed.
  - **The detector class is filed now (qa):** `trace-retention-has-no-effect-check-…`. Each sweep must record eligible vs removed per kind and raise on eligible > 0 with removed ≈ 0.
  - **Consequence, CONDITIONAL until measured:** if the execution cap evicts regardless of kind, then under 2.3.3 the cap pushed out gradable history to keep about 61k telemetry rows that retention should have removed. Tonight's "~11 days of retention" figure was then shortened by the bug, and history evicted before tonight is recoverable only from backups. This is the 10-01 ruling (the trace store is for gradable executions; routine work goes to counters) seen from the eviction side, and more reason to move the validator-dispatch and slot-binding writers to counters.
  - **Pending from the db fork, read-only on the pre-upgrade backup:**
    - the pruned set was only policy kinds;
    - zero gradable rows were pruned (positive-controlled);
    - how the cap actually evicts.
