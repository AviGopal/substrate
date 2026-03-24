# Cloud Dashboard Implementation - Design Document (Updated)

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23
**Dependencies:** analysis-api-extraction
**Changes:** Clarified metabob-mcp is NOT accessed by dashboard (local per-workspace only)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   External Access (Browser)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               Istio Gateway (activity-system)                    │
│  Routes:                                                         │
│  • dashboard.minibob.local → metabob-cloud-dashboard:3000       │
│  • analysis.minibob.local  → metabob-analysis-api:8080          │
│  • api.minibob.local       → metabob-activity-api:8080          │
└─────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Dashboard   │  │  Analysis API │  │  Activity API │
│   (Port 3000) │  │  (Port 8080)  │  │  (Port 8080)  │
│               │  │               │  │               │
│ Bun.serve()   │  │ • Auth (JWT)  │  │ • Activities  │
│ • HTML routes │  │ • Users/Orgs  │  │ • Executions  │
│ • WebSocket   │  │ • Projects    │  │ • Impulses    │
│ • Static      │  │ • Problems    │  │ • Sessions    │
│               │  │ • Analytics   │  │               │
│               │  │ • Sync data   │  │               │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                 ┌──────────────────┐
                 │  SurrealDB 3.x   │
                 │                  │
                 │  Namespace:      │
                 │  activity_system │
                 │                  │
                 │  Database:       │
                 │  learning_loop   │
                 └──────────────────┘
                           ▲
                           │ Sync push (HTTPS)
                           │ POST /v2/sync/*
                           │
┌──────────────────────────┴────────────────────────────────┐
│                                                           │
│  Development Workspaces (local, NOT in cluster)          │
│                                                           │
│  Workspace A          Workspace B          Workspace C   │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐ │
│  │ MiniBob +  │      │ MiniBob +  │      │OpenCode +  │ │
│  │metabob-mcp │      │metabob-mcp │      │metabob-mcp │ │
│  └────────────┘      └────────────┘      └────────────┘ │
│                                                           │
│  Each workspace has local metabob-mcp watching files     │
│  and pushing updates to analysis-api                      │
└───────────────────────────────────────────────────────────┘
```

**IMPORTANT:** Dashboard NEVER accesses metabob-mcp directly. metabob-mcp runs locally in each development workspace and is not deployed to the cluster.

---

## Data Flow Architecture

### Sync Progress Display Flow

```
┌──────────────────────────────────────────────────────────┐
│  Development Workspace (local)                           │
│                                                          │
│  MiniBob writes code → metabob-mcp detects change       │
│                     → Parse + embed + queue              │
│                     → Batch sync (every 30s)             │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ POST /v2/sync/components
                         │ POST /v2/sync/embeddings
                         │ POST /v2/sync/annotations
                         │ (reverse chrono, newest first)
                         ▼
         ┌───────────────────────────────────┐
         │  metabob-analysis-api             │
         │                                   │
         │  1. Validate session/project      │
         │  2. Insert into SurrealDB         │
         │  3. Update project.sync_status:   │
         │     {                             │
         │       files_indexed: +N,          │
         │       components_found: +N,       │
         │       embeddings_generated: +N,   │
         │       last_sync_at: now()         │
         │     }                             │
         └─────────────┬─────────────────────┘
                       │
                       ▼
         ┌───────────────────────────────────┐
         │  SurrealDB                        │
         │  • projects table                 │
         │    - sync_status object           │
         │  • code_components                │
         │  • embeddings                     │
         │  • annotations                    │
         └─────────────┬─────────────────────┘
                       │
                       │ Dashboard queries:
                       │ GET /auth/orgs/{org}/projects
                       │ (includes sync_status)
                       ▼
         ┌───────────────────────────────────┐
         │  metabob-cloud-dashboard          │
         │                                   │
         │  Displays sync metrics:           │
         │  • Files indexed: 1,247           │
         │  • Components found: 3,891        │
         │  • Embeddings generated: 3,891    │
         │  • Last sync: 2 minutes ago       │
         │                                   │
         │  (Shows WORK DONE, not %)         │
         └───────────────────────────────────┘
```

**Key Points:**
1. Dashboard queries `sync_status` from `projects` table via analysis-api
2. `sync_status` is AGGREGATED from all workspace pushes
3. Shows accumulated metrics (files indexed, components found)
4. Never shows completion percentage (continuous process)
5. Dashboard has NO direct connection to metabob-mcp

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User Login                                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
POST /auth/login (metabob-analysis-api)
Body: { email, password }
    │
    ▼
Response: {
  token: string (JWT),
  user: {
    user_id: string,
    username: string,  // Also API key name (1:1)
    email: string,
    org_id: string
  },
  organization: {
    org_id: string,
    name: string,
    default_project_id: string  // Always exists
  }
}
    │
    ▼
Store in React Context + localStorage
    │
    ▼
All subsequent requests include:
Header: Authorization: Bearer <token>

JWT Payload:
{
  user_id: string,
  username: string,
  org_id: string,
  default_project_id: string,
  permissions: Permission[],
  iat: number,
  exp: number
}
```

### Project Context Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Default Project Always Exists                              │
└─────────────────────────────────────────────────────────────┘

On Organization Creation:
  1. Create org record
  2. Create default project: { name: "Default", is_default: true }
  3. Set org.default_project_id = new project ID
  4. All users in org can access default project

On API Request Without project_id:
  1. Extract org_id from JWT
  2. Lookup org.default_project_id
  3. Use default_project_id for query/mutation

Dashboard Project Selector:
  1. Fetch: GET /auth/orgs/{org_id}/projects
  2. Show all projects (including default)
  3. Default project marked with badge: "Default"
  4. User can switch projects (updates context, re-fetches data)
```

### Real-Time Updates Flow

```
┌─────────────────────────────────────────────────────────────┐
│  WebSocket Primary, Polling Fallback                        │
└─────────────────────────────────────────────────────────────┘

Connection Flow:
  1. Dashboard opens WebSocket to ws://api.minibob.local/ws/dashboard
  2. Authenticate: Send JWT token
  3. Subscribe to channels: ["jobs", "problems", "executions", "sync"]
  4. Receive real-time events

WebSocket Message Format:
{
  type: "job_status" | "problem_created" | "execution_complete" | "sync_progress",
  data: { ... event-specific payload },
  timestamp: string (ISO 8601)
}

Sync Progress Event (NEW):
{
  type: "sync_progress",
  data: {
    project_id: string,
    files_indexed: number,      // Incremental count
    components_found: number,   // New components this push
    embeddings_generated: number,
    last_file: string           // Most recent file processed
  },
  timestamp: string
}

Fallback (on disconnect or timeout):
  1. Detect WebSocket close/error
  2. Switch to polling mode (every 5 seconds)
  3. Poll: GET /jobs?since=<last_timestamp>
  4. Poll: GET /problems?since=<last_timestamp>
  5. Poll: GET /v2/activities/executions?since=<last_timestamp>
  6. Poll: GET /auth/orgs/{org}/projects (for sync_status updates)
  7. Attempt WebSocket reconnect (exponential backoff)

Reconnection Strategy:
  Attempt 1: 1s delay
  Attempt 2: 2s delay
  Attempt 3: 4s delay
  Attempt 4: 8s delay
  Attempt 5+: 16s delay (max)
```

---

## Component Design

### 1. Frontend Application (React 19 + shadcn)

**Technology Stack:**
- React 19 (latest, with new use() hook for data fetching)
- shadcn/ui (headless components, Tailwind-based)
- Tailwind CSS v4 (zero-runtime, modern)
- TypeScript 5.x (strict mode)
- Bun runtime (dev and production)

**Directory Structure:**
```
repos/metabob-cloud-dashboard/
├── src/
│   ├── index.html                    # Entry point (Bun.serve)
│   ├── index.ts                      # Server (Bun.serve routes)
│   ├── frontend.tsx                  # React root
│   ├── App.tsx                       # Main app shell
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ... (other shadcn components)
│   │   │
│   │   ├── layout/                   # Layout components
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── PageContainer.tsx
│   │   │
│   │   ├── dev-events/              # Development Events feature
│   │   │   ├── EventStream.tsx      # Live event stream
│   │   │   ├── EventCard.tsx        # Single event display
│   │   │   ├── EventFilters.tsx     # Filter controls
│   │   │   └── types.ts
│   │   │
│   │   ├── projects/                # Projects feature
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectDetails.tsx
│   │   │   ├── SyncProgress.tsx     # NEW: Sync metrics display
│   │   │   ├── CreateProjectDialog.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── issues/                  # Issues feature
│   │   │   ├── IssueTable.tsx
│   │   │   ├── IssueFilters.tsx
│   │   │   ├── IssueDetails.tsx     # Sidebar panel
│   │   │   ├── IssueSeverityBadge.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── api-keys/                # API Keys feature
│   │   │   ├── APIKeyList.tsx
│   │   │   ├── GenerateKeyDialog.tsx
│   │   │   ├── KeyUsageChart.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── overview/                # Overview Dashboard
│   │   │   ├── MetricCard.tsx
│   │   │   ├── TrendChart.tsx
│   │   │   ├── ProjectHealthTable.tsx
│   │   │   └── types.ts
│   │   │
│   │   └── value/                   # Value & Impact
│   │       ├── QualityTrends.tsx
│   │       ├── TemplatePerformance.tsx
│   │       ├── ImprovementRoadmap.tsx
│   │       └── types.ts
│   │
│   ├── lib/
│   │   ├── api/                     # API clients
│   │   │   ├── client.ts            # Base HTTP client
│   │   │   ├── analysis-api.ts      # Analysis API client
│   │   │   ├── activity-api.ts      # Activity API client
│   │   │   ├── websocket.ts         # WebSocket client
│   │   │   └── types.ts             # Shared API types
│   │   │
│   │   ├── hooks/                   # React hooks
│   │   │   ├── useAuth.ts           # Authentication hook
│   │   │   ├── useWebSocket.ts      # WebSocket hook
│   │   │   ├── usePolling.ts        # Polling fallback
│   │   │   ├── useProjects.ts       # Projects data hook
│   │   │   ├── useSyncProgress.ts   # NEW: Sync metrics hook
│   │   │   ├── useIssues.ts         # Issues data hook
│   │   │   └── useAPIKeys.ts        # API keys data hook
│   │   │
│   │   ├── stores/                  # State management
│   │   │   ├── auth-store.ts        # Auth context
│   │   │   ├── org-store.ts         # Organization context
│   │   │   └── websocket-store.ts   # WebSocket connection state
│   │   │
│   │   └── utils.ts                 # shadcn utils (cn, etc.)
│   │
│   ├── styles/
│   │   └── index.css                # Tailwind + custom theme
│   │
│   └── types/
│       ├── auth.ts                  # Auth types
│       ├── organization.ts          # Org types
│       ├── project.ts               # Project types (with sync_status)
│       ├── problem.ts               # Issue types
│       ├── activity.ts              # Activity types
│       └── analytics.ts             # Analytics types
│
├── public/
│   └── favicon.ico
│
├── package.json
├── bun.lock
├── tailwind.config.js               # Tailwind v4 config
├── tsconfig.json
├── Dockerfile
├── .dockerignore
└── README.md
```

---

## API Integration Layer

### Analysis API Client (Updated)

```typescript
// src/lib/api/analysis-api.ts

import { APIClient } from "./client";
import { getAuthToken } from "../stores/auth-store";
import { z } from "zod";

// Updated ProjectSchema with sync_status
const ProjectSchema = z.object({
  project_id: z.string(),
  org_id: z.string(),
  name: z.string(),
  repository_url: z.string().optional(),
  branch: z.string().optional(),
  is_default: z.boolean(),
  sync_status: z.object({
    files_indexed: z.number(),
    components_found: z.number(),
    embeddings_generated: z.number(),
    last_sync_at: z.string(),
  }),
  stats: z.object({
    total_issues: z.number(),
    critical_issues: z.number(),
    high_issues: z.number(),
    medium_issues: z.number(),
    low_issues: z.number(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});

const analysisAPIBaseURL = import.meta.env.VITE_ANALYSIS_API_URL || "http://analysis.minibob.local";

const client = new APIClient(analysisAPIBaseURL, getAuthToken);

// Auth endpoints
export const login = (email: string, password: string) =>
  client.post("/auth/login", { email, password });

export const getMe = () =>
  client.get("/auth/me", UserSchema);

// Projects endpoints (includes sync_status)
export const getProjects = (orgId: string) =>
  client.get(`/auth/orgs/${orgId}/projects`, z.array(ProjectSchema));

export const createProject = (orgId: string, data: unknown) =>
  client.post(`/auth/orgs/${orgId}/projects`, data, ProjectSchema);

// Problems endpoints
export const getProblems = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return client.get(`/problems?${query}`, z.array(ProblemSchema));
};

export const resolveProblem = (problemId: string) =>
  client.post(`/problems/${problemId}/resolve`, {}, ProblemSchema);

// Analytics endpoints
export const getProjectAnalytics = () =>
  client.get("/analytics/projects");

export const getAPIKeyAnalytics = () =>
  client.get("/analytics/api-keys");
```

### New Hook: useSyncProgress

```typescript
// src/lib/hooks/useSyncProgress.ts

import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { getProjects } from "../api/analysis-api";

interface SyncStatus {
  files_indexed: number;
  components_found: number;
  embeddings_generated: number;
  last_sync_at: string;
}

interface SyncProgressEvent {
  type: "sync_progress";
  data: {
    project_id: string;
    files_indexed: number;
    components_found: number;
    embeddings_generated: number;
    last_file: string;
  };
  timestamp: string;
}

export function useSyncProgress(projectId: string) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const { on } = useWebSocket();

  // Initial load
  useEffect(() => {
    async function loadSyncStatus() {
      const projects = await getProjects(/* org_id */);
      const project = projects.find(p => p.project_id === projectId);
      if (project) {
        setSyncStatus(project.sync_status);
      }
    }
    loadSyncStatus();
  }, [projectId]);

  // WebSocket updates
  useEffect(() => {
    const unsubscribe = on("sync_progress", (event: SyncProgressEvent) => {
      if (event.data.project_id === projectId) {
        setSyncStatus(prev => prev ? {
          files_indexed: prev.files_indexed + event.data.files_indexed,
          components_found: prev.components_found + event.data.components_found,
          embeddings_generated: prev.embeddings_generated + event.data.embeddings_generated,
          last_sync_at: event.timestamp,
        } : null);
        setLastFile(event.data.last_file);
      }
    });

    return unsubscribe;
  }, [projectId, on]);

  return { syncStatus, lastFile };
}
```

### New Component: SyncProgress

```typescript
// src/components/projects/SyncProgress.tsx

import { useSyncProgress } from "../../lib/hooks/useSyncProgress";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

interface SyncProgressProps {
  projectId: string;
}

export function SyncProgress({ projectId }: SyncProgressProps) {
  const { syncStatus, lastFile } = useSyncProgress(projectId);

  if (!syncStatus) return null;

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Progressive Sync Status</h3>

      <div className="space-y-3">
        <MetricRow
          label="Files Indexed"
          value={syncStatus.files_indexed.toLocaleString()}
          icon="📁"
        />
        <MetricRow
          label="Components Found"
          value={syncStatus.components_found.toLocaleString()}
          icon="🧩"
        />
        <MetricRow
          label="Embeddings Generated"
          value={syncStatus.embeddings_generated.toLocaleString()}
          icon="🔢"
        />
      </div>

      {lastFile && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-500">Last synced:</p>
          <code className="text-xs">{lastFile}</code>
          <p className="text-xs text-gray-400 mt-1">
            {formatRelativeTime(syncStatus.last_sync_at)}
          </p>
        </div>
      )}

      <Badge variant="secondary" className="mt-4">
        Continuous Sync Active
      </Badge>
    </Card>
  );
}

function MetricRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
```

---

## Styling System (Tailwind + Metabob Theme)

**Unchanged from original design.md** - Same color scheme and Tailwind configuration.

---

## Deployment Configuration

### Dockerfile

**Unchanged from original design.md**

### Helm Chart

**No changes needed** - Dashboard only accesses analysis-api and activity-api, both already in cluster.

---

## Testing Strategy

### Integration Tests (Updated)

```typescript
// tests/e2e/sync-progress.spec.ts

import { test, expect } from "@playwright/test";

test("dashboard shows sync progress for project", async ({ page }) => {
  await page.goto("http://dashboard.minibob.local/projects/test-project");

  // Wait for sync status to load
  await page.waitForSelector('[data-testid="sync-progress"]');

  // Should show metrics (not percentages)
  await expect(page.locator('[data-testid="files-indexed"]')).toContainText(/\d+/);
  await expect(page.locator('[data-testid="components-found"]')).toContainText(/\d+/);
  await expect(page.locator('[data-testid="embeddings-generated"]')).toContainText(/\d+/);

  // Should NOT show completion percentage
  await expect(page.locator('[data-testid="sync-progress"]')).not.toContainText(/%/);

  // Should show "Continuous Sync Active" badge
  await expect(page.locator("text=Continuous Sync Active")).toBeVisible();
});
```

---

## Performance Targets

**Unchanged from original design.md**

---

## Security Considerations

**Unchanged from original design.md**

---

## Open Design Questions (Updated)

1. **Caching Strategy**: Should we use React Query, SWR, or custom cache?
   - **Recommendation:** Custom cache (5min TTL), simpler

2. **State Management**: Context API sufficient, or need Zustand?
   - **Recommendation:** Context API for auth/org, local state otherwise

3. **Error Boundaries**: Global or per-page?
   - **Recommendation:** Both (global fallback + page-level)

4. **Loading States**: Skeleton screens or spinners?
   - **Recommendation:** Skeleton for tables/lists, spinner for actions

5. **Pagination**: Client-side or server-side?
   - **Recommendation:** Server-side for problems/events, client for small lists

6. **Sync Progress Refresh**: WebSocket-only or poll as backup?
   - **Recommendation:** WebSocket primary + polling fallback (every 30s)

---

## References

- Analysis API Design: `openspec/changes/analysis-api-extraction/design-updated.md`
- Data Schemas: `openspec/changes/analysis-api-extraction/specs/data-schemas/spec-updated.md`
- Activity API: `repos/metabob-activity-api/`
- Old Dashboard Theme: `repos/metabob-dashboard/src/themes/Base.js`
- Deployment Pattern: `helm/activity-system-minimal.yaml.gotmpl`
