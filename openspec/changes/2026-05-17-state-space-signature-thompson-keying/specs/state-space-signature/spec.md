# state-space-signature Specification

## Purpose

Thompson posteriors are today keyed at two levels: the marginal `(template_id, variant_id)` row in `variant_performance_metrics`, and a coarse 8-hex `context_bucket` in `context_thompson_scores` that is written but never read by the recommend path (`repos/metabob-activity-api/src/utils/session-context.ts:115-129`, `repos/metabob-activity-api/src/routes/execution-traces.ts:2403-2533`). This capability defines a versioned, deterministic **state-space signature** that becomes the load-bearing key for conditional Thompson reads and writes: the recommend handler looks up posteriors by the *current* signature, and the trace-write path emits α/β increments to the row keyed on the signature *at binding time*.

A signature is a property of the **binding context**, not of the execution. Two executions of the same template that share `(shape_multiset, provenance_tuples, missing_shape_set, signature_version)` MUST produce the same signature; two executions that differ on any of these components SHOULD produce different signatures (the SHA-256-truncated-to-64-bit hash collision rate is acceptable below the ~10⁵-distinct-signatures-per-template scale).

## Requirements

### Requirement: Signature is deterministic and versioned

A `state_space_signature` SHALL be the lowercase-hex prefix (16 chars = 64 bits) of `sha256(canonical-encoding(input))`, where `canonical-encoding` is defined by the following algorithm and `input` includes `signature_version` as its first token. Two implementations (minibob and activity-api) MUST produce byte-identical signatures for byte-identical inputs.

**Canonical encoding (v1):**

```
encode_v1(shapes, provenance, missing) =
  "1" || "|"
  || sort(shapes).join(",")
  || "|"
  || sort(provenance.map((shape, by) => shape + ":" + (by ?? ""))).join(",")
  || "|"
  || sort(missing).join(",")
```

- `shapes` is a multiset (duplicates preserved); `sort` is lexicographic on the raw element string, case-sensitive.
- `provenance` is an array of `{ shape, producedBy? }`; the per-element encoding is `${shape}:${producedBy ?? ""}` so absence is a stable marker.
- `missing` is a set (deduplicated); sort lexicographic.
- Joins are with literal comma. Field separator is literal pipe.

#### Scenario: Same input produces identical signatures across vessels

- **WHEN** minibob computes the signature for `shapes=["jwt_claims","file"], provenance=[{shape:"jwt_claims", producedBy:"identity-vessel"}], missing=["concept"]`
- **AND** activity-api computes the signature for the same input
- **THEN** both implementations return the same 16-character hex string
- **AND** the test suite in `repos/metabob-activity-api/test/state-space-signature.test.ts` and `repos/minibob/test/state-space-signature.test.ts` share the same fixture vectors and both pass

#### Scenario: Multiset order independence

- **WHEN** the signature is computed for `shapes=["a","b","a"]` and then for `shapes=["b","a","a"]`
- **THEN** the two signatures are byte-identical
- **AND** for `shapes=["a","b"]` (no duplicate) the signature differs from `["a","a","b"]`

#### Scenario: Version isolation

- **WHEN** the signature is computed for the same `(shapes, provenance, missing)` triple at version 1 and at a hypothetical version 2
- **THEN** the two signatures differ (different first hashed token)
- **AND** read paths filter on `signature_version` and never conflate the two encodings

### Requirement: Signature is computed at binding time, not execution time

The signature SHALL be captured at the moment of slot-binding — specifically, when `lifecycle:task:preBinding` fires in minibob (`repos/minibob/src/activity.ts`, the emit site that constructs `presentShapesPre` / `missingShapesPre`). The signature is then carried on the execution trace as `body.metadata.state_space_signature` and is **not** recomputed at trace-write time on the server unless the trace metadata lacks it (legacy path).

#### Scenario: Binding-time capture matches trace metadata

- **WHEN** minibob fires `lifecycle:task:preBinding` for a task
- **THEN** the resulting trace POST body contains `metadata.state_space_signature` equal to `computeStateSpaceSignature(presentShapesPre, provenanceAtBinding, missingShapesPre)`
- **AND** the `signature_version` field is also present and is `1`

#### Scenario: Server-side derivation is the safety net, not the primary

- **WHEN** a trace POST arrives without `metadata.state_space_signature` but with `body.input_impulse_shapes` populated
- **THEN** the server derives the v1 signature from the input shapes + any available `body.metadata.provenance`
- **AND** the conditional write proceeds with the derived signature
- **AND** a `debug`-level log records the derivation (not `warn`; this is a documented degraded path during the v0→v1 transition)

#### Scenario: No signature, no conditional write

- **WHEN** a trace POST arrives with neither `metadata.state_space_signature` nor `body.input_impulse_shapes`
- **THEN** no row in `context_thompson_scores` is created or updated
- **AND** the template-level write to `variant_performance_metrics` proceeds as today
- **AND** no warning is emitted (this is the explicit backward-compat path)

### Requirement: Composition-chain signatures are per-ancestor, not per-leaf

When `propagateCreditAlongChain` (`repos/metabob-activity-api/src/lib/posterior-update.ts:303-371`) writes α/β increments to each ancestor in the composition chain, the conditional write for each ancestor SHALL use **that ancestor's** state-space signature, not the leaf execution's. The ancestor's signature is captured at the moment the ancestor's own `lifecycle:task:preBinding` fired and is carried on the leaf trace as `body.metadata.ancestor_signatures: Record<execution_id, { signature, signature_version }>`.

#### Scenario: Each ancestor uses its own signature

- **WHEN** a 3-deep chain `A → B → C → D(leaf)` completes successfully
- **AND** the leaf trace carries `ancestor_signatures: { C: sigC, B: sigB, A: sigA }`
- **THEN** `writeAncestorDelta` writes `α += γ^1` to the conditional row keyed on `(C.template_id, sigC)`, `α += γ^2` to `(B.template_id, sigB)`, and `α += γ^3` to `(A.template_id, sigA)`
- **AND** no ancestor's α/β is written to a row keyed on the leaf's signature

#### Scenario: Missing ancestor signature falls back to template-level

- **WHEN** the leaf trace has `composition_chain` set but `ancestor_signatures` is empty or missing entries for some ancestors
- **THEN** ancestors without a signature receive only the `variant_performance_metrics` write (no conditional write)
- **AND** ancestors with a signature receive both
- **AND** a `debug` log records the partial coverage

### Requirement: Signatures are stable across pod restarts and minor version changes

The signature algorithm SHALL be a pure function of its inputs and the `signature_version` constant. It SHALL NOT depend on hostname, pod name, wall clock, environment variables, or any other ambient state. A minor version bump of activity-api or minibob that does not change `signature_version` MUST produce identical signatures for identical inputs.

#### Scenario: Recomputing an old signature reproduces it

- **WHEN** a trace stored 30 days ago is replayed through `computeStateSpaceSignature` with the original inputs at version 1
- **THEN** the result matches the value stored in that trace's `metadata.state_space_signature`

### Requirement: Backward compatibility with v0 context_bucket

The legacy `computeContextBucket(taskDesc, impulseShapes, orgId)` function (`repos/metabob-activity-api/src/utils/session-context.ts:115-129`) SHALL continue to compute the legacy 8-hex bucket for one release cycle after this capability ships. New code SHALL NOT call it; existing call sites (notably `repos/metabob-activity-api/src/routes/activities.ts:4399`) SHALL switch to `computeStateSpaceSignature`. Rows written with `signature_version = 0` SHALL never be read by the new conditional read path — they age out via the daily collapse job.

#### Scenario: v0 rows do not poison v1 reads

- **WHEN** the recommend handler looks up a conditional posterior at signature `S` with `signature_version = 1`
- **AND** the only matching row in `context_thompson_scores` has `signature_version = 0`
- **THEN** no conditional row is returned
- **AND** the read falls through to the template-level `variant_performance_metrics` row
- **AND** the v0 row is unaffected

### Requirement: Signature length and collision resistance

The signature SHALL be exactly 16 lowercase hex characters (64 bits). At the design cap of 200 distinct signatures per template × 3 000 templates = 6×10⁵ total distinct signatures, the expected collision probability is below 2⁻³⁵. Implementations SHALL NOT truncate further or zero-pad; the encoding is fixed.

#### Scenario: Signature format is validated at write time

- **WHEN** a trace POST arrives with `metadata.state_space_signature` set to something other than `/^[0-9a-f]{16}$/`
- **THEN** the conditional write is skipped
- **AND** a `warn`-level log records the malformed signature
- **AND** the template-level write proceeds (the malformed signature is not an error for the trace itself)
