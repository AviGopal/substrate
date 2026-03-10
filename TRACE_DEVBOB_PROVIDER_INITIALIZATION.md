# Trace Analysis: DevBob Provider Initialization

## Specification
**Name**: devbob-provider-initialization  
**Description**: Anthropic provider must initialize successfully in DevBob pod to enable activity execution  
**Expected Behavior**: `opencode run` command completes without ProviderInitError, ANTHROPIC_API_KEY accessible, read-only config doesn't block init

## Current State vs Desired State

### ✅ Working Components

1. **Entry Point** (`repos/metabob-opencode/packages/opencode/src/cli/cmd/run.ts:291`)
   - Current: Correctly calls `bootstrap()` to initialize Instance
   - Desired: Same
   - Status: ✅ No changes needed

2. **Bootstrap** (`repos/metabob-opencode/packages/opencode/src/cli/bootstrap.ts:4`)
   - Current: Wraps callback with `Instance.provide()` which initializes InstanceBootstrap
   - Desired: Same
   - Status: ✅ No changes needed

3. **Instance Bootstrap** (`repos/metabob-opencode/packages/opencode/src/project/bootstrap.ts:15`)
   - Current: Initializes plugins, share, format, LSP, file watcher, template library
   - Desired: Same (providers are lazily initialized)
   - Status: ✅ No changes needed

4. **Environment Validation** (`configs/devbob-entrypoint.sh:79`)
   - Current: Validates ANTHROPIC_API_KEY is set, checks workspace directory
   - Desired: Same
   - Status: ✅ No changes needed

### ⚠️ Critical Components (Investigation Needed)

5. **Provider State Initialization** (`repos/metabob-opencode/packages/opencode/src/provider/provider.ts:215`)
   - Current: Lazy initialization via `Instance.state()` - loads config, detects env vars, merges providers
   - Desired: Must successfully detect ANTHROPIC_API_KEY and initialize anthropic provider
   - **Gap**: Provider state initialization happens during first `Provider.getModel()` call. If this fails, ProviderInitError is thrown
   - **Investigation**: Need to trace why anthropic provider fails despite ANTHROPIC_API_KEY being present

6. **SDK Loading** (`repos/metabob-opencode/packages/opencode/src/provider/provider.ts:486`)
   - Current: Dynamically loads SDK via `BunProc.install()` or preloaded SDK
   - Desired: SDK initialization must succeed
   - **Gap**: SDK initialization fails (caught at line 560, wrapped as ProviderInitError at line 575)
   - **Investigation**: Check (1) BunProc.install() can write to cache, (2) SDK module loads, (3) apiKey passed correctly

7. **Package Installation** (`repos/metabob-opencode/packages/opencode/src/bun/index.ts:60`)
   - Current: Installs npm packages to `Global.Path.cache` using `bun add`
   - Desired: Must successfully install `@ai-sdk/anthropic` package
   - **Gap**: POTENTIAL ROOT CAUSE - Cache directory might not be writable
   - **Investigation**: Check if `/root/.cache/opencode` is writable in DevBob pod

8. **Cache Directory** (`repos/metabob-opencode/packages/opencode/src/global/index.ts:8`)
   - Current: Uses xdg-basedir to determine cache path (`/root/.cache/opencode`)
   - Desired: Cache directory must be writable
   - **Gap**: POTENTIAL ROOT CAUSE - Directory might be read-only or not initialized
   - **Investigation**: Verify (1) Directory exists and writable, (2) xdg-basedir works in container, (3) No volume mount conflicts

9. **Config Loading** (`repos/metabob-opencode/packages/opencode/src/config/config.ts:32`)
   - Current: Complex merge logic (global → custom → workspace → .opencode)
   - Desired: Config should not block provider init, env var takes precedence
   - **Gap**: Malformed config could override environment variable
   - **Investigation**: Check config merge order and `.opencode/opencode.json` content

10. **Config File Creation** (`configs/devbob-entrypoint.sh:422`)
    - Current: Creates `.opencode/opencode.json` with apiKey from ANTHROPIC_API_KEY
    - Desired: Config file provides apiKey to provider
    - **Gap**: VALIDATION NEEDED - File might be malformed or unreadable
    - **Investigation**: Check JSON syntax and apiKey substitution

## Data Flow

```
opencode run 
  → bootstrap() 
  → Instance.provide() 
  → InstanceBootstrap() 
  → [lazy] Provider.state() 
  → Provider.getModel() 
  → Provider.getSDK() 
  → BunProc.install() 
  → fs.mkdir(Global.Path.cache) 
  → ❌ FAILURE
```

## Root Cause Hypotheses (Prioritized)

### 🔴 HIGH Priority

1. **Cache Directory Not Writable**
   - Evidence: `BunProc.install()` requires write access to `/root/.cache/opencode`
   - Validation: `ls -la /root/.cache && touch /root/.cache/opencode/test.txt`
   - Fix: Mount writable volume or change cache location

2. **Environment Variable Not Accessible**
   - Evidence: `Provider.state()` at line 351 checks `process.env` for apiKey
   - Validation: Add debug logging to print `process.env.ANTHROPIC_API_KEY`
   - Fix: Ensure env var is properly exported before opencode runs

### 🟡 MEDIUM Priority

3. **Config File Overrides Environment**
   - Evidence: Complex merge logic could override env var
   - Validation: Check `.opencode/opencode.json` content
   - Fix: Fix config merge order or validate config syntax

4. **Network Access Blocked**
   - Evidence: `bun add` requires npm registry access
   - Validation: `curl -I https://registry.npmjs.org`
   - Fix: Configure network policy or use internal registry

### 🟢 LOW Priority

5. **SDK Module Load Failure**
   - Evidence: Dynamic import might fail
   - Validation: Check if package installed: `ls -la /root/.cache/opencode/node_modules/@ai-sdk/anthropic`
   - Fix: Debug module resolution or preload SDK

## Debugging Steps

### Step 1: Verify Cache Directory Permissions ⚡
```bash
docker exec devbob-pod bash -c 'ls -la /root/.cache && mkdir -p /root/.cache/opencode/test && echo success'
```
Expected: `success`  
On Failure: Cache is read-only → Mount writable volume

### Step 2: Verify Environment Variable ⚡
```bash
docker exec devbob-pod bash -c 'env | grep ANTHROPIC_API_KEY'
```
Expected: `ANTHROPIC_API_KEY=sk-...`  
On Failure: Env var not set → Check .env.devbob and entrypoint.sh

### Step 3: Check Config File
```bash
docker exec devbob-pod bash -c 'cat /workspace/.opencode/opencode.json | jq .provider.anthropic'
```
Expected: Valid JSON with apiKey field  
On Failure: Config malformed → Regenerate in entrypoint.sh

### Step 4: Test Network Connectivity
```bash
docker exec devbob-pod bash -c 'curl -I https://registry.npmjs.org'
```
Expected: `HTTP/2 200`  
On Failure: Network blocked → Configure network policy

### Step 5: Add Debug Logging
Patch `provider.ts:351`:
```typescript
log.debug('checking env for provider', { 
  providerID, 
  envVars: provider.env, 
  apiKey: apiKey?.slice(0, 10) 
})
```

### Step 6: Run with Full Logging
```bash
docker exec devbob-pod bash -c 'LOG_LEVEL=debug opencode run "echo test" 2>&1 | grep -A 10 "provider"'
```

## Related Files

- Provider initialization: `repos/metabob-opencode/packages/opencode/src/provider/provider.ts`
- Package installation: `repos/metabob-opencode/packages/opencode/src/bun/index.ts`
- Global paths: `repos/metabob-opencode/packages/opencode/src/global/index.ts`
- Config loading: `repos/metabob-opencode/packages/opencode/src/config/config.ts`
- DevBob entrypoint: `configs/devbob-entrypoint.sh`
- CLI run command: `repos/metabob-opencode/packages/opencode/src/cli/cmd/run.ts`

## Impulse Reference

This trace analysis is stored as impulse: `trace-devbob-provider-initialization`
- File: `impulses/trace-devbob-provider-initialization.json`
- Budget: 5000 tokens
- Type: templateDefinition
- Purpose: Feed downstream validation and enforcement tasks

## Next Steps

1. Execute debugging steps 1-2 (HIGH priority hypotheses)
2. Based on findings, create enforcement plan
3. Validate fix with `opencode run` test
4. Document resolution in this trace file
