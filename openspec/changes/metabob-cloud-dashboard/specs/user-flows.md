# Metabob Cloud Dashboard User Flows

This document specifies the user flows for each dashboard page, including entry conditions, data requirements, user interactions, expected outcomes, and error states.

---

## 1. Overview Page

### Entry Conditions
- User must be authenticated (JWT token present)
- Dashboard loads by default after login

### Data Requirements

```typescript
interface DashboardMetrics {
  totalProjects: number;
  totalProblems: number;
  criticalProblems: number;
  resolvedProblems: number;
  qualityScore: number;
}

interface ActivityMetrics {
  totalTemplates: number;
  totalExecutions: number;
  executionsToday: number;
  averageSuccessRate: number;
}

interface RecentActivity {
  execution_id: string;
  template_name: string;
  status: 'completed' | 'failed' | 'running';
  timestamp: string;
}

interface SystemHealth {
  analysisApi: 'connected' | 'disconnected';
  activityApi: 'connected' | 'disconnected';
}
```

### User Interactions

1. **View metrics** → Metric cards display project/issue/template/execution counts
2. **Click project count** → Navigate to Projects page
3. **Click issue count** → Navigate to Issues page
4. **Click recent activity item** → Navigate to Development Events with filter
5. **Click "Refresh"** → Reload all dashboard data
6. **Click navigation item** → Navigate to selected page

### Expected Outcomes

- All metric cards show loading skeleton, then real data
- Recent activity shows last 5 executions
- System health indicators reflect actual API status
- Navigation works without page reload

### Error States

| Error | Message | Recovery |
|-------|---------|----------|
| API unreachable | "Unable to connect to API" | Retry button, auto-retry after 30s |
| Auth expired | Redirect to login | Re-authenticate |
| Partial data | Show available data with warning | "Some data unavailable" |

---

## 2. Projects Page

### Entry Conditions
- User must be authenticated
- User has organization membership

### Data Requirements

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  repository_url?: string;
  org_id: string;
  status: 'active' | 'archived' | 'pending';
  issues_count: number;
  created_at: string;
  updated_at: string;
}
```

### User Interactions

1. **View projects list** → Display all org projects with pagination
2. **Search projects** → Filter by name (debounced 300ms)
3. **Click "New Project"** → Open create project modal
4. **Fill project form** → Enter name (required), description, repo URL
5. **Submit form** → Create project via API, add to list
6. **Click project row** → Expand/select project for details
7. **Click "Delete"** → Show confirmation dialog
8. **Confirm delete** → Remove project and redirect

### Expected Outcomes

- Projects sorted by updated_at DESC
- Search filters instantly with highlight
- New projects appear at top of list
- Delete removes from view immediately

### Error States

| Error | Message | Recovery |
|-------|---------|----------|
| Create failed | "Failed to create project" | Show error, keep form open |
| Delete failed | "Cannot delete project with issues" | Dismiss dialog, show toast |
| Search timeout | "Search taking too long" | Clear search, show all |

---

## 3. Issues Page

### Entry Conditions
- User must be authenticated
- At least one project must exist

### Data Requirements

```typescript
interface Problem {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'maintainability' | 'reliability' | 'style';
  status: 'open' | 'resolved' | 'ignored';
  file_path: string;
  line_start: number;
  line_end: number;
  created_at: string;
}
```

### User Interactions

1. **View issues** → Display paginated issues table
2. **Filter by severity** → Click severity buttons (toggle)
3. **Filter by status** → Click status buttons (toggle)
4. **Search issues** → Full-text search on title/description
5. **Click "Clear filters"** → Reset all filters
6. **Click status dropdown** → Change issue status
7. **Click "Load more"** → Fetch next page of issues
8. **Click "Refresh"** → Reload current view

### Expected Outcomes

- Issues sorted by severity DESC, then created_at DESC
- Multiple filters combine with AND logic
- Status changes update immediately
- Counts reflect current filter

### Error States

| Error | Message | Recovery |
|-------|---------|----------|
| Load failed | "Failed to load issues" | Retry button |
| Status update failed | "Could not update status" | Revert UI, show toast |
| No issues found | "No issues match filters" | Clear filters suggestion |

---

## 4. API Keys Page

### Entry Conditions
- User must be authenticated
- User must have admin or member role

### Data Requirements

```typescript
interface ApiKey {
  id: string;
  user_id: string;
  name?: string;
  prefix: string;           // e.g., "mb_live_"
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at?: string;
  usage_count: number;
}

interface CreateKeyResponse {
  key: ApiKey;
  secret: string;           // Full key, shown only once
}
```

### User Interactions

1. **View API keys** → Display user's keys (masked)
2. **Click "Create Key"** → Open create form
3. **Enter key name** → Optional friendly name
4. **Submit create** → Generate key, show secret ONCE
5. **Click "Copy"** → Copy secret to clipboard
6. **Click "I've copied the key"** → Dismiss secret display
7. **Click "Revoke"** → Show confirmation
8. **Confirm revoke** → Mark key as revoked

### Expected Outcomes

- Keys masked: `mb_live_••••••••••••••••`
- New key secret shown only once
- Copy shows "Copied!" confirmation
- Revoked keys remain visible but grayed

### Error States

| Error | Message | Recovery |
|-------|---------|----------|
| Create failed | "Failed to create API key" | Show error, retry |
| Revoke failed | "Could not revoke key" | Dismiss confirmation |
| Copy failed | "Clipboard access denied" | Manual copy instruction |

---

## 5. Development Events Page

### Entry Conditions
- User must be authenticated
- WebSocket connection established (optional)

### Data Requirements

```typescript
interface DevelopmentEvent {
  type: 'activity.started' | 'activity.completed' | 'activity.failed' |
        'problem.created' | 'problem.resolved';
  timestamp: string;
  data: {
    execution_id?: string;
    template_name?: string;
    status?: string;
    problem_id?: string;
    severity?: string;
  };
}
```

### User Interactions

1. **View event stream** → Real-time event list
2. **Filter by type** → Show only selected event types
3. **Click "Pause"** → Stop receiving new events
4. **Click "Resume"** → Continue event stream
5. **Click "Clear"** → Remove all events from view
6. **Click event** → Expand event details

### Expected Outcomes

- New events appear at top
- Paused state shows indicator
- Clear empties list immediately
- Event details show full payload

### Error States

| Error | Message | Recovery |
|-------|---------|----------|
| WS disconnected | "Connection lost" | Auto-reconnect, manual retry |
| Too many events | "Buffer limit reached" | Auto-clear oldest |
| Parse error | Skip malformed events | Log to console |

---

## 6. Value & Impact Page

### Entry Conditions
- User must be authenticated
- Historical data must exist (30+ days ideal)

### Data Requirements

```typescript
interface QualityTrend {
  date: string;
  success_count: number;
  failure_count: number;
  total_executions: number;
  total_cost: string;
}

interface TemplatePerformance {
  template_id: string;
  template_name: string;
  success_rate: number;
  execution_count: number;
}
```

### User Interactions

1. **View quality trend** → Line/bar chart of daily metrics
2. **Select time range** → 7 days / 30 days / 90 days
3. **View comparisons** → Current vs previous period
4. **View template performance** → Bar chart of success rates
5. **Hover data point** → Show tooltip with details

### Expected Outcomes

- Charts animate on load
- Time range changes data immediately
- Deltas show positive/negative indicators
- Template rankings sorted by success rate

### Error States

| Error | Message | Recovery |
|-------|---------|----------|
| No data | "Not enough data for this period" | Suggest longer range |
| API timeout | "Could not load metrics" | Retry button |
| Calculation error | "Unable to compute delta" | Show raw values only |

---

## Authentication Flow

### Login

1. User visits `/` or any protected route
2. If no valid token, redirect to login form
3. User enters email and password
4. Submit calls `/v2/auth/login`
5. On success, store JWT token, redirect to dashboard
6. On failure, show error message

### Token Refresh

1. Token expires in 15 minutes
2. Before expiry, call `/v2/auth/refresh`
3. Replace token in memory
4. If refresh fails, redirect to login

### Logout

1. User clicks "Sign out"
2. Clear token from memory
3. Redirect to login page
4. Session state is cleared

---

## Navigation Structure

```
Overview (/)
├── Development Events (/events)
├── Projects (/projects)
│   └── Project Details (/projects/:id)
├── Issues (/issues)
│   └── Issue Details (/issues/:id)
├── API Keys (/api-keys)
└── Value & Impact (/value-impact)
```

---

## Testing Checklist

### Per-Page Tests

- [ ] Loads without errors
- [ ] Shows loading state
- [ ] Displays seeded data
- [ ] Handles empty state
- [ ] Handles API errors
- [ ] Filters work correctly
- [ ] Actions complete successfully
- [ ] Navigation works

### Cross-Page Tests

- [ ] Auth persists across navigation
- [ ] Deep links work when authenticated
- [ ] Back button works correctly
- [ ] Refresh maintains state
