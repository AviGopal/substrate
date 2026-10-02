# Drop source_type filter in drafter concept priming

## Context

Both drafter activities — `draft-gap-closing-activity` and `draft-activity-from-pattern` — call concept-db's `/concepts/search` with a hard-coded `source_type` whitelist:

```
?source_type=impulse_signature,memo,vessel_construction_pattern,impulse_activity_pattern
&min_relevance=0.3&limit=15
```

This was widened on 2026-05-30 (the original F26 fix) from `impulse_signature` alone to the four-source-type whitelist above. The whitelist still excludes everything else concept-db emits today:

- `architectural_pattern_principle` (9 concepts at rel ≥ 0.0)
- `extracted` (2 concepts at rel ≥ 0.0; mined codebase patterns)
- `human_input` (user corrections — e.g. concept_7mzv7SQN_7JB minted 2026-06-04 from operator feedback "don't invent new substrate tiers")
- Concepts with no source_type assigned (2 concepts at rel ≥ 0.3)

Baseline at 2026-06-04T09:25Z against substrate-live concept-db:

| Query | Count |
|---|---|
| Filtered (current drafter), min_rel ≥ 0.3 | 2 |
| Unfiltered, min_rel ≥ 0.3 | 4 |
| Unfiltered, min_rel ≥ 0.0, limit 200 | 46 across 5 source_types |

The deeper objection (operator feedback `concept_7mzv7SQN_7JB`): a hard-coded source_type whitelist is a special case. It encodes "the drafter knows in advance which categories of knowledge are useful" — which violates the substrate's idiomatic framing where concepts are impulses and Bayesian relevance (not an enumerated allow-list) gates inclusion.

## Proposal

Remove the `source_type` query parameter from both drafter priming calls. Keep `min_relevance` + `limit` as the only gates. Let Bayesian relevance and the drafter LLM decide which concepts are useful, rather than a hand-curated source_type whitelist.

This is a write-scope change (variant of an existing activity template; no admin needed). Thompson sampling will promote the new variant if it improves draft quality.

## Why this is small

- One query-parameter removal in two seed files.
- No new resolvers, no new shapes, no new activities, no new categories of anything.
- No schema migration.
- No new vocabulary added to the substrate (concept-db source_type ASSERT unchanged).
- Behavior change is monotone: drafter sees a strict superset of concepts. Existing four source_types still ranked by relevance; additional source_types now compete on the same axis.

## Out of scope

- Changing concept-db's source_type taxonomy (orthogonal).
- Adding new source_types or activity categories.
- Re-weighting relevance scoring.
- Pruning bridge-noise edges (separate concern; tracked elsewhere).

## Acceptance

A re-seeded drafter execution emits a `substrateConceptIndex` impulse whose underlying HTTP response contains at least one concept with `source_type ∈ {architectural_pattern_principle, extracted, human_input}`, demonstrating the previously-excluded categories now reach the drafter prior. Count of priming-priors is ≥ baseline.
