# Endpoint Design: GET /api/test

## Purpose
Test endpoint to verify Handlebars conditionals work by returning sample data with query parameters.

## Codebase Analysis Summary

### Framework & Patterns Identified
- **Framework**: Hono (lightweight web framework)
- **Validation**: Zod schemas with `hono-openapi` integration
- **Error Handling**: Centralized error object with standardized HTTP status codes
- **Documentation**: OpenAPI specs via `describeRoute` and `resolver`
- **Architecture**: Namespace-based organization (e.g., `Server` namespace)

### Key Files Analyzed
1. `/repos/metabob-opencode/packages/opencode/src/server/server.ts` - Main Hono server with 80+ endpoints
2. `/repos/metabob-dashboard/src/mocks/api/handler.js` - MSW mock handlers (REST pattern reference)
3. `/repos/metabob-opencode/packages/console/app/src/routes/api/enterprise.ts` - SolidStart API route

## File Structure

### Route Definition
**File**: `/repos/metabob-opencode/packages/opencode/src/server/server.ts`
- Modify existing Hono app in the `Server` namespace
- Add endpoint after line ~2000 (near other test/debug endpoints)

### Handler Location
**Approach**: Inline handler (following codebase convention)
- Handlers are defined directly in route definitions
- No separate handler file needed

### Schema Location
**Approach**: Inline Zod schemas (following codebase convention)
- Define schemas directly in the route definition
- Use `z.object()` for request/response validation

### Tests
**File**: `/repos/metabob-opencode/packages/opencode/test/server/test-endpoint.test.ts` (new file)
- Follow existing test patterns using Vitest
- Test happy path, validation errors, and edge cases

## Request Flow

```
1. HTTP GET /api/test?limit=10
   ↓
2. Hono routing layer matches endpoint
   ↓
3. Global middleware chain
   - Logging middleware (already applied)
   - CORS middleware (already applied)
   - Instance.provide middleware (already applied)
   ↓
4. Query validation (validator with Zod schema)
   - If invalid → 400 Bad Request
   ↓
5. Handler execution
   - Generate test data array
   - Return JSON response
   ↓
6. Response (200 OK)
```

## Schemas

### Request Schema (Query Parameters)
```typescript
const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(10)
    .describe("Maximum number of items to return"),
  directory: z.string().optional() // Inherited from global middleware
})
```

### Response Schema
```typescript
const ResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      value: z.string(),
      timestamp: z.number()
    })
  ),
  total: z.number(),
  limit: z.number()
}).meta({ ref: "TestResponse" })
```

## HTTP Status Codes

| Code | Scenario | Response Body |
|------|----------|---------------|
| 200  | Success - data returned | `{ data: [...], total: N, limit: M }` |
| 400  | Bad Request - invalid query params | `{ data: null, errors: [...], success: false }` |
| 500  | Internal Server Error | `{ name: "Unknown", message: "..." }` |

**Note**: No authentication/authorization required for this test endpoint

## Error Handling

Following codebase patterns:

1. **Validation Errors** (400)
   - Handled automatically by Hono + Zod validator
   - Returns standardized error format from `ERRORS[400]`

2. **Runtime Errors** (500)
   - Caught by global error handler (`.onError`)
   - Wrapped in `NamedError.Unknown`
   - Logged via `Log.create({ service: "server" })`

3. **Error Response Format** (from existing `ERRORS` const)
```typescript
// 400 Bad Request
{
  data: null,
  errors: [{ field: "limit", message: "..." }],
  success: false
}

// 500 Internal Server Error
{
  name: "Unknown",
  message: "error stack trace or message"
}
```

## Implementation Details

### Location in server.ts
Insert after line ~1759 (after `/memory/check` endpoint, before TUI endpoints):

```typescript
.get(
  "/api/test",
  describeRoute({
    description: "Test endpoint to verify Handlebars conditionals",
    operationId: "api.test",
    responses: {
      200: {
        description: "Test data",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                data: z.array(
                  z.object({
                    id: z.string(),
                    value: z.string(),
                    timestamp: z.number()
                  })
                ),
                total: z.number(),
                limit: z.number()
              }).meta({ ref: "TestResponse" })
            ),
          },
        },
      },
      ...errors(400),
    },
  }),
  validator(
    "query",
    z.object({
      limit: z.coerce.number().min(1).max(100).optional().default(10)
        .describe("Maximum number of items to return")
    })
  ),
  async (c) => {
    const { limit } = c.req.valid("query")
    
    // Generate test data
    const data = Array.from({ length: limit }, (_, i) => ({
      id: `test-${i + 1}`,
      value: `Test Value ${i + 1}`,
      timestamp: Date.now() + i
    }))
    
    return c.json({
      data,
      total: data.length,
      limit
    })
  }
)
```

### Why This Location?
- After memory/debug endpoints (thematic grouping)
- Before TUI endpoints (different category)
- Follows existing endpoint ordering pattern

## Testing Strategy

### Test File Structure
```typescript
// test/server/test-endpoint.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Instance } from "../../src/project/instance"
import { InstanceBootstrap } from "../../src/project/bootstrap"

describe("GET /api/test", () => {
  let app: any
  
  beforeAll(async () => {
    // Setup test instance
    await Instance.provide({
      directory: process.cwd(),
      init: InstanceBootstrap,
      async fn() {
        const { App } = await import("../../src/server/server")
        app = App()
      }
    })
  })

  it("returns test data with default limit", async () => {
    const res = await app.request("/api/test")
    expect(res.status).toBe(200)
    
    const json = await res.json()
    expect(json).toMatchObject({
      data: expect.any(Array),
      total: 10,
      limit: 10
    })
    expect(json.data).toHaveLength(10)
  })

  it("returns test data with custom limit", async () => {
    const res = await app.request("/api/test?limit=5")
    expect(res.status).toBe(200)
    
    const json = await res.json()
    expect(json.total).toBe(5)
    expect(json.data).toHaveLength(5)
  })

  it("validates limit min constraint", async () => {
    const res = await app.request("/api/test?limit=0")
    expect(res.status).toBe(400)
    
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it("validates limit max constraint", async () => {
    const res = await app.request("/api/test?limit=101")
    expect(res.status).toBe(400)
  })

  it("each data item has correct schema", async () => {
    const res = await app.request("/api/test?limit=1")
    const json = await res.json()
    
    expect(json.data[0]).toMatchObject({
      id: expect.stringMatching(/^test-\d+$/),
      value: expect.stringContaining("Test Value"),
      timestamp: expect.any(Number)
    })
  })
})
```

### Test Coverage
- ✅ Happy path (default limit)
- ✅ Happy path (custom limit)
- ✅ Validation (min constraint)
- ✅ Validation (max constraint)
- ✅ Response schema conformance
- ✅ Array length matches limit

## Implementation Checklist

- [ ] Add route definition to `server.ts` (after line ~1759)
- [ ] Define request schema with `validator("query", ...)`
- [ ] Define response schema with `resolver(...)`
- [ ] Implement handler with test data generation
- [ ] Add error handling via `...errors(400)`
- [ ] Create test file `test/server/test-endpoint.test.ts`
- [ ] Write happy path tests (default + custom limit)
- [ ] Write validation error tests (min/max constraints)
- [ ] Write schema conformance test
- [ ] Run tests: `npm test test/server/test-endpoint.test.ts`
- [ ] Verify endpoint via HTTP client or browser
- [ ] Update this document if implementation deviates

## Dependencies

All required dependencies are already installed:
- `hono` - Web framework
- `hono-openapi` - OpenAPI integration
- `zod` - Schema validation
- `vitest` - Testing framework

No additional packages needed.

## Additional Notes

### Handlebars Conditionals Context
This endpoint is designed to test Handlebars conditional rendering. The response structure supports various conditional patterns:

```handlebars
{{#if data}}
  {{#each data}}
    <div>{{this.id}}: {{this.value}}</div>
  {{/each}}
{{else}}
  <div>No data available</div>
{{/if}}

{{#if (gt total 0)}}
  <p>Showing {{total}} items (limit: {{limit}})</p>
{{/if}}
```

### Future Enhancements (Not in Scope)
- Add filtering by timestamp range
- Add sorting options (asc/desc)
- Add pagination with offset/cursor
- Add response caching headers
- Add rate limiting

### Performance Considerations
- Current implementation generates data on-demand (no caching)
- Max limit of 100 prevents excessive memory usage
- Response time: O(n) where n = limit (negligible for n ≤ 100)

### Security Considerations
- No sensitive data exposed
- Input validation prevents injection attacks
- Max limit prevents DoS via large requests
- No authentication required (test endpoint only)
- **Production Warning**: Consider adding authentication or removing this endpoint in production

## OpenAPI Documentation

Once implemented, the endpoint will automatically appear in the OpenAPI docs at `/doc`:

```yaml
/api/test:
  get:
    operationId: api.test
    description: Test endpoint to verify Handlebars conditionals
    parameters:
      - name: limit
        in: query
        description: Maximum number of items to return
        required: false
        schema:
          type: number
          minimum: 1
          maximum: 100
          default: 10
    responses:
      '200':
        description: Test data
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TestResponse'
      '400':
        description: Bad request
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BadRequestError'
```

## Conclusion

This design follows all established codebase patterns:
- ✅ Uses Hono framework with OpenAPI integration
- ✅ Zod schemas for validation and documentation
- ✅ Centralized error handling via `ERRORS` constant
- ✅ Inline handler approach (no separate files)
- ✅ Comprehensive test coverage with Vitest
- ✅ Proper TypeScript typing throughout
- ✅ Consistent with existing endpoint patterns
- ✅ Clear documentation and specifications

**Ready for implementation** - All patterns match existing conventions, file paths are specific, and no placeholders remain.
