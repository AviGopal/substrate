# Design — genre-aware discovery resolution

## 1. Registration schema (discovery-vessel)

Add to `VesselRegistration` (`repos/discovery-vessel/src/types.ts`):

```ts
duplicate_policy?:
  | 'unique_authoritative'   // elect-one / standby
  | 'unique_target'          // pin-by-identity
  | 'interchangeable'        // load-balance + capacity de-advertise
  | 'stateless'              // any
  | 'stateful_data_owner_pin'   // resolve to the data owner
  | 'stateful_data_owner_merge' // converge by anti-entropy
target_key?: string          // for unique_target: org + human/vault identity
authoritative?: boolean      // for unique_authoritative: is THIS the authority (vs standby)
```

Default when absent: `stateless` (today's effective behavior for a non-llm shape is first-pick, which is the stateless policy — so absence is backward-compatible).

The field is **shape-visible** (law 1): it travels in the registration body, into the hub mirror rows, and is readable by any caller that resolves the shape — not an in-process constant.

## 2. Resolution algorithm (`registry.ts findByShape` → `resolvers.ts` → `index.ts /resolve`)

Group the live producer set for a shape by `duplicate_policy`, then:

- `unique_authoritative` → return the single `authoritative:true` instance; standbys are returned only with an explicit `include_standby` flag (for failover probing). **Never** return two authoritatives; if two claim it, the earliest-registered wins and the later is demoted + a `duplicate_authority` gap is emitted.
- `unique_target` → require `target_key` in the resolve pointer; return the instance whose `target_key` matches. With no target_key and >1 present, return the disambiguation list (caller must choose), not `[0]`.
- `interchangeable` / `stateless` → return the **full live set** for learned selection; attach each producer's advertised capacity/quota state so the caller (or a discovery-served selection shape) can rank. This is where the llm_completion Thompson pattern plugs in.
- `stateful_data_owner_pin` → return the instance co-located with the data (matched by a `data_locality` tag on the registration, e.g. `concept-db-local`); this replaces the caller-side `_fedTargetVessel` string.
- `stateful_data_owner_merge` → return the local instance; writes are upserted and converge by anti-entropy (activity-api's documented model) — resolution never has to pick "the" authority.

The `/resolve` gateway stops doing `candidates[0]` unconditionally (`index.ts:205`); it applies the policy above.

## 3. Genre source of truth — vessels.inventory.json → boot stamp

Add a `genre` field to each vessel in `scripts/substrate/vessels.inventory.json`. `apply-inventory.sh` / the vessel's own registration reads it and stamps `duplicate_policy` at register time, so a fork or a location-specific deployment can retype a vessel without code changes. Mapping:

| genre | vessels |
|---|---|
| `unique_authoritative` | identity-vessel, discovery-vessel |
| `stateful_data_owner_pin` | concept-db, development-vessel |
| `stateful_data_owner_merge` | activity-api |
| `interchangeable` | llm-resolver-vessel (+ opus/haiku/google arms), local-tools-vessel |
| `stateless` | analysis-vessel, ribosome-vessel, light-dispatch-vessel, relevance-sink-vessel |
| `unique_target` | obsidian human vaults, stateful-ui-vessel |

## 4. Retiring the three band-aids

- **identity split-brain** (`activity-api/src/middleware/jwtAuth.ts:19-20`, `identity-vessel/src/services/jwt.ts:15`): auth validation resolves via `unique_authoritative` → the authority only; issuer derived from the elected authority, not env-pinned per replica. A mirrored *remote* identity is never a second local authority.
- **concept pin** (`obsidian-vessel/src/concept-db-client.ts:479-484`): delete the `_fedTargetVessel: 'concept-db-local'` literal; resolve `concept` via `stateful_data_owner_pin` through discovery.
- **goal-host-only llm selection** (`goal-host-vessel/src/llm-router.ts`, `satisfier-pick.ts:26`): the interchangeable-genre live-set-with-capacity resolution is discovery-served, so non-goal-host callers get the same quota-aware balancing instead of `[0]`.

## 5. Interaction with LLM multi-arm (operator ask #7)

The `interchangeable` genre is the mechanism for multi-key LLM: each `llm-resolver-*` unit is one arm; when its provider quota dies it de-advertises (already wired via `hasCompletionQuota`, made per-arm by the companion single-provider-scoping change to gen-env); discovery returns the live quota-having arms; selection is the learned posterior. "If only one has quota, it is used" falls out of de-advertisement; "best of the available subset" falls out of posterior ranking. See tasks T6–T8.

## 6. Test / verification

- Two llm-resolver arms, kill one provider's quota → the killed arm de-advertises; a `run_goal` that needs llm_completion routes to the survivor; trace shows the survivor's vessel_id.
- Register a second identity-vessel → it registers `authoritative:false`; auth still validates against the first; killing the first promotes the second.
- Resolve `concept` with two registrants (concept-db + development-vessel) → returns the data owner, no `_fedTargetVessel` in the path.
- Two present obsidian vaults for one org, `human_input` with a `target_key` → reaches the named vault only.
