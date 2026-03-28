# Metabob-CLI Performance Benchmarks

This directory contains comprehensive documentation on how metabob-cli tests map to performance benchmark criteria.

## 📋 Documentation Overview

### For Quick Start
- **[BENCHMARK_QUICK_REFERENCE.md](BENCHMARK_QUICK_REFERENCE.md)** - Commands, targets, and quick examples
- **[run_benchmarks.sh](run_benchmarks.sh)** - Automated benchmark runner script

### For Visual Understanding
- **[BENCHMARK_VISUAL_MAP.md](BENCHMARK_VISUAL_MAP.md)** - ASCII diagrams and visual flowcharts

### For Detailed Analysis
- **[METABOB_CLI_BENCHMARK_MAPPING.md](METABOB_CLI_BENCHMARK_MAPPING.md)** - Complete test-to-criteria mapping
- **[BENCHMARK_ANALYSIS_SUMMARY.md](BENCHMARK_ANALYSIS_SUMMARY.md)** - Executive summary and insights

---

## 🚀 Quick Start

### Run All Benchmarks (3-5 minutes)
```bash
./run_benchmarks.sh
```

### Run Individual Benchmark
```bash
# Startup timing
node repos/metabob-cli/tests/test_startup_timing.mjs

# State performance
pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py -v

# CPG & cochange
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v
```

---

## 📊 5 Core Benchmark Criteria

| # | Criterion | Test File | Target | Quick Test |
|---|-----------|-----------|--------|------------|
| 1 | **Startup Time** | `test_startup_timing.mjs` | < 10s | ✅ 30 sec |
| 2 | **First Tool Response** | `test_mcp_performance_specs.py` | < 3s | ✅ 10 sec |
| 3 | **Codebase Traversal** | `test_benchmarks.py` | 15s-15m | ⏱️ 2 min |
| 4 | **Cochange Embeddings** | `test_benchmarks.py` | < 200ms | ✅ 30 sec |
| 5 | **State Updates** | `test_mcp_performance_specs.py` | < 2s | ✅ 1 min |

**Total Coverage**: ✅ 23+ dedicated performance tests

---

## 📁 Test File Locations

```
repos/metabob-cli/tests/
├── test_startup_timing.mjs              # Node.js: MCP spawn & initialize
├── test_large_codebase_simulation.mjs   # Node.js: Scaling test (500 files)
└── performance/
    ├── test_mcp_performance_specs.py    # State management benchmarks
    ├── test_cpg_performance.py          # CPG query performance
    └── test_priority_issues_performance_fixes.py

repos/cpg-inference/tests/
└── test_benchmarks.py                   # Cold start, cochange, FAISS
```

---

## 🎯 Performance Targets at a Glance

### User-Facing (Critical)
- **Time to Interactive**: < 10s (typical: 2-6s)
- **Query Response**: < 200ms (typical: 50-150ms)
- **State Reload**: < 2s (typical: 1-1.5s)

### Background Operations
- **50 files**: < 15s
- **500 files**: < 120s (2 min)
- **5,000 files**: < 900s (15 min)

---

## 📖 Which Document Should I Read?

### "I want to run the benchmarks now"
→ **[BENCHMARK_QUICK_REFERENCE.md](BENCHMARK_QUICK_REFERENCE.md)**
- Copy-paste commands
- Expected output examples
- Troubleshooting tips

### "I want to understand the system visually"
→ **[BENCHMARK_VISUAL_MAP.md](BENCHMARK_VISUAL_MAP.md)**
- ASCII flowcharts
- Performance dashboards
- Visual architecture

### "I need detailed test-to-criteria mapping"
→ **[METABOB_CLI_BENCHMARK_MAPPING.md](METABOB_CLI_BENCHMARK_MAPPING.md)**
- Line-by-line test analysis
- Code snippets
- Complete coverage documentation

### "I need an executive summary"
→ **[BENCHMARK_ANALYSIS_SUMMARY.md](BENCHMARK_ANALYSIS_SUMMARY.md)**
- Key findings
- Recommendations
- Architecture insights

---

## 🔧 Setup Requirements

### Node.js Tests
```bash
node --version  # v16+ recommended
# No additional dependencies needed
```

### Python Tests
```bash
python --version  # 3.8+ required

# Install packages
pip install -e repos/metabob-cli
pip install -e repos/cpg-inference

# Install test dependencies
pip install pytest pytest-asyncio pytest-json-report
```

### Optional
```bash
# For memory tests
pip install psutil

# For Redis storage benchmarks
pip install redis
```

---

## 📈 Interpreting Results

### ✅ Pass Criteria
- All assertions pass
- Performance < target threshold
- No timeouts or exceptions

**Example Output**:
```
✓ Initialize completed in 1234ms
✓ ListTools responded in 567ms
✅ SUCCESS: Server responds before OpenCode timeout!
```

### ❌ Failure Indicators
- Assertion failures
- Timeouts
- Performance exceeds target

**Example Output**:
```
AssertionError: avg_duration < 0.2, got 0.254s
❌ FAILURE: Query too slow
```

---

## 🔍 Common Use Cases

### 1. Before Committing Code
```bash
# Quick smoke test (1-2 minutes)
node repos/metabob-cli/tests/test_startup_timing.mjs
pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_handles_medium_codebase_efficiently -v
```

### 2. After Optimization
```bash
# Full benchmark suite
./run_benchmarks.sh

# Compare with baseline
diff baseline_results.txt current_results.txt
```

### 3. CI/CD Integration
```bash
# Fast PR check (~1 minute)
node repos/metabob-cli/tests/test_startup_timing.mjs

# Nightly full suite (~15 minutes)
./run_benchmarks.sh
pytest repos/metabob-cli/tests/performance/ -v
pytest repos/cpg-inference/tests/test_benchmarks.py -m benchmark -v
```

### 4. Performance Investigation
```bash
# Run with detailed output
pytest repos/metabob-cli/tests/performance/ -v -s --tb=short

# Profile specific test
pytest repos/metabob-cli/tests/performance/test_cpg_performance.py::test_cpg_impact_score_performance -v --profile
```

---

## 🎓 Understanding the Test Architecture

### MCP Server Tests (Node.js)
**Why Node.js?** These tests simulate how OpenCode (the actual client) interacts with metabob-cli MCP server. They spawn the real server process and measure actual connection timing.

**What they measure**: Real-world startup latency, tool availability, and first response time.

### State Management Tests (Python)
**What they measure**: FileStateManager performance with real I/O, including reload, persistence, and query operations.

**Why important**: State operations are on the critical path for tool responses.

### CPG & Cochange Tests (Python)
**What they measure**: Complete pipeline from code parsing → AST extraction → feature generation → embedding computation → FAISS indexing → query execution.

**Why important**: These operations determine background analysis speed and cochange prediction accuracy.

---

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'metabob_cli'"
```bash
# Install packages in development mode
cd repos/metabob-cli && pip install -e .
cd repos/cpg-inference && pip install -e .
```

### "Node test fails: 'metabob-cli' not found"
```bash
# Add to PATH or use absolute path
export PATH="$PATH:/path/to/metabob-cli/bin"

# Or modify test to use absolute path
```

### "Tests timeout"
```bash
# Check if services are running
docker ps  # If using Docker

# Clear stale state
rm -rf .metabob .test-*

# Increase timeout (for slow systems)
pytest --timeout=300 ...
```

### "Performance degraded compared to baseline"
```bash
# Clear caches
rm -rf .metabob .pytest_cache __pycache__

# Check system resources
top
htop

# Run with profiling
pytest --profile-svg ...
```

---

## 📦 Test Organization

### By Category
- **Startup**: MCP server initialization and tool availability
- **Responsiveness**: First tool call and user-facing latency
- **Throughput**: Codebase traversal and batch processing
- **Accuracy**: Cochange prediction quality (separate from performance)
- **Persistence**: State management and incremental updates

### By Language
- **Node.js** (2 tests): MCP protocol and server spawning
- **Python** (20+ tests): Core engine, state, CPG, and cochange performance

### By Duration
- **Fast** (<10s): Startup, single operations
- **Medium** (10-60s): State tests, small codebases
- **Slow** (>60s): Large codebases, full pipeline

---

## 🌟 Key Insights

1. **Deferred initialization keeps UI responsive**: MCP server uses deferred initialization pattern - listTools() responds in ~1s even with 5,000 file codebases.

2. **Linear scaling**: Performance scales linearly with codebase size (~5-10 files/sec throughput).

3. **State operations are optimized**: 10,000 issues reload in <2s consistently.

4. **Queries benefit from caching**: CPG queries are 100-200ms cold, 10-50ms warm.

5. **Incremental updates are fast**: Single file updates complete in <500ms.

---

## 📚 Additional Resources

### In This Repository
- Test files: `repos/metabob-cli/tests/` and `repos/cpg-inference/tests/`
- Source code: `repos/metabob-cli/src/` and `repos/cpg-inference/cpg-inference/`
- Configuration: `.metabob-config.json` files in test directories

### External Documentation
- MCP Protocol: Model Context Protocol specification
- Tree-sitter: Code parsing library used by CPG
- FAISS: Vector similarity search (Facebook AI)

---

## 🤝 Contributing

### Adding New Benchmarks
1. Follow existing test patterns (see `test_benchmarks.py`)
2. Use explicit performance targets (`assert elapsed < target`)
3. Document what you're measuring
4. Add to appropriate test category
5. Update this documentation

### Improving Existing Tests
1. Make sure tests remain deterministic
2. Preserve existing performance targets
3. Update documentation if behavior changes
4. Consider backward compatibility

---

## 📞 Support

### Questions About Tests
- Review test files in `repos/metabob-cli/tests/`
- Read inline comments and docstrings
- Check `METABOB_CLI_BENCHMARK_MAPPING.md` for detailed analysis

### Questions About Performance
- Review `BENCHMARK_ANALYSIS_SUMMARY.md` for insights
- Check if issue is already documented
- Profile with `pytest --profile` to identify bottlenecks

### Questions About Setup
- Review `BENCHMARK_QUICK_REFERENCE.md` troubleshooting section
- Check Python/Node.js versions
- Verify all dependencies are installed

---

## 📝 Summary

**What You Get**:
- ✅ Complete test-to-benchmark mapping for all 5 criteria
- ✅ Automated runner script for quick execution
- ✅ Clear performance targets and pass/fail criteria
- ✅ Comprehensive documentation at multiple detail levels
- ✅ 23+ existing tests ready to use as benchmarks

**What You Don't Need**:
- ❌ Create new benchmark infrastructure
- ❌ Figure out what to measure
- ❌ Guess at performance targets
- ❌ Build custom test runners

**Start Here**: Run `./run_benchmarks.sh` and review the results!

---

## 📄 License

See parent repository license.

---

**Last Updated**: February 12, 2026  
**Version**: 1.0  
**Status**: Complete ✅
