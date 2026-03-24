# MCP Tool Examples

Concrete request/response examples for each tool.

---

## 1. get_priority_issues

### Example 1: Get top 5 issues (default)

**Request:**
```json
{
  "limit": 5,
  "scope": "session"
}
```

**Response:**
```json
{
  "issues": [
    {
      "problem_id": "prob_a1b2c3",
      "file_path": "src/auth/login.ts",
      "category": "security",
      "severity": "HIGH",
      "summary": "Potential SQL injection in login query",
      "impact_score": 87,
      "affected_components": 12,
      "priority_rank": 1
    },
    {
      "problem_id": "prob_d4e5f6",
      "file_path": "src/api/users.ts",
      "category": "bug",
      "severity": "HIGH",
      "summary": "Null pointer dereference in user lookup",
      "impact_score": 73,
      "affected_components": 8,
      "priority_rank": 2
    },
    {
      "problem_id": "prob_g7h8i9",
      "file_path": "src/db/query.ts",
      "category": "performance",
      "severity": "MEDIUM",
      "summary": "N+1 query detected in user fetch",
      "impact_score": 45,
      "affected_components": 15,
      "priority_rank": 3
    }
  ],
  "total_issues": 23
}
```

### Example 2: Filter by category and severity

**Request:**
```json
{
  "limit": 10,
  "severity": ["HIGH"],
  "category": ["security", "bug"],
  "scope": "project"
}
```

**Response:**
```json
{
  "issues": [
    {
      "problem_id": "prob_a1b2c3",
      "file_path": "src/auth/login.ts",
      "category": "security",
      "severity": "HIGH",
      "summary": "Potential SQL injection in login query",
      "impact_score": 87,
      "affected_components": 12,
      "priority_rank": 1
    },
    {
      "problem_id": "prob_d4e5f6",
      "file_path": "src/api/users.ts",
      "category": "bug",
      "severity": "HIGH",
      "summary": "Null pointer dereference in user lookup",
      "impact_score": 73,
      "affected_components": 8,
      "priority_rank": 2
    }
  ],
  "total_issues": 7
}
```

---

## 2. search_codebase_issues

### Example 1: Semantic search for authentication issues

**Request:**
```json
{
  "query": "authentication token validation problems",
  "similarity_threshold": 0.7,
  "limit": 5,
  "scope": "project"
}
```

**Response:**
```json
{
  "issues": [
    {
      "problem_id": "prob_j1k2l3",
      "file_path": "src/auth/validate.ts",
      "category": "security",
      "severity": "HIGH",
      "summary": "JWT token not verified before use",
      "description": "The validateToken function accepts tokens without signature verification...",
      "similarity_score": 0.92,
      "annotations": [
        {
          "component_id": "src/auth/validate.ts::validateToken",
          "content": "**Design Decision:** We use HS256 for token signing. Make sure to verify signature before trusting claims.",
          "created_at": "2026-03-20T14:23:00Z"
        }
      ]
    },
    {
      "problem_id": "prob_m4n5o6",
      "file_path": "src/middleware/auth.ts",
      "category": "bug",
      "severity": "MEDIUM",
      "summary": "Missing token expiration check",
      "description": "Authentication middleware doesn't validate token expiration timestamp...",
      "similarity_score": 0.85,
      "annotations": []
    }
  ],
  "query_embedding": [0.12, -0.45, 0.78, ...]
}
```

### Example 2: Search with file pattern filter

**Request:**
```json
{
  "query": "database connection leak",
  "limit": 10,
  "scope": "org",
  "filters": {
    "file_pattern": "src/db/**/*.ts",
    "severity": ["HIGH", "MEDIUM"]
  }
}
```

---

## 3. annotate_component

### Example 1: Document a design decision

**Request:**
```json
{
  "component_id": "src/auth/session.ts::SessionManager",
  "annotation": "**Design Decision:** We use Redis for session storage instead of JWT cookies because:\n1. Immediate revocation capability\n2. Centralized session management\n3. Support for multi-device logout\n\n**Trade-offs:** Requires Redis dependency, adds network latency.",
  "annotation_type": "design_decision",
  "tags": ["architecture", "auth", "redis"]
}
```

**Response:**
```json
{
  "annotation_id": "anno_p7q8r9",
  "component_id": "src/auth/session.ts::SessionManager",
  "content": "**Design Decision:** We use Redis for session storage instead of JWT cookies because:\n1. Immediate revocation capability\n2. Centralized session management\n3. Support for multi-device logout\n\n**Trade-offs:** Requires Redis dependency, adds network latency.",
  "annotation_type": "design_decision",
  "created_at": "2026-03-23T16:45:00Z",
  "created_by": "session_abc123",
  "tags": ["architecture", "auth", "redis"]
}
```

### Example 2: Annotate a resolved challenge

**Request:**
```json
{
  "component_id": "src/api/upload.ts::handleFileUpload",
  "annotation": "**Resolved Challenge:** Fixed memory leak when uploading large files.\n\n**Problem:** Buffering entire file in memory before processing.\n\n**Solution:** Switched to streaming with backpressure handling. Files are processed in 64KB chunks.\n\n**Testing:** Verified with 500MB file upload - memory stays under 100MB.",
  "annotation_type": "resolved_challenge",
  "related_problem_id": "prob_s1t2u3",
  "tags": ["performance", "memory", "upload"]
}
```

**Response:**
```json
{
  "annotation_id": "anno_v4w5x6",
  "component_id": "src/api/upload.ts::handleFileUpload",
  "content": "**Resolved Challenge:** Fixed memory leak when uploading large files...",
  "annotation_type": "resolved_challenge",
  "created_at": "2026-03-23T16:50:00Z",
  "created_by": "session_abc123",
  "related_problem_id": "prob_s1t2u3",
  "tags": ["performance", "memory", "upload"]
}
```

---

## 4. suggest_related_changes

### Example 1: Suggest co-changes after modifying auth logic

**Request:**
```json
{
  "changed_files": ["src/auth/login.ts", "src/auth/validate.ts"],
  "max_suggestions": 5,
  "confidence_threshold": 0.6
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "file_path": "src/middleware/auth.ts",
      "confidence": 0.89,
      "reason": "Frequently changed together (12 times in last 50 commits). Contains authentication logic that depends on validate.ts",
      "cochange_frequency": 12,
      "embedding_similarity": 0.82,
      "affected_components": [
        "src/middleware/auth.ts::authenticateRequest",
        "src/middleware/auth.ts::verifyToken"
      ]
    },
    {
      "file_path": "tests/auth/login.test.ts",
      "confidence": 0.76,
      "reason": "Test file for login.ts. Always update tests when auth logic changes.",
      "cochange_frequency": 18,
      "embedding_similarity": 0.45,
      "affected_components": [
        "tests/auth/login.test.ts::testValidLogin"
      ]
    },
    {
      "file_path": "src/db/users.ts",
      "confidence": 0.68,
      "reason": "Similar code patterns detected. Both files handle user credential validation.",
      "cochange_frequency": 3,
      "embedding_similarity": 0.91,
      "affected_components": [
        "src/db/users.ts::findByCredentials"
      ]
    }
  ],
  "model_version": "cochange-v2.3-project-abc"
}
```

---

## 5. analyze_change_impact

### Example 1: Analyze impact of changing a core utility function

**Request:**
```json
{
  "changed_files": ["src/utils/validation.ts"],
  "max_depth": 3,
  "analysis_type": "both"
}
```

**Response:**
```json
{
  "impact_analysis": {
    "direct_dependencies": [
      {
        "file_path": "src/api/users.ts",
        "component_id": "src/api/users.ts::createUser",
        "relationship": "calls",
        "risk_level": "HIGH"
      },
      {
        "file_path": "src/api/posts.ts",
        "component_id": "src/api/posts.ts::createPost",
        "relationship": "calls",
        "risk_level": "HIGH"
      },
      {
        "file_path": "src/auth/register.ts",
        "component_id": "src/auth/register.ts::validateRegistration",
        "relationship": "calls",
        "risk_level": "MEDIUM"
      }
    ],
    "indirect_dependencies": [
      {
        "file_path": "src/routes/api.ts",
        "component_id": "src/routes/api.ts::userRoutes",
        "path_from_change": [
          "src/utils/validation.ts::validateEmail",
          "src/api/users.ts::createUser",
          "src/routes/api.ts::userRoutes"
        ],
        "depth": 2,
        "risk_level": "MEDIUM"
      },
      {
        "file_path": "tests/integration/user-flow.test.ts",
        "component_id": "tests/integration/user-flow.test.ts::testUserRegistration",
        "path_from_change": [
          "src/utils/validation.ts::validateEmail",
          "src/auth/register.ts::validateRegistration",
          "tests/integration/user-flow.test.ts::testUserRegistration"
        ],
        "depth": 2,
        "risk_level": "LOW"
      }
    ],
    "affected_tests": [
      {
        "file_path": "tests/utils/validation.test.ts",
        "test_name": "validateEmail",
        "coverage_type": "unit"
      },
      {
        "file_path": "tests/integration/user-flow.test.ts",
        "test_name": "testUserRegistration",
        "coverage_type": "integration"
      }
    ]
  },
  "total_affected_components": 8,
  "review_required": [
    "src/api/users.ts",
    "src/api/posts.ts",
    "src/auth/register.ts",
    "src/routes/api.ts"
  ]
}
```

---

## 6. mark_problem_complete

### Example 1: Resolve issue with auto-annotation

**Request:**
```json
{
  "problem_id": "prob_a1b2c3",
  "resolution_summary": "Added input sanitization using parameterized queries. All user inputs now properly escaped.",
  "fixed_in_commit": "abc123def456",
  "created_annotation": true
}
```

**Response:**
```json
{
  "problem_id": "prob_a1b2c3",
  "status": "resolved",
  "resolved_at": "2026-03-23T17:00:00Z",
  "resolution_summary": "Added input sanitization using parameterized queries. All user inputs now properly escaped.",
  "annotation_created": {
    "annotation_id": "anno_y7z8a9",
    "component_id": "src/auth/login.ts::executeLoginQuery",
    "content": "**Resolved Issue:** Potential SQL injection in login query\n**Fix:** Added input sanitization using parameterized queries. All user inputs now properly escaped.\n**Severity:** HIGH\n**Fixed in:** abc123def456"
  }
}
```

---

## 7. generate_implementation_spec

### Example 1: Generate spec for adding API rate limiting

**Request:**
```json
{
  "goal": "Add rate limiting to all API endpoints to prevent abuse",
  "entry_points": ["src/routes/api.ts::apiRouter"],
  "max_depth": 3,
  "include_patterns": true
}
```

**Response:**
```json
{
  "specification": {
    "goal": "Add rate limiting to all API endpoints to prevent abuse",
    "components_to_modify": [
      {
        "component_id": "src/middleware/index.ts::applyMiddleware",
        "file_path": "src/middleware/index.ts",
        "reason": "Central middleware registration point. Add rate limiter here.",
        "annotations": [
          "**Design Pattern:** Middleware are applied in order. Auth must come before rate limiting."
        ],
        "data_flow": ["Request → Middleware chain → Route handlers"]
      },
      {
        "component_id": "src/config/server.ts::ServerConfig",
        "file_path": "src/config/server.ts",
        "reason": "Configuration for rate limits (requests per minute, burst size)",
        "annotations": [],
        "data_flow": ["Config loaded at startup → Middleware uses config"]
      }
    ],
    "components_to_create": [
      {
        "suggested_name": "RateLimitMiddleware",
        "file_path": "src/middleware/rate-limit.ts",
        "reason": "New middleware to track and enforce rate limits",
        "similar_components": [
          "src/middleware/auth.ts::AuthMiddleware",
          "src/middleware/cors.ts::CorsMiddleware"
        ]
      },
      {
        "suggested_name": "RateLimitStore",
        "file_path": "src/services/rate-limit-store.ts",
        "reason": "Storage backend for rate limit counters (Redis recommended)",
        "similar_components": [
          "src/services/session-store.ts::SessionStore"
        ]
      }
    ],
    "design_patterns": [
      {
        "pattern_name": "Middleware Chain",
        "usage_examples": [
          "src/middleware/auth.ts",
          "src/middleware/cors.ts",
          "src/middleware/logging.ts"
        ],
        "recommendation": "Follow existing pattern: export function that returns Express middleware"
      },
      {
        "pattern_name": "Dependency Injection",
        "usage_examples": [
          "src/services/session-store.ts receives Redis client via constructor"
        ],
        "recommendation": "Inject RateLimitStore into middleware rather than creating inside"
      }
    ],
    "data_flow_diagram": "Request\n  ↓\nCorsMiddleware\n  ↓\nAuthMiddleware\n  ↓\nRateLimitMiddleware ← RateLimitStore (Redis)\n  ↓\nRoute Handler",
    "implementation_order": [
      "1. Create RateLimitStore interface",
      "2. Implement RedisRateLimitStore",
      "3. Add rate limit config to ServerConfig",
      "4. Create RateLimitMiddleware",
      "5. Register middleware in applyMiddleware",
      "6. Add tests for rate limiting",
      "7. Update API documentation"
    ]
  },
  "confidence": 0.82
}
```

---

## Error Examples

### Session Expired
```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Session token is invalid or expired. Please re-authenticate.",
    "details": {
      "session_id": "session_abc123",
      "expired_at": "2026-03-23T12:00:00Z"
    }
  }
}
```

### Component Not Found
```json
{
  "error": {
    "code": "COMPONENT_NOT_FOUND",
    "message": "Component ID 'src/invalid.ts::foo' not found in CPG",
    "details": {
      "component_id": "src/invalid.ts::foo",
      "available_components_count": 1234,
      "suggestion": "Run search_codebase_issues to find valid component IDs"
    }
  }
}
```

### Insufficient Data
```json
{
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "CPG not built for this session. Upload files first.",
    "details": {
      "session_id": "session_abc123",
      "files_uploaded": 0,
      "suggestion": "Use the MCP file upload tool or CLI to submit code files"
    }
  }
}
```
