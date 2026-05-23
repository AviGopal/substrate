# trace-hash-chain Specification

## Purpose

Provide a per-vessel append-only cryptographic chain over execution
traces in `activity_execution_traces`, such that any retroactive
modification of a past trace is detectable by walking the chain.
The chain is the storage-layer immutability primitive on which
`signal-confidence-weighting`'s aggregation-layer defense and
H1's per-call corroboration depend.

The chain is **per emitting vessel**: each vessel that writes
traces maintains its own chain, keyed by `vessel_id`. Chains do
not merge across vessels; composition lineage between traces is
the separate `composition_chain` field already on every row.

## ADDED Requirements

### Requirement: Per-vessel chain link on every trace

Every trace row written under this capability SHALL carry two new
fields:

- `prev_chain_hash: string` — the `trace_hash` of the previous
  trace emitted by the same vessel, OR the literal string `"ROOT"`
  if this is the vessel's first trace.
- `trace_hash: string` — lowercase-hex SHA-256 over the canonical-
  JSON encoding of the trace body (including `prev_chain_hash`,
  excluding `trace_hash` itself). 64 characters.

Canonical-JSON is RFC 8785 (JCS), identical to the encoding defined
in `2026-05-17-state-space-signature-thompson-keying`. The two
capabilities share a single `canonicalJson()` helper.

Traces written before this capability lands carry both fields as
`null` and a `legacy_unchained: true` view marker. Legacy rows are
NOT retroactively chained; new traces from the same vessel begin a
fresh chain at `"ROOT"` on first post-migration write.

#### Scenario: First trace from a vessel bootstraps at ROOT

- **WHEN** vessel `V` emits its first trace under this capability
- **THEN** the trace's `prev_chain_hash` is the literal string `"ROOT"`
- **AND** activity-api admits the trace, computes its `trace_hash`,
  and creates a `vessel_chain_heads` row with
  `vessel_id = V, chain_head = trace_hash, trace_count = 1`

#### Scenario: Subsequent trace extends the chain

- **WHEN** vessel `V` (whose stored `chain_head = H`) emits a new trace
- **AND** the trace's `prev_chain_hash = H`
- **THEN** activity-api computes `new_hash = sha256_hex(canonical_json(body))`
- **AND** atomically updates `vessel_chain_heads` via CAS:
  `WHERE vessel_id = V AND chain_head = H SET chain_head = new_hash,
  trace_count += 1`
- **AND** persists the trace row with `trace_hash = new_hash`

### Requirement: Chain head publication via discovery

Discovery-vessel `RegisterRequest` and `HeartbeatRequest` SHALL
accept an optional `chain_head: string` field. The registry stores
it on the vessel record and includes it in `/resolve` responses.

No new shape is introduced; the field is additive metadata on
existing vessel records.

#### Scenario: Register publishes chain head

- **WHEN** vessel `V` registers with `chain_head = H`
- **THEN** `/resolve` queries that return the vessel `V` include
  `chain_head: H` in the vessel record
- **AND** the response also includes `chain_head_updated_at` so
  consumers can detect a stale head

#### Scenario: Heartbeat refreshes chain head

- **WHEN** vessel `V`'s heartbeat carries an updated `chain_head = H'`
- **THEN** the registry updates the stored field and the
  `chain_head_updated_at` timestamp

### Requirement: Ingestion validation rejects chain_break and chain_fork

Activity-api `POST /v2/activities/execution-traces` SHALL validate
every trace's `prev_chain_hash` against the stored vessel chain
head before admitting the trace. Failures map into the existing
`failure_mode.type = "verifier_negative"` taxonomy with three new
`sub_type` discriminators:

- `chain_missing_fields` — payload lacks `prev_chain_hash` or
  `emitting_vessel_id`.
- `chain_break` — `prev_chain_hash` does not match the stored
  chain head (and is not the bootstrap "ROOT" case for a vessel
  with no prior head).
- `chain_fork` — CAS lost; another concurrent writer extended the
  same chain head first.

Rejected traces are NOT stored in `activity_execution_traces`.
They ARE logged in a separate `chain_rejection_log` table with
30-day TTL for forensic replay.

#### Scenario: Stale prev_chain_hash is chain_break

- **GIVEN** vessel `V`'s stored chain head is `H`
- **WHEN** a trace arrives with `prev_chain_hash = H_OLD ≠ H`
- **THEN** the response is 400 with `failure_mode.type =
  verifier_negative` and `failure_mode.context.sub_type =
  chain_break`
- **AND** the context includes `{vessel_id: V, expected_prev: H,
  submitted_prev: H_OLD}`
- **AND** the AET row is NOT inserted
- **AND** a row is written to `chain_rejection_log`

#### Scenario: Concurrent extension is chain_fork

- **GIVEN** vessel `V`'s stored chain head is `H`
- **WHEN** two traces `T1, T2` arrive concurrently, each with
  `prev_chain_hash = H`
- **AND** activity-api processes them in some order
- **THEN** exactly one (the CAS winner) is admitted and updates
  the chain head
- **AND** the other receives 409 with `failure_mode.context.sub_type
  = chain_fork`

#### Scenario: Bootstrap ROOT is rejected when chain already exists

- **GIVEN** vessel `V`'s stored chain head is `H ≠ null`
- **WHEN** a trace arrives with `prev_chain_hash = "ROOT"`
- **THEN** the response is 400 with `sub_type = chain_break`
- **AND** the rejection context notes the chain already has a head

### Requirement: Cross-vessel verification walk

Any consumer SHALL be able to verify any vessel's chain end-to-end
by walking from the published `chain_head` backward to the `"ROOT"`
bootstrap, recomputing each `trace_hash` from the stored row body
and comparing to the stored value.

Activity-api exposes
`GET /v2/activities/execution-traces/by-hash/:trace_hash` returning
the AET row whose `trace_hash` matches; 404 on missing.

The verification utility is `scripts/verify-trace-chain.ts`. It is
off-line and operator-driven; ingestion-time validation per
Requirement 3 is the primary integrity gate.

#### Scenario: Verification walks an untampered chain

- **GIVEN** vessel `V` with stored `chain_head = H` and `N` chained
  traces
- **WHEN** `scripts/verify-trace-chain.ts --vessel-id V` runs
- **THEN** every link is verified (recomputed hash matches stored)
- **AND** the script reports `ok, N traces verified`

#### Scenario: Tamper is detected at the exact position

- **GIVEN** vessel `V` with a verified chain
- **WHEN** an operator directly modifies one trace's `success` field
  in SurrealDB (bypassing the API)
- **AND** the verification script runs
- **THEN** the script reports `tamper at execution_id E` where `E`
  is the modified trace
- **AND** all subsequent links also report broken (chained from the
  now-mismatched hash); the first break is the authoritative
  tamper point

### Requirement: Relationship to H1 two-sided traces

This capability provides storage-layer immutability. H1
(`2026-04-26-security-hardening-findings/design.md §H1`) provides
per-call cross-vessel corroboration via Ed25519 signatures.

Both layers compose multiplicatively:

- Past traces cannot be retroactively modified (this capability).
- Freshly written traces' per-call records cannot be unilaterally
  fabricated by the invoker (H1).
- Aggregation weights apply to surviving signals
  (`signal-confidence-weighting`).

This spec does NOT introduce signatures. When H1 lands, the
per-call signature digest SHALL bind to the chain by including
`trace.prev_chain_hash` in its preimage, preventing replay of a
signed call into a different chain position.

#### Scenario: Chain works without H1

- **WHEN** H1 has not yet been implemented
- **THEN** the chain still detects retroactive modification per
  Requirement 3 and Requirement 4
- **AND** posterior updates proceed on chained traces under the
  existing `signal_confidence_weight = 1.0` default

### Requirement: Failure-mode taxonomy extension

The three new `sub_type` values on `verifier_negative`
(`chain_missing_fields`, `chain_break`, `chain_fork`) SHALL be
admissible values on the existing `FailureMode` discriminated
`context` payload for `type = verifier_negative`. Schema migration
extends `FailureModeSchema` in
`repos/metabob-activity-api/src/models/schemas.ts` to accept the
new sub_type field on the verifier_negative context.

Workbench `ExecutionHistoryPanel` failure-mode filter gains the
three new sub_types so operators can filter chain-related
rejections.

#### Scenario: Workbench surfaces chain rejection

- **WHEN** an operator filters `ExecutionHistoryPanel` by
  `failure_mode.type = verifier_negative, sub_type = chain_break`
- **THEN** the panel renders the rejected entries from the
  `chain_rejection_log` table (the entries are NOT in the AET
  table since they were rejected)
- **AND** each row shows `{vessel_id, expected_prev, submitted_prev,
  timestamp}`

### Requirement: Tests

The change ships with:

- Unit tests on `validateAndExtendChain` covering ROOT bootstrap,
  valid extension, chain_break, chain_fork (CAS race simulation).
- Unit tests on canonical-JSON-of-trace fixture vectors shared
  with `2026-05-17-state-space-signature-thompson-keying`.
- Integration test: 100-trace chain from a test vessel verifies
  end-to-end with zero break.
- Integration test: direct DB tamper of one trace's `success`
  field is detected at the exact position.
- Integration test: two concurrent submissions on the same
  `prev_chain_hash` see exactly one admitted, one rejected as
  `chain_fork`.
- Integration test: discovery `chain_head` round-trips through
  register → heartbeat → resolve.

#### Scenario: Test suite passes deterministically

- **WHEN** `bun test` runs in `repos/metabob-activity-api` and
  `repos/discovery-vessel`
- **THEN** all tests above pass on three consecutive runs without
  flakes

### Requirement: Acceptance gates

Before this change is marked complete:

- §S.1 Schema migration applied on canary; Phase 19 reuse harness
  shows ≤ 2% drift on MRR, improvise_share, reuse_rate vs prior
  week.
- §S.2 Verification script walks the canary trace corpus for at
  least one emitting vessel (e.g. minibob) end-to-end and reports
  zero unintentional breaks.
- §S.3 Tamper integration test passes deterministically.
- §S.4 chain_break and chain_fork integration tests pass
  deterministically.
- §S.5 Discovery `chain_head` round-trip verified live on canary.
- §S.6 CLAUDE.md updated under "Execution Trace Model" with the
  new fields and a pointer to this spec.
- §S.7 No edits to `2026-05-23-signal-confidence-weighting/` or
  `2026-04-26-security-hardening-findings/`; only this spec's
  outbound references are verified to resolve.

#### Scenario: All gates satisfied

- **WHEN** §S.1 through §S.7 are confirmed
- **THEN** this change moves to archive per
  `openspec/changes/<archived>/`
