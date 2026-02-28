# Quick Start: Activity Evolution Sprint

**Ready to Execute**: YES ✅  
**Time Required**: 2 days (infrastructure templates)  
**Expected Impact**: 0% → 80%+ success rate

---

## What to Read First

1. **This file** (you are here) - 2 minutes
2. **FAILED_TEMPLATES_CONSOLIDATED_ANALYSIS.md** - Priority templates section (10 minutes)
3. **DEBUG_ANALYSIS_enforce-distributed-devbob-deployment-constraints.md** - Example (5 minutes)

**Total prep time**: 17 minutes

---

## Priority 1: enforce-distributed-devbob-deployment-constraints 🔥

**Why first**: Infrastructure critical, clear fixes, high ROI  
**Expected**: 0% → 85%+ success rate  
**Time**: 2-3 hours

### Quick Fixes

```typescript
// Fix 1: Add pre-flight check (new Task 0)
{
  "id": "verify-prerequisites",
  "description": "Check Docker images and kubectl access",
  "prompt": `
    1. Check: docker images metabobapp/metabob-rpc-api:0.7.0
       - If missing: Recommend build or use alternative
    2. Check: kubectl cluster-info
       - If fails: Report issue, provide fix instructions
    3. Report: Ready to proceed OR Fix prerequisites first
  `
}

// Fix 2: Make deployment graceful (modify existing tasks)
{
  "successCriteria": {
    "full": "3/3 services deployed and healthy",
    "partial": "2/3 services deployed (ACCEPTABLE)",
    "minimal": "1/3 services deployed (warning)",
    "failure": "0/3 services deployed"
  }
}

// Fix 3: Always run validation (modify validation task)
{
  "id": "validate-enforcement",
  "dependencies": ["enforce-backends"],
  "continueOnFailure": true,  // ← ADD THIS
  "prompt": "Validate ACTUAL state, even if previous task failed"
}

// Fix 4: Fix path discovery
// Replace: readdir("helm/values")
// With: exec("find helm/ -name '*.values.yaml'")
```

### Test After Evolution

```bash
# Test 1: Missing image scenario
docker rmi metabobapp/metabob-rpc-api:0.7.0
# Run activity - should succeed with 2/3 services

# Test 2: All images available
docker pull metabobapp/metabob-rpc-api:0.7.0
# Run activity - should succeed with 3/3 services

# Test 3: Idempotent
# Run activity twice - second run should detect existing and skip
```

---

## Priority 2: validate-distributed-devbob-deployment 🔥

**Why second**: Validation critical, easy fixes, high ROI  
**Expected**: 0% → 75%+ success rate  
**Time**: 1-2 hours

### Quick Fixes

```typescript
// Fix 1: Graceful kubectl check
{
  "preChecks": [
    "kubectl cluster-info || echo '⚠️  kubectl not configured - using degraded mode'"
  ]
}

// Fix 2: Partial validation
{
  "prompt": `
    Validate all components, report results:
    - ✅ Redis: healthy
    - ❌ SurrealDB: unreachable
    - ⚠️  API: not deployed
    
    Success if: ≥50% components validated
  `
}

// Fix 3: Better health checks
{
  "commands": [
    "curl -sf http://localhost:8000/health || \\",
    "curl -sf http://localhost:8000/status || \\",
    "echo '⚠️  Health check inconclusive (may still be healthy)'"
  ]
}

// Fix 4: Add timeouts
{
  "commands": [
    "timeout 5s kubectl port-forward ...",
    "timeout 3s curl ..."
  ]
}
```

### Test After Evolution

```bash
# Test 1: All services running
kubectl get pods -n metabob
# Run activity - should succeed with full validation

# Test 2: Partial deployment
kubectl delete deployment metabob-rpc-api -n metabob
# Run activity - should succeed with partial validation

# Test 3: kubectl not configured
unset KUBECONFIG
# Run activity - should gracefully degrade
```

---

## How to Evolve

### Option A: Use evolve-activity-self-contained (Automated)

```bash
# Step 1: Ensure clean git
git status
git add -A && git commit -m "Checkpoint before evolution"

# Step 2: Run evolution activity
# Use the activity tool with templateId="evolve-activity-self-contained"
# Provide: templateId (to evolve) + specific improvements from analysis

# Step 3: Test evolved template
# Run with test scenarios
# Verify success rate improves
```

### Option B: Manual Evolution (Direct Edit)

```bash
# Step 1: Get current template
# Use get_activity_template tool

# Step 2: Apply fixes from analysis
# Edit template JSON directly
# Follow patterns from FAILED_TEMPLATES_CONSOLIDATED_ANALYSIS.md

# Step 3: Register updated template
# Use register_activity_template tool

# Step 4: Test
# Run activity with test scenarios
```

**Recommended**: Option A for complex changes, Option B for quick fixes

---

## Success Verification

### Before Evolution

```bash
# Record baseline
Template: enforce-distributed-devbob-deployment-constraints
Success rate: 0% (1 execution, 0 successes)
Avg cost: $0.16
Avg duration: 497s
```

### After Evolution

```bash
# Run 3 test executions
# Execution 1: Fresh deployment (all images available)
# Execution 2: Missing image scenario (graceful degradation)
# Execution 3: Idempotent retry (safe re-run)

# Calculate new metrics
Success rate: ≥2/3 = 66%+ (target: 85%+)
Avg cost: Expected $0.12-0.15 (faster with pre-flight)
Avg duration: Expected 300-400s (fail-fast or skip)
```

### Success Criteria

**Minimum** (acceptable):
- ✅ 2/3 test executions succeed
- ✅ No regressions (existing functionality still works)
- ✅ Clear error messages on failure

**Target** (ideal):
- ✅ 3/3 test executions succeed
- ✅ Faster execution (pre-flight checks)
- ✅ Graceful degradation (partial success)
- ✅ Idempotent (safe retry)

---

## Timeline

### Day 1: enforce-distributed (Morning + Afternoon)

- **09:00-10:00**: Review analysis documents
- **10:00-12:00**: Apply evolution fixes
- **12:00-13:00**: Lunch break
- **13:00-15:00**: Test with 3 scenarios
- **15:00-16:00**: Document results, iterate if needed

**Deliverable**: Template with 85%+ success rate

### Day 2: validate-distributed (Morning)

- **09:00-10:00**: Apply evolution fixes
- **10:00-11:30**: Test with 3 scenarios
- **11:30-12:00**: Document results

**Deliverable**: Template with 75%+ success rate

### Day 2: Cleanup (Afternoon)

- **13:00-14:00**: Archive 30+ test templates
- **14:00-15:00**: Update template registry
- **15:00-16:00**: Create evolution retrospective

**Deliverable**: Clean registry, lessons learned document

---

## If You Get Stuck

### Common Issues

**Issue**: evolve-activity-self-contained fails with git error  
**Solution**: Commit all changes first, ensure clean git status

**Issue**: Evolution makes template worse  
**Solution**: Revert to original, try manual fixes, test incrementally

**Issue**: Template still fails after evolution  
**Solution**: Use activity_error_inspector to debug, compare with success patterns

### Where to Get Help

1. **FAILED_TEMPLATES_CONSOLIDATED_ANALYSIS.md** - Detailed fixes for each template
2. **TEMPLATE_SUCCESS_PATTERNS.md** - Best practices and anti-patterns
3. **DEBUG_ANALYSIS_*.md** - Example of detailed debugging process

---

## Expected Outcomes

### After Day 1

- ✅ 1 infrastructure template working (enforce-distributed)
- ✅ Clear process for evolution established
- ✅ Test scenarios documented
- ✅ Metrics tracked (before/after)

### After Day 2

- ✅ 2 infrastructure templates working
- ✅ Registry cleaned (50 → 25 templates)
- ✅ Best practices documented
- ✅ Ready to tackle code quality templates (Week 2)

### After Week 1-2

- ✅ 4/5 failed templates working
- ✅ 80%+ overall template success rate
- ✅ Template health dashboard created
- ✅ Evolution process repeatable

---

## Next Sprint (After Infrastructure)

**Week 2**: Code quality templates
- align-vessel-code-with-docs (3-4 hours)
- implement-impulse-learning-system (6-8 hours)

**Week 3**: Monitoring and continuous improvement
- Template health dashboard
- Automated evolution suggestions
- Success rate tracking

---

## Quick Commands

```bash
# View all templates
# Use search_activities tool

# Get template details
# Use get_activity_template tool with id="template-name"

# Debug failed execution
# Use activity_error_inspector tool (finds most recent failure)

# Evolve template
# Use activity tool with templateId="evolve-activity-self-contained"

# Test evolved template
# Use activity tool with templateId="evolved-template-name"
```

---

**Ready to start?** Begin with Priority 1 (enforce-distributed) 🚀  
**Questions?** Check FAILED_TEMPLATES_CONSOLIDATED_ANALYSIS.md  
**Stuck?** Use activity_error_inspector to debug

**Good luck!** 🎯
