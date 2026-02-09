# Documentation Alignment - Quick Start Guide

**Purpose**: Get started with multi-agent documentation alignment in 5 minutes  
**Role**: Documentation Agent  
**Partner**: Code Agent (handles implementation)

---

## TL;DR

```bash
# 1. Code agent makes changes and notifies you
# 2. You run jiggling to detect conflicts
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 7,
    mode: "dryRun"
  },
  reason: "Detect conflicts with recent code changes"
})

# 3. Review the reports generated
# 4. Create conflict report for code agent
# 5. Update their plan with recommendations
```

---

## Your Mission

**Monitor documentation** → **Detect conflicts** → **Update plans** → **Maintain coherence**

You ensure documentation stays aligned with code changes through a process called **"jiggling"**.

---

## What is Jiggling?

**Jiggling** = Sorting docs by date → Finding conflicts → Percolating valuable content → Cleaning up obsolete docs

Think of it like shaking a jar:
- Valuable content rises to foundational docs
- Obsolete content settles for removal
- Conflicts surface for resolution

---

## Three-Phase Process

### Phase 1: Analysis (What exists?)
- Find all *.md files
- Sort by modification date
- Categorize by age (recent/medium/stale/obsolete)
- Detect duplicates

**Output**: `doc-jiggle-analysis.md`

### Phase 2: Percolation (What should move?)
- Identify valuable recent content
- Find appropriate foundational docs
- Plan content movements
- Update cross-references

**Output**: `doc-percolation-plan.md` or `doc-percolation-summary.md`

### Phase 3: Cleanup (What should go?)
- Review obsolete docs
- Apply deletion criteria
- Archive (default) or delete
- Update references

**Output**: `doc-deletion-plan.md` or `doc-deletion-summary.md`

---

## Your Workflow

### Step 1: Receive Code Change Notification

**Code agent** commits changes and creates a signal file:

```json
// .doc-review-request.json
{
  "branch": "feature/add-authentication",
  "files": ["src/auth/jwt.ts", "config/auth.yaml", ...],
  "intent": "Replace session-based auth with JWT tokens",
  "timestamp": "2026-02-08T15:00:00Z"
}
```

Or manually: Code agent tells you "I just pushed changes to feature/add-authentication"

### Step 2: Run Jiggling Analysis

```bash
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 7,        # Focus on last week
    mediumDays: 30,       # Medium = last month
    obsoleteDays: 90,     # Obsolete = 3+ months
    mode: "dryRun"        # Safe: only analyze, don't change
  },
  reason: "Detect conflicts with recent authentication changes"
})
```

**Wait 2-5 minutes** for analysis to complete.

### Step 3: Review Generated Reports

Four reports will be created:

1. **doc-jiggle-analysis.md**
   - Sorted list of all docs by age
   - Duplicate detection
   - Obsolete candidates

2. **doc-percolation-plan.md**
   - Content that should move to foundational docs
   - Proposed updates

3. **doc-deletion-plan.md**
   - Docs that can be archived/deleted
   - Reasons and safety checks

4. **doc-jiggle-summary.md**
   - Overall summary
   - Metrics and recommendations

### Step 4: Detect Intent Conflicts

**Read the code agent's change summary** and compare with documentation:

```bash
# What does code implement?
cat .doc-review-request.json

# What do docs say?
rg "session.*auth" --type md
rg "authentication" --type md -A 5

# Compare: Do they match?
```

**Common conflicts**:
- ❌ Code uses JWT, docs say "use sessions"
- ❌ Code is async, docs show sync examples
- ❌ Code uses config v2, docs show config v1
- ❌ Code deprecates feature, docs recommend it

### Step 5: Create Conflict Report

```bash
# Create report file
cat > DOCUMENTATION_CONFLICTS_$(date +%Y%m%d).md <<'EOF'
# Documentation Conflicts Detected

**Analysis Date**: 2026-02-08
**Code Changes**: feature/add-authentication

## 🔴 CRITICAL Conflicts (2)

### Conflict #1: Authentication Method Change
**Location**: docs/authentication.md (lines 15-42)
**Documentation States**: "Use session-based authentication"
**Code Implements**: JWT token-based authentication
**Severity**: CRITICAL - Users will follow wrong approach
**Recommendation**: Update docs to JWT, add migration guide

### Conflict #2: Configuration Schema
**Location**: README.md (lines 78-85)
**Documentation States**: Config schema v1 examples
**Code Implements**: Config schema v2
**Severity**: CRITICAL - Config examples won't work
**Recommendation**: Update all config examples to v2

## Summary
- Total Conflicts: 8
- Critical: 2 (block merge)
- High: 3
- Medium: 2
- Low: 1

## Blocking Merge
YES - 2 critical conflicts must be resolved first
EOF
```

### Step 6: Update Code Agent's Plan

```bash
cat > CODE_AGENT_PLAN_UPDATE.md <<'EOF'
# Code Agent Plan Update

**Triggered by**: Documentation conflict analysis
**Date**: 2026-02-08

## ❌ BLOCKING: Required Before Merge

- [ ] Update README.md config examples (v1 → v2)
- [ ] Add deprecation warnings in old session code
- [ ] Update CHANGELOG.md with breaking changes

## ✅ Recommended Additions to PR

- [ ] Add docs/migration/v1-to-v2.md guide
- [ ] Update getting started with JWT setup
- [ ] Add inline code comments explaining JWT approach

## 📋 Follow-up Documentation Work

- [ ] Rewrite docs/authentication.md (comprehensive)
- [ ] Convert all API examples to async
- [ ] Update architecture diagrams

## Modified Success Criteria

Original: "Implement JWT authentication"

Updated:
- Implement JWT authentication ✓
- Update configuration examples ← NEW
- Add deprecation notices ← NEW
- Document migration path ← NEW
- **Ensure no CRITICAL doc conflicts** ← NEW
EOF
```

### Step 7: Notify Code Agent

**Simple**: Tell them "I found 2 critical conflicts - see DOCUMENTATION_CONFLICTS_20260208.md and CODE_AGENT_PLAN_UPDATE.md"

**Automated**: Create signal file
```bash
cat > .doc-review-complete.json <<EOF
{
  "analysis_id": "jiggle-$(date +%Y%m%d-%H%M%S)",
  "conflicts_detected": 8,
  "critical_conflicts": 2,
  "blocking": true,
  "reports": [
    "DOCUMENTATION_CONFLICTS_$(date +%Y%m%d).md",
    "CODE_AGENT_PLAN_UPDATE.md"
  ],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Optional: Create blocking flag
touch .doc-conflicts-blocking.flag
```

### Step 8: Iterate Until Resolved

**Loop**:
1. Code agent addresses conflicts
2. You re-run jiggling (Step 2)
3. Review new conflicts (should be fewer)
4. Repeat until conflicts ≤ MEDIUM severity

**Goal**: 🔴 CRITICAL = 0, 🟡 HIGH = 0 before merge

---

## Conflict Severity Guide

| Severity | Symbol | Meaning | Example | Action |
|----------|--------|---------|---------|--------|
| **CRITICAL** | 🔴 | Code won't work as documented | README has wrong config format | **Block merge** |
| **HIGH** | 🟡 | Code works differently | API is async but docs show sync | **Should fix before merge** |
| **MEDIUM** | 🟢 | Docs outdated but not wrong | Old examples still work but not ideal | **Fix in doc sweep** |
| **LOW** | ⚪ | Minor inconsistencies | Typo, formatting, style | **Optional** |

---

## Common Conflict Types

### 1. API Change
**Code**: Changed function signature  
**Docs**: Old signature in examples  
**Resolution**: Update examples, add migration notes

### 2. Configuration Change
**Code**: New config schema  
**Docs**: Old config format  
**Resolution**: Update all config examples, create migration guide

### 3. Behavior Change
**Code**: Changed how feature works  
**Docs**: Describes old behavior  
**Resolution**: Update description, explain why changed

### 4. New Feature
**Code**: Added new feature  
**Docs**: No documentation for it  
**Resolution**: Create feature documentation

### 5. Deprecation
**Code**: Marked feature as deprecated  
**Docs**: Still recommends the feature  
**Resolution**: Add deprecation notice, show alternative

### 6. Architecture Shift
**Code**: Moved to new pattern (e.g., sync → async)  
**Docs**: Describes old pattern  
**Resolution**: Update architecture docs, percolate to foundational docs

---

## Quick Commands Reference

### Detection
```bash
# Find recent docs that might conflict
rg "TODO|FIXME|DEPRECATED" --type md

# Check what changed in code
git diff main..feature-branch --name-only

# Find docs mentioning specific topics
rg "authentication|session|jwt" --type md
rg "config|configuration" --type md -A 3
```

### Jiggling
```bash
# Safe analysis (dryRun)
activity({ activityId: "jiggle-documentation", variables: { mode: "dryRun" } })

# Apply changes (after reviewing plan)
activity({ activityId: "jiggle-documentation", variables: { mode: "apply" } })

# Focus on specific area
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "docs/api/",
    mode: "dryRun"
  }
})
```

### Conflict Reporting
```bash
# List recent docs that might have conflicts
ls -lt *.md | head -20

# Count conflicts by severity
grep -c "🔴 CRITICAL" DOCUMENTATION_CONFLICTS_*.md
grep -c "🟡 HIGH" DOCUMENTATION_CONFLICTS_*.md

# Check if blocking
test -f .doc-conflicts-blocking.flag && echo "BLOCKING" || echo "OK"
```

---

## Decision Tree

```
Code Agent Notifies of Changes
        ↓
    Run Jiggling (dryRun)
        ↓
    Review Reports
        ↓
    Conflicts Detected? ────NO──→ Notify: "No conflicts, looks good!"
        ↓ YES                      Done ✓
    What Severity?
        ↓
    ┌───────────┬────────────┬──────────┐
    ↓           ↓            ↓          ↓
CRITICAL     HIGH        MEDIUM      LOW
    ↓           ↓            ↓          ↓
Block       Should Fix    Schedule   Optional
Merge       Before Merge  Doc Sweep  (ignore)
    ↓           ↓            ↓          ↓
Create      Create        Create     Notify
Conflict    Conflict      Conflict   Code Agent
Report      Report        Report     (FYI only)
    ↓           ↓            ↓
Update      Update        Track for
Plan        Plan          Later
    ↓           ↓
Notify:     Notify:
"BLOCKING"  "Recommended"
```

---

## Safety Principles

### ✅ DO
- Run in **dryRun mode first** (always)
- Be **conservative** with deletion (archive instead)
- **Update plans** with clear recommendations
- **Percolate valuable content** to foundational docs
- **Document your reasoning** in conflict reports

### ❌ DON'T
- Delete based on **age alone** (content matters)
- Delete **foundational docs** (README, architecture, etc.)
- Apply changes **without reviewing** the plan first
- Ignore **cross-references** (leads to broken links)
- Skip **notifying code agent** of conflicts

---

## Success Criteria

### Your Performance
- ✅ Detect conflicts within **5 minutes** of code changes
- ✅ Conflict reports are **clear and actionable**
- ✅ False positive rate **< 10%**
- ✅ Critical conflicts **always flagged**
- ✅ Plans include **specific recommendations**

### Documentation Health
- ✅ **> 90%** of docs are recent (< 30 days)
- ✅ **< 2 conflicts** per 10 code changes
- ✅ **0 broken links** after cleanup
- ✅ **Code-doc alignment > 95%**

---

## Troubleshooting

### "Jiggling activity not found"
```bash
# Check if activity template exists
ls repos/metabob-proto/activities/bootstrap/jiggle-documentation.json

# If not found, use direct tools:
rg "^# " --type md -l | xargs ls -lt | head -30
```

### "Too many conflicts detected"
- **Normal** for large changes
- Focus on **CRITICAL and HIGH** first
- Group similar conflicts together
- Create **thematic conflict reports** (auth conflicts, config conflicts, etc.)

### "Not sure if it's a real conflict"
**Ask yourself**:
1. Would a new user be confused? → HIGH
2. Would documented approach fail? → CRITICAL
3. Is it just outdated but still works? → MEDIUM
4. Is it cosmetic? → LOW

**When in doubt**: Flag it as HIGH, let code agent decide

### "Code agent didn't address conflicts"
1. Verify they saw the reports
2. Re-explain severity (maybe they didn't understand)
3. If still ignored, escalate to human review
4. Don't merge if CRITICAL conflicts remain

---

## Example Session

### Code Agent Says:
> "I just pushed feature/async-refactor - converted all APIs from sync to async"

### You Do:

```bash
# 1. Run jiggling
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 7,
    mode: "dryRun"
  },
  reason: "Detect conflicts with async refactor"
})

# 2. Wait for analysis...

# 3. Review doc-jiggle-analysis.md
# Found: 23 recent docs, 12 mention "synchronous" or show sync examples

# 4. Check specific docs
rg "sync|synchronous" --type md -A 2
# Result: Found in api/reference.md, getting-started.md, examples.md

# 5. Create conflict report
```

**DOCUMENTATION_CONFLICTS_20260208.md**:
```markdown
# Documentation Conflicts: Async Refactor

## 🔴 CRITICAL (1)

### Getting Started Guide Uses Sync Code
**Location**: docs/getting-started.md (lines 45-78)
**Issue**: All examples use synchronous API calls
**Code Reality**: All APIs now async-only
**Impact**: New users' first code won't work
**Fix**: Convert all examples to async/await

## 🟡 HIGH (2)

### API Reference Examples All Sync
**Location**: docs/api/reference.md (entire file)
**Issue**: 47 code examples use sync calls
**Fix**: Convert to async, add note at top

### Tutorial Series Uses Sync Pattern
**Location**: docs/tutorials/*.md (8 files)
**Fix**: Update all tutorials to async

## Summary
- BLOCKING: 1 critical (getting started broken)
- Total async references to update: 47+
```

**CODE_AGENT_PLAN_UPDATE.md**:
```markdown
# Required Before Merge

- [ ] Update getting-started.md examples to async
- [ ] Add "Async Migration Guide" document
- [ ] Add note in CHANGELOG about breaking change

# Recommended
- [ ] Update top 5 most-viewed examples to async
- [ ] Rest can be follow-up PR

# Follow-up Doc Work
- [ ] Full API reference conversion (47 examples)
- [ ] Tutorial series update (8 files)
```

### Code Agent Responds:
> "Got it - I'll update getting-started.md and create migration guide"

### You Wait, Then Re-run:
```bash
# After code agent commits fixes
activity({
  activityId: "jiggle-documentation",
  variables: { mode: "dryRun", recentDays: 1 },
  reason: "Verify conflict resolution"
})

# Check: CRITICAL conflicts = 0 ✓
# Response: "Looks good! Still 2 HIGH but non-blocking. Ready to merge."
```

---

## Next Steps

1. **Familiarize** with the full protocol: `DOCUMENTATION_ALIGNMENT_PROTOCOL.md`
2. **Practice** on a test branch
3. **Set up automation** triggers (optional)
4. **Establish communication** patterns with code agent
5. **Monitor metrics** and improve process

---

## Quick Win Checklist

Week 1:
- [ ] Run first jiggling analysis (dryRun)
- [ ] Review generated reports
- [ ] Understand report structure
- [ ] Create first conflict report

Week 2:
- [ ] Coordinate with code agent on 1 feature
- [ ] Detect and report conflicts
- [ ] Iterate until resolved
- [ ] Measure time to resolution

Week 3:
- [ ] Set up automated triggers
- [ ] Establish signal file convention
- [ ] Create conflict report templates
- [ ] Document your process improvements

---

**You're ready!** Next time code agent makes changes, follow this guide and you'll maintain perfect documentation alignment.

**Remember**: Your job is to be the **documentation guardian** - catch conflicts early, update plans proactively, and keep docs coherent.

**Questions?** See `DOCUMENTATION_ALIGNMENT_PROTOCOL.md` for detailed answers.
