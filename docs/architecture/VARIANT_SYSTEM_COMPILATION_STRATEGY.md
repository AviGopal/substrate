# Variant System & Genealogy for Workflow Compilation

## Key Correction

**Original**: Replace activities with compiled versions
**Correct**: Create variants with genealogy tracking, use Thompson Sampling for continuous rollout

## Variant Naming Convention

Instead of replacing `add-feature-complete`, create variants:

```
add-feature-complete                    (v1.0.0 - base)
add-feature-complete-optimized          (v1.1.0 - pattern learned)
add-feature-complete-compiled           (v2.0.0 - workflow compiled)
add-feature-complete-compiled-mini      (v2.1.0 - model downgraded)
```

## Genealogy Tracking

Each variant tracks its lineage:

```json
{
  "id": "add-feature-complete-compiled",
  "genealogy": {
    "parent": "add-feature-complete-optimized@1.1.0",
    "lineage": ["add-feature-complete", "...-optimized", "...-compiled"],
    "createdBy": "workflow-compiler",
    "derivedFrom": {
      "executions": 100,
      "pattern": { "coverage": 0.80 }
    }
  }
}
```

## Thompson Sampling Selection

At runtime, Thompson Sampling selects best variant:

```typescript
// User requests: "add-feature-complete"
const variant = thompsonSampling([
  { id: "add-feature-complete", alpha: 92, beta: 8 },
  { id: "...-optimized", alpha: 47, beta: 3 },
  { id: "...-compiled", alpha: 38, beta: 2 }
])
// Returns: compiled variant (80% of time)
```

## Continuous Rollout

**Week 1**: Base template only
**Week 4**: Optimized variant created (10% traffic)
**Week 8**: Optimized proves better (70% traffic)
**Week 12**: Compiled variant created (10% traffic)
**Week 20**: Compiled dominates (80% traffic)

All variants coexist, no breaking changes.

## Benefits

1. **No replacement**: Original always works
2. **Data-driven**: Thompson Sampling picks winners
3. **Graceful fallback**: Variants delegate to parent
4. **Continuous improvement**: New variants anytime
5. **Observability**: Track genealogy and performance

## Implementation

### Phase 1: Variant Infrastructure
- Registration system
- Genealogy schema
- Thompson Sampling selector

### Phase 2: Pattern Recognition → Variant Creation
- Create optimized variants (not replacements)

### Phase 3: Workflow Compilation → Variant Creation
- Create compiled variants with fallback

### Phase 4: Thompson Sampling Integration
- Automatic selection
- Performance feedback
- Promotion system

See: SELF_IMPROVING_SYSTEM_VISION.md for full architecture
