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

| Vessel | `dev` command | Default port | Hot-reload type | Notes |
|---|---|---|---|---|
| `metabob-activity-api` | `bun run --watch src/index.ts` | 8080 | --watch | SurrealDB + Redis required |
| `discovery-vessel` | `bun --watch run index.ts` | 8080 | --watch | Singleton; restart gap ~1s |
| `identity-vessel` | `bun --hot src/index.ts` | 8787 | --hot | Redis required |
| `activity-dashboard` | `bun --hot src/index.ts` | 3000 | Bun HMR | Proxies to activity-api |
| `react-renderer` | `bun --hot run src/index.ts` | 3000 | --hot | `buildHandler()` pattern |
| `terminal` | `bun --hot src/index.ts` | 9090 (auto) | --hot | `buildHandler()` pattern; MCP stdio unaffected |
| `workbench` | `vite` | 3000 | Vite HMR | Full Vite dev server |
| `minibob` | `bun --watch run index.ts` | 8080 | --watch | CLI + HTTP |
| `concept-db` | `bun run --watch src/index.ts` | 8080 | --watch | |
| `metabob-mcp` | `bun --watch src/index.ts` | stdio | --watch | MCP stdio only |
| `analysis-vessel` | `bun run --watch src/index.ts` | 8080 | --watch | Stateless VesselDaemon; replaced `metabob-analysis-api` (commit `06bd8c04`) |

### Substrate-hosted vessels

These vessels run as systemd units **inside the substrate container** and are not started directly with `bun run dev`. Edit source in `repos/<vessel>/`, then hot-reload via:

```bash
make -C scripts/substrate substrate-restart-<vessel>
# e.g.:
make -C scripts/substrate substrate-restart-goal-host-vessel
make -C scripts/substrate substrate-restart-boredom-vessel
```

| Vessel | Port (in-container) | Role | Notes |
|---|---|---|---|
| `goal-host-vessel` | 8210 | `POST /run-goal` — primary goal dispatch target | Async: returns 202 immediately (commit `ac0d75b5`); minibob + boredom-vessel both POST here |
| `llm-resolver-vessel` | 8220 | `llm_completion` resolver backed by Anthropic SDK | Decouples LLM credentials from other vessels |
| `local-tools-vessel` | 8230 | Filesystem + process resolvers (`BunFileSystemAdapter`, `BunProcessAdapter`) | Lowest blast-radius vessel |
| `ribosome-vessel` | 8240 | Template extraction from execution traces | WebSocket client to activity-api `/ws`; writes via `activityTemplate_update` impulse |
| `boredom-vessel` | — | Systemd timer; POSTs rotating topology-discovery goals to goal-host-vessel | Fires every 30min (commit `536652a4`; was 5min) |
| `development-vessel` | — | Meta-vessel for substrate self-development; 19 shapes, 7 seed templates | Runs as systemd unit; see `repos/development-vessel/` |

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
import { spawnVessel, type VesselHandle } from "@metabob/test-helpers"
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

The activity-api WebSocket broadcaster (`ws://localhost:18081/ws` in the local substrate) carries three event classes that are useful for development tooling:

- **Execution lifecycle events** (`task.started`, `task.completed`, `task.failed`, `tool.call`, `impulse.resolved`, `lifecycle:task:preBinding`, `lifecycle:gap:classified`, `lifecycle:llm:dispatched`) — the same events the workbench uses for its live execution overlay, now available to any subscriber. Subscribe to these to observe goal-host-vessel activity in real time.
- **Vessel registration events** (`vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, `vessel.expired`) — fired by discovery-vessel whenever the registry changes. Subscribe to these instead of polling `/shapes` to detect topology changes reactively.
- **Concept-db internal events** (`concept:created`, `edge:created`) — forwarded onto the bus when concept-db records new knowledge.

Connection pattern (same as the workbench):

```typescript
const ws = new WebSocket("ws://localhost:18081/ws")
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
