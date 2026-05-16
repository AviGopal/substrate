## ADDED Requirements

### Requirement: Handler extraction enables hot-reload without connection loss
The system SHALL extract the react-renderer request handler into a `buildHandler()` factory function so that `Bun.serve.reload()` can swap the handler without tearing down the server or dropping WebSocket connections.

#### Scenario: buildHandler returns a valid serve configuration
- **WHEN** `buildHandler()` is called
- **THEN** the return value has a `fetch` property (Hono app's fetch method)
- **AND** the return value has a `websocket` property with `open`, `message`, `close`, and `drain` handlers

#### Scenario: WebSocket clients survive a handler swap
- **WHEN** a WebSocket client is connected to `ws://localhost:3000/ws`
- **AND** `import.meta.hot.accept()` triggers (simulated by calling `server.reload(buildHandler())` directly in a test)
- **THEN** the WebSocket client does not receive a close frame
- **AND** `client.readyState` remains `WebSocket.OPEN` after the reload

#### Scenario: HTTP endpoints remain functional after reload
- **WHEN** `server.reload(buildHandler())` is called
- **THEN** `GET /health` still returns HTTP 200 with `{ status: 'ok' }`
- **AND** `POST /impulses` still creates impulses and returns HTTP 201
- **AND** existing in-memory impulse state is preserved (impulses created before reload are still accessible)

---

### Requirement: import.meta.hot.accept() is registered and logs reload events
The system SHALL register an `import.meta.hot.accept()` callback that reloads the server handler and emits a log line on each hot-reload event.

#### Scenario: Hot-reload callback is registered when hot module is available
- **WHEN** `import.meta.hot` is truthy (i.e. process started with `bun --hot`)
- **THEN** `import.meta.hot.accept(callback)` is called once during module initialization
- **AND** the callback calls `server.reload(buildHandler())`

#### Scenario: Standard log line emitted on reload
- **WHEN** the hot-reload callback fires
- **THEN** the process writes `[HotReload] Handler swapped — WebSocket clients preserved` to stdout

#### Scenario: Debug log includes timestamp when DEBUG env var is set
- **WHEN** `DEBUG=true` is set in the process environment
- **AND** the hot-reload callback fires
- **THEN** stdout includes a timestamp (ISO 8601 string) alongside the standard log line

#### Scenario: No error when import.meta.hot is undefined
- **WHEN** the process is started without `bun --hot` (standard `bun run start`)
- **THEN** `import.meta.hot` is `undefined`
- **AND** the server starts normally without throwing a TypeError

---

### Requirement: config/shape-mapping.json is watched and triggers a handler reload
The system SHALL watch `config/shape-mapping.json` using `Bun.watchFiles()` and reload the handler when the file changes, without restarting the process.

#### Scenario: Config file is loaded on startup
- **WHEN** the server starts and `config/shape-mapping.json` exists and contains valid JSON
- **THEN** `getShapeMapping()` returns the parsed contents

#### Scenario: Missing config file does not crash the server
- **WHEN** `config/shape-mapping.json` does not exist
- **THEN** the server starts normally
- **AND** `getShapeMapping()` returns an empty object `{}`

#### Scenario: Config file change triggers reload
- **WHEN** `config/shape-mapping.json` is written with new content while the server is running
- **THEN** `shapeMappingCache` is updated to reflect the new content within 500 ms
- **AND** `server.reload(buildHandler())` is called (handler swapped, not process restarted)
- **AND** stdout contains `[ConfigReload] shape-mapping.json reloaded`

#### Scenario: Invalid JSON in config file is handled gracefully
- **WHEN** `config/shape-mapping.json` is written with invalid JSON
- **THEN** the server logs a warning
- **AND** `shapeMappingCache` retains its previous valid value
- **AND** the server continues serving requests normally

---

### Requirement: dev:debug script enables verbose hot-reload logging
The system SHALL provide a `dev:debug` npm script that starts the server with hot-reload and verbose logging enabled.

#### Scenario: dev:debug script exists in package.json
- **WHEN** `repos/react-renderer/package.json` is inspected
- **THEN** `scripts.dev:debug` equals `"DEBUG=true bun --hot src/index.ts"`

#### Scenario: dev:debug emits more log output than dev
- **WHEN** `bun run dev:debug` is started and a hot-reload is triggered
- **THEN** stdout includes the timestamp alongside the reload message
- **WHEN** `bun run dev` is started and a hot-reload is triggered
- **THEN** stdout contains only the standard message (no timestamp)

---

### Requirement: Discovery re-registration is documented for each restart scenario
The system SHALL document and verify the discovery re-registration behavior for three vessel lifecycle scenarios: process restart, hot reload, and `bun --watch` restart.

#### Scenario: Process restart — new registration before old TTL expires
- **WHEN** the react-renderer process is stopped and restarted
- **AND** the discovery-vessel TTL is 5 minutes (300 000 ms)
- **AND** the vessel starts up in under 1 000 ms
- **THEN** the new process registers with discovery before the old registration expires
- **AND** there is a gap of at most ~1 000 ms during which neither the old nor new registration is active

#### Scenario: Hot reload — heartbeat uninterrupted
- **WHEN** `import.meta.hot.accept()` fires and `server.reload(buildHandler())` is called
- **THEN** the `VesselClient` instance is not re-created
- **AND** the heartbeat timer continues running without interruption
- **AND** `discoveryClient.isRunning` remains `true` after the reload

#### Scenario: bun --watch restart — same behavior as process restart
- **WHEN** `bun --watch src/index.ts` is used and a file change triggers a restart
- **THEN** the behavior is equivalent to a process restart (not a hot reload)
- **AND** there is a ~100–1 000 ms gap where the vessel may be temporarily unregistered
