---
gap_id: gap-001
category: missing_concept
severity: substantive
observed_first: 2026-05-23T23:30Z
last_observed: 2026-05-23T23:31Z
recurring_count: 1
bridge_path: extract-concepts (blocked — concept-db vessel not running in this substrate)
---

# Gap 001 — Substrate has no concept layer for semantic self-description

## Observation

The local single-container substrate (`substrate-live`, Phase 26 deployment, 15h uptime) runs:
- activity-api (1.20.9, healthy)
- discovery-vessel (1 vessel registered)
- identity-vessel
- minibob (autonomous daemon)
- development-vessel
- surrealdb

**concept-db is NOT among the running systemd units.** `docker exec substrate-live systemctl list-units --type=service` confirms.

The activity-api currently advertises **18 templates**, all from the `development-vessel` namespace. Examples observed in snapshot `2026-05-23T23-31-20-775Z`:
- `activity:⟨development-vessel:add-resolver-to-vessel⟩` → patch
- `activity:⟨development-vessel:harness-run-matrix⟩` → failureModeReport
- `activity:⟨development-vessel:ship-change⟩` → unknown_output
- `activity:⟨development-vessel:release-change⟩` → analysis, patch
- `activity:⟨development-vessel:scaffold-new-vessel⟩` → unknown_output

## Attempted description (using only substrate-side knowledge at t-0)

The substrate has 18 templates registered. To describe what each template does, the substrate's own activities would need to reason about template semantics — what "add-resolver-to-vessel" means, what "scaffold-new-vessel" is for, how "release-change" relates to "ship-change."

**Without concept-db running**, the substrate has no concept layer. Template ids and names are strings; output_shapes are strings. There is no substrate-queryable mapping from these strings to substrate-evaluable concepts ("resolver is a thing that handles impulse shape resolution," "vessel is a substrate-resident unit advertising shapes," "release vs ship are different deployment phases").

The 24 concepts seeded in concept-db on 2026-05-17 (Phase 22.S2: 12 vessel-construction-pattern + 12 impulse-activity-pattern) are NOT in this substrate. Concept-db never ran here.

## Knowledge used

### Substrate-side:
- `template_count: 18` from snapshot
- Template ids + names + output_shapes from `/v2/activities/templates`
- systemd unit list from `docker exec`

### Operator-side gaps:
- **`missing_concept` (substantive)**: no concept-db means no semantic layer
  - source: my reading of CLAUDE.md "concept-db" entry, foundation doc §285+ on Vessel Discovery
  - bridge_path: deploy concept-db as a substrate vessel in this container (substrate-side implementation work), then run extract-concepts-from-docs

- **`missing_pattern` (substantive)**: the substrate has 18 templates but no record of WHY each was created or WHAT pattern it embodies
  - source: would need to read template task graphs from filesystem (substrate has fs_read but hasn't extracted) OR query traces of past executions (zero traces present)
  - bridge_path: ribosome extraction from successful executions (blocked — no executions yet); concept-extraction from template task graphs (blocked — concept-db not running)

## Verdict

`description_completed_within_substrate_knowledge: false`
`gap_severity: substantive`

The substrate cannot, today, describe what its 18 registered templates are semantically. It can list them (substrate-side observable) but cannot reason about them (no concept layer).

## Implications

This is a STRUCTURAL gap in the local substrate's self-development capacity. Per the audit pass and §27.S.5 framing:

- The substrate is supposed to author its own specs via propose-spec
- propose-spec needs to reason about existing templates to avoid duplication or to extend correctly
- Without concept-db, propose-spec has only string-matching against template names — not semantic comparison

Bridge: include concept-db in the substrate-explicit-vessels seed unit list (closure-replacement-suite §27.3.g enumerates 6 substrate-hosted vessels but doesn't include concept-db; this should be flagged to the main development operator).

## Coordination

- **Main development operator**: aware that concept-db is missing from local substrate? Should it be a Phase 26 systemd unit?
- **Auditor**: confirms via runtime that concept-db is not running and template-level reasoning has no concept-layer fallback?
- **My role**: continue observing; if templates get added without concept-db deployment, this gap recurs.
