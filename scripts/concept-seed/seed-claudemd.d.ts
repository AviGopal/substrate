/**
 * seed-claudemd.ts — one-shot bootstrap of constitutional concepts.
 *
 * Reads load-bearing sections from the project's CLAUDE.md files and mints
 * one concept per section into concept-db. Each concept gets:
 *   - source_type: vessel_construction_pattern or impulse_activity_pattern
 *   - pointer: { type: "memo", path: "<file>", section: "<heading>" }
 *   - shape: derived from heading
 *
 * Then writes `description_of` edges between related concepts so the
 * graph has structure from day one.
 *
 * Idempotent-ish: re-running creates duplicates with new ids. Skip the
 * second run, or accept the duplication and let concept-db's
 * prune-irrelevant-neighbors upkeep eventually clean it up.
 *
 * Usage:
 *   docker exec -e CONCEPT_DB_URL=http://127.0.0.1:8260 substrate-live \
 *     bash -c 'set -a; source /etc/substrate/env; set +a; bun /workspace/scripts/concept-seed/seed-claudemd.ts'
 *
 * (Run inside the substrate container because concept-db is only on the
 *  container network without host-mapped 18260 — and we want the substrate's
 *  METABOB_API_KEY for org-scoped writes.)
 */
export {};
//# sourceMappingURL=seed-claudemd.d.ts.map