## Context

metabob-mcp v0.2.0 rewrote its entire tool set in commit `d43ec17` (April 2026), renaming and removing several tools to align with the real `ide.metabob.com` API. The test suite — unit tests in `tests/unit/tools.test.ts` and integration tests in `tests/integration/mcp-server.test.ts` — was not updated at the time. The repo also only has a `main` branch; project convention requires a `dev` branch as the working branch for CI/CD.

Current failure modes:
1. `tests/unit/tools.test.ts` imports `../../src/tools/get-priority-issues` (deleted) — crashes with unhandled module-not-found error.
2. `tests/integration/mcp-server.test.ts` expects 7 tools and asserts old names (`get_priority_issues`, `suggest_related_changes`, etc.) — all fail against the 10-tool server.
3. Integration tests assert stale input schema shapes (`filters` on `search_codebase`, `component_id` on `annotate_component`) that no longer exist.
4. `bun run typecheck` and `bun run build` have not been verified since the rewrite.

## Goals / Non-Goals

**Goals:**
- All 20 tests pass (`bun test` exits 0).
- `bun run typecheck` exits 0.
- `bun run build` exits 0, producing a working `dist/cli.js`.
- `dev` branch exists in `repos/metabob-mcp` and tracks `origin/dev`.
- The server responds correctly to `tools/list` (10 tools) via stdio MCP protocol.

**Non-Goals:**
- Adding new tools or changing tool behaviour.
- Publishing to npm (that's a manual operator step post-validation).
- Wiring metabob-mcp into the canary Helm deployment (out of scope here; it's a client-side CLI, not a server vessel).
- Writing E2E tests against a live `ide.metabob.com` session (requires credentials).

## Decisions

### D1: Rewrite tests, don't try to reconcile

The old tests reference a completely different tool surface. Attempting to patch them line-by-line risks leaving contradictory assertions. Instead, rewrite both test files from scratch using the current tool registry as the ground truth.

*Alternative considered:* Rename files to match old test expectations. Rejected — that would undo the v0.2.0 rename and regress the real API alignment.

### D2: Unit tests use per-tool handler + mocked API client

Each tool module exports `handle(input, apiClient, sessionId): Promise<string>` and `InputSchema`. Unit tests:
1. Construct a minimal mock `apiClient` with `jest.fn()` / `mock()` stubs.
2. Call `InputSchema.parse(validInput)` — verifies zod schema accepts good input and rejects bad.
3. Call `handle(validInput, mockApiClient, 'test-session')` — verifies the handler returns a non-empty string.
4. Assert that `mockApiClient.get` or `.post` was called with an expected path prefix.

This keeps unit tests fast (no subprocess, no network) and independent of integration behaviour.

### D3: Integration tests assert the actual 10-tool surface

Integration tests spawn `bun run src/index.ts` as a child process and communicate over stdio (existing harness in `sendMCPRequest`). Assertions:
- `tools/list` returns exactly 10 tools.
- All 10 names are present.
- Each tool has `name`, `description`, `inputSchema`.
- Schema spot-checks use fields that actually exist (e.g. `query` on `search_codebase`, `problem_id` on `annotate_component`).
- `tools/call` with an unknown tool returns an error response.
- `tools/call` with invalid input returns a validation error.

### D4: `dev` branch created by branching from current `main`

`main` is clean and up to date. `dev` is created locally and pushed to `origin`. No rebase or history rewrite needed.

## Risks / Trade-offs

- **Test flakiness on subprocess spawn**: Integration tests already use a 10-second timeout per MCP request via child process. On slow CI they may timeout. Mitigation: keep the test count low and keep assertions in a single `tools/list` roundtrip where possible.
- **`generate-spec` and `activity` tool files exist but are not in `TOOL_REGISTRY`**: `src/tools/generate-spec.ts` and `src/tools/activity.ts` are present but not exported from `tools/index.ts`. Unit tests should not import them to avoid false test coverage. Tests cover only what is registered.
- **`@metabob/cpg-inference` local file dep**: `package.json` references `"@metabob/cpg-inference": "file:../cpg-inference-ts"`. Typecheck and build require that sibling repo to be present. Mitigation: verify it exists before asserting typecheck passes; document the dependency in tasks.

## Migration Plan

1. Fix unit tests (no server restart needed).
2. Fix integration tests (no server restart needed).
3. Verify typecheck and build.
4. Create and push `dev` branch.
5. Confirm `bun test` exits 0 on `dev`.

No rollback risk — tests and branch creation are non-destructive. The `main` branch is unmodified.

## Open Questions

- Does the deployment repo need a CI workflow entry for `metabob-mcp`? (Out of scope for this change; flagged for follow-up.)
- Should `generate-spec.ts` and `activity.ts` be deleted or wired into the registry? (Out of scope; left as-is.)
