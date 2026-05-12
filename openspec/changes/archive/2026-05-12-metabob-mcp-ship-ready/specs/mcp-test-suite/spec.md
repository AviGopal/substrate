## ADDED Requirements

### Requirement: Unit tests cover all registered tools
The test suite SHALL include unit tests for every tool in `TOOL_REGISTRY` (currently 10: `init_workspace`, `get_problems`, `search_codebase`, `predict_cochanges`, `analyze_impact`, `annotate_component`, `mark_complete`, `get_metrics`, `assign_git_changes`, `get_analysis_context`). Each test SHALL use a mocked `apiClient` and SHALL NOT import any module that no longer exists in `src/tools/`.

#### Scenario: Valid input accepted by schema
- **WHEN** `InputSchema.parse()` is called with valid input for a tool
- **THEN** it returns a parsed object without throwing

#### Scenario: Handler returns a non-empty string
- **WHEN** `handle(validInput, mockApiClient, sessionId)` is called
- **THEN** it resolves to a non-empty string

#### Scenario: API client is called with correct path prefix
- **WHEN** `handle()` is called for a tool that makes a network request
- **THEN** the mock `apiClient.get` or `apiClient.post` is invoked with a path starting with `/api/`

### Requirement: Integration tests assert the 10-tool MCP surface
The integration tests SHALL verify the server's MCP protocol behaviour against the current 10-tool registry. They SHALL NOT reference any tool name that no longer exists.

#### Scenario: tools/list returns exactly 10 tools
- **WHEN** a `tools/list` JSON-RPC request is sent to the server over stdio
- **THEN** the response contains exactly 10 tools

#### Scenario: All 10 current tool names are present
- **WHEN** a `tools/list` response is received
- **THEN** it contains all of: `init_workspace`, `get_problems`, `search_codebase`, `predict_cochanges`, `analyze_impact`, `annotate_component`, `mark_complete`, `get_metrics`, `assign_git_changes`, `get_analysis_context`

#### Scenario: Each tool has required MCP properties
- **WHEN** a `tools/list` response is received
- **THEN** every tool entry has `name`, `description`, and `inputSchema` properties

#### Scenario: search_codebase schema has correct fields
- **WHEN** the `search_codebase` tool entry is inspected from `tools/list`
- **THEN** its `inputSchema.properties` contains `query` and `limit`

#### Scenario: annotate_component schema has correct fields
- **WHEN** the `annotate_component` tool entry is inspected from `tools/list`
- **THEN** its `inputSchema.properties` contains `problem_id` and `mode`

#### Scenario: Unknown tool call returns error
- **WHEN** a `tools/call` request is sent with a tool name that does not exist
- **THEN** the response contains an `error` field

#### Scenario: Invalid input returns validation error
- **WHEN** a `tools/call` request is sent with missing required parameters
- **THEN** the response contains an `error` field describing the validation failure

### Requirement: bun test exits cleanly
`bun test` SHALL exit with code 0 across all test files. There SHALL be zero unhandled errors and zero failing tests.

#### Scenario: Full test run passes
- **WHEN** `bun test` is run in the `repos/metabob-mcp` directory
- **THEN** it exits 0 with all tests passing and no errors

### Requirement: Typecheck and build pass
`bun run typecheck` and `bun run build` SHALL both exit 0.

#### Scenario: TypeScript compilation is clean
- **WHEN** `bun run typecheck` is run
- **THEN** it exits 0 with no type errors

#### Scenario: Build produces CLI entrypoint
- **WHEN** `bun run build` is run
- **THEN** it exits 0 and `dist/cli.js` exists and is executable

### Requirement: dev branch exists and is current
The `repos/metabob-mcp` repository SHALL have a `dev` branch that is a descendant of or equal to `main`, pushed to `origin`.

#### Scenario: dev branch created from main
- **WHEN** `git branch -a` is run in `repos/metabob-mcp`
- **THEN** `remotes/origin/dev` is listed

#### Scenario: dev branch is up to date with main
- **WHEN** `git log dev..main` is run
- **THEN** it outputs nothing (dev is at or ahead of main)
