# Trace: Vessel Self-Configuration System

**Specification**: The OpenCode vessel must automatically configure itself and Metabob on container startup. It should detect the environment (dev/staging/prod), validate connectivity, configure appropriate settings (baseUrl, token budgets, feature flags), create backups, and provide tools to safely load and alter configuration.

**Trace Date**: 2026-02-27

**Status**: ✅ **FULLY IMPLEMENTED** - All components exist and match specification exactly

---

## Component Analysis

### 1. docker/entrypoint-self-config.sh (Lines 1-180)
**Role**: Container startup orchestrator

**Current Behavior**:
- Runs on container startup as ENTRYPOINT
- Detects environment from hostname patterns (dev/staging/prod) with default to development
- Validates backend connectivity using Python urllib with retries (30 attempts, 2s delay)
- Validates ANTHROPIC_API_KEY is set (exits with error if missing)
- Executes `configure-vessel-for-environment` activity if SKIP_CONFIG=false and BACKEND_READY=true
- Starts OpenCode ACP server with `exec opencode acp --port 3000 --hostname 0.0.0.0`

**Gap**: ✅ NONE - implementation matches specification perfectly

---

### 2. .metabob/activities/configure-vessel-for-environment.json (Lines 1-320)
**Role**: Activity template for environment-aware configuration

**Current Behavior**: 5-task workflow
1. **detect-environment**: Analyzes hostname, env vars, container status, existing config → outputs JSON with environment + confidence + signals. Supports `force_environment` override
2. **load-and-backup-config**: Loads opencode.json (or creates from template), creates backup to .backup file
3. **calculate-environment-settings**: Computes environment-specific values:
   - Development: localhost:8000, 200k budget, 50k tokens, debug mode
   - Staging: staging.metabob.com, 100k budget, 25k tokens, info logs
   - Production: api.metabob.com, 50k budget, 10k tokens, warn logs
   - Supports overrides: `metabob_base_url`, `token_budget_multiplier`, `enable_verbose_logging`
4. **apply-and-validate-config**: Uses ConfigManager to apply settings with validation, optional connectivity test (2 retries, 5s delay), auto-rollback on error
5. **generate-configuration-report**: Creates config-report.json + console summary

**Gap**: ✅ NONE - template implements all required tasks with proper validation, backup, and reporting

---

### 3. repos/metabob-opencode/packages/opencode/src/config/self-modify.ts (Lines 1-221)
**Role**: Safe configuration management API

**Current Behavior**:
- `getCurrentConfig()`: Reads current config from Config.state()
- `updateConfig(updates, options)`: Deep merge + validation + backup + atomic write + audit logging + auto-rollback on error
- `addMCPServer(name, config, options)`: Dynamically add MCP servers
- `updateBackendUrl(url, options)`: Update Metabob backend URL
- `setFeatureFlag(flag, enabled, options)`: Enable/disable feature flags
- `rollback()`: Restore most recent backup

**Safety Mechanisms**:
- Creates timestamped backups in `.opencode/` directory
- Keeps MAX_BACKUPS=5, cleans old backups automatically
- Writes audit log to `/workspace/.config-changes.log`
- Uses atomic writes (write to .tmp, then rename)
- Validates with `ConfigValidation.validateAll()` before applying
- Auto-rollback on any error during update

**Gap**: ✅ NONE - provides all required safety mechanisms

---

### 4. repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts (Lines 1-850)
**Role**: First-start vessel initialization (complementary to self-config)

**Current Behavior**: Orchestrates bootstrap process:
1. Check if already bootstrapped via `.bootstrapped` marker
2. Detect workspace environment (clean/mounted-codebase/cloned-repo) + git state + capabilities
3. Register vessel with backend (3 retries with exponential backoff: 1s, 2s, 4s)
4. Register in SurrealDB vessel_registry (non-fatal if fails)
5. Fetch config from backend
6. Apply config using ConfigManager
7. Health check backend endpoint
8. Create `.bootstrapped` marker file

**Gap**: ✅ NONE - bootstrap handles backend registration + config fetch, while configure-vessel-for-environment handles environment-specific settings + safe updates. They are complementary.

---

### 5. repos/metabob-opencode/packages/opencode/src/vessel/update.ts (Lines 1-993)
**Role**: Vessel binary version management

**Current Behavior**:
- `getCurrentVersions()`: Reads `/workspace/.vessel-versions.json` tracking file
- `checkUpdates(vessel, source)`: Queries GitHub/registry/local for newer versions
- `updateVessel(vessel, targetVersion, options)`: Downloads + verifies checksum + backs up + installs + updates tracking. Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- `rollback(vessel)`: Restores from `.prev` backup
- `reloadVessel(vessel)`: Sends SIGUSR1 to opencode ACP process for graceful restart

**Tracking Format**: VersionTracking with current versions + update history

**Gap**: ✅ NONE - provides tools for safely updating vessel versions at runtime

---

### 6. docker/Dockerfile.devbob (Lines 1-146)
**Role**: Container image definition

**Current Behavior**: Multi-stage build
1. **metabob-cli-builder**: Installs Python dependencies in venv at `/opt/metabob-cli/.venv`
2. **opencode-binary**: Copies pre-built standalone binary from `repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode`
3. **runtime** (default):
   - Combines metabob-cli venv + opencode binary
   - Pre-installs OpenCode plugins via Bun
   - Copies `docker/entrypoint-self-config.sh` to `/usr/local/bin/entrypoint.sh`
   - Sets `ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]`
   - Sets `CMD ["acp", "--port", "3000", "--hostname", "0.0.0.0"]`

**Gap**: ✅ NONE - Dockerfile correctly wires entrypoint as ENTRYPOINT

---

### 7. repos/metabob-opencode/packages/opencode/src/cli/cmd/debug/config.ts (Lines 1-16)
**Role**: CLI command to display config (read-only)

**Current Behavior**:
- Simple command: `opencode debug config`
- Reads `Config.get()` and outputs JSON to stdout
- Read-only inspection only (NOT for updates)

**Gap**: ✅ NONE - provides read-only tool to view config. Updates done via ConfigManager API or configure-vessel-for-environment activity.

---

## Data Flow

**Entry**: Container startup → entrypoint-self-config.sh

**Steps**:
1. entrypoint-self-config.sh detects environment from hostname/env vars
2. entrypoint-self-config.sh validates backend connectivity (Python urllib, 30 retries, 2s delay)
3. entrypoint-self-config.sh validates ANTHROPIC_API_KEY is set (exit 1 if missing)
4. If SKIP_CONFIG=false and BACKEND_READY=true: execute configure-vessel-for-environment activity
5. Activity task 1: Detect environment → outputs JSON with environment + confidence + signals
6. Activity task 2: Load config from opencode.json (or create from template) + backup to .backup
7. Activity task 3: Calculate environment-specific settings (baseUrl, budgets, flags, timeouts)
8. Activity task 4: Apply settings via ConfigManager.updateConfig() → deep merge + validate + atomic write + audit log
9. ConfigManager creates timestamped backup in .opencode/, validates with ConfigValidation, writes atomically (.tmp → rename)
10. Activity task 4: Optional connectivity test (GET base_url/health, 2 retries, 5s delay)
11. Activity task 4: On error, ConfigManager.rollback() restores from backup
12. Activity task 5: Generate config-report.json + console summary
13. entrypoint-self-config.sh displays configuration summary
14. entrypoint-self-config.sh starts OpenCode ACP server with `exec opencode acp --port 3000 --hostname 0.0.0.0`

**Exit**: OpenCode ACP server running with environment-appropriate configuration

---

## Safe Configuration Tools

### ConfigManager API (TypeScript)
```typescript
// Safe config updates with backup + validation + atomic write + auto-rollback
await ConfigManager.updateConfig(
  { metabob: { base_url: 'http://new-url' } },
  { reason: 'Environment switch' }
)

// Add MCP server dynamically
await ConfigManager.addMCPServer(
  'myserver',
  { type: 'remote', url: '...' },
  { reason: 'Add server' }
)

// Update backend URL
await ConfigManager.updateBackendUrl(
  'http://staging.metabob.com',
  { reason: 'Switch to staging' }
)

// Set feature flag
await ConfigManager.setFeatureFlag(
  'debugMode',
  true,
  { reason: 'Enable debug' }
)

// Rollback to previous backup
await ConfigManager.rollback()
```

### VesselUpdateManager API (TypeScript)
```typescript
// Update vessel binary with checksum verification + backup + retry + rollback
await VesselUpdateManager.updateVessel(
  'opencode',
  '1.3.0',
  { retryCount: 3 }
)

// Rollback to previous vessel version
await VesselUpdateManager.rollback('opencode')

// Check for available updates
const updates = await VesselUpdateManager.checkUpdates('opencode')
```

### CLI Commands
```bash
# View current config (read-only)
opencode debug config

# Execute full environment-aware configuration
opencode activity execute configure-vessel-for-environment \
  --variable force_environment=staging \
  --variable config_path=/workspace/opencode.json \
  --reason 'Manual reconfiguration'
```

---

## Verification Evidence

✅ **Container startup triggers entrypoint-self-config.sh** (Dockerfile ENTRYPOINT at line 122)

✅ **Script detects environment** from hostname/env vars with defaults (entrypoint lines 46-63)

✅ **Script validates backend connectivity** with retries (30 attempts, 2s delay, Python urllib) (entrypoint lines 68-104)

✅ **Script validates ANTHROPIC_API_KEY** is set (exits on failure) (entrypoint lines 109-117)

✅ **Script runs configure-vessel-for-environment** activity if SKIP_CONFIG=false (entrypoint lines 128-152)

✅ **Activity creates opencode.json if missing** (task 2 with template) (activity task 2 prompt template)

✅ **Activity backs up existing config** (task 2 to .backup, ConfigManager to .opencode/) (activity task 2 + ConfigManager backupConfig)

✅ **Activity calculates environment-specific settings** (task 3 with dev/staging/prod defaults) (activity task 3 prompt template)

✅ **Activity applies settings using ConfigManager** (task 4 with deep merge + validation) (activity task 4 → ConfigManager.updateConfig)

✅ **Activity validates connectivity** to Metabob backend (task 4 optional with 2 retries) (activity task 4 connectivity test)

✅ **Activity generates configuration report** (task 5 JSON + console) (activity task 5)

✅ **Container starts OpenCode ACP server** after config (entrypoint exec at line 179)

✅ **ConfigManager provides safe update tools** (updateConfig, addMCPServer, updateBackendUrl, setFeatureFlag) (self-modify.ts exports)

✅ **ConfigManager provides backup/rollback** (timestamped backups, max 5, atomic writes) (self-modify.ts backupConfig + rollback)

✅ **VesselUpdateManager provides version management** (update, rollback, checksum verification) (update.ts exports)

---

## Gaps Identified

**NONE** - The system is fully implemented and matches the specification exactly.

---

## Recommendations

1. ✅ **System is production-ready** - No changes required
2. Consider adding integration tests for entrypoint-self-config.sh → configure-vessel-for-environment flow
3. Consider documenting ConfigManager API in user-facing docs for advanced users
4. Consider adding `opencode vessel update <version>` CLI command as convenience wrapper for VesselUpdateManager

---

## Related Specifications

- **Boredom Activity Detection System**: Uses configure-vessel-for-environment as a boredom activity
- **Activity Template Execution**: Used to run configure-vessel-for-environment
- **Bootstrap System**: BootstrapManager handles first-start registration, complementary to self-config

---

## Conclusion

The Vessel Self-Configuration System is **FULLY IMPLEMENTED** and ready for production use. All components exist, are properly connected, and provide the required functionality with robust error handling, backup/rollback capabilities, and safe configuration management.

The system successfully:
- Detects environment automatically on startup
- Validates connectivity with retries
- Ensures required credentials are present
- Applies environment-specific configuration safely
- Provides tools for runtime configuration updates
- Supports vessel binary updates with rollback
- Creates backups and audit trails
- Handles errors gracefully with automatic rollback
