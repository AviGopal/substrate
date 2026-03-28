# HTTP API v2 Analysis Contract

**Contract ID:** `http-api-v2-analysis`
**Version:** 1.0.0
**Provider:** metabob-analysis-api
**Owner:** Contract Agent (Analysis API)
**Status:** Draft

---

## Purpose

Defines the HTTP API contract for code analysis operations, exposed by `metabob-analysis-api` and consumed by `metabob-mcp` and `metabob-cloud-dashboard`.

## Execution Modes Supported

This API serves multiple execution modes with different interaction patterns:

**Template-Driven Mode:**
- Activities call these endpoints as part of predefined task sequences
- Example: "Fix bug" activity calls `/v2/analysis/priority` → `/v2/analysis/impact` → `/v2/analysis/problems/:id/complete`
- Execution path is known, endpoints called in predictable order
- Validation criteria ensure activities complete correctly

**Goal-Seeking Mode:**
- Recommendation engine uses `/v2/analysis/specs/generate` to plan implementation
- LLM calls endpoints adaptively based on goal requirements
- Example: "Add feature X" → system queries priority issues, searches codebase, generates spec
- Thompson Sampling selects which analysis strategies to use

**Pure Improvisation Mode:**
- LLM has access to ALL endpoints, calls step-by-step
- No predefined sequence, figures out which tools to use
- Example: Developer asks "What should I work on?" → LLM calls priority, search, impact in whatever order makes sense
- Successful sequences can be extracted as templates (ribosome pattern)

**Search-First Hybrid:**
- LLM searches for similar past analysis results before generating new ones
- Falls back to full analysis if no relevant cached data
- Example: `/v2/analysis/search` before `/v2/analysis/impact`
- Reuses learning from past transformations

**Key Insight:** Same endpoints, different calling patterns. Template-driven is fastest (known path), goal-seeking is adaptive, improvisation is creative.

## Learning Integration

Execution data from these endpoints feeds the continuous learning loop:

**Thompson Sampling:**
- Success/failure of analysis calls tracked per template
- Endpoint latency and result quality measured
- High-performing analysis sequences get selected more often
- Example: If CPG-based impact analysis outperforms heuristics, it gets prioritized

**Ribosome Pattern:**
- Successful improvisation sequences extracted as templates
- Example: LLM discovers effective workflow → becomes reusable template
- Traces from `/v2/analysis/*` endpoints become task prompts
- Manual exploration → automated workflow

**Pattern Recognition:**
- `/v2/analysis/search` embeddings improve over time
- Co-change predictions learn from actual commit patterns
- Impact analysis accuracy improves from validation feedback
- Example: System learns which components typically change together

**Impulse Creation:**
- Analysis results become impulses for future executions
- Example: Problem details lazy-loaded when needed
- Successful analyses cached and reused
- Learning accumulates in impulse relevance tracking

**Key Insight:** Every API call generates data that improves future calls. The becoming never stops learning.

## Base URL

```
http://metabob-analysis-api.activity-system.svc.cluster.local:8080
```

**External (via Istio):**
```
http://analysis.minibob.local
```

---

## Authentication

All endpoints require session validation via middleware.

**Header:**
```
X-Session-ID: <session_id>
```

**Error Response (401):**
```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Session token is invalid or expired"
  }
}
```

---

## Endpoints

### GET /v2/analysis/priority

Get ranked list of priority issues.

**Query Parameters:**
- `limit` (number, optional): Max issues to return (default: 5)
- `severity` (string[], optional): Filter by severity (HIGH, MEDIUM, LOW)
- `category` (string[], optional): Filter by category (bug, security, performance, maintainability)
- `scope` (string, optional): Search scope (session, project, org)

**Response (200):**
```json
{
  "issues": [
    {
      "problem_id": "string",
      "file_path": "string",
      "component_id": "string | null",
      "category": "string",
      "severity": "string",
      "summary": "string",
      "impact_score": "number",
      "affected_components": "number",
      "priority_rank": "number"
    }
  ],
  "total_issues": "number"
}
```

**Performance Target:** P50 <100ms, P99 <300ms

---

### POST /v2/analysis/search

Semantic search across problems and annotations.

**Request Body:**
```json
{
  "query": "string",
  "similarity_threshold": "number (optional, default: 0.7)",
  "limit": "number (optional, default: 10)",
  "scope": "string (optional)",
  "filters": {
    "severity": "string[] (optional)",
    "category": "string[] (optional)",
    "file_pattern": "string (optional)"
  }
}
```

**Response (200):**
```json
{
  "issues": [
    {
      "problem_id": "string",
      "file_path": "string",
      "category": "string",
      "severity": "string",
      "summary": "string",
      "description": "string",
      "similarity_score": "number",
      "annotations": [
        {
          "component_id": "string",
          "content": "string",
          "created_at": "string"
        }
      ]
    }
  ],
  "query_embedding": "number[]"
}
```

**Performance Target:** P50 <200ms, P99 <500ms

---

### POST /v2/analysis/annotations

Create annotation on code component.

**Request Body:**
```json
{
  "component_id": "string",
  "annotation": "string",
  "annotation_type": "string",
  "related_problem_id": "string (optional)",
  "tags": "string[] (optional)"
}
```

**Annotation Types:**
- `design_decision`
- `resolved_challenge`
- `implementation_note`
- `warning`

**Response (200):**
```json
{
  "annotation_id": "string",
  "component_id": "string",
  "content": "string",
  "annotation_type": "string",
  "created_at": "string",
  "created_by": "string",
  "related_problem_id": "string | null",
  "tags": "string[]"
}
```

**Performance Target:** P50 <50ms, P99 <150ms

---

### POST /v2/analysis/cochange/suggest

Predict files likely to change together.

**Request Body:**
```json
{
  "changed_files": "string[]",
  "diff": "string (optional)",
  "max_suggestions": "number (optional, default: 10)",
  "confidence_threshold": "number (optional, default: 0.6)"
}
```

**Response (200):**
```json
{
  "suggestions": [
    {
      "file_path": "string",
      "confidence": "number",
      "reason": "string",
      "cochange_frequency": "number",
      "embedding_similarity": "number",
      "affected_components": "string[]"
    }
  ],
  "model_version": "string"
}
```

**Performance Target:** P50 <300ms, P99 <800ms

---

### POST /v2/analysis/impact

Analyze change impact via CPG traversal.

**Request Body:**
```json
{
  "changed_files": "string[]",
  "diff": "string (optional)",
  "max_depth": "number (optional, default: 3)",
  "analysis_type": "string (optional: forward | backward | both)"
}
```

**Response (200):**
```json
{
  "impact_analysis": {
    "direct_dependencies": [
      {
        "file_path": "string",
        "component_id": "string",
        "relationship": "string",
        "risk_level": "string"
      }
    ],
    "indirect_dependencies": [
      {
        "file_path": "string",
        "component_id": "string",
        "path_from_change": "string[]",
        "depth": "number",
        "risk_level": "string"
      }
    ],
    "affected_tests": [
      {
        "file_path": "string",
        "test_name": "string",
        "coverage_type": "string"
      }
    ]
  },
  "total_affected_components": "number",
  "review_required": "string[]"
}
```

**Performance Target:** P50 <400ms, P99 <1s

---

### PUT /v2/analysis/problems/:id/complete

Mark problem as resolved.

**Path Parameters:**
- `id`: problem_id

**Request Body:**
```json
{
  "resolution_summary": "string",
  "fixed_in_commit": "string (optional)",
  "created_annotation": "boolean (optional, default: true)"
}
```

**Response (200):**
```json
{
  "problem_id": "string",
  "status": "resolved",
  "resolved_at": "string",
  "resolution_summary": "string",
  "annotation_created": {
    "annotation_id": "string",
    "component_id": "string",
    "content": "string"
  } | null
}
```

**Performance Target:** P50 <100ms, P99 <250ms

---

### POST /v2/analysis/specs/generate

Generate implementation specification from goal.

**Request Body:**
```json
{
  "goal": "string",
  "entry_points": "string[] (optional)",
  "max_depth": "number (optional, default: 5)",
  "include_patterns": "boolean (optional, default: true)"
}
```

**Response (200):**
```json
{
  "specification": {
    "goal": "string",
    "components_to_modify": [
      {
        "component_id": "string",
        "file_path": "string",
        "reason": "string",
        "annotations": "string[]",
        "data_flow": "string[]"
      }
    ],
    "components_to_create": [
      {
        "suggested_name": "string",
        "file_path": "string",
        "reason": "string",
        "similar_components": "string[]"
      }
    ],
    "design_patterns": [
      {
        "pattern_name": "string",
        "usage_examples": "string[]",
        "recommendation": "string"
      }
    ],
    "data_flow_diagram": "string",
    "implementation_order": "string[]"
  },
  "confidence": "number"
}
```

**Performance Target:** P50 <1s, P99 <3s

---

## Error Responses

All endpoints may return:

**400 Bad Request:**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "string",
    "details": {}
  }
}
```

**404 Not Found:**
```json
{
  "error": {
    "code": "COMPONENT_NOT_FOUND",
    "message": "string",
    "details": {
      "component_id": "string"
    }
  }
}
```

**429 Too Many Requests:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "string",
    "details": {
      "retry_after": "number"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "string"
  }
}
```

---

## Versioning

**Current Version:** 1.0.0

**Version Header:**
```
X-API-Version: 1.0.0
```

**Breaking Changes:**
- Endpoint removal
- Required field addition
- Field type change
- Response structure change

**Non-Breaking Changes:**
- New optional fields
- New endpoints
- Additional query parameters

---

## Consumers

This contract is consumed by:

- **metabob-mcp** (repos/metabob-mcp/openspec/manifest.yaml)
  - Wraps HTTP API in MCP tools

- **metabob-cloud-dashboard** (repos/metabob-cloud-dashboard/openspec/manifest.yaml)
  - Displays analysis data in UI

**Change Notification Required:** YES

---

## Testing

**Contract Validation:**
```bash
# Run API integration tests
cd repos/metabob-analysis-api
bun test tests/integration/api-contract.test.ts

# Expected: All endpoints conform to contract
```

**Performance Validation:**
```bash
# Run load tests
k6 run tests/performance/api-endpoints.js

# Expected: All P50/P99 targets met
```

---

## Migration Guide

### To Version 1.1.0 (Future)

When new endpoints are added or optional fields introduced:

1. Update this contract document
2. Bump version to 1.1.0
3. Notify metabob-mcp owner
4. Notify metabob-cloud-dashboard owner
5. Create integration tasks in dependent repos
6. Update E2E tests

---

## Contact

**Contract Owner:** Analysis API Contract Agent
**Provider Repo:** repos/metabob-analysis-api
**Updates:** openspec/contracts/http-api-v2-analysis.md
