# Activity System Setup - Deployment Checklist

## Pre-Deployment ☐

- [ ] Verify Kubernetes cluster is running (`kubectl cluster-info`)
- [ ] Ensure kubectl, helm, helmfile, docker are installed
- [ ] Confirm docker daemon is running
- [ ] Check available resources (2+ CPU cores, 4+ Gi memory)
- [ ] Review environment configuration (local vs testing)

## Build Phase ☐

- [ ] Build metabob-activity-api Docker image
- [ ] Build minibob Docker image
- [ ] Verify images exist (`docker images | grep -E 'metabob-activity-api|minibob'`)
- [ ] Optionally tag images for registry

## Deploy Phase ☐

- [ ] Run deployment script: `ENVIRONMENT=local bash scripts/deploy-activity-system.sh`
- [ ] Watch helmfile deployment progress
- [ ] Confirm namespace created (`kubectl get ns activity-system`)
- [ ] Wait for all pods to reach Running status
- [ ] Verify StatefulSets are ready (SurrealDB)

## Validation Phase ☐

- [ ] Run validation script: `bash scripts/validate-activity-system.sh`
- [ ] All tests pass (namespace, services, pods, health checks)
- [ ] Port-forward activity-api and test health endpoint
- [ ] Port-forward SurrealDB and test health endpoint
- [ ] Port-forward minibob and test health endpoint

## Testing Phase ☐

- [ ] Create session via POST /v2/session
- [ ] Extract Bearer token from response
- [ ] List activity templates via GET /v2/activities/templates
- [ ] Create test template via POST /v2/activities/templates
- [ ] Record execution via POST /v2/activities/executions
- [ ] Query SurrealDB to verify data storage
- [ ] Verify Thompson Sampling metrics update

## Learning Loop Verification ☐

- [ ] minibob polls for boredom tasks
- [ ] Activities execute successfully
- [ ] Executions recorded in SurrealDB
- [ ] Performance metrics update
- [ ] Template recommendations improve over time

## Documentation Review ☐

- [ ] Read ACTIVITY_SYSTEM_DEPLOYMENT.md
- [ ] Read ACTIVITY_SYSTEM_QUICKSTART.md
- [ ] Understand architecture diagram
- [ ] Review API compatibility matrix
- [ ] Familiarize with troubleshooting guide

## Production Readiness (Future) ☐

- [ ] Enable authentication (REQUIRE_AUTH=true)
- [ ] Configure TLS/HTTPS
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure backup strategy for SurrealDB
- [ ] Enable autoscaling
- [ ] Set resource quotas
- [ ] Configure network policies
- [ ] Add persistent volume snapshots

## Migration from metabob-rpc-api (If Applicable) ☐

- [ ] Deploy new infrastructure in parallel
- [ ] Update minibob MCP endpoint configuration
- [ ] Migrate existing data from old SurrealDB
- [ ] Verify API compatibility
- [ ] Gradually shift traffic
- [ ] Monitor both systems during transition
- [ ] Decommission old infrastructure

## Success Criteria ✓

- [ ] All pods Running (5 pods: redis, surrealdb, 2x activity-api, minibob)
- [ ] All health endpoints return 200 OK
- [ ] Session creation works
- [ ] Templates CRUD operations work
- [ ] Executions are recorded
- [ ] Thompson Sampling updates
- [ ] minibob connects to activity-api
- [ ] Validation script passes 100%

## Rollback Plan (If Needed) ☐

- [ ] Run: `helmfile -f helm/helmfile-activity-minimal.yaml -e local destroy`
- [ ] Delete namespace: `kubectl delete ns activity-system`
- [ ] Remove PVCs: `kubectl delete pvc -n activity-system --all`
- [ ] Restore previous infrastructure if migrating

---

**Note**: Check each box as you complete the task. If any step fails, refer to the troubleshooting section in ACTIVITY_SYSTEM_DEPLOYMENT.md
