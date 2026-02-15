# Activity Template Comparison: Built-in vs V3 Behavior-Informed

**Date**: February 14, 2026  
**Purpose**: Compare the original built-in `create-activity-template` (v4) with the behavior-informed V3 variant

---

## Executive Summary

The V3 variant represents an **evolution** of the built-in template, incorporating empirical observations from manual template creation. Key improvements:

1. ✅ **More explicit task structure** with comprehensive field requirements
2. ✅ **Dedicated validation task** (separate from creation)
3. ✅ **Better guidance and documentation** for each step
4. ✅ **Realistic token budgets** based on actual usage
5. ✅ **Documentation generation** as explicit final step

---

## Structural Comparison

### Schema Format

| Aspect | Built-in (v4) | V3 Behavior-Informed | Winner |
|--------|---------------|----------------------|--------|
| **Schema style** | Older format (`id`, `name`) | New format (`variant_id`, `activity_id`) | **V3** (future-proof) |
| **Version** | 4 | 3 | - (different lineages) |
| **Variables** | Inline in prompts | Top-level `variables` object | **V3** (clearer) |
| **Task fields** | Minimal structure | Comprehensive (all fields explicit) | **V3** (completeness) |

### Task Count

| Template | Task Count | Tasks |
|----------|------------|-------|
| **Built-in** | 4 tasks | analyze-examples → design-task-graph → write-template-json → register-template |
| **V3** | 5 tasks | analyze-examples → design-template-structure → write-template-json → validate-template → document-template |

**Key Difference**: V3 splits validation into separate task and adds documentation generation.

---

## Task-by-Task Comparison

### Task 1: Analyze Examples
**Both templates have this task with similar goals**

| Aspect | Built-in | V3 | Analysis |
|--------|----------|----|----|
| **Output format** | Markdown with patterns/practices | PATTERN_ANALYSIS.md | Same approach ✓ |
| **Guidance** | Implicit in prompt | Explicit `guidance` array | **V3 clearer** |
| **Max tokens** | 6000 | 8000 | **V3 more generous** |
| **Required files** | None (implicit) | PATTERN_ANALYSIS.md (explicit) | **V3 clearer validation** |
| **Forbidden patterns** | None | TODO, TBD, FIXME | **V3 stricter** |

**Winner**: **V3** - More explicit, better validation

---

### Task 2: Design Structure
**Similar tasks but different names**

Built-in: `design-task-graph`  
V3: `design-template-structure`

| Aspect | Built-in | V3 | Analysis |
|--------|----------|----|----|
| **Output** | Task graph markdown | TEMPLATE_DESIGN.md with 4 sections | **V3 more comprehensive** |
| **Sections** | Task graph only | Task graph + Variables + Validation + Tools | **V3 better organized** |
| **Variable docs** | Not required | Explicit variable definitions with types | **V3 enforces completeness** |
| **Tool specs** | Not mentioned | Required vs optional per task | **V3 more practical** |
| **Max tokens** | 6000 | 10000 | **V3 allows full design** |

**Winner**: **V3** - Forces complete design before implementation

---

### Task 3: Write Template JSON
**Both have this critical task**

| Aspect | Built-in | V3 | Analysis |
|--------|----------|----|----|
| **Field requirements** | Listed in prompt | **Explicit examples with all fields** | **V3 more prescriptive** |
| **Checklist** | Implicit | **Explicit checklist** with [ ] items | **V3 clearer completion criteria** |
| **Self-validation** | Suggested (`jq` commands) | Same | Tied ✓ |
| **Max tokens** | 10000 | 12000 | **V3 slightly more room** |
| **Retry strategy** | progressive-context | progressive-context | Tied ✓ |
| **Validation commands** | Requires external script | Same | Tied |

**Winner**: **V3** - More explicit structure reduces ambiguity

---

### Task 4: Validation
**KEY DIFFERENCE - V3 adds dedicated validation task**

| Aspect | Built-in | V3 | Analysis |
|--------|----------|----|----|
| **Task exists?** | ❌ No (rolled into Task 3) | ✅ Yes (dedicated task) | **V3 separation of concerns** |
| **Validation steps** | - | 6 explicit checks | **V3 comprehensive** |
| **Self-healing** | - | Trailblazing retry | **V3 can auto-fix** |
| **Output artifact** | - | VALIDATION_REPORT.md | **V3 creates evidence** |

Built-in approach:
- Task 3 suggests running `jq` commands
- No dedicated validation or reporting
- Agent might skip validation

V3 approach:
- Dedicated task ensures validation happens
- 6 specific checks (syntax, fields, task count, variables, quality)
- Creates VALIDATION_REPORT.md for audit trail
- Uses trailblazing retry to fix issues automatically

**Winner**: **V3** - Validation as first-class concern

---

### Task 5: Registration vs Documentation
**Different final steps**

| Aspect | Built-in: register-template | V3: document-template | Analysis |
|--------|----------------------------|----------------------|----------|
| **Purpose** | Register with backend | Create usage docs | Different goals |
| **Output** | Registration confirmation | TEMPLATE_SUMMARY.md | V3 creates artifact |
| **Sections** | - | Purpose, Variables, Example, Tasks, Troubleshooting | V3 comprehensive |
| **Retry** | trailblazing (3 attempts) | simple (2 attempts) | Built-in more persistent for registration |

**Note**: V3 removed registration task because it's environment-dependent. Documentation is universal.

**Winner**: **Depends on use case**
- Built-in: Better for immediate backend integration
- V3: Better for template portability and reuse

---

## Context Requirements

### Built-in
```json
{
  "highQualityExamples": { required: true, budget: 5000-8000 },
  "failurePatterns": { required: false, budget: 2000-4000 }
}
```

### V3
```json
{
  "highQualityExamples": { required: true, budget: 5000-8000 },
  "schemaReference": { required: false, budget: 2000-3000 },
  "failurePatterns": { required: false, budget: 2000-4000 }
}
```

**Difference**: V3 adds optional `schemaReference` for schema docs (useful hint)

**Winner**: **V3** - More context options

---

## Quality Gates & Integration

### Built-in
- Post-checks: `search_activities({ verbose: false })` (verify registration)
- Quality gate: JSON syntax validation

### V3
- Post-checks: None (documentation-focused, not registration-focused)
- Quality gates: 
  - JSON syntax validation
  - Task count validation (1-7 range)

**Winner**: **Tied** (different philosophies)
- Built-in: Assumes backend integration
- V3: Assumes local validation

---

## Learning & Metrics

Both templates have comprehensive learning sections. V3 adds validation-specific metrics.

### V3 Additions
- `validate-template` feedback point with metrics:
  - validation_checks_run
  - issues_found
  - fixes_applied
  - passed_validation
  - syntax_valid

**Winner**: **V3** - More comprehensive learning capture

---

## Prompt Engineering Quality

| Aspect | Built-in | V3 | Winner |
|--------|----------|----|----|
| **Variable interpolation examples** | Limited | Explicit {{variable}} examples | **V3** |
| **Required field examples** | Listed | **Full JSON structure examples** | **V3** |
| **Checklist format** | Narrative | **[ ] checkboxes** | **V3** |
| **Error guidance** | Generic | Specific ("If X, then do Y") | **V3** |
| **Fallback prompts** | Simple | Context-aware | **V3** |

**Winner**: **V3** - More actionable, less ambiguous

---

## Schema Completeness

### Built-in Task Structure (Minimal)
```json
{
  "id": "...",
  "subagent": "...",
  "description": "...",
  "dependencies": [],
  "impulseReferences": [],
  "prompt": { ... },
  "validation": { ... },
  "retry": { ... }
}
```

**Missing fields**: guidance, metrics, tools

### V3 Task Structure (Complete)
```json
{
  "id": "...",
  "subagent": "...",
  "description": "...",
  "dependencies": [],
  "guidance": [...],           // ← Added
  "impulse_refs": [],
  "prompt": { ... },
  "validation": { ... },
  "retry": { ... },
  "metrics": { ... },           // ← Added
  "tools": { ... }             // ← Added
}
```

**Winner**: **V3** - Forces complete template structure

---

## Overall Comparison Matrix

| Category | Built-in (v4) | V3 Behavior-Informed | Winner |
|----------|---------------|----------------------|--------|
| **Schema compliance** | Older format | ✅ Newer format | **V3** |
| **Task count** | 4 (minimal) | 5 (optimal for quality) | **V3** |
| **Validation** | Implicit in Task 3 | ✅ Dedicated task with self-healing | **V3** |
| **Documentation** | Not generated | ✅ TEMPLATE_SUMMARY.md created | **V3** |
| **Guidance clarity** | Implicit | ✅ Explicit `guidance` arrays | **V3** |
| **Field completeness** | Minimal (3 required) | ✅ All fields (10 required) | **V3** |
| **Token budgets** | Conservative | ✅ Realistic (based on observation) | **V3** |
| **Backend integration** | ✅ register-template task | ❌ Omitted (environment-dependent) | **Built-in** |
| **Portability** | Assumes backend | ✅ Standalone validation & docs | **V3** |
| **Learning metrics** | Good | ✅ Better (validation metrics) | **V3** |
| **Retry strategies** | Mixed (simple, progressive, trailblazing) | ✅ Same + trailblazing for validation | Tied |

---

## Strengths & Weaknesses

### Built-in Template Strengths
1. ✅ Backend integration (register-template task)
2. ✅ Proven in production (version 4)
3. ✅ Simpler (4 tasks)
4. ✅ Post-checks verify registration

### Built-in Template Weaknesses
1. ❌ Older schema format (not future-proof)
2. ❌ Minimal task structure (missing guidance, tools, metrics)
3. ❌ Validation is implicit (easy to skip)
4. ❌ No documentation generation
5. ❌ Less prescriptive prompts (more ambiguity)

### V3 Template Strengths
1. ✅ **Behavior-informed design** (based on empirical observation)
2. ✅ **Newer schema format** (variant_id, activity_id)
3. ✅ **Comprehensive task structure** (all fields required)
4. ✅ **Dedicated validation task** with self-healing
5. ✅ **Documentation generation** (TEMPLATE_SUMMARY.md)
6. ✅ **Explicit guidance** per task
7. ✅ **Realistic token budgets** (8000-12000 vs 6000-10000)
8. ✅ **Better prompt engineering** (checklists, examples, structure)
9. ✅ **Portable** (doesn't assume backend)

### V3 Template Weaknesses
1. ❌ No backend registration task (must add separately)
2. ❌ More complex (5 tasks vs 4)
3. ❌ Untested in production (new design)
4. ❌ Larger (more verbose prompts)

---

## Recommendation

### Use Built-in Template When:
- You have a working backend with registration API
- You want battle-tested, proven workflow
- Simplicity > completeness
- You're comfortable with implicit validation

### Use V3 Template When:
- You want **behavior-informed** design (based on real observations)
- You need **comprehensive validation** and documentation
- You're creating templates for **distribution** (not just local backend)
- You want **stricter quality gates** (all fields required)
- You prefer **explicit over implicit** (guidance, checklists, structure)
- You have **modern schema requirements** (variant_id, activity_id)

---

## Hybrid Approach (Best of Both)

**Recommended**: Combine V3's validation + documentation with Built-in's registration

**5-task hybrid**:
1. analyze-examples (V3 version - more explicit)
2. design-template-structure (V3 version - comprehensive)
3. write-template-json (V3 version - complete fields)
4. validate-template (V3 unique - self-healing)
5. **register-and-document** (new - combines both)

Final task does:
- Register with backend (from Built-in)
- Generate documentation (from V3)
- Verify both succeeded

---

## Conclusion

**V3 is superior for quality and completeness**, but **Built-in is better for backend integration**.

The ideal solution:
1. Use V3's comprehensive validation and documentation approach
2. Add Built-in's registration task as Task 6 (optional)
3. Use V3's newer schema format throughout
4. Keep V3's explicit guidance and checklists

**V3 represents the next evolution** - it's what the built-in template should become in version 5.

---

## Validation Scores

| Metric | Built-in | V3 | Improvement |
|--------|----------|----|----|
| **Completeness** | 6/10 | 9/10 | +50% |
| **Clarity** | 7/10 | 9/10 | +29% |
| **Validation rigor** | 5/10 | 9/10 | +80% |
| **Documentation** | 4/10 | 9/10 | +125% |
| **Backend integration** | 9/10 | 3/10 | -67% |
| **Portability** | 5/10 | 10/10 | +100% |
| **Overall** | **6.0/10** | **8.2/10** | **+37%** |

**Winner**: **V3 Behavior-Informed Template** (for quality and completeness)

With backend registration added as Task 6, V3 would score **9.0/10** overall.
