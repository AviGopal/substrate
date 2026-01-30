# OpenCode Baseline Memory Profile

Generated on: January 30, 2026

## Test Environment

- **Container**: devbob-opencode
- **Host Memory Limit**: 7.651 GiB
- **Node.js Max Old Space**: 2048 MB (2 GB)
- **OpenCode Process**: Running as ACP server on port 3004
- **Process ID**: 7

## Baseline Measurements

### Container Memory Usage (Before OpenCode Start)
- **Memory Usage**: 347.7 MiB / 7.651 GiB (4.44%)
- **CPU Usage**: 0.36%
- **Process Count**: 71

### Container Memory Usage (After OpenCode ACP Server Start)
- **Memory Usage**: 348.0 MiB / 7.651 GiB (4.44%)
- **CPU Usage**: 0.47%
- **Process Count**: 71
- **Memory Increase**: +0.3 MiB (minimal ACP server overhead)

### OpenCode Process Memory (Initial State)
```
VmPeak:    135402304 kB  (132.2 GB peak virtual memory)
VmSize:     74132824 kB  (72.4 GB current virtual memory)
VmHWM:        263140 kB  (257 MB peak resident memory)
VmRSS:        233648 kB  (228 MB current resident memory)
Threads:             13
```

### Memory Usage After Simple Operation ("List files")
- **Container Memory**: 373.7 MiB (during execution) → 380.3 MiB (post-execution)
- **Memory Increase**: +25.6 MiB → +32.3 MiB final
- **Process RSS**: 195724 kB (191 MB) - decreased from 228 MB
- **Process Peak unchanged**: VmHWM: 263140 kB (257 MB)

### Memory Usage After Metabob Query Operation
- **Container Memory**: 377.3 MiB (during execution) → 377.6 MiB (post-execution)
- **Memory Increase**: +29.3 MiB → +29.6 MiB final
- **Process RSS**: 195604 kB (191 MB) - remained stable
- **Process Peak unchanged**: VmHWM: 263140 kB (257 MB)

## Key Observations

1. **Baseline Container Memory**: ~348 MiB with OpenCode ACP server running
2. **OpenCode Process**: ~228 MB resident memory initially, ~191 MB after operations
3. **Memory Pattern**: Operations cause temporary spikes but memory appears to be released
4. **Virtual Memory**: High virtual memory allocation (72.4 GB) but low resident usage
5. **Memory Stability**: No obvious memory leak in simple operations

## Memory Allocation Patterns

- Large virtual memory space allocation (typical for Node.js V8 heap)
- Resident memory usage is reasonable (~191-228 MB)
- Memory appears to be managed and released after operations
- Peak memory usage remains stable across operations

## Metabob-Specific Observations

- **Metabob Config Present**: Located at `/workspace/.metabob/config.json`
- **API Endpoint**: `http://api-server-dev:8080`
- **No Obvious Memory Spike**: Simple metabob query didn't show significant memory retention
- **Need Deeper Testing**: More intensive metabob operations needed to reproduce the 200MB leak

## Next Steps for Memory Leak Investigation

1. **Longer-running metabob operations** - Complex queries, multiple API calls
2. **Repeated metabob tool invocations** - Look for cumulative memory retention
3. **MCP client connection patterns** - Monitor memory during MCP connection/disconnection
4. **Metabob response caching** - Check if large responses are being cached in memory
5. **Activity template execution** - Test memory usage with metabob-heavy activities

## Baseline Values for Comparison

| Metric | Baseline Value | Unit |
|--------|---------------|------|
| Container Memory | 348 MiB | MiB |
| Process RSS | 228 MB | MB |
| Process Peak RSS | 257 MB | MB |
| Process Virtual Memory | 72.4 GB | GB |
| Thread Count | 13 | threads |

These values should be compared against measurements taken during memory leak reproduction attempts.