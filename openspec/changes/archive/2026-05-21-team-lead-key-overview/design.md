# Design: Team-Lead Key Overview

## Scope and rationale

Tight scope: solve the **acute** team-lead pain (no cross-key
view, raw key in UI). The richer "team activity feed" and
"by-developer rollup" stories are intentionally deferred — both
need product-shape decisions that this change shouldn't
foreclose.

Three repos touched, one new endpoint, one security fix, three
small UI changes, one rubric extension. Each change is reversible
and orthogonal.

## Batch endpoint

`GET /v2/mcp/usage` (no query params) on user-vessel.

```
GET /v2/mcp/usage
Authorization: Bearer <jwt>

→ 200
{
  "snapshots": [
    {
      "api_key_id": "key_dA7636J6QKif0k8u",  // gitleaks:allow public key_id, not a credential
      "org_id": "organizations:tl_org_…",
      "user_id": "users:…",
      "total_calls": 12,
      "total_failures": 1,
      "last_seen_at": "2026-05-21T18:30:11Z",
      "first_seen_at": "2026-05-21T18:30:09Z",
      "by_tool": { "get_problems": 3, … },
      "mcp_version": "0.2.6"
    },
    …
  ]
}
```

Empty response (no telemetry yet): `{ "snapshots": [] }`. Never
404.

Implementation note: the existing `GET /v2/mcp/usage?api_key_id=`
stays as-is. The new path is the SAME route — when `api_key_id`
query param is absent, return the array form; when present,
return the single-snapshot form (existing). Same handler, branch
on `c.req.query("api_key_id")`. SurrealDB PERMISSIONS scope the
SELECT to caller's org_id automatically.

## identity-vessel `/v1/keys` audit + redaction

Two phases:

**Phase 1 — Audit.** Read
`repos/identity-vessel/src/resolvers/list-keys.ts` (or the
appropriate file — grep `app.get("/v1/keys"` first). Determine
whether the current response shape includes the raw `key`. If it
does NOT, this section is a no-op for the change beyond a regression
test.

**Audit result (2026-05-21):** The handler at
`repos/identity-vessel/src/index.ts:1076` selects
`id, key_id, key_prefix, org_id, user_id, name, prefix, scopes,
is_active, created_at, expires_at` and never emits the raw `key`
field. It does expose `prefix` (the public base64-encoded
identifier portion of the raw key, lacking the HMAC suffix that
makes a credential authenticable). `prefix` is long enough to trip
the rubric's heuristic raw-key regex `mb-[A-Za-z0-9+/=_-]{30,}`,
but it is not itself a credential. **Phase 2 (redaction) skipped.**
The dashboard fix instead truncates `prefix` to 12 chars at the
render layer (see R4 implementation in `UsageTab.tsx`).

**Phase 2 — Redact (if needed).** The response shape becomes:

```ts
type ApiKeyListEntry = {
  key_id: string;
  key_prefix: string;   // first 12 chars of the raw key, e.g. "mb-b3JnYW5p"
  name?: string;
  scopes: string[];
  created_at: string;
  expires_at?: string;
  is_active: boolean;
};
```

`key_prefix` is sufficient to identify a key in a UI (the prefix
is shown at create time on the NewKeyBanner; users can match it).
Raw `key` is removed.

**Backward compatibility**: cloud-dashboard reads `key` today.
The dashboard change in §3 below adds prefix-fallback handling so
either response shape works. Once dashboard is deployed, the
backend redaction can land safely.

**Schema impact**: `mcp_usage_snapshot` and the api_key table
already store both `key_id` (the stable id) and key material. No
schema change.

## cloud-dashboard inline usage badges

In `APIKeysPage.tsx`:

```tsx
import { useApiKeys, useAllMcpUsage } from "./hooks/useApiKeys";

const { data: keys } = useApiKeys();
const { data: usageMap } = useAllMcpUsage();   // map<api_key_id, snapshot>

return (
  <ul>
    {keys.map(k => {
      const snap = usageMap?.[k.key_id];
      return (
        <li key={k.key_id}>
          <KeyHeader {…k} />
          <UsageBadge snapshot={snap} />
        </li>
      );
    })}
  </ul>
);
```

New hook `useAllMcpUsage()` in `src/features/mcp/hooks/`:

```ts
export function useAllMcpUsage() {
  return useQuery({
    queryKey: ["mcp-usage-all"],
    queryFn: async () => {
      const r = await fetch("/api/mcp/usage", { credentials: "include" });
      if (!r.ok) throw new Error(`mcp usage failed: ${r.status}`);
      const body = await r.json();
      // Index by api_key_id for O(1) lookup
      return Object.fromEntries(
        (body.snapshots ?? []).map((s: any) => [s.api_key_id, s])
      );
    },
    staleTime: 30_000,
  });
}
```

BFF rewrite in `src/index.ts`: when `GET /api/mcp/usage` arrives
with NO `api_key_id` param, proxy to user-vessel `GET /v2/mcp/usage`
without the param. (The existing single-key path is preserved.)

`UsageBadge` component:

```tsx
function UsageBadge({ snapshot }: { snapshot?: McpUsageSnapshot }) {
  if (!snapshot || snapshot.total_calls === 0) {
    return <span className="badge-muted">no activity yet</span>;
  }
  return (
    <span className="badge">
      {snapshot.total_calls} calls · last seen {relativeTime(snapshot.last_seen_at)}
      {snapshot.total_failures > 0 && (
        <span className="badge-warn"> · {snapshot.total_failures} failed</span>
      )}
    </span>
  );
}
```

`relativeTime()` is "5 min ago", "2 hrs ago", "Yesterday", "3 days
ago" — a small helper. No external dependency.

## Usage tab dropdown label fix

Today the option label is built like:
```ts
`${k.name || k.key_id} (${k.key})`
```

After the fix:
```ts
`${k.name || k.key_id} · ${k.key_prefix ?? truncate(k.key, 12)}`
```

The `truncate(k.key, 12)` fallback handles the transitional case
where identity-vessel still returns raw `key`. After redaction
lands, `k.key_prefix` is always present.

## Rubric extension

Add to `e2e/rubric/01-onboard.spec.ts` (after the existing
create/revoke assertions):

```ts
test("inline usage badge appears after telemetry", async ({ page }) => {
  // Telemetry was already seeded in globalSetup for the rubric key
  await page.goto("/api-keys");
  const seededRow = page.locator(`[data-key-id="${credentials.apiKey.id}"]`);
  await expect(seededRow.getByText(/\d+ calls/)).toBeVisible();
  await expect(seededRow.getByText(/last seen/)).toBeVisible();
});

test("dropdown labels don't leak raw key", async ({ page }) => {
  await page.goto("/mcp");
  await page.getByRole("tab", { name: "Usage" }).click();
  const options = await page.locator("select option").allTextContents();
  for (const opt of options) {
    // Raw keys are `mb-` + base64 + `-` + 32-char hex hmac
    // Prefix form is just `mb-` + first 8 chars of base64
    expect(opt).not.toMatch(/mb-[A-Za-z0-9+/=_-]{30,}/);
  }
});
```

The regex `mb-[A-Za-z0-9+/=_-]{30,}` is a heuristic — raw keys
in this system are ~250 chars; prefix is ~12. The 30+ char
threshold catches raw without false-positiving short prefixes.

## Risks

- **N+1 across orgs.** A future org with thousands of keys
  hitting `GET /v2/mcp/usage` returns thousands of rows. Today's
  scenario has 2-10 keys per org; not a concern. When it
  becomes one, add pagination. Bound the response at 500 rows
  initially with a `total` field so the dashboard can warn if
  truncated.
- **Backward-compat window.** The dashboard must handle BOTH
  identity-vessel responses (with and without `key`) during the
  deploy window. Verified by the `truncate` fallback.
- **Stale snapshot.** Telemetry can lag the UI by `staleTime`
  (30s). Acceptable; team lead is doing org-level oversight, not
  real-time monitoring. The dropdown selection still fires a
  fresh fetch via the existing `useMcpUsage(api_key_id)` hook.

## Out of scope

- Per-developer rollup (one user, multiple keys).
- Time-windowed views ("calls this week").
- Event log (per-call detail).
- mcp client npm release.
- `rawKeyStash` cleanup.
- user-vessel `/health` hardcoded version.

## Verification

1. Local: hit `GET /v2/mcp/usage` against canary surreal with two
   seeded snapshots — confirm array shape.
2. Local: hit `GET /v1/keys` against canary — confirm `key`
   redacted to `key_prefix`.
3. Local: boot dashboard against canary, log in as the team-lead
   scenario user, visit `/api-keys` — confirm inline badges
   render with correct counts.
4. Local: visit `/mcp` → Usage — confirm dropdown labels show
   prefix only.
5. Rubric: `bun run dev-loop` → `failed: 0`, two new spec
   assertions pass.
6. Canary deploy: user-vessel → identity-vessel → cloud-dashboard
   (in that order; the dashboard's fallback handles either
   identity-vessel response shape).
7. Live curl + visual probe at `app.metabob.com`.
