# MCP npm Release 0.2.8

## Why
metabob-mcp now emits semantic outcome events (iter 2) in addition to usage telemetry. Until that ships to npm, customer installs run an older snapshot (0.2.7) without the outcome emitter, so the dashboard's ActivityFeed will remain empty for any real user. The publish completes the loop end-to-end.

## What Changes
- Publish `@metabob/mcp@0.2.8` to npm public registry.
- Verify `npx --yes @metabob/mcp@latest --version` reports 0.2.8.
- Smoke the published binary against canary with a fresh user + key; confirm both telemetry and outcomes land.

## Impact
- Customers running `npx -y @metabob/mcp` now get the outcome emitter automatically.
- No API changes; this is a packaging/distribution change only.
- Dashboard /mcp Install tab snippet (already references `@metabob/mcp`) is unchanged.
