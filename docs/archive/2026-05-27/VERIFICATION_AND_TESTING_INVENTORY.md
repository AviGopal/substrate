# Verification and Testing Inventory

> **Purpose**: Document all verification mechanisms - how we know the system works
> **Date**: 2026-04-08
> **Audience**: Developers validating changes, CI/CD pipelines, new contributors

---

## Table of Contents

1. [Test File Inventory](#test-file-inventory)
2. [Test Coverage Matrix](#test-coverage-matrix)
3. [Verification Checklists by Loop](#verification-checklists-by-loop)
4. [Testing Strategies](#testing-strategies)
5. [Smoke Test Suite](#smoke-test-suite)
6. [Production Validation](#production-validation)
7. [Testing Gaps and Recommendations](#testing-gaps-and-recommendations)
8. [How to Add New Tests](#how-to-add-new-tests)

---

## Test File Inventory

### MiniBob (`repos/minibob`)

**Test Framework**: Bun test
**Test Location**: `repos/minibob/test/`
**Run Command**: `bun test`

| File | Tests | Purpose |
|------|-------|---------|
| `test/auth-e2e.test.ts` | API key authentication flow | E2E test for config loading, MCP connection with API key, template creation with org isolation |
| `test/schema-validator.test.ts` | Template schema validation | Validates camelCase naming, required fields, nested structure consistency |
| `test/template-camelcase.test.ts` | Naming convention enforcement | Ensures templates use camelCase (not snake_case) |
| `test/template-registration-integration.test.ts` | Template registration | Tests template creation, updating, deletion via MCP |

**Coverage**:
- ✅ Authentication (API key)
- ✅ Template schema validation
- ✅ Multi-tenant isolation
- ✅ Template registration via MCP
- ❌ Activity execution (no execution tests yet)
- ❌ Impulse lifecycle (no impulse loading/unloading tests)
- ❌ Boredom system (no autonomous task tests)

### metabob-activity-api (`repos/metabob-activity-api`)

**Test Framework**: Bun test
**Test Location**: `repos/metabob-activity-api/src/` and `repos/metabob-activity-api/test/`
**Run Command**: `bun test`

| File | Tests | Purpose |
|------|-------|---------|
| `src/routes/activities.test.ts` | Thompson Sampling | Tests Beta distribution, exploration/exploitation, reproducible seeding |
| `src/routes/endpoints.test.ts` | API endpoints | Tests route handling, request validation, response formats |
| `src/routes/schema-transformation.test.ts` | Schema transformations | Tests data shape transformations between formats |
| `src/services/auth.test.ts` | Authentication middleware | Tests JWT and API key validation |
| `src/utils/surrealdb-types.test.ts` | Database types | Tests SurrealDB type conversions |
| `src/utils/semantic-tags.test.ts` | Semantic tagging | Tests keyword → tag mappings for activity categorization |
| `test/integration/connection-slots.test.ts` | Connection pooling | Tests database connection slot management |
| `test/execution-cache.test.ts` | Execution caching | Tests cache hits/misses for repeated executions |
| `test/goal-impulse-resolver.test.ts` | Goal processing | Tests goal parsing and impulse resolution |
| `test/vessels.test.ts` | Vessel management | Tests vessel registration and lifecycle |
| `test/api-key-auth.test.ts` | API key authentication | Tests header extraction, validation, org isolation |
| `tests/milestone6.test.ts` | Milestone verification | Integration test for major features |

**Coverage**:
- ✅ Thompson Sampling (Beta distribution)
- ✅ Authentication (JWT + API key)
- ✅ Multi-tenant isolation
- ✅ Database connection management
- ✅ Semantic tagging
- ❌ Impulse resolution for all types (only some types tested)
- ❌ Full execution trace storage (partial coverage)
- ❌ Pattern recognition (no tests yet)

### E2E Tests (`/e2e`)

**Test Framework**: Bun test / Playwright
**Test Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/e2e/`
**Run Command**: `bun test e2e/`

| File | Tests | Purpose |
|------|-------|---------|
| `goal-flow-tests.spec.ts` | Complete goal flow | User goal → recommendation → execution → validation → feedback |
| `impulse-investigation.spec.ts` | Impulse lifecycle | Impulse creation, loading, resolution, unloading |
| `live-goal-flow-validation.spec.ts` | Live validation | Tests against running canary deployment |

**Coverage**:
- ✅ Goal-to-execution flow
- ✅ Thompson Sampling recommendations
- ✅ Impulse lifecycle basics
- ❌ Multi-vessel coordination
- ❌ Boredom task execution
- ❌ Ribosome pattern (template extraction)

### Dashboard Tests

**metabob-cloud-dashboard**: `repos/metabob-cloud-dashboard/e2e/`
- `login.spec.ts` - Authentication flow
- `navigation.spec.ts` - UI navigation
- `api-keys.spec.ts` - API key management

**metabob-internal-dashboard**: `repos/metabob-internal-dashboard/tests/`
- `basic.spec.ts` - Basic UI functionality

**activity-dashboard**: No tests found (⚠️ gap)

---

## Test Coverage Matrix

### Loop 1: Impulse Flow

| Component | What's Tested | What's Not Tested |
|-----------|---------------|-------------------|
| **Lazy Loading** | ❌ Not tested | Impulse loading on demand, memory management |
| **Budget Enforcement** | ❌ Not tested | Token budget limits, truncation behavior |
| **Impulse Chaining** | ✅ Partial (e2e) | Output impulse → input impulse for next activity |
| **Resolver Transformations** | ✅ Partial (schema tests) | All impulse types (file, trace, memo, etc.) |
| **Pointer Validation** | ❌ Not tested | Invalid pointer handling, missing resolver errors |

### Loop 2: Validation/Feedback

| Component | What's Tested | What's Not Tested |
|-----------|---------------|-------------------|
| **Internal Validation** | ✅ Schema validation | Runtime validation (requiredFiles, patterns, commands) |
| **Thompson Sampling Updates** | ✅ Beta distribution | Actual α/β updates after execution |
| **Manual Feedback** | ❌ Not tested | `/teach` and `/warn` commands |
| **Selection Uses Thompson** | ✅ Sampling logic | Integration with actual execution outcomes |
| **Multi-tenant Isolation** | ✅ Auth middleware | Cross-org template access attempts |

### Loop 3: Discovery

| Component | What's Tested | What's Not Tested |
|-----------|---------------|-------------------|
| **Shape Inference** | ❌ Not tested | Automatic shape detection from traces |
| **Missing Impulse Detection** | ❌ Not tested | Identifying when expected impulses are missing |
| **Impulse Suggestions** | ❌ Not tested | Recommending impulses for activities |
| **State Space Queries** | ❌ Not tested | Available shapes query, state space exploration |
| **Ribosome Pattern** | ❌ Not tested | Template extraction from successful executions |

### Infrastructure

| Component | What's Tested | What's Not Tested |
|-----------|---------------|-------------------|
| **Health Checks** | ✅ `/health` endpoint | Database connectivity, Redis availability |
| **Database Schema** | ✅ Type conversion | Migration correctness, rollback safety |
| **Connection Pooling** | ✅ Slot management | Connection leak detection, recovery |
| **WebSocket** | ❌ Not tested | Live updates, reconnection handling |
| **Caching** | ✅ Basic cache | Cache invalidation, TTL behavior |

---

## Verification Checklists by Loop

### Loop 1: Impulse Flow Verification

**How to verify lazy loading works:**
1. Create impulse with pointer (unloaded state: `loaded: false`)
2. Execute activity that uses the impulse
3. Check that impulse is loaded only when accessed
4. Verify `loaded: true` and `content` populated
5. Check memory usage before/after

**How to verify budget enforcement:**
1. Create impulse with `budget: 1000` tokens
2. Point to large file (>1000 tokens)
3. Load impulse
4. Verify content is truncated to budget
5. Check that metadata includes `truncated: true`

**How to verify impulse chaining:**
1. Execute activity A that produces output impulse
2. Verify output impulse created with correct shape
3. Use output as input to activity B
4. Verify B can resolve and load the impulse
5. Check lineage metadata (`producedBy`)

**How to verify resolver transformations:**
```bash
# Test file resolver
curl -X POST http://activity.metabob.local/v2/impulses/resolve \
  -H "Authorization: ApiKey $API_KEY" \
  -d '{"pointer": {"type": "file", "path": "test.txt"}}'

# Test trace resolver
curl -X POST http://activity.metabob.local/v2/impulses/resolve \
  -H "Authorization: ApiKey $API_KEY" \
  -d '{"pointer": {"type": "activityExecutionTrace", "id": "exec_123"}}'

# Verify response includes content and metadata
```

### Loop 2: Validation/Feedback Verification

**How to verify internal validation works:**
```bash
# Create activity with validation rules
cd repos/minibob
cat > test-validation.json <<EOF
{
  "id": "test-validation",
  "tasks": [{
    "validation": {
      "requiredFiles": ["output.txt"],
      "requiredPatterns": [{"file": "output.txt", "pattern": "SUCCESS"}],
      "forbiddenPatterns": [{"file": "output.txt", "pattern": "ERROR"}]
    }
  }]
}
EOF

# Execute activity
bun run index.ts run test-validation

# Verify:
# - output.txt created
# - Contains "SUCCESS"
# - Does NOT contain "ERROR"
```

**How to verify Thompson Sampling updates:**
```bash
# 1. Get current α/β for activity
curl http://activity.metabob.local/v2/activities/templates/test-activity \
  -H "Authorization: ApiKey $API_KEY" | jq '.thompson'

# 2. Execute activity (success)
minibob --single "run test-activity"

# 3. Check updated α (should increase by 1)
curl http://activity.metabob.local/v2/activities/templates/test-activity \
  -H "Authorization: ApiKey $API_KEY" | jq '.thompson.alpha'

# 4. Execute activity (failure)
# Force failure by invalid inputs

# 5. Check updated β (should increase by 1)
curl http://activity.metabob.local/v2/activities/templates/test-activity \
  -H "Authorization: ApiKey $API_KEY" | jq '.thompson.beta'
```

**How to verify manual feedback:**
```bash
# In MiniBob REPL
minibob
> run test-activity
> /teach  # Should boost α
> run test-activity
> /warn   # Should boost β

# Verify via API
curl http://activity.metabob.local/v2/activities/templates/test-activity/feedback \
  -H "Authorization: ApiKey $API_KEY"
```

**How to verify selection uses Thompson parameters:**
```bash
# Create two variants of same activity
# Variant A: α=10, β=2 (83% success)
# Variant B: α=5, β=1 (83% success but less data)

# Request recommendations 100 times
for i in {1..100}; do
  curl -X POST http://activity.metabob.local/v2/activities/recommend \
    -H "Authorization: ApiKey $API_KEY" \
    -d '{"goal": "test goal", "availableShapes": ["test"]}' \
    | jq -r '.recommendations[0].variantId'
done | sort | uniq -c

# Variant A should be selected MORE often (exploitation)
# Variant B should still be selected SOMETIMES (exploration)
```

### Loop 3: Discovery Verification

**How to verify shape inference works:**
```typescript
// Not yet implemented - planned functionality
// Would test:
// 1. Execute activity with unknown output
// 2. System analyzes output structure
// 3. Infers shape automatically
// 4. Registers new shape type
```

**How to verify missing impulse detection:**
```typescript
// Not yet implemented - planned functionality
// Would test:
// 1. Activity expects input shape X
// 2. Only shapes Y, Z available
// 3. System detects gap
// 4. Suggests activities that produce X
```

**How to verify impulse suggestions:**
```typescript
// Not yet implemented - planned functionality
// Would test:
// 1. Goal requires shape not in current state
// 2. System queries state space
// 3. Finds activities that produce needed shape
// 4. Recommends prerequisite activities
```

**How to verify state space queries:**
```bash
# Current implementation partial - needs expansion
curl http://activity.metabob.local/v2/impulses/available-shapes \
  -H "Authorization: ApiKey $API_KEY" \
  -d '{"context": {"workdir": "/path"}}'

# Should return:
# {
#   "shapes": ["file", "git_status", "test_results"],
#   "activities_producing": {
#     "git_status": ["analyze-repository"],
#     "test_results": ["run-tests"]
#   }
# }
```

---

## Testing Strategies

### Testing Frameworks

| Component | Framework | Run Command |
|-----------|-----------|-------------|
| MiniBob | Bun test | `cd repos/minibob && bun test` |
| Activity API | Bun test | `cd repos/metabob-activity-api && bun test` |
| E2E Tests | Bun test + Playwright | `bun test e2e/` |
| Cloud Dashboard | Playwright | `cd repos/metabob-cloud-dashboard && bun test` |
| Internal Dashboard | Playwright | `cd repos/metabob-internal-dashboard && bun test` |

### Mocking/Stubbing Strategies

**MiniBob**:
- LLM responses: Use Bun's built-in mocking
- File system: Use temporary directories
- MCP backend: Can use real backend or mock responses
- Git operations: Use test repositories

**Activity API**:
- SurrealDB: Use test database (separate namespace)
- Redis: Use test Redis instance (different DB number)
- Identity service: Mock HTTP responses
- LLM calls: Stub Anthropic SDK

**E2E Tests**:
- Minimal mocking (test real system)
- Use test organization/project
- Clean up test data after each run

### Test Data/Fixtures

**Location**: Various `test/fixtures/` directories

| Repository | Fixtures | Purpose |
|------------|----------|---------|
| `repos/minibob/test/fixtures/` | (none currently) | Could add sample templates, configs |
| `repos/metabob-activity-api/sql/` | Migration scripts | Database schema setup |
| `e2e/fixtures/` | (none currently) | Could add sample goals, templates |

**Recommended additions**:
- Sample activity templates (valid/invalid)
- Sample impulse pointers (all types)
- Sample execution traces
- Sample user configs

### Assertions and Matchers

**Bun test** provides:
```typescript
expect(value).toBe(expected)
expect(value).toEqual(expected)
expect(value).toBeCloseTo(number, precision)
expect(value).toBeGreaterThan(number)
expect(value).toContain(item)
expect(value).toMatch(regex)
expect(fn).toThrow()
expect(promise).resolves.toBe(value)
expect(promise).rejects.toThrow()
```

**Custom matchers** (recommended to add):
```typescript
// Test Thompson Sampling behavior
expect(selections).toFavorExploitation(exploitationRatio)

// Test impulse loading
expect(impulse).toBeLoaded()
expect(impulse).toRespectBudget()

// Test activity outcomes
expect(execution).toProduceImpulse(shape)
expect(execution).toPassValidation()
```

### Code Coverage Tools

**Current**: None configured
**Recommended**: Bun has built-in coverage support

```bash
# Generate coverage report
bun test --coverage

# Output coverage to file
bun test --coverage --coverage-reporter=lcov

# View in browser
bun test --coverage --coverage-reporter=html
open coverage/index.html
```

**Coverage goals**:
- Unit tests: 80%+ for critical paths
- Integration tests: Cover all API endpoints
- E2E tests: Cover main user flows

---

## Smoke Test Suite

**Purpose**: Minimal tests to verify system is working
**Target Runtime**: < 1 minute
**Run Frequency**: On every push, before deployment

### MiniBob Smoke Tests

```bash
#!/bin/bash
# repos/minibob/test/smoke.sh

set -e

echo "=== MiniBob Smoke Tests ==="

# Test 1: Config loads
echo "Test 1: Config loading..."
bun run index.ts --help > /dev/null
echo "✓ Config loaded"

# Test 2: Schema validation works
echo "Test 2: Schema validation..."
bun test test/schema-validator.test.ts
echo "✓ Schema validation works"

# Test 3: Can connect to backend
echo "Test 3: Backend connectivity..."
curl -f http://activity.metabob.com/health > /dev/null
echo "✓ Backend reachable"

echo "=== All smoke tests passed ==="
```

### Activity API Smoke Tests

```bash
#!/bin/bash
# repos/metabob-activity-api/test/smoke.sh

set -e

echo "=== Activity API Smoke Tests ==="

# Test 1: Server starts
echo "Test 1: Server health..."
curl -f http://activity.metabob.com/health > /dev/null
echo "✓ Server healthy"

# Test 2: Authentication works
echo "Test 2: Authentication..."
curl -f -H "Authorization: ApiKey $METABOB_API_KEY" \
  http://activity.metabob.com/v2/activities/templates > /dev/null
echo "✓ Authentication working"

# Test 3: Thompson Sampling
echo "Test 3: Thompson Sampling..."
bun test src/routes/activities.test.ts
echo "✓ Thompson Sampling works"

echo "=== All smoke tests passed ==="
```

### E2E Smoke Test

```typescript
// e2e/smoke.spec.ts

import { test, expect } from 'bun:test'

test('E2E Smoke Test: Complete Goal Flow', async () => {
  // 1. Submit goal
  const goal = "verify system is working"

  // 2. Get recommendations
  const recommendations = await fetch(
    'https://activity.metabob.com/v2/activities/recommend',
    {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${process.env.METABOB_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        goal,
        availableShapes: ['memo']
      })
    }
  ).then(r => r.json())

  expect(recommendations.recommendations.length).toBeGreaterThan(0)

  // 3. Verify Thompson parameters present
  const first = recommendations.recommendations[0]
  expect(first.thompson).toBeDefined()
  expect(first.thompson.alpha).toBeGreaterThan(0)
  expect(first.thompson.beta).toBeGreaterThan(0)
})
```

### Running Smoke Tests

```bash
# Run all smoke tests
./scripts/smoke-test.sh

# Run specific component
cd repos/minibob && ./test/smoke.sh
cd repos/metabob-activity-api && ./test/smoke.sh
bun test e2e/smoke.spec.ts
```

---

## Production Validation

### Health Endpoints

| Endpoint | Expected Response | What It Checks |
|----------|-------------------|----------------|
| `https://activity.metabob.com/health` | `200 OK` | Server running |
| `https://activity.metabob.com/health` (body) | `{"status": "healthy"}` | Basic functionality |
| `https://identity.metabob.com/health` | `200 OK` | Identity service |

**Monitoring script**:
```bash
#!/bin/bash
# scripts/health-check.sh

ENDPOINTS=(
  "https://activity.metabob.com/health"
  "https://identity.metabob.com/health"
)

for endpoint in "${ENDPOINTS[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
  if [ "$response" = "200" ]; then
    echo "✓ $endpoint"
  else
    echo "✗ $endpoint (HTTP $response)"
    exit 1
  fi
done
```

### Metrics Tracked

**Activity API metrics** (available via `/metrics` endpoint):
- Request rate (requests/sec)
- Response time (p50, p95, p99)
- Error rate (5xx responses)
- Database connection pool usage
- Thompson Sampling recommendations/sec
- Impulse resolution time

**SurrealDB metrics**:
- Query latency
- Connection count
- Database size
- Table row counts

**Redis metrics** (if using for caching):
- Cache hit rate
- Cache miss rate
- Memory usage
- Eviction rate

### Alerts Configured

**Current**: None (⚠️ gap - needs setup)

**Recommended**:
- Health endpoint down (5min)
- Error rate > 1% (15min)
- Response time p95 > 1s (10min)
- Database connections > 80% (5min)
- Thompson Sampling failure rate > 10% (30min)

### Dashboards

**Activity Dashboard**: `https://internal.metabob.com` (when deployed)
- Real-time execution metrics
- Template performance trends
- Thompson Sampling parameters
- Impulse usage patterns

**Infrastructure Dashboards**: (⚠️ gap - needs setup)
- Grafana/Prometheus for system metrics
- SurrealDB query performance
- API endpoint latency

### How to Check System Health

**Quick health check**:
```bash
./scripts/health-check.sh
```

**Detailed system check**:
```bash
# Check all services
kubectl get pods -n activity-system

# Check API health
curl https://activity.metabob.com/health | jq

# Check database connectivity
curl https://surql.metabob.local/health

# Check recent execution traces
curl -H "Authorization: ApiKey $API_KEY" \
  "https://activity.metabob.com/v2/activities/execution-traces?limit=10" | jq
```

**Canary validation before promotion**:
```bash
# Run in repos/deployment
./scripts/health-check.sh canary

# Checks:
# - Canary health endpoint
# - Canary can serve templates
# - Canary can accept execution traces
# - No elevated error rates
```

---

## Testing Gaps and Recommendations

### Critical Gaps (Should Fix Soon)

1. **Impulse Lifecycle Tests**
   - **Gap**: No tests for lazy loading, budget enforcement, chaining
   - **Impact**: Core system behavior unverified
   - **Recommendation**: Add `repos/minibob/test/impulse-lifecycle.test.ts`
   - **Effort**: 2-3 hours

2. **Activity Execution Tests**
   - **Gap**: No tests for actual activity execution in MiniBob
   - **Impact**: Can't verify activities run correctly
   - **Recommendation**: Add `repos/minibob/test/activity-execution.test.ts`
   - **Effort**: 4-6 hours

3. **Thompson Sampling Integration**
   - **Gap**: Unit tests exist, but no integration test verifying α/β updates after execution
   - **Impact**: Can't verify learning loop actually works
   - **Recommendation**: Add `e2e/thompson-sampling-integration.spec.ts`
   - **Effort**: 2-3 hours

4. **Validation Layer Tests**
   - **Gap**: No tests for requiredFiles, patterns, commands validation
   - **Impact**: Validation rules might not work correctly
   - **Recommendation**: Add `repos/minibob/test/validation.test.ts`
   - **Effort**: 3-4 hours

5. **WebSocket Live Updates**
   - **Gap**: No tests for real-time dashboard updates
   - **Impact**: Can't verify activity dashboard works
   - **Recommendation**: Add `repos/activity-dashboard/test/websocket.test.ts`
   - **Effort**: 2-3 hours

### Medium Priority Gaps

6. **Ribosome Pattern**
   - **Gap**: No tests for template extraction from successful executions
   - **Impact**: Can't verify system learns new templates
   - **Recommendation**: Add when ribosome is implemented
   - **Effort**: 4-6 hours

7. **Boredom System**
   - **Gap**: No tests for autonomous task execution
   - **Impact**: Can't verify MiniBob works autonomously
   - **Recommendation**: Add `repos/minibob/test/boredom.test.ts`
   - **Effort**: 3-4 hours

8. **Multi-Vessel Coordination**
   - **Gap**: No tests for activities spanning multiple vessels
   - **Impact**: Can't verify vessel communication
   - **Recommendation**: Add `e2e/multi-vessel.spec.ts`
   - **Effort**: 6-8 hours

9. **Shape Inference**
   - **Gap**: No tests for automatic shape detection
   - **Impact**: Can't verify Loop 3 (Discovery) works
   - **Recommendation**: Add when shape inference implemented
   - **Effort**: 4-6 hours

10. **Error Recovery**
    - **Gap**: No tests for graceful degradation, retry logic
    - **Impact**: Don't know how system behaves under failure
    - **Recommendation**: Add chaos engineering tests
    - **Effort**: 8-10 hours

### Low Priority Gaps

11. **Performance Tests**
    - **Gap**: No load tests, stress tests
    - **Impact**: Don't know system limits
    - **Recommendation**: Add when needed for capacity planning

12. **Security Tests**
    - **Gap**: No penetration tests, vulnerability scans
    - **Impact**: Security posture unknown
    - **Recommendation**: Add security scanning to CI/CD

---

## How to Add New Tests

### Step 1: Determine Test Type

| If testing... | Use... | Location |
|---------------|--------|----------|
| Single function/module | Unit test | Same directory as code, `*.test.ts` |
| Multiple modules together | Integration test | `test/` directory |
| Complete user flow | E2E test | `e2e/` directory |
| UI behavior | Playwright test | `e2e/` or component `test/` |
| API endpoints | Integration test | `src/routes/*.test.ts` |

### Step 2: Create Test File

```typescript
// Example: repos/minibob/test/new-feature.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

describe('New Feature', () => {

  beforeAll(async () => {
    // Setup: create test data, start services
  })

  afterAll(async () => {
    // Cleanup: delete test data, stop services
  })

  test('should do X when Y happens', async () => {
    // Arrange
    const input = createTestInput()

    // Act
    const result = await featureUnderTest(input)

    // Assert
    expect(result).toBe(expected)
  })

  test('should handle error case Z', async () => {
    const invalidInput = createInvalidInput()

    await expect(async () => {
      await featureUnderTest(invalidInput)
    }).toThrow('Expected error message')
  })
})
```

### Step 3: Add Test to CI/CD

**For unit/integration tests** (automatic):
- Tests in `test/` or `*.test.ts` files run automatically with `bun test`
- CI runs `bun test` before deployment

**For E2E tests**:
- Add to `.github/workflows/test.yml`:
```yaml
- name: Run E2E Tests
  run: bun test e2e/new-test.spec.ts
  env:
    METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
    ACTIVITY_API_URL: https://activity.metabob.com
```

### Step 4: Document Test

Add to this inventory:
- **Test File Inventory** section (what the test does)
- **Test Coverage Matrix** (what it covers)
- **Verification Checklist** (how to manually verify)

### Step 5: Run Test Locally

```bash
# Unit test
cd repos/minibob
bun test test/new-feature.test.ts

# Integration test
cd repos/metabob-activity-api
bun test src/routes/new-endpoint.test.ts

# E2E test
bun test e2e/new-flow.spec.ts
```

### Best Practices

1. **Test behavior, not implementation**
   ```typescript
   // ❌ Bad - tests implementation
   expect(internalFunction()).toBe(value)

   // ✅ Good - tests behavior
   expect(publicAPI()).toBe(expectedOutcome)
   ```

2. **Use descriptive test names**
   ```typescript
   // ❌ Bad
   test('test 1', () => {})

   // ✅ Good
   test('should reject invalid API key with 401', () => {})
   ```

3. **Arrange-Act-Assert pattern**
   ```typescript
   test('should do X', async () => {
     // Arrange: setup test data
     const input = createTestData()

     // Act: perform operation
     const result = await operation(input)

     // Assert: verify outcome
     expect(result).toBe(expected)
   })
   ```

4. **Clean up after tests**
   ```typescript
   afterAll(async () => {
     await deleteTestData()
     await closeConnections()
   })
   ```

5. **Use environment variables for config**
   ```typescript
   const API_URL = process.env.ACTIVITY_API_URL || 'http://localhost:8080'
   const API_KEY = process.env.METABOB_API_KEY

   if (!API_KEY) {
     console.log('⚠️  Skipping: METABOB_API_KEY not set')
     return
   }
   ```

6. **Test edge cases**
   ```typescript
   describe('Edge Cases', () => {
     test('handles empty input', async () => {})
     test('handles null values', async () => {})
     test('handles very large input', async () => {})
     test('handles concurrent requests', async () => {})
   })
   ```

---

## Quick Reference

### Run All Tests

```bash
# MiniBob
cd repos/minibob && bun test

# Activity API
cd repos/metabob-activity-api && bun test

# E2E
bun test e2e/

# Smoke tests (fast)
./scripts/smoke-test.sh
```

### Check System Health

```bash
# Quick check
curl https://activity.metabob.com/health

# Detailed check
./scripts/health-check.sh

# Production validation
cd repos/deployment && ./scripts/health-check.sh production
```

### Manual Verification Workflows

**Loop 1 (Impulse Flow)**:
```bash
# 1. Create impulse
# 2. Execute activity using impulse
# 3. Verify impulse loaded
# 4. Check output impulse created
```

**Loop 2 (Validation/Feedback)**:
```bash
# 1. Get current Thompson parameters
# 2. Execute activity (success)
# 3. Verify α increased
# 4. Execute activity (failure)
# 5. Verify β increased
```

**Loop 3 (Discovery)**:
```bash
# Not yet implemented
# Will verify shape inference, impulse suggestions, state space queries
```

---

## Summary

**What works well**:
- ✅ Schema validation (templates, camelCase enforcement)
- ✅ Authentication (API key, JWT, multi-tenant isolation)
- ✅ Thompson Sampling (Beta distribution, exploration/exploitation)
- ✅ Basic health checks
- ✅ E2E goal flow tests

**What needs work**:
- ❌ Impulse lifecycle tests (lazy loading, budget, chaining)
- ❌ Activity execution tests
- ❌ Validation layer tests (requiredFiles, patterns, commands)
- ❌ WebSocket live updates
- ❌ Ribosome pattern tests
- ❌ Boredom system tests
- ❌ Loop 3 (Discovery) tests

**Priority actions**:
1. Add impulse lifecycle tests (2-3 hours)
2. Add activity execution tests (4-6 hours)
3. Add Thompson Sampling integration test (2-3 hours)
4. Add validation layer tests (3-4 hours)
5. Set up production monitoring/alerting

**For developers**:
- Before pushing: Run `bun test` in your repo
- Before deploying: Run `./scripts/smoke-test.sh`
- After deploying: Run `./scripts/health-check.sh canary`
- When adding features: Add tests following patterns in this doc
