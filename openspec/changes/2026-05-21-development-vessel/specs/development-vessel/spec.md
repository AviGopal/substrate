# spec: development-vessel

## R1 — Package + topology

- R1.1 Package lives at `repos/development-vessel/` with `package.json`
  name `@metabob/development-vessel`.
- R1.2 Declares `@avigopal/ias-executor-ts` as a `file:../ias-executor-ts`
  dependency (workspace-local for now).
- R1.3 Has `src/index.ts` (HTTP entry) and `src/cli.ts` (in-process
  entry). Both import the same resolver modules from `src/resolvers/`.
- R1.4 Has `src/config.ts` exporting the discovery shape list (see R2).
- R1.5 Has `src/routes/impulses.ts` with a single `POST /v2/impulses/resolve`
  handler dispatching by `pointer.type`. Every advertised shape has a
  matching case. The shape-dispatch-check script in `packages/
  shape-dispatch-check/` MUST pass via `bun run lint`, which runs
  `tsc --noEmit` AND `scripts/check-shape-dispatch.ts` sequentially.
  CI invokes `bun run lint` as a gate. (Amended 2026-05-21 §9.6.)

## R2 — Advertised shapes (resolvers)

The vessel advertises these shapes in `config.discovery.shapes`. Each
has a corresponding resolver in `src/resolvers/<name>.ts`.

### R2.1 — git_status

- Input: `pointer.type === "git_status"`, optional `pointer.cwd`.
- Output: ONE impulse of shape `commandResult` carrying
  `{ exitCode, stdout, stderr }` from `git status --porcelain`.
- Tests: clean tree → empty stdout, exit 0; outside repo → stderr +
  exit 128.

### R2.2 — git_add

- Input: `pointer.type === "git_add"`, `pointer.paths: string[]`,
  optional `pointer.cwd`.
- Output: ONE `commandResult` from `git add -- <paths>`.
- MUST insert `--` separator before paths so a path starting with `-`
  is treated as a path.

### R2.3 — git_commit

- Input: `pointer.type === "git_commit"`, `pointer.message: string`,
  optional `pointer.cwd`.
- Output: ONE `commandResult` from `git commit -m <message>`.
- Empty staged tree → exit 1 with `nothing to commit`. Resolver does
  NOT distinguish error cases; the consumer reads exitCode.

### R2.4 — git_diff

- Input: `pointer.type === "git_diff"`, optional `pointer.cwd`,
  optional `pointer.revision` (defaults to `HEAD`),
  optional `pointer.format` ∈ `{"shortstat", "name-only"}`
  (default `shortstat`).
- Output: ONE `commandResult` from `git diff --<format> <revision>`.

### R2.5 — git_log

- Input: `pointer.type === "git_log"`, optional `pointer.cwd`,
  optional `pointer.limit` (default 5), optional `pointer.format`
  (default `%s` — subject only).
- Output: ONE `commandResult` from `git log -<limit> --pretty=<format>`.

### R2.6 — fs_read

- Input: `pointer.type === "fs_read"`, `pointer.path: string`,
  optional `pointer.encoding` (default `utf-8`),
  optional `pointer.byteLimit` (default 1 MiB).
- Output: ONE impulse of shape `fileContent` with
  `{ path, bytes, content, truncated }`.
- Reads must reject paths outside the configured workspace root (R5).

### R2.7 — fs_write

- Input: `pointer.type === "fs_write"`, `pointer.path: string`,
  `pointer.content: string`, optional `pointer.createDirs: boolean`.
- Output: ONE impulse of shape `fileWriteResult` with `{ path, bytesWritten }`.
- Same workspace-root restriction as fs_read.

### R2.8 — fs_edit

- Input: `pointer.type === "fs_edit"`, `pointer.path: string`,
  `pointer.oldString: string`, `pointer.newString: string`.
- Output: ONE `fileEditResult` with `{ path, replacedCount }`.
- Reject if `oldString` matches 0 or > 1 times (force callers to be
  explicit). Reject if `oldString === newString`.

### R2.9 — activity_fetch

- Input: `pointer.type === "activity_fetch"`, `pointer.templateId: string`.
- Output: ONE impulse of shape `activity_template` (mirrors activity-api's
  return shape).
- Implementation: HTTP GET `/v2/activities/templates/:templateId` against
  the configured activity-api endpoint with the configured API key.

### R2.10 — activity_create_variant

- Input: `pointer.type === "activity_create_variant"`,
  `pointer.template: ActivityTemplate`,
  optional `pointer.parentTemplateId: string` (for genealogy).
- Output: ONE impulse of shape `variant_created` with
  `{ variantId, parentTemplateId?, accepted }`.
- Implementation: HTTP POST to activity-api's variant-creation endpoint.
  Uses write-scope key. Reports clear failure on 403 (admin scope
  required) WITHOUT crashing the dispatch.

### R2.11 — vessel_register_passthrough

- Input: `pointer.type === "vessel_register_passthrough"`,
  `pointer.registration: VesselRegistration` (full payload conforming
  to discovery-vessel's `/register` schema).
- Output: ONE `vesselRegistrationReceipt` with discovery's response
  body (vessel_id, expires_at, etc.).
- Implementation: HTTP POST to discovery-vessel's `/register`. This is
  a brokered call; the vessel being registered does not need its own
  discovery client code.

### R2.12 — code_introspect

- Input: `pointer.type === "code_introspect"`, `pointer.path: string`,
  optional `pointer.symbol: string` (e.g. resolver name).
- Output: ONE `codeIntrospection` impulse with
  `{ path, symbol?, fileExtents: {start,end}, content }`.
- Smallest useful surface: read file, find the symbol's line range via
  a simple regex (`function <symbol>` or `const <symbol> =`). Full AST
  introspection is out-of-scope for the skeleton; document the upgrade
  path.

### R2.13 — propagate_judgment

- Input: `pointer.type === "propagate_judgment"`,
  `pointer.judgment: <validation_result-shape impulse content>`,
  `pointer.target_variant_id?: string`,
  `pointer.source_tier?: "validator" | "witness" | "audit" | "human" | "runtime"`,
  optional `pointer.weight?: number` (override the default for the tier).
- Output: ONE `judgment_propagated` impulse with
  `{ target_variant_id, source_tier, weight_applied, posterior_delta,
     impulse_relevance_call_succeeded }`.
- Implementation: HTTP POST `/v2/activities/impulse-relevance` with the
  appropriate payload. On 403 or transport failure: emit the
  `judgment_propagated` impulse with `impulse_relevance_call_succeeded: false`
  and capture the error in a `notes` field. Do NOT throw.

## R3 — Bootstrap templates

These are uploaded to activity-api by `seed-templates` (R7). Each one
is a tested activity that uses only the resolvers in R2.

- R3.1 **ship-change** `{ paths: string[], message: string, cwd: string }`
  → emits `gitCommitResult`. Composes git_status (pre-check) +
  git_add + git_commit + git_log (capture sha) + a synthesis task
  that folds into the typed report.
- R3.2 **branch-health** `{ cwd: string }` → emits `branchHealthReport`.
  Composes git_status + git_diff + git_log + synthesis.
- R3.3 **release-change** `{ paths, message, cwd }` → emits
  `releaseChangeReport`. Composes ship-change (via activity resolver)
  then branch-health then a synthesis task that asserts post-commit
  branch health is non-degraded.
- R3.4 **add-resolver-to-vessel** `{ vesselPath, resolverName, sourcePatch }`
  → emits `vesselUpdated`. Composes fs_read (current source) +
  fs_edit (apply patch) + ship-change.
- R3.5 **propagate-judgment** wraps R2.13 as an activity for cross-vessel
  invocation. Single-task activity.
- R3.6 **boot-fetch-template** `{ templateId }` → emits `activity_template`.
  Single-task activity wrapping R2.9. **This is the only template that
  exists as a TypeScript constant in vessel source** because it must
  be available before any other template can be fetched. Lives in
  `src/templates/boot-fetch-template.ts`.

## R4 — CLI surface

- R4.1 `bun run repos/development-vessel/src/cli.ts run-activity <templateId> [vars-json]`
  — fetch + execute an activity by id.
- R4.2 `bun run repos/development-vessel/src/cli.ts seed-templates`
  — upload R3.1–R3.5 to activity-api via R2.10. Idempotent: if a
  variant with the same name already exists under our scope, skip.
- R4.3 `bun run repos/development-vessel/src/cli.ts call-resolver <type> <pointer-json>`
  — invoke a single resolver in-process. Used by tests + the
  autonomous loop.
- R4.4 All CLI verbs print the resulting impulse(s) as JSON to stdout
  and the trace summary to stderr.

## R5 — Workspace-root restriction

- R5.1 Every fs_* resolver rejects paths outside a configured
  workspace root (default: `process.cwd()`). Override via
  `MB_WORKSPACE_ROOT` env var.
- R5.2 The rejection path emits the failure impulse with a clear note;
  it does NOT throw. The consumer reads the impulse.

## R6 — Auth + endpoint configuration

- R6.1 Reads `METABOB_API_KEY` (required), `METABOB_ENDPOINT`
  (default `https://activity.metabob.com`), `DISCOVERY_ENDPOINT`
  (default `https://discovery.metabob.com`).
- R6.2 In local/CLI mode, missing keys produce a clear error from the
  CLI before any resolver runs. In HTTP mode, missing keys log a
  startup warning; resolvers that need them fail with a structured
  error impulse.

## R7 — Startup behaviour (HTTP mode)

- R7.1 On boot: register with discovery-vessel via R2.11 internally
  (calling its own resolver). Failure does NOT block boot.
- R7.2 Heartbeat every 60s. Failure does NOT crash the server;
  exponential backoff up to 5 minutes.
- R7.3 Expose `GET /health` returning `{ status, discovery_registered,
  last_heartbeat_at }`.

## R8 — Tests

Three suites must pass:

- R8.1 `test/resolvers/*.test.ts` — one file per resolver in R2.
- R8.2 `test/vessel-integration.test.ts` — boots the HTTP server,
  exercises a multi-resolver chain end-to-end with a fake activity-api.
- R8.3 `test/cli.test.ts` — exercises each CLI verb in R4 with
  fixture inputs.
- R8.4 (added 2026-05-21 §9.7) `package.json` `lint` script chains
  `tsc --noEmit` and `scripts/check-shape-dispatch.ts`; both must
  pass for CI to green.

CI gate: `bun test` passes (0 fails) and `bun run lint` passes.

## R9 — Documentation

- R9.1 `repos/development-vessel/README.md` — quickstart with the
  three CLI verbs and a one-paragraph topology summary pointing at
  `docs/CASES_AND_FLOWS.md`.
- R9.2 `repos/development-vessel/CLAUDE.md` — vessel-specific
  guidelines, mirroring the pattern in other vessel repos.
- R9.3 `repos/development-vessel/docs/CASES_AND_FLOWS.md` —
  **already exists** (committed 2026-05-21 in `66b7b47c`). Keep
  intact; reference from R9.1.

## R10 — Non-regression

- R10.1 The vessel's first run of `seed-templates` MUST land all of
  R3.1–R3.5 in activity-api. Failure of any single one fails the
  seed run; partial state is reported.
- R10.2 After seed completes, running `branch-health` via this vessel
  MUST produce a `branchHealthReport` whose factual content matches
  the existing `validation/scripts/verify-branch-health.ts` output
  when run against the same cwd. This is the parity gate before
  removing the example files in §K of design.md.
