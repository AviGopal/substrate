# Mechanism → Activity → Impulse Map

This document maps the available mechanisms to the implied activities they support, the impulses that become relevant, when those impulses are valid, and what to suggest next.

---

## 1. Evidence Sources (What We Can Observe)

| Source | Mechanism | Signal Produced |
|--------|-----------|-----------------|
| **MCP Tool Calls** | metabob-mcp session tracking | Tool name, args, duration, success, files/problems referenced |
| **Activity Executions** | MiniBob execution traces | Task sequence, tool calls, state transitions, success/failure |
| **Git History** | Git import (planned) | File co-changes, commit messages, change frequency |
| **CI/CD Results** | POST /v2/activities/ci-result | Build success, test pass/fail, deployment status |
| **User Investigations** | MCP search_codebase, get_priority_issues | What users look for, what they resolve |
| **Problem Resolutions** | mark_problem_complete | Which problems get fixed, resolution patterns |

---

## 2. Implied Activities (What Must Be Happening)

Based on tool usage patterns, we can infer these activities are ongoing:

### 2.1 Investigation Activity
**Triggered by:** `get_priority_issues`, `search_codebase`
**Implied:** User suspects something is wrong, seeking evidence

```
Signals:
  - Files investigated (from search results)
  - Problems viewed (from priority issues)
  - Search queries used (what they're looking for)

Valid Impulses:
  - problemCluster: Show aggregated problems in area
  - activityExecutionTrace: If investigating a failed execution
  - failurePatterns: Common failures in recent history
```

### 2.2 Impact Assessment Activity
**Triggered by:** `analyze_change_impact`, `suggest_related_changes`
**Implied:** User planning changes, assessing risk

```
Signals:
  - Files being considered for change
  - Depth of dependency analysis requested
  - Related files suggested

Valid Impulses:
  - impactAnalysis: Show dependency graph
  - cochangeSuggestions: Files that change together
  - activityMetrics: Success rate of similar changes
```

### 2.3 Implementation Activity
**Triggered by:** `generate_implementation_spec`
**Implied:** User starting new feature or refactoring

```
Signals:
  - Goal description
  - Entry point files
  - Estimated complexity

Valid Impulses:
  - activityTemplate: Proven templates for similar work
  - successPatterns: What worked well before
  - templateComparison: Which variant to use
```

### 2.4 Resolution Activity
**Triggered by:** `mark_problem_complete`
**Implied:** User fixed something, closing the loop

```
Signals:
  - Problem ID resolved
  - Resolution summary (how it was fixed)
  - Commit reference

Valid Impulses:
  - activityExecutionTrace: Full trace of fix process
  - problemCluster: Remaining problems in same area
  - cochangeSuggestions: Other files that might need same fix
```

### 2.5 Documentation Activity
**Triggered by:** `annotate_component`
**Implied:** User recording context for future reference

```
Signals:
  - Component being documented
  - Type of annotation (decision, explanation, todo)
  - Linked problems

Valid Impulses:
  - analysisResult: Related problems to link
  - activityExecutionTrace: Recent work on this component
```

---

## 3. Impulse Validity Conditions

When is each impulse type actually useful?

| Impulse Type | Valid When | Invalid/Skip When |
|--------------|------------|-------------------|
| `problemCluster` | Problems exist for session; user investigating | No problems; user already resolved area |
| `activityExecutionTrace` | Execution exists; debugging or reviewing | No prior execution; irrelevant to current goal |
| `activityTemplate` | Similar work done before; template exists | Novel task; no templates match |
| `activityMetrics` | Template has execution history | New template; no metrics yet |
| `failurePatterns` | Failures exist in recent history | All recent executions succeeded |
| `successPatterns` | Successes exist; user optimizing | No successes; user debugging |
| `cochangeSuggestions` | Files have cochange history; making changes | No history; just reading code |
| `impactAnalysis` | CPG indexed; considering changes | No index; exploring only |
| `codebaseSearch` | CPG indexed; looking for patterns | No index |
| `recentExecutions` | History exists; reviewing trends | No history |
| `templateComparison` | Multiple variants exist; choosing | Single variant only |

---

## 4. Activity State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────┴─────┐
│  IDLE   │───►│ INVESTIGATE │───►│    ASSESS    │───►│  IMPLEMENT │
└─────────┘    └─────────────┘    └──────────────┘    └────────────┘
     ▲              │                   │                    │
     │              │                   │                    │
     │              ▼                   ▼                    ▼
     │         ┌─────────┐        ┌──────────┐         ┌──────────┐
     │         │ ABANDON │        │  RESOLVE │         │  RESOLVE │
     │         └────┬────┘        └────┬─────┘         └────┬─────┘
     │              │                  │                    │
     └──────────────┴──────────────────┴────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ DOCUMENT/ANNOTATE│
                    └──────────────────┘
```

**State Transitions:**

| From | To | Trigger | Evidence |
|------|----|---------|----------|
| IDLE | INVESTIGATE | `get_priority_issues`, `search_codebase` | Tool call logged |
| INVESTIGATE | ASSESS | `analyze_change_impact`, `suggest_related_changes` | Files identified |
| INVESTIGATE | ABANDON | Session timeout without resolution | No `mark_problem_complete` |
| ASSESS | IMPLEMENT | `generate_implementation_spec` | Spec generated |
| ASSESS | RESOLVE | `mark_problem_complete` | Quick fix, no new code |
| IMPLEMENT | RESOLVE | `mark_problem_complete` | Feature/fix complete |
| Any | DOCUMENT | `annotate_component` | Context recorded |
| RESOLVE | IDLE | Session end | Loop closed |
| ABANDON | IDLE | Session end | Loop open (learning signal!) |

---

## 5. Next Suggestion Logic

Based on current state and available impulses, suggest what to do next:

### 5.1 User Just Started (IDLE → INVESTIGATE)

```typescript
if (no_recent_activity) {
  // Suggest investigating priority issues
  suggest: "get_priority_issues"

  relevant_impulses: [
    { type: "problemCluster", validity: "if problems exist" },
    { type: "failurePatterns", validity: "if recent failures" },
  ]
}
```

### 5.2 User Is Investigating

```typescript
if (searched_for_something && !resolved_anything) {
  // Suggest drilling deeper or assessing impact
  suggest: "analyze_change_impact" OR "search_codebase" (refinement)

  relevant_impulses: [
    { type: "problemCluster", filter_by: files_investigated },
    { type: "cochangeSuggestions", for: files_investigated },
    { type: "activityExecutionTrace", if: "similar failures exist" },
  ]
}
```

### 5.3 User Is Assessing Impact

```typescript
if (ran_impact_analysis) {
  // Suggest implementation or resolution
  suggest: "generate_implementation_spec" OR "mark_problem_complete"

  relevant_impulses: [
    { type: "activityTemplate", matching: "goal inferred from queries" },
    { type: "successPatterns", for: "similar changes" },
    { type: "templateComparison", if: "variants exist" },
  ]
}
```

### 5.4 User Is Implementing

```typescript
if (spec_generated) {
  // Suggest related changes and eventual resolution
  suggest: "suggest_related_changes" → "mark_problem_complete"

  relevant_impulses: [
    { type: "cochangeSuggestions", for: "files in spec" },
    { type: "impactAnalysis", for: "files being modified" },
  ]
}
```

### 5.5 User Just Resolved Something

```typescript
if (marked_problem_complete) {
  // Suggest documenting or finding similar issues
  suggest: "annotate_component" OR "search_codebase (similar issues)"

  relevant_impulses: [
    { type: "problemCluster", filter_by: "same category, unresolved" },
    { type: "cochangeSuggestions", for: "resolved file" },
  ]
}
```

### 5.6 User Abandoned Investigation

```typescript
if (session_timeout && files_investigated && !resolved) {
  // LEARNING SIGNAL: Something was hard to fix
  // Next time, surface this to other users

  record_signal: {
    type: "abandoned_investigation",
    files: files_investigated,
    queries: search_queries_used,
    org_id: current_org,
  }

  // For next user in same org investigating same area:
  suggest: "Related investigation by colleague (no resolution yet)"
}
```

---

## 6. Cross-User Learning Signals

| Signal | Meaning | Action |
|--------|---------|--------|
| Same file investigated by 2+ users | Systemic issue | Boost priority in `get_priority_issues` |
| Same query by 2+ users | Common concern | Add as suggested search |
| File investigated but never resolved | Hard problem | Flag for senior review |
| File quickly resolved by multiple users | Well-understood fix | Extract pattern |
| Sequence leads to resolution | Proven workflow | Recommend to similar situations |

---

## 7. Implementation Checklist

To make this work, we need:

### Already Implemented ✓
- [x] MCP tool calls tracked in session
- [x] problemCluster impulse with metadata
- [x] Activity execution trace storage
- [x] Thompson Sampling for templates
- [x] Co-change suggestions

### Needs Implementation
- [ ] **Investigation trace submission** (Milestone 2 of investigation-chain-learning)
- [ ] **Resolution trigger** (Milestone 3)
- [ ] **Pattern emergence queries** (Milestone 4)
- [ ] **Cross-user signal aggregation** (Milestone 5)
- [ ] **Next suggestion logic** (new: suggest_next_action endpoint)

### Future Enhancements
- [ ] Git history import as traces
- [ ] CI/CD feedback integration
- [ ] Hypothesis confidence scoring
- [ ] Multi-org anonymized learning

---

## 8. Quick Reference: What Impulse When?

```
┌────────────────────────────────────────────────────────────────┐
│ USER STATE        │ OFFER THESE IMPULSES                       │
├───────────────────┼────────────────────────────────────────────┤
│ Just started      │ problemCluster, failurePatterns            │
│ Searching         │ codebaseSearch, analysisResult             │
│ Found issues      │ impactAnalysis, cochangeSuggestions        │
│ Planning changes  │ activityTemplate, templateComparison       │
│ Implementing      │ successPatterns, activityMetrics           │
│ Debugging         │ activityExecutionTrace, failurePatterns    │
│ Resolving         │ cochangeSuggestions, problemCluster        │
│ Documenting       │ analysisResult (for linking)               │
└───────────────────┴────────────────────────────────────────────┘
```
