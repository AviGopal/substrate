## ADDED Requirements

### Requirement: Vessel spawner starts vessel and waits for health
The system SHALL provide a `spawnVessel()` function that starts a vessel subprocess, polls its `/health` endpoint, and returns a handle that callers use to interact with and stop the vessel.

#### Scenario: Vessel starts within timeout
- **WHEN** `spawnVessel({ cmd: ['bun', 'src/index.ts'], cwd, port: 13001 })` is called
- **AND** the vessel's `/health` endpoint returns HTTP 200 within 10 000 ms
- **THEN** `spawnVessel` resolves to a `VesselHandle` with `baseUrl` equal to `"http://localhost:13001"`
- **AND** `handle.port` equals `13001`

#### Scenario: Vessel fails to start within timeout
- **WHEN** `spawnVessel()` is called with a command that never serves a healthy `/health`
- **AND** 10 000 ms (default timeout) elapses without a 200 response
- **THEN** `spawnVessel` rejects with an error whose message contains `"health timeout"`
- **AND** the message includes the last observed HTTP status code if any response was received

#### Scenario: Stopping a vessel handle
- **WHEN** `handle.stop()` is called
- **THEN** the vessel process receives SIGTERM
- **AND** `stop()` resolves after the process exits
- **AND** the port is freed within 1 s of `stop()` resolving

#### Scenario: Custom environment variables passed to vessel
- **WHEN** `spawnVessel({ ..., env: { FOO: 'bar' } })` is called
- **THEN** the spawned process has `FOO=bar` in its environment
- **AND** `PORT` is set to the specified port number

---

### Requirement: WebSocket test client captures messages and supports typed waits
The system SHALL provide a `connectWS()` function that opens a WebSocket connection, buffers all received messages, and allows tests to await the arrival of a message of a specific type.

#### Scenario: Connection established
- **WHEN** `connectWS('ws://localhost:13001/ws')` is called
- **AND** the server is healthy
- **THEN** the returned `WSTestClient` has an empty `messages` array initially
- **AND** the underlying WebSocket is in the `OPEN` ready state

#### Scenario: Message arrives before waitFor is called
- **WHEN** the server sends a `state_sync` message before `waitFor('state_sync')` is called
- **THEN** `waitFor('state_sync')` resolves immediately with that message
- **AND** the message is still present in `client.messages`

#### Scenario: Message arrives after waitFor is called
- **WHEN** `waitFor('impulse_create', 3000)` is called before the server sends the message
- **AND** the server sends an `impulse_create` message within 3 000 ms
- **THEN** `waitFor` resolves with the message object

#### Scenario: waitFor times out
- **WHEN** `waitFor('impulse_create', 500)` is called
- **AND** no `impulse_create` message arrives within 500 ms
- **THEN** `waitFor` rejects with an error whose message contains `"timeout"` and the expected message type

#### Scenario: Sending a message
- **WHEN** `client.send({ type: 'ping' })` is called
- **THEN** the server receives a JSON-encoded message with `type: "ping"`

#### Scenario: Closing the client
- **WHEN** `client.close()` is called
- **THEN** the underlying WebSocket closes cleanly (close code 1000)

---

### Requirement: Health poller retries until success or timeout
The system SHALL provide a `waitForHealth(url, timeout)` function that repeatedly polls a URL until it returns HTTP 200 or the timeout expires.

#### Scenario: Server becomes healthy after initial failures
- **WHEN** `waitForHealth('http://localhost:13099/health', 5000)` is called
- **AND** the server is not yet listening but starts within 2 000 ms
- **THEN** `waitForHealth` resolves without error

#### Scenario: Timeout exceeded with refused connections
- **WHEN** `waitForHealth('http://localhost:19999/health', 300)` is called
- **AND** no server is listening on that port
- **THEN** `waitForHealth` rejects within 500 ms of the call (300 ms timeout + polling overhead)
- **AND** the error message contains `"health timeout"`

#### Scenario: Poll interval is at most 200 ms
- **WHEN** the server becomes healthy on the 3rd poll attempt
- **THEN** `waitForHealth` resolves within `3 × 200 ms = 600 ms` of the server becoming healthy

---

### Requirement: Impulse fixtures provide valid, cloned shape instances
The system SHALL provide a `fixtures` object containing factory functions for common impulse shapes. Each call returns a fresh deep clone so mutations in one test do not affect others.

#### Scenario: directoryTree fixture is structurally valid
- **WHEN** `fixtures.directoryTree()` is called
- **THEN** the result has `type === "directoryTree"`
- **AND** `entries` is a non-empty array
- **AND** each entry has `path` (string) and `kind` (`"file"` or `"directory"`)

#### Scenario: uiComponent.dataTable fixture contains a data-table primitive
- **WHEN** `fixtures.uiComponent.dataTable()` is called
- **THEN** the result has `primitive.type === "data-table"`
- **AND** `primitive.columns` is a non-empty array
- **AND** `primitive.data` is an array

#### Scenario: uiComponent.container fixture has two children
- **WHEN** `fixtures.uiComponent.container()` is called
- **THEN** `primitive.type === "container"`
- **AND** `primitive.children` has exactly 2 elements

#### Scenario: Fixtures return independent copies
- **WHEN** `const a = fixtures.directoryTree()` and `const b = fixtures.directoryTree()` are called
- **AND** `a.entries.push({ path: 'extra', kind: 'file' })`
- **THEN** `b.entries` still has the original length (mutation of `a` does not affect `b`)

---

### Requirement: Package exports resolve without runtime dependencies
The system SHALL declare zero runtime dependencies. All test-helpers functionality relies only on Bun built-ins (`Bun.spawn`, `WebSocket`, `fetch`).

#### Scenario: Package installs in a clean environment
- **WHEN** `bun install` is run in the `packages/test-helpers/` directory
- **THEN** `node_modules` contains only devDependencies (type definitions)
- **AND** no transitive runtime packages are installed

#### Scenario: Importable from a vessel devDependency
- **WHEN** `repos/react-renderer/package.json` declares `"@metabob/test-helpers": "file:../../packages/test-helpers"` as a devDependency
- **THEN** `import { spawnVessel } from '@metabob/test-helpers'` in a test file resolves correctly after `bun install`
