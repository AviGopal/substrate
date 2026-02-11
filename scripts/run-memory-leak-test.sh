#!/usr/bin/env bash
# Master Memory Leak Test Orchestrator
# Starts monitoring and runs activity tests to trigger memory issues

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$BASE_DIR/.memory-profiles"
CONTAINER_NAME="devbob-opencode"

# Create log directory
mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  # Check docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi
  
  # Check if container exists
  if ! docker ps -a --filter "name=$CONTAINER_NAME" | grep -q "$CONTAINER_NAME"; then
    log_error "Container $CONTAINER_NAME not found"
    log_info "Available containers:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}"
    exit 1
  fi
  
  # Check if container is running
  if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
    log_warning "Container $CONTAINER_NAME is not running"
    log_info "Starting container..."
    docker start "$CONTAINER_NAME" || {
      log_error "Failed to start container"
      exit 1
    }
    log_info "Waiting 10 seconds for container to be ready..."
    sleep 10
  fi
  
  log_success "Prerequisites OK"
}

# Get current container memory
get_container_memory() {
  docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemUsage}}" 2>/dev/null | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g' || echo "N/A"
}

# Print test banner
print_banner() {
  echo ""
  echo "========================================="
  echo "  MEMORY LEAK DETECTION TEST"
  echo "========================================="
  echo "Container:    $CONTAINER_NAME"
  echo "Log dir:      $LOG_DIR"
  echo "Start time:   $(date)"
  echo "Initial mem:  $(get_container_memory) MB"
  echo "========================================="
  echo ""
}

# Cleanup function
cleanup() {
  log_info "Cleaning up..."
  
  # Kill background processes
  if [[ -n "${MONITOR_PID:-}" ]]; then
    log_info "Stopping memory monitor (PID: $MONITOR_PID)..."
    kill "$MONITOR_PID" 2>/dev/null || true
    wait "$MONITOR_PID" 2>/dev/null || true
  fi
  
  log_success "Cleanup complete"
}

trap cleanup EXIT INT TERM

# Main test execution
main() {
  check_prerequisites
  print_banner
  
  # Start memory monitoring in background
  log_info "Starting memory monitor..."
  "$SCRIPT_DIR/monitor-docker-memory.sh" "$CONTAINER_NAME" 5 &
  MONITOR_PID=$!
  log_success "Memory monitor started (PID: $MONITOR_PID)"
  
  # Give monitor time to start
  sleep 2
  
  # Choose test type
  echo ""
  echo "Select test type:"
  echo "  1) Simple test (basic activity, 100 iterations)"
  echo "  2) Stress test (heavy operations, 50 iterations)"
  echo "  3) Custom iterations"
  echo ""
  read -p "Choice [1]: " TEST_TYPE
  TEST_TYPE=${TEST_TYPE:-1}
  
  case $TEST_TYPE in
    1)
      log_info "Running simple test..."
      ACTIVITY_DIR="$BASE_DIR/.activity-test"
      MAX_ITERATIONS=100
      
      # Create simple activity if not exists
      if [[ ! -f "$ACTIVITY_DIR/01-test.md" ]]; then
        mkdir -p "$ACTIVITY_DIR"
        cat > "$ACTIVITY_DIR/01-test.md" << 'EOFTEMPLATE'
# Simple Test Activity

Create and delete a test file to simulate basic operations.

## Steps

1. Create a test file:
   ```bash
   echo "Test content" > /tmp/simple_test.txt
   ```

2. Read the file:
   ```bash
   cat /tmp/simple_test.txt
   ```

3. Delete the file:
   ```bash
   rm /tmp/simple_test.txt
   ```
EOFTEMPLATE
      fi
      ;;
    
    2)
      log_info "Running stress test..."
      ACTIVITY_DIR="$BASE_DIR/.activity-test-stress"
      MAX_ITERATIONS=50
      
      # Create stress test activity
      "$SCRIPT_DIR/create-stress-test-activity.sh" > /dev/null
      ;;
    
    3)
      read -p "Number of iterations: " MAX_ITERATIONS
      log_info "Running custom test with $MAX_ITERATIONS iterations..."
      ACTIVITY_DIR="$BASE_DIR/.activity-test"
      ;;
    
    *)
      log_error "Invalid choice"
      exit 1
      ;;
  esac
  
  # Run activity iterations
  log_info "Starting activity iterations (max: $MAX_ITERATIONS)..."
  echo ""
  
  ITERATION=0
  FAILURE_COUNT=0
  CRASH_COUNT=0
  
  while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
    ITERATION=$((ITERATION + 1))
    
    echo "[$ITERATION/$MAX_ITERATIONS] $(date '+%H:%M:%S') | Mem: $(get_container_memory) MB"
    
    # Check if container is still running
    if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
      log_error "Container crashed!"
      CRASH_COUNT=$((CRASH_COUNT + 1))
      
      # Capture logs
      log_info "Capturing crash logs..."
      docker logs "$CONTAINER_NAME" --tail 200 > "$LOG_DIR/crash_logs_$(date +%Y%m%d_%H%M%S).log" 2>&1 || true
      
      log_info "Waiting 30s for potential restart..."
      sleep 30
      
      if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
        log_error "Container did not restart. Test stopped."
        break
      else
        log_success "Container restarted, continuing..."
      fi
    fi
    
    # Execute activity
    if docker exec "$CONTAINER_NAME" opencode agent run "$ACTIVITY_DIR" --format json > "$LOG_DIR/output_iter${ITERATION}.json" 2>&1; then
      echo "  ✓ Success"
    else
      echo "  ✗ Failed"
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
      
      # Check if failure threshold exceeded
      if [[ $FAILURE_COUNT -gt 10 ]]; then
        log_error "Too many failures, stopping test"
        break
      fi
    fi
    
    # Small delay between iterations
    sleep 2
  done
  
  # Test summary
  echo ""
  echo "========================================="
  echo "  TEST SUMMARY"
  echo "========================================="
  echo "Iterations:   $ITERATION"
  echo "Failures:     $FAILURE_COUNT"
  echo "Crashes:      $CRASH_COUNT"
  echo "Final mem:    $(get_container_memory) MB"
  echo "End time:     $(date)"
  echo "========================================="
  echo ""
  echo "Review logs in: $LOG_DIR"
  echo ""
  
  # Keep monitor running for a bit to capture final state
  log_info "Monitoring memory for 30 more seconds..."
  sleep 30
  
  log_success "Test complete!"
}

# Run main
main
