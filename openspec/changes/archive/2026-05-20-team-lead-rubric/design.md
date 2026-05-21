# Design: Team-Lead E2E Rubric

## Scope

The rubric exercises **what a team-lead does in the dashboard**:
manage keys, observe agent activity, observe MCP usage, manage
team members, set a budget concern, switch projects. The specs
are pragmatic — assert visible UI states and a small number of
network responses; they are NOT a property test of the entire
React tree.

## The seed problem

Existing `e2e/auth.setup.ts`:
1. Navigates to `/login`.
2. Fills credentials of a seeded test user.
3. Clicks submit.
4. Saves the resulting session cookie via `page.context().storageState(...)`.

This is the right shape **if** the test user already exists, but
the prerequisite — that the user exists — is what's missing in
standalone mode. The new standalone-seed.ts handles the
prerequisite via HTTP, then either:

- **Option A (chosen)**: Skip the UI login entirely. Generate the
  JWT cookie directly from the identity-vessel `/v1/auth/login`
  response and pack it into Playwright `storageState`.
- **Option B**: Run the UI login as today but seed the user via
  HTTP first.

Option A wins because:
- One fewer moving part (UI flow can change; the JWT is the
  durable contract).
- Faster (no page load + click).
- Idempotent: the same identity-vessel login call returns a
  fresh JWT each time; the rubric never sees stale state from a
  previous run.

The JWT goes into Playwright's `storageState` cookies array
under the same name the dashboard sets (`auth-token` or whatever
identity-vessel issues — implementer reads the existing dashboard
auth code to confirm).

## standalone-seed.ts contract

```ts
// e2e/fixtures/standalone-seed.ts
export async function seedRubricUser(): Promise<{
  user: { id: string; email: string };
  org: { id: string; name: string };
  apiKey: { id: string; prefix: string; raw: string };
  storageState: { cookies: Cookie[]; origins: Origin[] };
}> {
  // 1. Ensure user exists (idempotent signup or login; ignore "already exists").
  // 2. Login → JWT.
  // 3. Ensure org exists; capture org_id.
  // 4. Ensure at least one API key exists; create if needed; capture raw.
  // 5. Build Playwright-compatible storageState with the JWT cookie
  //    and any localStorage entries the dashboard expects (e.g., the
  //    metabob_raw_api_keys stash for the Usage tab).
  // 6. Return.
}
```

The rubric specs read the returned `apiKey.raw` from
storageState's localStorage (Playwright honors `origins`
entries) so the Usage tab spec can drive the BFF call.

## Per-spec contract

### `01-onboard.spec.ts`

- Navigate to `/api-keys`. Assert the API Keys page renders.
- Click "Create new key". Assert the new-key banner appears
  with `prefix` matching the seeded key (or, if creating fresh,
  with the new key's raw value visible exactly once).
- Click "Revoke" on the seeded key (the one *not* needed for
  later specs). Assert it disappears from the list.

### `02-observe-agent.spec.ts`

Standalone mode has activity views gated. Spec asserts the
**absence** of the execution-traces nav entry and that
navigating to `/execution-traces` shows the
`ActivityViewDisabledPlaceholder`. This is the "observe-agent"
flow in standalone mode: the agent observability is intentionally
deferred to research-mode, and the spec verifies the gate works.

### `03-observe-mcp-usage.spec.ts`

- Navigate to `/mcp`. Assert three tabs visible: Tools, Install,
  Usage.
- Click Tools tab. Assert at least one tool name appears (e.g.,
  `predict_cochanges`).
- Click Install tab. Assert the `npx metabob-mcp` text is
  present.
- Click Usage tab. Select the seeded API key. Wait for the
  `/api/mcp/usage` network call.
- Assert one of: (a) summary cards rendered with non-empty
  numeric values; (b) the error card with `upstream_status: 401`
  if `/metrics` is unauthorized but `/session/stats` failed too
  — accept either outcome since the canary key may have varying
  scopes. The key assertion: the network call fired and the UI
  reacted (no crash, no infinite spinner).

### `04-manage-team.spec.ts`

- Navigate to `/team` (or whatever the team-management route is
  called — implementer confirms). Assert the seeded user's email
  appears in the members list.
- If "invite member" UI is present and works in standalone mode,
  exercise it with a throwaway email and assert the invite shows
  as pending. If not, assert the page at least loads without
  error — partial coverage is acceptable for a first rubric.

### `05-budget-check.spec.ts`

- Navigate to `/usage-analytics`. Standalone mode gates this
  route. Assert the placeholder renders (similar to
  `02-observe-agent`). If a budget-alert UI lives outside the
  gated route (e.g., on `/api-keys`), assert that instead.

### `06-cross-project-view.spec.ts`

- Navigate to `/api-keys`. If there's a project selector in the
  header, exercise it: switch to a second project (create one
  via HTTP seed if needed) and assert the API key list updates.
- If no project selector exists yet, assert the project-scope
  badge / org-scope badge is present on the API Keys page.
  Partial coverage acceptable; rubric documents the desired
  flow even if the UI hasn't shipped it.

## Risks

- **Canary instability**: rubric depends on
  identity.metabob.com, user-vessel, and ide.metabob.com being
  up. If canary is degraded, the rubric fails legitimately —
  not a flake to retry past, a real signal.
- **Schema drift**: identity-vessel signup / login endpoints
  may not match what the implementer expects. The implementer
  must grep `repos/identity-vessel/` or curl against canary
  during apply to confirm shapes (similar to the iter-5
  discovery phase).
- **`auth.setup.ts` conflict**: the existing setup project still
  exists for other (non-rubric) specs. The new rubric project
  must NOT carry the `dependencies: ["setup"]` cross-link, so
  the two flows stay independent.

## Stopping the loop

After this change archives:

- All five plan items from the loop input are archived.
- `bun run dev-loop` exits 0 with six passing specs against
  canary.
- The standalone-product loop's stopping condition is met. The
  next scheduled wakeup omits `ScheduleWakeup` to exit the
  loop cleanly.
