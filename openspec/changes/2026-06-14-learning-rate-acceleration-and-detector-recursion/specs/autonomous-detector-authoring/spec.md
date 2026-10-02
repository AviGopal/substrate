# Autonomous detector authoring

## ADDED Requirements

### Requirement: Detector-coverage audit detects uncovered problem classes

The substrate SHALL run a deterministic `detector-coverage-audit` that clusters observed `failure_mode`/anomaly signatures, diffs them against the class-set existing detectors emit, and emits a `detector-gap` scenario for any cluster covered by no existing detector. The audit MUST use deterministic resolvers only (no LLM, no posterior capacity consumed).

#### Scenario: Novel failure cluster with no covering detector

- **WHEN** a cluster of `failure_mode` impulses shares a signature `(type, output_shapes_intersection, resolver_tier)` that maps to no `substrateGap.class` emitted by any existing detector
- **THEN** `detector-coverage-audit` emits a `detector-gap` scenario containing the cluster signature, exemplar trace ids, and a proposed detector class

#### Scenario: Cluster already covered

- **WHEN** an observed cluster's signature maps to a class an existing detector already emits
- **THEN** no `detector-gap` scenario is emitted for that cluster

### Requirement: The substrate authors new detector activities from detector gaps

The substrate SHALL author a new deterministic-scan detector activity from each `detector-gap` via a `draft-detector-activity` archetype, route it through the existing convergent-validity gate and auto-promote loop, and place it in `applicable(s)`. The operator MUST NOT author detector instances after bootstrap.

#### Scenario: Autonomous detector authoring end-to-end

- **WHEN** a `detector-gap` scenario is drained
- **THEN** `draft-detector-activity` authors a detector activity (drafter provenance, not an operator commit) whose tasks deterministically scan a store slice, filter by the cluster signature, and emit the new `substrateGap` class
- **AND** after the auto-promote threshold the detector enters `applicable(s)` and fires on a later occurrence, emitting its declared class with non-stub substance

#### Scenario: Gaming guard

- **WHEN** a drafted detector would emit a trivially-satisfiable gap class
- **THEN** the convergent-validity gate blocks its auto-promotion (same gate the template-drafting path uses)
