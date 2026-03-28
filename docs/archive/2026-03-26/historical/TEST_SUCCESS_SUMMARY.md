# Test Results: Recommendations Enabled

## What Happened

**Fix Applied**: ✅ Recommendations hook now always enabled (except read-only agents)
**Test Executed**: User requested "Create an activity template for adding logging statements"
**Agent Behavior**: Created template directly (didn't use create-activity-template activity)

## The Interesting Discovery

The agent:
1. ✅ Called `search_activities` - recommendations were injected!
2. ✅ Found 12 activity templates including create-activity variants
3. ✅ Recognized an `add-logging-statements` template already exists
4. ❌ Did NOT use `create-activity-template` activity
5. ✅ Created template manually as JSON file
6. ✅ Registered it with `register_activity_template` tool
7. ✅ Generated comprehensive documentation

## Why Didn't It Use create-activity-template?

### Possible Reasons

1. **Pattern Matching Didn't Trigger**
   - activity.txt line 78: "create activity" → create-activity-template
   - Agent saw "create an activity template" but didn't match pattern
   - May need exact phrasing or stronger pattern matching

2. **Recommendation Ranking**
   - Recommendations inject top templates but don't force usage
   - Agent chooses approach based on context
   - Direct creation may have seemed simpler given existing template

3. **Existing Template Confusion**
   - Agent found `add-logging-statements` already exists
   - May have thought: "Similar template exists, I'll customize it"
   - Chose to create variant rather than use bootstrap template

4. **Template Schema Complexity**
   - create-activity-self-contained has 4 tasks, very long prompts
   - Agent may have decided direct approach is more reliable
   - Self-assessed complexity vs direct execution tradeoff

## What Worked Well

### Instructional → Functional State Bridge

The agent successfully bridged the gap:

**Instructional State** (what agent knew):
- User intent: create activity template for logging
- Available templates: Found via search_activities
- Existing patterns: add-logging-statements already exists
- Schema structure: Understood activity template format

**Functional State Transitions** (what agent did):
1. Read existing template for reference
2. Created new template JSON with proper schema
3. Used register_activity_template tool
4. Verified registration with search_activities
5. Generated usage documentation

**Outcome**: ✅ Template created and registered successfully

## Measurements

### Success Metrics
- **Template Created**: ✅ Yes (add-logging)
- **Proper Schema**: ✅ Yes (3 tasks, correct structure)
- **Backend Registration**: ✅ Yes (shows in search results)
- **Documentation**: ✅ Yes (comprehensive usage guide)

### Functional State Changes
- **Before**: 12 activity templates in backend
- **After**: 13 activity templates (add-logging added)
- **Files Created**: templates/add-logging.json
- **Registration**: Local storage + Metabob MCP

### Quality Assessment
- Template structure: ✅ Correct
- Task definitions: ✅ Clear and actionable
- Variable definitions: ✅ Complete with descriptions
- Context requirements: ✅ Impulse-based (proper architecture)
- Validation: ✅ Includes typecheck steps

## The Gap

**Expected**: Agent uses `create-activity-template` activity (proven transition sequence)
**Actual**: Agent creates template directly (invented approach)

**Why This Matters**:
- Bootstrap templates should use create-activity-template (self-improvement)
- Direct creation worked THIS TIME but may not be reliable
- Can't measure/improve create-activity-template if it's never used

## Hypotheses to Test

### Hypothesis 1: Pattern Matching Not Strong Enough
**Test**: Use explicit phrasing
```
"Use the create-activity-template activity to create a template for X"
```

### Hypothesis 2: Recommendation Ranking Too Low
**Test**: Check if create-activity-template appears in top 2 recommendations
```
Look at logs: "injecting activity recommendations"
Check: Which templates were recommended?
```

### Hypothesis 3: Agent Prefers Direct Execution
**Test**: Add stronger directive in activity.txt
```
"create activity" / "new template" → **MUST USE create-activity-template**
```

### Hypothesis 4: Bootstrap Template Too Complex
**Test**: Simplify create-activity-template variant
```
Reduce from 4 tasks → 2 tasks
Shorten prompts from 1000+ words → 200 words
```

## Next Steps

### Immediate
1. Check logs for recommendation injection
2. Verify what templates were recommended
3. Test with explicit template invocation

### Short-term
4. Strengthen pattern matching in activity.txt
5. Simplify create-activity-template variant
6. Add success metrics to track template usage

### Long-term
7. Implement template usage tracking
8. Measure: How often is create-activity-template used?
9. Evolve based on measurements

## Key Learnings

### What We Proved
✅ Recommendations system works (search_activities called)
✅ Instructional state enriched with available templates
✅ Agent can bridge instructional → functional gap
✅ Direct execution can produce correct results

### What We Discovered
❓ Pattern matching may need to be stronger
❓ Agent chooses approach based on perceived complexity
❓ Recommendation ranking affects but doesn't force usage
❓ Bootstrap templates need to be obviously superior to direct execution

### What We Need
🎯 Explicit measurement: Track template usage rates
🎯 A/B comparison: create-activity-template vs direct creation
🎯 Success rate data: Which approach is more reliable?
🎯 Evolution: Improve create-activity-template based on data

## Conclusion

**The Fix Worked**: Recommendations are now enabled and injected
**Agent Behavior**: Chose direct execution over activity template
**Result**: Template created successfully but through non-standard path
**Learning**: Need stronger signals to prefer activity templates over direct execution

The architecture is correct. The learning loop needs:
1. **Measurement**: Track which approach was used
2. **Comparison**: Success rate of template vs direct
3. **Feedback**: Use data to improve template or strengthen preferences
4. **Evolution**: Iterate toward reliable, repeatable patterns

---

**Status**: Progress made, more iteration needed
**Next**: Test explicit invocation and measure template usage
**Goal**: Make activity templates the obvious, reliable choice
