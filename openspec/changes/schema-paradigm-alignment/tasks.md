# Schema Paradigm Alignment Tasks

## Overview

Refactor the activity system database schema from 20+ tables to 4 core tables + views that strictly align with the impulse/activity/vessel paradigm.

**Estimated Duration:** 8 weeks (with buffer for risk mitigation)

---

## Phase 0: Foundation (Week 1)

**Goal:** Establish baseline metrics and fill specification gaps before schema changes

### Tasks

- [x] **P0.1: Establish performance baseline**
  - Measure current Thompson Sampling query latency
  - Measure impulse resolution latency
  - Document current table sizes and query patterns
  - Target: < 50ms for recommendations, < 100ms for resolution
  - See: `specs/baseline-metrics.md`

- [x] **P0.2: Add impulse resolution protocol spec**
  - Document multi-vessel routing rules
  - Define fallback chains for resolver failures
  - Specify vessel capability matching algorithm
  - See: `specs/resolution-protocol.md`

- [x] **P0.3: Add shape matching algorithm spec**
  - Define exact algorithm for `input_shapes ⊆ available_shapes`
  - Specify backward compatibility for activities without shapes
  - Document shape inheritance rules (if any)
  - See: `specs/shape-matching.md`

- [x] **P0.4: Add composition execution semantics spec**
  - Define sequential vs parallel execution
  - Specify error handling (fail-fast vs continue)
  - Clarify impulse passing between child activities
  - See: `specs/composition-semantics.md`

- [x] **P0.5: Document SurrealDB 3.x implementation patterns**
  - Computed views with GROUP BY (event-based materialized)
  - PERMISSIONS on views (critical: views don't inherit permissions)
  - Array operations for shape matching (ALLINSIDE operator)
  - Migration patterns (dual-write events, batch backfill)
  - See: `specs/surrealdb-3x-implementation.md`

- [x] **P0.6: Verify SurrealDB feature compatibility**
  - Test computed views with GROUP BY on arrays ✓
  - Test PERMISSIONS enforcement on views ✗ (bug in 3.0.0)
  - Document minimum SurrealDB version (>= 3.0.0)
  - Workaround: Use query-time filtering instead of view PERMISSIONS
  - See: `specs/baseline-metrics.md` (SurrealDB 3.x Feature Compatibility)

**Acceptance:** All spec gaps filled, baseline metrics documented

**Commit Milestone:** `chore(spec): baseline metrics and missing specifications`

---

## Phase 1: Schema Deployment (Week 2)

**Goal:** Create new tables alongside existing tables (non-breaking)

### Tasks

- [x] **P1.1: Deploy 4 core tables with RBAC**
  - Create `impulse` table (pointer + shape + content + org_id)
  - Create `activity` table (input_shapes + output_shapes + execution_type)
  - Create `execution` table (input_impulses + output_impulses + trace)
  - Create `vessel` table (resolves[] + api_key_hash)
  - Apply universal PERMISSIONS pattern to all
  - Add indexes: idx_*_org, idx_*_org_project, idx_input_shapes, etc.
  - See: `repos/metabob-activity-api/sql/schemas/020-paradigm-core-tables.surql`

- [x] **P1.2: Deploy computed views for metrics**
  - Create `v_activity_score` (Thompson Sampling from execution counts)
  - Create `v_goal_paths` (compositions accepting goal impulses)
  - Create `v_tool_usage` (tool usage aggregation)
  - Create `v_vessel_activity` (vessel health metrics)
  - Create `v_execution_tree` (composition parent-child)
  - Create `v_activity_shapes` (shape-based matching helper)
  - See: `repos/metabob-activity-api/sql/schemas/021-paradigm-computed-views.surql`

- [x] **P1.3: Deploy backward-compatibility views**
  - Create `v_paradigm_activity_template` → activity WHERE execution_type='template'
  - Create `v_paradigm_execution_traces` → execution
  - Create `v_paradigm_impulse_data` → impulse
  - Create `v_paradigm_minibob_instance` → vessel
  - Create `v_paradigm_performance_metrics` → v_activity_score
  - Create `v_paradigm_goal_paths` → activity (compositions)
  - See: `repos/metabob-activity-api/sql/schemas/022-paradigm-compat-views.surql`

- [x] **P1.4: Deploy schemas to staging**
  - Applied all schemas via migration job (job/surrealdb-migration-25)
  - Verified tables exist: impulse, activity, execution, vessel
  - Verified views exist: v_activity_score, v_goal_paths, v_tool_usage, etc.
  - All queries return OK status

**Acceptance:** All new tables and views created, existing system unaffected

**Commit Milestone:** `feat(schema): deploy 4 core tables with RBAC and computed views`

---

## Phase 2: API Adaptation (Weeks 3-4)

**Goal:** Update backend routes to use new schema with fallback

### Tasks

- [x] **P2.1: Update backend routes to use new tables**
  - Update `POST /v2/activities/templates` → INSERT into activity ✓
  - Update `GET /v2/activities/templates` → SELECT from activity + v_activity_score (partial)
  - Update `POST /v2/activities/recommend` → Thompson sample from v_activity_score ✓
  - Update `POST /v2/activities/execution-traces` → INSERT into execution ✓
  - Update `POST /v2/activities/executions` → INSERT into execution ✓
  - Add fallback: try new table first, fall back to old on failure ✓
  - Add monitoring logs for which path taken ✓
  - See: `src/db/paradigm.ts` (paradigm helpers)
  - See: `src/routes/activities.ts` (dual-write + recommend)
  - See: `src/routes/execution-traces.ts` (dual-write)

- [x] **P2.2: Add shape-based activity matching**
  - Implement `queryActivitiesByShapes(availableShapes, ...)` algorithm ✓
  - Uses SurrealDB ALLINSIDE operator for shape subset matching ✓
  - Add `impulse_shapes` parameter to `/v2/activities/recommend` ✓
  - Filter activities where `input_shapes ⊆ available_shapes` ✓
  - Fallback: category-only matching for activities without shapes ✓
  - See: `src/db/paradigm.ts:queryActivitiesByShapes()`

- [x] **P2.3: Add execution trace impulse resolution**
  - Updated `activityExecutionTrace` resolver to use new execution table ✓
  - Query execution table by executionId with fallback to legacy table ✓
  - Load referenced impulses if `includeImpulses=true` ✓
  - Format trace for LLM consumption (markdown) ✓
  - Added `formatParadigmExecutionAsMarkdown()` for new schema ✓
  - See: `src/routes/impulses.ts:resolve` handler

- [x] **P2.4: Update Thompson Sampling to use computed view**
  - Change `POST /v2/activities/recommend` to query `v_activity_score` ✓
  - Uses `getActivityScores()` with fallback to `variant_performance_metrics` ✓
  - Add tie-breaking strategy (by last_executed_at) - computed view includes this
  - See: `src/db/paradigm.ts:getActivityScores()`

**Acceptance:** All routes use new schema, backward compatibility verified

**Commit Milestone:** `feat(api): update routes to use unified schema with shape matching`

---

## Phase 3: MiniBob Integration (Weeks 4-5)

**Goal:** Update MiniBob to populate new schema fields

### Tasks

- [ ] **P3.1: Update MiniBob to populate new fields**
  - Add `shape` field to impulse creation (infer from pointer type)
  - Add `input_impulses[]` to execution (from loaded impulse IDs)
  - Add `output_impulses[]` to execution (from created impulse IDs)
  - Add `parent_execution_id` for composition tracking
  - Add `input_shapes[]` to registered templates (infer from executions)
  - Test: All new fields populated correctly

- [ ] **P3.2: Add impulse evolution tracking**
  - Capture impulse content hashes before each task
  - Capture impulse content hashes after each task
  - Store in `execution.trace.impulse_evolution[]`
  - Enable query "which impulses changed during execution X"
  - Test: Evolution data captured and queryable

- [ ] **P3.3: Integration testing**
  - Run full activity execution flow
  - Verify traces recorded with all new fields
  - Verify Thompson Sampling updates from v_activity_score
  - Verify shape-based recommendations work
  - Test: Complete workflow succeeds end-to-end

**Acceptance:** MiniBob sends complete data, learning loop functional

**Commit Milestone:** `feat(minibob): populate unified schema fields with evolution tracking`

---

## Phase 4: Dual-Write and Migration (Weeks 5-6)

**Goal:** Parallel writes with historical data backfill

### Tasks

- [ ] **P4.1: Enable dual-write in API**
  - Write to both old and new tables
  - Feature flag controlled (DUAL_WRITE_ENABLED)
  - Log any write failures for debugging
  - Test: Both tables updated consistently

- [ ] **P4.2: Run historical data backfill**
  - Migrate activity_template → activity
  - Migrate activity_execution_traces → execution
  - Migrate impulse_data → impulse
  - Migrate minibob_instance → vessel
  - Batch processing (1000 records per batch)
  - Test: Row counts match, spot-check data integrity

- [ ] **P4.3: Implement sync validation job**
  - Run hourly during dual-write period
  - Compare row counts between old and new tables
  - Alert on discrepancy > 1%
  - Log detailed diff for investigation
  - Test: Validation catches intentional discrepancy

- [ ] **P4.4: Monitor and stabilize**
  - Track error rates in both write paths
  - Track query latency for new vs old tables
  - Fix any sync issues discovered
  - Document issues and resolutions
  - Target: Stable for 1 week with < 1% drift

**Acceptance:** Dual-write stable, all historical data migrated

**Commit Milestone:** `feat(migration): dual-write and historical data backfill`

---

## Phase 5: Read Migration and Cleanup (Weeks 6-8)

**Goal:** Switch reads to new tables, remove old tables

### Tasks

- [ ] **P5.1: Switch primary reads to new tables**
  - Remove fallback to old tables in all queries
  - Update all SELECT queries to use new table names
  - Monitor error rates closely
  - Test: All reads use new tables only

- [ ] **P5.2: Gradual rollout**
  - Enable for 10% of traffic (feature flag)
  - Monitor for 2 days
  - Increase to 50%, monitor for 2 days
  - Increase to 100%
  - Test: No errors at each stage

- [ ] **P5.3: Deprecate old endpoint paths**
  - Add deprecation warnings to old endpoints
  - Update API documentation
  - Notify downstream consumers
  - Set removal date (30 days)

- [ ] **P5.4: Archive old tables**
  - Stop dual-write (remove old table writes)
  - Rename old tables with `_archived_YYYYMMDD` suffix
  - Keep for 30 days (rollback safety)
  - Document archive location

- [ ] **P5.5: Final cleanup**
  - Drop archived tables after 30 days
  - Remove backward-compat views
  - Remove dual-write code
  - Remove old endpoint handlers
  - Update CLAUDE.md schema documentation
  - Test: Clean schema with only 4 tables + computed views

- [ ] **P5.6: Close out change**
  - Archive this OpenSpec change
  - Document lessons learned
  - Update surrealdb-schema.md contract

**Acceptance:** Migration complete, clean 4-table schema

**Commit Milestone:** `chore(cleanup): remove legacy schema, complete migration`

---

## Timeline Summary

| Phase | Duration | Dependencies | Commit Milestone |
|-------|----------|--------------|------------------|
| P0: Foundation | 1 week | None | `chore(spec): baseline and specs` |
| P1: Schema | 1 week | P0 | `feat(schema): 4 core tables` |
| P2: API | 2 weeks | P1 | `feat(api): unified routes` |
| P3: MiniBob | 1 week | P2 | `feat(minibob): populate fields` |
| P4: Migration | 1 week | P3 | `feat(migration): dual-write` |
| P5: Cleanup | 2 weeks | P4 | `chore(cleanup): complete` |

**Total Duration:** ~8 weeks

---

## Risk Mitigation

### Data Loss Prevention
- All migrations have rollback scripts
- Old tables archived for 30 days before deletion
- Validation queries run hourly during dual-write
- Spot-check data integrity at each phase

### Performance Regression
- Baseline metrics established in Phase 0
- Performance SLA: < 50ms for v_activity_score queries
- Mitigation: Materialize views if computed views too slow
- Fallback: Redis cache for hot paths

### API Breaking Changes
- Backward compatibility views from day 1
- Feature flags for gradual rollout
- 30-day deprecation notice before removal
- Dual-write ensures data consistency during transition

### MiniBob Disruption
- Integration tests before and after each phase
- Shape matching backward-compatible (optional field)
- Quick rollback: revert to old table writes
- Staged rollout: staging → 10% → 50% → 100%

---

## Testable States at Each Commit

| Commit | What's Testable |
|--------|-----------------|
| `chore(spec): baseline` | Specs reviewed, metrics documented |
| `feat(schema): 4 tables` | Tables exist, PERMISSIONS work, views return data |
| `feat(api): unified routes` | Backend reads/writes new tables, shapes filter correctly |
| `feat(minibob): populate` | MiniBob sends complete data, evolution tracked |
| `feat(migration): dual-write` | Historical data migrated, counts match |
| `chore(cleanup): complete` | Only 4 tables remain, system fully functional |
