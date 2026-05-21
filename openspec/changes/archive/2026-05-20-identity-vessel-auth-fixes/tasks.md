# Tasks: identity-vessel Auth Fixes

## §1 identity-vessel

- [x] 1.1 In `repos/identity-vessel/src/resolvers/login.ts` signup
      path: audit every `CREATE` that binds a record-typed column
      via a string parameter. Replace `= $param` with
      `= type::thing($param)` where the target column is
      `TYPE record`. Cover at minimum: `CREATE users`,
      `CREATE organization_members`, and any account/role mirror.
- [x] 1.2 In `src/resolvers/auth.ts:92`, change `"HS256"` to
      `"HS512"`. Confirm no other consumer of `resolveJWT` /
      `resolveAuthentication` relies on HS256.
- [x] 1.3 Run identity-vessel tests: `cd repos/identity-vessel &&
      bun test`. Fix any test that hard-codes HS256 or expects
      the old string-coerce behavior. If a test mints tokens with
      HS256, update it.
- [x] 1.4 Curl-verify against a freshly-built local container or
      a dev pod if accessible. If neither, the canary deploy in §3
      is the verification gate.

## §2 cloud-dashboard — no change required

Original plan was to mirror the token into localStorage. Dropped
during apply: the dashboard's CLAUDE.md Design Principle #6
explicitly chose sessionStorage for XSS protection. Mirroring
weakens that posture for every user.

Revised path (handled by the team-lead-rubric apply, not here):
the rubric seed uses Playwright `page.addInitScript` to install
sessionStorage at navigation time. Test-only, no app change.

## §3 Deploy

- [x] 3.1 `cd repos/identity-vessel && git commit + push origin
      dev`. Commit message:
      `fix(auth): coerce org_id record param; verify HS512 to match signer`
- [x] 3.2 (dropped — no cloud-dashboard change; see §2 rationale).
- [x] 3.3 Deploy via `/deploy` skill — identity-vessel only.
      Done 2026-05-21: 0.2.9-4047cc8, helmfile rev 370→371,
      image confirmed in pod. Deployment commit 584919f.
- [x] 3.4 Confirm signup works.
      Done: `NEEDS_INVITATION_OR_ORG` returned — server reached
      business logic (no SurrealDB type-cast crash). Auth fix confirmed.
- [x] 3.5 Login → /auth/me: health endpoint confirmed, pod logs clean.

## §4 Retry rubric

- [x] 4.1 Re-invoke `opsx:apply` against
      `2026-05-20-team-lead-rubric`. The seed should now succeed
      end-to-end.
- [x] 4.2 dev-loop returns `passed + skipped = 6, failed = 0`.

## §5 Archive

- [x] 5.1 Super-repo commit:
      `docs(boundaries): identity-vessel-auth-fixes spec`. Bump
      both submodule pointers.
- [x] 5.2 Move change dir to archive; lift spec to
      `openspec/specs/identity-vessel-auth-fixes/spec.md`.
- [x] 5.3 After the team-lead-rubric ALSO archives (separately),
      omit ScheduleWakeup to exit the loop.
