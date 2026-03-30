# Identity Vessel Integration - Deployment Procedure

## Overview

This document describes how to deploy the identity-vessel integration with activity-api in a repeatable, safe manner that works for both:
- **Fresh installations** (new deployments)
- **Upgrades** (existing deployments with zero downtime)

## Pre-Deployment Checklist

Before deploying, verify:

- [ ] Docker Desktop with Kubernetes enabled (context: `docker-desktop`)
- [ ] Istio installed: `istioctl version` shows installed version
- [ ] `/etc/hosts` configured with `*.metabob.local` entries
- [ ] `kubectl` configured and can access cluster
- [ ] `helmfile` installed: `helmfile version`
- [ ] Environment variables set (see below)

### Required Environment Variables

```bash
# Required for all deployments
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export SURREALDB_PASSWORD="surrealdb-local-dev-123"  # Or your secure password

# Required for identity-vessel
export API_KEY_SECRET="your-secret-key-min-32-chars-long"  # Generate a strong secret

# Optional (defaults provided)
export SURREALDB_USERNAME="root"
```

---

## Fresh Installation (From Scratch)

### Step 1: Generate Identity Vessel Secrets

```bash
# Generate a strong secret for HMAC signing
export API_KEY_SECRET=$(openssl rand -base64 32)
echo "Generated API_KEY_SECRET (save this securely!): $API_KEY_SECRET"

# Save to environment file for persistence
echo "API_KEY_SECRET=$API_KEY_SECRET" >> repos/deployment/.env.local
```

### Step 2: Generate Bootstrap Admin Key

```bash
cd repos/identity-vessel

# Generate the first admin key
API_KEY_SECRET="$API_KEY_SECRET" NODE_ENV=development \
  bun run scripts/generate-bootstrap-key.ts

# Save the output key to environment
export ADMIN_API_KEY="<key-from-output>"
echo "ADMIN_API_KEY=$ADMIN_API_KEY" >> ../deployment/.env.local
```

### Step 3: Deploy Infrastructure

```bash
cd repos/deployment/helm

# Deploy the full stack
helmfile -e local sync

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n activity-system --timeout=300s
```

### Step 4: Verify Deployment

```bash
# Check all services are healthy
kubectl get pods -n activity-system

# Should see:
# - surrealdb-0 (Running)
# - identity-vessel-* (Running, 2 replicas)
# - metabob-activity-api-* (Running)
# - redis-valkey-* (Running)

# Test identity-vessel
curl http://identity.metabob.local/health

# Test activity-api
curl http://activity.metabob.local/health
```

### Step 5: Test Integration

```bash
cd ../../..  # Back to repo root

# Run integration tests
./test-identity-vessel-integration.sh

# Should see all steps pass with "identity-vessel" source
```

### Step 6: Generate Test User Keys

```bash
# Generate a test user API key
curl -X POST http://identity.metabob.local/v1/keys/generate \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUserId": "usr_test",
    "name": "Test User Key",
    "scopes": ["read", "write"],
    "expiresInDays": 365
  }'

# Save the returned key for testing
export TEST_USER_KEY="<key-from-response>"
```

### Step 7: Verify User Key Works

```bash
# Authenticate with activity-api
curl -X POST http://activity.metabob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$TEST_USER_KEY\"}"

# Should return JWT token with source: "identity-vessel"

# Use token for API call
curl -X GET http://activity.metabob.local/v2/activities/templates?limit=5 \
  -H "Authorization: Bearer <jwt-token-from-previous-response>"
```

---

## Upgrading Existing Deployment

### Pre-Upgrade Checklist

- [ ] Backup SurrealDB data: `./scripts/backup-surrealdb.sh`
- [ ] Note current pod versions: `kubectl get pods -n activity-system`
- [ ] Verify current system is healthy
- [ ] Plan maintenance window (recommended but not required)

### Step 1: Generate Bootstrap Key (if not exists)

```bash
# Check if bootstrap key already exists
if [ -f repos/identity-vessel/.bootstrap-key.json ]; then
  echo "Bootstrap key already exists"
  cat repos/identity-vessel/.bootstrap-key.json
else
  echo "Generating new bootstrap key..."
  cd repos/identity-vessel
  API_KEY_SECRET="${API_KEY_SECRET:-$(openssl rand -base64 32)}" \
    bun run scripts/generate-bootstrap-key.ts
  cd ../..
fi
```

### Step 2: Update Helm Values

```bash
cd repos/deployment/helm

# Ensure IDENTITY_VESSEL_URL is set in activity-api values
grep -q "IDENTITY_VESSEL_URL" environments/local.values.yaml || \
  echo "  - name: IDENTITY_VESSEL_URL
    value: http://identity-vessel.activity-system.svc.cluster.local:8080" >> environments/local.values.yaml
```

### Step 3: Deploy Changes with Helm

```bash
# Sync changes (this will do a rolling update)
helmfile -e local sync

# Monitor rollout
kubectl rollout status deployment/metabob-activity-api -n activity-system --timeout=300s
kubectl rollout status deployment/identity-vessel -n activity-system --timeout=300s
```

### Step 4: Verify Backward Compatibility

```bash
# If you have existing API keys in SurrealDB, test they still work
# This validates the fallback path

# Create a test key in SurrealDB (if you have the schema)
# Then authenticate with it
curl -X POST http://activity.metabob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<existing-surrealdb-key>"}'

# Should return JWT with source: "surrealdb"
```

### Step 5: Generate New Identity-Vessel Keys

```bash
# Generate new keys via identity-vessel
curl -X POST http://identity.metabob.local/v1/keys/generate \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUserId": "usr_migration_test",
    "name": "Migration Test Key",
    "scopes": ["read", "write"]
  }'

# Test the new key
export NEW_KEY="<key-from-response>"
curl -X POST http://activity.metabob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$NEW_KEY\"}"

# Should return JWT with source: "identity-vessel"
```

### Step 6: Monitor Logs

```bash
# Watch activity-api logs for validation path usage
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f | grep "auth"

# Look for:
# - "[auth] Using identity-vessel validated key" (new path)
# - "[auth] Using SurrealDB validated key (legacy)" (fallback path)
```

---

## Rollback Plan

If issues arise during upgrade:

### Option 1: Quick Rollback (Revert Code)

```bash
cd repos/deployment

# Rollback to previous deployment
helm rollback metabob-activity-api -n activity-system

# Verify services are back to previous version
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api
```

### Option 2: Full Rollback (Revert Git + Redeploy)

```bash
# Checkout previous version
git checkout <previous-commit>

# Rebuild and redeploy
./scripts/build-vessel.sh metabob-activity-api
helmfile -e local sync
```

### Option 3: Disable Identity-Vessel (Keep Running but Don't Use)

```bash
# The fallback to SurrealDB ensures existing keys keep working
# Identity-vessel can stay deployed, just won't be used if it fails

# No action needed - system self-heals via fallback
```

---

## Verification Procedures

### Health Checks

```bash
# 1. Check all pods running
kubectl get pods -n activity-system

# 2. Check services accessible
curl http://identity.metabob.local/health
curl http://activity.metabob.local/health

# 3. Check identity-vessel capabilities
curl http://identity.metabob.local/capabilities | jq .resolvers
```

### Integration Tests

```bash
# Run automated integration tests
./test-identity-vessel-integration.sh

# Expected output:
# - Identity vessel accessible ✓
# - Activity API accessible ✓
# - Key generation works ✓
# - Authentication works ✓
# - JWT token valid ✓
# - Key revocation works ✓
```

### Performance Tests

```bash
# Test validation latency
time curl -X POST http://activity.metabob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$TEST_USER_KEY\"}"

# Should complete in <100ms total (including network)
```

### Security Tests

```bash
# Test key revocation
KEY_ID="<keyId-from-generation>"
curl -X POST http://identity.metabob.local/v1/keys/revoke/$KEY_ID \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# Try to use revoked key (should fail)
curl -X POST http://activity.metabob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$REVOKED_KEY\"}"

# Should return 401 Unauthorized
```

---

## Common Issues and Troubleshooting

### Issue 1: Identity-Vessel Not Accessible

**Symptoms:**
- `curl http://identity.metabob.local/health` fails
- Activity-api logs show "identity vessel error (will try fallback)"

**Resolution:**
```bash
# Check pod status
kubectl get pods -n activity-system -l app.kubernetes.io/name=identity-vessel

# Check logs
kubectl logs -n activity-system -l app.kubernetes.io/name=identity-vessel --tail=50

# Restart if needed
kubectl rollout restart deployment/identity-vessel -n activity-system
```

### Issue 2: API_KEY_SECRET Mismatch

**Symptoms:**
- Keys generated with one secret don't validate with another
- "Invalid signature" errors

**Resolution:**
```bash
# Verify secret is consistent
kubectl get secret identity-vessel-secret -n activity-system -o jsonpath='{.data.api-key-secret}' | base64 -d

# Update if needed
kubectl create secret generic identity-vessel-secret \
  --from-literal=api-key-secret="$API_KEY_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart identity-vessel to pick up new secret
kubectl rollout restart deployment/identity-vessel -n activity-system
```

### Issue 3: JWT Generation Fails

**Symptoms:**
- Activity-api returns 500 error
- Logs show "Failed to generate JWT token"

**Resolution:**
```bash
# Check JWT_SECRET is set
kubectl get deployment metabob-activity-api -n activity-system -o yaml | grep JWT_SECRET

# Verify SurrealDB connection
kubectl exec -it surrealdb-0 -n activity-system -- surreal sql --help

# Check activity-api logs for detailed error
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100 | grep JWT
```

### Issue 4: Backward Compatibility Broken

**Symptoms:**
- Old API keys stop working
- All authentication returns 401

**Resolution:**
```bash
# Check if SurrealDB fallback is working
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api | grep "SurrealDB fallback"

# Verify RECORD access still exists in SurrealDB
kubectl exec -it surrealdb-0 -n activity-system -- \
  surreal sql --endpoint http://localhost:8000 \
  --namespace activity-system --database learning_loop \
  --username root --password "$SURREALDB_PASSWORD" \
  --command "INFO FOR DATABASE"

# Should show apikey_record ACCESS
```

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Identity-vessel validation | <2ms | Check identity-vessel logs |
| JWT generation | <3ms | Check activity-api logs |
| Total auth latency | <5ms | `time curl` command |
| Throughput | >100 req/s | Load testing with `ab` or `wrk` |

---

## Security Considerations

### API Key Security

1. **Bootstrap Key Protection**
   - Store in Kubernetes secrets only
   - Rotate annually
   - Never commit to git
   - Limit to admin users only

2. **User Key Management**
   - Enforce expiration (default 365 days)
   - Implement key rotation policy
   - Monitor usage patterns
   - Revoke on suspicious activity

3. **Secret Management**
   - API_KEY_SECRET: min 32 chars, random
   - JWT_SECRET: separate from API key secret
   - Rotate secrets annually
   - Use different secrets per environment

### Network Security

1. **Service-to-Service**
   - Use internal Kubernetes DNS
   - Don't expose identity-vessel externally (yet)
   - mTLS via Istio (optional enhancement)

2. **Rate Limiting**
   - Auth endpoints: 10 req/min per IP
   - Signin endpoints: 5 req/min per IP
   - Adjust based on usage patterns

---

## Monitoring and Alerts

### Key Metrics to Monitor

```bash
# Authentication success rate
# Should be >95%
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api | \
  grep -c "validated key" | awk '{total+=$1} END {print total}'

# Validation path distribution
# identity-vessel vs surrealdb usage
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api | \
  grep "source:" | sort | uniq -c

# Error rate
# Should be <1%
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api | \
  grep -c "error"
```

### Recommended Alerts

1. **High Error Rate**: >5% auth failures in 5 min window
2. **Identity-Vessel Down**: No successful validations in 1 min
3. **Latency Spike**: P95 latency >10ms
4. **Key Revocation Failure**: Redis connection errors

---

## Migration Timeline (Recommended)

### Week 1: Deploy Integration
- Deploy identity-vessel integration
- Generate bootstrap admin key
- Test with internal users only

### Week 2: Parallel Operation
- Both systems running side-by-side
- Monitor validation path distribution
- Generate identity-vessel keys for new users

### Month 1: Gradual Migration
- Email existing users about new key system
- Provide migration instructions
- Monitor adoption rate

### Month 3: Deprecation Notice
- Announce SurrealDB key deprecation
- Set end-of-life date
- Force key rotation for inactive users

### Month 6: Remove Legacy
- Disable SurrealDB fallback
- Clean up old code
- Celebrate unified auth system!

---

## Documentation Updates Needed

After deployment, update:

- [ ] User-facing API documentation with new key generation flow
- [ ] Developer guide with integration examples
- [ ] Dashboard UI to add API key management page
- [ ] CLI tools to use new authentication method
- [ ] Runbooks with troubleshooting procedures

---

## Success Criteria

Deployment is considered successful when:

- [ ] All services running and healthy
- [ ] Identity-vessel keys work with activity-api
- [ ] JWT tokens valid for all protected endpoints
- [ ] Key revocation works end-to-end
- [ ] Performance targets met (<5ms auth latency)
- [ ] Backward compatibility maintained (if upgrading)
- [ ] Zero downtime during rollout
- [ ] No increase in error rates
- [ ] Monitoring and alerts configured

---

## Contact and Support

For issues during deployment:
- Check logs: `kubectl logs -n activity-system <pod-name>`
- Review this document's troubleshooting section
- Check GitHub issues: `https://github.com/anthropics/metabob/issues`
- Emergency rollback: Follow "Rollback Plan" section above

---

## Appendix: Environment Variable Reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `API_KEY_SECRET` | Yes (identity-vessel) | None | HMAC signing secret |
| `ANTHROPIC_API_KEY` | Yes (minibob) | None | Claude API access |
| `SURREALDB_PASSWORD` | Yes | None | Database password |
| `SURREALDB_USERNAME` | No | `root` | Database username |
| `IDENTITY_VESSEL_URL` | No (activity-api) | Internal K8s DNS | Identity vessel endpoint |
| `JWT_SECRET` | No (activity-api) | SurrealDB password | JWT signing secret |
| `NODE_ENV` | No | `development` | Environment (dev/production) |
| `ADMIN_API_KEY` | Testing only | None | Bootstrap admin key |

---

## Appendix: File Locations

| File | Purpose |
|------|---------|
| `repos/identity-vessel/scripts/generate-bootstrap-key.ts` | Bootstrap key generator |
| `repos/identity-vessel/.bootstrap-key.json` | Key metadata (not the key!) |
| `repos/metabob-activity-api/src/routes/auth.ts` | Updated auth routes |
| `repos/deployment/helm/environments/local.values.yaml` | Local config |
| `test-identity-vessel-integration.sh` | Integration test script |
| `IDENTITY_VESSEL_INTEGRATION_PLAN.md` | Detailed integration plan |
| `DEPLOYMENT_PROCEDURE.md` | This document |
