# Deployment DRYness Analysis & Solution Plan

**Date**: March 14, 2026  
**Status**: Analysis Complete, Implementation Pending  
**Goal**: Achieve 100% DRY deployment with consistent database management

---

## Executive Summary

### Current State
✅ **Good**: Basic deployment is DRY and reproducible via helmfile  
⚠️ **Issues**: Manual runtime configuration required after deployment  
⚠️ **Issues**: Database schema management not fully integrated into deployment

### Target State
✅ **Perfect**: Zero manual steps after `helmfile -e default apply`  
✅ **Perfect**: Database schema initialized/migrated automatically  
✅ **Perfect**: All configuration declarative and version-controlled

---

## Problem Analysis

### Problem 1: Manual Runtime Configuration Required

**Current Situation**:
```bash
helmfile -e default apply
# ⚠️ Manual step required:
kubectl set env deployment/metabob-rpc-api ENVIRONMENT=development -n metabob
```

**Root Cause**:
- `ENVIRONMENT` variable controls JWT secret validation strictness
- JWT validation code checks if ENVIRONMENT=production and exits if JWT_SECRET_KEY is weak
- Currently `JWT_SECRET_KEY` added to ConfigMap after deployment manually
- `ENVIRONMENT` variable not defined in helm deployment template

**Impact**:
- ❌ Deployment not truly one-command
- ❌ RPC API crashes until manual fix applied
- ❌ New team members must know the secret manual step

---

### Problem 2: JWT Secret Not in Version Control

**Current Situation**:
- JWT_SECRET_KEY manually added to ConfigMap after deployment
- Value not stored in helm values files

**Root Cause**:
- ConfigMap template doesn't include JWT_SECRET_KEY
- Value is added manually at runtime
- Not stored in helm values files

**Impact**:
- ❌ Not reproducible from clean state
- ❌ Different environments may have different secrets
- ❌ Secret not managed properly (should use Kubernetes Secret, not ConfigMap)

---

### Problem 3: Database Schema Management Not Integrated

**Current Situation**:
- SurrealDB init schema hook **disabled** to avoid BackoffLimitExceeded errors
- Schema initialization happens implicitly via RPC API startup
- Migration scripts exist but not run automatically on deployment/upgrade
- No clear migration strategy for schema changes

**Root Cause**:
- Init schema job had namespace/database mismatch issues
- Disabled as quick fix, never re-enabled properly
- Migration runner script exists but not integrated into helm deployment

**Impact**:
- ⚠️ No guaranteed schema state on fresh deployment
- ⚠️ Schema changes require manual migration runs
- ⚠️ Risk of deploying new code that expects schema changes not applied
- ⚠️ No migration version tracking visible in deployment

---

## Solution Architecture

### Solution 1: Add ENVIRONMENT Variable to Helm Values

**Implementation**:

1. Add to RPC API values file:
   ```yaml
   environment: development  # or production for prod
   ```

2. Update deployment template to add env var

**Benefits**: No manual kubectl commands needed

---

### Solution 2: Move JWT Secret to Kubernetes Secret

**Implementation**: Create Secret resource and reference from deployment

**Benefits**:
- Proper separation of secrets from config
- Different secrets per environment
- Encrypted at rest in Kubernetes

---

### Solution 3: Integrate Database Schema Management

**Implementation**:

Phase 1: Fix init schema hook
Phase 2: Integrate migration runner as Kubernetes Job
Phase 3: Migration versioning strategy

---

## Implementation Plan

### Phase 1: Fix Immediate DRYness Issues (1-2 hours)

**Tasks**:
1. Add ENVIRONMENT variable to helm values and deployment
2. Create JWT secret helm secret resource
3. Update helmfile to reference secrets file
4. Test deployment from clean state

**Files Modified**:
- charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
- charts/metabob-rpc-api/charts/templates/deployment-api.yaml
- charts/metabob-rpc-api/charts/templates/secret.yaml (new)

---

### Phase 2: Fix Database Schema Management (2-3 hours)

**Tasks**:
1. Fix SurrealDB init schema job namespace/database config
2. Re-enable init schema hook
3. Test init schema job independently
4. Validate schema created correctly

**Files Modified**:
- charts/surrealdb/values/default.surrealdb.values.yaml
- charts/surrealdb/charts/templates/init-schema-job.yaml

---

### Phase 3: Integrate Migration Runner (3-4 hours)

**Tasks**:
1. Create Python migration runner script
2. Create Kubernetes Job template for migrations
3. Bundle migration SQL files in Docker image
4. Add helm post-upgrade hook

**Files Created**:
- repos/metabob-rpc-api/scripts/run_migrations.py
- charts/metabob-rpc-api/charts/templates/migration-job.yaml

---

## Success Criteria

### Must Have (Phase 1)
- ✅ helmfile -e default apply works with zero manual steps
- ✅ RPC API starts successfully
- ✅ GAP-9 tests pass immediately

### Should Have (Phase 2)
- ✅ Database schema initialized automatically
- ✅ Init schema job completes successfully
- ✅ All required tables exist

### Nice to Have (Phase 3)
- ✅ Migrations run automatically on helm upgrade
- ✅ Migration state tracked in database

---

## Timeline: 8-11 hours total

**Next Action**: Review and approve, then implement Phase 1
