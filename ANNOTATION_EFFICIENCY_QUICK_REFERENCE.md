# Annotation Token Efficiency - Quick Reference

## The Problem

**Current System**: Re-annotates EVERY component on EVERY change
- File modified 3 times = 3 full annotations = 1500 tokens
- **66% wasted tokens** on redundant annotations

## The Solution: Smart Annotation Strategies

### Decision Matrix

| Scenario | Change Score | Intent Shift? | Strategy | Token Cost | Example |
|----------|-------------|---------------|----------|------------|---------|
| **Typo fix** | <0.1 | No | **SKIP** | 0 | Fix variable name typo |
| **Bug fix** | 0.1-0.3 | No | **APPEND** | 150 | Fix off-by-one error |
| **Feature addition** | 0.3-0.6 | No | **UPDATE** | 300 | Add new method to class |
| **Major refactor** | >0.6 | Yes | **REPLACE** | 500 | Rewrite algorithm |

### Token Savings

**Before**: 100 activities × 3 components × 500 tokens = **150,000 tokens**

**After**:
- 30% SKIP → 0 tokens
- 40% APPEND → 18,000 tokens  
- 20% UPDATE → 18,000 tokens
- 10% REPLACE → 15,000 tokens
- **Total**: **51,000 tokens (66% savings!)**

## Key Techniques

### 1. Change Significance Scoring
```typescript
score = lineChangeRatio * 0.4        // How much code changed
      + astStructureChange * 0.3     // Method added/removed?
      + publicInterfaceChange * 0.3  // API changed?
      + timeSinceLastAnnotation * 0.1 // Older = more likely to update
```

### 2. Intent Shift Detection
```typescript
// Compare activity reasons using embeddings
similarity = cosineSimilarity(
  embed(currentActivity.reason),
  embed(previousActivity.reason)
)

intentShifted = similarity < 0.7  // 70% threshold
```

### 3. Annotation Strategies

**SKIP** (0 tokens):
```
✓ Trivial change (rename, typo, comment)
✓ Same intent
✓ < 10% lines changed
```

**APPEND** (150 tokens):
```typescript
existing.reason += "\n\nUpdate (Activity 47): Fixed token expiry bug"
// Preserves history, adds mini-note
```

**UPDATE** (300 tokens):
```typescript
merged = merge(existing, newAnnotation)
// Intelligent merge of old + new context
```

**REPLACE** (500 tokens):
```typescript
archiveAnnotation(existing)
createNew(component, "Intent changed: JWT → OAuth")
// Version and replace
```

## Configuration

```jsonc
// opencode.json
{
  "activities": {
    "annotationStrategy": {
      "skipThreshold": 0.1,        // Below this: skip
      "appendThreshold": 0.3,      // Below this: append
      "updateThreshold": 0.6,      // Below this: update
      "intentShiftThreshold": 0.7, // Similarity < this: intent shift
      
      "minDaysBetweenReannotations": 7  // Don't re-annotate within 7 days
    }
  }
}
```

## Implementation Phases

1. **Phase 1**: Annotation metadata storage (2-3h)
   - Store last activity, timestamp, token cost
   
2. **Phase 2**: Change significance calculation (3-4h)
   - Implement scoring algorithm
   
3. **Phase 3**: Annotation strategies (4-5h)
   - Implement APPEND, UPDATE, REPLACE
   
4. **Phase 4**: Configuration & testing (2-3h)
   - Make configurable, measure savings
   
5. **Phase 5**: Monitoring (2-3h)
   - Track token savings, tune thresholds

**Total**: 13-18 hours

## Examples

### Example 1: Bug Fix (APPEND)

**Activity 1**: "Implement JWT authentication"
```
Annotation: "Uses JWT for stateless authentication. 
Tokens stored in httpOnly cookies. 
Refresh mechanism handles expiry..."
Cost: 500 tokens
```

**Activity 2**: "Fix JWT token expiry bug"
```
Change: 5 lines (token expiry calculation)
Intent similarity: 0.92 (same purpose)
Decision: APPEND
```
```
Annotation: "Uses JWT for stateless authentication. 
Tokens stored in httpOnly cookies. 
Refresh mechanism handles expiry...

Update (Activity 47): Fixed token expiry calculation 
to handle timezone differences."
Cost: 150 tokens (85 saved!)
```

### Example 2: Intent Shift (REPLACE)

**Activity 1**: "Implement JWT authentication"
```
Annotation: "Uses JWT for stateless authentication..."
Cost: 500 tokens
```

**Activity 50**: "Replace JWT with OAuth2"
```
Change: 200 lines (complete rewrite)
Intent similarity: 0.45 (fundamentally different)
Decision: REPLACE
```
```
Old annotation archived
New annotation: "Migrated to OAuth2 authentication.
Chose Auth0 as provider for SSO support..."
Cost: 500 tokens (appropriate for major change)
```

### Example 3: Typo Fix (SKIP)

**Activity 1**: "Implement user validation"
```
Annotation: "Validates user input for registration form..."
Cost: 500 tokens
```

**Activity 2**: "Fix typo in variable name"
```
Change: 1 line (renamed validateUesr → validateUser)
Intent similarity: 1.0 (identical)
Decision: SKIP
```
```
No annotation update
Cost: 0 tokens (500 saved!)
```

## Benefits

**Token Efficiency**:
- 66% token reduction
- $10/million tokens → **$6.60 saved per 100 activities**

**Quality**:
- ✅ Preserves historical context (append vs. replace)
- ✅ Reduces annotation noise
- ✅ Tracks intent evolution
- ✅ Versions major changes

**Consistency**:
- ✅ Same intent = consistent annotation
- ✅ Intent shift = clear versioning
- ✅ Incremental updates show evolution

## Monitoring

Track these metrics:
- Annotations skipped (%)
- Annotations appended vs. full (%)
- Token savings (actual vs. baseline)
- Annotation freshness (avg days since update)
- False skip rate (manual review)

**Target**: 60-70% token reduction with <5% false skip rate
