// Script to create the add-rest-endpoint activity template
// This uses ActivityTemplate.create() to properly initialize all required fields

const templateOptions = {
  name: "Add REST Endpoint",
  description: "Add a new REST API endpoint with schema validation, handler implementation, comprehensive tests, and documentation",
  category: "feature",
  tasks: [
    {
      id: "analyze-and-design",
      subagent: "activity",
      description: "Analyze codebase patterns and design endpoint structure",
      dependencies: [],
      prompt: {
        template: `Design a new REST endpoint based on existing codebase patterns.

**Endpoint Specification**:
- Path: {{endpoint_path}}
- Method: {{http_method}}
- Purpose: {{endpoint_description}}

**Your Task**:

1. **Review Existing Patterns**
   - What routing framework is used? (Express, Fastify, etc.)
   - Where are routes defined? (file paths)
   - What's the handler structure pattern?
   - How is authentication/authorization handled?
   - What error handling patterns exist?

2. **Design Endpoint Structure**
   - Which file(s) will contain the new route?
   - What middleware is needed?
   - What schema validation approach?
   - What database/service calls are needed?
   - What error responses should be returned?

3. **Plan Implementation**
   - Files to create or modify
   - Dependencies between components
   - Validation requirements
   - Test scenarios to cover

**Output**: Create ENDPOINT_DESIGN.md with complete design specification.`,
        variables: [
          {
            name: "endpoint_path",
            type: "string",
            required: true,
            description: "HTTP path for the endpoint (e.g., '/api/users/:id')"
          },
          {
            name: "http_method",
            type: "string",
            required: true,
            description: "HTTP method (GET, POST, PUT, PATCH, DELETE)"
          },
          {
            name: "endpoint_description",
            type: "string",
            required: true,
            description: "What this endpoint does and its business purpose"
          }
        ]
      }
    },
    {
      id: "implement-endpoint",
      subagent: "activity",
      description: "Implement the endpoint handler with schema validation and error handling",
      dependencies: ["analyze-and-design"],
      prompt: {
        template: `Implement the {{http_method}} {{endpoint_path}} endpoint based on ENDPOINT_DESIGN.md.

**Implementation Requirements**:

1. **Route Definition**
   - Add route to appropriate router file
   - Use consistent naming conventions
   - Apply necessary middleware

2. **Schema Validation**
   - Define request schema (body, query, params)
   - Define response schema
   - Add validation middleware/decorator

3. **Handler Implementation**
   - Parse and validate input
   - Implement business logic
   - Handle errors gracefully
   - Return appropriate status codes

4. **Code Quality**
   - Use TypeScript types (no \`any\`)
   - Add JSDoc comments
   - Follow existing code style
   - Remove debug logging (console.log)

**Success Criteria**:
- Route is registered and accessible
- Request validation works
- Response matches schema
- Error handling is comprehensive
- Code follows project conventions`,
        variables: [
          {
            name: "endpoint_path",
            type: "string",
            required: true,
            description: "HTTP path for the endpoint"
          },
          {
            name: "http_method",
            type: "string",
            required: true,
            description: "HTTP method"
          }
        ]
      }
    },
    {
      id: "write-tests",
      subagent: "test",
      description: "Write comprehensive tests for the endpoint",
      dependencies: ["implement-endpoint"],
      prompt: {
        template: `Write comprehensive tests for {{http_method}} {{endpoint_path}}.

**Test Coverage Requirements**:

1. **Happy Path Tests**
   - Valid request returns success (200/201)
   - Response matches expected schema
   - Data is correctly processed

2. **Validation Tests**
   - Missing required fields → 400
   - Invalid data types → 400

3. **Error Handling Tests**
   - Resource not found → 404
   - Server errors → 500

**Requirements**:
- Use existing test utilities
- Mock external dependencies
- Tests must pass`,
        variables: [
          {
            name: "endpoint_path",
            type: "string",
            required: true,
            description: "HTTP path"
          },
          {
            name: "http_method",
            type: "string",
            required: true,
            description: "HTTP method"
          }
        ]
      }
    }
  ]
};

console.log(JSON.stringify(templateOptions, null, 2));
