# The responsibility cycle: architecture landed, chain demonstrated (2026-09-19)

Requirement (operator): transfer noticing, framing, choosing, following
through, and learning — visible as an uninterrupted evidence chain with a
runtime mechanism per arrow, plus detection of the cycle itself stalling.

## Architecture (all four commits substrate-landed via the gate)

1. c6f4c9ca — expectations as impulses: a verified titled-transform reach
   persists memoryNote expectation:<title> {family, operand, expected,
   verified_at, violations}.
2. 84ca65088 — observation loop (development-vessel, 5-min rhythm):
   re-checks each expectation against the LIVE artifact independently of the
   original verdict; orders attention by past violations; on violation files
   its own substrate_detected gap (adjudicator-readable wording) and
   dispatches its own restoration goal; on observed recovery closes its own
   gap and resets the baseline; heartbeats every tick.
3. b7aa62d3 — separation of powers: the WRITER carries violation history
   forward; only the OBSERVER resets it on observed recovery. (Found live:
   the restoration's own reach erased the violation marker before recovery
   could be observed, orphaning the gap — the intervention's consequence
   revised the intervention.)
4. 810c660d — cross-vessel watchdog (goal-host): reads the heartbeat
   impulse; stale -> files gap-expectation-observation-loop-stalled;
   recovered -> closes it. The loop cannot report its own death; a different
   process reports it.

## Evidence chains (hands-off after each probe)

CASE A — natural defect, zero probe: verdict true 20:05:51 -> stale writer
degraded artifact 20:05:53 -> loop's FIRST tick caught it 20:05:55, gap
filed, restoration dispatched -> restored 20:11:55 -> (writer-reset hole
found; fixed b7aa62d3).

CASE B — scorer probe (base64): corrupt 20:30:31 -> VIOLATION 20:30:56
(substrate_detected gap + restoration goal, tags carry the gap id) ->
restored 20:32:03, expectation carries violations=1 -> RECOVERED 20:35:55,
gap self-closed, violations reset, restored_at stamped.

CASE C — authorized change: new verified reach re-baselined the same
artifact (cmVuZXdlZA==) -> subsequent ticks QUIET. Investigation correctly
did not happen; change with matching expectation is not a defect.

CASE D — transfer (lettercount; no family-specific operator code): corrupt
20:42:45 -> VIOLATION #1 20:45:56 -> restoration reached, then the OPEN
fencing defect re-degraded the artifact 14s later -> loop PERSISTED:
violations #2, #3, each with a fresh restoration -> converged, RECOVERED
21:00:55, gap closed, artifact "9". Interruption/recurrence did not erase
the commitment; attention ordering (violations desc) prioritized the
repeat offender.

## Properties scored

- initiates: PARTIAL-YES — detection, framing, goal-dispatch, and closure
  are operator-free at runtime; the machinery itself was operator-specified.
- judges: YES within scope — defect vs authorized change vs healthy (A/B/D
  vs C); noise threshold = byte-compare, no false violation across ~12
  healthy ticks.
- persists: YES — case D, three consecutive violations worked without
  operator help.
- verifies: YES — the observer is independent of the producing verdict and
  falsified it twice (A, D).
- learns: PARTIAL — violation counts persist and order attention;
  procedure-level learning (ribosome extraction of the restoration
  composite) observed (walk-composite ids minted); prevention (fencing root
  fix) still open.
- restraint: YES — healthy ticks write one heartbeat, file nothing (C and
  every quiet tick).
- transfers: YES — case D ran a different family through the same generic
  loop.

Open: fencing root gap (the recurring degrader — the cycle currently
COMPENSATES for it, which is both a demonstration of persistence and a
standing workload); adjudication of scan-filed gaps into the code-repair
lane (the restoration path handles the artifact; the code defect behind
repeat violations still needs the repair lane to pick up the fencing gap).
