# MiniBob Readiness Plan
## Goal: Prepare MiniBob for Self-Modifying Dashboard Work

Based on validation results from `validate-minibob-readiness.ts`

---

## Current Status: **NOT READY**

### Metrics
- **Templates with data**: 4 / 50 (need ≥10)
- **Medium activity success**: 33.3% (need 85%)
- **Broken templates**: 2 with 0% success rate
- **Overall readiness**: ❌ Failed validation

---

## Phase 1: Stabilize Core Activities (Week 1)

### Goal: Get 10+ templates with ≥85% success rate

#### 1.1 Debug Failing Templates
**Priority: HIGH**

Investigate the 2 templates with 0% success:
- "Comprehensive Activity Template Validation System" (11 runs, 0% success)
- "Debug Low Success Rate Template" (23 runs, 0% success)

**Tasks:**
- [ ] Read execution traces for these templates
- [ ] Identify common failure patterns
- [ ] Fix validation logic if broken
- [ ] Fix prompt engineering if LLM misunderstands
- [ ] Re-run and verify fixes work

**Success criteria**: Both templates achieve >50% success rate OR are deprecated

#### 1.2 Identify High-Value Simple Activities
**Priority: HIGH**

We need simple, high-reliability templates for dashboard work:
- Read file and summarize
- Write new file from template
- Edit specific lines in file
- Create new React component
- Update imports in file

**Tasks:**
- [ ] Create 5 simple activity templates for common operations
- [ ] Test each template 10 times on known-good scenarios
- [ ] Target: >95% success rate for all simple templates

**Success criteria**: 5 simple templates with >95% success, ≥10 runs each

#### 1.3 Improve Medium Complexity Templates
**Priority: MEDIUM**

Current medium templates are at 33.3% success. Need to understand why.

**Tasks:**
- [ ] Query execution traces for the 3 medium templates
- [ ] Categorize failures: validation errors vs LLM errors vs tool errors
- [ ] Fix top 3 failure modes
- [ ] Re-test templates

**Success criteria**: Medium template success rate >70%

---

## Phase 2: Build Statistical Confidence (Week 2)

### Goal: 20+ templates with sufficient execution data

#### 2.1 Enable Boredom Activities
**Priority: MEDIUM**

Let MiniBob run autonomous activities when idle to build execution data.

**Tasks:**
- [ ] Configure boredom threshold (5 minutes idle)
- [ ] Set boredom activity budget (max cost per day)
- [ ] Monitor boredom activity execution
- [ ] Ensure boredom doesn't break anything (git safety)

**Success criteria**: 50+ automated executions per day, no codebase corruption

#### 2.2 Create Curated Test Scenarios
**Priority: HIGH**

Build a test suite of known-good scenarios to validate templates.

**Tasks:**
- [ ] Create test workspace with sample codebase
- [ ] Define 10 common scenarios (add feature, fix bug, refactor)
- [ ] Run each template against appropriate scenarios
- [ ] Measure success rates

**Success criteria**: All templates tested on ≥3 scenarios each

---

## Phase 3: Safety Mechanisms (Week 2-3)

### Goal: Ensure failures don't break the codebase

#### 3.1 Git Safety Guardrails
**Priority: CRITICAL**

Before attempting self-modification, ensure rollback capability.

**Tasks:**
- [ ] Implement automatic git commit before activity execution
- [ ] Add git status validation after execution
- [ ] Create automatic rollback on validation failure
- [ ] Test rollback mechanism

**Success criteria**: 100% of failed activities can be rolled back cleanly

#### 3.2 Validation Strengthening
**Priority: HIGH**

Current validation may be too weak if templates are failing.

**Tasks:**
- [ ] Review validation logic in all templates
- [ ] Add required file existence checks
- [ ] Add pattern matching for expected code
- [ ] Add forbidden pattern checks for anti-patterns
- [ ] Test validation catches known bad outputs

**Success criteria**: Validation catches >90% of LLM mistakes before commit

#### 3.3 Dry-Run Mode
**Priority: MEDIUM**

Allow testing activities without modifying files.

**Tasks:**
- [ ] Add `--dry-run` flag to activity executor
- [ ] Show what would change without writing files
- [ ] Allow user approval before actual execution

**Success criteria**: Dry-run mode works for all templates

---

## Phase 4: Self-Modification Readiness (Week 3-4)

### Goal: Validate on non-critical codebase before dashboard

#### 4.1 Test on Isolated Codebase
**Priority: HIGH**

Don't start with the dashboard. Test on throwaway code first.

**Tasks:**
- [ ] Create test React application (similar to dashboard)
- [ ] Run 20+ self-modification activities on test app
- [ ] Measure: success rate, code quality, stability
- [ ] Identify failure modes specific to self-modification

**Success criteria**: >85% success rate on self-modification of test app

#### 4.2 Incremental Self-Modification
**Priority: MEDIUM**

Start with trivial changes, build up complexity.

**Progression:**
1. Change CSS color values (trivial)
2. Add new UI component from template (simple)
3. Modify existing component behavior (medium)
4. Add new feature with multiple file changes (complex)

**Tasks:**
- [ ] Execute 5 trivial modifications
- [ ] Execute 5 simple modifications
- [ ] Execute 3 medium modifications
- [ ] Execute 1 complex modification
- [ ] Verify all work correctly

**Success criteria**: 80%+ success across all complexity levels

#### 4.3 Final Readiness Validation
**Priority: CRITICAL**

Run validation script again and verify all criteria met.

**Tasks:**
- [ ] Run `validate-minibob-readiness.ts`
- [ ] Verify: ≥10 templates with sufficient data
- [ ] Verify: Simple >95%, Medium >85%, Complex >70%
- [ ] Verify: No templates with 0% success rate
- [ ] Review and address any remaining recommendations

**Success criteria**: Validation script exits with status 0 (ready)

---

## Phase 5: Dashboard Self-Modification (Week 4+)

### Goal: Enable dashboard to modify itself via MiniBob

**Prerequisites (all must be met):**
- ✅ Readiness validation passes
- ✅ Git safety mechanisms tested
- ✅ Validation catches bad outputs
- ✅ Successful test on isolated codebase
- ✅ User understands risks and benefits

#### 5.1 Instrument Dashboard with MiniBob Library
- [ ] Add MiniBob as dependency
- [ ] Create dashboard-specific activity templates
- [ ] Add UI for triggering self-modification
- [ ] Configure git safety for dashboard code

#### 5.2 First Self-Modification
- [ ] User requests trivial change (e.g., "change header color")
- [ ] Dashboard creates impulses, gets recommendation
- [ ] Execute activity with user approval
- [ ] Verify hot-reload works
- [ ] Celebrate success!

---

## Monitoring During Readiness Phase

### Daily Checks
```bash
# Run validation
bun run validate-minibob-readiness.ts

# Check for broken templates
curl "http://api.minibob.local/v2/activities/templates" | \
  jq '.templates[] | select(.metrics.success_rate < 0.5) | {name: .variant_name, rate: .metrics.success_rate}'

# Monitor execution volume
curl "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[].metrics.total_executions] | add'
```

### Weekly Review
- Review top performers and problem templates
- Analyze failure patterns from traces
- Adjust templates based on learnings
- Update readiness criteria if needed

---

## Success Metrics

### Week 1
- [ ] 0 templates with 0% success rate
- [ ] 5 simple templates with >95% success
- [ ] Medium template avg >70%

### Week 2
- [ ] ≥10 templates with ≥10 executions each
- [ ] ≥20 templates with ≥5 executions each
- [ ] Git rollback tested and working

### Week 3
- [ ] Validation script passes (exit code 0)
- [ ] Test app successfully self-modifies
- [ ] No codebase corruption in 100+ activities

### Week 4
- [ ] Dashboard instrumented with MiniBob
- [ ] First successful self-modification
- [ ] Execution visible in dashboard metrics

---

## Risk Mitigation

### Risk: Activities break the codebase
**Mitigation:** Git commits before/after, automatic rollback, validation

### Risk: LLM produces insecure code
**Mitigation:** Validation includes security checks, code review on new templates

### Risk: Cost spirals out of control
**Mitigation:** Daily cost limits, monitoring, require approval for >$5 activities

### Risk: Templates never stabilize
**Mitigation:** Analyze failure patterns, improve prompts iteratively, deprecate broken templates

---

## Next Steps

Run these commands to begin Phase 1:

```bash
# Check current status
bun run validate-minibob-readiness.ts

# Query failing templates
curl "http://api.minibob.local/v2/activities/templates" | \
  jq '.templates[] | select(.metrics.success_rate == 0)'

# Get execution traces for debugging
curl "http://api.minibob.local/v2/activities/execution-traces?variant_id=<id>&limit=10"
```

Then proceed with 1.1: Debug Failing Templates.
