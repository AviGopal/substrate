# Jiggle-and-Prune Documentation Cleanup Summary

**Date:** 2026-04-11
**Scope:** Root-level markdown files

## Results

### Before
- **Total root docs:** 98 files

### After  
- **Remaining docs:** 12 files (88% reduction)
- **Archived:** 86 files

## Files Kept (12)

### Canonical Documents (2)
1. **CLAUDE.md** (35KB) - Project instructions, canonical source of truth
2. **README.md** (5.8KB) - Project overview

### User Guides (7)
3. **ACTIVITY_DECOMPOSITION_GUIDELINES.md** - Activity creation patterns
4. **MINIBOB_CLI_USAGE.md** - CLI reference
5. **PRODUCTION_SUBMISSION_GUIDE.md** - Production deployment guide
6. **QUICK_REFERENCE_TEACHING.md** - Teaching/feedback quick reference  
7. **TEACHING_AND_FEEDBACK_GUIDE.md** - Complete teaching guide
8. **TEACHING_MINIBOB_REACT.md** - React development teaching
9. **TERMINAL_COMPLETE_GUIDE.md** - Terminal tool guide

### Development Guides (3)
10. **LOCAL_DASHBOARD_DEV_SETUP.md** - Dashboard development setup
11. **REACT_ACTIVITIES_INDEX.md** - React activities index
12. **TEACHING_MINIBOB_DASHBOARD_DEVELOPMENT.md** - Dashboard teaching

## Files Archived (86)

All archived files moved to: `docs/archive/2026-04-11-jiggle-and-prune/`

### Categories Archived

1. **Ephemeral Status/Report Documents (39)**
   - Phase validation reports (PHASE_4_*, PHASE_5_*)
   - Task completion reports
   - API migration status docs
   - Debug/testing status
   - CI/CD evaluation reports

2. **Implementation Summaries (20)**
   - Shape registry implementation
   - Goal orchestrators implementation
   - Circuit breaker implementation
   - Context acquisition implementation
   - Teaching loop analysis
   - Dashboard testing reports

3. **Deployment/Architecture Analysis (7)**
   - Vessel integration plans
   - Communication flow analysis
   - Deployment correction plans
   - Architecture diagrams

4. **Demonstrations/Tutorials (4)**
   - Activity usage demos
   - Complete activity demo
   - Dashboard manual test guide

5. **Sandbox/Research Documents (6)**
   - Activity-based improvisation
   - Composition and control flow
   - MiniBob resolvers/shapes sandbox

6. **Configuration/Process Documents (10)**
   - CI/CD alignment
   - Schema alignment
   - Vessel tag strategy
   - Pre-commit workflow
   - Progressive template validation

## Recommendations

### Keep Current Structure
The remaining 12 documents provide a clean, focused documentation set:
- 2 canonical documents (CLAUDE.md, README.md)
- 7 user-facing guides
- 3 development-focused guides

### Potential Further Consolidation
Consider merging teaching guides:
- TEACHING_AND_FEEDBACK_GUIDE.md (21KB)
- QUICK_REFERENCE_TEACHING.md (6.7KB)
- TEACHING_MINIBOB_REACT.md (18KB)
- TEACHING_MINIBOB_DASHBOARD_DEVELOPMENT.md (12KB)

Could become single comprehensive "TEACHING_GUIDE.md" (~50KB)

### Next Steps
1. Review archived files for any critical information
2. Update CLAUDE.md if any unique insights were in archived docs
3. Consider docs/ directory cleanup (1,924 files remaining)

## Rollback

If needed, restore archived files:
```bash
cp docs/archive/2026-04-11-jiggle-and-prune/*.md .
```

## Git Commit

```bash
git add .
git commit -m "docs: jiggle-and-prune cleanup - archive 86 ephemeral docs

Archived 86 root-level documentation files to reduce documentation sprawl.
Files moved to docs/archive/2026-04-11-jiggle-and-prune/

Kept 12 essential documents:
- 2 canonical (CLAUDE.md, README.md)
- 7 user guides
- 3 development guides

88% reduction in root-level docs (98 → 12 files)

All archived content preserved in git history and archive directory."
```
