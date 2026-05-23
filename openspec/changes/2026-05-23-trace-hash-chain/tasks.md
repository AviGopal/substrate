# Tasks — Trace Hash Chain

## §1. Schema migration

- [ ] 1.1 Add fields `prev_chain_hash: string` and `trace_hash: string`
      to `activity_execution_traces` schema in
      `repos/metabob-activity-api/src/models/schemas.ts`. Both
      OPTIONAL during the migration window; new code populates them,
      legacy rows null.
- [ ] 1.2 Add `emitting_vessel_id: string` if not already present
      (rename `vessel_id` semantics or add a parallel field; the
      existing `vessel_id` denotes "trace sender" so the rename is
      a no-op in code).
- [ ] 1.3 Add unique secondary index:
      `DEFINE INDEX aet_trace_hash ON activity_execution_traces
      FIELDS trace_hash UNIQUE` (allowing NULL via partial-index
      semantics; legacy rows remain unindexed).
- [ ] 1.4 Create `vessel_chain_heads` table per `design.md §B`,
      with unique index on `vessel_id`.
- [ ] 1.5 Migration script writes the new schema and back-fills
      `legacy_unchained: true` on all existing rows where
      `trace_hash IS NULL`.
- [ ] 1.6 Test the migration against a SurrealDB snapshot of the
      canary trace corpus (≈10⁴ rows): post-migration the schema
      is healthy and existing posteriors are unchanged.

## §2. Activity-api ingestion validation

- [ ] 2.1 Add `repos/metabob-activity-api/src/lib/chain-validation.ts`
      exporting `validateAndExtendChain(vessel_id, prev_chain_hash,
      trace_body) -> { ok: true, trace_hash } | { ok: false,
      sub_type, context }`.
- [ ] 2.2 Wire `validateAndExtendChain` into
      `POST /v2/activities/execution-traces` at
      `repos/metabob-activity-api/src/routes/execution-traces.ts`
      before the existing posterior-update path. Reject paths emit
      400/409 with `failure_mode = verifier_negative` and the
      appropriate `sub_type`.
- [ ] 2.3 Reuse the canonical-JSON helper from
      `repos/metabob-activity-api/src/lib/canonical-json.ts` (the
      same module that state-space-signature uses). Add the trace-
      body hash function next to it; do not fork the helper.
- [ ] 2.4 Add a `chain_rejection_log` table and write rejected
      payloads (truncated bodies, full rejection context) for
      forensic replay. SCHEMAFULL with a 30-day TTL.
- [ ] 2.5 Emit a `lifecycle:trace:chain_rejected` event on the
      activity-api WebSocket broadcaster carrying the
      `{vessel_id, sub_type, expected_prev, submitted_prev}`
      payload, so workbench and operator dashboards can observe
      chain breaks in real time.

## §3. Discovery-vessel chain head publication

- [ ] 3.1 Extend `RegisterRequest` and `HeartbeatRequest` in
      `repos/discovery-vessel/src/types.ts` with optional
      `chain_head: string`.
- [ ] 3.2 Persist the field on the vessel registry record;
      include it in `/resolve` response shapes.
- [ ] 3.3 Add a `chain_head_updated_at` timestamp on the
      registry row; expose it on `/resolve` so consumers can
      detect a stale head.
- [ ] 3.4 No new shape registration; no resolver-contract field
      changes. The chain_head is metadata on existing vessel
      records.

## §4. Per-vessel chain bootstrap

- [ ] 4.1 In `repos/minibob/src/activity.ts` (the trace-emit path),
      maintain an in-process `currentChainHead` per `vessel_id`.
      On first trace emit, send `prev_chain_hash = "ROOT"`. On
      subsequent emits, send the locally cached head.
- [ ] 4.2 On activity-api 200 response, update the cached head to
      the returned `trace_hash`. The response payload gains a
      `trace_hash: string` field.
- [ ] 4.3 On activity-api 400/409 with `chain_break` or
      `chain_fork`, the vessel reseeds its local head by GET to
      `vessel_chain_heads` (via a new helper resolver shape
      `vesselChainHead`) and retries with corrected
      `prev_chain_hash`. After 3 reseed-retry failures the trace
      emit fails locally and is dropped to a side queue for
      operator inspection.
- [ ] 4.4 Activity-api itself emits traces (self-traces from
      posterior updates per IAL); wire its own chain bootstrap on
      startup.

## §5. Verification utility

- [ ] 5.1 Add `scripts/verify-trace-chain.ts` that takes
      `--vessel-id <id>` and optionally `--from-hash <hash>` and
      walks the chain forward (or backward from a hash) per
      `design.md §E`.
- [ ] 5.2 Add `GET /v2/activities/execution-traces/by-hash/:hash`
      to activity-api returning the row whose `trace_hash`
      matches. 404 on missing.
- [ ] 5.3 Add a `--repair-mode dry-run` flag that emits a tamper
      report for operator review but never mutates the chain.
      Actual repair (operator-curated trace redaction) is out of
      scope per `proposal.md`.

## §6. Cross-integration with signal-confidence-weighting

- [ ] 6.1 The signal-confidence-weighting aggregation rule
      (multiply α/β by `signal_confidence_weight`) gates on
      `trace_hash != null AND chain verified` only when a future
      "robust-Thompson" policy is enabled. Default policy: any
      trace with valid chain link contributes per its weight;
      legacy_unchained rows contribute at weight 1.0 as today.
      Document the composition in `design.md §H`.
- [ ] 6.2 Add a `chain_verified: bool` field to the
      `executionTraceWithSignatures` resolver response so the
      workbench can show chain status per trace.

## §7. Tests

- [ ] 7.1 Unit test: `validateAndExtendChain` accepts a ROOT
      bootstrap, accepts a valid extension, rejects a chain_break,
      rejects a chain_fork via CAS race.
- [ ] 7.2 Unit test: trace body canonical-JSON is byte-identical
      to the shared canonical-json helper output; fixture vectors
      shared with state-space-signature tests.
- [ ] 7.3 Integration test: emit 100 traces from a test vessel;
      walk the chain forward; assert zero tamper.
- [ ] 7.4 Integration test: tamper one trace's `success` field
      post-hoc (direct SurrealDB UPDATE); walk the chain; assert
      the verifier reports tamper at the exact position.
- [ ] 7.5 Integration test: submit two concurrent traces with
      the same `prev_chain_hash`; assert exactly one is admitted
      and the other receives `chain_fork`.
- [ ] 7.6 Integration test: discovery-vessel register with
      `chain_head` set; assert `/resolve` returns it.

## §S. Acceptance gates

- [ ] §S.1 Schema migration applied on canary; no posterior
      drift on Phase 19 harness (MRR, improvise_share, reuse_rate
      within ±2% of prior week).
- [ ] §S.2 Verification script walks the canary trace corpus
      end-to-end for at least one emitting vessel (e.g. minibob)
      and reports zero unintentional breaks.
- [ ] §S.3 Tamper integration test passes deterministically.
- [ ] §S.4 chain_break and chain_fork integration tests pass
      deterministically.
- [ ] §S.5 Discovery chain_head field round-trips through
      register → heartbeat → resolve.
- [ ] §S.6 CLAUDE.md updated under "Execution Trace Model" with
      `prev_chain_hash`, `trace_hash`, and a one-paragraph pointer
      to this spec.
- [ ] §S.7 `signal-confidence-weighting` proposal cross-reference
      remains accurate (no edits to its files; only this spec's
      cross-link is verified to resolve).
