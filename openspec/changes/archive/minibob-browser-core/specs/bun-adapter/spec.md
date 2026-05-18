## ADDED Requirements

### Requirement: BunAdapter implements all PlatformAdapter interfaces
`src/adapters/bun.ts` SHALL export a `BunAdapter` class that implements every method of `PlatformAdapter` with behaviour identical to the current inline Bun calls it replaces.

#### Scenario: BunAdapter.fs.read delegates to Bun.file
- **WHEN** `adapter.fs.read(path)` is called on a BunAdapter
- **THEN** it SHALL return the same string as `await Bun.file(path).text()`

#### Scenario: BunAdapter.fs.write delegates to Bun.write
- **WHEN** `adapter.fs.write(path, content)` is called
- **THEN** it SHALL call `Bun.write(path, content)` and resolve when the write is complete

#### Scenario: BunAdapter.fs.exists delegates to Bun.file.exists
- **WHEN** `adapter.fs.exists(path)` is called
- **THEN** it SHALL return `await Bun.file(path).exists()`

#### Scenario: BunAdapter.fs.glob delegates to Bun.Glob.scan
- **WHEN** `adapter.fs.glob(pattern, cwd)` is called
- **THEN** it SHALL return `new Bun.Glob(pattern).scan({ cwd })` — the same AsyncIterable that the current code iterates

#### Scenario: BunAdapter.process.spawn delegates to Bun.spawn
- **WHEN** `adapter.process.spawn(cmd, cwd, opts)` is called
- **THEN** it SHALL invoke `Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe', ...opts })`, await `.exited`, and return `{ exitCode, stdout, stderr }` with stdout/stderr as strings

#### Scenario: BunAdapter.process.supported is true
- **WHEN** `adapter.process.supported` is read on a BunAdapter
- **THEN** it SHALL be `true`

#### Scenario: BunAdapter.git.diff delegates to Bun.$
- **WHEN** `adapter.git.diff(cwd, args)` is called
- **THEN** it SHALL execute `` Bun.$`git diff ${args}`.cwd(cwd) `` and return stdout as a string

#### Scenario: BunAdapter.config.load reads from filesystem
- **WHEN** `adapter.config.load()` is called
- **THEN** it SHALL replicate the current config-merge priority: env vars → project `.metabob/config.json` → `~/.metabob/config.json` → defaults

#### Scenario: BunAdapter.input.ask uses readline
- **WHEN** `adapter.input.ask(question)` is called on a TTY
- **THEN** it SHALL prompt via readline and return the user's input as a string; on non-TTY it SHALL return an empty string (same as existing HumanResolver non-interactive behaviour)

### Requirement: BunAdapter is the default in the Bun entry point
`index.ts` SHALL construct a `BunAdapter` and pass it to `createMinibobEngine` before any goal or HTTP request is processed. No other file in the Bun path SHALL construct a BunAdapter — it is injected once at startup.

#### Scenario: Bun server starts with BunAdapter
- **WHEN** `bun run index.ts` is executed
- **THEN** the engine is initialised with a `BunAdapter` instance and all downstream calls route through it

#### Scenario: Existing CLI behaviour is unchanged
- **WHEN** `minibob --single "some goal"` is run after the refactor
- **THEN** it SHALL produce the same traces, outputs, and exit codes as before the adapter extraction

### Requirement: BunAdapter has unit tests
`src/adapters/bun.test.ts` SHALL test each method with a real temporary directory (Bun's built-in test utilities). Tests SHALL run via `bun test` without mocking `Bun` globals.

#### Scenario: fs.read/write round-trip
- **WHEN** `adapter.fs.write(tmp, content)` is called followed by `adapter.fs.read(tmp)`
- **THEN** the returned string SHALL equal `content`

#### Scenario: process.spawn returns exit code
- **WHEN** `adapter.process.spawn(['echo', 'hello'], cwd)` is called
- **THEN** `exitCode` SHALL be `0` and `stdout` SHALL contain `hello`
