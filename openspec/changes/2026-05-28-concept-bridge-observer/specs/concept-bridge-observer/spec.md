# concept-bridge-observer

## Purpose

Bridge `vessel_daemon_resolve`-sourced `task.completed` events into concept-db usage records. Without this bridge, every standalone `POST /resolve` call on a substrate vessel publishes a WS event that concept-db's `ExecutionObserver` correctly drops because the synthesized `impulse_id` and `shape` don't match `extractConceptRefs`'s acceptance criteria. The bridge mints signature-level concepts (one per resolver shape, idempotent) and records usage against them, so substrate-wide concept-derivable observation begins to accumulate per-shape usage statistics.

## Contract

### Subscriber lifecycle

The observer runs in `development-vessel` as a persistent WS subscriber. Started by `startConceptBridgeObserver()` from `repos/development-vessel/src/index.ts` after the vessel's HTTP server binds. Disconnect → exponential backoff capped at 30 s, mirroring `registry-change-observer.ts`. Stoppable via `stopConceptBridgeObserver()` for tests.

### Subscription target

`${METABOB_ENDPOINT}/ws` with `{type: "authenticate", token: METABOB_API_KEY}` handshake. Same handshake as `registry-change-observer.ts`.

### Filter

Event is bridged if and only if:

1. `event.type === "task.completed"`, AND
2. `event.data?.source === "vessel_daemon_resolve"`, AND
3. The event carries at least one `impulse_resolutions[]` entry whose `shape` is in the literal `BRIDGEABLE_SHAPES` set.

`BRIDGEABLE_SHAPES` is a static `Set<string>` in the observer source. Initial members:

```
problem_detection, code_annotation, cpg_query_result,
source_code, code_quality, error_log
```

(The set is intentionally limited to analysis-vessel shapes. Future vessels emit new shapes; expanding the set is a code change subject to review, not a runtime config.)

### Dispatch

For each qualifying `impulse_resolutions[i]`:

1. `POST ${CONCEPT_DB_ENDPOINT}/concepts/upsert-by-signature` with body `{pointer_type: r.shape, shape: r.shape}` and `Authorization: ApiKey ${METABOB_API_KEY}`. Returns `{id: string, created: boolean}`. Server-side idempotent.
2. `POST ${CONCEPT_DB_ENDPOINT}/concepts/${id}/usage` with body:

   ```
   {
     trace_id: data.execution_id,
     outcome: data.success === false ? "failure" : "success",
     latency_ms: r.latency_ms,
     resolver_id: r.resolver_id,
     vessel_id: r.vessel_id,
     source: "vessel_daemon_resolve"
   }
   ```

Both calls are fire-and-forget — `Promise.catch()` logs to console.error and continues. The WS event loop never blocks on HTTP.

### Configuration

`CONCEPT_DB_ENDPOINT` is read from `process.env.CONCEPT_DB_ENDPOINT`, defaulting to `http://127.0.0.1:8260`. Defined in `repos/development-vessel/src/config.ts` alongside `METABOB_ENDPOINT`, `DISCOVERY_ENDPOINT`, etc.

### Logging

- On connection open: `[concept-bridge] connected to ${wsUrl}` (info).
- On dispatch failure: `[concept-bridge] usage record failed for ${shape}: ${error}` (error).
- No success logs (would be too noisy under MCP load).

### Failure modes

| Failure | Behavior |
|---|---|
| WS connect rejects | Reconnect with exponential backoff up to 30 s. |
| WS authenticate rejects | Logged; reconnect loop continues (the broadcaster may auth-check, may not). |
| concept-db `/upsert-by-signature` returns non-2xx | Logged; usage step skipped; event dropped. |
| concept-db `/upsert-by-signature` returns 2xx but no `concept_id` / `id` | Logged; usage step skipped. |
| concept-db `/:id/usage` returns non-2xx | Logged; event dropped. |
| WS message parse fails | Silently skipped. |

No retries. The bridge is best-effort. Subsequent events for the same shape will increment usage normally.

### Idempotency

`upsert-by-signature` is idempotent server-side keyed on `(pointer_type, shape, org_id)`. `usage` is intentionally non-idempotent — each call increments the counter. Repeated WS replays from broadcaster reconnects could inflate usage; activity-api's catchup protocol uses `lastSeenSequence` to prevent this.

## Interaction with concept-db

- The bridge mints **one** concept per shape, not per symbol. Per-symbol concept extraction is deferred to the substrate-authored Part B activity.
- The bridge writes to concept-db via the same auth as any other dev-vessel HTTP call (raw `Authorization: ApiKey`). concept-db's `jwtAuth` middleware resolves the key via identity-vessel `/v1/auth/resolve` and falls through to root-credentials SurrealDB path.
- The bridge does **not** retry concept-db errors. If concept-db is down or its SurrealDB writes are blocked (see `finding_2026_05_28_concept_db_root_signin_blocked`), the bridge dispatches still happen, log the failure, and don't recurse.

## What this spec does NOT cover

- Per-symbol concept fan-out from `problem_detection` payloads. Deferred to the substrate-authored Part B activity. See `proposal.md` and `design.md`.
- Concept-db's runtime SurrealDB auth. Tracked in `finding_2026_05_28_concept_db_root_signin_blocked` and `tasks.md §2`.
- Expanding the autonomous draft palette to include `concept_create_write` / `conceptLink_write`. Deferred — see `tasks.md §3.3`.
