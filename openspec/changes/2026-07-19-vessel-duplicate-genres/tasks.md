# Tasks — vessel duplicate-handling genres

Each task is a dispatchable goal (names a single `repos/<vessel>/src` file where it edits code) unless marked [config] (super-repo, direct-editable) or [decision] (operator ratification).

## Genre substrate (keystone)
- [ ] **T1** [config] Add `genre` to every vessel in `scripts/substrate/vessels.inventory.json` per the design §3 mapping.
- [ ] **T2** Add `duplicate_policy` / `target_key` / `authoritative` fields to `VesselRegistration` in `repos/discovery-vessel/src/types.ts`; default absent → `stateless`.
- [ ] **T3** Stamp `duplicate_policy` at register time from the vessel's genre (`repos/discovery-vessel/src/registry.ts` register path); carry it into the hub mirror rows.
- [ ] **T4** Make `findByShape` / `resolveVesselCapability` genre-aware in `repos/discovery-vessel/src/resolvers.ts` (return one for authoritative/data-owner-pin; full live set for interchangeable/stateless).
- [ ] **T5** Stop unconditional `candidates[0]` in the `/resolve` gateway `repos/discovery-vessel/src/index.ts`; apply the policy; attach per-producer capacity state for interchangeable.

## LLM interchangeable (operator ask #7) — see companion `llm-arms-data-driven`
- [ ] **T6** [config] Replace the hand-authored opus/haiku/google units with a **data-driven arm list** (`[{id, model, provider, port}]` in one config location) rendered at boot into one unit + one single-provider `llm-<id>.env` each, enabled iff the provider key is present (ExecCondition). Declare arms with genre `interchangeable` so role subsetting + discovery selection apply. Adding an arm = one config line, findable fleet-wide within the namespace.
- [ ] **T7** [config] The rendered `llm-<id>.env` scopes the unit to a single provider credential (only that provider's key), so its quota == its provider's quota. No per-provider clearing hardcoded in gen-env — it falls out of the arm list.
- [ ] **T8** `repos/llm-resolver-vessel/src/index.ts`: make `hasCompletionQuota` / `syncCompletionAdvertisement` reflect the unit's **pinned** provider, so a dead arm de-advertises instead of silently serving via another provider.
- [ ] **T9** `repos/llm-resolver-vessel/src/index.ts` + `model-policy.ts`: remove the hardcoded `DEFAULT_MODEL='claude-sonnet-5'` and the `availableModels` literal; derive from keyed/uncooled providers + the shaped `llmModelPolicy`.
- [ ] **T10** `repos/goal-host-vessel/src/llm-router.ts`: consult producers' advertised quota state so cooling-but-still-listed arms are excluded from Thompson candidacy (redundant once de-advertisement is per-arm, but defends against mirror TTL lag).

## Identity authority
- [ ] **T11** [decision] Ratify standby-failover vs reject-second-registrant.
- [ ] **T12** `repos/activity-api/src/middleware/jwtAuth.ts`: resolve auth to the `unique_authoritative` instance only; drop the "find another resolver" failover to a peer authority.
- [ ] **T13** `repos/identity-vessel/src/services/jwt.ts`: derive `JWT_ISSUER` from the elected authority instead of the per-replica env pin.

## Stateful data-owner
- [ ] **T14** `repos/obsidian-vessel/src/concept-db-client.ts`: delete the `_fedTargetVessel: 'concept-db-local'` literal; resolve `concept` via `stateful_data_owner_pin` through discovery.
- [ ] **T15** [decision] Confirm `stateful_data_owner_merge` for activity-api (anti-entropy) vs pin.

## Human target
- [ ] **T16** [decision] Explicit `target_key` vs broadcast-first-answer for multiple present vaults.
- [ ] **T17** `repos/obsidian-vessel/src/main.ts` + `settings.ts`: advertise a per-human `target_key` when `isHumanVessel`.

## Docs
- [ ] **T18** [config] Document the per-genre duplicate contract in `docs/architecture/SUBSTRATE_AS_SOFTWARE.md` and replace the "Multiple replicas have separate registries" note in `repos/discovery-vessel/CLAUDE.md` with the coordination policy.

## Verification
- [ ] **T19** The four scenarios in design.md §6, each confirmed by an inspected trace (`reached`, not `status`).
