# Add REST Endpoint Activity Template - COMPLETE

## Status: ✅ VALIDATED AND READY

Created: 2026-02-14

## File Location
`add-rest-endpoint.json`

## Validation Results

All validation checks passed:

- ✅ **JSON Syntax**: Valid
- ✅ **Task Count**: 4 (within 3-7 range, ideal for complexity)
- ✅ **All Tasks Have Validation**: Yes
- ✅ **All Tasks Have Retry**: Yes
- ✅ **Dependencies Valid**: All references exist
- ✅ **Token Budget**: 46,000 tokens (reasonable)
- ✅ **Required Fields**: All present

## Template Structure

### Task Graph (Dependency Flow)

```
analyze-and-design (10k tokens)
    │
    ├── implement-endpoint (16k tokens)
    │       │
    │       ├── write-tests (12k tokens)
    │       │
    │       └── document-endpoint (8k tokens)
```

### Task Details

#### 1. analyze-and-design
- **Purpose**: Study existing endpoints and design the new endpoint structure
- **Max Tokens**: 10,000
- **Retry Strategy**: simple (2 attempts)
- **Validation**: Requires ENDPOINT_DESIGN.md with specific sections
- **Subagent**: general
- **Dependencies**: None

#### 2. implement-endpoint
- **Purpose**: Implement handler with schema validation and error handling
- **Max Tokens**: 16,000 (highest - most complex task)
- **Retry Strategy**: progressive-context (3 attempts)
- **Validation**: TypeScript files, routing patterns, no console.log
- **Subagent**: general
- **Dependencies**: analyze-and-design

#### 3. write-tests
- **Purpose**: Comprehensive tests covering success, validation, errors, edge cases
- **Max Tokens**: 12,000
- **Retry Strategy**: progressive-context (3 attempts)
- **Validation**: Test files with describe/it/expect, no skipped tests
- **Subagent**: test
- **Dependencies**: implement-endpoint

#### 4. document-endpoint
- **Purpose**: API documentation with usage examples
- **Max Tokens**: 8,000
- **Retry Strategy**: simple (2 attempts)
- **Validation**: Markdown with required sections
- **Subagent**: docs
- **Dependencies**: implement-endpoint

## Variables (5)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `endpoint_path` | string | Yes | HTTP path (e.g., '/api/users/:id') |
| `http_method` | string | Yes | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| `endpoint_description` | string | Yes | Business purpose description |
| `request_schema` | object | No | Expected request body/query parameters |
| `response_schema` | object | No | Expected response schema |

## Context Requirements (3)

1. **existingEndpoints** (required): 3,000-5,000 tokens
   - Finds similar endpoint implementations
   - Identifies routing patterns
   
2. **schemaPatterns** (optional): 2,000-3,000 tokens
   - Schema validation patterns (Zod, Joi, etc.)
   
3. **testPatterns** (required): 2,000-4,000 tokens
   - API test examples

## Token Budget Analysis

- **Context Budget**: 15,000 tokens
- **Task Execution Budget**: 46,000 tokens
- **Total Estimated**: ~61,000 tokens
- **Expected Cost**: $0.20
- **Expected Duration**: 180 seconds (3 minutes)

## Example Usage

```typescript
activity({
  activityId: "add-rest-endpoint",
  variables: {
    endpoint_path: "/api/users/:id/profile",
    http_method: "GET",
    endpoint_description: "Retrieve user profile with preferences and settings"
  },
  reason: "Add user profile endpoint with validation and tests"
})
```

## Features

### Comprehensive Validation
- File existence checks
- Pattern matching (required and forbidden)
- Command execution (typecheck, tests)
- No TODO/TBD/FIXME allowed

### Robust Retry Strategies
- **Simple**: Straightforward tasks (design, docs)
- **Progressive-context**: Complex tasks needing more context on failure

### Quality Gates
- JSON syntax validation
- TypeScript type checking
- Test execution
- Pattern compliance

### Learning & Metabob Integration
- Enabled for continuous improvement
- Detailed capture strategy
- Task-level metrics tracking
- Code quality annotations

## Composition Support

**Standalone**: Yes

**Composes With**:
- `add-database-migration`
- `add-integration-tests`

**Example Compositions**: 2 included in template
1. Add User Profile Endpoint (GET)
2. Add Create Resource Endpoint (POST with schemas)

## Self-Validation Commands

```bash
# JSON syntax
jq empty add-rest-endpoint.json

# Task count (should be 3-7)
jq '.tasks | length' add-rest-endpoint.json

# All tasks have validation
jq '.tasks | all(.validation)' add-rest-endpoint.json

# All tasks have retry
jq '.tasks | all(.retry)' add-rest-endpoint.json

# Check dependencies
jq -r '.tasks[] | select(.dependencies | length > 0) | "\(.id) depends on: \(.dependencies | join(", "))"' add-rest-endpoint.json
```

## Next Steps

The template is ready for:

1. **Registration**: Use `register_activity_template` tool
2. **Testing**: Run with test variables
3. **Refinement**: Based on execution feedback
4. **Deployment**: Add to template repository

## Design Principles Applied

1. ✅ **Optimal Task Count**: 4 tasks (sweet spot for reliability)
2. ✅ **Clear Dependencies**: Linear flow with parallel documentation
3. ✅ **Comprehensive Validation**: Every task validates its output
4. ✅ **Appropriate Retry**: Matched to task complexity
5. ✅ **Realistic Token Budgets**: 8k-16k per task
6. ✅ **Metabob Integration**: Learning enabled
7. ✅ **Context-Aware**: Uses existing patterns
8. ✅ **Quality-First**: Multiple validation layers

## Schema Compliance

Follows `ActivityTemplate.CreateOptions` schema with all required fields:
- Task structure (id, subagent, description, dependencies, guidance, prompt, validation, retry, metrics, tools)
- Variable definitions (type, required, description)
- Context requirements (with budget ranges)
- Integration hooks (preActivity, postActivity, onError)
- Composition metadata
- Learning configuration

---

**Template Ready for Production Use** 🚀
