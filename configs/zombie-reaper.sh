#!/bin/bash
# =============================================================================
# Zombie Process Reaper
# =============================================================================
# This script runs as PID 1 in the container to reap zombie processes.
# It forwards signals to the child process and waits for it to exit.
#
# Usage: zombie-reaper.sh <command> [args...]
# =============================================================================

# Enable job control
set -m

# Forward signals to child process
trap 'kill -TERM $CHILD_PID 2>/dev/null' SIGTERM SIGINT

# Start the child process in the background
"$@" &
CHILD_PID=$!

# Wait for child to exit, reaping zombies in the meantime
while kill -0 $CHILD_PID 2>/dev/null; do
    # Wait for any child process
    wait -n 2>/dev/null || true
    sleep 1
done

# Get child exit code
wait $CHILD_PID
EXIT_CODE=$?

exit $EXIT_CODE
