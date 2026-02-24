# Version Files Discovery Report - metabob-cli

**Repository**: repos/metabob-cli  
**Date**: 2026-02-19  
**Discovered by**: Version Discovery Activity

## Executive Summary

**Version Inconsistency Detected**: 
- `_version.py`: **1.9.0**
- `pyproject.toml` (commitizen): **1.10.0**

**Version Management Tool**: Commitizen (configured in pyproject.toml)

---

## 1. Version Definition Files

### Primary Version Source
- **File**: `src/metabob_cli/_version.py`
  - **Current Version**: `1.9.0`
  - **Format**: `__version__ = "1.9.0"`
  - **Purpose**: Single source of truth for application version (used by Hatch and imported by CLI)

### Build Configuration
- **File**: `pyproject.toml`
  - **Current Version in commitizen**: `1.10.0` ⚠️ **MISMATCH**
  - **Dynamic version**: Yes (line 26: `dynamic=["version"]`)
  - **Version extraction**: Via Hatch from `_version.py` (lines 43-45)
  - **Pattern**: `__version__ = "(?P<version>[^"]+)"`

---

## 2. Version Management Configuration

### Tool: Commitizen

**Configuration** (`pyproject.toml` lines 83-102):
```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "1.10.0"  # ⚠️ OUT OF SYNC WITH _version.py
version_files = [
    "src/metabob_cli/_version.py:__version__",
    "pyproject.toml:version"
]
update_changelog_on_bump = true
```

**Commitizen Strategy**:
- Uses conventional commits for versioning
- Automatically updates CHANGELOG.md
- Configured to update both `_version.py` and `pyproject.toml`
- Expected workflow: `cz bump` updates all version_files + creates git tag

**Version Files Managed by Commitizen**:
1. `src/metabob_cli/_version.py:__version__` → Should be 1.10.0 but shows 1.9.0
2. `pyproject.toml:version` → Shows 1.10.0 in commitizen config

---

## 3. CI/CD Version References

### GitHub Workflows

#### 1. `.github/workflows/versioning-enforce.yaml`
- **Purpose**: Automatic version bumping via commitizen
- **Triggers**: Push to `main` or `staging` branches
- **Actions**:
  - Runs `commitizen bump` automatically
  - Creates changelog entries
  - Commits version changes with PAT token
- **Prerelease**: Uses `rc` suffix for staging branch

#### 2. `.github/workflows/release.yaml`
- **Purpose**: Build and release binaries for all platforms
- **Version Extraction** (lines 164-169):
  ```yaml
  VERSION=$(grep -oP '__version__ = "\K[^"]+' src/metabob_cli/_version.py)
  ```
  - Reads version directly from `_version.py`
  - Uses this for GitHub release tags
- **Triggers**: Git tags matching `*.*.*` pattern, staging branch, or manual dispatch
- **Release Tags**:
  - Main/release branch: `v{VERSION}`
  - Staging: `v{VERSION}-staging`
  - Tagged releases: Uses tag as-is
- **Platforms**:
  - Linux (x64, arm64)
  - macOS (arm64 only - Apple Silicon)
  - Windows (x64 only)

#### 3. `.github/workflows/platform-compatibility.yaml`
- May contain version references (not examined in detail)

---

## 4. Documentation References

### CHANGELOG.md
- **Latest Version**: `v1.9.0` (2026-02-17)
- **Managed by**: Commitizen (`update_changelog_on_bump = true`)
- **Format**: Conventional changelog with sections:
  - Features
  - Fixes
  - Breaking changes

### README.md
- **Version References**: Minimal
- Mentions "download the latest version" from releases page
- No hardcoded version numbers in user-facing docs

### Test Files
- **File**: `tests/unit/test_version_command.py`
- **Purpose**: Tests version command output format
- **Validation**: Checks for semver pattern `\d+\.\d+\.\d+`
- **No hardcoded versions**: Tests use runtime VERSION constant

---

## 5. Current Versions Found

| File | Version | Status |
|------|---------|--------|
| `src/metabob_cli/_version.py` | **1.9.0** | ⚠️ OUT OF SYNC |
| `pyproject.toml` (commitizen config) | **1.10.0** | ⚠️ OUT OF SYNC |
| `CHANGELOG.md` (latest entry) | **v1.9.0** | Matches _version.py |
| GitHub workflow (reads _version.py) | **1.9.0** | Matches _version.py |

---

## 6. Version Management Strategy

### Detected Strategy: **Commitizen with Version Files**

**How It Should Work**:
1. Developer makes conventional commits (feat:, fix:, etc.)
2. Push to `main` or `staging` triggers versioning-enforce.yaml
3. Commitizen analyzes commits and determines version bump (major/minor/patch)
4. `cz bump` updates:
   - `src/metabob_cli/_version.py:__version__`
   - `pyproject.toml:version` (in commitizen section)
   - `CHANGELOG.md` with new entries
5. Creates git tag (e.g., `v1.10.0`)
6. Pushes tag, which triggers release.yaml workflow
7. Release workflow:
   - Reads version from `_version.py`
   - Builds binaries for all platforms
   - Creates GitHub release with tag

**Current Issue**:
- Commitizen config shows `version = "1.10.0"`
- But `_version.py` shows `__version__ = "1.9.0"`
- This suggests:
  - Either commitizen bump partially failed
  - Or manual edit to one file without updating the other
  - Or version files config not working correctly

---

## 7. Root Cause Analysis

### Why the Mismatch Exists

**Most Likely Scenario**:
The commitizen `version_files` configuration expects to update a field called `version` in `pyproject.toml`, but:
- `pyproject.toml` has `dynamic=["version"]` (line 26)
- No static `version` field exists in `[project]` section
- Commitizen updated its own config (`[tool.commitizen].version = "1.10.0"`)
- But couldn't update non-existent `pyproject.toml:version` in project section
- `_version.py` may have been missed or failed to update

**Evidence**:
```toml
[project]
dynamic=["version"]  # Version comes from _version.py via Hatch

[tool.commitizen]
version = "1.10.0"  # Commitizen's own version tracker
version_files = [
    "src/metabob_cli/_version.py:__version__",
    "pyproject.toml:version"  # ⚠️ This field doesn't exist in [project]!
]
```

---

## 8. Recommended Fix

### Option 1: Fix Commitizen Config (Recommended)

Update `version_files` to only manage files that actually exist:

```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "1.10.0"
version_files = [
    "src/metabob_cli/_version.py:__version__"
]
update_changelog_on_bump = true
```

**Steps**:
1. Remove `pyproject.toml:version` from version_files
2. Update `_version.py` to `1.10.0` to sync with commitizen
3. Verify CHANGELOG reflects v1.10.0 as current version
4. Test `cz bump` to ensure it correctly updates `_version.py`

### Option 2: Add Static Version Field

Add a static version field to `pyproject.toml` (not recommended with Hatch dynamic version):

```toml
[project]
version = "1.10.0"  # Remove from dynamic
```

**Not recommended** because:
- Duplicates version information
- Hatch already extracts from `_version.py`
- Creates another sync point to maintain

---

## 9. Validation Commands

### Check Current State
```bash
# Version in _version.py
grep '__version__' repos/metabob-cli/src/metabob_cli/_version.py

# Version in commitizen config
grep 'version = ' repos/metabob-cli/pyproject.toml | grep -A1 '\[tool.commitizen\]'

# Latest CHANGELOG entry
head -20 repos/metabob-cli/CHANGELOG.md | grep '^##'

# Test version command
cd repos/metabob-cli && python -m metabob_cli.commands version
```

### After Fix
```bash
# Test commitizen bump (dry-run)
cd repos/metabob-cli && cz bump --dry-run

# Verify version consistency
cd repos/metabob-cli && python -c "
from src.metabob_cli._version import __version__
import toml
config = toml.load('pyproject.toml')
cz_version = config['tool']['commitizen']['version']
print(f'_version.py: {__version__}')
print(f'commitizen: {cz_version}')
print(f'Match: {__version__ == cz_version}')
"
```

---

## 10. Files Requiring Updates

To synchronize to **version 1.10.0** (commitizen's current version):

1. **`src/metabob_cli/_version.py`** (line 3):
   ```python
   __version__ = "1.10.0"  # Change from "1.9.0"
   ```

2. **`pyproject.toml`** (lines 86-89):
   ```toml
   version_files = [
       "src/metabob_cli/_version.py:__version__"
       # Remove: "pyproject.toml:version"
   ]
   ```

3. **`CHANGELOG.md`** (add entry):
   ```markdown
   ## v1.10.0 (2026-02-19)
   
   ### Fixes
   
   - consolidate to single version source in _version.py
   ```

4. **Commit and Tag**:
   ```bash
   git add src/metabob_cli/_version.py pyproject.toml CHANGELOG.md
   git commit -m "bump: version 1.9.0 → 1.10.0"
   git tag v1.10.0
   ```

---

## 11. Continuous Version Management

### Ongoing Workflow

1. **Making Changes**:
   - Use conventional commits: `feat:`, `fix:`, `BREAKING CHANGE:`
   - Push to `main` or `staging`

2. **Automatic Bumping**:
   - `versioning-enforce.yaml` runs commitizen
   - Version updates in `_version.py`
   - CHANGELOG updated automatically
   - Tag created and pushed

3. **Release**:
   - Tag push triggers `release.yaml`
   - Binaries built for all platforms
   - GitHub release created with changelog

4. **Verification**:
   - Check version command: `metabob-cli version`
   - Verify tag matches `_version.py`
   - Confirm CHANGELOG entry exists

---

## 12. Summary

### Files Discovered: 7 total

**Version Definition** (2):
- `src/metabob_cli/_version.py` → 1.9.0 ⚠️
- `pyproject.toml` (build config) → dynamic from _version.py

**Version Management** (1):
- `pyproject.toml` → commitizen config with version 1.10.0 ⚠️

**CI/CD** (3):
- `.github/workflows/versioning-enforce.yaml` → auto-bump with commitizen
- `.github/workflows/release.yaml` → reads _version.py, creates releases
- `.github/workflows/platform-compatibility.yaml` → may have version refs

**Documentation** (2):
- `CHANGELOG.md` → v1.9.0 latest entry
- `README.md` → generic "latest version" reference

**Tests** (1):
- `tests/unit/test_version_command.py` → runtime version validation

### Critical Issues

1. **Version Mismatch**: _version.py (1.9.0) ≠ commitizen (1.10.0)
2. **Invalid Config**: commitizen tries to update non-existent `pyproject.toml:version`
3. **CHANGELOG Missing**: No v1.10.0 entry in CHANGELOG.md

### Next Steps

1. Update `_version.py` to 1.10.0
2. Fix commitizen `version_files` config
3. Add v1.10.0 entry to CHANGELOG.md
4. Create and push v1.10.0 tag
5. Test version bump workflow

---

**Report Generated**: 2026-02-19  
**Discovery Complete**: ✅
