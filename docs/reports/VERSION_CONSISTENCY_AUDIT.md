# Version Consistency Audit - metabob-cli

**Repository**: repos/metabob-cli  
**Audit Date**: 2026-02-19  
**Auditor**: Version Consistency Activity

---

## Executive Summary

- **Status**: ❌ **FAIL** - Version inconsistency detected
- **Primary Version**: **INCONSISTENT** (1.9.0 vs 1.10.0)
- **Total Files Checked**: 6 key version files
- **Consistent Files**: 2 (CHANGELOG.md, git tags)
- **Inconsistent Files**: 2 (pyproject.toml vs _version.py)
- **Severity**: **HIGH** - Core version sources disagree

---

## Critical Findings

### 🔴 Version Mismatch Detected

**Two conflicting version sources**:
1. **Application Version** (_version.py): `1.9.0`
2. **Commitizen Tracker** (pyproject.toml): `1.10.0`

This creates ambiguity about the actual current version of the software.

---

## Version by File

### ✅ Consistent Files (Aligned with 1.9.0)

| File | Version | Format | Status | Notes |
|------|---------|--------|--------|-------|
| `src/metabob_cli/_version.py` | **1.9.0** | `__version__ = "1.9.0"` | ✅ | Source of truth for Hatch |
| `CHANGELOG.md` | **v1.9.0** | Latest entry: `## v1.9.0 (2026-02-17)` | ✅ | Matches _version.py |
| Git tags | **v1.9.0** | Latest tag: `v1.9.0` | ✅ | Matches _version.py |

### ❌ Inconsistent Files

| File | Version | Format | Status | Notes |
|------|---------|--------|--------|-------|
| `pyproject.toml` | **1.10.0** | `[tool.commitizen]`<br>`version = "1.10.0"` | ❌ | Ahead of _version.py by 1 minor version |

### 📄 Files Without Version Numbers (Generic References Only)

| File | Content | Status | Notes |
|------|---------|--------|-------|
| `README.md` | "download the latest version" | ℹ️ | Generic reference, not hardcoded |
| `.github/workflows/release.yaml` | Extracts from `_version.py` dynamically | ℹ️ | Runtime extraction, no hardcoded version |
| `.github/workflows/versioning-enforce.yaml` | Runs commitizen bump | ℹ️ | No hardcoded versions |
| `tests/unit/test_version_command.py` | Tests runtime VERSION constant | ℹ️ | No hardcoded versions |

---

## Version Management Configuration

### Current Commitizen Settings

**File**: `pyproject.toml` (lines 83-102)

```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "1.10.0"                           # ⚠️ AHEAD of _version.py
version_files = [
    "src/metabob_cli/_version.py:__version__",
    "pyproject.toml:version"                  # ⚠️ INVALID TARGET
]
update_changelog_on_bump = true
```

### Issues Found

#### 1. 🔴 Invalid Version File Target

**Problem**:
```toml
version_files = [
    "src/metabob_cli/_version.py:__version__",
    "pyproject.toml:version"  # ⚠️ This field doesn't exist!
]
```

**Why Invalid**:
- `pyproject.toml` has `dynamic=["version"]` (line 26)
- No static `version` field exists in `[project]` section
- Commitizen cannot update a non-existent field
- This causes partial version bumps where only commitizen's own config updates

#### 2. 🔴 Partial Version Bump

**Evidence**:
- Commitizen updated: `[tool.commitizen].version = "1.10.0"` ✅
- But missed: `src/metabob_cli/_version.py` remains at `1.9.0` ❌

**Root Cause**:
The invalid `pyproject.toml:version` target caused commitizen to:
1. Update its own version tracker to `1.10.0`
2. Fail to update `_version.py` (or skip it)
3. Leave the codebase in an inconsistent state

#### 3. ⚠️ Missing Version Files

The following files reference versions but are **not** in `version_files` config:
- `CHANGELOG.md` (managed separately by `update_changelog_on_bump`)
- Git tags (created by commitizen action)
- No other files found with hardcoded versions ✅

---

## Version Management Architecture

### How It's Designed to Work

```
┌─────────────────────────────────────────────┐
│ 1. Developer makes conventional commits     │
│    (feat:, fix:, BREAKING CHANGE:)          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 2. Push to main/staging                     │
│    Triggers: versioning-enforce.yaml        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 3. Commitizen analyzes commits             │
│    Determines: major/minor/patch bump       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 4. cz bump updates (SHOULD):                │
│    ✅ src/metabob_cli/_version.py           │
│    ❌ pyproject.toml:version (doesn't exist)│
│    ✅ CHANGELOG.md                           │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 5. Create git tag (e.g., v1.10.0)          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 6. Tag push triggers release.yaml           │
│    - Reads version from _version.py         │
│    - Builds binaries                        │
│    - Creates GitHub release                 │
└─────────────────────────────────────────────┘
```

### What Actually Happened (Failure Mode)

```
┌─────────────────────────────────────────────┐
│ cz bump attempted to update version         │
└─────────────────┬───────────────────────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
       ▼                     ▼
┌──────────────┐      ┌─────────────────┐
│ Update       │      │ Update          │
│ _version.py  │      │ pyproject.toml  │
│              │      │ :version        │
│ Result: ❌   │      │                 │
│ Skipped or   │      │ Result: ❌      │
│ failed       │      │ Field doesn't   │
│              │      │ exist           │
└──────────────┘      └─────────────────┘
       │                     │
       └──────────┬──────────┘
                  ▼
┌─────────────────────────────────────────────┐
│ Commitizen updates its own tracker:         │
│ [tool.commitizen].version = "1.10.0"        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ Result: Inconsistent state                  │
│ - Commitizen thinks version is 1.10.0       │
│ - Application actually at 1.9.0             │
└─────────────────────────────────────────────┘
```

---

## Dependency Chain Analysis

### Version Extraction by Hatch

**Configuration** (`pyproject.toml` lines 43-45):
```toml
[tool.hatch.version]
path = "src/metabob_cli/_version.py"
pattern = '__version__ = "(?P<version>[^"]+)"'
```

**Behavior**:
- Hatch reads version from `_version.py` at build time
- Used for PyPI package metadata
- `pyproject.toml` has `dynamic=["version"]` → no static version field
- **Current behavior**: Build system sees version as `1.9.0`

### Version Usage in CI/CD

#### 1. Release Workflow (`release.yaml` line 167)

```bash
VERSION=$(grep -oP '__version__ = "\K[^"]+' src/metabob_cli/_version.py)
```

- Reads version directly from `_version.py`
- Used for GitHub release tags
- **Current behavior**: Creates releases tagged `v1.9.0`

#### 2. Versioning Enforcement Workflow (`versioning-enforce.yaml`)

```yaml
- name: Create bump and changelog
  uses: commitizen-tools/commitizen-action@master
  with:
    github_token: ${{ secrets.AUTOMATION_PAT }}
    changelog: true
```

- Runs `cz bump` automatically on push to main/staging
- Should update `_version.py` via `version_files` config
- **Current behavior**: Updates commitizen version to 1.10.0 but leaves _version.py at 1.9.0

---

## Impact Analysis

### What Works ✅

1. **Application Runtime**:
   - CLI reports version as `1.9.0` (from `_version.py`)
   - `metabob-cli version` command shows correct runtime version

2. **Build System**:
   - Hatch reads `1.9.0` from `_version.py`
   - Package builds with version `1.9.0`

3. **CI/CD Releases**:
   - Release workflow reads `1.9.0` from `_version.py`
   - GitHub releases tagged correctly as `v1.9.0`

4. **Documentation**:
   - CHANGELOG.md shows `v1.9.0` as latest
   - Git tags match at `v1.9.0`

### What's Broken ❌

1. **Commitizen State**:
   - Commitizen thinks current version is `1.10.0`
   - Next `cz bump` will increment from `1.10.0` → `1.11.0` or `2.0.0`
   - But `_version.py` is still at `1.9.0`
   - This will create a version gap (skip `1.10.0` entirely)

2. **Version Bump Workflow**:
   - `versioning-enforce.yaml` runs `cz bump` automatically
   - Due to invalid config, bumps don't update `_version.py`
   - Creates divergence over time

3. **Developer Confusion**:
   - Which version is current? `1.9.0` or `1.10.0`?
   - Inconsistent state makes it unclear what to document

---

## Consistency Score

### Scoring Breakdown

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| **Core Version Files** (match) | 40% | 0/2 (0%) | 0.0 |
| **Documentation** (matches core) | 20% | 2/2 (100%) | 20.0 |
| **CI/CD** (extracts correctly) | 20% | 1/1 (100%) | 20.0 |
| **Version Management Config** (valid) | 20% | 0/1 (0%) | 0.0 |

**Total Consistency Score**: **40/100** ⚠️ **FAILING**

### Interpretation

- **Score < 50**: ❌ Critical inconsistency - immediate action required
- **Score 50-80**: ⚠️ Moderate issues - should be addressed soon
- **Score > 80**: ✅ Acceptable - minor improvements possible

---

## Recommendations

### Immediate Actions (Required)

#### 1. 🔧 Fix Commitizen Configuration

**File**: `pyproject.toml`

**Change** (lines 86-89):
```toml
# BEFORE (BROKEN):
version_files = [
    "src/metabob_cli/_version.py:__version__",
    "pyproject.toml:version"  # ❌ REMOVE THIS
]

# AFTER (FIXED):
version_files = [
    "src/metabob_cli/_version.py:__version__"
]
```

**Why**: Removes invalid target that causes partial version bumps

#### 2. 🔧 Synchronize Versions

**Decision**: Use `1.10.0` as canonical version (commitizen's current state)

**Steps**:
```bash
cd repos/metabob-cli

# Update _version.py
sed -i 's/__version__ = "1.9.0"/__version__ = "1.10.0"/' src/metabob_cli/_version.py

# Verify change
grep '__version__' src/metabob_cli/_version.py
# Expected: __version__ = "1.10.0"
```

#### 3. 📝 Update CHANGELOG

**File**: `CHANGELOG.md`

**Add at top**:
```markdown
## v1.10.0 (2026-02-19)

### Fixes

- **build**: fix version management configuration
  - Remove invalid pyproject.toml:version from commitizen version_files
  - Consolidate to single version source in _version.py
  - Synchronize commitizen tracker with application version
```

#### 4. 🏷️ Create Git Tag

```bash
cd repos/metabob-cli

git add src/metabob_cli/_version.py pyproject.toml CHANGELOG.md
git commit -m "bump: version 1.9.0 → 1.10.0

fix: correct version management configuration
- Remove invalid pyproject.toml:version target
- Synchronize all version files to 1.10.0
- Update CHANGELOG with version sync entry"

git tag v1.10.0
git push origin main --tags
```

---

### Preventive Measures (Recommended)

#### 1. ✅ Add Version Consistency Check to CI

**New workflow**: `.github/workflows/version-check.yaml`

```yaml
name: Version Consistency Check
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check version consistency
        run: |
          # Extract versions
          VERSION_PY=$(grep -oP '__version__ = "\K[^"]+' src/metabob_cli/_version.py)
          VERSION_CZ=$(grep -A1 '\[tool.commitizen\]' pyproject.toml | grep 'version =' | grep -oP '"\K[^"]+')
          
          echo "Version in _version.py: $VERSION_PY"
          echo "Version in commitizen: $VERSION_CZ"
          
          # Compare
          if [ "$VERSION_PY" != "$VERSION_CZ" ]; then
            echo "❌ Version mismatch detected!"
            exit 1
          fi
          
          echo "✅ Versions are consistent"
```

#### 2. 📋 Add Pre-commit Hook

**File**: `.pre-commit-config.yaml`

```yaml
repos:
  - repo: local
    hooks:
      - id: version-consistency
        name: Check version consistency
        entry: bash -c 'python -c "
import re
with open(\"src/metabob_cli/_version.py\") as f:
    version_py = re.search(r\"__version__ = \\\"([^\\\"]+)\\\"\", f.read()).group(1)
with open(\"pyproject.toml\") as f:
    content = f.read()
    in_cz = False
    for line in content.split(\"\\n\"):
        if \"[tool.commitizen]\" in line:
            in_cz = True
        elif in_cz and \"version =\" in line:
            version_cz = re.search(r\"\\\"([^\\\"]+)\\\"\", line).group(1)
            break
if version_py != version_cz:
    print(f\"❌ Version mismatch: _version.py={version_py}, commitizen={version_cz}\")
    exit(1)
print(f\"✅ Versions consistent: {version_py}\")
"'
        language: system
        pass_filenames: false
        always_run: true
```

#### 3. 📖 Document Version Management

**New file**: `VERSIONING.md`

```markdown
# Version Management

## Single Source of Truth

**File**: `src/metabob_cli/_version.py`
- Contains: `__version__ = "X.Y.Z"`
- Used by: Hatch (build), CLI (runtime), CI/CD (release)

## Version Bumping

Automatic via commitizen:
1. Make conventional commits (feat:/fix:/BREAKING CHANGE:)
2. Push to main or staging
3. GitHub Actions runs `cz bump`
4. Version in _version.py updates
5. CHANGELOG.md updates
6. Git tag created
7. Release workflow triggered

## Manual Bump

```bash
cz bump             # Auto-determine bump type
cz bump --increment MAJOR|MINOR|PATCH
```

## Verification

```bash
# Check consistency
python -c "from src.metabob_cli._version import __version__; print(__version__)"
grep 'version =' pyproject.toml | grep -A1 commitizen

# Both should show same version
```
```

---

## Version History

### Git Tags (Last 5)

```
v1.9.0           (2026-02-17)  ← Current application version
v1.8.0           (2026-02-17)
v1.7.1-staging   (date unknown)
v1.7.1           (2026-01-21)
v1.7.0-staging   (date unknown)
```

### CHANGELOG Entries

- **v1.9.0** (2026-02-17): Latest documented release
- **v1.8.0** (2026-02-17): CLI commands for dashboard
- **v1.7.1** (2026-01-21): Fast startup defaults

### Expected Next Version

After fixing inconsistency:
- **Current state**: Synchronized at `1.10.0`
- **Next bump** (patch): `1.10.1`
- **Next bump** (minor): `1.11.0`
- **Next bump** (major): `2.0.0`

---

## Testing Plan

### Pre-Fix Verification

```bash
cd repos/metabob-cli

# 1. Verify current inconsistency
echo "Version in _version.py:"
grep '__version__' src/metabob_cli/_version.py

echo "Version in commitizen:"
grep 'version =' pyproject.toml | grep -A1 commitizen

# 2. Test runtime version
python -c "from src.metabob_cli._version import __version__; print(f'Runtime: {__version__}')"

# 3. Check git tags
git describe --tags --abbrev=0
```

### Post-Fix Verification

```bash
cd repos/metabob-cli

# 1. Verify synchronization
VERSION_PY=$(grep -oP '__version__ = "\K[^"]+' src/metabob_cli/_version.py)
VERSION_CZ=$(grep 'version =' pyproject.toml | grep -A1 commitizen | grep -oP '"\K[^"]+')

echo "Version in _version.py: $VERSION_PY"
echo "Version in commitizen: $VERSION_CZ"

if [ "$VERSION_PY" == "$VERSION_CZ" ]; then
  echo "✅ PASS: Versions are synchronized"
else
  echo "❌ FAIL: Versions still inconsistent"
fi

# 2. Test commitizen bump (dry-run)
cz bump --dry-run
# Should show next version as 1.10.1 or 1.11.0 (not 1.11.0 from 1.10.0)

# 3. Verify git tag
git tag --list 'v1.10.0'
# Should exist after fix

# 4. Check CHANGELOG
head -20 CHANGELOG.md | grep 'v1.10.0'
# Should show v1.10.0 entry
```

---

## Summary of Recommendations

### Must Do (Breaking Issue)

1. ✅ Remove `pyproject.toml:version` from commitizen version_files
2. ✅ Update `_version.py` to `1.10.0`
3. ✅ Add v1.10.0 entry to CHANGELOG.md
4. ✅ Create and push v1.10.0 git tag

### Should Do (Prevent Recurrence)

5. ⚠️ Add version consistency check to CI
6. ⚠️ Add pre-commit hook for version checking
7. ⚠️ Document version management process

### Nice to Have (Documentation)

8. ℹ️ Create VERSIONING.md guide
9. ℹ️ Add version consistency badge to README
10. ℹ️ Update README with version management section

---

## Conclusion

**Current State**: ❌ **FAILING** - Critical version inconsistency

**Root Cause**: Invalid commitizen configuration attempting to update non-existent `pyproject.toml:version` field

**Impact**: Commitizen and application versions are out of sync (1.10.0 vs 1.9.0)

**Resolution**: Follow immediate actions above to synchronize versions and fix configuration

**Timeline**: 
- Fix can be completed in < 30 minutes
- Should be done before next version bump
- Prevents version number gaps and confusion

**Next Steps**: Execute immediate actions 1-4 to restore version consistency

---

**Audit Complete**: 2026-02-19  
**Status**: ❌ **FAIL**  
**Action Required**: Yes - Immediate
