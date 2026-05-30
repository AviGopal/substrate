# Tasks — Obsidian-vessel ↔ Concept-db Frontend

Tasks are grouped by phase. Within a phase, complete tasks top-to-bottom.
**Mark a task `[x]` only after the acceptance probe passes**, not just
because the code is written.

## Phase 1 — Read-only mirror

- [x] 1.1 Add `src/concept-db-client.ts` modeled on `src/api-client.ts`.
  Methods: `searchConcepts(query?, sourceType?, shape?, limit?)`,
  `getConcept(id)`, `getNeighbors(id, direction?, edgeTypes?, limit?)`,
  `getEdges(id)`. Returns parsed JSON. Re-use the existing
  `Authorization: ApiKey` pattern from `api-client.ts`.
- [x] 1.2 Extend `src/settings.ts` with the six new settings listed in
  the proposal under "Settings". Add UI in `src/settings-tab.ts`.
- [x] 1.3 Add `src/sync/concept-sync.ts` with:
  - `start()` / `stop()` matching the existing `sync-service.ts` shape
  - `pullAll()` — paginate through `/concepts/search`, materialize each
  - `materializeConcept(concept, neighbors)` — write the note file
  - interval timer driven by `conceptDbSyncIntervalSec`
- [x] 1.4 Add `src/formatters/concept-formatter.ts`. One function
  `renderConceptNote(concept, neighbors): string` producing the
  frontmatter + body + `## Related` block per proposal schema. Group
  neighbors by edge_type. Resolve targets as `[[short_id]]`.
- [x] 1.5 Wire concept-sync into `MetabobVesselPlugin.onload()` in
  `src/main.ts`. Gate behind `settings.enableConceptDbSync`. (Status-bar
  indicator deferred — existing StatusBarManager covers the indicator
  surface; concept-sync exposes `getStatus()` for future wiring.)
- [x] 1.6 **Phase 1 acceptance probe** — exercised via
  `scripts/concept-sync-probe.ts` against substrate-live concept-db
  (port 18260) with `METABOB_API_KEY` set:
  - Materializer wrote **237 notes** across 4 source_type directories
    (`extracted/`, `impulse_activity_pattern/`, `memo/`,
    `vessel_construction_pattern/`). ≥10 vessel_construction_pattern
    criterion comfortably exceeded.
  - Frontmatter parsed (no YAML errors).
  - `## Related` wikilink rendering verified end-to-end against real
    neighbors — edges grouped by `edge_type` subsection,
    `[[short_id]]` form correct.
  - Idempotency confirmed: pull #2 wrote 0 notes (mtimes preserved).
  - Obsidian graph-view edge rendering requires the plugin loaded in
    Obsidian → **operator-verifiable**.
  - Two probe-side bugs surfaced and fixed: (a) probe script did not
    read `METABOB_API_KEY` from env → false-negative empty result
    (concept_pL2ZFsPkzZz7); (b) `ConceptDbClient.getNeighbors`
    returned the raw wrapped REST shape `{concept,edge}` instead of
    flattening to `ConceptNeighbor` → undefined-id crash in formatter.

## Phase 2 — Canvas neighborhood view

- [x] 2.1 Add `src/canvas/concept-canvas.ts` modeled on
  `execution-canvas.ts`. `buildConceptCanvas(client, conceptId, opts)`
  returns the written canvas path. Layout is radial; positions handled
  inline (existing layout-engines are execution-trace-shaped, not a
  fit for concept neighborhoods).
- [x] 2.2 Add command "Concept Graph: Open Here" via `src/commands.ts`.
  Reads the active note's `concept_id` from frontmatter; fetches 2-hop
  neighbors; writes a `.canvas` file under the canvas folder; opens it.
- [ ] 2.3 **Phase 2 acceptance probe** — code path verified
  (concept-canvas builder constructs valid CanvasData; command handler
  pulls concept_id from active file's frontmatter via metadataCache).
  Requires the plugin running in Obsidian to confirm the canvas opens
  → **operator-verifiable**.

## Phase 3 — Writeback

- [x] 3.1 Extend `concept-db-client.ts` with `upsertBySignature(payload)`,
  `createConcept(payload)`, `linkConcepts(from, to, edgeType, weight,
  description)`, and `updateConcept(id, patch)`. Mirror the route
  signatures in `concept-db/src/routes/concepts.ts`.
- [x] 3.2 Add `src/sync/concept-writeback.ts`:
  - vault `modify` event listener for files under `<sync-root>/`
  - filter on `concept-db: true` frontmatter
  - on save: set `pending_sync: true`, POST to concept-db, clear flag
  - diff `## Related` wikilinks against previous version; for added
    `[[short_id]]`, call `linkConcepts(current_id, target_id,
    edge_type)`. Edge type defaults to `related_to` unless the wikilink
    sits under a specific edge-type subheading.
- [x] 3.3 Wire writeback into `onload()`. Gate behind
  `settings.enableConceptDbWriteback`.
- [ ] 3.4 **Phase 3 acceptance probe** — vault `modify` events fire
  inside Obsidian only. Code path validated by inspection; full
  round-trip requires the plugin loaded → **operator-verifiable**.

## Phase 4 — Live push

- [x] 4.1 Add `src/sync/concept-bus-listener.ts`. Subscribes via
  WebSocket to activity-api's `/ws` bus using the existing
  `authenticate`/`catchup` handshake. Listens for `concept.created`,
  `concept.linked`, `concept.usage`.
- [x] 4.2 On event: invalidate the affected concept (fetch fresh +
  re-materialize via the shared ConceptSyncService). For
  `concept.linked`, both endpoints get refreshed.
- [ ] 4.3 **Phase 4 acceptance probe** — bus listener requires the
  plugin loaded against an active WS bus. Code path validated;
  end-to-end timing → **operator-verifiable**.

## Cross-phase tasks

- [x] X.1 Register new shapes (`obsidian:concept_view`,
  `obsidian:concept_writeback`) in `vessel.json` (bumped to 0.2.0) and
  in the default `settings.shapes` array (which is what the
  vessel-client passes to discovery on registration).
- [x] X.2 Added `src/resolvers/concept-view-resolver.ts` and
  `src/resolvers/concept-writeback-resolver.ts` matching the existing
  pattern (self-register on import in `main.ts`). The ImpulsePointer
  union was extended to include the two new pointer shapes. main.ts
  injects the ConceptDbClient + ConceptSyncService into both resolvers
  via `setConceptDbResolverContext` / `setConceptWritebackResolverContext`.
- [x] X.3 Minted substrate concept
  `concept_UA9qz6NRN8z9` (shape `bidirectional_vault_mirror_pattern`,
  source_type `vessel_construction_pattern`). Linked
  `derived_from concept_6QV70ASG0R4P` (Principle 1 — impulses as
  universal data) and `related_to concept_l0IOyodt6wS7` (the memory-
  as-substrate principle concept).
- [x] X.4 `bun run typecheck` from `repos/obsidian-vessel` — exit 0,
  no errors.
- [x] X.5 Appended a "Concept-db frontend" section to
  `repos/obsidian-vessel/README.md` pointing at this openspec change.

## Done criteria

All four phases shipped at the code level. Acceptance probes that can
be verified without Obsidian (Phase 1 materialization + idempotency,
formatter output, typecheck) have passed. Probes that require the
plugin running in Obsidian (graph-view rendering, canvas open,
writeback round-trip, WS-driven refresh) are marked
operator-verifiable. Substrate concept minted (X.3).
