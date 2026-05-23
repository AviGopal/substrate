# Capability: substrate-explicit-vessels

## Definition

The single-container substrate hosts each of the six vessels listed below as
its own systemd unit. Each vessel registers with discovery-vessel on startup,
advertises a defined set of shapes, exposes a `POST /resolve` endpoint
conforming to the discovery resolver-contract, and responds to `GET /health`
within 1s of receipt.

## Vessel specifications

### goal-host-vessel (port 8210)

- Wraps `GoalHost` from `@avigopal/ias-executor-ts/hosts`.
- Advertises shapes: `goal_execution`, `activity_execution`.
- Exposes `POST /run-goal { goal, parent_execution_id?, composition_chain?, options? }`.
- Threads `parent_execution_id` and `composition_chain` into `ExecuteOptions`.
- Returns `{ execution_id, status }` synchronously; streams further events
  via the activity-api WebSocket.

### llm-resolver-vessel (port 8220)

- Advertises shapes: `llmText`, `llmStructured`, `llmToolCall`.
- Owns `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` — the only vessel that
  reads these env vars.
- Implements `goal_enrichment`, `goal_verification`, `goal_decomposition`,
  `keyword_extraction`, `relevance_scoring`, `orchestration_detection`,
  `impulse_state_analysis`, `llm_impulse_selector`, `tool_selector` resolvers
  behind the advertised shapes.
- Accepts a model override per request (`{ model: 'claude-sonnet-4-...' }`).
- Records token usage and cost in trace metadata.

### local-tools-vessel (port 8230)

- Advertises shapes: `fileContent`, `commandResult`, `gitDiff`, `directoryTree`.
- Wraps `BunFileSystemAdapter` / `BunProcessAdapter`.
- Each vessel host bundles its own BunFileSystem/BunProcess adapter
  in-process; local-tools-vessel is the **advertised** path for cross-vessel
  dispatch (e.g., when another substrate or remote agent asks the substrate
  to read a file).

### ribosome-vessel (port 8240)

- WebSocket client to `activity-api:8080/ws`. Subscribes to `task.completed`
  and `execution:succeeded` events.
- For each successful execution, calls `assembleTemplateFromExecution`
  (re-uses the existing ribosome logic from minibob).
- Writes the extracted template via the `activityTemplate_update` impulse.
- Does NOT advertise any *resolved* shape; it is a lifecycle-listener vessel.

### boredom-vessel (port 8250)

- systemd timer (`OnUnitActiveSec=5min`) triggers a one-shot job that:
  - checks for recent external goal activity in activity-api;
  - if quiet, generates a goal via stratified-goal-generator;
  - POSTs to `goal-host-vessel:8210/run-goal` with
    `options.tags = ["intent:topology_discovery"]`.
- Does NOT advertise any *resolved* shape; it is a driver vessel.

### bootstrap-seeder.service (oneshot)

- Type=oneshot systemd unit, `After=activity-api.service`.
- Reads `SHARED_TEMPLATES` from `@avigopal/ias-executor-ts`.
- POSTs each template via `activityTemplate_update` impulse, keyed on
  template id (idempotent).
- Records applied templates in `init_templates` table mirroring
  `init_migrations`.
- Exits after seeding completes.

## Activity-api advertisement update

- `thompson_posterior` is added to `repos/metabob-activity-api/src/config.ts`
  `discovery.shapes`.
- Account-vs-global scope ordering bug (IAL §9.3) is fixed: global rows are
  fallback, not precedence.
- REST surface `GET /v2/activities/:id/variant-scores` remains for backwards
  compatibility.

## Acceptance

A canary substrate boot is considered acceptable for this capability when:

1. `docker exec substrate systemctl is-active <vessel>.service` returns
   `active` for each of `goal-host-vessel`, `llm-resolver-vessel`,
   `local-tools-vessel`, `ribosome-vessel`, `boredom-vessel`.
2. `bootstrap-seeder.service` shows `inactive (dead)` with `ExecMainStatus=0`.
3. `discovery-vessel:8100/registry/stats` shows all six new vessels (plus the
   pre-existing six) with non-stale heartbeats.
4. `validation/scripts/substrate-explicit-vessels-check.ts` exits 0.
5. The Phase 18.4.7 cross-vessel chain-credit integration test passes.
