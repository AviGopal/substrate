# Cloud Dashboard Implementation - OpenSpec Change

**Status:** Draft
**Type:** New Component
**Dependencies:** `analysis-api-extraction`

---

## What This Change Does

Builds **metabob-cloud-dashboard** - a unified observability and control interface for the Metabob ecosystem, integrating with all backend services (analysis, activity, MCP).

### Key Features

1. **📊 Overview Dashboard** - Org-wide metrics across projects
2. **🎯 Development Events** - Real-time stream (WebSocket + fallback)
3. **📁 Project Management** - CRUD with default project support
4. **🔍 Issue Tracking** - Problems from analysis with filtering
5. **📈 Value & Impact** - Quality trends and template performance
6. **🔑 API Key Management** - 1:1 user/key provisioning
7. **📚 Knowledge Base** - Progressive sync data (future)

---

## Alignment with Existing Specs

### Dependencies

This change builds on top of `analysis-api-extraction`:
- **Shared SurrealDB**: Same namespace (`activity_system`) and database (`learning_loop`)
- **Auth Flow**: Uses JWT from metabob-analysis-api
- **Data Models**: Consumes schemas defined in analysis-api
- **Multi-Tenancy**: Org → Projects → Default Project hierarchy

### Architecture Integration

```
dashboard.minibob.local
    │
    ├──► metabob-analysis-api (auth, projects, problems)
    ├──► metabob-activity-api (activities, executions)
    └──► metabob-mcp (code understanding - read-only)
         All route through Istio Gateway
```

### Key Design Decisions

1. **Federated APIs**: Dashboard talks to 3 independent backends
2. **Centralized Auth**: JWT issued by analysis-api, validated by all
3. **Default Projects**: Every org has default_project_id (always exists)
4. **1:1 User/Key**: Username = API key name
5. **WebSocket Primary**: Real-time with polling fallback for reliability
6. **Shared Theme**: Metabob color scheme from existing dashboard

---

## Implementation Approach

### Technology Stack

- **React 19** (latest features, performance)
- **shadcn/ui** (headless components, Tailwind-based)
- **Tailwind CSS v4** (zero-runtime, fast)
- **Bun.serve** (HTML imports, WebSocket, HMR)
- **TypeScript** (full type safety)
- **Zod** (runtime validation)

### Directory Structure

```
repos/metabob-cloud-dashboard/
├── src/
│   ├── index.html          # Entry (Bun.serve)
│   ├── index.ts            # Server
│   ├── frontend.tsx        # React root
│   ├── App.tsx             # Main app
│   │
│   ├── components/         # Feature components
│   │   ├── ui/             # shadcn components
│   │   ├── layout/         # Layout components
│   │   ├── dev-events/     # Development events
│   │   ├── projects/       # Project management
│   │   ├── issues/         # Issue tracking
│   │   ├── api-keys/       # API key management
│   │   └── overview/       # Overview dashboard
│   │
│   ├── lib/
│   │   ├── api/            # API clients
│   │   ├── hooks/          # React hooks
│   │   └── stores/         # State management
│   │
│   └── types/              # TypeScript interfaces
│
├── Dockerfile
├── helm/                   # Helm chart
└── package.json
```

---

## Data Flow

### Authentication

```
1. User → POST /auth/login (analysis-api)
2. Response: { token: JWT, user, organization }
3. JWT contains: { user_id, username, org_id, default_project_id }
4. All requests: Authorization: Bearer <token>
```

### Default Project Handling

```
1. Org created → auto-create default project
2. Set org.default_project_id
3. API calls without project_id → use default_project_id
4. Dashboard shows default project with "Default" badge
```

### Real-Time Updates

```
Primary: WebSocket to ws://api.minibob.local/ws/dashboard
Fallback: Polling every 5s when WebSocket unavailable
Reconnect: Exponential backoff (1s, 2s, 4s, 8s, 16s max)
```

---

## How to Work on This

### 1. Read the Specs

Start with these files (in order):
1. `proposal.md` - Problem statement and scope
2. `design.md` - Architecture and detailed design
3. `specs/data-models/spec.md` - TypeScript interfaces
4. `specs/api-contracts/spec.md` - API endpoints (TODO)
5. `specs/deployment/spec.md` - Helm/Docker (TODO)

### 2. Check Dependencies

Ensure `analysis-api-extraction` is complete:
- metabob-analysis-api deployed
- SurrealDB tables created
- Auth endpoints working
- Projects endpoints working

### 3. Development Workflow

```bash
cd repos/metabob-cloud-dashboard

# Install dependencies
bun install

# Start dev server (HMR enabled)
bun run dev

# Open browser
# http://localhost:3000

# The dev server proxies to:
# - analysis.minibob.local (analysis API)
# - api.minibob.local (activity API)
```

### 4. Testing

```bash
# Unit tests
bun test

# E2E tests (requires all services running)
bun test:e2e

# Type checking
bun run typecheck
```

### 5. Deployment

```bash
# Build Docker image
docker build -t metabob-cloud-dashboard:latest .

# Deploy via Helm
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

---

## Deliverables

### Phase 1 (MVP)

- [x] Project setup (Bun + React 19 + shadcn)
- [ ] API client layer (analysis + activity)
- [ ] Authentication flow (JWT)
- [ ] Basic layout (Header, Sidebar)
- [ ] Overview dashboard
- [ ] Projects page (list, create, details)
- [ ] Issues page (table, filters, details)
- [ ] API Keys page (list, generate, usage)
- [ ] WebSocket connection
- [ ] Development events stream
- [ ] Docker image
- [ ] Helm chart
- [ ] E2E tests

### Phase 2 (Future)

- [ ] Value & Impact visualization
- [ ] Knowledge Base (progressive sync data)
- [ ] Advanced analytics (custom reports)
- [ ] Mobile-responsive design
- [ ] Dark mode toggle
- [ ] SSO integration

---

## Open Questions

See `proposal.md` for full list. Key questions:

1. **SSO in Phase 1?** → No, defer to Phase 2
2. **Polling interval?** → 5s for events, 30s for metrics
3. **Write access to MCP data?** → Read-only initially
4. **Dedicated aggregation API?** → No, direct API calls
5. **Client-side caching?** → Yes, 5min TTL

---

## Success Criteria

✅ All 7 core pages operational
✅ Performance: < 2s initial load, < 500ms navigation
✅ Deployment: Works on `dashboard.minibob.local`
✅ Integration: All API endpoints functional
✅ Type Safety: Zero TypeScript errors
✅ Bundle Size: < 500KB gzipped

---

## References

### Related OpenSpec Changes
- `analysis-api-extraction` - Backend APIs and schemas

### Existing Code
- `repos/metabob-dashboard/` - Old MUI dashboard (reference only)
- `repos/metabob-dashboard/src/themes/Base.js` - Color scheme
- `repos/metabob-activity-api/` - Activity API implementation
- `helm/activity-system-minimal.yaml.gotmpl` - Deployment pattern

### Documentation
- React 19: https://react.dev
- shadcn/ui: https://ui.shadcn.com
- Tailwind v4: https://tailwindcss.com
- Bun: https://bun.sh

---

## Getting Help

**Questions about:**
- **Architecture** → Read `design.md`
- **Data models** → Read `specs/data-models/spec.md`
- **API contracts** → Check `analysis-api-extraction` specs
- **Deployment** → See `helm/activity-system-minimal.yaml.gotmpl`
- **Styling** → Check Tailwind config in `design.md`

**Common Issues:**
- WebSocket not connecting → Check Istio routing
- Auth failing → Verify JWT from analysis-api
- Type errors → Regenerate types from schemas
- Bundle too large → Check dynamic imports
