# Reliability Roadmap: Toward Proven Autonomous Closed-Loop

**Goal:** Achieve continuous autonomous development with validated closed-loop (OpenSpec ↔ MiniBob)
**Current Status:** Phase 0 - Design documented, nothing operational
**Last Updated:** 2026-03-23

## Reality Check

**What Works Today:**
- ✅ Activity execution (standard templates)
- ✅ Execution trace capture
- ✅ Thompson Sampling recommendations
- ✅ Goal-seeking (GoalProcessor)
- ✅ Basic impulse resolution
- ✅ Backend storage and learning

**What Doesn't Work:**
- ❌ OpenSpec → Activity compilation
- ❌ Spec compliance validation
- ❌ Automatic realignment
- ❌ Continuous closed-loop
- ❌ Proven autonomous improvement (1+ month)

**Honest Assessment:** 0/6 phases complete toward closed-loop reliability.

## The Six Phases

### Phase 0: Documentation ✅ COMPLETE

**Goal:** Design the closed-loop architecture and define roadmap.

**Deliverables:**
- ✅ `closed-loop-architecture.md` - Six-phase design
- ✅ `reliability-roadmap.md` - This document
- ✅ `meta-activities-catalog.md` - Meta-activity status
- ✅ `validation-contracts.md` - OpenSpec format
- ✅ `domain-mappings.md` - Domain applications
- ✅ `goal-seeking-architecture.md` - Goal execution
- ✅ `ideogram-catalog.md` - Philosophical foundation

**Status:** ✅ COMPLETE (2026-03-23)

**Go/No-Go Decision:** PROCEED to Phase 1

---

### Phase 1: Prove Compilation Pattern 🔜 NEXT

**Goal:** Implement `compile-spec-to-activity` and prove spec → template → execution works.

**Duration Estimate:** 2 weeks

**Success Criteria:**
1. ✅ Meta-activity `compile-spec-to-activity.json` exists
2. ✅ Can compile simple OpenSpec to working activity template
3. ✅ Compiled template executes successfully
4. ✅ Execution matches spec requirements
5. ✅ Cost/duration under thresholds

**Tasks:**

**Week 1: Create Meta-Activity**
- [ ] Define OpenSpec minimal format (functional requirements only)
- [ ] Write `compile-spec-to-activity.json` template
- [ ] Implement spec parser (extract requirements)
- [ ] Generate task sequence from requirements
- [ ] Write template to `templates/compiled/{{id}}.json`

**Week 2: Validate Pattern**
- [ ] Create test spec: "Add hello endpoint to API"
- [ ] Compile spec → template
- [ ] Execute compiled template
- [ ] Verify endpoint works (call it, get response)
- [ ] Measure cost/duration
- [ ] Document results

**Example Test Spec:**
```markdown
# OpenSpec: Hello Endpoint

## Functional Requirements
- [ ] Add GET /hello endpoint to src/index.ts
- [ ] Endpoint returns JSON: {"message": "Hello, World!"}
- [ ] Endpoint responds with status 200

## Performance Requirements
- Implementation cost: < $0.50
- Implementation time: < 5 minutes

## Validation
- Manual test: curl http://localhost:8080/hello
- Expected response: {"message": "Hello, World!"}
```

**Expected Compiled Template:**
```json
{
  "id": "implement-hello-endpoint",
  "category": "feature",
  "metadata": {
    "compiledFrom": "specs/hello-endpoint.md",
    "compiledAt": "2026-03-23T10:00:00Z"
  },
  "tasks": [
    {
      "id": "add-endpoint",
      "prompt": {
        "template": "Add GET /hello endpoint to src/index.ts returning {\"message\": \"Hello, World!\"}"
      },
      "validation": {
        "requiredFiles": ["src/index.ts"],
        "requiredPatterns": ["/hello", "Hello, World!"]
      }
    }
  ]
}
```

**Go/No-Go Criteria:**
- ✅ GO: Compiled template works, endpoint responds correctly
- ❌ NO-GO: Template fails to compile, execution fails, or endpoint doesn't work
  - If NO-GO: Revise spec format, simplify compilation, try again

**Risks:**
- Spec format too rigid (hard to parse)
- Generated tasks too vague (LLM confused)
- Validation criteria too strict (false negatives)

**Mitigations:**
- Start with simplest possible spec
- Use proven prompt patterns from existing templates
- Manual validation first, automate later

---

### Phase 2: Manual Closed-Loop Cycle ❌ NOT STARTED

**Goal:** Execute one complete closed-loop manually (spec → compile → execute → validate → realign).

**Duration Estimate:** 3 weeks

**Success Criteria:**
1. ✅ One spec compiles to template
2. ✅ Template executes successfully
3. ✅ Runtime behavior observed and captured
4. ✅ Manual validation: spec vs runtime comparison
5. ✅ Manual realignment: fix or update spec
6. ✅ Re-validation passes

**Tasks:**

**Week 1: Implement Observation**
- [ ] Create `observe-runtime.json` meta-activity
- [ ] Extract observable state from execution trace
- [ ] Structure state for validation (files, tests, metrics)
- [ ] Test on Phase 1 hello endpoint execution

**Week 2: Manual Validation**
- [ ] Load spec and observable state manually
- [ ] Compare functional requirements (checklist)
- [ ] Compare performance metrics (cost, duration)
- [ ] Document drift measurements
- [ ] Create compliance report (manual)

**Week 3: Manual Realignment**
- [ ] Identify drift causes (what went wrong)
- [ ] Choose strategy: fix implementation or update spec
- [ ] Execute fix manually (modify code or spec)
- [ ] Re-run execution
- [ ] Re-validate (confirm compliance)

**Example Manual Validation:**
```
Spec: "GET /hello returns {\"message\": \"Hello, World!\"}"

Runtime observation:
- GET /hello exists ✅
- Returns {"message": "Hello, World!"} ✅
- Status 200 ✅
- Cost: $0.35 ✅ (under $0.50 threshold)
- Duration: 3 minutes ✅ (under 5 minutes)

Result: PASS (no drift)
```

**Example Drift Scenario:**
```
Spec: "Response time < 100ms"

Runtime observation:
- Endpoint responds in 150ms ❌

Drift: 50% (150ms vs 100ms expected)

Realignment options:
1. Fix implementation: Optimize endpoint code
2. Update spec: Increase threshold to 200ms
3. Accept drift: 50% within tolerance (NO - too high)

Decision: Fix implementation
Action: Add caching to reduce response time
Result: Re-test shows 80ms ✅
```

**Go/No-Go Criteria:**
- ✅ GO: One full cycle completes, realignment works
- ❌ NO-GO: Validation too complex, realignment fails
  - If NO-GO: Simplify validation, try smaller spec

**Risks:**
- Manual process too tedious (won't scale)
- Drift detection ambiguous (what counts as drift?)
- Realignment decisions subjective (fix vs update)

**Mitigations:**
- Document manual process clearly (guide automation)
- Define objective drift metrics (numbers, not judgment)
- Use heuristics for realignment decisions (cost, severity)

---

### Phase 3: Automatic Validation ❌ NOT STARTED

**Goal:** Automate validation (spec vs runtime comparison).

**Duration Estimate:** 3 weeks

**Success Criteria:**
1. ✅ `validate-spec-compliance.json` meta-activity works
2. ✅ Automated functional requirement checking
3. ✅ Automated performance threshold checking
4. ✅ Compliance report generated automatically
5. ✅ Drift metrics calculated objectively

**Tasks:**

**Week 1: Implement Validation Meta-Activity**
- [ ] Create `validate-spec-compliance.json`
- [ ] Parse spec format (extract requirements)
- [ ] Load observable state (execution trace)
- [ ] Compare functional requirements (pattern matching)

**Week 2: Performance Validation**
- [ ] Extract performance thresholds from spec
- [ ] Compare runtime metrics (cost, duration, memory)
- [ ] Calculate drift percentage
- [ ] Classify: PASS, FAIL, or DRIFT

**Week 3: Compliance Reporting**
- [ ] Generate structured compliance report
- [ ] Include violation details
- [ ] Add realignment recommendations
- [ ] Store reports in backend (new endpoint)

**Example Automated Validation:**
```json
{
  "specRequirements": [
    {"type": "functional", "description": "GET /hello exists", "pattern": "get.*\\/hello"},
    {"type": "functional", "description": "Returns Hello, World!", "pattern": "Hello, World!"},
    {"type": "performance", "metric": "cost", "threshold": 0.50, "operator": "<"},
    {"type": "performance", "metric": "duration", "threshold": 300000, "operator": "<"}
  ],
  "runtimeState": {
    "filesModified": ["src/index.ts"],
    "patterns": ["get('/hello'", "Hello, World!"],
    "metrics": {"cost": 0.35, "duration": 180000}
  },
  "complianceResult": {
    "status": "PASS",
    "functional": [
      {"requirement": "GET /hello exists", "met": true},
      {"requirement": "Returns Hello, World!", "met": true}
    ],
    "performance": [
      {"metric": "cost", "expected": "<0.50", "actual": 0.35, "drift": -30},
      {"metric": "duration", "expected": "<300000", "actual": 180000, "drift": -40}
    ]
  }
}
```

**Go/No-Go Criteria:**
- ✅ GO: Validation runs automatically, reports are accurate
- ❌ NO-GO: Too many false positives/negatives
  - If NO-GO: Refine pattern matching, adjust thresholds

**Risks:**
- Pattern matching too brittle (false negatives)
- Thresholds too strict (false positives)
- Report format not useful (can't guide realignment)

**Mitigations:**
- Use fuzzy matching where appropriate
- Provide threshold ranges, not exact values
- Include actionable recommendations in reports

---

### Phase 4: Automatic Realignment ❌ NOT STARTED

**Goal:** Automate realignment (fix implementation or update spec).

**Duration Estimate:** 4 weeks

**Success Criteria:**
1. ✅ `execute-realignment.json` meta-activity works
2. ✅ Automatic strategy selection (fix vs update vs accept)
3. ✅ Implementation fixes generate code changes
4. ✅ Spec updates modify requirements
5. ✅ Re-validation confirms compliance

**Tasks:**

**Week 1: Strategy Selection**
- [ ] Load compliance report
- [ ] Analyze drift severity and causes
- [ ] Apply decision heuristics:
  - High drift + implementation bug → Fix implementation
  - Low drift + unrealistic spec → Update spec
  - Very low drift → Accept drift
- [ ] Output chosen strategy

**Week 2: Implementation Fixes**
- [ ] Generate fix activity from compliance report
- [ ] Execute fix (modify code)
- [ ] Re-run validation
- [ ] Measure improvement

**Week 3: Spec Updates**
- [ ] Generate spec update from drift data
- [ ] Modify requirements or thresholds
- [ ] Version spec (track changes)
- [ ] Re-validate (should pass)

**Week 4: Integration and Testing**
- [ ] Test full realignment loop
- [ ] Try multiple drift scenarios
- [ ] Measure realignment success rate
- [ ] Document failure modes

**Decision Heuristics:**
```typescript
function selectRealignmentStrategy(report: ComplianceReport) {
  if (report.status === "PASS") {
    return "accept" // No action needed
  }

  if (report.status === "FAIL") {
    // Critical failure: fix implementation
    return "fix_implementation"
  }

  if (report.status === "DRIFT") {
    const avgDrift = calculateAverageDrift(report)

    if (avgDrift > 30) {
      // High drift: likely implementation bug
      return "fix_implementation"
    } else if (avgDrift > 10) {
      // Medium drift: check if spec is realistic
      if (isSpecUnrealistic(report)) {
        return "update_spec"
      } else {
        return "fix_implementation"
      }
    } else {
      // Low drift: within tolerance
      return "accept"
    }
  }
}
```

**Go/No-Go Criteria:**
- ✅ GO: Realignment succeeds >70% of time, re-validation passes
- ❌ NO-GO: Realignment fails frequently, creates new problems
  - If NO-GO: Simplify decision logic, require human approval

**Risks:**
- Automatic fixes introduce new bugs
- Spec updates lose important constraints
- Infinite loop (fix → drift → fix → drift)

**Mitigations:**
- Limit realignment attempts (max 3 per cycle)
- Require validation to pass before accepting fix
- Track realignment history (prevent loops)
- Manual approval for spec updates

---

### Phase 5: Continuous Autonomous Loop ❌ NOT STARTED

**Goal:** Run closed-loop continuously without human intervention.

**Duration Estimate:** 4 weeks

**Success Criteria:**
1. ✅ System executes full loop automatically
2. ✅ Handles multiple specs concurrently
3. ✅ Self-corrects from failures
4. ✅ Metrics show improvement over time
5. ✅ Runs for 1 week without critical failures

**Tasks:**

**Week 1: Orchestration**
- [ ] Create orchestration loop (plan → compile → execute → validate → realign)
- [ ] Handle phase failures gracefully
- [ ] Queue management for multiple specs
- [ ] Resource allocation (cost/token budgets)

**Week 2: Error Recovery**
- [ ] Detect stuck loops (no progress)
- [ ] Rollback failed realignments
- [ ] Variant creation on persistent failures
- [ ] Alert mechanisms for critical issues

**Week 3: Multi-Spec Coordination**
- [ ] Prioritize specs (importance, urgency)
- [ ] Share learnings across specs (template reuse)
- [ ] Avoid conflicts (concurrent edits)
- [ ] Load balancing (distribute work)

**Week 4: Observability**
- [ ] Dashboard for closed-loop status
- [ ] Metrics: cycle time, success rate, drift trends
- [ ] Alerts for anomalies
- [ ] Historical tracking (improvement over time)

**Orchestration Loop:**
```typescript
async function continuousClosedLoop() {
  while (true) {
    // Get next spec to process
    const spec = await getNextSpec()
    if (!spec) {
      await sleep(60000) // Wait 1 minute
      continue
    }

    try {
      // Phase 2: Compile spec to activity
      const template = await compileSpecToActivity(spec)

      // Phase 3: Execute activity
      const execution = await executeActivity(template)

      // Phase 4: Observe runtime
      const state = await observeRuntime(execution)

      // Phase 5: Validate compliance
      const report = await validateCompliance(spec, state)

      // Phase 6: Realign if needed
      if (report.status !== "PASS") {
        await executeRealignment(report)
      }

      // Track success
      await recordCycleCompletion(spec, report)

    } catch (error) {
      // Handle failure
      await handleCycleFailure(spec, error)
    }
  }
}
```

**Go/No-Go Criteria:**
- ✅ GO: Runs for 1 week, >80% cycle success rate, no catastrophic failures
- ❌ NO-GO: Frequent crashes, low success rate, manual intervention needed
  - If NO-GO: Identify failure modes, add safeguards, try again

**Risks:**
- System degrades over time (drift accumulates)
- Resource exhaustion (runaway costs)
- Catastrophic failures (breaks critical code)

**Mitigations:**
- Health monitoring (automatic shutdown if degrading)
- Cost limits (daily/weekly budgets)
- Sandboxing (test changes before applying)
- Rollback capability (restore previous state)

---

### Phase 6: Proven Lift-Off ❌ NOT STARTED

**Goal:** Demonstrate 1 month of continuous autonomous improvement.

**Duration Estimate:** 4+ weeks (plus monitoring)

**Success Criteria:**
1. ✅ Runs continuously for 30 days
2. ✅ Success rate >80% across all cycles
3. ✅ Drift decreases over time (learning works)
4. ✅ Cost/duration improves (efficiency gains)
5. ✅ Zero critical failures (no broken production code)
6. ✅ Template library grows (new patterns extracted)

**Tasks:**

**Week 1-4: Continuous Operation**
- [ ] Run system 24/7
- [ ] Monitor all metrics
- [ ] Respond to alerts only (no proactive intervention)
- [ ] Collect data for analysis

**End of Month: Analysis**
- [ ] Calculate success rates by phase
- [ ] Measure drift trends (decreasing?)
- [ ] Assess cost efficiency (improving?)
- [ ] Review template library growth
- [ ] Identify failure modes
- [ ] Document learnings

**Metrics to Track:**

**Cycle-Level:**
- Cycles completed per day
- Success rate per phase
- Average cycle time (end-to-end)
- Cost per cycle
- Realignment frequency

**System-Level:**
- Cumulative specs processed
- Template library size
- Drift rate over time
- Learning effectiveness (Thompson Sampling convergence)
- Error recovery rate

**Quality Indicators:**
- Zero critical bugs introduced
- No production downtime
- Improving metrics week-over-week
- Decreasing manual intervention

**Go/No-Go Criteria:**
- ✅ GO: All criteria met, system is reliable
- ❌ NO-GO: <80% success, critical failures, or degradation
  - If NO-GO: Analyze root causes, extend timeline, try again

**Success Looks Like:**
```
30-Day Summary:
- Total cycles: 450
- Success rate: 87%
- Average cycle time: 15 minutes (down from 25 at start)
- Average cost: $0.42 (down from $0.68 at start)
- Realignments: 42 (9% of cycles)
- Template library: 35 new templates extracted
- Critical failures: 0
- Drift trend: Decreasing (15% → 8% over month)
- Manual interventions: 2 (both for edge cases)

Verdict: PROVEN AUTONOMOUS CLOSED-LOOP ✅
```

---

## Overall Timeline

**Optimistic:** 16 weeks (~4 months)
**Realistic:** 24 weeks (~6 months)
**Conservative:** 36 weeks (~9 months)

**Breakdown:**
- Phase 0: ✅ 1 week (complete)
- Phase 1: 2 weeks
- Phase 2: 3 weeks
- Phase 3: 3 weeks
- Phase 4: 4 weeks
- Phase 5: 4 weeks
- Phase 6: 4+ weeks

**Buffer:** 25% (6 weeks) for unexpected issues

## Critical Dependencies

**Technical:**
1. MiniBob execution stability (current: good)
2. Backend Thompson Sampling (current: working)
3. LLM reliability (current: variable)
4. OpenSpec format standardization (current: undefined)

**Organizational:**
1. Dedicated development time
2. Budget for LLM costs (~$500-1000/month estimated)
3. Monitoring infrastructure
4. Incident response process

## Decision Points

### After Phase 1
**Question:** Does compilation pattern work?
- ✅ Yes → Proceed to Phase 2
- ❌ No → Revise spec format, try simpler approach

### After Phase 2
**Question:** Can we validate and realign manually?
- ✅ Yes → Automate (Phase 3-4)
- ❌ No → Simplify specs, reduce scope

### After Phase 4
**Question:** Does automatic realignment work reliably?
- ✅ Yes → Proceed to continuous loop (Phase 5)
- ❌ No → Keep human in loop, delay Phase 5

### After Phase 5
**Question:** Is system stable for extended operation?
- ✅ Yes → Proceed to 30-day trial (Phase 6)
- ❌ No → Fix stability issues, extend Phase 5

### After Phase 6
**Question:** Has system proven autonomous reliability?
- ✅ Yes → Production-ready, scale up
- ❌ No → Analyze failures, extend trial, or pivot

## Risk Mitigation

### High-Risk Areas

**1. LLM Non-Determinism**
- Risk: Same spec compiles differently each time
- Mitigation: Version control templates, track variants, measure consistency

**2. Drift Accumulation**
- Risk: Small drifts compound into major divergence
- Mitigation: Strict thresholds, periodic manual audits, rollback capability

**3. Cost Runaway**
- Risk: Continuous operation drains budget
- Mitigation: Per-cycle limits, daily budgets, automatic shutdown triggers

**4. Catastrophic Failures**
- Risk: System breaks critical production code
- Mitigation: Sandboxing, test environments, gradual rollout

### Medium-Risk Areas

**5. Spec Ambiguity**
- Risk: Specs too vague for compilation
- Mitigation: Strict format, validation before compilation, examples library

**6. Realignment Loops**
- Risk: Fix creates new drift, infinite cycle
- Mitigation: Attempt limits, loop detection, manual approval

**7. Performance Degradation**
- Risk: System slows down over time
- Mitigation: Performance monitoring, optimization triggers, resource cleanup

## Success Indicators

### Early (Phase 1-2)
- ✅ Compilation produces valid templates
- ✅ Compiled templates execute successfully
- ✅ Manual validation catches drift

### Mid (Phase 3-4)
- ✅ Automatic validation accurate (low false positive/negative rates)
- ✅ Realignment succeeds >70% of time
- ✅ Re-validation passes after realignment

### Late (Phase 5-6)
- ✅ Continuous operation without crashes
- ✅ Success rates >80%
- ✅ Metrics improve week-over-week
- ✅ Zero critical failures
- ✅ Learning visible in Thompson Sampling convergence

## What "Proven Reliable" Means

**NOT:**
- 100% success rate (unrealistic)
- Zero failures (failures are expected, recovery matters)
- Static perfection (system must evolve)

**IS:**
- Predictable behavior (known failure modes)
- Self-correcting (recovers from failures automatically)
- Improving over time (measurable progress)
- Safe operation (no catastrophic failures)
- Observable (clear metrics, alerts, dashboards)

**Operational Definition:**
> A system is **proven reliable** when it operates autonomously for 30 days with >80% cycle success rate, demonstrable improvement in efficiency, and zero critical failures requiring manual intervention.

## References

**Related Documentation:**
- `closed-loop-architecture.md` - Detailed phase descriptions
- `meta-activities-catalog.md` - Implementation status
- `validation-contracts.md` - OpenSpec requirements
- `domain-mappings.md` - Validation domain details

**Implementation:**
- `repos/minibob/templates/meta/` - Meta-activities (future)
- `repos/metabob-activity-api/` - Backend learning system
- Activity Dashboard - Observability (current)
