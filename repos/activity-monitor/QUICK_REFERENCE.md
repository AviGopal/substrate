# Activity Monitor - Quick Reference Guide

## 🎯 Project Overview

| Aspect | Details |
|--------|---------|
| **Name** | @metabob/activity-monitor |
| **Purpose** | Live monitoring dashboard for MiniBob activity system |
| **Type** | Single-file Bun server + embedded HTML/JS dashboard |
| **Status** | Production-ready ✅ |
| **Lines of Code** | 999 (server.ts) |
| **Dependencies** | 1 (hono) |
| **Runtime** | Bun (v1.x) |
| **Node.js** | Not required (Bun-only) |

## 🚀 Quick Start

```bash
# 1. Clone and setup
git clone <repo>
cd activity-monitor
bun install

# 2. Configure
export METABOB_API_KEY="mb-your-api-key"
export ACTIVITY_API_URL="https://activity.metabob.com"  # optional
export PORT="3030"  # optional

# 3. Run
bun run dev          # Development (watch mode)
bun run start        # Production

# 4. Access
open http://localhost:3030
```

## 📊 Dashboard Panels (9 Total)

### 1. Recent Executions
**Shows:** Last 50 activity executions with metrics  
**Updates:** Every 3 seconds  
**Metrics:** Duration, cost, tokens, success/failure status  
**Key Feature:** Auto-scrolls to latest, color-coded by status  

### 2. Learning Insights
**Shows:** Dashboard KPIs for the last 20 executions  
**Metrics:**
- Success rate percentage
- Average cost & duration
- Exploration vs exploitation balance
- Most-used template stats
- System learning state summary

### 3. Activity Templates
**Shows:** All registered templates grouped by category  
**Categories:** feature, bugfix, refactor, tool, infrastructure, meta  
**Per Template:** Name, run count, Thompson score, success rate  
**Limit:** 5 per category (most relevant shown)

### 4. Thompson Sampling Scores
**Shows:** Top 10 templates by score  
**Score:** α / (α + β) = success probability  
**Phases:**
- 🔍 EXPLORING (confidence < 20%)
- ⚡ LEARNING (confidence 20-80%)
- 🎯 CONVERGED (confidence > 80%)

**Per Score:** α, β, confidence, uncertainty (100/√(α+β))

### 5. Impulse Resolution
**Shows:** Impulse shape resolution patterns  
**Metrics:** Shape type, resolver handler, count, average duration  
**Status:** ⚠️ Usually shows 0 (requires advanced authentication)

### 6. Data Sources Monitor
**Shows:** Health of 3 data sources  
**Sources:**
1. Executions (`execution_trace`) - ✅ Healthy
2. Templates (`activity_template`) - ✅ Healthy
3. Impulses (`impulse_resolution_metrics`) - ⚠️ Auth required

**Per Source:** Name, shape, vessel, status, last fetch time

### 7. Activity Compositions
**Shows:** Parent-child relationships between activities  
**Grouped:** By parent activity  
**Per Child:** Activity ID, call count, success rate, avg duration  
**Limit:** 10 parents, 5 children per parent

### 8. Recommendation Weights
**Shows:** Thompson sampling recommendation output  
**Per Recommendation:** Template ID, score %, α/β, boost breakdown  
**Limit:** Top 10 recommendations

### 9. Impulse Relevancy Metrics
**Shows:** Relevance scores for impulse types  
**Per Metric:** Impulse ID, relevant activity, relevance %, load time, accuracy  
**Limit:** 20 most recent metrics

### 10. Task Execution Views
**Shows:** Task-level breakdown of recent executions  
**Resolver Perspective:** What tasks were executed and their status  
**Per Task:** Task ID, resolver, status, duration, impulse references, errors  
**Limit:** 10 most recent executions with task details

## 🔧 Configuration

### Environment Variables

```bash
# Required
METABOB_API_KEY=mb-...                    # API authentication key

# Optional with defaults
ACTIVITY_API_URL=https://activity.metabob.com   # Backend endpoint
PORT=3030                                         # Server port
```

### Where to Get API Key
```bash
# Option 1: From .metabob config
cat ~/.metabob/config.json | jq .api_key

# Option 2: From user-vessel
echo $METABOB_API_KEY

# Option 3: From environment
env | grep METABOB
```

## 📡 API Endpoints

### GET /
Returns the HTML dashboard with embedded CSS and JavaScript

```bash
curl http://localhost:3030
# Returns: HTML document (dashboard)
```

### GET /api/data
Returns all cached data as JSON

```bash
curl http://localhost:3030/api/data
# Returns: {
#   "executions": [...],
#   "templates": [...],
#   "impulses": [...],
#   "scores": [...],
#   "compositions": [...],
#   "recommendations": {...},
#   "relevance": [...],
#   "taskViews": [...],
#   "sources": [...],
#   "lastUpdate": 1776600000000
# }
```

### GET /api/health
Returns health check status

```bash
curl http://localhost:3030/api/health
# Returns: {
#   "status": "healthy",
#   "backend": "https://activity.metabob.com",
#   "lastUpdate": "2026-04-20T06:00:00.000Z",
#   "cacheAge": 2543,
#   "sources": [...]
# }
```

## 🔄 Update Cycles

### Server Updates Backend
```
Every 3 seconds:
├─ GET /v2/activities/executions?limit=50          (filter auth_resolve_v1)
├─ GET /v2/activities/templates                    (derive Thompson scores)
├─ GET /v2/impulses/resolution-metrics?limit=20
├─ GET /v2/activities/composition/graph?limit=100
├─ GET /v2/activities/impulse-relevance?limit=50
└─ GET /v2/activities/recommend
```

### Browser Updates Server
```
Every 3 seconds:
└─ GET /api/data
  └─ Triggers 10 render functions
  └─ Updates all dashboard panels
```

## 🔐 Authentication

### How It Works
```
1. Load METABOB_API_KEY from environment
2. Add header to all backend requests:
   Authorization: ApiKey {METABOB_API_KEY}
3. Backend validates and returns data
4. If 401/403 → data source marked as error
```

### Troubleshooting
```
❌ No data showing?
   → Check METABOB_API_KEY is set: echo $METABOB_API_KEY
   → Verify key is valid: curl -H "Authorization: ApiKey $METABOB_API_KEY" \
                               https://activity.metabob.com/health
   → Check ACTIVITY_API_URL is correct

❌ Impulses showing error?
   → This is expected (requires advanced API access)
   → Other panels should still work fine

❌ Stale data?
   → Check "Last Update" timestamp in header
   → If > 6 seconds old, server may be stuck
   → Check server logs for API errors
```

## 📊 Key Calculations

### Thompson Score
```
success_probability = α / (α + β)
confidence = min(α + β, 100)
uncertainty = 100 / sqrt(α + β)
phase = confidence < 20 ? EXPLORING : 
        confidence > 80 ? CONVERGED : LEARNING
```

### Learning Metrics
```
success_rate = successCount / totalCount * 100%
avg_cost = sum(costs) / executionCount
avg_duration = sum(durations) / executionCount
exploration_count = templates where confidence ≤ 80
exploitation_count = templates where confidence > 80
```

### Composition Success Rate
```
success_rate = sum(success_count) / sum(total_count) * 100%
```

## 🎨 UI/UX Details

### Theme
- **Background:** #0a0a0a (near-black)
- **Text:** #e0e0e0 (light gray)
- **Accent:** #10b981 (emerald green)
- **Error:** #ef4444 (red)
- **Warning:** #f59e0b (amber)
- **Font:** Monaco, Menlo, monospace

### Color Coding
- ✅ **Green (#10b981)** - Success, healthy, active
- ❌ **Red (#ef4444)** - Failure, error
- ⚠️ **Amber (#f59e0b)** - Running, warning, processing
- ⚪ **Gray (#666)** - Inactive, metadata

### Responsive Layout
- **Header:** Fixed, full-width with title + status
- **Main Grid:** Single-column flex
- **Panels:** Full-width with 1px border
- **2-Column Sections:** Grid layout (templates + scores, etc.)
- **Lists:** Scrollable (max-height: 500px)

## 🚨 Monitoring Your Instance

### Healthy Server
```
Indicators:
✓ "Last Update" timestamp updates every 3 seconds
✓ Recent Executions show new entries
✓ All data sources show HEALTHY (except impulses)
✓ Learning Insights metrics update regularly
✓ No console errors in browser
```

### Unhealthy Server
```
Indicators:
✗ "Last Update" timestamp is stale (> 6 seconds)
✗ All data sources show ERROR
✗ Browser console shows fetch errors
✗ Server logs show auth failures
✗ Dashboard panels show empty states
```

## 📝 Integration with MiniBob

### Running Both Together
```bash
# Terminal 1: MiniBob
cd ../minibob
minibob

# Terminal 2: Activity Monitor
cd ../activity-monitor
bun run dev

# Browser: Open http://localhost:3030
```

### What Appears
- **Recent Executions:** Shows activities as MiniBob runs them
- **Learning Insights:** Updates as activities succeed/fail
- **Thompson Sampling:** Builds over time with more runs
- **Activity Compositions:** Shows when activities call other activities

## 🔬 Data Source Details

| Source | Endpoint | Status | Updates | Purpose |
|--------|----------|--------|---------|---------|
| Executions | `/v2/activities/executions?limit=50` | ✅ Healthy | Every 3s | Track activity runs |
| Templates | `/v2/activities/templates` | ✅ Healthy | Every 3s | Show available activities |
| Impulses | `/v2/impulses/resolution-metrics` | ⚠️ Error | Every 3s | Impulse patterns (auth req) |
| Compositions | `/v2/activities/composition/graph` | ✅ OK | Every 3s | Activity dependencies |
| Relevance | `/v2/activities/impulse-relevance` | ✅ OK | Every 3s | Impulse importance |
| Recommendations | `/v2/activities/recommend` | ⚠️ TBD | Every 3s | Selection weights |

## 📈 Performance Notes

- **Polling Overhead:** 6 API calls × 3-second cycle = 2 API calls/second
- **Cache Size:** ~50 executions + templates + metadata ≈ 100-200KB
- **Browser Update Time:** <50ms per cycle (no framework overhead)
- **Network Bandwidth:** ~10-20KB per 3-second poll (compressed)

## 🛠️ Development Commands

```bash
# Watch mode (auto-restart on file changes)
bun run dev

# Production mode (single run)
bun run start

# Check dependencies
bun install --dry-run

# Format code (if prettier installed)
bun run format

# Type check (TypeScript)
bun check src/server.ts
```

## 📚 File Reference

| File | Lines | Purpose |
|------|-------|---------|
| src/server.ts | 999 | Complete implementation |
| package.json | 17 | Dependencies and scripts |
| .env | 12 | Configuration |
| README.md | 154 | Full documentation |
| QUICKSTART.md | 47 | Setup guide |
| bun.lock | - | Dependency lock file |

## 🔗 Useful URLs

- **Dashboard:** http://localhost:3030
- **API Data:** http://localhost:3030/api/data
- **Health Check:** http://localhost:3030/api/health
- **Backend API:** https://activity.metabob.com
- **Repository:** (check package.json)

## ⚡ Pro Tips

1. **Export Dashboard Data:** Copy JSON from `/api/data` for analysis
2. **Monitor Success Rate:** Watch Learning Insights success % metric
3. **Track Learning:** Thompson scores show convergence over time
4. **Debug Tasks:** Task Views show resolver perspective (useful for troubleshooting)
5. **Watch Compositions:** Shows activity dependency patterns
6. **Check Health:** Data Sources panel indicates API connectivity

## 🎓 Understanding the Metrics

### Thompson Sampling
- **α (Alpha):** Number of successful trials (confidence increases)
- **β (Beta):** Number of unsuccessful trials
- **Score:** Probability the template will succeed (α/(α+β))
- **Confidence:** How sure we are (α+β, bounded at 100)
- **Phase:** Exploring (learning) → Converged (confident choice)

### Execution Costs
- Measured in USD (based on LLM token usage)
- Includes API calls, processing, and inference
- Helps identify expensive activities

### Impulse Relevancy
- **Relevance Score:** How important this impulse is (0-1)
- **Load Time:** How long it takes to resolve (ms)
- **Accuracy:** State transition accuracy (0-1)

---

## 📖 More Information

- See `ANALYSIS_REPORT.md` for detailed architecture analysis
- See `ARCHITECTURE_DIAGRAM.md` for visual diagrams
- See `README.md` for feature documentation
- See `QUICKSTART.md` for setup instructions

---

*Quick reference guide for Activity Monitor dashboard system*
