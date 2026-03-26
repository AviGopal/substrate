# Version Files Discovery Report
**Repository**: repos/metabob-rpc-api  
**Report Date**: 2026-02-19  
**Current Time**: 03:06 PST

---

## 🚨 CRITICAL FINDING: Wrong Branch Detected

### Current State
- **Branch**: `main` (HEAD: 953dde0)
- **Version**: 0.12.6
- **Last Commit**: 2026-02-19 02:01:31 (2 hours ago)
- **Status**: ❌ **OUTDATED BRANCH - 37 days behind production**

### Correct Branch
- **Branch**: `refactor-code-similarity` / `origin/refactor-code-similarity`
- **Version**: 0.16.0+
- **Last Commit**: 2026-02-16 11:18:06 (3 days ago)
- **Status**: ✅ **ACTIVE DEVELOPMENT BRANCH**

### Timeline Analysis

| Date | Branch | Event | Version |
|------|--------|-------|---------|
| 2026-01-13 | refactor-code-similarity | 🏷️ Bump to 0.16.0 | 0.16.0 |
| 2026-01-24 to 2026-02-16 | refactor-code-similarity | ✨ Active development (160+ commits) | 0.16.0 |
| 2026-02-19 | main | ⚠️ Bump to 0.12.6 (outdated) | 0.12.6 |
| **Today** | 2026-02-19 03:06 | 📊 Current assessment | - |

**Divergence**: The main branch is **37 days behind** the refactor-code-similarity branch, which has **160 commits** of new work not in main.

---

## Version Definition Files

### Primary Version Source
**File**: `server/__version__` (no .py extension on refactor branch)

| Branch | File Path | Version | Last Updated |
|--------|-----------|---------|--------------|
| main | `server/__version__.py` | 0.12.6 | 2026-02-19 02:01:31 |
| **refactor-code-similarity** ✅ | `server/__version__` | **0.16.0** | **2026-01-13 20:04:32** |

**Note**: File extension changed from `.py` to no extension on refactor branch.

### Package Configuration
**File**: `pyproject.toml`

```toml
[tool.commitizen]
version = "0.6.0"  # ⚠️ Severely outdated on both branches
version_files = [
    "server/__version__.py:__version__"  # May need update to "server/__version__"
]
```

---

## Branch Comparison

### Common Ancestor
- **Commit**: eb4b02c (2025-08-07)
- **Age**: ~6.5 months ago

### Divergence Summary

```
main (953dde0)
├─ 6 commits since fork
├─ Version: 0.12.6
└─ Last activity: 2 hours ago

refactor-code-similarity (4dc24c7)
├─ 160 commits since fork
├─ Version: 0.16.0+
└─ Last activity: 3 days ago
```

### Key Commits on refactor-code-similarity (Recent)
```
2026-02-16  feat: Add user management endpoints for task reporting
2026-02-16  feat: Add backend schema support for template registration
2026-02-15  fix(bootstrap): Change 'tasks' to 'task_steps' in bootstrap template conversion
2026-02-15  feat(activity-learning): Add impulse_registry and impulse_usage tables
2026-02-14  feat: add v2/impulses learned context API
2026-02-13  Add V2 API endpoints for dashboard observability
2026-02-12  feat: Auto-create new variant when content fields change in update
2026-02-08  feat: Complete Phase 2D - Add test scripts and API integration
2026-02-08  feat(activity-system): complete backend bootstrap with proto templates
2026-02-06  feat: add metabob-proto dependency and update adapter imports
2026-02-05  feat: add activity management API and enhance recommendation system
```

### Key Commits on main (Recent)
```
2026-02-19  chore: bump version to 0.12.6
2026-02-19  fix(docker): correct Dockerfile CMD to allow docker-compose command override
2026-02-19  feat(api): implement activity metrics backend (Phase 3.2)
2026-02-18  Fix activity routes: remove await from sync functions
2026-02-18  Add activity template API endpoints
2026-01-29  Enhance health endpoint with status and timestamp, add UserProfile models
```

---

## Version Management

### Tool: Commitizen (Inconsistently Used)

**Configuration**: `pyproject.toml`
```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "0.6.0"  # Last synced May 2023
tag_format = "$major.$minor.$patch$prerelease"
version_files = [
    "server/__version__.py:__version__"
]
```

### Status: ⚠️ **NOT SYNCHRONIZED**

| Component | Version | Status |
|-----------|---------|--------|
| **Actual Code (refactor branch)** | 0.16.0 | ✅ Production version |
| Actual Code (main branch) | 0.12.6 | ❌ Outdated |
| Commitizen (pyproject.toml) | 0.6.0 | ❌ 3 years behind |
| CHANGELOG.md | 0.6.0 | ❌ 3 years behind |
| Git Tags | None | ❌ No tags exist |

### Workflow Observed
```bash
# NOT using proper commitizen workflow:
# cz bump  # Would auto-update version, CHANGELOG, create tags

# Instead using manual commits:
git commit -m "chore: bump version to X.Y.Z"
```

---

## CI/CD References

### GitHub Actions
**File**: `.github/workflows/run-tests.yaml`
- **Python Version**: 3.10 (for testing)
- **No API Version Embedding**: Uses dynamic version from code
- **Status**: ✅ No hardcoded versions to update

### Docker
**File**: `docker/Dockerfile.analysis-worker`
- **Base Image**: `python:3.12.10-bookworm`
- **No API Version Hardcoded**: Picks up version from code at build time
- **Status**: ✅ No hardcoded versions to update

---

## Documentation Files

### README.md
- **Version Mentions**: None (generic)
- **Python Requirement**: 3.10+
- **Status**: ✅ No version sync needed

### CHANGELOG.md
```markdown
## 0.6.0 (2023-05-04)
└─ Last entry from 3 years ago
```
- **Current State**: Severely outdated
- **Missing Versions**: 0.7.0 through 0.16.0 (10+ versions)
- **Status**: ⚠️ Needs regeneration or update

---

## Version Synchronization Requirements

### If Using refactor-code-similarity Branch (RECOMMENDED)

**Target Version**: 0.16.0 (or higher if development continued)

**Files to Update**:
1. ✏️ `pyproject.toml:81` - Update `version = "0.6.0"` → `version = "0.16.0"`
2. ✏️ `pyproject.toml:87` - Verify `version_files` path (may need to remove `.py` extension)
3. 📝 `CHANGELOG.md` - Regenerate with `cz changelog` or manual update
4. 🏷️ **Git Tag** - Create `0.16.0` tag at commit 05e95d7

**Commands**:
```bash
cd repos/metabob-rpc-api
git checkout refactor-code-similarity

# Option 1: Manual sync
# Edit pyproject.toml version to 0.16.0
git add pyproject.toml
git commit -m "chore: sync commitizen to 0.16.0"
git tag 0.16.0

# Option 2: Use commitizen (will detect current version)
cz bump --no-verify  # If version file is already 0.16.0
```

### If Merging refactor-code-similarity → main

**Recommended**: Merge the refactor branch into main to bring main up to date.

```bash
cd repos/metabob-rpc-api
git checkout main
git merge refactor-code-similarity
# Resolve any conflicts
# Version will become 0.16.0+
```

---

## Recommendations

### ✅ DO: Switch to refactor-code-similarity Branch

**Rationale**:
- ✅ Contains 160 commits of recent work (last 37 days)
- ✅ Last updated 3 days ago (active development)
- ✅ Version 0.16.0 represents actual production codebase
- ✅ Includes critical features: activity system, impulse API, v2 endpoints

### ❌ DO NOT: Use main Branch

**Rationale**:
- ❌ 37 days behind active development
- ❌ Missing 160 commits of new features
- ❌ Version 0.12.6 is outdated
- ❌ Last real feature work: January 29 (21 days ago)
- ❌ Recent commits (Feb 19) appear to be incorrect backports

### 🎯 Correct Version: 0.16.0

**NOT 0.16.3** - this version does not exist in the repository.

**Evidence**:
```bash
$ git log --all --grep="0.16" | grep "Date:"
Date:   Tue Jan 13 20:04:32 2026 -0800  # 0.16.0 commit
```

Only 0.16.0 exists. If 0.16.3 is needed, it must be created via proper version bumps.

---

## Action Plan

### Phase 1: Verify Current Branch Usage
```bash
cd repos/metabob-rpc-api
git branch --show-current  # Should be refactor-code-similarity
git log -1 --format="%ai %s"  # Should show recent date
```

### Phase 2: Sync Version Files to 0.16.0
1. Update `pyproject.toml` commitizen version
2. Verify `version_files` path matches actual file (with or without .py)
3. Update CHANGELOG.md (optional but recommended)
4. Create git tag `0.16.0`

### Phase 3: Consider Merging to main
If main is meant to be production:
```bash
git checkout main
git merge refactor-code-similarity
git push origin main
```

---

## Questions for User

1. **Which branch should be production?**
   - refactor-code-similarity (0.16.0, 160 commits ahead) ✅ Recommended
   - main (0.12.6, outdated) ❌ Not recommended

2. **Where did 0.16.3 come from?**
   - Not in git history
   - Not in any tags
   - External reference? Docker registry?

3. **Should we merge refactor-code-similarity into main?**
   - Makes main the canonical production branch
   - Preserves git history properly

---

## Files Summary

### Version-Bearing Files Found
- `server/__version__` (refactor branch) - Version 0.16.0 ✅
- `server/__version__.py` (main branch) - Version 0.12.6 ❌
- `pyproject.toml` - Version 0.6.0 (both branches) ❌
- `CHANGELOG.md` - Version 0.6.0 (both branches) ❌

### Files Without Version References
- `.github/workflows/run-tests.yaml` ✅
- `docker/Dockerfile.analysis-worker` ✅
- `README.md` ✅

### Git Tags
- **Count**: 0
- **Status**: ❌ No tags exist in repository
- **Recommendation**: Create `0.16.0` tag

---

## Conclusion

**The correct version to synchronize to is 0.16.0**, which exists on the `refactor-code-similarity` branch dated January 13, 2026 (37 days ago). This branch contains 160 commits of active development and represents the actual production codebase.

The `main` branch with version 0.12.6 is outdated and should not be used for production deployments. Version 0.16.3 does not exist anywhere in the repository.

**Recommended Action**: Switch to `refactor-code-similarity` branch and synchronize version files to 0.16.0.
