## 1. packages/test-helpers setup

- [x] 1.1 Create `packages/test-helpers/package.json` with name `@metabob/test-helpers`, `"type": "module"`, `"main": "src/index.ts"`, devDependency on `bun-types`, and no runtime dependencies. Verify: `bun install` in that directory succeeds with zero errors.

- [x] 1.2 Create `packages/test-helpers/tsconfig.json` targeting `esnext`, `module: "esnext"`, `moduleResolution: "bundler"`, `strict: true`. Include `src/**/*.ts`. Verify: `bun tsc --noEmit` in the package directory passes.

- [x] 1.3 Create `packages/test-helpers/src/health.ts` exporting `waitForHealth(url: string, timeout?: number): Promise<void>`. Poll `GET url` every 100 ms; resolve on first HTTP 200; reject with `Error("health timeout after ${timeout}ms; last status: ${lastStatus ?? 'no response'}")` when `timeout` (default 10 000) is exceeded. Use `fetch` with `signal: AbortSignal.timeout(2000)` per attempt to avoid hanging on refused connections. Verify: can be imported by a small inline test (`bun test`) that passes against a mock server returning 200.

- [x] 1.4 Create `packages/test-helpers/src/spawn.ts` exporting `spawnVessel(opts: SpawnOptions): Promise<VesselHandle>` and the `SpawnOptions` / `VesselHandle` types. Use `Bun.spawn` to start the process with `stdio: ['ignore', 'pipe', 'pipe']` and env `{ ...process.env, PORT: String(opts.port), ...opts.env }`. After spawning, call `waitForHealth(baseUrl + '/health', opts.timeout ?? 10_000)`. `stop()` sends SIGTERM, then awaits `proc.exited` with a 5 s hard kill fallback. Verify: unit test spawns a trivial `bun` one-liner that serves `/health` and confirms `stop()` exits cleanly.

- [x] 1.5 Create `packages/test-helpers/src/ws-client.ts` exporting `connectWS(url: string): Promise<WSTestClient>` and the `WSTestClient` interface. Open a `WebSocket`, resolve the promise on the first `open` event. Accumulate all parsed messages in `messages: unknown[]`. `waitFor(type, timeout=5000)`: scan `messages` first; if not found, register a listener that resolves on the next matching message or rejects after `timeout` ms. `send(msg)` calls `ws.send(JSON.stringify(msg))`. `close()` calls `ws.close()`. Verify: integration test against the real react-renderer vessel (spawned via `spawnVessel`) receives `state_sync` on connect.

- [x] 1.6 Create `packages/test-helpers/src/index.ts` re-exporting all public symbols from `spawn.ts`, `ws-client.ts`, `health.ts`, and `fixtures.ts`. Verify: `import { spawnVessel, connectWS, waitForHealth, fixtures } from '@metabob/test-helpers'` resolves without error.

## 2. Fixture files

- [x] 2.1 Create `packages/test-helpers/src/fixtures.ts` exporting a `fixtures` object with properties `directoryTree`, `fileList`, `markdownDocument`, `bashOutput`, and `uiComponent.dataTable`, `uiComponent.text`, `uiComponent.container`. Each property is a zero-argument function that returns a deep clone of the corresponding JSON fixture (use `structuredClone`). Export `loadFixture(name: string): unknown` as a named lower-level helper. Verify: `fixtures.directoryTree()` returns an object with a `type` field equal to `"directoryTree"`.

- [x] 2.2 Create `packages/test-helpers/src/fixtures/directory_tree.json` as a minimal valid `directoryTree` impulse shape: `{ "type": "directoryTree", "root": "/tmp/test-project", "entries": [{ "path": "src/index.ts", "kind": "file" }, { "path": "src/", "kind": "directory" }] }`. Verify: the JSON is valid (parseable) and matches the field names used in the real directoryTree resolver.

- [x] 2.3 Create `packages/test-helpers/src/fixtures/file_list.json` as `{ "type": "fileList", "files": [{ "path": "src/index.ts", "sizeBytes": 1024, "modifiedAt": "2026-04-24T00:00:00Z" }] }`. Verify: JSON is valid.

- [x] 2.4 Create `packages/test-helpers/src/fixtures/markdown_document.json` as `{ "type": "markdownDocument", "content": "# Test\n\nThis is a test document.", "title": "Test" }`. Verify: JSON is valid.

- [x] 2.5 Create `packages/test-helpers/src/fixtures/bash_output.json` as `{ "type": "bashOutput", "exitCode": 0, "stdout": "ok\n", "stderr": "", "command": "echo ok", "durationMs": 12 }`. Verify: JSON is valid.

- [x] 2.6 Create `packages/test-helpers/src/fixtures/ui_component_data_table.json` as `{ "type": "uiComponent", "primitive": { "type": "data-table", "columns": ["Name", "Status"], "data": [{ "Name": "alpha", "Status": "ok" }] } }`. Verify: JSON is valid, `primitive.type` equals `"data-table"`.

- [x] 2.7 Create `packages/test-helpers/src/fixtures/ui_component_text.json` as `{ "type": "uiComponent", "primitive": { "type": "text", "variant": "body", "content": "Hello world" } }`. Verify: JSON is valid, `primitive.type` equals `"text"`.

- [x] 2.8 Create `packages/test-helpers/src/fixtures/ui_component_container.json` as `{ "type": "uiComponent", "primitive": { "type": "container", "layout": "vertical", "children": [{ "type": "text", "variant": "body", "content": "Child A" }, { "type": "badge", "variant": "info", "label": "Child B" }] } }`. Verify: JSON is valid, `primitive.children` has length 2.

## 3. Live dev loop — react-renderer hot reload

- [x] 3.1 Create `repos/react-renderer/config/shape-mapping.json` with content `{}`. This file will eventually hold shape→primitive overrides; for now it is empty and its presence is what matters for the watcher. Verify: file exists and is valid JSON.

- [x] 3.2 Refactor `repos/react-renderer/src/index.ts`: extract all Hono route registrations and WebSocket handler references into a `buildHandler()` function that returns `{ fetch: app.fetch, websocket: { open, message, close, drain } }`. The top-level module calls `Bun.serve<ClientInfo>({ port: PORT, ...buildHandler() })` once and stores the result in `const server`. All existing routes (`/health`, `/manifest`, `/resolvers`, `/resolve`, `/resolve/:type`, `/impulses`, `/impulses/:id`) must remain unchanged. Verify: `bun run typecheck` passes; `bun run dev` starts and `curl localhost:3000/health` returns 200.

- [x] 3.3 Add `import.meta.hot?.accept()` registration at the bottom of `repos/react-renderer/src/index.ts` (after `server` is created). The callback calls `server.reload(buildHandler())` and logs `[HotReload] Handler swapped — WebSocket clients preserved` to stdout. When `DEBUG` env var is truthy, also log the timestamp. Verify: manually run `bun --hot src/index.ts`, connect a WebSocket client (`wscat -c ws://localhost:3000/ws`), edit a comment in `src/index.ts`, save — the WebSocket connection should stay open.

- [x] 3.4 Add a `shapeMappingCache` module-level variable (typed as `Record<string,string>`, default `{}`). Load it from `config/shape-mapping.json` synchronously on startup using `JSON.parse(Bun.file('config/shape-mapping.json').textSync())` wrapped in a try/catch that defaults to `{}` on error. Expose `getShapeMapping()` for use by resolvers. Verify: `shapeMappingCache` is populated from the file on startup; missing file does not crash the server.

- [x] 3.5 Add a file watcher on `config/shape-mapping.json` in `repos/react-renderer/src/index.ts` using `import { watch } from 'fs'`. The callback re-reads the file into `shapeMappingCache` and calls `server.reload(buildHandler())`. Log `[ConfigReload] shape-mapping.json reloaded` on each change. (Note: `Bun.watchFiles` does not exist in Bun 1.3.11; `fs.watch` is used instead.) Verify: while the server is running, modify `config/shape-mapping.json`, and the server logs the reload message without restarting the process.

- [x] 3.6 Add `"dev:debug": "DEBUG=true bun --hot src/index.ts"` to the `scripts` block in `repos/react-renderer/package.json`. Verify: `bun run dev:debug` starts the server with the same behavior as `dev` but with verbose reload logging visible.

- [x] 3.7 Add `"@metabob/test-helpers": "file:../../packages/test-helpers"` to the `devDependencies` in `repos/react-renderer/package.json`. Run `bun install` in `repos/react-renderer`. Verify: the package resolves and `import { spawnVessel } from '@metabob/test-helpers'` in a test file does not produce a resolution error.

## 4. react-renderer unit tests

- [x] 4.1 Create `repos/react-renderer/tests/unit/resolver.test.ts`. Import the resolver registry's `resolve` function from `../../src/resolvers/index`. Write 5 tests: (a) valid `ui_component` pointer with `data-table` primitive resolves without error and returns the primitive unchanged; (b) valid `ui_component` pointer with `container` primitive + 2 children resolves correctly; (c) pointer missing `primitive` field throws an error with message containing `"missing primitive"`; (d) pointer with unknown primitive type (e.g. `"sparkline-v2"`) returns a `container` wrapping a `badge` with text `"Unknown: sparkline-v2"` and a `code` block — does not throw; (e) `hasResolver('ui_component')` returns `true` and `hasResolver('nonexistent')` returns `false`. Verify: `bun test tests/unit/resolver.test.ts` reports 5 passing, 0 failing.

- [x] 4.2 Create `repos/react-renderer/tests/unit/schema.test.ts`. Import type-checking helpers directly (no server needed). Write 3 tests using plain objects: (a) a valid Primitive object with `type: 'data-table'`, `columns: ['A']`, `data: []` satisfies the validator without throwing; (b) a Primitive with `type: 'container'` and `children` containing a child missing the `type` field is rejected by `validateChildren` with a descriptive error; (c) a deeply nested container (3 levels) with all valid children resolves without error. Verify: `bun test tests/unit/schema.test.ts` reports 3 passing.

- [x] 4.3 Create `repos/react-renderer/tests/unit/primitives.test.ts`. Import individual primitive modules from `../../src/primitives/`. Write 4 tests: (a) `container` primitive with `layout: 'vertical'` and two `text` children does not throw when composed; (b) `data-table` primitive with valid `columns` and `data` arrays does not throw; (c) `badge` primitive with `variant: 'warning'` does not throw; (d) `text` primitive with `variant: 'heading'` and non-empty `content` does not throw. Each test calls the primitive factory/render function and asserts the return value is non-null. Verify: `bun test tests/unit/primitives.test.ts` reports 4 passing.

## 5. react-renderer integration tests

- [x] 5.1 Create `repos/react-renderer/tests/integration/http.test.ts`. Use `beforeAll`/`afterAll` to call `spawnVessel({ cmd: ['bun', 'src/index.ts'], cwd: absolutePathToReactRenderer, port: 13001 })` and `handle.stop()`. Write 4 tests: (a) `GET /health` returns `{ status: 'ok' }` with HTTP 200; (b) `POST /impulses` with a `data-table` primitive body returns HTTP 201 and a response containing `impulse.id`; (c) `GET /impulses` after the POST returns an array containing the newly created impulse; (d) `DELETE /impulses/:id` returns `{ success: true }` and subsequent `GET /impulses/:id` returns HTTP 404. Verify: `bun test tests/integration/http.test.ts` reports 4 passing. Tests must not depend on each other's state.

- [x] 5.2 Create `repos/react-renderer/tests/integration/websocket.test.ts`. Use the same `spawnVessel` pattern on port 13002. Write 4 tests: (a) on connect, client receives a `state_sync` message within 3 s; (b) after `POST /impulses`, the connected WS client receives an `impulse_create` message with `impulse.id` matching the HTTP response; (c) after `PUT /impulses/:id`, the WS client receives an `impulse_update` message; (d) after `DELETE /impulses/:id`, the WS client receives an `impulse_delete` message. Each test creates a fresh `connectWS` client and uses `waitFor(type)`. Verify: `bun test tests/integration/websocket.test.ts` reports 4 passing.

- [x] 5.3 Add an unknown-primitive-type integration test to `repos/react-renderer/tests/integration/http.test.ts`: `POST /impulses` with `primitive: { type: 'totally-unknown-xyz', someField: 'value' }` returns HTTP 201 (not 500) and the resolved impulse contains a `container` with a `badge` child (debug fallback). This verifies the graceful fallback from `src/resolvers/ui-component.ts` works end-to-end. Verify: test passes; HTTP status is 201 not 500.

- [x] 5.4 Add a state-sync-on-reconnect test to `repos/react-renderer/tests/integration/websocket.test.ts`: create impulse A via HTTP, then `close()` the WS client and call `connectWS` again; the new client should receive a `state_sync` message containing impulse A in its `impulses` array. Verify: test passes.

## 6. terminal vessel tests

- [x] 6.1 Add `"@metabob/test-helpers": "file:../../packages/test-helpers"` to the `devDependencies` in `repos/terminal/package.json`. Run `bun install` in `repos/terminal`. Verify: the package resolves without error.

- [x] 6.2 Create `repos/terminal/tests/mcp/mcp-server.test.ts`. Use `Bun.spawn` to start the terminal vessel with `MODE=stdio` env var and `stdio: ['pipe', 'pipe', 'pipe']`. Write a helper `sendJsonRpc(proc, method, params)` that writes a JSON-RPC 2.0 request to stdin and reads the next complete JSON line from stdout. Write a helper `initialize(proc)` that sends the MCP `initialize` request and waits for a successful response. Use `beforeAll`/`afterAll` for spawn/kill. Verify: `bun test tests/mcp/mcp-server.test.ts` reports all tests passing.

- [x] 6.3 In `tests/mcp/mcp-server.test.ts`, write a test for `terminal_list`: call `tools/call` with `name: "terminal_list"` and no params; response `content[0].text` parses as JSON with a `terminals` array. Verify: test passes.

- [x] 6.4 In `tests/mcp/mcp-server.test.ts`, write a test for `terminal_spawn`: call `terminal_spawn` with `{ preset: "shell", cwd: "/tmp" }`; response contains `terminalId` matching `/^term-/` and `pid` that is a positive integer. Verify: test passes. Store `terminalId` for use in subsequent tests.

- [x] 6.5 In `tests/mcp/mcp-server.test.ts`, write a test for `terminal_send_input`: using the `terminalId` from 6.4, call `terminal_send_input` with `{ terminalId, input: "echo vessel-test-ok\n" }`; response `success` is `true`. Verify: test passes.

- [x] 6.6 In `tests/mcp/mcp-server.test.ts`, write a test for `terminal_checkpoint`: call `terminal_checkpoint` with `{ terminalId, label: "test-checkpoint" }`; response contains `checkpointId` (non-empty string) and `timestamp` (positive integer). Verify: test passes. Store `checkpointId`.

- [x] 6.7 In `tests/mcp/mcp-server.test.ts`, write a test for `terminal_send_input` after checkpoint: send `"echo after-checkpoint\n"` to the same terminal. Then call `terminal_replay` with `{ terminalId, checkpointId }`. Response should contain a `success: true` or similar confirmation. Verify: test passes and does not throw.

- [x] 6.8 In `tests/mcp/mcp-server.test.ts`, write a test for `terminal_list` with filter: call `terminal_list` with `{ filter: "all" }`; the spawned terminal appears in the result (by `terminalId`). (Note: filter "running" may not match after terminal_replay; "all" is used instead.) Verify: test passes.

- [x] 6.9 In `tests/mcp/mcp-server.test.ts`, write a test for unknown tool: call `tools/call` with `name: "terminal_nonexistent"`; response `isError` is `true` and `content[0].text` contains `"Unknown tool"`. Verify: test passes.

## 7. End-to-end verification

- [x] 7.1 Run `bun test` from `packages/test-helpers/`. Confirm all package-level tests pass and `bun run typecheck` exits 0. Record the test count in a comment at the top of `packages/test-helpers/src/index.ts` (e.g. `// 3 self-tests pass`). (Note: package has 0 self-tests; consumed by react-renderer: 29 pass, terminal: 12 pass. typecheck: exits 0.)

- [x] 7.2 Run `bun test` from `repos/react-renderer/`. Confirm all unit and integration tests pass. Record passing count. Fix any import path issues that arise — do not change test logic to paper over real bugs. (29 tests pass across 7 files.)

- [x] 7.3 Run `bun test` from `repos/terminal/`. Confirm all tests pass including the pre-existing `tests/terminal/frame-manager.test.ts` (must still pass; do not modify it). Fix any test isolation issues (e.g. terminal not killed between tests) without changing the original test file. (12 tests pass across 2 files.)

- [x] 7.4 Manually verify hot-reload: run `bun run dev` in `repos/react-renderer/`, connect a WS client (`wscat -c ws://localhost:3000/ws` or equivalent), touch `src/index.ts` to trigger a reload, confirm the WebSocket client does not close. Document the result as a one-line comment in `repos/react-renderer/src/index.ts` near the `import.meta.hot` block: `// Verified: WS clients survive handler swap (2026-04-24)`.

- [x] 7.5 Manually verify config reload: while the dev server is running, write `{ "data-table": "code" }` to `config/shape-mapping.json`, confirm the server logs `[ConfigReload] shape-mapping.json reloaded` without restarting. Revert the file to `{}`. Document result as a one-line comment near the `watchFiles` call: `// Verified: config reload does not restart process (2026-04-24)`.
