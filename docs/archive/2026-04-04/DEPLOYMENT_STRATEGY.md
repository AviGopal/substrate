# Deployment Strategy Summary

## Overview

We're migrating from the old metabob stack to a new vessel-based architecture with:

- **Clean separation**: Deployment config separate from development repos
- **Version control**: Git submodules pin exact versions
- **Blue/green deployments**: Safe, continuous vessel updates
- **Lean CI/CD**: Simple, pragmatic automation
- **Acceptable downtime**: Big bang migration (downtime acceptable)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PRODUCTION SURFACES                       │
├──────────────────────────────────────────────────────────────┤
│  activity.metabob.com  →  metabob-activity-api              │
│  api.metabob.com       →  metabob-analysis-api              │
│  app.metabob.com       →  metabob-cloud-dashboard           │
│  internal.metabob.com  →  metabob-internal-dashboard        │
│  ide.metabob.com       →  metabob-rpc-api:0.16.13 (legacy)  │
└──────────────────────────────────────────────────────────────┘

                              ↓

┌──────────────────────────────────────────────────────────────┐
│                      NAMESPACES                              │
├──────────────────────────────────────────────────────────────┤
│  activity-system/    (NEW - all new services)                │
│  ├─ surrealdb                                                │
│  ├─ valkey (redis)                                           │
│  ├─ metabob-activity-api                                     │
│  ├─ metabob-analysis-api                                     │
│  ├─ metabob-cloud-dashboard                                  │
│  ├─ metabob-internal-dashboard                               │
│  └─ minibob                                                  │
│                                                              │
│  metabob-legacy/     (LEGACY - frozen)                       │
│  └─ metabob-rpc-api:0.16.13                                  │
└──────────────────────────────────────────────────────────────┘
```

## Migration Plan

### Phase 1: Preparation (This Week)

**What we built:**
- ✅ Deployment repository structure (`repos/deployment/`)
- ✅ Helmfile configurations (production + legacy)
- ✅ Helm charts for all services
- ✅ Migration scripts (export data, import data, orchestrate migration)
- ✅ Deployment scripts (deploy, upgrade vessels, rollback)
- ✅ CI/CD workflow (build + blue/green deployment)

**What you need to do:**

1. **Initialize deployment repo** (see `SETUP.md`)
   - Add vessel submodules at current versions
   - Copy helm charts from main repo
   - Configure GitHub secrets

2. **Export local development data**
   ```bash
   # On docker-desktop context
   kubectl config use-context docker-desktop
   ./scripts/export-local-db.sh
   # Saves to ./backups/surrealdb-local-TIMESTAMP.surql
   ```

3. **Build Docker images** for initial versions
   ```bash
   # Tag releases in each repo first
   cd repos/metabob-activity-api
   git tag -a v1.0.0 -m "Initial production release"
   git push --tags

   # Build image
   docker build -t metabobapp/metabob-activity-api:v1.0.0 .
   docker push metabobapp/metabob-activity-api:v1.0.0

   # Repeat for all vessels
   ```

4. **Test deployment locally** (optional but recommended)
   ```bash
   # On docker-desktop
   helmfile -f helmfiles/production.yaml.gotmpl sync
   # Verify everything works
   ```

### Phase 2: Migration Weekend (Downtime Acceptable)

**Friday Evening:**

1. **Switch to production cluster**
   ```bash
   gcloud container clusters get-credentials metabob-production \
     --region us-central1 \
     --project YOUR_PROJECT
   ```

2. **Deploy legacy RPC API to separate namespace**
   ```bash
   cd repos/deployment/helmfiles
   helmfile -f legacy.yaml sync

   # Verify
   kubectl get pods -n metabob-legacy
   ```

3. **Delete old metabob namespace**
   ```bash
   # Confirm no critical data will be lost
   kubectl delete namespace metabob
   ```

**Saturday Morning:**

4. **Deploy new activity-system stack**
   ```bash
   cd repos/deployment
   export ACTIVITY_API_VERSION=v1.0.0
   export ANALYSIS_API_VERSION=v1.0.0
   export CLOUD_DASHBOARD_VERSION=v1.0.0
   export INTERNAL_DASHBOARD_VERSION=v1.0.0
   export MINIBOB_VERSION=v0.1.0

   helmfile -f helmfiles/production.yaml.gotmpl sync
   ```

5. **Import local development data**
   ```bash
   ./scripts/import-to-production.sh ./backups/surrealdb-local-TIMESTAMP.surql
   ```

6. **Verify deployment**
   ```bash
   kubectl get pods -n activity-system
   kubectl get svc -n activity-system

   # Test health endpoints
   kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080
   curl http://localhost:8080/health
   ```

**Saturday Afternoon:**

7. **Configure DNS**
   - Point all `*.metabob.com` to Istio ingress gateway IP
   - Get IP: `kubectl get svc -n istio-system istio-ingressgateway`

8. **Test production surfaces**
   ```bash
   curl https://activity.metabob.com/health
   curl https://api.metabob.com/health
   curl https://app.metabob.com
   curl https://ide.metabob.com/health
   ```

9. **Monitor for 24 hours**
   ```bash
   kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f
   ```

### Phase 3: Ongoing Operations

**Blue/Green Deployments:**

Every vessel has two deployments:
- **Blue**: Currently serving production traffic
- **Green**: New version being tested

**Deployment flow:**
1. Update vessel submodule to new tag
2. Push to main (triggers CI/CD)
3. CI builds Docker image from tag
4. Deploys to green deployment
5. Monitors for stability (no crashes, no errors)
6. If stable: switches Service selector to green
7. If unstable: deletes green, keeps blue running

**Manual deployment:**
```bash
# Upgrade vessel to new version
./scripts/upgrade-vessel.sh metabob-activity-api v1.0.1

# Push to trigger CI/CD
git push origin main

# Or deploy manually
./scripts/deploy.sh
```

**Rollback:**
```bash
# Via git (preferred)
git revert HEAD
git push origin main

# Or via kubectl
kubectl rollout undo deployment/metabob-activity-api-green -n activity-system
```

## CI/CD Pipeline

```
TRIGGER: Push to main (vessel submodule updated)
          │
          ▼
    ┌─────────────┐
    │ Detect      │  Which vessel changed?
    │ Changes     │  Read version from submodule tag
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Build       │  docker build from tagged commit
    │ Image       │  tag: metabobapp/<vessel>:<version>
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Deploy      │  kubectl set image ...-green
    │ Green       │  Scale to 1 replica
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Monitor     │  Sleep 2min, check:
    │ Stability   │  - No restarts
    │             │  - Pod is Running
    └──────┬──────┘
           │
      ┌────┴────┐
      │         │
   STABLE    UNSTABLE
      │         │
      ▼         ▼
    Switch    Rollback
    Traffic   (delete green)
      │         │
      ▼         ▼
   Slack     Slack
   Alert     Alert
```

## Cost & Effort

| Phase | Time | Complexity |
|-------|------|------------|
| Setup deployment repo | 2 hours | Low |
| Export local data | 30 min | Low |
| Build initial images | 1 hour | Low |
| Migration (delete old, deploy new) | 2 hours | Medium |
| Data import + verification | 1 hour | Low |
| DNS configuration | 30 min | Low |
| **TOTAL MIGRATION** | **~7 hours** | **Low-Medium** |
| | | |
| CI/CD automation | Already done | N/A |
| Ongoing deployments | 5 min each | Low |

## What You Get

**Deployment Repository:**
- ✅ Version-controlled deployments
- ✅ Git submodules pin exact versions
- ✅ Reproducible deployments
- ✅ Clear audit trail

**CI/CD:**
- ✅ Automated builds on version bump
- ✅ Blue/green safety net
- ✅ Stability monitoring (not success rate)
- ✅ Slack notifications
- ✅ Quick rollback (just revert git commit)

**Production:**
- ✅ Clean namespaces (activity-system, metabob-legacy)
- ✅ All new services on new stack
- ✅ Legacy frozen and isolated
- ✅ SurrealDB with local dev data
- ✅ Blue/green for continuous updates

**Operations:**
- ✅ Simple deployment: `./scripts/upgrade-vessel.sh <name> <version>`
- ✅ Simple rollback: `git revert HEAD && git push`
- ✅ Clear version tracking: `git submodule status`

## What's NOT Included (Can Add Later)

- ❌ Secrets encryption (SOPS)
- ❌ Prometheus + Grafana
- ❌ Advanced monitoring
- ❌ Automated backups
- ❌ High availability (SurrealDB clustering)
- ❌ Auto-scaling
- ❌ Network policies
- ❌ Internal dashboard vessel
- ❌ Slack bot vessel

These can be added incrementally after the core system is stable.

## Failure Philosophy

This system **embraces failure** as part of learning:

- ✅ Vessels may fail - that's okay, we learn from it
- ✅ Blue/green ensures failures don't take down production
- ✅ Stability (no crashes) matters more than success rate
- ✅ Activity system learns from failures to improve

**We monitor for:**
- Container restarts (bad)
- Pod crashes (bad)
- 5xx errors (bad)

**We don't monitor for:**
- Activity execution failures (expected, part of learning)
- LLM errors (expected, part of experimentation)
- Individual request failures (expected in vessel development)

## Next Steps

1. **Follow `SETUP.md`** to initialize deployment repo
2. **Export local data** with `./scripts/export-local-db.sh`
3. **Build initial images** for all vessels
4. **Pick a migration window** (weekend recommended)
5. **Run migration** with `./scripts/migrate-to-production.sh`
6. **Monitor for 24 hours**
7. **Enable CI/CD** by pushing to main

## Questions?

- Migration unclear? See `scripts/migrate-to-production.sh` for full automation
- Deployment unclear? See `SETUP.md` for step-by-step guide
- CI/CD unclear? See `.github/workflows/deploy-production.yml` for pipeline
- Philosophy unclear? See `README.md` for architecture rationale
