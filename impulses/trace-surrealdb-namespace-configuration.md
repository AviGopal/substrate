# Trace: SurrealDB Namespace Configuration Issue

## Executive Summary

**Status:** 🔴 CRITICAL BUG  
**Impact:** Blocks Thompson Sampling learning loop, template discovery, and activity execution  
**Root Cause:** Helm values configure namespace as "metabob" instead of "activity-system"

## Current State vs Desired State

### Current State (BROKEN)
- Helm values: `namespace: "metabob"`
- SurrealDB URL: `surrealdb.activity-system.svc.cluster.local:8000` ✓ (correct)
- Namespace selected: `metabob` ❌ (wrong)
- Query target: `metabob.learning_loop.activity_template`
- Result: HTTP 500 "Table not found"

### Desired State (WORKING)
- Helm values: `namespace: "activity-system"`
- SurrealDB URL: `surrealdb.activity-system.svc.cluster.local:8000` ✓
- Namespace selected: `activity-system` ✓
- Query target: `activity-system.learning_loop.activity_template`
- Result: HTTP 200 with templates array

## Components Involved

### 1. Infrastructure Layer (Kubernetes)

**helm/charts/metabob-activity-api/values.yaml:28**
- Current: `namespace: "metabob"`
- Gap: Wrong hardcoded legacy value
- Fix: Change to `namespace: "activity-system"`

**helm/helmfile-activity-minimal.yaml:148**
- Current: URL points to activity-system, but namespace is metabob
- Gap: Inconsistency between service URL and namespace value
- Fix: Change to `namespace: "activity-system"`

**helm/charts/metabob-activity-api/templates/deployment.yaml:47**
- Current: Injects `SURREALDB_NAMESPACE=metabob` env var
- Gap: Propagates wrong value from Helm to pod
- Fix: Will automatically use correct value after Helm fix

### 2. Application Layer (TypeScript)

**repos/metabob-activity-api/src/config.ts:62**
- Current: `namespace: process.env.SURREALDB_NAMESPACE || 'metabob'`
- Gap: No validation, wrong default, accepts any string
- Prevention: Add validation, fail fast, remove unsafe default

**repos/metabob-activity-api/src/db/surreal.ts:39-42**
- Current: `db.use({ namespace, database })` - no verification
- Gap: Connection succeeds but queries fail silently
- Prevention: Add namespace existence check with `INFO FOR NS`

**repos/metabob-activity-api/src/routes/activities.ts:71-81**
- Current: Query executes in wrong namespace (implicit context)
- Gap: Implicit namespace makes debugging hard
- Prevention: Better error messages with namespace context

**repos/metabob-activity-api/src/db/surreal.ts:66**
- Current: Generic error without namespace context
- Gap: Cannot distinguish namespace errors from other failures
- Prevention: Enrich errors with namespace/database info

**repos/metabob-activity-api/src/routes/activities.ts:285-288**
- Current: HTTP 500 with generic error message
- Gap: No error classification for clients
- Prevention: Add error codes, sanitize messages

## Data Flow

```
Entry: Helm values.yaml:28 (namespace='metabob')
  ↓
Transform: Helmfile override:148 (merge values)
  ↓
Transform: K8s deployment:47 (SURREALDB_NAMESPACE env var)
  ↓
Transform: config.ts:62 (load from env with default)
  ↓
Lock: surreal.ts:39 (db.use locks namespace)
  ↓
Query: activities.ts:71 (build SQL with implicit namespace)
  ↓
Execute: surreal.ts:66 (query in wrong namespace)
  ↓
Error: SurrealDB returns "Table not found"
  ↓
Exit: activities.ts:285 (HTTP 500 to client)
```

## Root Cause Analysis

**Primary Cause:** Legacy hardcoded value from old architecture where all services used `metabob` namespace

**Why It Happened:**
- Activity API was moved to separate `activity-system` namespace
- Helm configuration was not updated during the migration
- No validation to catch the mismatch

**Cascading Impact:**
```
Wrong Helm value
  → Wrong env var
  → Wrong config object
  → Wrong namespace lock at connection
  → All queries execute in wrong namespace
  → Table not found errors
  → HTTP 500 responses
  → Thompson Sampling blocked
  → Activity execution broken
  → Learning loop stopped
```

## Immediate Fix

**Files to Change:**
1. `helm/charts/metabob-activity-api/values.yaml:28`
2. `helm/helmfile-activity-minimal.yaml:148`

**Change:**
```yaml
# FROM:
namespace: "metabob"

# TO:
namespace: "activity-system"
```

**Deployment:**
```bash
helmfile -f helm/helmfile-activity-minimal.yaml sync
kubectl rollout status -n activity-system deployment/metabob-activity-api
```

**Verification:**
```bash
# Check environment variable
kubectl exec -n activity-system deployment/metabob-activity-api -- env | grep SURREALDB_NAMESPACE
# Should show: SURREALDB_NAMESPACE=activity-system

# Test endpoint
curl http://localhost:8080/v2/activities/templates
# Should return: {"templates":[...],"total":N} with 200 status
```

## Prevention Measures (High Priority)

### 1. Add Configuration Validation
```typescript
// config.ts
function validateNamespace(ns: string | undefined): string {
  if (!ns) throw new Error('SURREALDB_NAMESPACE required');
  if (!/^[a-z0-9_-]+$/i.test(ns)) throw new Error(`Invalid namespace: ${ns}`);
  return ns;
}

namespace: validateNamespace(process.env.SURREALDB_NAMESPACE),
```

### 2. Add Namespace Verification
```typescript
// surreal.ts:connect()
await this.db.use({ namespace, database });

// Verify namespace access
try {
  await this.db.query('INFO FOR NS');
  logger.info('Namespace verified', { namespace });
} catch (error) {
  throw new Error(`Cannot access namespace '${namespace}': ${error.message}`);
}
```

### 3. Enrich Error Messages
```typescript
// surreal.ts:query()
catch (error) {
  const enrichedError = new Error(
    `Query failed in ${config.surrealdb.namespace}.${config.surrealdb.database}: ${error.message}`
  );
  logger.error('SurrealDB query failed', { 
    sql, params, 
    namespace: config.surrealdb.namespace,
    database: config.surrealdb.database,
    error 
  });
  throw enrichedError;
}
```

### 4. Add Health Check
```typescript
// index.ts:/health
await surrealDB.query('SELECT * FROM activity_template LIMIT 1');
await surrealDB.query('SELECT * FROM variant_performance_metrics LIMIT 1');
```

## Critical Decision Points

1. **values.yaml:28** - CRITICAL impact, single point of failure
2. **config.ts:62** - HIGH impact, wrong values accepted silently
3. **surreal.ts:39-42** - MEDIUM impact, connection succeeds but queries fail

## Related Files

All files involved in the data flow are documented in:
- `/home/avi/documents/work/exp-repo/metabob-devbob/docs/data-flows/surrealdb-namespace-configuration-flow.md`

## Reusable Patterns Identified

1. **Configuration-Driven Database Connection** - Environment-based config pattern
2. **Fail-Fast Configuration Validation** - Validation framework pattern
3. **Namespace-Scoped Multi-Tenancy** - Logical isolation pattern
4. **Cache-Aside with Stampede Prevention** - Performance pattern

See full flow documentation for pattern details and abstraction potential.
