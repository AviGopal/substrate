# K8s DevBob Production Readiness Assessment

**Date**: March 1, 2026  
**Assessment Type**: Post-Implementation Review  
**System**: DevBob K8s Deployment with SurrealDB Activity Storage

## Executive Summary

✅ **Schema Initialization**: Production-ready using RPC API image  
❌ **Application Persistence**: **BLOCKED** by surrealdb-py library bug  
⚠️  **Deployment Infrastructure**: Ready, but persistence layer non-functional

**Recommendation**: **DO NOT deploy to production** until persistence issue is resolved.

---

## Detailed Assessment

### 1. Schema Initialization ✅

**Status**: PRODUCTION READY

**Implementation**:
- Helm post-install/post-upgrade hook
- Uses `metabobapp/metabob-rpc-api:0.16.14-scope-fix` image
- Python script with direct HTTP RPC calls (bypasses surrealdb-py)
- Creates 13 tables with `PERMISSIONS FULL`

**Verification**:
```
kubectl get events -n metabob | grep 'surrealdb-init-schema'
8m47s       Normal    Completed     job/surrealdb-init-schema      Job completed

kubectl logs -n metabob job/surrealdb-init-schema
✅ 13/13 tables have PERMISSIONS FULL
🎉 Schema initialization successful!
```

**Strengths**:
- ✅ Reliable: Uses `requests` library directly (no auth bugs)
- ✅ Fast: RPC API image has all dependencies pre-installed
- ✅ Consistent: Same environment as application
- ✅ Automated: Helm hook ensures it runs on every deployment
- ✅ Idempotent: Safe to re-run (handles "already exists" errors)

**Deployment Command**:
```bash
cd repos/platform/metabob-apps
helmfile -e default sync --selector 'name=surrealdb'
```

---

### 2. Application Persistence ❌

**Status**: NOT PRODUCTION READY - CRITICAL BLOCKER

**Root Cause**: surrealdb-py v1.x HTTP auth incompatible with SurrealDB v2.3.10

**Evidence**:
```python
# Test: Create template via API
POST /v2/activities/templates
→ Response: 201 Created ✅
→ Logs: "✅ Template written to SurrealDB (primary)" ✅

# Test: Retrieve same template
GET /v2/activities/templates/{id}
→ Response: 404 Not Found ❌
→ Logs: "WARNING Template not found in SurrealDB" ❌
```

**Technical Details**:
- **Library**: `surrealdb-py` v1.x
- **Protocol**: HTTP (not WebSocket)
- **SurrealDB**: v2.3.10 with strict IAM
- **Symptom**: Writes return success but data not persisted
- **Workaround**: Schema init uses `requests` directly (works perfectly)

**Impact**:
- ❌ Activity templates cannot be stored
- ❌ Template metrics cannot be tracked
- ❌ Variant performance data lost
- ❌ Distributed DevBob cannot share templates
- ❌ Learning loop completely non-functional

**Resolution Options**:

1. **Option A: Upgrade surrealdb-py library** (RECOMMENDED)
   - Update to surrealdb-py v2.x (if available)
   - Or use community fork with HTTP auth fixes
   - **Effort**: Low (dependency update + testing)
   - **Risk**: Medium (need to verify API compatibility)

2. **Option B: Replace surrealdb-py with direct HTTP calls**
   - Rewrite `surrealdb_client.py` to use `requests` library
   - Same pattern as `init_schema.py` (proven to work)
   - **Effort**: Medium (rewrite + testing)
   - **Risk**: Low (direct HTTP is more reliable)

3. **Option C: Use WebSocket protocol instead of HTTP**
   - Configure surrealdb-py to use `ws://` instead of `http://`
   - Requires connection pooling and reconnection logic
   - **Effort**: High (complex state management)
   - **Risk**: Medium (WebSocket complexity)

4. **Option D: Downgrade SurrealDB to v1.x**
   - Use older SurrealDB version without strict IAM
   - Loses IAM security benefits
   - **Effort**: Low (version change)
   - **Risk**: High (security regression, backward step)

**Recommended Action**: Pursue **Option A** first, fallback to **Option B** if needed.

---

### 3. Deployment Infrastructure ⚠️

**Status**: READY (but underlying persistence broken)

**Helmfile Configuration**: ✅
- Location: `repos/platform/metabob-apps/helmfile.yaml.gotmpl`
- DRY approach: All config in Helm values
- No manual kubectl patches needed
- Versioned and tracked in git

**Components**:
```
✅ SurrealDB:         Running (v2.3.10, in-memory)
✅ Redis:             Running (cache layer)
✅ Config Service:    Running
✅ RPC API:           Running (but persistence broken)
⚠️  Worker Pods:      Pending (dry-run mode, expected)
```

**Deployment Commands**:
```bash
# Full stack
helmfile -e default sync --selector 'name!=opencode-server,name!=slack-bot,...'

# Individual components
helmfile -e default sync --selector 'name=surrealdb'
helmfile -e default sync --selector 'name=metabob-rpc-api'

# Teardown
helmfile -e default destroy
```

**Production Concerns**:

1. **Persistence Mode**: Currently using in-memory SurrealDB
   - ❌ All data lost on pod restart
   - ❌ No disaster recovery
   - ❌ Not suitable for production
   - **Required**: Add persistent volume claims (PVC)

2. **High Availability**: Single pod for each service
   - ❌ No redundancy
   - ❌ Downtime during deployments
   - **Required**: Multi-replica deployments with proper health checks

3. **Monitoring**: No observability stack
   - ❌ No metrics (Prometheus)
   - ❌ No logging aggregation (Loki/ELK)
   - ❌ No tracing (Jaeger/Tempo)
   - **Required**: Full observability before production

4. **Security**: Credentials in Kubernetes Secrets
   - ⚠️  Base64 encoded (not encrypted at rest by default)
   - **Required**: Use sealed secrets or external secret manager

5. **Resource Limits**: Not properly configured
   - ❌ No memory/CPU limits set
   - ❌ Risk of resource exhaustion
   - **Required**: Set requests and limits based on load testing

---

## Production Readiness Checklist

### Critical (Must Fix Before Production)
- [ ] **Fix persistence bug** - surrealdb-py library replacement
- [ ] **Add persistent storage** - PVCs for SurrealDB
- [ ] **Configure HA** - Multiple replicas with proper failover
- [ ] **Set resource limits** - Memory/CPU requests and limits
- [ ] **Add health checks** - Liveness and readiness probes

### Important (Should Fix Before Production)
- [ ] **Implement monitoring** - Metrics, logs, traces
- [ ] **Secure secrets** - Use sealed secrets or vault
- [ ] **Load testing** - Verify system handles expected load
- [ ] **Backup strategy** - Automated backups for SurrealDB
- [ ] **Disaster recovery** - Documented recovery procedures

### Nice to Have (Can defer)
- [ ] **CI/CD pipeline** - Automated testing and deployment
- [ ] **Canary deployments** - Gradual rollout strategy
- [ ] **Auto-scaling** - HPA based on metrics
- [ ] **Cost optimization** - Right-size resources
- [ ] **Documentation** - Runbooks and troubleshooting guides

---

## Immediate Next Steps

### 1. Fix Persistence Bug (Priority: CRITICAL)

**Approach**: Replace surrealdb-py with direct HTTP calls

**Files to Modify**:
```
repos/metabob-rpc-api/server/db/surrealdb_client.py
repos/metabob-rpc-api/server/db/operations/template_data.py
repos/metabob-rpc-api/server/db/operations/template_metrics.py
```

**Implementation**:
```python
# Current (broken):
from surrealdb import Surreal
db = Surreal("http://surrealdb:8000")
await db.signin({"user": "root", "pass": "changeme"})
result = await db.create("activity_variants", data)

# New (working):
import requests

# Authenticate
auth_response = requests.post(
    f"{url}/rpc",
    headers={'Content-Type': 'application/json'},
    json={'method': 'signin', 'params': [{'user': 'root', 'pass': 'changeme'}]}
)
token = auth_response.json()['result']

# Create record
response = requests.post(
    f"{url}/rpc",
    headers={
        'Authorization': f'Bearer {token}',
        'Surreal-NS': 'metabob',
        'Surreal-DB': 'production'
    },
    json={'method': 'create', 'params': ['activity_variants', data]}
)
result = response.json()['result']
```

**Testing**:
```bash
# After fix, test template persistence:
1. Build new image: docker build -t metabobapp/metabob-rpc-api:0.16.15-direct-http .
2. Update Helm values: image.tag = "0.16.15-direct-http"
3. Deploy: helmfile -e default sync --selector 'name=metabob-rpc-api'
4. Test: curl -X POST http://localhost:8089/v2/activities/templates -d '{...}'
5. Verify: curl http://localhost:8089/v2/activities/templates/{id}
```

### 2. Add Persistent Storage (Priority: HIGH)

**SurrealDB PVC Configuration**:
```yaml
# repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml
persistence:
  enabled: true
  storageClass: "standard"  # or your cloud provider's storage class
  size: 10Gi
  accessMode: ReadWriteOnce

# Update deployment to use file-based storage instead of memory
args:
  - start
  - --auth
  - --user=root
  - --pass=changeme
  - file:///data/metabob.db  # Changed from memory to file
```

### 3. Configure Monitoring (Priority: MEDIUM)

**Prometheus Metrics**:
```yaml
# Add ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: metabob-rpc-api
spec:
  selector:
    matchLabels:
      app: metabob-rpc-api
  endpoints:
    - port: metrics
      interval: 30s
```

---

## Timeline Estimate

### Phase 1: Critical Fixes (1-2 weeks)
- [ ] Week 1: Fix persistence bug, test thoroughly
- [ ] Week 2: Add persistent storage, configure HA

### Phase 2: Production Hardening (2-3 weeks)
- [ ] Week 3: Implement monitoring and alerting
- [ ] Week 4: Load testing and optimization
- [ ] Week 5: Security hardening and documentation

### Phase 3: Launch Preparation (1 week)
- [ ] Week 6: Final testing, runbook creation, go/no-go decision

**Total**: 4-6 weeks to production readiness

---

## Risk Assessment

### High Risk
- **Persistence Bug**: Complete blocker, must fix before ANY production use
- **Data Loss**: In-memory SurrealDB loses all data on restart

### Medium Risk
- **Single Point of Failure**: No HA, downtime during pod restarts
- **No Monitoring**: Cannot detect/diagnose production issues

### Low Risk
- **Resource Exhaustion**: Unlikely in testing, but needs limits set
- **Security**: Credentials in secrets (acceptable for staging)

---

## Conclusion

The K8s DevBob deployment infrastructure is **well-architected** with Helmfile providing a solid DRY foundation. The schema initialization using the RPC API image is **production-ready** and demonstrates excellent engineering.

However, the **persistence layer is completely non-functional** due to the surrealdb-py library bug, making the entire system unsuitable for production until this is resolved.

**Recommendation**: 
1. **Immediately** fix the persistence bug using direct HTTP calls
2. **Then** add persistent storage and HA configuration
3. **Finally** implement monitoring and security hardening

With these changes, the system will be production-ready in 4-6 weeks.

---

## Appendix: Test Results

### Test 1: Schema Initialization ✅
```
✅ 13/13 tables have PERMISSIONS FULL
🎉 Schema initialization successful!
Tables: activity_template, activity_execution, activity_variants, 
        variant_performance_metrics, vessel_registry, users, sessions,
        organizations, projects, subscriptions, api_keys, audit_logs,
        schema_versions
```

### Test 2: Template Persistence ❌
```
Request:  POST /v2/activities/templates
Response: 201 Created
Body: {
  "variant_id": "test-k8s-persistence-1772367597-e6f7d3fc",
  "activity_id": "test-k8s-persistence-1772367597",
  "created_at": "2026-03-01T12:19:57.453114"
}

Request:  GET /v2/activities/templates/test-k8s-persistence-1772367597
Response: 404 Not Found
Body: {
  "error": "Template not found: test-k8s-persistence-1772367597"
}

Conclusion: Write succeeds (201) but data not persisted (404 on retrieval)
```

### Test 3: RPC API Logs
```
2026-03-01 12:19:57,386 INFO Creating first variant of test-k8s-persistence-1772367597
2026-03-01 12:19:57,447 INFO Authentication successful (token-based)
2026-03-01 12:19:57,460 INFO ✅ Template written to SurrealDB (primary)
2026-03-01 12:19:57,469 INFO ✅ Metrics initialized in SurrealDB (primary)
2026-03-01 12:20:13,912 WARNING Template not found in SurrealDB: test-k8s-persistence-1772367597

Conclusion: App thinks writes succeeded, but SurrealDB has no data
```
