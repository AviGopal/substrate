# Safe Config Self-Modification Specification

**Date:** 2026-02-24  
**Status:** 🎯 Specification (Ready for Enforcement)  
**Pattern:** trace-enforce-validate-loop  
**Principle:** OpenCode must be able to modify its own configuration safely without breaking itself

---

## Problem Statement

OpenCode needs to modify its own configuration (add tools, manage secrets, install plugins, update agents) but doing so unsafely could:
- Break schema validation mid-execution
- Orphan loaded MCP servers
- Corrupt agent definitions
- Create state inconsistency between loaded config and file state
- Render the system unusable

---

## Core Architecture: Two-Phase Commit with Validation Sandbox

### Instructional State (The Plan)
**What** to change, **Why** to change it, **How** to validate it

**Captured via Impulses:**
```typescript
// Impulse 1: Config Change Intent
{
  type: "configChangeIntent",
  operation: "add_tool" | "modify_key" | "add_secret" | "install_plugin" | "update_agent",
  target: "global" | "project" | "agent-specific",
  changes: {
    path: "metabob.max_issues",
    oldValue: 5,
    newValue: 10,
    reason: "User request: increase issue limit for better coverage"
  }
}

// Impulse 2: Current Config Snapshot
{
  type: "configSnapshot",
  configFiles: [
    { path: "~/.opencode/opencode.json", hash: "abc123", precedence: 1 },
    { path: "./opencode.json", hash: "def456", precedence: 2 }
  ],
  loadedState: Config.get(), // Current runtime state
  dependencies: ["mcp.metabob", "agent.config"] // What might break
}

// Impulse 3: Validation Context
{
  type: "configValidationPlan",
  schemaChanges: ["Add field X", "Modify type Y"],
  breakingChanges: [],
  migrationNeeded: false,
  testsToRun: ["config.test.ts", "agent/config.test.ts"]
}
```

### Functional State (The Reality)
**Actual** config files, runtime config, and loaded system components

**Components:**
- **Files:** `opencode.json`, `.opencode/agent/*.md`, etc.
- **Runtime:** `Config.get()` loaded values
- **Dependencies:** MCP servers, agents, loaded tools

---

## Enforcement Requirements

### REQ-1: Validate Before Mutation (CRITICAL)
**Requirement:** ALL config changes MUST be validated in a sandbox tmpdir before touching real config

**Implementation:**
```typescript
// Create isolated sandbox
const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-validation-'));

// Copy config files to tmpdir
await fs.copyFile(realConfigPath, path.join(tmpdir, 'opencode.json'));

// Apply change in sandbox
const sandboxConfig = JSON.parse(await fs.readFile(path.join(tmpdir, 'opencode.json'), 'utf-8'));
applyChange(sandboxConfig, change);
await fs.writeFile(path.join(tmpdir, 'opencode.json'), JSON.stringify(sandboxConfig, null, 2));

// Validate sandbox config
const validationResult = await validateConfig(tmpdir);

// Only proceed if validation passes
if (validationResult.success) {
  // Apply to real config
} else {
  throw new Error(`Validation failed: ${validationResult.errors}`);
}

// Cleanup sandbox
await fs.rm(tmpdir, { recursive: true });
```

**Validation harness:**
```bash
# tests/validation-harnesses/config-schema-validation.sh
cd $TMPDIR
bun run typecheck  # Must pass
bun test test/config/  # Must pass
node -e "require('./opencode.json')"  # Must be valid JSON
```

**Success Criteria:**
- ✅ Config validated in tmpdir BEFORE touching real files
- ✅ Schema validation passes (Zod)
- ✅ Type checking passes (TypeScript)
- ✅ Config tests pass (Bun)
- ✅ JSON is valid and parseable

### REQ-2: Backup Before Mutation (CRITICAL)
**Requirement:** ALL config files MUST be backed up before modification

**Implementation:**
```typescript
// Create timestamped backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `${configFile}.backup-${timestamp}`;

await fs.copyFile(configFile, backupPath);

// Store backup path in impulse for rollback
await impulse_create({
  id: `config-backup-${changeId}`,
  type: "configBackup",
  pointer: {
    type: "memo",
    content: JSON.stringify({
      originalPath: configFile,
      backupPath: backupPath,
      timestamp: Date.now()
    })
  }
});
```

**Success Criteria:**
- ✅ Backup created BEFORE any file modification
- ✅ Backup path stored in impulse
- ✅ Original file unchanged until backup complete
- ✅ Backup is valid copy (checksum matches)

### REQ-3: Graceful Reload or Defer (CRITICAL)
**Requirement:** Config reload MUST be graceful or deferred to prevent breaking active sessions

**Implementation:**
```typescript
// Option 1: Graceful reload (if safe)
if (Config.canReloadSafely()) {
  Config.state.invalidate(); // Clear cache
  await Config.reload();
  console.log("✅ Config reloaded in current session");
} 
// Option 2: Defer to next session (if risky)
else {
  console.log("🔄 Config updated. Changes will apply on next session start.");
  // Write marker file for next session
  await fs.writeFile('.opencode/.config-updated', String(Date.now()));
}
```

**Success Criteria:**
- ✅ If reload safe → reload immediately
- ✅ If reload risky → defer to next session
- ✅ Never force reload mid-operation
- ✅ Never break active MCP servers/agents

### REQ-4: Rollback on Failure (CRITICAL)
**Requirement:** On ANY failure, MUST rollback to backup automatically

**Implementation:**
```typescript
try {
  // Apply change
  await applyConfigChange(configFile, change);
  
  // Verify change
  const verified = await verifyConfigChange(configFile, change);
  
  if (!verified) {
    throw new Error("Verification failed");
  }
  
  // Success - can delete backup after commit
  await fs.rm(backupPath);
  
} catch (error) {
  // ROLLBACK
  console.error("❌ Config change failed, rolling back:", error);
  
  // Restore from backup
  const backupImpulse = await impulse_load(`config-backup-${changeId}`);
  const { backupPath, originalPath } = JSON.parse(backupImpulse.content);
  
  await fs.copyFile(backupPath, originalPath);
  
  console.log("✅ Rolled back to backup:", backupPath);
  
  throw error; // Re-throw for activity to handle
}
```

**Success Criteria:**
- ✅ On validation failure → restore from backup
- ✅ On apply failure → restore from backup
- ✅ On verification failure → restore from backup
- ✅ Backup preserved after rollback for debugging
- ✅ User notified of rollback

### REQ-5: Impact Analysis Before Apply (HIGH)
**Requirement:** MUST analyze impact on MCP servers, agents, and tools before applying

**Implementation:**
```typescript
// Analyze what will be affected
const impact = await analyzeConfigChangeImpact(change);

console.log("📊 Impact Analysis:");
console.log("  MCP Servers to reload:", impact.mcpServers);
console.log("  Agents to reinitialize:", impact.agents);
console.log("  Tools to reload:", impact.tools);
console.log("  Sessions to refresh:", impact.sessions);

// Warn user if high impact
if (impact.mcpServers.length > 0) {
  console.warn("⚠️  MCP servers will be restarted - active connections will be lost");
}

// Store impact in impulse for audit
await impulse_create({
  id: `config-impact-${changeId}`,
  type: "configImpact",
  pointer: { type: "memo", content: JSON.stringify(impact) }
});
```

**Success Criteria:**
- ✅ Impact computed BEFORE applying change
- ✅ MCP server dependencies identified
- ✅ Agent dependencies identified
- ✅ Tool dependencies identified
- ✅ User warned if high impact

### REQ-6: State Transformation Tracking (HIGH)
**Requirement:** MUST track instructional → functional state transformation

**Implementation:**
```typescript
// Capture initial state
const initialState = {
  instructional: {
    intent: change.reason,
    operation: change.operation,
    path: change.path,
    oldValue: change.oldValue,
    newValue: change.newValue
  },
  functional: {
    configFiles: await captureConfigFiles(),
    runtimeConfig: Config.get(),
    loadedMcpServers: MCP.getLoadedServers(),
    activeAgents: Agent.getActiveAgents()
  }
};

// ... apply change ...

// Capture final state
const finalState = {
  functional: {
    configFiles: await captureConfigFiles(),
    runtimeConfig: Config.get(),
    loadedMcpServers: MCP.getLoadedServers(),
    activeAgents: Agent.getActiveAgents()
  }
};

// Compute delta
const delta = computeStateDelta(initialState, finalState);

// Store transformation
await impulse_create({
  id: `config-transformation-${changeId}`,
  type: "configTransformation",
  pointer: {
    type: "memo",
    content: JSON.stringify({
      before: initialState,
      after: finalState,
      delta: delta
    })
  }
});
```

**Success Criteria:**
- ✅ Initial state captured (instructional + functional)
- ✅ Final state captured (functional)
- ✅ Delta computed (what changed)
- ✅ Transformation stored in impulse
- ✅ Audit trail complete

---

## Activity Template: `safe-config-modification`

### Task 1: Capture Current State
**Agent:** config  
**Description:** Snapshot current config state to impulse for rollback

**Prompt:**
```
Capture complete config state: files, runtime values, dependencies. 
Store as impulse 'config-snapshot-{{changeId}}'

Include:
- All config file paths and hashes
- Current runtime config (Config.get())
- Loaded MCP servers (names and states)
- Active agents (names and capabilities)
- Working directory
```

**Validation:** None (read-only)

### Task 2: Validate in Sandbox
**Agent:** config  
**Description:** Test config change in isolated tmpdir before applying

**Prompt:**
```
Create tmpdir, copy config files, apply change:
{{changes}}

Then validate:
1. Run bun run typecheck
2. Run bun test test/config/
3. Load config and verify schema passes
4. Return validation result

If validation FAILS, stop immediately and report errors.
```

**Validation:**
- Command: `bun run typecheck` → MUST succeed
- Command: `bun test test/config/` → MUST succeed
- Forbidden patterns: `parse error`, `validation failed`, `schema error`

### Task 3: Compute Impact
**Agent:** config  
**Description:** Analyze what will break or need reloading

**Prompt:**
```
For config change {{changes}}, identify:

1. MCP servers to reload (check config.mcp.*)
2. Agents to reinitialize (check config.agent.*)
3. Sessions to refresh (check if config.session.* changed)
4. Tools to reload (check if tools added/removed)

Return impact report with blast radius assessment.
```

**Validation:** None (analysis only)

### Task 4: Apply with Backup
**Agent:** config  
**Description:** Backup config file, then apply change

**Prompt:**
```
1. Create backup: {{configFile}}.backup-{{timestamp}}
2. Verify backup is valid copy (checksum match)
3. Apply change: {{changes}}
4. Verify file is valid JSON
5. DO NOT reload config yet

If ANY step fails, stop immediately.
```

**Validation:**
- Required files: `{{configFile}}.backup-{{timestamp}}`
- Forbidden patterns: `parse error`, `validation failed`

### Task 5: Reload Config Safe
**Agent:** config  
**Description:** Reload config in current session, handle failures gracefully

**Prompt:**
```
Attempt to reload config:

1. Check if Config.canReloadSafely() (if method exists)
2. If safe OR no method exists:
   - Call Config.reload() OR Config.state.invalidate()
   - Verify reload successful
3. If NOT safe:
   - Log: "Config updated, changes deferred to next session start"
   - Write marker file: .opencode/.config-updated

If reload FAILS:
- Restore from backup: {{configFile}}.backup-{{timestamp}}
- Report error
- Exit with failure
```

**Validation:** None (graceful degradation)

**Retry:**
- Max attempts: 1 (no retry, rollback immediately on failure)
- Strategy: simple

### Task 6: Verify and Commit
**Agent:** config  
**Description:** Verify config loaded correctly, commit change

**Prompt:**
```
1. Verify change applied:
   - Read config value at {{changes.path}}
   - Compare with expected: {{changes.newValue}}
   - If mismatch, ROLLBACK and report error

2. If verified:
   - Run git add {{configFile}}
   - Run git commit -m "config: {{changes.reason}}"
   - Delete backup file (change is committed)

3. If verification FAILED:
   - Restore from backup
   - Report failure
   - Exit with error
```

**Validation:**
- Command: `git status` → MUST show clean commit
- Forbidden patterns: `nothing to commit`, `uncommitted changes`

---

## Validation Harness: `config-modification-validation.ts`

```typescript
/**
 * Validation harness for safe config modification
 * 
 * Tests:
 * 1. Add tool to agent config
 * 2. Modify metabob setting
 * 3. Add MCP server
 * 4. Handle validation failure (rollback)
 * 5. Handle apply failure (rollback)
 */

import { activity } from '@opencode/activity';
import { Config } from '@opencode/config';
import fs from 'fs/promises';

export async function runValidation(): Promise<ValidationResult> {
  const results: TestResult[] = [];
  
  // Test 1: Add tool to agent config
  results.push(await testAddTool());
  
  // Test 2: Modify metabob setting
  results.push(await testModifyMetabobSetting());
  
  // Test 3: Add MCP server
  results.push(await testAddMcpServer());
  
  // Test 4: Validation failure rollback
  results.push(await testValidationFailureRollback());
  
  // Test 5: Apply failure rollback
  results.push(await testApplyFailureRollback());
  
  const allPassed = results.every(r => r.status === 'PASS');
  
  return {
    overallStatus: allPassed ? 'PASS' : 'FAIL',
    tests: results,
    summary: `${results.filter(r => r.status === 'PASS').length}/${results.length} tests passed`
  };
}

async function testAddTool(): Promise<TestResult> {
  const configFile = '.opencode/agent/config.md';
  const originalContent = await fs.readFile(configFile, 'utf-8');
  
  try {
    // Execute activity
    const result = await activity({
      templateId: 'safe-config-modification',
      variables: {
        changeId: 'test-add-tool',
        operation: 'add_tool',
        configFile,
        changes: {
          tool: 'metabob_suggest_related_changes',
          value: true,
          reason: 'Test: add tool'
        }
      }
    });
    
    // Verify tool added
    const newContent = await fs.readFile(configFile, 'utf-8');
    const toolAdded = newContent.includes('metabob_suggest_related_changes');
    
    // Verify no backup remains (should be deleted on success)
    const backups = await fs.readdir(path.dirname(configFile));
    const backupExists = backups.some(f => f.includes('.backup-'));
    
    // Restore original for other tests
    await fs.writeFile(configFile, originalContent);
    
    return {
      name: 'Add tool to agent config',
      status: toolAdded && !backupExists ? 'PASS' : 'FAIL',
      details: { toolAdded, backupExists }
    };
    
  } catch (error) {
    // Restore original on error
    await fs.writeFile(configFile, originalContent);
    
    return {
      name: 'Add tool to agent config',
      status: 'FAIL',
      error: error.message
    };
  }
}

async function testValidationFailureRollback(): Promise<TestResult> {
  const configFile = 'opencode.json';
  const originalContent = await fs.readFile(configFile, 'utf-8');
  
  try {
    // Attempt invalid change (should fail validation)
    const result = await activity({
      templateId: 'safe-config-modification',
      variables: {
        changeId: 'test-invalid-change',
        operation: 'modify_key',
        configFile,
        changes: {
          path: 'metabob.max_issues',
          oldValue: 5,
          newValue: 'INVALID', // String instead of number
          reason: 'Test: validation failure'
        }
      }
    });
    
    // Should have failed
    return {
      name: 'Validation failure rollback',
      status: 'FAIL',
      details: 'Activity should have failed but succeeded'
    };
    
  } catch (error) {
    // Expected failure
    
    // Verify config unchanged
    const currentContent = await fs.readFile(configFile, 'utf-8');
    const unchanged = currentContent === originalContent;
    
    // Verify backup was created and preserved
    const backups = await fs.readdir(path.dirname(configFile));
    const backupExists = backups.some(f => f.includes('.backup-'));
    
    return {
      name: 'Validation failure rollback',
      status: unchanged && backupExists ? 'PASS' : 'FAIL',
      details: { unchanged, backupExists, error: error.message }
    };
  }
}

// ... other test cases ...
```

---

## Expected Behavior

### Success Case: Add Tool
```bash
$ opencode activity safe-config-modification \
  -v operation=add_tool \
  -v configFile=.opencode/agent/config.md \
  -v changes.tool=metabob_suggest_related_changes \
  -v changes.value=true \
  -v changes.reason="Enable CPG-based related file suggestions"

📊 Impact Analysis:
  Agents to reinitialize: config
  Tools to reload: 0
  MCP servers to reload: 0

✅ Validation passed in sandbox
✅ Backup created: .opencode/agent/config.md.backup-2026-02-24T10-30-45-123Z
✅ Change applied
✅ Config reloaded in current session
✅ Verified: tool added successfully
✅ Committed: config: Enable CPG-based related file suggestions
```

### Failure Case: Invalid Change
```bash
$ opencode activity safe-config-modification \
  -v operation=modify_key \
  -v changes.path=metabob.max_issues \
  -v changes.newValue=INVALID

❌ Validation failed in sandbox:
  - Type error: Expected number, got string
  - Schema validation failed

❌ Change NOT applied
✅ Backup preserved: opencode.json.backup-2026-02-24T10-32-15-456Z
ℹ️  Rollback not needed (validation failed before mutation)
```

---

## State Transformation Examples

### Example 1: Add Tool

**Instructional State (Intent):**
```json
{
  "operation": "add_tool",
  "target": "agent.config",
  "changes": {
    "tool": "metabob_suggest_related_changes",
    "value": true
  },
  "reason": "Enable CPG-based related file suggestions"
}
```

**Functional State Transformation:**
```
Before:
  File: .opencode/agent/config.md
  Tools: [metabob_search_codebase_issues, metabob_analyze_change_impact, ...]
  Agent capabilities: Code search, impact analysis

After:
  File: .opencode/agent/config.md (modified)
  Tools: [...previous tools..., metabob_suggest_related_changes]
  Agent capabilities: Code search, impact analysis, related file suggestions
```

### Example 2: Modify Metabob Setting

**Instructional State (Intent):**
```json
{
  "operation": "modify_key",
  "target": "project",
  "changes": {
    "path": "metabob.max_issues",
    "oldValue": 5,
    "newValue": 10
  },
  "reason": "Increase issue limit for better coverage"
}
```

**Functional State Transformation:**
```
Before:
  File: opencode.json
  Runtime: Config.get().metabob.max_issues === 5
  MCP calls: Returns 5 issues max

After:
  File: opencode.json (modified)
  Runtime: Config.get().metabob.max_issues === 10
  MCP calls: Returns 10 issues max
```

---

## Success Criteria

### Development Phase
- ✅ Activity template `safe-config-modification` created
- ✅ Validation harness implemented
- ✅ All 5 test cases pass
- ✅ No config corruption in any test
- ✅ Rollback works on validation failure
- ✅ Rollback works on apply failure

### Enforcement Phase (via trace-enforce-validate-loop)
- ✅ REQ-1 enforced: Validation sandbox implemented
- ✅ REQ-2 enforced: Backup before mutation implemented
- ✅ REQ-3 enforced: Graceful reload implemented
- ✅ REQ-4 enforced: Rollback on failure implemented
- ✅ REQ-5 enforced: Impact analysis implemented
- ✅ REQ-6 enforced: State transformation tracking implemented

### Operational Phase
- ✅ Can add tool without breaking system
- ✅ Can modify setting without breaking system
- ✅ Can add MCP server without breaking system
- ✅ Can manage secrets without breaking system
- ✅ Can install plugin without breaking system
- ✅ Invalid changes rejected before mutation
- ✅ Failed changes rolled back automatically

---

## Next Steps

1. **Trace:** Run `trace-data-flow-single-feature` to understand current config system
2. **Enforce:** Run `trace-enforce-validate-loop` with this specification
3. **Validate:** Run validation harness to verify enforcement
4. **Iterate:** Fix any failing tests
5. **Deploy:** Use safe-config-modification for all config changes

---

## References

- **Pattern:** trace-enforce-validate-loop
- **Related:** SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md
- **Enforcement Tracking:** ENFORCEMENT_CONFIG_SELF_MODIFICATION.json (to be created)
- **Impulse Usage Tracking:** IMPULSE_CONFIG_TRANSFORMATION.json (to be created)
