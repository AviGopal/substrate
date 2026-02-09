# Documentation Percolation Plan (Enhanced)

**Purpose**: Move valuable recent details backward into foundational documents

## Strategy

1. **Identify Foundational Docs**:
   - README.md files
   - *_QUICK_START.md
   - *_REFERENCE.md
   - DOCUMENTATION_INDEX.md

2. **Extract Recent Insights**:
   - From recent docs (< 30 days)
   - Exclude: Metabob MCP config (internal only)
   - Include: Architecture decisions, setup steps, lessons learned

3. **Consolidate Fragmented Docs**:
   - Merge similar session logs into coherent guides
   - Combine scattered analysis into unified architecture docs

---

## Foundational Documents

./.activity-test/README.md
./.archive/activity-analysis/ACTIVITY_WORKFLOW_QUICK_REFERENCE.md
./.archive/activity-analysis/README.md
./.archive/config-analysis/README.md
./.archive/dev-journal/2026-02-06-activity-system/README.md
./.archive/dev-journal/2026-02-06-session-memory/README.md
./.archive/memory-analysis/README.md
./.archive/README.md
./.archive/session-logs/2026-02/NEXT_SESSION_QUICK_START.md
./.archive/summaries/2026-02/IMPLEMENTATION_QUICK_START.md
./.archive/summaries/2026-02/README_IMPLEMENTATION_COMPLETE.md
./.archive/summaries/2026-02/README_MCP_EXECUTION.md
./.archive/v2-migration-analysis/README.md
./.archive/v2-migration-analysis/V2_MIGRATION_QUICK_START.md
./BREADCRUMB_QUICK_START.md
./CLI_METABOB_TOOLS_REFERENCE.md
./DOC_ALIGNMENT_QUICK_START.md
./DOCUMENTATION_INDEX.md
./MCP_METHODS_QUICK_REFERENCE.md
./.opencode/CONFIG_REFERENCE.md
./.opencode/QUICK_CONFIG_REFERENCE.md
./.opencode/README.md
./PROTO_SCHEMA_REFERENCE.md
./QUICK_ARCHITECTURE_REFERENCE.md
./QUICK_START_DASHBOARD.md
./QUICK_START_V2_API.md
./README_ARCHITECTURE_DOCS.md
./README-JIGGLE-ACTIVITY.md
./README-JIGGLE-TEST.md
./repos/cpg-inference/cpg-inference/cpg_inference/README.md
./repos/cpg-inference/cpg-inference/.pytest_cache/README.md
./repos/cpg-inference/cpg-inference/README.md
./repos/cpg-inference/cpg_inference/README.md
./repos/cpg-inference/.pytest_cache/README.md
./repos/cpg-inference/README.md
./repos/metabob-cli/.gemini/QUICK_REFERENCE.md
./repos/metabob-cli/.gemini/README.md
./repos/metabob-cli/lib/docs/README.md
./repos/metabob-cli/.pytest_cache/README.md
./repos/metabob-cli/README.md
./repos/metabob-cli/tests/perf-repos/empty/README.md
./repos/metabob-cli/tests/perf-repos/large/README.md
./repos/metabob-cli/tests/perf-repos/medium/README.md
./repos/metabob-cli/tests/perf-repos/small/README.md
./repos/metabob-cli/tests/perf-repos/xlarge/README.md
./repos/metabob-cli/tests/smoke/README.md
./repos/metabob-cli/TOOLS_REFERENCE.md
./repos/metabob-cli/.venv/lib/python3.13/site-packages/cpg_inference/README.md
./repos/metabob-dashboard/docs/MOCK_QUICK_REFERENCE.md
./repos/metabob-dashboard/PROTO_TYPES_QUICK_REFERENCE.md
./repos/metabob-dashboard/QUICK_REFERENCE.md
./repos/metabob-dashboard/QUICK_REFERENCE_TESTING.md
./repos/metabob-dashboard/README.md
./repos/metabob-dashboard/src/cloud/components/README.md
./repos/metabob-dashboard/src/cloud/pages/CloudSettings/components/README.md
./repos/metabob-dashboard/src/cloud/README.md
./repos/metabob-dashboard/src/components/shared/README.md
./repos/metabob-dashboard/tests/e2e/README.md
./repos/metabob-opencode/packages/console/app/README.md
./repos/metabob-opencode/packages/desktop/README.md
./repos/metabob-opencode/packages/opencode/API_REFERENCE.md
./repos/metabob-opencode/packages/opencode/docker/devbob-acp/QUICK_START.md
./repos/metabob-opencode/packages/opencode/docker/devbob-acp/README.md
./repos/metabob-opencode/packages/opencode/examples/activity-composition/README.md
./repos/metabob-opencode/packages/opencode/.memory-profiles/README.md
./repos/metabob-opencode/packages/opencode/README.md
./repos/metabob-opencode/packages/opencode/src/acp/README.md
./repos/metabob-opencode/packages/opencode/src/config/schemas/README.md
./repos/metabob-opencode/packages/opencode/templates/README.md
./repos/metabob-opencode/packages/opencode/test/plugin/README.md
./repos/metabob-opencode/packages/opencode/test/storage/README.md
./repos/metabob-opencode/packages/plugin-activities/README.md
./repos/metabob-opencode/packages/plugin-metabob/README.md
./repos/metabob-opencode/packages/sdk/go/README.md
./repos/metabob-opencode/packages/sdk/python/README.md
./repos/metabob-opencode/packages/slack/README.md
./repos/metabob-opencode/packages/web/README.md
./repos/metabob-opencode/QUICK_START.md
./repos/metabob-opencode/README.md
./repos/metabob-opencode/sdks/vscode/README.md
./repos/metabob-proto/README.md
./repos/metabob-rpc-api/CLOUD_MODE_QUICK_START.md
./repos/metabob-rpc-api/docs/activities/ACTIVITY_API_REFERENCE.md
./repos/metabob-rpc-api/docs/activities/COMPOSITION_QUICK_REFERENCE.md
./repos/metabob-rpc-api/docs/activities/TEMPLATE_REPOSITORY_QUICK_START.md
./repos/metabob-rpc-api/docs/activities/TEMPLATE_UNIFICATION_QUICK_START.md
./repos/metabob-rpc-api/docs/activities/THREE_TIER_QUICK_START.md
./repos/metabob-rpc-api/docs/archive/cloud-mode-development-2025-01/README.md
./repos/metabob-rpc-api/docs/PROJECT_CRUD_QUICK_REFERENCE.md
./repos/metabob-rpc-api/docs/proto/PROTO_QUICK_START.md
./repos/metabob-rpc-api/docs/QUICK_REFERENCE.md
./repos/metabob-rpc-api/docs/README.md
./repos/metabob-rpc-api/docs/SCOPE_MIGRATION_QUICK_START.md
./repos/metabob-rpc-api/.gemini/README.md
./repos/metabob-rpc-api/README.md
./repos/metabob-rpc-api/scripts/README.md
./repos/metabob-rpc-api/tests/fixtures/README_SURREAL.md
./repos/metabob-rpc-api/tests/integration/README.md
./repos/metabob-rpc-api/tests/routes/README_V2_TESTS.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/a11y_dark/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/a11y_high_contrast_dark/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/a11y_high_contrast_light/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/a11y_light/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/blinds_dark/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/blinds_light/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/gotthard_dark/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/gotthard_light/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/greative/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/a11y_pygments/pitaya_smoothie/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/cpg_inference/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/debugpy/_vendored/pydevd/pydevd_plugins/extensions/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/instructor/providers/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/pymupdf-1.26.6.dist-info/README.md
./repos/metabob-rpc-api/.venv/lib/python3.13/site-packages/surrealdb/data/README.md

## Recent Documents with Valuable Content

- `./PHASE2_DATA_STORAGE_ANALYSIS.md` - Phase 2 Data Storage Analysis
- `./.archive/ARCHIVE_INDEX.md` - Documentation Archive Index
- `./DOCUMENTATION_JIGGLE_FINAL_SUMMARY.md` - Documentation Jiggle - Final Summary
- `./DOCUMENTATION_INDEX.md` - Metabob System Documentation Index
- `./DOC_JIGGLE_COMPREHENSIVE_ANALYSIS.md` - Documentation Jiggle - Comprehensive Analysis with Validation
- `./CLI_METABOB_TOOLS_REFERENCE.md` - Metabob CLI MCP Tools Reference
- `./repos/metabob-opencode/OPENCODE_ACTIVITY_STATUS.md` - OpenCode Activity Implementation Status
- `./EXISTING_EXECUTION_TRACKING.md` - Existing Backend Execution Tracking Infrastructure
- `./PROTO_SCHEMA_REFERENCE.md` - Proto Schema Reference for Phase 2
- `./.archive/summaries/2026-02/DOC_JIGGLE_ENHANCED_SUMMARY.md` - Documentation Jiggle - Enhanced Validation Summary
- `./.archive/summaries/2026-02/BOOTSTRAP_COMPLETE_SUMMARY.md` - Backend Bootstrap Complete ✅
- `./.archive/config-analysis/README.md` - Configuration & Architecture Analysis Archive
- `./.archive/v2-migration-analysis/README.md` - V2 API Migration Analysis Archive
- `./.archive/memory-analysis/README.md` - Session Memory Analysis Archive
- `./.archive/summaries/2026-02/PHASE2_EXECUTION_LEARNING_BREAKDOWN.md` - Phase 2: Execution & Learning System - Task Breakdown
- `./.archive/activity-analysis/README.md` - Activity System Analysis Archive
- `./.archive/test-reports/2026-02/DOC_JIGGLE_EXECUTION_PLAN.md` - Documentation Jiggle - Execution Plan
- `./.archive/test-reports/2026-02/DOC_VALIDATION_FINDINGS.md` - Documentation Validation Findings
- `./.archive/test-reports/2026-02/DOC_JIGGLE_VALIDATION_PLAN.md` - Documentation Jiggle - Enhanced Validation Plan
- `./.archive/test-reports/2026-02/DOC_JIGGLE_PERCOLATION_PLAN.md` - Documentation Percolation Plan

## Percolation Actions (To Be Applied)

1. **Consolidate session logs** → Create unified troubleshooting guide
2. **Merge architecture fragments** → Update CORRECT_ARCHITECTURE_DESIGN.md
3. **Promote quick start insights** → Update main README
4. **Archive obsolete phase docs** → Move to .archive with proper index

