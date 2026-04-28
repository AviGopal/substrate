# Self-Development Loop: Complete the Ribosome Pattern

## Problem Statement

MiniBob's self-development loop is **architecturally sound but has critical implementation gaps** in org_id propagation that prevent templates from being stored with proper multi-tenant isolation.

### Current State
- ✅ Improviser works (goal → execution → trace)
- ✅ Template Extractor works (trace → template)
- ✅ Vessel Cache works (local template storage)
- ✅ Promotion Hooks work (threshold checking)
- ⚠️ MCP Client partially works (org_id missing from payloads)
- ❌ Backend stores templates without tenant context

### The Gap
```
Improvisation → Extract → Cache → Register → Backend
                                      ↑
                                Missing org_id!
```

### Error Evidence
```
[MCP] Failed to store execution trace: 500 - {"error":"Failed to store execution trace",
"message":"Query failed in activity-system.learning_loop: Couldn't coerce value for
field `org_id` of `activity_execution_traces:...`: Expected `record<organizations>`
but found `NONE`"}
```

## Solution Overview

**Fix org_id propagation throughout the MCP client** to ensure all data is scoped to the correct organization.

### Interface Boundaries

| Interface | Direction | Status | Fix Required |
|-----------|-----------|--------|--------------|
| MiniBob → Vessel Cache | Local | ✓ Working | None |
| MiniBob → MCP (registerTemplate) | Outbound | ⚠️ Partial | Add org_id to payload |
| MiniBob → MCP (storeExecutionTrace) | Outbound | ⚠️ Partial | Add org_id to payload |
| MiniBob → MCP (storeImpulse) | Outbound | ⚠️ Partial | Add org_id to payload |
| MiniBob → MCP (reportExecution) | Outbound | ✓ Working | Uses session org_id |

### Data Flow Requirements

```
1. authenticateInstance() → returns { token, org_id, project_id }
                                          ↓
2. MCPClient stores: this.instance.orgId = org_id
                                          ↓
3. All methods extract: const orgId = this.instance?.orgId
                                          ↓
4. Include in payloads: { org_id: orgId, ...rest }
```

### Key Files to Modify

| File | Changes |
|------|---------|
| `src/mcp.ts` | Add org_id to registerTemplate, storeExecutionTrace, storeImpulse |
| `src/mcp.ts` | Ensure authenticateInstance() is called before registration |
| `src/vessel/promotion-hooks.ts` | Pass org_id through promotion flow |
| `index.ts` | Ensure auth before template extraction |

## Success Criteria

1. **Templates registered with org_id** - Query backend to verify org_id in records
2. **Execution traces stored** - No more 500 errors on trace storage
3. **Learning loop complete** - Thompson Sampling uses templates with correct scope
4. **MiniBob develops MiniBob** - Run improvisation goals, verify templates are reusable

## Out of Scope

- Custom resolver registration (separate issue MB-001)
- Enhanced execution trace schema (enhancement, not required for loop)
- Thompson Sampling algorithm changes (already working)
