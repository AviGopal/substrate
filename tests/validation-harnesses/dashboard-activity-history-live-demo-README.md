# Validation Harness: Dashboard Activity History Live Demo

## Overview

This validation harness provides automated end-to-end testing for the Dashboard Activity History Live Demo specification. It validates the complete data flow from OpenCode CLI through SurrealDB and RPC API to the Dashboard UI.

## Data Flow Validated

```
kubectl exec devbob → Activity.complete() → HTTP POST → RPC API → insert_execution()
→ SurrealDB → Dashboard polls → get_organization_activity() → Redis cache
→ Transform → Dashboard UI
```

## Test Cases

### 1. Infrastructure Readiness ✅
**Purpose**: Validate Kubernetes cluster, pods, services, and configuration  
**Checks**:
- kubectl context is docker-desktop
- metabob namespace exists
- All required pods are Running
- All required services exist
- devbob has METABOB_RPC_API_URL configured

### 2. Dashboard Accessibility ✅
**Purpose**: Validate DNS, ingress, and HTTP connectivity  
**Checks**:
- Ingress host is app.metabob.local
- /etc/hosts has entry for app.metabob.local
- HTTP request to dashboard returns 200 or 302

### 3. Activity Execution ✅
**Purpose**: Execute test activity and verify completion  
**Checks**:
- Activity executes in devbob container
- Activity completes successfully
- Activity ID is generated (act_*)
- Dashboard sync message appears in logs

### 4. SurrealDB Record Persistence ✅
**Purpose**: Verify activity execution record in database  
**Checks**:
- Record exists in activity_executions table
- Record has all required fields (activity_id, template_id, success, cost_usd, duration_ms, tokens_*)

### 5. Cache-Aside Pattern Validation ✅
**Purpose**: Validate Redis cache-aside implementation  
**Checks**:
- First API request results in cache MISS
- Second API request results in cache HIT
- Response contains valid activities array
- API logs show cache behavior

## Prerequisites

Before running the validation harness, ensure:

1. **Kubernetes Cluster**
   ```bash
   kubectl config use-context docker-desktop
   kubectl get namespace metabob
   ```

2. **Services Deployed**
   ```bash
   cd repos/platform/metabob-apps
   helmfile -e default sync
   ```

3. **Pods Running**
   ```bash
   kubectl get pods -n metabob
   # All pods should show Running status
   ```

4. **DNS Configuration**
   ```bash
   # Add to /etc/hosts (requires sudo)
   echo "127.0.0.1 app.metabob.local" | sudo tee -a /etc/hosts
   ```

5. **SurrealDB Migration Applied**
   ```bash
   cat repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql | \
   kubectl exec -i deployment/surrealdb -n metabob -- \
   surreal sql --conn http://localhost:8000 --ns metabob --db devbob \
   --auth-level root --user root --pass root
   ```

6. **Environment Variables**
   ```bash
   kubectl exec deployment/devbob -n metabob -- env | grep METABOB_RPC_API_URL
   # Should show: METABOB_RPC_API_URL=http://metabob-rpc-api:8080
   ```

## Usage

### Run Full Validation

```bash
npx tsx tests/validation-harnesses/dashboard-activity-history-live-demo-harness.ts
```

### Expected Output

```
================================================================================
Dashboard Activity History Live Demo - Validation Harness
================================================================================

[TEST] Infrastructure Readiness
       Validate k8s cluster, pods, services, and configuration
[PASS] ✅ Infrastructure Readiness
       ✅ kubectl-context: docker-desktop
       ✅ namespace-metabob: namespace/metabob
       ✅ pods-running: Running Running Running Running Running
       ✅ service-surrealdb: service/surrealdb
       ✅ service-redis: service/redis
       ✅ service-metabob-rpc-api: service/metabob-rpc-api
       ✅ service-metabob-dashboard: service/metabob-dashboard
       ✅ service-devbob: service/devbob
       ✅ devbob-rpc-url: METABOB_RPC_API_URL=http://metabob-rpc-api:8080

[TEST] Dashboard Accessibility
       Validate DNS, ingress, and HTTP connectivity
[PASS] ✅ Dashboard Accessibility
       ✅ ingress-host: app.metabob.local
       ✅ hosts-file: Entry found
       ✅ http-connectivity: 200

[TEST] Activity Execution
       Execute test activity in devbob container
[PASS] ✅ Activity Execution
       ✅ activity-completed: Completed
       ✅ activity-id-generated: ID found
       ✅ dashboard-sync: Recorded

[TEST] SurrealDB Record
       Verify activity execution persisted to SurrealDB
[PASS] ✅ SurrealDB Record
       ✅ record-exists: Record found
       ✅ schema-compliance: All required fields present

[TEST] Cache-Aside Pattern
       Validate Redis cache-aside (miss → hit)
[PASS] ✅ Cache-Aside Pattern
       ✅ first-request-cache-miss: Cache MISS
       ✅ second-request-cache-hit: Cache HIT
       ✅ api-response-valid: 1 activities

================================================================================
VALIDATION RESULT: ✅ PASS
================================================================================
```

## Troubleshooting

### Test 1 Fails: Infrastructure Not Ready

**Problem**: Pods not running, services missing  
**Solution**:
```bash
# Check pod status
kubectl get pods -n metabob

# Redeploy if needed
cd repos/platform/metabob-apps
helmfile -e default sync
```

### Test 2 Fails: Dashboard Not Accessible

**Problem**: DNS not configured, ingress not working  
**Solution**:
```bash
# Add /etc/hosts entry
echo "127.0.0.1 app.metabob.local" | sudo tee -a /etc/hosts

# Check ingress
kubectl get ingress -n metabob
kubectl describe ingress metabob-dashboard -n metabob
```

### Test 3 Fails: Activity Execution Error

**Problem**: OpenCode CLI not working, RPC API URL not configured  
**Solution**:
```bash
# Check devbob logs
kubectl logs deployment/devbob -n metabob --tail=50

# Verify RPC API URL
kubectl exec deployment/devbob -n metabob -- env | grep METABOB_RPC_API_URL

# Rebuild and redeploy if needed
cd repos/platform/metabob-apps
helmfile -e default sync
```

### Test 4 Fails: No SurrealDB Record

**Problem**: Schema not applied, insert_execution() failing  
**Solution**:
```bash
# Apply schema migration
cat repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql | \
kubectl exec -i deployment/surrealdb -n metabob -- \
surreal sql --conn http://localhost:8000 --ns metabob --db devbob \
--auth-level root --user root --pass root

# Check RPC API logs
kubectl logs deployment/metabob-rpc-api -n metabob --tail=50
```

### Test 5 Fails: Cache Pattern Not Working

**Problem**: Redis not connected, get_organization_activity() not caching  
**Solution**:
```bash
# Check Redis connectivity
kubectl exec deployment/redis -n metabob -- redis-cli ping

# Check RPC API logs for cache behavior
kubectl logs deployment/metabob-rpc-api -n metabob | grep -i cache

# Verify Redis client in RPC API
kubectl logs deployment/metabob-rpc-api -n metabob | grep -i redis
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Validate Dashboard Activity History

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Setup k8s cluster
        run: |
          # Setup kind or minikube
          
      - name: Deploy services
        run: |
          cd repos/platform/metabob-apps
          helmfile -e default sync
          
      - name: Run validation
        run: |
          npx tsx tests/validation-harnesses/dashboard-activity-history-live-demo-harness.ts
```

## Future Enhancements

1. **Playwright Integration**: Add browser automation for UI testing
2. **Screenshot Capture**: Visual proof-of-work at each step
3. **Performance Metrics**: Measure API response times, cache hit rates
4. **Visual Regression**: Compare dashboard UI screenshots against baseline
5. **Load Testing**: Validate performance under concurrent activity executions

## Related Files

- **Harness Implementation**: `tests/validation-harnesses/dashboard-activity-history-live-demo-harness.ts`
- **Enforcement Summary**: `ENFORCEMENT_SUMMARY_dashboard-activity-history-live-demo.md`
- **Trace Analysis**: `TRACE_ANALYSIS_dashboard-activity-history-live-demo.json`
- **Specification**: Dashboard Activity History Live Demo

## Success Criteria

✅ All 5 test cases pass  
✅ Infrastructure validated  
✅ Activity executed successfully  
✅ SurrealDB record created with correct schema  
✅ Cache-aside pattern verified (miss → hit)  
✅ End-to-end data flow proven working  
