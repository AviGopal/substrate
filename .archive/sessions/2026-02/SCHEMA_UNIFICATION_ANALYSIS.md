# Schema Unification Analysis: Proto vs OpenCode

**Date**: 2026-02-16  
**Purpose**: Complete field-by-field analysis for schema unification  
**Goal**: Single source of truth in metabob-proto shared across all repositories

---

## Executive Summary

We have **two parallel template schemas** causing real problems:
1. **Proto Schema** (`metabob-rpc-api/server/models/proto_template.py`) - Backend
2. **OpenCode Schema** (`metabob-opencode/packages/opencode/src/session/activity-template.ts`) - CLI

**Current Issues**:
- Field name inconsistencies (`tasks` vs `task_steps`)
- Schema drift (features added to one but not the other)
- Conversion bugs (backward compatibility layer fails before validation)
- Manual synchronization burden

**Recommendation**: **Unify on proto schema** as single source of truth.

---

## Field-by-Field Comparison

### Core Identity Fields

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `id` | ✅ `str` | ✅ `string` | Same purpose | ✅ Keep |
| `version` | ✅ `Version` (proto msg) | ✅ `Version` (TS type) | Genealogy tracking | ✅ Keep both (convert) |
| `name` | ✅ `str` | ✅ `string` | Template display name | ✅ Keep |
| `description` | ✅ `str` | ✅ `string` | Template description | ✅ Keep |

**Analysis**: Identity fields are well-aligned. Both have version genealogy tracking.

---

### Category and Scope

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `category` | ✅ `ActivityCategory` enum | ✅ `enum` (lowercase) | FEATURE vs "feature" | ⚠️ Align case |
| `scope` | ✅ `Scope` (org/project/user/codebase) | ❌ Missing | Multi-tenancy support | ➕ Add to OpenCode |

**Analysis**:
- **Category case mismatch**: Proto uses `FEATURE`, OpenCode uses `"feature"`. Need consistent enum values.
- **Scope missing in OpenCode**: Proto has full multi-tenancy support (org_id, project_id, user_id, codebase_id). OpenCode lacks this.

**Recommendation**: Add `scope` to OpenCode schema, align category enum values.

---

### Evolution and Genealogy

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `genealogy` | ✅ `TemplateGenealogy` | ✅ `TemplateGenealogy` | Evolution tracking | ✅ Keep (convert) |
| - `created_at` | ✅ `datetime` | ✅ `number` (timestamp) | Timestamp formats differ | ⚠️ Standardize |
| - `parent_id` | ✅ `str` | ✅ `string` | Parent template | ✅ Aligned |
| - `variant_hash` | ✅ `str` | ✅ `string` | Uniqueness hash | ✅ Aligned |
| - `generation` | ✅ `int` | ✅ `number` | Generation number | ✅ Aligned |
| - `evolution` | ✅ `TemplateEvolution` | ✅ `TemplateEvolution` | Why/how created | ✅ Keep (convert) |
| - `variant_ids` | ✅ `list[str]` | ❌ Missing in TS | Child variants | ➕ Add to OpenCode |

**Analysis**: Structures are similar but OpenCode is missing `variant_ids` field for tracking children.

---

### Metrics

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `metrics` | ✅ `TemplateMetrics` object | ✅ Flat fields in Schema | **STRUCTURE MISMATCH** | ⚠️ **Critical** |

**Proto `TemplateMetrics`**:
```python
class TemplateMetrics:
    execution_count: int
    success_count: int
    success_rate: float
    avg_duration_ms: float
    avg_cost: float
    avg_tokens: TokenUsage
    last_execution: datetime
    last_success: bool
    by_variant: dict[str, VariantMetrics]  # Per-variant tracking
```

**OpenCode (flat in Schema)**:
```typescript
{
  executions: number
  successRate: number
  avgDuration: number
  avgCost: number
  avgTokens: { input, output, cache }
}
```

**Key Differences**:
1. Proto has **per-variant metrics** (`by_variant`) - OpenCode doesn't
2. Proto tracks **last execution timestamp and outcome** - OpenCode doesn't
3. Proto has `success_count` separate from `success_rate` - OpenCode only has rate
4. Field names differ: `execution_count` vs `executions`, `avg_duration_ms` vs `avgDuration`

**Recommendation**: **Adopt Proto structure** - it's more comprehensive and supports variant tracking.

---

### Tasks / Steps

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `tasks` | ❌ Fallback (not in proto) | ✅ `Task[]` | **THE PROBLEM** | ⚠️ **Critical** |
| `task_steps` | ✅ Proto field | Backend expects this | **THE FIX** | ✅ Use this |

**This is the bug we hit!**

Proto schema comment (line 910-911):
```python
# Note: tasks field requires Task proto model (not yet implemented)
# For now, tasks remain as Dict[str, Any]
```

**Backend behavior**:
- API endpoint expects `task_steps` (proto-aligned)
- Has backward compatibility converter for `tasks` → `task_steps`
- BUT converter runs AFTER validation
- So POST with `tasks` fails validation before conversion runs

**Current State**:
- Backend routes: `task_steps` is the proto field name
- activity-create template: Generates `tasks` (OLD field name)
- Result: Templates can't auto-register

**Recommendation**: **Use `task_steps` everywhere**. Remove `tasks` from all schemas.

---

### Context Requirements (Impulse System)

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `context_requirements` | ✅ `list[ContextRequirement]` | ✅ `ContextRequirement[]` | **Both have it!** | ✅ Keep (convert) |

**OpenCode has rich impulse system** that Proto doesn't fully support yet:

**OpenCode Impulse Types**:
```typescript
type Pointer = 
  | { type: "memo"; content: string }
  | { type: "file"; path: string }
  | { type: "component"; file, name }
  | { type: "commit"; hash }
  | { type: "metabobIssue"; issueId }
  | { type: "metabobAnnotation"; file, component }
  | { type: "activityOutput"; activityId, taskId? }
  | { type: "bashOutput"; command }
  | { type: "templateDefinition"; definition }
  | { type: "activityRecommendation"; context }
  | { type: "custom"; resolver, data }
  | { type: "agentInstructions"; instructions, persona? }
  | { type: "toolConfig"; enabled, disabled?, required? }
  | { type: "agentConstraints"; constraints, permissions? }
  | { type: "acp"; target, sessionId }
  | { type: "hostFile"; path, content }
```

**Proto has basic ContextRequirement** but doesn't have impulse pointer types defined.

**Recommendation**: **Port OpenCode impulse system to proto**. This is a major feature that should be in the shared schema.

---

### Configuration Objects

| Field | Proto | OpenCode | Notes | Action |
|-------|-------|----------|-------|--------|
| `integration` | ✅ `IntegrationConfig` | ✅ `IntegrationSchema` | Pre/post checks | ✅ Keep (convert) |
| `metabob` | ✅ `MetabobConfig` | ✅ `MetabobConfigSchema` | Metabob settings | ✅ Keep (convert) |
| `memory_management` | ✅ `MemoryManagementConfig` | ✅ `MemoryManagementSchema` | Memory optimization | ✅ Keep (convert) |
| `discovery_phase` | ✅ `DiscoveryPhaseConfig` | ✅ `DiscoveryPhaseSchema` | Discovery before exec | ✅ Keep (convert) |
| `trailblazing` | ✅ `TrailblazingConfig` | ✅ `TemplateTrailblazingSchema` | Failure recovery | ✅ Keep (convert) |

All config objects exist in both! Field names differ slightly (snake_case vs camelCase).

---

### OpenCode-Only Fields (Need to Add to Proto)

| Field | OpenCode | Purpose | Add to Proto? |
|-------|----------|---------|---------------|
| `repositories` | ✅ `Record<string, RepositoryMapping>` | Cross-repo task execution | ➕ **Yes** - Important feature |
| `composition` | ✅ `CompositionSchema` | Template composition patterns | ➕ **Yes** - Workflow orchestration |
| `learning` | ✅ `LearningSchema` | Feedback capture for improvement | ➕ **Yes** - Critical for evolution |
| `componentAgents` | ✅ `ComponentAgentSpec[]` | Dynamic agent creation | ➕ **Yes** - Advanced feature |
| `expectedOutcomes` | ✅ `ExpectedOutcomesSchema` | Closed-loop comparison | ➕ **Yes** - Effectiveness tracking |
| `hooks` | ✅ `HooksSchema` | Lifecycle hooks (pre/post activity/task) | ➕ **Yes** - Important integration |

**Analysis**: OpenCode has evolved many features that Proto doesn't have yet. These should be ported to proto for completeness.

---

### Proto-Only Fields (Need to Add to OpenCode)

| Field | Proto | Purpose | Add to OpenCode? |
|-------|-------|---------|------------------|
| `scope` | ✅ `Scope` | Multi-tenancy (org/project/user/codebase) | ➕ **Yes** - Required for backend |
| `by_variant` metrics | ✅ `dict[str, VariantMetrics]` | Per-variant performance tracking | ➕ **Yes** - Important for A/B testing |
| `last_execution`, `last_success` | ✅ `datetime`, `bool` | Recent execution tracking | ➕ **Yes** - Useful metadata |
| `metadata` | ✅ `Metadata` (created_at, updated_at, created_by, updated_by, tags) | Audit trail and tagging | ➕ **Yes** - Best practice |
| `extra` | ✅ `str` (JSON-encoded) | Extension field for custom data | ➕ **Maybe** - Flexible but untyped |

**Analysis**: Proto has better audit/metadata support. OpenCode should adopt these.

---

## Task/Step Schema Comparison

### Proto Task (From comments - not yet implemented)

Proto schema says tasks are `Dict[str, Any]` placeholder (line 820, 910).

The actual task structure is expected to come from `proto/activity/task_pb2` but that's not imported yet.

### OpenCode Task (Fully Implemented)

```typescript
{
  id: string
  subagent: string (deprecated - use agentImpulses)
  description: string
  dependencies: string[]
  guidance: string[]
  expected_actions: string[]
  tools: { required, optional, disabled }
  prompt: {
    template: string
    maxTokens: number
    compressionStrategy: enum
    variables: PromptVariable[]
  }
  validation: {
    preChecks: { requiredFiles, commands }
    postChecks: { requiredFiles, requiredPatterns, forbiddenPatterns, commands }
    // Legacy fields for backward compat
    requiredFiles, requiredPatterns, forbiddenPatterns, commands
  }
  retry: {
    maxAttempts: number
    strategy: enum
    fallbackPrompt?: string
  }
  metrics: {
    successRate, avgTokens, avgDuration, commonFailures
  }
  trailblazing?: { enabled, continuationAttempts }
  impulseAdjustment?: { prompt, beforeExecution }
  impulseReferences?: string[]
  agentImpulses?: string[]
  complexity?: TaskComplexity
  executionTarget?: TaskExecutionTarget
}
```

**Proto needs full Task schema defined!**

---

## Conversion Issues

### Current Backward Compatibility Bug

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
# Validation happens FIRST
validated_data = ActivityVariant.parse_obj(data)  # Expects task_steps!

# Conversion happens AFTER (too late)
if "tasks" in data:
    data["task_steps"] = data.pop("tasks")
```

**Fix**: Move conversion BEFORE validation:

```python
# Convert tasks → task_steps BEFORE validation
if "tasks" in data and "task_steps" not in data:
    data["task_steps"] = data.pop("tasks")

# Now validate with correct field
validated_data = ActivityVariant.parse_obj(data)
```

---

## Unification Plan

### Phase 1: Immediate Fix (This Session)

**Goal**: Fix the immediate bug preventing template registration

1. ✅ **Fix activity-create template** - Generate `task_steps` not `tasks`
2. ✅ **Fix backend conversion** - Move conversion before validation
3. ✅ **Document handlebars limitation** - Templates can't use conditionals

**Scope**: Minimal changes to unblock self-sustaining loop

### Phase 2: Schema Alignment (Next 1-2 weeks)

**Goal**: Align field names and structures without breaking changes

1. **Define complete proto Task schema** in `proto/activity/task.proto`
2. **Add missing fields**:
   - Proto: Add `repositories`, `composition`, `learning`, `hooks` from OpenCode
   - OpenCode: Add `scope`, full `metrics` structure, `metadata` from Proto
3. **Align field names**:
   - Decide: snake_case (proto) vs camelCase (OpenCode)?
   - Generate TypeScript from proto? Or maintain parallel?
4. **Test conversion** bidirectionally

**Scope**: Add fields, don't remove anything yet (backward compatible)

### Phase 3: Proto as Source of Truth (Next 2-4 weeks)

**Goal**: Single schema definition, all repos generate from proto

1. **Generate TypeScript from proto**
   - Use `protoc` with TypeScript plugin
   - Generate `activity-template.ts` from proto definitions
   - Replace hand-written OpenCode schema
2. **Update all codebases**:
   - metabob-rpc-api: Already uses proto
   - metabob-opencode: Use generated TS from proto
   - metabob-cli: Use generated Python from proto
3. **Remove legacy schemas** and conversion logic
4. **Update documentation** to reference proto as source of truth

**Scope**: Breaking changes OK (major version bump)

---

## Recommendation: Unify on Proto

### Why Proto as Source of Truth?

✅ **Language-agnostic**: Generates Python, TypeScript, Go, Rust, etc.  
✅ **Versioning built-in**: Proto3 has clear compatibility rules  
✅ **Backend already uses it**: metabob-rpc-api is proto-aligned  
✅ **Type safety**: Strict typing across all languages  
✅ **Documentation**: Proto files are self-documenting with comments  
✅ **Tooling**: `protoc`, `buf`, gRPC ecosystem  

### Migration Path

1. **Define complete proto schema** (all fields from both sides)
2. **Generate language bindings** for Python, TypeScript, Python
3. **Update OpenCode** to use generated types
4. **Remove hand-written schemas** in OpenCode
5. **Single source of truth**: `proto/activity/template.proto`

---

## Next Steps

### This Session (Immediate)

1. ✅ Fix activity-create: generate `task_steps` not `tasks`
2. ✅ Add template syntax warning: no handlebars conditionals
3. ⚠️ Document backend conversion bug (for future fix)

### Post-Session (Within 1 week)

1. Define complete `Task` proto schema
2. Port OpenCode-only fields to proto
3. Port proto-only fields to OpenCode
4. Create bidirectional conversion tests

### Next Sprint (Within 1 month)

1. Generate TypeScript from proto
2. Replace OpenCode hand-written schema with generated code
3. Update all template-creating code to use proto schema
4. Remove legacy `tasks` field entirely

---

## Files Requiring Changes

### Immediate (This Session)

- [ ] `activity-create-29e9d6c5` template (backend) - Add warning about template syntax
- [ ] `repos/metabob-rpc-api/server/routes/v2_activities.py` - Fix conversion order (post-session)

### Phase 2 (Schema Alignment)

- [ ] `proto/activity/template.proto` - Add missing fields from OpenCode
- [ ] `proto/activity/task.proto` - Define complete Task schema
- [ ] `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts` - Add proto fields
- [ ] `repos/metabob-rpc-api/server/models/proto_template.py` - Add OpenCode fields

### Phase 3 (Proto as Source)

- [ ] All repos: Use generated types from proto
- [ ] Remove hand-written schemas
- [ ] Update documentation

---

## Key Decisions Needed

1. **Field name convention**: snake_case (proto) vs camelCase (TypeScript)?
   - **Recommendation**: Use proto snake_case, convert at boundary
2. **Handlebars support**: Should proto templates support conditionals?
   - **Recommendation**: No - keep templates simple, use variables only
3. **Impulse system**: Port full OpenCode impulse system to proto?
   - **Recommendation**: Yes - it's a major feature
4. **Breaking changes**: OK to break OpenCode schema in major version?
   - **Recommendation**: Yes - do it once, do it right

---

## Summary

**Current State**: Two diverged schemas causing real bugs  
**Root Cause**: No single source of truth, manual synchronization  
**Solution**: Unify on proto as authoritative schema  
**Immediate Fix**: Change `tasks` → `task_steps` in activity-create  
**Long-term Fix**: Generate all language bindings from proto  

**Timeline**:
- **This session**: Fix immediate bug (activity-create template)
- **1 week**: Align schemas bidirectionally
- **1 month**: Proto as single source of truth

This document serves as the blueprint for schema unification across metabob-devbob ecosystem.
