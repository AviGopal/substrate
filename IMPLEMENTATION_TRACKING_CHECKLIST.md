# Activity System Implementation: Tracking Checklist

**Start Date**: ___________  
**Target Completion**: ___________ (4 weeks from start)  
**Assigned Engineers**: ___________

---

## Pre-Implementation (Day 0)

### Planning Approval
- [ ] Executive summary reviewed by tech lead
- [ ] 4-week timeline approved
- [ ] 13 engineer-day budget approved
- [ ] Engineers assigned to weeks 1-4
- [ ] GitHub issues created for each deliverable
- [ ] Project board set up with milestones
- [ ] Kickoff meeting scheduled

**Sign-off**: ___________ Date: ___________

---

## Week 1: Tool Simplification (4 engineer-days)

### Day 1-2: Audit Current State

#### Task 1.1: Inventory Activity Tools
- [ ] List all activity-related tools (10+)
- [ ] Document purpose of each tool
- [ ] Identify redundant tools
- [ ] Measure usage frequency (if metrics available)
- [ ] Create: `ACTIVITY_TOOLS_INVENTORY.md`

**Assigned**: ___________ **Completed**: ___________

#### Task 1.2: Measure Agent Behavior
- [ ] Analyze session logs for tool usage
- [ ] Count debug tool attempts (distraction indicator)
- [ ] Document typical tool call sequences
- [ ] Establish baseline metrics
- [ ] Create: `AGENT_BEHAVIOR_BASELINE.md`

**Assigned**: ___________ **Completed**: ___________

---

### Day 3-4: Hide Implementation Tools

#### Task 1.3: Create Tool Visibility Config
- [ ] Create: `src/agent/tool-registry.ts`
- [ ] Define TOOL_VISIBILITY.agent (2 tools)
- [ ] Define TOOL_VISIBILITY.developer (8 tools)
- [ ] Implement getToolsForAgent() function
- [ ] Add developer mode flag support

**Assigned**: ___________ **Completed**: ___________

#### Task 1.4: Update Agent Configuration
- [ ] Modify: `src/agent/agent.ts`
- [ ] Use getToolsForAgent() for tool loading
- [ ] Add includeDevTools config option
- [ ] Test agent creation with new config
- [ ] Verify only 2 tools visible by default

**Assigned**: ___________ **Completed**: ___________

#### Task 1.5: Update Tool Registry
- [ ] Modify: `src/tool/registry.ts`
- [ ] Add visibility metadata to registrations
- [ ] Update tool loading logic
- [ ] Mark developer tools appropriately
- [ ] Verify no tools broken

**Assigned**: ___________ **Completed**: ___________

---

### Day 5: Simplify Tool Descriptions

#### Task 1.6: Rewrite activity.txt
- [ ] Edit: `src/tool/activity.txt`
- [ ] Reduce from 37 to 25 lines
- [ ] Focus on WHAT/WHEN not HOW
- [ ] Keep example clear
- [ ] Remove implementation details

**Assigned**: ___________ **Completed**: ___________

#### Task 1.7: Rewrite search-activities.txt
- [ ] Edit: `src/tool/search-activities.txt`
- [ ] Reduce from 38 to 25 lines
- [ ] Focus on discovery workflow
- [ ] Clarify compact vs verbose
- [ ] Remove technical details

**Assigned**: ___________ **Completed**: ___________

---

### Week 1: Testing and Review

#### Week 1 Testing
- [ ] Run: `bun test` (all tests pass)
- [ ] Test: Agent tool visibility
- [ ] Test: Tool functionality unchanged
- [ ] Test: No regressions in existing workflows
- [ ] Measure: Tool description line count (target: ~50)

**Tester**: ___________ **Completed**: ___________

#### Week 1 Code Review
- [ ] PR created for Week 1 changes
- [ ] Code review completed
- [ ] Changes approved
- [ ] PR merged to main

**Reviewer**: ___________ **Completed**: ___________

### Week 1 Success Criteria

- [ ] ✅ 10+ tools reduced to 2 agent-visible
- [ ] ✅ 500+ lines reduced to 50 lines
- [ ] ✅ All tests passing
- [ ] ✅ No functionality broken
- [ ] ✅ Agent can search and execute activities

**Week 1 Sign-off**: ___________ Date: ___________

---

## Week 2: Documentation and Auto-Reporting (3 engineer-days)

### Day 6-7: Simplify AGENTS.md

#### Task 2.1: Audit Current AGENTS.md
- [ ] Count lines in activity section (500+)
- [ ] Identify content to remove
- [ ] Identify content to keep
- [ ] Draft new structure (~100 lines)

**Assigned**: ___________ **Completed**: ___________

#### Task 2.2: Rewrite Activity Section
- [ ] Edit: `AGENTS.md` (or `packages/opencode/AGENTS.md`)
- [ ] Reduce activity section to ~100 lines
- [ ] Focus on discovery and execution
- [ ] Add simple orchestration examples
- [ ] Remove template creation details
- [ ] Remove debugging workflows

**Assigned**: ___________ **Completed**: ___________

---

### Day 8-9: Implement Auto-Reporting

#### Task 2.3: Add Automatic Outcome Reporting
- [ ] Modify: `src/session/template-executor.ts`
- [ ] Implement reportOutcomeToMetabob() function
- [ ] Call after activity execution completes
- [ ] Use best-effort (log warnings, don't fail)
- [ ] Test with mock backend

**Assigned**: ___________ **Completed**: ___________

#### Task 2.4: Remove Manual Reporting Tool
- [ ] Modify: `src/tool/registry.ts`
- [ ] Remove PostActivityResultTool registration
- [ ] Add comment explaining removal
- [ ] Update any code calling post_activity_result
- [ ] Verify no references remain

**Assigned**: ___________ **Completed**: ___________

---

### Week 2: Testing and Review

#### Week 2 Testing
- [ ] Test: Auto-reporting works
- [ ] Test: Outcomes sent to backend
- [ ] Test: AGENTS.md clarity improved
- [ ] Test: No regressions
- [ ] Measure: AGENTS.md line count (target: ~100)

**Tester**: ___________ **Completed**: ___________

#### Week 2 Code Review
- [ ] PR created for Week 2 changes
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Changes approved
- [ ] PR merged to main

**Reviewer**: ___________ **Completed**: ___________

### Week 2 Success Criteria

- [ ] ✅ AGENTS.md activity section: 500+ → 100 lines
- [ ] ✅ Auto-reporting implemented and tested
- [ ] ✅ post_activity_result tool removed
- [ ] ✅ Agent instructions focused on usage
- [ ] ✅ All tests passing

**Week 2 Sign-off**: ___________ Date: ___________

---

## Week 3: Template Quality Improvement (4 engineer-days)

### Day 10-12: Enhanced Validation

#### Task 3.1: Create Validation Script
- [ ] Create: `scripts/validate-activity-template.sh`
- [ ] Implement JSON syntax validation
- [ ] Implement task count check (3-7)
- [ ] Implement "all tasks have validation" check
- [ ] Implement "all tasks have retry" check
- [ ] Implement dependency graph validation
- [ ] Make executable: `chmod +x`
- [ ] Test with valid templates (should pass)
- [ ] Test with invalid templates (should fail)

**Assigned**: ___________ **Completed**: ___________

#### Task 3.2: Update create-activity-template.json
- [ ] Edit: `templates/built-in/create-activity-template.json`
- [ ] Update version: 3 → 4
- [ ] Split Task 1 into 3 subtasks:
  - [ ] analyze-examples task created
  - [ ] design-task-graph task created
  - [ ] write-template-json task created
- [ ] Keep Task 2 (register-template) unchanged
- [ ] Update contextRequirements (better examples)
- [ ] Add validation script to commands
- [ ] Add enhanced validation patterns
- [ ] Update learning section with detailed metrics

**Assigned**: ___________ **Completed**: ___________

---

### Day 13-14: Testing and Refinement

#### Task 3.3: Create Test Suite
- [ ] Create: `test/session/create-activity-template-v4.test.ts`
- [ ] Test: Validates task count limit
- [ ] Test: Requires all tasks have validation
- [ ] Test: Validates dependency graph
- [ ] Test: Succeeds with well-formed template
- [ ] Test: Registration verification works
- [ ] All tests pass

**Assigned**: ___________ **Completed**: ___________

#### Task 3.4: Run Baseline Tests
- [ ] Execute 10 test runs with diverse variables
- [ ] Record success/failure for each
- [ ] Analyze failure modes
- [ ] Measure validation effectiveness
- [ ] Document results
- [ ] Calculate success rate
- [ ] Compare to target (80%+)

**Assigned**: ___________ **Completed**: ___________

---

### Week 3: Testing and Review

#### Week 3 Testing
- [ ] Run: All test suites pass
- [ ] Test: v4 template validates correctly
- [ ] Test: Validation script catches errors
- [ ] Test: No false rejections (<5%)
- [ ] Measure: Success rate from 10 executions

**Tester**: ___________ **Completed**: ___________

**Results**:
- Success rate: _____% (target: 80%+)
- False rejections: _____% (target: <5%)
- Average duration: _____ min (target: <25 min)

#### Week 3 Code Review
- [ ] PR created for Week 3 changes
- [ ] Code review completed
- [ ] Test results reviewed
- [ ] Success rate acceptable
- [ ] Changes approved
- [ ] PR merged to main

**Reviewer**: ___________ **Completed**: ___________

### Week 3 Success Criteria

- [ ] ✅ create-activity-template v4 created
- [ ] ✅ Validation script working
- [ ] ✅ 10 test executions completed
- [ ] ✅ Success rate >= 75% (stretch: 80%+)
- [ ] ✅ No false rejections >5%
- [ ] ✅ All tests passing

**Week 3 Sign-off**: ___________ Date: ___________

---

## Week 4: Deployment and Monitoring (2 engineer-days)

### Day 15-16: Staging Deployment

#### Task 4.1: Deploy to Staging
- [ ] Merge all PRs to main
- [ ] Build: `bun run build`
- [ ] Deploy to staging environment
- [ ] Verify deployment successful
- [ ] Smoke test basic functionality

**Assigned**: ___________ **Completed**: ___________

#### Task 4.2: Set Up Monitoring Scripts
- [ ] Create: `scripts/monitor-activity-success.ts`
- [ ] Create: `scripts/compare-template-variants.ts`
- [ ] Test scripts locally
- [ ] Deploy scripts to staging
- [ ] Run initial monitoring check

**Assigned**: ___________ **Completed**: ___________

#### Task 4.3: 48-Hour Monitoring
- [ ] Monitor staging for 48 hours
- [ ] Check for errors every 6 hours
- [ ] Run: `monitor-activity-success.ts` daily
- [ ] Document any issues
- [ ] No critical issues found

**Assigned**: ___________ **Completed**: ___________

---

### Day 17-18: Baseline Data Collection

#### Task 4.4: Run Baseline Executions
- [ ] Run 20 test executions of create-activity-template
- [ ] Use diverse variable combinations
- [ ] Record all outcomes
- [ ] Calculate success rate
- [ ] Compare v3 vs v4 performance
- [ ] Document results

**Assigned**: ___________ **Completed**: ___________

**Results**:
- v3 success rate: _____% (historical)
- v4 success rate: _____% (new)
- Improvement: _____% (target: +15%+)

---

### Day 19-20: Production Deployment

#### Task 4.5: Deploy to Production
- [ ] Review staging results (all green)
- [ ] Get final approval for production
- [ ] Tag release: `git tag vX.Y.Z-activity-improvements`
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Smoke test production

**Assigned**: ___________ **Completed**: ___________

#### Task 4.6: Set Up Continuous Monitoring
- [ ] Schedule: `monitor-activity-success.ts` every 6 hours
- [ ] Schedule: Weekly success rate report
- [ ] Set up alerts for success rate drops
- [ ] Document monitoring procedures
- [ ] Notify team of deployment

**Assigned**: ___________ **Completed**: ___________

---

### Week 4: Post-Deployment Validation

#### Week 4 Validation
- [ ] Production running for 48 hours
- [ ] No critical issues
- [ ] Agent tool calls reduced (measured)
- [ ] Success rates stable or improved
- [ ] Monitoring dashboard functional

**Validator**: ___________ **Completed**: ___________

### Week 4 Success Criteria

- [ ] ✅ Deployed to production
- [ ] ✅ Monitoring active (6-hour intervals)
- [ ] ✅ 20+ baseline executions collected
- [ ] ✅ v4 success rate >= 75%
- [ ] ✅ No regressions in other templates
- [ ] ✅ Agent behavior improved

**Week 4 Sign-off**: ___________ Date: ___________

---

## Post-Launch Tracking (Month 2-6)

### Month 1 Checkpoints

**Week 5**:
- [ ] Collect 50+ executions total
- [ ] Monitor success rates
- [ ] No production issues

**Week 6**:
- [ ] Run: `compare-template-variants.ts`
- [ ] v4 vs v3 comparison
- [ ] Document trends

**Week 7**:
- [ ] Analyze failure patterns
- [ ] Identify optimization opportunities
- [ ] No urgent issues

**Week 8**:
- [ ] Month 1 review meeting
- [ ] Decide: Keep v4, rollback, or iterate
- [ ] Plan Month 2 activities

**Month 1 Sign-off**: ___________ Date: ___________

---

### Month 2-3: Thompson Sampling Validation

- [ ] Week 9: 75+ executions collected
- [ ] Week 10: Thompson Sampling data analyzed
- [ ] Week 11: Variant trends emerging
- [ ] Week 12: 100+ executions milestone
- [ ] Month 3 review: Winner determination

**Month 3 Results**:
- v3 success rate: _____%
- v4 success rate: _____%
- Winner: v___
- Decision: ___________

**Month 3 Sign-off**: ___________ Date: ___________

---

### Month 4-6: Optimization Phase

- [ ] Month 4: Automated evolution pipeline designed
- [ ] Month 5: First automated variant created
- [ ] Month 6: System-wide metrics review
- [ ] ROI calculation: Actual vs projected

**Month 6 Final Results**:
- Overall template success rates: _____%
- Agent productivity improvement: _____%
- Cost savings: $_____
- ROI achieved: _____%

**Project Sign-off**: ___________ Date: ___________

---

## Issue Tracking

### Week 1 Issues

| Issue | Severity | Description | Assigned | Status | Resolution |
|-------|----------|-------------|----------|--------|------------|
| #1 | | | | | |
| #2 | | | | | |

### Week 2 Issues

| Issue | Severity | Description | Assigned | Status | Resolution |
|-------|----------|-------------|----------|--------|------------|
| #1 | | | | | |
| #2 | | | | | |

### Week 3 Issues

| Issue | Severity | Description | Assigned | Status | Resolution |
|-------|----------|-------------|----------|--------|------------|
| #1 | | | | | |
| #2 | | | | | |

### Week 4 Issues

| Issue | Severity | Description | Assigned | Status | Resolution |
|-------|----------|-------------|----------|--------|------------|
| #1 | | | | | |
| #2 | | | | | |

---

## Rollback Tracking

### Rollback Triggers

- [ ] Critical production issue
- [ ] Success rate drops >20%
- [ ] Agent errors increase >50%
- [ ] Stakeholder decision

**If rollback needed**:

1. **Immediate Actions**:
   - [ ] Notify team
   - [ ] Execute rollback procedure
   - [ ] Verify production stable
   - [ ] Document issue

2. **Root Cause Analysis**:
   - [ ] Identify what went wrong
   - [ ] Document lessons learned
   - [ ] Plan corrective actions
   - [ ] Schedule re-attempt

---

## Communications Log

### Week 1
- **Date**: ___________ **Channel**: ___________
  - **Message**: Tool simplification started
  - **Audience**: Engineering team

### Week 2
- **Date**: ___________ **Channel**: ___________
  - **Message**: Documentation simplified, auto-reporting live
  - **Audience**: All users

### Week 3
- **Date**: ___________ **Channel**: ___________
  - **Message**: Template quality improvements, testing phase
  - **Audience**: QA + data science

### Week 4
- **Date**: ___________ **Channel**: ___________
  - **Message**: Production deployment, monitoring active
  - **Audience**: All stakeholders

### Month 3
- **Date**: ___________ **Channel**: ___________
  - **Message**: 3-month results, Thompson Sampling winner
  - **Audience**: Leadership + all stakeholders

---

## Success Metrics Tracking

### Week 1 Metrics

| Metric | Before | After | Target | ✓/✗ |
|--------|--------|-------|--------|-----|
| Agent-visible tools | 10+ | ____ | 2 | |
| Tool description lines | 500+ | ____ | 50 | |
| Tests passing | ✓ | ____ | ✓ | |

### Week 2 Metrics

| Metric | Before | After | Target | ✓/✗ |
|--------|--------|-------|--------|-----|
| AGENTS.md activity lines | 500+ | ____ | 100 | |
| Auto-reporting | Manual | ____ | Auto | |
| Agent clarity | Low | ____ | High | |

### Week 3 Metrics

| Metric | Before | After | Target | ✓/✗ |
|--------|--------|-------|--------|-----|
| create-template success | 65% | ____% | 80% | |
| Schema errors caught | 0% | ____% | 90% | |
| False rejections | N/A | ____% | <5% | |

### Week 4 Metrics

| Metric | Staging | Production | Target | ✓/✗ |
|--------|---------|------------|--------|-----|
| Deployment success | ____ | ____ | ✓ | |
| 48hr stability | ____ | ____ | ✓ | |
| Monitoring active | ____ | ____ | ✓ | |

### Month 3 Metrics

| Metric | Actual | Target | ✓/✗ |
|--------|--------|--------|-----|
| v4 success rate | ____% | 80% | |
| Thompson winner | v___ | v4 | |
| Agent tool calls | ____ | 2 | |
| Productivity gain | ____% | +30% | |

---

## Budget Tracking

### Engineering Time

| Week | Planned | Actual | Notes |
|------|---------|--------|-------|
| Week 1 | 4 days | ____ days | |
| Week 2 | 3 days | ____ days | |
| Week 3 | 4 days | ____ days | |
| Week 4 | 2 days | ____ days | |
| **Total** | **13 days** | **____ days** | |

### Costs

| Item | Budgeted | Actual | Notes |
|------|----------|--------|-------|
| Engineering time | $10,400 | $____ | |
| Testing API costs | $200 | $____ | |
| Infrastructure | $0 | $____ | |
| **Total** | **$10,600** | **$____** | |

---

## Final Approval

### Implementation Complete

- [ ] All 4 weeks completed
- [ ] All success criteria met
- [ ] Production stable for 2 weeks
- [ ] Monitoring in place
- [ ] Team trained
- [ ] Documentation updated

**Project Manager Sign-off**: ___________ Date: ___________

**Tech Lead Sign-off**: ___________ Date: ___________

### Post-Launch Plan Approved

- [ ] Month 2-6 monitoring schedule set
- [ ] Automated evolution pipeline planned
- [ ] Team assigned to ongoing optimization
- [ ] Budget approved for long-term improvements

**Stakeholder Sign-off**: ___________ Date: ___________

---

## Notes and Comments

### Week 1 Notes

_____________________________________________

### Week 2 Notes

_____________________________________________

### Week 3 Notes

_____________________________________________

### Week 4 Notes

_____________________________________________

### Lessons Learned

_____________________________________________

### Recommendations for Next Time

_____________________________________________
