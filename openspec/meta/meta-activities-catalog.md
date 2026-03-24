# Meta-Activities Catalog

**Purpose:** Track status of all meta-activities (activities operating on the system itself)
**Last Updated:** 2026-03-23

## What Are Meta-Activities?

Meta-activities are activity templates that operate on the system itself rather than external codebases. They enable self-improvement, validation, and orchestration.

**Characteristics:**
- Target: System components (templates, traces, specs, metrics)
- Purpose: Improve, validate, or orchestrate system behavior
- Outputs: New templates, compliance reports, optimization recommendations
- Learning: Captured like any activity, improves meta-capabilities

**Examples:**
- `optimize-template.json` - Improve existing template based on failures
- `compile-spec-to-activity.json` - Convert OpenSpec to executable template
- `validate-spec-compliance.json` - Check runtime vs specification
- `extract-template.json` - Ribosome pattern (execution → template)

## Status Legend

| Symbol | Meaning | Description |
|--------|---------|-------------|
| ✅ | **PROVEN** | Implemented, tested, works reliably |
| ⚠️ | **EXISTS UNTESTED** | Code exists but not validated in production |
| 🔜 | **IN PROGRESS** | Currently being implemented |
| 📋 | **DESIGNED** | Specification exists, not implemented |
| ❌ | **NOT STARTED** | Planned but no work done |
| 🔍 | **RESEARCH** | Exploring feasibility, design uncertain |

## Meta-Activity Catalog

### Closed-Loop Meta-Activities

These enable the OpenSpec ↔ MiniBob closed-loop.

#### 1. plan-from-goal ❌ NOT STARTED

**Purpose:** Transform user goal into OpenSpec document.

**Category:** Planning (Phase 1 of closed-loop)

**Inputs:**
- User goal message (string)
- Codebase context (files, structure)
- Existing specs (for reference)

**Outputs:**
- OpenSpec document (markdown)
- Functional requirements (checklist)
- Performance thresholds (numbers)
- Validation rules (patterns, tests)

**Priority:** LOW (can be manual initially)

**Blockers:** None (can start anytime)

**Template Location:** `repos/minibob/templates/meta/plan-from-goal.json` (not created)

**Design Notes:**
```json
{
  "id": "plan-from-goal",
  "category": "meta",
  "tasks": [
    {
      "id": "analyze-goal",
      "prompt": {
        "template": "Analyze user goal: {{goalMessage}} and extract intent"
      }
    },
    {
      "id": "identify-requirements",
      "prompt": {
        "template": "List functional requirements (what must be built)"
      }
    },
    {
      "id": "define-thresholds",
      "prompt": {
        "template": "Set performance thresholds (cost, duration, quality)"
      }
    },
    {
      "id": "write-spec",
      "prompt": {
        "template": "Write OpenSpec document to specs/{{specId}}.md"
      }
    }
  ]
}
```

---

#### 2. compile-spec-to-activity ❌ NOT STARTED (CRITICAL)

**Purpose:** Convert OpenSpec document to executable activity template.

**Category:** Compilation (Phase 2 of closed-loop)

**Inputs:**
- OpenSpec document path
- Template library (for pattern reference)

**Outputs:**
- Activity template (JSON)
- Compilation metadata (spec version, timestamp)

**Priority:** CRITICAL (Phase 1 of reliability roadmap)

**Blockers:**
- OpenSpec format must be standardized
- Parser logic needs implementation

**Template Location:** `repos/minibob/templates/meta/compile-spec-to-activity.json` (not created)

**Design Notes:**
```json
{
  "id": "compile-spec-to-activity",
  "category": "meta",
  "tasks": [
    {
      "id": "parse-spec",
      "prompt": {
        "template": "Parse OpenSpec {{specPath}} and extract requirements"
      }
    },
    {
      "id": "generate-tasks",
      "prompt": {
        "template": "Create task sequence achieving all functional requirements"
      }
    },
    {
      "id": "add-validation",
      "prompt": {
        "template": "Add validation rules from performance criteria"
      }
    },
    {
      "id": "write-template",
      "prompt": {
        "template": "Write complete template to templates/compiled/{{templateId}}.json"
      },
      "validation": {
        "requiredFiles": ["templates/compiled/{{templateId}}.json"],
        "requiredPatterns": ["\"category\":", "\"tasks\":"]
      }
    }
  ]
}
```

**Next Steps:**
1. Define minimal OpenSpec format (functional requirements only)
2. Create test spec ("Add hello endpoint")
3. Implement compilation logic
4. Validate compiled template executes successfully
5. Measure success rate on 5+ specs

---

#### 3. observe-runtime ❌ NOT STARTED

**Purpose:** Capture runtime behavior for validation.

**Category:** Observation (Phase 4 of closed-loop)

**Inputs:**
- Execution trace ID
- Observable state selectors (what to capture)

**Outputs:**
- Observable state snapshot (structured data)
- Files modified (diffs)
- Tests executed (pass/fail)
- Performance metrics (cost, duration, memory)

**Priority:** MEDIUM (needed for Phase 2)

**Blockers:** None (can work with current execution traces)

**Template Location:** `repos/minibob/templates/meta/observe-runtime.json` (not created)

**Design Notes:**
```json
{
  "id": "observe-runtime",
  "category": "meta",
  "tasks": [
    {
      "id": "load-trace",
      "prompt": {
        "template": "Load execution trace {{traceId}}"
      }
    },
    {
      "id": "extract-state",
      "prompt": {
        "template": "Extract: files modified, tests run, metrics, tool calls"
      }
    },
    {
      "id": "structure-snapshot",
      "prompt": {
        "template": "Create structured snapshot for validation"
      }
    }
  ]
}
```

**Note:** May be merged with validate-spec-compliance (single phase).

---

#### 4. validate-spec-compliance ❌ NOT STARTED

**Purpose:** Compare runtime behavior vs OpenSpec requirements.

**Category:** Validation (Phase 5 of closed-loop)

**Inputs:**
- OpenSpec document path
- Observable state snapshot (or execution trace)
- Drift thresholds (from spec)

**Outputs:**
- Compliance report (pass/fail/drift)
- Drift measurements (quantitative)
- Violation details (what's wrong)
- Realignment recommendations

**Priority:** HIGH (needed for Phase 3)

**Blockers:**
- OpenSpec format must be standardized
- Drift calculation logic needed

**Template Location:** `repos/minibob/templates/meta/validate-spec-compliance.json` (not created)

**Design Notes:**
```json
{
  "id": "validate-spec-compliance",
  "category": "meta",
  "tasks": [
    {
      "id": "load-spec-and-runtime",
      "prompt": {
        "template": "Load OpenSpec {{specPath}} and runtime snapshot {{snapshotId}}"
      }
    },
    {
      "id": "compare-functional",
      "prompt": {
        "template": "Verify all functional requirements met"
      }
    },
    {
      "id": "compare-performance",
      "prompt": {
        "template": "Check metrics against thresholds"
      }
    },
    {
      "id": "calculate-drift",
      "prompt": {
        "template": "Measure drift, classify as PASS/FAIL/DRIFT"
      }
    },
    {
      "id": "generate-report",
      "prompt": {
        "template": "Create compliance report with recommendations"
      }
    }
  ]
}
```

---

#### 5. execute-realignment ❌ NOT STARTED

**Purpose:** Restore compliance when drift detected.

**Category:** Realignment (Phase 6 of closed-loop)

**Inputs:**
- Compliance report ID
- Realignment strategy (fix/update/accept)

**Outputs:**
- Updated implementation (code changes) OR
- Updated spec (revised requirements) OR
- Acceptance record (drift acknowledged)

**Priority:** HIGH (needed for Phase 4)

**Blockers:**
- Validation must work first
- Decision logic for strategy selection

**Template Location:** `repos/minibob/templates/meta/execute-realignment.json` (not created)

**Design Notes:**
```json
{
  "id": "execute-realignment",
  "category": "meta",
  "tasks": [
    {
      "id": "analyze-drift",
      "prompt": {
        "template": "Load report {{reportId}} and identify causes"
      }
    },
    {
      "id": "decide-strategy",
      "prompt": {
        "template": "Choose: fix implementation, update spec, or accept drift"
      }
    },
    {
      "id": "execute-action",
      "prompt": {
        "template": "Apply chosen strategy"
      }
    },
    {
      "id": "re-validate",
      "prompt": {
        "template": "Run validation again to confirm compliance"
      }
    }
  ]
}
```

---

### Learning Meta-Activities

These enable template optimization and pattern extraction.

#### 6. extract-template ⚠️ EXISTS UNTESTED (Ribosome Pattern)

**Purpose:** Extract reusable template from successful execution.

**Category:** Learning

**Inputs:**
- Execution trace ID (successful execution)
- Template name/category

**Outputs:**
- New activity template (JSON)
- Template registered in backend
- Success metrics initialized

**Priority:** MEDIUM (enables template library growth)

**Blockers:** None (code exists, needs testing)

**Template Location:** `repos/minibob/templates/meta/extract-template.json` ⚠️ EXISTS

**Implementation:** `repos/minibob/src/activity.ts` - `assembleTemplateFromExecution()`

**Status:** Code exists but hasn't been validated in production.

**Next Steps:**
1. Test extraction on successful execution trace
2. Verify generated template is valid JSON
3. Execute extracted template on similar goal
4. Measure success rate of extracted templates

---

#### 7. optimize-template ❌ NOT STARTED

**Purpose:** Improve existing template based on failure analysis.

**Category:** Learning

**Inputs:**
- Template ID (to optimize)
- Execution traces (failed executions)
- Pattern library (successful patterns)

**Outputs:**
- New template variant
- Optimization rationale (what changed and why)
- Variant registered for Thompson Sampling

**Priority:** MEDIUM (enables continuous improvement)

**Blockers:** None (can analyze traces manually first)

**Template Location:** `repos/minibob/templates/meta/optimize-template.json` (not created)

**Design Notes:**
```json
{
  "id": "optimize-template",
  "category": "meta",
  "tasks": [
    {
      "id": "analyze-failures",
      "prompt": {
        "template": "Examine failed executions for {{templateId}}"
      }
    },
    {
      "id": "identify-pattern",
      "prompt": {
        "template": "Find common failure causes"
      }
    },
    {
      "id": "create-variant",
      "prompt": {
        "template": "Generate improved template addressing failures"
      }
    },
    {
      "id": "register-variant",
      "prompt": {
        "template": "Register variant in backend for Thompson Sampling"
      }
    }
  ]
}
```

---

#### 8. analyze-success-patterns 🔍 RESEARCH

**Purpose:** Identify patterns in successful executions across templates.

**Category:** Learning

**Inputs:**
- Template category (feature, bugfix, refactor)
- Success threshold (min success rate)
- Time range (last N executions)

**Outputs:**
- Pattern report (common sequences, tools, impulses)
- Recommendations (apply patterns to other templates)

**Priority:** LOW (nice-to-have, not critical)

**Blockers:** Need sufficient execution data

**Template Location:** `repos/minibob/templates/meta/analyze-success-patterns.json` (not designed)

**Design Notes:**
- Identify tool call sequences with high success
- Find impulse types that improve outcomes
- Extract prompt patterns that work well
- Recommend pattern application to underperforming templates

---

### Orchestration Meta-Activities

These coordinate system behavior.

#### 9. orchestrate-closed-loop 📋 DESIGNED

**Purpose:** Run full closed-loop cycle (plan → compile → execute → validate → realign).

**Category:** Orchestration

**Inputs:**
- User goal OR OpenSpec path
- Execution limits (cost, duration, attempts)

**Outputs:**
- Cycle completion report
- Final compliance status
- All intermediate artifacts (spec, template, traces, reports)

**Priority:** HIGH (needed for Phase 5)

**Blockers:**
- All closed-loop meta-activities must work first

**Template Location:** `repos/minibob/templates/meta/orchestrate-closed-loop.json` (not created)

**Design Notes:**
```json
{
  "id": "orchestrate-closed-loop",
  "category": "meta",
  "tasks": [
    {
      "id": "plan-or-load-spec",
      "prompt": {
        "template": "If goal provided, run plan-from-goal. Else load spec."
      }
    },
    {
      "id": "compile-template",
      "prompt": {
        "template": "Run compile-spec-to-activity"
      }
    },
    {
      "id": "execute-activity",
      "prompt": {
        "template": "Execute compiled template"
      }
    },
    {
      "id": "validate-compliance",
      "prompt": {
        "template": "Run validate-spec-compliance"
      }
    },
    {
      "id": "realign-if-needed",
      "prompt": {
        "template": "If drift detected, run execute-realignment"
      }
    }
  ]
}
```

---

#### 10. prioritize-specs 📋 DESIGNED

**Purpose:** Decide which spec to process next (multi-spec coordination).

**Category:** Orchestration

**Inputs:**
- Spec queue (pending specs)
- Resource availability (budget, time)
- Priority rules (importance, urgency)

**Outputs:**
- Next spec to process
- Priority rationale

**Priority:** LOW (needed for continuous operation)

**Blockers:** Single-spec cycle must work first

**Template Location:** `repos/minibob/templates/meta/prioritize-specs.json` (not designed)

**Design Notes:**
- Sort by priority score (importance × urgency)
- Consider resource constraints (cost limits)
- Avoid conflicts (concurrent edits to same files)
- Balance categories (feature/bugfix/refactor mix)

---

### Diagnostic Meta-Activities

These help debug and understand system behavior.

#### 11. diagnose-template-failure 📋 DESIGNED

**Purpose:** Analyze why template fails repeatedly.

**Category:** Diagnostic

**Inputs:**
- Template ID
- Failed execution traces

**Outputs:**
- Failure root cause (validation, tool error, LLM hallucination)
- Recommended fixes
- Confidence level

**Priority:** MEDIUM (helps optimize templates)

**Blockers:** None (can analyze traces manually)

**Template Location:** `repos/minibob/templates/meta/diagnose-template-failure.json` (not created)

**Design Notes:**
```json
{
  "id": "diagnose-template-failure",
  "category": "meta",
  "tasks": [
    {
      "id": "load-failures",
      "prompt": {
        "template": "Load all failed executions for {{templateId}}"
      }
    },
    {
      "id": "analyze-errors",
      "prompt": {
        "template": "Categorize failures: validation, tool error, or LLM issue"
      }
    },
    {
      "id": "identify-root-cause",
      "prompt": {
        "template": "Find common root cause across failures"
      }
    },
    {
      "id": "recommend-fixes",
      "prompt": {
        "template": "Suggest specific changes to template"
      }
    }
  ]
}
```

---

#### 12. trace-execution-path 🔍 RESEARCH

**Purpose:** Visualize execution path through tasks and tool calls.

**Category:** Diagnostic

**Inputs:**
- Execution trace ID

**Outputs:**
- Execution graph (tasks → tool calls → state transitions)
- Bottlenecks identified (slow steps)
- Cost breakdown (per task/tool)

**Priority:** LOW (helpful for debugging)

**Blockers:** Need visualization tooling

**Template Location:** `repos/minibob/templates/meta/trace-execution-path.json` (not designed)

**Design Notes:**
- Parse execution trace into graph structure
- Identify longest duration steps
- Show cumulative cost per branch
- Highlight failed paths

---

## Implementation Priority

### Phase 1 (Next 2 Weeks) - CRITICAL

1. ✅ **compile-spec-to-activity** - Prove closed-loop concept
   - Define minimal OpenSpec format
   - Implement compilation logic
   - Test on simple spec

### Phase 2 (Weeks 3-5) - HIGH

2. ❌ **observe-runtime** - Enable validation
3. ❌ **validate-spec-compliance** - Detect drift

### Phase 3 (Weeks 6-9) - HIGH

4. ❌ **execute-realignment** - Close the loop
5. ⚠️ **extract-template** - Test existing code

### Phase 4 (Weeks 10-13) - MEDIUM

6. ❌ **optimize-template** - Continuous improvement
7. 📋 **orchestrate-closed-loop** - Automate full cycle

### Phase 5 (Weeks 14+) - LOW

8. 📋 **diagnose-template-failure** - Better debugging
9. 📋 **prioritize-specs** - Multi-spec coordination
10. 🔍 **analyze-success-patterns** - Pattern mining
11. 🔍 **trace-execution-path** - Visualization

## Dependencies

**Critical Path:**
```
compile-spec-to-activity (Phase 1)
    ↓
observe-runtime (Phase 2)
    ↓
validate-spec-compliance (Phase 2)
    ↓
execute-realignment (Phase 3)
    ↓
orchestrate-closed-loop (Phase 4)
    ↓
[Continuous autonomous operation] (Phase 5-6)
```

**Parallel Tracks:**
```
Learning Track:
  extract-template (test existing)
      ↓
  optimize-template
      ↓
  analyze-success-patterns

Diagnostic Track:
  diagnose-template-failure
      ↓
  trace-execution-path
```

## Success Metrics

**For Each Meta-Activity:**
- Success rate (% of executions that complete)
- Cost per execution (USD)
- Duration per execution (ms)
- Output quality (manual validation initially)

**System-Level:**
- Template library growth rate (new templates/week)
- Optimization effectiveness (success rate improvement)
- Closed-loop cycle time (end-to-end duration)
- Manual intervention frequency (lower is better)

## References

**Related Documentation:**
- `closed-loop-architecture.md` - How meta-activities integrate
- `reliability-roadmap.md` - Implementation phases
- `validation-contracts.md` - OpenSpec format for compilation
- `domain-mappings.md` - Learning domain details

**Implementation:**
- `repos/minibob/templates/meta/` - Where templates will live (not created yet)
- `repos/minibob/src/activity.ts` - `assembleTemplateFromExecution()` (ribosome)
- `repos/metabob-activity-api/` - Backend learning and storage
