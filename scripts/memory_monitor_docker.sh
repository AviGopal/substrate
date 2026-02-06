#!/bin/bash
# Docker Memory Monitor Management Script

# Configuration
MONITOR_SCRIPT="/opt/metabob/memory_monitor.py"
LOG_DIR="/var/log/metabob/memory_monitor"
PID_FILE="/var/run/metabob_memory_monitor.pid"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

start_monitor() {
    if [ -f "$PID_FILE" ]; then
        echo "Memory monitor already running. Use 'restart' to restart."
        exit 1
    fi

    # Start monitor in background
    python3 "$MONITOR_SCRIPT" &
    
    # Capture PID
    echo $! > "$PID_FILE"
    echo "Memory monitor started with PID $(cat "$PID_FILE")"
}

stop_monitor() {
    if [ -f "$PID_FILE" ]; then
        kill -15 "$(cat "$PID_FILE")"
        rm "$PID_FILE"
        echo "Memory monitor stopped"
    else
        echo "No memory monitor process found"
    fi
}

restart_monitor() {
    stop_monitor
    start_monitor
}

status_monitor() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Memory monitor is running (PID: $PID)"
        else
            echo "PID file exists but process not running. Removing PID file."
            rm "$PID_FILE"
        fi
    else
        echo "Memory monitor is not running"
    fi
}

# CLI Interface
case "$1" in 
    start)
        start_monitor
        ;;
    stop)
        stop_monitor
        ;;
    restart)
        restart_monitor
        ;;
    status)
        status_monitor
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
esac

exit 0