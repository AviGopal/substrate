# Variant Performance Dashboard

**Generated**: 2026-02-24  
**Data Source**: Redis Thompson Sampling metrics  
**Total Variants**: 24

---

## Executive Summary

**High Performers** (>80% success, >5 executions):
- hello-world-minimal: 27/27 (100%)
- test-feature-template: 5/6 (83%)

**Underperformers** (<50% success, >0 executions):
- None currently active

**Zero-Execution Templates** (untested):
- 22 variants with 0 executions
- May be broken, unknown, or unused

---

## Detailed Metrics

### Active Templates (>0 Executions)

| Template | Success | Total | Rate | Alpha | Beta |
|----------|---------|-------|------|-------|------|
| hello-world-minimal-31727b21 | 27 | 27 | 100% | 28 | 1 |
| test-feature-template-8739521f | 5 | 6 | 83% | 6 | 2 |
| test-hello-world-cc1fcb90 | 2 | 2 | 100% | 3 | 1 |

**Total Active Executions**: 35

### Zero-Execution Templates (Untested)

1. test-fix-validation-1771876445
2. refactor-with-tests-b42b7487
3. evolve-activity-template-(self-contained)-07dc501b
4. add-feature-complete-e071a333
5. create-activity-template-3cd903b8
6. create-activity-template-(ultra-minimal)-6b9f02c6
7. manage-session-memory-f2346cf0
... (22 total)

---

## Thompson Sampling Analysis

### Selection Probabilities

Based on Beta(alpha, beta) sampling:

**hello-world-minimal** (alpha=28, beta=1):
- Mean: ~96.5%
- Selection probability: ~97% (dominant)
- Status: Mature, highly successful

**test-feature-template** (alpha=6, beta=2):
- Mean: ~75%
- Selection probability: ~15% (secondary)
- Status: Good but room for improvement

**Zero-execution templates** (alpha=1, beta=1):
- Mean: 50%
- Selection probability: ~2% each (exploration)
- Status: Unknown, needs testing

---

## Insights from Data

### Insight 1: Very Low Utilization
Only 3/24 templates have been executed. 92% are untested.

**Possible Causes**:
- Templates are broken (can't execute)
- Templates are unknown (users don't know they exist)
- Templates are redundant (better alternatives exist)

**Action**: Test zero-execution templates to categorize

### Insight 2: High Success for Tested Templates
Templates that have been executed perform well:
- 2 at 100% success
- 1 at 83% success

**Interpretation**: Quality bar is high for templates that get used.

**Action**: Understand why hello-world and test-feature work well

### Insight 3: Missing create-activity Data
The create-activity-self-contained template we analyzed (3% success, 37 executions) is NOT in this Redis data.

**Possible Explanations**:
- Data is in different Redis instance
- Data is in local storage only
- Variant hash doesn't match
- Data was cleared

**Action**: Find the missing 37 executions data

### Insight 4: No Failed Templates Visible
We expected to see templates with low success rates, but none appear.

**Hypothesis**: The 3% templates may have been executed before current Redis tracking was enabled.

**Action**: Check local storage and historical records

---

## Missing Data Investigation

### Where is create-activity-self-contained data?

**From our earlier analysis**:
- create-activity-self-contained: 3% success (36/37 failures)
- Executions: 37
- Average cost: $0.13
- Average duration: 120s

**Not found in Redis keys**

**Possible locations**:
1. ~/.local/share/opencode/storage/activity-execution/*.json (local files)
2. Different Redis key format
3. SurrealDB (if executions were recent)
4. Template metadata file directly

**Next step**: Search local storage

---

## Recommendations

### Priority 1: Find Missing Execution Data
**Why**: We need the 51+ executions mentioned in earlier reports  
**How**: Search local storage, check template metadata files  
**Impact**: Enable proper evolution analysis

### Priority 2: Test Zero-Execution Templates
**Why**: 92% of templates are untested - waste or opportunity?  
**How**: Batch test all 22 with simple test cases  
**Impact**: Identify which to keep/improve/retire

### Priority 3: Understand Success Patterns
**Why**: Why do hello-world and test-feature succeed?  
**How**: Compare their structure to failing templates  
**Impact**: Extract patterns for improvements

### Priority 4: Fix Variant Tracking
**Why**: Discrepancy between reported data and Redis data  
**How**: Investigate template-metrics-client.ts  
**Impact**: Consistent metrics across system

---

## Next Actions

1. ✅ Created dashboard
2. ⏳ Find missing 51+ executions
3. ⏳ Check template metadata files
4. ⏳ Query SurrealDB for recent data
5. ⏳ Test zero-execution templates

