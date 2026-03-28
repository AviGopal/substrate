# create-activity-self-contained Template Analysis

**Current Success Rate**: 2.7% (1/37 executions succeeded)  
**Target Success Rate**: 60-80% (Phase 1), 90%+ (Phase 2)

---

## Current Template Structure

### Task 1: gather-requirements
**Issues Identified**:
1. ❌ **No required tools** - write tool is not marked as required
2. ⚠️ **Conversational prompt style** - agent may respond without acting
3. ⚠️ **Minimal validation** - only checks for section headers, not content quality
4. ⚠️ **No forbidden patterns** - doesn't detect incomplete work

### Task 2: design-task-graph
**Issues Identified**:
1. ❌ **No required tools** - write tool not required again
2. ⚠️ **Similar prompt issues** - conversational style
3. ⚠️ **Weak validation** - only structural, not semantic

### Task 3: write-template-json
**Issues Identified**:
1. ❌ **CRITICAL: No required tools** - write tool optional
2. ❌ **No validation for JSON validity** - can succeed with broken JSON
3. ❌ **No validation for required fields** - can create incomplete templates
4. ⚠️ **Very long prompt** - may exceed token limits

### Task 4: register-template
**Issues Identified**:
1. ⚠️ **Depends on external API** - can fail for infrastructure reasons
2. ⚠️ **No retry on connection failures** - simple strategy only

---

## Root Cause Analysis (from ACTIVITY_REVIEW_SESSION)

### Primary Issue: Agents Don't Act
**Problem**: "Create a file..." is interpreted as a suggestion, not a command.  
**Evidence**: Templates with conversational prompts have 0% work completion.  
**Solution**: Use "REQUIRED ACTIONS: 1. MUST use Write tool..."

### Secondary Issue: False Positives
**Problem**: Task completes without error, but produces no useful output.  
**Evidence**: 100% technical success, 0% correctness without validation.  
**Solution**: Add comprehensive validation rules to verify actual output.

### Tertiary Issue: Tool Usage Not Enforced
**Problem**: Write tool is in optional list, agents skip it.  
**Evidence**: Templates with required tools have +45% success rate.  
**Solution**: Move write tool to required list for all output tasks.

---

## Improvements to Apply

### Priority 1: Add Comprehensive Validation (HIGH IMPACT: +95%)

**Task 1 (gather-requirements)**:
```json
"validation": {
  "requiredFiles": ["/tmp/activity-template-{{templateId}}/REQUIREMENTS.md"],
  "requiredPatterns": [
    "## Overview",
    "## Workflow Steps",
    "1. **",
    "## Input Variables",
    "| Variable |",
    "## Validation Criteria",
    "## Error Scenarios"
  ],
  "forbiddenPatterns": [
    "TODO",
    "FIXME",
    "[Add details]",
    "[Fill in]",
    "..."
  ],
  "commands": []
}
```

**Task 3 (write-template-json)**:
```json
"validation": {
  "requiredFiles": ["/tmp/activity-template-{{templateId}}/{{templateId}}.json"],
  "requiredPatterns": [
    "\"name\":",
    "\"description\":",
    "\"category\":",
    "\"tasks\":",
    "\"id\":",
    "\"subagent\":",
    "\"prompt\":",
    "\"template\":",
    "\"variables\":",
    "\"validation\":"
  ],
  "forbiddenPatterns": [
    "syntax error",
    "unexpected token",
    "TODO",
    "FIXME"
  ],
  "commands": [
    {
      "name": "validate-json",
      "command": "jq empty /tmp/activity-template-{{templateId}}/{{templateId}}.json",
      "required": true
    }
  ]
}
```

### Priority 2: Restructure Prompts (MEDIUM IMPACT: +40%)

**Before** (Task 1):
```
You are creating an activity template that will be used to automate a workflow.

**User Intent**:
- Template Name: {{templateName}}
...
```

**After**:
```
## TASK
Create a comprehensive requirements document for an activity template.

## OBJECTIVE
Analyze user intent and produce a structured REQUIREMENTS.md file with complete workflow details.

## REQUIRED ACTIONS
1. MUST use the Write tool to create /tmp/activity-template-{{templateId}}/REQUIREMENTS.md
2. MUST include all 6 sections: Overview, Workflow Steps, Input Variables, Validation Criteria, Error Scenarios, Success Metrics
3. MUST provide specific, actionable details (no placeholders like "TODO" or "...")
4. MUST validate workflow steps form a valid DAG (no circular dependencies)

## INPUT
- Template Name: {{templateName}}
- Description: {{templateDescription}}
- Category: {{category}}
- Purpose: {{purpose}}

## SUCCESS CRITERIA
- File exists at specified path
- All 6 required sections present
- Each workflow step has clear description and dependencies
- At least 2 input variables defined
- At least 3 validation criteria specified
- No TODO, FIXME, or placeholder text

## EXAMPLE OUTPUT STRUCTURE
... (same as before)
```

### Priority 3: Mark Tools as Required (MEDIUM IMPACT: +45%)

**All tasks that produce files**:
```json
"tools": {
  "required": ["write"],
  "optional": ["read"],
  "disabled": []
}
```

### Priority 4: Add Explicit Instructions (LOW IMPACT: +20%)

**Prompt improvements**:
- Start with "## TASK" instead of conversational intro
- Use "MUST" instead of "should" or "create"
- Number required actions explicitly
- Add success criteria section
- Remove ambiguous language

---

## Expected Impact

| Improvement | Success Rate Increase | Confidence |
|-------------|----------------------|------------|
| Add validation rules | +50-70% | HIGH |
| Restructure prompts | +20-30% | MEDIUM |
| Mark tools required | +30-40% | HIGH |
| Explicit instructions | +10-20% | MEDIUM |

**Conservative Estimate**: 3% → 60-80% (combined 20x improvement)  
**Optimistic Estimate**: 3% → 90-95% (if all improvements compound)

---

## Implementation Plan

1. Copy template to tmp/template-evolution/create-activity-self-contained-v2.json
2. Apply Priority 1 improvements (validation)
3. Apply Priority 2 improvements (prompts)
4. Apply Priority 3 improvements (required tools)
5. Update generation metadata
6. Test with simple template creation
7. Register if test succeeds

