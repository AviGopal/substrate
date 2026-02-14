# Interaction Pattern Quick Start Guide

**Quick reference for creating activity templates from successful patterns**

---

## Pattern Selection Decision Tree

```
Need to debug integration issue?
  → Pattern 1: Systematic Debugging
  → Use: activity-create-v2 to formalize as template

Building multi-domain feature?
  → Pattern 3: Multi-Agent Coordination
  → Use: Requires ACP infrastructure

Creating repeatable workflow?
  → Pattern 2: Activity Template Creation
  → Use: activity-create-v2 (already exists)

Improving code quality?
  → Pattern 5: Code Quality Improvement
  → Use: activity-create-v2 to formalize as template

Fixing Docker service?
  → Pattern 6: Docker Service Fix
  → Use: activity-create-v2 to formalize as template
```

---

## Quick Reference: Top 5 Patterns

### 1. Systematic Debugging (100% success)
**Use when:** Integration issues with unknown root cause  
**Key technique:** File-based logging + incremental fixes  
**Evidence:** Fixed 8 bugs in 16 restarts (2 per bug)

```typescript
activity({
  activityId: "debug-integration-systematic-v1",
  variables: {
    target_system: "activity-execution",
    symptom_description: "Activities fail with field name mismatch"
  }
})
```

### 2. Activity Template Creation (85% success)
**Use when:** Formalizing successful workflows  
**Key technique:** Pattern → Scope → Steps → Validate → Test  
**Evidence:** Self-validating template with 7 steps

```typescript
activity({
  activityId: "activity-create-v2",
  variables: {
    activity_name: "Debug Integration Issues",
    activity_id: "debug-integration-v1",
    target_category: "infrastructure"
  }
})
```

### 3. Multi-Agent Feature Implementation (95% success)
**Use when:** Full-stack features requiring parallel work  
**Key technique:** Impulse sharing + MESSAGE_FOR annotations  
**Evidence:** 3x faster than sequential

```typescript
// Create design impulse
impulse_create({ id: "api-design", content: "API spec..." })

// Delegate in parallel
const [backend, frontend, test] = await Promise.all([
  acp_delegate({ target: "docker://backend", shareImpulses: ["api-design"] }),
  acp_delegate({ target: "docker://frontend", shareImpulses: ["api-design"] }),
  acp_delegate({ target: "docker://test", shareImpulses: ["api-design"] })
])
```

### 4. Code Quality Improvement (90% success)
**Use when:** Fixing Metabob-detected issues  
**Key technique:** Priority-driven workflow  
**Evidence:** High ROI, prevents bugs before production

```typescript
// Get priority issues
const issues = await metabob_get_priority_issues()

// Fix systematically
for (const issue of issues) {
  fixIssue(issue)
  metabob_mark_problem_complete({ problem_id: issue.id })
  metabob_annotate_component({ component_name: issue.component })
}
```

### 5. Docker Service Fix (85% success)
**Use when:** Containerized services failing  
**Key technique:** Log analysis → Categorize → Fix → Verify  
**Evidence:** Reduces service downtime

```bash
# Check logs
docker logs metabob-rpc-api --tail 100

# Identify failure mode: startup | runtime | connection
# Fix and verify
docker-compose up -d metabob-rpc-api
```

---

## Creating a New Template: Step-by-Step

### Step 1: Identify the Pattern

**Look for:**
- ✅ Successful outcome (>85% completion)
- ✅ Repeatable steps (3+ times)
- ✅ Clear success criteria
- ✅ Measurable cost/duration

**Document:**
- User intent (what problem does this solve?)
- Key steps (what made it successful?)
- Essential tools (what tools were critical?)
- Edge cases (what could go wrong?)

### Step 2: Use activity-create-v2

```typescript
activity({
  activityId: "activity-create-v2",
  variables: {
    source_pattern: "Description of the successful pattern",
    activity_name: "Human-Readable Name",
    activity_id: "unique-id-v1",
    target_category: "infrastructure", // or bug-fix, feature-impl, refactor, tool
    test_variables: {
      // Test data for validation
    }
  },
  reason: "Create template from proven pattern"
})
```

### Step 3: Validate the Template

The activity will automatically:
1. Analyze the pattern
2. Define scope (in/out, success criteria)
3. Design task steps with dependencies
4. Create template JSON (ActivityVariant schema)
5. Validate schema (register_activity_template with validate_only=true)
6. Test execute with dummy data
7. Create summary documentation

### Step 4: Review and Register

**Check:**
- [ ] Schema validation passed
- [ ] Test execution completed
- [ ] All variables documented
- [ ] Success criteria clear
- [ ] Example usage provided

**Register:**
```typescript
register_activity_template({
  file_path: "unique-id-v1.json",
  validate_only: false
})
```

---

## Common Template Variables

### Debugging Templates
```json
{
  "target_system": "string (required) - System being debugged",
  "symptom_description": "string (required) - What's failing",
  "log_file_path": "string (optional) - Debug log location"
}
```

### Feature Templates
```json
{
  "feature_name": "string (required) - Feature being built",
  "design_spec": "string (required) - Requirements and constraints",
  "target_file": "string (optional) - File to modify"
}
```

### Code Quality Templates
```json
{
  "issue_pattern": "string (optional) - Search pattern",
  "severity_filter": "array (optional) - ['HIGH', 'CRITICAL']",
  "max_issues": "number (optional) - Maximum to fix"
}
```

### Docker Templates
```json
{
  "service_name": "string (required) - Docker service name",
  "symptom": "string (required) - What's failing",
  "rebuild_image": "boolean (optional) - Whether to rebuild"
}
```

---

## Activity Template Structure

```json
{
  "variant_id": "unique-id-v1",
  "activity_id": "unique-id",
  "variant_name": "v1-baseline",
  "version": 1,
  "description": "What this activity does",
  "variables": {
    "variable_name": {
      "type": "string",
      "required": true,
      "description": "What this variable represents"
    }
  },
  "prompt_strategy": "guided",
  "context_budget_tokens": 12000,
  "expected_duration_ms": 120000,
  "expected_cost": 0.15,
  "status": "testing",
  "task_steps": [
    {
      "id": "step-1",
      "subagent": "general",
      "description": "Clear, action-oriented description",
      "dependencies": [],
      "impulse_refs": [],
      "prompt": {
        "template": "Instructions with {{variables}}",
        "max_tokens": 8000,
        "variables": ["variable_name"]
      },
      "validation": {
        "postChecks": {
          "requiredFiles": ["output.md"],
          "requiredPatterns": ["Success:", "Complete:"]
        }
      },
      "retry": {
        "max_attempts": 3,
        "strategy": "simple"
      },
      "metrics": {
        "success_rate": 0,
        "avg_tokens": 0,
        "avg_duration": 0
      },
      "tools": {
        "required": ["write", "read"],
        "optional": ["bash"],
        "disabled": []
      }
    }
  ]
}
```

---

## Pattern Success Metrics

| Pattern | Success Rate | Duration | Cost | Complexity |
|---------|--------------|----------|------|------------|
| Systematic Debugging | 100% | 2-4h | $0.05-$0.15 | Medium |
| Activity Creation | 85% | 30-60m | $0.25-$0.35 | High |
| Multi-Agent Feature | 95% | 20-40m | $0.30-$0.60 | High |
| Code Quality | 90% | 10-30m | $0.05-$0.15 | Low-Medium |
| Docker Service Fix | 85% | 30-60m | $0.10-$0.25 | Medium |

---

## Common Mistakes to Avoid

### ❌ Template Design
- **Too broad scope** → Keep focused on single goal
- **Missing variables** → Document all inputs
- **No validation** → Add postChecks to verify success
- **Wrong field names** → Use "task_steps" not "tasks"

### ❌ Pattern Identification
- **One-off success** → Need 3+ successful uses
- **Unclear success criteria** → Must be measurable
- **Missing tools** → Document all required tools

### ❌ Testing
- **Skip validation** → Always validate schema first
- **No test execution** → Must test with dummy data
- **Wrong test data** → Use realistic test variables

---

## Immediate Next Steps

### Week 1: Create Top 3 Templates

**1. Systematic Debugging Template**
```bash
activity({ 
  activityId: "activity-create-v2",
  variables: {
    source_pattern: "Systematic debugging with file-based logging from ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md",
    activity_name: "Debug Integration Issues Systematically",
    activity_id: "debug-integration-systematic-v1",
    target_category: "infrastructure"
  }
})
```

**2. Code Quality Template**
```bash
activity({
  activityId: "activity-create-v2", 
  variables: {
    source_pattern: "Metabob-guided code quality improvement",
    activity_name: "Fix Code Quality Issues",
    activity_id: "fix-code-quality-issues-v1",
    target_category: "bug-fix"
  }
})
```

**3. Docker Service Fix Template**
```bash
activity({
  activityId: "activity-create-v2",
  variables: {
    source_pattern: "Docker service debugging from BACKEND_FIX_COMPLETE.md",
    activity_name: "Fix Docker Service Issues",
    activity_id: "fix-docker-service-v1",
    target_category: "infrastructure"
  }
})
```

---

## Resources

- **Full Analysis:** `INTERACTION_PATTERN_IDENTIFICATION_REPORT.md`
- **Detailed Patterns:** `INTERACTION_PATTERNS_ANALYSIS.md`
- **Activity Examples:** `FINAL_COMPREHENSIVE_TEST_FEB12.md`
- **Template Creation Guide:** `repos/metabob-proto/activities/bootstrap/activity-create-v2.json`

---

**Ready to create your first template?**

1. Identify a successful pattern (3+ uses)
2. Run activity-create-v2 with pattern details
3. Validate and test the template
4. Register and start using!

