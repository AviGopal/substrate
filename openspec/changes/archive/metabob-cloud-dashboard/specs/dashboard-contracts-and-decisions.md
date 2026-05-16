# Metabob Cloud Dashboard: Contracts and Decision Specification

**Version:** 2.0.0
**Status:** Draft
**Created:** 2026-03-25
**Updated:** 2026-03-25

---

## 1. Executive Summary

The Metabob Cloud Dashboard serves two complementary purposes:

### 1.1 External Product (Enterprise Customers)

For enterprise customers like NEC, the dashboard is the **observability and control layer** for Metabob's AI code analysis capabilities:

- **Code Quality Insights**: View issues detected by Graph Neural Networks + LLMs that traditional static analysis misses
- **CI/CD Quality Gate**: Track pass/fail status and quality trends across repositories
- **Team Adoption Metrics**: Understand how teams are using the analysis tools
- **ROI Justification**: Prove value to leadership with concrete metrics

**Pricing Tiers:**
| Tier | Price | Key Features |
|------|-------|--------------|
| Developer | Free | Basic analysis, individual use |
| Team | $30/dev/mo | CI/CD integration, quality gates, audit trails, project insights |
| Enterprise | Custom | SSO, advanced security, dedicated support |

### 1.2 Internal System (MiniBob Observability)

The dashboard is also the **observability layer** for the autonomous AI development system:

- **Activity Execution Monitoring**: Track MiniBob's real-time activity execution
- **Learning Loop Visualization**: See how Thompson Sampling improves template selection
- **Template Evolution**: Watch variants emerge and converge toward optimal solutions

**Core Purpose:** Enable humans to observe, understand, and guide autonomous development through data-driven decisions while providing enterprise customers with actionable code quality insights.

---

## 2. User Psychology Framework

Understanding what users need psychologically to trust and adopt the system:

### 2.1 The Six Psychological Needs

| Need | Question | Dashboard Response |
|------|----------|-------------------|
| **Trust** | "Is this AI actually helping?" | Show issues found that would have been missed, with concrete code examples |
| **Value** | "Am I getting ROI?" | Display cost savings, bugs prevented, time saved metrics |
| **Control** | "Can I steer this?" | Provide severity filters, ignore options, configuration controls |
| **Safety** | "Will this break production?" | Show validation status, sandbox testing results, rollback options |
| **Proof** | "How do I justify to leadership?" | Generate exportable reports, trend charts, team comparisons |
| **Adoption** | "Is my team using this?" | Display usage analytics, active users, integration status |

### 2.2 Time-to-Value Target

**Goal: 3-5 seconds from login to first valuable insight**

```
Login → Authentication (1s)
     → Overview loads (2s)
     → User sees: Critical issues count + Recent activity

Total: 3-5 seconds to first decision point
```

### 2.3 Value Delivery per Page

| Page | Primary Value | Time to Value |
|------|--------------|---------------|
| Overview | "System is healthy, 3 critical issues" | 3-5 seconds |
| Projects | "Project X has most issues" | +2 seconds |
| Issues | "This issue will cause production bug" | +3 seconds |
| Events | "Current execution is progressing" | Real-time |
| API Keys | "Secure programmatic access" | +2 seconds |
| Value & Impact | "Justified ROI for leadership" | +5 seconds |

---

## 3. User Flows: Entry to Value

### 3.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User arrives at dashboard.metabob.local                           │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐   No token    ┌─────────────┐                     │
│  │ Check JWT   │──────────────▶│ Login Page  │                     │
│  │ in storage  │               │ (form)      │                     │
│  └─────────────┘               └──────┬──────┘                     │
│         │                             │                             │
│         │ Valid token                 │ Submit credentials          │
│         │                             ▼                             │
│         │                    ┌─────────────────┐                   │
│         │                    │ POST /v2/auth/  │                   │
│         │                    │     login       │                   │
│         │                    └────────┬────────┘                   │
│         │                             │                             │
│         │                             ▼                             │
│         │                    ┌─────────────────┐                   │
│         │                    │ Store JWT in    │                   │
│         │                    │ sessionStorage  │                   │
│         │                    └────────┬────────┘                   │
│         │                             │                             │
│         ▼                             ▼                             │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                    OVERVIEW PAGE                         │       │
│  │  (First valuable view: 3-5 seconds from auth)           │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
| Step | API | Endpoint | Response Time Target |
|------|-----|----------|---------------------|
| Login | metabob-analysis-api | `POST /v2/auth/login` | <500ms |
| Verify | metabob-analysis-api | `GET /v2/auth/me` | <100ms |

### 3.2 Code Quality Investigation Flow (Enterprise)

```
┌─────────────────────────────────────────────────────────────────────┐
│               CODE QUALITY INVESTIGATION FLOW                        │
│         (Primary enterprise customer flow - NEC example)             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User logs in                                                       │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ OVERVIEW PAGE                                            │       │
│  │ ─────────────────                                        │       │
│  │ Sees: "3 critical issues, 12 high, 45 medium"           │       │
│  │ Decision: "I need to address the critical ones"          │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ PROJECTS PAGE                                            │       │
│  │ ─────────────                                            │       │
│  │ Sees: Project list sorted by issue count                 │       │
│  │ Decision: "frontend-app has 42 issues, investigate"      │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ ISSUES PAGE (filtered by project)                        │       │
│  │ ───────────────────────────────                          │       │
│  │ Sees: Issue list with severity badges                    │       │
│  │ Actions:                                                  │       │
│  │   - Filter by severity: critical                         │       │
│  │   - Click issue to see code context                       │       │
│  │   - Mark as resolved or ignored                          │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ ISSUE DETAIL (modal or panel)                            │       │
│  │ ──────────────────────────────                           │       │
│  │ Sees:                                                     │       │
│  │   - Code snippet with highlighted issue                  │       │
│  │   - AI-generated explanation                              │       │
│  │   - Suggested fix                                         │       │
│  │ Decision: "Apply fix" or "Mark as false positive"        │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
| Step | API | Endpoint | Data |
|------|-----|----------|------|
| Overview metrics | metabob-analysis-api | `GET /v2/projects` | Project list with issue counts |
| Overview metrics | metabob-activity-api | `GET /v2/activities/metrics` | Execution stats |
| Projects list | metabob-analysis-api | `GET /v2/projects` | Full project details |
| Issues list | metabob-analysis-api | `GET /v2/projects/:id/problems` | Filtered issues |
| Issue detail | metabob-analysis-api | `GET /v2/problems/:id` | Full issue + context |
| Mark resolved | metabob-analysis-api | `PUT /v2/problems/:id` | Update status |

### 3.3 Learning System Observation Flow (Internal)

```
┌─────────────────────────────────────────────────────────────────────┐
│              LEARNING SYSTEM OBSERVATION FLOW                        │
│              (AI Development Researcher)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User logs in (researcher)                                          │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ OVERVIEW PAGE                                            │       │
│  │ ─────────────────                                        │       │
│  │ Sees: "32 executions today, 78% success rate"           │       │
│  │ Decision: "Success rate is improving, check details"     │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ VALUE & IMPACT PAGE                                      │       │
│  │ ──────────────────                                       │       │
│  │ Sees:                                                     │       │
│  │   - Thompson Sampling convergence chart                  │       │
│  │   - Template success rate rankings                       │       │
│  │   - Cost per success trend                               │       │
│  │ Decision: "Template X needs improvement"                  │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ DEVELOPMENT EVENTS PAGE                                  │       │
│  │ ────────────────────────                                 │       │
│  │ Sees: Real-time execution stream                         │       │
│  │   - Current execution progress                           │       │
│  │   - Recent completions/failures                          │       │
│  │ Actions:                                                  │       │
│  │   - Click execution to see trace details                 │       │
│  │   - Filter by template or status                         │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
| Step | API | Endpoint | Data |
|------|-----|----------|------|
| Overview metrics | metabob-activity-api | `GET /v2/activities/metrics` | Aggregate stats |
| Recent executions | metabob-activity-api | `GET /v2/activities/execution-traces?limit=10` | Execution list |
| Template ranking | metabob-activity-api | `GET /v2/activities/templates` | Template performance |
| Thompson scores | metabob-activity-api | `POST /v2/activities/recommend` | Alpha/beta values |
| Live events | metabob-activity-api | `WebSocket /ws` | Real-time updates |
| Execution detail | metabob-activity-api | `GET /v2/activities/execution-traces/:id` | Full trace |

### 3.4 CI/CD Integration Flow (DevOps)

```
┌─────────────────────────────────────────────────────────────────────┐
│                   CI/CD INTEGRATION FLOW                             │
│                   (DevOps Engineer)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User logs in (DevOps)                                              │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ OVERVIEW PAGE                                            │       │
│  │ ─────────────────                                        │       │
│  │ Sees: Connection status indicators (all green)           │       │
│  │ Decision: "System is healthy, check API key status"      │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ API KEYS PAGE                                            │       │
│  │ ─────────────                                            │       │
│  │ Sees:                                                     │       │
│  │   - List of active API keys                              │       │
│  │   - Last used timestamps                                  │       │
│  │   - Request counts                                        │       │
│  │ Actions:                                                  │       │
│  │   - Create new key for CI/CD                             │       │
│  │   - Revoke unused keys                                   │       │
│  │   - Copy key (shown once on creation)                    │       │
│  └──────────────────────────┬──────────────────────────────┘       │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ PROJECTS PAGE                                            │       │
│  │ ─────────────                                            │       │
│  │ Sees: Repositories configured for analysis               │       │
│  │ Actions:                                                  │       │
│  │   - Add new repository                                   │       │
│  │   - Configure quality gate thresholds                    │       │
│  │   - View integration status                              │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
| Step | API | Endpoint | Data |
|------|-----|----------|------|
| Health check | metabob-analysis-api | `GET /health` | API status |
| Health check | metabob-activity-api | `GET /health` | API status |
| API keys list | metabob-analysis-api | `GET /v2/api-keys` | Key metadata |
| Create key | metabob-analysis-api | `POST /v2/api-keys` | New key (shown once) |
| Projects | metabob-analysis-api | `GET /v2/projects` | Repository list |

---

## 4. System Context: What Generates the Data

### 4.1 MiniBob (Vessel)

**Purpose:** MiniBob is a minimal execution environment (~3,000 LOC TypeScript/Bun) that autonomously executes development activities. It's the "vessel" that manifests the process-of-becoming.

**What MiniBob Does:**
- Executes activity templates (structured JSON workflows)
- Uses LLM (Claude) to complete tasks within activities
- Captures execution traces with full state snapshots
- Modifies codebases via git operations
- Self-improves through "boredom activities" when idle

**Data MiniBob Generates:**
```typescript
ExecutionTrace {
  execution_id: string           // Unique identifier
  variant_id: string             // Which template variant executed
  activity_id: string            // Base activity type
  success: boolean               // Pass/fail outcome
  duration_ms: number            // Time taken
  cost_usd: number               // LLM cost
  tokens: {
    input: number
    output: number
    cache: number
  }
  state_snapshot: {
    input_state: {
      filesAvailable: string[]
      impulses: string[]         // Context injected
    }
    output_state: {
      filesModified: string[]
      filesCreated: string[]
      filesDeleted: string[]
    }
  }
  tasks: Array<{
    task_id: string
    status: 'completed' | 'failed'
    duration_ms: number
    tool_calls: Array<{
      tool: string
      success: boolean
    }>
  }>
}
```

### 4.2 metabob-mcp (Analysis Bridge)

**Purpose:** MCP (Model Context Protocol) server that exposes code analysis capabilities to AI agents.

**What metabob-mcp Does:**
- Provides 7 analysis tools for AI agents
- Bridges MiniBob to metabob-analysis-api
- Rate limits and circuit-breaks external calls
- Returns structured analysis for implementation planning

**Tools Exposed:**
| Tool | Purpose |
|------|---------|
| `get_priority_issues` | Identify critical codebase problems |
| `search_codebase` | Semantic search through issues |
| `annotate_component` | Document decisions |
| `suggest_related_changes` | Co-change prediction |
| `analyze_change_impact` | Graph-based downstream effects |
| `mark_problem_complete` | Track resolution |
| `generate_implementation_spec` | Create structured plans |

### 4.3 metabob-activity-api (Learning Backend)

**Purpose:** Stores execution traces, computes learning metrics, and provides Thompson Sampling recommendations.

**What the API Does:**
- Receives and stores execution traces
- Computes variant performance metrics
- Updates Thompson Sampling parameters (α, β)
- Tracks impulse relevance and tool effectiveness
- Records activity composition patterns

### 4.4 Data Flow Summary

```
MiniBob executes activity
       ↓
Captures execution trace + state snapshot
       ↓
POST /v2/activities/execution-traces → metabob-activity-api
       ↓
API stores in SurrealDB + updates metrics
       ↓
Dashboard fetches via REST/WebSocket
       ↓
Users observe, analyze, decide
```

---

## 5. Complete Data Sourcing Reference

### 5.1 metabob-analysis-api (Primary for Enterprise)

**Purpose:** Authentication, projects, code analysis results

| Category | Endpoint | Response | Dashboard Usage |
|----------|----------|----------|-----------------|
| **Auth** | `POST /v2/auth/signup` | `{ user, token }` | Registration |
| | `POST /v2/auth/login` | `{ user, token }` | Login page |
| | `GET /v2/auth/me` | `{ user }` | Header user menu |
| | `POST /v2/auth/refresh` | `{ token }` | Token renewal |
| **Projects** | `GET /v2/projects` | `{ projects[] }` | Projects page, Overview counts |
| | `POST /v2/projects` | `{ project }` | Create project modal |
| | `GET /v2/projects/:id` | `{ project }` | Project detail view |
| | `PUT /v2/projects/:id` | `{ project }` | Edit project modal |
| | `DELETE /v2/projects/:id` | `{ success }` | Delete confirmation |
| **Problems** | `GET /v2/projects/:id/problems` | `{ problems[], total }` | Issues page |
| | `GET /v2/problems/:id` | `{ problem }` | Issue detail modal |
| | `PUT /v2/problems/:id` | `{ problem }` | Update issue status |
| **API Keys** | `GET /v2/api-keys` | `{ keys[] }` | API Keys page |
| | `POST /v2/api-keys` | `{ key, secret }` | Create key dialog |
| | `DELETE /v2/api-keys/:id` | `{ success }` | Revoke key |
| **Health** | `GET /health` | `{ status }` | Connection indicator |

**JWT Token Structure:**
```typescript
interface AnalysisAPIToken {
  iss: 'https://metabob.com'
  sub: string           // user ID
  iat: number           // issued at (Unix timestamp)
  exp: number           // expiration (15 min default)
  user_id: string
  org_id: string
  role: 'admin' | 'member' | 'viewer'
  project_ids: string[]
}
```

### 5.2 metabob-activity-api (Primary for Learning System)

**Purpose:** Execution traces, Thompson Sampling, metrics, real-time events

| Category | Endpoint | Response | Dashboard Usage |
|----------|----------|----------|-----------------|
| **Templates** | `GET /v2/activities/templates` | `{ templates[] }` | Activity Library |
| | `GET /v2/activities/templates/:id` | `{ template }` | Template detail |
| **Executions** | `GET /v2/activities/execution-traces` | `{ executions[], total }` | Events page, Overview |
| | `GET /v2/activities/execution-traces/:id` | `{ execution }` | Execution detail |
| | `POST /v2/activities/execution-traces` | `{ execution }` | (MiniBob only) |
| **Learning** | `POST /v2/activities/recommend` | `{ recommendations[] }` | Thompson Sampling view |
| | `GET /v2/activities/metrics` | `{ metrics }` | Overview, Value page |
| **Composition** | `GET /v2/activities/composition/graph` | `{ nodes[], edges[] }` | Composition graph view |
| | `POST /v2/activities/composition` | `{ success }` | (MiniBob only) |
| **Analysis** | `POST /v2/activities/impulse-relevance` | `{ success }` | (MiniBob only) |
| | `POST /v2/activities/tool-usage` | `{ success }` | Tool analytics |
| | `GET /v2/activities/execution-sequences` | `{ sequences[] }` | Sequence analysis |
| **Vessels** | `GET /v2/vessels/status` | `{ vessels[] }` | Vessel health (future) |
| **Real-time** | `WebSocket /ws` | `{ type, payload }` | Live event stream |
| **Health** | `GET /health` | `{ status }` | Connection indicator |

**Thompson Sampling Response:**
```typescript
interface ThompsonRecommendation {
  template_id: string
  variant_id: string
  score: number          // Sampled probability
  alpha: number          // Successes + 1
  beta: number           // Failures + 1
  expected_value: number // alpha / (alpha + beta)
  confidence: number     // Sample variance
}
```

### 5.3 metabob-mcp (Indirect - MiniBob Tools)

**Purpose:** Code analysis tools exposed to AI agents via MCP protocol

The dashboard does **not** directly call metabob-mcp. MiniBob uses these tools during activity execution, and the results flow through execution traces stored in metabob-activity-api.

| Tool | Purpose | Data Visible in Dashboard |
|------|---------|--------------------------|
| `get_priority_issues` | Find critical problems | Issues shown in execution trace |
| `search_codebase` | Semantic code search | Search results in tool calls |
| `analyze_change_impact` | Downstream effect analysis | Impact report in trace |
| `suggest_related_changes` | Co-change prediction | Suggestions in trace |
| `annotate_component` | Document decisions | Annotations in trace |
| `mark_problem_complete` | Track resolution | Status changes in trace |
| `generate_implementation_spec` | Create structured plans | Spec in trace output |

**MCP Tool Call in Execution Trace:**
```typescript
interface ToolCall {
  tool: string           // e.g., 'get_priority_issues'
  arguments: object      // Tool-specific parameters
  result: unknown        // Tool response
  success: boolean
  duration_ms: number
  error?: string
}
```

### 5.4 Data Aggregation by Dashboard Page

| Page | metabob-analysis-api | metabob-activity-api | Priority |
|------|---------------------|---------------------|----------|
| **Overview** | Projects count, Critical issues | Execution count, Success rate | Both equal |
| **Projects** | Project CRUD, Issue counts | — | Analysis primary |
| **Issues** | Problems list, Status updates | — | Analysis primary |
| **Events** | — | Execution stream, WebSocket | Activity primary |
| **API Keys** | Key management | — | Analysis primary |
| **Value & Impact** | — | Templates, Metrics, Thompson | Activity primary |

---

## 6. User Personas and Their Decisions

### 6.1 Enterprise Code Quality Engineer (NEC example)

**Context:** Enterprise customer paying $30/dev/mo for Team tier

**Goal:** Ensure code quality meets enterprise standards before deployment

**Key Questions:**
- What issues did the AI find that our static analyzers missed?
- Is this a false positive or real issue?
- What's the trend in our codebase quality?
- Can I justify the ROI to my manager?

**Dashboard Actions:**
- Review critical issues in Issues page
- Drill into code context for each issue
- Mark false positives as ignored
- Export quality reports for stakeholders
- Configure quality gate thresholds

**Critical Metrics:**
| Metric | Decision Threshold |
|--------|-------------------|
| Critical Issues | 0 = pass quality gate |
| Issue Resolution Rate | >90% = healthy trend |
| False Positive Rate | <10% = good precision |
| Time to Resolution | <24h for critical |

**Time-to-Value Path:**
```
Login → Overview (3s) → Projects (2s) → Issues filtered by critical (3s)
Total: ~8 seconds to actionable issue list
```

### 6.2 AI Development Researcher

**Goal:** Validate that autonomous self-improvement is working

**Key Questions:**
- Is the system learning from successes and failures?
- Are Thompson Sampling parameters converging?
- Which activity variants are winning?
- What patterns emerge from compositions?

**Dashboard Actions:**
- Monitor Learning System tab for convergence
- Track variant genealogy (parent→child evolution)
- Analyze failure patterns to guide improvements
- Compare exploration vs exploitation ratios

**Critical Metrics:**
| Metric | Decision Threshold |
|--------|-------------------|
| Success Rate Trend | Increasing = learning works |
| Thompson α/β Stability | High α, low β = confident selection |
| Variant Generations | More generations = active evolution |
| Composition Success | Multi-activity > single = synergy |

### 6.3 DevOps/SRE Operator

**Goal:** Keep the autonomous system running reliably

**Key Questions:**
- Are all MiniBob pods healthy?
- Is API latency acceptable?
- Are there resource bottlenecks?
- Should I scale up/down?

**Dashboard Actions:**
- Monitor Vessels tab for pod health
- Check connection status indicators
- View API latency and error rates
- Scale pods based on queue depth

**Critical Metrics:**
| Metric | Decision Threshold |
|--------|-------------------|
| Pod Status | All green = healthy |
| API Latency | <50ms p95 = acceptable |
| Memory Usage | <80% = safe headroom |
| Restart Count | >3 = investigate |

### 6.4 Product Manager

**Goal:** Understand system capability and ROI

**Key Questions:**
- How many features are generated per week?
- What's the cost per successful execution?
- Which activity types need investment?
- What's blocking higher success rates?

**Dashboard Actions:**
- Review Activity Library for template performance
- Track execution costs over time
- Identify high-value, low-success templates
- Prioritize improvement efforts

**Critical Metrics:**
| Metric | Decision Threshold |
|--------|-------------------|
| Weekly Executions | Growth = adoption |
| Cost per Success | Decreasing = efficiency |
| Template Coverage | Gaps = investment areas |
| Time-to-Production | <24h = fast iteration |

### 6.5 Code Quality Analyst

**Goal:** Ensure generated code meets standards

**Key Questions:**
- What code changes did this execution make?
- Did it include tests?
- Are there breaking changes?
- Should this be merged?

**Dashboard Actions:**
- Review execution traces for state transitions
- Examine file diffs and test coverage
- Flag concerning patterns
- Approve/reject generated code

**Critical Metrics:**
| Metric | Decision Threshold |
|--------|-------------------|
| Files Created/Modified | Scope of change |
| Test Files Included | Required for approval |
| Breaking Changes | Block deployment |
| Validation Passed | Required for merge |

---

## 7. Dashboard Pages: Contracts and Data Requirements

### 7.1 Overview Page

**Purpose:** System health at a glance

**Data Required:**
```typescript
interface OverviewData {
  // System health
  systemStatus: {
    analysisApi: 'operational' | 'degraded' | 'down'
    activityApi: 'operational' | 'degraded' | 'down'
    database: 'connected' | 'disconnected'
  }

  // Aggregate metrics
  metrics: {
    totalProjects: number
    totalIssues: number
    criticalIssues: number
    totalTemplates: number
    totalExecutions: number
    successRate: number  // percentage
  }

  // Recent activity
  recentExecutions: Array<{
    id: string
    templateName: string
    status: 'success' | 'failed' | 'running'
    startedAt: string  // ISO timestamp
    goalDescription?: string
  }>
}
```

**API Contracts:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | API liveness |
| `/v2/activities/execution-traces?limit=10` | GET | Recent executions |
| `/v2/activities/templates` | GET | Template count |
| `/v2/projects` | GET | Project count |

**User Decisions:**
- Is the system healthy enough for production?
- Are there error patterns requiring attention?
- Should I investigate recent failures?

### 7.2 Projects Page

**Purpose:** Manage analysis projects

**Data Required:**
```typescript
interface Project {
  id: string
  name: string
  repository_url?: string
  status: 'active' | 'archived' | 'pending'
  issues_count: number
  created_at: string
  updated_at: string
}
```

**API Contracts:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/projects` | GET | List projects |
| `/v2/projects` | POST | Create project |
| `/v2/projects/:id` | PUT | Update project |
| `/v2/projects/:id` | DELETE | Delete project |
| `/v2/projects/:id/problems` | GET | Get issues |

**User Decisions:**
- Which projects need attention (high issue count)?
- Should I archive inactive projects?
- Which repositories to add for analysis?

### 7.3 Issues Page

**Purpose:** Track and resolve code problems

**Data Required:**
```typescript
interface Problem {
  id: string
  project_id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'resolved' | 'ignored'
  title: string
  description: string
  file_path: string
  line_number?: number
  code_context?: string
  suggestion?: string
  created_at: string
  resolved_at?: string
}
```

**API Contracts:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/projects/:id/problems` | GET | List issues |
| `/v2/problems/:id` | GET | Issue details |
| `/v2/problems/:id` | PUT | Update status |

**User Decisions:**
- Which critical issues to address first?
- Should I ignore false positives?
- Is the issue resolution trend positive?

### 7.4 Development Events Page

**Purpose:** Real-time activity monitoring

**Data Required:**
```typescript
interface DevelopmentEvent {
  id: string
  type: 'activity' | 'problem' | 'metric'
  title: string
  description?: string
  timestamp: string
  status: 'success' | 'failed' | 'running' | 'pending'
  metadata?: Record<string, unknown>
}
```

**Connection Contract:**
```typescript
// WebSocket: ws://activity.metabob.local/ws
// Fallback: Polling GET /v2/activities/execution-traces?limit=10

interface WebSocketMessage {
  type: 'execution_started' | 'execution_completed' | 'execution_failed'
  payload: ExecutionTrace
}
```

**User Decisions:**
- Is the current execution progressing normally?
- Should I pause the execution queue?
- Are there concerning real-time patterns?

### 7.5 API Keys Page

**Purpose:** Manage programmatic access

**Data Required:**
```typescript
interface APIKey {
  id: string
  key_prefix: string  // First 8 chars, rest masked
  status: 'active' | 'revoked'
  created_at: string
  last_used_at?: string
  requests_count: number
}
```

**API Contracts:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/api-keys` | GET | List keys |
| `/v2/api-keys` | POST | Create key |
| `/v2/api-keys/:id` | DELETE | Revoke key |

**User Decisions:**
- Are all keys still needed?
- Which keys have suspicious usage patterns?
- Should I rotate old keys?

### 7.6 Value & Impact Page

**Purpose:** ROI and performance analysis

**Data Required:**
```typescript
interface ValueMetrics {
  // Performance over time
  successRateTrend: Array<{
    date: string
    rate: number
  }>

  // Cost analysis
  costAnalysis: {
    totalCost: number
    costPerExecution: number
    costPerSuccess: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }

  // Template performance ranking
  templateRanking: Array<{
    templateId: string
    name: string
    successRate: number
    avgDuration: number
    avgCost: number
    executions: number
  }>

  // Thompson Sampling evolution
  learningProgress: {
    templatesImproved: number
    variantsCreated: number
    convergenceScore: number  // 0-1
  }
}
```

**API Contracts:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/activities/metrics` | GET | Aggregate metrics |
| `/v2/activities/templates` | GET | Template performance |
| `/v2/activities/recommend` | POST | Thompson scores |

**User Decisions:**
- Is the system improving over time?
- Where should we invest in template improvement?
- Is the learning system converging?

---

## 8. Authentication and Authorization

### 8.1 Authentication Flow

```
User enters credentials
       ↓
POST /v2/auth/login { email, password }
       ↓
API validates against SurrealDB (argon2 hash)
       ↓
Returns JWT token + user profile
       ↓
Dashboard stores token in sessionStorage
       ↓
All subsequent requests include Authorization: Bearer <token>
```

### 8.2 JWT Token Contract

```typescript
interface JWTPayload {
  iss: 'https://metabob.com'
  sub: string        // user ID
  iat: number        // issued at
  exp: number        // expiration (15 min)

  // Custom claims
  user_id: string
  org_id: string
  role: 'admin' | 'member' | 'viewer'
  project_ids: string[]
}
```

### 8.3 User Decisions at Auth

- Remember session? (sessionStorage vs logout on close)
- Request password reset?
- Contact admin for access?

---

## 9. Error Handling Contracts

### 9.1 API Error Response Format

```typescript
interface APIError {
  error: {
    code: string           // Machine-readable
    message: string        // Human-readable
    suggestion?: string    // How to fix
    details?: object       // Additional context
  }
}
```

### 9.2 Error Codes and User Decisions

| Code | Meaning | User Action |
|------|---------|-------------|
| `NOT_AUTHENTICATED` | No valid token | Log in again |
| `INVALID_CREDENTIALS` | Wrong password | Check credentials |
| `NOT_AUTHORIZED` | Missing permissions | Contact admin |
| `NOT_FOUND` | Resource missing | Check URL/ID |
| `VALIDATION_ERROR` | Bad input | Fix form data |
| `RATE_LIMITED` | Too many requests | Wait and retry |
| `SERVICE_UNAVAILABLE` | Backend down | Check status page |

### 9.3 Frontend Error Handling

```typescript
// Error boundary catches React errors
<ErrorBoundary>
  <App />
</ErrorBoundary>

// API errors display in-context
{error && (
  <div className="error-message">
    {error.message}
    {error.suggestion && <p>{error.suggestion}</p>}
  </div>
)}
```

---

## 10. Real-Time Updates Contract

### 10.1 WebSocket Protocol

```typescript
// Connection
const ws = new WebSocket('ws://activity.metabob.local/ws')

// Message types
type MessageType =
  | 'execution_started'
  | 'execution_progress'
  | 'execution_completed'
  | 'execution_failed'
  | 'template_updated'
  | 'variant_created'

interface WebSocketMessage {
  type: MessageType
  timestamp: string
  payload: unknown
}

// Reconnection: exponential backoff
// Fallback: HTTP polling every 5 seconds
```

### 10.2 Connection Status Contract

```typescript
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

// User sees:
// 🟢 Connected - Real-time updates active
// 🟡 Connecting - Establishing connection...
// 🔴 Disconnected - Using polling fallback
```

---

## 11. Data Freshness and Caching

### 11.1 Refresh Strategies

| Data Type | Strategy | Interval |
|-----------|----------|----------|
| Execution list | WebSocket + poll | Real-time / 5s |
| Metrics | Poll | 30s |
| Templates | Poll + cache | 60s |
| Projects | Poll | 30s |
| User profile | On-demand | Session start |

### 11.2 Cache Invalidation

```typescript
// Manual refresh available on all pages
<Button onClick={refresh}>↻ Refresh</Button>

// Auto-refresh for metrics
useEffect(() => {
  const interval = setInterval(fetchMetrics, 30000)
  return () => clearInterval(interval)
}, [])
```

---

## 12. Key Decision Points Summary

### 12.1 Enterprise Customer Decisions

| Observation | Decision | Action |
|-------------|----------|--------|
| Critical issue found | Investigate or ignore | Review code context, decide priority |
| False positive rate high | Adjust thresholds | Configure project settings |
| Quality trend declining | Alert team | Create action plan |
| ROI unclear | Generate report | Export metrics for stakeholders |

### 12.2 Researcher Decisions

| Observation | Decision | Action |
|-------------|----------|--------|
| Template success <50% | Needs improvement | Create variant |
| Thompson α >> β | High confidence | Reduce exploration |
| Composition success high | Valuable pattern | Document and reuse |
| Failure on same task | Systematic issue | Rewrite task prompt |

### 12.3 Operator Decisions

| Observation | Decision | Action |
|-------------|----------|--------|
| Pod unhealthy | Investigate | Check logs, restart |
| API latency high | Scale | Add replicas |
| Memory pressure | Resource issue | Increase limits |
| Connection errors | Network issue | Check Istio config |

### 12.4 Product Decisions

| Observation | Decision | Action |
|-------------|----------|--------|
| High cost per success | Inefficient | Optimize prompts |
| Low template coverage | Gap | Create new templates |
| Slow time-to-production | Bottleneck | Parallelize activities |
| Success rate plateau | Convergence | Introduce new variants |

---

## 13. Future Considerations

### 13.1 Missing APIs (To Be Implemented)

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `/v2/projects` | Project CRUD | High |
| `/v2/activities/variants` | Variant management | High |
| `/v2/activities/composition/graph` | Composition visualization | Medium |
| `/v2/learning/convergence` | Thompson convergence metrics | Medium |
| `/v2/vessels/status` | Pod status from K8s | Low |

### 13.2 Dashboard Enhancements

- **Variant comparison view**: Side-by-side diff of template versions
- **Genealogy visualization**: Tree view of variant evolution
- **Composition builder**: Visual activity sequencing
- **Alert configuration**: Custom thresholds and notifications
- **Export/import**: Template sharing between environments

---

## 14. Appendix: Complete API Contract Reference

### Authentication
```
POST /v2/auth/signup      - Create account
POST /v2/auth/login       - Get JWT token
POST /v2/auth/refresh     - Refresh token
GET  /v2/auth/me          - Get current user
```

### Projects
```
GET    /v2/projects              - List projects
POST   /v2/projects              - Create project
GET    /v2/projects/:id          - Get project
PUT    /v2/projects/:id          - Update project
DELETE /v2/projects/:id          - Delete project
GET    /v2/projects/:id/problems - List issues
```

### Activities
```
GET  /v2/activities/templates           - List templates
GET  /v2/activities/templates/:id       - Get template
GET  /v2/activities/execution-traces    - List executions
GET  /v2/activities/execution-traces/:id - Get execution
POST /v2/activities/recommend           - Thompson selection
GET  /v2/activities/metrics             - Aggregate metrics
```

### API Keys
```
GET    /v2/api-keys      - List keys
POST   /v2/api-keys      - Create key
DELETE /v2/api-keys/:id  - Revoke key
```

### Health
```
GET /health              - API liveness
```

---

*This specification captures the contracts and decision points for the Metabob Cloud Dashboard as of the current implementation. It should be updated as new features are added.*
