# Start Here: Next Session Quick Start

## Current Status ✅
- **Problem Identified**: SurrealDB version mismatch (2.3.10) + custom HTTP client causing `variant_id` field to not persist
- **Root Cause**: Parameter serialization issues in custom RPC implementation
- **Solution Ready**: Detailed plan to use official surrealdb-py library + SurrealDB 3.0

## What Happened This Session

### Investigation Complete ✅
1. ✅ Confirmed SurrealDB RPC protocol works (tested with curl)
2. ✅ Confirmed Python `requests` library works (standalone script)
3. ✅ Confirmed parameters are sent by Python code (extensive logging)
4. ✅ Confirmed database receives NONE values (query verification)
5. ✅ **Root cause**: Custom HTTP client has serialization bug

### Infrastructure Status ✅
- **K8s Cluster**: Running (namespace: metabob)
- **SurrealDB**: Running on **2.3.10** (needs upgrade to 3.0)
- **RPC API**: Running with custom HTTP client (needs replacement)
- **Schema**: SCHEMALESS (correct, not the issue)

## Next Session: Execute Fix Plan (75 minutes)

**Read**: `FIX_PLAN_VERSION_ALIGNMENT.md` for complete details

### Quick Steps

#### 1. Update Dependencies (5 min)
```bash
cd repos/metabob-rpc-api
echo "surrealdb>=1.0.0" >> requirements.txt
```

#### 2. Upgrade SurrealDB to 3.0 in K8s (10 min)
```bash
# Edit helm values
vim helm/charts/metabob-rpc-api.values.yaml
# Change: surrealdb.image.tag: "3.0.0"

# Apply
helmfile -f helm/helmfile.yaml sync
```

#### 3. Replace Custom Client (30 min)
- Replace `repos/metabob-rpc-api/server/db/surrealdb_client.py` with official library wrapper
- Key: Use `async/await` and official `Surreal()` class
- See `FIX_PLAN_VERSION_ALIGNMENT.md` for complete code

#### 4. Update Operations (20 min)
- Change `update()` calls to `merge()` in `template_metrics.py`
- This preserves `variant_id` and `activity_id` fields
- Add unified schema initialization

#### 5. Test (15 min)
```bash
# Test variant_id persistence
curl -X POST http://localhost:8080/v2/activities/templates/test-v3/metrics \
  -d '{"metrics": {"total_executions": 1, "success_rate": 1.0}}'

# Verify in DB
kubectl exec -n metabob deploy/surrealdb -- \
  surreal sql ... "SELECT variant_id FROM template_metrics WHERE variant_id = 'test-v3';"
```

## Key Files to Modify

1. **requirements.txt** - Add `surrealdb>=1.0.0`
2. **helm values** - Upgrade SurrealDB image to 3.0
3. **surrealdb_client.py** - Replace with official library
4. **template_metrics.py** - Use `merge()` instead of `update()`
5. **schema.py** (new) - Unified schema initialization

## Success Criteria

✅ SurrealDB 3.0 running in K8s
✅ Official surrealdb-py library integrated
✅ `variant_id` field persists correctly in database
✅ Tests pass end-to-end
✅ No more NONE values in database queries

## If You Need Context

- **Investigation Summary**: This document (NEXT_SESSION_START_HERE.md)
- **Detailed Fix Plan**: FIX_PLAN_VERSION_ALIGNMENT.md
- **Test Evidence**: test-surrealdb-create.py (standalone script that works)

## Pro Tips

1. **Start Fresh**: Consider `kubectl delete namespace metabob` for clean slate
2. **Test Incrementally**: Verify each step before moving to next
3. **Use Official Docs**: https://surrealdb.com/docs/sdk/python
4. **Key Difference**: `merge()` vs `update()` - merge preserves unspecified fields

---

**Bottom Line**: We know exactly what's wrong and how to fix it. The official library + SurrealDB 3.0 will solve the serialization bug. Just follow the plan in FIX_PLAN_VERSION_ALIGNMENT.md step by step.
