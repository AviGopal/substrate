# Tasks — autonomous-palette-write-resolvers

Four-stage loop: VERIFY → DEBUG → SPEC (this doc) → DEV.

## DEV-1: Cross-check palette location + write-resolver wiring

- [x] Confirm palette location: prompt template in
      `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`
      line 32 (`Use ONLY these resolver names: ...`).
- [x] Confirm `concept_create_write` is wired in concept-db
      (`src/routes/impulses.ts` line 727, config line 198).
- [x] Confirm `conceptLink_write` is wired in concept-db
      (`src/routes/impulses.ts` line 766).
- [x] Confirm `substrateGap_write` is wired in development-vessel
      (`src/resolvers/substrate-gap.ts` + `src/config.ts` line 69 +
      `src/routes/impulses.ts` line 99).
- [x] Confirm boredom-vessel does NOT gate the palette — it only
      dispatches goals (`repos/boredom-vessel/src/index.ts`); the
      drafter composes freely under prompt constraints.

## DEV-2: Update the palette in draft-gap-closing-activity prompt

- [x] Edit `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`:
  - [x] Extend the resolver allowlist on line 32 to include the three
        new writes.
  - [x] Add a dispatch-contract section to the prompt describing each
        new resolver's target endpoint, pointer shape, and required
        fields. Use `http_fetch` for the dispatch (existing palette
        primitive); target the concept-db `/v2/impulses/resolve`
        endpoint at `http://127.0.0.1:8260` for concept writes and the
        dev-vessel `/v2/impulses/resolve` endpoint at
        `http://127.0.0.1:8270` for `substrateGap_write`.
- [x] `cd repos/development-vessel && bun run typecheck` — clean.

## DEV-3: Hot-reload dev-vessel + re-seed the template

- [x] `make -C scripts/substrate restart-development-vessel` to sync
      the updated source into the running container.
- [x] `bun run cli seed-templates` (inside the dev-vessel) to push the
      updated template body to activity-api as a variant.

## DEV-4: Dispatch the unlock goal + verify concept accrual

- [x] Pre-mint a `vessel_construction_pattern` concept describing the
      unlock pattern (so the verification has a stable anchor even if
      the autonomous run mints a sibling). Use `mcp__metabob__concept_create`.
- [x] Link the new concept to `vessel_resolve_handler_dual_form`
      (`⟨concept_y-CPpfVcAhL0⟩`) via `mcp__metabob__concept_link`.
- [x] Dispatch via `mcp__metabob__run_goal`: "Author and execute a
      meta-activity that mints a concept for the autonomous-palette
      unlock and links it to vessel_resolve_handler_dual_form."
- [x] Record the resulting executionId + status.
- [x] `mcp__metabob__concept_search` for any new concepts and verify
      at least one has a substrate-authored `source_type`.

## DEV-5: Report

- [x] Capture git status (no commits).
- [x] Note any concept-pollution risk surfaced during the run and file
      a follow-up if material.

## Stop-doing-this signal

When DEV-4 demonstrates a substrate-authored concept mint via the
extended palette AND three consecutive autonomous cycles produce at
least one `concept_create_write` or `conceptLink_write` per cycle
without operator intervention, this unlock is absorbed and the change
is archived. Subsequent palette extensions go through their own spec.
