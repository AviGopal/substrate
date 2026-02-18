# Documentation Percolation - Quick Reference Card

**Date**: 2026-02-11  
**Status**: DRY RUN COMPLETE ✅

---

## 📋 What Was Done

Analyzed **712 recent docs** → Identified **47 percolation opportunities** → Created comprehensive plan

---

## 🎯 Top 5 Critical Percolations (Execute First)

| # | Source | Target | Why | Effort |
|---|--------|--------|-----|--------|
| 1 | V2_ACTIVITY_SYSTEM_STATUS.md | OpenCode README | Major architecture change | 30 min |
| 2 | CONTAINER_ACTIVITY_FIX_COMPLETE.md | OpenCode README | Prevents critical bug | 15 min |
| 3 | README_MEMORY_LEAK_FIX.md | OpenCode README | 90% performance fix | 20 min |
| 4 | QUICK_REFERENCE.md | OpenCode README | MCP troubleshooting | 15 min |
| 5 | CLI README lines 79-100 | CLI README | Async is default (breaking) | 10 min |

**Total: ~90 minutes for maximum impact**

---

## 📊 Priority Breakdown

- **HIGH (4)**: Critical architecture, bugs, config → Execute this week
- **MEDIUM (4)**: Usage patterns, examples → Execute next 2 weeks  
- **LOW (2)**: Testing guide, cross-refs → As capacity allows

---

## 💡 Key Insights

### What's Important
1. **V2 Activity System** - Complete architecture change (Feb 2026)
2. **Container networking** - `api-server-dev:8080` not `host.docker.internal`
3. **Memory leak** - 20.8 GB → <2 GB (MessageV2.stream fix)
4. **Async analysis** - Now default (breaking change for CLI)
5. **MCP config** - Common mistakes cause "Activity not found"

### Where to Put It
- **Architecture changes** → README "Configuration" section
- **Bug fixes** → README "Troubleshooting" section  
- **Breaking changes** → README right after Installation
- **Usage patterns** → README "Usage" section
- **Test procedures** → New TESTING_GUIDE.md

---

## 🚀 Quick Start: Execute Top 5

```bash
# 1. Read the full plan
cat doc-percolation-plan.md

# 2. Create branch
git checkout -b doc/percolate-critical-details

# 3. Edit OpenCode README
# Add V2 Activity System section (after line 99)
# Add Docker Container Config (after line 82)
# Add Performance & Troubleshooting section (new)
# Enhance MCP troubleshooting (lines 84-88)

# 4. Edit CLI README  
# Move async-is-default up (after line 4)
# Add breaking change notice

# 5. Commit
git add repos/*/README.md
git commit -m "docs: percolate critical details to READMEs

- Add V2 Activity System architecture to OpenCode README
- Document container networking fix
- Document memory leak fix (MessageV2.stream)
- Enhance MCP troubleshooting
- Promote async-is-default in CLI README

Refs: doc-percolation-plan.md"

# 6. Test readability
# Ask: Can a new developer find these details in <3 minutes?
```

---

## 📈 Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Onboarding time | 4-6 hours | 1-2 hours | **3-4 hours saved** |
| Container setup bugs | HIGH | LOW | **Prevents 2h debugging** |
| MCP config errors | HIGH | MEDIUM | **Reduces support tickets** |
| Memory leak recurrence | Possible | Documented | **Operations clarity** |

---

## 📁 Files to Modify (Phase 1 Only)

**Primary** (2-3 hours):
- ✏️ `repos/metabob-opencode/README.md` (+150 lines)
- ✏️ `repos/metabob-cli/README.md` (+30 lines)

**Reference** (keep unchanged):
- 📖 `V2_ACTIVITY_SYSTEM_STATUS.md` (deep-dive architecture)
- 📖 `README_MEMORY_LEAK_FIX.md` (detailed fix analysis)
- 📖 `CONTAINER_ACTIVITY_FIX_COMPLETE.md` (troubleshooting steps)

**Future archive** (after 90 days):
- 📦 `QUICK_REFERENCE.md` → `.archive/2026-02/`
- 📦 `FIX_APPLIED_SUMMARY.md` → `.archive/2026-02/`
- 📦 `SUCCESS_*.md` files → `.archive/2026-02/`

---

## ✅ Success Checklist

**Before starting**:
- [ ] Read full plan: `doc-percolation-plan.md`
- [ ] Review source docs for accuracy
- [ ] Create git branch

**After percolation**:
- [ ] Critical info in READMEs within 3 scrolls
- [ ] No critical fixes only in session logs
- [ ] Clear forward links to deep-dive docs
- [ ] Test with "new developer" mindset
- [ ] Update STATUS_INDEX.md to point to changes

**Within 7 days**:
- [ ] Archive superseded session logs to `.archive/2026-02/`
- [ ] Update cross-references in related docs
- [ ] Notify team of README updates

---

## 🔄 Ongoing Process (After Initial Execution)

### When You Fix a Bug
1. Document in session log (immediate)
2. Percolate to README (within 7 days)
3. Archive session log (after 90 days)

### When You Add a Feature
1. Document in architecture doc (immediate)
2. Add example to README (within 7 days)
3. Keep both (don't archive architecture docs)

### When You Change Configuration
1. Update README (immediate)
2. Document in session log (for context)
3. Archive session log (after 90 days)

---

## 📞 Help & References

**Full Details**: `doc-percolation-plan.md` (47 opportunities, complete specifications)  
**Summary**: `doc-percolation-complete-summary.md` (executive overview)  
**Analysis Source**: `doc-jiggle-analysis.md` (712 files analyzed)  
**Navigation**: `STATUS_INDEX.md` (all status docs)

**Questions?**
- What to percolate? → See priority matrix in full plan
- Where to put it? → See target document specifications
- How to write it? → See content examples in full plan
- When to do it? → Phase 1 (this week), Phase 2 (next 2 weeks)

---

**Status**: ✅ Ready to Execute  
**Next Action**: Review plan → Execute top 5 → Commit → Iterate

---

## 🎯 One-Liner Summary

"Move critical architecture changes, bug fixes, and config patterns from recent session logs into READMEs so new developers don't have to hunt through 712 files."

---

**Created**: 2026-02-11  
**Mode**: DRY RUN (No changes made yet)
