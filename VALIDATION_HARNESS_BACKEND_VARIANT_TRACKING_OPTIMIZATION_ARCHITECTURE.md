# Validation Harness: backend-variant-tracking-optimization-architecture

**Harness File**: `tests/validation-harnesses/backend-variant-tracking-optimization-architecture-harness.ts`  
**Specification**: backend-variant-tracking-optimization-architecture  
**Test Cases**: 6 stages  
**Type**: Multi-stage architectural validation

---

## Overview

This validation harness implements a 6-stage validation strategy to verify the backend-variant-tracking-optimization-architecture specification is correctly implemented:

1. **Stage 1**: Grep for OptimizationMetadata in activity-template.ts (expect: NOT FOUND)
2. **Stage 2**: Verify variant_id field in template-metrics.ts and activity.ts (expect: PRESENT)
3. **Stage 3**: Test config_update tool with MCP section modification (expect: MCP.reload() supported)
4. **Stage 4**: Query SurrealDB activity_execution table (expect: data exists if activity ran)
5. **Stage 5**: Verify metabob-cli activity_manager.py includes variant_id (expect: PRESENT)
6. **Stage 6**: Check recommendation logic queries backend only (expect: NO template.optimization access)

---

## Usage

### Programmatic Usage

```typescript
import { runValidation } from './backend-variant-tracking-optimization-architecture-harness';

const result = await runValidation({
  checkDatabase: false,        // Set to true to query SurrealDB
  skipMcpReloadTest: true,     // Set to false to test MCP reload
  surrealdbUrl: 'http://localhost:8000',
  metabobCliPid: 2461428
});

console.log(result.pass ? 'PASS ✅' : 'FAIL ❌');
console.log(result.details.join('\n'));
```

### Command Line Usage

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/tests/validation-harnesses

# Basic validation (no database check)
node -e "const h = require('./backend-variant-tracking-optimization-architecture-harness'); h.runValidation().then(r => console.log(r.pass ? 'PASS' : 'FAIL'))"

# Full validation (with database)
node -e "const h = require('./backend-variant-tracking-optimization-architecture-harness'); h.runValidation({checkDatabase: true}).then(r => console.log(r.details.join('\n')))"
```

---

## Validation Stages

### Stage 1: No OptimizationMetadata Schema

**Purpose**: Verify that in-template optimization metadata has been removed

**Checks**:
- OptimizationMetadataSchema does NOT exist
- OptimizationMetadata type is NOT exported
- TaskSchema has NO optimization field
- Documentation explains external backend tracking

**Expected Behavior**:
```typescript
{
  hasOptimizationMetadataSchema: false,
  hasOptimizationMetadataType: false,
  hasOptimizationField: false,
  hasExternalTrackingDoc: true
}
```

**Test Case Impulse**: `validation-backend-variant-tracking-optimization-architecture-case-1`

---

### Stage 2: variant_id Field Present

**Purpose**: Verify variant_id exists in execution data schemas

**Checks**:
- variant_id field in ActivityExecutionData (template-metrics.ts)
- variant_id passed to reportExecution() (activity.ts)

**Expected Behavior**:
```typescript
{
  hasVariantIdInActivityExecutionData: true,
  variantIdPassedToReportExecution: true
}
```

**Test Case Impulse**: `validation-backend-variant-tracking-optimization-architecture-case-2`

---

### Stage 3: config_update Tool Works

**Purpose**: Verify agent-driven config modification and MCP reload

**Checks**:
- config_update tool supports MCP section
- Supports reload parameter
- Supports add/remove/modify operations
- reload.ts implements MCP.reload() mechanism

**Expected Behavior**:
```typescript
{
  supportsMcpSection: true,
  supportsReload: true,
  supportsAddRemoveModify: true,
  reloadMechanismExists: true
}
```

**Test Case Impulse**: `validation-backend-variant-tracking-optimization-architecture-case-3`

---

### Stage 4: SurrealDB Has Execution Data

**Purpose**: Verify execution data flows to database with variant_id

**Checks**:
- SurrealDB is accessible
- activity_execution table exists
- Records with variant_id field exist (if activities ran)

**Expected Behavior**:
```typescript
{
  databaseAccessible: true,
  executionRecordsExist: true, // or false if no activities ran
  variantIdFieldPresent: true
}
```

**Note**: This stage is **conditional** - if no activities have been executed, no records are expected.

**Test Case Impulse**: `validation-backend-variant-tracking-optimization-architecture-case-4`

---

### Stage 5: activity_manager.py Has variant_id

**Purpose**: Verify metabob-cli tracks variant_id correctly

**Checks**:
- variant_id in ActivityExecution dataclass
- Backend POST endpoint for executions exists
- Proto fields use snake_case (variant_id)

**Expected Behavior**:
```typescript
{
  hasVariantIdInActivityExecution: true,
  hasBackendPostEndpoint: true,
  usesSnakeCaseForProto: true
}
```

**Test Case Impulse**: `validation-backend-variant-tracking-optimization-architecture-case-5`

---

### Stage 6: Recommendation Uses Backend

**Purpose**: Verify optimization queries backend, not template metadata

**Checks**:
- Recommendation engine uses TemplateRepository.list() (backend query)
- Does NOT access template.optimization
- Boredom manager uses meta-template evolution
- Does NOT update optimization metadata

**Expected Behavior**:
```typescript
{
  usesTemplateRepositoryBackendQuery: true,
  doesNotAccessTemplateOptimization: true,
  boredomUsesMetaTemplateEvolution: true,
  boredomDoesNotUpdateMetadata: true
}
```

**Test Case Impulse**: `validation-backend-variant-tracking-optimization-architecture-case-6`

---

## Test Case Impulses

All test cases are stored as impulses for historical validation:

| Impulse ID | Stage | Description |
|------------|-------|-------------|
| `validation-backend-variant-tracking-optimization-architecture-case-1` | 1 | No OptimizationMetadata |
| `validation-backend-variant-tracking-optimization-architecture-case-2` | 2 | variant_id Present |
| `validation-backend-variant-tracking-optimization-architecture-case-3` | 3 | config_update Works |
| `validation-backend-variant-tracking-optimization-architecture-case-4` | 4 | Database Has Data |
| `validation-backend-variant-tracking-optimization-architecture-case-5` | 5 | activity_manager Has variant_id |
| `validation-backend-variant-tracking-optimization-architecture-case-6` | 6 | Recommendation Uses Backend |

---

## Harness Impulse

**Impulse ID**: `harness-backend-variant-tracking-optimization-architecture`  
**Type**: `file`  
**Pointer**: `tests/validation-harnesses/backend-variant-tracking-optimization-architecture-harness.ts`  
**Budget**: 2000 tokens  
**Content**: Complete validation harness implementation

This impulse enables downstream activities to:
- Reference the harness for validation
- Execute validation without LLM overhead
- Track validation history across runs

---

## Output Format

### Success Output

```
=== Backend Variant Tracking Optimization Architecture Validation ===

Stage 1: Checking OptimizationMetadata removal...
✅ OptimizationMetadata schema NOT FOUND (correct)
✅ OptimizationMetadata type NOT EXPORTED (correct)
✅ TaskSchema has NO optimization field (correct)
✅ Documentation explains external backend variant tracking

Stage 2: Checking variant_id field presence...
✅ variant_id field FOUND in ActivityExecutionData (template-metrics.ts)
✅ variant_id passed to reportExecution() in activity.ts

Stage 3: Checking config_update tool and MCP reload...
✅ config_update tool supports MCP section modification
✅ config_update tool supports reload parameter
✅ config_update supports add/remove/modify operations
✅ reload.ts implements MCP.reload() mechanism

Stage 4: Checking SurrealDB for execution data...
⏭️  Database check SKIPPED (checkDatabase=false)

Stage 5: Checking metabob-cli activity_manager.py...
✅ variant_id field FOUND in ActivityExecution dataclass
✅ Backend POST endpoint for executions FOUND
✅ Comment confirms Proto fields use snake_case (variant_id)

Stage 6: Checking recommendation queries backend...
✅ Recommendation engine uses TemplateRepository.list() (backend query)
✅ Recommendation engine does NOT access template.optimization (correct)
✅ Boredom manager uses meta-template evolution pattern
✅ Boredom manager does NOT update optimization metadata (correct)

=== ✅ ALL STAGES PASSED ===

Result: PASS ✅
```

### Failure Output

```
=== Backend Variant Tracking Optimization Architecture Validation ===

Stage 1: Checking OptimizationMetadata removal...
❌ OptimizationMetadataSchema FOUND (should be removed)
❌ TaskSchema HAS optimization field (should be removed)

...

=== ❌ SOME STAGES FAILED ===
Failed stages: stage1_noOptimizationMetadata, stage3_configUpdateWorks

Result: FAIL ❌
```

---

## Integration with Continuous Optimization Loop

This harness validates the architectural foundation for the continuous optimization loop:

```
┌─────────────────────────────────────────────────────────────────┐
│ Execute (variant_id tracked)                                    │
│ ✅ Stage 2: variant_id in ActivityExecutionData                 │
│ ✅ Stage 5: activity_manager.py forwards variant_id             │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Measure (backend receives data)                                 │
│ ✅ Stage 4: SurrealDB stores execution with variant_id          │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Recommend (query backend variant data)                          │
│ ✅ Stage 6: Recommendation uses TemplateRepository.list()       │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Evolve (create new variants)                                    │
│ ✅ Stage 6: Boredom uses meta-template evolution                │
│ ✅ Stage 1: No in-template optimization metadata                │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Repeat (live development iteration)                             │
│ ✅ Stage 3: config_update + MCP.reload() enable live dev        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Running the Harness

### Prerequisites

- Node.js installed
- TypeScript support (ts-node or compiled)
- Access to repository file system
- (Optional) SurrealDB running for Stage 4
- (Optional) metabob-cli running for MCP reload test

### Quick Start

```bash
# Navigate to validation harnesses directory
cd /home/avi/documents/work/exp-repo/metabob-devbob/tests/validation-harnesses

# Run with default settings (no database check)
npx ts-node -O '{"module":"commonjs"}' backend-variant-tracking-optimization-architecture-harness.ts

# Or use the wrapper script
./run-backend-variant-tracking-test.sh
```

### With Database Validation

```typescript
// Create a test script
import { runValidation } from './backend-variant-tracking-optimization-architecture-harness';

(async () => {
  const result = await runValidation({
    checkDatabase: true,
    surrealdbUrl: 'http://localhost:8000'
  });
  
  console.log(result.details.join('\n'));
  process.exit(result.pass ? 0 : 1);
})();
```

---

## Expected Results

### All Stages Enabled

When running with all validations enabled (`checkDatabase: true`, `skipMcpReloadTest: false`):

```typescript
{
  pass: true,
  actual: {
    stage1_noOptimizationMetadata: true,
    stage2_variantIdPresent: true,
    stage3_configUpdateWorks: true,
    stage4_databaseHasData: true,  // if activities ran
    stage5_activityManagerHasVariantId: true,
    stage6_recommendationUsesBackend: true
  },
  details: [...],
  errors: []
}
```

### Database Skipped

When running without database check (`checkDatabase: false`):

```typescript
{
  pass: true,
  actual: {
    stage1_noOptimizationMetadata: true,
    stage2_variantIdPresent: true,
    stage3_configUpdateWorks: true,
    stage4_databaseHasData: true,  // skipped = true
    stage5_activityManagerHasVariantId: true,
    stage6_recommendationUsesBackend: true
  }
}
```

---

## Troubleshooting

### Stage 1 Fails

**Issue**: OptimizationMetadata still exists

**Fix**: Remove OptimizationMetadataSchema and optimization field from TaskSchema in activity-template.ts

### Stage 2 Fails

**Issue**: variant_id field not found

**Fix**: Add variant_id field to ActivityExecutionData interface in template-metrics.ts

### Stage 3 Fails

**Issue**: config_update tool missing or incomplete

**Fix**: Ensure config-update.ts supports MCP section, reload parameter, and add/remove/modify operations

### Stage 4 Fails

**Issue**: Database not accessible

**Fix**: Start SurrealDB or set `checkDatabase: false` to skip this stage

### Stage 5 Fails

**Issue**: activity_manager.py missing variant_id

**Fix**: Add variant_id field to ActivityExecution dataclass

### Stage 6 Fails

**Issue**: Recommendation accesses template.optimization

**Fix**: Refactor recommendation-engine.ts to use TemplateRepository.list() instead of template metadata

---

## Maintenance

### Updating Test Cases

To update expected outputs:

1. Modify the test case impulse definition in `/tmp/validation-test-cases.json`
2. Update the corresponding stage check in the harness
3. Document the change in this file

### Adding New Stages

To add a new validation stage:

1. Create `stageN_checkSomething()` function
2. Add stage to `runValidation()` main function
3. Add test case impulse definition
4. Update documentation

---

## Related Files

- **Harness**: `tests/validation-harnesses/backend-variant-tracking-optimization-architecture-harness.ts`
- **Test Cases**: `/tmp/validation-test-cases.json`
- **Enforcement Report**: `ENFORCEMENT_BACKEND_VARIANT_TRACKING_OPTIMIZATION_ARCHITECTURE.md`
- **Trace Report**: `TRACE_BACKEND_VARIANT_TRACKING_OPTIMIZATION_ARCHITECTURE.md`
- **Specification**: Activity specification documents

---

## Metadata

**Specification**: backend-variant-tracking-optimization-architecture  
**Harness Type**: Multi-stage architectural validation  
**Total Stages**: 6  
**Optional Stages**: 1 (Stage 4 - database check)  
**Historical Test Cases**: 6 impulses  
**Harness Impulse**: harness-backend-variant-tracking-optimization-architecture  
**Budget**: 2000 tokens
