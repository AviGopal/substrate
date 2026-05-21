# Design — mcp-npm-release

## Pre-flight
- `npm whoami` confirms publisher identity (avigopal).
- `npm view @metabob/mcp version` confirms current published version is 0.2.7.
- `package.json` is bumped to 0.2.8 in iter 2 of this batch (commit 9fbdee9 on dev).

## Publish steps
1. `bun run build` to populate `dist/`.
2. `npm publish --access public` (scoped public package).
3. Verify with `npm view @metabob/mcp@latest version` and `npx --yes @metabob/mcp@0.2.8 --help` (or trip the CLI to emit version).

## Smoke
Spawn a real `npx @metabob/mcp@0.2.8` subprocess from a temp workspace, drive it via JSON-RPC stdio, and verify telemetry + outcomes both land in user-vessel for the fresh API key. This exercises the published artifact, not the from-source `bun run` path.

## Out of scope
- A semver/tag policy. We're shipping per-iter for now; formalize in a follow-up if release cadence stabilizes.
- An automated publish hook in CI. Manual publish is fine until cadence demands automation.

## Rollback
`npm deprecate @metabob/mcp@0.2.8 "<reason>"` if a regression is found. The 0.2.7 snapshot remains installable.
