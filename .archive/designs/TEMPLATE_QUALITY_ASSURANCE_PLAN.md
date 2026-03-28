# Template Quality Assurance Plan

**Date**: February 17, 2026  
**Priority**: CRITICAL  
**Goal**: Ensure only well-made, reliable, and effective templates are registered

---

## 🎯 Quality Standards

Before any template is registered to backend, it must meet these criteria:

### 1. **Functional Requirements** ✅

**Must Execute Successfully**:
- [ ] At least 3 successful test runs
- [ ] Success rate ≥ 70% (with varied inputs)
- [ ] All tasks complete without immediate failures
- [ ] Produces expected outputs

**Must Handle Errors Gracefully**:
- [ ] Clear error messages when things fail
- [ ] Retry strategies for transient failures
- [ ] Fallback options for optional dependencies
- [ ] No silent failures

**Must Be Reproducible**:
- [ ] Same inputs → same outputs
- [ ] Works across different environments
- [ ] No hidden dependencies
- [ ] Version controlled

### 2. **Design Quality** ✅

**Clear Structure**:
- [ ] Task decomposition is logical and atomic
- [ ] Dependencies are explicit and minimal
- [ ] Variables are well-typed and documented
- [ ] Validation rules are appropriate

**Good Prompts**:
- [ ] Instructions are clear and unambiguous
- [ ] Examples provided where needed
- [ ] Success criteria defined
- [ ] Error scenarios addressed

**Optimal Configuration**:
- [ ] Correct subagent assignment
- [ ] Appropriate maxTokens budget
- [ ] Sensible retry strategies
- [ ] Proper validation patterns

### 3. **Reliability** ✅

**Performance Metrics**:
- [ ] Average cost < $0.50 per execution
- [ ] Average duration < 5 minutes
- [ ] Token efficiency (no wasteful context)
- [ ] Consistent performance (low variance)

**Failure Modes**:
- [ ] Failures are debuggable (good error messages)
- [ ] Failures are recoverable (retry succeeds)
- [ ] Partial progress preserved
- [ ] No destructive failures

### 4. **Effectiveness** ✅

**Achieves Purpose**:
- [ ] Solves the stated problem
- [ ] Produces high-quality outputs
- [ ] Better than manual alternative
- [ ] User satisfaction high

**Quality Outcomes**:
- [ ] Code quality improved (or maintained)
- [ ] No regressions introduced
- [ ] Tests pass
- [ ] Documentation updated

---

## 🔍 Current Template Analysis

### Meta Templates Status

#### 1. create-activity-template
**Location**: Built-in template  
**Status**: ✅ Found, needs testing  
**Quality Assessment**: PENDING

**Known Issues**: None yet

**Test Plan**:
```bash
# Test 1: Create simple template
activity create-activity-template \
  templateName="Simple Test Template" \
  templateDescription="A template for testing creation" \
  category="infrastructure" \
  purpose="Test template creation workflow"

# Expected: New template file created and registered
# Success criteria: Template validates and can be executed
```

#### 2. debug-activity-execution-self-contained
**Location**: ~/.local/share/opencode/storage/activity-template/  
**Status**: ⚠️ Fails immediately (tested)  
**Quality Assessment**: NEEDS FIX

**Known Issues**:
- Fails immediately (0.0s duration, $0.00 cost)
- No task execution
- Likely: activity_error_inspector tool issue or validation problem

**Root Cause**: 
The debug template itself is failing before it can debug anything. This is a bootstrap problem - we can't use the debug template to fix the debug template!

**Fix Strategy**:
1. Manually inspect the template JSON
2. Check for validation issues
3. Test activity_error_inspector tool directly (we did - it works!)
4. Look for setup/dependency issues
5. May need to manually fix prompt or dependencies

#### 3. improve-bootstrap-template-ductile-rigidity
**Location**: ~/.local/share/opencode/storage/activity-template/  
**Status**: 🟡 Untested  
**Quality Assessment**: PENDING

**Known Issues**: None yet, but requires extensive variables

**Test Plan**:
```bash
# Test with simplest template (test-failure-activity)
activity improve-bootstrap-template-ductile-rigidity \
  # ... requires assessment, design, etc.
  
# This template is complex - may need intermediate testing
```

---

## 🛠️ Quality Assurance Process

### Phase 1: Smoke Test (5-10 minutes per template)

**Goal**: Verify basic functionality

**Steps**:
1. Read template JSON - check for obvious issues
2. Run with minimal valid inputs
3. Observe: Does it start? Does it fail immediately?
4. Check error messages if it fails

**Pass Criteria**:
- Template executes at least one task
- Error messages are useful (if any)
- No immediate crashes

### Phase 2: Functional Test (20-30 minutes per template)

**Goal**: Verify it achieves its purpose

**Steps**:
1. Design 3 test cases (simple, moderate, complex)
2. Run all 3 test cases
3. Verify outputs meet expectations
4. Check success rate

**Pass Criteria**:
- ≥ 2/3 test cases succeed
- Outputs are correct and useful
- Performance is acceptable

### Phase 3: Reliability Test (1-2 hours per template)

**Goal**: Verify consistent performance

**Steps**:
1. Run template 10 times with varied inputs
2. Measure: success rate, cost, duration, variance
3. Test error handling (invalid inputs, missing files, etc.)
4. Test retry logic

**Pass Criteria**:
- Success rate ≥ 70%
- Cost variance < 50%
- Duration variance < 50%
- Error handling works

### Phase 4: Quality Review (30 minutes per template)

**Goal**: Verify code/design quality

**Steps**:
1. Review template structure
2. Check prompt quality
3. Verify validation rules
4. Review subagent assignments
5. Check for best practices

**Pass Criteria**:
- Structure follows best practices
- Prompts are clear and complete
- Validation is appropriate
- Subagent choices make sense

---

## 🚨 Bootstrap Problem: Debug Template Can't Debug Itself

### The Problem

**Chicken and Egg**:
- debug-activity-execution is supposed to fix broken templates
- But debug-activity-execution itself is broken
- We can't use it to fix itself!

### The Solution: Manual Bootstrapping

**Step 1: Manually Fix Debug Template**

Since we can't use the debug template to fix itself, we need to:

1. **Inspect template manually**:
   ```bash
   cat ~/.local/share/opencode/storage/activity-template/debug-activity-execution-self-contained.json | jq '.'
   ```

2. **Check for common issues**:
   - Missing required tools?
   - Incorrect validation?
   - Dependency problems?
   - Variable issues?

3. **Test activity_error_inspector directly** (already confirmed working):
   ```typescript
   activity_error_inspector({
     activityId: "act_mlqcdw14_a6a7d61a0bb1f68e",
     includeSessionLogs: true,
     includeToolCalls: true
   })
   ```

4. **Identify the fix**:
   - Based on inspection, determine what's wrong
   - Make targeted fix
   - Test again

5. **Once debug template works**:
   - Use it to fix all other templates!
   - Self-improvement loop can start

**Step 2: Create Simple Debug Variant**

Create a minimal version that works:

```json
{
  "id": "debug-activity-simple",
  "name": "Debug Activity (Simple)",
  "tasks": [
    {
      "id": "inspect-error",
      "prompt": {
        "template": "Call activity_error_inspector for {{executionId}}. Save output to ERRORS.md."
      },
      "validation": {
        "warnOnly": true
      }
    }
  ]
}
```

This minimal version:
- Has only one task
- Minimal validation
- Can bootstrap the full debug template

---

## 📋 Template Registration Checklist

Before registering ANY template to backend:

### Pre-Registration Validation

- [ ] **Smoke test passed** (executes at least once)
- [ ] **Functional test passed** (≥2/3 test cases succeed)
- [ ] **Reliability test passed** (≥70% success rate over 10 runs)
- [ ] **Quality review passed** (structure, prompts, validation reviewed)
- [ ] **Documentation complete** (README, variables documented)
- [ ] **Examples provided** (at least 2 usage examples)
- [ ] **Gradient analysis run** (understand cost/duration/success patterns)

### Registration Data

```typescript
{
  "template_id": "template-name",
  "version": 1,
  "quality_score": 85,  // Based on QA results
  "test_results": {
    "smoke_test": "PASS",
    "functional_test": "PASS (2/3)",
    "reliability_test": "PASS (8/10, 80%)",
    "quality_review": "PASS"
  },
  "metrics": {
    "avg_cost": 0.25,
    "avg_duration_ms": 45000,
    "success_rate": 0.80,
    "test_executions": 15
  },
  "validated_by": "human",
  "validated_at": "2026-02-17T12:00:00Z"
}
```

### Post-Registration Monitoring

- [ ] Monitor first 10 production executions
- [ ] Check success rate remains ≥ 70%
- [ ] Verify no unexpected failures
- [ ] Collect user feedback
- [ ] Run gradient analysis on production data
- [ ] Plan improvements based on metrics

---

## 🎯 Immediate Action Plan

### Step 1: Fix Debug Template (Critical - 1-2 hours)

**Why First**: Can't fix other templates without this

**Approach**:
1. Manually inspect debug-activity-execution-self-contained.json
2. Identify why it fails immediately (likely validation or dependency)
3. Create minimal working version if needed
4. Test until it works
5. Use it to debug itself (dogfooding!)

**Success Criteria**:
- Debug template executes and produces useful output
- Can analyze at least one failed activity
- Generates actionable fixes

### Step 2: Test Create Template (1 hour)

**Why Second**: Needed to create high-quality new templates

**Approach**:
1. Run create-activity-template with simple example
2. Verify created template is valid
3. Test the created template
4. Iterate if issues found

**Success Criteria**:
- Creates valid template JSON
- Created template executes successfully
- Registration workflow works

### Step 3: Test Improve Template (1-2 hours)

**Why Third**: Needed to enhance existing templates

**Approach**:
1. Start with simplest working template (test-failure-activity)
2. Run improve-bootstrap-template on it
3. Verify improvements are meaningful
4. Compare before/after metrics

**Success Criteria**:
- Produces improved template version
- Improvements measurable (cost, duration, success rate)
- Improved version works better

### Step 4: Use Meta Templates on Regular Templates (3-4 hours)

**Now that meta templates work**:

1. Use **debug** template to fix all broken templates:
   - add-feature-complete
   - fix-bug-complete
   - refactor-component-complete
   - All other 0% success templates

2. Use **improve** template to enhance working templates:
   - test-failure-activity
   - Any partially working templates

3. Use **create** template for new needed templates:
   - Simple variants of complex templates
   - Missing workflow templates

### Step 5: Quality Validate All Templates (2-3 hours)

For each template:
1. Run smoke test
2. Run functional test
3. Run reliability test (if time permits)
4. Document results

### Step 6: Register Only Validated Templates (1 hour)

- Only register templates that pass QA
- Include quality metadata
- Set up monitoring

---

## 📊 Success Metrics

### Quality Metrics (Per Template)

**Before Registration**:
- Smoke test: PASS
- Functional test: ≥ 67% success
- Reliability test: ≥ 70% success (over 10 runs)
- Quality review: PASS

**After Registration**:
- First 10 production executions: ≥ 70% success
- Average cost: Within expected range
- Average duration: Within expected range
- User feedback: Positive

### System Metrics

**Template Quality**:
- % templates passing all QA stages: Target 100%
- Average template success rate: Target ≥ 75%
- Average template quality score: Target ≥ 80/100

**Self-Improvement Loop**:
- Meta templates working: 3/3
- Broken templates fixed: Target 100%
- Templates improved: Target ≥ 5 per week
- New templates created: Target ≥ 2 per week

---

## 🎓 Quality Principles

### 1. **Test Before Register**
Never register untested templates. Every template must have at least 3 successful test runs.

### 2. **Measure Everything**
Track cost, duration, success rate, token usage for every execution. Use gradient analysis to identify improvements.

### 3. **Iterate Rapidly**
Don't aim for perfection on first try. Get to 70% success, register, then improve based on production data.

### 4. **Learn from Failures**
Every failure is data. Use debug template to analyze, understand, fix, and prevent similar failures.

### 5. **Gradual Enhancement**
Start simple, add complexity gradually. Validate at each step. Maintain working state throughout.

### 6. **Dogfood Everything**
Use templates to improve themselves. Meta templates should be the highest quality templates.

### 7. **Document Learnings**
Capture patterns: what works, what fails, why. Build institutional knowledge.

---

## 🔄 Continuous Improvement Cycle

```
1. Create/Fix Template
   ↓
2. Test (Smoke → Functional → Reliability)
   ↓
3. Measure (Cost, Duration, Success Rate)
   ↓
4. Analyze (Gradient Analysis, Error Patterns)
   ↓
5. Identify Improvements
   ↓
6. Apply Improvements (Use meta templates!)
   ↓
7. Re-test
   ↓
8. Register (Only if quality criteria met)
   ↓
9. Monitor Production
   ↓
10. Collect Feedback
    ↓
(Loop back to step 5)
```

**This is the continuous improvement loop that makes the system better over time.**

---

## 📚 Documentation Requirements

Each template must have:

1. **README section** in template description
2. **Variable documentation** with types and examples
3. **Usage examples** (at least 2)
4. **Success criteria** clearly defined
5. **Known limitations** documented
6. **Troubleshooting guide** for common issues
7. **Changelog** tracking improvements

---

## ✅ Conclusion

**Quality assurance is not optional** - it's the foundation of a reliable template system.

**Key Points**:
1. Test thoroughly before registering
2. Fix meta templates first (they fix everything else)
3. Use gradient analysis to drive improvements
4. Build self-improvement loop
5. Measure, learn, iterate

**Next Session Priority**:
1. Fix debug-activity-execution template (bootstrap problem)
2. Test all 3 meta templates
3. Use meta templates to fix regular templates
4. Only register high-quality, validated templates

**Bottom Line**: Better to have 5 excellent templates than 17 broken ones. Quality over quantity.
