# Filtered Documentation Jiggling Plan

**Generated**: 2026-02-08  
**Mode**: APPLY (with Metabob MCP configuration filtering)  
**Objective**: Improve documentation organization while excluding internal system components

---

## Important Filtering Criteria

**EXCLUDE from user-facing documentation:**
- Metabob MCP configuration examples
- `.opencode/opencode.json` setup for Metabob
- Internal Metabob integration details
- Metabob as a general MCP server example

**Reason**: Metabob is an internal system component managed by OpenCode infrastructure, not a user-configurable MCP tool.

---

## Phase 1: Critical Percolations (User-Facing Only)

### 1. Activity System Production-Ready Status → Architecture Docs ✅

**Source**: `ACTIVITY_RELIABILITY_SOLUTION.md`  
**Target**: `README_ARCHITECTURE_DOCS.md`  
**Action**: Add production-ready status WITHOUT Metabob MCP config details

Content to add:
- Activity system is production-ready (4/4 tests passed)
- Thompson Sampling learning enabled
- 8 bootstrap templates available
- Usage: `activity({ activityId: "bug-fix", variables: {...} })`
- Link to complete documentation

**SKIP**: MCP configuration section (lines 90-147 in original plan)

### 2. Tool Simplification (10+ → 2 tools) → Package README ✅

**Source**: `README_IMPLEMENTATION_COMPLETE.md`  
**Target**: `repos/metabob-opencode/packages/opencode/README.md`  
**Action**: Document the tool simplification UX improvement

Content:
- 95% reduction in exposed tools (10+ → 2)
- Focus on orchestration vs implementation
- Debug mode for advanced features
- Better template quality and validation

### 3. Session Memory Agent Transformation → Architecture Docs ✅

**Source**: `SESSION_MEMORY_AGENT_RESPONSIBILITIES.md`  
**Target**: `README_ARCHITECTURE_DOCS.md`  
**Action**: Document architectural transformation

Content:
- Router → Intelligent Context Manager
- Hint-driven impulse creation
- Budget monitoring and overflow prevention
- Component learning (planned)

### 4. Async Analysis Default → CLI README ✅

**Source**: `repos/metabob-cli/README.md`  
**Target**: Same file (reorder for prominence)  
**Action**: Move async analysis section to Quick Start

Content:
- Async is now default (breaking change)
- 3-5x faster than sync mode
- Real-time WebSocket monitoring
- How to use sync mode if needed

### 5. CPG Features Prominence → CLI README ✅

**Source**: `repos/metabob-cli/README.md` (buried deep)  
**Target**: Same file (create dedicated section)  
**Action**: Create prominent "Code Property Graph Features" section

Content:
- Change impact analysis
- Co-change pattern detection
- Safe deletion assessment
- Component relationship mapping

---

## Phase 2: Archive Development History

### Archive Structure

```
.archive/
├── dev-journal/
│   ├── 2026-02-05-conversation-patterns/
│   ├── 2026-02-06-session-memory/
│   ├── 2026-02-06-activity-system/
│   ├── 2026-02-07-activity-reliability/
│   └── 2026-02-07-tool-integration/
├── test-reports/
│   └── 2026-02-06/
├── task-completion/
│   └── 2026-02-06/
└── doc-analysis-iterations/
```

### Files to Archive (~60 files)

**Session Memory Journey** (8 files):
- IMPLEMENTATION_COMPLETE.md (superseded by SESSION_MEMORY_FINAL.md)
- FINAL_SUMMARY_SESSION_MEMORY.md
- SESSION_MEMORY_DIAGNOSTIC.md
- DIAGNOSTIC_NO_LOGS.md
- REAL_ISSUE_FOUND.md
- TIMEOUT_FIX_APPLIED.md
- PROMPT_SIZE_ANALYSIS.md
- PROMPT_NOT_LARGE.md

**Activity System Journey** (9 files):
- ACTIVITY_ORCHESTRATION_ISSUE.md
- ACTIVITY_ORCHESTRATION_FIXES.md
- ACTIVITY_EXECUTION_FIX_REPORT.md
- ALGORITHMIC_VALIDATION_STRATEGY.md
- EMPIRICAL_VALIDATION_FRAMEWORK.md
- TRACEABLE_DATA_FLOW.md
- ACTIVITY_SYSTEM_FINAL_STATUS.md
- VARIANT_RESOLUTION_FIX_REPORT.md

**MCP Execution Journey** (7 files):
- ACTUAL_LOG_SEQUENCE.md
- ACTUAL_EXECUTION_SEQUENCE.md
- NEW_TOOL_BASED_SEQUENCE.md
- MCP_EXECUTION_IMPLEMENTATION_SUMMARY.md
- MCP_EXECUTION_IMPLEMENTATION_DELIVERABLE.md
- TASK_COMPLETION_SUMMARY.md
- FINAL_VERIFICATION_SUMMARY.md

**Tool Integration** (3 files):
- ACTIVITY_TOOL_MCP_INTEGRATION_COMPLETE.md
- ACTIVITY_TOOL_INTEGRATION_VISUAL.md
- TUI_SIDEBAR_ISSUE.md

**Jiggle Activity** (6 files):
- test-jiggle-activity-now.md
- JIGGLE_ACTIVITY_STATUS.md
- jiggle-documentation-visual.md
- JIGGLE_ACTIVITY_VISUAL.md
- ACTIVITY_TEST_SUMMARY.md
- ACTIVITY_SYSTEM_TEST_SUMMARY.md

**Analysis Work** (4 files):
- doc-jiggle-analysis.md (superseded by doc-jiggle-analysis-new.md)
- doc-jiggle-analysis-dated.md (superseded)
- SYMBOL_TRANSITION_MAP.md
- STORAGE_CACHE_EXPLANATION.md

**Duplicates** (10+ files):
- IMPLEMENTATION_COMPLETE_SUMMARY.md (dup of README_IMPLEMENTATION_COMPLETE.md)
- TASK_9_COMPLETE_SUMMARY.md (dup of TASK_9_OPENCODE_PROTO_INTEGRATION.md)
- Various session memory duplicates

### Keep in Root

**Current Status** (12 files):
- ACTIVITY_RELIABILITY_SOLUTION.md ⭐
- MISSION_COMPLETE.md ⭐
- JIGGLE_ACTIVITY_READY.md ⭐
- SESSION_MEMORY_FINAL.md ⭐
- COMPLETE_MEMORY_AGENT_IMPLEMENTATION.md ⭐
- SESSION_MEMORY_AGENT_RESPONSIBILITIES.md ⭐
- SESSION_COMPLETE_MCP_EXECUTION.md ⭐
- README_IMPLEMENTATION_COMPLETE.md ⭐
- README_MCP_EXECUTION.md ⭐
- README_ARCHITECTURE_DOCS.md ⭐
- CONTEXT_OVERFLOW_PREVENTION_IMPL.md ⭐
- SESSION_MEMORY_CONTEXT_MANAGEMENT_DESIGN.md ⭐

---

## Phase 3: Consolidate Duplicates

### Priority Consolidations

1. **Session Memory Implementation** (2 files)
   - Keep: `SESSION_MEMORY_FINAL.md` (most comprehensive)
   - Archive: `IMPLEMENTATION_COMPLETE.md` (merge unique content)

2. **Doc Analysis Iterations** (3 files)
   - Keep: `doc-jiggle-analysis-new.md` (newest)
   - Archive: `doc-jiggle-analysis.md`, `doc-jiggle-analysis-dated.md`

3. **Activity Test Summaries** (2 files)
   - Merge into: Single `ACTIVITY_TEST_SUMMARY.md`
   - Archive: `ACTIVITY_SYSTEM_TEST_SUMMARY.md`

4. **Implementation Complete Docs** (2 files)
   - Keep: `README_IMPLEMENTATION_COMPLETE.md`
   - Archive: `IMPLEMENTATION_COMPLETE_SUMMARY.md`

5. **Task 9 Completion** (2 files)
   - Keep: `TASK_9_OPENCODE_PROTO_INTEGRATION.md`
   - Archive: `TASK_9_COMPLETE_SUMMARY.md`

---

## Implementation Steps

### Step 1: Create Archive Structure (10 min)
```bash
mkdir -p .archive/dev-journal/{2026-02-05-conversation-patterns,2026-02-06-session-memory,2026-02-06-activity-system,2026-02-07-activity-reliability,2026-02-07-tool-integration}
mkdir -p .archive/{test-reports/2026-02-06,task-completion/2026-02-06,doc-analysis-iterations}
```

### Step 2: Percolate Critical Content (60 min)
- Update README_ARCHITECTURE_DOCS.md with filtered content
- Update repos/metabob-opencode/packages/opencode/README.md
- Reorder repos/metabob-cli/README.md sections

### Step 3: Archive Development History (30 min)
- Move superseded files with git mv
- Create README.md in each archive directory

### Step 4: Consolidate Duplicates (30 min)
- Merge unique content from duplicates
- Archive superseded versions

### Step 5: Update Cross-References (20 min)
- Search for broken links
- Update references to archived files

---

## Validation Checklist

- [ ] All foundational docs remain in root
- [ ] Current status docs remain in root
- [ ] Archive READMEs explain context
- [ ] No broken links in active docs
- [ ] .archive directory tracked in git
- [ ] Activity system status is prominent
- [ ] Tool simplification is documented
- [ ] Session memory architecture is clear
- [ ] Async analysis is in Quick Start
- [ ] NO Metabob MCP config in user docs

---

## Expected Outcomes

**Before**:
- Root: 175 markdown files
- Navigation: Difficult
- Clarity: Mixed current + historical
- Metabob MCP: Incorrectly shown as user-configurable

**After**:
- Root: ~115 markdown files
- Navigation: Clear structure
- Clarity: Current prominent, history archived
- Metabob MCP: Correctly treated as internal
- All history preserved

**Time Savings**:
- Onboarding: 2-3 hrs → 30 min (83% faster)
- First activity: 45 min → 15 min (67% faster)

---

## Summary

This filtered plan implements all valuable documentation improvements from the jiggle analysis while correctly excluding Metabob MCP configuration from user-facing setup guides. Metabob integration is an internal system component and should not be documented as a general-purpose MCP server that users need to configure.
