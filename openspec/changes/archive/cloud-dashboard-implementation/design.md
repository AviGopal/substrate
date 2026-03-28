# Cloud Dashboard Implementation - Design Document

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23
**Dependencies:** analysis-api-extraction

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
│       ├── project.ts               # Project types
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

## Data Flow Architecture

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
  3. Subscribe to channels: ["jobs", "problems", "executions"]
  4. Receive real-time events

WebSocket Message Format:
{
  type: "job_status" | "problem_created" | "execution_complete",
  data: { ... event-specific payload },
  timestamp: string (ISO 8601)
}

Fallback (on disconnect or timeout):
  1. Detect WebSocket close/error
  2. Switch to polling mode (every 5 seconds)
  3. Poll: GET /jobs?since=<last_timestamp>
  4. Poll: GET /problems?since=<last_timestamp>
  5. Poll: GET /v2/activities/executions?since=<last_timestamp>
  6. Attempt WebSocket reconnect (exponential backoff)

Reconnection Strategy:
  Attempt 1: 1s delay
  Attempt 2: 2s delay
  Attempt 3: 4s delay
  Attempt 4: 8s delay
  Attempt 5+: 16s delay (max)
```

---

## API Integration Layer

### Base HTTP Client

```typescript
// src/lib/api/client.ts

import { z } from "zod";

interface RequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

class APIClient {
  private baseURL: string;
  private getToken: () => string | null;

  constructor(baseURL: string, getToken: () => string | null) {
    this.baseURL = baseURL;
    this.getToken = getToken;
  }

  async request<T>(
    endpoint: string,
    config: RequestConfig,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const token = this.getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...config.headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout || 30000
    );

    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new APIError(
          response.status,
          error.message || response.statusText,
          error.code
        );
      }

      const data = await response.json();

      // Validate response with Zod if schema provided
      if (schema) {
        return schema.parse(data);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof APIError) throw error;
      throw new APIError(0, "Network error", "NETWORK_ERROR");
    }
  }

  get<T>(endpoint: string, schema?: z.ZodSchema<T>): Promise<T> {
    return this.request(endpoint, { method: "GET" }, schema);
  }

  post<T>(endpoint: string, body: unknown, schema?: z.ZodSchema<T>): Promise<T> {
    return this.request(endpoint, { method: "POST", body }, schema);
  }

  put<T>(endpoint: string, body: unknown, schema?: z.ZodSchema<T>): Promise<T> {
    return this.request(endpoint, { method: "PUT", body }, schema);
  }

  delete<T>(endpoint: string, schema?: z.ZodSchema<T>): Promise<T> {
    return this.request(endpoint, { method: "DELETE" }, schema);
  }
}

class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}
```

### Analysis API Client

```typescript
// src/lib/api/analysis-api.ts

import { APIClient } from "./client";
import { getAuthToken } from "../stores/auth-store";
import { z } from "zod";

// Schemas (validate responses)
const UserSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  email: z.string().email(),
  org_id: z.string(),
  created_at: z.string(),
});

const ProjectSchema = z.object({
  project_id: z.string(),
  org_id: z.string(),
  name: z.string(),
  repository_url: z.string().optional(),
  branch: z.string().optional(),
  is_default: z.boolean(),
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

const ProblemSchema = z.object({
  problem_id: z.string(),
  project_id: z.string(),
  file_path: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["open", "resolved", "ignored"]),
  created_at: z.string(),
});

// Client
const analysisAPIBaseURL = import.meta.env.VITE_ANALYSIS_API_URL || "http://analysis.minibob.local";

const client = new APIClient(analysisAPIBaseURL, getAuthToken);

// Auth endpoints
export const login = (email: string, password: string) =>
  client.post("/auth/login", { email, password });

export const getMe = () =>
  client.get("/auth/me", UserSchema);

// Projects endpoints
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

### WebSocket Client

```typescript
// src/lib/api/websocket.ts

type EventType = "job_status" | "problem_created" | "execution_complete";

interface WebSocketEvent {
  type: EventType;
  data: unknown;
  timestamp: string;
}

type EventHandler = (event: WebSocketEvent) => void;

class DashboardWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 16000;
  private token: string | null = null;

  constructor(private url: string) {}

  connect(token: string): void {
    this.token = token;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected");
      this.reconnectAttempts = 0;
      // Authenticate
      this.ws?.send(JSON.stringify({ type: "auth", token }));
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketEvent = JSON.parse(event.data);
        this.handleEvent(message);
      } catch (error) {
        console.error("[WebSocket] Parse error:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    this.ws.onclose = () => {
      console.log("[WebSocket] Disconnected");
      this.reconnect();
    };
  }

  private reconnect(): void {
    if (!this.token) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(this.token!);
    }, delay);
  }

  private handleEvent(event: WebSocketEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.token = null;
    this.reconnectAttempts = 0;
  }
}

export const createWebSocketClient = (token: string) => {
  const wsURL = import.meta.env.VITE_WS_URL || "ws://api.minibob.local/ws/dashboard";
  const client = new DashboardWebSocket(wsURL);
  client.connect(token);
  return client;
};
```

---

## Styling System (Tailwind + Metabob Theme)

### Tailwind Configuration

```typescript
// tailwind.config.js

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        // Metabob color scheme (from Base.js)
        primary: {
          DEFAULT: "#161721",
          dark: "#161721",
          light: "#25273B",
        },
        accent: {
          DEFAULT: "#1F97D9",
          dark: "#0333B6",
          light: "#4DB1E9",
        },
        secondary: {
          DEFAULT: "#282536",
          dark: "#1a1826",
          light: "#363347",
        },
        success: {
          DEFAULT: "#18BF80",
          dark: "#108055",
          light: "#20FFAA",
        },
        info: {
          DEFAULT: "#4FC5FF",
          dark: "#1A89BF",
          light: "#A7E2FF",
        },
        error: {
          DEFAULT: "#FF3C54",
          dark: "#CC3044",
          light: "#FF6B7C",
        },
        critical: {
          DEFAULT: "#A70CEA",
          dark: "#850BBB",
          light: "#C23CF2",
        },
        border: "#23262e",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

---

## Deployment Configuration

### Dockerfile

```dockerfile
# repos/metabob-cloud-dashboard/Dockerfile

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build application
RUN bun run build

# Production image
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./
COPY --from=base /app/bun.lock ./

RUN bun install --production --frozen-lockfile

# Environment variables (override via Helm)
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
```

### Helm Chart

See `specs/deployment/helm-chart.md` for full Helm configuration.

---

## Testing Strategy

### Unit Tests (Bun Test)

```typescript
// src/lib/api/client.test.ts

import { test, expect, mock } from "bun:test";
import { APIClient } from "./client";

test("APIClient makes GET request with auth header", async () => {
  const getToken = () => "test-token";
  const client = new APIClient("http://api.test", getToken);

  // Mock fetch
  global.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: "success" }),
    })
  );

  const result = await client.get("/test");

  expect(result).toEqual({ data: "success" });
  expect(global.fetch).toHaveBeenCalledWith(
    "http://api.test/test",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer test-token",
      }),
    })
  );
});
```

### Integration Tests (Playwright)

```typescript
// tests/e2e/login-flow.spec.ts

import { test, expect } from "@playwright/test";

test("user can login and see dashboard", async ({ page }) => {
  await page.goto("http://dashboard.minibob.local");

  // Should redirect to login
  await expect(page).toHaveURL(/\/login$/);

  // Fill login form
  await page.fill('input[name="email"]', "test@example.com");
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');

  // Should redirect to dashboard
  await expect(page).toHaveURL("/");

  // Should show org name in header
  await expect(page.locator("header")).toContainText("Test Org");

  // Should show overview metrics
  await expect(page.locator('[data-testid="metric-projects"]')).toBeVisible();
});
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load (cold) | < 2s | Time to interactive |
| Initial Load (warm) | < 500ms | Cached bundle load |
| Page Navigation | < 300ms | Route transition |
| WebSocket Latency | < 100ms | Event receipt |
| API Request | < 500ms | P95 latency |
| Bundle Size | < 500KB | Gzipped |
| Lighthouse Score | > 90 | Performance |

---

## Security Considerations

1. **JWT Validation**: All API requests include `Authorization: Bearer <token>`
2. **Token Expiry**: JWT expires after 24 hours, refresh required
3. **CORS**: Analysis/Activity APIs configured with CORS for dashboard origin
4. **CSP**: Content-Security-Policy headers in Istio
5. **XSS Protection**: React 19 auto-escapes, no `dangerouslySetInnerHTML`
6. **CSRF**: Not needed (stateless JWT, no cookies)

---

## Open Design Questions

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

---

## References

- Analysis API Design: `openspec/changes/analysis-api-extraction/design.md`
- Data Schemas: `openspec/changes/analysis-api-extraction/specs/data-schemas/spec.md`
- MCP Tools: `openspec/changes/analysis-api-extraction/specs/mcp-tools/spec.md`
- Activity API: `repos/metabob-activity-api/`
- Old Dashboard Theme: `repos/metabob-dashboard/src/themes/Base.js`
- Deployment Pattern: `helm/activity-system-minimal.yaml.gotmpl`
