## 1. Verify prerequisites

- [x] 1.1 Confirm `repos/cpg-inference-ts` exists (required by `@metabob/cpg-inference` local dep)
- [x] 1.2 Run `bun install` in `repos/metabob-mcp` to ensure dependencies are resolved
- [x] 1.3 Run `bun run typecheck` and document any existing type errors

## 2. Fix unit tests

- [x] 2.1 Delete all content of `tests/unit/tools.test.ts`
- [x] 2.2 Add imports for all 10 current tool modules (`init-workspace`, `get-problems`, `search-codebase`, `predict-cochanges`, `analyze-impact`, `annotate-component`, `mark-complete`, `get-metrics`, `assign-git-changes`, `get-analysis-context`)
- [x] 2.3 Add a mock `apiClient` with `get`, `post`, `put` stubs using `mock()` from `bun:test`
- [x] 2.4 For each tool: write a schema-validation test (valid input parses without throw)
- [x] 2.5 For each tool: write a handler test (returns non-empty string, apiClient called)
- [x] 2.6 Run `bun test tests/unit/` and confirm all unit tests pass

## 3. Fix integration tests

- [x] 3.1 Update `tools/list` count assertion from 7 to 10
- [x] 3.2 Replace `expectedTools` array with the 10 current tool names
- [x] 3.3 Fix `search_codebase` schema assertion: check for `query` instead of `filters`
- [x] 3.4 Fix `annotate_component` schema assertion: check for `problem_id` instead of `component_id`
- [x] 3.5 Update the unknown-tool error assertion to match the current error message format
- [x] 3.6 Run `bun test tests/integration/` and confirm all integration tests pass

## 4. Verify typecheck and build

- [x] 4.1 Run `bun run typecheck` — must exit 0
- [x] 4.2 Run `bun run build` — must exit 0 and produce `dist/cli.js`
- [x] 4.3 Verify `dist/cli.js` is executable (`ls -la dist/cli.js`)

## 5. Full test run

- [x] 5.1 Run `bun test` (all files) — must exit 0 with 0 failures and 0 errors
- [x] 5.2 Smoke-test the server: pipe a `tools/list` request over stdio and verify 10 tools in response

## 6. Create dev branch

- [x] 6.1 In `repos/metabob-mcp`: `git checkout -b dev`
- [x] 6.2 Commit any test fixes on the `dev` branch
- [x] 6.3 Push `dev` to origin: `git push -u origin dev`
- [x] 6.4 Confirm `git branch -a` shows `remotes/origin/dev`

## 7. MCP server configuration test

- [x] 7.1 Write a minimal Claude Desktop / agent MCP config snippet pointing at the local server (`bun run src/index.ts`) with `SESSION_ID` and `ANALYSIS_API_URL` env vars documented
- [x] 7.2 Verify the config can be used with `claude mcp add` or equivalent to register the server
- [x] 7.3 Confirm that running the server and issuing a `tools/list` via the MCP client returns all 10 tools

## 8. Super-repo pointer update

- [x] 8.1 In the super-repo, update the `repos/metabob-mcp` submodule pointer to the latest `dev` commit
- [x] 8.2 Commit the submodule pointer update on the super-repo `dev` branch
