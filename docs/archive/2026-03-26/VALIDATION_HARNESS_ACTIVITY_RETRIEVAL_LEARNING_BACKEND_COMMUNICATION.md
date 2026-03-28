# Validation Harness: activity-retrieval-learning-backend-communication

**Specification**: activity-retrieval-learning-backend-communication  
**Harness File**: `tests/validation-harnesses/activity-retrieval-learning-backend-communication-harness.ts`  
**Harness Impulse**: `harness-activity-retrieval-learning-backend-communication`  
**Created**: 2026-03-04

## Overview

This validation harness provides automated, non-LLM testing for the activity-retrieval-learning-backend-communication specification. It executes end-to-end tests to verify:

1. ✅ Activities are retrieved from backend via MCP (not local files)
2. ✅ Activity execution works without local template files
3. ✅ Learning data (execution results) flows back to backend via MCP
4. ✅ No local activity storage in OpenCode
5. ✅ No implicit file dependencies

## Test Cases

### Test Case 1: Basic Activity Retrieval and Execution Flow
**Impulse ID**: `validation-activity-retrieval-learning-backend-communication-case-1`

**Input**:
```json
{
  "activityTemplateId": "add-rest-endpoint",
  "testVariables": {
    "method": "GET",
    "path": "/api/test",
    "requestSchema": "{}",
    "responseSchema": "{ success: boolean }",
    "handlerDescription": "Test endpoint for validation"
  },
  "expectedDataFlow": {
    "mcpCallsMade": [
      "search_activities",
      "activity",
      "metabob_post_activity_result"
    ],
    "backendEndpointsHit": [
      "GET /v2/activities/templates",
      "POST /api/v1/learning-loop/executions"
    ],
    "localFilesCreated": []
  }
}
```

**Expected Output**:
```json
{
  "templateRetrieved": true,
  "templateSource": "mcp",
  "activityExecuted": true,
  "learningDataPosted": true,
  "localFilesCreated": [],
  "mcpCallsMade": [
    "search_activities",
    "activity",
    "metabob_post_activity_result"
  ],
  "backendEndpointsHit": [
    "GET /v2/activities/templates",
    "POST /api/v1/learning-loop/executions"
  ]
}
```

**Rationale**: This test validates the core data flow: retrieval via MCP, execution without local dependencies, and learning data posted to backend.

---

### Test Case 2: No Local Storage Enforcement
**Impulse ID**: `validation-activity-retrieval-learning-backend-communication-case-2`

**Input**:
```json
{
  "activityTemplateId": "fix-compile-error",
  "testVariables": {
    "file": "test/sample.ts",
    "line": "42",
    "errorMessage": "Type 'string' is not assignable to type 'number'"
  },
  "expectedDataFlow": {
    "mcpCallsMade": [
      "activity",
      "metabob_post_activity_result"
    ],
    "backendEndpointsHit": [
      "GET /v2/activities/templates/fix-compile-error",
      "POST /api/v1/learning-loop/executions"
    ],
    "localFilesCreated": []
  }
}
```

**Expected Output**:
```json
{
  "templateRetrieved": true,
  "templateSource": "mcp",
  "activityExecuted": true,
  "learningDataPosted": true,
  "localFilesCreated": [],
  "mcpCallsMade": [
    "activity",
    "metabob_post_activity_result"
  ],
  "backendEndpointsHit": [
    "GET /v2/activities/templates/fix-compile-error",
    "POST /api/v1/learning-loop/executions"
  ]
}
```

**Rationale**: This test specifically validates that OpenCode does NOT create local activity storage files, enforcing backend-only storage architecture.

---

### Test Case 3: Learning Data with Impulses and Component Changes
**Impulse ID**: `validation-activity-retrieval-learning-backend-communication-case-3`

**Input**:
```json
{
  "activityTemplateId": "add-tool",
  "testVariables": {
    "toolName": "test-validator",
    "toolPurpose": "Validate test data structures",
    "parameterSchema": "z.object({ data: z.string() })",
    "responseFormat": "{ valid: boolean, errors?: string[] }"
  },
  "expectedDataFlow": {
    "mcpCallsMade": [
      "activity",
      "metabob_post_activity_result"
    ],
    "backendEndpointsHit": [
      "GET /v2/activities/templates/add-tool",
      "POST /api/v1/learning-loop/executions"
    ],
    "localFilesCreated": []
  }
}
```

**Expected Output**:
```json
{
  "templateRetrieved": true,
  "templateSource": "mcp",
  "activityExecuted": true,
  "learningDataPosted": true,
  "localFilesCreated": [],
  "mcpCallsMade": [
    "activity",
    "metabob_post_activity_result"
  ],
  "backendEndpointsHit": [
    "GET /v2/activities/templates/add-tool",
    "POST /api/v1/learning-loop/executions"
  ],
  "learningDataFields": [
    "impulses_used",
    "component_changes"
  ]
}
```

**Rationale**: This test validates that learning data includes rich context (impulses and component changes) for backend analysis and improvement.

---

## Harness Architecture

### Entry Point
```typescript
export async function runValidation(input: ValidationInput): Promise<ValidationOutput>
```

### Validation Steps

1. **Pre-Execution State Capture**
   - Snapshot local activity storage directory
   - Count existing template files
   - Prepare MCP and backend logging

2. **Template Retrieval**
   - Call `MetabobCLI.getActivity(templateId)` via MCP
   - Verify source is `mcp` (not `local`)
   - Capture MCP tool calls

3. **Activity Execution**
   - Execute activity with test variables
   - Monitor for local file creation
   - Capture execution result

4. **Learning Data Flow**
   - Verify `metabob_post_activity_result` MCP call
   - Check backend endpoint `/api/v1/learning-loop/executions` was hit
   - Validate learning data includes `impulses_used` and `component_changes`

5. **Post-Execution Validation**
   - Compare local file count (should be unchanged)
   - Verify MCP call sequence matches expected
   - Verify backend endpoint sequence matches expected

6. **Result Aggregation**
   - Return PASS/FAIL status
   - Include actual vs expected comparison
   - List all failures for debugging

### Output Format
```typescript
interface ValidationOutput {
  pass: boolean;
  actual: {
    templateRetrieved: boolean;
    templateSource: 'mcp' | 'local' | 'error';
    activityExecuted: boolean;
    learningDataPosted: boolean;
    localFilesCreated: string[];
    mcpCallsMade: string[];
    backendEndpointsHit: string[];
    errors: string[];
  };
  expected: {
    templateRetrieved: boolean;
    templateSource: 'mcp';
    activityExecuted: boolean;
    learningDataPosted: boolean;
    localFilesCreated: string[];
    mcpCallsMade: string[];
    backendEndpointsHit: string[];
  };
  failures: string[];
  timestamp: string;
}
```

---

## Usage

### Running Individual Test Case
```typescript
import { runValidation } from './tests/validation-harnesses/activity-retrieval-learning-backend-communication-harness';

// Load test case from impulse
const testCase = await ImpulseManager.load('validation-activity-retrieval-learning-backend-communication-case-1');
const input = testCase.pointer.content.input;

// Run validation
const result = await runValidation(input);

console.log(`Result: ${result.pass ? 'PASS' : 'FAIL'}`);
if (!result.pass) {
  console.log('Failures:', result.failures);
}
```

### Running All Test Cases
```bash
# Standalone execution
cd /home/avi/documents/work/exp-repo/metabob-devbob
npx tsx tests/validation-harnesses/activity-retrieval-learning-backend-communication-harness.ts
```

### Integration with CI/CD
```yaml
# .github/workflows/validate-architecture.yml
- name: Validate Activity Retrieval Flow
  run: |
    npx tsx tests/validation-harnesses/activity-retrieval-learning-backend-communication-harness.ts
```

---

## Monitoring Points

The harness monitors the following data points:

### MCP Layer
- ✅ MCP tool calls made (search_activities, activity, metabob_post_activity_result)
- ✅ MCP tool call parameters
- ✅ MCP tool call results
- ✅ MCP error handling

### Backend Layer
- ✅ Backend API endpoints hit
- ✅ Request/response bodies
- ✅ HTTP status codes
- ✅ Learning data payload (impulses_used, component_changes)

### File System
- ✅ Local activity storage directory state
- ✅ Template files created/deleted
- ✅ Cache files created/deleted

### Activity Execution
- ✅ Execution success/failure
- ✅ Execution duration
- ✅ Metrics reported (tokens, cost)

---

## Logging

The harness enables comprehensive logging for debugging:

### MCP Logs
**Path**: `validation-logs/mcp-calls.log`

**Format**:
```json
{
  "timestamp": "2026-03-04T12:00:00Z",
  "tool": "search_activities",
  "params": { "category": "feature" },
  "result": { "templates": [...] }
}
```

### Backend Logs
**Path**: `validation-logs/backend-calls.log`

**Format**:
```json
{
  "timestamp": "2026-03-04T12:00:00Z",
  "endpoint": "/v2/activities/templates",
  "method": "GET",
  "status": 200,
  "body": { "templates": [...] }
}
```

---

## Expected Failures

The harness will FAIL if any of the following occur:

1. ❌ Template retrieved from local files instead of MCP
2. ❌ Local activity files created during execution
3. ❌ MCP tool `metabob_post_activity_result` not called
4. ❌ Backend endpoint `/api/v1/learning-loop/executions` not hit
5. ❌ Learning data missing `impulses_used` or `component_changes`
6. ❌ Expected MCP calls not made
7. ❌ Expected backend endpoints not hit

---

## Maintenance

### Adding New Test Cases

1. Create impulse file: `impulses/validation-activity-retrieval-learning-backend-communication-case-N.json`
2. Define input and expected output
3. Add impulse ID to harness metadata
4. Run harness to validate new case

### Updating Expected Values

Test cases are stored as impulses (historical data). To update expectations:

1. Modify impulse file content
2. Update `expectedOutput` in impulse
3. Re-run harness to verify

### Debugging Failures

When a test fails:

1. Check `validation-logs/mcp-calls.log` for MCP tool calls
2. Check `validation-logs/backend-calls.log` for backend API calls
3. Review `result.failures` array for specific failure reasons
4. Compare `result.actual` vs `result.expected`

---

## Integration with Specification Workflow

This harness is part of the trace-enforce-validate loop:

1. **TRACE** → `trace-activity-retrieval-learning-backend-communication` impulse created
2. **ENFORCE** → `enforcement-activity-retrieval-learning-backend-communication` impulse created (no changes required)
3. **VALIDATE** → This harness validates the architecture is compliant ✅

---

## Success Criteria

The validation harness passes if:

1. ✅ All test cases return `pass: true`
2. ✅ No local activity files created
3. ✅ All MCP calls made as expected
4. ✅ All backend endpoints hit as expected
5. ✅ Learning data includes impulses and component changes

---

## Files Created

1. **tests/validation-harnesses/activity-retrieval-learning-backend-communication-harness.ts** - Main harness implementation
2. **impulses/validation-activity-retrieval-learning-backend-communication-case-1.json** - Test case 1
3. **impulses/validation-activity-retrieval-learning-backend-communication-case-2.json** - Test case 2
4. **impulses/validation-activity-retrieval-learning-backend-communication-case-3.json** - Test case 3
5. **impulses/harness-activity-retrieval-learning-backend-communication.json** - Harness impulse

---

## Conclusion

This validation harness provides automated, repeatable testing for the activity-retrieval-learning-backend-communication specification. It can run without LLM assistance, uses historical test data stored as impulses, and provides clear PASS/FAIL results.

The harness is ready for integration into CI/CD pipelines and can be extended with additional test cases as the architecture evolves.
