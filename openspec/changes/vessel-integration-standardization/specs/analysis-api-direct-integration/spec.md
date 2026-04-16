# Analysis API Direct Integration Specification

**Capability:** analysis-api-direct-integration
**Purpose:** Enable MiniBob to directly integrate with Analysis-API for code analysis impulses, removing backend proxy pattern
**Status:** Proposed

---

## Design Principles

1. **Resolvers Live Where Data Lives** - Analysis-API resolves problem_detection impulses, not backend
2. **Metadata First, Content Later** - MiniBob sees problem metadata before loading detailed analysis
3. **Direct Communication** - MiniBob HTTP calls to Analysis-API eliminate unnecessary proxy hops
4. **Configuration Validation** - Fail fast when Analysis-API endpoint is misconfigured or unavailable
5. **Trace Everything** - All Analysis-API integration patterns recorded for learning

---

## ADDED Requirements

### Requirement: MiniBob direct HTTP calls to Analysis-API
MiniBob SHALL make direct HTTP requests to Analysis-API for impulse resolution, bypassing backend proxy pattern.

#### Scenario: MiniBob loads problem_detection impulse directly
- **WHEN** MiniBob needs to resolve impulse with pointer type `problem_detection`
- **THEN** MiniBob makes HTTP POST to `{analysisApiEndpoint}/v2/impulses/resolve`
- **AND** request includes the impulse pointer with file paths and analysis options

#### Scenario: MiniBob does not route through backend for analysis
- **WHEN** MiniBob encounters impulse with pointer type `problem_detection`
- **THEN** MiniBob does NOT send request to Activity-API `/v2/impulses/resolve`
- **AND** MiniBob directly calls Analysis-API resolver

#### Scenario: MiniBob includes authentication in Analysis-API calls
- **WHEN** MiniBob makes request to Analysis-API
- **THEN** request includes `Authorization: ApiKey <api-key>` header
- **AND** API key is from MiniBob configuration, not backend-provided token

### Requirement: Analysis-API implements /v2/impulses/resolve endpoint
Analysis-API SHALL implement the standard impulse resolution endpoint to act as its own resolver.

#### Scenario: Analysis-API resolves problem_detection impulse
- **WHEN** Analysis-API receives POST to `/v2/impulses/resolve`
- **WITH** payload containing pointer type `problem_detection` and file paths
- **THEN** Analysis-API performs code analysis on specified files
- **AND** returns loaded impulse with `content` populated with detected problems

#### Scenario: Analysis-API returns problem metadata in standard format
- **WHEN** Analysis-API resolves problem_detection impulse
- **THEN** response includes `content` field with array of problems
- **AND** each problem has `file`, `line`, `severity`, `category`, `message` fields
- **AND** response includes `loaded: true` and `loaded_at` timestamp

#### Scenario: Analysis-API validates pointer structure
- **WHEN** Analysis-API receives malformed impulse pointer
- **THEN** returns 400 Bad Request with validation error
- **AND** error message describes missing or invalid fields

#### Scenario: Analysis-API handles missing files gracefully
- **WHEN** Analysis-API receives problem_detection request for non-existent file
- **THEN** returns loaded impulse with empty problems array
- **AND** includes warning metadata about missing file

### Requirement: problem_detection impulse shape resolution
The system SHALL define and validate problem_detection impulse shape with clear pointer structure.

#### Scenario: problem_detection pointer includes file paths
- **WHEN** creating problem_detection impulse
- **THEN** pointer includes `filePaths` array with absolute paths
- **AND** each path is string representing file to analyze

#### Scenario: problem_detection pointer includes analysis options
- **WHEN** creating problem_detection impulse
- **THEN** pointer MAY include `options` object with analysis configuration
- **AND** options include `severity_threshold`, `categories`, `max_problems`

#### Scenario: problem_detection shape registered in shape registry
- **WHEN** shape registry is queried for `problem_detection`
- **THEN** returns shape definition with pointer fields and resolution endpoint
- **AND** definition indicates Analysis-API as authoritative resolver

#### Scenario: problem_detection content has predictable structure
- **WHEN** problem_detection impulse is loaded
- **THEN** `content` field contains array of problems
- **AND** each problem conforms to `CodeProblem` schema
- **AND** schema includes file, line, column, severity, category, message fields

### Requirement: Remove backend proxy pattern for Analysis-API
Backend SHALL NOT proxy or mediate Analysis-API impulse resolution requests.

#### Scenario: Backend rejects problem_detection resolution requests
- **WHEN** backend receives `/v2/impulses/resolve` request with pointer type `problem_detection`
- **THEN** returns 400 Bad Request with error message
- **AND** error indicates "problem_detection impulses must be resolved directly via Analysis-API"

#### Scenario: Backend does not store Analysis-API credentials
- **WHEN** backend configuration is inspected
- **THEN** no Analysis-API endpoint or authentication credentials are present
- **AND** documentation indicates vessels must configure Analysis-API directly

#### Scenario: Execution traces record Analysis-API calls
- **WHEN** MiniBob resolves problem_detection impulse via Analysis-API
- **THEN** execution trace includes `resolver_type: "vessel"`
- **AND** trace includes `resolver_endpoint: "{analysisApiEndpoint}/v2/impulses/resolve"`
- **AND** trace records resolution duration and success status

### Requirement: Configuration for Analysis-API endpoint
MiniBob SHALL support configuration of Analysis-API endpoint with validation.

#### Scenario: MiniBob reads Analysis-API endpoint from config
- **WHEN** MiniBob initializes
- **THEN** reads `analysisApi.endpoint` from configuration
- **AND** defaults to `https://analysis.metabob.com` if not specified

#### Scenario: MiniBob validates Analysis-API endpoint on startup
- **WHEN** MiniBob starts with Analysis-API endpoint configured
- **THEN** makes health check request to `{endpoint}/health`
- **AND** logs warning if endpoint is unreachable
- **AND** continues startup but marks Analysis-API resolver as unavailable

#### Scenario: MiniBob configuration includes Analysis-API API key
- **WHEN** MiniBob configuration is loaded
- **THEN** reads `analysisApi.apiKey` from config or environment variable
- **AND** uses this key for all Analysis-API authorization headers

#### Scenario: MiniBob fails resolution when Analysis-API unavailable
- **WHEN** MiniBob attempts to resolve problem_detection impulse
- **AND** Analysis-API endpoint is unreachable or returns 503
- **THEN** MiniBob marks impulse as `resolution_failed`
- **AND** includes error metadata with endpoint and HTTP status
- **AND** execution trace records resolution failure

#### Scenario: MiniBob retries Analysis-API calls with exponential backoff
- **WHEN** MiniBob makes Analysis-API request and receives 503 or network error
- **THEN** retries up to 3 times with exponential backoff (1s, 2s, 4s)
- **AND** logs each retry attempt with timestamp
- **AND** marks impulse as failed after final retry

#### Scenario: MiniBob configuration validation detects missing Analysis-API config
- **WHEN** MiniBob validates configuration
- **AND** no `analysisApi.endpoint` or `analysisApi.apiKey` is present
- **THEN** logs warning about missing Analysis-API configuration
- **AND** indicates problem_detection impulses will fail to resolve

---

## API Contract: Analysis-API /v2/impulses/resolve

### Endpoint
```
POST /v2/impulses/resolve
```

### Authentication
```
Authorization: ApiKey <api-key>
```

### Request Body
```json
{
  "impulses": [
    {
      "id": "impulse-uuid",
      "pointer": {
        "type": "problem_detection",
        "filePaths": [
          "/workspace/src/index.ts",
          "/workspace/src/lib/auth.ts"
        ],
        "options": {
          "severity_threshold": "medium",
          "categories": ["security", "performance"],
          "max_problems": 100
        }
      },
      "budget": 5000,
      "priority": "high"
    }
  ]
}
```

### Response Body (200 OK)
```json
{
  "resolved": [
    {
      "id": "impulse-uuid",
      "pointer": {
        "type": "problem_detection",
        "filePaths": ["/workspace/src/index.ts", "/workspace/src/lib/auth.ts"],
        "options": {
          "severity_threshold": "medium",
          "categories": ["security", "performance"],
          "max_problems": 100
        }
      },
      "loaded": true,
      "loaded_at": "2026-04-10T12:34:56Z",
      "content": [
        {
          "file": "/workspace/src/index.ts",
          "line": 45,
          "column": 12,
          "severity": "high",
          "category": "security",
          "message": "Potential SQL injection vulnerability",
          "context": "const query = `SELECT * FROM users WHERE id = ${userId}`",
          "recommendation": "Use parameterized queries to prevent SQL injection"
        },
        {
          "file": "/workspace/src/lib/auth.ts",
          "line": 23,
          "column": 8,
          "severity": "medium",
          "category": "performance",
          "message": "Synchronous file read in async function",
          "context": "const config = fs.readFileSync('config.json')",
          "recommendation": "Use fs.promises.readFile for async I/O"
        }
      ],
      "metadata": {
        "analysis_duration_ms": 342,
        "files_analyzed": 2,
        "problems_found": 2,
        "problems_filtered": 5,
        "cpg_nodes": 1247
      },
      "budget": 5000,
      "tokens_used": 1823,
      "priority": "high"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Invalid pointer
```json
{
  "loaded": false,
  "error": {
    "code": "INVALID_POINTER",
    "message": "pointer.filePaths must be array of strings",
    "details": {
      "pointer_type": "problem_detection",
      "validation_errors": ["filePaths is required", "filePaths must be array"]
    }
  }
}
```

#### 404 Not Found - Unsupported pointer type
```json
{
  "loaded": false,
  "error": {
    "code": "UNSUPPORTED_TYPE",
    "message": "Analysis-API does not resolve pointer type: activity_template",
    "details": {
      "requested_type": "activity_template",
      "supported_types": ["problem_detection"]
    }
  }
}
```

#### 503 Service Unavailable - Analysis unavailable
```json
{
  "loaded": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Code analysis service temporarily unavailable",
    "details": {
      "reason": "CPG builder initialization failed"
    },
    "retry_after_ms": 30000
  }
}
```

---

## Configuration Schema

### MiniBob Configuration (~/.metabob/config.json)

```json
{
  "metabob": {
    "apiKey": "your-metabob-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "analysisApi": {
    "apiKey": "your-analysis-api-key",
    "endpoint": "https://analysis.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

### Environment Variables (alternative to config file)

```bash
METABOB_API_KEY=your-metabob-api-key
METABOB_ENDPOINT=https://activity.metabob.com
ANALYSIS_API_KEY=your-analysis-api-key
ANALYSIS_API_ENDPOINT=https://analysis.metabob.com
```

---

## Migration Path

### Phase 1: Add Analysis-API resolver to MiniBob
- Implement Analysis-API HTTP client in MiniBob
- Add configuration validation for `analysisApi` section
- Implement health check on startup
- Add retry logic with exponential backoff

### Phase 2: Implement /v2/impulses/resolve in Analysis-API
- Create impulse resolution endpoint
- Implement problem_detection pointer validation
- Integrate with existing CPG analysis engine
- Add response formatting to match impulse resolution contract

### Phase 3: Remove backend proxy pattern
- Update backend to reject problem_detection resolution
- Remove Analysis-API credentials from backend config
- Update documentation to indicate direct integration pattern
- Add execution trace fields for vessel-resolved impulses

### Phase 4: Register problem_detection shape
- Add problem_detection shape to shape registry
- Document pointer structure and content schema
- Add shape validation in MiniBob
- Update shape registry UI to show Analysis-API as resolver

---

## Testing Strategy

### Unit Tests
- MiniBob Analysis-API client request formatting
- Configuration validation logic
- Retry logic with exponential backoff
- Impulse loading and content population

### Integration Tests
- End-to-end problem_detection resolution
- Analysis-API health check on startup
- Error handling for misconfigured endpoint
- Execution trace recording for vessel resolution

### Performance Tests
- Analysis-API response time for typical workspaces
- Token budget enforcement for large problem sets
- Concurrent impulse resolution requests

---

## Success Metrics

- **Zero backend proxy calls** for problem_detection impulses
- **100% of problem_detection impulses** resolved directly via Analysis-API
- **Execution traces** record `resolver_type: "vessel"` for all Analysis-API resolutions
- **Configuration validation** catches missing Analysis-API config before runtime failures
- **Health checks** detect Analysis-API availability issues within 5 seconds of startup

---

## Related Capabilities

- `vessel-authentication`: Standardized API key auth for Analysis-API calls
- `shape-registry`: Central registry includes problem_detection shape definition
- `execution-tracing-integration`: Traces record vessel-to-vessel resolution performance
- `impulse-resolution`: Modified to support direct vessel-to-vessel resolution paths
