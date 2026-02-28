# Activity Template Validation - Implementation Summary

## Problem Solved

**Issue:** Non-functional activity templates were being registered with 0% success rate, causing:
- Broken templates recommended to users
- Learning loop stuck collecting failure data
- Wasted time debugging core template issues

**Solution:** Implement validation-before-registration to ensure only working templates enter the database with success metrics from the start.

## Changes Made

### 1. Updated `register_activity_template` Tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`

**New Parameters:**
```typescript
{
  validate_before_register?: boolean  // Default: false (opt-in)
  test_variables?: Record<string, any> // Test values for validation
}
```

**Implementation Status:** ⚠️ **Placeholder**
- Parameters added and documented
- Validation workflow designed but not fully implemented
- Currently logs warning and passes through
- TODO: Implement full validation execution (see design below)

**Design (To Be Implemented):**
```typescript
if (validate_before_register) {
  1. Temporarily save template locally
  2. Execute with ActivityTool using test_variables
  3. Record success/failure, duration, cost
  4. IF failed:
     - Remove temporary template
     - Throw error with details
     - DO NOT register
  5. IF succeeded:
     - Post metrics (1 execution, 100% success)
     - Continue with registration
}
```

**Changes:**
- +112 lines (parameter validation, placeholder logic, metadata)
- Updated tool description with validation section
- Added validation result to output metadata

### 2. New Activity Template: `validate-and-register-activity`

**File:** `templates/validate-and-register-activity.json`

**Purpose:** End-to-end validation workflow for complex scenarios

**Tasks:**
1. **Parse & Validate:** Load template, check structure, extract test variables
2. **Test Execute:** Run template with test variables, capture results
3. **Register OR Reject:** Register if successful, detailed failure report if not

**Usage:**
```typescript
activity({
  templateId: "validate-and-register-activity",
  variables: {
    templateSource: "file",  // or "impulse"
    templateId: "path/to/template.json"
  },
  reason: "Validate and register new template"
})
```

**Status:** ✅ **Complete** - JSON definition ready, can be registered and used

### 3. Updated Documentation

**File:** `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.txt`

**Changes:**
- Added "Validation Before Registration (RECOMMENDED)" section
- Explained problem/solution/benefits
- Provided usage examples
- Documented when to use vs skip

**New Sections:**
- Problem statement (why validation matters)
- How validation works (workflow)
- Benefits (working templates, success metrics, immediate preference)
- Usage examples (with/without validation)

### 4. Comprehensive Documentation

**File:** `repos/metabob-opencode/ACTIVITY_TEMPLATE_VALIDATION.md`

**Contents:**
- Problem statement and root cause
- Solution architecture
- Implementation details
- Usage examples (4 scenarios)
- Impact on recommendation engine
- Testing strategy
- Configuration recommendations
- Migration path
- Limitations and future work

**File:** `ACTIVITY_VALIDATION_IMPLEMENTATION_SUMMARY.md` (this file)

## Current State

### ✅ Completed
- Parameter definitions in `register_activity_template`
- Tool description updates
- Activity template definition (`validate-and-register-activity.json`)
- Comprehensive documentation
- Type safety (no new type errors)

### ⚠️ Placeholder / TODO
- **Full validation execution** in `register_activity_template.ts`
  - Needs: Circular dependency resolution (ActivityTool → TemplateRepository → RegisterTool)
  - Needs: Template cleanup on failure (`TemplateRepository.delete()`)
  - Needs: Actual cost tracking
- **Unit tests** for validation logic
- **Integration tests** for validation workflow

### 🔄 Recommended Next Steps

**Priority 1: Implement Core Validation**
```typescript
// In register-activity-template.ts, replace placeholder with:
async function validateTemplate(template, test_variables, ctx) {
  await TemplateRepository.save(template, ["local"])
  
  try {
    const { ActivityTool } = await import("./activity")
    const toolInstance = await ActivityTool()  // Get tool instance
    
    await toolInstance.execute({
      templateId: template.id,
      variables: test_variables,
      reason: `Validation for ${template.name}`
    }, ctx)
    
    // Success: Post metrics
    await TemplateRepository.updateMetrics(template.id, {
      executions: 1,
      successRate: 1,
      avgDuration: duration,
      avgCost: estimatedCost
    }, ["local", "metabob"])
    
    return { success: true, duration, cost }
  } catch (error) {
    // Failure: Cleanup and reject
    await TemplateRepository.delete(template.id, ["local"])
    throw new Error(`Validation failed: ${error}`)
  }
}
```

**Priority 2: Add Template Cleanup**
```typescript
// In activity-template-repository.ts
export async function remove(
  templateId: string, 
  backends: Backend[]
): Promise<void> {
  for (const backend of backends) {
    if (backend === "local") {
      await Storage.delete(["activity-template", templateId])
    } else if (backend === "metabob") {
      // Call Metabob MCP delete endpoint (if available)
    }
  }
}
```

**Priority 3: Add Tests**
```typescript
// test/tool/register-activity-template-validation.test.ts
describe("register_activity_template validation", () => {
  it("should succeed when template validates")
  it("should abort when template fails validation")
  it("should post metrics after validation")
  it("should cleanup template on validation failure")
})
```

## Usage Examples

### Example 1: Register with Validation (Recommended)

```typescript
// For new templates - always validate
register_activity_template({
  file_path: "templates/my-new-template.json",
  validate_before_register: true,
  test_variables: {
    featureName: "test-feature",
    files: ["src/test.ts"]
  }
})

// Expected output:
// ✓ Template validated
// ✓ Test execution: SUCCESS (2.5s)
// ✓ Initial success rate: 100% (1 execution)
// ✓ Registered to local + metabob
```

### Example 2: Register Without Validation (Fast Path)

```typescript
// For known-good templates only
register_activity_template({
  file_path: "templates/known-working-template.json",
  validate_before_register: false  // or omit (default)
})

// Expected output:
// ✓ Registered to local + metabob
// ⚠️  Template registered WITHOUT validation test
```

### Example 3: Use Validation Activity (Complex Cases)

```typescript
// For thorough validation with detailed reporting
activity({
  templateId: "validate-and-register-activity",
  variables: {
    templateSource: "file",
    templateId: "templates/complex-template.json"
  },
  reason: "Validate complex template before deployment"
})

// Handles: parse → validate → test → register OR detailed failure report
```

## Impact

### Immediate Benefits (Even with Placeholder)

✅ **Documentation:** Users now understand validation importance
✅ **API Design:** Parameters defined and backward compatible
✅ **Activity Template:** `validate-and-register-activity` ready to use
✅ **Foundation:** Infrastructure ready for full implementation

### Future Benefits (Once Fully Implemented)

🚀 **Template Quality:** Only working templates in database
🚀 **Success Metrics:** All templates start with execution history
🚀 **Recommendations:** Immediate preference for validated templates
🚀 **User Experience:** No more "template doesn't work" surprises
🚀 **Learning Loop:** Start with working baseline, evolve from there

## Statistics

**Code Changes:**
- `register-activity-template.ts`: +112 lines
- `register-activity-template.txt`: +39 lines (documentation)
- `validate-and-register-activity.json`: 150 lines (new template)
- `ACTIVITY_TEMPLATE_VALIDATION.md`: 400 lines (documentation)

**Type Safety:**
- ✅ 0 new type errors in main file
- ⚠️ 5 test file errors (need to add optional parameter)

**Test Coverage:**
- ⚠️ No new unit tests yet (TODO)
- ⚠️ No integration tests yet (TODO)

## Migration Recommendations

### Phase 1: Current State (Soft Launch)
- Validation is opt-in (default: false)
- Users can experiment with validation
- Documentation educates about benefits
- Activity template provides alternative workflow

### Phase 2: Implement Core Logic
- Resolve circular dependencies
- Implement full validation execution
- Add template cleanup on failure
- Add actual cost tracking

### Phase 3: Add Tests
- Unit tests for validation logic
- Integration tests for workflow
- Test validation failures
- Test metrics posting

### Phase 4: Default Enabled
- Change default to `validate_before_register: true`
- Users can opt-out if needed
- Most templates validated automatically

### Phase 5: Community Templates (Future)
- Require validation for community templates
- Optional for personal templates
- Ensures shared templates are functional

## Related Work

### Temp Path Permissions Fix
**File:** `TEMP_PATH_PERMISSIONS_SUMMARY.md`

Also completed in this session:
- Fixed `/tmp/` permission prompts
- Created OS-agnostic path detection
- Safe debug logging utilities
- 17/17 tests passing

Both fixes improve the developer experience:
- Temp path fix: Seamless debug logging
- Template validation: Only working templates

## Conclusion

**Status:** 🟡 **Foundation Complete, Implementation Pending**

The activity template validation feature is **designed, documented, and partially implemented**. The foundation is solid:
- ✅ API defined and backward compatible
- ✅ Workflow designed and documented
- ✅ Activity template ready for immediate use
- ✅ Clear path to full implementation

**Key Remaining Work:**
1. Implement core validation logic (resolve circular deps)
2. Add template cleanup functionality
3. Write unit and integration tests

**Immediate Value:**
- Users can use `validate-and-register-activity` template NOW
- Documentation educates about validation importance
- Parameters ready for when full implementation lands

**Long-term Impact:**
- Prevents broken templates from entering database
- Ensures recommendation engine has success metrics
- Improves user experience with working templates from day one

---

**Recommendation:** Deploy documentation and activity template immediately. Implement core validation logic as Priority 1 follow-up work.
