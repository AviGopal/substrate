# Cloud Dashboard Implementation - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** New Component
**Dependencies:** analysis-api-extraction

---

## Problem Statement

The existing `repos/metabob-dashboard` (MUI-based React 18) is:
1. **Tightly coupled** to deprecated `repos/metabob-rpc-api` (Python)
2. **Heavy dependencies** (MUI + Emotion + Redux = large bundle)
3. **Missing features** for new architecture (progressive sync, value measurement, multi-API integration)
4. **Deployment complexity** (react-scripts, manual build process)

As we extract analysis capabilities into TypeScript/Bun components (`metabob-analysis-api`, `metabob-mcp`), we need a dashboard that:
- Integrates with **all** backend APIs (analysis, activity, MCP)
- Provides unified observability for development events, projects, issues
- Enables org/user management, API key provisioning
- Visualizes progressive sync data and value metrics

## Proposed Solution

Build **metabob-cloud-dashboard** from scratch using modern stack:
- **React 19** (latest features, better performance)
- **shadcn/ui** (headless, composable, Tailwind-based)
- **Tailwind CSS v4** (zero-runtime, fast)
- **Bun.serve** (HTML imports, WebSocket, HMR)
- **TypeScript** (full type safety across all APIs)

### Key Features

1. **📊 Overview Dashboard** - High-level metrics from all systems
2. **🎯 Development Events** - Real-time activity stream (WebSocket + polling)
3. **📁 Project Management** - CRUD for org projects
4. **🔍 Issue Tracking** - Problems from analysis-api with filtering
5. **📈 Value & Impact** - Quality trends, template performance
6. **🔑 API Key Management** - User provisioning (1:1 user ↔ API key)
7. **📚 Knowledge Base** - Progressive sync data from metabob-mcp

### Architecture Principles

1. **Federated APIs** - Dashboard talks to 3 independent backends via Istio
2. **Shared Auth** - JWT from analysis-api, validated by all services
3. **Default Projects** - Every org has a default project (always exists)
4. **WebSocket Primary** - Real-time updates with polling fallback
5. **Shadcn Minimalism** - Keep Metabob color scheme, clean UI
6. **Type Safety** - Shared TypeScript interfaces across frontend/backend

## Scope

### In Scope (Phase 1)

**Core Pages:**
- Overview dashboard with metrics cards
- Development events (live stream)
- Projects list and details
- Issues table with filters
- API keys management

**Features:**
- User authentication (JWT)
- Organization context
- Default project handling
- WebSocket connection with reconnect
- Responsive layout (desktop-first)

**Integration:**
- metabob-analysis-api (auth, projects, problems, analytics)
- metabob-activity-api (activities, executions, impulses)
- Istio VirtualService routing

**Deployment:**
- Dockerized Bun.serve app
- Helm chart for Kubernetes
- HMR in development

### Out of Scope (Phase 1)

- Mobile-responsive design (desktop-first MVP)
- Advanced RBAC (beyond org-level isolation)
- Custom themes/dark mode
- Offline mode
- Progressive sync visualization (defer to Phase 2)
- Real-time collaboration features

### Explicitly Deferred

- Migration of existing dashboard state
- SSO integration (Google, GitHub)
- Advanced analytics (custom reports, exports)
- Notification system (email, Slack)
- Plugin system for custom widgets

## Success Criteria

1. **Functional Parity:** All 7 core features operational
2. **Performance:**
   - Initial page load < 2s
   - Navigation < 500ms
   - WebSocket latency < 100ms
3. **Deployment:** Successfully deploy to `dashboard.minibob.local`
4. **Integration:** All API endpoints working (analysis + activity)
5. **Type Safety:** Zero TypeScript errors
6. **Bundle Size:** < 500KB gzipped

## Non-Goals

- Not migrating old dashboard data (fresh start)
- Not achieving pixel-perfect MUI match (shadcn style acceptable)
- Not supporting IE11 or legacy browsers
- Not implementing every feature from old dashboard (focus on core)

## Dependencies

### Required Components
- `repos/metabob-analysis-api` (auth, users, projects, problems)
- `repos/metabob-activity-api` (activities, executions)
- `repos/metabob-mcp` (code understanding - read-only initially)
- SurrealDB 3.x (shared namespace: `activity_system`)
- Istio Gateway (routing to dashboard.minibob.local)

### External Dependencies
- React 19
- shadcn/ui components
- Tailwind CSS v4
- Bun runtime
- @types/node
- zod (validation)

### Shared Data Models
- User/APIKey (1:1 relationship)
- Organization (with default_project_id)
- Project (org's default always exists)
- ActivityExecution (from activity-api)
- AnalysisProblem (from analysis-api)
- JWT payload structure

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React 19 stability issues | Medium | Use stable features only, avoid experimental |
| WebSocket connection drops | High | Implement exponential backoff + polling fallback |
| API response time variability | Medium | Show loading states, implement request caching |
| Bundle size growth | Low | Code splitting, dynamic imports for heavy pages |
| Type mismatch between APIs | Medium | Shared types package, validation with Zod |
| Istio routing complexity | Low | Test routing early, document in deployment guide |

## Timeline Estimate

**Phase 1: Foundation (Week 1)**
- Project setup (Bun + React 19 + shadcn)
- API client layer (TypeScript interfaces)
- Authentication flow (JWT)
- Basic layout (Header, Sidebar)

**Phase 2: Core Features (Week 2)**
- Overview dashboard
- Projects page
- Issues page
- API Keys page

**Phase 3: Real-time (Week 3)**
- WebSocket connection
- Development events stream
- Live updates for issues/activities

**Phase 4: Deployment (Week 4)**
- Docker image
- Helm chart
- Istio VirtualService
- E2E testing

## Open Questions

1. Should we implement SSO in Phase 1 or defer?
   - **Recommendation:** Defer, use JWT-only initially
2. What's the refresh interval for polling fallback?
   - **Recommendation:** 5 seconds for events, 30s for metrics
3. Should dashboard have write access to metabob-mcp data?
   - **Recommendation:** Read-only initially, write in Phase 2
4. Do we need a dedicated API for dashboard, or direct API calls?
   - **Recommendation:** Direct calls, no aggregation layer
5. Should we implement caching in dashboard or rely on backend?
   - **Recommendation:** Simple client-side cache (5min TTL)

## Alternatives Considered

### Alternative 1: Migrate Existing Dashboard (MUI)
**Rejected:** Too much technical debt, MUI is heavy, hard to customize

### Alternative 2: Use Next.js instead of Bun.serve
**Rejected:** Bun.serve is simpler, faster, aligns with our stack

### Alternative 3: Build separate dashboards per API
**Rejected:** Fragments user experience, no unified view

### Alternative 4: Use external BI tool (Grafana, Metabase)
**Rejected:** Loses control over UX, doesn't support write operations

## References

- Existing dashboard: `repos/metabob-dashboard/`
- Analysis API spec: `openspec/changes/analysis-api-extraction/`
- Activity API: `repos/metabob-activity-api/`
- Deployment pattern: `helm/activity-system-minimal.yaml.gotmpl`
- Color scheme: `repos/metabob-dashboard/src/themes/Base.js`
