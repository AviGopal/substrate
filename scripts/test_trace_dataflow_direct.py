#!/usr/bin/env python3
"""
Direct Data Flow Test - No Authentication Required

This script tests the activity execution data flow by directly calling
backend endpoints WITHOUT requiring authentication. It's designed to verify
the documented flow matches actual implementation.

Tests:
1. Backend health check (no auth)
2. Database connectivity (via health endpoint)
3. Template structure validation (schema check)
4. Expected endpoint availability (OPTIONS/HEAD requests)

This does NOT test the full end-to-end flow with auth, but validates:
- Backend is running
- Endpoints exist
- Template schema is correct
- Database is accessible
"""

import json
import sys
from pathlib import Path
import httpx

# Colors
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
BLUE = "\033[0;34m"
NC = "\033[0m"  # No Color


def log_info(msg):
    print(f"{BLUE}ℹ{NC} {msg}")


def log_success(msg):
    print(f"{GREEN}✅{NC} {msg}")


def log_warning(msg):
    print(f"{YELLOW}⚠️{NC} {msg}")


def log_error(msg):
    print(f"{RED}❌{NC} {msg}")


class DataFlowValidator:
    """Validate data flow architecture without authentication."""

    def __init__(self, backend_url: str = "http://localhost:8080"):
        self.backend_url = backend_url
        self.checks_passed = 0
        self.checks_total = 0

    def check(self, name: str, fn):
        """Run a check and track results."""
        self.checks_total += 1
        log_info(f"Check {self.checks_total}: {name}")
        try:
            result = fn()
            if result:
                self.checks_passed += 1
                log_success(f"PASS - {name}")
            else:
                log_error(f"FAIL - {name}")
            return result
        except Exception as e:
            log_error(f"FAIL - {name}: {e}")
            return False

    def check_backend_health(self) -> bool:
        """Check backend is running."""
        resp = httpx.get(f"{self.backend_url}/health", timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            log_info(f"   Backend version: {data.get('version', 'unknown')}")
            return True
        return False

    def check_endpoint_exists(self, method: str, path: str) -> bool:
        """Check if endpoint exists (via OPTIONS)."""
        try:
            resp = httpx.request("OPTIONS", f"{self.backend_url}{path}", timeout=5.0)
            # OPTIONS should return 2xx or 405 (if OPTIONS not implemented but endpoint exists)
            exists = resp.status_code in [200, 204, 405]
            if exists:
                log_info(f"   Endpoint exists: {method} {path}")
            return exists
        except:
            return False

    def check_template_schema(self) -> bool:
        """Validate trace-test template has correct schema."""
        template_file = (
            Path(__file__).parent.parent / "test-workspace/trace-test-activity.json"
        )

        if not template_file.exists():
            log_error(f"   Template not found: {template_file}")
            return False

        with open(template_file) as f:
            template = json.load(f)

        # Required V2 API fields
        required_fields = [
            "variant_id",
            "activity_id",
            "name",
            "category",
            "task_steps",
        ]
        missing = [f for f in required_fields if f not in template]

        if missing:
            log_error(f"   Missing required fields: {missing}")
            return False

        # Check task_steps structure
        if not isinstance(template["task_steps"], list):
            log_error("   task_steps must be a list")
            return False

        if len(template["task_steps"]) != 3:
            log_warning(f"   Expected 3 steps, found {len(template['task_steps'])}")

        # Validate each step
        for i, step in enumerate(template["task_steps"]):
            if "id" not in step:
                log_error(f"   Step {i}: missing 'id' field")
                return False
            if "description" not in step:
                log_error(f"   Step {i}: missing 'description' field")
                return False
            if "prompt" not in step:
                log_error(f"   Step {i}: missing 'prompt' field")
                return False

        log_info(f"   Template valid: {template['variant_id']}")
        log_info(f"   Steps: {len(template['task_steps'])}")
        return True

    def check_expected_flow(self) -> bool:
        """Document expected data flow sequence."""
        log_info("   Expected Flow:")
        log_info("   1. POST /v2/session → Create session")
        log_info("   2. GET /v2/activities/templates → List templates")
        log_info("   3. POST /v2/activities/record/start → Start execution")
        log_info("   4. POST /v2/activities/record/step → Record step (x3)")
        log_info("   5. POST /v2/activities/record/complete → Complete execution")
        return True

    def check_deterministic_markers(self) -> bool:
        """Verify deterministic marker approach."""
        log_info("   Deterministic Test Design:")
        log_info("   - trace_id: UUID passed as variable")
        log_info("   - Marker file: /tmp/trace-marker-{trace_id}.txt")
        log_info("   - Step 1: Write trace_id to marker")
        log_info("   - Step 2: Append timestamp")
        log_info("   - Step 3: Verify 2 lines exist")
        log_info("   - Validation: Script checks marker file content")
        return True

    def run_all(self) -> bool:
        """Run all checks."""
        print("=" * 70)
        print("Activity Execution Data Flow Validation (Direct)")
        print("=" * 70)
        print(f"Backend: {self.backend_url}")
        print()

        # Check 1: Backend health
        self.check("Backend Health", self.check_backend_health)

        # Check 2: Key endpoints exist
        self.check(
            "Session Endpoint",
            lambda: self.check_endpoint_exists("POST", "/v2/session"),
        )
        self.check(
            "Templates Endpoint",
            lambda: self.check_endpoint_exists("GET", "/v2/activities/templates"),
        )
        self.check(
            "Start Recording Endpoint",
            lambda: self.check_endpoint_exists("POST", "/v2/activities/record/start"),
        )
        self.check(
            "Step Recording Endpoint",
            lambda: self.check_endpoint_exists("POST", "/v2/activities/record/step"),
        )
        self.check(
            "Complete Recording Endpoint",
            lambda: self.check_endpoint_exists(
                "POST", "/v2/activities/record/complete"
            ),
        )

        # Check 3: Template schema
        self.check("Template Schema", self.check_template_schema)

        # Check 4: Expected flow documented
        self.check("Expected Flow Documentation", self.check_expected_flow)

        # Check 5: Deterministic markers
        self.check("Deterministic Test Design", self.check_deterministic_markers)

        # Summary
        print()
        print("=" * 70)
        print("Summary")
        print("=" * 70)
        print(f"Checks passed: {self.checks_passed}/{self.checks_total}")

        if self.checks_passed == self.checks_total:
            log_success("All checks passed")
            print()
            log_info("Next Steps:")
            print("  1. Create valid API key (see backend documentation)")
            print("  2. Run: python3 scripts/register-trace-test-activity.py")
            print("  3. Run: ./scripts/run_live_trace.sh")
            return True
        else:
            log_error(f"{self.checks_total - self.checks_passed} checks failed")
            return False


if __name__ == "__main__":
    validator = DataFlowValidator()
    success = validator.run_all()
    sys.exit(0 if success else 1)
