#!/bin/bash
# Verification script for activity template backend synchronization
# Usage: ./scripts/verify-template-sync.sh [template-id]

set -e

TEMPLATE_ID="${1:-}"
LOG_FILE="$HOME/.local/share/opencode/log/dev.log"
STORAGE_DIR="$HOME/.local/share/opencode/storage/activity-template"
PROJECT_DIR=".metabob/activities"

echo "=========================================="
echo "Activity Template Sync Verification"
echo "=========================================="
echo ""

# Check 1: Local storage
echo "✓ Check 1: Local Storage"
if [ -d "$STORAGE_DIR" ]; then
    LOCAL_COUNT=$(ls -1 "$STORAGE_DIR"/*.json 2>/dev/null | wc -l)
    echo "  Found $LOCAL_COUNT templates in local storage"
    if [ -n "$TEMPLATE_ID" ]; then
        if [ -f "$STORAGE_DIR/${TEMPLATE_ID}.json" ]; then
            echo "  ✓ Template '$TEMPLATE_ID' exists locally"
        else
            echo "  ✗ Template '$TEMPLATE_ID' NOT found locally"
        fi
    fi
else
    echo "  ✗ Local storage directory not found: $STORAGE_DIR"
fi
echo ""

# Check 2: Project directory
echo "✓ Check 2: Project Directory (.metabob/activities)"
if [ -d "$PROJECT_DIR" ]; then
    PROJECT_COUNT=$(ls -1 "$PROJECT_DIR"/*.json 2>/dev/null | wc -l)
    echo "  Found $PROJECT_COUNT templates in project directory"
    if [ -n "$TEMPLATE_ID" ]; then
        if [ -f "$PROJECT_DIR/${TEMPLATE_ID}.json" ]; then
            echo "  ✓ Template '$TEMPLATE_ID' exists in project"
        else
            echo "  ✗ Template '$TEMPLATE_ID' NOT found in project"
        fi
    fi
else
    echo "  ✗ Project directory not found: $PROJECT_DIR"
fi
echo ""

# Check 3: Registration logs
echo "✓ Check 3: Registration Logs"
if [ -f "$LOG_FILE" ]; then
    echo "  Checking recent registration attempts..."
    
    # Check for TODO message (indicates MCP call not implemented)
    TODO_COUNT=$(grep -c "MCP registration tool not yet implemented" "$LOG_FILE" 2>/dev/null || echo "0")
    if [ "$TODO_COUNT" -gt 0 ]; then
        echo "  ⚠️  WARNING: Found $TODO_COUNT log entries with TODO comment"
        echo "     This indicates MCP call is NOT implemented"
        echo "     Templates are NOT being synced to backend!"
    fi
    
    # Check for successful backend registration
    BACKEND_COUNT=$(grep -c "backend=metabob" "$LOG_FILE" 2>/dev/null || echo "0")
    if [ "$BACKEND_COUNT" -gt 0 ]; then
        echo "  ✓ Found $BACKEND_COUNT successful backend registrations"
    else
        echo "  ✗ No successful backend registrations found"
    fi
    
    if [ -n "$TEMPLATE_ID" ]; then
        echo ""
        echo "  Recent log entries for '$TEMPLATE_ID':"
        grep "$TEMPLATE_ID" "$LOG_FILE" 2>/dev/null | tail -5 || echo "    (No entries found)"
    fi
else
    echo "  ✗ Log file not found: $LOG_FILE"
fi
echo ""

# Check 4: Metabob config
echo "✓ Check 4: Metabob Configuration"
if [ -f ".metabob/config.json" ]; then
    BASE_URL=$(cat .metabob/config.json | grep -o '"base_url"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    echo "  Base URL: $BASE_URL"
    
    if [[ "$BASE_URL" == "http://localhost:"* ]]; then
        echo "  ⚠️  WARNING: Using localhost backend"
        echo "     Templates will NOT be available on ide.metabob.com"
    elif [[ "$BASE_URL" == *"metabob.com"* ]]; then
        echo "  ✓ Using production backend"
    else
        echo "  ⚠️  Unknown backend: $BASE_URL"
    fi
else
    echo "  ✗ Config file not found: .metabob/config.json"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

if [ "$TODO_COUNT" -gt 0 ]; then
    echo "❌ BACKEND SYNC NOT WORKING"
    echo ""
    echo "Issue: MCP registration tool call is not implemented"
    echo "Location: repos/metabob-opencode/packages/opencode/src/util/metabob.ts:781"
    echo ""
    echo "Fix: Replace registerActivityTemplate() function to call MCP tool"
    echo "See: BACKEND_SYNC_VERIFICATION_GUIDE.md for implementation details"
    echo ""
    echo "Impact:"
    echo "  - Templates exist locally but NOT on backend"
    echo "  - Other developers cannot access templates"
    echo "  - Web dashboard will not show templates"
    echo "  - CI/CD cannot use templates"
    exit 1
elif [ "$BACKEND_COUNT" -gt 0 ]; then
    echo "✅ BACKEND SYNC WORKING"
    echo ""
    echo "Templates are being properly synced to backend"
    echo "Local templates: $LOCAL_COUNT"
    echo "Backend registrations: $BACKEND_COUNT"
    exit 0
else
    echo "⚠️  UNABLE TO VERIFY"
    echo ""
    echo "No registration attempts found in logs"
    echo "Try registering a template and run this script again"
    exit 2
fi
