# Recommendation Improvement Guide

Complete workflow for improving Thompson Sampling recommendation relevancy using the diagnostic tool.

## The Improvement Cycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. GET RECOMMENDATIONS                                     │
│     Get baseline recommendations for a goal                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ANALYZE QUALITY                                         │
│     Review relevancy, scores, and heuristic boosts          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. IDENTIFY ISSUES                                         │
│     Find irrelevant templates, missing relevant ones        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. APPLY FEEDBACK                                          │
│     Penalize bad, boost good templates                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. VERIFY IMPROVEMENTS                                     │
│     Re-run recommendations, compare with baseline           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       └──────────────────────────────────────┐
                                                              │
                       ┌──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  6. ITERATE                                                 │
│     Monitor execution outcomes, refine further              │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Walkthrough

### Step 1: Get Baseline Recommendations

Start by getting recommendations for your goal:

```bash
bun diagnostic-activity-api.ts recommend "analyze failed test execution and suggest fixes" --limit 5
```

**Sample Output:**
```
📊 Thompson Sampling Recommendations:

1. Acquire Requirements Context (acquire-requirements-context)
   Thompson Score: 0.9844
   Beta Parameters: α=9.00, β=1.00
   Score Source: global
   Heuristic Boost: +8

2. trace-enforce-validate-loop (trace-enforce-validate-loop)
   Thompson Score: 0.9819
   Beta Parameters: α=10.00, β=1.00
   Score Source: global
   Heuristic Boost: +9

3. Build a complete JWT-based authentication system (jwt-authentication-system)
   Thompson Score: 0.9691
   Beta Parameters: α=9.00, β=1.00
   Score Source: global
   Heuristic Boost: +8
```

### Step 2: Analyze Quality

Ask these questions:

**Relevancy Check:**
- ✅ "Acquire Requirements Context" - Maybe useful for understanding test requirements
- ⚠️  "trace-enforce-validate-loop" - Could be relevant for test validation
- ❌ "JWT authentication system" - **NOT RELEVANT** for test failure analysis

**Score Analysis:**
- All templates have similar high scores (0.96-0.98)
- All have low β (1.00) indicating little execution history
- Score source is "global" (not shape-conditioned)
- Heuristic boosts are similar (+8 to +9)

**Heuristic Breakdown:**
Check the boost breakdown to understand why each scored:
```
Boost Breakdown:
  • Tag Match: +0              ← No semantic tag matching
  • Shape Compatible: +3       ← Generic shape compatibility
  • Recency: +1                ← Recently created
  • Execution History: +0      ← No execution history
  • Scope Preference: +0/+1    ← Not org-specific
  • Impulse Relevancy: +0      ← No impulses loaded
  • Category Match: +0         ← Wrong category
  • Output Shape Coverage: +4  ← Generic output coverage
```

**Key Insight:** Templates are scoring based on generic factors, not semantic relevance.

### Step 3: Identify Issues

**Problem 1: Irrelevant Templates**
- "JWT authentication system" is completely irrelevant for test analysis
- Getting recommended due to generic heuristic boosts, not semantic match

**Problem 2: Missing Relevant Templates**
- No templates explicitly for test failure analysis
- No templates for error diagnosis
- No templates for suggesting fixes based on failures

**Problem 3: Lack of Shape Conditioning**
- Not using shape-conditioned scoring
- Should specify input shapes: `errorLog`, `testResult`, `activityExecutionTrace`

### Step 4: Apply Feedback

#### A. Penalize Irrelevant Templates

```bash
# Strongly penalize JWT auth template for test analysis tasks
bun diagnostic-activity-api.ts feedback jwt-authentication-system negative 2 \
  --reason "completely irrelevant for test failure analysis"
```

**What this does:**
- Multiplies β (failure parameter) by 2.5x (intensity 2)
- β increases from 1.00 to 2.50
- Thompson Sampling now samples lower values for this template
- Template will rank lower in future recommendations

#### B. Search for Relevant Templates

```bash
# List templates by category
bun diagnostic-activity-api.ts list --category bugfix --limit 10
bun diagnostic-activity-api.ts list --category tool --limit 10

# Search for error-related templates
bun diagnostic-activity-api.ts list --limit 50 | grep -i "error\|test\|debug\|diagnose"
```

If you find relevant templates (e.g., "analyze-error-logs", "debug-test-failures"):

```bash
# Boost relevant templates
bun diagnostic-activity-api.ts feedback analyze-error-logs positive 2 \
  --reason "directly relevant for test failure analysis"

bun diagnostic-activity-api.ts feedback debug-test-failures positive 2 \
  --reason "explicitly designed for this use case"
```

**What this does:**
- Multiplies α (success parameter) by 2.5x (intensity 2)
- α increases from 1.00 to 2.50
- Template will rank higher in future recommendations

#### C. Use Shape Filtering

```bash
# Get recommendations with shape filtering
bun diagnostic-activity-api.ts recommend \
  "analyze failed test execution and suggest fixes" \
  --shapes errorLog,testResult,activityExecutionTrace \
  --limit 5
```

**What this does:**
- Uses shape-conditioned Thompson Sampling
- Only considers templates that can process these input shapes
- Learns separate α/β parameters per input shape combination

#### D. Use Category Filtering

```bash
# Get recommendations filtered by category
bun diagnostic-activity-api.ts recommend \
  "analyze failed test execution and suggest fixes" \
  --category bugfix \
  --limit 5
```

**What this does:**
- Applies +3 category match boost to bugfix templates
- Filters out unrelated categories

### Step 5: Verify Improvements

Re-run the original recommendation query:

```bash
bun diagnostic-activity-api.ts recommend \
  "analyze failed test execution and suggest fixes" \
  --limit 5
```

**Expected Changes:**

**Before Feedback:**
```
1. Acquire Requirements Context - Score: 0.9844, α=9.00, β=1.00
2. trace-enforce-validate-loop - Score: 0.9819, α=10.00, β=1.00
3. JWT authentication system - Score: 0.9691, α=9.00, β=1.00 ← Irrelevant
```

**After Feedback:**
```
1. Acquire Requirements Context - Score: 0.9844, α=9.00, β=1.00
2. trace-enforce-validate-loop - Score: 0.9819, α=10.00, β=1.00
3. analyze-error-logs - Score: 0.9500, α=2.50, β=1.00 ← Now boosted
4. debug-test-failures - Score: 0.9200, α=2.50, β=1.00 ← Now boosted
5. JWT authentication system - Score: 0.3100, α=9.00, β=2.50 ← Penalized, dropped rank
```

**Key Observations:**
- JWT template dropped significantly in ranking
- Relevant templates now appear in top 5
- Thompson Sampling β penalty caused ranking drop
- Thompson Sampling α boost elevated relevant templates

### Step 6: Iterate

#### Monitor Execution Outcomes

As activities execute, Thompson Sampling automatically learns:

```bash
# After several executions of "analyze-error-logs" activity:
# - Success → α increases naturally
# - Failure → β increases naturally
# - Thompson Sampling converges on true success rate
```

**Execution Tracking:**
- Each execution updates α (if success) or β (if failure)
- Manual feedback provides initial guidance
- Real execution outcomes provide long-term learning
- System converges on optimal recommendations through experience

#### Refine Further

Based on execution outcomes:

```bash
# If a boosted template performs poorly in practice
bun diagnostic-activity-api.ts feedback analyze-error-logs negative 1 \
  --reason "produces too many false positives"

# If an unexpected template performs well
bun diagnostic-activity-api.ts feedback surprise-template positive 1 \
  --reason "surprisingly effective for this use case"
```

#### Use Adjacent Feedback

Boost/penalize templates and their composition neighbors:

```bash
# Boost template and its typical successors
bun diagnostic-activity-api.ts feedback good-template positive 2 --adjacent
```

**What this does:**
- Applies full multiplier to specified template
- Applies reduced multiplier (50%) to adjacent templates in composition graph
- Useful for reinforcing successful workflow patterns

## Advanced Techniques

### Technique 1: Shape-Conditioned Learning

Track template performance per input shape combination:

```bash
# Recommendation with shape A
bun diagnostic-activity-api.ts recommend "task" --shapes errorLog --limit 3

# Recommendation with shape B
bun diagnostic-activity-api.ts recommend "task" --shapes testResult --limit 3

# Compare differences in rankings
```

**Why this matters:**
- Template may work well with `errorLog` but poorly with `testResult`
- Shape-conditioned scoring learns these patterns
- Recommendations adapt to available input data

### Technique 2: Output Shape Targeting

Specify expected output shapes for outcome-driven recommendations:

```bash
bun diagnostic-activity-api.ts recommend \
  "analyze data and generate report" \
  --output-shapes analysis,report \
  --limit 5
```

**What this does:**
- Applies +0 to +4 output shape coverage boost
- Templates producing expected outputs rank higher
- Goal-oriented recommendation selection

### Technique 3: Exploration vs Exploitation Tuning

Use feedback intensity to control exploration:

**Exploitation (prefer proven templates):**
```bash
# Strongly boost known-good template
bun diagnostic-activity-api.ts feedback proven-template positive 3
# α increases 3.0x → high mean, low variance → exploitation
```

**Exploration (try uncertain templates):**
```bash
# Mildly boost uncertain template
bun diagnostic-activity-api.ts feedback new-template positive 0
# α increases 1.5x → moderate mean, high variance → exploration
```

**Theory:**
- Higher α/β → lower variance → exploitation (use what works)
- Lower α/β → higher variance → exploration (try new things)
- Thompson Sampling automatically balances this tradeoff

### Technique 4: Category Hierarchies

Use category filtering strategically:

```bash
# Narrow search to specific category
bun diagnostic-activity-api.ts recommend "task" --category bugfix

# Compare with broader category
bun diagnostic-activity-api.ts recommend "task" --category feature

# No category filter (search all)
bun diagnostic-activity-api.ts recommend "task"
```

### Technique 5: Composition-Based Boosting

Boost activities that compose well together:

```bash
# Find composition patterns
bun diagnostic-activity-api.ts composition parent-activity --min-weight 0.8

# Boost high-weight successors
bun diagnostic-activity-api.ts feedback high-weight-successor positive 1 \
  --reason "composes well with parent-activity"
```

## Measuring Improvement

### Quantitative Metrics

**Thompson Sampling Score Changes:**
```bash
# Before: Score = 0.9691, α=9.00, β=1.00
# After:  Score = 0.3100, α=9.00, β=2.50
# Impact: -65% score reduction (β penalty working)
```

**Ranking Changes:**
```bash
# Before: Position #3
# After:  Position #8 (dropped 5 positions)
# Impact: Removed from top 5 recommendations
```

**Execution Success Rate (over time):**
```bash
# Week 1: 40% success rate (poor recommendations)
# Week 2: 65% success rate (after feedback)
# Week 3: 80% success rate (Thompson Sampling learned)
# Week 4: 85% success rate (converged on optimal)
```

### Qualitative Metrics

**Relevancy Assessment:**
- How many top-5 recommendations are actually relevant?
- Target: 80%+ relevancy in top 5

**User Satisfaction:**
- Are recommended activities accomplishing the goal?
- Do users have to manually search for alternatives?

**Execution Outcomes:**
- Are recommended activities succeeding when executed?
- Are they producing expected outputs?

## Common Patterns

### Pattern 1: Generic Templates Ranking Too High

**Symptom:**
- Generic "boilerplate" templates always rank #1
- They work for everything but excel at nothing

**Solution:**
```bash
# Penalize generic templates
bun diagnostic-activity-api.ts feedback generic-template negative 1 \
  --reason "too generic, prefer specialized templates"

# Boost specialized templates
bun diagnostic-activity-api.ts feedback specialized-template positive 2 \
  --reason "specialized for this specific use case"
```

### Pattern 2: Old Templates Dominating New Ones

**Symptom:**
- Old templates have high α from accumulated successes
- New potentially better templates can't compete

**Solution:**
```bash
# Give new templates a boost to enable exploration
bun diagnostic-activity-api.ts feedback new-template positive 1 \
  --reason "enable exploration of new approach"

# Let execution outcomes decide if it's actually better
# (Thompson Sampling will naturally adjust based on performance)
```

### Pattern 3: Category Mismatch

**Symptom:**
- Getting "feature" templates for "bugfix" goals
- Category boost not being applied

**Solution:**
```bash
# Use category filter in recommendations
bun diagnostic-activity-api.ts recommend "fix bug" --category bugfix

# Or penalize wrong-category templates
bun diagnostic-activity-api.ts feedback feature-template negative 1 \
  --reason "wrong category for bug fixes"
```

### Pattern 4: Missing Shape Awareness

**Symptom:**
- Getting templates that can't process available data
- Recommendations ignore input impulse types

**Solution:**
```bash
# Always specify available shapes
bun diagnostic-activity-api.ts recommend "task" \
  --shapes errorLog,activityExecutionTrace,testResult

# This enables shape-conditioned scoring
```

## Troubleshooting

### Problem: Feedback Not Taking Effect

**Check:**
1. Did feedback API succeed?
   ```bash
   # Should see: "✅ Feedback submitted successfully!"
   ```

2. Re-run recommendations to verify change:
   ```bash
   bun diagnostic-activity-api.ts recommend "task" --limit 10
   # Check if α/β parameters changed for target template
   ```

3. Verify template ID is correct:
   ```bash
   bun diagnostic-activity-api.ts list --limit 20 | grep "template-name"
   ```

### Problem: Templates Still Irrelevant After Feedback

**Reasons:**
1. Other heuristic boosts overriding feedback
2. Need stronger intensity (use level 2-3 instead of 0-1)
3. Need to boost relevant templates, not just penalize irrelevant ones

**Solution:**
```bash
# Use stronger intensity
bun diagnostic-activity-api.ts feedback bad-template negative 3

# Boost multiple relevant templates
bun diagnostic-activity-api.ts feedback good-template-1 positive 2
bun diagnostic-activity-api.ts feedback good-template-2 positive 2
bun diagnostic-activity-api.ts feedback good-template-3 positive 2
```

### Problem: Can't Find Relevant Templates

**Reasons:**
1. Relevant templates don't exist yet
2. Templates have unexpected names/categories
3. Need to create new templates

**Solution:**
```bash
# Search more broadly
bun diagnostic-activity-api.ts list --limit 100 > all-templates.txt
grep -i "keyword" all-templates.txt

# Search by category
bun diagnostic-activity-api.ts list --category bugfix --limit 50
bun diagnostic-activity-api.ts list --category tool --limit 50

# If truly missing, create new template via MiniBob
```

## Integration with MiniBob

### Closed-Loop Learning

MiniBob can use feedback automatically:

```bash
# MiniBob workflow:
# 1. Get recommendations
recommendations = await activityAPI.recommend(goal)

# 2. Execute top recommendation
result = await execute(recommendations[0])

# 3. Provide automatic feedback based on outcome
if (result.success) {
  await activityAPI.feedback(recommendations[0].id, 'positive', 1)
} else {
  await activityAPI.feedback(recommendations[0].id, 'negative', 1)
}

# 4. Thompson Sampling learns from feedback
# 5. Next recommendation uses updated α/β parameters
```

### Ribosome Pattern Integration

When activities succeed, extract them as templates:

```bash
# Activity succeeds → Ribosome extracts template → New template available
# New template starts with α=1, β=1 (uniform prior)
# Boost it to enable exploration:
bun diagnostic-activity-api.ts feedback new-extracted-template positive 1 \
  --reason "extracted from successful execution, enable exploration"
```

## Summary

**The Key Principles:**

1. **Start with Baseline:** Always get initial recommendations before applying feedback
2. **Analyze Carefully:** Understand why templates score the way they do
3. **Apply Targeted Feedback:** Penalize irrelevant, boost relevant
4. **Use Filters:** Shape and category filters improve relevancy immediately
5. **Verify Changes:** Re-run recommendations to confirm feedback effect
6. **Iterate Continuously:** Monitor execution outcomes, refine further
7. **Trust the Learning:** Thompson Sampling converges on optimal recommendations through experience

**The Improvement Cycle:**
```
Get → Analyze → Feedback → Verify → Iterate
 ↑                                     ↓
 └─────────────────────────────────────┘
```

**Expected Timeline:**
- **Day 1:** Apply initial feedback, see immediate ranking changes
- **Week 1:** Templates execute, α/β parameters adjust based on outcomes
- **Week 2-4:** Thompson Sampling converges on optimal recommendations
- **Month 1+:** Continuous refinement as new templates are created

**Success Metrics:**
- 80%+ relevancy in top 5 recommendations
- 85%+ execution success rate
- Decreasing need for manual feedback over time (system learns automatically)

For more information, see:
- `ACTIVITY_API_DIAGNOSTIC.md` - Complete command reference
- `diagnostic-activity-api.ts` - Diagnostic tool source
- `diagnostic-workflow-test.sh` - Automated testing workflow
