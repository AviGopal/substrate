# Trace Complete: Dynamic Activity Creation with Trailblazing

## Summary

Successfully traced the implementation of **dynamic-activity-creation-with-trailblazing** specification across 10 components in the metabob-devbob codebase.

**Status**: ✅ Trace Complete  
**Impulse Created**: `trace-dynamic-activity-creation-with-trailblazing`  
**Impulse Location**: `impulses/trace-dynamic-activity-creation-with-trailblazing.md`  
**Components Analyzed**: 10  
**Implementation Phases**: 5  

---

## Specification Summary

**Goal**: Enable create-activity, evolve-activity, and debug-activity templates to:
1. Build tasks dynamically turn-by-turn using trailblazing
2. Leverage lifecycle hooks to inject similar activities as impulses
3. Use memory hooks to predict needed context
4. Always invoke LLM during execution for dynamic decisions

---

## Key Findings

### Current State

| Component | Status | Gap |
|-----------|--------|-----|
| Activity Tool Executor | ⚠️ Partial | No meta-template detection, trailblazing OFF by default |
| Trailblazing Executor | ⚠️ Partial | Only failure recovery, no proactive task generation |
| Lifecycle Hooks | ❌ Missing | No activity-specific context injection |
| Memory Agent | ❌ Missing | No activityExecution impulse type |
| Template Service | ❌ Missing | No similar activity search API |
| Impulse Resolver | ❌ Missing | No activityExecution pointer resolution |
| Create Activity Template | ❌ Missing | No trailblazing config, no impulse refs |
| Evolve Activity Template | ❌ Missing | No trailblazing config, no parent context |
| Debug Activity Template | ❌ Missing | No trailblazing config, no error patterns |

### Desired State

All three meta-templates (create/evolve/debug-activity) will:
- ✅ Auto-enable trailblazing by default
- ✅ Inject similar activity executions as impulses
- ✅ Allow dynamic task creation turn-by-turn
- ✅ Learn from historical patterns and outcomes
- ✅ Store execution data for future similarity search

---

## Data Flow

```
User Request
    ↓
Activity Tool (detects meta-template)
    ↓
Lifecycle Hook 'activity-context-injection' (priority 5)
    ↓
Backend API: searchSimilarActivities(templateId, variables)
    ↓
Create Impulses: similar-executions, successful-patterns, common-pitfalls
    ↓
Memory Agent (priority 10) predicts context
    ↓
Auto-enable Trailblazing for meta-templates
    ↓
Inject impulses into task prompts
    ↓
LLM executes with historical context
    ↓
LLM can propose new tasks dynamically
    ↓
Store execution for future learning
```

---

## Implementation Plan

### Phase 1: Infrastructure (Foundation)
**Owner**: metabob-opencode

1. ✅ Add `activityExecution` impulse type to `memory-agent.ts`
2. ✅ Add `activityExecution` pointer resolution to `impulse-resolver.ts`
3. ✅ Add `searchSimilarActivities()` to `template-service-client.ts`
4. ✅ Add `isMetaTemplate()` utility to `activity-template.ts`

**Estimated Effort**: 4-6 hours  
**Dependencies**: None  

### Phase 2: Lifecycle Hooks
**Owner**: metabob-opencode

1. ✅ Register `activity-context-injection` hook (priority 5)
2. ✅ Query `searchSimilarActivities` when meta-template detected
3. ✅ Create impulses for similar executions
4. ✅ Inject impulses into activity context

**Estimated Effort**: 3-4 hours  
**Dependencies**: Phase 1  

### Phase 3: Trailblazing
**Owner**: metabob-opencode

1. ✅ Add auto-enable logic for meta-templates in `activity.ts`
2. ✅ Update `trailblazing-executor.ts` for task continuation
3. ✅ Allow LLM to propose new tasks via continuation prompts
4. ✅ Store task proposals in execution log

**Estimated Effort**: 6-8 hours  
**Dependencies**: Phase 1, Phase 2  

### Phase 4: Templates
**Owner**: metabob-cli

1. ✅ Update `create-activity-self-contained.json`
2. ✅ Update `evolve-activity-self-contained.json`
3. ✅ Update `debug-activity-self-contained.json`
4. ✅ Test each template with trailblazing

**Estimated Effort**: 2-3 hours  
**Dependencies**: Phase 3  

### Phase 5: Backend API
**Owner**: metabob-rpc-api

1. ✅ Implement `POST /v2/activities/search-similar` endpoint
2. ✅ Add similarity scoring (template + variables + outcomes)
3. ✅ Return execution history with patterns
4. ✅ Store outcomes for learning loop

**Estimated Effort**: 8-10 hours  
**Dependencies**: Phase 1  

---

## Expected Behavior

### Create Activity
1. ✅ Trailblazing auto-enabled
2. ✅ Similar create-activity executions loaded as impulses
3. ✅ LLM sees successful patterns and common pitfalls
4. ✅ Can add tasks dynamically if design needs more steps
5. ✅ Execution stored for future similarity search

### Evolve Activity
1. ✅ Trailblazing auto-enabled
2. ✅ Parent activity execution history loaded
3. ✅ Similar evolution patterns loaded as impulses
4. ✅ LLM sees what improvements worked before
5. ✅ Can add validation tasks if needed
6. ✅ Learns from past evolution outcomes

### Debug Activity
1. ✅ Trailblazing auto-enabled
2. ✅ Similar error patterns loaded as impulses
3. ✅ Successful fix patterns loaded
4. ✅ LLM can add diagnostic tasks dynamically
5. ✅ Learns from successful debugging workflows

---

## Architectural Compliance

### metabob-opencode (Execution Engine)
**Boundaries Enforced**: ✅

- Owns: execution, lifecycle hooks, impulse resolution
- Does NOT touch: template storage, backend APIs

### metabob-cli (Template Storage)
**Boundaries Enforced**: ✅

- Owns: template storage, registration, search
- Does NOT touch: execution logic, lifecycle hooks

### metabob-rpc-api (Backend Services)
**Boundaries Enforced**: ✅

- Owns: similar activity search, history storage, pattern extraction
- Does NOT touch: execution logic, template definitions

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Impulse token budget increase | Medium | Limit to top 3 most relevant executions |
| Trailblazing cost increase | Medium | Conservative limits: $1/task, $5 total |
| Dynamic task infinite loops | High | Hard cap at 10 tasks per activity |
| Slow similar activity search | Low | Index executions by template + variables |

---

## Validation Criteria

### Success Indicators

- [ ] create-activity executes with trailblazing enabled by default
- [ ] Similar create-activity executions appear in impulses section
- [ ] LLM can propose new tasks mid-execution
- [ ] Activity execution history is queryable via searchSimilarActivities
- [ ] Memory agent predicts needed context for meta-templates
- [ ] Lifecycle hook 'activity-context-injection' fires before task execution

### Test Scenarios

1. **Test 1**: Execute create-activity → verify trailblazing auto-enabled
2. **Test 2**: Execute evolve-activity → verify parent activity loaded
3. **Test 3**: Execute debug-activity → verify error patterns loaded
4. **Test 4**: Trigger task continuation → verify new task proposed
5. **Test 5**: Query searchSimilarActivities → verify results returned

---

## Next Steps

1. **Enforcement Phase**: Implement Phase 1 infrastructure
2. **Validation Phase**: Create test harnesses for each component
3. **Conflict Detection**: Identify architectural conflicts
4. **Ripple Analysis**: Trace downstream impacts
5. **Commit**: Functional state transition

**Recommended Activity**: `trace-enforce-validate-loop`

```typescript
activity({
  templateId: "trace-enforce-validate-loop",
  variables: {
    specificationName: "dynamic-activity-creation-with-trailblazing",
    traceImpulseId: "trace-dynamic-activity-creation-with-trailblazing"
  },
  reason: "Implement dynamic activity creation infrastructure with trailblazing"
})
```

---

## Impulse Details

**ID**: `trace-dynamic-activity-creation-with-trailblazing`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Priority**: high  
**Location**: `impulses/trace-dynamic-activity-creation-with-trailblazing.md`  

**Content Includes**:
- Current state analysis (10 components)
- Desired state specifications
- Data flow diagram (12 steps)
- Implementation plan (5 phases)
- Expected behavior per template
- Architectural separation enforcement
- Risks and mitigations
- Validation criteria

---

## Component Reference

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Activity Tool Executor | `activity.ts` | 1129-1135 | Needs modification |
| Trailblazing Executor | `trailblazing-executor.ts` | 58-361 | Needs enhancement |
| Lifecycle Hooks | `turn-lifecycle-hooks.ts` | 20-531 | Needs new hook |
| Turn Lifecycle System | `turn-lifecycle.ts` | - | Needs activity hooks |
| Session Memory Agent | `memory-agent.ts` | 1-100 | Needs impulse type |
| Template Service Client | `template-service-client.ts` | - | Needs search function |
| Impulse Resolver | `impulse-resolver.ts` | - | Needs pointer type |
| Create Activity Template | `create-activity-self-contained.json` | - | Needs config |
| Evolve Activity Template | `evolve-activity-self-contained.json` | - | Needs config |
| Debug Activity Template | `debug-activity-self-contained.json` | - | Needs config |

---

## Trace Metadata

```json
{
  "specificationName": "dynamic-activity-creation-with-trailblazing",
  "traceDate": "2026-03-03",
  "traceStatus": "complete",
  "componentsIdentified": 10,
  "phasesPlanned": 5,
  "architecturalCompliance": "enforced",
  "impulseCreated": true,
  "impulseId": "trace-dynamic-activity-creation-with-trailblazing",
  "impulseBudget": 5000,
  "nextActivity": "trace-enforce-validate-loop",
  "estimatedEffort": "25-35 hours",
  "criticalPath": [
    "Phase 1 Infrastructure",
    "Phase 2 Lifecycle Hooks",
    "Phase 3 Trailblazing",
    "Phase 4 Templates"
  ]
}
```

---

**Trace Complete** ✅  
**Ready for Enforcement Phase** ✅
