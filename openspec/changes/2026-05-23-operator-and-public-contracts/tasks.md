# Tasks — Operator-as-Vessel and Substrate-Public Contracts

Spec source: `specs/operator-and-public-contracts/spec.md`.
Design: `design.md`.

## §1 Operator-vessel registration

- [ ] §1.1 Extend `discovery-vessel`'s `RegisterRequest` type
  (`repos/discovery-vessel/src/types.ts`) to accept
  `kind: "operator"`. Existing values (`executor`, `resolver`,
  `lifecycle-subscriber`) are preserved.
- [ ] §1.2 Implement `OperatorVesselRegistration` payload validation
  per design §A: required `identity_binding_method`, `pubkey`,
  `emit_shapes[]`, `consume_shapes[]`. Pre-H2 default
  `identity_binding_method: "session_pubkey_tofu"`.
- [ ] §1.3 Persist `operator_vessel_id` on first registration; on
  re-registration verify pubkey match. Mismatch fails closed with
  `interventionRefused.refusal_code: "operator_pubkey_mismatch"`.
- [ ] §1.4 Multi-operator support: each operator-session pubkey
  registers a distinct operator-vessel-id; persist all and track
  separately.
- [ ] §1.5 At substrate boot, the operator's first identity-vessel
  session triggers operator-vessel registration via a substrate-
  resident bootstrap activity (`bootstrap-operator-vessel`).
- [ ] §1.6 Test: TOFU acceptance of new operator pubkey on first
  contact; mismatch rejection on subsequent contact.

## §2 Operator-emit shape contracts

- [ ] §2.1 Define `operatorGoal` shape body per design §A.
  Advertise via the operator-vessel's `emit_shapes` declaration.
- [ ] §2.2 Define `heldOutEvalSetCuration` shape body. Advertise.
- [ ] §2.3 Define `adversarialProbeSetCuration` shape body.
  Advertise.
- [ ] §2.4 Define `foundationComplianceUpdate` shape body.
  Advertise.
- [ ] §2.5 Define `h5BaselinePromotion` shape body. Advertise.
- [ ] §2.6 Define `federationPeeringAuthorization` shape body.
  Advertise.
- [ ] §2.7 Define `liftStatusConfirmation` shape body (referenced
  by IAL §27.2.1 lift-status.json contract). Advertise.
- [ ] §2.8 Define `directionGoal` shape body. Advertise.
- [ ] §2.9 Additive amendments to existing
  `operatorIntervention` and `interventionRefused` bodies (per
  intervention-tracking R1, R2) to include optional
  `actor.operator_vessel_id` field. Coordinate with
  `2026-05-23-intervention-tracking` ownership (cross-reference,
  do not edit that change's files).
- [ ] §2.10 Per-shape contract test pinning the body schema.

## §3 Confidence-weight defaults

- [ ] §3.1 Implement the per-category default table from design §B
  in operator-vessel emission path. Each operator-emitted impulse
  populates `signal_confidence_weight` from the table.
- [ ] §3.2 Operator-tunable config file
  `validation/state/operator-vessel-config.json` with the default
  table and per-category override schema.
- [ ] §3.3 Test: emit one operator impulse per category; assert
  weight matches the default table.
- [ ] §3.4 Test: operator-tunable override of one category;
  emission picks up the override.

## §4 Intervention-tracking attribution integration

- [ ] §4.1 `fs-watcher` hook attribution path: read modifying
  process's identity-vessel session via process-tree introspection;
  set `actor.operator_vessel_id` or fall back.
- [ ] §4.2 `orchestration-log` hook: read invoking session token;
  attribute or fall back.
- [ ] §4.3 `api-origin` hook: read request JWT's
  `identity_vessel_session`; attribute or fall back.
- [ ] §4.4 `db-audit` hook: cross-reference SurrealDB audit user
  → identity-vessel → operator-vessel-id; attribute or fall back.
- [ ] §4.5 `spec-attribution` hook: parse `Co-Authored-By` trailer;
  resolve operator email → operator-vessel-id; attribute or fall
  back.
- [ ] §4.6 Per-hook test asserting the attribution path produces
  the correct `actor.operator_vessel_id` (or `fallback:
  "anonymous-operator"`).

## §5 Substrate-public-shapes enumeration

- [ ] §5.1 Add `SUBSTRATE_PUBLIC_SHAPES` table to activity-api's
  discovery config (`repos/metabob-activity-api/src/config.ts`)
  with the full enumeration from design §C.
- [ ] §5.2 Per-shape `SubstratePublicContract` metadata
  (`stability`, `freshness_max_age_s`, `audience[]`,
  `signature_version`, `authenticity_method`).
- [ ] §5.3 Validation: every shape in the enumeration MUST be an
  advertised shape by some substrate vessel. Boot-time check fails
  fast on missing advertisement.
- [ ] §5.4 Test: enumeration is non-empty; each shape has all
  required metadata fields; freshness window is positive when
  non-null.

## §6 Substrate-public-feed resolver

- [ ] §6.1 Decide placement (activity-api default; development-
  vessel alternative). Document in this tasks file under §6.1
  after the decision.
- [ ] §6.2 Implement `POST /v2/substrate-public-feed/query` per
  design §E request/response contract.
- [ ] §6.3 Audience resolution from caller's vessel record. The
  default is `operator` for operator-vessel callers, `peer-
  substrate` for federated peer callers (gated by
  `2026-05-23-vessel-federation`).
- [ ] §6.4 Per-shape query path: round-robin across shapes to
  avoid one chatty shape starving others. Default limit 100, max
  1000.
- [ ] §6.5 Cursor encoding (opaque HMAC-signed per-shape last-seen
  position).
- [ ] §6.6 Freshness-warning computation against
  `freshness_max_age_s`.
- [ ] §6.7 Authenticity envelope population: pre-H2 returns no
  `_authenticity` field (auth boundary); post-H2 returns signature
  per design §D.
- [ ] §6.8 Closure binding test: `closure-audit
  --without=operator-shell` reports zero failures.
- [ ] §6.9 Test: feed query returns at least one emission per
  enumerated public shape that has any recent activity.
- [ ] §6.10 Test: non-enumerated shape (e.g., raw
  `activityExecutionTrace`) is NOT returned by the feed even when
  the caller has admin scope.
- [ ] §6.11 Test: cursor pagination is monotonic; no emission
  appears twice across pages.

## §7 Reputation surface

- [ ] §7.1 Activity-api Thompson posterior keying extension:
  posteriors for operator-emitted impulses use
  `(impulse_category, operator_vessel_id)` as the key.
- [ ] §7.2 Posterior update path: α increment on operator-impulse
  downstream-validated, β increment on downstream-refuted (per
  design §A).
- [ ] §7.3 Per-operator reputation read: extend `operatorVessel`
  resolver to surface
  `reputation.impulse_count_by_category` and
  `refused_count_by_category` from posterior store.
- [ ] §7.4 Test: emit two operator impulses (one validated, one
  refused); reputation counts increment correctly.

## §8 Push-away coverage

- [ ] §8.1 Test: an operator-emitted `operatorGoal` violating
  foundation invariants is refused by `foundation-compliance`
  validator. `interventionRefused` carries
  `intervention_attempted.actor.operator_vessel_id` populated.
- [ ] §8.2 Test: an operator-emitted impulse with malformed body
  is refused by the standard activity-api validation; refusal
  carries operator-vessel attribution.
- [ ] §8.3 Test: an operator-emitted `liftStatusConfirmation`
  with `status: "confirmed"` while `chainStallReport.stall_
  detected = true` is refused per IAL §27.3.d.4; refusal cites
  the chain-stall report and operator-vessel attribution.

## §9 Documentation

- [ ] §9.1 Update CLAUDE.md "Authentication" section: note the
  operator-vessel registration as the foundational vessel
  primitive the substrate uses for operator-impulse attribution
  pre-H2.
- [ ] §9.2 Add `docs/SUBSTRATE_PUBLIC_CONTRACT.md` enumerating
  the public shapes and per-shape contract metadata for external
  consumers.
- [ ] §9.3 Cross-reference from `docs/PRODUCT_BOUNDARIES.md` to
  the new substrate-public-feed surface.

## §S Acceptance gates

- [ ] §S.1 Operator-vessel registration: end-to-end TOFU
  acceptance on canary substrate. Operator-vessel record visible
  in discovery-vessel `/registry/stats` with `kind: "operator"`.
- [ ] §S.2 At least one impulse emitted per operator-emit shape
  (the ten shapes from §2); each carries correct
  `signal_confidence_weight` per the default table.
- [ ] §S.3 Intervention-tracking attribution: at least one
  `operatorIntervention` emission carries
  `actor.operator_vessel_id` populated (non-fallback) from each
  of the five detection hooks.
- [ ] §S.4 Substrate-public-feed query returns the full
  enumerated set when caller is operator-vessel and recent
  activity exists for each shape.
- [ ] §S.5 Non-enumerated shape leak test: feed does NOT return
  raw `activityExecutionTrace` impulses under any audience or
  scope.
- [ ] §S.6 Push-away test: operator-emitted impulse violating a
  gate is refused; refusal cites operator-vessel-id.
- [ ] §S.7 Closure-audit: `closure-audit --without=operator-
  shell` reports zero failures for the
  `bootstrap-operator-vessel` activity AND the
  `substrate-public-feed` resolver.
- [ ] §S.8 Cross-reference to IAL §27.S.5 documented as the
  foundational pre-lift primitive for substrate-authored
  post-lift expansion.

## §X Out of scope (documented for handoff)

- Substrate-authored vessel registrations for non-operator
  externals (Anthropic API, GitHub, CI, peer substrates) —
  authored post-lift via `2026-05-23-external-resolver-
  vesselization`.
- Operator-vessel-trust-tuning (Thompson selection on
  `(impulse_category, operator_vessel_id)`) — sibling spec.
- Substrate-state-snapshot publication for federation peers —
  sibling spec.
- Operator UX for session lifecycle management (rotation,
  revocation, multi-device) — follow-up operations doc.
- Per-shape signature_version migration paths — defined per
  successor openspec change when a public shape evolves.
