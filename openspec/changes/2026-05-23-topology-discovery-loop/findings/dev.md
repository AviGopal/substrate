# Dev Findings — topology-discovery-loop

agent: dev
spec: 2026-05-23-topology-discovery-loop
date: 2026-05-24
status: open

## Finding D-001: Redis cache threshold caused coverage-tick to be invisible

**Claim in spec**: Coverage-tick runs as part of the topology-discovery loop driven
by boredom tasks and the lifecycle observer.

**Observed reality**: activity-api's `GET /v2/activities/templates` returned 17/18
templates — coverage-tick was silently dropped. The `activity:templates:list` Redis
SET key has no TTL and persists indefinitely, but individual template cache keys have
a 3600s TTL. When coverage-tick's individual key expired, the list handler found
17/18 entries (94% fill rate), which cleared the old 80% fallback threshold, so
the handler returned 17 templates without querying SurrealDB. The coverage-tick
resolver's `output_shapes: ["coverageReport"]` was therefore invisible to the
recommendation engine.

**Gap type**: claim_incorrect — spec assumed template list was reliable; it was not.

**Severity**: blocking (coverage-tick never recommended; RL stayed at 2 not advancing)

**Fix shipped**: activity-api commit 93cd621 — changed threshold from 80% to 100%
(any missing individual cache entry triggers full DB fallback). Template list now
reliably returns all 18 templates including coverage-tick.

**Proposed action**: None needed in spec; fix is in activity-api source. Container
needs restart to pick up the change.

---

## Finding D-002: Boredom tasks used goal: format — stagnation detector blocked topology templates

**Claim in spec**: Boredom tasks drive the topology-discovery chain including
coverage-tick and substrate-health-tick.

**Observed reality**: All 5 topology boredom tasks used `goal:` field (e.g.
`goal: "run the topology discovery chain: call coverage-tick, substrate-health-tick..."`).
This routed through the goal-processing pipeline:
1. Thompson Sampling recommended coverage-tick
2. After 3 consecutive recommendations, the stagnation detector dropped coverage-tick
   from the candidate pool
3. Improviser ran instead of coverage-tick
4. Ribosome-extract created timestamp-variant IDs
5. development-vessel restart re-seeded the original templates → thrashing

The boredom tasks with `goal:` format NEVER successfully dispatched coverage-tick
after the first few attempts. The validation agent correctly observed ×12 recurring
gap-003 (goal failures without progress) and ×3 gap-005 (template churn).

**Gap type**: claim_incorrect — the spec's §0.3 prerequisites assumed boredom tasks
would successfully run coverage-tick, but the goal-processing path blocked this.

**Severity**: blocking (same as D-001 — topology chain structurally not running)

**Fix shipped**: All 5 topology boredom tasks converted from `goal:` to `templateId:`
format (e.g. `templateId: "development-vessel:coverage-tick"`). The `templateId` path
in `minibob/src/boredom.ts:executeTask` loads the template by ID directly via
`loadActivityTemplateById`, bypassing goal-processing, Thompson sampling, and the
stagnation detector entirely. Tasks re-queued at critical queue scores 1-5 (before
any higher-score debug tasks).

**Proposed action**: If the topology observer chain ever fails to deliver templates
to the boredom queue, add a monitoring check that verifies boredom queue has ≥1
templateId task for topology in the critical queue. This is an operational concern,
not a spec change.

---

## Finding D-003: gap-003 (failure_mode absent on goal_resolve) — architecture explanation

**Claim in spec**: (implicit from validators-and-failure-modes) failure_mode should
be populated on every activity failure.

**Observed reality**: `_goal_resolve` meta-activity returns `status: failure` with
`failure_mode: null`. Validation agent observed this ×12 and filed it as a potential
Phase 5 cutover gap.

**Explanation**: `_goal_resolve` is a meta-layer wrapper, not a standard activity.
Its `status: failure` means "the goal was attempted but the external success condition
(coverage advance) was not met" — not "the activity execution failed." The child
`goal-processing-activity-driven` correctly returns `status: success` because it
successfully ran the goal-processing chain. The `failure_mode` taxonomy
(`verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`)
applies to activity-level failures; goal-level outcomes are a different construct.

This is NOT a Phase 5 regression. The validators-and-failure-modes acceptance gate
applies to activities executed by the resolver dispatch chain; goal_resolve is above
that layer.

**What will change**: With the D-002 fix (templateId boredom tasks), topology chain
activities no longer go through goal_resolve at all. The frequency of goal_resolve
failures from the topology queue will drop to zero once the templateId tasks consume
the queue positions.

**Gap type**: missing_idiom — spec doesn't document the goal_resolve ↔ activity
failure distinction.

**Severity**: minor (not a regression; no fix needed in activity-api)

**Proposed action**: Add a note to validators-and-failure-modes spec clarifying that
goal_resolve is explicitly excluded from the failure_mode population requirement.
This is documentation cleanup, not a code change.

---

## Finding D-004: gap-004 (embedding disabled) — gen-env.sh missing EMBEDDING_MODEL_DIR

**Claim in spec** (single-container-substrate): activity-api should run with dense
search enabled (F-V58 fix from Phase 18.5).

**Observed reality**: `embedding.status: disabled` in /health. Audit F-014 confirmed
EMBEDDING_MODEL_DIR env var is absent from /etc/substrate/env. The ONNX model file
IS present at `/vessels/activity-api/src/assets/models/all-MiniLM-L6-v2/`.

**Root cause**: `scripts/substrate/gen-env.sh` does not set `EMBEDDING_MODEL_DIR`.
The F-V58 fix added this variable to the Dockerfile's runtime stage ENV for the
canary image, but the local substrate uses a generated env file, not the Dockerfile
ENV. The two paths diverged.

**Fix procedure** (immediate):
```bash
docker exec substrate-live bash -c \
  'echo EMBEDDING_MODEL_DIR=/vessels/activity-api/src/assets/models \
   >> /etc/substrate/env && systemctl restart activity-api'
```

**Fix procedure** (durable): Add `EMBEDDING_MODEL_DIR=/vessels/activity-api/src/assets/models`
to the env file generation in `scripts/substrate/gen-env.sh` or the container
entrypoint's env setup block.

**Gap type**: claim_incorrect — gen-env.sh omits the env var that F-V58 requires.

**Severity**: substantive (dense search disabled reduces recommendation quality;
literal template name queries fall through to BM25 FTS which may not match template
IDs well)

**Proposed action**: Update single-container-substrate tasks.md to add a task for
durable gen-env.sh fix. See §1.3.1 where the env file template lists required vars —
EMBEDDING_MODEL_DIR should be added there.

---

## Current S.4a status (2026-05-24T16:49Z)

After D-001 + D-002 fixes:
- RL = 2 in all 4 windows (coverageReport + substrateHealthReport both visible)
- coverage_progress = false (RL is flat, not strictly increasing)
- 5 templateId boredom tasks at front of critical queue (scores 1-5)
- activity-api restart needed to activate cache fix (93cd621)
- embedding fix needed separately (gen-env.sh missing EMBEDDING_MODEL_DIR)

S.4a requires RL strictly increasing across 4 consecutive 1h windows. This is
fundamentally time-gated: with RL=2 in all 4 windows, coverage_progress stays false
until different templates run in subsequent windows (adding failureModeReport,
recommendation, etc. to the learned shape set across successive hours).

Estimated time to S.4a: 4+ hours of topology chain running stably after the cache
and embedding fixes are applied.
