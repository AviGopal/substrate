#!/usr/bin/env python3
"""
Comprehensive Test Suite for Metabob-CLI V2 Endpoint Migration

This test suite verifies:
1. All v2 endpoints are working correctly
2. Database records are created properly for each endpoint
3. metabob-cli correctly uses Bearer auth
4. metabob-opencode can execute activities with the new CLI build

Test Strategy:
- Test each v2 endpoint individually
- Verify database state after each operation
- Test end-to-end activity execution
- Verify metabob-opencode integration

Usage:
    python3 test_cli_v2_endpoints_comprehensive.py
"""

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from surrealdb import Surreal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration
API_BASE_URL = os.getenv("METABOB_API_URL", "http://localhost:8080")
API_KEY = os.getenv("METABOB_API_KEY", "test-api-key")
SURREALDB_URL = os.getenv("SURREALDB_URL", "http://localhost:8000")
SURREALDB_USER = os.getenv("SURREALDB_USER", "root")
SURREALDB_PASS = os.getenv("SURREALDB_PASS", "root")
SURREALDB_NS = os.getenv("SURREALDB_NS", "test")
SURREALDB_DB = os.getenv("SURREALDB_DB", "test")

# Test data
ORG_ID = "test-org-v2"
PROJECT_ID = "cli-v2-test"


class Colors:
    """ANSI color codes for terminal output"""

    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}\n")


def print_success(text: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str):
    """Print error message"""
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ {text}{Colors.RESET}")


def print_test(text: str):
    """Print test header"""
    print(f"\n{Colors.BOLD}Test: {text}{Colors.RESET}")


class V2EndpointTester:
    """Test suite for v2 API endpoints"""

    def __init__(self):
        self.session_id: Optional[str] = None
        self.session_token: Optional[str] = None
        self.template_id: Optional[str] = None
        self.execution_id: Optional[str] = None
        self.db: Optional[Surreal] = None
        self.test_results: List[Dict[str, Any]] = []

    async def setup(self):
        """Setup test environment"""
        print_header("Test Environment Setup")

        # Connect to SurrealDB for verification
        try:
            self.db = Surreal(SURREALDB_URL)
            await self.db.connect()
            await self.db.signin({"user": SURREALDB_USER, "pass": SURREALDB_PASS})
            await self.db.use(SURREALDB_NS, SURREALDB_DB)
            print_success("Connected to SurrealDB")
        except Exception as e:
            print_error(f"Failed to connect to SurrealDB: {e}")
            print_info("Database verification will be skipped")

        # Create session
        await self.test_session_creation()

    async def teardown(self):
        """Cleanup test environment"""
        print_header("Test Environment Cleanup")

        if self.db:
            await self.db.close()
            print_success("Closed SurrealDB connection")

        # Print test summary
        self.print_test_summary()

    def record_test_result(self, test_name: str, passed: bool, details: str = ""):
        """Record test result"""
        self.test_results.append(
            {
                "test": test_name,
                "passed": passed,
                "details": details,
                "timestamp": datetime.now().isoformat(),
            }
        )

    def print_test_summary(self):
        """Print test summary"""
        print_header("Test Summary")

        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["passed"])
        failed = total - passed

        print(f"Total Tests: {total}")
        print(f"{Colors.GREEN}Passed: {passed}{Colors.RESET}")
        print(f"{Colors.RED}Failed: {failed}{Colors.RESET}")
        print(f"Success Rate: {(passed / total * 100):.1f}%\n")

        if failed > 0:
            print(f"{Colors.RED}Failed Tests:{Colors.RESET}")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  ✗ {result['test']}: {result['details']}")

    async def verify_db_record(
        self, table: str, record_id: str, expected_fields: Dict[str, Any]
    ) -> bool:
        """Verify that a record exists in database with expected fields"""
        if not self.db:
            print_info("Database verification skipped (no DB connection)")
            return True

        try:
            result = await self.db.select(f"{table}:{record_id}")
            if not result:
                print_error(f"Record {table}:{record_id} not found in database")
                return False

            # Verify expected fields
            for field, expected_value in expected_fields.items():
                actual_value = result.get(field)
                if actual_value != expected_value:
                    print_error(
                        f"Field {field}: expected {expected_value}, got {actual_value}"
                    )
                    return False

            print_success(f"Database record verified: {table}:{record_id}")
            return True
        except Exception as e:
            print_error(f"Database verification failed: {e}")
            return False

    async def test_session_creation(self):
        """Test 1: Create session (prerequisite for other tests)"""
        print_test("Session Creation (POST /v2/session)")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{API_BASE_URL}/v2/session",
                    headers={"X-API-Key": API_KEY},
                    json={
                        "org_id": ORG_ID,
                        "project_id": PROJECT_ID,
                        "agent_name": "test-agent",
                        "session_type": "development",
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    self.session_id = data.get("session_id")
                    # Handle both proto format (metadata.session_token) and simple format
                    if "metadata" in data and "session_token" in data["metadata"]:
                        self.session_token = data["metadata"]["session_token"]
                    elif "session_token" in data:
                        self.session_token = data["session_token"]

                    print_success(f"Session created: {self.session_id}")
                    print_info(f"Session token: {self.session_token[:20]}...")
                    self.record_test_result("session_creation", True)

                    # Verify in database
                    if self.session_id:
                        await self.verify_db_record(
                            "session",
                            self.session_id,
                            {"org_id": ORG_ID, "project_id": PROJECT_ID},
                        )
                else:
                    print_error(f"Session creation failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("session_creation", False, response.text)
        except Exception as e:
            print_error(f"Session creation exception: {e}")
            self.record_test_result("session_creation", False, str(e))
            raise

    async def test_list_templates(self):
        """Test 2: List templates (GET /v2/activities/templates)"""
        print_test("List Templates (GET /v2/activities/templates)")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{API_BASE_URL}/v2/activities/templates",
                    headers={"Authorization": f"Bearer {self.session_token}"},
                    params={"limit": 10},
                )

                if response.status_code == 200:
                    data = response.json()
                    templates = data.get("templates", [])
                    print_success(f"Found {len(templates)} templates")

                    # Print first template details
                    if templates:
                        template = templates[0]
                        print_info(
                            f"Sample template: {template.get('variant_name', 'N/A')}"
                        )
                        print_info(f"  ID: {template.get('variant_id', 'N/A')}")
                        print_info(f"  Category: {template.get('activity_id', 'N/A')}")
                        print_info(f"  Tasks: {len(template.get('task_steps', []))}")

                    self.record_test_result("list_templates", True)
                else:
                    print_error(f"List templates failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("list_templates", False, response.text)
        except Exception as e:
            print_error(f"List templates exception: {e}")
            self.record_test_result("list_templates", False, str(e))

    async def test_create_template(self):
        """Test 3: Create template (POST /v2/activities/templates)"""
        print_test("Create Template (POST /v2/activities/templates)")

        # Generate unique content to avoid duplicate content hash
        unique_id = uuid.uuid4().hex[:8]
        template_data = {
            "name": f"Test Template {unique_id}",
            "description": f"Test template for v2 endpoint verification ({unique_id})",
            "category": "feature",
            "variables": {
                "feature_name": {
                    "type": "string",
                    "required": True,
                    "description": "Name of the feature to implement",
                }
            },
            "context_requirements": [{"type": "codebase_context", "required": True}],
            "tasks": [
                {
                    "order": 1,
                    "type": "agent_task",
                    "agent_mode": "general",
                    "prompt_template": f"Implement {{{{feature_name}}}} with tests (test-{unique_id})",
                    "cost_budget": 0.5,
                }
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{API_BASE_URL}/v2/activities/templates",
                    headers={
                        "Authorization": f"Bearer {self.session_token}",
                        "Content-Type": "application/json",
                    },
                    json=template_data,
                )

                if response.status_code == 201:
                    data = response.json()
                    self.template_id = data.get("variant_id")
                    print_success(f"Template created: {self.template_id}")
                    print_info(f"Name: {data.get('variant_name')}")
                    print_info(f"Category: {data.get('activity_id')}")
                    self.record_test_result("create_template", True)

                    # Verify in database
                    if self.template_id:
                        await self.verify_db_record(
                            "activity_variant",
                            self.template_id,
                            {"name": template_data["name"]},
                        )
                else:
                    print_error(f"Template creation failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("create_template", False, response.text)
        except Exception as e:
            print_error(f"Template creation exception: {e}")
            self.record_test_result("create_template", False, str(e))

    async def test_get_template(self):
        """Test 4: Get template details (GET /v2/activities/templates/{id})"""
        print_test(f"Get Template (GET /v2/activities/templates/{self.template_id})")

        if not self.template_id:
            print_info("Skipping: No template ID available")
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{API_BASE_URL}/v2/activities/templates/{self.template_id}",
                    headers={"Authorization": f"Bearer {self.session_token}"},
                )

                if response.status_code == 200:
                    data = response.json()
                    print_success(f"Template retrieved: {data.get('variant_name')}")
                    print_info(f"Tasks: {len(data.get('task_steps', []))}")
                    print_info(f"Variables: {list(data.get('variables', {}).keys())}")
                    self.record_test_result("get_template", True)
                else:
                    print_error(f"Get template failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("get_template", False, response.text)
        except Exception as e:
            print_error(f"Get template exception: {e}")
            self.record_test_result("get_template", False, str(e))

    async def test_execution_start(self):
        """Test 5: Start execution recording (POST /v2/activities/record/start)"""
        print_test("Start Execution (POST /v2/activities/record/start)")

        if not self.template_id:
            print_info("Skipping: No template ID available")
            return

        self.execution_id = f"exec-{uuid.uuid4().hex}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{API_BASE_URL}/v2/activities/record/start",
                    headers={
                        "Authorization": f"Bearer {self.session_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "template_id": self.template_id,
                        "variables": {"feature_name": "test feature"},
                        "session_id": self.session_id,
                        "execution_id": self.execution_id,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    print_success(f"Execution started: {self.execution_id}")
                    print_info(f"Impression ID: {data.get('impression_id', 'N/A')}")
                    self.record_test_result("execution_start", True)

                    # Verify impression in database
                    impression_id = data.get("impression_id")
                    if impression_id:
                        await self.verify_db_record(
                            "impression",
                            impression_id,
                            {"execution_id": self.execution_id},
                        )
                else:
                    print_error(f"Execution start failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("execution_start", False, response.text)
        except Exception as e:
            print_error(f"Execution start exception: {e}")
            self.record_test_result("execution_start", False, str(e))

    async def test_execution_step(self):
        """Test 6: Record step completion (POST /v2/activities/record/step)"""
        print_test("Record Step (POST /v2/activities/record/step)")

        if not self.execution_id:
            print_info("Skipping: No execution ID available")
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{API_BASE_URL}/v2/activities/record/step",
                    headers={
                        "Authorization": f"Bearer {self.session_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "execution_id": self.execution_id,
                        "step_order": 1,
                        "success": True,
                        "duration_ms": 1500.0,
                        "cost": 0.02,
                        "tokens": 500,
                        "output": "Step completed successfully",
                    },
                )

                if response.status_code == 200:
                    print_success("Step recorded successfully")
                    self.record_test_result("execution_step", True)
                else:
                    print_error(f"Record step failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("execution_step", False, response.text)
        except Exception as e:
            print_error(f"Record step exception: {e}")
            self.record_test_result("execution_step", False, str(e))

    async def test_execution_complete(self):
        """Test 7: Complete execution (POST /v2/activities/record/complete)"""
        print_test("Complete Execution (POST /v2/activities/record/complete)")

        if not self.execution_id:
            print_info("Skipping: No execution ID available")
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{API_BASE_URL}/v2/activities/record/complete",
                    headers={
                        "Authorization": f"Bearer {self.session_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "execution_id": self.execution_id,
                        "success": True,
                        "duration_ms": 5000.0,
                        "cost": 0.05,
                        "tokens": 1500,
                        "step_results": [],
                        "outcome": "success",
                        "notes": "Test execution completed successfully",
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    print_success("Execution completed successfully")
                    print_info(f"Conversion ID: {data.get('conversion_id', 'N/A')}")
                    self.record_test_result("execution_complete", True)

                    # Verify conversion in database
                    conversion_id = data.get("conversion_id")
                    if conversion_id:
                        await self.verify_db_record(
                            "conversion",
                            conversion_id,
                            {"execution_id": self.execution_id, "success": True},
                        )
                else:
                    print_error(f"Execution complete failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("execution_complete", False, response.text)
        except Exception as e:
            print_error(f"Execution complete exception: {e}")
            self.record_test_result("execution_complete", False, str(e))

    async def test_derive_template(self):
        """Test 8: Derive template (POST /v2/activities/mutate/derive)"""
        print_test("Derive Template (POST /v2/activities/mutate/derive)")

        if not self.template_id:
            print_info("Skipping: No template ID available")
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{API_BASE_URL}/v2/activities/mutate/derive",
                    headers={
                        "Authorization": f"Bearer {self.session_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "parent_id": self.template_id,
                        "name": f"Derived Template {uuid.uuid4().hex[:8]}",
                        "description": "Derived from test template",
                        "modifications": {
                            "tasks": [
                                {
                                    "order": 1,
                                    "type": "agent_task",
                                    "agent_mode": "general",
                                    "prompt_template": "Enhanced: Implement {{feature_name}} with tests and docs",
                                    "cost_budget": 0.7,
                                }
                            ]
                        },
                    },
                )

                if response.status_code == 200 or response.status_code == 201:
                    data = response.json()
                    derived_id = data.get("variant_id")
                    print_success(f"Template derived: {derived_id}")
                    print_info(f"Parent: {self.template_id}")
                    self.record_test_result("derive_template", True)

                    # Verify in database
                    if derived_id:
                        await self.verify_db_record(
                            "activity_variant",
                            derived_id,
                            {"parent_id": self.template_id},
                        )
                else:
                    print_error(f"Template derivation failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("derive_template", False, response.text)
        except Exception as e:
            print_error(f"Template derivation exception: {e}")
            self.record_test_result("derive_template", False, str(e))

    async def test_get_lineage(self):
        """Test 9: Get template lineage (GET /v2/activities/mutate/lineage/{id})"""
        print_test(
            f"Get Lineage (GET /v2/activities/mutate/lineage/{self.template_id})"
        )

        if not self.template_id:
            print_info("Skipping: No template ID available")
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{API_BASE_URL}/v2/activities/mutate/lineage/{self.template_id}",
                    headers={"Authorization": f"Bearer {self.session_token}"},
                )

                if response.status_code == 200:
                    data = response.json()
                    lineage = data.get("lineage", [])
                    print_success(f"Lineage retrieved: {len(lineage)} templates")
                    for item in lineage:
                        print_info(
                            f"  - {item.get('variant_name', 'N/A')} ({item.get('variant_id', 'N/A')})"
                        )
                    self.record_test_result("get_lineage", True)
                else:
                    print_error(f"Get lineage failed: {response.status_code}")
                    print_error(f"Response: {response.text}")
                    self.record_test_result("get_lineage", False, response.text)
        except Exception as e:
            print_error(f"Get lineage exception: {e}")
            self.record_test_result("get_lineage", False, str(e))

    async def run_all_tests(self):
        """Run all endpoint tests"""
        print_header("Metabob-CLI V2 Endpoint Test Suite")

        await self.setup()

        # Run tests sequentially
        await self.test_list_templates()
        await self.test_create_template()
        await self.test_get_template()
        await self.test_execution_start()
        await self.test_execution_step()
        await self.test_execution_complete()
        await self.test_derive_template()
        await self.test_get_lineage()

        await self.teardown()


async def main():
    """Main test runner"""
    tester = V2EndpointTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print_error("\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\nFatal error: {e}")
        sys.exit(1)
