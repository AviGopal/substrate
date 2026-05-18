## ADDED Requirements

### Requirement: PlatformAdapter interface hierarchy
The system SHALL define a `PlatformAdapter` interface in `src/adapters/types.ts` that covers every platform-specific operation currently called inline in the MiniBob codebase. The interface SHALL be the single seam through which the execution engine accesses the OS, filesystem, and subprocess environment.

```typescript
interface PlatformAdapter {
  fs: FileSystemAdapter;
  process: ProcessAdapter;
  git: GitAdapter;
  config: ConfigAdapter;
  input: UserInputAdapter;
}
```

#### Scenario: FileSystemAdapter covers all file operations
- **WHEN** a resolver or executor needs to read, write, or check existence of a file
- **THEN** it SHALL call `adapter.fs.read(path)`, `adapter.fs.write(path, content)`, or `adapter.fs.exists(path)` rather than any Bun or Node global

#### Scenario: FileSystemAdapter covers directory scanning
- **WHEN** a resolver needs to list directory contents or scan with a glob pattern
- **THEN** it SHALL call `adapter.fs.glob(pattern, cwd)` which returns `AsyncIterable<string>`

#### Scenario: ProcessAdapter covers subprocess execution
- **WHEN** a task resolver needs to run a shell command
- **THEN** it SHALL call `adapter.process.spawn(cmd: string[], cwd: string, opts?: SpawnOpts)` which returns `Promise<{ exitCode: number; stdout: string; stderr: string }>`

#### Scenario: ProcessAdapter signals capability
- **WHEN** the execution engine checks whether bash execution is supported
- **THEN** `adapter.process.supported` SHALL be `true` on Bun and `false` when no proxy is configured in the browser

#### Scenario: GitAdapter covers read operations
- **WHEN** a resolver needs a git diff, status, or log
- **THEN** it SHALL call `adapter.git.diff(cwd, args)`, `adapter.git.status(cwd)`, or `adapter.git.log(cwd, opts)` — each returning a string

#### Scenario: ConfigAdapter loads MiniBob configuration
- **WHEN** the engine initialises
- **THEN** it SHALL call `adapter.config.load()` which returns `Promise<MinibobConfig>` — the same shape as the current merged config object

#### Scenario: UserInputAdapter handles interactive prompts
- **WHEN** the HumanResolver requires user input
- **THEN** it SHALL call `adapter.input.ask(question, options?)` which returns `Promise<string>`

### Requirement: Adapter injection at engine construction
The execution engine factory SHALL accept a `PlatformAdapter` as a required constructor argument. No Bun global SHALL be referenced at module load time in `activity.ts`, `impulse.ts`, or any file under `src/resolvers/`.

#### Scenario: Engine constructed with adapter
- **WHEN** a caller constructs the engine via `createMinibobEngine({ adapter, config, ... })`
- **THEN** all downstream resolvers and the impulse store SHALL use the injected adapter exclusively

#### Scenario: Missing adapter is caught at construction
- **WHEN** `createMinibobEngine` is called without a `adapter` argument
- **THEN** it SHALL throw a `TypeError` with a message identifying the missing argument before any execution begins

### Requirement: No Bun globals at resolver module scope
Every resolver file under `src/resolvers/` and the files `activity.ts`, `impulse.ts`, `tools.ts`, `src/embedded-templates/index.ts` SHALL be importable in a browser environment without referencing `Bun`, `process.env`, or Node built-in modules at module scope.

#### Scenario: Browser bundler can import resolver files
- **WHEN** a bundler (Vite / esbuild) processes any file under `src/resolvers/`
- **THEN** it SHALL produce no "global not found" or "cannot resolve built-in" errors

#### Scenario: Bun-specific code is confined to adapter implementations
- **WHEN** a grep for `Bun\.` is run across `src/resolvers/`, `activity.ts`, `impulse.ts`, `tools.ts`
- **THEN** it SHALL return zero matches
