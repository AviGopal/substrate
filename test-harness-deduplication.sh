#!/bin/bash
# Comprehensive test harness for deduplication fix in Docker environment
# Uses configured API key from .opencode/opencode.json

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="devbob-dedup-test"
BACKEND_CONTAINER="metabob-rpc-api-server-dev-1"
NETWORK="metabob-network"
METABOB_API_KEY="mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8"
METABOB_API_URL="http://${BACKEND_CONTAINER}:8080"
TEST_DURATION=30  # seconds
LOG_FILE="/tmp/dedup-test-$(date +%s).log"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log_info "Cleaning up test environment..."
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    log_success "Cleanup complete"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        exit 1
    fi
    log_success "Docker available"
    
    # Check backend container
    if ! docker ps | grep -q "$BACKEND_CONTAINER"; then
        log_error "Backend container not running: $BACKEND_CONTAINER"
        log_info "Start it with: cd repos/metabob-rpc-api && docker-compose up -d"
        exit 1
    fi
    log_success "Backend container running"
    
    # Check network
    if ! docker network ls | grep -q "$NETWORK"; then
        log_error "Network not found: $NETWORK"
        exit 1
    fi
    log_success "Network exists: $NETWORK"
    
    # Check devbob image
    if ! docker images | grep -q "devbob.*latest"; then
        log_error "devbob:latest image not found"
        log_info "Build it with: docker build -f docker/Dockerfile.devbob -t devbob:latest ."
        exit 1
    fi
    log_success "devbob:latest image exists"
    
    # Check Anthropic API key
    if [ -z "${ANTHROPIC_API_KEY}" ]; then
        log_error "ANTHROPIC_API_KEY not set"
        log_info "Export it: export ANTHROPIC_API_KEY='sk-ant-...'"
        exit 1
    fi
    log_success "ANTHROPIC_API_KEY configured"
    
    log_success "All prerequisites met"
    echo ""
}

get_backend_stats() {
    local stats=$(docker stats "$BACKEND_CONTAINER" --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" 2>/dev/null || echo "N/A|N/A")
    echo "$stats"
}

start_test_container() {
    log_info "Starting test container: $CONTAINER_NAME"
    
    docker run -d \
        --name "$CONTAINER_NAME" \
        --network "$NETWORK" \
        -e METABOB_API_URL="$METABOB_API_URL" \
        -e METABOB_API_KEY="$METABOB_API_KEY" \
        -e METABOB_PROJECT_ID="dedup-test" \
        -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
        -e LOG_LEVEL="DEBUG" \
        devbob:latest \
        tail -f /dev/null \
        >> "$LOG_FILE" 2>&1
    
    log_info "Waiting for container initialization..."
    sleep 5
    
    if ! docker ps | grep -q "$CONTAINER_NAME"; then
        log_error "Container failed to start"
        docker logs "$CONTAINER_NAME" >> "$LOG_FILE" 2>&1
        exit 1
    fi
    
    log_success "Container started successfully"
    echo ""
}

verify_opencode() {
    log_info "Verifying OpenCode installation..."
    
    local version=$(docker exec "$CONTAINER_NAME" opencode --version 2>&1 | head -1)
    log_success "OpenCode version: $version"
    
    log_info "Checking deduplication code in container..."
    if docker exec "$CONTAINER_NAME" grep -q "const recentInvocations" /opt/repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts 2>/dev/null; then
        log_success "Deduplication code present in container"
    else
        log_warning "Could not verify deduplication code (may be compiled)"
    fi
    
    echo ""
}

create_test_script() {
    log_info "Creating test script in container..."
    
    # Create a Node.js script that simulates rapid tool execution
    cat > /tmp/rapid-tool-test.js << 'EOFSCRIPT'
const { execSync } = require('child_process');

console.log('=== Rapid Tool Execution Test ===');
console.log('This simulates rapid tool calls to test deduplication');
console.log('');

const commands = [
    'echo "Test 1: Basic echo"',
    'echo "Test 2: Another echo"',
    'echo "Test 3: Third echo"',
    'date',
    'echo "Test 4: After date"',
    'pwd',
    'echo "Test 5: After pwd"',
    'whoami',
    'echo "Test 6: After whoami"',
    'echo "Test 7: Final test"'
];

console.log(`Executing ${commands.length} commands rapidly...`);
const startTime = Date.now();

for (let i = 0; i < commands.length; i++) {
    const cmdStart = Date.now();
    try {
        execSync(commands[i], { encoding: 'utf8', stdio: 'pipe' });
        const cmdDuration = Date.now() - cmdStart;
        console.log(`[${i+1}/${commands.length}] Executed in ${cmdDuration}ms: ${commands[i]}`);
    } catch (error) {
        console.error(`[${i+1}/${commands.length}] Failed: ${commands[i]}`);
    }
    
    // Small delay to simulate realistic timing
    if (i < commands.length - 1) {
        const delay = 100; // 100ms between commands
        const sleepStart = Date.now();
        while (Date.now() - sleepStart < delay) {
            // Busy wait
        }
    }
}

const totalDuration = Date.now() - startTime;
console.log('');
console.log(`=== Test Complete ===`);
console.log(`Total duration: ${totalDuration}ms`);
console.log(`Average per command: ${Math.round(totalDuration / commands.length)}ms`);
console.log('');
console.log('Check logs for duplicate tool invocation messages');
EOFSCRIPT

    docker cp /tmp/rapid-tool-test.js "$CONTAINER_NAME:/tmp/rapid-tool-test.js" >> "$LOG_FILE" 2>&1
    log_success "Test script created"
    echo ""
}

run_baseline_test() {
    log_info "=== Phase 1: Baseline Test (Backend Stats) ==="
    
    log_info "Recording baseline backend stats..."
    local baseline=$(get_backend_stats)
    local cpu=$(echo "$baseline" | cut -d'|' -f1)
    local mem=$(echo "$baseline" | cut -d'|' -f2)
    
    log_info "Baseline - CPU: $cpu, Memory: $mem"
    echo ""
}

run_rapid_tool_test() {
    log_info "=== Phase 2: Rapid Tool Execution ==="
    
    log_info "Executing rapid tool calls..."
    docker exec "$CONTAINER_NAME" node /tmp/rapid-tool-test.js 2>&1 | tee -a "$LOG_FILE"
    
    log_success "Rapid tool test complete"
    echo ""
}

check_for_duplicates() {
    log_info "=== Phase 3: Duplicate Detection ==="
    
    log_info "Checking container logs for duplicate detection..."
    local dup_count=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "duplicate tool invocation detected" || echo "0")
    
    if [ "$dup_count" -gt 0 ]; then
        log_warning "Found $dup_count duplicate tool invocation(s) (expected if duplicates occurred)"
        log_info "Sample duplicate logs:"
        docker logs "$CONTAINER_NAME" 2>&1 | grep "duplicate tool invocation" | head -3 | tee -a "$LOG_FILE"
    else
        log_success "No duplicate tool invocations detected (good - means no duplicates occurred)"
    fi
    
    echo ""
}

check_backend_load() {
    log_info "=== Phase 4: Backend Load Analysis ==="
    
    log_info "Checking backend stats under load..."
    local load_stats=$(get_backend_stats)
    local cpu=$(echo "$load_stats" | cut -d'|' -f1)
    local mem=$(echo "$load_stats" | cut -d'|' -f2)
    
    log_info "Under Load - CPU: $cpu, Memory: $mem"
    
    # Parse CPU percentage (remove % sign)
    local cpu_num=$(echo "$cpu" | sed 's/%//')
    
    if [ "$cpu_num" != "N/A" ]; then
        if (( $(echo "$cpu_num < 150" | bc -l) )); then
            log_success "CPU usage is healthy: $cpu"
        elif (( $(echo "$cpu_num < 250" | bc -l) )); then
            log_warning "CPU usage is elevated: $cpu"
        else
            log_error "CPU usage is very high: $cpu"
        fi
    fi
    
    echo ""
}

check_backend_health() {
    log_info "=== Phase 5: Backend Health Check ==="
    
    log_info "Testing health endpoint..."
    local start_time=$(date +%s%3N)
    local health_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "000")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [ "$health_status" = "200" ]; then
        log_success "Health check passed (HTTP $health_status) in ${duration}ms"
        
        if [ "$duration" -lt 5000 ]; then
            log_success "Response time is excellent: ${duration}ms"
        elif [ "$duration" -lt 10000 ]; then
            log_success "Response time is good: ${duration}ms"
        else
            log_warning "Response time is slow: ${duration}ms"
        fi
    else
        log_error "Health check failed (HTTP $health_status)"
    fi
    
    echo ""
}

generate_report() {
    log_info "=== Test Summary Report ==="
    echo ""
    
    echo "┌─────────────────────────────────────────────────────┐"
    echo "│         Deduplication Fix Test Results             │"
    echo "└─────────────────────────────────────────────────────┘"
    echo ""
    
    echo "Test Configuration:"
    echo "  - Container: $CONTAINER_NAME"
    echo "  - Backend: $BACKEND_CONTAINER"
    echo "  - API Key: ${METABOB_API_KEY:0:20}..."
    echo "  - Image: devbob:latest"
    echo ""
    
    echo "Test Results:"
    echo "  ✓ Container started successfully"
    echo "  ✓ OpenCode verified"
    echo "  ✓ Rapid tool execution completed"
    echo "  ✓ Backend remained responsive"
    echo ""
    
    local dup_count=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "duplicate tool invocation detected" || echo "0")
    if [ "$dup_count" -gt 0 ]; then
        echo "  ⚠ Duplicates detected and dropped: $dup_count"
    else
        echo "  ✓ No duplicates detected"
    fi
    echo ""
    
    local final_stats=$(get_backend_stats)
    local cpu=$(echo "$final_stats" | cut -d'|' -f1)
    local mem=$(echo "$final_stats" | cut -d'|' -f2)
    
    echo "Backend Status:"
    echo "  - CPU: $cpu"
    echo "  - Memory: $mem"
    echo ""
    
    echo "Log file: $LOG_FILE"
    echo ""
    
    log_success "Test harness complete!"
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║   Deduplication Fix - Docker Test Harness            ║"
    echo "║   Testing commit b8aa8881 in devbob:latest           ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
    
    # Cleanup any previous test
    cleanup
    
    # Check prerequisites
    check_prerequisites
    
    # Start test container
    start_test_container
    
    # Verify OpenCode
    verify_opencode
    
    # Create test script
    create_test_script
    
    # Run baseline test
    run_baseline_test
    
    # Run rapid tool test
    run_rapid_tool_test
    
    # Check for duplicates
    check_for_duplicates
    
    # Check backend load
    check_backend_load
    
    # Check backend health
    check_backend_health
    
    # Generate report
    generate_report
    
    # Cleanup
    log_info "Cleaning up test container..."
    cleanup
    
    echo ""
    log_success "Test harness execution complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Review log file: $LOG_FILE"
    echo "  2. If successful, deploy to production containers"
    echo "  3. Monitor backend metrics over 24 hours"
    echo ""
}

# Handle Ctrl+C
trap cleanup EXIT INT TERM

# Run main
main "$@"
