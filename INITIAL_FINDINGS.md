# Initial Double-Blind Architecture Validation Findings

**Date**: 2026-01-30  
**Validation Method**: Manual inspection of metabob-cli MCP tools  
**Status**: **NON-COMPLIANT** - Violations found

---

## Summary

**Quick inspection of metabob-cli reveals immediate violations of the double-blind architecture:**

❌ **MCP tools expose similarity scores** (prohibited)  
❌ **MCP tools calculate and return relevance rankings** (prohibited)  
❌ **Internal scoring logic visible in responses** (prohibited)

---

## Specific Violations Found

### 1. `search_codebase_issues` - Similarity Scoring

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Violation**:
```python
def _calculate_similarity(query: str, issue: dict) -> float:
    # Calculates similarity score
    word_score = len(common_words) / len(query_words)
    # Returns score 0.0-1.0

# In search_codebase_issues:
score = _calculate_similarity(query, issue)
if score > 0:
    scored_issues.append(issue_copy)  # Issues include score!

scored_issues.sort(...)  # Sorted by score
```

**Problem**:
- Calculates similarity scores between query and issues
- Returns scored and sorted results
- Exposes internal relevance ranking to agents

**Required by Architecture**:
> metabob_search_codebase_issues(query)
>   → Returns: [{component_id, file_path}]
>   → **NO similarity scores**

**Current Behavior**:
- Returns: `[{...issue_data..., score: 0.87}]` ❌
- Sorts by score ❌
- Filters by score threshold ❌

---

### 2. Priority Scoring System

**Location**: Same file

**Violation**:
```python
severity_score = _severity_rank(issue.get("severity", ""))
impact_score = await _get_cpg_impact_score(issue["file_path"], watcher)
# Combines scores for prioritization
```

**Problem**:
- Calculates severity scores
- Calculates CPG impact scores
- Combines for priority ranking

**Required by Architecture**:
- Pure CPG structural analysis only
- No scoring or ranking
- Let server (RPC API) handle prioritization

---

### 3. Annotation & Resolution Scoring

**Location**: Same file

**Violation**:
```python
# In _find_relevant_annotations:
score = len(common_words) / len(query_words) if query_words else 0.0
scored.sort(key=lambda x: x[0], reverse=True)

# In _find_relevant_resolutions:
score = len(common_words) / len(query_words) if query_words else 0.0
scored.sort(key=lambda x: x[0], reverse=True)
```

**Problem**:
- Calculates relevance scores for annotations
- Calculates relevance scores for resolutions
- Returns sorted by score

**Required**: Return all, let agent/server decide relevance

---

## Impact Assessment

### Critical Issues: 3

1. **Similarity scoring in search results** (CRITICAL)
   - Directly exposes internal ranking
   - Agents can optimize for high scores
   - Defeats double-blind property

2. **Priority scoring system** (CRITICAL)
   - Combines severity + impact into single score
   - Exposes learning/ranking logic
   - Biases agent decisions

3. **Annotation/resolution scoring** (HIGH)
   - Ranks context by relevance
   - Exposes selection algorithm
   - Could bias agent behavior

### Estimated Scope

**metabob-cli**:
- Files to modify: 1 (`tools.py`)
- Functions to fix: 3-5
- Effort: 2-4 hours
- Risk: Low (remove scoring, keep structure)

**metabob-opencode**:
- Unknown (needs validation)
- Estimated: RPC integration missing
- Effort: 8-16 hours

**metabob-rpc-api**:
- Unknown (needs validation)
- Estimated: Most of Week 1-6 missing
- Effort: 40-80 hours

---

## Recommended Next Steps

### Option 1: Run Full Validation Loop (Automated)

```bash
opencode activity run validate-create-verify-loop \
  --var validation_activity_id=validate-double-blind-architecture \
  --var target_system=double-blind-learning-system
```

**This will**:
1. Validate all three repos systematically
2. Generate implementation activities for ALL issues (not just the 3 we found)
3. Execute activities with proper sequencing
4. Re-validate to confirm fixes
5. Generate comprehensive report

**Duration**: 4-8 hours (mostly automated)

---

### Option 2: Manual Validation First (More Control)

**Step 1**: Run just validation

```bash
opencode activity run validate-double-blind-architecture
```

**Review** outputs:
- `METABOB_CLI_VALIDATION.md`
- `METABOB_OPENCODE_VALIDATION.md`
- `METABOB_RPC_API_VALIDATION.md`
- `CROSS_REPO_INTEGRATION_VALIDATION.md`
- `IMPLEMENTATION_ROADMAP.md`

**Step 2**: Generate activities based on full validation

```bash
opencode activity run create-from-validation \
  --var validation_output_file=CROSS_REPO_INTEGRATION_VALIDATION.md \
  --var target_system=double-blind-learning-system \
  --var output_directory=templates/generated/double-blind
```

**Step 3**: Review generated activities, then execute manually

---

## Why Use the Meta-Activities?

### Without Meta-Activities:
1. Manually find all violations across 3 repos
2. Manually write fix for each issue
3. Manually test each fix
4. Manually verify no regressions
5. Manually coordinate cross-repo changes
6. **Time**: Days, error-prone

### With Meta-Activities:
1. Run validation → all issues found automatically
2. Generate activities → fixes created automatically
3. Execute activities → fixes applied automatically
4. Re-validate → verification automatic
5. Report → documentation automatic
6. **Time**: Hours, systematic

---

## Expected Output

After running the validation loop, we'll have:

### Validation Reports:
- Complete assessment of all 3 repos
- Every non-compliant piece identified
- Cross-repo integration gaps documented
- Implementation roadmap with phases

### Generated Activities:
- **metabob-cli**: Remove scoring from MCP tools
- **metabob-opencode**: Implement RPC client, integrate recommendation flow
- **metabob-rpc-api**: Implement Thompson Sampling, feedback processing, Celery tasks
- **Integration**: Cross-repo tests, lockstep commits

### Execution Results:
- Success/failure for each activity
- Test results for each change
- Before/after validation comparison
- Final compliance assessment

---

## Risk Analysis

### Low Risk (metabob-cli):
- ✅ Changes are removals (delete scoring logic)
- ✅ Keep structural analysis
- ✅ Easy to verify (no scores in response)
- ✅ No new dependencies

### Medium Risk (metabob-opencode):
- ⚠️ Adding new RPC client
- ⚠️ Integration with external service
- ⚠️ Need to test recommendation flow
- ✅ Well-defined interfaces

### High Risk (metabob-rpc-api):
- ⚠️ Major new implementation (Thompson Sampling)
- ⚠️ Database schema changes
- ⚠️ Celery integration
- ⚠️ Learning algorithm correctness critical
- ✅ Can test in isolation before connecting

---

## Success Criteria

### After Validation:
- ✅ All violations identified
- ✅ Implementation plan created
- ✅ Activities generated
- ✅ Ready to execute

### After Implementation:
- ✅ metabob-cli: No scores in MCP responses
- ✅ metabob-opencode: RPC integration working
- ✅ metabob-rpc-api: Thompson Sampling functional
- ✅ Cross-repo: Data flows correctly
- ✅ Double-blind: Property verified

### After Re-Validation:
- ✅ Pass rate: 30% → 90%+
- ✅ Critical issues: 3 → 0
- ✅ Integration gaps: Unknown → 0
- ✅ Production ready: ✅

---

## Decision Point

**Recommendation**: Run **Option 1** (full automated loop)

**Rationale**:
1. We already found 3 violations in <5 minutes of manual inspection
2. Likely many more violations exist
3. Meta-activities will find ALL issues systematically
4. Generated activities ensure consistent fixes
5. Validation loop ensures correctness
6. Time savings: Days → Hours

**Command to execute**:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

opencode activity run validate-create-verify-loop \
  --var validation_activity_id=validate-double-blind-architecture \
  --var target_system=double-blind-learning-system \
  --var fail_fast=false
```

---

**Status**: Ready to proceed with automated validation loop  
**Next**: Execute command above to begin validation → creation → execution → verification cycle
