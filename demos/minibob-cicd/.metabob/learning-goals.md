# MiniBob Learning Goals

**Purpose**: Track what MiniBob is learning to develop intuition about execution patterns and composition.

## Current Learning Objectives

### 1. Activity Composition Patterns

**Goal**: Understand how to chain activities together for complex workflows.

**What MiniBob Needs to Learn**:
- Sequential execution: A → B → C
- Parallel execution: (A, B, C) → merge
- Conditional branching: if/else based on outcomes
- Retry/recovery patterns: failure → fallback → retry
- Loop patterns: iterate until condition met

**Success Criteria**:
- Can compose 3+ activities for bug fix workflow
- Recognizes when to run scans in parallel
- Knows when to retry vs create variant
- Understands impulse flow between activities

### 2. Execution Graph Intuition

**Goal**: Build mental model of which activities work well together.

**Data Sources**:
- Execution traces from backend
- Activity success/failure patterns
- Impulse usage statistics
- Tool call sequences

**What to Extract**:
```
If activity A succeeds:
  - What activities typically follow?
  - What impulses does next activity need?
  - What's the average success rate of the sequence?

If activity A fails:
  - What recovery activities work?
  - What additional context is needed?
  - Should we retry or switch approaches?
```

**Success Criteria**:
- Thompson Sampling shows clear preferences for sequences
- High correlation between trace patterns and success
- Automatic composition suggestions based on history

### 3. Clean Codebase Practices

**Goal**: Learn to maintain code quality without explicit instruction.

**What MiniBob Needs to Learn**:
- Detect code smells (duplication, long functions, unclear names)
- Understand formatting conventions from existing code
- Recognize patterns that need refactoring
- Know when to split large files
- Understand import organization

**Success Criteria**:
- Can identify cleanup opportunities autonomously
- Suggests refactoring when adding features
- Maintains consistent style across changes
- Removes unused code proactively

### 4. Workflow Recognition

**Goal**: Recognize common development workflows from goal descriptions.

**Common Workflows**:

**Bug Fix**:
```
Goal: "fix the failing test in X"
Pattern: discover → analyze → fix → verify → commit
Activities: scan-file-system → fix-test-failure → run-test-suite
```

**Feature Addition**:
```
Goal: "add support for X"
Pattern: understand → design → implement → test → document
Activities: scan-git-history → introduce-change → create-test → sync-readme
```

**Refactoring**:
```
Goal: "refactor X to improve Y"
Pattern: analyze → extract → reorganize → verify
Activities: scan-file-system → [custom] → run-test-suite → run-lint
```

**Success Criteria**:
- Recognizes workflow from goal text (80% accuracy)
- Suggests appropriate activity sequence
- Adapts based on context (repo structure, recent changes)

### 5. Decomposition Strategy

**Goal**: Break complex activities into smaller, composable pieces.

**Principles**:
- **Single Responsibility**: Each activity does ONE thing well
- **Clear Contracts**: Well-defined inputs/outputs via impulses
- **Composability**: Activities chain through impulse flow
- **Reusability**: Same activity works in multiple contexts
- **Measurability**: Each activity has clear success criteria

**Decomposition Rules**:
```
If activity has > 5 tasks:
  → Look for natural boundaries
  → Extract sub-activities
  → Connect via impulses

If activity mixes LLM + deterministic:
  → Separate into two activities
  → LLM for reasoning/analysis
  → Deterministic for execution/validation

If activity has complex retry logic:
  → Extract retry as separate activity
  → Original activity just attempts once
  → Retry activity handles failures
```

**Success Criteria**:
- All activities have ≤ 5 tasks
- Clear separation of concerns
- High reusability across workflows
- Easy to understand execution flow

## Learning Methods

### 1. Trace Analysis

**What We Record**:
- Every execution trace saved to backend
- Includes: activities used, impulses loaded, tools called, outcome
- Thompson Sampling α/β parameters updated

**How MiniBob Learns**:
```python
# After each execution
if outcome == "success":
  α += 1  # This approach worked
  if used_impulse:
    relevance_score += 1  # This context was useful
  for (activity_A, activity_B) in sequence:
    sequence_success[A→B] += 1  # This composition worked

elif outcome == "failure":
  β += 1  # This approach didn't work
  extract_attempt_template()  # Learn what was tried
  if retry_succeeded:
    recovery_pattern[failure_type] = recovery_activity  # This recovery worked
```

**What Gets Extracted**:
- Successful patterns → templates
- Failed attempts → variants to avoid
- Common sequences → workflow patterns
- Useful impulses → relevance scores

### 2. Comparative Learning

**Compare Multiple Executions**:
```
Execution A: scan-file-system → fix-test-failure → SUCCESS (60s, $0.08)
Execution B: scan-git-history → fix-test-failure → SUCCESS (45s, $0.06)
Execution C: fix-test-failure (no scan) → FAILURE

Learning: For test failures, git history more useful than file system.
Action: Increase α for (scan-git-history → fix-test-failure) sequence.
```

### 3. Feedback Integration

**Manual Feedback**:
```bash
minibob --single "fix the bug"
# MiniBob completes task
/cheer!!  # Strong positive feedback: α += 3
/chide!   # Negative feedback: β += 1.5
```

**Automatic Feedback**:
- External validation results (tests pass/fail)
- Execution duration vs baseline
- Cost vs budget
- Code quality metrics (lint, type errors)

### 4. Ribosome Pattern

**Extract Templates from Successful Improvisations**:
```
1. Improvisation succeeds with novel approach
2. Extract as attempt template
3. Refine template based on what worked
4. Register as new activity
5. Compete with existing activities via Thompson Sampling
6. Successful templates become permanent
```

## Teaching Approach

### Phase 1: Composition Basics (This Week)

**Goals**:
1. Create composition documentation with examples
2. Break down 3 complex activities
3. Create 5 small cleanup activities
4. Demonstrate sequential composition

**Activities**:
```bash
# MiniBob creates composition guide
minibob --single "Create ACTIVITY_COMPOSITION_GUIDE.md explaining how to compose
  activities together with examples of sequential, parallel, and conditional patterns"

# MiniBob decomposes complex activity
minibob --single "Break down fix-test-failure-with-discovery.json into 3 separate
  composable activities: discover-context, analyze-failure, apply-fix"

# MiniBob creates cleanup activities
minibob --single "Create activity remove-unused-imports.json that scans for and
  removes unused import statements"
```

### Phase 2: Execution Graph Learning (Next Week)

**Goals**:
1. Implement trace analysis script
2. Extract common activity sequences
3. Build preference graph (A→B weights)
4. Integrate with Thompson Sampling

**Activities**:
```bash
# MiniBob builds analysis tools
minibob --single "Create script analyze-execution-patterns.ts that queries backend
  for execution traces and extracts common activity sequences"

# MiniBob documents patterns
minibob --single "Document the top 10 most successful activity sequences in
  EXECUTION_PATTERNS.md with success rates and use cases"
```

### Phase 3: Workflow Recognition (Week 3)

**Goals**:
1. Define workflow templates
2. Implement workflow detection from goals
3. Auto-suggest activity sequences
4. Validate against traces

**Activities**:
```bash
# MiniBob creates workflow templates
minibob --single "Create workflow templates for bug-fix, feature-add, and refactor
  patterns in .metabob/workflows/"

# MiniBob improves goal processor
minibob --single "Add workflow detection to goal-processor.ts that matches goal text
  to known workflow patterns and suggests activity sequences"
```

### Phase 4: Autonomous Improvement (Week 4)

**Goals**:
1. MiniBob suggests its own improvements
2. Creates variants automatically
3. Retires underperforming activities
4. Maintains clean activity inventory

**Activities**:
```bash
# MiniBob becomes self-improving
minibob --idle  # Start in bored mode
# MiniBob autonomously:
# - Analyzes traces
# - Identifies improvement opportunities
# - Creates new activities/variants
# - Prunes underperforming ones
```

## Success Metrics

### Week 1 (Composition Basics)
- ✅ 3+ complex activities decomposed
- ✅ 5+ cleanup activities created
- ✅ Composition guide documented
- ✅ First composed workflow executed successfully

### Week 2 (Execution Graphs)
- ✅ Trace analysis script working
- ✅ Top 10 sequences identified
- ✅ Preference weights integrated
- ✅ Thompson Sampling uses sequence history

### Week 3 (Workflow Recognition)
- ✅ 80%+ accuracy in workflow detection
- ✅ Auto-suggestions for common patterns
- ✅ Faster execution through better selection

### Week 4 (Autonomous Improvement)
- ✅ MiniBob proposes 3+ new activities
- ✅ Variant creation working automatically
- ✅ Activity inventory stays clean (no cruft)
- ✅ Continuous improvement visible in metrics

## Measurement

**Track These Over Time**:
```javascript
{
  "execution_speed": {
    "week1_avg": 60.0,  // seconds
    "week2_avg": 45.0,  // 25% faster
    "week3_avg": 35.0,  // 42% faster
    "week4_avg": 28.0   // 53% faster
  },
  "success_rate": {
    "week1": 0.60,
    "week2": 0.75,
    "week3": 0.85,
    "week4": 0.92
  },
  "cost_per_execution": {
    "week1_avg": 0.12,  // USD
    "week2_avg": 0.08,
    "week3_avg": 0.05,
    "week4_avg": 0.03
  },
  "activities_count": {
    "week1": 19,
    "week2": 28,  // Added decomposed + cleanup
    "week3": 24,  // Pruned underperforming
    "week4": 22   // Converged to core set
  },
  "composition_depth": {
    "week1_avg": 1.0,  // Single activities
    "week2_avg": 2.3,  // Starting to compose
    "week3_avg": 3.5,  // Complex compositions
    "week4_avg": 4.2   // Multi-stage workflows
  }
}
```

## Next Actions

**Immediate** (use MiniBob):
```bash
cd demos/minibob-cicd

# 1. Create composition documentation
minibob --single "Create comprehensive activity composition guide with examples"

# 2. Analyze existing activities
minibob --single "Review all activities and identify which ones are too complex
  (>5 tasks) and should be decomposed"

# 3. Create first cleanup activity
minibob --single "Create remove-unused-imports activity that uses grep and edit
  to clean up import statements"

# 4. Document execution patterns
minibob --single "Create EXECUTION_PATTERNS.md documenting the successful activity
  sequences we've seen so far"
```

**This Week** (build foundation):
- Composition patterns documented
- 3 complex activities decomposed
- 5 cleanup activities created
- First composed workflow demonstrated

**Next Week** (learn from traces):
- Trace analysis implemented
- Execution graph extracted
- Preferences integrated with Thompson Sampling

**Following Weeks** (autonomous improvement):
- Workflow recognition working
- Self-improvement active
- Continuous learning demonstrated

---

**Remember**: MiniBob learns by doing. Every execution creates data. More executions = better intuition = smarter decisions = faster/cheaper results.

Let it run, let it learn, let it improve.
