# 2026-05-30 — Autonomous Palette Write Resolvers (Unlock B)

## Motivation

Today the substrate's autonomous drafter (`development-vessel:draft-gap-closing-activity`)
composes templates from a **palette** declared inline in its LLM prompt
(`repos/development-vessel/src/seed/draft-gap-closing-activity.ts` line 32):

```
Use ONLY these resolver names: fs_read, fs_write,
llm_completion_dispatch, json_path_extract.
```

This is the de facto palette — the system has no separate allowlist file;
the constraint is encoded as a prompt instruction. Every substrate-authored
activity must compose from those four primitives, all of which are
read / filesystem / dispatch only. None of them write into substrate state.

Consequences (documented in memory `finding_2026_05_28_substrate_gap_consumer_unwired`
and `finding_2026_05_29_substrate_context_aware_authoring`):

- Substrate-authored activities can detect gaps but cannot **mint** the
  structured knowledge that closes them. Concept-graph entries, link edges,
  and gap statements must be created by operator-authored activities or
  by direct MCP calls — the autonomous drafter is shut out of the
  substrate-accumulates loop.
- Drafters can store output as JSON via `fs_write` but those files are not
  graph-resident; they cannot be queried, ranked by Bayesian relevance, or
  linked to existing concepts. The substrate sees them only when an external
  ingestion activity runs.

Three safe write resolvers are already implemented and discovery-advertised
on their owning vessels:

| Shape                  | Owner             | What it writes                                           |
|------------------------|-------------------|-----------------------------------------------------------|
| `concept_create_write` | concept-db        | A new concept (typed knowledge unit, Bayesian-rankable)   |
| `conceptLink_write`    | concept-db        | An edge between two concepts (graph wiring)               |
| `substrateGap_write`   | development-vessel| A problem-statement gap (operator + substrate co-author)  |

(`repos/concept-db/src/routes/impulses.ts` lines 60-61 and 727-794;
`repos/development-vessel/src/resolvers/substrate-gap.ts` is idempotent
and config-registered at `src/config.ts` lines 68-69.)

None mutates templates, identity, or trace history. The blast radius is
bounded: a misbehaving drafter can pollute the concept graph (recoverable
via upkeep activities) but cannot break the activity registry or auth surface.

## Proposal

Extend the `draft-gap-closing-activity` palette to include
`concept_create_write`, `conceptLink_write`, and `substrateGap_write`.

Concretely, two changes:

1. **Update the prompt resolver allowlist** in
   `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`
   so the LLM may compose tasks that dispatch to these three writes via
   the standard impulse-resolver pattern (HTTP POST to discovery-located
   vessels through `http_fetch`, or — once the dev-vessel cross-vessel
   dispatch resolver lands — directly).
2. **Document the dispatch contract** for each write in the prompt so
   the LLM produces structurally valid `config` blocks. Each entry
   specifies the target endpoint (the impulse-resolver path), the
   pointer shape, and the required pointer fields.

The palette is, and will remain, **implicit** (encoded in the prompt)
because there is no separate allowlist mechanism today. Surfacing this
explicitly: the change does not introduce a new architectural layer; it
broadens the existing prompt-encoded contract by three entries.

## Out of Scope

- Destructive writes (`activityTemplate_update`, `activityTemplate_deprecate`,
  `activityExecutionTrace_delete`). These remain operator-gated.
- Identity / auth writes. Same gating.
- A separate JSON allowlist or registry-level palette mechanism. If a
  future change needs to enumerate palettes per drafter, it can extract
  the current prompt-encoded list into a config; for now the inline list
  is sufficient.
- LLM-side validation of the drafter's output (e.g. rejecting tasks that
  use resolvers outside the palette). Today the LLM is trusted to follow
  the prompt; `activity_create_variant` registers what it produces.
- Concept upkeep / dedup tuning to absorb autonomous-mint pollution.
  Existing concept-db upkeep activities (`prune-irrelevant-neighbors`,
  `decay-stale-relevance`) cover this surface.

## Dependencies

- `concept-db` advertises `concept_create_write` and `conceptLink_write`
  via `/v2/impulses/resolve` — already shipped.
- `development-vessel` advertises `substrateGap_write` via the same
  contract — already shipped.
- The autonomous drafter already reaches concept-db at `http://127.0.0.1:8260`
  (it primes from there); the same HTTP path is the dispatch target.

## Acceptance

The change is complete when:

1. The prompt in `draft-gap-closing-activity.ts` lists the three new
   write resolvers with their dispatch contracts.
2. `bun run lint` and `bun test` pass in `repos/development-vessel`.
3. The dev-vessel container has been hot-reloaded
   (`make -C scripts/substrate restart-development-vessel`).
4. `mcp__metabob__run_goal` against a goal that exercises the unlock
   produces an executionId with a successful or partial-success status,
   AND `mcp__metabob__concept_search` returns at least one new concept
   whose `source_type` indicates substrate authorship
   (`extracted` or similar; not `human_input`) describing the unlock.
5. A `vessel_construction_pattern` concept naming this unlock is minted
   and linked to `concept_y-CPpfVcAhL0`
   (`vessel_resolve_handler_dual_form`) so future drafters inherit the
   context.

## Non-Goals

This change does NOT claim lift. It removes one of the structural
constraints on autonomous accumulation; whether it materially changes
gap-closure rates is a separate measurement (tracked in the cycle
progression-driver).
