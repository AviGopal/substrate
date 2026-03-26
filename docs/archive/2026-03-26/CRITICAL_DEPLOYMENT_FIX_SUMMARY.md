# CRITICAL: Deployment Gap - Immediate Action Required

**Date:** March 2, 2026
**Severity:** CRITICAL - Blocks external testing and deployment
**Root Cause:** System only works in dev environment

---

## The Problem

```
Dev Environment (works): ✅
└─ Everything validated
└─ All tests pass
└─ Tools function correctly

Testing Team Environment (broken): ❌
└─ Templates not found
└─ Hardcoded paths fail
└─ Missing dependencies
```

**Impact:** Testing team cannot validate the system we claim works

---

## Root Causes Identified

### 1. No Core Templates Packaged ⚠️ CRITICAL

**Evidence:**
```bash
# Templates exist in dev but scattered:
./templates/bootstrap/create-activity-template.json
./templates/debugging/*.json
./templates/docker/*.json

# But NOT as core bundle:
templates/add-feature-complete.json ❌ MISSING
templates/fix-bug-complete.json ❌ MISSING
templates/refactor-with-tests.json ❌ MISSING
```

**Result:** Users start with ZERO templates

### 2. Hardcoded Paths in 18+ Scripts

**Evidence:**
```bash
# Scripts assume dev structure:
repos/metabob-opencode/...  # 18 occurrences
/home/avi/documents/...     # Multiple scripts
cd repos/metabob-opencode   # Fails on other machines
```

**Result:** Scripts crash with "directory not found"

### 3. No Bootstrap/Init Process

**Evidence:**
- No `metabob-cli init` command
- No automatic template installation
- No first-run setup

**Result:** Users must manually configure everything

### 4. Template Names Referenced But Don't Exist

**Evidence:**
```typescript
// Docs reference these templates:
"add-feature-complete"  ← NOT FOUND as standalone file
"fix-bug-complete"      ← NOT FOUND as standalone file  
"refactor-with-tests"   ← NOT FOUND as standalone file
```

**Result:** Template execution fails immediately

---

## What Testing Team Sees

```bash
# Fresh install attempt:
$ git clone repo && cd repo
$ ./scripts/validate-core-use-case-e2e.sh

Error: repos/metabob-opencode: No such file or directory
Error: Template 'add-feature-complete' not found
Error: Cannot find module '@metabob/cli'

# Template list:
$ metabob-cli templates list
Available templates: [] (empty array)

# Execution:
$ metabob-cli exec activity --template add-feature-complete
Error: Template not found: add-feature-complete
```

---

## Immediate Fix Required (Day 1 - 4 hours)

### Step 1: Identify Core Templates (30 min)

```bash
# Find what actually exists:
find . -name "*.json" -path "*/templates/*" | \
  grep -E "bootstrap|debugging|docker" | \
  head -20

# Document which ones are "core" (must ship with CLI)
```

### Step 2: Create Template Bundle (1 hour)

```bash
# Package structure:
metabob-cli-templates/
├── builtin/
│   ├── create-activity-template.json  # From templates/bootstrap/
│   ├── trace-data-flow.json           # From templates/debugging/
│   ├── devctl-bring-up.json           # From templates/docker/
│   └── ... (5-10 essential templates)
├── manifest.json
├── install.sh
└── README.md
```

### Step 3: Add Path Resolution (1.5 hours)

```typescript
// Replace ALL instances of:
"repos/metabob-opencode/..."
"/home/avi/documents/..."
"./templates/"

// With:
import { resolveTemplate } from "@metabob/cli"
const path = resolveTemplate("template-id")
// OR
const path = process.env.METABOB_TEMPLATES_DIR || 
             `${os.homedir()}/.local/share/metabob/templates`
```

### Step 4: Add Bootstrap Command (1 hour)

```bash
# Create metabob-cli init:
metabob-cli init
# → Copies builtin templates to ~/.local/share/metabob/templates/
# → Creates config file
# → Verifies installation
```

**Total Day 1:** 4 hours critical path

---

## Medium-Term Fixes (Week 1 - 2 days)

### Step 5: Template Registry Integration

```bash
# Pull from backend:
metabob-cli templates pull

# Or create registry locally:
metabob-cli templates register --from-directory ./templates/
```

### Step 6: Update All Validation Tests

```bash
# Make portable:
scripts/validate-core-use-case-portable.sh
# → No hardcoded paths
# → Uses metabob-cli commands
# → Works on any machine
```

### Step 7: Documentation

```markdown
# Quick Start (NEW)
1. Install metabob-cli
2. Run: metabob-cli init
3. Verify: metabob-cli templates list
4. Execute: metabob-cli exec activity --template ...
```

---

## Truth Check: Current vs Required State

### Infrastructure Validation ✅ (Already Done)

```
Component Checklist:
  ✓ activity_error_inspector exists
  ✓ activity_replay exists
  ✓ Metrics collection exists
  ✓ Activity executor exists
```

**Status:** Infrastructure complete

### Deployment Validation ❌ (BLOCKED)

```
Deployment Checklist:
  ❌ Core templates bundled
  ❌ Portable path resolution
  ❌ Bootstrap process
  ❌ Template registry
  ❌ Portable validation tests
```

**Status:** Cannot deploy to testing team

---

## Acceptance Criteria for "Fixed"

```bash
# Test on fresh Ubuntu VM:
sudo apt install curl git

# Install CLI:
curl -fsSL https://metabob.com/install.sh | sh

# Bootstrap:
metabob-cli init
# → SUCCESS (templates installed)

# Verify:
metabob-cli templates list
# → Shows 5-10 core templates

# Execute:
metabob-cli exec activity --template create-activity-template
# → SUCCESS (template found and executed)

# Validation:
git clone validation-tests && cd validation-tests
./scripts/validate-core-use-case-portable.sh
# → ALL TESTS PASS
```

---

## Action Plan

### TODAY (March 2, 2026)

1. **Identify actual core templates** (which ones exist and are essential)
2. **Create portable bundle** using real template files
3. **Test bundle on clean environment**

### THIS WEEK

4. **Implement path resolution** in all tools
5. **Add bootstrap command** to metabob-cli
6. **Update validation tests** to be portable
7. **Document deployment process**

### NEXT WEEK

8. **Test with testing team** (external validation)
9. **Fix reported issues**
10. **Document lessons learned**

---

## Current Status

**Infrastructure:** ✅ 100% Complete  
**Deployment:** ❌ 0% Complete  

**Gap:** System validated but not deployable

**Blocker:** Testing team cannot reproduce our validation results

**Priority:** FIX IMMEDIATELY (before additional validation)

---

## Key Insight

We successfully validated that the **infrastructure works**, but we did it in a **non-portable way**.

The validation is TRUE for the dev environment.
The validation is UNKNOWN for production/testing environments.

**We must fix deployment before claiming validation is complete.**

---

## Next Immediate Action

```bash
# 1. Find actual templates that exist:
find templates/ -name "*.json" -type f | wc -l
# Current: 28 files

# 2. Identify which are "core":
ls templates/bootstrap/
ls templates/debugging/
ls templates/docker/

# 3. Bundle the real ones:
./scripts/create-portable-template-package.sh
# (Fix to use actual existing templates)

# 4. Test on clean VM:
docker run -it ubuntu:22.04
# Install and verify it works
```

**Estimated time to basic fix:** 4 hours  
**Estimated time to complete fix:** 2 days  
**Priority:** CRITICAL (do this NOW before more validation)

