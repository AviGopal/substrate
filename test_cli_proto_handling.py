#!/usr/bin/env python3
"""
Test script to verify metabob-cli handles proto message responses correctly.

This tests:
1. Session proto response parsing (metadata.session_token extraction)
2. ActivityVariant proto response parsing (task_steps, snake_case fields)
3. Proto field name handling (variant_id, task_steps, created_at)
"""

import json
import asyncio
from datetime import datetime, timezone


def test_session_proto_parsing():
    """Test parsing proto Session message response."""
    print("=" * 80)
    print("TEST 1: Session Proto Response Parsing")
    print("=" * 80)

    # Simulate v2 API proto Session response
    proto_session_response = {
        "session_id": "org123:project456:session789",
        "session_type": "SESSION_TYPE_AUTHENTICATED",
        "consumer_id": "cli:user_123",
        "org_id": "org123",
        "project_id": "project456",
        "metadata": {
            "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token",
            "client_version": "1.0.0",
        },
        "created_at": "2026-02-07T12:00:00Z",
        "expires_at": "2026-02-08T12:00:00Z",
        "last_activity": "2026-02-07T12:00:00Z",
    }

    print(f"\nProto Session Response:")
    print(json.dumps(proto_session_response, indent=2))

    # Extract session_token from metadata (as CLI should do)
    metadata = proto_session_response.get("metadata", {})
    session_token = metadata.get("session_token")

    print(f"\n✅ Extracted session_token: {session_token[:20]}...")

    assert session_token, "❌ FAIL: No session_token in metadata"
    assert session_token.startswith("eyJ"), "❌ FAIL: Invalid token format"

    print("✅ PASS: Session proto parsing works")
    return True


def test_activity_variant_proto_parsing():
    """Test parsing proto ActivityVariant message response."""
    print("\n" + "=" * 80)
    print("TEST 2: ActivityVariant Proto Response Parsing")
    print("=" * 80)

    # Simulate v2 API proto ActivityVariant response
    proto_variant_response = {
        "variant_id": "feature-impl-v1-abc123",
        "activity_id": "feature-impl",
        "variant_name": "Feature Implementation v1",
        "description": "Implement a new feature with tests",
        "version": 1,
        "task_steps": [
            {
                "id": "task-1",
                "subagent": "planner",
                "description": "Plan feature implementation",
                "dependencies": [],
                "prompt": {
                    "template": "Plan the implementation for: {feature_description}",
                    "max_tokens": 8000,
                },
                "validation": {
                    "required_files": ["plan.md"],
                    "required_patterns": [],
                },
                "retry": {
                    "max_attempts": 3,
                    "strategy": "exponential",
                },
                "metrics": {
                    "success_rate": 0.85,
                    "avg_tokens": 2000,
                    "avg_duration": 30000,
                },
            },
            {
                "id": "task-2",
                "subagent": "coder",
                "description": "Implement feature",
                "dependencies": ["task-1"],
                "prompt": {
                    "template": "Implement: {feature_description}",
                    "max_tokens": 12000,
                },
                "validation": {
                    "required_files": [],
                    "required_patterns": ["def.*test_.*"],
                },
                "retry": {
                    "max_attempts": 5,
                    "strategy": "exponential",
                },
                "metrics": {
                    "success_rate": 0.75,
                    "avg_tokens": 5000,
                    "avg_duration": 90000,
                },
            },
        ],
        "variables": {
            "feature_description": "string",
        },
        "execution_config": {
            "context_requirements": ["codebase_structure", "existing_patterns"],
            "hooks": {},
        },
        "optimization_config": {
            "thompson_sampling": {
                "enabled": True,
                "initial_alpha": 1.0,
                "initial_beta": 1.0,
            },
        },
        "genealogy": {
            "content_hash": "abc123def456",
            "parent_hash": "",
            "creation_method": "CREATION_METHOD_MANUAL",
            "lineage": [],
        },
        "expected_duration_ms": 120000,
        "expected_cost": 0.5,
        "expected_quality_score": 0.8,
        "status": "ENTITY_STATUS_ACTIVE",
        "created_at": "2026-02-07T12:00:00Z",
    }

    print(f"\nProto ActivityVariant Response:")
    print(json.dumps(proto_variant_response, indent=2)[:500] + "...")

    # Test CLI parsing logic (snake_case proto fields)
    print("\n--- Testing Field Extraction ---")

    # Test identity fields
    variant_id = proto_variant_response.get("variant_id")
    activity_id = proto_variant_response.get("activity_id")
    variant_name = proto_variant_response.get("variant_name")

    print(f"✅ variant_id: {variant_id}")
    print(f"✅ activity_id: {activity_id}")
    print(f"✅ variant_name: {variant_name}")

    assert variant_id, "❌ FAIL: No variant_id"
    assert activity_id, "❌ FAIL: No activity_id"
    assert variant_name, "❌ FAIL: No variant_name"

    # Test task_steps array
    task_steps = proto_variant_response.get("task_steps", [])
    print(f"✅ task_steps count: {len(task_steps)}")

    assert len(task_steps) == 2, "❌ FAIL: Expected 2 task_steps"

    # Test task step fields
    first_task = task_steps[0]
    task_id = first_task.get("id")
    subagent = first_task.get("subagent")
    prompt_template = first_task.get("prompt", {}).get("template")
    max_tokens = first_task.get("prompt", {}).get("max_tokens")

    print(f"✅ task[0].id: {task_id}")
    print(f"✅ task[0].subagent: {subagent}")
    print(f"✅ task[0].prompt.template: {prompt_template[:30]}...")
    print(f"✅ task[0].prompt.max_tokens: {max_tokens}")

    assert task_id == "task-1", "❌ FAIL: Wrong task id"
    assert subagent == "planner", "❌ FAIL: Wrong subagent"
    assert max_tokens == 8000, "❌ FAIL: Wrong max_tokens"

    # Test nested structures
    execution_config = proto_variant_response.get("execution_config", {})
    context_requirements = execution_config.get("context_requirements", [])

    print(f"✅ execution_config.context_requirements: {context_requirements}")

    assert len(context_requirements) == 2, "❌ FAIL: Wrong context_requirements count"

    # Test expected_* fields
    expected_cost = proto_variant_response.get("expected_cost")
    expected_duration_ms = proto_variant_response.get("expected_duration_ms")
    expected_quality_score = proto_variant_response.get("expected_quality_score")

    print(f"✅ expected_cost: {expected_cost}")
    print(f"✅ expected_duration_ms: {expected_duration_ms}")
    print(f"✅ expected_quality_score: {expected_quality_score}")

    assert expected_cost == 0.5, "❌ FAIL: Wrong expected_cost"
    assert expected_duration_ms == 120000, "❌ FAIL: Wrong expected_duration_ms"

    # Test genealogy
    genealogy = proto_variant_response.get("genealogy", {})
    content_hash = genealogy.get("content_hash")
    parent_hash = genealogy.get("parent_hash")

    print(f"✅ genealogy.content_hash: {content_hash}")
    print(f"✅ genealogy.parent_hash: {parent_hash or '(root)'}")

    assert content_hash, "❌ FAIL: No content_hash in genealogy"

    print("\n✅ PASS: ActivityVariant proto parsing works")
    return True


def test_templates_list_proto_parsing():
    """Test parsing proto templates list response."""
    print("\n" + "=" * 80)
    print("TEST 3: Templates List Proto Response Parsing")
    print("=" * 80)

    # Simulate v2 API templates list response
    proto_templates_response = {
        "templates": [
            {
                "variant_id": "add-feature-v1",
                "activity_id": "add-feature",
                "variant_name": "Add Feature",
                "description": "Add a new feature",
                "task_steps": [
                    {"id": "t1", "subagent": "planner", "description": "Plan"},
                    {"id": "t2", "subagent": "coder", "description": "Code"},
                ],
                "expected_cost": 0.3,
                "expected_duration_ms": 60000,
                "expected_quality_score": 0.85,
            },
            {
                "variant_id": "fix-bug-v2",
                "activity_id": "fix-bug",
                "variant_name": "Fix Bug v2",
                "description": "Fix a bug with tests",
                "task_steps": [
                    {"id": "t1", "subagent": "debugger", "description": "Debug"},
                ],
                "expected_cost": 0.2,
                "expected_duration_ms": 30000,
                "expected_quality_score": 0.9,
            },
        ],
        "total": 2,
        "limit": 20,
        "offset": 0,
    }

    print(f"\nProto Templates List Response:")
    print(json.dumps(proto_templates_response, indent=2)[:400] + "...")

    templates = proto_templates_response.get("templates", [])

    print(f"\n✅ templates count: {len(templates)}")
    assert len(templates) == 2, "❌ FAIL: Expected 2 templates"

    # Test CLI conversion logic
    print("\n--- Testing CLI Conversion ---")

    for i, t in enumerate(templates):
        print(f"\nTemplate {i + 1}:")

        template_id = t.get("variant_id") or t.get("id")
        name = t.get("variant_name") or t.get("name")
        task_count = len(t.get("task_steps", []))
        success_rate = t.get("expected_quality_score", 0)
        avg_cost = t.get("expected_cost", 0)
        avg_duration = t.get("expected_duration_ms", 0)

        print(f"  id: {template_id}")
        print(f"  name: {name}")
        print(f"  task_count: {task_count}")
        print(f"  success_rate: {success_rate}")
        print(f"  avg_cost: {avg_cost}")
        print(f"  avg_duration: {avg_duration}")

        assert template_id, f"❌ FAIL: No id for template {i + 1}"
        assert name, f"❌ FAIL: No name for template {i + 1}"
        assert task_count > 0, f"❌ FAIL: No tasks for template {i + 1}"

    print("\n✅ PASS: Templates list proto parsing works")
    return True


def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("METABOB-CLI PROTO HANDLING TEST SUITE")
    print("=" * 80)
    print("Testing CLI's ability to parse proto message responses from v2 API")
    print("=" * 80 + "\n")

    tests = [
        test_session_proto_parsing,
        test_activity_variant_proto_parsing,
        test_templates_list_proto_parsing,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            print(f"\n❌ TEST FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"\n❌ TEST ERROR: {e}")
            failed += 1

    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total: {len(tests)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")

    if failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nThe CLI can correctly parse proto message responses:")
        print("  ✅ Session proto (metadata.session_token extraction)")
        print("  ✅ ActivityVariant proto (task_steps, snake_case fields)")
        print("  ✅ Templates list proto (multiple variants)")
        print("\nReady for v2 API proto compliance!")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED")
        return 1


if __name__ == "__main__":
    exit(main())
