# Annotation Token Efficiency Design

**Problem**: Preventing excessive annotation token usage while keeping annotations up-to-date with changing intents, maintaining consistency of purpose.

**Date**: 2026-02-19  
**Status**: Design Proposal

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [The Token Efficiency Problem](#the-token-efficiency-problem)
3. [Multi-Layer Solution](#multi-layer-solution)
4. [Implementation Plan](#implementation-plan)

---

## Current System Analysis

### How Automatic Annotation Works Today

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (Line 2075)

```typescript
async function captureAnnotationsAutomatically(activity: Activity.Info) {
  // 1. Identify key components from changed files
  const components = await ActivityComplete.identifyKeyComponents(activity)
  
  // 2. Generate annotations for EVERY component
  await ActivityComplete.generateAnnotations(activity, components, {
    interactive: false,
    skipAnnotations: false,  // ← Always annotates
    skipPatterns: false
  })
}
```

### Current Behavior (Inefficient)

**Scenario**: File `auth.ts` is modified 3 times in 3 activities

| Activity | Intent | Current Behavior | Token Cost |
|----------|--------|------------------|------------|
| Activity 1 | "Add JWT auth" | Creates annotation | 500 tokens |
| Activity 2 | "Fix auth bug" | **Re-annotates entire file** | 500 tokens |
| Activity 3 | "Add OAuth" | **Re-annotates entire file again** | 500 tokens |
| **Total** | | | **1500 tokens** |

**Problems**:
1. ❌ **Redundant annotations**: Same component annotated multiple times
2. ❌ **No intent tracking**: Can't detect if purpose changed vs. minor tweak
3. ❌ **No incremental updates**: Entire annotation rewritten, not appended
4. ❌ **No deduplication**: Backend doesn't check for existing annotations

---

## The Token Efficiency Problem

### Three Scenarios to Handle

#### Scenario 1: **Intent Unchanged** (Most Common - 70%)
```
Activity 1: "Implement JWT authentication"
  → Annotate: "Uses JWT for stateless auth..."

Activity 2: "Fix JWT token expiry bug"  
  → Same intent, minor fix
  → Should: Skip or append mini-note
  → Currently: Re-annotates entire component (wasteful)
```

**Desired Behavior**: Skip or lightweight update (50 tokens vs. 500)

#### Scenario 2: **Intent Extended** (Common - 20%)
```
Activity 1: "Implement JWT authentication"
  → Annotate: "Uses JWT for stateless auth..."

Activity 3: "Add OAuth support to auth system"
  → Intent extended (JWT + OAuth now)
  → Should: Append new section to existing annotation
  → Currently: Overwrites with new annotation (loses JWT context)
```

**Desired Behavior**: Incremental append (200 tokens vs. 500)

#### Scenario 3: **Intent Changed** (Rare - 10%)
```
Activity 1: "Implement JWT authentication"
  → Annotate: "Uses JWT for stateless auth..."

Activity 10: "Replace JWT with session-based auth"
  → Intent fundamentally changed
  → Should: Create new annotation, archive old one
  → Currently: Overwrites (correct, but should version)
```

**Desired Behavior**: Version and replace (500 tokens, acceptable)

---

## Multi-Layer Solution

### Layer 1: Smart Component Change Detection

**Goal**: Only annotate components that meaningfully changed

```typescript
async function identifyComponentsNeedingAnnotation(
  activity: Activity.Info
): Promise<ComponentCandidate[]> {
  const changedComponents = await ActivityComplete.identifyKeyComponents(activity)
  
  const needsAnnotation: ComponentCandidate[] = []
  
  for (const component of changedComponents) {
    const decision = await shouldAnnotate(component, activity)
    
    if (decision.annotate) {
      needsAnnotation.push({
        ...component,
        annotationStrategy: decision.strategy, // "new" | "update" | "append"
        existingAnnotation: decision.existing
      })
    }
  }
  
  return needsAnnotation
}
```

#### Smart Detection Algorithm

```typescript
async function shouldAnnotate(
  component: ComponentCandidate,
  activity: Activity.Info
): Promise<AnnotationDecision> {
  
  // 1. Check if annotation exists
  const existing = await getExistingAnnotation(component.file, component.name)
  
  if (!existing) {
    return { annotate: true, strategy: "new", reason: "no existing annotation" }
  }
  
  // 2. Calculate semantic change score
  const changeScore = await calculateChangeSignificance(component, existing)
  
  // 3. Detect intent shift
  const intentShift = await detectIntentShift(
    activity.reason,           // Current intent
    existing.lastActivityReason // Previous intent
  )
  
  // 4. Decision logic
  if (changeScore < 0.1 && !intentShift) {
    // Trivial change, same intent → SKIP
    return { annotate: false, reason: "trivial change, same intent" }
  }
  
  if (changeScore < 0.3 && !intentShift) {
    // Minor change, same intent → APPEND
    return {
      annotate: true,
      strategy: "append",
      existing,
      reason: "minor change within same intent"
    }
  }
  
  if (intentShift) {
    // Intent changed → REPLACE with versioning
    return {
      annotate: true,
      strategy: "replace",
      existing,
      reason: "intent shift detected"
    }
  }
  
  // Default: UPDATE
  return {
    annotate: true,
    strategy: "update",
    existing,
    reason: "significant change"
  }
}
```

### Layer 2: Change Significance Calculation

```typescript
async function calculateChangeSignificance(
  component: ComponentCandidate,
  existing: Annotation
): Promise<number> {
  // Score 0.0-1.0 indicating significance
  
  let score = 0.0
  
  // Lines changed
  const lineChangeRatio = component.linesChanged / component.totalLines
  score += lineChangeRatio * 0.4  // 40% weight
  
  // AST structure changed?
  const astChanged = await hasASTStructureChanged(component)
  if (astChanged.methodsAdded || astChanged.methodsRemoved) {
    score += 0.3  // 30% weight
  }
  
  // Public interface changed?
  const interfaceChanged = await hasPublicInterfaceChanged(component)
  if (interfaceChanged) {
    score += 0.3  // 30% weight
  }
  
  // Time since last annotation (decay old annotations)
  const daysSinceAnnotation = (Date.now() - existing.timestamp) / (1000 * 60 * 60 * 24)
  if (daysSinceAnnotation > 30) {
    score += 0.1  // Increase likelihood if annotation is old
  }
  
  return Math.min(score, 1.0)
}
```

### Layer 3: Intent Shift Detection

```typescript
async function detectIntentShift(
  currentIntent: string,
  previousIntent: string | undefined
): Promise<boolean> {
  if (!previousIntent) return false
  
  // Use lightweight embedding similarity (avoid LLM call)
  const similarity = await computeCosineSimilarity(
    await embed(currentIntent),
    await embed(previousIntent)
  )
  
  // Threshold: < 0.7 = different intent
  return similarity < 0.7
}
```

**Optimization**: Cache embeddings in activity metadata to avoid recomputing

### Layer 4: Annotation Strategies

#### Strategy 1: NEW (Full annotation)
```typescript
async function createNewAnnotation(component, activity) {
  return {
    component: component.name,
    type: component.type,
    reason: await generateFullAnnotation(component, activity),
    activityId: activity.id,
    timestamp: Date.now()
  }
}
```
**Cost**: 500 tokens (full generation)

#### Strategy 2: APPEND (Incremental)
```typescript
async function appendToAnnotation(component, activity, existing) {
  const delta = await generateAnnotationDelta(component, activity, existing)
  
  return {
    ...existing,
    reason: existing.reason + "\n\n" + delta,
    lastModified: activity.id,
    timestamp: Date.now(),
    history: [...(existing.history || []), {
      activityId: activity.id,
      reason: delta,
      timestamp: Date.now()
    }]
  }
}
```
**Cost**: 150 tokens (delta generation only)

#### Strategy 3: UPDATE (Merge)
```typescript
async function updateAnnotation(component, activity, existing) {
  const merged = await mergeAnnotations(
    existing.reason,
    await generateFullAnnotation(component, activity)
  )
  
  return {
    ...existing,
    reason: merged,
    lastModified: activity.id,
    timestamp: Date.now()
  }
}
```
**Cost**: 300 tokens (merge operation)

#### Strategy 4: REPLACE (Versioned)
```typescript
async function replaceAnnotation(component, activity, existing) {
  // Archive old annotation
  await archiveAnnotation(existing)
  
  // Create new annotation
  return {
    component: component.name,
    type: component.type,
    reason: await generateFullAnnotation(component, activity),
    activityId: activity.id,
    timestamp: Date.now(),
    previousVersion: existing.id,
    replacementReason: "Intent shift detected"
  }
}
```
**Cost**: 500 tokens (full generation, but versioned)

### Layer 5: Configuration & Tuning

**`opencode.json`**:
```jsonc
{
  "activities": {
    "automaticAnnotations": true,
    
    // Token efficiency settings
    "annotationStrategy": {
      "skipThreshold": 0.1,        // Score below this: skip
      "appendThreshold": 0.3,       // Score below this: append
      "updateThreshold": 0.6,       // Score below this: update
      "intentShiftThreshold": 0.7,  // Similarity below this: intent shift
      
      "maxAnnotationsPerActivity": 5,  // Top N components only
      "minDaysBetweenReannotations": 7, // Don't re-annotate if < 7 days
      
      "strategies": {
        "new": { enabled: true, maxTokens: 500 },
        "append": { enabled: true, maxTokens: 150 },
        "update": { enabled: true, maxTokens: 300 },
        "replace": { enabled: true, maxTokens: 500, archiveOld: true }
      }
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Annotation Metadata Storage (2-3 hours)

**Goal**: Store annotation metadata to enable deduplication

**Tasks**:
1. Add annotation metadata to Metabob backend:
   ```python
   class AnnotationMetadata:
       component_id: str
       file_path: str
       component_name: str
       last_activity_id: str
       last_activity_reason: str
       timestamp: int
       token_cost: int
       change_history: List[AnnotationChange]
   ```

2. Implement `getExistingAnnotation()` API call
3. Store metadata when annotations are created

**Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/tools/annotate_component.py`
- Add metadata storage to annotation handler

### Phase 2: Change Significance Calculation (3-4 hours)

**Goal**: Implement smart detection of whether re-annotation is needed

**Tasks**:
1. Implement `calculateChangeSignificance()`:
   - Line change ratio
   - AST structure change detection (use tree-sitter)
   - Public interface change detection
   - Time decay

2. Implement `detectIntentShift()`:
   - Use sentence embeddings (sentence-transformers)
   - Cosine similarity threshold

3. Implement `shouldAnnotate()` decision logic

**Files**:
- `repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts`
- New file: `annotation-strategy.ts`

### Phase 3: Annotation Strategies (4-5 hours)

**Goal**: Implement APPEND, UPDATE, REPLACE strategies

**Tasks**:
1. Implement `generateAnnotationDelta()` for append
2. Implement `mergeAnnotations()` for update
3. Implement `archiveAnnotation()` for replace
4. Modify `generateAnnotations()` to use strategies

**Files**:
- `repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts`
- Metabob backend annotation handler

### Phase 4: Configuration & Testing (2-3 hours)

**Goal**: Make system configurable and test token savings

**Tasks**:
1. Add configuration schema to `opencode.json`
2. Load configuration in activity execution
3. Create test suite:
   - Test trivial change → skip
   - Test minor change → append
   - Test intent shift → replace
4. Measure token savings on real activities

**Files**:
- Configuration loader
- Test files

### Phase 5: Monitoring & Metrics (2-3 hours)

**Goal**: Track token savings and annotation quality

**Tasks**:
1. Add metrics:
   - Annotations skipped
   - Annotations appended vs. full
   - Token savings (actual vs. baseline)
   - Annotation freshness
2. Dashboard showing token efficiency
3. Learning loop: adjust thresholds based on data

**Files**:
- Metrics collection
- Dashboard (if exists)

---

## Expected Results

### Token Savings Estimation

**Baseline** (Current System):
- 100 activities
- Average 3 components changed per activity
- 500 tokens per annotation
- **Total**: 150,000 tokens

**With Smart System**:
- 30% changes are trivial → **skip** (0 tokens)
- 40% changes are minor → **append** (150 tokens)
- 20% changes are medium → **update** (300 tokens)
- 10% changes are major → **new/replace** (500 tokens)

**Calculation**:
```
Trivial (30%):  90 annotations × 0 tokens = 0
Minor (40%):   120 annotations × 150 tokens = 18,000
Medium (20%):   60 annotations × 300 tokens = 18,000
Major (10%):    30 annotations × 500 tokens = 15,000
-------------------------------------------------------
Total: 51,000 tokens (66% savings!)
```

### Quality Improvements

1. **Consistency**: Incremental updates preserve context
2. **Intent Tracking**: Versioning shows evolution
3. **Reduced Noise**: Skip redundant re-annotations
4. **Better Context**: Append adds to history rather than replacing

---

## Risks & Mitigations

### Risk 1: False Negatives (Missing Important Changes)

**Risk**: System skips annotation when it should have updated

**Mitigation**:
- Conservative thresholds initially (tune later)
- Manual review option in interactive mode
- Metrics tracking annotation quality

### Risk 2: Intent Detection Accuracy

**Risk**: Intent shift detection is wrong (embeddings not perfect)

**Mitigation**:
- Allow manual override
- Log all skip decisions for audit
- Use multiple signals (not just embeddings)

### Risk 3: Complexity

**Risk**: System becomes too complex to maintain

**Mitigation**:
- Clear separation of concerns (layers)
- Extensive testing
- Configuration allows disabling features

---

## Future Enhancements

### Enhancement 1: Cross-File Intent Tracking

Track intent across multiple files in same activity:
- "Refactor auth across 5 files" → annotate once, link others

### Enhancement 2: Pattern-Based Annotations

Learn common patterns and auto-annotate:
- "Added REST endpoint" → template annotation
- "Fixed typo" → minimal annotation

### Enhancement 3: Collaborative Annotation

Multiple agents contribute to same annotation:
- Agent A: Implementation details
- Agent B: Testing considerations
- Agent C: Performance notes

---

## Summary

**Problem**: Automatic annotations waste tokens by re-annotating unchanged components

**Solution**: Multi-layer smart detection + incremental strategies

**Expected Savings**: 60-70% token reduction

**Implementation Time**: 13-18 hours

**Trade-offs**: Complexity vs. efficiency (worth it for 66% savings)

**Recommendation**: Implement in phases, measure token savings at each phase
