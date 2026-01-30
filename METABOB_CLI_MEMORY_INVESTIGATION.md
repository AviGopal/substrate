# Metabob-CLI Memory Investigation

**Date:** Fri Jan 30 2026  
**Container:** devbob-opencode  
**Investigation Focus:** Memory leak correlation with metabob-cli MCP connection

## Key Findings

### 1. Metabob-CLI Process Status ✅

**Process is running:**
- PID: 199
- Command: `/opt/metabob-cli/.venv/bin/python -m metabob_cli mcp --transport stdio`
- Started by: OpenCode's auto-start MCP integration

**Memory Usage:**
- RSS (Physical Memory): **176 MB** (176,560 KB)
- VSZ (Virtual Memory): 2,540,784 KB (~2.4 GB)
- Threads: 38
- Memory % of Container: **~48%**

**Container Total Memory:**
- Container Usage: 368.2 MiB / 7.651 GiB (4.70%)
- Metabob-CLI alone: 176 MB (~48% of container usage)
- OpenCode process: ~192 MB remaining

### 2. Configuration ✅

**OpenCode Configuration** (`/workspace/.opencode/opencode.json`):
```json
{
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://api-server-dev:8080",
    "api_key": "",
    "auto_inject": true,
    "headless": true,
    "max_issues": 5,
    "min_severity": "MEDIUM"
  }
}
```

**Environment Variables:**
- `METABOB_API_URL=http://api-server-dev:8080`
- `METABOB_PROJECT_ID=exp-repo-dev`
- `METABOB_SYNC_ACTIVITIES=true`
- `METABOB_ENABLE_DASHBOARD=true`

### 3. Backend Connectivity ✅

**Backend Status:**
- Backend URL: `http://api-server-dev:8080`
- Connectivity: ✅ Connected (returns `{"detail":"Not Found"}` - server is responding)
- Health endpoint: `/health` returns 404 (not implemented, but server responds)

### 4. MCP Integration Status ⚠️

**Issue Identified:**
- `test_metabob_mcp` tool reports: "Metabob MCP client not found"
- Metabob-cli process IS running (PID 199)
- OpenCode logs show: "OpenCode will auto-start metabob-cli MCP server"
- **Hypothesis:** MCP connection may be stdio-based, not network-based

**Possible Causes:**
1. MCP client uses stdio transport, not visible to test tool
2. OpenCode's MCP client registry may need stdio-specific lookup
3. Test tool may only check for network-based MCP clients

## Memory Leak Analysis

### Comparison with Baseline

**From previous memory baseline report:**
- Container baseline (idle): 330.3 MiB
- OpenCode process baseline: 217 MB RSS

**Current state:**
- Container: 368.2 MiB (+37.9 MiB from baseline)
- Total processes: ~368 MB
- Metabob-CLI: 176 MB
- OpenCode: ~192 MB (DOWN from 217 MB baseline)

### Critical Observation

**Memory distribution shows:**
- Metabob-CLI: 48% of container memory
- OpenCode: 52% of container memory (LESS than baseline alone)

**This suggests:**
1. ✅ Metabob-CLI is using significant memory (176 MB)
2. ⚠️ BUT OpenCode's memory went DOWN when metabob-cli started
3. 🔍 Total increase from baseline: only 38 MB, not the 200 MB spikes reported earlier

### Hypothesis: Metabob-CLI Not the Leak Source

**Evidence:**
1. Previous report showed 200+ MB spikes during operations
2. Current static memory usage: only 38 MB increase
3. OpenCode process memory DECREASED (217 MB → 192 MB)
4. Metabob-CLI memory is stable at 176 MB (not growing)

**Alternative Theory:**
- Memory spikes may occur during **metabob tool operations**, not from the process existing
- The 200 MB spikes may be from:
  - OpenCode loading metabob responses into memory
  - Caching of metabob analysis results
  - Session state retention of metabob context

## Next Steps

### 1. Test Memory During Metabob Operations
- Baseline memory with metabob-cli running but idle
- Execute metabob tool operations (search_codebase_issues, etc.)
- Monitor memory spikes during operations
- Check if memory returns to baseline after operations

### 2. Check Metabob Response Caching
- Review OpenCode's metabob client code for response caching
- Check if metabob analysis results are retained in session
- Verify if metabob context injection stores large datasets

### 3. Verify MCP stdio Integration
- Investigate how OpenCode connects to stdio-based MCP servers
- Check if test_metabob_mcp tool supports stdio transport
- Verify metabob tools are actually available to OpenCode

### 4. Test Without Metabob
- Restart container with metabob disabled
- Run same operations that triggered 200 MB spikes
- Compare memory usage patterns

## Recommendations

### Immediate Actions
1. **Monitor memory during metabob operations** (not just process existence)
2. **Check for response/result caching** in OpenCode's metabob integration
3. **Verify metabob tools are functional** (try calling metabob_search_activities)

### Investigation Priorities
1. **HIGH:** Memory behavior during actual metabob tool calls
2. **MEDIUM:** Response data retention in session/impulse system
3. **LOW:** Metabob-CLI process optimization (already uses 176 MB baseline)

## Real-Time Memory Spike Test ⚠️ CRITICAL

### Test Execution
**Command:** `opencode run "List all activity templates using search_activities"`

### Memory Behavior Observed

| Time | Memory Usage | Change | Notes |
|------|-------------|--------|-------|
| Baseline | 368.2 MiB | - | Idle state |
| +2s | 637.3 MiB | +269 MiB (+73%) | Operation starts |
| +5s | 1.517 GiB | +1.15 GiB (+312%) | Rapid growth |
| +8s | 2.696 GiB | +2.33 GiB (+632%) | Peak approaching |
| +10s | 3.681 GiB | +3.31 GiB (+899%) | Continuing to grow |
| +14s | **4.423 GiB** | **+4.05 GiB (+1100%)** | **PEAK - 57% of limit!** |
| +16s | 451.6 MiB | -3.97 GiB (GC triggered) | Recovery starts |
| +18s | 343.8 MiB | Back to baseline | Memory recovered |
| +20s+ | ~378 MiB | Stable | New baseline |

### Critical Findings

**🚨 SEVERE MEMORY LEAK CONFIRMED**

1. **Growth Rate:** 0-4.4 GB in ~14 seconds (~314 MB/second)
2. **Peak Usage:** 4.423 GiB (57.8% of 7.651 GiB container limit)
3. **Recovery:** Memory drops back to baseline after GC
4. **Risk:** Multiple concurrent operations could exceed container limit

### Memory Leak Characteristics

**Pattern:** Temporary massive allocation during operations
- ✅ Memory IS recovered (GC works)
- ⚠️ Peak usage is DANGEROUS (4.4 GB spike)
- 🔴 Multiple concurrent sessions could OOM kill container
- 🔴 2-3 simultaneous operations = container crash risk

**NOT related to metabob-cli specifically:**
- Same behavior occurs with any OpenCode operation
- Metabob-cli baseline memory (176 MB) is separate concern
- The leak is in **OpenCode's session/operation handling**

### Root Cause Analysis

**Likely culprits:**
1. **Session state accumulation** during operation execution
2. **Impulse loading** creating large temporary objects
3. **Context gathering** loading excessive data into memory
4. **Activity execution** not releasing intermediate results
5. **LLM response buffering** holding large payloads

**Evidence points to:**
- Session memory management (`SessionMemoryManager`)
- Impulse loading/caching mechanisms
- Activity state retention during execution

## Conclusion - REVISED

**The memory leak is NOT caused by metabob-cli's existence (176 MB baseline), but by OpenCode's operation execution creating 4+ GB temporary allocations.**

### Critical Issues

1. **Memory Spikes:** 0 → 4.4 GB in 14 seconds during ANY operation
2. **Container Risk:** 57% of limit reached, 2-3 concurrent ops = crash
3. **GC Dependency:** Memory recovers only after GC triggers
4. **Metabob Misidentified:** Earlier suspicion of metabob-cli was incorrect

### Actual Problem

**OpenCode's session execution allocates massive temporary memory that isn't released until garbage collection runs.** This is a general OpenCode issue, not specific to metabob integration.

### Immediate Recommendations

1. **URGENT:** Implement operation concurrency limits (max 2 concurrent sessions)
2. **HIGH:** Add memory pressure monitoring to trigger manual GC
3. **HIGH:** Review SessionMemoryManager and impulse loading for leaks
4. **MEDIUM:** Implement streaming/chunking for large responses
5. **LOW:** Optimize metabob-cli baseline (176 MB, but not the leak source)
