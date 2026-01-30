# OpenCode Memory Baseline Profile

**Generated:** Fri Jan 30 12:50:20 AM PST 2026

## Executive Summary

This baseline establishes normal memory usage patterns for OpenCode running in the devbob-opencode container before investigating memory leak issues. These measurements provide a reference point for detecting abnormal memory growth during session operations and impulse loading.

## Environment Configuration

- **Container:** devbob-opencode
- **OpenCode Command:** `opencode acp --port 3000 --hostname 0.0.0.0 --cwd /workspace`
- **Node.js Memory Limit:** `--max-old-space-size=2048` (2GB)
- **Container Memory Limit:** 7.651GiB
- **Host System:** Linux

## Baseline Memory Measurements

### Container-Level Memory Usage
```
Container: devbob-opencode
CPU Usage: 0.98%
Memory Usage: 330.3MiB / 7.651GiB (4.22%)
```

### Process-Level Memory Usage
```
OpenCode Process (PID 7):
- VSZ (Virtual Size): 74,197,544 KB (~72.4 GB virtual)
- RSS (Resident Set Size): 217,452 KB (~212.4 MB physical)
- CPU Usage: 1.2%
- Process State: Sl (sleeping, multi-threaded)
```

## Key Baseline Values

| Metric | Value | Notes |
|--------|-------|--------|
| Container RAM | 330.3 MiB | Total container memory usage |
| OpenCode RSS | 212.4 MB | Physical memory used by Node process |
| OpenCode VSZ | 72.4 GB | Virtual memory space (Node.js heap) |
| Memory % | 4.22% | Percentage of container limit used |
| Heap Limit | 2048 MB | Node.js max-old-space-size setting |

## System Context

### Host Memory Status
```
MemTotal:        8,023,172 kB (~7.65 GB)
MemFree:         6,502,964 kB (~6.20 GB)
MemAvailable:    6,958,136 kB (~6.64 GB)
Buffers:         71,612 kB (~70 MB)
Cached:          599,908 kB (~586 MB)
```

## Next Steps for Memory Leak Investigation

1. **Monitor Memory Growth:** Track RSS and container memory during:
   - Session creation operations
   - Impulse loading and processing
   - Undo/redo operations
   - Long-running sessions

2. **Alert Thresholds:** Consider these baseline values as normal:
   - Container memory: < 400 MiB (normal)
   - OpenCode RSS: < 300 MB (normal)
   - Growth rate: < 50 MB/hour under normal operation

3. **Investigation Targets:**
   - Memory growth > 500 MB RSS indicates potential leak
   - Container memory > 1 GB suggests system-level issue
   - Heap approaching 2 GB limit requires immediate attention

## Measurement Methodology

- Measurements taken immediately after OpenCode startup
- No active sessions or operations running
- Container in healthy state with all services initialized
- Baseline represents "idle" state for comparison

## Stability Analysis

**Initial Measurement:**
- Container: 330.3 MiB (4.22%)
- Process RSS: 217,452 KB

**After Connection Tests:**
- Container: 329.4 MiB (4.20%)
- Process RSS: 217,256 KB

**Stability:** Memory usage is very stable with minimal variation (<1 MiB) during basic operations.

## Memory Leak Detection Strategy

Based on this baseline, investigate memory leaks by monitoring for:

1. **RSS Growth Patterns:**
   - Normal: 210-220 MB RSS range
   - Concerning: Steady growth beyond 300 MB
   - Critical: Growth approaching 1 GB

2. **Container Memory Growth:**
   - Normal: 320-350 MiB range
   - Concerning: Growth beyond 500 MiB
   - Critical: Growth approaching 1 GiB

3. **Investigation Triggers:**
   - Sustained memory growth during impulse operations
   - Memory not returning to baseline after session completion
   - Heap usage approaching the 2 GB limit

## Recommended Monitoring Commands

```bash
# Continuous container monitoring
watch -n 5 'docker stats devbob-opencode --no-stream'

# Process memory monitoring
docker exec devbob-opencode bash -c 'watch -n 5 "ps aux | grep opencode"'

# Memory profile comparison
docker exec devbob-opencode bash -c 'cat /proc/$(pgrep opencode)/status | grep -E "(VmRSS|VmSize|VmHWM)"'
```

## Notes

- OpenCode ACP server is running and responsive (HTTP 500 errors are application-level, not connectivity issues)
- Process is stable with consistent memory footprint
- Virtual memory size is high but normal for Node.js applications with large heap limits
- Physical memory usage is reasonable for a development container
- Baseline established successfully for memory leak investigation