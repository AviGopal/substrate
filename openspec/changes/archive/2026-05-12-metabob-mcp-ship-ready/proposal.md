## Why

metabob-mcp v0.2.0 rewrote the entire tool set against the real `ide.metabob.com` API, but the test suite was never updated — 12 of 20 tests fail, 1 crashes on a missing module. The repo also lacks a `dev` branch (project convention) and has never been published to npm. It needs a clean test pass, verified build, and a publish-ready state before it can be used by external AI agents.

## What Changes

- **Fix unit tests**: Rewrite `tests/unit/tools.test.ts` to import and test the 10 current tool modules (`get_problems`, `search_codebase`, `predict_cochanges`, `analyze_impact`, `annotate_component`, `mark_complete`, `get_metrics`, `assign_git_changes`, `get_analysis_context`, `init_workspace`). Remove all references to deleted modules (`get-priority-issues`, `suggest-related-changes`, `analyze-change-impact`, `mark-problem-complete`, `generate-implementation-spec`).
- **Fix integration tests**: Update `tests/integration/mcp-server.test.ts` to expect 10 tools, use current tool names, and assert against current input schemas.
- **Create `dev` branch**: Branch `dev` from `main` in `repos/metabob-mcp` so CI/CD and the standard dev loop apply.
- **Verify typecheck and build**: Confirm `bun run typecheck` and `bun run build` both pass cleanly.
- **Validate server starts**: Smoke-test that `bun run src/index.ts` initialises without errors and responds to `tools/list` over stdio.
- **npm publish readiness**: Confirm `package.json` metadata (name, version, files, bin, engines) is correct and `dist/` builds a working CLI entrypoint.

## Capabilities

### New Capabilities

- `mcp-test-suite`: Correct, passing test coverage for all 10 MCP tools — unit tests with mocked API client and integration tests against the live MCP stdio protocol.

### Modified Capabilities

_(none — no spec-level behaviour changes; this is purely a quality/correctness pass on an existing vessel)_

## Impact

- `repos/metabob-mcp/tests/` — unit and integration test files rewritten
- `repos/metabob-mcp/` — `dev` branch created; no source changes expected
- CI/CD: if `repos/deployment` has a workflow for metabob-mcp, it will pick up the new `dev` branch automatically
- Downstream: AI agents using `@metabob/mcp` get a correctly-documented, correctly-tested package
