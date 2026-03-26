# metabob-cloud-dashboard - Tasks

**Status:** In Progress
**Created:** 2026-03-23
**Updated:** 2026-03-25

---

## Phase 1: Foundation (Completed)

- [x] **DASH-1: Project Setup and Configuration** - Initialize Bun + React 19 + Tailwind CSS v4 + shadcn/ui (already exists in repos/metabob-cloud-dashboard)
- [x] **DASH-3a: Login Page** - Implement login page with form validation and JWT authentication (already implemented in App.tsx)
- [x] **DASH-13a: Docker and Helm Chart** - Create Dockerfile and Helm chart for Kubernetes deployment (already created)

## Phase 2: API Client Layer

- [x] **DASH-2a: Create API client base** - Create `src/lib/api/client.ts` with fetch wrapper, JWT header injection, and error handling
- [x] **DASH-2b: Analysis API client** - Create `src/lib/api/analysis-api.ts` for auth, projects, problems endpoints
- [x] **DASH-2c: Activity API client** - Create `src/lib/api/activity-api.ts` for activities, executions, templates
- [x] **DASH-2d: TypeScript interfaces** - Create `src/types/api.ts` with shared interfaces (User, Project, Problem, Activity, Execution)

## Phase 3: Authentication and Layout

- [x] **DASH-3b: Auth context and hook** - Create `src/hooks/useAuth.tsx` with login, logout, and token management
- [x] **DASH-3c: Main layout shell** - Create `src/components/Layout.tsx` with header, sidebar, content area
- [x] **DASH-3d: Header component** - Create `src/components/Header.tsx` with logo, user menu, connection status
- [x] **DASH-3e: Sidebar navigation** - Create `src/components/Sidebar.tsx` with navigation links
- [x] **DASH-3f: Protected routes** - Add route guards that redirect to login when unauthenticated

## Phase 4: Overview Dashboard

- [x] **DASH-4a: Overview page** - Create `src/pages/Overview.tsx` with metrics grid and activity timeline
- [x] **DASH-4b: MetricCard component** - Create `src/components/MetricCard.tsx` for displaying KPIs
- [x] **DASH-4c: ActivityTimeline component** - Create `src/components/ActivityTimeline.tsx` for recent events
- [x] **DASH-4d: useMetrics hook** - Create `src/hooks/useMetrics.ts` to fetch and aggregate metrics from APIs

## Phase 5: Projects and Issues

- [x] **DASH-6a: Projects list page** - Create `src/pages/Projects.tsx` with project cards/table
- [x] **DASH-6b: Project CRUD** - Implement create, edit, delete project functionality
- [x] **DASH-6c: useProjects hook** - Create `src/hooks/useProjects.ts` for project data management
- [x] **DASH-7a: Issues table page** - Create `src/pages/Issues.tsx` with filterable issues table
- [x] **DASH-7b: Issue filters** - Create `src/components/IssueFilters.tsx` with severity, status, search filters
- [x] **DASH-7c: Issue detail view** - Create `src/pages/IssueDetail.tsx` with code context and actions
- [x] **DASH-7d: useIssues hook** - Create `src/hooks/useIssues.ts` for issues fetching with pagination

## Phase 6: Real-time Features

- [x] **DASH-5a: Events stream page** - Create `src/pages/DevelopmentEvents.tsx` with live activity feed
- [x] **DASH-5b: WebSocket hook** - Create `src/hooks/useWebSocket.ts` with reconnection logic
- [x] **DASH-10a: Connection status** - Create `src/components/ConnectionStatus.tsx` with visual indicator
- [x] **DASH-10b: Polling fallback** - Implement polling fallback when WebSocket unavailable

## Phase 7: Additional Features

- [x] **DASH-8a: API Keys page** - Create `src/pages/APIKeys.tsx` for key management
- [x] **DASH-8b: Key creation flow** - Implement secure key display with copy-once pattern
- [x] **DASH-9a: Value & Impact page** - Create `src/pages/ValueImpact.tsx` with metrics charts
- [x] **DASH-9b: Performance chart** - Create template success rate chart component

## Phase 8: Polish and Testing

- [x] **DASH-11a: Error boundary** - Create `src/components/ErrorBoundary.tsx` for React error catching
- [x] **DASH-11b: Loading skeletons** - Create `src/components/LoadingSkeleton.tsx` for async content
- [x] **DASH-11c: Toast notifications** - Add toast system for user feedback
- [x] **DASH-12a: Responsive design** - Ensure mobile/tablet compatibility with hamburger menu
- [x] **DASH-12b: Keyboard navigation** - Add keyboard shortcuts for common actions
- [x] **DASH-14a: E2E test setup** - Set up Playwright test infrastructure
- [x] **DASH-14b: Critical path tests** - Write tests for login, overview, projects, issues
- [x] **DASH-15a: Bundle optimization** - Implement code splitting and lazy loading
- [x] **DASH-15b: Performance monitoring** - Add performance metrics collection

---

## Phase 9: API Integration & E2E Validation

- [x] **DASH-16a: API Keys backend endpoints** - Added `/v2/api-keys` endpoints to metabob-analysis-api
- [x] **DASH-16b: Quality trend endpoint** - Added `/v2/activities/metrics/trend` to metabob-activity-api
- [x] **DASH-16c: Metrics summary endpoint** - Added `/v2/activities/metrics/summary` to metabob-activity-api
- [x] **DASH-17a: API keys client** - Created `src/lib/api/api-keys.ts` for API key management
- [x] **DASH-17b: Quality trend client** - Added `getQualityTrend()` and `getTemplatePerformance()` to activity-api client
- [x] **DASH-18a: Wire APIKeys page** - Connected APIKeys.tsx to real API (removed mock data)
- [x] **DASH-18b: Wire ValueImpact page** - Connected ValueImpact.tsx to real API (removed mock data)
- [x] **DASH-19a: Test data seeding script** - Created `scripts/seed-test-data.ts` for E2E test data
- [x] **DASH-19b: Playwright fixtures** - Created `e2e/fixtures/test-data.ts` with test constants
- [x] **DASH-19c: Global setup/teardown** - Created `e2e/global-setup.ts` and `e2e/global-teardown.ts`
- [x] **DASH-20a: Overview E2E tests** - Enhanced overview.spec.ts with real data assertions
- [x] **DASH-20b: Projects E2E tests** - Enhanced projects.spec.ts with CRUD and search tests
- [x] **DASH-20c: Issues E2E tests** - Enhanced issues.spec.ts with filtering and status tests
- [x] **DASH-20d: API Keys E2E tests** - Created api-keys.spec.ts for key management flows
- [x] **DASH-20e: Events E2E tests** - Created events.spec.ts for event stream tests
- [x] **DASH-20f: Value Impact E2E tests** - Created value-impact.spec.ts for metrics tests
- [x] **DASH-21a: User flows documentation** - Created specs/user-flows.md with detailed flows
- [x] **DASH-21b: Schema enhancement** - Added api_keys fields (name, prefix, status) to SurrealDB

---

## Summary

**Total Tasks:** 56
**Completed:** 56 ✓

All tasks complete. Dashboard has real API integration and comprehensive E2E tests.

### Running E2E Tests

```bash
cd repos/metabob-cloud-dashboard

# Install dependencies
bun install

# Seed test data (requires SurrealDB running)
bun run scripts/seed-test-data.ts

# Run E2E tests
bun run test:e2e

# Run with UI for debugging
bun run test:e2e:ui
```

### Test User Credentials

- Email: `test@metabob.local`
- Password: `testpass123`
- Organization: E2E Test Organization

Ready for archive.
