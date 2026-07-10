# Quick Verification Guide

> **Purpose**: Fast, practical verification for developers
> **Audience**: Developers making changes, CI/CD pipelines
> **Updated**: 2026-05-27

---

## Substrate Endpoints

Configure your substrate in `~/.metabob/config.json`. All verification commands below use `$ACTIVITY_API_URL`:

```bash
# Local substrate (Phase 26+, primary development target)
export ACTIVITY_API_URL="http://localhost:18080"

# Canary / pre-prod
export ACTIVITY_API_URL="https://activity.metabob.com"
```

---

## The Primary Validation Harnesses

These are the current, authoritative test entry points (as of Phase 26+):

```bash
# Failure-mode harness — validates all 63 failure-mode classifications
bun run validation/scripts/failure-mode-harness.ts

# Stratified harness — measures Thompson learning + MRR
bun run validation/scripts/stratified-harness.ts

# Unit tests per repo
cd repos/minibob && bun test
cd repos/activity-api && bun test
cd repos/identity-vessel && bun test
```

---

## Pre-Push Smoke Test

Run this before every push:

```bash
# 1. Unit tests
cd repos/minibob && bun test --silent && cd ../..
cd repos/activity-api && bun test --silent && cd ../..

# 2. Health check
curl -sf $ACTIVITY_API_URL/health || { echo "Backend unhealthy"; exit 1; }

# 3. Auth check
curl -sf -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  $ACTIVITY_API_URL/v2/activities/templates > /dev/null || { echo "Auth failed"; exit 1; }

# 4. Type check
cd repos/minibob && bun run typecheck --silent && cd ../..
cd repos/activity-api && bun run typecheck --silent && cd ../..

echo "All checks passed."
```

---

## Verify Changes by Component

### MiniBob code changed

```bash
cd repos/minibob
bun test
bun run typecheck
# Test goal dispatch against the local substrate:
bun run index.ts --single "list available activities"
```

### Activity API code changed

```bash
cd repos/activity-api
bun test
bun run typecheck

# Start locally and spot-check:
bun run dev &
sleep 2
curl http://localhost:8080/health
curl -H "Authorization: ApiKey $METABOB_API_KEY" http://localhost:8080/v2/activities/templates
kill %1
```

### Database schema / migration changed

```bash
cd repos/activity-api

# Hot-reload in substrate:
make -C scripts/substrate substrate-restart-activity-api

# Verify migration applied:
curl -sf $ACTIVITY_API_URL/health | jq .
bun test test/
```

### Authentication changed

Auth is via identity-vessel (`validateApiKeyWithFallback`). The reference flow:

```
Authorization: ApiKey <key>
  → activity-api middleware
    → POST {identity_vessel}/v1/auth/resolve
      → { authenticated, orgId, userId, scopes }
```

Test it:

```bash
# Valid key (should return 200 + templates)
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  $ACTIVITY_API_URL/v2/activities/templates

# Invalid key (should return 401)
curl -H "Authorization: ApiKey mb_bad_key" \
  $ACTIVITY_API_URL/v2/activities/templates
# Expect: HTTP 401

# Missing key (should return 401)
curl $ACTIVITY_API_URL/v2/activities/templates
# Expect: HTTP 401
```

Multi-tenant isolation: org A's key must not return org B's templates.

---

## Verify the Learning Loop

### Thompson parameters update after execution

```bash
# 1. Get baseline α/β for a template
TEMPLATE_ID="your-template-id"
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/$TEMPLATE_ID" | jq '.thompson'

# 2. Execute it (deprecated — agents dispatch via the metabob-mcp
#    `mcp__metabob__run_goal` tool; the minibob CLI is being retired)
minibob --single "run $TEMPLATE_ID"

# 3. Verify α increased (success) or β increased (failure)
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/$TEMPLATE_ID" | jq '.thompson'
```

**Checklist**:
- [ ] Successful execution increases `alpha`
- [ ] Failed execution increases `beta`
- [ ] `POST /v2/activities/recommend` returns `alpha`/`beta` per candidate
- [ ] `fallback_tier: "fts_hybrid"` present in recommend response (confirms dense search active)

### Dense search / MRR

```bash
# Confirm dense search is enabled (expect embedding.status=active, not disabled)
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/health" | jq '.embedding'

# Run the stratified harness to get MRR:
bun run validation/scripts/stratified-harness.ts
# Baseline MRR should be >= 0.2361 (post-F-V58-fix)
```

---

## Common Verification Scenarios

### New activity template

```bash
# 1. Register
curl -X POST $ACTIVITY_API_URL/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @new-activity.json

# 2. Execute via minibob
minibob --single "run my-new-activity"

# 3. Check execution trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?templateId=my-new-activity&limit=1" | jq

# 4. Check Thompson α/β was seeded
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/my-new-activity" | jq '.thompson'
```

### Debug a failed activity

```bash
# Get latest failure
TRACE_ID=$(curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?status=failed&limit=1" \
  | jq -r '.traces[0].id')

# Full trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces/$TRACE_ID" | jq > trace.json

# Which task failed
jq '.tasks[] | select(.status == "failed")' trace.json

# Failure mode classification
jq '.failure_mode' trace.json

# Tool calls on the failed task
jq '.tasks[] | select(.status == "failed") | .toolCalls[]' trace.json
```

Failure mode types: `verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`.

### Verify variant A/B learning

```bash
# Run both variants several times, then compare Thompson posteriors
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/variant-a" | jq '.thompson'
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/variant-b" | jq '.thompson'

# Sample recommendations — better variant should dominate over time
for i in {1..20}; do
  curl -s -X POST $ACTIVITY_API_URL/v2/activities/recommend \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"goal": "test goal", "availableShapes": ["test"]}' \
    | jq -r '.recommendations[0].variantId'
done | sort | uniq -c
```

---

## Canary / Production Deployment Verification

### After canary deployment

```bash
# Health
curl -f https://activity.metabob.com/health

# Auth
curl -f -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates

# Recent execution traces (confirms traces are landing)
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?limit=5" \
  | jq '.traces[] | {id, status, created}'

# End-to-end goal
minibob --single "verify canary deployment is working"
```

### Promote canary to production

After canary validation passes:

```bash
cd repos/deployment
./scripts/promote-canary-to-production.sh
```

---

## Troubleshooting

### "Connection refused" / "unhealthy"

```bash
# Local substrate
docker ps | grep substrate-live
make -C scripts/substrate substrate-run       # if not running
docker logs substrate-live --tail=50

# Canary
curl https://activity.metabob.com/health
# Or check pod status (if kubectl available):
kubectl get pods -n activity-system
```

### "401 Unauthorized"

```bash
echo $METABOB_API_KEY   # Must be set
# Format should start with mb_ (e.g. mb_live_..., mb_inst_...)

# Configure via file:
cat ~/.metabob/config.json | jq .metabob
```

### "Template not found"

```bash
# List all templates (search by name fragment)
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates?q=my-template-name" | jq '.templates[].id'
```

### "Thompson parameters not updating"

```bash
# 1. Confirm trace was stored
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?limit=1" | jq '.traces[0].status'

# 2. Confirm Thompson write path is active (check activity-api logs)
docker exec substrate-live bun /vessels/seed-identity.ts   # ensure auth seeded
```

### Dense search disabled (embedding.status=disabled)

This indicates the `EMBEDDING_MODEL_DIR` env var is missing (F-V58). Check:

```bash
docker exec substrate-live env | grep EMBEDDING
# Should show EMBEDDING_MODEL_DIR=/vessels/assets/models or similar
```

---

## Quick Reference Card

```bash
# Health
curl $ACTIVITY_API_URL/health

# Auth check
curl -H "Authorization: ApiKey $METABOB_API_KEY" $ACTIVITY_API_URL/v2/activities/templates

# Run goal
minibob --single "your goal here"

# Latest trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?limit=1" | jq

# Thompson check
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/TEMPLATE_ID" | jq '.thompson'

# Failure-mode harness
bun run validation/scripts/failure-mode-harness.ts

# Stratified harness (MRR + Thompson)
bun run validation/scripts/stratified-harness.ts
```

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `METABOB_API_KEY` | Authentication | `mb_live_...` |
| `ACTIVITY_API_URL` | Backend endpoint | `http://localhost:18080` |
| `ANTHROPIC_API_KEY` | LLM access | `sk-ant-...` |
| `SURREALDB_URL` | Database | `ws://localhost:8000` |

Preferred configuration via `~/.metabob/config.json`:

```json
{
  "metabob": {
    "apiKey": "your-key",
    "endpoint": "http://localhost:18080"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```
