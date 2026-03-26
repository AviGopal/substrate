# Stats Panel Quick Reference

## What's New?

The `opencode stats` command now shows a comprehensive dashboard including:

✅ **Activity Statistics** - Success rates, active/completed/failed counts  
✅ **Metabob Metrics** - Code quality issues by severity  
✅ **Boredom System** - Monitoring status and available improvement tasks  
✅ **Manual Boredom Trigger** - Interactive task selection and execution

## Quick Commands

```bash
# View comprehensive statistics
opencode stats

# Manually trigger boredom mode
opencode stats --trigger-boredom

# Filter last 7 days
opencode stats --days 7

# Custom dashboard API URL
opencode stats --dashboard-api http://custom-url:8083
```

## Sample Output

```
┌────────────────────────────────────────────────────────┐
│                   SYSTEM OVERVIEW                      │
├────────────────────────────────────────────────────────┤
│Sessions                                          1,247 │
│Messages                                         15,892 │
│Activities                                          684 │
│Days Active                                          45 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                  ACTIVITY STATISTICS                   │
├────────────────────────────────────────────────────────┤
│Total Activities                                    684 │
│🔄 Active                                           254 │
│✅ Completed                                         247 │
│❌ Failed                                            183 │
│Success Rate                                        57% │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                 METABOB CODE QUALITY                   │
├────────────────────────────────────────────────────────┤
│Total Issues                                        127 │
│  🔴 Critical                                         3 │
│  🟠 High                                            12 │
│  🟡 Medium                                          45 │
│  🟢 Low                                             67 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                   BOREDOM SYSTEM                       │
├────────────────────────────────────────────────────────┤
│Monitoring                                     ✓ Active │
│Status                                         ⚡ Active │
│Available Tasks                                       5 │
│Manual Trigger         opencode stats --trigger-boredom │
└────────────────────────────────────────────────────────┘
```

## Boredom Trigger Workflow

When you run `opencode stats --trigger-boredom`:

1. **Shows Statistics** - Full panel display
2. **Fetches Tasks** - Queries Metabob for improvement opportunities
3. **Interactive Selection** - Choose from available tasks:
   ```
   ? Select boredom activity to execute: ›
     evolve-activity-self-contained (priority: 0.85)
     improve-template-struggling (priority: 0.78)
     debug-failures-low-improvement (priority: 0.72)
   ```
4. **Confirms Details** - Shows task details and asks for confirmation
5. **Executes Activity** - Creates new session and starts execution
6. **Returns Session ID** - Attach with `opencode session attach <id>`

## Integration Requirements

### Dashboard API
- Default: `http://localhost:8083`
- Endpoints: `/metrics`, `/problems`
- Optional (gracefully degrades if unavailable)

### Metabob MCP
- Required for boredom trigger
- Configured in `.opencode/opencode.json`
- Tool: `metabob_fetch_boredom_activities`

## Tips

💡 **Quick Health Check**: Run `opencode stats` to see system status at a glance

💡 **Idle Time Improvements**: Use `--trigger-boredom` when you have time for system improvements

💡 **Dashboard Integration**: Start dashboard API server for real-time code quality metrics

💡 **Success Rate Monitoring**: Watch activity success rate - aim for >70%

## Related Commands

```bash
# View detailed activity list
opencode activity list

# View activity details
opencode activity list --verbose

# View specific template metrics
opencode activity metrics <template-id>
```

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts`

## Documentation

- Full details: `STATS_PANEL_IMPLEMENTATION.md`
- Boredom system: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
