# Proposal: SurrealDB 3.x RL Layer — Moving the Learning Loop Closer to the Data

**Change ID**: `2026-04-29-surrealdb-rl-layer`
**Status**: Draft
**Date**: 2026-04-29

---

## Problem Statement

The Thompson Sampling loop, composition graph traversal, and activity search all involve O(N) application-layer aggregation over DB-fetched data. At the current canary scale this is tolerable; at production volume across multiple orgs and vessels it becomes a correctness risk, a performance risk, and a model-fidelity risk.

**Correctness risk.** Four active sites in metabob-activity-api perform fetch-modify-write sequences against α/β posterior fields: `execution-traces.ts:1938`, `activities.ts:3599`, `activities.ts:3639`, and `goal-paths.ts:402`. Under concurrent execution — multiple minibob replicas updating the same template after parallel goal runs — the last write wins and some α/β increments are silently lost. Thompson Sampling converges more slowly than it should; high-concurrency bursts may corrupt posteriors in ways that are hard to detect from traces.

**Performance risk.** The `discover-by-shapes` endpoint currently issues 21 queries per call: one to fetch an activity plus 10 individual metrics queries plus 10 composition queries, one per candidate. Shape-filtered traversal of the composition graph requires loading and joining in application memory. As the template corpus grows and more vessels register shapes, this fan-out grows linearly.

**Model-fidelity risk.** The composition graph IS the policy representation of the RL agent. Edge weights ARE the value function. Every execution is a policy evaluation step; every α/β update is a policy improvement step. SurrealDB 3.0 provides native primitives — atomic increment operators, COMPUTED fields, embedded JS functions, RELATE graph edges with payload filtering, HNSW vector indexes — that are exact matches for these RL primitives. The gap between the conceptual model and the implementation is not an abstraction choice; it is deferred work that accumulates as technical debt on every execution cycle.

---

## Architectural Framing

The system is a **graph reinforcement learning agent** built as a **functional state transformer**:

- **State** = the set of impulse shapes currently available to the executor
- **Action** = applying an activity template (inputShapes → outputShapes)
- **Policy** = Thompson Sampling over the composition graph
- **Reward** = execution success/failure → α/β posterior update
- **Topology learning** = ribosome mints new activity nodes; improvisation traces new composition edges

The database — which stores activity templates, composition edges, and α/β posteriors — IS the RL model. Moving update and query logic closer to SurrealDB is not an optimisation pass. It is making the implementation match the conceptual model.

SurrealDB 3.0 provides these capabilities as first-class primitives:

| Primitive | RL model element | Current approach |
|---|---|---|
| Atomic `+=` operators | Loss-free posterior updates | Fetch-modify-write (4 sites) |
| `COMPUTED` fields | Read-time EV derivation | JS aggregation on each request |
| Embedded JS `DEFINE FUNCTION` | DB-side Beta sampling | App-side `@stdlib/random-base-beta` |
| `RELATE` graph edges with payload | Composition policy graph | Separate join table + 21-query fan-out |
| HNSW vector indexes + `search::rrf` | Hybrid activity search | O(n) cosine scan + BM25 bound-param bug |

---

## Solution

Five targeted changes push the RL computation into SurrealDB 3.0's native primitives. Each phase is independently deployable with no breaking API changes.

**P1 — Atomic α/β updates.** Replace 4 fetch-modify-write sequences with SurrealDB atomic increment operators (`SET alpha += $da, beta += $db`). SurrealDB 3.0 SSI (Snapshot Serialisation Isolation) guarantees no lost updates under concurrent writes. ~12-15 lines of change.

**P2 — COMPUTED `ev` field.** Define a `COMPUTED` field `ev = alpha / (alpha + beta)` on all 8 tables carrying α/β posteriors. The field is derived at read-time from live α/β values — no stale cache, no JS aggregation loop. The recommend endpoint `ORDER BY ev DESC` in SQL and applies JS heuristic boosts only to the pre-filtered set. ~80 lines of JS ranking code simplified.

**P3 — `fn::beta_sample` stored function.** Implement true Beta distribution sampling in SurrealDB embedded JS (Johnk/Cheng algorithm). Move the Thompson sampling call at `activities.ts:4416` to invoke the DB function via `ORDER BY fn::beta_sample(alpha, beta) DESC`. App-side fallback to `@stdlib/random-base-beta` on DB function unavailability. ~10-20 lines of change plus one migration.

**P4 — RELATE edges for the composition graph.** Migrate `activity_composition_graph` to `RELATE activity_template:A->composes->activity_template:B` edges carrying α/β fields and `input_shapes`/`output_shapes` arrays directly on the edge. The `discover-by-shapes` traversal becomes a single shape-filtered graph query: 21 queries per call → 1-2. ~90 lines of JS graph traversal removed.

**P5 — HNSW indexes + BM25 bound-param fix.** Two issues: (a) `paradigm.ts:998` has a bound-parameter syntax error that causes BM25 search to silently return zero scores for any query containing dynamic parameters; (b) dense search in `paradigm.ts:1103-1180` performs an O(n) full-table cosine scan. Fix (a) by inlining the sanitised literal. Fix (b) by adding an HNSW index on the 384-dim embedding fields and switching to `<|k,ef|>` KNN operator. ~50 lines of change, one migration.

---

## What Stays Application-Side

The application layer retains responsibility for:

- Multi-tier fallback logic (Tier 1/2/3 recommendation cascade)
- 9 heuristic boost calculations in the recommend endpoint (these are domain heuristics, not RL signals)
- Redis cache invalidation (TTL-based; COMPUTED fields do not change the write path)
- Multi-tenant org scoping in query predicates
- Thompson Sampling candidate fan-out and multi-template ranking (the DB function samples; the app assembles the ranked list)

---

## Rollout Order

P1 first (correctness) → P5A next (BM25 bug, search correctness) → P2 (COMPUTED ev) → P3 (fn::beta_sample) → P4 (RELATE edges) → P5B (HNSW). Each phase ships and is canary-validated before the next begins.

---

## Out of Scope

- Changing the Thompson Sampling algorithm itself (true Beta sampling is already correct; P3 moves it, not changes it)
- Changing the recommendation endpoint's response contract
- Multi-tenant schema changes (all changes operate within existing org-scoped PERMISSIONS)
- Security hardening H1/H2/H4 prerequisites (this change does not touch the trust/verification layer)
