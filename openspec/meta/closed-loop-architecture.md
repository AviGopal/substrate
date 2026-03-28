# Closed-Loop Architecture (OpenSpec ↔ MiniBob Integration)

**⚠️ STATUS: EXPERIMENTAL - Phase 0 (Design Only)**
**⚠️ CRITICAL: Meta-activities are NOT IMPLEMENTED except extract-template (untested)**
**Last Updated:** 2026-03-23

## Overview

The closed-loop architecture enables continuous alignment between specification (OpenSpec) and implementation (runtime behavior) through six phases. This is a **design reference document** - the system is not yet operational.

**What is the Closed Loop?**

A continuous cycle where:
1. Specifications define desired behavior
2. Implementation executes toward specification
3. Runtime behavior is observed
4. Deviations (drift) are detected
5. System realigns to specification
6. Learnings update specifications

**Key Insight:** This is NOT a waterfall process. The loop never stops - specification and implementation co-evolve through measured outcomes.

## Six Phases

```
┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: PLANNING                                            │
│ User goal → OpenSpec document (functional, performance)      │
│                                                              │
│ Meta-Activity: plan-from-goal ❌ NOT IMPLEMENTED             │
│ Input: Goal message                                          │
│ Output: OpenSpec document                                    │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 2: COMPILATION                                         │
│ OpenSpec → Activity template (executable recipe)             │
│                                                              │
│ Meta-Activity: compile-spec-to-activity ❌ NOT IMPLEMENTED   │
│ Input: OpenSpec document                                     │
│ Output: Activity template                                    │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 3: EXECUTION                                           │
│ Activity template → Runtime behavior (files, commits)        │
│                                                              │
│ Meta-Activity: N/A (standard activity execution) ✅          │
│ Input: Activity template                                     │
│ Output: Execution trace                                      │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 4: OBSERVATION                                         │
│ Runtime behavior → Captured state (traces, metrics)          │
│                                                              │
│ Meta-Activity: observe-runtime ❌ NOT IMPLEMENTED            │
│ Input: Execution trace                                       │
│ Output: Observable state snapshot                            │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 5: VALIDATION                                          │
│ Compare spec vs runtime → Compliance report (drift metrics)  │
│                                                              │
│ Meta-Activity: validate-spec-compliance ❌ NOT IMPLEMENTED   │
│ Input: OpenSpec + Observable state                           │
│ Output: Compliance report (pass/fail/drift)                  │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 6: REALIGNMENT                                         │
│ Drift detected → Fix implementation OR update spec           │
│                                                              │
│ Meta-Activity: execute-realignment ❌ NOT IMPLEMENTED        │
│ Input: Compliance report                                     │
│ Output: Updated implementation OR updated spec               │
└──────────────────────────────────────────────────────────────┘
                        │
                        └──────▶ [Loop back to Phase 2 or Phase 1]
```

## Phase Descriptions

### Phase 1: Planning

**Goal:** Transform user intent into structured specification.

**Process:**
1. User provides goal message (e.g., "Add user authentication")
2. LLM generates OpenSpec document with:
   - Functional requirements
   - Performance criteria
   - Validation rules
   - Acceptable drift thresholds

**Inputs:**
- User goal message (string)
- Context (codebase structure, existing specs)

**Outputs:**
- OpenSpec document (markdown or structured format)

**Meta-Activity:** `plan-from-goal.json` ❌ NOT IMPLEMENTED

**Status:** Design only. No implementation exists.

### Phase 2: Compilation

**Goal:** Convert specification into executable activity template.

**Process:**
1. Parse OpenSpec document
2. Extract functional requirements
3. Generate task sequence with:
   - Prompts for each step
   - Validation criteria
   - Variable definitions
4. Include metadata for traceability

**Inputs:**
- OpenSpec document
- Template library (for reference/composition)

**Outputs:**
- Activity template (JSON)
- Compilation metadata (spec version, generation timestamp)

**Meta-Activity:** `compile-spec-to-activity.json` ❌ NOT IMPLEMENTED

**Status:** Design only. Critical for proving closed-loop concept.

**Design Notes:**
```json
{
  "id": "compile-spec-to-activity",
  "category": "meta",
  "tasks": [
    {
      "id": "parse-spec",
      "prompt": {
        "template": "Parse OpenSpec document {{specPath}} and extract requirements"
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
        "template": "Add validation rules from spec performance criteria"
      }
    },
    {
      "id": "write-template",
      "prompt": {
        "template": "Write complete activity template to templates/{{templateId}}.json"
      },
      "validation": {
        "requiredFiles": ["templates/{{templateId}}.json"],
        "requiredPatterns": ["\"category\":", "\"tasks\":"]
      }
    }
  ]
}
```

### Phase 3: Execution

**Goal:** Execute activity template, transforming codebase state.

**Process:**
1. Load activity template
2. Resolve impulses (context injection)
3. Execute tasks with LLM + tools
4. Capture execution trace with state snapshots

**Inputs:**
- Activity template
- Variables (user-provided or goal-inferred)
- Impulses (context data)

**Outputs:**
- Execution trace (full history)
- Modified files (git-trackable changes)
- Metrics (cost, duration, tokens)

**Meta-Activity:** N/A (standard activity execution via ActivityExecutor)

**Status:** ✅ IMPLEMENTED and VALIDATED

**Implementation:**
- `repos/minibob/src/activity.ts` - ActivityExecutor
- `repos/minibob/src/goal-processor.ts` - Goal-driven execution

### Phase 4: Observation

**Goal:** Capture runtime behavior for comparison with spec.

**Process:**
1. Load execution trace
2. Extract observable state:
   - Files modified (diffs)
   - Tests executed (pass/fail)
   - Performance metrics (duration, memory)
   - Tool calls made
3. Structure for validation phase

**Inputs:**
- Execution trace
- Observable state selectors (what to capture)

**Outputs:**
- Observable state snapshot (structured data)

**Meta-Activity:** `observe-runtime.json` ❌ NOT IMPLEMENTED

**Status:** Design only. May be merged with Phase 5 (validation).

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
        "template": "Extract observable state: files, tests, metrics, tool calls"
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

### Phase 5: Validation

**Goal:** Compare runtime behavior against specification.

**Process:**
1. Load OpenSpec document
2. Load observable state snapshot
3. Compare functional requirements vs actual behavior
4. Calculate drift metrics:
   - Functional drift: Missing/incorrect features
   - Performance drift: Slower/costlier than threshold
   - Behavioral drift: Unexpected side effects
5. Generate compliance report

**Inputs:**
- OpenSpec document
- Observable state snapshot
- Drift thresholds (from spec)

**Outputs:**
- Compliance report:
  - Status: PASS, FAIL, or DRIFT
  - Drift measurements (quantitative)
  - Violation details (what's wrong)
  - Realignment recommendations

**Meta-Activity:** `validate-spec-compliance.json` ❌ NOT IMPLEMENTED

**Status:** Design only. Critical for detecting deviations.

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
        "template": "Verify all functional requirements are met"
      }
    },
    {
      "id": "compare-performance",
      "prompt": {
        "template": "Check runtime metrics against performance thresholds"
      }
    },
    {
      "id": "calculate-drift",
      "prompt": {
        "template": "Measure drift for each requirement, classify as PASS/FAIL/DRIFT"
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

### Phase 6: Realignment

**Goal:** Restore compliance when drift is detected.

**Process:**
1. Load compliance report
2. Decide realignment strategy:
   - **Fix implementation:** Runtime violates spec (bug)
   - **Update spec:** Spec is too strict/unrealistic
   - **Accept drift:** Within acceptable threshold
3. Execute realignment action
4. Re-validate to confirm compliance

**Inputs:**
- Compliance report
- Realignment strategy (decision logic)

**Outputs:**
- Updated implementation (code changes) OR
- Updated spec (revised requirements) OR
- Acceptance record (drift acknowledged)

**Meta-Activity:** `execute-realignment.json` ❌ NOT IMPLEMENTED

**Status:** Design only. Most complex phase.

**Design Notes:**
```json
{
  "id": "execute-realignment",
  "category": "meta",
  "tasks": [
    {
      "id": "analyze-drift",
      "prompt": {
        "template": "Load compliance report {{reportId}} and identify drift causes"
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
        "template": "Apply chosen strategy (modify code or update spec)"
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

## Integration Points

### OpenSpec → MiniBob

**Spec Format Requirements:**
```markdown
# OpenSpec: User Authentication

## Functional Requirements
- [ ] User model with password hashing (bcrypt)
- [ ] POST /login endpoint returning JWT
- [ ] Authentication middleware for protected routes

## Performance Requirements
- Login response time: < 200ms (p95)
- Password hashing: < 100ms
- Total cost: < $0.50 per implementation

## Validation Rules
- Tests must pass: test/auth.test.ts
- Security check: No plaintext passwords
- Code coverage: > 80% for auth module

## Drift Thresholds
- Functional: 0% (all requirements must be met)
- Performance: 10% variance acceptable
- Cost: 20% variance acceptable
```

**Compilation Output:**
```json
{
  "id": "implement-user-auth-from-spec",
  "name": "Implement User Authentication",
  "category": "feature",
  "metadata": {
    "compiledFrom": "specs/user-authentication.md",
    "specVersion": "1.0",
    "compiledAt": "2026-03-23T10:00:00Z"
  },
  "tasks": [
    {
      "id": "create-user-model",
      "description": "Create User model with bcrypt password hashing",
      "prompt": {
        "template": "Create User model in src/models/user.ts with bcrypt password hashing"
      },
      "validation": {
        "requiredFiles": ["src/models/user.ts"],
        "requiredPatterns": ["bcrypt", "hashPassword"],
        "forbiddenPatterns": ["plaintext", "password:", "pwd:"]
      }
    }
  ]
}
```

### MiniBob → Compliance Report

**Execution Trace Format:**
```json
{
  "executionId": "exec-123",
  "templateId": "implement-user-auth-from-spec",
  "status": "completed",
  "metrics": {
    "duration": 45000,
    "cost": 0.38,
    "totalTokens": {"input": 5000, "output": 2000}
  },
  "executionTrace": {
    "filesModified": ["src/models/user.ts", "src/routes/auth.ts"],
    "filesCreated": ["test/auth.test.ts"],
    "stateTransition": {
      "before": {"src/models/user.ts": "abc123"},
      "after": {"src/models/user.ts": "def456"}
    }
  }
}
```

**Compliance Report Format:**
```json
{
  "reportId": "report-456",
  "specPath": "specs/user-authentication.md",
  "executionId": "exec-123",
  "timestamp": "2026-03-23T10:05:00Z",
  "status": "DRIFT",
  "compliance": {
    "functional": {
      "status": "PASS",
      "checks": [
        {"requirement": "User model with bcrypt", "met": true},
        {"requirement": "POST /login endpoint", "met": true},
        {"requirement": "Auth middleware", "met": true}
      ]
    },
    "performance": {
      "status": "DRIFT",
      "drift": 15,
      "metrics": [
        {"name": "Login response time", "expected": 200, "actual": 230, "drift": 15}
      ]
    },
    "cost": {
      "status": "PASS",
      "expected": 0.50,
      "actual": 0.38,
      "drift": -24
    }
  },
  "recommendations": [
    "Performance drift detected (15%). Consider optimizing login endpoint.",
    "All functional requirements met.",
    "Cost under budget."
  ]
}
```

## Learning from Closed-Loop

### What's Captured

**Spec → Template Success Rate:**
- How often compiled templates execute successfully
- Which spec patterns compile to working templates
- Template complexity vs success rate

**Drift Patterns:**
- Which requirements drift most frequently
- Cost of maintaining compliance
- Realignment success rates

**Realignment Strategies:**
- Fix implementation vs update spec ratios
- Which fixes work first try
- Re-validation pass rates

### Backend Integration

**New Impulse Types:**
```typescript
{
  "id": "spec-doc",
  "pointer": {
    "type": "openSpec",
    "path": "specs/user-authentication.md"
  },
  "budget": 3000
}

{
  "id": "compliance-report",
  "pointer": {
    "type": "complianceReport",
    "reportId": "report-456"
  },
  "budget": 2000
}
```

**New Endpoints:**
```typescript
// Store compliance reports
POST /v2/validation/compliance-reports
{
  reportId, specPath, executionId, status, compliance, recommendations
}

// Query drift patterns
GET /v2/validation/drift-patterns?specPath=specs/user-authentication.md

// Realignment history
GET /v2/validation/realignments?limit=10
```

## Current Limitations (Why Phase 0)

### 1. Meta-Activities Don't Exist

**Status:**
- ❌ `plan-from-goal.json` - Not created
- ❌ `compile-spec-to-activity.json` - Not created (CRITICAL)
- ✅ Standard activity execution - Works
- ❌ `observe-runtime.json` - Not created
- ❌ `validate-spec-compliance.json` - Not created
- ❌ `execute-realignment.json` - Not created

**Only Partial:**
- ⚠️ `extract-template.json` - Exists but untested (ribosome pattern)

### 2. OpenSpec Format Not Standardized

**Missing:**
- Required sections definition
- Metadata format
- Compilation annotations
- Drift threshold syntax

### 3. Validation Logic Not Implemented

**Missing:**
- Spec parser
- Runtime comparator
- Drift calculator
- Compliance reporter

### 4. No Realignment Decision Logic

**Missing:**
- Strategy selection (fix vs update vs accept)
- Confidence thresholds
- Automatic vs manual decision

### 5. Learning Loop Not Connected

**Missing:**
- Spec → template success tracking
- Drift pattern recognition
- Realignment effectiveness measurement

## Reliability Roadmap

See `reliability-roadmap.md` for detailed phases.

**Current Status:** Phase 0 - Design documented

**Next Step:** Phase 1 - Implement `compile-spec-to-activity`

**Timeline:**
- Phase 0: ✅ Complete (this document)
- Phase 1: 🔜 ~2 weeks (prove compilation works)
- Phase 2-6: ❌ Not started (3-6 months estimated)

## When to Use This Document

**✅ Good Uses:**
- Understanding overall closed-loop vision
- Designing OpenSpec format
- Planning integration points
- Discussing future capabilities

**❌ Don't Use For:**
- Operational procedures (nothing is implemented)
- Current system capabilities (this is future state)
- Debugging (no code to debug)
- Performance tuning (doesn't run yet)

## References

**Related Documentation:**
- `reliability-roadmap.md` - Phases to make this operational
- `meta-activities-catalog.md` - Status of all meta-activities
- `validation-contracts.md` - OpenSpec format requirements
- `domain-mappings.md` - Validation domain details
- `goal-seeking-architecture.md` - Phase 3 (execution) implementation

**Implementation (Future):**
- `repos/minibob/templates/meta/` - Where meta-activities will live
- `repos/metabob-activity-api/src/routes/validation.ts` - Validation endpoints (not created)
- `openspec/` - Specification documents (format TBD)
