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

## §9 VERIFY-driven amendments (2026-05-21)

Driven by `repos/development-vessel/docs/VERIFY_2026_05_21.md` (sub-repo
sha `a1c0649`). The VERIFY+DEBUG stage surfaced five gaps against the
shipped sub-repo state; these tasks close them. SPEC stage of the
four-stage loop (VERIFY → DEBUG → SPEC → DEV); DEV stage implements.

- [x] 9.1 **G5 (high)** — wire `scripts/check-shape-dispatch.ts` in
  `repos/development-vessel/`. Update `package.json` `lint` script
  to run typecheck AND shape-dispatch-check sequentially. The wrapper
  reads `DISCOVERY_SHAPES` from `src/config.ts` and `case` arms from
  `src/routes/impulses.ts`; exits non-zero on disagreement. Mirrors
  the pattern in `repos/metabob-activity-api/scripts/`. CI gate.
- [x] 9.2 **G1 (medium)** — add the 11 missing per-resolver tests in
  `test/resolvers/`:
  - `git-add.test.ts` — paths after `--` separator; reject empty paths.
  - `git-commit.test.ts` — empty staged tree returns non-zero with
    structured stderr.
  - `git-diff.test.ts` — shortstat format default; name-only override.
  - `git-log.test.ts` — limit default 5; custom format.
  - `fs-write.test.ts` — workspace-root guard rejects out-of-root.
  - `fs-edit.test.ts` — 0 occurrences and >1 occurrences both reject;
    `oldString === newString` rejects.
  - `activity-fetch.test.ts` — 200 maps to activity_template impulse;
    4xx maps to structured-error impulse without throwing.
  - `activity-create-variant.test.ts` — 200 emits variant_created;
    403 emits structured impulse with admin-scope note, doesn't throw.
  - `vessel-register-passthrough.test.ts` — payload forwarded verbatim
    to discovery; receipt impulse carries response body.
  - `code-introspect.test.ts` — symbol found returns extents; symbol
    not found returns null extents + clear note.
  - `propagate-judgment.test.ts` — weight-by-tier; 403 captured in
    `impulse_relevance_call_succeeded: false`.
- [x] 9.3 **G3 (medium)** — add `repos/development-vessel/README.md`
  with: one-paragraph topology summary pointing at CASES_AND_FLOWS.md,
  the three CLI verbs with example invocations, env-var matrix from
  R6, and the bootstrap order from design §C.
- [x] 9.4 **G4 (medium)** — add `repos/development-vessel/CLAUDE.md`
  with: vessel-specific guidelines, mirroring the pattern in
  `repos/discovery-vessel/CLAUDE.md` and `repos/metabob-activity-api/CLAUDE.md`.
  Includes the three-layer discipline reminder and the "no JSON
  templates in source" rule from design §C.
- [x] 9.5 **G2 (low)** — add `test/cli.test.ts` exercising each verb
  end-to-end with stdout/stderr capture. Uses `Bun.spawn` against the
  vessel's CLI with fixture vars; asserts exit codes and the JSON
  shape of stdout output. Pins the contract R4.4 documents.

### Spec amendments (apply to `specs/development-vessel/spec.md`)

- [x] 9.6 Tighten R1.5: replace "MUST pass against this file" with
  "MUST pass via `bun run lint` which runs both `tsc --noEmit` and
  `scripts/check-shape-dispatch.ts`. CI invokes `bun run lint` as a
  gate."
- [x] 9.7 Add R8.4: "`package.json` `lint` script chains typecheck
  and shape-dispatch-check; both must pass for CI to green."

### Acceptance for §9

- [x] 9.S.1 `bun test` reports ≥ 13 test files (1 per resolver) and
  no fails. Done 2026-05-21: 72 tests / 17 files / 0 fails.
- [x] 9.S.2 `bun run lint` invokes BOTH typecheck and
  shape-dispatch-check and exits 0. Done 2026-05-21.
- [x] 9.S.3 `repos/development-vessel/` contains README.md and CLAUDE.md.
  Done 2026-05-21: both files present.
- [x] 9.S.4 `test/cli.test.ts` exists and exercises all three CLI
  verbs with at least exit-code + stdout-shape assertions. Done 2026-05-21.

DEV stage of the four-stage cycle closes 9.1 through 9.5 + 9.6/9.7.
VERIFY stage re-runs `docs/VERIFY_2026_05_21.md` style assessment and
confirms 9.S.1–9.S.4 are met. Then the loop advances to §6 (operator
seed) and §7 (canary parity).

## §S Success criteria — acceptance gates

- [ ] S.1 `bun test` passes in `repos/development-vessel/` (0 fails)
  with at least the R8 suites covered.
- [ ] S.2 `seed-templates` lands every bootstrap template; verifiable
  via `activity_fetch` for each id.
- [ ] S.3 Activity-level parity gate (tasks.md §7) passes for
  ship-change AND branch-health.
- [ ] S.4 Demo of lift: see §10 for concrete acceptance criteria.
- [ ] S.5 First self-application: the development-vessel runs the
  `add-resolver-to-vessel` activity against itself to add a no-op
  resolver, ships the change via its own `ship-change` activity,
  and the resulting commit is visible in `git log`. Trace ids are
  captured in a final cycle report (`SELF_APPLICATION.md`).

## §10 §S.4 Lift demo — concrete acceptance

Loop stage: SPEC. Drives a subsequent DEV iteration that writes
`test/lift-demo.test.ts`.

### 10.1 — Test contract

The lift demo is a single passing vitest/bun-test case in
`repos/development-vessel/test/lift-demo.test.ts`. Setup:

- Stand up an in-process fake `fetch` (FetchPort-like) that captures
  every POST request body sent to `${METABOB_ENDPOINT}/v2/activities/impulse-relevance`.
- Construct **three** synthetic `validation_result` impulses with:
  - identical `target_variant_id: "demo_variant_v1"`
  - distinct `source_tier ∈ { "validator", "audit", "human" }`
  - `passed: false` (so the posterior pressure is on β, not α)
- Inject the fake fetch into the propagate-judgment resolver via the
  resolver factory (or via dependency-injecting `globalThis.fetch`).

Action: call the propagate-judgment resolver three times — once per
impulse — through the **same** resolver entry point. No per-tier
branches in the test or the resolver.

### 10.2 — Assertions

| Assertion | Why it proves lift |
|-|-|
| `captures.length === 3` | All three judgments landed at the activity-api endpoint. |
| `captures.every(c => c.url.endsWith("/v2/activities/impulse-relevance"))` | Single endpoint serves all tiers. |
| `captures.every(c => c.body.activity_variant_id === "demo_variant_v1")` | Same target reinforced by all three. |
| `new Set(captures.map(c => c.body.source_tier)).size === 3` | The three distinct tiers are preserved. |
| `captures.every(c => c.body.was_loaded === false && c.body.execution_succeeded === false)` | Pre-existing impulse-relevance shape carries the negative-posterior signal. |
| weights distinct per tier and monotonic (validator < audit < human) per the design.md §F default tier weights | Source-tier discrimination preserved. |
| Resolver source file `src/resolvers/propagate-judgment.ts` MUST NOT contain the literal strings `"validator"`, `"audit"`, `"human"`, `"witness"`, `"runtime"` outside the source_tier weight lookup table | Proves "no per-layer wiring": adding a 4th tier requires editing only the weight table, not the dispatch path. |

### 10.3 — The "no new wiring" assertion

The test includes a single static assertion (via file-read + regex)
that the resolver source contains exactly one location where the
source_tier strings appear: the weight table. This is the
load-bearing structural claim. Adding a sixth oracle (a new tier)
should be ONE entry in that table — nothing else.

### 10.4 — Out-of-scope for §S.4

The following are NOT part of this test:
- Real Thompson posterior updates (need live activity-api; covered
  by §S.2 after operator seed).
- Real activity execution (the test uses synthetic
  `validation_result` impulses, not actual activity output).
- LLM-tier resolvers or audit-test-report activity composition.

### 10.5 — Acceptance gate

- [ ] 10.5.1 `test/lift-demo.test.ts` exists in the sub-repo.
- [ ] 10.5.2 `bun test test/lift-demo.test.ts` passes.
- [ ] 10.5.3 The static "no new wiring" assertion (10.2 last row)
  passes against the current `src/resolvers/propagate-judgment.ts`.
- [ ] 10.5.4 The captures show three distinct source_tier values
  with their canonical weights.

### 10.6 — Next-stage hand-off

After §10.5 is green, S.4 in §S is marked done. The remaining
forward-progress autonomous-loop work is §S.5 (self-application),
which requires §6 (operator canary seed) first. The autonomous
loop's role on §S.4 ends at this VERIFY pass.
