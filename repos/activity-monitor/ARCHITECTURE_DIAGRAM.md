# Activity Monitor - Architecture Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ACTIVITY MONITOR SYSTEM                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │  Browser (Client)│
                              │  • HTML5         │
                              │  • JavaScript    │
                              │  • CSS3 Theme    │
                              └────────┬─────────┘
                                       │
                        Polling /api/data (3s)
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │   Bun HTTP Server (Hono)         │
                    │   Port: 3030                      │
                    ├──────────────────────────────────┤
                    │ Routes:                           │
                    │  GET /          → HTML Dashboard  │
                    │  GET /api/data  → JSON Cache      │
                    │  GET /api/health→ Health Check    │
                    └────────┬──────────────────────────┘
                             │
             ┌───────────────┼───────────────┐
             │ In-Memory     │ Polling Task  │
             │ Cache         │ (3s interval) │
             └───────────────┼───────────────┘
                             │
         ┌───────────────────┴───────────────────────┐
         │    6 Parallel API Calls per Update        │
         └───────────────────┬───────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
  Executions            Templates            Impulses
  GET /v2/activities   GET /v2/activities   GET /v2/impulses
  /executions          /templates           /resolution-metrics
  ?limit=50                                  ?limit=20
        │                    │                    │
        └────────────────────┼────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
  Compositions        Relevance            Recommendations
  GET /v2/activities GET /v2/activities   GET /v2/activities
  /composition/graph  /impulse-relevance  /recommend
  ?limit=100          ?limit=50
        │
        └────────────────────┬────────────────────┐
                             │
         ┌───────────────────▼───────────────────┐
         │  metabob-activity-api                 │
         │  https://activity.metabob.com         │
         │                                        │
         │  Authentication: ApiKey Header         │
         └─────────────────────────────────────┘
```

## Data Flow - Update Cycle

```
TIME: 0s                                    TIME: 3s
┌──────────────────┐                   ┌──────────────────┐
│ updateDashboard()│                   │ updateDashboard()│
│  starts          │                   │  starts (repeat) │
└────────┬─────────┘                   └────────┬─────────┘
         │                                      │
    GET /api/data                          GET /api/data
         │                                      │
         ▼                                      ▼
┌──────────────────────────────────────────────────────┐
│  Browser receives cached data                        │
│  • executions[]                                      │
│  • templates[]                                       │
│  • scores[] (derived)                                │
│  • impulses[]                                        │
│  • compositions[]                                    │
│  • recommendations                                   │
│  • relevance[]                                       │
│  • taskViews[]                                       │
│  • sources[] (data source health)                    │
│  • lastUpdate (timestamp)                            │
└────────┬─────────────────────────────────────────────┘
         │
         │ renderExecutions()
         │ renderLearningMetrics()
         │ renderTemplates()
         │ renderScores()
         │ renderImpulses()
         │ renderDataSources()
         │ renderCompositions()
         │ renderRecommendations()
         │ renderRelevance()
         │ renderTaskViews()
         │
         ▼
   Dashboard Updated ✓
         │
    Wait 3s
         │
    REPEAT
```

## Backend Update Cycle

```
SERVER STARTUP
     │
     ▼
┌─────────────────────┐
│ Initial updateCache │
└────────┬────────────┘
         │
    setInterval(3000)
         │
         ▼
    ┌────────────────────────────────────────────┐
    │ updateCache() - Every 3 seconds            │
    │ Logs: "Updating cache..."                  │
    └────────────┬───────────────────────────────┘
                 │
    ┌────────────┼────────────────────┬─────────────┐
    │            │                    │             │
    ▼            ▼                    ▼             ▼
 GET         GET                 GET              GET
 /executions /templates          /impulses        /compositions
 FILTER      DERIVE              METRICS          GRAPH
 auth_*      scores                               LIMIT 100
 LIMIT 50    (α/β→score)         LIMIT 20
             
 ✓ Healthy  ✓ Healthy           ⚠ Error          ✓ Healthy
                                 (auth req'd)
    │            │                    │             │
    └────────────┼────────────────────┼─────────────┘
                 │
    ┌────────────┼────────────────────┬─────────────┐
    │            │                    │             │
    ▼            ▼                    ▼             ▼
 GET          GET                 GET
 /relevance   /recommend          (EXTRACT)
 LIMIT 50     (POST)             taskViews
                                  (first 10)
 ✓ Healthy    ⚠ TBD              ✓ Healthy
    │            │                    │
    └────────────┼────────────────────┘
                 │
         ┌───────▼────────┐
         │ Update Cache:  │
         │ • executions   │
         │ • templates    │
         │ • impulses     │
         │ • scores       │
         │ • compositions │
         │ • relevance    │
         │ • taskViews    │
         │ • lastUpdate   │
         │ • dataSources[]│
         │   status       │
         └────────────────┘
                 │
         console.log()
         [IMPULSE] messages
         │
         READY for GET /api/data
```

## Dashboard Panel Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│                    ⚡ Activity Monitor        [Live] [HH:MM:SS]        │
└───────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  Recent Executions                                      [50 executions] │
│                                                                         │
│  ✓ activity_id          abc123...      12:34:56    ⏱ 234ms  💰 $0.0023 │
│  ✓ activity_id          def456...      12:35:01    ⏱ 567ms  💰 $0.0045 │
│  ✗ activity_id          ghi789...      12:35:06    ⏱ 89ms   💰 $0.0012 │
│                                                                         │
│  [More executions...]                                                   │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  📊 Learning Insights                                    [20 recent]   │
│                                                                         │
│  ┌─────────────┬──────────┬──────────┬────────────────────────────────┐│
│  │Success Rate │Avg Cost  │Exploration│System Learning State            ││
│  │   85.5%     │$0.0034   │2/15      │✓ 8 converged                    ││
│  │17/20 succeed│⏱ 234ms   │🔍 Explor │⚡ 7 exploring                    ││
│  │             │Duration  │🎯 Exploit│📈 15 templates tracked          ││
│  └─────────────┴──────────┴──────────┴────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │🏆 Most Used Template: search_activities  [234 executions]       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬──────────────────────────────────────┐
│ Activity Templates [28 templates]│ 🎲 Thompson Sampling [10 scores]    │
│                                 │                                      │
│ FEATURE                         │ 1. search_activities                 │
│  • create_activity_goal_s...    │    95.2% ±2.4%  [CONVERGED]        │
│  • deploy_to_production          │    α=167 β=8  confidence=100       │
│  • setup_auth_integration        │                                    │
│                                 │ 2. refactor_component               │
│ BUGFIX                          │    87.8% ±5.1%  [CONVERGED]        │
│  • fix_typescript_errors         │    α=145 β=20  confidence=100      │
│  • resolve_merge_conflict        │                                    │
│                                 │ 3. add_feature_flag                 │
│ REFACTOR                        │    76.3% ±8.9%  [LEARNING]         │
│  • simplify_nested_logic         │    α=98 β=30   confidence=100      │
│  • extract_utilities             │                                    │
│                                 │ [More scores...]                    │
└─────────────────────────────────┴──────────────────────────────────────┘

┌──────────────────────────────────┬─────────────────────────────────────┐
│ Impulse Resolution [3 shapes]    │ 📡 Data Sources [3 sources]         │
│                                  │                                     │
│ execution_trace                  │ execution_trace [HEALTHY] ✓         │
│ Resolver: default_resolver       │ Vessel: metabob-activity-api        │
│ 45 resolutions • Avg 23ms        │ Last fetch: 12:35:01                │
│                                  │                                     │
│ activity_template                │ activity_template [HEALTHY] ✓       │
│ Resolver: template_resolver      │ Vessel: metabob-activity-api        │
│ 12 resolutions • Avg 15ms        │ Last fetch: 12:35:01                │
│                                  │                                     │
│ impulse_resolution_metrics       │ impulse_resolution_metrics [ERROR] ✗│
│ Resolver: metrics_resolver       │ Vessel: metabob-activity-api        │
│ 0 resolutions • Avg 0ms          │ Last fetch: never                   │
│ 🔒 Impulse metrics unavailable   │ (Auth required)                     │
│ Requires API key auth...         │                                     │
└──────────────────────────────────┴─────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ 🔗 Activity Compositions [8 edges]                                     │
│                                                                         │
│ search_activities → 4 children (87.5% success, Avg 156ms)              │
│  → create_activity_goal_seeking  [234 calls, 88% success, 178ms]       │
│  → process_impulse              [189 calls, 91% success, 145ms]        │
│  → run_activity                 [156 calls, 85% success, 189ms]        │
│  → execute_activity             [145 calls, 86% success, 134ms]        │
│                                                                         │
│ refactor_component → 3 children (92% success, Avg 123ms)               │
│  → extract_common_logic         [98 calls, 94% success, 112ms]         │
│  → rename_variables             [87 calls, 91% success, 134ms]         │
│  → simplify_conditions          [76 calls, 90% success, 123ms]         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ ⚖️ Recommendation Weights [7 recommendations]                          │
│                                                                         │
│ #1 search_activities [thompson]        95.2% [THOMPSON]               │
│     α=167 β=8 boost=+0.15                                              │
│     Boost breakdown: relevance=+0.08 • frequency=+0.04 • success=+0.03 │
│                                                                         │
│ #2 refactor_component [thompson]       87.8% [THOMPSON]               │
│     α=145 β=20 boost=+0.12                                             │
│                                                                         │
│ [More recommendations...]                                              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ 🎯 Impulse Relevancy Metrics [18 metrics]                              │
│                                                                         │
│ goal (activity: search_activities)                                     │
│ Relevance: 98% • Load: 12ms • Accuracy: 95%                            │
│                                                                         │
│ requirements (activity: refactor_component)                            │
│ Relevance: 94% • Load: 8ms • Accuracy: 92%                             │
│                                                                         │
│ [More metrics...]                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ 🔍 Task Execution Views [10 executions] - Resolver Perspective        │
│                                                                         │
│ ✓ search_activities           abc123...  12:34:56                      │
│   ├─ ✓ Task #1: analyze_goal              [234ms]                      │
│   │  Resolver: llm                                                     │
│   │  Impulses: goal, requirements                                      │
│   │                                                                    │
│   ├─ ✓ Task #2: filter_templates          [156ms]                      │
│   │  Resolver: activity_filter                                         │
│   │  Impulses: goal, candidates                                        │
│   │                                                                    │
│   └─ ✓ Task #3: rank_results              [123ms]                      │
│      Resolver: llm                                                     │
│      Impulses: candidates, scores                                      │
│                                                                        │
│ ✗ refactor_component         def456...  12:35:02                      │
│   ├─ ✓ Task #1: parse_code                [145ms]                      │
│   │  Resolver: ast_parser                                              │
│   │                                                                    │
│   ├─ ⏳ Task #2: analyze_patterns         [—]                           │
│   │  Resolver: llm                                                     │
│   │                                                                    │
│   └─ ✗ Task #3: generate_refactoring     [error]                       │
│      Resolver: llm                                                     │
│      Error: Rate limit exceeded (429)                                  │
│                                                                        │
│ [More task views...]                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│ src/server.ts (999 lines)                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ├─ Import Dependencies                                          │
│ │  └─ hono/cors                                                │
│ │                                                               │
│ ├─ Configuration Layer                                          │
│ │  ├─ ACTIVITY_API_URL (env)                                    │
│ │  ├─ METABOB_API_KEY (env)                                     │
│ │  └─ PORT (env, default 3030)                                  │
│ │                                                               │
│ ├─ Data Structures                                              │
│ │  ├─ CachedData (interface)                                    │
│ │  │  ├─ executions[]                                           │
│ │  │  ├─ templates[]                                            │
│ │  │  ├─ impulses[]                                             │
│ │  │  ├─ scores[] (derived)                                     │
│ │  │  ├─ compositions[]                                         │
│ │  │  ├─ recommendations                                        │
│ │  │  ├─ relevance[]                                            │
│ │  │  ├─ taskViews[]                                            │
│ │  │  └─ lastUpdate                                             │
│ │  │                                                             │
│ │  └─ DataSource (interface)                                    │
│ │     ├─ name (executions|templates|impulses)                   │
│ │     ├─ shape (execution_trace|activity_template|...)          │
│ │     ├─ vessel (metabob-activity-api)                          │
│ │     ├─ status (healthy|error)                                 │
│ │     └─ lastFetch                                              │
│ │                                                               │
│ ├─ Server Setup (Hono)                                          │
│ │  ├─ app = new Hono()                                          │
│ │  └─ app.use('/*', cors())                                     │
│ │                                                               │
│ ├─ Authentication                                               │
│ │  └─ fetchWithAuth(url)                                        │
│ │     └─ Add ApiKey header                                      │
│ │                                                               │
│ ├─ Cache Management                                             │
│ │  └─ updateCache()                                             │
│ │     ├─ Fetch executions                                       │
│ │     ├─ Fetch templates → derive scores                        │
│ │     ├─ Fetch impulses                                         │
│ │     ├─ Fetch compositions                                     │
│ │     ├─ Fetch relevance                                        │
│ │     ├─ Fetch recommendations                                  │
│ │     ├─ Extract task views                                     │
│ │     └─ Update timestamp                                       │
│ │                                                               │
│ ├─ HTTP Routes                                                  │
│ │  ├─ GET /                                                     │
│ │  │  └─ Return HTML with embedded CSS & JS                    │
│ │  │                                                             │
│ │  ├─ GET /api/data                                             │
│ │  │  └─ Return cache as JSON                                   │
│ │  │                                                             │
│ │  └─ GET /api/health                                           │
│ │     └─ Return status + source health                          │
│ │                                                               │
│ ├─ Client-Side JavaScript (embedded)                            │
│ │  ├─ updateDashboard()                                         │
│ │  │  └─ Fetch /api/data every 3s                               │
│ │  │                                                             │
│ │  ├─ Render Functions                                          │
│ │  │  ├─ renderExecutions()                                     │
│ │  │  ├─ renderLearningMetrics()                                │
│ │  │  ├─ renderTemplates()                                      │
│ │  │  ├─ renderScores()                                         │
│ │  │  ├─ renderImpulses()                                       │
│ │  │  ├─ renderDataSources()                                    │
│ │  │  ├─ renderCompositions()                                   │
│ │  │  ├─ renderRecommendations()                                │
│ │  │  ├─ renderRelevance()                                      │
│ │  │  └─ renderTaskViews()                                      │
│ │  │                                                             │
│ │  └─ Polling Loop                                              │
│ │     ├─ updateDashboard() on load                              │
│ │     └─ setInterval(updateDashboard, 3000)                     │
│ │                                                               │
│ ├─ Embedded HTML Structure                                      │
│ │  ├─ <head>                                                    │
│ │  │  ├─ <style> (CSS - dark theme)                             │
│ │  │  └─ Responsive grid layout                                 │
│ │  │                                                             │
│ │  └─ <body>                                                    │
│ │     ├─ <header> (title + live indicator)                      │
│ │     ├─ <div class="grid">                                     │
│ │     │  ├─ Recent Executions panel                             │
│ │     │  ├─ Learning Insights panel                             │
│ │     │  ├─ 2-column (Templates + Thompson Sampling)            │
│ │     │  ├─ 2-column (Impulses + Data Sources)                  │
│ │     │  ├─ Compositions panel                                  │
│ │     │  ├─ Recommendations panel                               │
│ │     │  ├─ Impulse Relevancy panel                             │
│ │     │  └─ Task Views panel                                    │
│ │     │                                                          │
│ │     └─ <script> (embedded JavaScript)                         │
│ │                                                               │
│ └─ Server Startup                                               │
│    ├─ Log configuration                                         │
│    ├─ Call updateCache() once                                   │
│    ├─ setInterval(updateCache, 3000)                            │
│    └─ export Bun server config                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Dependencies

```
Browser State:
┌─────────────────────────────────────────┐
│ lastData = {                            │
│   executions: [],     ← Renders Panel 1 │
│   templates: [],      ← Renders Panel 3 │
│   scores: [],         ← Renders Panel 4 │
│   impulses: [],       ← Renders Panel 5 │
│   sources: [],        ← Renders Panel 6 │
│   compositions: [],   ← Renders Panel 7 │
│   recommendations: {}, ← Renders Panel 8│
│   relevance: [],      ← Renders Panel 9 │
│   taskViews: [],      ← Renders Panel 10│
│   lastUpdate: 0       ← Updates timestamp│
│ }                                       │
└─────────────────────────────────────────┘

Every 3 seconds:
GET /api/data → lastData ← updateDashboard()
                    │
    ┌───────────────┼──────────────────┬─────────┐
    │               │                  │         │
renderExecutions   renderTemplates   renderScores ...
    │               │                  │         │
    ▼               ▼                  ▼         ▼
Update DOM [Execution List] [Template Groups] [Score Items]...
```

## API Integration Points

```
ActivityMonitor Server ◄────► metabob-activity-api
                              (https://activity.metabob.com)

updateCache() Endpoints:
├─ GET /v2/activities/executions?limit=50
│  └─ Returns: { executions: [{execution_id, activity_id, success, cost_usd, duration_ms, total_tokens_in, total_tokens_out, created_at, ...}]}
│  └─ Filter: Remove auth_resolve_v1 entries
│  └─ Status: ✓ HEALTHY
│
├─ GET /v2/activities/templates
│  └─ Returns: { templates: [{id, name, category, alpha, beta, ...}]}
│  └─ Derived: Thompson scores (alpha/(alpha+beta), confidence, etc.)
│  └─ Status: ✓ HEALTHY
│
├─ GET /v2/impulses/resolution-metrics?limit=20
│  └─ Returns: { metrics: [{shape, resolver, count, avg_duration_ms, ...}]}
│  └─ Status: ⚠ ERROR (requires advanced auth)
│
├─ GET /v2/activities/composition/graph?limit=100
│  └─ Returns: { edges: [{parent_activity_id, child_activity_id, success_count, total_count, avg_duration_ms, ...}]}
│  └─ Status: ✓ OK
│
├─ GET /v2/activities/impulse-relevance?limit=50
│  └─ Returns: { metrics: [{impulse_id, impulse_shape, activity_id, relevance_score, load_time_ms, state_transition_accuracy, ...}]}
│  └─ Status: ✓ OK
│
└─ GET /v2/activities/recommend (note: may require POST)
   └─ Returns: { recommendations: [{template_id, selection_metadata: {alpha, beta, sample, boost_breakdown, ...}, ...}]}
   └─ Status: ⚠ TBD (endpoint behavior may vary)

Authentication: All requests include header
  Authorization: ApiKey {METABOB_API_KEY}
```

---

*Diagrams generated from Activity Monitor source code analysis*
