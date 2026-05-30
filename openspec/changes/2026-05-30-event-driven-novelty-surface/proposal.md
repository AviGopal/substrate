# Event-driven novelty surface

## Why

Novelty detection in the substrate is **bottom-up and post-hoc**. Pattern
discovery only manifests when downstream consumers poll
(`pattern-miner.ts:1-242`, `minFrequency` default 10), and the substrate's
first-class novelty classifier (`failureModeReport.body.scenarios[].emergence_class:
"reuse" | "new" | "gap"`) is computed by the harness, not by the runtime.

The cost: when a novel shape signature appears at execution time, **no impulse
fires at the moment of novelty**. Workbench can't badge live, drafter can't
react in the moment, and downstream observers (concept-bridge, ribosome,
pattern-miner) have to subscribe to `lifecycle:execution:succeeded` and
re-derive the novelty judgment themselves.

This proposal adds a synchronous novelty signal at the runtime layer so the
"caught and detected" question has an event-time answer instead of a
post-hoc one.

## Empirical motivation (2026-05-30)

- 8-cycle controlled probe ran the same goal-string 3 times across C7/C8/C9
  and produced three different template selections with novel per-(signature,
  template) buckets each time. None of those three traces emitted a
  novelty-class impulse at execution time. The workbench (had it been
  watching) could not have flagged "this signature is OOV" in flight.
- Pattern-miner ran on the trace store at its own cadence and would have
  needed ≥10 traces of a recurring sub-sequence before promoting it. The
  in-flight "this is a novel sub-sequence" event is missing entirely.
- `failureModeReport.emergence_class` exists but only in the harness
  artifact, not the trace stream.

## What changes

1. **Resolver `detect_signature_novelty`** (development-vessel or activity-api):
   on each execution, after the per-`(signature, template)` posterior is
   updated, compares `n_observations` to a freshness threshold (default
   `n ≤ 2`). If novel, returns `{ novelty_class: "fresh" | "rare" |
   "saturated", n_observations, signature, template_id }`. Cheap
   deterministic.

2. **Lifecycle event `lifecycle:execution:novelty`** — emitted alongside
   `lifecycle:execution:succeeded`. Carries the resolver's output. No
   subscribers required; any vessel can subscribe per the existing observer
   pattern.

3. **First-class shape `noveltyImpulse`** — produced by the resolver,
   advertised by activity-api's `/shapes`. Fields:
   `{ trace_id, signature, template_id, n_observations, novelty_class,
   emergence_class? }`. `emergence_class` is optional and only present
   when the harness has separately classified the trace.

4. **Pattern-miner event hook**: `pattern-miner.ts` adds an event-time path
   alongside its poll loop. When a new execution lands and its `(prefix,
   next_template)` count crosses the `minFrequency` threshold for the first
   time, the miner emits `lifecycle:pattern:discovered` with the pattern
   signature, frequency, and member trace ids. Replaces "I'll find this on
   my next poll" with "I just noticed this — react now."

5. **Workbench wiring** — read-side; the live execution overlay subscribes
   to `lifecycle:execution:novelty` and badges per-task with `fresh / rare /
   saturated / reuse`. No backend change needed beyond the new event.

## Out of scope

- Acting on novelty (autonomous probes triggered by fresh signatures).
  That's a follow-up that depends on this proposal + `2026-05-30-info-gain-bonus-on-success/`.
  The "act" step would be a `probe-novel-signature` activity that dispatches
  the second-best Thompson draw on a fresh signature to gather contrast
  evidence — that's another openspec.
- Renaming `failureModeReport.emergence_class`. Keep it as-is; the new
  `noveltyImpulse` is the runtime-event sibling.
- LLM-tier novelty classification ("is this semantically a new behavior?").
  Stays in the harness; this proposal is shape/signature-level only.

## How this validates

Three-step:

1. Dispatch any goal that lands on a previously-unseen
   `(signature, template)` pair. Observe a `noveltyImpulse` with
   `novelty_class: "fresh"` in the trace store within the same execution
   transaction.
2. Dispatch the same goal 12 times in sequence. The 12th trace should carry
   `novelty_class: "saturated"` (n > saturation threshold).
3. Replay a known recurring 3-step sub-sequence 10 times. On the 10th, the
   pattern-miner should emit `lifecycle:pattern:discovered` rather than
   waiting for a poll. The composite template should be minted within seconds
   of the trigger.

## Dependencies

- `posterior-update.ts` — needs to surface `n_observations` post-update so
  the novelty resolver can read it without a separate query.
- `pattern-miner.ts` — needs an `event-time` mode in addition to the poll
  mode. Should preserve the polling fallback for catch-up after restarts.
- Workbench live-overlay subscription mechanism — already shipped per
  CLAUDE.md §5 ("Live execution overlay") for `lifecycle:task:preBinding`
  and `lifecycle:task:completed`.
- Lifecycle bus that supports both `execution:succeeded` and
  `execution:novelty` subscriptions — exists (concept-bridge-observer
  already subscribes cross-vessel).

## Risk

- **Event volume.** Every execution emits a novelty event. On the recent 5-min
  boredom timer with ~12 executions/hour per goal, that's tens of events per
  minute. Mitigation: events are cheap impulses; concept-bridge and ribosome
  already handle this rate from `task.completed`.
- **Classification drift.** The `n ≤ 2 = fresh` threshold is arbitrary. Need
  to expose it as a config and reconsider after a week of observation. Risk
  is low because the consumers (workbench, pattern-miner) can re-classify
  using `n_observations` directly.
- **Race with pattern-miner poll.** Event-time path and poll path could
  emit the same `pattern:discovered` event twice. Mitigation: dedupe by
  `pattern_signature` + recency window in the consumer.

## Companion concepts

- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (the 8-cycle
  finding that demands an event-time novelty signal)
- `openspec/changes/2026-05-30-info-gain-bonus-on-success/` — the symmetric-
  asymmetry proposal that benefits from this signal being available at
  decision time
- `openspec/changes/2026-05-30-trace-to-concept-mining/` — would consume
  `noveltyImpulse` and `lifecycle:pattern:discovered` as input signals
- `openspec/changes/2026-05-30-substrate-gap-lifecycle-event/` (already in
  flight per directory listing) — parallel event-emission proposal for the
  gap side

## Graph-RL framing

This is the substrate's missing **synchronous novelty surface**. Today's
detection is two distinct asynchronous loops (harness emergence_class,
pattern-miner poll). After this change:

- The runtime emits `lifecycle:execution:novelty` at the moment a state
  (signature) is first visited — the substrate's analog of a count-based
  exploration bonus *manifesting as an event*, not just a posterior delta.
- The pattern-miner becomes a synchronous option-discovery surface — when a
  frequent sub-trajectory is identified, the substrate reacts to "I just
  discovered an option" rather than waiting to find it on next poll.
- The workbench gains live novelty-class badging (fresh / rare /
  saturated / reuse), making the substrate's exploration/exploitation
  ratio operator-observable in real time.

Combined with `2026-05-30-info-gain-bonus-on-success/`, the substrate's
exploration discipline becomes both *measured* (event-time novelty) and
*acted on* (count-discounted α-updates) — the two halves of count-based
exploration that have been implicit in the architecture but never
first-class.
