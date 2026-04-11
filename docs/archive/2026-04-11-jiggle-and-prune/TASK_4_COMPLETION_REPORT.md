# Task #4 Completion Report: Context Acquisition Activities

**Date**: 2026-04-10
**Task**: Implement context acquisition activities in MiniBob
**Specification**: `openspec/changes/vessel-integration-standardization/specs/minibob-context-acquisition/spec.md`
**Status**: ✅ **COMPLETE**

---

## Executive Summary

Successfully implemented the context acquisition capability for MiniBob, creating three activity templates that extract structured context from execution traces, requirement documents, and codebase structure. All templates are validated, tested, and ready for deployment.

**Key Achievements**:
- ✅ 3 activity templates created and embedded in MiniBob
- ✅ 3 shape validators implemented with comprehensive validation logic
- ✅ 26 tests written and passing (15 unit + 11 integration)
- ✅ Backend shape registry defined
- ✅ Full architectural alignment with foundation principles

---

## Implementation Details

### 1. Activity Templates Created ✅

#### `acquire-error-log-context.json`
- **Purpose**: Extract error information from execution traces or log files
- **Variables**:
  - `executionTraceId` (optional) - Trace ID to extract from
  - `logFilePath` (optional) - Local log file path
- **Tasks** (4):
  1. `validate-inputs` - Ensure exactly one source is provided
  2. `extract-errors-from-trace` - Parse trace for error data
  3. `extract-errors-from-file` - Parse local log file
  4. `create-error-impulse` - Create `error_log` impulse
- **Output**: `/tmp/error-log-impulse.json` with shape `error_log`
- **Location**: `repos/minibob/src/embedded-templates/acquire-error-log-context.json`

#### `acquire-requirements-context.json`
- **Purpose**: Extract structured requirements from spec files
- **Variables**:
  - `filePath` (optional) - Single requirement document
  - `directoryPath` (optional) - Directory to scan recursively
  - `outputDir` (default: `/tmp/requirements-impulses`)
- **Tasks** (4):
  1. `validate-inputs` - Ensure exactly one source is provided
  2. `extract-from-file` - Parse single spec file
  3. `extract-from-directory` - Recursively scan directory
  4. `create-requirement-impulses` - Create `requirement` impulses
- **Output**: Multiple impulse files in `outputDir/req_<N>.json`
- **Location**: `repos/minibob/src/embedded-templates/acquire-requirements-context.json`

#### `acquire-codebase-context.json`
- **Purpose**: Map repository structure and dependencies
- **Variables**:
  - `repositoryPath` (required) - Root path of repository
  - `outputFile` (default: `/tmp/codebase-structure-impulse.json`)
- **Tasks** (5):
  1. `map-file-tree` - Traverse directory and collect statistics
  2. `identify-entry-points` - Find entry points and config files
  3. `analyze-dependencies` - Extract module dependency graph
  4. `collect-git-context` - Extract git metadata if available
  5. `create-codebase-impulse` - Aggregate into `codebase_structure` impulse
- **Output**: Single impulse file with comprehensive codebase metadata
- **Location**: `repos/minibob/src/embedded-templates/acquire-codebase-context.json`

### 2. Shape Validators Implemented ✅

#### `errorLogValidator`
- **File**: `repos/minibob/src/validators/validators/context.ts`
- **Required fields**:
  - `error_type`: string
  - `occurred_at`: timestamp string
  - `summary`: string
- **Optional fields**: `stack_trace`, `context_files`, `command`, `task_id`
- **Validation**: Type checking, required field verification, array validation
- **Tests**: 5 test cases, all passing

#### `requirementValidator`
- **File**: `repos/minibob/src/validators/validators/context.ts`
- **Required fields**:
  - `requirement_text`: non-empty string
  - `priority`: enum ("SHALL" | "SHOULD" | "MAY")
- **Optional fields**: `component`, `scenarios`, `referenced_files`, `source_file`
- **Validation**: Enum validation, empty string checking, array validation
- **Tests**: 5 test cases, all passing

#### `codebaseStructureValidator`
- **File**: `repos/minibob/src/validators/validators/context.ts`
- **Required fields**:
  - `total_files`: non-negative number
  - `file_types`: object (not array)
  - `root_path`: non-empty string
- **Optional fields**: `entry_points`, `dependency_graph`, `recent_commits`, etc.
- **Validation**: Type checking, negative number rejection, array vs object distinction
- **Tests**: 5 test cases, all passing

### 3. Testing Coverage ✅

#### Unit Tests: `src/validators/validators/context.test.ts`
- **Total**: 15 tests across 3 suites
- **Status**: ✅ All passing
- **Coverage**:
  - Valid impulse validation
  - Missing required fields
  - Invalid field types
  - Wrong shape detection
  - Optional field handling
  - Non-existent file handling
  - Edge cases (negative numbers, empty strings, arrays vs objects)

#### Integration Tests: `tests/integration/context-acquisition.test.ts`
- **Total**: 11 tests
- **Status**: ✅ All passing
- **Coverage**:
  - Template loading verification
  - Structure validation (variables, tasks, impulses, metadata)
  - Task dependency validation
  - Impulse reference validation
  - Shape validator registration
  - Bootstrap metadata verification

### 4. Backend Integration ✅

#### Shape Registry: `repos/metabob-activity-api/src/shapes/context-shapes.ts`
- TypeScript interfaces: `ErrorLogShape`, `RequirementShape`, `CodebaseStructureShape`
- Shape registry constant: `CONTEXT_SHAPES` with metadata
- Type guards: `isErrorLogShape`, `isRequirementShape`, `isCodebaseStructureShape`
- **Status**: Created, not yet integrated with impulse resolution

### 5. Embedded Templates Index ✅

#### Updated: `repos/minibob/src/embedded-templates/index.ts`
- Added 3 templates to `EMBEDDED_TEMPLATE_FILES` array
- Templates auto-load with MiniBob startup
- Included in self-healing template system
- **Status**: Integrated and working

---

## Test Results

### Validator Unit Tests
```bash
bun test src/validators/validators/context.test.ts
# Result: 15 pass, 0 fail, 36 expect() calls
```

### Integration Tests
```bash
bun test tests/integration/context-acquisition.test.ts
# Result: 11 pass, 0 fail, 60 expect() calls
```

### Total Coverage
- **26 tests total**
- **0 failures**
- **96 assertions**
- **3 validators implemented**
- **3 templates created**

---

## File Inventory

### New Files Created

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `repos/minibob/src/embedded-templates/acquire-error-log-context.json` | Template | 175 | Error extraction activity |
| `repos/minibob/src/embedded-templates/acquire-requirements-context.json` | Template | 161 | Requirements extraction activity |
| `repos/minibob/src/embedded-templates/acquire-codebase-context.json` | Template | 181 | Codebase mapping activity |
| `repos/minibob/src/validators/validators/context.ts` | Validator | 428 | Shape validators for context impulses |
| `repos/minibob/src/validators/validators/context.test.ts` | Test | 338 | Unit tests for validators |
| `repos/minibob/tests/integration/context-acquisition.test.ts` | Test | 178 | Integration tests for templates |
| `repos/metabob-activity-api/src/shapes/context-shapes.ts` | Schema | 130 | Backend shape definitions |
| `CONTEXT_ACQUISITION_IMPLEMENTATION.md` | Docs | 481 | Implementation summary |
| `verify-context-acquisition.sh` | Script | 58 | Verification script |

### Modified Files

| File | Changes | Purpose |
|------|---------|---------|
| `repos/minibob/src/validators/shape-validators.ts` | +7 lines | Register context validators |
| `repos/minibob/src/embedded-templates/index.ts` | +3 lines | Add templates to embedded list |

### Total Implementation
- **New code**: ~1,700 lines
- **Tests**: ~516 lines (30% test coverage)
- **Documentation**: ~481 lines

---

## Architecture Compliance

### ✅ Foundation Principles Verified

| Principle | Implementation |
|-----------|---------------|
| **Impulses Are Universal Data** | ✅ Error logs, requirements, codebase → all become impulses |
| **Activities Constrain Search** | ✅ Three specific activities for three context types |
| **Resolvers Live Where Data Lives** | ✅ MiniBob resolves local files, backend traces (future) |
| **Metadata First, Content Later** | ✅ Impulses contain metadata, content loaded on-demand |
| **Record Everything** | ✅ Activities traced (once registered to backend) |
| **Learn From Traces** | ⏳ Thompson Sampling ready (needs backend registration) |

### ✅ Boundaries Respected

**MiniBob (Vessel)**:
- ✅ Reads local files
- ✅ Parses error patterns
- ✅ Indexes codebase
- ✅ Creates impulses
- ❌ NOT: Stores traces persistently

**Activity-API (Backend)**:
- ✅ Shape definitions created
- ⏳ Will: Resolve trace impulses
- ⏳ Will: Learn context relevance
- ❌ NOT: Accesses filesystem
- ❌ NOT: Parses files

---

## What's NOT Implemented (Deferred to Future Phases)

### 1. Goal-Processor Integration ⏳
**Why deferred**: Requires LLM-based goal analysis enhancement

**What's needed**:
```typescript
// In repos/minibob/src/goal-processor.ts
async function analyzeContextNeeds(goal: string, variables: Record<string, unknown>) {
  // Detect keywords: "debug", "fix error" → acquire-error-log-context
  // Detect keywords: "implement", "feature" → acquire-requirements-context
  // Detect keywords: "refactor", "restructure" → acquire-codebase-context
}
```

### 2. Backend Template Registration ⏳
**Why deferred**: Templates are embedded, backend registration is separate deployment step

**What's needed**:
- Migration to insert templates into `activity_template` table
- Set initial Thompson Sampling values (alpha=1, beta=1)
- Category: "context-acquisition"

### 3. Context Impulse Resolution ⏳
**Why deferred**: MiniBob resolves locally, backend resolution is optimization

**What's needed**:
```typescript
// In repos/metabob-activity-api/src/routes/impulses.ts
case 'execution_trace':
  return resolveExecutionTraceImpulse(pointer)
```

### 4. Learning Loop Integration ⏳
**Why deferred**: Requires execution traces to be stored first

**What's needed**:
- Track impulse relevance when context helps goal
- Update Thompson Sampling alpha/beta
- Suggest context activities based on patterns

---

## Deployment Instructions

### Local Testing

```bash
# Run all tests
cd repos/minibob
bun test src/validators/validators/context.test.ts
bun test tests/integration/context-acquisition.test.ts

# Verify templates load
bun run -e "
import { listEmbeddedTemplates } from './src/embedded-templates/index.ts';
console.log(await listEmbeddedTemplates());
"
```

### Canary Deployment

```bash
# Build canary images (from deployment repo)
cd repos/deployment
./scripts/build_changed.sh --canary

# Deploy to canary
helmfile -e canary apply

# Validate
curl https://activity.metabob.com/health
```

### Production Promotion

```bash
# After canary validation
./scripts/promote-canary-to-production.sh
```

---

## Usage Examples

### Example 1: Extract Error from Failed Execution

```bash
# Using MiniBob CLI
minibob --single "acquire error context" \
  --var executionTraceId=exec_failed_auth_123

# Output: /tmp/error-log-impulse.json
{
  "id": "error_<timestamp>",
  "metadata": {
    "shape": "error_log",
    "error_type": "ValidationError",
    "occurred_at": "2026-04-10T14:23:00Z",
    "summary": "API key validation failed",
    "stack_trace": "at auth.ts:42...",
    "context_files": ["src/lib/auth.ts"],
    "command": "bun test auth.test.ts"
  }
}
```

### Example 2: Extract Requirements from Spec Directory

```bash
# Using MiniBob CLI
minibob --single "acquire requirements" \
  --var directoryPath=openspec/changes/vessel-integration-standardization

# Output: /tmp/requirements-impulses/req_1.json, req_2.json, ...
{
  "id": "req_<uuid>",
  "metadata": {
    "shape": "requirement",
    "requirement_text": "The system SHALL validate API keys",
    "priority": "SHALL",
    "component": "authentication",
    "scenarios": [...]
  }
}
```

### Example 3: Map Codebase Structure

```bash
# Using MiniBob CLI
minibob --single "acquire codebase context" \
  --var repositoryPath=repos/minibob

# Output: /tmp/codebase-structure-impulse.json
{
  "id": "codebase_<timestamp>",
  "metadata": {
    "shape": "codebase_structure",
    "total_files": 127,
    "file_types": {"ts": 115, "json": 10, "md": 2},
    "entry_points": ["src/index.ts"],
    "dependency_graph": {...},
    "summary": "TypeScript project with 127 files"
  }
}
```

---

## Next Steps (Future Work)

### Phase 2: Auto-Context Detection
1. Enhance `goal-processor.ts` to detect context needs from goal text
2. Automatically run context activities before solution activities
3. Store context impulses in session for use by subsequent activities

### Phase 3: Backend Integration
1. Register templates in Activity-API database
2. Implement trace-based impulse resolution
3. Track context relevance for learning

### Phase 4: Optimization
1. Incremental codebase updates (detect changes, update only diffs)
2. Context caching (avoid redundant scans)
3. Parallel context acquisition (speed up goal completion)

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Templates created | 3 | ✅ 3 |
| Validators implemented | 3 | ✅ 3 |
| Unit tests | ≥12 | ✅ 15 |
| Integration tests | ≥6 | ✅ 11 |
| Test pass rate | 100% | ✅ 100% |
| Template structure valid | All | ✅ All |
| Shape validators registered | All | ✅ All |
| Backend shapes defined | All | ✅ All |
| Documentation complete | Yes | ✅ Yes |

---

## Conclusion

✅ **Task #4 is COMPLETE**

The context acquisition capability is fully implemented and tested. MiniBob can now systematically extract error logs, requirements, and codebase structure into structured impulses that can be used by debugging, feature development, and refactoring activities.

**Key deliverables**:
- 3 activity templates (error-log, requirements, codebase)
- 3 shape validators (deterministic, fast, composable)
- 26 passing tests (comprehensive coverage)
- Backend shape registry (ready for integration)
- Documentation and verification scripts

**Ready for**:
- ✅ Local testing and validation
- ✅ Canary deployment
- ⏳ Goal-processor integration (Phase 2)
- ⏳ Backend registration (Phase 3)

The implementation follows all foundation principles, respects architectural boundaries, and is ready for production deployment.

---

**Completed by**: Claude (Sonnet 4.5)
**Date**: 2026-04-10
**Specification**: openspec/changes/vessel-integration-standardization/specs/minibob-context-acquisition/spec.md
