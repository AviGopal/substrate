# Mechanisms chunk 07 — area "other" (mostly the edit lane: feature_compose + gap_to_feature)

Input: `classes/_mech_chunks/07.json` (65 rows). Judged 2026-09-29 against the live hub
(`substrate-live`, dev-vessel runs from `/vessels/development-vessel`, byte-identical to
`/workspace/git/vessels/development-vessel` for `feature-compose.ts` (7,274 lines) and
`gap-to-feature.ts` (5,404 lines); clone HEAD `f451e42` 09-29 01:37) and node 2 (`compose2-live`).

## How the evidence was taken (read-only)

- Code presence: `grep` in the live clone (line numbers below are live `feature-compose.ts` / `gap-to-feature.ts`).
- Firing: `journalctl -u development-vessel --since -72h` on both nodes (hub 293,514 lines; node 2 45,337 lines).
  Markers counted (hub / node 2): `[fc-exact]` 7 / 96 · `fc-anchor-choice` 0 / 0 · `family sampled` 948 / 686 ·
  `autonomous_pick` 808 / – · `hopeless` 1,089 / 511 · `emitted narrowed` – / 292 (`narrowed` any 11,935 hub) ·
  `fc-coverage` 162 hub · `parked` 258 hub · `semantic judge unavailable` 2 / 0 · `egress` 37 / 20.
- Executions (7 d, `execution` table): `development-vessel:detector-yield-registry-tick` 41;
  `satisfier:pull_cutover` 8 ok / 4 fail; `learned-satisfier-pull-cutover` 1 fail;
  `gap-closing:pull-sync-unhealthy-activity-api-*` 1,425 ok / 66 fail; `satisfier:solicitation_outcome_scan` 2;
  no `env_gate_scan`, `docs-align*`, `escalation_disposition_apply` rows.
- `state_signature`: 0 of 84,785 execution rows in the last 3 d carry it.
- Gap store (hub, `/workspace/git/super-repo/gaps/gaps.json`, 6,285 rows): `-narrowed` 458 open / 21 closed;
  `recommit-` 415 open / 13 closed; `unaccounted-landings` 13 open; `failing-test-` 12 open / 3 closed;
  `pwt-` 2 open; `remedy-livelock` 5 closed / 0 open; `baseline-typecheck` 3 open; `severed-joint` 5 open.
- Registration: `raw/live-resolvers.md` §2 (unregistered files, 0 `resolver_id` traces in 30 d) and unseen-shape list.

## Dedupe (same thing under different names)

| Canonical mechanism | Rows folded in |
|---|---|
| Semantic judge / adversarial refuter panel | 14, 22, 32 (+ 18/24 architecture scan is an *input* to it, line 2276) |
| Deterministic cutover floors (zero-behaviour-delta, header-only, hollow-stub, edit-provenance, dead-code/dead-store/vacuous, target-touched) | 28, 19, 36 |
| Verbatim / exact-edit path (`[fc-exact]`, `synthesizeVerbatimEditOps`) | 15, 30, 33, 39, 40 |
| Enumerated anchor choice (`anchor_index`) | 25, 46 |
| `consultPrinciples` | 20, 42 |
| `detectArchitectureViolation` | 18, 24 |
| fc-coverage / untested-target | 21, 35, 45 |
| Lesson usage credit (`/usage/:id/fail`) | 43, 44 |
| Parked/resumable landings | 26, 38 |
| Narrowing / recommit minter | 37, 52 (+ 56 is its guard) |
| Seal escape / hopeless escalation to `:8270` | 58, 59 (+ 54 throttle) |
| Launch manifest + profiles + readiness | 5, 8 |

## Verdicts

| # | Mechanism | Verdict | Live evidence | Discoverability / archive |
|---|---|---|---|---|
| 0 | LLM spill chain (federated egress) | keep-general | `federated-llm-egress.ts` imported by `feature-compose.ts`, `patch-with-tools.ts`, `llm-completion-dispatch.ts`; 37 hub / 20 node-2 egress log lines in 72 h. Original hashes (dd13b69…) live in history, 6815f82e not resolvable in this clone. | Already reached by shape (`llm_completion`). Record as a concept "any funded LLM in the network suffices" linked to federation-p2p. |
| 1 | posterior CRDT `vpm_partition` | fossil (design) | 0 code hits for `vpm_partition` in any live clone; design 07-14 only. | Archive the design note under `docs/archive/design/`; it is the reference if node-locality/federation-p2p needs lock-free priors — check that class first before "inventing" cross-node priors. |
| 2 | `env_gate_scan` | revive-general | Registered on dev-vessel but in the 30-d unseen list; 0 executions. Env gating still live and recurring: `RUNTIME_DRIFT_REPAIR`, `EMBEDDING_PRIOR_ENABLED`, `TRACE_RETENTION_ACTIVITIES` (timers-readers.md, live-resolvers.md). | Give it a rhythm impulse and route its output as gaps with a falsifier (the env name must disappear from the branch). Env-gating class. |
| 3 | detector-yield registry (+tick) | keep-general | 41 executions of `detector-yield-registry-tick` in 7 d. | Registered shape; make it the reader that retires detectors (and the docs-align/env-gate families below). |
| 4 | "Unregistered dev resolvers" (behavioral-verification, causal-adjudication, region-probe, gap-to-feature, doc-drift-fix) | revive-general | They are *imported helpers*, not dead: `behavioral-verification` ← `vessel-mitosis-cutover.ts`; `causal-adjudication` ← `gap-to-feature.ts`; `region-probe` ← `feature-compose.ts`; `doc-drift-fix` ← `routes/impulses.ts`, `gap-to-feature.ts`. `gap_to_feature`/`doc_drift_fix` have a route `case` but no registration, so only direct POST reaches them (gap-compose timer: 711 watchdog restarts 09-28/29). 0 `resolver_id` traces 30 d. | Register `gap_to_feature`, `doc_drift_fix` and `behavioral_verification` as shapes in dev-vessel's `config.ts` shape list so discovery routes and traces them; keep the other two as internal helpers. |
| 5+8 | Launch manifest + role/profile derivation + image readiness | keep-general | e375d716/d8fed96f/76d548d1 09-23, install acceptance CI fa7e9189. Host working tree has `scripts/substrate/Makefile`, `gen-env.sh` modified and uncommitted (git status today), i.e. a live regression risk. | Documented in README § Installation (the only setup doc). Commit or discard the host drift. |
| 6 | resolutionProposal/Action/Refused channel | fossil | 0 source files (09-17). | Remove from docs; archive the doc paragraph in `docs/archive/`. |
| 7 | docs-align family (8 resolvers) | revive-general | 8 resolvers (`docs-align-bridge/scan/tick`, `doc-drift-fix`, `doc-fix-policy`, `docs-decision-*`); `docs_align_scan`/`docs_align_bridge` unseen 30 d; 0 executions. `ingest-docs` timer is live (6 h) and feeds `doc_expectation` concepts. Law 9 requires this loop; docs-drift is a recurring class. | Collapse to one activity family (scan → decision → fix) with a rhythm; the 5 extra resolvers become variants or are archived. |
| 9 | `pull_cutover` resolver | keep-specific | `satisfier:pull_cutover` 8 ok / 4 fail in 7 d; related `gap-closing:pull-sync-unhealthy-activity-api` 1,425 ok. Case at `routes/impulses.ts:309`, output shape `pullCutoverReport` (`pull-cutover.ts:106`) still differs from the input shape name. | Registered (`config.ts:119`). Fix the output/input name pair so the learned satisfier stops failing. |
| 10 | `state_signature` contextual key | revive-general | Computed by `compute-state-signature.ts`, read by `activity-api/src/lib/selection/choice.ts`, but 0 of 84,785 execution rows in 3 d carry it (09-16: 0 of 96,747). Selection-learning class needs it. | Write-side join: whoever writes the execution row must stamp it. Falsifier: non-zero rows in the next 24 h. |
| 11 | `producer_count` scan | revive-general | Lives as `advertised-shape-coverage-scan.ts:107` (`producer_count` per shape); no gap uses it as its predicate. | Make it the default falsifier for `missing_capability` gaps (gap-content class). |
| 12 | jev typed decision arm | unknown | No `alpha/decisions` reference in any live clone; the 09-19 8/8 run was external and uncommitted. | Keep the 09-19 report as the record; not a mechanism in this substrate. |
| 13 | Class1 arming guard (`predicateLiteralNotUnique`) | keep-specific | Present in `substrate-gap.ts` (3 refs); 48fb8b6 fixed the fail-open catch (26/26 tests). | Part of the gap write path; no separate registration needed. |
| 14/22/32 | Semantic judge / adversarial refuter panel | keep-general (demote to advisory) | 6 `adversarial` refs; judge prompt built at 2277 with architecture facts. Record: refused correct fixes 2/2, passed inert commits, 4–5/5 sampled rejections sound (09-12), verdicts anti-correlated with effect (09-04). | Keep as one instrument behind the shared verdict (false-verification dossier §6), never as the reach judge. |
| 41 | Fail-open judge path | broken | `feature-compose.ts:2279–2283` returns `addresses:true … fail-open, unverified by judge`; fired 2× on hub in 72 h. Approved 68fe034 unverified. `verified:false` is carried (line 627–630) but the verdict still admits. | Retire per false-verification dossier: an unavailable judge must abstain, not admit. |
| 28/19/36 | Deterministic cutover floors (zero-delta, header-only, hollow-stub, provenance, vacuous/dead-code, target-touched) | keep-general | `SEMANTIC_CUTOVER_GATE`, `detectZeroBehaviorDelta`, `detectEffectlessHeaderOnlyDiff`, target-touched check all present. Known false positives (ed313f2 fixed log demotion); caught wrong-file and hollow-helper drafts. | Keep in feature-compose; expose the list of floors as the positive-control set for `gate_self_probe`. |
| 18/24 | `detectArchitectureViolation` | merge-into | `feature-compose.ts:1306`, only consumer line 2276 (fed into the judge prompt). Cannot hard-fail. | Merge into the semantic judge's inputs (it already is one); drop the separate "gate" claim. |
| 15/30/33/39/40 | Verbatim exact-edit path (`[fc-exact]`, `synthesizeVerbatimEditOps`) | keep-general | Line 4579 `[fc-exact]` fired 96× on node 2 and 7× on hub in 72 h; line 4574 runs the fence synthesizer only when `pointer.directed === true`. The 09-16 "never fires via edit-intent" finding is superseded for directed goals. Law-13 concern stands: only operator-authored EDIT blocks feed it. | Keep; the missing piece is a system producer of EDIT blocks (drafter-quality retire condition 1), not a new edit form. |
| 25/46 | Enumerated anchor choice (`anchor_index`) | revive-general | Exists at 5562–5572 only inside the re-derivation branch; `fc-anchor-choice` logged 0× on both nodes in 72 h. 28.2 % of attempts die on anchors (reports-8). | Promote into the primary drafting prompt (drafter-quality "promote rather than rebuild"). |
| 20/42 | `consultPrinciples` | broken | Called at 4465; fetches `${CONCEPT_DB_ENDPOINT}/concepts/search` with default `http://127.0.0.1:8260` (line 2803). Node 2 (where most compose lands) has no :8260 listener, so it silently returns `""` (catch at 2864+26). Works on the hub only. | Route by shape (`conceptSearch` via discovery) — endpoint-routing class. Source concepts come from the live `ingest-docs` timer. |
| 21/35/45 | fc-coverage / untested target | keep-general | The string `TARGET-HAS-NO-TEST-FILE` is gone (0 hits); since 09-02 `uncoveredTargets` routes uncovered diffs to a stricter deterministic check (5129–5165, 6340). 162 `fc-coverage` lines on hub in 72 h. Rows 35/45 describe the pre-09-02 warn-only state. | 35 and 45 duplicate-of 21 (stale). Keep; its report field is the "READ, never RUN" marker. |
| 17 | Anchor-provenance gate (`assertAnchorInWindow`, 2f2ba0f) | keep-general | Present (2 refs). Listed as measured-to-hold in drafter-quality. | Internal to feature-compose. |
| 16 | Compose/cutover execution traces | keep-general | 4afd4c1 fields present; `op_count==ops_applied` but requested count missing (memory-10). | Add `ops_requested` (drafter-quality retire condition 2). |
| 23 | `targetFileOnDisk` | keep-general | 5 refs; consolidates 8 earlier call-site fixes. | Internal helper; cite it whenever a file-resolution bug is filed (grep sibling sites). |
| 26/38 | Parked / resumable landings | keep-general | `parked` 258 lines on hub in 72 h; 47 parks verified, 25 on unauthorable human-surface `proxy.ts`; 6ab8271 resume silently reverted a0ff3d3 (09-24). | Keep, but a resume must diff landed vs parent+edits (memory 09-24). Parks on unauthorable vessels should be refused at park time. |
| 27 | Typecheck repair loop (`MAX_REPAIR`) | keep-specific | 7 refs; 152 `repair` lines 72 h; ~2 applied/24 h vs 67 failures. | Internal; low yield — grade it, do not extend. |
| 29 | Compose report preservation (ce10c8b) | keep-general | `preserv` 10 refs; 7/7 fixtures, fired naturally 09-04. | Internal. |
| 31 | Region-scoped grounding (`focusedSlice`/`regionCandidatesFromText`) | keep-general | 6 refs each. | Internal. |
| 34 | `appendComposeLesson` / `failure_lessons` | keep-general | 7 refs in fc, 13 `failure_lessons` in g2f; it is the drafter's failure memory. Side effect: its write-back force-reopens closed gaps (reports-1). | Keep; the reopen side effect belongs to narrowing-duplicates fixes. |
| 43/44 | Lesson usage credit (`/usage/:id/fail`) | broken | `feature-compose.ts:3443` POSTs `${CONCEPT_DB_ENDPOINT}/usage/${id}/fail`; concept-db serves only `POST /concepts/:id/usage` (`routes/concepts.ts:424`), so the write 404s; errors swallowed; parses the resolve reply as a bare array. Fail-only, no success credit. | Replace with the real usage write (`/concepts/:id/usage` or the `concept_usage` shape), crediting both success and fail, drafter-quality retire condition 4. |
| 37/52 | Narrowing / recommit minter (incl. "chronically-stuck narrowed child") | broken | Gap store: 458 open `-narrowed`, 415 open `recommit-`; node 2 emitted 292 narrowed children in 72 h; guard edited 08-29, 08-31, 09-14, 09-15, 09-23, 09-24, 09-25. | 52 duplicate-of 37. Fix at write-time identity (narrowing-duplicates dossier §6); archive the open children after inflow stops. |
| 56 | Narrowed-child `INHERIT_NEVER` denylist + lesson requirement (a57dc30) | keep-specific | `gap-to-feature.ts:3615–3625`. Correct knowledge; recommit chains still leak. | Keep as the field list for the write-time identity resolver. |
| 53 | `requeueAfterNonAttempt` | merge-into | 4 refs at 3 call sites (08-31). | Merge into `isNonAttemptComposeResult` (calibration-seal keep list). |
| 54 | `solicitedHumanGaps` throttle | broken | 7 refs, in-process `Set`; 03d98c1 (09-25) notes every restart re-asks; dev-vessel restarts ~790 draining refusals/5 d. | Persist the ask as a shaped receipt on the gap. |
| 58/59 | Seal escape loop / hopeless escalation to `:8270` | broken | `ui-write-passthrough.ts:24–25` still pins `STATEFUL_UI_VESSEL_ENDPOINT ?? http://127.0.0.1:8270`; 248 asks / 0 answers (09-22); `hopeless` 1,089 hub / 511 node-2 log lines in 72 h; `escalation_disposition_apply` 0 executions (unseen 30 d). | 59 duplicate-of 58. Route by shape to human-surface (:8310); keep `escalation_disposition_apply` (sound apply side). |
| 55 | `verifiabilityCredit` | keep-specific | 3 refs; class1 share 0→43 %. | Internal selection term. |
| 57 | Family sampler + variant minting | keep-general | `family sampled` 948 hub / 686 node 2 in 72 h. a5b4772: `/templates` clamps to 100 so the sampler saw a family of one. | This is law 2/3 selection among variants; fix the page clamp. |
| 60 | Containment readers (`autonomyScope`, `spendEnvelope`) | keep-general | 22 / 14 refs. Fail open when the holding node is missing from discovery. | Shaped policy impulses already; make absence abstain. |
| 61 | `admitActionableGaps` | keep-general | 3 refs (76f44ca). | Internal admission; the gap-content class's admission step. |
| 62 | Revert-aware `shaWasRevertedInAnyClone` | keep-general | 4 refs. | Internal. |
| 63 | `sweepPendingLandVerifications` | broken | Present (3 refs); the `pending_outcome_verification` clear does not stick (memory 09-26); 158 open gaps carry it (hollow-landing dossier). | Keep the sweep; fix the re-derivation that re-sets the flag. |
| 64 | `autonomous_pick` lease (`maintenanceLease`) | keep-general | 808 `autonomous_pick` lines hub 72 h; 21–34 skips per graded window. Does not stop in-flight composes. | Shaped lease already. |
| 47 | codebase-as-vessel npm:/make: introspection | fossil | 0 code hits; foundation-doc only. | Mark as unbuilt in the foundation doc; archive. |
| 48 | failing-test lane | keep-specific | 12 open / 3 closed `failing-test-*`; af2c737 lowered a timeout to match a stale test (reverted d4eee29). | Keep; needs an oracle that forbids editing the expectation to match. |
| 49 | `pwt-*` post-write mitosis | keep-specific | 2 open `pwt-*`; reverted 1bf4fee; oscillated concept-db `/health` ×3. | Keep; its refuters confabulate dialect facts (memory 09-22). |
| 50 | Aggregate `unaccounted-landings-<repo>` gaps | keep-specific | 13 open; 114 superseded by the fold; the close predicate has closed none. | Keep the fold (617b12a/b6f0d14); the close predicate is the defect. |
| 51 | `remedy-livelock` gaps | broken | 5 filed 09-25, all closed; the livelock peaked 09-28 after closure. | A gap that closes while its condition persists; fold into the demand-count filer with a measured close. |

## Takeaways for the realignment

1. **Most of this area is live, and the failures recur at the same seams.** The broken rows reduce to three roots already named in the class dossiers:
   pinned loopback addresses (`consultPrinciples` :8260, escalation :8270; endpoint-routing),
   fail-open judges and closes (fail-open judge, remedy-livelock, pending-verification sweep; false-verification), and
   minting children instead of attaching to an identity (narrowing/recommit; narrowing-duplicates).
2. **Don't mint here — promote what already exists.** `anchor_index`, `[fc-exact]`, `producer_count`, `state_signature`, `env_gate_scan` and the docs-align family all exist. Each one is missing either a reader, a registration or a rhythm, not code.
3. **Discoverability debt:** `gap_to_feature` and `doc_drift_fix` are handled but not registered. `behavioral_verification` has no shape at all. So the lane's own core is invisible to discovery and to resolver-level traces.
