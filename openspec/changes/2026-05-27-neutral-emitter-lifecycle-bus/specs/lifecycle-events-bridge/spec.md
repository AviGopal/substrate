# lifecycle-events-bridge

## Purpose

Forward ias-executor-ts engine lifecycle events onto activity-api's WebSocket broadcast bus so any subscribed vessel can react. Today these events fire only on the in-process `EventSink` and reach the workbench through a separate overlay path; no other vessel can subscribe.

## Contract

### Publish endpoint

`POST /v2/events/publish` on activity-api accepts:

```
{
  type: string,              // <source>.<noun>.<verb> form, validated
  source_vessel_id: string,  // emitter identity
  scope?: "broadcast" | "org" | "session",  // default: "broadcast"
  target?: string,           // required when scope=session (sessionId) or org (orgId)
  data: object               // event-type-specific payload
}
```

Response: `200 { accepted: true, ts: number }` on success; `400` on malformed type. Broadcaster failures are logged but never surface as 5xx — lifecycle events are best-effort.

Auth: existing API-key middleware. Standard `Authorization: ApiKey <key>` header.

### Event types emitted by ias-executor-ts engine

The forwarder maps in-process event names to bus event types by replacing `:` with `.` and converting camelCase to snake_case:

| In-process event (engine.ts) | Bus event type |
|---|---|
| `lifecycle:task:preBinding` | `lifecycle.task.pre_binding` |
| `lifecycle:task:completed` | `lifecycle.task.completed` |
| `lifecycle:execution:succeeded` | `lifecycle.execution.succeeded` |
| `lifecycle:execution:failed` | `lifecycle.execution.failed` |
| `lifecycle:gap:classified` | `lifecycle.gap.classified` |
| `lifecycle:llm:dispatched` | `lifecycle.llm.dispatched` |

### Payload contracts

Each event's `data` field carries the same fields as the corresponding in-process event payload. Specifically:

**`lifecycle.task.pre_binding`** — emitted before `canExecuteTask` runs for a task that declares `inputShapes`.

```
data: {
  executionId: string,
  taskId: string,
  templateId: string,
  inputShapes: string[],
  missingShapes: string[],
  currentImpulseIds: string[],
  currentImpulseShapes: string[],
  variables: object,
  parentGoalText?: string,
  parentDepth: number
}
```

**`lifecycle.execution.succeeded` / `lifecycle.execution.failed`** — emitted on terminal execution status.

```
data: {
  executionId: string,
  templateId: string,
  parentExecutionId?: string,
  compositionChain: string[],
  status: "success" | "failure",
  duration_ms: number
}
```

(Subscribers needing the full trace fetch from `/v2/activities/execution-traces/:id`.)

**`lifecycle.gap.classified`** — emitted when the engine detects a missing input shape or unregistered resolver.

```
data: {
  executionId: string,
  taskId: string,
  templateId: string,
  gapType: "missing_input_shapes" | "resolver_not_registered",
  resolverId?: string,
  parentDepth: number
}
```

**`lifecycle.llm.dispatched`** — emitted from the llm-prompt resolver after `{{var}}` interpolation, before the LLM call.

```
data: {
  executionId: string,
  taskId: string,
  renderedPrompt: string,
  inputImpulseIds: string[],
  inputShapes: string[],
  variables: object
}
```

## Behaviour

### Emit semantics

The forwarder is an `EventSink` adapter that wraps an inner sink:

1. Inner sink's `emit()` is called first, synchronously. This preserves all existing in-process subscribers.
2. The forwarder then issues a fire-and-forget HTTP POST to `/v2/events/publish`. No `await` in the calling code path.
3. HTTP timeout: 2 seconds. Failures (timeout, non-2xx, network error) are logged at `warn` level via `console.warn`. They never throw.

This ensures lifecycle events never block engine progression. A failed publish means subscribers may miss the event but execution continues.

### Subscription

WS clients connecting to `wss://{activity-api}/ws` and completing the existing handshake (`{type:"authenticate", token}`) receive these event types alongside the existing `task.*` / `tool.call` / `impulse.resolved` event types.

The wrapped WebSocket message uses the broadcaster's standard envelope:

```
{
  type: "lifecycle.task.pre_binding",
  timestamp: <ms>,
  source_vessel_id: "goal-host-vessel",
  ...data fields flattened at root...
}
```

(Following the existing broadcaster convention of flattening the typed body.)

Subscribers ignore unrecognized event types per the standard "ignore unknown" rule.

### Backward compatibility

- Existing event types (`task.started`, `task.completed`, `task.failed`, `tool.call`, `impulse.resolved`) are unchanged in name and shape.
- Existing subscribers receive everything they receive today.
- Adding the forwarder does not change in-process event semantics for the engine. Engine internals still see events synchronously on their in-process sink.

## Non-requirements

- No event-loss recovery. The bus is fire-and-forget. Durable state lives in the trace store.
- No per-event ACLs in v1. Any subscriber with valid auth receives all broadcast events.
- No event ordering guarantees across types. Within a single execution, events arrive in emit order (HTTP requests serialize); across executions, ordering reflects HTTP scheduling.

## Scenarios

### S1: workbench-equivalent observability via the bus

Today the workbench gets `lifecycle:task:preBinding` via a custom WS overlay. After this change, any vessel that subscribes to activity-api's WS bus and filters by `type === "lifecycle.task.pre_binding"` receives the same information. The workbench overlay can migrate to the bus subscription in a follow-up; this spec does not require it to.

### S2: gap-classified observers

Audit / analyzer vessels can subscribe to `lifecycle.gap.classified` and accumulate gap-frequency statistics across executions without polling the trace store. This enables real-time gap dashboards.

### S3: forwarder publish failure

Activity-api is down for a window of 30 seconds. The forwarder logs warnings on each emit but the engine continues uninterrupted. When activity-api comes back, subsequent events flow normally. The events emitted during the outage are lost — subscribers needing reliability re-derive from the trace store on reconnect.

## Implementation pointers

- Forwarder lives in `repos/ias-executor-ts/src/adapters/bus-forwarder.ts`.
- Publish endpoint lives in `repos/metabob-activity-api/src/routes/events.ts`.
- Tests live alongside each.
