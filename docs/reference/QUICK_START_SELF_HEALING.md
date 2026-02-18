# Quick Start: Self-Healing Activity Templates

**Goal**: Run your first experiment in the next 30 minutes

---

## Step 1: List Available Templates (2 minutes)

```typescript
// In an OpenCode session:
search_activities({ verbose: true })
```

**Pick one that's simple** (we'll intentionally break it to learn):
- `validate-build-complete`
- `cleanup-docs-tests`
- `diagnose-startup-issues`

---

## Step 2: Run It and Let It Fail (5 minutes)

```typescript
// Run with intentionally incomplete variables
activity({
  templateId: "validate-build-complete",  // or your chosen template
  variables: {
    // Leave some required variables missing intentionally
  },
  reason: "Learning experiment: observe failure patterns"
})
```

**Expected**: It will fail. That's good! We want to learn why.

---

## Step 3: Diagnose the Failure (10 minutes)

```typescript
// Get automatic diagnosis
activity({
  templateId: "debug-activity-self-contained-v3",
  variables: {
    executionId: ""  // Leave empty - it finds most recent failure
  },
  reason: "Diagnose what went wrong"
})
```

**Outputs created**:
- `EXECUTION_DETAILS.md` - Full error context
- `ROOT_CAUSE_ANALYSIS.md` - Why it failed
- `FIXES.md` - How to fix it
- `DIAGNOSIS_REPORT.md` - Executive summary

**Read these files** and understand:
- Which task failed?
- What was the error message?
- What does the diagnosis recommend?

---

## Step 4: Apply the Fix (5 minutes)

Based on the diagnosis, try the quick fix suggested:

```typescript
// Option A: Replay with corrected variables
activity_replay({
  activityId: "[ID from step 2]",
  overrideVariables: {
    // Add missing variables or fix incorrect ones
  }
})

// Option B: Run fresh with correct variables
activity({
  templateId: "validate-build-complete",
  variables: {
    // Complete, correct variables this time
  },
  reason: "Retry with fixes applied"
})
```

**Expected**: It should succeed this time (or fail differently - more learning!)

---

## Step 5: Generate Improved Template (5 minutes)

If the fix worked, let's create an improved template variant:

```typescript
activity({
  templateId: "evolve-activity-self-contained",
  variables: {
    templateId: "validate-build-complete"  // Original template
  },
  reason: "Create improved variant based on learnings"
})
```

**Outputs created**:
- `TEMPLATE_ANALYSIS.md` - Current metrics
- `IMPROVEMENTS.md` - Proposed changes
- `validate-build-complete-improved.json` - New variant
- `EVOLUTION_REPORT.md` - What changed and why

---

## Step 6: Document Your Learning (3 minutes)

Create a quick note in your experiment log:

```bash
# Create log file
cat > ~/activity-experiments/experiment-001.md << 'EOF'
# Experiment 001: First Self-Healing Cycle

## Template Tested
- Name: validate-build-complete
- Version: 1

## What Happened
- Ran with incomplete variables
- Failed at task [name]
- Error: [message]

## Root Cause
- [From diagnosis report]

## Fix Applied
- [What you changed]

## Result
- Before: FAILED
- After: SUCCESS

## Learning
- [Key insight - e.g., "Always provide X variable"]

## Improvement Created
- Variant: validate-build-complete-improved
- Changes: [list of changes from evolution report]
EOF
```

---

## What You've Accomplished

✅ **Ran an activity** and observed failure  
✅ **Diagnosed the failure** using debug-activity  
✅ **Applied the fix** and validated it works  
✅ **Generated improved variant** using evolve-activity  
✅ **Documented the learning** for future reference

**This is the complete self-healing cycle!** 🎉

---

## Next Steps

### If You Want to Go Deeper:

1. **Test the improved variant**:
   ```typescript
   register_activity_template({
     file_path: "./validate-build-complete-improved.json"
   })
   
   activity({
     templateId: "validate-build-complete-improved",
     variables: { /* same as before */ },
     reason: "Validate improved template"
   })
   ```

2. **Try a different failure mode**:
   - Intentionally use wrong file paths
   - Provide invalid variable values
   - Set token limits too low

3. **Compare metrics**:
   - Run original 3 times: track success rate
   - Run improved 3 times: track success rate
   - Calculate improvement percentage

4. **Build your pattern library**:
   - Document what you learned
   - Identify recurring issues
   - Create guidelines

---

## Common Issues & Solutions

### Issue: "Template not found"
**Solution**: Run `search_activities()` to see available templates

### Issue: "Variables missing"
**Solution**: Use `get_activity_template({ id: "template-name" })` to see required variables

### Issue: "Debug activity can't find execution"
**Solution**: Check activity ID in error message from step 2

### Issue: "Evolve activity says no metrics"
**Solution**: This is expected (backend metrics not implemented yet). It will use static analysis instead.

---

## Time Investment vs Learning

- **30 minutes**: Complete one full cycle (huge learning)
- **2 hours**: Run 3-4 cycles, start seeing patterns
- **1 day**: Run 10+ cycles, build initial pattern library
- **1 week**: Have robust pattern library, most templates working well

---

## Remember

> "Every failure is a gift - it's teaching you how to make the system better."

**Don't fear failures**. Embrace them. They're your teachers.

**Ready? Let's start!** 🚀

**Next command to run**:
```typescript
search_activities({ verbose: true })
```
