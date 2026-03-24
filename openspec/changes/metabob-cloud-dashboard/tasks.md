# metabob-cloud-dashboard - Tasks

**Status:** Draft
**Created:** 2026-03-23
**Total Tasks:** 15
**Estimated Timeline:** Week 6 (5 days)

---

## Phase 1: Foundation (Days 1-2)

### DASH-1: Project Setup and Configuration
**Priority:** High
**Dependencies:** None
**Estimated Time:** 2-3 hours

**Objectives:**
- Initialize Bun + React 19 + Tailwind CSS v4 project structure
- Configure TypeScript with strict mode
- Set up shadcn/ui component library
- Configure build pipeline with Bun.build

**Deliverables:**
- `package.json` with all dependencies (React 19, shadcn/ui, Tailwind v4, Bun types)
- `tsconfig.json` with strict mode enabled
- `components.json` for shadcn/ui configuration
- `tailwind.config.ts` with Metabob color scheme
- `build.ts` script for production builds
- `.env.example` with required environment variables

**Validation:**
- `bun install` completes without errors
- `bun run dev` starts development server
- Hot module reload works correctly
- TypeScript compiles with zero errors

**Notes:**
- Reuse existing starter files in `repos/metabob-cloud-dashboard`
- Configure Metabob brand colors: primary blue (#2196F3), secondary purple
- Enable React 19 features (use, useFormStatus, useOptimistic)

---

### DASH-2: API Client Layer
**Priority:** High
**Dependencies:** DASH-1
**Estimated Time:** 3-4 hours

**Objectives:**
- Create TypeScript API clients for all three backends
- Define shared type interfaces (User, Organization, Project, Activity, Problem)
- Implement JWT authentication flow
- Add request/response interceptors for error handling
- Set up Zod schemas for runtime validation

**Deliverables:**
- `src/lib/api/analysis-api.ts` (auth, projects, problems, analytics)
- `src/lib/api/activity-api.ts` (activities, executions, impulses)
- `src/lib/api/mcp-api.ts` (code understanding endpoints)
- `src/types/api.ts` (shared TypeScript interfaces)
- `src/lib/api/client.ts` (base fetch wrapper with interceptors)
- `src/lib/validation.ts` (Zod schemas for API responses)

**API Endpoints to Integrate:**

**analysis-api:**
- `POST /auth/login` - User authentication
- `GET /auth/me` - Current user info
- `GET /projects` - List organization projects
- `GET /projects/:id` - Get project details
- `GET /projects/:id/problems` - List project problems
- `GET /analytics/metrics` - System-wide metrics

**activity-api:**
- `GET /v2/activities/templates` - List activity templates
- `GET /v2/activities/execution-traces` - List executions
- `POST /v2/activities/recommend` - Thompson Sampling recommendations
- `GET /v2/activities/composition/graph` - Composition patterns

**mcp-api:**
- `GET /repositories` - List indexed repositories
- `GET /knowledge/search` - Search knowledge base

**Validation:**
- All API client functions return typed responses
- Zod validation catches malformed responses
- JWT token automatically included in requests
- Error responses properly typed and handled
- Integration test connects to all 3 APIs successfully

**Notes:**
- Use native `fetch` (built into Bun)
- Store JWT in memory (not localStorage for security)
- Implement exponential backoff for retries
- Add request timeout (10s default)

---

### DASH-3: Authentication and Layout
**Priority:** High
**Dependencies:** DASH-2
**Estimated Time:** 4-5 hours

**Objectives:**
- Implement JWT-based authentication flow
- Create login page with form validation
- Build main application layout (header, sidebar, content area)
- Add navigation routing (react-router-dom equivalent or Bun routing)
- Implement protected route wrapper

**Deliverables:**
- `src/pages/Login.tsx` - Login form with email/password
- `src/components/Layout.tsx` - Main app layout
- `src/components/Header.tsx` - Top navigation bar
- `src/components/Sidebar.tsx` - Left navigation menu
- `src/hooks/useAuth.tsx` - Authentication context and hook
- `src/lib/routing.ts` - Route definitions and guards

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Header (Metabob logo, user menu)   │
├──────┬──────────────────────────────┤
│      │                              │
│ Side │  Main Content Area           │
│ bar  │  (dynamic route content)     │
│      │                              │
└──────┴──────────────────────────────┘
```

**Navigation Items:**
- Overview (dashboard icon)
- Development Events (activity icon)
- Projects (folder icon)
- Issues (alert icon)
- Value & Impact (chart icon)
- API Keys (key icon)

**Validation:**
- Login form validates email and password format
- JWT stored securely in memory
- Protected routes redirect to login when unauthenticated
- Header displays current user name and organization
- Sidebar highlights active route
- Logout clears JWT and redirects to login

**Notes:**
- Use shadcn/ui Button, Input, Label components
- Implement "Remember me" functionality
- Add loading states for authentication
- Display API connection status in header

---

## Phase 2: Core Features (Days 3-4)

### DASH-4: Overview Dashboard
**Priority:** High
**Dependencies:** DASH-3
**Estimated Time:** 3-4 hours

**Objectives:**
- Create high-level metrics dashboard combining all backend data
- Display key performance indicators (KPIs) in card grid
- Show recent activity timeline
- Add quick actions for common tasks

**Deliverables:**
- `src/pages/Overview.tsx` - Main dashboard page
- `src/components/MetricCard.tsx` - Reusable KPI card component
- `src/components/ActivityTimeline.tsx` - Recent events timeline
- `src/hooks/useMetrics.ts` - Fetch and aggregate metrics

**Metrics to Display:**
- Total projects (from analysis-api)
- Active issues count (from analysis-api)
- Activity executions today (from activity-api)
- Average success rate (from activity-api Thompson Sampling)
- Template library size (from activity-api)
- Knowledge base size (from mcp-api)

**Timeline Events:**
- Recent activity executions (last 10)
- New issues detected (last 5)
- Project updates (last 5)

**Validation:**
- All metrics load within 2 seconds
- Cards display loading skeletons while fetching
- Error states show retry button
- Timeline auto-refreshes every 30 seconds
- Clicking timeline item navigates to detail page

**Notes:**
- Use shadcn/ui Card component for metrics
- Implement responsive grid (4 columns on desktop, 1 on mobile)
- Cache metrics for 5 minutes client-side
- Show last updated timestamp

---

### DASH-5: Development Events Stream
**Priority:** High
**Dependencies:** DASH-3, DASH-4
**Estimated Time:** 5-6 hours

**Objectives:**
- Implement real-time WebSocket connection to activity-api
- Display live activity execution stream
- Add filtering by category, status, time range
- Implement polling fallback when WebSocket unavailable
- Show execution details on click

**Deliverables:**
- `src/pages/DevelopmentEvents.tsx` - Events stream page
- `src/components/EventCard.tsx` - Individual event display
- `src/components/EventFilters.tsx` - Filter controls
- `src/hooks/useWebSocket.ts` - WebSocket connection manager
- `src/hooks/useEventStream.ts` - Event stream with fallback

**WebSocket Events:**
- `activity.started` - Execution began
- `activity.task_completed` - Task finished
- `activity.completed` - Full execution finished
- `activity.failed` - Execution failed
- `metrics.updated` - System metrics changed

**Filters:**
- Category: feature, bugfix, refactor, tool, infrastructure
- Status: running, completed, failed
- Time range: last hour, today, this week, all
- Search: filter by activity name or description

**Validation:**
- WebSocket connects on page load
- Events appear in real-time (< 500ms latency)
- Reconnection works after network interruption (exponential backoff)
- Polling fallback activates when WebSocket fails (5s interval)
- Filters update stream instantly
- Clicking event shows execution trace details

**Notes:**
- Use Bun.serve WebSocket support
- Store last 100 events client-side
- Implement virtual scrolling for performance
- Add "pause stream" toggle
- Show connection status indicator

---

### DASH-6: Project Management
**Priority:** High
**Dependencies:** DASH-3
**Estimated Time:** 4-5 hours

**Objectives:**
- Display organization projects in table/grid view
- Implement project CRUD operations
- Show project details page with statistics
- Handle default project properly (always exists, cannot be deleted)

**Deliverables:**
- `src/pages/Projects.tsx` - Projects list page
- `src/pages/ProjectDetail.tsx` - Single project view
- `src/components/ProjectCard.tsx` - Project display card
- `src/components/ProjectForm.tsx` - Create/edit project form
- `src/hooks/useProjects.ts` - Projects data management

**Project List Features:**
- Grid or table view toggle
- Sort by name, created date, issue count
- Search by project name
- Create new project button
- Edit/delete actions (except default project)

**Project Detail Page:**
- Project metadata (name, description, created date)
- Statistics: total issues, resolved issues, open issues
- Recent activity executions for this project
- List of associated problems from analysis-api

**Validation:**
- Projects load and display correctly
- Creating project adds to list immediately (optimistic update)
- Editing project updates display
- Default project has "Default" badge and no delete option
- Deleting project shows confirmation modal
- All mutations update backend via analysis-api

**Notes:**
- Use shadcn/ui Table, Dialog, Form components
- Implement optimistic updates with rollback on error
- Show loading states during mutations
- Validate project name is unique

---

### DASH-7: Issue Tracking
**Priority:** High
**Dependencies:** DASH-3, DASH-6
**Estimated Time:** 4-5 hours

**Objectives:**
- Display problems/issues from analysis-api in filterable table
- Show issue severity, category, status
- Implement multi-level filtering and search
- Provide issue detail view with code context

**Deliverables:**
- `src/pages/Issues.tsx` - Issues table page
- `src/components/IssueRow.tsx` - Table row component
- `src/components/IssueFilters.tsx` - Advanced filter panel
- `src/pages/IssueDetail.tsx` - Issue detail view
- `src/hooks/useIssues.ts` - Issues data fetching and filtering

**Table Columns:**
- Severity (critical, high, medium, low)
- Category (security, performance, maintainability, etc.)
- Title/Description
- Project name
- File path
- Status (open, resolved, ignored)
- Created date

**Filters:**
- Project (dropdown, multi-select)
- Severity (checkboxes)
- Category (checkboxes)
- Status (radio buttons)
- Date range (date picker)
- Search: full-text search in title/description

**Issue Detail View:**
- Full problem description
- Code snippet with line numbers
- File path with link to repository
- Suggested fix (if available)
- History of status changes
- Related issues

**Validation:**
- Table supports pagination (50 items per page)
- Filters update URL query params
- Sorting works on all columns
- Search debounced (300ms)
- Issue detail shows syntax-highlighted code
- Status changes persist to backend

**Notes:**
- Use shadcn/ui Table, Select, Checkbox components
- Implement server-side pagination
- Cache filter state in URL
- Show issue count badge in header

---

### DASH-8: API Key Management
**Priority:** Medium
**Dependencies:** DASH-3
**Estimated Time:** 3-4 hours

**Objectives:**
- Display organization API keys (1:1 with users)
- Create new API keys for users
- Revoke existing keys
- Show key usage statistics
- Implement secure key display (copy-once pattern)

**Deliverables:**
- `src/pages/APIKeys.tsx` - API keys management page
- `src/components/APIKeyCard.tsx` - Key display component
- `src/components/CreateAPIKeyForm.tsx` - Key creation form
- `src/hooks/useAPIKeys.ts` - API key data management

**API Key Display:**
- User name (associated with key)
- Key prefix (first 8 characters)
- Created date
- Last used timestamp
- Usage count
- Status (active, revoked)
- Actions: view full key (once), revoke

**Create Key Flow:**
1. Enter user email
2. Generate key (backend)
3. Display full key with copy button
4. Warning: "Save this key now, you won't see it again"
5. After closing, only show prefix

**Validation:**
- Only organization admins can create/revoke keys
- Full key shown only once after creation
- Copy to clipboard works
- Revoke shows confirmation dialog
- Revoked keys marked as inactive (not deleted)

**Notes:**
- Use shadcn/ui Dialog, Button, Input components
- Implement copy-to-clipboard with visual feedback
- Show warning icons for unused keys (30+ days)
- Add audit log for key creation/revocation

---

## Phase 3: Integration and Polish (Day 5)

### DASH-9: Value & Impact Metrics
**Priority:** Medium
**Dependencies:** DASH-4
**Estimated Time:** 3-4 hours

**Objectives:**
- Display template performance trends over time
- Show quality metrics from analysis-api
- Visualize Thompson Sampling learning progress
- Chart activity composition patterns

**Deliverables:**
- `src/pages/ValueImpact.tsx` - Metrics and charts page
- `src/components/PerformanceChart.tsx` - Template success rate chart
- `src/components/QualityTrends.tsx` - Issue count over time
- `src/components/CompositionGraph.tsx` - Activity composition visualization
- `src/hooks/useAnalytics.ts` - Analytics data fetching

**Charts to Implement:**

1. **Template Performance** (line chart)
   - X-axis: Time (last 7/30/90 days)
   - Y-axis: Success rate percentage
   - Multiple lines for different activity categories

2. **Quality Trends** (area chart)
   - X-axis: Time
   - Y-axis: Issue count
   - Stacked by severity level

3. **Thompson Sampling Learning** (scatter plot)
   - X-axis: Exploration vs exploitation ratio
   - Y-axis: Average reward
   - Points: Different activity templates

4. **Composition Patterns** (directed graph)
   - Nodes: Activity templates
   - Edges: Composition relationships (A calls B)
   - Edge weight: Frequency

**Validation:**
- Charts load within 3 seconds
- Interactive tooltips show detailed data
- Time range selector updates all charts
- Drill-down: clicking chart element shows details
- Export data as CSV/JSON

**Notes:**
- Use lightweight charting library (recharts or Chart.js)
- Implement responsive chart sizing
- Cache analytics data for 10 minutes
- Add "last updated" timestamp

---

### DASH-10: WebSocket Integration and Fallback
**Priority:** High
**Dependencies:** DASH-5
**Estimated Time:** 3-4 hours

**Objectives:**
- Implement robust WebSocket connection management
- Add exponential backoff reconnection strategy
- Implement polling fallback for all real-time features
- Add connection status indicators across app
- Handle WebSocket authentication with JWT

**Deliverables:**
- `src/lib/websocket.ts` - WebSocket manager singleton
- `src/hooks/useRealtimeData.ts` - Real-time data hook with fallback
- `src/components/ConnectionStatus.tsx` - Status indicator component
- Enhanced `useWebSocket.ts` with reconnection logic

**Connection Management:**
- Automatic connection on app load
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- JWT passed via query param or initial message
- Heartbeat ping every 30s
- Graceful degradation to polling

**Polling Fallback:**
- Activate when WebSocket fails 5 consecutive times
- Poll intervals: events (5s), metrics (30s), issues (60s)
- Switch back to WebSocket when connection restored

**Connection Status Indicator:**
- Green dot: WebSocket connected
- Yellow dot: Polling fallback active
- Red dot: Disconnected (retrying)
- Display in header with tooltip

**Validation:**
- Connection survives network interruption
- Fallback activates automatically
- No duplicate events during fallback transition
- Status indicator updates immediately
- Reconnection logs visible in dev console

**Notes:**
- Use Bun WebSocket client
- Implement message queue for offline support
- Add user notification for prolonged disconnection
- Test with network throttling

---

### DASH-11: Error Handling and Loading States
**Priority:** Medium
**Dependencies:** DASH-1 through DASH-10
**Estimated Time:** 2-3 hours

**Objectives:**
- Implement consistent error boundaries throughout app
- Add loading skeletons for all async content
- Create error pages (404, 500, network error)
- Add retry mechanisms for failed requests
- Implement toast notifications for user feedback

**Deliverables:**
- `src/components/ErrorBoundary.tsx` - React error boundary
- `src/components/LoadingSkeleton.tsx` - Reusable skeleton components
- `src/pages/NotFound.tsx` - 404 error page
- `src/pages/ServerError.tsx` - 500 error page
- `src/components/Toast.tsx` - Toast notification system
- `src/lib/error-handler.ts` - Global error handler

**Error Scenarios:**
- Network timeout (show retry button)
- API 4xx errors (show user-friendly message)
- API 5xx errors (show generic error, log details)
- WebSocket disconnect (show status indicator)
- Validation errors (show field-specific messages)

**Loading States:**
- Page-level loading (full-page spinner)
- Component-level loading (skeleton cards/tables)
- Button loading (spinner in button)
- Infinite scroll loading (bottom spinner)

**Validation:**
- All async operations have loading states
- Errors don't crash the app (error boundary catches)
- Toast notifications appear and auto-dismiss (5s)
- Retry button works for failed requests
- Error details logged to console in dev mode

**Notes:**
- Use shadcn/ui Toast/Sonner component
- Implement error monitoring (console.error in dev)
- Add Sentry integration point (future)
- Create error message lookup table

---

### DASH-12: Responsive Design and Accessibility
**Priority:** Medium
**Dependencies:** DASH-1 through DASH-11
**Estimated Time:** 3-4 hours

**Objectives:**
- Ensure dashboard works on tablet and mobile devices
- Implement WCAG 2.1 AA accessibility standards
- Add keyboard navigation support
- Test with screen readers
- Optimize touch targets for mobile

**Deliverables:**
- Responsive breakpoints in Tailwind config
- Mobile-optimized navigation (hamburger menu)
- Touch-friendly button sizes (min 44x44px)
- ARIA labels on all interactive elements
- Keyboard shortcuts for common actions
- `src/hooks/useMediaQuery.ts` - Responsive layout hook

**Breakpoints:**
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md/lg)
- Desktop: > 1024px (xl)

**Responsive Adjustments:**
- Sidebar collapses to hamburger menu on mobile
- Table switches to card view on mobile
- Charts scale down gracefully
- Forms stack vertically on mobile

**Accessibility:**
- All images have alt text
- Form inputs have labels
- Color contrast ratio > 4.5:1
- Focus indicators visible
- Skip to main content link
- Semantic HTML (nav, main, aside, article)

**Keyboard Shortcuts:**
- `/` - Focus search
- `Esc` - Close modals
- Arrow keys - Navigate lists
- `Enter` - Activate buttons

**Validation:**
- Lighthouse accessibility score > 90
- Keyboard-only navigation works
- Screen reader announces all UI changes
- Touch targets meet minimum size
- Text remains readable when zoomed to 200%

**Notes:**
- Test with VoiceOver (macOS) and NVDA (Windows)
- Use shadcn/ui accessible components
- Add focus-visible styles
- Implement responsive image loading

---

## Phase 4: Deployment and Testing (Day 5)

### DASH-13: Docker and Kubernetes Deployment
**Priority:** High
**Dependencies:** DASH-1 through DASH-12
**Estimated Time:** 3-4 hours

**Objectives:**
- Create production-optimized Docker image
- Write Helm chart for Kubernetes deployment
- Configure Istio VirtualService routing
- Set up environment-specific configurations
- Implement health check endpoints

**Deliverables:**
- `Dockerfile` - Multi-stage build for production
- `helm/charts/metabob-cloud-dashboard/` - Helm chart
- `helm/charts/metabob-cloud-dashboard/values.yaml` - Default values
- `helm/environments/dev.values.yaml` - Development overrides
- `.dockerignore` - Optimize build context
- `src/health.ts` - Health check endpoint

**Docker Image:**
- Multi-stage build (build → runtime)
- Base image: oven/bun:latest
- Production dependencies only
- Static asset optimization
- Image size < 200MB

**Helm Chart:**
- Deployment with 2 replicas
- Service (ClusterIP, port 3000)
- ConfigMap for environment variables
- Liveness/readiness probes
- Resource limits (500m CPU, 512Mi memory)
- HPA (2-10 replicas based on CPU)

**Istio Routing:**
- VirtualService for `dashboard.minibob.local`
- Gateway: istio-system/istio-ingressgateway
- CORS configuration for API calls
- Timeout: 30s for long-running requests

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `ACTIVITY_API_URL` - Backend URL
- `ANALYSIS_API_URL` - Analysis backend URL
- `MCP_API_URL` - MCP backend URL
- `WS_ENABLED` - Enable WebSocket (default: true)
- `NODE_ENV` - Environment (production/development)

**Health Endpoints:**
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes API connectivity)

**Validation:**
- Docker build completes < 5 minutes
- Image runs locally with `docker run`
- Helm install succeeds on dev cluster
- Dashboard accessible via Istio Gateway
- Health checks return 200 OK
- Pod auto-scales under load

**Notes:**
- Use helmfile for deployment automation
- Tag images with git commit SHA
- Implement rolling update strategy
- Add deployment smoke tests

---

### DASH-14: End-to-End Testing
**Priority:** High
**Dependencies:** DASH-13
**Estimated Time:** 4-5 hours

**Objectives:**
- Write Playwright tests for critical user flows
- Test all API integrations
- Validate WebSocket functionality
- Test responsive behavior
- Implement CI/CD pipeline

**Deliverables:**
- `tests/e2e/login.spec.ts` - Authentication flow
- `tests/e2e/overview.spec.ts` - Overview dashboard
- `tests/e2e/projects.spec.ts` - Project CRUD
- `tests/e2e/issues.spec.ts` - Issue filtering
- `tests/e2e/events.spec.ts` - Real-time events
- `.github/workflows/test.yml` - CI pipeline
- `tests/setup.ts` - Test environment setup

**Test Scenarios:**

1. **Authentication**
   - Login with valid credentials
   - Login failure handling
   - Logout and session cleanup
   - Protected route redirection

2. **Overview Dashboard**
   - Metrics load correctly
   - Timeline displays events
   - Quick actions work

3. **Projects**
   - Create new project
   - Edit project name
   - Delete project (with confirmation)
   - Default project protection

4. **Issues**
   - Filter by severity
   - Search functionality
   - Pagination
   - Issue detail view

5. **Real-time Events**
   - WebSocket connection
   - Event stream updates
   - Reconnection after disconnect

**CI/CD Pipeline:**
- Trigger on: push to main, pull requests
- Steps:
  1. Install dependencies (bun install)
  2. Type check (bun run typecheck)
  3. Build production (bun run build)
  4. Run E2E tests (bun playwright test)
  5. Build Docker image
  6. Push to registry (if main branch)

**Validation:**
- All tests pass consistently (no flakiness)
- Test coverage > 70% for critical paths
- CI pipeline completes < 10 minutes
- Failed tests provide actionable errors
- Tests run in headless mode

**Notes:**
- Use Playwright MCP integration for browser automation
- Mock external API calls where appropriate
- Run tests against local k8s deployment
- Implement visual regression testing

---

### DASH-15: Performance Optimization and Bundle Analysis
**Priority:** Medium
**Dependencies:** DASH-13, DASH-14
**Estimated Time:** 2-3 hours

**Objectives:**
- Analyze and optimize JavaScript bundle size
- Implement code splitting for routes
- Optimize asset loading (images, fonts)
- Add performance monitoring
- Ensure bundle size < 500KB gzipped

**Deliverables:**
- `bundle-analysis.md` - Bundle size report
- Optimized `build.ts` with code splitting
- `src/lib/performance.ts` - Performance monitoring
- Lazy-loaded route components
- Optimized image loading strategy

**Optimization Techniques:**

1. **Code Splitting**
   - Dynamic imports for route components
   - Lazy load heavy dependencies (charts library)
   - Separate vendor bundle

2. **Asset Optimization**
   - Compress images (WebP format)
   - Subset fonts (only used characters)
   - Inline critical CSS
   - Preload key resources

3. **Runtime Optimization**
   - Memoize expensive computations
   - Debounce search inputs
   - Virtual scrolling for long lists
   - Optimize React re-renders

4. **Caching Strategy**
   - Service worker for offline support
   - Cache API responses (5-10 min TTL)
   - Cache static assets (long TTL)

**Bundle Size Targets:**
- Initial JS: < 200KB gzipped
- Total JS (all routes): < 500KB gzipped
- CSS: < 50KB gzipped
- Images: < 100KB total

**Performance Metrics:**
- First Contentful Paint (FCP): < 1.5s
- Time to Interactive (TTI): < 3.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

**Validation:**
- Lighthouse performance score > 90
- Bundle size meets targets
- Page navigation < 500ms
- No layout shifts during load
- Memory usage < 100MB

**Deliverables:**
- Bundle analysis report with before/after sizes
- Performance monitoring dashboard
- Optimization recommendations document

**Notes:**
- Use Bun's built-in bundler for optimal performance
- Implement progressive enhancement
- Test on slow 3G network
- Monitor Core Web Vitals in production

---

## Summary

**Total Tasks:** 15
**Timeline:** 5 days (Week 6)
**Priority Breakdown:**
- High: 10 tasks
- Medium: 5 tasks

**Phase Distribution:**
- Phase 1 (Foundation): 3 tasks - Days 1-2
- Phase 2 (Core Features): 5 tasks - Days 3-4
- Phase 3 (Integration): 4 tasks - Day 5
- Phase 4 (Deployment): 3 tasks - Day 5

**Key Dependencies:**
- External: `metabob-analysis-api` (auth, projects, problems)
- Internal: Sequential foundation → features → integration → deployment
- Infrastructure: Kubernetes cluster, SurrealDB, Istio Gateway

**Success Metrics:**
- All 7 core features operational
- Bundle size < 500KB gzipped
- Lighthouse performance score > 90
- Lighthouse accessibility score > 90
- E2E test coverage > 70%
- Deployment to `dashboard.minibob.local` successful

**Risk Mitigation:**
- Start with authentication and API client (critical path)
- Implement WebSocket with polling fallback early
- Test deployment incrementally (local → dev → staging)
- Use feature flags for gradual rollout
- Monitor performance metrics continuously
