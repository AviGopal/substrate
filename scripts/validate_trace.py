#!/usr/bin/env python3
"""
Validate activity execution trace against expected data flow.

This script:
1. Loads trace log (JSONL format)
2. Verifies sequence of events matches expected flow
3. Checks data consistency (execution_id, trace_id propagation)
4. Validates state transitions (step_index increments)
5. Confirms deterministic markers exist
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class TraceEvent:
    """Structured trace event."""

    timestamp: str
    type: str
    data: Dict[str, Any]


class TraceValidator:
    """Validates activity execution traces."""

    def __init__(self, trace_file: Path, trace_id: str):
        self.trace_file = trace_file
        self.trace_id = trace_id
        self.events: List[TraceEvent] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def load_trace(self) -> bool:
        """Load trace events from JSONL file."""
        if not self.trace_file.exists():
            self.errors.append(f"Trace file not found: {self.trace_file}")
            return False

        try:
            with open(self.trace_file) as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        event = TraceEvent(
                            timestamp=data.get("timestamp", ""),
                            type=data.get("type", "unknown"),
                            data=data,
                        )
                        self.events.append(event)
                    except json.JSONDecodeError as e:
                        self.warnings.append(f"Line {line_num}: Invalid JSON - {e}")

            print(f"✅ Loaded {len(self.events)} trace events")
            return True

        except Exception as e:
            self.errors.append(f"Failed to load trace: {e}")
            return False

    def check_execution_sequence(self) -> bool:
        """Verify events appear in expected order."""
        print("\n🔍 Checking execution sequence...")

        expected_sequence = [
            ("mcp_call", "start_activity_execution"),
            ("backend_call", "/v2/activities/record/start"),
            ("state_change", "execution_started"),
            ("mcp_call", "get_next_step"),
            ("mcp_call", "report_step_result"),
            ("backend_call", "/v2/activities/record/step"),
        ]

        # Find first occurrence of each expected event
        found_indices = []
        for exp_type, exp_detail in expected_sequence:
            for i, event in enumerate(self.events):
                if event.type == exp_type:
                    # Check detail match
                    if exp_type == "mcp_call":
                        if event.data.get("tool") == exp_detail:
                            found_indices.append((i, exp_type, exp_detail))
                            break
                    elif exp_type == "backend_call":
                        if exp_detail in event.data.get("path", ""):
                            found_indices.append((i, exp_type, exp_detail))
                            break
                    elif exp_type == "state_change":
                        if event.data.get("field") == exp_detail:
                            found_indices.append((i, exp_type, exp_detail))
                            break

        # Verify order
        if len(found_indices) < len(expected_sequence):
            missing = len(expected_sequence) - len(found_indices)
            self.errors.append(f"Missing {missing} expected events in sequence")
            return False

        # Check indices are monotonically increasing
        indices = [i for i, _, _ in found_indices]
        if indices != sorted(indices):
            self.errors.append(f"Events out of order: {found_indices}")
            return False

        print(f"   ✅ Sequence correct ({len(found_indices)} key events)")
        return True

    def check_execution_id_consistency(self) -> bool:
        """Verify execution_id appears consistently."""
        print("\n🔍 Checking execution_id consistency...")

        execution_ids = set()
        for event in self.events:
            if "execution_id" in event.data:
                execution_ids.add(event.data["execution_id"])

        if len(execution_ids) == 0:
            self.errors.append("No execution_id found in any event")
            return False

        if len(execution_ids) > 1:
            self.errors.append(f"Multiple execution_ids found: {execution_ids}")
            return False

        exec_id = list(execution_ids)[0]
        print(f"   ✅ Consistent execution_id: {exec_id}")
        return True

    def check_step_progression(self) -> bool:
        """Verify step_index increments correctly."""
        print("\n🔍 Checking step progression...")

        step_transitions = []
        for event in self.events:
            if (
                event.type == "state_change"
                and event.data.get("field") == "current_step_index"
            ):
                from_val = event.data.get("from")
                to_val = event.data.get("to")
                step_transitions.append((from_val, to_val))

        if not step_transitions:
            self.warnings.append(
                "No step transitions recorded (may not be instrumented)"
            )
            return True  # Not a failure, just not instrumented

        # Verify transitions are consecutive
        for i, (from_val, to_val) in enumerate(step_transitions):
            if to_val != from_val + 1:
                self.errors.append(
                    f"Step transition {i}: {from_val} → {to_val} (not consecutive)"
                )
                return False

        print(f"   ✅ Step progression correct ({len(step_transitions)} transitions)")
        return True

    def check_deterministic_markers(self) -> bool:
        """Verify trace marker file exists with expected content."""
        print("\n🔍 Checking deterministic markers...")

        marker_file = Path(f"/tmp/trace-marker-{self.trace_id}.txt")

        if not marker_file.exists():
            self.errors.append(f"Marker file not found: {marker_file}")
            return False

        content = marker_file.read_text()
        lines = content.strip().split("\n")

        # Should have 2 lines: trace_id + timestamp
        if len(lines) != 2:
            self.errors.append(f"Marker file should have 2 lines, found {len(lines)}")
            return False

        # First line should match trace_id
        if lines[0] != self.trace_id:
            self.errors.append(
                f"First line should be '{self.trace_id}', got '{lines[0]}'"
            )
            return False

        # Second line should be a timestamp (just check it's numeric)
        try:
            int(lines[1])
        except ValueError:
            self.errors.append(f"Second line should be timestamp, got '{lines[1]}'")
            return False

        print(f"   ✅ Marker file valid: {marker_file}")
        print(f"      Line 1: {lines[0]}")
        print(f"      Line 2: {lines[1]} (timestamp)")
        return True

    def check_trace_id_propagation(self) -> bool:
        """Verify trace_id appears in relevant events."""
        print("\n🔍 Checking trace_id propagation...")

        trace_id_count = 0
        for event in self.events:
            # Check in variables, args, context
            if self.trace_id in str(event.data):
                trace_id_count += 1

        if trace_id_count == 0:
            self.errors.append(f"trace_id '{self.trace_id}' not found in any event")
            return False

        print(f"   ✅ trace_id appears in {trace_id_count} events")
        return True

    def validate(self) -> bool:
        """Run all validation checks."""
        print("=" * 70)
        print("Trace Validation")
        print("=" * 70)
        print(f"Trace file: {self.trace_file}")
        print(f"Trace ID: {self.trace_id}")

        # Load trace
        if not self.load_trace():
            return False

        # Run checks
        checks = [
            ("Execution Sequence", self.check_execution_sequence),
            ("Execution ID Consistency", self.check_execution_id_consistency),
            ("Step Progression", self.check_step_progression),
            ("Deterministic Markers", self.check_deterministic_markers),
            ("Trace ID Propagation", self.check_trace_id_propagation),
        ]

        results = []
        for name, check_fn in checks:
            try:
                result = check_fn()
                results.append((name, result))
            except Exception as e:
                self.errors.append(f"{name} check failed with exception: {e}")
                results.append((name, False))

        # Print summary
        print("\n" + "=" * 70)
        print("Validation Summary")
        print("=" * 70)

        passed = sum(1 for _, result in results if result)
        total = len(results)

        for name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {name}")

        if self.warnings:
            print(f"\n⚠️  {len(self.warnings)} warnings:")
            for warning in self.warnings:
                print(f"   - {warning}")

        if self.errors:
            print(f"\n❌ {len(self.errors)} errors:")
            for error in self.errors:
                print(f"   - {error}")

        print(f"\nResult: {passed}/{total} checks passed")

        return passed == total

    def cleanup(self):
        """Clean up test artifacts."""
        marker_file = Path(f"/tmp/trace-marker-{self.trace_id}.txt")
        if marker_file.exists():
            marker_file.unlink()
            print(f"🧹 Cleaned up: {marker_file}")


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: validate_trace.py <trace_file.jsonl> [--trace-id <id>] [--cleanup]"
        )
        print("\nExample:")
        print("  validate_trace.py trace-abc123.jsonl --trace-id abc123")
        sys.exit(1)

    trace_file = Path(sys.argv[1])

    # Parse args
    trace_id = None
    cleanup = False
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--trace-id" and i + 1 < len(sys.argv):
            trace_id = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--cleanup":
            cleanup = True
            i += 1
        else:
            i += 1

    # Extract trace_id from filename if not provided
    if not trace_id:
        # Expect format: trace-<id>.jsonl
        stem = trace_file.stem  # Remove .jsonl
        if stem.startswith("trace-"):
            trace_id = stem[6:]  # Remove "trace-" prefix

    if not trace_id:
        print("❌ Could not determine trace_id. Provide with --trace-id")
        sys.exit(1)

    # Validate
    validator = TraceValidator(trace_file, trace_id)
    success = validator.validate()

    # Cleanup if requested
    if cleanup:
        validator.cleanup()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
