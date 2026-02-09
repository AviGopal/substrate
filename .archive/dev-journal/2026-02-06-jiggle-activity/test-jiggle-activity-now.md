# Testing Jiggle-Documentation Activity

**Date**: 2026-02-07
**Test**: Verify activity execution through OpenCode activity tool

## Test Setup

### Prerequisites
- ✅ Backend running at http://localhost:8080
- ✅ Activity template exists: `repos/metabob-proto/activities/bootstrap/jiggle-documentation.json`
- ✅ OpenCode executable available
- ✅ Project has opencode.json config

### Test Plan

We'll test the activity execution in two ways:

1. **Direct execution test** - Use the `activity` tool within an OpenCode session
2. **Verification test** - Confirm generated outputs match expectations

## Test 1: Activity Tool Execution

### Command
```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "root directory only",
    recentDays: 7,
    mediumDays: 14,
    obsoleteDays: 30,
    mode: "dryRun",
    archiveInsteadOfDelete: true
  },
  reason: "Test jiggle activity with focused scope on recent files"
})
```

### Expected Behavior
- Activity should be found in the system
- Should execute 4 tasks sequentially
- Should generate analysis reports
- Should complete successfully in dry-run mode

### Expected Outputs
- `doc-jiggle-analysis.md` - File inventory by date
- `doc-percolation-plan.md` - Content consolidation proposals
- `doc-deletion-plan.md` - Obsolete file candidates
- `doc-jiggle-summary.md` - Comprehensive summary

## Test 2: Verification

### Checks
1. **Template accessibility**: Can the activity system find jiggle-documentation?
2. **Variable substitution**: Are the custom variables properly applied?
3. **Task execution**: Do all 4 tasks complete?
4. **Output generation**: Are the expected files created?
5. **Content quality**: Do reports contain analysis results?

## Current Status

The activity template has been:
- ✅ Created with comprehensive structure
- ✅ Placed in bootstrap directory
- ✅ Validated for JSON structure
- ✅ Previously executed successfully (old reports exist)

**Test Goal**: Confirm the activity is accessible via the `activity` tool in the current session.

## Known Issues

From previous testing:
- Activity registration system has known bugs
- `activity` tool may not find activities even if templates exist
- Workaround: Direct execution via CLI may be needed

## Test Execution Log

*This section will be updated during test execution*

---

**Note**: This test focuses on the activity system integration, not the jiggle functionality itself (which has already been validated).
