# Proposal: Refactor Internal Dashboard Architecture

## Why

The metabob-internal-dashboard currently uses REST request/response patterns to fetch backend data, treating the metabob-activity-api as a universal resolver. This violates the foundational vessel/impulse/activity architecture where data resolution should be impulse-driven via MCP, vessels should declare capabilities, and resolvers should live where data lives. The dashboard embeds MiniBob directly instead of delegating to an execution vessel, creating tight coupling and preventing proper separation of concerns. This refactor eliminates these anti-patterns, establishing the dashboard as a thin UI rendering vessel that participates correctly in the shared impulse state space.

## What Changes

- **Separate vessels**: Split internal dashboard into two vessels:
  - `metabob-internal-dashboard-ui`: Pure UI rendering vessel (WebSocket server + React frontend)
  - `dashboard-executor-minibob`: Execution vessel for processing queries and creating UI impulses
- **Replace REST with MCP impulse resolution**: Remove `query_activity_api` tool and direct HTTP fetch calls; implement impulse-based data access via MCP
- **Implement capability registry**: Declare vessel capabilities for dynamic impulse routing
- **Create impulse types for dashboard domain**:
  - `queryInterfaceImpulse`: User query inputs
  - `queryResultImpulse`: Backend query results (replacing raw JSON returns)
  - `userActionImpulse`: Semantic user interactions (button clicks, selections)
  - `viewportStateImpulse`: Layout bounds and viewport metadata
- **Establish MCP endpoints**: Both vessels expose MCP servers for impulse resolution
- **Remove embedded MiniBob**: Dashboard-ui vessel delegates execution instead of running activities internally
- **Update WebSocket protocol**: Work with impulse references (IDs) instead of full content serialization

## Capabilities

### New Capabilities

- `impulse-resolution-mcp`: MCP-based impulse resolution pattern for vessel-to-vessel communication (replaces REST)
- `vessel-capability-registry`: Dynamic vessel discovery and routing based on declared impulse shape capabilities
- `dashboard-ui-vessel`: Thin UI rendering vessel that resolves `ui_component`, `query_interface`, `viewport_state` impulses
- `dashboard-executor-vessel`: Execution vessel that processes user queries, delegates to data vessels, creates UI impulses
- `dashboard-impulse-types`: Domain-specific impulse types for dashboard interactions (queryInterface, queryResult, userAction, viewportState)
- `impulse-reference-protocol`: WebSocket protocol using impulse IDs instead of full content serialization

### Modified Capabilities

- `minibob-integration`: Changes from embedded library to delegated execution via MCP (implementation detail, not spec-level change)

## Impact

**Code Changes:**
- `repos/metabob-internal-dashboard/`: Complete restructure into UI-only vessel
- New repo: `repos/dashboard-executor-minibob/`: Execution vessel with GoalProcessor
- `repos/metabob-proto/`: New impulse type definitions and vessel capability registry
- `helm/charts/`: New chart for dashboard-executor-minibob, updated internal-dashboard chart

**API Changes:**
- **BREAKING**: Remove HTTP endpoints from internal dashboard (replaced with MCP)
- New MCP endpoints: Both vessels expose `/mcp` for impulse resolution
- WebSocket message format changes: Use impulse IDs instead of full content

**Dependencies:**
- metabob-internal-dashboard: Remove `@metabob/minibob` dependency
- dashboard-executor-minibob: Depends on `@metabob/minibob` library
- Both: Depend on `@metabob/proto` for shared impulse types

**System Architecture:**
- Vessel topology changes: 1 monolithic vessel → 2 specialized vessels
- New communication paths: UI vessel ↔ executor vessel ↔ activity-db vessel
- Capability-based routing via registry (affects all vessel interactions)

**Deployment:**
- Two separate Kubernetes deployments and services
- Istio routing updated for new MCP endpoints
- Environment variables reorganized between vessels

**Data Flow:**
- Before: User → Dashboard (embedded MiniBob) → REST fetch → Activity API
- After: User → Dashboard-UI → MCP → Dashboard-Executor → MCP → Activity-DB vessel
