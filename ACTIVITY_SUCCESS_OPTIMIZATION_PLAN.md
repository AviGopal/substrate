# Activity Template Success Optimization Plan

## Current State Analysis

### create-activity-template Template

**Current Strengths** ✅:
- Two-task structure with explicit dependencies
- Verification step using search_activities
- Temporary working directory (prevents pollution)
- Learning section with patterns documented
- Quality gates for JSON validation

**Current Weaknesses** ❌:
- Task 1 validation too permissive (only checks basic patterns)
- No enforcement of task count limits
- No validation of dependency graph integrity
- Example injection relies on agent remembering to use them
- No intermediate checkpoints between design and registration

---

## Success Rate Improvement Strategy

### Target Metrics

| Metric | Current | Target (3 months) | Target (6 months) |
|--------|---------|-------------------|-------------------|
| Success Rate | ~65% (estimated) | 80% | 90% |
| Avg Duration | ~25 min | 20 min | 15 min |
| Avg Cost | ~$2.50 | $2.00 | $1.50 |
| Template Quality Score | Unknown | 8/10 | 9/10 |

---

## Phase 1: Enhanced Validation (Week 1-2)

### Problem: Templates with Schema Errors

**Current failure mode**: Agent creates JSON with missing fields, wrong types, invalid structure.

**Solution**: Add comprehensive validation to Task 1

```json
{
  "tasks": [
    {
      "id": "create-and-register-template",
      "validation": {
        "requiredFiles": ["*.json"],
        "requiredPatterns": [
          "\"name\":",
          "\"description\":",
          "\"category\":",
          "\"tasks\":",
          "\"validation\":",     // ← NEW: All templates need validation
          "\"retry\":",          // ← NEW: All templates need retry
          "\"prompt\":",         // ← NEW: All tasks need prompts
          "\"maxTokens\":"       // ← NEW: All prompts need budgets
        ],
        "forbiddenPatterns": [
          "TODO",                     // No TODOs in templates
          "\"subagent\": \"\"",      // Empty agent assignment
          "\"maxTokens\": 0",        // Zero token budget
          "\"dependencies\": null"   // Null dependencies (should be [])
        ],
        "commands": [
          {
            "name": "validate-json-syntax",
            "command": "jq empty *.json",
            "required": true
          },
          {
            "name": "validate-task-count",
            "command": "jq -e '.tasks | length > 0 and length <= 7' *.json",
            "required": true
          },
          {
            "name": "validate-dependency-graph",
            "command": "jq -e '.tasks | map(.dependencies // []) | flatten | unique | all(. as $dep | any(.tasks[]; .id == $dep))' *.json",
            "required": true
          },
          {
            "name": "validate-all-tasks-have-validation",
            "command": "jq -e '.tasks | all(.validation)' *.json",
            "required": true
          }
        ]
      }
    }
  ]
}
```

**Expected impact**: +10-15% success rate (catches errors early)

---

## Phase 2: Guided Template Design (Week 3-4)

### Problem: Agent Skips Examples

**Current failure mode**: Agent designs template without studying examples, leading to non-standard patterns.

**Solution**: Add explicit checkpoint task

```json
{
  "tasks": [
    {
      "id": "analyze-examples",
      "subagent": "general",
      "description": "Study example templates and extract patterns",
      "dependencies": [],
      "prompt": {
        "template": "Study the provided template examples.\n\nFor each example:\n1. Identify task structure patterns\n2. Note validation strategies\n3. Observe retry configurations\n4. Extract variable patterns\n\nOutput:\n- Common patterns observed\n- Best practices identified\n- Anti-patterns to avoid\n\nThis analysis will guide your template design.",
        "maxTokens": 6000,
        "compressionStrategy": "filter"
      },
      "validation": {
        "requiredPatterns": [
          "patterns observed",
          "best practices"
        ]
      }
    },
    {
      "id": "design-task-graph",
      "subagent": "general",
      "description": "Design task dependency graph",
      "dependencies": ["analyze-examples"],
      "prompt": {
        "template": "Design the task graph for {{templateName}}.\n\nOutput a text diagram:\n```\ntask-1 (agent: general)\n  ↓\ntask-2 (agent: config)\n  ↓\ntask-3 (agent: test)\n```\n\nInclude:\n- Task IDs (kebab-case)\n- Agent assignments\n- Dependencies (arrows)\n- Validation requirements\n\nValidate:\n- 3-7 tasks maximum\n- No circular dependencies\n- Appropriate agent specialization",
        "maxTokens": 4000
      },
      "validation": {
        "requiredPatterns": [
          "task-",
          "agent:",
          "↓"
        ]
      }
    },
    {
      "id": "write-template-json",
      "subagent": "general",
      "description": "Write template JSON following the designed task graph",
      "dependencies": ["design-task-graph"],
      "prompt": {
        "template": "Convert your task graph design into ActivityTemplate JSON.\n\nUse the patterns from examples and your designed graph.\n\nValidate before proceeding:\n- Task count: 3-7\n- All tasks have validation rules\n- All tasks have retry config\n- Dependencies match graph\n- Agent assignments appropriate",
        "maxTokens": 8000
      },
      "validation": {
        "requiredFiles": ["*.json"],
        "commands": [
          { "name": "validate-schema", "command": "jq empty *.json", "required": true }
        ]
      }
    },
    {
      "id": "register-template",
      "description": "Register with Metabob backend",
      "dependencies": ["write-template-json"],
      // ... existing registration logic
    }
  ]
}
```

**Expected impact**: +15-20% success rate (forces deliberate design)

---

## Phase 3: Success Pattern Enforcement (Week 5-6)

### Problem: Agent Doesn't Follow Best Practices

**Solution**: Add pre-execution checks

```json
{
  "hooks": {
    "preActivity": {
      "checks": [
        {
          "name": "examples-available",
          "command": "search_activities({ category: '{{category}}', verbose: true })",
          "failOn": "templates.length === 0",
          "message": "No examples available for category {{category}}. Consider using 'tool' category or studying cross-category examples."
        }
      ]
    },
    "betweenTasks": {
      "validations": [
        {
          "afterTask": "analyze-examples",
          "check": {
            "type": "output_contains",
            "required": ["patterns", "best practices"],
            "message": "Task output must identify patterns and best practices from examples"
          }
        },
        {
          "afterTask": "design-task-graph",
          "check": {
            "type": "output_contains",
            "required": ["task-", "agent:", "↓"],
            "message": "Task graph must be well-formed with tasks, agents, and dependencies"
          }
        }
      ]
    }
  }
}
```

**Expected impact**: +5-10% success rate (enforces process)

---

## Phase 4: Automated Template Evolution (Week 7-8)

### Analysis Pipeline

```typescript
// Scheduled job: Daily analysis of template performance
async function analyzeTemplatePerformance() {
  const templates = await TemplateRepository.list()
  
  for (const template of templates) {
    if (template.executions < 10) continue  // Need more data
    
    // Fetch execution history
    const executions = await MetabobAPI.getTemplateExecutions(template.id)
    
    // Analyze failure patterns
    const failures = executions.filter(e => !e.success)
    const failurePatterns = aggregateFailurePatterns(failures)
    
    // Check if improvement is possible
    if (template.successRate < 0.80 && failurePatterns.length > 0) {
      // Generate optimization suggestions
      const optimizations = generateOptimizations(template, failurePatterns)
      
      // Create evolved variant
      if (optimizations.confidence > 0.7) {
        await createEvolvedVariant(template, optimizations)
      }
    }
  }
}

function aggregateFailurePatterns(failures: Execution[]): FailurePattern[] {
  const patterns: Map<string, FailurePattern> = new Map()
  
  for (const failure of failures) {
    // Extract failure reason
    const reason = failure.error || failure.validationFailure
    
    // Categorize
    const category = categorizeFailure(reason)
    
    // Aggregate
    if (!patterns.has(category)) {
      patterns.set(category, {
        category,
        count: 0,
        examples: [],
        suggestedFix: null
      })
    }
    
    const pattern = patterns.get(category)!
    pattern.count++
    pattern.examples.push(reason)
  }
  
  // Generate fixes for common patterns
  for (const pattern of patterns.values()) {
    if (pattern.count / failures.length > 0.3) {  // >30% of failures
      pattern.suggestedFix = generateFix(pattern)
    }
  }
  
  return Array.from(patterns.values())
}

function generateOptimizations(
  template: ActivityTemplate.Schema,
  patterns: FailurePattern[]
): Optimization {
  const optimizations: Optimization = {
    confidence: 0,
    changes: {},
    rationale: []
  }
  
  // Example: If 40% of failures are "schema validation error"
  const schemaFailures = patterns.find(p => p.category === "schema")
  if (schemaFailures && schemaFailures.count / template.executions > 0.3) {
    optimizations.changes.validation = {
      // Add stricter validation
      commands: [
        { name: "strict-schema-check", command: "...", required: true }
      ]
    }
    optimizations.rationale.push(
      `${(schemaFailures.count / template.executions * 100).toFixed(0)}% of failures due to schema errors. Added strict validation.`
    )
    optimizations.confidence += 0.4
  }
  
  // Example: If 30% of failures are "too many tasks"
  const taskCountFailures = patterns.find(p => p.category === "task_count")
  if (taskCountFailures) {
    optimizations.changes.validation = {
      commands: [
        { name: "enforce-max-tasks", command: "jq -e '.tasks | length <= 5' *.json", required: true }
      ]
    }
    optimizations.rationale.push(
      `${(taskCountFailures.count / template.executions * 100).toFixed(0)}% of failures from excessive task count. Enforced 5-task limit.`
    )
    optimizations.confidence += 0.3
  }
  
  return optimizations
}
```

---

## Phase 5: Thompson Sampling Integration (Week 9-10)

### Create Variants for A/B Testing

```typescript
// Base template
const base = await TemplateRepository.get("create-activity-template")

// Variant 1: Scaffolded (more steps, more guidance)
await evolve_activity_template({
  parent_id: base.id,
  changes: {
    name: "Create Activity Template (Scaffolded)",
    tasks: [
      { id: "study-examples", ... },
      { id: "design-graph", ... },
      { id: "write-json", ... },
      { id: "validate", ... },
      { id: "register", ... }
    ]
  },
  evolution_note: "Split into 5 explicit steps for more guidance",
  evolution_type: "optimized"
})

// Variant 2: Streamlined (fewer steps, assume competence)
await evolve_activity_template({
  parent_id: base.id,
  changes: {
    name: "Create Activity Template (Streamlined)",
    tasks: [
      { id: "design-and-implement", ... },
      { id: "register", ... }
    ]
  },
  evolution_note: "Merged steps for experienced agents",
  evolution_type: "optimized"
})

// Variant 3: Example-heavy (more context)
await evolve_activity_template({
  parent_id: base.id,
  changes: {
    contextRequirements: [
      {
        key: "examples",
        budgetRange: [8000, 12000]  // 2x more examples
      }
    ]
  },
  evolution_note: "Increased example context for better pattern learning",
  evolution_type: "optimized"
})
```

### Let Thompson Sampling Select

```typescript
// Backend automatically:
// 1. Tracks success rates for all variants
// 2. Uses Beta(alpha, beta) distribution for each
// 3. Samples and ranks variants per query
// 4. Exploration parameter ensures trying all variants

// After 50+ executions per variant:
// - Best variant has highest success rate
// - Worst variants pruned (moved to "deprecated" status)
// - Best variant becomes new base for future evolution
```

---

## Detailed Improvement Roadmap

### Week 1-2: Enhanced Validation

**Goal**: Catch schema errors before registration

**Changes**:
1. Add `validate-task-count` command
2. Add `validate-dependency-graph` command
3. Add `validate-all-tasks-complete` command
4. Add forbidden patterns check

**Testing**:
- Create intentionally broken templates
- Verify validation catches them
- Measure false positive rate

**Success Metric**: 90% of schema errors caught in Task 1

---

### Week 3-4: Guided Design Process

**Goal**: Force deliberate design before implementation

**Changes**:
1. Split Task 1 into 3 subtasks:
   - `analyze-examples`
   - `design-task-graph`
   - `write-template-json`
2. Add validation checkpoints between subtasks
3. Require explicit outputs at each stage

**Testing**:
- Run 10 test executions with new structure
- Compare success rate to original
- Measure time increase

**Success Metric**: +15% success rate, <20% time increase

---

### Week 5-6: Pattern Enforcement

**Goal**: Ensure best practices are followed

**Changes**:
1. Add pre-activity checks for example availability
2. Add between-task validations
3. Enforce design artifacts (task graph must exist)

**Testing**:
- Verify enforcement doesn't block valid designs
- Check for false rejections
- Measure user friction

**Success Metric**: 95% of templates follow best practices

---

### Week 7-8: Automated Evolution

**Goal**: System learns and improves automatically

**Changes**:
1. Implement failure pattern aggregation
2. Create optimization suggestion engine
3. Generate evolved variants weekly
4. Prune underperforming variants monthly

**Testing**:
- Run on historical execution data
- Verify evolved templates improve success rates
- Check that pruning doesn't remove useful variants

**Success Metric**: Evolved templates have +5% success rate vs parents

---

### Week 9-10: Thompson Sampling A/B Testing

**Goal**: Multiple variants compete, best emerges

**Changes**:
1. Create 3-4 initial variants
2. Enable Thompson Sampling in backend
3. Track variant-specific metrics
4. Automatic variant selection in search

**Testing**:
- Simulate 100+ executions
- Verify sampling algorithm converges to best variant
- Check exploration parameter prevents premature convergence

**Success Metric**: Top variant has 85%+ success rate after 50 executions

---

## Expected Outcomes

### After 3 Months

- **Success Rate**: 65% → 80%
- **Template Quality**: Consistent schema compliance
- **Agent Behavior**: Follows guided process
- **Failure Detection**: 90% of errors caught early

### After 6 Months

- **Success Rate**: 80% → 90%
- **Automated Evolution**: 2-3 variants per template
- **Best Practices**: Emergent from data
- **Cost Reduction**: 15-20% through efficiency

---

## Monitoring Dashboard

### Metrics to Track

**Template-Level**:
- Success rate over time (trend)
- Average cost/duration (efficiency)
- Execution count (confidence)
- Validation failure types (patterns)

**Variant-Level**:
- Variant success rates (A/B comparison)
- Variant selection frequency (Thompson Sampling)
- Variant cost comparison (efficiency)
- Variant evolution lineage (genealogy)

**System-Level**:
- Total template executions
- Average success rate across all templates
- Template creation rate (new templates per week)
- Evolution rate (variants created per week)

### Query Commands

```bash
# Template performance
opencode activity metrics --template-id create-activity-template

# Variant comparison
opencode activity variants --template-id create-activity-template

# Failure analysis
opencode activity failures --template-id create-activity-template --last-n 20

# Evolution history
opencode activity lineage --template-id create-activity-template
```

---

## Success Factors (Prioritized)

### High Impact (Implement First)

1. **Enhanced validation** (+10-15% success)
   - Schema validation
   - Task count enforcement
   - Dependency graph validation

2. **Guided design process** (+15-20% success)
   - Split into explicit steps
   - Force example study
   - Require task graph design

3. **Checkpoint validations** (+5-10% success)
   - Between-task validations
   - Output format requirements
   - Quality gates

### Medium Impact (Implement Second)

4. **Better examples** (+5% success)
   - Filter by high success rate
   - Same category preference
   - More context budget

5. **Pattern enforcement** (+5% success)
   - Pre-activity checks
   - Best practice guidelines
   - Anti-pattern detection

### Long-Term Impact (Implement Third)

6. **Automated evolution** (+5-10% success over time)
   - Weekly failure analysis
   - Variant generation
   - Optimization suggestions

7. **Thompson Sampling** (+5-10% success over time)
   - Multiple variants compete
   - Best variant emerges
   - Continuous improvement

---

## Implementation Priorities

### Must Have (Phase 1)

- ✅ Enhanced validation commands
- ✅ Task count enforcement
- ✅ Dependency graph validation

**Rationale**: Catches 60-70% of current failures at minimal cost.

### Should Have (Phase 2)

- ✅ Guided design (3-step process)
- ✅ Example analysis checkpoint
- ✅ Task graph design requirement

**Rationale**: Prevents 20-30% of failures from rushed design.

### Could Have (Phase 3)

- ✅ Automated evolution
- ✅ Thompson Sampling A/B testing
- ✅ Advanced pattern detection

**Rationale**: Long-term improvement, needs execution data first.

---

## Testing Strategy

### Unit Tests

```typescript
describe("create-activity-template improvements", () => {
  it("rejects templates with >7 tasks", async () => {
    const result = await TemplateExecutor.execute({
      templateId: "create-activity-template",
      variables: {
        templateName: "Too Many Tasks",
        category: "feature",
        // ... agent will create 10 tasks
      }
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain("task count")
  })
  
  it("requires task graph design before JSON", async () => {
    // Mock to skip analyze-examples but try to skip design-task-graph
    // Should fail due to dependency
  })
  
  it("validates dependency graph integrity", async () => {
    // Template with circular dependency should fail validation
  })
})
```

### Integration Tests

```typescript
describe("create-activity-template E2E", () => {
  it("creates valid template with high-quality examples", async () => {
    const result = await TemplateExecutor.execute({
      templateId: "create-activity-template",
      variables: {
        templateName: "Test Template",
        templateDescription: "Test description",
        category: "feature",
        purpose: "Testing the creation flow"
      }
    })
    
    expect(result.success).toBe(true)
    
    // Verify template is registered and discoverable
    const search = await search_activities({ query: "Test Template" })
    expect(search.activities.some(a => a.name === "Test Template")).toBe(true)
  })
})
```

### Success Rate Tracking

```typescript
// Track over 100 executions
let successCount = 0
let totalCount = 0

for (let i = 0; i < 100; i++) {
  const result = await TemplateExecutor.execute({
    templateId: "create-activity-template",
    variables: randomVariables()
  })
  
  if (result.success) successCount++
  totalCount++
  
  console.log(`Execution ${i+1}: ${(successCount/totalCount * 100).toFixed(1)}% success rate`)
}

// Target: 80%+ success rate
```

---

## Metabob's Role in Success

### What Metabob Observes

**From every execution**:
```json
{
  "template_id": "create-activity-template",
  "execution_id": "exec_abc123",
  "success": true,
  "duration_ms": 1450000,
  "cost": 2.34,
  "tokens": { "input": 12000, "output": 3500, "cache": 8000 },
  "tasks": [
    {
      "task_id": "analyze-examples",
      "success": true,
      "duration_ms": 450000,
      "patterns_found": true  // From learning.feedbackPoints
    },
    {
      "task_id": "design-task-graph",
      "success": true,
      "duration_ms": 300000,
      "graph_quality": 8  // From output analysis
    },
    {
      "task_id": "write-template-json",
      "success": true,
      "duration_ms": 600000,
      "task_count": 5,
      "validation_complete": true
    },
    {
      "task_id": "register-template",
      "success": true,
      "duration_ms": 100000,
      "verification_passed": true
    }
  ],
  "validation": {
    "passed": true,
    "checks": ["json-valid", "task-count", "dependencies-valid"]
  }
}
```

### What Metabob Learns

**Pattern identification**:
```
Pattern: Executions where analyze-examples duration > 300s have 15% higher success rate
  → Insight: Taking time to study examples improves outcomes
  → Optimization: Adjust maxTokens for analyze-examples from 6000 → 8000

Pattern: Templates with 3-5 tasks have 85% success, 6-7 tasks have 65% success
  → Insight: Simpler templates more reliable
  → Optimization: Recommend 3-5 tasks in prompt, validate <=5

Pattern: 40% of failures occur in write-template-json task
  → Insight: JSON generation most error-prone
  → Optimization: Add intermediate validation step before registration
```

### Optimization Actions

```typescript
// Metabob generates evolution suggestion
{
  "template_id": "create-activity-template",
  "current_success_rate": 0.67,
  "suggested_changes": [
    {
      "change": "Increase analyze-examples token budget to 8000",
      "rationale": "Executions with longer example analysis have +15% success",
      "expected_impact": "+5% success rate",
      "confidence": 0.82
    },
    {
      "change": "Enforce max 5 tasks in validation",
      "rationale": "Templates with 6-7 tasks have 20% lower success",
      "expected_impact": "+8% success rate",
      "confidence": 0.91
    },
    {
      "change": "Add intermediate validation before registration",
      "rationale": "40% of failures in write-json could be caught earlier",
      "expected_impact": "+10% success rate",
      "confidence": 0.75
    }
  ],
  "total_expected_impact": "+23% success rate",
  "recommended_action": "Create evolved variant with all three changes"
}
```

---

## Concrete Next Steps

### This Week

1. **Add enhanced validation to create-activity-template**
   - Task count check: `jq -e '.tasks | length <= 7'`
   - Dependency validation: Check all deps exist
   - Required fields: validation, retry, prompts

2. **Test with 10 executions**
   - Measure success rate improvement
   - Identify any false rejections
   - Adjust thresholds if needed

### Next Week

3. **Split Task 1 into guided subtasks**
   - analyze-examples
   - design-task-graph
   - write-template-json

4. **Add checkpoint validations**
   - Between-task output requirements
   - Quality gates for each stage

### Following Week

5. **Deploy to production**
   - Monitor success rate daily
   - Collect execution data
   - Analyze failure patterns

6. **Prepare for evolution**
   - After 20+ executions, run failure analysis
   - Generate optimization suggestions
   - Create evolved variant

---

## Success Criteria

### Short-Term (1 Month)

- ✅ 75%+ success rate for create-activity-template
- ✅ <5% false rejections from validation
- ✅ 90%+ of schema errors caught early
- ✅ 20+ executions with tracking data

### Mid-Term (3 Months)

- ✅ 80%+ success rate
- ✅ 2-3 variants in A/B testing
- ✅ Automated failure pattern analysis
- ✅ First evolved variant deployed

### Long-Term (6 Months)

- ✅ 90%+ success rate
- ✅ Best variant clearly emerged from Thompson Sampling
- ✅ Automated weekly evolution runs
- ✅ Template creation time reduced 20%+

---

## Summary

### Registration Process

1. Agent writes JSON → 2. register_activity_template tool → 3. TemplateServiceClient → 4. MetabobAPI → 5. SurrealDB → 6. Discoverable via search

**Key**: Backend is single source of truth, no local storage.

### Ensuring Registration Success

**Current**: Task 2 explicitly verifies with search_activities  
**Improvement**: Add validation gates at each step

### Making Templates Succeed More

**Current**: Bayesian learning tracks success rates  
**Improvement**: 
1. Enhanced validation (catches errors early)
2. Guided design (forces best practices)
3. Automated evolution (learns from failures)
4. Thompson Sampling (competes variants)

### Expected Impact

| Phase | Success Rate | Timeline |
|-------|--------------|----------|
| Baseline | 65% | Now |
| + Enhanced Validation | 75% | Week 2 |
| + Guided Design | 80% | Week 4 |
| + Pattern Enforcement | 85% | Week 6 |
| + Automated Evolution | 90% | Month 3-6 |

**The system is designed to learn and improve. Feed it more execution data, and it will optimize automatically.**
