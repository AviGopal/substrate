#!/usr/bin/env python3
"""
Test Activity Template API - Verify backend implementation

Tests all 6 endpoints with realistic data:
1. POST /v2/activities/templates - Create template
2. GET /v2/activities/templates/{id} - Fetch template
3. GET /v2/activities/templates - List all templates
4. POST /v2/activities/templates (duplicate) - Auto-variant creation
5. POST /v2/activities/executions - Record execution
6. GET /v2/activities/templates/{id}/stats - Get statistics

Run after starting backend:
  cd repos/metabob-rpc-api
  docker-compose up -d redis
  python -m server.cli start

Then run this test:
  python test_activity_api.py
"""

import requests
import json
import sys
from typing import Dict, Any

BACKEND_URL = "http://localhost:8080"


def print_section(title: str):
    """Print formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def test_create_template() -> str:
    """Test 1: Create a new template"""
    print_section("Test 1: Create Template")

    template_data = {
        "name": "Test Feature Template",
        "category": "feature",
        "description": "A test template for feature implementation",
        "task_steps": [
            {
                "id": "task-1",
                "subagent": "general",
                "description": "Implement feature logic",
                "dependencies": [],
                "prompt": {
                    "template": "Implement the {{featureName}} feature",
                    "max_tokens": 8000,
                    "compression_strategy": "filter",
                    "variables": ["featureName"],
                },
                "validation": {
                    "required_files": [],
                    "required_patterns": [],
                    "forbidden_patterns": [],
                    "commands": [],
                },
                "retry": {
                    "max_attempts": 3,
                    "strategy": "simple",
                    "fallback_prompt": "",
                },
                "metrics": {},
                "tools": {
                    "required": ["read", "write"],
                    "optional": ["bash"],
                    "disabled": [],
                },
            },
            {
                "id": "task-2",
                "subagent": "general",
                "description": "Write tests",
                "dependencies": ["task-1"],
                "prompt": {
                    "template": "Write tests for the feature",
                    "max_tokens": 4000,
                    "compression_strategy": "filter",
                    "variables": [],
                },
                "validation": {
                    "required_files": [],
                    "required_patterns": ["test"],
                    "forbidden_patterns": [],
                    "commands": [],
                },
                "retry": {
                    "max_attempts": 2,
                    "strategy": "simple",
                    "fallback_prompt": "",
                },
                "metrics": {},
                "tools": {
                    "required": ["read", "write", "bash"],
                    "optional": [],
                    "disabled": [],
                },
            },
        ],
        "variables": {"featureName": "test-feature"},
        "context_requirements": [],
    }

    response = requests.post(
        f"{BACKEND_URL}/v2/activities/templates", json=template_data
    )

    if response.status_code not in [200, 201]:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    result = response.json()
    variant_id = result["variant_id"]

    print(f"✅ Created template: {variant_id}")
    print(f"   Activity ID: {result['activity_id']}")
    print(f"   Generation: {result['genealogy']['generation']}")
    print(f"   Content Hash: {result['genealogy']['content_hash']}")

    return variant_id


def test_get_template(variant_id: str):
    """Test 2: Fetch template by ID"""
    print_section("Test 2: Get Template by ID")

    response = requests.get(f"{BACKEND_URL}/v2/activities/templates/{variant_id}")

    if response.status_code != 200:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    result = response.json()

    print(f"✅ Fetched template: {result['variant_id']}")
    print(f"   Name: {result['variant_name']}")
    print(f"   Tasks: {len(result['task_steps'])}")
    print(f"   Has Metrics: {'metrics' in result}")


def test_list_templates():
    """Test 3: List all templates"""
    print_section("Test 3: List All Templates")

    response = requests.get(f"{BACKEND_URL}/v2/activities/templates?limit=10")

    if response.status_code != 200:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    result = response.json()
    templates = result["templates"]

    print(f"✅ Listed {len(templates)} templates")
    for t in templates[:3]:  # Show first 3
        print(f"   - {t['variant_id']}: {t['variant_name']}")
        print(f"     Expected Value: {t.get('expected_value', 'N/A'):.3f}")


def test_auto_variant(original_variant_id: str) -> str:
    """Test 4: Auto-variant creation on duplicate name"""
    print_section("Test 4: Auto-Variant Creation")

    # Same name, different content -> should create variant
    template_data = {
        "name": "Test Feature Template",  # SAME NAME
        "category": "feature",
        "description": "Updated description for variant",  # DIFFERENT CONTENT
        "task_steps": [
            {
                "id": "task-1",
                "subagent": "general",
                "description": "NEW: Improved implementation",  # CHANGED
                "dependencies": [],
                "prompt": {
                    "template": "Implement {{featureName}} with improvements",  # CHANGED
                    "max_tokens": 8000,
                    "compression_strategy": "filter",
                    "variables": ["featureName"],
                },
                "validation": {
                    "required_files": [],
                    "required_patterns": [],
                    "forbidden_patterns": [],
                    "commands": [],
                },
                "retry": {
                    "max_attempts": 3,
                    "strategy": "simple",
                    "fallback_prompt": "",
                },
                "metrics": {},
                "tools": {
                    "required": ["read", "write"],
                    "optional": ["bash"],
                    "disabled": [],
                },
            }
        ],
        "variables": {},
        "context_requirements": [],
    }

    response = requests.post(
        f"{BACKEND_URL}/v2/activities/templates", json=template_data
    )

    if response.status_code not in [200, 201]:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    result = response.json()
    new_variant_id = result["variant_id"]

    if new_variant_id == original_variant_id:
        print(f"❌ Failed: Same variant ID returned (expected new variant)")
        sys.exit(1)

    print(f"✅ Created variant: {new_variant_id}")
    print(f"   Original: {original_variant_id}")
    print(f"   Generation: {result['genealogy']['generation']}")
    print(f"   Parent Hash: {result['genealogy']['parent_hash']}")

    return new_variant_id


def test_record_execution(variant_id: str):
    """Test 5: Record execution result"""
    print_section("Test 5: Record Execution Result")

    execution_data = {
        "execution_id": "test-exec-001",
        "variant_id": variant_id,
        "success": True,
        "cost": 0.015,
        "duration_ms": 4500,
        "tokens": {"input": 1200, "output": 800, "cache": 0},
    }

    response = requests.post(
        f"{BACKEND_URL}/v2/activities/executions", json=execution_data
    )

    if response.status_code not in [200, 201]:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    result = response.json()

    print(f"✅ Recorded execution for: {variant_id}")
    print(f"   Thompson Alpha: {result['thompson_alpha']}")
    print(f"   Thompson Beta: {result['thompson_beta']}")
    print(f"   Total Selections: {result['total_selections']}")

    # Record a few more executions to test Thompson Sampling
    for i in range(5):
        success = i < 4  # 4 successes, 1 failure
        requests.post(
            f"{BACKEND_URL}/v2/activities/executions",
            json={
                "variant_id": variant_id,
                "success": success,
                "cost": 0.01 + (i * 0.001),
                "duration_ms": 4000 + (i * 100),
            },
        )

    print(f"   Recorded 5 additional executions (4 success, 1 failure)")


def test_get_stats(variant_id: str):
    """Test 6: Get template statistics"""
    print_section("Test 6: Get Template Statistics")

    response = requests.get(f"{BACKEND_URL}/v2/activities/templates/{variant_id}/stats")

    if response.status_code != 200:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    result = response.json()

    print(f"✅ Retrieved stats for: {result['template_id']}")
    print(f"   Total Executions: {result['total_executions']}")
    print(f"   Success Rate: {result['success_rate']:.1%}")
    print(f"   Avg Cost: ${result['avg_cost']:.4f}")
    print(f"   Avg Duration: {result['avg_duration_ms']:.0f}ms")
    print(f"   Variants: {len(result['variants'])}")

    for v in result["variants"]:
        print(
            f"      - Generation {v['generation']}: {v['success_rate']:.1%} success ({v['total_selections']} runs)"
        )


def main():
    """Run all tests"""
    print("\n🚀 Testing Activity Template API")
    print(f"   Backend: {BACKEND_URL}")

    try:
        # Test 1: Create template
        variant_id_1 = test_create_template()

        # Test 2: Get template by ID
        test_get_template(variant_id_1)

        # Test 3: List templates
        test_list_templates()

        # Test 4: Auto-variant creation
        variant_id_2 = test_auto_variant(variant_id_1)

        # Test 5: Record executions
        test_record_execution(variant_id_1)
        test_record_execution(variant_id_2)

        # Test 6: Get statistics
        test_get_stats(variant_id_1)

        print_section("✅ All Tests Passed!")
        print("\nBackend API is working correctly!")
        print("\nNext Steps:")
        print("  1. Test CLI integration: cd repos/metabob-cli && pytest tests/mcp/")
        print("  2. Test with OpenCode: Use register_activity_template tool")
        print("  3. Monitor Thompson Sampling: Check variant selection over time")

    except requests.exceptions.ConnectionError:
        print("\n❌ Connection Error")
        print("   Backend is not running. Start it with:")
        print("   cd repos/metabob-rpc-api")
        print("   docker-compose up -d redis")
        print("   python -m server.cli start")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
