# Activity Composition Graph - Visual Reference

## Composition Network Overview

```
                                    [User Goals / Autonomous Loop]
                                                |
                                                v
                    +---------------------------+---------------------------+
                    |                           |                           |
               [Observability]            [Data Operations]         [System Health]
                    |                           |                           |
        +-----------+-----------+    +----------+----------+    +-----------+-----------+
        |           |           |    |          |          |    |           |           |
    [Trace]    [GitHub]    [Perf]  [Fetch]  [Query]   [Error] [Workflow] [DevLoop] [Spec]
```

## The Big Picture: 3 Major Clusters

### Cluster 1: Observability & Analytics (Right Brain)
Activities that watch, measure, and report on system behavior

### Cluster 2: Data Operations (Corpus Callosum)
Activities that fetch, transform, and move data between systems

### Cluster 3: System Health & Improvement (Left Brain)
Activities that diagnose problems and create improvement actions

---

## Detailed Composition Trees

### Tree 1: METRICS FETCHING (The Universal Connector)

```
┌─────────────────────────────────────────────────────────────┐
│ fetch-activity-metrics (PARENT & CHILD - Hub Activity)      │
│ ↑ Called by: Fetch and Analyze App Usage Traces             │
│ ↓ Calls: 11 children                                         │
│ Reuse: 1100% (appears everywhere!)                          │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► Fetch API Data Alternative
  │   └─ Success: 300% (3x reuse)
  │
  ├─► Fetch API Metrics (Environment-Safe)
  │   └─ Success: 100% (production-ready)
  │
  ├─► Node.js API Metrics Fetcher
  │   └─ Success: 100% (platform-specific)
  │
  ├─► Fetch and Save Activity Metrics
  │   └─ Success: 200% (2x reuse, persistence)
  │
  ├─► API Data Fetcher
  │   └─ Success: 500% (5x reuse - generic primitive)
  │
  └─► [6 additional fetch strategies]
      └─ Various environment/protocol/format adaptations

PATTERN: Multi-Strategy with A/B Testing
PURPOSE: Learn optimal data retrieval method per context
```

---

### Tree 2: TRACE ANALYSIS (The Pattern Detector)

```
┌─────────────────────────────────────────────────────────────┐
│ Analyze App Usage Traces                                     │
│ Children: 8 analysis variants                                │
│ Focus: Usage patterns, trends, anomalies                     │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► analyze-app-traces-comprehensive
  │   └─ Success: 100% (full-featured analysis)
  │
  ├─► Comprehensive Trace Analysis with Insights
  │   └─ Success: 100% (includes ML insights)
  │
  ├─► Analyze Application Usage Traces ★★★
  │   └─ Success: 700% (7x reuse - core primitive!)
  │
  ├─► analyze-app-usage
  │   └─ Success: 100% (minimal viable analysis)
  │
  ├─► Analyze Activity Usage Traces ★
  │   └─ Success: 300% (3x reuse - activity-specific)
  │
  └─► [3 additional analysis variants]
      └─ Specialized by data source, depth, output format

PATTERN: Specialization by Feature Set
PURPOSE: Progressive enhancement - basic to comprehensive
```

---

### Tree 3: DEVELOPMENT LOOP ASSESSMENT (The Self-Improver)

```
┌─────────────────────────────────────────────────────────────┐
│ assess-development-loop                                      │
│ Children: 7 assessment activities                            │
│ Focus: CI/CD health, workflow optimization                   │
│ OUTPUT: GitHub issues for improvements!                      │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► Analyze Loop Performance and Create Improvement Issue
  │   └─ Success: 100% (actionable output!)
  │
  ├─► Workflow Issue Analysis ★
  │   └─ Success: 200% (2x reuse - problem detection)
  │
  ├─► Analyze Workflow Health Metrics
  │   └─ Success: 100% (health scoring)
  │
  ├─► Analyze Workflow Data for Issues
  │   └─ Success: 100% (data-driven diagnostics)
  │
  ├─► Query Specific Activity Stats
  │   └─ Success: 100% (targeted data retrieval)
  │
  └─► [2 additional assessment variants]
      └─ Different analysis depths/scopes

PATTERN: Analysis → Diagnosis → Action
PURPOSE: Continuous improvement automation
```

---

### Tree 4: FETCH + ANALYZE PIPELINE (Multi-Level Composition)

```
┌─────────────────────────────────────────────────────────────┐
│ Fetch and Analyze App Usage Traces (COMPOSED COMPOSITION)   │
│ Children: 4 activities (mix of fetch + analysis)             │
│ Depth: 3 levels (this calls activities that call activities) │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► Analyze Activity Usage Traces
  │   └─ Success: 100% (analysis stage)
  │
  ├─► fetch-activity-metrics ★★★★★
  │   └─ Success: 1100% (11x reuse - THE FOUNDATION!)
  │   └─ Note: This is ALSO a parent activity (Tree 1)
  │       └─ Creates 3-level hierarchy:
  │           Level 1: Fetch and Analyze App Usage Traces
  │           Level 2: fetch-activity-metrics
  │           Level 3: [11 fetch strategy children]
  │
  ├─► Analyze and Categorize Usage Traces
  │   └─ Success: 100% (categorization stage)
  │
  └─► Analyze App Usage Trace Patterns
      └─ Success: 200% (2x reuse - pattern extraction)

PATTERN: Pipeline with Nested Compositions
PURPOSE: Complete data flow - fetch → process → analyze → categorize
```

---

### Tree 5: WORKFLOW ANALYSIS (The Health Monitor)

```
┌─────────────────────────────────────────────────────────────┐
│ Analyze Workflow Issues                                      │
│ Children: 3 specialized analysis activities                  │
│ Focus: Multi-dimensional workflow health                     │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► Workflow Health Analysis
  │   └─ Success: 100% (overall health score)
  │
  ├─► Operational Workflow Analysis
  │   └─ Success: 100% (runtime behavior)
  │
  └─► Workflow Effectiveness Analysis
      └─ Success: 100% (outcome quality)

PATTERN: Multi-Dimensional Analysis
PURPOSE: Comprehensive view from different perspectives
```

---

### Tree 6: GITHUB METRICS (The External Integrator)

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Autonomous Development Metrics                        │
│ Children: 6 reporting activities                             │
│ Focus: Repository analytics and autonomous dev tracking      │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► GitHub Repository Analysis and Metrics Report
  │   └─ Success: 100% (repository-level view)
  │
  ├─► GitHub Autonomous Development Reporter ★
  │   └─ Success: 200% (2x reuse - key reporter!)
  │
  ├─► GitHub Development Activity Analysis
  │   └─ Success: 100% (activity-level tracking)
  │
  ├─► GitHub Development Analytics Report
  │   └─ Success: 100% (analytics focus)
  │
  ├─► GitHub Development Activity Report
  │   └─ Success: 100% (activity focus)
  │
  └─► [1 additional GitHub variant]
      └─ Alternative reporting format

PATTERN: Multi-Format Reporting
PURPOSE: Same data, different presentations for different audiences
```

---

### Tree 7: ERROR ANALYSIS (The Minimalist)

```
┌─────────────────────────────────────────────────────────────┐
│ Trace Error Statistics Analysis                              │
│ Children: 1 (wrapper pattern)                                │
│ Focus: Error detection and categorization                    │
└─────────────────────────────────────────────────────────────┘
  │
  └─► Comprehensive Trace Error Analysis
      └─ Success: 100% (detailed error breakdown)

PATTERN: Wrapper/Abstraction
PURPOSE: Version management or feature flagging
```

---

### Tree 8: SPECIFICATION ENFORCEMENT (The Recursive One)

```
┌─────────────────────────────────────────────────────────────┐
│ Convert Specification to Contract Enforcement                │
│ Children: 1 (ITSELF - recursive!)                            │
│ Focus: Nested specification processing                       │
└─────────────────────────────────────────────────────────────┘
  │
  └─► Convert Specification to Contract Enforcement
      └─ Success: 100% (same activity, recursive call)
      └─ USE CASE: Process tree of specifications
          └─ Level 1: Root spec
              └─ Level 2: Sub-specs (recursive call)
                  └─ Level 3: Leaf specs (recursive call)
                      └─ [Termination: no sub-specs]

PATTERN: Recursive Descent
PURPOSE: Handle hierarchical/nested data structures
```

---

### Tree 9: TEMPLATE METRICS QUERY (The Pipeline)

```
┌─────────────────────────────────────────────────────────────┐
│ Query Activity Template Metrics                              │
│ Children: 2 (pipeline stages)                                │
│ Focus: Template performance data retrieval                   │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► Query and Format Template Metrics
  │   └─ Success: 100% (query + format stage)
  │
  └─► Query Activity Template Metrics Report
      └─ Success: 100% (report generation stage)

PATTERN: Query → Format → Report Pipeline
PURPOSE: Separation of data access, transformation, presentation
```

---

### Tree 10: PERFORMANCE ANALYSIS (The Dual Perspective)

```
┌─────────────────────────────────────────────────────────────┐
│ Analyze Trace Performance Metrics                            │
│ Children: 2 (complementary views)                            │
│ Focus: Performance optimization insights                     │
└─────────────────────────────────────────────────────────────┘
  │
  ├─► Performance Trace Analysis
  │   └─ Success: 100% (trace-level granularity)
  │
  └─► Application Performance Analysis
      └─ Success: 100% (application-level view)

PATTERN: Multi-Level Analysis
PURPOSE: See performance from micro (trace) and macro (app) views
```

---

## Cross-Tree Connections (The Really Interesting Part!)

### Connection 1: fetch-activity-metrics (The Universal Hub)

```
APPEARS AS PARENT:          APPEARS AS CHILD:
┌──────────────────┐       ┌──────────────────────────────┐
│ fetch-activity-  │       │ Fetch and Analyze App Usage  │
│ metrics          │       │ Traces                       │
│                  │       └──────────────┬───────────────┘
│ ↓ [11 children]  │                      │
└──────────────────┘                      │
                                          ↓
                                   ┌──────────────────┐
                                   │ fetch-activity-  │
                                   │ metrics          │
                                   │                  │
                                   │ ↓ [11 children]  │
                                   └──────────────────┘

CREATES: 3-level composition hierarchy
ENABLES: Reusable fetch strategies across multiple parent contexts
```

### Connection 2: Analysis Activities (Shared Primitives)

```
┌──────────────────────────────────┐
│ Analyze Activity Usage Traces    │
│ Reuse: 300%                       │
└────────┬─────────────────────────┘
         │
         ├─ Called by: Analyze App Usage Traces
         ├─ Called by: Fetch and Analyze App Usage Traces
         └─ Called by: [other analysis parents]

CREATES: Shared analysis primitive across multiple workflows
ENABLES: Consistent analysis logic, single point of optimization
```

### Connection 3: Workflow Analysis (Circular References?)

```
┌────────────────────────┐      ┌────────────────────────┐
│ Analyze Workflow Issues│────► │ Workflow Issue Analysis│
│                        │      │ Reuse: 200%            │
└────────────────────────┘      └───────┬────────────────┘
                                        │
                                        ↓
                            ┌────────────────────────────┐
                            │ assess-development-loop    │
                            └───────┬────────────────────┘
                                    │
                                    ├─► Workflow Issue Analysis (AGAIN!)
                                    └─► [6 other children]

CREATES: Potential circular reference (needs investigation)
SUGGESTS: Common "Workflow Issue Analysis" building block
```

---

## Composition Depth Visualization

```
LEVEL 0: [User Goals / Autonomous Triggers]
            │
            ├─────────────────────────────────────┐
            │                                     │
LEVEL 1:    [assess-development-loop]    [Fetch and Analyze App Usage Traces]
            │                                     │
            ├─► Workflow Issue Analysis           ├─► fetch-activity-metrics
            │                                     │
            │                                     │
LEVEL 2:    [Analyze Workflow Issues]            [API Data Fetcher]
            │                                     │
            ├─► Workflow Health Analysis          │
            │                                     │
            │                                     │
LEVEL 3:    [specific metrics queries]           [HTTP GET/POST primitives]

OBSERVED MAX DEPTH: 3 levels
THEORETICAL MAX: Unlimited (via recursive patterns)
PRACTICAL LIMIT: 4-5 levels (debugging becomes difficult)
```

---

## Reuse Heatmap (★ = High Reuse)

```
★★★★★  fetch-activity-metrics (1100%)           [FOUNDATIONAL]
★★★★   Analyze Application Usage Traces (700%)  [CORE PRIMITIVE]
★★★    API Data Fetcher (500%)                  [ESSENTIAL TOOL]
★★     Analyze Activity Usage Traces (300%)     [COMMON OPERATION]
★★     Fetch API Data Alternative (300%)        [FALLBACK STRATEGY]
★      Workflow Issue Analysis (200%)           [DIAGNOSTIC TOOL]
★      GitHub Autonomous Development Reporter (200%) [SPECIALIZED]
```

---

## Data Flow Patterns

### Pattern A: Fetch → Analyze → Report

```
[Parent]
   ↓ creates output impulse: {type: "activityMetrics", data: [...]}
[Fetch Child]
   ↓ resolves: activityMetrics
   ↓ creates output impulse: {type: "rawData", data: {...}}
[Analyze Child]
   ↓ resolves: rawData
   ↓ creates output impulse: {type: "analysisResults", data: {...}}
[Report Child]
   ↓ resolves: analysisResults
   ↓ creates output impulse: {type: "formattedReport", data: "..."}
```

### Pattern B: Multi-Strategy Selection

```
[Parent: "Need to fetch metrics"]
   ↓ requests: Thompson Sampling recommendation
[Backend: Thompson Sampling]
   ↓ samples from children probabilities:
   │  - Fetch API Data Alternative: 30%
   │  - Node.js API Metrics Fetcher: 25%
   │  - API Data Fetcher: 45%
   ↓ selects: API Data Fetcher (highest sample)
[Selected Child Executes]
   ↓ success/failure updates Thompson parameters
```

### Pattern C: Recursive Descent

```
[Convert Specification to Contract Enforcement]
   ↓ input: {spec: {rules: [...], subSpecs: [...]}}
   ↓ process rules
   ↓ for each subSpec:
   │    ↓ recursive call to self
   │    ↓ input: {spec: subSpec}
   │    ↓ [deeper recursion...]
   ↓ aggregate results
   ↓ output: {contracts: [...]}
```

---

## Composition Metrics Summary Table

| Family | Parent | Children | Max Reuse | Total Calls | Avg Success |
|--------|--------|----------|-----------|-------------|-------------|
| Metrics Fetch | fetch-activity-metrics | 11 | 1100% | 0* | 100%+ |
| Trace Analysis | Analyze App Usage Traces | 8 | 700% | 0* | 100%+ |
| Dev Loop | assess-development-loop | 7 | 200% | 0* | 100% |
| GitHub | GitHub Autonomous Dev Metrics | 6 | 200% | 0* | 100% |
| Fetch+Analyze | Fetch and Analyze Traces | 4 | 1100% | 0* | 100%+ |
| Workflow | Analyze Workflow Issues | 3 | 100% | 0* | 100% |
| Template Query | Query Activity Template Metrics | 2 | 100% | 0* | 100% |
| Performance | Analyze Trace Performance | 2 | 100% | 0* | 100% |
| Error | Trace Error Statistics | 1 | 100% | 0* | 100% |
| Specification | Convert Spec to Contract | 1 | 100% | 0* | 100% |

*Note: 0 calls = composition structure defined but not yet executed

---

## Key Takeaways for Visual Learners

1. **Hub and Spoke Model**
   - `fetch-activity-metrics` is the hub
   - Everything connects through data fetching
   - Highest reuse = most central

2. **Layered Architecture**
   - Level 1: Orchestration (parents)
   - Level 2: Implementation (children)
   - Level 3: Primitives (grandchildren)
   - Clean separation of concerns

3. **Reusability Pyramid**
   ```
        [User Goals]
             △
            / \
           /   \
          / Rare \      ← Specialized (100% reuse)
         /─────────\
        / Uncommon  \   ← Domain-specific (200-300% reuse)
       /─────────────\
      /   Common      \ ← Primitives (500-700% reuse)
     /─────────────────\
    /   Foundational    \ ← Universal (1100% reuse)
   /─────────────────────\
   ```

4. **Composition as Learning**
   - Multiple children = exploration space
   - Thompson Sampling = learning algorithm
   - Success rates = learned preferences
   - System improves composition over time

5. **Loose Coupling via Impulses**
   - Parents don't call children directly
   - Impulses provide data contracts
   - Backend handles routing and resolution
   - Enables flexible rewiring without code changes

---

**Visual Reference Guide Generated From:**
- Dashboard: http://localhost:3030
- Section: Activity Compositions
- Total Edges: 100
- Analysis Date: 2026-04-22

**Related Documents:**
- `COMPOSITION_ANALYSIS.md` - Detailed technical analysis
- `COMPOSITION_SUMMARY.md` - Quick reference guide
- `activity-compositions-overview.png` - Full dashboard screenshot
