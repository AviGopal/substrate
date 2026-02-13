# Metabob-CLI Benchmark Visual Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    METABOB-CLI PERFORMANCE BENCHMARKS                        │
│                                                                              │
│  5 Core Criteria → Comprehensive Test Coverage → Clear Performance Targets  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 1️⃣  TIME TO START UP                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📋 Test: repos/metabob-cli/tests/test_startup_timing.mjs                   │
│                                                                              │
│  ┌────────┐    ┌──────────────┐    ┌───────────┐                           │
│  │ Spawn  │ →  │ Initialize() │ →  │listTools()│  = Startup Complete       │
│  │ Server │    │   (MCP)      │    │           │                           │
│  └────────┘    └──────────────┘    └───────────┘                           │
│       ↓              ↓                    ↓                                  │
│   Start Time     Connect Time        Tool Response                          │
│                                                                              │
│  🎯 Target: < 10 seconds (OpenCode timeout)                                 │
│  📊 Typical: 1-2s initialize + <1s listTools = 2-3s total                   │
│                                                                              │
│  💻 Run: node repos/metabob-cli/tests/test_startup_timing.mjs               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 2️⃣  TIME TO FIRST TOOL RESPONSE                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📋 Test: repos/metabob-cli/tests/performance/test_mcp_performance_specs.py │
│                                                                              │
│  ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌────────┐                │
│  │ MCP Ready│ → │ Load State │ → │  Process │ → │ Return │                 │
│  └──────────┘   └────────────┘   └──────────┘   └────────┘                 │
│                       ↓                 ↓                                    │
│                 Get Results       Filter Issues                             │
│                 (100 files)       (1,000 issues)                            │
│                                                                              │
│  🎯 Target: < 3 seconds (medium codebase)                                   │
│  📊 Breakdown:                                                               │
│      - State load: ~1s                                                       │
│      - Process issues: ~1s                                                   │
│      - Filter/rank: <1s                                                      │
│                                                                              │
│  💻 Run: pytest test_mcp_performance_specs.py::                             │
│          test_handles_medium_codebase_efficiently                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 3️⃣  TIME TO FULL TRAVERSE CODEBASE                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📋 Tests:                                                                   │
│    • test_large_codebase_simulation.mjs (MCP deferred model)                │
│    • test_benchmarks.py (CPG cold start)                                    │
│                                                                              │
│  ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌────────────┐               │
│  │ Discover │ → │  Parse   │ → │ Extract │ → │   Index    │               │
│  │  Files   │   │  (AST)   │   │   CPG   │   │  Storage   │               │
│  └──────────┘   └──────────┘   └─────────┘   └────────────┘               │
│       ↓              ↓              ↓              ↓                         │
│   File Walker    Tree-sitter    Components      Database                   │
│                                                                              │
│  🎯 Scaling Targets:                                                         │
│                                                                              │
│  ┌─────────────┬─────────────┬──────────────┬──────────────┐               │
│  │ Files       │ Time        │ Throughput   │ Test         │               │
│  ├─────────────┼─────────────┼──────────────┼──────────────┤               │
│  │ 50          │ < 15s       │ 3-5 f/s      │ cold_small   │               │
│  │ 500         │ < 120s      │ 4-10 f/s     │ cold_medium  │               │
│  │ 5,000       │ < 900s      │ 5-10 f/s     │ cold_large   │               │
│  └─────────────┴─────────────┴──────────────┴──────────────┘               │
│                                                                              │
│  💡 MCP Model: Session creation deferred → listTools() fast even with       │
│     large codebases. Full analysis continues in background.                 │
│                                                                              │
│  💻 Run: pytest repos/cpg-inference/tests/test_benchmarks.py                │
│          -m benchmark -k "cold_start"                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 4️⃣  TIME TO COMPUTE COCHANGE EMBEDDINGS                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📋 Test: repos/cpg-inference/tests/test_benchmarks.py                      │
│                                                                              │
│  ┌────────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐            │
│  │  Extract   │ → │  Generate │ → │   Build   │ → │  Query   │            │
│  │ Components │   │ Features  │   │FAISS Index│   │Cochanges │            │
│  └────────────┘   └───────────┘   └───────────┘   └──────────┘            │
│        ↓               ↓                ↓               ↓                    │
│    CPG Parse      Embeddings        Vector DB      k-NN Search             │
│                                                                              │
│  🎯 Performance Targets:                                                     │
│                                                                              │
│  ┌──────────────────────────┬────────────┬─────────────────┐               │
│  │ Operation                │ Target     │ Test            │               │
│  ├──────────────────────────┼────────────┼─────────────────┤               │
│  │ Feature generation       │ < 5s       │ feature_gen     │               │
│  │ FAISS index build        │ < 5s       │ faiss_indexing  │               │
│  │ Query (avg)              │ < 200ms    │ cochange_pred   │               │
│  │ Query (p95)              │ < 300ms    │ cochange_pred   │               │
│  └──────────────────────────┴────────────┴─────────────────┘               │
│                                                                              │
│  📊 Pipeline Breakdown:                                                      │
│      1. CPG Parsing: ~1-2s/file (tree-sitter)                               │
│      2. Feature Gen: ~100-200ms/component                                   │
│      3. FAISS Add: ~10-50ms/batch                                           │
│      4. Query: ~50-150ms (cached: <50ms)                                    │
│                                                                              │
│  💻 Run: pytest repos/cpg-inference/tests/test_benchmarks.py                │
│          ::test_benchmark_cochange_prediction                               │
│          ::test_benchmark_faiss_indexing                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 5️⃣  TIME TO UPDATE STATE                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📋 Tests: test_mcp_performance_specs.py, test_benchmarks.py                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                  STATE UPDATE OPERATIONS                        │        │
│  ├─────────────────────────────────────────────────────────────────┤        │
│  │                                                                 │        │
│  │  A. FULL STATE RELOAD (Large Codebase)                         │        │
│  │     ┌───────┐   ┌──────┐   ┌────────┐                         │        │
│  │     │ Read  │ → │ Parse│ → │ Index  │                         │        │
│  │     │ File  │   │ JSON │   │ Memory │                         │        │
│  │     └───────┘   └──────┘   └────────┘                         │        │
│  │     Target: < 2s (10,000 issues)                               │        │
│  │                                                                 │        │
│  │  B. INCREMENTAL UPDATE (Single File)                           │        │
│  │     ┌───────┐   ┌──────┐   ┌────────┐   ┌──────┐             │        │
│  │     │ Parse │ → │ Diff │ → │ Update │ → │ Write│             │        │
│  │     │  CPG  │   │ State│   │  Index │   │ File │             │        │
│  │     └───────┘   └──────┘   └────────┘   └──────┘             │        │
│  │     Target: < 500ms (1 file)                                  │        │
│  │                                                                 │        │
│  │  C. BATCH UPDATE (10 Files)                                    │        │
│  │     ┌────────────────┐   ┌────────────────┐                   │        │
│  │     │ Parallel Parse │ → │ Atomic Commit  │                   │        │
│  │     └────────────────┘   └────────────────┘                   │        │
│  │     Target: < 2s (10 files)                                    │        │
│  │                                                                 │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  🎯 Detailed Targets:                                                        │
│                                                                              │
│  ┌────────────────────────────┬───────────┬──────────────────┐             │
│  │ Operation                  │ Target    │ Test             │             │
│  ├────────────────────────────┼───────────┼──────────────────┤             │
│  │ State reload (10K issues)  │ < 2s avg  │ state_reload     │             │
│  │ Timestamp parse (10K)      │ < 500ms   │ timestamp_parse  │             │
│  │ Issue iteration (50K)      │ < 1s      │ issue_iteration  │             │
│  │ Single file update         │ < 500ms   │ incremental_1    │             │
│  │ Batch update (10 files)    │ < 2s      │ incremental_10   │             │
│  │ File deletion (5 files)    │ < 500ms   │ file_deletion    │             │
│  └────────────────────────────┴───────────┴──────────────────┘             │
│                                                                              │
│  💻 Run: pytest repos/metabob-cli/tests/performance/                        │
│          test_mcp_performance_specs.py -k "reload or timestamp or iteration"│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 PERFORMANCE SUMMARY DASHBOARD                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │                     CRITICAL PATH                           │            │
│  ├─────────────────────────────────────────────────────────────┤            │
│  │                                                             │            │
│  │  User Action:  opencode start                              │            │
│  │       ↓                                                     │            │
│  │  [1] MCP Spawn & Initialize           1-2s   ✓            │            │
│  │       ↓                                                     │            │
│  │  [2] ListTools (with deferred init)   <1s    ✓            │            │
│  │       ↓                                                     │            │
│  │  [3] First Tool Call (get_priority)   2-3s   ✓            │            │
│  │       ↓                                                     │            │
│  │  Total Time to Interactive:          ~3-6s   ✓            │            │
│  │                                                             │            │
│  │  Background: Full Traversal          30s-15m  (async)     │            │
│  │             Cochange Indexing         5-120s  (async)     │            │
│  │                                                             │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────┐              │
│  │              PERFORMANCE BY CODEBASE SIZE                 │              │
│  ├───────────────────────────────────────────────────────────┤              │
│  │                                                           │              │
│  │  Small (50 files):                                       │              │
│  │    • Cold start:    15s                                  │              │
│  │    • MCP ready:     2-3s   ← User sees this             │              │
│  │    • Cochange idx:  5s                                   │              │
│  │                                                           │              │
│  │  Medium (500 files):                                     │              │
│  │    • Cold start:    120s (2 min)                         │              │
│  │    • MCP ready:     3-5s   ← User sees this             │              │
│  │    • Cochange idx:  30s                                  │              │
│  │                                                           │              │
│  │  Large (5,000 files):                                    │              │
│  │    • Cold start:    900s (15 min)                        │              │
│  │    • MCP ready:     5-10s  ← User sees this             │              │
│  │    • Cochange idx:  120s (2 min)                         │              │
│  │                                                           │              │
│  └───────────────────────────────────────────────────────────┘              │
│                                                                              │
│  💡 Key Insight: Deferred initialization keeps user-facing latency low      │
│     even for large codebases. Heavy operations run in background.           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🎯 QUICK TEST COMMANDS                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  # Run all 5 core benchmarks (2-3 minutes)                                  │
│  ./run_benchmarks.sh                                                         │
│                                                                              │
│  # Or individually:                                                          │
│                                                                              │
│  # [1] Startup                                                               │
│  node repos/metabob-cli/tests/test_startup_timing.mjs                       │
│                                                                              │
│  # [2] First Tool                                                            │
│  pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py \│
│    ::test_handles_medium_codebase_efficiently -v                            │
│                                                                              │
│  # [3] Traversal                                                             │
│  pytest repos/cpg-inference/tests/test_benchmarks.py \                     │
│    -m benchmark -k "cold_start" -v                                          │
│                                                                              │
│  # [4] Cochange                                                              │
│  pytest repos/cpg-inference/tests/test_benchmarks.py \                     │
│    ::test_benchmark_cochange_prediction -v                                  │
│                                                                              │
│  # [5] State                                                                 │
│  pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py \│
│    -k "reload" -v                                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📈 INTERPRETING RESULTS                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ EXCELLENT:  All tests pass, performance < 80% of target                 │
│  ✓  GOOD:       All tests pass, performance < 100% of target                │
│  ⚠️  WARNING:    Tests pass but close to threshold (>90%)                    │
│  ❌ FAILURE:    Test assertions fail, performance exceeds target             │
│                                                                              │
│  Example:                                                                    │
│    • Startup: 2.1s / 10s target = 21% = ✅ EXCELLENT                        │
│    • Reload:  9.5s / 10s target = 95% = ⚠️  WARNING (investigate)          │
│    • Query:   250ms / 200ms     = 125% = ❌ FAILURE (needs optimization)    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📚 DOCUMENTATION INDEX                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. METABOB_CLI_BENCHMARK_MAPPING.md     ← Comprehensive mapping            │
│  2. BENCHMARK_QUICK_REFERENCE.md         ← Quick commands & targets         │
│  3. BENCHMARK_VISUAL_MAP.md (this file)  ← Visual overview                  │
│                                                                              │
│  Test files:                                                                 │
│    • repos/metabob-cli/tests/test_startup_timing.mjs                        │
│    • repos/metabob-cli/tests/test_large_codebase_simulation.mjs             │
│    • repos/metabob-cli/tests/performance/test_mcp_performance_specs.py      │
│    • repos/metabob-cli/tests/performance/test_cpg_performance.py            │
│    • repos/cpg-inference/tests/test_benchmarks.py                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```
