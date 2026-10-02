# Tasks — Doc Ingestion + Concept Management

## DEV-1 — ingest-doc-as-concepts template

- [x] 1.1 Cross-check existing templates: read
  `repos/development-vessel/src/seed/draft-gap-closing-activity.ts` for
  the structural template. Confirm what resolvers are available in the
  autonomous palette (per Unlock B):
  `fs_read, fs_write, http_fetch, llm_completion_dispatch,
  json_path_extract, concept_create_write, conceptLink_write,
  substrateGap_write`. Report any palette gaps.
  - Confirmed palette via grep + proxy registration log (33 shapes).
    `iteration` is a built-in ias-executor resolver, not a dev-vessel
    proxy.

- [x] 1.2 Author
  `repos/development-vessel/src/seed/ingest-doc-as-concepts.ts`.
  Task graph adjusted from spec: extract via template (fs_read → llm →
  fs_write to /workspace), mint via companion script
  `validation/scripts/ingest-doc-mint-from-file.ts`. Split because
  ias-executor engine consistently aborts after the first downstream
  task following llm_completion_dispatch (see substrate_constraint
  `concept_h4bBJaRzE9Yg`). Companion script preserves the substrate's
  signature-based idempotency contract.

- [x] 1.3 Register in `src/seed/index.ts` SEED_TEMPLATES.

- [x] 1.4 Per-template test
  `test/seed/ingest-doc-as-concepts.test.ts` — 9 tests passing, locks
  the task graph + prompt contract + resolver palette.

- [x] 1.5 `bun run typecheck` + `bun run lint` clean.

- [x] 1.6 Sync via
  `make -C scripts/substrate restart-development-vessel` + manual
  `docker cp` of `src/seed/ingest-doc-as-concepts.ts` + cli
  `seed-templates`. Template registered as
  `development-vessel:ingest-doc-as-concepts`.

- [ ] 1.7 Smoke test acceptance: dispatch via
  `mcp__metabob__run_goal` with `target_template_id =
  development-vessel:ingest-doc-as-concepts` and variables
  `{doc_path: "CLAUDE.md"}`. BLOCKED on substrate engine: 5 dispatches
  (exec_02vzfnjz, exec_a2z8npma, exec_1rh2y8s3, exec_dr8n27qe,
  exec_wins0nl7, exec_we5wozbl, exec_d569heyc) all stop after
  extract_sections; downstream task never runs. Workaround via
  companion script lands the data but acceptance is operator-verifiable
  pending engine root-cause.

- [ ] 1.8 Idempotency test: dispatch the same goal a second time.
  BLOCKED on 1.7. Companion script `ingest-doc-mint-from-file.ts`
  implements idempotency via pre-search by signature.

## DEV-2 — detect-stale-pointer template

- [x] 2.1 Author
  `repos/development-vessel/src/seed/detect-stale-pointer.ts`.
  Task graph: search_concepts → scan_for_stale (LLM heuristic) →
  parse_candidates → emit_gaps (iteration) → emit_report. Uses
  substrateGap_write with category=missing_concept and
  classification_metadata.gap_subtype=stale_concept_pointer.

- [x] 2.2 Register in `src/seed/index.ts`.

- [ ] 2.3 Acceptance: dispatch via `mcp__metabob__run_goal`. BLOCKED on
  the same engine constraint as DEV-1.7: exec_el8plbuo records only
  search_concepts; downstream LLM scan never runs. Operator-verifiable
  once the multi-task abort is fixed.

## DEV-3 — substrate concept for the pattern

- [x] 3.1 Mint via `mcp__metabob__concept_create`:
  - id: `concept_fgrn1fNEbbBI`
  - shape: `concept_ingest_and_curate`
  - source_type: `vessel_construction_pattern`

- [x] 3.2 Link via `mcp__metabob__concept_link`:
  - `derived_from` `concept_ob81MJDNgNZL` (Principle 1) — edge
    `⟨edge_cV-yksRhjHNZ⟩`
  - `related_to` `concept_UA9qz6NRN8z9` (vault mirror) — edge
    `edge_1ToSKiknPyhJ`
  - `related_to` `concept_M7qeUUI35hAr` (substrate-gap-consumer-wiring)
    — edge `⟨edge_aC-A4FHIEpFo⟩`

## DEV-4 — meta-finding (concept-coverage ratio)

- [x] 4.1 Pre-baseline: 272 total concepts / 0 with non-null
  `pointer.path` or `pointer.metadata.doc_path` (computed 12:15Z via
  direct HTTP GET `/concepts/search?limit=500` to host port 18260).

- [x] 4.2 Post-baseline: 279 total / 0 with `pointer.path` / 1 with
  `pointer.metadata.ingest_source` (from an earlier test POST).
  Dispatches: 5 of ingest-doc-as-concepts, 1 of detect-stale-pointer
  — none completed past the LLM step.

- [x] 4.3 Delta = 0%, below the +5% threshold the criterion treats as
  evidence-of-fix-needed. Recorded as meta-finding concept
  `concept_8kHuci6A2jyr` (shape: meta_finding) linked
  `description_of` to the pattern concept `concept_fgrn1fNEbbBI`.
  Two compounding constraints filed as substrate_constraint concepts:
  - `⟨concept_w-wa1gnYJZX9⟩` — MCP concept_create strips
    caller-supplied pointer payload
  - `concept_h4bBJaRzE9Yg` — ias-executor multi-task abort after
    llm_completion_dispatch

## Done criteria

DEV-1.1–1.6, DEV-2.1–2.2, DEV-3, DEV-4 all `[x]`. DEV-1.7, DEV-1.8,
DEV-2.3 marked operator-verifiable / blocked on the engine constraint
documented in `concept_h4bBJaRzE9Yg`. Templates ship correct,
companion script provides the manual Phase B path, substrate concept
records the pattern, and meta-finding records the measurement outcome.
Extension to other source types waits on resolution of both bottlenecks
per the proposal's "needs a fix before extension" clause.
