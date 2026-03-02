# Architecture Verification Checklist

**Correct Architecture:** Backend-centric template distribution via MCP

---

## ✅ What Should Exist (Verify These)

### Backend (metabob-proto)

- [ ] **Template storage** - Database tables for activity templates
- [ ] **Template API** - REST endpoints for template CRUD
  - [ ] `GET /v2/activities/templates` - List templates
  - [ ] `GET /v2/activities/templates/:id` - Get specific template
  - [ ] `GET /v2/activities/templates/:id/select` - Thompson Sampling selection
  - [ ] `POST /v2/activities/templates/:id/metrics` - Report execution
  - [ ] `POST /v2/activities/templates` - Register new template
- [ ] **Thompson Sampling** - Variant selection algorithm
- [ ] **Metrics collection** - Track success/failure/cost/duration
- [ ] **Core templates registered** - 7-10 essential templates in registry

### metabob-cli

- [ ] **Backend configuration** - Config file with backend URL
- [ ] **Template fetch** - Fetch templates from backend via MCP
- [ ] **Local cache** - Cache templates in ~/.cache/metabob/templates/
- [ ] **Cache management** - Commands: status, clear, refresh
- [ ] **Template commands**:
  - [ ] `metabob-cli templates list` - List from backend
  - [ ] `metabob-cli templates get <id>` - Fetch specific template
  - [ ] `metabob-cli exec activity --template <id>` - Execute activity
  - [ ] `metabob-cli cache status` - Show cache info
  - [ ] `metabob-cli cache clear` - Clear cache

### metabob-opencode

- [ ] **Template execution** - Execute templates provided by CLI
- [ ] **NO template discovery** - Doesn't search for templates
- [ ] **NO template storage** - Doesn't store templates
- [ ] **Metrics reporting** - Report results to backend via MCP
- [ ] **Template-agnostic** - Doesn't know what templates exist

---

## ❌ What Should NOT Exist (Remove These)

### Local Template Storage

- [ ] ❌ Remove: `./templates/` as source of truth (OK for dev/testing)
- [ ] ❌ Remove: Hardcoded paths to local templates
- [ ] ❌ Remove: Template bundling scripts (except for backend upload)
- [ ] ❌ Remove: Local template installation scripts

### OpenCode Template Discovery

- [ ] ❌ Remove: `search_activities` tool (move to CLI)
- [ ] ❌ Remove: `register_activity_template` tool (move to CLI)
- [ ] ❌ Remove: Template file system scanning
- [ ] ❌ Remove: Local template registry

---

## 🔍 Verification Tests

### Test 1: Backend Template API

```bash
# Should return templates from backend:
curl https://api.metabob.com/v2/activities/templates

# Expected:
# {
#   "templates": [
#     {"id": "create-activity-template", "name": "...", ...},
#     {"id": "debug-activity-execution", "name": "...", ...},
#     ...
#   ]
# }
```

**Status:** [ ] PASS / [ ] FAIL

### Test 2: CLI Fetch from Backend

```bash
# Should fetch from backend and cache:
metabob-cli templates list

# Expected:
# Fetching templates from https://api.metabob.com...
# Available templates:
#   - create-activity-template: Create new activity templates
#   - debug-activity-execution: Debug failed activities
#   ...
```

**Status:** [ ] PASS / [ ] FAIL

### Test 3: Cache Working

```bash
# Should create cache:
metabob-cli templates get create-activity-template
ls ~/.cache/metabob/templates/create-activity-template.json

# Expected:
# File exists in cache
```

**Status:** [ ] PASS / [ ] FAIL

### Test 4: OpenCode Template-Agnostic

```typescript
// Should work without knowing what templates exist:
const template = { /* provided by CLI */ }
await opencode.executeActivity(template, variables)

// Should NOT have:
// - search_activities tool
// - register_activity_template tool
// - Local template scanning
```

**Status:** [ ] PASS / [ ] FAIL

### Test 5: Clean Environment Works

```bash
# Fresh Ubuntu VM:
docker run -it ubuntu:22.04 bash

# Inside:
curl -fsSL https://install.metabob.com/cli.sh | sh
metabob-cli config set backend-url https://api.metabob.com
metabob-cli templates list

# Expected:
# Shows templates from backend (NO local templates needed)
```

**Status:** [ ] PASS / [ ] FAIL

### Test 6: Thompson Sampling Selection

```bash
# Should select variant based on Thompson Sampling:
curl https://api.metabob.com/v2/activities/templates/create-activity-template/select

# Expected:
# Returns ONE variant (selected via Thompson Sampling)
# {
#   "template": { /* full template */ },
#   "variant_id": "variant-a",
#   "selection_reason": "Thompson Sampling (alpha=10, beta=2, sample=0.85)"
# }
```

**Status:** [ ] PASS / [ ] FAIL

### Test 7: Metrics Reporting

```bash
# After execution, should report to backend:
# (Check backend logs)

# Expected:
# POST /v2/activities/templates/create-activity-template/metrics
# Body: {
#   "success": true,
#   "duration": 45000,
#   "cost": 0.0234,
#   "tokens": {...}
# }
```

**Status:** [ ] PASS / [ ] FAIL

---

## 📋 Migration Checklist

### Phase 1: Backend Setup

- [ ] Verify backend template API exists
- [ ] Upload 7-10 core templates to backend
- [ ] Test GET /v2/activities/templates
- [ ] Test Thompson Sampling endpoint
- [ ] Verify metrics endpoint working

### Phase 2: CLI Implementation

- [ ] Add backend fetch logic to CLI
- [ ] Implement local cache
- [ ] Add cache management commands
- [ ] Test fetch + cache workflow
- [ ] Update CLI documentation

### Phase 3: OpenCode Cleanup

- [ ] Remove search_activities tool
- [ ] Remove register_activity_template tool
- [ ] Remove local template scanning
- [ ] Keep activity execution
- [ ] Keep metrics reporting

### Phase 4: Testing & Validation

- [ ] Test on fresh Ubuntu VM
- [ ] Test with metabob-cli only
- [ ] Test backend-centric workflow
- [ ] Update validation scripts
- [ ] Document for testing team

---

## 🎯 Success Criteria

**Testing team should be able to:**

```bash
# 1. Install CLI only
curl -fsSL https://install.metabob.com/cli.sh | sh

# 2. Configure backend
metabob-cli config set backend-url https://api.metabob.com

# 3. List templates (from backend)
metabob-cli templates list
# → Shows 7-10 templates

# 4. Execute activity (fetches from backend, caches, executes)
metabob-cli exec activity --template create-activity-template
# → Works without any local templates

# 5. Validation passes
./scripts/validate-core-use-case-e2e.sh
# → All tests pass
```

**If ANY of the above fails, architecture is not correct yet.**

---

## 🔄 Current Status Check

Run these commands to check current state:

```bash
# 1. Does backend API exist?
curl https://api.metabob.com/v2/activities/templates
# [ ] YES - API responds
# [ ] NO - Need to implement

# 2. Does CLI fetch from backend?
metabob-cli templates list 2>&1 | grep "Fetching from"
# [ ] YES - Fetches from backend
# [ ] NO - Uses local templates

# 3. Does OpenCode have template discovery?
grep -r "search_activities" repos/metabob-opencode/packages/opencode/src/tool/
# [ ] FOUND - Need to remove
# [ ] NOT FOUND - Good (already removed)

# 4. Are there local template paths?
grep -r "templates/" scripts/*.sh | grep -v cache | wc -l
# [ ] 0 - Good (no hardcoded paths)
# [ ] >0 - Need to remove hardcoded paths

# 5. Is cache being used?
ls ~/.cache/metabob/templates/ 2>/dev/null | wc -l
# [ ] >0 - Cache working
# [ ] 0 - Cache not set up
```

---

## 📝 Documentation Updates Needed

- [ ] Update README.md - Remove local template setup
- [ ] Update DEPLOYMENT.md - Backend-centric architecture
- [ ] Update QUICK_START.md - CLI + backend URL only
- [ ] Update TESTING_GUIDE.md - No local templates needed
- [ ] Add ARCHITECTURE.md - Document correct architecture

---

## ✅ Final Verification

**Before claiming "deployment gap fixed":**

1. [ ] Backend stores all templates
2. [ ] CLI fetches via MCP
3. [ ] OpenCode is template-agnostic
4. [ ] Local cache only (not source of truth)
5. [ ] Testing team needs backend URL only
6. [ ] No hardcoded template paths
7. [ ] Fresh Ubuntu VM test passes
8. [ ] Thompson Sampling works

**All 8 must be checked before deployment gap is truly fixed.**

---

**Date:** March 2, 2026  
**Status:** Verification in progress  
**Next:** Check current architecture against this checklist

