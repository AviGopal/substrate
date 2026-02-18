# DevBob Rebranding - Quick Reference

**Date**: February 17, 2026  
**Status**: Ready to Execute  
**Estimated Time**: 3-4 weeks for complete rebranding

---

## What We're Doing

Rebranding the forked OpenCode repository to DevBob:

| Aspect | From | To |
|--------|------|-----|
| **Repository** | `sst/opencode` | `metabobproject/devbob` |
| **Package Name** | `opencode` | `devbob` |
| **Scoped Packages** | `@opencode-ai/*` | `@metabob/*` |
| **Binary** | `opencode` | `devbob` |
| **Total References** | 207+ files | All updated |

---

## Quick Start (Recommended)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./rebrand-quick-start.sh
```

This will:
1. Create branch `rebrand/opencode-to-devbob`
2. Generate automation scripts in `repos/metabob-opencode/scripts/rebrand/`
3. Provide step-by-step instructions

---

## Automated Scripts Created

| Script | Purpose | Files Affected |
|--------|---------|----------------|
| `step1-packages.sh` | Rename all package.json entries | ~19 files |
| `step2-imports.sh` | Update TypeScript imports | ~100+ files |
| `step3-urls.sh` | Update GitHub URLs | ~50+ files |
| `step4-binaries.sh` | Update binary references | ~10 files |
| `step5-rename-dirs.sh` | Rename directories & files | 2-3 directories |
| `run-all.sh` | Execute all steps at once | All above |

---

## Execution Options

### Option A: Fully Automated (Fast)

```bash
cd repos/metabob-opencode
git checkout -b rebrand/opencode-to-devbob
./scripts/rebrand/run-all.sh

# Review changes
git status
git diff | head -100

# Test
bun run typecheck

# Commit
git commit -am "rebrand: opencode → devbob - automated changes"
```

**Time**: ~5 minutes  
**Risk**: Low (all changes are reversible)

### Option B: Step-by-Step (Controlled)

```bash
cd repos/metabob-opencode
git checkout -b rebrand/opencode-to-devbob

# Execute and review each step
./scripts/rebrand/step1-packages.sh && git add -A && git commit -m "rebrand: update package names"
./scripts/rebrand/step2-imports.sh && git add -A && git commit -m "rebrand: update imports"
./scripts/rebrand/step3-urls.sh && git add -A && git commit -m "rebrand: update URLs"
./scripts/rebrand/step4-binaries.sh && git add -A && git commit -m "rebrand: update binary refs"
./scripts/rebrand/step5-rename-dirs.sh && git add -A && git commit -m "rebrand: rename directories"

# Test after all steps
bun run typecheck
```

**Time**: ~20 minutes  
**Risk**: Lower (can review each step)

---

## Manual Steps Required After Automation

### 1. Update Root package.json Scripts

**File**: `package.json` (root)

Change:
```json
"scripts": {
  "dev": "bun run --cwd packages/opencode --conditions=browser ./src/index.ts"
}
```

To:
```json
"scripts": {
  "dev": "bun run --cwd packages/devbob --conditions=browser ./src/index.ts"
}
```

### 2. Update Binary Script Logic

**File**: `packages/devbob/bin/devbob`

Update platform binary names from:
- `name="opencode-${platform}-${arch}"`

To:
- `name="devbob-${platform}-${arch}"`

### 3. Update Workflows

**File**: `.github/workflows/opencode.yml`

Either:
- Rename file to `devbob.yml`
- OR update `uses: sst/opencode/github@latest` to your action

### 4. Test Build

```bash
cd packages/devbob
bun run build

# Verify binaries are created
ls -la dist/
```

---

## Validation Checklist

After running all scripts:

- [ ] TypeScript compiles: `bun run typecheck` (0 errors)
- [ ] No references to `sst/opencode`: `grep -r "sst/opencode" . | grep -v node_modules | grep -v .git`
- [ ] No references to `@opencode-ai`: `grep -r "@opencode-ai" packages/ | grep -v node_modules`
- [ ] Binary renamed: `ls packages/devbob/bin/devbob`
- [ ] Package names updated: `grep -r '"name":.*devbob' package.json`
- [ ] Repository URL updated: `grep "metabobproject/devbob" package.json`

---

## Testing Strategy

### Phase 1: Syntax/Compilation
```bash
bun run typecheck   # Must pass with 0 errors
bun test           # Run test suite
```

### Phase 2: Build Testing
```bash
cd packages/devbob
bun run build
./dist/devbob-linux-x64 --version
./dist/devbob-linux-x64 --help
```

### Phase 3: Workspace Testing
```bash
# Reinstall dependencies with new package names
bun install

# Verify workspace links
ls -la node_modules/@metabob/
```

---

## Rollback Plan

If something goes wrong:

```bash
# Abort and return to dev branch
git checkout dev
git branch -D rebrand/opencode-to-devbob

# OR revert specific commits
git revert <commit-hash>
```

---

## After Rebranding Complete

### 1. Create New GitHub Repository

```bash
# On GitHub: Create metabobproject/devbob

# Add new remote
git remote add devbob git@github.com:metabobproject/devbob.git

# Push
git push devbob rebrand/opencode-to-devbob:main
```

### 2. Update Distribution

- [ ] Register npm organization: `@metabob`
- [ ] Publish to npm: `npm publish --access public`
- [ ] Update VSCode extension
- [ ] Update GitHub Action
- [ ] Archive old repo: `avigopal/opencode`

### 3. Documentation

- [ ] Update README.md with installation instructions
- [ ] Add migration guide for existing users
- [ ] Blog post announcing DevBob
- [ ] Update external references

---

## Common Issues & Solutions

### Issue 1: Build Fails After Rename

**Error**: `Cannot find module '@opencode-ai/...'`

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules
bun install
```

### Issue 2: TypeScript Errors

**Error**: Import paths not resolving

**Solution**:
```bash
# Check tsconfig.json paths
# Ensure all imports use @metabob/* not @opencode-ai/*
grep -r "@opencode-ai" packages/*/src/
```

### Issue 3: Binary Not Found

**Error**: `opencode: command not found`

**Solution**:
- Verify `packages/devbob/bin/devbob` exists
- Check package.json: `"bin": { "devbob": "./bin/devbob" }`
- Reinstall: `npm install -g ./packages/devbob`

---

## Files Changed Summary

**Expected file changes**: ~300-400 files

| Category | Count |
|----------|-------|
| package.json files | ~19 |
| TypeScript imports | ~100+ |
| Documentation | ~30+ |
| Workflows | ~10 |
| Scripts | ~5 |
| Configuration | ~10 |
| Binaries | 2 |

---

## Timeline

| Day | Task | Duration |
|-----|------|----------|
| 1 | Run automation scripts | 30 min |
| 1 | Manual updates | 1 hour |
| 1 | Testing (compilation) | 30 min |
| 2 | Build testing | 2 hours |
| 2 | Fix issues | 2 hours |
| 3 | Integration testing | 4 hours |
| 4 | Documentation | 4 hours |
| 5 | Deployment | 2 hours |

**Total**: ~1 week for core rebranding + testing  
**Total with deployment**: ~3-4 weeks

---

## Support & Resources

**Documentation**:
- Full plan: `REBRANDING_PLAN.md`
- Scripts: `repos/metabob-opencode/scripts/rebrand/`

**Key Contacts**:
- Repository: https://github.com/metabobproject/devbob (to be created)
- npm: https://www.npmjs.com/org/metabob (to be created)

---

## Status Tracking

- [x] Rebranding plan created
- [x] Automation scripts generated
- [ ] Scripts executed
- [ ] Testing complete
- [ ] New repository created
- [ ] Packages published
- [ ] Documentation updated
- [ ] Deployment complete

---

**Last Updated**: February 17, 2026  
**Next Action**: Run `./rebrand-quick-start.sh` to begin
