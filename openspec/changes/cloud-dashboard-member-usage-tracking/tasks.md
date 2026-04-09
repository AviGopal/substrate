## 1. Remove Unused Pages

- [ ] 1.1 Delete Overview.tsx, Projects.tsx, Issues.tsx, DevelopmentEvents.tsx, ValueImpact.tsx, Analysis.tsx from src/pages/
- [ ] 1.2 Remove unused routes from App.tsx (keep only api-keys, settings, login, signup)
- [ ] 1.3 Update Sidebar.tsx navigation to remove links to deleted pages
- [ ] 1.4 Remove unused hooks: useProjects.ts, useIssues.ts, useMetrics.ts if not needed elsewhere
- [ ] 1.5 Test navigation and verify no 404 errors or broken links

## 2. Member Management Backend Integration

- [ ] 2.1 Verify identity-vessel endpoints exist: GET /v1/organizations/:id/members, POST /v1/organizations/:id/invitations, DELETE /v1/organizations/:id/members/:userId, PUT /v1/organizations/:id/members/:userId/role
- [ ] 2.2 Create src/lib/api/identity-api.ts with member management client methods
- [ ] 2.3 Add TypeScript types for Member, Invitation, Role in src/types/api.ts
- [ ] 2.4 Implement error handling for identity-vessel API responses

## 3. Members Page Implementation

- [ ] 3.1 Create src/pages/Members.tsx component with member list display
- [ ] 3.2 Add member invitation form with email input and role dropdown (admin, member, viewer)
- [ ] 3.3 Implement member row component showing email, role, join date, and action buttons
- [ ] 3.4 Add remove member confirmation dialog with "Cannot remove yourself" validation
- [ ] 3.5 Add change role dropdown with admin permission check
- [ ] 3.6 Add pending invitations section with resend/cancel actions
- [ ] 3.7 Update App.tsx routing to include members page
- [ ] 3.8 Update Sidebar.tsx to add "Members" navigation link (admin-only visibility)
- [ ] 3.9 Test with non-admin user account to verify RBAC enforcement

## 4. Usage Tracking API Integration

- [ ] 4.1 Add getExecutionTraces method to src/lib/api/activity-api.ts with date range and member filters
- [ ] 4.2 Create aggregation utilities in src/lib/usage-analytics.ts for token/cost calculations
- [ ] 4.3 Add model pricing constants (e.g., Claude Sonnet 4: $3 input / $15 output per million tokens)
- [ ] 4.4 Implement token-to-cost conversion function with model detection
- [ ] 4.5 Create CSV export utility function for usage data

## 5. Usage Page Implementation

- [ ] 5.1 Create src/pages/Usage.tsx component with summary cards (total cost, total tokens, active members)
- [ ] 5.2 Add date range picker with presets (Today, Last 7 Days, Last 30 Days, Custom)
- [ ] 5.3 Install recharts library: bun add recharts
- [ ] 5.4 Implement token usage trend line chart (daily granularity, last 30 days)
- [ ] 5.5 Add member breakdown table with columns: member name, tokens used, cost, execution count
- [ ] 5.6 Implement activity category pie chart (feature, bugfix, refactor, tool, infrastructure)
- [ ] 5.7 Add member filter dropdown to filter charts and tables
- [ ] 5.8 Add category filter dropdown
- [ ] 5.9 Implement CSV export button that downloads filtered data
- [ ] 5.10 Add loading skeletons for async data fetching
- [ ] 5.11 Update App.tsx routing to include usage page
- [ ] 5.12 Update Sidebar.tsx to add "Usage" navigation link

## 6. Execution Visibility Page Implementation

- [ ] 6.1 Create src/pages/Executions.tsx component with execution trace list
- [ ] 6.2 Implement execution row component showing template_name, status badge, start_time, duration, member, cost
- [ ] 6.3 Add expandable execution details showing goal, task results, tool calls
- [ ] 6.4 Implement status filter dropdown (All, Running, Completed, Failed)
- [ ] 6.5 Add category filter dropdown
- [ ] 6.6 Add member filter dropdown
- [ ] 6.7 Add date range picker for filtering by execution time
- [ ] 6.8 Implement search input with debouncing for goal/template/error text search
- [ ] 6.9 Add pagination with "Load More" button (fetch 50 executions per page)
- [ ] 6.10 Display Thompson Sampling decision metadata (templates considered, selection probability)
- [ ] 6.11 Show goal path information (current step, total steps, previous executions)
- [ ] 6.12 Add success rate summary cards by template
- [ ] 6.13 Group failed executions by error pattern
- [ ] 6.14 Add links to activity dashboard (internal.metabob.com) for template performance and composition graph
- [ ] 6.15 Update App.tsx routing to include executions page
- [ ] 6.16 Update Sidebar.tsx to add "Executions" navigation link

## 7. WebSocket Client Implementation

- [ ] 7.1 Create src/lib/websocket-client.ts with WebSocket connection manager
- [ ] 7.2 Implement authenticate message flow with JWT/API key token
- [ ] 7.3 Add exponential backoff reconnection logic (1s, 2s, 4s, 8s, max 30s)
- [ ] 7.4 Store last event ID in localStorage for resuming on reconnect
- [ ] 7.5 Implement event handlers for execution started, completed, failed, task started, task completed, tool call
- [ ] 7.6 Add connection state tracking (connected, reconnecting, disconnected)
- [ ] 7.7 Implement ping/pong heartbeat for keepalive

## 8. Activity Feed Component Implementation

- [ ] 8.1 Create src/components/ActivityFeed.tsx component
- [ ] 8.2 Connect to WebSocket on component mount and authenticate
- [ ] 8.3 Display connection status indicator (green/yellow/red badge)
- [ ] 8.4 Render execution started events with template name and goal
- [ ] 8.5 Render execution completed events with duration and cost
- [ ] 8.6 Render execution failed events with red indicator and error message
- [ ] 8.7 Render task-level progress updates as sub-items
- [ ] 8.8 Render tool call events with tool name and arguments summary
- [ ] 8.9 Implement auto-scroll to new events when viewing recent feed
- [ ] 8.10 Add "Scroll to top" button to load historical events from execution trace API
- [ ] 8.11 Add status filter toggle (Show only failures, Mute successes)
- [ ] 8.12 Add category filter dropdown
- [ ] 8.13 Create src/pages/ActivityFeed.tsx page that uses ActivityFeed component
- [ ] 8.14 Update App.tsx routing to include activity feed page
- [ ] 8.15 Update Sidebar.tsx to add "Activity Feed" navigation link

## 9. Styling and UX Polish

- [ ] 9.1 Add consistent loading states for all async operations
- [ ] 9.2 Implement error boundaries for each new page
- [ ] 9.3 Add empty states with helpful messages (e.g., "No executions yet - MiniBob hasn't run activities")
- [ ] 9.4 Ensure responsive design for mobile/tablet views
- [ ] 9.5 Add keyboard shortcuts documentation for new pages
- [ ] 9.6 Implement toast notifications for member management actions (invite sent, member removed, role changed)

## 10. Testing and Validation

- [ ] 10.1 Test member management with admin and non-admin users
- [ ] 10.2 Verify usage tracking calculations match backend execution trace data
- [ ] 10.3 Test WebSocket reconnection by killing connection (simulate network failure)
- [ ] 10.4 Test pagination and filtering performance with 1000+ execution traces
- [ ] 10.5 Test CSV export with large datasets
- [ ] 10.6 Verify multi-tenant isolation (users from different orgs see only their data)
- [ ] 10.7 Run bun test to ensure no regressions
- [ ] 10.8 Test with expired JWT to verify auto-redirect to login

## 11. Documentation and Deployment

- [ ] 11.1 Update repos/metabob-cloud-dashboard/README.md with new page descriptions
- [ ] 11.2 Update CLAUDE.md with removed pages and new capabilities
- [ ] 11.3 Deploy to canary environment (push to dev branch)
- [ ] 11.4 Verify canary health checks and manual QA
- [ ] 11.5 Create pull request for production promotion with screenshots
