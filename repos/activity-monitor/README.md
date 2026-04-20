# Activity Monitor

Live monitoring dashboard for MiniBob activity system. Shows real-time activity executions, impulse resolutions, and template metrics.

## Features

- 🔄 **Real-time Updates** - Polls backend every 3 seconds
- 📊 **Recent Executions** - Last 50 activity executions with status, cost, duration
- 📝 **Activity Templates** - All templates grouped by category with Thompson scores
- 💫 **Impulse Resolution** - Shape resolution patterns and performance
- 🎨 **Clean UI** - Single-page dashboard optimized for monitoring

## Quick Start

```bash
# Install dependencies
bun install

# Set environment variables
export METABOB_API_KEY="your-api-key-here"
export ACTIVITY_API_URL="https://activity.metabob.com"  # Optional, defaults to this

# Start the server
bun run dev
```

Open http://localhost:3030 in your browser.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `METABOB_API_KEY` | (required) | API key for metabob backend |
| `ACTIVITY_API_URL` | https://activity.metabob.com | Backend API endpoint |
| `PORT` | 3030 | Server port |

## API Endpoints

### `GET /`
Main dashboard HTML page

### `GET /api/data`
Returns cached data:
```json
{
  "executions": [...],
  "templates": [...],
  "impulses": [...],
  "lastUpdate": 1776600000000
}
```

### `GET /api/health`
Health check:
```json
{
  "status": "healthy",
  "backend": "https://activity.metabob.com",
  "lastUpdate": "2026-04-20T06:00:00.000Z",
  "cacheAge": 2543
}
```

## Dashboard Panels

### Recent Executions
- Shows last 50 activity executions
- Color-coded by status (green=completed, red=failed, yellow=running)
- Displays cost, duration, and token usage
- Auto-scrolls to show latest

### Activity Templates
- All registered activity templates
- Grouped by category (feature, bugfix, meta, etc.)
- Shows variant count and Thompson Sampling score
- Displays top 3 tags per template

### Impulse Resolution
- Shape resolution patterns
- Shows which resolver handles each shape
- Resolution count and average duration
- Performance metrics

## Architecture

Simple polling-based monitoring:
```
Browser ←→ Bun Server ←→ Activity API (Canary)
  (3s)      (cache)        (authenticated)
```

- Server polls backend every 3 seconds
- Browser polls server every 3 seconds
- All data cached in memory
- No database required

## Development

```bash
# Watch mode (auto-restart on changes)
bun run dev

# Production mode
bun run start
```

## Integration with MiniBob

This vessel can be used alongside MiniBob to monitor its activity:

```bash
# Terminal 1: Run MiniBob
cd ../minibob
minibob

# Terminal 2: Run Activity Monitor
cd ../activity-monitor
bun run dev
```

Now you can see MiniBob's activities appear in real-time in the dashboard at http://localhost:3030.

## Troubleshooting

**No data showing**:
- Check METABOB_API_KEY is set correctly
- Verify ACTIVITY_API_URL is accessible
- Check browser console for errors

**Stale data**:
- Check "Last Update" timestamp in header
- Server should update every 3 seconds
- Check server logs for API errors

**Authentication errors**:
- Ensure API key is valid
- Check API key has correct permissions
- Try accessing API directly: `curl -H "Authorization: ApiKey $METABOB_API_KEY" https://activity.metabob.com/health`

## Future Enhancements

- [ ] WebSocket support for true real-time updates
- [ ] Filtering by activity category/tag
- [ ] Search functionality
- [ ] Execution detail modal
- [ ] Thompson Sampling visualization
- [ ] Pattern discovery timeline
- [ ] Cost/performance charts
- [ ] Export functionality

## License

Part of the metabob-devbob ecosystem.
