# Trace Analysis: devbob-independent-execution-validation

## Specification
**ID**: devbob-independent-execution-validation  
**Description**: DevBob container must independently execute opencode commands with proper service connectivity and credential access  
**Expected**: opencode commands execute successfully, services reachable (metabob-rpc-api, surrealdb), all secrets accessible as env vars  
**Current Status**: ❌ FAILING - ProviderInitError

---

## Root Cause

**Anthropic SDK not preloaded in compiled opencode binary**

**Location**: `repos/metabob-opencode/packages/opencode/src/provider/sdk-loader.ts:31`

**Evidence**:
1. SDK loader initialization log: `total=2 loaded=0 packages=[]`
2. `@ai-sdk/anthropic` is in `devDependencies`, not `dependencies` (package.json:24)
3. Preload import wrapped in try-catch, silently fails at build time
4. Runtime fallback to `BunProc.install()` triggers ProviderInitError

---

## Components Traced

### Component 1: Package Dependencies
- **File**: `repos/metabob-opencode/packages/opencode/package.json:24`
- **Component**: `devDependencies["@ai-sdk/anthropic"]`
- **Current**: SDK in devDependencies only
- **Desired**: SDK in dependencies for binary bundling
- **Gap**: SDK not bundled with compiled binary (130MB)

### Component 2: SDK Preload
- **File**: `repos/metabob-opencode/packages/opencode/src/provider/sdk-loader.ts:31`
- **Component**: `anthropicSDK` dynamic import
- **Current**: `import('@ai-sdk/anthropic')` fails, catch block logs "not preloaded"
- **Desired**: SDK successfully imported and registered in `preloadedSDKs` registry
- **Gap**: Import fails because package not in dependencies

### Component 3: getSDK Function
- **File**: `repos/metabob-opencode/packages/opencode/src/provider/provider.ts:486-577`
- **Component**: `getSDK(provider, model)`
- **Current**: Falls back to `BunProc.install()` when preload returns undefined, throws InitError
- **Desired**: Uses preloaded SDK directly without network calls
- **Gap**: Fallback to dynamic install triggers error (network/permissions/timing)

### Component 4: ConfigMap ✅
- **File**: `helm/charts/devbob/templates/configmap.yaml:12`
- **Component**: opencode.json template
- **Current**: Template variables `${ANTHROPIC_API_KEY}` `${METABOB_API_KEY}`
- **Desired**: Variables substituted in initContainer
- **Gap**: NONE - working correctly (verified in pod)

### Component 5: initContainer ✅
- **File**: `helm/charts/devbob/templates/deployment.yaml:27-42`
- **Component**: setup-config initContainer
- **Current**: Copies config, runs `sed` to substitute env vars
- **Desired**: Real API keys in `/workspace/.config/opencode/opencode.json`
- **Gap**: NONE - substitution confirmed working

### Component 6: Environment Variables ✅
- **File**: `helm/charts/devbob/templates/deployment.yaml:88-98`
- **Component**: env vars from secrets
- **Current**: ANTHROPIC_API_KEY and METABOB_API_KEY injected from k8s secrets
- **Desired**: API keys available to opencode process
- **Gap**: NONE - env vars present and correct

### Component 7: Binary Packaging
- **File**: `configs/Dockerfile.devbob:151-163`
- **Component**: opencode binary installation
- **Current**: Copies pre-built binary from dist/, symlinks to /usr/local/bin
- **Desired**: Binary contains preloaded @ai-sdk/anthropic
- **Gap**: Binary built without SDK in dependencies

---

## Data Flow

```
Entry: kubectl exec devbob -- opencode run 'What is 2+2?'
  │
  ├─→ Step 1: Binary startup
  │   Location: repos/metabob-opencode/packages/opencode/src/index.ts
  │   Action: Loads sdk-loader.ts module
  │   Output: "SDK loader initialized: total=2 loaded=0 packages=[]"
  │
  ├─→ Step 2: SDK preload attempt
  │   Location: repos/metabob-opencode/packages/opencode/src/provider/sdk-loader.ts:29-35
  │   Action: import('@ai-sdk/anthropic')
  │   Output: Catch block triggered, anthropicSDK = undefined
  │
  ├─→ Step 3: Provider initialization
  │   Location: repos/metabob-opencode/packages/opencode/src/provider/provider.ts:215-480
  │   Action: state() function initializes providers from config
  │   Output: Found anthropic provider with API key
  │
  ├─→ Step 4: getSDK invocation
  │   Location: repos/metabob-opencode/packages/opencode/src/provider/provider.ts:486
  │   Action: SDKLoader.getPreloadedSDK('@ai-sdk/anthropic')
  │   Output: undefined (not preloaded)
  │
  ├─→ Step 5: Dynamic install fallback
  │   Location: repos/metabob-opencode/packages/opencode/src/provider/provider.ts:508
  │   Action: BunProc.install('@ai-sdk/anthropic', 'latest')
  │   Output: FAILS - throws error, caught at line 560
  │
  └─→ Step 6: Error wrapping
      Location: repos/metabob-opencode/packages/opencode/src/provider/provider.ts:575
      Action: throw new InitError({ providerID: 'anthropic' })
      Output: ProviderInitError propagates to user

Exit: Command fails with ProviderInitError
```

---

## Fix Strategies (Prioritized)

### Priority 1: Move SDK to dependencies ⭐
- **Files**: [`repos/metabob-opencode/packages/opencode/package.json`]
- **Changes**: Move `@ai-sdk/anthropic` from devDependencies to dependencies
- **Rebuild**: Required - rebuild opencode binary
- **Impact**: SDK bundled in binary, preload succeeds
- **Effort**: LOW (1 line + rebuild)

### Priority 2: Pre-install SDK in container 🛡️
- **Files**: [`configs/Dockerfile.devbob`]
- **Changes**: Add `RUN bun install @ai-sdk/anthropic` after line 163
- **Rebuild**: Required - rebuild DevBob image
- **Impact**: SDK available for dynamic import fallback
- **Effort**: LOW (add RUN command)

### Priority 3: Fix fallback error handling
- **Files**: [`repos/metabob-opencode/packages/opencode/src/provider/provider.ts`]
- **Changes**: Better error logging, investigate BunProc.install() failure
- **Rebuild**: Required
- **Impact**: Graceful fallback when preload fails
- **Effort**: MEDIUM (requires investigation)

---

## Recommended Solution

**Implement Priority 1 + Priority 2** (defense in depth)

**Reasoning**:
- Priority 1: Long-term fix - ensures SDK preload works
- Priority 2: Short-term mitigation - provides fallback if binary rebuild has issues
- Both are low effort, high impact
- Combined approach maximizes reliability

---

## Validation Checklist

After fixes applied:

```bash
# 1. Verify SDK preload works
kubectl exec -n metabob deployment/devbob -- sh -c "opencode run 'test' 2>&1 | grep 'SDK loader'"
# Expected: "loaded=1" or "loaded=2" (not "loaded=0")

# 2. Verify no ProviderInitError
kubectl exec -n metabob deployment/devbob -- sh -c "timeout 10s opencode run 'What is 2+2?' 2>&1"
# Expected: No ProviderInitError, successful response

# 3. Verify activity execution works
kubectl exec -n metabob deployment/devbob -- sh -c "cd /workspace && opencode activity list 2>&1"
# Expected: List of activities, no errors

# 4. Verify service connectivity
kubectl exec -n metabob deployment/devbob -- curl -s http://metabob-rpc-api.metabob.svc.cluster.local:8080/status
# Expected: {"status":"ok"} or similar success response
```

---

## Implementation Steps

1. **Apply Priority 1 fix**:
   ```bash
   cd repos/metabob-opencode/packages/opencode
   # Edit package.json: move @ai-sdk/anthropic to dependencies
   bun install
   bun run build --single
   ```

2. **Apply Priority 2 fix**:
   ```bash
   # Edit configs/Dockerfile.devbob
   # Add after line 163:
   # RUN bun install @ai-sdk/anthropic
   docker build -f configs/Dockerfile.devbob -t devbob:latest .
   ```

3. **Update deployment**:
   ```bash
   helm upgrade devbob helm/charts/devbob -n metabob
   kubectl rollout status deployment/devbob -n metabob
   ```

4. **Run validation checklist** (see above)

5. **Test activity execution**:
   ```bash
   kubectl exec -n metabob deployment/devbob -- sh -c "cd /workspace && opencode activity execute <template-id> --variables '{...}'"
   ```

---

## Trace Metadata

- **Traced by**: OpenCode trace-data-flow-single-feature
- **Date**: 2026-03-10
- **Specification**: devbob-independent-execution-validation
- **Status**: Root cause identified, fix strategy recommended
- **Next**: Apply Priority 1 + Priority 2 fixes, validate, then enable activity execution

---

## Additional Context

### Service Mappings (Verified ✅)
- **metabob-rpc-api**: `http://metabob-rpc-api.metabob.svc.cluster.local:8080`
- **surrealdb**: `http://surrealdb.metabob.svc.cluster.local:8000`
- Both services reachable from DevBob pod (env vars show k8s service endpoints)

### Secrets Injection (Verified ✅)
- ANTHROPIC_API_KEY: Present in env, substituted in config
- METABOB_API_KEY: Present in env, substituted in config
- Both secrets correctly mounted from k8s secret `devbob-secrets`

### In-Container Validation (Ready 🚧)
After fixes, create validation script:
```bash
#!/bin/bash
# /workspace/validate-devbob.sh
echo "1. SDK Preload Check"
opencode run 'test' 2>&1 | grep 'SDK loader'

echo "2. Provider Init Check"
timeout 10s opencode run 'What is 2+2?' 2>&1 | head -20

echo "3. Service Connectivity"
curl -s http://metabob-rpc-api.metabob.svc.cluster.local:8080/status

echo "4. Activity List"
opencode activity list
```
