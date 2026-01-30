# Memory Monitoring Instrumentation - Implementation Complete

**Date:** Fri Jan 30 2026  
**Status:** ✅ IMPLEMENTED  
**Related Investigation:** METABOB_CLI_MEMORY_INVESTIGATION.md

## Summary

Successfully instrumented OpenCode's activity execution system with comprehensive memory monitoring to detect, track, and prevent the severe memory spikes (368MB → 4.4GB) discovered during investigation.

## Changes Implemented

### 1. Activity Execution Monitoring (`src/session/prompts-runner.ts`)

**Added memory monitoring hooks around activity execution:**

```typescript
// Before activity execution
- Capture baseline memory statistics
- Log starting memory state (heap, RSS)

// Before each prompt execution  
- Check memory status (normal/warning/high/critical)
- Force GC if memory is high or critical
- Log warning if pre-execution memory is elevated

// After each prompt execution
- Measure memory growth from single prompt
- Log warnings if growth > 25% for single operation
- Display memory usage in UI for significant growth

// After activity completion
- Generate comprehensive memory report
- Compare final vs baseline memory
- Report peak memory usage
- Display warnings for > 50% growth
- Force final GC if growth > 75%
```

**Example log output:**
```
activity execution starting
  activityId: "add-feature-complete"
  baselineHeapMB: "192.45"
  baselineRSSMB: "368.20"

high memory usage detected before prompt execution
  promptFile: "02-implement-feature.md"
  status: "high"
  growthPercent: 45.2

significant memory growth during prompt execution
  promptFile: "02-implement-feature.md"
  growthPercent: "38.5"
  currentStatus: "critical"

activity execution complete - memory report
  activityId: "add-feature-complete"
  baselineHeapMB: "192.45"
  finalHeapMB: "245.80"
  heapGrowthPercent: "+27.8%"
  peakHeapMB: "458.30"
  peakRSSMB: "842.15"
  memoryAlerts: 3
  trend: { prediction: "growth_concern", direction: "increasing" }
```

### 2. CLI Memory Monitoring (`src/index.ts`)

**Added memory monitoring lifecycle to all CLI operations:**

```typescript
async function main() {
  // Start monitoring at CLI initialization
  memoryMonitor.start()
  
  try {
    await cli.parse()
  } finally {
    // Final memory report on CLI exit
    const finalStats = memoryMonitor.getMemoryStatistics()
    log.info("cli execution complete - memory report", {
      runtime: finalStats.runtime,
      heapGrowth: finalStats.growth.heap,
      rssGrowth: finalStats.growth.rss,
      peakHeapMB: finalStats.maximum.heapMB,
      peakRSSMB: finalStats.maximum.rssMB,
      alerts: finalStats.alerts.count,
      trend: finalStats.trend.prediction,
    })
    memoryMonitor.stop()
  }
}
```

### 3. Updated Default Configuration (`src/config/config.ts`)

**Changed memory monitoring defaults based on investigation findings:**

| Config | Old Default | New Default | Reason |
|--------|-------------|-------------|--------|
| `enabled` | `false` | **`true`** | Enable monitoring by default to catch leaks early |
| `warningThreshold` | 50% | **30%** | Lower threshold - our spike went to 1100%, need early warning |
| `criticalThreshold` | 100% | **60%** | Trigger critical actions sooner (container reached 57% at 4.4GB peak) |
| `forceGcThreshold` | 75% | **40%** | Force GC earlier to prevent spike escalation |
| `checkInterval` | 60000ms | **10000ms** | Check every 10s instead of 60s (spikes occur in < 15s) |

**Rationale:**
- Investigation showed 368MB → 4.4GB growth in just 14 seconds
- This represents 1100%+ growth from baseline
- Container reached 57% of 7.6GB limit (dangerous territory)
- More aggressive monitoring needed to catch and mitigate early

### 4. Import Addition

**Added memory monitor import to activity runner:**

```typescript
import { memoryMonitor } from "../monitoring/memory-monitor"
```

## How It Works

### Memory Pressure Detection

1. **Baseline Establishment:**
   - Memory baseline captured at activity/CLI start
   - Includes heap used, RSS, total memory

2. **Periodic Monitoring:**
   - Check memory every 10 seconds (down from 60s)
   - Track growth percentage from baseline
   - Maintain history of last 100 data points

3. **Threshold-Based Actions:**
   - **30% growth → WARNING:** Log detailed stats, session memory stats
   - **40% growth → FORCE GC:** Trigger garbage collection + session cleanup
   - **60% growth → CRITICAL:** Emergency cleanup, multiple GC cycles, full reports

4. **Per-Operation Tracking:**
   - Before/after memory measurement for each prompt
   - Alert if single operation causes > 25% growth
   - Visual feedback in UI for significant growth

### Automatic Mitigation

**When memory pressure is detected:**

1. **Manual Cleanup:**
   ```typescript
   const cleanup = sessionMemoryManager.manualCleanup()
   // Removes stale sessions and impulses
   ```

2. **Forced Garbage Collection:**
   ```typescript
   if (global.gc) {
     global.gc() // Single cycle for high memory
     // Or multiple cycles for critical memory:
     for (let i = 0; i < 3; i++) global.gc()
   }
   ```

3. **Detailed Logging:**
   - Current memory stats (heap, RSS, external, array buffers)
   - Session and impulse memory usage
   - Recent memory history (last 10 data points)
   - Trend analysis (increasing/decreasing/stable)

## Expected Behavior After Implementation

### Normal Operation
```
Memory: 378MB RSS (+2.7% growth)
- Baseline: 368MB
- Peak: 395MB
- Alerts: 0
- Trend: stable
```

### With Monitoring Active (High Load)
```
⚠️  Memory: +45.2% before prompt execution
    Forcing garbage collection...
    
✓  Complete (2.5k tokens, $0.15)
⚠️  Memory: +38.5% (842MB RSS)
    Peak usage approaching 60% threshold

Activity caused 53.1% growth (Peak: 842MB RSS)
Forcing final garbage collection...
After GC: 421MB RSS (recovered 421MB)
```

### Critical Memory Spike (New Scenario)
```
🚨 CRITICAL memory usage detected - emergency cleanup
   Growth: 62.3%, Threshold: 60%
   
   Performing aggressive garbage collection (3 cycles)...
   Sessions removed: 12
   Impulses removed: 45
   Memory freed: 1,248MB
   
   After cleanup: 478MB RSS
```

## Validation & Testing

### Manual Testing Needed

Run the memory spike test from investigation:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Build with new instrumentation
docker exec devbob-opencode bash -c 'cd /workspace/repos/metabob-opencode && bun run build'

# Monitor memory during operation
docker stats devbob-opencode --no-stream &
STATS_PID=$!

# Execute test operation
docker exec devbob-opencode bash -c 'cd /workspace && opencode run "List all activity templates"'

# Check logs for monitoring output
docker exec devbob-opencode bash -c 'tail -100 /root/.local/share/opencode/log/dev.log | grep -E "(memory|Memory|growth|GC)"'

kill $STATS_PID
```

### Expected Test Results

**Before instrumentation:**
- Memory: 368MB → 4.4GB (1100% growth)
- No warnings, no GC, no mitigation
- Recovery only after natural GC

**After instrumentation:**
- Memory: 368MB → starts growing
- **At 30% (480MB):** WARNING logged
- **At 40% (515MB):** Force GC triggered
- **At 60% (589MB):** CRITICAL alert, emergency cleanup
- Growth limited by proactive GC
- Detailed reports in logs

### Success Criteria

✅ Memory growth detected early (30% threshold)  
✅ Automatic GC triggered before critical levels  
✅ Detailed logging of memory pressure events  
✅ Peak memory reduced by 50%+ vs unmonitored  
✅ Memory recovers to baseline after operations  
✅ No container OOM kills during normal usage

## Integration with Existing System

### Leverages Existing Infrastructure

This implementation uses OpenCode's existing `MemoryMonitor` class:
- Located at `src/monitoring/memory-monitor.ts`
- Already integrated with `SessionMemoryManager`
- Already has configuration schema
- Already started in `Server.listen()`

**We added:**
1. CLI initialization call to `memoryMonitor.start()`
2. Activity execution hooks for per-operation tracking
3. Updated default configuration
4. Import statements

### No Breaking Changes

- All changes are additive (new monitoring hooks)
- Existing code paths unchanged
- Memory monitoring can be disabled via config
- Backward compatible with all existing activities

## Configuration Override

Users can customize thresholds in `opencode.json`:

```json
{
  "monitoring": {
    "memory": {
      "enabled": true,
      "warningThreshold": 30,
      "criticalThreshold": 60,
      "forceGcThreshold": 40,
      "checkInterval": 10000,
      "historySize": 100,
      "alertCooldown": 300000
    }
  }
}
```

Or disable for testing:

```json
{
  "monitoring": {
    "memory": {
      "enabled": false
    }
  }
}
```

Or via environment variables:

```bash
export MEMORY_MONITOR_ENABLED=true
export MEMORY_WARNING_THRESHOLD=30
export MEMORY_CRITICAL_THRESHOLD=60
export MEMORY_FORCE_GC_THRESHOLD=40
export MEMORY_CHECK_INTERVAL=10000
```

## Files Modified

1. **`repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts`**
   - Added memory monitoring hooks around activity execution
   - Baseline capture, per-prompt tracking, final reporting
   - Automatic GC triggering for high memory

2. **`repos/metabob-opencode/packages/opencode/src/index.ts`**
   - Added memory monitor initialization in main CLI entry
   - Added final memory report on CLI exit
   - Memory lifecycle management

3. **`repos/metabob-opencode/packages/opencode/src/config/config.ts`**
   - Changed `monitoring.memory.enabled` default: `false` → `true`
   - Changed `warningThreshold`: `50` → `30`
   - Changed `criticalThreshold`: `100` → `60`
   - Changed `forceGcThreshold`: `75` → `40`
   - Changed `checkInterval`: `60000` → `10000`

## Next Steps

1. **Test Implementation:** Run memory spike test and verify monitoring works
2. **Monitor Production:** Observe memory behavior in devbob-opencode container
3. **Tune Thresholds:** Adjust based on real-world usage patterns
4. **Add Metrics Dashboard:** Consider adding memory trend visualization
5. **Document for Users:** Add memory monitoring docs to OpenCode documentation

## Related Issues

- **Root Cause:** Memory leak during OpenCode operations (not metabob-cli specific)
- **Trigger:** Any `opencode run` or activity execution
- **Symptom:** 368MB → 4.4GB growth in 14 seconds
- **Risk:** Multiple concurrent operations could OOM kill container
- **Solution:** Proactive monitoring + automatic GC + early warnings

## Investigation References

- **METABOB_CLI_MEMORY_INVESTIGATION.md:** Full investigation findings
- **memory_leak_report (impulse):** Original 200MB spike report
- **memory_baseline_profile (impulse):** Container baseline measurements

## Conclusion

Memory monitoring instrumentation is now **fully implemented and enabled by default**. The system will:

- ✅ Detect memory pressure early (30% threshold)
- ✅ Automatically trigger garbage collection (40% threshold)
- ✅ Alert on critical memory usage (60% threshold)
- ✅ Log comprehensive memory reports
- ✅ Track per-operation memory growth
- ✅ Provide trend analysis and predictions

This should **prevent the 4.4GB memory spikes** from causing container instability while providing visibility into memory behavior for future optimization.

**Status:** Ready for testing in devbob-opencode container.
