# Execute Double-Blind Architecture Validation - Action Plan

**Status**: Ready to Execute  
**Approach**: Direct validation with manual activity template execution  
**Duration**: 2-4 hours

---

## Immediate Action: Start Validation

Since the meta-activity templates need schema fixes, let's execute the validation directly:

### Step 1: Run Initial Manual Validation (NOW)

I'll validate each repository manually and create reports:

1. **metabob-cli**: Check MCP tools for scores/confidence
2. **metabob-opencode**: Check for RPC integration
3. **metabob-rpc-api**: Check for Thompson Sampling implementation

### Step 2: Generate Findings Report

Create structured validation reports for each repo showing:
- What's compliant ✅
- What's non-compliant ❌
- What's missing ⚠️

### Step 3: Create Implementation Activities

Based on findings, create activity templates for:
- Fix MCP tool responses (metabob-cli)
- Implement RPC client (metabob-opencode)  
- Implement Thompson Sampling system (metabob-rpc-api)

### Step 4: Execute with Lockstep Commits

Execute activities and commit changes across all three repos in coordination.

---

## What I've Already Found

### metabob-cli Violations:

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Issue 1**: `_calculate_similarity()` function
```python
# Line ~450
def _calculate_similarity(query: str, issue: dict) -> float:
    # Calculates word overlap score
    word_score = len(common_words) / len(query_words)
    return word_score  # 0.0-1.0
```

**Issue 2**: Similarity scoring in `search_codebase_issues()`
```python
# Line ~550
score = _calculate_similarity(query, issue)
if score > 0:
    scored_issues.append(issue_copy)  # Contains score!
scored_issues.sort(...)  # Sorted by score
```

**Issue 3**: Priority scoring
```python
# Various locations
severity_score = _severity_rank(issue.get("severity", ""))
impact_score = await _get_cpg_impact_score(...)
```

**Fix Required**: Remove all scoring, return pure CPG structure

---

## Next Steps - Choose One:

### Option A: I Continue Validation Manually (Recommended)

I'll:
1. Continue inspecting metabob-opencode
2. Continue inspecting metabob-rpc-api
3. Generate complete validation report
4. Create fix activities
5. Help you execute them

**Advantage**: Fast, direct, we control everything
**Time**: 2-3 hours total

### Option B: Fix Meta-Activity Templates First

Fix the schema issues in our meta-activity templates, then use them.

**Advantage**: Automated, reusable for future
**Disadvantage**: Takes time to fix templates
**Time**: 1 hour to fix templates + 2-3 hours execution = 3-4 hours total

---

## My Recommendation

**Go with Option A** - I'll continue the manual validation right now and we'll have concrete findings in the next hour.

Then we can:
1. Review findings together
2. Decide on implementation approach
3. Execute fixes with lockstep commits
4. Verify compliance

**Shall I proceed with Option A and continue validating metabob-opencode and metabob-rpc-api now?**

This will give us a complete picture of what needs to be fixed across all three repositories.
