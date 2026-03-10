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

### Component 1: Package Dependencies ❌
- **File**: `repos/metabob-opencode/packages/opencode/package.json:24`
- **Component**: `devDependencies["@ai-sdk/anthropic"]`
- **Current**: SDK in devDependencies only
- **Desired**: SDK in dependencies for binary bundling
- **Gap**: SDK not bundled with compiled binary (130MB)

### Component 2: SDK Preload ❌
- **File**: `repos/metabob-opencode/packages/opencode/src/provider/sdk-loader.ts:31`
- **Component**: `anthropicSDK` dynamic import
- **Current**: `import('@ai-sdk/anthropic')` fails, catch block logs "not preloaded"
- **Desired**: SDK successfully imported and registered in `preloadedSDKs` registry
- **Gap**: Import fails because package not in dependencies

### Component 3: getSDK Function ❌
- **File**: `repos/metabob-opencode/packages/opencode/src/provider/provider.ts:486-577`
- **Component**: `getSDK(provider, model)`
- **Current**: Falls back to `BunProc.install()` when preload returns undefined, throws InitError
- **Desired**: Uses preloaded SDK directly without network calls
- **Gap**: Fallback to dynamic install triggers error

## Fix Strategies

### Priority 1: Move SDK to dependencies ⭐
- Move `@ai-sdk/anthropic` from devDependencies to dependencies in package.json
- Rebuild opencode binary
- **Impact**: SDK bundled, preload succeeds

### Priority 2: Pre-install SDK in container 🛡️
- Add `RUN bun install @ai-sdk/anthropic` to Dockerfile
- **Impact**: Fallback works even if preload fails

## Recommended: Priority 1 + Priority 2 (defense in depth)
