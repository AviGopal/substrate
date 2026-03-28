# Activity Template Specification: Validate Architecture Compliance

## Overview
**Template Name**: Validate Architecture Compliance
**Category**: infrastructure
**Purpose**: Systematically validate that the MCP Gateway Architecture is properly enforced (no direct backend calls from opencode)

## Workflow Tasks

### Task 1: Scan for Direct RPC API References
**Agent**: general
**Description**: Search codebase for direct metabob-rpc-api calls in metabob-opencode
**Actions**:
- Search for patterns: `fetch.*rpc-api`, `axios.*rpc-api`, `http.*metabob-rpc`, `DB_CONNECTION`, database imports
- Check imports: look for rpc-api client imports in opencode packages
- Generate violation report with file paths and line numbers

**Variables**:
- `opencodePath` (string, required): Path to metabob-opencode repository
- `rpApiPath` (string, required): Path to metabob-rpc-api repository

**Validation**:
- Report generated with findings (or empty if compliant)
- All matches categorized by severity (CRITICAL vs WARNING)

---

### Task 2: Verify MCP Tool Usage
**Agent**: general
**Description**: Confirm that all backend operations use MCP tools
**Actions**:
- Find all template-related code in opencode
- Verify TemplateRepository uses MCP calls (metabob_search_activities, metabob_get_activity_template)
- Check for any direct HTTP clients or database connections
- Verify activity.ts uses MCP for metrics reporting (if implemented)

**Validation**:
- List all MCP tool calls found
- Flag any non-MCP backend communication

---

### Task 3: Check Dependency Graph
**Agent**: general  
**Description**: Analyze import dependencies to detect violations
**Actions**:
- Parse import statements in opencode TypeScript files
- Check for imports from metabob-rpc-api
- Check for database client imports (pg, mysql2, surreal, etc.)
- Generate dependency graph showing violations

**Validation**:
- Dependency report generated
- Violations clearly highlighted

---

### Task 4: Validate metabob-cli Gateway Implementation
**Agent**: general
**Description**: Verify metabob-cli properly implements MCP gateway pattern
**Actions**:
- Check that activity_template_tools.py exists and has proper MCP tools
- Verify tools forward to backend (search for rpc_client usage)
- Check for proper error handling and retry logic
- Verify no business logic in MCP tools (just forwarding)

**Validation**:
- Gateway tools inventory generated
- Each tool properly forwards to backend

---

### Task 5: Generate Compliance Report
**Agent**: general
**Description**: Create comprehensive compliance report
**Actions**:
- Aggregate all findings from previous tasks
- Categorize violations: CRITICAL (direct API calls), WARNING (suspicious patterns), PASS (compliant)
- Generate recommendations for fixes
- Create summary with pass/fail status

**Output**:
- `ARCHITECTURE_COMPLIANCE_REPORT.md` in project root
- Clear action items for any violations found

**Validation**:
- Report file exists
- Contains all findings with file references
- Includes actionable recommendations

---

## Variables

- `opencodePath` (string, required): Path to metabob-opencode repository (default: "repos/metabob-opencode")
- `cliPath` (string, required): Path to metabob-cli repository (default: "repos/metabob-cli")
- `rpcApiPath` (string, required): Path to metabob-rpc-api repository (default: "repos/metabob-rpc-api")
- `outputPath` (string, optional): Where to write report (default: "ARCHITECTURE_COMPLIANCE_REPORT.md")

---

## Success Criteria

- ✅ All code paths scanned
- ✅ No CRITICAL violations found (or clear list of what needs fixing)
- ✅ Comprehensive report generated
- ✅ Actionable recommendations provided
- ✅ Dependency graph validated

---

## Example Violations to Detect

**CRITICAL**:
```typescript
// metabob-opencode calling RPC API directly
await fetch("http://rpc-api/api/templates")
await rpcClient.getTemplates()
```

**WARNING**:
```typescript
// Importing backend-specific code
import { TemplateRegistry } from "../../../metabob-rpc-api"
```

**PASS**:
```typescript
// Using MCP tool correctly
await mcpClient.callTool("metabob_search_activities", {...})
```
