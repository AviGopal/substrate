#!/bin/bash
# Validate prerequisites for sterile environment testing

set -e

CONTAINER_NAME="${1:-devbob-clean}"
FIX_MODE="${2:-check}"  # check or fix

echo "=== Sterile Test Prerequisites Validation ==="
echo "Container: $CONTAINER_NAME"
echo "Mode: $FIX_MODE"
echo ""

ISSUES=0
CAN_FIX=0

# Check 1: Container exists and is running
echo "1. Checking container status..."
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "   ✅ Container is running"
elif docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "   ⚠️  Container exists but is stopped"
    if [ "$FIX_MODE" = "fix" ]; then
        echo "   🔧 Starting container..."
        docker start "$CONTAINER_NAME"
        sleep 3
        echo "   ✅ Container started"
    else
        echo "   💡 Run with 'fix' to start: $0 $CONTAINER_NAME fix"
        ((ISSUES++))
        ((CAN_FIX++))
    fi
else
    echo "   ❌ Container does not exist"
    echo "   💡 Create with: cd repos/metabob-opencode/packages/opencode/docker/devbob-acp && docker-compose up -d"
    ((ISSUES++))
fi

# Check 2: OpenCode is installed
echo ""
echo "2. Checking OpenCode CLI..."
if OPENCODE_VER=$(docker exec "$CONTAINER_NAME" bash -c "opencode --version 2>&1 | head -1" 2>/dev/null); then
    echo "   ✅ $OPENCODE_VER"
else
    echo "   ❌ OpenCode not found in container"
    ((ISSUES++))
fi

# Check 3: Backend API is accessible
echo ""
echo "3. Checking backend API..."
# Try docker network name first (api-server-dev:8080), then localhost
if BACKEND_STATUS=$(docker exec "$CONTAINER_NAME" bash -c "curl -s http://api-server-dev:8080/api/v1/activities 2>&1" 2>/dev/null); then
    if echo "$BACKEND_STATUS" | jq -e '. | length' >/dev/null 2>&1; then
        ACTIVITY_COUNT=$(echo "$BACKEND_STATUS" | jq '. | length' 2>/dev/null)
        echo "   ✅ Backend reachable via docker network (activities: $ACTIVITY_COUNT)"
    else
        echo "   ⚠️  Backend responded but format unexpected: $BACKEND_STATUS"
        ((ISSUES++))
    fi
elif BACKEND_STATUS=$(docker exec "$CONTAINER_NAME" bash -c "curl -s http://localhost:8080/api/v1/activities 2>&1" 2>/dev/null); then
    if echo "$BACKEND_STATUS" | jq -e '. | length' >/dev/null 2>&1; then
        ACTIVITY_COUNT=$(echo "$BACKEND_STATUS" | jq '. | length' 2>/dev/null)
        echo "   ✅ Backend reachable via localhost (activities: $ACTIVITY_COUNT)"
    else
        echo "   ⚠️  Backend responded but format unexpected: $BACKEND_STATUS"
        ((ISSUES++))
    fi
else
    echo "   ❌ Backend not reachable"
    echo "   💡 Check if api-server-dev container is running"
    ((ISSUES++))
fi

# Check 4: Activity template is available
echo ""
echo "4. Checking for activity-create-v2 template..."
TEMPLATE_PATH="repos/metabob-proto/activities/bootstrap/activity-create-v2.json"
if [ -f "$TEMPLATE_PATH" ]; then
    echo "   ✅ Template found: $TEMPLATE_PATH"
    if jq empty "$TEMPLATE_PATH" 2>/dev/null; then
        echo "   ✅ Template JSON is valid"
        STEP_COUNT=$(jq '.task_steps | length' "$TEMPLATE_PATH")
        echo "   📊 Template has $STEP_COUNT steps"
    else
        echo "   ❌ Template JSON is invalid"
        ((ISSUES++))
    fi
else
    echo "   ❌ Template not found: $TEMPLATE_PATH"
    ((ISSUES++))
fi

# Check 5: Workspace is accessible
echo ""
echo "5. Checking workspace..."
if WORKSPACE_CONTENTS=$(docker exec "$CONTAINER_NAME" bash -c "ls -la /workspace 2>&1" 2>/dev/null); then
    FILE_COUNT=$(docker exec "$CONTAINER_NAME" bash -c "ls -A /workspace | wc -l" 2>/dev/null)
    echo "   ✅ Workspace accessible"
    echo "   📊 Current items: $FILE_COUNT"
    
    if [ "$FILE_COUNT" -gt 5 ]; then
        echo "   ⚠️  Workspace is not sterile ($FILE_COUNT items)"
        echo "   💡 For true sterile test, consider cleaning workspace"
        if [ "$FIX_MODE" = "fix" ]; then
            echo "   🔧 Cleaning workspace (keeping .metabob and .opencode)..."
            docker exec "$CONTAINER_NAME" bash -c "cd /workspace && find . -mindepth 1 -maxdepth 1 ! -name '.metabob' ! -name '.opencode' -exec rm -rf {} +"
            echo "   ✅ Workspace cleaned"
        else
            ((CAN_FIX++))
        fi
    else
        echo "   ✅ Workspace is sterile"
    fi
else
    echo "   ❌ Cannot access workspace"
    ((ISSUES++))
fi

# Check 6: Session token exists and is valid
echo ""
echo "6. Checking session token..."
if docker exec "$CONTAINER_NAME" bash -c "test -f /workspace/.metabob/state" 2>/dev/null; then
    echo "   ✅ Session state file exists"
    
    # Try to extract token expiry
    if TOKEN_DATA=$(docker exec "$CONTAINER_NAME" bash -c "cat /workspace/.metabob/state 2>/dev/null" 2>/dev/null); then
        if echo "$TOKEN_DATA" | jq -e '.session_metadata.token' >/dev/null 2>&1; then
            EXPIRES_AT=$(echo "$TOKEN_DATA" | jq -r '.session_metadata.expires_at // "unknown"' 2>/dev/null)
            echo "   📊 Token expires: $EXPIRES_AT"
            
            # Check if expired (simplified check)
            if [ "$EXPIRES_AT" != "unknown" ]; then
                EXPIRES_EPOCH=$(date -d "$EXPIRES_AT" +%s 2>/dev/null || echo "0")
                NOW_EPOCH=$(date +%s)
                if [ "$EXPIRES_EPOCH" -lt "$NOW_EPOCH" ]; then
                    echo "   ⚠️  Token appears expired"
                    if [ "$FIX_MODE" = "fix" ]; then
                        echo "   🔧 Generating new session token..."
                        if [ -f "scripts/create_session_state.py" ]; then
                            python3 scripts/create_session_state.py || echo "   ❌ Failed to create session"
                        else
                            echo "   ❌ create_session_state.py not found"
                        fi
                    else
                        ((ISSUES++))
                        ((CAN_FIX++))
                    fi
                else
                    echo "   ✅ Token is valid"
                fi
            fi
        else
            echo "   ⚠️  Token format unrecognized"
            ((ISSUES++))
        fi
    fi
else
    echo "   ⚠️  Session state file not found"
    if [ "$FIX_MODE" = "fix" ]; then
        echo "   🔧 Creating session token..."
        if [ -f "scripts/create_session_state.py" ]; then
            python3 scripts/create_session_state.py || echo "   ❌ Failed to create session"
        else
            echo "   ❌ create_session_state.py not found"
        fi
    else
        ((ISSUES++))
        ((CAN_FIX++))
    fi
fi

# Check 7: Required tools in container
echo ""
echo "7. Checking required tools..."
REQUIRED_TOOLS="jq curl bash"
for TOOL in $REQUIRED_TOOLS; do
    if docker exec "$CONTAINER_NAME" bash -c "which $TOOL >/dev/null 2>&1" 2>/dev/null; then
        echo "   ✅ $TOOL available"
    else
        echo "   ❌ $TOOL not found"
        ((ISSUES++))
    fi
done

# Summary
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="

if [ $ISSUES -eq 0 ]; then
    echo "✅ All prerequisites met"
    echo ""
    echo "Ready to run sterile tests:"
    echo "  ./scripts/test-activity-create-sterile.sh $CONTAINER_NAME minimal"
    exit 0
else
    echo "⚠️  Found $ISSUES issue(s)"
    
    if [ $CAN_FIX -gt 0 ] && [ "$FIX_MODE" = "check" ]; then
        echo ""
        echo "Some issues can be auto-fixed. Run:"
        echo "  $0 $CONTAINER_NAME fix"
    fi
    
    exit 1
fi
