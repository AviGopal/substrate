# DevBob Rebranding Plan

**Date**: February 17, 2026  
**Goal**: Rebrand metabob-opencode from "opencode" to "devbob" and remove all sst/opencode upstream references  
**Scope**: Comprehensive rebranding across 19 packages, binaries, documentation, and workflows

---

## Executive Summary

**Current State**:
- Repository: `avigopal/opencode` (forked from `sst/opencode`)
- Package names: `opencode`, `@opencode-ai/*`
- Binary: `opencode`
- 207+ references to upstream `sst/opencode`

**Target State**:
- Repository: `metabobproject/devbob`
- Package names: `devbob`, `@metabob/*`
- Binary: `devbob`
- All upstream references removed/updated

---

## Phase 1: Repository Structure (Week 1)

### 1.1 Create Rebranding Branch
```bash
cd repos/metabob-opencode
git checkout -b rebrand/opencode-to-devbob
```

### 1.2 Rename Primary Directory
```bash
# After all changes, rename the repository
mv repos/metabob-opencode repos/metabob-devbob
```

### 1.3 Update Root Configuration Files

**Files to update**:
- `package.json`: Change name to "devbob", update repository URL
- `.github/workflows/*.yml`: Update all workflow references
- `README.md`: Complete rewrite for devbob branding
- `CONTRIBUTING.md`: Update references

**package.json changes**:
```json
{
  "name": "devbob",
  "description": "AI-powered development agent by Metabob",
  "repository": {
    "type": "git",
    "url": "https://github.com/metabobproject/devbob"
  },
  "dependencies": {
    "@metabob/script": "workspace:*",
    "@metabob/sdk": "workspace:*"
  }
}
```

---

## Phase 2: Package Rebranding (Week 1-2)

### 2.1 Core Package: packages/opencode → packages/devbob

**Directory rename**:
```bash
git mv packages/opencode packages/devbob
```

**package.json updates** (`packages/devbob/package.json`):
```json
{
  "name": "devbob",
  "version": "1.0.62",
  "bin": {
    "devbob": "./bin/devbob"
  }
}
```

**Binary renames**:
```bash
cd packages/devbob/bin/
git mv opencode devbob
git mv opencode.cmd devbob.cmd
```

**Update binary scripts**:
- `bin/devbob`: Update binary name references from `opencode` to `devbob`
- `bin/devbob.cmd`: Windows script update

### 2.2 Workspace Packages: @opencode-ai/* → @metabob/*

**19 packages to rename**:

| Current | New |
|---------|-----|
| `@opencode-ai/console-app` | `@metabob/console-app` |
| `@opencode-ai/console-core` | `@metabob/console-core` |
| `@opencode-ai/console-function` | `@metabob/console-function` |
| `@opencode-ai/console-mail` | `@metabob/console-mail` |
| `@opencode-ai/console-resource` | `@metabob/console-resource` |
| `@opencode-ai/desktop` | `@metabob/desktop` |
| `@opencode-ai/function` | `@metabob/function` |
| `@opencode-ai/plugin` | `@metabob/plugin` |
| `@opencode-ai/plugin-activities` | `@metabob/plugin-activities` |
| `@opencode-ai/plugin-metabob` | `@metabob/plugin-metabob` |
| `@opencode-ai/script` | `@metabob/script` |
| `@opencode-ai/sdk` | `@metabob/sdk` |
| `@opencode-ai/slack` | `@metabob/slack` |
| `@opencode-ai/ui` | `@metabob/ui` |
| `@opencode-ai/web` | `@metabob/web` |
| VSCode: `opencode` | `devbob` |

**Automated script** (create `scripts/rebrand-packages.sh`):
```bash
#!/bin/bash
# Rename all @opencode-ai to @metabob in package.json files

find packages -name "package.json" -type f | while read file; do
  sed -i 's/@opencode-ai\//@metabob\//g' "$file"
  sed -i 's/"opencode"/"devbob"/g' "$file"
done

# Update imports in TypeScript files
find packages -name "*.ts" -type f | while read file; do
  sed -i 's/@opencode-ai\//@metabob\//g' "$file"
done

echo "Package rebranding complete"
```

---

## Phase 3: Code and Configuration Updates (Week 2)

### 3.1 TypeScript Imports

**Update all imports**:
```bash
# Replace in all .ts, .tsx files
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/@opencode-ai\//@metabob\//g' {} \;
```

### 3.2 Binary References

**Files containing binary name "opencode"**:
- `packages/devbob/bin/devbob` (update script logic)
- `packages/devbob/script/build.ts` (update build targets)
- `packages/devbob/script/publish.ts` (update publish logic)
- All workflow files (`.github/workflows/*.yml`)

**Search and replace**:
```bash
# Find all hardcoded "opencode" references
grep -r "opencode-linux\|opencode-darwin\|opencode-windows" packages/devbob/script/
```

Update to:
- `devbob-linux-{arch}`
- `devbob-darwin-{arch}`
- `devbob-windows-{arch}`

### 3.3 Configuration Files

**Update**:
- `packages/devbob/src/config/*.ts`: Update default configs
- `sst.config.ts`: Update SST configuration
- `turbo.json`: Update package references

---

## Phase 4: GitHub & CI/CD (Week 2-3)

### 4.1 GitHub Workflows

**Files to update**:
```
.github/workflows/
├── opencode.yml → devbob.yml (or rename workflow)
├── build-dev.yml
├── deploy.yml
├── publish-github-action.yml
├── publish-vscode.yml
└── *.yml (all workflows)
```

**Key changes**:
- Update `uses: sst/opencode/github@latest` → `uses: metabobproject/devbob/github@latest`
- Update binary names in build steps
- Update artifact names

### 4.2 GitHub Action

**Directory**: `github/` (the action itself)

**Files to update**:
- `github/action.yml`: Update name, description
- `github/README.md`: Rebrand documentation
- Update usage examples

**New usage**:
```yaml
- uses: metabobproject/devbob/github@latest
  env:
    DEVBOB_API_KEY: ${{ secrets.DEVBOB_API_KEY }}
```

### 4.3 VSCode Extension

**Directory**: `sdks/vscode/`

**Updates**:
- `package.json`: Name, displayName, publisher
- `README.md`: Extension documentation
- Icon/logo (if exists)
- Marketplace listing

**New package.json**:
```json
{
  "name": "devbob",
  "displayName": "DevBob",
  "description": "AI development agent by Metabob",
  "publisher": "metabob",
  "repository": "https://github.com/metabobproject/devbob"
}
```

---

## Phase 5: Documentation (Week 3)

### 5.1 Primary Documentation

**Files to update**:
- `README.md` (root)
- `packages/devbob/README.md`
- `github/README.md`
- `packages/devbob/docs/**/*.md`
- All CONTRIBUTING files

### 5.2 Upstream Attribution

**Add to README.md**:
```markdown
## Attribution

DevBob is based on [OpenCode](https://github.com/sst/opencode) by SST.
We've significantly extended and customized the codebase for Metabob's
AI-powered code quality platform.

### License

DevBob is licensed under MIT (inherited from OpenCode).
```

### 5.3 Archived Documentation

**Update .archive/ references**:
- Search: `grep -r "sst/opencode" .archive/`
- Consider: Leave as historical references OR update with notes

---

## Phase 6: Testing & Validation (Week 3-4)

### 6.1 Build Testing

**Test matrix**:
```bash
# Test TypeScript compilation
bun run typecheck

# Test builds
cd packages/devbob
bun run build

# Test binary execution
./dist/devbob-linux-x64 version
./dist/devbob-linux-x64 --help

# Test workspace dependencies
bun install
bun test
```

### 6.2 Integration Testing

**Test scenarios**:
1. CLI commands work with new name
2. GitHub Action works (test in separate repo)
3. VSCode extension builds
4. All package imports resolve
5. Workflows run successfully

### 6.3 Backward Compatibility

**Consider**:
- Symlink `opencode` → `devbob` for transition period?
- Environment variable support: `OPENCODE_*` → `DEVBOB_*` (with fallback)
- Configuration file migration

---

## Phase 7: Deployment (Week 4)

### 7.1 GitHub Repository

**Create new repository**:
```bash
# On GitHub
1. Create: metabobproject/devbob
2. Settings → Branches → Protection rules
3. Add team access
```

**Push rebranded code**:
```bash
git remote add devbob git@github.com:metabobproject/devbob.git
git push devbob rebrand/opencode-to-devbob:main
```

### 7.2 npm Publishing

**Register organization**:
1. Go to: https://www.npmjs.com/org/create
2. Create: `@metabob` organization
3. Invite team members

**Publish packages**:
```bash
# Set private: false in packages
# Add NPM_TOKEN to GitHub secrets
# Create .github/workflows/publish-npm.yml
```

### 7.3 Update Distribution

**Update**:
- VSCode Marketplace (new extension)
- GitHub Marketplace (new action)
- Documentation sites
- Docker Hub (if applicable)

---

## Automated Rebranding Scripts

### Script 1: Package Name Replacer

**File**: `scripts/rebrand-step1-packages.sh`

```bash
#!/bin/bash
set -e

echo "🔄 Rebranding packages: @opencode-ai → @metabob"

# Find and replace in package.json files
find . -name "package.json" -type f -not -path "*/node_modules/*" | while read file; do
  echo "  Updating: $file"
  sed -i.bak 's/@opencode-ai\//@metabob\//g' "$file"
  sed -i.bak 's/"opencode"/"devbob"/g' "$file"
  rm "$file.bak"
done

echo "✅ Package names updated"
```

### Script 2: Code Import Replacer

**File**: `scripts/rebrand-step2-imports.sh`

```bash
#!/bin/bash
set -e

echo "🔄 Rebranding imports in TypeScript files"

# Update imports
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" | while read file; do
  sed -i.bak 's/@opencode-ai\//@metabob\//g' "$file"
  sed -i.bak 's/from "opencode"/from "devbob"/g' "$file"
  rm "$file.bak"
done

echo "✅ Imports updated"
```

### Script 3: URL Replacer

**File**: `scripts/rebrand-step3-urls.sh`

```bash
#!/bin/bash
set -e

echo "🔄 Rebranding URLs: sst/opencode → metabobproject/devbob"

# Replace GitHub URLs
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
  sed -i.bak 's|github.com/sst/opencode|github.com/metabobproject/devbob|g' "$file"
  sed -i.bak 's|sst/opencode|metabobproject/devbob|g' "$file"
  rm "$file.bak"
done

echo "✅ URLs updated"
```

### Script 4: Binary Name Replacer

**File**: `scripts/rebrand-step4-binaries.sh`

```bash
#!/bin/bash
set -e

echo "🔄 Rebranding binary references"

# Update binary references in scripts
find packages/devbob/script -type f -name "*.ts" | while read file; do
  sed -i.bak 's/opencode-linux/devbob-linux/g' "$file"
  sed -i.bak 's/opencode-darwin/devbob-darwin/g' "$file"
  sed -i.bak 's/opencode-windows/devbob-windows/g' "$file"
  sed -i.bak 's/opencode\.exe/devbob.exe/g' "$file"
  rm "$file.bak"
done

echo "✅ Binary references updated"
```

### Master Script

**File**: `scripts/rebrand-all.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Starting DevBob rebranding process..."
echo ""

# Run all steps
./scripts/rebrand-step1-packages.sh
./scripts/rebrand-step2-imports.sh
./scripts/rebrand-step3-urls.sh
./scripts/rebrand-step4-binaries.sh

echo ""
echo "✅ Rebranding complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test builds: bun run typecheck && bun run build"
echo "3. Rename directory: mv repos/metabob-opencode repos/metabob-devbob"
echo "4. Rename binaries: cd packages/devbob/bin && git mv opencode devbob"
echo "5. Commit: git commit -am 'rebrand: opencode → devbob'"
```

---

## Risk Mitigation

### Risks

1. **Build breakage**: Extensive changes may break builds
2. **Dependency issues**: Workspace references may fail
3. **Import errors**: Circular dependencies or missing imports
4. **User confusion**: Existing users expect "opencode"

### Mitigation

1. **Test thoroughly**: Run full test suite after each phase
2. **Incremental commits**: Commit after each successful phase
3. **Rollback plan**: Keep backup branch
4. **Documentation**: Comprehensive migration guide for users
5. **Compatibility layer**: Temporary symlinks/aliases for transition

---

## Success Criteria

- ✅ All 19 packages renamed and publishing
- ✅ Binary builds successfully as `devbob`
- ✅ TypeScript compilation passes (0 errors)
- ✅ All tests pass
- ✅ GitHub workflows run successfully
- ✅ VSCode extension works
- ✅ No references to `sst/opencode` remaining
- ✅ Documentation complete and accurate

---

## Rollback Plan

If rebranding fails:

```bash
# Restore from backup
git checkout dev
git branch -D rebrand/opencode-to-devbob

# Or revert specific commits
git revert <commit-hash>
```

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Repository structure + packages | Branch created, packages renamed |
| 2 | Code updates + CI/CD | All code references updated, workflows working |
| 3 | Documentation + Testing | Docs complete, all tests passing |
| 4 | Deployment | New repo created, packages published |

**Total estimated time**: 3-4 weeks for complete rebranding

---

## Post-Rebranding Tasks

1. **Archive old repository**: Set avigopal/opencode to archived
2. **Update external references**: Update any external docs/links
3. **Announce**: Blog post, Twitter, etc.
4. **Monitor**: Watch for issues from users
5. **Support**: Answer questions about migration

---

## Notes

- This is a **major breaking change** for existing users
- Consider semantic versioning: Bump to v2.0.0
- Provide migration guide for users
- Consider maintaining `opencode` as deprecated alias initially

---

**Document Owner**: Session 2026-02-17  
**Status**: Planning  
**Last Updated**: February 17, 2026
