# Spec — mcp-npm-release

## ADDED Requirements

### Requirement: `@metabob/mcp@0.2.8` MUST be installable from the public npm registry
After this change, `npm view @metabob/mcp@0.2.8 version` returns `0.2.8` and `npx --yes @metabob/mcp@0.2.8` resolves and executes against the published artifact.

#### Scenario: Published version matches package.json
- **GIVEN** the package.json in metabob-mcp at SHA 9fbdee9 declares `"version": "0.2.8"`
- **WHEN** `npm view @metabob/mcp@0.2.8 version` is queried
- **THEN** the registry returns `"0.2.8"`

### Requirement: Published artifact MUST emit semantic outcome events
The published 0.2.8 binary, when driven against `https://user.metabob.com` with a fresh ApiKey, posts outcome events for `mark_complete`, `annotate_component`, and `assign_git_changes`.

#### Scenario: npx-driven smoke produces outcomes
- **GIVEN** a fresh canary ApiKey
- **WHEN** `npx --yes @metabob/mcp@0.2.8` is invoked via JSON-RPC stdio and the client calls `mark_complete`, `annotate_component`, and `assign_git_changes`
- **THEN** `GET /v2/mcp/outcomes?api_key_id=<id>` for that key returns three events with `tool_name` matching the three calls
