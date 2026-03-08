#!/usr/bin/env python3
"""
E2E Activity Lifecycle Validation Harness

Tests the complete data flow through the stack:
  TypeScript (opencode) -> JSON -> Python (metabob-cli) -> HTTP -> 
  FastAPI (metabob-rpc-api) -> SurrealDB -> back

Validates:
1. Dynamic activity creation trigger (GAP-1)
2. Activity storage with multi-tenant scoping (GAP-2, GAP-9)
3. Impulse type preservation across vessels
4. Pydantic validation of API requests
5. Random data integrity through full stack
6. Boredom activity filtering by org/project

Usage:
  python tests/validation-harnesses/e2e-activity-lifecycle-validation.py

Expected: 7/7 tests pass (100%)
"""

import asyncio
import json
import random
import string
import sys
from typing import Any, Dict, List, Optional
from datetime import datetime
from pprint import pprint

# Mock HTTP client (will be replaced with real client)
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
        import aiohttp
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as resp:
                return {
                    "status": resp.status,
                    "data": await resp.json() if resp.status < 400 else {"error": await resp.text()}
                }
    
    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """GET request to API"""
        import aiohttp
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=self.headers) as resp:
                return {
                    "status": resp.status,
                    "data": await resp.json() if resp.status < 400 else {"error": await resp.text()}
                }


def generate_random_string(length: int = 10) -> str:
    """Generate random alphanumeric string"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


def generate_random_data() -> Dict[str, Any]:
    """Generate random data with various types for integrity testing"""
    return {
        "string_field": generate_random_string(20),
        "int_field": random.randint(1, 1000),
        "float_field": round(random.uniform(1.0, 100.0), 2),
        "bool_field": random.choice([True, False]),
        "list_field": [generate_random_string(5) for _ in range(3)],
        "nested_field": {
            "inner_string": generate_random_string(10),
            "inner_int": random.randint(1, 100)
        }
    }


class ValidationTest:
    """Base class for validation tests"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.passed = False
        self.error = None
    
    async def run(self, client: HTTPClient) -> bool:
        """Run the test, return True if passed"""
        raise NotImplementedError
    
    def report(self) -> str:
        """Generate test report"""
        status = "✅ PASS" if self.passed else "❌ FAIL"
        msg = f"{status} | {self.name}\n"
        msg += f"  Description: {self.description}\n"
        if self.error:
            msg += f"  Error: {self.error}\n"
        return msg


class Test1_DynamicCreationTrigger(ValidationTest):
    """Test GAP-1: Dynamic creation trigger when no templates match"""
    
    def __init__(self):
        super().__init__(
            name="Test 1: Dynamic Creation Trigger",
            description="Request non-existent template, expect suggestion for create_activity_goal_seeking"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Search for non-existent template
            novel_request = f"implement-quantum-blockchain-ai-{generate_random_string(10)}"
            resp = await client.get("/v2/activity-templates/search", {
                "context": novel_request,
                "org_id": "test-org",
                "project_id": "test-project"
            })
            
            if resp["status"] != 200:
                self.error = f"API returned {resp['status']}: {resp['data']}"
                return False
            
            templates = resp["data"].get("templates", [])
            
            # Should return empty list or suggestion
            if len(templates) == 0:
                # Check for suggestion in response
                suggestion = resp["data"].get("suggestion")
                if suggestion and "create_activity_goal_seeking" in str(suggestion):
                    self.passed = True
                    return True
                else:
                    self.error = "No templates found, but no suggestion provided"
                    return False
            else:
                self.error = f"Expected 0 templates, got {len(templates)}"
                return False
                
        except Exception as e:
            self.error = str(e)
            return False


class Test2_ActivityStorage(ValidationTest):
    """Test GAP-2: Activity storage with org/project scoping"""
    
    def __init__(self):
        super().__init__(
            name="Test 2: Activity Storage",
            description="Create activity, query backend, verify stored with org/project scope"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Create activity
            org_id = f"test-org-{generate_random_string(8)}"
            project_id = f"test-project-{generate_random_string(8)}"
            activity_id = f"act_{generate_random_string(16)}"
            
            activity_data = {
                "activity_id": activity_id,
                "template_id": "test-template",
                "org_id": org_id,
                "project_id": project_id,
                "status": "completed",
                "created_at": datetime.utcnow().isoformat(),
                "tasks": []
            }
            
            # POST activity
            create_resp = await client.post("/v2/activities", activity_data)
            
            if create_resp["status"] not in [200, 201]:
                self.error = f"Failed to create activity: {create_resp['data']}"
                return False
            
            # Query backend
            query_resp = await client.get("/v2/activities", {
                "org_id": org_id,
                "project_id": project_id
            })
            
            if query_resp["status"] != 200:
                self.error = f"Failed to query activities: {query_resp['data']}"
                return False
            
            activities = query_resp["data"].get("activities", [])
            
            # Verify activity appears
            found = any(a["activity_id"] == activity_id for a in activities)
            
            if found:
                self.passed = True
                return True
            else:
                self.error = f"Activity {activity_id} not found in query results"
                return False
                
        except Exception as e:
            self.error = str(e)
            return False


class Test3_MultiTenantIsolation(ValidationTest):
    """Test GAP-9: Multi-tenant isolation"""
    
    def __init__(self):
        super().__init__(
            name="Test 3: Multi-Tenant Isolation",
            description="Create activity for org1, query with org2, expect empty"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            # Create activity for org1
            org1_id = f"test-org1-{generate_random_string(8)}"
            org2_id = f"test-org2-{generate_random_string(8)}"
            project_id = f"test-project-{generate_random_string(8)}"
            activity_id = f"act_{generate_random_string(16)}"
            
            activity_data = {
                "activity_id": activity_id,
                "template_id": "test-template",
                "org_id": org1_id,
                "project_id": project_id,
                "status": "completed",
                "created_at": datetime.utcnow().isoformat(),
                "tasks": []
            }
            
            # POST activity for org1
            create_resp = await client.post("/v2/activities", activity_data)
            
            if create_resp["status"] not in [200, 201]:
                self.error = f"Failed to create activity: {create_resp['data']}"
                return False
            
            # Query with org2 (should be empty)
            query_resp = await client.get("/v2/activities", {
                "org_id": org2_id,
                "project_id": project_id
            })
            
            if query_resp["status"] != 200:
                self.error = f"Failed to query activities: {query_resp['data']}"
                return False
            
            activities = query_resp["data"].get("activities", [])
            
            # Should NOT find activity from org1
            found = any(a["activity_id"] == activity_id for a in activities)
            
            if not found:
                self.passed = True
                return True
            else:
                self.error = f"Activity {activity_id} leaked to org2 (isolation breach!)"
                return False
                
        except Exception as e:
            self.error = str(e)
            return False


class Test4_BoredomActivityFiltering(ValidationTest):
    """Test GAP-9: Boredom activity filtering by org/project"""
    
    def __init__(self):
        super().__init__(
            name="Test 4: Boredom Activity Filtering",
            description="Fetch boredom activities, verify filtered by org/project"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            org_id = f"test-org-{generate_random_string(8)}"
            project_id = f"test-project-{generate_random_string(8)}"
            
            # Fetch boredom activities
            resp = await client.get("/v2/boredom-activities", {
                "org_id": org_id,
                "project_id": project_id
            })
            
            if resp["status"] != 200:
                self.error = f"API returned {resp['status']}: {resp['data']}"
                return False
            
            boredom_activities = resp["data"].get("activities", [])
            
            # Verify all activities match org/project
            all_match = all(
                a.get("org_id") == org_id and a.get("project_id") == project_id
                for a in boredom_activities
            )
            
            if all_match or len(boredom_activities) == 0:
                self.passed = True
                return True
            else:
                self.error = "Some boredom activities don't match org/project filter"
                return False
                
        except Exception as e:
            self.error = str(e)
            return False


class Test5_TypePreservation(ValidationTest):
    """Test Phase 1: Type preservation through stack"""
    
    def __init__(self):
        super().__init__(
            name="Test 5: Type Preservation",
            description="POST impulse with int/bool, GET back, verify types unchanged"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            org_id = f"test-org-{generate_random_string(8)}"
            project_id = f"test-project-{generate_random_string(8)}"
            impulse_id = f"imp_{generate_random_string(16)}"
            
            # Generate random data
            test_data = generate_random_data()
            
            impulse_data = {
                "impulse_id": impulse_id,
                "org_id": org_id,
                "project_id": project_id,
                "pointer_type": "testResults",
                "pointer_data": test_data,
                "budget": 1000,
                "priority": "high"
            }
            
            # POST impulse
            create_resp = await client.post("/v2/impulses", impulse_data)
            
            if create_resp["status"] not in [200, 201]:
                self.error = f"Failed to create impulse: {create_resp['data']}"
                return False
            
            # GET impulse back
            get_resp = await client.get(f"/v2/impulses/{impulse_id}", {
                "org_id": org_id,
                "project_id": project_id
            })
            
            if get_resp["status"] != 200:
                self.error = f"Failed to get impulse: {get_resp['data']}"
                return False
            
            returned_data = get_resp["data"].get("pointer_data", {})
            
            # Verify types preserved
            type_mismatches = []
            for key, original_value in test_data.items():
                returned_value = returned_data.get(key)
                
                if type(returned_value) != type(original_value):
                    type_mismatches.append(
                        f"{key}: expected {type(original_value).__name__}, got {type(returned_value).__name__}"
                    )
                
                if returned_value != original_value:
                    type_mismatches.append(
                        f"{key}: value mismatch (expected {original_value}, got {returned_value})"
                    )
            
            if len(type_mismatches) == 0:
                self.passed = True
                return True
            else:
                self.error = f"Type mismatches: {', '.join(type_mismatches)}"
                return False
                
        except Exception as e:
            self.error = str(e)
            return False


class Test6_PydanticValidation(ValidationTest):
    """Test Phase 1: Pydantic validation catches invalid types"""
    
    def __init__(self):
        super().__init__(
            name="Test 6: Pydantic Validation",
            description="POST impulse with invalid types, expect HTTP 400 with error details"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            org_id = f"test-org-{generate_random_string(8)}"
            project_id = f"test-project-{generate_random_string(8)}"
            
            # Invalid data (budget should be int, not string)
            invalid_data = {
                "impulse_id": f"imp_{generate_random_string(16)}",
                "org_id": org_id,
                "project_id": project_id,
                "pointer_type": "testResults",
                "pointer_data": {},
                "budget": "not-a-number",  # Invalid!
                "priority": "high"
            }
            
            # POST invalid impulse
            resp = await client.post("/v2/impulses", invalid_data)
            
            # Should get 400/422 error
            if resp["status"] in [400, 422]:
                error_data = resp["data"]
                if "error" in str(error_data).lower() or "validation" in str(error_data).lower():
                    self.passed = True
                    return True
                else:
                    self.error = f"Got {resp['status']} but unclear error message: {error_data}"
                    return False
            else:
                self.error = f"Expected 400/422, got {resp['status']}"
                return False
                
        except Exception as e:
            self.error = str(e)
            return False


class Test7_RandomDataIntegrity(ValidationTest):
    """Test full stack data integrity with random data"""
    
    def __init__(self):
        super().__init__(
            name="Test 7: Random Data Integrity",
            description="Generate random data, POST, GET, compare field-by-field"
        )
    
    async def run(self, client: HTTPClient) -> bool:
        try:
            org_id = f"test-org-{generate_random_string(8)}"
            project_id = f"test-project-{generate_random_string(8)}"
            
            # Test with multiple random data sets
            for i in range(3):
                impulse_id = f"imp_{generate_random_string(16)}"
                test_data = generate_random_data()
                
                impulse_data = {
                    "impulse_id": impulse_id,
                    "org_id": org_id,
                    "project_id": project_id,
                    "pointer_type": "scriptArtifact",
                    "pointer_data": test_data,
                    "budget": random.randint(500, 2000),
                    "priority": random.choice(["high", "medium", "low"])
                }
                
                # POST
                create_resp = await client.post("/v2/impulses", impulse_data)
                if create_resp["status"] not in [200, 201]:
                    self.error = f"Failed to create impulse {i+1}: {create_resp['data']}"
                    return False
                
                # GET
                get_resp = await client.get(f"/v2/impulses/{impulse_id}", {
                    "org_id": org_id,
                    "project_id": project_id
                })
                if get_resp["status"] != 200:
                    self.error = f"Failed to get impulse {i+1}: {get_resp['data']}"
                    return False
                
                returned_data = get_resp["data"].get("pointer_data", {})
                
                # Compare field-by-field
                if returned_data != test_data:
                    self.error = f"Data mismatch on impulse {i+1}: expected {test_data}, got {returned_data}"
                    return False
            
            self.passed = True
            return True
                
        except Exception as e:
            self.error = str(e)
            return False


async def main():
    """Run all validation tests"""
    print("=" * 80)
    print("Activity Lifecycle E2E Validation Harness")
    print("=" * 80)
    print()
    
    # Configuration
    API_BASE_URL = "http://api.metabob.local"
    API_KEY = "test-api-key"  # Replace with actual API key
    
    print(f"Target: {API_BASE_URL}")
    print(f"API Key: {API_KEY[:10]}...")
    print()
    
    # Initialize client
    client = HTTPClient(API_BASE_URL, API_KEY)
    
    # Define tests
    tests = [
        Test1_DynamicCreationTrigger(),
        Test2_ActivityStorage(),
        Test3_MultiTenantIsolation(),
        Test4_BoredomActivityFiltering(),
        Test5_TypePreservation(),
        Test6_PydanticValidation(),
        Test7_RandomDataIntegrity(),
    ]
    
    # Run tests
    print("Running tests...")
    print("-" * 80)
    
    results = []
    for test in tests:
        print(f"Running: {test.name}...", end=" ")
        passed = await test.run(client)
        results.append(passed)
        print("✅ PASS" if passed else "❌ FAIL")
    
    # Print detailed reports
    print()
    print("=" * 80)
    print("DETAILED REPORTS")
    print("=" * 80)
    for test in tests:
        print(test.report())
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    passed_count = sum(results)
    total_count = len(results)
    pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0
    
    print(f"Tests Passed: {passed_count}/{total_count} ({pass_rate:.1f}%)")
    print()
    
    if passed_count == total_count:
        print("✅ ALL TESTS PASSED - System validated!")
        return 0
    else:
        print("❌ SOME TESTS FAILED - Review errors above")
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
