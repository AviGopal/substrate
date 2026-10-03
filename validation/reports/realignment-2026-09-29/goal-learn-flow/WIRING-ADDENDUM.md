# WIRING addendum: the stages WIRING.md does not cover (2026-10-03, rev 2 after qa ruling)

**Scope.** This covers the stages missing from `validation/reports/realignment-2026-09-29/goal-learn-flow/WIRING.md` @ bdac579d (coverage confirmed by the coordinator, 10-03).
- **Sections:** A (in-run capability construction and content threading), B (the closure after output), C (vocabulary and intent). Format: As built · Prior art · Should · Expect · Must-fail.
- **Method:** read-only. Code at origin/dev and node 1 journals.
- **qa (10-03):** independently verified af61dee, 5c974cb7, 77785f4, 9850704, the 8972cda latch and the 620/24h rejections. Adopted with the corrections folded in below.

**Requirements checked against.** Each is a CLASS, with held-out probes rather than targets:
1. **Unserved outbound capability.** A goal needing an outbound shape no producer serves composes a producer, obtains its credential, performs the effect and reads it back.
   - **Held-out probes:** "send a greeting to @xevo__ on discord", plus a second goal of the same class on a different platform, chosen by rule.
   - **"One execution" is restated, PENDING USER CONFIRMATION:** one dispatch that may SUSPEND on a prerequisite (a credential via solicitation; the human as resolver, law 13) and RESUME. It does not restart. This follows the user's ruling: "any goal being resolved should reach, even if reaching requires prerequisites to be filed and completed first".
2. **Usefulness by consumption** (user law, 07-20). An activity is verified by how useful its outputs are to other activities.
3. **Reached goals compose.** D, built from reached A and B, reaches using them and credits them (standing probe).
4. **Vocabulary from evidence.** Mint, too broad, refine and change horizon are decided by evidence.

Generality rule (user): "If we make changes to affect the outcome the system won't be working." No fix is keyed to a probe's wording or shapes.

## Findings: commit · date · mechanism · detected? · restored?
1. **goal-host af61dee** · 06-28 · autonomous mitosis sweep. A stale tree overwrote index.ts (−655 lines). It removed authoringTried, isAuthoredComposite, deprecateBrokenComposite, repairTemplateBinding, persistReachOnTrace and recordDeliberation. goal-host now has no caller of authorComposedCapability.
   - Class detected and guarded 06-29 (459bf0ca, 46f16ba5). Instance never restored. No gap in the store.
2. **dev-vessel 5c974cb7** · 09-25 · autonomous edit. feature_compose → author_composed_capability now sends `{pointer,body}`, but the handler (dv impulses.ts:1100–1119) never reads body.pointer, so it answers 400. The caller (feature-compose.ts:5090) acts only on `.ok`, so the failure is silent.
   - **Dead by code reading; no runtime evidence either way** (the 400 path doesn't log).
   - OPEN: census 2:203 says ias VesselResolver uses the same body successfully. To check: does ias post to a DIFFERENT route or handler? Don't assume the census is wrong.
3. **activity-api 77785f4** · 10-02 · the V1 gate checks OUTPUT-shape advertisement, which breaks B2 (2c91aaf, 07-31).
   - Mechanism verified by qa. That conceptDescription is no longer aimable is my measurement (not re-queried by qa).
   - It closed a real hole, OPEN HIGH `goal-target-inference-proposes-a-terminal-shape-no-producer-serves`, and the fix must keep that hole closed.
4. dev-vessel 70517eb8 · 08-01 · autonomous −2,969 lines · reverted the same day (3215e70b). Pattern only.

**Broken since it landed:** standing-pool hydrate, goal-host 9850704 (07-09). Wrong envelope and wrong reply field; non-ok is silent.

**Deliberately removed, still promised, no gap in the store:** mintResolverWrapper (6a6eaa4), the improvisation and vesselization specs (3b5035d7), producedShapesConsumable (d737edb). Comments at gh :11880 and :14381 cite a removed path.

**Policy fault:** the ψ blend latch (8972cda). It sets SF_BLEND=1 at ≥200 rows with no reach check. A manual reset is flipped back on the next tick.

**Measured:** 620 per 24h `REJECTED (wrong form)` at activity-api, all received_length 8.
- **Hypothesis, not established:** that goal-host is the sender (the log names no caller; consistent with dev-vessel's 8-hex hash), and that this explains 528/660 leaf misses.
- **Attribution will be settled by a join over existing data:** trace `metadata.state_space_signature` against the `cts_sig_lookup` signature for the same /recommend call. That's a journal read plus one DB read, which needs user approval. A dispatch only if the join is impossible, tagged as a probe.

**Absence claims, qualified.** Searched in vessel src at origin/dev; **not yet positive-controlled at the same address.**
- The claims: "no caller of POST /v2/impulses", "no vessel src calls POST /composition", "no 'consumed' assignment".
- Still owed: a grep that finds a known caller of a sibling route in the same repos, plus a statement of whether shape-resolution callers, scripts/ and bundled dist were searched.
- Gap-store absence: verified by qa (0 hits for every named commit and organ).

**Related OPEN gaps to UPDATE, not duplicate:**
- `reach-gap-author-composed-capability`;
- `route-edit-5b93c3b2` (composer);
- `hassubstance-keyword-regex-rejects-legitimate-output-step-1` (A§1 hasSubstance);
- `agent-shell-commands-inherit-the-fleet-secret-environment-and-can-read-the-env-file` (A§5 credentials);
- `goal-target-inference-proposes-a-terminal-shape-no-producer-serves` (C§1 / 77785f4).

## Must-fail corrections (qa)
- **A§1 restore:** no revert of 06-27 code. Re-author it as a lane goal with the old body as REFERENCE, under the current mint-strict gate (a6e3506), the consumption gate and the mint governor.
  - Must-fail: a composite minted in-run that does not reach is retired or held provisional, never left selectable (laws 3 and 4).
  - REALIGNMENT §3.4: the revived organ needs a named caller and a verified effect.
- **A§5 credentials:** the structural control is LOCALITY. The agent shell cannot read the env file, which is covered by the open security gap above.
  - Effect check: a secret scan of traces finds 0 hits.
  - The `. /etc/substrate/env` string denylist is a secondary tripwire only, since a fail-open gate is worse than no gate.
- **B§1 publish:**
  - published content passes the same secret scan as traces and is tenant-scoped by PERMISSIONS on org_id;
  - only content-bearing outputs of GRADED walks are published (the 10-01 trace-store ruling; no flood like auth_resolve).
- **B§2 hydrate: DELETE.** No consumer; the B§3 offer activity replaces it.
- **B§4 offered-consumption credit:** inside REALIGNMENT §2.2 "The unit of evidence" (4b748be8). Keyed by (execution, observation) and by the (arm, target shape, goal class) cell; same fold.
- **C§1 / 77785f4:**
  - must-fail: obsidian:write_note with no live producer stays non-aimable;
  - must-pass: conceptDescription with an all-live-resolver composite becomes aimable.
  - The write-shape lint runs against a fixture or sandbox ONLY. Hard constraint: never a live write.
- **C§2:** the intent key IS REALIGNMENT §2.2's goal class (parse + command + oracle). Cite it; don't define it twice.
- **C§5 ψ:**
  - add the OFF path first, as a code change (today a manual off doesn't stick);
  - leave it ON until a reach-graded A/B, graded on reached split by author and by kind (satisfier, fresh, reuse), never a pooled rate. Change one thing and record it (law 12).

## Detectors (class fix). Two detectors, one shared output: a gap with a class tag.
1. **CALLER-LOSS** (static, at diff time). An organ or advertised resolver loses its last call site.
   - Catches: af61dee, d737edb, mintResolverWrapper.
   - For a deliberate removal it requires a retirement or gap record in the same commit; it does not block.
   - Also flags comments that still cite the removed path.
2. **CONTRACT-MISMATCH** (by EFFECT, at runtime). A non-2xx count per (caller, route/shape) at the shared HTTP client seam in packages/: one place, not per call site. The seam logs non-ok itself, because callers swallow it.
   - Catches: 5c974cb7, the hydrate, the hollow concept-db advertisements, the 620 rejections.
   - Static envelope reading is unreliable; see the open VesselResolver contradiction.
3. **One-time BACKFILL:** run (1) over history since 06-01 to list every organ removed without a record. This restores INSTANCES, which the class guard never did.
4. **Both are K6-proven:**
   - fixture must-fails: a removed caller is flagged; a wrong envelope is flagged;
   - proven to complete on today's tree, with af61dee and the hydrate as positive controls.

## Order, folded into WIRING's ADOPTED ORDER (revised per qa; CONFIRMED by qa 10-03)
- **Step 1, stop active harm (only items doing harm now):**
  - (a) the 77785f4 fix, NARROW form only (qa): deliverable-shapes admits a composite's terminal when every task RESOLVER is advertised, with its C§1 control pair (keeps the terminal-shape hole closed). Written as ONE shared function that step 3's general "claimed" predicate extends; never a second copy;
  - (b) the SF_BLEND latch OFF-PATH (code). Leave the blend ON until the A/B; turning it off unmeasured is also an intervention;
  - (c) the hollow concept-db write advertisements: retire them, or make them honest;
  - (d) the CALLER-LOSS and CONTRACT-MISMATCH detectors plus the backfill. Harmless, and they stop recurrence. Each backfill finding becomes a gap or a retirement record. It is NOT restored inside step 1: restoration that activates minting waits for step 3 plus the extraction gates, as af61dee does (qa).
- **Step 2, code version per step:** unchanged (WIRING).
- **Step 3, one verdict→credit reader:** unchanged (gap 1 two-sided abstention, gap 2 the hollow withhold, a single decay rule). Then, inside step 3's single reader, after gaps 1 and 2 land:
  - B§1 publish (with its must-fails), then B§3 offer, with `composition_impulse_flow` rows and a named reader;
  - B§4 offered-consumption credit (the 07-20 law), in the §2.2 fold;
  - A§4 content threading (the author-producer slot-append via acc.ts:521–539; unresolved placeholders fail);
  - C§1 the vocabulary "claimed" predicate (the 06-04 ruling enforced; coverage-tick stops rewarding novelty).
- **Step 4, evidence into labels:** unchanged.
- **Step 5, re-baseline:** unchanged.
- **After step 3 AND the extraction gates (activates in-run minting, so capability, not harm reduction):**
  - A§1 re-author the af61dee callers as a lane goal (old body as REFERENCE, current gates, the in-run mint must-fail);
  - the 5c974cb7 envelope fix (after resolving the VesselResolver contradiction).
- **Then step 6** (WIRING): the decision log, the extraction predicate, lineage and probes.
- **Class capability, after the above:**
  - A§5 solicitation reachable at the stall (suspend/resume, pending the user's confirmation);
  - credentials by reference, held by the resolver (locality);
  - floor tools;
  - vesselization (canon).

  Acceptance: both held-out probes of the outbound class. Stage must-fail: a send with no read-back never grades `reached`.
- **Already WIRING §1:** inference keeping compound needs.
- **C§5:** the ψ A/B after the off-path. C§2: intent classes = the §2.2 goal class, built with step 6.
# Stage: in-run capability construction and content threading (2026-10-02)

Scope: the goal "send a greeting to @xevo__ on discord" has no producer. The requirement is that ONE execution
learns how, builds the capability, connects it, uses it, and verifies the effect. Plan of record:
`validation/reports/realignment-2026-09-29/goal-learn-flow/WIRING.md` @ super-repo bdac579d. That plan covers
inference, selection, walk route-arounds, verdict, credit, extraction and reuse, and none of it is repeated here.
Improvisation history is in `realignment-2026-09-29/agentic-runner/APPROACH.md` §0–§1 and is cited, not redone.

Code read at: goal-host a6e3506 (10-02), development-vessel 37709065, ias-executor-ts f155e05, local-tools origin/dev.
Abbreviations: gh = goal-host-vessel src/index.ts; dv = development-vessel; ias = ias-executor-ts.
Nothing was dispatched, and no DB was read. The journal window starts 10-02 15:15 (unit restart), so a journal count of 0 is not
evidence of absence.

## Regression ledger (coordinator requirement)

| # | What worked | Introduced | Broken by | Mechanism | Detected? | Restored? |
|---|---|---|---|---|---|---|
| R1 | Walk **decomposition-authoring**: at the escalate/stop branch, `authorComposedCapability` → execute composite (`resolution:"decomposition_authored"`, `walkComposeTried`) | gh 6497517 (06-27, operator) | gh **af61dee** (06-28 20:05Z, `Substrate Autonomous`, "unknown-proposal via mitosis cutover", +47/−655) | **Autonomous drift, collateral.** The mitosis tree's copy of index.ts lagged origin/dev, and the cutover copied the whole file over. The base SHA it records, `8ad7ec81f995`, is not an object in the repo. | Yes, the next day: super-repo 459bf0ca (06-29, host-sync-poller.sh comment "af61dee DELETED 655 legit lines") and dv 46f16ba5 (06-29, clone reset to origin/dev, dv vessel-mitosis-cutover.ts:2251–2270) | **No.** The class guard landed; the instance was never reverted. No gap names af61dee or the lost callers (grep across docs/ validation/ openspec/: 0). The host-sync-poller (and its comment) was later deleted in a267367e (08-11). |
| R2 | Recovery-loop **authoring escalation**: `authorProducer()` helper, then fall through to `authorComposedCapability` (`authoringTried`) | gh 1d281c7 (06-26), 6497517 | af61dee (same sweep) | same | same | No. `authoringTried` is gone from gh. |
| R3 | **Self-correction of authored composites**: `isAuthoredComposite`, `deprecateBrokenComposite`, quarantine; plus `repairTemplateBinding` / `recordRepairConcept` (goal-binding repair), `persistReachOnTrace`, `recordDeliberation`, shape-aware `recommendExcluding` | gh 2098c91, cb633e6, b337245 (06-27/28) and earlier | af61dee (same sweep, ~13 h after b337245 at 07:15Z) | same | Only as the 655-line count. None of these names is listed anywhere. | **No.** 0 of these identifiers exist in gh today. `recommendExcluding` was later rebuilt with a different signature (gh:7078). 9a9fef6 (07-07, per-step decision trail) may partly cover `recordDeliberation`'s role; equivalence was not verified. |
| R4 | `mintResolverWrapper` (mint-as-you-go wrapper) | gh 001bd2d (06-24) | gh 6a6eaa4 (08-06, "remove … mintResolverWrapper, both callerless") | **Deliberate cleanup.** It was callerless by then, and the improvisation doc rewritten on 08-05 around it went stale the next day (APPROACH.md §1) | n/a | n/a, superseded by the bridge path at gh:11126 |
| R5 | `external-resolver-vesselization` spec, `openspec/meta/improvisation-spectrum.md`, and the bridge spec | 3fd936ea (05-23) | super-repo 3b5035d7 (08-02, "retire 31 change proposals … described behavior appears nowhere in vessel source") | **Deliberate retirement of the spec**, not the expectation: the canon still promises both (IAF:411–415, IAF:631–670, ISS §4.5:297–322, CORE_IDIOMS idiom 12:584) | No gap. APPROACH.md §1 records the doc contradiction. | n/a |
| R7 | feature_compose → author_composed_capability **delegation envelope** `{impulse:{type,goal}}` (correct for the dv handler) | dv aa098722 (07-15, autonomous) | dv **5c974cb7** (09-25 13:12Z, autonomous, route-edit-672c2fd8) rewrote it to `{pointer:{type}, body:{goal}}`. Then 829f6134 (09-26, autonomous) added `execution_id` on top. | **Autonomous drift.** It was a compose-report edit, and the envelope change was incidental. | **No.** causal-attempt-ledger/FINISH_LINE.md:242–244 reviewed d4456d9 + 829f613 as the execution-id fix, and the broken envelope went unnoticed. No gap. | No |
| R7b | Same delegation, whole file | aa098722 | dv 70517eb8 (08-01 18:57Z, autonomous, −2969 lines of feature-compose.ts) | Autonomous sweep (af61dee class, after the 06-29 guard) | Yes, the same day | **Yes:** revert 3215e70b (08-01 19:23Z) |
| R6 | minibob `improvise.json` and search-first executor | minibob (03-24) | 05-24 goal-host cutover | See APPROACH.md §1 (deliberate port that omitted it; no gap) | no | no |

## 1. Bridge authoring (author_producer, author_composed_capability)

**As built**
- **author_producer is live and wired** at the walk stall. gh:11120–11171 is "(c.2) MINT-AS-YOU-GO". It fires when a missing
  target X is in `liveShapes()` (gh:7768: active-template output shapes ∪ discovery `/registry/shapes` ∪ peer).
  It POSTs `author_producer` to dv (`max_attempts:3`, 180s), folds `input_shapes` back in as sub-targets, and sets
  `pickSource="bridge"` (gh:11162). This caller dates from f39b805 (06-24) and survived af61dee.
  - Positive control that it fires live: census C3 (output-shapes/2-output-chaining.md:77). `auto-bridge-obsidian:write_note`
    is minted by dv author-producer.ts:885 (`id: auto-bridge-${shape}`), first ran 09-30T14:59Z, and has 37 runs.
- **The governor blocks bridging under negative headroom (a tautology).** `mintGovernorAllows` (gh:6189–6225) refuses when
  discovery `vesselCapability` returns ≥1 vessel for X. The bridge only runs when X is *live*, i.e. served. Whenever
  `learning_transfer_report.genuine_edge_density.inequality_ok=false`, every bridge is refused. Live headroom state:
  not measured.
- **author_composed_capability has no goal-host caller** since af61dee. It is still advertised (dv config.ts:148) and
  dispatched (dv routes/impulses.ts:965). Its only caller is dv feature-compose.ts:5063–5097, the "orphan-drain" delegation on
  `plan had no ops`. That caller was introduced by autonomous aa098722 (07-15) with a correct envelope. It was swept out and restored on 08-01 (R7b), then
  broken on 09-25 (R7, 5c974cb7). As built, the delegation is **dead by code reading**:
  - (a) it POSTs `{pointer:{type…}, body:{goal}}` to `/v2/impulses/resolve`, but the handler reads
    `body.impulse.pointer ?? body.impulse`, else bare `body.type` (impulses.ts:1108–1118). A top-level `pointer` yields 400
    "pointer.type is required";
  - (b) even if it were accepted, `goal` sits in `body`, not in the pointer, so the resolver returns structuredError
    "requires pointer.goal" (author-composed-capability.ts:549–551), which becomes a non-2xx envelope.
  - **Unresolved contradiction:** census 2-output-chaining.md:203 says ias `VesselResolver`, which posts the same
    `{pointer}` form (ias adapters/vessel-resolver.ts:77), reaches dv `llm_completion_dispatch`. Either a normaliser
    exists that I did not find, or that census line is mis-addressed. Reading (b) kills the delegation either way.
- `author_new_resolver` (dv config.ts:793) emits a `// TODO` scaffold (gh:14167–14171 says so). The net-new-file path is
  feature_compose create-intent (gh:14172+), reached only when the goal names a `repos/<v>/src/…` file.
- **Prior art for "build an external call in one run":** jev-one-goal-probe/FIRSTTRY-RESULTS.md (09-18).
  - Unaided: NO.
    - Router: 3/3 runs captured into feature_compose.
    - Planner: does not read concept-db.
    - `hasSubstance` (acc.ts:334) counts a 401 body as substance.
    - The validator strips `{{…}}` before probing (acc.ts:415–420).
  - Information-complete (attempts 6–7): a validated bounded_shell mint produced real data on the first try.

**Should (reconnect before minting)**
1. Restore the af61dee instance as a scoped revert of the two goal-host callers: the walk escalate branch, plus the recovery-loop fall-through after
   author_producer. Reuse `authorComposedCapability`'s old body (af61dee^:src/index.ts:642–670). This is not new code.
2. Make the governor's refusal condition "a *template* already produces X", not "a *vessel* serves X", so it stops contradicting the
   bridge precondition.
3. Fix the feature-compose delegation: use the `impulse.pointer` envelope, put `goal` in the pointer, and treat a structuredError body as not-ok.
4. author_composed_capability is the only organ that can compose `http_fetch` / bounded_shell into a send for an
   unserved shape (discord). It needs the two FIRSTTRY gaps closed before it is trusted:
   - hasSubstance must reject error bodies;
   - the probe must bind `{{var}}` from the goal rather than strip it.

**Expect.** For a goal whose target shape is unserved but composable, the walk decision log shows `resolution:"decomposition_authored"`,
plus a minted `composed-cap-*` id that executes in the same dispatch.

**Must-fail controls**
- A composite whose probe returns `{error}` or HTTP 401 text is refused (validated:false). Replay FIRSTTRY attempt-5's command.
- With headroom negative and X live, the bridge still runs (today it is refused).

## 2. Improvisation / mint-as-you-go

**As built**
- The step source `"improvise"` is declared in the union at gh:7539 and is never assigned. The only assigned
  build-in-run source is `"bridge"` (gh:11162).
- There is no improvisation trace type, and `mintResolverWrapper` is gone (R4).
- The in-run "forward" behaviour is the universal-tool floor. `runGroundedToolLoop` uses tools = `UNIVERSAL_READ_TOOLS` + the goal's own write shapes (gh:5551–5552).
  floor-tools.ts offers only `source_code`, `fs_read`, `codeSearchResult`, `fs_grep` and `substrateGap`:
  - there is deliberately **no shell** (the floor-tools.ts header cites run 27c1c600, which created a file at the repo root);
  - there is **no http_fetch and no web_search**.
- The floor's grounding gate (gh:5566–5578) no longer enforces read-vs-write grounding. The comment says writes are not grounding,
  but the 07-27 correction hard-fails only when `groundedOk===0` AND there is no final text AND no observations. A writes-only run with
  any answer text passes to `verifyGoalReached`.
- History: APPROACH.md §0.3 and §1 (minibob improvise lost 05-24; specs deleted 08-02; doc rewritten 08-05; wrapper deleted 08-06).

**Should.** Use APPROACH.md §2's S3–S9 forward mode entered in place at the stall, with each step recorded as `source:"improvise"`.
- Its offer set is `discover-by-shapes` extended to resolver shapes.
- For this stage, the offer must also include the composer (author_composed_capability) and the bridge. "Build a capability"
  is then one of the moves the forward mode can make, not a separate engine.
- Outbound-effect tools enter the offer only through resolvers that hold their own credential (see §5), never through a shell.

**Expect.** A stall on a goal with no producer yields ≥1 walk step whose decision row has `source:"improvise"` and whose offer
lists the candidates and their scores.

**Must-fail.** A dispatch that improvises but writes no `source:"improvise"` row fails a decision-log join test, the same
join as WIRING §2 must-fail.

## 3. Endpoint vesselization (canon IAF §External Resolver Vesselization, CORE_IDIOMS idiom 12)

**As built.** No code. `git grep -i vesseliz` across every repos/* origin/dev returns 0 hits. No provisional-vessel or
endpoint-contract shape exists. The spec was retired in 3b5035d7 (08-02) and the umbrella task still points at the deleted sibling
(openspec/changes/2026-04-26-impulse-activity-loop/tasks.md:2100–2102). No gap tracks it.

**Should.**
- Not a new organ. It is the ribosome's extraction (WIRING §6) pointed at `http_fetch` / external-call traces: group by
  (host, method, path template, response shape), and on N reached calls, register a discovery shape served by a thin
  dv resolver that holds the credential.
- It is sequenced **after** WIRING §6's single extraction predicate. Extracting from today's cross-bound or hollow runs would
  vesselize noise.
- Repair the doc contradiction: canon promises it, openspec retired it. File a docs-align row; don't silently keep both.

**Expect.** After N reached discord sends, a discovery shape such as `discord_message_post` appears, served by a vessel, and
the next send routes by shape with no composer call.

**Must-fail.** Unreached or 4xx calls never contribute to the contract. A host whose calls are all 401 is never vesselized.

## 4. Content threading (task-input binding)

**As built (binding grammar)**
- ias engine.ts:640–663 resolves `{{impulse:<slot>}}` (via `outputImpulseKey`, engine.ts:785–800) and `{{lifecycle.*}}`
  (engine.interpolation.ts:96–130; unresolvable lifecycle placeholders throw `UNRESOLVABLE_PLACEHOLDER`).
- Prior-task projections `{{<task>_text|_content|_json|_valueJson}}` are written to `accumulatedVariables`
  (engine.ts:955–975, 1267–1315).
- llm-prompt interpolates `{{var}}` / `{{a.b}}` from `context.variables`, plus declared inputShapes as `{{shapeName}}`
  (ias resolvers/llm-prompt.ts:44–140).
- Shape-proxied tasks: ias VesselResolver sends `task.config` verbatim as the pointer (vessel-resolver.ts:61–77). goal-host's proxy
  resolver interpolates `{{var}}` and `{{impulse:slot}}` (gh:15602–15640), and the walk's exec path interpolates
  `{{shape}}` / `{{shape.field}}` from pool content, shell-quoted (gh:7870–7894).
- **Unresolved placeholders are left literal** in every one of these except lifecycle (gh:15612, 15620; activity-api-provider.ts:241).
  A send whose body is still `{{greeting}}` would go out as that literal text.
- **The writer-class generator is author_producer's content synthesis**, author-producer.ts:477–502. Every minted
  `synthesize_<field>` task gets the prompt `…GOAL:\n{{goal}}` with `input_shapes:["goal"]`. The pointer carries `available_shapes`
  (:47, :171), but those are offered to the LLM only for *pointer* binding and never threaded into the content prompt.
- **The counter-guard already exists in the sibling.** author-composed-capability.ts:521–539 auto-appends
  `DATA (from the upstream step):\n{{impulse:<slot>}}` and wires `dependencies`, `input_shapes` and `inputImpulses`.

**Measured (existing census, output-shapes/2-output-chaining.md §3)**
- C4: **16 / 1,294** live LLM tasks bind only `{{goal}}` (1,138 templates). 8 of them are `auto-bridge-*`.
  **204** more have no placeholder at all.
- C3: `auto-bridge-obsidian:write_note` ran 37 times. In 32 of them a retrieval or compute shape was present in the pool and ignored.
- The exact intersection asked for (declares upstream `input_shapes` AND binds only `{{goal}}` or nothing) is **not measured**.
  C4 did not split by declared inputs.

**Should**
1. Reuse acc.ts:521–539's slot-append in author-producer.ts:477–502. When `available_shapes` holds a non-`goal` data shape,
   the synth task gets `{{impulse:<slot>}}` of that producer and declares it. This is one function shared in place of two copies.
2. Adopt the census's own gate (2-output-chaining.md:179): template admission refuses an LLM writer whose only placeholder is
   `{{goal}}` when its intent is report, summarize or synthesize.
3. An unresolved `{{x}}` in an **outbound-effect** task config must fail the task, as lifecycle placeholders already do
   (engine.interpolation.ts:101), instead of being sent as literal text.

**Expect.** For the discord goal, the posted message body equals the upstream synthesized greeting's content: it is hash-joinable
from the producer impulse to the send pointer.

**Must-fail**
- Re-submitting today's `auto-bridge-obsidian:write_note` is refused by the admission gate.
- A send task whose config still contains `{{greeting}}` after interpolation fails with an unresolvable-placeholder error.

## 5. Credentials (secret by reference) and human solicitation

**As built: credentials**
- No secret-by-reference mechanism exists. grep for `secret_set|secretRef|secret_ref|secret_name|credential_ref|{{secret`
  across local-tools, dv, gh, identity and llm-resolver returns 0. `secret_set` exists only as the 10-02 user ruling (operator memory):
  - value-blind writes;
  - compare-and-set (CAS);
  - validation of the new value;
  - auto-rollback by hash.
- dv http-fetch.ts:65–70 takes `pointer.headers` literally and injects only `METABOB_API_KEY`, and only for substrate-local hosts. An
  external bearer token would therefore sit in the pointer, and so in the trace.
- local-tools 38c8f23 (09-30) gives agent shells an allowlisted env (agent-shell-env.ts:19–28). Its header states the design:
  "a command that needs a shaped read should go through a resolver, which holds its own credential" (:16–17).
- The file read is still open. write-containment.ts:35–37 concedes that a shell can read /etc/substrate/env.
- **Tension:** the only external-auth pattern ever demonstrated (FIRSTTRY attempts 6–7: `set -a; . /etc/substrate/env`) is
  this exposure path. FIRSTTRY attempt 2 also showed the composer planning to pipe the env file through an LLM when the catalogue misled it.
- The secret-value refusal (gh:7735–7751, 16746) blocks *reveal* goals only.

**As built: human solicitation**
- `solicitHumanInput` (gh:15054) runs only inside the single-template recovery loop (gh:15018–15035). The conditions:
  - `recommendExcluding` returned no alternative;
  - once per run (`humanSolicited`);
  - only if discovery names a `human_input` producer. Today that is an Obsidian vault with the setting on (obsidian-vessel main.ts:1183,
    relative `/resolve`, vessel-client.ts:206), so the absolute-URL joiner bug does not bite.
- An answer grants one retry of the last excluded template with `variables.human_input`.
- It is **not reachable from the walk** or the floor, so a mid-walk "I need a Discord token / which server?" cannot be asked.

**Should**
1. Locality: a credential-holding resolver serves the outbound shape. The dv resolver reads its own key at use time, and the pointer
   names the secret by *name* only (for example `credential:"DISCORD_BOT_TOKEN"`), checked against a declared-name manifest. The value
   never enters the pointer, prompt or trace.
2. The write side is the ruling's value-blind `secret_set`, with human entry through the surface. A missing credential is the canonical
   **solicitation** case: the walk at the stall asks for "add DISCORD_BOT_TOKEN via secret_set", not the recovery loop.
3. Lift `solicitHumanInput` into the walk's stall branch, beside the gap filing at gh:11173, as one more offer in the forward mode.

**Expect.** The discord trace contains the credential *name* and never a value (secret-scan of the trace = 0 hits). On a missing
credential, a `human_input` solicitation is recorded inside the walk.

**Must-fail**
- A pointer carrying an `Authorization` header literal to a non-local host is refused by http_fetch.
- A planner output containing `. /etc/substrate/env` or `fileContent` of the env file is refused before mint.

## Stage-level control: the discord goal today (predicted from code, not dispatched)

Each step and the code it rests on:
1. Inference: `filterShape` drops the unserved `discord_*` target (WIRING §1). Otherwise PREREG-1 shows capture into feature_compose (3/3).
2. The walk takes 0 steps. No bridge: X is not live. No composer: R1.
3. The floor runs with read-only tools: no http_fetch, no shell (floor-tools.ts).
4. Result: honest not-reached, or a gap filed for the shape.

None of the five required motions (learn, build, connect, use, verify) has an in-run path today. Of the organs that exist:
- the composer has no caller;
- the bridge needs a live resolver;
- the floor has no outbound tool;
- no credential reference exists;
- solicitation sits outside the walk.

**Must-fail for the whole stage:** a send with no read-back of the posted message (a channel-history read showing the message id and
content) must not grade `reached`. The organ is the floor's `groundedOk` read-vs-write counter (gh:5564). The gate that acted on it
was relaxed on 07-27 (gh:5568–5578). Reconnect the counter as an effect read-back requirement for outbound shapes. Do not cite the gate as enforcing.
# CLOSURE: what happens after a goal produces output (2026-10-02, read-only)

Scope: persistence at walk end, the standing pool, output chaining, the downstream-use law, and the compose probe.
Code read at `origin/dev`: goal-host `a6e3506`, development-vessel `37709065`, activity-api `0e92a70`, ias `f155e05`.
"gh" means goal-host `src/index.ts` and "dv" means development-vessel.
Plan of record: `validation/reports/realignment-2026-09-29/goal-learn-flow/WIRING.md` @ `bdac579d`. That commit is not checked out in this working tree, so it was read through git, and its DESIGN.md has no overlap with this stage.

Already covered, so not re-traced here:
- `consumedProvenance` and the foreign-consumption gate (ias `0f38dc0`, gh `d693bbc`/`3ada979`/`a6e3506`), which is not yet on the trace-sink wire;
- ancestor credit and the six credit writers.

**Headline.** The user's law (07-20) is "a reach is real iff its outputs are USED to reach another goal". As built, the system cannot observe this across runs:
- No walk output outlives its dispatch in any addressable, content-bearing, producer-attributed form.
- The one inbound path from a standing store into a walk has never worked.
- The one table already keyed for cross-execution consumption (`composition_impulse_flow`) has no writer in any vessel.
- The cross-run reader (`producedShapesConsumable`) has had 0 call sites since `d737edb` (07-22).

**Regressions.** No strict regression was found in this stage. One defect was born broken (the hydrate, §2), and one leg was deliberately narrowed (`d737edb`, §4).

**Correction to WIRING (the "impulse-id reuse HIGH").** `937836a` (10-02 01:36) changed pool ids to `walk-<boot>-<dispatchDigest>-<shape>-<n>` (walk-pool.ts `poolImpulseId`). All three probe files carry the new form (`walk-wupq14-0899zpw-system_load_report-128`), so the change is live on node 2.
- Rows written before it still carry reused ids. The (execution_id, impulse_id) slot key remains correct.
- Satisfier producer ids use a second scheme, `walk-satisfier-<n>-<ms>`.

---

## 1. Walk end: what persists, and under which identity

**As built**
- **The live pool is released at walk end.** `runGoalAsPoolWalk` wraps the body in `try/finally { forgetLivePool(dispatch_id) }` (gh :7650–7658, `7c0aa9e` 10-02). The pool is a per-walk array (gh :7813), registered by reference only for the `goalWalkState {impulseId}` provenance read, and only satisfier search impulses are served (gh :17530ff).
- **The dispatch record holds a preview, not the output.** It keeps a `poolProvenance` preview: `{id, shape, goalSignature, producedBy, producerExecutionId, consumedIds, contentPreview≤2000, truncated}` (gh :10218, mirrored each step).
  - The record is flushed every 5s to a **node-local** file, `/workspace/goal-host-dispatches.json` (gh :18338, :18442–18448).
  - `pruneStore` blanks `poolProvenance` once the dispatch is outside the 100 newest, and deletes the record past 2000 (gh :18450–18461).
  - It is readable only through `goalWalkState` on the node that ran the walk.
- **Trace rows carry ids, not content.**
  - Satisfier and step traces carry `outputImpulseIds` (gh :10662–10664).
  - Composites carry per-task impulse ids and edges (gh :7141–7200, :12242).
  - `persistSatisfierTrace` sends no output content (gh :6845–6861).
- **The `impulse` table never sees walk ids.** activity-api's `queryImpulseSignatures` looks walk ids up in the `impulse` table (execution-trace-with-signatures.ts:663–683). That table's writers are the upkeep audit, `cluster_shadow_decision` (activities.ts:7571), and `POST /v2/impulses`. No caller of `POST /v2/impulses` was found in goal-host, ias-executor, development-vessel or `packages/`, so the join returns no rows for walk ids ("missing ids produce no row").
- **`carry` is intra-dispatch.** `carryForward(poolImpulses)` (gh :12450) feeds only retry, suppress and re-frame inside the same dispatch (gh :13840, :13916, :13956). It never feeds another dispatch.
- **The closest standing "reach record" holds identity only.** It is `goalReach:<goal_hash>` in dv's standing pool (goal-reach-tick.ts:959–961, 1142–1153). It records dispatch, `executionId`, `selectedTemplateId`, `write_shapes` and `reached_execution_id`, but no output content and no impulse ids.

**Identity fields available today**

| Amendment §2 field | Where it exists today | Reader |
|---|---|---|
| Source execution and step | trace `tasks[]`, `executionId` | ribosome, /reach |
| Producer | `poolProvenance.producedBy` and `producerExecutionId` | only `goalWalkState` (node-local, pruned) |
| Consumer | `consumedIds` on the pool impulse; `inputImpulseIds` on the task | foreign-consumption gate (same walk) |
| Binding | stepEdges and `consumedProvenance` (a6e3506) | strict reach→mint gate |
| Content reference | `contentPreview` (capped at 2000; A's `loadAttribution` is 2187 chars, so it is **already truncated**) | human, via goalWalkState |
| Conditions / variation | none | none |
| Consequence | reach verdict on the dispatch and the trace | credit writers |
| Horizon | none | none |
| Instrument | none (verdict_class on /reach only) | none |
| Idempotent update id | none | none |

**Prior art**
- `7c0aa9e` (pool release);
- `937836a` (unique ids, real `producedBy`, bound-only edges);
- the 07-27 "evidence ledger" preview (gh :10225 comment);
- `fa6772f` (04-05) `composition_impulse_flow` (§3).

**Should (reconnect first)**
- At walk end, give each content-bearing output a durable, cross-node address on an existing organ. The candidates are:
  - the trace row, with an `output_ref` naming the dispatch and pool id;
  - the existing `impulse` table through `POST /v2/impulses`, which `queryImpulseSignatures` already reads.
- Carry `producedBy`, `producerExecutionId`, `goal_hash`, the deployed sha (WIRING step 2) and an expiry/horizon.
- No new store.
- `pruneStore` must not be the only retention for evidence that credit depends on.

**Expect.** After A ends, a different dispatch can resolve A's `system_load_report` by `(executionId, impulseId)` with full content and `producedBy:satisfier:system_load_report`.

**Must-fail.** Address a third dispatch's impulse id that was never published, or a published one past its horizon. The answer must be no content (404 or abstain), and it must never be served from the preview.

## 2. Standing pool: hydrate, `producedBy:"seed"`, cross-run attribution

**As built**
- **The hydrate (gh :10017–10057)** resolves dv through discovery, with an env fallback. It POSTs `{pointer:{type:"poolImpulse",status:"open",limit:20}}` and reads `_sj.impulses` (gh :10049). Each hit is added with `producedBy:"seed"`, and the row's own `id`, `source` and `injected_at` are dropped.
- **dv's route rejects that body.** The route reads `body.impulse?.pointer ?? body.impulse` (dv routes/impulses.ts:1108), or a bare `body.type` (3ed68a61, 09-23). A top-level `pointer` matches neither, so the route answers **400 "pointer.type is required"** (:1118).
- **Second, independent break.** Even with a correct body, the route answers `{success, shape, body:{impulses}}` (:1155), so the top-level `_sj.impulses` read is undefined.
- **The failure is silent.** A non-ok status skips the walk without a tap. The `catch` tap ("standing pool hydrate skipped") fires only on throw or timeout: 3 times in node 1's last 24h, against about 79 goal-target inferences.
- **Positive control at the same address.** dv's own rhythm-conductor-tick.ts:270 sends `{impulse:{type:"poolImpulse",…}}` and is served.
- **Effect on the probes.** All 3 probe `poolEvents` go goal → seed var goal → seed var dispatch_id → first satisfier, with **zero** standing-pool events.
- **Born broken, not a regression.** The hydrate came in with substrate-authored `9850704` (07-09) in exactly this form. The route's parsing at that date (dv `4d0a595e`) was the same.
- **Who writes open poolImpulse rows.** All writers are policy and state writers; **none writes walk outputs**:
  - change-series-tick (`changeSeriesPlan`);
  - goal-reach-tick (`goalReach`, `goalReachPolicy`, ledger, `limitChangeProposal`);
  - rhythm-conductor and rhythm-reality-sync (`timeShapedRhythm`, `gapClosingCadence`);
  - substrate-gap (:1782);
  - operator trust-root rows (`substrateNodes`, `autonomyScope`, `spendEnvelope`; pool-impulse.ts:79).

  The write frequency follows those ticks. No writer ever sets `status:"consumed"`: there is no `'consumed'` assignment in dv src, so the status enum's `consumed` value is unreachable.
- **Name collision.** goal-host also serves a shape named `poolImpulse_write` (gh :1300, handler :17829), which is a dispatch-scoped injection queue. dv serves `poolImpulse_write` as the standing-store write. **The coordinator should check with `registry_query` which one discovery routes to.**
- **Human-injected impulses get no provenance.** They are added with `mkImpulse` and no provenance (gh :10271), so `producedBy` defaults to `"goal-host-walk"`, not human.
- **Cross-run consumption is never attributed.** The standing pool carries no producer execution, hydration erases row identity, and nothing reads consumption back.

**Should**
- **Do NOT just fix the envelope.** A working hydrate would pour the 20 most-recently-updated *policy* rows (rhythms, plans, trust-root rows) into every walk as "seed". That would widen the seed-only completion guard's seed set (gh :11595) and inject policy into prompts.
- Separate the two stores:
  - the standing pool stays policy and state;
  - walk outputs are published per §1 and offered per §3.
- If hydration is kept, it should:
  - filter by a consumable-shape need (the walk's pending targets);
  - preserve `producedBy`/`producerExecutionId` and the row id as `carriedFrom`;
  - log non-ok answers loudly (the "silent skip = pass" law).
- Also:
  - human-injected impulses get `producedBy:"human:<operator>"`;
  - the `poolImpulse_write` collision is resolved by renaming one of the two shapes.

**Expect.** One hydrated row appears in `poolEvents` with `source` = the row id and `producedBy` = the original producer. A dv non-ok answer produces one journal line.

**Must-fail.**
- An empty standing pool means zero hydrate events (control).
- A row of an unrelated shape (e.g. `timeShapedRhythm`) is **not** added to a walk that does not target it.
- A trust-root row is never seeded into a walk.

## 3. Output chaining (REALIGNMENT §2.0b: "a produced shape is offered to open goals that consume it")

**As built: no code offers a produced shape to another open goal.**
- **change-series-tick (c24)** advances an operator- or activity-seeded *edit plan* one step per tick. It reconciles against the file tree and dispatches each step as a goal (dv change-series-tick.ts:1–60, 264–275). Its chaining is by plan order and the tree, **not by output shape**. Citing it as the output-chaining organ would be a mis-cite. It is the nearest organ for durable multi-dispatch state only.
- **`composition_impulse_flow` is the existing organ keyed exactly right**: `edge_id, execution_id, impulse_id, direction (input|output), shape, execution_succeeded`.
  - Writer: `POST /v2/activities/composition` (activities.ts:8179–8460, `fa6772f` 04-05).
  - Reader: `GET /composition/impulse-success` (:8824–8900).
  - **No vessel src calls the POST.** The search covered goal-host, ias, dv, ribosome, boredom, light-dispatch and `packages/`. dv reads only `/composition/graph` (activity-metrics.ts:38, coarsenable-chain.ts:50, goal-summary.ts:33). Nothing found calls `impulse-success`.
- **The only "offer" is in-walk.** The in-walk pool and `carry` (§1) offer a produced shape only within one dispatch. Across dispatches, the only reuse is pathway borrowing by shape signature (WIRING §2/§7), which reuses *templates*, not *outputs*.

**Prior art**
- §2.0b names c24 and states the capability unbuilt (REALIGNMENT.md:147–158).
- The 07-20 probe chained by hand-seeding `variables` + `composition_chain` (§4).

**Should**
- Name the reader first (the "nothing written just to exist" law): the reach→credit reader of WIRING step 3 reads `composition_impulse_flow` for a producer's outputs. Only then does the trace sink (or the walk's composite persist) start writing flow rows with *cross-execution* input ids.
- The offer itself is an activity (law 2), not a resolver. When a goal is admitted, it looks up published outputs (§1) whose shape is in the goal's inferred targets or `pendingTargets`, within their horizon, and seeds them into the pool with `carriedFrom` = the producer execution.

**Expect.** Run D after A and B. D's pool shows `system_load_report` with `carriedFrom = walk-satisfier-1-1790982368875`, and one `composition_impulse_flow` input row whose `execution_id` is D's and whose `impulse_id` is A's.

**Must-fail.**
- A's output past its horizon, or from another tenant or account, is **not** offered.
- An output whose producing walk was graded hollow is not offered as evidence. It may be offered as data only with `hollow:true` visible.

## 4. Prior downstream-use attempts, and what reads them now

| Date / commit | What was built | Who reads it now |
|---|---|---|
| 07-20, B2 consumption probe (memory `project-consumption-probe-B2-half-verified-2026-07-20`) | Ad-hoc `run_goal_async` probes, with output hand-seeded through `variables`/`composition_chain`; a deterministic consumer `json_path_extract` (dv). Hollow rejected 3/3 (incl. the 0325baf2 right-shape/wrong-content case); genuine outputs consumable. **No activity minted; the credit leg was never built.** | Nobody: the verdicts were read by hand from walk logs. |
| 07-22 `16bde03` → `fbdac11` | `producedShapesConsumable` (gh :6417): credit iff dv `consumer_productivity_audit` reports `productively_consumed`. The first version was registry capability; it was then trace-grounded. | **0 call sites** since `d737edb`. |
| 07-22 `d737edb` | Replaced it with the **in-chain consumption ledger** `consumedInChain` (gh :10132): a later step in the SAME walk binds an earlier step's shape. The audit was dropped as lossy (~0 truly_covered from a biased 100-trace window). | α gate and mint gate (`isGroundedHonestReach`, gh :6371). |
| standing | `propagateCreditAlongChain` (activity-api posterior-update.ts:763): ancestor credit along one execution's `composition_chain` | /reach and insert path (WIRING §5) |
| standing | `consumer_productivity_audit` (dv) | `vessel_arrival_scan` (dv :426): a fleet-health gate, not a reach grade |
| 09-20 (memory `reference-human-participation-baseline-…`) | The human-answer consumption link was repaired (three severances); this is consumption of a *human* contribution by readers. | interactor-log / solicitation readers. It is orthogonal to producer credit. |

**The `d737edb` narrowing was deliberate, but it cut the cross-run leg completely.**
- The code still claims that leg exists:
  - gh :11880: "producedShapesConsumable stays defined for the OUT-OF-BAND retroactive/active path";
  - gh :14381: "retroactive downstream-use credit still applies if the output is later consumed".
- **No such path exists.** Ancestor credit is intra-chain, and no cross-dispatch consumption record exists (§§1–3). These two comments are hollow claims in code.
- The ledger also cannot fire on single-satisfier walks. D's log says so: "consumedInChain=0, which every satisfier pick is". Since every reach in the WIRING sample came from a satisfier, the law has no operative reader.

**Should**
- Reconnect the existing organs: credit by downstream reach = a /reach ingest of a consumer execution whose `consumedProvenance` names a *foreign* producer (a6e3506 already classifies `origin:"foreign"`).
- Today that classification only *blocks* the consumer's reach. When the consumption was **offered** (§3 `carriedFrom`), not stolen, it should instead emit one attributed observation to the producer: two-sided, idempotent by `(producer_exec, consumer_exec, impulse_id)`, with horizon.
- Retire `producedShapesConsumable` or wire it. Fix the two comments.

**Expect.** D reaches using A's output, and A's producer arm gains one observation keyed by the triple. A replayed ingest adds nothing.

**Must-fail.**
- D consumes A's output and **fails**: A's α is unchanged, and the observation is recorded as unresolved or negative per §2, never as +α.
- Crossed binding (a foreign impulse that was *not* offered) must stay refused, as a6e3506 does.

## 5. The compose probe (node 2) as the concrete case

Source: `tmp/w-<id>.json` (goalWalkState snapshots; `compacted:null`, so still inside the 100-record window).

| | Goal | Inferred targets | Reached | Produced (`producedBy` → `producerExecutionId`) |
|---|---|---|---|---|
| A `4eed9974` | current system load | `system_load_report`, `loadAttribution` (0.9) | yes (LLM verdict) | system_load_report ← satisfier → `walk-satisfier-1-1790982368875` (510 chars); loadAttribution ← satisfier (2187, truncated in the preview); `consumedIds:[]` on both |
| B `a212c82d` | yesterday's headlines | (web_search → llm_completion) | yes (LLM verdict) | web_search ← satisfier (3270 chars); llm_completion `consumedIds:[…web_search-134]`, a real in-walk edge |
| D `6d9c59f0` | briefing = load + headlines | **`web_search` only (0.66)** | **no** | webSearchResult for "current system load" → **ercot.com grid page**; fileContent/shellResult/memoryNote_write from learned compositions, with **content = `{producedBy, executionId}` only (104 chars)** |

**What the case shows, joint by joint**
1. **Inference dropped half the need before any pool question arose.** "System load" became a web search (an ERCOT grid page): D's inference read the briefing as a news-search goal. This is WIRING §1's inference defect, and it comes first.
2. **A and B's outputs were unreachable to D.**
   - Their pools were released at walk end (§1).
   - Their content sits only in node 2's local dispatch file, as previews.
   - The standing-pool hydrate sent nothing (D's `poolEvents` show no hydrate rows; §2).
   - Nothing offers outputs across goals (§3).

   D therefore re-derived everything, and badly.
3. **Mid-walk template steps carry bookkeeping, not output.** In D's pool, horizontal template outputs are `{producedBy, executionId}` stubs (gh :10961 adds that object as content; `isBookkeepingOnly` at :10158 knows it). So even an offered template output would not be content-bearing.
4. **D's failure taught nothing about A or B.** β was withheld on the satisfier and the learned composition ("α structurally unreachable … consumedInChain=0"). No observation reached A's or B's producers, in either direction.

**Should.** Keep this probe as the slice acceptance (Amendment §7). It only becomes a valid test of chaining once:
- (i) inference keeps both needs (WIRING §1);
- (ii) A and B publish outputs (§1);
- (iii) the offer activity seeds them into D (§3);
- (iv) D's outcome credits A's and B's producers through the foreign-but-offered observation (§4).

**Expect (in order).**
- D's goal-target inference lists a load shape AND a headline shape.
- D's `poolEvents` show `system_load_report` and `llm_completion` with `carriedFrom` = A's and B's executions.
- D's composite has `consumedProvenance` with `origin` "foreign/offered".
- If D reaches: one observation each on A's and B's producers, visible in the store selection reads.
- If D fails: the observations are recorded and not +α.

**Must-fail controls.**
- Re-run D with A's output expired (or A replaced by a hollow stand-in, in an isolated fixture). D must not count A's output as supported continuation, and A gains no α.
- Run D twice with the same A output: one observation, not two.

## Order (smallest change that makes the next observable)
0. **Inference keeps compound needs.** This is WIRING §1 and blocks the probe.
1. **Publish outputs at walk end (§1).** Use an existing table plus the deployed sha; retention is decoupled from `pruneStore`.
2. **Offer activity (§3), then `composition_impulse_flow` rows with a named reader.**
3. **Foreign-but-offered consumption → producer observation (§4)**, inside WIRING step 3's single verdict→credit reader.
4. **Standing-pool hydrate:** decide to fix it (filtered, provenance-preserving, loud) or delete it. In its current form it is a born-broken dead path, so delete-or-fix is a decision, not a patch.

Each step lands with the must-fail control named above.
# VOCABULARY & INTENT — how shapes and intent classes come to exist, and what keys on them (2026-10-03)

Read-only. Code at origin/dev: activity-api 0e92a70 · goal-host a6e3506 · development-vessel 37709065 · concept-db f705b61 · discovery 19e8e78.
Live evidence: node 1 (substrate-live) journals, 24h, read via journalctl only. Plan of record: super-repo bdac579d `validation/reports/realignment-2026-09-29/goal-learn-flow/`.
Not re-investigated (cited): fetchKnownShapes / unread descriptions and NOT_PROSE_RE (WIRING §1); store-wide state-signature read (WIRING slot-fix HIGH, ias f155e05); impulse-id reuse (fixed goal-host 937836a per coordinator).

## Regressions and contradictions (lead)
| # | What | Mechanism |
|---|---|---|
| R1 **REGRESSION** | activity-api **77785f4** (10-02, deployed) regresses B2 **2c91aaf** (07-31) | B2 added `GET /v2/activities/deliverable-shapes` to admit shapes produced ONLY by learned composites into the inference vocabulary (goal-host gh:5903-5908 names `conceptDescription`). V1 (activities.ts:1314-1340) now requires a *live discovery advertiser*, so learned-only terminals can never pass, and the union into fetchKnownShapes adds zero names (advertised ⊆ discovery /registry/shapes, which goal-host already reads). Live: `conceptDescription` is not in the 409-shape registry → no longer aimable. 77785f4 fixed a real hole (obsidian:write_note aimable with no producer). The check is wrong: it should test **resolver-claim** (every task's resolver is advertised), not **shape advertisement**. |
| C1 policy contradiction | ψ blend switched on by a row-count latch | `accelerator-flag-tick.ts:52-70` (substrate-authored **8972cda**, 07-02) sets SF_BLEND=1 once `successor_features` ≥200 rows, and `next = current===1 ? 1 : desired` means it can never switch off. There is no reach-graded evaluation. goal-host `psi-inputs.ts` (08-17) says the blend must be enabled "against observed values, not ahead of them". Live: SF_BLEND=1 at sf_rows≈2750; **610 "successor-features blend applied"/24h**. Nothing worked-then-broke, so this is not a regression. It breaks law 12. |
| C2 hollow advertisement | concept-db `concept_supersede_write` / `_retire_write` / `_delete_write` | Listed in SUPPORTED_SHAPES (impulses.ts:69-71) and advertised in the live registry. The only "case" is a no-op `switch('')` (impulses.ts:50-58) that exists to satisfy the shape-dispatch lint. The real dispatch falls through to `default:` → **400 "Unknown impulse shape"** (impulses.ts:1076). Added autonomously (9d7d715, 09-01). |
| C3 duplicated class | two news/web routes | An inline block at the top of `inferGoalTargetDecision` (goal-target-inference.ts:475-496, extended by substrate-authored **7fe068c** 10-02) and `deterministicWebSearchRoute` (:277, reached only through `deterministicRegistryRoute` :321) define overlapping classes with different targets: [web_search, llm_completion] at 0.66 vs [web_search] at 0.9. The inline block wins. This is the two-site drift that goal-intent.ts:5-10 warns against. |

## 1. Paths that add a shape name to the live vocabulary
**As built.** There are three vocabularies, not one:

**(V-reg) discovery registry.** It is rebuilt from live registrations and pruned by TTL. That makes it the only place where canon's "pruned when no resolver claims them" (IMPULSE_ACTIVITY_FOUNDATION.md:67) holds by construction (registry.ts:22 `DEFAULT_TTL_MS` 5 min, `pruneExpired` :138). It accepts any non-empty string as a shape (index.ts:333).

**(V-tmpl) activity `output_shapes`.** Not pruned.

**(V-pool) impulse `shape` fields.** Not pruned, and not checked against anything.

| Mint path | Where | Gate |
|---|---|---|
| Vessel `config.discovery.shapes` (hand or lane commits) | each vessel config.ts → discovery register | shape-dispatch lint only; the lint is defeated by a dummy switch (C2) |
| `author_new_resolver` splices a NEW shape literal into config.ts | dev-vessel author-new-resolver.ts:72 (5e2dbe7b, 06-19); called from gap-to-feature, orphaned-capability-scan | tsc + shape-dispatch + bun test. "when omitted a minimal compiling stub is generated" (:23), so a stub can advertise a shape |
| `author_composed_capability` deliverable = `composedDeliverable_<goal slug>` | author-composed-capability.ts:571-578 (df174dbf, 06-27); via gap-to-feature/feature-compose | none. One shape per goal surface form, i.e. an intent class of size 1. Live registry has 0 such names: minted into the activity table only |
| Template create, missing outputs: category fallback `patch`/`source_code`/`test_result`/`tool_output`/`config_file`/`activity_template`/`documentation`/`unknown_output` | activities.ts:317 route, ~690-740; same synthesis **on read** in activities.templates-db.ts:167-236 | none. Placeholders are stripped only for learned/composite rows (PLACEHOLDER_OUT ~:630) |
| Prose inference of shapes | utils/shape-inference.ts (`SHAPE_INFERENCE_RULES`); `categorizeShapes` known/novel has no non-test caller | none |
| Drafted gap-closing activity | dev-vessel seed/draft-gap-closing-activity.ts:127,166 forces `["patch_proposal"]` | deterministic. **Does not mint** |
| Auto-bridges `auto-bridge-<X>` | goal-host mintGovernorAllows gh:6184 | names an activity after an existing shape. **Does not mint a shape** |
| Learned satisfier/ribosome `learned-satisfier-<shape>` | per WIRING §6 | the id is per existing shape. **Does not mint** |
| Pool-only shapes: `cluster_shadow_decision`, `stateSpaceSignature`, `successorFeatures` (none registered) | activities.ts:7571; dev-vessel compute-state-signature.ts:557 | none |
| Learned deliverables into inference | activity-api activities.ts:1269 (2c91aaf) → gh fetchLearnedDeliverableShapes | since 77785f4 adds nothing (R1) |

**The 06-04 "no new shape minting" ruling is not enforced anywhere.** It appears only as per-proposal self-attestation: #7 tasks S.3; #1 proposal:93,224; #6 proposal:62,84; SUBSTRATE_AS_MDP.md:602. The proposals name the shape-dispatch lint as the check, and that lint certifies advertisement, not implementation. Meanwhile dev-vessel coverage-tick.ts:291-339 sets `coverage_progress` true only when a recent window "introduced a new shape". It is read by substrate-health-tick and observe-and-author-from-gaps, and it rewards novelty in trace vocabulary: pressure in the opposite direction.

**Prior art:**
- 2026-04-03 6fca3a3: semantic tags and implied shapes;
- 06-19 5e2dbe7b: net-new resolver authoring;
- 06-27 df174dbf: composed capability;
- 07-04: mint governor (activities only);
- 07-31 2c91aaf: B2;
- 10-02 77785f4: V1.

**Should** (reconnect existing organs, no new organ):
- (a) One vocabulary predicate, "claimed": a shape is in the vocabulary iff some live resolver claims it, either directly (V-reg) or through a non-retired template whose every task resolver is in V-reg. Use it in deliverable-shapes (fixes R1), in template create (refuse an unclaimed output_shape, except on a resolver-authoring proposal) and in inference.
- (b) **Never synthesize shapes on read.** Return `output_shapes: []` with a `shapes_unknown:true` flag and let selection treat that as unclaimed.
- (c) Make the shape-dispatch lint execute each advertised write shape once against a fixture and fail on a 400 "Unknown impulse shape". Delete the dummy-switch pattern.
- (d) `author_composed_capability` reuses the target shape. A goal-slug shape is allowed only when no target exists, and then as a *class* name from (2), never as surface form.
- When to mint a shape: only when a new resolver is authored whose output has no claimed producer (law 3). Too broad: a shape claimed by ≥2 resolvers whose reach rates diverge under a named condition, which feeds the (3) split rule.

**Expect:**
- live registry and template vocabulary converge: unclaimed template output names → 0;
- `composedDeliverable_*` and `unknown_output` rows stop growing;
- deliverable-shapes returns `conceptDescription` while a composite producing it has all-live resolvers.

**Must-fail controls:**
- the same composite with one task resolver masked → excluded;
- `POST /templates` with output `foo_unclaimed_shape` → refused;
- after (c), the lint goes red on today's concept-db tree.

## 2. Intent keys — what reuse/selection keys on
**As built.** Four keys, none of them an intent class:

| Key | Producer | Form | Reader |
|---|---|---|---|
| goal_hash (walk) | gh goal-target-inference.ts:29 `goalHashOf` | **FNV-1a 32-bit, 8 hex**, over NFC/lowercase/whitespace-normalized text | goal-host local: inference cache, router ids, lexical rebind |
| goal_hash (store) | activity-api goal-paths.ts:177 `hashGoal` | **md5 → 16 hex** over `normalizeGoal` (ids→"id", digits≥10→"n", punctuation stripped) | `goal_execution_paths` retrieval (:966) |
| goal_category | gh:6789 (record) and gh:7002 (recommend) | **hard-coded `"meta"`** at both sites | goal-paths.ts:969 `AND goal_category = $goal_category`, a filter that is vacuous by construction. The 6-value enum (schemas.ts:727) is never set to anything else by any repo |
| state signature, caller | dev-vessel compute-state-signature.ts:223-227,507-533 (3cd263db, 06-01) | **sha1 → 8 hex** over environment buckets (load/mem/sr/op/cad/rhy/lcc/act). No goal and no shapes | sent by gh at :7084/:10407. activity-api **rejects it** (activities.ts:6596-6618, check since 54c3b75 06-26, warn since c0bcdbb 09-16): **613 REJECTED/24h, all `received_length:8`** |
| state signature, actually used for CTS/ψ/cluster read | activities.ts:6620-6632, derived from `effectiveShapes = impulse_shapes ∪ extractImpliedShapes(task_description)` (:6269) | md5-16 over shape set | context_thompson_scores, successor_features, signature_cluster_assignment |
| state signature, write | execution-traces.ts:3520-3548 `deriveSignatureShapes(trace)` | md5-16 over the trace's own task shapes + provenance + missing | posterior writes, embeddings, ψ writes |

Three quantities share the name "state signature":
- the 05-17 spec (proposal:9) defines it as the shape pool at binding time;
- dev-vessel minted a situational one two weeks later;
- the `/recommend` read side derives it from **goal text**. goal-host's `recommendExcluding` sends no `impulse_shapes`, so the selection-path key is `extractImpliedShapes` (utils/semantic-tags.ts:333-410, 6fca3a3 04-03): **~12 keyword regexes over an 11-shape April "canonical schema" vocabulary** (source_code, error, trace, execution_trace, activity_template, activity_metrics, test_suite, goal, sql_schema, metrics, config_file). That is the only intent-class mechanism in the selection path today, and it is operator-defined and frozen.

**Live measurement:**
- 660 `cts_sig_lookup` per 24h over 190 distinct signatures;
- **528/660 hits=0**;
- 24 signatures ever hit;
- the top 5 signatures carry 193 lookups.

**Hypothesis (unattributed):** read key ≠ write key. Cold cells produce the same negative.

**Intent-class organs that DO exist (operator-defined classes):**
| Organ | Site | Classes |
|---|---|---|
| **ClassRow = parse + command + oracle per class** | gh index.ts:2609 (interface), :2863 `CLASS_ROWS` (ef5c645/e8caa37, 07-30), dispatcher :2865, :3960 | 3 rows: avg-threshold, below-mean, above-count. Data-shaped, but compiled into `src/index.ts`, which the lane cannot edit (REACH "Known blocker") |
| Deterministic verdict oracles | gh index.ts:1640-2830 | ~20 `deterministic:verified-*` kinds: compute-answer, file-count, registry-count/ratio, gap-total/top/ratio, git-commit-count, ephemeris, dep-list, field-value, shape-producers, two-source-compare, multi-source-combined, … |
| Missing-verifier families → gaps | gh missing-verifier-gap.ts:50-59 (fdb7036, 08-07) | 9 regex families (distinct-file-extensions, subdirectory-count, function-count, …) |
| Verifier recipes (verifier as data, per family) | gh verifier-recipe.ts (48f67f9, 08-07); index.ts:4917-4936 | **4 recipes live**, held in **node-local** `/workspace/state/verifier-recipes.jsonl` (a learned-state fork, K9) |
| Verdict class → gap (wrongness as goal seed) | dev-vessel resolvers/verdict-class-gap.ts | one gap per `deterministic:<token>`. Feeds gaps; **no selection key reads verdict_class** |
| Target routes (regex) | goal-target-inference.ts | inline news (:475), `deterministicVerbatimReadRoute`, `…CompositionAsk` (:225), `…EnvGateRoute` (:284), `…RegistryRoute` (:320, nests `…WebSearchRoute` :277), `namedAdvertisedShape`, compute/count → shellResult (:497 one-liner), explanatory prose route, `isCodeInvestigationGoal` (:415), `isGapInvestigationGoal` (:433) |
| Goal predicates | goal-intent.ts:30,41,61,104; quantitative-goal.ts:42,80; verbatim-read.ts:82; goal-file-resolution.ts:232 | durable-artifact, edit-intent, demands-landed-edit, gap-repair, countable, quantitative-repo, verbatim-read, pathless-code-change |

Accretion: goal-target-inference.ts has **64 commits, 28 substrate-authored, 14 since 09-01**. The 06-25 spec (proposal:42) put a deterministic classifier explicitly out of scope ("could come later via the embedding recommender"). It accreted as regex branches anyway, and the lane now adds them itself (7fe068c).

**Prior art:**
- 04-03: semantic-tags;
- 05-17: signature spec;
- 06-01: situational signature;
- 06-26: rejection check;
- 07-30: ClassRow;
- 08-07: recipes and missing-verifier families;
- 08-14: goalHashOf on work, not surface form.

**Should:**
- (a) **One intent key = class id**, produced by the existing organs in this order: ClassRow `owns()` → missing-verifier family → verdict_class token → target-shape set. Fall back to the shape set (not the April keyword table).
- (b) Move `CLASS_ROWS` and the family regexes out of index.ts into a shaped `intentClass` record: `{id, owns(parse spec), command(selector), oracle, parent}`. The lane can then add classes, and the class becomes a selection key that the store also reads.
- (c) Send the class id as `goal_category` (widen the enum to a string), and drop the constant `"meta"`.
- (d) One goal-hash domain (store md5-16 over goalHashOf's normalization), as WIRING §6/7 already asks. goalHashOf's own comment (:36-38) records that the domains differ.
- (e) Retire `extractImpliedShapes` as a signature input. The read side either uses the caller's pool shapes (05-17 spec) or the class id, and dev-vessel's situational hash is renamed (`situation_hash`) so it stops colliding.

When to mint a class: a hollow/wrong verdict cluster over ≥N distinct goals with no `owns()` match, which is the CLAUDE.md "wrongness is a goal seed" path, already present as verdict-class-gap. When it is too broad: see (3). When to change horizon: see (5).

**Expect:**
- `cts_sig_lookup` hits=0 share falls well below 80%;
- no "REJECTED (wrong form)" warns;
- every `goal_execution_paths` row has a non-"meta" category;
- a class added by the lane changes routing without an index.ts edit.

**Must-fail controls:**
- **attribution (run first):** one dispatch. Compare its trace's `metadata.state_space_signature` with the `cts_sig_lookup` sig logged for the same `/recommend` call. Different → split key confirmed. Equal → the zeros are cold cells and (e) is moot.
- a goal matching no class → `goal_category:"unclassified"`, never "meta";
- two phrasings of one class → same class id;
- two goals of different classes with the same target shape → different ids.

## 3. Learning-rate #8 — hierarchical signature clustering (636e2ff, 06-04 spec)
**As built:**

**What is clustered.** Write-side v1 signatures. The embedding text is the sorted, comma-joined shape set, embedded by concept-db MiniLM (signature-embedding.ts:9-32; created only on posterior write, posterior-update.ts:1340-1346; `runSignatureEmbedBackfill` has no caller). The algorithm is concept-db's **greedy leader clustering**: cosine ≥0.6, max 12, order-dependent (concept-db impulses.ts:712-740), not HDBSCAN. Stable id `sigcl_`+sha256(min member) (signature-cluster.ts). The tick runs at boot +5 min, then every 6h (env `SIGNATURE_CLUSTER_INTERVAL_MS`, index.ts:684-719).

**Live** (org substrate, 02:11Z): 2301 signatures, **240 clusters, 45 noise, 80 contaminated (33%)**; it was 2254/236/85 eleven hours earlier.

**Contamination action: SKIP, not split.** A cluster is contaminated when the p̂ spread among members with n≥5 exceeds 0.4 (signature-cluster-tick.ts:42-50,109-127). The whole cluster is then excluded from writes (cluster-posterior.ts:52,326) and from reads (activities.ts:6721,7053).

**D5.1 read.** When a leaf is cold (n<5, env `SIGNATURE_CLUSTER_N_MIN`), use the cluster posterior (activities.ts:6700-6745, 7030-7066).

**Measuring live firing.** The decision log is `logger.debug` (:6739). The journal carries **0 DEBUG lines in 24h** (230k INFO / 19k WARN / 1.8k ERROR), so it cannot be measured from journals. The shaped instrument is the `cluster_shadow_decision` impulse (activities.ts:7540-7595, sample rate 1.0) in the `impulse` table, countable by `metadata.used_scope`. That is a DB read and needs user approval. `GET /v2/cluster/status` (routes/cluster.ts:108) exposes **write-side** counters only. `thompson_selection_log` has no used_scope column (WIRING §2).

**Bound** (inference, unverified):
- assignments exist only for write-side signatures;
- a read signature with no CTS rows has no assignment, so it is `fallback`;
- so cluster scope can fire only within the ~24/190 read signatures that ever hit, about 132/660 lookups at most;
- it fires less still if the read/write keys split (2).

Both #8 and the ψ blend live only in `/v2/activities/recommend`, and WIRING §2 shows satisfier and bundle picks bypass it.

**Prior art:**
- 06-01: the cold-start finding (proposal "only one concept has non-zero signal");
- 636e2ff: landed, while every task in tasks.md is still unchecked (law 9 drift);
- 8257a4a: removed input-shape-conditioned priors (REACH v2 note).

**Should:**
- (a) Raise the D5.1 decision to INFO, or count used_scope in an in-process counter exposed on `/v2/cluster/status` alongside the write counters. An instrument you can't see is K4.
- (b) **Split, don't skip.** A contaminated cluster spawns children on a *named observable condition* (producer live/offline, credential present, node, slot bound, precondition met). Children inherit the parent posterior as a prior (06-04 #8 shadowing), and indistinguishable siblings merge.
- (c) Re-grade the cluster tick on the reach signal (WIRING step 3), not on CTS α/β contaminated by exit-status writer (e).
- (d) Cluster over class ids (2) as well as opaque signatures: class → cluster is the slow variable, leaf → the fast one (SUBSTRATE_AS_DYNAMICS.md:82-83, 431).

**Expect:**
- used_scope counts are visible per hour;
- contaminated share falls as splits replace skips;
- one class splits on a named condition and reaches where its producer is live while stalling where it is offline (REACH v2 acceptance).

**Must-fail controls:**
- a synthetic cluster with spread >0.4 and no differing observable → stays contaminated (no split invented);
- a cold leaf in a contaminated cluster → `fallback`, never `cluster`.

## 4. Concept-db as vocabulary or class definition
**As built:**
- **No shape vocabulary.** Concept `shape` is a free per-concept field from `inferShape(source_type)` (concept.ts:33-54, falling back to `'unknown'`). The `impulse_signature` concepts (concept.ts:966-1046) are pointer-type signatures, not a shape registry.
- **Supersession is not implemented:**
  - no `superseded_by` field anywhere in concept-db src;
  - the write shapes are hollow (C2);
  - the 06-01 spec tasks A–H are all unchecked (A.1 edge type, B.3 search filter, E replay of 33 superseded concepts).
- **Read at inference: yes, but as free text.** goal-host recalls up to 5 concepts by BM25 terms and prepends them to the target-inference prompt (gh:12807-12925).
  - Live: 229 "recall SUCCEEDED" in 24h, 33 connect failures.
  - Nothing reads a concept as a *class definition*: no concept carries `owns`/oracle, and no selection key reads concept ids.
  - `loaded_concept_ids` enter dev-vessel's situational hash only as a bucketed count `lcc` (compute-state-signature.ts:516). That hash is rejected (2).
- Drafter-facing `compose_lesson` is read at prompt-build (per MEMORY), targeting a gap's edit_site, not an intent class.

**Prior art:**
- 06-01: supersession spec;
- 07-04: walk-time concept consult;
- 09-01 9d7d715: hollow write shapes.

**Should:**
- (a) Implement the 06-01 A.1/A.2/B.3/B.4 minimum: a `supersedes` edge, a `superseded_by` field, and a default search filter. That gives words their supersession.
- (b) Store the `intentClass` record of (2b) as a concept (`source_type:'intent_class'`) so recall at inference returns the class definition, and `owns()` can be evaluated from it.
- (c) Retire, or make honest, the three hollow write shapes.

**Expect:**
- `concept_search` excludes superseded concepts by default;
- inference recall returns an `intent_class` concept for a goal of a known class.

**Must-fail controls:**
- `concept_supersede_write` today → 400 (record it as the baseline);
- after (a), a superseded concept is absent from default search and present with `include_superseded:true`.

## 5. ψ successor features (#7) and TD(λ) (#6)
**As built:**

**TD(λ): LIVE.**
- λ comes from tuning row `TD_LAMBDA`, then env, then default **0.7** (posterior-update.ts:131-160), applied as `λ^depth` (:836-865).
- Landed in 622fe84 (06-04) and seam3a (c46afaa, 06-30). Its tasks.md is unchecked.
- No `td_lambda_invalid` warns in 24h.

**ψ: write LIVE, read LIVE in /recommend only.**
- Write: `successor_features` Robbins–Monro mean at trace ingest (successor-features.ts:150-240; execution-traces.ts:3646; env `SUCCESSOR_FEATURES` default on), 4c6f5fe (06-27).
- Read: blend `thompson + w·v/(1+v)` (activities.ts:7300-7330), gated by SF_BLEND (C1). It needs `completion_shapes` plus a signature, which goal-host supplies through `psiInputs` (psi-inputs.ts, 08-17).
- 610 blends in 24h, e.g. `informed_cells:37 of candidates:682`.
- ψ is keyed by the same `/recommend` read signature, so (2)'s split-key hypothesis applies to ψ too.
- Not built: the `successorFeatures` shape and resolver (DEV-B/C), the vessel (DEV-D), and the replay acceptance (VERIFY.1-8).

**Law-1 table:**

| Knob | Form |
|---|---|
| TD_LAMBDA, SF_BLEND, EMBEDDING_PRIOR_ENABLED | tuning row + env override |
| SUCCESSOR_FEATURES, SF_BLEND_WEIGHT, SF_TOPK, SIGNATURE_CLUSTER_N_MIN, SIGNATURE_CLUSTER_INTERVAL_MS, CLUSTER_SHADOW_SAMPLE_RATE | **env only** (law 1) |

**Should:**
- (a) Replace the SF_BLEND latch with a reach-graded A/B: blend on vs off by request-seed parity, and keep it on only if reach(on) ≥ reach(off) over a pre-registered window. Add an off path.
- (b) Read ψ where goals actually choose: the walk's satisfier and bundle picks (WIRING §2 "one decision log").
- (c) Use ψ for horizon moves. ⟨ψ,R⟩ for a class's target shapes says when to lengthen the horizon (compose) versus stay single-step, which is the "change horizon" lever that (2)/(3) hand to it.
- (d) Move the env-only knobs to tuning rows.

**Expect:**
- the SF_BLEND decision carries an evidence line comparing reach on/off;
- ψ-informed cells are visible in the walk's decision log.

**Must-fail controls:**
- with ψ blending on but every cell uninformed, the order equals pure Thompson byte-for-byte (the code claims this; it is the falsifier);
- if reach(on) < reach(off) over the window, the flag flips off.
