# Dossier: human-surface-escalation

**One line.** When the substrate needs a human, it writes the question to a pinned loopback address (`127.0.0.1:8270`, the replaced stateful-ui-vessel). It counts an HTTP 200 from that store as "asked". So since 06-02 the questions have gone to a store no human opens (node 1), or have thrown on a node where that vessel does not run (node 2). Each fix repaired one side of the exchange (read-back, the executor, the reader, the dedupe, the surface) and left the delivery address and its receipt as they were.

Sources: `classes/human-surface-escalation.json` (38 attempts, 35 problems, 5 claims), raw notes `live-resolvers`, `node2-runtime`, `live-gaps`, `vessel-docs-tooling`, `syzygy`, `memory-*`, `openspec-7/8/9`, `_mech_chunks/02,05,07,39`. Live checks were made by me on 2026-09-29 between about 04:50 and 05:10 UTC, and are marked **[verified 09-29]**.

---

## 1. Timeline (claims marked, with what later showed)

| Date | Event | Claimed | Later |
|---|---|---|---|
| 04-22..05-24 | Surface gen 1: workbench (0 autonomous commits, never deployed) | | superseded |
| 05-23 | `intervention-tracking` spec (operatorIntervention / interventionRefused / interventionRateReport) | | tasks 0/43. Only `interventionRefused` exists (docs-3) |
| 05-30 | obsidian-vessel as concept-db frontend, hardcoded default `127.0.0.1:18260` | | 18/21 code tasks, acceptance probes unchecked; dormant |
| **06-02** | `1f9090e` (dev-vessel, operator) "feat(ui-passthrough): advertise uiPanel_write / uiQuestion_write". **The pinned writer is born:** `STATEFUL_UI_VESSEL_ENDPOINT ?? "http://127.0.0.1:8270"` | | this is the only commit that has ever touched `ui-write-passthrough.ts` **[verified 09-29]** |
| 06-03..06-29 | obsidian dispatchId/executionId confusion (4 fixes). The surface was not in discovery until 06-13 | | surface gen 2 abandoned 08-22 |
| 06-15 | stateful-ui README: "the substrate's face … port 8270" | | still the escalation sink 09-29 |
| 07-01 | G workstream (solicitation_id stamping, expectation-verify detector, `interaction_surface_gap`) | G1.1 landed | G1.2–G4.3 open; compose UNFAVORABLE; dormant |
| 07-13..07-23 | Feedback plane unused; 401 on labels; uiQuestion has no read producer; obsidian-desktop crash-loop 58,875x | | |
| 07-29 | `449949c` gives the narrowed child an id "so chronic-failure escalation actually fires". `7d9e39c` injects in-file endpoint constants as facts | | the constants include the pin, which reinforces it |
| **08-06** | `5a25f9c` "remove a dispatch that could never fire, and make the surviving escalation audible" (baseline: 0 log lines in 7 d) | escalation now audible | "accepted" means the pinned store returned 200, and the log cannot tell that from "a human saw it" |
| **08-07** | `human-surface-stack` + `do-anything-surface` (9ea845d4): one human-surface-vessel on :8310 that inherits the ui* vocabulary. **Claim: stateful-ui-vessel and react-renderer retired** (falsifier 5, design §4) | retired | **never executed.** stateful-ui is still active and writing on 09-29 **[verified]**. The design itself warned on 08-07 that a dark or duplicate producer reads as available |
| 08-07 | `77cf692, 018fd05, fd601c2, b90cdcf`: a human complaint was falsely closed by commit-mention evidence (reopened 3x) | | partial |
| 08-14 | 179/199 escalations hidden by a closed kind allowlist. Six coax goals to add a question read route: 5 refused CAPACITY, 1 refused by the verb whitelist | | failed |
| 08-19 | `3b4f921a` dispatch over p2p as a shape (goalDispatchAsync over the relay) | worked | the general routing primitive existed; escalations never used it |
| **08-28** | 1755 asks in 48 h unreadable. `421052c` "read human answers off the surface they land on" (read side becomes discovery-first). `9cb83d0` disposition executor. **Claim: read-back repaired (outcomes 0→85, answered 0→1)** | repaired | the read side only. The write side stayed pinned |
| 08-29 | `91cc1ff` (substrate), `891304c`, `60722a6`, `be891f3`: escape valve "four links"; hopeless_excluded 79→78 | worked (1 day) | link 4 open; the seal became permanent again by 09-14 |
| 09-06..07 | Human complaint channel contaminated by substrate traffic (351/384) | | |
| 09-11 | ESCALATE for federation-transport only logged, 1071x | | another escalation that ends in a log line |
| 09-12 | goal-host source-aware reach-override latch | worked | human overrides 0→2 in 48 h |
| **09-14** | 175 asks, 3 answered; operator silent 16 days. `d3e1ca2` lifts EDIT_SITE/EXPECTED_LITERAL/VERIFY_SHAPE out of answers. `f169ab1`/`4bffab0` operator-escalation-backlog self-report | worked (12/12 armed 09-15) | the backlog counts asks in the pinned store, so it cannot see that the store is unwatched |
| 09-20 | Baseline: 0/3,977 templates consume ui shapes. `1704850a`/`cbd134e5` consumption increment 1 on human-surface. Gap `operator-escalation-backlog` opened. stateful-ui substrate landings `bfccbaf`, `4670c72`, `1b447c6` repair the replaced vessel | partial | escalations still not written to :8310 |
| **09-22 06:35** | Gap `248-escalations-were-asked-of-a-vessel-no-human-reads` filed (human_reported, edit_site `ui-write-passthrough.ts`, expected_literal `resolveUiWriteTarget`). One draft at 06:41 was refused by the semantic gate: "changes the endpoint but still uses a pinned address" | diagnosed | **never re-picked. `updated_at` is still 09-22 06:43 [verified]** |
| 09-22 | Authoring root bootstrapped for plain-file human-surface (`8a83c8c`..`1dcfd4b`); lifecycle audit fixed UI packaging (`ui_not_built` 503) | | human-surface stayed unauthorable until 09-26 |
| 09-23 | stateful-ui `48493bb` (substrate) | | autonomous effort still spent on the replaced surface |
| **09-25** | Gap `hopeless-gap-escalation-dedupes-in-process-memory…`: 37 re-asks per day per gap. **`03d98c1` (Substrate Autonomous, mitosis) persists the dedupe to `/var/tmp/solicited_gaps.log`** | fixed (narrowed child closed 09-25) | the fix covers the hopeless path only; the pending-verify path is still in memory (gap open). It **marks the gap as asked before delivery**, which on node 2 turns a thrown write into a permanent silent loss **[verified]** |
| **09-26 12:01** | Node 2 (compute profile, stateful-ui masked): first `[gap-escalation] uiQuestion_write THREW … Unable to connect — no human was asked` | | 2873 by 09-29 **[verified]** |
| 09-26 | `fb042e9` human-surface: GitHub remote plus questions index (20 s→5 ms); 48 verified cutovers had been refused at push scope; 94k fake feedback rows from `participation.test.ts`. Gap `orphaned-capability-escalation_disposition_apply` opened (0 activities invoke it) | worked | |
| 09-27 10:55 | Operator answers 7 needs-human panels by writing `uiFeedback_write` to the :8310 journal and running the executor by hand. **13 gaps get `human_disposition=provide_information`** | first dispositions ever applied | all 13 still **open** on 09-29; exemptions spent; 0 closures **[verified]** |
| 09-28 | stateful-ui `b9b5d8d` (substrate landing on the replaced vessel); 794 panels | | |
| 09-29 | This dossier: node 1 re-asks 43 pending-verify gaps up to 30x; node 2 loses every ask | | see §4 |

The same class also appears on the laptop surface (`syzygy`, 09-22→09-29): a loopback-only human-surface on `127.0.0.1:38310` advertises `uiQuestion`/`uiQuestion_write` to the production hub with 0 panels, and nobody watches it. Registration cannot tell a watched surface from a fixture.

## 2. Root causes

1. **The writer addresses a peer by pinned URL, not by shape.** `ui-write-passthrough.ts:25` uses `process.env.STATEFUL_UI_VESSEL_ENDPOINT ?? "http://127.0.0.1:8270"`, and the env var is unset on both nodes **[verified]**. The same pin appears in `docs-decision-deliver.ts:42`, `docs-decision-answer-scan.ts:151`, `compute-state-signature.ts:46`, `solicitation-outcome-scan.ts:38` (as fallback) and `activity-create-variant.ts:639` (allowlist). The drafter seeds teach it: `seed/draft-gap-closing-activity.ts:118` and `seed/draft-activity-from-pattern.ts:138` tell drafted activities to POST `substrateGap_write` to `:8270`, a shape that only development-vessel serves. This breaks law 1 (behaviour gated on an env default) and law 11 / p2p (absence on one node reads as absence).
2. **Supersession was declared but never executed.** The replacement (08-07) was declared in docs, but the unit was never masked on node 1 and it still co-advertises all 8 ui* shapes. On node 2 it *is* masked, so the pinned writer throws. The same fossil fails in opposite ways on the two nodes.
3. **"Accepted" is the store's 200, not a human's exposure.** No check asks whether a surface a human opens rendered the ask. The backlog self-report (`f169ab1`) counts inside the same wrong store, so it reports "unanswered" but never "unwatched".
4. **Read and write are routed asymmetrically.** `solicitation-outcome-scan` (read) tries discovery first (`421052c`), but the write is pinned. Answers therefore loop back only when an operator writes to :8310 by hand, as on 09-27.
5. **Dedupe state lives in process memory, and the persisted fix covered one of three call sites.** `03d98c1` persisted the hopeless path (logging before delivery). The pending-verify and reland paths still use the in-memory set, so they re-ask on every restart (30 restarts in 29 h).
6. **Escalation and disposition are resolver calls, not activities (law 2).** `gap-to-feature` calls the passthrough inline, and `escalation_disposition_apply` is invoked by 0 activities (orphaned gap open). Nothing is traced or graded, so the loop cannot learn that its asks go unanswered or undelivered.
7. **The reader side was unauthorable, and the repair lane starved the fix.** human-surface-vessel had no gitlink or push clone until 09-26 (25 of 47 parked patches targeted its `proxy.ts`). The 248 gap was drafted once and then starved by lane allocation (`compose-lane-allocation-starves-cooled-human-gaps`, 09-22).
8. **The live surface is swamped by test residue.** On node 1, :8310 holds 3,948 solicitations. The shown top 50 are fixtures (`b2s-needs-human-real`, `learnerprobe_*`, `escalation_kind_nobody_invented_yet`), and the by-kind ranking weights have diverged (`gap_needs_human` 2.1e185, `learnerprobe_*` ~1e128) **[verified]**. Even a correctly routed ask would currently sit behind fixtures.

## 3. Why it recurs: the missing shared capability

**Missing: a human-resolver channel addressed by shape, with a delivery-and-consumption receipt.** It would be one `escalate_to_human` activity (graded, traced) that:

- resolves `uiQuestion_write` through discovery on any node over p2p, preferring a surface registered as *watched*;
- writes idempotently, keyed by `(gap_id, gap_state)` in a shared store rather than process memory or `/var/tmp`, and marks an ask as asked only after delivery;
- counts success only on a receipt that the ask is readable on a watched surface;
- routes answers back through the same shape into `escalation_disposition_apply` as a scheduled activity.

**Seam:** the discovery-routed resolve client (the same seam as class `endpoint-routing`) plus the surface registration record (a "watched/human-facing" attribute). Every call site that needs a human (`gap-to-feature` hopeless/pending-verify/reland, docs-decision-deliver, compute-state-signature, seeds) should use this one channel instead of its own URL.

Every attempt listed below repaired a component on one side of this seam. None of them replaced the address with a shape plus a receipt, so the class keeps returning in different forms: 1755 unread (08-28), 175/3 (09-14), 248/0 (09-22), 37 re-asks per day (09-25), 2873 thrown (09-26→), 43 gaps re-asked up to 30x (09-29).

## 4. Current verified state (2026-09-29, both nodes)

- **Node 1 `substrate-live` (standalone).** `stateful-ui-vessel` is **active**. `/workspace/state/ui-panel-store.json` has **794 panels**: created from 08-28 11:51 to 09-28 22:42, **318 created since 09-22**, 16 on 09-28, and 25 updated on 09-29 up to 04:49. The store has **5 feedback records**. Four are answers from 08-28..08-29; the last is the `needs-human-DURABILITY-PROBE` dismiss on **2026-09-16 01:06 UTC** (the `live-resolvers` record said 09-25; my decoding of `receivedAt 1789520787676` gives 09-16). No human answer has reached :8270 since 08-29.
- **Node 1 dev-vessel journal since 09-28 00:00:** 709 `pending-verify uiQuestion_write accepted`, 16 reland, 1 hopeless, across **30 restarts**. **43 distinct pending-verify gaps were re-asked 15–30x each**, so the in-memory dedupe is still live on that path (gap `pending-verification-escalation-dedupes-in-process-memory…` open). `/var/tmp/solicited_gaps.log` has 102 lines.
- **Node 2 `compose2-live` (PROFILE=compute).** `stateful-ui-vessel` is **inactive**. The dev-vessel journal (from 09-26 09:57) holds **2873 `uiQuestion_write THREW … Unable to connect`**, 46 of them on 09-29 (the restart burst at 01:38). Since 09-28: 693 pending-verify, 5 reland and 25 hopeless throws. **229 distinct hopeless gap ids threw.** `/var/tmp/solicited_gaps.log` has **309 lines**: because `03d98c1` appends before delivery, each of these is recorded as asked and will **never be retried**. No human has seen any question raised on node 2.
- **Code** (`/vessels/development-vessel`, both nodes): the pins listed in §2.1 are present (10 non-test `8270` lines on node 2). `STATEFUL_UI_VESSEL_ENDPOINT` is unset in `/etc/substrate/env`, `.substrate-secrets` and the process env on both nodes.
- **Live human surface :8310 (node 1).** `/health` is ok and it advertises 11 shapes including `uiQuestion_write`. `/api/questions`: total **3,948**, unanswered **1,601**, 50 shown, and the shown slice is fixture residue (newest created 09-22 21:54). The `uiPanel_write` journal (`/workspace/git/super-repo/interactor-log`, 20,726 lines, last write 09-27 09:16) contains **0 `needs-human-`/`pending-verify-` ids**: real escalations never reach it. The `uiFeedback_write` journal has 79 needs-human records. 72 are probe or test residue (09-22 21–22h, 09-26). **7 are real operator answers** from 09-27 10:55.
- **Effect of answers.** 13 gaps carry `human_disposition=provide_information` (all 09-27), with exemptions granted and spent. **All 13 are still open; 0 closed** by a human disposition. `orphaned-capability-escalation_disposition_apply` is open (0 activities invoke it). The only application was an operator's manual run.
- **Gap store** (`/workspace/git/super-repo/gaps/gaps.json`, 6279 records). Open: `248-escalations-were-asked-of-a-vessel-no-human-reads` (2 failed attempts, last touched 09-22 06:43), `operator-escalation-backlog` (169/171 unanswered, 09-27), `hopeless-gap-escalation-dedupes…` (parent open; the narrowed child closed 09-25 by `03d98c1`), `pending-verification-escalation-dedupes…`, `a-test-process-posts-escalations-to-the-live-human-surface…`, `runtime-drift-stateful-ui-vessel`, `stateful-ui-heartbeat-rejected-while-registry-still-lists-it`, `human-surface-uiquestion-read-drops-gap-needs-human-panels`. **No gap exists for the node-2 loss (2873)**. The class's worst current form was not detected by the system.
- **Not verified by me:** discovery owner rows for `uiQuestion_write`. Host `:18100` closed the socket and my in-container calls were refused or returned 404. The owner count (3 owners: human-surface, stateful-ui, dev-vessel passthrough) comes from the `live-resolvers` record of 09-28/29, and the 4-row count (incl. human-surface@spoke) from the 09-22 gap summary.

## 5. Every prior attempt at the same capability and why it did not hold

| Attempt | What it did | Why it did not hold |
|---|---|---|
| `1f9090e` 06-02 | Created the passthrough as a pinned URL | This is where the class started. It was correct only while :8270 was the face |
| `5a25f9c` 08-06 | Made the escalation audible (accepted/REJECTED/THREW logs) | A log is not a receipt. "Accepted" = a 200 from the wrong store |
| human-surface-stack / do-anything 08-07 | One surface inheriting the ui* vocabulary "so this could not happen" | The retirement step (falsifier 5) never ran. The writer never re-resolved, and the duplicate producer stayed advertised |
| G workstream 07-01; obsidian-legibility-surface 07-18 | solicitation_id stamping, expectation-verify detector | Dormant, and the surface was replaced under them |
| 6 coax goals 08-14 | Add a question read route to human-surface | CAPACITY (1 directed slot); a non-typechecking draft blocked the clone |
| `421052c` + `9cb83d0` 08-28, `91cc1ff`/`891304c`/`60722a6`/`be891f3` 08-29 | Discovery-first read-back, disposition executor, verb parsing, priority | Read side only. The write address was untouched, so the executor was starved by construction. Held about 1 day |
| `f169ab1`/`4bffab0` 09-14 | Backlog self-report | Measures inside the same pinned store and cannot see "unwatched" |
| `d3e1ca2` 09-14 | Lift predicates from answers | Worked 12/12, then had no input once the operator stopped reading :8270 |
| `1704850a`/`cbd134e5` 09-20 | Consumption link on the :8310 reader | Reader side on the new surface; nothing writes escalations there |
| Gap `248-…` 09-22 (desired `resolveUiWriteTarget`) | Correct diagnosis, filed with edit site and literal | One draft pinned a different address, the semantic gate refused it, and the lane never picked the gap again |
| `03d98c1` 09-25 (substrate) | Persisted dedupe for the hopeless path | One of three call sites; container-local `/var/tmp`; marks before delivery, so it converts node-2 throws into permanent silent loss |
| `fb042e9` 09-26; authoring root 09-22 | Made human-surface authorable and fast | Necessary but not the channel. Escalations still do not target it |
| Operator manual answers 09-27 | 13 dispositions applied | Hand-completed (law 6). 0 closures; the executor is still not scheduled |
| stateful-ui substrate landings 09-20..09-28 (`bfccbaf`, `4670c72`, `1b447c6`, `48493bb`, `b9b5d8d`) | Repaired panel semantics on :8270 | Autonomous effort spent polishing the fossil |

## 6. Keep (reuse, do not re-mint)

- `human-surface-vessel` (:8310) as the one human surface: planContent renderer, questions index `fb042e9`, do-anything box. `stateful-ui-vessel` is a **fossil**: retire it by masking the unit and removing its discovery rows after the writers move.
- `escalation_disposition_apply` with `d3e1ca2` label lift and the bounded `human_exemption_attempts_remaining`. It works when invoked (09-27). It needs an invoking activity, not a rewrite.
- `solicitation-outcome-scan`'s discovery-first read (`421052c`). This is the pattern the writer should copy.
- `hopeless()` seal plus the persisted-dedupe idea from `03d98c1`. Move it to a shared store keyed by `(gap_id, state)`, append after delivery, and cover the pending-verify and reland paths.
- The `operator-escalation-backlog` self-report. Re-point it to count from the watched surface.
- `5a25f9c` three-outcome logging, as the detector input for a delivery receipt.
- Discovery plus p2p shape dispatch (`3b4f921a`) as the general routing primitive.

## 7. Retire condition (measurable, checked continuously, on every node running development-vessel)

The class is retired when **all** of these hold for **7 consecutive days**:

1. `[gap-escalation] … THREW|REJECTED` = **0** per node per day.
2. **Delivery ratio = 1.0.** Every `needs-human-*`, `pending-verify-*` and `reland-*` question id written in the window, on any node, appears in the `uiQuestion` store of a surface registered as watched (human-surface on the hub or reachable over p2p). It must appear within 5 min of the write and rank in its shown slice while unanswered.
3. **Re-ask bound:** at most 1 write per `(gap_id, gap_state)` per 24 h across restarts, on every path.
4. **No pin:** 0 non-test lines matching `127.0.0.1:8270` in `development-vessel/src` (seeds included). `stateful-ui-vessel` is masked on all nodes and has no discovery rows.
5. **Answers take effect without the operator:** `escalation_disposition_apply` is invoked by a scheduled activity (gap `orphaned-capability-escalation_disposition_apply` closed by measurement). Every human answer received in the window yields a `human_disposition` within one scan period, traced.
6. The system itself files a gap within 1 h for any node whose escalations fail to deliver. A regression of condition 2 must be detected without the operator. It was not detected on node 2 in 3 days.

