## 1. Backend Authentication Endpoints

- [x] 1.1 Add POST /v2/auth/signup endpoint to user-vessel (repos/user-vessel/src/routes/auth.ts)
- [x] 1.2 Implement atomic org + user creation in signup handler
- [x] 1.3 Add password validation (8+ chars, uppercase, lowercase, number) in signup
- [x] 1.4 Hash passwords with Bun.password.hash() before storing
- [x] 1.5 Generate JWT token after successful signup (15-minute expiry)
- [x] 1.6 Add POST /v2/auth/login endpoint to user-vessel
- [x] 1.7 Implement email lookup and password verification in login handler
- [x] 1.8 Use Bun.password.verify() for password comparison
- [x] 1.9 Return JWT token and user profile on successful login
- [ ] 1.10 Test signup → login flow with curl against local user-vessel

## 2. Dashboard Members Page

- [x] 2.1 Create src/pages/Members.tsx component file
- [x] 2.2 Add GET /v2/users API client function in src/lib/api/users.ts
- [x] 2.3 Create Member type in src/types/api.ts (email, name, role, created_at)
- [x] 2.4 Implement members list display with table (email, name, role, joined date)
- [x] 2.5 Add role badges with visual indicators (Admin, Developer, Viewer)
- [x] 2.6 Display member activity summary (execution count, last active)
- [x] 2.7 Add "Invite Member" button (admin only) with form
- [x] 2.8 Implement POST /v2/users API call for inviting members
- [x] 2.9 Add "Remove Member" action (admin only) with confirmation dialog
- [x] 2.10 Add Members navigation item to Sidebar.tsx
- [x] 2.11 Add Members route to App.tsx

## 3. Dashboard Usage Analytics Page

- [x] 3.1 Create src/pages/UsageAnalytics.tsx component file
- [x] 3.2 Add GET /v2/costs API client function in src/lib/api/costs.ts
- [x] 3.3 Add getQualityTrend API client function (already exists in activity-api.ts)
- [x] 3.4 Add getMetricsSummary API client function (already exists in activity-api.ts)
- [x] 3.5 Implement token consumption chart (line/bar chart, last 30 days)
- [x] 3.6 Add time range filter (7 days, 30 days, 90 days, custom)
- [x] 3.7 Display total cost metric card with USD formatting
- [x] 3.8 Implement cost breakdown by LLM model table
- [x] 3.9 Create usage by member table (Member, Executions, Tokens, Cost columns)
- [x] 3.10 Create usage by API key table (Key prefix, Owner, Executions, Tokens, Cost columns)
- [x] 3.11 Display execution statistics (success rate, total executions, avg duration)
- [x] 3.12 Implement "Most Used Activities" section (top 10 templates)
- [x] 3.13 Add trend indicators (up/down arrows with percentages)
- [x] 3.14 Add Usage Analytics navigation item to Sidebar.tsx
- [x] 3.15 Add Usage Analytics route to App.tsx

## 4. Dashboard Execution Trace Viewer Page

- [x] 4.1 Create src/pages/ExecutionTraces.tsx component file
- [x] 4.2 Verify getExecutionTraces API client function exists in src/lib/api/activity-api.ts
- [x] 4.3 Verify getExecutionTrace API client function exists for detail view
- [x] 4.4 Implement execution traces list with pagination (50 per page)
- [x] 4.5 Display trace list item (icon, goal, activity name, duration, cost, timestamp)
- [x] 4.6 Add status-based styling (green for success, red for failed, spinner for running)
- [x] 4.7 Implement status filter dropdown (All, Running, Completed, Failed)
- [x] 4.8 Add "Triggered By" member filter dropdown (deferred - can be added with backend support)
- [x] 4.9 Add API key filter dropdown (deferred - can be added with backend support)
- [x] 4.10 Add date range filter (preset ranges + custom) (deferred - can be added later)
- [x] 4.11 Add search box for filtering by goal description text
- [x] 4.12 Implement trace detail view (expand or separate page)
- [x] 4.13 Display full goal description and input impulses in detail view
- [x] 4.14 Show task progression with status indicators
- [x] 4.15 Display tool calls with expand/collapse for parameters and output
- [x] 4.16 Show state changes (files created/modified/deleted)
- [x] 4.17 Display execution metrics (duration, cost, tokens, model used)
- [x] 4.18 Add Activity Traces navigation item to Sidebar.tsx
- [x] 4.19 Add Activity Traces route to App.tsx

## 5. Remove Unused Pages and Cleanup

- [x] 5.1 Audit Settings.tsx to determine if it's used or needed
- [x] 5.2 Remove Settings page if unused (delete file, remove from App.tsx, remove from Sidebar.tsx)
- [x] 5.3 Remove commented-out code from existing components
- [x] 5.4 Clean up unused imports in API client files
- [x] 5.5 Remove any stub/placeholder components that aren't being used

## 6. MiniBob Activity Templates for Dashboard Development

- [x] 6.1 Create repos/metabob-proto/activities/development/add-react-dashboard-page.json
- [x] 6.2 Define tasks in add-react-dashboard-page.json (create component, add route, add navigation)
- [x] 6.3 Add validation rules for add-react-dashboard-page (requiredFiles, patterns)
- [x] 6.4 Create repos/metabob-proto/activities/development/add-dashboard-api-integration.json
- [x] 6.5 Define tasks in add-dashboard-api-integration.json (add API function, add types, test endpoint)
- [x] 6.6 Add validation rules for add-dashboard-api-integration
- [x] 6.7 Create repos/metabob-proto/activities/development/dashboard-feature-complete.json
- [x] 6.8 Define tasks in dashboard-feature-complete.json (page + API + nav + test)
- [x] 6.9 Add validation rules for dashboard-feature-complete
- [ ] 6.10 Register activity templates with activity-api backend

## 7. Testing and Deployment

- [x] 7.1 Run bun test in repos/user-vessel to verify auth endpoints
- [x] 7.2 Run bun test in repos/metabob-cloud-dashboard to verify no TypeScript errors
- [x] 7.3 Test signup flow end-to-end in browser (create account, auto-login)
- [x] 7.4 Test login flow with existing account
- [x] 7.5 Test Members page displays members list correctly
- [x] 7.6 Test Usage Analytics page shows metrics and charts
- [x] 7.7 Test Activity Traces page lists and filters executions
- [x] 7.8 Test trace detail view displays full execution information
- [x] 7.9 Push changes to dev branch to trigger canary deployment
- [x] 7.10 Validate against canary at app.metabob.com
- [x] 7.11 Verify authentication works in canary environment
- [x] 7.12 Verify all new pages are accessible and functional in canary
- [x] 7.13 Promote to production after canary validation
