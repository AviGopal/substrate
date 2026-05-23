# Validation Findings — substrate-explicit-vessels

agent: validation
spec: 2026-05-23-substrate-explicit-vessels
date: 2026-05-23
status: open

## Finding 1: Q1 answered — concept-db must be a substrate unit (gap-001)

**Claim in spec**: Q1 in design.md asks "Does concept-db get a place in this
layout?" and leaves it open, noting it "already runs as a vessel" and
llm-resolver-vessel calls it indirectly.

**Observed reality**: The `substrate-live` container (Phase 26 deployment,
15h+ uptime at time of observation) has NO concept-db systemd unit. Running
vessels: activity-api, development-vessel, discovery-vessel, identity-vessel,
minibob, surrealdb, valkey. Concept-db absent.

**Consequence**: The substrate cannot describe the semantic intent of its own
18 registered templates. Template IDs and output_shapes are strings with no
concept-layer interpretation. `propose-spec` — once substrate-authored — will
be able to deduplicate or extend templates only via string-matching, not
semantic comparison. The 24 concepts seeded on 2026-05-17 (Phase 22.S2,
12 vessel-construction-pattern + 12 impulse-activity-pattern) never reached
this substrate.

**Gap type**: missing_concept
**Severity**: substantive
**Gap record**: `validation/gaps/gap-001-no-concept-db-in-local-substrate.md`

**Proposed action**: Resolve Q1 in design.md as "yes — concept-db is a
substrate unit." Add a task to `tasks.md`:
- Add `scripts/substrate/units/concept-db.service` unit
- Point it at the existing concept-db repo image
- Include in `gen-env.sh` and `Dockerfile` substrate-build
- Seed the 24 Phase-22.S2 concepts after identity-seeding
Estimated: 1 unit file + Dockerfile line + env block + seed step.

## Finding 2: Narrator WS observability blocked by identity-vessel 401 (gap-002)

**Claim in spec**: Not directly addressed in this spec; this is an
operator-observability concern rather than a vessel-layout concern.

**Observed reality**: External narrator scripts (running from host, connecting
to ws://localhost:18080/ws) fail auth with "Identity vessel returned 401"
when using METABOB_API_KEY from `/etc/substrate/env`. Identity-vessel at
port 8101 returns 401 for this key. HTTP REST auth succeeds (templates
endpoint returns 200). Narrator running in snapshot-only mode (no live events).

**Gap type**: irreducibly_operator (operator access issue, not substrate
self-knowledge gap)
**Severity**: minor — substrate functions correctly; only external observability
degraded. Snapshot mode is sufficient for gap narration.

**Proposed action**: No spec change required. Workaround: the substrate-public-feed
spec (or operator-and-public-contracts) should handle this as the long-term
operator observation channel. Short-term: consider issuing a dedicated
observer-tier key via `docker exec substrate-live bun /vessels/issue-key.ts`
with read-only scope. Not blocking on any current tasks.
