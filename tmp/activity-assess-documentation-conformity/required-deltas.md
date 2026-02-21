# Required Documentation Deltas

This document lists all required changes to achieve full conformity with the functional/instructional state paradigm.

**Total Deltas**: 66
**Estimated Total Effort**: 6.083333333333333 hours

## Priority Breakdown

- **Critical**: 3 deltas (paradigm contradictions)
- **High**: 1 deltas (incorrect terminology, missing concepts)
- **Medium**: 62 deltas (terminology clarifications)

---

## CRITICAL Priority Deltas (3 deltas)

### delta-006

**File**: `COMMUNICATION_FLOW_ARCHITECTURE.md`

**Location**: line 404

**Issue Type**: unclear_explanation

**Criterion**: check-6 - Emphasizes measurement and data-driven optimization over LLM reasoning

**Current Text**:
```
**Scenario**: System learns which template variants perform better
```

**Proposed Change**:
```
Variant promotion is based on measured success rates, not LLM reasoning
```

**Estimated Effort**: 15 minutes

---

### delta-005

**File**: `TEMPLATE_MANAGEMENT_ARCHITECTURE.md`

**Location**: line 145

**Issue Type**: unclear_explanation

**Criterion**: check-6 - Emphasizes measurement and data-driven optimization over LLM reasoning

**Current Text**:
```
✅ **Automatic A/B testing** - System learns which works
```

**Proposed Change**:
```
Variant promotion is based on measured success rates, not LLM reasoning
```

**Estimated Effort**: 15 minutes

---

### delta-007

**File**: `VARIANT_CREATION_AND_SESSION_AFFINITY_ARCHITECTURE.md`

**Location**: line 867

**Issue Type**: unclear_explanation

**Criterion**: check-6 - Emphasizes measurement and data-driven optimization over LLM reasoning

**Current Text**:
```
✅ System learns which variant is globally better
```

**Proposed Change**:
```
Variant promotion is based on measured success rates, not LLM reasoning
```

**Estimated Effort**: 15 minutes

---

## HIGH Priority Deltas (1 deltas)

### delta-003

**File**: `IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md`

**Location**: document-wide

**Issue Type**: terminology_error

**Criterion**: check-3 - Correctly positions LLM + activities + tools as the 'bridge' transforming instructional → functional...

**Current Text**:
```
Document-wide issue
```

**Proposed Change**:
```
The bridge (LLM + activities) transforms instructional state into functional state mutations
```

**Estimated Effort**: 10 minutes

---

## MEDIUM Priority Deltas (62 deltas)

### delta-054

**File**: `ACTIVITY_REPLAY_AND_STATE_ARCHITECTURE.md`

**Location**: line 102

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Recreate exact execution context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-053

**File**: `ACTIVITY_REPLAY_AND_STATE_ARCHITECTURE.md`

**Location**: line 94

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
impulses: Record<string, Impulse>  // Context requirements
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-050

**File**: `ARCHITECTURE_ASSESSMENT.md`

**Location**: line 18

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Session management and context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-008

**File**: `ARCHITECTURE_CORRECTION.md`

**Location**: line 20

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Requires activity session context to function
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-009

**File**: `ARCHITECTURE_CORRECTION.md`

**Location**: line 43

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
parentSessionID: ctx.sessionID,  // Parent session for context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-010

**File**: `ARCHITECTURE_QUICK_REFERENCE_OLD.md`

**Location**: line 208

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
OpenCode uses a **separation of concerns** between static and dynamic context:
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-011

**File**: `ARCHITECTURE_QUICK_REFERENCE_OLD.md`

**Location**: line 212

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
│           Tier 1: Static System Context            │
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-012

**File**: `ARCHITECTURE_SEPARATION_OF_CONCERNS.md`

**Location**: line 123

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- ✅ Memory agent (context selection)
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-013

**File**: `ARCHITECTURE_SEPARATION_OF_CONCERNS.md`

**Location**: line 273

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
│  │  (Execution)│  │  (Context)   │  │   config, etc.) │  │
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-056

**File**: `ARCHITECTURE_SESSION_ACTIVITY_UNIFICATION.md`

**Location**: line 103

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Observes: Task outcomes, context used, success/failure
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-055

**File**: `ARCHITECTURE_SESSION_ACTIVITY_UNIFICATION.md`

**Location**: line 26

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
│  • Context window            • Codebase files                │
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-014

**File**: `CONTEXT_ARCHITECTURE_COMPREHENSIVE_GUIDE.md`

**Location**: line 23

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
An **impulse** is a unit of context that carries:
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-015

**File**: `CONTEXT_ARCHITECTURE_COMPREHENSIVE_GUIDE.md`

**Location**: line 25

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- **Budget**: Token allocation for loading this context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-016

**File**: `CONTEXT_ARCHITECTURE_QUICK_REFERENCE.md`

**Location**: line 13

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
3. **Impulse `description`** → Created with intent metadata → Injected into context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-017

**File**: `CONTEXT_ARCHITECTURE_QUICK_REFERENCE.md`

**Location**: line 35

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
User Message → Intent Analysis (Haiku, <3s) → Impulse Creation → Context Injection
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-018

**File**: `CORRECT_FIX_ARCHITECTURE.md`

**Location**: line 50

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
// Get recent messages for context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-019

**File**: `CORRECT_FIX_ARCHITECTURE.md`

**Location**: line 59

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
description: "Context relevant to current user message",
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-020

**File**: `CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md`

**Location**: line 15

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- **metabob-opencode**: ⚠️ **Partial integration** (activity validation, context scoring)
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-021

**File**: `CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md`

**Location**: line 20

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- **High**: Impulse context prioritization (CPG impact scores)
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-022

**File**: `CRITICAL_ARCHITECTURE_ERRORS.md`

**Location**: line 32

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- OpenCode has the session context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-023

**File**: `CRITICAL_ARCHITECTURE_ERRORS.md`

**Location**: line 321

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Bun workspace catalog in `repos/metabob-opencode/package.json` not copied correctly to Docker build 
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-057

**File**: `EXECUTION_GRAPH_AND_SIDEBAR_ARCHITECTURE.md`

**Location**: line 44

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
// Context Window State
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-058

**File**: `EXECUTION_GRAPH_AND_SIDEBAR_ARCHITECTURE.md`

**Location**: line 46

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
estimatedTokens: number,          // Current context size
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-002

**File**: `IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md`

**Location**: line 23

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Dynamic context via impulses
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-001

**File**: `IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md`

**Location**: line 7

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
**Short Answer**: Impulses don't define agents—they define **dynamic context** that gets injected in
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-024

**File**: `MCP_GATEWAY_ARCHITECTURE.md`

**Location**: line 119

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
repos/metabob-opencode/packages/opencode/templates/built-in/evolve-activity-self-contained.json:    
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-025

**File**: `MCP_GATEWAY_ARCHITECTURE.md`

**Location**: line 122

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
repos/metabob-opencode/packages/opencode/dist/opencode-linux-arm64/templates/built-in/evolve-activit
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-026

**File**: `MEMORY_AGENT_ARCHITECTURE_RESTORATION.md`

**Location**: line 25

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
3. review-context-space - Call `memory_context_view`, decide what to load
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-027

**File**: `MEMORY_AGENT_ARCHITECTURE_RESTORATION.md`

**Location**: line 27

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
5. finalize-context - Summary and confirmation
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-028

**File**: `MEMORY_AGENT_ARCHITECTURE_VERIFIED.md`

**Location**: line 40

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
│  │ 3. review-context-space: Decide what to load          │  │
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-029

**File**: `MEMORY_AGENT_ARCHITECTURE_VERIFIED.md`

**Location**: line 42

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
│  │ 5. finalize-context: Summary and ready check          │  │
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-030

**File**: `PROMPT_OPTIMIZATION_ARCHITECTURE.md`

**Location**: line 15

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- ❌ Wastes context window
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-031

**File**: `PROMPT_OPTIMIZATION_ARCHITECTURE.md`

**Location**: line 41

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- **`none`**: No compression, full context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-032

**File**: `SESSION_ARCHITECTURE_CLARIFICATION.md`

**Location**: line 101

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
// Executes in same session with impulse context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-033

**File**: `SESSION_ARCHITECTURE_CLARIFICATION.md`

**Location**: line 140

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Test: Template execution → Verify impulses in context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-060

**File**: `SESSION_COMPLETE_IMPULSE_ARCHITECTURE_FIX.md`

**Location**: line 137

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
3. **Debugging** - See what context is loaded
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-059

**File**: `SESSION_COMPLETE_IMPULSE_ARCHITECTURE_FIX.md`

**Location**: line 66

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
const sessionID = context.sessionID
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-034

**File**: `SESSION_MEMORY_IMPULSE_ARCHITECTURE_STATUS.md`

**Location**: line 30

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Main agent turn starts with prepared context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-035

**File**: `SESSION_MEMORY_IMPULSE_ARCHITECTURE_STATUS.md`

**Location**: line 63

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
#### Task 3: review-context-space (memory agent)
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-061

**File**: `SHARED_INSTRUCTIONAL_STATE_ARCHITECTURE.md`

**Location**: line 45

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Make lifecycle hooks execute in parent session context:
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-062

**File**: `SHARED_INSTRUCTIONAL_STATE_ARCHITECTURE.md`

**Location**: line 66

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
// Execute directly in parent session context ✅
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-063

**File**: `SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`

**Location**: line 31

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- ✅ **Execution graph** representation showing all nodes and their context slices
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-064

**File**: `SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`

**Location**: line 39

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
**What**: Representation of available context for decision-making
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-004

**File**: `TEMPLATE_MANAGEMENT_ARCHITECTURE.md`

**Location**: line 245

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
context: { /* execution context */ }
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-036

**File**: `docs/architecture/ARCHITECTURE_ALIGNMENT_ISSUES.md`

**Location**: line 13

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
2. ❌ **Missing parent context** - Doesn't receive calling agent's instructions
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-037

**File**: `docs/architecture/ARCHITECTURE_ALIGNMENT_ISSUES.md`

**Location**: line 14

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
3. ❌ **New session per step** - No continuity, context lost between steps
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-039

**File**: `docs/architecture/ARCHITECTURE_SEPARATION_OF_CONCERNS.md`

**Location**: line 106

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- ✓ Detects priority issues based on session context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-038

**File**: `docs/architecture/ARCHITECTURE_SEPARATION_OF_CONCERNS.md`

**Location**: line 77

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- ✓ Resolves context requirements → impulses
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-040

**File**: `docs/architecture/ARCHITECTURE_VIOLATION_IDENTIFIED.md`

**Location**: line 144

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Returns high-level info: description, variables, context requirements.
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-041

**File**: `docs/architecture/ARCHITECTURE_VIOLATION_IDENTIFIED.md`

**Location**: line 154

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
1. **Context control**: Agent sees only current step, not entire plan
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-065

**File**: `docs/architecture/ARCHITECTURE_VISUAL.md`

**Location**: line 71

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
| MCP Server | 8082 | 8081 | Model Context Protocol |
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-066

**File**: `docs/architecture/ARCHITECTURE_VISUAL.md`

**Location**: line 80

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
| MCP Server | 8082 | 8082 | Model Context Protocol |
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-042

**File**: `docs/architecture/README.md`

**Location**: line 36

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
## Session Memory Agent - Intelligent Context Manager
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-043

**File**: `docs/architecture/README.md`

**Location**: line 38

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
**Transformation** (Feb 6, 2026): Router → Intelligent Context Manager
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-051

**File**: `metabob-apps/charts/slack-bot/SLACK_BOT_ARCHITECTURE.md`

**Location**: line 124

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Context Window:
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-044

**File**: `repos/metabob-cli/.gemini/ARCHITECTURE.md`

**Location**: line 15

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
│  1. Load resource: metabob://workflow-context                │
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-045

**File**: `repos/metabob-cli/.gemini/ARCHITECTURE.md`

**Location**: line 63

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Agent: Load metabob://workflow-context
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-047

**File**: `repos/metabob-opencode/packages/plugin-activities/ARCHITECTURE.md`

**Location**: line 23

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Context negotiation helpers (ContextNegotiator)
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-046

**File**: `repos/metabob-opencode/packages/plugin-activities/ARCHITECTURE.md`

**Location**: line 5

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
The Activities plugin package (`@opencode-ai/plugin-activities`) provides enhanced memory management
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-048

**File**: `repos/metabob-opencode/packages/plugin-metabob/ARCHITECTURE.md`

**Location**: line 20

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
- Context ranking utilities
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-049

**File**: `repos/metabob-opencode/packages/plugin-metabob/ARCHITECTURE.md`

**Location**: line 61

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
└── context-ranker.ts      # Context ranking utility
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

### delta-052

**File**: `repos/platform/metabob-apps/charts/slack-bot/SLACK_BOT_ARCHITECTURE.md`

**Location**: line 124

**Issue Type**: terminology_error

**Criterion**: check-2 - Consistently uses 'instructional state' to refer to context/knowledge guiding operations

**Current Text**:
```
Context Window:
```

**Proposed Change**:
```
Impulses are fragments of instructional state that guide LLM decisions
```

**Estimated Effort**: 5 minutes

---

## Application Instructions

### For High Priority Deltas

1. Locate the file and line number
2. Review the current text in context
3. Replace with the proposed change, adapting to fit the surrounding content
4. Verify the change maintains document flow and readability
5. Commit with message: `docs: fix high-priority conformity issue ({delta_id})`

### For Medium Priority Deltas

These are primarily terminology clarifications. Consider batch processing:

1. Group deltas by file
2. Apply all changes to a file in one edit session
3. Use find/replace for common patterns (e.g., 'context' → 'instructional state')
4. Review the entire file after changes to ensure coherence
5. Commit per file: `docs: clarify instructional state terminology in {filename}`

### Validation After Changes

After applying deltas, re-run the conformity assessment:

```bash
# Run the assessment activity again
# Expected outcome: conformity scores should improve to ≥0.95 for all modified files
```

---

*Generated by Activity Artifacts system - conformity assessment workflow*