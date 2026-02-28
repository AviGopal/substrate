# Ripple-Change Architecture: Active Data Flow Management

**Vision:** Activities that intelligently propagate changes through execution paths in the codebase, maintaining consistency across data transformations, validations, and boundaries.

---

## Core Concept

When you modify one point in a data flow (e.g., add a field, change validation, modify transformation), the change needs to **ripple** through the entire execution path:

```
Entry Point → Validation → Transformation → Business Logic → Persistence → Response
     ↓            ↓              ↓                 ↓              ↓           ↓
  [CHANGE]    [UPDATE]       [UPDATE]          [UPDATE]       [UPDATE]   [UPDATE]
```

**Problem:** Manual propagation is error-prone, incomplete, and time-consuming.

**Solution:** Activity templates that use traced data flows to automatically identify and update all affected components.

---

## Use Cases

### 1. **Add Field to Data Flow**
**Scenario:** Add `userId` field to activity execution pipeline

**Ripple Path:**
1. Entry: ActivityTool.execute → Add to input schema
2. Validation: validateTemplateVariables → Add to required fields
3. Transform: interpolatePrompt → Add variable support
4. Storage: Activity.save → Add to database schema
5. Response: ActivityResult → Add to output type
6. Tests: Add test cases for new field
7. Docs: Update API documentation

**Activity:** `propagate-field-addition`

### 2. **Change Data Type**
**Scenario:** Change `templateId` from string to object `{id, version}`

**Ripple Path:**
1. Trace all uses of `templateId` in flow
2. Update type definitions at each boundary
3. Modify transformations that parse/serialize
4. Update validation rules
5. Migrate existing data
6. Update tests and docs

**Activity:** `propagate-type-change`

### 3. **Add Validation Rule**
**Scenario:** Add budget check before activity execution

**Ripple Path:**
1. Entry: Add validation before template loading
2. Error handling: Add new error type `BudgetExceededError`
3. Response: Add budget info to error response
4. Logging: Add budget metrics
5. Tests: Add budget validation tests
6. Docs: Document budget limits

**Activity:** `propagate-validation-rule`

### 4. **Refactor Transformation**
**Scenario:** Split `interpolatePrompt` into `resolveVariables + formatTemplate`

**Ripple Path:**
1. Create new components with clear boundaries
2. Update callers to use new interface
3. Preserve backward compatibility
4. Add deprecation warnings
5. Update tests
6. Document migration path

**Activity:** `refactor-transformation-layer`

### 5. **Add Cross-Cutting Concern**
**Scenario:** Add distributed tracing to activity execution

**Ripple Path:**
1. Identify all components in flow
2. Add trace context at entry
3. Propagate context through transformations
4. Emit spans at boundaries
5. Add trace IDs to logs
6. Update observability docs

**Activity:** `add-cross-cutting-concern`

---

## Activity Templates

### Template 1: `propagate-change-through-flow`

**Purpose:** General-purpose change propagation using traced flows

**Variables:**
- `featureName` - Feature containing the flow (uses existing trace)
- `changeType` - addField | changeType | addValidation | refactor
- `changeDescription` - What's being changed
- `startingPoint` - Component where change originates

**Tasks:**
1. **Load traced flow** - Read existing flow documentation
2. **Identify impact points** - Use CPG to find all components in path
3. **Analyze change requirements** - Determine what needs updating at each point
4. **Generate change plan** - Create ordered list of modifications
5. **Apply changes with validation** - Modify code, run tests after each change
6. **Update flow documentation** - Regenerate flow docs with changes
7. **Create migration guide** - Document what changed and why

**Quality Gates:**
- All tests pass after each modification
- No HIGH metabob issues introduced
- Flow documentation updated
- Co-change files reviewed (metabob_suggest_related_changes)

---

### Template 2: `validate-flow-integrity`

**Purpose:** Verify data flow consistency after changes

**Variables:**
- `featureName` - Feature to validate
- `expectedInputType` - Expected input schema
- `expectedOutputType` - Expected output schema

**Tasks:**
1. **Trace current flow** - Re-run trace-data-flow-single-feature
2. **Compare with previous** - Diff against last known good state
3. **Type check transformations** - Verify type safety at each boundary
4. **Validate contracts** - Check API/service contracts haven't broken
5. **Test critical paths** - Run integration tests on flow
6. **Check for regressions** - Search for related bugs (metabob)
7. **Generate integrity report** - Document validation results

**Quality Gates:**
- Input/output types match expectations
- All transformations preserve type safety
- No contract violations detected
- All integration tests pass

---

### Template 3: `refactor-transformation-layer`

**Purpose:** Safely refactor a transformation while maintaining flow integrity

**Variables:**
- `transformationComponent` - Component to refactor (e.g., "interpolatePrompt")
- `refactorReason` - Why refactoring (performance, clarity, etc.)
- `targetPattern` - Desired pattern after refactor

**Tasks:**
1. **Analyze current transformation** - Document inputs, outputs, side effects
2. **Identify all callers** - Use metabob_analyze_change_impact
3. **Design new interface** - Create improved API
4. **Implement with tests** - Build new version alongside old
5. **Migrate callers incrementally** - Update one caller at a time
6. **Add deprecation warnings** - Warn about old API
7. **Remove old implementation** - After all callers migrated
8. **Update flow docs** - Regenerate documentation

**Quality Gates:**
- All callers migrated successfully
- Test coverage maintained or improved
- Performance metrics maintained or improved
- Flow integrity validated

---

### Template 4: `add-field-to-flow`

**Purpose:** Add a new field through an entire data flow (specialized)

**Variables:**
- `featureName` - Feature containing the flow
- `fieldName` - Name of new field
- `fieldType` - Type (string, number, object, etc.)
- `fieldPurpose` - Why adding this field
- `defaultValue` - Default for existing data (optional)
- `required` - Is field required? (boolean)

**Tasks:**
1. **Load traced flow** - Get existing flow documentation
2. **Identify schema locations** - Find all type definitions in flow
3. **Update input schema** - Add field to entry point
4. **Propagate through transformations** - Modify each transformation
5. **Update persistence layer** - Add to database/storage schema
6. **Add validation** - Validate field at boundaries
7. **Migrate existing data** - Apply default value if needed
8. **Update output schema** - Add to response type
9. **Generate tests** - Create test cases for new field
10. **Update documentation** - Regenerate flow docs + API docs

**Quality Gates:**
- Field present in all schemas
- Validation added at entry point
- Tests cover new field
- Migration script tested (if needed)

---

### Template 5: `add-cross-cutting-concern`

**Purpose:** Add a cross-cutting concern (logging, metrics, tracing) to a flow

**Variables:**
- `featureName` - Feature containing the flow
- `concernType` - logging | metrics | tracing | caching | security
- `concernConfig` - Configuration (e.g., trace context fields)

**Tasks:**
1. **Load traced flow** - Get existing flow documentation
2. **Identify injection points** - Where to add concern (entry, boundaries, exit)
3. **Design concern interface** - How concern integrates with existing code
4. **Implement concern logic** - Create concern implementation
5. **Inject at entry point** - Initialize concern at flow start
6. **Propagate through boundaries** - Pass context through transformations
7. **Emit at exit points** - Finalize concern at flow end
8. **Add tests** - Verify concern works correctly
9. **Update observability docs** - Document new metrics/logs/traces

**Quality Gates:**
- Concern present at all injection points
- Context propagates correctly
- No performance regression
- Observability documentation updated

---

## CPG Integration: The Secret Sauce

### Why CPG is Critical

CPG (Code Property Graph) enables **intelligent change propagation**:

1. **Dependency Analysis** - `metabob_analyze_change_impact`
   - Find all components that depend on changed component
   - Understand blast radius before making changes
   - Identify hidden dependencies

2. **Co-change Patterns** - `metabob_suggest_related_changes`
   - Files that historically change together
   - Prevents forgetting related updates
   - Ensures consistency across related components

3. **Component Discovery** - `metabob_list_file_components`
   - Find exact component names for modification
   - Understand component structure
   - Navigate large files efficiently

4. **Safety Analysis** - `metabob_assess_deletion_safety`
   - Before removing old code after refactor
   - Verify no hidden references exist
   - Prevent breaking changes

### Workflow Integration

```
1. Trace Flow (trace-data-flow-single-feature)
   ↓
2. Plan Change (analyze impact with CPG)
   ↓
3. Execute Change (propagate-change-through-flow)
   │
   ├─→ For each component in flow:
   │   ├─→ metabob_list_file_components (find exact component)
   │   ├─→ metabob_analyze_change_impact (check dependencies)
   │   ├─→ Modify component
   │   ├─→ metabob_annotate_component (document change)
   │   └─→ Run tests
   │
   ↓
4. Validate Integrity (validate-flow-integrity)
   ↓
5. Check Related Changes (metabob_suggest_related_changes)
   ↓
6. Regenerate Flow Docs (trace-data-flow-single-feature)
```

---

## Data Flow as Living Documentation

### Before: Static Documentation

```
// Docs say: "Activity execution has 3 phases"
// Reality: Code has 5 phases, docs outdated
```

### After: Living Documentation

```
1. Flow traced → Documentation generated
2. Change made → Flow re-traced → Docs regenerated
3. Docs always match reality
4. Changes tracked in git history
```

### Versioned Flow Documentation

```
docs/data-flows/
  activity-execution-pipeline-flow.md       (current)
  activity-execution-pipeline-flow-v2.md    (after adding budget checks)
  activity-execution-pipeline-flow-v3.md    (after adding tracing)
```

**Benefits:**
- See how flow evolved over time
- Compare before/after refactoring
- Understand impact of changes
- Rollback documentation with code

---

## Example: Add Budget Validation to Activity Execution

### Manual Approach (Old Way)
1. Add budget field to ActivityTool.execute ✓
2. Forget to validate budget → Bug
3. Add budget to Activity.save ✓
4. Forget to pass budget to executor → Bug
5. Add budget check in executor ✓
6. Forget to update tests → Tests pass but feature broken
7. Forget to update docs → Users confused
8. **Result:** 3 bugs, incomplete implementation, 4+ hours

### Activity-Driven Approach (New Way)

```bash
activity trace-data-flow-single-feature featureName="activity execution pipeline"
# → Generates flow documentation

activity propagate-change-through-flow \
  featureName="activity execution pipeline" \
  changeType="addField" \
  changeDescription="Add budget validation to prevent runaway costs" \
  fieldName="maxBudget" \
  fieldType="number" \
  required="false" \
  defaultValue="10.0"
```

**Activity automatically:**
1. ✓ Adds `maxBudget` to ActivityTool input schema
2. ✓ Adds validation in pre-flight checks
3. ✓ Passes budget to ActivityExecutor
4. ✓ Adds budget tracking in task execution
5. ✓ Throws BudgetExceededError when limit hit
6. ✓ Updates Activity.save to persist budget
7. ✓ Adds tests for budget validation
8. ✓ Updates flow documentation
9. ✓ Annotates components with budget logic
10. ✓ Suggests related changes (cost tracking?)

**Result:** Complete implementation, 0 bugs, 30 minutes

---

## Advanced Patterns

### Pattern 1: Cascading Changes

**Scenario:** Change in one flow affects multiple downstream flows

```
Activity Execution Flow
  ↓ (uses)
Template Loading Flow
  ↓ (uses)
Variable Validation Flow
```

**Solution:** `propagate-cascading-change`
- Trace all flows that depend on changed component
- Generate change plan for each flow
- Execute changes in dependency order
- Validate integrity of all affected flows

### Pattern 2: Parallel Flow Synchronization

**Scenario:** Two flows handle same data differently (drift)

```
Activity Execution Flow: validates variables with Zod
CLI Command Flow: validates variables with manual checks (DRIFT!)
```

**Solution:** `synchronize-parallel-flows`
- Trace both flows
- Compare transformation logic
- Identify differences
- Propose unified approach
- Apply to both flows

### Pattern 3: Flow Composition

**Scenario:** Build new flow from parts of existing flows

```
New Flow: Activity Replay
  = Activity Loading (from Activity Execution Flow)
  + State Restoration (new)
  + Task Execution (from Activity Execution Flow, starting at specific task)
```

**Solution:** `compose-flow-from-parts`
- Extract reusable segments from traced flows
- Identify common patterns
- Generate new flow combining segments
- Validate composed flow integrity

---

## Metrics & Observability

### Track Flow Health

**Per-Flow Metrics:**
- Modification count (how often changed)
- Integrity score (type safety, contract adherence)
- Test coverage (% of flow covered by tests)
- Issue density (metabob issues per component)
- Documentation freshness (last traced vs last modified)

**System-Wide Metrics:**
- Total flows traced
- Average integrity score
- Change propagation success rate
- Time saved vs manual approach

### Alerts

**Integrity Alerts:**
- "Activity Execution Flow modified but not re-traced" → Run trace
- "Type mismatch detected in transformation" → Run validate-flow-integrity
- "Co-change file modified but not reviewed" → Run metabob_suggest_related_changes

---

## Next Steps

### Immediate: Build Core Templates

1. **propagate-change-through-flow** (general-purpose ripple)
2. **validate-flow-integrity** (verify consistency)
3. **add-field-to-flow** (specialized, common use case)

### Test on Real Scenarios

1. Add budget validation to activity execution
2. Add tracing to activity execution
3. Refactor variable interpolation logic

### Build Meta-Activity

Create `auto-maintain-flows` that:
- Watches for code changes
- Detects flow modifications
- Auto-runs validate-flow-integrity
- Suggests re-tracing if drift detected
- Proposes updates to maintain consistency

---

## Success Criteria

**We'll know this works when:**

1. ✅ Adding a field takes 30 min instead of 4 hours
2. ✅ Zero drift between code and documentation
3. ✅ Refactoring is safe and systematic
4. ✅ New developers can modify flows confidently
5. ✅ Flow integrity violations caught in CI
6. ✅ Related changes never forgotten

**Ultimate Goal:** Codebase that evolves cleanly through **activity-driven flow management** instead of ad-hoc manual changes.

---

**Next Action:** Create `propagate-change-through-flow` template and test on adding budget validation to activity execution pipeline.
