# Validation Test Cases 3-7: End-to-End MCP Dataflow Integration

## Test Case 3: Thompson Sampling Metric Calculations

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-3  
**Priority:** MEDIUM

### Input
```json
{
  "prerequisites": "Valid session token, seeded templates with execution history",
  "endpoint": "GET /v2/activities/templates?limit=10"
}
```

### Expected Output
```json
{
  "templates": [
    {
      "success_rate": "<number in [0, 1]>",
      "expected_value": "<number>",
      "alpha": "<number ≥ 1>",
      "beta": "<number ≥ 1>"
    }
  ]
}
```

### Validation Rules
1. All templates must have Thompson Sampling metrics
2. success_rate ∈ [0, 1]
3. alpha ≥ 1 (successes + 1)
4. beta ≥ 1 (failures + 1)
5. expected_value = sampled_beta * quality_score

---

## Test Case 4: Cache-Aside Pattern Implementation

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-4  
**Priority:** HIGH

### Input
```json
{
  "prerequisites": "Valid session token, cleared Redis cache",
  "test_sequence": [
    "Clear cache key: templates:{org_id}:{project_id}",
    "Request 1: GET /v2/activities/templates (cache miss)",
    "Request 2: GET /v2/activities/templates (cache hit)"
  ]
}
```

### Expected Output
```json
{
  "request1": {
    "statusCode": 200,
    "cachePopulated": true,
    "cacheTtl": 300
  },
  "request2": {
    "statusCode": 200,
    "dataMatchesRequest1": true,
    "fasterThanRequest1": true
  }
}
```

### Validation Rules
1. First request populates Redis cache
2. Cache key: `templates:{org_id}:{project_id}`
3. Cache TTL must be ~300 seconds (±10s variance)
4. Second request returns identical data
5. Cache hit response should be faster (not always guaranteed in dev)

---

## Test Case 5: Multi-Tenant Scope Filtering

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-5  
**Priority:** HIGH

### Input
```json
{
  "sessions": [
    {"org_id": "org-1", "project_id": "project-1"},
    {"org_id": "org-2", "project_id": "project-2"}
  ],
  "endpoint": "GET /v2/activities/templates?limit=100"
}
```

### Expected Output
```json
{
  "org1_templates": "<array>",
  "org2_templates": "<array>",
  "globalTemplates": "<visible to both>",
  "scopeValues": ["global", "org", "project"]
}
```

### Validation Rules
1. Both orgs see global templates (scope='global' or null)
2. Org-scoped templates only visible to that org
3. Project-scoped templates only visible to that project
4. Scope values must be in: ['global', 'org', 'project', null]
5. No data leakage between orgs/projects

---

## Test Case 6: Architectural Boundary Validation

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-6  
**Priority:** HIGH

### Input
```json
{
  "test_sequence": [
    "GET /v2/activities/templates (no auth)",
    "GET /v2/activities/templates (invalid token)",
    "GET /v2/activities/templates (valid token)"
  ]
}
```

### Expected Output
```json
{
  "unauthenticated": {"statusCode": "401 or 403", "rejected": true},
  "invalidToken": {"statusCode": "401 or 403", "rejected": true},
  "validToken": {"statusCode": 200, "accepted": true}
}
```

### Validation Rules
1. Unauthenticated requests must be rejected (401/403)
2. Invalid tokens must be rejected (401/403)
3. Valid tokens must be accepted (200)
4. v2 API enforces Bearer token authentication
5. No direct database access from opencode layer

---

## Test Case 7: Complete Round-Trip (End-to-End)

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-7  
**Priority:** CRITICAL

### Input
```json
{
  "full_cycle": [
    "POST /v2/session",
    "Verify session in Redis",
    "GET /v2/activities/templates",
    "Verify cache population in Redis",
    "Validate response structure"
  ]
}
```

### Expected Output
```json
{
  "steps": [
    "POST /v2/session → 200",
    "Redis: session:info:{session_id} → found (TTL ~86400s)",
    "GET /v2/activities/templates → 200",
    "Redis: templates:{org_id}:{project_id} → found (TTL ~300s)",
    "Thompson Sampling fields validated"
  ],
  "totalTime": "<number in ms>",
  "success": true
}
```

### Validation Rules
1. Session creation succeeds (200)
2. Session stored in Redis with 24hr TTL
3. Template listing succeeds with Bearer token (200)
4. Templates cached in Redis with 5min TTL
5. All templates have required fields
6. All Thompson Sampling metrics are valid
7. Complete cycle completes in <5 seconds

---

**Summary:**
- Test Cases: 7 total
- Priority Breakdown: 3 HIGH, 1 CRITICAL, 1 MEDIUM
- Coverage: Session management, authentication, caching, multi-tenancy, Thompson Sampling, end-to-end flow

