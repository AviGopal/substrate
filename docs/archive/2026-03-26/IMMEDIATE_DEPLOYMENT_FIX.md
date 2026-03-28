# Immediate Deployment Fix - Action Plan

**Issue:** Testing team cannot use system (works only in dev environment)
**Root Cause:** Templates not bundled, paths hardcoded
**Fix Time:** 4-6 hours
**Priority:** CRITICAL

---

## The Core Problem

**What you said:** "Everything works in dev, but testing team hits major gaps"

**You're absolutely right:**
- Infrastructure validated ✅
- But only in `/home/avi/documents/.../metabob-devbob/`
- Testing team gets: "Template not found", "Path not found", "Zero templates available"

---

## Reality Check: We Have 82 Templates!

```bash
$ find templates/ -name "*.json" -type f | wc -l
82

# But they're scattered:
templates/bootstrap/        14 files
templates/infrastructure/   18 files
templates/docker/           7 files
templates/debugging/        2 files
templates/data-flow/        2 files
templates/testing/          2 files
... and 37 more in root
```

**Problem:** None of these are packaged/discoverable by external users

---

## Fix Plan (4-6 hours)

### Hour 1: Bundle Essential Templates

**Select 10-15 "must have" templates:**

```bash
# Core bootstrap (must-have):
templates/bootstrap/create-activity-template.json
templates/bootstrap/hello-world-minimal.json

# Data flow tracing (essential):
templates/data-flow/trace-data-flow-single-feature.json

# Infrastructure (essential):
templates/infrastructure/deploy-to-environment.json
templates/infrastructure/validate-deployment-constraints.json
templates/infrastructure/debug-failures.json

# Docker/deployment (common use cases):
templates/docker/validate-full-docker-environment.json
templates/docker/validate-devbob-container.json

# Testing (essential):
templates/testing/run-tests-in-docker.json

# Debugging (essential):
templates/debugging/debug-activity-execution-failure.json
```

**Create bundle:**
```bash
mkdir -p dist/templates/builtin/
cp templates/bootstrap/create-activity-template.json dist/templates/builtin/
cp templates/data-flow/trace-data-flow-single-feature.json dist/templates/builtin/
# ... copy 10-15 essential templates
```

### Hour 2: Create Installation Script

```bash
# dist/install-templates.sh
#!/bin/bash
INSTALL_DIR="${METABOB_TEMPLATES_DIR:-$HOME/.local/share/metabob/templates}"
mkdir -p "$INSTALL_DIR/builtin"
cp -r builtin/* "$INSTALL_DIR/builtin/"
echo "Installed $(ls builtin/*.json | wc -l) templates to $INSTALL_DIR"
```

### Hour 3: Fix Path Resolution in Tools

```typescript
// Before (WRONG):
const templatePath = "./templates/my-template.json"

// After (RIGHT):
const templatePath = resolveTemplatePath("my-template")

function resolveTemplatePath(id: string): string {
  const dirs = [
    process.env.METABOB_TEMPLATES_DIR,
    `${os.homedir()}/.local/share/metabob/templates/builtin`,
    `${process.cwd()}/templates`,
  ].filter(Boolean)
  
  for (const dir of dirs) {
    const path = `${dir}/${id}.json`
    if (existsSync(path)) return path
  }
  throw new Error(`Template not found: ${id}`)
}
```

### Hour 4: Update Key Scripts

```bash
# Fix 5 most critical scripts:
1. scripts/validate-core-use-case-e2e.sh
2. scripts/create-portable-template-package.sh
3. scripts/validate-activity-execution.sh
4. scripts/test-cli-activity-execution.sh
5. scripts/validate-all.sh

# Replace:
repos/metabob-opencode → $OPENCODE_HOME (env var)
./templates/ → $METABOB_TEMPLATES_DIR/builtin/
```

### Hour 5: Test on Clean Environment

```bash
# Use Docker for clean test:
docker run -it ubuntu:22.04 bash

# Inside container:
1. Copy dist/templates/ to ~/.local/share/metabob/
2. Run: ./dist/install-templates.sh
3. Verify: ls ~/.local/share/metabob/templates/builtin/
4. Test: (run validation script with new paths)
```

### Hour 6: Document Quick Start

```markdown
# QUICK START (for testing team)

1. Install templates:
   ./dist/install-templates.sh

2. Set environment:
   export METABOB_TEMPLATES_DIR="$HOME/.local/share/metabob/templates"

3. Verify installation:
   ls $METABOB_TEMPLATES_DIR/builtin/
   # Should show 10-15 templates

4. Run validation:
   ./scripts/validate-core-use-case-portable.sh
```

---

## Deliverables

After 4-6 hours, testing team gets:

1. **Template Bundle** (`dist/templates/builtin/`)
   - 10-15 essential templates
   - Self-contained (no external dependencies)

2. **Installation Script** (`dist/install-templates.sh`)
   - One command to set up templates
   - Works on any Linux/Mac

3. **Updated Scripts** (5 critical scripts)
   - No hardcoded paths
   - Use environment variables
   - Portable across machines

4. **Quick Start Guide** (`QUICK_START.md`)
   - Step-by-step for testing team
   - No assumptions about environment

5. **Validation Proof** (Docker test log)
   - Proves it works on clean environment
   - Testing team can reproduce

---

## Testing Acceptance

```bash
# Testing team follows this:
1. Fresh Ubuntu 22.04 (or their environment)
2. git clone repo
3. ./dist/install-templates.sh
4. export METABOB_TEMPLATES_DIR="$HOME/.local/share/metabob/templates"
5. ./scripts/validate-core-use-case-portable.sh

# Expected result:
✅ Templates found: 12/12
✅ Path resolution: working
✅ Validation: ALL TESTS PASS

# If any step fails:
❌ We haven't fixed deployment gap
```

---

## Critical Success Factors

1. **No hardcoded paths** - All paths use environment variables
2. **Templates bundled** - Distributed with the code
3. **One-command setup** - `./dist/install-templates.sh`
4. **Tested on clean environment** - Docker test proves it works
5. **Documented clearly** - Testing team knows exactly what to do

---

## What This Fixes

**Before:**
```
Testing team: "Template not found"
Testing team: "repos/metabob-opencode: No such directory"
Testing team: "How do we set this up?"
```

**After:**
```
Testing team: "Ran install script, templates found"
Testing team: "Validation tests passed"
Testing team: "System works as documented"
```

---

## Next Steps RIGHT NOW

```bash
# 1. Select core templates (15 minutes):
# List the 10-15 ESSENTIAL templates (must-have for basic use)

# 2. Create bundle (30 minutes):
mkdir -p dist/templates/builtin/
# Copy selected templates

# 3. Create install script (15 minutes):
# Write dist/install-templates.sh

# 4. Fix top 5 scripts (2 hours):
# Update to use env vars

# 5. Docker test (30 minutes):
# Prove it works on clean Ubuntu

# 6. Document (30 minutes):
# Write QUICK_START.md for testing team
```

**Total:** 4-5 hours to deployable state

---

## Summary

**You identified the right problem:**
- System works, but only in dev environment
- Testing team can't reproduce our validation

**The fix is clear:**
1. Bundle templates (don't rely on local filesystem)
2. Fix paths (use env vars, not hardcoded)
3. One-command setup (make it easy)
4. Test on clean environment (prove it works)
5. Document for testing team (make it obvious)

**Time investment:** 4-6 hours
**Impact:** CRITICAL - unblocks external validation

Let's do this NOW before any more validation work.

