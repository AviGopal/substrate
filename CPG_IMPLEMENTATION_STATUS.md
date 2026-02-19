# CPG Quick Wins Implementation Status

**Current Status**: Phase 1 Complete - Ready for Implementation  
**Date**: 2026-02-19

---

## ✅ Phase 1: Setup & Verification - COMPLETE

### CPG Status
- **CPG Cache Location**: `repos/metabob-cli/.metabob/.metabob/cpg_cache.db`
- **Components Indexed**: 2,051 components
- **Tables**: `components`, `file_mappings`
- **Status**: ✅ **Operational**

### MCP Tools Available
The following CPG-powered MCP tools are available and ready:
- ✅ `analyze_change_impact` - Dependency and impact analysis
- ✅ `suggest_related_changes` - Co-change prediction
- ✅ `list_file_components` - Component extraction
- ✅ `get_priority_issues` - CPG-enhanced prioritization

### Code Structure Verified
- ✅ `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts` - Activity execution engine
- ✅ `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts` - Impulse resolution
- ✅ `repos/metabob-cli/src/metabob_cli/mcp/tools.py` - MCP tools implementation
- ✅ `repos/metabob-cli/src/metabob_cli/mcp/cpg_manager.py` - CPG manager wrapper

---

## 📋 Implementation Queue

### 🔥 Quick Win #1: Activity-Driven Co-Change Workflow
**Status**: Ready to implement  
**Estimated Time**: 4 hours  
**Priority**: HIGH

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (helper functions)

**Implementation Approach**: Use `add-feature-complete` activity template

**Command**:
```bash
cd repos/metabob-opencode && opencode activity \
  --activityId add-feature-complete \
  --variables '{
    "featureName": "activity-cochange-workflow",
    "files": [
      "packages/opencode/src/session/template-executor.ts",
      "packages/opencode/src/util/metabob.ts"
    ],
    "description": "Auto-suggest related files after activity tasks and create follow-up tasks for critical issues. After each task execution, query metabob.suggestRelatedChanges() and filter for files with cochange_score > 0.7 and high_severity_issues > 0. Dynamically add follow-up tasks to the activity for agent review.",
    "testStrategy": "Unit tests for co-change analysis logic, integration test for full activity execution with follow-up tasks"
  }' \
  --reason "Implement CPG Quick Win #1 to prevent regression bugs by proactively suggesting related files that often change together"
```

---

### 🔥 Quick Win #2: Impulse Context Prioritization
**Status**: Queued  
**Estimated Time**: 3 hours  
**Priority**: HIGH

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`

**Implementation Approach**: Use `add-feature-complete` activity template

**Command**:
```bash
cd repos/metabob-opencode && opencode activity \
  --activityId add-feature-complete \
  --variables '{
    "featureName": "impulse-cpg-prioritization",
    "files": [
      "packages/opencode/src/session/impulse-resolver.ts"
    ],
    "description": "Score impulses by CPG impact to prioritize high-impact components. Add CPG impact boost to impulse scoring: query metabob.analyzeChangeImpact() for files referenced in impulse pointer, normalize impact score (direct_dependents / 100), and add up to +0.5 to base score. Include graceful degradation if CPG unavailable.",
    "testStrategy": "Unit tests for CPG scoring logic with mocked metabob calls, integration test verifying high-impact impulses load first"
  }' \
  --reason "Implement CPG Quick Win #2 to improve context utilization by prioritizing high-impact components when context budget is tight"
```

---

### 🔥 Quick Win #3: CPG-Powered Test Selection
**Status**: Queued  
**Estimated Time**: 6 hours  
**Priority**: MEDIUM

**Files to Create/Modify**:
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` (add new tool)
- `repos/metabob-cli/tests/mcp/test_select_relevant_tests.py` (new test file)

**Implementation Approach**: Use `add-feature-complete` activity template

**Command**:
```bash
cd repos/metabob-cli && opencode activity \
  --activityId add-feature-complete \
  --variables '{
    "featureName": "cpg-test-selection",
    "files": [
      "src/metabob_cli/mcp/tools.py",
      "tests/mcp/test_select_relevant_tests.py"
    ],
    "description": "New MCP tool select_relevant_tests() that uses CPG dependency analysis to select only tests affected by changed files. For each changed file, get components via list_file_components(), analyze dependencies via analyze_change_impact(max_depth=2), extract test files from transitive_dependents using glob pattern matching (test_*.py, *.test.ts). Return deduplicated sorted list of test files.",
    "testStrategy": "Unit tests for test selection logic with mocked CPG data, integration test with real CPG showing test selection accuracy"
  }' \
  --reason "Implement CPG Quick Win #3 to reduce test execution time by 50%+ through intelligent test selection based on CPG dependencies"
```

---

## 📊 Success Criteria

### Quick Win #1: Activity Co-Change
- [ ] Follow-up tasks automatically created for related files (cochange_score > 0.7, issues > 0)
- [ ] Logs show "Co-change analysis: Added follow-up task for N related files"
- [ ] No performance degradation (< 50ms overhead per task)
- [ ] Tests passing (unit + integration)

### Quick Win #2: Impulse Prioritization
- [ ] High-impact impulses (CPG impact > 0.5) loaded before low-impact
- [ ] Logs show "CPG impact boost: +0.X for file.py"
- [ ] Graceful degradation without CPG (system still works)
- [ ] Tests passing (unit + integration)

### Quick Win #3: Test Selection
- [ ] Tool returns only affected tests (not all tests)
- [ ] Performance: < 100ms for typical project
- [ ] Graceful degradation if CPG unavailable
- [ ] Tests passing (unit + integration with real CPG)

---

## 🎯 Next Steps

1. **Execute Quick Win #1** (use command above)
2. **Verify implementation** (check logs, run tests, measure overhead)
3. **Document results** (add to this file)
4. **Execute Quick Win #2** (use command above)
5. **Execute Quick Win #3** (use command above)
6. **Collect metrics** (co-change accuracy, context efficiency, test time)
7. **Update documentation** (CPG_COCHANGE_MAXIMIZATION_GUIDE.md)

---

## 📝 Implementation Log

### [Date/Time] - Quick Win #1: Activity Co-Change Workflow
**Status**: Pending  
**Activity ID**: (will be filled after execution)  
**Results**: (will be filled after verification)

### [Date/Time] - Quick Win #2: Impulse Prioritization
**Status**: Pending  
**Activity ID**: (will be filled after execution)  
**Results**: (will be filled after verification)

### [Date/Time] - Quick Win #3: Test Selection
**Status**: Pending  
**Activity ID**: (will be filled after execution)  
**Results**: (will be filled after verification)

---

**Ready to proceed with Quick Win #1!** 🚀

Run the command from the "Quick Win #1" section above to start implementation.
