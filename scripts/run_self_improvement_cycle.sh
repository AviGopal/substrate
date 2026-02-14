#!/bin/bash
# =============================================================================
# Self-Improvement Feedback Loop Runner
# =============================================================================
# This script runs the complete self-improvement cycle:
# 1. Analyze current system state (Redis/SurrealDB data)
# 2. Detect patterns and issues algorithmically
# 3. Generate improvement instructions
# 4. Apply code changes automatically
# 5. Validate changes
# 6. (Optionally) Deploy improvements
#
# Usage:
#   ./scripts/run_self_improvement_cycle.sh [--auto-deploy] [--verify]
#
# Options:
#   --auto-deploy   Automatically deploy improvements after code changes
#   --verify        Run verification after deployment
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUTO_DEPLOY=false
VERIFY=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --auto-deploy)
            AUTO_DEPLOY=true
            shift
            ;;
        --verify)
            VERIFY=true
            shift
            ;;
    esac
done

echo "============================================================================="
echo "SELF-IMPROVEMENT FEEDBACK LOOP"
echo "============================================================================="
echo ""

# Step 1: Analyze current state
echo "[1/6] Analyzing current system state..."
echo "----------------------------------------"
python3 /tmp/simple_analyzer.py
echo ""

# Check if issues were found
if [ ! -f /tmp/improvement_report.json ]; then
    echo "ERROR: Analysis failed - no report generated"
    exit 1
fi

ISSUE_COUNT=$(python3 -c "import json; data=json.load(open('/tmp/improvement_report.json')); print(len(data['issues']))")

if [ "$ISSUE_COUNT" -eq 0 ]; then
    echo "✓ No issues detected - system is healthy"
    echo ""
    echo "============================================================================="
    echo "CYCLE COMPLETE - NO IMPROVEMENTS NEEDED"
    echo "============================================================================="
    exit 0
fi

echo "✓ Detected $ISSUE_COUNT issue(s) requiring attention"
echo ""

# Step 2: Generate and apply improvements
echo "[2/6] Generating and applying improvements..."
echo "----------------------------------------------"
python3 /tmp/code_updater.py
echo ""

# Step 3: Validate changes
echo "[3/6] Validating configuration changes..."
echo "------------------------------------------"
cd "$PROJECT_ROOT"
if docker-compose --profile stable config > /dev/null 2>&1; then
    echo "✓ Docker-compose configuration is valid"
else
    echo "✗ Docker-compose configuration is INVALID"
    exit 1
fi
echo ""

# Step 4: Show what changed
echo "[4/6] Changes made to codebase..."
echo "---------------------------------"
git diff --stat docker-compose.yaml
echo ""

# Step 5: Deployment (optional)
if [ "$AUTO_DEPLOY" = true ]; then
    echo "[5/6] Deploying improvements..."
    echo "-------------------------------"
    
    # Check what needs to be deployed
    if grep -q "celery-worker:" docker-compose.yaml; then
        echo "Building and starting celery-worker..."
        docker-compose --profile stable build celery-worker
        docker-compose --profile stable up -d celery-worker
        echo "✓ Celery worker deployed"
    fi
    echo ""
else
    echo "[5/6] Deployment skipped (use --auto-deploy to enable)"
    echo "-------------------------------------------------------"
    echo "To deploy manually, run:"
    echo "  docker-compose --profile stable build celery-worker"
    echo "  docker-compose --profile stable up -d celery-worker"
    echo ""
fi

# Step 6: Verification (optional)
if [ "$VERIFY" = true ] && [ "$AUTO_DEPLOY" = true ]; then
    echo "[6/6] Verifying improvements..."
    echo "-------------------------------"
    echo "Waiting 10 seconds for services to stabilize..."
    sleep 10
    
    # Re-run analyzer to check if issue is resolved
    echo "Re-analyzing system state..."
    python3 /tmp/simple_analyzer.py
    
    NEW_ISSUE_COUNT=$(python3 -c "import json; data=json.load(open('/tmp/improvement_report.json')); print(len(data['issues']))")
    
    if [ "$NEW_ISSUE_COUNT" -lt "$ISSUE_COUNT" ]; then
        echo ""
        echo "✓ IMPROVEMENT VERIFIED"
        echo "  Issues before: $ISSUE_COUNT"
        echo "  Issues after:  $NEW_ISSUE_COUNT"
        echo "  Improvement:   $((ISSUE_COUNT - NEW_ISSUE_COUNT)) issues resolved"
    else
        echo ""
        echo "⚠ No improvement detected (may need more time)"
        echo "  Issues before: $ISSUE_COUNT"
        echo "  Issues after:  $NEW_ISSUE_COUNT"
    fi
    echo ""
else
    echo "[6/6] Verification skipped"
    echo "--------------------------"
    if [ "$AUTO_DEPLOY" = false ]; then
        echo "Note: Verification requires --auto-deploy"
    fi
    echo ""
fi

# Summary
echo "============================================================================="
echo "CYCLE COMPLETE"
echo "============================================================================="
echo ""
echo "Summary:"
echo "  Issues detected:  $ISSUE_COUNT"
echo "  Code modified:    docker-compose.yaml"
echo "  Configuration:    Valid ✓"
if [ "$AUTO_DEPLOY" = true ]; then
    echo "  Deployed:         Yes ✓"
else
    echo "  Deployed:         No (manual deployment required)"
fi
echo ""
echo "Reports generated:"
echo "  - /tmp/improvement_report.json"
echo "  - /tmp/implementation_report.json"
echo ""
echo "Next steps:"
if [ "$AUTO_DEPLOY" = false ]; then
    echo "  1. Review changes: git diff docker-compose.yaml"
    echo "  2. Deploy: docker-compose --profile stable up -d celery-worker"
    echo "  3. Verify: docker logs -f metabob-celery-worker"
fi
echo "  4. Re-run cycle: $0"
echo ""
echo "Full documentation: SELF_IMPROVEMENT_DEMONSTRATION.md"
echo ""
