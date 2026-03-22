# Activity Dashboard Design & Implementation Plan

**Project**: repos/activity-dashboard  
**Deployment**: dashboard.minibob.local (via helmfile)  
**Current State**: Foundation complete, UI components partially implemented  
**Goal**: Establish minimal, data-rich UI for activity system observability

---

## Executive Summary

The Activity Dashboard is a **real-time observability platform** for tracking MiniBob activity execution, learning patterns, and system health. We need to establish a **consistent, minimal design system** using shadcn/ui components that focuses on **data density and actionable insights**.

### Key Requirements
1. **Track current activities** - What MiniBob instances are working on RIGHT NOW
2. **Visualize learning** - Which activity variants are winning via Thompson Sampling
3. **Activity evolution** - Show newly created templates and debugging patterns
4. **Impulse memory** - Display active impulses in memory system
5. **Task graph** - Global sequencing graph with learned edge weights
6. **Minimal & responsive** - Lightweight UI, fast updates, data-first design

---

## Current Architecture Assessment

### ✅ Solid Foundation (Already Complete)
- **Tech Stack**: Bun + React 19 + TypeScript + TailwindCSS 4 + shadcn/ui
- **API Client**: Full TypeScript client with WebSocket support (`src/lib/api-client.ts`)
- **Type System**: Complete type definitions matching backend API (`src/lib/types.ts`)
- **Component Library**: 12 shadcn/ui components installed and configured
- **Deployment**: Helm chart ready for K8s deployment
- **Hooks**: useHealth, useTemplates, useWebSocket hooks implemented

### ⚠️ Needs Enhancement
- **Current UI**: Basic tabs with SystemOverview, ActivityLibrary, LearningSystem
- **Missing Views**: Live execution monitor, impulse memory viewer, task graph
- **Data Flow**: No real-time execution tracking (GET /executions not implemented in API yet)
- **Styling**: Inconsistent data density, some sections too sparse
- **Interactivity**: Limited drill-down, no detail views

### Current Components Status

| Component | Status | Data Source | Notes |
|-----------|--------|-------------|-------|
| **SystemOverview** | ✅ Functional | Templates API, Health API | Shows metrics, needs live executions |
| **ActivityLibrary** | ✅ Functional | Templates API | Good table, needs detail modal |
| **LearningSystem** | ✅ Functional | Templates API | Shows patterns, needs real data |
| **Live Executions** | ❌ Missing | Executions API | API endpoint not implemented |
| **Impulse Viewer** | ❌ Missing | Impulses API | Needs new component |
| **Task Graph** | ❌ Missing | Templates + Executions | Complex visualization needed |

---

## Design Principles: Minimal & Data-Rich

### Visual Language
1. **Monochrome Base**: Use neutral grays (already in shadcn "new-york" theme)
2. **Semantic Color**: Color ONLY for status (green=success, red=failure, blue=info, yellow=warning)
3. **Density First**: Maximize information per screen pixel
4. **Typography**: Use size/weight hierarchy, not color
5. **Whitespace**: Minimal padding, focus on data

### Layout Principles
1. **Grid-Based**: Use consistent 4px base unit (Tailwind spacing scale)
2. **Card Containers**: All data sections in shadcn Card components
3. **Table-Heavy**: Dense tables with inline metrics (like Bloomberg Terminal)
4. **Dashboard Tiles**: Small stat cards with single metric + context
5. **No Decorative Elements**: Every pixel serves a purpose

### Interaction Patterns
1. **Hover = Detail**: Use Tooltip for expanded context
2. **Click = Drill Down**: Click rows/cards for modal detail view
3. **Real-Time = Subtle**: Live updates fade in, don't interrupt
4. **Filters = Inline**: Filter controls embedded in section headers
5. **Export = Always Available**: CSV/JSON download on all data views

### shadcn Component Usage Strategy

#### Primary Components (Use Everywhere)
- **Card**: Main container for all sections
- **Table**: Dense data display (primary pattern)
- **Badge**: Status indicators (success rate, category)
- **Progress**: Visual metric representation
- **Tabs**: Top-level navigation (keep 3-4 max)

#### Supporting Components (Use Selectively)
- **Dialog**: Detail modals for template/execution drill-down
- **Select**: Filters and dropdowns (keep minimal)
- **Input**: Search fields only
- **Tooltip**: Hover details (use liberally)
- **ScrollArea**: Long lists with fixed height

#### Avoid Overuse
- **Accordion**: Too much interaction for dashboard
- **Popover**: Use Dialog instead for consistency
- **Separator**: Use Card borders instead
- **Skeleton**: Data loads fast enough to skip

---

## Data Requirements & API Integration

### Available Data (API v2)
```typescript
// Templates
GET /v2/activities/templates
- variant_id, activity_id, variant_name, description
- category: feature|bugfix|refactor|tool|infrastructure
- task_steps[], genealogy (parent_variant_id, generation)
- metrics: thompson_alpha, thompson_beta, success_rate, avg_cost, avg_duration

// Executions (TODO: Need API implementation)
GET /v2/activities/executions
- execution_id, variant_id, success, duration_ms, cost
- tokens: {input, output, cache}
- error_message, failed_task_id
- impulses_used[], component_changes[]

// Impulses
GET /v2/impulses
- impulse_id, type, pointer, budget, usage, status
- priority, created_at, accessed_at, evicted_at

// Health
GET /health
- status, service, version, timestamp
- checks: {redis, surrealdb}
```

### Data We're Missing (Needs Backend Work)

1. **Live MiniBob Status** (Critical)
   - Which pod is executing which activity RIGHT NOW
   - Current task step within activity
   - Real-time token/cost accumulation
   - **Proposal**: MiniBob heartbeat to Redis + WebSocket broadcast

2. **Execution History** (High Priority)
   - Need `GET /v2/activities/executions` with pagination
   - Filter by: variant_id, success, date range
   - **Proposal**: SurrealDB query + 5min cache

3. **Task Graph Data** (Medium Priority)
   - Activity dependencies (which activities call which)
   - Edge weights (how often task A → task B)
   - **Proposal**: New endpoint `/v2/activities/graph`

4. **Boredom System State** (Low Priority)
   - What MiniBob is "bored" about (patterns detected)
   - Prioritization scores
   - **Proposal**: Expose boredom detector state via API

---

## New UI Components Specification

### 1. Live Execution Monitor (High Priority)

**Location**: New tab "Live Monitor"  
**Data Source**: WebSocket + Executions API  
**Update Frequency**: Real-time (WebSocket) + 5s polling fallback

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 LIVE EXECUTIONS                        [Filter: All ▼]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚡ minibob-0 | add-feature-complete v2                  │ │
│ │ Task 2/5: Implement feature logic              [45s]    │ │
│ │ Tokens: 1.2K in | 850 out | Cost: $0.023               │ │
│ │ ▓▓▓▓▓░░░░░ 40%                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚡ minibob-1 | fix-bug-complete                         │ │
│ │ Task 3/4: Run tests                            [12s]    │ │
│ │ Tokens: 2.1K in | 1.3K out | Cost: $0.041               │ │
│ │ ▓▓▓▓▓▓▓▓░░ 75%                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ RECENT COMPLETIONS (Last 10)                               │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Variant              │ Duration │ Cost   │ Status    │   │
│ ├──────────────────────┼──────────┼────────┼───────────┤   │
│ │ add-feature-complete │ 45.2s    │ $0.034 │ ✓ Success │   │
│ │ refactor-with-tests  │ 67.8s    │ $0.052 │ ✗ Failed  │   │
│ │ fix-bug-complete     │ 23.1s    │ $0.018 │ ✓ Success │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Component Structure**:
- **LiveExecutionCard**: Each active execution gets a card with progress bar
- **ExecutionHistoryTable**: Dense table of recent completions (last 100)
- **Real-time Updates**: WebSocket messages update cards inline
- **Click Behavior**: Click card → Dialog with full execution details

### 2. Impulse Memory Viewer (Medium Priority)

**Location**: New tab "Memory"  
**Data Source**: Impulses API  
**Update Frequency**: 10s polling

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 💾 IMPULSE MEMORY                 Loaded: 15 | Budget: 45K  │
├─────────────────────────────────────────────────────────────┤
│ Status Filter: [All] [Loaded] [Pending] [Evicted]          │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ID         │ Type      │ Budget │ Usage │ Status    │   │
│ ├────────────┼───────────┼────────┼───────┼───────────┤   │
│ │ auth-req   │ file      │ 5000   │ 3240  │ ● Loaded  │   │
│ │ api-design │ memo      │ 2000   │ 2000  │ ● Loaded  │   │
│ │ test-data  │ activity  │ 8000   │ 0     │ ○ Pending │   │
│ │ old-spec   │ file      │ 3000   │ 2100  │ ✗ Evicted │   │
│ └────────────┴───────────┴────────┴───────┴───────────┘   │
│                                                             │
│ Memory Pressure: ▓▓▓░░░░░░░ 35% (15.2K / 45K)              │
└─────────────────────────────────────────────────────────────┘
```

**Component Structure**:
- **ImpulseTable**: Dense table with status indicators
- **Memory Gauge**: Progress bar showing total budget usage
- **Status Badges**: Color-coded (green=loaded, gray=pending, red=evicted)
- **Hover Details**: Tooltip shows full impulse pointer content

### 3. Task Graph Visualizer (Low Priority - Phase 2)

**Location**: New tab "Graph"  
**Data Source**: Templates + Executions (analyze composition patterns)  
**Update Frequency**: 30s polling

**Layout**: Force-directed graph using Recharts or custom Canvas
- **Nodes**: Activity templates (size = execution count)
- **Edges**: Composition relationships (thickness = frequency)
- **Colors**: Category-based (feature=blue, bugfix=red, etc.)
- **Interactive**: Click node → highlight dependencies, show metrics

---

## Enhanced Existing Components

### SystemOverview Improvements

**Current Issues**:
- Placeholder MiniBob instances (not real data)
- Learning system section is too verbose
- Missing critical metrics (error rate, cost trends)

**Enhancements**:
```diff
+ Add Error Rate card (failed_executions / total_executions)
+ Add Cost Trend sparkline (last 24h hourly cost)
+ Replace placeholder MiniBob list with real pod status
+ Add "Last Updated" timestamp to each metric card
+ Show top 3 failing templates (inline alert)
```

### ActivityLibrary Improvements

**Current Issues**:
- Table is good but lacks interactivity
- No detail view for templates
- Thompson Sampling values are cryptic

**Enhancements**:
```diff
+ Add Detail Dialog: Click row → Modal with full template definition
+ Thompson Sampling Tooltip: Hover α/β → Explain what it means
+ Genealogy Graph: Click genealogy icon → Show parent/child tree
+ Export Button: CSV download of filtered table
+ Highlight Row: Recently updated templates (last 1h) in subtle yellow
```

### LearningSystem Improvements

**Current Issues**:
- Boredom patterns are simulated (not real data)
- Composition patterns section needs better visualization
- Too much vertical space

**Enhancements**:
```diff
+ Replace simulated boredom with real backend data (when available)
+ Add Variant Competition Chart: Bar chart showing selection counts
+ Add Success Rate Trend: Line chart over time for top 5 templates
+ Compact High Performers list (2 columns instead of grid)
```

---

## Styling System Specification

### Color Palette (Minimal)

Based on shadcn "new-york" neutral theme:

```css
/* Status Colors (Only Use for State) */
--success: oklch(0.646 0.222 41.116)      /* Green */
--failure: oklch(0.577 0.245 27.325)      /* Red */
--warning: oklch(0.828 0.189 84.429)      /* Yellow */
--info: oklch(0.6 0.118 184.704)          /* Blue */

/* Grayscale (Use for Everything Else) */
--foreground: oklch(0.145 0 0)            /* Almost black */
--muted-foreground: oklch(0.556 0 0)      /* Medium gray */
--border: oklch(0.922 0 0)                /* Light gray */
--background: oklch(1 0 0)                /* White */
--card: oklch(1 0 0)                      /* White */

/* Typography Scale */
--font-size-xs: 0.75rem     /* 12px - table data */
--font-size-sm: 0.875rem    /* 14px - labels */
--font-size-base: 1rem      /* 16px - body */
--font-size-lg: 1.125rem    /* 18px - card titles */
--font-size-xl: 1.5rem      /* 24px - section titles */
--font-size-2xl: 2rem       /* 32px - page titles */
```

### Spacing System (4px Base)

```css
/* Use Tailwind classes directly */
p-2  /* 8px  - tight padding */
p-4  /* 16px - card padding */
p-6  /* 24px - section padding */
gap-2 /* 8px  - element spacing */
gap-4 /* 16px - card spacing */
```

### Component Style Guide

#### Card Sections
```tsx
<Card className="border-border">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg flex items-center gap-2">
      <Icon className="h-5 w-5 text-muted-foreground" />
      Section Title
    </CardTitle>
    <CardDescription>Brief explanation (1 line max)</CardDescription>
  </CardHeader>
  <CardContent className="pt-0">
    {/* Dense content */}
  </CardContent>
</Card>
```

#### Stat Cards (Dashboard Tiles)
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Metric Name</CardTitle>
    <Icon className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">1,234</div>
    <p className="text-xs text-muted-foreground">+12% from last hour</p>
  </CardContent>
</Card>
```

#### Dense Tables
```tsx
<Table>
  <TableHeader>
    <TableRow className="text-xs uppercase text-muted-foreground">
      <TableHead className="h-8">Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="hover:bg-muted/50 cursor-pointer">
      <TableCell className="py-2 text-sm">Value</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Status Badges
```tsx
{/* Success Rate */}
<Badge variant={successRate >= 80 ? "default" : successRate >= 50 ? "secondary" : "destructive"}>
  {successRate.toFixed(1)}%
</Badge>

{/* Execution Status */}
<Badge variant={success ? "default" : "destructive"}>
  {success ? "✓ Success" : "✗ Failed"}
</Badge>

{/* Category */}
<Badge variant="outline" className="text-xs">
  {category}
</Badge>
```

---

## Implementation Roadmap

### Phase 1: Fix Existing (1-2 days)
1. **Enhance SystemOverview**
   - Add error rate metric card
   - Show real MiniBob pod status (via API or K8s)
   - Add last updated timestamps
   
2. **Enhance ActivityLibrary**
   - Add template detail dialog (click row)
   - Add Thompson Sampling tooltip
   - Add CSV export button
   
3. **Styling Consistency Pass**
   - Apply minimal color palette consistently
   - Reduce card padding (pb-3 headers, pt-0 content)
   - Ensure all tables use dense style

### Phase 2: Add Missing Views (2-3 days)
1. **Live Execution Monitor**
   - Create LiveMonitor component
   - Implement execution cards with progress bars
   - Add WebSocket real-time updates
   - Add execution history table
   
2. **Impulse Memory Viewer**
   - Create ImpulseMemory component
   - Implement impulse table
   - Add memory pressure gauge
   - Add status filtering

### Phase 3: Advanced Features (3-5 days)
1. **Task Graph Visualizer**
   - Research graph layout library (Recharts vs. D3 vs. Cytoscape)
   - Implement force-directed layout
   - Add interactive node/edge details
   
2. **Thompson Sampling Visualization**
   - Add variant competition chart
   - Show selection probability distribution
   - Animate alpha/beta evolution over time
   
3. **Real-time Enhancements**
   - Fade-in animations for new data
   - Desktop notifications for failures
   - Sound alerts (optional, toggleable)

### Phase 4: Polish & Deploy (1-2 days)
1. **Performance Optimization**
   - Lazy load heavy components
   - Debounce WebSocket updates
   - Add loading skeletons
   
2. **Accessibility**
   - Keyboard navigation for all tables
   - Screen reader labels
   - High contrast mode support
   
3. **Documentation**
   - Update README with screenshots
   - Create operator guide
   - Document API dependencies

---

## Success Metrics

### User Experience
- **First Paint**: < 500ms
- **Data Freshness**: Live updates within 1s of event
- **Interaction Latency**: Table sort/filter < 100ms
- **Visual Density**: 80%+ of screen shows data (not chrome)

### Technical
- **Bundle Size**: < 500KB gzipped
- **Memory Usage**: < 100MB after 1h runtime
- **API Calls**: < 10 requests per 10s (use caching)
- **WebSocket Reconnect**: < 3s after disconnect

### Business
- **Observability Coverage**: 100% of activity lifecycle visible
- **Issue Detection Time**: Failing templates identified within 1 min
- **Learning Validation**: Thompson Sampling scores understandable by operators
- **Operational Insight**: MiniBob pod utilization visible in real-time

---

## Risk Mitigation

### Risk: API Endpoints Not Ready
**Mitigation**: Graceful degradation with mock data toggle
```tsx
const MOCK_DATA = process.env.MOCK_EXECUTIONS === 'true';
const executions = MOCK_DATA ? mockExecutions : await api.listExecutions();
```

### Risk: WebSocket Instability
**Mitigation**: Polling fallback + exponential backoff reconnect
```tsx
const { connected } = useWebSocket({
  enabled: true,
  fallbackPoll: true,
  pollInterval: 5000,
  maxReconnectDelay: 30000
});
```

### Risk: Data Overload (1000+ Templates)
**Mitigation**: Virtualized tables + aggressive pagination
```tsx
<ScrollArea className="h-[600px]">
  <VirtualizedTable data={templates} rowHeight={48} />
</ScrollArea>
```

### Risk: Color Blindness
**Mitigation**: Use shapes + text labels, not just color
```tsx
{/* Bad: Green/red only */}
<Badge variant={success ? "default" : "destructive"} />

{/* Good: Symbol + color */}
<Badge variant={success ? "default" : "destructive"}>
  {success ? "✓" : "✗"} {status}
</Badge>
```

---

## Deployment Checklist

### Local Development
- [x] Bun v1.3.10+ installed
- [x] dependencies installed (`bun install`)
- [x] API accessible (`export ACTIVITY_API_URL`)
- [x] Dev server runs (`bun dev`)
- [ ] All new components render without errors
- [ ] WebSocket connects successfully
- [ ] Mock data toggle works

### Docker Build
- [x] Dockerfile exists
- [ ] Build succeeds (`docker build -t activity-dashboard:latest .`)
- [ ] Container runs (`docker run -p 3000:3000 ...`)
- [ ] Healthcheck passes
- [ ] Logs show no errors

### Kubernetes Deployment
- [x] Helm chart exists
- [ ] Chart lints successfully (`helm lint`)
- [ ] Template renders correctly (`helm template`)
- [ ] Deploys to cluster (`helmfile apply`)
- [ ] Service accessible via port-forward
- [ ] Ingress at dashboard.minibob.local works
- [ ] Pod logs clean after 10 min runtime

---

## Next Steps (Immediate Actions)

### 1. Verify Current State (30 min)
```bash
cd repos/activity-dashboard
bun install
bun dev
# Open http://localhost:3000 and test:
# - All 3 tabs load
# - System Overview shows metrics
# - Activity Library shows templates table
# - Learning System shows patterns
```

### 2. Create Live Monitor Component (2 hours)
```bash
# Create new component
touch src/components/LiveMonitor.tsx

# Add to App.tsx tabs
# Implement basic execution list (API pending)
```

### 3. Apply Styling Consistency (1 hour)
```bash
# Update SystemOverview.tsx
# - Reduce card padding
# - Apply minimal color palette
# - Add last updated timestamps

# Update ActivityLibrary.tsx
# - Make table denser
# - Add hover tooltips
```

### 4. Test with Real Data (30 min)
```bash
# Port-forward to activity API
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080

# Restart dashboard
export ACTIVITY_API_URL="http://localhost:8080"
bun dev

# Verify templates load from real API
```

---

## Appendix: Component File Structure

```
repos/activity-dashboard/src/
├── components/
│   ├── ui/                       # shadcn/ui components (12 installed)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── progress.tsx
│   │   ├── scroll-area.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── textarea.tsx
│   │   └── [tooltip, dialog, etc. - add as needed]
│   ├── SystemOverview.tsx        # ✅ Exists (needs enhancement)
│   ├── ActivityLibrary.tsx       # ✅ Exists (needs enhancement)
│   ├── LearningSystem.tsx        # ✅ Exists (needs enhancement)
│   ├── LiveMonitor.tsx           # ❌ TODO: Create
│   ├── ImpulseMemory.tsx         # ❌ TODO: Create
│   ├── TaskGraph.tsx             # ❌ TODO: Create (Phase 3)
│   ├── TemplateDetailDialog.tsx  # ❌ TODO: Create
│   └── ExecutionDetailDialog.tsx # ❌ TODO: Create
├── hooks/
│   ├── useHealth.ts              # ✅ Exists
│   ├── useTemplates.ts           # ✅ Exists
│   ├── useWebSocket.ts           # ✅ Exists
│   ├── useExecutions.ts          # ❌ TODO: Create
│   └── useImpulses.ts            # ❌ TODO: Create
├── lib/
│   ├── api-client.ts             # ✅ Complete
│   ├── types.ts                  # ✅ Complete
│   └── utils.ts                  # ✅ Exists
├── App.tsx                       # ✅ Main layout (needs tabs update)
├── index.ts                      # ✅ Server entry
└── index.css                     # ✅ Styles (needs consistency pass)
```

---

## Questions to Answer Before Starting

1. **What is the #1 priority view?**
   - Recommendation: Live Monitor (track active executions)
   - Rationale: Most critical for operational visibility

2. **Should we wait for API endpoints or mock data?**
   - Recommendation: Implement with mock data toggle
   - Rationale: Don't block UI work on backend

3. **How much interactivity do we want?**
   - Recommendation: Click-to-detail dialogs, hover tooltips
   - Rationale: Balance info density with ease of exploration

4. **Should we support dark mode?**
   - Recommendation: Yes, already in shadcn theme
   - Rationale: Tailwind dark: variant + CSS variables ready

5. **Export functionality needed now?**
   - Recommendation: CSV only for tables (JSON later)
   - Rationale: Operators need to share data with teams

---

## Conclusion

The Activity Dashboard has a **solid foundation** and needs focused UI work to become a world-class observability tool. By following the **minimal, data-rich design principles** and prioritizing the **Live Monitor** component, we can deliver immediate value while building toward the comprehensive vision.

**Estimated Timeline**: 2-3 weeks for full implementation  
**Quick Win**: Enhanced existing components (3-5 days)  
**High Impact**: Live Execution Monitor (1 week)  
**Stretch Goal**: Task Graph Visualizer (Phase 2)

Ready to start building! 🚀
