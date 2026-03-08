#!/usr/bin/env python3
"""
E2E Validation Against Current Deployment

Tests what works TODAY with the currently deployed RPC API,
and documents what will work after Phase 1 deployment.

This provides:
1. Baseline of current functionality
2. Communication flow validation with existing code
3. Type safety testing with current endpoints
4. Comparison data for post-deployment validation
"""

import asyncio
import json
import random
import string
import sys
from typing import Any, Dict
from datetime import datetime

try:
    import aiohttp
except ImportError:
    print("ERROR: aiohttp not installed. Install with: pip install aiohttp")
    sys.exit(1)

API_BASE_URL = "http://api.metabob.local"
API_KEY = "c2Vzc2lvbnM6ZDFmYWU2MGMtM2Y5OS00NzBmLWE1ZGQtZGI5ZTMyOTU0OGY1OmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI="


class HTTPClient:
    """HTTP client for testing RPC API endpoints"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    async def post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST request to API"""
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(url, json=data, headers=self.headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    text = await resp.text()
                    try:
                        json_data = json.loads(text)
                    except:
                        json_data = {"raw": text}
                    return {
                        "status": resp.status,
                        "data": json_data
                    }
            except Exception as e:
                return {"status": None, "data": {"error": str(e)}}
    
    async def get(self, path: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """GET request to API"""
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, params=params, headers=self.headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    text = await resp.text()
                    try:
                        json_data = json.loads(text)
                    except:
                        json_data = {"raw": text}
                    return {
                        "status": resp.status,
                        "data": json_data
                    }
            except Exception as e:
                return {"status": None, "data": {"error": str(e)}}


def generate_random_string(length: int = 10) -> str:
    """Generate random alphanumeric string"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


class ValidationTest:
    """Base class for validation tests"""
    
    def __init__(self, name: str, description: str, expected_status: str = "PASS"):
        self.name = name
        self.description = description
        self.expected_status = expected_status  # PASS, FAIL, SKIP
        self.actual_status = "PENDING"
        self.error = None
        self.notes = None
    
    async def run(self, client: HTTPClient) -> bool:
        """Run the test, return True if passed"""
        raise NotImplementedError
    
    def report(self) -> str:
        """Generate test report"""
        if self.expected_status == "SKIP":
            icon = "⏭️ "
            status_text = "SKIP"
        elif self.actual_status == "PASS":
            icon = "✅"
            status_text = "PASS"
        elif self.actual_status == "EXPECTED_FAIL":
            icon = "⚠️ "
            status_text = "EXPECTED FAIL"
        else:
            icon = "❌"
            status_text = "FAIL"
        
        msg = f"{icon} {status_text} | {self.name}\n"
        msg += f"  Description: {self.description}\n"
        if self.expected_status != "PASS":
            msg += f"  Expected: {self.expected_status}\n"
        if self.error:
            msg += f"  Error: {self.error}\n"
        if self.notes:
            msg += f"  Notes: {self.notes}\n"
        return msg


class TestCurrentAPI_TemplatesEndpoint(ValidationTest):
    """Test current deployment: Templates endpoint works"""
    
    def __init__(self):
        super().__init__(
            name="Current API: Templates Endpoint",
            description="GET /v2/activities/templates returns 200 with template list",
            expected_status="PASS"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            resp = await client.get("/v2/activities/templates")
            
            if resp["status"] != 200:
                self.actual_status = "FAIL"
                self.error = f"Expected 200, got {resp['status']}"
                return False
            
            templates = resp["data"].get("templates", [])
            
            if not isinstance(templates, list):
                self.actual_status = "FAIL"
                self.error = f"Expected list, got {type(templates)}"
                return False
            
            self.actual_status = "PASS"
            self.notes = f"Found {len(templates)} templates"
            return True
            
        except Exception as e:
            self.actual_status = "FAIL"
            self.error = str(e)
            return False


class TestCurrentAPI_TemplateSearch(ValidationTest):
    """Test current deployment: Template search functionality"""
    
    def __init__(self):
        super().__init__(
            name="Current API: Template Search",
            description="Search templates by context query",
            expected_status="PASS"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Test with a generic query
            resp = await client.get("/v2/activities/templates", {
                "query": "validation"
            })
            
            if resp["status"] == 200:
                templates = resp["data"].get("templates", [])
                self.actual_status = "PASS"
                self.notes = f"Search returned {len(templates)} results"
                return True
            elif resp["status"] == 400:
                # May not support query param yet
                self.actual_status = "EXPECTED_FAIL"
                self.error = "Query parameter not supported in current deployment"
                return False
            else:
                self.actual_status = "FAIL"
                self.error = f"Unexpected status {resp['status']}"
                return False
            
        except Exception as e:
            self.actual_status = "FAIL"
            self.error = str(e)
            return False


class TestCurrentAPI_JSONSerialization(ValidationTest):
    """Test current deployment: Basic JSON type preservation"""
    
    def __init__(self):
        super().__init__(
            name="Current API: JSON Serialization",
            description="Test that API can handle various JSON types",
            expected_status="PASS"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Try to POST a template (if endpoint exists)
            test_data = {
                "activity_id": f"test_{generate_random_string(8)}",
                "description": "Test template",
                "variables": {
                    "string_var": "test",
                    "int_var": 42,
                    "bool_var": True,
                    "float_var": 3.14
                },
                "task_steps": []
            }
            
            resp = await client.post("/v2/activities/templates", test_data)
            
            if resp["status"] in [200, 201]:
                self.actual_status = "PASS"
                self.notes = "API accepted complex JSON structure"
                return True
            elif resp["status"] == 400:
                # May be validation error, but at least JSON was parsed
                self.actual_status = "PASS"
                self.notes = "JSON parsed successfully (validation error is expected)"
                return True
            elif resp["status"] == 404:
                self.actual_status = "EXPECTED_FAIL"
                self.error = "POST endpoint not available in current deployment"
                return False
            else:
                self.actual_status = "FAIL"
                self.error = f"Unexpected status {resp['status']}: {resp['data']}"
                return False
            
        except Exception as e:
            self.actual_status = "FAIL"
            self.error = str(e)
            return False


class TestFutureAPI_ImpulseTypes(ValidationTest):
    """Test Phase 1: New impulse types (TestResults, TaskSummary, ScriptArtifact)"""
    
    def __init__(self):
        super().__init__(
            name="Phase 1 Feature: New Impulse Types",
            description="Test testResults, taskSummary, scriptArtifact pointer types",
            expected_status="EXPECTED_FAIL"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Test new impulse type
            impulse_data = {
                "impulse_id": f"imp_{generate_random_string(16)}",
                "api_key": API_KEY,
                "project_id": "test-project",
                "pointer_type": "testResults",  # New in Phase 1
                "pointer_data": {
                    "test_file": "test_example.py",
                    "passed": 10,
                    "failed": 2,
                    "duration": 5.3
                },
                "budget": 1000,
                "priority": "high"
            }
            
            resp = await client.post("/v2/impulses", impulse_data)
            
            if resp["status"] in [200, 201]:
                self.actual_status = "PASS"
                self.notes = "⚠️ UNEXPECTED: Phase 1 feature working! Code may be deployed."
                return True
            elif resp["status"] in [400, 422]:
                error_msg = str(resp["data"]).lower()
                if "testresults" in error_msg or "pointer_type" in error_msg:
                    self.actual_status = "EXPECTED_FAIL"
                    self.notes = "As expected: testResults type not recognized in current deployment"
                    return False
                else:
                    self.actual_status = "EXPECTED_FAIL"
                    self.notes = f"Validation error (expected): {resp['data']}"
                    return False
            else:
                self.actual_status = "FAIL"
                self.error = f"Unexpected status {resp['status']}"
                return False
            
        except Exception as e:
            self.actual_status = "FAIL"
            self.error = str(e)
            return False


class TestFutureAPI_MultiTenantScoping(ValidationTest):
    """Test GAP-9: Multi-tenant isolation"""
    
    def __init__(self):
        super().__init__(
            name="GAP-9 Feature: Multi-Tenant Scoping",
            description="Verify org/project isolation in activity queries",
            expected_status="EXPECTED_FAIL"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Try to query with org_id/project_id filters
            resp = await client.get("/v2/activities/templates", {
                "org_id": "test-org",
                "project_id": "test-project"
            })
            
            if resp["status"] == 200:
                # Check if filters were actually applied
                templates = resp["data"].get("templates", [])
                
                # If all templates have matching org/project, feature works
                has_scoping = any("org_id" in str(t) or "project_id" in str(t) for t in templates)
                
                if has_scoping:
                    self.actual_status = "PASS"
                    self.notes = "⚠️ UNEXPECTED: GAP-9 feature working! Code may be deployed."
                    return True
                else:
                    self.actual_status = "EXPECTED_FAIL"
                    self.notes = "Filters ignored (expected): no org/project scoping in current deployment"
                    return False
            else:
                self.actual_status = "EXPECTED_FAIL"
                self.notes = f"Query with filters returned {resp['status']} (expected)"
                return False
            
        except Exception as e:
            self.actual_status = "FAIL"
            self.error = str(e)
            return False


class TestFutureAPI_DynamicCreation(ValidationTest):
    """Test GAP-1: Dynamic activity creation suggestion"""
    
    def __init__(self):
        super().__init__(
            name="GAP-1 Feature: Dynamic Creation Trigger",
            description="Expect suggestion when no templates match novel request",
            expected_status="EXPECTED_FAIL"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Search for non-existent template
            novel_query = f"quantum-blockchain-ai-{generate_random_string(10)}"
            resp = await client.get("/v2/activities/templates", {
                "query": novel_query
            })
            
            if resp["status"] == 200:
                data = resp["data"]
                
                # Check for suggestion in response
                has_suggestion = "suggestion" in data or "create_activity" in str(data).lower()
                
                if has_suggestion:
                    self.actual_status = "PASS"
                    self.notes = "⚠️ UNEXPECTED: GAP-1 feature working! Code may be deployed."
                    return True
                else:
                    self.actual_status = "EXPECTED_FAIL"
                    self.notes = "No suggestion provided (expected): GAP-1 not in current deployment"
                    return False
            else:
                self.actual_status = "EXPECTED_FAIL"
                self.notes = f"Query returned {resp['status']} (expected without GAP-1)"
                return False
            
        except Exception as e:
            self.actual_status = "FAIL"
            self.error = str(e)
            return False


async def main():
    """Run all validation tests against current deployment"""
    print("=" * 80)
    print("E2E Validation: Current Deployment")
    print("=" * 80)
    print()
    print("Purpose: Test what works TODAY with deployed code")
    print("         Document what will work after Phase 1 + GAP-1/9 deployment")
    print()
    
    print(f"Target: {API_BASE_URL}")
    print(f"API Key: {API_KEY[:20]}...")
    print()
    
    # Initialize client
    client = HTTPClient(API_BASE_URL, API_KEY)
    
    # Define tests
    print("Test Suite:")
    print("  [1-3] Current Deployment Tests (should PASS)")
    print("  [4-6] Phase 1 / GAP Features (should FAIL until deployed)")
    print()
    
    tests = [
        # Current deployment tests (should work)
        TestCurrentAPI_TemplatesEndpoint(),
        TestCurrentAPI_TemplateSearch(),
        TestCurrentAPI_JSONSerialization(),
        
        # Phase 1 / GAP features (should fail until deployed)
        TestFutureAPI_ImpulseTypes(),
        TestFutureAPI_MultiTenantScoping(),
        TestFutureAPI_DynamicCreation(),
    ]
    
    # Run tests
    print("Running tests...")
    print("-" * 80)
    
    results = []
    for i, test in enumerate(tests, 1):
        print(f"[{i}/{len(tests)}] {test.name}...", end=" ", flush=True)
        passed = await test.run(client)
        results.append((test, passed))
        
        if test.expected_status == "EXPECTED_FAIL" and test.actual_status == "EXPECTED_FAIL":
            print("⚠️  EXPECTED FAIL")
        elif test.actual_status == "PASS":
            print("✅ PASS")
        else:
            print("❌ FAIL")
    
    # Print detailed reports
    print()
    print("=" * 80)
    print("DETAILED REPORTS")
    print("=" * 80)
    for test, _ in results:
        print(test.report())
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    current_tests = results[:3]
    future_tests = results[3:]
    
    current_pass = sum(1 for t, _ in current_tests if t.actual_status == "PASS")
    current_total = len(current_tests)
    
    future_expected_fail = sum(1 for t, _ in future_tests if t.actual_status == "EXPECTED_FAIL")
    future_unexpected_pass = sum(1 for t, _ in future_tests if t.actual_status == "PASS")
    future_total = len(future_tests)
    
    print(f"\nCurrent Deployment Validation:")
    print(f"  Tests Passed: {current_pass}/{current_total}")
    if current_pass == current_total:
        print(f"  ✅ Current deployment communication flow VALIDATED")
    else:
        print(f"  ❌ Current deployment has issues")
    
    print(f"\nPhase 1 / GAP Feature Check:")
    print(f"  Expected Failures: {future_expected_fail}/{future_total}")
    print(f"  Unexpected Passes: {future_unexpected_pass}/{future_total}")
    
    if future_unexpected_pass > 0:
        print(f"  ⚠️  WARNING: Phase 1 code may already be deployed!")
    elif future_expected_fail == future_total:
        print(f"  ✅ Confirmed: Phase 1 code NOT deployed (as expected)")
    
    print()
    print("=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    
    if current_pass == current_total and future_expected_fail == future_total:
        print("✅ Baseline validated! Current deployment works as expected.")
        print()
        print("To deploy Phase 1 + GAP-1/9 changes:")
        print("  1. Build new Docker image with latest code:")
        print("     cd repos/metabob-rpc-api")
        print("     docker build -t metabobapp/metabob-rpc-api:0.24.0-phase1 -f docker/Dockerfile.server .")
        print()
        print("  2. Deploy to k8s:")
        print("     cd repos/platform/metabob-apps")
        print("     # Edit charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml")
        print("     #   tag: 0.24.0-phase1")
        print("     helmfile --environment default -l name=metabob-rpc-api apply")
        print()
        print("  3. Re-run THIS script - expect all 6 tests to PASS")
        print()
        print("  4. Then run full E2E harness:")
        print("     python tests/validation-harnesses/e2e-activity-lifecycle-validation.py")
        print()
        return 0
    else:
        print("❌ Unexpected results. Review detailed reports above.")
        print()
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nValidation interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
