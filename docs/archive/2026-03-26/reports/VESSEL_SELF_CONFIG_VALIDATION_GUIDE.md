# Vessel Self-Configuration Validation Guide

## How to Validate the Condition is Met

**Condition**: "The OpenCode vessel automatically configures itself and Metabob on startup and has tools to safely load and alter its configuration and version."

---

## 3-Level Validation Strategy

### Level 1: ✅ Static Analysis (AUTOMATED - DONE)

**What it validates**: Code structure, component existence, API completeness

**How to run**:
```bash
npx ts-node --esm tests/validation-harnesses/vessel-self-configuration-harness.ts
```

**What it checks** (10 tests):
1. ✅ Entrypoint script exists with correct logic
2. ✅ Activity template exists with 5 tasks
3. ✅ ConfigManager has all required functions
4. ✅ VesselUpdateManager has safe update mechanisms
5. ✅ BootstrapManager exists and complements self-config
6. ✅ Dockerfile wires entrypoint correctly
7. ✅ CLI debug command exists
8. ✅ Activity template has proper variables
9. ✅ Activity tasks have correct dependencies
10. ✅ All components are integrated (entrypoint → activity → ConfigManager)

**Current status**: ✅ 10/10 tests passing

**Limitations**: 
- Does NOT actually run the container
- Does NOT test runtime behavior
- Only validates code structure

---

### Level 2: 🔄 Integration Testing (RUNTIME - RECOMMENDED)

**What it validates**: Actual container startup, runtime configuration, real behavior

**How to run**:
```bash
# Quick test with dev environment
./tests/integration/test-vessel-self-config-runtime.sh dev

# Test with staging environment
./tests/integration/test-vessel-self-config-runtime.sh staging

# Test with production environment
./tests/integration/test-vessel-self-config-runtime.sh prod
```

**What it validates** (13 runtime tests):

#### Phase 1: Container Build
1. ✅ Container image builds successfully

#### Phase 2: Container Startup
2. ✅ Container starts without errors

#### Phase 3: Startup Log Validation
3. ✅ Environment detection occurs (dev/staging/prod)
4. ✅ Backend connectivity validated (with retries)
5. ✅ ANTHROPIC_API_KEY validation executed
6. ✅ Activity execution detected in logs
7. ✅ ACP server starts successfully

#### Phase 4: Configuration Validation
8. ✅ opencode.json created automatically
9. ✅ Config contains backend URL
10. ✅ Config contains token budget settings

#### Phase 5: Backup Validation
11. ✅ Config backup created in .opencode/ directory

#### Phase 6: Update Tools Validation
12. ✅ ConfigManager tools available in container
13. ✅ VesselUpdateManager tools available in container

**Expected outcome**: All 13 tests pass, confirming runtime self-configuration

**Test results location**: `tests/test-results/vessel-self-config-runtime-results.json`

---

### Level 3: 🎯 Manual E2E Validation (COMPREHENSIVE - RECOMMENDED FOR CRITICAL DEPLOYMENTS)

**What it validates**: Full end-to-end flow with human verification

#### Step 1: Build and Start Container
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Build the image
docker build -f docker/Dockerfile.devbob -t devbob:self-config-test .

# Start container (with clean state - no existing config)
docker run -d \
  --name devbob-self-config-test \
  --hostname devbob-dev-test \
  -e "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
  -e "METABOB_API_URL=http://host.docker.internal:8000" \
  -e "SKIP_CONFIG=false" \
  -e "FORCE_ENVIRONMENT=dev" \
  -p 3100:3000 \
  devbob:self-config-test
```

#### Step 2: Monitor Startup Logs
```bash
# Watch logs in real-time
docker logs -f devbob-self-config-test
```

**Expected log sequence**:
```
[STARTUP] Starting OpenCode vessel...
[ENV] Detected environment: dev
[CONNECTIVITY] Validating backend connectivity...
[CONNECTIVITY] Backend reachable at http://host.docker.internal:8000
[API_KEY] ANTHROPIC_API_KEY validation: OK
[ACTIVITY] Executing configure-vessel-for-environment activity...
[ACTIVITY] Task 1/5: Detect environment - COMPLETE
[ACTIVITY] Task 2/5: Load/backup config - COMPLETE
[ACTIVITY] Task 3/5: Calculate settings - COMPLETE
[ACTIVITY] Task 4/5: Apply settings - COMPLETE
[ACTIVITY] Task 5/5: Generate report - COMPLETE
[CONFIG] Configuration applied successfully
[ACP] Starting OpenCode ACP server on port 3000...
[ACP] Server listening on 0.0.0.0:3000
```

#### Step 3: Verify Configuration Created
```bash
# Check opencode.json was created
docker exec devbob-self-config-test cat /workspace/opencode.json | jq .

# Expected output: Valid JSON with metabob.backend.baseUrl, session.maxTokens, etc.
```

**Expected config structure**:
```json
{
  "metabob": {
    "backend": {
      "baseUrl": "http://host.docker.internal:8000",
      "enabled": true
    }
  },
  "session": {
    "maxTokens": 200000,
    "maxInputTokens": 150000,
    "maxOutputTokens": 50000
  },
  "features": {
    "metabobIntegration": true,
    "activityTemplates": true
  }
}
```

#### Step 4: Verify Backup Created
```bash
# Check backup directory
docker exec devbob-self-config-test ls -la /workspace/.opencode/

# Expected: timestamped backup files
```

**Expected output**:
```
drwxr-xr-x  2 root root   64 Feb 27 01:00 .
drwxr-xr-x 10 root root 4096 Feb 27 01:00 ..
-rw-r--r--  1 root root 1234 Feb 27 01:00 opencode.json.1709006400.backup
-rw-r--r--  1 root root 1234 Feb 27 01:00 opencode.json.backup
```

#### Step 5: Test Safe Configuration Update
```bash
# Enter container
docker exec -it devbob-self-config-test bash

# Inside container, test ConfigManager
cd /workspace
node -e "
  const { ConfigManager } = require('./repos/metabob-opencode/packages/opencode/src/config/self-modify.js');
  const manager = new ConfigManager('/workspace/opencode.json');
  
  // Test 1: Update backend URL safely
  manager.updateBackendUrl('http://new-backend:8000');
  
  // Test 2: Set feature flag
  manager.setFeatureFlag('testFeature', true);
  
  // Test 3: Verify changes persisted
  const config = manager.getCurrentConfig();
  console.log('Updated config:', JSON.stringify(config, null, 2));
"
```

**Expected**: 
- ✅ No errors during update
- ✅ Config changes persisted
- ✅ Backup created before update
- ✅ Validation passed before write

#### Step 6: Test Rollback Mechanism
```bash
# Inside container, test rollback
node -e "
  const { ConfigManager } = require('./repos/metabob-opencode/packages/opencode/src/config/self-modify.js');
  const manager = new ConfigManager('/workspace/opencode.json');
  
  // Test rollback to previous config
  const success = manager.rollback();
  console.log('Rollback successful:', success);
  
  // Verify config reverted
  const config = manager.getCurrentConfig();
  console.log('Reverted config:', JSON.stringify(config, null, 2));
"
```

**Expected**: 
- ✅ Rollback succeeds
- ✅ Config reverted to previous state

#### Step 7: Test Version Update (VesselUpdateManager)
```bash
# Inside container, test version management
node -e "
  const { VesselUpdateManager } = require('./repos/metabob-opencode/packages/opencode/src/vessel/update.js');
  const manager = new VesselUpdateManager();
  
  // Test 1: Get current versions
  const versions = manager.getCurrentVersions();
  console.log('Current versions:', versions);
  
  // Test 2: Check for updates (dry run)
  const updates = manager.checkUpdates();
  console.log('Available updates:', updates);
"
```

**Expected**: 
- ✅ Current version retrieved
- ✅ Update check works (even if no updates available)

#### Step 8: Verify ACP Server Responding
```bash
# From host machine, test ACP server
curl -X POST http://localhost:3100/health

# Expected: 200 OK with health status
```

#### Step 9: Test Environment Change Handling
```bash
# Restart container with different environment
docker stop devbob-self-config-test
docker rm devbob-self-config-test

docker run -d \
  --name devbob-self-config-test \
  --hostname devbob-staging-test \
  -e "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
  -e "METABOB_API_URL=http://staging-backend:8000" \
  -e "SKIP_CONFIG=false" \
  -e "FORCE_ENVIRONMENT=staging" \
  -p 3100:3000 \
  devbob:self-config-test

# Check logs for staging configuration
docker logs devbob-self-config-test | grep -i staging
```

**Expected**: 
- ✅ Detects environment as "staging"
- ✅ Applies staging-specific settings (higher budgets, different URL)

#### Step 10: Cleanup
```bash
docker stop devbob-self-config-test
docker rm devbob-self-config-test
docker rmi devbob:self-config-test
```

---

## Validation Success Criteria

### ✅ Condition is MET if:

1. **Static Analysis** (Level 1):
   - ✅ 10/10 automated tests pass
   - ✅ All components exist with correct structure

2. **Runtime Integration** (Level 2):
   - ✅ Container builds successfully
   - ✅ Container starts without errors
   - ✅ Environment detection works
   - ✅ Backend connectivity validated (with retries)
   - ✅ ANTHROPIC_API_KEY checked
   - ✅ Activity executes automatically
   - ✅ opencode.json created with correct settings
   - ✅ Backup created before changes
   - ✅ ACP server starts and responds
   - ✅ ConfigManager tools available
   - ✅ VesselUpdateManager tools available

3. **Manual E2E** (Level 3):
   - ✅ Full startup flow works end-to-end
   - ✅ Configuration updates work safely
   - ✅ Rollback mechanism works
   - ✅ Version management works
   - ✅ Environment changes handled correctly
   - ✅ No manual intervention required

---

## Current Validation Status

| Level | Status | Tests | Pass Rate | Notes |
|-------|--------|-------|-----------|-------|
| **Level 1: Static** | ✅ COMPLETE | 10 | 100% | All components validated |
| **Level 2: Runtime** | 🔄 READY | 13 | TBD | Script created, ready to run |
| **Level 3: Manual E2E** | 📋 DOCUMENTED | 10 steps | TBD | Guide provided above |

---

## Quick Validation Commands

### Run All Automated Tests
```bash
# Level 1: Static analysis
npx ts-node --esm tests/validation-harnesses/vessel-self-configuration-harness.ts

# Level 2: Runtime integration
./tests/integration/test-vessel-self-config-runtime.sh dev
```

### One-Line Full Validation
```bash
# Run both levels sequentially
npx ts-node --esm tests/validation-harnesses/vessel-self-configuration-harness.ts && \
./tests/integration/test-vessel-self-config-runtime.sh dev && \
echo "✅ All validation tests passed!"
```

---

## Troubleshooting Validation Failures

### If Static Tests Fail:
1. Check that all components exist in correct locations
2. Verify file permissions (entrypoint should be executable)
3. Re-run trace-enforce-validate-loop activity

### If Runtime Tests Fail:
1. Check Docker is installed and running
2. Verify ANTHROPIC_API_KEY is set
3. Verify Metabob backend is accessible
4. Check container logs: `docker logs <container-name>`
5. Verify network connectivity to backend

### If E2E Manual Tests Fail:
1. Review startup logs for specific errors
2. Check backend connectivity manually
3. Verify environment variables are set correctly
4. Test ConfigManager functions in isolation
5. Check file permissions in container

---

## Validation Frequency

**Recommended validation schedule**:
- **Static tests**: Every code change (CI/CD pipeline)
- **Runtime tests**: Before every deployment
- **Manual E2E**: 
  - Before major releases
  - After significant infrastructure changes
  - When debugging issues

---

## Conclusion

The condition **"vessel automatically configures itself and has safe configuration tools"** is validated through:

1. ✅ **Static analysis** confirms all components exist
2. 🔄 **Runtime integration** tests actual container behavior (script ready)
3. 📋 **Manual E2E** provides comprehensive human verification (guide provided)

**Current Status**: Level 1 complete (10/10 pass), Level 2 ready to run, Level 3 documented.

**Next Step**: Run Level 2 runtime integration tests to confirm container behavior:
```bash
./tests/integration/test-vessel-self-config-runtime.sh dev
```
