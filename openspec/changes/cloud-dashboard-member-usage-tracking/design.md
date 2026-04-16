## Context

The cloud dashboard (`repos/metabob-cloud-dashboard`) is a React 19 + Bun application that currently provides limited functionality: only API key management and settings pages are actively used. Six pages (Overview, Projects, Issues, DevelopmentEvents, ValueImpact, Analysis) were built for the legacy code analysis product and are now unused in the activity-based architecture.

The system has two backend services:
- **activity-api** (`repos/metabob-activity-api`): Learning backend with execution traces, Thompson Sampling, and metrics. Already provides `/v2/activities/execution-traces` and WebSocket at `/ws`.
- **identity-vessel** (separate repo): Authentication and user management. Currently handles JWT issuance and API key validation but lacks member management endpoints.

Current authentication flow: Users log in via dashboard → identity-vessel issues JWT → dashboard stores in sessionStorage → subsequent requests use JWT in Authorization header.

## Goals / Non-Goals

**Goals:**
- Provide comprehensive organization member management UI (invite, remove, role assignment)
- Display token usage and cost metrics by member and over time
- Show execution trace history with goal-seeking context and Thompson Sampling decisions
- Stream real-time activity execution events via WebSocket
- Remove technical debt (6 unused pages) to simplify codebase
- Integrate existing backend capabilities without requiring new database schemas

**Non-Goals:**
- Implementing new activity-api endpoints (execution traces and metrics already exist)
- Changing authentication mechanism (JWT and API key flows remain as-is)
- Adding SurrealDB schema migrations (all required tables exist: activity_execution_trace, activity_metrics, user, organization_member)
- Supporting multi-organization switching in dashboard (single org per user session)
- Historical data migration (usage tracking starts from dashboard deployment date)

## Decisions

### Decision 1: Remove unused pages vs hide them
**Choice:** Remove completely (delete components and routes)
**Rationale:** Unused code is maintenance debt. The pages reference analysis-api endpoints that no longer exist. Hiding would leave dead code and confusing navigation.
**Alternatives considered:**
- Hide via feature flags: Adds complexity, preserves technical debt
- Keep but disable: Still requires maintenance, confusing for new developers

### Decision 2: Member management backend location
**Choice:** Add member management endpoints to identity-vessel (not activity-api)
**Rationale:** Identity-vessel owns user and organization_member tables. Activity-api is for learning/execution, not identity management. Follows single-responsibility principle.
**Alternatives considered:**
- Add to activity-api: Violates separation of concerns, couples learning with identity
- New member-management service: Over-engineering for this scope

### Decision 3: Usage tracking data source
**Choice:** Aggregate from activity_execution_trace table (execution-level granularity)
**Rationale:** Execution traces already contain input_tokens, output_tokens, cost_usd, and user_id. No new data collection needed.
**Alternatives considered:**
- Real-time token counting: Requires new instrumentation, adds latency
- Separate usage_log table: Data duplication, synchronization complexity

### Decision 4: WebSocket connection strategy
**Choice:** Single WebSocket per dashboard session, reconnect with exponential backoff
**Rationale:** Activity-api already has WebSocket endpoint at /ws with JWT/API key auth. Single connection reduces server load. Exponential backoff prevents thundering herd on reconnects.
**Alternatives considered:**
- HTTP polling: Higher latency, more server load for real-time updates
- Server-Sent Events (SSE): Simpler but no bidirectional communication for future features

### Decision 5: Member attribution for usage tracking
**Choice:** Extract user_id from execution trace's authentication context
**Rationale:** Activity traces already store who initiated execution (via JWT claim or API key owner). No new user tracking needed.
**Alternatives considered:**
- Instrument MiniBob to send user_id: Requires MiniBob changes, error-prone
- Retroactive attribution: Cannot attribute historical data without user context

### Decision 6: Frontend state management
**Choice:** React Context API for auth, local useState for page-level state, React Query for server state
**Rationale:** Simple, matches existing dashboard patterns. Avoid introducing Redux/Zustand for limited state complexity.
**Alternatives considered:**
- Redux: Overkill for current scope, boilerplate heavy
- Zustand: Cleaner but adds new dependency for minimal benefit

### Decision 7: Cost calculation strategy
**Choice:** Client-side calculation from execution trace token counts using hardcoded model pricing
**Rationale:** Model pricing changes infrequently. Avoids backend pricing table. Client can update pricing without deployment.
**Alternatives considered:**
- Backend cost service: Over-engineering, adds latency
- Pricing API: External dependency, potential downtime

## Risks / Trade-offs

### Risk: Identity-vessel member management endpoints don't exist yet
**Mitigation:** Design assumes identity-vessel will provide standard REST endpoints for member CRUD. Implementation can proceed with mock data, then integrate once identity-vessel endpoints are ready. Alternatively, this change can include identity-vessel endpoint implementation as a sub-task.

### Risk: WebSocket connection drops during long-running executions
**Mitigation:** Implement exponential backoff reconnection. On reconnect, fetch missed events from execution trace API using last_seen timestamp. Store last event ID in browser localStorage to resume from correct position.

### Risk: High token usage crashes usage dashboard queries
**Mitigation:** Add pagination to usage queries (fetch data in chunks). Implement server-side aggregation if needed (future optimization). Start with 30-day default view, allow expanding to 90 days max.

### Risk: Member invitation spam or abuse
**Mitigation:** Identity-vessel should implement rate limiting (max 10 invitations per day per org). Frontend shows remaining invite quota. Invitations expire after 7 days.

### Trade-off: No real-time cost updates
**Impact:** Usage dashboard shows costs from completed executions only. Running executions don't contribute to cost until completion.
**Rationale:** Acceptable trade-off for simplicity. Real-time cost tracking requires streaming token counts during execution, adding complexity. Users can refresh page to see updated costs.

### Trade-off: Client-side model pricing is hardcoded
**Impact:** Pricing changes require dashboard redeployment.
**Rationale:** Model pricing changes are infrequent (quarterly at most). Simpler than maintaining pricing database. Can be extracted to config file later if needed.

### Trade-off: Historical executions may not have user attribution
**Impact:** Older execution traces created before user tracking may show as "Unknown" in usage breakdowns.
**Rationale:** Acceptable for initial release. Future improvement: backfill attribution for organization-wide executions.

## Migration Plan

### Phase 1: Remove unused pages (low risk)
1. Delete page components: Overview, Projects, Issues, DevelopmentEvents, ValueImpact, Analysis
2. Remove routes from App.tsx
3. Update navigation sidebar to remove links
4. Deploy to canary, verify no 404 errors from bookmarked URLs

### Phase 2: Add member management (requires identity-vessel changes)
1. Implement identity-vessel endpoints (if not already available):
   - `GET /v1/organizations/:id/members` - List members
   - `POST /v1/organizations/:id/invitations` - Send invitation
   - `DELETE /v1/organizations/:id/members/:userId` - Remove member
   - `PUT /v1/organizations/:id/members/:userId/role` - Change role
2. Add dashboard API client methods
3. Implement Members page UI
4. Deploy to canary, test with non-admin users to verify RBAC

### Phase 3: Add usage tracking
1. Implement usage API client methods (query execution traces with aggregation)
2. Create Usage page with charts (recharts library)
3. Add CSV export functionality
4. Deploy to canary, verify cost calculations match backend

### Phase 4: Add execution visibility
1. Implement Executions page with filtering and search
2. Add execution detail expansion
3. Link to activity dashboard (internal.metabob.com) for deeper analysis
4. Deploy to canary, verify performance with large trace counts

### Phase 5: Add real-time activity feed
1. Implement WebSocket client with authentication
2. Add ActivityFeed component (can be page or widget)
3. Implement reconnection logic with exponential backoff
4. Deploy to canary, test connection resilience

### Rollback Strategy
Each phase is independently deployable. Rollback process:
1. Revert to previous Git commit
2. Trigger CI/CD pipeline to redeploy
3. Verify health check endpoints return 200

Since no database schema changes are required, rollback is straightforward. Feature flags not needed since phases don't break existing functionality.

## Open Questions

1. **Identity-vessel member endpoints status**: Are member management endpoints already implemented in identity-vessel, or should this change include them?
   - **Resolution path**: Check identity-vessel repo or ask team. If not implemented, add identity-vessel implementation as sub-tasks.

2. **Activity dashboard integration level**: Should execution visibility page embed activity dashboard iframes, or just link to it?
   - **Recommendation**: Start with links, consider iframe embedding in future iteration if users request it.

3. **Usage data retention policy**: How long should execution trace data be retained for usage tracking?
   - **Current state**: Activity-api doesn't have retention policy. Usage dashboard shows all available data.
   - **Recommendation**: Implement 90-day retention policy in activity-api (separate change), usage dashboard adapts automatically.

4. **Multi-organization support**: Should dashboard support users with access to multiple organizations?
   - **Decision**: No (out of scope for this change). JWT contains single org_id. Multi-org switching would require identity-vessel changes and session management complexity.
