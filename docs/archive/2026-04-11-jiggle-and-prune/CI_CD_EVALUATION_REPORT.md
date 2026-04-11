# MiniBob CI/CD Capabilities Evaluation

**Date**: 2026-04-09
**Environment**: Canary (activity.metabob.com)
**Demo Repository**: demos/minibob-cicd

## Executive Summary

MiniBob has a **solid foundation for autonomous CI/CD** with 19 specialized activities in the demo repository and 50 templates already registered in the canary environment. However, **critical integration gaps exist** between the demo activities and the production backend that prevent full autonomous operation.

**Key Findings**:
- ✅ **Infrastructure Ready**: Canary environment healthy, Thompson Sampling operational
- ✅ **Activities Designed**: 19 CI/CD-focused activities with complete JSON templates
- ⚠️ **Integration Partial**: Demo activities not registered in canary backend
- ❌ **Learning Loops Incomplete**: 3 loops at 40-75% implementation
- ❌ **Automatic Feedback Missing**: Manual endpoint exists but not called automatically

## Current State Analysis

### 1. Demo Repository Activities (19 total)

**Discovery Activities** (Loop 3) - 3 activities:
- `scan-file-system.json` - Discover source files, tests, configs
- `scan-git-history.json` - Discover recent commits and changes
- `scan-execution-traces.json` - Query backend for similar past fixes

**Learning Activities** (All Loops) - 4 activities:
- `fix-test-failure.json` - Basic LLM-assisted test fixing
- `fix-test-failure-with-discovery.json` - Complete three-loops demonstration
- `fix-type-error.json` - TypeScript error fixes
- `fix-lint-error.json` - Linting error fixes

**Deterministic Activities** (Baseline) - 3 activities:
- `run-test-suite.json` - Execute tests with bun test
- `run-typecheck.json` - Type checking with tsc
- `run-lint.json` - Linting with eslint

**GitHub Management** - 3 activities:
- `create-issue-from-bug.json` - Create issues from bugs
- `create-pr-from-branch.json` - Create PRs with auto-descriptions
- `merge-pr.json` - Merge PRs after validation

**Upkeep Activities** - 4 activities:
- `create-issue-from-failure.json` - Create issue from CI failure
- `create-pr-for-fix.json` - Create PR from fix
- `sync-readme.json` - Update README
- `sync-changelog.json` - Update changelog

**Development** - 1 activity:
- `introduce-change.json` - Make code changes

**Monitoring** - 1 activity:
- `analyze-traces.json` - Performance analysis

### 2. Canary Environment Status

**Health**: ✅ Healthy
- Redis: 2ms latency
- SurrealDB: 5ms latency
- Version: 1.2.10

**Registered Templates**: 50 total

**CI/CD-Related Templates in Canary**:
- `run-test-suite` (multiple variants)
- `run-lint`
- `fix-bug-complete`
- `pre-commit-check`
- `create-test`

**Notable Absence**:
- Discovery activities (scan-*)
- GitHub management activities (create-issue-*, create-pr-*, merge-pr)
- Learning activities with full loop integration
- Upkeep activities (sync-*, create-issue-from-failure)

### 3. Learning Loops Implementation Status

#### Loop 1: Impulse Flow - ⚠️ 75% Complete

**What Works**:
- Impulse metadata structure (pointer, metadata, loaded, budget, priority)
- Lazy loading (loaded: false → load on-demand)
- Budget enforcement (token limits respected)
- Task output chaining (Task N output → Task N+1 input)
- Multiple impulse types (memo, file, activityExecutionTrace, etc.)

**What's Missing**:
- Automatic relevance score updates based on usage
- Impulse budget allocation based on learned relevance
- Dynamic priority adjustment during execution
- Usage tracking (structure exists but not integrated)
- Relevance-based loading (backend supports it, MiniBob doesn't query it)

**Time to Complete**: 2-3 hours

#### Loop 2: External Validation - ⚠️ 70% Complete

**What Works**:
- Internal validation (pattern checks, required files, forbidden content)
- External validation (commands: bun test, tsc, eslint)
- Exit code checking (0 = success)
- Basic retry logic with progressive context
- Thompson Sampling backend infrastructure (α/β storage, queries)
- **CRITICAL**: Manual feedback endpoint EXISTS at `/v2/activities/feedback`

**What's Missing**:
- **Automatic feedback recording** after every activity execution
- Weighted Thompson penalties based on error classification
- Variant creation on specific error types
- Recovery strategy Thompson Sampling
- Integration of ExternalValidationResolver error types (22 types defined)

**Time to Complete**: 2-4 hours

#### Loop 3: Discovery - ✅ 100% Designed, ⚠️ 40% Implemented

**What's Designed**:
- 5 scanning activities with complete JSON templates
- Shape inference mechanism
- Parallel scan execution pattern
- Thompson Sampling for scan effectiveness
- Impulse consolidation and metadata batching

**What's Implemented**:
- Shape inference exists in `repos/minibob/src/shape-resolver.ts`
- StateSpaceManager exists with findMissingImpulses()
- 3 of 5 activity templates created

**What's Missing**:
- Automatic trigger (discovery not called from goal processor)
- Parallel execution coordinator
- Impulse batch consolidation logic
- Thompson Sampling integration for discoveries
- 2 remaining scanning activities (scan-dependencies, scan-test-suite)

**Time to Complete**: 6-8 hours

## Critical Gaps for Autonomous CI/CD

### Gap 1: Activity Registration

**Issue**: Demo repo activities not registered in canary backend.

**Impact**: Cannot execute discovery, GitHub management, or full learning loops.

**Resolution**:
```bash
# Register each activity template
for activity in demos/minibob-cicd/activities/**/*.json; do
  curl -X POST "https://activity.metabob.com/v2/activities/templates" \
    -H "Authorization: ApiKey <key>" \
    -H "Content-Type: application/json" \
    -d @"$activity"
done
```

**Time Estimate**: 30 minutes

### Gap 2: Automatic Feedback Loop

**Issue**: Feedback endpoint exists but not called automatically after executions.

**Impact**: Thompson Sampling doesn't learn, no improvement over time.

**Resolution**:
1. Modify `repos/minibob/src/activity.ts` to call `mcp.recordFeedback()` after each execution
2. Pass execution outcome, duration, cost, error classification
3. Test that α/β parameters update correctly

**Time Estimate**: 2-3 hours

### Gap 3: Discovery Integration

**Issue**: Discovery activities exist but not triggered automatically.

**Impact**: Missing context for bug fixes, manual impulse management required.

**Resolution**:
1. Add discovery phase to `repos/minibob/src/goal-processor.ts`
2. Create parallel activity executor
3. Implement impulse batch consolidation
4. Add Thompson Sampling updates for discovery activities

**Time Estimate**: 6-8 hours

### Gap 4: Resolvers and Vessels

**Issue**: GitHub management activities need GitHub API resolver.

**Impact**: Cannot create issues, PRs, or merge autonomously.

**Resolution**:
1. Create GitHub resolver vessel with:
   - `createIssue()`
   - `createPullRequest()`
   - `mergePullRequest()`
   - `getIssue()`
   - `getPullRequest()`
2. Register vessel with minibob
3. Add GitHub impulse types (issue, pr, commit)

**Time Estimate**: 4-6 hours

## Recommended Approach

### Phase 1: Quick Win - Basic Learning Demo (4-6 hours)

**Goal**: Demonstrate measurable learning improvement after 10 executions.

**Tasks**:
1. Register demo activities in canary (30 min)
2. Add automatic feedback recording (2-3 hours)
3. Create demo script for 10 iterations (1 hour)
4. Add metrics visualization (1 hour)
5. Test end-to-end (2 hours)

**Success Metric**: Show Thompson Sampling convergence and success rate improvement.

### Phase 2: Complete Loop 1 (3-4 hours)

**Goal**: Show impulse relevance learning.

**Tasks**:
1. Implement usage tracking in MiniBob (2 hours)
2. Send usage data to backend (1 hour)
3. Test relevance learning over 10 executions (1 hour)

**Success Metric**: Verify relevance scores adjust and low-relevance impulses get skipped.

### Phase 3: Complete Loop 3 Integration (6-8 hours)

**Goal**: Show automatic discovery learning.

**Tasks**:
1. Add discovery phase to goal processor (3 hours)
2. Integrate with Thompson Sampling (2 hours)
3. Test full loop (3 hours)

**Success Metric**: Verify low-value scans get skipped after learning.

### Phase 4: GitHub Integration (4-6 hours)

**Goal**: Enable full autonomous development workflow.

**Tasks**:
1. Create GitHub resolver vessel (3 hours)
2. Test issue/PR creation (1 hour)
3. Test full workflow: bug → issue → branch → fix → PR → merge (2 hours)

**Success Metric**: Complete autonomous development cycle without human intervention.

## Expected Outcomes

After completing all phases:

**Loop 1 (Impulse Flow)**:
- 5+ impulses discovered per execution
- Relevance scores range from 0.2 to 0.95
- High-relevance impulses loaded first
- Low-relevance impulses skipped after learning

**Loop 2 (External Validation)**:
- Thompson Sampling: α grows faster than β for successful activities
- Success rate: 50% → 90% over 10 executions
- 22 error types distinguished
- Weighted penalties applied appropriately

**Loop 3 (Discovery)**:
- 3-5 discovery activities run per execution initially
- Discovery time: 10s → 3s over 10 executions
- scan-file-system: α=10, β=0 (always useful)
- scan-git-history: α=2, β=8 (rarely useful, auto-skipped)

**Overall Improvement**:
- Execution time: 60s → 35s (42% faster)
- Cost per execution: $0.12 → $0.05 (58% cheaper)
- Success rate: 50% → 90% (80% improvement)
- Confidence: Low (cold start) → High (converged)

## Timeline

**Optimistic** (full-time work, no blockers): 2-3 days
- Day 1: Phases 1-2 (learning loops 1-2)
- Day 2: Phase 3 (discovery integration)
- Day 3: Phase 4 (GitHub integration)

**Realistic** (part-time work, some debugging): 1-2 weeks
- Week 1: Phases 1-2
- Week 2: Phases 3-4

**Conservative** (intermittent work, unknown issues): 2-4 weeks

## Next Steps

1. **Decision**: Which phase to prioritize?
   - Phase 1 (easiest, shows clear learning) - RECOMMENDED
   - Phase 2 (medium, shows context optimization)
   - Phase 3 (harder, shows autonomous discovery)
   - Phase 4 (GitHub integration for full autonomy)

2. **Registration**: Register demo activities in canary backend

3. **Validation**: Test each loop independently before integration

4. **Documentation**: Update as implementation progresses

## Conclusion

MiniBob has **strong foundations for autonomous CI/CD** with well-designed activities and a healthy backend. The **primary blockers are integration work** (10-20 hours total) rather than fundamental capability gaps.

The demo repository provides an **excellent blueprint** for what's possible. With focused implementation of the three learning loops and GitHub integration, MiniBob can achieve true autonomous development and upkeep over CI/CD.

**Recommendation**: Start with Phase 1 (Quick Win) to demonstrate immediate value, then proceed with remaining phases based on priority.
