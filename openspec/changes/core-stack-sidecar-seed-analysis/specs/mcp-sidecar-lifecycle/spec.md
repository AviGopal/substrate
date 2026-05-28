## ADDED Requirements

### Requirement: Sidecar runs as a long-running process

`metabob-mcp` SHALL run as a long-running process that owns local filesystem watchers, a git event listener, the CPG builder, the embedder, the GCN co-change predictor, and a local SQLite-backed cache. The process SHALL survive across multiple agent tool calls within a session.

#### Scenario: Sidecar starts on first MCP invocation
- **WHEN** an agent invokes `metabob-mcp` for the first time in a workspace
- **THEN** the sidecar process initialises, opens or creates `<workspace>/.metabob/sidecar.db`, registers filesystem and git watchers, and begins building the CPG and embeddings asynchronously
- **AND** the MCP stdio handler returns control to the agent within 200ms regardless of CPG build state

#### Scenario: Sidecar persists across tool calls
- **GIVEN** the sidecar started during a prior tool call
- **WHEN** the agent invokes another MCP tool within the same workspace
- **THEN** the existing sidecar process serves the call from its in-memory + SQLite state without reinitialising watchers or rebuilding the CPG

#### Scenario: Sidecar graceful shutdown emits session-end event
- **WHEN** the sidecar receives SIGTERM or its idle timeout expires (default 30 minutes of no events)
- **THEN** it flushes the pending event buffer to analysis-api, closes the SQLite database, and exits with code 0

### Requirement: Sidecar maintains a local store keyed by content hash

The sidecar SHALL maintain the local cache schema described in design.md (files, chunks, chunks_vss, seeds, annotations, schedule_queue tables). Cache entries SHALL be keyed by file `content_hash` so that branch switches and reverts invalidate stale entries without manual intervention.

#### Scenario: File change invalidates cached seeds
- **GIVEN** a cached seed exists for `src/auth/lock.ts` at `content_hash = A`
- **WHEN** the file is edited and the new `content_hash = B`
- **THEN** subsequent reads of seeds for `src/auth/lock.ts` return the cached seed with `freshness.stale = true` and a P1 re-analysis is enqueued

#### Scenario: Branch switch invalidates en masse
- **WHEN** the git HEAD changes (new commit, checkout, reset)
- **THEN** the sidecar re-hashes affected files within 5 seconds and marks all seeds whose `content_hash` no longer matches as stale

### Requirement: MCP reads never block

Every MCP read tool (`get_problems`, `get_analysis_context`, `analyze_impact`, `predict_cochanges`, `search_codebase`, `get_metrics`, `assign_git_changes`) SHALL return within 500ms regardless of internal sidecar state, including during cold-start CPG construction.

#### Scenario: Cold-start read returns warming flag
- **GIVEN** a freshly-cloned repository where the sidecar has been running for less than 60 seconds and the CPG is still being built
- **WHEN** the agent invokes `get_problems`
- **THEN** the response is `{ results: [], freshness: {}, warming: true, coverage: { analyzed_files: N, total_files: M } }` returned within 500ms
- **AND** a P0 priority entry is enqueued for the requested target

#### Scenario: Steady-state read returns cached seeds
- **GIVEN** seeds exist in the local cache for `src/foo.ts`
- **WHEN** the agent invokes `get_problems` and the cache contains entries for that file
- **THEN** the response includes the cached seeds with `freshness[src/foo.ts] = { analyzed_at: <ts>, stale: false }` and `warming: false`

#### Scenario: Stale read still returns results
- **GIVEN** the file `src/foo.ts` has changed since its cached seed was produced
- **WHEN** the agent invokes `get_problems`
- **THEN** the stale seeds are returned with `freshness[src/foo.ts].stale = true` and a P1 re-analysis is enqueued

### Requirement: Sidecar runs without an embedded LLM

The sidecar SHALL NOT include any LLM client (Anthropic SDK, OpenAI SDK, or equivalent). All LLM analysis SHALL be performed by `metabob-analysis-api` in response to context bundles posted by the sidecar.

#### Scenario: No outbound LLM provider calls
- **WHEN** the sidecar starts and runs for an arbitrary period
- **THEN** the sidecar makes zero outbound HTTP requests to LLM provider domains (api.anthropic.com, api.openai.com, etc.)
- **AND** all analysis-driven HTTP calls target `ANALYSIS_API_URL`

### Requirement: Sidecar runs in two modes

The sidecar SHALL support `sidecar` mode (default; long-running with watchers and local store) and `stateless` mode (fallback; per-call MCP dispatch as in v0.2.x). Mode SHALL be selectable by the `METABOB_STATELESS` environment variable.

#### Scenario: Default mode is sidecar
- **WHEN** the sidecar starts without `METABOB_STATELESS` set
- **THEN** it runs in sidecar mode with watchers, cache, and scheduler enabled

#### Scenario: METABOB_STATELESS=1 forces legacy behaviour
- **WHEN** the sidecar starts with `METABOB_STATELESS=1`
- **THEN** each MCP tool call is served by a one-shot dispatch with no persistent state, no watchers, no local store, and the result shape includes `warming: false, coverage: { analyzed_files: 0, total_files: 0 }`

### Requirement: Workspace is scoped to git root

The sidecar SHALL identify a workspace by its git root path resolved through symlinks. The workspace identifier passed to analysis-api SHALL be a SHA-256 of `(workspace_root_path, first_commit_hash)`.

#### Scenario: Same workspace reused across sessions
- **GIVEN** the sidecar runs in `/home/user/repo` (a git repo) on Monday and again on Tuesday
- **WHEN** the sidecar computes the workspace identifier each time
- **THEN** the identifier is identical on both days

#### Scenario: Non-git directory falls back to path-only id
- **GIVEN** the sidecar runs in a directory with no `.git`
- **WHEN** it computes the workspace identifier
- **THEN** the identifier is a SHA-256 of the resolved workspace root path only, and a warning is logged that historical correlation across sessions is degraded

### Requirement: Anonymous mode still runs locally

If `METABOB_API_KEY` is unset, the sidecar SHALL still run the local engines (CPG, embeddings, GCN) and serve local-only MCP responses, but SHALL NOT send any context bundles or event posts to analysis-api.

#### Scenario: Anonymous predict_cochanges works
- **GIVEN** the sidecar runs without `METABOB_API_KEY`
- **WHEN** the agent invokes `predict_cochanges` with a file list
- **THEN** the response contains predictions produced by the local GCN, with `warming` reflecting CPG build state

#### Scenario: Anonymous get_problems returns empty
- **GIVEN** the sidecar runs without `METABOB_API_KEY`
- **WHEN** the agent invokes `get_problems`
- **THEN** the response is `{ results: [], warming: false, coverage: { ... } }` because no analysis-api seeds are produced
