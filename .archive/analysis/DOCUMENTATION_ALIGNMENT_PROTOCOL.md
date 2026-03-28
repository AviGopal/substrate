# Documentation Alignment Protocol

**Purpose**: Coordination framework for multi-agent collaboration where one agent handles code changes and another handles documentation alignment through "jiggling"

**Generated**: 2026-02-08  
**Status**: Active Protocol

---

## Agent Roles & Responsibilities

### Code Agent (Primary Implementation)
**Scope**: All code changes, implementations, refactoring
**Responsibilities**:
- Implement features and fixes
- Run tests and validation
- Create initial commit messages
- Notify documentation agent of changes

**Outputs**:
- Modified code files
- Test results
- Initial change summary
- List of changed files

### Documentation Agent (This Agent)
**Scope**: Documentation alignment, conflict detection, plan updates
**Responsibilities**:
- Perform jiggling analysis on documentation
- Detect intent conflicts between docs and code changes
- Update code agent's plan with new information
- Maintain documentation coherence
- Archive obsolete documentation

**Outputs**:
- Documentation analysis reports
- Conflict detection reports
- Updated plan recommendations
- Percolation summaries

---

## Jiggling Process Overview

**Definition**: Sorting documentation in reverse chronological order to detect intent conflicts, percolate valuable content, and remove obsolescence.

### Three-Phase Process

#### Phase 1: Analysis
**Input**: Repository state, recent code changes
**Process**:
1. Scan all *.md files
2. Get modification timestamps (git log)
3. Sort by date (newest → oldest)
4. Categorize by age:
   - Recent (< 30 days)
   - Medium (30-90 days)
   - Stale (90-180 days)
   - Obsolete (> 180 days)
5. Detect duplicates and conflicts

**Output**: `doc-jiggle-analysis.md`

#### Phase 2: Percolation
**Input**: Analysis report, recent changes
**Process**:
1. Identify foundational documents (README, architecture)
2. Extract valuable details from recent docs
3. Determine if details belong in foundational docs
4. Copy/move content with proper attribution
5. Update cross-references

**Output**: `doc-percolation-plan.md` (dryRun) or `doc-percolation-summary.md` (apply)

#### Phase 3: Cleanup
**Input**: Analysis report, percolation results
**Process**:
1. Review obsolete candidates
2. Apply deletion criteria (ALL must be true):
   - Age > threshold
   - Content outdated/superseded
   - Not referenced elsewhere
   - Not foundational
   - No valuable content to percolate
3. Archive (default) or delete
4. Update references

**Output**: `doc-deletion-plan.md` (dryRun) or `doc-deletion-summary.md` (apply)

---

## Intent Conflict Detection

### What is an Intent Conflict?

An intent conflict occurs when documentation states or implies one approach/decision while code changes implement a different approach.

### Detection Strategy

**1. Chronological Scanning**
```
For each recent doc (newest → oldest):
  - Extract stated intents, decisions, approaches
  - Compare with code agent's change summary
  - Flag mismatches
```

**2. Conflict Types**

| Type | Example | Resolution |
|------|---------|------------|
| **Design Decision** | Doc says "use sync API", code implements async | Update doc or revert code |
| **Architecture** | Doc describes old pattern, code uses new pattern | Percolate new pattern to foundational docs |
| **Configuration** | Doc specifies old config, code uses new config | Update getting started guides |
| **Deprecation** | Doc recommends old approach, code deprecates it | Add deprecation notices, update examples |
| **Feature Status** | Doc says "experimental", code marks "stable" | Update status badges and documentation |

**3. Conflict Severity**

- 🔴 **CRITICAL**: Code changes break documented API/behavior
- 🟡 **HIGH**: Code implements different design than documented
- 🟢 **MEDIUM**: Documentation outdated but not wrong
- ⚪ **LOW**: Minor inconsistencies or style differences

---

## Coordination Workflow

### Step 1: Code Agent Notifies of Changes

**Format**:
```markdown
## Code Changes Summary

**Branch**: feature/add-authentication
**Files Changed**: 12 files
**Change Type**: Feature Implementation

### Key Changes
- Added JWT authentication system
- Migrated from sync to async API calls
- Updated configuration schema (v2)
- Deprecated old session management

### Intent
Implement modern async authentication with JWT tokens,
replacing synchronous session-based auth.

### Files
- src/auth/jwt.ts (new)
- src/auth/session.ts (deprecated)
- config/auth.yaml (schema v1 → v2)
- ...
```

### Step 2: Documentation Agent Runs Jiggling

**Trigger**: On receiving code change notification

**Process**:
```bash
# 1. Run jiggling analysis
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 7,  // Focus on recent changes
    mode: "dryRun"
  },
  reason: "Detect conflicts with recent code changes"
})

# 2. Extract conflicts from analysis
# 3. Generate conflict report
# 4. Update code agent's plan
```

### Step 3: Conflict Report Generation

**Output**: `DOCUMENTATION_CONFLICTS_<timestamp>.md`

**Format**:
```markdown
# Documentation Conflicts Detected

**Analysis Date**: 2026-02-08
**Code Changes**: feature/add-authentication (12 files)

## 🔴 CRITICAL Conflicts (2)

### Conflict #1: Authentication Method Change
**Location**: docs/authentication.md (lines 15-42)
**Documentation States**: "Use session-based authentication with cookies"
**Code Implements**: JWT token-based authentication
**Severity**: CRITICAL - Documented approach deprecated
**Impact**: New users will follow wrong implementation guide

**Recommendation**: 
- Update docs/authentication.md with JWT approach
- Add migration guide from session to JWT
- Mark session approach as deprecated

### Conflict #2: Configuration Schema Version
**Location**: README.md (lines 78-85), config/README.md
**Documentation States**: Configuration schema v1 examples
**Code Implements**: Configuration schema v2 (breaking changes)
**Severity**: CRITICAL - Documented config won't work
**Impact**: Users cannot configure application correctly

**Recommendation**:
- Update all config examples to v2
- Add v1 → v2 migration section
- Update getting started guide

## 🟡 HIGH Conflicts (3)

### Conflict #3: API Synchronicity
**Location**: api/reference.md (all examples)
**Documentation States**: All examples use synchronous APIs
**Code Implements**: Async-first APIs
**Severity**: HIGH - Examples won't work as shown
**Impact**: Code examples fail for new users

**Recommendation**:
- Convert all examples to async/await
- Add "Async by Default" notice at top
- Provide sync fallback examples in appendix

...

## Summary

- **Total Conflicts**: 8
- **Critical**: 2 (must fix before merge)
- **High**: 3 (should fix before merge)
- **Medium**: 2 (fix in documentation sweep)
- **Low**: 1 (cosmetic)

## Updated Plan for Code Agent

Based on detected conflicts, recommend:

1. **Block merge** until CRITICAL conflicts resolved
2. **Add to code PR**:
   - Update README.md config examples
   - Add deprecation notices to old code
   - Update inline documentation
3. **Create follow-up documentation PR**:
   - Full authentication guide rewrite
   - API reference async conversion
   - Migration guide creation
```

### Step 4: Plan Update for Code Agent

**File**: `CODE_AGENT_PLAN_UPDATE.md`

**Format**:
```markdown
# Code Agent Plan Update

**Triggered by**: Documentation conflict analysis
**Date**: 2026-02-08

## Required Before Merge

- [ ] Update README.md config examples (v1 → v2)
- [ ] Add deprecation warnings in src/auth/session.ts
- [ ] Update CHANGELOG.md with breaking changes

## Recommended Additions to PR

- [ ] Add docs/migration/v1-to-v2.md guide
- [ ] Update getting started with JWT setup
- [ ] Add inline code comments explaining async approach

## Follow-up Documentation Work

- [ ] Rewrite docs/authentication.md (comprehensive)
- [ ] Convert all API examples to async
- [ ] Update architecture diagrams
- [ ] Create video tutorial for new auth flow

## Modified Success Criteria

Original: "Implement JWT authentication"

Updated:
- Implement JWT authentication ✓
- Update configuration examples ← NEW
- Add deprecation notices ← NEW
- Document migration path ← NEW
- Ensure no CRITICAL doc conflicts ← NEW
```

### Step 5: Iterative Refinement

**Loop**:
1. Code agent reviews plan update
2. Code agent makes additional changes
3. Documentation agent re-runs jiggling
4. Repeat until conflicts ≤ MEDIUM severity

---

## Automation Triggers

### When to Run Jiggling

**Automatic Triggers**:
- ✅ Code agent commits to feature branch
- ✅ PR opened by code agent
- ✅ Scheduled (daily for active branches)

**Manual Triggers**:
- 🔘 Code agent requests doc review
- 🔘 Before merging to main
- 🔘 After significant refactoring

### Jiggling Frequency

| Scenario | Frequency | Mode |
|----------|-----------|------|
| **Active development** | Every commit | dryRun (analysis only) |
| **Pre-merge** | Once before PR | dryRun + conflict detection |
| **Post-merge** | Once after merge | apply (percolate and cleanup) |
| **Maintenance** | Weekly | apply (full refresh) |

---

## Communication Protocol

### Code Agent → Documentation Agent

**Message Format**:
```json
{
  "type": "code_change_notification",
  "branch": "feature/add-authentication",
  "files_changed": ["src/auth/jwt.ts", "config/auth.yaml", ...],
  "change_summary": "Implemented JWT authentication with async API",
  "intent": "Replace session-based auth with JWT tokens",
  "timestamp": "2026-02-08T15:00:00Z",
  "request_doc_review": true
}
```

### Documentation Agent → Code Agent

**Message Format**:
```json
{
  "type": "documentation_analysis_complete",
  "analysis_id": "jiggle-20260208-150500",
  "conflicts_detected": 8,
  "critical_conflicts": 2,
  "blocking": true,
  "reports": [
    "DOCUMENTATION_CONFLICTS_20260208.md",
    "CODE_AGENT_PLAN_UPDATE.md"
  ],
  "recommendations": [
    "Update README.md config examples",
    "Add deprecation notices",
    "Create migration guide"
  ],
  "timestamp": "2026-02-08T15:05:00Z"
}
```

---

## Tools and Commands

### For Documentation Agent

```bash
# Run full jiggling analysis
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 30,
    mediumDays: 90,
    obsoleteDays: 180,
    mode: "dryRun"
  },
  reason: "Analyze documentation health and detect conflicts"
})

# Extract recent docs for conflict detection
rg "^# " --type md -l | xargs ls -lt | head -20

# Compare doc intent with code changes
git diff main..feature-branch --name-only | grep -E '\.(ts|js|py)$'
git log --since="7 days ago" --format="%s" --

# Search for specific documentation patterns
rg "session.*auth" --type md
rg "config.*schema" --type md
rg "sync.*api|synchronous" --type md
```

### For Code Agent

```bash
# Notify documentation agent (create signal file)
cat > .doc-review-request.json <<EOF
{
  "branch": "$(git branch --show-current)",
  "files": $(git diff main --name-only | jq -R -s -c 'split("\n")[:-1]'),
  "intent": "YOUR CHANGE INTENT HERE"
}
EOF

# Check for documentation conflicts
test -f DOCUMENTATION_CONFLICTS_*.md && cat DOCUMENTATION_CONFLICTS_*.md

# Review plan updates
test -f CODE_AGENT_PLAN_UPDATE.md && cat CODE_AGENT_PLAN_UPDATE.md
```

---

## Conflict Resolution Process

### Step-by-Step Resolution

**1. Prioritize by Severity**
```
CRITICAL → HIGH → MEDIUM → LOW
```

**2. Determine Source of Truth**
```
Code is authoritative for:
- API behavior
- Implementation details
- Performance characteristics

Documentation is authoritative for:
- Design decisions
- User intentions
- Architecture philosophy

If conflict: Escalate to human decision
```

**3. Resolution Actions**

| Action | When to Use | Responsibility |
|--------|-------------|----------------|
| **Update Documentation** | Code correctly implements design | Documentation Agent |
| **Update Code** | Code diverged from intended design | Code Agent |
| **Create Migration Guide** | Breaking change required | Both (coordinate) |
| **Add Deprecation Notice** | Old approach still valid | Code Agent |
| **Percolate Design Change** | New pattern established | Documentation Agent |

**4. Validation**
```bash
# After resolution, verify no conflicts remain
activity({
  activityId: "jiggle-documentation",
  variables: { mode: "dryRun" },
  reason: "Verify conflict resolution"
})

# Check that critical conflicts = 0
grep -c "🔴 CRITICAL" DOCUMENTATION_CONFLICTS_*.md
# Should output: 0
```

---

## File Naming Conventions

### Documentation Agent Outputs

| File | Purpose | Lifecycle |
|------|---------|-----------|
| `doc-jiggle-analysis.md` | Age-sorted doc inventory | Overwritten each run |
| `doc-percolation-plan.md` | Planned content movements | Overwritten each dryRun |
| `doc-percolation-summary.md` | Applied content movements | Created each apply, archived |
| `doc-deletion-plan.md` | Planned deletions | Overwritten each dryRun |
| `doc-deletion-summary.md` | Applied deletions | Created each apply, archived |
| `doc-jiggle-summary.md` | Overall process summary | Overwritten each run |
| `DOCUMENTATION_CONFLICTS_YYYYMMDD.md` | Conflict report | Created per analysis, kept |
| `CODE_AGENT_PLAN_UPDATE.md` | Plan modifications | Overwritten each analysis |

### Signal Files (for automation)

| File | Purpose | Format |
|------|---------|--------|
| `.doc-review-request.json` | Code agent requests review | JSON |
| `.doc-review-complete.json` | Documentation agent finished | JSON |
| `.doc-conflicts-blocking.flag` | Critical conflicts present | Empty file |

---

## Success Metrics

### Documentation Health

- **Conflict Rate**: < 2 conflicts per 10 code changes
- **Resolution Time**: < 2 hours for CRITICAL conflicts
- **Documentation Freshness**: > 90% docs < 30 days old
- **Consistency Score**: > 95% code-doc alignment

### Process Efficiency

- **Jiggling Runtime**: < 5 minutes for full analysis
- **False Positive Rate**: < 10% of flagged conflicts
- **Automation Coverage**: > 80% of reviews automated
- **Manual Intervention**: < 20% of conflicts require human decision

### Collaboration Quality

- **Response Time**: Documentation agent responds < 5 minutes
- **Iteration Count**: < 3 iterations to resolve conflicts
- **Block Rate**: < 5% of PRs blocked by doc conflicts
- **Developer Satisfaction**: > 4/5 rating

---

## Example Scenarios

### Scenario 1: New Feature Implementation

**Code Agent**: Implements new feature "real-time notifications"

**Documentation Agent**:
1. Runs jiggling → detects no documentation for feature
2. Creates `DOCUMENTATION_CONFLICTS_20260208.md`:
   - HIGH: Feature not documented
3. Updates plan:
   - Add feature documentation
   - Update architecture diagram
   - Add to getting started guide

**Resolution**: Code agent adds inline docs, documentation agent creates comprehensive guide

---

### Scenario 2: Refactoring with Design Change

**Code Agent**: Refactors authentication from sync → async

**Documentation Agent**:
1. Runs jiggling → finds 15 docs referencing sync auth
2. Creates conflict report:
   - CRITICAL: 3 getting started examples broken
   - HIGH: 8 API reference examples outdated
   - MEDIUM: 4 architecture diagrams show sync flow
3. Updates plan:
   - Block merge until examples fixed
   - Schedule full doc update

**Resolution**: Code agent updates critical examples, documentation agent schedules async sweep

---

### Scenario 3: Configuration Schema Migration

**Code Agent**: Updates config schema v1 → v2 (breaking)

**Documentation Agent**:
1. Runs jiggling → finds 12 docs with v1 config
2. Creates conflict report:
   - CRITICAL: README.md has v1 config (won't work)
   - CRITICAL: Installation guide has v1 config
   - HIGH: 10 other docs need updating
3. Updates plan:
   - Block merge
   - Create migration guide
   - Update all config examples

**Resolution**: Code agent creates migration guide, documentation agent updates all examples

---

## Maintenance and Evolution

### Weekly Review

- Review conflict patterns
- Update detection heuristics
- Improve automation triggers
- Refine severity classification

### Monthly Retrospective

- Analyze false positive rate
- Review resolution effectiveness
- Update conflict types list
- Improve coordination protocol

### Quarterly Deep Clean

- Full repository jiggle (apply mode)
- Archive obsolete docs
- Consolidate duplicates
- Update foundational docs

---

## Emergency Procedures

### Critical Conflict Discovered Post-Merge

**Actions**:
1. Create `URGENT_DOC_CONFLICT.md` report
2. Notify code agent immediately
3. Create fix PR within 2 hours
4. Update release notes with workaround

### Documentation Agent Unavailable

**Fallback**:
1. Code agent runs manual jiggling:
   ```bash
   # Quick conflict check
   git log -1 --stat | grep "\.md$" | wc -l
   rg "TODO|FIXME|DEPRECATED" --type md
   ```
2. Flag PR for human review
3. Schedule full jiggling when agent returns

### Automation Failure

**Fallback**:
1. Manual notification between agents
2. Run jiggling activity manually
3. Create conflict report by hand if needed
4. Debug automation after critical path resolved

---

## Appendix: Quick Reference

### Conflict Severity Guide

```
🔴 CRITICAL: Code won't work as documented, users blocked
🟡 HIGH: Code works differently than documented, confusing
🟢 MEDIUM: Documentation outdated but not misleading
⚪ LOW: Minor inconsistencies, cosmetic issues
```

### Common Conflict Patterns

1. **API Change**: Code API differs from documented API
2. **Config Change**: Configuration format/structure changed
3. **Behavior Change**: Code behavior differs from description
4. **Deprecation**: Feature deprecated but still documented
5. **New Feature**: Code added but not documented
6. **Architecture Shift**: Design pattern changed
7. **Performance**: Documented characteristics outdated
8. **Security**: Security model changed

### Resolution Responsibility Matrix

| Conflict Type | Primary Responsibility | Support Role |
|---------------|------------------------|--------------|
| API Change | Code Agent (fix code) | Doc Agent (update docs) |
| Config Change | Both (coordinate) | Both |
| New Feature | Doc Agent (document) | Code Agent (inline docs) |
| Deprecation | Code Agent (add notices) | Doc Agent (archive docs) |
| Architecture | Doc Agent (update design) | Code Agent (review) |
| Refactoring | Doc Agent (percolate) | Code Agent (confirm intent) |

---

**Protocol Version**: 1.0  
**Last Updated**: 2026-02-08  
**Status**: Active - Ready for Use
