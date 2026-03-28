# Activity Template Audit - Current State Analysis

## Objective
Map all activity template locations, formats, and usage patterns across the three systems to ensure safe migration.

## Systems to Audit

1. **metabob-proto** - Source of truth (proto definitions)
2. **metabob-rpc-api** - Backend storage and serving
3. **metabob-cli** - MCP tools and activity management
4. **metabob-opencode** - Template execution and creation
5. **devbob containers** - Runtime examples

## Audit Checklist

### A. Proto Definitions (Source of Truth)
- [ ] Locate all .proto files defining activity schemas
- [ ] Identify which fields are required vs optional
- [ ] Document proto → JSON mapping rules
- [ ] List all bootstrap templates in activities/

### B. Backend (metabob-rpc-api)
- [ ] Find Pydantic model definitions
- [ ] Check API endpoint schemas (request/response)
- [ ] Verify database schema in SurrealDB
- [ ] List stored templates in database
- [ ] Check validation logic in routes

### C. CLI (metabob-cli)
- [ ] Find Python type definitions
- [ ] Check MCP tool schemas
- [ ] Verify activity_manager.py format
- [ ] Check template registration logic

### D. OpenCode (metabob-opencode)
- [ ] Find TypeScript interface definitions
- [ ] Check built-in templates location
- [ ] Verify ActivityTool expectations
- [ ] Check template creation logic

### E. Container Workspaces
- [ ] devbob-opencode:/workspace/examples/
- [ ] devbob-rpc-api:/workspace/examples/
- [ ] devbob-cli:/workspace/examples/
- [ ] Any other containers with templates

## Audit Results
(To be filled in with findings)

