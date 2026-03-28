# Minibob Integration Action Plan

**Date**: 2026-03-20  
**Objective**: Ensure minibob library is the primary execution engine for metabob-opencode

---

## Status Summary

✅ **INTEGRATION IS OPERATIONAL**

The minibob library integration is **production-ready** with minor gaps that should be addressed before deployment.

**Current Architecture**:
- ✅ Library-based integration (not HTTP)
- ✅ Session-specific ActivityExecutor instances
- ✅ Lifecycle hooks registered
- ✅ Goal-driven execution supported
- ✅ Configuration schema integrated
- ✅ Activity and Goal tools delegate to MinibobIntegration

---

## Action Items

### 🔴 HIGH PRIORITY (Required for Production)

#### 1. Add Package Dependency

**Issue**: @metabob/minibob relies on `bun link` (development only)

**Solution**:
```bash
cd repos/metabob-opencode
# Edit packages/opencode/package.json, add to dependencies:
"@metabob/minibob": "workspace:*"
```

**Verification**:
```bash
bun install
bun pm ls | grep minibob
```

**Impact**: Prevents import failures in CI/CD and production deployments.

---

#### 2. Wire UI Callbacks for Real-Time Updates

**Issue**: Task start/complete callbacks are stubbed with TODOs

**File**: `packages/opencode/src/minibob-integration/index.ts`

**Current Code** (lines 214-235):
```typescript
onTaskStart: (taskId) => {
  log.debug("task started", { sessionID, taskId })
  // TODO: Send UI update via Session.addMessage
}

onTaskComplete: (taskId, result) => {
  log.debug("task completed", { sessionID, taskId, status: result.status })
  // TODO: Send UI update via Session.addMessage
}
```

**Solution**:
```typescript
import { Session } from "../session"

onTaskStart: async (taskId) => {
  log.debug("task started", { sessionID, taskId })
  
  // Send UI update
  await Session.addMessage(sessionID, {
    role: "assistant",
    parts: [{ 
      type: "text", 
      text: `⚙️ Starting task: ${taskId}` 
    }]
  })
}

onTaskComplete: async (taskId, result) => {
  log.debug("task completed", { sessionID, taskId, status: result.status })
  
  // Send UI update
  const emoji = result.status === "completed" ? "✅" : "❌"
  await Session.addMessage(sessionID, {
    role: "assistant",
    parts: [{ 
      type: "text", 
      text: `${emoji} Task ${taskId}: ${result.status}` 
    }]
  })
}
```

**Verification**:
1. Run opencode session
2. Execute activity via activity tool
3. Observe real-time task updates in UI

**Impact**: Provides user visibility into activity execution progress.

---

### 🟡 MEDIUM PRIORITY (Quality Improvements)

#### 3. Implement MCP Tool Passthrough

**Issue**: `buildCustomToolsFromMCP()` returns empty object

**File**: `packages/opencode/src/minibob-integration/index.ts` (lines 274-277)

**Current Code**:
```typescript
async function buildCustomToolsFromMCP(config: Config.Info): Promise<Record<string, any>> {
  log.debug("MCP tool passthrough not yet implemented, minibob will use built-in tools")
  return {}
}
```

**Solution Outline**:
```typescript
import { MCP } from "../mcp"

async function buildCustomToolsFromMCP(config: Config.Info): Promise<Record<string, any>> {
  const customTools: Record<string, any> = {}
  
  if (!config.mcp) {
    return customTools
  }
  
  // Iterate over configured MCP servers
  for (const [serverName, serverConfig] of Object.entries(config.mcp)) {
    try {
      const client = await MCP.getClient(serverName)
      if (!client) continue
      
      const tools = await client.listTools()
      
      for (const tool of tools) {
        // Wrap MCP tool in minibob's format
        customTools[tool.name] = async (args: any) => {
          const result = await client.callTool(tool.name, args)
          return result
        }
      }
    } catch (error) {
      log.warn("failed to load tools from MCP server", { 
        serverName, 
        error: error instanceof Error ? error.message : String(error) 
      })
    }
  }
  
  log.debug("built custom MCP tools", { 
    toolCount: Object.keys(customTools).length,
    toolNames: Object.keys(customTools) 
  })
  
  return customTools
}
```

**Verification**:
1. Configure MCP server in opencode config
2. Initialize minibob
3. Check logs for "built custom MCP tools"
4. Verify tool count > 0

**Impact**: Allows minibob activities to leverage opencode's MCP servers (e.g., Metabob MCP).

---

#### 4. Update Configuration Schema

**Issue**: `url` field in minibob config is legacy (HTTP mode, not used in library mode)

**File**: `packages/opencode/src/config/schemas/minibob.ts`

**Current**:
```typescript
url: z.string().default("http://localhost:8080").describe("Minibob server URL (HTTP API endpoint)"),
```

**Solution**:
```typescript
// Option A: Mark as deprecated
url: z.string().optional().describe("(Deprecated) Minibob server URL - not used in library mode"),

// Option B: Remove entirely
// Delete the url field if HTTP mode is no longer supported
```

**Verification**: Check that config validation passes without `url` field.

**Impact**: Reduces confusion about unused configuration fields.

---

### 🟢 LOW PRIORITY (Nice to Have)

#### 5. Fix Test Schema Error

**Issue**: `test-minibob-integration.ts` has schema error

**File**: `test-minibob-integration.ts` (line 62)

**Error**:
```
Object literal may only specify known properties, and 'compressionStrategy' does not exist in type 'TaskPrompt'.
```

**Solution**: Check minibob's TaskPrompt type definition and use correct field name.

```typescript
// Check repos/minibob/src/types.ts for TaskPrompt schema
// Update test template accordingly
```

---

#### 6. Add Comprehensive Integration Tests

**Objective**: Test full execution flow with assertions

**New File**: `packages/opencode/test/minibob/full-execution.test.ts`

**Test Cases**:
1. Initialize minibob for session
2. Execute simple activity (echo test)
3. Verify task callbacks are fired
4. Check execution metrics (duration, cost, tokens)
5. Verify lifecycle hooks are invoked
6. Test goal-driven execution with multiple activities
7. Test error handling and fallback

---

#### 7. Document Architecture

**New File**: `repos/metabob-opencode/docs/MINIBOB_INTEGRATION.md`

**Content**:
- Architecture overview with diagrams
- Integration points
- Configuration options
- Development setup (bun link)
- Testing guide
- Troubleshooting

---

## Implementation Order

```
Phase 1 (Today - Required for Production):
  1. Add package dependency (5 min)
  2. Wire UI callbacks (30 min)
  
Phase 2 (This Week - Quality):
  3. Implement MCP tool passthrough (2 hours)
  4. Update configuration schema (15 min)
  
Phase 3 (Next Sprint - Polish):
  5. Fix test schema error (30 min)
  6. Add integration tests (3 hours)
  7. Write documentation (2 hours)
```

---

## Verification Plan

### After Phase 1 (Production Readiness)

```bash
# 1. Verify dependency
cd repos/metabob-opencode
bun install
bun pm ls | grep minibob
# Expected: @metabob/minibob@workspace:repos/minibob

# 2. Verify UI callbacks
bun run packages/opencode/src/index.ts
# In session, run: Execute an activity template
# Observe task updates in UI (⚙️ Starting, ✅ Complete)

# 3. Run integration tests
bun run test-minibob-integration.ts
bun test packages/opencode/test/minibob/
```

### After Phase 2 (Quality Improvements)

```bash
# 1. Verify MCP tools
# Configure MCP server in opencode config
bun run packages/opencode/src/index.ts
# Check logs for: "built custom MCP tools"

# 2. Verify config schema
# Remove url field from config, ensure validation passes
```

---

## Rollback Plan

If issues arise during implementation:

1. **Dependency Issues**: Revert to `bun link` for development
2. **UI Callback Issues**: Comment out Session.addMessage calls, revert to log-only
3. **MCP Tool Issues**: Return empty object (current stub behavior)

All changes are isolated to `minibob-integration/index.ts` and can be reverted independently.

---

## Success Criteria

✅ **Phase 1 Complete**:
- [ ] @metabob/minibob is in package.json dependencies
- [ ] `bun install` succeeds without link command
- [ ] UI shows real-time task updates during activity execution
- [ ] No errors in logs during activity execution

✅ **Phase 2 Complete**:
- [ ] MCP tools are passed to minibob ActivityExecutor
- [ ] Log shows "built custom MCP tools: X tools"
- [ ] Activities can use MCP tools from opencode config
- [ ] Configuration schema is clean (no unused fields)

✅ **Phase 3 Complete**:
- [ ] All integration tests pass
- [ ] Documentation is published
- [ ] No schema errors in test files
- [ ] 80%+ test coverage for minibob integration

---

## Contact & Support

**Integration Owner**: opencode team  
**Library Maintainer**: minibob team  
**Documentation**: See MINIBOB_INTEGRATION_STATUS.md for detailed analysis

---

**Current Status**: ✅ **READY FOR PHASE 1 IMPLEMENTATION**  
**Estimated Time**: 35 minutes for production readiness  
**Risk Level**: 🟢 LOW (isolated changes, easy rollback)
