# API Documentation Generator Activity Template

## Summary

Created comprehensive ActivityTemplate for automated API documentation generation.

**File**: `api-docs-generator.json`

## Template Structure

### Metadata
- **ID**: `api-docs-generator`
- **Category**: `tool`
- **Version**: 1.0.0
- **Description**: Comprehensive API documentation workflow with pattern analysis, OpenAPI spec generation, endpoint documentation, and validation

### Tasks (4)

#### 1. discover-and-analyze
- **Dependencies**: None (entry point)
- **Token Budget**: 16,000
- **Purpose**: Discover all API endpoints and analyze patterns
- **Outputs**: 
  - `API_DISCOVERY_REPORT.md` - Complete endpoint inventory with framework detection
- **Key Features**:
  - Multi-framework support (Express, Fastify, Koa, Next.js, NestJS)
  - Metabob integration for code analysis
  - Authentication pattern detection
  - Validation schema identification

#### 2. generate-openapi-spec
- **Dependencies**: `discover-and-analyze`
- **Token Budget**: 16,000
- **Purpose**: Generate OpenAPI 3.0 specification
- **Outputs**:
  - `openapi.yaml` or `openapi.json` - Valid OpenAPI spec
  - `OPENAPI_VALIDATION.md` - Validation report
- **Key Features**:
  - Complete schema definitions
  - Authentication configuration
  - Request/response examples
  - Automated validation

#### 3. generate-endpoint-docs
- **Dependencies**: `generate-openapi-spec`
- **Token Budget**: 16,000
- **Purpose**: Create human-readable documentation
- **Outputs**:
  - `API_DOCUMENTATION.md` - Complete endpoint reference
  - `API_QUICK_START.md` - Getting started guide
- **Key Features**:
  - Curl examples for all endpoints
  - Multi-language code examples (JavaScript, Python)
  - Error handling documentation
  - Authentication flow guide

#### 4. validate-and-test
- **Dependencies**: `generate-endpoint-docs`
- **Token Budget**: 14,000
- **Purpose**: Validate completeness and test examples
- **Outputs**:
  - `API_DOCS_VALIDATION_REPORT.md` - Final validation results
- **Key Features**:
  - OpenAPI spec validation
  - Endpoint coverage verification
  - Example testing (if API running)
  - Quality gate checks

## Validation Results

✅ **All Self-Validation Checks Passed**

```bash
# JSON validity
✓ Valid JSON

# Task count (3-7)
✓ 4 tasks

# All tasks have validation
✓ true

# All tasks have retry
✓ true

# Dependencies form linear chain
✓ discover-and-analyze → generate-openapi-spec → generate-endpoint-docs → validate-and-test

# Token budgets (8000-16000)
✓ All tasks within range (14000-16000)
```

## Dependency Graph

```
discover-and-analyze (16K tokens)
        ↓
generate-openapi-spec (16K tokens)
        ↓
generate-endpoint-docs (16K tokens)
        ↓
validate-and-test (14K tokens)
```

## Template Variables

### discover-and-analyze
- `project_path` (optional): Root path of project
- `api_prefix` (optional): API route prefix to focus on

### generate-openapi-spec
- `api_name` (optional): Name of the API
- `output_format` (optional): 'yaml' or 'json'

### generate-endpoint-docs
- `include_languages` (optional): Languages for code examples

### validate-and-test
- `api_base_url` (optional): Base URL for live testing
- `test_credentials` (optional): Test credentials

## Validation & Retry Configuration

### All Tasks Include:
- **Validation**: 
  - Required files
  - Required patterns (content validation)
  - Forbidden patterns (placeholder detection)
  - Optional commands for quality gates
  
- **Retry Configuration**:
  - Max attempts: 2-3
  - Strategy: `progressive-context`
  - Detailed fallback prompts

### Validation Highlights:
- No placeholders allowed (TODO, TBD, [count], [list], etc.)
- All documentation must be specific and complete
- OpenAPI spec must be valid format
- Final validation must show [PASS] status

## Integration Features

### Pre-Checks
- `git status` - Repository state

### Post-Checks
- File existence verification
- Line count checks

### Quality Gates
- OpenAPI validation (optional)
- Documentation files existence (required)

## Metabob Integration

- **Enabled**: Yes
- **Learning Mode**: Yes
- **Target Context**: 5000 tokens
- **Annotation Strategy**: key-components

### Used In:
- Task 1: Code structure analysis
- Component discovery
- Pattern identification

## Learning & Metrics

Each task tracks:
- Execution count
- Success rate
- Average duration
- Average tokens used
- Common failures

### Feedback Points:
- Discovery accuracy
- OpenAPI spec validity
- Documentation usefulness
- Validation thoroughness

## Usage Example

```bash
# Basic usage
activity({
  activityId: "api-docs-generator",
  variables: {},
  reason: "Generate API documentation for Express REST API"
})

# With custom prefix
activity({
  activityId: "api-docs-generator",
  variables: {
    api_prefix: "/api/v2",
    output_format: "yaml"
  },
  reason: "Document v2 API endpoints"
})
```

## Expected Outputs

After successful execution:

1. **API_DISCOVERY_REPORT.md** - Endpoint inventory and pattern analysis
2. **openapi.yaml** (or .json) - OpenAPI 3.0 specification
3. **OPENAPI_VALIDATION.md** - Spec validation results
4. **API_DOCUMENTATION.md** - Complete API reference with examples
5. **API_QUICK_START.md** - Getting started guide
6. **API_DOCS_VALIDATION_REPORT.md** - Final validation (status: PASS)

## Next Steps

1. Register the template:
   ```bash
   # When ready to register
   register_activity_template({
     file_path: "api-docs-generator.json",
     validate_only: false
   })
   ```

2. Test the template:
   ```bash
   # Run on a test project
   activity({
     activityId: "api-docs-generator",
     variables: {},
     reason: "Test documentation generation"
   })
   ```

3. Iterate based on results:
   - Check execution metrics
   - Review common failures
   - Adjust prompts/validation as needed

## Status

✅ **Template Complete and Validated**

- Valid JSON structure
- 4 tasks with linear dependency chain
- All tasks have validation and retry
- Token budgets appropriate (14K-16K)
- Comprehensive documentation
- Ready for registration and testing
