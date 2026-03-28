# MiniBob Task: Activity Dashboard UI Enhancement

## Objective
Enhance the Activity Dashboard (repos/activity-dashboard) with minimal, data-rich styling using shadcn/ui components. Implement priority components for real-time observability of MiniBob activity execution.

## Context
- **Repository**: repos/activity-dashboard
- **Tech Stack**: Bun + React 19 + TypeScript + shadcn/ui (new-york theme)
- **Deployment**: dashboard.minibob.local (via helmfile)
- **Current State**: Foundation complete (SystemOverview, ActivityLibrary, LearningSystem)
- **Design Document**: ACTIVITY_DASHBOARD_DESIGN_PLAN.md (comprehensive spec)

## Phase 1: Enhance Existing Components (Priority)

### 1.1 SystemOverview.tsx Enhancements
**File**: `repos/activity-dashboard/src/components/SystemOverview.tsx`

**Changes Required**:
- [ ] Add Error Rate metric card
  - Calculate: `(failed_executions / total_executions) * 100`
  - Display with Badge variant based on threshold (>10% = destructive)
  - Position: After Success Rate card
  
- [ ] Add "Last Updated" timestamp to all metric cards
  - Use `date-fns` formatDistanceToNow
  - Display in CardDescription
  - Text: "Updated 30s ago"
  
- [ ] Reduce card padding for data density
  - CardHeader: `className="pb-3"` (currently pb-6)
  - CardContent: `className="pt-0"` (currently pt-6)
  
- [ ] Remove placeholder MiniBob instances
  - Replace with real pod status from API or "No live data available"
  - If API not ready, show message: "Live pod tracking coming soon"

- [ ] Add top 3 failing templates alert
  - Query templates with success_rate < 50%
  - Display in Alert component (variant="destructive")
  - Show template name, success rate, last failure time

**Styling Targets**:
- Use minimal color palette (status colors only)
- Ensure all text uses muted-foreground for secondary info
- Maintain 4px spacing grid

### 1.2 ActivityLibrary.tsx Enhancements
**File**: `repos/activity-dashboard/src/components/ActivityLibrary.tsx`

**Changes Required**:
- [ ] Create TemplateDetailDialog component
  - New file: `repos/activity-dashboard/src/components/TemplateDetailDialog.tsx`
  - Triggered by: Click on table row
  - Content: Full template definition, task steps, genealogy tree
  - Use Dialog component from shadcn/ui
  
- [ ] Add Thompson Sampling tooltip
  - Use Tooltip component on alpha/beta values
  - Content: "Alpha: successes + 1, Beta: failures + 1. Higher alpha/beta ratio = higher selection probability"
  - Trigger: Hover over Thompson α/β column
  
- [ ] Add CSV export button
  - Position: Top right of card, next to search
  - Icon: Download from lucide-react
  - Function: Export filtered table data to CSV
  - Filename: `activity-templates-${timestamp}.csv`
  
- [ ] Highlight recently updated templates
  - If updated_at within last 1 hour: add subtle yellow background
  - Use: `className="bg-yellow-50 dark:bg-yellow-950/20"`
  
- [ ] Make table denser
  - Row padding: `className="py-2"` (currently py-4)
  - Font size: `text-sm` for all cells
  - Header: `text-xs uppercase text-muted-foreground`

**Styling Targets**:
- Hover states should use `hover:bg-muted/50`
- Click cursor: `cursor-pointer` on rows
- Dense spacing throughout

### 1.3 LearningSystem.tsx Enhancements
**File**: `repos/activity-dashboard/src/components/LearningSystem.tsx`

**Changes Required**:
- [ ] Replace simulated boredom data with real data
  - Check if API endpoint exists for boredom patterns
  - If not available, show message: "Boredom detection patterns available when backend is ready"
  - Keep component structure for future integration
  
- [ ] Add Variant Competition Chart
  - Use Recharts BarChart component
  - Data: Top 10 templates by execution count
  - X-axis: Template name (truncated)
  - Y-axis: Selection count
  - Color: By category (feature=blue, bugfix=red, etc.)
  
- [ ] Add Success Rate Trend (if execution history available)
  - Use Recharts LineChart component
  - Data: Success rate over time for top 5 templates
  - X-axis: Time (last 24h)
  - Y-axis: Success rate (0-100%)
  - Legend: Template names
  
- [ ] Compact High Performers list
  - Change from single column to 2-column grid
  - Use: `className="grid grid-cols-2 gap-4"`
  - Reduce card padding

**Styling Targets**:
- Charts should use minimal colors (gray base + status colors)
- Remove all chart gridlines for cleaner look
- Use thin lines (strokeWidth={1})

## Phase 2: New Components (If Time Permits)

### 2.1 LiveMonitor.tsx Component
**File**: `repos/activity-dashboard/src/components/LiveMonitor.tsx`

**Requirements**:
- Display active MiniBob executions in real-time
- Show execution progress with Progress component
- Display token usage and cost inline
- Recent completions table (last 20)
- WebSocket integration for real-time updates
- Fallback to polling if WebSocket unavailable

**Layout Spec** (see ACTIVITY_DASHBOARD_DESIGN_PLAN.md section "1. Live Execution Monitor")

**API Dependencies**:
- GET /v2/activities/executions (needs backend implementation)
- WebSocket: execution.started, execution.progress, execution.completed events

### 2.2 ImpulseMemory.tsx Component
**File**: `repos/activity-dashboard/src/components/ImpulseMemory.tsx`

**Requirements**:
- Display all impulses in memory system
- Show status: loaded, pending, evicted
- Memory pressure gauge (used / total budget)
- Filter by status
- Table with: ID, type, budget, usage, status

**Layout Spec** (see ACTIVITY_DASHBOARD_DESIGN_PLAN.md section "2. Impulse Memory Viewer")

**API Dependencies**:
- GET /v2/impulses

## Styling Requirements (Apply Everywhere)

### Color Palette
```typescript
// Use these semantic colors ONLY for status
const statusColors = {
  success: "text-green-600 dark:text-green-400",
  failure: "text-red-600 dark:text-red-400", 
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
}

// Use grayscale for everything else
const neutralColors = {
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  border: "border-border",
}
```

### Typography Scale
```typescript
const textSizes = {
  xs: "text-xs",      // 12px - table data, labels
  sm: "text-sm",      // 14px - body text
  base: "text-base",  // 16px - default
  lg: "text-lg",      // 18px - card titles
  xl: "text-xl",      // 24px - section titles
}
```

### Spacing System
```typescript
// Use Tailwind spacing scale (4px base)
const spacing = {
  tight: "p-2 gap-2",      // 8px
  normal: "p-4 gap-4",     // 16px
  loose: "p-6 gap-6",      // 24px
}
```

### Component Style Patterns

**Card Pattern**:
```tsx
<Card className="border-border">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg flex items-center gap-2">
      <Icon className="h-5 w-5 text-muted-foreground" />
      Title
    </CardTitle>
    <CardDescription>Brief description</CardDescription>
  </CardHeader>
  <CardContent className="pt-0">
    {/* Dense content */}
  </CardContent>
</Card>
```

**Table Pattern**:
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

**Status Badge Pattern**:
```tsx
<Badge variant={value >= 80 ? "default" : value >= 50 ? "secondary" : "destructive"}>
  {value}%
</Badge>
```

## Testing Requirements

### Development Testing
- [ ] Run `bun dev` and verify all components render
- [ ] Check console for errors/warnings
- [ ] Test dark mode toggle (if available)
- [ ] Verify responsive layout on narrow screens
- [ ] Test with real API data (if available)
- [ ] Test with mock data fallback

### Visual Testing
- [ ] All tables have consistent density
- [ ] Color only used for status (no decorative colors)
- [ ] Typography hierarchy clear
- [ ] Card padding consistent (pb-3, pt-0)
- [ ] Hover states visible but subtle

### Interaction Testing
- [ ] Click table row opens detail dialog
- [ ] Hover shows tooltips
- [ ] Export CSV downloads correctly
- [ ] Filters work as expected
- [ ] WebSocket reconnects after disconnect

## Success Criteria

### Phase 1 Complete When:
1. All existing components enhanced per spec
2. TemplateDetailDialog component created and functional
3. CSV export working on ActivityLibrary
4. Styling consistent across all components
5. No console errors in dev mode
6. Dark mode works correctly

### Phase 2 Complete When:
1. LiveMonitor component created and functional
2. ImpulseMemory component created and functional
3. Real-time updates working (WebSocket or polling)
4. All new components follow styling guidelines

## Files to Modify

### Existing Files (Phase 1)
- `repos/activity-dashboard/src/components/SystemOverview.tsx`
- `repos/activity-dashboard/src/components/ActivityLibrary.tsx`
- `repos/activity-dashboard/src/components/LearningSystem.tsx`
- `repos/activity-dashboard/src/App.tsx` (add new tabs)

### New Files (Phase 1)
- `repos/activity-dashboard/src/components/TemplateDetailDialog.tsx`

### New Files (Phase 2)
- `repos/activity-dashboard/src/components/LiveMonitor.tsx`
- `repos/activity-dashboard/src/components/ImpulseMemory.tsx`
- `repos/activity-dashboard/src/hooks/useExecutions.ts`
- `repos/activity-dashboard/src/hooks/useImpulses.ts`

### Configuration Files (No Changes Needed)
- `repos/activity-dashboard/components.json` (shadcn config - already correct)
- `repos/activity-dashboard/package.json` (dependencies complete)
- `repos/activity-dashboard/tailwind.config.js` (theme correct)

## API Client Reference

The API client is fully implemented at `repos/activity-dashboard/src/lib/api-client.ts`.

**Available Methods**:
```typescript
// Health
healthCheck(): Promise<HealthResponse>

// Templates
listTemplates(): Promise<ActivityTemplate[]>
getTemplate(variantId: string): Promise<ActivityTemplate>

// Executions (TODO: needs backend)
// listExecutions(): Promise<Execution[]>
// getExecution(executionId: string): Promise<Execution>

// Impulses (TODO: needs backend)
// listImpulses(): Promise<Impulse[]>

// WebSocket
subscribeToEvents(handlers: WebSocketHandlers): () => void
```

**Mock Data Toggle**:
If API endpoints are not ready, implement mock data mode:
```typescript
const MOCK_MODE = import.meta.env.VITE_MOCK_DATA === 'true';
const data = MOCK_MODE ? mockData : await api.fetchData();
```

## Reference Documents

- **Main Design Doc**: `/home/avi/documents/work/exp-repo/metabob-devbob/ACTIVITY_DASHBOARD_DESIGN_PLAN.md`
- **Project README**: `repos/activity-dashboard/README.md`
- **Project Goals**: `repos/activity-dashboard/PROJECT_GOALS.md`
- **Quick Start**: `repos/activity-dashboard/QUICKSTART.md`

## Notes for MiniBob

- Focus on **Phase 1** first (enhance existing components)
- Prioritize **data density** and **minimal styling**
- Use **shadcn/ui components** exclusively (no custom UI primitives)
- Follow **new-york theme** conventions
- If API endpoints missing, implement gracefully (mock data toggle or "coming soon" messages)
- Commit frequently with clear messages
- Test after each component enhancement

## Questions to Resolve

If you encounter these, document the decision and proceed:

1. **Should we wait for API endpoints or mock data?**
   - Recommendation: Implement with mock data toggle

2. **How interactive should detail dialogs be?**
   - Recommendation: Read-only details, no inline editing

3. **Dark mode testing needed?**
   - Recommendation: Yes, verify both modes work

4. **Export format preferences?**
   - Recommendation: CSV for now, JSON later

5. **Real-time update frequency?**
   - Recommendation: WebSocket preferred, 5s polling fallback

Good luck! 🚀
