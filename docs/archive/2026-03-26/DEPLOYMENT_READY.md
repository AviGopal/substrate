# 🚀 Deployment Ready: SurrealDB v3.0 Integration

## Status: Code Complete ✅ - Ready for Deployment

### What Was Accomplished

**Phase 1 & 2 Complete** - All code changes tested and validated:
- ✅ Replaced custom HTTP RPC client with official `surrealdb-py` library
- ✅ Fixed variant_id persistence bug (changed `update()` → `merge()`)
- ✅ Converted 43 functions to async across 10 files
- ✅ All 56 `get_surreal_client()` calls properly use await
- ✅ 100% validation: 6/6 tests PASSED

### Deployment Steps (15-20 minutes)

#### Step 1: Build Docker Image (5 min)
```bash
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabob-rpc-api:surrealdb-v3 .
docker tag metabob-rpc-api:surrealdb-v3 metabob-rpc-api:latest

# Verify
docker images | grep metabob-rpc-api
```

#### Step 2: Upgrade SurrealDB to v3.0 (5 min)
```bash
# Edit helm values
vim helm/charts/metabob-rpc-api.values.yaml
# Change: surrealdb.image.tag: "3.0.0"

# Apply
helmfile -f helm/helmfile.yaml sync

# Wait and verify
kubectl wait --for=condition=ready pod -l app=surrealdb -n metabob --timeout=120s
kubectl exec -n metabob deploy/surrealdb -- surreal version
# Should show: surrealdb 3.0.x
```

#### Step 3: Deploy RPC API (3 min)
```bash
kubectl set image -n metabob deployment/metabob-rpc-api rpc-api=metabob-rpc-api:surrealdb-v3
kubectl rollout status -n metabob deployment/metabob-rpc-api --timeout=180s

# Verify no errors
kubectl logs -n metabob deploy/metabob-rpc-api --tail=50 | grep -i error
```

#### Step 4: Test variant_id Persistence (5 min)
```bash
# Port-forward
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 &
PF_PID=$!

# Create test metrics
TEST_ID="test-v3-$(date +%s)"
curl -X POST "http://localhost:8080/v2/activities/templates/$TEST_ID/metrics" \
  -H 'Content-Type: application/json' \
  -d '{"metrics": {"total_executions": 1, "success_rate": 1.0}}'

# Query database (should show variant_id, NOT NONE)
kubectl exec -n metabob deploy/surrealdb -- \
  surreal sql --endpoint http://localhost:8000 \
  --namespace metabob --database production \
  --username root --password root \
  --command "SELECT variant_id, activity_id FROM template_metrics WHERE variant_id = '$TEST_ID';"

kill $PF_PID
```

**Expected Result**: 
```json
{
  "variant_id": "test-v3-1234567890",
  "activity_id": "test-v3"
}
```

#### Step 5: Run Validation Harness (2 min)
```bash
bash tests/validation-harnesses/Complete-Async-Ripple-Changes-for-SurrealDB-Official-Library-harness.sh
```

**Expected**: 6/6 tests PASS

### Rollback Plan

If issues occur:

```bash
# Rollback RPC API
kubectl set image -n metabob deployment/metabob-rpc-api rpc-api=metabob-rpc-api:previous-tag

# Rollback SurrealDB (edit helm values back to 2.3.10)
vim helm/charts/metabob-rpc-api.values.yaml
helmfile -f helm/helmfile.yaml sync

# Legacy client backup available at:
# repos/metabob-rpc-api/server/db/surrealdb_client_legacy.py
```

### Files Modified (All Committed)

**Requirements**:
- `repos/metabob-rpc-api/requirements.txt` - Added surrealdb>=1.0.0

**Core Fix**:
- `repos/metabob-rpc-api/server/db/surrealdb_client.py` - Async wrapper (NEW)
- `repos/metabob-rpc-api/server/db/surrealdb_client_legacy.py` - Backup (NEW)

**Database Operations** (8 files, 43 functions → async):
- `server/db/operations/template_metrics.py` - Uses merge() ✅
- `server/db/operations/failure_pattern.py`
- `server/db/operations/task_execution.py`
- `server/db/operations/activity_content.py`
- `server/db/operations/activity_execution.py`
- `server/db/operations/impulse_data.py`
- `server/db/operations/activity_data.py`
- `server/db/operations/impulse_learning.py`
- `server/db/operations/template_data.py`

**Routes & CLI**:
- `server/routes/activity.py` - Async routes, uses merge()
- `server/cli.py` - asyncio.run() wrappers

### Success Metrics

After deployment, verify:
1. ✅ No import/async errors in RPC API logs
2. ✅ SurrealDB 3.0.x running
3. ✅ variant_id fields persist (NOT NONE)
4. ✅ activity_id fields persist (NOT NONE)
5. ✅ Validation harness: 6/6 tests PASS
6. ✅ Thompson Sampling queries work

### Documentation

- **Fix Plan**: `FIX_PLAN_VERSION_ALIGNMENT.md`
- **Investigation**: `NEXT_SESSION_START_HERE.md`
- **Validation**: `VALIDATION_COMPLETE_SUMMARY.md`
- **This Document**: `DEPLOYMENT_READY.md`

---

**Ready to Deploy!** All code is tested, validated (100%), and committed to git. Just follow the 5 steps above.
