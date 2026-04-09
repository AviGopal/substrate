# Quick Verification Guide

> **Purpose**: Fast, practical verification for developers
> **Audience**: Developers making changes, CI/CD pipelines
> **Time to Read**: 5 minutes

---

## The 3-Minute Smoke Test

Run this before every push:

```bash
#!/bin/bash
# Save as: scripts/quick-verify.sh

set -e

echo "🔍 Quick Verification (3 minutes)"

# 1. Unit tests (30 sec)
echo "1/5 Running unit tests..."
cd repos/minibob && bun test --silent
cd ../metabob-activity-api && bun test --silent
cd ../..

# 2. Health check (10 sec)
echo "2/5 Checking backend health..."
curl -sf https://activity.metabob.com/health > /dev/null || {
  echo "❌ Backend unhealthy"
  exit 1
}

# 3. Authentication (10 sec)
echo "3/5 Verifying authentication..."
curl -sf -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  https://activity.metabob.com/v2/activities/templates > /dev/null || {
  echo "❌ Auth failed"
  exit 1
}

# 4. Type checking (60 sec)
echo "4/5 Type checking..."
cd repos/minibob && bun run typecheck --silent
cd ../metabob-activity-api && bun run typecheck --silent
cd ../..

# 5. Smoke test execution (60 sec)
echo "5/5 Running smoke test..."
bun test e2e/smoke.spec.ts

echo "✅ All checks passed! Safe to push."
```

**Usage**:
```bash
chmod +x scripts/quick-verify.sh
./scripts/quick-verify.sh
```

---

## Verify Changes by Component

### I changed MiniBob code

```bash
# 1. Run MiniBob tests
cd repos/minibob
bun test

# 2. Type check
bun run typecheck

# 3. Test manually
bun run index.ts --single "create a test file"

# 4. Verify API communication works
export METABOB_API_KEY="your-key"
bun run index.ts --single "list available activities"
```

### I changed Activity API code

```bash
# 1. Run Activity API tests
cd repos/metabob-activity-api
bun test

# 2. Type check
bun run typecheck

# 3. Test locally
bun run dev &
API_PID=$!

# Wait for server to start
sleep 2

# Test health endpoint
curl http://localhost:8080/health

# Test authentication
curl -H "Authorization: ApiKey test-key" \
  http://localhost:8080/v2/activities/templates

# Cleanup
kill $API_PID
```

### I changed activity templates

```bash
# 1. Validate schema
cd repos/minibob
bun test test/schema-validator.test.ts

# 2. Register template
cat > /tmp/test-template.json <<EOF
{
  "id": "test-new-feature",
  "name": "Test New Feature",
  "description": "Test template for new feature",
  "category": "test",
  "tasks": [...]
}
EOF

# 3. Test execution
minibob --single "run test-new-feature"

# 4. Check execution trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?limit=1" | jq
```

### I changed database schema

```bash
# 1. Test migration locally
cd repos/metabob-activity-api

# 2. Run migration
bun run scripts/run-migration.ts sql/migrations/XXX-new-migration.surql

# 3. Verify schema
bun test test/schema.test.ts

# 4. Run smoke test
bun test test/smoke.test.ts
```

### I changed authentication

```bash
# 1. Run auth tests
cd repos/metabob-activity-api
bun test test/api-key-auth.test.ts
bun test src/services/auth.test.ts

# 2. Test manually
# Valid key
curl -H "Authorization: ApiKey valid-key" \
  https://activity.metabob.com/v2/activities/templates

# Invalid key (should fail)
curl -H "Authorization: ApiKey invalid-key" \
  https://activity.metabob.com/v2/activities/templates

# Multi-tenant isolation
# Key for org A should not see org B templates
```

---

## Verify The Three Loops

### Loop 1: Impulse Flow

**What to verify**: Data flows through the system correctly

```bash
# Test impulse creation
curl -X POST https://activity.metabob.com/v2/impulses \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {"type": "memo", "content": "test data"},
    "metadata": {"shape": "test_impulse"},
    "budget": 1000
  }'

# Test impulse resolution
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {"type": "file", "path": "test.txt"}
  }'

# Test impulse chaining
# 1. Execute activity that produces output impulse
minibob --single "create file output.txt with content 'test'"

# 2. Verify output impulse created
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/impulses?shape=file&recent=true" | jq

# 3. Use output impulse as input to next activity
minibob --single "read file output.txt and summarize"
```

**Checklist**:
- [ ] Impulse created with `loaded: false`
- [ ] Impulse resolves when accessed
- [ ] Content respects budget
- [ ] Output impulses have correct metadata
- [ ] Impulses chain between activities

### Loop 2: Validation/Feedback

**What to verify**: System learns from execution outcomes

```bash
# Get baseline Thompson parameters
echo "Baseline:"
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/test-activity" \
  | jq '.thompson'

# Execute activity (success)
minibob --single "run test-activity"

# Check α increased
echo "After success:"
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/test-activity" \
  | jq '.thompson.alpha'

# Provide manual feedback
minibob
> run another-activity
> /teach   # Boost α
> /teach!  # Boost α more
> /warn    # Boost β
> /warn!!! # Boost β significantly

# Verify feedback recorded
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/another-activity" \
  | jq '.thompson'
```

**Checklist**:
- [ ] Successful execution increases α
- [ ] Failed execution increases β
- [ ] `/teach` increases α
- [ ] `/warn` increases β
- [ ] Thompson parameters affect recommendations
- [ ] Validation rules (requiredFiles, patterns, commands) work

### Loop 3: Discovery

**What to verify**: System discovers missing capabilities

> ⚠️ **Note**: Loop 3 is partially implemented. Some features planned but not yet built.

```bash
# Test available shapes query
curl -X POST https://activity.metabob.com/v2/impulses/available-shapes \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {"workdir": "/path/to/project"}
  }'

# Expected response:
# {
#   "shapes": ["file", "git_status", "test_results"],
#   "activities_producing": {
#     "git_status": ["analyze-repository"],
#     "test_results": ["run-tests"]
#   }
# }

# Test shape inference (when implemented)
# System should detect new output shapes from executions

# Test missing impulse detection (when implemented)
# System should identify when expected impulses are missing
```

**Checklist** (when fully implemented):
- [ ] Available shapes query returns current state
- [ ] Activities producing each shape listed
- [ ] New shapes inferred from executions
- [ ] Missing impulses detected
- [ ] Prerequisite activities suggested

---

## Common Verification Scenarios

### Scenario: New Activity Template

**Steps**:
1. Create template JSON
2. Validate schema
3. Register template
4. Execute template
5. Verify execution trace
6. Check Thompson parameters

```bash
# 1. Create template
cat > new-activity.json <<'EOF'
{
  "id": "my-new-activity",
  "name": "My New Activity",
  "description": "Does something useful",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "First step",
      "prompt": {
        "template": "Do the thing: {{goal}}",
        "maxTokens": 1000
      },
      "validation": {
        "requiredFiles": ["output.txt"]
      }
    }
  ],
  "variables": [
    {
      "name": "goal",
      "description": "What to do",
      "required": true
    }
  ]
}
EOF

# 2. Validate schema
cd repos/minibob
bun test test/schema-validator.test.ts

# 3. Register template
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @new-activity.json

# 4. Execute template
minibob --single "run my-new-activity with goal 'test run'"

# 5. Verify execution trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?templateId=my-new-activity&limit=1" \
  | jq

# 6. Check Thompson parameters
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/my-new-activity" \
  | jq '.thompson'
```

### Scenario: Debugging Failed Activity

**Steps**:
1. Get execution trace
2. Check task results
3. Review validation failures
4. Check impulse resolution
5. Verify tool calls

```bash
# 1. Get latest failed execution
TRACE_ID=$(curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?status=failed&limit=1" \
  | jq -r '.traces[0].id')

# 2. Get detailed trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces/$TRACE_ID" \
  | jq > trace.json

# 3. Check which task failed
cat trace.json | jq '.tasks[] | select(.status == "failed")'

# 4. Check validation errors
cat trace.json | jq '.tasks[].validation'

# 5. Check impulse resolution
cat trace.json | jq '.impulses[] | select(.loaded == false)'

# 6. Check tool calls
cat trace.json | jq '.tasks[].toolCalls[]'

# 7. Review error messages
cat trace.json | jq '.tasks[].error'
```

### Scenario: Verifying Learning Works

**Steps**:
1. Create two activity variants
2. Execute both multiple times
3. Check Thompson parameters converge
4. Verify better variant selected more often

```bash
# 1. Create variants A and B
# (Same activity, different implementations)
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @variant-a.json

curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @variant-b.json

# 2. Execute both 20 times each
for i in {1..20}; do
  minibob --single "run test-activity-variant-a"
  minibob --single "run test-activity-variant-b"
done

# 3. Check Thompson parameters
echo "Variant A:"
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/test-activity-variant-a" \
  | jq '.thompson'

echo "Variant B:"
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/test-activity-variant-b" \
  | jq '.thompson'

# 4. Request recommendations 100 times, count selections
for i in {1..100}; do
  curl -X POST https://activity.metabob.com/v2/activities/recommend \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    -d '{"goal": "test goal", "availableShapes": ["test"]}' \
    | jq -r '.recommendations[0].variantId'
done | sort | uniq -c

# Expect: Variant with higher α/β ratio selected more often
```

---

## Production Deployment Verification

### Before Deployment (Local)

```bash
# Run full test suite
cd repos/minibob && bun test
cd repos/metabob-activity-api && bun test
bun test e2e/

# Type check
cd repos/minibob && bun run typecheck
cd repos/metabob-activity-api && bun run typecheck

# Lint (if configured)
cd repos/metabob-activity-api && bun run lint
```

### After Canary Deployment

```bash
# 1. Health check
curl -f https://activity.metabob.com/health

# 2. Smoke test
./scripts/smoke-test.sh canary

# 3. Verify authentication
curl -f -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates

# 4. Test execution
minibob --single "verify canary deployment is working"

# 5. Check recent execution traces
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?limit=5" \
  | jq '.traces[] | {id, status, created}'

# 6. Monitor error rate
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/metrics" \
  | grep error_rate
```

### After Production Deployment

```bash
# Same as canary, but against production endpoint
# Plus:

# 1. Check dashboard
open https://internal.metabob.com

# 2. Verify no elevated error rates
# Check Grafana/metrics dashboard

# 3. Verify Thompson Sampling working
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates" \
  | jq '.templates[] | {id, thompson}'

# 4. Test end-to-end flow
minibob --single "verify production deployment"
```

---

## Troubleshooting Failed Verifications

### Test fails: "Connection refused"

**Problem**: Backend not running or unreachable

**Fix**:
```bash
# Check backend is running
curl https://activity.metabob.com/health

# If local:
cd repos/metabob-activity-api
bun run dev

# If deployed:
kubectl get pods -n activity-system
kubectl logs -n activity-system -l app=metabob-activity-api
```

### Test fails: "401 Unauthorized"

**Problem**: Invalid or missing API key

**Fix**:
```bash
# Check API key is set
echo $METABOB_API_KEY

# If not set:
export METABOB_API_KEY="your-key-here"

# Or use config file:
cat > ~/.metabob/config.json <<EOF
{
  "metabob": {
    "apiKey": "your-key-here",
    "endpoint": "https://activity.metabob.com"
  }
}
EOF
```

### Test fails: "Template not found"

**Problem**: Template not registered

**Fix**:
```bash
# Check template exists
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/template-id"

# If not found, register it:
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @template.json
```

### Test fails: "Validation failed"

**Problem**: Output doesn't match validation rules

**Fix**:
```bash
# Check validation rules in template
cat template.json | jq '.tasks[].validation'

# Check actual output
ls -la expected-file.txt
grep "expected-pattern" actual-file.txt

# Update validation rules to match reality or fix code
```

### Test fails: "Thompson parameters not updated"

**Problem**: Execution trace not stored or not processed

**Fix**:
```bash
# Check execution trace was stored
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?limit=1" \
  | jq

# Check trace has status field
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces/trace-id" \
  | jq '.status'

# Verify Thompson computation view
# (requires database access)
```

---

## Quick Reference Card

**Before pushing code**:
```bash
./scripts/quick-verify.sh
```

**After deployment**:
```bash
./scripts/health-check.sh canary
./scripts/health-check.sh production
```

**Manual smoke test**:
```bash
# 1. Health
curl https://activity.metabob.com/health

# 2. Auth
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates

# 3. Execute
minibob --single "create test file"

# 4. Verify trace
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?limit=1" | jq
```

**Check system is learning**:
```bash
# Get Thompson parameters
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/activity-id" \
  | jq '.thompson'

# Execute activity
minibob --single "run activity-id"

# Verify α or β increased
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/activity-id" \
  | jq '.thompson'
```

**Debug failed activity**:
```bash
# Get latest failure
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?status=failed&limit=1" \
  | jq > failure.json

# Check error
cat failure.json | jq '.tasks[] | select(.status == "failed") | .error'

# Check validation
cat failure.json | jq '.tasks[].validation'
```

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `METABOB_API_KEY` | Authentication | `mbk_1234...` |
| `ACTIVITY_API_URL` | Backend endpoint | `https://activity.metabob.com` |
| `ANTHROPIC_API_KEY` | LLM access | `sk-ant-...` |
| `SURREALDB_URL` | Database connection | `ws://surql.metabob.local:8000` |
| `REDIS_URL` | Cache connection | `redis://localhost:6379` |

**Set environment variables**:
```bash
# Option 1: Export in shell
export METABOB_API_KEY="your-key"
export ACTIVITY_API_URL="https://activity.metabob.com"

# Option 2: .env file
cat > .env <<EOF
METABOB_API_KEY=your-key
ACTIVITY_API_URL=https://activity.metabob.com
EOF

# Option 3: Config file
cat > ~/.metabob/config.json <<EOF
{
  "metabob": {
    "apiKey": "your-key",
    "endpoint": "https://activity.metabob.com"
  }
}
EOF
```
