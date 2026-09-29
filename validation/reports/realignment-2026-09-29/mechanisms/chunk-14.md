# Mechanisms chunk 14: area "goal-host-vessel"

Input: `classes/_mech_chunks/14.json` (6 rows). I judged them on 2026-09-29 against the live hub
`substrate-live`. The goal-host clone is `/workspace/git/vessels/goal-host-vessel`, HEAD `bc99f91`
(2026-09-28 18:16 UTC), and `src/index.ts` is 17,910 lines. I also checked the `syzygy-local-inventory` container.
All evidence was taken read-only.

## How the evidence was taken

- **Code presence and authorship:** `grep -n` and `git blame` in the live clone. Line numbers below are for HEAD `bc99f91`.
- **Firing:** `journalctl -u goal-host-vessel --since -48h`, 59,124 lines. Counted markers:
  - `Failed to resolve SHA`: 874
  - `recordGoalPath PRECONDITIONS`: 566
  - `[rebind]`: 3,246, with 0 `selected=yes`
  - Verdict tags `deterministic:*`: `verified-registry-count` 8, `unmeasurable-count` 3, `artifact-not-written` 1, and no count-files tag.
  - The rest of the verdict tags came from the edit-intent, code-investigation and transform families.
- **Executions:** SurrealDB `execution` table, 3 days:
  - `ribosome-extract`: 312 `status=success`, 4 failures. `reached` was false on 242 rows and null on 73.
  - `compose-auto-bridge-source_code-to-ribosome-extract`: 355 of 355 failed (`execution_error`).
- **Minting output:** in the `activity` table, the newest `learned-*` row is `learned-composition-websearchresult-to-llmcompletion-to-substrategap`, created 2026-09-22T07:39Z. Nothing has been minted since then.
- **ribosome-vessel journal, 48 h:**
  - `register failed: 400 … unreachable via discovery`: 2,884
  - `extractionEligibilityPolicy unresolved — falling back to literal`: 647
  - `execution_completed … reached=false (durable:ungraded/column-null-ungraded)`: 993
- **Stores:**
  - `/workspace/.goal-host-reached-commands.jsonl` has 10,625 lines and was last written 2026-09-29 04:58.
  - `/workspace/git/super-repo/gaps/auto-draft-decisions.jsonl` has 4,508 lines, last written 05:01. The only reference to it in any live `src` or `scripts` is its writer.
  - `gaps.json` has 3,372 rows with `source=goal_host_auto_draft`.

## Dedupe

| Canonical mechanism | Rows folded in | Siblings outside this chunk |
|---|---|---|
| Landing-SHA probe | `landedShaForGoal` (row 2) | The same job is done by `landedShaForGoalHash` (`:6192`, node-local, needs a FAVORABLE compose report in this container) and `landedCommitForGoal` (`:6293`, `f3ffd7d` 09-27, git-log based). This makes three probes for one question. |
| Reach-to-template mint | "Ribosome extraction" (row 3) | goal-host `mintReachedTrace` (`:6889`), the ribosome-vessel WS heuristic, and `ribosome-extract` activity executions. |
| Deterministic reach oracle | row 0 (16 `verify*Reach` plus `verifyGoalReached`) | ClassRow route-as-data (07-30 `e8caa37`…`b307589`). Only avg-threshold and below-mean moved to it; the rest stayed hand-written. |

Rows 1, 4 and 5 are distinct.

## Verdicts

| # | Mechanism | Verdict | Used now | Live evidence | Discoverability / archive |
|---|---|---|---|---|---|
| 0 | Deterministic `verify*Reach` oracles: 17 functions at `index.ts:1663–3432`, `verifyCountFilesReach:2335`, chained in `verifyGoalReached:3489` | **keep-general** (the seam and the pattern). The hand-written functions merge into ClassRow route-as-data. `verifyEphemerisDistanceReach:1846` is a fossil. | yes, narrow | In 48 h the family itself graded only registry-count ×8, unmeasurable-count ×3 and artifact-not-written ×1. Count-files had **0** verdict tags. It fires only on `(repos\|vessels)/…` paths, and no directory-count oracle exists (validation-other-1). Ephemeris: 6,479 ABSTAINED and 0 graded in 7 d (git-goalhost). The pattern "recompute the answer instead of asking an LLM judge" is what false-verification needs. It has a verdict history since 05-24 (gap-003), and the count-trap stayed hollow on 09-22 because no count oracle covered it. | Discoverable today only as code inside goal-host. Make each oracle a data row (the ClassRow shape: parse, command, compare), so that a hollow cluster over a goal family can mint a new row. CLAUDE.md "wrongness is a goal seed" asks for exactly this. Delete ephemeris to `git` history (`08-16`); it runs on every goal and never grades. |
| 1 | goal-host auto_draft closed-gap writer: `closeAuthoringDecisions` loop at `index.ts:17514–17528`, plus the open-row writer at `17461–17489` | **fossil** (dead code) | no | Both `substrateGap_write` blocks sit **after an unconditional `return;`** (lines 17460 and 17513), so they cannot be reached. The redirect `3d4aa60` (09-22, "auto_draft telemetry was polluting the gap store") replaced them with `auto-draft-decisions.jsonl`, 4,508 lines, still appended today. That JSONL has **no reader**: its writer is the only reference. The 3,372 residual `goal_host_auto_draft` rows (54% of the 6,278 gap-store rows, openspec-8) still distort the gap triple. | Delete both unreachable blocks from `src`; `3d4aa60` keeps them in history. Move the 3,372 residual rows out of `gaps.json` into the telemetry JSONL (runtime state, gitignored). Then either give the JSONL a reader (boredom or auto-draft selection) or stop writing it. `SUBSTRATE_AUTHORING_DECISION_EMIT` is itself an env gate (law 1). |
| 2 | `landedShaForGoal` (`index.ts:28`, `f375f10` 09-12, Substrate Autonomous, called at `:6374` in `recordGoalPath`) | **broken**. Replace it with `landedCommitForGoal`. | yes (fires, always fails) | There were **874 `Failed to resolve SHA … Unauthorized`** in 48 h (5,015 of 5,126 since 09-25 per vessel-docs-tooling). It POSTs `goal_path_sha` to discovery with no auth header. `goal_path_sha` also has **no producer** in any `/workspace/git/vessels/*/src` or in the registry, so fixing auth would only turn the 401 into "no producer". Every goal-path record has carried a null landed SHA for ~17 days, which silently defeats `50f7560` (09-02, "ask git for a late landing before grading"). | Merge into `landedCommitForGoal` (`:6293`). It is git-based, works across nodes, and is already used at `11960`, `12968` and `13403`. Delete `landedShaForGoal`. Class: hollow-landing, write-read-mismatch ("reader of an unserved shape"). Detector: a registry check that every shape a vessel *resolves* has at least one producer. `advertised-shape-coverage-scan` `producer_count` (chunk 07 #11) should run against *consumed* shapes too. |
| 3 | Ribosome extraction: ribosome-vessel, the `ribosome-extract` activity and goal-host `mintReachedTrace:6889` | **broken** (general; needed) | runs, mints nothing | `ribosome-extract` ran 316 times in 3 d, reported `status=success` and was never `reached`. There have been **0 new `learned-*` activity rows since 2026-09-22T07:39Z**. `compose-auto-bridge-source_code-to-ribosome-extract` failed **355 of 355**. Ribosome-vessel registration was rejected **2,884×** in 48 h because discovery `7cc9da4` (09-19) requires non-empty `shapes` and ribosome registers `shapes: []` by design (`ribosome-vessel/src/index.ts:697`). The `extractionEligibilityPolicy` shape is unresolved (647×) and the code falls back to a literal list. `joint-liveness` keeps `severed-joint-ribosome-extraction` and `-ribosome-registered` open with no `edit_site` (timers-readers). This is the 5th recurrence of "ribosome does not mint": `337d223` 06-30, `f88ba8f` 07-31, `8d960a8` 08-13, `ef48012` 08-17. **Correction:** live-activities.md reads "1,459/1,456 ok" as healthy, but the status field is not the evidence. | Fixes: (a) discovery should accept consumer-only registrations (e.g. `consumes:[…]`) instead of failing closed; (b) seed or serve `extractionEligibilityPolicy` as a shape; (c) grade the mint by output (a new `learned-*` row per N reached walks) rather than by exit status; (d) retire the failing `compose-auto-bridge-…-to-ribosome-extract` arm. Class: composition-crystallization. Do not re-mint a new extractor; `mintReachedTrace` is the one to repair. |
| 4 | `tryLexicalRebind` (`index.ts:4119`, called at `8332`) plus the reached-command cache `/workspace/.goal-host-reached-commands.jsonl` | **broken** (general; needed by the middle tier) | yes (runs every walk, never selects) | 3,246 `[rebind]` lines in 48 h, **0 selected**. Typical refusal: `shape-mismatch ×~700` for requested shapes `source_code`, `problem_detection`, `activity_template` and `activity_metrics`. The 10,625-line cache is keyed on `shellResult` (2,570), `project_thread_scan` (398) and similar, so shapes the walk now asks for never match. Where the shape does match (`shellResult`), `store-mismatch` and `scaffold-too-weak` refuse it. History: rebind 0/146 (09-18 trial) and 0/3,456 in 7 d (git-goalhost), with ~12 rebind fixes on 08-08 and threshold lowering 0.5→0.25→0.15. Two pieces of **autonomous residue**: `70e207e1` (09-24) inserted a `PROTECTED_VESSELS` **throw** into this function (4138–4149, a mitosis-cutover concern in the wrong place), and a misplaced `console.log("[rebind] outcome selected=no candidates=0")` runs **before** the loop. 846 of those log lines are false. | Revive as the first/last-mile tier by keying donors on the **shape signature and goal class** rather than the terminal shape. Remove the `70e207e1` insertion and the premature log. Add an evidence gate: the cache should stop being written while selection stays at 0. Class: composition-crystallization / goal-walk-floor. Make it discoverable by registering the rebind as an activity variant the walk selects (law 2), so Thompson can grade it, instead of an ungraded inline tier. |
| 5 | goal-host on the `syzygy-local-inventory` spoke | **fossil** (duplicate of hub goal-host `goal-host-vessel@syzygy-hub` / `substrate-live`) | no | `/workspace/goal-host-dispatches.json` is 2 bytes (`[]`) after 6.4 days. It logged 1,584 `Unable to connect` in the last 24 h (9,172 `failed to register dev-vessel proxies` per syzygy.md). Its LLM is pinned to a masked `127.0.0.1:8220`. It is still advertised to the hub. Fleet fan-out happens only when **no local producer** exists, so a dead local goal-host shadows the network: absence here masks presence elsewhere. | Stop the container and remove its registry advertisement. Keep the compose-based explicit-inventory launch and the idempotence proof method (repeat-up, marker `inventory-proof-v1`) as a timeless guide (the untracked `docs/guides/SYZYGY_LOCAL_SURFACE.md` is the candidate). Archive `inventory-compose.yaml` and `inventory-idempotence.json` under `validation/reports/` with the syzygy shard. Class: node-locality / federation-p2p. The detector should be discovery evicting a vessel whose own dependency registrations fail continuously. |

## Cross-cutting observations for this area

- **Status is not evidence in four of six rows.**
  - The ribosome reports `success` and mints nothing.
  - Rebind logs `selected=no` before it has even looked at a candidate.
  - `landedShaForGoal` fails silently into a null SHA.
  - The auto_draft JSONL is appended with no reader.

  This is the same "silent skip reads as a pass" class as MEMORY.md 09-19 and vessel-docs-tooling §171.
- **Autonomous insertions landed in the wrong functions:** `f375f10` (landedShaForGoal, 09-12) and `70e207e1` (rebind throw, 09-24). The drafter works on fixed line windows of a 17,910-line file (git-goalhost §1). The durable fix for this area is decomposing `index.ts`, not more patches.
- **Existing duplicate landing probes:** reuse `landedCommitForGoal`; do not add a fourth. There are already three.
