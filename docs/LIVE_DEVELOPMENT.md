# Live Development Guide

Get a vessel running with hot reload in under 5 minutes.

---

## The Development Loop

```
edit source → Bun detects change → handler swapped in-place → test against running vessel → iterate
```

With `--hot`, Bun replaces the HTTP handler without restarting the process. In-flight connections are preserved; the discovery heartbeat keeps ticking; no re-registration gap. With `--watch`, Bun does a full process restart (slower, no state preservation).

```
code change  →  bun --hot  →  handler swap (~50ms, zero downtime)
             →  bun --watch  →  process restart (~1–2s, discovery re-registers)
```

---

## Per-Vessel Dev Commands

### Local dev vessels

These vessels run directly on the host and support `bun --hot` / `bun --watch` development:

The **port** column is the port the vessel binds inside the substrate — the value
its systemd unit pins via `PORT`. A bare `bun run dev` on the host with no `PORT`
set falls back to whatever the repo's own default is, which is *not* always the
fleet port; export `PORT` explicitly if anything else needs to find the vessel.
UI vessels have no fleet unit, so their port is simply their dev-server port.

| Vessel | `dev` command | Port | Hot-reload type | Notes |
|---|---|---|---|---|
| `activity-api` | `bun run --watch src/index.ts` | 8080 | --watch | SurrealDB + Redis/Valkey required |
| `discovery-vessel` | `bun --watch run index.ts` | 8100 | --watch | Singleton; restart gap ~1s. Entry point is `index.ts` at the repo root, not `src/` |
| `identity-vessel` | `bun --hot src/index.ts` | 8101 | --hot | Redis/Valkey required |
| `concept-db` | `bun run --watch src/index.ts` | 8260 | --watch | Concept graph + prose knowledge |
| `analysis-vessel` | `bun --hot src/index.ts` | 8250 | --hot | Stateless VesselDaemon |
| `react-renderer` | `bun run dev:server` | 3000 | --hot | `buildHandler()` pattern. Plain `dev` runs the server *and* a Vite client concurrently |
| `terminal` | `bun --hot src/index.ts` | 9090 (auto) | --hot | `buildHandler()` pattern; MCP stdio unaffected |
| `workbench` | `vite` | 3000 | Vite HMR | Full Vite dev server |

The agent-facing MCP cockpit is **metabob-mcp**, an external MCP server rather
than a vessel in this repo — it speaks stdio, has no port, and is not started or
hot-reloaded by anything here. Drive it through its `mcp__metabob__*` tools.

### Substrate-hosted vessels

These vessels run as systemd units **inside the substrate container** and are not started directly with `bun run dev`. Edit source in `repos/<vessel>/`, then hot-reload via:

```bash
make -C scripts/substrate restart-<vessel>
# e.g.:
make -C scripts/substrate restart-goal-host-vessel
make -C scripts/substrate restart-development-vessel
```

`restart-*` is a **fixed enumerated set of make targets**, not a pattern rule —
each one copies `repos/<vessel>/src` into the container and restarts the unit.
[`SUBSTRATE.md` § *Iteration loop*](SUBSTRATE.md#iteration-loop) lists which
vessels have one. Vessels without a target (including boredom-vessel, which has
`sync-boredom-vessel` and `trigger-boredom-vessel` instead) are restarted
directly:
`docker exec substrate-live systemctl restart <unit>.service`.

| Vessel | Port (in-container) | Role | Notes |
|---|---|---|---|
| `goal-host-vessel` | 8210 | `POST /run-goal` — primary goal dispatch target | Async: returns 202 with a `dispatchId` immediately, so a 202 says the walk *started*, not that it reached. Poll for the verdict. Both the MCP cockpit and boredom-vessel dispatch here |
| `llm-resolver-vessel` | 8220 | `llm_completion` resolver | Decouples LLM credentials from every other vessel. Multi-provider with failover; the rendered per-provider arms (`llm-<id>.service`) run the same source on their own ports |
| `local-tools-vessel` | 8230 | Filesystem, shell, git, and code-editing resolvers | Advertises both shape names (`shellResult`, `fileContent`, `gitDiff`, …) and the tool-name aliases (`shell`, `fs_read`, `code_search`, …) so tool-driven edit routes can resolve them. Lowest blast-radius vessel |
| `ribosome-vessel` | 8240 | Template extraction from execution traces | Persistent auto-reconnecting WebSocket client to activity-api `/ws`; on an authoritative `execution_completed` that reached with all its tasks successful, it dispatches the `ribosome-extract` template through goal-host-vessel's `POST /run-goal` (see `dispatchRibosomeExtract`, gated in `onExecutionCompleted`). The module docblock still describes an older `POST /v2/impulses/resolve` route to activity-api — that path is retired; read the code, not the header |
| `boredom-vessel` | — (no HTTP server) | Long-lived dispatch-pool daemon; selects and dispatches work when the substrate is idle | See *Boredom cadence* below |
| `development-vessel` | 8090 | Meta-vessel for substrate self-development | Owns the `memoryNote` store, the `maintenanceLease`, the detector/tick seed templates, and the failure-mode harness. Shape and template counts are live facts — read them from `registry_query`, not from here |

### Boredom cadence

Boredom is **condition-driven selection, not a fixed interval** — reading a
cadence off a clock is the antipattern the substrate's law on pace exists to
forbid. boredom-vessel runs as a long-lived daemon (`Type=simple`), not a
oneshot tick: each selection pass scores the pool of candidate templates on
learned momentum, input-shape availability, and priority weights folded from
current conditions — open-gap demand, `timeShapedRhythm` due-state, learning-mode
signals — then dispatches winners concurrently up to a slot cap. Throughput is
paced by the pool and by WebSocket completion events, and selection momentum
persists across restarts.

**The static timer is a known gap.** `boredom-vessel.timer` still exists as a
backstop, and the daemon still reads several fixed millisecond intervals from its
unit (minimum dispatch spacing, pool loop period, idle window, exercise and
autopromote periods). Those are clock values, not rhythm shapes: they are frozen
at process start, invisible to traces, and therefore unlearnable. Treat whatever
numbers you find there as a stopgap, read them from the unit rather than from
this document, and express new cadence as a `timeShapedRhythm` impulse the
selector already consumes.

```bash
docker exec substrate-live systemctl cat boredom-vessel.service boredom-vessel.timer
docker exec substrate-live journalctl -u boredom-vessel -f
```

Run `bun run dev:debug` (where available) to include ISO timestamps in hot-reload log lines:

```bash
cd repos/react-renderer && bun run dev:debug
cd repos/terminal       && bun run dev:debug
```

---

## The `buildHandler()` Pattern

Vessels that support zero-downtime hot reload implement a `buildHandler()` function:

```typescript
// Constructs a fresh { fetch, websocket? } object on each call
function buildHandler() { ... }

// Module-level server — created once at startup
const server = Bun.serve({ port: PORT, ...buildHandler() })

// Hot reload: swap the handler without restarting
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    server.reload(buildHandler())
    console.log("[HotReload] Handler swapped")
  })
}
```

`server.reload()` replaces the fetch/websocket handler atomically. Existing WebSocket clients survive the swap.

---

## Test Infrastructure

All vessels share `packages/test-helpers`, a small package with four utilities:

| Export | Description |
|---|---|
| `spawnVessel(opts)` | Starts the vessel as a subprocess, waits for `/health` to return 200 |
| `waitForHealth(url, timeout)` | Polls `url` until 200 or timeout |
| `connectWS(url)` | Connects a test WebSocket client with `send()`, `waitFor(type)`, `messages[]` |
| `fixtures` / `loadFixture(name)` | Pre-built impulse JSON fixtures (`bash_output`, `markdown_document`, etc.) |

### Example: integration test against a live vessel

```typescript
import { spawnVessel, type VesselHandle } from "@avigopal/test-helpers"
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { resolve } from "path"

const VESSEL_DIR = resolve(import.meta.dir, "../../")

describe("react-renderer HTTP API", () => {
  let vessel: VesselHandle

  beforeAll(async () => {
    vessel = await spawnVessel({
      cmd: ["bun", "src/index.ts"],
      cwd: VESSEL_DIR,
      port: 13001,
      env: { DISCOVERY_ENABLED: "false" },
      timeout: 15_000,
    })
  })

  afterAll(() => vessel.stop())

  test("GET /health returns ok", async () => {
    const res = await fetch(`${vessel.baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe("ok")
  })
})
```

`spawnVessel` automatically sets `PORT` and `DISCOVERY_ENABLED=false` in the subprocess environment. Override with `env: { ... }`.

---

## Running Tests Against a Live Vessel

Point tests at an already-running vessel instead of spawning a new one:

```bash
# Terminal 1 — vessel running
PORT=9001 DISCOVERY_ENABLED=false bun run dev

# Terminal 2 — tests against it
VESSEL_URL=http://localhost:9001 bun test tests/integration/
```

Inside the test, read the override:

```typescript
const base = process.env.VESSEL_URL ?? vessel.baseUrl
```

This avoids the ~1s startup overhead in tight iteration cycles.

---

## Config Hot Reload

`react-renderer` watches `config/shape-mapping.json`. Editing the file reloads the mapping and calls `server.reload(buildHandler())` — no process restart:

```bash
# Edit the mapping while dev server is running
echo '{"foo": "bar"}' > repos/react-renderer/config/shape-mapping.json
# Server logs: [ConfigReload] shape-mapping.json reloaded
```

Other vessels can adopt the same `fs.watch` + `server.reload()` pattern for their own config files.

---

## Discovery Registration

Vessels register on startup with a 5-minute TTL and send heartbeats every 2 minutes. The discovery gap on restart is the time between the old process dying and the new one completing registration — typically 1–3 seconds with `--watch`.

With `--hot` and `buildHandler()`, the process never restarts, so the registration gap is zero. Discovery shows the vessel as continuously healthy.

| Reload mode | Discovery gap | State preserved |
|---|---|---|
| `--hot` + `buildHandler()` | ~0ms | Yes |
| `--watch` (process restart) | ~1–3s | No |
| Full stop + start | Up to 5min TTL expiry | No |

---

## WS Bus Subscription for Development

The activity-api WebSocket broadcaster (`ws://localhost:18080/ws` in the local substrate) carries three event classes that are useful for development tooling:

- **Execution lifecycle events** (`task.started`, `task.completed`, `task.failed`, `tool.call`, `impulse.resolved`, `lifecycle:task:preBinding`, `lifecycle:gap:classified`, `lifecycle:llm:dispatched`) — the same events the workbench uses for its live execution overlay, available to any subscriber. Subscribe to these to observe goal-host-vessel activity in real time.
- **Vessel registration events** (`vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, `vessel.expired`) — fired by discovery-vessel whenever the registry changes. Subscribe to these instead of polling `/shapes` to detect topology changes reactively.
- **Concept-db internal events** (`concept:created`, `edge:created`) — forwarded onto the bus when concept-db records new knowledge.

Connection pattern (same as the workbench):

```typescript
const ws = new WebSocket("ws://localhost:18080/ws")
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "authenticate", token: METABOB_API_KEY }))
}
ws.onmessage = ({ data }) => {
  const event = JSON.parse(data)
  // event.type is one of the above
}
```

Goal-host-vessel itself subscribes to `vessel.registered` to reactively register proxy resolvers when a new vessel appears in the registry. Any development vessel that needs to respond to topology changes — registering a proxy resolver, invalidating a cache, updating routing tables — should use this same pattern rather than polling.

---

## Verification Checklist

Before pushing a change:

- [ ] `bun run typecheck` exits with no output (no errors)
- [ ] `bun test` — all unit tests green
- [ ] `bun test tests/integration/` — integration tests green (requires vessel running or spawned by `spawnVessel`)
- [ ] `curl http://localhost:<PORT>/health` returns `{"status":"ok",...}`
- [ ] Hot reload works: edit a route, save, re-`curl` without restarting the dev server
