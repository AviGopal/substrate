# Activity Monitor - Quick Start Guide

## ✅ Status: Running on http://localhost:3030

The activity monitor is a live dashboard showing:
- 📊 Recent activity executions (as they happen)
- 💫 Impulse resolution patterns
- 📝 Activity templates and variants
- 🏷️ Tag-based groupings

---

## 🚀 Access the Dashboard

**Open in your browser**: http://localhost:3030

The dashboard will auto-refresh every 3 seconds with new data from the canary backend.

---

## 📊 Dashboard Layout

### Top Bar
- **Status Indicator**: Green pulse = live, red = error
- **Last Update**: Timestamp of last data refresh
- **Connection Status**: Backend connectivity

### Main Panels

#### 1. Recent Executions (Full Width)
Shows the last 50 activity executions with:
- Activity ID and execution ID
- Status (color-coded: green=success, red=failed, yellow=running)
- Timestamp
- Duration (milliseconds or seconds)
- Cost (USD)
- Token usage (input → output)

**New executions animate in** when they appear.

#### 2. Activity Templates (Left Column)
Grouped by category (feature, bugfix, meta, etc.):
- Template name
- Top 3 tags
- Variant count
- Thompson Sampling score (α/(α+β) as percentage)

#### 3. Impulse Resolution (Right Column)
Shows shape resolution patterns:
- Shape name (e.g., execution_trace, git_status)
- Resolver used (e.g., bash, llm, file)
- Total resolutions
- Average duration

---

## 🎨 Visual Indicators

**Status Colors**:
- 🟢 Green border = Completed successfully
- 🔴 Red border = Failed
- 🟡 Yellow border = Running/In progress

**Tags**:
- Green tags = Activity-specific labels
- Grouped by category for easy scanning

**Metrics**:
- Green numbers = Success indicators (Thompson score, count)
- Yellow numbers = Performance metrics (duration)
- White text = General information

---

## 🔄 Real-Time Updates

The dashboard polls the backend every **3 seconds**:
1. Server fetches latest data from `https://activity.metabob.com`
2. Browser polls server for updates
3. New executions animate in automatically
4. No page refresh needed

---

## 🧪 Testing the Display

### Run a MiniBob Activity

In another terminal:
```bash
cd ../minibob
export METABOB_API_KEY="your-api-key"
minibob --single "check git status"
```

You should see the execution appear in the dashboard within 3 seconds!

### Trigger Multiple Activities

```bash
# In REPL mode
minibob

# Then type:
check git status
run tests
create a simple hello world file
```

Watch the dashboard populate with real-time executions.

---

## 📡 API Endpoints

The monitor exposes these endpoints:

### `GET /api/data`
Returns cached dashboard data:
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
  "cacheAge": 2857
}
```

---

## 🎯 Use Cases

### 1. Development Monitoring
Keep the dashboard open while developing:
- See activity executions in real-time
- Monitor cost and performance
- Track Thompson Sampling scores

### 2. Pattern Discovery
Watch for patterns:
- Which activities run frequently?
- What's the success rate?
- Which impulses are resolved most?

### 3. Debugging
When things go wrong:
- See failed executions immediately
- Check status and duration
- Identify bottlenecks

### 4. Demonstrations
Show the system working:
- Live executions appearing
- Thompson scores updating
- Learning loop in action

---

## ⚙️ Configuration

The monitor is configured via environment variables:

```bash
export METABOB_API_KEY="your-api-key-here"
export ACTIVITY_API_URL="https://activity.metabob.com"  # Optional
export PORT=3030  # Optional
```

**Current Configuration**:
- Backend: https://activity.metabob.com
- Port: 3030
- Poll Interval: 3 seconds
- Templates Loaded: ✅ 50 templates

---

## 🐛 Troubleshooting

### No Executions Showing
**Possible causes**:
1. No activities have been run recently
2. API key doesn't have read permissions
3. Backend endpoint changed

**Solution**: Run a test activity:
```bash
minibob --single "hello world"
```

### Templates Not Loading
**Check**:
```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates
```

### Connection Errors
**Verify backend is accessible**:
```bash
curl https://activity.metabob.com/health
```

Should return:
```json
{
  "service": "metabob-activity-api",
  "status": "healthy",
  ...
}
```

---

## 🚀 Next Steps

1. **Open Dashboard**: http://localhost:3030
2. **Run Activities**: Use MiniBob to execute activities
3. **Watch in Real-Time**: See executions appear live
4. **Monitor Patterns**: Track which activities succeed/fail
5. **Observe Learning**: Watch Thompson scores evolve

---

## 💡 Pro Tips

- **Keep it open on a second monitor** for continuous visibility
- **Use browser zoom** (Ctrl/Cmd + or -) to fit your screen
- **Check "Last Update"** to verify data is flowing
- **Look for color changes** to spot new activity immediately
- **Monitor Thompson scores** to see learning in action

---

**Dashboard is running at**: http://localhost:3030
**Backend**: https://activity.metabob.com ✅
**Status**: Healthy
**Templates**: 50 loaded

🎉 **Ready to monitor!**
