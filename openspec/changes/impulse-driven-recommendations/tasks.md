# Implementation Tasks: Impulse-Driven Recommendations

## Task Overview

Implementation broken into 3 parallel tracks (specs), each can be delegated to a dedicated subagent:

1. **Goal Impulse Resolver** - Add 'goal' case to activity-api
2. **MiniBob Impulse-Driven** - Update MiniBob goal-processor
3. **Schema Consistency** - Fix org_id typing across all tables

## Execution Strategy

### Phase 0: Validation & Prerequisites (15 min)

**Pre-flight checks before starting:**

- [ ] **T0.1** Verify activity-api is running
  ```bash
  curl http://api.metabob.local/health
  # Expected: 200 OK
  ```

- [ ] **T0.2** Verify MiniBob can connect to activity-api
  ```bash
  cd repos/minibob
  bun run test-mcp-connection.ts
  # Expected: Connection successful
  ```

- [ ] **T0.3** Verify SurrealDB 3.0.5+ is running
  ```bash
  curl http://surql.metabob.local
  # Check version in response
  ```

- [ ] **T0.4** Backup current state
  ```bash
  # Tag current Docker images
  # Document current git commit
  # Export SurrealDB data if needed
  ```

---

### Phase 1: Goal Impulse Resolver (2 hours)
**Spec:** `specs/goal-impulse-resolver.md`
**Subagent:** Can work independently
**Dependencies:** None

- [ ] **T1.1** Add 'goal' case to impulse resolver
  - File: `repos/metabob-activity-api/src/routes/impulses.ts`
  - Location: Line ~1222 (after existing cases)
  - Extract goal parameters from pointer
  - Validate required fields

- [ ] **T1.2** Call Thompson Sampling with impulse context
  - Reuse existing `recommendActivitiesWithSampling()` function
  - Pass impulseRefs as loaded_impulses parameter
  - Get RBAC context from JWT auth

- [ ] **T1.3** Format recommendations as impulse content
  - Return JSON string with recommendations array
  - Include metadata (context size, sampling method)
  - Return 200 with success flag

- [ ] **T1.4** Test with curl
  ```bash
  curl -X POST http://api.metabob.local/v2/impulses/resolve \
    -H "Authorization: Bearer $JWT" \
    -d '{"pointer":{"type":"goal","content":"Add tests"}}'
  ```

- [ ] **T1.5** Create unit tests
  - File: `repos/metabob-activity-api/test/goal-impulse-resolver.test.ts`
  - Test basic goal resolution
  - Test with impulseRefs
  - Test error handling

**Acceptance:**
- [ ] 'goal' case added to impulse resolver
- [ ] Returns recommendations as JSON content
- [ ] Includes metadata about recommendation quality
- [ ] curl tests pass
- [ ] Unit tests pass

---

### Phase 2: MiniBob Impulse-Driven (2 hours)
**Spec:** `specs/minibob-impulse-driven.md`
**Subagent:** Can work independently
**Dependencies:** Phase 1 (goal impulse resolver)

- [ ] **T2.1** Create goal impulse helper function
  - File: `repos/minibob/src/goal-processor.ts`
  - Function: `createGoalImpulse(goalDescription, options)`
  - Get current loaded impulses for context
  - Return impulse ID

- [ ] **T2.2** Create recommendation resolver
  - Function: `getRecommendations(goalImpulseId)`
  - Call `loadImpulse()` to resolve via vessel discovery
  - Parse JSON content to get recommendations
  - Return recommendations array

- [ ] **T2.3** Add fallback to deprecated MCP method
  - Function: `getFallbackRecommendations(goalImpulseId)`
  - Log deprecation warning
  - Call `mcp.recommendActivities()` as fallback
  - Return recommendations

- [ ] **T2.4** Update processGoal flow
  - Replace direct MCP calls with impulse resolution
  - Use `createGoalImpulse()` → `getRecommendations()`
  - Keep existing activity selection/execution logic

- [ ] **T2.5** Test locally
  ```bash
  cd repos/minibob
  bun run src/index.ts --single "Add user authentication"
  # Check logs for "Goal impulse created"
  # Check logs for "Goal impulse resolved"
  # Should NOT see "Falling back to direct MCP"
  ```

- [ ] **T2.6** Create unit tests
  - File: `repos/minibob/test/goal-processor-impulse.test.ts`
  - Test goal impulse creation
  - Test recommendation resolution
  - Test impulse context passing
  - Test fallback on failure

**Acceptance:**
- [ ] Goal impulses created with proper structure
- [ ] Impulse resolution used instead of direct MCP calls
- [ ] Current impulse context passed in impulseRefs
- [ ] Recommendations parsed correctly
- [ ] Fallback works if resolution fails
- [ ] All existing tests still pass
- [ ] New tests pass

---

### Phase 3: Schema Consistency (1.5 hours)
**Spec:** `specs/schema-consistency.md`
**Subagent:** Can work independently
**Dependencies:** None (can run in parallel)

- [ ] **T3.1** Create migration script
  - File: `repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql`
  - Update all tables with `org_id TYPE record<organizations>`
  - Replace with `org_id TYPE string`
  - Add comments

- [ ] **T3.2** Update schema files
  - Update all files in `repos/metabob-activity-api/sql/schemas/`
  - Replace `TYPE record<organizations>` with `TYPE string`
  - Add consistent comments

- [ ] **T3.3** Create documentation
  - File: `repos/metabob-activity-api/sql/SCHEMA_CONVENTIONS.md`
  - Document org_id typing standard
  - Document RBAC patterns
  - Provide examples

- [ ] **T3.4** Test on fresh database
  ```bash
  kubectl delete namespace activity-system
  helmfile -e local sync
  # Verify all org_id fields are TYPE string
  ```

- [ ] **T3.5** Verify RBAC still works
  - Create test organization
  - Create MiniBob instance
  - Sign in to get JWT
  - Verify org_id filtering works

**Acceptance:**
- [ ] Migration script created
- [ ] All schema files updated
- [ ] Documentation created
- [ ] Fresh database test passes
- [ ] RBAC enforcement still works
- [ ] No RECORD type references remain

---

## Integration & Verification (30 min)

**After all phases complete:**

- [ ] **T4.1** Full local deployment test
  ```bash
  kubectl delete namespace activity-system
  helmfile -e local sync
  ./scripts/health-check.sh local
  ```

- [ ] **T4.2** Test complete goal → execution flow
  - Start MiniBob
  - Provide goal: "Add tests for authentication module"
  - Verify goal impulse created
  - Verify resolution via activity-api
  - Verify recommendations returned
  - Verify activity executed

- [ ] **T4.3** Test impulse context passing
  - Load some file impulses
  - Create goal impulse
  - Verify impulseRefs includes loaded files
  - Verify activity-api receives context

- [ ] **T4.4** Run full test suite
  ```bash
  cd repos/metabob-activity-api
  bun test

  cd repos/minibob
  bun test
  ```

- [ ] **T4.5** Deploy to canary
  ```bash
  helmfile -e canary sync
  ./scripts/health-check.sh canary
  ```

- [ ] **T4.6** Canary validation (2-4 hours)
  - Run integration tests
  - Manual smoke testing
  - Monitor logs for errors

- [ ] **T4.7** Promote to production (if ready)
  ```bash
  ./scripts/promote-canary-to-production.sh
  ./scripts/health-check.sh production
  ```

---

## Documentation Tasks

**Update documentation after implementation:**

- [ ] **TD.1** Update CLAUDE.md (repos/minibob)
  - Document impulse-driven goal processing
  - Remove references to direct MCP calls
  - Add examples

- [ ] **TD.2** Update CLAUDE.md (repos/metabob-activity-api)
  - Document 'goal' impulse type
  - Add to impulse resolver documentation
  - Show example responses

- [ ] **TD.3** Update IMPULSE_ACTIVITY_FOUNDATION.md
  - Add 'goal' to canonical impulse types
  - Update examples to show goal resolution
  - Document vessel/impulse paradigm for recommendations

- [ ] **TD.4** Create SURREALDB_SCHEMA_GUIDE.md
  - Document SurrealDB 3.0.5+ patterns
  - Document org_id typing convention
  - Document RBAC patterns

---

## Rollback Plan

**If anything goes wrong:**

**During development (before deployment):**
```bash
# Revert git changes
git restore .
git clean -fd

# Restore from backup if needed
```

**After canary deployment (before production):**
```bash
# Don't promote to production
# Fix issues in dev environment
# Redeploy to canary with fixes
```

**After production deployment:**
```bash
# Option 1: Rollback via promotion script
./scripts/promote-canary-to-production.sh previous-tag

# Option 2: Helm rollback
helm rollback metabob-activity-api -n activity-system

# Option 3: Revert specific commits
git revert <commit-hash>
./scripts/build-vessel.sh metabob-activity-api
helmfile -e production sync
```

---

## Success Criteria

All tasks complete when:

- [ ] MiniBob has zero direct calls to `mcp.recommendActivities()`
- [ ] Goal impulses automatically trigger activity recommendations
- [ ] activity-api responds to `POST /v2/impulses/resolve` for type='goal'
- [ ] Impulse context (loaded impulses) passed to recommendations
- [ ] Schema uses consistent `TYPE string` for org_id across all tables
- [ ] All tests pass (unit + integration)
- [ ] Zero regression in existing goal-driven execution
- [ ] Canary deployment healthy
- [ ] Production deployment successful (when ready)
- [ ] Documentation updated

---

## Timeline

| Phase | Estimated Time |
|-------|----------------|
| Phase 0: Validation | 15 min |
| Phase 1: Goal Impulse Resolver | 2 hours |
| Phase 2: MiniBob Impulse-Driven | 2 hours |
| Phase 3: Schema Consistency | 1.5 hours |
| Integration & Verification | 30 min |
| Documentation | 30 min |
| **Total** | **~6.5 hours** |

**Plus canary soak time:** 2-4 hours before production promotion

---

## Subagent Distribution

**Recommendation:** Spawn 3 parallel subagents (Task tool), one per phase:

1. **Goal Resolver Agent** → `specs/goal-impulse-resolver.md`
2. **MiniBob Agent** → `specs/minibob-impulse-driven.md`
3. **Schema Agent** → `specs/schema-consistency.md`

Each subagent:
- Reads its spec
- Implements tasks in that spec
- Reports back with status
- Can work independently

**Dependencies:**
- MiniBob Agent should wait for Goal Resolver Agent (needs endpoint working first)
- Schema Agent can run completely in parallel

**Coordination:**
- Integration phase (Phase 4) happens after all agents complete
- One coordinating agent (or human) runs integration tests
