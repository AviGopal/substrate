# Deployment Blocker: SurrealDB 3.0 Schema Migrations

**Status:** BLOCKED
**Priority:** CRITICAL
**Date:** 2026-03-31
**Blocking:** Lazy execution feature deployment and testing

## Problem Summary

Schema migrations for SurrealDB 3.0 fail consistently in multiple ways, preventing successful deployment of metabob-activity-api with the lazy execution feature.

## What Works

- ✅ Lazy execution code complete (activityExecution pointer type, caching logic)
- ✅ `type::thing` → `type::record` compatibility fixes applied and committed
- ✅ Docker images build successfully
- ✅ SurrealDB 3.0 pods run healthy
- ✅ Redis and other infrastructure components deploy successfully

## What's Broken

- ❌ Schema migration jobs timeout (DeadlineExceeded after 900s)
- ❌ Init-data jobs fail (BackoffLimitExceeded with parse errors)
- ❌ Manual migration attempts timeout or fail silently
- ❌ Health checks fail due to missing database tables
- ❌ Pods restart continuously (CrashLoopBackOff)

## Root Causes

### 1. SurrealDB 3.0 Breaking Changes

Multiple incompatibilities not fully addressed:
- `type::thing()` → `type::record()` (FIXED in commit 98379a5)
- `PERMISSIONS` clauses referencing `$auth` fail during migration (context unavailable)
- `VALUE $auth.*` default field values fail during migration
- `FLEXIBLE` keyword behavior changed
- Parse errors with table/field definitions

### 2. Schema Complexity

40+ schema files with:
- Nested objects requiring FLEXIBLE
- RBAC permissions with $auth references
- Multi-tenant filtering
- Computed views and compatibility layers

### 3. Migration Execution Issues

- Helm hook timeouts (900s not sufficient)
- Jobs deleted before logs can be inspected (ttlSecondsAfterFinished)
- Silent failures - jobs complete successfully but tables not created
- No incremental migration support (all-or-nothing)

### 4. Image Tag Mismatches

- Build creates: `dev-1.3.0-398879d-8923`
- Deployment requests: `latest`
- Helm uses environment variables that aren't set
- Results in ImagePullBackOff for manual jobs

## Failed Approaches

Attempted fixes (8+ iterations):

1. **Re-enable migrations with fixes** → DeadlineExceeded
2. **Remove PERMISSIONS clauses** → Internal SurrealDB errors
3. **Remove VALUE $auth clauses** → Parse errors persist
4. **Remove FLEXIBLE keyword** → Schema validation fails
5. **Fresh PVC deletion** → Data persists in hostpath storage
6. **StatefulSet recreation** → Immutable field errors
7. **Manual migration job** → Completes but tables not created
8. **Debug migration job** → ImagePullBackOff (tag mismatch)

## Current State

```
Pod Status:
- metabob-activity-api: Running but not Ready (0/1)
- Health checks: 503 Service Unavailable
- Error: "The table 'variant_performance_metrics' does not exist"
- Restarts: Continuous due to failed readiness probes

Database Status:
- SurrealDB 3.0.0: Healthy and accessible
- Tables: 0 (empty database)
- Migrations: Disabled to prevent deployment failures
```

## Impact

**Lazy Execution Feature:**
- Code complete and built in v1.3.0
- Ready for testing
- **CANNOT be deployed or tested** due to missing database schema

**Development Velocity:**
- ~4 hours spent on deployment debugging
- No successful baseline environment
- Blocked: All database-dependent features

## Recommended Solutions

### Option A: Simplify Schema Migration (2-3 days)

1. Remove all PERMISSIONS clauses from schema files
2. Remove all VALUE $auth clauses
3. Add PERMISSIONS after tables exist via separate script
4. Test migration with minimal schema first
5. Incrementally add complex features

**Pros:** Proper long-term fix
**Cons:** Significant time investment, uncertain success

### Option B: Alternative Database (1-2 days)

1. Add PostgreSQL support to metabob-activity-api
2. Implement schema migrations using standard tools (Prisma/Drizzle)
3. Keep SurrealDB for concept-db only
4. Test lazy execution with PostgreSQL

**Pros:** Proven migration tools, faster resolution
**Cons:** Diverges from architecture, dual database complexity

### Option C: SurrealDB 2.x Downgrade (1 day)

1. Revert to SurrealDB 2.x
2. Test if existing schemas work
3. Delay SurrealDB 3.0 migration until stable

**Pros:** Quickest path to working deployment
**Cons:** Technical debt, eventual forced upgrade

### Option D: Manual Schema Setup (4-6 hours)

1. Extract essential table definitions
2. Apply via raw SQL (curl to /sql endpoint)
3. Verify tables exist
4. Deploy API without migration hooks
5. Document manual steps

**Pros:** Unblocks immediate testing
**Cons:** Not reproducible, fragile, doesn't fix root cause

## Next Steps

**Immediate (choose one):**
1. Option D for unblocking (manual schema)
2. Option C for stability (downgrade to 2.x)
3. Option A for proper fix (rework migrations)

**Follow-up:**
1. Document migration approach decision
2. Update deployment scripts
3. Add schema validation tests
4. Test lazy execution feature

## Related Files

- `vessels/metabob-activity-api/sql/migrate.ts` - Migration runner
- `vessels/metabob-activity-api/sql/schemas/*.surql` - Schema definitions
- `helmfiles/local.yaml.gotmpl` - Deployment configuration
- `charts/surrealdb/templates/migration-job.yaml` - Migration job
- Commit 98379a5: type::record compatibility fixes

## Contact

For questions about this blocker, refer to:
- Session transcript: a66a3477-6018-4d90-9d81-e26806edd0fb
- Lazy execution PR: (pending deployment)
