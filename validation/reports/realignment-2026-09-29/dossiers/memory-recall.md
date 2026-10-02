# Dossier: memory-recall

**Class key:** `memory-recall`
**Date:** 2026-09-29. Live checks ran 04:45–04:55 UTC and were read-only.
**Nodes:** node 1 = `substrate-live` (hub, standalone). Node 2 = `compose2-live` (PROFILE=compute).
**Inputs:**
- `classes/memory-recall.json`: 63 attempts, 38 problems, 17 claims.
- Raw notes `live-pool-memory`, `memory-adjacent`, `concept-db-db`, `vessel-docs-tooling`, `node2-runtime`, `gap-history`, `git-mid`, `git-goalhost` and `memory-1..10`.
- The records for `reports-1..8`.
- The live verification in the "Current verified state" section below.

## One line

The system cannot keep or find what it knows. It has no durable, discovery-addressed, read-back-verified store for the shapes it learns from:
- `memoryNote`
- the gap store
- `compose_lesson` and principle concepts
- failure reasons

Every repair since May fixed one instance on one face, then the next event on the same seam undid it:
- a restart
- a clone rebuild
- a cutover
- an env fork
- a performance change
- a second node

## What this class is (and is not)

The shared capability is **knowledge persistence plus recall that a consumer can prove works**. It has three faces. Every event in the timeline below is one of them:

| Face | What is missing | Instances |
|---|---|---|
| **A. Location** | The store's address comes from env and from the node. It is not routed by shape across nodes. | The 07-25 `WORKSPACE_ROOT` fork (680 notes orphaned). The 08-08 gap-store double path. The refusals corpus split in two. Node 2 serves `memoryNote` from its own 3-note file. Node 2 goal-host skips concept recall (2,694 skips). `CONCEPT_DB_ENDPOINT` is unset on spokes, so recall falls back to loopback. Lessons were written in the wrong auth scope or org. |
| **B. Durability** | Whole-file JSON rewrites run off a read that fails open. There is no append log, no snapshot or restore, and no preservation check on bulk operations. | The memory store was wiped on 09-26 (about 1,236 notes to 0). The gap store has been reborn 5 times (06-14, 07-22, 08-08, 09-09, 09-18). The 09-15 gap-store stale-snapshot write. The operator feedback log was destroyed by `reset --hard` (09-15). In-process state is lost on every cutover. Failure reasons survive only about 5 days. |
| **C. Proof at the consumer** | No positive control recalls a known item through the reader's own path. Changes are validated on latency or on "the write returned 200". | Lexical concept search was dead for 24 days (09-02 to 09-26) while `/health` was green. The same 8 lesson rows were returned for 132 composes. Lessons are never credited (`times_succeeded=0` on all 57). Recall returns the newest N and ignores the topic. `d4171b1`'s retire calls were a silent 400. The session hook emits 0 bytes on `localhost`. |

**Folded in rather than split out:** the "concept-db starvation" thread (9 operator commits, 08-10 to 09-02). Each of those commits fixed latency, and recall still returns nothing useful: 94% dense-empty today. That is face C, not a separate class that is now solved.

**Records in the class file that belong elsewhere:** these are listed under related classes, not in the timeline.
- "Qualification envelope rhythm" (reports-1) → `rhythm/boredom`.
- "Autonomous maintenance cadence" 44a75483 (transcripts-1) → `autonomous-cadence`.
- "Responsibility cycle" c6f4c9ca (reports-4) → `expectation/observer`.
- "Causal intent goalSignature persistence" a8005ba (memory-4) → `trace-schema`. It does share face B, since a SCHEMAFULL table dropped the field.
- "Operator feedback log destroyed by reset --hard" a009e1d9 → `runtime-state-in-git`. It shares face B.

## Timeline (dated; every "fixed" claim with what later showed)

| Date | Event | Claimed | What later showed |
|---|---|---|---|
| 2026-04-28 | concept-db BM25 on SurrealDB 3: `db765b0`, `4325538`, `f4901a6`, `dec74f6`, `2c6488a` (the `@@` operator, split queries, TF fallback) | Lexical search works | It broke again on 08-10, 08-16 and 09-02 (git-mid) |
| 2026-05-23 | `feedback_memory_as_substrate`: `memoryNote` made authoritative, files become a cache. `migrate-memory-to-substrate.ts` handled about 70 notes through the bridge path (`pending_sync`). Hand-written `validation/gaps/*.md` narration records stop 05-24. | Memory lives in the substrate. Closure = `closure-audit --without=operator-memory` green 3 nights | The closure audit was never evidenced. The narration gaps were superseded by the runtime store, which then lost its history (below). |
| 2026-05-24 | `d164bb9`: `memoryNote` and `memoryNote_write` resolvers (dev-vessel), a flat JSON array at `WORKSPACE_ROOT/memory/notes.json` | "Storage primitive" (docs/MEMORY_AS_SUBSTRATE.md:60-72) | The primitive is still the same file design today: load swallows errors to `[]`, one shared `.tmp` path, newest-N recall |
| 2026-05-30 | openspec `doc-ingestion-and-concept-management`: concept vocabulary was operator-minted only, pointer coverage 0% | — | The ingestion templates never got past the LLM step |
| 2026-06-04 | `2bed214` concept relevance fix | "unblocks concept relevance" | `ts_sum` stayed at 22 while concepts went from 1,263 to 1,285: the observer mints new concepts instead of incrementing (validation-other-1) |
| 2026-06-14 | Gap store rebirth #1 (dedup) | — | gap-history |
| 2026-06-15 | `f259d9bd`: 169 notes migrated. SessionStart, PostToolUse and SessionEnd hooks added. | "Claude memory and dev workflow cut over to the substrate" | 09-29: the hook's default `localhost:18090` returns **000** (verified). Only `127.0.0.1` answers. The store holds 59 notes, all from 09-26 or later. |
| 2026-06-16 | openspec `2026-06-16-substrate-self-persistence-and-direct-push` Phase 0: `snapshot-state` / `restore-state` plus an off-host bundle to `AviGopal/substrate-state` | Planned | **Never built**: 0 hits for `snapshot_state` in dev-vessel, and the state repo is empty (openspec-4). Its absence is behind every later gap-store and memory loss. |
| 2026-06-28 | `3ecc34b6`, `0e9e8d06`: docs ingested as concepts | — | 104 concepts landed in org `default` and needed a manual surreal UPDATE. There are two write paths with different org resolution (git-super-1). |
| 2026-07-03 | devbob: 374 `finding_*` / `percolation_*` notes "distilled into concept-db and archived" | "Memory lives in the substrate" | 09-29 live: 1 concept each for `causal_discipline` and `selection_decision_shape`, 4 for `MITOSIS_DIRECT_PUSH`, and 1 for "surgical gate". **No reader verified.** The `_archive_2026_07_03` directory is the only record of June mechanisms. |
| 2026-07-19 | `8d35151b` (substrate-authored): `concept_select_for_prompt ?q=` → `?query=`. `118d341f`: concept priors injected at session start. | "Concept priors injected at session start" | Works only with a `127.0.0.1` override. 94% of concept searches are dense-empty. |
| 2026-07-22 | Gap store rebirth #2 (restart) | — | gap-history |
| **2026-07-25** | **Env fork.** The unit sets `Environment=WORKSPACE_ROOT=/workspace` and `/etc/substrate/env` sets `/workspace/git/super-repo`. EnvironmentFile wins. The vessel switched stores silently, and **680 notes (05-27 to 07-23) have been unread since.** | — | Found 09-22. **Still present 09-29**: the unit shows both settings, and the process env reads `/workspace/git/super-repo` (verified). |
| 2026-07-26 → 08-06 | `9790c2f` (tolerant intake), `7761f47` (an empty write blanked a good note), `5dc8ab8` (read `WORKSPACE_ROOT` at use time; the unit test was rewriting the live store) | Fixed | Narrow fixes. They left the swallow-to-`[]` load and the shared tmp path untouched (memory-note.ts:77-92, unchanged since `dac3c2c` 09-23). |
| 2026-07-30/31 | Teaching channel: 7 `compose_lesson` concepts (`3d6db3ab`), CLAUDE.md amended | Lessons reach the drafter at prompt-build | 08-04: severed, because `CONCEPT_DB_ENDPOINT` was unset → loopback → `catch return ''`. 08-05/08: 100% severed on the spoke (concept-db masked). 08-29: concept-db restarted 132×/day, searches 10–25 s against an 8 s budget. |
| 2026-08-04 | Gap `drafter-architectural-grounding-severed` filed. Fix = follow the `consultProducers` discovery pattern. | — | Landing not recorded (memory-5) |
| 2026-08-07 → 08-17 | goal-host recall ladder over the relay: 13 commits (`53d9080` … `c72ee75`). `2dcfc12` added 3 retries on null. | Miss rate ~40% → ~6% | Success was unmeasurable until `060d2d0`. Recall still depends on the relay, and node 2 now has no relay anchor. |
| 2026-08-08 | Gap store rebirth #3 (path move). substrate-utils finds the `WORKSPACE_ROOT` trap: `/workspace/gaps` vs `/workspace/git/super-repo/gaps`, "DIFFERENT FILES". | — | **This is the same fork the 09-22 memory finding "rediscovered."** The lesson was held only in operator memory, which no runtime reader consults. |
| 2026-08-09/10 | `abead92`, `0b5b279` (`consultPrinciples` filter, shorter query). `6137257` (send the query). `7df39d2` (`@@` is AND → term ladder). | "The same 8 rows for 132 composes: fixed". "A real query matched nothing: fixed". Recall 0/4 → 1/4. | 09-29: **4,159 term relaxations in 6 h**; the ladder is still the dominant path. `a4e353d` (08-16): the ladder had dropped the subject term. validation-other-1: the 08-10 "blocked by mask, then BM25 IDF" diagnosis was **wrong both times**; the real cause was `search::score(0)` without `@0@` plus `SELECT *`. |
| 2026-08-14 → 08-16 | Law-8 concept recall dark on ~80% of walks. `b10c3f2` (autonomous): timeout 4 s → 10 s, recall 0/32 → 1/3. `c9f083e` / `dee1f90`: dense leg bounded, then made lazy. Operator restart of the hub SurrealDB: 607% CPU → 0, recall 40 s → ~1 s. | "Live recall appears for the first time" | Undone by a masked stale orphan, a federation ingress loop and a saturated DB. The cause moved through 6 layers, and each null return conflated slow, absent and refused. |
| 2026-08-29 / 08-30 | `62cbf1e` (scalar filter beside KNN defeats HNSW). `adfe470` (org filter; the dense leg had been dead 5 days; 48 s → 840 ms). `945a667` (half of all concept writes were lost to retryable conflicts). | "Drafter read channel open" | HNSW works, but post-filtering a top-32 over a table that is 87% `impulse_signature` empties small corpora. Today: **dense_true_empty 25,097 / 26,583 = 94.4%**. |
| **2026-09-02** | concept-db `78311ad`, `cb400d6`, `c404069`, `fd645bd`: query-vector cache, record-id hydrate (17,000×), **two-stage FTS**, starvation telemetry | "Principle consult timing out: fixed" | `fd645bd` replaced its placeholder only once (`.replace`), so **lexical search returned nothing for every query for 24 days**. `/health` stayed green: the change was validated on latency, not on results. |
| 2026-09-08 23:49 | `074acb94` | "Teaching channel closed end to end into drafter prompts" | 09-09: the lesson-crediting fix landed inert 4 times (five silent HTTP defects), then `anchor_not_found`. 09-11: recall was keyed on the token `semantic_reject`, which matches everything. |
| 2026-09-09/10 | Gap store rebirth #4: a 97% loss at restart (4,113 → 44). Restored from orphaned `.tmp` files and a backup to 4,187. `d055f18e`: gap-store census tick (a high-water-mark collapse detector; its synthetic positive control fired). | "Gap store restored to 4,187, 0 missing" | **09-18: the whole store was lost again** in a clone rebuild. 256 of 3,548 ids survive, and none of the 264 operator gaps. `d055f18e` watches only gaps.json, **not memory**. |
| 2026-09-11 | `107a75c7`: the JSONL lesson writer stored the install preamble (58% of rows). 3 lessons were inert in the `X-Api-Key` scope and were re-minted under `Authorization: ApiKey`. | Worked | Class-grain lessons are still canned text |
| 2026-09-15 | The gap store lost a session to a stale-snapshot wholesale write (16/16 restored, but land stamps fell from 12+ to 1). The operator feedback log was destroyed by `reset --hard` (`a009e1d9`). | Partial | "The gap describing the race was destroyed by the race" |
| **2026-09-18** | Gap store rebirth #5 (clone rebuild). The live store begins 09-18, and every gap id cited in June/July openspec docs (13 checked) is absent. `8f8e87e7` untracked gaps. | — | Recurrence across the reset is undetectable by the system, because class-key recurrence excludes closed rows (`substrate-gap.ts:460`) |
| 2026-09-18 | Operator-seeded concepts `concept_s4FEj0mG3duk` and `concept_ZJErt8PLLFJE`, to steer the authoring planner | — | They rank #1 and #2 on recall, but `author_composed_capability` never reads concept-db (R4b falsified) |
| **2026-09-22** | Battery flood: 578 of 1,077 notes were probe residue, and newest-N recall displaced the conventions. The operator merged the stores at file level: 1,077 + 680 → 1,788 (`pre-merge.1790118911018.bak`). Retire primitive `b5ed109` failed verification, then `19ae84e` (`retire:true`, falsifier 6/6). Failure memory keyed by goal_hash: goal-host `9e23455`, `cf8fd87`, `4710f6c`, `64ce0ac`. Hook `62559ca6` fetches conventions by type. | "Stores merged". "Retire primitive landed, falsifier 6/6". "91 feedback notes exist". "A loop that stores only successes cannot compound on failure: fixed". | The merge and retire outputs were **wiped 3 days later**. On 09-29 there are **2** feedback notes. Failure-recall is live (10 FAILURE-RECALL lines today on node 1), but task-level trace content stores no error text (0 of 5,742 failed tasks since 09-27), and `execution.failure_mode.reason` survives about 5 days (150k cap). |
| 2026-09-23 | `d4171b1`: the trend checker retires its own probe notes. The operator retired 552 → 1,236 notes (`pre-op-retire.1790140094.bak` 05:08, 1,788 notes). `dac3c2c`: numeric body rejected. | Landed | `d4171b1` posted a bare `{type,note}` body. `/v2/impulses/resolve` answered 400 `pointer.type is required`, a **silent no-op** (hollow write). |
| **2026-09-26 05:11:20–05:12:02 UTC** | **Total wipe of node 1's authoritative store, from about 1,236 notes to 0.** The oldest surviving note is `trendcheck-product-muhxb3tx-0` at 05:12:02. Only 4 of the 59 live ids appear in the 09-23 bak. | — | **Cause UNVERIFIED.** Candidate (a): `loadNotes()` catches everything and returns `[]`, and the next `saveNotes()` persists `[]` plus one note. Candidate (b): every writer, including test runs that inherit `WORKSPACE_ROOT`, shares one `notes.json.tmp`, and a torn write results (4 writes in one second at 05:02:31 on a ~4 MB file). Context: mitosis cutovers of dev-vessel at 04:30, 04:37, 04:48 and 05:04 were each logged as `restart … was LOSSY`. Compose `fc-muhxlif8-xnsvna` ran its env-baseline tests at 05:10:37–41; compose test runs were not scrubbed until `f451e42` (09-29). The container restart came later (07:43), so it is not the cause. The same pool writer left 21 orphaned `standing.json.tmp.*` files, 3 of 4 of them torn. **No gap was filed**: live gaps.json has no memory-wipe or store-shrink id (verified). |
| 2026-09-26 | concept-db `278edae` (Substrate Autonomous): `split(PLACEHOLDER).join(esc)` repairs lexical search | Lexical search works | A positive control passes on 09-29 (`query=anchor_not_found` returns the lesson). There is **still no durable recall positive-control detector**, and the stage-2 `@0@` over record ids is reported as possibly still present (reports-7). |
| 2026-09-26 → 29 | Node 2 goal-host: `recall SKIPPED — discovery named no concept-db row`. Federation reports `no relay anchor — hub mirror skipped`. | — | **2,694 skips since 09-26, 183 of them on 09-29** (verified) |
| 2026-09-28 | `44ab5fd4`: "the system's memory holds nothing before 09-26; recall ignores topic." `50830bec` untracked `state/learning-mode-state.json` and deleted it on pull, which reset learning-mode state (face B again). | — | — |
| **2026-09-29 03:11–03:35** | Need-level dispatch **`879c4bc6`**: "recover the system's own memory", with done-when recall checks | "Discovery worked from a plain-language need" (claimed 02:23Z for a different need) | Target inference found **no shape for "memory"/"recall"** (confidence 0). The walk ran pool leftovers and ended HOLLOW with an unfilled `{{cwd}}` (`9c967329`). The system cannot even address its own memory as a goal. |
| 2026-09-29 | ingest-docs reap refused 606 stale sections (limit 472 of 1,890), including retired CLAUDE.md sections | — | Stale principles keep being retrieved into drafter prompts (face C: retrieval has no retirement) |

## Recurrences

**Recurrence count: 15.** It is the sum of three independent counts of face events:

| Count | Events |
|---|---|
| Memory store reset or split: **5** | 05-23 bridge migration, 07-03 distill and archive, 07-25 env fork, 09-22 flood and merge, 09-26 wipe |
| Gap-store rebirths: **5** | 06-14, 07-22, 08-08, 09-09, 09-18 |
| Concept lexical recall broken: **5** | 04-28, 08-10, 08-16, 09-02 (24 days silent), plus the 08-14..16 dark-recall episode |

The node-2 "recall SKIPPED" line (2,694×) is one continuous event, not 2,694 recurrences. **Every recurrence had the same cause: the seam was left unchanged.**

## Root causes

1. **The store is a flat JSON file whose read fails open.**
   - `loadNotes()` (memory-note.ts:77-84) returns `[]` on *any* error. `saveNotes()` (86-92) rewrites the whole array through a single shared `notes.json.tmp`.
   - As a result, one failed read or one torn concurrent write becomes total loss.
   - The gap store (`gaps.json`) and the pool (`standing.json`) share the pattern.
   - The retire primitive is a hard delete (`filter`) with no tombstone.
2. **The address comes from env and from the node, not from the shape.**
   - `WORKSPACE_ROOT` is set twice for development-vessel: unit `Environment=/workspace` and EnvironmentFile `/workspace/git/super-repo`. EnvironmentFile wins silently.
   - Every node that runs development-vessel serves its own `memoryNote`. Node 2 (compute) serves 3 notes.
   - Nothing federates the shape, so a write on one node is absent on the other. This breaks the user's "absence in one place is not absence" rule.
3. **Recall ignores the topic.**
   - `resolveMemoryNote` filters only by `id` / `note_type` / `title_prefix` / `provenance_tag`, then sorts by `updated_at` and slices to newest N (lines 97-121).
   - With an unbounded writer (the battery), this is "amnesia by displacement."
   - Concept recall has the matching defect: lexical AND semantics, then KNN top-32 post-filtered over a table that is 87% `impulse_signature`, giving 94% dense-empty.
4. **No positive control at the consuming layer.**
   - Changes were accepted on latency (`fd645bd`), on HTTP 200 (`d4171b1`, the mirror hook), or on a component falsifier (`19ae84e` 6/6).
   - None was accepted on "a known item comes back to the reader that uses it, after a restart, from the other node."
   - Lessons are never credited: `times_succeeded=0` on all 57 `compose_lesson` rows, and `concept_usage` is 96% neutral. So the channel cannot learn which lessons help, and it duplicates them (at least 5 `anchor_not_found` variants).
5. **Bulk operations run without a preservation check or snapshot.**
   - Examples: the merge, the retire loop, the clone rebuild, the untrack-and-pull, and the test runs that inherit live paths.
   - The 06-16 snapshot/restore (Phase 0) was never built. A collapse detector exists for gaps only (`d055f18e`).
6. **Goal inference has no entry point for "memory".**
   - Target inference does not map "memory"/"recall" to `memoryNote` (dispatch `879c4bc6`).
   - The system therefore cannot be asked to repair this class. It also never filed the 09-26 wipe as a gap, so it cannot learn the repair.

## Why it recurs

The missing piece is one shared capability at one seam: **a durable, discovery-routed knowledge store whose recall is continuously proven at the consumer**. Every other part of the system learns *through* this seam: lessons, principles, failure reasons, gap history and operator memory. It is a flat file per node with a fail-open read, so each repair has lived in *content* or in a *caller*, and the next event on the seam erases it:
- the merge
- the retire loop
- the restore
- the distillation
- the lesson rows
- the timeout
- the retry ladder

The operating-model failure is exact: the same issue recurring for the same reason. The system did not route around the hole and then encapsulate a capability. The operator patched instances 60+ times across three stores (memoryNote, gaps.json, concept-db) that share one defect, and the only generalisable pieces were never generalised:
- the census detector, gaps only
- the snapshot spec, never built
- the use-time path read, which fixed tests and not the fork

Because the store also forgets its own history (gap rebirths), the system cannot see a recurrence as a recurrence. `substrate-gap.ts:460` excludes closed rows, and pre-09-18 ids are gone.

## Shared capability that would retire the class

**The seam:** the `memoryNote` / `memoryNote_write` resolver pair in development-vessel (`src/resolvers/memory-note.ts`) and its discovery registration, with the same contract applied to the gap store and to concept-db recall. It has three parts.

1. **Durable primitive.**
   - The read fails closed: a parse or IO error returns an error and never an empty array.
   - Writes append per note or per record, with unique tmp paths or a DB table, instead of rewriting the whole file off a stale read.
   - Retirement is a tombstone, not a delete.
   - A high-water mark refuses any write that shrinks the store by more than the retires it carries.
2. **One address across nodes.**
   - The shape is served from the hub's store and resolved from spokes and compute nodes through discovery (the `consultProducers` pattern, 08-04). It is not served by each node's local development-vessel.
   - `WORKSPACE_ROOT` is set once.
3. **A recall positive control, run on a rhythm.**
   - A marker note is written on one node and recalled *by topic* from the other.
   - It must survive a cutover.
   - It uses the same reader as the consumer: goal-host FAILURE-RECALL, feature-compose `consultPrinciples` / compose lessons, and the session hook.
   - A failure files a gap with `edit_site` = memory-note.ts.
   - This extends the existing `d055f18e` census-tick pattern. It is not a new detector family.

Topic recall (a `query` filter over title and body, or routing through concept-db lexical search) is a sub-part of part 3. The check fails today because no topic filter exists.

## Prior attempts at this same capability, and why they did not hold

| Attempt | Face | Why it did not hold |
|---|---|---|
| `d164bb9` (05-24): `memoryNote` resolver as a "storage primitive" | B | The flat file, fail-open load and shared tmp were never hardened. It was declared a primitive and never proven durable. |
| `migrate-memory-to-substrate.ts` + bridge `pending_sync` (05-23), `f259d9bd` 169-note migration (06-15) | A/B | One-shot migrations into a store with no preservation. `memory-sync-tick` / `memory-pending-flush` are unverified, likely fossils. |
| openspec 06-16 Phase 0: `snapshot-state` / `restore-state` | B | **Never built** (0 hits). This is the exact missing capability. |
| 07-03 distillation of 374 findings into concept-db | C | Content was moved to a new channel with no reader verified. Only a handful of concepts are traceable today. |
| Teaching channel via `compose_lesson` (07-30 → 09-11: `3d6db3ab`, `6137257`, `107a75c7`, `074acb94`, the mirror at feature-compose.ts:3280-3315) | A/C | Written before the reader was proven: the endpoint was unset on spokes, the auth scope was wrong, and the preamble was stored. Dedup returns the static row, so nothing is learned per incident. Lessons are never credited (0/57). |
| goal-host relay recall ladder (08-07..08-17, 13 commits incl. `2dcfc12`, `060d2d0`) | A | Retries around a location problem. On node 2 today there is no relay anchor: 2,694 skips. |
| concept-db starvation fixes (9 operator commits 08-10..09-02 + `b10c3f2`, `adfe470`, `945a667`) | C | Each was validated on latency or error rate, never on "the known item comes back". `fd645bd` killed lexical recall for 24 days under green health. Dense is 94% empty today. |
| `5dc8ab8` (08-06): use-time `WORKSPACE_ROOT` | A | Fixed test self-poisoning only. The unit/env double setting remains, and test runs still inherit live paths (scrubbed for compose only in `f451e42`, 09-29). |
| `d055f18e` (09-10): gap-store census tick with a high-water mark | B/C | **The right pattern, applied to one store.** It was never extended to `memoryNote`, so the 09-26 wipe fired nothing. |
| 09-10 gap-store restore (44 → 4,187) | B | Restoring content does not change the primitive. The store was lost again on 09-18. |
| 09-22 file-level merge (1,077 + 680 → 1,788) | A/B | Merged content into the forked, fail-open store. The env fork was left filed and not fixed. Wiped 09-26. |
| `b5ed109` → `19ae84e` retire primitive (09-22, 6/6), 552 retired 09-23 | B | The primitive works (still at memory-note.ts:166-190). It is a hard delete through the same load/save, and its output was wiped with the store. |
| `d4171b1` checker retires its probes (09-23) | C | A hollow write (400, silent). No read-back. |
| Failure memory by goal_hash (`9e23455` et al., 09-22) | B | **Held for walks.** Reasons still live on the capped `execution` row (about 5 days), so the durability face is unchanged. |
| Session-start and mirror hooks (`118d341f`, `62559ca6`, `substrate-memory-mirror.sh`) | A/C | They pin `localhost:18090`, which answers 000 here while `127.0.0.1` answers 200. The mirror logs 877 created, 863 updated and 490 "mirror failed". Nothing reads the store back to check. |
| Need dispatch `879c4bc6` (09-29) | — | The system cannot address the class: target inference has no shape for "memory". |

## Current verified state (2026-09-29 04:45–04:55 UTC)

**Node 1 (`substrate-live`)**
- **Store:** `/workspace/git/super-repo/memory/notes.json` holds **59 notes** (55 reference, 2 project, 2 feedback). The oldest is `trendcheck-product-muhxb3tx-0` at **2026-09-26T05:12:02Z** and the newest was written 09-29T03:34:39Z. The store is still being written; the file mtime is 04:48:20.
- **Backups:**
  - `notes.json.pre-op-retire.1790140094.bak` (09-23 05:08, 4.16 MB): **1,788 notes**, dated 2026-05-27 onward; one has `created_at` = `{{now}}`. By type: reference 1,118, finding 297, project 283, feedback 90. **It is the only complete pre-wipe copy, and nothing reads it.**
  - Also present: `pre-merge` (09-22, 1,077 notes) and `pre-residue-cleanup` (09-23, 1,780).
  - `/workspace/memory/notes.json` (680 notes, mtime 09-07) is still present and still unread.
  - Test residue: `t2-rev-a`, `t2-rev-c`.
- **Resolver code:** `memory-note.ts` last changed in `dac3c2c` (09-23), and the live clone matches. `loadNotes` still does `catch { return []; }`, `saveNotes` still uses the fixed `NOTES_PATH() + ".tmp"`, and recall is still newest-N with no topic filter.
- **Probe:** `memoryNote` with `title_prefix:"memory"` returns **total 0**.
- **Env:** the unit still carries `Environment=WORKSPACE_ROOT=/workspace` beside `EnvironmentFile=/etc/substrate/env`, which holds `WORKSPACE_ROOT="/workspace/git/super-repo"`. The process env is `/workspace/git/super-repo`. The fork is latent, not removed.
- **Gap store:** live `gaps.json` holds **no gap for the 09-26 wipe or for store shrinkage**. The memory ids that do exist concern retire, satisfier failures and envelope bugs.
- **concept-db `/health` (04:49:25Z):** searches 26,583, `dense_true_empty` **25,097 (94.4%)**, `dense_hits` 1,441, event-loop p50 0 ms.
- **Lexical positive control:** `query=anchor_not_found` returns the `compose_lesson` concept `concept_IPqn1Gx60iQx` (times_loaded 2, **times_succeeded 0**). So `278edae` holds for single-term lexical search.
- **goal-host-vessel:** 10 `FAILURE-RECALL` lines on 09-29 (failure memory is live) and 0 `recall SKIPPED`.

**Node 2 (`compose2-live`)**
- **Store:** `memory/notes.json` holds **3 notes** (09-26 07:15 → 12:08), a separate store. No concept-db unit runs.
- **goal-host-vessel:** **2,694 `recall SKIPPED` lines since 09-26, 183 on 09-29.**

**Operator side**
- **Hooks:** `localhost:18090` returns HTTP 000 and `127.0.0.1:18090` returns 200. The session-start hook defaults to `localhost`, so it injects nothing.
- **Mirror log:** `~/.claude/substrate-memory-mirror.log` records 877 created, 863 updated and **490 "mirror failed"** (latest failures 09-24).
- **Cache:** the operator cache holds **750 files**, now 12× the authoritative store.

**Verdict:** open on all three faces. Node 1's durability has not changed since the wipe. Location is forked per node. Consumer proof exists only as one-off manual probes.

## Keep (mechanisms and fossils)

**Mechanisms that work and should be reused, not re-minted**
- The retire primitive, `retire:true` by id (dev-vessel `19ae84e`, memory-note.ts:166-190). Convert it to a tombstone; do not replace it.
- Failure memory keyed by goal_hash (goal-host `9e23455`, `cf8fd87`, `4710f6c`, `64ce0ac`). Live.
- concept-db lexical placeholder repair `278edae`. The positive control passes.
- concept-db write retry on retryable conflict `945a667`.
- concept-db two-stage KNN then filter `adfe470`, and the starvation telemetry `cb400d6` (the only honest recall-quality instrument).
- Gap-store census tick `d055f18e` (`scripts/substrate/gap-store-census-tick.ts` plus its timer). **This is the pattern to extend to memoryNote.**
- The `substrate-memory-mirror.sh` + `mirror-memory-note.ts` hook: its writes land. Fix its endpoint by resolving through discovery, not by pinning `127.0.0.1`.
- `5dc8ab8`: the use-time path read.

**Fossils to keep reachable (never touch in a retention or cleanup pass)**
- node 1 `/workspace/git/super-repo/memory/notes.json.pre-op-retire.1790140094.bak`: 1,788 notes, of which 1,184 are knowledge notes (518 reference, 295 finding, 281 project, 90 feedback).
- node 1 `/workspace/memory/notes.json`: 680 notes, 05-27 → 07-23.
- `pre-merge.1790118911018.bak` and `pre-residue-cleanup.1790138390.bak`.
- devbob `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/_archive_2026_07_03/`: 374 June findings, the only record of June mechanisms.
- The operator cache (750 files).
- All of these should be reachable through the one routed `memoryNote` address, indexed by problem class. Holding them only as files is the situation that failed.

**Likely fossils to retire after checking for callers:** `migrate-memory-to-substrate.ts`, `memory-sync-tick`, `memory-pending-flush`, `memory/orphaned_capabilities_scan_summary.md`, and `t2-rev-*`.

## Retire condition

Checked continuously on a rhythm, from both nodes. All five must hold across at least one mitosis cutover of development-vessel **and** at least one container restart on each node.

1. **Cross-node topic recall.** A marker note written through `memoryNote_write` on node 1 is returned by a *topic* query (not by id and not by newest-N) issued from node 2, and the reverse, within one tick.
   - Today this fails: there is no topic filter, and node 2 has a separate 3-note store.
2. **No unexplained shrink.** The authoritative note count (tombstones included) never decreases between ticks except by the number of `retire` writes in that interval.
   - The same holds for gaps.json.
   - A violation files a gap with `edit_site` = the store's resolver. Extend `d055f18e`.
3. **Fail-closed read.** Corrupting or locking `notes.json` in a scratch instance makes `memoryNote` return an error and makes `memoryNote_write` refuse. The store is never rewritten with fewer notes.
4. **Consumer recall with credit.**
   - A seeded `compose_lesson` is recalled by the feature-compose drafter's own path, and a seeded principle by goal-host concept recall, on both nodes.
   - `recall SKIPPED` = 0 on node 2 over 24 h.
   - At least one `compose_lesson` has `times_succeeded > 0`, credited after a reached compose that loaded it.
5. **The system can address the class.**
   - A plain-language need about memory or recall yields a non-empty target-shape set that includes `memoryNote`, where `879c4bc6` got confidence 0.
   - Any violation of 1–4 appears as a system-filed gap, not an operator-filed one.

**Retire rule:** the class is retired when 1–5 hold continuously for 14 days. It re-opens on the first violation.

## Related classes

- **node-locality:** memory, rhythms, policies and jointBinding all fork per node (face A).
- **stale-whole-rewrite:** `329fc5c` wiped containment. The pool has torn tmps. The gap store carries omitted keys forward (face B).
- **gap-store-history-loss:** the 5 rebirths. It is the same capability applied to gaps.
- **hollow-landing / hollow_write:** `d4171b1`. The battery writes files named `memoryNote*` into the super-repo root.
- **goal-walk-floor:** `879c4bc6` had no target shape for "memory".
- **teaching-channel / lesson-crediting:** `compose_lesson` is never credited and is duplicated.
- **docs-reap:** 606 stale doc sections are still retrievable.
- **runtime-state-in-git:** `a009e1d9`, `8f8e87e7`, and `50830bec` (the learning-mode reset).
- **env-gating:** the `WORKSPACE_ROOT` double setting.
- **test-residue-live-state:** unit tests wrote to the live store before `5dc8ab8`, and compose test runs used live paths before `f451e42`.
- **Misfiled into this class and moved out:** rhythm qualification (reports-1), autonomous cadence (transcripts-1), responsibility cycle (reports-4) and goalSignature persistence (memory-4).
