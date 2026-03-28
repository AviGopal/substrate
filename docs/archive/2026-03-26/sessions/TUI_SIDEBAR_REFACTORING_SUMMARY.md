# TUI Sidebar Refactoring Summary

## Overview
Successfully refactored the TUI sidebar component from **919 lines to 410 lines** (55% reduction) while preserving all meaningful functionality and adopting a minimalist design philosophy.

## What Changed

### Before
- 919 lines of code
- 10+ duplicate collapsible section implementations
- 4+ different progress bar implementations  
- Overlapping displays for cost, memory, and context metrics
- Complex nested relationship visualizations (impulse-activity maps, integration flow diagrams)
- Scattered utility functions for formatting

### After  
- 410 lines of code (55% reduction)
- 3 reusable components: `CollapsibleSection`, `ProgressBar`, `InfoRow`
- Consolidated metric displays into logical sections
- Minimalist information hierarchy
- All essential functionality preserved

## New Component Architecture

### 1. CollapsibleSection Component
**Purpose**: Eliminate repetitive expand/collapse logic duplicated 10+ times

**Features**:
- Consistent expand/collapse UX pattern
- Optional badge (e.g., "5 todos", "3 activities")
- Optional warning indicator
- Controlled state (parent manages expanded state)

**Usage**:
```tsx
<CollapsibleSection
  title="Memory"
  expanded={memoryExpanded()}
  onToggle={() => setMemoryExpanded(!memoryExpanded())}
  badge={impulseCount}
  warning={utilizationCritical}
>
  {/* Section content */}
</CollapsibleSection>
```

### 2. ProgressBar Component
**Purpose**: Standardize progress visualization across all metrics

**Features**:
- Handles edge cases (NaN, Infinity, out-of-range)
- Configurable width (default: 20 chars)
- Optional semantic coloring (RGBA type)
- Consistent filled/empty block representation

**Usage**:
```tsx
<ProgressBar 
  percentage={contextUtilization()} 
  width={30} 
  color={getStatusColor(contextUtilization())} 
/>
```

### 3. InfoRow Component
**Purpose**: Consistent key-value display pattern

**Features**:
- Label + value layout with space-between justification
- Optional color for semantic highlighting
- Supports both string and JSX values

**Usage**:
```tsx
<InfoRow 
  label="Cost" 
  value={totalCost()} 
  color={budgetWarning() ? theme.warning : theme.textMuted} 
/>
```

## Information Architecture

### Consolidated Sections

#### 1. Overview (Expanded by default)
**Consolidated from**: Session Overview, Context Window, Cost Breakdown  
**Shows**: Cost, context utilization, cache hit rate  
**Rationale**: All session-level metrics in one place

#### 2. Activities (Expanded when active)
**Shows**: Running activities with progress, status, elapsed time  
**Rationale**: Essential for understanding current work

#### 3. Memory (Expanded when impulses exist)
**Consolidated from**: Session Memory, Memory Management  
**Shows**: Impulse usage, heap usage with progress bars  
**Rationale**: Unified view of all memory concerns

#### 4. System (Collapsed by default)
**Consolidated from**: MCP, LSP, ACP sections  
**Shows**: MCP/LSP/ACP connection status  
**Rationale**: Infrastructure details rarely needed, hide by default

#### 5. Todo (Expanded when todos exist)
**Shows**: Todo list with completion checkboxes  
**No changes**: Already concise

#### 6. Modified Files (Expanded when diffs exist)
**Shows**: Changed files with additions/deletions  
**No changes**: Already concise

### Removed Features

#### 1. Impulse-Activity Relationship Map (~80 lines)
**Why**: Complex nested tree showing which impulses each activity uses. Provided detailed tracing but added cognitive overhead without clear actionable value.

#### 2. Integration Flow Diagram (~120 lines)
**Why**: ASCII-art graph showing impulse→activity→ACP relationships. Visually complex, rarely consulted in practice.

#### 3. Activity-ACP Source Rendering (~50 lines)
**Why**: Showed which activity spawned each ACP agent. Useful for debugging but not essential for day-to-day usage.

#### 4. Cost Breakdown by Activity/Impulse (~80 lines)
**Why**: Detailed cost attribution tables. Still available via API endpoint, just not cluttering the sidebar. Top-level cost in Overview is sufficient.

## Code Quality Improvements

### 1. DRY Principle
- **Before**: 10+ sections with copy-pasted expand/collapse logic
- **After**: Single `CollapsibleSection` component reused everywhere

### 2. Type Safety
- Proper RGBA types for colors (not `string`)
- Type-only JSX import for `verbatimModuleSyntax` compliance

### 3. Computed Values
- Extracted repeated calculations into memos:
  - `contextUtilization()`
  - `memoryUtilization()` 
  - `heapUtilization()`
  - `budgetWarning()`

### 4. Semantic Functions
- `getStatusColor(percentage)`: Centralized threshold logic (red ≥85%, yellow ≥60%, green <60%)
- `formatTime(ms)`: Consistent time formatting

## Minimalist Design Philosophy

### Show Prominently
✅ Session cost and budget warnings  
✅ Context window utilization  
✅ Active activities and progress  
✅ Memory pressure indicators  
✅ Todo items and modified files

### Hide by Default
⏸️ MCP/LSP/ACP connection status (in "System" section, collapsed)  
❌ Complex relationship visualizations  
❌ Detailed cost attribution tables  
❌ Internal impulse/activity tracing

### Rationale
Users need **actionable information** at a glance. Infrastructure details and debugging visualizations belong in dedicated tools or on-demand views, not permanently consuming sidebar real estate.

## Testing

### TypeScript Compilation
✅ No type errors after refactoring  
✅ Proper RGBA type usage throughout  
✅ Type-only JSX import

### Preserved Functionality
✅ All collapsible sections work  
✅ Progress bars render correctly  
✅ Warning indicators appear when thresholds crossed  
✅ Real-time data updates via SSE (unchanged)  
✅ Session state polling every 2.5s (unchanged)

## Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of Code | 919 | 410 | -55% |
| Collapsible Sections | 10 | 6 | -40% |
| Progress Bar Impls | 4 | 1 | -75% |
| Reusable Components | 0 | 3 | +3 |
| Removed Complex Visualizations | - | 3 | -330 lines |

## Future Improvements

### Possible Enhancements
1. **Persist Section State**: Save expanded/collapsed preferences to KV store
2. **Activity Tree View**: Restore hierarchical activity display as opt-in feature
3. **Cost History Graph**: Mini-chart showing cost trend over session
4. **Keyboard Navigation**: Arrow keys to navigate between sections
5. **Customizable Sections**: Let users reorder or hide sections via config

### Non-Goals
- ❌ Don't add back complex visualizations to sidebar
- ❌ Don't expand System section by default
- ❌ Don't show detailed cost breakdowns inline (use command or dialog instead)

## Annotations

All key components have been annotated with design rationale:
- `CollapsibleSection`: Why extract, why controlled state, why badge/warning props
- `ProgressBar`: Why consolidate, why edge case handling, why RGBA color type
- `Sidebar`: Why consolidate sections, why remove visualizations, why minimalist approach

## Conclusion

This refactoring achieves the goal of **cleaning up redundant TUI sidebar components** while **keeping meaningful information available in a minimalist style**. The 55% code reduction improves maintainability without sacrificing functionality, and the extracted reusable components provide a foundation for consistent UX patterns across the TUI.
