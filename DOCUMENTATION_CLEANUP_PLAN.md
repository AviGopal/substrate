# Documentation Cleanup Plan

Generated: 2026-03-27

## Objective

Clean up documentation across 6 repos to ensure all docs are:
- **Stateless**: Represent current reality, not historical snapshots
- **Accurate**: Reflect current implementation and goals
- **Non-redundant**: No duplicate or conflicting information
- **Purposeful**: Every doc serves an active need

## Repos to Clean

1. `repos/minibob`
2. `repos/minibob-tui`
3. `repos/metabob-mcp`
4. `repos/metabob-activity-api`
5. `repos/metabob-analysis-api`
6. `repos/metabob-cloud-dashboard`

## Canonical Documents (Never Delete)

These are the source of truth for each repo:
- `CLAUDE.md` - Development guidelines for AI agents
- `README.md` - User-facing overview and quick start
- Active implementation guides (case-by-case basis)

## Classification System

### KEEP
Documents that are:
- Current and accurate
- Actively referenced
- Contain unique, necessary information

### ARCHIVE
Documents that are:
- Historical implementation logs
- Status/summary snapshots
- No longer current but have some historical value

Archive location: `docs/archive/2026-03-27/`

### DELETE
Documents that are:
- Duplicate information (covered in canonical docs)
- One-time analysis artifacts
- Build/temporary files

## Cleanup Actions by Repo

### 1. repos/minibob

**KEEP:**
- ✅ CLAUDE.md (current, comprehensive)
- ✅ README.md (current)
- ✅ AUTH.md (current implementation details)
- ✅ TEMPLATE_RESOURCES.md (active reference)
- ✅ CHANGELOG.md (version history)
- ✅ examples/README.md

**REVIEW:**
- ⚠️  ARCHITECTURE.md - Check if superseded by CLAUDE.md or still valuable
- ⚠️  STRATEGY_RECORDING.md - Check if historical or still relevant

**DELETE:**
- 🗑️ typescript-files-enumeration.md (one-time inventory)
- 🗑️ typescript-files-inventory.md (one-time inventory)
- 🗑️ project_structure_summary.md (one-time inventory)
- 🗑️ template-options-summary.md (one-time analysis)

### 2. repos/minibob-tui

**KEEP:**
- ✅ All documents (CLAUDE.md, README.md, PACKAGING.md, GREETING.md)

**Action:** No cleanup needed - docs are clean and current

### 3. repos/metabob-mcp

**KEEP:**
- ✅ CLAUDE.md
- ✅ README.md
- ✅ QUICK_START.md
- ✅ PUBLISHING.md
- ✅ DEPLOYMENT.md

**ARCHIVE:**
- 📦 IMPLEMENTATION_COMPLETE.md
- 📦 COMPLETION_SUMMARY.md
- 📦 FINAL_STATUS.md
- 📦 IMPLEMENTATION_SUMMARY.md
- 📦 EVIDENCE.md
- 📦 TEST_RESULTS_SUMMARY.md
- 📦 MCP_TEST_REPORT.md
- 📦 DISTRIBUTION_REPORT.md
- 📦 NPM_DISTRIBUTION_SUMMARY.md
- 📦 FIXES_REQUIRED.md
- 📦 README_TEST_SESSION.md

Rationale: These are implementation logs from the initial build phase. Historical value but not current documentation.

### 4. repos/metabob-activity-api

**KEEP:**
- ✅ CLAUDE.md
- ✅ README.md
- ✅ sql/SCHEMA_REORGANIZATION.md (schema docs)
- ✅ sql/MIGRATION_PHASE2.md (migration guide)

**REVIEW:**
- ⚠️  CI_CD_INTEGRATION.md - May be outdated given `repos/deployment` work
- ⚠️  SETUP_SUMMARY.md - Check if duplicates README.md

### 5. repos/metabob-analysis-api

**KEEP:**
- ✅ CLAUDE.md
- ✅ README.md (currently minimal - may need expansion)
- ✅ QUICK_START_RBAC.md (specific guide for RBAC setup)

**ARCHIVE:**
- 📦 IMPLEMENTATION_COMPLETE.md
- 📦 PHASE_3_IMPLEMENTATION_SUMMARY.md
- 📦 MIDDLEWARE_IMPLEMENTATION.md
- 📦 MIDDLEWARE_QUICK_START.md (superseded by main QUICK_START?)
- 📦 SERVICE_IMPLEMENTATION_SUMMARY.md
- 📦 MCP_ENDPOINTS_IMPLEMENTATION_SUMMARY.md
- 📦 ROUTE_VERIFICATION.md
- 📦 FIX_SUMMARY.md
- 📦 CHANGES.md

**REVIEW:**
- ⚠️  QUICK_START.md vs QUICK_START_RBAC.md - consolidate or keep separate?

### 6. repos/metabob-cloud-dashboard

**KEEP:**
- ✅ All documents (CLAUDE.md, README.md, openspec/tasks.md)

**Action:** No cleanup needed - minimal, focused docs

## Execution Steps

### Phase 1: Review (Manual)
For each "REVIEW" item:
1. Read both documents
2. Identify conflicts or duplication
3. Decide: keep separate, merge, or archive one

### Phase 2: Archive (Bulk)
```bash
for repo in metabob-mcp metabob-analysis-api; do
  mkdir -p repos/$repo/docs/archive/2026-03-27
  # Move archived docs
done
```

### Phase 3: Delete (Bulk)
```bash
# Delete inventory/temporary files from minibob
rm repos/minibob/typescript-files-*.md
rm repos/minibob/project_structure_summary.md
rm repos/minibob/template-options-summary.md
```

### Phase 4: Update References
Search for links to archived/deleted docs and update:
```bash
grep -r "IMPLEMENTATION_COMPLETE" repos/*/
grep -r "typescript-files-" repos/*/
```

### Phase 5: Commit
```bash
git add -A
git commit -m "docs: archive historical implementation logs

Archived point-in-time implementation summaries to docs/archive/2026-03-27/.
These documents captured development progress but are no longer current.

Deleted one-time analysis artifacts (file inventories, structure summaries).

Canonical documentation (CLAUDE.md, README.md) remains current and accurate."
```

## Metrics

**Before:**
- minibob: 13 docs
- minibob-tui: 4 docs
- metabob-mcp: 16 docs
- metabob-activity-api: 6 docs
- metabob-analysis-api: 14 docs
- metabob-cloud-dashboard: 3 docs
- **Total: 56 docs**

**After (estimated):**
- minibob: ~7 docs (deleted 6 inventory files)
- minibob-tui: 4 docs (no change)
- metabob-mcp: ~5 docs (archived 11)
- metabob-activity-api: ~4 docs (archived 2)
- metabob-analysis-api: ~4 docs (archived 10)
- metabob-cloud-dashboard: 3 docs (no change)
- **Total: ~27 docs** (48% reduction)

## Verification Checklist

After cleanup, verify:
- [ ] CLAUDE.md exists and is current in each repo
- [ ] README.md exists and is current in each repo
- [ ] No broken internal links
- [ ] No references to deleted docs
- [ ] Archive directory is clearly labeled with date
- [ ] All remaining docs serve an active purpose

## Notes

- **Do not** delete docs that are actively referenced in code or other docs
- **Do not** delete schema/migration docs (these are historical by nature)
- **Do not** archive openspec/tasks.md (active planning docs)
- **Always** check git blame to see if a doc was recently updated before archiving
