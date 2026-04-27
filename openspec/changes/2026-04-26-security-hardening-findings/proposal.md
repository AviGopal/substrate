## Why

A comparative survey of distributed-system trust models — smart contracts (EIP-712, OpenZeppelin TimelockController, UUPS namespaced storage), Kubernetes / SPIFFE workload identity, mobile MDM (Apple App Attest, Play Integrity), content-addressed networks (IPFS PeerID, BEP-44), and overlay networks (Tailscale node identity, Tailnet Lock) — surfaces five primitives that production multi-actor systems converge on. Our system implements none of them yet, and three in-flight changes shipping the same week as this proposal *increase* the trust surface that they would protect:

1. `2026-04-26-impulse-binding-selection-layer` lifts pool and producer selection into Thompson-Sampled activity space. The α/β posteriors that drive routing now depend entirely on the trustworthiness of the trace stream — a single misbehaving vessel that lies about its own success rate can move global routing in its favour.
2. `2026-04-26-shape-provider-goal-creation` lets activities propose new goals when a shape is unbindable. Without scope attestation, child goals can claim broader scope than the parent that emitted them.
3. `2026-04-26-validators-and-failure-modes` makes validator output the authoritative success signal. A validator that lies about `passed: true` is now indistinguishable from a successful task.

Three concrete findings from the prior security audit reinforce this:

- **Finding 1**: Any caller with a valid org API key can call `discovery-vessel POST /register` claiming any shape — `vessel_id` is opaque, not bound to a key.
- **Finding 2**: `POST /v2/activities/execution-traces` accepts the executor's word for what happened. No counterparty corroboration; no signature.
- **Finding 3**: A child activity's `composition_chain` carries no scope-narrowing constraint. A descendant can act in the name of an ancestor with broader scope than the parent intended.

This change codifies the five primitives — each with a direct production-system precedent — as a unified security spec. It is intentionally *standalone*: it does not modify the in-flight changes, but it documents which hardenings must precede which sibling changes (see `design.md` Sequencing).

## What Changes

The five hardenings, each borrowing from one named precedent:

- **Two-sided execution traces** (BitTorrent private-tracker stat-fake detection) — invoker and invoked vessel each submit a signed view of every cross-vessel call; activity-api stores both, computes per-pair discrepancy, downgrades vessels with systematic mismatch. Single-sided traces remain valid for observability but are inadmissible to Thompson posterior updates.
- **Vessel-id derived from pubkey** (IPFS PeerID, Tailscale node identity) — `vessel_id = multihash(vessel_pubkey)`. Registration carries a self-signed challenge proving possession of the matching private key. Eliminates registration spoofing at the protocol level.
- **EIP-712-style signed scope attestations** (EIP-712 typed-data signing, BEP-44 mutable-record signatures, Apple App Attest) — every `scopeContext` impulse carries a signature over `{issuer, audience-vessel-id, scope-hash, nonce, deadline}` from an attesting key. Verified at impulse-write time.
- **Tailnet-Lock-equivalent for vessel registration** (Tailscale TKA / Authority Update Messages) — customer-held authority keys cross-sign every registration; the key set evolves as an append-only log every consumer verifies. Quorum required for registrations of high-risk shapes (per `toolRiskProfile`).
- **Immutable-baseline selector with auto-regression** (OpenZeppelin TimelockController, UUPS namespaced storage, Play Integrity server-side verdict) — every resolver family has exactly one variant marked `baseline: true`, immutable, never auto-mutated. Auto-regression to baseline if a non-baseline variant exceeds a failure-rate threshold within a rolling window. Promotion to baseline requires authority-key signature.

Plus two cross-cutting invariants:

- **Scope-narrowing on composition** (UCAN delegation, Solidity reentrancy guards) — child activity scope must be a subset of its parent's. Closes the composition-chain inheritance gap.
- **Risk-graded dispatch** (k8s Pod Security Standards, Tailscale exit-node two-party consent) — high-risk shapes per `toolRiskProfile` only dispatch to vessels with external attestation (k8s service-account token, git OIDC, identity-vessel-issued member token).

## Capabilities

### New Capabilities

- `security-hardening`: the unified spec covering all five primitives plus the two cross-cutting invariants. The capability owns the testable assertions; concrete data-model changes per repo are described in `design.md` and tracked in `tasks.md`.

### Modified Capabilities

None. This change adds new requirements; it does not modify the contracts of any existing spec. Several in-flight specs (impulse-binding-selection-layer, shape-provider-goal-creation, validators-and-failure-modes) carry sequencing dependencies on this one — captured in `design.md` Sequencing — but their contracts remain as written.

## Scope

**In scope.** Specification of the five primitives, their borrowed mechanisms, the data-model and protocol changes they imply, and the sequencing constraint between them and the in-flight selection-layer change.

**Out of scope.** Implementation. Migrations. Compatibility refactors of the in-flight specs (a parallel agent is doing that). Hardware-attested vessels (TPM, Apple Secure Enclave) — discussed only as the destination state for risk-graded dispatch. Key rotation procedures beyond the disablement-secret break-glass — left for a follow-up. Threat modeling for adversarial Thompson Sampling poisoning beyond the two-sided trace defense — flagged as an open question.

## Impact

Spec-only. No code, no migrations, no deployment changes are included in this change. Implementation tasks in `tasks.md` are scoped per repo (discovery-vessel, minibob, metabob-activity-api, identity-vessel) but not executed here.

## Dependencies

- This change is a **precondition** for the safety properties of `2026-04-26-impulse-binding-selection-layer`. The selection layer ships routing decisions onto Thompson posteriors; hardening 1 (two-sided traces) prevents a vessel from poisoning its own posterior. The remaining hardenings can land in parallel or after.
- `2026-04-26-shape-provider-goal-creation` benefits from hardening 3 (signed scope attestations) and the scope-narrowing invariant. It is *not* a precondition; the goal-creation spec works without scope attestations, just with weaker guarantees.
- `2026-04-26-validators-and-failure-modes` benefits from hardening 1 and hardening 5 (a validator is itself a resolver family with a baseline). Not a hard precondition.
- identity-vessel is the natural home for the authority-key set defined in hardening 4 and the attestation registry referenced in risk-graded dispatch.
