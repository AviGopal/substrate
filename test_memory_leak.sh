#!/bin/bash

# Memory Leak Test Script
# Tests the three suspected scenarios that cause memory leaks

echo "=== OPENCODE MEMORY LEAK TEST SUITE ==="
echo "Testing scenarios: Impulse Loading, Undo Operations, Mixed Operations"
echo

# Function to get memory usage
get_memory() {
    docker stats devbob-opencode --no-stream --format "{{.MemUsage}}" | sed 's/MiB.*//'
}

# Function to get process RSS
get_process_rss() {
    docker exec devbob-opencode bash -c 'ps aux | grep "opencode acp" | grep -v grep | awk "{print \$6}"'
}

echo "=== BASELINE MEASUREMENT ==="
baseline_container=$(get_memory)
baseline_rss=$(get_process_rss)
echo "Container Memory: ${baseline_container}MiB"
echo "Process RSS: ${baseline_rss}KB"
echo

# Scenario A - Impulse Loading Simulation
echo "=== SCENARIO A: IMPULSE LOADING TEST ==="
echo "Simulating impulse loading by creating multiple quick sessions..."

for i in {1..10}; do
    echo "Loading impulse $i..."
    # Use opencode run with very short operations to simulate impulse loading
    docker exec devbob-opencode bash -c "cd /workspace && timeout 5s opencode run 'Load impulse $i with content' >/dev/null 2>&1 &"
    sleep 1
    
    if [ $((i % 3)) -eq 0 ]; then
        current_memory=$(get_memory)
        current_rss=$(get_process_rss)
        echo "  Memory check $i: Container=${current_memory}MiB, RSS=${current_rss}KB"
    fi
done

echo "Waiting for operations to complete..."
sleep 10

impulse_memory=$(get_memory)
impulse_rss=$(get_process_rss)
impulse_delta=$((impulse_memory - baseline_container))

echo "After impulse loading:"
echo "  Container Memory: ${impulse_memory}MiB (Δ: ${impulse_delta}MiB)"
echo "  Process RSS: ${impulse_rss}KB"
echo

# Scenario B - Undo Operations Simulation
echo "=== SCENARIO B: UNDO OPERATIONS TEST ==="
echo "Simulating undo operations by creating and canceling operations..."

for i in {1..10}; do
    echo "Undo simulation $i..."
    # Simulate undo by starting and quickly terminating operations
    docker exec devbob-opencode bash -c "cd /workspace && timeout 2s opencode run 'Operation to undo' >/dev/null 2>&1 &"
    sleep 0.5
    # Kill any hanging processes to simulate undo
    docker exec devbob-opencode bash -c 'pkill -f "opencode run" 2>/dev/null || true'
    sleep 0.5
    
    if [ $((i % 5)) -eq 0 ]; then
        current_memory=$(get_memory)
        current_rss=$(get_process_rss)
        echo "  Memory check $i: Container=${current_memory}MiB, RSS=${current_rss}KB"
    fi
done

sleep 5

undo_memory=$(get_memory)
undo_rss=$(get_process_rss)
undo_delta=$((undo_memory - impulse_memory))

echo "After undo operations:"
echo "  Container Memory: ${undo_memory}MiB (Δ: ${undo_delta}MiB)"
echo "  Process RSS: ${undo_rss}KB"
echo

# Scenario C - Mixed Operations
echo "=== SCENARIO C: MIXED OPERATIONS TEST ==="
echo "Combining impulse loading, activities, and undo operations..."

for i in {1..5}; do
    echo "Mixed operation cycle $i..."
    
    # Load impulse
    docker exec devbob-opencode bash -c "cd /workspace && timeout 3s opencode run 'Load impulse for cycle $i' >/dev/null 2>&1 &"
    sleep 1
    
    # Simulate activity
    docker exec devbob-opencode bash -c "cd /workspace && timeout 3s opencode run 'Perform activity $i' >/dev/null 2>&1 &"
    sleep 1
    
    # Simulate undo
    docker exec devbob-opencode bash -c 'pkill -f "opencode run" 2>/dev/null || true'
    sleep 1
    
    current_memory=$(get_memory)
    current_rss=$(get_process_rss)
    echo "  Cycle $i: Container=${current_memory}MiB, RSS=${current_rss}KB"
done

sleep 5

mixed_memory=$(get_memory)
mixed_rss=$(get_process_rss)
mixed_delta=$((mixed_memory - undo_memory))
total_delta=$((mixed_memory - baseline_container))

echo
echo "=== FINAL RESULTS ==="
echo "Baseline:      ${baseline_container}MiB container, ${baseline_rss}KB RSS"
echo "After Impulse: ${impulse_memory}MiB container (Δ: ${impulse_delta}MiB)"
echo "After Undo:    ${undo_memory}MiB container (Δ: ${undo_delta}MiB from impulse)"
echo "After Mixed:   ${mixed_memory}MiB container (Δ: ${mixed_delta}MiB from undo)"
echo "TOTAL DELTA:   ${total_delta}MiB from baseline"
echo

# Analysis
if [ $total_delta -gt 50 ]; then
    echo "🚨 MEMORY LEAK DETECTED: Total growth of ${total_delta}MiB indicates a leak"
elif [ $total_delta -gt 20 ]; then
    echo "⚠️  POTENTIAL LEAK: Growth of ${total_delta}MiB should be investigated"
elif [ $total_delta -gt 10 ]; then
    echo "ℹ️  MINOR GROWTH: ${total_delta}MiB growth may be normal caching"
else
    echo "✅ MEMORY STABLE: ${total_delta}MiB growth is within normal range"
fi

echo
echo "Test completed. Check results above for memory leak patterns."