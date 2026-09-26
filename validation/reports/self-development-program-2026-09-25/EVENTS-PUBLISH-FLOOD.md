# activity-api `/v2/events/publish` flood (2026-09-26, read-only)

**Symptom.** activity-api logged ~230k lines per 30 min at 10:30Z, up from ~35–50k. About 49k of those
were `POST /v2/events/publish` (~27/s), each followed by two per-request auth INFO lines
("API key authenticated", "[auth-cache] hit"). That is ~200k lines per 30 min spent logging a bus
publish that writes nothing to the database.

## Who sends it

| Source | Mechanism | Measured / estimated volume (30 min) |
|---|---|---|
| **goal-host engine** (every walk, every template execution) | `BusForwardingEventSink` (ias-executor `adapters/bus-forwarder.ts`), wrapped in goal-host's `BoundedBusSink` (`goal-host-vessel/src/index.ts` ~14075). One fire-and-forget POST **per engine lifecycle event**. The engine has ~17 emit sites (task pre-binding, task completed, execution succeeded, gap classified, llm dispatched, …) and passes the sink into resolvers. | **bulk (estimate)**: ~580 execution traces/30 min × tens of events each ≈ the ~49k observed |
| development-vessel `substrate-gap.ts` | gap-write events | ~445 (`[substrate-gap-event-publish] publish successful`) |
| ias-executor `hosts/vessel-daemon.ts` | one `task.completed` per daemon resolve | ~82 received by concept-bridge (all analysis-vessel) |
| concept-db `lifecycle/bus.ts`, discovery `event-bus.ts` | low-rate lifecycle | not measurable separately; small |

**Why attribution is indirect.** The route (`activity-api/src/routes/events.ts`) logs neither `type` nor
`source_vessel_id`, and every sender authenticates with **one shared API key** (key_fp `44748e82`
on 52,254 of 52,316 auth lines). So neither the key nor the log names the sender. The per-sender split
above comes from code plus the subscriber-side counts; the goal-host share is inferred as the residual,
not directly counted.

## Is it useful?

WebSocket subscribers found (grep of event-type literals in src):
- ribosome: `task.completed`, `task.started`, `execution.completed`
- development-vessel: `task.completed`, `execution.failed`, `lifecycle.execution.succeeded`,
  `lifecycle.attempt`, `activity.lifecycle`
- boredom: `task.completed`

**No subscriber reads** `lifecycle.task.pre_binding`, `lifecycle.gap.classified` or
`lifecycle.llm.dispatched`, all of which the forwarder publishes. Those are broadcast to every WS
client and dropped: pure waste. Because the type mix is not logged, the wasted **share** is not
measured; it is at least one publish per task (pre_binding) and one per LLM call.

## Smallest fixes (in order)

1. **Demote the per-request auth INFO lines to debug** (activity-api `middleware/auth-cache.ts` ~117
   and the "API key authenticated" site). This removes ~2/3 of the log volume with no behaviour change,
   the same pattern as c641525 (SQL lines).
2. **Log `type` + `source_vessel_id` at debug, and count per type** in `routes/events.ts`
   (e.g. a per-minute INFO summary `{type: count}`), so the mix is measurable instead of inferred.
3. **Forward only subscribed event types.** Give `BusForwardingEventSink` an allowlist read from a
   shape (the set of types subscribers declare), dropping unread lifecycle types at the producer.
   This cuts goal-host's HTTP fan-out and activity-api's per-publish auth and WS broadcast work.
4. Longer term: batch publishes (one POST per N events or per 100 ms), and give each vessel its own
   key so traffic is attributable (the shared key also blocks per-vessel budgets and quarantine).

**Falsifier for 1–3**: activity-api lines/30 min back under ~50k; publish rate falls by the unread
share; ribosome/development-vessel/boredom subscribers still receive every type they read (no change in
concept-bridge `vessel_daemon_resolve received` or ribosome extraction counts).
