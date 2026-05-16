## Why

Vessels in this system currently have no shared test infrastructure. Each vessel either has zero tests or re-implements the same patterns (spawn a process, poll health, connect a WebSocket, compare messages) independently. The react-renderer and terminal vessels — the two lowest-level UI and I/O vessels — have no integration tests at all, making it impossible to verify the WebSocket contract, impulse CRUD semantics, or MCP tool behavior without running the full canary deployment. Meanwhile the hot-reload story for react-renderer is incomplete: `bun --hot` restarts the HTTP handler but drops all WebSocket connections and loses the shape-mapping config on change.

These two gaps compound each other. Without a shared spawner and WS client, writing integration tests is expensive enough that they don't get written. Without integration tests, the hot-reload change cannot be verified automatically.

## What Changes

- Create `packages/test-helpers/` — a shared Bun library providing vessel spawner, WebSocket test client, impulse fixtures, and health poller that any vessel test suite can import
- Add hot-reload pattern to react-renderer: extract handler into `buildHandler()`, use `import.meta.hot?.accept()` to swap the handler without killing WebSocket clients, and watch `config/shape-mapping.json` for config-only reloads
- Document and test the discovery re-registration gap on process restart vs. hot reload
- Write react-renderer unit tests (shape→spec mapping, spec schema validation, primitive composition, unknown-type fallback)
- Write react-renderer integration tests (HTTP CRUD, WebSocket events, state sync, unknown-type graceful degradation) using test-helpers
- Write terminal vessel tests (MCP stdio JSON-RPC, all six tools, checkpoint/rollback) using test-helpers
- Add `dev:debug` script to react-renderer for verbose hot-reload logging

## Capabilities

### New Capabilities

- `shared-vessel-spawner`: `spawnVessel()` starts a vessel subprocess, polls `/health`, returns a `VesselHandle` with `baseUrl` and `stop()` — usable in any vessel's test suite without copy-paste
- `ws-test-client`: `connectWS()` returns a `WSTestClient` that accumulates messages and exposes `waitFor(type)` with a configurable timeout — removes the need for ad-hoc setTimeout chains in integration tests
- `impulse-fixtures`: Static JSON snapshots of `directoryTree`, `fileList`, `markdownDocument`, `bashOutput`, and `uiComponent` family shapes — provides deterministic test inputs without calling a running vessel
- `health-poller`: `waitForHealth(url)` with exponential backoff — small utility used by both the spawner and standalone tests
- `react-renderer-hot-reload`: `buildHandler()` factory + `import.meta.hot?.accept()` integration keeps WebSocket connections alive and re-uses the same `Bun.serve` instance across code changes
- `config-file-watcher`: `Bun.watchFiles()` on `config/shape-mapping.json` triggers handler rebuild without restarting the process
- `react-renderer-unit-tests`: 12 unit tests covering the resolver, schema validation, primitive composer, and unknown-type fallback
- `react-renderer-integration-tests`: 8 integration tests covering HTTP CRUD and full WebSocket event flow using `spawnVessel` + `connectWS`
- `terminal-mcp-tests`: 9 integration tests for the MCP stdio server covering `terminal_spawn`, `terminal_send_input`, `terminal_list`, `terminal_checkpoint`, `terminal_replay`, and `terminal_list` filter modes

### Modified Capabilities

- `react-renderer-dev-scripts`: `dev` script already uses `bun --hot`; after this change it works correctly with the new handler pattern; `dev:debug` added for verbose reload logging

## Impact

**`packages/test-helpers/`** (new package):
- `src/spawn.ts` — vessel spawner + VesselHandle
- `src/ws-client.ts` — WebSocket test client
- `src/fixtures.ts` — fixture loader
- `src/fixtures/` — JSON fixture files
- `src/health.ts` — health poller
- `src/index.ts` — barrel export
- `package.json`, `tsconfig.json`

**`repos/react-renderer/`**:
- `src/index.ts` — add `buildHandler()`, `import.meta.hot?.accept()`, `Bun.watchFiles()`
- `config/shape-mapping.json` — new config file watched for reload
- `package.json` — add `dev:debug` script, add `@metabob/test-helpers` devDependency
- `tests/unit/resolver.test.ts` — 5 unit tests
- `tests/unit/schema.test.ts` — 3 unit tests
- `tests/unit/primitives.test.ts` — 4 unit tests
- `tests/integration/http.test.ts` — 4 integration tests
- `tests/integration/websocket.test.ts` — 4 integration tests

**`repos/terminal/`**:
- `package.json` — add `@metabob/test-helpers` devDependency
- `tests/mcp/mcp-server.test.ts` — 9 MCP integration tests

**Breaking Changes:**
- None. The hot-reload change preserves the existing HTTP and WebSocket API surface. The handler extraction is internal. Existing test files are not modified.
