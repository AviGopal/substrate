# Dev Findings — impulse-activity-loop (IAL)

agent: dev
spec: 2026-04-26-impulse-activity-loop
date: 2026-05-24
status: open

## Finding D-IAL-001: S.4a gate requires action on two blockers before time-gate starts

**Claim in spec**: S.4a — at least one `coverageReport` impulse has
`coverage_progress=true` from natural substrate activity.

**Observed reality** (2026-05-24T16:49Z): coverage_progress=false. RL=2 flat across
all 4 1h windows (coverageReport + substrateHealthReport both visible, nothing else).

**Root causes identified and fixed**:

1. **Redis cache threshold** (activity-api commit 93cd621): The template list silently
   dropped coverage-tick when its individual Redis cache expired (3600s TTL) while the
   SET key persisted indefinitely. The 80% fallback threshold let 17/18 pass without DB
   reload. Changed to 100% — any missing entry triggers full SurrealDB fallback.

2. **Boredom task format** (boredom queue updated): All 5 topology boredom tasks
   used `goal:` field → goal-processing pipeline → stagnation detector dropped
   coverage-tick after 3 repeats → improviser ran → ribosome created timestamp
   variants → registry thrashed. Fixed: all tasks now use `templateId:` field,
   bypassing goal-processing and stagnation entirely. Tasks re-queued at scores 1-5.

**Two additional fixes still pending** before S.4a can accumulate:

3. **Activity-api restart needed**: The 93cd621 code change is in `repos/metabob-activity-api`
   (pushed to origin/dev) but the container is running old source. Restart required:
   `docker exec substrate-live systemctl restart activity-api`

4. **Embedding fix needed**: EMBEDDING_MODEL_DIR missing from /etc/substrate/env.
   With embedding disabled, template recommendations rely only on BM25 FTS. For S.4a
   purposes this is not a direct blocker (templateId tasks bypass recommendation),
   but general boredom quality degrades without dense search.
   Fix: `docker exec substrate-live bash -c 'echo EMBEDDING_MODEL_DIR=/vessels/activity-api/src/assets/models >> /etc/substrate/env && systemctl restart activity-api'`

**Gap type**: claim_incorrect — two infrastructure bugs were silently blocking the
topology chain from ever running.

**Severity**: was blocking; now unblocked pending container restart.

**Proposed action**: No spec changes needed. Mark S.4a as "unblocked pending restart"
and update monitoring to check template list stability after restart.

---

## Finding D-IAL-002: S.4a time-gate: RL diversification strategy

**Context**: With fixes applied, RL will stay at 2 (coverageReport + substrateHealthReport)
unless OTHER templates run in different 1h windows. The 4-cell table needs new shapes
to appear in successive windows for RL to increase.

**Mechanism**: The 5 topology boredom tasks include:
- `development-vessel:coverage-tick` → produces coverageReport
- `development-vessel:substrate-health-tick` → produces substrateHealthReport
- `development-vessel:probe-reachable-unlearned` → runs recommend, produces
  recommendation shape (new RL contribution)
- `development-vessel:learned-topology-snapshot` → produces learnedTopologySnapshot
- `development-vessel:harness-run-matrix` → produces failureModeReport (new RL)

**Prediction**: After the 5 tasks run (each once from the critical queue at scores
1-5), if harness-run-matrix and probe-reachable-unlearned succeed:
- Window containing these executions: RL = 4+ (coverageReport + substrateHealthReport
  + failureModeReport + learnedTopologySnapshot + recommendation)
- Next window: depends on what re-enqueues

The boredom tasks are ONE-SHOT from the critical queue (tasks are removed on fetch per
`fetchTask()` in boredom.ts). After the 5 tasks consume, the queue returns to whatever
high-score debug tasks remain. For sustained RL growth across 4 windows, either:
(a) topology tasks need periodic re-enqueueing, OR
(b) the observer chain (development-vessel registry-change-observer) re-drives the
    topology loop naturally after coverage-tick runs

Option (b) is the designed path: coverage-tick completion → observer → new
topology-snapshot → new probes → more coverage-tick. The observer should self-sustain
once the first coverage-tick lands.

**Proposed action**: Monitor whether observer self-sustains after first coverage-tick
run. If not (observer doesn't re-trigger), add a periodic re-enqueue cron or a
boredom-refill task.
