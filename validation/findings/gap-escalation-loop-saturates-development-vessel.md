# The gap-escalation loop re-processes the same gaps and saturates development-vessel

**Measured:** 2026-09-14, `substrate-live`, host load 2.9 (not a load problem).

## What happens

`development-vessel` reports `ActiveState=active`, `NRestarts=0`, and `/health` answers in
24ms — but pool and gap queries time out or are refused outright:

```
limit 1     000 after 17.4s
limit 50    000 in 0.0001s   (connection refused, not slow)
limit 300   000 in 0.0001s
```

A small `poolImpulse limit:1` had answered in 0.42s minutes earlier, so this is not a
standing capacity limit — it is a saturation that comes and goes.

## The driver is a loop, not a backlog

Counting gap ids in the journal over a four-minute window:

```
139 total route-edit-* mentions
 26 distinct route-edit-* ids
```

Each gap is re-processed about **5.3 times in four minutes** — `[gap-escalation]
pending-verify uiQuestion_write accepted`, `[gap-falsifier] updated …: falsifier=none`,
`[substrate-gap-event-publish] publish successful: 200`, repeatedly, for the same ids.
A backlog being drained would show distinct ids advancing; the same 26 recurring is a
cycle.

## Why it matters beyond the latency

**New gaps cannot be recorded while the substrate is busy re-processing old ones.** A
`substrateGap_write` issued during this window returned no response and did not persist —
verified by reading the id back afterwards and finding nothing. So the learning loop's
throughput problem becomes a learning loop *blindness* problem: the one moment the system
most needs to record a new observation is the moment it cannot.

This also contends with everything else on that vessel, including the federation
verification family's own dispatches, which resolve shapes through it.

## What would settle the cause

- Whether an escalation marks anything durable that prevents re-entry, or whether the
  same gap is eligible again immediately after it is processed.
- Whether `falsifier=none` on every pass means the classifier never converges, so each
  cycle leaves the gap in exactly the state that triggered the previous one.
- Whether the event-publish → nudge → escalate path is re-entrant: a publish that
  triggers a pickup that triggers a publish would produce precisely this signature.

## Not concluded

Whether this predates the federation work or was amplified by it. Several gaps were filed
during this session and each filing triggers a compose nudge, so a contribution cannot be
ruled out from the evidence here — but 26 distinct `route-edit-*` ids is larger than the
number filed, so it is not solely that.
