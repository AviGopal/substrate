# Metabob-CLI Benchmark Quick Reference

## Run All Benchmarks

```bash
# 1. MCP Startup (Node.js)
node repos/metabob-cli/tests/test_startup_timing.mjs
node repos/metabob-cli/tests/test_large_codebase_simulation.mjs

# 2. Python Performance Tests
pytest repos/metabob-cli/tests/performance/ -v
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v
```

---

## Benchmark Criteria → Test Mapping

| # | Criterion | Primary Test File | Target | Run Command |
|---|-----------|-------------------|--------|-------------|
| 1 | **Startup Time** | `test_startup_timing.mjs` | < 10s | `node repos/metabob-cli/tests/test_startup_timing.mjs` |
| 2 | **First Tool Response** | `test_mcp_performance_specs.py` | < 3s | `pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_handles_medium_codebase_efficiently` |
| 3 | **Codebase Traversal** | `test_benchmarks.py` | See table | `pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -k "cold_start"` |
| 4 | **Cochange Embeddings** | `test_benchmarks.py` | < 200ms query | `pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cochange_prediction` |
| 5 | **State Updates** | `test_mcp_performance_specs.py` | < 2s reload | `pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py -k "reload"` |

---

## Performance Targets

### Startup & Responsiveness
- MCP initialize + listTools: **< 10 seconds**
- First tool response (medium codebase): **< 3 seconds**
- State reload (10K issues): **< 2 seconds average**

### Codebase Traversal (Cold Start)
| Files | Target Time | Throughput |
|-------|-------------|------------|
| 50    | < 15s       | 3-5 files/sec |
| 500   | < 120s      | 4-10 files/sec |
| 5,000 | < 900s      | 5-10 files/sec |

### Cochange Embeddings
- Feature generation: **< 5 seconds**
- FAISS indexing: **< 5 seconds**
- Query latency: **< 200ms average**

### State Updates
| Operation | Target |
|-----------|--------|
| State reload (10K issues) | < 2s |
| Single file update | < 500ms |
| Batch update (10 files) | < 2s |
| Timestamp parsing (10K) | < 500ms |
| Issue iteration (50K) | < 1s |

### CPG Operations
- Impact score: **< 50ms**
- Change impact analysis: **< 100ms**
- Co-change prediction: **< 100ms**

---

## Test Files Location

```
repos/metabob-cli/tests/
├── test_startup_timing.mjs                    # ✅ Criterion 1: Startup
├── test_large_codebase_simulation.mjs         # ✅ Criterion 3: Scaling
└── performance/
    ├── test_mcp_performance_specs.py          # ✅ Criterion 2 & 5
    ├── test_cpg_performance.py                # CPG queries
    └── test_priority_issues_performance_fixes.py

repos/cpg-inference/tests/
└── test_benchmarks.py                         # ✅ Criterion 3 & 4
```

---

## Quick Test Examples

### 1. Startup Benchmark
```bash
$ node repos/metabob-cli/tests/test_startup_timing.mjs

======================================================================
MCP SERVER STARTUP TIMING VALIDATION
======================================================================
Scenario: OpenCode spawns MCP server and calls listTools()
Connect timeout: 10000ms
ListTools timeout: 10000ms

✓ Initialize completed in 1234ms
✓ ListTools responded in 567ms
✅ SUCCESS: Server responds before OpenCode timeout!
```

### 2. Codebase Traversal
```bash
$ pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cold_start_medium -v

============================================================
COLD START - MEDIUM (500 files)
============================================================
Duration: 45.23s
Files processed: 500
Throughput: 11.1 files/sec
============================================================
PASSED
```

### 3. Cochange Query
```bash
$ pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cochange_prediction -v

============================================================
CO-CHANGE PREDICTION QUERIES
============================================================
Avg latency: 85.3ms
P95 latency: 124.7ms
Queries: 10
============================================================
PASSED
```

### 4. State Update
```bash
$ pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_state_reload_completes_quickly -v

Populating state with 500 files, 10,000 issues...
State file size: 5.23 MB
Measuring state reload performance...
  Reload 1: 1.234s
  Reload 2: 1.189s
  Reload 3: 1.256s
  Reload 4: 1.201s
  Reload 5: 1.223s
✓ State reload (5.23 MB, 10,000 issues): avg=1.221s, max=1.256s
PASSED
```

---

## Interpreting Results

### ✅ PASS Criteria
- All assertions pass
- Performance within target thresholds
- No timeouts or exceptions

### ⚠️ WARNING Signs
- Performance close to threshold (e.g., 9.5s vs. 10s target)
- High variability between runs
- Memory growth during test

### ❌ FAILURE Modes
- Timeout exceeded
- Assertion failure (`assert elapsed < target`)
- Exception during benchmark
- Memory leak detected

---

## Environment Requirements

### Node.js Tests
```bash
node --version  # v16+ recommended
npm install     # If dependencies needed
```

### Python Tests
```bash
python --version  # 3.8+ required
pip install pytest pytest-asyncio pytest-json-report
pip install -e repos/metabob-cli
pip install -e repos/cpg-inference
```

### Optional Dependencies
```bash
# For memory tests
pip install psutil

# For Redis storage benchmarks
pip install redis
```

---

## CI/CD Integration

### Minimal CI Check (Fast)
```bash
# Run only critical benchmarks (~30s total)
node repos/metabob-cli/tests/test_startup_timing.mjs
pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_handles_medium_codebase_efficiently -v
```

### Full Benchmark Suite (Slow)
```bash
# Complete benchmark coverage (~10-15 minutes)
node repos/metabob-cli/tests/test_startup_timing.mjs
node repos/metabob-cli/tests/test_large_codebase_simulation.mjs
pytest repos/metabob-cli/tests/performance/ -v
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v
```

### Generate Report
```bash
# JSON report for tracking over time
pytest repos/metabob-cli/tests/performance/ --json-report --json-report-file=perf-report.json
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark --json-report --json-report-file=cpg-perf-report.json
```

---

## Troubleshooting

### Tests Fail with "ModuleNotFoundError"
```bash
# Install packages in editable mode
pip install -e repos/metabob-cli
pip install -e repos/cpg-inference
```

### Node Tests Fail to Spawn Server
```bash
# Ensure metabob-cli is in PATH
which metabob-cli
# Or use absolute path in test
```

### Tests Timeout
- Check if backend services are running (Redis, etc.)
- Increase timeout values for slow systems
- Check for blocking I/O or deadlocks

### Performance Degradation
- Clear state files: `rm -rf .metabob .test-*`
- Check system resources: `top`, `htop`
- Run with profiling: `pytest --profile`

---

## Next Steps

1. **Run baseline benchmarks** on your system
2. **Compare results** to targets in this document
3. **Identify bottlenecks** if tests fail
4. **Optimize** based on test feedback
5. **Re-run** to verify improvements

For detailed analysis, see: `METABOB_CLI_BENCHMARK_MAPPING.md`
