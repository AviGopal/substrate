# Week review: 2026-09-20 → 2026-09-27 (UTC)

Question: over the last week, what work was done each day, and did it help the system
develop itself reliably, cheaply, and with a human surface that tells the truth?

All numbers are read-only queries against the live stores at 2026-09-27 ~06:00 UTC:
the gap store (`/workspace/git/super-repo/gaps/gaps.json`), the `execution` table
(one store: node 2 runs no database and its composes appear here), vessel `origin/dev`
logs on node 1, and llm-resolver `llmSpendSummary` on both nodes.

## Verdict

- **The terminal measure did not improve.** Gaps that the substrate detected itself and
  closed through a verified landing: 3–4 a day on 09-19/20, 0–2 a day since. The spike on
  09-23/24 is almost entirely operator-reported gaps plus withdrawals and supersessions.
  With autonomous picks held since 09-26, no improvement here was possible this week;
  it is the thing the next week has to move.
- **The intermediate measures improved, mostly for directed work.** Directed code-change
  landing (drafted composes that landed) went 7% → ~30% → 50% → 58%. Cheap refusals
  before drafting now exist (98 on 09-26, 20 so far on 09-27, at zero LLM cost).
  Exact-edit goals now bypass the planner: 1 LLM call per compose instead of 2.3, input
  tokens 27k → 5k (n = 4 after 04:28 UTC; mean cost $0.072 → $0.053).
- **Autonomous selection never got good.** Autonomous drafted composes landed at 0–23% on
  every day it ran, and the `adhoc` class landed **0 of 122** all week.
- **Resources went from redline to idle, but spend is not yet small.** Database CPU from
  ~12 cores to idle, template-listing work ~49/min → ~8/min. LLM spend averaged
  **$1.83/h since 00:37 UTC today** ($9.53 on node 1; node 2 ≈ 0), with the last hour at
  $0.16. **$8.09 of the $9.53 has no caller attached.**
- **The human surface was repaired, not continuously verified.** It showed another
  substrate's findings on 09-25, was restored on 09-26, and answers in ~8 ms now; the
  image segmentation and parity pair ran twice, not on a schedule.

## Per day

Composes are drafted only (cheap refusals counted separately); `directed` = edit-intent
goals from operator sessions (`route-edit-*`), `autonomous` = gap picks, `adhoc` = neither.
Verified closures = `landed_verified` or `predicate_verified_*`, by gap source.

| UTC day | vessel commits (substrate / operator) | directed landed | autonomous landed | adhoc landed | refused before draft | verified closures (substrate-detected / operator) |
|---|---|---|---|---|---|---|
| 09-20 | 22 / 8 | — | — | — | 2 | 4 / 2 |
| 09-21 | 2 / 4 | — | — | — | 0 | 0 / 0 |
| 09-22 | 24 / 27 | 4 / 61 (7%) | 0 / 31 | — | 13 | 1 / 0 |
| 09-23 | 66 / 1 | 31 / 103 (30%) | 16 / 121 (13%) | 0 / 12 | 48 | 2 / 9 |
| 09-24 | 92 / 7 | 41 / 141 (29%) | 37 / 158 (23%) | 0 / 22 | 44 | 2 / 11 |
| 09-25 | 110 / 0 | 72 / 145 (50%) | 23 / 122 (19%) | 0 / 27 | 25 | 0 / 0 |
| 09-26 | 64 / 3 | 47 / 186 (25%) | 9 / 115 (8%) | 0 / 55 | 98 | 2 / 0 |
| 09-27 (6 h) | 27 / 1 | 26 / 45 (58%) | held | 0 / 6 | 20 | 0 / 0 |

The `execution` table has 25 rows a day on 09-20/21: it effectively starts on 09-22, so
those days are unmeasured, not quiet.

### What each day did, and whether it helped

**09-20 — human participation baseline; consumption link closed.** The severed link held
and the probe suite went 20 → 43. *Helped the surface*: it is the reason later surface
failures were detectable at all. No measurable effect on self-development.

**09-21 — scalar renderer reachable (35 misrouted impulses → 0).** *Helped rendering
correctness*; no effect on self-development. Quiet day for commits.

**09-22 — the "why can't it author this" day.** Found that authorability is submodule
membership (three resident vessels, including the live human surface, were outside the
loop); the SurQL landing gate wedged by a substrate-authored deletion; the resolve-URL
joiner building invalid URLs for the ReAct floor; 248 escalations sent to a vessel no human
reads; the class-1 arming guard that never fired. *Helped*: each was a structural blocker,
and directed landing rose from 7% (this day) to 30% the next. 27 operator commits: the
most hand-work of the week.

**09-23 — directed flag closed by measurement; memory stores merged.** Directed composes
started landing (31). *Helped* directed reach. Operator-reported verified closures peaked
(9). Substrate-detected closures stayed at 2.

**09-24 — lane deadlock broken; pre-validated exact-edit goals proven.** `staged_base_sha`
was the patched hash, so the drift gate refused every isolated landing; the landed-vs-
expected diff caught a silent revert. `make -n` executed lifecycle lines and destroyed
substrate-live (agents now banned from lifecycle targets). *Helped*: the exact-edit recipe
is the method every landing since has used. Autonomous landing reached its weekly best
(23%).

**09-25 — self-development program started; hourly check-ins.** Seams closed until a graded
streak passed (in-process picks bypassing masks → `autonomous_pick` lease; retried landings
double-applying). Busiest commit day (110 substrate commits) and best directed rate (50%),
but also a redline at 07:42, 66 M execution tokens, and the surface showing another
substrate's empty findings during a restart. *Mixed*: the lease and seam fixes held; the
volume was not matched by closures (0 verified).

**09-26 — the expensive day.** Causal-attempt ledger accepted; container stopped under
load; the database redline traced to template paging; LLM credits exhausted by evening;
autonomous commit 329fc5c wiped rhythm bodies. The user's cost direction produced the
value-per-cost spec. Directed landing fell to 25% and autonomous to 8% while 98 composes
were refused cheaply. *Helped structurally, hurt that day*: this is where cost started to be
measured, and the spec came from it.

**09-27 (to 06:00) — value-per-cost phases 1–3 and part of 4 landed.** Cost accounting
(1.1, 1.2, 1.3, 1.5, 1.6), admission ordered cheapest-first (2.1, 2.2, 2.4, 2.5, 2.6, 2.7),
dispatch termination (3.1–3.3), spend gates (4.1, 4.2), and the DB listing fixes (4b.1, 4b.2).
*Helped*: directed landing 58%, re-drafts ~119 → ~1, DB idle, exact edits verbatim. Not yet
measurable: anything autonomous, since picks are held.

## Seams found by this review

- **Spend reporting was wrong in state.** The 05:30 check-in said "≈ $0.18/h"; that was the
  quietest hour. The day's average is $1.83/h, and 85% is unattributed (`caller: unknown`).
  Correction row appended to CHECKINS.md.
- **`adhoc` composes: 0 of 122 landed all week.** A dispatch class that never lands is the
  first candidate for a pre-draft refusal (the spec's negative-knowledge task 3.4).
- **The watchdog undid the operator hold 55 times.** Every `resolved` gap on 09-25/26 is
  "re-enabled 1 inactive allowlisted timer: funnel-drain": self-repair and the hold undid
  each other. The hold has no shape the watchdog reads.
- **Most closures carry no reason.** 3,461 of 3,510 closed gaps have no `closed_reason`
  (stale sweeps and dedup), so "gaps closed" means nothing without the reason filter.
- **Output tokens drive compose cost.** After 2.7 the remaining single call still wrote
  15k output tokens once ($0.16). The next cost lever is on the output side.

## Caveats

- Closure dates fall back to `updated_at` where no `closed_at` exists, so later edits drift
  them forward; per-day closures are approximate.
- Several levers landed on the same day (09-26/27), so attribution is per day, not per lever.
- Walk reach has no consistent per-day series this week (the check-in definition changed
  three times; goal-host's journal is on node 2); it is left out rather than stitched.
- There is no spend series before 09-26 ~23:00 UTC; before phase 1, compose rows recorded
  zero tokens.

## Next week has to move

1. Substrate-detected gaps closed by a verified landing, per day (terminal measure).
2. Autonomous drafted-landing rate, with autonomy reopened under a small envelope
   (needs 4.0, 4.3, 4.4, 3.5).
3. Spend attributed to a caller (≥ 90%), and $ per verified closure.
4. Surface image + parity on a schedule, not ad hoc.
