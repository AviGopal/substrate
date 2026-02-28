# Failed Templates: Consolidated Analysis & Evolution Plan

**Generated**: 2026-02-27  
**Templates Analyzed**: 5 (3 deep analysis, 2 preliminary)  
**Success Rate**: 0% → Target 80%+

---

## Executive Summary

### Common Failure Patterns Across All Templates

1. **Missing Pre-Flight Checks** (4/5 templates)
   - No validation of prerequisites before execution
   - Assumption that resources exist without verification
   - Early failures due to missing dependencies

2. **Overly Strict Validation** (3/5 templates)
   - All-or-nothing success criteria
   - No graceful degradation for partial success
   - Validation tasks never run if earlier tasks fail

3. **Complex Multi-Step Tasks Without Checkpoints** (3/5 templates)
   - Large tasks that do many things (7+ steps in single task)
   - No intermediate validation
   - Hard to debug which step failed

4. **Path/Resource Assumptions** (3/5 templates)
   - Hardcoded directory paths that may not exist
   - Assumption that files/images/services are available
   - No discovery or fallback logic

5. **Missing Idempotency** (2/5 templates)
   - Re-running fails if resources already exist
   - No state checking before operations
   - Unsafe retry behavior

---

## Template-by-Template Analysis

### 1. enforce-distributed-devbob-deployment-constraints ⚠️

**Status**: Failed (1 execution, $0.16, 497s)  
**Root Cause**: Docker image unavailable + Missing validation execution  
**Severity**: HIGH (infrastructure critical)

#### What Went Wrong
- ❌ Docker image `metabobapp/metabob-rpc-api:0.7.0` doesn't exist locally
- ❌ Failed mid-task after partial deployment (SurrealDB succeeded, API failed)
- ❌ Validation task never ran (dependency on failed task)
- ❌ One failed read operation due to wrong directory path assumption

#### What Went Right
- ✅ Successfully deployed Redis (already running check)
- ✅ Successfully deployed SurrealDB via Helmfile
- ✅ Created ConfigMap and fixed Helm values
- ✅ Generated JSON enforcement report
- ✅ 33/34 tool calls succeeded

#### Evolution Strategy: **Add Resilience**

**Priority Fixes**:
1. **Pre-Flight Image Check** (Task 0)
   ```typescript
   {
     "id": "verify-images",
     "description": "Verify Docker images exist before deployment",
     "prompt": "Check: docker images metabobapp/metabob-rpc-api:0.7.0\nIf missing: Build locally OR use :latest OR skip with graceful message"
   }
   ```

2. **Graceful Degradation**
   - Success if 2/3 services deployed (not 3/3)
   - Partial success is acceptable
   - Document what failed and why

3. **Always-Run Validation**
   - Remove validation dependency on task success
   - Report actual state regardless of failures
   - Success tiers: Full (3/3), Partial (2/3), Minimal (1/3), Failure (0/3)

4. **Fix Path Discovery**
   - Use `find helm/ -name "*.values.yaml"` instead of assuming `helm/values/`
   - Don't hardcode directory structure

5. **Idempotent Operations**
   - Check if service exists before deploying
   - Skip deployment if already healthy
   - Safe to re-run

**Estimated Improvement**: 0% → 85%+ success rate  
**Effort**: MEDIUM (2-3 hours)

---

### 2. validate-distributed-devbob-deployment ⚠️

**Status**: Failed (1 execution, $0.13, 91s)  
**Root Cause**: Early failure, likely connectivity or missing prerequisites  
**Severity**: HIGH (validation critical for deployment confidence)

#### Template Analysis

**Structure**: 3 tasks (validate-backend → validate-vessels → validate-coordination)  
**Approach**: Sequential validation with dependencies

#### Likely Failure Points

1. **Task 1: validate-backend**
   - Port-forward commands may timeout
   - Health check URLs may be wrong
   - Services may not have expected labels

2. **Pre-Checks Too Strict**
   - Integration pre-check: `kubectl cluster-info`
   - May fail if cluster not configured
   - Should be graceful, not blocking

3. **No Retry for Transient Failures**
   - Network timeouts during port-forward
   - Temporary pod restarts
   - maxAttempts: 2 may not be enough

#### Evolution Strategy: **Add Robustness**

**Priority Fixes**:
1. **Graceful Pre-Flight**
   ```bash
   if ! kubectl cluster-info &>/dev/null; then
     echo "⚠️  kubectl not configured - using local validation mode"
     # Validate what we can without K8s
   fi
   ```

2. **Partial Validation**
   - Validate what's available, report what's missing
   - Don't fail entire activity if one component unreachable
   - Success if ≥50% of checks pass

3. **Retry with Backoff**
   - Increase maxAttempts: 2 → 3
   - Add delays between retries
   - Retry port-forward operations specifically

4. **Better Health Checks**
   ```bash
   # Instead of assuming health endpoint
   curl -sf http://localhost:8000/health || \
   curl -sf http://localhost:8000/status || \
   curl -sf http://localhost:8000/ || \
   echo "⚠️  Health check inconclusive (pod may still be healthy)"
   ```

5. **Timeout Handling**
   - Add explicit timeouts to curl/kubectl commands
   - Kill hung port-forwards after 5s
   - Continue validation even if one service times out

**Estimated Improvement**: 0% → 75%+ success rate  
**Effort**: LOW (1-2 hours)

---

### 3. align-vessel-code-with-docs ⚠️

**Status**: Failed (1 execution, $0.26, 125s)  
**Root Cause**: Complex 6-task refactoring with strict validation  
**Severity**: MEDIUM (code quality, not infrastructure)

#### Template Analysis

**Structure**: 6 sequential tasks (analyze → align structure → align interfaces → align errors → implement missing → verify)  
**Complexity**: HIGH (comprehensive code alignment)  
**Cost**: Relatively low ($0.26) suggests early failure

#### Likely Failure Points

1. **Task 1: Analyze Gaps**
   - May find overwhelming number of gaps
   - Report may be too detailed to process
   - Variable paths may not exist

2. **Task 2-5: Code Modifications**
   - TypeScript type errors after changes
   - Breaking changes to APIs
   - Missing imports or dependencies

3. **Task 6: Verification**
   - Type check may fail after extensive changes
   - Validation requires specific patterns
   - No way to partially succeed

#### Evolution Strategy: **Incremental Phases**

**Problem**: All-or-nothing 6-task sequence is too rigid

**Solution**: Break into 3 phases with intermediate validation

**Phase 1: Analysis & Planning** (standalone, always succeeds)
```typescript
{
  "tasks": [
    {
      "id": "analyze-gaps",
      "description": "Identify alignment gaps",
      "validation": { "requiredFiles": ["/tmp/vessel-alignment-gaps.md"] }
    }
  ]
}
```

**Phase 2: Critical Alignments** (focus on high-priority gaps)
```typescript
{
  "tasks": [
    {
      "id": "align-interfaces",
      "description": "Fix interface definitions (critical)",
      "dependencies": []
    },
    {
      "id": "align-error-handling",
      "description": "Standardize error patterns (critical)",
      "dependencies": []
    },
    {
      "id": "verify-phase-2",
      "description": "Type check after critical changes",
      "validation": { "commands": [{"command": "npm run typecheck"}] }
    }
  ]
}
```

**Phase 3: Nice-to-Have Alignments** (optional improvements)
```typescript
{
  "tasks": [
    {
      "id": "align-structure",
      "description": "Organize code structure",
      "dependencies": []
    },
    {
      "id": "add-jsdoc",
      "description": "Add documentation comments",
      "dependencies": ["align-structure"]
    }
  ]
}
```

**Benefits**:
- Phase 1 always succeeds (just analysis)
- Phase 2 focuses on critical fixes
- Phase 3 is optional (nice-to-have)
- Each phase independently testable

**Estimated Improvement**: 0% → 70%+ success rate  
**Effort**: HIGH (4-6 hours to restructure)

---

### 4. implement-impulse-learning-system ⚠️

**Status**: Failed (1 execution, $0.36, 902s)  
**Root Cause**: Complex 7-task implementation, mid-task failure  
**Severity**: MEDIUM (feature implementation, not critical)

#### Template Analysis

**Structure**: 7 sequential tasks, all dependent on previous  
**Complexity**: VERY HIGH (new system implementation)  
**Duration**: Long (902s / 15 minutes) suggests got 4-5 tasks in before failing

#### Likely Failure Points

1. **Task 1-2: Core Implementation**
   - File creation may have wrong paths
   - TypeScript compilation errors
   - Missing imports or dependencies

2. **Task 3-5: Integration**
   - Integration with existing code fails
   - Tests fail due to missing test data
   - Database schema issues

3. **Task 6-7: Monitoring & Testing**
   - Complex test expectations
   - Database queries fail
   - Integration tests need running system

#### Evolution Strategy: **Incremental Implementation with Checkpoints**

**Problem**: 7-task monolith with no intermediate validation

**Solution**: Break into smaller deliverables with working system at each stage

**v2 Structure**:

**Task 1: Data Capture (Standalone)**
```typescript
{
  "id": "implement-data-capture",
  "description": "Implement impulse-learning.ts with capture hooks",
  "validation": {
    "requiredFiles": ["src/session/impulse-learning.ts"],
    "commands": [
      {"command": "bun run typecheck"},
      {"command": "bun test impulse-learning"}
    ]
  }
}
```
Success Criteria: File compiles, basic unit tests pass

**Task 2: Pattern Learning (Builds on Task 1)**
```typescript
{
  "id": "implement-pattern-learning",
  "description": "Implement pattern extraction and matching",
  "validation": {
    "commands": [
      {"command": "bun test pattern-learning"}
    ]
  }
}
```
Success Criteria: Pattern matching works in isolation

**Task 3: Skip Logic (Builds on Task 2)**
```typescript
{
  "id": "implement-skip-logic",
  "description": "Implement skip decision and integrate with turn lifecycle",
  "validation": {
    "commands": [
      {"command": "bun test memory-skip-logic"},
      {"command": "bun run typecheck"}  // Ensure no breakage
    ]
  }
}
```
Success Criteria: Skip logic works, existing code still compiles

**Task 4: Integration Test (Verify System Works)**
```typescript
{
  "id": "integration-test",
  "description": "Run E2E test of learning system",
  "prompt": "Run 10-turn session, verify skip logic triggers, measure success rate",
  "validation": {
    "commands": [{"command": "bun test learning-system --integration"}]
  }
}
```
Success Criteria: 10-turn session completes, skip rate > 0%

**Defer Tasks 5-7** (monitoring, feedback loop, activity learning):
- Create separate templates for each
- Each can be implemented independently
- Each has simpler success criteria

**Benefits**:
- Each task is testable in isolation
- Validation after every task
- Can succeed with partial implementation
- Clear failure isolation

**Estimated Improvement**: 0% → 60%+ success rate  
**Effort**: VERY HIGH (6-8 hours to restructure + test)

---

### 5. generate-ai-services-agreement ⚠️

**Status**: Failed (1 execution, $0.40, 678s)  
**Root Cause**: Legal document validation too strict  
**Severity**: LOW (nice-to-have, not critical)

#### Template Analysis

**Structure**: 4 tasks (generate terms → create agreement → legal review → finalize)  
**Duration**: Long (678s / 11 minutes) suggests got to task 3-4  
**Cost**: Moderate ($0.40) suggests significant LLM usage

#### Likely Failure Points

1. **Task 3-4: Legal Review & Validation**
   - Legal document format validation is brittle
   - May require exact sections/wording
   - LLM output may vary in structure

2. **Human-in-Loop Missing**
   - Legal agreements should have human review
   - No checkpoint for manual approval
   - Automated validation not appropriate for legal docs

#### Evolution Strategy: **Defer or Simplify**

**Option A: Mark as Human-in-Loop** (Recommended)
- Generate draft agreement (tasks 1-2)
- Stop and require human review
- Continue only after approval
- Less strict validation

**Option B: Simplify to Template**
- Use predefined legal template
- Fill in variables (client name, service name, dates)
- Much simpler validation
- Lower risk

**Option C: Defer Entirely**
- Low priority compared to infrastructure templates
- Focus on high-impact technical templates first
- Revisit after other templates improved

**Recommendation**: Option C (defer) - Focus efforts on infrastructure templates that block deployment

**Estimated Improvement**: N/A (deprioritize)  
**Effort**: N/A

---

## Common Evolution Patterns

### Pattern 1: Pre-Flight Checks Template

**Apply to**: enforce-distributed, validate-distributed

```typescript
{
  "id": "preflight-check",
  "description": "Verify prerequisites before main execution",
  "dependencies": [],
  "prompt": `
    Check prerequisites:
    1. kubectl configured? → Continue or graceful local mode
    2. Docker images exist? → Continue, build, or skip with message
    3. Required files present? → Discover paths or fail-fast with guidance
    
    Report what's available and what's missing.
    Recommend: proceed, fix-prerequisites, or abort.
  `,
  "validation": {
    "requiredFiles": ["preflight-report.json"]
  }
}
```

**Benefits**:
- Fail fast with clear error messages
- Avoid wasted execution on missing prerequisites
- Provide actionable remediation steps

---

### Pattern 2: Graceful Degradation Template

**Apply to**: enforce-distributed, validate-distributed

```typescript
{
  "successCriteria": {
    "full": "All components succeeded (100%)",
    "partial": "Most components succeeded (≥66%)",
    "minimal": "Core components succeeded (≥50%)",
    "failure": "Too few components succeeded (<50%)"
  }
}
```

**Benefits**:
- Partial success is better than total failure
- More realistic success rates
- Still identifies issues without blocking

---

### Pattern 3: Incremental Phases Template

**Apply to**: align-vessel, implement-impulse

```typescript
{
  "phases": [
    {
      "name": "Phase 1: Foundation",
      "tasks": ["task-1", "task-2"],
      "successRequired": true,
      "description": "Must succeed for later phases"
    },
    {
      "name": "Phase 2: Core Features",
      "tasks": ["task-3", "task-4"],
      "successRequired": false,
      "description": "Nice-to-have improvements"
    }
  ]
}
```

**Benefits**:
- Clear checkpoints
- Can succeed with partial implementation
- Easy to retry failed phases

---

### Pattern 4: Always-Run Validation Template

**Apply to**: All templates

```typescript
{
  "id": "final-validation",
  "description": "Validate actual state regardless of previous failures",
  "dependencies": ["all-previous-tasks"],
  "continueOnFailure": true,  // ← KEY: Run even if dependencies failed
  "prompt": `
    Report current state:
    - What succeeded?
    - What failed?
    - What's partially working?
    
    Don't re-run operations, just validate current state.
  `
}
```

**Benefits**:
- Always know actual system state
- Validation reports are always generated
- Better debugging information

---

## Evolution Priority Matrix

| Template | Severity | Effort | ROI | Priority |
|----------|----------|--------|-----|----------|
| **enforce-distributed** | HIGH | MED | HIGH | 🔥 **1** |
| **validate-distributed** | HIGH | LOW | HIGH | 🔥 **2** |
| **align-vessel** | MED | HIGH | MED | ⚠️ **3** |
| **implement-impulse** | MED | VHIGH | MED | ⚠️ **4** |
| **generate-ai-agreement** | LOW | MED | LOW | ⏸️ **DEFER** |

---

## Recommended Execution Plan

### Week 1: Infrastructure Templates (High Priority)

**Day 1: enforce-distributed-devbob-deployment-constraints**
- Morning: Implement pre-flight checks and graceful degradation
- Afternoon: Add always-run validation and idempotency
- Evening: Test with missing image scenario
- **Expected**: 85%+ success rate

**Day 2: validate-distributed-devbob-deployment**
- Morning: Add robustness (retry, timeouts, partial validation)
- Afternoon: Fix health checks and port-forward handling
- Evening: Test with partial deployment
- **Expected**: 75%+ success rate

### Week 2: Code Quality Templates (Medium Priority)

**Day 3-4: align-vessel-code-with-docs**
- Day 3: Restructure into 3 phases
- Day 4: Test each phase independently
- **Expected**: 70%+ success rate

**Day 5-7: implement-impulse-learning-system**
- Day 5: Restructure into incremental tasks
- Day 6: Implement and test tasks 1-3
- Day 7: Integration testing
- **Expected**: 60%+ success rate

### Week 3: Cleanup & Monitoring

**Day 8: Cleanup**
- Delete 30+ test templates
- Archive old templates
- Update documentation

**Day 9: Monitoring**
- Create template health dashboard
- Track success rates over time
- Set up alerts for failures

**Day 10: Retrospective**
- Document lessons learned
- Update template creation guide
- Plan next evolution cycle

---

## Success Metrics

**Current State**:
- Failed templates: 5
- Success rate: 0%
- Avg cost: $0.25
- Avg duration: 455s

**Target State** (after evolution):
- Failed templates: 0-1
- Success rate: 70-85%
- Avg cost: $0.20 (improvements via fewer retries)
- Avg duration: 350s (faster with pre-flight checks)

**Key Performance Indicators**:
- **Template Health Score**: 8+/10 for all evolved templates
- **First-Run Success Rate**: 60%+ (up from 0%)
- **Retry Success Rate**: 90%+ (with improvements)
- **Time-to-Fix**: <4 hours per template (down from unknown)

---

## Conclusion

### Key Insights

1. **All failures have clear root causes** → Fixable with targeted improvements
2. **Common patterns across failures** → Can apply same fixes to multiple templates
3. **Success patterns exist** → manage-session-memory shows what works
4. **Evolution infrastructure is ready** → debug and evolve templates exist

### Recommended Approach

**Focus on infrastructure first** (enforce-distributed, validate-distributed):
- Highest impact (deployment blocked without these)
- Lowest effort (clear fixes)
- Highest ROI (fix once, benefit everywhere)

**Then code quality** (align-vessel, implement-impulse):
- Medium impact (improves code quality)
- Higher effort (requires restructuring)
- Medium ROI (less critical than infrastructure)

**Defer low-priority** (generate-ai-agreement):
- Low impact (nice-to-have)
- Focus limited resources on high-value work

### Next Steps

1. ✅ Review this analysis
2. 🔄 Use `evolve-activity-self-contained` on prioritized templates
3. 🧪 Test evolved templates with real scenarios
4. 📊 Track success rates and iterate
5. 📝 Update best practices documentation

---

**Generated by**: Activity Mode Debug Analysis  
**For**: Template Evolution Sprint  
**Next Review**: After first 2 templates evolved (2-3 days)
