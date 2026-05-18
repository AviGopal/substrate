## Context

MiniBob (`repos/minibob/`) is a Bun/TypeScript activity-execution vessel. Its core logic — the activity executor (`activity.ts`), impulse store (`impulse.ts`), and ~20 resolvers under `src/resolvers/` — is platform-agnostic TypeScript. However, all platform I/O (filesystem, subprocess, git, config) is called inline via Bun globals (`Bun.file`, `Bun.spawn`, `Bun.$`, `new Bun.Glob`). This prevents the execution engine from being loaded in a browser.

The workbench and other web clients need to run MiniBob goals locally, reducing round-trips and enabling offline-capable authoring. The goal is to expose the same execution engine as a browser ES module by introducing an adapter layer — without forking the codebase or breaking the existing Bun CLI/server path.

**Bun call site inventory** (from source audit):
- `Bun.file(path)` / `.text()` / `.json()` / `.exists()` — ~12 sites across `impulse.ts`, `tools.ts`, `resolvers/file.ts`, `embedded-templates/index.ts`
- `Bun.write(path, content)` — ~5 sites in `tools.ts`, `resolvers/file.ts`
- `Bun.spawn(args, opts)` / `new Response(proc.stdout).text()` — ~6 sites in `tools.ts`, `resolvers/bash.ts`
- `` Bun.$`...` `` shell template literals — ~4 sites in `resolvers/git.ts`, `resolvers/directory-tree.ts`
- `new Bun.Glob(pattern).scan({ cwd })` — ~3 sites in `resolvers/directory-tree.ts`, `tools.ts`

**Resolvers that are already platform-agnostic** (use only `fetch`, in-memory state, or pure logic):
`llm.ts`, `vessel-resolver-proxy.ts`, `goal-decomposition.ts`, `goal-enrichment.ts`, `goal-verification.ts`, `variant-selection.ts`, `impulse-pool-selection.ts`, `relevance-scorer.ts`, `impulse-cooccurrence.ts`, `context-acquisition.ts`, `recommendation.ts`, `iteration.ts`, `compliance-validator.ts`, `satisfaction-verifier.ts`

## Goals / Non-Goals

**Goals:**
- Define a stable `PlatformAdapter` interface that covers every Bun call site
- Provide a `BunAdapter` (current behavior, extracted) injected at Bun startup — zero behavior change
- Provide a `BrowserAdapter` injected at browser startup — Web FS API, isomorphic-git, WebSocket bash proxy
- Export a `browser.ts` entry point as an additional `exports` target in `package.json`
- Embedded templates load via static imports (not `Bun.file`) so bundlers can tree-shake
- All existing tests pass unchanged; new adapter unit tests cover each implementation

**Non-Goals:**
- Full POSIX bash in-browser (WASM runtime) — bash proxies to a running Bun instance via WebSocket
- A separate npm package or monorepo split
- Browser UI — the browser entry exports a headless engine; the workbench wires its own UI
- Offline git commits — `GitAdapter` in browser is read-only (diff, status, log)

## Decisions

### D1: Adapter injection via constructor argument, not global replacement

**Decision:** The execution engine's public factory (`createMinibobEngine(adapter)`) accepts a `PlatformAdapter` as a required argument. Callers (Bun index.ts, browser.ts) construct the appropriate adapter and pass it in.

**Alternatives considered:**
- *Global monkey-patch* (`globalThis.BunAdapter = ...`): breaks tree-shaking and makes adapter identity implicit; rejected.
- *Environment detection at call site* (`if (typeof Bun !== 'undefined')`): scatters platform logic across every file; rejected.
- *Constructor injection* (chosen): single seam, explicit, testable with a mock adapter.

### D2: Single `PlatformAdapter` interface, not per-resolver injection

**Decision:** One interface covers all platform surface: `FileSystemAdapter`, `ProcessAdapter`, `GitAdapter`, `ConfigAdapter` are nested namespaces within a single `PlatformAdapter` object. Resolvers receive the whole adapter via the engine context.

**Alternatives considered:**
- *Per-resolver adapter injection*: would require threading 4 separate deps through every resolver instantiation; rejected.
- *Single flat interface* (chosen): one context object, passed once, destructured as needed.

### D3: Bash proxied over WebSocket, not WASM

**Decision:** `BrowserAdapter.process.spawn()` opens a WebSocket to a Bun instance endpoint (`/ws/bash`) and streams stdout/stderr back. The browser never executes shell code locally.

**Rationale:** A WASM bash (e.g., Wasmer + busybox) adds ~15 MB to the bundle, has POSIX gaps, and cannot reach the real project filesystem. The proxy approach reuses the already-running Bun vessel and adds a single WebSocket endpoint.

**Trade-off:** Requires a reachable Bun instance. Activities that use bash cannot run fully offline. Acceptable for the target use case (workbench connected to canary).

### D4: Git via isomorphic-git (read-only) in browser

**Decision:** `BrowserAdapter.git` uses `isomorphic-git` + `@isomorphic-git/http` for read operations (diff, log, status) against an HTTP remote. Write operations (commit, push) proxy to the Bun WebSocket endpoint.

**Alternatives considered:**
- *All git ops via proxy*: simpler, but loses the ability to inspect local history offline; rejected.
- *isomorphic-git + proxy for writes* (chosen): covers the 80% case (read) offline; writes proxy when needed.

### D5: Embedded templates as static imports

**Decision:** `src/embedded-templates/index.ts` changes from `Bun.file(filePath).json()` lazy-loading to `import templateFoo from './templates/foo.json' assert { type: 'json' }` static imports. A barrel file exports all templates.

**Rationale:** Bundlers (esbuild, Vite) can tree-shake unused templates; no filesystem access required at runtime; no behavior change for Bun (static imports work identically).

## Risks / Trade-offs

- **[Risk] WebSocket bash proxy is a new attack surface** → Mitigation: the `/ws/bash` endpoint validates the same API key as all other endpoints; command allowlist mirrors existing `BashTool` restrictions; no shell injection possible since commands are passed as string arrays not interpolated strings.
- **[Risk] isomorphic-git behavior diverges from native git in edge cases** → Mitigation: git adapter is read-only in browser; divergence only affects display, not mutations; integration tests compare outputs.
- **[Risk] Web File System Access API requires user permission prompts** → Mitigation: the browser adapter falls back to an in-memory virtual FS (memfs) when no directory handle is granted; activities that write files warn the user.
- **[Risk] Static template imports increase initial bundle size** → Mitigation: templates are ~50 KB total minified; bundler lazy-chunking via dynamic imports is an opt-in follow-up if needed.
- **[Risk] Adapter refactor touches 25+ call sites** → Mitigation: refactor is mechanical (find-replace + inject); existing test suite provides regression coverage; changes are reviewed per-file before merge.

## Migration Plan

1. **Add adapter interfaces** (`src/adapters/types.ts`) — no behavior change, no import changes yet
2. **Extract BunAdapter** (`src/adapters/bun.ts`) — move inline Bun calls here; update call sites to use `context.adapter.*`; run existing tests to verify
3. **Refactor embedded templates** — swap `Bun.file` for static imports; verify template loading
4. **Add BrowserAdapter** (`src/adapters/browser.ts`) — implement each interface for browser environment; add unit tests with mock WebSocket
5. **Add `/ws/bash` endpoint** to Bun server (`index.ts`) — WebSocket bash proxy with auth + allowlist
6. **Add `browser.ts` entry** and `exports` field in `package.json` — wire browser adapters; smoke-test via a simple Vite app
7. **Deploy and validate** — load browser entry in the workbench dev build; execute a memo-only goal end-to-end

**Rollback:** The adapter injection is fully backward-compatible. Removing `browser.ts` and reverting `package.json` restores the prior surface; the refactored Bun path is functionally identical.

## Open Questions

- **Q1:** Should `ProcessAdapter.spawn()` in the browser accept a timeout, or inherit the existing `BashTool` timeout (30s default)? Proposal: inherit, configurable per-call.
- **Q2:** Which activities in the embedded-templates set should be excluded from the browser bundle (e.g., those that only make sense server-side)? Proposal: include all; the engine skips tasks whose resolver is `bash` when `ProcessAdapter` signals `unsupported`.
- **Q3:** Does isomorphic-git need a CORS proxy to reach the canary git remote, or is the existing auth header sufficient? To be validated during step 6.
