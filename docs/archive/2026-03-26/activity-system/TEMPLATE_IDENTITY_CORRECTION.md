# Template Identity Architecture - Corrected Understanding

## The Problem with My Approach

I created **new templates with different names**, which violated the variant architecture:

### What I Did Wrong ❌
```json
{
  "name": "Create Activity Template (Simplified)",     // NEW NAME
  "activity_id": "create-activity-template-(simplified)"  // NEW ID
}
```
```json
{
  "name": "Create Activity Template (Ultra Minimal)",  // NEW NAME  
  "activity_id": "create-activity-template-(ultra-minimal)"  // NEW ID
}
```

**Result**: Created 3 different activity intents instead of 3 variants of the same intent.

### What I Should Have Done ✅
```json
{
  "name": "Create Activity Template (Self-Contained)",  // SAME NAME
  "activity_id": "create-activity-self-contained",       // SAME ID
  "genealogy": {
    "content_hash": "abc123",     // Variant 1 hash
    "generation": 0,
    "parent_hash": null
  }
}
```
```json
{
  "name": "Create Activity Template (Self-Contained)",  // SAME NAME
  "activity_id": "create-activity-self-contained",       // SAME ID
  "genealogy": {
    "content_hash": "def456",     // Variant 2 hash (improved)
    "generation": 1,
    "parent_hash": "abc123"       // Points to variant 1
  }
}
```

**Result**: 2 variants of the SAME intent. Thompson Sampling automatically selects the best.

## Correct Architecture

### Template Identity Hierarchy

```
Intent (Stable)
  ├─ activity_id: "create-activity-self-contained" 
  ├─ name: "Create Activity Template (Self-Contained)"
  └─ description: "Create activity templates without requiring example files..."
     
     Variants (Multiple implementations of same intent)
       │
       ├─ Variant 1 (Original - Generation 0)
       │    ├─ variant_id: "create-activity-self-contained-abc123"
       │    ├─ content_hash: "abc123"
       │    ├─ success_rate: 0% (7 executions)
       │    ├─ expected_value: 0.10 (Thompson Sampling score)
       │    └─ parent_hash: null
       │
       ├─ Variant 2 (Improved - Generation 1)
       │    ├─ variant_id: "create-activity-self-contained-def456"
       │    ├─ content_hash: "def456"
       │    ├─ success_rate: 75% (4 executions)
       │    ├─ expected_value: 0.76 (Thompson Sampling score)
       │    └─ parent_hash: "abc123"
       │
       └─ Variant 3 (Best - Generation 2)
            ├─ variant_id: "create-activity-self-contained-xyz789"
            ├─ content_hash: "xyz789"
            ├─ success_rate: 90% (10 executions)
            ├─ expected_value: 0.91 (Thompson Sampling score)
            └─ parent_hash: "def456"
```

### How Thompson Sampling Works

**User Request**: "Use the create-activity-self-contained template"

**Backend Process**:
1. Look up all variants with `activity_id = "create-activity-self-contained"`
2. Calculate Thompson Sampling score for each:
   - Beta(alpha, beta) where alpha = successes + 1, beta = failures + 1
   - expected_value = alpha / (alpha + beta)
3. Select variant with highest expected_value
4. Return that specific variant_id to OpenCode
5. Record which variant was selected (total_selections++)

**OpenCode Execution**:
- OpenCode receives ONE variant (e.g., variant 3 with 90% success)
- Executes that variant
- Reports success/failure back to backend
- Backend updates Thompson Sampling stats

**Key Point**: OpenCode doesn't know it's variant 3. It just executes what the backend selected.

## The Critical Mistake

By creating different names, I created **competing intents**:
- "Create Activity Template (Simplified)" → NEW intent
- "Create Activity Template (Ultra Minimal)" → NEW intent
- "Create Activity Template (Self-Contained)" → ORIGINAL intent

Thompson Sampling can't select between them because they're **different activities**.

## The Correct Fix

### Step 1: Create Improved Variant (SAME activity_id)
```json
{
  "activity_id": "create-activity-self-contained",
  "name": "Create Activity Template (Self-Contained)",
  "description": "Create activity templates without requiring example files...",
  "task_steps": [
    // IMPROVED IMPLEMENTATION (2 tasks instead of 4, shorter prompts)
  ]
}
```

### Step 2: Register with Backend
Backend will:
- Hash the content → "ed6cce82"
- Create variant_id: "create-activity-self-contained-ed6cce82"
- Set generation: 1 (if parent specified) or 0 (if new)
- Store alongside existing variant

### Step 3: Thompson Sampling Auto-Selects
- Initially: Both variants have expected_value ≈ 0.5 (no data)
- After 1 success with new variant: New variant = 0.67, Old variant = 0.10
- After 5 successes with new variant: New variant = 0.86, Old variant = 0.10
- Backend automatically switches to new variant for all requests

### Step 4: Old Variant Fades Away
- Old variant no longer selected (expected_value too low)
- Can be archived/removed once proven obsolete
- Genealogy preserved for historical analysis

## What This Means for the Fix

### Current State ❌
```
create-activity-template-(self-contained)    [1 variant, 0 runs]
create-activity-template-(simplified)        [1 variant, 0 runs]
create-activity-template-(ultra-minimal)     [1 variant, 0 runs]
```
These are 3 **different activities**, not 3 variants of one activity.

### Desired State ✅
```
create-activity-self-contained               [3 variants]
  ├─ variant-abc123 (gen 0, 0% success, 7 runs)
  ├─ variant-def456 (gen 1, 60% success, 5 runs)
  └─ variant-xyz789 (gen 2, 85% success, 10 runs)  ← Auto-selected
```

## How to Fix This Properly

### Option 1: Use evolve-activity-self-contained (Preferred)
```bash
# Use the evolution template to create a new variant
opencode run --prompt "
Use evolve-activity-self-contained to improve create-activity-self-contained.

Current issues:
- 4 tasks is too many (reduce to 2-3)
- Prompts are 1000+ words (reduce to 100-200 words)
- Multi-step workflow creates failure points (use single-shot generation)

Generate an improved variant with:
- 2 tasks max
- Short, direct prompts
- Minimal validation
"
```

This will:
- Keep the same activity_id
- Create a new variant with generation = 1
- Set parent_hash to point to current variant
- Register as new variant under same activity

### Option 2: Manual Creation + Backend Registration (Current Approach)
```bash
# Create improved template JSON (same activity_id and name!)
cat > improved-template.json <<EOF
{
  "activity_id": "create-activity-self-contained",
  "name": "Create Activity Template (Self-Contained)",
  // ... improved implementation
}
EOF

# Register with backend (will auto-create variant_id from content hash)
curl -X POST http://api-server-dev:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @improved-template.json

# Backend creates: create-activity-self-contained-{new-hash}
# Generation: 0 (no parent specified) or 1 (if parent_hash provided)
```

### Option 3: Use register_activity_template Tool with Genealogy
```typescript
// In OpenCode
register_activity_template({
  file_path: "improved-template.json",
  register_with_metabob: true,
  // Could add genealogy info if tool supports it
})
```

## The Execution Flow (Corrected)

### User Request
```
"Create an activity template for adding logging statements"
```

### OpenCode Interprets
```
User wants: create-activity-self-contained
(This is the stable intent name)
```

### Backend Selection
```sql
SELECT * FROM templates 
WHERE activity_id = 'create-activity-self-contained'
ORDER BY expected_value DESC
LIMIT 1;

-- Returns: create-activity-self-contained-xyz789 (best variant)
```

### OpenCode Executes
```
Execute variant xyz789 with user's parameters:
- templateName: "Add Logging Statements"
- templateDescription: "Add comprehensive logging to functions"
- category: "tool"
```

### Result Reporting
```
Backend receives:
- variant_id: "create-activity-self-contained-xyz789"
- success: true
- duration: 120s
- cost: $0.25

Backend updates:
- xyz789.successes++ 
- xyz789.total_selections++
- xyz789.expected_value recalculated
```

## Key Learnings

### ✅ Correct Understanding
1. **activity_id is stable** - represents the intent/purpose
2. **Variants are implementations** - different ways to achieve the intent
3. **Thompson Sampling is automatic** - backend selects best variant
4. **OpenCode is variant-agnostic** - doesn't know which variant it's running
5. **Evolution creates lineage** - generation and parent_hash track improvements

### ❌ My Mistakes
1. Created new activity_ids instead of variants
2. Changed the name (which changes activity_id)
3. Treated variants as different templates
4. Didn't understand Thompson Sampling selection
5. Thought OpenCode needed to choose variants explicitly

## Action Items

### Immediate Fix
1. ✅ Created correct variant: `create-activity-template-(self-contained)-ed6cce82`
   - Same activity_id (after backend normalization)
   - Improved implementation (2 tasks, short prompts)
   - Ready for testing

2. ⏳ Test the improved variant
   - Execute 5-10 times
   - Track success rate
   - Let Thompson Sampling learn

3. ⏳ If successful, old variants fade away automatically
   - No manual promotion needed
   - Thompson Sampling handles selection
   - Old variants can be archived once proven obsolete

### For Next Templates
1. **Always use the same activity_id** when improving
2. **Use evolve-activity-self-contained** for proper genealogy
3. **Let Thompson Sampling decide** which variant to use
4. **Track metrics** but don't manually select variants

## The Beautiful Part

This architecture means:
- **Users don't care about variants** - they just say "create an activity template"
- **Best implementation wins** - Thompson Sampling finds it automatically
- **Evolution is continuous** - new variants compete with old
- **History is preserved** - genealogy tracks all improvements
- **No manual promotion needed** - system self-optimizes

**This is exactly what we want for a self-improving system!** 🎉

---

**Status**: ✅ Understanding Corrected
**Next**: Test the improved variant and let Thompson Sampling prove it works
**Key Insight**: Don't fight the architecture - trust Thompson Sampling to select the best variant
