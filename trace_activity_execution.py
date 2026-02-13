#!/usr/bin/env python3
"""
Trace Activity Execution - Observes execution flow with structured logging
"""

import asyncio
import json
import logging
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime

# Setup structured JSON logging to stdout
json_handler = logging.StreamHandler(sys.stdout)
json_handler.setLevel(logging.INFO)
json_handler.setFormatter(logging.Formatter("%(message)s"))

logger = logging.getLogger(__name__)
logger.addHandler(json_handler)
logger.setLevel(logging.INFO)
logger.propagate = False  # Don't send to root logger

from metabob_cli.core.file_state import FileStateManager
from metabob_cli.mcp.activity_manager import get_activity_manager


def log_trace(trace_id: str, event: str, **kwargs):
    """Emit structured trace log"""
    log_entry = {
        "trace_id": trace_id,
        "event": event,
        "timestamp": datetime.utcnow().isoformat(),
        **kwargs,
    }
    logger.info(json.dumps(log_entry))


async def trace_execution():
    """Execute activity with full tracing"""

    trace_id = uuid.uuid4().hex[:8]
    log_trace(trace_id, "trace_start", message="Starting traced activity execution")

    # Load session token
    state_file = Path(".metabob/state")
    state_mgr = FileStateManager(state_file)
    session_token = state_mgr.get_session_token()

    if not session_token:
        log_trace(trace_id, "error", message="No session token found")
        return

    log_trace(trace_id, "session_loaded", has_token=True)

    # Get activity manager
    mgr = get_activity_manager("http://localhost:8080", session_token)
    log_trace(trace_id, "manager_created", base_url="http://localhost:8080")

    # Configuration
    template_id = "infrastructure-51aee5c8"  # Our proof template
    session_id = f"trace-session-{trace_id}"
    variables = {"name": f"Trace Test {trace_id}"}

    log_trace(
        trace_id,
        "execution_config",
        template_id=template_id,
        session_id=session_id,
        variables=variables,
    )

    # Start execution
    log_trace(trace_id, "calling_start_execution")
    start_time = time.time()

    try:
        result = await mgr.start_execution(
            activity_id=template_id, variables=variables, session_id=session_id
        )

        start_duration = (time.time() - start_time) * 1000
        log_trace(
            trace_id,
            "execution_started",
            execution_id=result["execution_id"],
            status=result["status"],
            duration_ms=start_duration,
        )

        exec_id = result["execution_id"]

        # Get first step
        log_trace(trace_id, "calling_get_next_step", execution_id=exec_id)
        step_time = time.time()

        step_result = await mgr.get_next_step(exec_id)
        step_duration = (time.time() - step_time) * 1000

        if "error" in step_result:
            log_trace(
                trace_id,
                "get_step_error",
                execution_id=exec_id,
                error=step_result["error"],
            )
            return

        if "complete" in step_result:
            log_trace(
                trace_id,
                "already_complete",
                execution_id=exec_id,
                message=step_result.get("message"),
            )
            return

        step_data = step_result["current_step"]
        log_trace(
            trace_id,
            "step_fetched",
            execution_id=exec_id,
            step_id=step_data["step_id"],
            step_index=step_result["step_index"],
            total_steps=step_result["total_steps"],
            duration_ms=step_duration,
        )

        # Report step result
        log_trace(trace_id, "calling_report_step_result", execution_id=exec_id)
        report_time = time.time()

        output = f"Hello {variables['name']}, welcome to the system!"
        await mgr.report_step_result(
            execution_id=exec_id,
            step_id=step_data["step_id"],
            success=True,
            output=output,
            cost=0.01,
            tokens=50,
        )

        report_duration = (time.time() - report_time) * 1000
        log_trace(
            trace_id,
            "step_reported",
            execution_id=exec_id,
            step_id=step_data["step_id"],
            success=True,
            duration_ms=report_duration,
        )

        # Check completion
        log_trace(trace_id, "calling_check_completion", execution_id=exec_id)
        completion_time = time.time()

        next_step = await mgr.get_next_step(exec_id)
        completion_duration = (time.time() - completion_time) * 1000

        if next_step.get("complete"):
            log_trace(
                trace_id,
                "execution_completed",
                execution_id=exec_id,
                message=next_step.get("message"),
                duration_ms=completion_duration,
                total_duration_ms=(time.time() - start_time) * 1000,
            )
        else:
            log_trace(
                trace_id,
                "more_steps_remain",
                execution_id=exec_id,
                next_step_index=next_step.get("step_index"),
            )

        log_trace(
            trace_id,
            "trace_complete",
            success=True,
            total_duration_ms=(time.time() - start_time) * 1000,
        )

    except Exception as e:
        log_trace(trace_id, "trace_error", error=str(e), error_type=type(e).__name__)
        raise


def main():
    """Run traced execution"""
    print("=" * 80, file=sys.stderr)
    print("Activity Execution Tracer", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print("", file=sys.stderr)
    print("Trace logs (JSON) will be written to stdout", file=sys.stderr)
    print("Progress messages will be written to stderr", file=sys.stderr)
    print("", file=sys.stderr)
    print("To collect trace:", file=sys.stderr)
    print(
        "  python3 trace_activity_execution.py > execution_trace.jsonl", file=sys.stderr
    )
    print("", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print("", file=sys.stderr)

    asyncio.run(trace_execution())

    print("", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print("Trace complete! Check execution_trace.jsonl", file=sys.stderr)
    print("=" * 80, file=sys.stderr)


if __name__ == "__main__":
    main()
