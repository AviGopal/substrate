# Enhanced Statistics Panel Implementation

## Overview

Implemented a comprehensive statistics panel in the `opencode stats` command that provides a unified view of:
- Session and token usage statistics
- Activity execution statistics (active, completed, failed, success rate)
- Metabob code quality metrics (via dashboard API)
- Boredom system status (monitoring state, idle detection, available tasks)
- Manual boredom trigger capability

## Features

### 1. System Overview Section
- Total sessions and messages
- Total activities tracked
- Days active in the system

### 2. Cost & Tokens Section  
- Total cost and cost per day
- Input/output token usage
- Cache read/write statistics

### 3. Activity Statistics Section
- Total activities with breakdown:
  - 🔄 Active activities
  - ✅ Completed activities
  - ❌ Failed activities
- Success rate percentage

### 4. Metabob Code Quality Section (when dashboard API available)
- Total issues by severity:
  - 🔴 Critical
  - 🟠 High
  - 🟡 Medium
  - 🟢 Low
- Files analyzed count
- Components found count

### 5. Boredom System Section
- Monitoring status (active/inactive)
- Current status (idle/active)
- Available boredom tasks count
- Manual trigger command

### 6. Tool Usage Section (existing)
- Top tool usage with bar charts
- Percentage breakdown

## Usage

### View Statistics Panel
```bash
opencode stats
```

### View Statistics with Dashboard Integration
```bash
opencode stats --dashboard-api http://localhost:8083
```

### Manually Trigger Boredom Mode
```bash
opencode stats --trigger-boredom
```

This will:
1. Show the statistics panel
2. Fetch available boredom activities
3. Present an interactive selector
4. Execute the selected boredom activity in a new session

### Filter by Time Period
```bash
opencode stats --days 7          # Last 7 days
opencode stats --days 30         # Last 30 days
```

### Filter by Project
```bash
opencode stats --project ""      # Current project only
opencode stats --project <id>    # Specific project
```

## Implementation Details

### Files Modified
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts`

### New Functions
- `aggregateActivityStats()`: Fetches activity statistics from Activity.list()
- `fetchMetabobStats()`: Fetches code quality metrics from dashboard API
- `getBoredomStatus()`: Retrieves boredom system monitoring status
- `displayComprehensiveStats()`: Renders the unified statistics panel
- `triggerBoredomMode()`: Interactive boredom activity selector and executor

### Integration Points
- **Activity System**: `Activity.list()` for activity statistics
- **Dashboard API**: HTTP endpoints at `http://localhost:8083/metrics` and `/problems`
- **Boredom Manager**: Via Metabob MCP `metabob_fetch_boredom_activities` tool
- **Session System**: `Session.createNext()` for manual boredom execution

## Dashboard API Requirements

The dashboard API should be running at `http://localhost:8083` (configurable via `--dashboard-api` flag).

Required endpoints:
- `GET /metrics` - Returns project metrics including issue counts
- `GET /problems` - Returns problem summary with severity breakdown

Example response structure:
```json
{
  "project_metrics": {
    "total_issues": 127,
    "critical_issues": 3,
    "files_analyzed": 1523,
    "components_found": 3847
  }
}
```

## Boredom System Integration

When `--trigger-boredom` is used:

1. Connects to Metabob MCP client
2. Calls `metabob_fetch_boredom_activities` tool
3. Presents available tasks sorted by priority
4. User selects task interactively via @clack/prompts
5. Creates new session for boredom activity execution
6. Returns session ID for attachment

### Example Boredom Activity Selection
```
? Select boredom activity to execute: ›
  evolve-activity-self-contained (priority: 0.85)
  improve-template-struggling (priority: 0.78)
  debug-failures-low-improvement (priority: 0.72)
  optimize-performance (priority: 0.65)
  cleanup-documentation-and-tests (priority: 0.58)
```

## Benefits

1. **Unified View**: Single command shows all system health metrics
2. **Quick Decision Making**: See at-a-glance if system needs attention
3. **Boredom Management**: Easy manual trigger for idle-time improvements
4. **Dashboard Integration**: Real-time code quality visibility
5. **Activity Tracking**: Monitor workflow success rates and patterns

## Future Enhancements

1. **TUI Integration**: Add keyboard shortcut (e.g., `Ctrl+S`) in TUI mode
2. **Live Updates**: Auto-refresh statistics in TUI mode
3. **Historical Trends**: Show trend graphs for cost, activities, issues
4. **Alerting**: Highlight concerning metrics (high failure rate, critical issues)
5. **Export**: Support JSON/CSV export for external analysis

## Testing

The implementation was tested with:
- Build verification: `npm run build` succeeded
- Help output: `opencode stats --help` shows new options
- Simulated output: Verified panel formatting and layout

Full integration testing requires:
1. Running dashboard API server
2. Active Metabob MCP client
3. Boredom activities available in backend

## Known Issues

- Bootstrap template path issue in Metabob MCP configuration (separate from stats implementation)
- Dashboard API must be manually started (not auto-detected)
- Boredom status currently simplified (needs BoredomManager state query API)

## Related Documentation

- Boredom system: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
- Activity system: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- Dashboard API: `repos/metabob-dashboard/data-bridge-server.js`
