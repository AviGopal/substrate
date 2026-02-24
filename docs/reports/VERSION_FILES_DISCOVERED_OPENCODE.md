# Version Files Discovery Report - metabob-opencode

**Repository**: repos/metabob-opencode  
**Date**: 2026-02-19  
**Discovered by**: Version Discovery Activity

## Executive Summary

**Monorepo Type:** Node.js/TypeScript with Bun workspaces  
**Package Manager:** Bun 1.3.6  
**Build System:** Turbo  
**Version Management:** Manual (no commitizen/standard-version detected)  
**Total Packages:** 19 packages across workspaces  

**Current Version Status:**
- **Main Package (opencode):** 1.0.64 ✓
- **Majority of packages:** 1.0.61 (15 packages) ⚠️
- **Plugin packages:** 0.0.1 (2 packages) ⚠️
- **Slack bot:** 1.0.0 ⚠️
- **Python SDK:** 0.1.0 ⚠️

---

## 1. Version Definition Files

### 1.1 Node.js Package Files (19 files)

| Package Path | Version | Type | Status |
|-------------|---------|------|--------|
| ./package.json | (no version) | Root workspace | ⚠️ Missing version |
| ./github/package.json | (no version) | Workspace | ⚠️ Missing version |
| ./packages/console/app/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/console/core/package.json | 1.0.61 | Workspace (private) | ⚠️ Out of sync |
| ./packages/console/function/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/console/mail/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/console/resource/package.json | (no version) | Workspace | ⚠️ Missing version |
| ./packages/desktop/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/function/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/opencode/package.json | **1.0.64** | Main package | ✓ Reference version |
| ./packages/plugin-activities/package.json | 0.0.1 | Plugin | ⚠️ Out of sync |
| ./packages/plugin-metabob/package.json | 0.0.1 | Plugin | ⚠️ Out of sync |
| ./packages/plugin/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/script/package.json | (no version) | Workspace | ⚠️ Missing version |
| ./packages/sdk/js/package.json | 1.0.61 | SDK | ⚠️ Out of sync |
| ./packages/slack/package.json | 1.0.0 | Slack bot | ⚠️ Out of sync |
| ./packages/ui/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./packages/web/package.json | 1.0.61 | Workspace | ⚠️ Out of sync |
| ./sdks/vscode/package.json | 1.0.61 | VSCode extension | ⚠️ Out of sync |

### 1.2 Python Package Files (1 file)

| Package Path | Version | Status |
|-------------|---------|--------|
| ./packages/sdk/python/pyproject.toml | 0.1.0 | ⚠️ Out of sync |

### 1.3 Generic Version Files

❌ No VERSION, .version, or version.txt files found

---

## 2. Version Management Tools

### 2.1 Version Management Detection

❌ **No automated version management tool detected**
- No commitizen configuration found
- No standard-version configuration found
- No semantic-release configuration found
- No lerna.json found (uses Turbo instead)

### 2.2 Version-Related Scripts (5 files)

| Script | Purpose |
|--------|---------|
| ./packages/opencode/script/migrate-template-versions.ts | Template version migration |
| ./packages/opencode/src/session/template-version.ts | Template versioning logic |
| ./packages/opencode/test/session/message-conversion.test.ts | Version conversion tests |
| ./packages/opencode/test/session/template-library-version-bug.test.ts | Version bug tests |
| ./packages/opencode/test/session/template-version.test.ts | Version tests |

**Note:** These scripts handle *template* versioning, not package versioning.

### 2.3 Monorepo Configuration

**Workspace Manager:** Bun workspaces  
**Build System:** Turbo (turbo.json)  
**Workspace Packages:**
```json
{
  "packages": [
    "packages/*",
    "packages/console/*",
    "packages/sdk/js",
    "packages/slack"
  ]
}
```

---

## 3. CI/CD References

### 3.1 GitHub Actions Workflows (15 workflows)

| Workflow | Version References |
|----------|-------------------|
| .github/workflows/auto-label-tui.yml | Pattern matching: /[v]?1\.0\./i |
| .github/workflows/build-dev.yml | Checks opencode --version, uses Go 1.24.0 |
| .github/workflows/publish.yml | **Main release workflow**, accepts version override input |
| .github/workflows/snapshot.yml | Uses Go 1.24.0 |
| .github/workflows/sync-zed-extension.yml | Gets version from git tags |
| Other workflows | No direct version references |

**Key Workflow: publish.yml**
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

### 3.2 Docker Files (7 Dockerfiles)

| Dockerfile | Version References |
|-----------|-------------------|
| ./Dockerfile.slack | None detected |
| ./packages/opencode/docker/devbob-acp/Dockerfile | None detected |
| ./packages/slack/Dockerfile | None detected |
| ./packages/slack/Dockerfile.standalone | None detected |
| ./packages/slack/Dockerfile.prod | None detected |
| ./packages/slack/Dockerfile.devbob | Health check: opencode --version |
| ./packages/slack/Dockerfile.from-devbob | Health check: opencode --version |

### 3.3 Helm Charts

❌ No Helm Chart.yaml files found in repos/metabob-opencode

---

## 4. Documentation Files

### 4.1 Documentation with Version References

| File | Version Mentions |
|------|-----------------|
| ./README.md | Installation instructions, mentions "0.1.x" as old version to remove |
| ./packages/opencode/README.md | (not checked in detail) |
| ./packages/opencode/CHANGELOG.md | Tracks changes, currently at [Unreleased] |

### 4.2 Key Documentation Files

```
./github/README.md
./packages/console/app/README.md
./packages/desktop/README.md
./packages/opencode/templates/README.md
./packages/opencode/docs/README.md
./packages/opencode/CHANGELOG.md ← Primary changelog
./packages/opencode/README.md
./packages/opencode/docker/devbob-acp/README.md
./packages/opencode/examples/activity-composition/README.md
./packages/opencode/src/acp/README.md
```

---

## 5. Version Management Strategy

### 5.1 Current Strategy: Manual Versioning

**Evidence:**
1. ❌ No commitizen/standard-version/semantic-release configuration
2. ✓ Manual workflow dispatch in .github/workflows/publish.yml
3. ✓ Accepts bump type (major/minor/patch) or version override
4. ⚠️ No centralized version synchronization mechanism
5. ⚠️ Packages have drifted to different versions (1.0.61 vs 1.0.64)

### 5.2 Detected Version Management Issues

1. **Version Drift**: Main package at 1.0.64, most packages at 1.0.61
2. **Missing Versions**: 3 packages have no version field
3. **Plugin Inconsistency**: Plugin packages at 0.0.1 (likely intentional?)
4. **Slack Bot**: Separate version (1.0.0)
5. **Python SDK**: Independent versioning (0.1.0)
6. **No Automated Sync**: Changes to main package version don't propagate

### 5.3 Recommended Strategy

**Option A: Unified Versioning (Recommended)**
- All packages share the same version as main package
- Simplifies release process
- Use bun or custom script to update all package.json files
- Update publish workflow to synchronize versions

**Option B: Independent Versioning**
- Each package maintains separate version
- Requires version management tool (commitizen, changesets)
- More complex but allows independent releases

**Option C: Hybrid**
- Core packages share main version (1.0.64)
- Plugins remain at 0.0.x (pre-release)
- SDKs maintain independent versions
- Slack bot tracks separately

---

## 6. Version Synchronization Requirements

### 6.1 Files to Synchronize (Option A: Unified)

**Target Version:** 1.0.64 (or next version)

#### Node.js Packages (15 files to update)
```
packages/console/app/package.json         1.0.61 → 1.0.64
packages/console/core/package.json        1.0.61 → 1.0.64
packages/console/function/package.json    1.0.61 → 1.0.64
packages/console/mail/package.json        1.0.61 → 1.0.64
packages/desktop/package.json             1.0.61 → 1.0.64
packages/function/package.json            1.0.61 → 1.0.64
packages/plugin/package.json              1.0.61 → 1.0.64
packages/sdk/js/package.json              1.0.61 → 1.0.64
packages/ui/package.json                  1.0.61 → 1.0.64
packages/web/package.json                 1.0.61 → 1.0.64
sdks/vscode/package.json                  1.0.61 → 1.0.64
```

#### Packages Needing Version Addition (4 files)
```
package.json                              (add "version": "1.0.64")
github/package.json                       (add "version": "1.0.64")
packages/console/resource/package.json    (add "version": "1.0.64")
packages/script/package.json              (add "version": "1.0.64")
```

#### Decision Required (4 packages)
```
packages/plugin-activities/package.json   0.0.1 → 1.0.64 or keep?
packages/plugin-metabob/package.json      0.0.1 → 1.0.64 or keep?
packages/slack/package.json               1.0.0 → 1.0.64 or keep?
packages/sdk/python/pyproject.toml        0.1.0 → ?.?.? (independent?)
```

### 6.2 CI/CD Updates Needed

1. ✓ .github/workflows/publish.yml - Already handles version bumping
2. ⚠️ Add version synchronization step to publish workflow
3. ⚠️ Update Docker health checks if needed
4. ⚠️ Update any hardcoded version references in workflows

### 6.3 Documentation Updates Needed

1. ./packages/opencode/CHANGELOG.md - Update with new version entry
2. ./README.md - Update if version referenced
3. Any installation documentation

---

## 7. Automation Recommendations

### 7.1 Immediate Actions (Manual)

1. Decide on versioning strategy (unified vs independent)
2. Update all package.json files to target version
3. Verify no hardcoded version strings in source code
4. Update CHANGELOG.md
5. Test build and publish workflow

### 7.2 Long-term Improvements

1. **Add version sync script:**
   ```typescript
   // scripts/sync-versions.ts
   // Read main package version
   // Update all workspace package.json files
   // Generate commit with version changes
   ```

2. **Update publish workflow:**
   ```yaml
   - name: Sync versions
     run: bun run scripts/sync-versions.ts --version $VERSION
   ```

3. **Add pre-commit hook:**
   - Verify all packages have consistent versions
   - Prevent commits with version drift

4. **Consider Changesets:**
   - Industry standard for monorepo versioning
   - Handles changelogs automatically
   - Supports independent or unified versioning

---

## 8. Next Steps

1. ✅ **Decision:** Choose versioning strategy (unified recommended)
2. 📝 **Identify target version:** 1.0.64 or bump to 1.0.65/1.1.0/2.0.0?
3. 🔄 **Create sync script:** Automate version updates across packages
4. 🧪 **Test workflow:** Verify publish.yml works with synchronized versions
5. 📚 **Update documentation:** Reflect new versioning strategy
6. 🚀 **Execute synchronization:** Run script and commit changes
7. ✅ **Verify:** Test build, typecheck, and publish workflows

---

## Appendix A: Version Audit Table

| Package | Current | Target | Action |
|---------|---------|--------|--------|
| packages/opencode | 1.0.64 | 1.0.64 | ✓ No change (reference) |
| packages/console/app | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/console/core | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/console/function | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/console/mail | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/console/resource | (none) | 1.0.64 | Add version |
| packages/desktop | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/function | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/plugin | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/plugin-activities | 0.0.1 | TBD | Decision needed |
| packages/plugin-metabob | 0.0.1 | TBD | Decision needed |
| packages/script | (none) | 1.0.64 | Add version |
| packages/sdk/js | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/slack | 1.0.0 | TBD | Decision needed |
| packages/ui | 1.0.61 | 1.0.64 | Update +0.03 |
| packages/web | 1.0.61 | 1.0.64 | Update +0.03 |
| sdks/vscode | 1.0.61 | 1.0.64 | Update +0.03 |
| github | (none) | 1.0.64 | Add version |
| package.json (root) | (none) | 1.0.64 | Add version |
| packages/sdk/python | 0.1.0 | TBD | Independent? |

**Summary:**
- ✓ Reference: 1 package
- 🔄 Update needed: 15 packages
- ➕ Add version: 4 packages
- ❓ Decision needed: 4 packages
- **Total:** 24 packages

---

## Appendix B: Command Reference

### Find all package.json files
```bash
find . -name "package.json" ! -path "*/node_modules/*" ! -path "*/dist/*"
```

### Extract all versions
```bash
grep -r "\"version\":" packages/*/package.json | grep -v node_modules
```

### Bulk update versions (example)
```bash
for file in $(find packages -name "package.json" ! -path "*/node_modules/*"); do
  # Use sed or jq to update version field
  jq '.version = "1.0.64"' "$file" > tmp && mv tmp "$file"
done
```

### Verify version consistency
```bash
grep -h "\"version\":" packages/*/package.json sdks/*/package.json | sort | uniq -c
```

---

**Report Generated:** 2026-02-19  
**Repository:** repos/metabob-opencode  
**Branch:** (current branch)  
**Scope:** Version discovery and synchronization analysis
