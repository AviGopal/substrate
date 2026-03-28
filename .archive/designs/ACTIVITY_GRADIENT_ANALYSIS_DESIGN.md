# Activity Gradient Analysis System - Design Document

**Date**: February 16, 2026  
**Status**: 🔄 Design Phase  
**Purpose**: Build backend capability to analyze activity executions and identify improvement gradients

---

## 🎯 Objective

Build an intelligent analysis system that:
1. **Collects** execution data from all activity runs
2. **Analyzes** patterns across successes and failures
3. **Identifies** gradients for improvement (cost, duration, success rate, quality)
4. **Recommends** specific template enhancements
5. **Learns** continuously from new executions

---

## 📊 Data Collection (ALREADY BUILT ✅)

### Existing Infrastructure

**Database Tables**:
```
activity_executions          → Full execution records (duration, cost, tokens, success)
activity_variants            → Template versions for A/B testing
activity_impressions         → Which templates were shown to agents
activity_selections          → Which templates agents chose
activity_conversions         → Which executions succeeded
variant_performance_metrics  → Aggregated statistics per variant
impulse_effectiveness        → How impulses affect outcomes (Phase 2)
component_changes            → Code modifications per execution (Phase 2)
```

**Data Points Captured**:
- Execution ID, template ID, session ID
- Start time, end time, duration_ms
- Cost (dollars), tokens (input/output/cache)
- Success/failure status
- Variables used
- Impulses referenced (Phase 2)
- Component changes made (Phase 2)
- Error messages (if failed)
- Environment context (language, framework, stack)

**APIs Available**:
- `POST /v2/activities/record/start` - Begin execution tracking
- `POST /v2/activities/record/step` - Record step completion
- `POST /v2/activities/record/complete` - Finalize execution
- `GET /v2/activities/templates/{id}/metrics` - Get aggregated stats

---

## 🔍 Gradient Analysis Types

### 1. **Cost Gradient Analysis**

**Purpose**: Identify which templates/steps are inefficient with token usage

**Metrics**:
- Average cost per execution
- Cost variance (high variance = unpredictable)
- Cost per success (efficiency)
- Token breakdown (input vs output vs cache)
- Outlier detection (executions 2x+ average cost)

**Gradients to Track**:
```python
cost_gradient = {
    "template_id": "add-feature-complete",
    "avg_cost": 0.45,
    "target_cost": 0.25,  # 80th percentile of similar templates
    "gradient": -0.20,    # Negative = needs improvement
    "contributors": [
        {"step": 1, "cost": 0.15, "proportion": 0.33},
        {"step": 2, "cost": 0.25, "proportion": 0.56},  # ← OPTIMIZE THIS
        {"step": 3, "cost": 0.05, "proportion": 0.11}
    ],
    "recommendations": [
        "Step 2 uses 56% of cost - consider reducing context window",
        "Use impulses instead of full file reads (98% size reduction)",
        "Add maxTokens budget to step 2 prompt"
    ]
}
```

### 2. **Duration Gradient Analysis**

**Purpose**: Identify slow executions and bottleneck steps

**Metrics**:
- Average duration per execution
- Duration variance
- Duration per step
- Time-to-first-output (latency)
- Percentile analysis (p50, p90, p99)

**Gradients**:
```python
duration_gradient = {
    "template_id": "fix-bug-complete",
    "avg_duration_ms": 45000,   # 45 seconds
    "target_duration_ms": 30000, # 30 seconds (80th percentile)
    "gradient": -15000,          # Needs 15s improvement
    "bottleneck_steps": [
        {"step": 1, "avg_ms": 5000, "proportion": 0.11},
        {"step": 2, "avg_ms": 35000, "proportion": 0.78},  # ← BOTTLENECK
        {"step": 3, "avg_ms": 5000, "proportion": 0.11}
    ],
    "recommendations": [
        "Step 2 takes 78% of time - add timeout or split into sub-tasks",
        "Consider parallel execution for independent steps",
        "Use streaming responses for faster perceived performance"
    ]
}
```

### 3. **Success Rate Gradient Analysis**

**Purpose**: Identify failure patterns and improve success rates

**Metrics**:
- Success rate per template
- Success rate per step
- Success rate by environment (language, framework)
- Failure categories (validation, execution, timeout)
- Success delta vs baseline

**Gradients**:
```python
success_gradient = {
    "template_id": "refactor-component-complete",
    "success_rate": 0.45,        # 45% success
    "target_success_rate": 0.80, # 80% target
    "gradient": -0.35,           # Needs 35% improvement
    "failure_breakdown": {
        "step_1_validation": 0.05,  # 5% fail at step 1
        "step_2_execution": 0.30,   # 30% fail at step 2 ← FIX THIS
        "step_3_validation": 0.15,  # 15% fail at step 3
        "step_4_complete": 0.05     # 5% fail at step 4
    },
    "common_errors": [
        "TypeError: object is not subscriptable (15 occurrences)",
        "FileNotFoundError (10 occurrences)",
        "Validation failed: missing tests (5 occurrences)"
    ],
    "recommendations": [
        "Add error handling for step 2 TypeError pattern",
        "Add file existence check before step 2",
        "Improve test generation prompt in step 3"
    ]
}
```

### 4. **Impulse Effectiveness Gradient** (Phase 2 Feature)

**Purpose**: Measure how impulses improve execution quality

**Metrics**:
- Success rate with impulse vs without
- Lift per impulse type (file, activityOutput, codebaseIssues, etc.)
- Token savings from using impulses vs full context
- Cross-execution impulse reuse rate

**Gradients**:
```python
impulse_gradient = {
    "template_id": "add-feature-complete",
    "impulse_adoption_rate": 0.20,  # Only 20% of prompts use impulses
    "target_adoption_rate": 0.80,   # Target 80%
    "gradient": -0.60,              # Needs 60% more impulse usage
    "effectiveness_by_type": {
        "file": {"lift": +0.15, "usage": 50, "avg_tokens_saved": 3500},
        "activityOutput": {"lift": +0.25, "usage": 30, "avg_tokens_saved": 8000},
        "codebaseIssues": {"lift": +0.20, "usage": 10, "avg_tokens_saved": 2000}
    },
    "recommendations": [
        "Add impulse references to steps 2 and 4 (currently inline context)",
        "Use activityOutput impulses from step 1 in step 2 (+25% lift)",
        "Replace grep results with codebaseIssues impulse (+20% lift)"
    ]
}
```

### 5. **Quality Gradient Analysis**

**Purpose**: Measure code quality produced by each template

**Metrics**:
- Metabob issue count before/after
- HIGH severity issues introduced
- Test coverage delta
- Code complexity delta (cyclomatic complexity)
- Annotation quality (component annotations created)

**Gradients**:
```python
quality_gradient = {
    "template_id": "add-feature-complete",
    "avg_issues_introduced": 2.5,    # Average 2.5 new issues per execution
    "target_issues_introduced": 0.0, # Target 0 issues
    "gradient": -2.5,                # Needs to eliminate 2.5 issues
    "issue_breakdown": {
        "HIGH_severity": 0.3,   # ← CRITICAL
        "MEDIUM_severity": 1.2,
        "LOW_severity": 1.0
    },
    "common_quality_issues": [
        "Missing error handling (40% of executions)",
        "SQL injection vulnerability (20% of executions)",
        "Missing input validation (30% of executions)"
    ],
    "recommendations": [
        "Add Metabob scan to validation step (catch HIGH issues before commit)",
        "Enhance step 2 prompt with security checklist",
        "Add error handling pattern examples to template"
    ]
}
```

---

## 🛠️ Implementation Plan

### Phase 1: Data Generation (IN PROGRESS)
- [ ] Run 10-15 diverse activities to populate database
- [ ] Use mix of: features, bugs, refactors, infrastructure
- [ ] Ensure both successes and failures captured
- [ ] Verify data collection in all tables

### Phase 2: Analysis Engine Implementation
- [ ] Create `server/actions/gradient_analysis.py`
- [ ] Implement cost gradient analyzer
- [ ] Implement duration gradient analyzer
- [ ] Implement success rate gradient analyzer
- [ ] Implement impulse effectiveness analyzer
- [ ] Implement quality gradient analyzer

### Phase 3: API Endpoints
- [ ] `GET /v2/activities/analysis/gradients` - All gradients summary
- [ ] `GET /v2/activities/analysis/gradients/{template_id}` - Per-template analysis
- [ ] `GET /v2/activities/analysis/recommendations` - Top improvement opportunities
- [ ] `GET /v2/activities/analysis/trends` - Time-series gradient evolution

### Phase 4: Automated Recommendations
- [ ] Create recommendation engine
- [ ] Map gradients → specific template improvements
- [ ] Generate variant suggestions automatically
- [ ] Trigger A/B tests for promising variants

### Phase 5: Dashboard Integration
- [ ] Add gradient visualizations to dashboard
- [ ] Show cost trends over time
- [ ] Show success rate improvements
- [ ] Show impulse adoption metrics

---

## 📈 Success Metrics

**Short Term** (1 week):
- ✅ 50+ executions collected
- ✅ All 5 gradient types computed
- ✅ 10+ specific recommendations generated
- ✅ 3+ templates improved based on gradients

**Medium Term** (1 month):
- ✅ 500+ executions collected
- ✅ Average cost reduced 30%
- ✅ Average success rate increased to 85%+
- ✅ Impulse adoption at 80%+
- ✅ 0 HIGH severity issues introduced

**Long Term** (3 months):
- ✅ 5000+ executions collected
- ✅ Self-improving templates (automatic variant generation)
- ✅ Cross-project learning (templates adapt to new domains)
- ✅ Predictive quality scores (know success before execution)

---

## 🔬 Example: Cost Gradient Analysis Query

```python
# Get cost gradient for all templates
async def analyze_cost_gradients(
    db: SurrealDBClient,
    min_executions: int = 5  # Need at least 5 runs for statistical significance
) -> List[CostGradient]:
    """
    Analyze cost patterns across all templates with sufficient data.
    
    Returns gradients showing which templates need cost optimization.
    """
    
    query = """
    SELECT 
        template_id,
        count() AS execution_count,
        math::mean(cost) AS avg_cost,
        math::stddev(cost) AS cost_stddev,
        math::percentile(cost, 80) AS p80_cost,
        math::sum(cost) AS total_cost,
        math::mean(tokens.input) AS avg_input_tokens,
        math::mean(tokens.output) AS avg_output_tokens,
        array::group(step_costs) AS cost_by_step
    FROM activity_executions
    WHERE cost IS NOT NONE AND success = true
    GROUP BY template_id
    HAVING count() >= $min_executions
    ORDER BY avg_cost DESC
    """
    
    results = await db.query(query, {"min_executions": min_executions})
    
    gradients = []
    for row in results:
        # Calculate gradient (negative = needs improvement)
        baseline_cost = compute_baseline_cost_for_category(row['template_id'])
        gradient = row['avg_cost'] - baseline_cost
        
        # Identify bottleneck steps
        bottlenecks = identify_cost_bottlenecks(row['cost_by_step'])
        
        # Generate recommendations
        recommendations = generate_cost_recommendations(
            template_id=row['template_id'],
            avg_cost=row['avg_cost'],
            bottlenecks=bottlenecks,
            token_distribution={'input': row['avg_input_tokens'], 'output': row['avg_output_tokens']}
        )
        
        gradients.append(CostGradient(
            template_id=row['template_id'],
            avg_cost=row['avg_cost'],
            target_cost=baseline_cost,
            gradient=gradient,
            bottlenecks=bottlenecks,
            recommendations=recommendations
        ))
    
    return gradients
```

---

## 🎓 Learning Loop

```
Execute Activities
    ↓
Collect Execution Data
    ↓
Compute Gradients (5 types)
    ↓
Generate Recommendations
    ↓
Create Template Variants
    ↓
A/B Test Variants
    ↓
Select Best Performers
    ↓
Update Templates
    ↓
(Loop back to Execute)
```

This creates a **continuous improvement system** where templates get better over time automatically.

---

## 🚀 Next Steps

1. **Run activities to generate data** (starting now)
2. **Implement gradient analysis engine** (1-2 days)
3. **Create API endpoints** (1 day)
4. **Build dashboard visualizations** (1-2 days)
5. **Enable automated recommendations** (2-3 days)

**Total Timeline**: 1 week to fully operational gradient analysis system

---

## 📚 References

- Backend tables: `server/actions/init_activity_schema.py`
- Learning system: `server/actions/activity_learning.py`
- V2 API: `server/routes/v2_activities.py`
- Proto models: `proto/metabob/activity/execution.proto`
