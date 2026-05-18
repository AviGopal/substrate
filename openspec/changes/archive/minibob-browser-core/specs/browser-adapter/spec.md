## ADDED Requirements

### Requirement: BrowserAdapter.fs uses Web File System Access API with memfs fallback
`src/adapters/browser.ts` SHALL export a `BrowserAdapter` class. Its `fs` implementation SHALL prefer the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) (`showDirectoryPicker`, `FileSystemDirectoryHandle`) when a directory handle has been granted, and fall back to an in-memory virtual filesystem (`memfs`) when no handle is available.

#### Scenario: File read with directory handle
- **WHEN** a directory handle has been granted and `adapter.fs.read(path)` is called for a path within that directory
- **THEN** it SHALL resolve the `FileSystemFileHandle` and return the file text

#### Scenario: File read without directory handle (memfs fallback)
- **WHEN** no directory handle has been granted and `adapter.fs.read(path)` is called
- **THEN** it SHALL read from the in-memory virtual FS, returning an empty string if the path does not exist

#### Scenario: File write persists in the active filesystem
- **WHEN** `adapter.fs.write(path, content)` is called
- **THEN** it SHALL write to the File System Access API handle if available, otherwise to memfs

#### Scenario: Glob scan works against virtual FS
- **WHEN** `adapter.fs.glob(pattern, cwd)` is called
- **THEN** it SHALL scan the active filesystem (FS Access API or memfs) and yield matching relative paths

### Requirement: BrowserAdapter.process proxies bash over WebSocket
`BrowserAdapter.process.spawn()` SHALL open (or reuse) a WebSocket connection to a configurable `bashProxyUrl` (e.g., `wss://activity.metabob.com/ws/bash`) and stream the result back as `{ exitCode, stdout, stderr }`.

#### Scenario: Supported when proxy URL is configured
- **WHEN** `BrowserAdapter` is constructed with a non-null `bashProxyUrl`
- **THEN** `adapter.process.supported` SHALL be `true`

#### Scenario: Unsupported when no proxy URL
- **WHEN** `BrowserAdapter` is constructed without a `bashProxyUrl`
- **THEN** `adapter.process.supported` SHALL be `false` and `spawn()` SHALL throw `UnsupportedOperationError`

#### Scenario: Spawn sends command over WebSocket and receives result
- **WHEN** `adapter.process.spawn(['ls', '-la'], cwd)` is called with a proxy configured
- **THEN** the adapter SHALL send `{ type: 'spawn', cmd: ['ls', '-la'], cwd }` over the WebSocket, await a `{ type: 'result', exitCode, stdout, stderr }` message, and return the result

#### Scenario: Spawn enforces 30-second timeout
- **WHEN** the WebSocket proxy does not respond within 30 seconds
- **THEN** `spawn()` SHALL reject with `TimeoutError` and close the WebSocket

### Requirement: BrowserAdapter.git uses isomorphic-git for reads
`BrowserAdapter.git` SHALL use `isomorphic-git` with the active virtual FS for read operations. Write operations (commit, push) SHALL proxy to the bash WebSocket endpoint.

#### Scenario: git.diff returns patch text
- **WHEN** `adapter.git.diff(cwd, ['HEAD'])` is called
- **THEN** it SHALL use `isomorphic-git`'s `statusMatrix` / `readBlob` to compute a unified diff string equivalent to `git diff HEAD`

#### Scenario: git.status returns working-tree status
- **WHEN** `adapter.git.status(cwd)` is called
- **THEN** it SHALL return a string in `git status --short` format derived from `isomorphic-git.statusMatrix`

#### Scenario: git.log returns commit history
- **WHEN** `adapter.git.log(cwd, { depth: 10 })` is called
- **THEN** it SHALL return a newline-delimited string of `{hash} {message}` pairs from `isomorphic-git.log`

### Requirement: BrowserAdapter.config loads from URL params or injected config
`BrowserAdapter.config.load()` SHALL return a `MinibobConfig` sourced from (in priority order): (1) a config object passed to the `BrowserAdapter` constructor, (2) `localStorage` key `minibob.config`, (3) defaults.

#### Scenario: Config from constructor argument
- **WHEN** `new BrowserAdapter({ config: { endpoint: 'https://activity.metabob.com', ... } })` is used
- **THEN** `adapter.config.load()` SHALL return that config immediately without any I/O

#### Scenario: Config from localStorage
- **WHEN** no constructor config is provided but `localStorage.getItem('minibob.config')` is a valid JSON string
- **THEN** `adapter.config.load()` SHALL parse and return it

### Requirement: BrowserAdapter.input uses in-page UI callback
`BrowserAdapter.input.ask(question, options?)` SHALL invoke a user-supplied `onAsk` callback (registered at construction time) and return its promise. If no callback is supplied, it SHALL return an empty string immediately (non-interactive mode).

#### Scenario: Interactive prompt via callback
- **WHEN** `new BrowserAdapter({ onAsk: (q, opts) => showModal(q, opts) })` is used
- **THEN** `adapter.input.ask(question)` SHALL call `showModal` and resolve with its return value

#### Scenario: Non-interactive fallback
- **WHEN** no `onAsk` callback is supplied
- **THEN** `adapter.input.ask(question)` SHALL resolve with an empty string without blocking

### Requirement: BrowserAdapter has unit tests runnable in a browser test harness
`src/adapters/browser.test.ts` SHALL test each method using Vitest's browser mode or a jsdom environment with mocked WebSocket and File System Access API.

#### Scenario: fs round-trip against memfs
- **WHEN** `adapter.fs.write(path, 'hello')` then `adapter.fs.read(path)` is called in memfs mode
- **THEN** the read SHALL return `'hello'`

#### Scenario: process.spawn returns UnsupportedOperationError without proxy
- **WHEN** `new BrowserAdapter({})` (no bashProxyUrl) and `adapter.process.spawn(['ls'], '/')` is called
- **THEN** the promise SHALL reject with `UnsupportedOperationError`
