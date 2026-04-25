# Design: vessel-test-infra-live-dev

## 1. packages/test-helpers

### Package identity

```
packages/test-helpers/
  package.json          name: "@metabob/test-helpers", private: true
  tsconfig.json         extends ../../tsconfig.base.json (if present), or standalone
  src/
    index.ts            barrel: re-exports all public symbols
    spawn.ts            spawnVessel + VesselHandle
    ws-client.ts        connectWS + WSTestClient
    health.ts           waitForHealth
    fixtures.ts         fixtures object + loadFixture helper
    fixtures/           JSON files (one per shape)
```

Declared as a workspace package so vessel repos can reference it as:
```json
"@metabob/test-helpers": "file:../../packages/test-helpers"
```

### spawnVessel

`spawnVessel` uses `Bun.spawn` (not `child_process`) to start the vessel process. It polls `GET /health` with `waitForHealth`, then returns a `VesselHandle`. `stop()` sends SIGTERM and waits for the process to exit (up to 5 s).

```typescript
export interface SpawnOptions {
  cmd: string[]
  cwd: string
  port: number
  env?: Record<string, string>
  timeout?: number   // default 10_000 ms
}

export interface VesselHandle {
  port: number
  baseUrl: string   // `http://localhost:${port}`
  stop(): Promise<void>
}

export async function spawnVessel(opts: SpawnOptions): Promise<VesselHandle>
```

Implementation sketch:
1. `Bun.spawn({ cmd, cwd, env: { ...process.env, PORT: String(port), ...opts.env }, stdio: ['ignore', 'pipe', 'pipe'] })`
2. Call `waitForHealth(baseUrl + '/health', timeout)` — throws if health never returns 200
3. Return `{ port, baseUrl, stop: async () => { proc.kill('SIGTERM'); await proc.exited } }`

No shell interpolation, no magic retries beyond what `waitForHealth` provides.

### waitForHealth

Polls `GET url` every 100 ms up to `timeout` ms. Succeeds on HTTP 200. Rejects with a descriptive timeout error showing last response status (if any). Uses `fetch` directly — no dependencies.

### connectWS

Opens a `WebSocket` (global Bun WebSocket), buffers all incoming messages, exposes `waitFor(type, timeout)` which resolves to the first message with matching `.type`. Messages are stored as parsed objects. `close()` closes the socket cleanly.

```typescript
export interface WSTestClient {
  send(msg: unknown): void
  waitFor(type: string, timeout?: number): Promise<unknown>
  messages: unknown[]
  close(): void
}
```

`waitFor` implementation: if a message with the right type is already in `messages`, resolve immediately. Otherwise, register a one-shot listener on a promise that resolves when the next matching message arrives, with a `setTimeout` guard that rejects with a timeout error.

### Fixture files

Each fixture is a self-contained JSON object matching the shape it represents. Files stored under `src/fixtures/`. The `loadFixture` helper does a synchronous `require()` / `Bun.file().json()` — callers do not need to await. Fixtures represent minimal valid instances of each shape to keep test files small.

| File | Shape |
|------|-------|
| `directory_tree.json` | `directoryTree` |
| `file_list.json` | `fileList` |
| `markdown_document.json` | `markdownDocument` |
| `bash_output.json` | `bashOutput` |
| `ui_component_data_table.json` | `uiComponent` with data-table primitive |
| `ui_component_text.json` | `uiComponent` with text primitive |
| `ui_component_container.json` | `uiComponent` with container + two children |

---

## 2. Hot Reload Pattern (react-renderer)

### Current state

`src/index.ts` builds the Hono app inline and passes it directly to `Bun.serve`. Hot reload via `bun --hot` restarts the module but tears down the server, dropping all WebSocket connections.

### Target state

Extract a `buildHandler()` function that returns the Hono app + WebSocket handlers as a plain object. `Bun.serve` is called once at module init. `import.meta.hot?.accept()` registers a callback that calls `server.reload(buildHandler())` — Bun swaps the fetch handler without stopping the server, preserving WebSocket connections.

```typescript
function buildHandler() {
  const app = new Hono()
  // ... all route registrations ...
  return {
    fetch: app.fetch,
    websocket: { open, message, close, drain }
  }
}

const server = Bun.serve<ClientInfo>({ port: PORT, ...buildHandler() })

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    server.reload(buildHandler())
    console.log('[HotReload] Handler swapped — WebSocket clients preserved')
  })
}
```

### config/shape-mapping.json

New file (initially empty object `{}`). Used by the UI component resolver to override the default shape→primitive mappings. Watched with `Bun.watchFiles`:

```typescript
const watcher = Bun.watchFiles(['config/shape-mapping.json'], (event) => {
  shapeMappingCache = JSON.parse(Bun.file('config/shape-mapping.json').textSync())
  server.reload(buildHandler())
  console.log('[ConfigReload] shape-mapping.json reloaded')
})
```

This allows changing how impulse shapes map to UI primitives without restarting the process.

### dev:debug script

```json
"dev:debug": "DEBUG=true bun --hot src/index.ts"
```

When `DEBUG=true`, the handler logs every hot-reload event and config reload event to stderr.

---

## 3. Discovery Re-registration Analysis

Three cases must be documented and tested:

| Scenario | Gap | Behavior |
|----------|-----|----------|
| Process restart (`bun run start` / pod restart) | ~100 ms startup gap | Old registration expires after 5 min TTL; new process registers immediately on startup; effectively seamless |
| Hot reload (`import.meta.hot.accept`) | 0 ms gap | Process never restarts; heartbeat continues uninterrupted; no new registration needed |
| `bun --watch` restart | ~100 ms gap | Bun kills and restarts the process; same as process restart case |

Tests for the hot-reload case verify that:
1. A connected WS client does not receive a disconnect event during hot reload
2. The `VesselClient.isRunning` remains `true` after reload (heartbeat not interrupted)

---

## 4. Test Layout

### react-renderer unit tests

No vessel process needed — tests import source modules directly.

- `tests/unit/resolver.test.ts` — imports `src/resolvers/ui-component.ts` directly
- `tests/unit/schema.test.ts` — validates Primitive schema with hand-crafted objects
- `tests/unit/primitives.test.ts` — imports individual primitives from `src/primitives/`

### react-renderer integration tests

Use `spawnVessel` to start the vessel on an ephemeral port (e.g. 13001). `beforeAll` starts it, `afterAll` stops it. Tests use `fetch` for HTTP and `connectWS` for WebSocket.

- `tests/integration/http.test.ts`
- `tests/integration/websocket.test.ts`

### terminal MCP integration tests

The MCP server operates on stdio, not HTTP. Tests use `Bun.spawn` to start the terminal vessel in `MODE=stdio` mode, write JSON-RPC request objects to stdin, and read responses from stdout. No `spawnVessel` needed — but `waitForHealth` is not applicable either. Instead, tests spawn the process and send an `initialize` request first to confirm the server is ready.

- `tests/mcp/mcp-server.test.ts`

---

## 5. Not In Scope

- Playwright E2E tests for react-renderer (deferred — requires a DOM)
- Responsive breakpoints or feature flags in workbench
- Helm changes for test-helpers (it is a devDependency only, not deployed)
- Any changes to discovery-vessel, activity-api, or workbench
