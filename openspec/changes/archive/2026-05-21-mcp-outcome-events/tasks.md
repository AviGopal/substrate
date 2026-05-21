# Tasks — mcp-outcome-events

- [x] 1. user-vessel: sql/006-mcp-outcome-event.surql migration.
- [x] 2. user-vessel: `src/routes/mcp-outcomes.ts` (POST + GET) wired in `src/index.ts`.
- [x] 3. user-vessel: unit tests for the route.
- [x] 4. metabob-mcp: `Telemetry.outcome()` helper + per-tool extractors invoked from `src/index.ts`.
- [x] 5. cloud-dashboard: BFF `/api/mcp/outcomes` proxy + `useMcpOutcomes` hook + `<ActivityFeed>` component on Usage tab.
- [x] 6. Build green in all three repos.
- [x] 7. Deploy user-vessel + cloud-dashboard to canary; new SHAs verified via `/health`.
- [x] 8. Real-mcp-client invocation → ≥ 3 outcome events visible at `GET /v2/mcp/outcomes`.
- [x] 9. Playwright: `<ActivityFeed>` renders with all three event types.
- [x] 10. Archive spec.
