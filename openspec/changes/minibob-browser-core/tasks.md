## 1. Audit & Inventory

- [ ] 1.1 Run `grep -rn "Bun\." repos/minibob/src repos/minibob/index.ts --include="*.ts" | grep -v "adapters/"` and record every call site with file + line number in a comment block at the top of `src/adapters/types.ts`
- [ ] 1.2 Confirm that all resolvers under `src/resolvers/` that use only `fetch` or in-memory logic contain zero `Bun.` references (baseline verification)
- [ ] 1.3 List which embedded templates invoke `bash` or `git` resolver tasks — these will degrade gracefully in browser mode

## 2. Platform Adapter Interfaces

- [ ] 2.1 Create `src/adapters/types.ts` with `FileSystemAdapter`, `ProcessAdapter`, `GitAdapter`, `ConfigAdapter`, `UserInputAdapter`, and the root `PlatformAdapter` interface exactly as defined in the platform-adapters spec
- [ ] 2.2 Define `SpawnOpts`, `SpawnResult`, `UnsupportedOperationError`, `TimeoutError` types in `src/adapters/types.ts`
- [ ] 2.3 Define `MinibobEngine` and `BrowserEngineOptions` interfaces in `src/adapters/types.ts` (these are re-exported from `browser.ts`)
- [ ] 2.4 Export all types from `src/adapters/index.ts`

## 3. BunAdapter

- [ ] 3.1 Create `src/adapters/bun.ts` with `BunAdapter` class implementing `PlatformAdapter`
- [ ] 3.2 Implement `BunAdapter.fs`: `read` → `Bun.file().text()`, `write` → `Bun.write()`, `exists` → `Bun.file().exists()`, `glob` → `new Bun.Glob().scan()`
- [ ] 3.3 Implement `BunAdapter.process`: `spawn` → `Bun.spawn()` with stdout/stderr pipe + `.exited`; `supported = true`
- [ ] 3.4 Implement `BunAdapter.git`: `diff` / `status` / `log` → `` Bun.$`git ...` `` calls extracted from current `resolvers/git.ts` and `resolvers/directory-tree.ts`
- [ ] 3.5 Implement `BunAdapter.config.load()` replicating the current config-merge priority (env vars → project `.metabob/config.json` → `~/.metabob/config.json` → defaults)
- [ ] 3.6 Implement `BunAdapter.input.ask()` using readline on TTY; empty string on non-TTY
- [ ] 3.7 Write `src/adapters/bun.test.ts` with round-trip tests for `fs.read/write`, `fs.exists`, `process.spawn` exit code and stdout, `git.status` against a temp repo
- [ ] 3.8 Run `bun test src/adapters/bun.test.ts` — all tests must pass

## 4. Refactor Core to Use Injected Adapter

- [ ] 4.1 Add `adapter: PlatformAdapter` to the engine context type (wherever the shared context object is defined — `src/types.ts` or `src/context.ts`)
- [ ] 4.2 Update `activity.ts`: replace every inline `Bun.*` call with `context.adapter.*`; pass context through to resolvers that need it
- [ ] 4.3 Update `impulse.ts`: replace every inline `Bun.*` call with `context.adapter.*`
- [ ] 4.4 Update `tools.ts` (`BashTool`, `ReadFileTool`, `WriteFileTool`, `EditFileTool`): replace inline Bun calls with adapter calls received via tool constructor or context
- [ ] 4.5 Update `src/resolvers/bash.ts`: remove direct `Bun.spawn` calls; use `context.adapter.process.spawn`
- [ ] 4.6 Update `src/resolvers/git.ts`: remove `` Bun.$ `` calls; use `context.adapter.git.*`
- [ ] 4.7 Update `src/resolvers/file.ts`: remove `Bun.file` calls; use `context.adapter.fs.*`
- [ ] 4.8 Update `src/resolvers/directory-tree.ts`: remove `Bun.Glob` and `` Bun.$ `` calls; use `context.adapter.fs.glob` and `context.adapter.git.status`
- [ ] 4.9 Verify zero `Bun.` references remain in `activity.ts`, `impulse.ts`, `tools.ts`, `src/resolvers/` with the grep from task 1.1
- [ ] 4.10 Update `index.ts` to construct `BunAdapter` and inject it into the engine at startup
- [ ] 4.11 Run existing test suite (`bun test`) — all pre-existing tests must pass

## 5. Embedded Templates Static Imports

- [ ] 5.1 Replace `Bun.file(filePath).json()` lazy-loading in `src/embedded-templates/index.ts` with static `import` statements for each template JSON file
- [ ] 5.2 Verify `getTemplate(id)` and `getAllTemplates()` return identical objects before and after the change (write a simple before/after comparison test if not already covered)
- [ ] 5.3 Confirm `grep -rn "Bun\." src/embedded-templates/` returns zero matches

## 6. BrowserAdapter

- [ ] 6.1 Add `isomorphic-git` and `memfs` to `package.json` `dependencies`; install with `bun install`
- [ ] 6.2 Create `src/adapters/browser.ts` with `BrowserAdapter` class implementing `PlatformAdapter`
- [ ] 6.3 Implement `BrowserAdapter.fs` with File System Access API path: `read` via `FileSystemFileHandle.getFile().text()`, `write` via `FileSystemFileHandle.createWritable()`, `exists` via handle lookup, `glob` via recursive `FileSystemDirectoryHandle` iteration
- [ ] 6.4 Implement `BrowserAdapter.fs` memfs fallback: use `memfs` `Volume` for all operations when no directory handle is set; expose `setDirectoryHandle(handle)` method to switch post-construction
- [ ] 6.5 Implement `BrowserAdapter.process`: `spawn` opens WebSocket to `bashProxyUrl`, sends `{ type: 'spawn', cmd, cwd }`, awaits `{ type: 'result' }` within 30s, rejects with `TimeoutError` on timeout; `supported` = `!!bashProxyUrl`
- [ ] 6.6 Implement `BrowserAdapter.git` using `isomorphic-git`: `diff` via `statusMatrix` + `readBlob`, `status` via `statusMatrix` formatted as `--short`, `log` via `isomorphic-git.log` returning `{hash} {message}` lines
- [ ] 6.7 Implement `BrowserAdapter.config.load()`: constructor arg → `localStorage.getItem('minibob.config')` → defaults
- [ ] 6.8 Implement `BrowserAdapter.input.ask()`: invoke `onAsk` callback if provided, else return empty string
- [ ] 6.9 Write `src/adapters/browser.test.ts` using Vitest with jsdom: test memfs round-trip, `process.spawn` rejects when no proxy, `input.ask` returns empty without callback, `config.load` reads from injected config
- [ ] 6.10 Run `bunx vitest run src/adapters/browser.test.ts` — all tests must pass

## 7. /ws/bash WebSocket Endpoint

- [ ] 7.1 Add a `GET /ws/bash` route to `index.ts` that upgrades the connection to WebSocket
- [ ] 7.2 Validate the `Authorization: ApiKey` header on upgrade; reject with 401 if missing or invalid
- [ ] 7.3 On receiving `{ type: 'spawn', cmd, cwd }`, run the command through `BashTool` (reusing existing allowlist + timeout logic) and send back `{ type: 'result', exitCode, stdout, stderr }`
- [ ] 7.4 On disallowed command, send `{ type: 'error', message: 'command not allowed' }` and close
- [ ] 7.5 Write a test that exercises the WebSocket endpoint using Bun's built-in WebSocket test client

## 8. Browser Entry Point

- [ ] 8.1 Create `browser.ts` at the minibob repo root; import `BrowserAdapter` from `src/adapters/browser.ts` and `createMinibobEngine` (the refactored factory) from `src/activity.ts`
- [ ] 8.2 Implement the `createMinibobEngine(opts: BrowserEngineOptions): MinibobEngine` factory: construct `BrowserAdapter` from opts, wire it into the engine, return the `MinibobEngine` interface
- [ ] 8.3 Update `package.json` with the `exports` conditional field (`bun` → `index.ts`, `browser` → `browser.ts`, `default` → `index.ts`) and `./browser` named export
- [ ] 8.4 Run `bunx vite build --entry browser.ts` (or equivalent esbuild command) and confirm zero "global not found" / "cannot resolve built-in" errors
- [ ] 8.5 Smoke-test end-to-end: load the browser bundle in a minimal Vite dev app, call `createMinibobEngine({ endpoint, apiKey })`, call `executeGoal('say hello')` with a memo-only template, confirm `ExecutionResult` is returned

## 9. Integration Validation

- [ ] 9.1 Run the full existing test suite (`bun test`) — confirm all tests still pass
- [ ] 9.2 Run `minibob --single "list files in /tmp"` and confirm traces appear in the canary activity-api (Bun path regression test)
- [ ] 9.3 Confirm the grep `grep -rn "Bun\." repos/minibob/src repos/minibob/index.ts | grep -v "adapters/bun"` returns zero matches (Bun calls confined to BunAdapter)
- [ ] 9.4 Update `CLAUDE.md` MiniBob section to note the `browser.ts` entry and adapter injection pattern
