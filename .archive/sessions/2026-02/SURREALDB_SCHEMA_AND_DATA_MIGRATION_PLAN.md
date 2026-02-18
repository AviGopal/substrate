# SurrealDB Schema and Data Migration Plan

**Date**: February 16, 2026  
**Status**: 📋 Planning Phase  
**Goal**: Migrate local SurrealDB schemas and data to Metabob organization production environment

---

## Current State Analysis

### Local Development Environment

**SurrealDB Configuration**:
- **URL**: `ws://localhost:8000`
- **Namespace**: `metabob`
- **Database**: `production` (config default - but likely using `devbob` locally)
- **User**: `local`
- **Running**: ✅ Container `metabob-surreal` healthy (port 8000)
- **Admin UI**: ✅ Surrealist on port 8001

### Schema Sources

#### 1. **Generated Schema** (Proto-based)
**Location**: `repos/metabob-proto/scripts/generate_surreal_schema.py`
- Parses `.proto` files from metabob-proto
- Generates SurrealQL schema with annotations
- **Usage**: `python scripts/generate_surreal_schema.py > schema.surql`

#### 2. **RPC API Schema Initialization**
**Location**: `repos/metabob-rpc-api/server/actions/`
- `init_auth_schema.py` - Organizations, users, API keys, projects, subscriptions
- `init_activity_schema.py` - Activities, variants, impressions, executions, impulses
- `init_metrics_schema.py` - Metric events, daily metrics
- `init_schema_version.py` - Schema version tracking

#### 3. **Manual Migration Scripts**
**Location**: `sql/migrations/`
- `002-execution-steps-table.surql` - Execution steps tracking
- `003-agent-executions-table.surql` - Agent execution history
- `004-tool-invocations-table.surql` - Tool invocation logging
- `005-impulse-tables.surql` - Impulse registry and usage

#### 4. **Local Test Data**
**Location**: Project root
- `create_api_key.surql` - API key creation script
- `create_test_data.surql` - Test data generation
- `recreate_test_data.surql` - Reset and recreate test data
- `update_activity_create.surql` - Activity template updates

### Key Tables Identified

**Activity System** (8 tables):
- `activities` - Activity definitions (templates)
- `activity_variants` - A/B testing variants
- `activity_executions` - Execution history (unified)
- `activity_impressions` - Recommendation tracking
- `activity_selections` - User choices
- `activity_conversions` - Conversion tracking
- `activity_experiments` - A/B experiments
- `variant_performance_metrics` - Performance aggregates

**Consumer Profiles** (1 table):
- `consumer_profiles` - Agent behavior tracking

**Impulse System** (2 tables):
- `impulse_registry` - Impulse definitions
- `impulse_usage` - Usage tracking

**Auth & Organization** (5 tables):
- `organizations` - Organization accounts
- `users` - User accounts
- `api_keys` - API authentication
- `projects` - Project definitions
- `subscriptions` - Subscription plans

**Execution Tracking** (3 tables):
- `execution_steps` - Individual step tracking
- `agent_executions` - Agent execution history
- `tool_invocations` - Tool call logging

**Metrics** (2 tables):
- `metric_events` - Event-level metrics
- `daily_metrics` - Aggregated daily stats

**Schema Management** (1 table):
- `schema_versions` - Schema version control

---

## Migration Strategy

### Phase 1: Schema Export & Documentation ✅ READY

**Goal**: Export current production schema and document table definitions

**Actions**:
1. **Export Current Schema**:
   ```bash
   # Connect to local SurrealDB
   docker exec metabob-surreal surreal sql \
     --endpoint http://localhost:8000 \
     --namespace metabob \
     --database devbob \
     --username root \
     --password root \
     --command "INFO FOR DB;" > schema_export.txt
   
   # Export full table definitions
   docker exec metabob-surreal surreal export \
     --endpoint http://localhost:8000 \
     --namespace metabob \
     --database devbob \
     --username root \
     --password root \
     schema_export.surql
   ```

2. **Generate Clean Schema from Proto**:
   ```bash
   cd repos/metabob-proto
   python scripts/generate_surreal_schema.py --output ../../sql/generated_schema.surql
   ```

3. **Consolidate Migration Scripts**:
   - Merge all `.surql` files from `sql/migrations/`
   - Create single `schema_complete_v1.surql` file
   - Add version metadata and timestamps

**Output Files**:
- `sql/schema_export_local.surql` - Current local schema
- `sql/generated_schema_v1.surql` - Proto-generated schema
- `sql/schema_complete_v1.surql` - Consolidated production schema
- `SURREALDB_SCHEMA_DOCUMENTATION.md` - Table reference doc

### Phase 2: Data Export & Anonymization 🔄 NEXT

**Goal**: Export local development data with proper anonymization

**Actions**:
1. **Identify Data Categories**:
   - **Production-Ready**: Activity templates, schema versions
   - **Test Only**: Test users, test API keys, local executions
   - **Sensitive**: Real API keys, user emails, organization data
   - **Metrics**: Execution history, performance data

2. **Export Production-Ready Data**:
   ```bash
   # Activity templates (from local bootstrap)
   docker exec metabob-surreal surreal sql \
     --endpoint http://localhost:8000 \
     --namespace metabob \
     --database devbob \
     --username root \
     --password root \
     --command "SELECT * FROM activities;" > data_activities.json
   
   # Activity variants (V2 templates)
   docker exec metabob-surreal surreal sql \
     --command "SELECT * FROM activity_variants;" > data_variants.json
   ```

3. **Create Anonymization Script**:
   ```python
   # scripts/anonymize_data.py
   import json
   import hashlib
   
   def anonymize_user_data(data):
       # Hash emails, remove real names, etc.
       pass
   
   def filter_production_activities(data):
       # Only include bootstrap templates
       pass
   ```

4. **Generate Clean Import Data**:
   - `data/activities_bootstrap.json` - 16 V2 bootstrap templates
   - `data/schema_version.json` - Current schema version
   - `data/default_consumer_profile.json` - Default agent profile

**Output Files**:
- `data/export_anonymized.tar.gz` - Anonymized export
- `data/bootstrap_only.surql` - Bootstrap templates only
- `SURREALDB_DATA_ANONYMIZATION_REPORT.md` - What was filtered

### Phase 3: Production Environment Setup 🔄 NEXT

**Goal**: Set up SurrealDB in production with proper configuration

**Options**:

#### Option A: Managed SurrealDB Cloud
- **Pros**: Managed backups, scaling, security
- **Cons**: Cost, vendor lock-in
- **Setup**: Create account at surrealdb.com

#### Option B: Self-Hosted on K8s (Recommended)
- **Pros**: Full control, cost-effective, integrates with existing infrastructure
- **Cons**: Manual backup/restore setup
- **Setup**: Deploy SurrealDB via Helm chart

#### Option C: Docker Compose on VM
- **Pros**: Simple setup, good for staging
- **Cons**: No HA, manual scaling
- **Setup**: Deploy with docker-compose

**Recommended**: **Option B** - Deploy SurrealDB on existing K8s cluster

**Actions**:
1. **Add SurrealDB Helm Chart**:
   ```bash
   cd ~/documents/work/platform/metabob-apps/charts
   mkdir -p surrealdb
   cd surrealdb
   
   # Create values.yaml
   cat > values.yaml << 'YAML'
   image:
     repository: surrealdb/surrealdb
     tag: latest
   
   persistence:
     enabled: true
     size: 100Gi
     storageClass: standard
   
   auth:
     rootUsername: root
     rootPassword: <generated-secure-password>
   
   resources:
     requests:
       memory: "2Gi"
       cpu: "1000m"
     limits:
       memory: "4Gi"
       cpu: "2000m"
   
   service:
     type: ClusterIP
     port: 8000
   
   # Backup configuration
   backup:
     enabled: true
     schedule: "0 2 * * *"  # Daily at 2am
     retention: 30
   YAML
   ```

2. **Deploy to Production**:
   ```bash
   cd ~/documents/work/platform/environments
   
   # Add to helmfile.yaml
   helmfile -e production sync
   ```

3. **Configure Backend Connection**:
   ```yaml
   # metabob-rpc-api/values.yaml
   env:
     SURREAL_URL: "ws://surrealdb:8000"
     SURREAL_NAMESPACE: "metabob"
     SURREAL_DATABASE: "production"
     SURREAL_USER: "api_user"
     SURREAL_PASSWORD: "<from-secret>"
   ```

**Output Files**:
- `platform/metabob-apps/charts/surrealdb/values.yaml`
- `platform/metabob-apps/charts/surrealdb/Chart.yaml`
- `SURREALDB_PRODUCTION_DEPLOYMENT.md`

### Phase 4: Schema Migration 🔄 PENDING

**Goal**: Apply schema to production SurrealDB

**Actions**:
1. **Create Migration Job**:
   ```yaml
   # k8s-job-schema-migration.yaml
   apiVersion: batch/v1
   kind: Job
   metadata:
     name: surrealdb-schema-migration-v1
   spec:
     template:
       spec:
         containers:
         - name: migration
           image: surrealdb/surrealdb:latest
           command:
           - /bin/sh
           - -c
           - |
             surreal import \
               --endpoint $SURREAL_URL \
               --namespace metabob \
               --database production \
               --username $SURREAL_USER \
               --password $SURREAL_PASSWORD \
               /schemas/schema_complete_v1.surql
           volumeMounts:
           - name: schemas
             mountPath: /schemas
         volumes:
         - name: schemas
           configMap:
             name: surrealdb-schemas
         restartPolicy: OnFailure
   ```

2. **Apply Schema**:
   ```bash
   # Create ConfigMap with schema
   kubectl create configmap surrealdb-schemas \
     --from-file=sql/schema_complete_v1.surql \
     -n production
   
   # Run migration job
   kubectl apply -f k8s-job-schema-migration.yaml -n production
   
   # Watch logs
   kubectl logs -f job/surrealdb-schema-migration-v1 -n production
   ```

3. **Verify Schema**:
   ```bash
   # Port-forward to SurrealDB
   kubectl port-forward svc/surrealdb 8000:8000 -n production
   
   # Connect with Surrealist or CLI
   surreal sql --endpoint ws://localhost:8000 \
     --namespace metabob \
     --database production \
     --username root \
     --password <password>
   
   # Run verification
   INFO FOR DB;
   ```

**Output Files**:
- `k8s/jobs/surrealdb-schema-migration-v1.yaml`
- `SURREALDB_SCHEMA_MIGRATION_REPORT.md`

### Phase 5: Data Import 🔄 PENDING

**Goal**: Import bootstrap data to production

**Actions**:
1. **Create Data Import Job** (similar to schema migration):
   ```bash
   kubectl create configmap surrealdb-bootstrap-data \
     --from-file=data/bootstrap_only.surql \
     -n production
   
   kubectl apply -f k8s-job-data-import.yaml -n production
   ```

2. **Verify Bootstrap Data**:
   ```sql
   -- Check activities
   SELECT count() FROM activities GROUP ALL;
   
   -- Check variants
   SELECT count() FROM activity_variants GROUP ALL;
   
   -- Verify V2 templates
   SELECT activity_id, name, status FROM activities;
   ```

3. **Create Default Organization**:
   ```sql
   -- Create Metabob organization
   CREATE organizations:metabob SET
     name = "Metabob",
     slug = "metabob",
     plan = "enterprise",
     status = "active",
     created_at = time::now();
   
   -- Link activities to metabob org
   UPDATE activities SET org_id = "metabob";
   ```

**Output Files**:
- `k8s/jobs/surrealdb-data-import-v1.yaml`
- `SURREALDB_DATA_IMPORT_REPORT.md`

### Phase 6: Backend Integration Testing 🔄 PENDING

**Goal**: Verify RPC API works with production SurrealDB

**Actions**:
1. **Deploy metabob-rpc-api:0.16.13** (already pushed)
2. **Run Integration Tests**:
   ```bash
   # Test activity search
   curl -X POST https://api.metabob.com/v2/activities/search \
     -H "Authorization: Bearer $API_KEY" \
     -d '{"category": "feature"}'
   
   # Test activity execution
   curl -X POST https://api.metabob.com/v2/activities/execute \
     -H "Authorization: Bearer $API_KEY" \
     -d '{"activity_id": "feature-impl-562c3ce9", "variables": {...}}'
   ```

3. **Monitor Metrics**:
   - Activity discovery latency
   - Template search performance
   - Execution success rates

**Output Files**:
- `SURREALDB_INTEGRATION_TEST_RESULTS.md`

---

## Data Ownership & Organization Structure

### Metabob Organization Setup

**Production Structure**:
```
Namespace: metabob
  Database: production
    Organizations:
      - metabob (main org)
        - Projects:
          - devbob-platform
          - metabob-proto
          - metabob-rpc-api
          - metabob-dashboard
        - Users:
          - admin@metabob.com
          - api_service_account
        - API Keys:
          - production_api_key (for services)
          - admin_api_key (for CLI)
    
    Bootstrap Activities (shared across orgs):
      - 16 V2 templates (org_id: "metabob")
      - Marked as "official" templates
      - Available for discovery by all orgs
```

**Multi-Tenant Support** (Future):
```
Organizations:
  - customer_org_1
  - customer_org_2
  - customer_org_3
    Each has:
      - Own projects
      - Own users
      - Own executions
      - Can create custom activities
      - Can use bootstrap templates
```

### Data Isolation Strategy

**Org-level Isolation**:
- All tables have `org_id` field
- Queries filter by org_id automatically (via SurrealDB permissions)
- Bootstrap templates are "metabob" org but visible to all

**Project-level Isolation**:
- Executions tracked by `org_id` + `project_id`
- Metrics aggregated by project
- API keys scoped to project

**Example SurrealDB Permissions**:
```sql
-- User can only see their org's data
DEFINE SCOPE user_scope SESSION 24h
  SIGNUP ( CREATE users SET email = $email, org_id = $org_id, ... )
  SIGNIN ( SELECT * FROM users WHERE email = $email AND password = crypto::argon2::compare(password, $password) );

-- Enforce org_id filtering
DEFINE FIELD org_id ON activities PERMISSIONS FOR select, update, delete WHERE org_id = $auth.org_id;
```

---

## Migration Checklist

### Pre-Migration
- [ ] Export local schema to `sql/schema_export_local.surql`
- [ ] Generate proto-based schema to `sql/generated_schema_v1.surql`
- [ ] Consolidate to `sql/schema_complete_v1.surql`
- [ ] Export bootstrap activities (16 V2 templates)
- [ ] Create anonymization script for test data
- [ ] Document all tables in `SURREALDB_SCHEMA_DOCUMENTATION.md`

### Production Setup
- [ ] Deploy SurrealDB via Helm to K8s
- [ ] Create "metabob" organization
- [ ] Create API service account
- [ ] Generate production API keys
- [ ] Configure backup schedule (daily)
- [ ] Set up monitoring (Prometheus + Grafana)

### Schema Migration
- [ ] Create schema migration K8s Job
- [ ] Apply schema to production DB
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Run schema validation tests

### Data Migration
- [ ] Import bootstrap activities (16 templates)
- [ ] Verify activity variants
- [ ] Create default consumer profiles
- [ ] Link activities to "metabob" org
- [ ] Verify data integrity

### Backend Integration
- [ ] Update metabob-rpc-api config (SURREAL_URL)
- [ ] Deploy metabob-rpc-api:0.16.13
- [ ] Run integration tests
- [ ] Verify activity search works
- [ ] Verify activity execution works
- [ ] Monitor metrics and errors

### Post-Migration
- [ ] Document connection strings
- [ ] Update developer documentation
- [ ] Create backup/restore runbooks
- [ ] Set up alerting for DB health
- [ ] Archive local SurrealDB data

---

## Security Considerations

### Access Control
- **Root user**: Only for schema migrations (rotate password)
- **API service account**: Limited to CRUD on tables (not schema)
- **User accounts**: Scoped to org_id via SurrealDB permissions

### Secrets Management
- **K8s Secrets**: Store DB passwords
- **API Keys**: Encrypted in database
- **Connection Strings**: Never in code, use env vars

### Network Security
- **Internal only**: SurrealDB not exposed publicly
- **Service-to-service**: RPC API → SurrealDB via internal ClusterIP
- **Admin access**: Port-forward only (no ingress)

### Backup & Disaster Recovery
- **Daily backups**: Automated via CronJob
- **Retention**: 30 days
- **Restore testing**: Monthly DR drills
- **Point-in-time recovery**: Using SurrealDB export

---

## Cost Estimation

### Self-Hosted SurrealDB (K8s)

**Resources**:
- CPU: 1-2 cores
- Memory: 2-4 GB
- Storage: 100 GB SSD

**Monthly Cost** (AWS EKS example):
- Compute: ~$50/month (t3.medium equivalent)
- Storage: ~$10/month (100GB gp3)
- **Total**: ~$60/month

**vs Managed SurrealDB Cloud**: $300-500/month (estimated)

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 1. Schema Export & Documentation | 2 hours | ✅ Ready to start |
| 2. Data Export & Anonymization | 3 hours | 🔄 Pending |
| 3. Production Environment Setup | 4 hours | 🔄 Pending |
| 4. Schema Migration | 2 hours | 🔄 Pending |
| 5. Data Import | 2 hours | 🔄 Pending |
| 6. Backend Integration Testing | 3 hours | 🔄 Pending |
| **Total** | **16 hours (~2 days)** | 🎯 |

---

## Next Steps

### Immediate (Today)
1. **Export local schema**:
   ```bash
   cd ~/documents/work/exp-repo/metabob-devbob
   ./scripts/export_surrealdb_schema.sh
   ```

2. **Generate consolidated schema**:
   ```bash
   cd repos/metabob-proto
   python scripts/generate_surreal_schema.py --output ../../sql/generated_schema_v1.surql
   ```

3. **Export bootstrap activities**:
   ```bash
   ./scripts/export_bootstrap_activities.sh
   ```

### Short-term (This Week)
1. Deploy SurrealDB to staging K8s
2. Test schema migration on staging
3. Verify RPC API integration on staging

### Medium-term (Next Week)
1. Production SurrealDB deployment
2. Schema + data migration to production
3. Deploy metabob-rpc-api:0.16.13 to production
4. Monitor and validate

---

**Status**: 📋 **Planning Complete - Ready for Execution**  
**Next Action**: Run Phase 1 (Schema Export)  
**Owner**: DevOps + Backend Team

