# Dashboard Components Implementation

Implementation of development cycle observability components for the Activity Dashboard.

## Overview

Added three new tabs to the Activity Dashboard that provide real-time visibility into:
1. **Execution History** - Individual code changes with status and detailed breakdowns
2. **Code Variants** - Branches with Thompson Sampling scores and CI/staging metrics
3. **Vessel Status** - MiniBob pods showing current work and metrics

## Backend Endpoints Created

### 1. Execution Traces Routes
**File**: `/repos/metabob-activity-api/src/routes/execution-traces.ts`

**Endpoints**:
- `GET /v2/activities/execution-traces` - List execution traces with filtering
  - Query params: `variant_id`, `activity_id`, `success`, `start_date`, `end_date`, `limit`, `offset`
  - Returns: Full execution traces with task breakdowns, state snapshots, file changes
- `GET /v2/activities/execution-traces/:executionId` - Get specific execution trace

**Features**:
- Multi-tenant filtering (org_id/project_id scope)
- Pagination support (max 500 per request)
- Date range filtering
- Success/failure filtering
- Ordered by most recent first

### 2. Code Variants Routes
**File**: `/repos/metabob-activity-api/src/routes/code-variants.ts`

**Endpoints**:
- `GET /v2/activities/code-variants` - List variants with Thompson scores
  - Query params: `activity_id`, `category`, `promotion_status`, `ci_status`, `min_score`, `limit`, `offset`, `sort_by`, `sort_order`
  - Returns: Variants with metrics and CI/staging status
- `GET /v2/activities/code-variants/:variantId` - Get specific variant

**Features**:
- Thompson Sampling score calculation (alpha / (alpha + beta))
- Joins `activity_templates` with `variant_performance_metrics`
- Flexible sorting (thompson_score, success_rate, total_executions, created_at)
- Promotion status tracking (candidate/promoted/rejected/staging)
- Placeholder for CI/staging metrics (to be enriched from CI results table)

### 3. Vessel Status Routes
**File**: `/repos/metabob-activity-api/src/routes/vessels.ts`

**Endpoints**:
- `GET /v2/vessels/status` - List all MiniBob vessels
  - Returns: Real-time vessel status with current activity and metrics
- `GET /v2/vessels/:podName/status` - Get specific vessel status
- `POST /v2/vessels/heartbeat` - MiniBob vessels send heartbeat updates
  - Body: `{ pod_name, namespace, status, current_activity, metrics }`

**Features**:
- Heartbeat-based status tracking (vessels stored in `vessel_heartbeats` table)
- Falls back to DB heartbeats if K8s API not available
- Supports future K8s API integration (placeholder)
- Auto-eviction of stale heartbeats (5+ minutes old)
- Real-time status: idle, executing, bored, error

### 4. Server Integration
**File**: `/repos/metabob-activity-api/src/index.ts`

**Changes**:
- Added imports for new route modules
- Registered routes:
  - `/v2/activities/execution-traces` → `executionTracesRoutes`
  - `/v2/activities/code-variants` → `codeVariantsRoutes`
  - `/v2/vessels` → `vesselsRoutes`

## Frontend Components Created

### 1. ExecutionHistory Component
**File**: `/repos/activity-dashboard/src/components/ExecutionHistory.tsx`

**Features**:
- Timeline view of executions ordered by most recent
- Status badges (success/failure) with icons
- Expandable execution details showing:
  - Task breakdown with status and duration
  - Tool calls per task with success indicators
  - Files modified list
  - Impulses used
  - Token usage (input/output/cache)
- Filtering:
  - By status (all/success/failure)
  - Client-side search by variant ID, activity ID, error message
- Pagination controls
- Real-time updates via WebSocket (`execution_completed` events)
- Color-coded status indicators

**UI Elements**:
- Collapsible execution cards
- Progress indicators for multi-task executions
- Duration/cost/token metrics display
- Error message highlighting

### 2. CodeVariants Component
**File**: `/repos/activity-dashboard/src/components/CodeVariants.tsx`

**Features**:
- Table view of all variants sorted by Thompson score
- Thompson Sampling score visualization:
  - Color-coded badges (green >= 70%, yellow >= 40%, red < 40%)
  - Alpha/beta parameters display
  - Success rate with progress bar
- Filtering:
  - By category (feature/bugfix/refactor/tool/infrastructure)
  - By promotion status (promoted/candidate/staging/rejected)
  - By CI status (passing/failing/pending/error)
- Sorting:
  - Thompson score (default)
  - Success rate
  - Total executions
  - Created date
- Metrics display:
  - Total/successful/failed executions
  - Average duration
  - Average cost
- Promotion status badges
- CI status badges (placeholder, ready for integration)

**UI Elements**:
- Color-coded score badges
- Category badges with semantic colors
- Progress bars for success rates
- Genealogy indicators (if variant has parent)

### 3. VesselStatus Component
**File**: `/repos/activity-dashboard/src/components/VesselStatus.tsx`

**Features**:
- Summary stats cards:
  - Total vessels
  - Currently executing count
  - Total executions across all vessels
  - Cumulative cost
- Individual vessel cards showing:
  - Pod name, namespace, phase
  - Ready status (pulse animation)
  - Current activity with progress bar
  - Current task description
  - Metrics: CPU, memory, executions, cost, uptime
  - Last heartbeat timestamp
- Status badges (executing/idle/bored/error/unknown)
- Real-time updates:
  - WebSocket (`pod_status_changed` events)
  - Auto-refresh every 10 seconds
- Empty state with helpful message

**UI Elements**:
- Pulsing ready indicator (green dot)
- Current activity highlight box
- Metric icons (CPU, memory, clock, dollar)
- Relative timestamps ("5m ago", "2h ago")
- Uptime formatting (hours/minutes)

## API Client Updates

### Updated Files
**File**: `/repos/activity-dashboard/src/lib/api-client.ts`

**New Methods**:
```typescript
// Execution Traces
listExecutionTraces(params?) → ExecutionTracesResponse
getExecutionTrace(executionId) → ExecutionTrace

// Code Variants
listCodeVariants(params?) → CodeVariantsResponse
getCodeVariant(variantId) → CodeVariant

// Vessels
listVessels() → VesselsResponse
getVesselStatus(podName) → VesselStatus
```

**File**: `/repos/activity-dashboard/src/lib/types.ts`

**New Types**:
- `ExecutionTrace` - Full execution trace with state snapshots
- `ExecutionTracesResponse` - Paginated execution list
- `CodeVariant` - Variant with Thompson scores and CI metrics
- `CodeVariantsResponse` - Paginated variant list
- `VesselStatus` - MiniBob pod status and metrics
- `VesselsResponse` - Vessel list
- `MiniBobPodStatus` (alias for `VesselStatus` - backward compatibility)

## App Integration

### Updated Files
**File**: `/repos/activity-dashboard/src/App.tsx`

**Changes**:
- Added imports for new components
- Extended tab list to 6 tabs (was 3)
- Added tab triggers: "Executions", "Variants", "Vessels"
- Added tab content for each new component

**Tab Layout**:
```
Overview | Library | Learning | Executions | Variants | Vessels
```

## WebSocket Integration

All components are connected to WebSocket for real-time updates:

**ExecutionHistory**:
- Listens to `execution_completed` events
- Auto-refreshes execution list when new executions finish

**VesselStatus**:
- Listens to `pod_status_changed` events
- Auto-refreshes vessel list when pod status changes
- Also has 10-second polling as fallback

**CodeVariants**:
- Currently static (no WebSocket events)
- Ready for future `template_updated` events

## Database Schema Requirements

The implementation expects these SurrealDB tables:

### 1. `activity_execution_traces`
```sql
{
  execution_id: string,
  variant_id: string,
  activity_id: string,
  success: bool,
  duration_ms: number,
  cost: number,
  tokens: { input, output, cache },
  error_message?: string,
  error_type?: string,
  failed_task_id?: string,
  impulses_used?: string[],
  component_changes?: array,
  tasks?: array,
  state_snapshot?: object,
  org_id?: string,
  project_id?: string,
  executed_at: datetime,
  created_at: datetime
}
```

### 2. `vessel_heartbeats`
```sql
{
  pod_name: string,
  namespace: string,
  status: string,
  current_activity?: object,
  metrics?: object,
  last_heartbeat: datetime,
  created_at: datetime,
  updated_at: datetime
}
```

### 3. Existing Tables Used
- `activity_templates` - Template definitions
- `variant_performance_metrics` - Thompson Sampling metrics

## Deployment Checklist

### Backend
- [x] Create execution-traces.ts route
- [x] Create code-variants.ts route
- [x] Create vessels.ts route
- [x] Register routes in index.ts
- [x] Build verification (successful)

### Frontend
- [x] Create ExecutionHistory.tsx component
- [x] Create CodeVariants.tsx component
- [x] Create VesselStatus.tsx component
- [x] Update App.tsx with new tabs
- [x] Update api-client.ts with new methods
- [x] Update types.ts with new interfaces

### Database
- [ ] Create `activity_execution_traces` table (if not exists)
- [ ] Create `vessel_heartbeats` table
- [ ] Add indexes for performance:
  - `activity_execution_traces`: `variant_id`, `executed_at`, `success`
  - `vessel_heartbeats`: `pod_name + namespace`, `last_heartbeat`

### MiniBob Integration
- [ ] Implement heartbeat sending in MiniBob vessels
- [ ] Store execution traces in DB after activity completion
- [ ] Include task breakdown and state snapshots in traces

## Testing Guide

### Backend Testing
```bash
# Test execution traces endpoint
curl "http://api.minibob.local/v2/activities/execution-traces?limit=10"

# Test code variants endpoint
curl "http://api.minibob.local/v2/activities/code-variants?sort_by=thompson_score&sort_order=desc"

# Test vessels status endpoint
curl "http://api.minibob.local/v2/vessels/status"

# Test vessel heartbeat (from MiniBob pod)
curl -X POST "http://api.minibob.local/v2/vessels/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "pod_name": "minibob-0",
    "namespace": "activity-system",
    "status": "executing",
    "current_activity": {
      "variant_id": "fix-bug-v1",
      "activity_id": "fix-null-pointer",
      "variant_name": "Fix Null Pointer",
      "started_at": "2026-03-22T10:00:00Z",
      "current_task": "Running unit tests",
      "progress": 75
    },
    "metrics": {
      "executions_completed": 5,
      "total_cost_usd": 0.15,
      "uptime_seconds": 3600
    }
  }'
```

### Frontend Testing
```bash
# Start dashboard in development mode
cd repos/activity-dashboard
bun run dev

# Access dashboard
open http://dashboard.minibob.local

# Test tabs:
# 1. Navigate to "Executions" tab - should show execution history
# 2. Navigate to "Variants" tab - should show code variants
# 3. Navigate to "Vessels" tab - should show vessel status
# 4. Verify WebSocket connection (check for green "Live" indicator)
```

### End-to-End Testing
1. Start a MiniBob execution
2. MiniBob sends heartbeat to `/v2/vessels/heartbeat`
3. Dashboard "Vessels" tab shows MiniBob as "Executing"
4. MiniBob completes execution and stores trace
5. Dashboard "Executions" tab shows new execution (via WebSocket)
6. Click execution to expand and see task breakdown
7. Navigate to "Variants" tab to see updated Thompson scores

## Future Enhancements

### CI Integration
- Populate `ci_status` from CI results table
- Add CI test results endpoint
- Show CI logs in variant details

### Staging Metrics
- Collect deployment metrics from staging environment
- Health check status from K8s probes
- Error rate and latency from monitoring system

### Kubernetes API Integration
- Replace DB heartbeats with K8s API queries
- Show pod resource usage (CPU/memory) from metrics-server
- Add pod logs viewer
- Display pod events and warnings

### Real-time Features
- Live execution progress streaming
- Task-level progress updates
- Real-time log tailing
- WebSocket-based execution trace updates

### Analytics
- Execution trends over time (line charts)
- Success rate trends by category
- Cost analysis and projections
- Variant comparison view

## Files Modified

### Backend (metabob-activity-api)
- **Created**:
  - `src/routes/execution-traces.ts` (242 lines)
  - `src/routes/code-variants.ts` (234 lines)
  - `src/routes/vessels.ts` (267 lines)
- **Modified**:
  - `src/index.ts` (added route imports and registrations)

### Frontend (activity-dashboard)
- **Created**:
  - `src/components/ExecutionHistory.tsx` (353 lines)
  - `src/components/CodeVariants.tsx` (362 lines)
  - `src/components/VesselStatus.tsx` (346 lines)
- **Modified**:
  - `src/App.tsx` (added new tabs and component imports)
  - `src/lib/api-client.ts` (added new API methods)
  - `src/lib/types.ts` (added new TypeScript interfaces)

## Summary

Total Implementation:
- **3 new backend routes** with 6 endpoints
- **3 new frontend components** with full interactivity
- **Full TypeScript type coverage**
- **WebSocket integration** for real-time updates
- **Production-ready code** following existing patterns

The dashboard now provides comprehensive visibility into the MiniBob development cycle, enabling developers to observe:
1. What code changes are being made (Executions)
2. Which variants are performing best (Variants)
3. What each vessel is currently working on (Vessels)

All components are designed to scale with the system and support future enhancements like K8s API integration, CI/CD metrics, and advanced analytics.
