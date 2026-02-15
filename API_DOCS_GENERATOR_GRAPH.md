# API Documentation Generator - Task Graph

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Documentation Generator                   │
│                         (4 Task Pipeline)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Task 1: discover-and-analyze                                   │
│  ─────────────────────────────────────────────────────          │
│  • Find all API routes (Express, Fastify, Next.js, etc.)       │
│  • Extract endpoints, methods, handlers                          │
│  • Analyze auth patterns (JWT, API keys, OAuth)                 │
│  • Detect validation approach (Zod, Joi, etc.)                  │
│  • Use Metabob for code structure analysis                      │
│                                                                  │
│  Outputs: API_DISCOVERY_REPORT.md                               │
│  Tokens: 16,000                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Task 2: generate-openapi-spec                                  │
│  ──────────────────────────────────────────────────────         │
│  • Read discovery report                                         │
│  • Generate OpenAPI 3.0 spec (YAML/JSON)                        │
│  • Define schemas for all resources                             │
│  • Configure authentication schemes                             │
│  • Add examples for requests/responses                          │
│  • Validate spec format                                         │
│                                                                  │
│  Outputs: openapi.yaml, OPENAPI_VALIDATION.md                   │
│  Tokens: 16,000                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Task 3: generate-endpoint-docs                                 │
│  ───────────────────────────────────────────────────────        │
│  • Read OpenAPI spec                                             │
│  • Create comprehensive API reference                           │
│  • Add curl examples for all endpoints                          │
│  • Generate code examples (JavaScript, Python)                  │
│  • Document authentication flow                                 │
│  • Create quick start guide                                     │
│                                                                  │
│  Outputs: API_DOCUMENTATION.md, API_QUICK_START.md              │
│  Tokens: 16,000                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Task 4: validate-and-test                                      │
│  ──────────────────────────────────────────────────────         │
│  • Validate OpenAPI spec format                                 │
│  • Cross-check endpoints in spec vs docs                        │
│  • Verify documentation completeness                            │
│  • Test curl examples (if API running)                          │
│  • Generate validation report (must show PASS)                  │
│                                                                  │
│  Outputs: API_DOCS_VALIDATION_REPORT.md                         │
│  Tokens: 14,000                                                  │
└─────────────────────────────────────────────────────────────────┘

                         │
                         ▼
                    
┌─────────────────────────────────────────────────────────────────┐
│                    ✅ Complete Documentation Suite               │
│                                                                  │
│  1. API_DISCOVERY_REPORT.md - Endpoint inventory                │
│  2. openapi.yaml - OpenAPI 3.0 specification                    │
│  3. OPENAPI_VALIDATION.md - Spec validation                     │
│  4. API_DOCUMENTATION.md - Complete API reference               │
│  5. API_QUICK_START.md - Getting started guide                  │
│  6. API_DOCS_VALIDATION_REPORT.md - Final validation (PASS)     │
└─────────────────────────────────────────────────────────────────┘
```

## Task Dependencies

```
discover-and-analyze
    │
    │ reads: codebase files
    │ uses: glob, read, metabob_*
    │ outputs: API_DISCOVERY_REPORT.md
    │
    └──▶ generate-openapi-spec
            │
            │ reads: API_DISCOVERY_REPORT.md
            │ uses: schema generation
            │ outputs: openapi.yaml, OPENAPI_VALIDATION.md
            │
            └──▶ generate-endpoint-docs
                    │
                    │ reads: openapi.yaml
                    │ uses: documentation generation
                    │ outputs: API_DOCUMENTATION.md, API_QUICK_START.md
                    │
                    └──▶ validate-and-test
                            │
                            │ reads: all generated docs
                            │ uses: validation tools
                            │ outputs: API_DOCS_VALIDATION_REPORT.md
                            │
                            └──▶ ✅ COMPLETE
```

## Data Flow

```
Codebase Files
    │
    ├─ routes/**/*.{ts,js}
    ├─ api/**/*.{ts,js}
    ├─ controllers/**/*.{ts,js}
    │
    ▼
[discover-and-analyze]
    │
    ▼
API_DISCOVERY_REPORT.md
    {
      framework: "Express",
      endpoints: 42,
      auth: "JWT Bearer",
      validation: "Zod"
    }
    │
    ▼
[generate-openapi-spec]
    │
    ▼
openapi.yaml + OPENAPI_VALIDATION.md
    {
      paths: { /api/users: {...}, /api/auth: {...} },
      components: { schemas: {...}, securitySchemes: {...} }
    }
    │
    ▼
[generate-endpoint-docs]
    │
    ▼
API_DOCUMENTATION.md + API_QUICK_START.md
    {
      Each endpoint documented with:
        - curl examples
        - JS/Python code
        - request/response formats
        - error scenarios
    }
    │
    ▼
[validate-and-test]
    │
    ▼
API_DOCS_VALIDATION_REPORT.md
    {
      status: "PASS",
      coverage: "100%",
      endpoints_documented: 42,
      validation_passed: true
    }
```

## Validation Chain

Each task validates its output before passing to the next:

```
Task 1 ─┬─ requiredFiles: ["API_DISCOVERY_REPORT.md"]
        ├─ requiredPatterns: ["## API Discovery Report", "### Endpoints Found", ...]
        ├─ forbiddenPatterns: ["TODO", "TBD", "[count]", ...]
        └─ retry: 2 attempts with progressive-context
              │
              ▼
Task 2 ─┬─ requiredFiles: ["openapi.yaml" OR "openapi.json", "OPENAPI_VALIDATION.md"]
        ├─ requiredPatterns: ["openapi: 3.0", "paths:", "[PASS]", ...]
        ├─ forbiddenPatterns: ["TODO", "[API Name]", ...]
        ├─ commands: ["swagger-cli validate openapi.yaml"]
        └─ retry: 3 attempts with progressive-context
              │
              ▼
Task 3 ─┬─ requiredFiles: ["API_DOCUMENTATION.md", "API_QUICK_START.md"]
        ├─ requiredPatterns: ["# API Documentation", "curl -X", "```bash", ...]
        ├─ forbiddenPatterns: ["TODO", "[resource]", "YOUR_TOKEN", ...]
        └─ retry: 3 attempts with progressive-context
              │
              ▼
Task 4 ─┬─ requiredFiles: ["API_DOCS_VALIDATION_REPORT.md"]
        ├─ requiredPatterns: ["# API Documentation Validation Report", "[PASS]", ...]
        ├─ forbiddenPatterns: ["TODO", "[count]", "[FAIL]", ...]
        └─ retry: 3 attempts with progressive-context
              │
              ▼
         ✅ COMPLETE
```

## Token Budget Allocation

```
Total Budget: 62,000 tokens

┌──────────────────────────┬────────┬─────────┐
│ Task                     │ Tokens │ Percent │
├──────────────────────────┼────────┼─────────┤
│ discover-and-analyze     │ 16,000 │   26%   │
│ generate-openapi-spec    │ 16,000 │   26%   │
│ generate-endpoint-docs   │ 16,000 │   26%   │
│ validate-and-test        │ 14,000 │   22%   │
├──────────────────────────┼────────┼─────────┤
│ Total                    │ 62,000 │  100%   │
└──────────────────────────┴────────┴─────────┘

All tasks within recommended 8K-16K range ✓
```

## Framework Support

The template supports multiple frameworks:

```
┌────────────────┬─────────────────────────────────────┐
│ Framework      │ Detection Method                    │
├────────────────┼─────────────────────────────────────┤
│ Express        │ app.get(), router.post()            │
│ Fastify        │ fastify.route(), server.get()       │
│ Koa            │ router.get(), router.post()         │
│ Next.js        │ pages/api/, app/api/                │
│ NestJS         │ @Controller(), @Get(), @Post()      │
└────────────────┴─────────────────────────────────────┘
```

## Metabob Integration Points

```
Task 1: discover-and-analyze
    │
    ├─▶ metabob_search_codebase_issues("API endpoint documentation")
    │   └─ Find existing documentation issues
    │
    ├─▶ metabob_list_file_components("path/to/routes.ts")
    │   └─ Get component structure
    │
    └─▶ metabob_get_priority_issues()
        └─ Identify related quality issues
```

## Quality Gates

```
Integration Post-Checks:
├─ Files exist check
├─ Line count verification
└─ OpenAPI validation (optional)

Final Validation Requirements:
├─ All endpoints documented
├─ OpenAPI spec valid
├─ No placeholders remain
├─ Examples are complete
└─ Validation report shows [PASS]
```
