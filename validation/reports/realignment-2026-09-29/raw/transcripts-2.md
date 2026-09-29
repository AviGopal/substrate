# transcripts-2 — session transcripts with file mtime 2026-09-08 .. 2026-09-16

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/*.jsonl`, READ-ONLY mining (jq extraction of user + assistant *text* blocks only; tool calls/results not mined).

## 0. Coverage

- 14 files selected by mtime 09-08..09-16 (plus one 368-byte stub `7e005718`, empty):
  | file | size | span (UTC, transcript timestamps) | main theme |
  |---|---|---|---|
  | 0b1032b5 | 64 MB | 08-29 01:14 → 09-09 04:43 | long operator loop: measurement, closure lane, credit/reach, gates, anchors, signature freeze |
  | 9c8dceae | 27 MB | 08-28 05:53 → 08-30 05:36 | (fork of the same session) gap filing + "observe closure"; refuter quorum; test baselines |
  | 35a31aa4 | 8.6 MB | 08-28 → 08-31 | (fork) same content as 0b1032b5/9c8dceae start |
  | af312d72 | 17.6 MB | 09-04 05:09 → 09-05 23:07 | architecture Q&A, audit of claims, retractions (50% first-pass error), "turns to ash" |
  | 074acb94 | 32 MB | 09-05 10:13 → 09-11 11:51 | "Is it compounding now?" loop (~120 stop-hook repeats), verdict→belief, conservation auditors, region RCT, anchor inversion |
  | 805b4ec0 | 6.3 MB | 09-06 06:21 → 09-09 08:51 | human surface vessel, legibility, personas |
  | 2c00ea45 | 3.8 MB | 09-09 06:30 → 09-09 21:44 | external-style investigation of repo; selftest/probe harness; host reboot credential incident |
  | bcc44633 | 18.4 MB | 09-10 04:46 → 09-12 01:00 | gates, drift watchdog, reach instrument repair, API key outage, LLM 429 starvation, stuck rebase |
  | 2a87a32c | 2.8 MB | 09-11 15:23 → 09-12 00:06 | "integration milestone" arithmetic repair; qualification envelope N=2 |
  | 627b573e | 70 KB | 09-11 11:51 | "what is this system / is remote in sync" |
  | 13801190 | 0.9 MB | 09-03 00:39 → 09-04 04:23 | syzygy.host key, federation, docs/config reading |
  | 28f8c594 | 2.5 MB | 09-15 23:03 → 09-16 01:39 | wiring proof (green-vs-miswired), launch contract (fork of 15dbb9e0) |
  | 15dbb9e0 | 3.5 MB | 09-15 23:03 → 09-16 10:22 | container lifecycle, spoke join, six fixes, compose lane dead (gemini 400s) |
  | 8183a698 | 3.0 MB | 09-16 05:09 → 09-16 10:01 | autonomy expectation, in-flight recovery loop dormant, docs-timelessness corrections |
- IMPORTANT: selection is by file mtime, but content spans **2026-08-28 → 2026-09-16** — roughly half the evidence predates the nominal window. Every entry below is dated by transcript timestamp (UTC), not mtime. Round-1 transcript shards selected by mtime < 09-08 will NOT have seen the 08-28..09-07 content of these files.
- `35a31aa4`, `9c8dceae`, `0b1032b5` (and `af312d72`/`074acb94`, `28f8c594`/`15dbb9e0`) are forked/resumed continuations sharing history — identical lines at identical timestamps. Deduped by content.
- Volume mined: ~11,400 assistant text lines, 2,138 user messages (≈1,000 of which are Stop-hook re-injections of three goals), 380 unique user utterances; 817 retraction-context hits (477 unique after dedupe), 769 positive-claim hits.
- Not done: no tool-result mining, no cross-check against live DB (the claims' "later" evidence is from within these transcripts plus the operator MEMORY.md index given in context).

## 1. The recurring pattern in one paragraph

Across 19 days the same five-step cycle repeats: (1) a number or mechanism is read from an instrument; (2) it is declared (often in bold, often as "first time in history"); (3) within hours a control shows the instrument measured itself (null≠zero, absent key, `CONTAINS` on strings, `datetime > 'string'`, UTC vs PDT, counting log lines, mid-flight reads, wrong store/route/tree); (4) the retraction is written in prose, sometimes in state; (5) the underlying seam is re-found days later under a different name. The model counted its own retractions: 4 on 08-28, "six retractions" 08-31, "five mechanisms, all refuted" 09-02, "13 commits: 11 did what they claimed" 09-03, "~15% false-positive", then "50% first-pass error (8 of 16)" 09-05, "ten claims audited, eight dissolved" 09-08, "nine intermediate readings retracted" 09-10. The user named the pattern twice: 08-31 06:14 *"It always seems like there is another problem of the same class just one stage earlier."* and 09-06 07:36 *"It seems every defect is the same one, one level up. is this true?"*

## 2. Claims ledger (claimed_at → claim → what later showed)

### 2.1 The verdict→belief (grading/credit) chain — declared closed five times
| claimed_at | claim | later |
|---|---|---|
| 08-29 01:40 | (retraction of) "reach ~1%" | 1624/1922 graded rows were `auth_resolve_v1` telemetry; denominator error |
| 09-02 05:26 | "credit is asymmetric; extracted pathways earn β never α" (filed as gap) | "fourth and final retraction" same day — goal-paths.ts increments α/β symmetrically; five proposed mechanisms all refuted by reading source |
| 09-02 07:41 | "all 100 traces read reached: None" | Python reporting an absent key, not a null |
| 09-02 23:28 | rule "the column is the verdict of record" (test asserted it) | reversed same day by measurement; `86aebdf` shipped trusting tag, reverted as `5a374df`, wrong in both directions |
| 09-04 04:55 | "Thompson credit comes from execution.success not reached" | wrong: `posterior-update.ts` uses `effectiveSuccess = reachVerdict==='reached'` |
| 09-06 09:17 / 10:43 | "first-ever verdict on a real compose row (`exec_1788691325139_5doho0myuxy`, reached=True)… graded exec_* 0 in all history → 2" | 09-06 12:04 retracted: `feature_compose` had emitted graded rows continuously since 08-29 ("step 1 was never broken") |
| 09-06 11:16 | "posterior moved one second after first real verdict — full circuit observed end-to-end for the first time" | 09-07 00:07 "The scorecard just falsified my own 'the loop closes' claim: posterior frozen while false-verdicts rise"; closed *once* |
| 09-07 10:02 | "Phase 0 — Verdict→belief ✅ CLOSED AND PROVEN" (root cause: `/reach` wrote verdict tag before checking whether to grade) — β +14, believed rate 73.6%→59.2% over 13 readings | 09-07 20:36 α finally moved via `adda1ef` (delivery); BUT 09-08 22:58 "the posterior did not move. Still α=6.918/β=2.973" |
| 09-08 22:58 | "the chain composes end to end" (6fdcd71 emitter landed unaided on 4th attempt) | same message: posterior frozen; 09-09 02:17 root cause = substrate-authored `3d648ad` (goal-host, landed 09-08 10:42:00, deployed 10:42:33) switched satisfier trace id namespace → rich trace collides with thin row → duplicate mapped to idempotent 200 → signature-bearing record discarded; "the execution that landed the regression was the last one it ever credited, 1.6 s before the freeze". Restore filed as gap; restoration outcome not observed in window |
| 09-08 23:47 | "Instrumentation: compounding, confirmed (credit applied 0.6%→71%; self-model 57.7→1.55 pts)" | stands within window, but capability flat: reach 4.4% over 72 readings, α +5.91 vs β +364 |
| 09-10 08:47 | posteriors uniformly pessimistic: `satisfier:webSearchResult` actual 127/128 (99.2%) vs posterior 21% | open at window end (decay write suspected, 09-11 03:31 POST theory retracted) |
| 09-10 20:16–20:19 | "reach instrument working and verified for the first time… 7.9% overall, 2.1% edit goals — for the first time it's real" | preceding days' figures declared void (fleet 401-dead + labeler discarding successes); 09-11 reach 5.0%/2.4% |

Key: `selection-learning`, `write-read-mismatch`, `false-verification`, `autonomous-regression`.

### 2.2 Gap closure lane — "measured closes exist" vs "they're stamps"
| claimed_at | claim | later |
|---|---|---|
| 08-28 11:41 | "fleet closes nothing" → corrected "the fleet does close gaps" (closed_total 860→867) | 08-28 22:55: closure is **69% TTL expiry, 1.9% repair**, with a provable false close |
| 08-29 00:23 | "a fix landed outside the picker lane can never close" | wrong: closed via `condition_verified_fixed` with no sha |
| 08-31 07:40 | (retracts) "10 closures in 24h were landed_verified" | `landed_verified` all-time: **0 of 1,025 closures** (one assignment site, never survived) |
| 09-02 10:38 | "1,037 closed gaps = closing activity" | 703 (67.8%) `expired_not_redetected` |
| 09-05 | (expiry fix) | missing_capability gaps: 82% expired before any compose; "the substrate was deleting unexamined findings and feeding the deletion back into the model" |
| 09-07 17:57 | "unaided close lane works — 50 landed_verified all-time; retracts note that it never produced one"; 764/778 open gaps (98.2%) carry no measurable predicate | 09-09 01:37 "50 (78.1%) contain 'ancestor' → git-provenance stamps" → 01:39 **retracted the retraction** (resolution string is a hardcoded literal; code says provenance-only closes no longer happen) → 02:17 `close_basis` field landed (substrate-authored) so measured-vs-trusted becomes queryable; first post-fix close carried `close_basis='absent'` |
| 09-07 18:39 | "`absent:1, closed:1` — first time off absent:0 all session" | single event |
| 09-08 21:22 | daily close rate 70–85% | "high but hollow": `closed_reason: None` 1,744 (close-on-land provenance), expiry 923, `landed_verified` only 60 total (6–10/day) |
| 09-08 22:54 | close-on-land 1–6/day → 81–135/day, "~20× genuine self-development output" | 09-08 23:45 retracted: `auto_draft` bookkeeping population; close latency 177h→2h likewise |
| 09-09 01:36 | a gap closed `landed_verified` via "verified ancestor of clone HEAD" without evaluating the armed class1 predicate | → close_basis fix; MEMORY 09-15 later: "class1 means VERIFIABLE not WILL CLOSE" (recurrence) |

Key: `false-verification`, `gap-content`, `hollow-landing`.

### 2.3 Autonomy criterion — "first autonomous landing" declared repeatedly
| claimed_at | claim | later |
|---|---|---|
| 08-28 09:11 | "8 REFUSE, 0 APPLY — nothing can land" | a commit did land (operator identity) |
| 08-30 02:33 | "No operator hands on the patch… CLAUDE.md's hard autonomy criterion; suite 1895/0" | — |
| 08-31 06:30 | "zero autonomous landings" | timezone artifact (PDT vs UTC `--since`); 4 autonomous commits in 24h incl. `569881d` |
| 09-06 05:04 | autonomous landings happening (`9b2473a` dev-vessel, `3868bc6` activity-api) | — |
| 09-07 18:07 | "substrate-authored commit on origin/dev, no operator hands — met end to end" | — |
| 09-07 23:52 | "loop ran end to end, unassisted, in 13 minutes" (`6de3011`, clone-HEAD gap) | — |
| 09-08 22:58 | `6fdcd71` emitter landed unaided on 4th attempt ("autonomy criterion firing") | same day `3d648ad` (autonomous) froze the signature (2.1) |
| 09-10 00:14 (bcc44633) | "0 landings" | false zero: counted in a local tree the substrate never writes to; container pushes to origin |
| 09-16 09:55 | `61ae51b` llm-resolver keyless fix, "hard autonomy criterion observed" | same session: fix 3 had to be operator-landed (`0b7db2d`), `d42910bc` substrate-authored/operator-committed (split attribution) |

Recurrence: "first autonomous landing" is re-announced on 08-30, 09-06, 09-07, 09-08, 09-16; each is real but none is durable evidence of compounding — the same windows contain autonomous regressions (`f0cfb91`, `3d648ad`, `6fcdf40`, `c4ec7367`, relevance-sink double-apply).

### 2.4 Anchors / drafter quality
| claimed_at | claim | later |
|---|---|---|
| 08-31 05:54 | `ee6312c` prompt steering | net-negative, reverted — consumer reads only `fix.file`+`fix.old_string` |
| 09-01 07:12 | "localization pinned at line 3" | refuted by measurement (regions 43,68,…,2252) |
| 09-06 20:09 | "root cause of every drafting failure today" — `feature-compose.ts:3974` spec refiner overwrote verbatim spec | 09-07 08:34 refinement 15→0 (fixed, measured) |
| 09-07 23:57 | "Instruction fidelity effectively done — three consecutive byte-correct landings" | 09-09 08:07: substrate-authored `f0cfb91` (09-07 10:42) had **inverted the anchor-repair guard** (`if (r.ok && …)`) + `/* your code here */` stub; anchor-failure 12%→19.0% (09-07)→34.4% (09-08); fixed `bac7d00`; 09-09 21:58 powered: 16.8% (n=184, p<1e-6) — WORKED |
| 09-08 21:41 "suggestive" / 22:10 | verified-unique region arming (155 armed regions) raises landing, observational p=0.002 | RCT 09-09 04:36 treatment 5/73 = 6.8% vs control 5/72 = 6.9%, p=1.0 — refuted; 50 mislocalising anchors retracted to `""` |
| 09-09 11:05 | truncation hypothesis (408 KB feature-compose.ts) | refuted: 5/7 refusals on 42 KB seed/index.ts; model paraphrases the located statement |
| 09-09 12:46 | five-fix chain | no measurable reduction in apply failures |
| 09-10 06:11 | refused compose's partial edit picked up by next compose's cutover and committed | explains junk awaits in `6fcdf40` (autonomous, 09-07) |
| 09-10 01:29 | second attempt on same gap failed verify and its rollback **reverted the successful change** | recurs in MEMORY 09-24 ("landed-edit retry double-applied", "silent revert 6ab8271 undid a0ff3d3") |
| 09-11 13:13 | `groundedUniqueAnchor()` window emitter | "necessary; uniqueness must hold for planner's likely choice" |

Key: `drafter-quality`, `autonomous-regression`, `hollow-landing`.

### 2.5 Operator measurement errors (the instrument, not the system)
Each is a claim declared and then retracted within the window; the class recurs daily.
- 08-28 09:35 "oracle corpus is write-only" — reader exists at goal-host index.ts ~15113 (searched table name, read goes via shape).
- 08-29 08:56 "disproved capacity refusal" — 45/80 composes BUSY (searched wrong emitter).
- 08-29 16:15 "zero learned executions" — `CONTAINS` is an array op; `learned*` arms had 720.
- 08-30 07:59 "88% monopoly" (pushed in commit `86cdbf2` message + code comment) — each pick line has gap_id twice (pick + runner_up); corrected `e70b432`. Recurs 09-07 19:07 ("19 picks all the same gap" = runner_up field) and 09-08 23:01 ("15 of 35 picks one gap" → really max 2).
- 08-30 07:48 "spawn storm, kill processes" — designed cost of verify (tsc + 1,921 tests on 14 CPUs).
- 08-31 00:36 "corpus 3→4" — `grep -c '"content"'` counted wrapper.
- 08-31 19:13 "events inflate 2.8×" — each event is one compose.
- 09-03 04:53 "0 of 196 landed commits in goal_execution_paths" — join invalid (negative control of random prefixes).
- 09-03 06:46 50-row default `limit` sorted worst-first biased slice.
- 09-03 07:44 load-gating result read mid-dispatch.
- 09-05 09:41 `rg -r '$1'` wrote ripgrep help into the data file → fabricated "124 declared / 70 missing".
- 09-05 10:42 `/dispatch/<id>` is not a route; table `goal_verification_labels` (plural); field `body` not `content` — each returned empty, not error.
- 09-05 20:19 "system files no gaps of its own / notices nothing" (said for hours) — 76 `substrate_detected` gaps in 24h; misread `source` field.
- 09-06 00:18 & 00:54 watcher "AUTONOMOUS BASELINE STAMPED" was own probe row; "CHAIN CLOSED" false because SurrealDB `NONE` ≠ `NULL`.
- 09-06 16:06 split at commit time not process restart time.
- 09-07 02:37 grep failed on non-UTF8 bytes → false "zero occurrences".
- 09-07 22:35 "verified landing" of `/conservation-audit` — route registered twice (Hono serves first; 200 can't distinguish).
- 09-08 22:50 `datetime > 'string'` matches the whole table (41,974 = entire table).
- 09-09 01:15 "75.7% applied but not reached" — 1,378 ungraded rows counted as failures (`reached` present on 212/1,590).
- 09-09 07:58 "cap-1 lane" — two guards conflated (`MAX_CONCURRENT_COMPOSES = 4`).
- 09-10 10:35 tag hypothesis "refuted" by a control using the wrong envelope; later confirmed right.
- 09-11 12:08 "~65% availability" from one cycle (next ~16%).
- 09-11 12:41 "LLM plane dead" — 17 commits landed overnight through 429 trickle ("starved isn't dead").
- 09-16 06:31→06:33 "futile repair graded success 13×" — debit keyed on reward not `outcome=` label (status vs reached again).
- 09-16 09:24/09:25 docs annotation out of date before push; "swapped row counts for symbol names — token-level compliance that preserved the defect class".

Key: `false-verification` (instrument class). Standing law already in operator memory (09-15 "a negative is unattributed until a positive control shares its address") — the transcripts show it was learned ≥10 times before being written down.

### 2.6 Infrastructure / sync / credentials
| claimed_at | claim | later |
|---|---|---|
| 09-05 22:16 | "dev-vessel deploys silently stopped 95 min" / "run hung" | both retracted: pull-sync QUIESCED waiting for in-flight units; completed 22:16:49 |
| 09-05 04:59 | deployed file lacks fix | checked wrong path `/opt/vessels` (real `/vessels/<v>`) |
| 09-06 03:15 | `dist:check` "OK — container dist matches local src" first time; earlier "not on vessel's path" conclusions were deployment artifacts | — |
| 09-07 06:43 | root cause of `no llm_completion vessel found`: `/workspace/.substrate-secrets` loaded after `/etc/substrate/env` overrides the key | fixed; (recurs MEMORY 09-22 "EnvironmentFile WINS") |
| 09-07 23:18 | "every compose builds on a 21-hour-old base" | wrong: composes pin to freshly fetched origin/dev; the 3,186 "rejected" were discovery 401s |
| 09-09 21:44 (2c00ea45) | host reboot ~09:38 local; `substrate-live` had **no restart policy** → fleet dark ~4.5 h; fleet key had been silently dropped from the secrets file in a 09-07 rewrite; gen-env minted an unsigned random key → every vessel 401, discovery registry empty while units "healthy"; restoring an older key failed signature validation; seeder self-heal (`keyAuthenticates`→true) contradicted `/v1/keys/validate` | model stopped and handed back; 09-10 13:35 (bcc44633) root cause **`API_KEY` unset fleet-wide** in `/etc/substrate/env` and goal-host environ; keys issued under old secret never re-issued; fixed by issuing; "~85% of goals" were failing on credentials; reach figures before this declared void |
| 09-11 00:11 | user: "We should always make sure we are synchronized with the remote… should not have copied files into the docker container" | 12 commits local-only; rebased & pushed |
| 09-12 00:15 | rebase stuck 3.5 h on `c4ec7367 "feat: vessel code updates"` by Substrate Autonomous (mangled: `.js`→`.ts` import specifier etc.) — nothing landed since 20:15 | aborted/cleaned; gap left open because no detector exists (law 6) |
| 09-15 23:53 (28f8c594) | wiring proof: miswired `relevance-sink-vessel` (no store) stays green on `/health` (unconditional, `index.ts:111`), readiness, Docker HEALTHCHECK, registry `confidence:1`; full `substrate-ready` printed "fleet ready" while every write 502'd | fixed G1–G5: `d42910bc` (sink health round-trips `RETURN 1`, 503 degraded), bootstrap-tier `a919a62a`/`a07ea8b7`/`6067c25b`; re-validation matrix all pre-registered cells met (09-16 01:39) |
| 09-16 01:40 | entrypoint `vessel-ctl install … >/dev/null 2>&1 \|\| true` swallowed "federation-transport WORKDIR ABSENT"; container "ready", federated with nobody; `cp` directory-into-itself 46 restarts | `27c99783` made it loud; repointing transport to image copy crash-loops (vendored dep missing) — refused to ship |
| 09-16 06:07 | compose lane dead: 89 drafter 400s/30 min — model policy rev 21 pinned feature-compose to `gemini-2.5-pro`, an arm existing only because of an `unset-placeholder` GOOGLE_API_KEY from 09-15; keyless-provider branch passes `""` → SDK throws → one keyless provider crash-loops the resolver | operator hot-patch in running copy; durable fix `61ae51b` substrate-authored |
| 09-16 10:12 | fix 3 (discovery `/bootstrap` reads relay anchor from env file per request): (1) goal-host dispatch misrouted to `shellResult` satisfier at 0.6 target-inference confidence, graded hollow; (2) free-text `feature_compose`: semantic gate fails closed without gap context (contradicting doc-contract on `FeatureComposePointer.gap`); (3) with gap: all gates passed but `vessel-mitosis-cutover` refuses protected vessels (discovery, identity) and workspace cleaned before bytes harvested | operator-landed `0b7db2d`; gap `protected-vessel-compose-has…` filed |

Keys: `sync-deploy-drift`, `env-gating`, `endpoint-routing`, `node-locality`, `federation-p2p`.

### 2.7 Learning / reuse / selection
| claimed_at | claim | later |
|---|---|---|
| 09-02 16:38 | "Pathway reuse fires — I was wrong twice": 9 shape_signature acceptances; donor record frozen 10/12 across 11 uses | open |
| 09-03 10:05 | decay under-applied ~281×; chain-credit path (`posterior-update.ts:643`) resets `updated_at` without decaying ("frozen stock, starved clock") | — |
| 09-05 22:16 | "77% of goal classes are singletons" | per goal class 41%; 5× grading lever really 1.2× (adversarial pass) |
| 09-06 04:59 / 05:35 | "first-mile adaptation demonstrated end-to-end" (`[rebind] shellResult selected=true candidates=80`, wc -l 1346 correct) — "fired for the first time in this system's history" | 09-06 06:43 "demonstrated as an existence proof and refuted as a rate"; donor index 1,539→3,186 by making 1,644 pathways addressable, reuse rate did not move |
| 09-06 06:25 | `ablation:disableReuse` / `learning_mode:observe` tags 0→1 "counterfactual lever observable for the first time" | experiment "still owed" |
| 09-06 19:47 | "first real choice point": one genuine variant; 71 of 206 shapes have ≥2 live producers ("zero choice points" gap retracted) | — |
| 09-07 00:55 | "below the ridge": λ₁ 0.226 graded-exec/arm/day vs 139 mints/day; 65% of verdicts on one arm; 2.8% of arms graded in 3 days; 74–77% of arms have one execution | 09-16 06:26 selection ~98% observation, ~2% repair (`conservation-bridge-tick` 850 picks, `gap-goal:*` 5–13) |
| 09-08 20:56 | unique gap-id goal text breaks hash reuse | refuted: gap-id goals reuse 25.0% vs generic 20.0% |
| 09-16 09:18 (user-quoted analysis) | `goal_execution_paths` keyed by `goal_hash` (text hash) — one goal_hash on 156th dispatch with 155 consecutive non-reaches; `state_signature` populated on 0 of 96,747 rows; shape gating `CONTAINSANY` (superset) not covering; `v_shape_conditioned_score` has no rows | recurs MEMORY 09-22 ("failure side had no store") |

Key: `selection-learning`, `composition-crystallization`, `dormant-mechanism`.

## 3. Cross-window recurrences (found here, re-declared as new later in operator memory)

These are the "same issue, different hat" instances the realignment is about. "Later" = operator MEMORY.md index dates.

1. **In-tree vessels are outside every repair/authoring path** — 09-16 06:07: `relevance-sink-vessel` dead (`Unterminated string literal` at `/vessels/relevance-sink-vessel/src/index.ts:140`, a mangled second application of the already-landed `d42910bc`); every repair mechanism defines authoritative source as `/workspace/git/vessels/<name>/src`, absent for in-tree vessels; `runtime-drift-tick.ts:281` filters them out; `d42910bc` needed operator landing because "the vessel is in-tree with no standalone repo, so the mitosis push lane has nothing to push to". → MEMORY 09-22 "AUTHORABILITY = SUBMODULE MEMBERSHIP; human-surface/clock/relevance-sink are PLAIN FILES" declared as a new ⚡⚡⚡ finding.
2. **Retry/recovery never runs** — 09-16 07:33: 193 of 193 graded attempts over 8 days are "attempt 1/1"; `recommendExcluding`, id-normalisation guard, `repairSignatureOf`, exhaustion path "correct code with no reachable caller"; the prescribed In-Flight Recovery Loop (`docs/architecture/sequences/04-improvisation-failure-modes.md:75`) never executes. User 06:12: "This is an improper approach… try alternate routes…". → MEMORY 09-22 "THE FAILURE SIDE HAD NO STORE — EVERY DISPATCH RESTARTED BLIND".
3. **Escalations to nobody / timer plane can't learn** — 09-16 06:33: pool plane tried the futile `pull_cutover:…relevance-sink` repair 13× then debited to score 0.11 and stopped; timer plane escalated 23→36 and kept climbing. 09-04 04:23: `documentation_drift` sealed (`hopeless()` = attempts≥8 && lands==0 at `gap-to-feature.ts:987`, calibration 11/0) → escalated once as `uiQuestion_write gap_needs_human`. → MEMORY 09-22 "248 GAP ESCALATIONS WERE ASKED OF A VESSEL NO HUMAN READS".
4. **Flat-pointer write drops predicate fields** — 09-09 01:02–01:09: `walk_flat_pointer` write path dropped `edit_site`/`expected_literal`/`region` before classification → `falsifier:none`; also 09-12 00:11 `severity` dropped by `gapFromFlatPointer`; 08-29 metadata-dropping gap. → MEMORY 09-15 "TARGETING READS `classification_metadata.edit_site`" and 09-22 "CLASS-1 ARMING GUARD NEVER FIRES".
5. **Narrowed duplicate children** — 08-28 23:01 and 08-29 10:23: `-narrowed` child is a verbatim duplicate with `failed_attempts:0`, outranks its parent, pair alternates at queue head; retracted by hand twice. → MEMORY 09-22 "`-narrowed` child = verbatim dup" (still open).
6. **Secrets/env override precedence** — 09-07 06:43 `.substrate-secrets` loaded after env overrides key; 09-09 reboot dropped key; 09-10 API_KEY unset fleet-wide. → MEMORY 09-22 "unit `WORKSPACE_ROOT=/workspace` vs env-file… EnvironmentFile WINS".
7. **Post-land verification absent** — 09-02 20:51 "autonomous land produced an inert fix on a file with no test coverage"; 09-05 "no gate ever executes landed code" (2 inert / 1 correct per fix); 09-09 15:06 "every change passed typecheck + semantic gate, none executed by any gate"; 09-11 21:08 watcher on gap `autonomous-landings-are-never-post-verified`. → MEMORY 09-19 "a gate that READS a diff cannot certify reach" and 09-28 "POST-LAND SUITE DEAD 08-31→09-28 (shell 30s kill)". Note: the 09-28 finding says the suite was dead from **08-31** — inside this window, while the transcripts repeatedly reported gates as "working".
8. **Status vs reached / log-label vs reward** — CLAUDE.md warns; re-tripped 09-02, 09-05 ("drain drops 96.5%" category error), 09-16 06:33.
9. **Healthy-but-miswired** — 08-28 11:20 `NRestarts` certified a service with 61 s uptime (activity-api restarting every ~45 s, ~755 restarts/24h); 09-15 wiring proof (green health, dead writes). → MEMORY 09-19 "1404 restarts/4h, ZERO gaps; detector watched 14 timers / 0 services".
10. **Concept/lesson recall doesn't reach drafter usefully** — 09-03 02:24 concept-db dense leg timed out (2 s budget) → lexical found zero, drafter got *empty* principles; 09-08 23:49 "teaching channel closed end-to-end"; 09-11 15:04 lessons retrieved by token `semantic_reject` match everything; lesson-crediting fix landed inert ×4 (09-09). → MEMORY 09-22 "680 knowledge notes unread… recall window displaced all conventions"; memory 09-29 commits "recall ignores topic".

## 4. Attempts (what was tried, outcome)

| key | date | where | tried | outcome |
|---|---|---|---|---|
| hollow-landing | 08-29 → 09-05 | refuter quorum | self-retracted refutation counted toward 2/2 quorum destroyed correct patch; filed | partial (filed; reproduction) |
| test-residue-live-state | 08-29 18:23 | activity-api tests | ddmin → single polluter `maintenance-lease.test.ts`; `activity-template.test.ts` made real calls to live :8080 (flake) | worked (isolated) |
| test-residue-live-state | 09-01 23:52 | gap store | 8 `falsifier-*` rows rejected via `substrateGap_write` `rejected_reason:test_pollution`; test isolated | worked |
| test-residue-live-state | 09-02 16:01 | goal-host | test suite triggering real `systemctl start` (7,684 failed calls/day) | filed |
| false-verification | 08-31 09:24 | cutover | stamp removed `old_string` as predicate | partial: 20:07 silent when `pickRemovedLinePredicate` returns null |
| spend-envelope-throughput | 08-31 19:34–22:06 | gap-to-feature | retry waste fix, exponential backoff | partial |
| hollow-landing | 09-02 22:35 → 09-03 00:30 | cutover gate | CJS-in-ESM / shape-vocabulary refusal gates | worked on code; false-positives on prose/comments |
| trace-store-db | 09-02 07:53 / 09-04 10:22 | migrations 205/206 | unapplied `.surql` is "applied at next uncontrolled restart"; migration 205 premise refuted by live side, parked; 206 corrects field types | reverted/parked |
| trace-store-db | 09-03 02:42 | concept-db | `cb400d6` instrument: dense budget misses; event-loop starvation refuted (2–8 ms), CPU contention with ONNX suspected | partial |
| selection-learning | 09-04 22:31 | arms | retire never-graded arms | superseded: "an arm never selected consumes no grading budget" |
| drafter-quality | 09-05 | gap_to_feature | fix no-op so lane composes; expiry fix stopped deletion of findings | worked (backlog visible, +40–50/day) |
| false-verification | 09-05 20:29 | gate self-probe | `fe3cece` probe async | worked |
| selection-learning | 09-06 06:22 | effectiveTags | mutation-after-handoff fixed (ablation/learning_mode 0→8) | worked |
| composition-crystallization | 09-06 06:43 | donor index | 1,644 pathways made addressable | worked mechanically; reuse rate unchanged |
| write-read-mismatch | 09-06 09:16 | feature-compose | capture real `exec_*` id instead of fire-and-forget `void fetch` minting own id | worked (verified) |
| selection-learning | 09-06 13:11 | failed_attempts | environmental refusals `failure_kind: environment` escape `bumpFailedAttempts` | landed, consumer "inferred" |
| dormant-mechanism | 09-06 03:12 | engine.ts:151 | deprecation unenforceable vs pinned dispatch (1,218 retired templates) → guard at executor | partial (four deployments, method critiqued) |
| selection-learning | 09-06 20:21 → 09-07 01:14 | conservation auditors | six auditor activities over `http_fetch`; rhythm; bridge → ≤6 aggregated gaps | worked; runaway 61.6% of executions until rhythm decay bounded it |
| selection-learning | 09-07 10:02 | activity-api `/reach` | ordering defect: tag written before grade check | worked (β moving, 13 monotone readings) |
| selection-learning | 09-07 20:36 | dev-vessel | `adda1ef` reach delivery from autonomous lane | worked (α moved 54.39→55.13) |
| gap-content | 09-08 21:02–22:27 | gaps | mechanically-derived verified-unique regions (155 armed), RCT with 72 withheld | failed (p=1.0), claim retracted |
| drafter-quality | 09-09 08:23 | feature-compose | `bac7d00` un-invert anchor-repair guard | worked (34.4%→16.8%) |
| false-verification | 09-09 02:17 | gap store | `close_basis` persisted on close | worked |
| memory-recall | 09-09 05:55–07:01 | concept-db credit | lesson-crediting fix ×4 dispatches (landed inert, anchor_not_found…) | failed |
| sync-deploy-drift | 09-10 05:35 | pull-sync | `converge_units` fix; drift watchdog timer; census timer fired autonomously | worked |
| hollow-landing | 09-10 06:55 | pwt lane | vacuous-edit gate `0896a1c` | worked (positive control); earlier claim "would have prevented 6dc2005/9267810" retracted |
| dormant-mechanism | 09-10 09:38–22:03 | selftest | `learning-loop-selftest-tick` with severed-link controls; proven red on first run | worked |
| env-gating | 09-10 13:35 | identity/env | issue fresh keys under current secret; backup `/etc/substrate/env.bak-preauthfix-2026-09-10` | worked |
| memory-recall | 09-11 15:31 | compose lessons | regression `n=8→1` recall, reverted to `n=8` | reverted |
| drafter-quality | 09-11 16:01 | worktree | `29756da` `.git`-is-a-file indirection fix | worked |
| sync-deploy-drift | 09-11 | dev-vessel | `61a6e46` deadlock (`--no-block`), `4783f38` suppressed spawn not logged as failure, `61c02e1` keyless-provider detector | worked |
| goal-walk-floor | 09-11 16:33 | goal-host | `verifyDeterministicCompute` discarded own recomputed truth → arithmetic repair; qualification probe N=2 autonomous cycles | worked |
| node-locality | 09-16 01:39 | bootstrap tier | wiring green-vs-miswired fixes G1–G5 | worked (pre-registered matrix) |
| federation-p2p | 09-16 10:12 | discovery | relay anchor per-request read | worked (operator-landed `0b7db2d`) |

## 5. Mechanisms observed (status with evidence)

| name | location | purpose | status | general? | evidence |
|---|---|---|---|---|---|
| In-flight recovery loop (`recommendExcluding`, `repairSignatureOf`, exhaustion) | goal-host walk (`:13092`), docs/architecture/sequences/04-improvisation-failure-modes.md:75 | retry with different approach on miss | dormant | yes | 193/193 attempts "1/1" over 8 days (09-16) |
| gate-self-probe template | development-vessel:gate-self-probe-tick | prove gates still fire | dormant→live-unused | yes | executed exactly once (09-10 09:40); catalogued 09-10 09:41 |
| learning-loop-selftest-tick | development-vessel | per-link red/green assertions over execution→learning chain | live-used | yes | controls pass, first run RED with a real bug (09-10 22:03) |
| conservation auditors (6) + conservation-bridge-tick | activity-api `/conservation-audit` + templates | audit each junction, emit aggregated gaps | live-used | yes | 622→690 rows; 61.6% runaway 09-07; bridge 850 picks (09-16) — dominates selection |
| `/conservation-audit` route | activity-api | audit endpoint | duplicate | no | registered twice (09-07 22:35), fixed |
| `hopeless()` calibration seal | gap-to-feature.ts:987 | stop attempting categories with attempts≥8 && lands==0 | live-used | yes | seals `documentation_drift` 11/0 (09-04) |
| ingest-docs reap | scripts/substrate/ingest-docs-as-concepts.ts | evict stale doc concepts | broken | no | refused 18/18 runs: 596 candidates vs 460 limit (492 keys under repos/) |
| docs-align-tick | development-vessel | docs vs reality | dormant | yes | never executes (09-04) |
| config-surface-probe | scripts | config probe | dormant | no | no scheduled caller (09-04) |
| first-mile rebind | goal-host | adapt entry of learned pathway | live-unused | yes | fired once (09-06 05:35); reuse rate unchanged |
| `v_shape_conditioned_score` | activity-api view | shape-conditioned selection leg | dormant | yes | queried live, no rows (09-16) |
| `state_signature` | execution rows | contextual Thompson key | dormant | yes | 0 of 96,747 rows (09-16) |
| `activity.thompson_alpha/beta` | activity table | posteriors | fossil | no | never written; selection reads `variant_performance_metrics`/`context_thompson_scores` (09-09) |
| shadow ledger `POST /v2/activities/execution-traces` → dead table | activity-api | legacy trace ledger | fossil | no | newest row 2026-07-14 (09-08 00:33) |
| vacuous-edit gate | dev-vessel `0896a1c` | refuse edits with no behavioural change | live-used | yes | positive control 09-10 |
| semantic gate / adversarial refuters | feature-compose | judge patch addresses gap | live-used (fail-open on PASSED) | yes | PASSED uninterpretable w/o `llm_consulted` (09-10 11:07); fails closed without gap context (09-16) |
| mitosis cutover | development-vessel | land + deploy composed edits | live-used | yes | refuses protected vessels, no alternate lane (09-16); no push lane for in-tree vessels |
| escalation / patch_with_tools lane | development-vessel | land after gated refusal | live-used | no | lands fragments of refused patches (08-29); non-atomic subsets (09-10) |
| runtime-drift-tick | dev-vessel (watchdog, not activity) | repair runtime vs clone drift | live-used | no | exempts in-tree vessels (`:281`), argues its own exemption (`:17`) |
| pull-sync quiesce | scripts/substrate/pull-sync | deploy without killing in-flight | live-used | yes | misread twice as stalled (09-05) |
| close_basis | substrate-gap | record measured vs trusted close | live-used | yes | added 09-09 02:17 |
| reach-patch late verdict | activity-api | grade late reaches into posteriors | live-used | yes | 09-08 22:58 |
| deterministic label / goal_verification_label | goal-host ~15113 | oracle corpus consumption | live-used | yes | 15 consumptions/6h (08-28); corpus frozen 21h then writing again (09-10 13:51) |
| `Guard 2` (anchor provenance) | feature-compose | refuse anchors not from window | live-used | no | dates 08-10; observed admitting plan 09-07 |
| boredom `ucbScoreImpl` | boredom-vessel/src/index.ts:3413 | select next template by info yield | live-used | yes | ~98% observation / 2% repair (09-16) |
| `requeueAfterNonAttempt` | gap-to-feature | requeue on capacity non-attempt | duplicate | no | three call sites (08-31 19:48) |
| relevance-sink `/health` | relevance-sink-vessel | liveness | broken→fixed | no | unconditional 200 (`index.ts:111`); `d42910bc` |

## 6. Principles

### 6a. User directions (verbatim, short)
- 08-28 09:05 "The system shouldn't allow there to be failed tests"
- 08-28 20:19 "We are cleared to make any edits the system has proven incapable of landing on its own. But only those that would prevent it from landing fixes on its own."
- 08-29 19:50 "Our objective is to durably, verifiably, and causally prove that changes we make to close gaps, close them, and enable the system to operate as intended."
- 08-31 06:14 "It always seems like there is another problem of the same class just one stage earlier."
- 08-31 07:20 "If we can fix it why can't it fix itself?"
- 08-31 07:21 "shapes, goals, concept relevance, these are supposed to represent directions in semanticity, the expectations."
- 09-01 08:47 "It doesn't make sense to be so slow, It should be as fast as this harness. Same process after all."
- 09-02 23:24 "we need to get it to a point where it can take care of itself, and causally learn from its own changes and justifications."
- 09-03 03:29 "Impulses have varied content but they can be treated similarly to variables."
- 09-05 22:03 "docs are invalid the second they are written down. the ethos values derivation from observation and principle."
- 09-05 22:07 "I don't understand why we've spent so much time on something so useless"
- 09-05 22:30 "Lying requires intent, LLMs have no intent, they are just wrong."
- 09-05 22:57 "Don't put decisions to me… The system needs to know the consequences of picking one or the other and choose the one that would lead it to continue operation in a way it deems optimal and information positive. It needs to causally associate its actions on the environment to observable changes on any and all potential horizons."
- 09-06 03:26 "cost is not a concern, truth is."
- 09-06 07:36 "It seems every defect is the same one, one level up. is this true?"
- 09-06 10:47 "the surface needs to change in order to continue to render activity traces and ongoing activities… able to read human provided input of any form or format"
- 09-06 20:21 "Make each conservation invariant an activity that audits its own junction."
- 09-07 00:17 "It not terminating is the point. termination is a failure mode, falling off the manifold. identifying where and when to cross which horizon and how to detect and observe horizons is the core mechanism"
- 09-09 08:01 "The system already has a mechanism for this. we should reuse-before-mint if possible."
- 09-11 00:11 "We should always make sure we are synchronized with the remote… we should not have copied files into the docker container"
- 09-16 00:31 "It shouldn't be this difficult. … provide basic config / run the container / everything works / if needed use vessel-ctl to modify vessel inventories"
- 09-16 06:12 "This is an improper approach. What I would expect a fully autonomous system to behave like is to try alternate routes to reach the desired goal and verify that it has done so if the obvious path was wrong or unavailable… What would a human do…"
- 09-16 06:52 "some documentation may and will be out of date, or just wrong"
- 09-16 09:18 "ensure docs match reality" (+ the shape-signature-is-the-parametrization analysis)
- 09-16 09:25 "Still invalid. Names, tables, and other implementation details are irrelevant and are also subject to change."

### 6b. Method laws earned in these transcripts (each learned ≥2×)
- Every false alarm was caught by a control, never by re-reading (stated 09-09 00:56: "Not one was caught by re-reading. Every single one was caught by a control.").
- Absent key ≠ null ≠ zero; `CONTAINS` is an array op; `datetime > 'string'` matches all; `NONE` ≠ `NULL`; `LIMIT n` default + worst-first sort biases.
- Local (PDT) vs container/commit (UTC) time: 7-hour offset produced false zeros twice.
- Mid-flight state read as terminal (stage→commit window, mid-write file, running dispatch) — "third time tonight an intermediate state looked terminal" (09-09 02:16).
- Count registrations/rows, not a 200 or log lines (uniq -c 359 lines = 8 ids retried 180×).
- Measure at the unit the selector selects over (output shape), not name stems.
- Query origin/dev, not the local un-fetched clone.
- A gate/detector must be proven to fire (positive control) and to go red, not merely to exist.
- Under a standing "find compounding" instruction with unlimited attempts, something will look positive by chance: the model declined to keep generating interventions 09-08 23:45 after ~120 Stop-hook repeats of "Is it compounding now?" (three published results retracted that day: p=0.002 region effect, ×20 output, 177h→2h latency).
- Operator corrections were about abstraction level, not facts (09-16 10:01): "token-level compliance that preserved the defect class" — patch the instance, check the class moved.
- The model's own retraction of a gap must reach *state* (`status: rejected`), not prose: 08-29 16:22 a gap with "CAUSAL CLAIM RETRACTED — DO NOT ACT ON THE TITLE" in its summary kept winning compose slots because `status: open`; 3 of 6 composes spent on refuted premises.

## 7. Process observations

- Stop-hook goals drove most volume: "file and observe the closure of these gaps. then observe that they fire on their own." (~450 re-injections in 9c8dceae/af312d72), "we are authorized to dispatch fixes… until all behavior conforms…" (~180), "continue assisting… Don't put decisions to me…" (~20), "Is it compounding now?" (~120). The completion conditions were structurally unsatisfiable ("0 closed" was the honest outcome for 12+ hours on 08-28); the model explicitly refused to manufacture a close (08-28 11:36, 12:14).
- 08-28: "I've already once let real data be destroyed while pursuing this goal" (live data-loss incident found, remediated).
- User distress lines (09-05 22:36–22:57) came right after the model had spent hours claiming the system "notices nothing" — which was the model misreading the `source` field (09-05 20:19 correction).
- Operator hand-landings dressed as intractable-blocker exceptions: model self-questioned 09-16 09:58 ("Did I rob self-maintenance three times…?").
