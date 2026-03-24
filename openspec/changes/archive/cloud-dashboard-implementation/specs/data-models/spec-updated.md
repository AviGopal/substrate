# Dashboard Data Models Specification (Updated)

**Component:** metabob-cloud-dashboard
**Purpose:** TypeScript interfaces matching SurrealDB schemas
**Alignment:** Matches `analysis-api-extraction/specs/data-schemas/spec-updated.md`

---

## Auth & User Management Models

```typescript
/**
 * User <-> API Key is 1:1 relationship
 * Username serves as both user identifier and API key name
 */
export interface User {
  user_id: string;           // UUID
  username: string;          // Unique, also API key name
  email: string;             // Unique
  org_id: string;            // Organization UUID
  status: "active" | "inactive" | "suspended";
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
  last_login_at?: string;    // ISO 8601
}

export interface APIKey {
  key_id: string;            // Same as user_id (1:1 relationship)
  username: string;          // Same as user.username
  org_id: string;            // Organization UUID
  key_hash: string;          // Hashed key (never shown in UI)
  key_prefix: string;        // First 8 chars (e.g., "sk-ant-")
  permissions: Permission[];
  usage_count: number;       // Total API calls
  total_cost: number;        // USD spent
  last_used_at?: string;     // ISO 8601
  status: "active" | "revoked";
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export interface Permission {
  resource: "projects" | "analysis" | "activities" | "admin";
  actions: ("read" | "write" | "delete")[];
}

export interface Organization {
  org_id: string;            // UUID
  name: string;
  default_project_id: string; // UUID - always exists
  settings: OrganizationSettings;
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export interface OrganizationSettings {
  cross_project_learning: boolean;  // Default: false
  max_api_keys?: number;
  max_projects?: number;
  retention_days?: number;
}
```

---

## Project Models

```typescript
/**
 * Every organization has a default project (is_default: true)
 * If no project_id provided in requests, defaults to org.default_project_id
 */
export interface Project {
  project_id: string;        // UUID
  org_id: string;            // Organization UUID
  name: string;
  repository_url?: string;   // Git repository URL
  branch?: string;           // Default branch
  git_root_hash?: string;    // Unique identifier from git
  is_default: boolean;       // True for org's default project
  settings: ProjectSettings;
  stats: ProjectStats;
  sync_status: SyncStatus;   // From metabob-mcp
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export interface ProjectSettings {
  auto_analyze: boolean;
  analysis_triggers: ("commit" | "pr" | "schedule")[];
  notification_channels?: string[];
}

export interface ProjectStats {
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  files_analyzed: number;
  components_extracted: number;
  last_analysis?: string;    // ISO 8601
}

/**
 * Progressive Sync Status (from metabob-mcp)
 * Shows work done, not completion percentage
 */
export interface SyncStatus {
  files_indexed: number;
  components_found: number;
  embeddings_generated: number;
  last_sync_at: string;      // ISO 8601
}
```

---

## Analysis Domain Models

```typescript
export interface AnalysisJob {
  job_id: string;            // UUID
  session_id: string;
  org_id?: string;
  project_id?: string;
  status: JobStatus;
  progress: number;          // 0-100 (deprecated for continuous sync)
  files_submitted: string[];
  files_analyzed: string[];
  started_at?: string;       // ISO 8601
  completed_at?: string;     // ISO 8601
  duration_ms?: number;
  problems_found: number;
  components_extracted: number;
  error_message?: string;
  created_at: string;        // ISO 8601
}

export type JobStatus = "pending" | "running" | "complete" | "failed";

export interface Problem {
  problem_id: string;        // UUID
  job_id: string;
  session_id: string;
  org_id?: string;
  project_id?: string;
  file_path: string;
  component_id?: string;     // Format: "file.ts::ComponentName"
  category: ProblemCategory;
  severity: ProblemSeverity;
  summary: string;           // One-line
  description: string;       // Detailed
  start_line: number;
  end_line: number;
  code_snippet?: string;
  status: ProblemStatus;
  resolved_at?: string;      // ISO 8601
  resolution_summary?: string;
  fixed_in_commit?: string;  // Git commit hash
  impact_score?: number;     // 0-100 from CPG
  affected_components_count?: number;
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export type ProblemCategory =
  | "bug"
  | "security"
  | "performance"
  | "maintainability"
  | "style";

export type ProblemSeverity = "critical" | "high" | "medium" | "low";

export type ProblemStatus = "open" | "resolved" | "ignored";

export interface CodeComponent {
  component_id: string;      // Format: "project_id:file.ts::ComponentName"
  session_id: string;
  project_id?: string;
  file_path: string;
  component_type: ComponentType;
  name: string;
  start_line: number;
  end_line: number;
  metadata?: Record<string, unknown>;
  embedding?: number[];      // Vector for similarity
  embedding_version?: string;
  annotation_count: number;
  last_annotated_at?: string;
  git_commit_hash?: string;
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export type ComponentType =
  | "function"
  | "class"
  | "method"
  | "variable"
  | "import"
  | "module";

export interface ComponentAnnotation {
  annotation_id: string;     // UUID
  component_id: string;
  session_id: string;
  project_id?: string;
  org_id?: string;
  content: string;           // Markdown-formatted
  annotation_type: AnnotationType;
  related_problem_id?: string;
  created_by: string;        // Username or session_id
  tags: string[];            // Searchable tags
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export type AnnotationType =
  | "design_decision"
  | "resolved_challenge"
  | "implementation_note"
  | "warning";
```

---

## Activity Domain Models

From metabob-activity-api (unchanged from previous spec).

```typescript
export interface ActivityTemplate {
  template_id: string;
  variant_id: string;
  name: string;
  description: string;
  category: ActivityCategory;
  scope: "global" | "org" | "project";
  org_id?: string;
  project_id?: string;
  tasks: ActivityTask[];
  expected_value: number;
  success_rate: number;
  avg_cost: number;
  avg_duration: number;
  created_at: string;
  updated_at: string;
}

export type ActivityCategory =
  | "feature"
  | "bugfix"
  | "refactor"
  | "tool"
  | "infrastructure";

export interface ActivityExecution {
  execution_id: string;
  template_id: string;
  variant_id: string;
  org_id: string;
  project_id: string;
  username: string;          // User who triggered (1:1 with API key)
  started_at: string;
  completed_at?: string;
  success: boolean;
  cost_usd: number;
  duration_ms: number;
  tokens: {
    input: number;
    output: number;
    cache: number;
  };
  error_message?: string;
}
```

---

## Dashboard-Specific Models

### Sync Progress Display

```typescript
/**
 * Dashboard visualization of progressive sync
 * Shows work done, not completion percentage
 */
export interface SyncProgressDisplay {
  project_id: string;
  project_name: string;
  status: "active" | "idle" | "error";
  metrics: {
    files_indexed: number;
    components_found: number;
    embeddings_generated: number;
    annotations_added: number;
  };
  last_sync_at: string;
  recent_activity: RecentSyncActivity[];
}

export interface RecentSyncActivity {
  file_path: string;
  components_found: number;
  timestamp: string;
}
```

### Organization Settings Form

```typescript
export interface OrganizationSettingsForm {
  cross_project_learning: boolean;
  max_api_keys?: number;
  max_projects?: number;
  retention_days?: number;
}
```

### Project Creation Form

```typescript
export interface CreateProjectForm {
  name: string;
  repository_url?: string;
  branch?: string;
  settings: Partial<ProjectSettings>;
}
```

### API Key Generation Form

```typescript
export interface GenerateAPIKeyForm {
  username: string;          // Will also be key name
  email: string;
  password: string;          // For user account
  permissions: Permission[];
}
```

---

## WebSocket Event Models

```typescript
export type DashboardEventType =
  | "job_status"
  | "problem_created"
  | "problem_resolved"
  | "execution_complete"
  | "sync_progress";         // New: progressive sync updates

export interface DashboardEvent {
  type: DashboardEventType;
  data: JobStatusEvent | ProblemEvent | ExecutionEvent | SyncProgressEvent;
  timestamp: string;
}

export interface SyncProgressEvent {
  project_id: string;
  files_indexed: number;
  components_found: number;
  embeddings_generated: number;
  last_file: string;         // Most recently processed file
}
```

---

## Analytics Models

```typescript
export interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  time_range: {
    start: string;
    end: string;
  };
  issues: {
    opened: number;
    resolved: number;
    delta: number;           // opened - resolved
  };
  sync_metrics: {
    files_indexed: number;
    components_found: number;
    embeddings_generated: number;
  };
  activity_stats: {
    executions: number;
    success_rate: number;
    total_cost: number;
  };
}

export interface APIKeyAnalytics {
  username: string;          // User/key name (1:1)
  key_prefix: string;        // e.g., "sk-ant-"
  total_activities: number;
  total_analyses: number;
  total_cost: number;
  success_rate: number;
  last_activity: string;
}
```

---

## UI State Models

```typescript
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  organization: Organization | null;
  token: string | null;      // JWT
  loading: boolean;
  error: string | null;
}

export interface ProjectContextState {
  currentProject: Project | null;
  projects: Project[];
  defaultProject: Project | null;  // Org's default (always exists)
  loading: boolean;
  error: string | null;
}

export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastEvent?: DashboardEvent;
  error: string | null;
}
```

---

## Validation Schemas (Zod)

```typescript
import { z } from "zod";

export const UserSchema = z.object({
  user_id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  org_id: z.string().uuid(),
  status: z.enum(["active", "inactive", "suspended"]),
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().optional(),
});

export const ProjectSchema = z.object({
  project_id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string(),
  repository_url: z.string().url().optional(),
  branch: z.string().optional(),
  is_default: z.boolean(),
  settings: z.object({
    auto_analyze: z.boolean(),
    analysis_triggers: z.array(z.enum(["commit", "pr", "schedule"])),
  }),
  stats: z.object({
    total_issues: z.number(),
    critical_issues: z.number(),
    high_issues: z.number(),
    medium_issues: z.number(),
    low_issues: z.number(),
    files_analyzed: z.number(),
    components_extracted: z.number(),
    last_analysis: z.string().optional(),
  }),
  sync_status: z.object({
    files_indexed: z.number(),
    components_found: z.number(),
    embeddings_generated: z.number(),
    last_sync_at: z.string(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});

export const OrganizationSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string(),
  default_project_id: z.string().uuid(),
  settings: z.object({
    cross_project_learning: z.boolean(),
    max_api_keys: z.number().optional(),
    max_projects: z.number().optional(),
    retention_days: z.number().optional(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});
```

---

## Constants

```typescript
export const SEVERITY_COLORS = {
  critical: "error",
  high: "critical",
  medium: "accent",
  low: "info",
} as const;

export const STATUS_COLORS = {
  open: "accent",
  resolved: "success",
  ignored: "secondary",
} as const;

export const CATEGORY_ICONS = {
  bug: "🐛",
  security: "🔒",
  performance: "⚡",
  maintainability: "🔧",
  style: "✨",
} as const;
```

---

## Key Differences from Previous Spec

1. **Added `sync_status` to Project** - Progressive sync metrics
2. **Added `cross_project_learning` to Organization** - Settings for knowledge sharing
3. **Added `is_default` to Project** - Default project flag
4. **Added `SyncProgressEvent`** - WebSocket event for sync updates
5. **Removed "connectome" terminology** - Just use existing annotations/components
6. **Changed `severity` values** - lowercase to match SurrealDB schema

---

## References

- SurrealDB Schemas: `analysis-api-extraction/specs/data-schemas/spec-updated.md`
- Activity API: `repos/metabob-activity-api/src/models/schemas.ts`
