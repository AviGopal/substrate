# perf-6: concept-db `searchConcepts` — who calls it, why dense returns nothing, how to make it cheap

This was a read-only investigation on 2026-09-25, about 09:31–09:47Z. I restarted nothing, edited nothing and wrote nothing.
- **DB access:** 3 HTTP `/sql` requests with 5 bounded statements (`LIMIT 3–5`, `TIMEOUT 10s`), each ~3 ms, all against `concept` through its FTS index.
- **Logs:** journal windows for concept-db (5 min, captured once to `/tmp/cdb5.log` in the container), m1-trainer, and boredom-vessel (`-g gap-goal-supply`), plus one filtered 3.5-minute cross-unit grep (`-g "concept|8260|prior_seed|sigcl"`).
- **CPU:** from `/proc/<pid>/stat` deltas and `/tmp/cpu.sh`.
- **Source:** runtime code under `/vessels/*/src`. The concept-db runtime file is identical to the git clone `/workspace/git/vessels/concept-db` (HEAD `9e2c8a8`, 09-11).

## TL;DR

- **This is not steady load. It is the `m1-trainer` timer: a burst of about 2.4 min every 15 min (measured).** The 09:27–09:30 measurement landed exactly on one run. `m1-trainer.service` ran from 09:27:48 to 09:30:11. The "dense leg returned nothing" lines per minute were 09:27 → 41, 09:28 → 268, 09:29 → 295, 09:30 → 20, and **0** in 09:31–09:34.
  - The trainer's own log says `with_signature 1013, with_embedding 380`. So **633 signatures missed the local `signature_embedding` table and fell through to a legacy concept-db lookup**, one sequential, unauthenticated, uncached `GET /concepts/search?query=<signature>&source_type=impulse_signature&limit=1` each (`activity-api/scripts/m1-train.ts:349-395`).
  - The counts match: 633 fallbacks against 624 "dense leg returned nothing" lines.
  - Averaged over the 15-min cycle this is ~0.7 searches/s, not 3.5/s. concept-db has served 2,763 searches since its process started 68.5 min earlier (`/health`), which is ≈ 4.5 trainer runs × ~620.
- **Every one of those 633 calls is hollow by construction (measured and code-read).**
  1. **The source type is empty.** `source_type=impulse_signature` has no rows. The trainer's own comment says "zero `impulse_signature` concepts exist" (`m1-train.ts:356`).
  2. **The org never matches.** The request carries no credential, so concept-db uses `orgId='default'` (`routes/concepts.ts:120`). All concepts are `org_id = "organizations:substrate"` (measured on 3 rows).
  3. **The field the caller wants is never returned.** The caller reads `content_embedding`, but the search SQL `OMIT`s it (`concept.ts:~409,~417,~780`) and the REST route strips it unless `embeddings=1` (`routes/concepts.ts:~160`).

  The fallback cannot return an embedding even when a row matches.
- **Lexical search has been dead for every query since `fd645bd` (2026-09-02), for two independent reasons (measured).** So every search, from every caller, pays the dense leg: an ONNX embed, 2 HNSW KNN queries and a hydrate. The "skip dense when lexical matched" optimisation (`concept.ts:541`) has never fired: **0 "lexical ladder matched" lines out of 624+ searches**. Even a single common word (`class`) returns `hits:0`. Details in §2.
- **The second real caller is boredom-vessel.** It sends the identical query `"reach-gate hollow class"`, with `shape=reach_gate_lesson&limit=50`, every ~72 s (`boredom-vessel/src/goal-generation.ts:340`).
  - Each call gets 50 rows from dense and then does **50 passive-usage writes**, 3 statements each. Each write rewrites a ~9.7 KB concept document.
  - The same writes also push those lessons' `relevance = (succ+1)/(loaded+2)` down on every tick. That is a learning-signal side effect, not just load.

## 1. Who calls `searchConcepts`, how often, with what inputs

Entry points in concept-db:
- REST `GET /concepts/search`, `routes/concepts.ts:113-170`
- impulse resolve `routes/impulses.ts:414,503`
- MCP tool `tools/handler.ts:108`
- the internal lifecycle hook `lifecycle/hooks.ts:28`, which runs on concept create and uses the first 100 chars of the summary

The volume in the measured window (09:26:45–09:31:15, 4.5 min) breaks down as follows.

| caller | file:line | inputs | cadence | volume in window | evidence |
|---|---|---|---|---|---|
| **m1-trainer legacy embedding fallback** | `activity-api/scripts/m1-train.ts:374-390`, called per variant row from `:271-274` (sequential `await`) | `query=<context_bucket>` (8-hex v0 buckets and `cluster:sigcl_<16hex>` buckets), `source_type=impulse_signature`, `limit=1`, **no auth header** | systemd timer `OnUnitActiveSec=15min`, ~143 s per run | **~600–620** (≈ 97%) | burst aligns to the second with trainer start/stop; 633 fallbacks = 1013 − 380; relaxed-rung terms are `sigcl_*` (110/117) |
| boredom recipe-candidate supply | `boredom-vessel/src/goal-generation.ts:340` | fixed `query="reach-gate hollow class"`, `shape=reach_gate_lesson`, `limit=50`, ApiKey | every boredom supply tick, measured ~72 s (09:25:05, 26:15, 27:30, 28:44, 29:57, 31:10) | 4–5 | `RRF hybrid merge {denseCount:150}` and 50-row `mcp_rest_search_*` usage batches at the same seconds; the `used:"class"` relaxed rung (4×) |
| goal-host walk recall (`[walk-concepts]`) and development-vessel `[compose-lessons]` (`feature-compose.ts:3322,3567`), others | goal-host-vessel `index.ts`, development-vessel resolvers | 3-term goal-derived queries such as `"variant_performance_metrics v_shape_conditioned_score getcanonicalposteriors"`; `source_type=compose_lesson` | per dispatch / per compose | ~10–15 | `RRF … denseCount:1` and `60` lines, 1–4-row usage batches, `relaxed … used:getcanonicalposteriors hits:0` |
| activity-api hot path: `seedPriorFromConcepts` (`lib/prior-seed.ts:98-104`, uncached) and `lookupEmbeddingForSignature` (`lib/embedding-lookup-cache.ts:106-160`, per-process LRU with negative caching) | `lib/posterior-update.ts:684-687,1212-1215` | `"<templateId> <signature>"`, limit 5; `<signature>`, `source_type=impulse_signature`, limit 1 | per posterior update with a signature | **0 observed** in the quiet 09:31–09:34 window | inferred idle or low right now; see §4 for why it is hollow when it does fire |

**Are the same terms repeated?** Yes.
- Within one trainer run, `cluster:sigcl_c5f5fa00b420cf62` was searched 39 times, `sigcl_200c…` 9 times, and so on. Many templates share one cluster bucket, and the trainer does not dedupe.
- Across runs the trainer re-issues the same ~633 queries in the same order every 15 minutes. All of them are misses that no one caches.
- Boredom issues one byte-identical query ~50 times per hour.

**What the calls are tied to.** It is not per walk step, and not per compose prompt build. The dominant source is a **timer (the trainer loop)**, with a per-signature call inside it. The next source is the **boredom supply tick**. Only a small residue is per-dispatch recall.

**Why `original_terms:1` but `used ≠ original` (inferred).** The trainer's "signature" is `context_bucket`, taken from `SELECT … FROM context_thompson_scores ORDER BY last_updated_at DESC` with no LIMIT (`m1-train.ts:~320`). The most recently updated bucket per template is often the `cluster:` mirror row that `applyClusterPosterior` writes (`posterior-update.ts:729,1297`). `cluster:sigcl_x` is one whitespace token. `distinctiveTerms` splits it on `:`, which gives the rungs `["cluster:sigcl_x", "sigcl_x"]`. Such buckets can never have a `signature_embedding` row, because that table is keyed by leaf signature, so they always fall through. Falsifier: one indexed lookup of `signature_embedding WHERE signature = 'cluster:…'`. I did not run it.

## 2. Why the dense leg "returns nothing", and why it runs at all

**The log message is misleading.** All 624 lines have `timed_out:false` (0 of 624 timed out; `/health`: `dense_budget_misses 2`, `dense_true_empty 2475`, `dense_hits 286`). Dense is not late. It finishes and returns 0 rows. None of the hypotheses in the brief is the cause:
- The model is loaded: `/health` reports `embedding.status: healthy, all-MiniLM-L6-v2, dim 384`.
- Embeddings exist: boredom and walk calls get `denseCount` 60–150.
- There is no dimension mismatch and no threshold.
- The namespace is right: `activity-system/learning_loop`, the shared SurrealDB.

The real causes of the empty result, for the dominant caller:
1. **Wrong org.** The unauthenticated call becomes `org_id='default'`. The dense hydrate filters `org_id = $org_id` (`concept.ts:745,776`), so every KNN candidate is dropped.
2. **The filter matches nothing.** `source_type='impulse_signature'` has no rows, and it is applied after an **unfiltered** global KNN with K = 240 and EF = 480 (`concept.ts:746-752`). Even with the correct org, the 240 nearest neighbours of a hex string would almost never carry that source_type. This is the general weakness of post-filtered KNN when the filter is selective. It applies to every `shape=`/`source_type=` search, including boredom's, which survives only because the `reach_gate_lesson` concepts happen to rank inside the top 240.

**Why dense runs on every call: the lexical leg can never match.** There are two independent defects in the two-stage FTS introduced by `fd645bd`, on 2026-09-02:
- **(a) Only the first placeholder is replaced (code-read, certain).** `contentSql`/`summarySql` each contain `'__FTS_TERM__'` **twice**: once in stage 1 and once in the stage-2 re-match (`concept.ts:~409-423`). Substitution is `String.prototype.replace(FTS_TERM_PLACEHOLDER, esc)` (`concept.ts:498-499`), which replaces the first occurrence only. Stage 2 therefore always re-matches the literal `__FTS_TERM__`. Before `fd645bd` there was one occurrence per statement (verified in `git show fd645bd`).
- **(b) Stage 2's `@0@` does not match over a record-id source, even with the correct term (measured).** On the live store:

  | statement | result |
  |---|---|
  | `SELECT id FROM concept WHERE content @0@ 'class' LIMIT 5` | 5 ids, 2.3 ms |
  | `SELECT id FROM (…those 5…).map(\|$r\| type::thing("concept",$r.id)) WHERE content @0@ '__FTS_TERM__'` | `[]`, as expected given (a) |
  | same, but `WHERE content @0@ 'class'`, the **correct** term | **`[]`** |
  | same 3 ids with `string::contains(string::lowercase(content),'class')` | **true ×3**; `org_id = organizations:substrate` |

  The hydrate works and the rows contain the term, but the match operator in stage 2 returns false once FROM is not the indexed table. **Fixing (a) alone will not revive lexical search.**
- **Consequences:**
  - `lexicalHits` is always 0, so the dense leg always starts (`concept.ts:540-547`).
  - Every query runs the whole ladder first: up to 4 rungs × 2 FTS statements. Stage 1 of each is a real index search, and its ids are then hydrated and thrown away.
  - `"relaxed the term-set to match"` (116/5 min) means only this: the query had more than one distinctive term, so the ladder tried narrower rungs (`search-terms.ts`), and **each rung re-queries** (2 statements per rung) and got `hits:0` every time (117/117 `hits:0`).
  - Every recall since 09-02 has been dense-only. The drafter's and walk's lexical precision on identifiers (`anchor_not_found`, file names), which was the reason the ladder was built, is gone.

## 3. What each call costs

**Measured.**
- **Wall time per trainer call:** 143 s / 633 ≈ **~225 ms**, sequential. The trainer itself used 1.4 s of CPU per run, so it is waiting on concept-db.
- **concept-db CPU:**
  - baseline, outside bursts: ~1% of one core (2.39 CPU-s over ~225 s, 09:35–09:39);
  - during the burst: ~0.75 cores, from the brief, i.e. **~0.2 CPU-s per search**;
  - next-run measurement: see the appendix.
- **SurrealDB statements per hollow trainer search (code-read):**
  - FTS ladder: 2 rungs × 2 statements = 4. Each runs a stage-1 FTS index search (`ORDER BY s DESC LIMIT 240`) plus a stage-2 hydrate and re-match.
  - Dense: 2 HNSW KNN statements (K = 240, EF = 480, `concept.ts:754-755`), plus 1 hydrate of up to 480 record ids that fetches full documents. The hydrate is `SELECT * OMIT embeddings`, but RocksDB still reads the whole ~10–17 KB value.
  - **≈ 7 statements and up to ~480 full-document reads per call.** Over a burst that is about 4,400 statements and up to ~300k document reads from the 42 GB store with 89% blob garbage. Earlier in-code measurements put KNN at 97–128 ms each (`concept.ts:767`); I did not re-measure under current load.
- **ONNX embed:** there is a query-embedding LRU (`services/embedding.ts:47`, capacity **512**). The trainer scans ~630 distinct keys in the same order every run, so a sequential scan larger than the capacity **thrashes the LRU completely across runs**. Only intra-run repeats such as the 39× `sigcl_c5f5…` hit. Most trainer calls pay a full MiniLM inference (inferred).
- **Passive usage per surfaced concept (`services/passive-usage.ts`, `resolvers/usage.ts:47-100,113-145`):**
  - an existence `SELECT`, a `CREATE concept_usage` and an `UPDATE concept SET times_loaded…, relevance…`: **3 statements**;
  - the update rewrites the whole ~9.7 KB concept document (TRACE-STORE-GROWTH d4);
  - `forwardToActivityApi` returns early because passive rows have no `activity_id`, so there is no HTTP call.
  - The trainer's calls return 0 rows, so they cause **no** usage writes.
  - Boredom causes 50 per tick: **150 statements and 50 document rewrites every ~72 s** (≈ 2,500 concept rewrites/h, ≈ 24 MB/h of raw blob churn). 217 "Recorded concept usage" in 4.5 min ≈ 4 boredom ticks × 50 plus ~17 from walk/compose recalls.
- **The trainer's own direct SurrealDB load, outside concept-db (code-read, not measured):**
  - a full scan of `variant_performance_metrics`;
  - `SELECT template_id, context_bucket, last_updated_at FROM context_thompson_scores ORDER BY last_updated_at DESC` with **no LIMIT or WHERE**, a full-table sort every 15 min;
  - 1,013 `signature_embedding WHERE signature=$s LIMIT 1` lookups. I did not check whether they are indexed.

## 4. Do callers use the results?

| caller | acts on result? | evidence |
|---|---|---|
| m1-trainer fallback | **Never.** It reads `concepts[0].content_embedding`, which is OMITted in SQL and stripped by REST, and the filter set is empty anyway. **0 of 633 per run.** | `m1_train_data_collected with_embedding 380`, identical before and after, from the local table only |
| activity-api `lookupEmbeddingForSignature` | **Never**, for the same reason: it reads `content_embedding`. With `EMBEDDING_PRIOR_ENABLED=true` (set in the activity-api env), every cell negative-caches, and the M1 θ-prior path can never engage through this route. | `embedding-lookup-cache.ts:132-150` |
| activity-api `seedPriorFromConcepts` | Rarely meaningful. It weights neighbours by `relevance` and `loaded/succeeded`, but the query is `"<templateId> <signature>"`, so it is a dense neighbour of a hash string. | code-read; 0 calls observed now |
| boredom recipe supply | Yes, it regexes `deterministic_*` classes out of up to 50 rows. It needs only class counts, not 50 full documents, and not a usage write each. | `goal-generation.ts:344-351` |
| goal-host walk recall / compose lessons | Yes. These are the valuable calls (`[walk-concepts] recall SUCCEEDED rows=5`, `[compose-lessons] n=8`), and they are the ones harmed by dead lexical search. | cross-unit log grep |

Result: about **97% of search volume produces nothing any caller can use**. Of the remaining ~3%, most is one repeated boredom query.

## 5. Ranked design

Ranked by effect on load first, then by correctness value.

**1. Stop the trainer's concept-db fallback. Dedupe and skip `cluster:` buckets.**
- **Change:** in `activity-api/scripts/m1-train.ts:371-394`, delete the legacy `/concepts/search` fallback. It cannot succeed, for the three reasons in the TL;DR. Also:
  - dedupe signatures before lookup, since each `sigcl` is fetched up to 39×;
  - resolve `cluster:` buckets to member leaf signatures, or skip them;
  - replace `sigSql` with a bounded query, e.g. `WHERE context_bucket !~ '^cluster:'`, grouped per template, or read `signature_embedding` joined by template, and drop the unbounded `ORDER BY`;
  - optionally batch the 1,013 per-row lookups into one `WHERE signature IN $sigs`.
- **Expected:** −620 of ~624 concept-db searches per 15 min (**~ −97% of volume**), −4,400 SurrealDB statements and up to ~300k document reads per run, and a trainer wall time of about 2.4 min → a few seconds. **No behaviour change**: `with_embedding` is 380 either way.
- **Risk:** very low; the fallback has never returned an embedding.
- **Falsifier:**
  - the next run logs `with_embedding` ≈ 380 (unchanged);
  - concept-db logs **< 10** "dense leg returned nothing" during the run window;
  - `/health` `search.searches` grows by < 10 per 15 min instead of ~620.

**2. Fix the two-stage FTS so lexical search works again (both defects).**
- **Change:** in `concept-db/src/resolvers/concept.ts:405-423,494-501`:
  - carry stage 1's `search::score(0) AS s` through instead of re-matching in stage 2, e.g. `SELECT id, s FROM concept WHERE content @0@ '…' ORDER BY s DESC LIMIT $fetch_limit`, then hydrate `$ids` with the `org_id`/scalar filter and attach `fts_score = s` in TypeScript from the stage-1 map, the same pattern the dense hydrate already uses at `:770-790`;
  - use `replaceAll` (or a function) for the placeholder.

  The tenant filter stays in SQL in the hydrate.
- **Expected:**
  - Lexical hits return, so the existing guard at `:541` skips dense entirely for most real queries. That saves the ONNX embed, 2 KNN and the hydrate: from ~225 ms to ~10–40 ms per call (stage-1 FTS was measured at 2–46 ms, and a record-id hydrate at 14.7 ms, in `concept.ts` comments).
  - Recall quality returns for walk and compose lessons.
- **Risk:**
  - Ranking changes for every consumer, from dense-only back to BM25 or proxy. That is a behaviour change across recall. Treat it as a measured intervention (law 12).
  - BM25 may score all zeros after a restart; the proxy fallback at `:606-640` handles that.
- **Falsifier:**
  - "lexical ladder matched" > 0 within minutes;
  - `/health` `dense_true_empty + dense_hits` stops tracking `searches` 1:1;
  - a control query `query=class` returns rows with `fts_score > 0`;
  - the same boredom query returns the same `deterministic_*` classes as before.

**3. Negative/positive result cache keyed on (org, query, shape, source_type, min_relevance, limit), with a TTL, plus a bigger embed LRU.**
- **Change:** in `concept-db/src/resolvers/concept.ts`, put an in-process LRU in front of `searchConcepts`, invalidated on concept create or update (the lifecycle dispatcher already exists).
  - TTL: 60 s positive, 5–15 min negative.
  - Raise `EMBEDDING_CACHE_CAPACITY` above the working set (e.g. 4096 × 1.5 KB ≈ 6 MB), or make eviction scan-resistant.
- **Expected:**
  - A repeated query is answered in **< 1 ms** with zero DB statements.
  - It kills the 39× `sigcl` repeats even before fix 1 lands, and boredom's identical query (50/h → ≤ 1/min).
  - After fixes 1 and 2 its marginal value is mostly boredom and walk recall.
- **Risk:** stale results for up to the TTL. Also, **a cache hit must still emit passive usage or explicitly not** — decide deliberately, because recording usage on cache hits keeps the current relevance drift.
- **Falsifier:** a cache-hit counter on `/health`; a repeated identical GET returns in < 5 ms; the SurrealDB statement count for it is 0.

**4. Make passive usage cheap and non-distorting.**
- **Change:** in `concept-db/src/services/passive-usage.ts` and `resolvers/usage.ts`:
  - batch one search's rows into one `INSERT INTO concept_usage [...]`;
  - drop the per-row existence `SELECT`, since the ids come from a search that just read them;
  - replace the per-concept `UPDATE concept` with a counter table, or a periodic aggregate from `concept_usage` (TRACE-STORE-GROWTH d4), so the 10–17 KB document with its embeddings is not rewritten;
  - optionally sample, or skip usage when `limit > N`.
- **Expected:** 150 statements and 50 document rewrites per boredom tick → 1–2 statements and 0 rewrites. About −2,500 concept rewrites/h.
- **Risk:** `times_loaded`/`relevance` update lazily. Readers of `relevance` see aggregate lag.
- **Falsifier:** "Recorded concept usage" per search = 1 batch line; blob-write rate attributable to `concept` drops; `concept_usage` row count still grows by `results.length` per search.
- **Separate correctness gap (file it; do not fold it into perf):** neutral "loads" by a regex scan decrement `relevance` of the lessons boredom depends on, every 72 s.

**5. Boredom: cache its fixed query and ask for less.**
- **Change:** in `boredom-vessel/src/goal-generation.ts:338-351`, memoise the class-count result for ~15 min. The lessons change on reach-gate writes, not per tick. Also `limit=50` is used only to count classes, so a server-side count by `shape=reach_gate_lesson` without `query` (the scalar path, no dense and no embed) is enough.
- **Expected:** ~50 searches/h → ~4/h, and 2,500 → ~200 usage rows/h even before fix 4.
- **Risk:** new recipe classes surface up to 15 min later.
- **Falsifier:** `RRF … denseCount:150` lines drop from ~50/h to ≤ 4/h.

**6. Dense leg: skip it when it cannot match, and filter inside the index when it can.**
- **Change:** in `concept.ts:540-547,687-760`:
  - skip dense when a `source_type`/`shape` filter has zero rows. Keep a small per-(org, filter) row-count cache refreshed on create;
  - skip dense when the query is a bare hash or identifier (`^[0-9a-f]{8,}$|^sigcl_|^cluster:`), because a MiniLM embedding of hex is noise;
  - for selective filters, raise K adaptively or use a per-shape vector subset, so post-filtering does not starve the result.
- **Expected:** removes the ONNX embed, 2 KNN and the hydrate for all residual hollow calls: ~225 ms → ~5 ms, returning an honest empty.
- **Risk:** low if the skip is logged as its own reason (`dense_skipped: empty_filter`). The current "returned nothing within its budget" text should also be split into `timed_out` and `true_empty` messages; the counter already distinguishes them.
- **Falsifier:** `dense_true_empty` stops growing while `dense_hits` holds steady.

**7. Hot-path activity-api callers read a field the API never returns.**
- **Change:** in `activity-api/src/lib/embedding-lookup-cache.ts:126-150`, read `signature_embedding` locally, as the trainer's primary path already does, instead of concept-db. Alternatively, fix the contract and request `embeddings=1` plus the real source_type.
- **Expected:** this is a correctness fix for the M1 prior (`EMBEDDING_PRIOR_ENABLED=true` is currently inert through this route), not a load fix. Current volume is ~0.
- **Falsifier:** `prior_seed_applied source: embedding_model` appears in activity-api debug logs.

## What I could not measure

- A live per-call latency split between ONNX embed, KNN and hydrate. There is no per-phase timing in logs (`searchConceptsByDense` "completed" is at debug level), and I did not issue synthetic searches.
- How SurrealDB's ~5.8 cores divide between this burst, the trainer's own unbounded scans, and the activity-api fix-and-measure work, which overlapped.
- Whether `signature_embedding.signature` is indexed, and the exact `cluster:` share of the 633 misses. The falsifier is one indexed lookup, which I did not run.
- Whether `hooks.ts` auto-search on concept create contributes. Creates were rare in the window (1 "Created impulse", 1 dedup hit), so it is negligible now.

## Appendix: next-burst measurement

The next run reproduced the pattern (measured):
- m1-trainer ran 09:42:49 → 09:45:10 (141 s, 1.39 CPU-s) and logged `with_signature 1013, with_embedding 380`, identical to the earlier run.
- concept-db logged "dense leg returned nothing" 34 / 264 / 272 / 54 times in the minutes 09:42–09:45, **624 in total**, which matches the earlier 624.
- "lexical ladder matched" appeared **0** times.
- This is deterministic and repeats every 15 min. Falsifier for fix 1: this 624 drops to under 10.

I did not capture burst CPU. My watcher polled `systemctl is-active`, which reports `activating`, not `active`, for a `Type=oneshot` unit while it runs, so the sampler never started. The per-search CPU figure above (~0.2 CPU-s) therefore comes from the brief's 0.75-core measurement divided by the logged rate. It is not my own sample. Baseline concept-db CPU outside bursts is ~1% of a core (measured).
