# Version Consistency Audit - metabob-opencode

**Repository**: repos/metabob-opencode  
**Audit Date**: 2026-02-19  
**Auditor**: Version Consistency Activity

---

## Executive Summary

**Status**: ❌ **FAIL - Significant Inconsistencies Detected**

### Quick Stats
- **Canonical Version**: 1.0.64 (from main package)
- **Total Files Checked**: 20 package files
- **Consistent Files**: 1 (5%)
- **Inconsistent Files**: 15 (75%)
- **Missing Version Field**: 4 (20%)
- **Unique Versions Found**: 5 different versions

### Critical Issues
1. **Version Drift**: 15 packages lag behind main package by 3 patch versions
2. **Missing Versions**: 4 packages completely lack version field
3. **Plugin Divergence**: 2 plugin packages at pre-release (0.0.1)
4. **Bot Divergence**: Slack bot at separate version (1.0.0)
5. **SDK Independence**: Python SDK at independent version (0.1.0)
6. **No Automation**: No version synchronization mechanism detected

---

## Detailed Version Analysis

### 1. Version Distribution

| Version | Count | Packages | Status |
|---------|-------|----------|--------|
| 1.0.64 | 1 | packages/opencode | ✅ Canonical (reference) |
| 1.0.61 | 11 | console/*, desktop, function, plugin, sdk/js, ui, web, vscode | ❌ Out of date (-0.03) |
| 1.0.0 | 1 | slack | ❌ Major divergence |
| 0.0.1 | 2 | plugin-activities, plugin-metabob | ⚠️ Pre-release |
| 0.1.0 | 1 | sdk/python | ⚠️ Independent versioning? |
| (none) | 4 | root, github, console/resource, script | ❌ Missing version |

---

## 2. File-by-File Audit

### 2.1 Consistent Files (✅ 1 file)

| File Path | Version | Status |
|-----------|---------|--------|
| packages/opencode/package.json | 1.0.64 | ✅ CANONICAL VERSION |

---

### 2.2 Inconsistent Files (❌ 15 files)

#### Group A: Core Packages (-0.03 behind) - 11 files
**Expected**: 1.0.64  
**Actual**: 1.0.61

| File Path | Current | Expected | Diff |
|-----------|---------|----------|------|
| packages/console/app/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/console/core/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/console/function/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/console/mail/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/desktop/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/function/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/plugin/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/sdk/js/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/ui/package.json | 1.0.61 | 1.0.64 | -0.03 |
| packages/web/package.json | 1.0.61 | 1.0.64 | -0.03 |
| sdks/vscode/package.json | 1.0.61 | 1.0.64 | -0.03 |

**Impact**: These packages are 3 patch versions behind. May contain outdated dependencies or mismatched peer dependencies.

---

#### Group B: Plugins (Pre-release) - 2 files
**Expected**: 1.0.64 OR keep at 0.0.1?  
**Actual**: 0.0.1

| File Path | Current | Expected | Decision Needed |
|-----------|---------|----------|-----------------|
| packages/plugin-activities/package.json | 0.0.1 | 1.0.64 or keep? | ⚠️ Pre-release status unclear |
| packages/plugin-metabob/package.json | 0.0.1 | 1.0.64 or keep? | ⚠️ Pre-release status unclear |

**Impact**: Unclear if these are intentionally in pre-release or forgotten during version bumps.

**Recommendation**: 
- If stable and released → update to 1.0.64
- If experimental/beta → keep at 0.0.x and document in README
- Consider semantic versioning: 0.0.x = unstable, 1.0.x = stable

---

#### Group C: Slack Bot (Independent?) - 1 file
**Expected**: 1.0.64 OR independent versioning?  
**Actual**: 1.0.0

| File Path | Current | Expected | Decision Needed |
|-----------|---------|----------|-----------------|
| packages/slack/package.json | 1.0.0 | 1.0.64 or keep? | ⚠️ Independent version strategy? |

**Impact**: Major version divergence. Unclear if intentional.

**Recommendation**:
- If deployed independently → document separate versioning strategy
- If part of unified release → update to 1.0.64

---

#### Group D: Python SDK (Independent) - 1 file
**Expected**: Independent versioning (likely intentional)  
**Actual**: 0.1.0

| File Path | Current | Expected | Decision Needed |
|-----------|---------|----------|-----------------|
| packages/sdk/python/pyproject.toml | 0.1.0 | Independent? | ⚠️ Likely intentional, needs confirmation |

**Impact**: Python SDK appears to follow separate release cycle.

**Recommendation**:
- Confirm this is intentional (Python packages often version independently)
- Document versioning strategy in packages/sdk/python/README.md
- Consider if it should track Node packages or remain independent

---

### 2.3 Missing Version Field (❌ 4 files)

| File Path | Current | Expected | Issue |
|-----------|---------|----------|-------|
| package.json (root) | (none) | 1.0.64 | ❌ Root workspace missing version |
| github/package.json | (none) | 1.0.64 | ❌ Missing version field |
| packages/console/resource/package.json | (none) | 1.0.64 | ❌ Missing version field |
| packages/script/package.json | (none) | 1.0.64 | ❌ Missing version field |

**Impact**: These packages cannot be independently versioned or published. May cause issues with tooling that expects version field.

**Recommendation**: Add `"version": "1.0.64"` to all package.json files for consistency, even if not published.

---

### 2.4 Special Cases (⚠️ 2 files)

| File Path | Current | Status | Notes |
|-----------|---------|--------|-------|
| .opencode/package.json | (none) | ℹ️ Config | Internal config, version not required |
| packages/opencode/.opencode/package.json | (none) | ℹ️ Config | Internal config, version not required |

These appear to be internal configuration packages and likely don't need versions.

---

## 3. Version Management Configuration Audit

### 3.1 Automated Versioning Tools

**Commitizen**: ❌ Not found  
**Standard Version**: ❌ Not found  
**Semantic Release**: ❌ Not found  
**Lerna**: ❌ Not found (uses Turbo)  
**Changesets**: ❌ Not found

**Result**: No automated version management tool detected.

---

### 3.2 Manual Versioning Process

**Publish Workflow**: `.github/workflows/publish.yml`

```yaml
inputs:
  bump:
    description: "Bump major, minor, or patch"
    type: choice
    options: [major, minor, patch]
  version:
    description: "Override version (optional)"
    type: string
```

**Publish Script**: `script/publish.ts`
- Fetches latest version from npm registry
- Accepts `OPENCODE_BUMP` or `OPENCODE_VERSION` env vars
- No automatic synchronization of all package.json files detected

**Issues**:
1. No step to sync versions across all packages
2. Each package must be manually updated
3. Easy to forget packages → leads to drift (current situation)

---

### 3.3 Version Files Configuration

**Commitizen `version_files`**: ❌ Not configured (no commitizen)

**Missing**:
- No centralized version_files list
- No automation to update all package.json files
- No pre-commit hooks to enforce consistency

---

## 4. CI/CD Version References

### 4.1 GitHub Actions Workflows

**Checked Files**:
- `.github/workflows/publish.yml` ✅ (uses dynamic version)
- `.github/workflows/build-dev.yml` ✅ (no hardcoded versions)
- `.github/workflows/auto-label-tui.yml` ✅ (uses pattern `/[v]?1\.0\./i`)

**Result**: No hardcoded version numbers found in workflows. Good practice.

---

### 4.2 Dockerfiles

**Checked Files**:
- `packages/slack/Dockerfile*` (7 files)

**Version References**:
- Health checks use `opencode --version` (dynamic, ✅ good)
- No hardcoded version numbers found

**Result**: Docker configs are clean. Versions are read dynamically from installed package.

---

### 4.3 Documentation

**CHANGELOG.md**: Checked  
- Currently at `[Unreleased]`
- No hardcoded version references found

**README.md**: Checked  
- No hardcoded 1.0.61 or 1.0.64 references found
- Mentions removing old "0.1.x" versions (already outdated, not an issue)

**Result**: Documentation is clean. No stale version references.

---

## 5. Impact Analysis

### 5.1 Risk Assessment

**Severity**: 🔴 HIGH

#### Immediate Risks:
1. **Dependency Confusion**: Packages at 1.0.61 may depend on features from 1.0.64
2. **User Confusion**: `npm ls opencode-ai` shows multiple versions
3. **Publishing Issues**: Inconsistent versions may cause publish failures
4. **Peer Dependency Conflicts**: Mismatched versions can cause npm/pnpm/bun resolution issues

#### Long-term Risks:
1. **Maintenance Burden**: Manual version updates across 20 packages error-prone
2. **Drift Will Worsen**: Without automation, drift will continue growing
3. **Release Complexity**: Each release requires updating 15+ files manually
4. **Testing Gaps**: Inconsistent versions make testing matrix unclear

---

### 5.2 Business Impact

**User-facing**: ⚠️ MEDIUM
- Users may install mismatched package versions
- VSCode extension (1.0.61) doesn't match CLI (1.0.64)
- Slack bot (1.0.0) significantly diverged

**Developer-facing**: 🔴 HIGH
- Confusing to contributors
- Unclear which version is "current"
- Manual version updates slow down releases

**CI/CD**: ⚠️ MEDIUM
- Current publish workflow only updates main package
- Other packages left behind
- No validation step to catch drift

---

## 6. Root Cause Analysis

### Why Did This Happen?

1. **No Synchronization Step**: `script/publish.ts` doesn't update all packages
2. **Manual Process**: Developer must remember to update 15+ files
3. **No Validation**: No pre-commit or CI check for version consistency
4. **Historical Drift**: Packages were updated independently over time
5. **Monorepo Tooling Gap**: Turbo doesn't provide version management (unlike Lerna/Changesets)

### When Did Drift Occur?

Based on version numbers:
- Main package: 1.0.64 (3 releases after 1.0.61)
- Most packages: 1.0.61 (last synchronized release)
- Drift occurred across: 1.0.62, 1.0.63, 1.0.64 releases

**Estimated**: Last full synchronization was at version 1.0.61, approximately 3 releases ago.

---

## 7. Recommendations

### 7.1 Immediate Actions (Required)

#### Priority 1: Synchronize to 1.0.64
**Action**: Update all core packages to match canonical version

**Files to Update** (11 files):
```bash
packages/console/app/package.json         → 1.0.64
packages/console/core/package.json        → 1.0.64
packages/console/function/package.json    → 1.0.64
packages/console/mail/package.json        → 1.0.64
packages/desktop/package.json             → 1.0.64
packages/function/package.json            → 1.0.64
packages/plugin/package.json              → 1.0.64
packages/sdk/js/package.json              → 1.0.64
packages/ui/package.json                  → 1.0.64
packages/web/package.json                 → 1.0.64
sdks/vscode/package.json                  → 1.0.64
```

**Command**:
```bash
# Use jq or sed to update all files
for file in packages/console/app/package.json packages/console/core/package.json packages/console/function/package.json packages/console/mail/package.json packages/desktop/package.json packages/function/package.json packages/plugin/package.json packages/sdk/js/package.json packages/ui/package.json packages/web/package.json sdks/vscode/package.json; do
  jq '.version = "1.0.64"' "repos/metabob-opencode/$file" > tmp.json && mv tmp.json "repos/metabob-opencode/$file"
done
```

---

#### Priority 2: Add Missing Versions
**Action**: Add version field to 4 packages

**Files to Update**:
```json
// package.json (root)
{
  "version": "1.0.64",
  "private": true,
  ...
}

// github/package.json
{
  "version": "1.0.64",
  ...
}

// packages/console/resource/package.json
{
  "version": "1.0.64",
  ...
}

// packages/script/package.json
{
  "version": "1.0.64",
  ...
}
```

---

#### Priority 3: Decide on Special Cases
**Action**: Make explicit decisions for 4 packages

**Decision Matrix**:

| Package | Current | Options | Recommendation |
|---------|---------|---------|----------------|
| plugin-activities | 0.0.1 | (A) → 1.0.64<br>(B) Keep 0.0.1 | If stable: A<br>If experimental: B + document |
| plugin-metabob | 0.0.1 | (A) → 1.0.64<br>(B) Keep 0.0.1 | If stable: A<br>If experimental: B + document |
| slack | 1.0.0 | (A) → 1.0.64<br>(B) Independent versioning | If deployed with main: A<br>If separate service: B + document |
| sdk/python | 0.1.0 | (A) → 1.0.64<br>(B) Independent versioning | Likely B (Python packages often independent) + document |

**Required**: Document decisions in each package's README.md

---

### 7.2 Short-term Improvements (Next Sprint)

#### 1. Create Version Sync Script
**File**: `scripts/sync-versions.ts`

```typescript
#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs"
import { glob } from "glob"

// Read main package version
const main = JSON.parse(readFileSync("packages/opencode/package.json", "utf8"))
const version = process.env.VERSION || main.version

// Find all package.json files
const packages = glob.sync("**/package.json", {
  ignore: ["**/node_modules/**", "**/.opencode/**", "**/dist/**"]
})

// Update version in each package (skip private/internal ones)
for (const pkg of packages) {
  const json = JSON.parse(readFileSync(pkg, "utf8"))
  
  // Skip if explicitly independent
  if (json.independentVersion) continue
  
  // Update version
  json.version = version
  writeFileSync(pkg, JSON.stringify(json, null, 2) + "\n")
  console.log(`Updated ${pkg} → ${version}`)
}
```

---

#### 2. Update Publish Workflow
**File**: `.github/workflows/publish.yml`

Add step before publish:
```yaml
- name: Sync versions across monorepo
  run: bun run scripts/sync-versions.ts
  env:
    VERSION: ${{ steps.version.outputs.new_version }}

- name: Commit version changes
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add -A
    git commit -m "chore: sync versions to ${{ steps.version.outputs.new_version }}" || true
```

---

#### 3. Add Pre-commit Hook
**File**: `.husky/pre-commit` (if using husky)

```bash
#!/bin/sh
# Verify version consistency before commit

MAIN_VERSION=$(jq -r '.version' packages/opencode/package.json)
INCONSISTENT=$(find packages sdks -name "package.json" ! -path "*/node_modules/*" ! -path "*/.opencode/*" -exec jq -r --arg v "$MAIN_VERSION" 'select(.version != null and .version != $v and .independentVersion != true) | input_filename + ": " + .version' {} \;)

if [ -n "$INCONSISTENT" ]; then
  echo "❌ Version inconsistency detected:"
  echo "$INCONSISTENT"
  echo ""
  echo "Run: bun run scripts/sync-versions.ts"
  exit 1
fi
```

---

### 7.3 Long-term Solutions (Future)

#### Option A: Adopt Changesets (Recommended)
**Pros**:
- Industry standard for monorepo versioning
- Handles changelogs automatically
- Supports both unified and independent versioning
- Works with Bun/Turbo

**Implementation**:
```bash
bun add -D @changesets/cli
bunx changeset init
```

**Workflow**:
1. Developer runs `bunx changeset` to document changes
2. CI generates version bumps from changesets
3. Publish workflow applies versions and publishes
4. Changelogs updated automatically

---

#### Option B: Custom Version Manager
**Pros**:
- Full control over versioning logic
- Can enforce custom rules (plugins stay 0.0.x, etc.)

**Cons**:
- Maintenance burden
- Reinventing the wheel

**Only consider if**: Changesets doesn't meet specific requirements

---

## 8. Validation Checklist

After implementing fixes, verify:

- [ ] All core packages at 1.0.64
- [ ] All package.json files have version field (except .opencode/*)
- [ ] Decisions documented for plugin/slack/python packages
- [ ] `bun install` succeeds without warnings
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Publish workflow dry-run succeeds
- [ ] Version sync script added to repo
- [ ] Pre-commit hook (optional) added
- [ ] CHANGELOG.md updated with version changes

---

## 9. Next Steps

### Immediate (Today)
1. ✅ Review this audit report
2. ⬜ Make decisions on plugin/slack/python versioning
3. ⬜ Execute version synchronization (Priority 1 + 2)
4. ⬜ Test build and typecheck
5. ⬜ Commit changes with clear message

### Short-term (This Week)
1. ⬜ Create `scripts/sync-versions.ts`
2. ⬜ Update `.github/workflows/publish.yml`
3. ⬜ Add pre-commit hook (optional but recommended)
4. ⬜ Document versioning strategy in root README.md

### Long-term (Next Sprint)
1. ⬜ Evaluate Changesets for monorepo versioning
2. ⬜ Set up automated changelog generation
3. ⬜ Create versioning contribution guide
4. ⬜ Add CI check for version consistency

---

## Appendix A: Command Reference

### Check Current Versions
```bash
cd repos/metabob-opencode
find . -name "package.json" ! -path "*/node_modules/*" ! -path "*/.opencode/*" -exec sh -c 'echo "$1: $(jq -r .version $1 2>/dev/null || echo "NO VERSION")' _ {} \;
```

### Verify Version Consistency
```bash
cd repos/metabob-opencode
MAIN=$(jq -r .version packages/opencode/package.json)
echo "Main package: $MAIN"
echo ""
echo "Inconsistent packages:"
find . -name "package.json" ! -path "*/node_modules/*" ! -path "*/.opencode/*" -exec jq -r --arg main "$MAIN" 'select(.version != null and .version != $main) | input_filename + ": " + .version' {} \;
```

### Bulk Update (Use with caution)
```bash
# Dry run
for file in packages/console/app/package.json packages/desktop/package.json; do
  echo "Would update $file"
  jq --arg ver "1.0.64" '.version = $ver' "$file"
done

# Actual update (after verification)
for file in packages/console/app/package.json packages/desktop/package.json; do
  jq --arg ver "1.0.64" '.version = $ver' "$file" > tmp.json && mv tmp.json "$file"
done
```

---

## Appendix B: Version History Timeline

**Reconstructed from current state**:

```
v1.0.61 ───┐                                    [LAST SYNCHRONIZED]
           ├─→ 11 packages remain here         
           │
v1.0.62 ───┤                                    [DRIFT BEGINS]
           ├─→ packages/opencode updated       
           │
v1.0.63 ───┤                                    [DRIFT CONTINUES]
           ├─→ packages/opencode updated       
           │
v1.0.64 ───┘                                    [CURRENT STATE]
            └─→ packages/opencode only          
                                                 
Result: 3-version drift between main and other packages
```

**Root Cause**: No synchronization step in release workflow

---

**Audit Completed**: 2026-02-19  
**Auditor**: OpenCode Version Consistency Activity  
**Status**: ❌ FAIL - 15 inconsistencies found  
**Action Required**: YES - Immediate synchronization needed
