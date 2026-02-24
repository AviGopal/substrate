# Version Consistency Audit - metabob-rpc-api

**Repository**: repos/metabob-rpc-api  
**Audit Date**: 2026-02-19 03:10 PST  
**Auditor**: OpenCode Versioning Activity

---

## Executive Summary

### Status: ❌ **FAIL - CRITICAL INCONSISTENCIES DETECTED**

| Metric | Value |
|--------|-------|
| **Primary Version** | ❌ **INCONSISTENT** (0.12.6 vs 0.16.0) |
| **Total Files Checked** | 5 |
| **Consistent Files** | 0 |
| **Inconsistent Files** | 5 |
| **Severity** | 🔴 **CRITICAL** |

### Critical Issues
1. ❌ **Wrong branch in use**: Currently on `main` (outdated), should be on `refactor-code-similarity`
2. ❌ **Version mismatch**: Code at 0.12.6 (main) vs 0.16.0 (production branch)
3. ❌ **Commitizen severely outdated**: 0.6.0 (3 years behind actual code)
4. ❌ **Missing CHANGELOG**: Deleted from production branch
5. ❌ **No git tags**: Version history not properly tagged

---

## Branch Analysis

### Current Working Branch: `main` ❌
```
Branch: main
HEAD: 953dde0
Last Commit: 2026-02-19 02:01:31 (2 hours ago)
Version: 0.12.6
Status: OUTDATED - 37 days behind production
Commits Since Fork: 6
```

### Production Branch: `refactor-code-similarity` ✅
```
Branch: refactor-code-similarity
HEAD: 4dc24c7
Last Commit: 2026-02-16 11:18:06 (3 days ago)
Version: 0.16.0
Status: ACTIVE DEVELOPMENT
Commits Since Fork: 160
```

### ⚠️ **ROOT CAUSE**: Wrong branch is checked out

---

## Version by File (Current: main branch)

### ❌ All Files Inconsistent

| File | Actual Version | Expected Version | Status | Discrepancy |
|------|---------------|------------------|--------|-------------|
| `server/__version__.py` | 0.12.6 | 0.16.0 | ❌ | -3 minor, -4 versions behind |
| `pyproject.toml` (commitizen) | 0.6.0 | 0.16.0 | ❌ | -10 minor, -10 versions behind |
| `CHANGELOG.md` | 0.6.0 (2023-05-04) | 0.16.0 | ❌ | 3 years outdated |
| Git tags | (none) | 0.16.0 | ❌ | Missing |
| `.github/workflows/run-tests.yaml` | (no version) | N/A | ✅ | Dynamic (correct) |
| `docker/Dockerfile.analysis-worker` | (no version) | N/A | ✅ | Dynamic (correct) |

### Detailed File Analysis

#### 1. `server/__version__.py` (main branch)
```python
__version__ = "0.12.6"
```
- **Branch**: main
- **Status**: ❌ **WRONG BRANCH VERSION**
- **Expected**: 0.16.0 (from refactor-code-similarity)
- **Last Updated**: 2026-02-19 02:01:31
- **Issue**: This version represents outdated code missing 160 commits

#### 2. `server/__version__` (refactor-code-similarity branch)
```
0.16.0
```
- **Branch**: refactor-code-similarity
- **Status**: ✅ **CORRECT PRODUCTION VERSION**
- **Last Updated**: 2026-01-13 20:04:32
- **Note**: File extension removed (no `.py`)

#### 3. `pyproject.toml` [tool.commitizen] (main branch)
```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "0.6.0"
tag_format = "$major.$minor.$patch$prerelease"
version_files = [
    "server/__version__.py:__version__"
]
```
- **Status**: ❌ **SEVERELY OUTDATED**
- **Current**: 0.6.0
- **Expected**: 0.16.0
- **Gap**: 10 minor versions (0.7.0, 0.8.0, ..., 0.16.0)
- **Last Synced**: May 2023 (3 years ago)
- **Issue**: Commitizen is completely out of sync with actual code

#### 4. `pyproject.toml` [tool.commitizen] (refactor-code-similarity branch)
```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "0.6.0"
tag_format = "$major.$minor.$patch$prerelease"
version_files = [
    "server/__version__"  # ✅ Correct path (no .py)
]
```
- **Status**: ⚠️ **PARTIALLY CORRECT**
- **Version**: 0.6.0 (still outdated)
- **version_files**: ✅ Correctly references `server/__version__` (no .py)
- **Issue**: Version number not synced, but file path is correct

#### 5. `CHANGELOG.md` (main branch)
```markdown
## 0.6.0 (2023-05-04)

### Feat
- **mixpanel**: added mixpanel tracking middleware
...

## 0.5.0 (2023-04-11)
...
```
- **Status**: ❌ **SEVERELY OUTDATED**
- **Last Entry**: 0.6.0 (2023-05-04) - **3 years ago**
- **Missing Entries**: 0.7.0, 0.8.0, 0.9.0, 0.10.0, 0.11.0, 0.12.x, 0.13.x, 0.14.x, 0.15.0, 0.16.0
- **Total Missing**: ~10 major version releases

#### 6. `CHANGELOG.md` (refactor-code-similarity branch)
```bash
fatal: path 'CHANGELOG.md' exists on disk, but not in 'refactor-code-similarity'
```
- **Status**: ❌ **DELETED FROM PRODUCTION BRANCH**
- **Issue**: CHANGELOG removed entirely from refactor branch
- **Recommendation**: Regenerate using `cz changelog` or remove from main too

#### 7. Git Tags
```bash
$ git tag -l
(no output - no tags exist)
```
- **Status**: ❌ **NO TAGS EXIST**
- **Expected Tags**: 0.6.0, 0.7.0, ..., 0.16.0 (at minimum)
- **Issue**: Version history not properly tagged
- **Impact**: Cannot easily reference or deploy specific versions

---

## Version Progression Analysis

### Actual Version History (from git commits)

| Version | Commit | Date | Branch | Note |
|---------|--------|------|--------|------|
| 0.16.0 | 05e95d7 | 2026-01-13 | refactor-code-similarity | ✅ Current production |
| 0.15.0 | 325bb4a | 2025-12-?? | refactor-code-similarity | Hierarchical sessions |
| 0.14.18 | 895e09a | 2025-??-?? | refactor-code-similarity | Docker update |
| 0.14.17 | 62a6308 | 2025-??-?? | refactor-code-similarity | Config limits |
| 0.14.16 | 253eae5 | 2025-??-?? | refactor-code-similarity | WebSocket progress |
| 0.14.13 | 5761655 | 2025-??-?? | refactor-code-similarity | Docker update |
| 0.14.10 | 503e21d | 2025-??-?? | refactor-code-similarity | WebSocket config |
| 0.14.9 | e6e0fc5 | 2025-??-?? | refactor-code-similarity | Tiktoken dependency |
| 0.14.6 | f4cbd5a | 2025-??-?? | refactor-code-similarity | Bump |
| 0.12.6 | 953dde0 | 2026-02-19 | **main** | ❌ Outdated branch |
| 0.12.4 | a3480c7 | 2025-??-?? | main | Error handling |

### Version Timeline Visualization

```
refactor-code-similarity (PRODUCTION) ✅
├─ 0.16.0 ──────────────────────────────────┐ 2026-01-13
├─ 0.15.0                                    │
├─ 0.14.18                                   │
├─ 0.14.17                                   │ 160 commits
├─ 0.14.16                                   │ 37 days of work
├─ 0.14.13                                   │
├─ 0.14.10                                   │
├─ 0.14.9                                    │
└─ 0.14.6 ───────────────────────────────────┘
                                             
                    FORK (eb4b02c)
                    2025-08-07
                                             
main (OUTDATED) ❌
├─ 0.12.6 ──────────────────────────────────┐ 2026-02-19 (today)
└─ 0.12.4 ──────────────────────────────────┘ 6 commits only
```

### ⚠️ **Critical Observation**
Main branch version (0.12.6) was bumped **TODAY** (2026-02-19), but production branch (0.16.0) was bumped **37 days ago** (2026-01-13). This indicates:
1. Development has been happening on refactor-code-similarity
2. Main branch is receiving incorrect version bumps
3. **We are working on the wrong branch**

---

## Version Management Configuration

### Commitizen Configuration (main branch)

```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "0.6.0"  # ❌ OUTDATED (should be 0.12.6 or 0.16.0)
tag_format = "$major.$minor.$patch$prerelease"
version_files = [
    "server/__version__.py:__version__"  # ✅ Correct for main branch
]
```

**Issues**:
- ❌ `version` field is 0.6.0 (should be 0.12.6 to match current branch)
- ✅ `version_files` correctly references main branch file

### Commitizen Configuration (refactor-code-similarity branch)

```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "0.6.0"  # ❌ OUTDATED (should be 0.16.0)
tag_format = "$major.$minor.$patch$prerelease"
version_files = [
    "server/__version__"  # ✅ Correct (no .py extension)
]
```

**Issues**:
- ❌ `version` field is 0.6.0 (should be 0.16.0 to match current code)
- ✅ `version_files` correctly references file without .py extension

### Missing from version_files
None - both configurations correctly reference their respective version files.

### Unmanaged Version References
- ❌ **CHANGELOG.md**: Not auto-updated (deleted on refactor branch, outdated on main)
- ❌ **Git Tags**: Not created automatically

---

## Consistency Check Matrix

| Requirement | main | refactor-code-similarity | Status |
|-------------|------|--------------------------|--------|
| Code version matches commitizen | ❌ 0.12.6 ≠ 0.6.0 | ❌ 0.16.0 ≠ 0.6.0 | FAIL |
| CHANGELOG up to date | ❌ (3 years old) | ❌ (deleted) | FAIL |
| Git tag exists | ❌ | ❌ | FAIL |
| version_files path correct | ✅ | ✅ | PASS |
| Is production branch | ❌ | ✅ | FAIL (wrong branch) |

### Overall Consistency Score: 1/5 (20%) ❌

---

## Recommendations

### 🔴 CRITICAL: Switch to Correct Branch

**Action**: Check out `refactor-code-similarity` branch immediately

```bash
cd repos/metabob-rpc-api
git checkout refactor-code-similarity
git pull origin refactor-code-similarity
```

**Rationale**: Main branch is 37 days and 160 commits behind production. All work should be on refactor-code-similarity.

---

### 🟡 HIGH PRIORITY: Synchronize Commitizen to 0.16.0

**Target Version**: 0.16.0 (actual code version on refactor-code-similarity)

**Files to Update**:
1. ✏️ `pyproject.toml:82` - Update `version = "0.6.0"` → `version = "0.16.0"`

**Commands**:
```bash
cd repos/metabob-rpc-api
git checkout refactor-code-similarity

# Edit pyproject.toml manually
sed -i 's/version = "0.6.0"/version = "0.16.0"/' pyproject.toml

# Commit the sync
git add pyproject.toml
git commit -m "chore: sync commitizen to 0.16.0"
```

---

### 🟢 RECOMMENDED: Create Git Tag

**Action**: Tag the 0.16.0 release

```bash
cd repos/metabob-rpc-api
git checkout refactor-code-similarity
git tag -a 0.16.0 05e95d7 -m "Release 0.16.0"
git push origin 0.16.0
```

**Rationale**: Enables version-based deployments and proper release management.

---

### 🟢 OPTIONAL: Regenerate CHANGELOG

**Option 1: Use commitizen**
```bash
cd repos/metabob-rpc-api
git checkout refactor-code-similarity
cz changelog
git add CHANGELOG.md
git commit -m "docs: regenerate CHANGELOG for versions 0.7.0-0.16.0"
```

**Option 2: Remove CHANGELOG entirely**
```bash
# If CHANGELOG maintenance is abandoned, remove from main branch too
cd repos/metabob-rpc-api
git checkout main
git rm CHANGELOG.md
git commit -m "docs: remove outdated CHANGELOG"
```

---

## Action Plan Summary

### Phase 1: Immediate Actions (CRITICAL)
1. ✅ Switch to `refactor-code-similarity` branch
2. ✅ Verify version is 0.16.0 in `server/__version__`

### Phase 2: Version Synchronization (HIGH PRIORITY)
3. ✅ Update `pyproject.toml` commitizen version: 0.6.0 → 0.16.0
4. ✅ Commit the change with proper message
5. ✅ Create git tag `0.16.0` at commit 05e95d7

### Phase 3: Documentation (RECOMMENDED)
6. ⚠️ Decide on CHANGELOG strategy (regenerate or remove)
7. ⚠️ Update README if version is referenced (currently not)

### Phase 4: Process Improvement (FUTURE)
8. 📋 Adopt `cz bump` for future version increments
9. 📋 Decide on main branch strategy (merge or replace)

---

## Validation Checklist

After completing recommended actions, verify:

- [ ] On `refactor-code-similarity` branch (not main)
- [ ] `server/__version__` shows `0.16.0`
- [ ] `pyproject.toml` [tool.commitizen] version shows `0.16.0`
- [ ] Git tag `0.16.0` exists and points to commit 05e95d7
- [ ] CHANGELOG exists and is up-to-date (or intentionally removed)
- [ ] All version references consistent at 0.16.0

---

## Conclusion

The repository has **critical version inconsistencies** stemming from working on the wrong branch. The `main` branch (0.12.6) is 37 days and 160 commits behind the production `refactor-code-similarity` branch (0.16.0).

**Immediate Action Required**:
1. Switch to `refactor-code-similarity` branch
2. Sync commitizen to 0.16.0
3. Create git tag for 0.16.0
4. Clarify source of "0.16.3" reference (does not exist in repository)

**Version 0.16.3 does not exist in the repository.** The highest version is **0.16.0** on the `refactor-code-similarity` branch.

---

**Audit Complete**: 2026-02-19 03:10 PST  
**Status**: ❌ **FAIL - CRITICAL**  
**Action Required**: Immediate
