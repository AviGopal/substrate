#!/bin/bash

# Autonomous Activity Scheduler
# Executes activities based on schedules defined in schedules/autonomous-development-schedule.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCHEDULE_FILE="$PROJECT_DIR/schedules/autonomous-development-schedule.json"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/scheduler.pid"
LOG_FILE="$LOG_DIR/scheduler.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Install with: sudo apt-get install jq"
    exit 1
fi

# Check if schedule file exists
if [ ! -f "$SCHEDULE_FILE" ]; then
    log_error "Schedule file not found: $SCHEDULE_FILE"
    exit 1
fi

# Parse cron schedule and determine if it should run now
should_run_now() {
    local schedule="$1"
    local current_minute=$(date '+%M')
    local current_hour=$(date '+%H')
    local current_day=$(date '+%d')
    local current_month=$(date '+%m')
    local current_weekday=$(date '+%u')  # 1-7 (Monday-Sunday)

    # Parse cron format: minute hour day month weekday
    IFS=' ' read -r minute hour day month weekday <<< "$schedule"

    # Check minute
    if [ "$minute" != "*" ] && [ "$minute" != "*/$((current_minute))" ]; then
        if [[ "$minute" == *"/"* ]]; then
            local interval="${minute#*/}"
            if [ $((current_minute % interval)) -ne 0 ]; then
                return 1
            fi
        elif [ "$minute" != "$current_minute" ]; then
            return 1
        fi
    fi

    # Check hour
    if [ "$hour" != "*" ] && [ "$hour" != "*/$((current_hour))" ]; then
        if [[ "$hour" == *"/"* ]]; then
            local interval="${hour#*/}"
            if [ $((current_hour % interval)) -ne 0 ]; then
                return 1
            fi
        elif [ "$hour" != "$current_hour" ]; then
            return 1
        fi
    fi

    # Check day
    if [ "$day" != "*" ] && [ "$day" != "$current_day" ]; then
        return 1
    fi

    # Check month
    if [ "$month" != "*" ] && [ "$month" != "$current_month" ]; then
        return 1
    fi

    # Check weekday
    if [ "$weekday" != "*" ] && [ "$weekday" != "$current_weekday" ]; then
        return 1
    fi

    return 0
}

# Execute a scheduled activity
execute_activity() {
    local schedule_id="$1"
    local activity="$2"
    local parameters="$3"
    local on_success="$4"
    local on_failure="$5"

    log "Executing scheduled activity: $schedule_id ($activity)"

    # Build MiniBob command
    local cmd="minibob --single \"Execute $activity"

    # Add parameters if provided
    if [ "$parameters" != "null" ]; then
        # Extract parameters and format them
        local repo_path=$(echo "$parameters" | jq -r '.repository_path // empty')
        local target_files=$(echo "$parameters" | jq -r '.target_files // empty')
        local output_path=$(echo "$parameters" | jq -r '.output_path // empty')

        if [ -n "$repo_path" ]; then
            cmd="$cmd on repository $repo_path"
        fi

        if [ -n "$target_files" ]; then
            cmd="$cmd with target_files $target_files"
        fi

        if [ -n "$output_path" ]; then
            cmd="$cmd and output_path $output_path"
        fi
    fi

    cmd="$cmd\""

    # Execute activity
    local start_time=$(date +%s)
    local result_file="$PROJECT_DIR/results/scheduler/${schedule_id}-$(date +%Y%m%d-%H%M%S).json"
    mkdir -p "$(dirname "$result_file")"

    if eval "$cmd" > "$result_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "✓ Activity completed successfully in ${duration}s: $schedule_id"

        # Handle on_success actions
        if [ "$on_success" != "null" ]; then
            handle_success_actions "$on_success" "$result_file"
        fi

        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_error "✗ Activity failed after ${duration}s: $schedule_id"

        # Handle on_failure actions
        if [ "$on_failure" != "null" ]; then
            handle_failure_actions "$on_failure" "$result_file"
        fi

        return 1
    fi
}

# Handle success actions
handle_success_actions() {
    local actions="$1"
    local result_file="$2"

    # Check if should commit changes
    local commit_changes=$(echo "$actions" | jq -r '.commit_changes // false')
    if [ "$commit_changes" = "true" ]; then
        log "Committing changes from successful execution..."
        cd "$PROJECT_DIR"
        if git diff --quiet; then
            log_warning "No changes to commit"
        else
            git add src/ tests/ 2>/dev/null || true
            git commit -m "feat(autonomous): apply quality improvements

Autonomous execution via scheduler

Result: $result_file

Co-Authored-By: MiniBob <minibob@metabob.com>" || log_warning "Commit failed"
        fi
    fi

    # Check if should create PR
    local create_pr=$(echo "$actions" | jq -r '.create_pr // false')
    if [ "$create_pr" = "true" ]; then
        log "Creating pull request..."
        # This would integrate with gh CLI if available
        if command -v gh &> /dev/null; then
            gh pr create --title "Autonomous improvements - $(date +%Y-%m-%d)" \
                --body "Automated quality improvements from scheduler" || log_warning "PR creation failed"
        else
            log_warning "gh CLI not installed, skipping PR creation"
        fi
    fi
}

# Handle failure actions
handle_failure_actions() {
    local actions="$1"
    local result_file="$2"

    # Check if should create issue
    local create_issue=$(echo "$actions" | jq -r '.create_issue // false')
    if [ "$create_issue" = "true" ]; then
        log "Creating issue for failure..."
        if command -v gh &> /dev/null; then
            gh issue create --title "Scheduled activity failed - $(date +%Y-%m-%d)" \
                --body "Activity execution failed. See: $result_file" || log_warning "Issue creation failed"
        fi
    fi

    # Check if should trigger recovery
    local trigger=$(echo "$actions" | jq -r '.trigger // empty')
    if [ -n "$trigger" ]; then
        log "Triggering recovery workflow: $trigger"
        # This would execute the recovery workflow
        if [ "$trigger" = "chaos-recovery-workflow" ]; then
            "$SCRIPT_DIR/run-chaos-test.sh" auto-recover || log_warning "Recovery failed"
        fi
    fi
}

# Main scheduler loop
run_scheduler() {
    log "Starting autonomous activity scheduler..."
    log "Schedule file: $SCHEDULE_FILE"
    log "Checking schedules every minute..."

    while true; do
        # Read all enabled schedules
        local schedules=$(jq -c '.schedules[] | select(.enabled == true)' "$SCHEDULE_FILE")

        while IFS= read -r schedule_obj; do
            local schedule_id=$(echo "$schedule_obj" | jq -r '.id')
            local activity=$(echo "$schedule_obj" | jq -r '.activity')
            local schedule=$(echo "$schedule_obj" | jq -r '.schedule')
            local parameters=$(echo "$schedule_obj" | jq -c '.parameters')
            local conditions=$(echo "$schedule_obj" | jq -c '.conditions // {}')
            local on_success=$(echo "$schedule_obj" | jq -c '.on_success // null')
            local on_failure=$(echo "$schedule_obj" | jq -c '.on_failure // null')

            # Skip git trigger schedules
            if [[ "$schedule" == git-* ]]; then
                continue
            fi

            # Check if schedule matches current time
            if should_run_now "$schedule"; then
                # Check conditions
                local should_skip=false

                # Check only_if_changes condition
                local only_if_changes=$(echo "$conditions" | jq -r '.only_if_changes // false')
                if [ "$only_if_changes" = "true" ]; then
                    cd "$PROJECT_DIR"
                    if git diff --quiet && git diff --cached --quiet; then
                        log "Skipping $schedule_id: no changes detected"
                        should_skip=true
                    fi
                fi

                if [ "$should_skip" = "false" ]; then
                    execute_activity "$schedule_id" "$activity" "$parameters" "$on_success" "$on_failure" &
                fi
            fi
        done <<< "$schedules"

        # Wait 60 seconds before next check
        sleep 60
    done
}

# Start scheduler as daemon
start_daemon() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_error "Scheduler already running with PID: $pid"
            exit 1
        else
            log_warning "Removing stale PID file"
            rm "$PID_FILE"
        fi
    fi

    log "Starting scheduler daemon..."
    run_scheduler >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    log_success "Scheduler started with PID: $(cat "$PID_FILE")"
    log "Log file: $LOG_FILE"
}

# Stop scheduler daemon
stop_daemon() {
    if [ ! -f "$PID_FILE" ]; then
        log_error "Scheduler is not running (no PID file)"
        exit 1
    fi

    local pid=$(cat "$PID_FILE")
    if ! ps -p "$pid" > /dev/null 2>&1; then
        log_error "Scheduler is not running (process not found)"
        rm "$PID_FILE"
        exit 1
    fi

    log "Stopping scheduler (PID: $pid)..."
    kill "$pid"
    rm "$PID_FILE"
    log_success "Scheduler stopped"
}

# Show scheduler status
show_status() {
    if [ ! -f "$PID_FILE" ]; then
        log_warning "Scheduler is not running"
        exit 0
    fi

    local pid=$(cat "$PID_FILE")
    if ps -p "$pid" > /dev/null 2>&1; then
        log_success "Scheduler is running (PID: $pid)"
        log "Log file: $LOG_FILE"
        log "Last 10 lines:"
        tail -10 "$LOG_FILE"
    else
        log_error "Scheduler is not running (stale PID file)"
        rm "$PID_FILE"
        exit 1
    fi
}

# Run a specific schedule once
run_once() {
    local schedule_id="$1"

    log "Running schedule once: $schedule_id"

    local schedule_obj=$(jq -c ".schedules[] | select(.id == \"$schedule_id\")" "$SCHEDULE_FILE")

    if [ -z "$schedule_obj" ]; then
        log_error "Schedule not found: $schedule_id"
        exit 1
    fi

    local activity=$(echo "$schedule_obj" | jq -r '.activity')
    local parameters=$(echo "$schedule_obj" | jq -c '.parameters')
    local on_success=$(echo "$schedule_obj" | jq -c '.on_success // null')
    local on_failure=$(echo "$schedule_obj" | jq -c '.on_failure // null')

    execute_activity "$schedule_id" "$activity" "$parameters" "$on_success" "$on_failure"
}

# Main command dispatcher
case "${1:-}" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    restart)
        stop_daemon
        sleep 2
        start_daemon
        ;;
    status)
        show_status
        ;;
    run)
        if [ -z "${2:-}" ]; then
            log_error "Usage: $0 run <schedule-id>"
            exit 1
        fi
        run_once "$2"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|run <schedule-id>}"
        echo ""
        echo "Commands:"
        echo "  start   - Start scheduler daemon"
        echo "  stop    - Stop scheduler daemon"
        echo "  restart - Restart scheduler daemon"
        echo "  status  - Show scheduler status"
        echo "  run     - Run a specific schedule once"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 status"
        echo "  $0 run continuous-quality-enforcement"
        exit 1
        ;;
esac
