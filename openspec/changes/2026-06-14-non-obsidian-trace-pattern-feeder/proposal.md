# Non-obsidian trace-pattern feeder for draft-activity-from-pattern

## Why

`draft-activity-from-pattern` is the real-resolver-chain author — it consumes a
`recurringPatternCluster` and composes a genuine producing chain (unlike the gap
drafter, which emits read→analyse→write-a-Proposal scaffold-clones). It was
**deliberately unwired from the core loop** because its only feeder,
`detect-recurring-pattern`, reads `{{obsidian_vessel_endpoint}}/v1/episodes` —
obsidian-coupled. An external app that may be disconnected must not gate the
self-development loop, so the author had no core-loop source of patterns.

## What changes

- **New resolver `trace_recurring_pattern_scan`**
  (`src/resolvers/trace-recurring-pattern-scan.ts`): deterministic feeder that
  mines the substrate's OWN execution traces. Fetches recent SUCCESS traces,
  groups by output-impulse-shape signature, picks the top signature recurring
  ≥ `minRecurrence`, builds a `recurringPatternCluster` (carrying the
  anti-scaffold `deny_list` + real-topology `topology_hint` from
  `vessel_gap_to_cluster`), writes it to `/workspace/patterns/<id>.json`, and
  dispatches the author. `pattern_id` is a stable FNV-1a hash of the signature
  so the author's `_dispatched.json` dedupe collapses repeat ticks.
- **Self-reference guard**: excludes inner meta-activities (slot-binding /
  validator-dispatch / create-shape-provider-goal), deterministic tick/scan/
  audit wrappers, `gap-closing:*` clones, and ALL `development-vessel:*`
  machinery — normalising the `activity:⟨…⟩` record-ref wrapping first, so the
  feeder cannot detect its own (or the author's) output as a pattern.
- **New seed `detect-recurring-trace-pattern`**: thin single-task wrapper
  (`dispatch: true`), tagged `boredom_target_template` + `light_dispatch_eligible`.
- **Boredom rotation**: added as `goal[45]` across all three parallel arrays
  (text / target-template / cost=cheap) — the non-obsidian replacement for
  obsidian-coupled pattern detection in the core loop.

## Done when

- [x] Three-place rule honoured (resolver + `config.ts` shape + `impulses.ts`
      case); `lint` green (120/120 shape-dispatch agree).
- [x] Per-resolver tests (4) cover: top-signature selection + meta exclusion +
      dispatch; substrate-machinery exclusion incl. wrapped ids (no
      self-reference); below-threshold no-op; stable pattern_id. Full suite no
      regression (35 pre-existing fails unchanged).
- [x] Deployed: dev-vessel + boredom-vessel synced/restarted; template
      re-seeded to activity-api.
- [x] Live: feeder runs deterministically, correctly returns `has_pattern=false`
      when only machinery recurs, and dispatches the author on genuine emergent
      topologies. Boredom autonomously UCB-selected + ran `goal[45]` green.

## Behavioral note

In an infrastructure-dominated substrate the feeder is correct-but-quiet
(`has_pattern=false`) — by design it fires only on emergent, untemplated
recurrent topologies, not on the substrate's own already-templated machinery.
Coverage grows as the substrate does more varied (non-tick) work.

## Follow-on

Richer topology signal: group by full task-graph signature via
`executionTraceWithSignatures` (input→output edges), not output-shape
co-occurrence alone — gives the author a more faithful chain to reproduce.
