# 2026-05-30 — Obsidian-vessel as Bidirectional Concept-db Frontend

## Motivation

obsidian-vessel today exposes vault content as impulse resolvers (notes,
search, canvas, backlinks, frontmatter, daily-notes, graph-query) on
port 27182 and registers with discovery-vessel. The direction is
**vault → substrate**: vessels query Obsidian for knowledge.

The reverse direction is missing. Concept-db accumulates substrate
knowledge (~hundreds of concepts and growing — `concept_xkrH3DvKplQd`
through today's audit concepts) but the operator has no human-friendly
browser. The MCP `concept_search` / `concept_neighbors` tools return
plain text; there is no graph view, no linked-note exploration, no
authoring surface.

Obsidian is the natural frontend: it already speaks markdown +
frontmatter + wikilinks + graph view + canvas. If concepts materialize
as notes and edges as wikilinks, the operator gets a navigable concept
graph for free. If vault edits propagate back, the vault becomes a
first-class concept source — closing the operator-side loop that
auto-memory's `MEMORY_AS_SUBSTRATE.md` envisioned, but with richer
authoring than a file-cache flush.

Concept-db already exposes the full read + write REST surface this
needs (see References). No concept-db changes required.

## Proposal

Add a bidirectional sync subsystem to obsidian-vessel that mirrors
concept-db into the vault and propagates vault edits back.

### Vault layout

```
<vault-root>/<sync-root>/                    # default sync-root: "concept-db/"
  <source_type>/                             # e.g. vessel_construction_pattern/
    <short_id>__<slug>.md                    # e.g. y-CPpfVcAhL0__vessel-resolve-dual-form.md
```

`short_id` is the concept id without the `concept_` prefix and outer
delimiters. `slug` is a kebab-case derivation of `shape` truncated to
~60 chars for readability — purely cosmetic, not used for resolution.

### Note schema

```markdown
---
concept_id: y-CPpfVcAhL0
shape: vessel_resolve_handler_dual_form
source_type: vessel_construction_pattern
summary: "Vessel /resolve handlers must accept impulse-wrapper ..."
relevance: 0.70
times_loaded: 0
times_succeeded: 0
times_failed: 0
updated_at: 2026-05-30T07:13:22Z
last_substrate_pull_at: 2026-05-30T08:45:00Z
pending_sync: false                          # set true when local edits are queued
concept-db: true                             # marker enabling writeback
---

<concept.content body, verbatim>

## Related

### derived_from
- [[ob81MJDNgNZL]] — Principle 1 elaborates the Core Model's "impulses" primitive.

### description_of
- [[IsGiRuTMb-N0]] — MCP tools that front a vessel should dispatch through /resolve.
```

Edge type sections render only if non-empty. `[[short_id]]` resolves
via Obsidian's alias mechanism (filenames begin with short_id) so
wikilinks point at the right note even though the visible label is
short.

### Substrate → vault flow

`src/sync/concept-sync.ts`:

1. On plugin load and on configurable interval (default 5 min): GET
   `/concepts/search` with no filters + pagination (`limit=50`,
   iterate). For each concept page, fetch `/concepts/:id/neighbors` to
   populate edges.
2. For each concept: if no note exists, materialize. If a note exists
   AND its `last_substrate_pull_at` < remote `updated_at`, refresh the
   non-body fields (frontmatter + `## Related`); preserve any operator
   edits to the body if `pending_sync: true`.
3. Write `last_substrate_pull_at` after each refresh.

Live updates via the activity-api WS bus are a phase-4 enhancement
(see Phases).

### Vault → substrate flow

`src/sync/concept-writeback.ts`:

1. Watch the vault for modifications to files under `<sync-root>/`
   whose frontmatter contains `concept-db: true`.
2. On save:
   - If frontmatter has `concept_id`: POST `/concepts/upsert-by-signature`
     with the note body + frontmatter-derived shape/source_type/summary.
     Use the existing `concept_id` as the signature.
   - If no `concept_id`: POST `/concepts/` to mint a new concept. Write
     the returned id into frontmatter.
   - Diff the rendered `## Related` against last-known: emit
     `concept_link` for additions, log removals (concept-db handles
     pruning via upkeep — vault edits don't hard-delete).
3. Set `pending_sync: true` while the request is in-flight; clear on
   success. On transport failure, leave `pending_sync: true` and retry
   on next sync tick.

### Discovery integration

obsidian-vessel registers two new advertised shapes:

- `obsidian:concept_view` (read): vessels can query "give me the
  vault-rendered version of concept X" via discovery → POST /resolve.
- `obsidian:concept_writeback` (write): vessels can ask obsidian-vessel
  to materialize a new concept directly in the vault without going
  through concept-db's REST surface.

### Settings (extends `src/settings.ts`)

- `enableConceptDbSync`: boolean (default false — opt-in)
- `conceptDbEndpoint`: string (default `http://127.0.0.1:18260`)
- `conceptDbApiKey`: string (re-uses `METABOB_API_KEY` env if set)
- `conceptDbSyncRoot`: string (default `concept-db`)
- `conceptDbSyncIntervalSec`: number (default 300)
- `enableConceptDbWriteback`: boolean (default false — opt-in)

## Phases

1. **Read-only mirror.** concept-db client + materializer + pull-on-load +
   interval refresh. Edges rendered as wikilinks. Phase-1 acceptance:
   running the sync against today's substrate populates the vault with
   ~50+ concepts under `<sync-root>/<source_type>/`, Obsidian's graph
   view renders the concept graph, and wikilinks navigate correctly.

2. **Canvas neighborhood view.** Reuses existing `src/canvas/` builders.
   New command "Concept Graph: Open Here" reads the active note's
   `concept_id`, fetches 2-hop neighbors, renders as a canvas. Phase-2
   acceptance: command opens a canvas with the active concept in the
   center, neighbors clustered by edge_type.

3. **Writeback.** Save handler + frontmatter trigger + upsert-by-signature
   path. Phase-3 acceptance: editing a concept note's body + saving
   updates the concept-db row (verified via direct GET); adding a new
   `[[short_id]]` under `## Related` emits a `concept_link` call.

4. **Live push.** Subscribe to activity-api WS bus, listen for
   `concept.created` / `concept.linked` / `concept.usage` events, refresh
   the affected notes immediately rather than waiting for the interval
   tick. Phase-4 acceptance: a `concept_create` call from another vessel
   surfaces a new note in the vault within ~5 seconds.

## Out of Scope

- **Substrate authoring of the obsidian-vessel itself.** The plugin is
  TypeScript that runs inside Obsidian; the substrate's autonomous
  drafter currently targets activity templates, not vessel source.
  Operator-authored implementation per phase.
- **Multi-vault sync.** Single vault, single substrate. Multi-vault
  routing is a federation problem deferred to IAL S2/S3.
- **Conflict UI.** v1 conflict policy: substrate wins on frontmatter
  metadata (relevance, times_loaded, updated_at); vault wins on body
  content; edges merge (union, no removals from vault side). No 3-way
  merge UI — if the operator wants to overwrite substrate, they save;
  the writeback path makes it authoritative.
- **Read-time concept-db queries from arbitrary notes.** No `dataview`-
  style query block. The vault mirror IS the query interface (use
  Obsidian's native search + graph view).
- **Materializing impulse-signature concepts.** The concept-bridge auto-
  mints these per analysis-vessel resolution; they would dominate the
  vault. Sync default-excludes `source_type=impulse_signature` (operator
  can re-enable via setting `conceptDbSyncSourceTypes`).

## Success Criteria

1. Phase 1 ships: read-only mirror works against substrate-live's
   concept-db (port 18260 host / 8260 container). At least 30 concepts
   materialized; graph view navigable.
2. Phase 2 ships: Canvas command renders a concept neighborhood.
3. Phase 3 ships: writeback round-trip verified — edit a note, save,
   GET `/concepts/:id` shows the new body.
4. Phase 4 ships: WS-driven refresh < 10s end-to-end.
5. New shapes (`obsidian:concept_view`, `obsidian:concept_writeback`)
   advertised in discovery-vessel and resolvable by other vessels.
6. Mint a `vessel_construction_pattern` concept describing this
   bidirectional-mirror pattern so future vessels (cloud-dashboard,
   workbench) can replicate it.

## References

- concept-db REST surface: `repos/concept-db/src/routes/concepts.ts`
  (GET search/:id/:id/neighbors/:id/edges/:id/usage/:id/stats/:id/sequence;
  POST /, /from-source, /upsert-by-signature, /:id/link, /:id/usage)
- obsidian-vessel structure: `repos/obsidian-vessel/src/` —
  `main.ts`, `server/`, `sync/`, `resolvers/`, `canvas/`, `vessel-client.ts`
- Sync precedent: `repos/obsidian-vessel/src/sync/sync-service.ts`
  (execution-trace sync) is the structural template for `concept-sync.ts`
- API-client precedent: `repos/obsidian-vessel/src/api-client.ts`
  is the structural template for `concept-db-client.ts`
- Canvas precedent: `repos/obsidian-vessel/src/canvas/execution-canvas.ts`
  is the structural template for `concept-canvas.ts`
- Auto-memory bridge pattern: `docs/MEMORY_AS_SUBSTRATE.md` — the
  `pending_sync` flag and operator-side cache discipline mirror this
- Concept-db known auth issue: `finding_2026_05_28_concept_db_root_signin_blocked`
  — use HTTP REST, not the SurrealDB JS client
- Substrate dev loop: `make -C scripts/substrate restart-concept-db`
  for concept-db iteration; obsidian-vessel runs in the user's Obsidian
  app, not in substrate-live
