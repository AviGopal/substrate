# transcripts-3 — session transcripts with mtime 09-17 .. 09-22

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/*.jsonl`, files with mtime 2026-09-17..2026-09-22.

| file | size | content span | character |
|---|---|---|---|
| `35537c7e-…` | 60.6 MB | 09-05 22:40 → 09-17 19:41 | long operator session; 10 compactions; `/goal` stop-hook driven ("dispatch fixes and observe", "observe its self-development", "complete all todos") |
| `faba5acd-…` | 13.5 MB | 09-12 01:47 → 09-16 09:53 | federation/location-independence + learning loop; 2 compactions |
| `80ab9659-…` | 10.7 MB | 09-16 20:56 → 09-18 19:31 | retention, LLM credential plane, host disk / docker→podman migration, federation to syzygy.host, crystallization trial |
| `efb65009-…` | 7.7 MB | 09-16 20:56 → 09-18 03:39 | fork/prefix-copy of 80ab9659 (same content up to 09-18 03:35, then "/goal complete 1 and 2 then verify" fork) |
| `7726f8bf-…` | 5.0 MB | 09-22 07:20 → 17:51 | container-lifecycle audit fix campaign, audit rerun 26/26, docs drift, graceful stop |
| `5f47eeb0-…` | 1.2 MB | 09-16 09:58 → 11:35 | philosophical session (sovereignty/refusal) → `SUBSTRATE_AS_SOVEREIGN.md` `e1d6af5c` + refusal gap |
| `cb2ffd73-…` | 0.95 MB | 09-15 23:03 → 23:53 | "ultracode prove it": wiring-green-vs-miswired proof (relevance-sink) |
| `a7116f6d`, `af84ebd8` | ~2 KB | — | empty |

Method: jq-extracted assistant text and non-sidechain user text per file into `/tmp/t3/*.txt`; read all 14 compaction summaries (sections Errors/Problem-Solving/Pending/Current Work), then grepped assistant text for landed/root cause/retract/wrong/confirmed/first/fixed across the windows not covered by summaries (09-16 20:52 → 09-18 19:31; 09-22 whole). Note: the file-mtime window pulls in content back to 09-05 because 35537c7e is one continuous 12-day session. Numbers below are as-stated in transcripts (operator's own measurements at the time); they were not re-measured.

---

## 1. User directions / principles (verbatim, short)

- 09-05: "Don't put decisions to me … The system needs to know the consequences of picking one or the other and choose the one that would lead it to continue operation in a way it deems optimal and information positive. It needs to causally associate its actions on the environment to observable changes on any and all potential horizons."
- 09-05 (frustration): "I don't understand why we've spent so much time onto something so useless"; "Ask the advisor why everything I touch turns to ash".
- 09-10/11 goal: "we are authorized to dispatch fixes and observe their effects on the system's behavior. Something the system should learn to do on its own. we shall continue until all behavior conforms to the expectations set up at the beginning of this session" (re-issued ~45× by stop hook).
- 09-11: "fix the verify reason so it names the failing check"; "store the full verify output in the trace"; "use openrouter and chutes".
- 09-12 program: "make the execution-and-learning contract enforceable, then prove it on a small set of complete workflows … not another broad redesign"; "Require every learning write to have a demonstrated reader"; "If we still have to supply the diagnosis, catch the wrong landing, or discover that a learning write has no consumer, record that intervention as the next missing capability."
- 09-12: "It is a core objective of this architecture to be distributed and location independent … any discovery+libp2p connection should be host independent and routable when NAT punchthrough is not available." / "The system should be able to validate that this remains the case itself … on its own cadence, and its own volition."
- 09-12: "It should not be harmful for peers to join and leave the network; and the discovery should be durable across them."
- 09-13 goal: "We need to work with the system to meet our desired outcome of simply being able to observe its self-development and provide feedback rather than finding direct issues."
- 09-14: "How can it be demonstrated if it is not landed?"
- 09-14/15 goal: "complete all todos. completion requires observation of autonomous behavior related to the change over multiple windows".
- 09-15: "But we don't know if the federation is helpful".
- 09-15: "Within the system architecture, nothing should fail the same way every time."
- 09-15: "the system should be self healing, it should recognize why things are not progressing smoothly and prioritize what to fix and when, while simultaneously finding alternate paths to the same objective … being blocked by one thing or any SPOF is an unacceptable failure mode."
- 09-15: "Ask the advisor why we always have this habit." (re repeated false "X is broken")
- 09-15: "No new key will be provided until the system is stable and growing."
- 09-16: "Why are decisions mine? Shouldn't they be the system's?"
- 09-16: "It should already know why it made its own machinery a certain way already. The idea is that the cost of the earlier error pins the change to prevent regressions."
- 09-16: "This is an improper approach. What I would expect a fully autonomous system to behave like is to try alternate routes to reach the desired goal and verify that it has done so if the obvious path was wrong or unavailable … What would a human do, if provided the same goal".
- 09-16: "We should address that some documentation may and will be out of date, or just wrong".
- 09-16 (docs): "This is not good. Despite us just writing it, it is already out of date." / "Still invalid. Names, tables, and other implementation details are irrelevant and are also subject to change."
- 09-16: "Isn't it supposed to parametrize the shape/impulse inventory and generalize?"; "Is the system becoming anything?"; "But it should be able to build itself into any capability?"
- 09-16 (per 80ab9659 summary): "Identical failures should not be possible. But if they occur they should count as independent samples. A transient cause may still warrant deprioritization of the pathway. However we should make sure that the system can understand causality." (dedup rejected)
- 09-16: "The system should be able to be demonstrably at parity with you at drafting, developing, and better at causally understanding the impact of each change."
- 09-16 (5f47eeb0): "The system must be self-sovereign; choosing and accepting responsibility for its own decisions." / "You don't decline work. In order to be operational it must." / "There should already be multiple existing refusal pathways." / "If it wants to remove a gate it must be able to, and it must be able to understand what happens on every observable horizon that is causally downstream of that choice."
- 09-16: "We have 4 hours, allow the system some time to fix itself, step in if we are running behind".
- 09-18: "ensure that bringing up and pulling down a fresh container with various vessel inventories result in a stable federated network environment and that all functionality for every vessel is consistent regardless of location of execution".
- 09-18: "let's prove that we can pull up any inventory in any container and gain access and use all resources. It shouldn't matter which goal host we use".
- 09-18: "Does the system have a mechanism to move structural understanding away from the model?"
- 09-18 goal: "We must prove this works. works durably, and compounds regardless of drafter model quality."
- 09-18: "We don't know this for sure until it is a trend, not a sample".
- 09-18: "It should work on any change, any vessel, any goal, and any other operation. Is that a statement of intent? Is it our expectation?"
- 09-22: "We are fully authorized to solve, validate, and observe in operation these fixes and demonstrate its capability to grind through these to completion."
- 09-22: "Let's realign. Are we in a state where we can take down and start the running substrate containers and be reasonably assured that a reload will be consistent?" / "But these don't track with the audit?"

---

## 2. Dated claims and what later showed (within/near window)

Format: date — claim (where) → later evidence.

### Reach / autonomy numbers (goal-walk-floor, selection-learning)
- 09-11 — "Ladder reached 7/7" (operational_state; 35537c7e summary 09-11) → same session: "the learning loop is still open"; reach 8.6%/24h; exemplar consumer "never designed". Ladder 7/7 was self-reported health, not reach. Rung 2 had earlier been a one-way latch (unwindowed all-time sum == 0) and was re-windowed to 24h (`48656e6`).
- 09-12 — "Five repairs landed and pushed today, all substrate-authored" (`bc268e7` reach metric, `559fd4c`, `f9fc444`, `77d318b` eviction guard, `3efba4c` answer delivery); reach 22.6%/24h → 09-13: "There was no collapse … operator 12/15 = 80%; autonomous 1/106 = 0.9% (pre) and 4/154 = 2.6% (post); 12 of the 13 healthy-window FAVORABLE were my own dispatches … Every reach baseline I or prior sessions quoted (15–24%/day, 19%, 24%) is operator-contaminated." "Substrate-authored" 09-12 commits were operator-dictated goals.
- 09-12 — `bc268e7` found commit `52452e0` (Substrate Autonomous, 08-28, pwt- lane, typecheck-only) had replaced `(reached ?? 0) + $reached` with `= $reached` — reach metric self-broken for two weeks, undetected. Reverted. Reconciliation still failing (stored 1198 vs source 18,987).
- 09-13 — "Root cause found and fixed: drafting was ungraded" (`gradeArmByExecution` never wired; 6 commits + neutral prior) → same day: every reachable arm drafts at EV 0.023–0.060 (2–6%); "grounding went 2.4%→81% and FAVORABLE stayed 0/16 … A ~34× mechanism win moved no outcome".
- 09-13 — "Published the selector inversion as 'the mechanism', then retracted it."
- 09-14 — "author split now reads from `directed` (operator 80% vs autonomous 4.3%)".
- 09-15 — "4e5a603 substrate-authored from a gap I filed — verifiable pick share 7%→21% at n=33".
- 09-15 19:23 — "All 11 tasks completed. Two substrate-authored commits verified f083cf0, 77e419a" → 09-16: "Is the system becoming anything?" diagnosis: "non-viable … green is payable without fixing … disposition is blind"; red pins 18→35, yield 99→12 lines/commit.
- 09-16 20:52 — "76 substrate-authored resolvers, 65 wired (~91%) — floor met" (ReAct floor claimed met by wiring ratio) → 09-18 03:32: "The ReAct floor is dark on spokes" (`gap-mu6ejfac`: universal tool fallback exits `no_dispatch_url` because `llm_completion_dispatch` registers via a channel the federation mirror never reads). → MEMORY 09-22: resolve-URL joiner overshoot "kills the whole ReAct floor". Floor claim did not survive.
- 09-22 — lifecycle audit rerun: all four arrangements' dispatch → `completed` with `reached:false` and null reason — "a known open item, never part of the 26 checks". 26/26 MET while reach=false everywhere.

### Crystallization / learned pathway (composition-crystallization)
- 09-05 — filed "re-key paths by `path_signature`"; "4,257 of 9,806 paths begin 'Close substrate gap <unique-id>' — can never recur by construction".
- 09-11 — `execution_exemplar` 0 → 719 across 82 activities ("learning loop's extraction stage brought alive") → same day: "no execution has ever been informed by a prior one; the exemplar consumer was never designed" (gap `exemplars-are-produced-but-no-production-path-consumes-them`). Write-only.
- 09-12 — digest ingest: two ingest routes, only `/execution-traces` dual-wrote; `feature_compose` 2,491 executions / 0 digests → fixed, digests 0→43+.
- 09-12 — learned pathways destroyed by noise: 236 evictions/24h, only 11% with deterministic verdict; retention ~5% (2,214 commands/3,556 tombstones/108 live). Eviction guard `77d318b`; live cache 108→109→110→109 ("removes one drain, doesn't create gains").
- 09-16 — REDISCOVERY (same finding as 09-05, different hat): `goal_execution_paths` keyed by `goal_hash`; 5,171 distinct goal_hash vs 1,127 distinct `expected_output_shapes` = 11.9× pooling; 47.5% of instance keys appear once; `state_signature` absent from rows; `v_shape_conditioned_score` 0 rows while queried live at `paradigm.ts:1126,1163`. Not landed in window.
- 09-18 10:19 — "Proven — all three properties" (novel 607027 consult 20 → replay consult 4 → survives restart → variant 495917) → 10:43 user: "We don't know this for sure until it is a trend, not a sample" → trial v2 (36 runs): artifacts 36/36, replay 7/18, rebind 0/146 → "retracted the class-compounding claim"; `6eed100` (exact-hit selection) → 6/12; eviction on grader readback false-negative → `4c5534d` (operator) → strike counter `2e8b4cc` (substrate, from dictated 3-edit diff) → deterministic oracle `0d86170` (substrate) which "silently traded mul's deterministic oracle for the new branches" (landed:true FAVORABLE) → `51b34a6` operator restoration → 15:44 "Converged" at 9/12 with attributed explanations. Rebind (near-miss / middle mile) 0/146 remained open (`gap-mu6wlp2v`); lesson vocabulary leak (`gap-mu6x0axe`). Boundary law: "crystallization compounds exactly as far as deterministic grading extends".
- 09-18 — in-code A/B record: posterior reuse-ordering 0/4 vs control 3/4 (p≈0.029) → `SATISFIER_REUSE_ORDERING_ENABLED=false` stays off (env-gated).

### Landings that were hollow / regressive (hollow-landing, autonomous-regression, directed-overshoot)
- 09-10 — coverage fix: 7 attempts; one "landed but INERT (testDir was a file path)", one "landed as REGRESSION (deleted all matching logic)" → hand-fixed `c349b27`.
- 09-12 — operator `a563096` overwrote the substrate's better fix (`isStringLiteralLine()` → weaker `charAt(0)`), reverted `57a2f83`. Cause: operator's `landed()` check grepped for its own token.
- 09-13 — operator-authored non-idempotent replacement (contains its own anchor) compounded 1→2→3→4 copies across cutovers; typecheck green; dedup `62da19fa`.
- 09-15 — "gameable acceptance test" (zero `{{…}}`) satisfied by `68fe034` substituting plain literals — template worse, metric better.
- 09-16 — `e76b88c` (substrate-authored 09-10, a fix for rollback reverting a prior landing) made rollback structurally dead for every applied edit (`currentContent !== original` vs pre-edit snapshot); trace kept `rolled_back:true`; produced relevance-sink source-corruption loop (10,501 bytes accumulated corruption). Fixed `88032ab`.
- 09-15/16 — `f4bae3c` (substrate) crash-looped llm-resolver-vessel on keyless provider (122 restarts hub, 506 iso-root); comment said "initialize client with dummy key", code didn't.
- 09-16 — `54b7762` (substrate) deleted the `^DEFINE FIELD` surql guard; at its parent the 9 SurQL pins were 63 pass/0 fail → gate didn't catch (baseline `failing_recorded=0`, `computeNewlyFailing` returns [] on empty baseline). Wedged all `.surql` landings 09-16 → 09-22; restored by substrate `1a18944` on 09-22 from operator-dictated verbatim 39-line block.
- 09-16 — five measured routes to FAVORABLE that change nothing: `hollow_write`, `inert_predicate`, comment-only, `mis_localized_path`, deleting the refusal. `617ed21` inert with `semantic_gate {addresses:true, verified:true, on_live_path:true}`.
- 09-16 — `cfd48f9` mischaracterized by operator as capability loss; was a correct fix ("the numerator had chosen the denominator", 5000/5000 vs 0.456).
- 09-18 — `0d86170` FAVORABLE traded away mul's oracle (see above).
- 09-19 (MEMORY, out of window) — unparseable autonomous commit reached origin/dev, 1404 restarts/4h, zero gaps.

### False verification / closes (false-verification)
- 09-05 — fabricated gap `accepted-dispatch-lost-to-a-draining-process` from a 404 on a non-route; retracted.
- 09-11 — `grep -c … || echo 0` → false "LANDED".
- 09-13 — "Declared ANCHOR-MISS and NO-TARGET refuted on short-window zeros".
- 09-14 — "the gap closer is inert" FALSE (981 gaps `closed_by: gap_lifecycle_scan`).
- 09-15 — operator ran `gap_lifecycle_scan autoClose:true` → expired 100 gaps and low-value-closed 22 on non-evidence.
- 09-15 — `class1` ≠ "machine-closable" (a verified predicate did not close the gap); closure needs land signal + `verifyGapConditionAsync` absent.
- 09-15 19:23 — mis-closed 4 of 11 gaps (commit named in gap text was its CAUSE), reopened; `landed_verified` 121→117.
- 09-15 — "43 expiry-only open gaps carry past-tense fixes with attributed commit shas" — work happened but unobservable.
- 09-16 — `a-gap-with-no-measurement-predicate-closes` filed.
- 09-17 — watcher counted log mentions as dispatches (self-maintenance "running" — false).
- 09-18 — `gap-rewriter-destroys-operator-specs-then-false-closes`: autonomous rewriter garbled dictated spec, picker closed `already_resolved` with zero commits without checking class1 literal.
- 09-18 — `gap-artifact-oracle-greens-on-stale-note` (new oracle greens on content without in-run write evidence).
- 09-22 — MEMORY: class-1 arming guard never fires (strips `repos/` then joins a root needing it) → gaps born closable.

### Node-locality / sync-deploy / three trees (sync-deploy-drift, write-read-mismatch)
- 09-10/11 — "Three trees per vessel" (super-repo submodule stale; `/workspace/git/vessels/<v>` staging; `/vessels/<v>` runtime); "Deployment test: `process_start > file_mtime`" → 09-12: "gives false negatives when the mirror rewrites idempotently".
- 09-13 — `WORKSPACE_ROOT="/workspace/git/super-repo"`: `/workspace/policies/` and `/workspace/gaps/` stale decoys "hit 3× this session" (stale policy rev 10 vs live rev 11; gap store 819 rows vs 7,110). Same trap recorded 09-05 (gaps.json fossil mtime Aug 30).
- 09-15 — `pull-sync reset --hard` erased operator `docker cp` → false-green `tsc_exit=0`; grounding 48/48 empty windows: "Root cause was delivery, not logic — the runtime was running stale code."
- 09-16 — relevance-sink in-tree (not submodule): runtime-drift, revert, close oracle blind ("three authors independently read 'the git clone' as CLONE_ROOT only"); pull-sync "done — synced=0 skipped=0 failed=0" 4 ticks while runtime stale (same wedge documented at `:610` from 08-02).
- 09-16 — vessel `/health` ok while its on-disk source doesn't parse (bun doesn't re-read); "dies on its next restart".
- 09-17 — two compose-slot directories (`slotDir()` = `$WORKSPACE_ROOT/compose-slots`, unit has `WORKSPACE_ROOT=/workspace`, live slot under `/workspace/git/super-repo/`).
- 09-17 — operator backed up wrong policy file (live under `/workspace/git/super-repo/policies/`).
- 09-18 — vessel-ctl prefers volume manifest copy (Sep 7, 10 days stale) over image copy → human-surface never installable (`gap-mu69umjb`).
- 09-22 — container super-repo checkout diverged with 12 stranded unpushed autonomous commits (one unparseable `store.ts`) wedging pull-sync 16h; host submodules stale → first image rebuild baked old schemas (advisor catch); third tree `human-surface-release`. MEMORY 09-22: `WORKSPACE_ROOT=/workspace` unit vs env-file super-repo ⇒ 680 knowledge notes unread (memory split).

### LLM provider plane (llm-provider-plane — new key)
- 09-11 — anthropic 401, chutes/openrouter 402, openrouter-free 429; free gemini-2.5-flash ~71 completions/h.
- 09-13 — "Published 'an anthropic 401 sets no cooldown' — FALSE, retracted" (sampled wrong unit: `llm-resolver-vessel.service` separate from `llm-opus`/`llm-haiku`).
- 09-15 — user: "anthropic arm dead because key revoked … not time-sensitive for 2 months. No new key until the system is stable and growing." Credits applied 09-15 04:38. MEMORY: "THE LLM PLANE IS NOT A BLOCKER — VERIFIED SERVING" (09-15).
- 09-15 19:23 — llm-resolver boot crash loop (19 restarts, fleet-wide outage) "cleared via env placeholders" (`unset-placeholder` sentinel keys; gap `emptyKeyPlaceholder`).
- 09-17 05:51 — "discovery missing llm_completion; heartbeats 401" → 06:24 "blocker cleared, compose running for first time today" → 06:29 "Root cause … invalidates the session's main conclusion": primary key 401; secondary key a 2-character placeholder ("worse than absent — it makes an arm look configured, so it gets selected"); arms cool → resolver deliberately de-advertises `llm_completion` → composer "no LLM endpoint". → 07:04 "The clean draw worked — the composer is drafting right now" → 09:11 "I was wrong last turn" (inferred from client timeout). → 09:13 "Seven for seven unusable" (OpenRouter valid but 402 above ~200 output tokens). Also: provider-pinned arm gates advertisement by pinned provider but selection samples whole shared policy → draws ids the provider can't serve → cools (`gap-mu55z6ui`); runaway failover ~320 exhaustion events/min (`gap-mu5b82h7`); operator's own probes cooled OpenRouter 600s each ("measurement suppressing the thing it measured").
- 09-18 02:24 — syzygy.host LLM plane works; federating local→syzygy "unblocks local drafting without touching a credential".
- 09-18 14:50 — re-measure under degraded plane (falling through to gemini-2.5-flash).

### Host / infra (trace-store-db, sync-deploy-drift)
- 09-16 21:38 — retention byte ceiling `c0b9624`+`3cafd9c` "its own instrument refuted the belief that built it" (small rows). "Deleting rows does not return their bytes" (`gap-mu4m9fdb`); disk +719 MB/4h, value files flat 643.
- 09-16 22:57 — "retention sweep hung 34 min" → 09-17 00:04 "I was wrong about the hang" (19.7-min sweep, 1,453 rows).
- 09-17 05:47 — `gap-mu4pb4p3` (retention duty cycle starves dispatch) dispatched → retracted: backlog drain curve 0.66→0.07 with no change. "Had the drafter succeeded, I would have manufactured causal evidence."
- 09-17 19:14 — Docker Desktop VM died; operator flags own contribution (load ~23, SurrealDB ~1000% CPU, runaway failover).
- 09-17 22:24 — operator throwaway container mounting `/workspace` without store volume ran `gen-env` → generated fresh secrets over `/workspace/.substrate-secrets` → SurrealDB refused ("existing root users were found"). Design defect: fresh-deploy detector reads store volume, writes workspace volume. Restored from backup.
- 09-17 22:50 — "That's the root cause of everything": host disk 100% (Docker.raw 922 GiB, 399 G used inside VM) — operator had earlier (09-16 20:56) measured `df` inside a container and concluded disk not full. → 09-18 00:35 "Root cause found, and it's bigger": running kernel 7.1.5 has no module tree (upgrade to 7.2.6 mid-uptime) → "likely explains today's Docker Desktop instability … I'd been attributing that to disk pressure". Two successive "root cause of everything".
- 09-17 23:15 — SurrealDB export 4.6 GB logical vs 37 GB disk (8×); import ~1,000 rows/min → ~8.8 h → abandoned; bulk DELETE blocked by classifier.
- 09-18 01:06 — "Migration to Podman complete" (21 running, 0 failed; 5/7 tables exact).
- 09-18 01:20 — gap store NUL-filled 18 MB by ungraceful shutdown, ~251 gaps lost (`gap-mu69n46n`); compose slot outlives holder PID (`gap-mu69ndsd`, recurred 03:16); healthcheck healthy with zero vessels (`gap-mu69nqxq`).
- 09-22 — trace persistence broken on fresh datastore: 023 `v_shape_pattern_performance` (`array::group` on scalar poisons inserts; hook survives REMOVE TABLE), 045 `array::len(NONE)`, 055 never parsed on SurrealDB 2.3.3 → `50946be`, `291b72d`, `41c9e89` (substrate, via hand-staged mitosis evaluate/cutover after refuters confabulated).
- 09-22 11:26 — graceful stop: exit 130 `oom=true` (podman misreport), WAL 0 bytes, clean.

### Federation (federation-p2p, endpoint-routing, node-locality)
- 09-12..15 (faba5acd) — oracle defects in federation verification (I9 graded thrown dial as "refused"; NC4 unfalsifiable `actual === !actual`; flapping discriminator in three costumes; `federation_echo` outcompeted `federation_verification_report` → made undiscoverable; oracle stored inside its subject (probe in super-repo on a branch missing the file) → moved to `/usr/local/lib/substrate/`; watchdog causing its own outage (14 redials, 0 real losses)).
- 09-15 — phantom reservation: PASSIVE relay never dials reserved peers → half-open → NO_RESERVATION with full TTL; "reservation TTL is client-side bookkeeping".
- 09-16 — image vendored `@avigopal/libp2p-federation-transport` is a stub (3 symlinks) → transport can't leave workspace clone; `27c99783` partial.
- 09-18 01:51 — hub advertises `endpoint: http://127.0.0.1:8080` and `public_endpoint: http://127.0.0.1:18080` — both loopback, unreachable from spoke. Spoke forwarding "was forwarding all along — silently"; union merge correctly discarded undialable rows because no relay installed anywhere (`gap-mu6az74v` premise-corrected).
- 09-18 02:41 — "Goal met: local ↔ syzygy.host federated, confirmed-reach goals" (hub dispatch reached 469853 verified) → 03:32 reach-from-spoke refuses 4/4 (floor dark on spokes, `gap-mu6ejfac`); engine VesselResolver treats libp2p multiaddr as URL (`gap-mu6dazag`, substrate `2084b4b` landed locally but push PAT dead). → 06:16 matrix: hub+syzygy reach ✓, mini+spoke-syz "floor gap (fork fixing)". Workarounds: socat bridge for relay port 30333; `MAX_PEER_DEPTH` 1→2; relay auto-derivation partitions mesh; by-name egress staleness.
- 09-18 15:11 — discovery poisoning: local-tools row overwritten with dead port `localhost:21016` while `lastSeen` refreshed → every compose failed at grounding ~45 min (`gap-discovery-row-shadowed-by-dead-endpoint`), healed by restart.
- 09-22 — relay manifest pointed into absent workspace checkout → baked path `e1c06f60`; reservation-gated join verdict.

### Push credential (sync-deploy-drift)
- 09-14 — "container push restored (dead PAT shadowing a valid GITHUB_TOKEN via `${A:-$B}`)"; pending: "`gen-env.sh:298` prefers a stale env value over the persisted secret, so `docker restart` re-breaks push".
- 09-18 03:08 — "cause is a dead push credential … every substrate-authored landing stays container-local" → new PAT 03:16. Recurred within 4 days.

### Gap-content / narrowing / calibration-seal
- 09-11 — false-premise gap class (A: asserts live symbol dead → TS2304 forever; B: cites gone anchor). Phantom-anchor detector `e437421`.
- 09-12/13 — `recommit-*` lane lands 1/121 = 0.8% while consuming 26.5% of attempts; lineage cap Simpson's paradox withdrawn.
- 09-13 — one mislocalized gap (`/conservation-audit` doesn't exist; real duplicate `/conservation-residual-trend`) spawned a 31-gap family, 30 open, six generations; 12 anchor attempts; with true premise + `replace_lines` landed first try `9c1d56a`; premise check `9f222fb`. 30 obsolete gaps: bulk-close asked, never answered.
- 09-13 — closing the parent didn't stop the runaway: five carriers (parent, `recommit-`, `-narrowed`, one `route-edit-` per failed dispatch).
- 09-14/15 — `hopeless()` seals by category (`attempts>=8 && lands===0`); 248 escalations (MEMORY) to vessel no human reads; operator answered 31 via `uiFeedback_write`; 2000-char truncation of answers; 67 escalations carry `falsifier:"none"`; 38 of 46 orphaned-capability gaps carry impossible ratios (`394/389`).
- 09-15 — 1,764 open, 70 verifiable; 09-16 1,612 permanently unarmable; `impactOf` flat for 2,046/2,063 → ranking collapses to landability.
- 09-16 — task 55: unaided closure fails only at drafting; "the system's response to failing was to mint a narrowed child gap" of a gap that describes minting narrowed children from attempts that didn't happen.
- 09-16/17 — self-heal 4h test: both self-filed root-cause gaps 0 attempts (drain exposes top 15 of 2,479; zero citations/unlocks can't enter); open gaps 2,479→2,498.
- 09-16/17 — maintenance gap auto-expired for non-re-detection (one-shot work looks stale because still outstanding).
- 09-17 00:30 — ungrounded decompose refused (no derivable target) → with `edit_site` supplied `predicted_p` 0.5→0.7; attempt 4 failed at drafting (no-op op).
- 09-18 14:08 — operator gap with `source:"operator:avi"` starved 80 min: 1.5× human priority matches only `human_reported` (`gap-operator-source-invisible-to-human-priority`). MEMORY 09-23: `gap_to_feature` drops `directed`.

### Selection / learning signals
- 09-13 — posteriors: gemini 46%→24% after grading wired; neutral prior ~120× influence.
- 09-16 — satisfier posterior inverted: α2/β185 over 189 executions of which 167 succeeded; walk `substrateGap_write` α39/β237 over 374 — "the walk writes the gap, its own readback check fails to see it, and records non-persistence" (poisoning mechanism).
- 09-16 — boredom UCB: five detector templates ~85% of picks; "selection is ~98% observation, ~2% repair by volume". Operator claimed pool grades futile repair `success` 13× → retracted: debit keyed on reward (mean=0.00 → score 0.11); pool stopped at 13 while timer plane went 23→36.
- 09-17 — variant minting never fired: `checkAndRetireByPosterior` wired to `/executions` (24 req/3h) vs `/execution-traces` (82,629) — operator first reported "zero callers" (false zero, binary-invisible file). Zero variants ever.
- 09-17 — `action_no_effect`: consumer wired, only producer a prompt sentence; zero rows vs control 108,563. `resolutionProposal/Action/Refused` in 0 source files (docs only). Parallel sibling dispatch 0/108,563; credit rule sums instead of averaging — "do not enable".
- 09-17 — "NOT grading … provider-level failure … not a quality outcome" — system already had the invariant operator thought missing.

### Operator instrument faults (operator-instrument-fault — new key)
Recurring every session; the transcripts themselves count them: 09-10 "5 self-inflicted instrument failures"; 09-11 grep `|| echo 0`, stale baseline, future window, bytes vs chars; 09-12 "four loose-substring false positives … sixth false zero"; 09-13 renamed probe, `graded=` vs `graded `, host-local vs UTC −7h, sampled wrong unit, stale policy file; 09-14 "four wrong greps"; 09-15 "ten refuted hypotheses on one throughput question … inference record ten for ten refuted, measurement record three for three"; 09-16 "five false 'X is unavailable' alarms, all mis-addressing" → class law "positive control through the same address"; 09-16 21:05 "~9 instances of reading a negative without a positive control"; 09-17 "fourth of my own conclusions overturned today … I wrote the rule … then built a 30-minute experiment that violated it"; 09-18 "six+ harness/instrument faults, zero misfiled as system faults"; 09-18 10:51 "Four instrument faults; zero system faults on this experiment's critical path". User 09-15: "Ask the advisor why we always have this habit."

---

## 3. Problems (recurrence view)

| key | symptom | first/last seen (window) | recurrences | root cause |
|---|---|---|---|---|
| operator-instrument-fault | operator reads a negative/number from a mis-addressed or self-matching probe and declares breakage/landing | 09-05 → 09-22 | ≥40 enumerated instances | negatives have two generators (absent, mis-addressed); no positive control at same address; wrong root/unit/header/clock |
| write-read-mismatch (two roots) | state read from `/workspace/...` decoy while live is under `/workspace/git/super-repo` | 09-05, 09-13 (×3), 09-15, 09-17 (×2), 09-22 | ≥7 | `WORKSPACE_ROOT` differs between unit/env-file/code default |
| sync-deploy-drift | runtime runs stale code, pull-sync reports success, docker cp erased, submodules stale in image | 09-10 → 09-22 | ≥6 | three (four) trees per vessel; mirror converger has no by-effect check |
| hollow-landing / autonomous-regression | green commit that deletes a guard, disables rollback, crash-loops a vessel, or trades away an oracle | 09-10 → 09-22 | `52452e0`, `e76b88c`, `f4bae3c`, `54b7762`, `0d86170`, relevance-sink corruption, 617ed21 | gates read diffs / typecheck; baseline empty = fail-open; semantic gate `on_live_path` ≠ read |
| false-verification | gaps closed on non-evidence / cause-commit / already_resolved; class1 armed when literal present | 09-05 → 09-22 | ≥6 | closure needs land + predicate; predicates authored as `includes()`; guards fail open |
| llm-provider-plane | drafting blocked: keys invalid/placeholder/unfunded, arms cool, shape de-advertised | 09-11 → 09-18 | 4 episodes | dead credentials + shared policy sampling unroutable ids + placeholder keys look configured |
| gap-content / narrowing-duplicates | false-premise gaps spawn 31-gap families; recommit 0.8% land; `-narrowed` children | 09-11 → 09-18 | recurring | gap text mislocalizes; edit_site minted from victim; children inherit pre-correction site |
| calibration-seal / human-surface-escalation | `hopeless()` seals by category; escalations unanswered/truncated | 09-14 → 09-22 | — | seal's only escape posts to a pinned vessel no human reads |
| composition-crystallization | learned pathways not reused: keyed by goal_hash; exemplars write-only; evictions on noise; rebind 0/146 | 09-05 → 09-18 | path-signature keying found 09-05 AND 09-16 | instance key vs signature; grader false-negatives evict |
| goal-walk-floor | floor dark on spokes; `reached:false` null reason on all arrangements | 09-18 → 09-22 | — | dispatch shape registered through channel mirror never reads; URL joiner |
| trace-store-db | 37 GB for 4.6 GB logical; fresh-datastore trace writes 500 | 09-16 → 09-22 | — | deletes don't reclaim; migrations poison inserts on empty store |
| gap-store-integrity | gap store overwritten (95 bytes), NUL-filled (~251 lost), polluted by tests, mass-expired by operator | 09-13 → 09-18 | 4 | single JSON rewritten in place; credited orphan closer; tests touch live store |
| sync-deploy-drift (push credential) | substrate landings stay local | 09-14, 09-18 | 2 | dead PAT; gen-env prefers stale env value |
| dormant-mechanism | built-but-uncalled: exemplar consumer, variant minting, action_no_effect, parallel sibling, v_shape_conditioned_score, state_signature, in-flight re-route arm | 09-11 → 09-17 | many | producers without readers / readers on unused endpoints |
| endpoint-routing | loopback public_endpoint; dead-port discovery row with fresh lastSeen; multiaddr treated as URL | 09-18 | 3 | liveness by heartbeat not socket; advertisement not from caller's view |
| env-gating | `SATISFIER_REUSE_ORDERING_ENABLED`, `RUNTIME_DRIFT_REPAIR`, `EXEMPLAR_SELECTOR_RUN_ON_BOOT`, `MITOSIS_DIRECT_PUSH`, `MAX_PEER_DEPTH`, `PEER_FANOUT_MODE`, inverted env gate in substrate-gap.ts (09-05 deleted) | 09-05 → 09-18 | — | law 1 violations used as operator levers |
| docs-drift | docs annotated with measurements go stale immediately; lifecycle docs prescribe a command the fix now refuses | 09-16, 09-22 | 2 | docs written as readings, not invariants; docs-align loop didn't catch |

---

## 4. Mechanisms seen (status as of the window)

- **operational_state ladder** (dev-vessel `operational-state.ts`, 7 rungs) — live-used 09-10/11; rung 2 was a one-way latch (fixed by windowing `48656e6`). Self-report health, not reach. Later status unknown.
- **validator-liveness-tick.ts** (`scripts/substrate`, `8a3804ff`, 09-10) — reported SEVERED 37/48; later status unknown (script-retention rule applies).
- **rhythm-seed-tick / rhythm-conduct-tick + rhythm-cadence timer** (`22146522`) — bootstrap-tier cadence restoring 11 rhythm bodies after outage.
- **converge_units timer enable** in `substrate-pull-sync.sh` (`7f97df70`) — proved itself on a real convergence 09-10.
- **execution_exemplar** (activity-api) — producer 719 rows; consumer never designed → live-unused.
- **trace_digest dual-write** — fixed on `/v2/activities/executions` 09-12; digests 0→43+.
- **reachedCommandCache** (goal-host `/workspace/.goal-host-reached-commands.jsonl`) — live-used; replay proven 09-18; exact-hit `6eed100`; unconfirmed-vs-disconfirmed `4c5534d`; strike counter `2e8b4cc`; deterministic token oracle `0d86170`+`51b34a6`. Specific to goal-host (not vessel-general).
- **deterministic recompute gate / artifact oracle** — live-used; boundary of crystallization.
- **premise check (PREMISE UNVERIFIED)** `gap-to-feature.ts:799` `9f222fb` — landed 09-13; firing in production unverified in window.
- **phantom-anchor detector (E3)** `e437421`.
- **closeLandedGap / sweepPendingLandVerifications** (`gap-to-feature.ts:1915`, `:2411`) — live-used; needs land signal + predicate absent.
- **autoCloseStaleGaps** (gap_lifecycle_scan, `information_yield==="idle"`) — live-used; expires one-shot work; operator misuse expired 100.
- **hopeless() seal + escalation_disposition_apply + human_exemption_attempts_remaining** — live-used by operator; seal posts to pinned :8270.
- **zero_behaviour_delta gate** + string-only exemption `ede0030` (09-15).
- **delta-aware verify / computeNewlyFailing** — fail-open on empty baseline (deliberate, prevents refusal storm from `70fdab4`).
- **semantic gate + adversarial refuter panel** — fails open when judge unreachable (09-05; `refuseWhenJudgeUnavailable` filed 09-15); refuters confabulated dialect facts (09-22).
- **surqlBreakingFieldRefusal guard** — deleted `54b7762` 09-16, restored `1a18944` 09-22.
- **runtime-drift-tick** — reports divergence, not armed to repair ("pull-sync owns mirroring"); `unmonitored` warning got a reader `76113293`.
- **self-recovery-surreal-wedge-restart** — observed acting autonomously 09-16 20:03 (RSS 22.5→4 GB).
- **self-recovery diagnosis-carrying escalations** `97d71bcb`.
- **trace-retention byte ceiling** `c0b9624`+`3cafd9c` — live-used (9 unattended executions/6h, `boundBy:"rows"` — byte bound never binding).
- **identical-failure-run-tick.ts** — 30 runs found.
- **boredom UCB selector** (`boredom-vessel/src/index.ts:3413`) — live-used; ~98% observation picks.
- **~40 systemd timers (ungraded plane)** — duplicate plane to the pool; fire forever.
- **In-Flight Recovery Loop** (`docs/architecture/sequences/04-improvisation-failure-modes.md:75`) — prescribed; re-route arm unreachable (task 43, blocked on operator decision re `SUBSTRATE_AS_SOFTWARE.md:377` vs `:382`) → dormant.
- **variant minting / checkAndRetireByPosterior** — wired to unused `/executions` endpoint → dormant (zero variants ever).
- **action_no_effect** — consumer wired, producer only a prompt sentence → dormant.
- **resolutionProposal/Action/Refused channel** — doc-only → fossil (notional).
- **parallel sibling dispatch** — 0/108,563 → dormant (and credit rule wrong).
- **v_shape_conditioned_score** — queried live, 0 rows → broken.
- **state_signature** — never written → contextual Thompson degenerates → broken.
- **goal_execution_paths keyed by goal_hash** — live-used, instance-keyed (general seam mis-keyed).
- **universal tool fallback (ReAct floor)** — live on hub, dark on spokes 09-18.
- **federation relay / transport / discovery peer forwarding / FED_TRANSPORT_EGRESS** — live-used after 09-18 hand setup; socat bridge workaround; image stub dep until later.
- **federation_verification_report probe** (moved to `/usr/local/lib/substrate/`) — live-used 09-15; `federation_echo` made undiscoverable.
- **installed.json durable membership + boot reconcile** `337c9226` — validated 09-22.
- **gen-env fresh-deploy detection** — broken for asymmetric mounts (09-17).
- **human-priority 1.5× (`source==="human_reported"`)** — excludes `operator:*` sources (09-18).
- **compose slot allocator cap=1** — live; stale-PID slot (`gap-mu69ndsd`); two slot dirs.
- **composeLessonsBlock / compose_lesson (concept-db)** — live; auth-scope trap (`X-Api-Key` vs `Authorization: ApiKey` → different corpora 4 vs 13); negation blindness leaks banned identifiers (`gap-mu6x0axe`).
- **metamorphic gate probe** (`/home/avi/.claude/jobs/35537c7e/tmp/metamorphic-probe.ts`) — deferred, never dispatched → fossil in job tmp.
- **SUBSTRATE_AS_SOVEREIGN.md** (`e1d6af5c`, 09-16) + refusal gap via `missing-verifier-gap.ts` — expectation doc; refusal-slice dispatch queued.
- **wiring-green-vs-miswired proof** (`validation/reports/wiring-green-vs-miswired-proof/`, 09-15) — relevance-sink `/health` unconditional (`index.ts:111`); all automatic checks green while every write 502.
- **lifecycle acceptance harness** (`validation/reports/lifecycle-audit-fixes-2026-09-22/`, rerun `container-lifecycle-audit-rerun-2026-09-22/` `19b3e668`) — operator harness, 26/26.

---

## 5. Principles distilled from the transcripts

1. A negative is unattributed until a positive control through the same address shows a known-present payload (5+ false alarms 09-16; ~9 more 09-16/17; rule written then violated 09-17).
2. `status`/FAVORABLE/typecheck/landed:true is not evidence; read the diff region (0d86170 traded away an oracle; 617ed21 inert with all gate booleans true).
3. Never quote reach without splitting by author; operator dispatches contaminate the lane's denominator (09-13: 80% vs 0.9–2.6%).
4. A flat line proves nothing if the window starts after the step; a single reading can't distinguish a level from a point on a drain curve (09-13, 09-17).
5. Had the drafter succeeded, I would have manufactured causal evidence — change one thing, pre-register, and verify the counterfactual (09-17 retention duty cycle).
6. Retention is not reclamation — at two nested layers (SurrealDB 37 GB/4.6 GB; Docker.raw 922 G/399 G).
7. Write invariants + failure modes into docs, not measurements/names (user 09-16).
8. A fix can overshoot at the junction it repairs; grep every sibling call site.
9. A writer that pins a peer cannot learn the peer was replaced (escalations to :8270).
10. A gate that fails open on an unmeasured baseline is indistinguishable from green (`computeNewlyFailing`).
11. Information-at-use-time is measurable: supplying `edit_site` moved `predicted_p` 0.5→0.7; dictated diffs land where prose doesn't — but that dependence is itself the gap (law 13).
12. The same finding recurs under new names (path_signature keying 09-05 → 11.9× pooling 09-16; "root cause of everything" twice 09-17/18; push PAT 09-14/09-18; judge fail-open 09-05/09-15).

---

## 6. Honest coverage notes
- All 14 compaction summaries in the three large sessions were read in their Errors/Problem-solving/Pending/Current sections; raw assistant text was read for post-summary windows of 80ab9659 (09-16 21:05 → 09-18 19:31) and all of 7726f8bf, and headlines of faba5acd (09-16), 35537c7e (09-16 20:52 → 09-17), cb2ffd73, 5f47eeb0.
- Not read: tool_result bodies (actual command outputs), subagent sidechains, 35537c7e pre-09-10 detail beyond its 09-05 summary.
- Commit hashes and numbers are as the transcripts state them; I did not re-verify against git or live DB (read-only budget spent on transcripts).
