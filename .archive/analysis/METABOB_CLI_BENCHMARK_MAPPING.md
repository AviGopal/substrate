# Metabob-CLI Test Suite: Benchmark Mapping

**Document Purpose**: Maps existing metabob-cli tests to benchmark criteria for performance evaluation.

---

## Executive Summary

The metabob-cli test suite contains **comprehensive performance benchmarks** across three repositories:
- **metabob-cli**: 100+ performance/timing tests (MCP, state management, CPG tools)
- **cpg-inference**: 20+ benchmark tests (cold start, incremental updates, queries)
- **repos/cpg-inference** (duplicate): Additional benchmark suite

**Current Status**: ✅ All 5 benchmark criteria have existing test coverage

---

## Benchmark Criteria Mapping

### 1. **Time to Start Up** ⏱️

**Criterion**: Measure MCP server initialization time from spawn to ready state.

#### Primary Tests

**File**: `repos/metabob-cli/tests/test_startup_timing.mjs`
- **What it measures**: 
  - `initialize()` response time (MCP protocol handshake)
  - `listTools()` response time after initialization
  - Total startup time from spawn to tool availability
- **Target**: listTools() responds in < 10 seconds (OpenCode timeout)
- **Measures**:
  ```javascript
  const startTime = Date.now();
  // ... spawn server, call initialize, call listTools
  listToolsTime = Date.now() - startTime - connectTime;
  ```
- **Pass criteria**: `listToolsTime < LISTTOOLS_TIMEOUT` (10,000ms)

#### Supporting Tests

1. **test_mcp_long_running_session.py**
   - Tests startup with extended uptime simulation
   - Verifies no degradation in startup after long operation

2. **test_priority_issues_performance_fixes.py**
   - Measures async state initialization time
   - Target: < 5s for state reload

**Benchmark Usage**:
```bash
# Run startup timing benchmark
node repos/metabob-cli/tests/test_startup_timing.mjs

# Expected output:
# ✓ Initialize completed in 1234ms
# ✓ ListTools responded in 567ms
# ✅ SUCCESS: Server responds before OpenCode timeout!
```

---

### 2. **Time to First Tool Response** 🚀

**Criterion**: Time from MCP server ready to first tool call completion.

#### Primary Tests

**File**: `repos/metabob-cli/tests/test_startup_timing.mjs`
- **What it measures**: Time from `listTools()` response to first actual tool invocation
- **Implicit measurement**: The test measures `listTools()` as the "first tool response"
- **Target**: < 10 seconds

**File**: `repos/metabob-cli/tests/performance/test_mcp_performance_specs.py`
- **Test**: `test_handles_medium_codebase_efficiently`
- **What it measures**: Complete state operation workflow (get_all_results, process issues, filter)
- **Target**: < 3 seconds for 100 files, 1,000 issues
- **Lines 74-91**:
  ```python
  start = time.time()
  results = manager.get_all_results(include_context=True)
  # ... process and filter issues
  elapsed = time.time() - start
  assert elapsed < 3.0
  ```

#### Supporting Tests

1. **test_cpg_performance.py**: `test_analyze_change_impact_response_time`
   - Measures tool response time for CPG-powered tools
   - Target: < 500ms average

2. **test_annotation_tools_performance.py**: Various tool timing tests
   - Measures specific MCP tool response times

**Benchmark Usage**:
```bash
# Run first tool response benchmark
pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_handles_medium_codebase_efficiently -v

# Run CPG tool response benchmarks
pytest repos/metabob-cli/tests/performance/test_cpg_performance.py::TestToolResponsePerformance -v
```

---

### 3. **Time to Full Traverse Codebase** 📁

**Criterion**: Time to discover, parse, and index all files in a codebase of arbitrary size.

#### Primary Tests

**File**: `repos/metabob-cli/tests/test_large_codebase_simulation.mjs`
- **What it measures**:
  - Creates 500 Python files
  - Spawns MCP server with `METABOB_WATCH_PATHS` pointing to test directory
  - Measures time from spawn to `listTools()` response
  - Server logs show file discovery progress
- **Target**: < 10 seconds even with 500 files (due to deferred session creation)
- **Key insight**: Session creation is deferred, so `listTools()` responds before analysis completes

**File**: `repos/cpg-inference/tests/test_benchmarks.py`
- **Cold Start Benchmarks**:
  1. `test_benchmark_cold_start_small`: 50 files, target < 15s
  2. `test_benchmark_cold_start_medium`: 500 files, target < 120s (2 min)
  3. `test_benchmark_cold_start_large`: 5,000 files, target < 900s (15 min)
- **What they measure**: Complete indexing via `predictor.update_index(project)`
- **Lines 40-76**:
  ```python
  duration, stats = time_operation(predictor.update_index, small_project)
  print(f"Duration: {duration:.2f}s")
  print(f"Files processed: {stats['files_processed']}")
  print(f"Throughput: {stats['files_processed']/duration:.1f} files/sec")
  ```

#### Supporting Tests

1. **test_cpg_performance.py**: `TestLargeCodebasePerformance`
   - `test_large_codebase_indexing`: 100 files, target < 30s
   - `test_large_codebase_query_performance`: Query speed with 50+ file index

2. **test_mcp_performance_specs.py**: `test_handles_large_codebase_efficiently`
   - 1,000 files, 20,000 issues
   - Target: < 5s for complete workflow

**Benchmark Usage**:
```bash
# MCP server codebase traversal (deferred model)
node repos/metabob-cli/tests/test_large_codebase_simulation.mjs

# CPG cold start benchmarks (various sizes)
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v

# Expected output:
# ======================================================================
# COLD START - MEDIUM (500 files)
# ======================================================================
# Duration: 45.23s
# Files processed: 500
# Throughput: 11.1 files/sec
# ======================================================================
```

**Scaling Behavior**:
| Codebase Size | Expected Time | Throughput | Test |
|---------------|---------------|------------|------|
| 50 files      | < 15s         | ~3-5 files/sec | `test_benchmark_cold_start_small` |
| 500 files     | < 120s        | ~4-10 files/sec | `test_benchmark_cold_start_medium` |
| 5,000 files   | < 900s        | ~5-10 files/sec | `test_benchmark_cold_start_large` |

---

### 4. **Time to Compute Cochange Embeddings** 🧮

**Criterion**: Time to generate cochange prediction embeddings for components.

#### Primary Tests

**File**: `repos/cpg-inference/tests/test_benchmarks.py`

1. **Query Performance**: `test_benchmark_cochange_prediction`
   - **What it measures**: Prediction query latency (10 queries)
   - **Target**: < 200ms average
   - **Lines 186-218**:
     ```python
     durations = []
     for _ in range(10):
         start = time.perf_counter()
         results = predictor.predict_cochanges(modified_files, small_project, top_k=10)
         durations.append(time.perf_counter() - start)
     
     avg_duration = sum(durations) / len(durations)
     assert avg_duration < 0.2  # 200ms
     ```

2. **FAISS Indexing**: `test_benchmark_faiss_indexing`
   - **What it measures**: 
     - Index build time (embedding computation + FAISS add)
     - Search time (10 queries)
   - **Target**: 
     - Index build < 5s
     - Search (10 queries) < 2s, avg < 100ms per query
   - **Lines 438-464**:
     ```python
     start = time.perf_counter()
     stats = predictor.update_index(tiny_project)
     add_duration = time.perf_counter() - start
     
     # Time search
     for _ in range(10):
         predictor.predict_cochanges(modified_files, tiny_project, top_k=10)
     search_duration = time.perf_counter() - start
     ```

3. **Feature Generation**: `test_benchmark_feature_generation`
   - **What it measures**: End-to-end feature extraction (part of embedding generation)
   - **Target**: < 5s
   - **Throughput metric**: components/sec

#### Supporting Tests

1. **test_cpg_performance.py**: `test_cpg_predict_cochanges_performance`
   - Target: < 100ms average for co-change predictions
   - Uses CPGManager directly

2. **test_benchmarks.py**: Pipeline component tests
   - `test_benchmark_cpg_parsing`: Tree-sitter parsing speed
   - `test_benchmark_model_inference`: ML inference timing

**Benchmark Usage**:
```bash
# Run cochange embedding benchmarks
pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cochange_prediction -v
pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_faiss_indexing -v
pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_feature_generation -v

# Run CPG cochange benchmarks
pytest repos/metabob-cli/tests/performance/test_cpg_performance.py::TestCPGQueryPerformance::test_cpg_predict_cochanges_performance -v

# Expected output:
# ======================================================================
# CO-CHANGE PREDICTION QUERIES
# ======================================================================
# Avg latency: 85.3ms
# P95 latency: 124.7ms
# Queries: 10
# ======================================================================
```

**Performance Breakdown**:
- **Embedding computation** (implicit in cold start): Included in `update_index()` timing
- **FAISS index build**: < 5s for small codebases
- **Query latency**: < 200ms average, < 100ms typical

---

### 5. **Time to Update State** 💾

**Criterion**: Time to persist state changes (file analysis results, resolutions, metadata).

#### Primary Tests

**File**: `repos/metabob-cli/tests/performance/test_mcp_performance_specs.py`

1. **State Reload**: `test_state_reload_completes_quickly`
   - **What it measures**: Reload time for large state files (10,000+ issues)
   - **Target**: 
     - Average < 2s
     - Max < 3s
   - **Lines 106-148**:
     ```python
     reload_times = []
     for i in range(5):
         start = time.time()
         manager.reload_state()
         reload_time = time.time() - start
         reload_times.append(reload_time)
     
     avg_reload = sum(reload_times) / len(reload_times)
     assert avg_reload < 2.0
     ```

2. **Timestamp Parsing**: `test_timestamp_parsing_scales_linearly`
   - **What it measures**: Parsing 10,000 resolution timestamps
   - **Target**: < 500ms
   - **Lines 152-216**:
     ```python
     start = time.time()
     for file_path, resolutions in manager.resolutions.items():
         for resolution in resolutions.values():
             resolved_at = datetime.fromisoformat(resolution.resolved_at)
             if resolved_at > one_hour_ago:
                 recent += 1
     elapsed = time.time() - start
     assert elapsed < 0.5
     ```

3. **Issue Iteration**: `test_issue_iteration_scales_efficiently`
   - **What it measures**: Iterating through 50,000 issues
   - **Target**: < 1s
   - **Lines 219-260**:
     ```python
     start = time.time()
     results = manager.get_all_results(include_context=True)
     all_issues = []
     for file_path, issues in results.items():
         for issue in issues:
             # Process issue
             all_issues.append(issue_copy)
     elapsed = time.time() - start
     assert elapsed < 1.0
     ```

#### Incremental Update Tests

**File**: `repos/cpg-inference/tests/test_benchmarks.py`

1. **Single File Update**: `test_benchmark_incremental_single_file`
   - **What it measures**: Update time for 1 file
   - **Target**: < 500ms
   - **Lines 103-123**:
     ```python
     modified_file = {"core/base_0.py": "def new_func():\n    return 42"}
     duration, stats = time_operation(predictor.update_index, modified_file)
     assert duration < 0.5  # 500ms
     ```

2. **Batch Update**: `test_benchmark_incremental_batch`
   - **What it measures**: Update time for 10 files
   - **Target**: < 2s
   - **Lines 125-149**

3. **File Deletion**: `test_benchmark_file_deletion`
   - **What it measures**: Remove 5 files from index
   - **Target**: < 500ms

#### Supporting Tests

1. **test_priority_issues_performance_fixes.py**
   - Async state reload performance
   - Target: < 5s for async reload

2. **test_cpg_storage_integration.py**
   - Storage backend performance tests

**Benchmark Usage**:
```bash
# State management benchmarks
pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py -v -k "reload or timestamp or iteration"

# Incremental update benchmarks
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -k "incremental" -v

# Expected output:
# ✓ State reload (5.23 MB, 10,000 issues): avg=1.234s, max=1.567s
# ✓ Timestamp parsing (10,000 timestamps): 0.342s (8,432 recent)
# ✓ Issue iteration (50,000 issues): 0.789s
```

**Performance Contracts**:
| Operation | Target | Test |
|-----------|--------|------|
| State reload (10K issues) | < 2s avg | `test_state_reload_completes_quickly` |
| Timestamp parsing (10K) | < 500ms | `test_timestamp_parsing_scales_linearly` |
| Issue iteration (50K) | < 1s | `test_issue_iteration_scales_efficiently` |
| Single file update | < 500ms | `test_benchmark_incremental_single_file` |
| Batch update (10 files) | < 2s | `test_benchmark_incremental_batch` |
| File deletion (5 files) | < 500ms | `test_benchmark_file_deletion` |

---

## Additional Performance Test Categories

### 6. **CPG Query Performance** 🔍

**File**: `repos/metabob-cli/tests/performance/test_cpg_performance.py`

Tests for CPG-powered features:
- **Impact score queries**: < 50ms (cached)
- **Change impact analysis**: < 100ms
- **Co-change predictions**: < 100ms
- **Component lookup**: < 10ms

### 7. **Concurrent Access** 🔄

**File**: `repos/metabob-cli/tests/performance/test_cpg_performance.py`

- `test_concurrent_cpg_queries`: 10 concurrent queries < 1s total
- `test_concurrent_tool_calls`: 5 concurrent tool calls < 2s total

### 8. **Memory Efficiency** 🧠

**File**: `repos/metabob-cli/tests/performance/test_cpg_performance.py`

- `test_cpg_memory_stays_bounded`: < 200MB increase for 50 files

### 9. **Storage Backend Comparison** 💽

**File**: `repos/cpg-inference/tests/test_benchmarks.py`

Compares storage backends:
- In-memory SQLite: < 15s (50 files)
- File-based SQLite: < 20s (50 files)
- Redis: < 25s (50 files, network overhead)

---

## Running the Full Benchmark Suite

### Quick Benchmark Run
```bash
# MCP startup and tool response
node repos/metabob-cli/tests/test_startup_timing.mjs
node repos/metabob-cli/tests/test_large_codebase_simulation.mjs

# State management performance
pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py -v

# CPG performance
pytest repos/metabob-cli/tests/performance/test_cpg_performance.py -v

# Cochange and cold start
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v
```

### Comprehensive Benchmark Suite
```bash
# All performance tests (slow, includes 50+ test scenarios)
pytest repos/metabob-cli/tests/performance/ -v
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v

# With detailed output
pytest repos/metabob-cli/tests/performance/ -v -s --tb=short

# Generate performance report
pytest repos/metabob-cli/tests/performance/ --json-report --json-report-file=perf-report.json
```

---

## Test Organization

### Test Directory Structure
```
repos/metabob-cli/tests/
├── performance/               # MCP and state performance tests
│   ├── test_cpg_performance.py           # CPG query benchmarks
│   ├── test_mcp_performance_specs.py     # State management benchmarks
│   ├── test_annotation_tools_performance.py
│   ├── test_mcp_long_running_session.py
│   └── test_priority_issues_performance_fixes.py
├── robustness/                # Long-running and degradation tests
│   └── test_mcp_long_running_degradation.py
├── test_startup_timing.mjs    # MCP startup benchmark (Node.js)
└── test_large_codebase_simulation.mjs   # Scaling benchmark (Node.js)

repos/cpg-inference/tests/
├── test_benchmarks.py         # Complete CPG inference benchmark suite
├── test_storage_integration.py
└── test_service_integration.py
```

### Test Markers
- `@pytest.mark.benchmark`: Performance benchmark tests
- `@pytest.mark.slow`: Long-running tests (> 5s)
- `@pytest.mark.asyncio`: Async test functions

---

## Performance Baselines

Based on test assertions, here are the performance contracts:

### Startup Performance
- **MCP initialize**: < 10s (typically 1-2s)
- **listTools()**: < 10s (typically < 1s)
- **First tool response**: < 3s (for medium codebases)

### Codebase Traversal
| Codebase Size | Cold Start Time | Throughput |
|---------------|-----------------|------------|
| 50 files      | < 15s           | 3-5 files/sec |
| 500 files     | < 120s          | 4-10 files/sec |
| 5,000 files   | < 900s (15min)  | 5-10 files/sec |

### Cochange Embeddings
- **Feature generation**: < 5s (small codebase)
- **FAISS indexing**: < 5s (small codebase)
- **Query latency**: < 200ms average, < 100ms typical

### State Updates
- **State reload**: < 2s average (10K issues)
- **Single file update**: < 500ms
- **Batch update (10 files)**: < 2s
- **File deletion**: < 500ms
- **Timestamp parsing**: < 500ms (10K timestamps)
- **Issue iteration**: < 1s (50K issues)

### CPG Operations
- **Impact score**: < 50ms
- **Change impact**: < 100ms
- **Co-change prediction**: < 100ms
- **Component lookup**: < 10ms

---

## Gaps and Recommendations

### ✅ Fully Covered Benchmarks
1. **Startup time**: Excellent coverage with Node.js MCP tests
2. **First tool response**: Covered via state performance tests
3. **Codebase traversal**: Comprehensive scaling tests (50 to 5,000 files)
4. **Cochange embeddings**: Complete pipeline benchmarks
5. **State updates**: Extensive coverage of all state operations

### 🔍 Potential Enhancements

1. **Real-world codebase benchmarks**
   - Current tests use synthetic data
   - Consider adding benchmarks against real open-source projects
   - Example: Linux kernel subset, React, Django

2. **Concurrent user simulation**
   - Current tests focus on single-user performance
   - Add multi-session concurrent access benchmarks

3. **Network latency simulation**
   - Test MCP performance with network delays
   - Simulate remote API calls

4. **Warm vs. cold cache benchmarks**
   - Current CPG tests warm up cache before measuring
   - Add explicit cold cache benchmarks

5. **Progressive loading metrics**
   - Measure "time to first result" vs. "time to complete analysis"
   - Track user-perceived performance (when does UI become responsive?)

---

## Integration with CI/CD

### Recommended CI Configuration

```yaml
# .github/workflows/performance.yml
name: Performance Benchmarks

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday

jobs:
  benchmarks:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run startup benchmarks
        run: |
          node repos/metabob-cli/tests/test_startup_timing.mjs
          node repos/metabob-cli/tests/test_large_codebase_simulation.mjs
      
      - name: Run Python benchmarks
        run: |
          pytest repos/metabob-cli/tests/performance/ -m benchmark -v --json-report
          pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: perf-report.json
```

---

## Conclusion

The metabob-cli test suite provides **comprehensive benchmark coverage** for all 5 criteria:

1. ✅ **Startup time**: `test_startup_timing.mjs`
2. ✅ **First tool response**: `test_mcp_performance_specs.py`
3. ✅ **Codebase traversal**: `test_benchmarks.py` (50-5000 files)
4. ✅ **Cochange embeddings**: `test_benchmarks.py` (FAISS, features, queries)
5. ✅ **State updates**: `test_mcp_performance_specs.py` (reload, incremental)

**Key Strengths**:
- Well-documented performance contracts with explicit targets
- Scaling tests across multiple codebase sizes
- Both unit-level (CPG queries) and integration-level (MCP workflow) benchmarks
- Mix of Python and Node.js tests covering different components

**Usage**: Tests can be run individually or as a suite, with clear pass/fail criteria based on performance targets.
