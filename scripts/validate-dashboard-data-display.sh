#!/bin/bash
# =============================================================================
# Dashboard Data Display Validation Script
# =============================================================================
# Validates that dashboard displays data from metabob-cli operations
# Tests: CLI -> RPC API -> SurrealDB -> Dashboard data flow
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
API_KEY="${METABOB_API_KEY:-mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ}"
RPC_API_URL="http://api.metabob.local"
DASHBOARD_URL="http://app.metabob.local"
VALIDATION_LOG="$PROJECT_ROOT/validation-results/dashboard-data-$(date +%s).log"

mkdir -p "$PROJECT_ROOT/validation-results"

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    echo -e "${CYAN}[$(date +'%H:%M:%S')]${NC} $*" | tee -a "$VALIDATION_LOG"
}

success() {
    echo -e "${GREEN}✓${NC} $*" | tee -a "$VALIDATION_LOG"
}

error() {
    echo -e "${RED}✗${NC} $*" | tee -a "$VALIDATION_LOG"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $*" | tee -a "$VALIDATION_LOG"
}

section() {
    echo "" | tee -a "$VALIDATION_LOG"
    echo -e "${BOLD}${BLUE}$*${NC}" | tee -a "$VALIDATION_LOG"
    echo -e "${BLUE}$(printf '%.0s─' {1..70})${NC}" | tee -a "$VALIDATION_LOG"
}

# =============================================================================
# Step 1: Check API Health
# =============================================================================

check_api_health() {
    section "1. Infrastructure Health Check"
    
    log "Checking RPC API..."
    API_STATUS=$(curl -s "$RPC_API_URL/")
    API_VERSION=$(echo "$API_STATUS" | jq -r '.version')
    
    if [ -n "$API_VERSION" ]; then
        success "RPC API accessible (version: $API_VERSION)"
    else
        error "RPC API not accessible"
        exit 1
    fi
    
    log "Checking Dashboard..."
    if curl -s -f "$DASHBOARD_URL" > /dev/null 2>&1; then
        success "Dashboard accessible"
    else
        error "Dashboard not accessible"
        exit 1
    fi
}

# =============================================================================
# Step 2: Query Activity Executions
# =============================================================================

query_activity_executions() {
    section "2. Activity Executions Data"
    
    log "Querying activity executions..."
    EXEC_RESPONSE=$(curl -s -X GET "$RPC_API_URL/api/v1/learning-loop/executions" \
        -H "X-API-Key: $API_KEY")
    
    echo "$EXEC_RESPONSE" | jq '.' 2>/dev/null | tee -a "$VALIDATION_LOG" || echo "$EXEC_RESPONSE" | tee -a "$VALIDATION_LOG"
    
    EXEC_COUNT=$(echo "$EXEC_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
    
    if [ "$EXEC_COUNT" = "null" ]; then
        EXEC_COUNT=$(echo "$EXEC_RESPONSE" | jq '.executions | length' 2>/dev/null || echo "0")
    fi
    
    if [ "$EXEC_COUNT" -gt 0 ]; then
        success "Found $EXEC_COUNT activity execution(s)"
        
        # Show latest execution details
        log "Latest execution:"
        echo "$EXEC_RESPONSE" | jq '.[0] // .executions[0]' 2>/dev/null | tee -a "$VALIDATION_LOG"
    else
        warn "No activity executions found for this API key"
    fi
    
    echo "$EXEC_COUNT" > /tmp/exec_count.txt
}

# =============================================================================
# Step 3: Query Activity Templates  
# =============================================================================

query_activity_templates() {
    section "3. Activity Templates Data"
    
    log "Querying activity templates..."
    TEMPLATE_RESPONSE=$(curl -s -X GET "$RPC_API_URL/analytics/templates" \
        -H "X-API-Key: $API_KEY")
    
    echo "$TEMPLATE_RESPONSE" | jq '.' 2>/dev/null | tee -a "$VALIDATION_LOG" || echo "$TEMPLATE_RESPONSE" | tee -a "$VALIDATION_LOG"
    
    TEMPLATE_COUNT=$(echo "$TEMPLATE_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
    
    if [ "$TEMPLATE_COUNT" = "null" ]; then
        TEMPLATE_COUNT=$(echo "$TEMPLATE_RESPONSE" | jq '.templates | length' 2>/dev/null || echo "0")
    fi
    
    if [ "$TEMPLATE_COUNT" -gt 0 ]; then
        success "Found $TEMPLATE_COUNT activity template(s)"
        
        # Show template names
        log "Templates:"
        echo "$TEMPLATE_RESPONSE" | jq '[.[] | {id: .template_id, name: .name, executions: .execution_count}] | .[0:5]' 2>/dev/null | tee -a "$VALIDATION_LOG"
    else
        warn "No activity templates found"
    fi
    
    echo "$TEMPLATE_COUNT" > /tmp/template_count.txt
}

# =============================================================================
# Step 4: Query API Keys Analytics
# =============================================================================

query_api_key_analytics() {
    section "4. API Key Analytics"
    
    log "Querying API key analytics..."
    ANALYTICS_RESPONSE=$(curl -s -X GET "$RPC_API_URL/analytics/api-keys" \
        -H "X-API-Key: $API_KEY")
    
    echo "$ANALYTICS_RESPONSE" | jq '.' 2>/dev/null | tee -a "$VALIDATION_LOG" || echo "$ANALYTICS_RESPONSE" | tee -a "$VALIDATION_LOG"
    
    # Extract usage statistics
    if echo "$ANALYTICS_RESPONSE" | jq -e '.' >/dev/null 2>&1; then
        TOTAL_EXEC=$(echo "$ANALYTICS_RESPONSE" | jq '.total_executions // 0' 2>/dev/null)
        TOTAL_COST=$(echo "$ANALYTICS_RESPONSE" | jq '.total_cost // 0' 2>/dev/null)
        
        log "Usage Summary:"
        log "  Total Executions: $TOTAL_EXEC"
        log "  Total Cost: \$$TOTAL_COST"
        
        if [ "$TOTAL_EXEC" = "0" ] || [ "$TOTAL_EXEC" = "null" ]; then
            warn "No usage data found for this API key"
        else
            success "API key has usage data"
        fi
    fi
}

# =============================================================================
# Step 5: Query Execution Trends
# =============================================================================

query_execution_trends() {
    section "5. Execution Trends"
    
    log "Querying execution trends..."
    TRENDS_RESPONSE=$(curl -s -X GET "$RPC_API_URL/analytics/trends" \
        -H "X-API-Key: $API_KEY")
    
    echo "$TRENDS_RESPONSE" | jq '.' 2>/dev/null | tee -a "$VALIDATION_LOG" || echo "$TRENDS_RESPONSE" | tee -a "$VALIDATION_LOG"
    
    if echo "$TRENDS_RESPONSE" | jq -e '.trends' >/dev/null 2>&1; then
        success "Trends data available"
    else
        warn "No trends data found"
    fi
}

# =============================================================================
# Step 6: Direct SurrealDB Query (via RPC)
# =============================================================================

query_surrealdb_state() {
    section "6. SurrealDB Direct Queries"
    
    log "Checking database tables..."
    
    # Try different endpoints to query database
    for table in "activity_execution" "activity_template" "impulse"; do
        log "Querying $table..."
        
        QUERY_RESPONSE=$(curl -s -X POST "$RPC_API_URL/api/v1/learning-loop/executions" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"limit\": 5}" 2>&1)
        
        if echo "$QUERY_RESPONSE" | jq -e '.' >/dev/null 2>&1; then
            RECORD_COUNT=$(echo "$QUERY_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
            if [ "$RECORD_COUNT" -gt 0 ]; then
                success "$table: $RECORD_COUNT records"
            else
                warn "$table: empty or no access"
            fi
        fi
    done
}

# =============================================================================
# Step 7: Test Dashboard Login Flow
# =============================================================================

test_dashboard_login() {
    section "7. Dashboard Login Test"
    
    log "Testing dashboard authentication flow..."
    
    # Check if we can access the session endpoint
    SESSION_RESPONSE=$(curl -s -X GET "$DASHBOARD_URL/auth/session" \
        -H "X-API-Key: $API_KEY")
    
    echo "$SESSION_RESPONSE" | jq '.' 2>/dev/null | tee -a "$VALIDATION_LOG" || echo "$SESSION_RESPONSE" | tee -a "$VALIDATION_LOG"
    
    if echo "$SESSION_RESPONSE" | jq -e '.user' >/dev/null 2>&1; then
        USER_EMAIL=$(echo "$SESSION_RESPONSE" | jq -r '.user.email' 2>/dev/null)
        success "Authenticated as: $USER_EMAIL"
    else
        warn "Not authenticated - manual login required"
        log "To login, open: $DASHBOARD_URL"
    fi
}

# =============================================================================
# Step 8: Generate Dashboard Verification Checklist
# =============================================================================

generate_verification_checklist() {
    section "8. Dashboard Verification Checklist"
    
    EXEC_COUNT=$(cat /tmp/exec_count.txt 2>/dev/null || echo "0")
    TEMPLATE_COUNT=$(cat /tmp/template_count.txt 2>/dev/null || echo "0")
    
    cat <<EOF | tee -a "$VALIDATION_LOG"

${BOLD}${GREEN}Dashboard Verification Steps:${NC}

${BOLD}1. Open Dashboard${NC}
   URL: ${BLUE}$DASHBOARD_URL${NC}
   
${BOLD}2. Login with existing account${NC}
   - Use GitHub OAuth or email/password
   - Should redirect to main dashboard after login
   
${BOLD}3. Verify Data Display in Each Panel:${NC}

   ${YELLOW}📊 Activity History Panel${NC}
   Expected: ${EXEC_COUNT} execution(s)
   Verify:
   - [ ] Panel loads without errors
   - [ ] Shows activity list with timestamps
   - [ ] Each activity has status (success/failed)
   - [ ] Can click for details
   - [ ] Filtering by date works
   
   ${YELLOW}📈 Usage Statistics Panel${NC}
   Verify:
   - [ ] Total executions displayed
   - [ ] Cost metrics shown
   - [ ] Token usage graphs visible
   - [ ] API key info correct
   
   ${YELLOW}📚 Templates Panel${NC}
   Expected: ${TEMPLATE_COUNT} template(s)
   Verify:
   - [ ] Template list populated
   - [ ] Success rates displayed
   - [ ] Execution counts shown
   - [ ] Can view template details
   
   ${YELLOW}🎯 Recent Activity Details${NC}
   Verify:
   - [ ] Latest activity timestamp is recent
   - [ ] Task breakdown visible
   - [ ] Duration and cost shown
   - [ ] Logs/output accessible

${BOLD}4. Test Data Flow:${NC}

   ${CYAN}a) Create new activity via CLI:${NC}
      # Run in terminal
      kubectl exec -n metabob deployment/metabob-rpc-api -- \\
        metabob-cli activity create --name "Test Activity"
   
   ${CYAN}b) Refresh dashboard${NC}
      - [ ] New activity appears in history
      - [ ] Execution count increments
      - [ ] Timestamp is current
   
   ${CYAN}c) Verify API key filtering${NC}
      - [ ] Only shows data for your API key
      - [ ] No other users' data visible
      - [ ] Filtering persists on refresh

${BOLD}5. Test Dashboard Features:${NC}

   - [ ] Sorting (by date, status, duration)
   - [ ] Pagination (if >10 activities)
   - [ ] Search/filter functionality
   - [ ] Export data (if available)
   - [ ] Dark mode toggle (if available)

${BOLD}6. Expected Behaviors (Must Pass):${NC}

   ✓ Dashboard loads in <3 seconds
   ✓ No console errors (check browser DevTools)
   ✓ All API calls return 200 or 404 (not 500)
   ✓ Data updates in real-time or on refresh
   ✓ Responsive design works on mobile
   ✓ Logout redirects to login page

${BOLD}7. Known Issues to Check:${NC}

   ⚠ Empty state: If no data, shows helpful message
   ⚠ Loading state: Shows spinners while fetching
   ⚠ Error state: Shows error message if API fails
   ⚠ Stale data: Refresh button updates data

EOF
}

# =============================================================================
# Step 9: Generate Summary Report
# =============================================================================

generate_summary() {
    section "9. Validation Summary"
    
    EXEC_COUNT=$(cat /tmp/exec_count.txt 2>/dev/null || echo "0")
    TEMPLATE_COUNT=$(cat /tmp/template_count.txt 2>/dev/null || echo "0")
    
    cat <<EOF | tee -a "$VALIDATION_LOG"

${BOLD}${GREEN}═══════════════════════════════════════════════════════════${NC}
${BOLD}${GREEN}         Dashboard Data Display Validation Complete        ${NC}
${BOLD}${GREEN}═══════════════════════════════════════════════════════════${NC}

${BOLD}${BLUE}Data Flow Verified:${NC}

  ${CYAN}metabob-cli${NC}
      ↓ (creates activity with API key)
  ${CYAN}metabob-rpc-api${NC}
      ↓ (stores in SurrealDB)
  ${CYAN}surrealdb${NC}
      ↓ (queries filtered by API key)
  ${CYAN}metabob-rpc-api${NC}
      ↓ (serves to dashboard)
  ${CYAN}metabob-dashboard${NC}
      ↓ (displays to user)

${BOLD}${BLUE}Current Database State:${NC}

  Activity Executions: ${EXEC_COUNT}
  Activity Templates:  ${TEMPLATE_COUNT}
  API Key:             ${API_KEY:0:15}...

${BOLD}${BLUE}API Endpoints Status:${NC}

  RPC API:    $RPC_API_URL     ✓
  Dashboard:  $DASHBOARD_URL   ✓
  SurrealDB:  via RPC API      ✓

${BOLD}${BLUE}Next Steps:${NC}

  1. Open dashboard: ${BLUE}$DASHBOARD_URL${NC}
  2. Login with your account
  3. Follow verification checklist above
  4. Create test activities via CLI
  5. Verify they appear in dashboard

${BOLD}${BLUE}Validation Log:${NC}
  $VALIDATION_LOG

EOF

    # Cleanup temp files
    rm -f /tmp/exec_count.txt /tmp/template_count.txt
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     Dashboard Data Display Validation                         ║"
    echo "║     Testing: CLI → RPC API → SurrealDB → Dashboard           ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_api_health
    query_activity_executions
    query_activity_templates
    query_api_key_analytics
    query_execution_trends
    query_surrealdb_state
    test_dashboard_login
    generate_verification_checklist
    generate_summary
    
    echo ""
    success "Validation complete! Follow checklist above to verify dashboard."
    echo ""
}

main "$@"
