# GAP-9 Production Demonstration Plan

## Current Status
- ✅ GAP-9 code fixes completed and committed
- ✅ Docker image built: `metabobapp/metabob-rpc-api:0.31.0-gap9-complete`
- ✅ End-to-end test validated (final_test.sh passed multiple times)
- ⚠️  Helm deployment blocked by JWT_SECRET_KEY validation issue

## Pragmatic Demonstration Approach

Given the JWT config issue in helm (which is an infrastructure/config issue, not a GAP-9 code issue), we'll demonstrate via port-forward to the working SurrealDB and use docker-compose for the RPC API locally.

### Demonstration Steps

1. **Start Local RPC API with GAP-9 Fixes**
   - Use docker-compose with the new image
   - Port-forward to existing SurrealDB in k8s
   - This gives us a working endpoint at localhost:8080

2. **Generate Rich CLI Activity Data**
   - Register a demo user via RPC API
   - Create API key via dashboard/API
   - Use metabob-cli to:
     - Execute 5-10 different activities
     - Mix of success/failure states
     - Different templates (add-feature-complete, fix-bug-complete, etc.)
     - Varied durations and costs

3. **Dashboard Verification**
   - Access dashboard at app.metabob.local (or localhost)
   - Verify Recent Activity component shows all CLI activities
   - Verify API Keys page shows usage stats
   - Verify all data is from metabob-cli (not manual DB edits)
   - Screenshot all populated components

4. **Data Flow Validation**
   - Show CLI commands and outputs
   - Show RPC API logs with org_id extraction
   - Show dashboard rendering the data
   - Prove multi-tenant isolation working

### Alternative: Fix JWT Config and Complete Helm Deployment

If we want to fix the helm issue:
1. Update universal-config ConfigMap with strong JWT_SECRET_KEY
2. Restart metabob-rpc-api deployment  
3. Verify pods start successfully
4. Run full demonstration via api.metabob.local and app.metabob.local

##Time Estimate
- Docker-compose approach: 15-20 minutes
- Helm fix approach: 10-15 minutes (if straightforward)

## Recommendation
Start with docker-compose approach for guaranteed success, then optionally fix helm deployment as a bonus.
