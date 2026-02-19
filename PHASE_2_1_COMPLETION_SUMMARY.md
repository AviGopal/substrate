# Phase 2.1 Complete: A/B Testing Schema Extension

## Summary

**Status**: ✅ **COMPLETE**
**Date**: 2026-02-18
**Duration**: ~2 hours
**TypeScript Compilation**: ✅ All 11 packages passing

## What Was Accomplished

Successfully extended the Activity Template schema with A/B testing fields to support template variant testing and traffic splitting.

### 1. Core Schema Extension ✅

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

Added four new fields to `ActivityTemplate.Schema`:

```typescript
// A/B Testing Fields
status: z.enum(["stable", "candidate", "archived", "deprecated"])
  .describe("Template lifecycle status for A/B testing"),
stableVariantId: z.string().optional()
  .describe("ID of stable template (only for candidates)"),
candidateIds: z.array(z.string())
  .describe("IDs of candidate templates (only for stable)"),
allocationWeight: z.number().min(0).max(1)
  .describe("Traffic allocation weight (0.0-1.0)"),
```

### 2. CreateOptions Schema ✅

Made A/B fields optional in template creation:
- All fields optional with type-safe defaults
- Defaults applied in `initializeTemplateSchema()`
- Backward compatible with existing template creation code

### 3. Template Initialization ✅

Updated `initializeTemplateSchema()` function:
- Sets sensible defaults for all A/B fields
- `status: "stable"` (default for new templates)
- `candidateIds: []` (empty candidate list)
- `allocationWeight: 1.0` (100% traffic allocation)
- `stableVariantId: undefined` (not a candidate by default)

### 4. Type System Updates ✅

Updated related interfaces and adapters:

**OpenCodeTemplate Interface** (`activity-schema-adapter.ts`):
```typescript
export interface OpenCodeTemplate {
  // ... existing fields
  status: "stable" | "candidate" | "archived" | "deprecated"
  stableVariantId?: string
  candidateIds: string[]
  allocationWeight: number
  // ... rest of fields
}
```

### 5. Bootstrap Templates ✅

Updated `bootstrap-templates.ts` to include A/B fields with defaults for templates loaded from protocol buffers.

### 6. Test Infrastructure ✅

Fixed 38+ test files to include new required fields:
- Test helper functions updated (`test/helpers/template-helpers.ts`)
- Integration tests updated
- Unit tests updated
- All inline template definitions fixed

## Field Semantics

### `status` Field
- **"stable"**: Production template receiving traffic
- **"candidate"**: Test variant being evaluated
- **"archived"**: Historical template (no longer active)
- **"deprecated"**: Obsolete template (to be removed)

### `stableVariantId` Field
- Only set when `status = "candidate"`
- Points to the stable template being tested against
- Used for metrics comparison

### `candidateIds` Field
- Only populated when `status = "stable"`
- Lists all active candidate variants
- Used for traffic splitting

### `allocationWeight` Field
- Range: 0.0 - 1.0
- For stable: typically 1.0 (baseline)
- For candidates: typically 0.1 (10% traffic split)
- Used by selector for probabilistic routing

## Files Modified

1. `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts` (core schema)
2. `repos/metabob-opencode/packages/opencode/src/session/activity-schema-adapter.ts` (interface)
3. `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts` (bootstrap)
4. `repos/metabob-opencode/packages/opencode/test/helpers/template-helpers.ts` (test helper)
5. Multiple test files (38+ locations fixed)

## Verification

### TypeScript Compilation ✅
```bash
npm run typecheck
# Result: 11 successful, 11 total (192ms FULL TURBO)
```

### Backward Compatibility ✅
- Existing templates load correctly with defaults
- Template creation API unchanged (fields optional)
- No breaking changes to existing code

## Next Steps

### Phase 2.2: Template Selector (Next 3-4 hours)

Create `template-selector.ts` with:
```typescript
class TemplateSelector {
  // Probabilistic template selection
  async selectTemplate(baseId: string): Promise<string>
  
  // 90/10 traffic split based on allocationWeight
  // Fallback to stable on candidate errors
  // Metrics tracking per selection
}
```

**Key Features**:
- Weighted random selection (stable vs candidates)
- Fallback mechanism (candidate errors → stable)
- Selection metrics (per template variant)
- Integration with existing activity execution

### Phase 2.3: Metrics Aggregation (2 hours)

Extend analysis or create new aggregator:
- Real-time success rate calculation per variant
- Cost/duration tracking per variant
- Statistical comparison (stable vs candidates)
- Integration with executionEvidence

### Phase 3: Promotion Engine (2 days)

Statistical evaluation and promotion:
```typescript
interface PromotionEngine {
  evaluateCandidate(candidateId, stableId): DecisionRecommendation
  promoteToStable(candidateId): void
  pruneCandidate(candidateId): void
}
```

**Statistical Tests**:
- Chi-square test for significance
- Minimum sample size requirements
- Confidence intervals
- Type I/II error controls

## Design Decisions

### 1. Schema Defaults
**Decision**: Remove `.default()` from Zod schema, apply in `initializeTemplateSchema()`
**Rationale**: Allows schema to require fields while CreateOptions makes them optional

### 2. Allocation Weight
**Decision**: 0.0-1.0 range instead of percentages
**Rationale**: Standard probability range, easier for weighted random selection

### 3. Status Enum
**Decision**: Four states (stable, candidate, archived, deprecated)
**Rationale**: Clear lifecycle, supports future archival features

### 4. Bidirectional References
**Decision**: Stable → candidateIds[], Candidate → stableVariantId
**Rationale**: Easy navigation both ways, efficient queries

## Success Metrics

✅ **TypeScript Compilation**: 100% passing
✅ **Backward Compatibility**: No breaking changes
✅ **Test Coverage**: All tests updated and passing
✅ **Documentation**: Field semantics clearly defined
✅ **Time to Implementation**: ~2 hours (on target)

## Estimated Remaining Time

- **Phase 2.2** (Template Selector): 3-4 hours
- **Phase 2.3** (Metrics Aggregation): 2 hours
- **Phase 3** (Promotion Engine): 2 days

**Total Remaining**: ~1.5 weeks

## Notes

- Evidence collection system already working (70%+ success rate)
- Gap is template quality (0% success), NOT metrics recording
- A/B testing will help improve template quality iteratively
- Statistical rigor is critical for promotion decisions

---

**Phase 2.1**: ✅ **COMPLETE** - Ready for Phase 2.2 (Template Selector)
