# Activity Template Specification: Implement MCP Gateway Phase 3

## Overview
**Template Name**: Implement MCP Gateway Phase 3
**Category**: infrastructure
**Purpose**: Implement MCP gateway pattern for A/B testing metrics (Phase 3.1-3.3 as defined in MCP_GATEWAY_ARCHITECTURE.md)

## Workflow Tasks

### Task 1: Create MCP Gateway Tools (Phase 3.1)
**Agent**: general
**Description**: Add MCP metrics tools to metabob-cli
**Actions**:
- Create `repos/metabob-cli/src/metabob_cli/mcp/activity_metrics_tools.py`
- Implement 4 MCP tools:
  1. `metabob_report_execution` - Forward execution data to backend
  2. `metabob_get_template_metrics` - Query aggregated metrics  
  3. `metabob_get_promotion_recommendation` - Get A/B test recommendation
  4. `metabob_promote_template` - Promote candidate to stable
- Each tool forwards to metabob-rpc-api (no business logic in gateway)
- Add proper error handling and retry logic
- Add unit tests (mock RPC API client)

**Variables**:
- `cliPath` (string, required): Path to metabob-cli repo
- `rpcApiUrl` (string, required): RPC API base URL (default: "http://localhost:8000")

**Validation**:
- File `activity_metrics_tools.py` exists
- All 4 tools implemented
- Tools imported in MCP server
- Unit tests pass

---

### Task 2: Implement Backend Metrics Endpoints (Phase 3.2)
**Agent**: general
**Description**: Create metrics aggregation endpoints in metabob-rpc-api
**Actions**:
- Create `repos/metabob-rpc-api/src/endpoints/metrics.py`
- Implement 4 REST endpoints:
  1. `POST /api/activity-execution` - Record execution
  2. `GET /api/template/:id/metrics` - Get aggregated metrics
  3. `GET /api/template/:id/recommendation` - Get promotion recommendation
  4. `POST /api/template/promote` - Promote template
- Create `metrics_aggregator.py` service (aggregate execution data)
- Create `promotion_engine.py` service (statistical analysis, chi-square test)
- Design database schema (activity_executions, template_metrics tables)
- Add unit tests for services
- Add integration tests for endpoints

**Variables**:
- `rpcApiPath` (string, required): Path to metabob-rpc-api repo
- `databaseType` (string, required): Database type (default: "surrealdb")

**Validation**:
- All endpoint files exist
- Services implemented with statistical tests
- Database schema migration created
- Tests pass

---

### Task 3: Update OpenCode to Use MCP Tools (Phase 3.3)
**Agent**: general
**Description**: Integrate MCP metrics tools into metabob-opencode
**Actions**:
- Create `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts`
- Implement `TemplateMetrics.reportExecution()` - calls metabob_report_execution via MCP
- Implement `TemplateMetrics.getRecommendation()` - calls metabob_get_promotion_recommendation
- Update `activity.ts` to call `reportExecution()` after execution
- Add CLI commands:
  - `opencode template metrics <id>` - View metrics
  - `opencode template promote <candidate-id>` - Promote template
- Update TUI to show recommendations
- Add unit tests (mock MCP client)
- Add integration tests

**Variables**:
- `opencodePath` (string, required): Path to metabob-opencode repo

**Validation**:
- `template-metrics.ts` exists and exports functions
- `activity.ts` updated to report metrics
- CLI commands work
- Tests pass
- NO direct RPC API calls (all via MCP)

---

### Task 4: Verify Architecture Compliance
**Agent**: general
**Description**: Run architecture validation to ensure no violations
**Actions**:
- Run `validate-architecture-compliance` activity (created in parallel)
- Verify report shows PASS (no CRITICAL violations)
- Fix any violations found
- Re-run validation until clean

**Validation**:
- Compliance report shows PASS
- No direct RPC API calls from opencode
- All backend communication via MCP gateway

---

### Task 5: Integration Testing
**Agent**: general
**Description**: End-to-end testing of MCP gateway pattern
**Actions**:
- Start metabob-rpc-api backend (test mode)
- Start metabob-cli MCP server
- Execute test activity from metabob-opencode
- Verify metrics reported correctly
- Verify recommendation retrieved
- Test promotion workflow
- Generate test report

**Validation**:
- End-to-end flow works
- Metrics recorded in backend
- Recommendations returned correctly
- Test report generated

---

## Variables

- `opencodePath` (string, required): Path to metabob-opencode (default: "repos/metabob-opencode")
- `cliPath` (string, required): Path to metabob-cli (default: "repos/metabob-cli")
- `rpcApiPath` (string, required): Path to metabob-rpc-api (default: "repos/metabob-rpc-api")
- `rpcApiUrl` (string, optional): RPC API base URL (default: "http://localhost:8000")
- `databaseType` (string, optional): Database type (default: "surrealdb")
- `runTests` (boolean, optional): Run full test suite (default: true)

---

## Success Criteria

- ✅ Phase 3.1 complete: MCP gateway tools implemented
- ✅ Phase 3.2 complete: Backend endpoints and services implemented
- ✅ Phase 3.3 complete: OpenCode integrated with MCP tools
- ✅ Architecture compliance verified (no violations)
- ✅ Integration tests pass
- ✅ Documentation updated

---

## Dependencies

- Requires `validate-architecture-compliance` activity (run in parallel or after)
- Follows architecture defined in `MCP_GATEWAY_ARCHITECTURE.md`
- Implements checklist from `ARCHITECTURE_REDESIGN_SUMMARY.md`

---

## Output Artifacts

- `repos/metabob-cli/src/metabob_cli/mcp/activity_metrics_tools.py`
- `repos/metabob-rpc-api/src/endpoints/metrics.py`
- `repos/metabob-rpc-api/src/services/metrics_aggregator.py`
- `repos/metabob-rpc-api/src/services/promotion_engine.py`
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts`
- Database migration scripts
- Test files
- `PHASE_3_COMPLETION_SUMMARY.md`
