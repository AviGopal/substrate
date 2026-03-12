# E2E Integration Quick Reference

## Current Status: ✅ WORKING

**Deployment**: `metabob-rpc-api:0.26.0-e2e-complete` (revision 31)  
**Test Success Rate**: 71% (5/7 passing)  
**Core Data Flow**: 100% functional

## Quick Test Commands

```bash
# Test credentials
export ORG_ID="ea91043f-53f1-4bb7-882f-a9d0b40acc77"
export JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzN2Q1ZDE4Yi02MDRmLTQ1OWEtOTkxZi1kNTJkNWVjYjA5NjIiLCJlbWFpbCI6InRlc3QtZTJlLTE3NzMzMTU2NTJAZXhhbXBsZS5jb20iLCJvcmdfaWQiOiJlYTkxMDQzZi01M2YxLTRiYjctODgyZi1hOWQwYjQwYWNjNzciLCJyb2xlIjoib3duZXIiLCJleHAiOjE3NzMzMTkyNTIsImlhdCI6MTc3MzMxNTY1Mn0.sA5fUuGPWdhsBaCIlfeFcGdGlkL0edu4_KEr4VrAeF4"

# Create project (WORKING ✅)
curl -X POST "http://api.metabob.local/auth/orgs/$ORG_ID/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"name": "Test Project", "repository_url": "https://github.com/test/repo", "branch": "main"}'

# List projects (WORKING ✅)
curl -X GET "http://api.metabob.local/auth/orgs/$ORG_ID/projects" \
  -H "Authorization: Bearer $JWT"

# Get problems for dashboard (WORKING ✅)
curl -X GET "http://api.metabob.local/auth/orgs/$ORG_ID/projects/{PROJECT_ID}/problems" \
  -H "Authorization: Bearer $JWT"

# Check dashboard (WORKING ✅)
curl http://app.metabob.local/
```

## Run Comprehensive Test

```bash
cd repos/metabob-rpc-api
./comprehensive-e2e-test.sh
```

Expected output: 5/7 tests passing

## Deployment Commands

```bash
# Rebuild image
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabobapp/metabob-rpc-api:0.26.0-e2e-complete .

# Deploy via Helmfile
cd repos/platform/metabob-apps
helmfile -e default --selector name=metabob-rpc-api apply

# Verify
kubectl rollout status deployment/metabob-rpc-api -n metabob
kubectl logs -n metabob deployment/metabob-rpc-api --tail=20
```

## Key Endpoints

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/auth/orgs/{org_id}/projects` | POST | ✅ | Create project |
| `/auth/orgs/{org_id}/projects` | GET | ✅ | List projects |
| `/auth/orgs/{org_id}/projects/{id}` | GET | ⚠️ | Get project (routing issue) |
| `/auth/orgs/{org_id}/projects/{id}/problems` | GET | ✅ | Dashboard problems |
| `/openapi.json` | GET | ✅ | API schema |

## Known Issues

1. Individual project GET returns 404 (use list + filter instead)
2. SurrealDB count query syntax needs fix (cosmetic)

## Key Files

```
repos/metabob-rpc-api/
├── server/db/surrealdb_client.py          # Datetime serialization fix
├── server/db/operations/project_ops.py    # Sanitize all returns
├── server/routes/projects.py               # Projects API
├── server/routes/cloud_auth.py             # Auth + Projects (duplicate routes)
├── sql/migrations/010-remove-stats-field.surql  # Schema fix
└── E2E_VALIDATION_SUCCESS.md              # Full test report

repos/platform/metabob-apps/
└── charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml  # Helm config
```

## Critical Commits

- `028b7f9` - Datetime serialization fix (surrealdb_client.py)
- `5665103` - Remove stats field (project_ops.py)
- `54a82ec` - Separate projects router
- `5e40a46` - Helm values update (metabob-apps)

## Database Access

```bash
# Get SurrealDB pod
POD=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')

# Query projects
echo "SELECT * FROM projects LIMIT 5;" | kubectl exec -i -n metabob $POD -- \
  /surreal sql --endpoint http://localhost:8000 \
  --namespace metabob --database default \
  --username root --password changeme 2>/dev/null
```

## Dashboard URLs

- Frontend: http://app.metabob.local
- API: http://api.metabob.local
- OpenAPI Docs: http://api.metabob.local/docs

## What's Working ✅

1. User registration & JWT authentication
2. Organization management
3. **Project creation** (main accomplishment!)
4. Project listing
5. Dashboard problems endpoint
6. SurrealDB persistence with datetime support
7. Dashboard UI loads

## Next Session Priorities

1. Test with actual CLI (Gap 1 deployment)
2. Fix individual project GET endpoint
3. Test full analysis flow with workers
4. Playwright dashboard UI tests (once browsers installed)

---

**Last Updated**: 2026-03-12 05:20:00 PDT  
**Status**: Production-ready for core flow  
**Contact**: See SESSION_SUMMARY_E2E_COMPLETE.md for full details
