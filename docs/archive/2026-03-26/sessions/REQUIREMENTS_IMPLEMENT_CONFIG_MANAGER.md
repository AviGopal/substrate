# Activity Requirements: Implement Config Manager

## Overview

This activity implements ConfigManager in metabob-opencode, enabling vessels (devbob containers) to dynamically self-modify their opencode.json configuration files. This is Phase 1, Task 2 of the DevBob Vessel Architecture (see DEVBOB_VESSEL_ARCHITECTURE.md), building on VesselUpdateManager (Task 1, completed) and preparing for BootstrapManager (Task 3).

**Architecture Context**:
```
Phase 1: Foundation (Self-Management Capabilities)
├── Task 1: VesselUpdateManager ✅ (Complete - vessels can update binaries)
├── Task 2: ConfigManager 🎯 (THIS ACTIVITY - vessels can modify config)
└── Task 3: BootstrapManager ⏳ (Next - first-start initialization)
```

**Purpose**: Enable vessels to adapt their configuration based on environment, workload, and runtime conditions. This is critical for autonomous vessel operation, allowing containers to optimize themselves during boredom activities or respond to environment changes.

**Key Capabilities**:
1. **updateConfig()**: Safe config modification with automatic backup
2. **addMCPServer()**: Dynamic MCP server registration
3. **updateBackendUrl()**: Environment switching (dev/staging/prod)
4. **setFeatureFlag()**: Feature toggle management
5. **Validation & Rollback**: Config validation before write, rollback on error
6. **Audit Trail**: All changes logged in .config-changes.log

**Architecture Alignment**: 
- Follows design in DEVBOB_VESSEL_ARCHITECTURE.md section "Config Self-Modification" (lines 253-316)
- Part of composable activity workflow (VesselUpdateManager → ConfigManager → BootstrapManager)
- Enables boredom activities like "optimize-config-for-workload" and "configure-vessel-for-environment"

## Workflow Steps

1. **Create ConfigManager Module** (Dependencies: none)
   - Create `repos/metabob-opencode/packages/opencode/src/config/self-modify.ts`
   - Implement ConfigManager class with core methods
   - Integrate with existing Config.state singleton
   - Add TypeScript types and interfaces

2. **Implement Core Configuration Methods** (Dependencies: Step 1)
   - `getCurrentConfig()`: Read current config via Config.state
   - `updateConfig()`: Deep merge with validation and backup
   - `addMCPServer()`: Add MCP server to config.mcp section
   - `updateBackendUrl()`: Update config.metabob.base_url
   - `setFeatureFlag()`: Toggle feature flags in config

3. **Add Backup and Rollback System** (Dependencies: Step 2)
   - Create `.opencode/opencode.json.backup` before each modification
   - Implement atomic write (write to .tmp, then rename)
   - Add rollback() method to restore from backup
   - Track backup history (last 5 backups with timestamps)

4. **Implement Validation and Safety Checks** (Dependencies: Step 3)
   - Validate config after merge using ConfigValidation.validateAll()
   - Prevent invalid configs from being written
   - Test config reload after modification
   - Add schema validation for complex structures (MCP servers)

5. **Add Audit Trail Logging** (Dependencies: Step 4)
   - Create `/workspace/.config-changes.log` for audit trail
   - Log: timestamp, vessel_id, change type, old value, new value, reason
   - Include rollback events in log
   - Add log rotation (keep last 1000 entries)

6. **Create Integration Tests** (Dependencies: Step 5)
   - Test updateConfig() with valid and invalid inputs
   - Test backup/restore cycle
   - Test MCP server addition
   - Test config reload after modification
   - Test rollback on validation failure

7. **Update Documentation** (Dependencies: Step 6)
   - Add usage examples to CONFIG_SELF_MODIFICATION.md
   - Document safety mechanisms (backup, validation, rollback)
   - Add API reference for ConfigManager methods
   - Include troubleshooting guide

## Input Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| opencodePath | string | no | repos/metabob-opencode | Path to metabob-opencode repository |
| workspaceDir | string | no | /workspace | Workspace directory for vessel (container-specific) |
| enableAuditLog | boolean | no | true | Enable audit trail logging |
| maxBackups | number | no | 5 | Number of config backups to retain |
| validateBeforeWrite | boolean | no | true | Validate config before writing (safety check) |

## Expected Outputs

**Created Files**:
- `repos/metabob-opencode/packages/opencode/src/config/self-modify.ts` - ConfigManager implementation (~300 lines)
- `repos/metabob-opencode/packages/opencode/src/config/self-modify.test.ts` - Integration tests (~200 lines)
- `docs/CONFIG_SELF_MODIFICATION.md` - Usage documentation and examples
- `/workspace/.config-changes.log` - Audit trail (created at runtime)
- `/workspace/.opencode/opencode.json.backup` - Config backup (created at runtime)

**Modified Files**:
- `repos/metabob-opencode/packages/opencode/src/config/index.ts` - Export ConfigManager
- `repos/metabob-opencode/packages/opencode/src/index.ts` - Export ConfigManager in public API
- `docs/DEVBOB_VESSEL_ARCHITECTURE.md` - Mark Task 2 as complete

**State Changes**:
- Vessels can now modify their own opencode.json safely
- Config changes are auditable (log file)
- Config modifications are reversible (backup/rollback)
- Boredom activities can optimize config dynamically

**Report**: 
- Summary of ConfigManager capabilities
- Test results (all tests passing)
- Example usage snippets
- Next steps (BootstrapManager integration)

## Validation Criteria

### Per-Task Validation

**Task 1: Create ConfigManager Module**
- File `src/config/self-modify.ts` exists
- ConfigManager class exported
- Integrates with Config.state singleton
- TypeScript compiles without errors

**Task 2: Implement Core Methods**
- `getCurrentConfig()` returns current Config.Info
- `updateConfig()` performs deep merge correctly
- `addMCPServer()` adds server to config.mcp
- `updateBackendUrl()` modifies config.metabob.base_url
- `setFeatureFlag()` toggles feature flags
- All methods return Promise<void> (async)

**Task 3: Backup and Rollback**
- Backup created before each modification (opencode.json.backup)
- Atomic write implemented (write to .tmp, rename)
- `rollback()` method restores from backup
- Backup history tracked (last 5 with timestamps)
- Test: Modify config 10 times, verify only 5 backups retained

**Task 4: Validation and Safety**
- Config validated after merge (ConfigValidation.validateAll())
- Invalid configs rejected (throw error, no write)
- Config.state.reload() called after successful write
- Schema validation for MCP servers (type, url, enabled fields)
- Test: Attempt invalid config, verify rollback

**Task 5: Audit Trail**
- `.config-changes.log` created on first modification
- Log entries include: timestamp, vessel_id, change_type, old_value, new_value, reason
- Rollback events logged with "rollback" type
- Log rotation works (keeps last 1000 entries)
- Test: 1500 modifications, verify only last 1000 in log

**Task 6: Integration Tests**
- Tests pass: `bun test src/config/self-modify.test.ts`
- Coverage >90% for ConfigManager methods
- Tests cover: valid updates, invalid updates, backup/restore, rollback
- Tests use in-memory config (no side effects on host)

**Task 7: Documentation**
- `CONFIG_SELF_MODIFICATION.md` created with usage examples
- API reference complete (all methods documented)
- Safety mechanisms explained (backup, validation, rollback)
- Troubleshooting guide included (common errors, solutions)

### Overall Success Criteria

**Files Exist**:
- `repos/metabob-opencode/packages/opencode/src/config/self-modify.ts`
- `repos/metabob-opencode/packages/opencode/src/config/self-modify.test.ts`
- `docs/CONFIG_SELF_MODIFICATION.md`

**Patterns Present** (grep checks):
```bash
# ConfigManager exported
grep -q "export.*ConfigManager" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts

# Core methods implemented
grep -q "getCurrentConfig" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts
grep -q "updateConfig" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts
grep -q "addMCPServer" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts
grep -q "updateBackendUrl" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts
grep -q "setFeatureFlag" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts
grep -q "rollback" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts

# Backup mechanism
grep -q "opencode.json.backup" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts

# Validation
grep -q "ConfigValidation.validateAll" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts

# Audit trail
grep -q ".config-changes.log" repos/metabob-opencode/packages/opencode/src/config/self-modify.ts
```

**Patterns Absent** (should NOT appear):
- No direct fs.writeFileSync() without backup (must use atomic write)
- No config modifications without validation
- No unhandled promise rejections in async methods

**Commands Pass**:
```bash
# TypeScript compilation
cd repos/metabob-opencode && bun run build

# Tests pass
cd repos/metabob-opencode && bun test src/config/self-modify.test.ts

# Verify exports
grep -q "ConfigManager" repos/metabob-opencode/packages/opencode/src/index.ts
```

## Error Handling

### Common Failures and Solutions

1. **Config Validation Fails After Merge**
   - **Symptom**: `ConfigValidation.validateAll()` throws error after merge
   - **Solution**: Rollback to backup, throw error with validation details
   - **Recovery**: Caller should catch error and retry with valid config
   - **Strategy**: Automatic rollback (no manual intervention needed)

2. **Backup File Write Fails**
   - **Symptom**: Cannot write to `.opencode/opencode.json.backup` (permissions, disk full)
   - **Solution**: Throw error immediately, do not proceed with config modification
   - **Recovery**: Check disk space, verify .opencode/ directory writable
   - **Strategy**: Fail fast (config modifications are dangerous without backup)

3. **Atomic Write Fails (Rename Operation)**
   - **Symptom**: Write to `.tmp` succeeds, but rename to `opencode.json` fails
   - **Solution**: Rollback from backup, log error, throw exception
   - **Recovery**: Check filesystem permissions, verify no file locks
   - **Strategy**: Rollback + error (leave system in consistent state)

4. **Config.state.reload() Fails After Write**
   - **Symptom**: Config written to disk, but reload() throws error (invalid JSON)
   - **Solution**: Rollback from backup, reload() again to restore working state
   - **Recovery**: Check for JSON syntax errors in backup
   - **Strategy**: Double rollback (restore file + reload config)

5. **MCP Server Config Invalid**
   - **Symptom**: `addMCPServer()` called with invalid config (missing url, invalid type)
   - **Solution**: Validate MCP server config before merge, throw error if invalid
   - **Recovery**: Caller should provide valid MCP server config
   - **Strategy**: Pre-validation (catch errors before merge)

6. **Audit Log Rotation Fails**
   - **Symptom**: `.config-changes.log` exceeds 1000 entries, rotation fails
   - **Solution**: Log error, continue without rotation (non-critical)
   - **Recovery**: Manual cleanup of log file (or restart vessel)
   - **Strategy**: Best-effort logging (don't block config modifications)

7. **Concurrent Modification Detected**
   - **Symptom**: Config changed externally while modification in progress
   - **Solution**: Detect via file modification time, abort modification
   - **Recovery**: Retry modification with latest config
   - **Strategy**: Optimistic locking (check mtime before write)

### Retry Strategies

**Should Retry Automatically**:
- Config.state.reload() fails (transient issue) - retry 3 times with 100ms delay
- Audit log write fails (disk busy) - retry 2 times with 50ms delay

**Should NOT Retry (Fail Immediately)**:
- Validation fails (invalid config) - no retry, fix config
- Backup write fails (permissions, disk full) - no retry, fix environment
- Invalid MCP server config - no retry, fix input

### Debug Information

When errors occur, include in error message:
- Current config path (e.g., /workspace/.opencode/opencode.json)
- Backup path (e.g., /workspace/.opencode/opencode.json.backup)
- Validation error details (if validation failed)
- File modification times (to detect concurrent modifications)
- Disk space available (if write failures occur)
- Process ID and vessel ID (for multi-vessel debugging)

## Agent Assignment

- **Task 1-5**: general - TypeScript implementation, file operations
- **Task 6**: general - Test development, integration testing
- **Task 7**: general - Documentation, examples, troubleshooting

## Additional Context

### Integration with VesselUpdateManager

ConfigManager builds on VesselUpdateManager (Task 1):
- VesselUpdateManager updates binaries (opencode, metabob-cli)
- ConfigManager updates configuration (opencode.json)
- Both use similar patterns: backup → modify → validate → rollback on error
- Both log changes to audit trail

**Shared Patterns**:
```typescript
// VesselUpdateManager pattern (Task 1)
async updateVessel(vessel, version) {
  await backup(vessel)           // Step 1: Backup
  await download(vessel, version) // Step 2: Modify
  await verify(vessel)            // Step 3: Validate
  if (failed) await rollback()    // Step 4: Rollback on error
  await logChange()               // Step 5: Audit
}

// ConfigManager pattern (Task 2, THIS ACTIVITY)
async updateConfig(updates) {
  await backup(config)            // Step 1: Backup
  await merge(config, updates)    // Step 2: Modify
  await validate(config)          // Step 3: Validate
  if (failed) await rollback()    // Step 4: Rollback on error
  await logChange()               // Step 5: Audit
}
```

### Usage in Boredom Activities

ConfigManager enables several boredom activities:

**Example 1: Optimize Config for Workload**
```typescript
// Activity: optimize-config-for-workload
// Analyzes recent activity patterns, adjusts token budgets
async function optimizeConfigForWorkload() {
  const recentActivities = await loadRecentActivities()
  const avgTokens = calculateAverageTokens(recentActivities)
  
  await ConfigManager.updateConfig({
    sessionMemory: {
      budgets: {
        total: Math.ceil(avgTokens * 1.5), // 50% buffer
        perImpulse: Math.ceil(avgTokens * 0.3)
      }
    }
  })
}
```

**Example 2: Configure for Environment**
```typescript
// Activity: configure-vessel-for-environment
// Detects environment (dev/staging/prod), adjusts config
async function configureForEnvironment() {
  const env = detectEnvironment() // dev, staging, prod
  
  if (env === "prod") {
    await ConfigManager.updateConfig({
      metabob: {
        base_url: "https://api.metabob.com/prod",
        max_issues: 10,
        min_severity: "HIGH"
      }
    })
    
    await ConfigManager.addMCPServer("prod-monitoring", {
      type: "remote",
      url: "https://monitoring.internal/mcp",
      enabled: true
    })
  }
}
```

**Example 3: Enable Feature Flag**
```typescript
// Activity: enable-experimental-feature
// Enables a feature flag for testing
async function enableExperimentalFeature(featureName: string) {
  await ConfigManager.setFeatureFlag(featureName, true)
  
  // Log to audit trail
  console.log(`Feature ${featureName} enabled for testing`)
}
```

### Design Principles

1. **Safety First**: Always backup before modification
2. **Validation Before Write**: Never write invalid config to disk
3. **Atomic Operations**: Use atomic write (tmp + rename) to prevent partial writes
4. **Audit Everything**: Log all config changes for debugging
5. **Fail Gracefully**: Rollback on error, leave system in consistent state
6. **No Surprises**: Explicit error messages, no silent failures

### Testing Strategy

**Unit Tests** (in-memory, fast):
- Test each method independently
- Mock Config.state and filesystem operations
- Verify backup/rollback logic
- Verify validation catches invalid configs

**Integration Tests** (with real filesystem):
- Test full modification cycle (backup → modify → validate → reload)
- Test rollback after validation failure
- Test concurrent modification detection
- Test audit log creation and rotation

**Manual Tests** (in devbob container):
- Start devbob-clean container
- Call ConfigManager methods via OpenCode CLI
- Verify config changes persist after reload
- Verify backup files created
- Verify audit log entries

### Success Metrics

After implementation:
- ✅ Vessels can modify config without manual intervention
- ✅ All config changes auditable (.config-changes.log)
- ✅ Config modifications reversible (backup/rollback)
- ✅ Zero config corruption (atomic write + validation)
- ✅ Boredom activities can optimize config dynamically
- ✅ Ready for BootstrapManager (Task 3) integration

### Related Files

**To Create**:
- `repos/metabob-opencode/packages/opencode/src/config/self-modify.ts` - ConfigManager implementation
- `repos/metabob-opencode/packages/opencode/src/config/self-modify.test.ts` - Integration tests
- `docs/CONFIG_SELF_MODIFICATION.md` - Usage documentation

**To Modify**:
- `repos/metabob-opencode/packages/opencode/src/config/index.ts` - Export ConfigManager
- `repos/metabob-opencode/packages/opencode/src/index.ts` - Export in public API
- `docs/DEVBOB_VESSEL_ARCHITECTURE.md` - Mark Task 2 complete

**To Reference** (no modifications):
- `repos/metabob-opencode/packages/opencode/src/config/config.ts` - Config.state singleton
- `repos/metabob-opencode/packages/opencode/src/config/validation.ts` - ConfigValidation.validateAll()
- `repos/metabob-opencode/packages/opencode/src/vessel/update.ts` - VesselUpdateManager (Task 1, for pattern reference)

### Constraints

1. **No Breaking Changes**: Existing config loading must continue to work
2. **Backward Compatibility**: Config modifications must not break older OpenCode versions
3. **Performance**: Config updates should complete in <100ms (excluding validation)
4. **Memory**: Keep only last 5 backups (prevent disk bloat)
5. **Concurrency**: Detect concurrent modifications (though rare in single-process containers)

### Risk Mitigation

**High Risk**:
- Config corruption (system won't start) → Atomic write + validation + backup
- Validation too strict (blocks valid configs) → Test with real configs, iterate

**Medium Risk**:
- Backup disk usage (5 backups * 50KB each = 250KB) → Acceptable, add rotation
- Audit log disk usage (1000 entries * 200 bytes = 200KB) → Acceptable, add rotation

**Low Risk**:
- Performance regression (config reload) → Unlikely, Config.state.reload() is fast
- Documentation gaps → Mitigated by examples and troubleshooting guide

### Next Steps (After This Activity)

1. **Test in devbob-clean container**: Verify ConfigManager works in vessel environment
2. **Create boredom activity templates**: `optimize-config-for-workload`, `configure-vessel-for-environment`
3. **Implement BootstrapManager (Task 3)**: Use ConfigManager for first-start configuration
4. **Integration with backend**: Backend can suggest config optimizations via boredom API
