#!/bin/bash
# Pre-flight checks for DevBob validation environment

set -euo pipefail

NAMESPACE="metabob"
ERRORS=0
WARNINGS=0

echo "============================================"
echo "DevBob Environment Pre-flight Checks"
echo "============================================"
echo

# Check 1: Verify pods are running
echo "[1/10] Checking pod status..."

DEVBOB_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
RPC_API_POD=$(kubectl get pod -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
SURREALDB_POD=$(kubectl get pod -n $NAMESPACE -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$DEVBOB_POD" ]; then
    echo "❌ DevBob pod not found"
    ((ERRORS++))
else
    DEVBOB_STATUS=$(kubectl get pod -n $NAMESPACE $DEVBOB_POD -o jsonpath='{.status.phase}')
    if [ "$DEVBOB_STATUS" == "Running" ]; then
        echo "✅ DevBob pod running: $DEVBOB_POD"
    else
        echo "❌ DevBob pod not running: $DEVBOB_POD (status: $DEVBOB_STATUS)"
        ((ERRORS++))
    fi
fi

if [ -z "$RPC_API_POD" ]; then
    echo "❌ RPC API pod not found"
    ((ERRORS++))
else
    RPC_API_STATUS=$(kubectl get pod -n $NAMESPACE $RPC_API_POD -o jsonpath='{.status.phase}')
    if [ "$RPC_API_STATUS" == "Running" ]; then
        echo "✅ RPC API pod running: $RPC_API_POD"
    else
        echo "❌ RPC API pod not running: $RPC_API_POD (status: $RPC_API_STATUS)"
        ((ERRORS++))
    fi
fi

if [ -z "$SURREALDB_POD" ]; then
    echo "❌ SurrealDB pod not found"
    ((ERRORS++))
else
    SURREALDB_STATUS=$(kubectl get pod -n $NAMESPACE $SURREALDB_POD -o jsonpath='{.status.phase}')
    if [ "$SURREALDB_STATUS" == "Running" ]; then
        echo "✅ SurrealDB pod running: $SURREALDB_POD"
    else
        echo "❌ SurrealDB pod not running: $SURREALDB_POD (status: $SURREALDB_STATUS)"
        ((ERRORS++))
    fi
fi
echo

# Check 2: Verify OpenCode CLI in DevBob
if [ -n "$DEVBOB_POD" ]; then
    echo "[2/10] Checking OpenCode CLI in DevBob pod..."
    if kubectl exec -n $NAMESPACE $DEVBOB_POD -- which opencode > /dev/null 2>&1; then
        echo "✅ OpenCode CLI found in DevBob pod"
    else
        echo "❌ OpenCode CLI not found in DevBob pod"
        ((ERRORS++))
    fi
    echo
fi

# Check 3: Verify environment variables in DevBob
if [ -n "$DEVBOB_POD" ]; then
    echo "[3/10] Checking environment variables in DevBob pod..."
    
    METABOB_API_KEY=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- env | grep METABOB_API_KEY || echo "")
    ACTIVITY_BACKEND_URL=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- env | grep ACTIVITY_BACKEND_URL || echo "")
    
    if [ -n "$METABOB_API_KEY" ]; then
        echo "✅ METABOB_API_KEY is set"
    else
        echo "⚠️  METABOB_API_KEY not set (may be optional)"
        ((WARNINGS++))
    fi
    
    if [ -n "$ACTIVITY_BACKEND_URL" ]; then
        echo "✅ ACTIVITY_BACKEND_URL is set: $(echo $ACTIVITY_BACKEND_URL | cut -d'=' -f2)"
    else
        echo "⚠️  ACTIVITY_BACKEND_URL not set"
        ((WARNINGS++))
    fi
    echo
fi

# Check 4: Test RPC API reachability from DevBob
if [ -n "$DEVBOB_POD" ] && [ -n "$ACTIVITY_BACKEND_URL" ]; then
    echo "[4/10] Testing RPC API reachability from DevBob..."
    
    BACKEND_URL=$(echo $ACTIVITY_BACKEND_URL | cut -d'=' -f2)
    if kubectl exec -n $NAMESPACE $DEVBOB_POD -- curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null | grep -q "200"; then
        echo "✅ RPC API is reachable from DevBob"
    else
        echo "❌ RPC API is not reachable from DevBob"
        ((ERRORS++))
    fi
    echo
fi

# Check 5: Verify activity templates exist
if [ -n "$DEVBOB_POD" ]; then
    echo "[5/10] Checking for activity templates..."
    
    TEMPLATES=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- opencode activity search-activities 2>/dev/null || echo "")
    
    if echo "$TEMPLATES" | grep -q "create-activity"; then
        echo "✅ create-activity template found"
    else
        echo "❌ create-activity template not found"
        ((ERRORS++))
    fi
    
    if echo "$TEMPLATES" | grep -q "evolve-activity"; then
        echo "✅ evolve-activity template found"
    else
        echo "❌ evolve-activity template not found"
        ((ERRORS++))
    fi
    
    if echo "$TEMPLATES" | grep -q "debug-activity"; then
        echo "✅ debug-activity template found"
    else
        echo "❌ debug-activity template not found"
        ((ERRORS++))
    fi
    echo
fi

# Check 6: Verify SurrealDB connectivity
if [ -n "$SURREALDB_POD" ]; then
    echo "[6/10] Checking SurrealDB connectivity..."
    
    if kubectl exec -n $NAMESPACE $SURREALDB_POD -- surreal version > /dev/null 2>&1; then
        echo "✅ SurrealDB CLI available"
    else
        echo "❌ SurrealDB CLI not available"
        ((ERRORS++))
    fi
    echo
fi

# Check 7: Verify activity_executions table exists
if [ -n "$SURREALDB_POD" ]; then
    echo "[7/10] Checking SurrealDB schema..."
    
    TABLE_CHECK=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- surreal sql "INFO FOR TABLE activity_executions" 2>&1 || echo "")
    
    if echo "$TABLE_CHECK" | grep -q "activity_executions"; then
        echo "✅ activity_executions table exists"
    else
        echo "⚠️  activity_executions table may not exist"
        ((WARNINGS++))
    fi
    echo
fi

# Check 8: Check RPC API logs for recent activity
if [ -n "$RPC_API_POD" ]; then
    echo "[8/10] Checking RPC API logs..."
    
    RECENT_LOGS=$(kubectl logs -n $NAMESPACE $RPC_API_POD --tail=50 2>/dev/null || echo "")
    
    if [ -n "$RECENT_LOGS" ]; then
        echo "✅ RPC API logs accessible"
        
        if echo "$RECENT_LOGS" | grep -q "POST /activity-execution"; then
            echo "✅ Activity execution requests found in logs"
        else
            echo "⚠️  No recent activity execution requests in logs"
            ((WARNINGS++))
        fi
    else
        echo "❌ Cannot access RPC API logs"
        ((ERRORS++))
    fi
    echo
fi

# Check 9: Verify Redis is running
echo "[9/10] Checking Redis..."

REDIS_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$REDIS_POD" ]; then
    REDIS_STATUS=$(kubectl get pod -n $NAMESPACE $REDIS_POD -o jsonpath='{.status.phase}')
    if [ "$REDIS_STATUS" == "Running" ]; then
        echo "✅ Redis pod running: $REDIS_POD"
    else
        echo "⚠️  Redis pod not running: $REDIS_POD (status: $REDIS_STATUS)"
        ((WARNINGS++))
    fi
else
    echo "⚠️  Redis pod not found (may be optional)"
    ((WARNINGS++))
fi
echo

# Check 10: Summary
echo "[10/10] Summary"
echo "============================================"
echo

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! Environment is ready for validation."
    echo
    echo "Next steps:"
    echo "  1. Run: ./run-validation-harness.sh"
    echo "  2. Or manually: bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  All critical checks passed, but there are $WARNINGS warnings."
    echo
    echo "Environment is likely ready for validation, but review warnings above."
    exit 0
else
    echo "❌ Pre-flight checks failed: $ERRORS errors, $WARNINGS warnings"
    echo
    echo "Fix the errors above before running validation harness."
    exit 1
fi
