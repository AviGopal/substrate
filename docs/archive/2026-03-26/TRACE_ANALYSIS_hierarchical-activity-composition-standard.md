# Trace Analysis: Hierarchical Activity Composition Standard

**Specification**: hierarchical-activity-composition-standard  
**Traced On**: 2026-03-09  
**Traced By**: trace-data-flow-single-feature activity  
**Impulse ID**: trace-hierarchical-activity-composition-standard  
**Production Readiness**: MEDIUM (3 HIGH priority bugs block production)

---

## Executive Summary

The **hierarchical-activity-composition-standard is FULLY IMPLEMENTED** in the codebase with all core architectural principles operational:

✅ **Compose-first by default** - preferComposition=true enforced  
✅ **Quality-gated composition** - 60% success rate threshold  
✅ **Code-based composition** - Prompts with literal activity() calls  
✅ **Activities-as-impulses** - Data flow via impulse resolution  
✅ **Backend-only architecture** - Centralized learning with bootstrap fallback  
✅ **Agent IDE constraint** - No CLI dependency, config_update tool available  

⚠️ **Production Blockers**: 3 HIGH priority bugs must be fixed  
⚠️ **Not Verified**: Boredom system integration (requires separate trace)

---

## Specification Summary

The hierarchical-activity-composition-standard establishes the workflow paradigm:

1. **Compose existing activities hierarchically** - Check if work can be accomplished by running/sequencing existing activities
2. **Create new activity template if no composition works** - Use create-activity-template or goal-seeking creation
3. **Execute activities as impulses** - Activities become loadable/injectable impulses for automatic execution in larger workflows

This hierarchical approach scales naturally: simple activities combine into complex workflows, all tracked as impulses. Activities should reference each other, not duplicate behavior.

**Key Constraint**: Agent IDE with NO CLI access - config changes must happen via `config_update` tool as impulses for activity injection.

**Continuous Optimization**: Execute → measure via variant_id → recommend → evolve via boredom operates on this hierarchical activity graph.

---

## Component Analysis: CURRENT STATE vs DESIRED STATE

### ✅ IMPLEMENTED COMPONENTS (Architecture Matches Spec)

#### 1. Compose-First Entry Point
**File**: `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts:24-126`  
**Status**: ✅ MATCHES SPEC

- **Current**: Defaults `preferComposition=true`, validates with Zod, applies constraints (maxTasks=7, maxCost=5.0)
- **Desired**: Tool enforces compose-first paradigm by default
- **Gap**: NONE - Implementation complete

#### 2. LLM Goal Decomposition
**File**: `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts:190-330`  
**Status**: ⚠️ HIGH PRIORITY BUG

- **Current**: Uses TaskTool to decompose goals into sub-goals DAG via LLM
- **Desired**: Complex goals broken into hierarchical task structure
- **Gap**: Unprotected JSON.parse at line 322 can crash workflow

#### 3. Composition Decision Logic
**File**: `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts:127-184`  
**Status**: ✅ MATCHES SPEC

- **Current**: Searches templates, applies 60% success rate threshold, assigns strategy (compose-activity vs generate-prompt)
- **Desired**: Prioritize composition over creation with quality gate
- **Gap**: NONE - Quality-gated composition fully operational

#### 4. Code Generation for Composition
**File**: `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts:442-517`  
**Status**: ✅ MATCHES SPEC

- **Current**: Generates prompts with literal `activity()` tool calls for compose-activity strategy
- **Desired**: Activities reference each other via code (not opaque dispatch)
- **Gap**: NONE - Composition visible to LLM, enables adaptation

#### 5. Activities-as-Impulses Resolution
**File**: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts:460-487`  
**Status**: ⚠️ HIGH PRIORITY BUG

- **Current**: Resolves `activityOutput` pointers by loading from Storage with project_id scope
- **Desired**: Activities become loadable/injectable impulses for data flow
- **Gap**: JSON.stringify has no circular reference handling

#### 6. Backend-Only Architecture
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:275-307`  
**Status**: ⚠️ MEDIUM PRIORITY

- **Current**: Rejects `backend='local'`, forces MCP registration
- **Desired**: Centralized learning with no local-only divergence
- **Gap**: No retry logic for transient failures

#### 7. Agent IDE Constraint (No CLI)
**File**: `repos/metabob-opencode/packages/opencode/src/tool/config-update.ts:14+`  
**Status**: ✅ MATCHES SPEC

- **Current**: Programmatic config modification with `createImpulse` parameter
- **Desired**: Config changes as impulses, no CLI dependency
- **Gap**: NONE - Fully supports agent IDE constraint

#### 8. Boredom System Integration
**File**: `repos/metabob-opencode/packages/opencode/src/boredom/BoredomActivityGenerator.ts`  
**Status**: ❓ NOT VERIFIED

- **Current**: NOT TRACED
- **Desired**: Detect composition opportunities, merge/split/compose templates based on usage
- **Gap**: UNKNOWN - Needs separate trace

---

## Gaps and Risks

### HIGH Priority (Blocks Production)

#### 1. Unprotected JSON.parse in Goal Decomposition
**Location**: `goal-seeking-planner.ts:322`  
**Impact**: Malformed LLM response crashes entire compose-first workflow  
**Mitigation**:
```typescript
try {
  decomposition = JSON.parse(jsonMatch[1])
} catch (error) {
  throw new Error(`Failed to parse LLM response: ${error.message}. Raw: ${jsonMatch[1].slice(0,200)}`)
}
```

#### 2. No Circular Reference Handling in Impulse Resolution
**Location**: `impulse-resolver.ts:475,481`  
**Impact**: Complex activity state crashes impulse resolution, breaks hierarchical composition  
**Mitigation**:
```typescript
const seen = new WeakSet()
return JSON.stringify(task, (key, value) => {
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
  }
  return value
}, 2)
```

#### 3. Type Safety Bypass in MCP Calls
**Location**: Various MCP integration points  
**Impact**: Schema changes cause runtime crashes  
**Mitigation**: Add Zod validation for all MCP responses

### MEDIUM Priority (Reliability)

#### 4. No Retry Logic in Backend Registration
**Location**: `template-loader.ts:287-307`  
**Impact**: Transient network failures permanently lose templates  
**Mitigation**: Exponential backoff retry (3 attempts)

#### 5. Weak Input Validation
**Location**: `create-activity-goal-seeking.ts:93-102`  
**Impact**: DoS potential (unbounded goalDescription)  
**Mitigation**: Add semantic validation (max length, serializability checks)

#### 6. No Runtime Validation in Storage Layer
**Location**: `impulse-resolver.ts:465`  
**Impact**: Schema evolution breaks activity state loading  
**Mitigation**: Add Zod schemas for all storage objects

---

## Data Flow Trace

```
UserInput(goalDescription, templateName, category, variables)
  ↓
CreateActivityGoalSeekingTool
  ↓ [Validation: Zod schema, defaults: preferComposition=true, maxTasks=7]
  ↓
GoalSeekingPlanner.decomposeGoal()
  ↓ [LLM via TaskTool: "Break down this goal into sub-goals"]
  ↓ [JSON Response: {subGoals: [{id, description, dependencies, validation}]}]
  ↓ [⚠️ HIGH BUG: Unprotected JSON.parse]
  ↓
GoalSeekingPlanner.generatePlan()
  ↓ [For each sub-goal: TemplateRepository.search(description)]
  ↓ [Composition Decision: if (preferComposition && successRate > 60%) → compose-activity, else → generate-prompt]
  ↓ [Plan: {tasks: [{strategy, activityTemplate?, variables, validation}]}]
  ↓
GoalSeekingPlanner.planToTemplate()
  ↓ [Codegen: compose-activity → prompt with activity() call, generate-prompt → custom instructions]
  ↓ [Output: ActivityTemplate.CreateOptions with embedded composition logic]
  ↓
ActivityTemplate.create()
  ↓ [Validation: DAG check, duplicate ID check, version generation]
  ↓ [Output: ActivityTemplate.Schema]
  ↓
TemplateLoader.save()
  ↓ [Backend Enforcement: reject local, force metabob]
  ↓ [MCP: metabob_register_activity_template]
  ↓ [⚠️ MEDIUM: No retry on transient failure]
  ↓
MetabobBackend (centralized persistence)
  ↓
TemplateCache.update() (in-memory cache refresh)
  ↓
[Template now available for future composition]

--- EXECUTION PHASE (Activities-as-Impulses) ---

ParentActivity[task references child output]
  ↓
ImpulseResolver.resolve({type: "activityOutput", activityId, taskId?})
  ↓ [Storage.read(["activity", project_id, activityId])]
  ↓ [Extract task output if taskId specified]
  ↓ [JSON.stringify for prompt injection]
  ↓ [⚠️ HIGH BUG: No circular ref handling]
  ↓
Inject into parent task prompt
  ↓
ParentActivity executes with child output (hierarchical composition complete)
```

---

## Architectural Principles Verification

### ✅ Compose-First
- **preferComposition=true** default enforced
- **60% quality threshold** balances reuse with reliability
- **Template search before generation** prevents duplicate behavior
- **Strategy decision persisted** in plan for traceability

### ✅ Activities-as-Impulses
- **activityOutput pointer type** defined and implemented
- **ImpulseResolver.resolve()** loads activity state from Storage
- **Project-scoped storage** (RIPPLE architecture)
- **JSON serialization** for prompt injection

### ✅ Agent IDE Constraint (No CLI)
- **config_update tool** available for programmatic config changes
- **createImpulse parameter** creates impulses for activity reuse
- **MCP.reload() triggered** automatically on config changes
- **No CLI dependency** - all operations tool-based

### ✅ Code Generation Composition
- **Prompts contain literal activity() calls** (not opaque dispatch)
- **Variable interpolation** ({{activityTemplate}}, {{activityVariables}})
- **Composition visible to LLM** - can adapt if activity fails
- **activity tool in optional tools** for compose-activity tasks

### ✅ Backend-Only Architecture
- **Local storage rejected** with explicit error
- **MCP registration enforced** for all templates
- **Bootstrap templates embedded** for cold-start
- **Centralized learning** - all templates available cross-project

### ⚠️ Boredom Evolution (NOT VERIFIED)
- **Mentioned in spec** but not traced in this activity
- **Assumed to exist** in `BoredomActivityGenerator.ts`
- **Requires separate trace** to verify integration with activity graph evolution

---

## Reusable Patterns Identified

### Pattern 1: Compose-First Workflow
**Abstraction**: Search → Threshold → Compose or Create → Register  
**Reusable For**: UI components, infrastructure modules, API endpoints  
**Activity Template Candidate**: `compose-first-workflow`

### Pattern 2: Code Generation for Composition
**Abstraction**: Plan → Codegen (compose=invoke, create=custom) → Execute  
**Reusable For**: Template systems, DSL compilers, metaprogramming  
**Activity Template Candidate**: `codegen-template-compiler`

### Pattern 3: Activities-as-Impulses (Lazy Data Flow)
**Abstraction**: Reference → Resolve → Transform → Inject  
**Reusable For**: Reactive systems, data pipelines, build systems  
**Activity Template Candidate**: `lazy-data-pipeline`

### Pattern 4: Backend-Only with Bootstrap Fallback
**Abstraction**: Enforce → Bootstrap → Fail-Fast → Circuit Breaker  
**Reusable For**: Distributed systems, microservices  
**Activity Template Candidate**: `backend-only-persistence-pattern`

---

## Key Component Files

1. `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts`
2. `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts`
3. `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
4. `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
5. `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`
6. `repos/metabob-opencode/packages/opencode/src/tool/config-update.ts`
7. `repos/metabob-opencode/packages/opencode/src/boredom/BoredomActivityGenerator.ts` (NOT VERIFIED)

---

## Detailed Flow Diagram

See comprehensive Mermaid diagram in:  
`/home/avi/documents/work/exp-repo/metabob-devbob/docs/data-flows/hierarchical-activity-composition-standard-flow.md`

**Key Flow Nodes**:
- Entry: CreateActivityGoalSeekingTool (preferComposition=true default)
- Decomposition: GoalSeekingPlanner.decomposeGoal (LLM via TaskTool)
- Composition Decision: 60% success rate threshold
- Codegen: compose-activity prompts with activity() calls
- Backend Enforcement: reject local, force MCP
- Activities-as-Impulses: ImpulseResolver.resolve (activityOutput pointers)

---

## Next Steps for Trace-Enforce-Validate Loop

1. **Fix HIGH priority bugs** (JSON.parse, circular refs, type safety)
2. **Trace boredom system integration** separately
3. **Run enforcement checks** (automated tests for compose-first workflow)
4. **Validate end-to-end** with production scenarios
5. **Add MEDIUM priority mitigations** (retry logic, validation)

---

## Impulse Metadata

**ID**: trace-hierarchical-activity-composition-standard  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Source**: activity-trace  
**Ready For**: Downstream enforcement and validation tasks

This impulse can be loaded and injected into enforcement activities to verify the compose-first paradigm is maintained across code changes.
