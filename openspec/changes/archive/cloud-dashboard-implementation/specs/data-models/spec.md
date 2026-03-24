# Dashboard Data Models Specification

**Component:** metabob-cloud-dashboard
**Purpose:** Define TypeScript interfaces for all data consumed by the dashboard
**Alignment:** Matches SurrealDB schemas from analysis-api-extraction

---

## Shared Data Models (Cross-Service)

These models are shared between analysis-api, activity-api, and dashboard.

### Authentication & Users

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
  created_at: string;        // ISO 8601
  last_login?: string;       // ISO 8601
}

export interface APIKey {
  key_id: string;            // Same as user_id (1:1 relationship)
  username: string;          // Same as user.username
  key_hash: string;          // Hashed API key (not shown in UI)
  key_prefix: string;        // First 8 chars (shown in UI: sk-ant-****)
  org_id: string;            // Organization UUID
  permissions: Permission[];
  created_at: string;        // ISO 8601
  last_used?: string;        // ISO 8601
  usage_count: number;       // Total API calls
  total_cost: number;        // USD spent
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
  max_api_keys?: number;
  max_projects?: number;
  monthly_budget?: number;   // USD
  retention_days?: number;   // Data retention
}

/**
 * JWT Payload Structure
 * Included in Authorization: Bearer <token>
 */
export interface JWTPayload {
  user_id: string;
  username: string;
  org_id: string;
  default_project_id: string;
  permissions: Permission[];
  iat: number;               // Issued at (Unix timestamp)
  exp: number;               // Expiration (Unix timestamp)
}
```

### Projects

```typescript
/**
 * Project Model
 * Every organization has a default project (is_default: true)
 * Clients can provide project_id or it defaults to org.default_project_id
 */
export interface Project {
  project_id: string;        // UUID
  org_id: string;            // Organization UUID
  name: string;
  repository_url?: string;   // Git repository URL
  branch?: string;           // Default branch (e.g., "main")
  git_root_hash?: string;    // Unique identifier from git
  is_default: boolean;       // True for org's default project
  settings: ProjectSettings;
  stats: ProjectStats;
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export interface ProjectSettings {
  auto_analyze: boolean;
  analysis_triggers: ("commit" | "pr" | "schedule")[];
  notification_channels?: string[]; // Email, Slack, etc.
}

export interface ProjectStats {
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  last_analysis?: string;    // ISO 8601
  files_analyzed: number;
  lines_of_code: number;
}
```

---

## Analysis Domain Models

From metabob-analysis-api.

### Analysis Jobs

```typescript
export interface AnalysisJob {
  job_id: string;            // UUID
  session_id: string;        // Session context
  org_id: string;            // Multi-tenant isolation
  project_id: string;        // Project context
  status: JobStatus;
  progress: number;          // 0-100
  files_submitted: string[]; // Paths submitted for analysis
  files_analyzed: string[];  // Paths analyzed so far
  started_at?: string;       // ISO 8601
  completed_at?: string;     // ISO 8601
  duration_ms?: number;
  problems_found: number;
  components_extracted: number;
  error_message?: string;
}

export type JobStatus = "pending" | "running" | "complete" | "failed";
```

### Problems (Issues)

```typescript
export interface Problem {
  problem_id: string;        // UUID
  job_id: string;            // Analysis job that found this
  session_id: string;
  org_id: string;
  project_id: string;
  file_path: string;         // Relative to project root
  component_id?: string;     // Format: "file.ts::ComponentName"
  category: ProblemCategory;
  severity: ProblemSeverity;
  summary: string;           // One-line description
  description: string;       // Detailed explanation
  start_line: number;
  end_line: number;
  code_snippet?: string;
  status: ProblemStatus;
  resolved_at?: string;      // ISO 8601
  resolution_summary?: string;
  fixed_in_commit?: string;  // Git commit hash
  impact_score?: number;     // 0-100 (from CPG analysis)
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
```

### Code Components & Annotations

```typescript
export interface CodeComponent {
  component_id: string;      // Format: "file.ts::ComponentName"
  project_id: string;
  file_path: string;
  component_name: string;    // Class/function/module name
  component_type: "class" | "function" | "module" | "interface";
  start_line: number;
  end_line: number;
  signature?: string;        // Type signature
  complexity_score?: number; // Cyclomatic complexity
  annotations_count: number;
  last_annotated_at?: string; // ISO 8601
  created_at: string;
  updated_at: string;
}

export interface ComponentAnnotation {
  annotation_id: string;     // UUID
  component_id: string;
  content: string;           // Markdown-formatted
  annotation_type: AnnotationType;
  related_problem_id?: string;
  tags: string[];            // Searchable tags
  created_at: string;        // ISO 8601
  created_by: string;        // session_id or username
}

export type AnnotationType =
  | "design_decision"
  | "resolved_challenge"
  | "implementation_note"
  | "warning";
```

---

## Activity Domain Models

From metabob-activity-api.

### Activity Templates

```typescript
export interface ActivityTemplate {
  template_id: string;       // Unique identifier
  variant_id: string;        // Content-addressable variant
  name: string;
  description: string;
  category: ActivityCategory;
  scope: "global" | "org" | "project";
  org_id?: string;           // For org-scoped
  project_id?: string;       // For project-scoped
  tasks: ActivityTask[];
  expected_value: number;    // Thompson Sampling score
  success_rate: number;      // 0.0 to 1.0
  avg_cost: number;          // USD
  avg_duration: number;      // Milliseconds
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}

export type ActivityCategory =
  | "feature"
  | "bugfix"
  | "refactor"
  | "tool"
  | "infrastructure";

export interface ActivityTask {
  task_id: string;
  description: string;
  prompt: {
    template: string;
    variables: Variable[];
  };
  validation?: {
    required_files?: string[];
    required_patterns?: string[];
    forbidden_patterns?: string[];
  };
  retry?: {
    max_attempts: number;
    strategy: "exponential" | "linear" | "immediate";
  };
}

export interface Variable {
  name: string;
  type: "string" | "number" | "boolean" | "file" | "impulse";
  required: boolean;
  default?: unknown;
  description?: string;
}
```

### Activity Executions

```typescript
export interface ActivityExecution {
  execution_id: string;      // UUID
  template_id: string;
  variant_id: string;
  org_id: string;
  project_id: string;
  username: string;          // User who triggered (1:1 with API key)
  started_at: string;        // ISO 8601
  completed_at?: string;     // ISO 8601
  success: boolean;
  cost_usd: number;
  duration_ms: number;
  tokens: {
    input: number;
    output: number;
    cache: number;
  };
  error_message?: string;
  trace: ExecutionTrace;
}

export interface ExecutionTrace {
  task_executions: TaskExecution[];
  tool_calls: ToolCall[];
  impulses_loaded: string[];
}

export interface TaskExecution {
  task_id: string;
  started_at: string;
  completed_at: string;
  success: boolean;
  llm_calls: number;
  tool_calls: number;
  error?: string;
}

export interface ToolCall {
  tool_name: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: string;
  duration_ms: number;
}
```

---

## Analytics Models

Aggregated metrics for dashboard visualization.

### Template Analytics

```typescript
export interface TemplateAnalytics {
  template_id: string;
  name: string;
  category: ActivityCategory;
  execution_count: number;
  success_rate: number;      // 0.0 to 1.0
  avg_cost_usd: number;
  avg_duration_ms: number;
  avg_tokens: {
    input: number;
    output: number;
    cache: number;
  };
  last_execution: string;    // ISO 8601
}
```

### Project Analytics

```typescript
export interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  time_range: {
    start: string;           // ISO 8601
    end: string;             // ISO 8601
  };
  issues: {
    opened: number;
    resolved: number;
    delta: number;           // opened - resolved (positive = worsening)
  };
  quality_trend: {
    code_complexity: number; // Average cyclomatic complexity
    technical_debt_score: number; // 0-100
    test_coverage?: number;  // Percentage
  };
  activity_stats: {
    executions: number;
    success_rate: number;
    total_cost: number;
  };
}
```

### API Key Analytics

```typescript
export interface APIKeyAnalytics {
  username: string;          // User/API key name (1:1)
  key_prefix: string;        // e.g., "sk-ant-****"
  total_activities: number;
  total_analyses: number;
  total_cost: number;
  success_rate: number;
  last_activity: string;     // ISO 8601
  cost_breakdown: {
    activities: number;      // USD
    analyses: number;        // USD
  };
}
```

### Trend Data

```typescript
export interface TrendData {
  metric: "executions" | "issues" | "quality" | "cost";
  time_series: TrendPoint[];
  summary: {
    current: number;
    previous: number;
    change_percent: number;  // Positive = increase
  };
}

export interface TrendPoint {
  timestamp: string;         // ISO 8601
  value: number;
  label?: string;            // Human-readable label
}
```

---

## WebSocket Event Models

Real-time events pushed to dashboard.

### Event Types

```typescript
export type DashboardEventType =
  | "job_status"
  | "problem_created"
  | "execution_complete"
  | "execution_started"
  | "problem_resolved";

export interface DashboardEvent {
  type: DashboardEventType;
  data: JobStatusEvent | ProblemEvent | ExecutionEvent;
  timestamp: string;         // ISO 8601
}

export interface JobStatusEvent {
  job_id: string;
  status: JobStatus;
  progress: number;
  current_file?: string;
}

export interface ProblemEvent {
  problem_id: string;
  project_id: string;
  severity: ProblemSeverity;
  category: ProblemCategory;
  file_path: string;
  summary: string;
  status: ProblemStatus;
}

export interface ExecutionEvent {
  execution_id: string;
  template_id: string;
  template_name: string;
  success: boolean;
  duration_ms: number;
  cost_usd: number;
}
```

---

## UI State Models

Dashboard-specific state management.

### Auth State

```typescript
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  organization: Organization | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}
```

### Project Context State

```typescript
export interface ProjectContextState {
  currentProject: Project | null;
  projects: Project[];
  defaultProject: Project | null;
  loading: boolean;
  error: string | null;
}
```

### WebSocket State

```typescript
export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastEvent?: DashboardEvent;
  error: string | null;
}
```

---

## Form Models

Data structures for forms and dialogs.

### Create Project Form

```typescript
export interface CreateProjectForm {
  name: string;
  repository_url?: string;
  branch?: string;
  settings: Partial<ProjectSettings>;
}
```

### Generate API Key Form

```typescript
export interface GenerateAPIKeyForm {
  username: string;          // Will also be key name
  email: string;
  permissions: Permission[];
}
```

### Filter State

```typescript
export interface ProblemFilters {
  severity: ProblemSeverity[];
  category: ProblemCategory[];
  status: ProblemStatus[];
  search?: string;
  project_id?: string;
}

export interface ActivityFilters {
  category: ActivityCategory[];
  success?: boolean;
  time_range?: {
    start: string;
    end: string;
  };
}
```

---

## Validation Schemas (Zod)

Runtime validation for API responses.

```typescript
import { z } from "zod";

export const UserSchema = z.object({
  user_id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  org_id: z.string().uuid(),
  created_at: z.string(),
  last_login: z.string().optional(),
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
    last_analysis: z.string().optional(),
    files_analyzed: z.number(),
    lines_of_code: z.number(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProblemSchema = z.object({
  problem_id: z.string().uuid(),
  job_id: z.string().uuid(),
  session_id: z.string().uuid(),
  org_id: z.string().uuid(),
  project_id: z.string().uuid(),
  file_path: z.string(),
  category: z.enum(["bug", "security", "performance", "maintainability", "style"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  summary: z.string(),
  description: z.string(),
  start_line: z.number(),
  end_line: z.number(),
  status: z.enum(["open", "resolved", "ignored"]),
  created_at: z.string(),
  updated_at: z.string(),
});
```

---

## Type Guards

Helper functions for type narrowing.

```typescript
export function isProblemEvent(event: DashboardEvent): event is DashboardEvent & { data: ProblemEvent } {
  return event.type === "problem_created" || event.type === "problem_resolved";
}

export function isExecutionEvent(event: DashboardEvent): event is DashboardEvent & { data: ExecutionEvent } {
  return event.type === "execution_complete" || event.type === "execution_started";
}

export function isDefaultProject(project: Project): boolean {
  return project.is_default === true;
}
```

---

## Constants

```typescript
export const SEVERITY_COLORS = {
  critical: "error",        // Tailwind: error (red)
  high: "critical",         // Tailwind: critical (purple)
  medium: "accent",         // Tailwind: accent (blue)
  low: "info",             // Tailwind: info (light blue)
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

## References

- Analysis API Schemas: `openspec/changes/analysis-api-extraction/specs/data-schemas/spec.md`
- Activity API: `repos/metabob-activity-api/src/models/schemas.ts`
- SurrealDB Tables: Shared namespace `activity_system`, database `learning_loop`
