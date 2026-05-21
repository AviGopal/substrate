# Tasks — raw-key-stash-cleanup

- [x] 1. Delete `src/features/mcp/lib/rawKeyStash.ts`.
- [x] 2. Remove `stashRawKey` / `forgetRawKey` imports + call-sites from `APIKeysPage.tsx`.
- [x] 3. Drop the legacy `POST /api/mcp/usage` branch from `src/index.ts`.
- [x] 4. Update `UsageTab.tsx` header comment.
- [x] 5. `bun run build` green.
- [x] 6. Commit on dev + push.
- [x] 7. Deploy cloud-dashboard to canary.
- [x] 8. Real-mcp-client invocation verifies telemetry still lands.
- [x] 9. Playwright on /mcp Usage tab confirms cards render.
- [x] 10. Archive spec.
