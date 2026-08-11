# Round 5 — repairs attempted with clearance, and what is actually proven

Operator cleared reattempting fixes. Four things were done: one code repair landed
and deployed, one operator mitigation applied, three gaps filed, one repair
deliberately not dispatched. This document separates **landed** from **proven**,
because those are not the same and the difference is the whole point.

---

## 1. The ungrounded-reach repair: LANDED and DEPLOYED, NOT YET PROVEN

**The defect.** `isGroundedHonestReach` already detects a bare-LLM reach with no
executed-tool anchor, and the mint path already refuses to learn from it —
`reach->mint: SKIP ungrounded reach … bare-LLM-yes / no executed-tool anchor`.
That verdict was wired **only to the learner**. The caller still received
`reached:true` and the oracle still wrote `verdict=achieved`. Re-measured before
the repair: **7 ungrounded skips in 6 hours, 5 still reporting `reached=true`.**

**The fix** reuses machinery already proven in production rather than minting
anything: the walk already computes `walkGroundedVerdict`, and the block that
handles a prose-over-source goal already calls `universalToolFallback` and prefers
its grounded answer. Three edits let an ungrounded reach take that same path.

Landed as `56a0683`, present in the push clone **and** the deployed tree:

```
5264:  grounded?: boolean;                                   (GoalSeekResult)
8877:    grounded: walkGroundedVerdict,                      (runGoalAsPoolWalk return)
9830:  if ((walk.reached === false || walk.grounded === false || goalIsProseOverSource) …
```

Deployment confirmed by the two-part probe, not by `/health`:
`file_mtime=00:43:02` is **earlier** than `ExecMainStartTimestamp=00:47:14`, so the
running process contains the change.

The semantic gate endorsed it on its merits:

> "adds grounded tracking to GoalSeekResult, propagates it from runGoalAsPoolWalk,
> and uses it to trigger universalToolFallback for ungrounded reaches — directly
> fixing the reach-honesty bug on live, reachable code paths."

### Why I am not claiming it works

I re-ran cap-03 (CSV→JSON), which before the fix returned `reached:true` with a
**null** answer body. It now returns the exact correct JSON array, grader-confirmed,
via `universal_tool_fallback`. That is a real improvement — **but it is not
attributable to this fix.** Reading its walk log, the walk ended hollow and
not-reached, and `walk.reached === false` was *already* a trigger for the fallback
before the change. The new clause only matters when the walk reaches **and** the
reach is ungrounded.

The line that would prove attribution — `PREFERRING grounded universal-tool answer`
— has fired **0 times** since the restart, and there have been **0** ungrounded
skips in that window. n=0 is not evidence of success; it is no evidence at all.

**Status: correct by construction and by the gate's reading, unproven by
measurement.** The honest test is to wait for the population metric — ungrounded
skips that still report `reached=true` should go to zero — over a window with real
traffic, not the twenty minutes since deploy.

### Two grading errors observed, in opposite directions

- The dispatch that landed this fix reported **`reached:false`** for a change that
  landed correctly and deployed. The inverse of wallpaper: a real success graded a
  failure.
- cap-02 (write a regex) went from `reached:true` with no content (wallpaper) to
  `reached:false` with no content (honest failure). An improvement in honesty, but
  it routed via `feature_compose` — the code-*editing* path for "give me a regex" —
  so this is a routing change I cannot attribute to the repair either.

### What made this repair land where two earlier ones failed

Three attempts, and the failures were **mine**, not the drafter's:

1. **Attempt 1** — the drafter placed both edits in exactly the right functions and
   was rolled back by typecheck: `'grounded' does not exist in type
   'GoalSeekResult'`. My spec omitted the interface declaration. The verify gate
   caught it and rolled back cleanly.
2. **Attempt 2** — I added the interface edit but described it prose-style ("after
   the `reached: boolean;` line"). The drafter built a **schematic anchor**,
   searching for `interface GoalSeekResult {` immediately followed by
   `  reached: boolean;`. Those lines are not adjacent — five members sit between
   them — so the op never applied.
3. **Attempt 3** — I supplied **verbatim, uniquely-occurring anchor text** (`  reached:
   boolean;` occurs exactly once at two-space indent) and stated plainly that the
   previous attempt had failed by reconstructing an anchor. All three ops applied,
   the semantic gate passed, and it landed.

**The lesson is about the spec, not the model: give a drafter verbatim anchor text
that you have verified is unique, never a description of where the line is.**

Note this also contradicts my earlier "a corrected re-dispatch is a no-op" finding
in its strong form: three materially different goal texts produced three different
gaps (`route-edit-…:30`, `…:23`, and a third) and three genuinely different
attempts. The line count is part of the hash, so changing the text length yields a
fresh gap. The frozen-summary effect I measured earlier is real but narrower than I
stated — it applies when the re-dispatch hashes to the same gap, not to every retry.

---

## 2. `activity-api` restart churn: mitigated, cause still not hand-fixed

Re-measured: **35 clean external SIGTERM restart cycles in 3 hours**, `NRestarts=0`
throughout, no `start-limit-hit` in that window. So the acute outage has not
recurred, but the churn is ongoing at roughly one restart every five minutes, each
one deregistering and re-registering the trace store from discovery.

Applied a reversible drop-in, verified by effective property rather than by
inducing an outage:

```
DropInPaths=/etc/systemd/system/activity-api.service.d/override.conf
StartLimitIntervalUSec=0     StartLimitBurst=5     StartLimitAction=none
```

Rate-limiting protects nothing here — the unit is not crash-looping — and costs the
only trace store this spoke can reach, since the hub store times out and
`RELAY_MULTIADDR` is empty. Reverse by deleting the file and running
`daemon-reload`.

The cause is gated code and belongs to the substrate: filed as a gap rather than
hand-edited.

---

## 3. Three gaps filed

Previously blocked by the permission classifier; now written and **read back**
(a write returning success is not a row that exists):

| gap id | defect |
|---|---|
| `cutover-restarts-role-excluded-units-unguarded` | step 10's else-branch restarts with a bare `systemctl restart` while its two sibling branches drain-then-defer; it also never consults `is-enabled`, so it restarts role-excluded units |
| `hollow-recovery-suppresses-the-only-producer` | `suppressSatisfierShapes` can empty the producer set, terminating the walk without the floor engaging |
| `registry-inventory-oracle-abstention-narrowed-by-c9faf50d` | the abstention must be the union of the broad path test and the named-directory test |

Each summary describes the **defect**, never the correct state — a summary phrased
as "must stay X" gets closed `already_resolved` by a resolution checker.

---

## 4. The `c9faf50d` forward-fix: specified, not dispatched

The goal text is written and anchored on the function name and verbatim regex text
rather than line numbers (the deployed tree and the stale submodule carry it at
different lines). It was **not** dispatched this round, because `goal-host/index.ts`
had just taken a landing and takes autonomous cutovers built from earlier base SHAs;
dispatching a second edit to the same file immediately risks a stale cutover
clobbering the repair that just landed. It is filed as a gap so the substrate can
pick it up, which is where it belongs.

---

## Status

**Landed and deployed:** the ungrounded-reach repair (`56a0683`), correct by
construction, endorsed by the semantic gate, **not yet proven by measurement**.

**Applied:** the `activity-api` start-limit mitigation, verified by property.

**Filed:** three gaps, all read back.

**Still open:** the `c9faf50d` regression; the cutover's unguarded restart; hollow
recovery emptying the producer set; and the fact that the caller-facing verdict was
observed wrong in *both* directions in a single session — a landed change reported
`reached:false`, and null-bodied walks reported `reached:true`.
