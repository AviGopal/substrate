# Context Acquisition Implementation Summary

**Date**: 2026-04-10
**Specification**: `openspec/changes/vessel-integration-standardization/specs/minibob-context-acquisition/spec.md`
**Status**: ✅ COMPLETE

## Overview

Implemented the context acquisition capability for MiniBob, enabling systematic extraction of execution context from traces, documentation, and codebase structure. These activities produce impulses that feed into goal-seeking workflows, following the "metadata first, content later" and "resolvers live where data lives" principles.

## Implementation Checklist

### ✅ Activity Templates (JSON)

Created three context acquisition activity templates:

1. **`acquire-error-log-context.json`** (`repos/minibob/src/embedded-templates/`)
   - Extracts error information from execution traces or log files
   - Creates `error_log` impulse with metadata
   - Tasks: validate-inputs, extract-errors-from-trace, extract-errors-from-file, create-error-impulse
   - Variables: `executionTraceId` (trace) OR `logFilePath` (local file)

2. **`acquire-requirements-context.json`** (`repos/minibob/src/embedded-templates/`)
   - Parses spec files for SHALL/SHOULD/MAY statements
   - Creates `requirement` impulse per requirement
   - Tasks: validate-inputs, extract-from-file, extract-from-directory, create-requirement-impulses
   - Variables: `filePath` (single file) OR `directoryPath` (recursive scan)

3. **`acquire-codebase-context.json`** (`repos/minibob/src/embedded-templates/`)
   - Maps repository structure, identifies entry points, analyzes dependencies
   - Creates `codebase_structure` impulse
   - Tasks: map-file-tree, identify-entry-points, analyze-dependencies, collect-git-context, create-codebase-impulse
   - Variables: `repositoryPath` (required), `outputFile` (optional)

### ✅ Shape Validators

Implemented deterministic validators in `repos/minibob/src/validators/validators/context.ts`:

1. **`errorLogValidator`**
   - Validates `error_log` impulse shape
   - Required fields: `error_type`, `occurred_at`, `summary`
   - Optional fields: `stack_trace`, `context_files`, `command`, `task_id`
   - Returns metadata: `error_type`, `has_stack_trace`, `context_files_count`

2. **`requirementValidator`**
   - Validates `requirement` impulse shape
   - Required fields: `requirement_text`, `priority` (SHALL|SHOULD|MAY)
   - Optional fields: `component`, `scenarios`, `referenced_files`, `source_file`
   - Returns metadata: `priority`, `has_scenarios`, `referenced_files_count`

3. **`codebaseStructureValidator`**
   - Validates `codebase_structure` impulse shape
   - Required fields: `total_files`, `file_types`, `root_path`
   - Optional fields: `entry_points`, `dependency_graph`, `recent_commits`, etc.
   - Returns metadata: `total_files`, `file_type_count`, `has_entry_points`, `has_git_context`

**Registered in**: `repos/minibob/src/validators/shape-validators.ts` (lines 387-391)

### ✅ Backend Shape Registry

Created shape definitions in `repos/metabob-activity-api/src/shapes/context-shapes.ts`:

- TypeScript interfaces: `ErrorLogShape`, `RequirementShape`, `CodebaseStructureShape`
- Shape registry: `CONTEXT_SHAPES` constant with metadata
- Type guards: `isErrorLogShape`, `isRequirementShape`, `isCodebaseStructureShape`

### ✅ Embedded Templates Index

Updated `repos/minibob/src/embedded-templates/index.ts`:

- Added three templates to `EMBEDDED_TEMPLATE_FILES` array (lines 61-63)
- Templates auto-load with MiniBob startup
- Included in embedded template cache for offline operation

### ✅ Tests

Created comprehensive test suites:

1. **Unit Tests** (`repos/minibob/src/validators/validators/context.test.ts`)
   - 15 test cases across 3 validator suites
   - Tests valid impulses, missing fields, invalid types, edge cases
   - ✅ All tests passing

2. **Integration Tests** (`repos/minibob/tests/integration/context-acquisition.test.ts`)
   - Template loading verification
   - Structure validation (variables, tasks, impulses)
   - Metadata checks (primordial, bootstrap, level)
   - Dependency and reference validation
   - Shape validator registration checks

### ⏳ NOT YET IMPLEMENTED

The following items from the spec are **NOT implemented** in this phase:

1. **Goal-Processor Integration** (automatic context detection)
   - Spec requirement: Detect context needs from goal text
   - Example: "debug error" → auto-run `acquire-error-log-context`
   - **Why deferred**: Requires LLM-based goal analysis enhancement
   - **Future work**: Modify `repos/minibob/src/goal-processor.ts` to detect keywords and trigger context activities

2. **Backend Template Registration**
   - Spec requirement: Store templates in metabob-activity-api for Thompson Sampling
   - **Why deferred**: Templates are embedded in MiniBob, not yet registered to backend
   - **Future work**: Add migration to insert templates into `activity_template` table

3. **Context Impulse Resolution in Backend**
   - Spec requirement: Backend resolves trace-based context impulses via MCP
   - Example: Resolve `execution_trace` pointer to extract error data
   - **Why deferred**: MiniBob currently resolves locally via activities
   - **Future work**: Add resolution handlers in `repos/metabob-activity-api/src/routes/impulses.ts`

4. **State-Space-Manager Integration**
   - Spec requirement: Suggest missing context via `missingImpulses` array
   - **Why deferred**: State-space-manager exists but context suggestions not wired
   - **Future work**: Enhance context detection logic

## File Locations

### MiniBob (Vessel)

```
repos/minibob/
├── src/
│   ├── embedded-templates/
│   │   ├── acquire-error-log-context.json          [NEW]
│   │   ├── acquire-requirements-context.json       [NEW]
│   │   ├── acquire-codebase-context.json           [NEW]
│   │   └── index.ts                                [MODIFIED]
│   └── validators/
│       ├── validators/
│       │   ├── context.ts                          [NEW]
│       │   └── context.test.ts                     [NEW]
│       └── shape-validators.ts                     [MODIFIED]
└── tests/
    └── integration/
        └── context-acquisition.test.ts             [NEW]
```

### Activity-API (Backend)

```
repos/metabob-activity-api/
└── src/
    └── shapes/
        └── context-shapes.ts                       [NEW]
```

## Architecture Alignment

### ✅ Foundation Principles Followed

1. **Impulses Are Universal Data**: Error logs, requirements, codebase structure all become impulses with metadata
2. **Activities Constrain Search**: Three specific activities constrain context gathering to known patterns
3. **Resolvers Live Where Data Lives**: MiniBob resolves local files, backend would resolve stored traces
4. **Metadata First, Content Later**: Activities create impulses with shape/summary, load content on-demand
5. **Record Everything**: All context acquisition executions will be traced for learning (once templates registered)
6. **Learn From Traces**: Thompson Sampling will learn which context sources help (once integrated with backend)

### ✅ Critical Boundaries Respected

```
MiniBob (VESSEL)                      Activity-API (BACKEND)
═══════════════                       ═══════════════════════
✓ Read local files                    ✓ Store execution traces
✓ Parse error patterns                ✓ Resolve trace impulses (future)
✓ Index codebase structure            ✓ Learn context relevance (future)
✓ Create context impulses             ❌ NOT: Parse files
✓ Resolve file impulses               ❌ NOT: Index codebases
❌ NOT: Store traces persistently     ❌ NOT: Access filesystem
```

## Usage Examples

### Extract Error from Execution Trace

```bash
minibob --single "acquire error context from trace exec_123"
# Variables: executionTraceId=exec_123
# Output: /tmp/error-log-impulse.json
```

### Extract Requirements from Spec

```bash
minibob --single "acquire requirements from openspec/changes/vessel-integration-standardization"
# Variables: directoryPath=openspec/changes/vessel-integration-standardization
# Output: /tmp/requirements-impulses/*.json
```

### Map Codebase Structure

```bash
minibob --single "acquire codebase context from repos/minibob"
# Variables: repositoryPath=repos/minibob
# Output: /tmp/codebase-structure-impulse.json
```

## Testing

### Run All Context Tests

```bash
cd repos/minibob

# Unit tests (validators)
bun test src/validators/validators/context.test.ts

# Integration tests (templates)
bun test tests/integration/context-acquisition.test.ts
```

### Expected Results

- **Unit tests**: 15 tests, all passing
- **Integration tests**: Validates template structure, dependencies, validators

## Next Steps

### Phase 2: Goal-Processor Integration

1. **Enhance goal enrichment** to detect context needs:
   - "debug", "fix error" → trigger `acquire-error-log-context`
   - "implement", "add feature" → trigger `acquire-requirements-context`
   - "refactor", "restructure" → trigger `acquire-codebase-context`

2. **Modify `processGoal` function** in `repos/minibob/src/goal-processor.ts`:
   - Add context detection before activity recommendation
   - Execute context activities first, then solution activities
   - Store created impulses in session impulse store

### Phase 3: Backend Integration

1. **Register templates** in `activity_template` table:
   - Add migration to insert context acquisition templates
   - Set Thompson Sampling initial values (alpha/beta)

2. **Implement trace-based impulse resolution**:
   - Add handlers in `repos/metabob-activity-api/src/routes/impulses.ts`
   - Resolve `execution_trace` pointer to extract error data
   - Return formatted error information

3. **Track context relevance**:
   - Record which context impulses helped goal completion
   - Update impulse_relevance_metrics table
   - Use for better context recommendations

### Phase 4: Optimization

1. **Incremental codebase updates**:
   - Detect existing `codebase_structure` impulse
   - Update only changed files since last index

2. **Context caching**:
   - Cache frequently used context impulses
   - Invalidate on file changes (git hooks)

3. **Parallel context acquisition**:
   - Run multiple context activities in parallel
   - Aggregate results for faster goal completion

## Success Criteria

| Criterion | Status |
|-----------|--------|
| context:error-log extracts errors from execution traces | ✅ Template created |
| context:requirements parses spec files and creates requirement impulses | ✅ Template created |
| context:codebase indexes repository structure efficiently | ✅ Template created |
| All three activities create properly shaped impulses with metadata | ✅ Validators implemented |
| Activities recorded as execution traces for Thompson Sampling | ⏳ Requires backend registration |
| Goal "debug the auth error" automatically runs context:error-log | ⏳ Requires goal-processor integration |
| Goal "implement user signup" automatically runs context:requirements | ⏳ Requires goal-processor integration |
| Goal "refactor the API" automatically runs context:codebase | ⏳ Requires goal-processor integration |
| Context impulses available to subsequent activities in session | ⏳ Requires impulse store wiring |
| Successful context acquisition increments Thompson Sampling alpha | ⏳ Requires backend integration |
| Failed context acquisition increments beta | ⏳ Requires backend integration |
| Impulse relevance tracked when context helps goal completion | ⏳ Requires backend integration |
| Recommendations improve over time (better context suggestions) | ⏳ Requires learning loop |

## Deployment

### Canary Deployment

To deploy these changes to canary:

```bash
# From deployment repo
cd repos/deployment

# Build canary images
./scripts/build_changed.sh --canary

# Deploy to canary
helmfile -e canary apply

# Validate
curl https://activity.metabob.com/health
```

### Validation

```bash
# Test template loading
minibob --single "list embedded templates"
# Should include: acquire-error-log-context, acquire-requirements-context, acquire-codebase-context

# Test validator registration
minibob --single "list shape validators"
# Should include: error_log, requirement, codebase_structure
```

## Notes

- All templates are marked as `primordial` and `bootstrap` (level 0)
- Templates use LLM for extraction logic (could be optimized later with deterministic parsers)
- Error handling follows spec: graceful degradation, clear error messages
- Budget limits enforced: error_log (3000), requirement (2000), codebase_structure (5000)

## Related Documentation

- **Specification**: `openspec/changes/vessel-integration-standardization/specs/minibob-context-acquisition/spec.md`
- **Foundation**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **MiniBob Guide**: `repos/minibob/CLAUDE.md`
- **Deployment Guide**: `repos/deployment/DEPLOYMENT_WORKFLOW.md`
