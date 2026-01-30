# Mandatory Stress Testing System Documentation

## Overview

The Mandatory Stress Testing System ensures that memory and performance fixes are validated under realistic pressure conditions before they can be committed. This prevents fixes that work in isolated unit tests but fail under production-like stress.

## Key Features

- **🧪 Comprehensive stress scenarios** covering memory, performance, and concurrency
- **📊 Detailed metrics collection** with memory, timing, and resource usage tracking
- **🚨 Mandatory for memory/performance fixes** integrated into quality gates
- **⚙️ Configurable limits and thresholds** for different environments
- **📈 Trend analysis** to detect performance regressions over time
- **🔄 CI/CD integration** for automated validation

## Test Categories

### 1. 🔍 Memory Stress Tests

#### High Memory Pressure Test
- **Purpose**: Validate memory management under high load
- **Scenario**: Load 500 impulses with ~1KB each
- **Validation**: Memory stays within limits, no unbounded growth
- **Pass Criteria**: Peak memory < 200MB, stable memory after operations

#### Memory Limit Compliance Test  
- **Purpose**: Ensure hard memory limits are respected
- **Scenario**: Gradually increase memory usage to approach limit
- **Validation**: Automatic cleanup before exceeding limits
- **Pass Criteria**: Never exceed configured memory limit (default 256MB)

### 2. ⏱️ Performance Stress Tests

#### Performance Regression Test
- **Purpose**: Detect performance degradation with scale
- **Scenario**: Run operations with increasing counts (100, 500, 1000)
- **Validation**: Performance doesn't degrade significantly with scale
- **Pass Criteria**: < 50% performance degradation, < 10ms per operation

#### Long-running Session Test
- **Purpose**: Validate stability over extended periods
- **Scenario**: Continuous operations for 10+ minutes
- **Validation**: Memory remains stable, no performance degradation
- **Pass Criteria**: Stable memory profile, consistent operation timing

### 3. 🔄 Concurrency Stress Tests

#### Concurrent Operations Test
- **Purpose**: Validate thread safety and resource contention
- **Scenario**: 10 concurrent operation streams (1000 operations total)
- **Validation**: No data corruption, no race conditions
- **Pass Criteria**: All operations complete correctly, data integrity maintained

#### Undo/Redo Heavy Usage Test
- **Purpose**: Stress operation history management
- **Scenario**: 1000 undo/redo operations with bounded stacks
- **Validation**: Memory doesn't grow unbounded, operations work correctly
- **Pass Criteria**: < 50MB memory growth, bounded stack sizes

## Stress Test Configuration

### Environment Variables
```bash
# Memory limits
export MEMORY_LIMIT_MB=256          # Maximum memory usage in MB
export CPU_LIMIT_PERCENT=80         # Maximum sustained CPU usage

# Test durations
export LONG_RUNNING_MINUTES=10      # Long-running test duration
export TEST_TIMEOUT=600000          # Test timeout in milliseconds

# Performance thresholds
export MAX_MEMORY_GROWTH_MB=100     # Maximum memory growth during tests
export MAX_PERFORMANCE_DEGRADATION=0.5  # 50% max performance degradation
```

### Test Pass Criteria

#### Memory Criteria
- **No Memory Leaks**: Memory returns to baseline after operations
- **Bounded Growth**: Memory growth stays within configured limits
- **Cleanup Effectiveness**: Garbage collection reduces memory usage
- **Limit Compliance**: Never exceed hard memory limits

#### Performance Criteria
- **Response Time**: Operations complete within reasonable time
- **Throughput**: Operations per second doesn't degrade significantly
- **CPU Usage**: Sustained CPU usage stays below limits
- **Scalability**: Performance doesn't collapse with increased load

#### Stability Criteria
- **No Crashes**: Tests complete without exceptions or crashes
- **Data Integrity**: All operations produce correct results
- **Resource Cleanup**: No resource leaks (files, connections, timers)
- **Consistent Behavior**: Results are reproducible across runs

## Usage Guide

### Command Line Execution
```bash
# Run all stress tests with default configuration
./test/stress-test-memory.sh

# Custom memory limit
MEMORY_LIMIT_MB=512 ./test/stress-test-memory.sh

# Shorter test duration for development
LONG_RUNNING_MINUTES=2 ./test/stress-test-memory.sh

# Strict mode with lower limits
MEMORY_LIMIT_MB=128 CPU_LIMIT_PERCENT=60 ./test/stress-test-memory.sh
```

### Integration with Activity System

#### Quality Gates Integration
```json
{
  "quality_gates": {
    "stress_test_pass": {
      "test_pass_rate": 1.0,
      "description": "Memory and performance stress tests must pass",
      "check_command": "./test/stress-test-memory.sh"
    }
  },
  "activity_gates": {
    "bugfix": {
      "required_gates": [
        "all_tests_pass",
        "no_critical_issues", 
        "memory_improvement",
        "stress_test_pass"
      ]
    },
    "fix": {
      "required_gates": [
        "all_tests_pass",
        "stress_test_pass"
      ]
    }
  }
}
```

#### Failure Conditions Integration
```json
{
  "automatic_failures": [
    {
      "condition": "stress_test_failures",
      "description": "Memory or performance stress tests failed",
      "action": "FAIL activity",
      "severity": "HIGH",
      "check_command": "./test/stress-test-memory.sh"
    }
  ],
  "activity_specific_conditions": {
    "bugfix": {
      "required_checks": [
        "stress_test_failures"
      ]
    }
  }
}
```

### CI/CD Pipeline Integration

#### GitHub Actions
```yaml
name: Stress Testing

on: [push, pull_request]

jobs:
  stress-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run stress tests
        env:
          MEMORY_LIMIT_MB: 256
          LONG_RUNNING_MINUTES: 5  # Shorter for CI
        run: ./test/stress-test-memory.sh
        
      - name: Upload stress test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: stress-test-report
          path: stress-test-report.json
```

#### Activity Template Integration
```json
{
  "id": "memory-fix-with-stress-testing",
  "name": "Memory Fix with Mandatory Stress Testing",
  "tasks": [
    {
      "id": "implement-fix",
      "description": "Implement memory or performance fix"
    },
    {
      "id": "run-stress-tests",
      "description": "Run comprehensive stress tests",
      "validation": {
        "required_gates": ["stress_test_pass"],
        "commands": ["./test/stress-test-memory.sh"]
      }
    }
  ]
}
```

## Test Implementation Details

### Memory Monitoring
```javascript
// Memory usage tracking during tests
const startMemory = process.memoryUsage().heapUsed;

// ... perform operations ...

const endMemory = process.memoryUsage().heapUsed;
const memoryGrowth = (endMemory - startMemory) / 1024 / 1024;

console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);
expect(memoryGrowth).toBeLessThan(100); // Less than 100MB growth
```

### Performance Benchmarking
```javascript
// Performance timing
const startTime = process.hrtime.bigint();

// ... perform operations ...

const endTime = process.hrtime.bigint();
const durationMs = Number(endTime - startTime) / 1000000;
const opsPerSecond = (operationCount / durationMs) * 1000;

console.log(`${opsPerSecond.toFixed(2)} operations/second`);
expect(opsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
```

### Concurrent Operation Testing
```javascript
// Multiple concurrent streams
const concurrentOperations = Array.from({ length: 10 }, (_, streamId) => {
    return new Promise(async (resolve) => {
        // Perform operations concurrently
        for (let i = 0; i < 100; i++) {
            await performOperation(streamId, i);
        }
        resolve();
    });
});

await Promise.all(concurrentOperations);
```

## Test Results Reporting

### Console Output Format
```
🧪 Memory & Performance Stress Test Suite
==========================================

Configuration:
  Memory Limit: 256MB
  CPU Limit: 80%
  Long Running Duration: 10 minutes

Test 1: High Memory Pressure (500 impulses)
✅ PASS
Results:
  Duration: 5.2s
  Peak Memory: 145MB
  Average Memory: 120MB
  Memory Usage: 56% of limit

Test 2: Undo/Redo Heavy Usage (1000 operations)  
✅ PASS
Results:
  Duration: 3.8s
  Peak Memory: 95MB
  Memory Growth: 12MB
  Operations/sec: 263

...

STRESS TEST RESULTS
===================
✅ OVERALL: ALL STRESS TESTS PASSED
All 6 tests completed successfully

Summary:
  Total Tests: 6
  Passed: 6
  Failed: 0
  Memory Limit: 256MB
  CPU Limit: 80%
```

### JSON Report Format
```json
{
  "timestamp": "2026-01-30T10:30:00Z",
  "overall_result": "PASSED",
  "configuration": {
    "memory_limit_mb": 256,
    "cpu_limit_percent": 80,
    "test_timeout_ms": 600000,
    "long_running_minutes": 10
  },
  "summary": {
    "total_tests": 6,
    "tests_passed": 6,
    "tests_failed": 0,
    "success_rate": 100
  },
  "test_results": [
    {
      "name": "High Memory Pressure",
      "status": "PASSED",
      "duration_ms": 5200,
      "peak_memory_mb": 145,
      "average_memory_mb": 120,
      "memory_usage_percent": 56
    }
  ]
}
```

## Troubleshooting

### Common Issues

**Tests timing out:**
```bash
# Increase timeout
export TEST_TIMEOUT=1200000  # 20 minutes

# Or reduce test complexity
export LONG_RUNNING_MINUTES=5
```

**Memory limit exceeded:**
```bash
# Check for memory leaks in your code
# Review garbage collection effectiveness
# Optimize data structures

# Temporarily increase limit for debugging
export MEMORY_LIMIT_MB=512
```

**Performance degradation:**
```bash
# Profile your code for bottlenecks
# Check for O(n²) algorithms
# Review database query performance
# Optimize critical paths
```

**Flaky test results:**
```bash
# Run tests multiple times
for i in {1..5}; do ./test/stress-test-memory.sh; done

# Check for race conditions
# Review async operation handling
# Ensure proper cleanup
```

### Debug Mode
```bash
# Enable detailed logging
DEBUG=1 ./test/stress-test-memory.sh

# Monitor system resources
# In another terminal:
top -p $(pgrep -f stress-test)
```

## Best Practices

### Writing Stress-Resistant Code

#### Memory Management
```javascript
// ✅ Good: Bounded data structures
class BoundedArray {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.items = [];
    }
    
    add(item) {
        this.items.push(item);
        if (this.items.length > this.maxSize) {
            this.items.shift(); // Remove oldest
        }
    }
}

// ❌ Bad: Unbounded growth
const items = [];
function addItem(item) {
    items.push(item); // Grows forever
}
```

#### Resource Cleanup
```javascript
// ✅ Good: Proper cleanup
class ResourceManager {
    constructor() {
        this.resources = new Set();
    }
    
    createResource() {
        const resource = new SomeResource();
        this.resources.add(resource);
        return resource;
    }
    
    cleanup() {
        for (const resource of this.resources) {
            resource.dispose();
        }
        this.resources.clear();
    }
}

// ❌ Bad: No cleanup
const resources = [];
function createResource() {
    resources.push(new SomeResource()); // Never cleaned up
}
```

### Performance Optimization
```javascript
// ✅ Good: Efficient algorithms
function efficientSearch(items, target) {
    // Use Map for O(1) lookup instead of O(n) array search
    const itemMap = new Map(items.map(item => [item.id, item]));
    return itemMap.get(target);
}

// ❌ Bad: Inefficient search
function inefficientSearch(items, target) {
    return items.find(item => item.id === target); // O(n) every time
}
```

## Integration Examples

### Example 1: Memory Fix Validation
```bash
# After implementing memory leak fix
git commit -m "fix: resolve memory leak in session manager"

# Stress test automatically runs via quality gates
# Tests validate:
# - Memory doesn't grow unbounded
# - Performance remains stable
# - Long-running sessions work correctly
```

### Example 2: Performance Optimization
```bash
# After optimizing slow operation
git commit -m "perf: optimize impulse loading algorithm"

# Stress test validates:
# - 500 impulse loading completes in reasonable time
# - Memory usage is efficient
# - Performance scales appropriately
```

### Example 3: CI Pipeline Failure
```yaml
# Pipeline fails stress test
❌ Test 3: Long-running Session (10 minutes)
FAIL
Failure reasons:
  - Memory exceeded limit: 280MB > 256MB
  - Memory leak detected in session cleanup

# Developer fixes issue and retries
git commit -m "fix: add proper session cleanup in long-running scenarios"
# Pipeline passes ✅
```

## Continuous Improvement

### Metrics Collection
- Track stress test duration trends
- Monitor memory usage baselines
- Collect performance regression data
- Analyze failure patterns

### Test Evolution
- Add new stress scenarios based on production issues
- Update thresholds based on real-world performance
- Improve test reliability and reduce flakiness
- Expand coverage for new system components

This comprehensive stress testing system ensures that memory and performance fixes are thoroughly validated under realistic conditions, preventing issues that might only surface in production environments.