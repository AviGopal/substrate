# Dashboard Changelog

## [1.0.0] - 2026-04-20

### Initial Release

- **Executions Panel**: View recent activity executions with status and duration
- **Templates Panel**: Browse available activity templates by category
- **Thompson Sampling Panel**: Visualize exploration/exploitation status per activity
- **Metrics Panel**: Impulse resolution metrics and latency data
- **Data Sources Panel**: View configured API endpoints and shapes
- **Trace Collection Panel**: Monitor trace batching and flush status

### Features

- **Client-side tracing**: All API calls are traced for learning loop analysis
- **LocalStorage persistence**: API endpoint and key saved across sessions
- **3-second polling**: Optional real-time data updates
- **10-second caching**: Reduce API calls for frequently accessed shapes
- **Retry logic**: Automatic retry with exponential backoff on failures

### Architecture

- `index.html` - Main dashboard entry point
- `monitor.js` - Data fetching module with polling and caching
- `tracer.js` - Client-side tracing for self-improvement loop
- `styles.css` - Dark theme styling

---
*Self-improving dashboard - traces feed the learning loop*
