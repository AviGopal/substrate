# Nested Activity Execution Plan - Multi-Stage Development

**Goal:** Implement multiple capabilities through nested trace-enforce-validate loops with impulse-based data flow  
**Target:** Variant Testing + Activity Optimization  
**Output:** PR with passing CI/CD that adheres to documentation

---

## Architecture Overview

```
                        ┌─────────────────────────────┐
                        │  Root Orchestrator          │
                        │  (This Session)             │
                        └──────────────┬──────────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    │                                      │
         ┌──────────▼──────────┐              ┌──────────▼──────────┐
         │ Path A: Variant     │              │ Path B: Activity    │
         │ Testing System      │              │ Optimization        │
         └──────────┬──────────┘              └──────────┬──────────┘
                    │                                      │
         ┌──────────┴──────────┐              ┌──────────┴──────────┐
         │                     │              │                     │
    ┌────▼────┐         ┌─────▼─────┐   ┌────▼────┐         ┌─────▼─────┐
    │ Trace A │         │ Trace A'  │   │ Trace B │         │ Trace B'  │
    │ (Core)  │         │ (Tests)   │   │ (Core)  │         │ (Metrics) │
    └────┬────┘         └─────┬─────┘   └────┬────┘         └─────┬─────┘
         │                    │              │                    │
    ┌────▼────┐         ┌─────▼─────┐   ┌────▼────┐         ┌─────▼─────┐
    │ Enforce │         │ Enforce   │   │ Enforce │         │ Enforce   │
    │ A       │         │ A'        │   │ B       │         │ B'        │
    └────┬────┘         └─────┬─────┘   └────┬────┘         └─────┬─────┘
         │                    │              │                    │
    ┌────▼────┐         ┌─────▼─────┐   ┌────▼────┐         ┌─────▼─────┐
    │Validate │         │ Validate  │   │Validate │         │ Validate  │
    │ A       │         │ A'        │   │ B       │         │ B'        │
    └────┬────┘         └─────┬─────┘   └────┬────┘         └─────┬─────┘
         │                    │              │                    │
         └────────────┬───────┘              └──────────┬─────────┘
                      │                                 │
                      └────────────┬────────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │  Integration Stage  │
                        │  (Merge & Test)     │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │  PR Creation        │
                        │  (CI/CD Validation) │
                        └─────────────────────┘
```

---

## Impulse Flow Architecture

### Impulse Types

1. **Specification Impulses** - Requirements and constraints
2. **Trace Impulses** - Data flow documentation
3. **Implementation Impulses** - Code artifacts and changes
4. **Validation Impulses** - Test results and metrics
5. **Integration Impulses** - Merge conflict resolutions

### Flow Pattern

```
Stage N Output Impulse → Stage N+1 Input Impulse
```

**Example:**
```typescript
// Stage 1: Trace creates specification impulse
trace_output = {
  impulseId: "variant-testing-spec",
  type: "specification",
  content: "Variant testing requires..."
}

// Stage 2: Enforce consumes specification impulse
enforce_activity({
  shareImpulses: ["variant-testing-spec"],
  templateId: "implement-feature"
})

// Stage 2: Enforce creates implementation impulse
enforce_output = {
  impulseId: "variant-testing-impl",
  type: "implementation",
  content: "Created files: src/variant-testing/..."
}

// Stage 3: Validate consumes implementation impulse
validate_activity({
  shareImpulses: ["variant-testing-impl", "variant-testing-spec"],
  templateId: "run-tests"
})
```

---

## Stage Definitions

### Stage 0: Root Planning (This Session)

**Activities:**
- None (manual planning)

**Outputs:**
- `impulse-root-plan` - Overall execution plan
- `impulse-path-a-scope` - Variant testing scope
- `impulse-path-b-scope` - Optimization scope
- `impulse-integration-strategy` - How to merge paths

**Next:** Fork into Path A and Path B

---

### Path A: Variant Testing System

#### Stage A1: Trace Variant Testing Requirements

**Activity:** `trace-data-flow-single-feature`

**Variables:**
```typescript
{
  featureName: "variant-testing-framework",
  entryPoints: ["activity execution", "template selection"],
  exitPoints: ["performance comparison", "winner selection"],
  expectedBehavior: "Execute N variants of same activity, compare results, select best",
  validationStrategy: "functional-state-comparison"
}
```

**Impulse Inputs:**
- `impulse-root-plan`
- `impulse-path-a-scope`

**Impulse Outputs:**
- `impulse-variant-spec` - Complete specification
- `impulse-variant-dataflow` - Data flow documentation
- `impulse-variant-architecture` - System architecture
- `impulse-variant-constraints` - Design constraints

**Expected Artifacts:**
- `docs/VARIANT_TESTING_SPEC.md`
- `docs/VARIANT_TESTING_DATAFLOW.md`
- Data flow diagram
- Component list

#### Stage A1': Trace Variant Testing Tests (Parallel)

**Activity:** `trace-data-flow-single-feature`

**Variables:**
```typescript
{
  featureName: "variant-testing-tests",
  entryPoints: ["test harness", "mock functional state"],
  exitPoints: ["test assertions", "coverage report"],
  expectedBehavior: "Comprehensive test coverage for variant system",
  validationStrategy: "test-coverage-analysis"
}
```

**Impulse Inputs:**
- `impulse-variant-spec`

**Impulse Outputs:**
- `impulse-variant-test-plan` - Test strategy
- `impulse-variant-test-cases` - Specific test cases

**Expected Artifacts:**
- `docs/VARIANT_TESTING_TEST_PLAN.md`

#### Stage A2: Enforce Variant Testing Implementation

**Activity:** `trace-enforce-validate-loop`

**Variables:**
```typescript
{
  specificationName: "variant-testing-framework",
  specificationDescription: "System to execute and compare activity variants",
  expectedBehavior: "N variants execute, metrics collected, winner selected",
  validationStrategy: "test-driven-development"
}
```

**Impulse Inputs:**
- `impulse-variant-spec`
- `impulse-variant-dataflow`
- `impulse-variant-architecture`

**Impulse Outputs:**
- `impulse-variant-impl` - Implementation details
- `impulse-variant-files` - Created/modified files
- `impulse-variant-conflicts` - Any conflicts found

**Expected Artifacts:**
- `src/activity/variant-testing.ts`
- `src/activity/variant-executor.ts`
- `src/activity/variant-comparator.ts`
- `src/types/variant.ts`

#### Stage A2': Enforce Variant Testing Tests (Parallel)

**Activity:** `add-comprehensive-tests`

**Variables:**
```typescript
{
  component_name: "variant-testing",
  target_files: ["src/activity/variant-testing.ts", "src/activity/variant-executor.ts"],
  test_framework: "bun:test",
  coverage_goal: "90%"
}
```

**Impulse Inputs:**
- `impulse-variant-impl`
- `impulse-variant-test-plan`

**Impulse Outputs:**
- `impulse-variant-tests-impl` - Test implementation
- `impulse-variant-coverage` - Coverage metrics

**Expected Artifacts:**
- `test/activity/variant-testing.test.ts`
- `test/activity/variant-executor.test.ts`

#### Stage A3: Validate Variant Testing

**Activity:** Custom validation activity

**Impulse Inputs:**
- `impulse-variant-impl`
- `impulse-variant-tests-impl`
- `impulse-variant-spec`

**Actions:**
1. Run test suite: `bun test test/activity/variant-testing.test.ts`
2. Check coverage: Ensure 90%+ coverage
3. Run linter: `bun run typecheck`
4. Validate against spec: Compare impl to spec
5. Integration test: Execute real variant comparison

**Impulse Outputs:**
- `impulse-variant-validation` - Validation results
- `impulse-variant-metrics` - Performance metrics
- `impulse-variant-gaps` - Any gaps found

**Expected Results:**
- All tests passing ✅
- Coverage > 90% ✅
- No type errors ✅
- Spec compliance ✅

---

### Path B: Activity Optimization

#### Stage B1: Trace Optimization Requirements

**Activity:** `trace-data-flow-single-feature`

**Variables:**
```typescript
{
  featureName: "activity-optimization",
  entryPoints: ["activity execution", "LLM token usage"],
  exitPoints: ["optimized execution", "token metrics"],
  expectedBehavior: "Analyze activity, identify optimization opportunities, apply optimizations",
  validationStrategy: "token-reduction-measurement"
}
```

**Impulse Inputs:**
- `impulse-root-plan`
- `impulse-path-b-scope`

**Impulse Outputs:**
- `impulse-optimization-spec` - Optimization specification
- `impulse-optimization-dataflow` - Data flow for optimization
- `impulse-optimization-strategies` - Optimization strategies list

**Expected Artifacts:**
- `docs/ACTIVITY_OPTIMIZATION_SPEC.md`
- `docs/OPTIMIZATION_STRATEGIES.md`

#### Stage B1': Trace Optimization Metrics (Parallel)

**Activity:** `trace-data-flow-single-feature`

**Variables:**
```typescript
{
  featureName: "optimization-metrics",
  entryPoints: ["activity start", "token counter"],
  exitPoints: ["metrics report", "comparison"],
  expectedBehavior: "Collect baseline and optimized metrics for comparison",
  validationStrategy: "metrics-comparison"
}
```

**Impulse Inputs:**
- `impulse-optimization-spec`

**Impulse Outputs:**
- `impulse-metrics-spec` - Metrics definition
- `impulse-metrics-collection` - How to collect

**Expected Artifacts:**
- `docs/OPTIMIZATION_METRICS.md`

#### Stage B2: Enforce Optimization Implementation

**Activity:** `trace-enforce-validate-loop`

**Variables:**
```typescript
{
  specificationName: "activity-optimization",
  specificationDescription: "System to optimize activities by reducing LLM calls",
  expectedBehavior: "Analyze activity, apply optimizations, measure improvements",
  validationStrategy: "before-after-comparison"
}
```

**Impulse Inputs:**
- `impulse-optimization-spec`
- `impulse-optimization-strategies`

**Impulse Outputs:**
- `impulse-optimization-impl` - Implementation details
- `impulse-optimization-files` - Files created/modified

**Expected Artifacts:**
- `src/activity/optimization.ts`
- `src/activity/token-analyzer.ts`
- `src/activity/caching-strategy.ts`

#### Stage B2': Enforce Metrics Collection (Parallel)

**Activity:** `add-feature-complete`

**Variables:**
```typescript
{
  featureName: "optimization-metrics-collection",
  files: ["src/activity/metrics-collector.ts"],
  description: "Collect and compare optimization metrics"
}
```

**Impulse Inputs:**
- `impulse-metrics-spec`
- `impulse-optimization-impl`

**Impulse Outputs:**
- `impulse-metrics-impl` - Metrics implementation

**Expected Artifacts:**
- `src/activity/metrics-collector.ts`
- `test/activity/metrics-collector.test.ts`

#### Stage B3: Validate Optimization

**Activity:** Custom validation activity

**Impulse Inputs:**
- `impulse-optimization-impl`
- `impulse-metrics-impl`

**Actions:**
1. Baseline measurement: Run activity, measure tokens
2. Apply optimization: Run optimized version
3. Compare metrics: Calculate improvement
4. Validate: Ensure output quality maintained
5. Document: Create metrics report

**Impulse Outputs:**
- `impulse-optimization-validation` - Validation results
- `impulse-optimization-metrics` - Before/after metrics
- `impulse-optimization-report` - Improvement report

**Expected Results:**
- Token reduction: > 20% ✅
- Quality maintained: Same output ✅
- Performance: Same or better ✅

---

### Stage 7: Integration

**Activity:** Custom integration activity

**Impulse Inputs:**
- `impulse-variant-validation`
- `impulse-optimization-validation`
- `impulse-variant-impl`
- `impulse-optimization-impl`

**Actions:**
1. **Merge check:** Identify file conflicts
2. **Resolution:** Resolve any conflicts
3. **Integration test:** Run both systems together
4. **Cross-validation:** Variant test the optimization system
5. **Documentation:** Update all docs

**Impulse Outputs:**
- `impulse-integration-result` - Integration status
- `impulse-integration-conflicts` - Resolved conflicts
- `impulse-integration-tests` - Combined test results

**Expected Results:**
- No merge conflicts ✅
- All tests passing ✅
- Both systems working together ✅

---

### Stage 8: PR Creation

**Activity:** Custom PR creation activity

**Impulse Inputs:**
- `impulse-integration-result`
- `impulse-variant-validation`
- `impulse-optimization-validation`

**Actions:**
1. **Branch creation:** Create feature branch
2. **Commit organization:** Logical commit sequence
3. **CI/CD check:** Run full test suite
4. **Documentation check:** Verify docs updated
5. **PR creation:** Create PR with comprehensive description

**PR Structure:**
```markdown
# Add Variant Testing and Activity Optimization

## Summary
Implements two critical capabilities identified in truth check:
- Variant testing framework for activity comparison
- Activity optimization system with token reduction

## Implementation

### Variant Testing System
- Functional state capture/restore
- Variant execution engine
- Performance comparison metrics
- Winner selection algorithm

### Activity Optimization
- Token usage analysis
- Optimization strategies (caching, prompt optimization)
- Before/after metrics collection
- X% token reduction achieved

## Testing
- All tests passing ✅
- Coverage > 90% for both systems ✅
- Integration tests validate systems work together ✅

## Documentation
- Specification docs created ✅
- Data flow diagrams included ✅
- API documentation complete ✅

## Validation
- Trace-enforce-validate loops executed ✅
- Impulse flow validated ✅
- CI/CD passing ✅
```

**Impulse Outputs:**
- `impulse-pr-created` - PR URL and details

**Expected Results:**
- Branch pushed ✅
- PR created ✅
- CI/CD passing ✅
- Ready for review ✅

---

## Impulse Management Strategy

### Impulse Naming Convention
```
impulse-{path}-{stage}-{artifact}

Examples:
- impulse-variant-spec
- impulse-optimization-impl
- impulse-integration-result
```

### Impulse Content Structure
```typescript
interface FlowImpulse {
  id: string
  type: "specification" | "implementation" | "validation" | "integration"
  stage: string
  path: "A" | "B" | "integration"
  pointer: {
    type: "file" | "memo" | "activityOutput"
    // ... pointer details
  }
  metadata: {
    created: string
    dependencies: string[]  // Other impulse IDs this depends on
    consumers: string[]     // Activities that should use this
  }
}
```

### Impulse Lifecycle
1. **Creation:** Activity creates impulse with output
2. **Registration:** Store in session memory
3. **Sharing:** Next activity receives via `shareImpulses`
4. **Consumption:** Activity uses impulse data
5. **Validation:** Check impulse was actually used
6. **Cleanup:** Archive after workflow complete

---

## Parallelization Strategy

### Safe Parallel Execution

**Path A and Path B run in parallel:**
- No shared files initially
- Separate namespaces:
  - Path A: `src/activity/variant-*`
  - Path B: `src/activity/optimization-*`
- Independent test files
- Merge only at integration stage

**Within each path (A1 + A1', A2 + A2'):**
- Core implementation and tests parallel
- Tests wait for implementation impulse
- Both converge at validation stage

### Conflict Prevention

**File Isolation:**
```
src/activity/
  variant-testing.ts      # Path A only
  variant-executor.ts     # Path A only
  variant-comparator.ts   # Path A only
  optimization.ts         # Path B only
  token-analyzer.ts       # Path B only
  caching-strategy.ts     # Path B only
```

**Shared Files (Edit at Integration Stage Only):**
- `src/activity/activity.ts` - Main activity executor
- `src/types/activity.ts` - Type definitions
- `README.md` - Documentation

**Test Isolation:**
```
test/activity/
  variant-testing.test.ts   # Path A
  optimization.test.ts      # Path B
```

---

## Execution Plan

### Phase 1: Planning (This Session)
**Duration:** 30 minutes

1. Create root plan impulse
2. Create path scopes
3. Define integration strategy
4. Commit plan document

### Phase 2: Path A - Variant Testing
**Duration:** 2-3 hours

1. **A1 + A1':** Trace (parallel)
   - Run trace-data-flow-single-feature (variant core)
   - Run trace-data-flow-single-feature (variant tests)
   - Output: 2 specification impulses

2. **A2 + A2':** Enforce (parallel)
   - Implement variant testing system
   - Implement variant tests
   - Output: 2 implementation impulses

3. **A3:** Validate
   - Run tests
   - Measure coverage
   - Verify spec compliance
   - Output: 1 validation impulse

### Phase 3: Path B - Optimization (Parallel with Phase 2)
**Duration:** 2-3 hours

1. **B1 + B1':** Trace (parallel)
   - Run trace-data-flow-single-feature (optimization core)
   - Run trace-data-flow-single-feature (metrics)
   - Output: 2 specification impulses

2. **B2 + B2':** Enforce (parallel)
   - Implement optimization system
   - Implement metrics collection
   - Output: 2 implementation impulses

3. **B3:** Validate
   - Baseline measurement
   - Optimization measurement
   - Calculate improvement
   - Output: 1 validation impulse

### Phase 4: Integration
**Duration:** 1 hour

1. Merge implementations
2. Resolve conflicts
3. Run combined tests
4. Cross-validate systems

### Phase 5: PR Creation
**Duration:** 30 minutes

1. Organize commits
2. Run full CI/CD
3. Create comprehensive PR
4. Verify all checks pass

**Total Estimated Time:** 6-8 hours

---

## Success Criteria

### Per-Stage Success
- ✅ All impulses created with proper metadata
- ✅ Next stage receives and uses impulses
- ✅ Artifacts match specification
- ✅ Tests passing at each validation stage

### Overall Success
- ✅ Both systems implemented and tested
- ✅ No merge conflicts
- ✅ All tests passing (> 90% coverage)
- ✅ CI/CD green
- ✅ PR created and ready for review
- ✅ Documentation complete and accurate
- ✅ Impulse flow validated end-to-end

### Capability Validation
- ✅ **Variant Testing:** Proven working
- ✅ **Activity Optimization:** Proven working
- ✅ **Nested Activities:** Demonstrated
- ✅ **Impulse Flow:** Validated
- ✅ **Parallel Execution:** No conflicts
- ✅ **CI/CD Integration:** Passing

---

## Risk Mitigation

### Risk 1: Impulse Not Used
**Mitigation:** Add validation step to check impulse consumption

### Risk 2: Merge Conflicts
**Mitigation:** Strict file isolation, merge only at integration

### Risk 3: CI/CD Failure
**Mitigation:** Validate at each stage, not just final PR

### Risk 4: Incomplete Specification
**Mitigation:** Trace stage creates comprehensive specs before enforce

### Risk 5: Workflow Too Complex
**Mitigation:** Start with Path A only, add Path B once proven

---

## Next Steps

1. **Create root impulses** (planning artifacts)
2. **Execute Stage A1** (trace variant testing)
3. **Monitor impulse creation** (verify metadata)
4. **Execute Stage A2** (enforce implementation)
5. **Validate Stage A3** (tests + compliance)
6. **Repeat for Path B** (in parallel if feasible)
7. **Integrate** (merge + validate)
8. **Create PR** (with passing CI/CD)

---

**Status:** Plan complete, ready to execute  
**First Action:** Create root planning impulses  
**Expected Outcome:** PR with 2 new capabilities + proof of workflow
