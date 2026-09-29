# Dossier: narrowing-duplicates

**Class key:** `narrowing-duplicates` · **Compiled:** 2026-09-29 · **Inputs:** `classes/narrowing-duplicates.json` (58 attempts, 44 problems, 3 claims from about 40 collector sources), `raw/*.md` (gap-history §K, live-gaps §narrowing-duplicates, git-devvessel-1/2, git-small, git-mid, git-goalhost, memory-1..10, transcripts-1/4, node2-runtime, openspec-3/5/6/7), `classes/_mech_chunks/*.json`. I also took my own read-only measurements on 09-29 between about 04:50 and 05:20Z: the hub gap store (`substrate-live:/workspace/git/super-repo/gaps/gaps.json`, 6,279 rows, mtime 04:51), both nodes' `development-vessel` journals, the dev-vessel clone at HEAD `f451e42` (09-29 01:37), and SurrealDB `activity`.

**One line.** When a unit of work fails or is re-detected, the system **mints a new identity** instead of attaching the new evidence to the existing record. That new identity is a `-narrowed` child, a `recommit-<id>-<class>` child, a fresh `route-edit-<hash>`, a timestamped detector id, an LLM-paraphrased title, a re-authored activity or a new scenario file. Each new id arrives with its penalties reset (failed_attempts 0). It competes with its parent for the single compose slot and re-lands or reverses edits that already landed. Every guard so far has been keyed on one identity form, so the next minting path goes around it. The fix has been attempted about 58 times since 2026-05-23. On 09-29, 713 of the 746 lineage children in the hub store are open, 29 are closed, and new ones were still minted today.

---

## 1. What the class actually is

The records name many surface forms. Underneath them is one mechanism with three parts.

1. **Identity is minted by whoever writes, from whatever string they hold.** `substrateGap_write` accepts any `id`. The id sources are:
   - detectors, which put timestamps into the id (`trace-store-reconcile-2026-09-24T11`, `db_performance_slow_queries_2026-09-18T16` and its `…t16` twin);
   - the edit-intent route (`route-edit-<goal-hash>`, one per goal text);
   - the compose failure path (`recommit-<id>-<failure_class>`, recursively);
   - the chronic-failure path (`<id>-narrowed`);
   - the decomposer (`-step-N`, `gap-mu*`);
   - LLM walks (free-form titles: `discovery-registration-missing-identifier`, `-who-identifier`, `-missing-writer`, …; `poison-*` then `poisson-*`).

   The same thing happens outside the gap store: the ribosome and drafter mint activities (4,010 rows, 1,909 distinct names, measured 09-29), the gap-to-scenario bridge mints files (4,573 plus 1,532 under `/workspace`, 3,364 plus 1,509 in the super-repo clone), and concept writers mint per-execution concepts (76,812 of 88,565 rows are `impulse_signature`).
2. **Dedup, where it exists, runs on the surface syntax of the id, or after filing.** The dedup mechanisms are:
   - `gapClassKey` strips UUIDs, ISO timestamps, dates and 10- or 13-digit epochs (`substrate-gap.ts:313`, verified at HEAD). It does **not** strip 8-hex hashes or lane affixes, so every `route-edit-<hash>`, `-narrowed` and `recommit-` id is its own class.
   - `duplicate_of` is set on 118 rows, all after the fact.
   - `reopen_count` does not track recurrence. The 74 "REOPENED … recurrence evidence" rows carry 0 or None, while the fixture `gap-001` carries 1,614.
3. **Failure does not attach to the problem. It forks a new row.**
   - The narrowing minter writes `failed_attempts: 0` explicitly (`gap-to-feature.ts:3629`). The store's merge-preserve only carries *missing* keys forward (`substrate-gap.ts:1053`), so an accepted re-write resets the child's counter to 0.
   - Every child is written with `status: "open"`.
   - The recommit minter writes `source_gap_id`. The narrowing minter writes `parent_gap_id`. There are two lineage fields, and each guard reads only one of them.

As a result, every guard keyed on one id, one field or one entry point is routed around by the next minter. The guards are per-gap backoff, per-gap cooldown, the depth cap, the class cap, the parent-verdict wait and the in-flight coalesce. Their own commit messages say this (`lineageBackoffState` docstring, gap-to-feature.ts:136-155: "A backoff keyed on a gap id is therefore routed around by minting a new id for the same defect, which is what both recommit and narrowing do by design").

### Sub-forms (with attempts grouped under them)

| # | Sub-form | Representative instances | Status 09-29 |
|---|---|---|---|
| A | **`-narrowed` children** (chronic-failure narrowing) | Origin `5697f70` (substrate, 07-29: cargo-culted, TS2552), reverted `3434f3e`/`db63bef`, then `449949c` (07-29, hand-landed, gave the child the deterministic id `${parentId}-narrowed`). Verbatim clones: 08-29 (clone 6 min after filing), 09-22 memory ("verbatim dup"). `a57dc30` (09-23) added a denylist and "no child without lessons". `3df8ddd` (09-28 23:45, substrate-authored) added the parent-verdict wait. | 316 rows with the plain `-narrowed` suffix (298 open). 81 of 98 children minted after 09-23 still *begin with the parent's text verbatim*, with lessons appended; before, it was 170 of 215. The a57dc30 change did not change what a child contains. |
| B | **`recommit-` chains** (compose-failure re-filing) | `12e7611` (07-27) depth cap `_recommitDepth<2` (81/28/15/7/2 depths; 1,588 compose-reports vs 85 real proposals). Chains up to 13 deep landed in ids. `9b305d2` −0.15 down-weight (09-10, confounded). `6fa5883` lineage cap fa≥6 (09-26). | 411 `recommit-` plus 19 `recommit-recommit-` (415 open). 29 minted 09-28, 4 by 05:00 on 09-29, including 2 `recommit-recommit-` on 09-28 (the grandchild guard leaks). |
| C | **Fresh-id floods from detectors and walks** | c8be5b1/c214385 (06-14, 4,522 in 2 days). 1,724/day on 09-20. 734 capability gaps bulk-closed by hand on 09-28. 209 rows with edit_site `discovery-vessel/src/registry.ts` for one ephemeral-port registrant (refiled 6 more times under paraphrased names). 17 `gap-federation-*` capability gaps for one existing shape. 469 unaccounted-landing gaps in 24 h (folded `617b12a`/`b6f0d14`, 09-25). `4361247` demand-counting filer (09-28). | Filer-by-filer fixes. 146 open children still target `registry.ts`. |
| D | **Duplicate application of one edit** | route-edit-26279b2b block inserted 10× (07-09; the dedupe itself re-inserted by a stale cutover, `9a93e21`). concept-db config lists `concept_write` twice (HEAD lines 193/200; `9d7d715`, `84cad4f`, `1b7fe81`, `9e2c8a8`). ias `interpolateBoundValues` defined **3 times** in `activity-api-provider.ts` (lines 2, 237, 298; verified 09-29). llm-resolver `choices[0]` guarded twice. stateful-ui 5 landings on 7 lines. Double applies `31d07cd`/`afea8de`, stopped by `5a4ef1a`/`4dec1bc` (09-25). | The already-landed skip works for exact goal-hash matches. It misses stacked partial re-implementations. |
| E | **Child reverses its parent** | `39bef90`→`bc99f91` (09-28, 30 min apart, net zero). `b20274c`→`9c86aff`. A narrowed child landed after an operator close: `25150c9` edited a dead helper after `d1ebb66` had closed the gap. | `3df8ddd` wait covers `parent_gap_id` only (see §4) |
| F | **Duplicate dispatch / in-flight** | 45 concurrent copies of one goal (07-21) → `/run-goal` coalesce `055406c`/`7e121c4`. `/resolve` refusal `7f0425d` (09-26). Per-gap in-flight guard `c8cfc38`/`01d085d` (09-23). compose-trigger global flap 17×/h (07-21) → `799bd58` capacity check (09-23, substrate-authored). | Works, but it is implemented as separate guards at three entry points for one class |
| G | **Non-gap duplicate stores** (activities, scenarios, concepts, templates) | coherence-recover hourly demotion `6b21bf4e` (06-20, symptom only). Ribosome `learned-<slug>` UPSERT `fdcd0ec` (06-25, worked). activity-api mint-dedup gate `1b0c693` (07-31, "live-unused": 131 groups / 1,012 dup rows). Scenario classKey prune 7,879→259 (06-14, uncommitted, defeated). Concept janitor (07-04, failed). | 4,010 activity rows / 1,909 names (09-29). 38 gap-closing templates for one tsc error. Scenarios re-bloated. |
| H | **Contradictory redrafts of one gap** | `orphaned-capability-goal_summary`: 13 drafts in 2 days (08-17/18) proposing add, delete and make-real. #106 is byte-identical to #97. | Gap still open. This is the same seam as the 09-22 finding "failure side had no store", which the collector files under `dormant-mechanism`. |

---

## 2. Timeline

**CLAIM** marks a statement that something was fixed, closed or first, followed by what later showed. **CAPABILITY** marks an attempt at the *general* thing: one identity per problem, with failure attached to it.

| Date | Event | Claimed | Later |
|---|---|---|---|
| 05-23..05-24 | Ribosome timestamp-variant ids mint byte-identical activities (one gap-closer authored 11 times) | | Continued to 06-20 |
| 06-05 | `gap_to_scenario_bridge` non-idempotent; 26 gaps reprocessed ~5.3× in 4 min | | `-narrowed.json` scenario twins by 09-07; 664 narrowed scenario files |
| 06-14 | **CAPABILITY** `c8be5b1`/`c214385` dedup substrateGap by volatile-stripped class id (4,522-gap flood) | **CLAIM** "dedup by CLASS fixes the detector flood" | Store reset 07-22 anyway. Floods of 808/1,724/1,403 per day on 09-19..21. 734-row hand bulk close 09-28. New ids are minted per failure or goal (`route-edit-<hash>`, `recommit-…`), and the key does not strip them. |
| 06-14 | **CAPABILITY** scenario-bridge `classKey` plus prune 7,879→259 | | Left uncommitted on the host. Re-bloated to 4,573+1,532 / 3,364+1,509, because new id formats (`route-edit-<hash>-step-N`, `typecheck-…-l2785-ts1005`) evade the key |
| 06-20 | coherence-recover demotes byte-identical activities (1,352→1,252) | partial | Symptom only. "Dedup-on-author" was listed as "recommended next" and never done. |
| 06-25 | Ribosome id `learned-<parent-slug>` with UPSERT (`fdcd0ec`) | worked | Holds for ribosome rows only. Gap-closing re-mints continue (4,010/1,909). |
| 06-30..07-01 | Preserve failed_attempts across re-emission (`2757099`, `63d6a67`); sentinels, TTL, cooldown (`486022e`, `5f17869`, `cefddf5`, `c8a377d`) | worked | Preserves only *missing* keys. A minter that writes `failed_attempts: 0` explicitly still resets it (verified `substrate-gap.ts:1053`). |
| 07-04 | **CAPABILITY** UUID class-dedup plus consumption gate K=3 (`52810c0`, env `GAP_CLASS_OPEN_CAP`) | **CLAIM** "P8/P9: class dedup, gate, and janitor stop duplicate re-accumulation" | Open gaps 672→540, then 09-22 `-narrowed` verbatim dups. The cap is env-gated (a law-1 violation). The concept store is 86.7% `impulse_signature`. |
| 07-09 | route-edit-26279b2b block inserted 10× by repeated composes | operator dedupe | Dedupe re-inserted by a stale cutover, re-deduped in `9a93e21` |
| 07-11 | Baseline: 6 of 7 multi-instance classes reappeared after close (route-edit ×107, recommit-route-edit-semantic_reject ×5) | | |
| 07-18 | Boredom gap-goal dedupe vs activeDispatches (`005091a`, `64f4e0f`, `a22233d`, `ed39ba3`) | worked (50→3 running) | Fresh-id flywheel reappeared 07-22 (174 gaps/2 h) |
| 07-21 | 45 concurrent copies of one goal; `/run-goal` coalesce `055406c`/`7e121c4`. Compose trigger re-armed by summary flap 17×/h on one global `__gapComposeLastTrigger` | worked | A second entry point (`/resolve`) needed its own guard, `7f0425d`, on 09-26 |
| 07-25 | 17 derived children in store | | 104 (08-08), 433 (09-07), 746 (09-29) |
| 07-27 | `12e7611` recommit depth cap `_recommitDepth<2`; stop ingesting compose-reports as proposals | partial | Deep lineages arrested. The source gap is reopened unconditionally. Children close at 4% vs originals 30% (08-10). |
| 07-29 | `5697f70` (substrate) introduces narrowing children with TS2552 → reverted `3434f3e`/`db63bef`. `449949c` hand-landed: `${parentId}-narrowed` id so chronic-failure escalation fires. | | **Origin of the `-narrowed` sub-form.** The child re-landed a reverted 404 dep repair (`9a34712`). |
| 07-29 | `d5b8968` close at failure_lessons ≥ 8 (persistent_compose_failure), substrate-authored | worked | Per gap id. Children inherit the parent's `failure_lessons` at mint, but restart `failed_attempts` at 0, and the parent's later lessons never reach them. |
| 08-02 | `6de8e4f` commits `sanitizeGoalText` (11 doubled "Close substrate gap" prefixes in 3 h; the function existed only in a working tree). `e830210` deletes duplicated EDIT-INTENT ESCALATION blocks. | worked | |
| 08-03 | Stop autocatalytic route-edit nesting at the mint site (`154390b`, `11ba16d`, `2585053`, `1d97038`) | partial | 08-06 audit: titles nested 81 levels, 794 rows at depth ≥3 |
| 08-10 | Memory: children 21% of store, close at 4% | | Same 4% on 09-29 |
| 08-17..18 | 13 contradictory drafts for `orphaned-capability-goal_summary` | | None applied. The gap is still open. |
| 08-26..27 | `duplicate-route-edit-application-gap-level-race`, `gap-failure-penalty-survives-a-corrected-specification-narrowed`; `recommit-gaps-inherit-a-healthy-category-and-outrank-everything` rejected; one defect (hopeless continue) filed 5× in one day | | |
| 08-28..29 | Narrowing livelock reproduced. The recommit guard (`source_gap_id`) and the narrowing guard (`parent_gap_id`) don't see each other, which produced `recommit-recommit-…-narrowed-verify_failed`. A verbatim `-narrowed` clone appeared 6 min after filing. Closing a gap left its child open, so the completed gap looped. | | |
| 08-30 06:27 | `da69c2f`→`6304d64`, `da86fbb` `shouldNarrowForChronicFailure` (refuse to narrow a child) | **CLAIM** "narrowing loop closed; the storm's cause" | 07:59 the same morning: the "churn generator" framing was retracted (62 of 99 were real findings). 09-22: `-narrowed` verbatim dup still listed. |
| 08-31 / 09-01 | **CAPABILITY (partial)** `lineageBackoffState` (`b17eccd`, `b44dcad`; capacity peek `289cf2f`). Backoff summed over the `parent_gap_id ?? source_gap_id` chain. | worked | **The only guard keyed on structural lineage, not an id.** Pick concentration broke. The class then moved to minting *new roots* (route-edit per goal) and to re-emission. |
| 09-01..11 | concept-db advertised-shape list appended by 4 child landings | | HEAD still lists `concept_write` twice (verified 09-29) |
| 09-10 | `9b305d2` −0.15 recommit down-weight | unknown | Recommit share 35.9→19.3%, confounded by a 5.2× provider storm. Recommit lane 0.8% land rate on 26.5% of capacity. |
| 09-11..15 | llm-resolver missing-key gap landed 3× plus a re-report flood (`de3223d`, `8e952f7`, `0f9a160`, `f4bae3c`; operator `789853a`). `choices[0]` fixed twice (`873b597`, `ae07375`). | | Stacked guards are still live |
| 09-12 | Memory: auto-minted children hold 57% of the compose lane | | |
| 09-14 | **CAPABILITY** `gapClassKey` 8-hex strip (`8cdb1a4`→`7f0780e`→`14def70`, substrate-authored): classes 1,830→994 | partial | **Removed the same night by operator commit `ca53600`** ("--no-block the gap-compose nudge"), as collateral of an unrelated fix. Never re-landed. Absent at HEAD (verified). Lane affixes were never stripped. |
| 09-14 | Operator resync of stale children with the corrected parent summary | failed | An in-flight compose clobbered it. A stale child re-implemented landed fix `38e72ae` and produced duplicate symbols. |
| 09-19..22 | Floods: 808/1,724/1,403 per day. Discovery registrant root refiled 6× plus 208 rows. "REOPENED … recurrence evidence" ×74 with reopen_count 0. | | |
| 09-22 | Memory: "`-narrowed` child = verbatim dup"; `gap_to_feature` drops `directed` | | |
| 09-23 | **`a57dc30`** narrowed child drops authorship/closure fields; no child without lessons (v1 denylist too wide, caught by harness; v2). Per-gap in-flight guard `c8cfc38`/`01d085d`. `799bd58` compose nudge capacity check (substrate-authored, BUSY writes 270/h→1/h). | worked (probes A/B) | Took 11 orphaned cutovers and 39 lease deferrals. Content unchanged: 83% of post-09-23 children still start with the parent's text verbatim (measured 09-29). |
| 09-24 | Deterministic refusals propagate to children; `scope_refused` lesson (`72fdb1f`, `2992a23`, `fcbd737`). Parked landings: 47 parks, 25 on human-surface `proxy.ts`, duplicated per route-edit and `-narrowed`. | partial | 4.2b falsifier unexercised. Gap `the-narrowing-minter-spawns-a-child-for-a-gap-whose-last-lesson-is-a-deterministic…` still open. |
| 09-25 | Unaccounted-landing fold into per-repo aggregates (`617b12a`, `b6f0d14`; `cbdb432` rewrite-on-change). Already-landed skip `5a4ef1a`/`4dec1bc`. `remedy-livelock-*` gaps filed (×3 and ×2, themselves duplicates). | fold partial; skip worked | Aggregates: 14 open, none closed by their predicate. The remedy gaps did not stop the livelock: trace-store-reconcile dispatches peaked at 767 (node 1) and 550 (node 2) on 09-28. |
| 09-26 | `6fa5883` recommit lineage cap fa≥6, `61b4812` per-file cooldown | worked | Recommit picks 46%/4% land → 25%. proxy.ts share 15/15 → 3/11. |
| 09-28 01:32 | `4361247` demand-counting capability filer (open only on second distinct demand); 693 single-demand gaps closed | worked | 17 more capability gaps filed after, the latest 09-29 03:53 |
| 09-28 | `39bef90`→`bc99f91`, `b20274c`→`9c86aff`: child reverses parent within 30 min | | |
| 09-28 23:45 | **`3df8ddd`** (substrate-authored, gap route-edit-656f3212) narrowed child waits while parent's landing is unjudged | unknown | Keys on `parent_gap_id` only, so recommit children (429 rows with `source_gap_id`, none with `parent_gap_id`) never wait. Residual fail-open in `chooseFirstActionable`. |
| 09-29 | Live, both nodes: trace-store-reconcile narrowed child re-emitted 178×/24 h (node 1) + 117× (node 2); since 09-27 00:00 node 1 has emitted it 357× and `db_performance_slow_queries_2026-09-18T16-narrowed` 308× | | §4 |

---

## 3. Root causes (merged across sources)

1. **No canonical problem identity.** Ids are minted by each writer from strings: hash of goal text, timestamp, lane affix, LLM paraphrase. Nothing derives identity from *what is wrong where*, for example (edit_site, defect signature) or (shape, capability). (live-gaps §narrowing, memory-2 "no canonical gap signature", openspec-3 "dedup keyed on the surface syntax of id formats instead of a stable class identity from the producer", openspec-7 "LLM walks author gap ids".)
2. **Failure forks instead of enriching.**
   - Recommit, narrowing, step decomposition, route-edit per retry and remedy-livelock gaps each create a new row.
   - Narrowing resets `failed_attempts: 0` by design (code comment at `gap-to-feature.ts` ~3595: "resets failed_attempts to 0 so it re-enters the dispatch queue at normal priority rather than being culled by the landabilityScore filter"). **The escape from the penalty is the stated purpose.**
   - Children copy the parent summary at mint time, so they go stale when the parent is corrected, and they outrank the parent (memory-3, memory-4, memory-7, reports-8).
3. **Two lineage fields.** Narrowing writes `parent_gap_id`, recommit writes `source_gap_id`. Guards read one or the other:
   - `shouldNarrowForChronicFailure` reads both;
   - `lineageBackoffState` reads `parent ?? source`;
   - `3df8ddd` reads `parent_gap_id` only;
   - the recommit anti-grandchild check parses the id string (`/recommit-/g` count);
   - `baseClosed` is checked only when the id has no `recommit-` prefix, from the in-memory `gap.status` (feature-compose.ts:3488).
4. **Guards are per entry point and per identity form.** In-flight dedup exists three times (`/run-goal` coalesce, `/resolve` refusal, compose-slot per-gap guard). The capability filer was demand-gated only on 09-28. Unaccounted-landing detection was folded only on 09-25. Activity mint dedup `1b0c693` exists but is "live-unused". Each fix closes one filer.
5. **Dedup runs after filing, never at write time across all writers** (`duplicate_of` 118 rows; hand bulk closes 06-14, 09-28). `reopen_count` does not track recurrence, so durability (law 7, third element) cannot be measured from state.
6. **Closure does not propagate along lineage.** Closing a parent leaves its children open: 16 narrowed children are open while their parent is closed (measured 09-29). 399 of 430 recommit children point at a still-open source. Children of judge-rejected (`semantic_reject`, 163 of 430) or already-landed parents are treated as fresh work.
7. **No "already applied" check at the edit site, except for exact goal-hash matches.** `5a4ef1a`/`4dec1bc` skip only when the goal-hash commit is the file's latest commit. Stacked partial re-implementations (3× `interpolateBoundValues`, 2× `concept_write`) pass the gate.
8. **Two owners on one store.** Node 2's dev-vessel runs gap-to-feature against the hub store (`GAP_STORE_ENDPOINT=http://host.containers.internal:18090/…` in `compose2-live:/etc/substrate/env`). Neither node has emission idempotence, so both re-emit the same child on every pass (node2-runtime; verified in both journals).

---

## 4. Current verified state (09-29, ~05:00Z)

**Hub store** (`substrate-live`, gaps.json, 6,279 rows). Rule: an id starting `recommit-recommit-` → recommit2+; else starting `recommit-` → recommit; else ending `-narrowed` → narrowed; else starting `route-edit-` → route-edit. The collector's "480 narrowed" counts `-narrowed` anywhere in the id. The totals agree.

| family | rows | open | closed | other |
|---|---|---|---|---|
| `*-narrowed` | 316 | 298 | 17 | 1 superseded |
| `recommit-` | 411 | 396 | 12 | 3 superseded |
| `recommit-recommit-` | 19 | 19 | 0 | |
| **children total** | **746** | **713** | **29 (3.9%)** | |
| `route-edit-*` | 433 | 424 | 8 | 1 reopened |

- **Mint rate of new child rows by `first_detected_at`:**

  | Date | Recommit | Narrowed | recommit-recommit |
  |---|---|---|---|
  | 09-20 | 95 | 85 | – |
  | 09-26 | 49 | 34 | – |
  | 09-27 | 12 | 1 | – |
  | 09-28 | 29 | 3 | 2 |
  | 09-29 (to 05:00) | 4 | – | – |

  The drop in *new narrowed rows* is **not** a drop in narrowing. Node 1's journal shows `emitted narrowed child` 16 / 99 / **317** / **373** on 09-25 / 26 / 27 / 28, against picks of 52 / 216 / 42 / 340. On 09-28 there were also 278 "NOT narrowing" refusals. The emissions go into the *same* deterministic child ids. Since 09-27 00:00 they break down as `trace-store-reconcile-2026-09-24T11` 357, `db_performance_slow_queries_2026-09-18T16` 308, and `failing-test-local-tools-…` 13, plus test fixtures (`falsifier-pair-good`, `falsifier-merge-001`, `falsifier-heal-001`, `falsifier-c2-001`). So the store stopped growing in this family, but the churn moved to re-emission. **The emissions are not persisting.** `substrateGap_write` stamps `updated_at: now` on every accepted write (`substrate-gap.ts:835`), yet `trace-store-reconcile-…-narrowed` has `updated_at` 09-28T15:12 and `db_performance_…-narrowed` 09-27T22:17, while emissions continued hundreds of times after those stamps. The emit log (`gap-to-feature.ts:3652`) fires after `await resolveSubstrateGapWrite(...)` without reading its result, so a refused or early-returned write is logged as "emitted". This is a second instance of the "a channel's own reporting is not evidence" pattern inside this class. The parents carry fa 27 and fa 118, both have no edit_site, and they are re-picked and re-failed every pass. The children sit at fa 0, and `lineageBackoffState` keeps them excluded through the parent's count (node 2: 284 "lineage cap excluded" lines per 24 h). The net effect is a livelock on the parent (re-pick, fail, bump, attempt narrowing) that no longer grows the store.
- **Node 2** (`compose2-live`): 117 narrowed emissions of the trace-store-reconcile child in 24 h, and 284 lineage-cap exclusions. The writes go to the hub. The local `gaps.json` is a 97 KB fossil dated 09-26.
- **Concentration:** open children by edit_site are `discovery-vessel/src/registry.ts` 146, `goal-host-vessel/src/index.ts` 105, `discovery-vessel/src/index.ts` 79, `vessel-mitosis-cutover.ts` 49, `feature-compose.ts` 48, `human-surface-vessel/src/routes/proxy.ts` 42 (an unauthorable vessel).
- **Content:** of the 313 narrowed children whose parent row exists, 251 (80%) begin with the parent's summary text verbatim, with "[narrowed from X]" and lessons appended. 68 have similarity < 0.5 to the parent. That set partly overlaps the 251, because long appended lessons lower the ratio. The remainder are LLM paraphrases. Only 1 is byte-identical, because of the prefix. Split by date, 170/215 before 09-23 and 81/98 after, so a57dc30 changed metadata, not content.
- **Recommit failure-class mix:** semantic_reject 163 · anchor_not_found 85 · verify_failed 61 · syntax_break 45 · typecheck_dangling_reference 34 · compose_execution_failure 27 · wrong_location 12 · park_stale 2. Judge rejections are the largest source of new rows.
- **Guards present at HEAD `f451e42`:**
  - `shouldNarrowForChronicFailure` (reads all three lineage keys);
  - `lineageBackoffState` (parent ?? source, depth 8);
  - the lineage cap: 705 exclusions in 24 h on node 1 and 284 on node 2, so it is actively binding;
  - the a57dc30 `INHERIT_NEVER` denylist and no-lessons refusal;
  - the `3df8ddd` parent-verdict wait (`parent_gap_id` only);
  - the recommit depth cap `<2`, with the `baseClosed` check only for depth-0 ids;
  - `gapClassKey` without the 8-hex strip.
- **Duplicate landings in the code, still present:** 3 definitions of `interpolateBoundValues` in `ias-executor-ts/src/adapters/activity-api-provider.ts` (lines 2, 237, 298); `concept_write` twice in `concept-db/src/config.ts` (193, 200).
- **Child landings since 09-19** (autonomous commits whose `Gap:` line names a `-narrowed`/`recommit-` id): development-vessel 26/355, activity-api 4/43, ias 4/9, goal-host 3/88, stateful-ui 3/5, local-tools 2/9, human-surface 1/6.
- **Activity table** (SurrealDB `activity`): 4,010 rows, 1,909 distinct names (re-measured 09-29).

---

## 5. Why it recurs: the missing shared capability

**Missing: a canonical problem identity, resolved at the write seam.** One record per problem, keyed by a producer-derived signature rather than by the writer's string. Every writer lands on the existing record: detector, walk, narrowing, recommit, decomposer, ribosome, scenario bridge, and either node. Failure is appended to that record as evidence (lesson, attempt, failure class, refusal), not forked into a new row. Lineage is one field, and closure and verdicts propagate along it.

The seam is `substrateGap_write` in `development-vessel/src/resolvers/substrate-gap.ts`, the one door every gap goes through, including node 2 via `GAP_STORE_ENDPOINT`. Analogous doors exist for the other stores: the activity-api mint path (`routes/activities.ts`, the dedup gate `1b0c693`), `gap_to_scenario_bridge`, and concept-db `createConcept`. The capability is the same one each time: *resolve identity before writing; attach, don't fork*.

The narrowing and recommit machinery exists to escape a penalty. That is a legitimate need: a gap whose last attempt failed deserves a *different* attempt. Today it is met by changing the gap's name. In the operating model the user stated, the different attempt is a variant (a different resolver, approach or narrowed scope) *of the same record*, selected by the posterior. Identity does not change. That is also what law 3 asks for: sharpen the existing posterior rather than create an uninformed cell.

### Every prior attempt at that capability, and why it did not hold

| Attempt | Where / when | Why it did not hold |
|---|---|---|
| Class dedup by volatile-stripped id | `c8be5b1`/`c214385`, 06-14 | Identity is still derived from the writer's string. New id grammars (8-hex goal hashes, lane affixes, LLM titles) were outside the strip list. |
| Scenario-bridge `classKey` plus prune | 06-14, uncommitted on host | Never committed; the same surface-syntax approach; two write roots |
| coherence-recover demotion | `6b21bf4e`, 06-20 | After the fact. "Dedup on author" was deferred. |
| Merge-preserve counters on upsert | `2757099`/`63d6a67`, 07-01 | Preserves missing keys only. Minters that explicitly write `failed_attempts: 0` still reset it. |
| UUID class dedup plus consumption gate K=3 | `52810c0`, 07-04 | Same key function. The cap is env-gated (law 1) and counts per class key, which each child escapes. |
| Mint dedup gate (activities) | activity-api `1b0c693`, 07-31 | "live-unused": 131 groups / 1,012 duplicate rows remain; 4,010/1,909 today |
| Deterministic `-narrowed` id | `449949c`, 07-29 | Made the child idempotent as a *row*. Also made it a permanent second identity with a reset counter. Today the minter attempts it 300+ times a day onto the same id, and the log claims success whether or not the write lands. |
| `shouldNarrowForChronicFailure` | `6304d64`/`da86fbb`, 08-30 | Stops narrowing a child. Does not stop narrowing a root repeatedly, or recommit children of roots. |
| `lineageBackoffState` | `b17eccd`/`b44dcad`, 09-01 | The right idea (structural lineage, not the id string), but applied only to *backoff at pick time*. Identity is still forked at write time, so the class moved to new roots and re-emission. |
| 8-hex strip in `gapClassKey` | `14def70`, 09-14 (substrate-authored) | **Removed the same night by `ca53600`** (operator, an unrelated `--no-block` fix), collateral damage. No test pinned it and no gap tracked its absence. Lane affixes were never stripped. |
| a57dc30 denylist plus "no child without lessons" | 09-23 | Fixes what a child *inherits*. The child still exists as a new identity (83% still start with the parent's text verbatim). |
| Demand-counting filer | `4361247`, 09-28 | One filer (capability gaps) gated on the second distinct demand. It is the right pattern, applied to one writer. |
| Unaccounted-landing aggregate fold | `617b12a`/`b6f0d14`, 09-25 | One detector. The aggregate's close predicate has closed nothing yet. |
| `duplicate_of` supersede | ongoing | Post-filing, manual or scanner-driven. 118 rows. |

**The pattern across the table:** each attempt moved the identity decision one step closer to the right place, then stopped at one writer or one form. The one structural attempt (`lineageBackoffState`) sits at *read/pick time*, not *write time*. The one general key function (`gapClassKey`) lost its most important improvement to unrelated collateral within hours, and nothing noticed.

---

## 6. What to keep (mechanisms that work and should become parts of the shared capability)

- `lineageBackoffState` (gap-to-feature.ts:~157). Structural lineage walk. Extend it into the write-time identity resolution rather than replacing it.
- The recommit lineage cap `6fa5883` and per-file cooldown `61b4812`. Actively binding: 705 plus 284 exclusions in 24 h.
- The per-gap in-flight guard `c8cfc38`/`01d085d`, `/run-goal` coalesce `055406c`/`7e121c4`, and `/resolve` refusal `7f0425d`. Collapse the three into one in-flight identity check.
- The already-landed skip `5a4ef1a`/`4dec1bc` (goal-hash is the file's latest commit). Generalise it to "the edit's post-image is already present at the site".
- The demand-counting filer `4361247`: open only on the second distinct demand. This is the admission pattern for all detector writers.
- The unaccounted-landing aggregate fold `617b12a`/`b6f0d14` plus rewrite-on-change `cbdb432`.
- a57dc30's `INHERIT_NEVER` set. The list of fields that must not cross an identity boundary is correct knowledge.
- Merge-preserve on upsert `2757099`. Keep it, and make an explicit reset illegal except through a named reset action.
- Goal-hash failure memory `9e23455`/`cf8fd87` (goal-host). It attaches failure to an identity. The drafter side needs the same (see `dormant-mechanism` / `memory-recall`).
- Ribosome `learned-<slug>` UPSERT `fdcd0ec`. An example of a producer-derived id.
- `d5b8968` terminal disposition at failure_lessons ≥ 8. It needs to count over lineage, not per id.

**Retire, or fold into the capability:** the `-narrowed` child row (replace with a narrowed *approach* on the parent record); `recommit-` child rows (replace with a failure-class lesson plus variant selection on the parent); the `remedy-livelock-*` gap pattern (itself duplicated ×3 and ×2); the env-gated `GAP_CLASS_OPEN_CAP`; coherence-recover as a symptom sweeper once mint-time dedup holds.

---

## 7. Retire condition (measurable, checked continuously)

The class is retired when **all** of the following hold over a rolling 7-day window, measured on the hub store and both nodes' journals, and also after a restart of dev-vessel on both nodes.

1. **Zero new rows whose lineage root already exists.** Count hub-store rows with `first_detected_at` in the window whose id ends `-narrowed`, starts `recommit-` or matches `-step-\d+`, or whose metadata carries `parent_gap_id`/`source_gap_id` pointing at an existing row. Target: **0**. Baseline 09-28: 34 new rows.
2. **Zero narrowing attempts onto an existing child, and no parent livelock.** `journalctl -u development-vessel | grep -c "emitted narrowed child"` on **both** nodes. Target: **0**. Baseline 24 h to 09-29: 178 (node 1) + 117 (node 2). No single gap takes more than 5% of picks in 24 h. The emit log must reflect the write result before this count is trusted.
3. **Failure attaches to the problem.** A deliberately failed fixture compose (positive control: a known-unlandable edit on a scratch file) increments `failed_attempts` and appends a lesson on the **existing** row, and creates no new id. Re-run the control after each change to `substrate-gap.ts`, `gap-to-feature.ts` or `feature-compose.ts`. Target: pass 3/3.
4. **No autonomous landing names a child gap.** Count `Gap:` lines matching `-narrowed|recommit-` in autonomous commits across `/workspace/git/vessels/*`. Target: **0**. Baseline since 09-19: 43 of 529.
5. **No duplicate definition lands.** No new commit adds a second definition of an existing top-level symbol in the same file, or a second copy of an existing array literal entry. The check is a post-land AST duplicate-symbol scan. Existing residue (3× `interpolateBoundValues`, 2× `concept_write`) is removed.
6. **Non-gap stores converge.** `SELECT count() FROM activity` minus distinct names does not grow over the window (baseline 2,101). Scenario file count across both roots does not grow faster than distinct scenario classes.
7. **Recurrence is measurable from state.** A closed problem re-detected lands on its own record with `reopen_count` incremented. Test: reproduce one closed gap's condition, and confirm the same id reopens with the count incremented and no new id appears.

The store's stock (713 open children) is **not** the retire condition. The 09-28 bulk close shows stock can be zeroed by hand while the generators keep running. Inflow and attachment are the condition.

---

## 8. Related classes

- `gap-content`: gaps born without an edit site or falsifier. The trace-store-reconcile and db_performance parents have no `edit_site`, which is why they re-narrow forever.
- `dormant-mechanism` / `memory-recall`: the 09-22 finding "the failure side had no store" and openspec-6's 13 blind redrafts are the drafter-side view of "failure does not attach to the problem". The collector files them under `dormant-mechanism` and in this class. There is no separate failure-memory key.
- `false-verification` / `hollow-landing` / `autonomous-regression`: child landings that reverse their parents; double applies that pass the gate.
- `codebase-bloat-fossils`: duplicate symbols, the scenario store and activity rows left by duplicate mints.
- `spend-envelope-throughput`: children holding 46–57% of the cap=1 compose lane.
- `write-read-mismatch`: two lineage fields, each read by different guards; `reopen_count` written but not meaningful.
- `goal-walk-floor`: walks inventing shape names, which the capability filer turns into one gap per invention (17 `gap-federation-*` for one shape).
- `federation-p2p` / `node-locality`: two nodes owning one store with no emission idempotence.
- `test-residue-live-state`: fixture gaps (`falsifier-*-001`, `gap-001`, `attempt-ledger-canary` ×24) being narrowed and composed on the live lane.
