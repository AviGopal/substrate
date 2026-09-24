# Quick Verification Guide

> **Purpose**: fast, practical verification for developers and CI.
> **Setup is elsewhere**: launching a substrate and connecting a client are in
> [README § Installation](../../README.md#installation). This guide starts from a running
> fleet.

---

## Is the fleet ready? Read the verdict

`substrate-status` is the one readiness answer. It reports five ordered levels, each
`pass`, `fail` or `unknown`, with the evidence for each; a level never passes unless every
lower level does, and a check that cannot run reports `unknown`, never `pass`.

| Level | Passes only when |
|---|---|
| `live` | every selected core unit is active and no restart count rose during evaluation |
| `seeded` | the key the client connection carries validates |
| `served` | every vessel the profile selects is active and every published port answers off loopback |
| `usable` | an LLM completion succeeds on some arm, local or federated, and the baked known-answer goal returns `reached:true` in time |
| `connected` | an authenticated request with the emitted key has arrived through a published port from outside the container |

```bash
docker exec <container> substrate-status                 # all five levels, plus image and running revisions
docker exec <container> substrate-status --wait usable   # block until a level passes; non-zero exit names the failing level
```

`docker ps` health and a unit's `active` state are not readiness: the image healthcheck
is the verdict at `seeded` only, and a fleet can be `served` while no goal can be reached.

The commands below read the target from the client configuration the fleet emitted:

```bash
CFG="${METABOB_CONFIG_PATH:-$HOME/.metabob/config.json}"
export ACTIVITY_API_URL="$(jq -r .metabob.endpoint "$CFG")"
export METABOB_API_KEY="$(jq -r .metabob.apiKey "$CFG")"
```

---

## The Primary Validation Harnesses

These are the authoritative test entry points:

```bash
# Failure-mode harness — validates the failure-mode classifications
bun run validation/scripts/failure-mode-harness.ts

# Stratified harness — measures Thompson learning + MRR
bun run validation/scripts/stratified-harness.ts

# Unit tests per repo
cd repos/activity-api && bun test
cd repos/identity-vessel && bun test
```

---

## Pre-Push Smoke Test

Run this before every push:

```bash
# 1. Unit tests
cd repos/development-vessel && bun test --silent && cd ../..
cd repos/activity-api && bun test --silent && cd ../..

# 2. Health check
curl -sf $ACTIVITY_API_URL/health || { echo "Backend unhealthy"; exit 1; }

# 3. Auth check
curl -sf -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  $ACTIVITY_API_URL/v2/activities/templates > /dev/null || { echo "Auth failed"; exit 1; }

# 4. Type check
cd repos/development-vessel && bun run typecheck --silent && cd ../..
cd repos/activity-api && bun run typecheck --silent && cd ../..

echo "All checks passed."
```

---

## Verify Changes by Component

### Goal-dispatch path changed

```bash
cd repos/goal-host-vessel
bun test
bun run typecheck
```

Then dispatch against the running substrate through the cockpit
(`mcp__metabob__run_goal_async`) and read `reached`, not `status`.

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
docker exec <container> vessel-ctl restart activity-api   # migrations apply on unit start

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
  "$ACTIVITY_API_URL/v2/activities/templates/$TEMPLATE_ID" | jq '.metrics | {thompson_alpha, thompson_beta}'

# 2. Execute it — dispatch through the cockpit:
#    mcp__metabob__run_goal_async { goal: "run $TEMPLATE_ID" }

# 3. Verify α increased (success) or β increased (failure)
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/$TEMPLATE_ID" | jq '.metrics | {thompson_alpha, thompson_beta}'
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
# Compare MRR against the last recorded baseline, not against a number in a doc
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

# 2. Execute it — mcp__metabob__run_goal_async { goal: "run my-new-activity" }

# 3. Check execution trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?templateId=my-new-activity&limit=1" | jq

# 4. Check Thompson α/β was seeded
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/my-new-activity" | jq '.metrics | {thompson_alpha, thompson_beta}'
```

### Debug a failed activity

```bash
# Get latest failure
TRACE_ID=$(curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?status=failed&limit=1" \
  | jq -r '.executions[0].id')

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
  "$ACTIVITY_API_URL/v2/activities/templates/variant-a" | jq '.metrics | {thompson_alpha, thompson_beta}'
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/variant-b" | jq '.metrics | {thompson_alpha, thompson_beta}'

# Sample recommendations — better variant should dominate over time
for i in {1..20}; do
  curl -s -X POST $ACTIVITY_API_URL/v2/activities/recommend \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"task_description": "test goal", "impulse_shapes": ["test"]}' \
    | jq -r '.recommendations[0].template_id'
done | sort | uniq -c
```

---

## Troubleshooting

### "Connection refused" / "unhealthy"

```bash
docker exec <container> substrate-status          # which level fails, and why
docker logs <container> --tail=50                 # a container that never started
docker exec <container> systemctl status activity-api
```

A container that is not running at all is a setup question: see README § Installation.

### "401 Unauthorized"

```bash
echo $METABOB_API_KEY   # Must be set
# Format is mb-<base64>-<hex>, ~160 chars. Compare against
# `docker exec <container> substrate-key show`. A short value is a pre-seed
# placeholder, not a key — it reads without error and 401s on every call.

# The client configuration (re-emit with substrate-connect if it is stale):
jq .metabob "${METABOB_CONFIG_PATH:-$HOME/.metabob/config.json}"
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
  "$ACTIVITY_API_URL/v2/activities/execution-traces?limit=1" | jq '.executions[0].status'

# 2. Confirm Thompson write path is active (check activity-api logs)
docker exec substrate-live bun /vessels/seed-identity.ts   # ensure auth seeded
```

### Dense search disabled (embedding.status=disabled)

This indicates the `EMBEDDING_MODEL_DIR` env var is missing. Check:

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
# mcp__metabob__run_goal_async { goal: "your goal here" }

# Latest trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/execution-traces?limit=1" | jq

# Thompson check
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "$ACTIVITY_API_URL/v2/activities/templates/TEMPLATE_ID" | jq '.metrics | {thompson_alpha, thompson_beta}'

# Failure-mode harness
bun run validation/scripts/failure-mode-harness.ts

# Stratified harness (MRR + Thompson)
bun run validation/scripts/stratified-harness.ts
```

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `METABOB_API_KEY` | Authentication | `mb-<base64>-<hex>` (~160 chars) |
| `ACTIVITY_API_URL` | Backend endpoint | `http://localhost:18080` |
| `SURREALDB_URL` | Database | `ws://localhost:8000` |

Client tooling reads the client configuration file (`~/.metabob/config.json`, or the file
`METABOB_CONFIG_PATH` names; a project-local `.metabob/config.json` shadows both). The
fleet emits it with `substrate-connect`; nothing on the host fills an unset value from it at
launch.
