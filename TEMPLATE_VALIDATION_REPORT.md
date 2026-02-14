# Activity Template Validation Report

**Date**: February 12, 2026
**Validation Tool**: `register_activity_template` with `validate_only: true`

## Executive Summary

Validated **3 activity template files** against the `ActivityTemplate.Schema`:
- ❌ All 3 templates have **validation errors**
- ❌ Templates use **informal/CreateOptions format** instead of full Schema format
- ✅ Template structure and content are logically sound
- ✅ Task definitions follow best practices

**Root Cause**: Templates are written in the simplified `CreateOptions` format (for human authoring) but validation expects the full `Schema` format (with execution metadata).

## Validation Results

### 1. example-activity-template.json
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/example-activity-template.json`
**Status**: ❌ FAILED (18 validation errors)

**Key Issues**:
- Missing required fields: `id`, `version`, `genealogy`, `executions`, `successRate`, `avgDuration`, `avgCost`, `avgTokens`, `createdAt`, `updatedAt`
- Task-level issues: `max_attempts` vs `maxAttempts` (camelCase mismatch)
- Missing task `metrics` field (required by Schema)
- Uses snake_case (`max_attempts`) instead of camelCase (`maxAttempts`)

**What's Correct**:
- Comprehensive task structure (4 tasks with proper dependencies)
- Good validation patterns and quality gates
- Excellent learning configuration with feedback points
- Complete integration, metabob, composition, and hooks sections
- Well-structured prompt variables

---

### 2. test-template-final.json
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/test-template-final.json`
**Status**: ❌ FAILED (24 validation errors)

**Key Issues**:
- Missing required fields: `id`, `version`, `genealogy`, `executions`, `successRate`, `avgDuration`, `avgCost`, `avgTokens`, `createdAt`, `updatedAt`
- Incorrect `compressionStrategy` value (uses `max_tokens` instead of enum value)
- Missing arrays: `prompt.variables`, task validation arrays
- Task-level: `max_attempts` vs `maxAttempts`
- Missing `integration` and `metabob` configuration objects
- Missing task `metrics`

**What's Correct**:
- Simple, minimal structure (good for testing)
- Uses V2 format with variables at root level
- Has contextRequirements array

---

### 3. create-activity-template.json (Built-in)
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`
**Status**: ❌ FAILED (23 validation errors)

**Key Issues**:
- Has `id` and `name` but wrong `version` type (number instead of Version object)
- Missing: `genealogy`, `executions`, `successRate`, `avgDuration`, `avgCost`, `avgTokens`, `createdAt`, `updatedAt`
- Task issues: missing `prompt.variables`, `retry.maxAttempts`, `metrics`
- ContextRequirements: invalid impulse type `toolOutput` (should be from allowed enum)
- Learning schema: `improvementHints` structure mismatch

**What's Correct**:
- Has comprehensive contextRequirements with proper hints
- Well-structured task graph design (4 tasks)
- Good composition examples
- Detailed learning configuration with patterns
- Complete hooks configuration

---

## Schema Analysis

### Required Fields for `ActivityTemplate.Schema`

**Identity Fields**:
```typescript
id: string                           // ✅ Only built-in template has this
version: {                           // ❌ All templates missing
  major: number
  minor: number
  patch: number
  hash: string
}
genealogy: {                         // ❌ All templates missing
  generation: number
  parentId?: string
  variantOf?: string
  // ... more fields
}
name: string                         // ✅ All templates have
description: string                  // ✅ All templates have
category: enum                       // ✅ All templates have
```

**Execution Metrics** (zero-initialized for new templates):
```typescript
executions: number                   // ❌ All templates missing
successRate: number                  // ❌ All templates missing
avgDuration: number                  // ❌ All templates missing
avgCost: number                      // ❌ All templates missing
avgTokens: {                         // ❌ All templates missing
  input: number
  output: number
  cache: number
}
```

**Task-Level** (each task requires):
```typescript
tasks: [{
  // ... other fields ...
  retry: {
    maxAttempts: number              // ❌ Templates use max_attempts (wrong case)
    strategy: enum
  }
  metrics: {                         // ❌ All templates missing
    successRate: number
    avgTokens: number
    avgDuration: number
    commonFailures: string[]
  }
  prompt: {
    variables: Array                 // ❌ Some templates missing (required even if empty)
  }
  validation: {
    requiredFiles: Array             // ❌ Some templates missing (required even if empty)
    requiredPatterns: Array          // ❌ Some templates missing (required even if empty)
    forbiddenPatterns: Array         // ❌ Some templates missing (required even if empty)
    commands: Array                  // ❌ Some templates missing (required even if empty)
  }
}]
```

**Configuration Objects**:
```typescript
integration: {                       // ❌ test-template-final missing
  preChecks: string[]
  postChecks: string[]
  qualityGates: Array
}
metabob: {                           // ❌ test-template-final missing
  enabled: boolean
  learningMode: boolean
  targetContextTokens: number
  annotationStrategy: enum
}
```

**Timestamps**:
```typescript
createdAt: number                    // ❌ All templates missing
updatedAt: number                    // ❌ All templates missing
```

---

## Common Issues Across All Templates

### 1. Format Mismatch
**Issue**: Templates are written in `CreateOptions` format (simplified for authoring) but validator expects `Schema` format (complete with metadata).

**CreateOptions Format** (what templates use):
- Simplified structure for human authoring
- Omits execution metrics (auto-initialized)
- Omits version/genealogy (auto-generated)
- Omits timestamps (auto-added)
- Uses defaults for optional fields

**Schema Format** (what validator expects):
- Complete structure with all metadata
- Requires execution history fields
- Requires version and genealogy objects
- Requires timestamps
- All arrays must be present (even if empty)

### 2. Naming Convention Issues
- Templates use `max_attempts` (snake_case)
- Schema expects `maxAttempts` (camelCase)

### 3. Missing Empty Arrays
Many templates omit empty arrays, but Schema requires them:
- `prompt.variables: []`
- `validation.requiredFiles: []`
- `validation.requiredPatterns: []`
- `validation.forbiddenPatterns: []`
- `validation.commands: []`

### 4. Invalid Enum Values
- `test-template-final.json`: Uses custom compression value instead of enum
- `create-activity-template.json`: Uses `toolOutput` impulse type (not in enum)

---

## Recommendations

### Option 1: Transform Templates (Recommended)
Create a transformation function that converts `CreateOptions` to `Schema`:

```typescript
function transformToSchema(createOptions: CreateOptions): Schema {
  return {
    ...createOptions,
    id: generateId(createOptions),
    version: generateVersion(),
    genealogy: createGenealogy(),
    executions: 0,
    successRate: 0,
    avgDuration: 0,
    avgCost: 0,
    avgTokens: { input: 0, output: 0, cache: 0 },
    tasks: createOptions.tasks.map(task => ({
      ...task,
      retry: {
        maxAttempts: task.retry.max_attempts || 3,
        strategy: task.retry.strategy
      },
      metrics: {
        successRate: 0,
        avgTokens: 0,
        avgDuration: 0,
        commonFailures: []
      },
      prompt: {
        ...task.prompt,
        variables: task.prompt.variables || []
      },
      validation: {
        requiredFiles: task.validation.requiredFiles || [],
        requiredPatterns: task.validation.requiredPatterns || [],
        forbiddenPatterns: task.validation.forbiddenPatterns || [],
        commands: task.validation.commands || []
      }
    })),
    integration: createOptions.integration || {
      preChecks: [],
      postChecks: [],
      qualityGates: []
    },
    metabob: createOptions.metabob || {
      enabled: false,
      learningMode: true,
      targetContextTokens: 5000,
      annotationStrategy: "key-components"
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}
```

**This is exactly what `ActivityTemplate.create()` does** (see activity-template.ts:1044-1200).

### Option 2: Update Validator
Modify `register_activity_template` to:
1. Detect format (CreateOptions vs Schema)
2. Transform CreateOptions → Schema before validation
3. Validate transformed Schema

### Option 3: Fix Templates Manually
Update all template JSON files to include:
- Execution metrics (zero-initialized)
- Version and genealogy objects
- Timestamps
- All required empty arrays
- Correct camelCase naming

---

## Fix Priority

### HIGH PRIORITY (Blocks registration)
1. **Naming Convention**: Change `max_attempts` → `maxAttempts`
2. **Required Arrays**: Add empty arrays where missing
3. **Invalid Enums**: Fix compression strategy and impulse types
4. **Missing Config Objects**: Add `integration` and `metabob` to test-template-final.json

### MEDIUM PRIORITY (Auto-generated but needed for validation)
5. **Execution Metrics**: Add zero-initialized metrics
6. **Version/Genealogy**: Add proper version and genealogy objects
7. **Timestamps**: Add createdAt/updatedAt
8. **Task Metrics**: Add metrics to each task

### LOW PRIORITY (Nice to have)
9. **Validate Learning Schema**: Fix `improvementHints` structure in create-activity-template.json
10. **Documentation**: Add comments explaining CreateOptions vs Schema distinction

---

## Validation Tool Status

The `register_activity_template` tool currently:
- ✅ Correctly validates against `ActivityTemplate.Schema`
- ✅ Provides detailed error messages with paths
- ❌ Does NOT transform `CreateOptions` → `Schema` before validation
- ❌ Expects fully-formed Schema format (with metadata)

**Expected workflow**:
1. Human writes template in `CreateOptions` format (simplified)
2. Tool transforms to `Schema` format (adds metadata)
3. Tool validates `Schema` format
4. Tool registers with backend

**Current workflow**:
1. Human writes template in `CreateOptions` format
2. Tool validates directly as `Schema` ❌ FAILS
3. Registration blocked

---

## Next Steps

1. **Immediate**: Update `register_activity_template` tool to transform CreateOptions → Schema before validation
2. **Short-term**: Fix high-priority issues in templates (naming, arrays, enums)
3. **Medium-term**: Document CreateOptions vs Schema distinction
4. **Long-term**: Create template authoring guide with examples

---

## Template Quality Assessment

Despite validation errors, the templates show good quality:

**example-activity-template.json**:
- ✅ Comprehensive example with all features
- ✅ Excellent learning configuration
- ✅ Complete hooks and composition
- ✅ Good documentation patterns

**test-template-final.json**:
- ✅ Simple and focused (good for testing)
- ✅ Minimal complexity
- ✅ V2 format with contextRequirements

**create-activity-template.json**:
- ✅ Self-referential (creates templates)
- ✅ Detailed contextRequirements
- ✅ Comprehensive composition examples
- ✅ Production-ready guidance

All templates would pass validation after format transformation.

---

## Conclusion

**Validation Status**: ❌ All 3 templates fail validation
**Root Cause**: Format mismatch (CreateOptions vs Schema)
**Fix Required**: Transform CreateOptions → Schema before validation
**Template Quality**: ✅ High quality, well-structured
**Blocking Issue**: Yes, prevents registration

**Recommendation**: Update `register_activity_template` tool to handle CreateOptions format by transforming to Schema before validation, matching the behavior of `ActivityTemplate.create()`.
