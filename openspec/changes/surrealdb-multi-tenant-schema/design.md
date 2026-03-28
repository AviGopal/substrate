## Context

**Current State:**
- `metabob-proto/`: Contains protobuf definitions + skeletal migration framework, but no actual SurrealDB schemas deployed
- `metabob-activity-api/sql/`: Has 9 production schema files (001-init through 008-unified-activity-model) with partial multi-tenancy (org_id/project_id fields but no RBAC)
- `metabob-analysis-api/`: New service with Zod validation only, no SurrealDB schemas defined
- Schema deployment: Manual execution of .surql files, no versioning or rollback capability
- Authentication: Currently anonymous or application-level JWT validation, no database-enforced isolation
- Multi-tenancy: Table-level org_id/project_id fields exist in activity-api but not enforced by database

**Constraints:**
- Must maintain backward compatibility with existing activity-api data (migration required, not destructive replacement)
- SurrealDB 3.0+ only (leveraging DEFINE ACCESS and PERMISSIONS features)
- All services deployed in Kubernetes with Istio service mesh
- Bun runtime for TypeScript services (migration tooling must use Bun, not Node.js)
- Shared SurrealDB instance (namespace: `production`, database: `metabob`) - not separate DB per tenant

**Stakeholders:**
- metabob-activity-api: Needs activity execution data scoped by org/project
- metabob-analysis-api: Needs auth/billing tables + analysis data scoped by org/project
- metabob-cloud-dashboard: Needs full org/user/project/billing CRUD operations
- metabob-mcp: Read-only access to analysis data (inherits auth from analysis-api)
- minibob vessels: Need autonomous authentication for boredom activities

## Goals / Non-Goals

**Goals:**
- Database-enforced multi-tenant isolation using SurrealDB 3.0 RBAC (no application-level filtering required)
- Unified core schemas (org, user, project, subscription) shared across all services
- Federated schema ownership: each service owns its domain schemas, imports core
- Versioned migration system with rollback capability
- Public activity template marketplace with scope-aware permissions (global/org/project)
- Zero-downtime migration path from current activity-api schema to RBAC-enabled schema
- Deployment activities as measured MiniBob workflows (not bash scripts)

**Non-Goals:**
- Separate namespace or database per tenant (using shared DB with table-level isolation instead)
- Protobuf code generation from SurrealDB schemas (metabob-proto becomes schema source, not protobuf source)
- Cross-region data replication or sharding (single SurrealDB instance for now)
- Backward compatibility with SurrealDB 2.x (3.0+ required)
- Application-level permission checking (delegating entirely to database PERMISSIONS clauses)

## Decisions

### Decision 1: Table-Level Tenancy with org_id/project_id (Not Namespace-Per-Org)

**Choice:** Shared namespace (`production`) and database (`metabob`) with org_id/project_id fields on all tables

**Alternatives Considered:**
- Namespace-per-org: Complete isolation but schema evolution nightmare (9 migration files × N orgs)
- Database-per-project: Better than namespace-per-org but still complex (project migrations)
- Table-level with app filtering: Current state, no database enforcement

**Rationale:**
- SurrealDB 3.0 PERMISSIONS clauses provide **database-enforced** row-level isolation
- Schema migrations apply once to shared DB (not N times per tenant)
- Cross-org analytics possible (Thompson sampling learns globally)
- Public templates shareable across orgs (scope = 'global')
- Indexed org_id/project_id filtering performs well per SurrealDB benchmarks

**Trade-offs:**
- All tenants share DB instance (acceptable for current scale)
- Cannot isolate per-tenant backups (acceptable - use SurrealDB EXPORT with WHERE filtering if needed)
- Schema changes affect all tenants simultaneously (acceptable - testing happens in staging namespace)

### Decision 2: Hybrid Schema Ownership Model

**Choice:**
- **Core schemas** (auth/billing/multi-tenancy) → `metabob-proto/surrealdb/core/`
- **Activity schemas** → `repos/metabob-activity-api/sql/schemas/`
- **Analysis schemas** → `repos/metabob-analysis-api/sql/schemas/`

**Alternatives Considered:**
- Fully centralized: All schemas in metabob-proto (tight coupling, slow iteration)
- Fully federated: Each service owns all its schemas including org/user (duplication, drift risk)

**Rationale:**
- Core schemas (org, user, api_key, project) are **shared contracts** between services
- Domain schemas (activity_registry, analysis_problems) are **service-specific**
- metabob-proto becomes dependency for activity-api and analysis-api (provides core schema imports)
- Each service can iterate on its domain schemas without blocking others
- Clear ownership boundaries: analysis-api owns auth/billing tables, activity-api owns execution data

**Implementation:**
```typescript
// repos/metabob-activity-api/sql/migrate.ts
import { applyCoreSchemas } from '@metabob/proto/surrealdb';
import { applyActivitySchemas } from './schemas/apply.ts';

await applyCoreSchemas(db); // From metabob-proto
await applyActivitySchemas(db); // Local schemas
```

### Decision 3: Dual Authentication (JWT + RECORD)

**Choice:** Implement both `DEFINE ACCESS jwt_external TYPE JWT` and `DEFINE ACCESS minibob_record TYPE RECORD`

**Alternatives Considered:**
- JWT-only: Doesn't solve autonomous MiniBob authentication
- RECORD-only: Requires custom auth service, no OAuth2 integration
- BEARER tokens: Too simple, no claims/scoping

**Rationale:**
- **JWT (external users):** Dashboard users, API clients, IDE extensions
  - Claims: `org_id`, `project_ids`, `role`, `user_id`
  - Issued by external auth service (OAuth2 flow)
  - Short-lived tokens (15m), session refresh (12h)

- **RECORD (MiniBob instances):** Autonomous vessels running boredom activities
  - Each MiniBob instance has entry in `minibob_instance` table with `org_id`, `project_id`, `api_key_hash`
  - SIGNIN query validates instance_id + api_key
  - Cannot impersonate users, scoped to specific project
  - Longer-lived tokens (24h) for autonomous operation

**Security model:**
```sql
-- JWT users can read/write data in their org/projects
WHERE org_id = $auth.org_id AND project_id IN $auth.project_ids

-- MiniBob instances can only write execution traces for their assigned project
WHERE org_id = $auth.org_id AND project_id = $auth.project_id
```

### Decision 4: Bun-Based Migration System (Not surrealdb-migrations CLI)

**Choice:** Custom Bun TypeScript migration runner instead of Rust `surrealdb-migrations` CLI

**Alternatives Considered:**
- surrealdb-migrations (Rust CLI): Battle-tested but Rust dependency in Bun ecosystem
- Manual .surql execution: Current state, no versioning or rollback
- TypeScript with node-surreal: Requires Node.js in Bun-native stack

**Rationale:**
- Bun-native stack (all services use Bun runtime)
- Can reuse existing SurrealDB client from activity-api/analysis-api
- Migration logic can import TypeScript types from services
- Easier to customize for federated schema model (core + domain schemas)
- No Rust toolchain required in Docker images or CI/CD

**Structure:**
```typescript
// metabob-proto/surrealdb/migrate.ts
export async function applyCoreSchemas(db: Surreal, options?: MigrationOptions) {
  const migrations = [
    '001-auth-access.surql',
    '002-organizations.surql',
    '003-projects.surql',
    '004-subscriptions.surql'
  ];

  for (const file of migrations) {
    await applyMigration(db, file, options);
  }
}

// repos/metabob-activity-api/sql/migrate.ts
import { applyCoreSchemas } from '@metabob/proto/surrealdb';

await applyCoreSchemas(db);
await applyActivitySchemas(db); // Local schemas
```

### Decision 5: Public Template Marketplace via scope Field

**Choice:** Add `scope` ENUM ('global', 'org', 'project') and `public` BOOLEAN to `activity_registry` table

**Alternatives Considered:**
- Separate tables: `public_templates` vs `private_templates` (duplication, complex queries)
- Visibility via permissions only: No semantic distinction between scopes
- Marketplace as separate service: Over-engineering for MVP

**Rationale:**
- Single table with scope-aware permissions:
  ```sql
  PERMISSIONS FOR select WHERE
    (scope = 'global' AND public = true)  -- Anyone can see
    OR (scope = 'org' AND org_id = $auth.org_id)  -- Org private
    OR (scope = 'project' AND project_id IN $auth.project_ids)  -- Project private
  ```
- Thompson Sampling learns across all scopes (global templates get more data)
- Orgs can publish templates to marketplace (set scope='global', public=true)
- Clear ownership: global templates owned by metabob org, others by creator org

**Migration path:**
```sql
-- Add fields to existing activity_template table
ALTER TABLE activity_registry ADD scope string DEFAULT 'org';
ALTER TABLE activity_registry ADD public bool DEFAULT false;

-- Migrate existing templates
UPDATE activity_registry SET scope = 'org', public = false WHERE scope IS NONE;
```

## Risks / Trade-offs

### Risk 1: Schema Migration Failures on Existing Data
**Risk:** Adding org_id fields to existing activity-api tables with millions of execution traces could fail or timeout

**Mitigation:**
- Use staged migration with batching:
  1. Add nullable org_id field
  2. Backfill in batches of 10k records with default org (organization:metabob_internal)
  3. Add NOT NULL constraint after backfill completes
  4. Add indexes last (after data migrated)
- Test migration on staging with production data snapshot
- Provide rollback script that drops added fields
- Document manual intervention steps for large datasets

### Risk 2: Performance Impact of PERMISSIONS Clauses
**Risk:** Database-enforced WHERE filtering on every query could degrade performance vs application-level filtering

**Mitigation:**
- Index org_id and project_id on all tables (DEFINE INDEX)
- Benchmark with realistic query patterns using crud-bench tool
- Monitor query performance in production (SurrealDB metrics)
- Fallback: If PERMISSIONS too slow, move to application-level filtering with auditing
- SurrealDB 3.0 benchmarks show minimal overhead for indexed WHERE clauses

### Risk 3: Circular Dependency (metabob-proto ← activity-api)
**Risk:** activity-api depends on metabob-proto for core schemas, but metabob-proto could depend on activity-api types

**Mitigation:**
- metabob-proto ONLY exports schema files (.surql) and migration runner, no business logic
- No proto → activity-api dependency (one-way only)
- Proto contains zero TypeScript types (those live in consuming services)
- Proto versioning: semver for schema changes, activity-api pins specific version

### Risk 4: Breaking Change to Existing API Clients
**Risk:** Enforcing authentication breaks current anonymous access patterns (e.g., local dev, testing)

**Mitigation:**
- Create "default" organization (organization:metabob_dev) for local development
- Provide test JWT tokens in .env.example
- Add `DISABLE_AUTH=true` flag for local dev (use with caution)
- Document migration guide for existing API clients
- Staged rollout: Deploy RBAC-enabled schema but keep enforcement optional for 1 sprint

### Risk 5: Public Template Security (Malicious Templates)
**Risk:** Public marketplace allows any org to publish templates, potential for malicious activity definitions

**Mitigation:**
- Phase 1: Only metabob org can publish global templates (admin approval required)
- Add `reviewed` boolean field + admin review workflow
- Template validation: Parse task prompts for dangerous patterns (bash rm -rf, etc.)
- Rate limiting on template creation (max N templates per org per day)
- Future: Sandboxed template execution with resource limits

## Migration Plan

### Phase 1: Deploy Core Schemas (Week 1)
1. Create `metabob-proto/surrealdb/core/` directory structure
2. Write core schema files:
   - 001-auth-access.surql (DEFINE ACCESS statements)
   - 002-organizations.surql (organizations, users, api_keys tables)
   - 003-projects.surql (projects table + project_members relation)
   - 004-subscriptions.surql (subscriptions, audit_logs tables)
3. Implement `metabob-proto/surrealdb/migrate.ts` (Bun migration runner)
4. Test core schema deployment on local SurrealDB instance
5. Deploy to staging namespace (production-staging DB)

### Phase 2: Migrate Activity API Schemas (Week 2)
1. Create `repos/metabob-activity-api/sql/schemas/` directory
2. Refactor existing sql/*.surql files to new structure:
   - 010-activity-registry.surql (merge 001-init + 008-unified-activity-model)
   - 011-executions.surql (merge 002-learning + 004-execution-traces)
   - 012-composition.surql (003-goal-paths + 007-control-flow)
3. Add RBAC PERMISSIONS to all tables
4. Write data migration script:
   ```typescript
   // Add org_id to existing records
   UPDATE activity_registry SET org_id = organization:metabob_internal WHERE org_id IS NONE;
   UPDATE activity_execution_traces SET org_id = organization:metabob_internal WHERE org_id IS NONE;
   ```
5. Test migration on staging with production data snapshot
6. Deploy to production (blue-green: keep old tables during migration)

### Phase 3: Create Analysis API Schemas (Week 3)
1. Create `repos/metabob-analysis-api/sql/schemas/` directory
2. Write new schema files:
   - 020-analysis-problems.surql (analysis_problems, code_components tables)
   - 021-patterns.surql (cochange_patterns, impact_relations, design_patterns)
   - 022-annotations.surql (annotations, progressive_sync_state)
3. Add RBAC PERMISSIONS to all tables
4. Implement analysis-api migrate.ts (imports core schemas from proto)
5. Deploy to staging, then production

### Phase 4: Add MiniBob RECORD Authentication (Week 4)
1. Add minibob_instance table to core schemas
2. Create DEFINE ACCESS minibob_record in 001-auth-access.surql
3. Update MiniBob vessels to authenticate via RECORD (instance_id + api_key)
4. Test autonomous boredom activities with RBAC enforcement
5. Deploy to production (backwards compatible: JWT auth still works)

### Phase 5: Deployment Activities (Week 5)
1. Create MiniBob activity templates:
   - deploy-stack-from-scratch.json
   - rollback-stack.json
   - upgrade-stack.json
2. Add validation steps (health checks, schema version verification)
3. Test activities on local cluster
4. Register activities in activity_registry (scope='org', org_id=metabob)
5. Document activity usage in DEPLOYMENT_GUIDE.md

### Rollback Strategy

**If migration fails during Phase 2 (activity-api):**
1. Drop newly added fields: `ALTER TABLE activity_registry DROP org_id;`
2. Restore from pre-migration backup (SurrealDB EXPORT/IMPORT)
3. Revert Helm deployment to previous version
4. Switch DNS back to old service (blue-green deployment)

**If RBAC causes production issues:**
1. Set DISABLE_AUTH=true environment variable (emergency bypass)
2. Investigate PERMISSIONS clause causing issue
3. Fix and redeploy (hot patch)
4. Re-enable auth after validation

**Full rollback (nuclear option):**
1. Export all data: `surreal export --ns production --db metabob backup.surql`
2. Drop database: `REMOVE DATABASE metabob;`
3. Re-import pre-RBAC backup
4. Redeploy services with pre-RBAC code

## Open Questions

### Q1: JWT Signing and Validation
**Question:** Who issues JWTs? Do we build auth service or use external OAuth2 provider (Auth0, Supabase)?

**Options:**
- A) External OAuth2 (Auth0): Less code, industry standard, costs $$
- B) Custom auth service: Full control, no external dependency, more code
- C) SurrealDB RECORD auth for all: No JWT, but harder for dashboard SaaS model

**Decision needed by:** Start of Phase 3 (before analysis-api auth endpoints)

**Recommendation:** Start with B (custom auth service in analysis-api), migrate to A if scaling requires it

### Q2: Subscription Billing Integration
**Question:** How deep is Stripe integration? Do we store payment methods in SurrealDB or rely entirely on Stripe API?

**Options:**
- A) Minimal: Store subscription_id only, query Stripe API for details
- B) Full sync: Mirror Stripe subscription/payment data in SurrealDB
- C) Webhook-based: Stripe webhooks update subscription status in SurrealDB

**Decision needed by:** Phase 3 (subscription schema design)

**Recommendation:** C (webhook-based) - best balance of consistency and simplicity

### Q3: Cross-Service Query Patterns
**Question:** Should analysis-api query activity_registry directly, or always go through activity-api HTTP endpoints?

**Options:**
- A) Direct DB access: Faster, couples services to shared schema
- B) HTTP API only: Slower, cleaner service boundaries
- C) Hybrid: Read from shared DB, write via API

**Decision needed by:** Phase 3 (analysis-api implementation)

**Recommendation:** C (hybrid) - reads are common (template lookup), writes are rare

### Q4: Global Template Moderation
**Question:** What's the approval process for publishing templates to global marketplace?

**Options:**
- A) Auto-publish: Any org can publish, rely on reputation/reporting
- B) Manual review: Metabob team reviews before publish
- C) Automated validation: Parse templates for dangerous patterns, auto-approve if safe

**Decision needed by:** Phase 5 (marketplace launch)

**Recommendation:** Start with B (manual review), scale to C when volume increases
