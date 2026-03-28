# Ratchet Template Bug: Conditional Blocks Not Supported

## Issue Discovery

The `execute-ratchet-cycle` template was created successfully by `create-activity-self-contained` but **fails immediately on execution** with this error:

```
Missing variables in template: {{#if focus_areas}}, {{/if}}. 
Provided variables: ACTIVITY_TEMP_DIR, ACTIVITY_ID, REPO_ROOT, domain, max_cycles, improvement_threshold, auto_commit, focus_areas, metrics_baseline_file, max_cost_per_cycle, max_total_cost
```

## Root Cause

**The activity template system uses Mustache templating, NOT Handlebars.**

- Mustache: Supports `{{variable}}` interpolation only
- Handlebars: Supports `{{#if}}...{{/if}}`, `{{#each}}...{{/each}}`, etc.

The template contains 4 conditional blocks:
1. Line 58 (task 1): `{{#if focus_areas}}\n## Focus Areas\n...\n{{/if}}`
2. Line 126 (task 2): `{{#if focus_areas}}\n## Focus Areas Filter\n...\n{{/if}}`
3. Line 198 (task 3): `{{#if auto_commit}}\n## Git Commit\n...\n{{/if}}`
4. Line 302 (task 5): Multiple `{{#if decision == "..."}}...{{/if}}` blocks

## Impact

- execute-ratchet-cycle template is **BROKEN** and cannot run
- This blocks the entire ratchet mechanism demonstration
- Shows that create-activity-self-contained doesn't validate output against actual template system constraints

## Immediate Fix Options

### Option 1: Remove conditionals (simplest)
Replace conditional blocks with unconditional text:
```
{{#if focus_areas}}
## Focus Areas
Prioritize: {{focus_areas}}
{{/if}}
```
Becomes:
```
## Focus Areas
{{focus_areas}}
(Leave empty if not specified)
```

### Option 2: Add Handlebars support to template system (complex)
- Upgrade template engine from Mustache to Handlebars
- Test all existing templates for compatibility
- Document new capabilities

### Option 3: Manual ratchet test (bypass broken template)
- Execute ratchet steps manually in this session
- Demonstrate the concept without the template
- Fix template later

## Chosen Approach

**Option 3: Manual Ratchet Test**

Why:
- Fastest way to prove ratchet concept (< 30 min)
- Template fix is a separate task (can do later)
- Manual execution provides valuable insights for improving the template
- Already invested $6+ in ratchet infrastructure - want to see it work!

## Manual Ratchet Cycle Steps

### Step 1: Inspect System State (5-10 min)
- Query Redis for template metrics
- Query SurrealDB for execution history
- Identify 3-5 bottleneck candidates
- Output: `tmp/template-evolution/metrics-snapshot.json`

### Step 2: Identify Bottleneck (5 min)
- Calculate priority scores for candidates
- Select highest ROI improvement
- Output: `tmp/template-evolution/bottleneck-analysis.json`

### Step 3: Apply Improvement (10-15 min)
- Implement the fix (template or code)
- Validate changes (tests, compilation)
- Output: `tmp/template-evolution/improvement-details.md`

### Step 4: Measure Progress (5-10 min)
- Re-collect metrics
- Calculate before/after delta
- Output: `tmp/template-evolution/progress-measurement.json`

### Step 5: Decide Next Action (5 min)
- Compare improvement vs threshold
- Decide continue/stop
- Output: `tmp/template-evolution/cycle-results.json`

**Total time**: ~30-45 min
**Cost**: ~$1-2 (all manual, no activity overhead)

## Lessons for create-activity-self-contained

**Improvement needed**: Template validation

The template should be validated against actual constraints:
1. Parse template with actual Mustache engine
2. Detect unsupported syntax (conditionals, loops, etc.)
3. Either reject the template OR provide alternative syntax
4. Add to validation rules in Task 3

Example forbidden pattern:
```json
{
  "forbiddenPatterns": [
    "{{#if",
    "{{/if",
    "{{#each",
    "{{/each"
  ]
}
```

## Next Steps

1. ✅ Document the bug (this file)
2. ⏭️ Execute manual ratchet cycle Cycle 1
3. ⏭️ Prove the concept works
4. ⏭️ Fix execute-ratchet-cycle template (remove conditionals)
5. ⏭️ Improve create-activity-self-contained validation
6. ⏭️ Re-test automated ratchet

## Meta-Insight

**This bug is actually PERFECT for demonstrating the ratchet!**

- We discovered a failure mode (conditionals not supported)
- We're manually executing the fix (Option 3)
- We're documenting the learnings (this file)
- We'll improve create-activity to prevent this (Step 5)
- **This IS the ratchet in action!** 🎉

The system is already self-improving - we just didn't realize it!
