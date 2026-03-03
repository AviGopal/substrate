# Trace Analysis: metabob-cli-test-implementation-alignment

## Executive Summary

The metabob-cli test suite is currently blocked by **43 TypeScript compilation errors** resulting from schema evolution in the ActivityTemplate system. Recent architectural changes introduced new required fields and removed deprecated features, causing test objects to become incompatible with current type definitions.

**Impact**: 709 tests are blocked from execution until typecheck passes.

## Root Cause

Recent architectural refactoring introduced breaking changes:
1. **IntegrationSchema** now requires `requiresCleanGit: boolean` field (18 test failures)
2. **Duplicate property declarations** from merge conflicts or refactoring (11 test failures)  
3. **Removed/disabled features** still referenced in tests (useCochangePrediction - 3 failures)
4. **Missing type definitions** for cpgImpact metadata (7 failures)
5. **Bootstrap template ID changes** (1 failure)
6. **Unknown type assertions** in TUI tests (3 failures)

## Architectural Changes Context

### Recent Commits
- `3f7b29b5` - Enforce backend-only template storage via MCP
- `bc42fe56` - Fix bootstrap template filepath compliance  
- `a16fd124` - Embed templates in binary (no filesystem dependency)
- `b05e5015b` - Cross-instance storage invariance

### Schema Evolution
- **IntegrationSchema** (activity-template.ts:380) now requires `requiresCleanGit`
- **Bootstrap templates** embedded in binary, IDs changed
- **ValidationSchema** has `useCochangePrediction` but it's disabled

## Error Categories (43 total)

### 1. Missing requiresCleanGit (18 errors) - HIGH PRIORITY
**Schema**: `IntegrationSchema` at repos/metabob-opencode/packages/opencode/src/session/activity-template.ts:380

**Current Definition**:
```typescript
export const IntegrationSchema = z.object({
  requiresCleanGit: z.boolean().default(true),
  preChecks: z.array(z.string()),
  postChecks: z.array(z.string()),
  qualityGates: z.array(...)
})
```

**Affected Files**:
- test/integration/template-repository.test.ts
- test/server/template-service-client.test.ts
- test/session/recommendation-engine-discovery.test.ts (7 instances)
- test/session/template-builder.test.ts
- test/session/template-cache.test.ts
- test/session/template-library-define.test.ts
- test/session/template-loader.test.ts
- test/tool/activity-tool-calls-simple.test.ts

**Fix Pattern**:
```typescript
// OLD (fails typecheck)
{ preChecks: [], postChecks: [], qualityGates: [] }

// NEW (correct)
{ requiresCleanGit: false, preChecks: [], postChecks: [], qualityGates: [] }
```

### 2. Duplicate Properties (11 errors) - HIGH PRIORITY
**Example**: test/tool/activity-tool-validation.test.ts:54-55
```typescript
integration: {
  requiresCleanGit: true,   // Line 54
  requiresCleanGit: true,   // Line 55 - DUPLICATE
  preChecks: [],
  ...
}
```

**Affected Files**:
- test/tool/activity-tool-validation.test.ts (10 instances)
- test/tool/activity.test.ts:109
- test/tool/get-activity-template.test.ts:48
- test/tool/list-activity-templates.test.ts:67
- test/tool/post-activity-result.test.ts:48

**Fix**: Remove duplicate `requiresCleanGit` lines

### 3. Invalid useCochangePrediction (3 errors) - MEDIUM PRIORITY
**Schema**: ValidationSchema has `useCochangePrediction` but template-executor.ts comments it as "not currently enabled"

**Affected Files**:
- test/session/cochange-workflow-simple.test.ts:236
- test/session/cochange-workflow.test.ts:334  
- test/session/cochange-workflow.test.ts:390

**Fix**: Remove `useCochangePrediction` from validation config objects

### 4. Missing cpgImpact Interface (7 errors) - MEDIUM PRIORITY
**Issue**: Tests access `metadata.cpgImpact` but it doesn't exist in impulse metadata type

**Affected File**:
- test/util/cpg-impulse-integration.test.ts (lines 69, 79-82, 111, 119)

**Fix**: Either add cpgImpact to metadata interface or use proper type assertions

### 5. Invalid Bootstrap Template ID (1 error) - LOW PRIORITY
**Issue**: Test uses `"create-activity-self-contained"` but valid ID is `"create-activity"`

**Valid IDs** (from bootstrap-templates.ts:40-47):
- create-activity
- debug-activity-self-contained
- evolve-activity-self-contained
- manage-session-memory
- trace-data-flow-single-feature
- trace-enforce-validate-loop

**Affected File**:
- test/session/bootstrap-templates.test.ts:73

**Fix**: Change ID to `"create-activity"`

### 6. Unknown Type Errors (3 errors) - LOW PRIORITY
**Issue**: Objects are of type 'unknown' in TUI sidebar assertions

**Affected File**:
- test/cli/tui-sidebar-integration.test.ts:343-345

**Fix**: Add proper type assertions

## Data Flow

```
Test File Import
    ↓
ActivityTemplate Schemas (Zod)
    ↓
Test Creates Mock Objects
    ↓
TypeScript Type Validation
    ↓
❌ TYPE MISMATCH → Compilation Error
    ↓
Tests Blocked (cannot execute)
```

## Current vs Desired State

| Metric | Current | Desired |
|--------|---------|---------|
| TypeCheck Errors | 43 | 0 |
| Tests Passing | 0 (blocked) | 709 |
| Test Duration | N/A | ~8 seconds |
| Coverage | N/A | 97% |
| Status | BLOCKED | PASSING |

## Component Analysis

### IntegrationSchema (activity-template.ts:380)
- **Current**: Requires `requiresCleanGit: boolean` with `default(true)`
- **Impact**: All test integration objects must include this field
- **Files Affected**: 18

### BootstrapTemplates.TEMPLATE_IDS (bootstrap-templates.ts:40-47)  
- **Current**: 6 valid template IDs, embedded in binary
- **Impact**: Tests must use exact IDs from this list
- **Files Affected**: 1

### ValidationSchema (activity-template.ts)
- **Current**: `useCochangePrediction` exists but disabled
- **Impact**: Should not be used in validation configs
- **Files Affected**: 3

## Enforcement Plan

### Step 1: Fix Missing requiresCleanGit (18 files)
**Automatable**: Yes  
**Pattern**: Add `requiresCleanGit: false` to integration objects
```bash
# Find all instances
rg "{ preChecks: \[\], postChecks: \[\], qualityGates: \[\] }" --type ts
```

### Step 2: Remove Duplicate requiresCleanGit (11 files)
**Automatable**: Yes
**Pattern**: Remove duplicate lines
```bash
# Find duplicates
rg "requiresCleanGit.*\n.*requiresCleanGit" --type ts
```

### Step 3: Remove useCochangePrediction (3 files)
**Automatable**: Yes
**Pattern**: Remove property access

### Step 4: Fix cpgImpact Metadata (1 file, 7 instances)
**Automatable**: No  
**Requires Investigation**: Yes
- Option A: Add cpgImpact to metadata interface
- Option B: Use type assertions in tests

### Step 5: Fix Bootstrap Template ID (1 file)
**Automatable**: Yes
**Pattern**: `"create-activity-self-contained"` → `"create-activity"`

### Step 6: Fix Unknown Type Assertions (1 file, 3 instances)
**Automatable**: No
**Requires Investigation**: Yes

## Validation Checks

After enforcement, verify:
1. `bun run typecheck` → 0 errors
2. `bun test` → 709 passing in ~8s
3. Test coverage → 97%
4. No I/O errors in teardown

## Commit Intent Alignment

Recent commits demonstrate architectural evolution toward:
- **Embedded templates**: No filesystem dependency (a16fd124)
- **Backend-only storage**: MCP enforcement (3f7b29b5)
- **Type safety**: requiresCleanGit field addition

**Tests must validate**: The functional state correctly expresses this instructional intent.

## Impulse Created

**ID**: `trace-metabob-cli-test-implementation-alignment`  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Priority**: high  
**Usage**: Downstream enforcement and validation tasks

## Next Steps

1. **Enforcement Task**: Use this trace to systematically fix all 43 errors
2. **Validation Task**: Verify 709 tests pass with 97% coverage
3. **Documentation**: Update test patterns to match current schema
