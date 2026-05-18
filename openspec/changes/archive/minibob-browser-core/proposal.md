## Why

MiniBob's activity execution loop and most of its resolvers have no intrinsic dependency on Bun or the OS — they are pure TypeScript state machines that happen to call Bun APIs directly. Extracting a platform-agnostic core behind adapter interfaces unlocks in-browser activity execution, enabling the workbench and any web client to run MiniBob goals locally without a server-side vessel.

## What Changes

- Introduce a `PlatformAdapter` interface hierarchy (`FileSystemAdapter`, `ProcessAdapter`, `GitAdapter`, `ConfigAdapter`) that wraps every Bun-specific call site in `activity.ts`, `impulse.ts`, `tools.ts`, and `src/resolvers/`
- Refactor the activity executor, impulse store, and all resolvers to depend on injected adapters rather than calling Bun globals directly
- Provide a `BunAdapter` bundle (current behavior, extracted) so the CLI/server path keeps working unchanged
- Provide a `BrowserAdapter` bundle: Web File System Access API for files, `isomorphic-git` for git, a WebSocket proxy for bash (routes to a running Bun instance), IndexedDB for impulse persistence
- Add a `browser.ts` entry point that wires browser adapters and exports the execution engine as an ES module
- Swap embedded-templates loading from `Bun.file().json()` to static imports (tree-shakeable)

## Capabilities

### New Capabilities

- `platform-adapters`: Adapter interface definitions and injection mechanism for platform-specific operations (filesystem, process, git, config, user-input)
- `bun-adapter`: Concrete Bun implementation of all platform adapters (extracted from current inline calls)
- `browser-adapter`: Concrete browser implementation of all platform adapters (Web FS API, isomorphic-git, WebSocket bash proxy, IndexedDB)
- `browser-entry`: Browser-facing ES module entry point that wires browser adapters and exports `createMinibobEngine()`

### Modified Capabilities

<!-- No existing openspec specs have requirement-level changes; this is purely additive. -->

## Impact

- **repos/minibob/src/**: ~25 Bun call sites across `activity.ts`, `impulse.ts`, `tools.ts`, `src/resolvers/bash.ts`, `src/resolvers/git.ts`, `src/resolvers/file.ts`, `src/resolvers/directory-tree.ts`, `src/embedded-templates/index.ts`
- **repos/minibob/index.ts**: Gains adapter injection at startup; passes `BunAdapter` to the execution engine
- **repos/minibob/browser.ts** (new): Browser entry point; ships as an additional export target in `package.json`
- **repos/minibob/src/adapters/** (new): Adapter interfaces + Bun + browser implementations (~600 LOC total)
- **Dependencies added**: `isomorphic-git`, `memfs` (browser only, bundler-conditional)
- **No breaking changes**: Bun CLI/server behavior is identical; adapters are injected not swapped globally
