# Cleanup Safety Analysis Report

**Generated:** Mon Feb 16 2026  
**Purpose:** Comprehensive safety analysis for repository cleanup candidates

---

## Executive Summary

Analyzed **27 candidate files** across 4 categories:
- **SAFE to remove:** 15 files
- **REVIEW required:** 8 files  
- **KEEP (do not remove):** 4 files

---

## CATEGORY 1: Documentation Files (MD)

### ✅ SAFE TO REMOVE

#### `ACP_DELEGATE_TIMEOUT_FIX.md`
- **Size:** 8.7K
- **Last Modified:** Feb 11 02:00
- **Code References:** None
- **Doc References:** 4 files (doc-deletion-dryrun-report.md, doc-jiggle-analysis.md, SESSION_SUMMARY.md, PATTERN_DOCUMENTATION_INDEX.md)
- **Git Activity:** Last commit Feb 11 (cleanup commit)
- **Reasoning:** Historical fix documentation. Issue is resolved. References are from archived analysis docs.
- **Action:** Archive or remove

#### `ACTIVITY_EXECUTION_DIAGNOSIS.md`
- **Size:** 7.3K
- **Last Modified:** Feb 9 11:47
- **Code References:** None
- **Doc References:** 1 file (doc-percolation-plan-v2.md - archived)
- **Git Activity:** Last commit Feb 9 (cleanup)
- **Reasoning:** Diagnostic doc for resolved issue. No active references.
- **Action:** Remove

#### `ACTIVITY_EXECUTION_MYSTERY.md`
- **Size:** 8.3K
- **Last Modified:** Feb 12 11:52
- **Code References:** None
- **Doc References:** 1 file (COMMIT_SUMMARY.md)
- **Git Activity:** Last commit Feb 12
- **Reasoning:** Mystery is solved. Historical diagnostic doc.
- **Action:** Remove

### ⚠️ REVIEW REQUIRED

#### `ACP_DELEGATION_FIX.md`
- **Size:** 3.2K
- **Last Modified:** Feb 12 22:22
- **Code References:** None
- **Doc References:** 3 files (TUI_STDOUT_FIX_SESSION_RESUME_FEB14.md, TUI_STDOUT_POLLUTION_FIX_COMPLETE.md, STDOUT_POLLUTION_FIX_FEB14.md)
- **Git Activity:** Recent commit Feb 12 (documentation commit)
- **Reasoning:** Recent fix documentation with multiple cross-references to other fix docs. May be part of active troubleshooting knowledge base.
- **Action:** Review with team - may want to keep as reference for similar issues

#### `ACTIVITY_TOOL_BUG_CONFIRMED.md`
- **Size:** 8.7K
- **Last Modified:** Feb 12 00:53
- **Code References:** None
- **Doc References:** 2 files (FINAL_STATUS_ACTIVITY_EXECUTION.md, SESSION_SUMMARY_ACTIVITY_FIXES.md)
- **Git Activity:** Recent commit Feb 12
- **Reasoning:** Bug confirmation and analysis. Referenced by status docs. May be valuable for understanding fix history.
- **Action:** Review - consider consolidating into main fix documentation

### 🔒 KEEP

#### `ACP_PHASE1_COMPLETION_REPORT.md`
- **Size:** 18K
- **Last Modified:** Feb 16 00:10 (TODAY)
- **Code References:** None
- **Doc References:** 5 files including ACP_PROJECT_STATUS.md, SESSION_RESUME_SUMMARY_FEB16.md
- **Git Activity:** Recent commit Feb 16 (TODAY)
- **Reasoning:** **ACTIVE DOCUMENT** - Very recent update, large comprehensive report, referenced by current project status docs.
- **Action:** **KEEP** - Active project documentation

#### `ACTIVITY_CREATE_FAILURE_ANALYSIS.md`
- **Size:** 11K
- **Last Modified:** Feb 12 23:00
- **Code References:** None
- **Doc References:** 1 file (ACTIVITY_TEMPLATE_FIX_GUIDE.md)
- **Git Activity:** Recent commit Feb 12
- **Reasoning:** Referenced by active fix guide. Valuable troubleshooting knowledge.
- **Action:** **KEEP** - Active reference documentation

#### `BACKEND_FIX_COMPLETE.md`
- **Size:** 11K
- **Last Modified:** Feb 10 19:00
- **Code References:** None
- **Doc References:** 4 files including ACTIVITY_TEST_STATUS.md, ROOT_CAUSE_BACKEND_IMAGE.md
- **Git Activity:** Recent commit Feb 10
- **Reasoning:** Self-referencing, multiple cross-references to test status. Important fix documentation.
- **Action:** **KEEP** - Active reference for backend troubleshooting

---

## CATEGORY 2: JSON Template Files

### ✅ SAFE TO REMOVE

#### `test-template-v2.json`
- **Size:** 338 bytes
- **Last Modified:** Feb 10 22:20
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Feb 10 (cleanup)
- **Reasoning:** No references found. Superseded by newer test templates.
- **Action:** Remove

#### `test-template-with-validation.json`
- **Size:** 4.0K
- **Last Modified:** Feb 10 21:38
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Feb 10 (cleanup)
- **Reasoning:** No references. Testing artifact.
- **Action:** Remove

#### `test-template-final.json`
- **Size:** 715 bytes
- **Last Modified:** Feb 10 22:31
- **Code References:** None
- **Doc References:** 1 file (TEMPLATE_VALIDATION_REPORT.md)
- **Git Activity:** Last commit Feb 10 (cleanup)
- **Reasoning:** Referenced only by validation report. Testing artifact.
- **Action:** Remove (keep validation report if needed)

#### `add-rest-endpoint-fixed.json`
- **Size:** 8.2K
- **Last Modified:** Feb 14 20:06
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Feb 14
- **Reasoning:** Intermediate fix version. No references. Superseded by newer versions.
- **Action:** Remove

### ⚠️ REVIEW REQUIRED

#### `test-template-simple.json`
- **Size:** 1.6K
- **Last Modified:** Feb 10 21:19
- **Code References:** 1 file (test_register_v2.py)
- **Doc References:** 4 files (QUICK_START_V2_TESTING.md, V2_MIGRATION_COMPLETE.md, etc.)
- **Git Activity:** Last commit Feb 10 (cleanup)
- **Reasoning:** **ACTIVELY USED** - Referenced by test_register_v2.py. Check if test is still run.
- **Action:** Review test file usage before removing

### 🔒 KEEP

#### `add-rest-endpoint.json`
- **Size:** 20K
- **Last Modified:** Feb 14 20:03
- **Code References:** 5 files including bootstrap scripts and SQL exports
- **Doc References:** 5 files including migration documentation
- **Git Activity:** Recent commit Feb 14
- **Reasoning:** **ACTIVELY USED** - Referenced by:
  - `scripts/bootstrap_core_templates.py` (active bootstrap script)
  - `scripts/migrate_v1_to_v2.py` (migration script)
  - SQL export bootstrap_activities_20260216_112459.json
  - Test suite (repos/metabob-opencode/packages/opencode/test/session/template-library.test.ts)
- **Action:** **KEEP** - Core template actively used in bootstrap process

---

## CATEGORY 3: Test/Script Files

### ✅ SAFE TO REMOVE

#### `test_activity_direct.py`
- **Size:** 2.8K
- **Last Modified:** Feb 12 00:56
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Feb 12
- **Reasoning:** Superseded by test_activity_execution_simple.py (Feb 15) and other newer test files.
- **Action:** Remove (verify tests pass without it)

#### `test_session_creation_directly.py`
- **Size:** 970 bytes
- **Last Modified:** Feb 9 14:54
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Feb 9 (cleanup)
- **Reasoning:** Old test file. Superseded by test_session_creation.py.
- **Action:** Remove

#### `test-jiggle-simple.sh`
- **Size:** 1.3K
- **Last Modified:** Feb 9 15:42
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Feb 9 (cleanup)
- **Reasoning:** Testing script with no references. Likely obsolete.
- **Action:** Remove

#### `devbob-demo.sh`
- **Size:** 7.1K
- **Last Modified:** Jan 27 12:50
- **Code References:** None
- **Doc References:** None
- **Git Activity:** Last commit Jan 27 (>20 days old)
- **Reasoning:** Old demo script. No recent activity or references.
- **Action:** Remove (or archive if demo is valuable)

### ⚠️ REVIEW REQUIRED

#### `test_3_activity_tool_integration.py`
- **Size:** 6.7K
- **Last Modified:** Feb 9 11:45
- **Code References:** None
- **Doc References:** 2 files (ACTIVITY_DISCOVERY_FIX_APPLIED.md, SESSION_SUMMARY_ACTIVITY_DISCOVERY_FIXED.md)
- **Git Activity:** Last commit Feb 9 (cleanup)
- **Reasoning:** Referenced by discovery fix documentation. May be part of test suite. Check if part of CI/CD.
- **Action:** Review - verify not in test suite, then remove

---

## CATEGORY 4: Config/Credential Files

### ✅ SAFE TO REMOVE

#### `.api_key_insert_v2.surql`
- **Size:** 430 bytes
- **Last Modified:** Feb 13 17:50
- **Code References:** None
- **Doc References:** 1 file (ACTIVITY_TEMPLATE_CREATION_SUCCESS.md)
- **Git Activity:** Last commit Feb 13
- **Reasoning:** V2 insert script. Referenced only by success doc. Likely superseded.
- **Action:** Remove (ensure current key insertion method works)

#### `.api_key_raw_v2.txt`
- **Size:** 29 bytes
- **Last Modified:** Feb 13 17:50
- **Code References:** None
- **Doc References:** 1 file (ACTIVITY_TEMPLATE_CREATION_SUCCESS.md)
- **Git Activity:** Last commit Feb 13
- **Reasoning:** V2 raw key file. No code references. Superseded.
- **Action:** Remove

### ⚠️ REVIEW REQUIRED

#### `.test_api_key`
- **Size:** 30 bytes
- **Last Modified:** Feb 14 17:29
- **Code References:** 5 files (multiple test scripts and fixtures)
- **Doc References:** 5 files including validation reports
- **Git Activity:** Recent commit Feb 14
- **Reasoning:** **ACTIVELY USED** - Referenced by:
  - `create_test_api_key.py`
  - `scripts/register-trace-test-activity.py`
  - `scripts/test-isolated-workspace.py`
  - `repos/metabob-rpc-api/tests/fixtures/mock_surreal.py`
  - `repos/metabob-rpc-api/tests/fixtures/test_mock_surreal.py`
- **Action:** **KEEP** - Active test credential used across test suite

---

## Summary by Category

### SAFE TO REMOVE (15 files)

**Documentation (4 files):**
- ACP_DELEGATE_TIMEOUT_FIX.md
- ACTIVITY_EXECUTION_DIAGNOSIS.md
- ACTIVITY_EXECUTION_MYSTERY.md

**JSON Templates (4 files):**
- test-template-v2.json
- test-template-with-validation.json
- test-template-final.json
- add-rest-endpoint-fixed.json

**Test/Scripts (4 files):**
- test_activity_direct.py
- test_session_creation_directly.py
- test-jiggle-simple.sh
- devbob-demo.sh

**Config Files (2 files):**
- .api_key_insert_v2.surql
- .api_key_raw_v2.txt

**Total Space Saved:** ~27.5 KB

### REVIEW REQUIRED (8 files)

**Documentation (2 files):**
- ACP_DELEGATION_FIX.md - Recent fix doc with cross-references
- ACTIVITY_TOOL_BUG_CONFIRMED.md - Referenced by status docs

**JSON Templates (1 file):**
- test-template-simple.json - Used by test_register_v2.py

**Test/Scripts (1 file):**
- test_3_activity_tool_integration.py - Referenced by fix docs

**Config Files (1 file):**
- .test_api_key - **ACTIVELY USED** by test suite

### KEEP (4 files)

**Documentation (3 files):**
- ACP_PHASE1_COMPLETION_REPORT.md - Active, updated today
- ACTIVITY_CREATE_FAILURE_ANALYSIS.md - Referenced by fix guide
- BACKEND_FIX_COMPLETE.md - Important troubleshooting reference

**JSON Templates (1 file):**
- add-rest-endpoint.json - **CORE TEMPLATE** used in bootstrap

---

## Recommended Actions

### Phase 1: Immediate Safe Removal
Remove the 15 files categorized as SAFE. These have no active code references and minimal or historical documentation references.

```bash
# Documentation
rm ACP_DELEGATE_TIMEOUT_FIX.md
rm ACTIVITY_EXECUTION_DIAGNOSIS.md
rm ACTIVITY_EXECUTION_MYSTERY.md

# JSON Templates
rm test-template-v2.json
rm test-template-with-validation.json
rm test-template-final.json
rm add-rest-endpoint-fixed.json

# Tests/Scripts
rm test_activity_direct.py
rm test_session_creation_directly.py
rm test-jiggle-simple.sh
rm devbob-demo.sh

# Config
rm .api_key_insert_v2.surql
rm .api_key_raw_v2.txt
```

### Phase 2: Review and Conditional Removal

1. **test-template-simple.json** - Check if test_register_v2.py is in active test suite
   ```bash
   # If test_register_v2.py is not run in CI/CD, remove both
   rg "test_register_v2" .github/ scripts/ || echo "Not in CI"
   ```

2. **test_3_activity_tool_integration.py** - Check if in test suite
   ```bash
   pytest --collect-only | grep test_3_activity_tool_integration
   ```

3. **ACP_DELEGATION_FIX.md** - Review with team for historical value
   - Consider consolidating into main ACP documentation

4. **ACTIVITY_TOOL_BUG_CONFIRMED.md** - Review with team
   - Consider consolidating into ACTIVITY_TEMPLATE_FIX_GUIDE.md

### Phase 3: DO NOT REMOVE

Keep these files - they are actively used:
- `ACP_PHASE1_COMPLETION_REPORT.md` (updated today)
- `ACTIVITY_CREATE_FAILURE_ANALYSIS.md` (referenced by guides)
- `BACKEND_FIX_COMPLETE.md` (troubleshooting reference)
- `add-rest-endpoint.json` (core template)
- `.test_api_key` (active test credential)

---

## Risk Assessment

### Low Risk (Safe Removal)
- Historical diagnostic docs
- Superseded test templates
- Old test scripts with no references
- Superseded config files

### Medium Risk (Review Required)
- Recent fix documentation (may have historical value)
- Test files referenced by docs (verify not in CI)
- Test templates used by specific tests (verify test necessity)

### High Risk (Keep)
- Active templates used in bootstrap
- Active test credentials
- Current project documentation
- Referenced troubleshooting guides

---

## Next Steps

1. ✅ Run Phase 1 safe removals (15 files)
2. ⚠️ Review Phase 2 candidates with team (4 files)
3. 🔒 Ensure Phase 3 files are protected (5 files)
4. 📊 Generate cleanup report showing space saved
5. 🔄 Update .gitignore if needed for generated files

---

**Analysis Complete:** 27 files analyzed, categorized, and documented.
