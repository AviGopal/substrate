# 2026-05-30 — Doc Ingestion + Concept Management Activities

## Motivation

The substrate's concept-db today holds ~240 concepts, but the vocabulary
is thin not because the wiring is broken — it's because most of the
substrate's information sources have never been intercepted
systematically:

| Source | How concepts get minted today |
|---|---|
| Codebase idioms | concept-bridge auto-mints `impulse_signature` per analysis-vessel resolution (shape-level only, not idea-level) |
| Documentation (CLAUDE.md, docs/, openspec/) | One-shot bootstrap script for CLAUDE.md root; nothing else |
| Validation findings | Hand-mints during operator sessions |
| Memory files | Operator-side files only; substrate-side `memoryNote` not yet shipped |
| User corrections / preferences | Hand-mints, when the agent remembers |
| History (commits, percolations) | Not ingested |

Every gap above represents potential drafter priors that don't exist.
When `draft-gap-closing-activity` reads concept-db for a query, it gets
back what the operator happened to mint — not what the substrate
actually knows.

Worse, there's no management layer. Concepts accumulate but nothing
prunes duplicates, detects stale source pointers, surfaces orphans, or
resolves contradictions. The Bayesian relevance decay (already in
concept-db upkeep) handles fade-out but not the structural cleanup the
graph needs to stay coherent at 10× or 100× current scale.

## Proposal

Three new activity families in development-vessel, each one a small
seed template following the pattern established by
`draft-gap-closing-activity` (openspec 2026-05-22). All three families
share the substrate-aware framing: read concept-db priors, emit
`substrateGap` impulses when the activity finds something it can't
handle, let the drafter respond.

### Family 1 — INGEST (mint concepts from sources)

The contract for every ingest template:
- Input: a single source identifier (file path, commit SHA, message
  event, whatever the source's "unit" is)
- Action: read the source, extract load-bearing ideas, mint one concept
  per idea with `pointer: {type, path, section}` back to source
- Output: list of minted concept ids
- Idempotent: re-running on unchanged source produces zero new concepts
  (use `/concepts/upsert-by-signature` keyed on `pointer.path + section`)

Three creation patterns, one template each:

- **`ingest-doc-as-concepts`** (periodic-polling pattern). Reads a
  markdown file, splits on H2/H3 headings, calls `llm_completion` to
  extract one idea + shape + source_type per section, mints via
  `concept_create_write` (or upsert), and links siblings under same
  doc with `related_to` weight 0.4. Smoke test: run against root
  `CLAUDE.md` first; expect 40-80 new concepts under
  `vessel_construction_pattern`.

- **`ingest-memory-finding`** (periodic-polling pattern). Reads one
  file from `~/.claude/projects/.../memory/`, mints a concept with
  `source_type: memo`, links to any concepts cited by `[[name]]`-style
  references in the body. Pairs with the `memoryNote` migration script
  already specced in closure-replacement-suite.

- **`mint-from-correction`** (event-driven pattern, stub). Subscribes
  to a `correction.received` event on the WS bus. Today nothing emits
  that event — the template ships as an inert listener so the contract
  is in place; future MCP-side hooks can emit. Out of scope to build
  the emitter in this change.

### Family 2 — MANAGE (curate the graph)

The contract for every management template:
- No input. Runs against the current concept-db state.
- Action: detect a structural issue (duplicate, stale, orphan,
  contradiction), emit `substrateGap_write` with `gap_class` set.
- Output: gap counts. Drafter responds to the gap class.
- Idempotent: detecting the same issue twice doesn't re-emit (use
  the gap's id field as a signature).

Four management templates:

- **`dedup-concepts`**. Periodic. For each concept, `concept_search`
  with the concept's content as the query. Drop self. If top hit has
  cosine similarity > 0.92 AND `times_loaded` is lower than self's,
  emit gap `{gap_class: "duplicate_concept", losing_id, winning_id}`.
  Drafter (when this lands) calls `concept_link` with `contradicts`
  weight 0.2 on the losing concept — letting upkeep prune over time
  rather than deleting outright.

- **`detect-stale-pointer`**. Periodic. For each concept with
  `pointer.path`, check if the file exists in the repo at the path.
  If not, emit gap `{gap_class: "stale_concept_pointer", path}`.

- **`surface-orphans`**. Periodic. For each concept with zero
  outgoing edges AND `times_loaded == 0` AND age > 7 days, emit gap
  `{gap_class: "orphan_concept", concept_id}`. Drafter can either
  propose links or propose deprecation.

- **`flag-contradiction-clusters`**. Periodic. Find concept pairs
  with `contradicts` edges where both concepts have `times_loaded > 0`
  (i.e. both are load-bearing). Emit gap
  `{gap_class: "active_contradiction", left_id, right_id, evidence}`.
  Operator (or post-S3 substrate) chooses; concept-db marks loser
  deprecated.

The Reinforce + Decay categories from the earlier analysis are NOT new
templates — they're handled by concept-db's existing ExecutionObserver
(reinforce via `recordUsage`) and upkeep activity (decay). This spec
doesn't duplicate that work.

### Family 3 — REFRESH (keep concepts current)

The two mechanisms are different timescales:

- **`refresh-changed-docs`** (event-driven, future). Subscribes to a
  `file.changed` event from a watcher process. Today no watcher
  emits this. Out of scope to ship the watcher; ship the template as
  an inert listener so the substrate is ready.

- **`refresh-full-rescan`** (periodic, weekly). For each known
  ingest-source directory, list files and run the matching ingest
  template (`ingest-doc-as-concepts` for `.md` under `docs/`).
  Upsert-by-signature means re-ingesting unchanged docs is free; the
  cost is the LLM dispatch for each section, which scales with
  changed sections.

## Out of Scope

- **File-watcher daemon**. Listening for filesystem events at the OS
  level requires a separate process (or an Obsidian-side hook for vault
  edits). Both are deferred. The two event-driven templates ship as
  inert listeners — emitters land in a follow-up change.

- **`concept_merge_write` resolver**. The dedup activity could
  hard-merge concepts (single canonical id, all edges rebased). Today
  no such resolver exists; the dedup template uses `contradicts` as a
  soft-merge proxy. Hard-merge is a separate concept-db schema change
  with migration risk.

- **`ingest-openspec-change`**, **`ingest-validation-finding`**,
  **`ingest-source-snippet`**. The doc-ingest template is the smoke
  test; once it lands and proves the pattern, the same shape extends
  to other source types. Authoring all of them in this change would
  be premature.

- **Re-ingesting concepts the operator hand-minted via MCP**. These
  have `pointer.type=memo` with no path; ingest templates skip them.
  They're operator-authored "by hand" and stay that way.

- **Watcher for vault edits**. Phase 4 of the obsidian-vessel openspec
  already covers WS-driven push to the vault; the inverse direction
  (vault edit → trigger ingest of the changed concept's source doc)
  is a future cross-vessel hook.

## Success Criteria

1. **`ingest-doc-as-concepts` ships** as a development-vessel seed
   template with a per-template test that exercises the LLM dispatch +
   concept_create_write path on a fixture markdown file.

2. **Running it against `CLAUDE.md`** via `mcp__metabob__run_goal`
   produces ≥ 30 new concepts in concept-db with non-null `pointer.path`
   pointing back at `CLAUDE.md` and meaningful section names. Verified
   by `concept_search` filtering on source_type and inspecting pointer.

3. **Idempotency**: re-running on the same `CLAUDE.md` produces 0 new
   concepts (`upsert-by-signature` finds the existing rows).

4. **At least one management template** (`detect-stale-pointer` is the
   smallest) ships and runs cleanly. Emits at least one
   `substrateGap` impulse — the 4 known orphan concepts with
   `source_type=None, shape=None` (see broken-link audit
   2026-05-30) qualify.

5. **A substrate concept describes the ingest/manage pattern**
   (`vessel_construction_pattern`, shape: `concept_ingest_and_curate`),
   linked `derived_from` Principle 1 and `related_to` the bidirectional
   vault mirror pattern.

6. **A meta-finding**: count concepts minted by this change, compute
   the ratio (concepts with non-null pointer) / (total concepts).
   Pre-change baseline ~5%; post-change against CLAUDE.md alone should
   raise to ~20%+. If ratio doesn't rise, the ingest template is
   producing pointer-less concepts and needs a fix before extension to
   other source types.

## References

- Unlocks A/B/C (filed 2026-05-30) — same architectural pattern at a
  smaller scope
- `openspec/changes/2026-05-22-failure-mode-autonomous-loop` — the
  drafter this spec's gaps feed into
- `concept_y-CPpfVcAhL0` — vessel_resolve_handler_dual_form (an example
  of the kind of operator hand-mint that ingest templates would generate
  from docs at scale)
- `concept_z9UOxErJP2ff` — obsidian_wikilink_filename_match_precedence
  (operator-discovered constraint that should have been a concept the
  moment the doc described it; the gap we're closing)
- `concept_pL2ZFsPkzZz7` — substrate_org_scope_silent_fallback (likewise)
- `concept_QZoLiNrE2NkC` — substrate_vessel_dev_loop (Makefile dev
  loop, the operational concept ingest should surface from CLAUDE.md)
