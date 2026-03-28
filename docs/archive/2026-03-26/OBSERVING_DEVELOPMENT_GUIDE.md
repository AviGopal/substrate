# Observing Development via Dashboard

**Dashboard URL**: http://dashboard.minibob.local
**Status**: ✅ Deployed and accessible

---

## What You Can Observe

The dashboard now has **6 tabs** showing the complete development cycle:

### 1. **Overview** Tab
System health and statistics:
- API health status
- Total executions count
- Success rate
- Average duration and cost
- MiniBob instances (placeholder for now)

### 2. **Library** Tab
All activity templates:
- Templates by category (feature, bugfix, refactor, tool, infrastructure)
- Execution counts and success rates
- Thompson Sampling parameters (alpha, beta)
- Template genealogy and evolution

### 3. **Learning** Tab
Learning system status:
- High performers (>80% success rate)
- Templates needing improvement (<50% success)
- Composition patterns
- Boredom detection

### 4. **Executions** Tab ✨ NEW
**Individual execution history**:
- Timeline of all executions
- Status indicators (success/failure/in-progress)
- Click to expand and see:
  - Task breakdown with each step
  - Tool calls made
  - Files modified
  - Impulses used
  - Token usage (input/output/cache)
  - Duration and cost
- Filter by:
  - Status (all, success, failure, in-progress)
  - Search by template name or execution ID
- Real-time updates via WebSocket

**What to watch**:
- Code change activities executing
- Each task completing (branch, implement, test, commit, push)
- Validation results
- Files being modified

### 5. **Variants** Tab ✨ NEW
**Code variants in development**:
- All feature branches being developed
- Thompson Sampling scores (color-coded)
  - 🟢 Green: High score (>0.8) - likely to be promoted
  - 🟡 Yellow: Medium score (0.5-0.8) - being evaluated
  - 🔴 Red: Low score (<0.5) - likely to be rejected
- Success rate progress bars
- Total executions count
- Promotion status (pending, promoted, rejected)
- Filter by category and promotion status
- Sort by score, executions, or success rate

**What to watch**:
- New branches appearing as MiniBob creates features
- Thompson scores updating based on CI results
- Variants being promoted or rejected

### 6. **Vessels** Tab ✨ NEW
**MiniBob pod status**:
- Summary cards showing:
  - Total vessels
  - Currently executing
  - Idle vessels
  - Total executions completed
- Individual vessel cards showing:
  - Pod name and status (idle/executing/bored/error)
  - Current activity and progress
  - Metrics (CPU, memory, executions, cost, uptime)
  - Last heartbeat timestamp
  - Real-time status with pulsing indicators
- Auto-refresh every 10 seconds

**What to watch**:
- Which vessels are working on which goals
- Execution progress in real-time
- Resource usage per vessel

---

## How to Observe a Development Cycle

### Step 1: Submit a Goal

```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add a health check endpoint to activity-dashboard that returns {status: \"ok\", uptime: seconds, version: string}",
    "priority": "high"
  }'
```

### Step 2: Watch in the Dashboard

Open http://dashboard.minibob.local and navigate through tabs:

**Vessels Tab**:
- See a vessel status change from "idle" to "executing"
- See current activity: "Code Change Activity"
- Watch progress updates

**Executions Tab**:
- New execution appears at the top
- Status changes from "pending" → "executing" → "completed"
- Click to expand and see:
  - Task 1: Create feature branch ✓
  - Task 2: Understand codebase ✓
  - Task 3: Implement feature ✓
  - Task 4: Run typecheck ✓
  - Task 5: Add tests ✓
  - Task 6: Commit changes ✓
  - Task 7: Push branch ✓
- See files modified: `src/index.ts`, `src/lib/health.ts`
- See tool calls: write, edit, bash (bun run typecheck)

**Variants Tab**:
- New variant appears: `activity-dashboard:feature/health-endpoint`
- Thompson score starts at ~0.5 (neutral)
- After CI passes, score increases to ~0.7
- After staging metrics are good, score increases to ~0.85 (green)
- Status changes to "promoted"

**Library Tab** (if using ribosome):
- New template appears: "Add Health Endpoint" (extracted from successful execution)
- Metadata shows: generatedFrom: "execution", author: "ribosome"

### Step 3: Verify the Code

```bash
# Check git commits
cd repos/activity-dashboard
git log --oneline | head -5

# You'll see:
# abc123 feat: add health endpoint [execution:exec-abc123]
# ...

# Check the new endpoint works
curl http://localhost:3000/health
# {"status":"ok","uptime":12345,"version":"1.0.0"}
```

---

## Real-Time Updates

The dashboard uses WebSocket for live updates. You'll see changes instantly when:

- **execution_started** - New execution appears in Executions tab
- **execution_completed** - Execution status updates to success/failure
- **template_updated** - Library tab refreshes with new metrics
- **vessel_status_changed** - Vessels tab updates pod status

No manual refresh needed!

---

## API Endpoints (for advanced monitoring)

### Execution Traces
```bash
# List recent executions
curl "http://api.minibob.local/v2/activities/execution-traces?limit=10" | jq .

# Get specific execution
curl "http://api.minibob.local/v2/activities/execution-traces/exec-abc123" | jq .

# Filter by status
curl "http://api.minibob.local/v2/activities/execution-traces?status=failed" | jq .
```

### Code Variants
```bash
# List all variants
curl "http://api.minibob.local/v2/activities/code-variants" | jq .

# Get specific variant
curl "http://api.minibob.local/v2/activities/code-variants/variant-abc123" | jq .

# Filter by promotion status
curl "http://api.minibob.local/v2/activities/code-variants?promotionStatus=promoted" | jq .
```

### Vessel Status
```bash
# List all vessels
curl "http://api.minibob.local/v2/vessels/status" | jq .

# Get specific vessel
curl "http://api.minibob.local/v2/vessels/minibob-devbob-abc123/status" | jq .
```

### CI Results
```bash
# List recent CI results
curl "http://api.minibob.local/v2/activities/ci-results?limit=10" | jq .
```

---

## Monitoring Queries

### SurrealDB Queries (for deep analysis)

```sql
-- Find failing executions
SELECT * FROM activity_execution_traces
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Code variants with high Thompson scores
SELECT variant_id, branch, thompson_score, success_rate
FROM code_variants
WHERE thompson_score > 0.8
ORDER BY thompson_score DESC;

-- Vessel activity over time
SELECT pod_name, count() AS executions
FROM vessel_heartbeats
WHERE heartbeat_at > time::now() - 1h
GROUP BY pod_name
ORDER BY executions DESC;

-- Most used templates
SELECT template_id, count() AS usage_count
FROM activity_execution_traces
GROUP BY template_id
ORDER BY usage_count DESC
LIMIT 10;
```

---

## What to Look For

### Successful Development Cycle

1. ✅ **Goal submitted** - Task appears in boredom queue
2. ✅ **Vessel picks up task** - Vessel status changes to "executing"
3. ✅ **Execution starts** - New entry in Executions tab
4. ✅ **Tasks complete** - Each task shows ✓ checkmark
5. ✅ **Branch created** - New variant in Variants tab
6. ✅ **CI passes** - Thompson score increases
7. ✅ **Staging deployed** - Metrics collected
8. ✅ **Promotion** - Code merged to main, variant marked "promoted"
9. ✅ **Template extracted** - New template in Library tab

### Signs of Problems

- 🔴 **Execution fails** - Red status in Executions tab, click to see error
- 🔴 **CI fails** - Thompson score decreases, variant marked in red
- 🔴 **Vessel stuck** - Status shows "executing" for >10 minutes without progress
- 🔴 **No executions** - Vessels all idle, nothing in queue

---

## Troubleshooting

### Dashboard shows no data

```bash
# Check API is running
curl http://api.minibob.local/health

# Check database has data
curl "http://api.minibob.local/v2/activities/templates?limit=1" | jq .

# Check WebSocket connection (browser console)
# Should see: "WebSocket connected"
```

### Executions not appearing

```bash
# Verify MiniBob is executing activities
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob-devbob --tail=50

# Check execution traces are being stored
curl "http://api.minibob.local/v2/activities/execution-traces?limit=1" | jq .

# Verify database schema is applied
kubectl exec -n activity-system surrealdb-0 -- surreal sql \
  --conn http://localhost:8000 \
  --user root --pass surrealdb-local-dev-123 \
  --ns activity-system --db learning_loop \
  --multi "INFO FOR TABLE activity_execution_traces;"
```

### Variants not showing Thompson scores

```bash
# Check code variants exist
curl "http://api.minibob.local/v2/activities/code-variants" | jq .

# Verify Thompson Sampling is working
curl "http://api.minibob.local/v2/activities/templates?limit=5" | \
  jq '.[] | {id, alpha: .thompson_alpha, beta: .thompson_beta}'
```

### Vessels show as offline

```bash
# Check pods are running
kubectl get pods -n activity-system -l app.kubernetes.io/name=minibob-devbob

# Check heartbeat endpoint (when implemented)
curl "http://api.minibob.local/v2/vessels/status" | jq .
```

---

## Next Steps

Once you can observe the development cycle:

1. **Submit multiple goals** - See them queue up and execute
2. **Compare variants** - Watch Thompson Sampling pick winners
3. **Monitor resource usage** - Track cost, duration, token usage
4. **Analyze failures** - Click failed executions to debug
5. **Extract patterns** - See Ribosome create new templates from successes

The dashboard gives you **complete visibility** into the autonomous development process.

**Open http://dashboard.minibob.local now to start observing!**
