# Dossier: write-read-mismatch

**Class key:** `write-read-mismatch` · **Compiled:** 2026-09-29 · **Inputs:** `classes/write-read-mismatch.json` (120 attempt records, 64 problem records, 13 claim records, from 40+ collector sources), `raw/*.md`, `classes/_mech_chunks/08.json`, plus my own read-only measurements on `substrate-live` (node 1, hub) and `compose2-live` (node 2, spoke) on 2026-09-29 between 04:28 and 04:50Z.

**One line.** A producer writes a field, key, id form, path, table, envelope or peer that its consumer does not read, or a consumer reads something no producer writes. Every link on the way reports success, so the mechanism does nothing and nobody notices. Since 2026-02 it has been fixed call site by call site, at least 120 times. The general detector was proposed at least six times. One partial version now exists: it runs on one node, it never closes its own gaps, and none of its gaps name an edit site.

---

## 1. What the class actually is

Most records describe the class as "writer and reader disagree". That describes the symptom. The shared mechanism in all 120 attempts has two halves:

1. **Verification happens at the producer.** Every stage checks what it wrote, using its own id, credential, store or table. No stage checks that the *next* stage received it. (memory-3: "Writes are verified with the writer's own id, credential or store, never at the consumer"; git-super-1: "verification is done at the producer".)
2. **Every failure path fails open into something that looks like success:**
   - SurrealDB returns `OK []` for a missing table or view and `NULL` for a phantom column.
   - `surrealDB.query()` ignores statement status. Today activity-api has **2 `queryRaw` call sites and 337 `.query(` call sites** (measured 09-29 at HEAD `39783b0`).
   - Zod and SCHEMAFULL strip undeclared fields without an error.
   - Other silent paths: `catch → []`, optional chaining, `void fetch`, a swallowed 400, `{updated:0}` returned as 200, and `undefined` coerced to 0 or empty.

Since neither half raises an error, a severed joint looks exactly like a quiet one. Each instance was found by an operator reading data by hand, and fixed at the site where it was found.

### Sub-seams, with the 120 attempts grouped under them

| # | Sub-seam | Representative instances (hash, date) | Status on 09-29 |
|---|---|---|---|
| A | **Path-root split** (`WORKSPACE_ROOT=/workspace` versus `/workspace/git/super-repo`). The fork point is `09d9baa6` on 07-25, and the systemd EnvironmentFile takes precedence over unit `Environment=`. | boredom gap read fixed 4× (`0b76b4f` 06-24, `cfe1cd3`/`f12e865` 07-21, `02b0d24` 08-09); gap-scan frozen copy `b1c3e68`/`267900a` 08-09; quiesce marker `a0e6692` 08-11; applier proposals dir (2,257 stranded) 08-11; two memory stores (680 notes unread) 09-22; class-1 guard ENOENT 09-22; scenario store in 3 copies (3,364/4,573/2,275 files); typecheck-scenario-gen → fossil store; interactor-log split 09-22/09-27 | **Live.** See §4. |
| B | **Id, org and key form** (bare vs `activity:` prefix, org strip, exec_ vs sha id, 8 vs 16 hex, `_`→`:`) | `b972fd2` 05-25; `ebfb1075` 05-30; `baca870`/`3fb33b6` 08-22 (half-reverted by autonomous `3e58e73`); compose exec id `be8ff83`/`ed86ab4`/`f611478` (wrong site of 7)/`0c36ead` 09-06; `53d8e77` 09-25 (59/59 reads empty → 406 rows); dispatch-id chain, 13+ fixes 09-24..26 ("seventh place today where the id got lost") | Partly fixed. Each fix covered one of several sites. `embedding_prior_weights` org `default` and vpm_key `_`→`:` are still open (openspec-3). |
| C | **Envelope form** (flat vs `{pointer}`, `body` vs `content`, `body.bodyJson.error`, `{impulse}` vs `{pointer,budget}`) | `a559094` 06-19 … `3ae3fe8`/`9eb4808` 09-24/25; `4e5d37f` 08-06; reconcile template 07-09 (1,931 drain retries); service-error routing `ad61ae6`→`39325b3` 08-16 (inert on arrival); boredom snapshot writer reads top-level `total/items` while the data sits in `body.gaps` (all 1,805 snapshots show `open_gap_count 0`, 09-26..09-29) | Fixed per handler. Discovery has advertised `resolve_request_format` since 07-07 (`7a1ea5d`), and no resolver reads it. |
| D | **Table, view or schema drift** (a frozen AET, a missing `v_activity_score`, NULL≠NONE, Zod/SCHEMAFULL strips) | NULL≠NONE fixed 11× (`ce491e1` … `1f0d70f`, 03-24..09-28); Zod/SCHEMAFULL 6× (`e40bc57` … `62acd51`), for example `48bc174` (15 paths recommended, 0 accepted in 48h); `3322f92`/`91af5a3` 08-22; composition reconciler repointed 3× (07-31, 08-25 `3c1bf965` to a view that disappeared around 09-22, 09-28 `b8671c9`); LIST task_count after mig 118 (05-31, 50 phantom gaps); walk_tier stripped `8351780` 08-04 | `declarationDrift` covers the SCHEMAFULL slice only. `paradigm.ts:606/2205` still read `v_activity_score` (reports-5, 09-28). |
| E | **Verdict and credit delivery** (reach, oracle labels, lessons, posteriors) | `2b4e18b` 08-05, `0ad5dfc` 08-06 (UPDATE matched 0 rows in the decommissioned AET), /reach wiring 08-04 (200 `{updated:0}`), labeler whitelist 400 (41 verdicts lost, `23e707f` 07-31), void fetch lost ~13% until spool `ea78fd7` 08-26, lost-verdict emitter "inert TWICE" `d60abfc`, split ingest write 08-16 and again 09-23 (same WARN text), compose-lesson grading `6f69142` 09-09 (a nonexistent route), lesson hand-off hash disjoint `c72ee75` 08-16 | Lessons still ungraded (§4). |
| F | **Writer with no reader, or reader with no producer** | Policy readers without producers (`f87f52f` … `f34547e`, 08-09..08-28: "I shipped both readers, neither producer"); auto_draft JSONL `3d4aa60` 09-22 (no reader); resolver_tier/impulse_resolutions (mig 067: 0 of 85,720 executions); tool_usage tables at 0 rows; `goalHostBehaviorModel`, `self-development-trend.jsonl`, `landability_predictions.log` (10.5 MB) are write-only; `per_gap_failure_lessons` is read and has zero writers; `hollow_write` landings `0576dbc` (09-15); dev-vessel routes 3 shapes it never registers and registers 6 it has no route for | Only the resolver grain is detected (`orphaned_capability_scan`). The field grain is detected nowhere. |

Related records filed under neighbouring keys: `path-root-ambiguity` (6 fixes in 2 vessels, 07-09..09-25) and `failure-reason-dropped` (37,810 reasonless failed traces by 06-17). Today 26,970 of 46,591 failures in 5 days carry no reason (live-resolvers).

---

## 2. Timeline

Claims of "fixed", "closed" or "first" are marked **CLAIM**, each followed by what later showed. Attempts at the *general* capability are marked **CAPABILITY**.

| Date | Event | Claimed | Later |
|---|---|---|---|
| 02-20..03-07 | Execution-recording chain (`f46f2105`, `5e53feea`, `9cbddfc9`, `aa2ef54b`, `3ab363a4`) | **CLAIM** "learning loop fully operational" | 03-07: "critical execution recording failure after enforcement" |
| 03-24 | First NULL-vs-NONE per-site coercion | | 11 more by 09-28. No boundary helper exists. |
| 04-20 | identity auth traces dropped by 401 (`13a4d79`) | | Re-fixed `ff3194d` 07-31 and `01af799` 08-09 ("third construction site with the same defect") |
| 05-21 | TraceSink strips non-canonical failure_mode (`dc4c4e5`) | | `acfd5c0` 08-22: 98% of failures carried an information-free label. `700ceff` 09-28 is still partial. |
| 05-25 | Thompson `normalizeActivityId` (`b972fd2`) | worked (α 1→2) | The same bare/prefixed class came back 09-25 (`53d8e77`) |
| 05-27 | Neutral-emitter lifecycle bus | worked | tasks.md 0/32 ticked; F-129 found discovery emitting nothing |
| 05-30 | **CAPABILITY** openspec `vessel-resolve-contract-conformance`: a probe that files a gap for every vessel drifting on the `/resolve` contract | | **Never built.** The instances were hand-patched (concept-db `impulses.ts:411`, the ias ResolverServer), which the proposal itself warned against. |
| 05-30 | **CLAIM** "substrateGap → drafter loop closed" (drain-pending-substrate-gaps) | | 1 retained execution. It reads `/workspace/gaps/gaps.json`, not the live store. |
| 05-31 | LIST task_count after migration 118 | worked | The sibling-reader miss had already filed 50 false gaps and a "9367 phantoms" claim that spread into specs |
| 06-04 | **CLAIM** `gap_to_scenario_bridge` (`492dd88`) closes "Break 1" | | Writer and readers use different roots. There are 3 diverging copies, and the 09-29 wasted-cycle gap reports 100% zero-work. |
| 06-17 | **CLAIM** `typecheck-scenario-gen` (`331abda3`) is "sustained concrete fuel for the autonomous funnel" | | 20 typecheck-* gaps from 09-11 to 09-26, including the mitosis-cutover syntax errors, went **only** to the fossil store. The live store received 0 (re-verified 09-29, §4). |
| 06-23 | **CAPABILITY** `orphaned_capability_scan` (find-half, resolver grain) | live | Repair never lands: 346 attempts / 0 lands, sealed by `hopeless()`, 38 open. `goal_summary` has been open for 6 weeks. |
| 07-07 | **CAPABILITY** discovery advertises `resolve_request_format` (`7a1ea5d`) | | No resolver reads it. Envelope fixes continued per handler through 09-25. |
| 07-14 | Composition edge graph freezes (newest edge) | | Stayed frozen through 08-16 while `composition_score` kept scoring against it |
| 07-20 | Credit plumbing: 6 credit paths from one reached execution, 4 broken | partial | 3 of 6 paths flowing; pathway consultation dead |
| 07-25 | **CLAIM** `09d9baa6` "set WORKSPACE_ROOT durably from SUBSTRATE_ROOT (law 11)" | | This commit is **the fork point of sub-seam A.** At least 7 split-read instances are still live on 09-29. |
| 07-25 | `a8005bad` goalSignature stamp reads the wrong column (substrate-authored) | | No-op landing. The false premise came from the operator's goal text. |
| 07-31 / 08-07 | Wrong literal `llm_completion_result` fixed at 4 sites in 3 executors | worked | The dead unwrap branch had already written LLM envelopes into `ribosome-vessel/src/index.ts` and 7 proposals |
| 08-04 | `expected_output_shapes` round-trip hunt | **CLAIM** "VERIFIED LIVE" | Hollow. The real root was an unbound CREATE parameter (`4d0f627`), found after passing through 4 wrong layers. |
| 08-05 | **CAPABILITY** `resolver_schema` published by dev-vessel (`348053d`): a per-shape payload contract | worked | Consumed by one fix (`4e5d37f`, 08-06, which was also the first no-hands detect→land cycle). Never generalised into a check. |
| 08-06 | `0ad5dfc` reach tag landed by the substrate | partial | The AET UPDATE matched 0 rows, `/reach` never credited, and the void fetch lost ~13% |
| 08-10 | **CAPABILITY** unbound-SQL-parameter detector proposed | | Never built |
| 08-11 | **CLAIM** applier proposals path "fixed and verified" | | Proven only by an n=1 dry-run |
| 08-11..08-16 | Composition edge deriver `516fc73`, then `fef173c` (autonomous) | | Wrong table, then 3 missing ASSERT fields. The miss path was a silent return. Edges eventually minted (6,955 rows by 09-29). |
| 08-13 | Operator audit names the class: "producer/consumer key mismatch (write ≠ read)" | | Cited again 09-24..09-29 as "reopened at node level after the 09-26 split" |
| 08-16 | Law-1 remediation ships readers for `walkBudget`/`lessonExecutionPolicy` without producers | | "the reader shipped; the producer did not" |
| 08-16 | **CLAIM** `http_response` fixed (`5be029a`) | worked | 4 more substrate narrowed/recommit cutovers followed. Its drafts remain as fossils. |
| 08-17 | **CAPABILITY** write-key/read-key agreement detector proposed | | Never built. That day's memory-4 note: "Detector still missing: for every declared producer/consumer link, assert the consumer resolves the producer's CURRENT output". |
| 08-17 | Resolver args dropped across 5 layers (`9518d4e`, `f71bb56`) | **CLAIM** closed | The first "closed" was inert (the 5th layer dropped the field). No live trace carrying `resolved_config` has ever been read. |
| 08-21 | **CAPABILITY** `queryRaw` (`676c3f3`) after ~20 cause-claiming commits in one day on the composition upsert (`18c1490..3fdb2b2`) | partial | A general seam that was never made the default. Today it has 2 call sites and `query()` has 337. |
| 08-21 | **CAPABILITY** COMPOSITION_LEARNING_ARCHITECTURE plan item A1 "schema-parity checker" | | Plan only. The law audit found violations of laws 1/2/3/6/11/12. |
| 08-22 | Templates endpoint read the missing `v_activity_score`, so the fallback never ran | partial | On 09-28 `paradigm.ts:606/2205` still read it |
| 08-24 | Selection→outcome join severed at 4 joints | **CLAIM** "resolved" | Retracted to 1 of 3 joints, then 1 of 4. 0/9,614 rows tagged. |
| 08-25 | **CAPABILITY** `joint-liveness-tick.ts` + timer (`daa2632c`); gap `joint-liveness-detector-missing-write-read-class` | | **One hardcoded binding (`decision_outcome`) for 34 days.** It caught none of ~180 Aug–Sep breaks. |
| 08-25 | **CLAIM** `3c1bf965` "repoint 8 KPI/self-dev scripts off the frozen trace table" | | The target view vanished around 09-22. joint-liveness still files frozen-table-class gaps on 09-28/29. |
| 08-29 | **CAPABILITY** openspec `cross-vessel-wiring-repair` | | Dormant. The `cross_vessel_repair` symbol exists nowhere. One operator hand run (`4e0d27a` → `d45aa3d`). |
| 08-31 | **CLAIM** "lesson loop severed for two months" (`ff560216`) | | Wrong by 04:34 the same day: the unauthenticated query read the default tenant. The real mirror fix `945a667` worked (6/6). |
| 09-05 | **CAPABILITY** `declarationDrift` in schema-assert-drift-scan (`8636190`, `e85d3ab`) | live | **The one detector of this class that has held.** It covers only the SCHEMAFULL slice: 254 naive findings, 2 real after the denominator. |
| 09-05 | **CLAIM** gap "substrateGap_write replaces instead of merging": closed | | Overshoot. Omitted keys carry forward, so a cleared `pending_outcome_verification` does not stick (09-23, 09-26). |
| 09-06 | Real `exec_*` id captured in feature-compose trace emission | worked | UNFAVORABLE composes still orphan their rows, so the β signal is lost |
| 09-09 | **CLAIM** (substrate-authored mitosis `6f69142`) "record failure for the lessons that led to this class" | | Posts to `/usage/<id>/fail`, **a route that does not exist**, with a flat body and array parsing, and swallows the errors. Still present on 09-29 (§4). |
| 09-10 | Flat-pointer gap write drops `classification_metadata`: `b907922` (autonomous, 27 min) | worked | `f2aea65` re-applied the identical fix 13 min after close, because a closed gap does not stop an in-flight compose. Duplicate spreads remain at `substrate-gap.ts:728/:732`. |
| 09-15 | **CAPABILITY** `hollow_write` test: "grep the new identifier for READS" | | Lives only in **operator memory** (`reference-a-fix-that-writes-a-field-nothing-reads-is-hollow-2026-09-15.md`). No runtime reader, so it teaches no one but the operator. |
| 09-22 | auto_draft telemetry moved to JSONL (`3d4aa60`) | **CLAIM** worked | The telemetry did leave the gap store. The JSONL has no reader. |
| 09-22 | Two memory stores and the class-1 guard ENOENT, both path-split | | The fix did not grep the scenario call sites (validation-other-3) |
| 09-25 | **CLAIM** (`3f991252`, 01:06Z) "All seven fixes that carry the dispatch id are committed and running" | | An 8th path turned up in run 9 (`ca4f8a5`), another in run 12, gap #61, and bun test shells with no id on 09-27 |
| 09-26 | Node split. Node 2 has `CONCEPT_DB_ENDPOINT` unset, so writers pin `127.0.0.1:8260` while reads route elsewhere. | | Still live (§4) |
| 09-27/28 | **CAPABILITY** `70254535`: joints become pool records (`jointBinding` shape), 5 registered + 1 seed | live on node 1 | Flags 3 severed every 30 min. 6 gaps filed, **0 closed**. `failed`, then **masked**, on node 2. Gap `joint-liveness-detector-checks-nothing` (09-28). |
| 09-28 | Migration 067 resolver-tracking fields empty on 85,720 executions; tool_usage tables at 0 rows | | Both write-only paths are still silent |
| 09-29 | Verified live state | | §4 |

---

## 3. Root causes

1. **No consumer-side check anywhere.** Every write is verified by its writer. Nothing in the system asserts that "the reader of X resolves the writer's current output" (memory-4 08-17, memory-3, reports-1).
2. **Fail-open primitives at the storage and transport boundary.** `query()` ignores statement status. Missing tables and views read as `OK []`. SCHEMAFULL and Zod strip fields silently. `catch` blocks return empty. `void fetch` drops results. No NONE-coercion boundary exists (git-activityapi).
3. **State addressed by path or env var instead of by shape.** `WORKSPACE_ROOT` has three values: unit, env file and code default. Scripts that hardcode `/workspace/...` disagree with scripts that join `WORKSPACE_ROOT`. Writers pin peers (`:8270`, `127.0.0.1:8260`) while readers route through discovery. This breaks law 1 and law 11. The concept-db principle states it: "Reads and writes of one shape must share one address."
4. **Contracts duplicated per side.** The route switch and `config.discovery.shapes` are maintained separately. Scaffold output is nested while the registry reads it flat. `resolver_schema` and `resolve_request_format` are published but have no reader.
5. **Minting a writer (or a reader) is not gated on naming its counterpart.** That produces write-only logs and shapes, and readers with no producers (transcripts-1, reports-4).
6. **Per-call-site repair with no sibling sweep.** 1 of 3 sites (09-07), the wrong site of 7 (`f611478`), a single GET fixed but not LIST (05-31), a "seventh place today" (09-25). Nothing re-checks the seam class after a fix.

## 4. Current verified state (2026-09-29, measured by me)

**Node 1 (`substrate-live`, hub):**
- `joint-liveness.timer` is active. The run at 04:28:32–34Z logged: `bindings=6 (seed 1 + registered 5) checked=6 severed=3`, with `ok: decision_outcome lag=280s`, `ok: discovery-endpoints-healthy`, `ok: operator-revert-learned`, and gaps filed for `ribosome-registered`, `behavioral-verification-input` and `ribosome-extraction`.
- **The detector never closes its own gaps.** `severed-joint-decision_outcome` (open since 09-27T08:53, reopen 0) and `severed-joint-discovery-endpoints-healthy` (open since 09-28T11:25) are still **open** in `/workspace/git/super-repo/gaps/gaps.json`, although that same run reported both joints `ok`. `decision_outcome` itself is healthy: newest row 2026-09-29T04:43:18Z, 1,108 rows since 09-27. `joint-liveness-tick.ts` (282 lines) writes gaps only with `status:"open"` (:74), and has no close path.
- **Detect→repair is itself severed.** All 6 `severed-joint-*` gaps, plus `service-failure-joint-liveness` and `joint-liveness-detector-checks-nothing`, carry `edit_site: null` and `falsifier: none`, so the lane cannot pick them up. The class now applies to its own detector.
- **The path-root split is still live.** `/workspace/gaps/gaps.json` has 830 rows, last written 2026-09-26 14:06, and holds 20 `typecheck-*` gaps. The live store has 6,279 rows (written 09-29 04:49). `/etc/substrate/env` sets `WORKSPACE_ROOT="/workspace/git/super-repo"` and no `GAPS_PATH`, and `typecheck-scenario-gen.ts:27` still defaults to `/workspace/gaps/gaps.json`. `/workspace/memory/notes.json` and `/workspace/pool/standing.json` are frozen at 09-07 04:33, while their super-repo counterparts were written at 09-29 04:48/04:49.
- **Lesson grading is still dead.** `development-vessel` HEAD `f451e42` (09-29) still has `fetch(`${CONCEPT_DB_ENDPOINT}/usage/${concept.id}/fail`)` at `feature-compose.ts:3443`. Across 45 `compose_lesson` concepts: Σtimes_failed=1, Σtimes_succeeded=0, Σtimes_loaded=7,310. This matches the concept-db-db measurement from the same collection. I could not establish whether `times_loaded` itself is frozen, because the rows carry no timestamp fields.
- **Gap `lesson-failure-crediting-posts-to-a-404-address…` is open (since 09-20),** along with a `-narrowed` child and an `anchor_not_found` recommit. It has an edit_site (`feature-compose.ts`) and a class2 falsifier, and 9 days on the fix has not landed.
- **The storage primitive is unchanged.** activity-api HEAD `39783b0` has 2 `queryRaw(` call sites against 337 `.query(` call sites. `query()` at `src/db/surreal.ts:188` is still the default.
- **Migration 067 fields are still empty.** Of 21,334 `execution` rows in the last 24h, 0 have `resolver_tier`, and 0 have `impulse_resolutions` or `resolved_by_vessel_id`.

**Node 2 (`compose2-live`, spoke):**
- `joint-liveness.service`/`.timer` are **failed and masked**. The last run (09-28 05:28:13) logged `fatal: TypeError: Unable to connect … at sql (joint-liveness-tick.ts:53)`, because the detector opens SurrealDB directly and SurrealDB is masked on a spoke. Node 2 has **no jointBinding records** (live-pool-memory). The class detector is therefore absent on half the fleet. The operating model says absence in one place is not absence, and this detector does not route by shape.
- `CONCEPT_DB_ENDPOINT` is absent from `/etc/substrate/env`. In the last 24h, `development-vessel` logged **1,420** `concept-bridge usage record failed` / `mirror failed` lines, for example `Sep 29 04:42:59 [concept-bridge] usage record failed for problem_detection: Unable to connect`. Lesson *reads* from node 2 succeed. This is sub-seam A in its federation form: the writer pins a local port while the reader routes through discovery.

**Held from other collectors (not re-measured by me):** boredomSelectionSnapshot writer shows `open_gap_count 0` in all 1,805 snapshots (live-pool-memory, 09-26..29); ribosome extraction lag is 6.8 days (live-gaps); the `activity`-table learning fields are constant defaults on all 4,010 rows (live-activities); 173 of 323 live resolvers are ever invoked (docs-1).

---

## 5. Why it recurs: the missing shared capability

This is not a lack of fixes. There were at least 120, and most worked locally. The seam where the class is generated has no *standing, consumer-side, fleet-wide check*. A write with no reader, or a read with no writer, cannot fail anywhere. So each instance survives until an operator happens to read the data, and the fix then covers the one site that was read. Sibling sites, new writers and new nodes regenerate the class. The 09-26 node split re-opened it "at node level" within a day (transcripts-4).

**The capability that would retire it:** a *write→read joint registry checked at the consumer*. It extends what already exists (`jointBinding` pool shape + `joint-liveness-tick`, `70254535`) rather than minting anything new:

- **(a)** Each joint is a shaped impulse (`jointBinding`) naming writer, reader, key/id form, freshness bound and **edit_site**. Registering a binding is the gate on minting a new writer or reader.
- **(b)** The check runs by resolving shapes through discovery (`/v2/impulses/resolve`), never through a direct SurrealDB URL, so every node runs it and a spoke checks its own joints and its peers' joints.
- **(c)** The check asserts the *reader's* view: the consumer resolves the producer's current output, not merely that the producer wrote something.
- **(d)** The check **closes its own gap when the joint recovers**, and files every gap with `edit_site` and a class-2 falsifier (the binding's own check), so the lane can act on it.
- **(e)** The storage and transport primitives fail closed: `queryRaw` semantics become the default `query()`, and a NONE-coercion boundary is added. Otherwise the check can itself be fooled by `OK []`.

**The seam it lives at:** the shaped-impulse resolve boundary (`/v2/impulses/resolve` + discovery), which every cross-vessel write and read already crosses, together with `src/db/surreal.ts` `query()` for in-vessel storage.

---

## 6. Every prior attempt at this capability, and why it did not hold

| # | Date | Attempt | Why it did not hold |
|---|---|---|---|
| 1 | 05-30 | openspec `vessel-resolve-contract-conformance` probe | Never built. The instances were hand-patched instead. |
| 2 | 06-23 | `orphaned_capability_scan` (live) | Works at resolver grain only ("invoked by 0 activities"), not field or key grain. It has a detection half and no repair half: 346 attempts / 0 lands, sealed by `hopeless()`, 38 open, 38/46 with impossible ratios (394/389). |
| 3 | 07-07 | discovery `resolve_request_format` (`7a1ea5d`) | Published with no reader. Envelopes kept being fixed per handler through 09-25. |
| 4 | 08-05 | `resolver_schema` contract publication (`348053d`) | Consumed by a single fix (`4e5d37f`). Never turned into a conformance check. |
| 5 | 08-10 | unbound-SQL-parameter detector | Filed, never built |
| 6 | 08-17 | write-key/read-key agreement detector | Filed, never built |
| 7 | 08-21 | `queryRaw` status-checked query (`676c3f3`, later `97ff41d`) | Opt-in rather than the default. 2 sites vs 337 today. |
| 8 | 08-21 | Architecture plan A1 schema-parity checker | Plan only, no code |
| 9 | 08-25 | `joint-liveness-tick` (`daa2632c`) + gap `joint-liveness-detector-missing-write-read-class` | One hardcoded binding for 34 days. It caught none of ~180 Aug–Sep breaks. Its "0 severed" was satisfiable by having no bindings. |
| 10 | 08-29 | openspec `cross-vessel-wiring-repair` | Dormant. No symbol exists. One operator hand run. |
| 11 | 09-05 | `declarationDrift` (`8636190`, `e85d3ab`) | **Held**, but covers only the SurrealDB SCHEMAFULL slice. It does not cover paths, envelopes, ids, verdict delivery or write-only fields. |
| 12 | 09-15 | `hollow_write` "grep the new identifier for READS" | Operator memory only. There is no runtime reader, so the teaching law fails and the drafter and gate never see it. |
| 13 | 09-27/28 | `70254535` pool-registered joints (6 bindings) | The closest thing to the capability that exists. It still falls short: (i) it opens SurrealDB directly, so it is failed and masked on node 2; (ii) it never closes on recovery; (iii) its gaps have no edit_site or falsifier; (iv) 6 bindings cover none of sub-seams A, C or F; (v) registering a binding is not required when minting a writer. |

Related per-class attempts sharing the same flaw include the substrateGap merge-write fix (09-05). It corrected the write boundary by overshooting: omitted keys now carry forward. That is the same pattern at the gap-store seam, where the contract is still stated nowhere.

---

## 7. What to keep

- **Keep and extend** `jointBinding` + `joint-liveness-tick.ts` (`70254535`) as *the* class detector. Make it route by shape, close on recovery, and file edit_site+falsifier.
- **Keep** `declarationDrift` (schema slice, proven), `queryRaw` (make it the default), and `orphaned_capability_scan` (resolver-grain find-half; add the repair half through bindings).
- **Keep** `resolver_schema` and discovery `resolve_request_format` as the contract sources the joint check reads. Do not mint a third contract format.
- **Keep** the verdict spool (`ea78fd7`), failure memory keyed by goal_hash (`64ce0ac`), and satisfier consumption edges (`69fe835`). These are joints that now hold and should be registered as bindings so they stay held.
- **Retire or collapse** the fossil stores: `/workspace/gaps/gaps.json` (830), `/workspace/memory`, `/workspace/pool`, and the `/workspace` scenario copies. Also collapse the hardcoded `/workspace/...` defaults (`typecheck-scenario-gen.ts:27`, boredom `index.ts:2393` workaround, meta-closure-view) into shape-addressed state.

## 8. Retire condition (measurable, checked continuously, hard to game)

The class is retired when **all** of the following hold for 14 consecutive days:

1. **Coverage denominator:** every sub-seam A–F has at least one registered `jointBinding`, and every writer or reader minted in the window registered a binding. The count of bindings is reported next to `severed`, so `severed=0` with 0 bindings reads as a failure.
2. **Both nodes:** the check runs and completes on node 1 **and** node 2 (and on any future node) through shape resolution. `joint-liveness` is active, not masked, on every node, and a spoke checks its peer's joints.
3. **Positive control through the same address:** a deliberately severed test joint (a binding whose writer is paused) is flagged within one tick on each node, and its gap **closes within one tick of repair**. This proves both detection and disposition.
4. **Actionable output:** 100% of `severed-joint-*` gaps carry `edit_site` and a falsifier. Their median detection→close latency is below 48h (law 7).
5. **Durability:** zero new instances of this class filed by *any other* route (operator memory, audits, other detectors) on a joint that no binding covered. A recurrence at an uncovered joint resets the clock and adds a binding, never only a per-site patch.
6. **Primitive:** `query()` in activity-api checks statement status by default (the `queryRaw` share of call sites is irrelevant once the default fails closed).

Until items 2 and 3 hold, the other conditions cannot be evaluated: a detector that cannot run on a spoke and never closes cannot certify that the class is gone.

## 9. Related classes

`path-root-ambiguity`, `failure-reason-dropped`, `dormant-mechanism`, `hollow-landing`, `node-locality`, `false-verification`, `env-gating`, `endpoint-routing`, `selection-learning`, `trace-store-db`, `memory-recall`.
