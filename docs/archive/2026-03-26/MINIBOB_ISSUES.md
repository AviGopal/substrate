# Minibob Integration Issues

This document tracks issues discovered during minibob integration development.

## Format

For each issue:
- **Issue ID**: Unique identifier (e.g., MB-001)
- **Category**: Bug | Enhancement | Documentation | Question
- **Priority**: Critical | High | Medium | Low
- **Status**: Open | In Progress | Resolved | Deferred
- **Description**: Clear description of the issue
- **Context**: Where and when the issue was discovered
- **Impact**: How this affects Perspective development
- **Workaround**: Temporary solution (if applicable)
- **Resolution**: How the issue was resolved (if applicable)

---

## Open Issues

### MB-001: Custom Impulse Resolvers Not Invoked in resolvePointer()
**Category**: Bug
**Priority**: Critical
**Status**: Open
**Description**: The `ImpulseStore.registerResolver()` method stores custom resolvers in the `customResolvers` Map, but these resolvers are never invoked in the `resolvePointer()` method. When loading an impulse with a custom pointer type, the system throws "Impulse type requires backend connection" instead of calling the registered custom resolver.

**Context**: Discovered while implementing Phase 5 (Impulse Resolvers for Perspective Data) in `/home/avi/documents/scratch/perspective/src/lib/impulse-resolvers.ts`. All tests in `impulse-resolvers.test.ts` fail with the same error.

**Impact**:
- Blocks Phase 5 implementation entirely
- Custom impulse pointer types (`enrichment_cache`, `human_input`, `company_db_record`, `investor_mandate`, `match_results`, `activity_trace`) cannot be resolved
- Impulse system can only use built-in types (`memo`, `file`, `activityOutput`) or backend MCP connection

**Code Evidence**:
From `node_modules/@metabob/minibob/dist/lib.js`:
```javascript
// customResolvers Map is defined but never used in resolvePointer()
customResolvers = new Map;

registerResolver(name, resolver) {
  this.customResolvers.set(name, resolver);
}

async resolvePointer(pointer) {
  if (pointer.type === "memo" && "content" in pointer) { /* ... */ }
  if (pointer.type === "file" && "path" in pointer) { /* ... */ }
  if (isMCPEnabled()) { /* MCP backend resolution */ }
  if (pointer.type === "activityOutput" && "activityId" in pointer) { /* ... */ }
  // Missing: if (this.customResolvers.has(pointer.type)) { ... }
  throw new Error(`Impulse type "${pointer.type}" requires backend connection...`);
}
```

**Proposed Fix**:
Add custom resolver check in `resolvePointer()` before throwing the "requires backend" error:
```javascript
// After file handling, before MCP check
if (this.customResolvers.has(pointer.type)) {
  const resolver = this.customResolvers.get(pointer.type);
  try {
    return await resolver(pointer);
  } catch (error) {
    throw new Error(`Custom resolver for "${pointer.type}" failed: ${error.message}`);
  }
}
```

**Workaround**:
Implemented resolver functions and registration logic in `/home/avi/documents/scratch/perspective/src/lib/impulse-resolvers.ts`, but they cannot be used until minibob is fixed. Tests are written but skipped until resolution.

**Resolution**: N/A (awaiting minibob package update)

---

### MB-002: No Built-in Session Context in ActivityExecutor
**Category**: Enhancement
**Priority**: High
**Status**: Open
**Description**: The `ActivityExecutor.execute()` method does not accept a session context parameter, and there's no built-in mechanism to pass custom context (like `session_id`) through to tool handlers. This makes it difficult to track which impulses belong to which conversation session when activities create impulses.

**Context**: Discovered while implementing Phase 6 (Impulse Session Management). The ToolContext type includes `sessionId`, but there's no way to inject it from the ActivityExecutor down to tool handlers.

**Impact**:
- Cannot automatically track impulses created by activities to their originating session
- Requires manual tracking at the adapter level after activity execution completes
- Tools like `store_enrichment` receive `sessionId` in parameters, but ActivityExecutor doesn't provide it
- Breaks the automatic impulse-to-session association pattern described in the vessel architecture

**Code Evidence**:
From `PerspectiveMinibobAdapter.executeActivity()`:
```typescript
async executeActivity(
  templateId: string,
  variables: Record<string, unknown>,
  reason?: string
): Promise<ActivityExecution> {
  const template = await loadTemplate(templateId);
  return this.executor.execute({ template, variables, reason });
  // No way to pass sessionId here!
}
```

From custom tools like `store_enrichment.ts`:
```typescript
// Tool expects sessionId in params
parameters: {
  // ...
  sessionId: {
    type: "string",
    description: "Session ID from execution context",
  },
}
// But ActivityExecutor has no mechanism to inject it
```

**Proposed Fix**:
Add optional `context` parameter to `ActivityExecutor.execute()`:
```typescript
interface ExecuteOptions {
  template: ActivityTemplate;
  variables: Record<string, unknown>;
  reason?: string;
  context?: Record<string, unknown>; // <-- New field
}

// ActivityExecutor injects context fields into all tool parameters
async execute(options: ExecuteOptions): Promise<ActivityExecution> {
  // ... existing logic
  // When invoking tools, merge options.context into tool parameters
}
```

**Workaround**:
Currently implementing a post-execution tracking approach:
1. Activities complete without session tracking
2. Adapter examines execution results to identify created impulses
3. Manually calls `impulseSessionManager.trackImpulse()` for each discovered impulse
4. Document in CLAUDE.md that session management requires post-execution cleanup

This workaround is fragile because:
- Relies on parsing execution output to detect impulses
- Misses impulses if output format changes
- Adds latency (tracking happens after execution instead of during)

**Resolution**: N/A (awaiting minibob package update)

---

## Resolved Issues

(No resolved issues yet)

---

## Deferred Issues

(No deferred issues yet)

---

## Notes

- Report critical issues directly to the minibob team
- Update this file as issues are discovered during development
- Link to related GitHub issues or pull requests where applicable
