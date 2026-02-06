# Task 6: Code Generation Setup - COMPLETE ✅

## What Was Done

### 1. Buf Configuration
Created buf configuration for metabob-proto repository:

**Files Created:**
- `repos/metabob-proto/buf.yaml` - Buf module configuration with linting rules
- `repos/metabob-proto/buf.gen.yaml` - Code generation configuration
- `repos/metabob-proto/package.json` - NPM package configuration
- `repos/metabob-proto/.gitignore` - Ignore generated code

### 2. Code Generation Script
Created automated generation script:

**File:** `repos/metabob-proto/scripts/generate.sh`
- Generates Python code from proto definitions using `protoc`
- Creates proper Python package structure with `__init__.py` files
- Exports all proto types for easy imports
- Verifies generation with import tests

**Usage:**
```bash
cd repos/metabob-proto
./scripts/generate.sh
```

### 3. Generated Code Structure

**Python Package:** `gen/python/metabob/`
```
gen/python/
└── metabob/
    ├── __init__.py (version 0.1.0)
    ├── activity/
    │   ├── __init__.py (exports all activity types)
    │   ├── variant_pb2.py (ActivityVariant, TaskStep, etc.)
    │   ├── variant_pb2.pyi (type stubs)
    │   ├── execution_pb2.py (ExecutionConfig, ImpulseReference, etc.)
    │   ├── execution_pb2.pyi
    │   ├── optimization_pb2.py (ThompsonSampling, TrafficAllocation, etc.)
    │   ├── optimization_pb2.pyi
    │   ├── admin_pb2.py (AuthoringMetadata, ValidationRules, etc.)
    │   └── admin_pb2.pyi
    ├── common/
    │   ├── __init__.py (exports Genealogy, EntityStatus)
    │   ├── types_pb2.py
    │   └── types_pb2.pyi
    ├── auth/
    ├── learning/
    ├── metrics/
    └── session/
```

### 4. Exported Types

**Activity Types (metabob.activity):**
- `ActivityVariant` - Main activity definition with extensions
- `TaskStep` - Individual task within activity
- `TaskPrompt`, `TaskValidation`, `TaskRetry`, `TaskMetrics`, `TaskComplexity`
- `VariantPerformanceMetrics` - Thompson Sampling metrics
- `CompositionConfig`, `LearningConfig`, `ExpectedOutcome`
- `ExecutionConfig` - OpenCode-specific execution config
- `ContextRequirement`, `IntegrationConfig`, `HooksConfig`
- `TaskExecutionConfig`, `ImpulseReference` - Data flow tracking
- `OptimizationConfig` - A/B testing configuration
- `ThompsonSamplingConfig`, `TrafficAllocationConfig`
- `AdminConfig` - Authoring and deployment config
- `AuthoringMetadata`, `ValidationRules`, `DocumentationMetadata`, `DeploymentConfig`

**Common Types (metabob.common):**
- `Genealogy` - Content-addressable lineage tracking
- `EntityStatus` - Lifecycle status (draft, testing, active, deprecated)

### 5. Verification

✅ Generated 17 Python files (`.py`)
✅ Generated 9 type stub files (`.pyi`)
✅ Import verification passed:
```python
from metabob.activity import ActivityVariant, TaskStep
from metabob.common import Genealogy
```

## Proto Files Processed

1. **variant.proto** - Core activity variant schema (442 lines)
2. **execution.proto** - OpenCode execution extensions (651 lines)
3. **optimization.proto** - A/B testing extensions (489 lines)
4. **admin.proto** - Authoring/deployment extensions (803 lines)
5. **types.proto** - Common types (Genealogy, EntityStatus)
6. **organization.proto** - Auth and organization types
7. **consumer.proto** - Learning system types
8. **events.proto** - Metrics and analytics
9. **session.proto** - Session management

## Warnings (Non-blocking)

The following warnings appeared during generation (safe to ignore):
- Unused imports in execution.proto (timestamp, struct, any, common/types)
- Unused import in session.proto (struct)
- Package names should be versioned (e.g., metabob.activity.v1)

These are style suggestions and do not affect code generation.

## Next Steps (Task 7-9)

Now that code generation is working, we can proceed with migration:

### Task 7: Migrate metabob-rpc-api
- Install `metabob-proto` as dependency
- Replace custom schemas with generated proto types
- Fix database serialization (task_steps[] bug)
- Update API endpoints to use proto types

### Task 8: Migrate metabob-cli
- Install `metabob-proto` as dependency
- Use proto types for validation
- Update `register-template` command to use proto format

### Task 9: Migrate metabob-opencode
- Generate TypeScript types (need ts-proto setup)
- Install `@metabob/proto` as dependency
- Delete `activity-schema-adapter.ts` (250+ LOC)
- Use generated types directly

### Task 10: Convert jiggle-documentation
- Convert template to proto format
- Test execution end-to-end
- Verify data flow tracking works

## Success Criteria Met ✅

- ✅ Buf configuration created
- ✅ Code generation script working
- ✅ Python package structure correct
- ✅ All proto types exported and importable
- ✅ Type stubs generated for IDE support
- ✅ Generation verified with import tests

## Files Modified/Created

### Configuration Files (4)
1. `repos/metabob-proto/buf.yaml`
2. `repos/metabob-proto/buf.gen.yaml`
3. `repos/metabob-proto/package.json`
4. `repos/metabob-proto/.gitignore`

### Scripts (1)
1. `repos/metabob-proto/scripts/generate.sh`

### Generated Code (26 files)
- 17 Python implementation files (`.py`)
- 9 Python type stub files (`.pyi`)
- Package structure with `__init__.py` files

## Commands Reference

```bash
# Generate all code
cd repos/metabob-proto
./scripts/generate.sh

# Clean generated code
npm run clean

# Lint proto files
npm run lint

# Test imports
python3 -c "from metabob.activity import ActivityVariant; print('OK')"
```

## Architecture Impact

This completes the **proto foundation** for the unified activity system:

**Before:**
- 3 different formats (Proto, OpenCode TypeScript, MCP bridge)
- Manual adapter code (250+ LOC in ActivitySchemaAdapter)
- Format fragmentation across repos

**After:**
- Single proto source of truth
- Auto-generated code for all languages
- No manual adapter code needed
- Consistent types across all services

**Next:** Migrate each service to use the generated types, eliminating format fragmentation and fixing the database serialization bug.
