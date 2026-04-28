# Self-Development Loop: Technical Design

## Foundation realignment note (2026-04-27)

The narrow problem this change addresses (org_id missing from MCP-client payloads, blocking trace storage with proper multi-tenant isolation) appears to have been superseded twice: (1) by the canary deployment of API-key + identity-vessel JWT auth where org_id flows from `$token.org_id` (CLAUDE.md authentication section), and (2) by the in-flight `account-id` migration that replaces org_id with account_id throughout activity-api (`activity-api-account-id-migration-2026-04-28`). Recommend retirement: the specific bugs this change scopes are largely closed; the broader self-development loop is now driven by `2026-04-27-meta-activity-builder` and `2026-04-27-activity-registry-quality-pass`.

The foundation alignment described below remains correct — execution traces ARE impulse pointers under the corrected model, and the ribosome IS a resolver from trace to template — but the active development work has moved on. Flag for human review on retirement.

> **Aligned with**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

## Foundation Alignment

This design implements the continuous loop described in the foundation:

> "Output impulses from Activity A → Input impulses for Activity B"

Key alignment points:
- Execution traces become impulse pointers (available for future activities)
- Templates are vessels (instructional state)
- Executions are the process-of-becoming (transient state)
- Outcomes create new impulses (functional state → input for next transformation)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MINIBOB VESSEL                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐       │
│  │  Improviser  │───▶│ Template Extract │───▶│  Vessel Cache   │       │
│  │   (LLM)      │    │   (Ribosome)     │    │   (Local FS)    │       │
│  └──────────────┘    └──────────────────┘    └────────┬────────┘       │
│                                                        │                 │
│                                                        ▼                 │
│                                               ┌─────────────────┐       │
│                                               │ Promotion Hooks │       │
│                                               │ (Threshold Check)│       │
│                                               └────────┬────────┘       │
│                                                        │                 │
└────────────────────────────────────────────────────────┼─────────────────┘
                                                         │
                    ┌────────────────────────────────────┴────────────┐
                    │                  MCP CLIENT                      │
                    │  ┌─────────────────────────────────────────┐    │
                    │  │ registerTemplate(template, org_id) ◀────┼────┤
                    │  │ storeExecutionTrace(trace, org_id) ◀────┼────┤ NEW!
                    │  │ storeImpulse(impulse, org_id) ◀─────────┼────┤ org_id
                    │  │ reportExecution(...) ✓                   │    │
                    │  └─────────────────────────────────────────┘    │
                    └─────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────────┐
                    │           METABOB-ACTIVITY-API                   │
                    ├─────────────────────────────────────────────────┤
                    │  POST /v2/activities/templates                   │
                    │  POST /v2/activities/execution-traces            │
                    │  POST /v2/impulses                               │
                    │                                                  │
                    │  All endpoints now receive org_id in payload     │
                    │  Backend extracts from JWT OR payload            │
                    └─────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────────┐
                    │              SURREALDB                           │
                    ├─────────────────────────────────────────────────┤
                    │  activity_registry:                              │
                    │    org_id = organizations:metabob_internal       │
                    │                                                  │
                    │  activity_execution_traces:                      │
                    │    org_id = organizations:metabob_internal       │
                    │                                                  │
                    │  PERMISSIONS enforce: org_id = $auth.org_id      │
                    └─────────────────────────────────────────────────┘
```

## Current Code Analysis

### MCP Client (src/mcp.ts)

**authenticateInstance()** (lines 88-115):
```typescript
// ALREADY WORKS - stores org_id after auth
const response = await this.request("/v2/auth/minibob/signin", {...})
this.instance = {
  instanceId,
  apiKey,
  orgId: response.org_id,      // ✓ Captured
  projectId: response.project_id,
  authenticated: true,
}
```

**registerTemplate()** (lines 228-278):
```typescript
// MISSING org_id!
const payload = {
  variant_id: template.id,
  activity_id: template.id,
  variant_name: template.name,
  // ... other fields
  scope: "global",
  // org_id: NOT HERE!
}
```

**storeExecutionTrace()** (lines 654-705):
```typescript
// MISSING org_id!
const payload = {
  execution_id,
  template_id,
  // ... other fields
  // org_id: NOT HERE!
}
```

### What Needs to Change

#### Pattern: org_id Injection

All MCP methods that send data to backend must:

```typescript
// Extract org_id from authenticated instance
private getOrgId(): string | null {
  return this.instance?.orgId || null
}

// Include in payload
const payload = {
  ...existingFields,
  org_id: this.getOrgId(),  // ADD THIS
  project_id: this.instance?.projectId || null,  // ADD THIS
}
```

#### Colocated Logic: Auth Guard

Methods that require org_id should verify authentication:

```typescript
private ensureAuthenticated(): void {
  if (!this.instance?.authenticated) {
    throw new Error("MCPClient must authenticate before calling this method")
  }
  if (!this.instance.orgId) {
    throw new Error("MCPClient has no org_id - authentication may have failed")
  }
}
```

## Database Schema Requirements

From `/repos/metabob-activity-api/sql/schemas/`:

### activity_registry (010-activity-registry.surql)
```sql
DEFINE FIELD org_id ON TABLE activity_registry TYPE record<organizations> ASSERT $value != NONE;
```
- **Required**: Yes (ASSERT not NONE)
- **Source**: MCP client payload → backend → SurrealDB

### activity_execution_traces (011-executions.surql)
```sql
DEFINE FIELD org_id ON TABLE activity_execution_traces TYPE record<organizations> 
  DEFAULT $auth.org_id ASSERT $value != NONE;
```
- **Required**: Yes
- **Source**: JWT `$auth.org_id` OR payload `org_id`
- **Fallback**: `$auth.org_id` from JWT claims

### impulse_data (013-impulse-tool-usage.surql)
```sql
DEFINE FIELD org_id ON TABLE impulse_data TYPE record<organizations> ASSERT $value != NONE;
```
- **Required**: Yes
- **Source**: MCP client payload

## Backend Handler Changes

### execution-traces.ts

**Current** (approx line 1174-1195):
```typescript
// No org_id extraction!
const { execution_id, template_id, ... } = await c.req.json()
await db.query(`CREATE activity_execution_traces...`)
```

**Required**:
```typescript
// Extract from JWT or payload
const session = c.get('session')
const body = await c.req.json()
const orgId = body.org_id || session?.org_id

if (!orgId) {
  return c.json({ error: "org_id required" }, 400)
}

await db.query(`CREATE activity_execution_traces SET org_id = $orgId...`, { orgId })
```

## Integration Points

> **Security hardening dependency** (see `openspec/changes/2026-04-26-security-hardening-findings/`):
> - **H4 (Tailnet-Lock authority)**: When H4 lands, Thompson Sampling selection of templates SHOULD verify the source vessel is AUM-attested before templates are reused across organizational scopes. The template registration flow described below propagates `org_id`, but cross-org or cross-tenant template reuse must additionally consult the AUM to confirm the registering vessel's authority for the advertised shapes. Within-org reuse is unaffected.

### index.ts Template Extraction Flow

**Current** (lines 657-688):
```typescript
// Save to vessel template cache for local development
const { getTemplateCache, loadVesselDefinition, isDevelopmentVessel, getVesselId } = await import('./src/vessel')

if (await isDevelopmentVessel(vesselPath)) {
  // ... cache save ...
}

// Register with backend if available
const { getMCPClient, isMCPEnabled } = await import('./src/mcp')
if (isMCPEnabled()) {
  const mcp = getMCPClient()
  if (mcp) {
    await mcp.registerTemplate(template)  // ← No org_id parameter!
  }
}
```

**Required**:
```typescript
if (isMCPEnabled()) {
  const mcp = getMCPClient()
  if (mcp) {
    // Ensure authenticated before registration
    if (!mcp.isAuthenticated()) {
      await mcp.authenticateInstance()  // Uses MINIBOB_INSTANCE_ID, MINIBOB_API_KEY
    }
    await mcp.registerTemplate(template)  // Now includes org_id internally
  }
}
```

## Testing Strategy

### Unit Tests (can run without backend)

1. **MCP Client org_id injection**
   - Mock `instance` with `orgId`
   - Verify payload includes `org_id`

2. **Auth guard**
   - Call method without auth → throws
   - Call method with auth → succeeds

### Integration Tests (require backend)

1. **Template registration flow**
   ```bash
   bun run index.ts improvise "Create test function"
   # Verify: template registered with org_id
   curl http://activity.metabob.local/v2/activities/templates?limit=1 | jq '.org_id'
   ```

2. **Execution trace storage**
   ```bash
   # After improvisation completes
   kubectl exec -n activity-system surrealdb-0 -- \
     surreal sql --ns activity-system --db learning_loop \
     "SELECT id, org_id FROM activity_execution_traces LIMIT 1"
   ```

### End-to-End Test

```bash
# Full self-development loop
cd repos/minibob
export MINIBOB_MCP_ENDPOINT=http://activity.metabob.local

# 1. First improvisation (creates + caches template)
bun run index.ts improvise "Create add function in src/add.ts"

# 2. Verify template cached locally
ls ~/.minibob/vessels/minibob-local/templates/

# 3. Verify template in backend (with org_id)
curl -s http://activity.metabob.local/v2/activities/templates | jq '.[0] | {id, org_id}'

# 4. Second improvisation (should reuse template or create new)
bun run index.ts improvise "Create subtract function in src/sub.ts"

# 5. Verify execution trace stored (with org_id)
curl -s http://activity.metabob.local/v2/activities/execution-traces?limit=1 | jq '.[0].org_id'
```

## Rollback Plan

If issues occur:
1. MCP client changes are additive (org_id field added to payloads)
2. Backend accepts null org_id (falls back to $auth.org_id from JWT)
3. No database migrations required (fields already exist)
4. Revert by removing org_id from payloads (not recommended)

## Dependencies

- No new packages required
- No database schema changes required
- Backend endpoints already accept org_id field
- JWT authentication already provides $auth.org_id

---

## Foundation Alignment: Impulse Creation from Traces

> **Key requirement**: "Output impulses from Activity A → Input impulses for Activity B"

After storing an execution trace, we must create an impulse pointer so future activities can reference it:

### Implementation

```typescript
// In MCP client, after storeExecutionTrace:
async storeExecutionTrace(trace: ExecutionTrace): Promise<string> {
  const traceId = await this.request("/v2/activities/execution-traces", {
    method: "POST",
    body: { ...trace, org_id: this.getOrgId() }
  })

  // Create impulse pointer for this trace
  await this.storeImpulse({
    id: `imp-trace-${traceId}`,
    pointer: {
      type: "executionTrace",
      traceId: traceId
    },
    metadata: {
      shape: "execution_trace",
      activityId: trace.activity_id,
      success: trace.outcome.success,
      timestamp: trace.timestamp,
      summary: `Execution of ${trace.activity_id}: ${trace.outcome.success ? 'success' : 'failure'}`
    },
    org_id: this.getOrgId()
  })

  return traceId
}
```

### Why This Matters

1. **Traces become impulses** - Available as input to future activities
2. **Learning loop closes** - Backend can recommend "debug-failure" activity when failure trace exists
3. **Context accumulates** - Each execution adds to available impulses
4. **Ribosome can extract** - Successful traces become template candidates

### Impulse Pointer Types

| Pointer Type | Created When | Used By |
|--------------|--------------|---------|
| `executionTrace` | After any execution | Debug activities, analysis |
| `failurePattern` | After repeated failures | Error pattern matching |
| `templateCandidate` | After successful improvisation | Ribosome extraction |
| `learningFeedback` | After prediction vs actual comparison | Model updates |
