# Phase 1 — Obsidian observation layer + action-effect probe

## Why

The umbrella obsidian-meta-skill-prototype proposal calls for a substrate that authors activities from raw interaction traces. None of that is possible until the observation substrate exists: Layer-0 raw events, Layer-1 episode windows, and per-command effect models. This phase ships exactly that — three deterministic activities and the `prediction_disagreement` failure-mode schema slot — with no LLM authoring anywhere. It is the read path the Phase 2 drafter and the Phase 3 verifier-refiner both consume.

## What changes

- Ship `observe-obsidian-events` as a deterministic infrastructure activity emitting `obsidianEvent` impulses (Layer 0) from Obsidian workspace + vault hooks with payload-hash-only content and `bridge_eligibility: "deny"`.
- Ship `group-interaction-episodes` as a deterministic windowing resolver emitting `obsidianEpisode` impulses (Layer 1) with a sorted-unique class signature.
- Ship `probe-obsidian-action-effects` as the experimentation activity that runs Obsidian commands in a sandbox vault, records pre/post state-signature deltas, and accumulates per-command `actionEffectModel` distributions with a reversibility class.
- Register the shape catalogue (`obsidianEvent`, `obsidianEpisode`, `actionEffectModel`) in concept-db's shape registry with bridge-eligibility settings per the umbrella spec.
- Add `prediction_disagreement` as a top-level value in `FailureModeSchema` (alongside `verifier_negative`, `budget_exhausted`, etc.) with the three discriminated sub-cases reserved as `OPTIONAL` columns. Phase 3 populates them; Phase 1 ships the schema slot.
- Wire the three activities into `bun run cli seed-templates` so the substrate boots them.

## Out of scope

- Any LLM-authored activity (Phase 2 — `draft-activity-from-pattern`).
- Pattern detection logic (Phase 3 — `detect-recurring-pattern`).
- Verifier routing or refinement loops (Phase 3).
- Layer-2/3/4 shape catalog registration (those land when their producing activities ship in Phase 2/3).
- Display-channel perception or control siblings.

## Dependencies

- `2026-05-30-obsidian-vessel-concept-db-frontend` — supplies the Obsidian plugin's concept-db client surface. The seed activities write through it.
- `2026-05-30-trace-to-concept-mining` — the trace read path used downstream; Phase 1 only writes into it.
- Existing FailureModeSchema in `repos/metabob-activity-api/src/models/schemas.ts` — Phase 1 extends, does not rewrite.

## Risk

- **Event volume explosion.** Mitigation: payload-hash-only contents; no raw text ever stored in `obsidianEvent`. Episode windowing bounds downstream cardinality.
- **Sandbox vault contamination.** `probe-obsidian-action-effects` runs against a probe vault distinct from the operator's vault; the seed enforces a vault-path check before any `executeCommandById`.
- **Reversibility-class drift.** Initial heuristics may misclassify (e.g. plugin actions). The class field is the seed corpus for a learned classifier later, not a finished taxonomy.

## Companion concepts

- `concept_uXRPTRZPCKFS` — observation/instrumentation as the foundation of substrate self-knowledge.
- `concept_rwfsb7WB5JXL` — failure-mode taxonomy extension pattern (schema slot first, populate later).
- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern`; the observation layer is its prerequisite read path.
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate`; signature stability discipline applied to the class signature on episodes.

## Related openspecs

- `archive/2026-06-01-2026-06-01-obsidian-meta-skill-prototype/` — the umbrella proposal and design this phase implements.
- `openspec/specs/obsidian-meta-skill-prototype/spec.md` — the durable parent spec; this phase installs the Layer-0/1 and action-effect requirements as live capability.
- `2026-05-30-obsidian-vessel-concept-db-frontend/` — sibling vessel-side surface this phase writes through.
- `2026-05-31-display-perception-vessel/` — the channel the meta-skill rehearses for; Phase 1 here is the analog of the display observation layer.
