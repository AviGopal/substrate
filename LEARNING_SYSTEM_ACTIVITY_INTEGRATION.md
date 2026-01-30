# Learning System + Activity Integration Guide

**Created**: January 30, 2026  
**Last Updated**: January 30, 2026  
**Status**: Implementation Ready  
**Purpose**: Enable double-blind learning system to work seamlessly with activity templates for continuous improvement

---

## Executive Summary

This document describes how to integrate the **Double-Blind Learning Architecture** (v3.0.0) with **Activity Templates** to create a self-improving development system that learns from every fix, refactor, and implementation.

**Architecture Foundation**: This integration enforces **strict separation of concerns** (see SEPARATION_OF_CONCERNS.md):
- **metabob-opencode**: Executes activities, coordinates agents, makes task decisions (NO CPG analysis, NO learning logic)
- **metabob-cli**: Provides pure CPG analysis via MCP (NO scores, NO recommendations, stateless)
- **metabob-rpc-api**: Learns from outcomes, provides opaque recommendations (NO task execution, NO CPG parsing)

**Golden Rule**: Each component has ONE job. No overlap. No responsibility bleed.

**Key Integration Points**:
1. **Activity Execution** → Learning Feedback Loop
2. **Metabob CPG Analysis** → Component Targeting
3. **Thompson Sampling** → Activity Template Selection
4. **Association Learning** → Context Optimization
5. **Validation Gates** → Quality Assurance

**Current State**:
- ✅ Double-blind architecture designed (FINAL_ARCHITECTURE_SUMMARY.md)
- ✅ Activity system operational with 15+ templates
- ✅ Metabob CPG integration via MCP (metabob-cli)
- ⚠️  Learning system backend NOT YET IMPLEMENTED (metabob-rpc-api)
- ⚠️  Thompson Sampling NOT YET OPERATIONAL
- ✅ Component-targeted-fix-with-learning template EXISTS (v1.0.0 design)

**Implementation Status**: **READY TO BUILD** (6-week roadmap in place)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      metabob-opencode                                │
│  RESPONSIBILITY: Task Execution & Agent Coordination                │
│                                                                      │
│  Agent Workflow (Activity-First):                                   │
│  1. Receive user request: "Fix memory leak in session messages"    │
│  2. search_activities({ category: "bugfix" })                       │
│  3. Pattern match: "fix bug" → fix-bug-complete                    │
│  4. Execute activity with variables and reason                      │
│                                                                      │
│  NEW WITH LEARNING SYSTEM:                                          │
│  5. Query RPC API: "Give me recommendation for this task"          │
│  6. Receive: { activity: "fix-bug-complete", context: [...] }     │
│  7. Execute activity with optimized context                         │
│  8. Post feedback: { impression_id, outcome: "success" }           │
│                                                                      │
│  DOES NOT: Parse code, store learning data, implement Thompson     │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ MCP (stdio) - pure CPG, no scores
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      metabob-cli (MCP Mode)                          │
│  RESPONSIBILITY: Pure CPG Analysis                                  │
│                                                                      │
│  Tools (UNCHANGED, pure CPG analysis):                              │
│  - metabob_search_codebase_issues("memory leak")                    │
│    → [{component_id: "src/session/index.ts::messages", ...}]       │
│  - metabob_analyze_change_impact(file, component)                  │
│  - metabob_suggest_related_changes(files)                          │
│  - metabob_assess_deletion_safety(file, component)                 │
│                                                                      │
│  Returns: Pure data (component IDs, dependencies, existence checks) │
│  DOES NOT: Return scores, make recommendations, store state        │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ HTTP/REST (recommendations, feedback)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      metabob-rpc-api                                 │
│  RESPONSIBILITY: Learning & Recommendations                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Recommendation Service (Double-Blind)                          │ │
│  │                                                                │ │
│  │ POST /api/v1/recommendations/get                              │ │
│  │ Input:                                                         │ │
│  │   { task: "Fix memory leak", component_ids: [...] }           │ │
│  │                                                                │ │
│  │ Internal Process (HIDDEN from agent):                         │ │
│  │ 1. Embed task text → 32-dim vector                           │ │
│  │ 2. Query SurrealDB: Find similar components                  │ │
│  │ 3. Load associations: component → impulse weights            │ │
│  │ 4. Thompson Sampling: Sample from Beta(alpha, beta)          │ │
│  │ 5. Select activity variant with highest sample               │ │
│  │ 6. Select context impulses (top weighted, within budget)     │ │
│  │ 7. Generate impression_id                                     │ │
│  │ 8. LOG: {impression_id, variant, theta_sampled, timestamp}   │ │
│  │                                                                │ │
│  │ Output (NO SCORES, NO METRICS):                               │ │
│  │   {                                                            │ │
│  │     recommended_activity: "fix-bug-complete",                 │ │
│  │     context_impulses: [{id, type, content}],                  │ │
│  │     impression_id: "imp_abc123"                               │ │
│  │   }                                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Feedback Service (Outcome Recording)                           │ │
│  │                                                                │ │
│  │ POST /api/v1/feedback/record                                  │ │
│  │ Input:                                                         │ │
│  │   {                                                            │ │
│  │     impression_id: "imp_abc123",                              │ │
│  │     outcome: "success",                                        │ │
│  │     metrics: {cost: 0.12, duration: 45000, tokens: 8000}     │ │
│  │   }                                                            │ │
│  │                                                                │ │
│  │ Internal Process (HIDDEN from agent):                         │ │
│  │ 1. Look up assignment: imp_abc123 → variant_A                │ │
│  │ 2. Update Thompson: alpha_A = 24 → 25 (success)              │ │
│  │ 3. Update associations: impulse_xyz weight++ for component   │ │
│  │ 4. Trigger Celery: update_parameters.delay()                  │ │
│  │ 5. Persist to SurrealDB                                       │ │
│  │                                                                │ │
│  │ Output (NO DETAILS):                                          │ │
│  │   { recorded: true }                                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Celery Beat (Background Learning)                              │ │
│  │                                                                │ │
│  │ - Every 15 min: Batch update Thompson parameters             │ │
│  │ - Every hour: Update association weights                      │ │
│  │ - Every week: Prune weak associations (<0.2 weight)          │ │
│  │ - Daily: Generate analytics (humans only)                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  SurrealDB Storage (ALL HIDDEN from agents):                       │
│  - activity_variants: {variant_id, alpha, beta, impressions}       │
│  - variant_assignments: {impression_id, variant, outcome}          │
│  - component_impulse_associations: {component, impulse, weight}    │
│  - component_embeddings: {component_id, embedding[32]}             │
│                                                                      │
│  DOES NOT: Parse code, execute activities, expose learning internals│
└──────────────────────────────────────────────────────────────────────┘
```

**Separation of Concerns**: Each layer has ONE responsibility. opencode executes, cli analyzes, rpc-api learns. No overlap.

---

## Integration Patterns

### Pattern 1: Activity-First with Learning (RECOMMENDED)

**Use Case**: Standard feature/bug/refactor work where learning improves over time

**Flow**:
```typescript
// 1. Agent searches for activity (existing behavior)
await search_activities({ category: "bugfix" })

// 2. Agent queries learning system (NEW)
const recommendation = await fetch('http://api-server:8080/api/v1/recommendations/get', {
  method: 'POST',
  body: JSON.stringify({
    task: "Fix memory leak in session messages",
    component_ids: ["src/session/index.ts::messages"],
    task_type: "fix_bug"
  })
})

// Response (opaque, no scores):
// {
//   recommended_activity: "fix-bug-complete",
//   context_impulses: [{id: "impulse_xyz", type: "pattern", content: "..."}],
//   impression_id: "imp_abc123"
// }

// 3. Agent executes activity with recommended context
await activity({
  templateId: recommendation.recommended_activity,
  variables: {
    bugDescription: "Memory leak in session messages",
    files: ["src/session/index.ts"]
  },
  reason: "Fix memory leak reported by user"
})

// 4. Agent posts feedback (NEW)
await fetch('http://api-server:8080/api/v1/feedback/record', {
  method: 'POST',
  body: JSON.stringify({
    impression_id: recommendation.impression_id,
    outcome: activitySucceeded ? "success" : "failure",
    metrics: {
      cost: 0.12,
      duration: 45000,
      tokens: {input: 5000, output: 3000, cache: 2000}
    }
  })
})

// Server learns in background (NO response data shown to agent)
```

**Benefits**:
- ✅ Agent behavior unchanged (still uses activities)
- ✅ Learning happens transparently
- ✅ Context optimizes over time
- ✅ No bias from visible scores

---

### Pattern 2: Component-Targeted Fix with Learning (ADVANCED)

**Use Case**: Complex bugs requiring CPG decomposition + learning-guided context

**Flow**:
```typescript
// Use specialized activity template
await activity({
  templateId: "component-targeted-fix-with-learning",
  variables: {
    issueDescription: "Memory leak in session messages",
    repository: "/workspace",
    validationCommand: "npm test"
  },
  reason: "Fix memory leak with CPG-guided decomposition and learning"
})

// Activity internally:
// Task 1: decompose-by-components (uses metabob_search_codebase_issues)
// Task 2: load-component-annotations (queries RPC for historical annotations)
// Task 3: load-association-graph (queries RPC for impulse associations)
// Task 4: generate-optimized-prompts (uses learned patterns)
// Task 5: execute-component-fixes (applies optimized prompts)
// Task 6: validate-fixes (runs tests)
// Task 7: refine-annotations (updates metabob annotations)
// Task 8: update-associations (posts feedback to RPC)
// Task 9: commit-changes (with learning metadata)
```

**Benefits**:
- ✅ Full learning loop integrated
- ✅ CPG decomposition + learned context
- ✅ Validation gates prevent bad commits
- ✅ System learns from every attempt

**Current Status**: Template exists but RPC backend NOT YET IMPLEMENTED

---

### Pattern 3: Debug and Evolve Activities (META)

**Use Case**: Use learning system to improve activity templates themselves

**Flow**:
```typescript
// 1. Detect activity execution pattern (e.g., fix-bug-complete fails often for "memory leaks")
// 2. Query learning system: What's the success rate breakdown?
// 3. RPC API (internal analytics, humans only): 
//    - fix-bug-complete for "memory leak": 40% success
//    - component-targeted-fix-with-learning for "memory leak": 85% success
// 4. Update activity template or create new specialized template
// 5. Register new template with higher prior (Thompson: alpha=10, beta=2)
// 6. System naturally explores new template via Thompson Sampling

// Example: Create specialized "fix-memory-leak-complete" activity
await activity({
  templateId: "create-activity-template",
  variables: {
    name: "Fix Memory Leak Complete",
    description: "Specialized template for memory leak fixes with validation",
    category: "bugfix",
    tasks: [
      // ... specialized tasks for memory leak fixes
    ]
  },
  reason: "Create specialized template based on learning data showing memory leaks need different approach"
})

// Register with learning system (via RPC admin endpoint)
await fetch('http://api-server:8080/api/v1/admin/variants/register', {
  method: 'POST',
  body: JSON.stringify({
    activity_id: "fix-memory-leak-complete",
    initial_alpha: 10,  // Prior belief: optimistic about success
    initial_beta: 2     // Low failure expectation
  })
})
```

**Benefits**:
- ✅ Activity system self-improves
- ✅ Specialization based on data
- ✅ Thompson Sampling explores new templates safely
- ✅ Continuous evolution

---

## Current State Analysis

### ✅ **READY TO USE NOW** (No RPC backend needed)

**Direct Activity Usage**:
```typescript
// This works TODAY with existing infrastructure
await activity({
  templateId: "fix-bug-complete",
  variables: { bugDescription: "...", files: ["..."] },
  reason: "Fix bug reported by user"
})

// Activities use metabob MCP tools (cpg-inference) for analysis
// No learning system integration yet, but full functionality
```

**Metabob CPG Integration**:
```typescript
// This works TODAY via MCP
await metabob_search_codebase_issues({ query: "memory leak" })
await metabob_analyze_change_impact({ file, component })
await metabob_suggest_related_changes({ changed_files })

// Pure CPG analysis, <10ms latency, no learning data
```

### ⚠️  **NEEDS IMPLEMENTATION** (6-week build)

**Learning System Backend** (metabob-rpc-api):
- ❌ Thompson Sampling service
- ❌ Association graph storage
- ❌ Recommendation endpoint
- ❌ Feedback endpoint
- ❌ Celery Beat tasks
- ❌ SurrealDB schema
- ❌ Vector embeddings service

**Component-Targeted Learning Activity**:
- ✅ Template exists (component-targeted-fix-with-learning.json)
- ❌ RPC backend not operational (tasks will fail when calling RPC endpoints)
- ❌ Association graph not persisted
- ❌ Annotation budgets not enforced

**See**: FINAL_ARCHITECTURE_SUMMARY.md (Week 1-6 implementation checklist)

---

## Validation Gates (CRITICAL)

The learning system MUST validate fixes before allowing commits to prevent disasters like the "17,789 lines of useless code" memory leak attempt.

### Validation Flow

**Pre-Commit Gates** (from ANNOTATION_LEARNING_SYSTEM_SUMMARY.md):

```typescript
// 1. IMPACT CHECK: Does change affect problem area?
const impact = await metabob_analyze_change_impact({
  file_path: "src/session/index.ts",
  component_name: "messages",
  max_depth: 3
})

if (!impact.affects_issue_area) {
  throw new ValidationError("Change does not affect problem area (no execution path)")
}

// 2. INTEGRATION CHECK: Is new code actually called?
const safety = await metabob_assess_deletion_safety({
  file_path: "src/session-memory-manager.ts",
  component_name: "SessionMemoryManager"
})

if (safety.safe_to_delete) {
  throw new ValidationError("New code has no callers (orphaned code)")
}

// 3. COMPLETENESS CHECK: All integration points updated?
const related = await metabob_suggest_related_changes({
  changed_files: ["src/session/index.ts"]
})

if (related.length > 0) {
  log.warn("Related files not updated", { related })
  // Optionally block or warn
}

// 4. EFFECTIVENESS CHECK: Does metric actually improve?
const metricBefore = await measureMemoryUsage()
// ... apply fix ...
const metricAfter = await measureMemoryUsage()

if (metricAfter >= metricBefore) {
  throw new ValidationError(`Metric did not improve: ${metricBefore} → ${metricAfter}`)
}

// All gates passed → allow commit
```

**Integration with Activities**:
```json
{
  "integration": {
    "preChecks": [
      "Repository exists and is git repo",
      "Metabob MCP is available",
      "Validation command is valid"
    ],
    "qualityGates": [
      {
        "name": "validation_success",
        "command": "{{validationCommand}}",
        "requiredExitCode": 0
      },
      {
        "name": "impact_check",
        "metabob_tool": "metabob_analyze_change_impact",
        "required_condition": "affects_issue_area == true"
      },
      {
        "name": "integration_check",
        "metabob_tool": "metabob_assess_deletion_safety",
        "required_condition": "safe_to_delete == false"
      }
    ]
  }
}
```

---

## Usage Examples

### Example 1: Fix Bug with Learning (Simple)

```bash
# Agent receives task
User: "Fix the memory leak in session messages"

# Agent workflow (with learning system)
1. search_activities({ category: "bugfix" })
   → Found: fix-bug-complete

2. Query RPC: POST /recommendations/get
   {
     task: "Fix memory leak in session messages",
     component_ids: ["src/session/index.ts::messages"]
   }
   → Response: {
       recommended_activity: "fix-bug-complete",
       context_impulses: [{id: "imp_xyz", content: "Add default limit to prevent unbounded growth"}],
       impression_id: "imp_abc123"
     }

3. Execute activity:
   activity({
     templateId: "fix-bug-complete",
     variables: { bugDescription: "Memory leak in session messages" }
   })
   
   Activity uses recommended context impulses in prompt generation

4. Post feedback:
   POST /feedback/record
   {
     impression_id: "imp_abc123",
     outcome: "success",
     metrics: {cost: 0.12, duration: 45s}
   }

5. Server learns (background):
   - Thompson: fix-bug-complete alpha++ (success)
   - Association: impulse_xyz weight++ for session::messages component
   - Next time: Higher probability of same recommendation
```

### Example 2: Complex Fix with CPG Decomposition

```bash
# Use advanced learning-enabled activity
activity({
  templateId: "component-targeted-fix-with-learning",
  variables: {
    issueDescription: "Memory leak in session messages",
    repository: "/workspace",
    validationCommand: "npm test"
  }
})

# Activity workflow:
# Task 1: Metabob CPG decomposition
#   → metabob_search_codebase_issues("memory leak")
#   → metabob_analyze_change_impact(each component)
#   → Creates component sequence: [session::messages, session::add, ...]

# Task 2: Load learned annotations
#   → Query RPC: GET /components/annotations?ids=session::messages
#   → Returns: Past successful fixes, known pitfalls, relevance scores

# Task 3: Load association graph
#   → Query RPC: GET /associations?component=session::messages&task=fix_bug
#   → Returns: Optimal impulses (highest weight, within budget)

# Task 4: Generate optimized prompts
#   → Combines: CPG analysis + learned annotations + optimal impulses
#   → Creates component-specific prompts with success patterns

# Task 5: Execute fixes with optimized prompts
#   → Applies fixes to each component
#   → Uses learned knowledge about what works

# Task 6: Validate
#   → Runs validation command
#   → Checks impact with metabob_analyze_change_impact
#   → Measures metric improvement

# Task 7: Refine annotations
#   → Posts new annotations: POST /annotations/create
#   → Updates relevance scores based on success/failure

# Task 8: Update associations
#   → Posts feedback: POST /feedback/record
#   → Updates component-impulse-activity associations

# Task 9: Commit with learning metadata
```

### Example 3: Debug Failed Activity with Learning Data

```bash
# Activity fails repeatedly
activity_error_inspector({ activityId: "act_failed_123" })

# Inspect learning data (admin endpoint, not exposed to agents)
curl http://api-server:8080/api/v1/admin/analytics/activity/fix-bug-complete

# Response (internal analytics):
{
  "activity_id": "fix-bug-complete",
  "overall_success_rate": 0.72,
  "breakdowns": [
    {
      "task_type": "fix_bug",
      "component_pattern": "**/session/**",
      "success_rate": 0.45,  # LOW for session-related bugs
      "attempts": 20
    },
    {
      "task_type": "fix_bug",
      "component_pattern": "**/api/**",
      "success_rate": 0.89,  # HIGH for API-related bugs
      "attempts": 35
    }
  ]
}

# Insight: fix-bug-complete underperforms for session-related bugs
# Action: Create specialized template or improve prompts for session fixes

# Create specialized activity
activity({
  templateId: "create-activity-template",
  variables: {
    name: "Fix Session Bug Complete",
    specialization: "session-related bugs",
    based_on: "fix-bug-complete",
    improvements: [
      "Add session-specific validation",
      "Include memory usage checks",
      "Enforce message limit validation"
    ]
  }
})

# Register with optimistic prior (Thompson Sampling will explore)
# System learns if specialized template performs better
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Implement metabob-rpc-api recommendation endpoint
- [ ] Set up SurrealDB with schema
- [ ] Implement text embeddings (sentence-transformers)
- [ ] Thompson Sampling service
- [ ] Basic impression tracking

### Phase 2: Feedback Loop (Week 3)
- [ ] Implement feedback endpoint
- [ ] Parameter update logic (Thompson alpha/beta)
- [ ] Association graph storage
- [ ] Celery task integration

### Phase 3: Learning Features (Week 4)
- [ ] Component-impulse associations
- [ ] Context selection algorithm
- [ ] Annotation budget enforcement
- [ ] Prompt optimization

### Phase 4: Validation (Week 5)
- [ ] Quality gates in activity system
- [ ] Impact/integration/effectiveness checks
- [ ] Pre-commit hooks
- [ ] Validation reporting

### Phase 5: Integration Testing (Week 6)
- [ ] End-to-end activity + learning flow
- [ ] Verify double-blind (no leakage)
- [ ] Load testing
- [ ] Analytics dashboard (humans only)

### Phase 6: Production (Week 7+)
- [ ] Deploy to devbob containers
- [ ] Monitor learning convergence
- [ ] Validate Thompson Sampling behavior
- [ ] Iterate on templates based on learning data

---

## Success Metrics

### Agent Behavior (Double-Blind Verification)
- ✅ Agents cannot see scores, weights, or probabilities
- ✅ Recommendations include only: activity ID, context, impression ID
- ✅ Feedback responses are simple acks (no details)
- ✅ Agents make task-based decisions (no gaming)

### Learning Effectiveness
- 🎯 First-attempt success rate: 85%+ (vs. current ~20%)
- 🎯 Lines of code per fix: <100 (vs. current 17,000+)
- 🎯 No orphaned code commits (current: 100% of failed attempts)
- 🎯 Thompson Sampling converges to optimal templates
- 🎯 Association weights stabilize (learning converging)

### Activity Quality
- 🎯 Validation gates reject bad fixes: 100%
- 🎯 Impact check prevents non-affecting changes
- 🎯 Integration check prevents orphaned code
- 🎯 Metric improvement required before commit

### System Evolution
- 🎯 Activity templates improve over time (specialization)
- 🎯 Context selection optimizes (higher relevance)
- 🎯 Cost per fix decreases (efficiency)
- 🎯 Manual intervention decreases (automation)

---

## Related Documents

1. **SEPARATION_OF_CONCERNS.md** - **PRIMARY**: Component boundaries and responsibilities (START HERE)
2. **FINAL_ARCHITECTURE_SUMMARY.md** - Double-blind learning architecture (complete)
3. **LEARNING_SYSTEM_INTEGRATION_STATUS.md** - Current state and what works today
4. **LEARNING_SYSTEM_INTEGRATION_SUMMARY.md** - Session summary with key insights
5. **ANNOTATION_LEARNING_SYSTEM_SUMMARY.md** - Original annotation-driven design (superseded but validates concepts)
6. **component-targeted-fix-with-learning.json** - Activity template with full learning integration
7. **docs/DOUBLE_BLIND_LEARNING_ARCHITECTURE.md** - Technical specification (v3.0.0)
8. **docs/architecture/LEARNING_SYSTEM_FLOW.md** - Detailed workflow diagrams
9. **docs/RPC_API_IMPLEMENTATION_GUIDE.md** - Backend implementation guide

---

## Quick Start (When RPC Backend Ready)

### For Activity Mode Agents

```typescript
// 1. Enable learning system in opencode.json
{
  "metabob": {
    "rpc_api_url": "http://api-server:8080",
    "learning_enabled": true
  }
}

// 2. Use activities as normal (learning happens automatically)
await activity({
  templateId: "fix-bug-complete",
  variables: { bugDescription: "..." },
  reason: "Fix reported bug"
})

// Activity system automatically:
// - Queries RPC for recommendations
// - Includes optimal context
// - Posts feedback after execution
// - Learning happens in background
```

### For Template Authors

```json
{
  "name": "My Activity Template",
  "metabob": {
    "enabled": true,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "component-specific",
    "requiredTools": [
      "metabob_search_codebase_issues",
      "metabob_analyze_change_impact"
    ]
  },
  "integration": {
    "qualityGates": [
      {
        "name": "impact_check",
        "metabob_tool": "metabob_analyze_change_impact",
        "required_condition": "affects_issue_area == true"
      }
    ]
  }
}
```

---

## Conclusion

The learning system + activity integration creates a **self-improving development system** where:

1. **Agents focus on tasks** (no bias from scores)
2. **Server learns from outcomes** (Thompson Sampling + associations)
3. **Activities provide structure** (templates with validation)
4. **Metabob provides analysis** (CPG decomposition)
5. **Validation prevents disasters** (quality gates)
6. **System evolves continuously** (template specialization)

**Current State**: Architecture complete, activities operational, **RPC backend needs 6-week build**.

**Next Step**: Implement Week 1 of FINAL_ARCHITECTURE_SUMMARY.md (RPC API foundation).

---

**Questions? See**:
- **Architecture Boundaries**: SEPARATION_OF_CONCERNS.md (START HERE)
- Implementation: FINAL_ARCHITECTURE_SUMMARY.md
- Current State: LEARNING_SYSTEM_INTEGRATION_STATUS.md
- Usage: This document
- Technical Details: docs/DOUBLE_BLIND_LEARNING_ARCHITECTURE.md
