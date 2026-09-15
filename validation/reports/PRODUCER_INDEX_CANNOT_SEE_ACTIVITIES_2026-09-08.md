# The producer index cannot see activities

An authorized intervention: dispatch a goal at a shape the substrate already has an
activity for, and watch what it does.

## What was dispatched

Two dispatches against the same capability, deliberately ordered so that the
selection test ran before the prior was perturbed.

1. A natural-language goal for `uiLegibilityReport` — tests whether the **walk
   selects** the existing arm.
2. The same capability pinned via `target_template_id` — tests whether the **arm
   itself works**, with selection bypassed.

The obsidian panel was down for both. That degrades the content test and leaves the
mechanism test intact; it was left down deliberately rather than started mid-run.

## Finding 1 — the walk files an authoring gap for a capability that exists

The NL goal never bound the arm. Goal-target inference was good
(`inferred_target_shapes: ["ui_legibility_scan", ...]`, confidence 0.9), but the
producer lookup for `uiLegibilityReport` concluded no producer existed and filed
`gap-uilegibilityreport`:

> Capability gap: the goal-walk needs a producer for shape "uiLegibilityReport" but
> no live resolver **or activity** produces it. AUTHOR a resolver that produces ONLY
> the shape "uiLegibilityReport" …

Meanwhile `activity:⟨development-vessel:ui-legibility-audit-tick⟩`, created
2026-07-06, `retired: false`, `deprecated: false`, declares
`output_shapes: ["uiLegibilityReport", "substrateGap"]`.

The summary's claim about activities is not backed by the predicate. In
`repos/goal-host-vessel/src/index.ts` the gap test is
`missingNow.find((s) => !liveNow.has(s))`, and `liveNow` comes from `liveShapes()`,
which is built from the discovery advertised-shapes endpoint unioned with
`fetchPeerRegistryShapes()`. **The activity table is never consulted.**

So the substrate escalated to author a duplicate producer for a shape it has had an
arm for since July — a law-3 violation set up autonomously, caused by an index blind
spot rather than by any decision. **Checked: no compose has picked the gap up yet**
(`[gap-falsifier] created gap-uilegibilityreport: falsifier=none`, no authoring
activity against it since). The violation is staged, not yet committed — which is
also why the fix is time-sensitive: if a duplicate resolver does land, it advertises
`uiLegibilityReport` and masks the very index defect described here.

**Scope of this finding.** It is about the capability-gap predicate — which shapes
count as having a producer — verified by reading the code path. It is *not* a claim
that the arm is invisible to selection: the activity search returned it among 36
candidates, and the walk instead spent five steps on `compose-auto-bridge-*` chains
(the same fleet audited on 09-06 as carrying large posteriors with no execution
rows). Why the arm loses that competition is unestablished here.

The same bug class was already fixed one union-member earlier, for federated peers:

> Peer-federated capabilities are LIVE too … This union is what lets the satisfier
> reach a peer vessel instead of filing an authoring gap for a capability that
> already exists.

Local activities need the identical treatment. Filed as
`liveshapes-ignores-activity-output-shapes`.

**Caution recorded with the fix:** `liveShapes()` has six call sites (satisfier,
bridging, mint governor). Widening it can suppress *legitimate* capability gaps, so
the fix must be verified against genuine `missing_capability` filings not dropping.

## Finding 2 — the arm works; five executions moved nothing

Pinned dispatch `exec_rtamxulg` executed the arm with selection bypassed, traced it,
and graded it, failing only for the environmental reason predicted in advance:

```
execution_error — ui_legibility_scan could not observe the surface:
                  obsidian-vessel unreachable or ui_view empty
```

The trace store holds **five** executions for this activity (2026-09-02, two on
09-06, 09-07, 09-08). The activity row reads:

```
total_executions: 0   successful_executions: 0   failed_executions: 0
thompson_alpha: 1.0   thompson_beta: 1.0   learning_track: "unclassified"
```

Executions exist; counters and posterior are frozen at the uninformed prior. Three
of the five carry `reached: null` — never graded at all. The arm cannot learn from
its own history.

## Finding 3 — a supplied falsifier is discarded — ⚠ RETRACTED 2026-09-09

**The conclusion below is wrong and the cause is now known.** `classifyFalsifier`
reads those fields fine. What discarded them was the **write path**:
`gapFromFlatPointer` returns only seven fields and drops `classification_metadata`
entirely, and MCP `resolve_impulse` merges its pointer **flat**. So the predicate
never reached the classifier.

Controlled contrast, identical gap content, same session:

| write form | result |
|---|---|
| flat `{id, edit_site, expected_literal, …}` | `falsifier: "none"` |
| nested `{gap: {…, classification_metadata: {edit_site, expected_literal}}}` | **`falsifier: "class1"`** |

The gap `liveshapes-ignores-activity-output-shapes` now carries a real class-1
predicate. The original error was mine: I read a `none` stamp as evidence about the
classifier without testing the path the data took to reach it — blaming the reader
for what the writer destroyed.

**Superseded text follows.** The gap was filed twice with `edit_site` and
`expected_literal` set (Class 1b), and the store stamped `falsifier: "none"` both
times. `classifyFalsifier` does not read those fields. Current coverage on the gap store: `none: 637`, `unstamped: 163`,
`class1: 4`, `class2: 8`, `unresolvable: 3` — supplying a predicate by hand does not
escape the 637.

## Instrument errors caught in this run

Four false zeros, none caught by re-reading, all caught by controls:

1. `SELECT … FROM timeShapedRhythm` — **no such table**; rhythms are impulses. A
   nonexistent table returns `count: 0`, not an error.
2. `WHERE type = "timeShapedRhythm"` on `impulse` — the field is `shape`; `type`
   lives inside `pointer`.
3. `WHERE template_id … started_at` on `execution` — the fields are `activity_id`
   and `executed_at`. Caught only because the **denominator** (total executions in
   24h) also came back zero, which is impossible.
4. `WHERE activity_id CONTAINS "legibility"` returned zero while the row existed.
   `CONTAINS` is SurrealDB's *array* operator; strings need `string::contains()`.
   This one produced a published claim — "never selected in two months" — which is
   **retracted**. The truth is five executions with frozen counters, a sharper
   finding than the one it replaced.

The standing rule earns its keep again: **name the denominator, and run a positive
control on the query form before believing any zero.** Here the control was
`string::contains(activity_id, "rhythm") = 26` through the identical operator.

## Held back

Host loadavg was 10.5 rising to 20.1 during this run. The fix for Finding 1 is not
dispatched: with six call sites and a suppression risk, its effect cannot be judged
at this load. The measurement constraint is the reason, not the authorization.

The NL dispatch `bc3780cf` has terminated (failed, `reached: no`, final template
`auto-bridge-code_quality`); it is not looping and is not the source of the load
spike. Its activity-search call was observed timing out at 8.4s under that load,
so the selection behaviour recorded above is itself load-contaminated and should be
re-observed before any conclusion is drawn about *why* the arm lost.
