# CPG Quick Wins Implementation Plan

**Structured, delegated implementation of the 3 high-impact CPG enhancements**

---

## 🎯 Overview

We'll implement the 3 Quick Wins from `CPG_COCHANGE_MAXIMIZATION_GUIDE.md` using a structured, delegated approach:

1. **Activity-Driven Co-Change Workflow** (4 hours)
2. **Impulse Context Prioritization** (3 hours)  
3. **CPG-Powered Test Selection** (6 hours)

**Total Estimated Time**: 13 hours (1.5-2 days)

---

## 📋 Implementation Strategy

### Approach: Activity Template Pattern
We'll use **add-feature-complete** activity template for each enhancement:
- ✅ Structured implementation with tests
- ✅ Automatic commits with proper messages
- ✅ Quality checks built-in
- ✅ Delegation to specialized agents

### Workflow
```
1. Define feature requirements (this document)
2. Execute add-feature-complete activity for each feature
3. Verify integration and measure impact
4. Document results
```

---

## 🚀 Quick Win #1: Activity-Driven Co-Change Workflow

### Feature Specification

**Goal**: Auto-suggest related files after activity tasks and create follow-up tasks for critical issues

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Implementation Details**:

1. **Locate insertion point**: After task execution in `executeTask()` function
2. **Add co-change analysis**: Call `metabob.suggestRelatedChanges()`
3. **Filter critical files**: `cochange_score > 0.7 && high_severity_issues > 0`
4. **Create follow-up tasks**: Add to activity task queue dynamically

**Code Location Analysis**:
```typescript
// In template-executor.ts::executeTask()
// After line ~1150 where task completes successfully
// Before returning task result

// NEW: Co-change analysis
if (task.validation?.useCochangePrediction !== false) {
  const changedFiles = extractChangedFilesFromResult(taskResult)
  
  if (changedFiles.length > 0) {
    const related = await metabob.suggestRelatedChanges(changedFiles, { top_k: 3 })
    
    const criticalRelated = related.filter(f => 
      f.cochange_score > 0.7 && f.high_severity_issues > 0
    )
    
    if (criticalRelated.length > 0) {
      // Add follow-up task to activity
      const followUpTask = {
        id: `cochange-review-${Date.now()}`,
        description: `Review related files with issues: ${criticalRelated.map(f => f.file_path).join(", ")}`,
        subagent: task.subagent,
        dependencies: [task.id],
        prompt: {
          template: `Review the following files that often change with the files you just modified:\n\n${criticalRelated.map(f => `- ${f.file_path} (co-change: ${(f.cochange_score * 100).toFixed(0)}%, ${f.high_severity_issues} high-severity issues)`).join("\n")}\n\nCheck for:\n1. Consistency issues (similar patterns should be applied)\n2. High-severity issues that need fixing\n3. Related functionality that may need updating`,
          variables: []
        },
        validation: {}
      }
      
      // Dynamically add task to execution queue
      template.tasks.push(followUpTask)
      
      log.info(`Co-change analysis: Added follow-up task for ${criticalRelated.length} related files`)
    }
  }
}
```

**Testing Requirements**:
1. Unit test: `executeTask()` calls `suggestRelatedChanges()` when enabled
2. Unit test: Follow-up tasks created for critical files
3. Unit test: No follow-up tasks if `useCochangePrediction: false`
4. Integration test: Full activity execution with co-change workflow

**Success Criteria**:
- ✅ Follow-up tasks automatically created for related files
- ✅ Agents receive related file suggestions in context
- ✅ Co-change predictions visible in activity logs
- ✅ No performance degradation (< 50ms overhead per task)

**Activity Variables**:
```json
{
  "featureName": "activity-cochange-workflow",
  "files": [
    "repos/metabob-opencode/packages/opencode/src/session/template-executor.ts",
    "repos/metabob-opencode/packages/opencode/src/util/metabob.ts"
  ],
  "description": "Auto-suggest related files after activity tasks and create follow-up tasks for critical issues",
  "testStrategy": "unit + integration tests for co-change workflow"
}
```

---

## 🚀 Quick Win #2: Impulse Context Prioritization

### Feature Specification

**Goal**: Score impulses by CPG impact to prioritize high-impact components in context

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`

**Implementation Details**:

1. **Locate scoring function**: Find where impulses are scored/prioritized
2. **Add CPG impact boost**: Query `metabob.analyzeChangeImpact()` for files
3. **Normalize and boost**: Add up to +0.5 to score based on impact
4. **Cache results**: Avoid redundant CPG queries for same files

**Code Location Analysis**:
```typescript
// In impulse-resolver.ts
// Look for existing scoring/prioritization logic
// Add CPG impact as additional scoring factor

async function scoreImpulseWithCPG(impulse: Impulse): Promise<number> {
  let score = 0 // Base score from existing logic
  
  // NEW: CPG impact boost
  if (impulse.pointer.type === "file" || impulse.pointer.type === "component") {
    const files = extractFilesFromPointer(impulse.pointer)
    
    for (const file of files) {
      try {
        const impactResult = await metabob.analyzeChangeImpact(file, null, 2)
        const impactScore = Math.min(impactResult.direct_dependents / 100.0, 1.0)
        
        // Boost score by impact (max +0.5)
        score += impactScore * 0.5
        
        log.debug(`CPG impact boost for ${file}: +${(impactScore * 0.5).toFixed(2)}`)
      } catch (error) {
        // Graceful degradation if CPG unavailable
        log.debug(`CPG impact unavailable for ${file}: ${error}`)
      }
    }
  }
  
  return score
}
```

**Testing Requirements**:
1. Unit test: CPG impact adds to score correctly
2. Unit test: Graceful degradation if CPG unavailable
3. Unit test: Cache prevents duplicate CPG queries
4. Integration test: High-impact impulses prioritized over low-impact

**Success Criteria**:
- ✅ High-impact components prioritized in context selection
- ✅ CPG queries cached to avoid performance overhead
- ✅ Graceful degradation without CPG (system still works)
- ✅ Visible in logs: "CPG impact boost: +0.25 for auth.py"

**Activity Variables**:
```json
{
  "featureName": "impulse-cpg-prioritization",
  "files": [
    "repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts"
  ],
  "description": "Score impulses by CPG impact to prioritize high-impact components",
  "testStrategy": "unit tests for scoring logic, integration test for prioritization"
}
```

---

## 🚀 Quick Win #3: CPG-Powered Test Selection

### Feature Specification

**Goal**: New MCP tool to select only tests affected by changed files using CPG

**Files to Create/Modify**:
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` (add new tool)
- `repos/metabob-cli/tests/mcp/test_select_relevant_tests.py` (tests)

**Implementation Details**:

1. **Create new MCP tool**: `select_relevant_tests()`
2. **Use CPG dependency analysis**: For each changed file, find dependents
3. **Filter test files**: Match pattern (e.g., `test_*.py`, `*.test.ts`)
4. **Return test list**: Deduplicated, sorted by relevance

**Code Implementation**:
```python
# In tools.py

@server.call_tool()
async def select_relevant_tests(
    changed_files: list[str],
    test_pattern: str = "test_*.py",
    max_depth: int = 2
) -> dict:
    """Select tests affected by changed files using CPG dependency analysis.
    
    Args:
        changed_files: Files that changed (relative to project root)
        test_pattern: Glob pattern for test files (default: test_*.py)
        max_depth: Depth of dependency traversal (default: 2)
        
    Returns:
        {
            "status": "success",
            "test_files": ["path/to/test1.py", ...],
            "total_tests": 15,
            "reason": "Selected based on CPG dependency analysis"
        }
    """
    try:
        affected_tests = set()
        
        for file_path in changed_files:
            # Get all components in the file
            components_result = await list_file_components(file_path)
            
            if components_result["status"] != "success":
                continue
            
            # For each component, find dependents
            for comp in components_result.get("components", []):
                component_id = f"{file_path}::{comp['name']}"
                
                # Analyze what depends on this component
                impact = await analyze_change_impact(
                    file_path=file_path,
                    component_name=comp["name"],
                    max_depth=max_depth
                )
                
                if impact["status"] != "success":
                    continue
                
                # Extract test files from dependents
                for dep in impact.get("transitive_dependents", []):
                    dep_file = dep.split("::")[0]
                    
                    # Check if matches test pattern
                    if fnmatch.fnmatch(dep_file, test_pattern):
                        affected_tests.add(dep_file)
        
        test_list = sorted(list(affected_tests))
        
        return {
            "status": "success",
            "test_files": test_list,
            "total_tests": len(test_list),
            "changed_files": changed_files,
            "reason": f"Selected {len(test_list)} tests based on CPG dependency analysis"
        }
        
    except Exception as e:
        logger.error(f"Error selecting relevant tests: {e}")
        return {
            "status": "error",
            "error": str(e),
            "test_files": [],
            "total_tests": 0
        }
```

**Testing Requirements**:
1. Unit test: Returns correct tests for simple dependency
2. Unit test: Handles missing CPG data gracefully
3. Unit test: Test pattern matching works (*.test.ts, test_*.py)
4. Integration test: Real CPG with actual test files

**Success Criteria**:
- ✅ Tool returns only affected tests (not all tests)
- ✅ Graceful degradation if CPG unavailable (return all tests or error)
- ✅ Performance: < 100ms for typical project
- ✅ Integrated into test activity templates

**Activity Variables**:
```json
{
  "featureName": "cpg-test-selection",
  "files": [
    "repos/metabob-cli/src/metabob_cli/mcp/tools.py",
    "repos/metabob-cli/tests/mcp/test_select_relevant_tests.py"
  ],
  "description": "New MCP tool to select only tests affected by changed files using CPG dependency analysis",
  "testStrategy": "comprehensive unit and integration tests for test selection accuracy"
}
```

---

## 📊 Execution Plan

### Phase 1: Setup & Verification (30 minutes)

**Tasks**:
1. ✅ Verify CPG is working (check `~/.metabob/.metabob/cpg_cache.db`)
2. ✅ Test existing MCP tools (analyze_change_impact, suggest_related_changes)
3. ✅ Review current code structure (template-executor.ts, impulse-resolver.ts)
4. ✅ Set up monitoring/logging for CPG queries

**Commands**:
```bash
# Check CPG cache
sqlite3 ~/.metabob/.metabob/cpg_cache.db "SELECT COUNT(*) FROM components;"

# Test MCP tools (via OpenCode)
opencode chat
# Then: await metabob.analyzeChangeImpact("auth.py", "login", 2)
# Then: await metabob.suggestRelatedChanges(["auth.py"], { top_k: 3 })
```

---

### Phase 2: Quick Win #1 - Activity Co-Change (4 hours)

**Execution**:
```bash
opencode activity \
  --activityId add-feature-complete \
  --variables '{
    "featureName": "activity-cochange-workflow",
    "files": [
      "repos/metabob-opencode/packages/opencode/src/session/template-executor.ts",
      "repos/metabob-opencode/packages/opencode/src/util/metabob.ts"
    ],
    "description": "Auto-suggest related files after activity tasks and create follow-up tasks for critical issues",
    "testStrategy": "unit + integration tests for co-change workflow"
  }' \
  --reason "Implement CPG Quick Win #1 to prevent regression bugs by proactively suggesting related files that often change together"
```

**Verification**:
1. Run activity that modifies files
2. Check logs for "Co-change analysis: Added follow-up task..."
3. Verify follow-up tasks created in activity
4. Measure: co-change suggestions appear in agent context

---

### Phase 3: Quick Win #2 - Impulse Prioritization (3 hours)

**Execution**:
```bash
opencode activity \
  --activityId add-feature-complete \
  --variables '{
    "featureName": "impulse-cpg-prioritization",
    "files": [
      "repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts"
    ],
    "description": "Score impulses by CPG impact to prioritize high-impact components",
    "testStrategy": "unit tests for scoring logic, integration test for prioritization"
  }' \
  --reason "Implement CPG Quick Win #2 to improve context utilization by prioritizing high-impact components when context budget is tight"
```

**Verification**:
1. Create impulses for high-impact and low-impact files
2. Check logs for "CPG impact boost: +0.X for file.py"
3. Verify high-impact impulses loaded first
4. Measure: context contains more high-impact components

---

### Phase 4: Quick Win #3 - Test Selection (6 hours)

**Execution**:
```bash
opencode activity \
  --activityId add-feature-complete \
  --variables '{
    "featureName": "cpg-test-selection",
    "files": [
      "repos/metabob-cli/src/metabob_cli/mcp/tools.py",
      "repos/metabob-cli/tests/mcp/test_select_relevant_tests.py"
    ],
    "description": "New MCP tool to select only tests affected by changed files using CPG dependency analysis",
    "testStrategy": "comprehensive unit and integration tests for test selection accuracy"
  }' \
  --reason "Implement CPG Quick Win #3 to reduce test execution time by 50%+ through intelligent test selection based on CPG dependencies"
```

**Verification**:
1. Test with known file → test dependencies
2. Call `select_relevant_tests(["auth.py"])`
3. Verify only related tests returned (not all tests)
4. Measure: test execution time reduction

---

### Phase 5: Integration & Measurement (1 hour)

**Tasks**:
1. Run full test suite to verify no regressions
2. Measure baseline metrics:
   - Co-change accuracy (track over 10 activities)
   - Context efficiency (high-impact components %)
   - Test selection time savings
3. Document results in `CPG_IMPLEMENTATION_RESULTS.md`
4. Update activity templates to use new features

---

## 📏 Success Metrics

### Quantitative Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Co-change accuracy | Not measured | >70% | Track predicted vs actual over 10 activities |
| Context high-impact % | Not measured | >60% | % of context items with CPG impact >0.5 |
| Test execution time | 100% (all tests) | <50% (selected) | Time to run tests with vs without selection |
| False negatives (tests) | N/A | <5% | Missed tests that should have run |
| CPG query overhead | N/A | <50ms per task | Time spent on CPG queries per activity task |

### Qualitative Metrics

| Metric | Measurement |
|--------|-------------|
| Agent mentions related files | Count in 10 activity logs |
| Follow-up tasks created | Count in 10 activities |
| High-impact issues fixed earlier | Before vs after comparison |
| Developer satisfaction | Survey (perceived quality improvement) |

---

## 🐛 Rollback Plan

If any Quick Win causes issues:

### Quick Win #1: Activity Co-Change
**Rollback**: Add config flag `metabob.activities.cochange_prediction.enabled: false`
**Partial rollback**: Set threshold higher (0.9 instead of 0.7) to reduce false positives

### Quick Win #2: Impulse Prioritization  
**Rollback**: Add config flag `metabob.impulse.cpg_scoring: false`
**Partial rollback**: Reduce impact weight (0.25 instead of 0.5)

### Quick Win #3: Test Selection
**Rollback**: Don't use tool, run all tests as before
**Partial rollback**: Reduce max_depth to 1 (only direct dependencies)

---

## 📝 Documentation Updates

After implementation, update these docs:

1. **CPG_IMPLEMENTATION_RESULTS.md** (create new)
   - Actual time spent vs estimates
   - Metrics collected (before/after)
   - Issues encountered and resolutions
   - Lessons learned

2. **CPG_COCHANGE_MAXIMIZATION_GUIDE.md** (update)
   - Mark Phase 1 Quick Wins as "✅ Implemented"
   - Add "Lessons Learned" section
   - Update code examples if implementation differed

3. **Activity Template Docs** (update)
   - Document new co-change workflow behavior
   - Add examples of follow-up tasks
   - Update best practices

4. **Metabob MCP Tools Docs** (update)
   - Add `select_relevant_tests()` to tool list
   - Examples and usage patterns

---

## 🎯 Next Steps After Quick Wins

Once Quick Wins are complete and validated:

### Phase 2: High-Impact Features (1 week)
4. Proactive issue detection (background worker)
5. Activity learning pipeline (store co-change accuracy)
6. REST API exposure (metabob-rpc-api endpoints)

### Phase 3: Infrastructure (2 weeks)
7. Distributed CPG (Redis backend)
8. Visualization dashboard (D3.js graphs)
9. Model fine-tuning pipeline

---

**Ready to Execute**: Start with Phase 1 verification, then proceed to Phase 2 (Quick Win #1)! 🚀
