# Execution Plan: MiniBob Reliability & Transparency

## Overview

**Goal**: Make MiniBob's decision-making visible and execution reliable via code improvements (not activities, not using MiniBob).

**Time**: 12 hours (+ 2 hour buffer) = ~14 hours total
**Deliverable**: Demo-ready system showing learning and adaptive selection

---

## Quick Reference

```
┌──────────────────────────────────────────────────────────────────┐
│                       EXECUTION ORDER                             │
└──────────────────────────────────────────────────────────────────┘

PHASE 1: Foundation (3h - parallel)
├─ T1: Audit bootstrap activities (2h)
└─ T2: Seed activities to database (1h)

PHASE 2: Core Implementation (5h - sequential)
├─ T3: Selection transparency (2-3h)
└─ T4: Within-goal blacklisting (2h)

PHASE 3: Additional Features (1h)
└─ T5: Capability testing (1h)

PHASE 4: Validation (3h - parallel)
├─ T6: Unit tests (1h)
├─ T7: Integration tests (1h)
└─ T8: Demo validation (1h)
```

---

## Phase 1: Foundation (Hours 0-3)

### What We're Building
Ensuring the foundation is solid before improving visibility.

### Tasks

#### T1: Audit Bootstrap Activities (2h) ⚡ START HERE
**Owner**: Direct code development
**Blocker**: None - can start immediately

**Steps**:
1. Create `scripts/audit-bootstrap-activities.ts`
2. Implement checks:
   - Valid JSON structure
   - Validation rules exist
   - Retry strategy defined
   - Variables typed
   - Task count reasonable
3. Run audit on all 11 templates
4. Generate report

**Expected Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOTSTRAP ACTIVITY AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ add-feature-complete.json
⚠ create-activity-self-contained.json (missing validation rules)
✓ fix-bug-complete.json
...

Summary: 10/11 passing, 1 needs fixes
```

**Checkpoint**:
```bash
bun run scripts/audit-bootstrap-activities.ts
# Expected: Clear report with pass/fail status
```

**Exit Criteria**: Report generated, issues documented

---

#### T2: Seed Activities to Database (1h)
**Owner**: Direct code development
**Blocker**: T1 (must fix issues first)

**Steps**:
1. Fix issues found in T1 audit
2. Run `scripts/seed-bootstrap-templates.ts`
3. Verify backend has activities
4. Check Thompson params initialized

**Expected Output**:
```
Seeding 11 bootstrap activities...
✓ add-feature-complete (variant_id: bootstrap/add-feature-complete-v1)
✓ fix-bug-complete (variant_id: bootstrap/fix-bug-complete-v1)
...
All activities seeded successfully
```

**Checkpoint**:
```bash
curl http://activity.metabob.local/v2/activities/templates | jq '. | length'
# Expected: >= 11

curl -X POST http://activity.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"goal":"Test","category":"feature"}' | jq '.[0].template_id'
# Expected: Returns a template_id
```

**Exit Criteria**: 11+ activities in database, recommendation endpoint works

---

### Phase 1 Validation

**After completing T1 and T2**:
```bash
# Check foundation is solid
bun run scripts/audit-bootstrap-activities.ts
# Expected: All activities pass

curl http://activity.metabob.local/v2/activities/templates | jq '. | length'
# Expected: >= 11

# Test recommendation
curl -X POST http://activity.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"goal":"Fix authentication bug","category":"bugfix"}' | jq '.[:3]'
# Expected: 3 recommendations with selection_metadata
```

**Gate**: All checks pass before proceeding to Phase 2

---

## Phase 2: Core Implementation (Hours 3-8)

### What We're Building
Adding visibility to selection process and preventing retry loops.

### Tasks

#### T3: Selection Transparency (2-3h)
**Owner**: Direct code development
**Blocker**: T1, T2 (need working activities)

**Files to Modify**:
- `repos/minibob/src/goal-processor.ts`

**Implementation**:

1. Add helper functions (30 min):
   ```typescript
   logGoalAnalysis(goal: Goal)
   logRecommendations(recommendations, iteration, max, excluded)
   logActivityExecution(templateId, execution)
   logGoalVerification(complete, reason)
   ```

2. Integrate into executeGoal() flow (1h):
   - After parseGoal() → logGoalAnalysis()
   - After getRecommendations() → logRecommendations()
   - After execution → logActivityExecution()
   - After isGoalComplete() → logGoalVerification()

3. Test output format (30 min):
   - Run goal execution
   - Verify all sections appear
   - Check Thompson params visible
   - Ensure no behavior changes

**Expected Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 GOAL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type: bugfix
Intent: Fix authentication issues
Required capabilities: debugging, code-modification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ACTIVITY SELECTION (Iteration 1/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Context: 3 impulses available

  1. fix-bug-complete ⭐ SELECTED
     Score: 0.87 | Thompson: α=24 β=3 | Success: 92%
     Strategy: Exploitation
     Reasoning: High success rate for bugfix category

  2. debug-activity-self-contained
     Score: 0.45 | Thompson: α=2 β=8 | Success: 20%
     Strategy: Exploration

  3. refactor-with-tests
     Score: 0.32 | Thompson: α=16 β=8
     Reasoning: Lower relevance

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ EXECUTING: fix-bug-complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task 1/4: Reproduce bug
  ✓ success
Task 2/4: Implement fix
  ✓ success
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Activity completed (11.9s, $0.12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ GOAL VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal achieved: Authentication bug fixed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Checkpoint**:
```bash
bun run repos/minibob/src/index.ts goal "Read package.json"

# Verify output contains:
grep -q "GOAL ANALYSIS"
grep -q "ACTIVITY SELECTION"
grep -q "Thompson:"
grep -q "⭐ SELECTED"
grep -q "EXECUTING:"
grep -q "GOAL VERIFICATION"
```

**Exit Criteria**: All sections visible, Thompson params shown, no behavior changes

---

#### T4: Within-Goal Blacklisting (2h)
**Owner**: Direct code development
**Blocker**: T3 (logging shows exclusions)

**Files to Modify**:
- `repos/minibob/src/goal-processor.ts`
- `repos/minibob/src/mcp.ts`
- `repos/metabob-activity-api/src/routes/activities.ts`

**Implementation**:

1. Client tracking (30 min):
   ```typescript
   // In executeGoal()
   const failedActivities: string[] = []

   // After execution
   if (execution.status === 'failed') {
     failedActivities.push(topRecommendation.templateId)
   }

   // Pass to getRecommendations()
   const recommendations = await this.getRecommendations(
     goal, impulseIds, 3, failedActivities
   )
   ```

2. MCP client update (30 min):
   ```typescript
   // Add parameter to recommendActivities()
   async recommendActivities(
     goalDescription: string,
     category?: string,
     availableImpulses?: string[],
     limit?: number,
     excludeActivities?: string[]  // NEW
   )
   ```

3. Backend filter (30 min):
   ```typescript
   // In /v2/activities/recommend handler
   const { exclude_activities = [] } = request.body

   // Filter before Thompson Sampling
   const excludeSet = new Set(exclude_activities)
   const filteredActivities = allActivities.filter(
     a => !excludeSet.has(a.variant_id)
   )
   ```

4. Test blacklisting (30 min):
   - Create scenario where first activity fails
   - Verify exclusion message shown
   - Verify different activity selected on retry
   - Verify excluded activity not in recommendations

**Expected Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ACTIVITY SELECTION (Iteration 1/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
  1. activity-a ⭐ SELECTED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ EXECUTING: activity-a
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task 1/2: Do something
  ✗ failure

✗ Activity failed (5.2s, $0.05)

⚠ Activity failed: activity-a
   Will exclude from future recommendations in this goal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ACTIVITY SELECTION (Iteration 2/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Excluding previously failed: [activity-a]

  1. activity-b ⭐ SELECTED
  2. activity-c

  (activity-a NOT in list)
```

**Checkpoint**:
```bash
# Run goal that triggers failure
# (e.g., activity requires missing file)

# Verify in output:
grep -q "⚠ Activity failed"
grep -q "Excluding previously failed"

# Verify different activity selected on iteration 2
# Verify failed activity not in iteration 2 recommendations
```

**Exit Criteria**: Failed activities excluded, different activity selected on retry

---

### Phase 2 Validation

**After completing T3 and T4**:
```bash
# Test transparency
bun run repos/minibob/src/index.ts goal "Test goal"
# Expected: All output sections present with Thompson scores

# Test blacklisting
# (Manual: Create scenario with first failure)
# Expected: "Excluding previously failed: [...]"
# Expected: Different activity on iteration 2
```

**Gate**: Transparency works, blacklisting prevents retry loops

---

## Phase 3: Additional Features (Hours 8-9)

### What We're Building
Capability query interface.

### Tasks

#### T5: Capability Testing Command (1h)
**Owner**: Direct code development
**Blocker**: T2 (need activities in database)

**Files to Modify**:
- `repos/minibob/src/index.ts`

**Implementation**:

1. Add CLI handler (20 min):
   ```typescript
   if (arg === '/test') {
     const capability = args.slice(i + 1).join(' ')
     await testCapability(capability)
     process.exit(0)
   }
   ```

2. Implement testCapability() (30 min):
   - Query backend with "Test capability: X"
   - Display results with scores
   - Show success rates
   - Return appropriate exit code

3. Test command (10 min):
   - Test with known capability
   - Test with unknown capability
   - Verify output format

**Expected Output**:
```bash
$ bun run index.ts /test "read and analyze files"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 CAPABILITY TEST: read and analyze files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 3 potentially relevant activities:

  1. understanding:explore-codebase
     Score: 0.92
     Success rate: 95% (38/40 executions)

  2. refactor-with-tests
     Score: 0.67
     Success rate: 67% (16/24 executions)

  3. add-feature-complete
     Score: 0.45
     Success rate: 78% (35/45 executions)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Capability covered by 3 existing activities
  Recommendation: understanding:explore-codebase (highest confidence)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$ echo $?
0
```

**Checkpoint**:
```bash
bun run repos/minibob/src/index.ts /test "read TypeScript files"
# Expected: List of activities, exit code 0

bun run repos/minibob/src/index.ts /test "impossible task"
# Expected: "No activities found", exit code 1
```

**Exit Criteria**: Command works, displays results, correct exit codes

---

## Phase 4: Validation (Hours 9-12)

### What We're Building
Comprehensive testing and demo preparation.

### Tasks (Can run in parallel)

#### T6: Unit Tests (1h)
**Owner**: Direct code development
**Blocker**: T3, T4, T5

**Files to Create**:
- `repos/minibob/src/__tests__/goal-processor.test.ts`
- `repos/minibob/src/__tests__/mcp.test.ts`

**Test Cases**:
1. Blacklisting tracks failures correctly
2. Exclusions passed to getRecommendations()
3. MCP client includes exclude_activities in request
4. Logging functions don't throw

**Checkpoint**:
```bash
cd repos/minibob
bun test

# Expected: All tests pass
# Expected: New blacklisting tests included
# Expected: Run time < 5 seconds
```

**Exit Criteria**: All tests pass, >95% coverage on new code

---

#### T7: Integration Tests (1h)
**Owner**: Direct code development
**Blocker**: T6

**Scenarios**:
1. Selection transparency - all sections present
2. Blacklisting - exclusion works
3. Capability testing - /test command works

**Checkpoint**:
```bash
# Scenario 1
bun run index.ts goal "Read package.json"
# Verify: GOAL ANALYSIS, ACTIVITY SELECTION, Thompson scores

# Scenario 2
# (Create scenario with first failure)
# Verify: Exclusion message, different activity on retry

# Scenario 3
bun run index.ts /test "read files"
# Verify: Activities listed, exit code 0
```

**Exit Criteria**: All scenarios pass, output matches spec

---

#### T8: Demo Validation (1h)
**Owner**: Direct code development
**Blocker**: T7

**Demo Checklist**:
1. ✓ Bootstrap activities seeded (>= 11)
2. ✓ Selection transparency works
3. ✓ Learning visible (Thompson params change)
4. ✓ Blacklisting works
5. ✓ Capability testing works

**Demo Script**:
```
1. Show activity selection process
   → Run goal
   → Point to ACTIVITY SELECTION section
   → Highlight Thompson scores

2. Demonstrate learning from failures
   → Run goal with intentional first failure
   → Show blacklisting in action
   → Show successful retry with different approach

3. Test capabilities
   → Run /test "code analysis"
   → Show activities with success rates

4. Prove learning over time
   → Run same goal 3 times
   → Show Thompson params evolve
   → Show exploitation vs exploration
```

**Checkpoint**:
```bash
./scripts/demo-validation.sh

# Runs all demo steps
# Expected: All pass, output presentable
```

**Exit Criteria**: All demo steps work, ready for presentation

---

## Validation Criteria

### Phase-by-Phase Gates

**Phase 1 Complete**:
- [ ] Audit script runs, report generated
- [ ] All 11 activities seeded to database
- [ ] Recommendation endpoint returns activities

**Phase 2 Complete**:
- [ ] Goal analysis shown in console
- [ ] Recommendations displayed with Thompson scores
- [ ] Failed activities excluded from retry
- [ ] Different activity selected after failure

**Phase 3 Complete**:
- [ ] /test command works
- [ ] Displays activities with scores
- [ ] Returns correct exit codes

**Phase 4 Complete**:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Demo script runs successfully

### Final Demo Readiness

**Quantitative**:
- [ ] 11/11 bootstrap activities in database
- [ ] 100% of goals show selection reasoning
- [ ] 0 instances of same failed activity retried
- [ ] /test command responds in < 5 seconds
- [ ] All tests pass

**Qualitative**:
- [ ] Observer can understand selection process
- [ ] Learning is visible (Thompson params evolve)
- [ ] Failures handled gracefully
- [ ] System feels reliable
- [ ] Demo-ready presentation

---

## Success Metrics

### Measurements

| Metric | Target | Validation |
|--------|--------|------------|
| Bootstrap activities passing audit | 11/11 | Audit script |
| Console output sections present | 4/4 | Manual check |
| Blacklisting prevents retry | 100% | Integration test |
| Capability test response time | < 5s | Manual timing |
| Unit test pass rate | 100% | bun test |
| Demo script success rate | 100% | Practice runs |

### Evidence of Learning

**Before**: Thompson α=1, β=1 (uniform prior)
**After 1st execution**: α=2 or β=2 (updated based on success/failure)
**After 3rd execution**: Clear differentiation (successful variant has higher α)

**Demo Evidence**:
- Show same goal executed 3 times
- Display Thompson params at each iteration
- Point to increasing confidence in successful variant

---

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backend unavailable | Low | High | Test with local deployment first |
| Activities fail audit | Medium | Medium | Fix immediately (Phase 1 blocker) |
| Thompson params missing | Low | Medium | Check early, handle gracefully |
| Time overrun | Medium | High | Prioritize T1-T4, defer T5 if needed |

### Fallback Plan

**If time constrained**:
1. Complete T1-T4 (foundation + core features)
2. Defer T5 (capability testing) to post-demo
3. Run minimal validation (T6-T7 only)
4. Demo with reduced scope (no /test command)

**Critical path**: T1 → T2 → T3 → T4 → T7 → T8 (9 hours minimum)

---

## Next Steps

**Immediate**:
1. Review this plan with stakeholders
2. Set up development environment
3. Start T1 (audit script) immediately

**During Execution**:
- Update task status after each completion
- Run validation checkpoints
- Document any deviations from plan

**After Completion**:
- Run full demo script
- Document lessons learned
- Plan next iteration improvements

---

## Resources

### Documentation
- Spec: `openspec/changes/minibob-reliability-transparency/spec.md`
- Tasks: `openspec/changes/minibob-reliability-transparency/tasks.md`
- This plan: `openspec/changes/minibob-reliability-transparency/EXECUTION_PLAN.md`

### Code Locations
- MiniBob: `repos/minibob/src/`
- Bootstrap Activities: `repos/metabob-proto/activities/bootstrap/`
- Backend: `repos/metabob-activity-api/src/routes/activities.ts`
- Scripts: `scripts/`

### Endpoints
- Backend: `http://activity.metabob.local`
- Templates: `/v2/activities/templates`
- Recommend: `/v2/activities/recommend`

---

## Timeline Summary

```
Hour  0: Start T1 (audit)
Hour  2: Complete T1, start T2 (seed)
Hour  3: Complete T2, start T3 (transparency)
Hour  5: Complete T3, start T4 (blacklisting)
Hour  7: Complete T4, start T5 (capability test)
Hour  8: Complete T5, start T6+T7+T8 (validation)
Hour 11: Complete validation
Hour 12: Final demo practice
```

**Total**: 12 hours focused work
**Buffer**: 2 hours for issues
**Target**: 14-hour completion window
