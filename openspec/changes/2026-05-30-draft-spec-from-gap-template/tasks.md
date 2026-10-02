# Tasks — draft-spec-from-gap-template

Per dev-vessel discipline: VERIFY → DEBUG → SPEC (this doc) → DEV.

## DEV-1: Extend fs-write with WRITE_ALLOWLIST scoping

- [x] Read `src/resolvers/fs-write.ts` — current scoping is workspace-root
      only via `assertInWorkspace`.
- [x] Add optional `WRITE_ALLOWLIST` env parsed as comma-separated
      prefix list (relative to workspace root). When unset, behavior
      unchanged. When set, every write must additionally start with one
      of the prefixes (after `assertInWorkspace`).
- [x] Add per-resolver test
      `test/resolvers/fs-write.test.ts` covering: (a) unset env →
      writes anywhere in workspace, (b) set env + matching prefix →
      writes succeed, (c) set env + non-matching prefix → throws with
      "outside write allowlist".
- [x] `bun run lint && bun test` clean.

## DEV-2: Author the seed template

- [x] Create `src/seed/draft-spec-from-gap.ts` exporting
      `DRAFT_SPEC_FROM_GAP_TEMPLATE: ActivityTemplate` with id
      `development-vessel:draft-spec-from-gap`.
- [x] Task graph (mirrors `draft-gap-closing-activity` shape — 8 tasks):
      1. `read_gaps` — `http_fetch` GET
         `{CONCEPT_DB_ENDPOINT}/concepts/search?source_type=substrate_gap&query={{gap_class}}&limit={{max_gaps}}`.
         Output shape: `substrateGapBatch`.
      2. `read_priors` — `http_fetch` GET
         `{CONCEPT_DB_ENDPOINT}/concepts/search?query={{fix_priors_query}}&limit=5`.
         Output shape: `substratePriorConcepts`.
      3. `read_exemplar_proposal` — `fs_read` of
         `openspec/changes/2026-05-22-failure-mode-autonomous-loop/proposal.md`.
         Output shape: `openspecProposalExemplar`.
      4. `read_exemplar_tasks` — `fs_read` of
         `openspec/changes/2026-05-22-failure-mode-autonomous-loop/tasks.md`.
         Output shape: `openspecTasksExemplar`.
      5. `draft_via_llm` — `llm_completion_dispatch` with a prompt
         instructing the model to output a single JSON object
         `{ "slug": "<kebab>", "proposal_md": "...", "tasks_md": "..." }`,
         given gaps + priors + exemplars. Output shape: `draftedSpecBundle`.
      6. `extract_slug` — `json_path_extract` of `draft_via_llm_text` with
         path `slug`.
      7. `extract_proposal_md` — `json_path_extract` of `draft_via_llm_text`
         with path `proposal_md`.
      8. `extract_tasks_md` — `json_path_extract` of `draft_via_llm_text`
         with path `tasks_md`.
      9. `write_proposal` — `fs_write` to
         `openspec/changes/{{date}}-substrate-authored-{{extract_slug_value}}/proposal.md`.
      10. `write_tasks` — `fs_write` to
         `openspec/changes/{{date}}-substrate-authored-{{extract_slug_value}}/tasks.md`.
- [x] Variables: `gap_class`, `fix_priors_query`, `max_gaps`, `date`.
- [x] Wire into `src/seed/index.ts` `SEED_TEMPLATES`.
- [x] Per-template test `test/seed/draft-spec-from-gap.test.ts`
      validating task ids + resolver names + output shapes.
- [x] `bun run lint && bun test` clean.

## DEV-3: Upload + dispatch

- [x] `bun run cli seed-templates` — verify template registered, no
      403.
- [x] Restart dev-vessel:
      `make -C scripts/substrate restart-development-vessel`.
- [x] Dispatch via `run_goal` with goal naming the two concept-db
      drift evidence concepts. Capture executionId + status.
- [x] Verify `openspec/changes/2026-05-30-substrate-authored-<slug>/`
      exists on disk with proposal.md + tasks.md, both > 500 bytes,
      and both cite the two evidence concept ids.

## DEV-4: Concept-mint the pattern

- [x] Mint a `vessel_construction_pattern` concept describing the
      substrate-authored-openspec-change pattern via
      `mcp__metabob__concept_create`. Link it to
      `concept_y-CPpfVcAhL0` (vessel_resolve_handler_dual_form) and to
      the `draft-gap-closing-activity` precedent.

## DEV-5: Operator review

- [ ] Operator inspects the substrate-authored directory; if
      coherent, the openspec workflow takes over (opsx:apply →
      opsx:archive). If incoherent, the operator deletes the
      directory and lets Thompson take the verifier_negative.
- [ ] No commits from this loop. The substrate writes, the operator
      decides.

## Per-DEV-step regression check

Each DEV-N step ends with:
- `cd repos/development-vessel && bun run lint && bun test`
- Smoke-check the failure-mode harness still runs against substrate-live.

## Stop-doing-this signal

When DEV-3 successfully writes a substrate-authored openspec change
that the operator accepts AND the next two dispatches against
distinct gap_class values also write reviewable proposals, this
template is past acceptance. Further refinement (richer exemplar
selection, multi-shot drafting, etc.) becomes separate work.
