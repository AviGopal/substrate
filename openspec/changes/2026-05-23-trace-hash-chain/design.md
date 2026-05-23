# Design — Trace Hash Chain

## §A. Hash chain construction

A trace's chain link is two fields on the AET row:

- `prev_chain_hash: string` — the `trace_hash` of the most recent
  trace previously emitted by the same vessel, OR the literal
  string `"ROOT"` if this is the vessel's first trace.
- `trace_hash: string` — `lowercase_hex(SHA-256(canonical_json(body)))`,
  where `body` is the canonical encoding of the trace row including
  the `prev_chain_hash` field. Output is the full 64-character SHA-256
  digest; no truncation.

**Canonical JSON.** Identical to
`2026-05-17-state-space-signature-thompson-keying`: RFC 8785 (JCS) —
keys sorted lexicographically, no insignificant whitespace, numbers
in shortest-roundtrip form, UTF-8 encoding. Implementations share a
single `canonicalJson()` helper from `repos/metabob-activity-api/src/
lib/canonical-json.ts`.

**Body included in the hash.** The hash covers every field on the
AET row that is observable to a downstream consumer:

```
{
  execution_id, activity_template_id, variant_id, emitting_vessel_id,
  org_id, project_id, parent_execution_id, composition_chain,
  tasks, impulse_resolutions, success, duration_ms, cost_usd,
  failure_mode, signal_confidence_weight, prev_chain_hash,
  state_space_signature, signature_version, timestamp_unix_ms
}
```

The `trace_hash` field itself is NOT included in its own input
(self-reference would be ill-defined). Computed-derived fields
populated by the server post-ingest (e.g. denormalised
`composition_chain` walked at read time when stored is empty) are
not part of the hashed body; the stored row holds the post-ingest
view, but `trace_hash` is fixed at write time.

## §B. Per-vessel chain ownership

The chain is keyed by `emitting_vessel_id` — the vessel that
produced the trace, not the vessel that resolved its impulses or
appeared in `composition_chain`. The activity-api tracks per-vessel
chain heads in a new table `vessel_chain_heads`:

```sql
DEFINE TABLE vessel_chain_heads SCHEMAFULL;
DEFINE FIELD vessel_id ON vessel_chain_heads TYPE string;
DEFINE FIELD chain_head ON vessel_chain_heads TYPE string;
DEFINE FIELD updated_at ON vessel_chain_heads TYPE datetime;
DEFINE FIELD trace_count ON vessel_chain_heads TYPE int;
DEFINE INDEX vessel_chain_heads_pk ON vessel_chain_heads
  FIELDS vessel_id UNIQUE;
```

A vessel's first trace under this capability:
1. Submits `prev_chain_hash = "ROOT"`.
2. activity-api looks up `vessel_chain_heads[vessel_id]`, finds no
   row, admits the trace, computes its `trace_hash`, and creates the
   `vessel_chain_heads` row with `chain_head = trace_hash`,
   `trace_count = 1`.

Every subsequent trace:
1. activity-api reads the stored `chain_head` for the vessel.
2. Verifies `submitted.prev_chain_hash == stored.chain_head`.
3. On match, computes `trace_hash`, atomically updates
   `vessel_chain_heads` (CAS on `chain_head` to detect concurrent
   forks), persists the AET row.

The CAS on `vessel_chain_heads` is the chain-fork defense: two
concurrent writes both reading the same `chain_head` and trying
to extend it both submit the same `prev_chain_hash`; the loser of
the CAS race is rejected with `chain_fork`.

## §C. Discovery integration

`RegisterRequest` in `repos/discovery-vessel/src/types.ts` gains
one optional field:

```typescript
chain_head?: string  // current trace_hash for this vessel
```

`HeartbeatRequest` gains the same field. The registry stores it on
the vessel record. Vessels that do not emit traces (read-only
resolvers like discovery-vessel itself) MAY omit the field.

`/resolve` responses include `chain_head` in the vessel record when
present. Peers querying for a vessel receive the head and can fetch
the matching trace from activity-api (or, post-federation, from a
peer activity-api) to begin a verification walk.

No new shape is introduced. The chain_head is metadata on existing
vessel records, alongside `pubkey_hash` (reserved for H2),
`resolve_endpoint`, etc.

**Liveness of the chain head.** Heartbeats refresh the chain head
at the same cadence as the vessel's heartbeat interval (60–120s
default). A stale `chain_head` indicates either a vessel that has
stopped emitting traces (benign) or a vessel that is silently
emitting traces without updating discovery (suspicious; flagged
for operator audit but not auto-rejected — the ingest-time check
on activity-api is the authoritative gate).

## §D. Ingestion validation

`POST /v2/activities/execution-traces` in
`repos/metabob-activity-api/src/routes/execution-traces.ts` adds a
pre-write step:

```
1. Validate the payload has prev_chain_hash and emitting_vessel_id.
   Missing → 400, failure_mode = verifier_negative, sub_type =
   chain_missing_fields.

2. SELECT chain_head FROM vessel_chain_heads WHERE
   vessel_id = $emitting_vessel_id.

3. If row missing:
     - Require prev_chain_hash == "ROOT".
     - On mismatch → 400, failure_mode = verifier_negative,
       sub_type = chain_break (claimed extension of an unknown chain).
4. If row present:
     - Require prev_chain_hash == row.chain_head.
     - On mismatch → 400, failure_mode = verifier_negative,
       sub_type = chain_break.

5. Compute trace_hash = sha256_hex(canonical_json(body)).

6. CAS:
     UPDATE vessel_chain_heads SET chain_head = $new, trace_count += 1,
     updated_at = time::now() WHERE vessel_id = $vessel_id
     AND chain_head = $expected_prev.
     (Or INSERT if row absent and prev_chain_hash == "ROOT".)

7. On CAS failure → 409, failure_mode = verifier_negative,
   sub_type = chain_fork. The original write is unaffected; the
   loser is rejected.

8. On CAS success → INSERT the AET row with computed trace_hash.
```

The CAS and INSERT are not in a single SurrealDB transaction
(SurrealDB's transactional surface is limited). The CAS-then-INSERT
order is deliberate: a chain head that has advanced without a
matching trace row is detectable on the next verification walk as
"chain head points at a missing trace" and is itself a tamper
flag. The window between CAS and INSERT is microseconds in the
hot path.

## §E. Cross-vessel verification

Any consumer (workbench, peer substrate, operator audit script)
can verify any vessel's chain end-to-end:

```
walkChain(vessel_id):
  head = discovery.resolve(vessel_id).chain_head
  trace = activity_api.getTraceByHash(head)
  while trace.prev_chain_hash != "ROOT":
    expected = canonical_json(trace_body_excluding_hash)
    if sha256_hex(expected) != trace.trace_hash:
      report tamper at trace.execution_id
      return
    prior = activity_api.getTraceByHash(trace.prev_chain_hash)
    if prior is null:
      report missing prior at trace.execution_id
      return
    trace = prior
  return ok
```

The walk is O(N) in chain length. For canary traffic this is
tractable as a periodic audit job; it is NOT on the hot path of
posterior reads. Activity-api exposes a new helper endpoint
`GET /v2/activities/execution-traces/by-hash/:trace_hash` returning
the AET row whose `trace_hash` matches. Indexed via
`DEFINE INDEX aet_trace_hash ON activity_execution_traces
FIELDS trace_hash UNIQUE`.

## §F. Performance considerations

SHA-256 on a typical trace body (≈4 KB canonical JSON) is ≈10 µs
on commodity hardware. The CAS on `vessel_chain_heads` is one
SurrealDB query per trace write. Hot path overhead: roughly one
extra round-trip plus a hash invocation, well within the existing
trace-write budget (currently dominated by the multi-row Thompson
posterior update).

Verification is off-line. A 10⁴-trace canary chain walks in seconds
on a single core. Chain checkpointing (signing the chain head every
N traces or every M minutes and allowing audit-time walks to start
from the most recent checkpoint) is deferred until trace volume
makes the full walk impractical.

## §G. Failure modes

All chain failures map into the existing `FailureMode` taxonomy
(migration 091 in activity-api) under `type =
"verifier_negative"`. Three new `sub_type` discriminators are
added to the `context.sub_type` field on `verifier_negative`:

- `chain_missing_fields` — trace POST omitted `prev_chain_hash`
  or `emitting_vessel_id`. Indicates a vessel running pre-this-
  capability code; observable from the trace ingest log.
- `chain_break` — `prev_chain_hash` did not match the stored
  vessel chain head. Indicates either an out-of-order submission,
  a lost trace, or tamper. Context includes
  `{vessel_id, expected_prev: stored_head, submitted_prev}`.
- `chain_fork` — CAS lost; another writer extended the same head
  first. Indicates a race within the same vessel (likely a buggy
  vessel emitting two traces with the same `prev_chain_hash`) or
  a concurrent compromise attempt. Context includes
  `{vessel_id, contested_prev, winning_trace_hash}`.

Rejection is at write time. The rejected trace is NOT stored in
the AET table (storing it would itself constitute extending the
chain). It IS logged to a separate `chain_rejection_log` table
for forensic replay.

## §H. Relationship to H1 two-sided traces

H1 introduces Ed25519 signatures from both the invoker and each
invoked vessel on the per-call digest within a trace
(`security-hardening-findings/design.md §H1`). The hash chain is
*not* a signature primitive. It guarantees that a stored trace
cannot be retroactively modified without the modification being
detectable; it does not guarantee that the trace as written was
agreed to by all parties to the calls it describes.

Composition:

- **Without the chain, with H1**: cross-vessel calls are
  corroborated by signature, but a compromised activity-api could
  still rewrite a past trace's signature fields (since the
  signatures are stored on the trace row).
- **With the chain, without H1**: past traces cannot be rewritten,
  but a single compromised vessel can still lie about its own
  cross-vessel calls in a freshly written (legitimately chained)
  trace.
- **With both**: a freshly written trace must be corroborated by
  both ends (H1) and is committed into an append-only chain (this
  change). Modifying any past row breaks the chain at that point.
  The aggregation layer's `signal_confidence_weight` (signal-
  confidence-weighting) caps the influence of unverified or
  partially-verified writes.

The three layers compose multiplicatively. None subsumes the
others.

**Forward integration with H1.** When H1 lands, the per-call
signatures cover (canonical_json(per_call_record) ||
trace.prev_chain_hash). This binds the signature to the chain
position: a replay of the same signed call into a different chain
position fails verification.
