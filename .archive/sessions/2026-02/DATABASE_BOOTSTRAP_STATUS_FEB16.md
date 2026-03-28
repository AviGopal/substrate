# Database Bootstrap Status - February 16, 2026

## Current Situation

### ✅ What's Working
- **RPC API Deployment**: Version 0.16.13 fully deployed (server + 3 workers)
- **Database Connectivity**: Production pods can connect to SurrealDB
- **Basic Operations**: API is responding to health checks

### ❌ What's Not Verified
- **Bootstrap Templates**: Haven't confirmed templates are registered in database
- **Organization Setup**: Don't know if default organizations exist
- **Project Setup**: Don't know if default projects exist  
- **Template Inheritance**: Can't verify inheritance mechanism is configured

## Investigation Findings

### SurrealDB Credential Confusion 

**Discovery**: Found conflicting credential information:

| Source | Username | Password | Notes |
|--------|----------|----------|-------|
| Kubernetes Secret (`surrealdb-credentials`) | `metabob-admin` | `production-password-change-me` | Updated during deployment fix |
| Production Pod Environment | `root` | `changeme` | **Actually being used** |
| Deployment YAML | References secret | References secret | Configured correctly but pods show different values |

**Status**: ⚠️  **UNRESOLVED MYSTERY**
- Deployment references the secret properly
- But running pods show `root`/`changeme` instead of secret values
- Pods are working fine with `root`/`changeme`
- This suggests:
  1. Pods were started before secret was updated, OR
  2. Secret values aren't being injected properly, OR  
  3. `root`/`changeme` are the actual correct credentials

**Action Needed**: Restart pods to pick up current secret values (in progress)

### Database Access Issues

**Problem**: Cannot connect to SurrealDB from local machine

Attempted methods:
1. ❌ Port forward to localhost:8000 - Port already in use by unknown service
2. ❌ Port forward to localhost:8001 - WebSocket connection rejected (HTTP 200 instead of 101)
3. ❌ Direct `surreal` CLI in pod - Command not found
4. ❌ Export database from pod - "Protocol does not support backups"
5. ❌ Admin CLI from local - Authentication failures

**Why this matters**: Can't verify bootstrap templates are registered

**Workaround**: Port forward to RPC API succeeded (port 8080)
- Health endpoint responding: `{"status":"ok","version":"0.16.0"}`
- Could potentially query through API endpoints (if we had API key)

## Bootstrap Template Status

### Repository Status
- **Location**: `repos/metabob-proto/activities/bootstrap/`
- **Count**: **16 templates**
- **All V2 Schema**: ✅ Migration complete (per ACTIVITY_TEMPLATE_MIGRATION_PLAN.md)

**Templates Available**:
1. `activity-create.json` - Create new activity templates
2. `activity-create-v2.json` - V2 of template creation
3. `activity-debug.json` - Debug activity execution issues  
4. `activity-evolve.json` - Evolve existing templates
5. `add-rest-endpoint.json` - Add REST API endpoints
6. `boredom-task-processor.json` - Background task processing
7. `bug-fix.json` - Fix bugs with tests
8. `code-analysis.json` - Analyze code quality
9. `create-activity-template-v3-compat.json` - V3 template creation (compat)
10. `create-activity-template-v3.json` - V3 template creation
11. `feature-impl.json` - Implement new features
12. `fix-security-bug.json` - Fix security vulnerabilities
13. `jiggle-documentation.json` - Update documentation
14. `refactor.json` - Refactor code safely
15. `safe-refactor.json` - Safe refactoring workflow
16. `security-audit-complete.json` - Complete security audit

### Database Status
- **Status**: ⚠️  **UNKNOWN** - Cannot verify
- **Last Known Registration**: Unknown
- **Registration Script**: `scripts/register-bootstrap-templates.py` exists

## Template Inheritance Design

### Requirement (From User)
> "When we create a new organization / project we will want to inherit the templates from the default project of the same organization."

### Expected Architecture

```
Organization (e.g., "Acme Corp")
├── Default Project ("Default")
│   ├── Bootstrap Template 1 (enabled)
│   ├── Bootstrap Template 2 (enabled)
│   └── Bootstrap Template N (enabled)
│
└── New Project ("My App")
    ├── Inherits: Bootstrap Template 1 (from Default)
    ├── Inherits: Bootstrap Template 2 (from Default)
    └── Inherits: Bootstrap Template N (from Default)
```

### Database Schema Required

**Tables**:
1. `organization` - Organizations
2. `project` - Projects (with `organization` FK and `is_default` flag)
3. `activity_template` - Templates (with `is_bootstrap` flag)
4. `project_activity_template` - Junction table with:
   - `project` (FK)
   - `activity_template` (FK)
   - `inherited_from` (optional FK to parent project)
   - `is_enabled` (bool)
   - `created_at`, `updated_at`

### Inheritance Logic

**When creating a new project**:
1. Check if organization has a default project
2. If yes:
   - Copy all `project_activity_template` relationships from default project
   - Set `inherited_from` to reference default project
   - Set `is_enabled` based on default project's settings
3. If no default project:
   - Optionally auto-enable all bootstrap templates
   - OR leave empty for manual configuration

**When creating a new organization**:
1. Optionally create a default project automatically
2. Auto-assign all bootstrap templates to default project
3. Set `is_enabled=true` for all bootstrap templates

## What Needs To Happen

### Immediate Actions

#### 1. Verify Database Bootstrap ✅ (HIGH PRIORITY)

**Goal**: Confirm 16 bootstrap templates are registered in database

**Method 1: Through RPC API** (Preferred if we have credentials)
```bash
# Need API key or session token
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8080/api/activities/templates
```

**Method 2: Run registration script**
```bash
# From production pod
kubectl exec -it metabob-rpc-api-xxx -- python scripts/register-bootstrap-templates.py
```

**Method 3: Check through admin CLI**
```bash
cd repos/metabob-rpc-api
# Set correct credentials
export SURREAL_URL="ws://surrealdb:8000"
export SURREAL_USER="root"
export SURREAL_PASS="changeme"
# Run from within a pod
kubectl exec -it metabob-rpc-api-xxx -- python -m admin.cli activities list
```

**Success Criteria**:
- [ ] 16 templates exist in database
- [ ] All have `is_bootstrap=true`
- [ ] All are `status=active` or `status=published`
- [ ] All use V2 schema

#### 2. Verify Organization & Project Setup ⚠️ (HIGH PRIORITY)

**Goal**: Confirm at least one organization with a default project exists

**Check**:
```sql
-- Organizations
SELECT * FROM organization;

-- Projects (with default flag)
SELECT * FROM project WHERE is_default = true;

-- Projects by organization
SELECT * FROM project ORDER BY organization, is_default DESC;
```

**Success Criteria**:
- [ ] At least one organization exists
- [ ] Each organization has at least one project marked `is_default=true`
- [ ] Default projects have `is_enabled=true`

#### 3. Verify Template Inheritance 📋 (HIGH PRIORITY)

**Goal**: Confirm inheritance mechanism is implemented

**Check**:
```sql
-- Check junction table exists
INFO FOR TABLE project_activity_template;

-- Check relationships
SELECT * FROM project_activity_template LIMIT 10;

-- Count templates per project
SELECT 
  project,
  count() as template_count,
  count(inherited_from) as inherited_count
FROM project_activity_template 
GROUP BY project;
```

**Success Criteria**:
- [ ] `project_activity_template` table exists
- [ ] Has columns: `project`, `activity_template`, `inherited_from`, `is_enabled`
- [ ] Default projects have direct relationships (inherited_from=NULL)
- [ ] Non-default projects have inherited relationships (inherited_from=<default_project_id>)

#### 4. Fix Credential Confusion 🔧 (MEDIUM PRIORITY)

**Goal**: Resolve which credentials are correct

**Steps**:
1. Wait for pods to restart (rollout restart in progress)
2. Check new pods' environment variables
3. If still showing `root`/`changeme`:
   - Update deployment values to use correct credentials
   - OR update secret to have `root`/`changeme` (if those are correct)
4. Verify pods can still connect after change

**Success Criteria**:
- [ ] All pods use same credentials
- [ ] Credentials match what's in Kubernetes secret
- [ ] Database connections work

### Follow-up Actions

#### 5. Implement Template Inheritance (If Not Present) 🏗️

If the database doesn't have inheritance set up:

**Option A: Database Migration Script**
```python
# scripts/setup_template_inheritance.py
# 1. Find all organizations
# 2. For each org, find or create default project
# 3. Assign all bootstrap templates to default project
# 4. For non-default projects, create inherited relationships
```

**Option B: Update Project Creation Logic**
```python
# In server/actions/projects.py or similar
async def create_project(org_id, name, is_default=False):
    # 1. Create project record
    # 2. If not default:
    #    - Find default project for organization
    #    - Copy template relationships with inherited_from set
    # 3. If default:
    #    - Assign all bootstrap templates directly
```

#### 6. API Documentation 📚

Document the inheritance behavior:
- How templates are inherited
- How to override inherited templates
- How to add custom templates to projects
- How to disable inherited templates

## Open Questions

1. **Are pods using correct credentials after restart?**
   - Check: `kubectl get pods` (look for new pods)
   - Verify: `kubectl exec` and check SURREAL_USER/SURREAL_PASS

2. **Are bootstrap templates in database?**
   - Need: Database access or API key
   - Alternative: Run registration script to ensure

3. **Does inheritance mechanism exist?**
   - Need: Database schema inspection
   - Check: `project_activity_template` table structure

4. **Are there any existing organizations/projects?**
   - Need: Database query
   - Impact: Determines if we need seed data

## Next Steps (Prioritized)

1. **Wait for pod restarts to complete** (2-3 minutes)
2. **Verify pods have correct credentials**
3. **Get database access working** (via API key or direct connection)
4. **Run verification queries** (templates, orgs, projects, inheritance)
5. **Document current state** (what exists, what's missing)
6. **Implement missing pieces** (if any)
7. **Create bootstrap script** (for new deployments)

## Tools Available

- ✅ `scripts/register-bootstrap-templates.py` - Register templates
- ✅ `repos/metabob-rpc-api/admin/cli.py` - Admin commands
- ✅ RPC API at localhost:8080 - Port forwarded
- ❌ Direct SurrealDB access - Not working yet
- ⏳ Pod restarts - In progress

## Files Modified This Session

1. `/home/avi/documents/work/platform/metabob-apps/charts/surrealdb/values/production.surrealdb.values.yaml`
   - Added auth credentials (but may not have taken effect)

## Related Documentation

- `ACTIVITY_TEMPLATE_MIGRATION_PLAN.md` - Template V2 migration (complete)
- `ACTIVITY_SYSTEM_QUICK_START.md` - Activity system overview
- `BOOTSTRAP_QUICK_START.md` - Bootstrap template guide (if exists)

---

**Status as of**: February 16, 2026, 20:15 UTC
**Deployment Version**: RPC API 0.16.13
**Database**: SurrealDB (production namespace, production database)
**Blocker**: Cannot verify database state due to connection issues
