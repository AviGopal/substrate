# MiniBob Authentication Setup - Scope & Impact Analysis

**Date:** 2026-03-24
**Context:** Evaluating work required to enable MiniBob RECORD auth vs complete spec implementation

## Executive Summary

**Quick Answer:** Setting up MiniBob auth now is **low-effort but fragile** due to schema evolution. Future specs **will likely require database resets**, invalidating manual setup. **Recommend hybrid approach:** automate instance creation while continuing implementation.

---

## Current State

### What's Working
- ✅ SurrealDB 3.0 with full RBAC schemas deployed
- ✅ Database-level permission enforcement validated
- ✅ Core schemas (001-004) stable and tested
- ✅ Activity schemas (010-013) deployed
- ✅ Analysis schemas (020-022) deployed
- ✅ MiniBob RECORD auth schema defined (minibob_instance table exists)

### What's Blocking
- ❌ MiniBob can't authenticate (no instance record + credentials)
- ❌ Backend rejects MiniBob API calls (no org_id from $auth)
- ❌ Activity templates can't be tested end-to-end

### Data Persistence Reality
```yaml
Current Setup:
  SurrealDB PVC: Enabled (10Gi, persistent)
  Migration Strategy: Manual (hooks disabled after failures)
  Database State: Contains 23 tables with RBAC permissions
  Test Data: None (fresh database)

Risk:
  - Schema changes require database wipe
  - Manual MiniBob instance setup would be lost
  - No automated instance creation yet
```

---

## Scope Analysis: Three Paths Forward

### Path A: Minimal Setup (Enable Testing Only)

**Work Required:** ~2 hours

**Tasks:**
1. Create MiniBob instance record in SurrealDB (SQL script)
2. Configure MiniBob `.env` with credentials
3. Update MiniBob MCP client to use RECORD auth (~50 LOC)
4. Test activity execution

**Code Changes:**
```typescript
// repos/minibob/src/mcp.ts
export async function authenticateInstance(
  instanceId: string,
  apiKey: string
): Promise<string> {
  const response = await db.signin({
    access: 'minibob_record',
    variables: {
      instance_id: instanceId,
      api_key: apiKey
    }
  });
  return response.token;
}
```

**Pros:**
- ✅ Fast - can test activities immediately
- ✅ Validates RBAC auth flow
- ✅ Confirms Phase 4 implementation works

**Cons:**
- ❌ Manual setup - not reproducible
- ❌ Lost on database wipe
- ❌ Doesn't solve automation need
- ❌ Technical debt - will need proper solution later

**Fragility:** 🔴 **HIGH**
- Any schema change → database wipe → manual setup again
- Not suitable for team use or CI/CD

---

### Path B: Complete Implementation (Finish All Specs)

**Work Required:** ~40-60 hours

**Remaining Tasks:** 141 tasks across 6 phases

**Phase Breakdown:**

```
Phase 6: Helm Chart Integration (14 tasks)
├─ Create migration chart with hooks
├─ Automated schema deployment
├─ Instance creation Job
└─ Estimated: 6-8 hours

Phase 7: Service Updates (13 tasks)
├─ Remove app-level org filtering
├─ Trust $auth.org_id from database
├─ Update API routes
└─ Estimated: 4-6 hours

Phase 8: Integration Testing (18 tasks)
├─ RBAC enforcement tests
├─ Multi-tenant isolation tests
├─ E2E activity execution tests
└─ Estimated: 8-10 hours

Phase 9: Documentation (12 tasks)
├─ API documentation
├─ Troubleshooting guides
├─ Runbooks
└─ Estimated: 6-8 hours

Phase 10: Production Deployment (16 tasks)
├─ Production-ready configs
├─ Backup/restore procedures
├─ Monitoring setup
└─ Estimated: 8-10 hours

Phase 11: Edge Cases (58 tasks)
├─ Repository-specific fixes
├─ Legacy data migration
├─ Compatibility layers
└─ Estimated: 12-16 hours
```

**Pros:**
- ✅ Production-ready solution
- ✅ Fully automated
- ✅ Complete feature set
- ✅ No technical debt

**Cons:**
- ❌ Significant time investment
- ❌ May be premature optimization
- ❌ Specs still evolving

**Fragility:** 🟢 **LOW**
- Automated setup survives database wipes
- Reproducible across environments
- CI/CD ready

---

### Path C: Hybrid Approach (Automate Core, Defer Production) ⭐ **RECOMMENDED**

**Work Required:** ~12-16 hours

**Focus Areas:**

**Phase 6: Helm Migration Integration (CRITICAL)** - 14 tasks
```yaml
Priority: HIGH - Enables reproducible deployments

Key Deliverables:
  1. Migration Job template (pre-install/upgrade hook)
  2. Automated MiniBob instance creation
  3. Schema version tracking
  4. Rollback support

Why Critical:
  - Makes database setup reproducible
  - Survives database wipes via automation
  - Foundation for all other work

Estimated: 6-8 hours
```

**Phase 7: Service Updates (IMPORTANT)** - 13 tasks
```yaml
Priority: MEDIUM-HIGH - Completes RBAC implementation

Key Deliverables:
  1. Remove app-level org filtering from activity-api
  2. Remove app-level org filtering from analysis-api
  3. Trust $auth.org_id populated by database
  4. Simplify API code (less logic, more trust)

Why Important:
  - Completes the RBAC migration
  - Proves database-level security works
  - Reduces application complexity

Estimated: 4-6 hours
```

**Phase 8: Core Testing (SELECTIVE)** - ~8 of 18 tasks
```yaml
Priority: MEDIUM - Validation only

Key Deliverables:
  1. RBAC enforcement tests
  2. Multi-tenant isolation tests
  3. MiniBob auth flow test
  4. Skip: Performance tests, stress tests

Why Selective:
  - Focus on correctness, not performance
  - Validate security model
  - Defer optimization testing

Estimated: 4-6 hours
```

**DEFER:** Phases 9-11 (Documentation, Production, Edge Cases)
```yaml
Reason: System still evolving
Better to document when stable
Production deployment premature
Edge cases can wait

Saves: ~30-40 hours
```

**Pros:**
- ✅ Reproducible MiniBob setup
- ✅ Completes core RBAC implementation
- ✅ Validates security model
- ✅ Reasonable time investment
- ✅ No wasted work if specs change

**Cons:**
- ⚠️ Documentation incomplete (but specs documented)
- ⚠️ Not production-ready (but wasn't goal)
- ⚠️ Some edge cases unhandled (can address as encountered)

**Fragility:** 🟡 **LOW-MEDIUM**
- Automated instance creation → survives wipes
- Core functionality complete
- Documentation can be generated later

---

## Spec Stability Analysis

### What's Stable (Won't Invalidate Work)

**Core RBAC Schema** ✅
```sql
-- These are foundational, won't change
DEFINE ACCESS jwt_external TYPE JWT ...
DEFINE ACCESS minibob_record TYPE RECORD ...
DEFINE TABLE organizations ...
DEFINE TABLE minibob_instance ...
```

**Reason:** Already deployed, tested, and working. Changes would break deployed systems.

**Multi-Tenant Pattern** ✅
```sql
-- Pattern is established
org_id: record<organizations>
project_id: option<record<projects>>
PERMISSIONS FOR select WHERE org_id = $auth.org_id
```

**Reason:** Consistent across all 23 tables, validated in production-like environment.

### What Might Change (Could Invalidate Work)

**Activity Schemas (010-013)** ⚠️
```yaml
Status: Recently consolidated (from 9 files to 4)
Risk: Medium - might need restructuring
Impact: Would require database wipe
Mitigation: Automation handles recreation
```

**Analysis Schemas (020-022)** ⚠️
```yaml
Status: Newly created, not heavily tested
Risk: Medium - might need adjustments
Impact: Partial wipe (analysis tables only)
Mitigation: Automated migration handles it
```

**Migration Runner** 🟢
```yaml
Status: Stable, based on industry patterns
Risk: Low - core logic won't change
Impact: Enhancements only (backwards compatible)
Mitigation: None needed
```

### Future Spec Impact

**openspec/changes/** - What's Coming?
```bash
$ ls openspec/changes/
surrealdb-multi-tenant-schema/  # Current (43% complete)
# Future specs unknown
```

**Likely Future Changes:**
1. **Activity system refinements** - New tables, relationships
2. **Learning algorithm improvements** - Schema optimizations
3. **Dashboard enhancements** - New metrics, aggregations
4. **Multi-region support** - Replication, sharding

**Impact on MiniBob Auth:**
- 🟢 **Core auth unchanged** - RECORD access pattern stable
- 🟡 **Instance management enhanced** - More fields, capabilities
- 🔴 **Database recreations likely** - Schema evolution continues

---

## Data Persistence Strategy

### Current Persistence Setup

```yaml
SurrealDB StatefulSet:
  PVC: data-surrealdb-0
  Size: 10Gi
  StorageClass: standard (local)
  Retention: Until manually deleted

Database: metabob:learning_loop
  Tables: 23 (all with RBAC)
  Data: Empty (no test data)
  Version: Tracked in schema_version table
```

### Persistence Challenges

**Problem 1: Schema Evolution**
```
When: Schema changes require database wipe
Frequency: Currently ~1-2 times per week (development)
Impact: All data lost, manual setup required
```

**Problem 2: Migration Failures**
```
Current: Migration hooks disabled (failed due to timing)
Workaround: Manual migration via kubectl run
Risk: Not reproducible, not automated
```

**Problem 3: Test Data**
```
Current: No automated test data creation
Need: MiniBob instance, test org, test users
Gap: Must manually recreate after wipes
```

### Recommended Persistence Strategy

**Development (Current Phase):**
```yaml
Approach: Reproducible Setup via Automation

1. Keep PVC (data survives pod restarts)
2. Accept database wipes (schema still evolving)
3. Automate instance creation (Helm Job)
4. Script test data population

Implementation:
  - helm/charts/surrealdb/templates/init-data-job.yaml
  - Runs AFTER schema migrations
  - Creates default org + MiniBob instance
  - Idempotent (checks before creating)

Result:
  - Database wipe → helmfile sync → everything recreated
  - No manual setup required
  - Team members can replicate
```

**Production (Future):**
```yaml
Approach: Persistent Data with Migration Management

1. Enable SurrealDB backups (automated)
2. Blue-green schema migrations
3. Zero-downtime upgrades
4. Rollback procedures

Not Needed Yet:
  - System still in development
  - Schemas actively evolving
  - No production users
```

---

## Recommendation Matrix

| Scenario | Recommended Path | Rationale |
|----------|------------------|-----------|
| **Just want to test activities** | Path A (Minimal) | Fast validation, acceptable fragility for one-off test |
| **Continuing active development** | Path C (Hybrid) ⭐ | Automates core, survives wipes, reasonable effort |
| **Preparing for production** | Path B (Complete) | Full automation, but premature given spec evolution |
| **Multiple developers** | Path C (Hybrid) ⭐ | Reproducible setup critical for team |
| **CI/CD pipeline** | Path C (Hybrid) ⭐ | Automation required, full completion not needed yet |

---

## Recommended Next Steps

### Phase 1: Automate Instance Creation (1-2 hours)

**Create:** `helm/charts/surrealdb/templates/init-data-job.yaml`

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Values.name }}-init-data
  annotations:
    "helm.sh/hook": post-install,post-upgrade
    "helm.sh/hook-weight": "4"  # After migrations (weight 1-3)
spec:
  template:
    spec:
      containers:
        - name: init-data
          image: {{ .Values.migrations.image.repository }}:{{ .Values.migrations.image.tag }}
          command: ["bun", "sql/init-test-data.ts"]
```

**Create:** `repos/metabob-activity-api/sql/init-test-data.ts`

```typescript
// Create default organization (idempotent)
const org = await db.query(`
  SELECT id FROM organizations WHERE id = organization:metabob_internal;
`);

if (!org[0]?.length) {
  await db.query(`
    CREATE organization:metabob_internal SET
      name = 'Metabob Internal',
      created_at = time::now();
  `);
}

// Create MiniBob instance (idempotent)
const instance = await db.query(`
  SELECT id FROM minibob_instance WHERE instance_id = 'minibob-local-001';
`);

if (!instance[0]?.length) {
  await db.query(`
    CREATE minibob_instance SET
      instance_id = 'minibob-local-001',
      org_id = organization:metabob_internal,
      project_id = NONE,
      api_key_hash = crypto::argon2::generate('test-api-key-123'),
      vessel_id = 'minibob-cli-local',
      is_active = true,
      created_at = time::now();
  `);
}
```

**Benefit:** Database wipe → `helmfile sync` → MiniBob ready

### Phase 2: Update MiniBob MCP Client (1-2 hours)

**Update:** `repos/minibob/src/mcp.ts`

Add RECORD authentication support (see Path A code example above).

**Update:** `repos/minibob/.env.example`

```bash
# MiniBob Instance Authentication
MINIBOB_INSTANCE_ID=minibob-local-001
MINIBOB_API_KEY=test-api-key-123
```

### Phase 3: Complete Phase 6-7 (10-14 hours)

Follow hybrid approach - automate core infrastructure while deferring production concerns.

### Phase 4: Validate (2 hours)

- Test database wipe → helmfile sync → everything works
- Test MiniBob activity execution
- Test multi-tenant isolation
- Document any remaining gaps

---

## Conclusion

**Recommended: Path C (Hybrid Approach)**

**Effort:** 12-16 hours total
**Benefit:** Reproducible setup that survives schema evolution
**Risk:** Low - automation handles database recreation

**Key Insight:** Don't fight database wipes during development. Embrace them with automation. The schemas are still evolving, and that's expected. Make the setup reproducible so wipes are painless.

**Next Immediate Action:**
1. Create init-data-job.yaml (1 hour)
2. Create init-test-data.ts script (30 min)
3. Update MiniBob MCP client for RECORD auth (1 hour)
4. Test end-to-end (30 min)

**Total to enable testing:** ~3 hours
**Total for hybrid completion:** ~15 hours

This provides:
- ✅ Testing capability NOW
- ✅ Survival of future schema changes
- ✅ Foundation for production deployment LATER
- ✅ Reasonable time investment
