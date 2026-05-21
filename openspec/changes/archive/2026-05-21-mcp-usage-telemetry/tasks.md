# Tasks: MCP Usage Telemetry

## §1 user-vessel schema + endpoints

- [x] 1.1 Create migration
      `repos/user-vessel/sql/<NNN>-mcp-usage-snapshot.surql` per
      design.md "Data model".
- [x] 1.2 Add the migration to user-vessel's startup migration list.
- [x] 1.3 Implement `POST /v2/mcp/usage` handler. ApiKey auth via
      existing identity-vessel resolve path. Upsert semantics per
      design.md "API contracts".
- [x] 1.4 Implement `GET /v2/mcp/usage?api_key_id=<id>` handler.
      JWT auth. SELECT FROM `mcp_usage_snapshot` WHERE
      `api_key_id = $api_key_id`. PERMISSIONS handle org scoping.
      Empty snapshot returns zero-shape body, not 404.
- [x] 1.5 Unit tests in user-vessel covering: upsert creates row,
      upsert increments counters, cross-org read returns empty,
      missing api_key_id → 400.

## §2 metabob-mcp telemetry

- [x] 2.1 Create `repos/metabob-mcp/src/telemetry.ts` per design.md.
      Fire-and-forget, in-memory buffer, `METABOB_TELEMETRY=off`
      kill switch.
- [x] 2.2 In `src/index.ts`, instantiate `Telemetry` next to
      `AuthService`. Endpoint defaults to
      `process.env.USER_VESSEL_URL || "https://user.metabob.com"`.
- [x] 2.3 Wire into the tool dispatch path. After every
      `TOOL_REGISTRY[name](params)` returns / throws, call
      `telemetry.record({ tool_name, success, duration_ms,
      error_code, mcp_version })`.
- [x] 2.4 Document the kill switch in mcp's README + CLAUDE.md.
- [x] 2.5 Unit test the telemetry module: buffer behavior on
      transport failure, kill switch, basic round-trip with a
      fetch mock.

## §3 cloud-dashboard BFF rewrite

- [x] 3.1 Rewrite `/api/mcp/usage` handler in
      `repos/metabob-cloud-dashboard/src/index.ts` to
      `GET ?api_key_id=<id>` proxying to user-vessel.
- [x] 3.2 Keep `POST { raw_key }` accepting for one release with a
      deprecation log + a fallback to user-vessel using `api_key_id`
      from the body (ignore `raw_key`). Drop in a follow-up.
- [x] 3.3 Update `useMcpUsage` hook signature: accept
      `apiKeyId | null` instead of `{ rawKey, apiKeyId? }`. Query
      via GET.
- [x] 3.4 Update `UsageTab.tsx`: key selector passes `apiKeyId`
      only; remove the rawKeyStash dependency. Leave the stash
      module in place with a deprecation comment.
- [x] 3.5 Update the cards: `total_calls`, `total_failures`,
      `last_seen_at`, by-tool breakdown derived from `by_tool`
      object.

## §4 Rubric extension

- [x] 4.1 Create `e2e/fixtures/mcp-workspace/` with 3 small text
      files (a `package.json`, a `src/index.ts`, a `README.md`)
      sufficient for `init_workspace` to produce a CPG index.
- [x] 4.2 Extend `e2e/rubric/03-observe-mcp-usage.spec.ts`
      `beforeAll`: spawn `bunx metabob-mcp` as subprocess with the
      seeded key + workspace fixture. Invoke `init_workspace` via
      MCP stdio. Wait for response. Poll user-vessel
      `/v2/mcp/usage?api_key_id=<seeded>` until `total_calls >= 1`
      (10s timeout).
- [x] 4.3 In the main test body, after navigating to `/mcp` →
      Usage → selecting the seeded key, assert summary cards show
      `total_calls >= 1` and `by_tool.init_workspace >= 1`.
- [x] 4.4 `afterAll`: kill the mcp subprocess. Best-effort delete
      the snapshot row.
- [x] 4.5 If subprocess approach is flaky in CI, fall back: a
      small `e2e/fixtures/emit-telemetry.ts` script that POSTs
      directly to user-vessel `/v2/mcp/usage`. Spec selects
      whichever path exists.

## §5 Verification

- [x] 5.1 Local: boot user-vessel against canary surreal, hit
      `POST /v2/mcp/usage` with the seeded key, verify row appears
      via direct SurrealDB query.
- [x] 5.2 Local: hit `GET /v2/mcp/usage?api_key_id=<id>` with the
      seeded JWT, verify shape matches design.md.
- [x] 5.3 Boot dashboard locally with canary backends, navigate
      `/mcp` Usage tab, select the seeded key, verify the cards
      render with the values from §5.1.
- [x] 5.4 Run the extended rubric: `bun run dev-loop` with
      `E2E_STANDALONE_MODE=true`. Confirm
      `passed + skipped = total, failed = 0`.

## §6 Deploy

- [x] 6.1 Deploy user-vessel to canary (`/deploy` skill). Confirm
      migration ran. Confirm `/v2/mcp/usage` GET + POST endpoints
      respond.
- [x] 6.2 Deploy metabob-cloud-dashboard to canary. Confirm
      `/api/mcp/usage` returns the new shape from user-vessel.
- [x] 6.3 metabob-mcp is a client install — no canary deploy needed.
      Tag a new release (0.2.7?) and push to npm in a follow-up.

## §7 Commits + archive

- [x] 7.1 Commits (no Co-Authored-By):
      - `repos/user-vessel`:
        `feat(mcp-usage): /v2/mcp/usage endpoints + snapshot table`
      - `repos/metabob-mcp`:
        `feat(telemetry): post tool-call snapshots to user-vessel`
      - `repos/metabob-cloud-dashboard`:
        `feat(usage): swap /api/mcp/usage to user-vessel telemetry`
      - super-repo:
        `docs(boundaries): mcp-usage-telemetry spec + 3 submodule bumps`
- [x] 7.2 Push all four.
- [x] 7.3 Archive: move change dir to
      `openspec/changes/archive/2026-05-21-mcp-usage-telemetry/`
      and lift spec to
      `openspec/specs/mcp-usage-telemetry/spec.md`.
- [x] 7.4 Update `docs/PRODUCT_BOUNDARIES.md`: the "MCP surface in
      dashboard" section's Usage paragraph should reference the
      telemetry shim instead of the rpc-api hop.
