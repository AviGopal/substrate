# Vessel duplicate-handling genres — genre-aware resolution so N producers of one shape are disambiguated by declared policy, not per-caller guesswork

**Date:** 2026-07-19
**Vessels:** discovery-vessel (registration + resolution), identity-vessel + activity-api (authority genre), llm-resolver-vessel + goal-host-vessel (interchangeable genre), obsidian-vessel + concept-db + development-vessel (data-owner genre)
**Stage:** SPEC (grounded in a live registry probe + a code audit of every caller's producer-set pick)
**Lever:** discovery is the sole routing fixed point (law: dynamic routing through one registry). Today it returns *every* advertiser of a shape as an undifferentiated set and pushes the one-or-many choice to each caller, who each decide differently. Making resolution **genre-aware** is the single mechanism that fixes multi-arm LLM selection, cross-substrate findability, and the concept-graph pin — all three are the same missing abstraction.

## Problem (grounded live 2026-07-19)

Discovery keys the registry by `vesselId` and indexes every advertiser of a shape into one undifferentiated `shapeIndex: Map<shape, Set<vesselId>>` (`repos/discovery-vessel/src/registry.ts:31,252-257`). `findByShape` returns **all** live producers (`registry.ts:334-355`); the `/resolve` gateway picks `candidates[0]` (`repos/discovery-vessel/src/index.ts:205`); `resolveVesselCapability` echoes the full list with a hardcoded confidence 1.0 (`resolvers.ts:78`). There is **no genre or duplicate-policy field** on `VesselRegistration` (`types.ts:93-222`) — only an unused `stateful?` boolean and an unused `metadata.replicaIndex`. So the choice of *which* producer, or *how many*, is made inconsistently by every caller:

- **Interchangeable compute (llm_completion)** — the one correct case. `llm-resolver-vessel` de-advertises when every provider is cooling (`index.ts:129-163`, `hasCompletionQuota` gate) and `goal-host-vessel` Thompson-samples across producers (`llm-router.ts:270-284`). But this lives **only** in goal-host's own path and only for llm_completion.
- **Satisfier / walk picks** — highest `priority` else `producers[0]` (`goal-host-vessel/src/satisfier-pick.ts:26`): arbitrary first-pick, no balancing, no genre awareness.
- **Generic callers** — bare `vessels[0]` in many goal-host spots.
- **Stateful data-owner (concept graph)** — hand-pinned with a literal string `_fedTargetVessel: 'concept-db-local'` (`obsidian-vessel/src/concept-db-client.ts:479-484`) *precisely because* "the `concept` shape has multiple registrants fleet-wide." A band-aid, not a policy, and it violates law 1 (behavior gated behind a non-shaped constant).
- **Unique authoritative validator (identity)** — treated as **failover-interchangeable**: `activity-api/src/middleware/jwtAuth.ts:19-20` falls back to "another resolver" when identity is down, and two identity-vessels advertising the auth shape are **both selectable** → split-brain authority. `JWT_ISSUER` is env-pinned per replica (`identity-vessel/src/services/jwt.ts:15`), not derived from an elected authority.
- **Unique fixed point (discovery)** — in-memory, no cross-replica coordination (its own CLAUDE.md: "Multiple replicas have separate registries").
- **Unique human target (obsidian vault)** — handled best (`isHumanVessel` gates advertisement, presence-conditioned), yet among **two present vaults for one org** the `human_input` shape is still an undifferentiated set pick.

The one existing dedup path (`registry.ts:48-98 deduplicateByPeerIdentity`) only evicts a *re-registration of one physical vessel* (same base-name + same libp2p peer); it deliberately keeps distinct vesselIds serving one shape, so it does nothing for cross-instance genre policy.

## Key insight: "how to treat a duplicate" is a property of the producer's genre, and it is a shape

The operator's framing — *"each vessel determines what should happen when there are duplicates of itself"* — is the statement that duplicate-handling is **per-genre behavior**, and by law 1 behavior is steered by a shaped impulse read at use time. So the fix is not N caller-side heuristics; it is **one field** — a declared `duplicate_policy` on each registration — that discovery, the sole routing fixed point, honors when it resolves a shape. The choice of one-or-many moves out of every caller and into the router, where it is observable, learnable, and uniform.

This single abstraction closes three separately-reported gaps at once:

- **Multi-key LLM selection (operator ask: N resolvers, best-quota-having used).** `interchangeable` + capacity de-advertisement + posterior selection *is* the llm_completion pattern — promoted from goal-host-internal to a discovery-served genre every caller consults. A cooling arm de-advertises; discovery returns the live quota-having set ranked by learned posterior; adding a provider is declaring one more arm.
- **Findability (operator ask: any vessel dialing discovery/relay is found by all).** A `unique_target` / `stateful_data_owner` / `interchangeable` tag travels with the registration into the hub mirror and peer registries, so a dialed-in vessel is not merely *present* but *correctly typed* everywhere it propagates (see the companion relay-replication change).
- **Concept-graph pin (law-1 violation).** `stateful_data_owner` resolves the `concept`/`memoryNote` shapes to their data owner *through discovery*, retiring the `_fedTargetVessel` string literal.

## The genre taxonomy (answer to "enumerate the options")

| Genre | Duplicate policy | Members | On a second producer of the same shape |
|---|---|---|---|
| `unique_authoritative` | **elect-one / standby** — at most one authoritative at a time | identity-vessel, discovery-vessel | second registers as **standby** (failover only), never concurrently authoritative; auth resolves only to the authority |
| `unique_target` | **pin-by-identity** — not interchangeable; caller must address the intended target | obsidian human vaults, stateful-ui | discovery returns the disambiguating `target_key` (org + human/vault identity + presence), not a bare set |
| `interchangeable` | **load-balance + capacity de-advertise** | llm-resolver arms, local-tools | every capable instance selectable; one lacking capacity **de-advertises**; selection is learned across the live set |
| `stateless` | **any** — pure function of input | analysis, ribosome, light-dispatch, relevance-sink | duplicates harmless; first-pick or balanced-pick both correct |
| `stateful_data_owner` | **pin-to-owner** or **merge-by-anti-entropy** | concept-db, development-vessel (pin); activity-api (merge) | pin: resolve to the instance co-located with the data (law 11); merge: converge via upsert/anti-entropy |

## Decisions (ratified by the operator 2026-07-19)

1. **Identity is the namespace boundary — duplicate handling keys on secret-identity, not election.** identity-vessel *defines what is inside a discovery namespace vs outside*. So a second identity-vessel is disambiguated by whether it **shares the same secrets** (`API_KEY_SECRET` / signing keys) as the first:
   - **Same secrets → replica** of one authority: interchangeable failover within the *same* namespace (merge/standby, never split-brain — they are the same authority).
   - **Different secrets → a foreign federated namespace:** discovery registers it as a *separate* namespace (a peer network), not a competing authority in the local one. Its shapes are reachable only through the explicit federation boundary, and a mirrored remote identity **never** becomes a second local authority.
   This makes `unique_authoritative` a property of *the namespace the secret defines* — and is the seam where per-vessel genre policy meets the full federated structure. (Supersedes the earlier standby-vs-reject framing: sameness-of-secret decides.)
2. **Discovery replica policy → registry propagation** (companion relay-findability change) so "any vessel dialing discovery is found by all" holds — scoped to *within a namespace* (per decision 1). A propagated row carries its genre, so a mirrored remote row is typed correctly (a remote identity stays foreign, not local-authoritative).
3. **Stateful sub-genres split:** `stateful_data_owner_pin` (concept-db, development-vessel) vs `stateful_data_owner_merge` (activity-api, eventually-consistent).
4. **Human-target disambiguation → explicit `target_key`** when multiple vaults are present for one org.

## Approach

Add a shape-visible `duplicate_policy` (and optional `target_key`) to `VesselRegistration`; stamp it at boot from a `genre` field in `vessels.inventory.json`; make `findByShape` / the `/resolve` gateway / `resolveVesselCapability` honor it (one for authoritative/data-owner, ranked-live-set for interchangeable/stateless). Then retire the three per-caller band-aids (identity failover, `_fedTargetVessel` literal, goal-host-only llm selection) by pointing them at the genre-aware resolver. This is behavior-preserving for the llm_completion happy path (same producers, same Thompson) and behavior-*correcting* for identity (no more split-brain) and concept (no more literal pin).

## Non-goals

- Cross-substrate registry *consensus* (Raft/CRDT). Propagation + last-writer-wins upsert with TTL is sufficient for findability; strong consensus for the authoritative genre is a later change if standby-failover proves insufficient.
- Changing the libp2p transport or relay topology (companion change).
