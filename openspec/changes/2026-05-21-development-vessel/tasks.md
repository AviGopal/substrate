# Tasks — development-vessel

Phased plan. Each phase has its own commit boundary. All commits land
on `dev` branch. The first commit is conventional (bootstrap); after
that, the vessel's own `ship-change` activity ships subsequent commits.

## §1 Scaffolding

- [x] 1.1 Create `repos/development-vessel/` with `package.json`
  (`@metabob/development-vessel`, `private: true`, deps: `hono`, `zod`,
  `@avigopal/ias-executor-ts` as `file:../ias-executor-ts`). Done 2026-05-21: commit c2d4ad6.
- [x] 1.2 `tsconfig.json` matching the strict settings used by other
  vessel repos (`noUncheckedIndexedAccess`, `strict`, etc.). Done 2026-05-21.
- [x] 1.3 `bun install`; confirm `1 package installed` for the local
  ias-executor-ts file: dep. Done: `@avigopal/ias-executor-ts@../ias-executor-ts` + hono + zod installed.
- [x] 1.4 `src/config.ts` exporting `DISCOVERY_SHAPES: string[]` listing
  every shape from spec R2. Done: all 13 R2.* shapes listed.
- [x] 1.5 Empty stubs for each resolver file under `src/resolvers/`
  (one file per R2.* entry). Done: full implementations (not stubs) — git-status/add/commit/diff/log, fs-read/write/edit, activity-fetch/create-variant, vessel-register-passthrough, code-introspect, propagate-judgment.
- [x] 1.6 `src/routes/impulses.ts` with the dispatch switch and a
  default `400 unknown shape` arm. Done: all 13 cases + default 400. 4 tests passing (git-status, fs-read).

## §2 Resolver implementations

One commit per group, all routed through `ship-change-vessel` (the
existing bootstrap path) for now. **Each resolver in this section MUST
have a paired test in `test/resolvers/<name>.test.ts` and pass before
the commit lands.**

- [x] 2.1 git_status, git_add, git_commit, git_diff, git_log
  (extract the bash-resolver pattern from
  `repos/ias-executor-ts/src/examples/ship-change-vessel.ts` but with
  typed pointers — no `command: string[]` config; the resolver assembles
  the git invocation from typed fields). Done 2026-05-21: all 5 implemented with typed Bun.spawn wrappers.
- [x] 2.2 fs_read, fs_write, fs_edit (with workspace-root guard per R5). Done 2026-05-21: workspace-root check via `process.env.WORKSPACE_ROOT`; fs-edit rejects 0-or-multiple occurrences.
- [x] 2.3 activity_fetch, activity_create_variant
  (HTTP client against METABOB_ENDPOINT; structured error impulse on 4xx). Done 2026-05-21: HTTP clients with ApiKey auth.
- [x] 2.4 vessel_register_passthrough (HTTP POST to discovery). Done 2026-05-21.
- [x] 2.5 code_introspect (regex-based; AST upgrade deferred). Done 2026-05-21: regex match with line/column info.
- [x] 2.6 propagate_judgment (HTTP POST to `/v2/activities/impulse-relevance`
  with weight by source_tier).

## §3 Bootstrap template constant

- [x] 3.1 `src/templates/boot-fetch-template.ts` exporting the literal
  `ActivityTemplate` for R3.6. Done 2026-05-21: id=development-vessel:boot-fetch-template, outputShapes=[activityTemplate], single activity_fetch task with {{templateId}} interpolation.
- [x] 3.2 Test that boot-fetch-template wraps activity_fetch correctly. Done 2026-05-21: 4 assertions in test/templates/boot-fetch-template.test.ts.

## §4 HTTP service + CLI

- [x] 4.1 `src/index.ts` — Hono app with `/health` and
  `/v2/impulses/resolve`, dispatching by pointer.type. Done: health endpoint includes `discovery.registered` flag.
- [x] 4.2 `src/discovery-registration.ts` — non-blocking startup
  registration + heartbeat loop. Failure logs but does not crash. Done 2026-05-21: 60s heartbeat, re-register on heartbeat fail, stopDiscoveryRegistration() for clean shutdown.
- [x] 4.3 `src/cli.ts` — argument parser for the three verbs in R4
  (run-activity, seed-templates, call-resolver). Done 2026-05-21: seed-templates iterates SEED_TEMPLATES + uploads via activity_create_variant; call-resolver dispatches via resolveDispatch; run-activity fetches template by id (full execution after §5).
- [x] 4.4 Integration test `test/vessel-integration.test.ts` — boots
  the HTTP server with a fake activity-api adapter, issues a
  resolve call, asserts the response. Done 2026-05-21: 5 tests covering health, fs_read, git_status, unknown shape 400, missing type 400.

## §5 Bootstrap templates (uploaded by seed-templates)

Each template is defined in `src/seed/<name>.ts` as an `ActivityTemplate`
constant. The `seed-templates` CLI verb iterates the list and uploads
each via `activity_create_variant`.

- [x] 5.1 `src/seed/ship-change.ts` — port of the existing
  ship-change-vessel activity, using R2.x resolvers (git_add, git_commit,
  git_log). Done 2026-05-21.
- [x] 5.2 `src/seed/branch-health.ts` — port of the existing
  branch-health activity, using R2.x resolvers (git_status, git_diff,
  git_log). Done 2026-05-21.
- [x] 5.3 `src/seed/release-change.ts` — new composition:
  ship-change → branch-health → assertion. Done 2026-05-21: git_add + git_commit + git_status + git_log.
- [x] 5.4 `src/seed/add-resolver-to-vessel.ts` — fs_read + fs_edit +
  ship-change. Done 2026-05-21: fs_read + fs_edit + git_add + git_commit.
- [x] 5.5 `src/seed/propagate-judgment.ts` — single-task wrapping R2.13. Done 2026-05-21.
- [x] 5.6 Test `test/seed-templates-dry-run.test.ts` — confirms every
  bootstrap template parses + lists every resolver it references in
  the vessel's advertised shapes. Done 2026-05-21: 20 assertions across 5 templates.

## §6 Seed the canary

- [ ] 6.1 Operator runs `bun run repos/development-vessel/src/cli.ts
  seed-templates` against the canary activity-api. Output is the
  list of `variant_created` impulses; commit the raw output as
  `repos/development-vessel/seed-output.txt` for reference.
- [ ] 6.2 Verify each template can be fetched back via R2.9 and
  contents match what was uploaded.

## §7 Parity verification

- [ ] 7.1 Run the development-vessel's `branch-health` activity
  against the super-repo cwd. Compare to
  `validation/scripts/verify-branch-health.ts` output. Must match
  on every field per R10.2.
- [ ] 7.2 Run the development-vessel's `ship-change` activity to
  commit a no-op marker file. Trace + commit sha must match what
  the existing `ship-change-vessel.ts` would produce.
- [ ] 7.3 Once 7.1 and 7.2 pass, this development-vessel becomes
  the durable shipping path for subsequent commits.

## §8 Cleanup (separate cycle)

- [ ] 8.1 Remove `repos/ias-executor-ts/src/examples/ship-change-vessel.ts`
  and its test.
- [ ] 8.2 Remove `repos/ias-executor-ts/src/examples/branch-health.ts`
  and its test.
- [ ] 8.3 Remove `validation/scripts/verify-branch-health.ts` (now
  superseded by the activity-level parity check in 7.1).
- [ ] 8.4 Update CLAUDE.md to point at the development-vessel as the
  canonical shipping path.

## §S Success criteria — acceptance gates

- [ ] S.1 `bun test` passes in `repos/development-vessel/` (0 fails)
  with at least the R8 suites covered.
- [ ] S.2 `seed-templates` lands every bootstrap template; verifiable
  via `activity_fetch` for each id.
- [ ] S.3 Activity-level parity gate (tasks.md §7) passes for
  ship-change AND branch-health.
- [ ] S.4 Demo of lift: a single failing trace produces posterior
  pressure through ≥ 2 independent judgment paths (e.g., validator +
  propagate_judgment) without per-layer wiring beyond resolver
  registration. Recorded as a test in `test/lift-demo.test.ts` with
  fake activity-api capture of impulse-relevance writes.
- [ ] S.5 First self-application: the development-vessel runs the
  `add-resolver-to-vessel` activity against itself to add a no-op
  resolver, ships the change via its own `ship-change` activity,
  and the resulting commit is visible in `git log`. Trace ids are
  captured in a final cycle report (`SELF_APPLICATION.md`).
