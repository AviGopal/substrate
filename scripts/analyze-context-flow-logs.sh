#!/bin/bash

# Analyze OpenCode logs for context requirements flow

LOG_DIR="$HOME/.local/share/opencode/logs"
LATEST_LOG=$(ls -t "$LOG_DIR"/opencode-*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "✗ No log files found in $LOG_DIR"
    exit 1
fi

echo "=========================================="
echo "Context Requirements Flow Analysis"
echo "=========================================="
echo ""
echo "Analyzing: $LATEST_LOG"
echo ""

# 1. Context Requirements Extracted
echo "--- 1. CONTEXT REQUIREMENTS EXTRACTED ---"
grep "CONTEXT_REQUIREMENTS_EXTRACTED" "$LATEST_LOG" | tail -5 || echo "Not found"
echo ""

# 2. Impulses Created
echo "--- 2. IMPULSES CREATED (ACTIVITY SCOPE) ---"
grep "IMPULSE_CREATED_ACTIVITY_SCOPE" "$LATEST_LOG" | tail -10 || echo "Not found"
echo ""

echo "--- 3. IMPULSES CREATED (SESSION SCOPE) ---"
grep "IMPULSE_CREATED_SESSION_SCOPE" "$LATEST_LOG" | tail -10 || echo "Not found"
echo ""

# 3. Memory Agent Completed
echo "--- 4. MEMORY AGENT COMPLETED ---"
grep "MEMORY_AGENT_COMPLETED" "$LATEST_LOG" | tail -5 || echo "Not found"
echo ""

# 4. Full context requirements JSON (if present)
echo "--- 5. FULL CONTEXT REQUIREMENTS (if logged) ---"
grep -A 20 "context_requirements.*\[" "$LATEST_LOG" | head -50 || echo "Not found"
echo ""

echo "=========================================="
echo "Analysis complete"
echo "=========================================="
