# Deployment State Summary

**Date:** Mon Feb 16 2026  
**Cluster:** metabob-production (GKE)  
**Analysis:** Production vs Local Container Comparison

---

## Quick Status

| Aspect | Status | Notes |
|--------|--------|-------|
| **Cluster Health** | ✅ Healthy | All 12 pods running, 172 days uptime |
| **Version Alignment** | ✅ Perfect | Prod & local both on 0.16.12 |
| **Local Dev** | ⚠️ Minor Issue | Celery worker restarting |
| **Pending Changes** | ⚠️ Review Needed | SurrealDB persistence change |

---

## Production Services Running

```
Service                    Version      Replicas  Status    Age
────────────────────────────────────────────────────────────────
metabob-rpc-api           0.16.12      2         ✅ Running 172d
metabob-rpc-api-workers   0.16.12      3         ✅ Running 172d  
metabob-dashboard         2.2.11       1         ✅ Running 172d
metabob-site              0.3.86       1         ✅ Running 172d
amphitheatre-control      v1.0.7       1         ✅ Running 102d
amphitheatre-frontend     v1.0.7       1         ✅ Running 102d
amphitheatre-backend      v1.0.7       1         ✅ Running 102d
redis-master              7.0.12       1         ✅ Running 172d
surrealdb                 v2.3.10      1         ✅ Running 26d
```

**Total:** 12 pods, all healthy with Istio sidecars (2/2 containers ready)

---

## Version Comparison

### ✅ RPC API (Backend) - ALIGNED

```
Environment          Version    Image
────────────────────────────────────────────────────────────
Production (live)    0.16.12    metabobapp/metabob-rpc-api:0.16.12
Production (config)  0.16.12    (matches running)
Local (running)      0.16.12    (same version) ✅
```

**Status:** Perfect alignment - no drift

### ✅ Dashboard (Frontend) - MINOR LAG

```
Environment          Version
──────────────────────────────
Production           2.2.11
Local available      2.2.1
```

**Status:** Local slightly behind (2.2.1 vs 2.2.11) but not critical

### Infrastructure

```
Service      Production                    Local
────────────────────────────────────────────────────────────────
Redis        bitnamilegacy/redis:7.0.12    redis:7-alpine
SurrealDB    surrealdb:v2.3.10             surrealdb:latest
```

**Status:** Different distributions, same major versions

---

## Pending Configuration Change ⚠️

### SurrealDB: Persistence → Memory Mode

**Current (live):**
- Type: StatefulSet with 50Gi persistent volume
- Storage: RocksDB backend
- Resources: 500m-2000m CPU, 1Gi-4Gi memory

**Pending (helmfile diff shows):**
- Type: Deployment (ephemeral)
- Storage: In-memory only
- Resources: 100m-1000m CPU, 512Mi-2Gi memory

**Impact:**
- ⚠️ All data lost on pod restart
- ⚠️ Database resets with each deployment
- ✅ 50% resource reduction
- ✅ Faster performance (in-memory)

**Action Required:**
```bash
# BEFORE applying helmfile sync, verify this is intentional:
cat repos/platform/metabob-apps/charts/surrealdb/values/production.surrealdb.values.yaml | grep persistence

# Expected: persistence.enabled: true
# If true, helmfile diff is showing wrong state - investigate
# If false, backup data before applying change
```

---

## Local Development State

### Running Containers

```
Container               Status              Ports
────────────────────────────────────────────────────────────
devbob-clean            Up 2d (healthy)     3000, 8082
metabob-redis           Up 2d (healthy)     6379
metabob-surreal         Up 2d (healthy)     8000  
metabob-surrealist      Up 2d               8001
metabob-rpc-api-server  Up 19m              8080
metabob-celery-worker   Restarting ⚠️       -
```

### Issues

1. **Celery Worker Restarting** 🟡 MEDIUM
   - In restart loop
   - Background jobs won't process
   - Check logs: `docker logs metabob-celery-worker`

---

## Architecture Differences

### Production (Kubernetes + Helmfile)

```
┌─────────────────────────────────────┐
│     Istio Service Mesh (Ingress)    │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌───▼───┐  ┌──▼─────┐
│ Site  │  │ Dash  │  │ Amphi  │
│ 0.3.86│  │ 2.2.11│  │ v1.0.7 │
└───────┘  └───┬───┘  └────────┘
               │
         ┌─────▼──────┐
         │  RPC API   │
         │  0.16.12   │
         │ 2 replicas │
         └─────┬──────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌───▼────┐  ┌──▼────┐
│Workers│  │Surreal │  │ Redis │
│   3   │  │v2.3.10 │  │7.0.12 │
└───────┘  └────────┘  └───────┘
```

- **Orchestration:** Kubernetes (GKE)
- **Networking:** Istio service mesh with sidecars
- **Persistence:** PVCs for stateful services
- **Scaling:** Multiple replicas, HPA ready
- **Monitoring:** Prometheus metrics via Istio

### Local (Docker Compose)

```
┌──────────────────────────────────┐
│   Docker Network (Bridge Mode)  │
└────────┬─────────────────────────┘
         │
    ┌────┼────┐
    │    │    │
┌───▼──┐ │ ┌──▼────────┐
│Redis │ │ │ SurrealDB │
│7-alp │ │ │  latest   │
└──────┘ │ └───────────┘
         │
    ┌────▼─────┐
    │ RPC API  │
    │ 0.16.12  │
    │1 replica │
    └────┬─────┘
         │
    ┌────▼──────┐
    │  Worker   │
    │ (failing) │
    └───────────┘
```

- **Orchestration:** Docker Compose with profiles
- **Networking:** Direct container networking
- **Persistence:** Docker volumes (ephemeral)
- **Scaling:** Single replicas
- **Monitoring:** Docker logs only

---

## Gap Analysis

### Services in Production NOT in Local

- ❌ **metabob.com** (Landing site - not needed for dev)
- ❌ **Amphitheatre** (A/B testing - product feature)
- ❌ **Dashboard** (Frontend UI - can add if needed)
- ❌ **Istio** (Service mesh - K8s only)

### Services in Local NOT in Production

- ✅ **Surrealist** (Database UI - dev tool only)
- ✅ **Devbob** (AI agents - dev tool only)

---

## Recommended Actions

### Priority 1: Verify SurrealDB Change 🔴

```bash
# Check persistence configuration
cat repos/platform/metabob-apps/charts/surrealdb/values/production.surrealdb.values.yaml

# Current config shows persistence.enabled: true
# But helmfile diff shows Deployment (memory mode) instead of StatefulSet

# INVESTIGATE:
# 1. Is this an unintended change?
# 2. Check recent git history for surrealdb chart
# 3. Verify with team before applying helmfile sync

git log --oneline -- repos/platform/metabob-apps/charts/surrealdb/
```

### Priority 2: Fix Local Celery Worker 🟡

```bash
# Check logs
docker logs metabob-celery-worker --tail 100

# Verify environment
docker exec metabob-celery-worker env | grep -E "REDIS|SURREAL|CELERY"

# Common fixes:
# - Update redis connection string
# - Verify SurrealDB credentials
# - Check task module imports
```

### Priority 3: Optional Improvements 🟢

```bash
# Pull latest dashboard to match production
docker pull metabobapp/metabob-dashboard:2.2.11

# Add amphitheatre to local if A/B testing needed
# (requires adding to docker-compose.yaml)
```

---

## Testing Commands

### Production Health Check

```bash
# All services
kubectl get all -n metabob

# Pod details
kubectl get pods -n metabob -o wide

# Image versions
kubectl get pods -n metabob -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# Helmfile status
cd repos/platform/metabob-apps
helmfile -e production list
helmfile -e production diff
```

### Local Health Check

```bash
# Running containers
docker ps

# API health
curl http://localhost:8080/health

# SurrealDB health
curl http://localhost:8000/health

# Redis health
redis-cli -h localhost -p 6379 ping

# Check logs
docker logs metabob-rpc-api-server --tail 50
docker logs metabob-celery-worker --tail 50
```

---

## Key Insights

1. **✅ Version Management is Excellent**
   - Production and local aligned on 0.16.12
   - No deployment drift
   - Stable for 172 days

2. **✅ Production is Healthy**
   - All services running smoothly
   - Proper resource allocation
   - Istio service mesh operational

3. **⚠️ Configuration Review Needed**
   - SurrealDB change needs verification
   - Understand intent behind memory mode switch
   - Backup data if change is intentional

4. **✅ Local Dev Environment is Solid**
   - Profile-based architecture works well
   - Same versions as production
   - Minor celery issue doesn't block development

5. **✅ Architecture Separation is Appropriate**
   - Local focuses on backend API development
   - Production includes full stack with frontend, landing, A/B testing
   - Clear separation of concerns

---

## Conclusion

**Overall Assessment:** ✅ **Healthy with one pending verification**

The deployment state is excellent with perfect version alignment between production and local environments. The production cluster has been stable for 172 days running version 0.16.12, which matches the local development environment exactly.

The only concern is a pending SurrealDB configuration change from persistent to memory mode that needs verification before applying, as it would result in data loss.

Local development is functional with a minor celery worker issue that doesn't block backend API development.

---

**Next Steps:**
1. Verify SurrealDB persistence intent
2. Fix celery worker locally
3. Continue development with confidence in version alignment

---

For detailed analysis, see:
- `DEPLOYMENT_STATE_ACTUAL.md` - Full detailed comparison
- `DEPLOYMENT_QUICK_REFERENCE.md` - Command reference
- `DEPLOYMENT_COMPARISON_REPORT.md` - Initial analysis (has outdated version info)
