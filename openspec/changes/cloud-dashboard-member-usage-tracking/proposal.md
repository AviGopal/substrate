## Why

The cloud dashboard at app.metabob.com currently lacks visibility into member management, usage tracking, and execution activity. Users need to manage organization members, track API key usage, monitor execution traces, and understand what goals MiniBob is pursuing and how they're being achieved. Without these capabilities, the dashboard provides limited value for team collaboration and system observability.

## What Changes

- Add member management UI for inviting, removing, and managing organization members with role-based access
- Add API key management with usage tracking by member, including token consumption and cost metrics
- Add execution traces view showing activity history, success/failure patterns, and goal-seeking behavior
- Add usage analytics dashboard with trends over time, broken down by member and activity type
- Add real-time activity feed showing current MiniBob executions and their progress
- Remove unused pages: Overview, Projects, Issues, DevelopmentEvents, ValueImpact, Analysis
- Integrate with activity-api backend for execution traces and metrics
- Integrate with identity-vessel for member management and RBAC

## Capabilities

### New Capabilities
- `member-management`: Organization member invitation, role assignment, and removal with JWT-based authentication
- `usage-tracking`: Token consumption, cost tracking, and usage analytics by member and time period
- `execution-visibility`: Real-time and historical view of activity executions, goal paths, and Thompson Sampling decisions
- `activity-feed`: Live streaming feed of MiniBob activity execution events via WebSocket

### Modified Capabilities
<!-- No existing capabilities are being modified at the requirement level -->

## Impact

**Frontend (repos/metabob-cloud-dashboard)**:
- Remove 6 unused page components
- Add 4 new page components (Members, Usage, Executions, ActivityFeed)
- Update navigation and routing
- Add WebSocket client for real-time updates
- Add new API client methods for member and usage endpoints

**Backend Integration**:
- Requires new endpoints in identity-vessel for member management
- Consumes existing activity-api endpoints for execution traces and metrics
- Requires WebSocket authentication flow for activity feed

**Database**:
- No schema changes needed (uses existing SurrealDB tables: activity_execution_trace, activity_metrics, user, organization_member)

**Authentication**:
- Dashboard must support both JWT (users) and API key (IDE integrations) authentication flows
- Member management actions require admin role verification
