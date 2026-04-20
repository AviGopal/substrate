# Learning State Dashboard Guide

**Live terminal UI showing vessel learning state using React + Database queries**

## Overview

The Learning Dashboard combines three powerful technologies:

1. **Terminal Rendering** - Visual terminal output with colors and formatting
2. **React (Ink)** - Component-based UI in the terminal
3. **Database Queries** - Real-time learning state from SurrealDB

This creates a **live dashboard** showing Thompson Sampling evolution, execution traces, and activity performance as the vessel learns.

## What It Shows

### 1. Summary Statistics
- Total executions across all activities
- Average success rate
- Total cost (USD)
- Active template count

### 2. Thompson Sampling Scores
- α (alpha) values - successes + 1
- β (beta) values - failures + 1
- Calculated score: α/(α+β)
- Visual bar charts with color coding
- Execution counts and success rates

### 3. Recent Executions
- Last 10 activity executions
- Status (completed/failed)
- Duration and cost
- Relative timestamps

### 4. Real-Time Updates
- Refreshes every 5 seconds
- Shows connection status
- Graceful offline fallback

## Installation

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos
bun install
```

This installs:
- `ink` - React renderer for terminal
- `react` - React library

## Running the Dashboard

### Method 1: Mock Data (Development)
```bash
bun run learning-dashboard.tsx
```

Shows sample data for demonstration:
- 4 mock activities with Thompson scores
- 3 sample executions
- Updates every 5 seconds with simulated changes

**Use when:** Testing UI, no backend available

### Method 2: Live Database (Production)
```bash
export METABOB_API_KEY="your-api-key"
export ACTIVITY_API_URL="https://activity.metabob.com"
bun run learning-dashboard-live.tsx
```

Queries real database:
- `/v2/activities/templates` - Thompson scores
- `/v2/activities/execution-traces` - Recent executions
- Real-time learning state

**Use when:** Backend available, want real data

### Method 3: As Activity (Vessel-Native)
```bash
cd ../repos/minibob
bun run index.ts --single "run the learning dashboard in mock mode for 30 seconds"
```

Executes through activity system:
- Activity template: `demo:learning-dashboard`
- Can choose mock or live mode
- Output captured as impulses
- Part of vessel ecosystem

## How It Works

### React Terminal Rendering (Ink)

Traditional React renders to DOM:
```jsx
<div>Hello World</div>  →  Browser DOM
```

Ink renders to terminal:
```jsx
<Text>Hello World</Text>  →  Terminal ANSI
```

**Components used:**
- `<Box>` - Layout container (flexbox)
- `<Text>` - Styled text with colors
- `<Newline>` - Line breaks
- Borders, padding, colors via props

### Database Query Flow

```
Dashboard Component
    ↓
fetchFromDatabase()
    ↓
GET /v2/activities/templates
GET /v2/activities/execution-traces
    ↓
Parse JSON responses
    ↓
Calculate Thompson scores
    ↓
setState(newData)
    ↓
React re-renders terminal
    ↓
Updated display
```

### Thompson Score Calculation

```typescript
// From database:
const alpha = template.alpha || 1;  // Successes + 1
const beta = template.beta || 1;    // Failures + 1

// Calculate score (probability of success):
const score = alpha / (alpha + beta);

// Example:
// 10 successes, 2 failures:
//   α = 11, β = 3
//   score = 11/14 = 0.786 (78.6%)
```

### Visual Score Bar

```typescript
function ThompsonBar({ score }) {
  const filled = Math.floor(score * 20);  // 20 chars wide
  const empty = 20 - filled;

  const color = score > 0.7 ? 'green'    // High performer
              : score > 0.4 ? 'yellow'   // Medium
              : 'red';                   // Low performer

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
    </Text>
  );
}

// Renders as:
// ████████████████░░░░ 80%  (green - high score)
// ██████████░░░░░░░░░░ 50%  (yellow - medium)
// ████░░░░░░░░░░░░░░░░ 20%  (red - low score)
```

## Example Output

```
╔════════════════════════════════════════════════════════════════╗
║  MiniBob Vessel Learning State - Live Database Dashboard      ║
╚════════════════════════════════════════════════════════════════╝

Status: ● CONNECTED • Last update: 2s ago • Refresh #5

┌─ 📊 Summary Statistics ─────────────────────────────────────┐
│                                                              │
│  Total Executions:     36                                   │
│  Average Success Rate: 78.0%                                │
│  Total Cost:           $4.25                                │
│  Active Templates:     4                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ 🎯 Thompson Sampling - Top Performing Activities ──────────┐
│                                                              │
│ Activity                       α    β    Score              │
│ ──────────────────────────────────────────────────────────  │
│ Terminal Vessel Demo           5    1   ████████████████░░░░ 83%
│ Fix Bug (Complete)            12    3   ████████████████░░░░ 80%
│ Run Tests                      8    2   ████████████████░░░░ 80%
│ Create Pull Request            3    2   ████████████░░░░░░░░ 60%
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ ⚡ Recent Executions ───────────────────────────────────────┐
│                                                              │
│ Time        Status      Activity                Duration    │
│ ──────────────────────────────────────────────────────────  │
│ 5m ago      ✓ DONE     Terminal Vessel Demo       35.0s    │
│ 10m ago     ✓ DONE     Fix Bug (Complete)         2.0m     │
│ 15m ago     ✗ FAILED   Run Tests                  45.0s    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Press Ctrl+C to exit  •  Refreshes every 5s
```

## Combining with Other Demos

### Sequential Execution
```bash
# 1. Run vessel self-improvement demo
bun run terminal-vessel-demo.ts

# 2. Then show how it affects learning state
bun run learning-dashboard-live.tsx
```

### Side-by-Side (tmux)
```bash
# Terminal 1: Run activities
cd repos/minibob
bun run index.ts

# Terminal 2: Watch learning state
cd demos
bun run learning-dashboard-live.tsx
```

### Activity Composition
Create an activity that runs both:
```json
{
  "tasks": [
    {"activity": "demo:terminal-vessel"},
    {"activity": "demo:learning-dashboard"}
  ]
}
```

## Architecture Insights

### Why This Matters

**Observable Learning:**
- See Thompson Sampling evolution in real-time
- Watch α/β values change as activities execute
- Observe which activities the vessel prefers

**Performance Monitoring:**
- Track cost and duration trends
- Identify expensive activities
- Monitor success rates

**Meta-Circularity:**
- Dashboard IS an activity
- Can be executed through vessel
- Learning about learning

### The Component Stack

```
┌─────────────────────────────────────┐
│  React Components (JSX)             │  ← Developer writes this
├─────────────────────────────────────┤
│  Ink Renderer                       │  ← React → Terminal
├─────────────────────────────────────┤
│  ANSI Escape Codes                  │  ← Terminal formatting
├─────────────────────────────────────┤
│  Terminal Emulator                  │  ← Display
└─────────────────────────────────────┘
```

### Data Flow

```
SurrealDB (Backend)
    ↓
HTTP REST API
    ↓
fetch() queries
    ↓
Parse JSON
    ↓
React state (useState)
    ↓
Component render
    ↓
Ink → ANSI codes
    ↓
Terminal display
    ↓
[5 second interval]
    ↓
Repeat
```

## Extending the Dashboard

### Add New Metrics

```tsx
// 1. Add to LearningState type
interface LearningState {
  // ... existing fields
  avgDuration: number;
  deterministicRatio: number;
}

// 2. Query in fetchFromDatabase()
const avgDuration = traces.reduce(...) / traces.length;

// 3. Display in component
<Text>Avg Duration: {formatDuration(state.avgDuration)}</Text>
```

### Add Custom Visualizations

```tsx
// Sparkline component
function Sparkline({ data }: { data: number[] }) {
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const max = Math.max(...data);

  return (
    <Text>
      {data.map(v => chars[Math.floor((v / max) * 7)])}
    </Text>
  );
}

// Usage
<Sparkline data={[10, 20, 15, 30, 25]} />
// Renders: ▃▅▄█▆
```

### Add Interactive Controls

```tsx
import { useInput } from 'ink';

function Dashboard() {
  const [paused, setPaused] = useState(false);

  useInput((input, key) => {
    if (input === 'p') setPaused(!paused);
    if (input === 'r') refreshNow();
  });

  // ... rest of component
}
```

## Troubleshooting

### Dependencies Not Found
```bash
cd demos
bun install
```

### Backend Unavailable
Dashboard shows:
```
Status: ● OFFLINE
⚠ Backend unavailable - showing cached data or offline mode
```

**Solutions:**
1. Check `METABOB_API_KEY` environment variable
2. Verify backend URL is correct
3. Use mock mode: `bun run learning-dashboard.tsx`

### React/Ink Errors
```bash
# Clear Bun cache
rm -rf node_modules
bun install

# Check Bun version
bun --version  # Should be 1.3.11+
```

## Key Takeaways

✓ **React in terminal** - Full component model with Ink

✓ **Real-time database queries** - Live learning state

✓ **Visual Thompson Sampling** - See vessel learning evolve

✓ **Activity integration** - Dashboard IS an activity

✓ **Observable system** - Watch the vessel improve itself

✓ **Composable** - Combine with other demos

✓ **Extensible** - Add metrics, visualizations, interactions

---

**Created**: 2026-04-18
**Purpose**: Real-time visualization of vessel learning state
**Tech**: React (Ink) + SurrealDB + Terminal ANSI
**Status**: Ready to execute
