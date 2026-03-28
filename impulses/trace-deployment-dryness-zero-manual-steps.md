# Trace Analysis: Deployment DRYness - Zero Manual Steps

## Specification Summary
**Goal**: Helm deployment must work with zero manual kubectl commands. ENVIRONMENT variable and JWT_SECRET_KEY must be configured declaratively in helm values and templates, not manually added after deployment.

**Expected Behavior**: After running 'helmfile -e default apply', the RPC API deployment should start successfully with ENVIRONMENT=development and JWT_SECRET_KEY configured from helm values/secrets, without requiring any manual 'kubectl set env' or 'kubectl edit configmap' commands.

---

## Data Flow Trace

```
helmfile.yaml 
  → environments/local.values.yaml 
  → charts/metabob-rpc-api.values.yaml 
  → templates/deployment-api.yaml 
  → Pod env vars 
  → RPC API container 
  → JWT validation code
```

---

## Current State vs Desired State

### Current State: Manual Configuration Required ❌

**Deployment Flow**:
1. User runs: `helmfile -e default apply`
2. Helm deploys metabob-rpc-api with deployment-api.yaml
3. Deployment tries to reference universal-config ConfigMap (**DOES NOT EXIST**)
4. Pod starts but ENVIRONMENT variable is **undefined**
5. RPC API code validates JWT_SECRET_KEY
6. Without ENVIRONMENT=development, **strict validation enforced**
7. JWT_SECRET_KEY is weak (not in ConfigMap anyway), **validation FAILS**
8. Container **crashes**, enters **CrashLoopBackOff**
9. ⚠️ **MANUAL STEP**: `kubectl set env deployment/metabob-rpc-api ENVIRONMENT=development -n metabob`
10. Pod restarts with ENVIRONMENT=development, bypasses strict JWT validation
11. RPC API starts successfully

**Manual Steps Required**:
- `kubectl set env deployment/metabob-rpc-api ENVIRONMENT=development -n metabob`

**Failure Mode**: CrashLoopBackOff due to missing ENVIRONMENT variable and strict JWT validation

---

### Desired State: Zero Manual Steps ✅

**Deployment Flow**:
1. User runs: `helmfile -e default apply`
2. Helmfile loads environments/local.values.yaml (contains ENVIRONMENT=development and JWT_SECRET_KEY)
3. Helm renders deployment-api.yaml with ENVIRONMENT env var from values
4. Helm creates universal-config ConfigMap with JWT_SECRET_KEY from values
5. Pod starts with ENVIRONMENT=development in env vars
6. RPC API validates JWT_SECRET_KEY in development mode (relaxed validation)
7. Validation **passes**
8. RPC API **starts successfully on first try**

**Manual Steps Required**: None

**Success Mode**: RPC API pod reaches Running state immediately after deployment

---

## Component Analysis

### 1. helm/helmfile.yaml
- **Component**: metabob-rpc-api release
- **Current Behavior**: Loads base values from charts/metabob-rpc-api.values.yaml and environment-specific values from charts/metabob-rpc-api.{{ .Environment.Name }}.values.yaml
- **Desired Behavior**: Same - no changes needed at helmfile level
- **Gap**: None - helmfile configuration is correct

### 2. helm/charts/metabob-rpc-api/values.yaml
- **Component**: RPC API base values
- **Current Behavior**: Defines image registry, tag, and release name. No ENVIRONMENT variable or JWT configuration
- **Desired Behavior**: Should define default values for ENVIRONMENT (e.g., 'production') and jwtSecretKey
- **Gap**: MISSING default values for ENVIRONMENT and jwtSecretKey

### 3. helm/environments/local.values.yaml
- **Component**: Local environment configuration
- **Current Behavior**: Defines environmentName, domain, image versions, and feature flags. Does NOT define ENVIRONMENT variable or JWT_SECRET_KEY
- **Desired Behavior**: Should include ENVIRONMENT=development and JWT_SECRET_KEY for local deployment
- **Gap**: MISSING ENVIRONMENT and JWT_SECRET_KEY configuration for RPC API

### 4. helm/charts/metabob-rpc-api/templates/deployment-api.yaml
- **Component**: RPC API deployment environment variables
- **Current Behavior**: Lines 30-86: Hardcoded env vars (WORKERS, TIMEOUT_KEEP_ALIVE, CONFIG_PATH, LOG_LEVEL, REDIS_URI, SURREALDB_*, JWT_SECRET_KEY from ConfigMap). NO ENVIRONMENT variable
- **Desired Behavior**: Should include ENVIRONMENT variable from values file
- **Gap**: MISSING ENVIRONMENT env var definition in deployment template
- **Location**: spec.template.spec.containers[0].env section

### 5. helm/charts/metabob-rpc-api/templates/deployment-worker.yaml
- **Component**: RPC API worker environment variables
- **Current Behavior**: Lines 25-54: Env vars for worker pods. JWT_SECRET_KEY from ConfigMap. NO ENVIRONMENT variable
- **Desired Behavior**: Should include ENVIRONMENT variable from values file for consistency
- **Gap**: MISSING ENVIRONMENT env var definition in worker deployment template

### 6. helm/charts/metabob-rpc-api/templates/ ⚠️ CRITICAL
- **Component**: ConfigMap or Secret for universal-config
- **Current Behavior**: NO ConfigMap template exists! Deployment references 'universal-config' ConfigMap (lines 84-86 in deployment-api.yaml, 94-99 in deployment-worker.yaml) but it's never created by helm
- **Desired Behavior**: Create ConfigMap template with JWT_SECRET_KEY and .env file
- **Gap**: CRITICAL - Missing ConfigMap template that deployment depends on

---

## Gap Analysis

### Configuration Gaps
1. **environments/local.values.yaml**
   - Missing: ENVIRONMENT and JWT_SECRET_KEY values
   - Impact: Cannot template ENVIRONMENT into deployment, causing crash loop

2. **helm/charts/metabob-rpc-api/values.yaml**
   - Missing: Default ENVIRONMENT and jwtSecretKey value definitions
   - Impact: No values to override in environment files

3. **helm/charts/metabob-rpc-api/templates/deployment-api.yaml**
   - Missing: ENVIRONMENT env var block in spec.template.spec.containers[0].env
   - Impact: ENVIRONMENT never set in pod, causing strict JWT validation

4. **helm/charts/metabob-rpc-api/templates/deployment-worker.yaml**
   - Missing: ENVIRONMENT env var block in spec.template.spec.containers[0].env
   - Impact: Worker pods inconsistent with API pods

### Resource Gaps
1. **helm/charts/metabob-rpc-api/templates/configmap.yaml**
   - Missing: Entire ConfigMap template
   - Impact: CRITICAL - Deployment references non-existent ConfigMap, volume mount fails, JWT_SECRET_KEY unavailable

---

## Architectural Decisions

### Decision 1: ConfigMap vs Secret for JWT_SECRET_KEY
- **Recommendation**: ConfigMap for local dev, Secret for production
- **Rationale**: Secrets are encrypted at rest, ConfigMaps are plaintext. Local dev doesn't need encryption.

### Decision 2: Where to create universal-config ConfigMap
- **Recommendation**: Create in metabob-rpc-api chart (not separate config chart)
- **Rationale**: This repo is standalone, no need for shared config chart like in platform repo

### Decision 3: Where to define ENVIRONMENT value
- **Recommendation**: In environment-specific values files (environments/local.values.yaml, environments/production.values.yaml)
- **Rationale**: Different environments need different values, matches helmfile pattern

---

## Implementation Plan

### Phase 1: Add ENVIRONMENT variable
**Tasks**:
1. Add 'environment: development' to helm/charts/metabob-rpc-api.values.yaml as default
2. Add metabobRpcApi.environment to helm/environments/local.values.yaml
3. Add ENVIRONMENT env var to helm/charts/metabob-rpc-api/templates/deployment-api.yaml
4. Add ENVIRONMENT env var to helm/charts/metabob-rpc-api/templates/deployment-worker.yaml

**Validation**: Deploy with helmfile and verify pod starts without manual kubectl command

### Phase 2: Create ConfigMap template
**Tasks**:
1. Add 'jwtSecretKey' to helm/charts/metabob-rpc-api.values.yaml
2. Add metabobRpcApi.jwtSecretKey to helm/environments/local.values.yaml
3. Create helm/charts/metabob-rpc-api/templates/configmap.yaml with universal-config name
4. Template JWT_SECRET_KEY value from values file into ConfigMap

**Validation**: Verify ConfigMap created with JWT_SECRET_KEY, deployment references it correctly

### Phase 3: Full deployment validation
**Tasks**:
1. Destroy existing deployment: helmfile -e default destroy
2. Deploy from scratch: helmfile -e default apply
3. Verify no manual steps required
4. Verify RPC API pod Running immediately
5. Run GAP-9 validation tests

**Validation**: Zero manual steps, all tests pass

---

## Files Requiring Changes

1. ✏️ **helm/charts/metabob-rpc-api/values.yaml**
   - Add: `environment: production` (default)
   - Add: `jwtSecretKey: ""` (override per environment)

2. ✏️ **helm/environments/local.values.yaml**
   - Add: `metabobRpcApi.environment: development`
   - Add: `metabobRpcApi.jwtSecretKey: dev-secret-key-12345`

3. ✏️ **helm/charts/metabob-rpc-api/templates/deployment-api.yaml**
   - Add ENVIRONMENT env var after line 38

4. ✏️ **helm/charts/metabob-rpc-api/templates/deployment-worker.yaml**
   - Add ENVIRONMENT env var after line 29

5. ➕ **helm/charts/metabob-rpc-api/templates/configmap.yaml** (NEW FILE)
   - Create ConfigMap with name: universal-config
   - Include JWT_SECRET_KEY from values

---

## Success Criteria

✅ **Must Have**:
- helmfile -e default apply works with zero manual steps
- RPC API starts successfully on first deployment
- No CrashLoopBackOff state

✅ **Validation**:
- Fresh deployment from clean state succeeds
- Pod reaches Running state within 60 seconds
- No manual kubectl commands required
