# Could the substrate have contained this itself? (2026-09-26)

The main case is the `goal_execution` recursion storm from 05:26 to 07:37Z on 09-26. Two supporting cases:

- the trace-ingest storm on 09-25, from 06:40 to 08:26;
- autonomous landings inside coordinated windows, all day on 09-25.

The operator ended all three by hand. The question here is which parts the system could have done itself.

## 1. The storm, with the signals that already existed

Seed: goal `4827ea1d`, "produce a projectThreadScanReport for folder Substrate/Projects with execute true …". The inferred targets were `[project_thread_scan, goal_execution]`. goal-host resolves `goal_execution` through its **own** `/resolve`, reached via discovery, so each walk spawned a child walk with the same targets.

Earlier seeds of the same goal did not recurse: 18:59 had 1 floor entry, 22:29 had 1, and 02:02 had 0.

| Time (UTC) | What happened | Signal already measurable |
|---|---|---|
| 05:04 | LLM providers begin exhausting | first `marked exhausted`; 369 events by 07:13 |
| 05:26 | root dispatch (operator-style, no tags) fails; recursion starts | floor entries per 10 min: 8 → 35 (05:40) |
| 05:50–06:10 | re-dispatches at 05:51 and 06:18; FAILURE-RECALL retries | floor entries per 10 min: 235 → 301 |
| 06:09 | first `[uf] tool call WITHOUT dispatch id` | 527 per hour, all `tool=walkBudget` |
| 06:42–06:55 | activity-api restarted 4 times for health timeouts; `/health` took 15 s | liveness watchdog (see §2) |
| 06:50–07:00 | peak | 432 floor entries per 10 min; about 66 `/resolve` walks per minute; discovery `/resolve` at 4–5.6 per second |
| 07:04 | hourly check-in | load 25.9 (18.9 over 15 min); activity-api p50 12 s, p90 42 s (was 46–78 ms); 156 duplicate trace writes per 30 min; 144k log lines per 30 min; reach 0/15; 146 gaps opened per hour (2,070 open); surface showed 153 shapes (was ~400) |
| 07:06–07:10 | operator restarts goal-host (4-minute drain; 3 dispatches killed) | `/resolve` walks and floor entries drop to 0 |
| 07:11–07:13 | llm-resolver still running tool loops: 157 completions in 2 min, fallbacks to gpt-5, gemini-2.5-pro and gpt-4o-mini; `all completion providers cooling` | up to 588 id-less shells per minute (callers mapped via `/proc/net/tcp`: llm-resolver ← development-vessel); identity returns 429 to the human surface |
| 07:20 | recursion re-seeded about 10 min after the restart | 91 recursive walks and 1,246 id-less shells per 15 min; surreal at 13 cores; development-vessel holds 81 connections into goal-host |
| 07:35–07:37 | operator stops the container (exit 130, clean) | — |

**Every signal needed to detect this was measurable at least 60 minutes before anyone acted.**
- At 05:50, floor entries per 10 minutes for one goal hash had risen 30-fold.
- From 06:09 there were id-less tool calls at a sustained rate.

No component read these as a runaway.

## 2. What the system did on its own

| Response | Effect |
|---|---|
| Liveness watchdog restarted activity-api 4 times (06:42–06:55) | **Wrong response.** It treated the victim as the cause. Each restart dropped in-flight work, and the load came straight back. |
| Walks filed capability and reach gaps (`reach-gap-project-thread-scan`, `reach-gap-goal-execution`, `gap-projecttodos`, `gap-todo-items-report`, …) | **Amplified the storm.** 146 gaps per hour was write load on the gap store, and each write fired the compose nudge and the falsifier sweep. These were symptoms filed as separate defects, with no single root. |
| FAILURE-RECALL / FEEDBACK-RETRY re-ran the hollow walk | **Re-seeded the storm.** Each retry started a fresh recursive chain. |
| llm-resolver fell back to the next provider on exhaustion | **Amplified spend.** It walked through paid models (gpt-5, gemini-2.5-pro) for work that was itself the fault. |
| llm-resolver's policy writes raced on a single temp path | 157 lost outcome records in 2 minutes, so the model posterior stopped learning while under load. |
| pull-sync re-mirrored goal-host's drifted runtime (07:25) | **Correct.** It detected drift between runtime and clone and repaired it deterministically, with no LLM involved. It is the one component that behaved like the missing brake. |
| The discovery, identity and surface fallbacks | These degraded without raising any alarm: the surface read 153 shapes, and identity returned 429s. |

The supporting cases fit the same pattern:
- **09-25 trace storm.** Retries on the sender turned slow writes into 63% duplicate deliveries. The fix was structural (duplicate check first, then dropping the scheduled rebuild).
- **In-window landings.** A mask on the unit did not reach the pickers running inside the process.

Every one of the three ended only when the operator changed something at the process level: stopping the container, masking units, or restarting a vessel.

## 3. What was missing, by law

| Gap | Law | Why it matters |
|---|---|---|
| **(a) A brake that needs no LLM** | 1, 8 | The storm used up the LLM plane that any drafted repair depends on: from 07:11, every `feature_compose` failed with `llm=false`. The brake has to be deterministic and exist before an LLM is needed. |
| **(b) Lineage on `/resolve`** | 1, 12 | Nothing on the request says "I am a child of goal X at depth N". There's no single-flight per goal hash, no depth cap, and no cancelling children when the parent dispatch ends. The chain outlived its root by about 1.7 hours. |
| **(c) A detector for runaways and amplification** | 6, 7 | Nothing watches walks per root dispatch, floor entries per goal hash, or fan-out ratio. The detectors that did fire filed hundreds of symptom gaps instead of one root gap with an `edit_site`. |
| **(d) Containment as a shape and an activity** | 1, 2, 5 | Every containment step was an operator habit: `systemctl mask`, the keeper script, a restart, `docker stop`. Only `autonomous_pick` exists as a shape, and it only gates new auto-picks. There is no `quarantine` shape for a goal hash or caller that goal-host reads when admitting work, and nothing the boredom selector could pick to contain. |
| **(e) Damping the gap flood** | 7 | While a storm signature is active, detectors should aggregate under one root instead of each minting its own gap. Otherwise the gap triple is corrupted: a close rate over 2,070 junk-inflated gaps means nothing. |
| **(f) Spend awareness** | 1 | Budget is not a shape. llm-resolver cannot tell that a storm is running, so it escalates to paid fallbacks exactly when the work is worthless. |
| **(g) Refusing unattributed work** | 12 | local-tools logged 1,749 id-less shells in an hour and still ran every one. Work with no lineage can't be graded, attributed or cancelled, so it should be refused or quarantined. |

## 4. Proposed control loop

| Step | Owner | Shape it carries | Deterministic? |
|---|---|---|---|
| **Detect** | a development-vessel activity on a 1–5 min rhythm, reading goal-host dispatch and walk counters and local-tools id-less counts | `runawaySignal {goal_hash, caller, fanout, walks_per_root, idless_rate, since}` | yes: thresholds, e.g. walks per root > 20 or floor entries per goal hash per 10 min > 50 |
| **Contain** | goal-host admission and `/resolve`; llm-resolver; local-tools | `quarantine {goal_hash or caller, until, reason}` read at use time: goal-host refuses and cancels matching walks, local-tools refuses id-less shells from quarantined callers, llm-resolver stops paid fallback while any quarantine is active. It expires on a TTL, so it is reversible. | yes |
| **Attribute** | the same activity | one deduped root gap: the `runawaySignal` plus the lineage chain, `edit_site` = the component that re-enters (here goal-host `/resolve` → `rawResolve goal_execution`) | yes |
| **Repair** | the normal compose lane, once the LLM plane is healthy again | the gap's falsifier, as in the check below | the drafting uses the LLM |
| **Release** | the detector | the quarantine expires, or is released once the falsifier passes; the gap is closed by measurement | yes |

**Falsifier for the whole loop.** Replay the `4827ea1d` seed against the guard, then check:
- fewer than 10 floor entries per dispatch;
- no more than one nested `/resolve` per ancestry;
- no walks after the parent dispatch ends;
- no paid-model fallbacks;
- exactly one root gap filed, not hundreds.

## 5. Next steps, by priority

1. **Recursion guard in goal-host** (`repos/goal-host-vessel/src/index.ts`, the `/resolve` handler plus the `rawResolve goal_execution` path).
   - Change: in-process single-flight per goal hash for `goal_execution`; ancestry and depth carried on `/resolve`; cancel children when the parent ends.
   - Needs operator bootstrap as a pre-validated exact edit: the brake has to exist before the LLM is needed.
   - Gap already filed: `a-walk-targeting-goal-execution-resolves-it-through-goal-host-itself…`.
2. **`quarantine` shape plus admission check** (goal-host admission, local-tools shell handler, llm-resolver fallback).
   - Generalize the `autonomous_pick` maintenanceLease into a named, TTL'd hold, which is openspec #59's window-lease generalization.
   - Bootstrap the reader first, as a small operator-validated edit. The writer can then be an ordinary activity.
3. **Runaway detector activity** (development-vessel).
   - Emits `runawaySignal`, files one deduped root gap, and writes `quarantine`.
   - Can land through the substrate once items 1 and 2 exist; it's deterministic.
4. **Refuse unattributed shells** (local-tools).
   - Id-less requests are refused, or run only under an explicit `unattributed_ok` budget.
   - Pairs with goal-host `959519e` (dispatch id in the floor) and development-vessel `d4456d9`/`829f613`.
   - Can land through the substrate.
5. **Budget as a shape for llm-resolver** (`repos/llm-resolver-vessel/src/…`, the fallback chain).
   - No paid fallback while a quarantine or storm signature is active; per-hour spend is readable.
   - Also fix the policy temp-path race (`model-policy.ts:73`; gap filed).
   - Can land through the substrate.
6. **Damping for detectors.** While a `runawaySignal` is active, reach-gap and capability-gap minting aggregates under the root gap. This goes in development-vessel's gap writers.

**The ordering principle.** Items 1 and 2 are the brake. They have to be deterministic and exist before the next storm, because the storm takes away the LLM that the substrate's own repair path needs.
